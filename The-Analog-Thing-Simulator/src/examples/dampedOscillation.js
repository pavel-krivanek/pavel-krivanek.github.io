'use strict';

const { createThatPrototypeInventory } = require('../core/inventory');
const {
  DEFAULT_INVENTORY_NAME,
  PATCH_SCHEMA_VERSION,
  patchDefinitionFromSerializedPatch,
  createPatchMachineFromSerializedPatch,
} = require('../core/serialization');

function dampedOscillationSerializedPatch(options = {}) {
  const k = options.k === undefined ? 0.5 : options.k;
  const d = options.d === undefined ? 0.5 : options.d;
  const invMass = options.invMass === undefined ? 0.5 : options.invMass;
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'THAT quickstart damped oscillation prototype',
    description: 'Serialized block-level patch for the official THAT quickstart damped oscillator. It is intentionally still limited to the currently implemented component subset.',
    components: [
      { id: 'PLUS1' },
      { id: 'I1' },
      { id: 'I2' },
      { id: 'INV1' },
      { id: 'P1', coefficient: k, label: 'P1 spring coefficient k' },
      { id: 'P2', coefficient: d, label: 'P2 damping coefficient d' },
      { id: 'SUM1' },
      { id: 'P3', coefficient: invMass, label: 'P3 inverse mass 1/m' },
      { id: 'OUT_X', label: 'X / velocity' },
      { id: 'OUT_Y', label: 'Y / position' },
    ],
    cables: [
      { from: 'PLUS1.out', to: 'I1.ic', label: 'initial velocity +1 becomes I1.out = -1' },
      { from: 'P3.out', to: 'I1.in1', label: 'acceleration input to first integrator' },
      { from: 'I1.out', to: 'I2.in1', label: 'integrate minus velocity into position' },
      { from: 'I1.out', to: 'INV1.in', label: 'recover positive velocity' },
      { from: 'I2.out', to: 'P1.in', label: 'spring term k*x' },
      { from: 'INV1.out', to: 'P2.in', label: 'damping term d*x_dot' },
      { from: 'P1.out', to: 'SUM1.in1', label: 'summer input for spring force' },
      { from: 'P2.out', to: 'SUM1.in2', label: 'summer input for damping force' },
      { from: 'SUM1.out', to: 'P3.in', label: 'apply inverse mass to force sum' },
      { from: 'INV1.out', to: 'OUT_X.in', label: 'velocity display' },
      { from: 'I2.out', to: 'OUT_Y.in', label: 'position display' },
    ],
    outputs: {
      x: 'OUT_X.out',
      velocity: 'OUT_X.out',
      position: 'OUT_Y.out',
      minusVelocity: 'I1.out',
      accelerationInput: 'P3.out',
    },
    parameters: { k, d, invMass },
    ...(options.imperfections ? { imperfections: options.imperfections } : {}),
  };
}

function dampedOscillationDefinition(options = {}) {
  const inventory = options.inventory || createThatPrototypeInventory();
  return patchDefinitionFromSerializedPatch(dampedOscillationSerializedPatch(options), { inventory });
}

function createDampedOscillationMachine(options = {}) {
  const inventory = options.inventory || createThatPrototypeInventory();
  return createPatchMachineFromSerializedPatch(dampedOscillationSerializedPatch(options), { inventory });
}

module.exports = {
  dampedOscillationSerializedPatch,
  dampedOscillationDefinition,
  createDampedOscillationMachine,
};
