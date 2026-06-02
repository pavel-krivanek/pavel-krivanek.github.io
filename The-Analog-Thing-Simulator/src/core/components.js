'use strict';

const { assertFiniteNumber, clampMachineUnit } = require('./value');

const SOCKET_DIRECTIONS = Object.freeze({
  INPUT: 'input',
  OUTPUT: 'output',
});

function requireId(def) {
  if (!def || typeof def.id !== 'string' || def.id.length === 0) {
    throw new Error('component definition requires a non-empty string id');
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function socketDef(name, direction, options = {}) {
  if (typeof name !== 'string' || name.length === 0) throw new Error('socket name must be a non-empty string');
  if (!Object.values(SOCKET_DIRECTIONS).includes(direction)) throw new Error(`invalid socket direction: ${direction}`);
  return {
    name,
    direction,
    required: Boolean(options.required),
    weight: options.weight,
    ordinary: options.ordinary !== false,
    description: options.description || '',
  };
}

function normalizeWeightedInputs(def, defaultInputs) {
  return (def.inputs || defaultInputs).map((inputDef) => {
    if (typeof inputDef === 'string') return { name: inputDef, weight: 1, required: true };
    if (!inputDef || typeof inputDef.name !== 'string') {
      throw new Error(`${def.id}.inputs entries must be socket names or { name, weight }`);
    }
    const weight = inputDef.weight === undefined ? 1 : inputDef.weight;
    assertFiniteNumber(weight, `${def.id}.${inputDef.name}.weight`);
    return {
      name: inputDef.name,
      weight,
      required: inputDef.required === undefined ? true : Boolean(inputDef.required),
      description: inputDef.description || '',
    };
  });
}

function getInputValue(inputValues, socketName) {
  const value = inputValues.get(socketName);
  if (value === undefined) return 0;
  assertFiniteNumber(value, `input ${socketName}`);
  return value;
}

function weightedTotal(inputDefs, inputValues, component) {
  let total = 0;
  for (const inputDef of inputDefs) {
    total += inputDef.weight * getInputValue(inputValues, component.inputSocket(inputDef.name));
  }
  return total;
}

function finiteTime(context = {}) {
  const time = context.time === undefined ? 0 : Number(context.time);
  return Number.isFinite(time) ? time : 0;
}

function normalizeTimeProfile(profile) {
  if (!profile || !Array.isArray(profile.points) || profile.points.length === 0) return null;
  const points = profile.points
    .map((point) => ({
      t: Number(point.t),
      value: Number(point.value),
    }))
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.value))
    .sort((a, b) => a.t - b.t);
  if (points.length === 0) return null;
  return {
    kind: profile.kind || 'linear-points',
    scale: profile.scale === undefined ? 'absolute' : profile.scale,
    repeat: Boolean(profile.repeat),
    points,
  };
}

function evaluateTimeProfile(profile, context = {}, fallback = 0) {
  const normalized = normalizeTimeProfile(profile);
  if (!normalized) return fallback;
  const points = normalized.points;
  let t = finiteTime(context);
  if (normalized.repeat && points.length > 1) {
    const start = points[0].t;
    const end = points[points.length - 1].t;
    const period = end - start;
    if (period > 0) t = start + ((((t - start) % period) + period) % period);
  }
  if (t <= points[0].t) return points[0].value;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    if (t <= next.t) {
      const span = next.t - previous.t;
      if (span <= 0) return next.value;
      const alpha = (t - previous.t) / span;
      return previous.value + alpha * (next.value - previous.value);
    }
  }
  return points[points.length - 1].value;
}

class Component {
  constructor(def) {
    requireId(def);
    this.id = def.id;
    this.type = def.type;
    this.label = def.label || def.id;
  }

  outputSocket(name = 'out') {
    return `${this.id}.${name}`;
  }

  inputSocket(name) {
    return `${this.id}.${name}`;
  }

  socketDefinitions() {
    return [];
  }

  socketMetadata() {
    return this.socketDefinitions().map((socket) => ({
      ...socket,
      id: `${this.id}.${socket.name}`,
      componentId: this.id,
      componentType: this.type,
    }));
  }

  toDefinition() {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
    };
  }

  evaluateStateless() {
    return new Map();
  }
}

class Constant extends Component {
  constructor(def) {
    super({ ...def, type: 'constant' });
    assertFiniteNumber(def.value, `${def.id}.value`);
    this.value = def.value;
  }

  socketDefinitions() {
    return [socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'constant machine-unit output' })];
  }

  toDefinition() {
    return { ...super.toDefinition(), value: this.value };
  }

  evaluateStateless() {
    return new Map([[this.outputSocket('out'), this.value]]);
  }
}

class CoefficientPotentiometer extends Component {
  constructor(def) {
    super({ ...def, type: 'potentiometer' });
    assertFiniteNumber(def.coefficient, `${def.id}.coefficient`);
    if (def.coefficient < 0 || def.coefficient > 1) {
      throw new RangeError(`${def.id}.coefficient must be in [0, 1], got ${def.coefficient}`);
    }
    this.coefficient = def.coefficient;
    this.timeProfile = normalizeTimeProfile(def.timeProfile);
  }

  socketDefinitions() {
    return [
      socketDef('in', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'coefficient input' }),
      socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'scaled output' }),
    ];
  }

  toDefinition() {
    const definition = { ...super.toDefinition(), coefficient: this.coefficient };
    if (this.timeProfile) definition.timeProfile = cloneJson(this.timeProfile);
    return definition;
  }

  effectiveCoefficient(context = {}) {
    if (!this.timeProfile) return this.coefficient;
    const profiled = evaluateTimeProfile(this.timeProfile, context, this.coefficient);
    const scaled = this.timeProfile.scale === 'multiplier' ? this.coefficient * profiled : profiled;
    return Math.max(0, Math.min(1, scaled));
  }

  evaluateStateless(inputValues, context = {}) {
    const input = getInputValue(inputValues, this.inputSocket('in'));
    return new Map([[this.outputSocket('out'), this.effectiveCoefficient(context) * input]]);
  }
}

class Inverter extends Component {
  constructor(def) {
    super({ ...def, type: 'inverter' });
    this.hasSummingJunction = def.hasSummingJunction !== false;
  }

  socketDefinitions() {
    const sockets = [
      socketDef('in', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'inverter input' }),
    ];
    if (this.hasSummingJunction) {
      sockets.push(socketDef('sj', SOCKET_DIRECTIONS.INPUT, { required: false, description: 'optional summing-junction extension input' }));
    }
    sockets.push(socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'negated output' }));
    return sockets;
  }

  toDefinition() {
    return { ...super.toDefinition(), hasSummingJunction: this.hasSummingJunction };
  }

  evaluateStateless(inputValues) {
    const input = getInputValue(inputValues, this.inputSocket('in'));
    const sj = this.hasSummingJunction ? getInputValue(inputValues, this.inputSocket('sj')) : 0;
    return new Map([[this.outputSocket('out'), -(input + sj)]]);
  }
}

class Summer extends Component {
  constructor(def) {
    super({ ...def, type: 'summer' });
    this.inputs = normalizeWeightedInputs(def, [{ name: 'in1', weight: 1, required: true }]);
    this.hasSummingJunction = def.hasSummingJunction !== false;
    this.hasFeedbackJack = def.hasFeedbackJack !== false;
    this.feedbackGrounded = Boolean(def.feedbackGrounded);
    this.openAmplifierGain = def.openAmplifierGain === undefined ? 1000 : def.openAmplifierGain;
    assertFiniteNumber(this.openAmplifierGain, `${def.id}.openAmplifierGain`);
  }

  setFeedbackJackConnection(connected, grounded = false) {
    this.feedbackJackConnected = Boolean(connected);
    this.feedbackGrounded = Boolean(grounded);
  }

  socketDefinitions() {
    const sockets = [
      ...this.inputs.map((inputDef) => socketDef(inputDef.name, SOCKET_DIRECTIONS.INPUT, {
        required: inputDef.required,
        weight: inputDef.weight,
        description: inputDef.description || `weighted summer input x${inputDef.weight}`,
      })),
    ];
    if (this.hasSummingJunction) {
      sockets.push(socketDef('sj', SOCKET_DIRECTIONS.INPUT, { required: false, description: 'optional summing-junction extension input' }));
    }
    if (this.hasFeedbackJack) {
      sockets.push(socketDef('fb', SOCKET_DIRECTIONS.INPUT, { required: false, description: 'panel FB jack; grounding it approximates open-amplifier operation' }));
    }
    sockets.push(socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'negative weighted sum output' }));
    return sockets;
  }

  toDefinition() {
    return { ...super.toDefinition(), inputs: cloneJson(this.inputs), hasSummingJunction: this.hasSummingJunction, hasFeedbackJack: this.hasFeedbackJack, openAmplifierGain: this.openAmplifierGain };
  }

  evaluateStateless(inputValues) {
    const sj = this.hasSummingJunction ? getInputValue(inputValues, this.inputSocket('sj')) : 0;
    const total = weightedTotal(this.inputs, inputValues, this) + sj;
    const output = this.feedbackGrounded ? clampMachineUnit(-this.openAmplifierGain * total) : -total;
    return new Map([[this.outputSocket('out'), output]]);
  }
}

class Integrator extends Component {
  constructor(def) {
    super({ ...def, type: 'integrator' });
    this.initialState = def.initialState === undefined ? 0 : def.initialState;
    assertFiniteNumber(this.initialState, `${def.id}.initialState`);
    this.inputs = normalizeWeightedInputs(def, [{ name: 'in1', weight: 1, required: true }]);
    const rate = def.rate === undefined ? 1 : def.rate;
    assertFiniteNumber(rate, `${def.id}.rate`);
    this.rate = rate;
    this.hasSummingJunction = def.hasSummingJunction !== false;
    this.slowMode = Boolean(def.slowMode);
    this.slowFactor = def.slowFactor === undefined ? 100 : def.slowFactor;
    assertFiniteNumber(this.slowFactor, `${def.id}.slowFactor`);
    if (this.slowFactor <= 0) throw new RangeError(`${def.id}.slowFactor must be > 0, got ${this.slowFactor}`);
  }

  socketDefinitions() {
    const sockets = [
      ...this.inputs.map((inputDef) => socketDef(inputDef.name, SOCKET_DIRECTIONS.INPUT, {
        required: inputDef.required,
        weight: inputDef.weight,
        description: inputDef.description || `integrator derivative input x${inputDef.weight}`,
      })),
      socketDef('ic', SOCKET_DIRECTIONS.INPUT, { required: false, description: 'initial-condition input, applied with opposite sign' }),
      socketDef('slow', SOCKET_DIRECTIONS.INPUT, { required: false, description: 'optional slow-mode control; any connected value activates slow approximation' }),
    ];
    if (this.hasSummingJunction) {
      sockets.push(socketDef('sj', SOCKET_DIRECTIONS.INPUT, { required: false, description: 'optional summing-junction extension input' }));
    }
    sockets.push(socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'integrator state output' }));
    return sockets;
  }

  toDefinition() {
    return {
      ...super.toDefinition(),
      initialState: this.initialState,
      rate: this.rate,
      inputs: cloneJson(this.inputs),
      hasSummingJunction: this.hasSummingJunction,
      slowMode: this.slowMode,
      slowFactor: this.slowFactor,
    };
  }

  derivative(inputValues) {
    const sj = this.hasSummingJunction ? getInputValue(inputValues, this.inputSocket('sj')) : 0;
    const slowActive = this.slowMode || inputValues.has(this.inputSocket('slow'));
    const effectiveRate = slowActive ? this.rate / this.slowFactor : this.rate;
    return -effectiveRate * (weightedTotal(this.inputs, inputValues, this) + sj);
  }

  stateFromIc(inputValues) {
    if (!inputValues.has(this.inputSocket('ic'))) return this.initialState;
    const ic = getInputValue(inputValues, this.inputSocket('ic'));
    return -ic;
  }
}

class Multiplier extends Component {
  constructor(def) {
    super({ ...def, type: 'multiplier' });
  }

  socketDefinitions() {
    return [
      socketDef('x', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'first multiplier input' }),
      socketDef('y', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'second multiplier input' }),
      socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'four-quadrant product output' }),
    ];
  }

  evaluateStateless(inputValues) {
    return new Map([[this.outputSocket('out'), getInputValue(inputValues, this.inputSocket('x')) * getInputValue(inputValues, this.inputSocket('y'))]]);
  }
}

class Comparator extends Component {
  constructor(def) {
    super({ ...def, type: 'comparator' });
  }

  socketDefinitions() {
    return [
      socketDef('a', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'first sign-test input' }),
      socketDef('b', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'second sign-test input; comparator tests a + b' }),
      socketDef('positive', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'selected when a + b > 0' }),
      socketDef('nonPositive', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'selected when a + b <= 0' }),
      socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'conditional analog output' }),
    ];
  }

  evaluateStateless(inputValues) {
    const sign = getInputValue(inputValues, this.inputSocket('a')) + getInputValue(inputValues, this.inputSocket('b'));
    const selected = sign > 0 ? this.inputSocket('positive') : this.inputSocket('nonPositive');
    return new Map([[this.outputSocket('out'), getInputValue(inputValues, selected)]]);
  }
}


class Diode extends Component {
  constructor(def) {
    super({ ...def, type: 'diode' });
    this.forwardDrop = def.forwardDrop === undefined ? 0 : def.forwardDrop;
    assertFiniteNumber(this.forwardDrop, `${def.id}.forwardDrop`);
  }

  socketDefinitions() {
    return [
      socketDef('in', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'ideal diode anode/input signal' }),
      socketDef('reference', SOCKET_DIRECTIONS.INPUT, { required: false, description: 'optional cathode/reference signal; default is zero' }),
      socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'positive overdrive when in exceeds reference plus forwardDrop' }),
    ];
  }

  toDefinition() {
    return { ...super.toDefinition(), forwardDrop: this.forwardDrop };
  }

  evaluateStateless(inputValues) {
    const input = getInputValue(inputValues, this.inputSocket('in'));
    const reference = getInputValue(inputValues, this.inputSocket('reference'));
    const overdrive = input - reference - this.forwardDrop;
    return new Map([[this.outputSocket('out'), overdrive > 0 ? overdrive : 0]]);
  }
}

class ZDiode extends Component {
  constructor(def) {
    super({ ...def, type: 'z-diode' });
    this.zenerVoltage = def.zenerVoltage === undefined ? 0.68 : def.zenerVoltage;
    this.forwardDrop = def.forwardDrop === undefined ? 0 : def.forwardDrop;
    this.mode = def.mode || 'positive-overdrive';
    assertFiniteNumber(this.zenerVoltage, `${def.id}.zenerVoltage`);
    assertFiniteNumber(this.forwardDrop, `${def.id}.forwardDrop`);
    if (!['positive-overdrive', 'negative-overdrive', 'window-clamp'].includes(this.mode)) {
      throw new Error(`${def.id}.mode must be positive-overdrive, negative-overdrive, or window-clamp`);
    }
  }

  socketDefinitions() {
    return [
      socketDef('in', SOCKET_DIRECTIONS.INPUT, { required: true, description: 'Z-diode input signal' }),
      socketDef('reference', SOCKET_DIRECTIONS.INPUT, { required: false, description: 'optional reference signal; default is zero' }),
      socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'idealized Z-diode clamp/overdrive output' }),
    ];
  }

  toDefinition() {
    return { ...super.toDefinition(), zenerVoltage: this.zenerVoltage, forwardDrop: this.forwardDrop, mode: this.mode };
  }

  evaluateStateless(inputValues) {
    const input = getInputValue(inputValues, this.inputSocket('in'));
    const reference = getInputValue(inputValues, this.inputSocket('reference'));
    const relative = input - reference;
    const z = Math.abs(this.zenerVoltage);
    let output = 0;
    if (this.mode === 'positive-overdrive') output = Math.max(0, relative - z);
    else if (this.mode === 'negative-overdrive') output = Math.max(0, -relative - z);
    else output = Math.max(-z, Math.min(z, relative));
    return new Map([[this.outputSocket('out'), output]]);
  }
}

class Capacitor extends Component {
  constructor(def) {
    super({ ...def, type: 'capacitor' });
    this.initialState = def.initialState === undefined ? 0 : def.initialState;
    this.rate = def.rate === undefined ? 1 : def.rate;
    this.inputs = normalizeWeightedInputs(def, [{ name: 'in', weight: 1, required: false, description: 'capacitor current/derivative input' }]);
    this.value = def.value || null;
    this.valueFarads = def.valueFarads === undefined || def.valueFarads === null ? null : def.valueFarads;
    assertFiniteNumber(this.initialState, `${def.id}.initialState`);
    assertFiniteNumber(this.rate, `${def.id}.rate`);
    if (this.valueFarads !== null) assertFiniteNumber(this.valueFarads, `${def.id}.valueFarads`);
  }

  socketDefinitions() {
    return [
      ...this.inputs.map((inputDef) => socketDef(inputDef.name, SOCKET_DIRECTIONS.INPUT, {
        required: inputDef.required,
        weight: inputDef.weight,
        description: inputDef.description || `capacitor derivative input x${inputDef.weight}`,
      })),
      socketDef('ic', SOCKET_DIRECTIONS.INPUT, { required: false, description: 'optional capacitor initial voltage input' }),
      socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'capacitor stored voltage/state output' }),
    ];
  }

  toDefinition() {
    return {
      ...super.toDefinition(),
      initialState: this.initialState,
      rate: this.rate,
      value: this.value,
      valueFarads: this.valueFarads,
      inputs: cloneJson(this.inputs),
    };
  }

  derivative(inputValues) {
    return this.rate * weightedTotal(this.inputs, inputValues, this);
  }

  stateFromIc(inputValues) {
    return inputValues.has(this.inputSocket('ic')) ? getInputValue(inputValues, this.inputSocket('ic')) : this.initialState;
  }
}

class XirNetwork extends Component {
  constructor(def) {
    super({ ...def, type: 'xir' });
    this.inputs = normalizeWeightedInputs(def, [
      { name: 'in1', weight: 1, required: false },
      { name: 'in10', weight: 10, required: false },
    ]);
  }

  socketDefinitions() {
    return [
      ...this.inputs.map((inputDef) => socketDef(inputDef.name, SOCKET_DIRECTIONS.INPUT, {
        required: inputDef.required,
        weight: inputDef.weight,
        description: inputDef.description || `XIR resistor-network input x${inputDef.weight}`,
      })),
      socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: 'weighted XIR contribution for a summing junction' }),
    ];
  }

  toDefinition() {
    return { ...super.toDefinition(), inputs: cloneJson(this.inputs) };
  }

  evaluateStateless(inputValues) {
    return new Map([[this.outputSocket('out'), weightedTotal(this.inputs, inputValues, this)]]);
  }
}

class OutputJack extends Component {
  constructor(def) {
    super({ ...def, type: 'output' });
    this.label = def.label || this.id;
  }

  socketDefinitions() {
    return [
      socketDef('in', SOCKET_DIRECTIONS.INPUT, { required: true, description: `panel output ${this.label} input` }),
      socketDef('out', SOCKET_DIRECTIONS.OUTPUT, { description: `panel output ${this.label}` }),
    ];
  }

  toDefinition() {
    return { ...super.toDefinition(), label: this.label };
  }

  evaluateStateless(inputValues) {
    const input = getInputValue(inputValues, this.inputSocket('in'));
    return new Map([[this.outputSocket('out'), input]]);
  }
}

function createComponent(def) {
  if (!def || typeof def.type !== 'string') {
    throw new Error('component definition requires a type');
  }
  switch (def.type) {
    case 'constant':
      return new Constant(def);
    case 'potentiometer':
      return new CoefficientPotentiometer(def);
    case 'inverter':
      return new Inverter(def);
    case 'summer':
      return new Summer(def);
    case 'integrator':
      return new Integrator(def);
    case 'multiplier':
      return new Multiplier(def);
    case 'comparator':
      return new Comparator(def);
    case 'diode':
      return new Diode(def);
    case 'z-diode':
      return new ZDiode(def);
    case 'capacitor':
      return new Capacitor(def);
    case 'xir':
      return new XirNetwork(def);
    case 'output':
      return new OutputJack(def);
    default:
      throw new Error(`unsupported component type: ${def.type}`);
  }
}

module.exports = {
  SOCKET_DIRECTIONS,
  Component,
  Constant,
  CoefficientPotentiometer,
  Inverter,
  Summer,
  Integrator,
  Multiplier,
  Comparator,
  Diode,
  ZDiode,
  Capacitor,
  XirNetwork,
  OutputJack,
  createComponent,
  getInputValue,
  normalizeWeightedInputs,
  normalizeTimeProfile,
  evaluateTimeProfile,
};
