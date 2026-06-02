'use strict';

(function attachDesignHistory(globalScope) {
  const nodeRequire = typeof require === 'function' ? require : null;
  const designApi = globalScope.AnalogThingCoreDesign || (nodeRequire ? nodeRequire('./design') : null);
  const controlsApi = globalScope.AnalogThingDesignControls || (nodeRequire ? nodeRequire('./designControls') : null);

  const DESIGN_HISTORY_SCHEMA_VERSION = 'analog-thing-design-history/v1';
  const DEFAULT_HISTORY_LIMIT = 100;

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }

  function normalizeDesignLoose(design) {
    if (designApi && designApi.normalizeDesign) return designApi.normalizeDesign(design, { requireComponents: false });
    const copy = clonePlain(design || {});
    copy.schemaVersion = copy.schemaVersion || 'analog-thing-design/v1';
    copy.kind = copy.kind || 'custom-design';
    copy.inventory = copy.inventory || 'that-prototype-board/v006';
    copy.metadata = Object.assign({ name: 'Untitled custom design', description: '', author: '', source: '', tags: [], createdAt: 'unknown', modifiedAt: 'unknown', notes: '' }, copy.metadata || {});
    copy.components = clonePlain(copy.components || copy.componentRefs || []);
    copy.coefficients = clonePlain(copy.coefficients || {});
    copy.cables = clonePlain(copy.cables || copy.connections || []);
    copy.outputRouting = clonePlain(copy.outputRouting || { channels: { X: null, Y: null, Z: null, U: null }, aliases: {} });
    copy.operationDefaults = clonePlain(copy.operationDefaults || {});
    copy.notes = copy.notes || copy.metadata.notes || '';
    return copy;
  }

  function stableDesignString(design) {
    const normalized = normalizeDesignLoose(design);
    return JSON.stringify(normalized);
  }

  function designSnapshot(design, options = {}) {
    const normalized = normalizeDesignLoose(design);
    const json = JSON.stringify(normalized);
    return {
      schemaVersion: normalized.schemaVersion,
      name: normalized.metadata && normalized.metadata.name ? normalized.metadata.name : 'Untitled custom design',
      at: options.at || options.now || new Date().toISOString(),
      design: normalized,
      byteLength: json.length,
      cableCount: (normalized.cables || []).length,
      coefficientCount: Object.keys(normalized.coefficients || {}).length,
    };
  }

  function historyLimit(options = {}) {
    return Number.isInteger(options.historyLimit) ? Math.max(1, options.historyLimit) : DEFAULT_HISTORY_LIMIT;
  }

  function createDesignHistoryState(design, options = {}) {
    const snapshot = designSnapshot(design, options);
    return {
      schemaVersion: DESIGN_HISTORY_SCHEMA_VERSION,
      present: snapshot.design,
      savedSnapshot: options.saved === false ? null : stableDesignString(snapshot.design),
      past: [],
      future: [],
      lastEdit: null,
      dirty: options.saved === false ? true : false,
    };
  }

  function normalizeHistoryState(historyOrDesign, options = {}) {
    if (historyOrDesign && historyOrDesign.schemaVersion === DESIGN_HISTORY_SCHEMA_VERSION) {
      const present = normalizeDesignLoose(historyOrDesign.present || historyOrDesign.design || {});
      return {
        schemaVersion: DESIGN_HISTORY_SCHEMA_VERSION,
        present,
        savedSnapshot: historyOrDesign.savedSnapshot === undefined ? (options.saved === false ? null : stableDesignString(present)) : historyOrDesign.savedSnapshot,
        past: clonePlain(historyOrDesign.past || []),
        future: clonePlain(historyOrDesign.future || []),
        lastEdit: historyOrDesign.lastEdit || null,
        dirty: Boolean(historyOrDesign.dirty),
      };
    }
    return createDesignHistoryState(historyOrDesign, options);
  }

  function cleanEntry(design, options = {}) {
    const snapshot = designSnapshot(design, options);
    return {
      at: snapshot.at,
      label: options.label || options.message || 'design edit',
      editType: options.editType || options.type || 'design-edit',
      design: snapshot.design,
      cableCount: snapshot.cableCount,
      coefficientCount: snapshot.coefficientCount,
    };
  }

  function refreshDirty(history) {
    const current = stableDesignString(history.present);
    history.dirty = history.savedSnapshot === null || history.savedSnapshot === undefined ? true : current !== history.savedSnapshot;
    return history;
  }

  function recordDesignHistory(historyOrDesign, nextDesign, options = {}) {
    const history = normalizeHistoryState(historyOrDesign, options);
    const next = normalizeDesignLoose(nextDesign);
    const before = stableDesignString(history.present);
    const after = stableDesignString(next);
    if (before === after) {
      history.lastEdit = { label: options.label || 'unchanged design edit', editType: options.editType || 'unchanged', changed: false };
      return { state: refreshDirty(history), changed: false, action: 'unchanged' };
    }
    const past = history.past.concat([cleanEntry(history.present, options)]).slice(-historyLimit(options));
    history.present = next;
    history.past = past;
    history.future = [];
    history.lastEdit = { label: options.label || options.message || 'design edit', editType: options.editType || options.type || 'design-edit', changed: true };
    return { state: refreshDirty(history), changed: true, action: 'record' };
  }

  function undoDesignHistory(historyOrDesign, options = {}) {
    const history = normalizeHistoryState(historyOrDesign, options);
    if (!history.past.length) {
      history.lastEdit = { label: 'Nothing to undo', editType: 'undo', changed: false };
      return { state: refreshDirty(history), design: history.present, changed: false, action: 'unchanged' };
    }
    const entry = history.past[history.past.length - 1];
    history.past = history.past.slice(0, -1);
    history.future = history.future.concat([cleanEntry(history.present, { label: history.lastEdit && history.lastEdit.label ? history.lastEdit.label : 'redo design edit', editType: 'redo', now: options.now })]);
    history.present = normalizeDesignLoose(entry.design);
    history.lastEdit = { label: `Undo: ${entry.label || entry.editType || 'design edit'}`, editType: 'undo', changed: true };
    return { state: refreshDirty(history), design: history.present, changed: true, action: 'undo', entry: clonePlain(entry) };
  }

  function redoDesignHistory(historyOrDesign, options = {}) {
    const history = normalizeHistoryState(historyOrDesign, options);
    if (!history.future.length) {
      history.lastEdit = { label: 'Nothing to redo', editType: 'redo', changed: false };
      return { state: refreshDirty(history), design: history.present, changed: false, action: 'unchanged' };
    }
    const entry = history.future[history.future.length - 1];
    history.future = history.future.slice(0, -1);
    history.past = history.past.concat([cleanEntry(history.present, { label: history.lastEdit && history.lastEdit.label ? history.lastEdit.label : 'undo design edit', editType: 'undo', now: options.now })]);
    history.present = normalizeDesignLoose(entry.design);
    history.lastEdit = { label: `Redo: ${entry.label || entry.editType || 'design edit'}`, editType: 'redo', changed: true };
    return { state: refreshDirty(history), design: history.present, changed: true, action: 'redo', entry: clonePlain(entry) };
  }

  function markDesignHistorySaved(historyOrDesign, options = {}) {
    const history = normalizeHistoryState(historyOrDesign, options);
    history.savedSnapshot = stableDesignString(history.present);
    history.dirty = false;
    history.lastEdit = { label: options.label || 'Saved design state', editType: 'mark-saved', changed: false };
    return history;
  }

  function withModifiedMetadata(design, options = {}) {
    const next = normalizeDesignLoose(design);
    if (!next.metadata) next.metadata = {};
    if (options.name !== undefined) next.metadata.name = String(options.name);
    if (options.description !== undefined) next.metadata.description = String(options.description);
    if (options.notes !== undefined) {
      next.metadata.notes = String(options.notes);
      next.notes = String(options.notes);
    }
    if (options.tags !== undefined) next.metadata.tags = Array.isArray(options.tags) ? options.tags.map(String) : String(options.tags).split(',').map((tag) => tag.trim()).filter(Boolean);
    next.metadata.modifiedAt = options.modifiedAt || options.now || new Date().toISOString();
    return next;
  }

  function withDesignCoefficient(design, componentId, value, options = {}) {
    const next = normalizeDesignLoose(design);
    const id = String(componentId || '').trim();
    if (!id) throw new Error('componentId is required for coefficient edit');
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('coefficient value must be a finite number');
    next.coefficients = Object.assign({}, next.coefficients || {}, { [id]: number });
    for (const component of next.components || []) if (component.id === id) component.coefficient = number;
    if (controlsApi && controlsApi.normalizeCoefficientControls) next.coefficients = Object.assign(next.coefficients, controlsApi.normalizeCoefficientControls(next.coefficients));
    if (next.metadata) next.metadata.modifiedAt = options.modifiedAt || options.now || new Date().toISOString();
    return next;
  }

  function withDesignOperationDefault(design, key, value, options = {}) {
    const next = normalizeDesignLoose(design);
    next.operationDefaults = Object.assign({}, next.operationDefaults || {}, { [key]: value });
    const normalized = normalizeDesignLoose(next);
    if (normalized.metadata) normalized.metadata.modifiedAt = options.modifiedAt || options.now || new Date().toISOString();
    return normalized;
  }

  function withDesignOutputRoute(design, channel, logicalSocketId, options = {}) {
    const next = normalizeDesignLoose(design);
    const ch = String(channel || '').toUpperCase();
    if (!['X', 'Y', 'Z', 'U'].includes(ch)) throw new Error('output channel must be X, Y, Z, or U');
    next.outputRouting = clonePlain(next.outputRouting || { channels: {}, aliases: {} });
    next.outputRouting.channels = Object.assign({ X: null, Y: null, Z: null, U: null }, next.outputRouting.channels || {}, { [ch]: logicalSocketId || null });
    if (next.metadata) next.metadata.modifiedAt = options.modifiedAt || options.now || new Date().toISOString();
    return next;
  }

  function withAddedDesignCable(design, cable, options = {}) {
    const next = normalizeDesignLoose(design);
    const id = cable && cable.id ? String(cable.id) : `cable-${(next.cables || []).length + 1}`;
    const entry = Object.assign({}, clonePlain(cable || {}), { id });
    next.cables = (next.cables || []).concat([entry]);
    if (next.metadata) next.metadata.modifiedAt = options.modifiedAt || options.now || new Date().toISOString();
    return normalizeDesignLoose(next);
  }

  function withoutDesignCable(design, cableIdOrIndex, options = {}) {
    const next = normalizeDesignLoose(design);
    const key = String(cableIdOrIndex);
    next.cables = (next.cables || []).filter((cable, index) => cable.id !== key && String(index) !== key);
    if (next.metadata) next.metadata.modifiedAt = options.modifiedAt || options.now || new Date().toISOString();
    return normalizeDesignLoose(next);
  }

  function designHistorySummary(historyOrDesign, options = {}) {
    const history = normalizeHistoryState(historyOrDesign, options);
    return {
      schemaVersion: DESIGN_HISTORY_SCHEMA_VERSION,
      name: history.present.metadata && history.present.metadata.name ? history.present.metadata.name : 'Untitled custom design',
      dirty: refreshDirty(history).dirty,
      undoCount: history.past.length,
      redoCount: history.future.length,
      lastEdit: history.lastEdit,
      cableCount: (history.present.cables || []).length,
      coefficientCount: Object.keys(history.present.coefficients || {}).length,
      outputChannels: Object.entries((history.present.outputRouting && history.present.outputRouting.channels) || {}).filter((entry) => entry[1]).map((entry) => entry[0]),
    };
  }

  const api = {
    DESIGN_HISTORY_SCHEMA_VERSION,
    createDesignHistoryState,
    normalizeHistoryState,
    designSnapshot,
    stableDesignString,
    recordDesignHistory,
    undoDesignHistory,
    redoDesignHistory,
    markDesignHistorySaved,
    designHistorySummary,
    withModifiedMetadata,
    withDesignCoefficient,
    withDesignOperationDefault,
    withDesignOutputRoute,
    withAddedDesignCable,
    withoutDesignCable,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDesignHistory = api;
}(typeof window !== 'undefined' ? window : global));
