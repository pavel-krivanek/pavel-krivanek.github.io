'use strict';

const { createThatPrototypeInventory } = require('../core/inventory');
const { createPatchMachineFromSerializedPatch, PATCH_SCHEMA_VERSION, DEFAULT_INVENTORY_NAME } = require('../core/serialization');
const { runMode, MODES } = require('../core/modes');

const FIRST_STEPS_COVERAGE_SCHEMA_VERSION = 'analog-thing-first-steps-coverage/v1';

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function firstStepsRadioactiveDecaySerializedPatch(options = {}) {
  const n0 = options.n0 === undefined ? 0.5 : options.n0;
  const lambda = options.lambda === undefined ? 0.5 : options.lambda;
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps: Radioactive Decay',
    description: 'Exact block-level translation of the First Steps radioactive decay patch: Ndot = -lambda N. The integrator output carries -N, the inverter exposes positive N on OUT X.',
    components: [
      { id: 'PLUS1' },
      { id: 'I1', label: 'Integrator / -N' },
      { id: 'INV1', label: 'Inverter / N' },
      { id: 'P1', coefficient: n0, label: 'P1 initial sample N0' },
      { id: 'P2', coefficient: lambda, label: 'P2 decay coefficient lambda' },
      { id: 'OUT_X', label: 'X / decay curve N' },
    ],
    cables: [
      { from: 'PLUS1.out', to: 'P1.in', label: '+1 into P1 so the coefficient knob sets N0' },
      { from: 'P1.out', to: 'I1.ic', label: 'IC input sets I1.out to -N0 at the start of each run' },
      { from: 'I1.out', to: 'P2.in', label: 'feedback of -N through lambda coefficient' },
      { from: 'P2.out', to: 'I1.in1', label: 'lambda*(-N) into the inverting integrator gives decay' },
      { from: 'I1.out', to: 'INV1.in', label: 'recover positive N for display' },
      { from: 'INV1.out', to: 'OUT_X.in', label: 'decay curve to OUT X' },
    ],
    outputs: {
      x: 'OUT_X.out',
      n: 'OUT_X.out',
      minusN: 'I1.out',
      lambdaInput: 'P2.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-radioactive-decay',
      page: 15,
      equation: 'Ndot = -lambda*N',
      n0,
      lambda,
      expectedInitialN: n0,
      expectedNAtT4: n0 * Math.exp(-lambda * 4),
    },
  };
}


function underdampedDisplacementAt(normalizedTime, options = {}) {
  const y0 = options.y0 === undefined ? 0.5 : options.y0;
  const v0 = options.v0 === undefined ? 0 : options.v0;
  const spring = options.spring === undefined ? 0.5 : options.spring;
  const damping = options.damping === undefined ? 0.05 : options.damping;
  const inverseMass = options.inverseMass === undefined ? 0.5 : options.inverseMass;
  const omega0Squared = inverseMass * spring;
  const twoBeta = inverseMass * damping;
  const beta = twoBeta / 2;
  const omegaD = Math.sqrt(Math.max(0, omega0Squared - beta * beta));
  if (omegaD === 0) {
    return Math.exp(-beta * normalizedTime) * (y0 + (v0 + beta * y0) * normalizedTime);
  }
  return Math.exp(-beta * normalizedTime) * (
    y0 * Math.cos(omegaD * normalizedTime)
    + ((v0 + beta * y0) / omegaD) * Math.sin(omegaD * normalizedTime)
  );
}

function firstStepsMassSpringDamperSerializedPatch(options = {}) {
  const y0 = options.y0 === undefined ? 0.5 : options.y0;
  const v0 = options.v0 === undefined ? 0 : options.v0;
  const spring = options.spring === undefined ? 0.5 : options.spring;
  const damping = options.damping === undefined ? 0.05 : options.damping;
  const inverseMass = options.inverseMass === undefined ? 0.5 : options.inverseMass;
  const integratorRate = options.integratorRate === undefined ? 1000 : options.integratorRate;
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps: Mass-Spring-Damper System',
    description: 'Exact block-level translation of First Steps Section 9.2: yddot = (1/m) * (-(D*ydot + s*y)). I1 carries -ydot, I2 carries y, and OUT X shows displacement.',
    components: [
      { id: 'MINUS1' },
      { id: 'ZERO' },
      { id: 'I1', rate: integratorRate, label: 'Integrator / -ydot' },
      { id: 'I2', rate: integratorRate, label: 'Integrator / y' },
      { id: 'INV1', label: 'Inverter / ydot' },
      { id: 'SUM1', label: 'Summer / -(D*ydot + s*y)' },
      { id: 'P1', coefficient: y0, label: 'P1 initial displacement y0' },
      { id: 'P2', coefficient: spring, label: 'P2 spring coefficient s' },
      { id: 'P3', coefficient: damping, label: 'P3 damping coefficient D' },
      { id: 'P4', coefficient: inverseMass, label: 'P4 inverse mass 1/m' },
      { id: 'OUT_X', label: 'X / displacement y' },
      { id: 'OUT_Y', label: 'Y / velocity ydot' },
    ],
    cables: [
      { from: 'ZERO.out', to: 'I1.ic', label: 'zero initial velocity: I1.out starts at -ydot = 0' },
      { from: 'MINUS1.out', to: 'P1.in', label: '-1 into P1 gives -y0 for the inverting IC socket' },
      { from: 'P1.out', to: 'I2.ic', label: 'initialize I2.out to positive displacement y0' },
      { from: 'P4.out', to: 'I1.in1', label: 'acceleration yddot enters the first inverting integrator' },
      { from: 'I1.out', to: 'I2.in1', label: '-ydot into the second inverting integrator yields displacement y' },
      { from: 'I1.out', to: 'INV1.in', label: 'invert -ydot to recover positive velocity ydot' },
      { from: 'I2.out', to: 'P2.in', label: 'scale displacement by spring coefficient s' },
      { from: 'INV1.out', to: 'P3.in', label: 'scale velocity by damping coefficient D' },
      { from: 'P2.out', to: 'SUM1.in1', label: 'spring force term s*y' },
      { from: 'P3.out', to: 'SUM1.in2', label: 'damper force term D*ydot' },
      { from: 'SUM1.out', to: 'P4.in', label: 'negated force sum scaled by inverse mass' },
      { from: 'I2.out', to: 'OUT_X.in', label: 'displacement output to OUT X' },
      { from: 'INV1.out', to: 'OUT_Y.in', label: 'velocity output to OUT Y for diagnostics' },
    ],
    outputs: {
      x: 'OUT_X.out',
      y: 'OUT_X.out',
      displacement: 'OUT_X.out',
      velocity: 'OUT_Y.out',
      minusVelocity: 'I1.out',
      forceSum: 'SUM1.out',
      acceleration: 'P4.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-mass-spring-damper',
      page: 16,
      equation: 'yddot = inverseMass * (-(damping*ydot + spring*y))',
      y0,
      v0,
      spring,
      damping,
      inverseMass,
      integratorRate,
      opTimeSeconds: 0.08,
      normalizedTimeAtOpTime: 0.08 * integratorRate,
      expectedInitialDisplacement: y0,
      expectedDisplacementAt80ms: underdampedDisplacementAt(0.08 * integratorRate, { y0, v0, spring, damping, inverseMass }),
    },
  };
}



function defaultLunarLandingThrottleProfile(duration = 10) {
  return {
    kind: 'linear-points',
    scale: 'multiplier',
    repeat: false,
    points: [
      { t: 0, value: 1.44 },
      { t: duration * 0.5, value: 1.44 },
      { t: duration * 0.58, value: 0.04 },
      { t: duration * 0.72, value: 0.04 },
      { t: duration * 0.8, value: 1.0 },
      { t: duration, value: 1.0 },
    ],
  };
}

function valueFromLinearTimeProfile(profile, time, fallback) {
  if (!profile || !Array.isArray(profile.points) || profile.points.length === 0) return fallback;
  const points = profile.points
    .map((point) => ({ t: Number(point.t), value: Number(point.value) }))
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.value))
    .sort((a, b) => a.t - b.t);
  if (!points.length) return fallback;
  if (time <= points[0].t) return points[0].value;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    if (time <= next.t) {
      const span = next.t - previous.t;
      if (span <= 0) return next.value;
      const alpha = (time - previous.t) / span;
      return previous.value + alpha * (next.value - previous.value);
    }
  }
  return points[points.length - 1].value;
}

function lunarLandingEffectiveThrottleAt(time, options = {}) {
  const throttle = options.throttle === undefined ? 0.5 : options.throttle;
  const duration = options.duration === undefined ? 10 : options.duration;
  const profile = options.throttleProfile === undefined ? defaultLunarLandingThrottleProfile(duration) : options.throttleProfile;
  if (!profile) return throttle;
  const profiled = valueFromLinearTimeProfile(profile, time, throttle);
  const scale = profile.scale || 'absolute';
  const value = scale === 'multiplier' ? throttle * profiled : profiled;
  return Math.max(0, Math.min(1, value));
}

function lunarLandingReferenceStateAt(runTime, options = {}) {
  const throttle = options.throttle === undefined ? 0.5 : options.throttle;
  const thrustScale = options.thrustScale === undefined ? 0.1 : options.thrustScale;
  const gravity = options.gravity === undefined ? 0.05 : options.gravity;
  const initialVelocity = options.initialVelocity === undefined ? 0 : options.initialVelocity;
  const fuelEfficiency = options.fuelEfficiency === undefined ? 0.5 : options.fuelEfficiency;
  const initialAltitude = options.initialAltitude === undefined ? 1 : options.initialAltitude;
  const initialFuel = options.initialFuel === undefined ? 1 : options.initialFuel;
  const altitudeScale = options.altitudeScale === undefined ? 0.4 : options.altitudeScale;
  const duration = options.duration === undefined ? Math.max(10, runTime) : options.duration;
  const throttleProfile = options.throttleProfile === undefined ? defaultLunarLandingThrottleProfile(duration) : options.throttleProfile;
  const dt = options.dt === undefined ? 0.001 : options.dt;
  const steps = Math.round(runTime / dt);
  let state = { velocity: initialVelocity, altitude: initialAltitude, fuel: initialFuel };
  let touchdownTime = state.altitude <= 0 ? 0 : null;
  let fuelEmptyTime = state.fuel <= 0 ? 0 : null;

  const derivatives = (current, time) => {
    const pilotThrottle = lunarLandingEffectiveThrottleAt(time, { throttle, duration, throttleProfile });
    const availableThrust = current.fuel > 0 ? pilotThrottle * thrustScale : 0;
    const altitudeIntegratorInput = current.altitude > 0 ? current.velocity : 0;
    return {
      velocity: gravity - availableThrust,
      altitude: altitudeScale * altitudeIntegratorInput,
      fuel: -fuelEfficiency * availableThrust,
    };
  };
  const addScaled = (current, d, scale) => ({
    velocity: current.velocity + scale * d.velocity,
    altitude: current.altitude + scale * d.altitude,
    fuel: current.fuel + scale * d.fuel,
  });

  for (let index = 0; index < steps; index += 1) {
    const stepStart = index * dt;
    const stepDt = index === steps - 1 ? (runTime - stepStart) || dt : dt;
    const k1 = derivatives(state, stepStart);
    const k2 = derivatives(addScaled(state, k1, stepDt / 2), stepStart + stepDt / 2);
    const k3 = derivatives(addScaled(state, k2, stepDt / 2), stepStart + stepDt / 2);
    const k4 = derivatives(addScaled(state, k3, stepDt), stepStart + stepDt);
    const previous = state;
    state = {
      velocity: state.velocity + (stepDt / 6) * (k1.velocity + 2 * k2.velocity + 2 * k3.velocity + k4.velocity),
      altitude: state.altitude + (stepDt / 6) * (k1.altitude + 2 * k2.altitude + 2 * k3.altitude + k4.altitude),
      fuel: state.fuel + (stepDt / 6) * (k1.fuel + 2 * k2.fuel + 2 * k3.fuel + k4.fuel),
    };
    if (touchdownTime === null && previous.altitude > 0 && state.altitude <= 0) {
      const fraction = previous.altitude / Math.max(previous.altitude - state.altitude, Number.EPSILON);
      touchdownTime = stepStart + fraction * stepDt;
    }
    if (fuelEmptyTime === null && previous.fuel > 0 && state.fuel <= 0) {
      const fraction = previous.fuel / Math.max(previous.fuel - state.fuel, Number.EPSILON);
      fuelEmptyTime = stepStart + fraction * stepDt;
    }
  }
  return {
    ...state,
    thrust: (state.fuel > 0 ? lunarLandingEffectiveThrottleAt(runTime, { throttle, duration, throttleProfile }) * thrustScale : 0),
    touchdownTime,
    fuelEmptyTime,
  };
}

function firstStepsLunarLandingSerializedPatch(options = {}) {
  const throttle = options.throttle === undefined ? 0.5 : options.throttle;
  const thrustScale = options.thrustScale === undefined ? 0.1 : options.thrustScale;
  const gravity = options.gravity === undefined ? 0.05 : options.gravity;
  const gravityStage = options.gravityStage === undefined ? 0.05 : options.gravityStage;
  const fuelEfficiency = options.fuelEfficiency === undefined ? 0.5 : options.fuelEfficiency;
  const initialAltitude = options.initialAltitude === undefined ? 1 : options.initialAltitude;
  const initialFuel = options.initialFuel === undefined ? 1 : options.initialFuel;
  const altitudeCoefficientA = options.altitudeCoefficientA === undefined ? 0.05 : options.altitudeCoefficientA;
  const altitudeCoefficientB = options.altitudeCoefficientB === undefined ? 0.05 : options.altitudeCoefficientB;
  const altitudeScale = options.altitudeScale === undefined ? 0.4 : options.altitudeScale;
  const altitudeIntegratorRate = options.altitudeIntegratorRate === undefined ? altitudeScale / (altitudeCoefficientA * altitudeCoefficientB) : options.altitudeIntegratorRate;
  const duration = options.duration === undefined ? 10 : options.duration;
  const throttleProfile = options.throttleProfile === undefined ? defaultLunarLandingThrottleProfile(duration) : options.throttleProfile;
  const expectedFinal = lunarLandingReferenceStateAt(duration, {
    throttle,
    thrustScale,
    gravity,
    initialVelocity: 0,
    fuelEfficiency,
    initialAltitude,
    initialFuel,
    altitudeScale,
    throttleProfile,
    duration,
    dt: options.referenceDt === undefined ? 0.002 : options.referenceDt,
  });
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps: Lunar Landing',
    description: 'Booklet-style active-block translation of First Steps Section 9.3. P1 is the descent-engine throttle, CMP1 disables thrust when fuel is empty, CMP2 prevents below-ground altitude integration, OUT X carries altitude h, OUT Y vertical velocity v, and OUT U fuel F.',
    components: [
      { id: 'PLUS1' },
      { id: 'MINUS1' },
      { id: 'ZERO' },
      { id: 'I1', label: 'Integrator / vertical velocity v' },
      { id: 'I2', rate: altitudeIntegratorRate, label: 'Integrator / altitude h' },
      { id: 'I3', label: 'Integrator / fuel level F' },
      { id: 'SUM1', label: 'Summer / T - g, inverted by I1 to vdot = g - T' },
      { id: 'INV1', label: 'Inverter / -T thrust term' },
      { id: 'INV2', label: 'Inverter / -v for altitude integration' },
      { id: 'CMP1', label: 'Comparator / fuel-positive thrust gate' },
      { id: 'CMP2', label: 'Comparator / altitude-positive motion gate' },
      { id: 'P1', coefficient: throttle, timeProfile: throttleProfile, label: 'P1 descent-engine throttle / booklet demonstration profile' },
      { id: 'P2', coefficient: thrustScale, label: 'P2 thrust scale 0.1' },
      { id: 'P3', coefficient: gravityStage, label: 'P3 lunar gravity stage 0.05' },
      { id: 'P4', coefficient: gravityStage, label: 'P4 lunar gravity stage 0.05' },
      { id: 'P5', coefficient: fuelEfficiency, label: 'P5 fuel efficiency alpha' },
      { id: 'P6', coefficient: altitudeCoefficientA, label: 'P6 altitude path scale 0.05' },
      { id: 'P7', coefficient: altitudeCoefficientB, label: 'P7 altitude path scale 0.05' },
      { id: 'OUT_X', label: 'X / altitude h' },
      { id: 'OUT_Y', label: 'Y / vertical velocity v' },
      { id: 'OUT_Z', label: 'Z / available thrust T' },
      { id: 'OUT_U', label: 'U / fuel level F' },
    ],
    cables: [
      { from: 'PLUS1.out', to: 'P1.in', label: 'P1 is the pilot throttle coefficient; the preset uses a booklet-shaped demonstration profile' },
      { from: 'P1.out', to: 'P2.in', label: 'scale throttle to the booklet T = 0.1 * P1 range' },
      { from: 'PLUS1.out', to: 'P3.in', label: 'first 0.05 gravity stage' },
      { from: 'P3.out', to: 'P4.in', label: 'second 0.05 gravity stage' },
      { from: 'MINUS1.out', to: 'I2.ic', label: 'initialize altitude h to +1 through THAT IC sign convention' },
      { from: 'MINUS1.out', to: 'I3.ic', label: 'initialize fuel F to +1 through THAT IC sign convention' },
      { from: 'I3.out', to: 'CMP1.a', label: 'fuel level tests whether thrust is still available' },
      { from: 'ZERO.out', to: 'CMP1.b', label: 'fuel-positive threshold at zero' },
      { from: 'P2.out', to: 'CMP1.positive', label: 'thrust branch while fuel remains' },
      { from: 'ZERO.out', to: 'CMP1.nonPositive', label: 'no thrust when fuel is depleted' },
      { from: 'CMP1.out', to: 'INV1.in', label: 'available thrust T' },
      { from: 'P4.out', to: 'SUM1.in10_1', label: 'gravity stage through x10 input, first half' },
      { from: 'P4.out', to: 'SUM1.in10_2', label: 'gravity stage through x10 input, second half' },
      { from: 'INV1.out', to: 'SUM1.in2', label: '-T term so SUM1.out is T - g' },
      { from: 'SUM1.out', to: 'I1.in1', label: 'I1 inversion yields vdot = g - T' },
      { from: 'CMP1.out', to: 'P5.in', label: 'fuel burn is proportional to available thrust' },
      { from: 'P5.out', to: 'I3.in1', label: 'I3 inversion gives Fdot = -alpha*T' },
      { from: 'I1.out', to: 'INV2.in', label: 'invert v to feed an inverting altitude integrator' },
      { from: 'I2.out', to: 'CMP2.a', label: 'altitude-positive touchdown test' },
      { from: 'ZERO.out', to: 'CMP2.b', label: 'ground threshold' },
      { from: 'INV2.out', to: 'CMP2.positive', label: 'while h > 0, feed -v so I2 derivative is scaled v' },
      { from: 'ZERO.out', to: 'CMP2.nonPositive', label: 'after touchdown, hold altitude' },
      { from: 'CMP2.out', to: 'P6.in', label: 'first 0.05 altitude scaling stage from the booklet patch' },
      { from: 'P6.out', to: 'P7.in', label: 'second 0.05 altitude scaling stage from the booklet patch' },
      { from: 'P7.out', to: 'I2.in1', label: 'scaled altitude integration path' },
      { from: 'I2.out', to: 'OUT_X.in', label: 'altitude h to OUT X' },
      { from: 'I1.out', to: 'OUT_Y.in', label: 'vertical velocity v to OUT Y' },
      { from: 'CMP1.out', to: 'OUT_Z.in', label: 'available thrust to OUT Z for diagnostics' },
      { from: 'I3.out', to: 'OUT_U.in', label: 'fuel level F to OUT U / panel-meter equivalent' },
    ],
    outputs: {
      x: 'OUT_X.out',
      y: 'OUT_Y.out',
      u: 'OUT_U.out',
      altitude: 'OUT_X.out',
      velocity: 'OUT_Y.out',
      thrust: 'OUT_Z.out',
      fuel: 'OUT_U.out',
      gravity: 'P4.out',
      fuelBurn: 'P5.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-lunar-landing',
      page: 17,
      equation: 'vdot = g - T; hdot = v; Fdot = -alpha*T, with comparator gates for fuel and touchdown',
      scopePreset: 'roll',
      throttle,
      throttleProfile,
      thrustScale,
      gravity,
      gravityStage,
      initialVelocity: 0,
      initialAltitude,
      initialFuel,
      altitudeCoefficientA,
      altitudeCoefficientB,
      altitudeScale,
      altitudeIntegratorRate,
      fuelEfficiency,
      duration,
      coefficients: { P1: throttle, P2: thrustScale, P3: gravityStage, P4: gravityStage, P5: fuelEfficiency, P6: altitudeCoefficientA, P7: altitudeCoefficientB },
      expectedFinalAt10s: expectedFinal,
    },
  };
}

function eulerSpiralReferenceStateAt(runTime, options = {}) {
  const tauRate = options.tauRate === undefined ? 0.1 : options.tauRate;
  const tau0 = options.tau0 === undefined ? -1 : options.tau0;
  const cos0 = options.cos0 === undefined ? 0.87 : options.cos0;
  const minusSin0 = options.minusSin0 === undefined ? -0.75 : options.minusSin0;
  const xScale = options.xScale === undefined ? 0.6 : options.xScale;
  const yScale = options.yScale === undefined ? 0.6 : options.yScale;
  const coordinateRate = options.coordinateRate === undefined ? tauRate / 2 : options.coordinateRate;
  const oscillatorRate = options.oscillatorRate === undefined ? tauRate : options.oscillatorRate;
  const rampRate = options.rampRate === undefined ? tauRate : options.rampRate;
  const dt = options.dt === undefined ? 0.001 : options.dt;
  const x0 = options.x0 === undefined ? 0 : options.x0;
  const y0 = options.y0 === undefined ? 0 : options.y0;
  const steps = Math.round(runTime / dt);
  let state = { tau: tau0, cos: cos0, minusSin: minusSin0, x: x0, y: y0 };

  const derivatives = (current) => ({
    tau: rampRate,
    cos: -oscillatorRate * current.tau * (-current.minusSin),
    minusSin: -oscillatorRate * current.tau * current.cos,
    x: coordinateRate * xScale * current.cos,
    y: -coordinateRate * yScale * current.minusSin,
  });
  const addScaled = (current, d, scale) => ({
    tau: current.tau + scale * d.tau,
    cos: current.cos + scale * d.cos,
    minusSin: current.minusSin + scale * d.minusSin,
    x: current.x + scale * d.x,
    y: current.y + scale * d.y,
  });

  for (let index = 0; index < steps; index += 1) {
    const stepDt = index === steps - 1 ? (runTime - index * dt) || dt : dt;
    const k1 = derivatives(state);
    const k2 = derivatives(addScaled(state, k1, stepDt / 2));
    const k3 = derivatives(addScaled(state, k2, stepDt / 2));
    const k4 = derivatives(addScaled(state, k3, stepDt));
    state = {
      tau: state.tau + (stepDt / 6) * (k1.tau + 2 * k2.tau + 2 * k3.tau + k4.tau),
      cos: state.cos + (stepDt / 6) * (k1.cos + 2 * k2.cos + 2 * k3.cos + k4.cos),
      minusSin: state.minusSin + (stepDt / 6) * (k1.minusSin + 2 * k2.minusSin + 2 * k3.minusSin + k4.minusSin),
      x: state.x + (stepDt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: state.y + (stepDt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    };
  }
  return state;
}

function eulerSimpsonIntegral(fn, from, to, panels = 8000) {
  let n = Math.max(2, Math.round(panels));
  if (n % 2) n += 1;
  const h = (to - from) / n;
  let sum = fn(from) + fn(to);
  for (let index = 1; index < n; index += 1) {
    sum += (index % 2 ? 4 : 2) * fn(from + index * h);
  }
  return (h / 3) * sum;
}

function eulerSpiralCenteredSweepParameters(options = {}) {
  const opTimeSeconds = options.opTimeSeconds === undefined ? 120 : options.opTimeSeconds;
  const tauRate = options.tauRate === undefined ? 0.1 : options.tauRate;
  const xScale = options.xScale === undefined ? 0.6 : options.xScale;
  const yScale = options.yScale === undefined ? 0.6 : options.yScale;
  const coordinateRate = options.coordinateRate === undefined ? tauRate / 2 : options.coordinateRate;
  const tauSpan = options.tauSpan === undefined ? Math.max(1, tauRate * opTimeSeconds / 2) : options.tauSpan;
  const rampRate = opTimeSeconds > 0 ? 2 / opTimeSeconds : tauRate;
  const oscillatorRate = opTimeSeconds > 0 ? (2 * tauSpan * tauSpan) / opTimeSeconds : tauRate * tauSpan;
  const phase = (tauSpan * tauSpan) / 2;
  const cos0 = options.cos0 === undefined ? Math.cos(phase) : options.cos0;
  const minusSin0 = options.minusSin0 === undefined ? -Math.sin(phase) : options.minusSin0;
  const panels = options.integralPanels === undefined ? Math.min(100000, Math.max(4000, Math.ceil(tauSpan * 2000))) : options.integralPanels;
  const cosIntegral = eulerSimpsonIntegral((s) => Math.cos((tauSpan * tauSpan * s * s) / 2), -1, 1, panels);
  const sinIntegral = eulerSimpsonIntegral((s) => Math.sin((tauSpan * tauSpan * s * s) / 2), -1, 1, panels);
  const deltaX = coordinateRate * xScale * (opTimeSeconds / 2) * cosIntegral;
  const deltaY = coordinateRate * yScale * (opTimeSeconds / 2) * sinIntegral;
  return {
    opTimeSeconds,
    tauRate,
    tauSpan,
    normalizedTauStart: -1,
    normalizedTauEnd: 1,
    rampRate,
    oscillatorRate,
    coordinateRate,
    xScale,
    yScale,
    cos0,
    minusSin0,
    x0: -deltaX / 2,
    y0: -deltaY / 2,
    expectedCenteredFinalX: deltaX / 2,
    expectedCenteredFinalY: deltaY / 2,
  };
}

function eulerSpiralCenteredInitialCoordinates(options = {}) {
  const runTime = options.runTime === undefined ? (options.opTimeSeconds === undefined ? 120 : options.opTimeSeconds) : options.runTime;
  if (options.normalizedTauSweep || options.tauSpan !== undefined) {
    const centered = eulerSpiralCenteredSweepParameters({ ...options, opTimeSeconds: runTime });
    return {
      x0: centered.x0,
      y0: centered.y0,
      expectedCenteredFinalX: centered.expectedCenteredFinalX,
      expectedCenteredFinalY: centered.expectedCenteredFinalY,
    };
  }
  const delta = eulerSpiralReferenceStateAt(runTime, { ...options, x0: 0, y0: 0 });
  return {
    x0: -delta.x / 2,
    y0: -delta.y / 2,
    expectedCenteredFinalX: delta.x / 2,
    expectedCenteredFinalY: delta.y / 2,
  };
}

function firstStepsEulerSpiralSerializedPatch(options = {}) {
  const tauRate = options.tauRate === undefined ? 0.1 : options.tauRate;
  const xScale = options.xScale === undefined ? 0.6 : options.xScale;
  const coordinateRate = options.coordinateRate === undefined ? tauRate / 2 : options.coordinateRate;
  const yScale = options.yScale === undefined ? 0.6 : options.yScale;
  const opTimeSeconds = options.opTimeSeconds === undefined ? 120 : options.opTimeSeconds;
  const sweep = eulerSpiralCenteredSweepParameters({
    opTimeSeconds,
    tauRate,
    xScale,
    yScale,
    coordinateRate,
    tauSpan: options.tauSpan,
    integralPanels: options.integralPanels,
  });
  const centeredInitial = options.centeredInitial === false
    ? { x0: 0, y0: 0, expectedCenteredFinalX: null, expectedCenteredFinalY: null }
    : { x0: sweep.x0, y0: sweep.y0, expectedCenteredFinalX: sweep.expectedCenteredFinalX, expectedCenteredFinalY: sweep.expectedCenteredFinalY };
  const expectedFinal = eulerSpiralReferenceStateAt(opTimeSeconds, {
    rampRate: sweep.rampRate,
    tau0: sweep.normalizedTauStart,
    oscillatorRate: sweep.oscillatorRate,
    cos0: sweep.cos0,
    minusSin0: sweep.minusSin0,
    xScale,
    yScale,
    coordinateRate,
    x0: centeredInitial.x0,
    y0: centeredInitial.y0,
    dt: options.referenceDt === undefined ? 0.001 : options.referenceDt,
  });
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps: Euler Spiral',
    description: 'Booklet-style active-block translation of First Steps Section 9.5. I1 generates a normalized tau sweep, I2/I3 form a variable-frequency quadrature oscillator, and I4/I5 integrate the quadrature pair to OUT X/Y. The preset auto-centers the phase and coordinate initial states for the selected OP-TIME so the X/Y display shows both point-symmetric Euler spiral arms.',
    components: [
      { id: 'PLUS1' },
      { id: 'MINUS1' },
      { id: 'ZERO' },
      { id: 'I1', initialState: sweep.normalizedTauStart, label: 'Integrator / normalized tau ramp' },
      { id: 'I2', rate: sweep.oscillatorRate, initialState: sweep.cos0, label: 'Integrator / cos(tau^2/2) approximation' },
      { id: 'I3', rate: sweep.oscillatorRate, initialState: sweep.minusSin0, label: 'Integrator / -sin(tau^2/2) approximation' },
      { id: 'I4', rate: coordinateRate, initialState: centeredInitial.x0, label: 'Integrator / x spiral coordinate, centered initial value' },
      { id: 'I5', rate: coordinateRate, initialState: centeredInitial.y0, label: 'Integrator / y spiral coordinate, centered initial value' },
      { id: 'INV1', label: 'Inverter / sin(tau^2/2)' },
      { id: 'INV2', label: 'Inverter / -scaled cos for x integrator' },
      { id: 'MUL1', label: 'Multiplier / tau*sin' },
      { id: 'MUL2', label: 'Multiplier / tau*cos' },
      { id: 'P1', coefficient: sweep.rampRate, label: 'P1 normalized tau ramp rate' },
      { id: 'P2', coefficient: xScale, label: 'P2 x scale' },
      { id: 'P3', coefficient: Math.abs(sweep.cos0), label: 'P3 displayed cos initial magnitude' },
      { id: 'P4', coefficient: Math.abs(sweep.minusSin0), label: 'P4 displayed -sin initial magnitude' },
      { id: 'P5', coefficient: yScale, label: 'P5 y scale' },
      { id: 'OUT_X', label: 'X / Euler spiral x' },
      { id: 'OUT_Y', label: 'Y / Euler spiral y' },
    ],
    cables: [
      { from: 'MINUS1.out', to: 'P1.in', label: '-1 through P1 makes normalized tau ramp upward' },
      { from: 'P1.out', to: 'I1.in1', label: 'normalized tau derivative is +P1' },
      { from: 'PLUS1.out', to: 'P3.in', label: 'feed displayed cosine IC magnitude control' },
      { from: 'PLUS1.out', to: 'P4.in', label: 'feed displayed sine IC magnitude control' },
      { from: 'I3.out', to: 'INV1.in', label: 'recover sin-like signal from I3.out = -sin' },
      { from: 'I1.out', to: 'MUL1.x', label: 'normalized tau into first multiplier' },
      { from: 'INV1.out', to: 'MUL1.y', label: 'sin-like signal into first multiplier' },
      { from: 'MUL1.out', to: 'I2.in1', label: 'tau*sin drives cos derivative through the inverting integrator' },
      { from: 'I1.out', to: 'MUL2.x', label: 'normalized tau into second multiplier' },
      { from: 'I2.out', to: 'MUL2.y', label: 'cos-like signal into second multiplier' },
      { from: 'MUL2.out', to: 'I3.in1', label: 'tau*cos drives -sin derivative through the inverting integrator' },
      { from: 'I2.out', to: 'P2.in', label: 'scale cos-like signal for x integration' },
      { from: 'P2.out', to: 'INV2.in', label: 'invert scaled cos so the inverting x integrator advances positively' },
      { from: 'INV2.out', to: 'I4.in1', label: 'x integrates scaled cos' },
      { from: 'I3.out', to: 'P5.in', label: 'scale -sin-like signal for y integration' },
      { from: 'P5.out', to: 'I5.in1', label: 'y integrates scaled sin because I5 is inverting' },
      { from: 'I4.out', to: 'OUT_X.in', label: 'spiral x coordinate to OUT X' },
      { from: 'I5.out', to: 'OUT_Y.in', label: 'spiral y coordinate to OUT Y' },
    ],
    outputs: {
      x: 'OUT_X.out',
      y: 'OUT_Y.out',
      tau: 'I1.out',
      cos: 'I2.out',
      minusSin: 'I3.out',
      sin: 'INV1.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-euler-spiral',
      page: 19,
      equation: 'x(t)=integral cos(tau^2/2) dtau, y(t)=integral sin(tau^2/2) dtau',
      scopePreset: 'xy',
      tauRate,
      tauSpan: sweep.tauSpan,
      normalizedTauSweep: true,
      eulerSpiralAutoCenterForRun: true,
      rampRate: sweep.rampRate,
      oscillatorRate: sweep.oscillatorRate,
      xScale,
      cos0: sweep.cos0,
      minusSin0: sweep.minusSin0,
      minusSinMagnitude0: Math.abs(sweep.minusSin0),
      yScale,
      coordinateRate,
      opTimeSeconds,
      coefficients: { P1: sweep.rampRate, P2: xScale, P3: Math.abs(sweep.cos0), P4: Math.abs(sweep.minusSin0), P5: yScale },
      centeredInitial,
      centeredSweep: sweep,
      expectedFinalAtDefaultOpTime: expectedFinal,
      expectedFinalAt100s: expectedFinal,
    },
  };
}

function hunterPreyReferenceStateAt(runTime, options = {}) {
  const h0 = options.h0 === undefined ? 0.6 : options.h0;
  const l0 = options.l0 === undefined ? 0.6 : options.l0;
  const alpha = options.alpha === undefined ? 0.365 : options.alpha;
  const beta = options.beta === undefined ? 0.95 : options.beta;
  const gamma = options.gamma === undefined ? 0.09 : options.gamma;
  const delta = options.delta === undefined ? 0.84 : options.delta;
  const dt = options.dt === undefined ? 0.001 : options.dt;
  const steps = Math.round(runTime / dt);
  let state = { h: h0, l: l0 };

  const derivatives = (current) => {
    const interaction = current.h * current.l;
    return {
      h: alpha * current.h - beta * interaction,
      l: delta * interaction - gamma * current.l,
    };
  };
  const addScaled = (current, d, scale) => ({
    h: current.h + scale * d.h,
    l: current.l + scale * d.l,
  });

  for (let index = 0; index < steps; index += 1) {
    const stepDt = index === steps - 1 ? (runTime - index * dt) || dt : dt;
    const k1 = derivatives(state);
    const k2 = derivatives(addScaled(state, k1, stepDt / 2));
    const k3 = derivatives(addScaled(state, k2, stepDt / 2));
    const k4 = derivatives(addScaled(state, k3, stepDt));
    state = {
      h: state.h + (stepDt / 6) * (k1.h + 2 * k2.h + 2 * k3.h + k4.h),
      l: state.l + (stepDt / 6) * (k1.l + 2 * k2.l + 2 * k3.l + k4.l),
    };
  }
  return state;
}

function firstStepsHunterPreySerializedPatch(options = {}) {
  const h0 = options.h0 === undefined ? 0.6 : options.h0;
  const l0 = options.l0 === undefined ? 0.6 : options.l0;
  const alpha = options.alpha === undefined ? 0.365 : options.alpha;
  const beta = options.beta === undefined ? 0.95 : options.beta;
  const gamma = options.gamma === undefined ? 0.09 : options.gamma;
  const delta = options.delta === undefined ? 0.84 : options.delta;
  const duration = options.duration === undefined ? 100 : options.duration;
  const expectedFinal = hunterPreyReferenceStateAt(duration, {
    h0,
    l0,
    alpha,
    beta,
    gamma,
    delta,
    dt: options.referenceDt === undefined ? 0.001 : options.referenceDt,
  });
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps: Hunter/Prey Population Dynamics',
    description: 'Booklet-style Lotka-Volterra active-block patch from First Steps Section 9.6. I1 carries hare population h, I2 carries lynx population l, MUL1 computes h*l, and OUT X/Y provide the roll-mode time traces; the same two outputs can still be switched to X/Y for phase-space exploration.',
    components: [
      { id: 'MINUS1' },
      { id: 'I1', label: 'Integrator / hare population h' },
      { id: 'I2', label: 'Integrator / lynx population l' },
      { id: 'MUL1', label: 'Multiplier / h*l interaction' },
      { id: 'SUM1', label: 'Summer / -h_dot input' },
      { id: 'SUM2', label: 'Summer / -l_dot input' },
      { id: 'INV1', label: 'Inverter / -beta*h*l' },
      { id: 'INV2', label: 'Inverter / -gamma*l' },
      { id: 'P1', coefficient: h0, label: 'P1 initial hare population h0' },
      { id: 'P2', coefficient: l0, label: 'P2 initial lynx population l0' },
      { id: 'P3', coefficient: alpha, label: 'P3 hare growth alpha' },
      { id: 'P4', coefficient: beta, label: 'P4 predation beta' },
      { id: 'P5', coefficient: gamma, label: 'P5 lynx death gamma' },
      { id: 'P6', coefficient: delta, label: 'P6 lynx growth delta' },
      { id: 'OUT_X', label: 'X / hare population h' },
      { id: 'OUT_Y', label: 'Y / lynx population l' },
    ],
    cables: [
      { from: 'MINUS1.out', to: 'P1.in', label: '-1 through P1 gives -h0 for the inverting IC socket' },
      { from: 'P1.out', to: 'I1.ic', label: 'initialize I1.out to positive hare population h0' },
      { from: 'MINUS1.out', to: 'P2.in', label: '-1 through P2 gives -l0 for the inverting IC socket' },
      { from: 'P2.out', to: 'I2.ic', label: 'initialize I2.out to positive lynx population l0' },
      { from: 'I1.out', to: 'MUL1.x', label: 'hare population into h*l interaction multiplier' },
      { from: 'I2.out', to: 'MUL1.y', label: 'lynx population into h*l interaction multiplier' },
      { from: 'I1.out', to: 'P3.in', label: 'scale hare population by alpha' },
      { from: 'MUL1.out', to: 'P4.in', label: 'scale interaction by beta' },
      { from: 'P4.out', to: 'INV1.in', label: 'invert beta*h*l for the hare equation' },
      { from: 'P3.out', to: 'SUM1.in1', label: 'alpha*h term' },
      { from: 'INV1.out', to: 'SUM1.in2', label: '-beta*h*l term' },
      { from: 'SUM1.out', to: 'I1.in1', label: 'summer output is -h_dot, so the inverting integrator advances h_dot' },
      { from: 'MUL1.out', to: 'P6.in', label: 'scale interaction by delta' },
      { from: 'I2.out', to: 'P5.in', label: 'scale lynx population by gamma' },
      { from: 'P5.out', to: 'INV2.in', label: 'invert gamma*l for the lynx equation' },
      { from: 'P6.out', to: 'SUM2.in1', label: 'delta*h*l term' },
      { from: 'INV2.out', to: 'SUM2.in2', label: '-gamma*l term' },
      { from: 'SUM2.out', to: 'I2.in1', label: 'summer output is -l_dot, so the inverting integrator advances l_dot' },
      { from: 'I1.out', to: 'OUT_X.in', label: 'hare population to OUT X' },
      { from: 'I2.out', to: 'OUT_Y.in', label: 'lynx population to OUT Y' },
    ],
    outputs: {
      x: 'OUT_X.out',
      y: 'OUT_Y.out',
      hare: 'OUT_X.out',
      lynx: 'OUT_Y.out',
      interaction: 'MUL1.out',
      hareGrowth: 'P3.out',
      predation: 'P4.out',
      lynxDeath: 'P5.out',
      lynxGrowth: 'P6.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-hunter-prey',
      page: 20,
      equation: 'h_dot = alpha*h - beta*h*l; l_dot = delta*h*l - gamma*l',
      scopePreset: 'time',
      h0,
      l0,
      alpha,
      beta,
      gamma,
      delta,
      duration,
      coefficients: { P1: h0, P2: l0, P3: alpha, P4: beta, P5: gamma, P6: delta },
      expectedFinalAt100s: expectedFinal,
    },
  };
}


function lorenzReferenceStateAt(runTime, options = {}) {
  const x0 = options.x0 === undefined ? 0.18 : options.x0;
  const y0 = options.y0 === undefined ? 0 : options.y0;
  const z0 = options.z0 === undefined ? 0 : options.z0;
  const sigmaScale = options.sigmaScale === undefined ? 1.8 : options.sigmaScale;
  const xyScale = options.xyScale === undefined ? 1.5 : options.xyScale;
  const zDamping = options.zDamping === undefined ? 0.2667 : options.zDamping;
  const zShape = options.zShape === undefined ? 2.68 : options.zShape;
  const rScale = options.rScale === undefined ? 1.536 : options.rScale;
  const yDamping = options.yDamping === undefined ? 0.1 : options.yDamping;
  const dt = options.dt === undefined ? 0.001 : options.dt;
  const steps = Math.round(runTime / dt);
  let state = { x: x0, y: y0, z: z0 };
  let maxAbs = { x: Math.abs(x0), y: Math.abs(y0), z: Math.abs(z0) };

  const derivatives = (current) => {
    const s = -(1 - zShape * current.z);
    const r = -current.x * s;
    return {
      x: sigmaScale * current.y - current.x,
      y: rScale * r - yDamping * current.y,
      z: xyScale * current.x * current.y - zDamping * current.z,
    };
  };
  const addScaled = (current, d, scale) => ({
    x: current.x + scale * d.x,
    y: current.y + scale * d.y,
    z: current.z + scale * d.z,
  });

  for (let index = 0; index < steps; index += 1) {
    const stepDt = index === steps - 1 ? (runTime - index * dt) || dt : dt;
    const k1 = derivatives(state);
    const k2 = derivatives(addScaled(state, k1, stepDt / 2));
    const k3 = derivatives(addScaled(state, k2, stepDt / 2));
    const k4 = derivatives(addScaled(state, k3, stepDt));
    state = {
      x: state.x + (stepDt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: state.y + (stepDt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
      z: state.z + (stepDt / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z),
    };
    maxAbs = {
      x: Math.max(maxAbs.x, Math.abs(state.x)),
      y: Math.max(maxAbs.y, Math.abs(state.y)),
      z: Math.max(maxAbs.z, Math.abs(state.z)),
    };
  }
  return { ...state, maxAbs };
}

function firstStepsLorenzAttractorSerializedPatch(options = {}) {
  const x0 = options.x0 === undefined ? 0.18 : options.x0;
  const y0 = options.y0 === undefined ? 0 : options.y0;
  const z0 = options.z0 === undefined ? 0 : options.z0;
  const yToXCoefficient = options.yToXCoefficient === undefined ? 0.18 : options.yToXCoefficient;
  const xyCoefficient = options.xyCoefficient === undefined ? 0.15 : options.xyCoefficient;
  const zDamping = options.zDamping === undefined ? 0.2667 : options.zDamping;
  const zShapeCoefficient = options.zShapeCoefficient === undefined ? 0.268 : options.zShapeCoefficient;
  const rCoefficient = options.rCoefficient === undefined ? 0.1536 : options.rCoefficient;
  const yDamping = options.yDamping === undefined ? 0.1 : options.yDamping;
  const duration = options.duration === undefined ? 300 : options.duration;
  const expectedFinal = lorenzReferenceStateAt(duration, {
    x0,
    y0,
    z0,
    sigmaScale: 10 * yToXCoefficient,
    xyScale: 10 * xyCoefficient,
    zDamping,
    zShape: 10 * zShapeCoefficient,
    rScale: 10 * rCoefficient,
    yDamping,
    dt: options.referenceDt === undefined ? 0.001 : options.referenceDt,
  });
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps: Lorenz Attractor',
    description: 'Booklet-style active-block translation of First Steps Section 9.7. I1/I2/I3 carry -x, -y, and -z; MUL1 computes x*y; SUM1 forms s = -(1 - 2.68z); MUL2 computes r = -x*s; OUT X/Y/Z provide projection-ready channels.',
    components: [
      { id: 'PLUS1' },
      { id: 'ZERO' },
      { id: 'I1', label: 'Integrator / -x' },
      { id: 'I2', label: 'Integrator / -y' },
      { id: 'I3', label: 'Integrator / -z' },
      { id: 'INV1', label: 'Inverter / x display' },
      { id: 'INV2', label: 'Inverter / y display and x-equation drive' },
      { id: 'INV3', label: 'Inverter / z display' },
      { id: 'MUL1', label: 'Multiplier / x*y' },
      { id: 'SUM1', label: 'Summer / s = -(1 - 2.68z)' },
      { id: 'MUL2', label: 'Multiplier / r = -x*s' },
      { id: 'P1', coefficient: yToXCoefficient, label: 'P1 y-to-x coefficient 0.18, used through x10 as 1.8' },
      { id: 'P2', coefficient: xyCoefficient, label: 'P2 xy coefficient 0.15, used through x10 as 1.5' },
      { id: 'P3', coefficient: zDamping, label: 'P3 z damping coefficient 0.2667' },
      { id: 'P4', coefficient: zShapeCoefficient, label: 'P4 z shape coefficient 0.268, used through x10 as 2.68' },
      { id: 'P5', coefficient: rCoefficient, label: 'P5 r coefficient 0.1536, used through x10 as 1.536' },
      { id: 'P6', coefficient: yDamping, label: 'P6 y damping coefficient 0.1' },
      { id: 'P7', coefficient: x0, label: 'P7 simulator IC helper for initial x' },
      { id: 'OUT_X', label: 'X / Lorenz x' },
      { id: 'OUT_Y', label: 'Y / Lorenz y' },
      { id: 'OUT_Z', label: 'Z / Lorenz z' },
    ],
    cables: [
      { from: 'PLUS1.out', to: 'P7.in', label: 'P7 sets the nonzero x initial condition used to start the attractor' },
      { from: 'P7.out', to: 'I1.ic', label: 'initialize I1.out to -x0 through the inverting IC convention' },
      { from: 'ZERO.out', to: 'I2.ic', label: 'initialize y to zero' },
      { from: 'ZERO.out', to: 'I3.ic', label: 'initialize z to zero' },
      { from: 'I1.out', to: 'INV1.in', label: 'recover x from I1.out = -x' },
      { from: 'I2.out', to: 'INV2.in', label: 'recover y from I2.out = -y' },
      { from: 'I3.out', to: 'INV3.in', label: 'recover z from I3.out = -z' },
      { from: 'I1.out', to: 'I1.in1', label: '-x state supplies the +x term inside d(-x)/dt' },
      { from: 'INV2.out', to: 'P1.in', label: 'scale y by 0.18 before x10 weighting' },
      { from: 'P1.out', to: 'I1.in10', label: 'x10 input implements 1.8*y in the -x equation' },
      { from: 'I1.out', to: 'MUL1.x', label: '-x into xy multiplier' },
      { from: 'I2.out', to: 'MUL1.y', label: '-y into xy multiplier, product is x*y' },
      { from: 'MUL1.out', to: 'P2.in', label: 'scale x*y by 0.15 before x10 weighting' },
      { from: 'P2.out', to: 'I3.in10', label: 'x10 input implements 1.5*x*y in the -z equation' },
      { from: 'I3.out', to: 'P3.in', label: 'scale -z by beta=0.2667 for the -z equation' },
      { from: 'P3.out', to: 'I3.in1', label: 'adds -0.2667*z so I3 derivative becomes -1.5xy + 0.2667z' },
      { from: 'I3.out', to: 'P4.in', label: 'scale -z by 0.268 for the s expression' },
      { from: 'PLUS1.out', to: 'SUM1.in1', label: '+1 term for s = -(1 - 2.68z)' },
      { from: 'P4.out', to: 'SUM1.in10_1', label: 'x10 contribution gives -2.68z before the negating summer' },
      { from: 'I1.out', to: 'MUL2.x', label: '-x into r multiplier' },
      { from: 'SUM1.out', to: 'MUL2.y', label: 's into r multiplier so output is r = -x*s' },
      { from: 'MUL2.out', to: 'P5.in', label: 'scale r by 0.1536 before x10 weighting' },
      { from: 'P5.out', to: 'I2.in10', label: 'x10 input implements 1.536*r in the -y equation' },
      { from: 'I2.out', to: 'P6.in', label: 'scale -y by 0.1 for the -y equation' },
      { from: 'P6.out', to: 'I2.in1', label: 'adds -0.1*y before the inverting integrator' },
      { from: 'INV1.out', to: 'OUT_X.in', label: 'Lorenz x to OUT X' },
      { from: 'INV2.out', to: 'OUT_Y.in', label: 'Lorenz y to OUT Y' },
      { from: 'INV3.out', to: 'OUT_Z.in', label: 'Lorenz z to OUT Z' },
    ],
    outputs: {
      x: 'OUT_X.out',
      y: 'OUT_Y.out',
      z: 'OUT_Z.out',
      minusX: 'I1.out',
      minusY: 'I2.out',
      minusZ: 'I3.out',
      xy: 'MUL1.out',
      s: 'SUM1.out',
      r: 'MUL2.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-lorenz-attractor',
      page: 21,
      equation: '-x = - integral(1.8*y - x) dt + C; -z = - integral(1.5*x*y - 0.2667*z) dt; -y = - integral(1.536*r - 0.1*y) dt',
      scopePreset: 'xy',
      projectionPresets: { xy: ['OUT_X.out', 'OUT_Y.out'], zx: ['OUT_Z.out', 'OUT_X.out'], zy: ['OUT_Z.out', 'OUT_Y.out'] },
      x0,
      y0,
      z0,
      yToXCoefficient,
      xyCoefficient,
      zDamping,
      zShapeCoefficient,
      rCoefficient,
      yDamping,
      duration,
      coefficients: { P1: yToXCoefficient, P2: xyCoefficient, P3: zDamping, P4: zShapeCoefficient, P5: rCoefficient, P6: yDamping, P7: x0 },
      expectedFinalAt300s: expectedFinal,
    },
  };
}


function polynomialGeneratorReferenceStateAt(runTime, options = {}) {
  const rampRate = options.rampRate === undefined ? 1 : options.rampRate;
  const a = options.a === undefined ? -0.3 : options.a;
  const b = options.b === undefined ? 0.4 : options.b;
  const c = options.c === undefined ? 0.7 : options.c;
  const d = options.d === undefined ? 0.1 : options.d;
  const x0 = options.x0 === undefined ? -1 : options.x0;
  const x = x0 + rampRate * runTime;
  const x2 = x * x;
  const x3 = x2 * x;
  return {
    x,
    minusX2: -x2,
    x3,
    aTerm: a * x3,
    bTerm: b * x2,
    cTerm: c * x,
    dTerm: d,
    p: a * x3 + b * x2 + c * x + d,
  };
}

function firstStepsPolynomialGeneratorSerializedPatch(options = {}) {
  const rampRate = options.rampRate === undefined ? 1 : options.rampRate;
  const a = options.a === undefined ? -0.3 : options.a;
  const b = options.b === undefined ? 0.4 : options.b;
  const c = options.c === undefined ? 0.7 : options.c;
  const d = options.d === undefined ? 0.1 : options.d;
  const opTimeSeconds = options.opTimeSeconds === undefined ? 2 : options.opTimeSeconds;
  const aMagnitude = Math.abs(a);
  const expectedFinal = polynomialGeneratorReferenceStateAt(opTimeSeconds, { rampRate, a, b, c, d });
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps: Polynomial Generator',
    description: 'Booklet-style active-block translation of First Steps Section 9.9. I1 ramps x from -1 to +1, I2 generates -x^2 through an XIR summing-junction helper, I3 generates x^3, and P2-P5 form d, c, b, and a terms for p(x).',
    components: [
      { id: 'PLUS1' },
      { id: 'MINUS1' },
      { id: 'I1', label: 'Integrator / x ramp' },
      { id: 'I2', label: 'Integrator / -x^2' },
      { id: 'I3', label: 'Integrator / x^3' },
      { id: 'XIR1', label: 'XIR helper / second x input for -x^2' },
      { id: 'XIR2', label: 'XIR helper / second and third -x^2 inputs for x^3' },
      { id: 'INV1', label: 'Inverter / x^2' },
      { id: 'INV2', label: 'Inverter / -x^3 for negative a default' },
      { id: 'INV3', label: 'Inverter / final p(x)' },
      { id: 'SUM1', label: 'Summer / -(a*x^3 + b*x^2 + c*x + d)' },
      { id: 'P1', coefficient: rampRate, label: 'P1 tau ramp speed' },
      { id: 'P2', coefficient: d, label: 'P2 constant term d' },
      { id: 'P3', coefficient: c, label: 'P3 linear coefficient c' },
      { id: 'P4', coefficient: b, label: 'P4 quadratic coefficient b' },
      { id: 'P5', coefficient: aMagnitude, label: 'P5 cubic coefficient |a|, fed from -x^3 for the default negative a' },
      { id: 'OUT_X', label: 'X / polynomial input x' },
      { id: 'OUT_Y', label: 'Y / polynomial output p(x)' },
    ],
    cables: [
      { from: 'PLUS1.out', to: 'I1.ic', label: '+1 on IC makes I1.out start at x=-1' },
      { from: 'MINUS1.out', to: 'P1.in', label: '-1 through P1 sets the positive ramp derivative dx/dt' },
      { from: 'P1.out', to: 'I1.in1', label: 'inverting integrator turns -tau into a positive x ramp' },
      { from: 'PLUS1.out', to: 'I2.ic', label: '+1 on IC makes I2.out start at -x^2=-1' },
      { from: 'I1.out', to: 'I2.in1', label: 'first x contribution for d(-x^2)/dt=-2x' },
      { from: 'I1.out', to: 'XIR1.in1', label: 'second x contribution through XIR1' },
      { from: 'XIR1.out', to: 'I2.sj', label: 'XIR1 adds the second x input at the summing junction' },
      { from: 'PLUS1.out', to: 'I3.ic', label: '+1 on IC makes I3.out start at x^3=-1' },
      { from: 'I2.out', to: 'I3.in1', label: 'first -x^2 contribution for d(x^3)/dt=3x^2' },
      { from: 'I2.out', to: 'XIR2.in1', label: 'second -x^2 contribution through XIR2' },
      { from: 'I2.out', to: 'XIR2.in2', label: 'third -x^2 contribution through XIR2' },
      { from: 'XIR2.out', to: 'I3.sj', label: 'XIR2 adds two more -x^2 inputs at the summing junction' },
      { from: 'I2.out', to: 'INV1.in', label: 'recover positive x^2 from -x^2' },
      { from: 'I3.out', to: 'INV2.in', label: 'recover -x^3 so P5 can implement the default a=-0.3' },
      { from: 'PLUS1.out', to: 'P2.in', label: 'constant term d' },
      { from: 'I1.out', to: 'P3.in', label: 'linear term c*x' },
      { from: 'INV1.out', to: 'P4.in', label: 'quadratic term b*x^2' },
      { from: 'INV2.out', to: 'P5.in', label: 'cubic term a*x^3 with default negative sign' },
      { from: 'P2.out', to: 'SUM1.in1', label: 'd into final polynomial summer' },
      { from: 'P3.out', to: 'SUM1.in2', label: 'c*x into final polynomial summer' },
      { from: 'P4.out', to: 'SUM1.in3', label: 'b*x^2 into final polynomial summer' },
      { from: 'P5.out', to: 'SUM1.in4', label: 'a*x^3 into final polynomial summer' },
      { from: 'SUM1.out', to: 'INV3.in', label: 'invert negating-summer output to get p(x)' },
      { from: 'I1.out', to: 'OUT_X.in', label: 'x ramp to OUT X for X/Y display' },
      { from: 'INV3.out', to: 'OUT_Y.in', label: 'polynomial p(x) to OUT Y' },
    ],
    outputs: {
      x: 'OUT_X.out',
      y: 'OUT_Y.out',
      polynomial: 'OUT_Y.out',
      minusX2: 'I2.out',
      x2: 'INV1.out',
      x3: 'I3.out',
      aTerm: 'P5.out',
      bTerm: 'P4.out',
      cTerm: 'P3.out',
      dTerm: 'P2.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-polynomial-generator',
      page: 23,
      equation: 'p(x) = a*x^3 + b*x^2 + c*x + d',
      scopePreset: 'xy',
      rampRate,
      a,
      b,
      c,
      d,
      opTimeSeconds,
      coefficients: { P1: rampRate, P2: d, P3: c, P4: b, P5: aMagnitude },
      defaultPolynomial: 'p(x) = -0.3*x^3 + 0.4*x^2 + 0.7*x + 0.1',
      expectedFinalAt2s: expectedFinal,
    },
  };
}


function neuronalBurstingReferenceStateAt(runTime, options = {}) {
  const x0 = options.x0 === undefined ? 1 : options.x0;
  const y0 = options.y0 === undefined ? 0 : options.y0;
  const z0 = options.z0 === undefined ? 1 : options.z0;
  const aStar10 = options.aStar10 === undefined ? 0.4 : options.aStar10;
  const bStar10 = options.bStar10 === undefined ? 0.6 : options.bStar10;
  const yToX10 = options.yToX10 === undefined ? 0.75 : options.yToX10;
  const c = options.c === undefined ? 0.066 : options.c;
  const dStar10 = options.dStar10 === undefined ? 0.133 : options.dStar10;
  const hundredR = options.hundredR === undefined ? 0.1 : options.hundredR;
  const hundredRs = options.hundredRs === undefined ? 0.4 : options.hundredRs;
  const hundredRsXr = options.hundredRsXr === undefined ? 0.32 : options.hundredRsXr;
  const iExt = options.iExt === undefined ? 1 : options.iExt;
  const slowFactor = options.slowFactor === undefined ? 100 : options.slowFactor;
  const timeScale = options.timeScale === undefined ? 50 : options.timeScale;
  const dt = options.dt === undefined ? 0.001 : options.dt;
  const steps = Math.round(runTime / dt);
  let state = { x: x0, y: y0, minusZ: -z0 };
  let maxAbs = { x: Math.abs(state.x), y: Math.abs(state.y), minusZ: Math.abs(state.minusZ) };
  let peakCount = 0;
  let previousX = state.x;
  let previousSlope = 0;

  const derivatives = (current) => {
    const x2 = current.x * current.x;
    const x3 = x2 * current.x;
    return {
      x: timeScale * (-(10 * aStar10) * x3 + (10 * bStar10) * x2 + (10 * yToX10) * current.y + current.minusZ + iExt),
      y: timeScale * (-(10 * dStar10) * x2 + c - current.y),
      minusZ: -timeScale * ((hundredRs * current.x + hundredRsXr + hundredR * current.minusZ) / slowFactor),
    };
  };
  const addScaled = (current, dState, scale) => ({
    x: current.x + scale * dState.x,
    y: current.y + scale * dState.y,
    minusZ: current.minusZ + scale * dState.minusZ,
  });

  for (let index = 0; index < steps; index += 1) {
    const stepDt = index === steps - 1 ? (runTime - index * dt) || dt : dt;
    const k1 = derivatives(state);
    const k2 = derivatives(addScaled(state, k1, stepDt / 2));
    const k3 = derivatives(addScaled(state, k2, stepDt / 2));
    const k4 = derivatives(addScaled(state, k3, stepDt));
    state = {
      x: state.x + (stepDt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: state.y + (stepDt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
      minusZ: state.minusZ + (stepDt / 6) * (k1.minusZ + 2 * k2.minusZ + 2 * k3.minusZ + k4.minusZ),
    };
    const slope = state.x - previousX;
    if (previousSlope > 0 && slope <= 0 && previousX > 0) peakCount += 1;
    previousSlope = slope;
    previousX = state.x;
    maxAbs = {
      x: Math.max(maxAbs.x, Math.abs(state.x)),
      y: Math.max(maxAbs.y, Math.abs(state.y)),
      minusZ: Math.max(maxAbs.minusZ, Math.abs(state.minusZ)),
    };
  }
  return { ...state, z: -state.minusZ, maxAbs, peakCount };
}

function firstStepsNeuronalBurstingSerializedPatch(options = {}) {
  const bStar10 = options.bStar10 === undefined ? 0.6 : options.bStar10;
  const aStar10 = options.aStar10 === undefined ? 0.4 : options.aStar10;
  const yToX10 = options.yToX10 === undefined ? 0.75 : options.yToX10;
  const x0 = options.x0 === undefined ? 1 : options.x0;
  const z0 = options.z0 === undefined ? 1 : options.z0;
  const hundredR = options.hundredR === undefined ? 0.1 : options.hundredR;
  const hundredRs = options.hundredRs === undefined ? 0.4 : options.hundredRs;
  const hundredRsXr = options.hundredRsXr === undefined ? 0.32 : options.hundredRsXr;
  const c = options.c === undefined ? 0.066 : options.c;
  const dStar10 = options.dStar10 === undefined ? 0.133 : options.dStar10;
  const iExt = options.iExt === undefined ? 1 : options.iExt;
  const slowFactor = options.slowFactor === undefined ? 100 : options.slowFactor;
  const timeScale = options.timeScale === undefined ? 50 : options.timeScale;
  const duration = options.duration === undefined ? 40 : options.duration;
  const expectedFinal = neuronalBurstingReferenceStateAt(duration, {
    x0,
    y0: 0,
    z0,
    bStar10,
    aStar10,
    yToX10,
    c,
    dStar10,
    hundredR,
    hundredRs,
    hundredRsXr,
    iExt,
    slowFactor,
    timeScale,
    dt: options.referenceDt === undefined ? 0.001 : options.referenceDt,
  });
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps: Neuronal Bursting',
    description: 'Booklet-style active-block translation of First Steps Section 9.4 using the scaled Hindmarsh-Rose equations. I1 carries scaled membrane output x, I2 carries y, I3 carries -z in SLOW mode, MUL1/MUL2 generate x^2/x^3, and OUT X/Y/Z expose x, y, and -z.',
    components: [
      { id: 'PLUS1' },
      { id: 'MINUS1' },
      { id: 'ZERO' },
      { id: 'I1', rate: timeScale, label: 'Integrator / scaled x membrane output' },
      { id: 'I2', rate: timeScale, label: 'Integrator / scaled y fast-ion channel state' },
      { id: 'I3', rate: timeScale, slowFactor, label: 'SLOW integrator / -z slow-channel state' },
      { id: 'MUL1', label: 'Multiplier / x^2' },
      { id: 'MUL2', label: 'Multiplier / x^3' },
      { id: 'SUM1', label: 'Summer / scaled -xdot drive' },
      { id: 'SUM2', label: 'Summer / scaled -ydot drive' },
      { id: 'XIR1', label: 'XIR helper / Iext summing-junction input' },
      { id: 'XIR2', label: 'XIR helper / slow z summing-junction inputs' },
      { id: 'INV1', label: 'Inverter / -a*10*x^3 preweighted term' },
      { id: 'INV2', label: 'Inverter / -d*10*x^2 preweighted term' },
      { id: 'INV3', label: 'Inverter / -y' },
      { id: 'INV4', label: 'Inverter / z display' },
      { id: 'P1', coefficient: bStar10, label: 'P1 b*10 coefficient shown as 0.6' },
      { id: 'P2', coefficient: aStar10, label: 'P2 a*10 coefficient shown as 0.4' },
      { id: 'P3', coefficient: yToX10, label: 'P3 0.75*y term into x equation' },
      { id: 'P4', coefficient: hundredR, label: 'P4 100r coefficient' },
      { id: 'P5', coefficient: hundredRs, label: 'P5 100rs coefficient' },
      { id: 'P6', coefficient: hundredRsXr, label: 'P6 100rs*xr offset magnitude' },
      { id: 'P7', coefficient: c, label: 'P7 c coefficient' },
      { id: 'P8', coefficient: dStar10, label: 'P8 d*10 coefficient shown as 0.133' },
      { id: 'OUT_X', label: 'X / neuronal burst output x' },
      { id: 'OUT_Y', label: 'Y / y channel state' },
      { id: 'OUT_Z', label: 'Z / -z slow channel' },
      { id: 'OUT_U', label: 'U / z display' },
    ],
    cables: [
      { from: 'MINUS1.out', to: 'I1.ic', label: '-1 on IC initializes I1.out to x = +1' },
      { from: 'ZERO.out', to: 'I2.ic', label: 'initialize y to zero' },
      { from: 'PLUS1.out', to: 'I3.ic', label: '+1 on IC initializes I3.out to -z = -1' },
      { from: 'I1.out', to: 'MUL1.x', label: 'x into x^2 multiplier' },
      { from: 'I1.out', to: 'MUL1.y', label: 'x into x^2 multiplier' },
      { from: 'MUL1.out', to: 'MUL2.x', label: 'x^2 into x^3 multiplier' },
      { from: 'I1.out', to: 'MUL2.y', label: 'x into x^3 multiplier' },
      { from: 'MUL1.out', to: 'P1.in', label: 'x^2 scaled by b*10=0.6 before x10 input gives 6*x^2' },
      { from: 'MUL2.out', to: 'P2.in', label: 'x^3 scaled by a*10=0.4 before x10 input gives 4*x^3' },
      { from: 'P2.out', to: 'INV1.in', label: 'invert a*10*x^3 to form the negative cubic term' },
      { from: 'INV1.out', to: 'SUM1.in10_1', label: 'x10 input implements -4*x^3' },
      { from: 'P1.out', to: 'SUM1.in10_2', label: 'x10 input implements +6*x^2' },
      { from: 'I2.out', to: 'P3.in', label: 'scale y by 0.75 before x10 input' },
      { from: 'P3.out', to: 'SUM1.in10_3', label: 'x10 input implements +7.5*y' },
      { from: 'I3.out', to: 'SUM1.in1', label: '-z term, represented by I3.out' },
      { from: 'PLUS1.out', to: 'XIR1.in1', label: 'Iext = +1 input can be disconnected in the physical exercise' },
      { from: 'XIR1.out', to: 'SUM1.sj', label: 'add Iext through the summing-junction helper' },
      { from: 'SUM1.out', to: 'I1.in1', label: 'SUM1 emits -xdot for the inverting x integrator' },
      { from: 'PLUS1.out', to: 'P7.in', label: 'constant c' },
      { from: 'MUL1.out', to: 'P8.in', label: 'x^2 scaled by d*10=0.133 before x10 input gives about 1.33*x^2' },
      { from: 'P8.out', to: 'INV2.in', label: 'invert d*10*x^2 to form the negative y-equation term' },
      { from: 'I2.out', to: 'INV3.in', label: 'invert y to form -y' },
      { from: 'P7.out', to: 'SUM2.in1', label: 'c term' },
      { from: 'INV2.out', to: 'SUM2.in10_1', label: 'x10 input implements -1.33*x^2' },
      { from: 'INV3.out', to: 'SUM2.in2', label: '-y term' },
      { from: 'SUM2.out', to: 'I2.in1', label: 'SUM2 emits -ydot for the inverting y integrator' },
      { from: 'I1.out', to: 'P5.in', label: 'x scaled by 100rs before SLOW division' },
      { from: 'P5.out', to: 'I3.in1', label: '100rs*x contribution to the -z slow integrator input' },
      { from: 'PLUS1.out', to: 'P6.in', label: '100rs*xr offset magnitude' },
      { from: 'I3.out', to: 'P4.in', label: '-z scaled by 100r before SLOW division' },
      { from: 'P6.out', to: 'XIR2.in1', label: 'offset contribution for the slow z equation' },
      { from: 'P4.out', to: 'XIR2.in2', label: '100r*(-z) damping contribution' },
      { from: 'XIR2.out', to: 'I3.sj', label: 'combine slow z offset and damping through summing junction' },
      { from: 'I3.out', to: 'I3.slow', label: 'output-to-SLOW feedback activates the 0.01 speed scale' },
      { from: 'I3.out', to: 'INV4.in', label: 'recover positive z for diagnostics' },
      { from: 'I1.out', to: 'OUT_X.in', label: 'neuronal burst output x to OUT X' },
      { from: 'I2.out', to: 'OUT_Y.in', label: 'y state to OUT Y' },
      { from: 'I3.out', to: 'OUT_Z.in', label: '-z state to OUT Z' },
      { from: 'INV4.out', to: 'OUT_U.in', label: 'positive z to OUT U' },
    ],
    outputs: {
      x: 'OUT_X.out',
      y: 'OUT_Y.out',
      minusZ: 'OUT_Z.out',
      z: 'OUT_U.out',
      x2: 'MUL1.out',
      x3: 'MUL2.out',
      xCubicTerm: 'INV1.out',
      yEquationDrive: 'SUM2.out',
      iExt: 'XIR1.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-neuronal-bursting',
      page: 18,
      equation: 'xdot = -4*x^3 + 6*x^2 + 7.5*y - z + Iext; ydot = -1.33*x^2 + c - y; zdot = 0.004*x + 0.0032 - z/1000',
      scopePreset: 'time-x',
      x0,
      y0: 0,
      z0,
      minusZ0: -z0,
      bStar10,
      aStar10,
      yToX10,
      c,
      dStar10,
      hundredR,
      hundredRs,
      hundredRsXr,
      iExt,
      slowFactor,
      timeScale,
      duration,
      coefficients: { P1: bStar10, P2: aStar10, P3: yToX10, P4: hundredR, P5: hundredRs, P6: hundredRsXr, P7: c, P8: dStar10 },
      expectedFinalAt40s: expectedFinal,
    },
  };
}


function bouncingBallReferenceStateAt(runTime, options = {}) {
  const x0 = options.x0 === undefined ? -0.8 : options.x0;
  const vx0 = options.vx0 === undefined ? 0.36 : options.vx0;
  const y0 = options.y0 === undefined ? -0.8 : options.y0;
  const vy0 = options.vy0 === undefined ? 0 : options.vy0;
  const gravity = options.gravity === undefined ? 0.16 : options.gravity;
  const verticalDrag = options.verticalDrag === undefined ? 0.2 : options.verticalDrag;
  const horizontalDrag = options.horizontalDrag === undefined ? 0.02 : options.horizontalDrag;
  const wallStiffness = options.wallStiffness === undefined ? 200 : options.wallStiffness;
  const floorStiffness = options.floorStiffness === undefined ? 300 : options.floorStiffness;
  const boundary = options.boundary === undefined ? 1 : options.boundary;
  const dt = options.dt === undefined ? 0.001 : options.dt;
  const steps = Math.round(runTime / dt);
  let state = { vx: vx0, x: x0, vy: vy0, y: y0 };
  let floorContactCount = 0;
  let rightWallContactCount = 0;
  let leftWallContactCount = 0;
  let peakY = y0;
  let minY = y0;
  let maxX = x0;
  let minX = x0;

  const derivatives = (current) => {
    const rightOverdrive = Math.max(0, current.x - boundary);
    const leftOverdrive = Math.max(0, -current.x - boundary);
    const floorOverdrive = Math.max(0, current.y - boundary);
    const ceilingOverdrive = Math.max(0, -current.y - boundary);
    return {
      vx: -wallStiffness * rightOverdrive + wallStiffness * leftOverdrive - horizontalDrag * current.vx,
      x: current.vx,
      vy: gravity - verticalDrag * current.vy - floorStiffness * floorOverdrive + floorStiffness * ceilingOverdrive,
      y: current.vy,
    };
  };
  const addScaled = (current, d, scale) => ({
    vx: current.vx + scale * d.vx,
    x: current.x + scale * d.x,
    vy: current.vy + scale * d.vy,
    y: current.y + scale * d.y,
  });

  for (let index = 0; index < steps; index += 1) {
    const stepStart = index * dt;
    const stepDt = index === steps - 1 ? (runTime - stepStart) || dt : dt;
    const previous = state;
    const k1 = derivatives(state);
    const k2 = derivatives(addScaled(state, k1, stepDt / 2));
    const k3 = derivatives(addScaled(state, k2, stepDt / 2));
    const k4 = derivatives(addScaled(state, k3, stepDt));
    state = {
      vx: state.vx + (stepDt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
      x: state.x + (stepDt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      vy: state.vy + (stepDt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
      y: state.y + (stepDt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    };
    if (previous.y <= boundary && state.y > boundary) floorContactCount += 1;
    if (previous.x <= boundary && state.x > boundary) rightWallContactCount += 1;
    if (previous.x >= -boundary && state.x < -boundary) leftWallContactCount += 1;
    peakY = Math.max(peakY, state.y);
    minY = Math.min(minY, state.y);
    maxX = Math.max(maxX, state.x);
    minX = Math.min(minX, state.x);
  }
  const rightOverdrive = Math.max(0, state.x - boundary);
  const leftOverdrive = Math.max(0, -state.x - boundary);
  const floorOverdrive = Math.max(0, state.y - boundary);
  const ceilingOverdrive = Math.max(0, -state.y - boundary);
  const displayY = -state.y;
  return {
    ...state,
    displayY,
    visibleY: displayY,
    rightOverdrive,
    leftOverdrive,
    floorOverdrive,
    ceilingOverdrive,
    floorContactCount,
    rightWallContactCount,
    leftWallContactCount,
    peakY,
    minY,
    displayPeakY: -minY,
    displayMinY: -peakY,
    maxX,
    minX,
  };
}

function firstStepsBouncingBallSerializedPatch(options = {}) {
  const x0 = options.x0 === undefined ? -0.8 : options.x0;
  const vx0 = options.vx0 === undefined ? 0.36 : options.vx0;
  const y0 = options.y0 === undefined ? -0.8 : options.y0;
  const vy0 = options.vy0 === undefined ? 0 : options.vy0;
  const gravity = options.gravity === undefined ? 0.16 : options.gravity;
  const verticalDrag = options.verticalDrag === undefined ? 0.2 : options.verticalDrag;
  const horizontalDrag = options.horizontalDrag === undefined ? 0.02 : options.horizontalDrag;
  const wallStiffness = options.wallStiffness === undefined ? 200 : options.wallStiffness;
  const floorStiffness = options.floorStiffness === undefined ? 300 : options.floorStiffness;
  const boundary = options.boundary === undefined ? 1 : options.boundary;
  const opTimeSeconds = options.opTimeSeconds === undefined ? 20 : options.opTimeSeconds;
  const expectedFinalAtOpTime = bouncingBallReferenceStateAt(opTimeSeconds, { x0, vx0, y0, vy0, gravity, verticalDrag, horizontalDrag, wallStiffness, floorStiffness, boundary });
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps: Bouncing Ball',
    description: 'Runnable Section 9.8 Bouncing Ball approximation. Ideal diode/Z-diode overdrive blocks detect wall/floor penetration, capacitor states store x/vx/y/vy, and tuned spring-style contact forces create the repeated rebound trace. The vertical path uses a standard inverter module for the OUT Y sign convention; no hidden helper component is inserted.',
    components: [
      { id: 'PLUS1' },
      { id: 'MINUS1' },
      { id: 'P3', coefficient: gravity, label: 'P3 gravity coefficient g' },
      { id: 'P4', coefficient: verticalDrag, label: 'P4 vertical drag coefficient d' },
      { id: 'CAP1', type: 'capacitor', label: 'Capacitor / horizontal velocity vx', initialState: vx0 },
      { id: 'CAP2', type: 'capacitor', label: 'Capacitor / horizontal position x', initialState: x0 },
      { id: 'CAP3', type: 'capacitor', label: 'Capacitor / vertical velocity vy', initialState: vy0 },
      { id: 'CAP4', type: 'capacitor', label: 'Capacitor / vertical position y', initialState: y0 },
      { id: 'INV1', label: 'Inverter / -x for left-wall detector' },
      { id: 'INV2', label: 'Standard inverter / OUT Y sign convention' },
      { id: 'D1', type: 'diode', label: 'Right-wall ideal diode x>+1', forwardDrop: 0 },
      { id: 'D2', type: 'diode', label: 'Left-wall ideal diode x<-1', forwardDrop: 0 },
      { id: 'ZD1', type: 'z-diode', label: 'Floor Z-diode y>+1', zenerVoltage: boundary, mode: 'positive-overdrive' },
      { id: 'ZD2', type: 'z-diode', label: 'Ceiling Z-diode y<-1', zenerVoltage: boundary, mode: 'negative-overdrive' },
      { id: 'D3', type: 'diode', label: 'Floor contact diode', forwardDrop: 0 },
      { id: 'SUM1', type: 'summer', label: 'Horizontal acceleration sum', inputs: [
        { name: 'right', weight: wallStiffness, required: false },
        { name: 'left', weight: -wallStiffness, required: false },
        { name: 'drag', weight: horizontalDrag, required: false },
      ] },
      { id: 'SUM2', type: 'summer', label: 'Vertical acceleration sum', inputs: [
        { name: 'gravityNeg', weight: 1, required: false },
        { name: 'drag', weight: 1, required: false },
        { name: 'floor', weight: floorStiffness, required: false },
        { name: 'ceiling', weight: -floorStiffness, required: false },
      ] },
      { id: 'OUT_X', label: 'X / horizontal position x' },
      { id: 'OUT_Y', label: 'Y / vertical position y' },
      { id: 'OUT_Z', label: 'Z / horizontal velocity vx' },
      { id: 'OUT_U', label: 'U / vertical velocity vy' },
    ],
    cables: [
      { from: 'CAP1.out', to: 'CAP2.in', label: 'integrate horizontal velocity into x' },
      { from: 'CAP3.out', to: 'CAP4.in', label: 'integrate vertical velocity into y' },
      { from: 'CAP2.out', to: 'D1.in', label: 'right-wall detector input x' },
      { from: 'PLUS1.out', to: 'D1.reference', label: 'right wall at +1 machine unit' },
      { from: 'CAP2.out', to: 'INV1.in', label: 'invert x for left-wall detector' },
      { from: 'INV1.out', to: 'D2.in', label: 'left-wall detector input -x' },
      { from: 'PLUS1.out', to: 'D2.reference', label: 'left wall at -1 machine unit' },
      { from: 'D1.out', to: 'SUM1.right', label: 'right-wall penetration pushes left' },
      { from: 'D2.out', to: 'SUM1.left', label: 'left-wall penetration pushes right' },
      { from: 'CAP1.out', to: 'SUM1.drag', label: 'horizontal drag damps vx' },
      { from: 'SUM1.out', to: 'CAP1.in', label: 'horizontal acceleration updates vx' },
      { from: 'CAP4.out', to: 'ZD1.in', label: 'floor detector y>+1' },
      { from: 'CAP4.out', to: 'ZD2.in', label: 'ceiling detector y<-1' },
      { from: 'ZD1.out', to: 'D3.in', label: 'floor Z-diode overdrive through ideal diode' },
      { from: 'MINUS1.out', to: 'P3.in', label: '-1 into P3 creates the gravity term -g' },
      { from: 'P3.out', to: 'SUM2.gravityNeg', label: 'gravity contribution through standard coefficient P3' },
      { from: 'CAP3.out', to: 'P4.in', label: 'vertical velocity through standard drag coefficient P4' },
      { from: 'P4.out', to: 'SUM2.drag', label: 'vertical drag damps vy' },
      { from: 'D3.out', to: 'SUM2.floor', label: 'floor contact pushes upward' },
      { from: 'ZD2.out', to: 'SUM2.ceiling', label: 'ceiling contact pushes downward' },
      { from: 'SUM2.out', to: 'CAP3.in', label: 'vertical acceleration updates vy' },
      { from: 'CAP2.out', to: 'OUT_X.in', label: 'x to OUT X' },
      { from: 'CAP4.out', to: 'INV2.in', label: 'standard inverter forms the visible OUT Y sign' },
      { from: 'INV2.out', to: 'OUT_Y.in', label: 'visible y to OUT Y through a standard inverter module' },
      { from: 'CAP1.out', to: 'OUT_Z.in', label: 'vx to OUT Z' },
      { from: 'CAP3.out', to: 'OUT_U.in', label: 'vy to OUT U' },
    ],
    outputs: {
      x: 'OUT_X.out',
      y: 'OUT_Y.out',
      displayY: 'OUT_Y.out',
      physicalY: 'CAP4.out',
      vx: 'OUT_Z.out',
      vy: 'OUT_U.out',
      rightWallContact: 'D1.out',
      leftWallContact: 'D2.out',
      floorContact: 'D3.out',
      ceilingContact: 'ZD2.out',
      horizontalAcceleration: 'SUM1.out',
      verticalAcceleration: 'SUM2.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-bouncing-ball',
      page: 22,
      equation: 'xDot = vx; vxDot = wall/drag response; yDot = vy; vyDot = g - d*vy - c*max(y-1,0) + c*max(-y-1,0); OUT_Y is formed through standard INV2',
      x0,
      vx0,
      y0,
      vy0,
      gravity,
      verticalDrag,
      horizontalDrag,
      wallStiffness,
      floorStiffness,
      boundary,
      scopePreset: 'xy',
      opTimeSeconds,
      accessoryRuntime: 'ideal diode/Z-diode overdrive plus capacitor state storage with tuned contact stiffness; OUT_Y sign is routed through standard inverter INV2, not a hidden display transform',
      expectedFinalAtOpTime,
      expectedDisplayYAtOpTime: expectedFinalAtOpTime.displayY,
    },
  };
}


function coefficientForMachineUnitValue(value, name = 'value') {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a finite number`);
  if (number < -1 || number > 1) throw new RangeError(`${name} must be in [-1, 1], got ${number}`);
  return (number + 1) / 2;
}

function adjustableMachineUnitValueFromCoefficient(coefficient) {
  const number = Number(coefficient);
  if (!Number.isFinite(number)) throw new Error('coefficient must be a finite number');
  if (number < 0 || number > 1) throw new RangeError(`coefficient must be in [0, 1], got ${number}`);
  return 2 * number - 1;
}

function helperCoefficientFromOptions(options, valueName, defaultValue) {
  const coefficientName = `${valueName}Coefficient`;
  if (options[coefficientName] !== undefined) return Number(options[coefficientName]);
  return coefficientForMachineUnitValue(options[valueName] === undefined ? defaultValue : options[valueName], valueName);
}

function firstStepsAdjustableMinusOnePlusOneSerializedPatch(options = {}) {
  const coefficient = helperCoefficientFromOptions(options, 'value', 0);
  const expectedValue = adjustableMachineUnitValueFromCoefficient(coefficient);
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps Helper: Adjustable Value -1 to +1',
    description: 'Section 10.4 helper. P1 is mapped from 0..1 to a full machine-unit output by summing 2*P1 - 1 and displaying the result on OUT Y.',
    components: [
      { id: 'PLUS1' },
      { id: 'MINUS1' },
      { id: 'P1', coefficient, label: 'P1 adjustable knob k' },
      { id: 'SUM1', label: 'Summer / -(2*k - 1)' },
      { id: 'INV1', label: 'Inverter / 2*k - 1' },
      { id: 'OUT_Y', label: 'Y / adjustable -1..+1 value' },
    ],
    cables: [
      { from: 'PLUS1.out', to: 'P1.in', label: '+1 into P1 gives knob value k in 0..1' },
      { from: 'P1.out', to: 'SUM1.in1', label: 'first k contribution' },
      { from: 'P1.out', to: 'SUM1.in2', label: 'second k contribution, giving 2*k' },
      { from: 'MINUS1.out', to: 'SUM1.in3', label: '-1 offset contribution' },
      { from: 'SUM1.out', to: 'INV1.in', label: 'recover non-inverted 2*k - 1' },
      { from: 'INV1.out', to: 'OUT_Y.in', label: 'full machine-unit adjustable value to OUT Y' },
    ],
    outputs: {
      y: 'OUT_Y.out',
      adjustable: 'OUT_Y.out',
      rawSummer: 'SUM1.out',
      knob: 'P1.out',
    },
    parameters: {
      firstStepsExampleId: 'first-steps-helper-adjustable-minus-one-plus-one',
      page: 24,
      equation: 'out = 2*k - 1, with k in [0,1]',
      coefficient,
      expectedValue,
    },
  };
}

function adjustableSignalCables(componentPrefix, potentiometerId, summerId, inverterId) {
  return [
    { from: 'PLUS1.out', to: `${potentiometerId}.in`, label: `${componentPrefix}: +1 into coefficient knob` },
    { from: `${potentiometerId}.out`, to: `${summerId}.in1`, label: `${componentPrefix}: first k contribution` },
    { from: `${potentiometerId}.out`, to: `${summerId}.in2`, label: `${componentPrefix}: second k contribution` },
    { from: 'MINUS1.out', to: `${summerId}.in3`, label: `${componentPrefix}: -1 offset for 2*k-1` },
    { from: `${summerId}.out`, to: `${inverterId}.in`, label: `${componentPrefix}: invert summer output to recover full-range signal` },
  ];
}

function firstStepsHelperMaxSerializedPatch(options = {}) {
  const aCoefficient = helperCoefficientFromOptions(options, 'a', 0.25);
  const bCoefficient = helperCoefficientFromOptions(options, 'b', -0.4);
  const a = adjustableMachineUnitValueFromCoefficient(aCoefficient);
  const b = adjustableMachineUnitValueFromCoefficient(bCoefficient);
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps Helper: Maximum of Two Values',
    description: 'Section 10.1 helper. Two adjustable input stubs generate A and B, CMP1 tests A-B, and OUT Y receives max(A,B).',
    components: [
      { id: 'PLUS1' }, { id: 'MINUS1' },
      { id: 'P1', coefficient: aCoefficient, label: 'P1 input A knob' },
      { id: 'P2', coefficient: bCoefficient, label: 'P2 input B knob' },
      { id: 'SUM1', label: 'A source summer' }, { id: 'SUM2', label: 'B source summer' },
      { id: 'INV1', label: 'A source output' }, { id: 'INV2', label: 'B source output' }, { id: 'INV3', label: '-B for A-B comparison' },
      { id: 'CMP1', label: 'Comparator / choose greater value' },
      { id: 'OUT_Y', label: 'Y / max(A,B)' },
    ],
    cables: [
      ...adjustableSignalCables('A', 'P1', 'SUM1', 'INV1'),
      ...adjustableSignalCables('B', 'P2', 'SUM2', 'INV2'),
      { from: 'INV2.out', to: 'INV3.in', label: 'form -B' },
      { from: 'INV1.out', to: 'CMP1.a', label: 'A into comparator sign input' },
      { from: 'INV3.out', to: 'CMP1.b', label: '-B into comparator sign input, testing A-B' },
      { from: 'INV1.out', to: 'CMP1.positive', label: 'if A>B choose A' },
      { from: 'INV2.out', to: 'CMP1.nonPositive', label: 'otherwise choose B' },
      { from: 'CMP1.out', to: 'OUT_Y.in', label: 'max(A,B) to OUT Y' },
    ],
    outputs: { y: 'OUT_Y.out', max: 'OUT_Y.out', a: 'INV1.out', b: 'INV2.out', compare: 'CMP1.out' },
    parameters: {
      firstStepsExampleId: 'first-steps-helper-max',
      page: 24,
      equation: 'out = max(A, B)',
      aCoefficient,
      bCoefficient,
      a,
      b,
      expectedValue: Math.max(a, b),
    },
  };
}

function firstStepsHelperMinSerializedPatch(options = {}) {
  const aCoefficient = helperCoefficientFromOptions(options, 'a', 0.25);
  const bCoefficient = helperCoefficientFromOptions(options, 'b', -0.4);
  const a = adjustableMachineUnitValueFromCoefficient(aCoefficient);
  const b = adjustableMachineUnitValueFromCoefficient(bCoefficient);
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps Helper: Minimum of Two Values',
    description: 'Section 10.2 helper. Two adjustable input stubs generate A and B, CMP1 tests A-B, and OUT Y receives min(A,B).',
    components: [
      { id: 'PLUS1' }, { id: 'MINUS1' },
      { id: 'P1', coefficient: aCoefficient, label: 'P1 input A knob' },
      { id: 'P2', coefficient: bCoefficient, label: 'P2 input B knob' },
      { id: 'SUM1', label: 'A source summer' }, { id: 'SUM2', label: 'B source summer' },
      { id: 'INV1', label: 'A source output' }, { id: 'INV2', label: 'B source output' }, { id: 'INV3', label: '-B for A-B comparison' },
      { id: 'CMP1', label: 'Comparator / choose smaller value' },
      { id: 'OUT_Y', label: 'Y / min(A,B)' },
    ],
    cables: [
      ...adjustableSignalCables('A', 'P1', 'SUM1', 'INV1'),
      ...adjustableSignalCables('B', 'P2', 'SUM2', 'INV2'),
      { from: 'INV2.out', to: 'INV3.in', label: 'form -B' },
      { from: 'INV1.out', to: 'CMP1.a', label: 'A into comparator sign input' },
      { from: 'INV3.out', to: 'CMP1.b', label: '-B into comparator sign input, testing A-B' },
      { from: 'INV2.out', to: 'CMP1.positive', label: 'if A>B choose B' },
      { from: 'INV1.out', to: 'CMP1.nonPositive', label: 'otherwise choose A' },
      { from: 'CMP1.out', to: 'OUT_Y.in', label: 'min(A,B) to OUT Y' },
    ],
    outputs: { y: 'OUT_Y.out', min: 'OUT_Y.out', a: 'INV1.out', b: 'INV2.out', compare: 'CMP1.out' },
    parameters: {
      firstStepsExampleId: 'first-steps-helper-min',
      page: 24,
      equation: 'out = min(A, B)',
      aCoefficient,
      bCoefficient,
      a,
      b,
      expectedValue: Math.min(a, b),
    },
  };
}

function firstStepsHelperAbsSerializedPatch(options = {}) {
  const aCoefficient = helperCoefficientFromOptions(options, 'a', -0.4);
  const a = adjustableMachineUnitValueFromCoefficient(aCoefficient);
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps Helper: Absolute Value',
    description: 'Section 10.3 helper. An adjustable input stub generates A, CMP1 tests A>0, and OUT Y receives A or -A.',
    components: [
      { id: 'PLUS1' }, { id: 'MINUS1' }, { id: 'ZERO' },
      { id: 'P1', coefficient: aCoefficient, label: 'P1 input A knob' },
      { id: 'SUM1', label: 'A source summer' },
      { id: 'INV1', label: 'A source output' },
      { id: 'INV2', label: '-A branch' },
      { id: 'CMP1', label: 'Comparator / absolute value' },
      { id: 'OUT_Y', label: 'Y / abs(A)' },
    ],
    cables: [
      ...adjustableSignalCables('A', 'P1', 'SUM1', 'INV1'),
      { from: 'INV1.out', to: 'INV2.in', label: 'form -A' },
      { from: 'INV1.out', to: 'CMP1.a', label: 'test A' },
      { from: 'ZERO.out', to: 'CMP1.b', label: 'compare against zero' },
      { from: 'INV1.out', to: 'CMP1.positive', label: 'if A>0 choose A' },
      { from: 'INV2.out', to: 'CMP1.nonPositive', label: 'otherwise choose -A' },
      { from: 'CMP1.out', to: 'OUT_Y.in', label: 'abs(A) to OUT Y' },
    ],
    outputs: { y: 'OUT_Y.out', abs: 'OUT_Y.out', a: 'INV1.out', minusA: 'INV2.out', compare: 'CMP1.out' },
    parameters: {
      firstStepsExampleId: 'first-steps-helper-abs',
      page: 24,
      equation: 'out = abs(A)',
      aCoefficient,
      a,
      expectedValue: Math.abs(a),
    },
  };
}

function firstStepsHelperNonNegativeOnlySerializedPatch(options = {}) {
  const aCoefficient = helperCoefficientFromOptions(options, 'a', -0.4);
  const a = adjustableMachineUnitValueFromCoefficient(aCoefficient);
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    inventory: DEFAULT_INVENTORY_NAME,
    name: 'First Steps Helper: Non-Negative Values Only',
    description: 'Section 10.5 helper. An adjustable input stub generates A, CMP1 tests A>0, and OUT Y receives A or zero.',
    components: [
      { id: 'PLUS1' }, { id: 'MINUS1' }, { id: 'ZERO' },
      { id: 'P1', coefficient: aCoefficient, label: 'P1 input A knob' },
      { id: 'SUM1', label: 'A source summer' },
      { id: 'INV1', label: 'A source output' },
      { id: 'CMP1', label: 'Comparator / positive clamp' },
      { id: 'OUT_Y', label: 'Y / max(A,0)' },
    ],
    cables: [
      ...adjustableSignalCables('A', 'P1', 'SUM1', 'INV1'),
      { from: 'INV1.out', to: 'CMP1.a', label: 'test A' },
      { from: 'ZERO.out', to: 'CMP1.b', label: 'compare against zero' },
      { from: 'INV1.out', to: 'CMP1.positive', label: 'if A>0 choose A' },
      { from: 'ZERO.out', to: 'CMP1.nonPositive', label: 'otherwise choose 0' },
      { from: 'CMP1.out', to: 'OUT_Y.in', label: 'non-negative value to OUT Y' },
    ],
    outputs: { y: 'OUT_Y.out', nonNegative: 'OUT_Y.out', a: 'INV1.out', compare: 'CMP1.out' },
    parameters: {
      firstStepsExampleId: 'first-steps-helper-non-negative-only',
      page: 24,
      equation: 'out = A if A > 0; otherwise 0',
      aCoefficient,
      a,
      expectedValue: Math.max(a, 0),
    },
  };
}

function firstStepsHelperReferenceValue(id, options = {}) {
  if (id === 'first-steps-helper-adjustable-minus-one-plus-one') {
    const coefficient = helperCoefficientFromOptions(options, 'value', 0);
    return adjustableMachineUnitValueFromCoefficient(coefficient);
  }
  if (id === 'first-steps-helper-max') {
    const a = adjustableMachineUnitValueFromCoefficient(helperCoefficientFromOptions(options, 'a', 0.25));
    const b = adjustableMachineUnitValueFromCoefficient(helperCoefficientFromOptions(options, 'b', -0.4));
    return Math.max(a, b);
  }
  if (id === 'first-steps-helper-min') {
    const a = adjustableMachineUnitValueFromCoefficient(helperCoefficientFromOptions(options, 'a', 0.25));
    const b = adjustableMachineUnitValueFromCoefficient(helperCoefficientFromOptions(options, 'b', -0.4));
    return Math.min(a, b);
  }
  if (id === 'first-steps-helper-abs') {
    const a = adjustableMachineUnitValueFromCoefficient(helperCoefficientFromOptions(options, 'a', -0.4));
    return Math.abs(a);
  }
  if (id === 'first-steps-helper-non-negative-only') {
    const a = adjustableMachineUnitValueFromCoefficient(helperCoefficientFromOptions(options, 'a', -0.4));
    return Math.max(a, 0);
  }
  throw new Error(`unknown helper reference id: ${id}`);
}

const FIRST_STEPS_COVERAGE = Object.freeze([
  Object.freeze({
    id: 'first-steps-radioactive-decay',
    title: 'Radioactive Decay',
    section: '9.1',
    page: 15,
    category: 'application',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v061',
    runtimeModel: 'exact block-level active-element patch',
    requiredElements: Object.freeze(['coefficient potentiometer', 'integrator', 'inverter', 'OUT X', 'REP/REPF']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 8, cycles: 3, dt: 0.01, sampleEvery: 50 }),
    patchFactoryName: 'firstStepsRadioactiveDecaySerializedPatch',
    notes: 'Uses I1.out as -N and INV1.out as the positive display value N, matching the booklet sign convention.',
  }),
  Object.freeze({
    id: 'first-steps-mass-spring-damper',
    title: 'Mass-Spring-Damper System',
    section: '9.2',
    page: 16,
    category: 'application',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v062',
    runtimeModel: 'exact block-level active-element patch with normalized 80 ms time scaling',
    requiredElements: Object.freeze(['integrators', 'inverters', 'summers', 'coefficient potentiometers', 'OUT X/Y', 'REPF']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 0.08, cycles: 3, dt: 0.0001, sampleEvery: 25 }),
    patchFactoryName: 'firstStepsMassSpringDamperSerializedPatch',
    notes: 'I1 carries -ydot, I2 carries y, P2/P3/P4 implement s, D, and 1/m, and P1 sets y0 through the inverting IC convention.',
  }),
  Object.freeze({
    id: 'first-steps-lunar-landing',
    title: 'Lunar Landing',
    section: '9.3',
    page: 17,
    category: 'application',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v071',
    runtimeModel: 'booklet-style active-block descent patch with comparator fuel and touchdown gates',
    requiredElements: Object.freeze(['integrators', 'comparators', 'summers', 'inverters', 'coefficient potentiometers', 'OUT X/Y/U', 'OP mode']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 10, dt: 0.002, sampleEvery: 25 }),
    patchFactoryName: 'firstStepsLunarLandingSerializedPatch',
    notes: 'P1 is the live throttle; OUT X/Y show altitude and velocity, and OUT U carries fuel level for the panel-meter equivalent.',
  }),
  Object.freeze({
    id: 'first-steps-neuronal-bursting',
    title: 'Neuronal Bursting',
    section: '9.4',
    page: 18,
    category: 'application',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v086',
    runtimeModel: 'booklet-scaled Hindmarsh-Rose active-block patch with x10 weighted inputs, XIR/SJ, and SLOW slow-channel state',
    requiredElements: Object.freeze(['integrators', 'multipliers', 'XIR/SJ', 'SLOW', 'coefficient potentiometers', 'OUT X/Y/Z']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 40, dt: 0.002, sampleEvery: 25 }),
    patchFactoryName: 'firstStepsNeuronalBurstingSerializedPatch',
    notes: 'Uses the scaled form xdot=-4*x^3+6*x^2+7.5*y-z+Iext and ydot=-1.33*x^2+c-y; P1/P2/P3/P8 enter x10-weighted inputs, and I3 carries -z through SLOW.',
  }),
  Object.freeze({
    id: 'first-steps-euler-spiral',
    title: 'Euler Spiral',
    section: '9.5',
    page: 19,
    category: 'application',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v063',
    runtimeModel: 'booklet-style active-block quadrature patch with X/Y scope preset',
    requiredElements: Object.freeze(['integrators', 'multipliers', 'inverters', 'coefficient potentiometers', 'OUT X/Y', 'REPF']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 120, cycles: 1, dt: 0.005, sampleEvery: 20 }),
    patchFactoryName: 'firstStepsEulerSpiralSerializedPatch',
    notes: 'I1 sweeps normalized tau from -1 to +1; I2/I3 auto-center the phase span for the selected OP-TIME; I4/I5 provide the OUT X/Y trace for x/y display.',
  }),
  Object.freeze({
    id: 'first-steps-hunter-prey',
    title: 'Hunter/Prey Population Dynamics',
    section: '9.6',
    page: 20,
    category: 'application',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v090',
    runtimeModel: 'Lotka-Volterra active block-level patch with extended default run for repeated roll-mode cycles and X/Y phase-space loop',
    requiredElements: Object.freeze(['integrators', 'multipliers', 'summers', 'inverters', 'coefficient potentiometers', 'OUT X/Y', 'OP mode']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 100, dt: 0.01, sampleEvery: 5 }),
    patchFactoryName: 'firstStepsHunterPreySerializedPatch',
    notes: 'I1 carries hare population h, I2 carries lynx population l, MUL1 computes h*l, and P3/P4/P5/P6 implement alpha, beta, gamma, and delta.',
  }),
  Object.freeze({
    id: 'first-steps-lorenz-attractor',
    title: 'Lorenz Attractor',
    section: '9.7',
    page: 21,
    category: 'application',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v090',
    runtimeModel: 'booklet-style active-block chaotic patch with extended default run for dense X/Y, Z/X, and Z/Y projection presets',
    requiredElements: Object.freeze(['integrators', 'multipliers', 'inverters', 'summers', 'coefficient potentiometers', 'OUT X/Y/Z', 'OP mode']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 300, dt: 0.01, sampleEvery: 5 }),
    patchFactoryName: 'firstStepsLorenzAttractorSerializedPatch',
    notes: 'I1/I2/I3 carry -x, -y, and -z to mirror the booklet equations; regression uses a short-run RK4 reference and bounded projection summaries rather than fragile long chaotic equality.',
  }),
  Object.freeze({
    id: 'first-steps-bouncing-ball',
    title: 'Bouncing Ball',
    section: '9.8',
    page: 22,
    category: 'application',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v090',
    runtimeModel: 'idealized passive-accessory patch: capacitors as state storage, diodes/Z-diodes as boundary overdrive detectors with tuned contact stiffness',
    requiredElements: Object.freeze(['capacitors', 'diodes', 'Z-diodes', 'summers', 'inverter', 'machine units', 'OUT X/Y/Z/U', 'REPF']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 20, cycles: 1, dt: 0.001, sampleEvery: 20 }),
    patchFactoryName: 'firstStepsBouncingBallSerializedPatch',
    notes: 'CAP1-CAP4 store vx/x/vy/y; D1/D2 detect horizontal wall overdrive; ZD1/ZD2 and D3 detect floor/ceiling contact for tuned spring-style rebound and longer default sweep that stays inside the visible machine-unit box while showing repeated floor bounces.',
  }),
  Object.freeze({
    id: 'first-steps-polynomial-generator',
    title: 'Polynomial Generator',
    section: '9.9',
    page: 23,
    category: 'application',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v069',
    runtimeModel: 'booklet-style active-block polynomial generator with XIR summing-junction helper scaling',
    requiredElements: Object.freeze(['integrators', 'XIR/SJ helpers', 'inverters', 'summers', 'coefficient potentiometers', 'machine units', 'OUT X/Y', 'REPF']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.REPF,
    runOptions: Object.freeze({ opTime: 2, cycles: 2, dt: 0.001, sampleEvery: 20 }),
    patchFactoryName: 'firstStepsPolynomialGeneratorSerializedPatch',
    notes: 'I1 ramps x from -1 to +1; XIR1/XIR2 provide the repeated summing-junction inputs needed for -x^2 and x^3; P2-P5 implement d, c, b, and the default negative a term.',
  }),
  Object.freeze({
    id: 'first-steps-helper-max',
    title: 'Maximum of Two Values',
    section: '10.1',
    page: 24,
    category: 'helper',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v072',
    runtimeModel: 'comparator helper patch with adjustable A/B source stubs',
    requiredElements: Object.freeze(['comparators', 'inverters', 'summers', 'coefficient potentiometers', 'machine units', 'OUT Y']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactoryName: 'firstStepsHelperMaxSerializedPatch',
    notes: 'P1 and P2 are mapped to full-range input stubs A and B; CMP1 tests A-B and routes the greater value to OUT Y.',
  }),
  Object.freeze({
    id: 'first-steps-helper-min',
    title: 'Minimum of Two Values',
    section: '10.2',
    page: 24,
    category: 'helper',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v072',
    runtimeModel: 'comparator helper patch with adjustable A/B source stubs',
    requiredElements: Object.freeze(['comparators', 'inverters', 'summers', 'coefficient potentiometers', 'machine units', 'OUT Y']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactoryName: 'firstStepsHelperMinSerializedPatch',
    notes: 'P1 and P2 are mapped to full-range input stubs A and B; CMP1 tests A-B and routes the smaller value to OUT Y.',
  }),
  Object.freeze({
    id: 'first-steps-helper-abs',
    title: 'Absolute Value',
    section: '10.3',
    page: 24,
    category: 'helper',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v072',
    runtimeModel: 'comparator helper patch with adjustable A source stub',
    requiredElements: Object.freeze(['comparators', 'inverters', 'summers', 'coefficient potentiometers', 'machine units', 'zero/ground', 'OUT Y']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactoryName: 'firstStepsHelperAbsSerializedPatch',
    notes: 'P1 is mapped to full-range input A; CMP1 tests A against zero and routes either A or -A to OUT Y.',
  }),
  Object.freeze({
    id: 'first-steps-helper-adjustable-minus-one-plus-one',
    title: 'Adjustable Value -1 to +1',
    section: '10.4',
    page: 24,
    category: 'helper',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v072',
    runtimeModel: 'coefficient/machine-unit helper patch using 2*k - 1 mapping',
    requiredElements: Object.freeze(['coefficient potentiometer', '+1', '-1', 'summer', 'inverter', 'OUT Y']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactoryName: 'firstStepsAdjustableMinusOnePlusOneSerializedPatch',
    notes: 'P1 is driven from +1, fanned into two summer inputs, offset by -1, and inverted to expose 2*P1-1 over the whole machine-unit range.',
  }),
  Object.freeze({
    id: 'first-steps-helper-non-negative-only',
    title: 'Non-Negative Values Only',
    section: '10.5',
    page: 24,
    category: 'helper',
    supportStatus: 'runnable',
    implementationStatus: 'implemented-v072',
    runtimeModel: 'comparator clamp helper patch with adjustable A source stub',
    requiredElements: Object.freeze(['comparators', 'summers', 'coefficient potentiometers', 'machine units', 'zero/ground', 'OUT Y']),
    missingElements: Object.freeze([]),
    defaultMode: MODES.OP,
    runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    patchFactoryName: 'firstStepsHelperNonNegativeOnlySerializedPatch',
    notes: 'P1 is mapped to full-range input A; CMP1 routes A when A>0 and ZERO otherwise, producing max(A,0).',
  }),
]);

function listFirstStepsCoverage(options = {}) {
  const entries = FIRST_STEPS_COVERAGE.map(clonePlain);
  if (!options.supportStatus) return entries;
  return entries.filter((entry) => entry.supportStatus === options.supportStatus);
}

function getFirstStepsCoverageEntry(id) {
  const entry = FIRST_STEPS_COVERAGE.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`unknown First Steps coverage id: ${id}`);
  return clonePlain(entry);
}

function getFirstStepsPatch(id, options = {}) {
  if (id === 'first-steps-radioactive-decay') return firstStepsRadioactiveDecaySerializedPatch(options);
  if (id === 'first-steps-mass-spring-damper') return firstStepsMassSpringDamperSerializedPatch(options);
  if (id === 'first-steps-lunar-landing') return firstStepsLunarLandingSerializedPatch(options);
  if (id === 'first-steps-neuronal-bursting') return firstStepsNeuronalBurstingSerializedPatch(options);
  if (id === 'first-steps-euler-spiral') return firstStepsEulerSpiralSerializedPatch(options);
  if (id === 'first-steps-hunter-prey') return firstStepsHunterPreySerializedPatch(options);
  if (id === 'first-steps-lorenz-attractor') return firstStepsLorenzAttractorSerializedPatch(options);
  if (id === 'first-steps-bouncing-ball') return firstStepsBouncingBallSerializedPatch(options);
  if (id === 'first-steps-polynomial-generator') return firstStepsPolynomialGeneratorSerializedPatch(options);
  if (id === 'first-steps-helper-adjustable-minus-one-plus-one') return firstStepsAdjustableMinusOnePlusOneSerializedPatch(options);
  if (id === 'first-steps-helper-max') return firstStepsHelperMaxSerializedPatch(options);
  if (id === 'first-steps-helper-min') return firstStepsHelperMinSerializedPatch(options);
  if (id === 'first-steps-helper-abs') return firstStepsHelperAbsSerializedPatch(options);
  if (id === 'first-steps-helper-non-negative-only') return firstStepsHelperNonNegativeOnlySerializedPatch(options);
  const entry = getFirstStepsCoverageEntry(id);
  throw new Error(`First Steps example ${entry.id} is not runnable yet: ${entry.implementationStatus}`);
}

function createFirstStepsMachine(id, options = {}) {
  const inventory = options.inventory || createThatPrototypeInventory();
  return createPatchMachineFromSerializedPatch(getFirstStepsPatch(id, options.patchOptions || {}), { inventory });
}

function runFirstStepsExample(id, options = {}) {
  const entry = getFirstStepsCoverageEntry(id);
  if (entry.supportStatus !== 'runnable') {
    throw new Error(`First Steps example ${entry.id} is not runnable yet: ${entry.implementationStatus}`);
  }
  const machine = createFirstStepsMachine(id, options);
  const runOptions = Object.assign({}, entry.runOptions, options.runOptions || {}, {
    mode: options.mode || entry.defaultMode,
  });
  return {
    coverage: entry,
    patch: getFirstStepsPatch(id, options.patchOptions || {}),
    result: runMode(machine, runOptions),
  };
}

function summarizeFirstStepsCoverage() {
  const entries = listFirstStepsCoverage();
  const byStatus = {};
  const byCategory = {};
  for (const entry of entries) {
    byStatus[entry.supportStatus] = (byStatus[entry.supportStatus] || 0) + 1;
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
  }
  return {
    schemaVersion: FIRST_STEPS_COVERAGE_SCHEMA_VERSION,
    exampleCount: entries.length,
    runnableCount: byStatus.runnable || 0,
    blockedCount: byStatus['blocked-by-accessory-runtime'] || 0,
    byStatus,
    byCategory,
    runnableIds: entries.filter((entry) => entry.supportStatus === 'runnable').map((entry) => entry.id),
    nextRecommendedIds: [],
  };
}

module.exports = {
  FIRST_STEPS_COVERAGE_SCHEMA_VERSION,
  FIRST_STEPS_COVERAGE,
  firstStepsRadioactiveDecaySerializedPatch,
  firstStepsMassSpringDamperSerializedPatch,
  firstStepsLunarLandingSerializedPatch,
  firstStepsNeuronalBurstingSerializedPatch,
  firstStepsEulerSpiralSerializedPatch,
  firstStepsHunterPreySerializedPatch,
  firstStepsLorenzAttractorSerializedPatch,
  firstStepsBouncingBallSerializedPatch,
  firstStepsPolynomialGeneratorSerializedPatch,
  firstStepsAdjustableMinusOnePlusOneSerializedPatch,
  firstStepsHelperMaxSerializedPatch,
  firstStepsHelperMinSerializedPatch,
  firstStepsHelperAbsSerializedPatch,
  firstStepsHelperNonNegativeOnlySerializedPatch,
  coefficientForMachineUnitValue,
  adjustableMachineUnitValueFromCoefficient,
  firstStepsHelperReferenceValue,
  eulerSpiralReferenceStateAt,
  eulerSpiralCenteredSweepParameters,
  eulerSpiralCenteredInitialCoordinates,
  hunterPreyReferenceStateAt,
  lorenzReferenceStateAt,
  bouncingBallReferenceStateAt,
  lunarLandingReferenceStateAt,
  neuronalBurstingReferenceStateAt,
  polynomialGeneratorReferenceStateAt,
  underdampedDisplacementAt,
  listFirstStepsCoverage,
  getFirstStepsCoverageEntry,
  getFirstStepsPatch,
  createFirstStepsMachine,
  runFirstStepsExample,
  summarizeFirstStepsCoverage,
};
