'use strict';

const { assertFiniteNumber } = require('./value');
const { rk4Step, makeTracePoint, clipStateVector } = require('./solver');

const MODES = Object.freeze({
  OFF: 'OFF',
  COEFF: 'COEFF',
  IC: 'IC',
  OP: 'OP',
  HALT: 'HALT',
  REP: 'REP',
  REPF: 'REPF',
  MINION: 'MINION',
});

const EXECUTABLE_MODES = new Set([MODES.IC, MODES.OP, MODES.HALT, MODES.REP, MODES.REPF]);

function assertPositive(value, name) {
  assertFiniteNumber(value, name);
  if (value <= 0) throw new RangeError(`${name} must be > 0, got ${value}`);
}

function assertNonNegative(value, name) {
  assertFiniteNumber(value, name);
  if (value < 0) throw new RangeError(`${name} must be >= 0, got ${value}`);
}

function normalizeSampleEvery(sampleEvery) {
  const normalized = sampleEvery === undefined ? 10 : sampleEvery;
  assertFiniteNumber(normalized, 'sampleEvery');
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new RangeError(`sampleEvery must be a positive integer, got ${normalized}`);
  }
  return normalized;
}

function tracePointForController(controller, trigger = false) {
  return {
    ...makeTracePoint(controller.machine, controller.state, controller.time, controller.cycle, trigger),
    mode: controller.mode,
  };
}

class OperationController {
  constructor(machine, options = {}) {
    if (!machine || typeof machine.evaluate !== 'function') {
      throw new Error('OperationController requires a PatchMachine-like object');
    }
    this.machine = machine;
    this.state = options.initialState ? { ...options.initialState } : machine.defaultStateVector();
    this.mode = options.mode || MODES.HALT;
    this.time = options.time === undefined ? 0 : options.time;
    this.cycle = options.cycle === undefined ? 0 : options.cycle;
    this.clip = Boolean(options.clip);
    if (this.clip) this.state = clipStateVector(this.state);
    assertFiniteNumber(this.time, 'time');
    assertFiniteNumber(this.cycle, 'cycle');
  }

  cloneState() {
    return { ...this.state };
  }

  sample(options = {}) {
    return tracePointForController(this, Boolean(options.trigger));
  }

  enter(mode) {
    if (!Object.values(MODES).includes(mode)) {
      throw new Error(`unsupported operation mode: ${mode}`);
    }
    if (mode === MODES.IC) {
      this.state = this.machine.applyInitialConditions(this.state, { time: this.time, phase: 'ic' });
      if (this.clip) this.state = clipStateVector(this.state);
      this.mode = MODES.IC;
      return this.sample({ trigger: true });
    }
    this.mode = mode;
    return this.sample({ trigger: false });
  }

  enterIc() {
    return this.enter(MODES.IC);
  }

  enterOp() {
    return this.enter(MODES.OP);
  }

  enterHalt() {
    return this.enter(MODES.HALT);
  }

  advance(dt) {
    assertPositive(dt, 'dt');
    if (this.mode === MODES.OP) {
      this.state = rk4Step(this.machine, this.state, dt, { clip: this.clip, time: this.time });
    }
    this.time += dt;
    return this.sample({ trigger: false });
  }

  runFor(options = {}) {
    const dt = options.dt === undefined ? 0.01 : options.dt;
    const duration = options.duration === undefined ? 40 : options.duration;
    const sampleEvery = normalizeSampleEvery(options.sampleEvery);
    assertPositive(dt, 'dt');
    assertNonNegative(duration, 'duration');

    const steps = Math.round(duration / dt);
    const trace = [];
    if (options.includeInitial !== false) trace.push(this.sample({ trigger: Boolean(options.triggerInitial) }));
    for (let step = 1; step <= steps; step += 1) {
      this.advance(dt);
      if (step % sampleEvery === 0 || step === steps) {
        trace.push(this.sample({ trigger: false }));
      }
    }
    return trace;
  }

  runIc() {
    const point = this.enterIc();
    return {
      mode: MODES.IC,
      finalState: this.cloneState(),
      trace: [point],
    };
  }

  runOp(options = {}) {
    const reset = options.reset === undefined ? true : Boolean(options.reset);
    if (reset) this.enterIc();
    this.enterOp();
    const trace = this.runFor({
      duration: options.duration === undefined ? 40 : options.duration,
      dt: options.dt === undefined ? 0.01 : options.dt,
      sampleEvery: options.sampleEvery === undefined ? 10 : options.sampleEvery,
      triggerInitial: reset,
    });
    return {
      mode: MODES.OP,
      dt: options.dt === undefined ? 0.01 : options.dt,
      duration: options.duration === undefined ? 40 : options.duration,
      sampleEvery: options.sampleEvery === undefined ? 10 : options.sampleEvery,
      clip: this.clip,
      finalState: this.cloneState(),
      trace,
    };
  }

  runHalt(options = {}) {
    const reset = options.reset === undefined ? true : Boolean(options.reset);
    if (reset) this.enterIc();
    this.enterHalt();
    const trace = this.runFor({
      duration: options.duration === undefined ? 1 : options.duration,
      dt: options.dt === undefined ? 0.01 : options.dt,
      sampleEvery: options.sampleEvery === undefined ? 10 : options.sampleEvery,
      triggerInitial: reset,
    });
    return {
      mode: MODES.HALT,
      dt: options.dt === undefined ? 0.01 : options.dt,
      duration: options.duration === undefined ? 1 : options.duration,
      sampleEvery: options.sampleEvery === undefined ? 10 : options.sampleEvery,
      clip: this.clip,
      finalState: this.cloneState(),
      trace,
    };
  }

  runRepeated(mode, options = {}) {
    if (mode !== MODES.REP && mode !== MODES.REPF) throw new Error(`runRepeated requires REP or REPF, got ${mode}`);
    const dt = options.dt === undefined ? 0.01 : options.dt;
    const opTime = options.opTime === undefined ? 12 : options.opTime;
    const cycles = options.cycles === undefined ? 3 : options.cycles;
    const sampleEvery = normalizeSampleEvery(options.sampleEvery);
    assertPositive(dt, 'dt');
    assertPositive(opTime, 'opTime');
    assertFiniteNumber(cycles, 'cycles');
    if (!Number.isInteger(cycles) || cycles <= 0) {
      throw new RangeError(`cycles must be a positive integer, got ${cycles}`);
    }

    const trace = [];
    const steps = Math.round(opTime / dt);
    this.mode = mode;
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      this.cycle = cycle;
      this.time = cycle * opTime;
      this.enterIc();
      this.mode = mode;
      trace.push(this.sample({ trigger: true }));
      this.enterOp();
      for (let step = 1; step <= steps; step += 1) {
        this.advance(dt);
        if (step % sampleEvery === 0 || step === steps) {
          this.mode = mode;
          trace.push(this.sample({ trigger: false }));
          this.mode = MODES.OP;
        }
      }
      this.mode = mode;
    }
    return {
      mode,
      dt,
      opTime,
      cycles,
      sampleEvery,
      clip: this.clip,
      finalState: this.cloneState(),
      trace,
    };
  }

  runRep(options = {}) {
    return this.runRepeated(MODES.REP, options);
  }

  runRepf(options = {}) {
    return this.runRepeated(MODES.REPF, options);
  }
}

function runMode(machine, options = {}) {
  const mode = options.mode || MODES.OP;
  if (!EXECUTABLE_MODES.has(mode)) {
    throw new Error(`runMode supports ${Array.from(EXECUTABLE_MODES).join(', ')}, got ${mode}`);
  }
  const controller = new OperationController(machine, options);
  if (mode === MODES.IC) return controller.runIc(options);
  if (mode === MODES.HALT) return controller.runHalt(options);
  if (mode === MODES.REP) return controller.runRep(options);
  if (mode === MODES.REPF) return controller.runRepf(options);
  return controller.runOp(options);
}

module.exports = {
  MODES,
  EXECUTABLE_MODES,
  OperationController,
  runMode,
};
