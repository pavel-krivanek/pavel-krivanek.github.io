/* global window, document */
'use strict';

(function attachCableInteractionApp(globalScope) {
  const DEFAULT_HIT_RADIUS = 12;
  const DEFAULT_WIRE_BEND_LIMIT = 240;
  const DEFAULT_PANEL_BOUNDS = Object.freeze({ x: 0, y: 0, width: 702.65399, height: 514.23199 });
  const EDITOR_MODES = Object.freeze({ SELECT: 'select', CABLE: 'cable', DELETE: 'delete', INSPECT: 'inspect', PAN_ZOOM: 'pan-zoom' });
  const EDITABLE_MODES = Object.freeze(Object.values(EDITOR_MODES));

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeText(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function getPatchEditorApp() {
    if (globalScope.AnalogThingPatchEditorApp) return globalScope.AnalogThingPatchEditorApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./patchEditorApp'); } catch (error) { return null; }
    }
    return null;
  }

  function getPatchPanelApp() {
    if (globalScope.AnalogThingPatchPanelApp) return globalScope.AnalogThingPatchPanelApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./patchPanelApp'); } catch (error) { return null; }
    }
    return null;
  }


  function getDesignUsabilityCore() {
    if (globalScope.AnalogThingDesignUsability) return globalScope.AnalogThingDesignUsability;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designUsability'); } catch (error) { return null; }
    }
    return null;
  }


  function getDesignAccessoriesCore() {
    if (globalScope.AnalogThingDesignAccessories) return globalScope.AnalogThingDesignAccessories;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designAccessories'); } catch (error) { return null; }
    }
    return null;
  }

  function normalizePatch(patch) {
    const editor = getPatchEditorApp();
    if (editor && typeof editor.normalizeSerializedPatch === 'function') return editor.normalizeSerializedPatch(patch);
    if (!patch || typeof patch !== 'object') throw new Error('patch must be an object');
    return clonePlain(Object.assign({}, patch, { cables: clonePlain(patch.cables || patch.connections || []) }));
  }

  function patchSignature(patch) {
    const normalized = normalizePatch(patch);
    return JSON.stringify({ components: normalized.components, cables: normalized.cables, outputs: normalized.outputs, parameters: normalized.parameters });
  }

  function patchEqual(a, b) {
    return patchSignature(a) === patchSignature(b);
  }

  function parseSocketId(socketId) {
    const parts = String(socketId || '').trim().split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`invalid socket id ${socketId}`);
    return { componentId: parts[0], socketName: parts[1] };
  }

  function componentById(model, id) {
    return ((model && model.components) || []).find((component) => component.id === id) || null;
  }

  function socketPosition(component, socketName, direction) {
    if (component && component.socketPositions && component.socketPositions[socketName]) {
      return clonePlain(component.socketPositions[socketName]);
    }
    const inputNames = component.inputs || [];
    const outputNames = component.outputs || [];
    const isInput = direction === 'input';
    const names = isInput ? inputNames : outputNames;
    const index = Math.max(0, names.indexOf(socketName));
    const count = Math.max(1, names.length);
    const y = component.y + ((index + 1) / (count + 1)) * component.h;
    const x = isInput ? component.x : component.x + component.w;
    return { x, y };
  }

  function logicalSocketCatalogFromPanelModel(model) {
    const catalog = new Map();
    for (const component of (model && model.components) || []) {
      for (const socketName of component.inputs || []) {
        const id = `${component.id}.${socketName}`;
        catalog.set(id, {
          id,
          editorSocketId: id,
          logicalSocketId: id,
          physicalSocketId: null,
          componentId: component.id,
          socketName,
          direction: 'input',
          active: true,
          displayOnly: false,
          unsupported: false,
          position: socketPosition(component, socketName, 'input'),
          component: clonePlain(component),
          source: 'logical-panel',
        });
      }
      for (const socketName of component.outputs || []) {
        const id = `${component.id}.${socketName}`;
        catalog.set(id, {
          id,
          editorSocketId: id,
          logicalSocketId: id,
          physicalSocketId: null,
          componentId: component.id,
          socketName,
          direction: 'output',
          active: true,
          displayOnly: false,
          unsupported: false,
          position: socketPosition(component, socketName, 'output'),
          component: clonePlain(component),
          source: 'logical-panel',
        });
      }
    }
    return catalog;
  }

  function physicalSocketCatalogFromPanelModel(model) {
    const catalog = new Map();
    for (const socket of (model && model.physicalSockets) || []) {
      const direction = socket.direction || 'display-only';
      const editorSocketId = socket.id;
      const id = socket.logicalSocketId || socket.id;
      catalog.set(editorSocketId, {
        id: editorSocketId,
        editorSocketId,
        logicalSocketId: socket.logicalSocketId || null,
        physicalSocketId: socket.id,
        componentId: socket.componentId || null,
        socketName: socket.socketName || null,
        direction,
        active: Boolean(socket.active && socket.logicalSocketId && socket.direction && !socket.displayOnly && !socket.unsupported),
        displayOnly: Boolean(socket.displayOnly || !socket.logicalSocketId || !socket.direction),
        unsupported: Boolean(socket.unsupported),
        group: socket.group || '',
        label: socket.label || '',
        role: socket.role || '',
        multiplicity: socket.multiplicity || null,
        notes: socket.notes || '',
        position: socket.position ? clonePlain(socket.position) : { x: Number(socket.x), y: Number(socket.y) },
        component: socket.componentId ? clonePlain(componentById(model, socket.componentId) || {}) : null,
        source: 'physical-panel',
        patchSocketId: id,
      });
    }
    return catalog;
  }

  function machineUnitSocketPreferenceRank(socket) {
    if (!socket) return 1000;
    const physicalId = String(socket.physicalSocketId || socket.id || '');
    const group = String(socket.group || socket.section || '');
    if (group === '-1/+1') {
      if (/\.out\.a$/.test(physicalId)) return 0;
      if (/\.out\.b$/.test(physicalId)) return 1;
      return 2;
    }
    if (group === 'INTEGRATORS') return 10;
    return 20;
  }

  function sortEntriesForLogicalPreference(logicalSocketId, entries) {
    const id = String(logicalSocketId || '').trim();
    const list = (entries || []).slice();
    if (/^(PLUS1|MINUS1)\.out$/.test(id)) {
      return list.sort((a, b) => (machineUnitSocketPreferenceRank(a) - machineUnitSocketPreferenceRank(b)) || Number(a.y || (a.position && a.position.y) || 0) - Number(b.y || (b.position && b.position.y) || 0) || Number(a.x || (a.position && a.position.x) || 0) - Number(b.x || (b.position && b.position.x) || 0) || String(a.physicalSocketId || a.id).localeCompare(String(b.physicalSocketId || b.id)));
    }
    return list;
  }

  function socketCatalogFromPanelModel(model, options = {}) {
    const includePhysical = Boolean(options.includePhysical);
    const physicalOnly = Boolean(options.physicalOnly);
    const catalog = new Map();
    if (!physicalOnly) {
      for (const [id, socket] of logicalSocketCatalogFromPanelModel(model).entries()) catalog.set(id, socket);
    }
    if (includePhysical || physicalOnly) {
      for (const [id, socket] of physicalSocketCatalogFromPanelModel(model).entries()) catalog.set(id, socket);
    }
    return catalog;
  }

  function listPanelSockets(model, options = {}) {
    return Array.from(socketCatalogFromPanelModel(model, options).values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  function listEditorSockets(model) {
    const hasPhysical = Boolean((model && model.physicalSockets || []).length);
    return listPanelSockets(model, hasPhysical ? { physicalOnly: true } : {});
  }

  function resolveSocket(model, socketId, options = {}) {
    const id = String(socketId || '').trim();
    let socket = socketCatalogFromPanelModel(model, options).get(id);
    if (!socket && !options.includePhysical) socket = socketCatalogFromPanelModel(model, { includePhysical: true }).get(id);
    if (!socket && options.physicalOnly !== true) {
      const physical = sortEntriesForLogicalPreference(id, Array.from(physicalSocketCatalogFromPanelModel(model).values()).filter((entry) => entry.logicalSocketId === id && entry.active))[0];
      if (physical) socket = physical;
    }
    if (!socket) throw new Error(`unknown panel socket ${socketId}`);
    return socket;
  }

  function executableSocketId(socket) {
    if (!socket || !socket.active || socket.displayOnly || socket.unsupported || !socket.logicalSocketId) {
      throw new Error(`socket ${socket && socket.id ? socket.id : 'unknown'} is display-only or unsupported`);
    }
    return socket.logicalSocketId;
  }

  function ensurePatchHasEndpointComponents(patch, model, endpoints) {
    const next = normalizePatch(patch);
    const ids = new Set((next.components || []).map((component) => component && component.id).filter(Boolean));
    const additions = [];
    for (const socket of [endpoints.output, endpoints.input]) {
      if (!socket || !socket.componentId || ids.has(socket.componentId)) continue;
      const modelComponent = componentById(model, socket.componentId);
      if (!modelComponent) continue;
      const entry = { id: socket.componentId };
      if (modelComponent.type) entry.type = modelComponent.type;
      if (modelComponent.label) entry.label = modelComponent.label;
      if (modelComponent.type === 'potentiometer') entry.coefficient = 0.5;
      additions.push(entry);
      ids.add(socket.componentId);
    }
    if (additions.length) next.components = (next.components || []).concat(additions);
    return next;
  }

  function normalizeCableEndpoints(model, firstSocketId, secondSocketId) {
    const first = resolveSocket(model, firstSocketId, { includePhysical: true });
    const second = resolveSocket(model, secondSocketId, { includePhysical: true });
    if (first.direction === 'display-only' || second.direction === 'display-only') {
      throw new Error(`cannot connect display-only socket ${first.direction === 'display-only' ? first.id : second.id}`);
    }
    if (first.direction === second.direction) {
      throw new Error(`cannot connect ${first.direction} socket ${first.id} to ${second.direction} socket ${second.id}`);
    }
    const output = first.direction === 'output' ? first : second;
    const input = first.direction === 'input' ? first : second;
    const from = executableSocketId(output);
    const to = executableSocketId(input);
    return { from, to, output, input, outputEditorSocketId: output.editorSocketId, inputEditorSocketId: input.editorSocketId };
  }

  function cableLabel(from, to, options = {}) {
    if (options.label) return options.label;
    const viaPhysical = options.outputPhysicalSocketId || options.inputPhysicalSocketId
      ? ` (${[options.outputPhysicalSocketId, options.inputPhysicalSocketId].filter(Boolean).join(' -> ')})`
      : '';
    return `panel edit: ${from} -> ${to}${viaPhysical}`;
  }

  function addCableToPatch(patch, model, firstSocketId, secondSocketId, options = {}) {
    const endpoints = normalizeCableEndpoints(model, firstSocketId, secondSocketId);
    const next = ensurePatchHasEndpointComponents(patch, model, endpoints);
    const replaceExistingInput = options.replaceExistingInput !== false;
    const remaining = replaceExistingInput
      ? next.cables.filter((cable) => cable.to !== endpoints.to)
      : next.cables.slice();
    if (remaining.some((cable) => cable.from === endpoints.from && cable.to === endpoints.to)) {
      return { patch: next, cable: { from: endpoints.from, to: endpoints.to }, changed: false, message: `Cable already exists: ${endpoints.from} -> ${endpoints.to}` };
    }
    const cable = {
      from: endpoints.from,
      to: endpoints.to,
      label: cableLabel(endpoints.from, endpoints.to, Object.assign({}, options, {
        outputPhysicalSocketId: endpoints.output.physicalSocketId,
        inputPhysicalSocketId: endpoints.input.physicalSocketId,
      })),
    };
    next.cables = remaining.concat([cable]);
    return { patch: next, cable, changed: true, message: `Added ${endpoints.from} -> ${endpoints.to}` };
  }

  function removeCableAtIndex(patch, index) {
    const next = normalizePatch(patch);
    const numericIndex = Number(index);
    if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= next.cables.length) {
      throw new Error(`invalid cable index ${index}`);
    }
    const removed = next.cables[numericIndex];
    next.cables = next.cables.filter((_, i) => i !== numericIndex);
    return { patch: next, removed, changed: true, message: `Removed ${removed.from} -> ${removed.to}` };
  }

  function removeCableByEndpoint(patch, from, to) {
    const next = normalizePatch(patch);
    const before = next.cables.length;
    next.cables = next.cables.filter((cable) => !(cable.from === from && cable.to === to));
    return { patch: next, changed: next.cables.length !== before, message: next.cables.length !== before ? `Removed ${from} -> ${to}` : `No matching cable ${from} -> ${to}` };
  }

  function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function hitTestSocket(model, x, y, radius = DEFAULT_HIT_RADIUS, options = {}) {
    const point = { x: Number(x), y: Number(y) };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    let best = null;
    const radiusSquared = radius * radius;
    for (const socket of (options.editorSockets ? listEditorSockets(model) : listPanelSockets(model, options))) {
      const d2 = distanceSquared(point, socket.position);
      if (d2 <= radiusSquared && (!best || d2 < best.distanceSquared)) best = Object.assign({}, socket, { distanceSquared: d2 });
    }
    return best;
  }

  function cleanHistoryEntry(patch, message, editType) {
    return { patch: normalizePatch(patch), message: message || '', editType: editType || 'patch', at: new Date(0).toISOString() };
  }

  function historyCapacity(options = {}) { return Number.isInteger(options.historyLimit) ? Math.max(1, options.historyLimit) : 100; }

  function createCableEditState(patch, model, options = {}) {
    const normalizedPatch = normalizePatch(patch);
    return {
      patch: normalizedPatch,
      model: clonePlain(model),
      mode: EDITABLE_MODES.includes(options.mode) ? options.mode : EDITOR_MODES.CABLE,
      selectedSocketId: null,
      selectedCableIndex: null,
      inspectedSocket: null,
      inspectedCable: null,
      previewCable: null,
      history: { past: [], future: [] },
      cleanPatchSignature: patchSignature(normalizedPatch),
      dirty: false,
      lastMessage: 'Cable mode: select an output socket and an input socket to add or replace a cable.',
      lastError: '',
    };
  }

  function refreshDirty(state) {
    state.dirty = patchSignature(state.patch) !== state.cleanPatchSignature;
    return state;
  }

  function cloneStateForReturn(state) {
    return Object.assign({}, state, {
      patch: normalizePatch(state.patch),
      model: clonePlain(state.model),
      history: clonePlain(state.history || { past: [], future: [] }),
      inspectedSocket: state.inspectedSocket ? clonePlain(state.inspectedSocket) : null,
      inspectedCable: state.inspectedCable ? clonePlain(state.inspectedCable) : null,
      previewCable: state.previewCable ? clonePlain(state.previewCable) : null,
    });
  }

  function withStateDefaults(state) {
    const patch = normalizePatch(state.patch);
    return Object.assign(createCableEditState(patch, state.model || { components: [] }), clonePlain(state), { patch });
  }

  function recordPatchHistory(state, nextPatch, options = {}) {
    const next = withStateDefaults(state);
    const normalizedNextPatch = normalizePatch(nextPatch);
    if (patchEqual(next.patch, normalizedNextPatch)) {
      next.lastMessage = options.message || next.lastMessage || 'No patch change.';
      next.lastError = '';
      return refreshDirty(next);
    }
    const past = (next.history && next.history.past ? next.history.past : []).concat([cleanHistoryEntry(next.patch, options.previousMessage || next.lastMessage, options.editType)]);
    next.history = { past: past.slice(-historyCapacity(options)), future: [] };
    next.patch = normalizedNextPatch;
    next.selectedCableIndex = null;
    next.inspectedCable = null;
    next.lastMessage = options.message || 'Patch edited.';
    next.lastError = '';
    return refreshDirty(next);
  }

  function undoCableEdit(state) {
    const next = withStateDefaults(state);
    const past = (next.history && next.history.past) || [];
    if (!past.length) {
      next.lastMessage = 'Nothing to undo.';
      next.lastError = '';
      return { state: refreshDirty(next), action: 'unchanged' };
    }
    const previous = past[past.length - 1];
    const remaining = past.slice(0, -1);
    const future = (next.history.future || []).concat([cleanHistoryEntry(next.patch, next.lastMessage, 'redo')]);
    next.history = { past: remaining, future };
    next.patch = normalizePatch(previous.patch);
    next.selectedSocketId = null;
    next.selectedCableIndex = null;
    next.previewCable = null;
    next.inspectedCable = null;
    next.lastMessage = `Undo: ${previous.message || previous.editType || 'patch edit'}`;
    next.lastError = '';
    return { state: refreshDirty(next), action: 'undo' };
  }

  function redoCableEdit(state) {
    const next = withStateDefaults(state);
    const future = (next.history && next.history.future) || [];
    if (!future.length) {
      next.lastMessage = 'Nothing to redo.';
      next.lastError = '';
      return { state: refreshDirty(next), action: 'unchanged' };
    }
    const redone = future[future.length - 1];
    const remaining = future.slice(0, -1);
    const past = (next.history.past || []).concat([cleanHistoryEntry(next.patch, next.lastMessage, 'undo')]);
    next.history = { past, future: remaining };
    next.patch = normalizePatch(redone.patch);
    next.selectedSocketId = null;
    next.selectedCableIndex = null;
    next.previewCable = null;
    next.inspectedCable = null;
    next.lastMessage = `Redo: ${redone.message || redone.editType || 'patch edit'}`;
    next.lastError = '';
    return { state: refreshDirty(next), action: 'redo' };
  }

  function markCableEditorClean(state) {
    const next = withStateDefaults(state);
    next.cleanPatchSignature = patchSignature(next.patch);
    next.dirty = false;
    next.lastMessage = 'Current editor patch marked saved.';
    next.lastError = '';
    return next;
  }

  function setEditorMode(state, mode) {
    const normalizedMode = EDITABLE_MODES.includes(mode) ? mode : EDITOR_MODES.CABLE;
    const next = withStateDefaults(state);
    next.mode = normalizedMode;
    next.selectedSocketId = null;
    next.previewCable = null;
    next.selectedCableIndex = null;
    next.inspectedSocket = null;
    next.inspectedCable = null;
    next.lastError = '';
    const names = {
      select: 'Select mode: click a cable to select it, then press Delete/Backspace to remove it.',
      cable: 'Cable mode: select two compatible sockets to add or replace a cable.',
      delete: 'Delete mode: click a cable or press Delete/Backspace on a selected cable to remove it.',
      inspect: 'Inspect mode: click a socket or cable to see its physical and logical mapping.',
      'pan-zoom': 'Pan/zoom mode: wiring edits are suspended while the panel is being navigated.',
    };
    next.lastMessage = names[normalizedMode];
    return refreshDirty(next);
  }

  function socketPhysicalAlternates(model, logicalSocketId, direction) {
    return ((model && model.physicalSockets) || [])
      .filter((socket) => socket.logicalSocketId === logicalSocketId && (!direction || socket.direction === direction))
      .map((socket) => ({ id: socket.id, label: socket.label || '', group: socket.group || '', x: socket.x, y: socket.y, active: Boolean(socket.active), displayOnly: Boolean(socket.displayOnly || socket.unsupported) }));
  }

  function describeSocket(model, socketId) {
    const socket = resolveSocket(model, socketId, { includePhysical: true });
    const logicalSocketId = socket.logicalSocketId || socket.id;
    const alternates = socket.logicalSocketId ? socketPhysicalAlternates(model, socket.logicalSocketId, socket.direction) : [];
    const lines = [
      `socket: ${socket.id}`,
      socket.physicalSocketId ? `physical: ${socket.physicalSocketId}` : null,
      logicalSocketId ? `logical: ${logicalSocketId}` : null,
      socket.group ? `group: ${socket.group}` : null,
      socket.label ? `label: ${socket.label}` : null,
      socket.role ? `role: ${socket.role}` : null,
      socket.displayOnly || socket.unsupported ? 'status: display-only/unsupported' : 'status: editable',
      alternates.length > 1 ? `duplicate jacks for logical node: ${alternates.map((entry) => entry.id).join(', ')}` : null,
    ].filter(Boolean);
    return Object.assign({}, socket, { logicalSocketId, alternates, tooltip: lines.join('\n') });
  }

  function describeCable(model, cable, index = null) {
    const fromPhysical = socketPhysicalAlternates(model, cable.from, 'output');
    const toPhysical = socketPhysicalAlternates(model, cable.to, 'input');
    const lines = [
      index === null || index === undefined ? 'cable' : `cable ${Number(index) + 1}`,
      `logical: ${cable.from} -> ${cable.to}`,
      fromPhysical.length ? `from physical: ${fromPhysical.map((entry) => entry.id).join(', ')}` : 'from physical: none mapped',
      toPhysical.length ? `to physical: ${toPhysical.map((entry) => entry.id).join(', ')}` : 'to physical: none mapped',
      cable.label ? `label: ${cable.label}` : null,
    ].filter(Boolean);
    return { index, from: cable.from, to: cable.to, label: cable.label || '', fromPhysical, toPhysical, tooltip: lines.join('\n') };
  }

  function inspectSocketForEdit(state, socketId) {
    const next = withStateDefaults(state);
    next.inspectedSocket = describeSocket(next.model, socketId);
    next.inspectedCable = null;
    next.selectedSocketId = null;
    next.selectedCableIndex = null;
    next.previewCable = null;
    next.lastMessage = next.inspectedSocket.tooltip;
    next.lastError = '';
    return { state: refreshDirty(next), action: 'inspected-socket', socket: clonePlain(next.inspectedSocket) };
  }

  function selectCableForEdit(state, index) {
    const next = withStateDefaults(state);
    const numericIndex = Number(index);
    if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= next.patch.cables.length) {
      next.lastError = `invalid cable index ${index}`;
      next.lastMessage = next.lastError;
      return { state: refreshDirty(next), action: 'error', error: new Error(next.lastError) };
    }
    const cable = next.patch.cables[numericIndex];
    next.selectedCableIndex = numericIndex;
    next.selectedSocketId = null;
    next.previewCable = null;
    next.inspectedSocket = null;
    next.inspectedCable = describeCable(next.model, cable, numericIndex);
    next.lastError = '';
    next.lastMessage = `Selected cable ${numericIndex + 1}: ${cable.from} -> ${cable.to}. Press Delete/Backspace to remove it.`;
    return { state: refreshDirty(next), action: 'selected-cable', cable: clonePlain(next.inspectedCable) };
  }

  function deleteSelectedCable(state) {
    const next = withStateDefaults(state);
    if (next.selectedCableIndex === null || next.selectedCableIndex === undefined) {
      next.lastMessage = 'No cable is selected.';
      next.lastError = '';
      return { state: refreshDirty(next), action: 'unchanged' };
    }
    try {
      const result = removeCableAtIndex(next.patch, next.selectedCableIndex);
      const edited = recordPatchHistory(next, result.patch, { message: result.message, editType: 'cable-delete' });
      edited.selectedCableIndex = null;
      edited.inspectedCable = null;
      return { state: edited, action: 'deleted', cable: result.removed };
    } catch (error) {
      next.lastMessage = error.message;
      next.lastError = error.message;
      return { state: refreshDirty(next), action: 'error', error };
    }
  }

  function createPreviewCable(model, selectedSocketId, pointer, radius = DEFAULT_HIT_RADIUS, options = {}) {
    if (!selectedSocketId) return null;
    const selected = resolveSocket(model, selectedSocketId, { includePhysical: true });
    const point = pointer && Number.isFinite(Number(pointer.x)) && Number.isFinite(Number(pointer.y))
      ? { x: Number(pointer.x), y: Number(pointer.y) }
      : { x: selected.position.x, y: selected.position.y };
    const target = hitTestSocket(model, point.x, point.y, radius, options.editorSockets ? { editorSockets: true } : { includePhysical: true });
    let validTarget = false;
    let normalized = null;
    if (target && target.id !== selected.id) {
      try {
        normalized = normalizeCableEndpoints(model, selected.id, target.id);
        validTarget = true;
      } catch (error) {
        validTarget = false;
      }
    }
    return {
      from: selected.position,
      to: validTarget ? target.position : point,
      selectedSocketId: selected.id,
      selectedDirection: selected.direction,
      targetSocketId: validTarget ? target.id : null,
      validTarget,
      normalizedCable: normalized ? { from: normalized.from, to: normalized.to } : null,
      label: validTarget ? `${normalized.from} -> ${normalized.to}` : `preview from ${selected.id}`,
    };
  }

  function previewCablePath(preview) {
    if (!preview) return '';
    const start = preview.from;
    const end = preview.to;
    const midX = (start.x + end.x) / 2;
    return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
  }

  function selectSocketForCable(state, socketId, options = {}) {
    const next = withStateDefaults(state);
    next.patch = normalizePatch(next.patch);
    next.model = clonePlain(next.model);
    next.lastError = '';
    const socket = resolveSocket(next.model, socketId, { includePhysical: true });
    if (socket.displayOnly || socket.unsupported || !socket.logicalSocketId) {
      next.lastError = `socket ${socket.id} is display-only or unsupported`;
      next.lastMessage = next.lastError;
      return { state: refreshDirty(next), action: 'error', error: new Error(next.lastError), socket };
    }
    if (!next.selectedSocketId) {
      next.selectedSocketId = socket.id;
      next.selectedCableIndex = null;
      next.inspectedCable = null;
      next.previewCable = createPreviewCable(next.model, socket.id, socket.position, DEFAULT_HIT_RADIUS, { editorSockets: true });
      next.lastMessage = `Selected socket ${socket.id}${socket.logicalSocketId && socket.logicalSocketId !== socket.id ? ` (${socket.logicalSocketId})` : ''}. Select a compatible second socket to complete the cable.`;
      return { state: refreshDirty(next), action: 'selected', socket };
    }
    if (next.selectedSocketId === socket.id) {
      next.selectedSocketId = null;
      next.previewCable = null;
      next.lastMessage = `Cleared selected socket ${socket.id}.`;
      return { state: refreshDirty(next), action: 'cleared', socket };
    }
    try {
      const result = addCableToPatch(next.patch, next.model, next.selectedSocketId, socket.id, options);
      let edited = next;
      if (result.changed) edited = recordPatchHistory(next, result.patch, { message: result.message, editType: 'cable-add', historyLimit: options.historyLimit });
      else edited.patch = result.patch;
      edited.selectedSocketId = null;
      edited.previewCable = null;
      edited.lastMessage = result.message;
      edited.lastError = '';
      return { state: refreshDirty(edited), action: result.changed ? 'added' : 'unchanged', cable: result.cable, socket };
    } catch (error) {
      next.lastError = error.message;
      next.lastMessage = error.message;
      return { state: refreshDirty(next), action: 'error', error, socket };
    }
  }

  function handleSocketKey(state, socketId, key, options = {}) {
    const normalizedKey = String(key || '');
    if (normalizedKey === 'Enter' || normalizedKey === ' ') {
      if (state.mode === EDITOR_MODES.INSPECT) return inspectSocketForEdit(state, socketId);
      if (state.mode === EDITOR_MODES.CABLE) return selectSocketForCable(state, socketId, options);
    }
    if (normalizedKey === 'Escape') {
      const next = withStateDefaults(state);
      next.selectedSocketId = null;
      next.selectedCableIndex = null;
      next.previewCable = null;
      next.lastMessage = 'Cleared panel editor selection.';
      next.lastError = '';
      return { state: refreshDirty(next), action: 'cleared' };
    }
    return { state: refreshDirty(withStateDefaults(state)), action: 'ignored' };
  }

  function handleCableEditorKey(state, key) {
    const normalizedKey = String(key || '');
    if (normalizedKey === 'Delete' || normalizedKey === 'Backspace') return deleteSelectedCable(state);
    if ((normalizedKey === 'z' || normalizedKey === 'Z') && state.ctrlKey) return undoCableEdit(state);
    if ((normalizedKey === 'y' || normalizedKey === 'Y') && state.ctrlKey) return redoCableEdit(state);
    return { state: refreshDirty(withStateDefaults(state)), action: 'ignored' };
  }

  function summarizeCableInteraction(patch, model) {
    const normalized = normalizePatch(patch);
    const sockets = listPanelSockets(model);
    const editorSockets = listEditorSockets(model);
    const drivenInputs = new Set(normalized.cables.map((cable) => cable.to));
    return {
      componentCount: ((model && model.components) || []).length,
      cableCount: normalized.cables.length,
      socketCount: sockets.length,
      editorSocketCount: editorSockets.length,
      physicalEditorSocketCount: editorSockets.filter((socket) => socket.physicalSocketId).length,
      inputSocketCount: sockets.filter((socket) => socket.direction === 'input').length,
      outputSocketCount: sockets.filter((socket) => socket.direction === 'output').length,
      drivenInputCount: drivenInputs.size,
      openInputSockets: sockets.filter((socket) => socket.direction === 'input' && !drivenInputs.has(socket.logicalSocketId || socket.id)).map((socket) => socket.logicalSocketId || socket.id),
      modes: clonePlain(EDITOR_MODES),
    };
  }

  function selectedIntegratedWireForState(state) {
    if (!state || !state.selectedWireId || !state.model || !state.patch) return null;
    return integratedWiresFromPatch(state.model, state.patch).find((wire) => wire.id === state.selectedWireId) || null;
  }

  function connectorLabelForEndpoint(endpoint) {
    if (!endpoint) return 'unknown';
    return [endpoint.connectorId, endpoint.section].filter(Boolean).join(' · ') || `(${round2(endpoint.x)}, ${round2(endpoint.y)})`;
  }

  function renderSelectedWireCard(wire) {
    if (!wire) return '';
    const runtime = wire.panelOnly ? '<span class="panel-inspector-badge warning">panel-only</span>' : '<span class="panel-inspector-badge">runtime wire</span>';
    return `<div class="panel-inspector-card selected-wire-card" data-panel-selection="wire">
      <div class="panel-inspector-heading"><span class="wire-color-chip" style="--wire-color:${escapeText(wire.color)}"></span><strong>${escapeText(wire.id)}</strong>${runtime}</div>
      <dl class="panel-inspector-grid">
        <dt>from</dt><dd><strong>${escapeText(connectorLabelForEndpoint(wire.from))}</strong><br><code>${escapeText(wire.logicalFrom)}</code></dd>
        <dt>to</dt><dd><strong>${escapeText(connectorLabelForEndpoint(wire.to))}</strong><br><code>${escapeText(wire.logicalTo)}</code></dd>
      </dl>
      <p class="panel-inspector-hint">Drag either endpoint handle to move one side, or press Delete to remove this wire.</p>
    </div>`;
  }

  function renderInspectedSocketCard(socket) {
    if (!socket) return '';
    const badge = socket.displayOnly || socket.unsupported
      ? '<span class="panel-inspector-badge warning">not simulated</span>'
      : '<span class="panel-inspector-badge">editable</span>';
    return `<div class="panel-inspector-card selected-socket-card" data-panel-selection="socket">
      <div class="panel-inspector-heading"><strong>${escapeText(socket.physicalSocketId || socket.id)}</strong>${badge}</div>
      <dl class="panel-inspector-grid">
        <dt>logical</dt><dd><code>${escapeText(socket.logicalSocketId || 'none')}</code></dd>
        <dt>section</dt><dd>${escapeText(socket.group || socket.componentId || 'panel')}</dd>
        <dt>label</dt><dd>${escapeText(socket.label || socket.socketName || '')}</dd>
      </dl>
    </div>`;
  }

  function renderCableInteractionStatus(container, stateOrSummary) {
    if (!container) return;
    if (stateOrSummary && stateOrSummary.selectedSocketId !== undefined) {
      const undoCount = stateOrSummary.history && stateOrSummary.history.past ? stateOrSummary.history.past.length : 0;
      const redoCount = stateOrSummary.history && stateOrSummary.history.future ? stateOrSummary.history.future.length : 0;
      const selectedWire = selectedIntegratedWireForState(stateOrSummary);
      const selectionHtml = selectedWire ? renderSelectedWireCard(selectedWire) : renderInspectedSocketCard(stateOrSummary.inspectedSocket);
      container.dataset.valid = stateOrSummary.lastError ? 'false' : 'true';
      container.dataset.dirty = stateOrSummary.dirty ? 'true' : 'false';
      const accessoryGuidanceHtml = renderAccessoryGuidanceStatus(stateOrSummary.accessoryPairGuidance);
      container.innerHTML = `<div class="panel-status-line"><strong>Patch editor</strong><span>tool ${escapeText(stateOrSummary.mode || EDITOR_MODES.CABLE)}</span><span>${stateOrSummary.dirty ? 'unsaved edits' : 'saved'}</span><span>undo ${undoCount}</span><span>redo ${redoCount}</span></div>${selectionHtml}<div class="panel-status-message">${escapeText(stateOrSummary.lastMessage || '')}</div>${accessoryGuidanceHtml}`;
      return;
    }
    const summary = stateOrSummary || {};
    container.dataset.valid = 'true';
    container.dataset.dirty = 'false';
    container.innerHTML = `<strong>Patch editor:</strong> ${summary.cableCount || 0} wires, ${summary.openInputSockets ? summary.openInputSockets.length : 0} open input sockets, ${summary.editorSocketCount || summary.socketCount || 0} editable panel sockets.`;
  }

  function renderPreviewPath(svg, preview) {
    if (!svg || !preview) return null;
    let path = svg.querySelector('[data-preview-cable="true"]');
    if (!path && typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('data-preview-cable', 'true');
      path.setAttribute('class', 'panel-cable preview-cable');
      svg.appendChild(path);
    }
    if (!path) return null;
    path.setAttribute('d', previewCablePath(preview));
    path.setAttribute('data-valid-target', preview.validTarget ? 'true' : 'false');
    path.setAttribute('aria-label', preview.label || 'preview cable');
    return path;
  }

  function clearPreviewPath(svg) {
    if (!svg || !svg.querySelector) return;
    const path = svg.querySelector('[data-preview-cable="true"]');
    if (path && path.parentNode) path.parentNode.removeChild(path);
  }

  function svgPointFromEvent(svg, event) {
    if (!svg || typeof svg.createSVGPoint !== 'function') return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = svg.getScreenCTM && svg.getScreenCTM();
    if (!ctm) return null;
    return point.matrixTransform(ctm.inverse());
  }


  function defaultViewportCore() {
    const core = getDesignUsabilityCore();
    if (!core) throw new Error('design usability core is unavailable');
    return core;
  }

  function createPanelViewportState(model, options = {}) {
    const core = defaultViewportCore();
    return core.panelViewportForPreset(options.preset || core.PANEL_ZOOM_PRESETS.FIT_PANEL, model, options);
  }

  function panelViewportCss(viewport) {
    const normalized = (getDesignUsabilityCore() && getDesignUsabilityCore().normalizePanelViewport)
      ? getDesignUsabilityCore().normalizePanelViewport(viewport)
      : viewport;
    const scale = Number(normalized.scale || 1);
    const offsetX = Number(normalized.offsetX || 0);
    const offsetY = Number(normalized.offsetY || 0);
    return {
      transformOrigin: '0 0',
      transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
      width: `${Math.max(1, scale) * 100}%`,
    };
  }

  function applyPanelViewport(svg, viewport) {
    if (!svg || !svg.style) return viewport;
    const css = panelViewportCss(viewport);
    svg.style.transformOrigin = css.transformOrigin;
    svg.style.transform = css.transform;
    svg.style.width = css.width;
    svg.setAttribute('data-zoom-mode', viewport.mode || 'custom');
    svg.setAttribute('data-zoom-scale', String(Number(viewport.scale || 1).toFixed(3)));
    svg.setAttribute('data-pan-x', String(Math.round(Number(viewport.offsetX || 0))));
    svg.setAttribute('data-pan-y', String(Math.round(Number(viewport.offsetY || 0))));
    return viewport;
  }

  function summarizePanelViewport(viewport) {
    const normalized = (getDesignUsabilityCore() && getDesignUsabilityCore().normalizePanelViewport)
      ? getDesignUsabilityCore().normalizePanelViewport(viewport)
      : viewport;
    return `zoom=${Math.round(Number(normalized.scale || 1) * 100)}%, pan=(${Math.round(Number(normalized.offsetX || 0))}, ${Math.round(Number(normalized.offsetY || 0))}), mode=${normalized.mode || 'custom'}`;
  }

  function focusSocketElement(svg, socketId) {
    if (!svg || !socketId || typeof svg.querySelector !== 'function') return false;
    const escaped = String(socketId).replace(/"/g, '\\"');
    const target = svg.querySelector(`[data-physical-socket-id="${escaped}"]`) || svg.querySelector(`[data-editor-socket-id="${escaped}"]`) || svg.querySelector(`[data-socket-id="${escaped}"]`);
    if (target && typeof target.focus === 'function') {
      target.focus();
      return true;
    }
    return false;
  }


  function getAdoptedConnectorCore() {
    if (globalScope.AnalogThingAdoptedPatchPanelConnectors) return globalScope.AnalogThingAdoptedPatchPanelConnectors;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/adoptedPatchPanelConnectors'); } catch (error) { return null; }
    }
    return null;
  }

  function getAdoptedEditorCore() {
    if (globalScope.AnalogThingAdoptedPatchPanelEditor) return globalScope.AnalogThingAdoptedPatchPanelEditor;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/adoptedPatchPanelEditor'); } catch (error) { return null; }
    }
    return null;
  }

  function listIntegratedPanelConnectors() {
    const connectorCore = getAdoptedConnectorCore();
    if (!connectorCore) return [];
    if (typeof connectorCore.listAdoptedPanelConnectors === 'function') return connectorCore.listAdoptedPanelConnectors();
    if (Array.isArray(connectorCore.ADOPTED_PANEL_CONNECTORS)) return connectorCore.ADOPTED_PANEL_CONNECTORS.map(clonePlain);
    return [];
  }

  function createIntegratedConnectorBridge(model) {
    const editorCore = getAdoptedEditorCore();
    if (editorCore && typeof editorCore.createConnectorPhysicalBridge === 'function') {
      try { return editorCore.createConnectorPhysicalBridge({ physicalSockets: (model && model.physicalSockets) || undefined }); } catch (error) { return null; }
    }
    return null;
  }

  function round2(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    const finite = Number.isFinite(numeric) ? numeric : fallback;
    return Math.min(max, Math.max(min, finite));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomWireColor() {
    const hue = Math.floor(randomBetween(0, 360));
    const saturation = Math.floor(randomBetween(58, 84));
    const lightness = Math.floor(randomBetween(36, 56));
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  function fallbackWireColor(index) {
    const hue = (47 * (Number(index) + 1) + 23) % 360;
    return `hsl(${hue} 68% 44%)`;
  }

  function wireLengthBetween(from, to) {
    const dx = Number(to && to.x) - Number(from && from.x);
    const dy = Number(to && to.y) - Number(from && from.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function wireBendMagnitudeRange(length) {
    const normalized = Math.max(0, Number(length) || 0);
    const max = Math.min(DEFAULT_WIRE_BEND_LIMIT, Math.max(18, normalized * 0.34));
    const min = Math.min(max, Math.max(5, max * 0.38));
    return { min, max };
  }

  function normalizePanelBounds(bounds) {
    const source = bounds && typeof bounds === 'object' ? bounds : DEFAULT_PANEL_BOUNDS;
    const x = Number.isFinite(Number(source.x)) ? Number(source.x) : DEFAULT_PANEL_BOUNDS.x;
    const y = Number.isFinite(Number(source.y)) ? Number(source.y) : DEFAULT_PANEL_BOUNDS.y;
    const width = Number.isFinite(Number(source.width)) && Number(source.width) > 0 ? Number(source.width) : DEFAULT_PANEL_BOUNDS.width;
    const height = Number.isFinite(Number(source.height)) && Number(source.height) > 0 ? Number(source.height) : DEFAULT_PANEL_BOUNDS.height;
    return { x, y, width, height };
  }

  function pointIsInsidePanelBounds(point, bounds = DEFAULT_PANEL_BOUNDS) {
    if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return false;
    const box = normalizePanelBounds(bounds);
    return Number(point.x) >= box.x
      && Number(point.x) <= box.x + box.width
      && Number(point.y) >= box.y
      && Number(point.y) <= box.y + box.height;
  }

  function wireMidpointForBend(from, to, bend = 0) {
    const dx = Number(to && to.x) - Number(from && from.x);
    const dy = Number(to && to.y) - Number(from && from.y);
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const nx = -dy / length;
    const ny = dx / length;
    return {
      x: (Number(from && from.x) + Number(to && to.x)) / 2 + nx * Number(bend || 0) * 0.75,
      y: (Number(from && from.y) + Number(to && to.y)) / 2 + ny * Number(bend || 0) * 0.75,
    };
  }

  function shrinkBendIntoPanelBounds(from, to, preferredSign, magnitude, bounds = DEFAULT_PANEL_BOUNDS) {
    const sign = preferredSign < 0 ? -1 : 1;
    const limit = Math.max(0, Math.abs(Number(magnitude) || 0));
    if (!limit) return 0;
    for (let step = 1; step <= 24; step += 1) {
      const candidate = sign * limit * (1 - step / 24);
      if (pointIsInsidePanelBounds(wireMidpointForBend(from, to, candidate), bounds)) return round2(candidate);
    }
    return 0;
  }

  function bendAdjustedToPanelBounds(from, to, bend = 0, bounds = DEFAULT_PANEL_BOUNDS) {
    const numericBend = clampNumber(bend, -DEFAULT_WIRE_BEND_LIMIT, DEFAULT_WIRE_BEND_LIMIT, 0);
    if (!numericBend) return 0;
    if (pointIsInsidePanelBounds(wireMidpointForBend(from, to, numericBend), bounds)) return round2(numericBend);
    const flipped = -numericBend;
    if (pointIsInsidePanelBounds(wireMidpointForBend(from, to, flipped), bounds)) return round2(flipped);
    return shrinkBendIntoPanelBounds(from, to, Math.sign(flipped), Math.abs(numericBend), bounds);
  }

  function stableHash(text) {
    let hash = 2166136261;
    const input = String(text || '');
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function stableUnit(text) {
    return stableHash(text) / 0xffffffff;
  }

  function randomWireBendForEndpoints(from, to, bounds = DEFAULT_PANEL_BOUNDS) {
    const range = wireBendMagnitudeRange(wireLengthBetween(from, to));
    const magnitude = randomBetween(range.min, range.max);
    return bendAdjustedToPanelBounds(from, to, (Math.random() < 0.5 ? -1 : 1) * magnitude, bounds);
  }

  function stableWireBendForEndpoints(from, to, index = 0, bounds = DEFAULT_PANEL_BOUNDS) {
    const length = wireLengthBetween(from, to);
    const range = wireBendMagnitudeRange(length);
    const seed = [
      from && (from.connectorId || from.id || `${round2(from.x)},${round2(from.y)}`),
      to && (to.connectorId || to.id || `${round2(to.x)},${round2(to.y)}`),
      index,
    ].join('|');
    const side = stableUnit(`${seed}|side`) < 0.5 ? -1 : 1;
    const magnitude = range.min + stableUnit(`${seed}|magnitude`) * (range.max - range.min);
    return bendAdjustedToPanelBounds(from, to, side * magnitude, bounds);
  }

  function integratedPathBetween(from, to, bend = 0) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const nx = -dy / length;
    const ny = dx / length;
    const c1 = { x: from.x + dx * 0.34 + nx * bend, y: from.y + dy * 0.34 + ny * bend };
    const c2 = { x: from.x + dx * 0.66 + nx * bend, y: from.y + dy * 0.66 + ny * bend };
    return `M ${round2(from.x)} ${round2(from.y)} C ${round2(c1.x)} ${round2(c1.y)}, ${round2(c2.x)} ${round2(c2.y)}, ${round2(to.x)} ${round2(to.y)}`;
  }

  function connectorMapForModel(model) {
    const connectors = listIntegratedPanelConnectors();
    const bridge = createIntegratedConnectorBridge(model);
    const map = new Map();
    for (const connector of connectors) {
      const bridgeEntry = bridge && bridge.byConnectorId ? bridge.byConnectorId[connector.id] : null;
      const physical = bridgeEntry && bridgeEntry.physicalSocket ? bridgeEntry.physicalSocket : null;
      const x = physical && Number.isFinite(Number(physical.x)) ? Number(physical.x) : Number(connector.x);
      const y = physical && Number.isFinite(Number(physical.y)) ? Number(physical.y) : Number(connector.y);
      const runtimeAccessory = Boolean(physical && ['capacitor', 'diode', 'z-diode'].includes(physical.accessoryType));
      map.set(connector.id, Object.assign({}, connector, {
        sourceX: Number(connector.x),
        sourceY: Number(connector.y),
        x,
        y,
        position: { x, y },
        connectorId: connector.id,
        physicalSocketId: bridgeEntry ? bridgeEntry.physicalSocketId : null,
        logicalSocketId: physical ? physical.logicalSocketId || null : null,
        direction: physical ? physical.direction || (runtimeAccessory ? 'accessory' : null) : null,
        active: Boolean((bridgeEntry && bridgeEntry.active) || runtimeAccessory),
        displayOnly: Boolean((bridgeEntry && bridgeEntry.displayOnly) && !runtimeAccessory),
        unsupported: Boolean((bridgeEntry && bridgeEntry.unsupported) && !runtimeAccessory),
        accessoryId: physical ? physical.accessoryId || null : null,
        accessoryType: physical ? physical.accessoryType || null : null,
        accessoryTerminal: physical ? physical.terminal || null : null,
        polarity: physical ? physical.polarity || null : null,
        value: physical ? physical.value || null : null,
        runtimeAccessory,
        mapped: Boolean(bridgeEntry && bridgeEntry.mapped),
        coordinateSource: physical ? 'physical-socket-map' : 'adopted-connector',
      }));
    }
    return { connectors, bridge, map };
  }


  function physicalIdFromPatchEndpoint(endpoint) {
    if (!endpoint) return null;
    if (typeof endpoint === 'string' && /^phys\./.test(endpoint)) return endpoint;
    if (typeof endpoint === 'object') return endpoint.physicalSocketId || endpoint.physical || null;
    return null;
  }

  function logicalIdFromPatchEndpoint(endpoint) {
    if (!endpoint) return null;
    if (typeof endpoint === 'string' && !/^phys\./.test(endpoint)) return endpoint;
    if (typeof endpoint === 'object') return endpoint.logicalSocketId || endpoint.logical || endpoint.socketId || endpoint.socket || null;
    return null;
  }

  function endpointFromCableSide(cable, side, model) {
    const connectorId = side === 'from' ? cable.fromConnectorId : cable.toConnectorId;
    const connector = connectorId ? connectorById(model, connectorId) : null;
    const physicalSocketId = physicalIdFromPatchEndpoint(cable[side]) || (connector && connector.physicalSocketId) || null;
    const logicalSocketId = logicalIdFromPatchEndpoint(cable[side]) || (connector && connector.logicalSocketId) || null;
    return { logicalSocketId, physicalSocketId };
  }

  function designLikeForAccessoryGuidance(model, patch) {
    const normalized = normalizePatch(patch || { components: [], cables: [] });
    return {
      schemaVersion: 'analog-thing-design/v1',
      kind: 'custom-design',
      inventory: normalized.inventory || 'that-prototype-board/v006',
      metadata: { name: normalized.name || 'Panel accessory guidance' },
      components: clonePlain(normalized.components || []),
      cables: (normalized.cables || []).map((cable, index) => ({
        id: cable.id || `cable-${index + 1}`,
        from: endpointFromCableSide(cable, 'from', model),
        to: endpointFromCableSide(cable, 'to', model),
        label: cable.label || '',
      })),
      outputRouting: { channels: { X: 'OUT_X.out', Y: 'OUT_Y.out', Z: null, U: null }, aliases: {} },
      operationDefaults: {},
    };
  }

  function accessoryPairGuidanceFromPatch(model, patch) {
    const core = getDesignAccessoriesCore();
    if (!core || typeof core.accessoryPairGuidance !== 'function') {
      return { schemaVersion: 'analog-thing-design-accessories/v1', kind: 'physical-accessory-pair-guidance-summary', accessoryCount: 0, completeCount: 0, partialCount: 0, ambiguousCount: 0, openCount: 0, readyToMaterializeCount: 0, byStatus: {}, rows: [] };
    }
    return core.accessoryPairGuidance(designLikeForAccessoryGuidance(model, patch), { socketMap: { sockets: (model && model.physicalSockets) || [] } });
  }

  function accessoryGuidanceForConnector(model, patch, connector) {
    if (!connector || !connector.physicalSocketId) return null;
    const summary = accessoryPairGuidanceFromPatch(model, patch);
    return (summary.rows || []).find((row) => (row.terminalSocketIds || []).includes(connector.physicalSocketId)) || null;
  }

  function accessoryGuidanceTitleForConnector(model, patch, connector) {
    const guidance = accessoryGuidanceForConnector(model, patch, connector);
    if (!guidance) return '';
    return guidance.title || guidance.hint || `${guidance.accessoryId} ${guidance.status}`;
  }

  function renderAccessoryGuidanceStatus(guidance) {
    const rows = (guidance && guidance.rows) || [];
    const visible = rows.filter((row) => row.status === 'partial' || row.status === 'ambiguous' || row.status === 'complete');
    if (!visible.length) return '';
    const partialRows = visible.filter((row) => row.status === 'partial').slice(0, 4).map((row) => `<li data-accessory-guidance-hint="${escapeText(row.accessoryId)}"><strong>${escapeText(row.accessoryId)}</strong>: ${escapeText(row.hint)}</li>`).join('');
    const ambiguousRows = visible.filter((row) => row.status === 'ambiguous').slice(0, 3).map((row) => `<li data-accessory-guidance-hint="${escapeText(row.accessoryId)}"><strong>${escapeText(row.accessoryId)}</strong>: ${escapeText(row.hint)}</li>`).join('');
    const completeCount = visible.filter((row) => row.status === 'complete').length;
    return `<details class="panel-accessory-guidance-status" data-accessory-guidance-status="true" open><summary>Accessory pair guidance: ${guidance.partialCount || 0} half-wired, ${guidance.completeCount || 0} complete</summary>${partialRows ? `<ul>${partialRows}</ul>` : ''}${ambiguousRows ? `<ul>${ambiguousRows}</ul>` : ''}${completeCount ? `<p>${completeCount} complete physical accessory pair${completeCount === 1 ? '' : 's'} can be converted to logical runtime components.</p>` : ''}</details>`;
  }

  function renderAccessoryPairGuidanceLayer(layers) {
    if (!layers || !layers.accessoryGuidanceLayer) return;
    // The reference SVG already carries the capacitor, diode, and Z-diode artwork
    // and printed labels. Keep the guidance model/status available for validation
    // and tooltips, but do not draw an additional visible layer over these parts.
    layers.accessoryGuidanceLayer.replaceChildren();
  }

  function endpointFromIntegratedConnector(connector) {
    return {
      connectorId: connector.id || connector.connectorId,
      section: connector.section || '',
      x: Number(connector.x),
      y: Number(connector.y),
    };
  }

  function connectorForLogicalSocket(model, logicalSocketId, direction, preferredConnectorId) {
    const catalog = connectorMapForModel(model);
    if (preferredConnectorId && catalog.map.has(preferredConnectorId)) {
      const preferred = catalog.map.get(preferredConnectorId);
      if (preferred.logicalSocketId === logicalSocketId && (!direction || preferred.direction === direction)) return preferred;
    }
    const virtualConnector = connectorForVirtualLogicalSocket(model, logicalSocketId, direction);
    if (virtualConnector) return virtualConnector;
    const alias = logicalAliasForIntegratedPanel(logicalSocketId, direction);
    const effectiveLogicalSocketId = alias || logicalSocketId;
    const physicalSockets = sortEntriesForLogicalPreference(effectiveLogicalSocketId, ((model && model.physicalSockets) || [])
      .filter((socket) => socket.logicalSocketId === effectiveLogicalSocketId && (!direction || socket.direction === direction)));
    for (const socket of physicalSockets) {
      const entry = catalog.bridge && catalog.bridge.byPhysicalSocketId ? catalog.bridge.byPhysicalSocketId[socket.id] : null;
      if (entry && entry.connectorId && catalog.map.has(entry.connectorId)) return catalog.map.get(entry.connectorId);
    }
    for (const connector of catalog.map.values()) {
      if (connector.logicalSocketId === effectiveLogicalSocketId && (!direction || connector.direction === direction)) return connector;
    }
    return null;
  }

  function endpointForLogicalFallback(model, logicalSocketId, direction) {
    const connector = connectorForVirtualLogicalSocket(model, logicalSocketId, direction)
      || (logicalAliasForIntegratedPanel(logicalSocketId, direction) ? connectorForLogicalSocket(model, logicalAliasForIntegratedPanel(logicalSocketId, direction), direction, null) : null);
    if (connector) return endpointFromIntegratedConnector(connector);
    try {
      const socket = resolveSocket(model, logicalAliasForIntegratedPanel(logicalSocketId, direction) || logicalSocketId, { includePhysical: true });
      return { connectorId: null, section: socket.group || '', x: socket.position.x, y: socket.position.y };
    } catch (error) {
      const parsed = parseSocketId(logicalSocketId);
      const component = componentById(model, parsed.componentId);
      const pos = socketPosition(component || { x: 0, y: 0, w: 0, h: 0, inputs: [], outputs: [] }, parsed.socketName, direction);
      return { connectorId: null, section: '', x: pos.x, y: pos.y };
    }
  }

  function connectorById(model, connectorId) {
    if (!connectorId) return null;
    const catalog = connectorMapForModel(model);
    return catalog.map.get(connectorId) || null;
  }

  function logicalAliasForIntegratedPanel(logicalSocketId, direction) {
    const id = String(logicalSocketId || '').trim();
    if (!id) return null;
    if (id === 'GNEG.out') return 'MINUS1.out';
    const sumMatch = /^SUM(\d+)\.(right|left|drag|gravityNeg|floor|ceiling)$/.exec(id);
    if (sumMatch && direction === 'input') {
      const aliases = {
        right: 'in1',
        left: 'in2',
        drag: 'in3',
        gravityNeg: 'in1',
        floor: 'in3',
        ceiling: 'in4',
      };
      return `SUM${sumMatch[1]}.${aliases[sumMatch[2]] || 'in1'}`;
    }
    return null;
  }

  function physicalAccessorySocketIdForLogical(logicalSocketId) {
    const match = /^(CAP|D|DIODE|ZD|ZDIODE)(\d+)\.(out|in|ic|reference)$/.exec(String(logicalSocketId || '').trim());
    if (!match) return null;
    const [, rawKind, rawIndex, socketName] = match;
    const index = Number.parseInt(rawIndex, 10);
    if (!Number.isFinite(index) || index < 1) return null;
    const kind = rawKind === 'CAP' ? 'cap' : (rawKind === 'D' || rawKind === 'DIODE' ? 'diode' : 'zdiode');
    const terminal = socketName === 'out' ? 'a' : 'b';
    return `phys.${kind}${index}.${terminal}`;
  }

  function connectorForPhysicalSocket(model, physicalSocketId) {
    if (!physicalSocketId) return null;
    const catalog = connectorMapForModel(model);
    const entry = catalog.bridge && catalog.bridge.byPhysicalSocketId ? catalog.bridge.byPhysicalSocketId[physicalSocketId] : null;
    if (entry && entry.connectorId && catalog.map.has(entry.connectorId)) return catalog.map.get(entry.connectorId);
    for (const connector of catalog.map.values()) {
      if (connector.physicalSocketId === physicalSocketId) return connector;
    }
    return null;
  }

  function connectorForVirtualLogicalSocket(model, logicalSocketId, direction) {
    const physicalId = physicalAccessorySocketIdForLogical(logicalSocketId);
    if (physicalId) return connectorForPhysicalSocket(model, physicalId);
    const alias = logicalAliasForIntegratedPanel(logicalSocketId, direction);
    if (!alias || alias === logicalSocketId) return null;
    return connectorForLogicalSocket(model, alias, direction, null);
  }

  function integratedWireFromPatchCable(model, cable, index = 0) {
    const fromConnector = cable.panelOnly && cable.fromConnectorId
      ? connectorById(model, cable.fromConnectorId)
      : connectorForLogicalSocket(model, cable.from, 'output', cable.fromConnectorId);
    const toConnector = cable.panelOnly && cable.toConnectorId
      ? connectorById(model, cable.toConnectorId)
      : connectorForLogicalSocket(model, cable.to, 'input', cable.toConnectorId);
    const from = fromConnector ? endpointFromIntegratedConnector(fromConnector) : endpointForLogicalFallback(model, cable.from, 'output');
    const to = toConnector ? endpointFromIntegratedConnector(toConnector) : endpointForLogicalFallback(model, cable.to, 'input');
    return {
      id: cable.id || `wire_${String(index + 1).padStart(3, '0')}`,
      cableIndex: index,
      from,
      to,
      color: cable.color || fallbackWireColor(index),
      opacity: clampNumber(cable.opacity, 0.05, 1, 0.62),
      strokeWidth: clampNumber(cable.strokeWidth, 1, 20, 5.25),
      bend: Object.prototype.hasOwnProperty.call(cable, 'bend')
        ? bendAdjustedToPanelBounds(from, to, cable.bend)
        : stableWireBendForEndpoints(from, to, index),
      label: cable.label || `${cable.from} -> ${cable.to}`,
      logicalFrom: cable.panelOnly ? `${cable.fromConnectorId || cable.from} (panel-only)` : cable.from,
      logicalTo: cable.panelOnly ? `${cable.toConnectorId || cable.to} (panel-only)` : cable.to,
      panelOnly: Boolean(cable.panelOnly),
    };
  }

  function integratedWiresFromPatch(model, patch) {
    const normalized = normalizePatch(patch);
    return normalized.cables.map((cable, index) => integratedWireFromPatchCable(model, cable, index));
  }

  function exportIntegratedWiringObject(model, patch) {
    const catalog = connectorMapForModel(model);
    const normalized = normalizePatch(patch);
    const wires = integratedWiresFromPatch(model, normalized).map((wire) => ({
      id: wire.id,
      from: { connectorId: wire.from.connectorId, section: wire.from.section, x: round2(wire.from.x), y: round2(wire.from.y) },
      to: { connectorId: wire.to.connectorId, section: wire.to.section, x: round2(wire.to.x), y: round2(wire.to.y) },
      color: wire.color,
      opacity: wire.opacity,
      strokeWidth: wire.strokeWidth,
      bend: round2(wire.bend),
      label: wire.label,
    }));
    return {
      schema: 'analog-thing-patch-panel-wiring',
      schemaVersion: 1,
      editorVersion: 'integrated-v037',
      panel: { source: (model && model.referenceSvg) || 'THAT_panel.svg', viewBox: { x: 0, y: 0, width: (model && model.width) || DEFAULT_PANEL_BOUNDS.width, height: (model && model.height) || DEFAULT_PANEL_BOUNDS.height }, connectorCount: catalog.connectors.length },
      wires,
    };
  }

  function makeStyledCable(cable, style = {}) {
    const next = Object.assign({}, cable);
    if (style.id) next.id = style.id;
    if (style.color) next.color = style.color;
    if (Number.isFinite(Number(style.opacity))) next.opacity = clampNumber(style.opacity, 0.05, 1, 0.62);
    if (Number.isFinite(Number(style.strokeWidth))) next.strokeWidth = clampNumber(style.strokeWidth, 1, 20, 5.25);
    if (Number.isFinite(Number(style.bend))) next.bend = clampNumber(style.bend, -DEFAULT_WIRE_BEND_LIMIT, DEFAULT_WIRE_BEND_LIMIT, 0);
    if (style.createdAt) next.createdAt = style.createdAt;
    if (style.fromConnectorId) next.fromConnectorId = style.fromConnectorId;
    if (style.toConnectorId) next.toConnectorId = style.toConnectorId;
    return next;
  }

  function stylePatchCableAtIndex(patch, index, style) {
    const next = normalizePatch(patch);
    if (index >= 0 && index < next.cables.length) next.cables[index] = makeStyledCable(next.cables[index], style);
    return next;
  }

  function nextWireIdFromPatch(patch) {
    const normalized = normalizePatch(patch);
    let max = 0;
    for (const cable of normalized.cables) {
      const match = String(cable.id || '').match(/(\d+)$/);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `wire_${String(max + 1 || normalized.cables.length + 1).padStart(3, '0')}`;
  }

  function socketIdForConnector(connector) {
    return connector && connector.physicalSocketId ? connector.physicalSocketId : connector && connector.logicalSocketId ? connector.logicalSocketId : connector && connector.id;
  }

  function connectorIsExecutable(connector) {
    return Boolean(connector && connector.active && !connector.displayOnly && !connector.unsupported && connector.logicalSocketId && (connector.direction === 'input' || connector.direction === 'output'));
  }

  function connectorIsRuntimeAccessoryTerminal(connector) {
    return Boolean(connector && connector.active && !connector.displayOnly && !connector.unsupported && connector.physicalSocketId && ['capacitor', 'diode', 'z-diode'].includes(connector.accessoryType));
  }

  function executablePairCanBecomeRuntimeCable(firstConnector, secondConnector) {
    return connectorIsExecutable(firstConnector) && connectorIsExecutable(secondConnector) && firstConnector.direction !== secondConnector.direction;
  }

  function materializableAccessoryPair(firstConnector, secondConnector) {
    const firstAccessory = connectorIsRuntimeAccessoryTerminal(firstConnector);
    const secondAccessory = connectorIsRuntimeAccessoryTerminal(secondConnector);
    if (firstAccessory === secondAccessory) return null;
    const accessory = firstAccessory ? firstConnector : secondConnector;
    const executable = firstAccessory ? secondConnector : firstConnector;
    if (!connectorIsExecutable(executable)) return null;
    return { accessory, executable };
  }

  function panelEndpointId(connector) {
    return connector && (connector.physicalSocketId || connector.id || connector.logicalSocketId) ? String(connector.physicalSocketId || connector.id || connector.logicalSocketId) : 'unknown-panel-socket';
  }

  function addPanelOnlyWireToPatch(patch, fromConnector, toConnector, style = {}, options = {}) {
    if (!fromConnector || !toConnector || fromConnector.id === toConnector.id) throw new Error('panel-only wire needs two different panel sockets');
    const next = normalizePatch(patch);
    const accessoryPair = materializableAccessoryPair(fromConnector, toConnector);
    let fromId = panelEndpointId(fromConnector);
    let toId = panelEndpointId(toConnector);
    let fromConnectorId = fromConnector.id;
    let toConnectorId = toConnector.id;
    let runtimeSupport = 'ignored-by-block-level-runtime';
    let notes = 'Physical accessory/display-only terminal connection retained for editor fidelity; it is not compiled into the simulator core yet.';
    let label = options.label || `panel-only unsupported accessory wire: ${fromConnector.id} -> ${toConnector.id}`;
    let message = `Added panel-only unsupported wire ${fromConnector.id} -> ${toConnector.id}`;
    if (accessoryPair) {
      const { accessory, executable } = accessoryPair;
      if (executable.direction === 'output') {
        fromId = executable.logicalSocketId;
        toId = accessory.physicalSocketId;
        fromConnectorId = executable.id;
        toConnectorId = accessory.id;
      } else {
        fromId = accessory.physicalSocketId;
        toId = executable.logicalSocketId;
        fromConnectorId = accessory.id;
        toConnectorId = executable.id;
      }
      runtimeSupport = 'materializable-physical-accessory';
      notes = 'Physical capacitor/diode/Z-diode terminal wire retained for editor fidelity and auto-materialized into an explicit logical runtime component when the complementary terminal is wired.';
      label = options.label || `materializable accessory wire: ${fromConnector.id} -> ${toConnector.id}`;
      message = `Added materializable physical accessory wire ${fromConnector.id} -> ${toConnector.id}`;
    }
    if (next.cables.some((cable) => cable.panelOnly && cable.fromConnectorId === fromConnectorId && cable.toConnectorId === toConnectorId)) {
      return { patch: next, cable: { from: fromId, to: toId, panelOnly: true, runtimeSupport }, changed: false, message: `Panel wire already exists: ${fromConnectorId} -> ${toConnectorId}` };
    }
    const cable = makeStyledCable({
      from: fromId,
      to: toId,
      label,
      panelOnly: true,
      runtimeSupport,
      notes,
    }, Object.assign({}, style, { fromConnectorId, toConnectorId }));
    next.cables = next.cables.concat([cable]);
    return { patch: next, cable, changed: true, message };
  }

  function addIntegratedConnectorWireToPatch(patch, model, fromConnector, toConnector, options = {}) {
    const style = Object.assign({
      id: nextWireIdFromPatch(patch),
      color: randomWireColor(),
      opacity: 0.62,
      strokeWidth: 5.25,
      bend: randomWireBendForEndpoints(fromConnector, toConnector),
      createdAt: new Date().toISOString(),
    }, options.style || {});
    if (!executablePairCanBecomeRuntimeCable(fromConnector, toConnector)) {
      const result = addPanelOnlyWireToPatch(patch, fromConnector, toConnector, style, options);
      return Object.assign({}, result, { style, panelOnly: true });
    }
    const result = addCableToPatch(patch, model, socketIdForConnector(fromConnector), socketIdForConnector(toConnector), { replaceExistingInput: true, label: `panel wire: ${fromConnector.id} -> ${toConnector.id}` });
    let next = result.patch;
    if (result.changed) {
      const index = next.cables.findIndex((cable) => cable.from === result.cable.from && cable.to === result.cable.to);
      const outputConnectorId = fromConnector.direction === 'output' ? fromConnector.id : toConnector.id;
      const inputConnectorId = fromConnector.direction === 'input' ? fromConnector.id : toConnector.id;
      next = stylePatchCableAtIndex(next, index, Object.assign({}, style, { fromConnectorId: outputConnectorId, toConnectorId: inputConnectorId }));
    }
    return Object.assign({}, result, { patch: next, style });
  }

  function connectorForCableEndpoint(model, cable, side) {
    const connectorId = side === 'from' ? cable.fromConnectorId : cable.toConnectorId;
    if (connectorId) {
      const byId = connectorById(model, connectorId);
      if (byId) return byId;
    }
    const logicalSocketId = side === 'from' ? cable.from : cable.to;
    const direction = side === 'from' ? 'output' : 'input';
    const physicalId = physicalIdFromPatchEndpoint(logicalSocketId);
    if (physicalId) {
      const byPhysical = connectorForPhysicalSocket(model, physicalId);
      if (byPhysical) return byPhysical;
    }
    return connectorForLogicalSocket(model, logicalSocketId, direction, null);
  }

  function connectorCanReplaceCableSide(connector, side) {
    if (connectorIsRuntimeAccessoryTerminal(connector)) return true;
    if (!connectorIsExecutable(connector)) return false;
    return side === 'from' ? connector.direction === 'output' : connector.direction === 'input';
  }

  function replaceIntegratedCableEndpoint(patch, model, cableIndex, side, connector, options = {}) {
    const normalized = normalizePatch(patch);
    if (!Number.isInteger(cableIndex) || cableIndex < 0 || cableIndex >= normalized.cables.length) throw new Error(`invalid cable index ${cableIndex}`);
    if (side !== 'from' && side !== 'to') throw new Error(`invalid cable endpoint side ${side}`);
    const oldCable = normalized.cables[cableIndex];
    if (!connectorCanReplaceCableSide(connector, side)) throw new Error(`cannot reconnect this side to ${connector && connector.id ? connector.id : 'that socket'}; choose a compatible socket`);
    const otherConnector = connectorForCableEndpoint(model, oldCable, side === 'from' ? 'to' : 'from');
    const firstConnector = side === 'from' ? connector : otherConnector;
    const secondConnector = side === 'from' ? otherConnector : connector;
    if (!firstConnector || !secondConnector) throw new Error(`cannot reconnect this side; the other cable endpoint is not mapped to a visible panel connector`);

    if (oldCable.panelOnly || !executablePairCanBecomeRuntimeCable(firstConnector, secondConnector)) {
      const result = addPanelOnlyWireToPatch({ ...normalized, cables: normalized.cables.filter((_, index) => index !== cableIndex) }, firstConnector, secondConnector, Object.assign({}, oldCable, options.style || {}, { id: oldCable.id }), { label: oldCable.label || `panel-only unsupported accessory wire: ${firstConnector.id} -> ${secondConnector.id}` });
      return { patch: result.patch, cable: result.cable, message: `Reconnected ${side} side of ${oldCable.id || `cable ${cableIndex + 1}`} to ${connector.id}; wire is panel-only; complete physical accessory pairs are auto-materialized by the runtime.` };
    }

    const endpoints = normalizeCableEndpoints(model, socketIdForConnector(firstConnector), socketIdForConnector(secondConnector));
    const outputConnectorId = firstConnector.direction === 'output' ? firstConnector.id : secondConnector.id;
    const inputConnectorId = firstConnector.direction === 'input' ? firstConnector.id : secondConnector.id;
    const nextCable = makeStyledCable({
      from: endpoints.from,
      to: endpoints.to,
      label: oldCable.label || `panel wire: ${endpoints.from} -> ${endpoints.to}`,
    }, Object.assign({}, oldCable, options.style || {}, { panelOnly: false, fromConnectorId: outputConnectorId, toConnectorId: inputConnectorId }));
    delete nextCable.panelOnly;
    delete nextCable.runtimeSupport;
    delete nextCable.notes;
    const next = ensurePatchHasEndpointComponents(normalized, model, endpoints);
    next.cables = next.cables.map((cable, index) => (index === cableIndex ? nextCable : cable));
    const duplicateInput = next.cables.filter((cable, index) => index !== cableIndex && !cable.panelOnly && cable.to === nextCable.to);
    if (duplicateInput.length) {
      next.cables = next.cables.filter((cable, index) => index === cableIndex || cable.panelOnly || cable.to !== nextCable.to);
    }
    return { patch: next, cable: nextCable, message: `Reconnected ${side} side of ${oldCable.id || `cable ${cableIndex + 1}`} to ${connector.id}.` };
  }

  function pointFromIntegratedEvent(svg, event) {
    if (!svg || typeof svg.createSVGPoint !== 'function') return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM && svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const result = point.matrixTransform(matrix.inverse());
    const width = Number(svg.getAttribute('viewBox') && svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal.width : 800) || 800;
    const height = Number(svg.getAttribute('viewBox') && svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal.height : 638) || 638;
    return { x: Math.min(width, Math.max(0, round2(result.x))), y: Math.min(height, Math.max(0, round2(result.y))) };
  }

  function nearestIntegratedConnector(model, point, radius = 18) {
    const catalog = connectorMapForModel(model);
    let best = null;
    let bestDistance = Infinity;
    const maxDistance = radius * radius;
    for (const connector of catalog.map.values()) {
      const dx = Number(point.x) - Number(connector.x);
      const dy = Number(point.y) - Number(connector.y);
      const distance = dx * dx + dy * dy;
      if (distance <= maxDistance && distance < bestDistance) {
        best = connector;
        bestDistance = distance;
      }
    }
    return best;
  }

  function ensureIntegratedSvgLayers(svg) {
    const doc = svg.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const ns = 'http://www.w3.org/2000/svg';
    function svgElement(tagName, attributes) {
      const node = doc.createElementNS(ns, tagName);
      for (const [key, value] of Object.entries(attributes || {})) node.setAttribute(key, String(value));
      return node;
    }
    for (const hidden of Array.from(svg.querySelectorAll('.panel-cable-layer,.panel-socket-overlay-layer'))) hidden.setAttribute('data-integrated-hidden-layer', 'true');
    let wireLayer = svg.querySelector('[data-integrated-wire-layer="true"]');
    if (!wireLayer) { wireLayer = svgElement('g', { class: 'wire-layer integrated-wire-layer', 'data-integrated-wire-layer': 'true' }); svg.appendChild(wireLayer); }
    let tempWire = svg.querySelector('[data-integrated-temp-wire="true"]');
    if (!tempWire) { tempWire = svgElement('path', { class: 'temp-wire integrated-temp-wire', 'data-integrated-temp-wire': 'true', hidden: 'true' }); svg.appendChild(tempWire); }
    let accessoryGuidanceLayer = svg.querySelector('[data-accessory-guidance-layer="true"]');
    if (!accessoryGuidanceLayer) { accessoryGuidanceLayer = svgElement('g', { class: 'accessory-guidance-layer', 'data-accessory-guidance-layer': 'true' }); svg.appendChild(accessoryGuidanceLayer); }
    let connectorLayer = svg.querySelector('[data-integrated-connector-layer="true"]');
    if (!connectorLayer) { connectorLayer = svgElement('g', { class: 'connector-layer integrated-connector-layer', 'data-integrated-connector-layer': 'true' }); svg.appendChild(connectorLayer); }
    let handleLayer = svg.querySelector('[data-integrated-handle-layer="true"]');
    if (!handleLayer) { handleLayer = svgElement('g', { class: 'handle-layer integrated-handle-layer', 'data-integrated-handle-layer': 'true' }); svg.appendChild(handleLayer); }
    svg.classList.add('integrated-patch-wire-editor');
    svg.setAttribute('data-integrated-wire-editor', 'true');
    return { wireLayer, tempWire, accessoryGuidanceLayer, connectorLayer, handleLayer, svgElement };
  }

  function installIntegratedPatchPanelWireEditor(options = {}) {
    const svg = options.svg;
    const getPatch = options.getPatch;
    const getModel = options.getModel;
    const replacePatch = options.replacePatch;
    const statusContainer = options.statusContainer || null;
    const modeSelect = options.modeSelect || null;
    const undoButton = options.undoButton || null;
    const redoButton = options.redoButton || null;
    const deleteButton = options.deleteButton || null;
    const markCleanButton = options.markCleanButton || null;
    const zoomPresetSelect = options.zoomPresetSelect || null;
    const fitWidthButton = options.fitWidthButton || null;
    const oneToOneButton = options.oneToOneButton || null;
    const fitPanelButton = options.fitPanelButton || null;
    const zoomInButton = options.zoomInButton || null;
    const zoomOutButton = options.zoomOutButton || null;
    const panLeftButton = options.panLeftButton || null;
    const panRightButton = options.panRightButton || null;
    const panUpButton = options.panUpButton || null;
    const panDownButton = options.panDownButton || null;
    const layers = ensureIntegratedSvgLayers(svg);
    let state = createCableEditState(getPatch(), getModel(), { mode: modeSelect && modeSelect.value ? modeSelect.value : EDITOR_MODES.CABLE });
    state.selectedWireId = null;
    state.drag = null;
    state.hoverConnectorId = null;
    state.accessoryPairGuidance = accessoryPairGuidanceFromPatch(getModel(), getPatch());
    let viewport = null;
    try { viewport = createPanelViewportState(getModel(), { preset: 'fit-panel', containerWidth: svg.parentNode && svg.parentNode.clientWidth ? svg.parentNode.clientWidth : 1200, containerHeight: 720 }); applyPanelViewport(svg, viewport); } catch (error) { viewport = { mode: '100', scale: 1, offsetX: 0, offsetY: 0 }; }
    if (svg.setAttribute) svg.setAttribute('tabindex', '0');

    function getWires() { return integratedWiresFromPatch(getModel(), getPatch()); }
    function findSelectedWire() { return getWires().find((wire) => wire.id === state.selectedWireId) || null; }
    function setStatus(message, isError = false) {
      state.lastMessage = message;
      state.lastError = isError ? message : '';
      renderCableInteractionStatus(statusContainer, state);
      updateButtons();
    }
    function refreshFromHost() {
      const cleanSignature = state.cleanPatchSignature;
      const history = state.history;
      const mode = state.mode;
      const selectedWireId = state.selectedWireId;
      state = Object.assign(createCableEditState(getPatch(), getModel(), { mode }), {
        history,
        cleanPatchSignature: cleanSignature,
        dirty: patchSignature(getPatch()) !== cleanSignature,
        lastMessage: state.lastMessage,
        lastError: state.lastError,
        selectedCableIndex: state.selectedCableIndex,
        selectedWireId,
        drag: state.drag,
        hoverConnectorId: state.hoverConnectorId,
        inspectedSocket: state.inspectedSocket ? clonePlain(state.inspectedSocket) : null,
        inspectedCable: state.inspectedCable ? clonePlain(state.inspectedCable) : null,
        accessoryPairGuidance: accessoryPairGuidanceFromPatch(getModel(), getPatch()),
      });
      return state;
    }
    function updateButtons() {
      if (modeSelect && modeSelect.value !== state.mode) modeSelect.value = state.mode;
      if (undoButton) undoButton.disabled = !state.history || !state.history.past || !state.history.past.length;
      if (redoButton) redoButton.disabled = !state.history || !state.history.future || !state.history.future.length;
      if (deleteButton) deleteButton.disabled = !findSelectedWire();
      if (markCleanButton) markCleanButton.disabled = !state.dirty;
      if (zoomPresetSelect && viewport && ['fit-width', '100', 'fit-panel'].includes(viewport.mode) && zoomPresetSelect.value !== viewport.mode) zoomPresetSelect.value = viewport.mode;
    }
    function applyEditedPatch(nextPatch, message, editType = 'integrated-wire-edit') {
      const nextState = recordPatchHistory(state, nextPatch, { message, editType });
      state.history = nextState.history;
      state.patch = nextState.patch;
      state.cleanPatchSignature = nextState.cleanPatchSignature;
      state.dirty = nextState.dirty;
      state.lastMessage = message;
      state.lastError = '';
      replacePatch(state.patch, { skipEditorSync: false, skipTemplateRender: true });
    }
    function renderConnectors() {
      layers.connectorLayer.replaceChildren();
      const fragment = (svg.ownerDocument || document).createDocumentFragment();
      const catalog = connectorMapForModel(getModel());
      for (const connector of catalog.map.values()) {
        const status = connector.unsupported ? 'unsupported' : connector.active ? 'editable' : connector.mapped ? 'display-only' : 'unmapped';
        const circle = layers.svgElement('circle', {
          class: `connector-hit ${status}`,
          cx: connector.x,
          cy: connector.y,
          r: 10.5,
          tabindex: 0,
          'data-connector-id': connector.id,
          'data-physical-socket-id': connector.physicalSocketId || '',
          'data-logical-socket-id': connector.logicalSocketId || '',
          'data-direction': connector.direction || '',
          'data-connector-status': status,
          'aria-label': `${connector.id} ${connector.section}${connector.logicalSocketId ? ` ${connector.logicalSocketId}` : ''}`,
        });
        const title = layers.svgElement('title', {});
        const accessoryTitle = accessoryGuidanceTitleForConnector(getModel(), getPatch(), connector);
        title.textContent = `${connector.id} · ${connector.section} · ${connector.logicalSocketId || 'display-only'} · (${connector.x}, ${connector.y})${accessoryTitle ? `
${accessoryTitle}` : ''}`;
        circle.appendChild(title);
        circle.addEventListener('pointerdown', onConnectorPointerDown);
        circle.addEventListener('keydown', onConnectorKeyDown);
        fragment.appendChild(circle);
      }
      layers.connectorLayer.appendChild(fragment);
    }
    function patchEndpointConnectorIds() {
      const ids = new Set();
      for (const wire of getWires()) {
        if (wire.from && wire.from.connectorId) ids.add(wire.from.connectorId);
        if (wire.to && wire.to.connectorId) ids.add(wire.to.connectorId);
      }
      return ids;
    }
    function updateConnectorHighlights() {
      const used = patchEndpointConnectorIds();
      for (const circle of layers.connectorLayer.querySelectorAll('.connector-hit')) {
        const connectorId = circle.getAttribute('data-connector-id');
        circle.classList.toggle('is-patch-endpoint', used.has(connectorId));
        circle.classList.toggle('is-near', connectorId === state.hoverConnectorId);
        circle.classList.toggle('is-start', Boolean(state.drag && state.drag.fromConnector && state.drag.fromConnector.id === connectorId));
        circle.classList.toggle('is-inspected', Boolean(state.inspectedSocket && (state.inspectedSocket.physicalSocketId === connectorId || state.inspectedSocket.id === connectorId)));
      }
    }
    function renderWires() {
      layers.wireLayer.replaceChildren();
      const fragment = (svg.ownerDocument || document).createDocumentFragment();
      const wires = getWires();
      for (const wire of wires) {
        const d = integratedPathBetween(wire.from, wire.to, wire.bend || 0);
        const group = layers.svgElement('g', { class: 'wire-group', 'data-wire-id': wire.id, 'data-cable-index': wire.cableIndex });
        if (wire.id === state.selectedWireId) group.appendChild(layers.svgElement('path', { class: 'wire-selected-outline', d }));
        group.appendChild(layers.svgElement('path', { class: `wire-path${wire.id === state.selectedWireId ? ' wire-selected' : ''}`, d, stroke: wire.color, 'stroke-opacity': wire.opacity, 'stroke-width': wire.strokeWidth, 'data-wire-id': wire.id, 'data-cable-index': wire.cableIndex }));
        const hit = layers.svgElement('path', { class: 'wire-hit', d, 'data-wire-id': wire.id, 'data-cable-index': wire.cableIndex, tabindex: 0, role: 'button', 'aria-label': `${wire.id}: ${wire.logicalFrom} to ${wire.logicalTo}` });
        hit.addEventListener('pointerdown', onWirePointerDown);
        group.appendChild(hit);
        fragment.appendChild(group);
      }
      layers.wireLayer.appendChild(fragment);
    }
    function renderHandles() {
      layers.handleLayer.replaceChildren();
      const selected = findSelectedWire();
      if (!selected) return;
      const fragment = (svg.ownerDocument || document).createDocumentFragment();
      for (const side of ['from', 'to']) {
        const endpoint = selected[side];
        const handleGroup = layers.svgElement('g', { class: `endpoint-handle-group endpoint-${side}`, 'data-wire-id': selected.id, 'data-cable-index': selected.cableIndex, 'data-side': side });
        handleGroup.appendChild(layers.svgElement('circle', { class: 'endpoint-handle-halo', cx: endpoint.x, cy: endpoint.y, r: 14.5 }));
        const handle = layers.svgElement('circle', { class: 'endpoint-handle', cx: endpoint.x, cy: endpoint.y, r: 9.8, 'data-wire-id': selected.id, 'data-cable-index': selected.cableIndex, 'data-side': side });
        const title = layers.svgElement('title', {});
        title.textContent = `Drag this side of ${selected.id} to another socket`;
        handle.appendChild(title);
        handle.addEventListener('pointerdown', onHandlePointerDown);
        handleGroup.appendChild(handle);
        fragment.appendChild(handleGroup);
      }
      layers.handleLayer.appendChild(fragment);
    }
    function render() {
      state.accessoryPairGuidance = accessoryPairGuidanceFromPatch(getModel(), getPatch());
      renderAccessoryPairGuidanceLayer(layers, state.accessoryPairGuidance);
      renderWires();
      renderHandles();
      renderCableInteractionStatus(statusContainer, state);
      updateButtons();
      updateConnectorHighlights();
    }
    function showTempWire(from, to, bend) {
      layers.tempWire.setAttribute('d', integratedPathBetween(from, to, bend));
      layers.tempWire.hidden = false;
    }
    function hideTempWire() {
      layers.tempWire.hidden = true;
      layers.tempWire.setAttribute('d', '');
    }
    function selectWire(wireId, cableIndex) {
      state.selectedWireId = wireId;
      state.selectedCableIndex = Number.isInteger(cableIndex) ? cableIndex : null;
      state.selectedSocketId = null;
      state.inspectedSocket = null;
      state.inspectedCable = null;
      state.lastError = '';
      render();
    }
    function connectorFromEventTarget(target) {
      const id = target && target.getAttribute ? target.getAttribute('data-connector-id') : null;
      return id ? connectorMapForModel(getModel()).map.get(id) : null;
    }
    function onConnectorPointerDown(event) {
      const connector = connectorFromEventTarget(event.currentTarget);
      if (!connector) return;
      event.preventDefault();
      event.stopPropagation();
      if (state.mode === EDITOR_MODES.PAN_ZOOM) return;
      svg.focus();
      if (state.mode === EDITOR_MODES.INSPECT || state.mode === EDITOR_MODES.SELECT) {
        try {
          const inspected = describeSocket(getModel(), socketIdForConnector(connector));
          state.inspectedSocket = inspected;
          state.inspectedCable = null;
          state.selectedWireId = null;
          state.selectedCableIndex = null;
          setStatus(inspected.tooltip || connector.id);
          render();
        } catch (error) { setStatus(`${connector.id}: ${error.message}`, true); }
        return;
      }
      if (state.mode === EDITOR_MODES.DELETE) { setStatus('Delete mode removes selected wires; click a wire or use Delete selected cable.'); return; }
      state.drag = { type: 'newWire', pointerId: event.pointerId, fromConnector: connector, current: { x: connector.x, y: connector.y } };
      state.hoverConnectorId = connector.id;
      if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
      showTempWire(connector, connector, 0);
      setStatus(`Connecting from ${connector.id}; release on another socket.`);
    }
    function onConnectorKeyDown(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      const connector = connectorFromEventTarget(event.currentTarget);
      if (!connector) return;
      if (!state.drag || state.drag.type !== 'keyboardWire') {
        state.drag = { type: 'keyboardWire', fromConnector: connector };
        state.hoverConnectorId = connector.id;
        setStatus(`Keyboard start: ${connector.id}. Focus another socket and press Enter to create a wire.`);
      } else if (state.drag.fromConnector.id !== connector.id) {
        try {
          const result = addIntegratedConnectorWireToPatch(getPatch(), getModel(), state.drag.fromConnector, connector);
          state.drag = null;
          state.hoverConnectorId = null;
          state.selectedWireId = result.style.id;
          applyEditedPatch(result.patch, result.message || `Created ${result.style.id}.`, 'integrated-wire-add');
        } catch (error) { state.drag = null; setStatus(error.message, true); }
      }
      render();
    }
    function onWirePointerDown(event) {
      event.preventDefault();
      event.stopPropagation();
      svg.focus();
      const wireId = event.currentTarget.getAttribute('data-wire-id');
      const cableIndex = Number(event.currentTarget.getAttribute('data-cable-index'));
      if (state.mode === EDITOR_MODES.DELETE || event.altKey || event.shiftKey) {
        try {
          const result = removeCableAtIndex(getPatch(), cableIndex);
          state.selectedWireId = null;
          state.selectedCableIndex = null;
          applyEditedPatch(result.patch, result.message, 'integrated-wire-delete');
        } catch (error) { setStatus(error.message, true); }
        return;
      }
      selectWire(wireId, cableIndex);
      setStatus(`Selected ${wireId}. Press Delete or drag an endpoint handle.`);
    }
    function onHandlePointerDown(event) {
      event.preventDefault();
      event.stopPropagation();
      const wireId = event.currentTarget.getAttribute('data-wire-id');
      const cableIndex = Number(event.currentTarget.getAttribute('data-cable-index'));
      const side = event.currentTarget.getAttribute('data-side');
      const wire = getWires().find((candidate) => candidate.id === wireId);
      if (!wire || !side) return;
      state.selectedWireId = wireId;
      state.selectedCableIndex = cableIndex;
      state.drag = { type: 'moveEndpoint', pointerId: event.pointerId, wireId, cableIndex, side, original: Object.assign({}, wire[side]) };
      if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
      setStatus(`Moving ${side} side of ${wireId}; release on a socket to reconnect.`);
      render();
    }
    function onPointerMove(event) {
      if (!state.drag) return;
      const point = pointFromIntegratedEvent(svg, event);
      if (!point) return;
      const connector = nearestIntegratedConnector(getModel(), point, 18);
      state.hoverConnectorId = connector ? connector.id : null;
      if (state.drag.type === 'newWire') {
        state.drag.current = point;
        showTempWire(state.drag.fromConnector, connector || point, 0);
        updateConnectorHighlights();
        return;
      }
      if (state.drag.type === 'moveEndpoint') {
        const selected = findSelectedWire();
        if (!selected) return;
        const previewEndpoint = connector ? endpointFromIntegratedConnector(connector) : point;
        const ghost = Object.assign({}, selected, { [state.drag.side]: previewEndpoint });
        const ghostD = integratedPathBetween(ghost.from, ghost.to, ghost.bend || 0);
        const selectedWireSelectorId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(selected.id) : String(selected.id).replace(/"/g, '\"');
        const selectedPath = layers.wireLayer.querySelector(`[data-wire-id="${selectedWireSelectorId}"] .wire-path`);
        if (selectedPath) selectedPath.setAttribute('d', ghostD);
        renderHandles();
        updateConnectorHighlights();
      }
    }
    function onPointerUp(event) {
      if (!state.drag) return;
      const point = pointFromIntegratedEvent(svg, event);
      const connector = point ? nearestIntegratedConnector(getModel(), point, 18) : null;
      if (state.drag.type === 'newWire') {
        const from = state.drag.fromConnector;
        hideTempWire();
        state.drag = null;
        state.hoverConnectorId = null;
        if (connector && connector.id !== from.id) {
          try {
            const result = addIntegratedConnectorWireToPatch(getPatch(), getModel(), from, connector);
            state.selectedWireId = result.style.id;
            applyEditedPatch(result.patch, result.message || `Created ${result.style.id}.`, 'integrated-wire-add');
          } catch (error) { setStatus(error.message, true); }
        } else {
          setStatus('Wire creation cancelled; release on a different socket to connect.');
          render();
        }
        return;
      }
      if (state.drag.type === 'moveEndpoint') {
        const drag = state.drag;
        state.drag = null;
        state.hoverConnectorId = null;
        if (connector) {
          try {
            const oldWire = getWires().find((wire) => wire.id === drag.wireId);
            const result = replaceIntegratedCableEndpoint(getPatch(), getModel(), drag.cableIndex, drag.side, connector, { style: oldWire || {} });
            state.selectedWireId = drag.wireId;
            state.selectedCableIndex = drag.cableIndex;
            applyEditedPatch(result.patch, result.message, 'integrated-wire-endpoint');
          } catch (error) { setStatus(error.message, true); render(); }
        } else {
          setStatus(`No socket under endpoint; ${drag.side} side reverted.`);
          render();
        }
      }
    }
    function onPointerCancel() {
      state.drag = null;
      state.hoverConnectorId = null;
      hideTempWire();
      setStatus('Pointer cancelled.');
      render();
    }
    function onStagePointerDown(event) {
      if (event.target === svg) {
        state.selectedWireId = null;
        state.selectedCableIndex = null;
        render();
        setStatus('Selection cleared.');
      }
    }
    function onKeyDown(event) {
      if ((event.key === 'Delete' || event.key === 'Backspace') && findSelectedWire()) {
        event.preventDefault();
        try {
          const result = removeCableAtIndex(getPatch(), state.selectedCableIndex);
          state.selectedWireId = null;
          state.selectedCableIndex = null;
          applyEditedPatch(result.patch, result.message, 'integrated-wire-delete');
        } catch (error) { setStatus(error.message, true); }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        state.drag = null;
        state.selectedWireId = null;
        state.selectedCableIndex = null;
        state.hoverConnectorId = null;
        hideTempWire();
        render();
        setStatus('Selection cleared.');
      }
    }
    function onModeChange() {
      refreshFromHost();
      state.mode = EDITABLE_MODES.includes(modeSelect.value) ? modeSelect.value : EDITOR_MODES.CABLE;
      state.selectedWireId = null;
      state.selectedCableIndex = null;
      state.drag = null;
      hideTempWire();
      setStatus(`Mode changed to ${state.mode}.`);
      render();
    }
    function applyViewport(nextViewport, message) { viewport = applyPanelViewport(svg, nextViewport); setStatus(message || summarizePanelViewport(viewport)); return viewport; }
    function setViewportPreset(preset) {
      const core = getDesignUsabilityCore();
      if (!core) return viewport;
      const container = svg.parentNode || {};
      const next = core.panelViewportForPreset(preset, getModel(), { containerWidth: container.clientWidth || 1200, containerHeight: container.clientHeight || 720 });
      return applyViewport(next, `Panel viewport ${preset}: ${summarizePanelViewport(next)}`);
    }
    function zoomBy(factor) { const core = getDesignUsabilityCore(); if (!core) return viewport; const next = core.zoomPanelViewport(viewport, factor, getModel()); return applyViewport(next, summarizePanelViewport(next)); }
    function panBy(dx, dy) { const core = getDesignUsabilityCore(); if (!core) return viewport; const next = core.panPanelViewport(viewport, dx, dy, getModel()); return applyViewport(next, summarizePanelViewport(next)); }
    function onUndo() { refreshFromHost(); const result = undoCableEdit(state); if (result.action !== 'unchanged') replacePatch(result.state.patch, { skipEditorSync: false, skipTemplateRender: true }); else setStatus(result.state.lastMessage); }
    function onRedo() { refreshFromHost(); const result = redoCableEdit(state); if (result.action !== 'unchanged') replacePatch(result.state.patch, { skipEditorSync: false, skipTemplateRender: true }); else setStatus(result.state.lastMessage); }
    function onDeleteSelected() { if (!findSelectedWire()) { setStatus('No wire is selected.'); return; } onKeyDown({ key: 'Delete', preventDefault() {} }); }
    function onMarkClean() { refreshFromHost(); state = markCableEditorClean(state); setStatus(state.lastMessage); }

    renderConnectors();
    render();
    setStatus(`Ready. ${connectorMapForModel(getModel()).connectors.length} connector hotspots integrated into the main patch editor.`);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerCancel);
    svg.addEventListener('pointerdown', onStagePointerDown);
    svg.addEventListener('keydown', onKeyDown);
    if (modeSelect) modeSelect.addEventListener('change', onModeChange);
    if (undoButton) undoButton.addEventListener('click', onUndo);
    if (redoButton) redoButton.addEventListener('click', onRedo);
    if (deleteButton) deleteButton.addEventListener('click', onDeleteSelected);
    if (markCleanButton) markCleanButton.addEventListener('click', onMarkClean);
    if (zoomPresetSelect) zoomPresetSelect.addEventListener('change', () => setViewportPreset(zoomPresetSelect.value));
    if (fitWidthButton) fitWidthButton.addEventListener('click', () => setViewportPreset('fit-width'));
    if (oneToOneButton) oneToOneButton.addEventListener('click', () => setViewportPreset('100'));
    if (fitPanelButton) fitPanelButton.addEventListener('click', () => setViewportPreset('fit-panel'));
    if (zoomInButton) zoomInButton.addEventListener('click', () => zoomBy(1.2));
    if (zoomOutButton) zoomOutButton.addEventListener('click', () => zoomBy(1 / 1.2));
    if (panLeftButton) panLeftButton.addEventListener('click', () => panBy(48, 0));
    if (panRightButton) panRightButton.addEventListener('click', () => panBy(-48, 0));
    if (panUpButton) panUpButton.addEventListener('click', () => panBy(0, 48));
    if (panDownButton) panDownButton.addEventListener('click', () => panBy(0, -48));

    return {
      installed: true,
      kind: 'integrated-patch-panel-wire-editor',
      getState: () => cloneStateForReturn(refreshDirty(state)),
      refresh: () => { refreshFromHost(); render(); return cloneStateForReturn(state); },
      setMode: (mode) => { state = setEditorMode(state, mode); render(); return cloneStateForReturn(state); },
      undo: () => { onUndo(); return cloneStateForReturn(state); },
      redo: () => { onRedo(); return cloneStateForReturn(state); },
      markClean: () => { onMarkClean(); return cloneStateForReturn(state); },
      getViewport: () => Object.assign({}, viewport),
      setViewportPreset: (preset) => Object.assign({}, setViewportPreset(preset)),
      zoomBy: (factor) => Object.assign({}, zoomBy(factor)),
      panBy: (dx, dy) => Object.assign({}, panBy(dx, dy)),
      getWiringJson: () => exportIntegratedWiringObject(getModel(), getPatch()),
      destroy: () => {
        svg.removeEventListener('pointermove', onPointerMove);
        svg.removeEventListener('pointerup', onPointerUp);
        svg.removeEventListener('pointercancel', onPointerCancel);
        svg.removeEventListener('pointerdown', onStagePointerDown);
        svg.removeEventListener('keydown', onKeyDown);
        if (modeSelect) modeSelect.removeEventListener('change', onModeChange);
        if (undoButton) undoButton.removeEventListener('click', onUndo);
        if (redoButton) redoButton.removeEventListener('click', onRedo);
        if (deleteButton) deleteButton.removeEventListener('click', onDeleteSelected);
        if (markCleanButton) markCleanButton.removeEventListener('click', onMarkClean);
        hideTempWire();
      },
    };
  }

  function installSvgCableEditor(options = {}) {
    const svg = options.svg;
    const getPatch = options.getPatch;
    const getModel = options.getModel;
    const replacePatch = options.replacePatch;
    const statusContainer = options.statusContainer || null;
    const modeSelect = options.modeSelect || null;
    const undoButton = options.undoButton || null;
    const redoButton = options.redoButton || null;
    const deleteButton = options.deleteButton || null;
    const markCleanButton = options.markCleanButton || null;
    const zoomPresetSelect = options.zoomPresetSelect || null;
    const fitWidthButton = options.fitWidthButton || null;
    const oneToOneButton = options.oneToOneButton || null;
    const fitPanelButton = options.fitPanelButton || null;
    const zoomInButton = options.zoomInButton || null;
    const zoomOutButton = options.zoomOutButton || null;
    const panLeftButton = options.panLeftButton || null;
    const panRightButton = options.panRightButton || null;
    const panUpButton = options.panUpButton || null;
    const panDownButton = options.panDownButton || null;
    if (!svg || typeof svg.addEventListener !== 'function' || typeof getPatch !== 'function' || typeof getModel !== 'function' || typeof replacePatch !== 'function') {
      return { installed: false, reason: 'missing svg cable editor dependencies' };
    }

    return installIntegratedPatchPanelWireEditor(options);

    let state = createCableEditState(getPatch(), getModel(), { mode: modeSelect && modeSelect.value ? modeSelect.value : EDITOR_MODES.CABLE });
    let viewport = null;
    try { viewport = createPanelViewportState(getModel(), { preset: 'fit-panel', containerWidth: svg.parentNode && svg.parentNode.clientWidth ? svg.parentNode.clientWidth : 1200, containerHeight: 720 }); applyPanelViewport(svg, viewport); } catch (error) { viewport = { mode: '100', scale: 1, offsetX: 0, offsetY: 0 }; }
    if (svg.setAttribute) svg.setAttribute('tabindex', '0');
    renderCableInteractionStatus(statusContainer, state);

    function refreshFromHost() {
      const cleanSignature = state.cleanPatchSignature;
      const history = state.history;
      const mode = state.mode;
      state = Object.assign(createCableEditState(getPatch(), getModel(), { mode }), {
        history,
        cleanPatchSignature: cleanSignature,
        dirty: patchSignature(getPatch()) !== cleanSignature,
        lastMessage: state.lastMessage,
        lastError: state.lastError,
        selectedSocketId: state.selectedSocketId,
        selectedCableIndex: state.selectedCableIndex,
      });
      return state;
    }

    function updateButtons() {
      if (modeSelect && modeSelect.value !== state.mode) modeSelect.value = state.mode;
      if (undoButton) undoButton.disabled = !state.history || !state.history.past || !state.history.past.length;
      if (redoButton) redoButton.disabled = !state.history || !state.history.future || !state.history.future.length;
      if (deleteButton) deleteButton.disabled = state.selectedCableIndex === null || state.selectedCableIndex === undefined;
      if (markCleanButton) markCleanButton.disabled = !state.dirty;
      if (zoomPresetSelect && viewport && ['fit-width', '100', 'fit-panel'].includes(viewport.mode) && zoomPresetSelect.value !== viewport.mode) zoomPresetSelect.value = viewport.mode;
    }

    function applyState(nextState, optionsForApply = {}) {
      state = refreshDirty(nextState);
      if (optionsForApply.replacePatch !== false) replacePatch(state.patch, { skipEditorSync: false, skipTemplateRender: true });
      renderCableInteractionStatus(statusContainer, state);
      updateButtons();
    }

    function socketIdFromTarget(target) {
      if (!target || !target.dataset) return null;
      return target.dataset.physicalSocketId || target.dataset.socketId || null;
    }

    function onSocketClick(event) {
      const target = event.target && event.target.closest ? event.target.closest('[data-socket-id]') : event.target;
      const socketId = socketIdFromTarget(target);
      if (!socketId) return;
      event.preventDefault();
      event.stopPropagation();
      refreshFromHost();
      if (state.mode === EDITOR_MODES.PAN_ZOOM) return;
      if (state.mode === EDITOR_MODES.INSPECT || state.mode === EDITOR_MODES.SELECT) {
        applyState(inspectSocketForEdit(state, socketId).state, { replacePatch: false });
        return;
      }
      if (state.mode === EDITOR_MODES.DELETE) {
        state.lastMessage = 'Delete mode removes selected cables; click a cable path or switch to Cable mode to wire sockets.';
        renderCableInteractionStatus(statusContainer, state);
        updateButtons();
        return;
      }
      const result = selectSocketForCable(state, socketId, { replaceExistingInput: true });
      applyState(result.state);
    }

    function onSocketKeyDown(event) {
      const target = event.target && event.target.closest ? event.target.closest('[data-socket-id]') : event.target;
      const socketId = socketIdFromTarget(target);
      if (!socketId) return;
      if (!['Enter', ' ', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      refreshFromHost();
      const result = handleSocketKey(state, socketId, event.key, { replaceExistingInput: true });
      applyState(result.state, { replacePatch: result.action === 'selected' || result.action === 'cleared' || result.action === 'inspected-socket' ? false : true });
    }

    function onCableClick(event) {
      const target = event.target && event.target.closest ? event.target.closest('[data-cable-index]') : null;
      if (!target || !target.dataset || target.dataset.cableIndex === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      refreshFromHost();
      const index = Number(target.dataset.cableIndex);
      if (event.altKey || event.shiftKey || state.mode === EDITOR_MODES.DELETE) {
        try {
          const result = removeCableAtIndex(state.patch, index);
          const next = recordPatchHistory(state, result.patch, { message: result.message, editType: 'cable-delete' });
          applyState(next);
        } catch (error) {
          state.lastMessage = error.message;
          state.lastError = error.message;
          renderCableInteractionStatus(statusContainer, state);
          updateButtons();
        }
        return;
      }
      const selected = selectCableForEdit(state, index).state;
      if (state.mode === EDITOR_MODES.INSPECT && selected.inspectedCable) selected.lastMessage = selected.inspectedCable.tooltip;
      applyState(selected, { replacePatch: false });
    }

    function onSvgPointerMove(event) {
      if (!state.selectedSocketId || state.mode !== EDITOR_MODES.CABLE) { clearPreviewPath(svg); return; }
      const point = svgPointFromEvent(svg, event);
      if (!point) return;
      const preview = createPreviewCable(getModel(), state.selectedSocketId, point, DEFAULT_HIT_RADIUS, { editorSockets: true });
      state.previewCable = preview;
      renderPreviewPath(svg, preview);
    }

    function onSvgPointerUp(event) {
      if (!state.selectedSocketId || state.mode !== EDITOR_MODES.CABLE) return;
      const point = svgPointFromEvent(svg, event);
      if (!point) return;
      const socket = hitTestSocket(getModel(), point.x, point.y, DEFAULT_HIT_RADIUS, { editorSockets: true });
      if (!socket) return;
      refreshFromHost();
      const result = selectSocketForCable(state, socket.id, { replaceExistingInput: true });
      clearPreviewPath(svg);
      applyState(result.state);
    }

    function onSvgKeyDown(event) {
      const core = getDesignUsabilityCore();
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        if (state.mode === EDITOR_MODES.PAN_ZOOM) {
          const panStep = event.shiftKey ? 80 : 24;
          const dx = event.key === 'ArrowLeft' ? panStep : event.key === 'ArrowRight' ? -panStep : 0;
          const dy = event.key === 'ArrowUp' ? panStep : event.key === 'ArrowDown' ? -panStep : 0;
          panBy(dx, dy);
          return;
        }
        if (core && typeof core.nextKeyboardSocket === 'function') {
          const nextSocket = core.nextKeyboardSocket(getModel(), state.selectedSocketId, event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1);
          if (nextSocket) {
            state.selectedSocketId = nextSocket.id;
            state.lastMessage = `Keyboard focus candidate: ${nextSocket.label}`;
            focusSocketElement(svg, nextSocket.id);
            renderCableInteractionStatus(statusContainer, state);
            updateButtons();
          }
        }
        return;
      }
      if (!['Delete', 'Backspace', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      refreshFromHost();
      let result;
      if (event.key === 'Escape') {
        const next = withStateDefaults(state);
        next.selectedSocketId = null;
        next.selectedCableIndex = null;
        next.previewCable = null;
        next.lastMessage = 'Cleared panel editor selection.';
        result = { state: refreshDirty(next), action: 'cleared' };
      } else {
        result = deleteSelectedCable(state);
      }
      clearPreviewPath(svg);
      applyState(result.state, { replacePatch: result.action === 'cleared' || result.action === 'unchanged' ? false : true });
    }

    function onModeChange() {
      refreshFromHost();
      clearPreviewPath(svg);
      applyState(setEditorMode(state, modeSelect.value), { replacePatch: false });
    }

    function applyViewport(nextViewport, message) {
      viewport = applyPanelViewport(svg, nextViewport);
      state.lastMessage = message || summarizePanelViewport(viewport);
      renderCableInteractionStatus(statusContainer, state);
      updateButtons();
      return viewport;
    }

    function setViewportPreset(preset) {
      const core = getDesignUsabilityCore();
      if (!core) return viewport;
      const container = svg.parentNode || {};
      return applyViewport(core.panelViewportForPreset(preset, getModel(), { containerWidth: container.clientWidth || 1200, containerHeight: container.clientHeight || 720 }), `Panel viewport ${preset}: ${summarizePanelViewport(viewport)}`);
    }

    function zoomBy(factor) {
      const core = getDesignUsabilityCore();
      if (!core) return viewport;
      return applyViewport(core.zoomPanelViewport(viewport, factor, getModel()), summarizePanelViewport(core.zoomPanelViewport(viewport, factor, getModel())));
    }

    function panBy(dx, dy) {
      const core = getDesignUsabilityCore();
      if (!core) return viewport;
      return applyViewport(core.panPanelViewport(viewport, dx, dy, getModel()), summarizePanelViewport(core.panPanelViewport(viewport, dx, dy, getModel())));
    }

    function onUndo() { refreshFromHost(); const result = undoCableEdit(state); applyState(result.state, { replacePatch: result.action !== 'unchanged' }); }
    function onRedo() { refreshFromHost(); const result = redoCableEdit(state); applyState(result.state, { replacePatch: result.action !== 'unchanged' }); }
    function onDeleteSelected() { refreshFromHost(); const result = deleteSelectedCable(state); applyState(result.state, { replacePatch: result.action !== 'unchanged' }); }
    function onMarkClean() { refreshFromHost(); applyState(markCableEditorClean(state), { replacePatch: false }); }

    svg.addEventListener('click', onSocketClick);
    svg.addEventListener('keydown', onSocketKeyDown);
    svg.addEventListener('click', onCableClick);
    svg.addEventListener('pointermove', onSvgPointerMove);
    svg.addEventListener('pointerup', onSvgPointerUp);
    svg.addEventListener('keydown', onSvgKeyDown);
    if (modeSelect) modeSelect.addEventListener('change', onModeChange);
    if (undoButton) undoButton.addEventListener('click', onUndo);
    if (redoButton) redoButton.addEventListener('click', onRedo);
    if (deleteButton) deleteButton.addEventListener('click', onDeleteSelected);
    if (markCleanButton) markCleanButton.addEventListener('click', onMarkClean);
    if (zoomPresetSelect) zoomPresetSelect.addEventListener('change', () => setViewportPreset(zoomPresetSelect.value));
    if (fitWidthButton) fitWidthButton.addEventListener('click', () => setViewportPreset('fit-width'));
    if (oneToOneButton) oneToOneButton.addEventListener('click', () => setViewportPreset('100'));
    if (fitPanelButton) fitPanelButton.addEventListener('click', () => setViewportPreset('fit-panel'));
    if (zoomInButton) zoomInButton.addEventListener('click', () => zoomBy(1.2));
    if (zoomOutButton) zoomOutButton.addEventListener('click', () => zoomBy(1 / 1.2));
    if (panLeftButton) panLeftButton.addEventListener('click', () => panBy(48, 0));
    if (panRightButton) panRightButton.addEventListener('click', () => panBy(-48, 0));
    if (panUpButton) panUpButton.addEventListener('click', () => panBy(0, 48));
    if (panDownButton) panDownButton.addEventListener('click', () => panBy(0, -48));
    updateButtons();

    return {
      installed: true,
      getState: () => cloneStateForReturn(refreshDirty(state)),
      refresh: () => cloneStateForReturn(refreshFromHost()),
      setMode: (mode) => { applyState(setEditorMode(state, mode), { replacePatch: false }); return cloneStateForReturn(state); },
      undo: () => { const result = undoCableEdit(state); applyState(result.state, { replacePatch: result.action !== 'unchanged' }); return cloneStateForReturn(state); },
      redo: () => { const result = redoCableEdit(state); applyState(result.state, { replacePatch: result.action !== 'unchanged' }); return cloneStateForReturn(state); },
      markClean: () => { applyState(markCableEditorClean(state), { replacePatch: false }); return cloneStateForReturn(state); },
      getViewport: () => Object.assign({}, viewport),
      setViewportPreset: (preset) => Object.assign({}, setViewportPreset(preset)),
      zoomBy: (factor) => Object.assign({}, zoomBy(factor)),
      panBy: (dx, dy) => Object.assign({}, panBy(dx, dy)),
      destroy: () => {
        svg.removeEventListener('click', onSocketClick);
        svg.removeEventListener('keydown', onSocketKeyDown);
        svg.removeEventListener('click', onCableClick);
        svg.removeEventListener('pointermove', onSvgPointerMove);
        svg.removeEventListener('pointerup', onSvgPointerUp);
        svg.removeEventListener('keydown', onSvgKeyDown);
        if (modeSelect) modeSelect.removeEventListener('change', onModeChange);
        if (undoButton) undoButton.removeEventListener('click', onUndo);
        if (redoButton) redoButton.removeEventListener('click', onRedo);
        if (deleteButton) deleteButton.removeEventListener('click', onDeleteSelected);
        if (markCleanButton) markCleanButton.removeEventListener('click', onMarkClean);
        clearPreviewPath(svg);
      },
    };
  }

  const api = {
    DEFAULT_HIT_RADIUS,
    DEFAULT_WIRE_BEND_LIMIT,
    DEFAULT_PANEL_BOUNDS,
    EDITOR_MODES,
    parseSocketId,
    socketPosition,
    socketCatalogFromPanelModel,
    listPanelSockets,
    listEditorSockets,
    resolveSocket,
    normalizeCableEndpoints,
    addCableToPatch,
    removeCableAtIndex,
    removeCableByEndpoint,
    hitTestSocket,
    createCableEditState,
    setEditorMode,
    recordPatchHistory,
    undoCableEdit,
    redoCableEdit,
    markCableEditorClean,
    describeSocket,
    describeCable,
    inspectSocketForEdit,
    selectCableForEdit,
    deleteSelectedCable,
    createPreviewCable,
    previewCablePath,
    renderPreviewPath,
    clearPreviewPath,
    createPanelViewportState,
    panelViewportCss,
    applyPanelViewport,
    summarizePanelViewport,
    selectSocketForCable,
    handleSocketKey,
    handleCableEditorKey,
    summarizeCableInteraction,
    renderCableInteractionStatus,
    listIntegratedPanelConnectors,
    createIntegratedConnectorBridge,
    connectorMapForModel,
    logicalAliasForIntegratedPanel,
    physicalAccessorySocketIdForLogical,
    connectorForPhysicalSocket,
    connectorForCableEndpoint,
    connectorCanReplaceCableSide,
    connectorIsExecutable,
    connectorIsRuntimeAccessoryTerminal,
    wireLengthBetween,
    wireBendMagnitudeRange,
    normalizePanelBounds,
    pointIsInsidePanelBounds,
    wireMidpointForBend,
    bendAdjustedToPanelBounds,
    randomWireBendForEndpoints,
    stableWireBendForEndpoints,
    integratedPathBetween,
    integratedWiresFromPatch,
    accessoryPairGuidanceFromPatch,
    designLikeForAccessoryGuidance,
    renderAccessoryPairGuidanceLayer,
    exportIntegratedWiringObject,
    addIntegratedConnectorWireToPatch,
    replaceIntegratedCableEndpoint,
    installIntegratedPatchPanelWireEditor,
    installSvgCableEditor,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingCableInteractionApp = api;
}(typeof window !== 'undefined' ? window : global));
