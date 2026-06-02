'use strict';

const { createDampedOscillationMachine } = require('./dampedOscillation');
const { runMode, MODES } = require('../core/modes');
const { normalizeImperfectionSpec } = require('../core/imperfections');

function defaultImperfectionSpec(overrides = {}) {
  return normalizeImperfectionSpec({
    enabled: true,
    seed: 14014,
    toleranceStdDev: 0.015,
    outputGainStdDev: 0.005,
    noiseStdDev: 0.0015,
    outputOffset: 0.002,
    driftPerSecond: 0.00005,
    ...overrides,
  });
}

function runImperfectionDemo(options = {}) {
  const runOptions = {
    mode: options.mode || MODES.OP,
    duration: options.duration === undefined ? 8 : options.duration,
    dt: options.dt === undefined ? 0.01 : options.dt,
    sampleEvery: options.sampleEvery === undefined ? 50 : options.sampleEvery,
    opTime: options.opTime === undefined ? 8 : options.opTime,
    cycles: options.cycles === undefined ? 1 : options.cycles,
    clip: Boolean(options.clip),
  };
  const baseParameters = {
    k: options.k === undefined ? 0.5 : options.k,
    d: options.d === undefined ? 0.5 : options.d,
    invMass: options.invMass === undefined ? 0.5 : options.invMass,
  };
  const imperfections = defaultImperfectionSpec(options.imperfections || {});
  const idealMachine = createDampedOscillationMachine(baseParameters);
  const imperfectMachine = createDampedOscillationMachine({ ...baseParameters, imperfections });
  const ideal = runMode(idealMachine, runOptions);
  const imperfect = runMode(imperfectMachine, runOptions);
  const lastIdeal = ideal.trace[ideal.trace.length - 1];
  const lastImperfect = imperfect.trace[imperfect.trace.length - 1];
  return {
    name: 'THAT damped oscillator imperfection comparison',
    parameters: baseParameters,
    imperfections,
    runOptions,
    ideal,
    imperfect,
    deltaAtFinalSample: {
      velocity: lastImperfect.outputs.velocity - lastIdeal.outputs.velocity,
      position: lastImperfect.outputs.position - lastIdeal.outputs.position,
    },
  };
}

module.exports = {
  defaultImperfectionSpec,
  runImperfectionDemo,
};
