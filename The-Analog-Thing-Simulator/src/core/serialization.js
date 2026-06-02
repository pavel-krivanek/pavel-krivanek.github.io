'use strict';

const fs = require('fs');
const { PatchMachine, normalizeConnection } = require('./patch');
const { createThatPrototypeInventory } = require('./inventory');

const PATCH_SCHEMA_VERSION = 'analog-thing-patch/v1';
const DEFAULT_INVENTORY_NAME = 'that-prototype-board/v006';

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeComponentEntry(entry, inventory) {
  if (!entry || typeof entry.id !== 'string') {
    throw new Error(`serialized component entry requires id: ${JSON.stringify(entry)}`);
  }
  if (entry.type) return clonePlain(entry);
  if (!inventory) throw new Error(`component ${entry.id} references inventory, but no inventory was supplied`);
  const overrides = { ...entry };
  delete overrides.id;
  delete overrides.note;
  return inventory.getComponentDefinition(entry.id, overrides);
}

function normalizeSerializedPatch(serialized) {
  if (!serialized || typeof serialized !== 'object') throw new Error('serialized patch must be an object');
  if (serialized.schemaVersion && serialized.schemaVersion !== PATCH_SCHEMA_VERSION) {
    throw new Error(`unsupported patch schemaVersion: ${serialized.schemaVersion}`);
  }
  const components = serialized.components || serialized.componentRefs;
  if (!Array.isArray(components)) throw new Error('serialized patch requires components array');
  const connections = serialized.connections || serialized.cables || [];
  if (!Array.isArray(connections)) throw new Error('serialized patch connections/cables must be an array');
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    name: serialized.name || 'unnamed serialized patch',
    description: serialized.description || '',
    inventory: serialized.inventory || DEFAULT_INVENTORY_NAME,
    components: clonePlain(components),
    connections: connections.map(normalizeConnection),
    outputs: clonePlain(serialized.outputs || {}),
    parameters: clonePlain(serialized.parameters || {}),
    ...(serialized.imperfections ? { imperfections: clonePlain(serialized.imperfections) } : {}),
  };
}

function patchDefinitionFromSerializedPatch(serialized, options = {}) {
  const normalized = normalizeSerializedPatch(serialized);
  const inventory = options.inventory || createThatPrototypeInventory();
  return {
    schemaVersion: normalized.schemaVersion,
    name: normalized.name,
    description: normalized.description,
    components: normalized.components.map((entry) => normalizeComponentEntry(entry, inventory)),
    connections: normalized.connections,
    outputs: normalized.outputs,
    parameters: normalized.parameters,
    ...(normalized.imperfections ? { imperfections: normalized.imperfections } : {}),
  };
}

function createPatchMachineFromSerializedPatch(serialized, options = {}) {
  return new PatchMachine(patchDefinitionFromSerializedPatch(serialized, options));
}

function serializedPatchFromDefinition(definition, options = {}) {
  if (!definition || !Array.isArray(definition.components)) throw new Error('patch definition requires components array');
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    name: definition.name || 'unnamed serialized patch',
    description: definition.description || '',
    inventory: options.inventory || DEFAULT_INVENTORY_NAME,
    components: definition.components.map(clonePlain),
    cables: (definition.connections || []).map(normalizeConnection),
    outputs: clonePlain(definition.outputs || {}),
    parameters: clonePlain(definition.parameters || {}),
    ...(definition.imperfections ? { imperfections: clonePlain(definition.imperfections) } : {}),
  };
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadPatchJson(filePath, options = {}) {
  const serialized = normalizeSerializedPatch(readJsonFile(filePath));
  if (options.asMachine) return createPatchMachineFromSerializedPatch(serialized, options);
  if (options.asDefinition) return patchDefinitionFromSerializedPatch(serialized, options);
  return serialized;
}

function savePatchJson(filePath, serializedPatch) {
  const normalized = normalizeSerializedPatch(serializedPatch);
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

module.exports = {
  PATCH_SCHEMA_VERSION,
  DEFAULT_INVENTORY_NAME,
  normalizeSerializedPatch,
  patchDefinitionFromSerializedPatch,
  createPatchMachineFromSerializedPatch,
  serializedPatchFromDefinition,
  loadPatchJson,
  savePatchJson,
};
