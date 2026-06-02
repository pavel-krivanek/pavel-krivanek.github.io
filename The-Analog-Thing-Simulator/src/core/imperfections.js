'use strict';

const { assertFiniteNumber, clampMachineUnit } = require('./value');

const DEFAULT_IMPERFECTION_SPEC = Object.freeze({
  enabled: false,
  seed: 1,
  toleranceStdDev: 0,
  outputGainStdDev: 0,
  noiseStdDev: 0,
  outputOffset: 0,
  driftPerSecond: 0,
  socketOffsets: {},
  socketNoiseStdDev: {},
  socketDriftPerSecond: {},
  componentTolerances: {},
});

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashString(input) {
  let h = 2166136261;
  const str = String(input);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function uniform01(key) {
  let x = hashString(key) || 1;
  x += 0x6D2B79F5;
  let t = x;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function normal01(key) {
  const u1 = Math.max(uniform01(`${key}:u1`), 1e-12);
  const u2 = uniform01(`${key}:u2`);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function finiteOrDefault(value, fallback, label) {
  if (value === undefined) return fallback;
  assertFiniteNumber(value, label);
  return value;
}

function normalizeMap(value, label) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object mapping ids to finite numbers`);
  }
  const normalized = {};
  for (const [key, entry] of Object.entries(value)) {
    assertFiniteNumber(entry, `${label}.${key}`);
    normalized[key] = entry;
  }
  return normalized;
}

function normalizeImperfectionSpec(spec) {
  if (!spec || spec === false) return { ...DEFAULT_IMPERFECTION_SPEC };
  if (spec === true) return { ...DEFAULT_IMPERFECTION_SPEC, enabled: true };
  if (typeof spec !== 'object' || Array.isArray(spec)) {
    throw new TypeError('imperfection spec must be an object, true, false, or undefined');
  }
  const normalized = {
    enabled: spec.enabled === undefined ? true : Boolean(spec.enabled),
    seed: spec.seed === undefined ? DEFAULT_IMPERFECTION_SPEC.seed : spec.seed,
    toleranceStdDev: finiteOrDefault(spec.toleranceStdDev, 0, 'imperfections.toleranceStdDev'),
    outputGainStdDev: finiteOrDefault(spec.outputGainStdDev, 0, 'imperfections.outputGainStdDev'),
    noiseStdDev: finiteOrDefault(spec.noiseStdDev, 0, 'imperfections.noiseStdDev'),
    outputOffset: finiteOrDefault(spec.outputOffset, 0, 'imperfections.outputOffset'),
    driftPerSecond: finiteOrDefault(spec.driftPerSecond, 0, 'imperfections.driftPerSecond'),
    socketOffsets: normalizeMap(spec.socketOffsets, 'imperfections.socketOffsets'),
    socketNoiseStdDev: normalizeMap(spec.socketNoiseStdDev, 'imperfections.socketNoiseStdDev'),
    socketDriftPerSecond: normalizeMap(spec.socketDriftPerSecond, 'imperfections.socketDriftPerSecond'),
    componentTolerances: normalizeMap(spec.componentTolerances, 'imperfections.componentTolerances'),
  };
  for (const name of ['toleranceStdDev', 'outputGainStdDev', 'noiseStdDev']) {
    if (normalized[name] < 0) throw new RangeError(`imperfections.${name} must be >= 0, got ${normalized[name]}`);
  }
  return normalized;
}

function shouldApplyFactor(parameterName) {
  return ['coefficient', 'rate', 'slowFactor', 'value', 'weight'].includes(parameterName) || parameterName.startsWith('weight:');
}

class ImperfectionModel {
  constructor(spec) {
    this.spec = normalizeImperfectionSpec(spec);
    this.enabled = this.spec.enabled;
  }

  toJSON() {
    return clonePlain(this.spec);
  }

  key(prefix, id) {
    return `${this.spec.seed}:${prefix}:${id}`;
  }

  directComponentTolerance(componentId, parameterName) {
    const keys = [
      `${componentId}.${parameterName}`,
      componentId,
      parameterName,
    ];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(this.spec.componentTolerances, key)) {
        return this.spec.componentTolerances[key];
      }
    }
    return undefined;
  }

  parameterFactor(componentId, parameterName) {
    if (!this.enabled || !shouldApplyFactor(parameterName)) return 1;
    const direct = this.directComponentTolerance(componentId, parameterName);
    if (direct !== undefined) return Math.max(0, 1 + direct);
    if (this.spec.toleranceStdDev === 0) return 1;
    return Math.max(0, 1 + this.spec.toleranceStdDev * normal01(this.key('component', `${componentId}.${parameterName}`)));
  }

  outputGainFactor(socketId) {
    if (!this.enabled || this.spec.outputGainStdDev === 0) return 1;
    return Math.max(0, 1 + this.spec.outputGainStdDev * normal01(this.key('outputGain', socketId)));
  }

  transformWeightedInputs(componentId, inputs) {
    if (!Array.isArray(inputs)) return inputs;
    return inputs.map((input) => {
      if (typeof input === 'string') return input;
      if (!input || input.weight === undefined) return input;
      return {
        ...input,
        weight: input.weight * this.parameterFactor(componentId, `weight:${input.name}`),
      };
    });
  }

  transformComponentDefinition(definition) {
    const next = clonePlain(definition);
    if (!this.enabled) return next;

    if (next.coefficient !== undefined) {
      next.coefficient = clampMachineUnit(next.coefficient * this.parameterFactor(next.id, 'coefficient'));
      if (next.coefficient < 0) next.coefficient = 0;
    }
    if (next.rate !== undefined) {
      next.rate *= this.parameterFactor(next.id, 'rate');
    }
    if (next.slowFactor !== undefined) {
      next.slowFactor *= this.parameterFactor(next.id, 'slowFactor');
      if (next.slowFactor <= 0) next.slowFactor = 1;
    }
    if (next.value !== undefined && next.type === 'constant') {
      next.value *= this.parameterFactor(next.id, 'value');
    }
    if (next.inputs !== undefined) {
      next.inputs = this.transformWeightedInputs(next.id, next.inputs);
    }
    return next;
  }

  socketOffset(socketId) {
    return this.spec.socketOffsets[socketId] === undefined ? this.spec.outputOffset : this.spec.outputOffset + this.spec.socketOffsets[socketId];
  }

  socketDrift(socketId) {
    return this.spec.socketDriftPerSecond[socketId] === undefined
      ? this.spec.driftPerSecond
      : this.spec.driftPerSecond + this.spec.socketDriftPerSecond[socketId];
  }

  socketNoiseStdDev(socketId) {
    return this.spec.socketNoiseStdDev[socketId] === undefined
      ? this.spec.noiseStdDev
      : this.spec.socketNoiseStdDev[socketId];
  }

  perturbSocketValue(socketId, value, context = {}) {
    assertFiniteNumber(value, `socket value ${socketId}`);
    if (!this.enabled) return value;
    const time = context.time === undefined ? 0 : context.time;
    assertFiniteNumber(time, 'imperfection context time');
    const timeKey = Math.round(time * 1e9);
    const phase = context.phase || 'eval';
    const noiseStdDev = this.socketNoiseStdDev(socketId);
    const noise = noiseStdDev === 0 ? 0 : noiseStdDev * normal01(this.key('noise', `${socketId}:${timeKey}:${phase}`));
    return (
      value * this.outputGainFactor(socketId)
      + this.socketOffset(socketId)
      + this.socketDrift(socketId) * time
      + noise
    );
  }

  isActive() {
    return this.enabled;
  }
}

function createImperfectionModel(spec) {
  return new ImperfectionModel(spec);
}

function withImperfections(definition, spec) {
  const next = clonePlain(definition);
  next.imperfections = normalizeImperfectionSpec(spec);
  return next;
}

module.exports = {
  DEFAULT_IMPERFECTION_SPEC,
  ImperfectionModel,
  createImperfectionModel,
  normalizeImperfectionSpec,
  withImperfections,
  normal01,
  uniform01,
};
