'use strict';

(function attachDesignControls(globalScope) {
  const COEFFICIENT_CONTROL_IDS = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
  const OUTPUT_CHANNELS = Object.freeze(['X', 'Y', 'Z', 'U']);
  const OPERATION_MODES = Object.freeze(['IC', 'OP', 'HALT', 'REP', 'REPF']);
  const EXECUTABLE_OPERATION_MODES = Object.freeze(['IC', 'OP', 'HALT', 'REP', 'REPF']);
  const DEFAULT_COEFFICIENT = 0.5;
  const DEFAULT_OPERATION_CONTROLS = Object.freeze({
    mode: 'REPF',
    duration: 40,
    dt: 0.01,
    sampleEvery: 10,
    opTime: 8,
    cycles: 3,
    clip: false,
  });
  const COEFFICIENT_PRESETS = Object.freeze([
    Object.freeze({ id: 'default', label: 'Default 0.50', coefficients: Object.freeze({}) }),
    Object.freeze({ id: 'zero', label: 'All zero', coefficients: Object.freeze({ P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0, P7: 0, P8: 0 }) }),
    Object.freeze({ id: 'unity', label: 'All one', coefficients: Object.freeze({ P1: 1, P2: 1, P3: 1, P4: 1, P5: 1, P6: 1, P7: 1, P8: 1 }) }),
    Object.freeze({ id: 'quickstart', label: 'Quickstart oscillator', coefficients: Object.freeze({ P1: 0.5, P2: 0.5, P3: 0.5, P4: 0.5, P5: 0.5, P6: 0.5, P7: 0.5, P8: 0.5 }) }),
    Object.freeze({ id: 'gentle-oscillator', label: 'Gentle oscillator', coefficients: Object.freeze({ P1: 0.35, P2: 0.12, P3: 0.45, P4: 0.5, P5: 0.5, P6: 0.5, P7: 0.5, P8: 0.5 }) }),
    Object.freeze({ id: 'overload-demo', label: 'Overload demo', coefficients: Object.freeze({ P1: 1, P2: 0.05, P3: 1, P4: 0.5, P5: 0.5, P6: 0.5, P7: 0.5, P8: 0.5 }) }),
  ]);
  const PARAMETER_TO_COEFFICIENT = Object.freeze({ k: 'P1', d: 'P2', invMass: 'P3' });
  const COEFFICIENT_TO_PARAMETER = Object.freeze({ P1: 'k', P2: 'd', P3: 'invMass' });

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }

  function finiteNumber(value, fallback, name) {
    const normalized = value === undefined || value === null || value === '' ? fallback : Number(value);
    if (!Number.isFinite(normalized)) throw new Error(`${name || 'value'} must be a finite number`);
    return normalized;
  }

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function clampCoefficient(value, fallback = DEFAULT_COEFFICIENT) {
    return clamp(finiteNumber(value, fallback, 'coefficient'), 0, 1);
  }

  function normalizeCoefficientControls(values = {}, options = {}) {
    const defaults = Object.assign({}, options.defaults || {});
    const source = values || {};
    const result = {};
    for (const id of COEFFICIENT_CONTROL_IDS) {
      const fallback = defaults[id] === undefined ? DEFAULT_COEFFICIENT : defaults[id];
      result[id] = clampCoefficient(source[id], fallback);
    }
    return result;
  }

  function coefficientPresetById(presetId) {
    return COEFFICIENT_PRESETS.find((preset) => preset.id === presetId) || COEFFICIENT_PRESETS[0];
  }

  function coefficientControlsFromPreset(presetId = 'default') {
    return normalizeCoefficientControls(coefficientPresetById(presetId).coefficients);
  }

  function coefficientControlDefinitions(values = {}) {
    const normalized = normalizeCoefficientControls(values);
    return COEFFICIENT_CONTROL_IDS.map((id, index) => ({
      id,
      index: index + 1,
      label: `Coefficient ${index + 1}`,
      min: 0,
      max: 1,
      step: 0.01,
      value: normalized[id],
    }));
  }

  function coefficientControlsFromPatch(patch, options = {}) {
    const source = patch || {};
    const values = Object.assign({}, options.defaults || {});
    const parameters = source.parameters || {};
    if (parameters.coefficients && typeof parameters.coefficients === 'object') {
      Object.assign(values, parameters.coefficients);
    }
    for (const [parameter, componentId] of Object.entries(PARAMETER_TO_COEFFICIENT)) {
      if (parameters[parameter] !== undefined && values[componentId] === undefined) values[componentId] = parameters[parameter];
    }
    for (const component of source.components || []) {
      if (component && COEFFICIENT_CONTROL_IDS.includes(component.id) && component.coefficient !== undefined) values[component.id] = component.coefficient;
    }
    return normalizeCoefficientControls(values, options);
  }

  function coefficientControlsFromDesign(design, options = {}) {
    const values = Object.assign({}, options.defaults || {}, (design && design.coefficients) || {});
    for (const component of (design && design.components) || []) {
      if (component && COEFFICIENT_CONTROL_IDS.includes(component.id) && component.coefficient !== undefined) values[component.id] = component.coefficient;
    }
    return normalizeCoefficientControls(values, options);
  }

  function normalizePatchForControls(patch) {
    if (!patch || typeof patch !== 'object') throw new Error('patch must be an object');
    const next = clonePlain(patch);
    next.components = Array.isArray(next.components) ? next.components : [];
    if (!Array.isArray(next.cables) && Array.isArray(next.connections)) next.cables = clonePlain(next.connections);
    if (!Array.isArray(next.cables)) next.cables = [];
    next.outputs = Object.assign({}, next.outputs || {});
    next.parameters = Object.assign({}, next.parameters || {});
    return next;
  }

  function patchWithCoefficientControls(patch, values = {}, options = {}) {
    const next = normalizePatchForControls(patch);
    const coefficients = normalizeCoefficientControls(values, { defaults: coefficientControlsFromPatch(next, options) });
    next.parameters.coefficients = coefficients;
    for (const component of next.components) {
      if (component && COEFFICIENT_CONTROL_IDS.includes(component.id)) component.coefficient = coefficients[component.id];
    }
    for (const [componentId, parameter] of Object.entries(COEFFICIENT_TO_PARAMETER)) {
      next.parameters[parameter] = coefficients[componentId];
    }
    return next;
  }

  function designWithCoefficientControls(design, values = {}, options = {}) {
    if (!design || typeof design !== 'object') throw new Error('design must be an object');
    const next = clonePlain(design);
    const coefficients = normalizeCoefficientControls(values, { defaults: coefficientControlsFromDesign(next, options) });
    next.coefficients = Object.assign({}, next.coefficients || {}, coefficients);
    for (const component of next.components || []) {
      if (component && COEFFICIENT_CONTROL_IDS.includes(component.id)) component.coefficient = coefficients[component.id];
    }
    return next;
  }

  function normalizeOperationMode(mode, options = {}) {
    const text = String(mode || '').toUpperCase();
    const allowed = options.executableOnly ? EXECUTABLE_OPERATION_MODES : OPERATION_MODES;
    if (allowed.includes(text)) return text;
    return options.fallback || DEFAULT_OPERATION_CONTROLS.mode;
  }

  function normalizeOperationControls(values = {}, options = {}) {
    const defaults = Object.assign({}, DEFAULT_OPERATION_CONTROLS, options.defaults || {});
    const mode = normalizeOperationMode(values.mode === undefined ? defaults.mode : values.mode, { fallback: defaults.mode, executableOnly: Boolean(options.executableOnly) });
    const duration = finiteNumber(values.duration, defaults.duration, 'operation duration');
    const dt = finiteNumber(values.dt, defaults.dt, 'operation dt');
    const sampleEvery = Math.round(finiteNumber(values.sampleEvery, defaults.sampleEvery, 'sampleEvery'));
    const opTime = finiteNumber(values.opTime, defaults.opTime, 'REP/REPF opTime');
    const cycles = Math.round(finiteNumber(values.cycles, defaults.cycles, 'REP/REPF cycles'));
    if (duration < 0) throw new Error('operation duration must be >= 0');
    if (dt <= 0) throw new Error('operation dt must be > 0');
    if (sampleEvery <= 0) throw new Error('sampleEvery must be a positive integer');
    if (opTime <= 0) throw new Error('REP/REPF opTime must be > 0');
    if (cycles <= 0) throw new Error('REP/REPF cycles must be a positive integer');
    return { mode, duration, dt, sampleEvery, opTime, cycles, clip: Boolean(values.clip === undefined ? defaults.clip : values.clip) };
  }

  function operationControlsFromPatch(patch, options = {}) {
    const parameters = (patch && patch.parameters) || {};
    return normalizeOperationControls(parameters, options);
  }

  function operationControlsFromDesign(design, options = {}) {
    return normalizeOperationControls((design && design.operationDefaults) || {}, options);
  }

  function patchWithOperationControls(patch, values = {}, options = {}) {
    const next = normalizePatchForControls(patch);
    next.parameters = Object.assign({}, next.parameters, normalizeOperationControls(values, { defaults: operationControlsFromPatch(next, options) }));
    return next;
  }

  function designWithOperationControls(design, values = {}, options = {}) {
    if (!design || typeof design !== 'object') throw new Error('design must be an object');
    const next = clonePlain(design);
    next.operationDefaults = normalizeOperationControls(values, { defaults: operationControlsFromDesign(next, options) });
    return next;
  }

  function normalizeOutputRoutingControls(values = {}, options = {}) {
    const defaults = Object.assign({ X: null, Y: null, Z: null, U: null }, options.defaults || {});
    const channels = Object.assign({}, defaults);
    const source = (values && values.channels) || values || {};
    for (const channel of OUTPUT_CHANNELS) {
      const value = source[channel] !== undefined ? source[channel] : source[channel.toLowerCase()];
      channels[channel] = value === undefined || value === '' || value === null ? null : String(value).trim();
    }
    return channels;
  }

  function outputRoutingControlsFromPatch(patch, options = {}) {
    const outputs = (patch && patch.outputs) || {};
    return normalizeOutputRoutingControls({
      X: outputs.x || outputs.X || outputs.velocity || null,
      Y: outputs.y || outputs.Y || outputs.position || null,
      Z: outputs.z || outputs.Z || null,
      U: outputs.u || outputs.U || null,
    }, options);
  }

  function outputRoutingControlsFromDesign(design, options = {}) {
    const routing = (design && design.outputRouting) || {};
    return normalizeOutputRoutingControls(routing.channels || routing, options);
  }

  function patchWithOutputRoutingControls(patch, values = {}, options = {}) {
    const next = normalizePatchForControls(patch);
    const channels = normalizeOutputRoutingControls(values, { defaults: outputRoutingControlsFromPatch(next, options) });
    for (const channel of OUTPUT_CHANNELS) {
      const key = channel.toLowerCase();
      if (channels[channel]) next.outputs[key] = channels[channel];
      else delete next.outputs[key];
    }
    return next;
  }

  function designWithOutputRoutingControls(design, values = {}, options = {}) {
    if (!design || typeof design !== 'object') throw new Error('design must be an object');
    const next = clonePlain(design);
    const aliases = Object.assign({}, (next.outputRouting && next.outputRouting.aliases) || {});
    next.outputRouting = { channels: normalizeOutputRoutingControls(values, { defaults: outputRoutingControlsFromDesign(next, options) }), aliases };
    return next;
  }

  function socketChoicesFromPatch(patch) {
    const next = normalizePatchForControls(patch);
    const choices = [];
    function add(id, label) {
      if (!choices.some((choice) => choice.value === id)) choices.push({ value: id, label: label || id });
    }
    for (const component of next.components) {
      if (!component || typeof component.id !== 'string') continue;
      const id = component.id;
      if (/^(PLUS1|MINUS1|ZERO)$/.test(id)) add(`${id}.out`);
      else if (/^P\d+$/.test(id)) add(`${id}.out`);
      else if (/^I\d+$/.test(id)) add(`${id}.out`);
      else if (/^INV\d+$/.test(id)) add(`${id}.out`);
      else if (/^SUM\d+$/.test(id)) add(`${id}.out`);
      else if (/^MUL\d+$/.test(id)) add(`${id}.out`);
      else if (/^CMP\d+$/.test(id)) add(`${id}.out`);
      else if (/^XIR\d+$/.test(id)) add(`${id}.out`);
      else if (/^OUT_[XYZU]$/.test(id)) add(`${id}.out`, `${id.slice(-1)} output jack`);
      else if (Array.isArray(component.outputs)) {
        for (const output of component.outputs) add(`${id}.${output}`);
      }
    }
    for (const socketId of Object.values(next.outputs || {})) if (socketId) add(socketId);
    return choices.sort((a, b) => a.value.localeCompare(b.value));
  }

  function controlStateFromPatch(patch, options = {}) {
    return {
      coefficients: coefficientControlsFromPatch(patch, options),
      operation: operationControlsFromPatch(patch, options),
      outputRouting: outputRoutingControlsFromPatch(patch, options),
      socketChoices: socketChoicesFromPatch(patch),
    };
  }

  function patchWithControlState(patch, controlState = {}, options = {}) {
    let next = normalizePatchForControls(patch);
    if (controlState.coefficients) next = patchWithCoefficientControls(next, controlState.coefficients, options);
    if (controlState.operation) next = patchWithOperationControls(next, controlState.operation, options);
    if (controlState.outputRouting) next = patchWithOutputRoutingControls(next, controlState.outputRouting, options);
    return next;
  }

  function controlStateFromDesign(design, options = {}) {
    return {
      coefficients: coefficientControlsFromDesign(design, options),
      operation: operationControlsFromDesign(design, options),
      outputRouting: outputRoutingControlsFromDesign(design, options),
    };
  }

  function designWithControlState(design, controlState = {}, options = {}) {
    let next = clonePlain(design);
    if (controlState.coefficients) next = designWithCoefficientControls(next, controlState.coefficients, options);
    if (controlState.operation) next = designWithOperationControls(next, controlState.operation, options);
    if (controlState.outputRouting) next = designWithOutputRoutingControls(next, controlState.outputRouting, options);
    return next;
  }

  function controlWarnings(controlState = {}) {
    const warnings = [];
    const operation = controlState.operation || {};
    if (operation.clip) warnings.push('Clipping is enabled; integrator states are limited to ±1 machine unit during execution.');
    const coefficients = controlState.coefficients || {};
    for (const [id, value] of Object.entries(coefficients)) {
      if (value === 0) warnings.push(`${id} is set to 0.00, so its output will be muted.`);
      if (value === 1) warnings.push(`${id} is set to 1.00, so it can pass the full input amplitude.`);
    }
    return warnings;
  }

  const api = {
    COEFFICIENT_CONTROL_IDS,
    OUTPUT_CHANNELS,
    OPERATION_MODES,
    EXECUTABLE_OPERATION_MODES,
    DEFAULT_COEFFICIENT,
    DEFAULT_OPERATION_CONTROLS,
    COEFFICIENT_PRESETS,
    PARAMETER_TO_COEFFICIENT,
    COEFFICIENT_TO_PARAMETER,
    clampCoefficient,
    normalizeCoefficientControls,
    coefficientControlsFromPreset,
    coefficientPresetById,
    coefficientControlDefinitions,
    coefficientControlsFromPatch,
    coefficientControlsFromDesign,
    patchWithCoefficientControls,
    designWithCoefficientControls,
    normalizeOperationMode,
    normalizeOperationControls,
    operationControlsFromPatch,
    operationControlsFromDesign,
    patchWithOperationControls,
    designWithOperationControls,
    normalizeOutputRoutingControls,
    outputRoutingControlsFromPatch,
    outputRoutingControlsFromDesign,
    patchWithOutputRoutingControls,
    designWithOutputRoutingControls,
    socketChoicesFromPatch,
    controlStateFromPatch,
    patchWithControlState,
    controlStateFromDesign,
    designWithControlState,
    controlWarnings,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDesignControls = api;
}(typeof window !== 'undefined' ? window : global));
