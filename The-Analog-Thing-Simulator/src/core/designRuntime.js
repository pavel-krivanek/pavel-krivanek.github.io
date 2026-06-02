'use strict';

const { MODES, EXECUTABLE_MODES, runMode } = require('./modes');
const { normalizeDesign, serializedPatchFromDesign, summarizeDesign } = require('./design');
const { createPatchMachineFromSerializedPatch, normalizeSerializedPatch } = require('./serialization');
const { validateCustomDesign } = require('./designDiagnostics');

const DESIGN_TRACE_SCHEMA_VERSION = 'analog-thing-design-trace/v1';
const CHANNELS = Object.freeze(['X', 'Y', 'Z', 'U']);

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function finiteNumber(value, fallback, name) {
  const normalized = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(normalized)) throw new Error(`${name} must be a finite number`);
  return normalized;
}

function positiveInteger(value, fallback, name) {
  const normalized = Math.round(finiteNumber(value, fallback, name));
  if (normalized <= 0) throw new Error(`${name} must be a positive integer`);
  return normalized;
}

function normalizeExecutableMode(mode, options = {}) {
  const requested = mode || MODES.OP;
  if (!EXECUTABLE_MODES.has(requested)) {
    throw new Error(`custom design runtime supports ${Array.from(EXECUTABLE_MODES).join(', ')}, got ${requested}`);
  }
  return requested;
}

function outputNameForChannel(channel) {
  return String(channel).toLowerCase();
}

function outputRoutingEntries(design) {
  const normalized = normalizeDesign(design);
  const entries = [];
  const seen = new Set();
  function add(name, socketId, channel = null, source = 'alias') {
    if (!name || !socketId || seen.has(name)) return;
    seen.add(name);
    entries.push({ name, socketId, channel, source });
  }
  for (const [alias, socketId] of Object.entries(normalized.outputRouting.aliases || {})) add(alias, socketId, null, 'alias');
  for (const channel of CHANNELS) {
    const socketId = normalized.outputRouting.channels[channel];
    if (socketId) add(outputNameForChannel(channel), socketId, channel, 'channel');
  }
  return entries;
}

function availableDesignOutputNames(design) {
  return outputRoutingEntries(design).map((entry) => entry.name);
}

function selectedOutputNamesFromDesign(design, options = {}) {
  const available = availableDesignOutputNames(design);
  const availableSet = new Set(available);
  const selected = [];
  function add(name) {
    if (!name || selected.includes(name)) return;
    if (!availableSet.has(name)) throw new Error(`selected output ${name} is not routed by this design`);
    selected.push(name);
  }
  for (const channel of options.selectedChannels || options.channels || []) add(outputNameForChannel(channel));
  for (const name of options.selectedOutputNames || options.outputs || []) add(name);
  if (options.outputName) add(options.outputName);
  if (selected.length === 0) return available;
  return selected;
}

function normalizeDesignRunOptions(design, options = {}) {
  const normalized = normalizeDesign(design);
  const defaults = normalized.operationDefaults || {};
  const requestedMode = options.mode || defaults.mode || MODES.OP;
  const mode = normalizeExecutableMode(requestedMode, options);
  const selectedOutputNames = selectedOutputNamesFromDesign(normalized, options);
  return {
    mode,
    requestedMode,
    duration: finiteNumber(options.duration, defaults.duration === undefined ? 40 : defaults.duration, 'duration'),
    dt: finiteNumber(options.dt, defaults.dt === undefined ? 0.01 : defaults.dt, 'dt'),
    sampleEvery: positiveInteger(options.sampleEvery, defaults.sampleEvery === undefined ? 10 : defaults.sampleEvery, 'sampleEvery'),
    opTime: finiteNumber(options.opTime, defaults.opTime === undefined ? 8 : defaults.opTime, 'opTime'),
    cycles: positiveInteger(options.cycles, defaults.cycles === undefined ? 3 : defaults.cycles, 'cycles'),
    clip: options.clip === undefined ? Boolean(defaults.clip) : Boolean(options.clip),
    selectedOutputNames,
    filterTrace: options.filterTrace !== false,
    initialState: options.initialState ? clonePlain(options.initialState) : undefined,
  };
}

function compileDesignForRuntime(design, options = {}) {
  const normalized = normalizeDesign(design);
  const validation = validateCustomDesign(normalized, options);
  if (!validation.ok && options.allowInvalid !== true) {
    const messages = validation.errors.length ? validation.errors : validation.diagnostics.map((diagnostic) => diagnostic.message);
    throw new Error(`custom design validation failed: ${messages.join('; ')}`);
  }
  const patch = serializedPatchFromDesign(normalized, options);
  return { design: normalized, validation, patch: normalizeSerializedPatch(patch) };
}

function filterTracePointOutputs(point, selectedOutputNames) {
  const outputs = {};
  const outputDetails = {};
  for (const name of selectedOutputNames) {
    if (point.outputs && Object.prototype.hasOwnProperty.call(point.outputs, name)) outputs[name] = point.outputs[name];
    if (point.outputDetails && Object.prototype.hasOwnProperty.call(point.outputDetails, name)) outputDetails[name] = point.outputDetails[name];
  }
  return Object.assign({}, point, { outputs, outputDetails });
}

function filterTraceOutputs(result, selectedOutputNames) {
  if (!result || !Array.isArray(result.trace)) return result;
  const filtered = clonePlain(result);
  filtered.trace = result.trace.map((point) => filterTracePointOutputs(point, selectedOutputNames));
  filtered.selectedOutputNames = selectedOutputNames.slice();
  return filtered;
}

function overloadEventsFromTrace(trace) {
  const events = [];
  for (const point of trace || []) {
    for (const [name, details] of Object.entries(point.outputDetails || {})) {
      if (details && details.overloaded) {
        events.push({ t: point.t, cycle: point.cycle, output: name, socket: details.socket, machineUnit: details.machineUnit });
      }
    }
  }
  return events;
}

function summarizeDesignRunResult(payload) {
  const result = payload && payload.result ? payload.result : payload;
  const trace = (result && result.trace) || [];
  const outputNames = trace[0] ? Object.keys(trace[0].outputs || {}) : [];
  const peaks = {};
  const finals = {};
  for (const name of outputNames) {
    peaks[name] = trace.length ? Math.max(...trace.map((point) => Math.abs(point.outputs[name] || 0))) : 0;
    finals[name] = trace.length ? trace[trace.length - 1].outputs[name] : 0;
  }
  const overloadEvents = overloadEventsFromTrace(trace);
  const overloadedOutputNames = Array.from(new Set(overloadEvents.map((event) => event.output))).sort();
  return {
    mode: result && result.mode,
    requestedMode: payload && payload.operation ? payload.operation.requestedMode : undefined,
    sampleCount: trace.length,
    outputNames,
    selectedOutputNames: result && result.selectedOutputNames ? result.selectedOutputNames.slice() : outputNames,
    finalState: result && result.finalState ? clonePlain(result.finalState) : null,
    overload: trace.some((point) => point.overload) || overloadEvents.length > 0,
    overloadPointCount: trace.filter((point) => point.overload).length,
    overloadEventCount: overloadEvents.length,
    overloadedOutputNames,
    overloadEvents,
    triggerCount: trace.filter((point) => point.trigger).length,
    peaks,
    finals,
  };
}

function runCustomDesign(design, options = {}) {
  const compiled = compileDesignForRuntime(design, options);
  const operation = normalizeDesignRunOptions(compiled.design, options);
  const machine = createPatchMachineFromSerializedPatch(compiled.patch, options);
  const resultOptions = Object.assign({}, operation, { mode: operation.mode });
  let result = runMode(machine, resultOptions);
  result.requestedMode = operation.requestedMode;
  if (operation.filterTrace) result = filterTraceOutputs(result, operation.selectedOutputNames);
  else result.selectedOutputNames = operation.selectedOutputNames.slice();
  const payload = {
    design: compiled.design,
    designSummary: summarizeDesign(compiled.design),
    patch: compiled.patch,
    validation: compiled.validation,
    operation,
    selectedOutputNames: operation.selectedOutputNames.slice(),
    result,
  };
  payload.summary = summarizeDesignRunResult(payload);
  return payload;
}

function designTraceExportPayload(runPayload, options = {}) {
  if (!runPayload || !runPayload.design || !runPayload.result) throw new Error('designTraceExportPayload requires a runCustomDesign payload');
  const exported = {
    schemaVersion: DESIGN_TRACE_SCHEMA_VERSION,
    generatedAt: options.generatedAt || options.now || new Date().toISOString(),
    designMetadata: clonePlain(runPayload.design.metadata || {}),
    designSummary: runPayload.designSummary || summarizeDesign(runPayload.design),
    operation: clonePlain(runPayload.operation || {}),
    selectedOutputNames: (runPayload.selectedOutputNames || []).slice(),
    validation: {
      ok: Boolean(runPayload.validation && runPayload.validation.ok),
      errorCount: runPayload.validation ? runPayload.validation.errorCount : 0,
      warningCount: runPayload.validation ? runPayload.validation.warningCount : 0,
    },
    summary: runPayload.summary || summarizeDesignRunResult(runPayload),
    trace: clonePlain(runPayload.result.trace || []),
  };
  const json = `${JSON.stringify(exported, null, 2)}\n`;
  return { payload: exported, json, byteLength: Buffer.byteLength(json, 'utf8') };
}

function compareDesignExecutionWithPatch(design, serializedPatch, options = {}) {
  const designRun = runCustomDesign(design, options);
  const patch = normalizeSerializedPatch(serializedPatch);
  const machine = createPatchMachineFromSerializedPatch(patch, options);
  const operation = normalizeDesignRunOptions(designRun.design, options);
  let patchResult = runMode(machine, Object.assign({}, operation, { mode: operation.mode }));
  patchResult = filterTraceOutputs(patchResult, operation.selectedOutputNames);
  const designTrace = designRun.result.trace;
  const patchTrace = patchResult.trace;
  let maxOutputDelta = 0;
  const sampleCount = Math.min(designTrace.length, patchTrace.length);
  for (let index = 0; index < sampleCount; index += 1) {
    for (const name of operation.selectedOutputNames) {
      const delta = Math.abs((designTrace[index].outputs[name] || 0) - (patchTrace[index].outputs[name] || 0));
      if (delta > maxOutputDelta) maxOutputDelta = delta;
    }
  }
  return {
    ok: designTrace.length === patchTrace.length && maxOutputDelta <= (options.tolerance === undefined ? 1e-12 : options.tolerance),
    designRun,
    patchResult,
    sampleCountDelta: designTrace.length - patchTrace.length,
    maxOutputDelta,
    selectedOutputNames: operation.selectedOutputNames,
  };
}

module.exports = {
  DESIGN_TRACE_SCHEMA_VERSION,
  compileDesignForRuntime,
  normalizeDesignRunOptions,
  outputRoutingEntries,
  availableDesignOutputNames,
  selectedOutputNamesFromDesign,
  filterTraceOutputs,
  summarizeDesignRunResult,
  runCustomDesign,
  designTraceExportPayload,
  compareDesignExecutionWithPatch,
};
