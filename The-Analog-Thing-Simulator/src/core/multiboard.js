'use strict';

const { PatchMachine, splitSocketId, normalizeConnection } = require('./patch');
const { patchDefinitionFromSerializedPatch } = require('./serialization');
const { createThatPrototypeInventory } = require('./inventory');
const { runMode, MODES } = require('./modes');
const { HybridPortAdapter } = require('./hybrid');

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireBoardId(boardId) {
  if (typeof boardId !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(boardId)) {
    throw new Error(`board id must start with a letter and contain only letters, digits, _ or -, got ${boardId}`);
  }
}

function boardPrefix(boardId) {
  requireBoardId(boardId);
  return `${boardId}__`;
}

function prefixComponentId(boardId, componentId) {
  return `${boardPrefix(boardId)}${componentId}`;
}

function unprefixComponentId(prefixedId) {
  const index = String(prefixedId).indexOf('__');
  if (index <= 0) return { boardId: null, componentId: prefixedId };
  return { boardId: prefixedId.slice(0, index), componentId: prefixedId.slice(index + 2) };
}

function prefixSocketId(boardId, socketId) {
  const parsed = splitSocketId(socketId);
  return `${prefixComponentId(boardId, parsed.componentId)}.${parsed.socketName}`;
}

function parseBoardSocketRef(ref, defaultBoardId = null) {
  if (typeof ref !== 'string') throw new Error(`board socket reference must be a string, got ${ref}`);
  const trimmed = ref.trim();
  const colon = trimmed.indexOf(':');
  if (colon > 0) {
    return { boardId: trimmed.slice(0, colon), socketId: trimmed.slice(colon + 1) };
  }
  if (!defaultBoardId) throw new Error(`board socket reference requires board prefix board:component.socket, got ${ref}`);
  return { boardId: defaultBoardId, socketId: trimmed };
}

function prefixConnection(boardId, connection) {
  const normalized = normalizeConnection(connection);
  const prefixed = {
    from: prefixSocketId(boardId, normalized.from),
    to: prefixSocketId(boardId, normalized.to),
  };
  if (normalized.label) prefixed.label = normalized.label;
  return prefixed;
}

function prefixOutputMap(boardId, outputs) {
  const prefixed = {};
  for (const [label, socketId] of Object.entries(outputs || {})) {
    prefixed[`${boardId}.${label}`] = prefixSocketId(boardId, socketId);
  }
  return prefixed;
}

function normalizeBoardDefinition(board, options = {}) {
  if (!board || typeof board !== 'object') throw new Error('multi-board entry must be an object');
  requireBoardId(board.id);
  const inventory = board.inventory || options.inventory || createThatPrototypeInventory();
  const source = board.patch || board.definition || board.serializedPatch;
  if (!source) throw new Error(`board ${board.id} requires patch, definition, or serializedPatch`);
  const definition = Array.isArray(source.components) && source.components.some((component) => component.type)
    ? clonePlain(source)
    : patchDefinitionFromSerializedPatch(source, { inventory });
  return {
    id: board.id,
    role: board.role || 'minion',
    label: board.label || board.id,
    definition,
  };
}

function normalizeInterBoardLink(link) {
  if (Array.isArray(link) && link.length === 2) return { from: link[0], to: link[1] };
  if (link && typeof link.from === 'string' && typeof link.to === 'string') {
    const normalized = { from: link.from, to: link.to };
    if (typeof link.label === 'string') normalized.label = link.label;
    return normalized;
  }
  throw new Error(`invalid inter-board link: ${JSON.stringify(link)}`);
}

function materializeInterBoardLink(link) {
  const normalized = normalizeInterBoardLink(link);
  const from = parseBoardSocketRef(normalized.from);
  const to = parseBoardSocketRef(normalized.to);
  const connection = {
    from: prefixSocketId(from.boardId, from.socketId),
    to: prefixSocketId(to.boardId, to.socketId),
  };
  if (normalized.label) connection.label = normalized.label;
  return connection;
}

function createMultiBoardPatchDefinition(systemDefinition, options = {}) {
  if (!systemDefinition || !Array.isArray(systemDefinition.boards) || systemDefinition.boards.length === 0) {
    throw new Error('multi-board system requires a non-empty boards array');
  }
  const boards = systemDefinition.boards.map((board) => normalizeBoardDefinition(board, options));
  const seen = new Set();
  for (const board of boards) {
    if (seen.has(board.id)) throw new Error(`duplicate board id: ${board.id}`);
    seen.add(board.id);
  }

  const components = [];
  const connections = [];
  const outputs = {};
  const boardMetadata = [];

  for (const board of boards) {
    const prefix = boardPrefix(board.id);
    for (const component of board.definition.components) {
      components.push({ ...clonePlain(component), id: `${prefix}${component.id}`, label: `${board.label} / ${component.label || component.id}` });
    }
    for (const connection of board.definition.connections || []) connections.push(prefixConnection(board.id, connection));
    Object.assign(outputs, prefixOutputMap(board.id, board.definition.outputs || {}));
    boardMetadata.push({
      id: board.id,
      role: board.role,
      label: board.label,
      componentCount: board.definition.components.length,
      internalCableCount: (board.definition.connections || []).length,
      outputLabels: Object.keys(board.definition.outputs || {}),
    });
  }

  for (const link of systemDefinition.links || systemDefinition.interBoardCables || []) connections.push(materializeInterBoardLink(link));

  for (const [label, ref] of Object.entries(systemDefinition.outputs || {})) {
    const parsed = parseBoardSocketRef(ref);
    outputs[label] = prefixSocketId(parsed.boardId, parsed.socketId);
  }

  return {
    schemaVersion: systemDefinition.schemaVersion || 'analog-thing-multiboard/v1',
    name: systemDefinition.name || 'multi-board THAT system',
    description: systemDefinition.description || '',
    components,
    connections,
    outputs,
    parameters: {
      ...(systemDefinition.parameters || {}),
      boards: boardMetadata,
      interBoardCableCount: (systemDefinition.links || systemDefinition.interBoardCables || []).length,
    },
  };
}

class MultiBoardSystem {
  constructor(systemDefinition, options = {}) {
    this.definition = clonePlain(systemDefinition);
    this.patchDefinition = createMultiBoardPatchDefinition(systemDefinition, options);
    this.machine = new PatchMachine(this.patchDefinition);
    this.hybrid = new HybridPortAdapter(options.hybrid || systemDefinition.hybrid || {});
    this.boards = this.patchDefinition.parameters.boards || [];
    this.masterBoard = this.boards.find((board) => board.role === 'master') || this.boards[0] || null;
    this.minionBoards = this.boards.filter((board) => board !== this.masterBoard);
  }

  defaultStateVector() { return this.machine.defaultStateVector(); }
  evaluate(state) { return this.machine.evaluate(state); }
  applyInitialConditions(state) { return this.machine.applyInitialConditions(state); }
  socketMetadata() { return this.machine.socketMetadata(); }

  run(options = {}) {
    const mode = options.mode || this.hybrid.getControlMode() || MODES.OP;
    return runMode(this.machine, { ...options, mode });
  }

  captureHybridFrame(state = this.defaultStateVector()) {
    return this.hybrid.captureEvaluation(this.evaluate(state));
  }

  summarize() {
    return {
      name: this.patchDefinition.name,
      boardCount: this.boards.length,
      masterBoard: this.masterBoard ? this.masterBoard.id : null,
      minionBoards: this.minionBoards.map((board) => board.id),
      componentCount: this.patchDefinition.components.length,
      cableCount: this.patchDefinition.connections.length,
      interBoardCableCount: this.patchDefinition.parameters.interBoardCableCount || 0,
      outputNames: Object.keys(this.patchDefinition.outputs),
      hybrid: this.hybrid.toJSON(),
    };
  }
}

function createMultiBoardSystem(systemDefinition, options = {}) {
  return new MultiBoardSystem(systemDefinition, options);
}

module.exports = {
  MultiBoardSystem,
  createMultiBoardSystem,
  createMultiBoardPatchDefinition,
  normalizeBoardDefinition,
  prefixComponentId,
  unprefixComponentId,
  prefixSocketId,
  parseBoardSocketRef,
  materializeInterBoardLink,
};
