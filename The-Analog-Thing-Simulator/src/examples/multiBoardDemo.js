'use strict';

const { PATCH_SCHEMA_VERSION } = require('../core/serialization');
const { createMultiBoardSystem } = require('../core/multiboard');

function masterStaticInverterPatch() {
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: 'that-prototype-board/v006',
    name: 'Master static inverter board',
    description: 'Master board emits an inverted coefficient signal for a minion board.',
    components: [
      { id: 'PLUS1' },
      { id: 'P1', coefficient: 0.6, label: 'master coefficient' },
      { id: 'INV1' },
      { id: 'OUT_Y', label: 'master Y' },
    ],
    cables: [
      { from: 'PLUS1.out', to: 'P1.in' },
      { from: 'P1.out', to: 'INV1.in' },
      { from: 'INV1.out', to: 'OUT_Y.in' },
    ],
    outputs: { y: 'OUT_Y.out', inverted: 'INV1.out' },
    parameters: { expectedY: -0.6 },
  };
}

function minionReceiverPatch() {
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: 'that-prototype-board/v006',
    name: 'Minion coefficient receiver board',
    description: 'Minion board receives a signal from the master through an inter-board cable and scales it.',
    components: [
      { id: 'P1', coefficient: 0.5, label: 'minion coefficient' },
      { id: 'OUT_Y', label: 'minion Y' },
    ],
    cables: [
      { from: 'P1.out', to: 'OUT_Y.in' },
    ],
    outputs: { y: 'OUT_Y.out', scaled: 'P1.out' },
    parameters: { expectedY: -0.3 },
  };
}

function twoBoardMinionSystemDefinition() {
  return {
    schemaVersion: 'analog-thing-multiboard/v1',
    name: 'Two-board master/minion static signal demo',
    description: 'A small multi-board composition: master generates -0.6 machine units, minion scales that signal to -0.3.',
    boards: [
      { id: 'master', role: 'master', label: 'Master THAT', patch: masterStaticInverterPatch() },
      { id: 'minion', role: 'minion', label: 'Minion THAT', patch: minionReceiverPatch() },
    ],
    links: [
      { from: 'master:INV1.out', to: 'minion:P1.in', label: 'master analog output into minion coefficient input' },
    ],
    outputs: {
      masterY: 'master:OUT_Y.out',
      minionY: 'minion:OUT_Y.out',
      minionScaled: 'minion:P1.out',
    },
    hybrid: {
      signalMap: { x: 'masterY', y: 'minionY' },
    },
  };
}

function createTwoBoardMinionSystem(options = {}) {
  return createMultiBoardSystem(twoBoardMinionSystemDefinition(), options);
}

function runTwoBoardMinionDemo(options = {}) {
  const system = createTwoBoardMinionSystem(options);
  const result = system.run({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1, ...options.run });
  return { system: system.summarize(), result, hybridFrame: system.hybrid.captureTracePoint(result.trace[0]).frame };
}

module.exports = {
  masterStaticInverterPatch,
  minionReceiverPatch,
  twoBoardMinionSystemDefinition,
  createTwoBoardMinionSystem,
  runTwoBoardMinionDemo,
};
