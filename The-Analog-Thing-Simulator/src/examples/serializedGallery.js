'use strict';

const { createThatPrototypeInventory } = require('../core/inventory');
const { createPatchMachineFromSerializedPatch, PATCH_SCHEMA_VERSION, DEFAULT_INVENTORY_NAME } = require('../core/serialization');
const { runMode, MODES } = require('../core/modes');
const { dampedOscillationSerializedPatch } = require('./dampedOscillation');
const { firstStepsRadioactiveDecaySerializedPatch, firstStepsMassSpringDamperSerializedPatch, firstStepsLunarLandingSerializedPatch, firstStepsNeuronalBurstingSerializedPatch, firstStepsEulerSpiralSerializedPatch, firstStepsHunterPreySerializedPatch, firstStepsLorenzAttractorSerializedPatch, firstStepsBouncingBallSerializedPatch, firstStepsPolynomialGeneratorSerializedPatch, firstStepsAdjustableMinusOnePlusOneSerializedPatch, firstStepsHelperMaxSerializedPatch, firstStepsHelperMinSerializedPatch, firstStepsHelperAbsSerializedPatch, firstStepsHelperNonNegativeOnlySerializedPatch } = require('./firstSteps');

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function basePatch(name, description, components, cables, outputs, parameters = {}) {
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name,
    description,
    components,
    cables,
    outputs,
    parameters,
  };
}

function staticInverterPatch() {
  return basePatch(
    'Static inverter and coefficient demo',
    'A small serialized patch that feeds +1 through a potentiometer and inverter, demonstrating coefficient scaling and sign reversal.',
    [
      { id: 'PLUS1' },
      { id: 'P1', coefficient: 0.6, label: 'P1 coefficient' },
      { id: 'INV1' },
      { id: 'OUT_Y', label: 'Y / inverted scaled signal' },
    ],
    [
      { from: 'PLUS1.out', to: 'P1.in', label: '+1 machine unit into coefficient' },
      { from: 'P1.out', to: 'INV1.in', label: 'scaled signal into inverter' },
      { from: 'INV1.out', to: 'OUT_Y.in', label: 'negative scaled signal to Y output' },
    ],
    { y: 'OUT_Y.out', scaled: 'P1.out', inverted: 'INV1.out' },
    { expectedY: -0.6 },
  );
}

function summerScalingPatch() {
  return basePatch(
    'Summer scaling and sign demo',
    'Combines a positive and a negative coefficient through a THAT-style negating summer.',
    [
      { id: 'PLUS1' },
      { id: 'MINUS1' },
      { id: 'P1', coefficient: 0.35, label: 'positive term' },
      { id: 'P2', coefficient: 0.2, label: 'negative term' },
      { id: 'SUM1' },
      { id: 'OUT_Y', label: 'Y / negated sum' },
    ],
    [
      { from: 'PLUS1.out', to: 'P1.in', label: '+0.35 term' },
      { from: 'MINUS1.out', to: 'P2.in', label: '-0.20 term' },
      { from: 'P1.out', to: 'SUM1.in1', label: 'first summer input' },
      { from: 'P2.out', to: 'SUM1.in2', label: 'second summer input' },
      { from: 'SUM1.out', to: 'OUT_Y.in', label: 'summer output to Y' },
    ],
    { y: 'OUT_Y.out', positiveTerm: 'P1.out', negativeTerm: 'P2.out', summer: 'SUM1.out' },
    { expectedY: -0.15 },
  );
}

function multiplierProductPatch() {
  return basePatch(
    'Multiplier product demo',
    'Uses two coefficient potentiometers and one multiplier to produce a normalized four-quadrant product.',
    [
      { id: 'PLUS1' },
      { id: 'MINUS1' },
      { id: 'P1', coefficient: 0.6, label: 'x coefficient' },
      { id: 'P2', coefficient: 0.4, label: 'y coefficient' },
      { id: 'MUL1' },
      { id: 'OUT_Y', label: 'Y / product' },
    ],
    [
      { from: 'PLUS1.out', to: 'P1.in', label: 'x = +0.6' },
      { from: 'MINUS1.out', to: 'P2.in', label: 'y = -0.4' },
      { from: 'P1.out', to: 'MUL1.x', label: 'multiplier x input' },
      { from: 'P2.out', to: 'MUL1.y', label: 'multiplier y input' },
      { from: 'MUL1.out', to: 'OUT_Y.in', label: 'product to Y output' },
    ],
    { y: 'OUT_Y.out', x: 'P1.out', yInput: 'P2.out', product: 'MUL1.out' },
    { expectedY: -0.24 },
  );
}

function comparatorSwitchPatch() {
  return basePatch(
    'Comparator switch demo',
    'Routes +1 or -1 according to the sign of a + b; the default coefficients make the positive branch active.',
    [
      { id: 'PLUS1' },
      { id: 'MINUS1' },
      { id: 'P1', coefficient: 0.3, label: 'positive compare term' },
      { id: 'P2', coefficient: 0.2, label: 'negative compare term' },
      { id: 'CMP1' },
      { id: 'OUT_Y', label: 'Y / selected branch' },
    ],
    [
      { from: 'PLUS1.out', to: 'P1.in', label: 'a = +0.3' },
      { from: 'MINUS1.out', to: 'P2.in', label: 'b = -0.2' },
      { from: 'P1.out', to: 'CMP1.a', label: 'first sign-test input' },
      { from: 'P2.out', to: 'CMP1.b', label: 'second sign-test input' },
      { from: 'PLUS1.out', to: 'CMP1.positive', label: 'selected when a + b > 0' },
      { from: 'MINUS1.out', to: 'CMP1.nonPositive', label: 'selected when a + b <= 0' },
      { from: 'CMP1.out', to: 'OUT_Y.in', label: 'selected signal to Y output' },
    ],
    { y: 'OUT_Y.out', compareA: 'P1.out', compareB: 'P2.out', selected: 'CMP1.out' },
    { expectedY: 1 },
  );
}

function xirSummerPatch() {
  return basePatch(
    'XIR summing-junction extension demo',
    'Adds one ordinary summer input and one x10 XIR contribution through the summer summing junction.',
    [
      { id: 'PLUS1' },
      { id: 'P1', coefficient: 0.2, label: 'ordinary summer term' },
      { id: 'P2', coefficient: 0.03, label: 'XIR x10 term source' },
      { id: 'XIR1' },
      { id: 'SUM1' },
      { id: 'OUT_Y', label: 'Y / summer plus XIR' },
    ],
    [
      { from: 'PLUS1.out', to: 'P1.in', label: 'ordinary +0.20 input' },
      { from: 'PLUS1.out', to: 'P2.in', label: 'source for x10 XIR input' },
      { from: 'P1.out', to: 'SUM1.in1', label: 'ordinary summer contribution' },
      { from: 'P2.out', to: 'XIR1.in10_1', label: '0.03 through x10 input gives 0.30' },
      { from: 'XIR1.out', to: 'SUM1.sj', label: 'XIR output into summing junction' },
      { from: 'SUM1.out', to: 'OUT_Y.in', label: 'negated total to Y output' },
    ],
    { y: 'OUT_Y.out', xirContribution: 'XIR1.out', summer: 'SUM1.out' },
    { expectedY: -0.5 },
  );
}

function slowRampPatch() {
  return basePatch(
    'Slow integrator ramp demo',
    'Feeds -1 into an integrator with the slow socket active, producing a slow positive ramp in normalized machine units.',
    [
      { id: 'MINUS1' },
      { id: 'I1' },
      { id: 'OUT_Y', label: 'Y / slow ramp' },
    ],
    [
      { from: 'MINUS1.out', to: 'I1.in1', label: 'negative input produces positive ramp' },
      { from: 'I1.out', to: 'I1.slow', label: 'activate slow-mode approximation with OUT-to-SLOW feedback' },
      { from: 'I1.out', to: 'OUT_Y.in', label: 'integrator state to Y output' },
    ],
    { y: 'OUT_Y.out', ramp: 'I1.out' },
    { expectedFinalYAt10: 0.1 },
  );
}

const QUICK_START_BOOKLET_EXAMPLE_IDS = Object.freeze([
  'first-steps-radioactive-decay',
  'first-steps-mass-spring-damper',
  'first-steps-lunar-landing',
  'first-steps-neuronal-bursting',
  'first-steps-euler-spiral',
  'first-steps-hunter-prey',
  'first-steps-lorenz-attractor',
  'first-steps-bouncing-ball',
  'first-steps-polynomial-generator',
  'first-steps-helper-max',
  'first-steps-helper-min',
  'first-steps-helper-abs',
  'first-steps-helper-adjustable-minus-one-plus-one',
  'first-steps-helper-non-negative-only',
]);
const QUICK_START_BOOKLET_EXAMPLE_ID_SET = new Set(QUICK_START_BOOKLET_EXAMPLE_IDS);

function isQuickStartBookletExampleId(id) {
  return QUICK_START_BOOKLET_EXAMPLE_ID_SET.has(String(id || ''));
}

const SERIALIZED_GALLERY_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'quickstart-damped-oscillation',
    title: 'Quickstart damped oscillation',
    category: 'dynamic system',
    description: 'The main prototype target, using two integrators, one inverter, three coefficients, and a negating summer.',
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 8, cycles: 3, dt: 0.01, sampleEvery: 50 }),
    patchFactory: () => dampedOscillationSerializedPatch({ k: 0.5, d: 0.5, invMass: 0.5 }),
  }),
  Object.freeze({
    id: 'first-steps-radioactive-decay',
    title: 'First Steps: Radioactive Decay',
    category: 'First Steps application',
    description: 'Booklet Section 9.1: one-integrator exponential decay using P1 for N0, P2 for lambda, and OUT X for N.',
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 8, cycles: 3, dt: 0.01, sampleEvery: 50 }),
    patchFactory: () => firstStepsRadioactiveDecaySerializedPatch({ n0: 0.5, lambda: 0.5 }),
  }),
  Object.freeze({
    id: 'first-steps-mass-spring-damper',
    title: 'First Steps: Mass-Spring-Damper System',
    category: 'First Steps application',
    description: 'Booklet Section 9.2: two-integrator underdamped suspension with P1/P2/P3/P4 for y0, s, D, and 1/m.',
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 0.08, cycles: 3, dt: 0.0001, sampleEvery: 25 }),
    patchFactory: () => firstStepsMassSpringDamperSerializedPatch({ y0: 0.5, spring: 0.5, damping: 0.05, inverseMass: 0.5 }),
  }),
  Object.freeze({
    id: 'first-steps-lunar-landing',
    title: 'First Steps: Lunar Landing',
    category: 'First Steps application',
    description: 'Booklet Section 9.3: powered lunar descent with P1 live throttle, altitude on OUT X, vertical velocity on OUT Y, and fuel on OUT U.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 10, dt: 0.002, sampleEvery: 25 }),
    patchFactory: () => firstStepsLunarLandingSerializedPatch({ throttle: 0.5, thrustScale: 0.1, gravity: 0.05, gravityStage: 0.05, fuelEfficiency: 0.5, altitudeCoefficientA: 0.05, altitudeCoefficientB: 0.05, initialAltitude: 1, initialFuel: 1 }),
  }),
  Object.freeze({
    id: 'first-steps-neuronal-bursting',
    title: 'First Steps: Neuronal Bursting',
    category: 'First Steps application',
    description: 'Booklet Section 9.4: scaled Hindmarsh-Rose neuronal bursting patch with x on OUT X, y on OUT Y, -z on OUT Z, x10-weighted terms, XIR/SJ input extension, and SLOW z-channel behavior.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 40, dt: 0.002, sampleEvery: 25 }),
    patchFactory: () => firstStepsNeuronalBurstingSerializedPatch({ x0: 1, z0: 1, bStar10: 0.6, aStar10: 0.4, yToX10: 0.75, hundredR: 0.1, hundredRs: 0.4, hundredRsXr: 0.32, c: 0.066, dStar10: 0.133, iExt: 1, timeScale: 50 }),
  }),
  Object.freeze({
    id: 'first-steps-euler-spiral',
    title: 'First Steps: Euler Spiral',
    category: 'First Steps application',
    description: 'Booklet Section 9.5: normalized tau sweep, OP-TIME-aware phase centering, and a two-arm Euler-spiral scope trace.',
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 120, cycles: 1, dt: 0.005, sampleEvery: 20 }),
    patchFactory: () => firstStepsEulerSpiralSerializedPatch({ tauRate: 0.1, xScale: 0.6, yScale: 0.6, opTimeSeconds: 120 }),
  }),
  Object.freeze({
    id: 'first-steps-hunter-prey',
    title: 'First Steps: Hunter/Prey Population Dynamics',
    category: 'First Steps application',
    description: 'Booklet Section 9.6: Lotka-Volterra hare/lynx dynamics with h on OUT X and l on OUT Y; default display is the booklet roll-mode time trace, with X/Y phase view available manually.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 100, dt: 0.01, sampleEvery: 5 }),
    patchFactory: () => firstStepsHunterPreySerializedPatch({ h0: 0.6, l0: 0.6, alpha: 0.365, beta: 0.95, gamma: 0.09, delta: 0.84 }),
  }),
  Object.freeze({
    id: 'first-steps-lorenz-attractor',
    title: 'First Steps: Lorenz Attractor',
    category: 'First Steps application',
    description: 'Booklet Section 9.7: Lorenz chaotic attractor with x/y/z outputs and projection-ready X/Y, Z/X, and Z/Y display presets.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 300, dt: 0.01, sampleEvery: 5 }),
    patchFactory: () => firstStepsLorenzAttractorSerializedPatch({ x0: 0.18, yToXCoefficient: 0.18, xyCoefficient: 0.15, zDamping: 0.2667, zShapeCoefficient: 0.268, rCoefficient: 0.1536, yDamping: 0.1 }),
  }),
  Object.freeze({
    id: 'first-steps-bouncing-ball',
    title: 'First Steps: Bouncing Ball',
    category: 'First Steps application',
    description: 'Booklet Section 9.8: passive-accessory rebound approximation with capacitors for x/vx/y/vy, diode/Z-diode wall/floor contact detectors, and inverted OUT Y display so the bounce appears at the bottom.',
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 20, cycles: 1, dt: 0.001, sampleEvery: 20 }),
    patchFactory: () => firstStepsBouncingBallSerializedPatch({}),
  }),
  Object.freeze({
    id: 'first-steps-polynomial-generator',
    title: 'First Steps: Polynomial Generator',
    category: 'First Steps application',
    description: 'Booklet Section 9.9: x, -x², x³ generation plus coefficient terms d, cx, bx², and ax³ for p(x).',
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 2, cycles: 2, dt: 0.001, sampleEvery: 20 }),
    patchFactory: () => firstStepsPolynomialGeneratorSerializedPatch({ rampRate: 1, a: -0.3, b: 0.4, c: 0.7, d: 0.1 }),
  }),
  Object.freeze({
    id: 'first-steps-helper-adjustable-minus-one-plus-one',
    title: 'First Steps Helper: Adjustable Value -1 to +1',
    category: 'First Steps helper',
    description: 'Booklet Section 10.4: map one coefficient knob over the full machine-unit interval using 2*k - 1.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: () => firstStepsAdjustableMinusOnePlusOneSerializedPatch({ valueCoefficient: 0.5 }),
  }),
  Object.freeze({
    id: 'first-steps-helper-max',
    title: 'First Steps Helper: Maximum of Two Values',
    category: 'First Steps helper',
    description: 'Booklet Section 10.1: comparator helper selecting max(A,B).',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: () => firstStepsHelperMaxSerializedPatch({ a: 0.25, b: -0.4 }),
  }),
  Object.freeze({
    id: 'first-steps-helper-min',
    title: 'First Steps Helper: Minimum of Two Values',
    category: 'First Steps helper',
    description: 'Booklet Section 10.2: comparator helper selecting min(A,B).',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: () => firstStepsHelperMinSerializedPatch({ a: 0.25, b: -0.4 }),
  }),
  Object.freeze({
    id: 'first-steps-helper-abs',
    title: 'First Steps Helper: Absolute Value',
    category: 'First Steps helper',
    description: 'Booklet Section 10.3: comparator helper selecting A or -A.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: () => firstStepsHelperAbsSerializedPatch({ a: -0.4 }),
  }),
  Object.freeze({
    id: 'first-steps-helper-non-negative-only',
    title: 'First Steps Helper: Non-Negative Values Only',
    category: 'First Steps helper',
    description: 'Booklet Section 10.5: comparator helper clamping negative values to zero.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: () => firstStepsHelperNonNegativeOnlySerializedPatch({ a: -0.4 }),
  }),
  Object.freeze({
    id: 'static-inverter',
    title: 'Static inverter and coefficient',
    category: 'linear block',
    description: 'A minimal patch showing coefficient scaling followed by sign inversion.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: staticInverterPatch,
  }),
  Object.freeze({
    id: 'summer-scaling',
    title: 'Summer scaling and sign',
    category: 'linear block',
    description: 'A negating summer combines a positive and a negative term.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: summerScalingPatch,
  }),
  Object.freeze({
    id: 'multiplier-product',
    title: 'Multiplier product',
    category: 'nonlinear block',
    description: 'The multiplier computes a normalized four-quadrant product from two coefficient-scaled constants.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: multiplierProductPatch,
  }),
  Object.freeze({
    id: 'comparator-switch',
    title: 'Comparator switch',
    category: 'hybrid-style block',
    description: 'The comparator selects one of two analog branches based on the sign of a + b.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: comparatorSwitchPatch,
  }),
  Object.freeze({
    id: 'xir-summing-junction',
    title: 'XIR summing-junction extension',
    category: 'patch expansion',
    description: 'An XIR resistor network contributes an extra weighted term through a summer summing junction.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactory: xirSummerPatch,
  }),
  Object.freeze({
    id: 'slow-integrator-ramp',
    title: 'Slow integrator ramp',
    category: 'dynamic system',
    description: 'A single integrator demonstrates the slow-mode approximation and IC reset behavior.',
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 10, dt: 0.01, sampleEvery: 100 }),
    patchFactory: slowRampPatch,
  }),
]);

function materializeExample(definition) {
  const patch = definition.patchFactory();
  return {
    id: definition.id,
    title: definition.title,
    category: definition.category,
    description: definition.description,
    defaultMode: definition.defaultMode,
    runOptions: clonePlain(definition.runOptions),
    patch: clonePlain(patch),
  };
}

function getSerializedGalleryExamples(options = {}) {
  const definitions = options.includeNonBookletExamples ? SERIALIZED_GALLERY_DEFINITIONS : SERIALIZED_GALLERY_DEFINITIONS.filter((entry) => isQuickStartBookletExampleId(entry.id));
  return definitions.map(materializeExample);
}

function listSerializedGalleryExamples(options = {}) {
  return getSerializedGalleryExamples(options).map((example) => ({
    id: example.id,
    title: example.title,
    category: example.category,
    description: example.description,
    defaultMode: example.defaultMode,
    componentCount: example.patch.components.length,
    cableCount: example.patch.cables.length,
    outputs: Object.keys(example.patch.outputs || {}),
  }));
}

function getSerializedGalleryExample(id) {
  const definition = SERIALIZED_GALLERY_DEFINITIONS.find((entry) => entry.id === id) || SERIALIZED_GALLERY_DEFINITIONS.find((entry) => isQuickStartBookletExampleId(entry.id)) || SERIALIZED_GALLERY_DEFINITIONS[0];
  return materializeExample(definition);
}

function getSerializedGalleryPatch(id) {
  return getSerializedGalleryExample(id).patch;
}

function createSerializedGalleryMachine(id, options = {}) {
  const inventory = options.inventory || createThatPrototypeInventory();
  return createPatchMachineFromSerializedPatch(getSerializedGalleryPatch(id), { inventory });
}

function runSerializedGalleryExample(id, options = {}) {
  const example = getSerializedGalleryExample(id);
  const machine = createSerializedGalleryMachine(example.id, options);
  const runOptions = Object.assign({}, example.runOptions, options.runOptions || {}, {
    mode: options.mode || example.defaultMode,
  });
  const result = runMode(machine, runOptions);
  return {
    example: {
      id: example.id,
      title: example.title,
      category: example.category,
      description: example.description,
    },
    patch: example.patch,
    parameters: machine.parameters,
    result,
  };
}

module.exports = {
  QUICK_START_BOOKLET_EXAMPLE_IDS,
  isQuickStartBookletExampleId,
  SERIALIZED_GALLERY_DEFINITIONS,
  getSerializedGalleryExamples,
  listSerializedGalleryExamples,
  getSerializedGalleryExample,
  getSerializedGalleryPatch,
  createSerializedGalleryMachine,
  runSerializedGalleryExample,
};
