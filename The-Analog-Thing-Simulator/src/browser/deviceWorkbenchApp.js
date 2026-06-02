/* global window, document, Blob, URL */
'use strict';

(function attachDeviceWorkbenchApp(globalScope) {
  const MODES = Object.freeze(['OFF', 'COEFF', 'IC', 'OP', 'HALT', 'REP', 'REPF', 'MINION']);
  const OUTPUT_CHANNELS = Object.freeze(['X', 'Y', 'Z', 'U']);
  const COEFFICIENT_IDS = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
  const SCOPE_CHANNEL_STYLES = Object.freeze({
    CH1: Object.freeze({ color: '#76ff7a', cssClass: 'scope-channel-ch1', label: 'CH1' }),
    CH2: Object.freeze({ color: '#ffc65a', cssClass: 'scope-channel-ch2', label: 'CH2' }),
  });
  const SIMULATION_PRECISION_PRESETS = Object.freeze({
    quick: Object.freeze({ id: 'quick', label: 'Quick', description: 'Use the template solver step and sparse trace sampling. Fastest, but oscilloscope curves may be visibly polygonal.', dtDivider: 1, sampleDivider: 1 }),
    balanced: Object.freeze({ id: 'balanced', label: 'Balanced', description: 'Keep the template solver step and draw about 10x more oscilloscope samples.', dtDivider: 1, sampleDivider: 10 }),
    fine: Object.freeze({ id: 'fine', label: 'Fine', description: 'Use a 2x smaller solver step and about 50x more displayed samples.', dtDivider: 2, sampleDivider: 50 }),
    ultra: Object.freeze({ id: 'ultra', label: 'Ultra', description: 'Use a 4x smaller solver step and about 100x more displayed samples. Best for short demos such as mass-spring.', dtDivider: 4, sampleDivider: 100 }),
  });
  const PHYSICAL_OP_TIME_LIMIT_MS = Object.freeze({ REP: 10000, REPF: 100 });

  const DEFAULTS = Object.freeze({
    mode: 'REPF',
    opTimeMs: 8,
    opDurationMs: 40,
    repCycles: 3,
    solverDtMs: 0.01,
    sampleEvery: 10,
    simulationPrecision: 'balanced',
    scopeA: 'X',
    scopeB: 'Y',
    scopeMode: 'time',
    clip: false,
    autoRunChanges: false,
  });

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }
  function finiteNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
  function positiveNumber(value, fallback, minimum = 0) { const numeric = finiteNumber(value, fallback); return numeric >= minimum ? numeric : fallback; }
  function positiveInteger(value, fallback) { const numeric = Math.round(finiteNumber(value, fallback)); return numeric > 0 ? numeric : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function clampCoefficient(value, fallback = 0.5) { return clamp(finiteNumber(value, fallback), 0, 1); }
  function physicalOpTimeLimitMsForMode(mode) { return PHYSICAL_OP_TIME_LIMIT_MS[mode] || null; }
  function physicalOpTimeLimitLabel(mode) {
    const limit = physicalOpTimeLimitMsForMode(mode);
    if (!limit) return 'OP-TIME is used by REP/REPF only; OP mode uses OP duration.';
    return mode === 'REP' ? 'Physical THAT REP OP-TIME range: 0–10000 ms. Larger values run as virtual extended simulation.' : 'Physical THAT REPF OP-TIME range: 0–100 ms. Larger values run as virtual extended simulation.';
  }
  function opTimeExceedsPhysicalLimit(options = {}) {
    const mode = options.mode;
    const limit = physicalOpTimeLimitMsForMode(mode);
    if (!limit) return false;
    return positiveNumber(options.opTimeMs, DEFAULTS.opTimeMs, 0) > limit;
  }
  function escapeText(text) { return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function normalizeSimulationPrecision(value, fallback = DEFAULTS.simulationPrecision) {
    return Object.prototype.hasOwnProperty.call(SIMULATION_PRECISION_PRESETS, value) ? value : fallback;
  }

  function precisionAdjustedRuntimeSettings(options = {}) {
    const preset = SIMULATION_PRECISION_PRESETS[normalizeSimulationPrecision(options.simulationPrecision)] || SIMULATION_PRECISION_PRESETS.balanced;
    const baseDt = positiveNumber(options.solverDtMs, DEFAULTS.solverDtMs, 0.000001);
    const baseSampleEvery = positiveInteger(options.sampleEvery, DEFAULTS.sampleEvery);
    return {
      precision: preset.id,
      precisionLabel: preset.label,
      baseDt,
      baseSampleEvery,
      dt: Math.max(0.000001, baseDt / preset.dtDivider),
      sampleEvery: Math.max(1, Math.round(baseSampleEvery / preset.sampleDivider)),
    };
  }

  function downloadJson(payload, filename) {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !globalScope.document) return;
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = globalScope.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    globalScope.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function componentById(patch, id) {
    return ((patch && patch.components) || []).find((component) => component && component.id === id) || null;
  }

  function setComponentCoefficient(patch, id, value) {
    const next = clonePlain(patch);
    const coefficient = clampCoefficient(value, 0.5);
    let component = componentById(next, id);
    if (!component) {
      component = { id, coefficient };
      next.components = (next.components || []).concat([component]);
    } else {
      component.coefficient = coefficient;
    }
    next.parameters = Object.assign({}, next.parameters || {});
    next.parameters.coefficients = Object.assign({}, next.parameters.coefficients || {}, { [id]: coefficient });
    if (id === 'P1') next.parameters.k = coefficient;
    if (id === 'P2') next.parameters.d = coefficient;
    if (id === 'P3') next.parameters.invMass = coefficient;
    return next;
  }

  function readCoefficientMap(patch) {
    const params = (patch && patch.parameters && patch.parameters.coefficients) || {};
    const map = {};
    for (const id of COEFFICIENT_IDS) {
      const component = componentById(patch, id);
      const fallback = params[id] === undefined ? 0.5 : params[id];
      map[id] = clampCoefficient(component && component.coefficient !== undefined ? component.coefficient : fallback, 0.5);
    }
    return map;
  }

  function readControls(doc) {
    const modeField = doc.querySelector('#mode');
    const opTimeField = doc.querySelector('#opTimeMs');
    const opDurationField = doc.querySelector('#opDurationMs');
    const cyclesField = doc.querySelector('#repCycles');
    const dtField = doc.querySelector('#solverDtMs');
    const sampleEveryField = doc.querySelector('#sampleEvery');
    const precisionField = doc.querySelector('#simulationPrecision');
    const scopeAField = doc.querySelector('#scopeA');
    const scopeBField = doc.querySelector('#scopeB');
    const scopeModeField = doc.querySelector('#scopeMode');
    const clipField = doc.querySelector('#clip');
    const autoRunField = doc.querySelector('#autoRunChanges');
    const mode = MODES.includes(modeField && modeField.value) ? modeField.value : DEFAULTS.mode;
    return {
      mode,
      opTimeMs: positiveNumber(opTimeField && opTimeField.value, DEFAULTS.opTimeMs, 0),
      opDurationMs: positiveNumber(opDurationField && opDurationField.value, DEFAULTS.opDurationMs, 0),
      repCycles: positiveInteger(cyclesField && cyclesField.value, DEFAULTS.repCycles),
      solverDtMs: positiveNumber(dtField && dtField.value, DEFAULTS.solverDtMs, 0.000001),
      sampleEvery: positiveInteger(sampleEveryField && sampleEveryField.value, DEFAULTS.sampleEvery),
      simulationPrecision: normalizeSimulationPrecision(precisionField && precisionField.value),
      scopeA: OUTPUT_CHANNELS.includes(scopeAField && scopeAField.value) ? scopeAField.value : DEFAULTS.scopeA,
      scopeB: (scopeBField && scopeBField.value === 'none') ? 'none' : (OUTPUT_CHANNELS.includes(scopeBField && scopeBField.value) ? scopeBField.value : DEFAULTS.scopeB),
      scopeMode: scopeModeField && scopeModeField.value === 'xy' ? 'xy' : 'time',
      clip: Boolean(clipField && clipField.checked),
      autoRunChanges: Boolean(autoRunField && autoRunField.checked),
    };
  }

  function outputComponentId(channel) { return `OUT_${channel}`; }
  function outputNameForChannel(channel) { return channel; }

  function getPatchTemplatesApp() {
    if (globalScope.AnalogThingPatchTemplatesApp) return globalScope.AnalogThingPatchTemplatesApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./patchTemplatesApp'); } catch (error) { return null; }
    }
    return null;
  }

  function getPatchEditorApp() {
    if (globalScope.AnalogThingPatchEditorApp) return globalScope.AnalogThingPatchEditorApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./patchEditorApp'); } catch (error) { return null; }
    }
    return null;
  }

  function expandRuntimePatchToFullBoard(patch) {
    const editor = getPatchEditorApp();
    if (editor && typeof editor.expandPatchToFullBoard === 'function') return editor.expandPatchToFullBoard(patch);
    return clonePlain(patch);
  }

  function inferTemplateIdFromPatch(patch) {
    if (patch && patch.template && patch.template.id) return patch.template.id;
    if (patch && patch.parameters && patch.parameters.firstStepsExampleId) return patch.parameters.firstStepsExampleId;
    const ids = new Set(((patch && patch.components) || []).map((component) => component && component.id));
    if (ids.has('I1') && ids.has('I2') && ids.has('P1') && ids.has('P2') && ids.has('P3')) return 'quickstart-damped-oscillation';
    if (ids.has('MUL1')) return 'multiplier-product';
    if (ids.has('CMP1')) return 'comparator-switch';
    if (ids.has('INV1') && ids.has('P1')) return 'coefficient-inverter';
    if (ids.has('I1') && ids.has('OUT_Y')) return 'slow-integrator-ramp';
    return 'first-steps-radioactive-decay';
  }

  function readPatchDeviceControls(patch) {
    const templates = getPatchTemplatesApp();
    if (templates && typeof templates.deviceControlsFromPatch === 'function') {
      return templates.deviceControlsFromPatch(patch, inferTemplateIdFromPatch(patch));
    }
    return Object.assign({}, DEFAULTS, (patch && patch.deviceControls) || {});
  }

  function applyControlValue(doc, id, value) {
    const node = doc.querySelector(`#${id}`);
    if (!node || value === undefined || value === null) return;
    if (node.type === 'checkbox') node.checked = Boolean(value);
    else node.value = String(value);
  }

  function applyDeviceControlsToForm(doc, controls = {}) {
    const normalized = Object.assign({}, DEFAULTS, controls || {});
    const controlIds = ['mode', 'opTimeMs', 'opDurationMs', 'repCycles', 'solverDtMs', 'sampleEvery', 'simulationPrecision', 'scopeA', 'scopeB', 'scopeMode', 'clip', 'autoRunChanges'];
    for (const id of controlIds) applyControlValue(doc, id, normalized[id]);
    return normalized;
  }

  function patchHasChannel(patch, channel) {
    return Boolean(componentById(patch, outputComponentId(channel)));
  }

  function patchConnections(patch) {
    const raw = (patch && (patch.cables || patch.connections)) || [];
    return Array.isArray(raw) ? raw.filter((connection) => connection && typeof connection.from === 'string' && typeof connection.to === 'string') : [];
  }

  function patchChannelIsWired(patch, channel) {
    const inputSocket = `${outputComponentId(channel)}.in`;
    return patchConnections(patch).some((connection) => connection.to === inputSocket);
  }

  function outputRouteStatus(patch) {
    const status = {};
    for (const channel of OUTPUT_CHANNELS) {
      status[channel] = {
        componentPresent: patchHasChannel(patch, channel),
        wired: patchChannelIsWired(patch, channel),
        inputSocket: `${outputComponentId(channel)}.in`,
        outputSocket: `${outputComponentId(channel)}.out`,
      };
    }
    return status;
  }

  function runtimePatchWithSelectedOutputs(patch, options) {
    const next = expandRuntimePatchToFullBoard(patch);
    next.outputs = Object.assign({}, next.outputs || {});
    for (const channel of OUTPUT_CHANNELS) {
      if (patchHasChannel(next, channel)) next.outputs[outputNameForChannel(channel)] = `${outputComponentId(channel)}.out`;
    }
    const requested = [options.scopeA, options.scopeB].filter((channel) => channel && channel !== 'none');
    for (const channel of requested) {
      if (patchHasChannel(next, channel)) next.outputs[outputNameForChannel(channel)] = `${outputComponentId(channel)}.out`;
    }
    return next;
  }

  function runtimeMode(options) {
    if (options.mode === 'REP' || options.mode === 'REPF') return options.mode;
    if (options.mode === 'IC' || options.mode === 'OP' || options.mode === 'HALT') return options.mode;
    return null;
  }

  function runtimeOptions(options) {
    const mode = runtimeMode(options);
    const precision = precisionAdjustedRuntimeSettings(options);
    const opTime = positiveNumber(options.opTimeMs, DEFAULTS.opTimeMs, 0);
    const physicalLimit = physicalOpTimeLimitMsForMode(options.mode);
    return {
      mode,
      duration: options.opDurationMs,
      opTime,
      cycles: options.repCycles,
      dt: precision.dt,
      sampleEvery: precision.sampleEvery,
      baseDt: precision.baseDt,
      baseSampleEvery: precision.baseSampleEvery,
      simulationPrecision: precision.precision,
      simulationPrecisionLabel: precision.precisionLabel,
      opTimePhysicalLimitMs: physicalLimit,
      opTimeExceedsPhysicalLimit: Boolean(physicalLimit && opTime > physicalLimit),
      clip: options.clip,
      allowUnconnectedInputs: true,
    };
  }

  function runtimeControlWarnings(options = {}) {
    const controls = Object.assign({}, DEFAULTS, options || {});
    const limit = physicalOpTimeLimitMsForMode(controls.mode);
    if (!limit || !opTimeExceedsPhysicalLimit(controls)) return [];
    return [`${controls.mode} OP-TIME is ${controls.opTimeMs} ms, above the physical THAT limit of ${limit} ms. The browser simulator will still run the full virtual duration.`];
  }

  function requestedScopeSeries(options) {
    const entries = [
      { channel: 'CH1', output: options.scopeA },
      { channel: 'CH2', output: options.scopeB },
    ];
    return entries
      .filter((entry) => entry.output && entry.output !== 'none')
      .map((entry) => Object.assign({}, entry, SCOPE_CHANNEL_STYLES[entry.channel] || {}));
  }

  function traceScopeSeries(trace, options) {
    const available = new Set(trace && trace[0] && trace[0].outputs ? Object.keys(trace[0].outputs) : []);
    const requested = requestedScopeSeries(options).filter((series) => available.has(outputNameForChannel(series.output)));
    if (requested.length) return requested.map((series) => Object.assign({}, series, { output: outputNameForChannel(series.output) }));
    return Array.from(available).slice(0, 2).map((output, index) => {
      const channel = index === 0 ? 'CH1' : 'CH2';
      return Object.assign({ channel, output }, SCOPE_CHANNEL_STYLES[channel]);
    });
  }

  function traceOutputNames(trace, options) {
    return traceScopeSeries(trace, options).map((series) => series.output);
  }

  function traceSeriesStats(trace, series) {
    const output = series && series.output;
    let sampleCount = 0;
    let min = Infinity;
    let max = -Infinity;
    let first = null;
    let last = null;
    for (const point of trace || []) {
      const value = point && point.outputs ? point.outputs[output] : undefined;
      if (!Number.isFinite(value)) continue;
      if (sampleCount === 0) first = value;
      last = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
      sampleCount += 1;
    }
    if (sampleCount === 0) return { sampleCount: 0, min: null, max: null, first: null, last: null, constant: false, constantValue: null };
    const spread = max - min;
    const constant = spread <= 1e-9;
    return { sampleCount, min, max, first, last, constant, constantValue: constant ? first : null };
  }

  function traceBoundsTime(trace, seriesList) {
    const names = seriesList.map((series) => series.output);
    let minT = 0;
    let maxT = 1;
    let minY = -1;
    let maxY = 1;
    if (trace.length) {
      minT = trace[0].t;
      maxT = trace[trace.length - 1].t;
      minY = Infinity;
      maxY = -Infinity;
      for (const point of trace) {
        for (const name of names) {
          const value = point.outputs[name];
          if (Number.isFinite(value)) {
            minY = Math.min(minY, value);
            maxY = Math.max(maxY, value);
          }
        }
      }
      if (!Number.isFinite(minY) || !Number.isFinite(maxY)) { minY = -1; maxY = 1; }
    }
    const yPad = Math.max(0.05, (maxY - minY) * 0.12);
    return { minT, maxT: maxT <= minT ? minT + 1 : maxT, minY: minY - yPad, maxY: maxY + yPad };
  }

  function drawConstantTimeSeries(ctx, bounds, pixels, series, stats) {
    const y = pixels.y(stats.constantValue);
    ctx.strokeStyle = series.color || '#76ff7a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pixels.left, y);
    ctx.lineTo(pixels.left + pixels.width, y);
    ctx.stroke();
    ctx.fillStyle = series.color || '#76ff7a';
    ctx.beginPath();
    ctx.arc(pixels.left + 4, y, 3.5, 0, Math.PI * 2);
    ctx.arc(pixels.left + pixels.width - 4, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTimeScope(canvas, trace, seriesList) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const pad = { left: 48, right: 16, top: 16, bottom: 30 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    const bounds = traceBoundsTime(trace, seriesList);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#08150e';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#6ea06f';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.left, pad.top, w, h);
    const xPixel = (t) => pad.left + ((t - bounds.minT) / (bounds.maxT - bounds.minT)) * w;
    const yPixel = (value) => pad.top + (1 - (value - bounds.minY) / (bounds.maxY - bounds.minY)) * h;
    if (bounds.minY < 0 && bounds.maxY > 0) {
      const zero = yPixel(0);
      ctx.strokeStyle = 'rgba(118, 255, 122, 0.18)';
      ctx.beginPath();
      ctx.moveTo(pad.left, zero);
      ctx.lineTo(pad.left + w, zero);
      ctx.stroke();
    }
    ctx.fillStyle = '#9bd89c';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillText(`${bounds.minT.toFixed(2)} ms`, pad.left, height - 10);
    ctx.fillText(`${bounds.maxT.toFixed(2)} ms`, Math.max(pad.left, width - 88), height - 10);
    ctx.fillText(bounds.maxY.toFixed(2), 8, pad.top + 4);
    ctx.fillText(bounds.minY.toFixed(2), 8, pad.top + h);
    for (const point of trace) {
      if (!point.trigger) continue;
      const x = xPixel(point.t);
      ctx.strokeStyle = 'rgba(255, 198, 90, 0.24)';
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + h);
      ctx.stroke();
    }
    seriesList.forEach((series) => {
      const stats = traceSeriesStats(trace, series);
      if (stats.sampleCount === 0) return;
      if (stats.constant) {
        drawConstantTimeSeries(ctx, bounds, { left: pad.left, width: w, y: yPixel }, series, stats);
        return;
      }
      ctx.strokeStyle = series.color || '#76ff7a';
      ctx.lineWidth = 2.25;
      ctx.beginPath();
      let started = false;
      for (const point of trace) {
        const value = point.outputs[series.output];
        if (!Number.isFinite(value)) continue;
        const x = xPixel(point.t);
        const y = yPixel(value);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }

  function drawXyScope(canvas, trace, xSeries, ySeries) {
    const xName = xSeries.output;
    const yName = ySeries.output;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const pad = 28;
    const sizeW = width - pad * 2;
    const sizeH = height - pad * 2;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#08150e';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#6ea06f';
    ctx.strokeRect(pad, pad, sizeW, sizeH);
    const mapX = (value) => pad + ((clamp(value, -1, 1) + 1) / 2) * sizeW;
    const mapY = (value) => pad + (1 - ((clamp(value, -1, 1) + 1) / 2)) * sizeH;
    ctx.strokeStyle = 'rgba(118, 255, 122, 0.18)';
    ctx.beginPath();
    ctx.moveTo(mapX(0), pad);
    ctx.lineTo(mapX(0), pad + sizeH);
    ctx.moveTo(pad, mapY(0));
    ctx.lineTo(pad + sizeW, mapY(0));
    ctx.stroke();
    ctx.strokeStyle = ySeries.color || '#76ff7a';
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    let started = false;
    for (const point of trace) {
      const x = point.outputs[xName];
      const y = point.outputs[yName];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!started) { ctx.moveTo(mapX(x), mapY(y)); started = true; } else ctx.lineTo(mapX(x), mapY(y));
    }
    ctx.stroke();
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = xSeries.color || '#9bd89c';
    ctx.fillText(`${xSeries.channel} ${xName}`, pad, height - 8);
    ctx.fillStyle = ySeries.color || '#ffc65a';
    ctx.fillText(`${ySeries.channel} ${yName}`, pad + 82, height - 8);
  }

  function drawEmptyScope(canvas, text) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#08150e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#6ea06f';
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
    ctx.fillStyle = '#9bd89c';
    ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillText(text || 'No trace', 32, 48);
  }

  function summarizeTrace(result, names) {
    const trace = (result && result.trace) || [];
    const peaks = {};
    for (const name of names) peaks[name] = Math.max(0, ...trace.map((point) => Math.abs(point.outputs[name] || 0)));
    return {
      mode: result && result.mode,
      sampleCount: trace.length,
      triggerCount: trace.filter((point) => point.trigger).length,
      overload: trace.some((point) => point.overload),
      finalState: result && result.finalState,
      displayedOutputs: names,
      peaks,
    };
  }

  function setText(node, text) { if (node) node.textContent = text; }


  function applyWorkbenchLayout(doc, layout) {
    const normalized = layout === 'scope-focus' ? 'scope-focus' : 'patch-focus';
    const workbench = doc.querySelector('.device-workbench');
    if (workbench) workbench.dataset.workbenchLayout = normalized;
    for (const button of Array.from(doc.querySelectorAll('[data-workbench-layout-button]'))) {
      const pressed = button.getAttribute('data-workbench-layout-button') === normalized;
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }
    return normalized;
  }

  function initWorkbenchLayoutControls(doc) {
    const buttons = Array.from(doc.querySelectorAll('[data-workbench-layout-button]'));
    if (!buttons.length) return applyWorkbenchLayout(doc, 'patch-focus');
    let current = 'patch-focus';
    try {
      const stored = globalScope.localStorage && globalScope.localStorage.getItem('analogThingWorkbenchLayout');
      if (stored === 'scope-focus' || stored === 'patch-focus') current = stored;
    } catch (error) {
      current = 'patch-focus';
    }
    applyWorkbenchLayout(doc, current);
    for (const button of buttons) {
      button.addEventListener('click', () => {
        const selected = button.getAttribute('data-workbench-layout-button') === 'scope-focus' ? 'scope-focus' : 'patch-focus';
        applyWorkbenchLayout(doc, selected);
        try {
          if (globalScope.localStorage) globalScope.localStorage.setItem('analogThingWorkbenchLayout', selected);
        } catch (error) {
          // Persistent layout preference is optional; the UI state has already been updated.
        }
      });
    }
    return current;
  }

  function autoRunEnabled(doc) {
    const node = doc.querySelector('#autoRunChanges');
    return Boolean(node && node.checked);
  }

  function targetIsAutoRunToggle(event) {
    return Boolean(event && event.target && event.target.id === 'autoRunChanges');
  }

  function markTraceStale(doc, reason) {
    const status = doc.querySelector('#statusText');
    const warningsBox = doc.querySelector('#deviceWarnings');
    const staleReason = reason || 'Patch/control changed';
    if (status && status.dataset.stale === 'true' && status.dataset.staleReason === staleReason) return;
    if (status) {
      status.dataset.stale = 'true';
      status.dataset.staleReason = staleReason;
      status.textContent = `${staleReason}. Press Run to recompute, or enable auto-run on edits.`;
    }
    if (warningsBox) {
      warningsBox.hidden = false;
      warningsBox.textContent = 'Trace may be stale because auto-run on edits is disabled.';
    }
  }

  function renderCoefficientControls(container, values) {
    if (!container) return;
    container.innerHTML = COEFFICIENT_IDS.map((id) => `
      <label class="coefficient-control" for="coef-${id}">
        <span>${id}</span>
        <input id="coef-${id}" name="${id}" type="range" min="0" max="1" step="0.001" value="${values[id].toFixed(3)}">
        <output data-coef-value="${id}">${values[id].toFixed(3)}</output>
      </label>
    `).join('');
  }

  function updateCoefficientReadouts(container) {
    if (!container) return;
    for (const input of Array.from(container.querySelectorAll('input[name]'))) {
      const output = container.querySelector(`[data-coef-value="${input.name}"]`);
      if (output) output.value = clampCoefficient(input.value).toFixed(3);
    }
  }

  function renderModeIndicators(doc, options, overloaded) {
    for (const node of Array.from(doc.querySelectorAll('[data-device-indicator]'))) {
      const key = node.getAttribute('data-device-indicator');
      let active = false;
      if (key === 'OL') active = Boolean(overloaded);
      else if (key === 'IC') active = options.mode === 'IC' || options.mode === 'REP' || options.mode === 'REPF';
      else if (key === 'OP') active = options.mode === 'OP' || options.mode === 'REP' || options.mode === 'REPF';
      else if (key === 'HALT') active = options.mode === 'HALT';
      else active = options.mode === key;
      node.dataset.active = active ? 'true' : 'false';
    }
  }

  function selectedOutputWarnings(patch, options) {
    const warnings = [];
    const routes = outputRouteStatus(patch);
    for (const channel of [options.scopeA, options.scopeB]) {
      if (!channel || channel === 'none') continue;
      const route = routes[channel];
      if (!route || !route.componentPresent) warnings.push(`Output ${channel} is not present in the active runtime patch yet. Wire a signal to the ${channel} jack first.`);
      else if (!route.wired) warnings.push(`Output ${channel} is currently unwired; the oscilloscope will show 0 until a signal is patched to ${route.inputSocket}.`);
    }
    return warnings;
  }


  function firstInputDriver(patch, inputSocket) {
    return patchConnections(patch).find((connection) => connection.to === inputSocket) || null;
  }

  function inputSocketIsWired(patch, inputSocket) {
    return Boolean(firstInputDriver(patch, inputSocket));
  }

  function selectedScopeChannels(options) {
    const raw = [options && options.scopeA, options && options.scopeB].filter((channel) => channel && channel !== 'none');
    return Array.from(new Set(raw.filter((channel) => OUTPUT_CHANNELS.includes(channel))));
  }

  function shortSocketName(socketId) {
    if (!socketId) return '';
    return String(socketId)
      .replace(/^PLUS1\.out$/, '+1')
      .replace(/^MINUS1\.out$/, '-1')
      .replace(/^OUT_([XYZU])\.in$/, '$1 input')
      .replace(/^OUT_([XYZU])\.out$/, '$1 output')
      .replace(/\.out$/, ' out')
      .replace(/\.in$/, ' in');
  }

  function selectedOutputSource(patch, channel) {
    const driver = firstInputDriver(patch, `${outputComponentId(channel)}.in`);
    return driver ? driver.from : null;
  }

  function coefficientIdFromOutputSocket(socketId) {
    const match = String(socketId || '').match(/^(P[1-8])\.out$/);
    return match ? match[1] : null;
  }

  function deviceWorkflowHints(patch, options, state = {}) {
    const hints = [];
    const controls = Object.assign({}, DEFAULTS, options || {});
    const connections = patchConnections(patch);
    const selectedChannels = selectedScopeChannels(controls);
    const add = (id, title, text, level = 'info') => {
      if (hints.some((hint) => hint.id === id)) return;
      hints.push({ id, title, text, level });
    };

    if (state.stale && !controls.autoRunChanges) {
      add('trace-stale', 'Trace is stale', `${state.reason || 'The wiring or controls changed'}. Press Run to recompute the oscilloscope trace.`, 'warning');
    }

    const physicalLimit = physicalOpTimeLimitMsForMode(controls.mode);
    if (physicalLimit && opTimeExceedsPhysicalLimit(controls)) {
      add('op-time-extended', 'Virtual OP-TIME exceeds physical range', `${controls.mode} OP-TIME is ${controls.opTimeMs} ms. Physical THAT stops at ${physicalLimit} ms, but the browser simulator will run the full virtual duration.`, 'info');
    }

    if (controls.mode === 'OFF') {
      add('mode-off', 'Mode is OFF', 'The virtual computer is stopped. Select OP, REP, or REPF before expecting a trace.', 'warning');
    } else if (controls.mode === 'COEFF') {
      add('mode-coeff', 'COEFF mode only sets potentiometers', 'Use COEFF to set P1–P8. Switch to OP, REP, or REPF and press Run to simulate.', 'info');
    } else if (controls.mode === 'MINION') {
      add('mode-minion', 'MINION is external-control mode', 'MINION is represented for completeness, but this browser simulator does not yet emulate a master THAT controlling it.', 'info');
    }

    if (connections.length === 0) {
      add('empty-panel', 'No wires on the panel', 'For a simple visible test: wire +1 to P1 input, wire P1 output to X, set CH1 to X, select OP, then press Run.', 'info');
    }

    const routes = outputRouteStatus(patch);
    for (const channel of selectedChannels) {
      const route = routes[channel];
      if (!route || !route.componentPresent || !route.wired) {
        add(`output-${channel}-open`, `${channel} output jack is open`, `CH${channel === controls.scopeA ? '1' : '2'} is watching ${channel}, but no signal is wired to the ${channel} output input jack; the trace will be zero.`, 'warning');
        continue;
      }
      const source = selectedOutputSource(patch, channel);
      const coefficientId = coefficientIdFromOutputSocket(source);
      if (coefficientId && !inputSocketIsWired(patch, `${coefficientId}.in`)) {
        add(`coefficient-${coefficientId}-input-open`, `${coefficientId} output has no input signal`, `${shortSocketName(source)} feeds ${channel}, but ${coefficientId} input is open. A coefficient potentiometer scales its input; wire +1, -1, or another signal into ${coefficientId} input first.`, 'warning');
      }
    }

    const anyOutputWired = OUTPUT_CHANNELS.some((channel) => routes[channel] && routes[channel].wired);
    if (connections.length > 0 && !anyOutputWired) {
      add('no-observed-output', 'Nothing is routed to X/Y/Z/U', 'The virtual oscilloscope only reads the physical X, Y, Z, and U output jacks. Wire a computed signal to one of those jacks.', 'warning');
    }

    if (!hints.length) {
      add('ready', 'Ready to run', 'After changing wires or controls, press Run. The scope reads only the selected physical output jacks X/Y/Z/U.', 'ok');
    }
    return hints.slice(0, 4);
  }

  function renderWorkflowHintsHtml(hints) {
    return (hints || []).map((hint) => `
      <article class="workflow-hint" data-hint-id="${escapeText(hint.id)}" data-level="${escapeText(hint.level || 'info')}">
        <strong>${escapeText(hint.title)}</strong>
        <span>${escapeText(hint.text)}</span>
      </article>
    `).join('');
  }

  function renderWorkflowHints(doc, patch, options, state = {}) {
    const node = doc.querySelector('#workflowHints');
    if (!node) return [];
    const hints = deviceWorkflowHints(patch, options, state);
    node.innerHTML = renderWorkflowHintsHtml(hints);
    node.hidden = hints.length === 0;
    return hints;
  }

  function renderScopeLegendHtml(seriesList, trace) {
    return seriesList.map((series) => {
      const stats = trace ? traceSeriesStats(trace, series) : null;
      const constantText = stats && stats.constant ? ` <small>constant ${stats.constantValue.toFixed(3)}</small>` : '';
      return `<span class="${escapeText(series.cssClass || '')}" style="color: ${escapeText(series.color || '#76ff7a')}" data-scope-channel="${escapeText(series.channel)}" data-scope-output="${escapeText(series.output)}"><strong>${escapeText(series.channel)}</strong> ${escapeText(series.output)}${constantText}</span>`;
    }).join('');
  }

  function outputPortStatusHtml(patch, options) {
    const routes = outputRouteStatus(patch);
    const selected = { [options.scopeA]: ['CH1'], [options.scopeB]: ['CH2'] };
    if (options.scopeA && options.scopeB && options.scopeA === options.scopeB) selected[options.scopeA] = ['CH1', 'CH2'];
    return OUTPUT_CHANNELS.map((channel) => {
      const route = routes[channel] || {};
      const labels = selected[channel] || [];
      const wiredText = route.wired ? 'patched' : 'open';
      const selectedText = labels.length ? ` · ${labels.join('+')}` : '';
      const selectedAttr = labels.length ? labels.join(' ') : '';
      return `<span class="output-port-pill" data-output-port="${channel}" data-wired="${route.wired ? 'true' : 'false'}" data-selected-channel="${escapeText(selectedAttr)}"><strong>${channel}</strong> ${wiredText}${selectedText}</span>`;
    }).join('');
  }

  function renderOutputPortStatus(doc, patch, options) {
    const node = doc.querySelector('#outputPortStatus');
    if (!node) return;
    node.innerHTML = outputPortStatusHtml(patch, options);
  }

  function renderOpTimeRangeHint(doc, options) {
    const field = doc.querySelector('#opTimeMs');
    const hint = doc.querySelector('#opTimeLimitHint');
    const controls = Object.assign({}, DEFAULTS, options || {});
    if (field) {
      field.removeAttribute('max');
      field.setAttribute('aria-describedby', 'opTimeLimitHint');
    }
    if (hint) {
      hint.textContent = physicalOpTimeLimitLabel(controls.mode);
      hint.dataset.extended = opTimeExceedsPhysicalLimit(controls) ? 'true' : 'false';
    }
  }

  function progressPercentValue(progress) {
    const percent = progress && Number.isFinite(progress.percent) ? progress.percent : 0;
    return Math.round(clamp(percent, 0, 1) * 100);
  }

  function formatSimulationProgress(progress) {
    if (!progress) return 'Simulation has not started.';
    const percent = progressPercentValue(progress);
    const phase = progress.phase === 'complete' ? 'complete' : (progress.phase === 'stopping' ? 'stopping' : 'running');
    const cycleText = progress.cycles && progress.cycles > 1 ? ` · cycle ${progress.cycle || 1}/${progress.cycles}` : '';
    const stepText = progress.totalSteps ? ` · step ${progress.currentStep}/${progress.totalSteps}` : '';
    const sampleText = ` · ${progress.sampleCount || 0} samples`;
    return `${progress.mode || 'simulation'}: ${phase} ${percent}%${cycleText}${stepText}${sampleText}`;
  }

  function renderSimulationProgress(doc, progress, options = {}) {
    const panel = doc.querySelector('#simulationProgressPanel');
    const bar = doc.querySelector('#simulationProgress');
    const label = doc.querySelector('#simulationProgressText');
    const percentNode = doc.querySelector('#simulationProgressPercent');
    if (!panel && !bar && !label && !percentNode) return;
    const percent = progressPercentValue(progress);
    const phase = options.phase || (progress && progress.phase) || 'running';
    const message = options.message || formatSimulationProgress(Object.assign({}, progress || {}, { phase }));
    if (panel) {
      panel.hidden = false;
      panel.dataset.running = phase === 'running' || phase === 'starting' || phase === 'stopping' ? 'true' : 'false';
      panel.dataset.phase = phase;
    }
    if (bar) {
      bar.value = percent;
      bar.setAttribute('aria-valuenow', String(percent));
    }
    if (label) label.textContent = message;
    if (percentNode) percentNode.textContent = `${percent}%`;
  }

  function clearSimulationProgress(doc, message = 'No simulation is running.') {
    const panel = doc.querySelector('#simulationProgressPanel');
    const bar = doc.querySelector('#simulationProgress');
    const label = doc.querySelector('#simulationProgressText');
    const percentNode = doc.querySelector('#simulationProgressPercent');
    if (panel) {
      panel.hidden = false;
      panel.dataset.running = 'false';
      panel.dataset.phase = 'idle';
    }
    if (bar) {
      bar.value = 0;
      bar.setAttribute('aria-valuenow', '0');
    }
    if (label) label.textContent = message;
    if (percentNode) percentNode.textContent = '0%';
  }

  function createAbortControllerLike() {
    if (typeof AbortController !== 'undefined') return new AbortController();
    const signal = { aborted: false, reason: null };
    return {
      signal,
      abort(reason) {
        signal.aborted = true;
        signal.reason = reason || 'Simulation stopped';
      },
    };
  }

  function isAbortError(error) {
    return Boolean(error && (error.name === 'AbortError' || error.code === 'SIMULATION_ABORTED'));
  }

  function setRunControlsBusy(runButton, stopButton, isRunning) {
    if (runButton) {
      runButton.disabled = isRunning;
      runButton.textContent = isRunning ? 'Running…' : 'Run';
    }
    if (stopButton) {
      stopButton.disabled = false;
      stopButton.textContent = isRunning ? 'Stop' : 'Halt';
    }
  }

  function initDeviceWorkbenchApp(rootDocument, dependencies = {}) {
    const doc = rootDocument || document;
    const patchEditor = dependencies.patchEditor || globalScope.AnalogThingPatchEditorInstance;
    const runtime = dependencies.runtime || globalScope.AnalogThingBrowserPatchRuntime;
    const coefficientsContainer = doc.querySelector('#coefficientControls');
    const canvas = doc.querySelector('#traceCanvas');
    const status = doc.querySelector('#statusText');
    const summaryPre = doc.querySelector('#traceSummary');
    const runButton = doc.querySelector('#runDevice');
    const stopButton = doc.querySelector('#stopDevice');
    const resetButton = doc.querySelector('#resetDevice');
    const exportButton = doc.querySelector('#exportJson');
    const form = doc.querySelector('#controls');
    const warningsBox = doc.querySelector('#deviceWarnings');
    const legend = doc.querySelector('#scopeLegend');
    const workflowHints = doc.querySelector('#workflowHints');
    if (!patchEditor || !runtime || !canvas) return null;
    initWorkbenchLayoutControls(doc);

    let lastPayload = null;
    let lastPayloadStale = false;
    let stopped = false;
    let activeRunController = null;
    let activeRunId = 0;
    let latestProgress = null;

    function patch() { return patchEditor.getPatch ? patchEditor.getPatch() : null; }

    function syncCoefficientControlsFromPatch() {
      const values = readCoefficientMap(patch());
      renderCoefficientControls(coefficientsContainer, values);
    }

    function updatePatchCoefficient(id, value, updateOptions = {}) {
      const coefficient = clampCoefficient(value, 0.5);
      if (typeof patchEditor.updatePatchCoefficient === 'function') {
        patchEditor.updatePatchCoefficient(id, coefficient, {
          syncEditors: Boolean(updateOptions.syncEditors),
          emitPatchChanged: Boolean(updateOptions.emitPatchChanged),
          renderOptions: { coefficientOnly: true },
        });
      } else {
        const next = setComponentCoefficient(patch(), id, coefficient);
        patchEditor.replacePatch(next, { skipTemplateRender: true });
      }
      updateCoefficientReadouts(coefficientsContainer);
    }

    function coefficientEditChanged(id, value, updateOptions = {}) {
      updatePatchCoefficient(id, value, updateOptions);
      renderOutputPortStatus(doc, patch(), readControls(doc));
      if (updateOptions.autoRunOnCommit && !stopped && autoRunEnabled(doc)) run();
      else {
        lastPayloadStale = true;
        markTraceStale(doc, 'Coefficient changed');
        renderWorkflowHints(doc, patch(), readControls(doc), { stale: true, reason: 'Coefficient changed' });
      }
    }


    function renderCompletedPayload(payload, currentPatch, executablePatch, options, warnings, statusPrefix = null) {
      if (options.mode === 'REP') payload.result.mode = 'REP';
      const seriesList = traceScopeSeries(payload.result.trace, options);
      const names = seriesList.map((series) => series.output);
      if (options.scopeMode === 'xy' && seriesList.length >= 2) drawXyScope(canvas, payload.result.trace, seriesList[0], seriesList[1]);
      else drawTimeScope(canvas, payload.result.trace, seriesList);
      const summary = summarizeTrace(payload.result, names);
      summary.displayedSeries = seriesList.map((series) => ({ channel: series.channel, output: series.output, color: series.color }));
      const allWarnings = warnings.concat(summary.overload ? ['Overload detected: at least one simulated signal exceeded ±1 machine unit.'] : []);
      if (legend) legend.innerHTML = renderScopeLegendHtml(seriesList, payload.result.trace);
      if (warningsBox) {
        warningsBox.hidden = allWarnings.length === 0;
        warningsBox.textContent = allWarnings.join('\n');
      }
      const effectiveOptions = payload.result || {};
      const precisionLabel = SIMULATION_PRECISION_PRESETS[options.simulationPrecision] ? SIMULATION_PRECISION_PRESETS[options.simulationPrecision].label : options.simulationPrecision;
      const prefix = statusPrefix || options.mode;
      setText(status, `${prefix}: ${summary.sampleCount} samples · ${summary.triggerCount} trigger${summary.triggerCount === 1 ? '' : 's'} · precision: ${precisionLabel} · dt ${effectiveOptions.dt} · sample every ${effectiveOptions.sampleEvery} · overload: ${summary.overload ? 'yes' : 'no'}`);
      if (status) {
        status.dataset.overload = summary.overload ? 'true' : 'false';
        status.dataset.running = 'false';
      }
      renderModeIndicators(doc, options, summary.overload);
      lastPayload = { name: currentPatch.name || 'THAT device-workbench trace', generatedAt: new Date().toISOString(), deviceOptions: options, effectiveRuntimeOptions: runtimeOptions(options), outputRouteStatus: outputRouteStatus(currentPatch), result: payload.result, summary, patch: executablePatch };
      if (summaryPre) summaryPre.textContent = JSON.stringify(summary, null, 2);
      return lastPayload;
    }

    async function run() {
      const runId = activeRunId + 1;
      activeRunId = runId;
      if (activeRunController && activeRunController.signal && !activeRunController.signal.aborted) activeRunController.abort('Superseded by a newer run');
      activeRunController = createAbortControllerLike();
      latestProgress = null;
      stopped = false;
      lastPayloadStale = false;
      if (status) {
        status.dataset.stale = 'false';
        status.dataset.running = 'false';
        delete status.dataset.staleReason;
      }
      const options = readControls(doc);
      const currentPatch = patch();
      renderOutputPortStatus(doc, currentPatch, options);
      renderWorkflowHints(doc, currentPatch, options, { stale: false });
      const warnings = selectedOutputWarnings(currentPatch, options).concat(runtimeControlWarnings(options));
      if (options.mode === 'OFF') {
        drawEmptyScope(canvas, 'OFF: computation stopped.');
        setText(status, 'OFF: virtual computer is stopped.');
        clearSimulationProgress(doc, 'OFF: no simulation is running.');
        renderModeIndicators(doc, options, false);
        if (summaryPre) summaryPre.textContent = JSON.stringify({ mode: options.mode }, null, 2);
        return null;
      }
      if (options.mode === 'COEFF') {
        drawEmptyScope(canvas, 'COEFF: set P1–P8; patch is not running.');
        setText(status, 'COEFF: adjust the coefficient potentiometers.');
        clearSimulationProgress(doc, 'COEFF: no simulation is running.');
        renderModeIndicators(doc, options, false);
        if (summaryPre) summaryPre.textContent = JSON.stringify({ mode: options.mode, coefficients: readCoefficientMap(currentPatch) }, null, 2);
        return null;
      }
      if (options.mode === 'MINION') {
        drawEmptyScope(canvas, 'MINION mode awaits external master control.');
        setText(status, 'MINION: external master control is represented but not simulated yet.');
        clearSimulationProgress(doc, 'MINION: no local simulation is running.');
        renderModeIndicators(doc, options, false);
        if (summaryPre) summaryPre.textContent = JSON.stringify({ mode: options.mode, simulated: false }, null, 2);
        return null;
      }
      let executablePatch = null;
      try {
        setRunControlsBusy(runButton, stopButton, true);
        if (status) status.dataset.running = 'true';
        renderSimulationProgress(doc, { mode: options.mode, phase: 'starting', percent: 0, currentStep: 0, totalSteps: 0, sampleCount: 0 }, { phase: 'starting', message: `${options.mode}: preparing simulation…` });
        executablePatch = runtimePatchWithSelectedOutputs(currentPatch, options);
        const effectiveRuntimeOptions = Object.assign({}, runtimeOptions(options), {
          signal: activeRunController.signal,
          yieldEvery: 200,
          onProgress(progress) {
            if (runId !== activeRunId) return;
            latestProgress = progress;
            renderSimulationProgress(doc, progress);
            setText(status, formatSimulationProgress(progress));
          },
        });
        const runner = typeof runtime.runSerializedPatchAsync === 'function'
          ? runtime.runSerializedPatchAsync.bind(runtime)
          : (patchToRun, runOptions) => Promise.resolve(runtime.runSerializedPatch(patchToRun, runOptions));
        const payload = await runner(executablePatch, effectiveRuntimeOptions);
        if (runId !== activeRunId) return null;
        renderSimulationProgress(doc, Object.assign({}, latestProgress || {}, { mode: options.mode, phase: 'complete', percent: 1 }), { phase: 'complete' });
        return renderCompletedPayload(payload, currentPatch, executablePatch, options, warnings);
      } catch (error) {
        if (runId !== activeRunId && isAbortError(error)) return null;
        if (isAbortError(error)) {
          stopped = true;
          const partialPayload = error.partialPayload;
          const haltedOptions = Object.assign({}, options, { mode: 'HALT' });
          renderModeIndicators(doc, haltedOptions, false);
          renderWorkflowHints(doc, patch(), haltedOptions, { stale: lastPayloadStale, reason: 'Simulation stopped' });
          renderSimulationProgress(doc, Object.assign({}, latestProgress || (error.progress || {}), { phase: 'stopping' }), { phase: 'stopping', message: 'HALT: simulation stopped by user.' });
          if (partialPayload && partialPayload.result && partialPayload.result.trace && partialPayload.result.trace.length) {
            return renderCompletedPayload(partialPayload, currentPatch, executablePatch || currentPatch, haltedOptions, warnings, 'HALT stopped partial trace');
          }
          setText(status, 'HALT: simulation stopped before a trace was produced.');
          if (summaryPre) summaryPre.textContent = JSON.stringify({ stopped: true, error: error.message }, null, 2);
          return null;
        }
        drawEmptyScope(canvas, 'Patch cannot run. Check wiring and diagnostics.');
        setText(status, `Cannot run patch: ${error.message}`);
        clearSimulationProgress(doc, 'Simulation failed before completion.');
        if (status) {
          status.dataset.overload = 'true';
          status.dataset.running = 'false';
        }
        renderModeIndicators(doc, options, true);
        if (warningsBox) { warningsBox.hidden = false; warningsBox.textContent = error.message; }
        if (summaryPre) summaryPre.textContent = JSON.stringify({ error: error.message }, null, 2);
        return null;
      } finally {
        if (runId === activeRunId) {
          setRunControlsBusy(runButton, stopButton, false);
          if (status) status.dataset.running = 'false';
        }
      }
    }

    function stop() {
      stopped = true;
      if (activeRunController && activeRunController.signal && !activeRunController.signal.aborted && status && status.dataset.running === 'true') {
        activeRunController.abort('Stopped by user');
        const progress = Object.assign({}, latestProgress || {}, { phase: 'stopping' });
        renderSimulationProgress(doc, progress, { phase: 'stopping', message: 'Stopping simulation…' });
        setText(status, 'Stopping simulation… partial trace will remain visible when the current chunk finishes.');
        renderModeIndicators(doc, Object.assign({}, readControls(doc), { mode: 'HALT' }), false);
        return;
      }
      const options = Object.assign({}, readControls(doc), { mode: 'HALT' });
      renderModeIndicators(doc, options, false);
      setText(status, 'HALT: display frozen. Use Run to recompute from the current patch.');
      clearSimulationProgress(doc, 'HALT: no simulation is running.');
      renderWorkflowHints(doc, patch(), options, { stale: lastPayloadStale, reason: 'Display frozen' });
    }

    function reset() {
      const modeField = doc.querySelector('#mode');
      if (modeField) modeField.value = 'IC';
      run();
    }

    applyDeviceControlsToForm(doc, readPatchDeviceControls(patch()));
    renderOpTimeRangeHint(doc, readControls(doc));
    syncCoefficientControlsFromPatch();
    if (coefficientsContainer) {
      coefficientsContainer.addEventListener('input', (event) => {
        if (event.target && event.target.matches('input[name]')) {
          coefficientEditChanged(event.target.name, event.target.value, { syncEditors: false, emitPatchChanged: false, autoRunOnCommit: false });
        }
      });
      coefficientsContainer.addEventListener('change', (event) => {
        if (event.target && event.target.matches('input[name]')) {
          coefficientEditChanged(event.target.name, event.target.value, { syncEditors: true, emitPatchChanged: false, autoRunOnCommit: true });
        }
      });
    }
    doc.addEventListener('analogthing:patchchanged', (event) => {
      const detail = (event && event.detail) || {};
      const renderOptions = detail.renderOptions || {};
      if (renderOptions.applyDeviceControls || renderOptions.reason === 'template-load') {
        applyDeviceControlsToForm(doc, readPatchDeviceControls(detail.patch || patch()));
      }
      syncCoefficientControlsFromPatch();
      renderOutputPortStatus(doc, patch(), readControls(doc));
      if (!stopped && autoRunEnabled(doc)) run();
      else {
        lastPayloadStale = true;
        const staleReason = renderOptions.reason === 'template-load' ? 'Predefined patch loaded' : 'Patch wiring or coefficient changed';
        markTraceStale(doc, staleReason);
        renderWorkflowHints(doc, patch(), readControls(doc), { stale: true, reason: staleReason });
      }
    });
    if (form) {
      form.addEventListener('submit', (event) => { event.preventDefault(); run(); });
      form.addEventListener('input', (event) => {
        if (event.target && event.target.closest('#coefficientControls')) return;
        if (targetIsAutoRunToggle(event)) return;
        if (stopped) return;
        renderOpTimeRangeHint(doc, readControls(doc));
        if (autoRunEnabled(doc)) run();
        else { const currentOptions = readControls(doc); renderOutputPortStatus(doc, patch(), currentOptions); lastPayloadStale = true; markTraceStale(doc, 'Device control changed'); renderWorkflowHints(doc, patch(), currentOptions, { stale: true, reason: 'Device control changed' }); }
      });
      form.addEventListener('change', (event) => {
        if (event.target && event.target.closest('#coefficientControls')) return;
        if (stopped) return;
        if (targetIsAutoRunToggle(event)) {
          if (autoRunEnabled(doc)) run();
          else { const currentOptions = readControls(doc); renderOutputPortStatus(doc, patch(), currentOptions); lastPayloadStale = true; markTraceStale(doc, 'Auto-run on edits disabled'); renderWorkflowHints(doc, patch(), currentOptions, { stale: true, reason: 'Auto-run on edits disabled' }); }
          return;
        }
        renderOpTimeRangeHint(doc, readControls(doc));
        if (autoRunEnabled(doc)) run();
        else { const currentOptions = readControls(doc); renderOutputPortStatus(doc, patch(), currentOptions); lastPayloadStale = true; markTraceStale(doc, 'Device control changed'); renderWorkflowHints(doc, patch(), currentOptions, { stale: true, reason: 'Device control changed' }); }
      });
    }
    if (runButton) runButton.addEventListener('click', () => { run(); });
    if (stopButton) stopButton.addEventListener('click', stop);
    if (resetButton) resetButton.addEventListener('click', reset);
    if (exportButton) exportButton.addEventListener('click', async () => {
      if (!lastPayload || lastPayloadStale) await run();
      if (lastPayload) downloadJson(lastPayload, 'that_device_workbench_trace.json');
    });

    run();
    return {
      run,
      stop,
      reset,
      syncCoefficientControlsFromPatch,
      getLastPayload: () => lastPayload,
      readControls: () => readControls(doc),
    };
  }

  const api = {
    MODES,
    OUTPUT_CHANNELS,
    COEFFICIENT_IDS,
    SCOPE_CHANNEL_STYLES,
    DEFAULTS,
    SIMULATION_PRECISION_PRESETS,
    PHYSICAL_OP_TIME_LIMIT_MS,
    physicalOpTimeLimitMsForMode,
    physicalOpTimeLimitLabel,
    opTimeExceedsPhysicalLimit,
    normalizeSimulationPrecision,
    precisionAdjustedRuntimeSettings,
    readCoefficientMap,
    setComponentCoefficient,
    runtimePatchWithSelectedOutputs,
    expandRuntimePatchToFullBoard,
    runtimeOptions,
    outputRouteStatus,
    inferTemplateIdFromPatch,
    readPatchDeviceControls,
    applyDeviceControlsToForm,
    applyWorkbenchLayout,
    initWorkbenchLayoutControls,
    autoRunEnabled,
    markTraceStale,
    requestedScopeSeries,
    traceScopeSeries,
    traceOutputNames,
    traceSeriesStats,
    renderScopeLegendHtml,
    outputPortStatusHtml,
    renderOutputPortStatus,
    renderOpTimeRangeHint,
    runtimeControlWarnings,
    progressPercentValue,
    formatSimulationProgress,
    renderSimulationProgress,
    clearSimulationProgress,
    isAbortError,
    firstInputDriver,
    inputSocketIsWired,
    selectedScopeChannels,
    selectedOutputSource,
    coefficientIdFromOutputSocket,
    deviceWorkflowHints,
    renderWorkflowHintsHtml,
    renderWorkflowHints,
    summarizeTrace,
    initDeviceWorkbenchApp,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDeviceWorkbenchApp = api;
}(typeof window !== 'undefined' ? window : global));
