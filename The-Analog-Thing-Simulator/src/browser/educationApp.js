/* global window, document */
'use strict';

(function attachEducationApp(globalScope) {
  const MACHINE_MIN = -1;
  const MACHINE_MAX = 1;
  const PANEL_VOLTS_PER_MACHINE_UNIT = 10;
  const RCA_VOLTS_PER_MACHINE_UNIT = 1;
  const HYBRID_SHIFT_CENTER_VOLTS = 1.64;
  const HYBRID_SHIFT_SPAN_VOLTS = 1;

  const MACHINE_UNIT_ROWS = Object.freeze([
    Object.freeze({ label: '-1 machine unit', machineUnit: -1, meaning: 'negative full-scale analog value' }),
    Object.freeze({ label: '0 machine units', machineUnit: 0, meaning: 'ground / zero term' }),
    Object.freeze({ label: '+1 machine unit', machineUnit: 1, meaning: 'positive full-scale analog value' }),
  ]);

  const COEFFICIENT_STEPS = Object.freeze([
    Object.freeze({ id: 'coeff-mode', title: 'Enter COEFF mode', text: 'Use coefficient setup as a safe preparation state before OP/REPF. In the simulator, this is represented by editing potentiometer coefficients while the patch is not integrating.' }),
    Object.freeze({ id: 'select-pot', title: 'Select a coefficient potentiometer', text: 'Choose the potentiometer used by the patch term, such as P1 for spring k, P2 for damping d, or P3 for inverse mass 1/m.' }),
    Object.freeze({ id: 'set-0-1', title: 'Set a 0…1 value', text: 'THAT coefficient potentiometers scale by a non-negative factor from 0 to 1. Negative signs are produced by summers and inverters, not by the potentiometer.' }),
    Object.freeze({ id: 'check-scale', title: 'Check scale before OP', text: 'Run IC/HALT or a short OP preview and keep all relevant outputs inside ±1 machine unit to avoid overload.' }),
  ]);

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeText(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function finiteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clampMachineUnit(value) {
    const numeric = finiteNumber(value, 0);
    if (numeric < MACHINE_MIN) return MACHINE_MIN;
    if (numeric > MACHINE_MAX) return MACHINE_MAX;
    return numeric;
  }

  function toPanelVolts(machineUnit) {
    return finiteNumber(machineUnit, 0) * PANEL_VOLTS_PER_MACHINE_UNIT;
  }

  function toRcaVolts(machineUnit) {
    return finiteNumber(machineUnit, 0) * RCA_VOLTS_PER_MACHINE_UNIT;
  }

  function toShiftedHybridVolts(machineUnit) {
    return HYBRID_SHIFT_CENTER_VOLTS + HYBRID_SHIFT_SPAN_VOLTS * finiteNumber(machineUnit, 0);
  }

  function scaleMachineUnit(value) {
    const machineUnit = finiteNumber(value, 0);
    const clippedMachineUnit = clampMachineUnit(machineUnit);
    const overloaded = machineUnit < MACHINE_MIN || machineUnit > MACHINE_MAX;
    return {
      machineUnit,
      panelVolts: toPanelVolts(machineUnit),
      rcaVolts: toRcaVolts(machineUnit),
      shiftedHybridVolts: toShiftedHybridVolts(machineUnit),
      overloaded,
      clippedMachineUnit,
      clippedPanelVolts: toPanelVolts(clippedMachineUnit),
      clippedRcaVolts: toRcaVolts(clippedMachineUnit),
      clippedShiftedHybridVolts: toShiftedHybridVolts(clippedMachineUnit),
    };
  }

  function formatNumber(value, digits = 3) {
    const numeric = finiteNumber(value, 0);
    const rounded = numeric.toFixed(digits);
    return rounded.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }

  function describeMachineUnit(value) {
    const scaled = scaleMachineUnit(value);
    const sign = scaled.machineUnit > 0 ? 'positive' : scaled.machineUnit < 0 ? 'negative' : 'zero';
    return Object.assign({}, scaled, {
      sign,
      label: `${formatNumber(scaled.machineUnit)} machine unit${Math.abs(scaled.machineUnit) === 1 ? '' : 's'}`,
      panelLabel: `${formatNumber(scaled.panelVolts)} V at the panel scale`,
      rcaLabel: `${formatNumber(scaled.rcaVolts)} V at the RCA output scale`,
      hybridLabel: `${formatNumber(scaled.shiftedHybridVolts)} V on the shifted hybrid scale`,
      warning: scaled.overloaded ? 'outside ±1 machine unit; educational results should be treated as overloaded' : 'inside the normal ±1 machine-unit range',
    });
  }

  function machineUnitGuideRows(values = MACHINE_UNIT_ROWS.map((row) => row.machineUnit)) {
    return values.map((value) => {
      const scaled = describeMachineUnit(value && value.machineUnit !== undefined ? value.machineUnit : value);
      return Object.assign({
        label: value && value.label ? value.label : scaled.label,
        meaning: value && value.meaning ? value.meaning : scaled.warning,
      }, scaled);
    });
  }

  function outputDetailsFromTracePoint(point) {
    if (!point || typeof point !== 'object') return {};
    if (point.outputDetails) return point.outputDetails;
    const details = {};
    for (const [name, value] of Object.entries(point.outputs || {})) {
      const scaled = scaleMachineUnit(value);
      details[name] = Object.assign({ socket: null }, scaled);
    }
    return details;
  }

  function overloadSummaryFromTrace(trace = []) {
    const overloadedSamples = [];
    const overloadedSockets = new Set();
    let peakAbsMachineUnit = 0;
    for (const point of trace || []) {
      const details = outputDetailsFromTracePoint(point);
      let sampleOverloaded = false;
      for (const [name, detail] of Object.entries(details)) {
        const machineUnit = detail && detail.machineUnit !== undefined ? detail.machineUnit : 0;
        peakAbsMachineUnit = Math.max(peakAbsMachineUnit, Math.abs(machineUnit));
        if ((detail && detail.overloaded) || Math.abs(machineUnit) > 1) {
          sampleOverloaded = true;
          overloadedSockets.add(detail.socket || name);
        }
      }
      if (sampleOverloaded) overloadedSamples.push({ t: point.t || 0, cycle: point.cycle, mode: point.mode, outputs: clonePlain(point.outputs || {}) });
    }
    return {
      sampleCount: (trace || []).length,
      overloaded: overloadedSamples.length > 0,
      overloadedSampleCount: overloadedSamples.length,
      overloadedSockets: Array.from(overloadedSockets).sort(),
      peakAbsMachineUnit,
      recommendation: overloadedSamples.length > 0
        ? 'Reduce coefficients, initial conditions, or run time; clipping can make the display safer but hides the mathematical overload.'
        : 'No output overload was detected in the sampled trace.',
      firstOverload: overloadedSamples[0] || null,
    };
  }

  function coefficientSetupRows(patchOrComponents) {
    const components = Array.isArray(patchOrComponents) ? patchOrComponents : ((patchOrComponents && patchOrComponents.components) || []);
    return components
      .filter((component) => component && component.id && component.coefficient !== undefined)
      .map((component) => ({
        id: component.id,
        label: component.label || component.id,
        coefficient: finiteNumber(component.coefficient, 0),
        percent: finiteNumber(component.coefficient, 0) * 100,
        setupHint: `${component.id}: set coefficient to ${formatNumber(component.coefficient, 2)} (${formatNumber(finiteNumber(component.coefficient, 0) * 100, 0)}%).`,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  function coefficientSetupGuide(patchOrComponents) {
    const rows = coefficientSetupRows(patchOrComponents);
    return {
      mode: 'COEFF',
      stepCount: COEFFICIENT_STEPS.length,
      steps: COEFFICIENT_STEPS.map(clonePlain),
      coefficientCount: rows.length,
      coefficients: rows,
      reminder: 'Coefficients are unsigned 0…1 scale factors. Use inverters and negating summers for signs.',
    };
  }

  function summarizeHybridFrame(frame = {}) {
    const rows = [];
    for (const name of ['x', 'y', 'z', 'u']) {
      const detail = frame[name];
      if (!detail) continue;
      const machineUnit = detail.machineUnit !== undefined ? detail.machineUnit : (detail.shiftedVolts !== undefined ? (detail.shiftedVolts - HYBRID_SHIFT_CENTER_VOLTS) / HYBRID_SHIFT_SPAN_VOLTS : detail);
      const scaled = describeMachineUnit(machineUnit);
      rows.push({ signal: name, socket: detail.socket || null, machineUnit: scaled.machineUnit, panelVolts: scaled.panelVolts, rcaVolts: scaled.rcaVolts, shiftedHybridVolts: scaled.shiftedHybridVolts, overloaded: scaled.overloaded });
    }
    return {
      signalCount: rows.length,
      rows,
      controlNote: 'Hybrid control pins map to IC, OP, and HALT in the simulator; analog signals are reported as machine units plus physical-scale voltages.',
    };
  }

  function summarizeMultiBoardDefinition(definition = {}) {
    const boards = Array.isArray(definition.boards) ? definition.boards : [];
    const interBoardLinks = Array.isArray(definition.interBoardLinks) ? definition.interBoardLinks : (Array.isArray(definition.links) ? definition.links : []);
    return {
      boardCount: boards.length,
      boards: boards.map((board) => ({ id: board.id, role: board.role || 'board', componentCount: ((board.patch && board.patch.components) || board.components || []).length })),
      interBoardLinkCount: interBoardLinks.length,
      interBoardLinks: interBoardLinks.map((link) => `${link.from} -> ${link.to}`),
      inspectionHint: 'Namespaced board sockets let master/minion patches reuse ordinary THAT blocks while still showing cross-board wiring explicitly.',
    };
  }

  function buildEducationSummary(options = {}) {
    const trace = options.trace || [];
    const patch = options.patch || null;
    const hybridFrame = options.hybridFrame || null;
    const multiBoardDefinition = options.multiBoardDefinition || null;
    return {
      machineUnits: machineUnitGuideRows([-1, -0.5, 0, 0.5, 1, 1.2]),
      overload: overloadSummaryFromTrace(trace),
      coefficientSetup: coefficientSetupGuide(patch || []),
      hybrid: hybridFrame ? summarizeHybridFrame(hybridFrame) : null,
      multiboard: multiBoardDefinition ? summarizeMultiBoardDefinition(multiBoardDefinition) : null,
    };
  }

  function htmlTable(headers, rows) {
    return `<table class="education-table"><thead><tr>${headers.map((header) => `<th>${escapeText(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeText(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function renderMachineUnitGuide(container, rows = machineUnitGuideRows([-1, -0.5, 0, 0.5, 1])) {
    if (!container) return;
    container.innerHTML = htmlTable(
      ['machine unit', 'panel volts', 'RCA volts', 'hybrid volts', 'status'],
      rows.map((row) => [formatNumber(row.machineUnit), formatNumber(row.panelVolts), formatNumber(row.rcaVolts), formatNumber(row.shiftedHybridVolts), row.warning]),
    );
  }

  function renderCoefficientGuide(container, guide) {
    if (!container) return;
    const data = guide || coefficientSetupGuide([]);
    const coefficientRows = data.coefficients.length
      ? htmlTable(['pot', 'coefficient', 'setup hint'], data.coefficients.map((row) => [row.id, formatNumber(row.coefficient, 2), row.setupHint]))
      : '<p class="muted">No coefficient potentiometers were found in the current patch.</p>';
    container.innerHTML = `<ol>${data.steps.map((step) => `<li><strong>${escapeText(step.title)}</strong>: ${escapeText(step.text)}</li>`).join('')}</ol>${coefficientRows}`;
  }

  function renderOverloadGuide(container, summary) {
    if (!container) return;
    const data = summary || overloadSummaryFromTrace([]);
    container.dataset.overload = data.overloaded ? 'true' : 'false';
    container.innerHTML = `<p><strong>Status:</strong> ${escapeText(data.overloaded ? 'overload detected' : 'inside sampled range')}</p><p>${escapeText(data.recommendation)}</p><pre>${escapeText(JSON.stringify(data, null, 2))}</pre>`;
  }

  function renderInspectionGuide(container, summary) {
    if (!container) return;
    const data = summary || {};
    container.innerHTML = `<pre>${escapeText(JSON.stringify(data, null, 2))}</pre>`;
  }

  function currentPatchFromWindow() {
    const instance = globalScope.AnalogThingPatchEditorInstance;
    if (instance && typeof instance.getPatch === 'function') return instance.getPatch();
    return null;
  }

  function currentTraceFromWindow() {
    const app = globalScope.AnalogThingOscilloscopeApp;
    if (app && app.lastResult && Array.isArray(app.lastResult.trace)) return app.lastResult.trace;
    return [];
  }

  function initEducationApp(rootDocument, options = {}) {
    const doc = rootDocument || document;
    const machineUnits = doc.querySelector('#machineUnitGuide');
    const coefficients = doc.querySelector('#coefficientSetupGuide');
    const overload = doc.querySelector('#overloadGuide');
    const inspection = doc.querySelector('#inspectionGuide');
    const refreshButton = doc.querySelector('#refreshEducationPanels');

    function refresh(context = {}) {
      const patch = context.patch || (options.getPatch && options.getPatch()) || currentPatchFromWindow();
      const trace = context.trace || (options.getTrace && options.getTrace()) || currentTraceFromWindow();
      const hybridFrame = context.hybridFrame || (options.getHybridFrame && options.getHybridFrame()) || null;
      const multiboard = context.multiBoardDefinition || (options.getMultiBoardDefinition && options.getMultiBoardDefinition()) || null;
      const summary = buildEducationSummary({ patch, trace, hybridFrame, multiBoardDefinition: multiboard });
      renderMachineUnitGuide(machineUnits, summary.machineUnits);
      renderCoefficientGuide(coefficients, summary.coefficientSetup);
      renderOverloadGuide(overload, summary.overload);
      renderInspectionGuide(inspection, { hybrid: summary.hybrid, multiboard: summary.multiboard });
      return summary;
    }

    if (refreshButton) refreshButton.addEventListener('click', () => refresh());
    const initialSummary = refresh(options.initialContext || {});
    return { refresh, initialSummary };
  }

  const api = {
    MACHINE_MIN,
    MACHINE_MAX,
    PANEL_VOLTS_PER_MACHINE_UNIT,
    RCA_VOLTS_PER_MACHINE_UNIT,
    HYBRID_SHIFT_CENTER_VOLTS,
    MACHINE_UNIT_ROWS,
    COEFFICIENT_STEPS,
    clampMachineUnit,
    toPanelVolts,
    toRcaVolts,
    toShiftedHybridVolts,
    scaleMachineUnit,
    describeMachineUnit,
    machineUnitGuideRows,
    overloadSummaryFromTrace,
    coefficientSetupRows,
    coefficientSetupGuide,
    summarizeHybridFrame,
    summarizeMultiBoardDefinition,
    buildEducationSummary,
    renderMachineUnitGuide,
    renderCoefficientGuide,
    renderOverloadGuide,
    renderInspectionGuide,
    initEducationApp,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingEducationApp = api;
}(typeof window !== 'undefined' ? window : global));
