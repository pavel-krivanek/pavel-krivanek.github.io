#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const {
  PatchMachine,
  CoefficientPotentiometer,
  Inverter,
  Summer,
  Integrator,
  Diode,
  ZDiode,
  Capacitor,
  Multiplier,
  Comparator,
  XirNetwork,
  almostEqual,
  createDampedOscillationMachine,
  runOp,
  runRepf,
  runMode,
  OperationController,
  MODES,
  createThatPrototypeInventory,
  dampedOscillationSerializedPatch,
  patchDefinitionFromSerializedPatch,
  createPatchMachineFromSerializedPatch,
  loadPatchJson,
  savePatchJson,
  PATCH_SCHEMA_VERSION,
  getSerializedGalleryExamples,
  listSerializedGalleryExamples,
  getSerializedGalleryPatch,
  createSerializedGalleryMachine,
  runSerializedGalleryExample,
  FIRST_STEPS_COVERAGE_SCHEMA_VERSION,
  listFirstStepsCoverage,
  getFirstStepsCoverageEntry,
  getFirstStepsPatch,
  createFirstStepsMachine,
  runFirstStepsExample,
  summarizeFirstStepsCoverage,
  QUICK_START_BOOKLET_EXAMPLE_IDS,
  FIRST_STEPS_SCOPE_CHECK_SCHEMA_VERSION,
  EXPECTED_SCOPE_OUTPUTS,
  DEFAULT_SCOPE_RUN_OPTIONS,
  HELPER_SCOPE_SWEEP_CASES,
  summarizeFirstStepsScopeChecks,
  runFirstStepsScopeCheck,
  firstStepsMassSpringDamperSerializedPatch,
  firstStepsEulerSpiralSerializedPatch,
  eulerSpiralReferenceStateAt,
  eulerSpiralCenteredSweepParameters,
  hunterPreyReferenceStateAt,
  lorenzReferenceStateAt,
  bouncingBallReferenceStateAt,
  lunarLandingReferenceStateAt,
  neuronalBurstingReferenceStateAt,
  polynomialGeneratorReferenceStateAt,
  firstStepsHelperReferenceValue,
  coefficientForMachineUnitValue,
  underdampedDisplacementAt,
  createMultiBoardSystem,
  createMultiBoardPatchDefinition,
  prefixSocketId,
  machineUnitToShiftedHybridVolts,
  shiftedHybridVoltsToMachineUnit,
  outputDetailsToHybridFrame,
  modeFromHybridPins,
  HybridPortAdapter,
  twoBoardMinionSystemDefinition,
  createTwoBoardMinionSystem,
  runTwoBoardMinionDemo,
  normalizeImperfectionSpec,
  withImperfections,
  runImperfectionDemo,
  DESIGN_SCHEMA_VERSION,
  normalizeDesign,
  designFromSerializedPatch,
  serializedPatchFromDesign,
  createPatchMachineFromDesign,
  designRoundTripPayload,
  summarizeDesign,
  COEFFICIENT_CONTROL_IDS,
  coefficientControlsFromPreset,
  controlStateFromPatch,
  patchWithControlState,
  controlWarnings,
  PHYSICAL_SOCKET_SCHEMA_VERSION,
  createThatPhysicalSocketMap,
  validatePhysicalSocketMap,
  summarizePhysicalSocketMap,
  physicalSocketById,
  physicalSocketsByLogicalSocketId,
  logicalSocketIdFromPhysical,
  preferredPhysicalSocketsForLogical,
  physicalizeDesignCables,
  validateCustomDesign,
  summarizeDesignValidation,
  diagnosticCodes,
  validationAttributesForCable,
  diagnosticCssClassForCable,
  DESIGN_TRACE_SCHEMA_VERSION,
  compileDesignForRuntime,
  normalizeDesignRunOptions,
  availableDesignOutputNames,
  selectedOutputNamesFromDesign,
  runCustomDesign,
  summarizeDesignRunResult,
  designTraceExportPayload,
  compareDesignExecutionWithPatch,
  DESIGN_DRAFT_SCHEMA_VERSION,
  DEFAULT_DRAFT_KEY,
  createDesignExportPayload,
  parseDesignImportText,
  smokeTestDesignImportExport,
  memoryDraftStorage,
  saveDesignDraft,
  loadDesignDraft,
  clearDesignDraft,
  listDesignGalleryEntries,
  loadDesignGalleryDesign,
  summarizeDesignGallery,
  TEMPLATE_SCHEMA_VERSION,
  listDesignTemplateEntries,
  loadDesignTemplate,
  instantiateDesignTemplate,
  templateWalkthroughText,
  summarizeDesignTemplate,
  validateDesignTemplate,
  runDesignTemplate,
  verifyDesignTemplates,
  ACCESSORY_SCHEMA_VERSION,
  listPanelAccessories,
  summarizePanelAccessories,
  accessoryByTerminalId,
  summarizeAccessoryUse,
  materializePhysicalAccessoriesFromDesign,
  previewPhysicalAccessoryMaterialization,
  accessoryPairGuidance,
  accessoryPairGuidanceForPhysicalSocketId,
  findXirSjHelpers,
  feedbackSocketSemantics,
  evaluateIdealDiode,
  evaluateZDiode,
  capacitorChargeDelta,
  USABILITY_SCHEMA_VERSION,
  PANEL_ZOOM_PRESETS,
  panelViewportForPreset,
  panPanelViewport,
  zoomPanelViewport,
  socketAccessibilityLabel,
  cableAccessibilityLabel,
  socketVisualState,
  orderedKeyboardSockets,
  nextKeyboardSocket,
  summarizeSocketVisualStates,
  designUsabilitySummary,
  manualBrowserSmokeChecklist,
  architectureOverview,
  PANEL_POLISH_SCHEMA_VERSION,
  sectionSpecs,
  socketLabelPlacement,
  socketRenderSpec,
  cableRouteSpec,
  panelPolishSummary,
  designPanelModelFromDesign,
  templatePanelModel,
  verifyTemplatePanelModels,
  panelOverlayForDesign,
  templatePanelOverlay,
  panelOverlayLegend,
  templateGuidedEditingPlan,
  DESIGN_REPAIR_SCHEMA_VERSION,
  REPAIR_SESSION_DRAFT_SCHEMA_VERSION,
  DEFAULT_REPAIR_SESSION_DRAFT_KEY,
  repairActionsForValidation,
  repairSummaryForValidation,
  designChangeSummary,
  previewRepairAction,
  previewRepairActionsForValidation,
  guidedRepairWorkflowForValidation,
  previewGuidedRepairBatch,
  applyGuidedRepairBatch,
  repairBatchSummary,
  createGuidedRepairSession,
  nextPendingRepairSessionStep,
  applyNextGuidedRepairSessionStep,
  skipGuidedRepairSessionStep,
  applyAllGuidedRepairSessionSteps,
  repairSessionSummary,
  serializeGuidedRepairSession,
  parseGuidedRepairSessionText,
  saveGuidedRepairSessionDraft,
  loadGuidedRepairSessionDraft,
  clearGuidedRepairSessionDraft,
  applyGuidedRepairStep,
  applyRepairAction,
  applyFirstRepairForCode,
  DESIGN_HISTORY_SCHEMA_VERSION,
  createDesignHistoryState,
  recordDesignHistory,
  undoDesignHistory,
  redoDesignHistory,
  markDesignHistorySaved,
  designHistorySummary,
  withDesignCoefficient,
  withDesignOutputRoute,
  withAddedDesignCable,
  withoutDesignCable,
  ADOPTED_PATCH_EDITOR_VERSION,
  ADOPTED_WIRING_SCHEMA,
  listAdoptedPanelConnectors,
  createConnectorPhysicalBridge,
  normalizeAdoptedWiring,
  adoptedWiringToDesign,
  createAdoptedEditorSummary,
} = require('../src');
const browserApp = require('../src/browser/oscilloscopeApp');
const patchPanelApp = require('../src/browser/patchPanelApp');
const patchEditorApp = require('../src/browser/patchEditorApp');
const patchTemplatesApp = require('../src/browser/patchTemplatesApp');
const browserPatchRuntime = require('../src/browser/browserPatchRuntime');
const serializedGalleryApp = require('../src/browser/serializedGalleryApp');
const cableInteractionApp = require('../src/browser/cableInteractionApp');
const educationApp = require('../src/browser/educationApp');
const packagingApp = require('../src/browser/packagingApp');
const customDesignApp = require('../src/browser/customDesignApp');
const deviceWorkbenchApp = require('../src/browser/deviceWorkbenchApp');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function assertAlmost(actual, expected, tolerance = 1e-9) {
  assert.ok(
    almostEqual(actual, expected, tolerance),
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}


function expectedEulerFromPatch(patch, opTime) {
  const centered = (patch.parameters && patch.parameters.centeredSweep) || eulerSpiralCenteredSweepParameters({ opTimeSeconds: opTime });
  return eulerSpiralReferenceStateAt(opTime, {
    rampRate: centered.rampRate,
    tau0: centered.normalizedTauStart,
    oscillatorRate: centered.oscillatorRate,
    cos0: centered.cos0,
    minusSin0: centered.minusSin0,
    xScale: centered.xScale,
    yScale: centered.yScale,
    coordinateRate: centered.coordinateRate,
    x0: centered.x0,
    y0: centered.y0,
  });
}

function assertEulerTraceIsCentered(trace, centered, tolerance = 1e-9) {
  const first = trace[0];
  const middle = trace.find((point) => Math.abs(point.outputs.tau) < 1e-9) || trace[Math.floor(trace.length / 2)];
  const final = trace[trace.length - 1];
  assertAlmost(first.outputs.x, centered.x0, tolerance);
  assertAlmost(first.outputs.y, centered.y0, tolerance);
  assert.ok(first.outputs.x < 0 && first.outputs.y < 0);
  assertAlmost(middle.outputs.x, 0, 1e-7);
  assertAlmost(middle.outputs.y, 0, 1e-7);
  assert.ok(final.outputs.x > 0 && final.outputs.y > 0);
  assertAlmost(final.outputs.x, centered.expectedCenteredFinalX, 1e-7);
  assertAlmost(final.outputs.y, centered.expectedCenteredFinalY, 1e-7);
}

function maxAbs(points, selector) {
  return Math.max(...points.map((point) => Math.abs(selector(point))));
}

function hasSignChange(values) {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i - 1] === 0 || values[i] === 0) continue;
    if (Math.sign(values[i - 1]) !== Math.sign(values[i])) return true;
  }
  return false;
}

test('coefficient potentiometer scales input by coefficient', () => {
  const pot = new CoefficientPotentiometer({ id: 'P', type: 'potentiometer', coefficient: 0.25 });
  const inputs = new Map([['P.in', 0.8]]);
  assertAlmost(pot.evaluateStateless(inputs).get('P.out'), 0.2);
});

test('inverter negates input', () => {
  const inverter = new Inverter({ id: 'INV', type: 'inverter' });
  const inputs = new Map([['INV.in', 0.3]]);
  assertAlmost(inverter.evaluateStateless(inputs).get('INV.out'), -0.3);
});

test('summer emits negative weighted sum', () => {
  const summer = new Summer({ id: 'S', type: 'summer', inputs: [{ name: 'a', weight: 1 }, { name: 'b', weight: 10 }] });
  const inputs = new Map([['S.a', 0.2], ['S.b', 0.03]]);
  assertAlmost(summer.evaluateStateless(inputs).get('S.out'), -0.5);
});

test('integrator derivative is negative weighted input', () => {
  const integrator = new Integrator({ id: 'I', type: 'integrator', inputs: [{ name: 'in1', weight: 1 }] });
  const inputs = new Map([['I.in1', 0.25]]);
  assertAlmost(integrator.derivative(inputs), -0.25);
});

test('integrator IC input sets state with opposite sign', () => {
  const integrator = new Integrator({ id: 'I', type: 'integrator' });
  const inputs = new Map([['I.ic', 1]]);
  assertAlmost(integrator.stateFromIc(inputs), -1);
});

test('multiplier emits four-quadrant product', () => {
  const multiplier = new Multiplier({ id: 'M', type: 'multiplier' });
  const inputs = new Map([['M.x', -0.5], ['M.y', 0.4]]);
  assertAlmost(multiplier.evaluateStateless(inputs).get('M.out'), -0.2);
});

test('comparator selects positive or non-positive input by sign of a plus b', () => {
  const comparator = new Comparator({ id: 'CMP', type: 'comparator' });
  const high = new Map([['CMP.a', 0.4], ['CMP.b', -0.1], ['CMP.positive', 0.7], ['CMP.nonPositive', -0.2]]);
  const low = new Map([['CMP.a', 0.1], ['CMP.b', -0.2], ['CMP.positive', 0.7], ['CMP.nonPositive', -0.2]]);
  assertAlmost(comparator.evaluateStateless(high).get('CMP.out'), 0.7);
  assertAlmost(comparator.evaluateStateless(low).get('CMP.out'), -0.2);
});

test('passive accessory components expose idealized diode Z-diode and capacitor runtime behavior', () => {
  const diode = new Diode({ id: 'D', type: 'diode', forwardDrop: 0.1 });
  assertAlmost(diode.evaluateStateless(new Map([['D.in', 0.5], ['D.reference', 0.2]])).get('D.out'), 0.2);
  assertAlmost(diode.evaluateStateless(new Map([['D.in', 0.2], ['D.reference', 0.5]])).get('D.out'), 0);
  const zPositive = new ZDiode({ id: 'ZD', type: 'z-diode', zenerVoltage: 1, mode: 'positive-overdrive' });
  const zNegative = new ZDiode({ id: 'ZN', type: 'z-diode', zenerVoltage: 1, mode: 'negative-overdrive' });
  assertAlmost(zPositive.evaluateStateless(new Map([['ZD.in', 1.25]])).get('ZD.out'), 0.25);
  assertAlmost(zNegative.evaluateStateless(new Map([['ZN.in', -1.4]])).get('ZN.out'), 0.4);
  const capacitor = new Capacitor({ id: 'CAP', type: 'capacitor', initialState: 0.25, inputs: [{ name: 'in', weight: 2, required: false }] });
  assertAlmost(capacitor.derivative(new Map([['CAP.in', 0.1]])), 0.2);
  assertAlmost(capacitor.stateFromIc(new Map()), 0.25);
  assertAlmost(capacitor.stateFromIc(new Map([['CAP.ic', -0.3]])), -0.3);
});

test('XIR network contributes weighted sum to a summer summing junction', () => {
  const xir = new XirNetwork({ id: 'XIR', type: 'xir', inputs: [{ name: 'a', weight: 1 }, { name: 'b', weight: 10 }] });
  const xirOut = xir.evaluateStateless(new Map([['XIR.a', 0.2], ['XIR.b', 0.03]])).get('XIR.out');
  assertAlmost(xirOut, 0.5);
  const machine = new PatchMachine({
    name: 'xir summing-junction smoke test',
    components: [
      { id: 'C1', type: 'constant', value: 0.2 },
      { id: 'C2', type: 'constant', value: 0.03 },
      { id: 'C3', type: 'constant', value: 0.1 },
      { id: 'XIR', type: 'xir', inputs: [{ name: 'a', weight: 1 }, { name: 'b', weight: 10 }] },
      { id: 'SUM', type: 'summer', inputs: [{ name: 'in1', weight: 1 }] },
    ],
    connections: [
      { from: 'C1.out', to: 'XIR.a' },
      { from: 'C2.out', to: 'XIR.b' },
      { from: 'C3.out', to: 'SUM.in1' },
      { from: 'XIR.out', to: 'SUM.sj' },
    ],
    outputs: { y: 'SUM.out' },
  });
  assertAlmost(machine.evaluate({}).outputs.y, -0.6);
});

test('slow integrator socket applies approximately 100x slower derivative', () => {
  const integrator = new Integrator({ id: 'I', type: 'integrator', inputs: [{ name: 'in1', weight: 1 }], slowFactor: 100 });
  assertAlmost(integrator.derivative(new Map([['I.in1', 0.5]])), -0.5);
  assertAlmost(integrator.derivative(new Map([['I.in1', 0.5], ['I.slow', 1]])), -0.005);
});

test('patch evaluator supports output fan-out and a data-defined network', () => {
  const machine = new PatchMachine({
    name: 'fanout smoke test',
    components: [
      { id: 'C', type: 'constant', value: 0.4 },
      { id: 'A', type: 'inverter' },
      { id: 'B', type: 'potentiometer', coefficient: 0.5 },
    ],
    connections: [
      { from: 'C.out', to: 'A.in' },
      { from: 'C.out', to: 'B.in' },
    ],
    outputs: { a: 'A.out', b: 'B.out' },
  });
  const evaluated = machine.evaluate({});
  assertAlmost(evaluated.outputs.a, -0.4);
  assertAlmost(evaluated.outputs.b, 0.2);
});

test('damped oscillator IC state follows THAT sign convention', () => {
  const machine = createDampedOscillationMachine();
  const state = machine.applyInitialConditions();
  assertAlmost(state.I1, -1);
  assertAlmost(state.I2, 0);
});

test('damped oscillator default OP trace crosses zero and decays', () => {
  const machine = createDampedOscillationMachine({ k: 0.5, d: 0.5, invMass: 0.5 });
  const result = runOp(machine, { duration: 40, dt: 0.01, sampleEvery: 10 });
  const velocity = result.trace.map((point) => point.outputs.velocity);
  assert.ok(hasSignChange(velocity), 'velocity should cross zero');
  const firstHalf = result.trace.slice(0, Math.floor(result.trace.length / 2));
  const secondHalf = result.trace.slice(Math.floor(result.trace.length / 2));
  assert.ok(maxAbs(secondHalf, (point) => point.outputs.velocity) < maxAbs(firstHalf, (point) => point.outputs.velocity));
  assert.ok(result.trace.some((point) => Math.abs(point.outputs.position) > 0.1), 'position should move away from zero');
});

test('REPF mode resets cycle starts repeatably', () => {
  const machine = createDampedOscillationMachine();
  const result = runRepf(machine, { cycles: 3, opTime: 8, dt: 0.01, sampleEvery: 50 });
  const triggers = result.trace.filter((point) => point.trigger);
  assert.strictEqual(triggers.length, 3);
  for (const trigger of triggers) {
    assertAlmost(trigger.state.I1, -1);
    assertAlmost(trigger.state.I2, 0);
    assertAlmost(trigger.outputs.velocity, 1);
  }
});



test('operation controller IC mode resets all integrator states', () => {
  const machine = createDampedOscillationMachine();
  const controller = new OperationController(machine, { initialState: { I1: 0.25, I2: -0.25 } });
  const result = controller.runIc();
  assert.strictEqual(result.mode, MODES.IC);
  assertAlmost(result.finalState.I1, -1);
  assertAlmost(result.finalState.I2, 0);
  assert.strictEqual(result.trace.length, 1);
  assert.strictEqual(result.trace[0].trigger, true);
});

test('operation controller OP mode advances the state from IC', () => {
  const machine = createDampedOscillationMachine();
  const controller = new OperationController(machine);
  const result = controller.runOp({ duration: 1, dt: 0.01, sampleEvery: 20 });
  assert.strictEqual(result.mode, MODES.OP);
  assert.ok(Math.abs(result.finalState.I1 + 1) > 1e-4, 'I1 should change during OP');
  assert.ok(Math.abs(result.finalState.I2) > 1e-4, 'I2 should change during OP');
  assert.ok(result.trace.every((point) => point.mode === MODES.OP));
});

test('operation controller HALT mode preserves state exactly', () => {
  const machine = createDampedOscillationMachine();
  const controller = new OperationController(machine);
  const initial = controller.enterIc().state;
  const result = controller.runHalt({ reset: false, duration: 5, dt: 0.01, sampleEvery: 25 });
  assert.strictEqual(result.mode, MODES.HALT);
  assert.deepStrictEqual(result.finalState, initial);
  for (const point of result.trace) {
    assert.deepStrictEqual(point.state, initial);
    assert.strictEqual(point.mode, MODES.HALT);
  }
});

test('runMode dispatches IC, OP, HALT, REP, and REPF', () => {
  const machine = createDampedOscillationMachine();
  assert.strictEqual(runMode(machine, { mode: MODES.IC }).mode, MODES.IC);
  assert.strictEqual(runMode(machine, { mode: MODES.OP, duration: 0.2, dt: 0.01, sampleEvery: 5 }).mode, MODES.OP);
  assert.strictEqual(runMode(machine, { mode: MODES.HALT, duration: 0.2, dt: 0.01, sampleEvery: 5 }).mode, MODES.HALT);
  assert.strictEqual(runMode(machine, { mode: MODES.REP, opTime: 0.2, cycles: 2, dt: 0.01, sampleEvery: 5 }).mode, MODES.REP);
  assert.strictEqual(runMode(machine, { mode: MODES.REPF, opTime: 0.2, cycles: 2, dt: 0.01, sampleEvery: 5 }).mode, MODES.REPF);
});


test('browser prototype OP simulation crosses zero and decays', () => {
  const result = browserApp.simulateDampedOscillation({ mode: 'OP', duration: 40, dt: 0.01, sampleEvery: 10 });
  assert.strictEqual(result.mode, 'OP');
  assert.ok(browserApp.detectZeroCrossing(result.trace, 'velocity'), 'velocity should cross zero');
  const firstHalf = result.trace.slice(0, Math.floor(result.trace.length / 2));
  const secondHalf = result.trace.slice(Math.floor(result.trace.length / 2));
  assert.ok(browserApp.peakMagnitude(secondHalf, 'velocity') < browserApp.peakMagnitude(firstHalf, 'velocity'));
});

test('browser prototype exposes IC, HALT, OP, and REPF modes', () => {
  const ic = browserApp.simulateDampedOscillation({ mode: 'IC' });
  const halt = browserApp.simulateDampedOscillation({ mode: 'HALT', duration: 1, dt: 0.01, sampleEvery: 10 });
  const op = browserApp.simulateDampedOscillation({ mode: 'OP', duration: 1, dt: 0.01, sampleEvery: 10 });
  const repf = browserApp.simulateDampedOscillation({ mode: 'REPF', opTime: 1, cycles: 3, dt: 0.01, sampleEvery: 10 });
  assert.strictEqual(ic.trace.length, 1);
  assert.ok(halt.trace.every((point) => JSON.stringify(point.state) === JSON.stringify(halt.trace[0].state)));
  assert.ok(op.trace.length > 1);
  assert.strictEqual(repf.trace.filter((point) => point.trigger).length, 3);
});

test('browser prototype summary reports overload and peaks', () => {
  const result = browserApp.simulateDampedOscillation({ mode: 'OP', k: 0.5, d: 0.5, invMass: 0.5, duration: 1, dt: 0.01, sampleEvery: 10 });
  const summary = browserApp.summarizeResult(result);
  assert.strictEqual(summary.overloaded, false);
  assert.ok(summary.peakVelocity > 0.5);
  assert.ok(summary.sampleCount > 10);
});

test('overload is flagged when a node leaves machine-unit range', () => {
  const machine = new PatchMachine({
    name: 'overload smoke test',
    components: [
      { id: 'C', type: 'constant', value: 0.9 },
      { id: 'S', type: 'summer', inputs: [{ name: 'a', weight: 10 }] },
    ],
    connections: [{ from: 'C.out', to: 'S.a' }],
    outputs: { y: 'S.out' },
  });
  const evaluated = machine.evaluate({});
  assert.strictEqual(evaluated.overload, true);
  assert.ok(evaluated.overloadedSockets.some((entry) => entry.socket === 'S.out'));
});

test('output details expose panel volts, RCA volts, and clipped display values', () => {
  const machine = new PatchMachine({
    name: 'output scaling smoke test',
    components: [{ id: 'C', type: 'constant', value: 1.25 }],
    connections: [],
    outputs: { y: 'C.out' },
  });
  const detail = machine.evaluate({}).outputDetails.y;
  assertAlmost(detail.machineUnit, 1.25);
  assertAlmost(detail.panelVolts, 12.5);
  assertAlmost(detail.rcaVolts, 1.25);
  assert.strictEqual(detail.overloaded, true);
  assertAlmost(detail.clippedMachineUnit, 1);
  assertAlmost(detail.clippedRcaVolts, 1);
});

test('optional clipping caps integrator state while flag-only mode can exceed range', () => {
  const machine = new PatchMachine({
    name: 'clipping smoke test',
    components: [
      { id: 'C', type: 'constant', value: -1 },
      { id: 'I', type: 'integrator', initialState: 0.95, inputs: [{ name: 'in1', weight: 1 }] },
    ],
    connections: [{ from: 'C.out', to: 'I.in1' }],
    outputs: { y: 'I.out' },
  });
  const unclipped = runOp(machine, { duration: 1, dt: 0.01, sampleEvery: 100, initialState: { I: 0.95 } });
  const clipped = runOp(machine, { duration: 1, dt: 0.01, sampleEvery: 100, initialState: { I: 0.95 }, clip: true });
  assert.ok(unclipped.finalState.I > 1, 'unclipped state should exceed machine-unit range');
  assertAlmost(clipped.finalState.I, 1);
  assert.strictEqual(clipped.clip, true);
});


test('prototype board inventory exposes explicit socket metadata and weighted inputs', () => {
  const inventory = createThatPrototypeInventory();
  const sockets = inventory.socketMetadata(['I1', 'SUM1', 'MUL1', 'CMP1', 'XIR1', 'OUT_X']);
  const byId = new Map(sockets.map((socket) => [socket.id, socket]));
  assert.strictEqual(byId.get('I1.in1').direction, 'input');
  assert.strictEqual(byId.get('I1.in1').weight, 1);
  assert.strictEqual(byId.get('I1.in10').weight, 10);
  assert.strictEqual(byId.get('SUM1.in10_1').weight, 10);
  assert.strictEqual(byId.get('MUL1.x').direction, 'input');
  assert.strictEqual(byId.get('CMP1.positive').direction, 'input');
  assert.strictEqual(byId.get('XIR1.in10_1').weight, 10);
  assert.strictEqual(byId.get('OUT_X.out').direction, 'output');
});

test('serialized damped oscillator patch rebuilds the same runnable machine', () => {
  const serialized = dampedOscillationSerializedPatch({ k: 0.5, d: 0.5, invMass: 0.5 });
  assert.strictEqual(serialized.schemaVersion, PATCH_SCHEMA_VERSION);
  const definition = patchDefinitionFromSerializedPatch(serialized, { inventory: createThatPrototypeInventory() });
  assert.ok(definition.components.some((component) => component.id === 'P1' && component.coefficient === 0.5));
  const machine = createPatchMachineFromSerializedPatch(serialized);
  const state = machine.applyInitialConditions();
  assertAlmost(state.I1, -1);
  assertAlmost(state.I2, 0);
  const result = runOp(machine, { duration: 40, dt: 0.01, sampleEvery: 10 });
  assert.ok(hasSignChange(result.trace.map((point) => point.outputs.velocity)), 'serialized patch velocity should cross zero');
});

test('patch JSON loading and saving round-trips user-readable serialized patches', () => {
  const dir = path.join(__dirname, '..', 'generated');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'roundtrip_damped_patch.json');
  const original = dampedOscillationSerializedPatch({ k: 0.4, d: 0.3, invMass: 0.7 });
  const saved = savePatchJson(file, original);
  const loaded = loadPatchJson(file);
  assert.deepStrictEqual(loaded.outputs, saved.outputs);
  assert.strictEqual(loaded.parameters.k, 0.4);
  const machine = loadPatchJson(file, { asMachine: true, inventory: createThatPrototypeInventory() });
  assert.strictEqual(machine.parameters.invMass, 0.7);
});

test('patch validation rejects missing required inputs', () => {
  assert.throws(() => new PatchMachine({
    name: 'missing input smoke test',
    components: [
      { id: 'C', type: 'constant', value: 1 },
      { id: 'INV', type: 'inverter' },
    ],
    connections: [],
    outputs: { y: 'INV.out' },
  }), /required input INV\.in is not connected/);
});

test('patch validation rejects stateless cycles without an integrator', () => {
  assert.throws(() => new PatchMachine({
    name: 'stateless cycle smoke test',
    components: [
      { id: 'A', type: 'inverter' },
      { id: 'B', type: 'inverter' },
    ],
    connections: [
      { from: 'A.out', to: 'B.in' },
      { from: 'B.out', to: 'A.in' },
    ],
    outputs: { y: 'A.out' },
  }), /stateless cycle detected/);
});


test('patch-panel gallery exposes runnable educational examples', () => {
  const examples = patchPanelApp.getGalleryExamples();
  assert.ok(examples.length >= 5, 'gallery should contain multiple presets');
  assert.ok(examples.some((example) => example.id === 'quickstart-default'));
  assert.ok(examples.every((example) => example.options && typeof example.options.k === 'number'));
  const applied = patchPanelApp.applyGalleryExampleToOptions({ mode: 'HALT', dt: 0.02 }, 'light-damping');
  assert.strictEqual(applied.mode, 'REPF');
  assert.strictEqual(applied.k, 0.5);
  assert.strictEqual(applied.d, 0.12);
});

test('patch-panel model validates the damped-oscillation wiring', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel({ activeExample: 'quickstart-default' });
  const validation = patchPanelApp.validatePanelModel(model);
  const summary = patchPanelApp.summarizePanelPatch(model);
  assert.strictEqual(validation.ok, true);
  assert.strictEqual(summary.componentCount, 34);
  assert.strictEqual(summary.cableCount, 11);
  assert.strictEqual(summary.componentTypes.integrator, 5);
  assert.strictEqual(summary.tutorialStepCount, 9);
  assert.strictEqual(summary.style, 'uploaded-reference-svg');
  assert.ok(summary.groupCount >= 9);
  assert.ok(summary.accessoryAreaCount >= 3);
});


test('physical socket layout keeps the inverter block on the uploaded SVG coordinate grid', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel({ activeExample: 'quickstart-default' });
  const sockets = model.physicalSockets || [];
  const byId = new Map(sockets.map((socket) => [socket.id, socket]));
  assert.strictEqual(model.width, 702.65399);
  assert.strictEqual(model.height, 514.23199);
  assert.strictEqual(byId.get('phys.inv1.sj').x, 601.37168);
  assert.strictEqual(byId.get('phys.inv1.in').x, 639.22339);
  assert.strictEqual(byId.get('phys.inv1.out').x, 676.71155);
  assert.deepStrictEqual([byId.get('phys.inv1.sj').y, byId.get('phys.inv2.sj').y, byId.get('phys.inv3.sj').y, byId.get('phys.inv4.sj').y], [214.08323, 251.86753, 289.97697, 327.71465]);
});


test('physical background SVG matches the uploaded THAT panel dimensions', () => {
  const root = path.resolve(__dirname, '..');
  const svg = fs.readFileSync(path.join(root, 'public', 'THAT_panel.svg'), 'utf8');
  assert.ok(/width="702\.65399"/.test(svg));
  assert.ok(/height="514\.23199"/.test(svg));
  assert.ok(/viewBox="-2 -2 707\.38676 517\.69563"/.test(svg));
  assert.ok((svg.match(/#d8bf88/g) || []).length >= 196);
  assert.ok(svg.includes('sodipodi:docname="THAT_panel.svg"'));
  assert.ok(svg.includes('<rect'));
});


test('physical background SVG is valid XML-compatible uploaded Inkscape SVG', () => {
  const root = path.resolve(__dirname, '..');
  const svgPath = path.join(root, 'public', 'THAT_panel.svg');
  const svg = fs.readFileSync(svgPath, 'utf8');
  assert.ok(svg.startsWith('<?xml version="1.0"'));
  assert.ok(svg.includes('xmlns:inkscape='));
  assert.ok(!svg.includes('><0</text>'));
});




test('physical socket map exposes one visible output jack per X/Y/Z/U attachment point', () => {
  const map = createThatPhysicalSocketMap();
  assert.deepStrictEqual(physicalSocketById(map, 'phys.out.x').position, { x: 612.29623, y: 477.29051 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.out.y').position, { x: 637.25624, y: 504.85789 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.out.z').position, { x: 667.0591, y: 477.29051 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.out.u').position, { x: 692.01924, y: 504.85789 });
});


test('physical socket metadata uses transformed SVG coordinates for bottom accessory and output jacks', () => {
  const map = createThatPhysicalSocketMap();
  assert.deepStrictEqual(physicalSocketById(map, 'phys.cap1.a').position, { x: 9.90793, y: 477.29051 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.cap5.b').position, { x: 253.91772, y: 504.85789 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.diode1.a').position, { x: 283.72058, y: 477.29051 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.diode4.b').position, { x: 472.96881, y: 504.85789 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.zdiode1.a').position, { x: 502.77101, y: 477.29051 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.zdiode2.b').position, { x: 582.49403, y: 504.85789 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.out.x').position, { x: 612.29623, y: 477.29051 });
  assert.deepStrictEqual(physicalSocketById(map, 'phys.out.u').position, { x: 692.01924, y: 504.85789 });
});


test('integrated connector endpoints use physical socket coordinates after SVG layout changes', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const catalog = cableInteractionApp.connectorMapForModel(model);
  for (const physicalId of ['phys.out.x', 'phys.i1.in1.top', 'phys.cmp1.gt']) {
    const entry = catalog.bridge.byPhysicalSocketId[physicalId];
    assert.ok(entry && entry.connectorId, `missing bridge entry for ${physicalId}`);
    const connector = catalog.map.get(entry.connectorId);
    const socket = model.physicalSockets.find((candidate) => candidate.id === physicalId);
    assert.ok(connector && socket, `missing connector/socket for ${physicalId}`);
    assert.strictEqual(connector.coordinateSource, 'physical-socket-map');
    assert.strictEqual(connector.x, socket.x);
    assert.strictEqual(connector.y, socket.y);
  }
  const patch = Object.assign({}, patchEditorApp.createFullBoardPatchFromTemplate('empty-panel'), {
    cables: [{ from: 'PLUS1.out', to: 'OUT_X.in', id: 'wire-output-check' }],
  });
  const wire = cableInteractionApp.integratedWiresFromPatch(model, patch)[0];
  assert.strictEqual(wire.from.x, 61.92185);
  assert.strictEqual(wire.from.y, 390.48598);
  assert.strictEqual(wire.from.connectorId, 'minuspluso_02');
  assert.strictEqual(wire.to.x, 612.29623);
  assert.strictEqual(wire.to.y, 477.29051);
});


test('v085 physicalization prefers the dedicated -1/+1 block for automatic machine-unit sources', () => {
  const map = createThatPhysicalSocketMap();
  assert.strictEqual(preferredPhysicalSocketsForLogical(map, 'PLUS1.out', 'output')[0].id, 'phys.plus1.out.a');
  assert.strictEqual(preferredPhysicalSocketsForLogical(map, 'MINUS1.out', 'output')[0].id, 'phys.minus1.out.a');
  const design = physicalizeDesignCables(designFromSerializedPatch(firstStepsMassSpringDamperSerializedPatch(), { now: '2026-06-01T00:00:00.000Z' }), { socketMap: map });
  const constantSources = design.cables.filter((cable) => /^(PLUS1|MINUS1)\.out$/.test(cable.from.logicalSocketId));
  assert.ok(constantSources.length >= 1);
  assert.ok(constantSources.every((cable) => /^(phys\.plus1\.out\.[ab]|phys\.minus1\.out\.[ab])$/.test(cable.from.physicalSocketId)), constantSources.map((cable) => cable.from.physicalSocketId).join(', '));
  assert.ok(constantSources.every((cable) => !/^phys\.i\d+\.(plus1|minus1)$/.test(cable.from.physicalSocketId)));
});


test('v085 First Steps panel overlays and integrated wires do not auto-route constants from integrator -1/+1 jacks', () => {
  for (const id of QUICK_START_BOOKLET_EXAMPLE_IDS) {
    const patch = getFirstStepsPatch(id);
    const design = designFromSerializedPatch(patch, { now: '2026-06-01T00:00:00.000Z' });
    const model = designPanelModelFromDesign(design);
    const constantCables = (model.cables || []).filter((cable) => /^(PLUS1|MINUS1)\.out$/.test(cable.from.logicalSocketId));
    for (const cable of constantCables) {
      assert.ok(!/^phys\.i\d+\.(plus1|minus1)$/.test(cable.from.physicalSocketId), `${id} used ${cable.from.physicalSocketId}`);
      assert.ok(/^phys\.(plus1|minus1)\.out\.[ab]$/.test(cable.from.physicalSocketId), `${id} should use dedicated machine-unit jacks, got ${cable.from.physicalSocketId}`);
    }
    const routes = (model.cableRoutes || []).filter((route) => /^(PLUS1|MINUS1)\.out$/.test(route.fromLogicalSocketId));
    for (const route of routes) {
      assert.ok(/^phys\.(plus1|minus1)\.out\.[ab]$/.test(route.fromPhysicalSocketId), `${id} route used ${route.fromPhysicalSocketId}`);
      assert.notStrictEqual(route.start.x, 0, `${id} route fell back to x=0`);
      assert.notStrictEqual(route.start.y, 0, `${id} route fell back to y=0`);
    }
  }
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = { schemaVersion: PATCH_SCHEMA_VERSION, inventory: 'that-prototype-board/v006', name: 'Machine-unit wire preference smoke', components: [{ id: 'PLUS1' }, { id: 'MINUS1' }, { id: 'OUT_X' }, { id: 'OUT_Y' }], cables: [{ from: 'PLUS1.out', to: 'OUT_X.in' }, { from: 'MINUS1.out', to: 'OUT_Y.in' }], outputs: { x: 'OUT_X.out', y: 'OUT_Y.out' } };
  const wires = cableInteractionApp.integratedWiresFromPatch(model, patch);
  assert.deepStrictEqual(wires.map((wire) => [wire.from.connectorId, wire.from.x, wire.from.y]), [['minuspluso_02', 61.92185, 390.48598], ['minuspluso_01', 25.65401, 390.48598]]);
});



test('patch-panel SVG includes THAT-style decor and editor metadata', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const svg = patchPanelApp.svgForPanelModel(model);
  assert.ok(svg.includes('data-component-id="I1"'));
  assert.ok(svg.includes('data-cable-id="c10"'));
  assert.ok(svg.includes('OUT_X.in'));
  assert.ok(svg.includes('valid THAT panel based on uploaded SVG reference'));
  assert.ok(svg.includes('THAT_panel.svg'));
  assert.ok(svg.includes('panel-reference-image'));
  assert.ok(svg.includes('panel-socket-overlay-layer'));
});



test('browser patch editor creates serialized patch JSON backed by coefficients', () => {
  const patch = patchEditorApp.createEditableDampedPatch({ k: 0.42, d: 0.17, invMass: 0.61 });
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  const coefficients = patchEditorApp.readDampedPatchCoefficients(patch);
  assertAlmost(coefficients.k, 0.42);
  assertAlmost(coefficients.d, 0.17);
  assertAlmost(coefficients.invMass, 0.61);
  assert.strictEqual(patch.components.find((component) => component.id === 'P1').coefficient, 0.42);
  assert.strictEqual(patch.parameters.invMass, 0.61);
});

test('browser patch editor parses cable text and validates the quickstart patch', () => {
  const patch = patchEditorApp.createEditableDampedPatch();
  const text = patchEditorApp.cableLinesFromPatch(patch);
  const edited = patchEditorApp.patchWithCableLines(patch, text);
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const validation = patchEditorApp.validateSerializedPatchForBrowser(edited, model);
  assert.strictEqual(validation.ok, true);
  assert.strictEqual(edited.cables.length, 11);
  assert.ok(text.includes('PLUS1.out -> I1.ic'));
});

test('browser patch editor reports invalid cable edits before rendering', () => {
  const patch = patchEditorApp.createEditableDampedPatch();
  const invalid = patchEditorApp.patchWithCableLines(patch, 'PLUS1.out -> I1.ic\nUNKNOWN.out -> I2.ic');
  const validation = patchEditorApp.validateSerializedPatchForBrowser(invalid, patchPanelApp.getDampedOscillationPanelModel());
  assert.strictEqual(validation.ok, false);
  assert.ok(validation.errors.some((error) => /UNKNOWN/.test(error)));
});

test('browser patch editor can derive a panel model from serialized patch JSON', () => {
  const patch = patchEditorApp.setDampedPatchCoefficients(patchEditorApp.createEditableDampedPatch(), { k: 0.7, d: 0.2, invMass: 0.8 });
  const model = patchEditorApp.panelModelFromSerializedPatch(patch, patchPanelApp.getDampedOscillationPanelModel());
  const summary = patchEditorApp.patchSummary(patch, model);
  assert.strictEqual(model.cables.length, 11);
  assert.strictEqual(summary.valid, true);
  assertAlmost(summary.coefficients.k, 0.7);
  assertAlmost(summary.coefficients.d, 0.2);
});


test('browser patch templates keep the visible preset list limited to First Steps booklet examples', () => {
  const templates = patchTemplatesApp.getPatchTemplates();
  const ids = templates.map((template) => template.id);
  assert.ok(ids.includes('first-steps-radioactive-decay'));
  assert.ok(ids.includes('first-steps-euler-spiral'));
  assert.ok(ids.includes('first-steps-helper-abs'));
  assert.ok(!ids.includes('quickstart-damped-oscillation'));
  assert.ok(!ids.includes('multiplier-product'));
  assert.ok(!ids.includes('comparator-switch'));
  const hiddenTemplates = patchTemplatesApp.getPatchTemplates({ includeNonBookletExamples: true });
  const hiddenIds = hiddenTemplates.map((template) => template.id);
  assert.ok(hiddenIds.includes('multiplier-product'));
  const multiplier = patchTemplatesApp.createPatchFromTemplate('multiplier-product', { xScale: 0.7, yScale: 0.2 });
  const parameters = patchTemplatesApp.readTemplateParameters(multiplier, 'multiplier-product');
  assertAlmost(parameters.xScale, 0.7);
  assertAlmost(parameters.yScale, 0.2);
  const run = browserPatchRuntime.runSerializedPatch(multiplier, { mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 });
  assertAlmost(run.result.trace[0].outputs.y, -0.14);
});

test('predefined wirings expose runnable First Steps templates', () => {
  const templates = patchTemplatesApp.getPatchTemplates();
  const ids = templates.map((template) => template.id);
  assert.ok(ids.includes('first-steps-radioactive-decay'));
  assert.ok(ids.includes('first-steps-mass-spring-damper'));
  assert.ok(ids.includes('first-steps-lunar-landing'));
  assert.ok(ids.includes('first-steps-neuronal-bursting'));
  assert.ok(ids.includes('first-steps-euler-spiral'));
  assert.ok(ids.includes('first-steps-hunter-prey'));
  assert.ok(ids.includes('first-steps-lorenz-attractor'));
  assert.ok(ids.includes('first-steps-polynomial-generator'));
  assert.ok(ids.includes('first-steps-bouncing-ball'));
  const lunar = patchTemplatesApp.createPatchFromTemplate('first-steps-lunar-landing');
  assert.strictEqual(lunar.deviceControls.mode, 'OP');
  assert.strictEqual(lunar.deviceControls.scopeA, 'X');
  assert.strictEqual(lunar.deviceControls.scopeB, 'Y');
  assert.ok(lunar.cables.some((cable) => cable.from === 'I3.out' && cable.to === 'OUT_U.in'));
  const lunarRun = browserPatchRuntime.runSerializedPatch(lunar, { mode: 'OP', duration: 10, dt: 0.002, sampleEvery: 5000 });
  const lunarFinal = lunarRun.result.trace[lunarRun.result.trace.length - 1];
  const lunarExpected = lunarLandingReferenceStateAt(10, { dt: 0.002 });
  assertAlmost(lunarFinal.outputs.altitude, lunarExpected.altitude, 1e-10);
  assertAlmost(lunarFinal.outputs.velocity, lunarExpected.velocity, 1e-10);
  assertAlmost(lunarFinal.outputs.fuel, lunarExpected.fuel, 1e-10);
  const euler = patchTemplatesApp.createPatchFromTemplate('first-steps-euler-spiral');
  assert.strictEqual(euler.template.id, 'first-steps-euler-spiral');
  assert.strictEqual(euler.deviceControls.scopeMode, 'xy');
  assert.strictEqual(euler.deviceControls.scopeA, 'X');
  assert.strictEqual(euler.deviceControls.scopeB, 'Y');
  assert.ok(euler.cables.some((cable) => cable.from === 'I4.out' && cable.to === 'OUT_X.in'));
  assert.ok(euler.cables.some((cable) => cable.from === 'I5.out' && cable.to === 'OUT_Y.in'));
  const parameters = patchTemplatesApp.readTemplateParameters(euler, 'first-steps-euler-spiral');
  assertAlmost(parameters.tauRate, 0.1);
  assertAlmost(parameters.xScale, 0.6);
  assertAlmost(parameters.yScale, 0.6);
  const run = browserPatchRuntime.runSerializedPatch(euler, { mode: 'REPF', opTime: 120, cycles: 1, dt: 0.005, sampleEvery: 20 });
  const final = run.result.trace[run.result.trace.length - 1];
  assert.strictEqual(run.patch.parameters.normalizedTauSweep, true);
  assertAlmost(run.patch.parameters.tauSpan, 6);
  assertEulerTraceIsCentered(run.result.trace, run.patch.parameters.centeredSweep);
  const expected = expectedEulerFromPatch(run.patch, 120);
  assertAlmost(final.outputs.x, expected.x, 1e-9);
  assertAlmost(final.outputs.y, expected.y, 1e-9);
  const hunter = patchTemplatesApp.createPatchFromTemplate('first-steps-hunter-prey');
  assert.strictEqual(hunter.deviceControls.scopeMode, 'time');
  assert.strictEqual(hunter.parameters.scopePreset, 'time');
  assert.strictEqual(hunter.deviceControls.scopeA, 'X');
  assert.strictEqual(hunter.deviceControls.scopeB, 'Y');
  const hunterRun = browserPatchRuntime.runSerializedPatch(hunter, { mode: 'OP', duration: 2, dt: 0.002, sampleEvery: 1000 });
  const hunterFinal = hunterRun.result.trace[hunterRun.result.trace.length - 1];
  const hunterExpected = hunterPreyReferenceStateAt(2);
  assertAlmost(hunterFinal.outputs.hare, hunterExpected.h, 1e-10);
  assertAlmost(hunterFinal.outputs.lynx, hunterExpected.l, 1e-10);
  const lorenz = patchTemplatesApp.createPatchFromTemplate('first-steps-lorenz-attractor');
  assert.strictEqual(lorenz.deviceControls.scopeMode, 'xy');
  assert.strictEqual(lorenz.deviceControls.scopeA, 'X');
  assert.strictEqual(lorenz.deviceControls.scopeB, 'Y');
  assert.ok(lorenz.cables.some((cable) => cable.from === 'INV3.out' && cable.to === 'OUT_Z.in'));
  const lorenzRun = browserPatchRuntime.runSerializedPatch(lorenz, { mode: 'OP', duration: 2, dt: 0.002, sampleEvery: 1000 });
  const lorenzFinal = lorenzRun.result.trace[lorenzRun.result.trace.length - 1];
  const lorenzExpected = lorenzReferenceStateAt(2);
  assertAlmost(lorenzFinal.outputs.x, lorenzExpected.x, 1e-10);
  assertAlmost(lorenzFinal.outputs.y, lorenzExpected.y, 1e-10);
  assertAlmost(lorenzFinal.outputs.z, lorenzExpected.z, 1e-10);
  const polynomial = patchTemplatesApp.createPatchFromTemplate('first-steps-polynomial-generator');
  assert.strictEqual(polynomial.deviceControls.scopeMode, 'xy');
  assert.strictEqual(polynomial.deviceControls.scopeA, 'X');
  assert.strictEqual(polynomial.deviceControls.scopeB, 'Y');
  assert.ok(polynomial.cables.some((cable) => cable.from === 'INV3.out' && cable.to === 'OUT_Y.in'));
  const polynomialRun = browserPatchRuntime.runSerializedPatch(polynomial, { mode: 'REPF', opTime: 2, cycles: 1, dt: 0.001, sampleEvery: 2000 });
  const polynomialFinal = polynomialRun.result.trace[polynomialRun.result.trace.length - 1];
  const polynomialExpected = polynomialGeneratorReferenceStateAt(2);
  assertAlmost(polynomialFinal.outputs.x, polynomialExpected.x, 1e-10);
  assertAlmost(polynomialFinal.outputs.polynomial, polynomialExpected.p, 1e-10);
  const helperIds = [
    'first-steps-helper-adjustable-minus-one-plus-one',
    'first-steps-helper-max',
    'first-steps-helper-min',
    'first-steps-helper-abs',
    'first-steps-helper-non-negative-only',
  ];
  for (const helperId of helperIds) {
    assert.ok(ids.includes(helperId));
    const helperPatch = patchTemplatesApp.createPatchFromTemplate(helperId);
    assert.strictEqual(helperPatch.deviceControls.mode, 'OP');
    assert.strictEqual(helperPatch.deviceControls.scopeA, 'Y');
    const helperRun = browserPatchRuntime.runSerializedPatch(helperPatch, { mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 });
    const finalHelper = helperRun.result.trace[helperRun.result.trace.length - 1];
    assertAlmost(finalHelper.outputs.y, helperPatch.parameters.expectedValue, 1e-12);
  }
});

test('browser patch editor supports non-oscillator template patches', () => {
  const patch = patchEditorApp.createEditablePatchFromTemplate('comparator-switch', { positiveTerm: 0.1, negativeTerm: 0.8 });
  assert.strictEqual(patchEditorApp.inferTemplateIdFromPatch(patch), 'comparator-switch');
  const parameters = patchEditorApp.readPatchTemplateParameters(patch, 'comparator-switch');
  assertAlmost(parameters.positiveTerm, 0.1);
  assertAlmost(parameters.negativeTerm, 0.8);
  const model = patchEditorApp.templatePanelModelFromSerializedPatch(patch, 'comparator-switch');
  const validation = patchEditorApp.validateSerializedPatchForBrowser(patch, model);
  assert.strictEqual(validation.ok, true);
  assert.strictEqual(model.cables.length, 7);
  assert.ok(model.components.some((component) => component.id === 'CMP1'));
});

test('browser patch templates produce generic panel summaries', () => {
  const patch = patchTemplatesApp.createPatchFromTemplate('coefficient-inverter', { scale: 0.25 });
  const model = patchTemplatesApp.createGenericPanelModel(patch, { templateId: 'coefficient-inverter' });
  const summary = patchTemplatesApp.summarizeTemplatePatch(patch, 'coefficient-inverter');
  assert.strictEqual(model.cables.length, 3);
  assert.strictEqual(summary.templateId, 'coefficient-inverter');
  assertAlmost(summary.parameterValues.scale, 0.25);
  assert.ok(model.components.every((component) => Array.isArray(component.inputs) && Array.isArray(component.outputs)));
});

test('browser patch templates embed device-control presets for the physical workbench', () => {
  const templates = patchTemplatesApp.getPatchTemplates();
  const decay = templates.find((template) => template.id === 'first-steps-radioactive-decay');
  assert.strictEqual(decay.defaultDeviceControls.mode, 'REPF');
  assert.strictEqual(decay.defaultDeviceControls.scopeA, 'X');
  assert.strictEqual(decay.defaultDeviceControls.scopeB, 'none');
  const multiplier = patchTemplatesApp.createPatchFromTemplate('multiplier-product', { xScale: 0.7, yScale: 0.2 });
  assert.strictEqual(multiplier.deviceControls.mode, 'OP');
  assert.strictEqual(multiplier.deviceControls.scopeA, 'Y');
  const controls = patchTemplatesApp.deviceControlsFromPatch(multiplier, 'multiplier-product');
  assert.strictEqual(controls.scopeB, 'none');
  const summary = patchTemplatesApp.summarizeTemplatePatch(multiplier, 'multiplier-product');
  assert.strictEqual(summary.deviceControls.scopeA, 'Y');
});

test('browser patch editor keeps predefined patches on the physical panel model', () => {
  const patch = patchEditorApp.createEditablePatchFromTemplate('multiplier-product', { xScale: 0.7, yScale: 0.2 });
  const normalized = patchEditorApp.normalizeSerializedPatch(patch);
  assert.strictEqual(normalized.deviceControls.scopeA, 'Y');
  const physicalModel = patchPanelApp.getDampedOscillationPanelModel();
  const physicalValidation = patchEditorApp.validateSerializedPatchForBrowser(normalized, physicalModel);
  assert.strictEqual(physicalValidation.ok, true, physicalValidation.errors.join('; '));
  const panelModel = patchEditorApp.panelModelFromSerializedPatch(normalized, physicalModel);
  assert.ok(panelModel.components.some((component) => component.id === 'MUL1'));
  assert.ok(panelModel.components.some((component) => component.id === 'OUT_Z'));
  assert.strictEqual(panelModel.cables.length, 5);
});

test('bouncing-ball physical panel wires resolve to real SVG sockets', () => {
  const patch = patchEditorApp.createFullBoardPatchFromTemplate('first-steps-bouncing-ball');
  const physicalModel = patchPanelApp.getDampedOscillationPanelModel();
  const panelModel = patchEditorApp.panelModelFromSerializedPatch(patch, physicalModel);
  const validation = patchEditorApp.validateSerializedPatchForBrowser(patch, panelModel);
  assert.strictEqual(validation.ok, true, validation.errors.join('; '));
  const wires = cableInteractionApp.integratedWiresFromPatch(panelModel, patch);
  assert.strictEqual(wires.length, patch.cables.length);
  assert.strictEqual(wires.filter((wire) => (wire.from.x === 0 && wire.from.y === 0) || (wire.to.x === 0 && wire.to.y === 0)).length, 0);
  assert.ok(wires.some((wire) => wire.from.section === 'CAPACITORS' || wire.to.section === 'CAPACITORS'));
  assert.ok(wires.some((wire) => wire.from.section === 'DIODES' || wire.to.section === 'DIODES'));
  assert.ok(wires.some((wire) => /Z.?DIODES/.test(wire.from.section) || /Z.?DIODES/.test(wire.to.section)));
});

test('slow-integrator predefined patch uses OUT-to-SLOW feedback semantics', () => {
  const patch = patchTemplatesApp.createPatchFromTemplate('slow-integrator-ramp');
  assert.ok(patch.cables.some((cable) => cable.from === 'I1.out' && cable.to === 'I1.slow'));
  assert.ok(!patch.cables.some((cable) => cable.from === 'PLUS1.out' && cable.to === 'I1.slow'));
  const run = browserPatchRuntime.runSerializedPatch(patch, { mode: 'OP', duration: 100, dt: 0.01, sampleEvery: 100, allowUnconnectedInputs: true });
  assert.ok(run.result.trace.length > 10);
  assertAlmost(run.result.trace[0].outputs.y, 0);
});

test('v043 full-board patch expansion preserves template wiring while adding every THAT module', () => {
  const small = patchEditorApp.createEditablePatchFromTemplate('multiplier-product', { xScale: 0.7, yScale: 0.2 });
  const full = patchEditorApp.expandPatchToFullBoard(small);
  assert.strictEqual(full.fullBoard, true);
  assert.strictEqual(full.boardModel.kind, 'full-that-panel');
  assert.strictEqual(full.runtimeBehavior.allowUnconnectedInputs, true);
  assert.strictEqual(full.components.length, browserPatchRuntime.createPrototypeInventory().components.length);
  assert.ok(full.components.some((component) => component.id === 'I5'));
  assert.ok(full.components.some((component) => component.id === 'SUM4'));
  assert.ok(full.components.some((component) => component.id === 'OUT_U'));
  assert.ok(full.cables.some((cable) => cable.from === 'MUL1.out' && cable.to === 'OUT_Y.in'));
  assert.strictEqual(full.outputs.X, 'OUT_X.out');
  assert.strictEqual(full.outputs.Y, 'OUT_Y.out');
});

test('v043 full-board browser validation treats unused physical modules as neutral', () => {
  const small = patchEditorApp.createEditablePatchFromTemplate('multiplier-product', { xScale: 0.7, yScale: 0.2 });
  const full = patchEditorApp.expandPatchToFullBoard(small);
  const validation = patchEditorApp.validateSerializedPatchForBrowser(full, patchPanelApp.getDampedOscillationPanelModel());
  assert.strictEqual(validation.ok, true, validation.errors.join('; '));
  const strictSmall = patchEditorApp.normalizeSerializedPatch(Object.assign({}, small, { components: full.components }));
  const strictValidation = patchEditorApp.validateSerializedPatchForBrowser(strictSmall, patchPanelApp.getDampedOscillationPanelModel());
  assert.strictEqual(strictValidation.ok, false);
  assert.ok(strictValidation.errors.some((error) => /required input/.test(error)));
});

test('v043 device workbench runtime expands selected-output patches to the full board', () => {
  const small = patchEditorApp.createEditablePatchFromTemplate('coefficient-inverter', { scale: 0.4 });
  const executable = deviceWorkbenchApp.runtimePatchWithSelectedOutputs(small, { scopeA: 'Y', scopeB: 'U' });
  assert.strictEqual(executable.fullBoard, true);
  assert.strictEqual(executable.components.length, browserPatchRuntime.createPrototypeInventory().components.length);
  assert.strictEqual(executable.outputs.U, 'OUT_U.out');
  const payload = browserPatchRuntime.runSerializedPatch(executable, { mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1, allowUnconnectedInputs: true });
  assertAlmost(payload.result.trace[0].outputs.Y, -0.4);
  assertAlmost(payload.result.trace[0].outputs.U, 0);
});


test('patch-panel SVG exposes editable socket and cable metadata', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const svg = patchPanelApp.svgForPanelModel(model);
  assert.ok(/data-socket-id="I1\.ic"/.test(svg));
  assert.ok(/data-direction="output"/.test(svg));
  assert.ok(/data-cable-index="0"/.test(svg));
});

test('cable interaction catalogs and hit-tests panel sockets', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const sockets = cableInteractionApp.listPanelSockets(model);
  assert.ok(sockets.some((socket) => socket.id === 'P3.out' && socket.direction === 'output'));
  assert.ok(sockets.some((socket) => socket.id === 'I1.in1' && socket.direction === 'input'));
  const p3 = sockets.find((socket) => socket.id === 'P3.out');
  const hit = cableInteractionApp.hitTestSocket(model, p3.position.x, p3.position.y);
  assert.strictEqual(hit.id, 'P3.out');
});

test('cable interaction adds a cable independent of click order and replaces driven input', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = patchEditorApp.createEditableDampedPatch();
  const result = cableInteractionApp.addCableToPatch(patch, model, 'I1.in1', 'SUM1.out');
  assert.strictEqual(result.changed, true);
  assert.strictEqual(result.patch.cables.filter((cable) => cable.to === 'I1.in1').length, 1);
  assert.ok(result.patch.cables.some((cable) => cable.from === 'SUM1.out' && cable.to === 'I1.in1'));
  const validation = patchEditorApp.validateSerializedPatchForBrowser(result.patch, model);
  assert.strictEqual(validation.ok, true, validation.errors.join('; '));
});

test('cable interaction selection state and cable removal are deterministic', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = patchEditorApp.createEditableDampedPatch();
  let state = cableInteractionApp.createCableEditState(patch, model);
  const first = cableInteractionApp.selectSocketForCable(state, 'INV1.out');
  assert.strictEqual(first.action, 'selected');
  const second = cableInteractionApp.selectSocketForCable(first.state, 'OUT_Y.in');
  assert.strictEqual(second.action, 'added');
  assert.ok(second.state.patch.cables.some((cable) => cable.from === 'INV1.out' && cable.to === 'OUT_Y.in'));
  const removed = cableInteractionApp.removeCableByEndpoint(second.state.patch, 'INV1.out', 'OUT_Y.in');
  assert.strictEqual(removed.changed, true);
  assert.ok(!removed.patch.cables.some((cable) => cable.from === 'INV1.out' && cable.to === 'OUT_Y.in'));
});



test('panel editor modes inspect physical sockets and expose logical mapping', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = patchEditorApp.createEditableDampedPatch();
  let state = cableInteractionApp.createCableEditState(patch, model);
  state = cableInteractionApp.setEditorMode(state, cableInteractionApp.EDITOR_MODES.INSPECT);
  assert.strictEqual(state.mode, 'inspect');
  const inspected = cableInteractionApp.inspectSocketForEdit(state, 'phys.cmp1.gt');
  assert.strictEqual(inspected.action, 'inspected-socket');
  assert.strictEqual(inspected.socket.physicalSocketId, 'phys.cmp1.gt');
  assert.strictEqual(inspected.socket.logicalSocketId, 'CMP1.positive');
  assert.ok(inspected.socket.tooltip.includes('COMPARATORS'));
  const cableDescription = cableInteractionApp.describeCable(model, patch.cables[0], 0);
  assert.ok(cableDescription.tooltip.includes('logical: PLUS1.out -> I1.ic'));
  assert.ok(cableDescription.toPhysical.some((socket) => socket.id === 'phys.i1.ic'));
});

test('panel editor supports physical cable endpoints undo redo dirty state and delete selection', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = patchEditorApp.createEditableDampedPatch();
  let state = cableInteractionApp.createCableEditState(patch, model);
  const first = cableInteractionApp.selectSocketForCable(state, 'phys.inv2.out');
  assert.strictEqual(first.action, 'selected');
  const second = cableInteractionApp.selectSocketForCable(first.state, 'phys.out.z');
  assert.strictEqual(second.action, 'added');
  state = second.state;
  assert.strictEqual(state.dirty, true);
  assert.strictEqual(state.history.past.length, 1);
  assert.ok(state.patch.cables.some((cable) => cable.from === 'INV2.out' && cable.to === 'OUT_Z.in'));
  const undo = cableInteractionApp.undoCableEdit(state);
  assert.strictEqual(undo.action, 'undo');
  assert.strictEqual(undo.state.dirty, false);
  assert.ok(!undo.state.patch.cables.some((cable) => cable.from === 'INV2.out' && cable.to === 'OUT_Z.in'));
  const redo = cableInteractionApp.redoCableEdit(undo.state);
  assert.strictEqual(redo.action, 'redo');
  assert.strictEqual(redo.state.dirty, true);
  const index = redo.state.patch.cables.findIndex((cable) => cable.from === 'INV2.out' && cable.to === 'OUT_Z.in');
  const selected = cableInteractionApp.selectCableForEdit(redo.state, index);
  assert.strictEqual(selected.action, 'selected-cable');
  const deleted = cableInteractionApp.deleteSelectedCable(selected.state);
  assert.strictEqual(deleted.action, 'deleted');
  assert.ok(!deleted.state.patch.cables.some((cable) => cable.from === 'INV2.out' && cable.to === 'OUT_Z.in'));
});

test('panel editor history can track coefficient and output routing patch edits', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = patchEditorApp.createEditableDampedPatch();
  let state = cableInteractionApp.createCableEditState(patch, model);
  const coefficientPatch = patchEditorApp.setPatchCoefficient(patch, 'P1', 0.85);
  state = cableInteractionApp.recordPatchHistory(state, coefficientPatch, { editType: 'coefficient-change', message: 'Changed P1 coefficient' });
  assert.strictEqual(state.dirty, true);
  assert.strictEqual(state.patch.components.find((component) => component.id === 'P1').coefficient, 0.85);
  const routedPatch = JSON.parse(JSON.stringify(state.patch));
  routedPatch.outputs.z = 'OUT_Z.out';
  state = cableInteractionApp.recordPatchHistory(state, routedPatch, { editType: 'output-routing-change', message: 'Changed Z output routing' });
  assert.strictEqual(state.history.past.length, 2);
  assert.strictEqual(state.patch.outputs.z, 'OUT_Z.out');
  const undoRouting = cableInteractionApp.undoCableEdit(state).state;
  assert.strictEqual(undoRouting.patch.outputs.z, undefined);
  const undoCoefficient = cableInteractionApp.undoCableEdit(undoRouting).state;
  assert.strictEqual(undoCoefficient.patch.components.find((component) => component.id === 'P1').coefficient, 0.5);
});

test('panel editor keyboard helpers support socket creation and delete/backspace removal', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = patchEditorApp.createEditableDampedPatch();
  let state = cableInteractionApp.createCableEditState(patch, model);
  let key = cableInteractionApp.handleSocketKey(state, 'phys.inv3.out', 'Enter');
  assert.strictEqual(key.action, 'selected');
  key = cableInteractionApp.handleSocketKey(key.state, 'phys.out.u', ' ');
  assert.strictEqual(key.action, 'added');
  const index = key.state.patch.cables.findIndex((cable) => cable.from === 'INV3.out' && cable.to === 'OUT_U.in');
  const selected = cableInteractionApp.selectCableForEdit(key.state, index);
  const deleted = cableInteractionApp.handleCableEditorKey(selected.state, 'Delete');
  assert.strictEqual(deleted.action, 'deleted');
  assert.ok(!deleted.state.patch.cables.some((cable) => cable.from === 'INV3.out' && cable.to === 'OUT_U.in'));
});

test('serialized example gallery visible list is limited to First Steps booklet examples', () => {
  const examples = listSerializedGalleryExamples();
  const ids = examples.map((example) => example.id);
  assert.strictEqual(examples.length, 14);
  assert.ok(ids.every((id) => id.startsWith('first-steps-')));
  assert.ok(ids.includes('first-steps-radioactive-decay'));
  assert.ok(ids.includes('first-steps-bouncing-ball'));
  assert.ok(!ids.includes('multiplier-product'));
  assert.ok(!ids.includes('comparator-switch'));
  assert.ok(examples.every((example) => example.componentCount > 0 && example.cableCount > 0));
  const hidden = listSerializedGalleryExamples({ includeNonBookletExamples: true });
  const hiddenIds = hidden.map((example) => example.id);
  assert.ok(hiddenIds.includes('multiplier-product'));
  assert.ok(hiddenIds.includes('slow-integrator-ramp'));
});

test('serialized gallery static block examples run through the general patch machine', () => {
  const multiplier = runSerializedGalleryExample('multiplier-product');
  assert.strictEqual(multiplier.result.mode, 'OP');
  assertAlmost(multiplier.result.trace[0].outputs.y, -0.24);
  const comparator = runSerializedGalleryExample('comparator-switch');
  assertAlmost(comparator.result.trace[0].outputs.y, 1);
  const xir = runSerializedGalleryExample('xir-summing-junction');
  assertAlmost(xir.result.trace[0].outputs.y, -0.5);
  const summer = runSerializedGalleryExample('summer-scaling');
  assertAlmost(summer.result.trace[0].outputs.y, -0.15);
});

test('serialized gallery slow integrator example advances with slow-mode approximation', () => {
  const payload = runSerializedGalleryExample('slow-integrator-ramp');
  assert.strictEqual(payload.result.mode, 'OP');
  assert.ok(payload.result.trace.length > 2);
  assertAlmost(payload.result.trace[0].outputs.y, 0);
  assertAlmost(payload.result.finalState.I1, 0.1, 1e-8);
});

test('serialized gallery patches can be materialized as files and machines', () => {
  const patch = getSerializedGalleryPatch('static-inverter');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  const machine = createSerializedGalleryMachine('static-inverter');
  const evaluated = machine.evaluate({});
  assertAlmost(evaluated.outputs.y, -0.6);
});



test('First Steps coverage manifest lists runnable and blocked examples', () => {
  const summary = summarizeFirstStepsCoverage();
  assert.strictEqual(summary.schemaVersion, FIRST_STEPS_COVERAGE_SCHEMA_VERSION);
  assert.ok(summary.exampleCount >= 14);
  assert.ok(summary.runnableIds.includes('first-steps-radioactive-decay'));
  assert.ok(summary.runnableIds.includes('first-steps-mass-spring-damper'));
  assert.ok(summary.runnableIds.includes('first-steps-lunar-landing'));
  assert.ok(summary.runnableIds.includes('first-steps-neuronal-bursting'));
  assert.ok(summary.runnableIds.includes('first-steps-euler-spiral'));
  assert.ok(summary.runnableIds.includes('first-steps-hunter-prey'));
  assert.ok(summary.runnableIds.includes('first-steps-lorenz-attractor'));
  assert.ok(summary.runnableIds.includes('first-steps-polynomial-generator'));
  assert.ok(summary.runnableIds.includes('first-steps-bouncing-ball'));
  assert.strictEqual(getFirstStepsCoverageEntry('first-steps-bouncing-ball').supportStatus, 'runnable');
  assert.strictEqual(summary.blockedCount, 0);
  assert.ok(listFirstStepsCoverage({ supportStatus: 'runnable' }).every((entry) => entry.supportStatus === 'runnable'));
});

test('First Steps radioactive decay template executes exponential decay', () => {
  const patch = getFirstStepsPatch('first-steps-radioactive-decay');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patch.parameters.page, 15);
  const machine = createFirstStepsMachine('first-steps-radioactive-decay');
  const ic = machine.applyInitialConditions(machine.defaultStateVector());
  assertAlmost(ic.I1, -0.5);
  const payload = runFirstStepsExample('first-steps-radioactive-decay', { runOptions: { opTime: 4, cycles: 1, dt: 0.01, sampleEvery: 400 } });
  assert.strictEqual(payload.result.mode, MODES.REPF);
  assertAlmost(payload.result.trace[0].outputs.n, 0.5);
  const final = payload.result.trace[payload.result.trace.length - 1];
  assertAlmost(final.outputs.n, 0.5 * Math.exp(-2), 1e-8);
  assertAlmost(final.outputs.minusN, -final.outputs.n, 1e-12);
});

test('First Steps mass-spring-damper template executes underdamped suspension', () => {
  const patch = getFirstStepsPatch('first-steps-mass-spring-damper');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patch.parameters.page, 16);
  assert.strictEqual(patch.parameters.integratorRate, 1000);
  assert.strictEqual(patch.components.find((component) => component.id === 'P3').coefficient, 0.05);
  const machine = createFirstStepsMachine('first-steps-mass-spring-damper');
  const ic = machine.applyInitialConditions(machine.defaultStateVector());
  assertAlmost(ic.I1, 0);
  assertAlmost(ic.I2, 0.5);
  const payload = runFirstStepsExample('first-steps-mass-spring-damper', { runOptions: { opTime: 0.08, cycles: 1, dt: 0.0001, sampleEvery: 800 } });
  assert.strictEqual(payload.result.mode, MODES.REPF);
  assertAlmost(payload.result.trace[0].outputs.displacement, 0.5);
  assertAlmost(payload.result.trace[0].outputs.velocity, 0);
  const final = payload.result.trace[payload.result.trace.length - 1];
  const expected = underdampedDisplacementAt(80, { y0: 0.5, v0: 0, spring: 0.5, damping: 0.05, inverseMass: 0.5 });
  assertAlmost(final.outputs.displacement, expected, 5e-7);
  assertAlmost(final.outputs.displacement, patch.parameters.expectedDisplacementAt80ms, 5e-7);
  assert.ok(Math.abs(final.outputs.displacement) < 0.2, 'expected the underdamped trace to have decayed by 80 ms');
});

test('First Steps Lunar Landing template executes powered descent with fuel monitor', () => {
  const patch = getFirstStepsPatch('first-steps-lunar-landing');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patch.parameters.page, 17);
  assert.strictEqual(patch.parameters.scopePreset, 'roll');
  assert.strictEqual(patch.components.find((component) => component.id === 'P1').coefficient, 0.5);
  assert.strictEqual(patch.components.find((component) => component.id === 'P2').coefficient, 0.1);
  assert.strictEqual(patch.components.find((component) => component.id === 'P3').coefficient, 0.05);
  assert.strictEqual(patch.components.find((component) => component.id === 'P4').coefficient, 0.05);
  assert.strictEqual(patch.components.find((component) => component.id === 'P6').coefficient, 0.05);
  assert.strictEqual(patch.components.find((component) => component.id === 'P7').coefficient, 0.05);
  assert.ok(patch.components.find((component) => component.id === 'P1').timeProfile);
  assert.ok(patch.cables.some((cable) => cable.from === 'I3.out' && cable.to === 'OUT_U.in'));
  assert.ok(patch.cables.some((cable) => cable.from === 'P7.out' && cable.to === 'I2.in1'));
  const machine = createFirstStepsMachine('first-steps-lunar-landing');
  const ic = machine.applyInitialConditions(machine.defaultStateVector());
  assertAlmost(ic.I1, 0);
  assertAlmost(ic.I2, 1);
  assertAlmost(ic.I3, 1);
  const payload = runFirstStepsExample('first-steps-lunar-landing', { runOptions: { duration: 10, dt: 0.002, sampleEvery: 500 } });
  assert.strictEqual(payload.result.mode, MODES.OP);
  const final = payload.result.trace[payload.result.trace.length - 1];
  const expected = lunarLandingReferenceStateAt(10, { dt: 0.002 });
  assertAlmost(final.outputs.altitude, expected.altitude, 1e-10);
  assertAlmost(final.outputs.velocity, expected.velocity, 1e-10);
  assertAlmost(final.outputs.fuel, expected.fuel, 1e-10);
  assertAlmost(final.outputs.thrust, expected.thrust, 1e-10);
  assertAlmost(final.outputs.fuel, patch.parameters.expectedFinalAt10s.fuel, 1e-10);
  const velocities = payload.result.trace.map((point) => point.outputs.velocity);
  assert.ok(Math.min(...velocities) < -0.08, 'expected velocity to dip during powered descent');
  assert.ok(final.outputs.velocity > Math.min(...velocities) + 0.08, 'expected velocity to recover after the throttle reduction');
  assert.ok(final.outputs.velocity < -0.005, 'expected recovered velocity to remain a gentle descent, not a climb');
  assert.strictEqual(expected.touchdownTime, null);
});

test('First Steps Neuronal Bursting template executes scaled Hindmarsh-Rose burst train', () => {
  const patch = getFirstStepsPatch('first-steps-neuronal-bursting');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patch.parameters.page, 18);
  assert.ok(patch.cables.some((cable) => cable.to === 'I3.slow'));
  assert.ok(patch.cables.some((cable) => cable.from === 'XIR1.out' && cable.to === 'SUM1.sj'));
  assert.ok(patch.cables.some((cable) => cable.from === 'INV1.out' && cable.to === 'SUM1.in10_1'));
  assert.ok(patch.cables.some((cable) => cable.from === 'P3.out' && cable.to === 'SUM1.in10_3'));
  assert.ok(patch.cables.some((cable) => cable.from === 'INV2.out' && cable.to === 'SUM2.in10_1'));
  const machine = createFirstStepsMachine('first-steps-neuronal-bursting');
  const ic = machine.applyInitialConditions(machine.defaultStateVector());
  assertAlmost(ic.I1, 1);
  assertAlmost(ic.I2, 0);
  assertAlmost(ic.I3, -1);
  const payload = runFirstStepsExample('first-steps-neuronal-bursting', { runOptions: { duration: 12, dt: 0.002, sampleEvery: 25 } });
  assert.strictEqual(payload.result.mode, MODES.OP);
  const final = payload.result.trace[payload.result.trace.length - 1];
  const expected = neuronalBurstingReferenceStateAt(12, { dt: 0.002 });
  assertAlmost(final.outputs.x, expected.x, 1e-10);
  assertAlmost(final.outputs.y, expected.y, 1e-10);
  assertAlmost(final.outputs.minusZ, expected.minusZ, 1e-10);
  const xValues = payload.result.trace.map((point) => point.outputs.x);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  let peaks = 0;
  for (let index = 1; index < xValues.length - 1; index += 1) {
    if (xValues[index] > xValues[index - 1] && xValues[index] > xValues[index + 1] && xValues[index] > 0) peaks += 1;
  }
  assert.ok(xMin < -0.7, `expected negative recovery phase, got min ${xMin}`);
  assert.ok(xMax > 0.8, `expected positive spike phase, got max ${xMax}`);
  assert.ok(peaks >= 6, `expected repeated spike peaks, got ${peaks}`);
});

test('First Steps Euler Spiral template executes X/Y quadrature trace', () => {
  const patch = getFirstStepsPatch('first-steps-euler-spiral');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patch.parameters.page, 19);
  assert.strictEqual(patch.parameters.scopePreset, 'xy');
  assertAlmost(patch.components.find((component) => component.id === 'P1').coefficient, 1 / 60);
  assert.strictEqual(patch.components.find((component) => component.id === 'P2').coefficient, 0.6);
  assert.strictEqual(patch.components.find((component) => component.id === 'P5').coefficient, 0.6);
  assert.strictEqual(patch.parameters.normalizedTauSweep, true);
  assert.strictEqual(patch.parameters.eulerSpiralAutoCenterForRun, true);
  assertAlmost(patch.parameters.tauSpan, 6);
  const machine = createFirstStepsMachine('first-steps-euler-spiral');
  const ic = machine.applyInitialConditions(machine.defaultStateVector());
  assertAlmost(ic.I1, -1);
  assertAlmost(ic.I2, patch.parameters.centeredSweep.cos0);
  assertAlmost(ic.I3, patch.parameters.centeredSweep.minusSin0);
  assert.ok(ic.I4 < 0);
  assert.ok(ic.I5 < 0);
  assertAlmost(ic.I4, patch.parameters.centeredInitial.x0, 1e-12);
  assertAlmost(ic.I5, patch.parameters.centeredInitial.y0, 1e-12);
  const payload = runFirstStepsExample('first-steps-euler-spiral', { runOptions: { opTime: 120, cycles: 1, dt: 0.005, sampleEvery: 20 } });
  assert.strictEqual(payload.result.mode, MODES.REPF);
  const final = payload.result.trace[payload.result.trace.length - 1];
  const expected = expectedEulerFromPatch(payload.patch, 120);
  assertEulerTraceIsCentered(payload.result.trace, payload.patch.parameters.centeredSweep);
  assertAlmost(final.outputs.tau, expected.tau, 1e-10);
  assertAlmost(final.outputs.x, expected.x, 1e-9);
  assertAlmost(final.outputs.y, expected.y, 1e-9);
});

test('First Steps Hunter/Prey template executes Lotka-Volterra dynamics', () => {
  const patch = getFirstStepsPatch('first-steps-hunter-prey');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patch.parameters.page, 20);
  assert.strictEqual(patch.parameters.scopePreset, 'time');
  assert.strictEqual(patch.components.find((component) => component.id === 'P4').coefficient, 0.95);
  assert.strictEqual(patch.components.find((component) => component.id === 'P6').coefficient, 0.84);
  const machine = createFirstStepsMachine('first-steps-hunter-prey');
  const ic = machine.applyInitialConditions(machine.defaultStateVector());
  assertAlmost(ic.I1, 0.6);
  assertAlmost(ic.I2, 0.6);
  const payload = runFirstStepsExample('first-steps-hunter-prey', { runOptions: { duration: 2, dt: 0.002, sampleEvery: 1000 } });
  assert.strictEqual(payload.result.mode, MODES.OP);
  const final = payload.result.trace[payload.result.trace.length - 1];
  const expected = hunterPreyReferenceStateAt(2, { h0: 0.6, l0: 0.6, alpha: 0.365, beta: 0.95, gamma: 0.09, delta: 0.84 });
  assertAlmost(final.outputs.hare, expected.h, 1e-10);
  assertAlmost(final.outputs.lynx, expected.l, 1e-10);
  assert.ok(final.outputs.hare >= 0);
  assert.ok(final.outputs.lynx >= 0);
});

test('First Steps Lorenz Attractor template executes chaotic projection dynamics', () => {
  const patch = getFirstStepsPatch('first-steps-lorenz-attractor');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patch.parameters.page, 21);
  assert.strictEqual(patch.parameters.scopePreset, 'xy');
  assert.deepStrictEqual(patch.parameters.projectionPresets.zx, ['OUT_Z.out', 'OUT_X.out']);
  assert.strictEqual(patch.components.find((component) => component.id === 'P1').coefficient, 0.18);
  assert.strictEqual(patch.components.find((component) => component.id === 'P4').coefficient, 0.268);
  const machine = createFirstStepsMachine('first-steps-lorenz-attractor');
  const ic = machine.applyInitialConditions(machine.defaultStateVector());
  assertAlmost(ic.I1, -0.18);
  assertAlmost(ic.I2, 0);
  assertAlmost(ic.I3, 0);
  const payload = runFirstStepsExample('first-steps-lorenz-attractor', { runOptions: { duration: 2, dt: 0.002, sampleEvery: 1000 } });
  assert.strictEqual(payload.result.mode, MODES.OP);
  const final = payload.result.trace[payload.result.trace.length - 1];
  const expected = lorenzReferenceStateAt(2);
  assertAlmost(final.outputs.x, expected.x, 1e-10);
  assertAlmost(final.outputs.y, expected.y, 1e-10);
  assertAlmost(final.outputs.z, expected.z, 1e-10);
  assert.ok(expected.maxAbs.x < 0.9 && expected.maxAbs.y < 0.7 && expected.maxAbs.z < 0.7);
  assert.ok(!final.overload, 'expected default Lorenz short run to remain inside machine-unit range');
});

test('First Steps Bouncing Ball template executes passive-accessory rebound trace', () => {
  const patch = getFirstStepsPatch('first-steps-bouncing-ball');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patch.parameters.page, 22);
  assert.strictEqual(patch.parameters.scopePreset, 'xy');
  assert.ok(patch.components.some((component) => component.type === 'capacitor'));
  assert.ok(patch.components.some((component) => component.type === 'diode'));
  assert.ok(patch.components.some((component) => component.type === 'z-diode'));
  assert.ok(!patch.components.some((component) => component.id === 'GNEG'), 'Bouncing Ball must not use a hidden gravity constant helper');
  assert.ok(patch.components.some((component) => component.id === 'MINUS1'));
  assert.ok(patch.components.some((component) => component.id === 'P3' && component.coefficient === 0.16));
  assert.ok(patch.components.some((component) => component.id === 'P4' && component.coefficient === 0.2));
  assert.ok(patch.cables.some((cable) => cable.from === 'MINUS1.out' && cable.to === 'P3.in'));
  assert.ok(patch.cables.some((cable) => cable.from === 'P3.out' && cable.to === 'SUM2.gravityNeg'));
  assert.ok(patch.cables.some((cable) => cable.from === 'CAP3.out' && cable.to === 'P4.in'));
  assert.ok(patch.cables.some((cable) => cable.from === 'P4.out' && cable.to === 'SUM2.drag'));
  assert.ok(patch.cables.some((cable) => cable.from === 'CAP4.out' && cable.to === 'INV2.in'));
  assert.ok(patch.cables.some((cable) => cable.from === 'INV2.out' && cable.to === 'OUT_Y.in'));
  const machine = createFirstStepsMachine('first-steps-bouncing-ball');
  const ic = machine.applyInitialConditions(machine.defaultStateVector());
  assertAlmost(ic.CAP1, 0.36);
  assertAlmost(ic.CAP2, -0.8);
  assertAlmost(ic.CAP3, 0);
  assertAlmost(ic.CAP4, -0.8);
  const payload = runFirstStepsExample('first-steps-bouncing-ball', { runOptions: { opTime: 8, cycles: 1, dt: 0.001, sampleEvery: 400 } });
  assert.strictEqual(payload.result.mode, MODES.REPF);
  const final = payload.result.trace[payload.result.trace.length - 1];
  const expected = bouncingBallReferenceStateAt(8);
  assertAlmost(final.outputs.x, expected.x, 1e-10);
  assertAlmost(final.outputs.physicalY, expected.y, 1e-10);
  assertAlmost(final.outputs.y, expected.displayY, 1e-10);
  assertAlmost(final.outputs.displayY, expected.displayY, 1e-10);
  assertAlmost(final.outputs.vx, expected.vx, 1e-10);
  assertAlmost(final.outputs.vy, expected.vy, 1e-10);
  const yValues = payload.result.trace.map((point) => point.outputs.y);
  assert.ok(Math.max(...yValues) <= 0.95, 'expected displayed Y not to rebound at the upper edge');
  assert.ok(Math.min(...yValues) >= -1.05, 'expected displayed floor contact to remain inside lower machine-unit tolerance');
  assert.ok(Math.min(...yValues) < -0.95, 'expected displayed floor contact to occur near the lower edge');
  assert.ok(expected.floorContactCount >= 1);
  assert.ok(expected.peakY > 1, 'expected floor overdrive/contact in the reference trace');
  assert.ok(expected.rightWallContactCount >= 1);
});


test('v083 Bouncing Ball tuned rebound remains inside scope tolerance', () => {
  const check = runFirstStepsScopeCheck('first-steps-bouncing-ball');
  assert.strictEqual(check.status, 'pass');
  assert.ok(check.metrics.inBoxOvershoot <= 0.05);
  assert.ok(check.metrics.x.max <= 1.05);
  assert.ok(check.metrics.y.max <= 0.95);
  assert.ok(check.metrics.y.min >= -1.05);
  assert.ok(check.checks.some((entry) => entry.id === 'floor-bounce-at-bottom' && entry.status === 'pass'));
  const expected = bouncingBallReferenceStateAt(8);
  assert.ok(expected.maxX <= 1.05);
  assert.ok(expected.peakY <= 1.05);
  assert.ok(expected.displayMinY >= -1.05);
});

test('v089 Bouncing Ball uses only standard modules for visible Y orientation', () => {
  const payload = runFirstStepsExample('first-steps-bouncing-ball', { runOptions: { opTime: 8, cycles: 1, dt: 0.001, sampleEvery: 10 } });
  const yValues = payload.result.trace.map((point) => point.outputs.y);
  const physicalYValues = payload.result.trace.map((point) => point.outputs.physicalY);
  assert.ok(yValues[0] > 0.5, 'displayed trace should start near the upper side of the box');
  assert.ok(Math.min(...yValues) < -0.95, 'displayed trace should rebound at the lower side of the box');
  assert.ok(Math.max(...yValues) < 0.95, 'displayed trace should not rebound at the upper side');
  assert.ok(Math.max(...physicalYValues) > 0.95, 'internal physical y still detects the floor at +1');
  const patch = getFirstStepsPatch('first-steps-bouncing-ball');
  assert.ok(!patch.components.some((component) => component.id === 'GNEG' || component.displayOnly || component.type === 'display-only'));
  assert.ok(patch.cables.some((cable) => cable.from === 'MINUS1.out' && cable.to === 'P3.in'));
  assert.ok(patch.cables.some((cable) => cable.from === 'P3.out' && cable.to === 'SUM2.gravityNeg'));
  assert.ok(patch.cables.some((cable) => cable.from === 'INV2.out' && cable.to === 'OUT_Y.in'));
});

test('First Steps demos do not use nonstandard display-only helper components', () => {
  for (const id of QUICK_START_BOOKLET_EXAMPLE_IDS) {
    const patch = getFirstStepsPatch(id);
    if (!patch) continue;
    const bad = (patch.components || []).filter((component) => component.id === 'GNEG' || component.displayOnly || component.type === 'display-only');
    assert.deepStrictEqual(bad, [], `${id} should not use hidden or display-only helper components`);
  }
});

test('v087 Lunar Landing default scope trace matches booklet-style descent and recovery', () => {
  const check = runFirstStepsScopeCheck('first-steps-lunar-landing');
  assert.strictEqual(check.status, 'pass');
  assert.ok(check.checks.some((entry) => entry.id === 'velocity-dip' && entry.status === 'pass'));
  assert.ok(check.checks.some((entry) => entry.id === 'velocity-recovers-without-climbing' && entry.status === 'pass'));
  assert.ok(check.metrics.altitude.min > 0.5);
  assert.ok(check.metrics.velocity.min < -0.08);
  assert.ok(check.metrics.altitudeLastDrop < check.metrics.altitudeMaxDrop * 0.4);
  assert.ok(check.metrics.velocity.last > check.metrics.velocity.min + 0.08);
  assert.ok(check.metrics.velocity.last < -0.005);
  assert.ok(check.metrics.velocity.max <= 1e-9);
});

test('First Steps Polynomial Generator template executes cubic polynomial trace', () => {
  const patch = getFirstStepsPatch('first-steps-polynomial-generator');
  assert.strictEqual(patch.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patch.parameters.page, 23);
  assert.strictEqual(patch.parameters.scopePreset, 'xy');
  assert.strictEqual(patch.components.find((component) => component.id === 'P2').coefficient, 0.1);
  assert.strictEqual(patch.components.find((component) => component.id === 'P5').coefficient, 0.3);
  const machine = createFirstStepsMachine('first-steps-polynomial-generator');
  const ic = machine.applyInitialConditions(machine.defaultStateVector());
  assertAlmost(ic.I1, -1);
  assertAlmost(ic.I2, -1);
  assertAlmost(ic.I3, -1);
  const payload = runFirstStepsExample('first-steps-polynomial-generator', { runOptions: { opTime: 2, cycles: 1, dt: 0.001, sampleEvery: 2000 } });
  assert.strictEqual(payload.result.mode, MODES.REPF);
  const start = payload.result.trace[0];
  assertAlmost(start.outputs.x, -1);
  assertAlmost(start.outputs.polynomial, polynomialGeneratorReferenceStateAt(0).p, 1e-12);
  const final = payload.result.trace[payload.result.trace.length - 1];
  const expected = polynomialGeneratorReferenceStateAt(2);
  assertAlmost(final.outputs.x, expected.x, 1e-10);
  assertAlmost(final.outputs.minusX2, expected.minusX2, 1e-10);
  assertAlmost(final.outputs.x3, expected.x3, 1e-10);
  assertAlmost(final.outputs.polynomial, expected.p, 1e-10);
  assertAlmost(final.outputs.polynomial, patch.parameters.expectedFinalAt2s.p, 1e-10);
});

test('First Steps Section 10 helper patches implement comparator truth tables', () => {
  const helperCases = [
    ['first-steps-helper-adjustable-minus-one-plus-one', { value: -0.5 }, -0.5],
    ['first-steps-helper-adjustable-minus-one-plus-one', { value: 0.75 }, 0.75],
    ['first-steps-helper-max', { a: -0.25, b: 0.4 }, 0.4],
    ['first-steps-helper-max', { a: 0.7, b: -0.9 }, 0.7],
    ['first-steps-helper-min', { a: -0.25, b: 0.4 }, -0.25],
    ['first-steps-helper-min', { a: 0.7, b: -0.9 }, -0.9],
    ['first-steps-helper-abs', { a: -0.6 }, 0.6],
    ['first-steps-helper-abs', { a: 0.6 }, 0.6],
    ['first-steps-helper-non-negative-only', { a: -0.6 }, 0],
    ['first-steps-helper-non-negative-only', { a: 0.6 }, 0.6],
  ];
  for (const [id, patchOptions, expected] of helperCases) {
    const patch = getFirstStepsPatch(id, patchOptions);
    assert.strictEqual(patch.parameters.page, 24);
    const payload = runFirstStepsExample(id, { patchOptions });
    const point = payload.result.trace[payload.result.trace.length - 1];
    assertAlmost(point.outputs.y, expected, 1e-12);
    assertAlmost(point.outputs.y, firstStepsHelperReferenceValue(id, patchOptions), 1e-12);
  }
  assertAlmost(coefficientForMachineUnitValue(-1), 0);
  assertAlmost(coefficientForMachineUnitValue(1), 1);
});

test('v083 First Steps scope checks pass visible traces against booklet output expectations', () => {
  const summary = summarizeFirstStepsScopeChecks();
  assert.strictEqual(summary.schemaVersion, FIRST_STEPS_SCOPE_CHECK_SCHEMA_VERSION);
  assert.strictEqual(summary.checkedCount, QUICK_START_BOOKLET_EXAMPLE_IDS.length);
  assert.strictEqual(summary.failedCount, 0);
  assert.strictEqual(summary.passedCount, QUICK_START_BOOKLET_EXAMPLE_IDS.length);
  assert.strictEqual(summary.warningCount, 0);
  const euler = summary.checks.find((entry) => entry.id === 'first-steps-euler-spiral');
  assert.strictEqual(euler.status, 'pass');
  assert.ok(euler.checks.some((check) => check.id === 'double-arm-x' && check.status === 'pass'));
  const hunter = summary.checks.find((entry) => entry.id === 'first-steps-hunter-prey');
  assert.strictEqual(hunter.status, 'pass');
  assert.ok(hunter.checks.some((check) => check.id === 'repeated-population-cycles' && check.status === 'pass'));
  assert.ok(hunter.metrics.harePeakCount >= 2);
  assert.ok(hunter.metrics.lynxPeakCount >= 2);
  const lorenz = summary.checks.find((entry) => entry.id === 'first-steps-lorenz-attractor');
  assert.strictEqual(lorenz.status, 'pass');
  assert.ok(lorenz.checks.some((check) => check.id === 'lorenz-lobe-switching' && check.status === 'pass'));
  assert.ok(lorenz.metrics.xSignChanges >= 4);
  const bounce = summary.checks.find((entry) => entry.id === 'first-steps-bouncing-ball');
  assert.strictEqual(bounce.status, 'pass');
  assert.ok(bounce.checks.some((check) => check.id === 'stays-in-machine-box' && check.status === 'pass'));
  assert.ok(bounce.checks.some((check) => check.id === 'multiple-floor-rebounds' && check.status === 'pass'));
  assert.ok(bounce.metrics.inBoxOvershoot <= 0.05);
  assert.ok(bounce.metrics.floorReboundCount >= 3);
});

test('v090 First Steps one-by-one scope checks define document-specific visual output classes', () => {
  assert.strictEqual(EXPECTED_SCOPE_OUTPUTS['first-steps-lorenz-attractor'].page, 21);
  assert.ok(/two-lobed Lorenz/.test(EXPECTED_SCOPE_OUTPUTS['first-steps-lorenz-attractor'].expected));
  assert.strictEqual(EXPECTED_SCOPE_OUTPUTS['first-steps-hunter-prey'].display, 'time');
  assert.ok(/roll-mode time traces/.test(EXPECTED_SCOPE_OUTPUTS['first-steps-hunter-prey'].expected));
  assert.ok(/phase-space remains/.test(EXPECTED_SCOPE_OUTPUTS['first-steps-hunter-prey'].expected));
  assert.ok(/lower-edge floor rebounds/.test(EXPECTED_SCOPE_OUTPUTS['first-steps-bouncing-ball'].expected));
  assert.strictEqual(DEFAULT_SCOPE_RUN_OPTIONS['first-steps-hunter-prey'].duration, 100);
  assert.strictEqual(DEFAULT_SCOPE_RUN_OPTIONS['first-steps-lorenz-attractor'].duration, 300);
  assert.strictEqual(DEFAULT_SCOPE_RUN_OPTIONS['first-steps-bouncing-ball'].opTime, 20);
  assert.strictEqual(DEFAULT_SCOPE_RUN_OPTIONS['first-steps-bouncing-ball'].cycles, 1);
});

test('v091 First Steps scope audit tightens decay, damper, and polynomial panel shapes', () => {
  const decay = runFirstStepsScopeCheck('first-steps-radioactive-decay');
  assert.strictEqual(decay.status, 'pass');
  assert.ok(decay.checks.some((check) => check.id === 'decay-flattens' && check.status === 'pass'));
  assert.ok(decay.metrics.decayLastDrop < decay.metrics.decayFirstDrop * 0.6);

  const damper = runFirstStepsScopeCheck('first-steps-mass-spring-damper');
  assert.strictEqual(damper.status, 'pass');
  assert.ok(damper.checks.some((check) => check.id === 'underdamped-positive-envelope' && check.status === 'pass'));
  assert.ok(damper.checks.some((check) => check.id === 'underdamped-negative-envelope' && check.status === 'pass'));
  assert.ok(damper.metrics.displacementPositivePeaks.length >= 2);
  assert.ok(damper.metrics.displacementNegativeValleys.length >= 2);

  const polynomial = runFirstStepsScopeCheck('first-steps-polynomial-generator');
  assert.strictEqual(polynomial.status, 'pass');
  assert.ok(/x\^2 U-shape/.test(EXPECTED_SCOPE_OUTPUTS['first-steps-polynomial-generator'].expected));
  assert.ok(polynomial.checks.some((check) => check.id === 'x2-u-shape' && check.status === 'pass'));
  assert.ok(polynomial.checks.some((check) => check.id === 'x3-s-shape' && check.status === 'pass'));
  assert.ok(polynomial.checks.some((check) => check.id === 'polynomial-default-valley' && check.status === 'pass'));
  assert.ok(polynomial.metrics.x2.min < 0.02);
  assert.ok(polynomial.metrics.x3.first < -0.95 && polynomial.metrics.x3.last > 0.95);
  assert.strictEqual(polynomial.metrics.polynomialValleys.length, 1);
});

test('v092 First Steps audit tightens Euler spiral and helper function branches', () => {
  const euler = runFirstStepsScopeCheck('first-steps-euler-spiral');
  assert.strictEqual(euler.status, 'pass');
  assert.ok(euler.checks.some((check) => check.id === 'point-symmetric-endpoints' && check.status === 'pass'));
  assert.ok(euler.checks.some((check) => check.id === 'passes-through-origin' && check.status === 'pass'));
  assert.ok(euler.checks.some((check) => check.id === 'curled-double-spiral' && check.status === 'pass'));
  assert.ok(euler.metrics.endpointPointSymmetry < 0.02);
  assert.ok(euler.metrics.middleRadius < 0.02);
  assert.ok(euler.metrics.radialPeakCount >= 4);

  for (const id of [
    'first-steps-helper-max',
    'first-steps-helper-min',
    'first-steps-helper-abs',
    'first-steps-helper-adjustable-minus-one-plus-one',
    'first-steps-helper-non-negative-only',
  ]) {
    const checked = runFirstStepsScopeCheck(id);
    assert.strictEqual(checked.status, 'pass');
    assert.ok(Array.isArray(HELPER_SCOPE_SWEEP_CASES[id]));
    assert.strictEqual(checked.metrics.helperSweep.length, HELPER_SCOPE_SWEEP_CASES[id].length);
    assert.ok(checked.metrics.helperSweep.every((item) => item.ok));
    assert.ok(checked.checks.some((check) => check.id === 'helper-sweep-covers-branches' && check.status === 'pass'));
  }
});

test('v093 First Steps audit tightens Lorenz projections and Bouncing Ball density', () => {
  const lorenz = runFirstStepsScopeCheck('first-steps-lorenz-attractor');
  assert.strictEqual(lorenz.status, 'pass');
  assert.ok(lorenz.checks.some((check) => check.id === 'lorenz-three-projection-density' && check.status === 'pass'));
  assert.ok(lorenz.checks.some((check) => check.id === 'lorenz-balanced-lobe-dwell' && check.status === 'pass'));
  assert.ok(lorenz.checks.some((check) => check.id === 'lorenz-side-front-projection-length' && check.status === 'pass'));
  assert.ok(lorenz.metrics.xyProjectionCells >= 150);
  assert.ok(lorenz.metrics.zxProjectionCells >= 200);
  assert.ok(lorenz.metrics.zyProjectionCells >= 225);
  assert.ok(lorenz.metrics.lobeDwell.positiveX >= 1000);
  assert.ok(lorenz.metrics.lobeDwell.negativeX >= 1000);

  const bounce = runFirstStepsScopeCheck('first-steps-bouncing-ball');
  assert.strictEqual(bounce.status, 'pass');
  assert.ok(bounce.checks.some((check) => check.id === 'bouncing-trace-density' && check.status === 'pass'));
  assert.ok(bounce.checks.some((check) => check.id === 'damped-rebound-apexes' && check.status === 'pass'));
  assert.ok(bounce.checks.some((check) => check.id === 'rebound-spacing-compresses' && check.status === 'pass'));
  assert.ok(bounce.metrics.floorReboundCount >= 4);
  assert.ok(bounce.metrics.xyTrajectoryLength > 7);
  assert.ok(bounce.metrics.xyProjectionCells >= 90);
  assert.ok(bounce.metrics.reboundApexes.length >= 2);
  assert.ok(bounce.metrics.floorReboundSampleGaps[bounce.metrics.floorReboundSampleGaps.length - 1] < bounce.metrics.floorReboundSampleGaps[0]);
});

test('serialized gallery includes the First Steps radioactive decay example', () => {
  const examples = listSerializedGalleryExamples();
  assert.ok(examples.some((example) => example.id === 'first-steps-radioactive-decay'));
  const payload = runSerializedGalleryExample('first-steps-radioactive-decay', { runOptions: { opTime: 4, cycles: 1, dt: 0.01, sampleEvery: 400 } });
  const final = payload.result.trace[payload.result.trace.length - 1];
  assertAlmost(final.outputs.n, 0.5 * Math.exp(-2), 1e-8);
  const spring = runSerializedGalleryExample('first-steps-mass-spring-damper', { runOptions: { opTime: 0.08, cycles: 1, dt: 0.0001, sampleEvery: 800 } });
  const springFinal = spring.result.trace[spring.result.trace.length - 1];
  assertAlmost(springFinal.outputs.displacement, underdampedDisplacementAt(80), 5e-7);
  const lunar = runSerializedGalleryExample('first-steps-lunar-landing', { runOptions: { duration: 10, dt: 0.002, sampleEvery: 5000 } });
  assertAlmost(lunar.result.trace[lunar.result.trace.length - 1].outputs.fuel, lunarLandingReferenceStateAt(10, { dt: 0.002 }).fuel, 1e-10);
  const euler = runSerializedGalleryExample('first-steps-euler-spiral', { runOptions: { opTime: 120, cycles: 1, dt: 0.005, sampleEvery: 20 } });
  assertEulerTraceIsCentered(euler.result.trace, euler.patch.parameters.centeredSweep);
  assertAlmost(euler.result.trace[euler.result.trace.length - 1].outputs.x, expectedEulerFromPatch(euler.patch, 120).x, 1e-9);
  const hunter = runSerializedGalleryExample('first-steps-hunter-prey', { runOptions: { duration: 2, dt: 0.002, sampleEvery: 1000 } });
  assertAlmost(hunter.result.trace[hunter.result.trace.length - 1].outputs.hare, hunterPreyReferenceStateAt(2).h, 1e-10);
  const lorenz = runSerializedGalleryExample('first-steps-lorenz-attractor', { runOptions: { duration: 2, dt: 0.002, sampleEvery: 1000 } });
  assertAlmost(lorenz.result.trace[lorenz.result.trace.length - 1].outputs.z, lorenzReferenceStateAt(2).z, 1e-10);
  const bouncing = runSerializedGalleryExample('first-steps-bouncing-ball', { runOptions: { opTime: 8, cycles: 1, dt: 0.001, sampleEvery: 8000 } });
  assertAlmost(bouncing.result.trace[bouncing.result.trace.length - 1].outputs.physicalY, bouncingBallReferenceStateAt(8).y, 1e-10);
  assertAlmost(bouncing.result.trace[bouncing.result.trace.length - 1].outputs.y, bouncingBallReferenceStateAt(8).displayY, 1e-10);
  const polynomial = runSerializedGalleryExample('first-steps-polynomial-generator', { runOptions: { opTime: 2, cycles: 1, dt: 0.001, sampleEvery: 2000 } });
  assertAlmost(polynomial.result.trace[polynomial.result.trace.length - 1].outputs.polynomial, polynomialGeneratorReferenceStateAt(2).p, 1e-10);
  const helperMax = runSerializedGalleryExample('first-steps-helper-max');
  assertAlmost(helperMax.result.trace[0].outputs.max, 0.25, 1e-12);
  const helperAbs = runSerializedGalleryExample('first-steps-helper-abs');
  assertAlmost(helperAbs.result.trace[0].outputs.abs, 0.4, 1e-12);
});



test('browser patch runtime runs serialized static block examples', () => {
  const multiplier = browserPatchRuntime.runSerializedPatch(serializedGalleryApp.getSerializedGalleryPatch('multiplier-product'), { mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 });
  assert.strictEqual(multiplier.result.mode, 'OP');
  assertAlmost(multiplier.result.trace[0].outputs.y, -0.24);
  assert.strictEqual(multiplier.result.trace[0].outputDetails.y.panelVolts, -2.4);
  const comparator = browserPatchRuntime.runSerializedPatch(serializedGalleryApp.getSerializedGalleryPatch('comparator-switch'), { mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 });
  assertAlmost(comparator.result.trace[0].outputs.y, 1);
});

test('browser patch runtime integrates serialized dynamic patches', () => {
  const slowRamp = browserPatchRuntime.runSerializedPatch(serializedGalleryApp.getSerializedGalleryPatch('slow-integrator-ramp'), { mode: 'OP', duration: 10, dt: 0.01, sampleEvery: 100 });
  assert.strictEqual(slowRamp.result.mode, 'OP');
  assert.ok(slowRamp.result.trace.length > 2);
  assertAlmost(slowRamp.result.finalState.I1, 0.1, 1e-8);
  const quickstart = browserPatchRuntime.runSerializedPatch(serializedGalleryApp.getSerializedGalleryPatch('quickstart-damped-oscillation'), { mode: 'REPF', opTime: 8, cycles: 2, dt: 0.01, sampleEvery: 50 });
  const triggers = quickstart.result.trace.filter((point) => point.trigger);
  assert.strictEqual(triggers.length, 2);
  assertAlmost(triggers[0].state.I1, -1);
  assertAlmost(triggers[0].outputs.velocity, 1);
});

test('browser serialized gallery can run examples through browser runtime', () => {
  const payload = serializedGalleryApp.runSerializedGalleryExampleInBrowser('xir-summing-junction');
  assert.strictEqual(payload.example.id, 'xir-summing-junction');
  assertAlmost(payload.result.trace[0].outputs.y, -0.5);
  assert.ok(payload.summary.outputNames.includes('xirContribution'));
  assert.strictEqual(payload.summary.sampleCount, 1);
});

test('browser serialized gallery runs First Steps radioactive decay', () => {
  const payload = serializedGalleryApp.runSerializedGalleryExampleInBrowser('first-steps-radioactive-decay', { opTime: 4, cycles: 1, dt: 0.01, sampleEvery: 400 });
  assert.strictEqual(payload.example.id, 'first-steps-radioactive-decay');
  const final = payload.result.trace[payload.result.trace.length - 1];
  assertAlmost(final.outputs.n, 0.5 * Math.exp(-2), 1e-8);
  assert.ok(payload.summary.outputNames.includes('minusN'));
  const spring = serializedGalleryApp.runSerializedGalleryExampleInBrowser('first-steps-mass-spring-damper', { opTime: 0.08, cycles: 1, dt: 0.0001, sampleEvery: 800 });
  assert.strictEqual(spring.example.id, 'first-steps-mass-spring-damper');
  const springFinal = spring.result.trace[spring.result.trace.length - 1];
  assertAlmost(springFinal.outputs.displacement, underdampedDisplacementAt(80), 5e-7);
  assert.ok(spring.summary.outputNames.includes('acceleration'));
  const bouncing = serializedGalleryApp.runSerializedGalleryExampleInBrowser('first-steps-bouncing-ball', { opTime: 8, cycles: 1, dt: 0.001, sampleEvery: 8000 });
  assertAlmost(bouncing.result.trace[bouncing.result.trace.length - 1].outputs.x, bouncingBallReferenceStateAt(8).x, 1e-10);
  assertAlmost(bouncing.result.trace[bouncing.result.trace.length - 1].outputs.y, bouncingBallReferenceStateAt(8).displayY, 1e-10);
  assert.ok(bouncing.summary.outputNames.includes('physicalY'));
  assert.ok(bouncing.summary.outputNames.includes('floorContact'));
  const lunar = serializedGalleryApp.runSerializedGalleryExampleInBrowser('first-steps-lunar-landing', { duration: 10, dt: 0.002, sampleEvery: 5000 });
  assert.strictEqual(lunar.example.id, 'first-steps-lunar-landing');
  assertAlmost(lunar.result.trace[lunar.result.trace.length - 1].outputs.altitude, lunarLandingReferenceStateAt(10, { dt: 0.002 }).altitude, 1e-10);
  assert.ok(lunar.summary.outputNames.includes('fuel'));
  const euler = serializedGalleryApp.runSerializedGalleryExampleInBrowser('first-steps-euler-spiral', { opTime: 120, cycles: 1, dt: 0.005, sampleEvery: 20 });
  assert.strictEqual(euler.example.id, 'first-steps-euler-spiral');
  assertEulerTraceIsCentered(euler.result.trace, euler.patch.parameters.centeredSweep);
  assertAlmost(euler.result.trace[euler.result.trace.length - 1].outputs.y, expectedEulerFromPatch(euler.patch, 120).y, 1e-9);
  assert.ok(euler.summary.outputNames.includes('tau'));
  const hunter = serializedGalleryApp.runSerializedGalleryExampleInBrowser('first-steps-hunter-prey', { duration: 2, dt: 0.002, sampleEvery: 1000 });
  assert.strictEqual(hunter.example.id, 'first-steps-hunter-prey');
  assertAlmost(hunter.result.trace[hunter.result.trace.length - 1].outputs.lynx, hunterPreyReferenceStateAt(2).l, 1e-10);
  assert.ok(hunter.summary.outputNames.includes('interaction'));
  const lorenz = serializedGalleryApp.runSerializedGalleryExampleInBrowser('first-steps-lorenz-attractor', { duration: 2, dt: 0.002, sampleEvery: 1000 });
  assert.strictEqual(lorenz.example.id, 'first-steps-lorenz-attractor');
  assertAlmost(lorenz.result.trace[lorenz.result.trace.length - 1].outputs.x, lorenzReferenceStateAt(2).x, 1e-10);
  assert.ok(lorenz.summary.outputNames.includes('z'));
  const polynomial = serializedGalleryApp.runSerializedGalleryExampleInBrowser('first-steps-polynomial-generator', { opTime: 2, cycles: 1, dt: 0.001, sampleEvery: 2000 });
  assert.strictEqual(polynomial.example.id, 'first-steps-polynomial-generator');
  assertAlmost(polynomial.result.trace[polynomial.result.trace.length - 1].outputs.polynomial, polynomialGeneratorReferenceStateAt(2).p, 1e-10);
  assert.ok(polynomial.summary.outputNames.includes('x3'));
  const helperMax = serializedGalleryApp.runSerializedGalleryExampleInBrowser('first-steps-helper-max');
  assert.strictEqual(helperMax.example.id, 'first-steps-helper-max');
  assertAlmost(helperMax.result.trace[0].outputs.max, 0.25, 1e-12);
  assert.ok(helperMax.summary.outputNames.includes('max'));
});

test('browser patch runtime validates serialized patch sockets', () => {
  const bad = serializedGalleryApp.getSerializedGalleryPatch('static-inverter');
  bad.cables = [{ from: 'PLUS1.out', to: 'INV1.out' }];
  assert.throws(() => browserPatchRuntime.runSerializedPatch(bad, { mode: 'OP', duration: 0 }), /must be an input socket/);
});


test('browser device runtime can evaluate a full board with unused inputs left open', () => {
  const inventory = browserPatchRuntime.createPrototypeInventory();
  const fullBoardPatch = {
    schemaVersion: browserPatchRuntime.PATCH_SCHEMA_VERSION,
    inventory: browserPatchRuntime.DEFAULT_INVENTORY_NAME,
    name: 'full-board open-input smoke test',
    components: inventory.components.map((component) => ({ id: component.id })),
    cables: [{ from: 'PLUS1.out', to: 'OUT_X.in' }],
    outputs: { X: 'OUT_X.out', Z: 'OUT_Z.out' },
  };
  assert.throws(() => browserPatchRuntime.runSerializedPatch(fullBoardPatch, { mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }), /required input/);
  const payload = browserPatchRuntime.runSerializedPatch(fullBoardPatch, { mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1, allowUnconnectedInputs: true });
  assertAlmost(payload.result.trace[0].outputs.X, 1);
  assertAlmost(payload.result.trace[0].outputs.Z, 0);
});

test('device workbench reports physical output route status and uses open-input runtime mode', () => {
  const patch = patchEditorApp.createEditableDampedPatch();
  const status = deviceWorkbenchApp.outputRouteStatus(patch);
  assert.strictEqual(status.X.wired, true);
  assert.strictEqual(status.Y.wired, true);
  assert.strictEqual(status.Z.wired, false);
  assert.strictEqual(deviceWorkbenchApp.runtimeOptions({ mode: 'REPF', opDurationMs: 40, opTimeMs: 8, repCycles: 2, solverDtMs: 0.01, sampleEvery: 10, clip: false }).allowUnconnectedInputs, true);
});

test('device workbench applies template control presets to form fields', () => {
  const fields = {
    mode: { value: '' },
    opTimeMs: { value: '' },
    opDurationMs: { value: '' },
    repCycles: { value: '' },
    solverDtMs: { value: '' },
    sampleEvery: { value: '' },
    simulationPrecision: { value: '' },
    scopeA: { value: '' },
    scopeB: { value: '' },
    scopeMode: { value: '' },
    clip: { checked: true, type: 'checkbox' },
  };
  const doc = { querySelector: (selector) => fields[String(selector).replace(/^#/, '')] || null };
  const patch = patchTemplatesApp.createPatchFromTemplate('quickstart-damped-oscillation');
  const applied = deviceWorkbenchApp.applyDeviceControlsToForm(doc, deviceWorkbenchApp.readPatchDeviceControls(patch));
  assert.strictEqual(fields.mode.value, 'REPF');
  assert.strictEqual(fields.scopeA.value, 'X');
  assert.strictEqual(fields.scopeB.value, 'Y');
  assert.strictEqual(fields.opDurationMs.value, '40');
  assert.strictEqual(fields.simulationPrecision.value, 'balanced');
  assert.strictEqual(fields.clip.checked, false);
  assert.strictEqual(applied.sampleEvery, 50);
});

test('v065 simulation precision presets smooth short First Steps demos', () => {
  const mass = patchTemplatesApp.createPatchFromTemplate('first-steps-mass-spring-damper');
  assert.strictEqual(mass.deviceControls.simulationPrecision, 'fine');
  const quick = deviceWorkbenchApp.runtimeOptions(Object.assign({}, mass.deviceControls, { simulationPrecision: 'quick' }));
  const fine = deviceWorkbenchApp.runtimeOptions(mass.deviceControls);
  const ultra = deviceWorkbenchApp.runtimeOptions(Object.assign({}, mass.deviceControls, { simulationPrecision: 'ultra' }));
  assert.strictEqual(quick.dt, 0.0001);
  assert.strictEqual(quick.sampleEvery, 800);
  assert.strictEqual(fine.dt, 0.00005);
  assert.strictEqual(fine.sampleEvery, 16);
  assert.strictEqual(ultra.dt, 0.000025);
  assert.strictEqual(ultra.sampleEvery, 8);
  const quickRun = browserPatchRuntime.runSerializedPatch(mass, quick);
  const fineRun = browserPatchRuntime.runSerializedPatch(mass, fine);
  assert.ok(quickRun.result.trace.length <= 2, `quick trace unexpectedly has ${quickRun.result.trace.length} samples`);
  assert.ok(fineRun.result.trace.length >= 100, `fine trace only has ${fineRun.result.trace.length} samples`);
});


test('v066 precision is standard side-panel control and coefficient meter selector is removed', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/deviceWorkbenchApp.js'), 'utf8');
  assert.ok(html.includes('id="simulationPrecision"'));
  assert.ok(html.indexOf('id="deviceControlsTitle"') < html.indexOf('id="simulationPrecision"'));
  assert.ok(html.indexOf('id="simulationPrecision"') < html.indexOf('id="coefficientTitle"'));
  assert.ok(html.indexOf('id="simulationPrecision"') < html.indexOf('Advanced runtime settings'));
  assert.ok(!/Advanced runtime settings[\s\S]*id="simulationPrecision"/.test(html));
  assert.ok(!html.includes('id="selectedCoefficient"'));
  assert.ok(!html.includes('id="panelMeter"'));
  assert.ok(!source.includes('selectedCoefficient'));
  assert.ok(!source.includes('panelMeter'));
});

test('v044 device workbench keeps auto-run on edits disabled by default', () => {
  const fields = {
    autoRunChanges: { checked: true, type: 'checkbox' },
  };
  const doc = { querySelector: (selector) => fields[String(selector).replace(/^#/, '')] || null };
  const applied = deviceWorkbenchApp.applyDeviceControlsToForm(doc, {});
  assert.strictEqual(applied.autoRunChanges, false);
  assert.strictEqual(fields.autoRunChanges.checked, false);
  assert.strictEqual(deviceWorkbenchApp.autoRunEnabled(doc), false);
  fields.autoRunChanges.checked = true;
  assert.strictEqual(deviceWorkbenchApp.autoRunEnabled(doc), true);
});

test('v044 device control presets may explicitly enable auto-run when requested', () => {
  const fields = { autoRunChanges: { checked: false, type: 'checkbox' } };
  const doc = { querySelector: (selector) => fields[String(selector).replace(/^#/, '')] || null };
  const applied = deviceWorkbenchApp.applyDeviceControlsToForm(doc, { autoRunChanges: true });
  assert.strictEqual(applied.autoRunChanges, true);
  assert.strictEqual(fields.autoRunChanges.checked, true);
});


test('v045 predefined patch loading is preview-first and device-preset oriented', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  assert.ok(html.includes('Physical setup preset'));
  assert.ok(html.includes('id="devicePresetSummary"'));
  assert.ok(/id="templateParameterControls"[^>]+hidden/.test(html));
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/patchEditorApp.js'), 'utf8');
  assert.ok(source.includes('previewSelectedTemplate'));
  assert.ok(source.includes("templateSelect.addEventListener('change', () => previewSelectedTemplate"));
  assert.ok(!source.includes("templateSelect.addEventListener('change', () => loadTemplate"));
  assert.ok(source.includes('formEventShouldSyncPatch'));
});

test('v045 device preset preview summarizes wiring controls and coefficients', () => {
  const summary = patchTemplatesApp.summarizeDevicePreset('quickstart-damped-oscillation');
  assert.strictEqual(summary.id, 'quickstart-damped-oscillation');
  assert.strictEqual(summary.controls.mode, 'REPF');
  assert.strictEqual(summary.scope.ch1, 'X');
  assert.strictEqual(summary.scope.ch2, 'Y');
  assert.ok(summary.cableCount >= 10);
  assert.ok(summary.coefficientDefaults.some((item) => item.id === 'P1' && item.value === 0.5));
  const node = { innerHTML: '' };
  const rendered = patchTemplatesApp.renderDevicePresetPreview(node, 'multiplier-product');
  assert.strictEqual(rendered.id, 'multiplier-product');
  assert.ok(node.innerHTML.includes('data-device-preset-preview="multiplier-product"'));
  assert.ok(node.innerHTML.includes('P1=0.600'));
  assert.ok(node.innerHTML.includes('Loading this setup replaces the panel wiring'));
});


test('v046 oscilloscope uses distinct CH1/CH2 colors and exposes output jack status', () => {
  const trace = [{ t: 0, outputs: { X: 0.25, Y: -0.5 } }];
  const options = { scopeA: 'X', scopeB: 'Y' };
  const series = deviceWorkbenchApp.traceScopeSeries(trace, options);
  assert.strictEqual(series.length, 2);
  assert.strictEqual(series[0].channel, 'CH1');
  assert.strictEqual(series[1].channel, 'CH2');
  assert.notStrictEqual(series[0].color, series[1].color);
  const legend = deviceWorkbenchApp.renderScopeLegendHtml(series);
  assert.ok(legend.includes('data-scope-channel="CH1"'));
  assert.ok(legend.includes('data-scope-channel="CH2"'));
  assert.ok(legend.includes(series[0].color));
  assert.ok(legend.includes(series[1].color));
  const patch = patchEditorApp.createEditableDampedPatch();
  const statusHtml = deviceWorkbenchApp.outputPortStatusHtml(patch, { scopeA: 'X', scopeB: 'Z' });
  assert.ok(/data-output-port="X"[^>]+data-wired="true"/.test(statusHtml));
  assert.ok(/data-output-port="Z"[^>]+data-wired="false"/.test(statusHtml));
  assert.ok(statusHtml.includes('CH1'));
  assert.ok(statusHtml.includes('CH2'));
});

test('v046 static UI shows oscilloscope channel colors and X/Y/Z/U port status', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../src/browser/styles.css'), 'utf8');
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/deviceWorkbenchApp.js'), 'utf8');
  assert.ok(html.includes('id="outputPortStatus"'));
  assert.ok(css.includes('.output-port-pill'));
  assert.ok(css.includes('data-selected-channel~="CH1"'));
  assert.ok(css.includes('data-selected-channel~="CH2"'));
  assert.ok(source.includes('SCOPE_CHANNEL_STYLES'));
  assert.ok(source.includes('renderOutputPortStatus'));
  assert.ok(source.includes('displayedSeries'));
});


test('v047 coefficient slider path updates patch state without rerendering the physical panel', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/deviceWorkbenchApp.js'), 'utf8');
  assert.ok(source.includes('coefficientEditChanged'));
  assert.ok(source.includes('patchEditor.updatePatchCoefficient'));
  assert.ok(source.includes('autoRunOnCommit'));
  const editorSource = fs.readFileSync(path.resolve(__dirname, '../src/browser/patchEditorApp.js'), 'utf8');
  assert.ok(editorSource.includes('function updatePatchCoefficient(componentId, coefficient'));
  assert.ok(editorSource.includes('if (updateOptions.syncEditors) syncEditors();'));
  assert.ok(editorSource.includes('updatePatchCoefficient,'));
  const patch = patchEditorApp.setPatchCoefficient(patchEditorApp.createFullBoardPatchFromTemplate('empty-panel'), 'P4', 0.123);
  assert.strictEqual(patch.components.find((component) => component.id === 'P4').coefficient, 0.123);
  assert.strictEqual(patch.parameters.coefficients.P4, 0.123);
});

test('v047 preset list includes an empty physical panel setup', () => {
  const templates = patchTemplatesApp.getPatchTemplates();
  assert.ok(templates.some((template) => template.id === 'empty-panel'));
  const empty = patchTemplatesApp.createPatchFromTemplate('empty-panel');
  assert.strictEqual(empty.name, 'Empty THAT physical panel setup');
  assert.strictEqual((empty.cables || []).length, 0);
  assert.deepStrictEqual(empty.outputs, {});
  assert.strictEqual(empty.deviceControls.mode, 'OFF');
  assert.strictEqual(empty.deviceControls.scopeA, 'X');
  const summary = patchTemplatesApp.summarizeDevicePreset('empty-panel');
  assert.strictEqual(summary.cableCount, 0);
  assert.strictEqual(summary.controls.mode, 'OFF');
  const node = { innerHTML: '' };
  patchTemplatesApp.renderDevicePresetPreview(node, 'empty-panel');
  assert.ok(node.innerHTML.includes('data-device-preset-preview="empty-panel"'));
  assert.ok(node.innerHTML.includes('0'));
});

test('v048 damped oscillator preset does not draw a hidden zero-source IC cable', () => {
  const patch = patchTemplatesApp.createPatchFromTemplate('quickstart-damped-oscillation');
  assert.strictEqual(patch.cables.length, 11);
  assert.ok(!patch.components.some((component) => component.id === 'ZERO'));
  assert.ok(!patch.cables.some((cable) => cable.from === 'ZERO.out' && cable.to === 'I2.ic'));
  const model = patchEditorApp.panelModelFromSerializedPatch(patch, patchPanelApp.getDampedOscillationPanelModel());
  const wires = cableInteractionApp.integratedWiresFromPatch(model, patch);
  assert.ok(wires.every((wire) => Math.round(wire.from.x) !== 50 || Math.round(wire.from.y) !== 455));
  const slow = patchTemplatesApp.createPatchFromTemplate('slow-integrator-ramp');
  assert.strictEqual(slow.cables.length, 3);
  assert.ok(!slow.cables.some((cable) => cable.from === 'ZERO.out' && cable.to === 'I1.ic'));
  const run = browserPatchRuntime.runSerializedPatch(patch, { mode: 'REPF', opTime: 8, cycles: 1, dt: 0.01, sampleEvery: 50 });
  assertAlmost(run.result.trace[0].state.I2, 0);
});



test('v049 workbench can swap large patch and oscilloscope areas', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../src/browser/styles.css'), 'utf8');
  assert.ok(html.includes('data-workbench-layout="patch-focus"'));
  assert.ok(html.includes('data-workbench-layout-button="patch-focus"'));
  assert.ok(html.includes('data-workbench-layout-button="scope-focus"'));
  assert.ok(css.includes('data-workbench-layout="scope-focus"'));
  assert.ok(css.includes('grid-template-columns: minmax(760px, 1.35fr) minmax(340px, 0.75fr)'));
  assert.ok(css.includes('.device-workbench[data-workbench-layout="scope-focus"] .device-side-panel'));
  assert.ok(css.includes('.device-workbench[data-workbench-layout="scope-focus"] .patch-panel-section'));
  assert.ok(css.includes('.layout-switch button[aria-pressed="true"]'));
});

test('v049 layout helper updates workbench state and pressed buttons', () => {
  const workbench = { dataset: {} };
  const buttons = [
    { layout: 'patch-focus', attrs: {}, getAttribute(name) { return name === 'data-workbench-layout-button' ? this.layout : this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = value; } },
    { layout: 'scope-focus', attrs: {}, getAttribute(name) { return name === 'data-workbench-layout-button' ? this.layout : this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = value; } },
  ];
  const doc = {
    querySelector(selector) { return selector === '.device-workbench' ? workbench : null; },
    querySelectorAll(selector) { return selector === '[data-workbench-layout-button]' ? buttons : []; },
  };
  assert.strictEqual(deviceWorkbenchApp.applyWorkbenchLayout(doc, 'scope-focus'), 'scope-focus');
  assert.strictEqual(workbench.dataset.workbenchLayout, 'scope-focus');
  assert.strictEqual(buttons[0].attrs['aria-pressed'], 'false');
  assert.strictEqual(buttons[1].attrs['aria-pressed'], 'true');
  assert.strictEqual(deviceWorkbenchApp.applyWorkbenchLayout(doc, 'unknown'), 'patch-focus');
  assert.strictEqual(workbench.dataset.workbenchLayout, 'patch-focus');
  assert.strictEqual(buttons[0].attrs['aria-pressed'], 'true');
  assert.strictEqual(buttons[1].attrs['aria-pressed'], 'false');
});



test('v050 oscilloscope identifies constant traces for visible flat-line rendering', () => {
  const trace = [
    { t: 0, outputs: { X: 0.5, Y: 0 } },
    { t: 10, outputs: { X: 0.5, Y: 0 } },
    { t: 20, outputs: { X: 0.5, Y: 0 } },
  ];
  const series = deviceWorkbenchApp.traceScopeSeries(trace, { scopeA: 'X', scopeB: 'Y' });
  const stats = deviceWorkbenchApp.traceSeriesStats(trace, series[0]);
  assert.strictEqual(stats.sampleCount, 3);
  assert.strictEqual(stats.constant, true);
  assert.strictEqual(stats.constantValue, 0.5);
  const legend = deviceWorkbenchApp.renderScopeLegendHtml(series, trace);
  assert.ok(legend.includes('constant 0.500'));
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/deviceWorkbenchApp.js'), 'utf8');
  assert.ok(source.includes('drawConstantTimeSeries'));
});

test('v051 panel editor status shows selected wire endpoints as a physical from-to card', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = patchEditorApp.createFullBoardPatchFromTemplate('empty-panel');
  const catalog = cableInteractionApp.connectorMapForModel(model);
  const added = cableInteractionApp.addIntegratedConnectorWireToPatch(
    patch,
    model,
    catalog.map.get('minuspluso_02'),
    catalog.map.get('outputs_01'),
    { style: { id: 'wire_v051', color: 'hsl(210 70% 45%)' } },
  );
  const state = cableInteractionApp.createCableEditState(added.patch, model);
  state.selectedWireId = 'wire_v051';
  state.selectedCableIndex = added.patch.cables.findIndex((cable) => cable.id === 'wire_v051');
  const container = { dataset: {}, innerHTML: '' };
  cableInteractionApp.renderCableInteractionStatus(container, state);
  assert.strictEqual(container.dataset.valid, 'true');
  assert.ok(container.innerHTML.includes('selected-wire-card'));
  assert.ok(container.innerHTML.includes('wire-color-chip'));
  assert.ok(container.innerHTML.includes('minuspluso_02'));
  assert.ok(container.innerHTML.includes('outputs_01'));
  assert.ok(container.innerHTML.includes('PLUS1.out'));
  assert.ok(container.innerHTML.includes('OUT_X.in'));
});

test('v051 panel editor exposes visible endpoint handles and less debug-looking toolbar labels', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/cableInteractionApp.js'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../src/browser/styles.css'), 'utf8');
  assert.ok(html.includes('patch tool'));
  assert.ok(html.includes('Delete selected'));
  assert.ok(html.includes('Mark saved'));
  assert.ok(source.includes('endpoint-handle-label'));
  assert.ok(source.includes('label.textContent = endpointLabel'));
  assert.ok(css.includes('v051 patch-panel editing ergonomics'));
  assert.ok(css.includes('.panel-inspector-card'));
  assert.ok(css.includes('.endpoint-handle-halo'));
});

test('v052 workflow hints explain stale traces, open output jacks, and coefficient input mistakes', () => {
  let patch = patchEditorApp.createFullBoardPatchFromTemplate('empty-panel');
  let hints = deviceWorkbenchApp.deviceWorkflowHints(patch, { mode: 'OFF', scopeA: 'X', scopeB: 'Y', autoRunChanges: false }, { stale: true, reason: 'Patch wiring changed' });
  assert.ok(hints.some((hint) => hint.id === 'trace-stale'));
  assert.ok(hints.some((hint) => hint.id === 'mode-off'));
  assert.ok(hints.some((hint) => hint.id === 'empty-panel'));

  patch = Object.assign({}, patch, { cables: [{ from: 'P1.out', to: 'OUT_X.in' }] });
  hints = deviceWorkbenchApp.deviceWorkflowHints(patch, { mode: 'OP', scopeA: 'X', scopeB: 'none', autoRunChanges: false }, {});
  assert.ok(hints.some((hint) => hint.id === 'coefficient-P1-input-open'));
  assert.ok(hints.some((hint) => /coefficient potentiometer scales its input/i.test(hint.text)));

  patch = Object.assign({}, patch, { cables: [{ from: 'PLUS1.out', to: 'P1.in' }, { from: 'P1.out', to: 'OUT_X.in' }] });
  hints = deviceWorkbenchApp.deviceWorkflowHints(patch, { mode: 'OP', scopeA: 'X', scopeB: 'none', autoRunChanges: false }, {});
  assert.ok(!hints.some((hint) => hint.id === 'coefficient-P1-input-open'));
  assert.ok(hints.some((hint) => hint.id === 'ready'));
});

test('v052 browser UI includes a workflow guidance card and renderer helpers', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../src/browser/styles.css'), 'utf8');
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/deviceWorkbenchApp.js'), 'utf8');
  assert.ok(html.includes('id="workflowHints"'));
  assert.ok(css.includes('v052 workflow guidance'));
  assert.ok(css.includes('.workflow-hint[data-level="warning"]'));
  assert.ok(source.includes('function deviceWorkflowHints'));
  assert.ok(source.includes('function renderWorkflowHints'));
  const rendered = deviceWorkbenchApp.renderWorkflowHintsHtml([{ id: 'trace-stale', title: 'Trace is stale', text: 'Press Run.', level: 'warning' }]);
  assert.ok(rendered.includes('data-hint-id="trace-stale"'));
  assert.ok(rendered.includes('Trace is stale'));
});

test('v053 wire bends scale with cable length and remain stable for legacy wires', () => {
  const shortRange = cableInteractionApp.wireBendMagnitudeRange(40);
  const longRange = cableInteractionApp.wireBendMagnitudeRange(520);
  assert.ok(longRange.min > shortRange.min);
  assert.ok(longRange.max > shortRange.max);

  const from = { connectorId: 'long-from', x: 0, y: 0 };
  const to = { connectorId: 'long-to', x: 520, y: 0 };
  const stableA = cableInteractionApp.stableWireBendForEndpoints(from, to, 3);
  const stableB = cableInteractionApp.stableWireBendForEndpoints(from, to, 3);
  assert.strictEqual(stableA, stableB);
  assert.ok(Math.abs(stableA) >= longRange.min);
  assert.ok(Math.abs(stableA) <= longRange.max);

  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = patchEditorApp.createFullBoardPatchFromTemplate('empty-panel');
  const catalog = cableInteractionApp.connectorMapForModel(model);
  const added = cableInteractionApp.addIntegratedConnectorWireToPatch(
    patch,
    model,
    catalog.map.get('minuspluso_02'),
    catalog.map.get('outputs_01'),
    { style: { id: 'wire_v053' } },
  );
  const saved = added.patch.cables.find((cable) => cable.id === 'wire_v053');
  assert.ok(Number.isFinite(saved.bend));
  assert.notStrictEqual(saved.bend, 0);

  const legacyPatch = Object.assign({}, patch, { cables: [{ from: 'PLUS1.out', to: 'OUT_X.in' }] });
  const first = cableInteractionApp.integratedWiresFromPatch(model, legacyPatch)[0];
  const second = cableInteractionApp.integratedWiresFromPatch(model, legacyPatch)[0];
  assert.strictEqual(first.bend, second.bend);
  assert.notStrictEqual(first.bend, 0);
});


test('v054 wire bends flip back inside the panel when midpoint would escape', () => {
  assert.ok(cableInteractionApp.DEFAULT_PANEL_BOUNDS);
  const topLeft = { connectorId: 'top-left', x: 100, y: 5 };
  const topRight = { connectorId: 'top-right', x: 700, y: 5 };
  const correctedTop = cableInteractionApp.bendAdjustedToPanelBounds(topLeft, topRight, -160);
  assert.ok(correctedTop > 0, `expected top-edge bend to flip downward, got ${correctedTop}`);
  assert.ok(cableInteractionApp.pointIsInsidePanelBounds(cableInteractionApp.wireMidpointForBend(topLeft, topRight, correctedTop)));

  const bottomLeft = { connectorId: 'bottom-left', x: 100, y: 582 };
  const bottomRight = { connectorId: 'bottom-right', x: 700, y: 582 };
  const correctedBottom = cableInteractionApp.bendAdjustedToPanelBounds(bottomLeft, bottomRight, 160);
  assert.ok(correctedBottom < 0, `expected bottom-edge bend to flip upward, got ${correctedBottom}`);
  assert.ok(cableInteractionApp.pointIsInsidePanelBounds(cableInteractionApp.wireMidpointForBend(bottomLeft, bottomRight, correctedBottom)));

  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = Object.assign({}, patchEditorApp.createFullBoardPatchFromTemplate('empty-panel'), {
    cables: [{ id: 'wire_v054', from: 'PLUS1.out', to: 'OUT_X.in', bend: -160 }],
  });
  const wire = cableInteractionApp.integratedWiresFromPatch(model, patch)[0];
  assert.ok(Number.isFinite(wire.bend));
  assert.ok(cableInteractionApp.pointIsInsidePanelBounds(cableInteractionApp.wireMidpointForBend(wire.from, wire.to, wire.bend)));
});

test('browser serialized gallery summarizes patch JSON independently of oscillator panel', () => {
  const examples = serializedGalleryApp.getSerializedGalleryExamples();
  assert.ok(examples.length >= 7);
  const patch = serializedGalleryApp.getSerializedGalleryPatch('multiplier-product');
  const summary = serializedGalleryApp.summarizeSerializedPatch(patch);
  assert.strictEqual(summary.componentCount, 6);
  assert.strictEqual(summary.cableCount, 5);
  assert.ok(summary.outputNames.includes('product'));
});


test('hybrid voltage conversion maps machine units to shifted microcontroller range', () => {
  assertAlmost(machineUnitToShiftedHybridVolts(-1), 0.64);
  assertAlmost(machineUnitToShiftedHybridVolts(0), 1.64);
  assertAlmost(machineUnitToShiftedHybridVolts(1), 2.64);
  assertAlmost(shiftedHybridVoltsToMachineUnit(2.14), 0.5);
});

test('hybrid control pins choose explicit operation modes with safe halt fallback', () => {
  assert.strictEqual(modeFromHybridPins({ op: true }), MODES.OP);
  assert.strictEqual(modeFromHybridPins({ ic: true, op: true }), MODES.IC);
  assert.strictEqual(modeFromHybridPins({ halt: true, op: true }), MODES.HALT);
  assert.strictEqual(modeFromHybridPins({}), MODES.HALT);
});

test('hybrid adapter captures output details as shifted-voltage frames', () => {
  const payload = runSerializedGalleryExample('static-inverter');
  const point = payload.result.trace[0];
  const frame = outputDetailsToHybridFrame(point.outputDetails, { x: 'y' });
  assertAlmost(frame.x.machineUnit, -0.6);
  assertAlmost(frame.x.shiftedVolts, 1.04);
  const adapter = new HybridPortAdapter({ signalMap: { y: 'y' }, controlPins: { op: true } });
  assert.strictEqual(adapter.getControlMode(), MODES.OP);
  const captured = adapter.captureTracePoint(point);
  assertAlmost(captured.frame.y.rcaVolts, -0.6);
});

test('multi-board patch definition prefixes board-local component and socket ids', () => {
  const definition = createMultiBoardPatchDefinition(twoBoardMinionSystemDefinition());
  assert.ok(definition.components.some((component) => component.id === 'master__INV1'));
  assert.ok(definition.components.some((component) => component.id === 'minion__P1'));
  assert.ok(definition.connections.some((connection) => connection.from === 'master__INV1.out' && connection.to === 'minion__P1.in'));
  assert.strictEqual(prefixSocketId('boardA', 'OUT_Y.out'), 'boardA__OUT_Y.out');
});

test('multi-board master/minion system runs through the existing patch solver', () => {
  const system = createTwoBoardMinionSystem();
  const summary = system.summarize();
  assert.strictEqual(summary.boardCount, 2);
  assert.strictEqual(summary.masterBoard, 'master');
  assert.deepStrictEqual(summary.minionBoards, ['minion']);
  assert.strictEqual(summary.interBoardCableCount, 1);
  const result = system.run({ mode: MODES.OP, duration: 0, dt: 0.01, sampleEvery: 1 });
  assertAlmost(result.trace[0].outputs.masterY, -0.6);
  assertAlmost(result.trace[0].outputs.minionY, -0.3);
});

test('multi-board demo exposes hybrid frame for master and minion outputs', () => {
  const payload = runTwoBoardMinionDemo();
  assertAlmost(payload.result.trace[0].outputs.minionY, -0.3);
  assertAlmost(payload.hybridFrame.x.machineUnit, -0.6);
  assertAlmost(payload.hybridFrame.y.shiftedVolts, 1.34);
});


test('imperfection spec normalization keeps ideal behavior opt-in', () => {
  const disabled = normalizeImperfectionSpec(false);
  const enabled = normalizeImperfectionSpec({ seed: 44, noiseStdDev: 0.001, toleranceStdDev: 0.02 });
  assert.strictEqual(disabled.enabled, false);
  assert.strictEqual(enabled.enabled, true);
  assert.strictEqual(enabled.seed, 44);
  assert.strictEqual(enabled.noiseStdDev, 0.001);
});

test('optional output offset and drift perturb socket values deterministically', () => {
  const machine = new PatchMachine({
    name: 'offset drift smoke test',
    components: [{ id: 'C', type: 'constant', value: 0.4 }],
    outputs: { y: 'C.out' },
    imperfections: { enabled: true, outputOffset: 0.1, driftPerSecond: 0.02 },
  });
  assertAlmost(machine.evaluate({}, { time: 0 }).outputs.y, 0.5);
  assertAlmost(machine.evaluate({}, { time: 5 }).outputs.y, 0.6);
});

test('component tolerances modify coefficients without changing ideal default patches', () => {
  const ideal = new PatchMachine({
    name: 'ideal coefficient smoke test',
    components: [
      { id: 'C', type: 'constant', value: 1 },
      { id: 'P', type: 'potentiometer', coefficient: 0.5 },
    ],
    connections: [{ from: 'C.out', to: 'P.in' }],
    outputs: { y: 'P.out' },
  });
  const imperfect = new PatchMachine({
    name: 'toleranced coefficient smoke test',
    components: [
      { id: 'C', type: 'constant', value: 1 },
      { id: 'P', type: 'potentiometer', coefficient: 0.5 },
    ],
    connections: [{ from: 'C.out', to: 'P.in' }],
    outputs: { y: 'P.out' },
    imperfections: { enabled: true, componentTolerances: { 'P.coefficient': 0.1 } },
  });
  assertAlmost(ideal.evaluate().outputs.y, 0.5);
  assertAlmost(imperfect.evaluate().outputs.y, 0.55);
});

test('seeded noise is deterministic for equal seeds and different for different seeds', () => {
  const definition = (seed) => ({
    name: 'noise smoke test',
    components: [{ id: 'C', type: 'constant', value: 0.25 }],
    outputs: { y: 'C.out' },
    imperfections: { enabled: true, seed, noiseStdDev: 0.01 },
  });
  const a = new PatchMachine(definition(101)).evaluate({}, { time: 1.25 }).outputs.y;
  const b = new PatchMachine(definition(101)).evaluate({}, { time: 1.25 }).outputs.y;
  const c = new PatchMachine(definition(102)).evaluate({}, { time: 1.25 }).outputs.y;
  assertAlmost(a, b);
  assert.ok(Math.abs(a - c) > 1e-12, 'different seeds should produce different deterministic noise samples');
});

test('serialized patches can opt into imperfections and run through mode controller', () => {
  const serialized = withImperfections(dampedOscillationSerializedPatch(), {
    enabled: true,
    seed: 9,
    toleranceStdDev: 0.005,
    noiseStdDev: 0.0001,
    outputOffset: 0.001,
  });
  const machine = createPatchMachineFromSerializedPatch(serialized, { inventory: createThatPrototypeInventory() });
  const result = runMode(machine, { mode: MODES.OP, duration: 1, dt: 0.01, sampleEvery: 50 });
  assert.strictEqual(machine.imperfections.isActive(), true);
  assert.strictEqual(result.trace.length, 3);
  assert.ok(Math.abs(result.trace[0].outputs.velocity - 1) > 1e-6, 'imperfections should perturb the visible output');
});

test('imperfection demo compares ideal and imperfect damped-oscillator traces', () => {
  const payload = runImperfectionDemo({ duration: 2, dt: 0.01, sampleEvery: 50, imperfections: { seed: 3, noiseStdDev: 0.0005 } });
  assert.strictEqual(payload.ideal.trace.length, payload.imperfect.trace.length);
  assert.ok(Math.abs(payload.deltaAtFinalSample.velocity) > 1e-8 || Math.abs(payload.deltaAtFinalSample.position) > 1e-8);
});

test('education app explains machine-unit physical scales', () => {
  const scaled = educationApp.describeMachineUnit(1.2);
  assert.strictEqual(scaled.overloaded, true);
  assertAlmost(scaled.panelVolts, 12);
  assertAlmost(scaled.rcaVolts, 1.2);
  assertAlmost(scaled.shiftedHybridVolts, 2.84);
  assertAlmost(scaled.clippedMachineUnit, 1);
  const rows = educationApp.machineUnitGuideRows([-1, 0, 1]);
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows[0].panelVolts, -10);
});

test('education app summarizes overloads and coefficient setup', () => {
  const trace = [
    { t: 0, outputs: { y: 0.5 } },
    { t: 1, outputs: { y: 1.25 }, outputDetails: { y: { machineUnit: 1.25, socket: 'OUT_Y.out', overloaded: true } } },
  ];
  const overload = educationApp.overloadSummaryFromTrace(trace);
  assert.strictEqual(overload.overloaded, true);
  assert.deepStrictEqual(overload.overloadedSockets, ['OUT_Y.out']);
  const guide = educationApp.coefficientSetupGuide(patchEditorApp.createEditableDampedPatch({ k: 0.4, d: 0.3, invMass: 0.7 }));
  assert.strictEqual(guide.mode, 'COEFF');
  assert.strictEqual(guide.coefficientCount, 3);
  assert.ok(guide.coefficients.some((row) => row.id === 'P3' && row.coefficient === 0.7));
});

test('education app summarizes hybrid frames and multi-board definitions', () => {
  const demo = runTwoBoardMinionDemo();
  const hybridSummary = educationApp.summarizeHybridFrame(demo.hybridFrame);
  assert.strictEqual(hybridSummary.signalCount, 2);
  assert.ok(hybridSummary.rows.some((row) => row.signal === 'x' && row.machineUnit === -0.6));
  const multiboardSummary = educationApp.summarizeMultiBoardDefinition(twoBoardMinionSystemDefinition());
  assert.strictEqual(multiboardSummary.boardCount, 2);
  assert.strictEqual(multiboardSummary.interBoardLinkCount, 1);
});

test('cable interaction app creates preview cable paths for pointer dragging', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const target = cableInteractionApp.listPanelSockets(model).find((socket) => socket.id === 'I1.in1');
  const preview = cableInteractionApp.createPreviewCable(model, 'P3.out', target.position);
  assert.strictEqual(preview.validTarget, true);
  assert.deepStrictEqual(preview.normalizedCable, { from: 'P3.out', to: 'I1.in1' });
  assert.ok(cableInteractionApp.previewCablePath(preview).startsWith('M '));
});





test('custom design schema imports patch metadata coefficients cables and operation defaults', () => {
  const patch = dampedOscillationSerializedPatch({ k: 0.45, d: 0.35, invMass: 0.55 });
  const design = designFromSerializedPatch(patch, {
    name: 'Imported oscillator design',
    author: 'test harness',
    tags: ['quickstart', 'design'],
    operationDefaults: { mode: MODES.OP, duration: 12, dt: 0.02, sampleEvery: 5, opTime: 4, cycles: 2, clip: true },
    now: '2026-05-26T00:00:00.000Z',
  });
  assert.strictEqual(design.schemaVersion, DESIGN_SCHEMA_VERSION);
  assert.strictEqual(design.metadata.name, 'Imported oscillator design');
  assert.strictEqual(design.metadata.author, 'test harness');
  assert.deepStrictEqual(design.metadata.tags, ['quickstart', 'design']);
  assert.strictEqual(design.coefficients.P1, 0.45);
  assert.strictEqual(design.coefficients.P2, 0.35);
  assert.strictEqual(design.coefficients.P3, 0.55);
  assert.strictEqual(design.cables[0].from.logicalSocketId, 'PLUS1.out');
  assert.strictEqual(design.cables[0].from.physicalSocketId, null);
  assert.strictEqual(design.outputRouting.channels.X, 'OUT_X.out');
  assert.strictEqual(design.outputRouting.channels.Y, 'OUT_Y.out');
  assert.strictEqual(design.operationDefaults.mode, MODES.OP);
  assert.strictEqual(design.operationDefaults.clip, true);
});

test('custom design JSON round-trips and rebuilds an equivalent patch machine', () => {
  const patch = dampedOscillationSerializedPatch({ k: 0.4, d: 0.3, invMass: 0.6 });
  const design = designFromSerializedPatch(patch, { now: '2026-05-26T00:00:00.000Z' });
  const roundTrip = designRoundTripPayload(design);
  assert.strictEqual(roundTrip.ok, true);
  const patchAgain = serializedPatchFromDesign(roundTrip.design);
  assert.strictEqual(patchAgain.schemaVersion, PATCH_SCHEMA_VERSION);
  assert.strictEqual(patchAgain.components.find((component) => component.id === 'P1').coefficient, 0.4);
  assert.strictEqual(patchAgain.components.find((component) => component.id === 'P2').coefficient, 0.3);
  assert.strictEqual(patchAgain.components.find((component) => component.id === 'P3').coefficient, 0.6);
  assert.deepStrictEqual(patchAgain.cables, patch.cables);
  const machine = createPatchMachineFromDesign(roundTrip.design);
  const result = runMode(machine, MODES.OP, { duration: 2, dt: 0.01, sampleEvery: 20 });
  assert.ok(result.trace.length > 1);
  assert.ok(result.trace[0].outputs.velocity !== undefined);
});

test('custom design schema preserves physical endpoint placeholders without requiring phase-2 mapping', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  design.cables[0].from.physicalSocketId = 'phys.plus1.out.a';
  design.cables[0].to.physicalSocketId = 'phys.i1.ic.a';
  const normalized = normalizeDesign(design);
  const summary = summarizeDesign(normalized);
  assert.strictEqual(summary.hasPhysicalEndpoints, true);
  assert.strictEqual(summary.executableCableCount, normalized.cables.length);
  const patchAgain = serializedPatchFromDesign(normalized);
  assert.strictEqual(patchAgain.cables[0].from, 'PLUS1.out');
  assert.strictEqual(patchAgain.cables[0].to, 'I1.ic');
});


test('physical socket map covers active and display-only panel jacks', () => {
  const inventory = createThatPrototypeInventory();
  const map = createThatPhysicalSocketMap();
  const validation = validatePhysicalSocketMap(map, { inventory });
  assert.strictEqual(map.schemaVersion, PHYSICAL_SOCKET_SCHEMA_VERSION);
  assert.strictEqual(validation.ok, true, validation.errors.join('; '));
  const summary = summarizePhysicalSocketMap(map, { inventory });
  assert.strictEqual(summary.referenceSvg, 'THAT_panel.svg');
  assert.strictEqual(summary.socketCount, 197);
  assert.ok(summary.activeSocketCount > 150);
  assert.strictEqual(summary.displayOnlySocketCount, 22);
  assert.ok(summary.duplicateLogicalSocketCount >= 20);
  assert.strictEqual(summary.groups.COMPARATORS, 12);
  assert.strictEqual(summary.groups.CAPACITORS, 10);
  assert.strictEqual(summary.groups.DIODES, 8);
  assert.strictEqual(summary.groups['Z-DIODES'], 4);
});

test('physical comparator sockets include middle >0 and <0 jacks plus duplicate OUT jacks', () => {
  const map = createThatPhysicalSocketMap();
  const gt = physicalSocketById(map, 'phys.cmp1.gt');
  const lt = physicalSocketById(map, 'phys.cmp1.lt');
  assert.deepStrictEqual(gt.position, { x: 270.33765, y: 390.35791 });
  assert.deepStrictEqual(lt.position, { x: 270.33765, y: 428.2238 });
  assert.strictEqual(gt.logicalSocketId, 'CMP1.positive');
  assert.strictEqual(lt.logicalSocketId, 'CMP1.nonPositive');
  const outs = physicalSocketsByLogicalSocketId(map, 'CMP1.out').filter((socket) => socket.group === 'COMPARATORS');
  assert.strictEqual(outs.length, 2);
  assert.deepStrictEqual(outs.map((socket) => socket.id).sort(), ['phys.cmp1.out.gt', 'phys.cmp1.out.lt']);
  assert.ok(outs.every((socket) => socket.multiplicity.count === 2));
});

test('every active quickstart panel cable endpoint has a physical socket mapping', () => {
  const map = createThatPhysicalSocketMap();
  const model = patchPanelApp.getDampedOscillationPanelModel();
  for (const cable of model.cables) {
    const from = physicalSocketsByLogicalSocketId(map, cable.from).filter((socket) => socket.direction === 'output');
    const to = physicalSocketsByLogicalSocketId(map, cable.to).filter((socket) => socket.direction === 'input');
    assert.ok(from.length > 0, `${cable.from} should have a physical output socket`);
    assert.ok(to.length > 0, `${cable.to} should have a physical input socket`);
  }
});

test('display-only physical sockets cannot silently become executable runtime cables', () => {
  assert.throws(() => logicalSocketIdFromPhysical('phys.cap1.a'), /display-only or unsupported/);
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  design.cables[0].from = { physicalSocketId: 'phys.cap1.a', logicalSocketId: null };
  assert.throws(() => serializedPatchFromDesign(design), /display-only or unsupported/);
});


test('integrated panel editor makes physical capacitor and diode terminals materializable runtime wires', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const connectors = cableInteractionApp.connectorMapForModel(model).map;
  const plus = Array.from(connectors.values()).find((connector) => connector.physicalSocketId === 'phys.plus1.out.a');
  const capA = Array.from(connectors.values()).find((connector) => connector.physicalSocketId === 'phys.cap1.a');
  const capB = Array.from(connectors.values()).find((connector) => connector.physicalSocketId === 'phys.cap1.b');
  const outX = Array.from(connectors.values()).find((connector) => connector.physicalSocketId === 'phys.out.x');
  assert.strictEqual(cableInteractionApp.connectorIsRuntimeAccessoryTerminal(capA), true);
  assert.strictEqual(cableInteractionApp.connectorIsRuntimeAccessoryTerminal(capB), true);

  const patch = {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: 'that-prototype-board/v006',
    name: 'Physical capacitor terminal materialization smoke test',
    components: [{ id: 'PLUS1' }, { id: 'OUT_X' }],
    cables: [],
    outputs: { x: 'OUT_X.out' },
    parameters: { clip: false },
  };
  const first = cableInteractionApp.addIntegratedConnectorWireToPatch(patch, model, plus, capA);
  assert.strictEqual(first.changed, true);
  assert.strictEqual(first.cable.panelOnly, true);
  assert.strictEqual(first.cable.runtimeSupport, 'materializable-physical-accessory');
  assert.strictEqual(first.cable.from, 'PLUS1.out');
  assert.strictEqual(first.cable.to, 'phys.cap1.a');

  const second = cableInteractionApp.addIntegratedConnectorWireToPatch(first.patch, model, capB, outX);
  assert.strictEqual(second.cable.runtimeSupport, 'materializable-physical-accessory');
  assert.strictEqual(second.cable.from, 'phys.cap1.b');
  assert.strictEqual(second.cable.to, 'OUT_X.in');
  const guidance = cableInteractionApp.accessoryPairGuidanceFromPatch(model, second.patch);
  assert.strictEqual(guidance.rows.find((row) => row.accessoryId === 'CAP1').status, 'complete');

  const runtimePayload = browserPatchRuntime.runSerializedPatch(second.patch, { mode: 'OP', duration: 0.1, dt: 0.01, sampleEvery: 10 });
  const runtimeSummary = browserPatchRuntime.summarizeTraceResult(runtimePayload);
  assert.ok(runtimePayload.patch.components.some((component) => component.id === 'CAP1' && component.type === 'capacitor'));
  assert.ok(runtimeSummary.finals.x > 0.09 && runtimeSummary.finals.x < 0.11);
});



test('integrated panel editor auto-materializes physical diode terminal pairs into runtime components', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const connectors = cableInteractionApp.connectorMapForModel(model).map;
  const plus = Array.from(connectors.values()).find((connector) => connector.physicalSocketId === 'phys.plus1.out.a');
  const diodeA = Array.from(connectors.values()).find((connector) => connector.physicalSocketId === 'phys.diode1.a');
  const diodeB = Array.from(connectors.values()).find((connector) => connector.physicalSocketId === 'phys.diode1.b');
  const outX = Array.from(connectors.values()).find((connector) => connector.physicalSocketId === 'phys.out.x');
  assert.strictEqual(cableInteractionApp.connectorIsRuntimeAccessoryTerminal(diodeA), true);
  assert.strictEqual(cableInteractionApp.connectorIsRuntimeAccessoryTerminal(diodeB), true);

  const patch = {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: 'that-prototype-board/v006',
    name: 'Physical diode terminal materialization smoke test',
    components: [{ id: 'PLUS1' }, { id: 'OUT_X' }],
    cables: [],
    outputs: { x: 'OUT_X.out' },
    parameters: { clip: false },
  };
  const first = cableInteractionApp.addIntegratedConnectorWireToPatch(patch, model, plus, diodeA);
  const second = cableInteractionApp.addIntegratedConnectorWireToPatch(first.patch, model, diodeB, outX);
  const normalized = browserPatchRuntime.normalizeSerializedPatch(second.patch);
  assert.ok(normalized.components.some((component) => component.id === 'DIODE1' && component.type === 'diode'));
  assert.ok(normalized.connections.some((connection) => connection.from === 'PLUS1.out' && connection.to === 'DIODE1.in'));
  assert.ok(normalized.connections.some((connection) => connection.from === 'DIODE1.out' && connection.to === 'OUT_X.in'));
  const runtimePayload = browserPatchRuntime.runSerializedPatch(second.patch, { mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 });
  const runtimeSummary = browserPatchRuntime.summarizeTraceResult(runtimePayload);
  assertAlmost(runtimeSummary.finals.x, 1, 1e-12);
});


test('physicalized custom designs can execute using only physical cable endpoint ids', () => {
  const design = physicalizeDesignCables(designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' }));
  assert.ok(design.cables.every((cable) => cable.from.physicalSocketId && cable.to.physicalSocketId));
  const physicalOnly = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.map((cable) => ({
      id: cable.id,
      from: { physicalSocketId: cable.from.physicalSocketId },
      to: { physicalSocketId: cable.to.physicalSocketId },
      label: cable.label,
    })),
  }));
  const patch = serializedPatchFromDesign(physicalOnly);
  assert.strictEqual(patch.cables[0].from, 'PLUS1.out');
  assert.strictEqual(patch.cables[0].to, 'I1.ic');
  const machine = createPatchMachineFromDesign(physicalOnly);
  const state = machine.applyInitialConditions();
  assertAlmost(state.I1, -1);
  const summary = summarizeDesign(physicalOnly);
  assert.strictEqual(summary.hasPhysicalEndpoints, true);
  assert.strictEqual(summary.executableCableCount, 11);
});

test('browser custom design helper smoke-tests patch to design export and import', () => {
  const patch = patchEditorApp.createEditableDampedPatch({ k: 0.25, d: 0.2, invMass: 0.75 });
  const smoke = customDesignApp.smokeTestDesignRoundTrip(patch, { name: 'Browser design smoke' });
  assert.strictEqual(smoke.ok, true);
  assert.strictEqual(smoke.design.schemaVersion, DESIGN_SCHEMA_VERSION);
  assert.strictEqual(smoke.summary.coefficientCount, 8);
  assert.strictEqual(smoke.summary.cableCount, 11);
  assert.strictEqual(smoke.patchAgain.components.find((component) => component.id === 'P3').coefficient, 0.75);
});



test('custom design controls preserve all eight coefficient knobs operation defaults and routing', () => {
  const patch = patchEditorApp.createEditableDampedPatch({ k: 0.25, d: 0.2, invMass: 0.75 });
  const state = controlStateFromPatch(patch);
  assert.deepStrictEqual(COEFFICIENT_CONTROL_IDS, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
  assert.strictEqual(state.coefficients.P8, 0.5);
  state.coefficients.P1 = 0.22;
  state.coefficients.P8 = 0.73;
  state.operation = { mode: MODES.REP, duration: 9, dt: 0.02, sampleEvery: 3, opTime: 2, cycles: 4, clip: true };
  state.outputRouting = { X: 'INV1.out', Y: 'OUT_Y.out', Z: 'I2.out', U: null };
  const edited = patchWithControlState(patch, state);
  assert.strictEqual(edited.components.find((component) => component.id === 'P1').coefficient, 0.22);
  assert.strictEqual(edited.parameters.coefficients.P8, 0.73);
  assert.strictEqual(edited.parameters.mode, MODES.REP);
  assert.strictEqual(edited.parameters.clip, true);
  assert.strictEqual(edited.outputs.x, 'INV1.out');
  assert.strictEqual(edited.outputs.z, 'I2.out');
  const design = designFromSerializedPatch(edited, { now: '2026-05-26T00:00:00.000Z' });
  assert.strictEqual(design.coefficients.P8, 0.73);
  assert.strictEqual(design.operationDefaults.mode, MODES.REP);
  assert.strictEqual(design.outputRouting.channels.Z, 'I2.out');
  const patchAgain = serializedPatchFromDesign(design);
  assert.strictEqual(patchAgain.parameters.coefficients.P8, 0.73);
  assert.strictEqual(patchAgain.parameters.k, 0.22);
});

test('custom design control presets and warnings expose reset overload and clipping notes', () => {
  const zero = coefficientControlsFromPreset('zero');
  assert.ok(COEFFICIENT_CONTROL_IDS.every((id) => zero[id] === 0));
  const overload = coefficientControlsFromPreset('overload-demo');
  assert.strictEqual(overload.P1, 1);
  assert.strictEqual(overload.P3, 1);
  const warnings = controlWarnings({ coefficients: overload, operation: { mode: MODES.REP, clip: true } });
  assert.ok(!warnings.some((warning) => warning.includes('REP is preserved')));
  assert.ok(warnings.some((warning) => warning.includes('Clipping is enabled')));
  assert.ok(warnings.some((warning) => warning.includes('P1 is set to 1.00')));
});

test('browser custom design controls can edit P4-P8 and X/Y/Z/U routing on a patch', () => {
  const patch = patchEditorApp.createEditableDampedPatch();
  const state = customDesignApp.controlStateFromPatch(patch);
  assert.strictEqual(state.coefficients.P4, 0.5);
  assert.ok(state.socketChoices.some((choice) => choice.value === 'OUT_X.out'));
  state.coefficients.P4 = 0.12;
  state.coefficients.P8 = 0.88;
  state.operation.mode = 'REPF';
  state.operation.clip = true;
  state.outputRouting.X = 'INV1.out';
  state.outputRouting.U = 'I2.out';
  const edited = customDesignApp.patchWithControlState(patch, state);
  assert.strictEqual(edited.parameters.coefficients.P4, 0.12);
  assert.strictEqual(edited.parameters.coefficients.P8, 0.88);
  assert.strictEqual(edited.outputs.x, 'INV1.out');
  assert.strictEqual(edited.outputs.u, 'I2.out');
  const warnings = customDesignApp.controlWarnings(customDesignApp.controlStateFromPatch(edited));
  assert.ok(warnings.some((warning) => warning.includes('Clipping is enabled')));
});



test('custom design validation accepts the physicalized quickstart design', () => {
  const design = physicalizeDesignCables(designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' }));
  const physicalOnly = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.map((cable) => ({ id: cable.id, from: { physicalSocketId: cable.from.physicalSocketId }, to: { physicalSocketId: cable.to.physicalSocketId }, label: cable.label })),
  }));
  const validation = validateCustomDesign(physicalOnly);
  assert.strictEqual(validation.ok, true, validation.errors.join('; '));
  assert.strictEqual(validation.errorCount, 0);
  assert.strictEqual(validation.checkedCableCount, 11);
  const summary = summarizeDesignValidation(physicalOnly);
  assert.strictEqual(summary.ok, true);
  assert.strictEqual(summary.diagnosticCount, 0);
});

test('custom design validation reports unknown physical sockets and repair hints', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  design.cables[0].from = { physicalSocketId: 'phys.missing.socket', logicalSocketId: null };
  const validation = validateCustomDesign(design);
  assert.strictEqual(validation.ok, false);
  assert.ok(diagnosticCodes(validation).includes('unknown-physical-socket'));
  assert.ok(validation.invalidPhysicalSocketIds.includes('phys.missing.socket'));
  assert.ok(validation.repairHints.some((hint) => hint.includes('visible socket')));
});

test('custom design validation reports physical/logical mismatches and accessory gaps', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  design.cables[0].from = { physicalSocketId: 'phys.plus1.out.a', logicalSocketId: 'MINUS1.out' };
  design.cables[1].to = { physicalSocketId: 'phys.cap1.a', logicalSocketId: null };
  const validation = validateCustomDesign(design);
  const codes = diagnosticCodes(validation);
  assert.ok(codes.includes('physical-logical-mismatch'));
  assert.ok(codes.includes('unsupported-accessory-socket'));
  assert.ok(validation.invalidPhysicalSocketIds.includes('phys.plus1.out.a'));
  assert.ok(validation.invalidPhysicalSocketIds.includes('phys.cap1.a'));
  assert.ok(validation.errors.some((message) => message.includes('CAPACITORS')));
});

test('custom design validation detects direction errors and ordinary-input multiple drivers while allowing fan-out', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  design.cables.push({ id: 'extra-driver', from: { logicalSocketId: 'PLUS1.out' }, to: { logicalSocketId: 'I1.in1' }, label: 'second driver' });
  design.cables.push({ id: 'bad-direction', from: { logicalSocketId: 'I1.in1' }, to: { logicalSocketId: 'OUT_Z.in' }, label: 'input used as output' });
  const validation = validateCustomDesign(design);
  const codes = diagnosticCodes(validation);
  assert.ok(codes.includes('multiple-drivers'));
  assert.ok(codes.includes('logical-direction-mismatch'));
  assert.ok(!validation.errors.some((message) => message.includes('I1.out has 2 drivers')), 'output fan-out should be allowed');
});

test('custom design validation detects unconnected required inputs and stateless algebraic cycles', () => {
  const design = normalizeDesign({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    kind: 'custom-design',
    inventory: 'that-prototype-board/v006',
    metadata: { name: 'cycle test' },
    components: [
      { id: 'INV1' },
      { id: 'P1' },
    ],
    coefficients: { P1: 0.5 },
    cables: [
      { id: 'cycle-a', from: { logicalSocketId: 'INV1.out' }, to: { logicalSocketId: 'P1.in' } },
      { id: 'cycle-b', from: { logicalSocketId: 'P1.out' }, to: { logicalSocketId: 'INV1.in' } },
    ],
    outputRouting: { channels: { X: 'INV1.out' } },
    operationDefaults: { mode: MODES.OP, duration: 1, dt: 0.01, sampleEvery: 1, opTime: 1, cycles: 1, clip: false },
  });
  const validation = validateCustomDesign(design);
  assert.ok(diagnosticCodes(validation).includes('stateless-algebraic-cycle'));

  const missing = normalizeDesign({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    kind: 'custom-design',
    inventory: 'that-prototype-board/v006',
    metadata: { name: 'missing required' },
    components: [{ id: 'P1' }],
    cables: [],
    outputRouting: { channels: { X: 'P1.out' } },
    operationDefaults: { mode: MODES.OP, duration: 1, dt: 0.01, sampleEvery: 1, opTime: 1, cycles: 1, clip: false },
  });
  const missingValidation = validateCustomDesign(missing);
  assert.ok(diagnosticCodes(missingValidation).includes('required-input-unconnected'));
  assert.ok(missingValidation.invalidLogicalSocketIds.includes('P1.in'));
});

test('custom design validation exposes invalid-cable SVG metadata helpers', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  design.cables[0].from = { physicalSocketId: 'phys.cap1.a', logicalSocketId: null };
  const validation = validateCustomDesign(design);
  const attrs = validationAttributesForCable('cable-1', validation);
  assert.strictEqual(attrs['data-validation'], 'error');
  assert.strictEqual(attrs['aria-invalid'], 'true');
  assert.ok(attrs['data-validation-codes'].includes('unsupported-accessory-socket'));
  assert.ok(diagnosticCssClassForCable('cable-1', validation).includes('invalid-cable'));
});

test('browser custom design helper returns validation summaries and diagnostics', () => {
  const patch = patchEditorApp.createEditableDampedPatch();
  const design = customDesignApp.designFromPatch(patch, { now: '2026-05-26T00:00:00.000Z' });
  const validation = customDesignApp.validateDesign(design);
  assert.strictEqual(validation.ok, true);
  design.cables[0].from = { physicalSocketId: 'phys.diode1.a', logicalSocketId: null };
  const invalid = customDesignApp.validateDesign(design);
  assert.strictEqual(invalid.ok, false);
  const summary = customDesignApp.summarizeDesignValidation(design);
  assert.strictEqual(summary.byCode['unsupported-accessory-socket'], 1);
});

test('custom design runtime compiles validates and runs selected routed outputs', () => {
  const design = physicalizeDesignCables(designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' }));
  const compiled = compileDesignForRuntime(design);
  assert.strictEqual(compiled.validation.ok, true);
  assert.strictEqual(compiled.patch.connections.length, 11);
  const names = availableDesignOutputNames(design);
  assert.ok(names.includes('x'));
  assert.ok(names.includes('y'));
  assert.deepStrictEqual(selectedOutputNamesFromDesign(design, { selectedChannels: ['X', 'Y'] }), ['x', 'y']);
  const operation = normalizeDesignRunOptions(design, { mode: MODES.OP, duration: 0.4, dt: 0.01, sampleEvery: 10, selectedChannels: ['X', 'Y'] });
  assert.strictEqual(operation.mode, MODES.OP);
  assert.deepStrictEqual(operation.selectedOutputNames, ['x', 'y']);
  const payload = runCustomDesign(design, { mode: MODES.OP, duration: 0.4, dt: 0.01, sampleEvery: 10, selectedChannels: ['X', 'Y'] });
  assert.strictEqual(payload.validation.ok, true);
  assert.strictEqual(payload.result.mode, MODES.OP);
  assert.ok(payload.result.trace.length > 1);
  assert.deepStrictEqual(Object.keys(payload.result.trace[0].outputs), ['x', 'y']);
  assert.strictEqual(payload.summary.sampleCount, payload.result.trace.length);
});

test('custom design runtime supports IC HALT REP and REPF operation defaults', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  design.operationDefaults = { mode: MODES.REPF, duration: 0.2, dt: 0.01, sampleEvery: 5, opTime: 0.2, cycles: 2, clip: false };
  const ic = runCustomDesign(design, { mode: MODES.IC, selectedOutputNames: ['x'] });
  assert.strictEqual(ic.result.mode, MODES.IC);
  assert.strictEqual(ic.result.trace.length, 1);
  const halt = runCustomDesign(design, { mode: MODES.HALT, duration: 0.2, dt: 0.01, sampleEvery: 5, selectedOutputNames: ['x'] });
  assert.strictEqual(halt.result.mode, MODES.HALT);
  assert.ok(halt.result.trace.every((point) => JSON.stringify(point.state) === JSON.stringify(halt.result.trace[0].state)));
  const rep = runCustomDesign(design, { mode: MODES.REP, selectedOutputNames: ['x'] });
  assert.strictEqual(rep.result.mode, MODES.REP);
  assert.strictEqual(rep.operation.requestedMode, MODES.REP);
  assert.strictEqual(rep.result.trace.filter((point) => point.trigger).length, 2);
  assert.ok(rep.result.trace.every((point) => point.mode === MODES.REP));
  const repf = runCustomDesign(design, { selectedOutputNames: ['x'] });
  assert.strictEqual(repf.result.mode, MODES.REPF);
  assert.strictEqual(repf.result.trace.filter((point) => point.trigger).length, 2);
});

test('custom design runtime exports trace metadata and overload diagnostics', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch({ k: 1, d: 0.05, invMass: 1 }), {
    name: 'Exportable custom run',
    now: '2026-05-26T00:00:00.000Z',
    operationDefaults: { mode: MODES.OP, duration: 0.4, dt: 0.01, sampleEvery: 10, opTime: 0.2, cycles: 1, clip: false },
  });
  const run = runCustomDesign(design, { selectedOutputNames: ['x', 'y'] });
  const summary = summarizeDesignRunResult(run);
  assert.strictEqual(summary.sampleCount, run.result.trace.length);
  assert.deepStrictEqual(summary.selectedOutputNames, ['x', 'y']);
  const exported = designTraceExportPayload(run, { generatedAt: '2026-05-26T01:02:03.000Z' });
  assert.strictEqual(exported.payload.schemaVersion, DESIGN_TRACE_SCHEMA_VERSION);
  assert.strictEqual(exported.payload.designMetadata.name, 'Exportable custom run');
  assert.ok(exported.byteLength > 1000);
  assert.ok(exported.json.includes('"trace"'));
});

test('custom design runtime compares equivalent design and patch execution', () => {
  const patch = dampedOscillationSerializedPatch({ k: 0.42, d: 0.31, invMass: 0.58 });
  const design = designFromSerializedPatch(patch, { now: '2026-05-26T00:00:00.000Z' });
  const comparison = compareDesignExecutionWithPatch(design, patch, { mode: MODES.OP, duration: 0.3, dt: 0.01, sampleEvery: 10, selectedOutputNames: ['x', 'position'] });
  assert.strictEqual(comparison.ok, true);
  assert.strictEqual(comparison.sampleCountDelta, 0);
  assert.ok(comparison.maxOutputDelta < 1e-12);
});


test('custom design storage exports imports and converts legacy patch JSON', () => {
  const patch = dampedOscillationSerializedPatch({ k: 0.33, d: 0.22, invMass: 0.66 });
  const design = designFromSerializedPatch(patch, { name: 'Storable design', now: '2026-05-26T00:00:00.000Z' });
  const exported = createDesignExportPayload(design, { filename: 'storable.design.json', now: '2026-05-26T00:00:00.000Z' });
  assert.strictEqual(exported.filename, 'storable.design.json');
  assert.ok(exported.json.endsWith('\n'));
  assert.strictEqual(exported.design.schemaVersion, DESIGN_SCHEMA_VERSION);
  const importedDesign = parseDesignImportText(exported.json);
  assert.strictEqual(importedDesign.ok, true);
  assert.strictEqual(importedDesign.sourceKind, 'design');
  assert.strictEqual(importedDesign.design.coefficients.P3, 0.66);
  const importedPatch = parseDesignImportText(JSON.stringify(patch), { name: 'Patch import design', now: '2026-05-26T00:00:00.000Z' });
  assert.strictEqual(importedPatch.ok, true);
  assert.strictEqual(importedPatch.sourceKind, 'patch');
  assert.strictEqual(importedPatch.design.metadata.name, 'Patch import design');
  assert.strictEqual(importedPatch.design.sourcePatchSchemaVersion, PATCH_SCHEMA_VERSION);
  const smoke = smokeTestDesignImportExport(design, { now: '2026-05-26T00:00:00.000Z' });
  assert.strictEqual(smoke.ok, true);
  assert.strictEqual(smoke.roundTripEqual, true);
  assert.strictEqual(smoke.validationOk, true);
  assert.strictEqual(smoke.patchOk, true);
});

test('custom design drafts save load and clear through storage abstraction', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { name: 'Draft design', now: '2026-05-26T00:00:00.000Z' });
  const storage = memoryDraftStorage();
  const envelope = saveDesignDraft(storage, design, { now: '2026-05-26T01:02:03.000Z' });
  assert.strictEqual(envelope.schemaVersion, DESIGN_DRAFT_SCHEMA_VERSION);
  assert.strictEqual(envelope.key, DEFAULT_DRAFT_KEY);
  assert.ok(storage.getItem(DEFAULT_DRAFT_KEY).includes('Draft design'));
  const loaded = loadDesignDraft(storage);
  assert.strictEqual(loaded.ok, true);
  assert.strictEqual(loaded.design.metadata.name, 'Draft design');
  assert.strictEqual(loaded.validation.ok, true);
  const cleared = clearDesignDraft(storage);
  assert.strictEqual(cleared.ok, true);
  assert.strictEqual(loadDesignDraft(storage).ok, false);
});

test('custom design gallery visible list is limited to First Steps booklet design JSON entries', () => {
  const entries = listDesignGalleryEntries();
  assert.strictEqual(entries.length, 14);
  assert.ok(entries.every((entry) => entry.id.startsWith('first-steps-') && /\.design\.json$/.test(entry.file)));
  const decay = loadDesignGalleryDesign('first-steps-radioactive-decay');
  assert.strictEqual(decay.schemaVersion, DESIGN_SCHEMA_VERSION);
  assert.ok(/First Steps v2 Section 9\.1|static custom-design gallery/.test(decay.metadata.source));
  assert.strictEqual(validateCustomDesign(decay).ok, true);
  const run = runCustomDesign(decay, { mode: MODES.REPF, opTime: 4, cycles: 1, dt: 0.01, sampleEvery: 400, selectedOutputNames: ['x'] });
  assert.ok(run.result.trace[0].outputs.x > run.result.trace[run.result.trace.length - 1].outputs.x);
  const gallerySummary = summarizeDesignGallery();
  assert.ok(gallerySummary.every((entry) => entry.valid));
  assert.ok(gallerySummary.some((entry) => entry.id === 'first-steps-bouncing-ball'));
  const hiddenEntries = listDesignGalleryEntries({ includeNonBookletExamples: true });
  assert.ok(hiddenEntries.some((entry) => entry.id === 'multiplier-product' && /\.design\.json$/.test(entry.file)));
});

test('browser custom design helper imports design JSON patch JSON drafts and gallery designs', () => {
  const patch = patchEditorApp.createEditableDampedPatch({ k: 0.41, d: 0.21, invMass: 0.61 });
  const design = customDesignApp.designFromPatch(patch, { name: 'Browser storable design', now: '2026-05-26T00:00:00.000Z' });
  const exported = customDesignApp.createDesignExportPayload(design, { filename: 'browser.design.json' });
  assert.strictEqual(exported.filename, 'browser.design.json');
  const importedDesign = customDesignApp.parseDesignImportText(exported.json);
  assert.strictEqual(importedDesign.ok, true);
  assert.strictEqual(importedDesign.sourceKind, 'design');
  const importedPatch = customDesignApp.parseDesignImportText(JSON.stringify(patch), { name: 'Browser imported patch design', now: '2026-05-26T00:00:00.000Z' });
  assert.strictEqual(importedPatch.ok, true);
  assert.strictEqual(importedPatch.sourceKind, 'patch');
  const storage = memoryDraftStorage();
  const envelope = customDesignApp.saveDesignDraft(design, { storage, now: '2026-05-26T01:02:03.000Z' });
  assert.strictEqual(envelope.schemaVersion, DESIGN_DRAFT_SCHEMA_VERSION);
  const loaded = customDesignApp.loadDesignDraft({ storage });
  assert.strictEqual(loaded.ok, true);
  assert.strictEqual(loaded.design.metadata.name, 'Browser storable design');
  const galleryEntries = customDesignApp.listCustomDesignGallery();
  assert.ok(galleryEntries.some((entry) => entry.id === 'first-steps-radioactive-decay'));
  assert.ok(!galleryEntries.some((entry) => entry.id === 'comparator-switch'));
  const decay = customDesignApp.loadCustomDesignGalleryDesign('first-steps-radioactive-decay');
  assert.strictEqual(decay.metadata.name, 'First Steps: Radioactive Decay');
  assert.strictEqual(customDesignApp.validateDesign(decay).ok, true);
  const hiddenGalleryEntries = customDesignApp.listCustomDesignGallery({ includeNonBookletExamples: true });
  assert.ok(hiddenGalleryEntries.some((entry) => entry.id === 'comparator-switch'));
  assert.strictEqual(customDesignApp.clearDesignDraft({ storage }).ok, true);
});

test('browser custom design helper runs and exports a custom design trace', () => {
  const patch = patchEditorApp.createEditableDampedPatch({ k: 0.3, d: 0.2, invMass: 0.7 });
  const payload = customDesignApp.runCustomDesignFromPatch(patch, { mode: MODES.OP, duration: 0.2, dt: 0.01, sampleEvery: 5, selectedOutputNames: ['x'] });
  assert.strictEqual(payload.result.mode, MODES.OP);
  assert.deepStrictEqual(Object.keys(payload.result.trace[0].outputs), ['x']);
  const exported = customDesignApp.designTraceExportPayload(payload, { generatedAt: '2026-05-26T01:02:03.000Z' });
  assert.strictEqual(exported.payload.schemaVersion, DESIGN_TRACE_SCHEMA_VERSION);
  assert.ok(exported.payload.summary.outputNames.includes('x'));
});

test('custom design templates expose blank plus First Steps booklet walkthrough templates', () => {
  const entries = listDesignTemplateEntries();
  assert.strictEqual(entries.length, 15);
  assert.ok(entries.some((entry) => entry.id === 'blank-design' && /starter/.test(entry.category)));
  assert.ok(entries.some((entry) => entry.id === 'first-steps-radioactive-decay' && entry.sourceDesignId === 'first-steps-radioactive-decay'));
  assert.ok(entries.every((entry) => entry.id === 'blank-design' || entry.id.startsWith('first-steps-')));
  const blank = loadDesignTemplate('blank-design');
  assert.strictEqual(blank.schemaVersion, TEMPLATE_SCHEMA_VERSION);
  assert.strictEqual(blank.design.metadata.name, 'Blank zero-output design');
  assert.ok(blank.walkthrough.length >= 2);
  const decay = loadDesignTemplate('first-steps-radioactive-decay');
  assert.ok(templateWalkthroughText(decay).includes('decay')); 
  const summary = summarizeDesignTemplate('first-steps-bouncing-ball');
  assert.strictEqual(summary.sourceDesignId, 'first-steps-bouncing-ball');
  assert.ok(summary.cableCount >= 5);
  const hiddenSummary = summarizeDesignTemplate('multiplier-product', { includeNonBookletExamples: true });
  assert.strictEqual(hiddenSummary.sourceDesignId, 'multiplier-product');
});

test('custom design templates instantiate validate and run every template', () => {
  const verification = verifyDesignTemplates();
  assert.strictEqual(verification.schemaVersion, TEMPLATE_SCHEMA_VERSION);
  assert.ok(verification.templateCount >= 8);
  assert.strictEqual(verification.ok, true);
  assert.strictEqual(verification.runnableCount, verification.templateCount);
  for (const result of verification.results) {
    assert.strictEqual(result.validationOk, true, `${result.id} should validate`);
    assert.strictEqual(result.runOk, true, `${result.id} should run`);
    assert.ok(result.sampleCount > 0, `${result.id} should produce at least one sample`);
    assert.ok(result.walkthroughStepCount > 0, `${result.id} should have walkthrough text`);
  }
  const decayRun = runDesignTemplate('first-steps-radioactive-decay', { runOptions: { mode: MODES.REPF, opTime: 4, cycles: 1, dt: 0.01, sampleEvery: 400 } });
  assert.strictEqual(decayRun.ok, true);
  assert.ok(decayRun.summary.finals.x < 0.5);
  const blankRun = runDesignTemplate('blank-design');
  assert.strictEqual(blankRun.summary.finals.y, 0);
  const instance = instantiateDesignTemplate('first-steps-hunter-prey', { name: 'Instantiated Hunter/Prey demo', now: '2026-05-26T02:00:00.000Z' });
  assert.strictEqual(instance.metadata.name, 'Instantiated Hunter/Prey demo');
  assert.ok(instance.metadata.tags.includes('template-instance'));
  assert.strictEqual(validateDesignTemplate(loadDesignTemplate('first-steps-hunter-prey')).ok, true);
  const hiddenSlowRun = runDesignTemplate('slow-integrator-ramp', { includeNonBookletExamples: true });
  assert.strictEqual(hiddenSlowRun.ok, true);
});



test('custom design accessories catalog capacitors diodes z-diodes feedback and ground ties', () => {
  const summary = summarizePanelAccessories();
  assert.strictEqual(summary.schemaVersion, ACCESSORY_SCHEMA_VERSION);
  assert.strictEqual(summary.byType.capacitor, 5);
  assert.strictEqual(summary.byType.diode, 4);
  assert.strictEqual(summary.byType['z-diode'], 2);
  assert.strictEqual(summary.runtimeSupportedCount, 19);
  assert.strictEqual(summary.byType.feedback, 4);
  assert.strictEqual(summary.byType['ground-tie'], 4);
  const cap = accessoryByTerminalId('phys.cap1.a');
  assert.strictEqual(cap.type, 'capacitor');
  assert.strictEqual(cap.value, '100p');
  assert.strictEqual(cap.matchedTerminal.terminal, 'a');
  assert.ok(Math.abs(cap.valueFarads - 100e-12) < 1e-18);
});

test('custom design accessories expose nonlinear helper models and matching runtime component support', () => {
  const forward = evaluateIdealDiode(0.3, -0.1);
  const reverse = evaluateIdealDiode(-0.1, 0.3);
  assert.strictEqual(forward.conducting, true);
  assert.strictEqual(reverse.state, 'reverse-blocking');
  const zener = evaluateZDiode(-0.9, 0, { zenerVoltage: 0.68 });
  assert.strictEqual(zener.state, 'reverse-breakdown');
  assert.ok(Math.abs(capacitorChargeDelta(100e-9, 0.5) - 50e-9) < 1e-18);
  assert.strictEqual(summarizePanelAccessories().runtimeSupportedCount, 19);
});

test('custom design accessory diagnostics classify unsupported terminals and XIR-SJ helpers', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  design.cables.push({ id: 'cap-use', from: { physicalSocketId: 'phys.cap1.a' }, to: { logicalSocketId: 'I3.in1' } });
  const validation = validateCustomDesign(design);
  assert.strictEqual(validation.ok, false);
  const capDiagnostic = validation.diagnostics.find((entry) => entry.cableId === 'cap-use');
  assert.strictEqual(capDiagnostic.accessoryType, 'capacitor');
  assert.strictEqual(capDiagnostic.accessoryCode, 'unsupported-capacitor-socket');
  assert.ok(/explicit D\*, ZD\*, or CAP\*/.test(capDiagnostic.hint));
  const use = summarizeAccessoryUse(design);
  assert.strictEqual(use.unsupportedByType.capacitor, 1);
  assert.ok(use.accessoryCableIds.includes('cap-use'));
  const xirDesign = loadDesignGalleryDesign('xir-summing-junction', { includeNonBookletExamples: true });
  const helpers = findXirSjHelpers(xirDesign);
  assert.ok(helpers.some((helper) => helper.xirId === 'XIR1' && helper.targetSocketId === 'SUM1.sj'));
});

test('physical accessory bridge materializes complete capacitor diode and Z-diode terminal wiring', () => {
  function accessoryBridgeDesign(id, terminalA, terminalB) {
    return normalizeDesign({
      schemaVersion: DESIGN_SCHEMA_VERSION,
      kind: 'custom-design',
      inventory: 'that-prototype-board/v006',
      metadata: { name: `Bridge ${id}`, tags: ['test'] },
      components: [{ id: 'PLUS1' }, { id: 'OUT_X' }],
      cables: [
        { id: `${id}-source`, from: { logicalSocketId: 'PLUS1.out' }, to: { physicalSocketId: terminalA } },
        { id: `${id}-sink`, from: { physicalSocketId: terminalB }, to: { logicalSocketId: 'OUT_X.in' } },
      ],
      outputRouting: { channels: { X: 'OUT_X.out' }, aliases: {} },
      operationDefaults: { mode: MODES.OP, duration: 0.1, dt: 0.01, sampleEvery: 10, opTime: 1, cycles: 1 },
    });
  }

  const capacitorDesign = accessoryBridgeDesign('cap1', 'phys.cap1.a', 'phys.cap1.b');
  const capacitorBridge = materializePhysicalAccessoriesFromDesign(capacitorDesign);
  assert.strictEqual(capacitorBridge.materializedCount, 1);
  assert.strictEqual(capacitorBridge.materializedAccessories[0].componentId, 'CAP1');
  assert.strictEqual(capacitorBridge.design.components.find((component) => component.id === 'CAP1').valueFarads, 100e-12);
  const capacitorPreview = previewPhysicalAccessoryMaterialization(capacitorDesign);
  assert.strictEqual(capacitorPreview.kind, 'physical-accessory-materialization-preview');
  assert.strictEqual(capacitorPreview.materializedCount, 1);
  assert.strictEqual(capacitorPreview.materializedAccessories[0].generatedComponent.type, 'capacitor');
  assert.deepStrictEqual(capacitorPreview.materializedAccessories[0].generatedCableIds, ['cap1-source__CAP1_in', 'CAP1_out__cap1-sink']);
  assert.strictEqual(capacitorPreview.canConvert, true);
  const capacitorValidation = validateCustomDesign(capacitorDesign);
  assert.strictEqual(capacitorValidation.ok, true, capacitorValidation.errors.join('; '));
  assert.strictEqual(capacitorValidation.accessoryBridge.materializedCount, 1);
  const capacitorRun = runCustomDesign(capacitorDesign, { duration: 0.1, dt: 0.01, sampleEvery: 10, selectedOutputNames: ['x'] });
  assert.ok(capacitorRun.summary.finals.x > 0.09 && capacitorRun.summary.finals.x < 0.11);

  const diodeDesign = accessoryBridgeDesign('diode1', 'phys.diode1.a', 'phys.diode1.b');
  const diodePatch = serializedPatchFromDesign(diodeDesign);
  assert.strictEqual(diodePatch.components.find((component) => component.id === 'DIODE1').type, 'diode');
  assert.strictEqual(validateCustomDesign(diodeDesign).ok, true);
  assert.strictEqual(runCustomDesign(diodeDesign, { duration: 0, selectedOutputNames: ['x'] }).summary.finals.x, 1);

  const zDiodeDesign = accessoryBridgeDesign('zdiode1', 'phys.zdiode1.a', 'phys.zdiode1.b');
  const zDiodePatch = serializedPatchFromDesign(zDiodeDesign);
  const zComponent = zDiodePatch.components.find((component) => component.id === 'ZDIODE1');
  assert.strictEqual(zComponent.type, 'z-diode');
  assert.strictEqual(zComponent.mode, 'positive-overdrive');
  assert.strictEqual(validateCustomDesign(zDiodeDesign).ok, true);
  assert.ok(Math.abs(runCustomDesign(zDiodeDesign, { duration: 0, selectedOutputNames: ['x'] }).summary.finals.x - 0.32) < 1e-12);
});


test('custom design browser helper renders physical accessory conversion preview', () => {
  const design = normalizeDesign({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    kind: 'custom-design',
    inventory: 'that-prototype-board/v006',
    metadata: { name: 'Browser capacitor conversion preview', tags: ['test'] },
    components: [{ id: 'PLUS1' }, { id: 'OUT_X' }],
    cables: [
      { id: 'cap1-source', from: { logicalSocketId: 'PLUS1.out' }, to: { physicalSocketId: 'phys.cap1.a' } },
      { id: 'cap1-sink', from: { physicalSocketId: 'phys.cap1.b' }, to: { logicalSocketId: 'OUT_X.in' } },
    ],
    outputRouting: { channels: { X: 'OUT_X.out' }, aliases: {} },
    operationDefaults: { mode: MODES.OP, duration: 0.1, dt: 0.01, sampleEvery: 10, opTime: 1, cycles: 1 },
  });
  const preview = customDesignApp.previewPhysicalAccessoryMaterialization(design);
  assert.strictEqual(preview.materializedCount, 1);
  assert.strictEqual(preview.addedComponentIds[0], 'CAP1');
  const bridge = customDesignApp.materializePhysicalAccessoriesForDesign(design);
  assert.strictEqual(bridge.design.components.some((component) => component.id === 'CAP1' && component.type === 'capacitor'), true);
  const validation = validateCustomDesign(design);
  const node = { dataset: {}, innerHTML: '', textContent: '' };
  customDesignApp.renderCustomDesignValidation(node, validation, design);
  assert.strictEqual(node.dataset.valid, 'true');
  assert.ok(node.innerHTML.includes('data-physical-accessory-materialization-preview'));
  assert.ok(node.innerHTML.includes('data-physical-accessory-row=&quot;CAP1&quot;') || node.innerHTML.includes('data-physical-accessory-row="CAP1"'));
  assert.ok(node.innerHTML.includes('data-physical-accessory-materialize="true"'));
  assert.ok(node.innerHTML.includes('cap1-source__CAP1_in'));
});



function normalizePatchForTest(patch) { return JSON.parse(JSON.stringify(patch)); }

function fakeSvgNode(tagName) {
  return { tagName, attrs: {}, children: [], textContent: '', setAttribute(key, value) { this.attrs[key] = String(value); }, appendChild(node) { if (node && node.isFragment) this.children.push(...node.children); else this.children.push(node); return node; }, replaceChildren(...nodes) { this.children = nodes; }, querySelectorAll() { return []; }, querySelector() { return null; }, ownerDocument: null };
}

test('SVG accessory-pair guidance stays model-backed without drawing overlay badges', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const partialPatch = patchEditorApp.createEditableDampedPatch();
  partialPatch.cables.push({ id: 'cap-half', from: 'PLUS1.out', to: 'phys.cap1.a', fromConnectorId: 'minuspluso_02', toConnectorId: 'capacitors_01', panelOnly: true, label: 'half wired CAP1' });
  const partialGuidance = cableInteractionApp.accessoryPairGuidanceFromPatch(model, partialPatch);
  const cap1 = partialGuidance.rows.find((row) => row.accessoryId === 'CAP1');
  assert.strictEqual(cap1.status, 'partial');
  assert.strictEqual(cap1.missingTerminalSocketId, 'phys.cap1.b');
  assert.ok(/connect terminal b to one executable input/i.test(cap1.hint));

  const completePatch = normalizePatchForTest(partialPatch);
  completePatch.cables.push({ id: 'cap-complete', from: 'phys.cap1.b', to: 'OUT_X.in', fromConnectorId: 'capacitors_02', toConnectorId: 'out_01', panelOnly: true, label: 'complete CAP1' });
  const completeGuidance = cableInteractionApp.accessoryPairGuidanceFromPatch(model, completePatch);
  assert.strictEqual(completeGuidance.rows.find((row) => row.accessoryId === 'CAP1').status, 'complete');
  assert.strictEqual(completeGuidance.readyToMaterializeCount >= 1, true);

  const fakeDoc = {
    createDocumentFragment() { return { isFragment: true, children: [], appendChild(node) { this.children.push(node); } }; },
    createElementNS(ns, tagName) { return fakeSvgNode(tagName); },
  };
  const layer = fakeSvgNode('g');
  layer.ownerDocument = fakeDoc;
  const layers = { accessoryGuidanceLayer: layer, svgElement: (tag, attrs) => Object.assign(fakeSvgNode(tag), { attrs: Object.assign({}, attrs || {}) }) };
  cableInteractionApp.renderAccessoryPairGuidanceLayer(layers, completeGuidance);
  assert.deepStrictEqual(layer.children, [], 'v098+ keeps accessory guidance out of the visible SVG overlay layer');
});

test('feedback socket semantics make FB and ground jacks executable', () => {
  const semantics = feedbackSocketSemantics('phys.sum1.fb');
  assert.strictEqual(semantics.executable, true);
  assert.strictEqual(semantics.ownerComponentId, 'SUM1');
  assert.strictEqual(semantics.replacement, 'SUM1.fb');
  assert.strictEqual(semantics.groundedBy, 'ZERO.out');
  assert.ok(/executable/.test(semantics.hint));
  const socketMap = createThatPhysicalSocketMap();
  assert.strictEqual(physicalSocketById(socketMap, 'phys.sum1.fb').displayOnly, false);
  assert.strictEqual(physicalSocketById(socketMap, 'phys.sum1.fb').logicalSocketId, 'SUM1.fb');
  assert.strictEqual(physicalSocketById(socketMap, 'phys.sum1.t').logicalSocketId, 'ZERO.out');
  const design = normalizeDesign({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    kind: 'custom-design',
    inventory: 'that-prototype-board/v006',
    metadata: { name: 'Executable FB smoke test', tags: ['test'] },
    components: [{ id: 'PLUS1' }, { id: 'P1' }, { id: 'ZERO' }, { id: 'SUM1' }, { id: 'OUT_X' }],
    coefficients: { P1: 0.001 },
    cables: [
      { id: 'drive-p1', from: { logicalSocketId: 'PLUS1.out' }, to: { logicalSocketId: 'P1.in' } },
      { id: 'small-sum-input', from: { logicalSocketId: 'P1.out' }, to: { logicalSocketId: 'SUM1.in1' } },
      { id: 'fb-ground', from: { physicalSocketId: 'phys.sum1.t' }, to: { physicalSocketId: 'phys.sum1.fb' } },
      { id: 'sum-output', from: { logicalSocketId: 'SUM1.out' }, to: { logicalSocketId: 'OUT_X.in' } },
    ],
    outputRouting: { channels: { X: 'OUT_X.out' }, aliases: {} },
    operationDefaults: { mode: MODES.OP, duration: 0, dt: 0.01, sampleEvery: 1, opTime: 1, cycles: 1 },
  });
  const validation = validateCustomDesign(design);
  assert.strictEqual(validation.ok, true, validation.errors.join('; '));
  const patch = serializedPatchFromDesign(design);
  assert.ok(patch.cables.some((cable) => cable.from === 'ZERO.out' && cable.to === 'SUM1.fb'));
  assert.strictEqual(runCustomDesign(design, { duration: 0, selectedOutputNames: ['x'] }).summary.finals.x, -1);
});

test('browser custom design helper lists loads instantiates and verifies templates', () => {
  const entries = customDesignApp.listCustomDesignTemplates();
  assert.ok(entries.some((entry) => entry.id === 'blank-design'));
  const template = customDesignApp.loadCustomDesignTemplate('first-steps-mass-spring-damper');
  assert.ok(template.walkthrough.length >= 3);
  const design = customDesignApp.instantiateCustomDesignTemplate(template, { name: 'Browser template instance', now: '2026-05-26T02:00:00.000Z' });
  assert.strictEqual(design.metadata.name, 'Browser template instance');
  const patch = customDesignApp.patchFromDesign(design);
  assert.ok(patch.cables.length >= 11);
  const verification = customDesignApp.verifyCustomDesignTemplates();
  assert.strictEqual(verification.ok, true);
});



test('design usability viewport presets pan and zoom stay bounded and labeled', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const fitWidth = panelViewportForPreset(PANEL_ZOOM_PRESETS.FIT_WIDTH, model, { containerWidth: 900, containerHeight: 500, padding: 0 });
  const fitPanel = panelViewportForPreset(PANEL_ZOOM_PRESETS.FIT_PANEL, model, { containerWidth: 900, containerHeight: 500, padding: 0 });
  assert.strictEqual(fitWidth.schemaVersion, USABILITY_SCHEMA_VERSION);
  assert.ok(fitWidth.scale > fitPanel.scale, 'fit-width should be less constrained than fit-panel on a short container');
  const zoomed = zoomPanelViewport(fitPanel, 99, model);
  assert.strictEqual(zoomed.scale, 4);
  const panned = panPanelViewport(zoomed, 20, -12, model);
  assert.strictEqual(panned.offsetX, 20);
  assert.strictEqual(panned.offsetY, -12);
});

test('design usability labels classify editable unsupported and display-only sockets', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const editable = model.physicalSockets.find((socket) => socket.id === 'phys.cmp1.gt');
  const feedback = model.physicalSockets.find((socket) => socket.id === 'phys.sum1.fb');
  const unsupported = model.physicalSockets.find((socket) => socket.id === 'phys.cap1.a');
  const displayOnly = { id: 'mock.display', label: 'display only', direction: 'display-only', displayOnly: true, unsupported: false };
  assert.strictEqual(socketVisualState(editable).status, 'editable');
  assert.strictEqual(socketVisualState(feedback).status, 'editable');
  assert.strictEqual(socketVisualState(unsupported).status, 'unsupported');
  assert.strictEqual(socketVisualState(displayOnly).status, 'display-only');
  assert.ok(socketAccessibilityLabel(editable).includes('logical CMP1.positive'));
  assert.ok(cableAccessibilityLabel(model.cables[0], 0, model).includes('logical PLUS1.out to I1.ic'));
  const summary = summarizeSocketVisualStates(model);
  assert.strictEqual(summary.schemaVersion, USABILITY_SCHEMA_VERSION);
  assert.ok(summary.counts.editable > 150);
  assert.ok(summary.counts.unsupported >= 1);
  assert.ok(summary.counts.unsupported >= 20);
});

test('design usability keyboard navigation and documentation artifacts cover phase 10', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const ordered = orderedKeyboardSockets(model);
  assert.ok(ordered.length > 150);
  const next = nextKeyboardSocket(model, ordered[0].id, 1);
  assert.strictEqual(next.id, ordered[1].id);
  const previous = nextKeyboardSocket(model, ordered[0].id, -1);
  assert.strictEqual(previous.id, ordered[ordered.length - 1].id);
  const checklist = manualBrowserSmokeChecklist();
  assert.ok(checklist.some((item) => item.id === 'zoom-pan'));
  assert.ok(checklist.some((item) => item.id === 'keyboard-wire'));
  const architecture = architectureOverview();
  assert.ok(architecture.layers.some((layer) => /Physical socket map/.test(layer.name)));
  assert.ok(architecture.layers.some((layer) => /Runtime and trace export/.test(layer.name)));
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const usability = designUsabilitySummary(design, model);
  assert.strictEqual(usability.schemaVersion, USABILITY_SCHEMA_VERSION);
  assert.ok(usability.keyboardSocketCount > 150);
  assert.ok(usability.zoomPresets.includes('fit-width'));
});

test('design repair actions expose clickable fixes for invalid custom-design cables', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const broken = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.concat([
      {
        id: 'bad-capacitor',
        from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.plus1.out.a' },
        to: { physicalSocketId: 'phys.cap1.a' },
      },
      {
        id: 'bad-mismatch',
        from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.minus1.out.a' },
        to: { logicalSocketId: 'P1.in', physicalSocketId: 'phys.p1.in' },
      },
    ]),
  }));
  const validation = validateCustomDesign(broken);
  assert.ok(!validation.ok);
  assert.ok(diagnosticCodes(validation).includes('unsupported-accessory-socket'));
  assert.ok(diagnosticCodes(validation).includes('physical-logical-mismatch'));
  const summary = repairSummaryForValidation(validation, broken);
  assert.strictEqual(summary.schemaVersion, DESIGN_REPAIR_SCHEMA_VERSION);
  assert.ok(summary.actionCount >= 2);
  assert.ok(summary.byOperation['remove-cable'] >= 1);
  assert.ok(summary.byOperation['align-endpoint-logical-to-physical'] >= 1);
    const align = summary.actions.find((action) => action.operation === 'align-endpoint-logical-to-physical');
  const aligned = applyRepairAction(broken, align);
  const repairedCable = aligned.design.cables.find((cable) => cable.id === 'bad-mismatch');
  assert.strictEqual(repairedCable.from.logicalSocketId, 'MINUS1.out');
  const remove = repairActionsForValidation(validateCustomDesign(broken), broken).find((action) => action.operation === 'remove-cable' && action.cableId === 'bad-capacitor');
  const removed = applyRepairAction(broken, remove);
  assert.strictEqual(removed.design.cables.some((cable) => cable.id === 'bad-capacitor'), false);
});

test('design repair actions still clear output routes while FB endpoints validate', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const broken = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.concat([{ id: 'fb-target', from: { physicalSocketId: 'phys.sum1.t' }, to: { physicalSocketId: 'phys.sum1.fb' } }]),
    outputRouting: { channels: Object.assign({}, design.outputRouting.channels, { Z: 'P1.in' }), aliases: design.outputRouting.aliases },
  }));
  const validation = validateCustomDesign(broken);
  assert.ok(!diagnosticCodes(validation).includes('unsupported-accessory-socket'));
  const actions = repairActionsForValidation(validation, broken);
  assert.ok(!actions.some((action) => action.operation === 'replace-endpoint-with-logical' && action.cableId === 'fb-target'));
  const clearRoute = actions.find((action) => action.operation === 'clear-output-route' && action.channel === 'Z');
  assert.ok(clearRoute);
  const cleared = applyRepairAction(broken, clearRoute);
  assert.strictEqual(cleared.design.outputRouting.channels.Z, null);
});

test('design history records coefficient route cable and metadata edits with undo redo', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  let history = createDesignHistoryState(design, { now: '2026-05-26T00:00:00.000Z' });
  assert.strictEqual(history.schemaVersion, DESIGN_HISTORY_SCHEMA_VERSION);
  assert.strictEqual(designHistorySummary(history).dirty, false);
  const coefficientEdit = withDesignCoefficient(history.present, 'P1', 0.75, { now: '2026-05-26T00:01:00.000Z' });
  let result = recordDesignHistory(history, coefficientEdit, { label: 'Set P1', editType: 'coefficient', now: '2026-05-26T00:01:00.000Z' });
  history = result.state;
  assert.strictEqual(history.present.coefficients.P1, 0.75);
  assert.strictEqual(designHistorySummary(history).undoCount, 1);
  assert.strictEqual(designHistorySummary(history).dirty, true);
  const routeEdit = withDesignOutputRoute(history.present, 'Z', 'INV1.out', { now: '2026-05-26T00:02:00.000Z' });
  history = recordDesignHistory(history, routeEdit, { label: 'Route Z', editType: 'output-routing' }).state;
  const cableEdit = withAddedDesignCable(history.present, { id: 'history-extra', from: { logicalSocketId: 'PLUS1.out' }, to: { logicalSocketId: 'P2.in' } }, { now: '2026-05-26T00:03:00.000Z' });
  history = recordDesignHistory(history, cableEdit, { label: 'Add cable', editType: 'cable' }).state;
  assert.strictEqual(history.present.cables.some((cable) => cable.id === 'history-extra'), true);
  const removedCable = withoutDesignCable(history.present, 'history-extra', { now: '2026-05-26T00:04:00.000Z' });
  history = recordDesignHistory(history, removedCable, { label: 'Remove cable', editType: 'cable-delete' }).state;
  assert.strictEqual(history.present.cables.some((cable) => cable.id === 'history-extra'), false);
  const undone = undoDesignHistory(history);
  history = undone.state;
  assert.strictEqual(history.present.cables.some((cable) => cable.id === 'history-extra'), true);
  const redone = redoDesignHistory(history);
  history = redone.state;
  assert.strictEqual(history.present.cables.some((cable) => cable.id === 'history-extra'), false);
  history = markDesignHistorySaved(history);
  assert.strictEqual(designHistorySummary(history).dirty, false);
});

test('custom design browser helpers expose repair and history rendering', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const broken = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.concat([{ id: 'browser-bad', from: { logicalSocketId: 'PLUS1.out' }, to: { physicalSocketId: 'phys.cap1.a' } }]),
  }));
  const validation = validateCustomDesign(broken);
  const actions = customDesignApp.repairActionsForValidation(validation, broken);
  assert.ok(actions.some((action) => action.operation === 'remove-cable'));
  const node = { dataset: {}, innerHTML: '', textContent: '' };
  customDesignApp.renderCustomDesignValidation(node, validation, broken);
  assert.strictEqual(node.dataset.valid, 'false');
  assert.ok(node.innerHTML.includes('data-design-repair-action'));
  const history = createDesignHistoryState(design);
  customDesignApp.renderCustomDesignHistoryStatus(node, history);
  assert.ok(node.textContent.includes('Design history'));
});


test('panel polish provides original-style socket labels routes and section summary', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const sections = sectionSpecs();
  assert.strictEqual(sections[0].id, 'COEFF');
  assert.ok(sections.some((section) => section.id === 'COMPARATORS'));
  const cmpSelector = physicalSocketById(model.physicalSocketMap, 'phys.cmp1.gt');
  const label = socketLabelPlacement(cmpSelector);
  assert.strictEqual(label.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.strictEqual(label.text, '>0');
  assert.strictEqual(label.anchor, 'middle');
  const spec = socketRenderSpec(cmpSelector);
  assert.strictEqual(spec.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.strictEqual(spec.status, 'editable');
  assert.ok(spec.className.includes('original-panel-socket'));
  assert.strictEqual(spec.dataAttributes['data-panel-section'], 'COMPARATORS');
  const route = cableRouteSpec(model, model.cables[0], 0);
  assert.strictEqual(route.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.ok(route.path.startsWith('M '));
  assert.ok(route.fromPhysicalSocketId);
  assert.ok(route.toPhysicalSocketId);
  const summary = panelPolishSummary(model);
  assert.strictEqual(summary.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.strictEqual(summary.comparatorMiddleSocketCount, 4);
  assert.ok(summary.duplicateOutputPhysicalJacks >= 20);
  assert.ok(summary.routedCableCount >= model.cables.length);
});

test('panel SVG uses original-style polish metadata for sockets labels and routed cables', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const svg = patchPanelApp.svgForPanelModel(model);
  assert.ok(svg.includes('original-panel-socket'));
  assert.ok(svg.includes('physical-socket-core'));
  assert.ok(svg.includes('data-original-route="true"'));
  assert.ok(svg.includes('data-panel-section="COMPARATORS"'));
  assert.ok(svg.includes('data-label-for="phys.cmp1.gt"'));
  assert.ok(svg.includes('>0</text>'));
  assert.ok(!svg.includes('data-label-for="phys.cap1.a"'));
  assert.ok(!svg.includes('data-label-for="phys.diode1.a"'));
  assert.ok(!svg.includes('data-label-for="phys.zdiode1.a"'));
  assert.ok(!svg.includes('>100p A</text>'));
  assert.ok(!svg.includes('>diode 1 A</text>'));
  assert.ok(!svg.includes('>Z-diode 1 A</text>'));
});

test('repair previews show exact design changes before applying guided repairs', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const broken = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.concat([{ id: 'preview-cap', from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.plus1.out.a' }, to: { physicalSocketId: 'phys.cap1.a' } }]),
  }));
  const validation = validateCustomDesign(broken);
  const actions = repairActionsForValidation(validation, broken);
  const remove = actions.find((action) => action.operation === 'remove-cable' && action.cableId === 'preview-cap');
  assert.ok(remove);
  const preview = previewRepairAction(broken, remove);
  assert.strictEqual(preview.schemaVersion, DESIGN_REPAIR_SCHEMA_VERSION);
  assert.strictEqual(preview.ok, true);
  assert.ok(preview.summaryText.includes('errors'));
  assert.strictEqual(preview.changes.cableChangeCount, 1);
  assert.strictEqual(preview.changes.outputRouteChangeCount, 0);
  assert.strictEqual(preview.changes.cableChanges[0].before.id, 'preview-cap');
  assert.strictEqual(preview.changes.cableChanges[0].after, null);
  const direct = applyRepairAction(broken, remove);
  const diff = designChangeSummary(broken, direct.design, remove);
  assert.deepStrictEqual(diff.cableChanges, preview.changes.cableChanges);
});

test('guided repair workflow ranks non-destructive cable and output-route fixes', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const broken = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.concat([
      { id: 'workflow-mismatch', from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.minus1.out.a' }, to: { logicalSocketId: 'P1.in', physicalSocketId: 'phys.p1.in' } },
      { id: 'workflow-cap', from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.plus1.out.a' }, to: { physicalSocketId: 'phys.cap1.a' } },
    ]),
    outputRouting: { channels: Object.assign({}, design.outputRouting.channels, { Z: 'P1.in' }), aliases: design.outputRouting.aliases },
  }));
  const workflow = guidedRepairWorkflowForValidation(validateCustomDesign(broken), broken);
  assert.strictEqual(workflow.schemaVersion, DESIGN_REPAIR_SCHEMA_VERSION);
  assert.ok(workflow.stepCount >= 3);
  assert.ok(workflow.recommendedStepCount >= 2);
  assert.ok(workflow.destructiveStepCount >= 1);
  assert.strictEqual(workflow.steps[0].destructive, false);
  assert.ok(workflow.steps.some((step) => step.targetKind === 'output-route' && step.channel === 'Z'));
  const previews = previewRepairActionsForValidation(validateCustomDesign(broken), broken);
  assert.strictEqual(previews.length, workflow.actionCount);
  const applied = applyGuidedRepairStep(broken, workflow.steps.find((step) => step.action.operation === 'align-endpoint-logical-to-physical'));
  assert.strictEqual(applied.changed, true);
  assert.strictEqual(applied.design.cables.find((cable) => cable.id === 'workflow-mismatch').from.logicalSocketId, 'MINUS1.out');
});


test('design panel polish builds original-style models for every custom-design template', () => {
  const verification = verifyTemplatePanelModels({ projectRoot: path.resolve(__dirname, '..') });
  assert.strictEqual(verification.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.ok(verification.ok);
  assert.ok(verification.templateCount >= 8);
  assert.ok(verification.nonOscillatorCount >= 6);
  const multiplier = templatePanelModel('multiplier-product', { projectRoot: path.resolve(__dirname, '..'), includeNonBookletExamples: true });
  assert.strictEqual(multiplier.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.strictEqual(multiplier.template.id, 'multiplier-product');
  assert.ok(multiplier.componentIds.includes('MUL1'));
  assert.ok(multiplier.usedPhysicalSocketIds.includes('phys.mul1.x'));
  assert.ok(multiplier.usedPhysicalSocketIds.includes('phys.mul1.out'));
  assert.ok(multiplier.sectionUsage.some((section) => section.id === 'MULTIPLIERS' && section.active));
  assert.strictEqual(multiplier.cableRoutes.length, multiplier.cables.length);
  assert.ok(multiplier.cableRoutes.every((route) => route.fromPhysicalSocketId && route.toPhysicalSocketId));
  const comparator = templatePanelModel('comparator-switch', { projectRoot: path.resolve(__dirname, '..'), includeNonBookletExamples: true });
  assert.ok(comparator.usedPhysicalSocketIds.includes('phys.cmp1.gt'));
  assert.ok(comparator.usedPhysicalSocketIds.includes('phys.cmp1.lt'));
  assert.ok(comparator.sectionUsage.some((section) => section.id === 'COMPARATORS' && section.usedSocketIds.includes('phys.cmp1.gt')));
  const xir = templatePanelModel('xir-summing-junction', { projectRoot: path.resolve(__dirname, '..'), includeNonBookletExamples: true });
  assert.ok(xir.sectionUsage.some((section) => section.id === 'XIR' && section.active));
  assert.ok(xir.usedPhysicalSocketIds.some((id) => id.startsWith('phys.xir1.')));
  const slow = templatePanelModel('slow-integrator-ramp', { projectRoot: path.resolve(__dirname, '..'), includeNonBookletExamples: true });
  assert.ok(slow.usedPhysicalSocketIds.includes('phys.i1.slow'));
});

test('design panel polish creates section usage for arbitrary design objects', () => {
  const design = instantiateDesignTemplate('first-steps-mass-spring-damper', { projectRoot: path.resolve(__dirname, '..') });
  const model = designPanelModelFromDesign(design);
  const summary = panelPolishSummary(model);
  assert.strictEqual(model.kind, 'design-panel-model');
  assert.ok(model.componentIds.includes('SUM1'));
  assert.ok(model.usedLogicalSocketIds.includes('SUM1.in1'));
  assert.ok(model.usedPhysicalSocketIds.includes('phys.sum1.in1'));
  assert.ok(model.sectionUsage.some((section) => section.id === 'SUMMERS' && section.active && section.usedLogicalSocketIds.includes('SUM1.out')));
  assert.strictEqual(summary.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.strictEqual(summary.routedCableCount, model.cables.length);
  assert.ok(summary.activeSectionCount >= 3);
  assert.ok(summary.usedPhysicalSocketCount >= model.cables.length);
});

test('guided batch repair previews and applies multi-step diagnostics', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const broken = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.concat([
      { id: 'batch-mismatch', from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.minus1.out.a' }, to: { logicalSocketId: 'P1.in', physicalSocketId: 'phys.p1.in' } },
      { id: 'batch-cap', from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.plus1.out.a' }, to: { physicalSocketId: 'phys.cap1.a' } },
    ]),
    outputRouting: { channels: Object.assign({}, design.outputRouting.channels, { Z: 'P1.in' }), aliases: design.outputRouting.aliases },
  }));
  const validation = validateCustomDesign(broken);
  assert.ok(validation.errorCount >= 3);
  const preview = previewGuidedRepairBatch(broken, validation, { maxSteps: 6, includeDestructive: true, recommendedOnly: false });
  assert.strictEqual(preview.schemaVersion, DESIGN_REPAIR_SCHEMA_VERSION);
  assert.ok(preview.plannedStepCount >= 3);
  assert.ok(preview.finalValidationPreview.errorCount < validation.errorCount);
  const applied = applyGuidedRepairBatch(broken, validation, { maxSteps: 6, includeDestructive: true, recommendedOnly: false });
  assert.strictEqual(applied.schemaVersion, DESIGN_REPAIR_SCHEMA_VERSION);
  assert.strictEqual(applied.changed, true);
  assert.ok(applied.appliedStepCount >= 3);
  assert.ok(applied.validationAfter.errorCount < applied.initialValidation.errorCount);
  assert.strictEqual(applied.design.cables.some((cable) => cable.id === 'batch-mismatch'), false);
  assert.strictEqual(applied.design.cables.some((cable) => cable.id === 'batch-cap'), false);
  assert.strictEqual(applied.design.outputRouting.channels.Z, null);
  const summary = repairBatchSummary(applied);
  assert.ok(summary.byOperation['align-endpoint-logical-to-physical'] >= 1);
  assert.ok(summary.byOperation['remove-cable'] >= 1);
  assert.ok(summary.byOperation['clear-output-route'] >= 1);
});


test('guided repair sessions apply next skip and apply all interactively', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const broken = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.concat([
      { id: 'session-mismatch', from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.minus1.out.a' }, to: { logicalSocketId: 'P1.in', physicalSocketId: 'phys.p1.in' } },
      { id: 'session-cap', from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.plus1.out.a' }, to: { physicalSocketId: 'phys.cap1.a' } },
    ]),
    outputRouting: { channels: Object.assign({}, design.outputRouting.channels, { Z: 'P1.in' }), aliases: design.outputRouting.aliases },
  }));
  const validation = validateCustomDesign(broken);
  const session = createGuidedRepairSession(broken, validation, { maxSteps: 6, includeDestructive: true, recommendedOnly: false });
  assert.strictEqual(session.schemaVersion, DESIGN_REPAIR_SCHEMA_VERSION);
  assert.strictEqual(session.kind, 'guided-repair-session');
  assert.ok(session.pendingStepCount >= 3);
  assert.ok(nextPendingRepairSessionStep(session));
  const one = applyNextGuidedRepairSessionStep(session);
  assert.strictEqual(one.appliedStepCount, 1);
  assert.ok(one.currentValidation.errorCount <= session.initialValidation.errorCount);
  const skipped = skipGuidedRepairSessionStep(one, null, 'user wants to inspect first');
  assert.strictEqual(skipped.skippedStepCount, 1);
  const all = applyAllGuidedRepairSessionSteps(createGuidedRepairSession(broken, validation, { maxSteps: 6, includeDestructive: true, recommendedOnly: false }));
  const summary = repairSessionSummary(all);
  assert.ok(summary.appliedStepCount >= 3);
  assert.strictEqual(summary.pendingStepCount, 0);
  assert.ok(summary.byOperation['align-endpoint-logical-to-physical'] >= 1);
  assert.ok(summary.byOperation['remove-cable'] >= 1);
  assert.ok(summary.byOperation['clear-output-route'] >= 1);
  assert.strictEqual(all.design.cables.some((cable) => cable.id === 'session-cap'), false);
});

test('custom design panel overlays surface template-specific socket focus in browser helpers', () => {
  const summer = instantiateDesignTemplate('first-steps-mass-spring-damper', { projectRoot: path.resolve(__dirname, '..') });
  const overlay = panelOverlayForDesign(summer);
  assert.strictEqual(overlay.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.strictEqual(overlay.kind, 'design-panel-overlay');
  assert.ok(overlay.activeSectionIds.includes('SUMMERS'));
  assert.ok(overlay.socketHighlights.some((socket) => socket.socketId === 'phys.sum1.in1'));
  assert.ok(overlay.cableHighlights.every((route) => route.dataAttributes['data-design-panel-overlay-cable']));
  const templateOverlay = templatePanelOverlay('comparator-switch', { projectRoot: path.resolve(__dirname, '..'), includeNonBookletExamples: true });
  assert.strictEqual(templateOverlay.kind, 'template-panel-overlay');
  assert.strictEqual(templateOverlay.template.id, 'comparator-switch');
  assert.ok(templateOverlay.activeSectionIds.includes('COMPARATORS'));
  assert.ok(templateOverlay.socketHighlights.some((socket) => socket.socketId === 'phys.cmp1.gt'));
  const node = { dataset: {}, innerHTML: '', textContent: '' };
  const rendered = customDesignApp.renderCustomDesignPanelOverlay(node, templateOverlay);
  assert.strictEqual(rendered.kind, 'template-panel-overlay');
  assert.strictEqual(node.dataset.templateId, 'comparator-switch');
  assert.ok(node.innerHTML.includes('data-design-panel-overlay'));
  assert.ok(node.innerHTML.includes('phys.cmp1.gt'));
});

test('custom design browser helper renders repair batch buttons and session summaries', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const broken = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.concat([{ id: 'browser-session-cap', from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.plus1.out.a' }, to: { physicalSocketId: 'phys.cap1.a' } }]),
    outputRouting: { channels: Object.assign({}, design.outputRouting.channels, { Z: 'P1.in' }), aliases: design.outputRouting.aliases },
  }));
  const validation = validateCustomDesign(broken);
  const node = { dataset: {}, innerHTML: '', textContent: '' };
  customDesignApp.renderCustomDesignValidation(node, validation, broken);
  assert.ok(node.innerHTML.includes('data-design-repair-batch="next"'));
  assert.ok(node.innerHTML.includes('data-design-repair-batch="all"'));
  const session = customDesignApp.createGuidedRepairSession(broken, validation, { maxSteps: 6, includeDestructive: true, recommendedOnly: false });
  const afterOne = customDesignApp.applyNextGuidedRepairSessionStep(session);
  const statusNode = { dataset: {}, innerHTML: '', textContent: '' };
  const summary = customDesignApp.renderGuidedRepairSession(statusNode, afterOne);
  assert.strictEqual(statusNode.dataset.repairSession, 'true');
  assert.ok(summary.appliedStepCount >= 1);
  assert.ok(statusNode.innerHTML.includes('guided-repair-session-summary'));
});



test('guided repair sessions can be serialized and persisted as drafts', () => {
  const design = designFromSerializedPatch(dampedOscillationSerializedPatch(), { now: '2026-05-26T00:00:00.000Z' });
  const broken = normalizeDesign(Object.assign({}, design, {
    cables: design.cables.concat([{ id: 'persist-cap', from: { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.plus1.out.a' }, to: { physicalSocketId: 'phys.cap1.a' } }]),
  }));
  const session = applyNextGuidedRepairSessionStep(createGuidedRepairSession(broken, validateCustomDesign(broken), { maxSteps: 4, includeDestructive: true, recommendedOnly: false }));
  const payload = serializeGuidedRepairSession(session, { now: '2026-05-27T00:00:00.000Z' });
  assert.strictEqual(payload.schemaVersion, REPAIR_SESSION_DRAFT_SCHEMA_VERSION);
  assert.ok(payload.json.includes(DEFAULT_REPAIR_SESSION_DRAFT_KEY));
  const parsed = parseGuidedRepairSessionText(payload.json);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.session.appliedStepCount, 1);
  const store = memoryDraftStorage();
  const envelope = saveGuidedRepairSessionDraft(store, session, { now: '2026-05-27T00:00:00.000Z' });
  assert.strictEqual(envelope.key, DEFAULT_REPAIR_SESSION_DRAFT_KEY);
  const loaded = loadGuidedRepairSessionDraft(store);
  assert.strictEqual(loaded.ok, true);
  assert.strictEqual(loaded.summary.appliedStepCount, 1);
  assert.strictEqual(clearGuidedRepairSessionDraft(store).ok, true);
  assert.strictEqual(loadGuidedRepairSessionDraft(store).ok, false);
});

test('design panel overlays include legends with status role and section counts', () => {
  const design = instantiateDesignTemplate('first-steps-mass-spring-damper', { projectRoot: path.resolve(__dirname, '..') });
  const overlay = panelOverlayForDesign(design);
  assert.strictEqual(overlay.legend.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.ok(overlay.legend.statuses.some((entry) => entry.id === 'editable'));
  assert.ok(overlay.legend.roles.some((entry) => entry.id === 'cable-endpoint'));
  assert.ok(overlay.legend.sections.some((entry) => entry.id === 'SUMMERS'));
  const legend = panelOverlayLegend(overlay);
  assert.strictEqual(legend.kind, 'design-panel-overlay-legend');
  const node = { dataset: {}, innerHTML: '', textContent: '' };
  const browserLegend = customDesignApp.renderCustomDesignOverlayLegend(node, overlay);
  assert.strictEqual(node.dataset.overlayLegend, 'true');
  assert.ok(node.innerHTML.includes('data-design-panel-overlay-legend'));
  assert.ok(browserLegend.statuses.length >= 1);
});

test('template guided editing plans expose walkthrough socket and control focus', () => {
  const plan = templateGuidedEditingPlan('comparator-switch', { projectRoot: path.resolve(__dirname, '..'), includeNonBookletExamples: true });
  assert.strictEqual(plan.schemaVersion, PANEL_POLISH_SCHEMA_VERSION);
  assert.strictEqual(plan.kind, 'template-guided-editing-plan');
  assert.strictEqual(plan.template.id, 'comparator-switch');
  assert.ok(plan.stepCount >= 2);
  assert.ok(plan.socketFocusedStepCount >= 1);
  assert.ok(plan.steps.some((step) => step.focusPhysicalSocketIds.includes('phys.cmp1.gt')));
  assert.ok(plan.overlayLegend.roles.some((entry) => entry.id === 'cable-endpoint'));
  const templateOverlay = templatePanelOverlay('comparator-switch', { projectRoot: path.resolve(__dirname, '..'), includeNonBookletExamples: true });
  assert.ok(templateOverlay.guidedEditingPlan);
  assert.strictEqual(templateOverlay.guidedEditingPlan.template.id, 'comparator-switch');
  const node = { dataset: {}, innerHTML: '', textContent: '' };
  const rendered = customDesignApp.renderTemplateGuidedEditingPlan(node, 'comparator-switch', { projectRoot: path.resolve(__dirname, '..'), includeNonBookletExamples: true });
  assert.strictEqual(node.dataset.templateGuidance, 'comparator-switch');
  assert.ok(rendered.steps.some((step) => step.focusPhysicalSocketIds.includes('phys.cmp1.gt')));
  assert.ok(node.innerHTML.includes('data-template-guided-editing-plan'));
});


test('integrated patch editor reuses supplied connector bridge without embedding standalone page', () => {
  const root = path.resolve(__dirname, '..');
  assert.strictEqual(fs.existsSync(path.join(root, 'public/adopted_patch_panel_editor_v021/index.html')), false);
  assert.strictEqual(ADOPTED_PATCH_EDITOR_VERSION, 'v021');
  assert.strictEqual(ADOPTED_WIRING_SCHEMA, 'analog-thing-patch-panel-wiring');
  const connectors = listAdoptedPanelConnectors();
  assert.strictEqual(connectors.length, 196);
  assert.ok(connectors.some((connector) => connector.section === 'COMPARATORS'));
  const bridge = createConnectorPhysicalBridge();
  assert.strictEqual(bridge.connectorCount, 196);
  assert.strictEqual(bridge.mappedCount, 196);
  assert.ok(bridge.activeMappedCount >= 150);
  assert.strictEqual(bridge.byPhysicalSocketId['phys.cmp1.gt'].connectorId, 'comparator_02');
  assert.strictEqual(bridge.byPhysicalSocketId['phys.cmp1.out.gt'].connectorId, 'comparator_03');
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const catalog = cableInteractionApp.connectorMapForModel(model);
  assert.strictEqual(catalog.connectors.length, 196);
  assert.strictEqual(catalog.map.get('comparator_02').physicalSocketId, 'phys.cmp1.gt');
});


test('v099 browser layout keeps the patch panel primary and removes secondary developer panels', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  assert.ok(html.includes('class="app-workbench"'));
  assert.ok(html.includes('Primary editable design surface'));
  assert.ok(html.includes('analog computer simulator'));
  assert.ok(!html.includes('role="tablist"'));
  assert.ok(!html.includes('id="tabDesign"'));
  assert.ok(!html.includes('id="tabJson"'));
  assert.ok(!html.includes('id="tabGuides"'));
  assert.ok(!/Advanced JSON, diagnostics, and guide panels/i.test(html));
  assert.ok(html.indexOf('id="patchPanelSvg"') < html.indexOf('id="traceCanvas"'));
  assert.strictEqual((html.match(/id="patchPanelSvg"/g) || []).length, 1);
  assert.strictEqual((html.match(/id="customDesignGallerySelect"/g) || []).length, 1);
  assert.strictEqual((html.match(/id="patchTemplateSelect"/g) || []).length, 1);
});



test('v102 main workbench places design save load controls below zoom controls', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/patchEditorApp.js'), 'utf8');
  assert.ok(html.includes('class="panel-design-storage"'));
  assert.ok(html.includes('id="saveDesignJson"'));
  assert.ok(html.includes('id="loadDesignJson"'));
  assert.ok(html.includes('id="saveDesignDraft"'));
  assert.ok(html.includes('id="loadDesignDraft"'));
  assert.ok(html.includes('id="designFileInput"'));
  assert.ok(html.includes('id="designStorageStatus"'));
  assert.ok(html.indexOf('id="patchPanelSvg"') < html.indexOf('id="panelZoomPreset"'));
  assert.ok(html.indexOf('id="panelZoomPreset"') < html.indexOf('id="saveDesignJson"'));
  assert.ok(html.indexOf('id="saveDesignJson"') < html.indexOf('id="traceCanvas"'));
  assert.ok(!html.includes('id="patchJsonEditor"'));
  assert.ok(!html.includes('id="cableEditor"'));
  assert.ok(!html.includes('role="tablist"'));
  assert.ok(source.includes('saveCurrentDesignFile'));
  assert.ok(source.includes('loadSelectedDesignFile'));
  assert.ok(source.includes('applyImportedDesignText'));
  assert.ok(source.includes('AnalogThingCustomDesignApp'));
  assert.ok(source.includes('analogThing.deviceWorkbenchDesignDraft.v1'));
});

test('v102 CSS makes connector rings white and stacks design storage full width', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../src/browser/styles.css'), 'utf8');
  assert.ok(css.includes('v101-v102 visible editing rings'));
  assert.ok(/connector-hit:hover[\s\S]*fill:\s*rgba\(255, 255, 255, 0\.12\)/.test(css));
  assert.ok(/connector-hit:hover[\s\S]*stroke:\s*rgba\(255, 255, 255, 0\.55\)/.test(css));
  assert.ok(/connector-hit\.is-inspected[\s\S]*fill:\s*rgba\(255, 255, 255, 0\.38\)/.test(css));
  assert.ok(/connector-hit\.is-inspected[\s\S]*stroke:\s*rgba\(255, 255, 255, 0\.72\)/.test(css));
  assert.ok(/\.scope-card\s*\{[\s\S]*var\(--panel-metal-light\)/.test(css));
  assert.ok(/\.scope-card h2,[\s\S]*color:\s*#24221d/.test(css));
  assert.ok(/scope-card canvas,[\s\S]*background:\s*#08150e/.test(css));
  assert.ok(/#designFileInput[\s\S]*background:\s*#f4eedf/.test(css));
  assert.ok(/\.panel-design-storage\s*\{[\s\S]*grid-column:\s*1 \/ -1/.test(css));
  assert.ok(/\.panel-design-storage \.control-row,[\s\S]*min-width:\s*0/.test(css));
});

test('v038 patch editor keeps the integrated panel editable while validation warnings are visible', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/patchEditorApp.js'), 'utf8');
  assert.ok(source.includes('Panel remains editable while validation reports'));
  assert.ok(!source.includes('currentValidation.ok && patchPanel && panelContainer'));
  assert.ok(source.includes('installPanelCableEditor(model)'));
});

test('v038 fit-panel viewport shows the whole panel without zooming larger than 100 percent', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const wide = panelViewportForPreset(PANEL_ZOOM_PRESETS.FIT_PANEL, model, { containerWidth: 1800, containerHeight: 1200 });
  assert.ok(wide.scale <= 1);
  assert.strictEqual(wide.mode, PANEL_ZOOM_PRESETS.FIT_PANEL);
  const narrow = panelViewportForPreset(PANEL_ZOOM_PRESETS.FIT_PANEL, model, { containerWidth: 420, containerHeight: 260 });
  assert.ok(narrow.scale < 1);
});

test('v039 patch panel host is the first functional element in the primary workbench', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const patchIndex = html.indexOf('id="patchPanelSvg"');
  assert.ok(patchIndex > 0);
  assert.ok(patchIndex < html.indexOf('class="panel-title-row"'));
  assert.ok(patchIndex < html.indexOf('class="main-load-grid"'));
  assert.ok(patchIndex < html.indexOf('id="cableEditorMode"'));
  assert.ok(patchIndex < html.indexOf('id="traceCanvas"'));
});

test('v039 integrated panel CSS overrides old min-width rules so the full SVG can fit', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../src/browser/styles.css'), 'utf8');
  assert.ok(css.includes('v039 correction'));
  assert.ok(/svg\.that-reference-panel\.integrated-patch-wire-editor/.test(css));
  assert.ok(/min-width:\s*0\s*!important/.test(css));
  assert.ok(/width:\s*100%\s*!important/.test(css));
  assert.ok(/aspect-ratio:\s*800\s*\/\s*638/.test(css));
});

test('v039 browser number inputs accept exact REPF and solver defaults', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  const customDesignSource = fs.readFileSync(path.resolve(__dirname, '../src/browser/customDesignApp.js'), 'utf8');
  assert.ok(/id="opTime"[^>]+min="0"[^>]+step="any"[^>]+value="8"/.test(html));
  assert.ok(/id="dt"[^>]+min="0"[^>]+step="any"[^>]+value="0\.01"/.test(html));
  assert.ok(/id="customOpTime"[^>]+min="0"[^>]+step="any"/.test(customDesignSource));
  assert.ok(/id="customDt"[^>]+min="0"[^>]+step="any"/.test(customDesignSource));
});

test('adopted patch-panel wiring JSON converts mapped wires into custom design cables', () => {
  const wiring = {
    schema: 'analog-thing-patch-panel-wiring',
    editorVersion: 'v021',
    panel: { sourceSvg: 'assets/THAT_panel.svg', connectorCount: 196 },
    wires: [
      { id: 'wire_001', from: { connectorId: 'minuspluso_02' }, to: { connectorId: 'integrator_09' }, color: 'hsla(200, 70%, 45%, 0.72)' },
      { id: 'wire_002', from: { connectorId: 'integrator_03' }, to: { connectorId: 'outputs_01' }, color: 'hsla(60, 70%, 45%, 0.72)' },
    ],
  };
  const normalized = normalizeAdoptedWiring(wiring);
  assert.strictEqual(normalized.wires.length, 2);
  assert.strictEqual(normalized.wires[0].from.physicalSocketId, 'phys.plus1.out.a');
  assert.strictEqual(normalized.wires[0].to.physicalSocketId, 'phys.i1.ic');
  const design = adoptedWiringToDesign(wiring, { now: '2026-05-27T00:00:00.000Z' });
  assert.strictEqual(design.schemaVersion, DESIGN_SCHEMA_VERSION);
  assert.strictEqual(design.cables.length, 2);
  assert.deepStrictEqual(design.cables[0].from, { logicalSocketId: 'PLUS1.out', physicalSocketId: 'phys.plus1.out.a' });
  assert.deepStrictEqual(design.cables[0].to, { logicalSocketId: 'I1.ic', physicalSocketId: 'phys.i1.ic' });
});

test('design storage imports adopted patch-panel wiring JSON', () => {
  const text = JSON.stringify({
    schema: 'analog-thing-patch-panel-wiring',
    editorVersion: 'v021',
    wires: [
      { id: 'wire_001', from: { connectorId: 'coeff_02' }, to: { connectorId: 'outputs_01' } },
    ],
  });
  const imported = parseDesignImportText(text, { now: '2026-05-27T00:00:00.000Z' });
  assert.strictEqual(imported.ok, true);
  assert.strictEqual(imported.sourceKind, 'adopted-patch-panel-wiring');
  assert.strictEqual(imported.design.cables[0].from.physicalSocketId, 'phys.p1.out');
  assert.strictEqual(imported.design.cables[0].to.physicalSocketId, 'phys.out.x');
});

test('integrated wire editor exports wiring JSON and creates styled simulator cables', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = patchEditorApp.createEditableDampedPatch();
  const catalog = cableInteractionApp.connectorMapForModel(model);
  const added = cableInteractionApp.addIntegratedConnectorWireToPatch(patch, model, catalog.map.get('minuspluso_02'), catalog.map.get('integrator_33'), { style: { id: 'wire_999', color: 'hsl(20 70% 45%)', bend: 12 } });
  assert.strictEqual(added.patch.cables.some((cable) => cable.id === 'wire_999' && cable.color === 'hsl(20 70% 45%)'), true);
  assert.ok(added.patch.cables.some((cable) => cable.from === 'PLUS1.out' && cable.to === 'I1.ic'));
  const wires = cableInteractionApp.integratedWiresFromPatch(model, added.patch);
  assert.ok(wires.some((wire) => wire.id === 'wire_999' && wire.from.connectorId === 'minuspluso_02' && wire.to.connectorId === 'integrator_33'));
  const wiringJson = cableInteractionApp.exportIntegratedWiringObject(model, added.patch);
  assert.strictEqual(wiringJson.schema, ADOPTED_WIRING_SCHEMA);
  assert.strictEqual(wiringJson.editorVersion, 'integrated-v037');
  assert.strictEqual(wiringJson.panel.connectorCount, 196);
});

test('packaging app round-trips browser-edited patch JSON for export', () => {
  const patch = patchEditorApp.createEditablePatchFromTemplate('multiplier-product', { left: 0.4, right: 0.5 });
  const exported = packagingApp.createPatchExportPayload(patch, { filename: 'multiplier.patch.json' });
  assert.strictEqual(exported.filename, 'multiplier.patch.json');
  assert.ok(exported.json.endsWith('\n'));
  assert.ok(exported.byteLength > 100);
  const imported = packagingApp.parsePatchImportText(exported.json);
  assert.strictEqual(imported.ok, true);
  const smoke = packagingApp.smokeTestPatchImportExport(patch);
  assert.strictEqual(smoke.ok, true);
  assert.strictEqual(smoke.roundTripEqual, true);
  assert.strictEqual(smoke.validationOk, true);
  assert.strictEqual(smoke.runtimeOk, true);
});

test('packaging app turns validation and overload diagnostics into troubleshooting hints', () => {
  const hints = packagingApp.troubleshootingHints({
    ok: false,
    errors: [
      'cable 1: unknown source component BAD',
      'cable 2: I1.in1 is not an output socket',
      'ordinary input I1.in1 has 2 drivers: A.out, B.out',
      'required input P1.in is not connected',
      'stateless cycle detected involving INV1',
    ],
    warnings: [],
  }, { overloaded: true });
  const ids = hints.map((hint) => hint.id);
  assert.ok(ids.includes('unknown-socket'));
  assert.ok(ids.includes('direction'));
  assert.ok(ids.includes('multiple-drivers'));
  assert.ok(ids.includes('missing-required'));
  assert.ok(ids.includes('stateless-cycle'));
  assert.ok(ids.includes('overload'));
});


test('v078 browser runtime async simulation reports progress and matches sync trace shape', async () => {
  const patch = patchTemplatesApp.createPatchFromTemplate('slow-integrator-ramp');
  const options = { mode: 'OP', duration: 2, dt: 0.01, sampleEvery: 10, allowUnconnectedInputs: true };
  const syncPayload = browserPatchRuntime.runSerializedPatch(patch, options);
  const progressEvents = [];
  const asyncPayload = await browserPatchRuntime.runSerializedPatchAsync(patch, Object.assign({}, options, {
    yieldEvery: 20,
    onProgress(progress) { progressEvents.push(progress); },
  }));
  assert.strictEqual(asyncPayload.result.trace.length, syncPayload.result.trace.length);
  assert.strictEqual(asyncPayload.result.trace[0].trigger, true);
  assert.ok(progressEvents.some((progress) => progress.phase === 'running'));
  assert.strictEqual(progressEvents[progressEvents.length - 1].phase, 'complete');
  assert.strictEqual(progressEvents[progressEvents.length - 1].percent, 1);
});

test('v078 browser runtime async simulation can be stopped with an abort signal', async () => {
  const patch = patchTemplatesApp.createPatchFromTemplate('slow-integrator-ramp');
  const controller = new AbortController();
  let abortedAt = 0;
  try {
    await browserPatchRuntime.runSerializedPatchAsync(patch, {
      mode: 'OP',
      duration: 20,
      dt: 0.01,
      sampleEvery: 10,
      allowUnconnectedInputs: true,
      yieldEvery: 5,
      signal: controller.signal,
      onProgress(progress) {
        if (progress.currentStep >= 25 && !controller.signal.aborted) {
          abortedAt = progress.currentStep;
          controller.abort('unit-test stop');
        }
      },
    });
    assert.fail('expected aborted async simulation');
  } catch (error) {
    assert.strictEqual(error.name, 'AbortError');
    assert.ok(abortedAt >= 25);
    assert.ok(error.partialPayload.result.stopped);
    assert.ok(error.partialPayload.result.trace.length > 0);
    assert.ok(error.partialPayload.result.trace.length < 2001);
  }
});

test('v078 device workbench formats simulation progress for the standard side panel', () => {
  const text = deviceWorkbenchApp.formatSimulationProgress({ mode: 'REPF', phase: 'running', percent: 0.42, currentStep: 84, totalSteps: 200, cycle: 2, cycles: 3, sampleCount: 12 });
  assert.ok(/REPF: running 42%/.test(text));
  assert.ok(/cycle 2\/3/.test(text));
  assert.ok(/step 84\/200/.test(text));
  assert.ok(/12 samples/.test(text));
});


test('v079 device workbench no longer silently clamps extended virtual OP-TIME', () => {
  const repf = deviceWorkbenchApp.runtimeOptions({ mode: 'REPF', opDurationMs: 40, opTimeMs: 250, repCycles: 1, solverDtMs: 0.01, sampleEvery: 10, clip: false });
  assert.strictEqual(repf.opTime, 250);
  assert.strictEqual(repf.opTimePhysicalLimitMs, 100);
  assert.strictEqual(repf.opTimeExceedsPhysicalLimit, true);
  const rep = deviceWorkbenchApp.runtimeOptions({ mode: 'REP', opDurationMs: 40, opTimeMs: 12500, repCycles: 1, solverDtMs: 0.01, sampleEvery: 10, clip: false });
  assert.strictEqual(rep.opTime, 12500);
  assert.strictEqual(rep.opTimePhysicalLimitMs, 10000);
  assert.deepStrictEqual(deviceWorkbenchApp.runtimeControlWarnings({ mode: 'REPF', opTimeMs: 250 }), ['REPF OP-TIME is 250 ms, above the physical THAT limit of 100 ms. The browser simulator will still run the full virtual duration.']);
  const hints = deviceWorkbenchApp.deviceWorkflowHints({ components: [], cables: [] }, { mode: 'REPF', opTimeMs: 250, scopeA: 'X', scopeB: 'Y', autoRunChanges: false });
  assert.ok(hints.some((hint) => hint.id === 'op-time-extended'));
  const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
  assert.ok(/id="opTimeMs"[^>]+aria-describedby="opTimeLimitHint"/.test(html));
  assert.ok(html.includes('Larger values run as virtual extended simulation.'));
  assert.ok(!/id="opTimeMs"[^>]+max=/.test(html));
});


test('v095 Hunter/Prey defaults to booklet roll-mode time display', () => {
  const patch = patchTemplatesApp.createPatchFromTemplate('first-steps-hunter-prey');
  assert.strictEqual(patch.parameters.scopePreset, 'time');
  assert.strictEqual(patch.deviceControls.scopeMode, 'time');
  assert.strictEqual(patch.deviceControls.scopeA, 'X');
  assert.strictEqual(patch.deviceControls.scopeB, 'Y');
  const check = runFirstStepsScopeCheck('first-steps-hunter-prey');
  assert.strictEqual(check.metrics.expectation.display, 'time');
  assert.ok(/roll-mode time traces/.test(check.metrics.expectation.expected));
  assert.ok(check.metrics.harePeakCount >= 2);
  assert.ok(check.metrics.lynxPeakCount >= 2);
  assert.ok(check.metrics.populationPhaseLength > 5, 'manual X/Y phase-space view should remain meaningful even though the default scope mode is time');
});

test('packaging app exposes browser guide and walkthrough metadata', () => {
  const sections = packagingApp.browserUserGuideSections();
  const artifacts = packagingApp.buildWalkthroughArtifacts();
  assert.ok(sections.length >= 5);
  assert.ok(sections.some((section) => section.id === 'import-export'));
  assert.ok(artifacts.some((artifact) => artifact.artifact === 'docs/browser_user_guide.md'));
  const summary = packagingApp.buildPackagingSummary({ patch: patchEditorApp.createEditableDampedPatch() });
  assert.strictEqual(summary.importExportSmokeTest.ok, true);
  assert.ok(summary.guideSectionCount >= 5);
  assert.ok(summary.walkthroughArtifactCount >= 4);
});


test('v103 integrated panel editor can move endpoints on gallery demo wires without stored connector ids', () => {
  const model = patchPanelApp.getDampedOscillationPanelModel();
  const patch = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../patches/gallery/first-steps-radioactive-decay.patch.json'), 'utf8'));
  assert.ok(!patch.cables[0].fromConnectorId);
  assert.ok(!patch.cables[0].toConnectorId);
  const p2In = cableInteractionApp.connectorForCableEndpoint(model, patch.cables[2], 'to');
  assert.ok(p2In && p2In.id, 'existing target endpoint should resolve to a visible connector');
  const connectors = cableInteractionApp.connectorMapForModel(model).map;
  const replacement = connectors.get('coeff_03');
  const moved = cableInteractionApp.replaceIntegratedCableEndpoint(patch, model, 0, 'to', replacement, { style: { id: 'wire_001' } });
  assert.strictEqual(moved.patch.cables[0].from, 'PLUS1.out');
  assert.strictEqual(moved.patch.cables[0].to, 'P2.in');
  assert.strictEqual(moved.patch.cables[0].fromConnectorId, 'minuspluso_02');
  assert.strictEqual(moved.patch.cables[0].toConnectorId, 'coeff_03');
});

test('v103 integrated panel editor does not render OUT/IN endpoint text labels', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/browser/cableInteractionApp.js'), 'utf8');
  assert.ok(!/label\.textContent\s*=\s*endpointLabel/.test(source));
  assert.ok(!/Drag the <b>OUT<\/b> or <b>IN<\/b>/.test(source));
  const css = fs.readFileSync(path.resolve(__dirname, '../src/browser/styles.css'), 'utf8');
  assert.ok(/endpoint-handle-label[\s\S]*display:\s*none/.test(css));
});

async function runTestRange(start, end) {
  const results = [];
  for (let index = start; index < end; index += 1) {
    const item = tests[index];
    try {
      const result = item.fn();
      if (result && typeof result.then === 'function') await result;
      results.push({ name: item.name, pass: true });
      console.log(`PASS ${item.name}`);
    } catch (error) {
      results.push({ name: item.name, pass: false, error: error.stack || error.message });
      console.log(`FAIL ${item.name}`);
      console.log(error.stack || error.message);
    }
  }
  return results;
}

async function main() {
  const rangeSpec = process.env.ANALOG_TEST_RANGE;
  if (rangeSpec) {
    const [start, end] = rangeSpec.split(':').map((value) => Number.parseInt(value, 10));
    const results = await runTestRange(start, end);
    const failed = results.filter((result) => !result.pass).length;
    if (failed > 0) process.exit(1);
    process.exit(0);
  }

  const chunkSize = Number.parseInt(process.env.ANALOG_TEST_CHUNK_SIZE || '20', 10);
  let passed = 0;
  let failed = 0;
  for (let start = 0; start < tests.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, tests.length);
    const run = spawnSync(process.execPath, [__filename], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, ANALOG_TEST_RANGE: `${start}:${end}` },
      encoding: 'utf8',
      timeout: 600000,
      maxBuffer: 20 * 1024 * 1024,
    });
    if (run.stdout) process.stdout.write(run.stdout);
    if (run.stderr) process.stderr.write(run.stderr);
    if (run.status === 0) {
      passed += end - start;
    } else {
      failed += end - start;
      break;
    }
  }

  console.log(`
Test stats: ${passed}/${tests.length} tests passed.`);
  if (failed > 0 || passed !== tests.length) process.exit(1);
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { tests, runTestRange };
