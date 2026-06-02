'use strict';

const scopeRuntime = require('../browser/browserPatchRuntime');
const patchTemplates = require('../browser/patchTemplatesApp');
const { QUICK_START_BOOKLET_EXAMPLE_IDS } = require('./serializedGallery');

const FIRST_STEPS_SCOPE_CHECK_SCHEMA_VERSION = 'analog-thing-first-steps-scope-check/v1';


const EXPECTED_SCOPE_OUTPUTS = Object.freeze({
  'first-steps-radioactive-decay': Object.freeze({ section: '9.1', page: 15, display: 'time', expected: 'monotone positive exponential decay curve on OUT X' }),
  'first-steps-mass-spring-damper': Object.freeze({ section: '9.2', page: 16, display: 'time', expected: 'underdamped displacement oscillation with decaying envelope' }),
  'first-steps-lunar-landing': Object.freeze({ section: '9.3', page: 17, display: 'roll', expected: 'altitude descends monotonically and then flattens while vertical velocity dips, recovers, and settles just below zero' }),
  'first-steps-neuronal-bursting': Object.freeze({ section: '9.4', page: 18, display: 'time', expected: 'repeated neuronal burst groups with quiet recovery phases between spike trains' }),
  'first-steps-euler-spiral': Object.freeze({ section: '9.5', page: 19, display: 'xy', expected: 'point-symmetric double Euler spiral centered around the origin' }),
  'first-steps-hunter-prey': Object.freeze({ section: '9.6', page: 20, display: 'time', expected: 'booklet roll-mode time traces: repeated out-of-phase hare and lynx population cycles; X/Y phase-space remains a manual alternate view' }),
  'first-steps-lorenz-attractor': Object.freeze({ section: '9.7', page: 21, display: 'xy/zx/zy', expected: 'dense two-lobed Lorenz attractor projection, not a single transient loop' }),
  'first-steps-bouncing-ball': Object.freeze({ section: '9.8', page: 22, display: 'xy', expected: 'ball path inside the machine-unit box with repeated lower-edge floor rebounds and wall reflection' }),
  'first-steps-polynomial-generator': Object.freeze({ section: '9.9', page: 23, display: 'xy', expected: 'four X/Y panels: x ramp, x^2 U-shape, x^3 S-curve, and default cubic polynomial while x sweeps from -1 to +1' }),
  'first-steps-helper-max': Object.freeze({ section: '10.1', page: 24, display: 'scalar', expected: 'maximum comparator helper output equals max(A,B)' }),
  'first-steps-helper-min': Object.freeze({ section: '10.2', page: 24, display: 'scalar', expected: 'minimum comparator helper output equals min(A,B)' }),
  'first-steps-helper-abs': Object.freeze({ section: '10.3', page: 24, display: 'scalar', expected: 'absolute-value comparator helper output equals abs(A)' }),
  'first-steps-helper-adjustable-minus-one-plus-one': Object.freeze({ section: '10.4', page: 24, display: 'scalar', expected: 'coefficient helper output spans the full -1 to +1 machine-unit range' }),
  'first-steps-helper-non-negative-only': Object.freeze({ section: '10.5', page: 24, display: 'scalar', expected: 'non-negative clamp helper outputs A when A>0 and otherwise zero' }),
});

const DEFAULT_SCOPE_RUN_OPTIONS = Object.freeze({
  'first-steps-radioactive-decay': Object.freeze({ mode: 'REPF', opTime: 4, cycles: 1, dt: 0.01, sampleEvery: 50 }),
  'first-steps-mass-spring-damper': Object.freeze({ mode: 'REPF', opTime: 0.08, cycles: 1, dt: 0.0001, sampleEvery: 20 }),
  'first-steps-lunar-landing': Object.freeze({ mode: 'OP', duration: 10, dt: 0.002, sampleEvery: 250 }),
  'first-steps-neuronal-bursting': Object.freeze({ mode: 'OP', duration: 40, dt: 0.002, sampleEvery: 25 }),
  'first-steps-euler-spiral': Object.freeze({ mode: 'REPF', opTime: 120, cycles: 1, dt: 0.005, sampleEvery: 20 }),
  'first-steps-hunter-prey': Object.freeze({ mode: 'OP', duration: 100, dt: 0.01, sampleEvery: 5 }),
  'first-steps-lorenz-attractor': Object.freeze({ mode: 'OP', duration: 300, dt: 0.01, sampleEvery: 5 }),
  'first-steps-bouncing-ball': Object.freeze({ mode: 'REPF', opTime: 20, cycles: 1, dt: 0.001, sampleEvery: 20 }),
  'first-steps-polynomial-generator': Object.freeze({ mode: 'REPF', opTime: 2, cycles: 1, dt: 0.001, sampleEvery: 10 }),
  'first-steps-helper-max': Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
  'first-steps-helper-min': Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
  'first-steps-helper-abs': Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
  'first-steps-helper-adjustable-minus-one-plus-one': Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
  'first-steps-helper-non-negative-only': Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
});

function coefficientForMachineUnitValue(value) {
  return (Number(value) + 1) / 2;
}

const HELPER_SCOPE_SWEEP_CASES = Object.freeze({
  'first-steps-helper-max': Object.freeze([
    Object.freeze({ label: 'A below B', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(-0.25), bCoefficient: coefficientForMachineUnitValue(0.4) }), expected: 0.4 }),
    Object.freeze({ label: 'A above B', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(0.7), bCoefficient: coefficientForMachineUnitValue(-0.9) }), expected: 0.7 }),
    Object.freeze({ label: 'both negative', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(-0.6), bCoefficient: coefficientForMachineUnitValue(-0.2) }), expected: -0.2 }),
  ]),
  'first-steps-helper-min': Object.freeze([
    Object.freeze({ label: 'A below B', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(-0.25), bCoefficient: coefficientForMachineUnitValue(0.4) }), expected: -0.25 }),
    Object.freeze({ label: 'A above B', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(0.7), bCoefficient: coefficientForMachineUnitValue(-0.9) }), expected: -0.9 }),
    Object.freeze({ label: 'both positive', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(0.2), bCoefficient: coefficientForMachineUnitValue(0.6) }), expected: 0.2 }),
  ]),
  'first-steps-helper-abs': Object.freeze([
    Object.freeze({ label: 'negative A', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(-0.6) }), expected: 0.6 }),
    Object.freeze({ label: 'zero A', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(0) }), expected: 0 }),
    Object.freeze({ label: 'positive A', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(0.6) }), expected: 0.6 }),
  ]),
  'first-steps-helper-adjustable-minus-one-plus-one': Object.freeze([
    Object.freeze({ label: 'full negative end', parameters: Object.freeze({ valueCoefficient: 0 }), expected: -1 }),
    Object.freeze({ label: 'center zero', parameters: Object.freeze({ valueCoefficient: 0.5 }), expected: 0 }),
    Object.freeze({ label: 'full positive end', parameters: Object.freeze({ valueCoefficient: 1 }), expected: 1 }),
  ]),
  'first-steps-helper-non-negative-only': Object.freeze([
    Object.freeze({ label: 'negative clamps to zero', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(-0.6) }), expected: 0 }),
    Object.freeze({ label: 'zero remains zero', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(0) }), expected: 0 }),
    Object.freeze({ label: 'positive passes through', parameters: Object.freeze({ aCoefficient: coefficientForMachineUnitValue(0.6) }), expected: 0.6 }),
  ]),
});

function finiteValues(trace, outputName) {
  return (trace || []).map((point) => point && point.outputs && Number(point.outputs[outputName])).filter(Number.isFinite);
}

function range(values) {
  if (!values.length) return { min: null, max: null, first: null, last: null, span: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, first: values[0], last: values[values.length - 1], span: max - min };
}

function signChangeCount(values, epsilon = 1e-9) {
  let count = 0;
  let previous = 0;
  for (const value of values) {
    const sign = value > epsilon ? 1 : (value < -epsilon ? -1 : 0);
    if (sign !== 0 && previous !== 0 && sign !== previous) count += 1;
    if (sign !== 0) previous = sign;
  }
  return count;
}


function localPeakCount(values, threshold = 0) {
  let count = 0;
  for (let index = 1; index < values.length - 1; index += 1) {
    if (values[index] > values[index - 1] && values[index] > values[index + 1] && values[index] > threshold) count += 1;
  }
  return count;
}

function localValleyCount(values, threshold = 0) {
  let count = 0;
  for (let index = 1; index < values.length - 1; index += 1) {
    if (values[index] < values[index - 1] && values[index] < values[index + 1] && values[index] < threshold) count += 1;
  }
  return count;
}

function localExtrema(values, kind = 'peak', threshold = 0) {
  const extrema = [];
  for (let index = 1; index < values.length - 1; index += 1) {
    if (kind === 'peak' && values[index] > values[index - 1] && values[index] > values[index + 1] && values[index] > threshold) {
      extrema.push({ index, value: values[index] });
    }
    if (kind === 'valley' && values[index] < values[index - 1] && values[index] < values[index + 1] && values[index] < threshold) {
      extrema.push({ index, value: values[index] });
    }
  }
  return extrema;
}

function magnitudesGenerallyDecrease(values, tolerance = 0.025) {
  if (values.length < 2) return false;
  for (let index = 1; index < values.length; index += 1) {
    if (Math.abs(values[index]) > Math.abs(values[index - 1]) + tolerance) return false;
  }
  return true;
}

function finiteStepDrop(values, fromStart = true) {
  if (values.length < 2) return null;
  if (fromStart) return Math.abs(values[1] - values[0]);
  return Math.abs(values[values.length - 1] - values[values.length - 2]);
}

function xyTrajectoryLength(xs, ys) {
  let total = 0;
  const length = Math.min(xs.length, ys.length);
  for (let index = 1; index < length; index += 1) {
    const dx = xs[index] - xs[index - 1];
    const dy = ys[index] - ys[index - 1];
    if (Number.isFinite(dx) && Number.isFinite(dy)) total += Math.hypot(dx, dy);
  }
  return total;
}

function radialDistances(xs, ys) {
  const distances = [];
  const length = Math.min(xs.length, ys.length);
  for (let index = 0; index < length; index += 1) {
    const x = xs[index];
    const y = ys[index];
    if (Number.isFinite(x) && Number.isFinite(y)) distances.push(Math.hypot(x, y));
  }
  return distances;
}

function endpointPointSymmetry(xs, ys) {
  const length = Math.min(xs.length, ys.length);
  if (length < 2) return Infinity;
  return Math.hypot(xs[0] + xs[length - 1], ys[0] + ys[length - 1]);
}


function occupiedGridCellCount(xs, ys, bins = 24) {
  const points = [];
  const length = Math.min(xs.length, ys.length);
  for (let index = 0; index < length; index += 1) {
    const x = xs[index];
    const y = ys[index];
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  }
  if (!points.length) return 0;
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  if (!(xSpan > 0) || !(ySpan > 0)) return 0;
  const cells = new Set();
  const binCount = Math.max(1, Math.floor(bins));
  for (const point of points) {
    const ix = Math.min(binCount - 1, Math.max(0, Math.floor(((point.x - xMin) / xSpan) * binCount)));
    const iy = Math.min(binCount - 1, Math.max(0, Math.floor(((point.y - yMin) / ySpan) * binCount)));
    cells.add(`${ix}:${iy}`);
  }
  return cells.size;
}

function consecutiveIndexGaps(extrema) {
  const gaps = [];
  for (let index = 1; index < extrema.length; index += 1) {
    gaps.push(extrema[index].index - extrema[index - 1].index);
  }
  return gaps;
}

function burstGroupCount(values, threshold = 0, gapSamples = 20) {
  let groups = 0;
  let lastPeakIndex = -Infinity;
  for (let index = 1; index < values.length - 1; index += 1) {
    if (values[index] > values[index - 1] && values[index] > values[index + 1] && values[index] > threshold) {
      if (index - lastPeakIndex > gapSamples) groups += 1;
      lastPeakIndex = index;
    }
  }
  return groups;
}

function isMostlyMonotone(values, direction = 'decreasing', tolerance = 1e-9) {
  for (let index = 1; index < values.length; index += 1) {
    if (direction === 'decreasing' && values[index] > values[index - 1] + tolerance) return false;
    if (direction === 'increasing' && values[index] < values[index - 1] - tolerance) return false;
  }
  return true;
}

function pushCheck(checks, id, ok, message, details = {}) {
  checks.push({ id, status: ok ? 'pass' : 'fail', message, details });
}

function pushWarning(checks, id, ok, message, details = {}) {
  checks.push({ id, status: ok ? 'pass' : 'warning', message, details });
}

function statusFromChecks(checks) {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'warning')) return 'warning';
  return 'pass';
}

function checkFirstStepsScopeTrace(id, trace, options = {}) {
  const checks = [];
  const x = finiteValues(trace, 'x');
  const y = finiteValues(trace, 'y');
  const expectation = EXPECTED_SCOPE_OUTPUTS[id] || null;
  const metrics = { sampleCount: (trace || []).length, expectation, x: range(x), y: range(y) };
  pushCheck(checks, 'has-samples', metrics.sampleCount > 0, 'trace contains samples', { sampleCount: metrics.sampleCount });

  if (id === 'first-steps-radioactive-decay') {
    const nValues = finiteValues(trace, 'n');
    metrics.n = range(nValues);
    metrics.decayFirstDrop = finiteStepDrop(nValues, true);
    metrics.decayLastDrop = finiteStepDrop(nValues, false);
    pushCheck(checks, 'decay-monotone', isMostlyMonotone(nValues, 'decreasing'), 'N should monotonically decay');
    pushCheck(checks, 'decay-positive', metrics.n.min >= -1e-9 && metrics.n.first > metrics.n.last, 'decay stays positive and ends below the initial value', metrics.n);
    pushCheck(checks, 'decay-flattens', metrics.decayFirstDrop > 0 && metrics.decayLastDrop < metrics.decayFirstDrop * 0.6, 'exponential decay should flatten as the trace approaches zero', { firstDrop: metrics.decayFirstDrop, lastDrop: metrics.decayLastDrop });
  } else if (id === 'first-steps-mass-spring-damper') {
    const displacement = finiteValues(trace, 'displacement');
    const positivePeaks = localExtrema(displacement, 'peak', 0.05);
    const negativeValleys = localExtrema(displacement, 'valley', -0.05);
    metrics.displacementZeroCrossings = signChangeCount(displacement);
    metrics.displacementPositivePeaks = positivePeaks.map((entry) => entry.value);
    metrics.displacementNegativeValleys = negativeValleys.map((entry) => entry.value);
    pushCheck(checks, 'underdamped-crossings', metrics.displacementZeroCrossings >= 2, 'displacement should oscillate across zero', { signChanges: metrics.displacementZeroCrossings });
    pushCheck(checks, 'underdamped-decay-envelope', Math.abs(metrics.x.last) < Math.abs(metrics.x.first), 'final displacement magnitude should be below the initial displacement', { first: metrics.x.first, last: metrics.x.last });
    pushCheck(checks, 'underdamped-positive-envelope', positivePeaks.length >= 2 && magnitudesGenerallyDecrease(metrics.displacementPositivePeaks), 'positive displacement peaks should decay like the booklet underdamped envelope', { peaks: metrics.displacementPositivePeaks });
    pushCheck(checks, 'underdamped-negative-envelope', negativeValleys.length >= 2 && magnitudesGenerallyDecrease(metrics.displacementNegativeValleys), 'negative displacement valleys should decay like the booklet underdamped envelope', { valleys: metrics.displacementNegativeValleys });
  } else if (id === 'first-steps-lunar-landing') {
    const altitude = range(finiteValues(trace, 'altitude'));
    const velocity = range(finiteValues(trace, 'velocity'));
    const fuel = range(finiteValues(trace, 'fuel'));
    metrics.altitude = altitude;
    metrics.velocity = velocity;
    metrics.fuel = fuel;
    const altitudeValues = finiteValues(trace, 'altitude');
    const altitudeDrops = [];
    for (let index = 1; index < altitudeValues.length; index += 1) altitudeDrops.push(altitudeValues[index - 1] - altitudeValues[index]);
    metrics.altitudeLastDrop = altitudeDrops.length ? altitudeDrops[altitudeDrops.length - 1] : null;
    metrics.altitudeMaxDrop = altitudeDrops.length ? Math.max(...altitudeDrops) : null;
    pushCheck(checks, 'altitude-descends-monotone', altitude.first > altitude.last && isMostlyMonotone(altitudeValues, 'decreasing', 1e-9), 'altitude should descend monotonically during the default landing run', altitude);
    pushCheck(checks, 'altitude-stays-visible', altitude.min > 0.5, 'altitude should stay visibly above the bottom of the roll-mode scope in the booklet-style run', altitude);
    pushCheck(checks, 'altitude-flattens', metrics.altitudeLastDrop > 0 && metrics.altitudeMaxDrop > 0 && metrics.altitudeLastDrop < metrics.altitudeMaxDrop * 0.4, 'altitude descent should flatten after the throttle correction, like the booklet plot', { maxDrop: metrics.altitudeMaxDrop, lastDrop: metrics.altitudeLastDrop, drops: altitudeDrops });
    pushCheck(checks, 'velocity-dip', velocity.min < velocity.first - 0.08, 'vertical velocity should dip downward after powered descent starts', velocity);
    pushCheck(checks, 'velocity-recovers-without-climbing', velocity.last > velocity.min + 0.08 && velocity.last < -0.005 && velocity.max <= 1e-9, 'vertical velocity should recover but remain slightly downward, not turn into a climb', velocity);
    pushCheck(checks, 'fuel-decreases', fuel.first > fuel.last, 'fuel should decrease during powered descent', fuel);
  } else if (id === 'first-steps-neuronal-bursting') {
    const xv = finiteValues(trace, 'x');
    metrics.x = range(xv);
    metrics.xProminence = metrics.x.span;
    metrics.burstPeakCount = localPeakCount(xv, 0);
    metrics.burstGroupCount = burstGroupCount(xv, 0, 20);
    pushCheck(checks, 'burst-prominence', metrics.xProminence > 1.3, 'x output should span from a quiet negative recovery phase to positive spikes', { span: metrics.xProminence, x: metrics.x });
    pushCheck(checks, 'repeated-spikes', metrics.burstPeakCount >= 15, 'x output should contain repeated spike peaks, not just one excursion', { peakCount: metrics.burstPeakCount });
    pushCheck(checks, 'burst-groups', metrics.burstGroupCount >= 3, 'x output should form multiple burst groups across the default OP run', { groupCount: metrics.burstGroupCount });
  } else if (id === 'first-steps-euler-spiral') {
    const radii = radialDistances(x, y);
    const middleIndex = Math.floor(radii.length / 2);
    metrics.centerOffset = Math.hypot((metrics.x.min + metrics.x.max) / 2, (metrics.y.min + metrics.y.max) / 2);
    metrics.endpointPointSymmetry = endpointPointSymmetry(x, y);
    metrics.xyTrajectoryLength = xyTrajectoryLength(x, y);
    metrics.radialRange = range(radii);
    metrics.middleRadius = radii[middleIndex];
    metrics.radialPeakCount = localPeakCount(radii, 0.2);
    pushCheck(checks, 'double-arm-x', metrics.x.min < -0.1 && metrics.x.max > 0.1, 'X/Y scope should include both left and right arms', metrics.x);
    pushCheck(checks, 'double-arm-y', metrics.y.min < -0.1 && metrics.y.max > 0.1, 'X/Y scope should include both upper and lower arms', metrics.y);
    pushCheck(checks, 'centered-about-origin', metrics.centerOffset < 0.08, 'double spiral should be roughly centered around the origin', { centerOffset: metrics.centerOffset });
    pushCheck(checks, 'point-symmetric-endpoints', metrics.endpointPointSymmetry < 0.02, 'the two visible spiral arms should be point-symmetric around the origin', { endpointPointSymmetry: metrics.endpointPointSymmetry });
    pushCheck(checks, 'passes-through-origin', metrics.middleRadius < 0.02, 'the centered Euler sweep should pass through the origin between the two arms', { middleRadius: metrics.middleRadius });
    pushCheck(checks, 'curled-double-spiral', metrics.xyTrajectoryLength > 3 && metrics.radialPeakCount >= 4, 'the Euler trace should curl into two spiral arms rather than draw only a shallow S curve', { trajectoryLength: metrics.xyTrajectoryLength, radialPeakCount: metrics.radialPeakCount, radialRange: metrics.radialRange });
  } else if (id === 'first-steps-hunter-prey') {
    const hare = finiteValues(trace, 'hare');
    const lynx = finiteValues(trace, 'lynx');
    metrics.hare = range(hare);
    metrics.lynx = range(lynx);
    metrics.harePeakCount = localPeakCount(hare, 0.05);
    metrics.lynxPeakCount = localPeakCount(lynx, 0.05);
    metrics.populationPhaseLength = xyTrajectoryLength(hare, lynx);
    pushCheck(checks, 'phase-variation-hare', metrics.hare.span > 0.5, 'hare population should visibly vary on the scope', metrics.hare);
    pushCheck(checks, 'phase-variation-lynx', metrics.lynx.span > 0.7, 'lynx population should visibly vary on the scope', metrics.lynx);
    pushCheck(checks, 'repeated-population-cycles', metrics.harePeakCount >= 2 && metrics.lynxPeakCount >= 2, 'hare and lynx traces should show repeated population cycles, not a single extinction transient', { harePeakCount: metrics.harePeakCount, lynxPeakCount: metrics.lynxPeakCount });
    pushCheck(checks, 'phase-space-loop', metrics.populationPhaseLength > 5, 'X/Y phase display should trace a visible predator-prey loop', { trajectoryLength: metrics.populationPhaseLength });
  } else if (id === 'first-steps-lorenz-attractor') {
    const xv = finiteValues(trace, 'x');
    const yv = finiteValues(trace, 'y');
    const zv = finiteValues(trace, 'z');
    metrics.z = range(zv);
    metrics.xSignChanges = signChangeCount(xv, 1e-4);
    metrics.xyTrajectoryLength = xyTrajectoryLength(xv, yv);
    metrics.zxTrajectoryLength = xyTrajectoryLength(zv, xv);
    metrics.zyTrajectoryLength = xyTrajectoryLength(zv, yv);
    metrics.xyProjectionCells = occupiedGridCellCount(xv, yv, 24);
    metrics.zxProjectionCells = occupiedGridCellCount(zv, xv, 24);
    metrics.zyProjectionCells = occupiedGridCellCount(zv, yv, 24);
    metrics.lobeDwell = {
      positiveX: xv.filter((value) => value > 0.05).length,
      negativeX: xv.filter((value) => value < -0.05).length,
      total: xv.length,
    };
    pushCheck(checks, 'lorenz-x-lobes', metrics.x.min < -0.45 && metrics.x.max > 0.55, 'Lorenz X/Y projection should visit both attractor lobes', metrics.x);
    pushCheck(checks, 'lorenz-z-positive-depth', metrics.z.max > 0.4, 'Lorenz Z diagnostic should build positive depth', metrics.z);
    pushCheck(checks, 'lorenz-lobe-switching', metrics.xSignChanges >= 4, 'Lorenz projection should switch between lobes repeatedly', { signChanges: metrics.xSignChanges });
    pushCheck(checks, 'lorenz-projection-density', metrics.xyTrajectoryLength > 12, 'Lorenz projection should be dense enough to resemble the booklet attractor rather than one transient loop', { trajectoryLength: metrics.xyTrajectoryLength });
    pushCheck(checks, 'lorenz-three-projection-density', metrics.xyProjectionCells >= 150 && metrics.zxProjectionCells >= 200 && metrics.zyProjectionCells >= 225, 'booklet Section 9.7 shows X/Y, Z/X, and Z/Y views; all three projections should have dense occupied-cell coverage', { xyCells: metrics.xyProjectionCells, zxCells: metrics.zxProjectionCells, zyCells: metrics.zyProjectionCells });
    pushCheck(checks, 'lorenz-balanced-lobe-dwell', metrics.lobeDwell.positiveX >= 1000 && metrics.lobeDwell.negativeX >= 1000, 'the long Lorenz run should dwell in both lobes rather than collapse into one side', metrics.lobeDwell);
    pushCheck(checks, 'lorenz-side-front-projection-length', metrics.zxTrajectoryLength > 25 && metrics.zyTrajectoryLength > 25, 'front and side projections should have enough trajectory length to resemble the printed dense attractor views', { zxTrajectoryLength: metrics.zxTrajectoryLength, zyTrajectoryLength: metrics.zyTrajectoryLength });
  } else if (id === 'first-steps-bouncing-ball') {
    const floorValleys = localExtrema(y, 'valley', -0.9);
    const reboundApexes = localExtrema(y, 'peak', -0.95);
    metrics.inBoxOvershoot = Math.max(0, metrics.x.max - 1, metrics.y.max - 1, -1 - metrics.x.min, -1 - metrics.y.min);
    metrics.yZeroCrossings = signChangeCount(y);
    metrics.floorReboundCount = floorValleys.length;
    metrics.floorReboundDepths = floorValleys.map((entry) => entry.value);
    metrics.floorReboundSampleGaps = consecutiveIndexGaps(floorValleys);
    metrics.reboundApexes = reboundApexes.map((entry) => entry.value);
    metrics.wallReflectionCount = localPeakCount(x, 0.9) + localValleyCount(x, -0.9);
    metrics.xyTrajectoryLength = xyTrajectoryLength(x, y);
    metrics.xyProjectionCells = occupiedGridCellCount(x, y, 24);
    pushCheck(checks, 'stays-in-machine-box', metrics.inBoxOvershoot <= 0.05, 'bouncing-ball X/Y trace should stay within the machine-unit box tolerance', { overshoot: metrics.inBoxOvershoot, x: metrics.x, y: metrics.y });
    pushCheck(checks, 'bounces-vertically', metrics.yZeroCrossings >= 1, 'vertical position should show bounce crossings in the default run', { signChanges: metrics.yZeroCrossings });
    pushCheck(checks, 'floor-bounce-at-bottom', metrics.y.first > 0.5 && metrics.y.min < -0.95 && metrics.y.max < 0.95, 'displayed OUT Y should start near the top and rebound on the lower edge, not the upper edge', metrics.y);
    pushCheck(checks, 'multiple-floor-rebounds', metrics.floorReboundCount >= 3, 'booklet-like X/Y trace should show repeated lower-edge rebounds, not just one large arc', { floorReboundCount: metrics.floorReboundCount });
    pushCheck(checks, 'wall-reflection', metrics.wallReflectionCount >= 1, 'booklet-like X/Y trace should include a side-wall reflection', { wallReflectionCount: metrics.wallReflectionCount });
    pushCheck(checks, 'bouncing-trace-density', metrics.floorReboundCount >= 4 && metrics.xyTrajectoryLength > 7 && metrics.xyProjectionCells >= 90, 'the printed Section 9.8 output is a dense multi-bounce path, so the deterministic trace should cover enough X/Y cells and path length', { floorReboundCount: metrics.floorReboundCount, trajectoryLength: metrics.xyTrajectoryLength, xyProjectionCells: metrics.xyProjectionCells });
    pushCheck(checks, 'damped-rebound-apexes', metrics.reboundApexes.length >= 2 && isMostlyMonotone(metrics.reboundApexes, 'decreasing', 0.02), 'successive post-floor apexes should get lower as drag removes energy', { reboundApexes: metrics.reboundApexes });
    pushCheck(checks, 'rebound-spacing-compresses', metrics.floorReboundSampleGaps.length >= 2 && metrics.floorReboundSampleGaps[metrics.floorReboundSampleGaps.length - 1] < metrics.floorReboundSampleGaps[0], 'time between lower-edge impacts should shrink as bounce height decays', { gaps: metrics.floorReboundSampleGaps });
  } else if (id === 'first-steps-polynomial-generator') {
    const xv = finiteValues(trace, 'x');
    const x2v = finiteValues(trace, 'x2');
    const x3v = finiteValues(trace, 'x3');
    const pValues = finiteValues(trace, 'polynomial');
    const p = range(pValues);
    const middleIndex = Math.floor(Math.min(xv.length, x2v.length, x3v.length, pValues.length) / 2);
    metrics.x2 = range(x2v);
    metrics.x3 = range(x3v);
    metrics.polynomial = p;
    metrics.polynomialValleys = localExtrema(pValues, 'valley', -0.02).map((entry) => entry.value);
    metrics.midpoint = { x: xv[middleIndex], x2: x2v[middleIndex], x3: x3v[middleIndex], polynomial: pValues[middleIndex] };
    pushCheck(checks, 'x-sweep', Math.abs(metrics.x.first + 1) < 1e-9 && Math.abs(metrics.x.last - 1) < 1e-8, 'x should sweep from -1 to +1', metrics.x);
    pushCheck(checks, 'x-sweep-monotone', isMostlyMonotone(xv, 'increasing', 1e-8), 'x panel should be a left-to-right ramp', metrics.x);
    pushCheck(checks, 'x2-u-shape', metrics.x2.min < 0.02 && metrics.x2.first > 0.95 && metrics.x2.last > 0.95 && Math.abs(metrics.midpoint.x2 - metrics.x2.min) < 0.02, 'x^2 panel should be a U-shaped curve with its minimum near x=0', { x2: metrics.x2, midpoint: metrics.midpoint });
    pushCheck(checks, 'x3-s-shape', metrics.x3.first < -0.95 && metrics.x3.last > 0.95 && Math.abs(metrics.midpoint.x3) < 0.02 && isMostlyMonotone(x3v, 'increasing', 1e-8), 'x^3 panel should be an increasing S-curve crossing near the origin', { x3: metrics.x3, midpoint: metrics.midpoint });
    pushCheck(checks, 'polynomial-range', p.span > 0.5, 'polynomial output should show a visible cubic curve', p);
    pushCheck(checks, 'polynomial-default-endpoints', Math.abs(p.first - 0.1) < 0.02 && Math.abs(p.last - 0.9) < 0.02, 'default p(x) should match the booklet coefficient endpoints for p(-1) and p(1)', p);
    pushCheck(checks, 'polynomial-default-valley', metrics.polynomialValleys.length === 1 && metrics.polynomialValleys[0] < -0.05, 'default p(x) should dip once before rising to the right', { valleys: metrics.polynomialValleys });
  } else if (String(id).startsWith('first-steps-helper-')) {
    const expected = options.expectedValue;
    const finalY = y.length ? y[y.length - 1] : null;
    metrics.expectedValue = expected;
    metrics.finalY = finalY;
    metrics.helperSweep = Array.isArray(options.helperSweep) ? options.helperSweep : [];
    pushCheck(checks, 'helper-scalar-output', Number.isFinite(finalY) && (expected === undefined || Math.abs(finalY - expected) < 1e-9), 'helper output should match its expected scalar value', { finalY, expected });
    if (metrics.helperSweep.length) {
      pushCheck(checks, 'helper-sweep-covers-branches', metrics.helperSweep.every((item) => item.ok), 'helper sweep should cover both comparator/control branches from the booklet definition', { sweep: metrics.helperSweep });
    }
  }

  const status = statusFromChecks(checks);
  return {
    schemaVersion: FIRST_STEPS_SCOPE_CHECK_SCHEMA_VERSION,
    id,
    status,
    ok: status !== 'fail',
    checks,
    metrics,
  };
}

function helperSweepForId(id, runOptions = {}) {
  const cases = HELPER_SCOPE_SWEEP_CASES[id] || [];
  return cases.map((item) => {
    const patch = patchTemplates.createPatchFromTemplate(id, item.parameters);
    const payload = scopeRuntime.runSerializedPatch(patch, runOptions);
    const trace = payload && payload.result && Array.isArray(payload.result.trace) ? payload.result.trace : [];
    const final = trace.length ? trace[trace.length - 1] : null;
    const actual = final && final.outputs ? Number(final.outputs.y) : NaN;
    return {
      label: item.label,
      parameters: item.parameters,
      expected: item.expected,
      actual,
      error: Number.isFinite(actual) ? Math.abs(actual - item.expected) : Infinity,
      ok: Number.isFinite(actual) && Math.abs(actual - item.expected) < 1e-9,
    };
  });
}

function runFirstStepsScopeCheck(id, options = {}) {
  const patch = options.patch || patchTemplates.createPatchFromTemplate(id);
  const runOptions = Object.assign({}, DEFAULT_SCOPE_RUN_OPTIONS[id] || { mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }, options.runOptions || {});
  const payload = scopeRuntime.runSerializedPatch(patch, runOptions);
  const expectedValue = patch && patch.parameters && patch.parameters.expectedValue;
  const helperSweep = String(id).startsWith('first-steps-helper-') ? helperSweepForId(id, runOptions) : [];
  const checked = checkFirstStepsScopeTrace(id, payload.result.trace, { expectedValue, helperSweep });
  checked.runOptions = runOptions;
  checked.deviceControls = patch.deviceControls || {};
  return checked;
}

function summarizeFirstStepsScopeChecks(options = {}) {
  const idsSource = Array.isArray(options.ids) ? options.ids : QUICK_START_BOOKLET_EXAMPLE_IDS;
  const ids = idsSource.slice();
  const perExampleOptions = options.perExampleOptions && typeof options.perExampleOptions === 'object' ? options.perExampleOptions : {};
  const checks = [];
  for (const id of ids) {
    const exampleOptions = Object.prototype.hasOwnProperty.call(perExampleOptions, id) ? perExampleOptions[id] : {};
    checks.push(runFirstStepsScopeCheck(id, exampleOptions));
  }
  const byStatus = checks.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return {
    schemaVersion: FIRST_STEPS_SCOPE_CHECK_SCHEMA_VERSION,
    checkedCount: checks.length,
    passedCount: byStatus.pass || 0,
    warningCount: byStatus.warning || 0,
    failedCount: byStatus.fail || 0,
    ok: !(byStatus.fail > 0),
    byStatus,
    checks,
  };
}

module.exports = {
  FIRST_STEPS_SCOPE_CHECK_SCHEMA_VERSION,
  EXPECTED_SCOPE_OUTPUTS,
  DEFAULT_SCOPE_RUN_OPTIONS,
  HELPER_SCOPE_SWEEP_CASES,
  helperSweepForId,
  finiteValues,
  range,
  signChangeCount,
  isMostlyMonotone,
  checkFirstStepsScopeTrace,
  runFirstStepsScopeCheck,
  summarizeFirstStepsScopeChecks,
};
