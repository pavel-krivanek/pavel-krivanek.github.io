'use strict';

const { assertFiniteNumber, clampMachineUnit } = require('./value');

function addScaledState(state, derivative, scale) {
  const next = {};
  for (const id of Object.keys(state)) {
    next[id] = state[id] + scale * derivative[id];
  }
  return next;
}

function combineRk4(state, k1, k2, k3, k4, dt) {
  const next = {};
  for (const id of Object.keys(state)) {
    next[id] = state[id] + (dt / 6) * (k1[id] + 2 * k2[id] + 2 * k3[id] + k4[id]);
  }
  return next;
}

function clipStateVector(state) {
  const clipped = {};
  for (const [id, value] of Object.entries(state)) clipped[id] = clampMachineUnit(value);
  return clipped;
}

function rk4Step(machine, state, dt, options = {}) {
  assertFiniteNumber(dt, 'dt');
  if (dt <= 0) throw new RangeError(`dt must be > 0, got ${dt}`);
  const time = options.time === undefined ? 0 : options.time;
  assertFiniteNumber(time, 'time');
  const e1 = machine.evaluate(state, { time, phase: 'k1' });
  const k1 = e1.derivatives;
  const k2 = machine.evaluate(addScaledState(state, k1, dt / 2), { time: time + dt / 2, phase: 'k2' }).derivatives;
  const k3 = machine.evaluate(addScaledState(state, k2, dt / 2), { time: time + dt / 2, phase: 'k3' }).derivatives;
  const k4 = machine.evaluate(addScaledState(state, k3, dt), { time: time + dt, phase: 'k4' }).derivatives;
  const next = combineRk4(state, k1, k2, k3, k4, dt);
  return options.clip ? clipStateVector(next) : next;
}

function makeTracePoint(machine, state, t, cycle = 0, trigger = false) {
  const evaluation = machine.evaluate(state, { time: t, phase: 'trace' });
  return {
    t,
    cycle,
    trigger,
    outputs: evaluation.outputs,
    outputDetails: evaluation.outputDetails,
    state: { ...state },
    overload: evaluation.overload,
  };
}

function runOp(machine, options = {}) {
  const dt = options.dt === undefined ? 0.01 : options.dt;
  const duration = options.duration === undefined ? 40 : options.duration;
  const sampleEvery = options.sampleEvery === undefined ? 10 : options.sampleEvery;
  const clip = Boolean(options.clip);
  if (duration < 0) throw new RangeError(`duration must be >= 0, got ${duration}`);
  let state = options.initialState ? { ...options.initialState } : machine.applyInitialConditions();
  if (clip) state = clipStateVector(state);
  let t = 0;
  const trace = [makeTracePoint(machine, state, t, 0, true)];
  const steps = Math.round(duration / dt);
  for (let step = 1; step <= steps; step += 1) {
    state = rk4Step(machine, state, dt, { clip, time: t });
    t = step * dt;
    if (step % sampleEvery === 0 || step === steps) {
      trace.push(makeTracePoint(machine, state, t, 0, false));
    }
  }
  return { mode: 'OP', dt, duration, sampleEvery, clip, finalState: state, trace };
}

function runRepf(machine, options = {}) {
  const dt = options.dt === undefined ? 0.01 : options.dt;
  const opTime = options.opTime === undefined ? 12 : options.opTime;
  const cycles = options.cycles === undefined ? 3 : options.cycles;
  const sampleEvery = options.sampleEvery === undefined ? 10 : options.sampleEvery;
  const clip = Boolean(options.clip);
  const trace = [];
  let finalState = null;
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    let state = machine.applyInitialConditions();
    if (clip) state = clipStateVector(state);
    const steps = Math.round(opTime / dt);
    for (let step = 0; step <= steps; step += 1) {
      const t = cycle * opTime + step * dt;
      if (step === 0 || step % sampleEvery === 0 || step === steps) {
        trace.push(makeTracePoint(machine, state, t, cycle, step === 0));
      }
      if (step < steps) state = rk4Step(machine, state, dt, { clip, time: t });
    }
    finalState = state;
  }
  return { mode: 'REPF', dt, opTime, cycles, sampleEvery, clip, finalState, trace };
}

module.exports = {
  addScaledState,
  clipStateVector,
  rk4Step,
  runOp,
  runRepf,
  makeTracePoint,
};
