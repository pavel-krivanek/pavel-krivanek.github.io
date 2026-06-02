/* global window, document, Blob, URL */
'use strict';

(function attachCustomDesignApp(globalScope) {
  const DESIGN_SCHEMA_VERSION = 'analog-thing-design/v1';
  const FALLBACK_COEFFICIENT_IDS = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
  const FALLBACK_OUTPUT_CHANNELS = Object.freeze(['X', 'Y', 'Z', 'U']);
  const FALLBACK_OPERATION_MODES = Object.freeze(['IC', 'OP', 'HALT', 'REP', 'REPF']);

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }
  function escapeText(text) { return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function clampCoefficient(value, fallback = 0.5) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    if (number < 0) return 0;
    if (number > 1) return 1;
    return number;
  }

  function getCoreDesign() {
    if (globalScope.AnalogThingCoreDesign) return globalScope.AnalogThingCoreDesign;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/design'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignControls() {
    if (globalScope.AnalogThingDesignControls) return globalScope.AnalogThingDesignControls;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designControls'); } catch (error) { return null; }
    }
    return null;
  }


  function getDesignAccessories() {
    if (globalScope.AnalogThingDesignAccessories) return globalScope.AnalogThingDesignAccessories;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designAccessories'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignDiagnostics() {
    if (globalScope.AnalogThingDesignDiagnostics) return globalScope.AnalogThingDesignDiagnostics;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designDiagnostics'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignRepairs() {
    if (globalScope.AnalogThingDesignRepairs) return globalScope.AnalogThingDesignRepairs;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designRepairs'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignHistory() {
    if (globalScope.AnalogThingDesignHistory) return globalScope.AnalogThingDesignHistory;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designHistory'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignRuntime() {
    if (globalScope.AnalogThingDesignRuntime) return globalScope.AnalogThingDesignRuntime;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designRuntime'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignStorage() {
    if (globalScope.AnalogThingDesignStorage) return globalScope.AnalogThingDesignStorage;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designStorage'); } catch (error) { return null; }
    }
    return null;
  }


  function getDesignPanelPolish() {
    if (globalScope.AnalogThingDesignPanelPolish) return globalScope.AnalogThingDesignPanelPolish;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designPanelPolish'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignTemplates() {
    if (globalScope.AnalogThingDesignTemplates) return globalScope.AnalogThingDesignTemplates;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designTemplates'); } catch (error) { return null; }
    }
    return null;
  }

  function getBrowserPatchRuntime() {
    if (globalScope.AnalogThingBrowserPatchRuntime) return globalScope.AnalogThingBrowserPatchRuntime;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./browserPatchRuntime'); } catch (error) { return null; }
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

  function normalizePatchForBrowser(patch) {
    const editor = getPatchEditorApp();
    if (editor && editor.normalizeSerializedPatch) return editor.normalizeSerializedPatch(patch);
    if (!patch || typeof patch !== 'object') throw new Error('patch must be an object');
    return clonePlain(patch);
  }

  function fallbackCoefficientControlsFromPatch(patch) {
    const normalized = normalizePatchForBrowser(patch);
    const values = Object.assign({}, normalized.parameters && normalized.parameters.coefficients ? normalized.parameters.coefficients : {});
    for (const component of normalized.components || []) {
      if (FALLBACK_COEFFICIENT_IDS.includes(component.id) && component.coefficient !== undefined) values[component.id] = component.coefficient;
    }
    if (normalized.parameters) {
      if (values.P1 === undefined && normalized.parameters.k !== undefined) values.P1 = normalized.parameters.k;
      if (values.P2 === undefined && normalized.parameters.d !== undefined) values.P2 = normalized.parameters.d;
      if (values.P3 === undefined && normalized.parameters.invMass !== undefined) values.P3 = normalized.parameters.invMass;
    }
    const result = {};
    for (const id of FALLBACK_COEFFICIENT_IDS) result[id] = clampCoefficient(values[id], 0.5);
    return result;
  }

  function fallbackPatchWithCoefficientControls(patch, values) {
    const next = normalizePatchForBrowser(patch);
    const coefficients = Object.assign(fallbackCoefficientControlsFromPatch(next), values || {});
    next.parameters = Object.assign({}, next.parameters || {}, { coefficients });
    for (const component of next.components || []) {
      if (FALLBACK_COEFFICIENT_IDS.includes(component.id)) component.coefficient = clampCoefficient(coefficients[component.id], 0.5);
    }
    next.parameters.k = coefficients.P1;
    next.parameters.d = coefficients.P2;
    next.parameters.invMass = coefficients.P3;
    return next;
  }

  function fallbackControlStateFromPatch(patch) {
    const normalized = normalizePatchForBrowser(patch);
    const outputs = normalized.outputs || {};
    const choices = [];
    function add(value, label) { if (value && !choices.some((choice) => choice.value === value)) choices.push({ value, label: label || value }); }
    for (const component of normalized.components || []) {
      if (!component || typeof component.id !== 'string') continue;
      if (/^(PLUS1|MINUS1|ZERO|P\d+|I\d+|INV\d+|SUM\d+|MUL\d+|CMP\d+|XIR\d+)$/.test(component.id)) add(`${component.id}.out`);
      else if (/^OUT_[XYZU]$/.test(component.id)) add(`${component.id}.out`, `${component.id.slice(-1)} output jack`);
    }
    Object.values(outputs).forEach((socketId) => add(socketId));
    return {
      coefficients: fallbackCoefficientControlsFromPatch(normalized),
      operation: Object.assign({ mode: 'REPF', duration: 40, dt: 0.01, sampleEvery: 10, opTime: 8, cycles: 3, clip: false }, normalized.parameters || {}),
      outputRouting: {
        X: outputs.x || outputs.velocity || null,
        Y: outputs.y || outputs.position || null,
        Z: outputs.z || null,
        U: outputs.u || null,
      },
      socketChoices: choices.sort((a, b) => a.value.localeCompare(b.value)),
    };
  }

  function controlStateFromPatch(patch) {
    const controls = getDesignControls();
    if (controls && controls.controlStateFromPatch) return controls.controlStateFromPatch(patch);
    return fallbackControlStateFromPatch(patch);
  }

  function patchWithControlState(patch, controlState) {
    const controls = getDesignControls();
    if (controls && controls.patchWithControlState) return controls.patchWithControlState(patch, controlState);
    let next = fallbackPatchWithCoefficientControls(patch, controlState.coefficients || {});
    next.parameters = Object.assign({}, next.parameters || {}, controlState.operation || {});
    const routing = controlState.outputRouting || {};
    for (const channel of FALLBACK_OUTPUT_CHANNELS) {
      const key = channel.toLowerCase();
      if (routing[channel]) next.outputs[key] = routing[channel];
      else delete next.outputs[key];
    }
    return next;
  }

  function controlWarnings(controlState) {
    const controls = getDesignControls();
    if (controls && controls.controlWarnings) return controls.controlWarnings(controlState);
    const warnings = [];
    if (controlState && controlState.operation && controlState.operation.clip) warnings.push('Clipping is enabled; integrator states are limited to ±1 machine unit during execution.');
    return warnings;
  }

  function fallbackDesignFromPatch(patch, options = {}) {
    const normalized = normalizePatchForBrowser(patch);
    const controls = fallbackControlStateFromPatch(normalized);
    const components = clonePlain(normalized.components || []);
    const cables = clonePlain(normalized.cables || normalized.connections || []).map((cable, index) => ({
      id: cable.id || `cable-${index + 1}`,
      from: { logicalSocketId: cable.from, physicalSocketId: null },
      to: { logicalSocketId: cable.to, physicalSocketId: null },
      label: cable.label || '',
      color: null,
    }));
    return {
      schemaVersion: DESIGN_SCHEMA_VERSION,
      kind: 'custom-design',
      inventory: normalized.inventory || 'that-prototype-board/v006',
      metadata: {
        name: options.name || normalized.name || 'Browser custom design',
        description: options.description || normalized.description || '',
        author: options.author || '',
        source: options.source || 'browser serialized patch editor',
        tags: options.tags || ['browser-design'],
        createdAt: options.createdAt || 'browser-session',
        modifiedAt: options.modifiedAt || 'browser-session',
        notes: options.notes || '',
      },
      components,
      coefficients: controls.coefficients,
      cables,
      outputRouting: { channels: controls.outputRouting, aliases: clonePlain(normalized.outputs || {}) },
      operationDefaults: controls.operation,
      notes: options.notes || '',
      sourcePatchSchemaVersion: normalized.schemaVersion || null,
    };
  }

  function designFromPatch(patch, options = {}) {
    const core = getCoreDesign();
    if (core && core.designFromSerializedPatch) return core.designFromSerializedPatch(patch, options);
    return fallbackDesignFromPatch(patch, options);
  }

  function patchFromDesign(design) {
    const core = getCoreDesign();
    if (core && core.serializedPatchFromDesign) return core.serializedPatchFromDesign(design);
    const patch = {
      schemaVersion: 'analog-thing-patch/v1',
      inventory: design.inventory || 'that-prototype-board/v006',
      name: design.metadata && design.metadata.name ? design.metadata.name : 'Browser custom design patch',
      description: design.metadata && design.metadata.description ? design.metadata.description : '',
      components: clonePlain(design.components || []),
      cables: (design.cables || []).map((cable) => ({
        from: cable.from.logicalSocketId,
        to: cable.to.logicalSocketId,
        ...(cable.label ? { label: cable.label } : {}),
      })),
      outputs: Object.assign({}, (design.outputRouting && design.outputRouting.aliases) || {}),
      parameters: Object.assign({}, design.operationDefaults || {}, { coefficients: clonePlain(design.coefficients || {}) }),
    };
    if (design.outputRouting && design.outputRouting.channels) {
      for (const channel of FALLBACK_OUTPUT_CHANNELS) {
        if (design.outputRouting.channels[channel]) patch.outputs[channel.toLowerCase()] = design.outputRouting.channels[channel];
      }
    }
    return normalizePatchForBrowser(patchWithControlState(patch, { coefficients: design.coefficients || {}, operation: design.operationDefaults || {}, outputRouting: design.outputRouting && design.outputRouting.channels ? design.outputRouting.channels : {} }));
  }

  function summarizeDesign(design) {
    const core = getCoreDesign();
    if (core && core.summarizeDesign) return core.summarizeDesign(design);
    const channels = Object.entries((design.outputRouting && design.outputRouting.channels) || {}).filter((entry) => entry[1]).map((entry) => entry[0]);
    return {
      schemaVersion: design.schemaVersion || DESIGN_SCHEMA_VERSION,
      name: design.metadata && design.metadata.name ? design.metadata.name : 'unnamed design',
      inventory: design.inventory || null,
      componentCount: (design.components || []).length,
      cableCount: (design.cables || []).length,
      coefficientCount: Object.keys(design.coefficients || {}).length,
      outputChannelCount: channels.length,
      outputChannels: channels,
      aliasCount: Object.keys((design.outputRouting && design.outputRouting.aliases) || {}).length,
      defaultMode: design.operationDefaults && design.operationDefaults.mode,
      hasPhysicalEndpoints: (design.cables || []).some((cable) => cable.from.physicalSocketId || cable.to.physicalSocketId),
      executableCableCount: (design.cables || []).filter((cable) => cable.from.logicalSocketId && cable.to.logicalSocketId).length,
    };
  }

  function smokeTestDesignRoundTrip(patch, options = {}) {
    try {
      const design = designFromPatch(patch, options);
      const json = `${JSON.stringify(design, null, 2)}\n`;
      const reparsed = JSON.parse(json);
      const patchAgain = patchFromDesign(reparsed);
      const original = normalizePatchForBrowser(patch);
      const originalOutputsPreserved = Object.entries(original.outputs || {})
        .every(([name, socketId]) => patchAgain.outputs && patchAgain.outputs[name] === socketId);
      return {
        ok: JSON.stringify(patchAgain.components) === JSON.stringify(original.components)
          && JSON.stringify(patchAgain.cables) === JSON.stringify(original.cables)
          && originalOutputsPreserved,
        design,
        summary: summarizeDesign(design),
        byteLength: json.length,
        patchAgain,
      };
    } catch (error) {
      return { ok: false, error: error.message, design: null, summary: null, byteLength: 0, patchAgain: null };
    }
  }

  function renderDesignSummary(container, summary, smoke) {
    if (!container) return;
    const payload = { summary, roundTripOk: smoke ? smoke.ok : null, byteLength: smoke ? smoke.byteLength : null };
    container.innerHTML = `<pre>${escapeText(JSON.stringify(payload, null, 2))}</pre>`;
    container.dataset.valid = smoke && smoke.ok ? 'true' : 'false';
  }

  function selectOptions(choices, selected) {
    const values = choices.slice();
    if (selected && !values.some((choice) => choice.value === selected)) values.unshift({ value: selected, label: selected });
    return [`<option value="">— not routed —</option>`].concat(values.map((choice) => `<option value="${escapeText(choice.value)}"${choice.value === selected ? ' selected' : ''}>${escapeText(choice.label || choice.value)}</option>`)).join('');
  }

  function renderCustomDesignControls(container, patch) {
    if (!container) return null;
    const state = controlStateFromPatch(patch);
    const controls = getDesignControls();
    const presets = controls && controls.COEFFICIENT_PRESETS ? controls.COEFFICIENT_PRESETS : [{ id: 'default', label: 'Default 0.50' }];
    const coefficientIds = controls && controls.COEFFICIENT_CONTROL_IDS ? controls.COEFFICIENT_CONTROL_IDS : FALLBACK_COEFFICIENT_IDS;
    const operationModes = controls && controls.OPERATION_MODES ? controls.OPERATION_MODES : FALLBACK_OPERATION_MODES;
    const outputChannels = controls && controls.OUTPUT_CHANNELS ? controls.OUTPUT_CHANNELS : FALLBACK_OUTPUT_CHANNELS;
    const coefficientRows = coefficientIds.map((id) => {
      const value = state.coefficients[id] === undefined ? 0.5 : Number(state.coefficients[id]);
      return `<div class="coefficient-control" data-coefficient-control="${escapeText(id)}">
        <label for="customCoeff_${escapeText(id)}">${escapeText(id)} <span data-custom-coeff-value="${escapeText(id)}">${value.toFixed(2)}</span></label>
        <input id="customCoeff_${escapeText(id)}" name="${escapeText(id)}" data-custom-coeff-range="${escapeText(id)}" type="range" min="0" max="1" step="0.01" value="${value}">
        <input aria-label="${escapeText(id)} numeric coefficient" data-custom-coeff-number="${escapeText(id)}" type="number" min="0" max="1" step="0.01" value="${value.toFixed(2)}">
      </div>`;
    }).join('');
    const routingRows = outputChannels.map((channel) => `<div class="control-row"><label for="route_${escapeText(channel)}">${escapeText(channel)} route</label><select id="route_${escapeText(channel)}" data-output-route="${escapeText(channel)}">${selectOptions(state.socketChoices || [], state.outputRouting[channel])}</select></div>`).join('');
    container.innerHTML = `
      <div class="custom-controls-grid">
        <section class="custom-controls-card">
          <h3>Coefficient controls</h3>
          <div class="control-row"><label for="coefficientPresetSelect">preset</label><select id="coefficientPresetSelect" data-coefficient-preset>${presets.map((preset) => `<option value="${escapeText(preset.id)}">${escapeText(preset.label || preset.id)}</option>`).join('')}</select></div>
          <div class="button-row"><button type="button" data-apply-coefficient-preset>Apply preset</button><button type="button" data-reset-coefficients>Reset coefficients</button></div>
          <div class="coefficient-grid">${coefficientRows}</div>
        </section>
        <section class="custom-controls-card">
          <h3>Operation controls</h3>
          <div class="control-row"><label for="customOperationMode">mode</label><select id="customOperationMode" data-operation-control="mode">${operationModes.map((mode) => `<option value="${escapeText(mode)}"${state.operation.mode === mode ? ' selected' : ''}>${escapeText(mode)}</option>`).join('')}</select></div>
          <div class="control-row"><label for="customDuration">OP/HALT duration</label><input id="customDuration" data-operation-control="duration" type="number" min="0" step="0.5" value="${escapeText(state.operation.duration)}"></div>
          <div class="control-row"><label for="customOpTime">REP/REPF operation time</label><input id="customOpTime" data-operation-control="opTime" type="number" min="0" step="any" value="${escapeText(state.operation.opTime)}"></div>
          <div class="control-row"><label for="customCycles">REP/REPF cycles</label><input id="customCycles" data-operation-control="cycles" type="number" min="1" step="1" value="${escapeText(state.operation.cycles)}"></div>
          <div class="control-row"><label for="customDt">solver step dt</label><input id="customDt" data-operation-control="dt" type="number" min="0" step="any" value="${escapeText(state.operation.dt)}"></div>
          <div class="control-row"><label for="customSampleEvery">sample every N steps</label><input id="customSampleEvery" data-operation-control="sampleEvery" type="number" min="1" step="1" value="${escapeText(state.operation.sampleEvery)}"></div>
          <div class="control-row checkbox-row"><label for="customClip">clip overloads to ±1</label><input id="customClip" data-operation-control="clip" type="checkbox"${state.operation.clip ? ' checked' : ''}></div>
        </section>
        <section class="custom-controls-card">
          <h3>Output routing</h3>
          ${routingRows}
        </section>
      </div>`;
    return state;
  }

  function readCustomDesignControlForm(container) {
    const coefficients = {};
    for (const input of Array.from(container.querySelectorAll('[data-custom-coeff-range]'))) coefficients[input.dataset.customCoeffRange] = clampCoefficient(input.value, 0.5);
    const operation = {};
    for (const input of Array.from(container.querySelectorAll('[data-operation-control]'))) {
      const key = input.dataset.operationControl;
      operation[key] = input.type === 'checkbox' ? Boolean(input.checked) : input.value;
    }
    const outputRouting = {};
    for (const select of Array.from(container.querySelectorAll('[data-output-route]'))) outputRouting[select.dataset.outputRoute] = select.value || null;
    return { coefficients, operation, outputRouting };
  }

  function updateCoefficientMirrors(container, componentId, value) {
    const numeric = clampCoefficient(value, 0.5);
    const text = numeric.toFixed(2);
    for (const node of Array.from(container.querySelectorAll(`[data-custom-coeff-value="${componentId}"]`))) node.textContent = text;
    for (const node of Array.from(container.querySelectorAll(`[data-custom-coeff-number="${componentId}"]`))) if (Number(node.value).toFixed(2) !== text) node.value = text;
    for (const node of Array.from(container.querySelectorAll(`[data-custom-coeff-range="${componentId}"]`))) if (Number(node.value).toFixed(2) !== text) node.value = String(numeric);
  }

  function renderControlWarnings(container, state) {
    if (!container) return;
    const warnings = controlWarnings(state);
    container.dataset.valid = warnings.length ? 'false' : 'true';
    container.textContent = warnings.length ? warnings.join('\n') : 'No coefficient, operation, or output-routing warnings.';
  }

  function validateDesign(design) {
    const diagnostics = getDesignDiagnostics();
    if (diagnostics && diagnostics.validateCustomDesign) return diagnostics.validateCustomDesign(design);
    return { ok: true, diagnostics: [], errors: [], warnings: [], errorCount: 0, warningCount: 0, repairHints: [] };
  }

  function summarizeDesignValidation(design) {
    const diagnostics = getDesignDiagnostics();
    if (diagnostics && diagnostics.summarizeDesignValidation) return diagnostics.summarizeDesignValidation(design);
    const validation = validateDesign(design);
    return { ok: validation.ok, errorCount: validation.errorCount, warningCount: validation.warningCount, diagnosticCount: validation.diagnostics.length };
  }

  function summarizeDesignAccessories(design, options = {}) {
    const accessories = getDesignAccessories();
    if (accessories && accessories.summarizeAccessoryUse) return accessories.summarizeAccessoryUse(design, options);
    return { schemaVersion: 'analog-thing-design-accessories/v1', accessoryTerminalUseCount: 0, xirSjHelperCount: 0, feedbackSocketUseCount: 0, unsupportedByType: {} };
  }

  function summarizePanelAccessories(options = {}) {
    const accessories = getDesignAccessories();
    if (accessories && accessories.summarizePanelAccessories) return accessories.summarizePanelAccessories(options);
    return { schemaVersion: 'analog-thing-design-accessories/v1', accessoryCount: 0, byType: {} };
  }

  function previewPhysicalAccessoryMaterialization(design, options = {}) {
    const accessories = getDesignAccessories();
    if (accessories && accessories.previewPhysicalAccessoryMaterialization) return accessories.previewPhysicalAccessoryMaterialization(design, options);
    return { schemaVersion: 'analog-thing-design-accessories/v1', kind: 'physical-accessory-materialization-preview', ok: true, materializedCount: 0, unresolvedCount: 0, before: { componentCount: 0, cableCount: 0 }, after: { componentCount: 0, cableCount: 0 }, delta: { componentCount: 0, cableCount: 0 }, removedCableIds: [], addedComponentIds: [], addedCableCount: 0, materializedAccessories: [], unresolvedAccessoryUses: [], canConvert: false, conversionHint: 'Physical accessory materialization is not available in this build.' };
  }

  function materializePhysicalAccessoriesForDesign(design, options = {}) {
    const accessories = getDesignAccessories();
    if (accessories && accessories.materializePhysicalAccessoriesFromDesign) return accessories.materializePhysicalAccessoriesFromDesign(design, options);
    return { design: clonePlain(design), materializedCount: 0, materializedAccessories: [], materializedAccessoryIds: [], removedCableIds: [], addedComponentIds: [], addedCableCount: 0, addedCables: [], unresolvedAccessoryUses: [] };
  }

  function repairActionsForValidation(validation, design, options = {}) {
    const repairs = getDesignRepairs();
    if (repairs && repairs.repairActionsForValidation && design) return repairs.repairActionsForValidation(validation, design, options);
    return [];
  }

  function repairSummaryForValidation(validation, design, options = {}) {
    const repairs = getDesignRepairs();
    if (repairs && repairs.repairSummaryForValidation && design) return repairs.repairSummaryForValidation(validation, design, options);
    const actions = repairActionsForValidation(validation, design, options);
    return { schemaVersion: 'analog-thing-design-repairs/v1', actionCount: actions.length, actions };
  }

  function previewRepairAction(design, action, options = {}) {
    const repairs = getDesignRepairs();
    if (repairs && repairs.previewRepairAction) return repairs.previewRepairAction(design, action, options);
    try {
      const applied = applyDesignRepairAction(design, action, options);
      return { ok: true, action: clonePlain(action), changed: Boolean(applied.changed), validationBefore: validateDesign(design), validationAfter: validateDesign(applied.design), summaryText: action.label || action.operation };
    } catch (error) {
      return { ok: false, action: clonePlain(action || {}), changed: false, error: error.message, summaryText: error.message };
    }
  }

  function guidedRepairWorkflowForValidation(validation, design, options = {}) {
    const repairs = getDesignRepairs();
    if (repairs && repairs.guidedRepairWorkflowForValidation && design) return repairs.guidedRepairWorkflowForValidation(validation, design, options);
    const actions = repairActionsForValidation(validation, design, options);
    return { schemaVersion: 'analog-thing-design-repairs/v1', ok: Boolean(validation && validation.ok), actionCount: actions.length, stepCount: actions.length, steps: actions.map((action, index) => ({ id: `step-${index + 1}:${action.id}`, order: index + 1, title: action.label || action.operation, action, preview: previewRepairAction(design, action, options) })) };
  }

  function applyDesignRepairAction(design, action, options = {}) {
    const repairs = getDesignRepairs();
    if (!repairs || !repairs.applyRepairAction) throw new Error('custom-design repair helpers are not available');
    return repairs.applyRepairAction(design, action, options);
  }


  function previewGuidedRepairBatch(design, validationOrOptions = null, maybeOptions = {}) {
    const repairs = getDesignRepairs();
    if (repairs && repairs.previewGuidedRepairBatch) return repairs.previewGuidedRepairBatch(design, validationOrOptions, maybeOptions);
    const validation = validationOrOptions && validationOrOptions.diagnostics ? validationOrOptions : validateDesign(design);
    const workflow = guidedRepairWorkflowForValidation(validation, design, maybeOptions || {});
    return { schemaVersion: 'analog-thing-design-repairs/v1', ok: true, plannedStepCount: workflow.stepCount || 0, steps: workflow.steps || [], finalValidationPreview: { ok: validation.ok, errorCount: validation.errorCount || 0 } };
  }

  function applyGuidedRepairBatch(design, validationOrOptions = null, maybeOptions = {}) {
    const repairs = getDesignRepairs();
    if (!repairs || !repairs.applyGuidedRepairBatch) throw new Error('custom-design batch repair helpers are not available');
    return repairs.applyGuidedRepairBatch(design, validationOrOptions, maybeOptions);
  }

  function repairBatchSummary(batchResult) {
    const repairs = getDesignRepairs();
    if (repairs && repairs.repairBatchSummary) return repairs.repairBatchSummary(batchResult);
    return { schemaVersion: 'analog-thing-design-repairs/v1', changed: Boolean(batchResult && batchResult.changed), appliedStepCount: batchResult && batchResult.appliedStepCount || 0 };
  }

  function createGuidedRepairSession(design, validationOrOptions = null, maybeOptions = {}) {
    const repairs = getDesignRepairs();
    if (repairs && repairs.createGuidedRepairSession) return repairs.createGuidedRepairSession(design, validationOrOptions, maybeOptions);
    const validation = validationOrOptions && validationOrOptions.diagnostics ? validationOrOptions : validateDesign(design);
    const preview = previewGuidedRepairBatch(design, validation, maybeOptions || {});
    return { schemaVersion: 'analog-thing-design-repairs/v1', kind: 'guided-repair-session', design: clonePlain(design), initialValidation: validation, currentValidation: validation, steps: (preview.steps || []).map((step, index) => Object.assign({ order: index + 1, status: 'pending' }, step)), appliedSteps: [], skippedSteps: [], failedSteps: [], pendingStepCount: preview.plannedStepCount || 0, appliedStepCount: 0 };
  }

  function applyNextGuidedRepairSessionStep(session, options = {}) {
    const repairs = getDesignRepairs();
    if (!repairs || !repairs.applyNextGuidedRepairSessionStep) throw new Error('custom-design repair-session helpers are not available');
    return repairs.applyNextGuidedRepairSessionStep(session, options);
  }

  function applyAllGuidedRepairSessionSteps(session, options = {}) {
    const repairs = getDesignRepairs();
    if (!repairs || !repairs.applyAllGuidedRepairSessionSteps) throw new Error('custom-design repair-session helpers are not available');
    return repairs.applyAllGuidedRepairSessionSteps(session, options);
  }

  function skipGuidedRepairSessionStep(session, stepId = null, reason = 'skipped by user') {
    const repairs = getDesignRepairs();
    if (!repairs || !repairs.skipGuidedRepairSessionStep) throw new Error('custom-design repair-session helpers are not available');
    return repairs.skipGuidedRepairSessionStep(session, stepId, reason);
  }

  function repairSessionSummary(session) {
    const repairs = getDesignRepairs();
    if (repairs && repairs.repairSessionSummary) return repairs.repairSessionSummary(session);
    return { schemaVersion: 'analog-thing-design-repairs/v1', kind: 'guided-repair-session-summary', appliedStepCount: session && session.appliedSteps ? session.appliedSteps.length : 0 };
  }


  function saveGuidedRepairSessionDraft(session, options = {}) {
    const repairs = getDesignRepairs();
    const store = options.repairSessionStorage || draftStorage(options);
    if (!store) throw new Error('localStorage is not available for guided repair-session drafts');
    if (!repairs || !repairs.saveGuidedRepairSessionDraft) throw new Error('guided repair-session draft helpers are not available');
    return repairs.saveGuidedRepairSessionDraft(store, session, options);
  }

  function loadGuidedRepairSessionDraft(options = {}) {
    const repairs = getDesignRepairs();
    const store = options.repairSessionStorage || draftStorage(options);
    if (!store) return { ok: false, session: null, error: 'localStorage is not available for guided repair-session drafts' };
    if (!repairs || !repairs.loadGuidedRepairSessionDraft) throw new Error('guided repair-session draft helpers are not available');
    return repairs.loadGuidedRepairSessionDraft(store, options);
  }

  function clearGuidedRepairSessionDraft(options = {}) {
    const repairs = getDesignRepairs();
    const store = options.repairSessionStorage || draftStorage(options);
    if (!store) throw new Error('localStorage is not available for guided repair-session drafts');
    if (!repairs || !repairs.clearGuidedRepairSessionDraft) throw new Error('guided repair-session draft helpers are not available');
    return repairs.clearGuidedRepairSessionDraft(store, options);
  }

  function customPanelOverlayLegend(overlayOrDesign, options = {}) {
    const polish = getDesignPanelPolish();
    if (polish && polish.panelOverlayLegend) {
      const overlay = overlayOrDesign && /panel-overlay$/.test(overlayOrDesign.kind || '') ? overlayOrDesign : customDesignPanelOverlay(overlayOrDesign, options);
      return polish.panelOverlayLegend(overlay, options);
    }
    return { schemaVersion: 'analog-thing-panel-polish/v1', kind: 'design-panel-overlay-legend', statuses: [], roles: [], lanes: [], sections: [] };
  }

  function templateGuidedEditingPlan(templateOrId, options = {}) {
    const polish = getDesignPanelPolish();
    if (polish && polish.templateGuidedEditingPlan) return polish.templateGuidedEditingPlan(templateOrId, options);
    const template = typeof templateOrId === 'string' ? loadCustomDesignTemplate(templateOrId, options) : templateOrId;
    const overlay = customTemplatePanelOverlay(template, options);
    return { schemaVersion: 'analog-thing-panel-polish/v1', kind: 'template-guided-editing-plan', template: { id: template.id, title: template.title }, stepCount: (template.walkthrough || []).length, activeSectionIds: overlay.activeSectionIds || [], overlayLegend: customPanelOverlayLegend(overlay), steps: [] };
  }

  function renderCustomDesignOverlayLegend(container, overlayOrDesign, options = {}) {
    if (!container) return null;
    const legend = customPanelOverlayLegend(overlayOrDesign, options);
    container.dataset.overlayLegend = 'true';
    const statuses = (legend.statuses || []).map((item) => `<li data-overlay-legend-status="${escapeText(item.id)}"><strong>${escapeText(item.id)}</strong>: ${escapeText(item.label || item.id)} (${escapeText(item.count || 0)})</li>`).join('');
    const roles = (legend.roles || []).map((item) => `<li data-overlay-legend-role="${escapeText(item.id)}"><strong>${escapeText(item.id)}</strong>: ${escapeText(item.label || item.id)} (${escapeText(item.count || 0)})</li>`).join('');
    const sections = (legend.sections || []).map((item) => `<li data-overlay-legend-section="${escapeText(item.id)}">${escapeText(item.title || item.id)} (${escapeText(item.usedSocketCount || 0)} sockets)</li>`).join('');
    container.innerHTML = `<div class="design-panel-overlay-legend" data-design-panel-overlay-legend="true"><h4>Overlay legend</h4><ul>${statuses}</ul><ul>${roles}</ul>${sections ? `<ol>${sections}</ol>` : ''}</div>`;
    return legend;
  }

  function renderTemplateGuidedEditingPlan(container, templateOrId, options = {}) {
    if (!container) return null;
    const plan = templateGuidedEditingPlan(templateOrId, options);
    container.dataset.templateGuidance = plan.template && plan.template.id ? plan.template.id : '';
    const steps = (plan.steps || []).map((step) => `<li data-template-guidance-step="${escapeText(step.order)}"><strong>${escapeText(step.title)}</strong>: ${escapeText(step.action || 'read-notes')}${step.focusPhysicalSocketIds && step.focusPhysicalSocketIds.length ? ` — ${escapeText(step.focusPhysicalSocketIds.join(', '))}` : ''}${step.controlFocus && step.controlFocus.length ? ` — controls ${escapeText(step.controlFocus.join(', '))}` : ''}</li>`).join('');
    container.innerHTML = `<div class="template-guided-editing-plan" data-template-guided-editing-plan="true"><h4>${escapeText((plan.template && (plan.template.title || plan.template.id)) || 'Template guidance')}</h4><p>${escapeText(plan.stepCount || 0)} guided step(s); ${escapeText(plan.socketFocusedStepCount || 0)} socket-focused, ${escapeText(plan.controlFocusedStepCount || 0)} control-focused.</p><ol>${steps}</ol></div>`;
    return plan;
  }

  function customDesignPanelOverlay(design, options = {}) {
    const polish = getDesignPanelPolish();
    if (polish && polish.panelOverlayForDesign) return polish.panelOverlayForDesign(design, options);
    const validation = validateDesign(design);
    return { schemaVersion: 'analog-thing-panel-polish/v1', kind: 'design-panel-overlay', name: design && design.metadata ? design.metadata.name : 'Custom design', summary: summarizeDesign(design), activeSectionIds: [], socketHighlights: [], cableHighlights: [], sectionBadges: [], socketHighlightCount: 0, cableHighlightCount: 0, validation };
  }

  function customTemplatePanelOverlay(templateOrId, options = {}) {
    const polish = getDesignPanelPolish();
    if (polish && polish.templatePanelOverlay) return polish.templatePanelOverlay(templateOrId, options);
    const template = typeof templateOrId === 'string' ? loadCustomDesignTemplate(templateOrId, options) : templateOrId;
    return customDesignPanelOverlay(instantiateCustomDesignTemplate(template, options), Object.assign({}, options, { templateId: template && template.id }));
  }

  function renderCustomDesignPanelOverlay(container, designOrOverlay, options = {}) {
    if (!container) return null;
    const overlay = designOrOverlay && /panel-overlay$/.test(designOrOverlay.kind || '') ? designOrOverlay : customDesignPanelOverlay(designOrOverlay, options);
    const summary = {
      kind: overlay.kind,
      templateId: overlay.templateId || (overlay.template && overlay.template.id) || null,
      name: overlay.name || (overlay.template && overlay.template.title) || 'Custom design overlay',
      activeSectionIds: overlay.activeSectionIds || [],
      socketHighlightCount: overlay.socketHighlightCount || (overlay.socketHighlights || []).length,
      cableHighlightCount: overlay.cableHighlightCount || (overlay.cableHighlights || []).length,
      routedCableCount: overlay.summary && overlay.summary.routedCableCount,
    };
    container.dataset.overlayKind = overlay.kind || 'design-panel-overlay';
    container.dataset.templateId = summary.templateId || '';
    container.dataset.activeSections = (summary.activeSectionIds || []).join(',');
    const sections = (overlay.sectionBadges || []).filter((section) => section.active).map((section) => `<span class="section-chip" data-overlay-section="${escapeText(section.id)}">${escapeText(section.title || section.id)} (${escapeText(section.usedSocketCount || 0)})</span>`).join(' ');
    const sockets = (overlay.socketHighlights || []).slice(0, 24).map((socket) => `<li data-overlay-socket="${escapeText(socket.socketId)}" data-overlay-role="${escapeText(socket.role || '')}">${escapeText(socket.socketId)}${socket.logicalSocketId ? ` → ${escapeText(socket.logicalSocketId)}` : ''}</li>`).join('');
    const legend = overlay.legend || customPanelOverlayLegend(overlay, options);
    const legendRows = (legend.statuses || []).map((item) => `<li data-overlay-legend-status="${escapeText(item.id)}">${escapeText(item.label || item.id)}: ${escapeText(item.count || 0)}</li>`).join('');
    const guidance = overlay.guidedEditingPlan ? `<p class="template-guided-editing-inline" data-template-guided-editing-plan="true">Template guidance: ${escapeText(overlay.guidedEditingPlan.stepCount || 0)} step(s), ${escapeText(overlay.guidedEditingPlan.socketFocusedStepCount || 0)} socket-focused.</p>` : '';
    container.innerHTML = `<pre>${escapeText(JSON.stringify(summary, null, 2))}</pre><div class="design-panel-overlay-summary" data-design-panel-overlay="true">${sections ? `<p>${sections}</p>` : '<p>No active panel sections.</p>'}${sockets ? `<ol>${sockets}</ol>` : ''}${legendRows ? `<details class="design-panel-overlay-legend" open><summary>Overlay legend</summary><ul>${legendRows}</ul></details>` : ''}${guidance}</div>`;
    return overlay;
  }

  function renderGuidedRepairSession(container, session) {
    if (!container || !session) return null;
    const summary = repairSessionSummary(session);
    container.dataset.repairSession = 'true';
    container.dataset.repairSessionComplete = summary.completed ? 'true' : 'false';
    container.innerHTML = `<pre>${escapeText(JSON.stringify(summary, null, 2))}</pre>`;
    return summary;
  }

  function renderCustomDesignValidation(container, validation, design) {
    if (!container) return;
    const repairSummary = design ? repairSummaryForValidation(validation, design) : { actionCount: 0, actions: [] };
    const workflow = design ? guidedRepairWorkflowForValidation(validation, design) : { stepCount: 0, steps: [] };
    const batchPreview = design ? previewGuidedRepairBatch(design, validation, { maxSteps: 8 }) : { plannedStepCount: 0, finalValidationPreview: null };
    const accessoryMaterialization = design ? previewPhysicalAccessoryMaterialization(design) : { materializedCount: 0, unresolvedCount: 0, materializedAccessories: [], canConvert: false };
    const previewRows = (workflow.steps || []).slice(0, 8).map((step) => {
      const preview = step.preview || previewRepairAction(design, step.action || step);
      const beforeErrors = preview.validationBefore && Number.isFinite(Number(preview.validationBefore.errorCount)) ? preview.validationBefore.errorCount : '?';
      const afterErrors = preview.validationAfter && Number.isFinite(Number(preview.validationAfter.errorCount)) ? preview.validationAfter.errorCount : '?';
      const changeText = preview.changes ? `${preview.changes.cableChangeCount || 0} cable change(s), ${preview.changes.outputRouteChangeCount || 0} route change(s)` : (preview.changed ? 'changes design' : 'no design change');
      return { id: step.id, title: step.title, operation: step.action && step.action.operation, recommended: Boolean(step.recommended), destructive: Boolean(step.destructive), beforeErrors, afterErrors, changeText, summaryText: preview.summaryText || '' };
    });
    const summary = {
      ok: validation.ok,
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      diagnosticCount: validation.diagnostics ? validation.diagnostics.length : 0,
      invalidCableIds: validation.invalidCableIds || [],
      invalidPhysicalSocketIds: validation.invalidPhysicalSocketIds || [],
      repairHints: validation.repairHints || [],
      repairActionCount: repairSummary.actionCount || 0,
      repairWorkflowStepCount: workflow.stepCount || 0,
      recommendedRepairCount: workflow.recommendedStepCount || previewRows.filter((row) => row.recommended).length,
      batchPreviewStepCount: batchPreview.plannedStepCount || 0,
      batchPreviewFinalErrors: batchPreview.finalValidationPreview && Number.isFinite(Number(batchPreview.finalValidationPreview.errorCount)) ? batchPreview.finalValidationPreview.errorCount : null,
      previewRows,
      accessorySummary: validation.accessorySummary || null,
      accessoryMaterializationPreview: {
        materializedCount: accessoryMaterialization.materializedCount || 0,
        unresolvedCount: accessoryMaterialization.unresolvedCount || 0,
        addedComponentIds: accessoryMaterialization.addedComponentIds || [],
        removedCableIds: accessoryMaterialization.removedCableIds || [],
        addedCableCount: accessoryMaterialization.addedCableCount || 0,
        canConvert: Boolean(accessoryMaterialization.canConvert),
      },
    };
    container.dataset.valid = validation.ok ? 'true' : 'false';
    const actionButtons = (workflow.steps || []).slice(0, 8).map((step) => {
      const action = step.action || step;
      const preview = step.preview || previewRepairAction(design, action);
      const title = [action.description || '', preview.summaryText || '', step.recommended ? 'Recommended repair' : '', step.destructive ? 'Destructive repair' : ''].filter(Boolean).join('\n');
      const suffix = preview.validationAfter && preview.validationBefore ? ` (${preview.validationBefore.errorCount}→${preview.validationAfter.errorCount} errors)` : '';
      return `<button type="button" data-design-repair-action="${escapeText(action.id)}" data-design-repair-preview="${escapeText(step.id || action.id)}" data-recommended="${step.recommended ? 'true' : 'false'}" data-destructive="${step.destructive ? 'true' : 'false'}" title="${escapeText(title)}">${escapeText(action.label || action.operation)}${escapeText(suffix)}</button>`;
    }).join('');
    const batchButtons = batchPreview.plannedStepCount ? `<div class="button-row repair-batch-actions"><strong>Repair batch:</strong> <button type="button" data-design-repair-batch="next">Apply next recommended repair</button><button type="button" data-design-repair-batch="all">Apply all recommended repairs</button></div>` : '';
    const workflowHtml = previewRows.length ? `<details open class="repair-preview"><summary>Repair preview workflow</summary><ol>${previewRows.map((row) => `<li data-repair-step="${escapeText(row.id)}"><strong>${escapeText(row.title)}</strong>: ${escapeText(row.beforeErrors)} → ${escapeText(row.afterErrors)} errors; ${escapeText(row.changeText)}${row.recommended ? ' <em>recommended</em>' : ''}${row.destructive ? ' <em>destructive</em>' : ''}</li>`).join('')}</ol>${batchPreview.plannedStepCount ? `<p class="repair-batch-preview">Batch preview: ${escapeText(batchPreview.plannedStepCount)} step(s), final errors ${escapeText(batchPreview.batchPreviewFinalErrors || (batchPreview.finalValidationPreview && batchPreview.finalValidationPreview.errorCount) || 0)}.</p>` : ''}</details>` : '';
    const accessoryRows = (accessoryMaterialization.materializedAccessories || []).map((row) => {
      const generatedCables = (row.generatedCableIds || []).join(', ');
      const componentType = row.componentType || (row.generatedComponent && row.generatedComponent.type) || row.accessoryType;
      return `<li data-physical-accessory-row="${escapeText(row.accessoryId)}"><strong>${escapeText(row.accessoryId)}</strong> → ${escapeText(row.componentId)} <em>${escapeText(componentType)}</em>; removes ${escapeText([row.sourceCableId, row.sinkCableId].filter(Boolean).join(', '))}; adds ${escapeText(generatedCables)}.</li>`;
    }).join('');
    const unresolvedRows = (accessoryMaterialization.unresolvedAccessoryUses || []).map((row) => `<li data-physical-accessory-unresolved="${escapeText(row.accessoryId)}"><strong>${escapeText(row.accessoryId)}</strong>: ${escapeText(row.reason || 'unresolved')}</li>`).join('');
    const accessoryHtml = (accessoryMaterialization.materializedCount || accessoryMaterialization.unresolvedCount) ? `<details open class="accessory-materialization-preview" data-physical-accessory-materialization-preview="true"><summary>Physical accessory conversion preview</summary>${accessoryRows ? `<ol>${accessoryRows}</ol>` : ''}${unresolvedRows ? `<p>Unresolved physical accessory wiring:</p><ul>${unresolvedRows}</ul>` : ''}<p>${escapeText(accessoryMaterialization.conversionHint || '')}</p>${accessoryMaterialization.canConvert ? '<div class="button-row accessory-materialization-actions"><button type="button" data-physical-accessory-materialize="true">Convert physical accessories to logical runtime components</button></div>' : ''}</details>` : '';
    container.innerHTML = `<pre>${escapeText(JSON.stringify(summary, null, 2))}</pre>${accessoryHtml}${workflowHtml}${actionButtons ? `<div class="button-row repair-actions"><strong>Guided repairs:</strong> ${actionButtons}</div>` : ''}${batchButtons}`;
  }


  function renderCustomDesignHistoryStatus(container, historyState) {
    if (!container) return;
    const history = getDesignHistory();
    const summary = history && history.designHistorySummary ? history.designHistorySummary(historyState) : { dirty: false, undoCount: 0, redoCount: 0, lastEdit: null };
    container.dataset.dirty = summary.dirty ? 'true' : 'false';
    container.textContent = `Design history: dirty=${summary.dirty ? 'yes' : 'no'}, undo=${summary.undoCount || 0}, redo=${summary.redoCount || 0}${summary.lastEdit && summary.lastEdit.label ? `, last=${summary.lastEdit.label}` : ''}.`;
  }

  function fallbackAvailableDesignOutputNames(design) {
    const names = [];
    function add(name) { if (name && !names.includes(name)) names.push(name); }
    const routing = design && design.outputRouting ? design.outputRouting : {};
    for (const name of Object.keys(routing.aliases || {})) add(name);
    for (const channel of FALLBACK_OUTPUT_CHANNELS) if (routing.channels && routing.channels[channel]) add(channel.toLowerCase());
    return names;
  }

  function fallbackSelectedOutputNames(design, options = {}) {
    const available = fallbackAvailableDesignOutputNames(design);
    const selected = [];
    function add(name) {
      if (!name || selected.includes(name)) return;
      if (!available.includes(name)) throw new Error(`selected output ${name} is not routed by this design`);
      selected.push(name);
    }
    for (const channel of options.selectedChannels || options.channels || []) add(String(channel).toLowerCase());
    for (const name of options.selectedOutputNames || options.outputs || []) add(name);
    if (options.outputName) add(options.outputName);
    return selected.length ? selected : available;
  }

  function fallbackFilterTraceOutputs(result, selectedOutputNames) {
    if (!result || !Array.isArray(result.trace)) return result;
    const filtered = clonePlain(result);
    filtered.trace = result.trace.map((point) => {
      const outputs = {};
      const outputDetails = {};
      for (const name of selectedOutputNames) {
        if (point.outputs && Object.prototype.hasOwnProperty.call(point.outputs, name)) outputs[name] = point.outputs[name];
        if (point.outputDetails && Object.prototype.hasOwnProperty.call(point.outputDetails, name)) outputDetails[name] = point.outputDetails[name];
      }
      return Object.assign({}, point, { outputs, outputDetails });
    });
    filtered.selectedOutputNames = selectedOutputNames.slice();
    return filtered;
  }

  function summarizeDesignRunResult(payload) {
    const runtime = getDesignRuntime();
    if (runtime && runtime.summarizeDesignRunResult) return runtime.summarizeDesignRunResult(payload);
    const result = payload && payload.result ? payload.result : payload;
    const trace = (result && result.trace) || [];
    const outputNames = trace[0] ? Object.keys(trace[0].outputs || {}) : [];
    const peaks = {};
    const finals = {};
    for (const name of outputNames) {
      peaks[name] = trace.length ? Math.max(...trace.map((point) => Math.abs(point.outputs[name] || 0))) : 0;
      finals[name] = trace.length ? trace[trace.length - 1].outputs[name] : 0;
    }
    const overloadEvents = [];
    for (const point of trace) {
      for (const [name, details] of Object.entries(point.outputDetails || {})) {
        if (details && details.overloaded) overloadEvents.push({ t: point.t, cycle: point.cycle, output: name, socket: details.socket, machineUnit: details.machineUnit });
      }
    }
    return {
      mode: result && result.mode,
      sampleCount: trace.length,
      outputNames,
      selectedOutputNames: result && result.selectedOutputNames ? result.selectedOutputNames.slice() : outputNames,
      finalState: result && result.finalState ? clonePlain(result.finalState) : null,
      overload: trace.some((point) => point.overload) || overloadEvents.length > 0,
      overloadPointCount: trace.filter((point) => point.overload).length,
      overloadEventCount: overloadEvents.length,
      overloadedOutputNames: Array.from(new Set(overloadEvents.map((event) => event.output))).sort(),
      overloadEvents,
      triggerCount: trace.filter((point) => point.trigger).length,
      peaks,
      finals,
    };
  }

  function runCustomDesign(design, options = {}) {
    const runtime = getDesignRuntime();
    if (runtime && runtime.runCustomDesign) return runtime.runCustomDesign(design, options);
    const validation = validateDesign(design);
    if (!validation.ok && options.allowInvalid !== true) throw new Error(`custom design validation failed: ${(validation.errors || []).join('; ')}`);
    const patch = patchFromDesign(design);
    const browserRuntime = getBrowserPatchRuntime();
    if (!browserRuntime || !browserRuntime.runSerializedPatch) throw new Error('browser patch runtime is not available');
    const defaults = design.operationDefaults || {};
    const requestedMode = options.mode || defaults.mode || 'OP';
    const operation = Object.assign({}, defaults, options, { mode: requestedMode, requestedMode });
    const selectedOutputNames = fallbackSelectedOutputNames(design, options);
    const runPayload = browserRuntime.runSerializedPatch(patch, operation);
    runPayload.result = fallbackFilterTraceOutputs(runPayload.result, selectedOutputNames);
    runPayload.design = clonePlain(design);
    runPayload.validation = validation;
    runPayload.operation = operation;
    runPayload.selectedOutputNames = selectedOutputNames;
    runPayload.designSummary = summarizeDesign(design);
    runPayload.summary = summarizeDesignRunResult(runPayload);
    return runPayload;
  }

  function runCustomDesignFromPatch(patch, options = {}) {
    const design = designFromPatch(patch, options.designOptions || { name: 'Browser custom design run' });
    return runCustomDesign(design, options);
  }

  function designTraceExportPayload(runPayload, options = {}) {
    const runtime = getDesignRuntime();
    if (runtime && runtime.designTraceExportPayload) return runtime.designTraceExportPayload(runPayload, options);
    if (!runPayload || !runPayload.design || !runPayload.result) throw new Error('designTraceExportPayload requires a runCustomDesign payload');
    const payload = {
      schemaVersion: 'analog-thing-design-trace/v1',
      generatedAt: options.generatedAt || options.now || new Date().toISOString(),
      designMetadata: clonePlain((runPayload.design && runPayload.design.metadata) || {}),
      designSummary: runPayload.designSummary || summarizeDesign(runPayload.design),
      operation: clonePlain(runPayload.operation || {}),
      selectedOutputNames: (runPayload.selectedOutputNames || []).slice(),
      validation: { ok: Boolean(runPayload.validation && runPayload.validation.ok), errorCount: runPayload.validation ? runPayload.validation.errorCount : 0, warningCount: runPayload.validation ? runPayload.validation.warningCount : 0 },
      summary: runPayload.summary || summarizeDesignRunResult(runPayload),
      trace: clonePlain(runPayload.result.trace || []),
    };
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    return { payload, json, byteLength: json.length };
  }

  function fallbackDesignExportPayload(design, options = {}) {
    const normalized = clonePlain(design);
    const filename = options.filename || 'custom_design.design.json';
    const json = `${JSON.stringify(normalized, null, 2)}
`;
    return { filename, mimeType: 'application/json', json, byteLength: json.length, design: normalized, summary: summarizeDesign(normalized), validation: validateDesign(normalized) };
  }

  function createDesignExportPayload(design, options = {}) {
    const storage = getDesignStorage();
    if (storage && storage.createDesignExportPayload) return storage.createDesignExportPayload(design, options);
    return fallbackDesignExportPayload(design, options);
  }

  function parseDesignImportText(text, options = {}) {
    const storage = getDesignStorage();
    if (storage && storage.parseDesignImportText) return storage.parseDesignImportText(text, options);
    try {
      const parsed = JSON.parse(String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
      if (parsed.schemaVersion === DESIGN_SCHEMA_VERSION || parsed.kind === 'custom-design') return { ok: true, design: parsed, sourceKind: 'design', validation: validateDesign(parsed), error: null };
      const cables = parsed.cables || parsed.connections;
      if (Array.isArray(parsed.components) && Array.isArray(cables)) {
        const design = designFromPatch(parsed, { name: parsed.name || 'Imported serialized patch design', source: 'pasted serialized patch' });
        return { ok: true, design, sourceKind: 'patch', validation: validateDesign(design), error: null };
      }
      throw new Error('JSON is neither a custom design nor a serialized patch');
    } catch (error) {
      return { ok: false, design: null, sourceKind: 'syntax-error', validation: null, error: error.message };
    }
  }

  function smokeTestDesignImportExport(design, options = {}) {
    const storage = getDesignStorage();
    if (storage && storage.smokeTestDesignImportExport) return storage.smokeTestDesignImportExport(design, options);
    const exported = createDesignExportPayload(design, options);
    const imported = parseDesignImportText(exported.json, options);
    return { ok: imported.ok, exported, importedOk: imported.ok, importError: imported.error, sourceKind: imported.sourceKind, roundTripEqual: imported.ok && JSON.stringify(imported.design) === JSON.stringify(design), validationOk: imported.validation ? imported.validation.ok : imported.ok };
  }

  function draftStorage(options = {}) {
    if (options.storage) return options.storage;
    try { return globalScope.localStorage || null; } catch (error) { return null; }
  }

  function saveDesignDraft(design, options = {}) {
    const storage = getDesignStorage();
    const store = draftStorage(options);
    if (!store) throw new Error('localStorage is not available for custom design drafts');
    if (storage && storage.saveDesignDraft) return storage.saveDesignDraft(store, design, options);
    const envelope = { schemaVersion: 'analog-thing-design-draft/v1', savedAt: options.now || new Date().toISOString(), name: design && design.metadata ? design.metadata.name : 'Untitled custom design', design: clonePlain(design) };
    store.setItem(options.key || 'analogThing.customDesignDraft.v1', JSON.stringify(envelope, null, 2));
    return envelope;
  }

  function loadDesignDraft(options = {}) {
    const storage = getDesignStorage();
    const store = draftStorage(options);
    if (!store) return { ok: false, design: null, error: 'localStorage is not available for custom design drafts' };
    if (storage && storage.loadDesignDraft) return storage.loadDesignDraft(store, options);
    const key = options.key || 'analogThing.customDesignDraft.v1';
    const text = store.getItem(key);
    if (!text) return { ok: false, design: null, error: 'no custom design draft saved' };
    return parseDesignImportText(text, options);
  }

  function clearDesignDraft(options = {}) {
    const storage = getDesignStorage();
    const store = draftStorage(options);
    if (!store) throw new Error('localStorage is not available for custom design drafts');
    if (storage && storage.clearDesignDraft) return storage.clearDesignDraft(store, options);
    const key = options.key || 'analogThing.customDesignDraft.v1';
    store.removeItem(key);
    return { ok: true, key };
  }

  function listCustomDesignGallery(options = {}) {
    const storage = getDesignStorage();
    if (storage && storage.listDesignGalleryEntries) return storage.listDesignGalleryEntries(options);
    return [];
  }

  function loadCustomDesignGalleryDesign(id, options = {}) {
    const storage = getDesignStorage();
    if (storage && storage.loadDesignGalleryDesign) return storage.loadDesignGalleryDesign(id, options);
    throw new Error('custom design gallery is not available');
  }

  function renderCustomDesignStorageStatus(container, payload, valid = true) {
    if (!container) return;
    container.dataset.valid = valid ? 'true' : 'false';
    container.innerHTML = `<pre>${escapeText(JSON.stringify(payload, null, 2))}</pre>`;
  }

  function populateCustomDesignGallerySelect(select, options = {}) {
    if (!select) return [];
    const entries = listCustomDesignGallery(options);
    select.innerHTML = entries.map((entry) => `<option value="${escapeText(entry.id)}">${escapeText(entry.title || entry.id)}</option>`).join('');
    return entries;
  }

  function listCustomDesignTemplates(options = {}) {
    const templates = getDesignTemplates();
    return templates && templates.listDesignTemplateEntries ? templates.listDesignTemplateEntries(options) : [];
  }

  function loadCustomDesignTemplate(id, options = {}) {
    const templates = getDesignTemplates();
    if (templates && templates.loadDesignTemplate) return templates.loadDesignTemplate(id, options);
    throw new Error('custom design templates are not available');
  }

  function instantiateCustomDesignTemplate(idOrTemplate, options = {}) {
    const templates = getDesignTemplates();
    if (templates && templates.instantiateDesignTemplate) return templates.instantiateDesignTemplate(idOrTemplate, options);
    const template = typeof idOrTemplate === 'string' ? loadCustomDesignTemplate(idOrTemplate, options) : idOrTemplate;
    return clonePlain(template.design);
  }

  function verifyCustomDesignTemplates(options = {}) {
    const templates = getDesignTemplates();
    if (templates && templates.verifyDesignTemplates) return templates.verifyDesignTemplates(options);
    return { ok: false, templateCount: 0, results: [], error: 'custom design templates are not available' };
  }

  function populateCustomDesignTemplateSelect(select, options = {}) {
    if (!select) return [];
    const entries = listCustomDesignTemplates(options);
    select.innerHTML = entries.map((entry) => `<option value="${escapeText(entry.id)}">${escapeText(entry.title || entry.id)}</option>`).join('');
    return entries;
  }

  function renderCustomDesignTemplateWalkthrough(container, template) {
    if (!container) return;
    if (!template) {
      container.innerHTML = 'No custom-design template selected.';
      return;
    }
    const steps = template.walkthrough || [];
    container.innerHTML = `<h4>${escapeText(template.title || template.id)}</h4><p>${escapeText(template.description || '')}</p><ol>${steps.map((step) => `<li><strong>${escapeText(step.title || 'Step')}</strong>: ${escapeText(step.text || '')}</li>`).join('')}</ol>`;
  }

  function renderCustomDesignRunOptions(container, design) {
    if (!container) return [];
    const runtime = getDesignRuntime();
    const names = runtime && runtime.availableDesignOutputNames ? runtime.availableDesignOutputNames(design) : fallbackAvailableDesignOutputNames(design);
    container.innerHTML = `<fieldset><legend>Plot outputs</legend>${names.map((name) => `<label class="checkbox-row"><input type="checkbox" data-run-output-name="${escapeText(name)}" checked> ${escapeText(name)}</label>`).join('')}</fieldset>`;
    return names;
  }

  function readSelectedRunOutputs(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('[data-run-output-name]')).filter((input) => input.checked).map((input) => input.dataset.runOutputName);
  }

  function renderCustomDesignRunSummary(container, payload) {
    if (!container) return;
    const summary = payload && payload.summary ? payload.summary : summarizeDesignRunResult(payload);
    container.dataset.valid = summary && summary.overload ? 'false' : 'true';
    container.innerHTML = `<pre>${escapeText(JSON.stringify(summary, null, 2))}</pre>`;
  }

  function drawCustomDesignTrace(canvas, payload) {
    const browserRuntime = getBrowserPatchRuntime();
    if (browserRuntime && browserRuntime.drawRuntimeTrace) browserRuntime.drawRuntimeTrace(canvas, payload.result || payload, { outputNames: (payload.selectedOutputNames || []) });
  }

  function initCustomDesignApp(doc = document, options = {}) {
    const summaryNode = doc.getElementById('customDesignSummary');
    const refreshButton = doc.getElementById('refreshCustomDesignSummary');
    const downloadButton = doc.getElementById('downloadDesignJson');
    const controlsNode = doc.getElementById('customDesignControls');
    const warningsNode = doc.getElementById('customDesignWarnings');
    const validationNode = doc.getElementById('customDesignValidation');
    const panelOverlayNode = doc.getElementById('customDesignPanelOverlay');
    const historyStatusNode = doc.getElementById('customDesignHistoryStatus');
    const undoDesignButton = doc.getElementById('undoCustomDesignEdit');
    const redoDesignButton = doc.getElementById('redoCustomDesignEdit');
    const markDesignSavedButton = doc.getElementById('markCustomDesignSaved');
    const runOptionsNode = doc.getElementById('customDesignRunOptions');
    const runButton = doc.getElementById('runCustomDesign');
    const exportTraceButton = doc.getElementById('exportCustomDesignTrace');
    const importTextarea = doc.getElementById('customDesignImportJson');
    const importButton = doc.getElementById('importDesignJsonText');
    const importFileInput = doc.getElementById('designJsonFileInput');
    const saveDraftButton = doc.getElementById('saveCustomDesignDraft');
    const loadDraftButton = doc.getElementById('loadCustomDesignDraft');
    const clearDraftButton = doc.getElementById('clearCustomDesignDraft');
    const gallerySelect = doc.getElementById('customDesignGallerySelect');
    const loadGalleryButton = doc.getElementById('loadCustomDesignGalleryDesign');
    const templateSelect = doc.getElementById('customDesignTemplateSelect');
    const loadTemplateButton = doc.getElementById('loadCustomDesignTemplate');
    const verifyTemplatesButton = doc.getElementById('verifyCustomDesignTemplates');
    const templateWalkthroughNode = doc.getElementById('customDesignTemplateWalkthrough');
    const templateGuidanceNode = doc.getElementById('customDesignTemplateGuidance');
    const storageStatusNode = doc.getElementById('customDesignStorageStatus');
    const runSummaryNode = doc.getElementById('customDesignRunSummary');
    const runCanvas = doc.getElementById('customDesignRunCanvas');
    let lastRunPayload = null;
    let designHistoryState = null;
    let currentRepairSession = null;
    function currentPatch() {
      if (options.getPatch) return options.getPatch();
      const editor = globalScope.AnalogThingPatchEditorInstance;
      return editor && editor.getPatch ? editor.getPatch() : null;
    }
    function replacePatch(patch) {
      if (options.replacePatch) return options.replacePatch(patch);
      const editor = globalScope.AnalogThingPatchEditorInstance;
      if (editor && editor.replacePatch) return editor.replacePatch(patch);
      return null;
    }
    function ensureDesignHistory(design) {
      const history = getDesignHistory();
      if (!history || !history.createDesignHistoryState) return null;
      if (!designHistoryState) designHistoryState = history.createDesignHistoryState(design || designFromPatch(currentPatch() || {}, { name: 'Browser custom design draft' }));
      renderCustomDesignHistoryStatus(historyStatusNode, designHistoryState);
      return designHistoryState;
    }
    function recordDesignEdit(nextDesign, label, editType) {
      const history = getDesignHistory();
      if (!history || !history.recordDesignHistory) return null;
      ensureDesignHistory(designFromPatch(currentPatch(), { name: 'Browser custom design draft' }));
      const result = history.recordDesignHistory(designHistoryState, nextDesign, { label, editType });
      designHistoryState = result.state;
      renderCustomDesignHistoryStatus(historyStatusNode, designHistoryState);
      return result;
    }
    function applyDesignHistoryResult(result) {
      if (!result || !result.design) return result;
      designHistoryState = result.state;
      replacePatch(patchFromDesign(result.design));
      refresh({ renderControls: true, skipHistoryBootstrap: true });
      renderCustomDesignHistoryStatus(historyStatusNode, designHistoryState);
      return result;
    }
    function refresh(refreshOptions = {}) {
      const patch = currentPatch();
      if (!patch) return null;
      const smoke = smokeTestDesignRoundTrip(patch, { name: 'Browser custom design draft' });
      renderDesignSummary(summaryNode, smoke.summary || { error: smoke.error }, smoke);
      const state = refreshOptions.renderControls === false ? controlStateFromPatch(patch) : renderCustomDesignControls(controlsNode, patch);
      renderControlWarnings(warningsNode, state || controlStateFromPatch(patch));
      if (smoke && smoke.design) {
        if (!refreshOptions.skipHistoryBootstrap) ensureDesignHistory(smoke.design);
        const validation = validateDesign(smoke.design);
        renderCustomDesignValidation(validationNode, validation, smoke.design);
        renderCustomDesignPanelOverlay(panelOverlayNode, smoke.design, { validation });
        renderCustomDesignRunOptions(runOptionsNode, smoke.design);
      }
      return smoke;
    }
    function downloadDesignJson() {
      const smoke = refresh({ renderControls: false });
      if (!smoke || !smoke.design) return null;
      const exported = createDesignExportPayload(smoke.design);
      const blob = new Blob([exported.json], { type: exported.mimeType || 'application/json' });
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = exported.filename || 'custom_design.design.json';
      a.click();
      URL.revokeObjectURL(a.href);
      renderCustomDesignStorageStatus(storageStatusNode, { action: 'download-design-json', filename: a.download, byteLength: exported.byteLength, summary: exported.summary }, true);
      return exported;
    }
    function applyControls() {
      const patch = currentPatch();
      if (!patch || !controlsNode) return null;
      const state = readCustomDesignControlForm(controlsNode);
      const nextPatch = patchWithControlState(patch, state);
      replacePatch(nextPatch);
      renderControlWarnings(warningsNode, controlStateFromPatch(nextPatch));
      const smoke = smokeTestDesignRoundTrip(nextPatch, { name: 'Browser custom design draft' });
      renderDesignSummary(summaryNode, smoke.summary || { error: smoke.error }, smoke);
      if (smoke && smoke.design) {
        recordDesignEdit(smoke.design, 'Updated custom-design controls', 'controls');
        const validation = validateDesign(smoke.design);
        renderCustomDesignValidation(validationNode, validation, smoke.design);
        renderCustomDesignPanelOverlay(panelOverlayNode, smoke.design, { validation });
        renderCustomDesignRunOptions(runOptionsNode, smoke.design);
      }
      return nextPatch;
    }
    function applyPreset(presetId) {
      const controls = getDesignControls();
      const coefficients = controls && controls.coefficientControlsFromPreset ? controls.coefficientControlsFromPreset(presetId || 'default') : fallbackCoefficientControlsFromPatch({ components: [], cables: [], parameters: {} });
      for (const [id, value] of Object.entries(coefficients)) updateCoefficientMirrors(controlsNode, id, value);
      return applyControls();
    }
    function runCurrentDesign() {
      const patch = currentPatch();
      if (!patch) return null;
      const selectedOutputNames = readSelectedRunOutputs(runOptionsNode);
      const design = designFromPatch(patch, { name: 'Browser custom design run' });
      renderCustomDesignValidation(validationNode, validateDesign(design), design);
      lastRunPayload = runCustomDesign(design, { selectedOutputNames, filterTrace: true });
      renderCustomDesignRunSummary(runSummaryNode, lastRunPayload);
      drawCustomDesignTrace(runCanvas, lastRunPayload);
      return lastRunPayload;
    }
    function exportCustomDesignTrace() {
      const payload = lastRunPayload || runCurrentDesign();
      if (!payload) return;
      const exported = designTraceExportPayload(payload);
      const blob = new Blob([exported.json], { type: 'application/json' });
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'custom_design_trace.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }
    function applyImportedDesign(design, sourceKind = 'design') {
      const nextPatch = patchFromDesign(design);
      replacePatch(nextPatch);
      recordDesignEdit(design, `Loaded ${sourceKind} design`, 'import');
      const smoke = refresh({ skipHistoryBootstrap: true });
      renderCustomDesignStorageStatus(storageStatusNode, { action: 'import-design', sourceKind, summary: summarizeDesign(design), validation: validateDesign(design) }, Boolean(smoke && smoke.ok));
      return nextPatch;
    }
    function importDesignTextFromTextarea() {
      if (!importTextarea) return null;
      const imported = parseDesignImportText(importTextarea.value, { name: 'Imported custom design' });
      if (!imported.ok) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'import-design', ok: false, error: imported.error, sourceKind: imported.sourceKind }, false);
        return imported;
      }
      applyImportedDesign(imported.design, imported.sourceKind);
      return imported;
    }
    function importDesignFile(file) {
      if (!file || typeof FileReader === 'undefined') return null;
      const reader = new FileReader();
      reader.onload = () => {
        if (importTextarea) importTextarea.value = String(reader.result || '');
        importDesignTextFromTextarea();
      };
      reader.onerror = () => renderCustomDesignStorageStatus(storageStatusNode, { action: 'import-design-file', ok: false, error: 'Could not read selected file.' }, false);
      reader.readAsText(file);
      return file;
    }
    function saveCurrentDraft() {
      const smoke = refresh({ renderControls: false });
      if (!smoke || !smoke.design) return null;
      try {
        const envelope = saveDesignDraft(smoke.design, options);
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'save-draft', savedAt: envelope.savedAt, name: envelope.name, summary: envelope.summary }, true);
        return envelope;
      } catch (error) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'save-draft', ok: false, error: error.message }, false);
        return null;
      }
    }
    function loadSavedDraft() {
      const loaded = loadDesignDraft(options);
      if (!loaded.ok) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'load-draft', ok: false, error: loaded.error }, false);
        return loaded;
      }
      applyImportedDesign(loaded.design, 'draft');
      return loaded;
    }
    function clearSavedDraft() {
      try {
        const cleared = clearDesignDraft(options);
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'clear-draft', ok: true, key: cleared.key }, true);
        return cleared;
      } catch (error) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'clear-draft', ok: false, error: error.message }, false);
        return null;
      }
    }
    function applyRepairActionById(actionId) {
      const patch = currentPatch();
      if (!patch) return null;
      const design = designFromPatch(patch, { name: 'Browser custom design repair' });
      const validation = validateDesign(design);
      const actions = repairActionsForValidation(validation, design);
      const action = actions.find((entry) => entry.id === actionId);
      if (!action) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'repair-design', ok: false, error: `Unknown repair action ${actionId}` }, false);
        return null;
      }
      try {
        const repaired = applyDesignRepairAction(design, action);
        replacePatch(patchFromDesign(repaired.design));
        recordDesignEdit(repaired.design, action.label || action.operation, 'repair');
        const smoke = refresh({ skipHistoryBootstrap: true });
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'repair-design', repairAction: action, validation: validateDesign(repaired.design), summary: summarizeDesign(repaired.design) }, Boolean(smoke && smoke.ok));
        return repaired;
      } catch (error) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'repair-design', ok: false, error: error.message }, false);
        return null;
      }
    }
    function applyRepairBatchByMode(mode = 'next') {
      const patch = currentPatch();
      if (!patch) return null;
      const design = designFromPatch(patch, { name: 'Browser custom design batch repair' });
      const validation = validateDesign(design);
      try {
        let result;
        if (mode === 'all') {
          currentRepairSession = createGuidedRepairSession(design, validation, { maxSteps: 12 });
          currentRepairSession = applyAllGuidedRepairSessionSteps(currentRepairSession, { maxSteps: 12 });
          result = currentRepairSession;
        } else {
          currentRepairSession = currentRepairSession && currentRepairSession.pendingStepCount ? currentRepairSession : createGuidedRepairSession(design, validation, { maxSteps: 12 });
          currentRepairSession = applyNextGuidedRepairSessionStep(currentRepairSession, { maxSteps: 1 });
          result = currentRepairSession;
        }
        try { saveGuidedRepairSessionDraft(result, options); } catch (ignored) { /* local storage may be unavailable */ }
        const nextDesign = result.design || design;
        replacePatch(patchFromDesign(nextDesign));
        recordDesignEdit(nextDesign, mode === 'all' ? 'Applied all recommended repairs' : 'Applied next recommended repair', 'repair-batch');
        const smoke = refresh({ skipHistoryBootstrap: true });
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'repair-batch', mode, summary: mode === 'all' ? repairBatchSummary(result) : repairSessionSummary(result), validation: validateDesign(nextDesign) }, Boolean(smoke && smoke.ok));
        return result;
      } catch (error) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'repair-batch', mode, ok: false, error: error.message }, false);
        return null;
      }
    }

    function applyPhysicalAccessoryMaterialization() {
      const patch = currentPatch();
      if (!patch) return null;
      const design = designFromPatch(patch, { name: 'Browser custom design physical-accessory conversion' });
      try {
        const preview = previewPhysicalAccessoryMaterialization(design);
        const bridge = materializePhysicalAccessoriesForDesign(design);
        if (!bridge.materializedCount) {
          renderCustomDesignStorageStatus(storageStatusNode, { action: 'materialize-physical-accessories', ok: false, preview, error: 'No complete physical capacitor/diode/Z-diode terminal pairs are ready to convert.' }, false);
          return bridge;
        }
        replacePatch(patchFromDesign(bridge.design));
        recordDesignEdit(bridge.design, 'Converted physical accessories to logical runtime components', 'physical-accessory-materialization');
        const smoke = refresh({ skipHistoryBootstrap: true });
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'materialize-physical-accessories', ok: true, preview, materializedCount: bridge.materializedCount, addedComponentIds: bridge.addedComponentIds, removedCableIds: bridge.removedCableIds, validation: validateDesign(bridge.design), summary: summarizeDesign(bridge.design) }, Boolean(smoke && smoke.ok));
        return bridge;
      } catch (error) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'materialize-physical-accessories', ok: false, error: error.message }, false);
        return null;
      }
    }

    function undoDesignEdit() {
      const history = getDesignHistory();
      ensureDesignHistory();
      if (!history || !history.undoDesignHistory) return null;
      return applyDesignHistoryResult(history.undoDesignHistory(designHistoryState));
    }
    function redoDesignEdit() {
      const history = getDesignHistory();
      ensureDesignHistory();
      if (!history || !history.redoDesignHistory) return null;
      return applyDesignHistoryResult(history.redoDesignHistory(designHistoryState));
    }
    function markDesignSaved() {
      const history = getDesignHistory();
      ensureDesignHistory();
      if (history && history.markDesignHistorySaved) designHistoryState = history.markDesignHistorySaved(designHistoryState);
      renderCustomDesignHistoryStatus(historyStatusNode, designHistoryState);
      return designHistoryState;
    }
    function loadSelectedGalleryDesign() {
      if (!gallerySelect) return null;
      try {
        const design = loadCustomDesignGalleryDesign(gallerySelect.value, options.galleryOptions || {});
        applyImportedDesign(design, 'gallery');
        return design;
      } catch (error) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'load-gallery-design', ok: false, error: error.message }, false);
        return null;
      }
    }
    function loadSelectedTemplateDesign() {
      if (!templateSelect) return null;
      try {
        const template = loadCustomDesignTemplate(templateSelect.value, options.templateOptions || {});
        const design = instantiateCustomDesignTemplate(template, options.templateOptions || {});
        renderCustomDesignTemplateWalkthrough(templateWalkthroughNode, template);
        renderTemplateGuidedEditingPlan(templateGuidanceNode, template, options.templateOptions || {});
        applyImportedDesign(design, 'template');
        renderCustomDesignPanelOverlay(panelOverlayNode, customTemplatePanelOverlay(template, options.templateOptions || {}));
        return template;
      } catch (error) {
        renderCustomDesignStorageStatus(storageStatusNode, { action: 'load-template-design', ok: false, error: error.message }, false);
        return null;
      }
    }
    function verifyTemplates() {
      const result = verifyCustomDesignTemplates(options.templateOptions || {});
      renderCustomDesignStorageStatus(storageStatusNode, Object.assign({ action: 'verify-design-templates' }, result), Boolean(result.ok));
      return result;
    }
    populateCustomDesignGallerySelect(gallerySelect, options.galleryOptions || {});
    populateCustomDesignTemplateSelect(templateSelect, options.templateOptions || {});
    if (templateSelect) {
      try { const template = loadCustomDesignTemplate(templateSelect.value, options.templateOptions || {}); renderCustomDesignTemplateWalkthrough(templateWalkthroughNode, template); renderTemplateGuidedEditingPlan(templateGuidanceNode, template, options.templateOptions || {}); } catch (error) { renderCustomDesignTemplateWalkthrough(templateWalkthroughNode, null); renderTemplateGuidedEditingPlan(templateGuidanceNode, { id: '', title: 'No template', walkthrough: [], design: { schemaVersion: DESIGN_SCHEMA_VERSION, kind: 'custom-design', components: [], cables: [] } }, options.templateOptions || {}); }
      templateSelect.addEventListener('change', () => {
        try { const template = loadCustomDesignTemplate(templateSelect.value, options.templateOptions || {}); renderCustomDesignTemplateWalkthrough(templateWalkthroughNode, template); renderTemplateGuidedEditingPlan(templateGuidanceNode, template, options.templateOptions || {}); } catch (error) { renderCustomDesignTemplateWalkthrough(templateWalkthroughNode, null); }
      });
    }

    if (refreshButton) refreshButton.addEventListener('click', () => refresh());
    if (downloadButton) downloadButton.addEventListener('click', downloadDesignJson);
    if (importButton) importButton.addEventListener('click', importDesignTextFromTextarea);
    if (importFileInput) importFileInput.addEventListener('change', () => importDesignFile(importFileInput.files && importFileInput.files[0]));
    if (saveDraftButton) saveDraftButton.addEventListener('click', saveCurrentDraft);
    if (loadDraftButton) loadDraftButton.addEventListener('click', loadSavedDraft);
    if (clearDraftButton) clearDraftButton.addEventListener('click', clearSavedDraft);
    if (loadGalleryButton) loadGalleryButton.addEventListener('click', loadSelectedGalleryDesign);
    if (loadTemplateButton) loadTemplateButton.addEventListener('click', loadSelectedTemplateDesign);
    if (verifyTemplatesButton) verifyTemplatesButton.addEventListener('click', verifyTemplates);
    if (runButton) runButton.addEventListener('click', runCurrentDesign);
    if (undoDesignButton) undoDesignButton.addEventListener('click', undoDesignEdit);
    if (redoDesignButton) redoDesignButton.addEventListener('click', redoDesignEdit);
    if (markDesignSavedButton) markDesignSavedButton.addEventListener('click', markDesignSaved);
    if (validationNode) validationNode.addEventListener('click', (event) => {
      const target = event.target;
      if (target && target.dataset && target.dataset.designRepairAction) applyRepairActionById(target.dataset.designRepairAction);
      if (target && target.dataset && target.dataset.designRepairBatch) applyRepairBatchByMode(target.dataset.designRepairBatch);
      if (target && target.dataset && target.dataset.physicalAccessoryMaterialize) applyPhysicalAccessoryMaterialization();
    });
    if (exportTraceButton) exportTraceButton.addEventListener('click', exportCustomDesignTrace);
    if (controlsNode) {
      controlsNode.addEventListener('input', (event) => {
        const target = event.target;
        if (target && target.dataset && target.dataset.customCoeffRange) updateCoefficientMirrors(controlsNode, target.dataset.customCoeffRange, target.value);
        if (target && target.dataset && target.dataset.customCoeffNumber) updateCoefficientMirrors(controlsNode, target.dataset.customCoeffNumber, target.value);
        if (target && target.dataset && (target.dataset.customCoeffRange || target.dataset.customCoeffNumber || target.dataset.operationControl || target.dataset.outputRoute)) applyControls();
      });
      controlsNode.addEventListener('change', (event) => {
        const target = event.target;
        if (target && target.dataset && target.dataset.applyCoefficientPreset !== undefined) applyPreset(controlsNode.querySelector('[data-coefficient-preset]').value);
        else if (target && target.dataset && target.dataset.resetCoefficients !== undefined) applyPreset('default');
        else if (target && target.dataset && (target.dataset.operationControl || target.dataset.outputRoute)) applyControls();
      });
      controlsNode.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.dataset && target.dataset.applyCoefficientPreset !== undefined) applyPreset(controlsNode.querySelector('[data-coefficient-preset]').value);
        if (target && target.dataset && target.dataset.resetCoefficients !== undefined) applyPreset('default');
      });
    }
    refresh();
    return { refresh, downloadDesignJson, createDesignExportPayload, parseDesignImportText, smokeTestDesignImportExport, importDesignTextFromTextarea, importDesignFile, saveCurrentDraft, loadSavedDraft, clearSavedDraft, listCustomDesignGallery, loadCustomDesignGalleryDesign, loadSelectedGalleryDesign, listCustomDesignTemplates, loadCustomDesignTemplate, instantiateCustomDesignTemplate, loadSelectedTemplateDesign, verifyCustomDesignTemplates, verifyTemplates, renderCustomDesignTemplateWalkthrough, smokeTestDesignRoundTrip, renderCustomDesignControls, readCustomDesignControlForm, applyControls, applyPreset, applyRepairActionById, applyRepairBatchByMode, applyPhysicalAccessoryMaterialization, previewGuidedRepairBatch, applyGuidedRepairBatch, repairBatchSummary, createGuidedRepairSession, applyNextGuidedRepairSessionStep, applyAllGuidedRepairSessionSteps, skipGuidedRepairSessionStep, repairSessionSummary, saveGuidedRepairSessionDraft, loadGuidedRepairSessionDraft, clearGuidedRepairSessionDraft, customDesignPanelOverlay, customTemplatePanelOverlay, customPanelOverlayLegend, templateGuidedEditingPlan, renderCustomDesignPanelOverlay, renderCustomDesignOverlayLegend, renderTemplateGuidedEditingPlan, renderGuidedRepairSession, undoDesignEdit, redoDesignEdit, markDesignSaved, runCurrentDesign, exportCustomDesignTrace };
  }

  const api = {
    DESIGN_SCHEMA_VERSION,
    designFromPatch,
    patchFromDesign,
    summarizeDesign,
    controlStateFromPatch,
    patchWithControlState,
    controlWarnings,
    validateDesign,
    summarizeDesignValidation,
    repairActionsForValidation,
    repairSummaryForValidation,
    previewRepairAction,
    guidedRepairWorkflowForValidation,
    applyDesignRepairAction,
    previewGuidedRepairBatch,
    applyGuidedRepairBatch,
    repairBatchSummary,
    createGuidedRepairSession,
    applyNextGuidedRepairSessionStep,
    applyAllGuidedRepairSessionSteps,
    skipGuidedRepairSessionStep,
    repairSessionSummary,
    saveGuidedRepairSessionDraft,
    loadGuidedRepairSessionDraft,
    clearGuidedRepairSessionDraft,
    customDesignPanelOverlay,
    customTemplatePanelOverlay,
    customPanelOverlayLegend,
    templateGuidedEditingPlan,
    renderCustomDesignPanelOverlay,
    renderCustomDesignOverlayLegend,
    renderTemplateGuidedEditingPlan,
    renderGuidedRepairSession,
    summarizeDesignAccessories,
    summarizePanelAccessories,
    previewPhysicalAccessoryMaterialization,
    materializePhysicalAccessoriesForDesign,
    renderCustomDesignValidation,
    renderCustomDesignHistoryStatus,
    summarizeDesignRunResult,
    runCustomDesign,
    runCustomDesignFromPatch,
    designTraceExportPayload,
    createDesignExportPayload,
    parseDesignImportText,
    smokeTestDesignImportExport,
    saveDesignDraft,
    loadDesignDraft,
    clearDesignDraft,
    listCustomDesignGallery,
    loadCustomDesignGalleryDesign,
    populateCustomDesignGallerySelect,
    listCustomDesignTemplates,
    loadCustomDesignTemplate,
    instantiateCustomDesignTemplate,
    populateCustomDesignTemplateSelect,
    renderCustomDesignTemplateWalkthrough,
    verifyCustomDesignTemplates,
    renderCustomDesignStorageStatus,
    renderCustomDesignRunOptions,
    readSelectedRunOutputs,
    renderCustomDesignRunSummary,
    drawCustomDesignTrace,
    renderCustomDesignControls,
    readCustomDesignControlForm,
    smokeTestDesignRoundTrip,
    initCustomDesignApp,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingCustomDesignApp = api;
}(typeof window !== 'undefined' ? window : global));
