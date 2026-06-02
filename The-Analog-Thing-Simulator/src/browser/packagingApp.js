/* global window, document */
'use strict';

(function attachPackagingApp(globalScope) {
  const DEFAULT_PATCH_FILENAME = 'analog-thing-patch.json';

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeText(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function normalizeLineEndings(text) {
    return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function getPatchEditorApp() {
    if (globalScope.AnalogThingPatchEditorApp) return globalScope.AnalogThingPatchEditorApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./patchEditorApp'); } catch (error) { return null; }
    }
    return null;
  }

  function getEducationApp() {
    if (globalScope.AnalogThingEducationApp) return globalScope.AnalogThingEducationApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./educationApp'); } catch (error) { return null; }
    }
    return null;
  }

  function getBrowserRuntime() {
    if (globalScope.AnalogThingBrowserPatchRuntime) return globalScope.AnalogThingBrowserPatchRuntime;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./browserPatchRuntime'); } catch (error) { return null; }
    }
    return null;
  }

  function stableClone(value) {
    if (Array.isArray(value)) return value.map(stableClone);
    if (value && typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value).sort()) result[key] = stableClone(value[key]);
      return result;
    }
    return value;
  }

  function stableJson(value, spacing = 2) {
    return `${JSON.stringify(stableClone(value), null, spacing)}\n`;
  }

  function createPatchExportPayload(patch, options = {}) {
    const editor = getPatchEditorApp();
    const normalized = editor && editor.normalizeSerializedPatch ? editor.normalizeSerializedPatch(patch) : clonePlain(patch);
    const filename = options.filename || DEFAULT_PATCH_FILENAME;
    const json = stableJson(normalized, options.spacing === undefined ? 2 : options.spacing);
    return {
      filename,
      mimeType: 'application/json',
      json,
      byteLength: (typeof Buffer !== 'undefined' && Buffer.byteLength) ? Buffer.byteLength(json, 'utf8') : json.length,
      patch: normalized,
      summary: summarizeExportedPatch(normalized),
    };
  }

  function parsePatchImportText(text) {
    try {
      const patch = JSON.parse(normalizeLineEndings(text));
      const editor = getPatchEditorApp();
      const normalized = editor && editor.normalizeSerializedPatch ? editor.normalizeSerializedPatch(patch) : patch;
      return { ok: true, patch: normalized, error: null };
    } catch (error) {
      return { ok: false, patch: null, error: error.message };
    }
  }

  function summarizeExportedPatch(patch) {
    const components = Array.isArray(patch && patch.components) ? patch.components : [];
    const cables = Array.isArray(patch && patch.cables) ? patch.cables : (Array.isArray(patch && patch.connections) ? patch.connections : []);
    const outputs = patch && patch.outputs ? Object.keys(patch.outputs) : [];
    const coefficients = components.filter((component) => component && component.coefficient !== undefined);
    return {
      name: patch && patch.name ? patch.name : 'unnamed patch',
      schemaVersion: patch && patch.schemaVersion !== undefined ? patch.schemaVersion : null,
      inventory: patch && patch.inventory ? patch.inventory : null,
      componentCount: components.length,
      cableCount: cables.length,
      outputCount: outputs.length,
      outputs,
      coefficientCount: coefficients.length,
      coefficientIds: coefficients.map((component) => component.id).sort(),
    };
  }

  function smokeTestPatchImportExport(patch, options = {}) {
    const editor = getPatchEditorApp();
    const runtime = getBrowserRuntime();
    const exported = createPatchExportPayload(patch, options);
    const imported = parsePatchImportText(exported.json);
    const normalizedOriginal = exported.patch;
    let validation = { ok: imported.ok, errors: imported.ok ? [] : [imported.error], warnings: [] };
    if (imported.ok && editor && editor.validateSerializedPatchForBrowser) {
      const templateId = editor.inferTemplateIdFromPatch ? editor.inferTemplateIdFromPatch(imported.patch) : undefined;
      const panelModel = editor.templatePanelModelFromSerializedPatch ? editor.templatePanelModelFromSerializedPatch(imported.patch, templateId) : undefined;
      validation = editor.validateSerializedPatchForBrowser(imported.patch, panelModel);
    }
    let runtimeOk = null;
    let runtimeError = null;
    if (imported.ok && runtime && runtime.createRuntimeMachineFromSerializedPatch) {
      try {
        runtime.createRuntimeMachineFromSerializedPatch(imported.patch);
        runtimeOk = true;
      } catch (error) {
        runtimeOk = false;
        runtimeError = error.message;
      }
    }
    const canonicalOriginal = stableJson(normalizedOriginal, 0);
    const canonicalImported = imported.ok ? stableJson(imported.patch, 0) : '';
    return {
      ok: imported.ok && validation.ok && canonicalOriginal === canonicalImported && runtimeOk !== false,
      exported,
      importedOk: imported.ok,
      importError: imported.error,
      roundTripEqual: canonicalOriginal === canonicalImported,
      validationOk: validation.ok,
      validationErrors: validation.errors || [],
      validationWarnings: validation.warnings || [],
      runtimeOk,
      runtimeError,
      action: imported.ok && validation.ok
        ? 'Patch JSON can be exported, parsed again, validated, and reused by the browser runtime.'
        : 'Fix JSON syntax and validation errors before saving or sharing this patch.',
    };
  }

  function browserUserGuideSections() {
    return [
      {
        id: 'open',
        title: 'Open the simulator',
        steps: [
          'Open public/index.html directly in a browser; no build step or package install is required.',
          'Use the quickstart oscillator controls first to verify that the trace canvas updates.',
        ],
      },
      {
        id: 'run',
        title: 'Run and interpret a patch',
        steps: [
          'Choose IC to inspect initial conditions, OP for a single run, HALT to freeze state, or REPF for repeated oscilloscope-style sweeps.',
          'Keep displayed values inside ±1 machine unit unless you intentionally test overload behavior.',
        ],
      },
      {
        id: 'edit',
        title: 'Edit serialized patches',
        steps: [
          'Pick a patch template, adjust its coefficients, and inspect the cable list or JSON editor.',
          'Use the SVG panel to add or remove cables when a visual edit is clearer than raw JSON.',
        ],
      },
      {
        id: 'import-export',
        title: 'Import, export, and share',
        steps: [
          'Exported patch JSON is the durable artifact: it includes components, cables, outputs, and parameter metadata.',
          'Before sharing, run the smoke test and check that JSON parsing, validation, and runtime materialization all pass.',
        ],
      },
      {
        id: 'troubleshoot',
        title: 'Troubleshoot validation and overloads',
        steps: [
          'Direction errors usually mean an input was connected to an input or an output to an output; reverse the endpoint order or choose another socket.',
          'Overloads are scale problems first: lower coefficients, shorten OP time, or reduce initial conditions before enabling clipping.',
        ],
      },
    ];
  }

  function troubleshootingHints(validation = {}, overload = {}) {
    const hints = [];
    const errors = Array.isArray(validation.errors) ? validation.errors : [];
    const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
    const add = (id, issue, action, severity = 'error') => {
      if (!hints.some((hint) => hint.id === id)) hints.push({ id, severity, issue, action });
    };
    for (const message of errors) {
      if (/unknown .*component|unknown .*socket/i.test(message)) add('unknown-socket', 'A cable references a component or socket that is not present in the selected template.', 'Choose sockets from the visible panel/template, or add the missing component to the serialized patch.');
      if (/not an output socket|not an input socket/i.test(message)) add('direction', 'A cable endpoint has the wrong direction.', 'Connect from an output socket to an input socket. The click editor normalizes endpoint order when possible.');
      if (/ordinary input .* drivers/i.test(message)) add('multiple-drivers', 'An ordinary input has more than one driver.', 'Remove the extra cable or route signals through a summer/XIR summing junction instead.');
      if (/required input .* not connected/i.test(message)) add('missing-required', 'A required input is unconnected.', 'Add a cable from a constant, coefficient output, integrator output, or another valid source.');
      if (/stateless cycle/i.test(message)) add('stateless-cycle', 'The patch contains a feedback cycle without integrator state.', 'Break the loop with an integrator or restructure the patch so feedback is represented as state.');
      if (/runtime validation/i.test(message)) add('runtime-validation', 'The browser runtime rejected the patch after editor-level validation.', 'Inspect the full JSON and compare it with a working gallery patch.');
    }
    if ((overload && overload.overloaded) || /overload/i.test(warnings.join(' '))) {
      add('overload', 'One or more sampled outputs exceed ±1 machine unit.', 'Lower coefficients, initial conditions, or OP time. Use clipping only as a display/safety option, not as a mathematical fix.', 'warning');
    }
    if (warnings.length > 0) add('warnings', 'The validator produced warnings.', 'Review warning text before exporting; warnings may indicate incomplete parameter metadata.', 'warning');
    if (hints.length === 0) hints.push({ id: 'clear', severity: 'info', issue: 'No validation or overload issue was detected.', action: 'The patch is ready for export or browser execution.' });
    return hints;
  }

  function buildWalkthroughArtifacts() {
    return [
      {
        id: 'first-steps-walkthroughs',
        title: 'First Steps walkthroughs',
        artifact: 'docs/example_walkthroughs.md',
        purpose: 'Summarizes the visible First Steps presets, helper functions, oscilloscope intent, and command-line example runs.',
      },
      {
        id: 'browser-user-guide',
        title: 'Browser user guide',
        artifact: 'docs/browser_user_guide.md',
        purpose: 'Shows how to open, run, edit, save, load, export, and troubleshoot patches from the static HTML workbench.',
      },
      {
        id: 'troubleshooting',
        title: 'Troubleshooting notes',
        artifact: 'docs/troubleshooting.md',
        purpose: 'Lists common validation, runtime, accessory, import/export, and overload failures with direct corrective actions.',
      },
      {
        id: 'architecture',
        title: 'Custom design architecture',
        artifact: 'docs/custom_design_architecture.md',
        purpose: 'Explains the physical socket, design JSON, diagnostics, materialization, executable patch, and runtime layers.',
      },
    ];
  }

  function buildPackagingSummary(options = {}) {
    const patch = options.patch || null;
    const validation = options.validation || {};
    const trace = options.trace || [];
    const education = getEducationApp();
    const overload = education && education.overloadSummaryFromTrace ? education.overloadSummaryFromTrace(trace) : {};
    const smoke = patch ? smokeTestPatchImportExport(patch, options.exportOptions || {}) : null;
    return {
      guideSectionCount: browserUserGuideSections().length,
      walkthroughArtifactCount: buildWalkthroughArtifacts().length,
      troubleshootingHintCount: troubleshootingHints(validation, overload).length,
      importExportSmokeTest: smoke ? {
        ok: smoke.ok,
        byteLength: smoke.exported.byteLength,
        roundTripEqual: smoke.roundTripEqual,
        validationOk: smoke.validationOk,
        runtimeOk: smoke.runtimeOk,
      } : null,
    };
  }

  function renderGuide(container, sections = browserUserGuideSections()) {
    if (!container) return;
    container.innerHTML = sections.map((section) => `<section class="guide-card"><h3>${escapeText(section.title)}</h3><ol>${section.steps.map((step) => `<li>${escapeText(step)}</li>`).join('')}</ol></section>`).join('');
  }

  function renderTroubleshooting(container, hints = troubleshootingHints()) {
    if (!container) return;
    container.innerHTML = `<ul class="troubleshooting-list">${hints.map((hint) => `<li data-severity="${escapeText(hint.severity)}"><strong>${escapeText(hint.issue)}</strong><br>${escapeText(hint.action)}</li>`).join('')}</ul>`;
  }

  function renderSmokeTest(container, smoke) {
    if (!container) return;
    container.dataset.valid = smoke && smoke.ok ? 'true' : 'false';
    container.innerHTML = `<pre>${escapeText(JSON.stringify(smoke || { ok: false, action: 'No patch available.' }, null, 2))}</pre>`;
  }

  function currentPatchFromWindow() {
    const instance = globalScope.AnalogThingPatchEditorInstance;
    if (instance && typeof instance.getPatch === 'function') return instance.getPatch();
    return null;
  }

  function initPackagingGuideApp(rootDocument, options = {}) {
    const doc = rootDocument || document;
    const guideContainer = doc.querySelector('#browserUserGuide');
    const troubleshootingContainer = doc.querySelector('#troubleshootingGuide');
    const smokeContainer = doc.querySelector('#importExportSmokeTest');
    const refreshButton = doc.querySelector('#refreshPackagingGuide');

    function refresh(context = {}) {
      const patch = context.patch || (options.getPatch && options.getPatch()) || currentPatchFromWindow();
      const validation = context.validation || (options.getValidation && options.getValidation()) || {};
      const trace = context.trace || (options.getTrace && options.getTrace()) || [];
      const education = getEducationApp();
      const overload = education && education.overloadSummaryFromTrace ? education.overloadSummaryFromTrace(trace) : {};
      const smoke = patch ? smokeTestPatchImportExport(patch) : null;
      renderGuide(guideContainer);
      renderTroubleshooting(troubleshootingContainer, troubleshootingHints(validation, overload));
      renderSmokeTest(smokeContainer, smoke);
      return buildPackagingSummary({ patch, validation, trace });
    }

    if (refreshButton) refreshButton.addEventListener('click', () => refresh());
    const initialSummary = refresh(options.initialContext || {});
    return { refresh, initialSummary };
  }

  const api = {
    DEFAULT_PATCH_FILENAME,
    normalizeLineEndings,
    stableClone,
    stableJson,
    createPatchExportPayload,
    parsePatchImportText,
    summarizeExportedPatch,
    smokeTestPatchImportExport,
    browserUserGuideSections,
    troubleshootingHints,
    buildWalkthroughArtifacts,
    buildPackagingSummary,
    renderGuide,
    renderTroubleshooting,
    renderSmokeTest,
    initPackagingGuideApp,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingPackagingApp = api;
}(typeof window !== 'undefined' ? window : global));
