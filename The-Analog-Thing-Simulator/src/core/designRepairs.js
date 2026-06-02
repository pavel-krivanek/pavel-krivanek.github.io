'use strict';

(function attachDesignRepairs(globalScope) {
  const nodeRequire = typeof require === 'function' ? require : null;
  const designApi = globalScope.AnalogThingCoreDesign || (nodeRequire ? nodeRequire('./design') : null);
  const diagnosticsApi = globalScope.AnalogThingDesignDiagnostics || (nodeRequire ? nodeRequire('./designDiagnostics') : null);
  const physicalApi = globalScope.AnalogThingPhysicalSockets || (nodeRequire ? nodeRequire('./physicalSockets') : null);
  const accessoryApi = globalScope.AnalogThingDesignAccessories || (nodeRequire ? nodeRequire('./designAccessories') : null);

  const DESIGN_REPAIR_SCHEMA_VERSION = 'analog-thing-design-repairs/v1';
  const REPAIR_SESSION_DRAFT_SCHEMA_VERSION = 'analog-thing-repair-session-draft/v1';
  const DEFAULT_REPAIR_SESSION_DRAFT_KEY = 'analogThing.guidedRepairSession.v1';

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

  function stableJson(value, spacing = 2) { return `${JSON.stringify(stableClone(value), null, spacing)}\n`; }
  function normalizeLineEndings(text) { return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); }

  function normalizeDesignLoose(design) {
    if (designApi && designApi.normalizeDesign) return designApi.normalizeDesign(design, { requireComponents: false });
    const copy = clonePlain(design || {});
    copy.schemaVersion = copy.schemaVersion || 'analog-thing-design/v1';
    copy.kind = copy.kind || 'custom-design';
    copy.inventory = copy.inventory || 'that-prototype-board/v006';
    copy.metadata = Object.assign({ name: 'Untitled custom design', tags: [], createdAt: 'unknown', modifiedAt: 'unknown' }, copy.metadata || {});
    copy.components = clonePlain(copy.components || []);
    copy.coefficients = clonePlain(copy.coefficients || {});
    copy.cables = clonePlain(copy.cables || []);
    copy.outputRouting = clonePlain(copy.outputRouting || { channels: { X: null, Y: null, Z: null, U: null }, aliases: {} });
    copy.operationDefaults = clonePlain(copy.operationDefaults || {});
    return copy;
  }

  function validateDesign(design, options = {}) {
    if (diagnosticsApi && diagnosticsApi.validateCustomDesign) return diagnosticsApi.validateCustomDesign(design, options);
    return { ok: true, diagnostics: [], errors: [], warnings: [], repairHints: [], errorCount: 0, warningCount: 0 };
  }

  function socketMapFromOptions(options = {}) {
    if (options.physicalSocketMap || options.socketMap) return physicalApi.normalizePhysicalSocketMap(options.physicalSocketMap || options.socketMap);
    return physicalApi && physicalApi.createThatPhysicalSocketMap ? physicalApi.createThatPhysicalSocketMap() : { sockets: [] };
  }

  function physicalSocketById(id, options = {}) {
    if (!id) return null;
    const map = socketMapFromOptions(options);
    if (physicalApi && physicalApi.physicalSocketById) return physicalApi.physicalSocketById(map, id);
    return (map.sockets || []).find((socket) => socket.id === id) || null;
  }

  function cableKey(cable, index) { return cable && cable.id ? String(cable.id) : `index:${index}`; }

  function findCableIndex(design, diagnosticOrAction) {
    const cables = (design && design.cables) || [];
    if (diagnosticOrAction.cableId) {
      const idx = cables.findIndex((cable) => String(cable.id) === String(diagnosticOrAction.cableId));
      if (idx >= 0) return idx;
    }
    if (Number.isInteger(diagnosticOrAction.cableIndex) && diagnosticOrAction.cableIndex >= 0 && diagnosticOrAction.cableIndex < cables.length) return diagnosticOrAction.cableIndex;
    return -1;
  }

  function endpointCopy(endpoint) {
    if (typeof endpoint === 'string') return { logicalSocketId: endpoint, physicalSocketId: null };
    return Object.assign({ logicalSocketId: null, physicalSocketId: null }, clonePlain(endpoint || {}));
  }

  function replacementLogicalForUnsupported(diagnostic, options = {}) {
    const socketId = diagnostic.physicalSocketId || (diagnostic.socketIds && diagnostic.socketIds[0]);
    const socket = physicalSocketById(socketId, options);
    if (!socket) return null;
    if (accessoryApi && accessoryApi.feedbackSocketSemantics) {
      const semantics = accessoryApi.feedbackSocketSemantics(socket, options);
      if (semantics && semantics.replacement) return { logicalSocketId: semantics.replacement, label: `Replace ${socket.id} with ${semantics.replacement}`, repairKind: 'replace-feedback-with-sj' };
    }
    const accessory = accessoryApi && accessoryApi.accessoryFromSocket ? accessoryApi.accessoryFromSocket(socket) : null;
    if (accessory && accessory.type === 'ground-tie') return { logicalSocketId: 'ZERO.out', label: `Replace ${socket.id} with ZERO.out`, repairKind: 'replace-ground-tie-with-zero' };
    return null;
  }

  function makeAction(action) {
    const id = action.id || [action.operation, action.cableId || `cable-${action.cableIndex}`, action.endpointRole || 'cable', action.logicalSocketId || action.diagnosticCode || 'repair'].filter(Boolean).join(':');
    return Object.assign({ schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION, id, destructive: false }, action);
  }

  function repairActionsForDiagnostic(diagnostic, design, options = {}) {
    if (!diagnostic || !diagnostic.code) return [];
    const normalized = normalizeDesignLoose(design || {});
    const cableIndex = findCableIndex(normalized, diagnostic);
    const cable = cableIndex >= 0 ? normalized.cables[cableIndex] : null;
    const cableId = cable ? cableKey(cable, cableIndex) : diagnostic.cableId || null;
    const actions = [];
    const base = { diagnosticCode: diagnostic.code, cableId, cableIndex, endpointRole: diagnostic.endpointRole || null };

    function remove(label, reason) {
      if (cableIndex >= 0) actions.push(makeAction(Object.assign({}, base, { operation: 'remove-cable', label, description: reason || 'Remove the cable that caused this diagnostic.', destructive: true })));
    }

    if (diagnostic.code === 'physical-logical-mismatch' && diagnostic.mappedLogicalSocketId && diagnostic.endpointRole && cableIndex >= 0) {
      actions.push(makeAction(Object.assign({}, base, {
        operation: 'align-endpoint-logical-to-physical',
        label: `Use mapped logical socket ${diagnostic.mappedLogicalSocketId}`,
        description: 'Keep the physical jack and replace the inconsistent logical socket id with the mapping from the physical socket table.',
        logicalSocketId: diagnostic.mappedLogicalSocketId,
      })));
    }

    if (diagnostic.code === 'unsupported-accessory-socket' && cableIndex >= 0) {
      const replacement = replacementLogicalForUnsupported(diagnostic, options);
      if (replacement) {
        const role = diagnostic.endpointRole;
        const expectedAsFrom = replacement.logicalSocketId === 'ZERO.out';
        if ((expectedAsFrom && role === 'from') || (!expectedAsFrom && role === 'to')) {
          actions.push(makeAction(Object.assign({}, base, {
            operation: 'replace-endpoint-with-logical',
            label: replacement.label,
            description: 'Replace the unsupported visible accessory endpoint with the closest executable logical endpoint used by the block-level runtime.',
            logicalSocketId: replacement.logicalSocketId,
            repairKind: replacement.repairKind,
          })));
        }
      }
      remove('Remove unsupported accessory cable', 'Remove the cable that touches the unsupported accessory jack.');
    }

    if (diagnostic.code === 'unknown-physical-socket' || diagnostic.code === 'invalid-endpoint' || diagnostic.code === 'unknown-logical-socket') {
      remove('Remove unresolved cable', 'Remove the cable with an endpoint that cannot be resolved by the current design/socket map.');
    }

    if (diagnostic.code === 'physical-direction-mismatch' || diagnostic.code === 'logical-direction-mismatch') {
      if (cableIndex >= 0) {
        actions.push(makeAction(Object.assign({}, base, {
          operation: 'swap-cable-endpoints',
          label: 'Swap cable direction',
          description: 'Swap the from/to endpoints. This is useful when the same two sockets were connected in reverse order.',
        })));
      }
      remove('Remove wrong-direction cable', 'Remove the cable if swapping does not produce an output-to-input connection.');
    }

    if (diagnostic.code === 'multiple-drivers') {
      remove('Remove one duplicate driver cable', 'Remove this cable so the ordinary input has only one driver. For a real sum, route signals through a summer or SJ input.');
    }

    if (diagnostic.code === 'output-routing-unknown' || diagnostic.code === 'output-routing-direction') {
      const channel = diagnostic.channel || diagnostic.outputChannel || diagnostic.outputLabel || null;
      if (channel) actions.push(makeAction(Object.assign({}, base, { operation: 'clear-output-route', label: `Clear ${String(channel).toUpperCase()} output route`, description: 'Clear this invalid output-channel route so it can be reassigned to an executable output socket.', channel: String(channel).toUpperCase() })));
    }

    return actions;
  }

  function repairActionsForValidation(validation, design, options = {}) {
    const diagnostics = validation && validation.diagnostics ? validation.diagnostics : validateDesign(design, options).diagnostics;
    const actions = [];
    const seen = new Set();
    for (const diagnostic of diagnostics) {
      for (const action of repairActionsForDiagnostic(diagnostic, design, options)) {
        if (seen.has(action.id)) continue;
        seen.add(action.id);
        actions.push(action);
      }
    }
    return actions;
  }

  function actionTargetIndex(design, action) {
    const index = findCableIndex(design, action);
    if (index < 0) throw new Error(`repair action cannot find target cable ${action.cableId || action.cableIndex}`);
    return index;
  }

  function applyRepairAction(design, action, options = {}) {
    if (!action || !action.operation) throw new Error('repair action requires operation');
    const next = normalizeDesignLoose(design);
    const op = action.operation;
    if (op === 'remove-cable') {
      const index = actionTargetIndex(next, action);
      const removed = next.cables.splice(index, 1)[0];
      return { design: normalizeDesignLoose(next), changed: true, action: clonePlain(action), removedCable: removed };
    }
    if (op === 'align-endpoint-logical-to-physical' || op === 'replace-endpoint-with-logical') {
      const index = actionTargetIndex(next, action);
      const role = action.endpointRole;
      if (role !== 'from' && role !== 'to') throw new Error('endpoint repair action requires endpointRole from/to');
      const endpoint = endpointCopy(next.cables[index][role]);
      endpoint.logicalSocketId = action.logicalSocketId;
      if (op === 'replace-endpoint-with-logical') endpoint.physicalSocketId = null;
      next.cables[index][role] = endpoint;
      return { design: normalizeDesignLoose(next), changed: true, action: clonePlain(action), repairedCable: clonePlain(next.cables[index]) };
    }
    if (op === 'swap-cable-endpoints') {
      const index = actionTargetIndex(next, action);
      const cable = next.cables[index];
      const from = endpointCopy(cable.from);
      cable.from = endpointCopy(cable.to);
      cable.to = from;
      return { design: normalizeDesignLoose(next), changed: true, action: clonePlain(action), repairedCable: clonePlain(cable) };
    }
    if (op === 'clear-output-route') {
      const channel = String(action.channel || '').toUpperCase();
      if (!['X', 'Y', 'Z', 'U'].includes(channel)) throw new Error('clear-output-route requires channel X/Y/Z/U');
      next.outputRouting = clonePlain(next.outputRouting || { channels: {}, aliases: {} });
      next.outputRouting.channels = Object.assign({ X: null, Y: null, Z: null, U: null }, next.outputRouting.channels || {}, { [channel]: null });
      return { design: normalizeDesignLoose(next), changed: true, action: clonePlain(action) };
    }
    throw new Error(`unsupported repair action operation: ${op}`);
  }

  function applyFirstRepairForCode(design, code, options = {}) {
    const validation = validateDesign(design, options);
    const actions = repairActionsForValidation(validation, design, options).filter((action) => action.diagnosticCode === code);
    if (!actions.length) return { design: normalizeDesignLoose(design), changed: false, action: null, validation };
    const result = applyRepairAction(design, actions[0], options);
    result.validationBefore = validation;
    result.validationAfter = validateDesign(result.design, options);
    return result;
  }

  function repairSummaryForValidation(validation, design, options = {}) {
    const actions = repairActionsForValidation(validation, design, options);
    const byOperation = {};
    const byDiagnosticCode = {};
    for (const action of actions) {
      byOperation[action.operation] = (byOperation[action.operation] || 0) + 1;
      byDiagnosticCode[action.diagnosticCode] = (byDiagnosticCode[action.diagnosticCode] || 0) + 1;
    }
    return {
      schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
      actionCount: actions.length,
      destructiveActionCount: actions.filter((action) => action.destructive).length,
      byOperation,
      byDiagnosticCode,
      actions,
    };
  }



  function compactValidationSummary(validation) {
    const byCode = {};
    for (const diagnostic of (validation && validation.diagnostics) || []) byCode[diagnostic.code] = (byCode[diagnostic.code] || 0) + 1;
    return {
      ok: Boolean(validation && validation.ok),
      errorCount: validation ? validation.errorCount || 0 : 0,
      warningCount: validation ? validation.warningCount || 0 : 0,
      diagnosticCount: validation && validation.diagnostics ? validation.diagnostics.length : 0,
      invalidCableIds: validation && validation.invalidCableIds ? validation.invalidCableIds.slice() : [],
      invalidPhysicalSocketIds: validation && validation.invalidPhysicalSocketIds ? validation.invalidPhysicalSocketIds.slice() : [],
      byCode,
    };
  }

  function cableSignature(cable) {
    const copy = clonePlain(cable || {});
    return JSON.stringify(copy);
  }

  function designChangeSummary(beforeDesign, afterDesign, action = null) {
    const before = normalizeDesignLoose(beforeDesign);
    const after = normalizeDesignLoose(afterDesign);
    const beforeById = new Map((before.cables || []).map((cable, index) => [cableKey(cable, index), cable]));
    const afterById = new Map((after.cables || []).map((cable, index) => [cableKey(cable, index), cable]));
    const cableChanges = [];
    for (const [id, cable] of beforeById.entries()) {
      if (!afterById.has(id)) cableChanges.push({ type: 'removed-cable', cableId: id, before: clonePlain(cable), after: null });
      else if (cableSignature(cable) !== cableSignature(afterById.get(id))) cableChanges.push({ type: 'updated-cable', cableId: id, before: clonePlain(cable), after: clonePlain(afterById.get(id)) });
    }
    for (const [id, cable] of afterById.entries()) if (!beforeById.has(id)) cableChanges.push({ type: 'added-cable', cableId: id, before: null, after: clonePlain(cable) });

    const outputChanges = [];
    const beforeRoutes = Object.assign({ X: null, Y: null, Z: null, U: null }, before.outputRouting && before.outputRouting.channels ? before.outputRouting.channels : {});
    const afterRoutes = Object.assign({ X: null, Y: null, Z: null, U: null }, after.outputRouting && after.outputRouting.channels ? after.outputRouting.channels : {});
    for (const channel of ['X', 'Y', 'Z', 'U']) {
      if ((beforeRoutes[channel] || null) !== (afterRoutes[channel] || null)) outputChanges.push({ type: 'output-route', channel, before: beforeRoutes[channel] || null, after: afterRoutes[channel] || null });
    }

    return {
      schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
      actionId: action && action.id ? action.id : null,
      operation: action && action.operation ? action.operation : null,
      cableChangeCount: cableChanges.length,
      outputRouteChangeCount: outputChanges.length,
      cableChanges,
      outputRouteChanges: outputChanges,
      changed: cableChanges.length > 0 || outputChanges.length > 0,
    };
  }

  function previewRepairAction(design, action, options = {}) {
    const beforeDesign = normalizeDesignLoose(design);
    const beforeValidation = validateDesign(beforeDesign, options);
    try {
      const applied = applyRepairAction(beforeDesign, action, options);
      const afterValidation = validateDesign(applied.design, options);
      const changes = designChangeSummary(beforeDesign, applied.design, action);
      const errorDelta = (afterValidation.errorCount || 0) - (beforeValidation.errorCount || 0);
      return {
        schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
        ok: true,
        action: clonePlain(action),
        destructive: Boolean(action && action.destructive),
        changed: Boolean(applied.changed),
        validationBefore: compactValidationSummary(beforeValidation),
        validationAfter: compactValidationSummary(afterValidation),
        errorDelta,
        warningDelta: (afterValidation.warningCount || 0) - (beforeValidation.warningCount || 0),
        changes,
        summaryText: `${action && action.label ? action.label : action.operation}: ${beforeValidation.errorCount || 0} -> ${afterValidation.errorCount || 0} errors`,
      };
    } catch (error) {
      return {
        schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
        ok: false,
        action: clonePlain(action || {}),
        destructive: Boolean(action && action.destructive),
        changed: false,
        validationBefore: compactValidationSummary(beforeValidation),
        validationAfter: null,
        error: error.message,
        changes: { schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION, changed: false, cableChangeCount: 0, outputRouteChangeCount: 0, cableChanges: [], outputRouteChanges: [] },
        summaryText: `${action && action.label ? action.label : 'Repair'} cannot be previewed: ${error.message}`,
      };
    }
  }

  function previewRepairActionsForValidation(validation, design, options = {}) {
    return repairActionsForValidation(validation, design, options).map((action) => previewRepairAction(design, action, options));
  }

  function actionPriority(action) {
    if (!action) return 99;
    if (action.operation === 'align-endpoint-logical-to-physical') return 1;
    if (action.operation === 'replace-endpoint-with-logical') return 2;
    if (action.operation === 'swap-cable-endpoints') return 3;
    if (action.operation === 'clear-output-route') return 4;
    if (action.operation === 'remove-cable') return 9;
    return 6;
  }

  function guidedRepairWorkflowForValidation(validation, design, options = {}) {
    const actions = repairActionsForValidation(validation, design, options).slice().sort((a, b) => actionPriority(a) - actionPriority(b) || String(a.label || a.id).localeCompare(String(b.label || b.id)));
    const diagnostics = (validation && validation.diagnostics ? validation.diagnostics : validateDesign(design, options).diagnostics) || [];
    const diagnosticsByCode = {};
    for (const diagnostic of diagnostics) {
      diagnosticsByCode[diagnostic.code] = (diagnosticsByCode[diagnostic.code] || 0) + 1;
    }
    const steps = actions.map((action, index) => {
      const preview = previewRepairAction(design, action, options);
      const targetKind = action.operation === 'clear-output-route' ? 'output-route' : 'cable';
      const canImprove = preview.ok && preview.validationAfter && preview.validationAfter.errorCount <= preview.validationBefore.errorCount;
      return {
        id: `step-${index + 1}:${action.id}`,
        order: index + 1,
        title: action.label || action.operation,
        targetKind,
        diagnosticCode: action.diagnosticCode || null,
        cableId: action.cableId || null,
        channel: action.channel || null,
        destructive: Boolean(action.destructive),
        recommended: canImprove && !action.destructive,
        action: clonePlain(action),
        preview,
      };
    });
    return {
      schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
      ok: Boolean(validation && validation.ok),
      diagnosticCount: diagnostics.length,
      diagnosticsByCode,
      actionCount: actions.length,
      stepCount: steps.length,
      recommendedStepCount: steps.filter((step) => step.recommended).length,
      destructiveStepCount: steps.filter((step) => step.destructive).length,
      steps,
    };
  }

  function applyGuidedRepairStep(design, stepOrAction, options = {}) {
    const action = stepOrAction && stepOrAction.action ? stepOrAction.action : stepOrAction;
    const preview = previewRepairAction(design, action, options);
    if (!preview.ok) return { design: normalizeDesignLoose(design), changed: false, action: clonePlain(action || {}), preview, error: preview.error };
    const applied = applyRepairAction(design, action, options);
    return Object.assign({}, applied, { preview, validationAfter: validateDesign(applied.design, options) });
  }


  function candidateStepsForBatch(workflow, options = {}) {
    let steps = (workflow && workflow.steps ? workflow.steps : []).slice();
    if (Array.isArray(options.diagnosticCodes) && options.diagnosticCodes.length) {
      const wanted = new Set(options.diagnosticCodes.map(String));
      steps = steps.filter((step) => wanted.has(String(step.diagnosticCode || (step.action && step.action.diagnosticCode) || '')));
    }
    if (!options.includeDestructive) steps = steps.filter((step) => !step.destructive);
    if (options.recommendedOnly !== false) steps = steps.filter((step) => step.recommended || (options.allowNeutral && !step.destructive));
    return steps;
  }

  function previewGuidedRepairBatch(design, validationOrOptions = null, maybeOptions = {}) {
    const options = validationOrOptions && validationOrOptions.diagnostics ? maybeOptions : (validationOrOptions || maybeOptions || {});
    let current = normalizeDesignLoose(design);
    let validation = validationOrOptions && validationOrOptions.diagnostics ? validationOrOptions : validateDesign(current, options);
    const maxSteps = Math.max(1, Number.isInteger(options.maxSteps) ? options.maxSteps : 12);
    const steps = [];
    const seen = new Set();
    for (let index = 0; index < maxSteps && validation && !validation.ok; index += 1) {
      const workflow = guidedRepairWorkflowForValidation(validation, current, options);
      const candidates = candidateStepsForBatch(workflow, options).filter((step) => !seen.has(step.action && step.action.id));
      if (!candidates.length) break;
      const step = candidates[0];
      seen.add(step.action && step.action.id);
      const preview = previewRepairAction(current, step.action, options);
      steps.push({ order: steps.length + 1, stepId: step.id, action: clonePlain(step.action), diagnosticCode: step.diagnosticCode, destructive: Boolean(step.destructive), recommended: Boolean(step.recommended), preview });
      if (!preview.ok || !preview.changed || !preview.validationAfter || preview.validationAfter.errorCount > preview.validationBefore.errorCount) break;
      const applied = applyRepairAction(current, step.action, options);
      current = applied.design;
      validation = validateDesign(current, options);
    }
    return {
      schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
      ok: steps.every((step) => step.preview && step.preview.ok),
      initialValidation: compactValidationSummary(validationOrOptions && validationOrOptions.diagnostics ? validationOrOptions : validateDesign(design, options)),
      plannedStepCount: steps.length,
      destructivePlannedCount: steps.filter((step) => step.destructive).length,
      recommendedPlannedCount: steps.filter((step) => step.recommended).length,
      finalValidationPreview: steps.length ? steps[steps.length - 1].preview.validationAfter : compactValidationSummary(validation),
      steps,
    };
  }

  function applyGuidedRepairBatch(design, validationOrOptions = null, maybeOptions = {}) {
    const options = validationOrOptions && validationOrOptions.diagnostics ? maybeOptions : (validationOrOptions || maybeOptions || {});
    let current = normalizeDesignLoose(design);
    let validation = validationOrOptions && validationOrOptions.diagnostics ? validationOrOptions : validateDesign(current, options);
    const initialValidation = validation;
    const maxSteps = Math.max(1, Number.isInteger(options.maxSteps) ? options.maxSteps : 12);
    const appliedSteps = [];
    const skippedSteps = [];
    const seen = new Set();
    for (let index = 0; index < maxSteps && validation && !validation.ok; index += 1) {
      const workflow = guidedRepairWorkflowForValidation(validation, current, options);
      const candidates = candidateStepsForBatch(workflow, options).filter((step) => !seen.has(step.action && step.action.id));
      if (!candidates.length) break;
      const step = candidates[0];
      seen.add(step.action && step.action.id);
      const beforeValidation = validation;
      const result = applyGuidedRepairStep(current, step, options);
      if (!result.changed || result.error) {
        skippedSteps.push({ order: skippedSteps.length + 1, stepId: step.id, action: clonePlain(step.action), error: result.error || 'repair did not change the design' });
        break;
      }
      current = result.design;
      validation = result.validationAfter || validateDesign(current, options);
      appliedSteps.push({
        order: appliedSteps.length + 1,
        stepId: step.id,
        action: clonePlain(step.action),
        diagnosticCode: step.diagnosticCode || (step.action && step.action.diagnosticCode) || null,
        destructive: Boolean(step.destructive),
        recommended: Boolean(step.recommended),
        validationBefore: compactValidationSummary(beforeValidation),
        validationAfter: compactValidationSummary(validation),
        changes: result.preview && result.preview.changes ? result.preview.changes : designChangeSummary(design, current, step.action),
      });
    }
    return {
      schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
      design: current,
      changed: appliedSteps.length > 0,
      initialValidation: compactValidationSummary(initialValidation),
      validationAfter: compactValidationSummary(validation),
      appliedStepCount: appliedSteps.length,
      skippedStepCount: skippedSteps.length,
      destructiveAppliedCount: appliedSteps.filter((step) => step.destructive).length,
      recommendedAppliedCount: appliedSteps.filter((step) => step.recommended).length,
      errorDelta: (validation.errorCount || 0) - (initialValidation.errorCount || 0),
      warningDelta: (validation.warningCount || 0) - (initialValidation.warningCount || 0),
      appliedSteps,
      skippedSteps,
    };
  }

  function repairBatchSummary(batchResult) {
    const result = batchResult || {};
    const byOperation = {};
    const byDiagnosticCode = {};
    for (const step of result.appliedSteps || []) {
      const op = step.action && step.action.operation ? step.action.operation : 'unknown';
      byOperation[op] = (byOperation[op] || 0) + 1;
      const code = step.diagnosticCode || (step.action && step.action.diagnosticCode) || 'unknown';
      byDiagnosticCode[code] = (byDiagnosticCode[code] || 0) + 1;
    }
    return {
      schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
      changed: Boolean(result.changed),
      appliedStepCount: result.appliedStepCount || 0,
      skippedStepCount: result.skippedStepCount || 0,
      errorDelta: result.errorDelta || 0,
      warningDelta: result.warningDelta || 0,
      byOperation,
      byDiagnosticCode,
      validationAfter: result.validationAfter || null,
    };
  }


  function normalizeRepairSession(session) {
    const copy = clonePlain(session || {});
    copy.schemaVersion = copy.schemaVersion || DESIGN_REPAIR_SCHEMA_VERSION;
    copy.kind = copy.kind || 'guided-repair-session';
    copy.design = normalizeDesignLoose(copy.design || copy.currentDesign || copy.initialDesign || {});
    copy.initialValidation = copy.initialValidation || compactValidationSummary(validateDesign(copy.design));
    copy.currentValidation = copy.currentValidation || compactValidationSummary(validateDesign(copy.design));
    copy.steps = Array.isArray(copy.steps) ? copy.steps.map((step, index) => Object.assign({ order: index + 1, status: 'pending' }, step)) : [];
    copy.appliedSteps = Array.isArray(copy.appliedSteps) ? copy.appliedSteps : [];
    copy.skippedSteps = Array.isArray(copy.skippedSteps) ? copy.skippedSteps : [];
    copy.failedSteps = Array.isArray(copy.failedSteps) ? copy.failedSteps : [];
    copy.nextStepIndex = Number.isInteger(copy.nextStepIndex) ? copy.nextStepIndex : copy.steps.findIndex((step) => step.status === 'pending');
    if (copy.nextStepIndex < 0) copy.nextStepIndex = copy.steps.length;
    copy.completed = copy.nextStepIndex >= copy.steps.length || copy.steps.every((step) => step.status && step.status !== 'pending');
    copy.pendingStepCount = copy.steps.filter((step) => !step.status || step.status === 'pending').length;
    copy.appliedStepCount = copy.appliedSteps.length;
    copy.skippedStepCount = copy.skippedSteps.length;
    copy.failedStepCount = copy.failedSteps.length;
    return copy;
  }

  function createGuidedRepairSession(design, validationOrOptions = null, maybeOptions = {}) {
    const options = validationOrOptions && validationOrOptions.diagnostics ? maybeOptions : (validationOrOptions || maybeOptions || {});
    const normalized = normalizeDesignLoose(design);
    const initialValidation = validationOrOptions && validationOrOptions.diagnostics ? validationOrOptions : validateDesign(normalized, options);
    const batchPreview = previewGuidedRepairBatch(normalized, initialValidation, options);
    const steps = (batchPreview.steps || []).map((step, index) => ({
      id: step.stepId || `repair-session-step-${index + 1}:${step.action && step.action.id ? step.action.id : 'repair'}`,
      order: index + 1,
      status: 'pending',
      diagnosticCode: step.diagnosticCode || (step.action && step.action.diagnosticCode) || null,
      destructive: Boolean(step.destructive),
      recommended: Boolean(step.recommended),
      action: clonePlain(step.action || {}),
      preview: clonePlain(step.preview || {}),
    }));
    return normalizeRepairSession({
      schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
      kind: 'guided-repair-session',
      design: normalized,
      initialValidation: compactValidationSummary(initialValidation),
      currentValidation: compactValidationSummary(initialValidation),
      batchPreview: clonePlain(batchPreview),
      options: clonePlain(options),
      steps,
      appliedSteps: [],
      skippedSteps: [],
      failedSteps: [],
      nextStepIndex: steps.length ? 0 : 0,
    });
  }

  function nextPendingRepairSessionStep(session) {
    const normalized = normalizeRepairSession(session);
    return normalized.steps.find((step) => !step.status || step.status === 'pending') || null;
  }

  function applyNextGuidedRepairSessionStep(session, options = {}) {
    const current = normalizeRepairSession(session);
    const step = nextPendingRepairSessionStep(current);
    if (!step) return current;
    const index = current.steps.findIndex((entry) => entry.id === step.id);
    const mergedOptions = Object.assign({}, current.options || {}, options || {});
    const beforeValidation = validateDesign(current.design, mergedOptions);
    const result = applyGuidedRepairStep(current.design, step, mergedOptions);
    const updated = clonePlain(current);
    if (result.error || !result.changed) {
      updated.steps[index] = Object.assign({}, updated.steps[index], { status: 'failed', error: result.error || 'repair did not change the design', validationBefore: compactValidationSummary(beforeValidation) });
      updated.failedSteps.push({ order: updated.failedSteps.length + 1, stepId: step.id, action: clonePlain(step.action), error: result.error || 'repair did not change the design' });
    } else {
      const afterValidation = result.validationAfter || validateDesign(result.design, mergedOptions);
      updated.design = normalizeDesignLoose(result.design);
      updated.currentValidation = compactValidationSummary(afterValidation);
      updated.steps[index] = Object.assign({}, updated.steps[index], {
        status: 'applied',
        validationBefore: compactValidationSummary(beforeValidation),
        validationAfter: compactValidationSummary(afterValidation),
        changes: result.preview && result.preview.changes ? clonePlain(result.preview.changes) : designChangeSummary(current.design, result.design, step.action),
      });
      updated.appliedSteps.push({
        order: updated.appliedSteps.length + 1,
        stepId: step.id,
        action: clonePlain(step.action),
        diagnosticCode: step.diagnosticCode || (step.action && step.action.diagnosticCode) || null,
        destructive: Boolean(step.destructive),
        recommended: Boolean(step.recommended),
        validationBefore: compactValidationSummary(beforeValidation),
        validationAfter: compactValidationSummary(afterValidation),
        changes: updated.steps[index].changes,
      });
    }
    updated.nextStepIndex = updated.steps.findIndex((entry) => !entry.status || entry.status === 'pending');
    if (updated.nextStepIndex < 0) updated.nextStepIndex = updated.steps.length;
    return normalizeRepairSession(updated);
  }

  function skipGuidedRepairSessionStep(session, stepId = null, reason = 'skipped by user') {
    const updated = normalizeRepairSession(session);
    const step = stepId ? updated.steps.find((entry) => entry.id === stepId) : nextPendingRepairSessionStep(updated);
    if (!step) return updated;
    const index = updated.steps.findIndex((entry) => entry.id === step.id);
    updated.steps[index] = Object.assign({}, updated.steps[index], { status: 'skipped', reason });
    updated.skippedSteps.push({ order: updated.skippedSteps.length + 1, stepId: step.id, action: clonePlain(step.action), reason });
    updated.nextStepIndex = updated.steps.findIndex((entry) => !entry.status || entry.status === 'pending');
    if (updated.nextStepIndex < 0) updated.nextStepIndex = updated.steps.length;
    return normalizeRepairSession(updated);
  }

  function applyAllGuidedRepairSessionSteps(session, options = {}) {
    let current = normalizeRepairSession(session);
    const maxSteps = Math.max(1, Number.isInteger(options.maxSteps) ? options.maxSteps : current.steps.length || 1);
    for (let index = 0; index < maxSteps; index += 1) {
      const step = nextPendingRepairSessionStep(current);
      if (!step) break;
      const next = applyNextGuidedRepairSessionStep(current, options);
      if (next.failedStepCount > current.failedStepCount) return next;
      current = next;
    }
    return normalizeRepairSession(current);
  }


  function createRepairSessionDraftEnvelope(session, options = {}) {
    const normalized = normalizeRepairSession(session);
    const summary = repairSessionSummary(normalized);
    return {
      schemaVersion: REPAIR_SESSION_DRAFT_SCHEMA_VERSION,
      key: options.key || DEFAULT_REPAIR_SESSION_DRAFT_KEY,
      savedAt: options.savedAt || options.now || new Date().toISOString(),
      name: options.name || (normalized.design && normalized.design.metadata && normalized.design.metadata.name) || 'Guided repair session',
      summary,
      session: normalized,
    };
  }

  function serializeGuidedRepairSession(session, options = {}) {
    const envelope = createRepairSessionDraftEnvelope(session, options);
    const json = stableJson(envelope, options.spacing === undefined ? 2 : options.spacing);
    return {
      schemaVersion: REPAIR_SESSION_DRAFT_SCHEMA_VERSION,
      key: envelope.key,
      savedAt: envelope.savedAt,
      name: envelope.name,
      json,
      byteLength: (typeof Buffer !== 'undefined' && Buffer.byteLength) ? Buffer.byteLength(json, 'utf8') : json.length,
      envelope,
      summary: envelope.summary,
    };
  }

  function parseGuidedRepairSessionText(text, options = {}) {
    try {
      const parsed = JSON.parse(normalizeLineEndings(text));
      const envelope = parsed && parsed.schemaVersion === REPAIR_SESSION_DRAFT_SCHEMA_VERSION ? parsed : { schemaVersion: REPAIR_SESSION_DRAFT_SCHEMA_VERSION, session: parsed };
      if (!envelope.session) throw new Error('repair-session draft requires a session payload');
      const session = normalizeRepairSession(envelope.session);
      return { ok: true, key: envelope.key || options.key || DEFAULT_REPAIR_SESSION_DRAFT_KEY, envelope, session, summary: repairSessionSummary(session), error: null };
    } catch (error) {
      return { ok: false, key: options.key || DEFAULT_REPAIR_SESSION_DRAFT_KEY, envelope: null, session: null, summary: null, error: error.message };
    }
  }

  function saveGuidedRepairSessionDraft(storage, session, options = {}) {
    if (!storage || typeof storage.setItem !== 'function') throw new Error('repair-session storage must provide setItem');
    const key = options.key || DEFAULT_REPAIR_SESSION_DRAFT_KEY;
    const payload = serializeGuidedRepairSession(session, Object.assign({}, options, { key }));
    storage.setItem(key, payload.json);
    return payload.envelope;
  }

  function loadGuidedRepairSessionDraft(storage, options = {}) {
    if (!storage || typeof storage.getItem !== 'function') throw new Error('repair-session storage must provide getItem');
    const key = options.key || DEFAULT_REPAIR_SESSION_DRAFT_KEY;
    const text = storage.getItem(key);
    if (!text) return { ok: false, key, envelope: null, session: null, summary: null, error: 'no guided repair session draft saved' };
    const parsed = parseGuidedRepairSessionText(text, Object.assign({}, options, { key }));
    parsed.key = key;
    return parsed;
  }

  function clearGuidedRepairSessionDraft(storage, options = {}) {
    if (!storage || typeof storage.removeItem !== 'function') throw new Error('repair-session storage must provide removeItem');
    const key = options.key || DEFAULT_REPAIR_SESSION_DRAFT_KEY;
    storage.removeItem(key);
    return { ok: true, key };
  }

  function refreshGuidedRepairSession(session, options = {}) {
    const current = normalizeRepairSession(session);
    const validation = validateDesign(current.design, Object.assign({}, current.options || {}, options || {}));
    const refreshed = createGuidedRepairSession(current.design, validation, Object.assign({}, current.options || {}, options || {}));
    refreshed.appliedSteps = clonePlain(current.appliedSteps || []);
    refreshed.skippedSteps = clonePlain(current.skippedSteps || []);
    refreshed.failedSteps = clonePlain(current.failedSteps || []);
    return normalizeRepairSession(refreshed);
  }

  function repairSessionSummary(session) {
    const normalized = normalizeRepairSession(session);
    const byOperation = {};
    const byDiagnosticCode = {};
    for (const step of normalized.appliedSteps || []) {
      const operation = step.action && step.action.operation ? step.action.operation : 'unknown';
      byOperation[operation] = (byOperation[operation] || 0) + 1;
      const code = step.diagnosticCode || (step.action && step.action.diagnosticCode) || 'unknown';
      byDiagnosticCode[code] = (byDiagnosticCode[code] || 0) + 1;
    }
    return {
      schemaVersion: DESIGN_REPAIR_SCHEMA_VERSION,
      kind: 'guided-repair-session-summary',
      completed: Boolean(normalized.completed),
      plannedStepCount: normalized.steps.length,
      pendingStepCount: normalized.pendingStepCount,
      appliedStepCount: normalized.appliedStepCount,
      skippedStepCount: normalized.skippedStepCount,
      failedStepCount: normalized.failedStepCount,
      initialErrorCount: normalized.initialValidation ? normalized.initialValidation.errorCount || 0 : 0,
      currentErrorCount: normalized.currentValidation ? normalized.currentValidation.errorCount || 0 : 0,
      errorDelta: (normalized.currentValidation ? normalized.currentValidation.errorCount || 0 : 0) - (normalized.initialValidation ? normalized.initialValidation.errorCount || 0 : 0),
      byOperation,
      byDiagnosticCode,
      nextStep: nextPendingRepairSessionStep(normalized),
    };
  }

  const api = {
    DESIGN_REPAIR_SCHEMA_VERSION,
    REPAIR_SESSION_DRAFT_SCHEMA_VERSION,
    DEFAULT_REPAIR_SESSION_DRAFT_KEY,
    repairActionsForDiagnostic,
    repairActionsForValidation,
    repairSummaryForValidation,
    designChangeSummary,
    previewRepairAction,
    previewRepairActionsForValidation,
    guidedRepairWorkflowForValidation,
    previewGuidedRepairBatch,
    applyGuidedRepairBatch,
    repairBatchSummary,
    createGuidedRepairSession,
    nextPendingRepairSessionStep,
    applyNextGuidedRepairSessionStep,
    skipGuidedRepairSessionStep,
    applyAllGuidedRepairSessionSteps,
    repairSessionSummary,
    createRepairSessionDraftEnvelope,
    serializeGuidedRepairSession,
    parseGuidedRepairSessionText,
    saveGuidedRepairSessionDraft,
    loadGuidedRepairSessionDraft,
    clearGuidedRepairSessionDraft,
    refreshGuidedRepairSession,
    applyGuidedRepairStep,
    applyRepairAction,
    applyFirstRepairForCode,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDesignRepairs = api;
}(typeof window !== 'undefined' ? window : global));
