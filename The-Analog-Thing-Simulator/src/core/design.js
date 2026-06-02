'use strict';

const fs = require('fs');
const { MODES } = require('./modes');
const {
  PATCH_SCHEMA_VERSION,
  DEFAULT_INVENTORY_NAME,
  normalizeSerializedPatch,
  patchDefinitionFromSerializedPatch,
  serializedPatchFromDefinition,
  createPatchMachineFromSerializedPatch,
} = require('./serialization');
const {
  createThatPhysicalSocketMap,
  logicalSocketIdFromPhysical,
  physicalizeDesignCables,
} = require('./physicalSockets');
const {
  COEFFICIENT_CONTROL_IDS,
  DEFAULT_COEFFICIENT,
  normalizeCoefficientControls,
  designWithControlState,
  controlStateFromDesign,
} = require('./designControls');
const { materializePhysicalAccessoriesFromDesign } = require('./designAccessories');

const DESIGN_SCHEMA_VERSION = 'analog-thing-design/v1';
const DESIGN_KIND = 'custom-design';

const DEFAULT_OPERATION_DEFAULTS = Object.freeze({
  mode: MODES.REPF,
  duration: 40,
  dt: 0.01,
  sampleEvery: 10,
  opTime: 8,
  cycles: 3,
  clip: false,
});

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableNow(options = {}) {
  return options.now || options.timestamp || new Date().toISOString();
}

function finiteNumber(value, fallback, name) {
  const normalized = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(normalized)) throw new Error(`${name} must be a finite number`);
  return normalized;
}

function normalizeStringList(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('metadata.tags must be an array');
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function normalizeMetadata(metadata = {}, options = {}) {
  const createdAt = metadata.createdAt || stableNow(options);
  const modifiedAt = metadata.modifiedAt || metadata.updatedAt || createdAt;
  return {
    name: metadata.name || options.name || 'Untitled custom design',
    description: metadata.description || '',
    author: metadata.author || '',
    source: metadata.source || '',
    tags: normalizeStringList(metadata.tags),
    createdAt,
    modifiedAt,
    notes: metadata.notes || '',
  };
}

function normalizeOperationDefaults(defaults = {}) {
  const mode = defaults.mode || DEFAULT_OPERATION_DEFAULTS.mode;
  if (!Object.values(MODES).includes(mode)) throw new Error(`unsupported design operation mode: ${mode}`);
  const duration = finiteNumber(defaults.duration, DEFAULT_OPERATION_DEFAULTS.duration, 'operationDefaults.duration');
  const dt = finiteNumber(defaults.dt, DEFAULT_OPERATION_DEFAULTS.dt, 'operationDefaults.dt');
  const sampleEvery = finiteNumber(defaults.sampleEvery, DEFAULT_OPERATION_DEFAULTS.sampleEvery, 'operationDefaults.sampleEvery');
  const opTime = finiteNumber(defaults.opTime, DEFAULT_OPERATION_DEFAULTS.opTime, 'operationDefaults.opTime');
  const cycles = finiteNumber(defaults.cycles, DEFAULT_OPERATION_DEFAULTS.cycles, 'operationDefaults.cycles');
  if (duration < 0) throw new Error('operationDefaults.duration must be >= 0');
  if (dt <= 0) throw new Error('operationDefaults.dt must be > 0');
  if (!Number.isInteger(sampleEvery) || sampleEvery <= 0) throw new Error('operationDefaults.sampleEvery must be a positive integer');
  if (opTime <= 0) throw new Error('operationDefaults.opTime must be > 0');
  if (!Number.isInteger(cycles) || cycles <= 0) throw new Error('operationDefaults.cycles must be a positive integer');
  return { mode, duration, dt, sampleEvery, opTime, cycles, clip: Boolean(defaults.clip) };
}

function normalizeComponentRef(component, index = 0) {
  if (!component || typeof component !== 'object') throw new Error(`component ${index + 1} must be an object`);
  if (typeof component.id !== 'string' || !component.id.trim()) throw new Error(`component ${index + 1} requires id`);
  const copy = clonePlain(component);
  copy.id = copy.id.trim();
  return copy;
}

function normalizeCoefficientMap(coefficients = {}, components = []) {
  const result = {};
  for (const id of COEFFICIENT_CONTROL_IDS) result[id] = DEFAULT_COEFFICIENT;
  for (const component of components) {
    if (component && component.coefficient !== undefined) result[component.id] = finiteNumber(component.coefficient, 0, `coefficient ${component.id}`);
  }
  for (const [componentId, value] of Object.entries(coefficients || {})) {
    if (!componentId.trim()) throw new Error('coefficient map contains an empty component id');
    const scalar = value && typeof value === 'object' && value.coefficient !== undefined ? value.coefficient : value;
    result[componentId.trim()] = finiteNumber(scalar, 0, `coefficient ${componentId}`);
  }
  const normalizedControls = normalizeCoefficientControls(result);
  return Object.assign(result, normalizedControls);
}

function normalizeDesignEndpoint(endpoint, role, index = 0) {
  if (typeof endpoint === 'string') {
    const text = endpoint.trim();
    return /^phys\./.test(text) ? { logicalSocketId: null, physicalSocketId: text } : { logicalSocketId: text, physicalSocketId: null };
  }
  if (!endpoint || typeof endpoint !== 'object') throw new Error(`cable ${index + 1} ${role} endpoint must be a string or object`);
  const rawLogicalSocketId = endpoint.logicalSocketId || endpoint.logical || endpoint.socketId || endpoint.socket || null;
  const rawPhysicalSocketId = endpoint.physicalSocketId || endpoint.physical || null;
  const logicalLooksPhysical = typeof rawLogicalSocketId === 'string' && /^phys\./.test(rawLogicalSocketId.trim());
  const logicalSocketId = logicalLooksPhysical ? null : rawLogicalSocketId;
  const physicalSocketId = rawPhysicalSocketId || (logicalLooksPhysical ? rawLogicalSocketId : null);
  if (logicalSocketId !== null && (typeof logicalSocketId !== 'string' || !logicalSocketId.trim())) {
    throw new Error(`cable ${index + 1} ${role}.logicalSocketId must be a non-empty string when present`);
  }
  if (physicalSocketId !== null && (typeof physicalSocketId !== 'string' || !physicalSocketId.trim())) {
    throw new Error(`cable ${index + 1} ${role}.physicalSocketId must be a non-empty string when present`);
  }
  if (!logicalSocketId && !physicalSocketId) throw new Error(`cable ${index + 1} ${role} endpoint needs logicalSocketId or physicalSocketId`);
  return {
    logicalSocketId: logicalSocketId ? logicalSocketId.trim() : null,
    physicalSocketId: physicalSocketId ? physicalSocketId.trim() : null,
  };
}

function normalizeDesignCable(cable, index = 0) {
  if (!cable || typeof cable !== 'object') throw new Error(`cable ${index + 1} must be an object`);
  return {
    id: cable.id || `cable-${index + 1}`,
    from: normalizeDesignEndpoint(cable.from, 'from', index),
    to: normalizeDesignEndpoint(cable.to, 'to', index),
    label: cable.label || '',
    color: cable.color || null,
  };
}

function logicalSocketFromEndpoint(endpoint, role, index = 0, options = {}) {
  const normalized = normalizeDesignEndpoint(endpoint, role, index);
  if (normalized.logicalSocketId) return normalized.logicalSocketId;
  if (normalized.physicalSocketId) {
    const socketMap = options.physicalSocketMap || options.socketMap || createThatPhysicalSocketMap();
    return logicalSocketIdFromPhysical(normalized.physicalSocketId, { socketMap });
  }
  throw new Error(`cable ${index + 1} ${role} endpoint has no logical socket mapping`);
}

function normalizeOutputRouting(routing = {}, patchOutputs = {}) {
  const channels = Object.assign({ X: null, Y: null, Z: null, U: null }, routing.channels || {});
  const aliases = Object.assign({}, routing.aliases || routing.outputs || {});
  for (const [name, socketId] of Object.entries(patchOutputs || {})) {
    if (aliases[name] === undefined) aliases[name] = socketId;
  }
  for (const channel of ['X', 'Y', 'Z', 'U']) {
    const direct = routing[channel] || routing[channel.toLowerCase()];
    if (direct !== undefined) channels[channel] = direct;
  }
  if (!channels.X && patchOutputs.x) channels.X = patchOutputs.x;
  if (!channels.Y && patchOutputs.y) channels.Y = patchOutputs.y;
  if (!channels.Z && patchOutputs.z) channels.Z = patchOutputs.z;
  if (!channels.U && patchOutputs.u) channels.U = patchOutputs.u;
  if (!channels.X && patchOutputs.velocity) channels.X = patchOutputs.velocity;
  if (!channels.Y && patchOutputs.position) channels.Y = patchOutputs.position;
  return {
    channels: Object.fromEntries(Object.entries(channels).map(([key, value]) => [key, value === undefined ? null : value])),
    aliases,
  };
}

function outputsFromOutputRouting(outputRouting) {
  const routing = normalizeOutputRouting(outputRouting);
  const outputs = Object.assign({}, routing.aliases);
  for (const [channel, socketId] of Object.entries(routing.channels)) {
    if (socketId) outputs[channel.toLowerCase()] = socketId;
  }
  return outputs;
}

function normalizeDesign(design, options = {}) {
  if (!design || typeof design !== 'object') throw new Error('design must be an object');
  if (design.schemaVersion && design.schemaVersion !== DESIGN_SCHEMA_VERSION) {
    throw new Error(`unsupported design schemaVersion: ${design.schemaVersion}`);
  }
  const components = (design.components || design.componentRefs || []).map(normalizeComponentRef);
  if (components.length === 0 && options.requireComponents !== false) throw new Error('design.components must contain at least one component reference');
  const cables = (design.cables || design.connections || []).map(normalizeDesignCable);
  const metadata = normalizeMetadata(design.metadata || design, options);
  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    kind: design.kind || DESIGN_KIND,
    inventory: design.inventory || DEFAULT_INVENTORY_NAME,
    metadata,
    components,
    coefficients: normalizeCoefficientMap(design.coefficients || design.coefficientSettings || {}, components),
    cables,
    outputRouting: normalizeOutputRouting(design.outputRouting || {}, design.outputs || {}),
    operationDefaults: normalizeOperationDefaults(design.operationDefaults || design.runDefaults || design.parameters || {}),
    notes: design.notes || metadata.notes || '',
    sourcePatchSchemaVersion: design.sourcePatchSchemaVersion || null,
  };
}

function designFromSerializedPatch(serializedPatch, options = {}) {
  const patch = normalizeSerializedPatch(serializedPatch);
  const now = stableNow(options);
  const metadata = normalizeMetadata({
    name: options.name || patch.name || 'Imported patch design',
    description: options.description || patch.description || '',
    author: options.author || '',
    source: options.source || 'imported serialized patch',
    tags: options.tags || ['imported-patch'],
    createdAt: options.createdAt || now,
    modifiedAt: options.modifiedAt || now,
    notes: options.notes || '',
  }, { now });
  const operationDefaults = normalizeOperationDefaults(Object.assign({}, options.operationDefaults || {}, patch.parameters || {}));
  return normalizeDesign({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    kind: DESIGN_KIND,
    inventory: patch.inventory,
    metadata,
    components: patch.components,
    coefficients: normalizeCoefficientMap(Object.assign({}, patch.parameters && patch.parameters.coefficients ? patch.parameters.coefficients : {}, options.coefficients || {}), patch.components),
    cables: patch.connections.map((connection, index) => ({
      id: `cable-${index + 1}`,
      from: { logicalSocketId: connection.from, physicalSocketId: null },
      to: { logicalSocketId: connection.to, physicalSocketId: null },
      label: connection.label || '',
    })),
    outputRouting: normalizeOutputRouting(options.outputRouting || {}, patch.outputs),
    operationDefaults,
    notes: metadata.notes,
    sourcePatchSchemaVersion: patch.schemaVersion,
  });
}

function serializedPatchFromDesign(design, options = {}) {
  const socketMap = options.physicalSocketMap || options.socketMap || createThatPhysicalSocketMap();
  const base = options.physicalize ? physicalizeDesignCables(design, { socketMap }) : design;
  const materialized = options.materializePhysicalAccessories === false ? { design: base } : materializePhysicalAccessoriesFromDesign(base, { socketMap });
  const normalized = normalizeDesign(materialized.design);
  const components = normalized.components.map((component) => {
    const copy = clonePlain(component);
    if (normalized.coefficients[copy.id] !== undefined) copy.coefficient = normalized.coefficients[copy.id];
    return copy;
  });
  const cables = normalized.cables.map((cable, index) => ({
    from: logicalSocketFromEndpoint(cable.from, 'from', index, options),
    to: logicalSocketFromEndpoint(cable.to, 'to', index, options),
    ...(cable.label ? { label: cable.label } : {}),
  }));
  const patch = {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: normalized.inventory,
    name: options.name || normalized.metadata.name,
    description: options.description || normalized.metadata.description,
    components,
    cables,
    outputs: outputsFromOutputRouting(normalized.outputRouting),
    parameters: Object.assign({}, normalized.operationDefaults, {
      coefficients: clonePlain(normalized.coefficients),
      k: normalized.coefficients.P1,
      d: normalized.coefficients.P2,
      invMass: normalized.coefficients.P3,
    }),
  };
  normalizeSerializedPatch(patch);
  return patch;
}

function patchDefinitionFromDesign(design, options = {}) {
  return patchDefinitionFromSerializedPatch(serializedPatchFromDesign(design, options), options);
}

function createPatchMachineFromDesign(design, options = {}) {
  return createPatchMachineFromSerializedPatch(serializedPatchFromDesign(design, options), options);
}

function designRoundTripPayload(design) {
  const normalized = normalizeDesign(design);
  const json = `${JSON.stringify(normalized, null, 2)}\n`;
  const reparsed = normalizeDesign(JSON.parse(json));
  return {
    ok: JSON.stringify(normalized) === JSON.stringify(reparsed),
    design: reparsed,
    json,
    byteLength: Buffer.byteLength(json, 'utf8'),
  };
}

function loadDesignJson(filePath) {
  return normalizeDesign(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function saveDesignJson(filePath, design) {
  const normalized = normalizeDesign(design);
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function summarizeDesign(design, options = {}) {
  const socketMap = options.physicalSocketMap || options.socketMap || createThatPhysicalSocketMap();
  const source = options.physicalize ? physicalizeDesignCables(design, { socketMap }) : design;
  const materialized = options.materializePhysicalAccessories === false ? { design: source, materializedCount: 0, materializedAccessories: [] } : materializePhysicalAccessoriesFromDesign(source, { socketMap });
  const normalized = normalizeDesign(materialized.design);
  const original = normalizeDesign(source);
  const channels = Object.entries(normalized.outputRouting.channels).filter((entry) => entry[1]).map((entry) => entry[0]);
  return {
    schemaVersion: normalized.schemaVersion,
    name: normalized.metadata.name,
    inventory: normalized.inventory,
    componentCount: normalized.components.length,
    cableCount: normalized.cables.length,
    coefficientCount: Object.keys(normalized.coefficients).length,
    outputChannelCount: channels.length,
    outputChannels: channels,
    aliasCount: Object.keys(normalized.outputRouting.aliases).length,
    defaultMode: normalized.operationDefaults.mode,
    hasPhysicalEndpoints: original.cables.some((cable) => cable.from.physicalSocketId || cable.to.physicalSocketId),
    materializedAccessoryCount: materialized.materializedCount || 0,
    materializedAccessories: materialized.materializedAccessories || [],
    executableCableCount: normalized.cables.filter((cable, index) => {
      try {
        logicalSocketFromEndpoint(cable.from, 'from', index, options);
        logicalSocketFromEndpoint(cable.to, 'to', index, options);
        return true;
      } catch (error) {
        return false;
      }
    }).length,
  };
}

module.exports = {
  DESIGN_SCHEMA_VERSION,
  DESIGN_KIND,
  DEFAULT_OPERATION_DEFAULTS,
  normalizeDesign,
  designFromSerializedPatch,
  serializedPatchFromDesign,
  patchDefinitionFromDesign,
  createPatchMachineFromDesign,
  designRoundTripPayload,
  loadDesignJson,
  saveDesignJson,
  summarizeDesign,
  designWithControlState,
  controlStateFromDesign,
  physicalizeDesignCables,
};
