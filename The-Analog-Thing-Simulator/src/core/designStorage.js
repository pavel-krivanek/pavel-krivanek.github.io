'use strict';

(function attachDesignStorage(globalScope) {
  const DESIGN_DRAFT_SCHEMA_VERSION = 'analog-thing-design-draft/v1';
  const DESIGN_JSON_MIME_TYPE = 'application/json';
  const DEFAULT_DESIGN_FILENAME = 'custom_design.json';
  const DEFAULT_DRAFT_KEY = 'analogThing.customDesignDraft.v1';
  const GALLERY_MANIFEST_PATH = 'designs/gallery/manifest.json';
  const PATCH_SCHEMA_VERSION = 'analog-thing-patch/v1';
  const DESIGN_SCHEMA_VERSION = 'analog-thing-design/v1';

  const BUILT_IN_GALLERY_MANIFEST = Object.freeze([
    Object.freeze({ id: 'quickstart-damped-oscillation', title: 'Quickstart damped oscillation', category: 'dynamic system', file: 'quickstart-damped-oscillation.design.json' }),
    Object.freeze({ id: 'static-inverter', title: 'Static inverter and coefficient', category: 'linear block', file: 'static-inverter.design.json' }),
    Object.freeze({ id: 'summer-scaling', title: 'Summer scaling and sign', category: 'linear block', file: 'summer-scaling.design.json' }),
    Object.freeze({ id: 'multiplier-product', title: 'Multiplier product', category: 'nonlinear block', file: 'multiplier-product.design.json' }),
    Object.freeze({ id: 'comparator-switch', title: 'Comparator switch', category: 'hybrid-style block', file: 'comparator-switch.design.json' }),
    Object.freeze({ id: 'xir-summing-junction', title: 'XIR summing-junction extension', category: 'patch expansion', file: 'xir-summing-junction.design.json' }),
    Object.freeze({ id: 'first-steps-lunar-landing', title: 'First Steps: Lunar Landing', category: 'First Steps application', file: 'first-steps-lunar-landing.design.json' }),
    Object.freeze({ id: 'first-steps-neuronal-bursting', title: 'First Steps: Neuronal Bursting', category: 'First Steps application', file: 'first-steps-neuronal-bursting.design.json' }),
    Object.freeze({ id: 'first-steps-polynomial-generator', title: 'First Steps: Polynomial Generator', category: 'First Steps application', file: 'first-steps-polynomial-generator.design.json' }),
    Object.freeze({ id: 'first-steps-helper-adjustable-minus-one-plus-one', title: 'First Steps Helper: Adjustable Value -1 to +1', category: 'First Steps helper', file: 'first-steps-helper-adjustable-minus-one-plus-one.design.json' }),
    Object.freeze({ id: 'first-steps-helper-max', title: 'First Steps Helper: Maximum of Two Values', category: 'First Steps helper', file: 'first-steps-helper-max.design.json' }),
    Object.freeze({ id: 'first-steps-helper-min', title: 'First Steps Helper: Minimum of Two Values', category: 'First Steps helper', file: 'first-steps-helper-min.design.json' }),
    Object.freeze({ id: 'first-steps-helper-abs', title: 'First Steps Helper: Absolute Value', category: 'First Steps helper', file: 'first-steps-helper-abs.design.json' }),
    Object.freeze({ id: 'first-steps-helper-non-negative-only', title: 'First Steps Helper: Non-Negative Values Only', category: 'First Steps helper', file: 'first-steps-helper-non-negative-only.design.json' }),
    Object.freeze({ id: 'slow-integrator-ramp', title: 'Slow integrator ramp', category: 'dynamic system', file: 'slow-integrator-ramp.design.json' }),
  ]);

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }

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

  function normalizeLineEndings(text) {
    return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function safeFilename(name, extension = '.json') {
    const cleaned = String(name || 'custom-design')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'custom-design';
    return cleaned.endsWith(extension) ? cleaned : `${cleaned}${extension}`;
  }

  function byteLength(text) {
    return (typeof Buffer !== 'undefined' && Buffer.byteLength) ? Buffer.byteLength(text, 'utf8') : String(text).length;
  }

  function getCoreDesign() {
    if (globalScope.AnalogThingCoreDesign) return globalScope.AnalogThingCoreDesign;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./design'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignDiagnostics() {
    if (globalScope.AnalogThingDesignDiagnostics) return globalScope.AnalogThingDesignDiagnostics;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./designDiagnostics'); } catch (error) { return null; }
    }
    return null;
  }

  function getCustomDesignApp() {
    if (globalScope.AnalogThingCustomDesignApp) return globalScope.AnalogThingCustomDesignApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../browser/customDesignApp'); } catch (error) { return null; }
    }
    return null;
  }

  function getAdoptedPatchPanelEditor() {
    if (globalScope.AnalogThingAdoptedPatchPanelEditor) return globalScope.AnalogThingAdoptedPatchPanelEditor;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./adoptedPatchPanelEditor'); } catch (error) { return null; }
    }
    return null;
  }

  function getSerializedGallery() {
    if (globalScope.AnalogThingSerializedGalleryApp) return globalScope.AnalogThingSerializedGalleryApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../examples/serializedGallery'); } catch (error) { /* fall through */ }
      try { return require('../browser/serializedGalleryApp'); } catch (error) { return null; }
    }
    return null;
  }

  function normalizeDesign(design, options = {}) {
    const core = getCoreDesign();
    if (core && core.normalizeDesign) return core.normalizeDesign(design, options);
    const app = getCustomDesignApp();
    if (app && app.patchFromDesign && design && design.schemaVersion === DESIGN_SCHEMA_VERSION) {
      app.patchFromDesign(design);
      return clonePlain(design);
    }
    if (!design || typeof design !== 'object') throw new Error('design must be an object');
    if (design.schemaVersion && design.schemaVersion !== DESIGN_SCHEMA_VERSION) throw new Error(`unsupported design schemaVersion: ${design.schemaVersion}`);
    return clonePlain(Object.assign({ schemaVersion: DESIGN_SCHEMA_VERSION, kind: 'custom-design' }, design));
  }

  function summarizeDesign(design) {
    const core = getCoreDesign();
    if (core && core.summarizeDesign) return core.summarizeDesign(design);
    const app = getCustomDesignApp();
    if (app && app.summarizeDesign) return app.summarizeDesign(design);
    return {
      schemaVersion: design && design.schemaVersion,
      name: design && design.metadata ? design.metadata.name : 'unnamed design',
      componentCount: Array.isArray(design && design.components) ? design.components.length : 0,
      cableCount: Array.isArray(design && design.cables) ? design.cables.length : 0,
    };
  }

  function designFromSerializedPatch(patch, options = {}) {
    const core = getCoreDesign();
    if (core && core.designFromSerializedPatch) return core.designFromSerializedPatch(patch, options);
    const app = getCustomDesignApp();
    if (app && app.designFromPatch) return app.designFromPatch(patch, options);
    throw new Error('patch-to-design import is not available in this environment');
  }

  function serializedPatchFromDesign(design, options = {}) {
    const core = getCoreDesign();
    if (core && core.serializedPatchFromDesign) return core.serializedPatchFromDesign(design, options);
    const app = getCustomDesignApp();
    if (app && app.patchFromDesign) return app.patchFromDesign(design, options);
    throw new Error('design-to-patch conversion is not available in this environment');
  }

  function validateDesign(design) {
    const diagnostics = getDesignDiagnostics();
    if (diagnostics && diagnostics.validateCustomDesign) return diagnostics.validateCustomDesign(design);
    return { ok: true, diagnostics: [], errors: [], warnings: [], errorCount: 0, warningCount: 0, repairHints: [] };
  }

  function looksLikePatchJson(value) {
    if (!value || typeof value !== 'object') return false;
    if (value.schemaVersion === PATCH_SCHEMA_VERSION) return true;
    const cables = value.cables || value.connections;
    return Array.isArray(value.components) && Array.isArray(cables) && cables.some((cable) => typeof cable.from === 'string' && typeof cable.to === 'string');
  }

  function importDesignObject(value, options = {}) {
    try {
      if (!value || typeof value !== 'object') throw new Error('imported JSON must be an object');
      if (value.schemaVersion === DESIGN_DRAFT_SCHEMA_VERSION && value.design) {
        const design = normalizeDesign(value.design, options);
        return { ok: true, design, sourceKind: 'draft', sourceSchemaVersion: value.schemaVersion, validation: validateDesign(design), error: null };
      }
      if (value.schemaVersion === DESIGN_SCHEMA_VERSION || value.kind === 'custom-design') {
        const design = normalizeDesign(value, options);
        return { ok: true, design, sourceKind: 'design', sourceSchemaVersion: value.schemaVersion || null, validation: validateDesign(design), error: null };
      }
      const adopted = getAdoptedPatchPanelEditor();
      if (adopted && adopted.looksLikeAdoptedWiring && adopted.looksLikeAdoptedWiring(value)) {
        const imported = adopted.adoptedWiringToDesignImportResult(value, Object.assign({ source: 'adopted patch panel editor v021', tags: ['adopted-editor', 'imported-wiring'] }, options.designOptions || {}, options));
        if (!imported.ok) throw new Error(imported.error || 'adopted patch-panel wiring import failed');
        const design = normalizeDesign(imported.design, options);
        return { ok: true, design, sourceKind: 'adopted-patch-panel-wiring', sourceSchemaVersion: imported.sourceSchemaVersion || null, validation: validateDesign(design), error: null };
      }
      if (looksLikePatchJson(value)) {
        const design = designFromSerializedPatch(value, Object.assign({ source: 'imported serialized patch', tags: ['imported-patch'] }, options.designOptions || {}, options));
        return { ok: true, design, sourceKind: 'patch', sourceSchemaVersion: value.schemaVersion || null, validation: validateDesign(design), error: null };
      }
      throw new Error('JSON is neither a custom design, a saved custom-design draft, nor a serialized patch/adopted patch-panel wiring');
    } catch (error) {
      return { ok: false, design: null, sourceKind: 'unknown', sourceSchemaVersion: value && value.schemaVersion ? value.schemaVersion : null, validation: null, error: error.message };
    }
  }

  function parseDesignImportText(text, options = {}) {
    try {
      const parsed = JSON.parse(normalizeLineEndings(text));
      return importDesignObject(parsed, options);
    } catch (error) {
      return { ok: false, design: null, sourceKind: 'syntax-error', sourceSchemaVersion: null, validation: null, error: error.message };
    }
  }

  function createDesignExportPayload(design, options = {}) {
    const normalized = normalizeDesign(design, options);
    const filename = options.filename || safeFilename((normalized.metadata && normalized.metadata.name) || DEFAULT_DESIGN_FILENAME, '.design.json');
    const json = stableJson(normalized, options.spacing === undefined ? 2 : options.spacing);
    return {
      filename,
      mimeType: DESIGN_JSON_MIME_TYPE,
      json,
      byteLength: byteLength(json),
      design: normalized,
      summary: summarizeDesign(normalized),
      validation: options.validate === false ? null : validateDesign(normalized),
    };
  }

  function smokeTestDesignImportExport(design, options = {}) {
    const exported = createDesignExportPayload(design, options);
    const imported = parseDesignImportText(exported.json, options);
    const originalCanonical = stableJson(exported.design, 0);
    const importedCanonical = imported.ok ? stableJson(imported.design, 0) : '';
    let patchOk = null;
    let patchError = null;
    if (imported.ok && options.compilePatch !== false) {
      try {
        serializedPatchFromDesign(imported.design, options);
        patchOk = true;
      } catch (error) {
        patchOk = false;
        patchError = error.message;
      }
    }
    const validationOk = imported.ok && imported.validation ? imported.validation.ok : imported.ok;
    return {
      ok: imported.ok && originalCanonical === importedCanonical && validationOk && patchOk !== false,
      exported,
      importedOk: imported.ok,
      importError: imported.error,
      sourceKind: imported.sourceKind,
      roundTripEqual: originalCanonical === importedCanonical,
      validationOk,
      validationErrors: imported.validation ? imported.validation.errors || [] : [],
      validationWarnings: imported.validation ? imported.validation.warnings || [] : [],
      patchOk,
      patchError,
      action: imported.ok && originalCanonical === importedCanonical
        ? 'Design JSON can be exported, parsed again, validated, and converted back to executable patch JSON.'
        : 'Fix JSON syntax, design schema, or validation errors before saving or sharing this design.',
    };
  }

  function createDesignDraftEnvelope(design, options = {}) {
    const normalized = normalizeDesign(design, options);
    return {
      schemaVersion: DESIGN_DRAFT_SCHEMA_VERSION,
      key: options.key || DEFAULT_DRAFT_KEY,
      savedAt: options.savedAt || options.now || new Date().toISOString(),
      name: normalized.metadata && normalized.metadata.name ? normalized.metadata.name : 'Untitled custom design',
      summary: summarizeDesign(normalized),
      design: normalized,
    };
  }

  function memoryDraftStorage(initial = {}) {
    const store = Object.assign({}, initial);
    return {
      getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      setItem(key, value) { store[key] = String(value); },
      removeItem(key) { delete store[key]; },
      dump() { return Object.assign({}, store); },
    };
  }

  function saveDesignDraft(storage, design, options = {}) {
    if (!storage || typeof storage.setItem !== 'function') throw new Error('draft storage must provide setItem');
    const key = options.key || DEFAULT_DRAFT_KEY;
    const envelope = createDesignDraftEnvelope(design, Object.assign({}, options, { key }));
    storage.setItem(key, stableJson(envelope));
    return envelope;
  }

  function loadDesignDraft(storage, options = {}) {
    if (!storage || typeof storage.getItem !== 'function') throw new Error('draft storage must provide getItem');
    const key = options.key || DEFAULT_DRAFT_KEY;
    const text = storage.getItem(key);
    if (!text) return { ok: false, key, envelope: null, design: null, error: 'no custom design draft saved' };
    try {
      const parsed = JSON.parse(normalizeLineEndings(text));
      const imported = importDesignObject(parsed, options);
      if (!imported.ok) throw new Error(imported.error);
      return { ok: true, key, envelope: parsed, design: imported.design, validation: imported.validation, error: null };
    } catch (error) {
      return { ok: false, key, envelope: null, design: null, validation: null, error: error.message };
    }
  }

  function clearDesignDraft(storage, options = {}) {
    if (!storage || typeof storage.removeItem !== 'function') throw new Error('draft storage must provide removeItem');
    const key = options.key || DEFAULT_DRAFT_KEY;
    storage.removeItem(key);
    return { ok: true, key };
  }

  function projectRootPath() {
    if (typeof __dirname === 'string' && typeof require === 'function') {
      try {
        const path = require('path');
        return path.resolve(__dirname, '..', '..');
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  function readJsonFile(filePath) {
    if (typeof require !== 'function') return null;
    const fs = require('fs');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function galleryManifestPath(options = {}) {
    if (options.manifestPath) return options.manifestPath;
    const root = options.projectRoot || projectRootPath();
    if (!root) return null;
    const path = require('path');
    return path.join(root, GALLERY_MANIFEST_PATH);
  }

  function isBookletGalleryEntry(entry) {
    return entry && String(entry.id || '').startsWith('first-steps-');
  }

  function filterBookletGalleryEntries(entries, options = {}) {
    return options.includeNonBookletExamples ? entries : entries.filter(isBookletGalleryEntry);
  }

  function listDesignGalleryEntries(options = {}) {
    if (Array.isArray(options.entries)) return filterBookletGalleryEntries(clonePlain(options.entries), options);
    const manifestPath = galleryManifestPath(options);
    if (manifestPath && typeof require === 'function') {
      try {
        const manifest = readJsonFile(manifestPath);
        if (Array.isArray(manifest)) return filterBookletGalleryEntries(manifest.map(clonePlain), options);
        if (Array.isArray(manifest.designs)) return filterBookletGalleryEntries(manifest.designs.map(clonePlain), options);
      } catch (error) {
        if (options.strict) throw error;
      }
    }
    return filterBookletGalleryEntries(BUILT_IN_GALLERY_MANIFEST.map(clonePlain), options);
  }

  function fallbackGalleryDesignFromPatch(id, options = {}) {
    const gallery = getSerializedGallery();
    if (!gallery) throw new Error(`custom design gallery file ${id} could not be loaded`);
    const patch = gallery.getSerializedGalleryPatch ? gallery.getSerializedGalleryPatch(id) : (gallery.getSerializedGalleryExample ? gallery.getSerializedGalleryExample(id).patch : null);
    if (!patch) throw new Error(`custom design gallery entry ${id} is not available`);
    return designFromSerializedPatch(patch, Object.assign({ name: patch.name, source: 'serialized gallery fallback', tags: ['gallery-design', id] }, options));
  }

  function loadDesignGalleryDesign(id, options = {}) {
    const entries = listDesignGalleryEntries(options);
    const entry = entries.find((item) => item.id === id) || entries[0];
    if (!entry) throw new Error('custom design gallery is empty');
    if (options.designs && options.designs[entry.id]) return normalizeDesign(options.designs[entry.id], options);
    const root = options.projectRoot || projectRootPath();
    if (root && entry.file && typeof require === 'function') {
      try {
        const path = require('path');
        const design = readJsonFile(path.join(root, 'designs', 'gallery', entry.file));
        return normalizeDesign(design, options);
      } catch (error) {
        if (options.strict) throw error;
      }
    }
    return fallbackGalleryDesignFromPatch(entry.id, options);
  }

  function summarizeDesignGallery(options = {}) {
    return listDesignGalleryEntries(options).map((entry) => {
      let summary = null;
      let valid = null;
      try {
        const design = loadDesignGalleryDesign(entry.id, options);
        summary = summarizeDesign(design);
        valid = validateDesign(design).ok;
      } catch (error) {
        summary = { error: error.message };
        valid = false;
      }
      return Object.assign({}, entry, { summary, valid });
    });
  }

  const api = {
    DESIGN_DRAFT_SCHEMA_VERSION,
    DESIGN_JSON_MIME_TYPE,
    DEFAULT_DESIGN_FILENAME,
    DEFAULT_DRAFT_KEY,
    GALLERY_MANIFEST_PATH,
    stableClone,
    stableJson,
    normalizeLineEndings,
    safeFilename,
    importDesignObject,
    parseDesignImportText,
    createDesignExportPayload,
    smokeTestDesignImportExport,
    createDesignDraftEnvelope,
    memoryDraftStorage,
    saveDesignDraft,
    loadDesignDraft,
    clearDesignDraft,
    listDesignGalleryEntries,
    loadDesignGalleryDesign,
    summarizeDesignGallery,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDesignStorage = api;
}(typeof window !== 'undefined' ? window : global));
