/* global window, document, Blob, URL */
'use strict';

(function attachPatchEditorApp(globalScope) {
  const PATCH_SCHEMA_VERSION = 'analog-thing-patch/v1';
  const DEFAULT_INVENTORY_NAME = 'that-prototype-board/v006';

  const DAMPED_COMPONENTS = Object.freeze([
    Object.freeze({ id: 'PLUS1' }),
    Object.freeze({ id: 'I1' }),
    Object.freeze({ id: 'I2' }),
    Object.freeze({ id: 'INV1' }),
    Object.freeze({ id: 'P1', coefficient: 0.5, label: 'P1 spring coefficient k' }),
    Object.freeze({ id: 'P2', coefficient: 0.5, label: 'P2 damping coefficient d' }),
    Object.freeze({ id: 'SUM1' }),
    Object.freeze({ id: 'P3', coefficient: 0.5, label: 'P3 inverse mass 1/m' }),
    Object.freeze({ id: 'OUT_X', label: 'X / velocity' }),
    Object.freeze({ id: 'OUT_Y', label: 'Y / position' }),
  ]);

  const DAMPED_CABLES = Object.freeze([
    Object.freeze({ from: 'PLUS1.out', to: 'I1.ic', label: 'initial velocity +1 becomes I1.out = -1' }),
    Object.freeze({ from: 'P3.out', to: 'I1.in1', label: 'acceleration input to first integrator' }),
    Object.freeze({ from: 'I1.out', to: 'I2.in1', label: 'integrate minus velocity into position' }),
    Object.freeze({ from: 'I1.out', to: 'INV1.in', label: 'recover positive velocity' }),
    Object.freeze({ from: 'I2.out', to: 'P1.in', label: 'spring term k*x' }),
    Object.freeze({ from: 'INV1.out', to: 'P2.in', label: 'damping term d*x_dot' }),
    Object.freeze({ from: 'P1.out', to: 'SUM1.in1', label: 'summer input for spring force' }),
    Object.freeze({ from: 'P2.out', to: 'SUM1.in2', label: 'summer input for damping force' }),
    Object.freeze({ from: 'SUM1.out', to: 'P3.in', label: 'apply inverse mass to force sum' }),
    Object.freeze({ from: 'INV1.out', to: 'OUT_X.in', label: 'velocity display' }),
    Object.freeze({ from: 'I2.out', to: 'OUT_Y.in', label: 'position display' }),
  ]);

  const PARAMETER_TO_COMPONENT = Object.freeze({
    k: 'P1',
    d: 'P2',
    invMass: 'P3',
  });

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeText(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function finiteNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clampCoefficient(value, fallback = 0.5) {
    const numeric = finiteNumber(value, fallback);
    if (numeric < 0) return 0;
    if (numeric > 1) return 1;
    return numeric;
  }

  function ensurePatchObject(patch) {
    if (!patch || typeof patch !== 'object') throw new Error('patch must be an object');
    if (patch.schemaVersion && patch.schemaVersion !== PATCH_SCHEMA_VERSION) {
      throw new Error(`unsupported schemaVersion ${patch.schemaVersion}`);
    }
    if (!Array.isArray(patch.components)) throw new Error('patch.components must be an array');
    const cables = patch.cables || patch.connections;
    if (!Array.isArray(cables)) throw new Error('patch.cables must be an array');
    return patch;
  }

  function normalizeCable(cable, index = 0) {
    if (!cable || typeof cable !== 'object') throw new Error(`cable ${index + 1} must be an object`);
    if (typeof cable.from !== 'string' || typeof cable.to !== 'string') {
      throw new Error(`cable ${index + 1} requires string from/to sockets`);
    }
    const normalized = {
      from: cable.from.trim(),
      to: cable.to.trim(),
      label: cable.label || `${cable.from.trim()} -> ${cable.to.trim()}`,
    };
    if (typeof cable.id === 'string' && cable.id.trim()) normalized.id = cable.id.trim();
    if (typeof cable.color === 'string' && cable.color.trim()) normalized.color = cable.color.trim();
    if (Number.isFinite(Number(cable.opacity))) normalized.opacity = Math.min(1, Math.max(0.05, Number(cable.opacity)));
    if (Number.isFinite(Number(cable.strokeWidth))) normalized.strokeWidth = Math.min(24, Math.max(1, Number(cable.strokeWidth)));
    if (Number.isFinite(Number(cable.bend))) normalized.bend = Math.min(160, Math.max(-160, Number(cable.bend)));
    if (typeof cable.createdAt === 'string' && cable.createdAt.trim()) normalized.createdAt = cable.createdAt.trim();
    if (typeof cable.fromConnectorId === 'string' && cable.fromConnectorId.trim()) normalized.fromConnectorId = cable.fromConnectorId.trim();
    if (typeof cable.toConnectorId === 'string' && cable.toConnectorId.trim()) normalized.toConnectorId = cable.toConnectorId.trim();
    if (cable.panelOnly === true) normalized.panelOnly = true;
    if (typeof cable.runtimeSupport === 'string' && cable.runtimeSupport.trim()) normalized.runtimeSupport = cable.runtimeSupport.trim();
    if (typeof cable.notes === 'string' && cable.notes.trim()) normalized.notes = cable.notes.trim();
    return normalized;
  }

  function normalizeSerializedPatch(patch) {
    const source = ensurePatchObject(patch);
    const cables = source.cables || source.connections;
    const normalized = {
      schemaVersion: PATCH_SCHEMA_VERSION,
      inventory: source.inventory || DEFAULT_INVENTORY_NAME,
      name: source.name || 'Browser-edited damped oscillator patch',
      description: source.description || 'Browser-side serialized patch for the damped-oscillation prototype.',
      components: clonePlain(source.components),
      cables: cables.map(normalizeCable),
      outputs: clonePlain(source.outputs || {
        x: 'OUT_X.out',
        velocity: 'OUT_X.out',
        position: 'OUT_Y.out',
        minusVelocity: 'I1.out',
        accelerationInput: 'P3.out',
      }),
      parameters: clonePlain(source.parameters || {}),
    };
    if (source.template && typeof source.template === 'object') normalized.template = clonePlain(source.template);
    if (source.deviceControls && typeof source.deviceControls === 'object') normalized.deviceControls = clonePlain(source.deviceControls);
    if (source.boardModel && typeof source.boardModel === 'object') normalized.boardModel = clonePlain(source.boardModel);
    if (source.runtimeBehavior && typeof source.runtimeBehavior === 'object') normalized.runtimeBehavior = clonePlain(source.runtimeBehavior);
    if (source.fullBoard === true) normalized.fullBoard = true;
    return normalized;
  }

  function createEditableDampedPatch(options = {}) {
    const k = clampCoefficient(options.k, 0.5);
    const d = clampCoefficient(options.d, 0.5);
    const invMass = clampCoefficient(options.invMass, 0.5);
    const patch = {
      schemaVersion: PATCH_SCHEMA_VERSION,
      inventory: DEFAULT_INVENTORY_NAME,
      name: 'THAT quickstart damped oscillation browser-editable patch',
      description: 'Serialized patch JSON edited by the browser UI. The first browser editor is intentionally restricted to the damped-oscillation component set.',
      components: clonePlain(DAMPED_COMPONENTS),
      cables: clonePlain(DAMPED_CABLES),
      outputs: {
        x: 'OUT_X.out',
        velocity: 'OUT_X.out',
        position: 'OUT_Y.out',
        minusVelocity: 'I1.out',
        accelerationInput: 'P3.out',
      },
      parameters: { k, d, invMass },
    };
    return setDampedPatchCoefficients(patch, { k, d, invMass });
  }

  function componentEntryById(patch, id) {
    ensurePatchObject(patch);
    return patch.components.find((component) => component.id === id) || null;
  }

  function getPatchCoefficient(patch, componentId, fallback = 0.5) {
    const component = componentEntryById(patch, componentId);
    if (!component || component.coefficient === undefined) return clampCoefficient(fallback, 0.5);
    return clampCoefficient(component.coefficient, fallback);
  }

  function setPatchCoefficient(patch, componentId, coefficient) {
    const next = normalizeSerializedPatch(patch);
    const component = componentEntryById(next, componentId);
    if (!component) throw new Error(`unknown coefficient component ${componentId}`);
    component.coefficient = clampCoefficient(coefficient, component.coefficient);
    next.parameters = Object.assign({}, next.parameters || {});
    next.parameters.coefficients = Object.assign({}, next.parameters.coefficients || {}, { [componentId]: component.coefficient });
    if (componentId === 'P1') next.parameters.k = component.coefficient;
    if (componentId === 'P2') next.parameters.d = component.coefficient;
    if (componentId === 'P3') next.parameters.invMass = component.coefficient;
    return next;
  }

  function setDampedPatchCoefficients(patch, coefficients = {}) {
    let next = normalizeSerializedPatch(patch);
    for (const [parameter, componentId] of Object.entries(PARAMETER_TO_COMPONENT)) {
      if (coefficients[parameter] !== undefined) {
        next = setPatchCoefficient(next, componentId, coefficients[parameter]);
      }
    }
    return next;
  }

  function readDampedPatchCoefficients(patch) {
    const normalized = normalizeSerializedPatch(patch);
    return {
      k: getPatchCoefficient(normalized, 'P1', normalized.parameters.k === undefined ? 0.5 : normalized.parameters.k),
      d: getPatchCoefficient(normalized, 'P2', normalized.parameters.d === undefined ? 0.5 : normalized.parameters.d),
      invMass: getPatchCoefficient(normalized, 'P3', normalized.parameters.invMass === undefined ? 0.5 : normalized.parameters.invMass),
    };
  }

  function getPatchTemplatesApp() {
    if (globalScope.AnalogThingPatchTemplatesApp) return globalScope.AnalogThingPatchTemplatesApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./patchTemplatesApp'); } catch (error) { return null; }
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

  function getCustomDesignApp() {
    if (globalScope.AnalogThingCustomDesignApp) return globalScope.AnalogThingCustomDesignApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./customDesignApp'); } catch (error) { return null; }
    }
    return null;
  }


  function fullBoardInventoryComponents() {
    const runtime = getBrowserPatchRuntime();
    if (runtime && typeof runtime.createPrototypeInventory === 'function') {
      return runtime.createPrototypeInventory().components.map((component) => ({ id: component.id }));
    }
    const components = [{ id: 'PLUS1' }, { id: 'MINUS1' }, { id: 'ZERO' }];
    for (let index = 1; index <= 5; index += 1) components.push({ id: `I${index}` });
    for (let index = 1; index <= 4; index += 1) components.push({ id: `INV${index}` });
    for (let index = 1; index <= 4; index += 1) components.push({ id: `SUM${index}` });
    for (let index = 1; index <= 8; index += 1) components.push({ id: `P${index}`, coefficient: 0.5 });
    for (let index = 1; index <= 2; index += 1) components.push({ id: `MUL${index}` });
    for (let index = 1; index <= 2; index += 1) components.push({ id: `CMP${index}` });
    for (let index = 1; index <= 2; index += 1) components.push({ id: `XIR${index}` });
    for (const id of ['X', 'Y', 'Z', 'U']) components.push({ id: `OUT_${id}` });
    return components;
  }

  function fullBoardComponentOrder() {
    return new Map(fullBoardInventoryComponents().map((component, index) => [component.id, index]));
  }

  function patchAllowsOpenInputs(patch) {
    return Boolean(
      patch && (
        patch.fullBoard === true
        || (patch.boardModel && patch.boardModel.kind === 'full-that-panel')
        || (patch.runtimeBehavior && patch.runtimeBehavior.allowUnconnectedInputs === true)
      )
    );
  }

  function fullBoardOutputs(existing = {}) {
    return Object.assign({ X: 'OUT_X.out', Y: 'OUT_Y.out', Z: 'OUT_Z.out', U: 'OUT_U.out' }, clonePlain(existing || {}));
  }

  function expandPatchToFullBoard(patch, options = {}) {
    const normalized = normalizeSerializedPatch(patch);
    const full = fullBoardInventoryComponents();
    const byId = new Map(full.map((component) => [component.id, clonePlain(component)]));
    for (const component of normalized.components) {
      if (!component || typeof component.id !== 'string') continue;
      byId.set(component.id, Object.assign({}, byId.get(component.id) || { id: component.id }, clonePlain(component)));
    }
    const parameterCoefficients = (normalized.parameters && normalized.parameters.coefficients) || {};
    for (let index = 1; index <= 8; index += 1) {
      const id = `P${index}`;
      const component = byId.get(id) || { id };
      if (component.coefficient === undefined) component.coefficient = clampCoefficient(parameterCoefficients[id], options.defaultCoefficient === undefined ? 0.5 : options.defaultCoefficient);
      byId.set(id, component);
    }
    const order = fullBoardComponentOrder();
    const components = Array.from(byId.values()).sort((a, b) => {
      const ai = order.has(a.id) ? order.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bi = order.has(b.id) ? order.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return String(a.id).localeCompare(String(b.id));
    });
    const next = Object.assign({}, normalized, {
      name: options.name || normalized.name,
      description: normalized.description,
      components,
      outputs: fullBoardOutputs(normalized.outputs),
      fullBoard: true,
      boardModel: Object.assign({
        kind: 'full-that-panel',
        neutralUnusedModules: true,
        componentCount: components.length,
      }, normalized.boardModel || {}),
      runtimeBehavior: Object.assign({
        allowUnconnectedInputs: true,
        panelOnlyUnsupportedCables: 'preserve-and-ignore',
      }, normalized.runtimeBehavior || {}),
    });
    return normalizeSerializedPatch(next);
  }

  function createFullBoardPatchFromTemplate(templateId = 'first-steps-radioactive-decay', parameterValues = {}, controlOverrides = {}) {
    const patch = createEditablePatchFromTemplate(templateId, parameterValues);
    const withControls = Object.keys(controlOverrides || {}).length ? setPatchDeviceControls(patch, controlOverrides, templateId) : patch;
    return expandPatchToFullBoard(withControls);
  }

  function getCableInteractionApp() {
    if (globalScope.AnalogThingCableInteractionApp) return globalScope.AnalogThingCableInteractionApp;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./cableInteractionApp'); } catch (error) { return null; }
    }
    return null;
  }

  function inferTemplateIdFromPatch(patch) {
    const normalized = normalizeSerializedPatch(patch);
    if (normalized.template && normalized.template.id) return normalized.template.id;
    if (normalized.parameters && normalized.parameters.firstStepsExampleId) return normalized.parameters.firstStepsExampleId;
    const ids = new Set(normalized.components.map((component) => component.id));
    if (ids.has('I1') && ids.has('I2') && ids.has('P1') && ids.has('P2') && ids.has('P3')) return 'quickstart-damped-oscillation';
    if (ids.has('MUL1')) return 'multiplier-product';
    if (ids.has('CMP1')) return 'comparator-switch';
    if (ids.has('INV1') && ids.has('P1')) return 'coefficient-inverter';
    if (ids.has('I1') && ids.has('OUT_Y')) return 'slow-integrator-ramp';
    return 'first-steps-radioactive-decay';
  }

  function createEditablePatchFromTemplate(templateId = 'first-steps-radioactive-decay', parameterValues = {}) {
    const templates = getPatchTemplatesApp();
    if (templates && typeof templates.createPatchFromTemplate === 'function') return templates.createPatchFromTemplate(templateId, parameterValues);
    return createEditableDampedPatch(parameterValues);
  }

  function readPatchTemplateParameters(patch, templateId = inferTemplateIdFromPatch(patch)) {
    const templates = getPatchTemplatesApp();
    if (templates && typeof templates.readTemplateParameters === 'function') return templates.readTemplateParameters(normalizeSerializedPatch(patch), templateId);
    return readDampedPatchCoefficients(patch);
  }

  function setPatchTemplateParameters(patch, templateId = inferTemplateIdFromPatch(patch), parameterValues = {}) {
    const templates = getPatchTemplatesApp();
    if (templates && typeof templates.setTemplateParameters === 'function') return templates.setTemplateParameters(normalizeSerializedPatch(patch), templateId, parameterValues);
    return setDampedPatchCoefficients(patch, parameterValues);
  }

  function readPatchDeviceControls(patch, templateId = inferTemplateIdFromPatch(patch)) {
    const templates = getPatchTemplatesApp();
    const normalized = normalizeSerializedPatch(patch);
    if (templates && typeof templates.deviceControlsFromPatch === 'function') return templates.deviceControlsFromPatch(normalized, templateId);
    return clonePlain(normalized.deviceControls || {});
  }

  function setPatchDeviceControls(patch, controls, templateId = inferTemplateIdFromPatch(patch)) {
    const templates = getPatchTemplatesApp();
    const normalized = normalizeSerializedPatch(patch);
    if (templates && typeof templates.patchWithDeviceControls === 'function') return templates.patchWithDeviceControls(normalized, controls, templateId);
    return Object.assign(normalized, { deviceControls: clonePlain(controls || {}) });
  }

  function templatePanelModelFromSerializedPatch(patch, templateId = inferTemplateIdFromPatch(patch)) {
    const templates = getPatchTemplatesApp();
    if (templates && typeof templates.createGenericPanelModel === 'function' && templateId !== 'quickstart-damped-oscillation') {
      return templates.createGenericPanelModel(normalizeSerializedPatch(patch), { templateId });
    }
    return panelModelFromSerializedPatch(patch, defaultPanelModel());
  }

  function parseSocketId(socketId) {
    const parts = String(socketId).trim().split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`invalid socket id ${socketId}`);
    return { componentId: parts[0], socketName: parts[1] };
  }

  function cableLinesFromPatch(patch) {
    const normalized = normalizeSerializedPatch(patch);
    return normalized.cables.map((cable) => `${cable.from} -> ${cable.to}${cable.panelOnly ? ' # panel-only unsupported accessory wire' : ''}${cable.label ? ` # ${cable.label}` : ''}`).join('\n');
  }

  function parseCableLine(line, index) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;
    const hashIndex = trimmed.indexOf('#');
    const connectionPart = hashIndex >= 0 ? trimmed.slice(0, hashIndex).trim() : trimmed;
    const label = hashIndex >= 0 ? trimmed.slice(hashIndex + 1).trim() : '';
    const arrowMatch = connectionPart.match(/^([^\s]+)\s*(?:->|=>|,)\s*([^\s]+)$/);
    if (!arrowMatch) throw new Error(`line ${index + 1}: expected "SOURCE.out -> TARGET.in"`);
    const panelOnly = /panel-only|ignored by the block-level runtime|unsupported accessory/i.test(label);
    const cable = normalizeCable({ from: arrowMatch[1], to: arrowMatch[2], label }, index);
    if (panelOnly) {
      cable.panelOnly = true;
      cable.runtimeSupport = 'ignored-by-block-level-runtime';
      cable.notes = cable.notes || 'Physical accessory/display-only terminal connection retained for editor fidelity; it is not compiled into the simulator core yet.';
    }
    return cable;
  }

  function parseCableLines(text) {
    return String(text || '').split(/\r?\n/).map(parseCableLine).filter(Boolean);
  }

  function patchWithCableLines(patch, text) {
    const next = normalizeSerializedPatch(patch);
    next.cables = parseCableLines(text);
    return next;
  }

  function socketCatalogFromPanelModel(model) {
    const catalog = new Map();
    if (!model || !Array.isArray(model.components)) return catalog;
    for (const component of model.components) {
      for (const socketName of component.inputs || []) {
        catalog.set(`${component.id}.${socketName}`, { id: `${component.id}.${socketName}`, componentId: component.id, socketName, direction: 'input', required: true, ordinary: true });
      }
      for (const socketName of component.outputs || []) {
        catalog.set(`${component.id}.${socketName}`, { id: `${component.id}.${socketName}`, componentId: component.id, socketName, direction: 'output', required: false, ordinary: false });
      }
    }
    return catalog;
  }

  function requiredInputIdsFromPanelModel(model) {
    const required = [];
    for (const component of (model && model.components) || []) {
      const inputNames = Array.isArray(component.requiredInputs) ? component.requiredInputs : (component.inputs || []);
      for (const socketName of inputNames) required.push(`${component.id}.${socketName}`);
    }
    return required;
  }

  function defaultPanelModel() {
    const patchPanel = globalScope.AnalogThingPatchPanelApp;
    if (patchPanel && typeof patchPanel.getDampedOscillationPanelModel === 'function') {
      return patchPanel.getDampedOscillationPanelModel();
    }
    return {
      name: 'fallback damped oscillator panel',
      components: [
        { id: 'PLUS1', inputs: [], outputs: ['out'] },
        { id: 'ZERO', inputs: [], outputs: ['out'] },
        { id: 'I1', inputs: ['ic', 'in1'], outputs: ['out'] },
        { id: 'I2', inputs: ['ic', 'in1'], outputs: ['out'] },
        { id: 'INV1', inputs: ['in'], outputs: ['out'] },
        { id: 'P1', inputs: ['in'], outputs: ['out'] },
        { id: 'P2', inputs: ['in'], outputs: ['out'] },
        { id: 'SUM1', inputs: ['in1', 'in2'], outputs: ['out'] },
        { id: 'P3', inputs: ['in'], outputs: ['out'] },
        { id: 'OUT_X', inputs: ['in'], outputs: ['out'] },
        { id: 'OUT_Y', inputs: ['in'], outputs: ['out'] },
      ],
      cables: [],
      tutorialSteps: [],
      width: 1040,
      height: 286,
    };
  }

  function validateSerializedPatchForBrowser(patch, panelModel = defaultPanelModel()) {
    const errors = [];
    const warnings = [];
    let normalized;
    try {
      normalized = normalizeSerializedPatch(patch);
    } catch (error) {
      return { ok: false, errors: [error.message], warnings };
    }

    const componentIds = new Set(normalized.components.map((component) => component.id));
    const catalog = socketCatalogFromPanelModel(panelModel);
    const inputDrivers = new Map();

    for (const component of normalized.components) {
      if (!component || typeof component.id !== 'string') errors.push('component entries require string id fields');
      if (component.id && !componentIds.has(component.id)) errors.push(`unreachable component id ${component.id}`);
    }

    for (const [index, cable] of normalized.cables.entries()) {
      if (cable.panelOnly) {
        warnings.push(`cable ${index + 1}: panel-only wire is kept for physical editing but ignored by the block-level runtime`);
        continue;
      }
      try {
        const from = parseSocketId(cable.from);
        const to = parseSocketId(cable.to);
        if (!componentIds.has(from.componentId)) errors.push(`cable ${index + 1}: unknown source component ${from.componentId}`);
        if (!componentIds.has(to.componentId)) errors.push(`cable ${index + 1}: unknown target component ${to.componentId}`);
        const fromSocket = catalog.get(cable.from);
        const toSocket = catalog.get(cable.to);
        if (!fromSocket) errors.push(`cable ${index + 1}: unknown output socket ${cable.from}`);
        else if (fromSocket.direction !== 'output') errors.push(`cable ${index + 1}: ${cable.from} is not an output socket`);
        if (!toSocket) errors.push(`cable ${index + 1}: unknown input socket ${cable.to}`);
        else if (toSocket.direction !== 'input') errors.push(`cable ${index + 1}: ${cable.to} is not an input socket`);
        if (toSocket && toSocket.direction === 'input') {
          const drivers = inputDrivers.get(cable.to) || [];
          drivers.push(cable.from);
          inputDrivers.set(cable.to, drivers);
        }
      } catch (error) {
        errors.push(`cable ${index + 1}: ${error.message}`);
      }
    }

    for (const [inputSocket, drivers] of inputDrivers.entries()) {
      if (drivers.length > 1) errors.push(`ordinary input ${inputSocket} has ${drivers.length} drivers: ${drivers.join(', ')}`);
    }

    const allowOpenInputs = patchAllowsOpenInputs(normalized);
    if (!allowOpenInputs) {
      for (const required of requiredInputIdsFromPanelModel(panelModel)) {
        const componentId = required.split('.')[0];
        if (componentIds.has(componentId) && !inputDrivers.has(required)) errors.push(`required input ${required} is not connected`);
      }
    }

    for (const [name, componentId] of Object.entries(PARAMETER_TO_COMPONENT)) {
      const coefficient = getPatchCoefficient(normalized, componentId, normalized.parameters[name]);
      if (!Number.isFinite(coefficient)) warnings.push(`parameter ${name} has no finite coefficient`);
    }

    const runtime = getBrowserPatchRuntime();
    if (runtime && typeof runtime.createRuntimeMachineFromSerializedPatch === 'function') {
      try {
        runtime.createRuntimeMachineFromSerializedPatch(normalized, { allowUnconnectedInputs: patchAllowsOpenInputs(normalized) });
      } catch (error) {
        const message = `runtime validation: ${error.message}`;
        if (!errors.some((existing) => existing.includes(error.message))) errors.push(message);
      }
    }

    return { ok: errors.length === 0, errors, warnings, patch: normalized };
  }

  function rememberSocketUsage(map, socketId) {
    const parsed = parseSocketId(socketId);
    if (!map.has(parsed.componentId)) map.set(parsed.componentId, { inputs: [], outputs: [] });
    return { parsed, row: map.get(parsed.componentId) };
  }

  function uniqueAppend(list, value) {
    if (!list.includes(value)) list.push(value);
    return list;
  }

  function unique(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function inferPanelSocketUsage(patch) {
    const usage = new Map();
    for (const cable of patch.cables || []) {
      try {
        const from = rememberSocketUsage(usage, cable.from);
        uniqueAppend(from.row.outputs, from.parsed.socketName);
      } catch (error) { /* ignored; validation reports malformed sockets later */ }
      try {
        const to = rememberSocketUsage(usage, cable.to);
        uniqueAppend(to.row.inputs, to.parsed.socketName);
      } catch (error) { /* ignored; validation reports malformed sockets later */ }
    }
    for (const socketId of Object.values(patch.outputs || {})) {
      try {
        const out = rememberSocketUsage(usage, socketId);
        uniqueAppend(out.row.outputs, out.parsed.socketName);
      } catch (error) { /* ignored; validation reports malformed sockets later */ }
    }
    return usage;
  }

  function enrichPanelComponentsForPatch(model, patch) {
    const next = clonePlain(model);
    const usage = inferPanelSocketUsage(patch);
    const byId = new Map((next.components || []).map((component) => [component.id, component]));
    const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, patch.components.length))));
    const w = 116;
    const h = 60;
    const gapX = 52;
    const gapY = 46;
    const left = 32;
    const top = 36;
    for (const [index, component] of (patch.components || []).entries()) {
      if (!component || typeof component.id !== 'string') continue;
      const used = usage.get(component.id) || { inputs: [], outputs: [] };
      if (byId.has(component.id)) {
        const existing = byId.get(component.id);
        existing.inputs = unique((existing.inputs || []).concat(used.inputs));
        existing.outputs = unique((existing.outputs || []).concat(used.outputs));
        continue;
      }
      const col = index % columns;
      const row = Math.floor(index / columns);
      const added = {
        id: component.id,
        type: component.type || 'virtual-runtime-component',
        label: component.label || component.id,
        role: component.type || 'virtual-runtime-component',
        x: left + col * (w + gapX),
        y: top + row * (h + gapY),
        w,
        h,
        inputs: used.inputs,
        outputs: used.outputs.length ? used.outputs : ['out'],
        requiredInputs: [],
        virtualRuntimeComponent: true,
      };
      next.components.push(added);
      byId.set(component.id, added);
    }
    return next;
  }

  function panelModelFromSerializedPatch(patch, baseModel = defaultPanelModel()) {
    const normalized = normalizeSerializedPatch(patch);
    const model = enrichPanelComponentsForPatch(baseModel, normalized);
    model.name = `${normalized.name} panel view`;
    model.cables = normalized.cables.map((cable, index) => ({
      id: `edited-c${index + 1}`,
      from: cable.from,
      to: cable.to,
      label: cable.label || `${cable.from} -> ${cable.to}`,
      ...(cable.color ? { color: cable.color } : {}),
      ...(Number.isFinite(Number(cable.opacity)) ? { opacity: cable.opacity } : {}),
      ...(Number.isFinite(Number(cable.strokeWidth)) ? { strokeWidth: cable.strokeWidth } : {}),
      ...(Number.isFinite(Number(cable.bend)) ? { bend: cable.bend } : {}),
      ...(cable.panelOnly ? { panelOnly: true } : {}),
      ...(cable.runtimeSupport ? { runtimeSupport: cable.runtimeSupport } : {}),
      ...(cable.fromConnectorId ? { fromConnectorId: cable.fromConnectorId } : {}),
      ...(cable.toConnectorId ? { toConnectorId: cable.toConnectorId } : {}),
    }));
    model.serializedPatch = normalized;
    return model;
  }

  function patchSummary(patch, panelModel = defaultPanelModel()) {
    const normalized = normalizeSerializedPatch(patch);
    const validation = validateSerializedPatchForBrowser(normalized, panelModel);
    return {
      name: normalized.name,
      schemaVersion: normalized.schemaVersion,
      inventory: normalized.inventory,
      componentCount: normalized.components.length,
      cableCount: normalized.cables.length,
      coefficients: readDampedPatchCoefficients(normalized),
      templateId: inferTemplateIdFromPatch(normalized),
      templateParameters: readPatchTemplateParameters(normalized, inferTemplateIdFromPatch(normalized)),
      valid: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  function updateFormCoefficients(form, coefficients) {
    if (!form) return;
    for (const [name, value] of Object.entries(coefficients)) {
      if (form[name]) form[name].value = value;
    }
  }

  function readFormCoefficients(form) {
    if (!form) return {};
    return {
      k: form.k ? clampCoefficient(form.k.value, 0.5) : undefined,
      d: form.d ? clampCoefficient(form.d.value, 0.5) : undefined,
      invMass: form.invMass ? clampCoefficient(form.invMass.value, 0.5) : undefined,
    };
  }

  function renderCableList(container, patch) {
    if (!container) return;
    const normalized = normalizeSerializedPatch(patch);
    container.innerHTML = normalized.cables.map((cable) => `<li><code>${escapeText(cable.from)}</code> → <code>${escapeText(cable.to)}</code><span>${escapeText(cable.label || '')}</span></li>`).join('');
  }

  function downloadJson(payload, filename) {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !globalScope.document) return;
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = globalScope.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadText(text, filename, mimeType = 'application/json') {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !globalScope.document) return false;
    const blob = new Blob([String(text || '')], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = globalScope.document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }

  function renderDesignStorageStatus(container, payload = {}, valid = true) {
    if (!container) return payload;
    container.dataset.valid = valid ? 'true' : 'false';
    const action = payload.action ? `${payload.action}: ` : '';
    const parts = [];
    if (payload.filename) parts.push(payload.filename);
    if (payload.name) parts.push(payload.name);
    if (payload.sourceKind) parts.push(`source ${payload.sourceKind}`);
    if (Number.isFinite(Number(payload.cableCount))) parts.push(`${payload.cableCount} cables`);
    if (Number.isFinite(Number(payload.componentCount))) parts.push(`${payload.componentCount} components`);
    if (payload.savedAt) parts.push(`saved ${payload.savedAt}`);
    if (payload.error) parts.push(payload.error);
    container.textContent = `${action}${parts.filter(Boolean).join(' · ') || (valid ? 'ready' : 'failed')}`;
    return payload;
  }

  function designSummaryCounts(designOrPatch) {
    const design = designOrPatch || {};
    return {
      componentCount: Array.isArray(design.components) ? design.components.length : 0,
      cableCount: Array.isArray(design.cables) ? design.cables.length : 0,
    };
  }

  function initPatchEditorApp(rootDocument, options = {}) {
    const doc = rootDocument || document;
    const patchPanel = options.patchPanel || globalScope.AnalogThingPatchPanelApp;
    const form = doc.querySelector('#controls');
    const panelContainer = doc.querySelector('#patchPanelSvg');
    const cableList = doc.querySelector('#cableList');
    const patchSummaryPre = doc.querySelector('#patchPanelSummary');
    const jsonEditor = doc.querySelector('#patchJsonEditor');
    const cableEditor = doc.querySelector('#cableEditor');
    const validationBox = doc.querySelector('#patchValidation');
    const applyJsonButton = doc.querySelector('#applyPatchJson');
    const applyCablesButton = doc.querySelector('#applyCableEditor');
    const resetButton = doc.querySelector('#resetPatchJson');
    const downloadButton = doc.querySelector('#downloadPatchJson');
    const templateSelect = doc.querySelector('#patchTemplateSelect');
    const loadTemplateButton = doc.querySelector('#loadPatchTemplate');
    const templateDescription = doc.querySelector('#patchTemplateDescription');
    const templateParameterControls = doc.querySelector('#templateParameterControls');
    const devicePresetSummary = doc.querySelector('#devicePresetSummary');
    const cableInteractionStatus = doc.querySelector('#cableInteractionStatus');
    const cableEditorMode = doc.querySelector('#cableEditorMode');
    const undoCableEditButton = doc.querySelector('#undoCableEdit');
    const redoCableEditButton = doc.querySelector('#redoCableEdit');
    const deleteSelectedCableButton = doc.querySelector('#deleteSelectedCable');
    const markPanelSavedButton = doc.querySelector('#markPanelSaved');
    const saveDesignJsonButton = doc.querySelector('#saveDesignJson');
    const loadDesignJsonButton = doc.querySelector('#loadDesignJson');
    const saveDesignDraftButton = doc.querySelector('#saveDesignDraft');
    const loadDesignDraftButton = doc.querySelector('#loadDesignDraft');
    const designFileInput = doc.querySelector('#designFileInput');
    const designStorageStatus = doc.querySelector('#designStorageStatus');
    const panelZoomPreset = doc.querySelector('#panelZoomPreset');
    const panelFitWidthButton = doc.querySelector('#panelFitWidth');
    const panelOneToOneButton = doc.querySelector('#panelOneToOne');
    const panelFitPanelButton = doc.querySelector('#panelFitPanel');
    const panelZoomInButton = doc.querySelector('#panelZoomIn');
    const panelZoomOutButton = doc.querySelector('#panelZoomOut');
    const panelPanLeftButton = doc.querySelector('#panelPanLeft');
    const panelPanRightButton = doc.querySelector('#panelPanRight');
    const panelPanUpButton = doc.querySelector('#panelPanUp');
    const panelPanDownButton = doc.querySelector('#panelPanDown');
    const templates = options.patchTemplates || getPatchTemplatesApp();
    const cableInteraction = options.cableInteraction || getCableInteractionApp();
    let cableEditorController = null;
    const basePanelModel = patchPanel && patchPanel.getDampedOscillationPanelModel ? patchPanel.getDampedOscillationPanelModel() : defaultPanelModel();

    if (templates && templateSelect && typeof templates.populateTemplateSelect === 'function') templates.populateTemplateSelect(templateSelect, templates.getPatchTemplates());

    let currentTemplateId = 'first-steps-radioactive-decay';
    if (templateSelect) templateSelect.value = currentTemplateId;
    let pendingTemplateId = currentTemplateId;
    let currentPatch = createFullBoardPatchFromTemplate(currentTemplateId, readFormCoefficients(form));
    let currentValidation = validateSerializedPatchForBrowser(currentPatch, currentTemplateId === 'quickstart-damped-oscillation' ? basePanelModel : templatePanelModelFromSerializedPatch(currentPatch, currentTemplateId));

    function setValidationMessage(validation) {
      if (!validationBox) return;
      const summary = patchSummary(currentPatch, currentPanelModel());
      validationBox.dataset.valid = validation.ok ? 'true' : 'false';
      validationBox.textContent = validation.ok
        ? `Patch valid. ${summary.componentCount} components, ${summary.cableCount} cables.`
        : `Patch invalid:\n- ${validation.errors.join('\n- ')}`;
    }

    function syncEditors() {
      if (jsonEditor) jsonEditor.value = `${JSON.stringify(currentPatch, null, 2)}\n`;
      if (cableEditor) cableEditor.value = cableLinesFromPatch(currentPatch);
    }

    function currentPanelModel() {
      return panelModelFromSerializedPatch(currentPatch, basePanelModel);
    }

    function readTemplateControlValues() {
      const values = {};
      if (!templateParameterControls) return values;
      for (const input of Array.from(templateParameterControls.querySelectorAll('input[name]'))) values[input.name] = input.value;
      return values;
    }

    function installPanelCableEditor(model) {
      if (!cableInteraction || !panelContainer || !patchPanel || typeof cableInteraction.installSvgCableEditor !== 'function') return null;
      const svg = panelContainer.querySelector('svg');
      if (!svg) return null;
      if (cableEditorController && typeof cableEditorController.destroy === 'function') cableEditorController.destroy();
      cableEditorController = cableInteraction.installSvgCableEditor({
        svg,
        statusContainer: cableInteractionStatus,
        modeSelect: cableEditorMode,
        undoButton: undoCableEditButton,
        redoButton: redoCableEditButton,
        deleteButton: deleteSelectedCableButton,
        markCleanButton: markPanelSavedButton,
        zoomPresetSelect: panelZoomPreset,
        fitWidthButton: panelFitWidthButton,
        oneToOneButton: panelOneToOneButton,
        fitPanelButton: panelFitPanelButton,
        zoomInButton: panelZoomInButton,
        zoomOutButton: panelZoomOutButton,
        panLeftButton: panelPanLeftButton,
        panRightButton: panelPanRightButton,
        panUpButton: panelPanUpButton,
        panDownButton: panelPanDownButton,
        getPatch: () => currentPatch,
        getModel: () => model,
        replacePatch,
      });
      if (cableInteractionStatus && cableEditorController && !cableEditorController.installed) cableInteractionStatus.textContent = cableEditorController.reason || 'Panel cable editor not installed.';
      return cableEditorController;
    }

    function formEventShouldSyncPatch(event) {
      const target = event && event.target;
      if (!target) return false;
      return ['k', 'd', 'invMass'].includes(target.name || '');
    }

    function previewSelectedTemplate(templateId = pendingTemplateId) {
      pendingTemplateId = templateId || currentTemplateId;
      if (!templates) return null;
      const template = templates.getPatchTemplate(pendingTemplateId);
      if (templateDescription) templateDescription.textContent = template.description;
      if (devicePresetSummary && typeof templates.renderDevicePresetPreview === 'function') {
        return templates.renderDevicePresetPreview(devicePresetSummary, template);
      }
      return template;
    }

    function currentDesignForStorage(name = null) {
      const customDesign = getCustomDesignApp();
      if (!customDesign || typeof customDesign.designFromPatch !== 'function') return null;
      return customDesign.designFromPatch(currentPatch, { name: name || currentPatch.name || 'THAT panel design', source: 'device workbench' });
    }

    function saveCurrentDesignFile() {
      const customDesign = getCustomDesignApp();
      if (!customDesign || typeof customDesign.createDesignExportPayload !== 'function') {
        downloadJson(currentPatch, `${currentTemplateId || 'that'}_patch.json`);
        renderDesignStorageStatus(designStorageStatus, Object.assign({ action: 'save-patch-fallback', filename: `${currentTemplateId || 'that'}_patch.json` }, designSummaryCounts(currentPatch)), true);
        return currentPatch;
      }
      try {
        const design = currentDesignForStorage();
        const exported = customDesign.createDesignExportPayload(design);
        downloadText(exported.json.endsWith('\n') ? exported.json : `${exported.json}\n`, exported.filename || 'that_panel_design.design.json', exported.mimeType || 'application/json');
        renderDesignStorageStatus(designStorageStatus, Object.assign({ action: 'save-design-file', filename: exported.filename }, designSummaryCounts(exported.design)), true);
        return exported;
      } catch (error) {
        renderDesignStorageStatus(designStorageStatus, { action: 'save-design-file', error: error.message }, false);
        return null;
      }
    }

    function applyImportedDesignText(text, sourceLabel = 'file') {
      const customDesign = getCustomDesignApp();
      try {
        if (customDesign && typeof customDesign.parseDesignImportText === 'function' && typeof customDesign.patchFromDesign === 'function') {
          const imported = customDesign.parseDesignImportText(text, { name: `Imported ${sourceLabel} design`, source: sourceLabel });
          if (!imported.ok) throw new Error(imported.error || 'design import failed');
          const nextPatch = customDesign.patchFromDesign(imported.design);
          replacePatch(nextPatch, { reason: 'design-load', skipEditorSync: false });
          renderDesignStorageStatus(designStorageStatus, Object.assign({ action: 'load-design-file', sourceKind: imported.sourceKind }, designSummaryCounts(imported.design)), true);
          return imported;
        }
        const parsed = JSON.parse(String(text || '{}'));
        const result = replacePatch(parsed, { reason: 'patch-json-load', skipEditorSync: false });
        renderDesignStorageStatus(designStorageStatus, Object.assign({ action: 'load-patch-json', sourceKind: 'patch' }, designSummaryCounts(currentPatch)), true);
        return result;
      } catch (error) {
        renderDesignStorageStatus(designStorageStatus, { action: 'load-design-file', error: error.message }, false);
        return null;
      }
    }

    function loadSelectedDesignFile() {
      const file = designFileInput && designFileInput.files && designFileInput.files[0];
      if (!file) {
        renderDesignStorageStatus(designStorageStatus, { action: 'load-design-file', error: 'choose a .json design file first' }, false);
        return null;
      }
      if (typeof FileReader === 'undefined') {
        renderDesignStorageStatus(designStorageStatus, { action: 'load-design-file', error: 'FileReader is not available in this browser' }, false);
        return null;
      }
      const reader = new FileReader();
      reader.onload = () => applyImportedDesignText(String(reader.result || ''), file.name || 'file');
      reader.onerror = () => renderDesignStorageStatus(designStorageStatus, { action: 'load-design-file', error: `could not read ${file.name || 'selected file'}` }, false);
      reader.readAsText(file);
      return file;
    }

    function saveCurrentDesignDraft() {
      const customDesign = getCustomDesignApp();
      if (!customDesign || typeof customDesign.saveDesignDraft !== 'function') {
        renderDesignStorageStatus(designStorageStatus, { action: 'store-design-draft', error: 'design draft storage is unavailable' }, false);
        return null;
      }
      try {
        const design = currentDesignForStorage('THAT panel draft');
        const envelope = customDesign.saveDesignDraft(design, { key: 'analogThing.deviceWorkbenchDesignDraft.v1' });
        renderDesignStorageStatus(designStorageStatus, Object.assign({ action: 'store-design-draft', name: envelope.name, savedAt: envelope.savedAt }, designSummaryCounts(envelope.design)), true);
        return envelope;
      } catch (error) {
        renderDesignStorageStatus(designStorageStatus, { action: 'store-design-draft', error: error.message }, false);
        return null;
      }
    }

    function loadSavedDesignDraft() {
      const customDesign = getCustomDesignApp();
      if (!customDesign || typeof customDesign.loadDesignDraft !== 'function' || typeof customDesign.patchFromDesign !== 'function') {
        renderDesignStorageStatus(designStorageStatus, { action: 'load-design-draft', error: 'design draft storage is unavailable' }, false);
        return null;
      }
      try {
        const loaded = customDesign.loadDesignDraft({ key: 'analogThing.deviceWorkbenchDesignDraft.v1' });
        if (!loaded.ok) throw new Error(loaded.error || 'no saved draft');
        replacePatch(customDesign.patchFromDesign(loaded.design), { reason: 'design-draft-load', skipEditorSync: false });
        renderDesignStorageStatus(designStorageStatus, Object.assign({ action: 'load-design-draft' }, designSummaryCounts(loaded.design)), true);
        return loaded;
      } catch (error) {
        renderDesignStorageStatus(designStorageStatus, { action: 'load-design-draft', error: error.message }, false);
        return null;
      }
    }

    function renderTemplateControls() {
      if (!templates) return;
      previewSelectedTemplate(pendingTemplateId);
      if (!templateParameterControls || typeof templates.renderTemplateParameters !== 'function') return;
      const template = templates.getPatchTemplate(currentTemplateId);
      const values = readPatchTemplateParameters(currentPatch, currentTemplateId);
      templates.renderTemplateParameters(templateParameterControls, template, values);
      for (const input of Array.from(templateParameterControls.querySelectorAll('input[name]'))) {
        input.addEventListener('input', () => {
          const valuesFromControls = readTemplateControlValues();
          currentPatch = setPatchTemplateParameters(currentPatch, currentTemplateId, valuesFromControls);
          renderAll();
        });
      }
    }

    function emitPatchChanged(summary, renderOptions = {}) {
      if (options && typeof options.onPatchChanged === 'function') {
        options.onPatchChanged(clonePlain(currentPatch), clonePlain(currentValidation), clonePlain(summary));
      }
      if (doc && typeof doc.dispatchEvent === 'function' && typeof globalScope.CustomEvent === 'function') {
        doc.dispatchEvent(new globalScope.CustomEvent('analogthing:patchchanged', {
          detail: { patch: clonePlain(currentPatch), validation: clonePlain(currentValidation), summary: clonePlain(summary), templateId: currentTemplateId, renderOptions: clonePlain(renderOptions || {}) },
        }));
      }
    }

    function renderAll(optionsForRender = {}) {
      const modelForValidation = currentPanelModel();
      currentValidation = validateSerializedPatchForBrowser(currentPatch, modelForValidation);
      setValidationMessage(currentValidation);
      const summary = patchSummary(currentPatch, modelForValidation);
      if (patchSummaryPre) patchSummaryPre.textContent = JSON.stringify(summary, null, 2);
      renderCableList(cableList, currentPatch);
      if (patchPanel && panelContainer) {
        const model = modelForValidation;
        model.activeTemplate = currentTemplateId;
        patchPanel.renderPatchPanel(panelContainer, model);
        installPanelCableEditor(model);
        if (!currentValidation.ok && cableInteractionStatus) {
          cableInteractionStatus.dataset.valid = 'false';
          cableInteractionStatus.textContent = `Panel remains editable while validation reports: ${currentValidation.errors.join('; ')}`;
        }
      } else if (cableInteractionStatus) {
        cableInteractionStatus.textContent = 'Panel cable editor is unavailable because the patch panel renderer is missing.';
      }
      if (!optionsForRender.skipTemplateRender) renderTemplateControls();
      if (!optionsForRender.skipEditorSync) syncEditors();
      if (options.oscilloscope && typeof options.oscilloscope.run === 'function') options.oscilloscope.run();
      if (!optionsForRender.silentPatchChanged) emitPatchChanged(summary, optionsForRender);
      return { patch: clonePlain(currentPatch), validation: clonePlain(currentValidation), summary };
    }

    function replacePatch(patch, renderOptions = {}) {
      currentPatch = renderOptions.preserveComponentSet ? normalizeSerializedPatch(patch) : expandPatchToFullBoard(patch);
      currentTemplateId = renderOptions.templateId || inferTemplateIdFromPatch(currentPatch);
      if (templateSelect) templateSelect.value = currentTemplateId;
      updateFormCoefficients(form, readDampedPatchCoefficients(currentPatch));
      return renderAll(renderOptions);
    }

    function updatePatchCoefficient(componentId, coefficient, updateOptions = {}) {
      currentPatch = setPatchCoefficient(currentPatch, componentId, coefficient);
      if (updateOptions.syncEditors) syncEditors();
      if (updateOptions.emitPatchChanged) {
        const summary = patchSummary(currentPatch, currentPanelModel());
        emitPatchChanged(summary, Object.assign({ reason: 'coefficient-change', coefficientOnly: true }, updateOptions.renderOptions || {}));
      }
      return clonePlain(currentPatch);
    }

    function syncFromForm() {
      if (currentTemplateId === 'quickstart-damped-oscillation') currentPatch = setDampedPatchCoefficients(currentPatch, readFormCoefficients(form));
      return renderAll();
    }

    function loadTemplate(templateId) {
      currentTemplateId = templateId || (templateSelect && templateSelect.value) || currentTemplateId;
      pendingTemplateId = currentTemplateId;
      const seedValues = currentTemplateId === 'quickstart-damped-oscillation' ? readFormCoefficients(form) : readTemplateControlValues();
      currentPatch = createFullBoardPatchFromTemplate(currentTemplateId, seedValues);
      if (templateSelect) templateSelect.value = currentTemplateId;
      updateFormCoefficients(form, readDampedPatchCoefficients(currentPatch));
      return renderAll({ applyDeviceControls: true, reason: 'template-load' });
    }

    if (templateSelect) templateSelect.addEventListener('change', () => previewSelectedTemplate(templateSelect.value));
    if (loadTemplateButton) loadTemplateButton.addEventListener('click', () => loadTemplate(templateSelect && templateSelect.value));
    if (form) {
      form.addEventListener('input', (event) => { if (formEventShouldSyncPatch(event)) syncFromForm(); });
      form.addEventListener('change', (event) => { if (formEventShouldSyncPatch(event)) syncFromForm(); });
    }
    if (applyJsonButton) {
      applyJsonButton.addEventListener('click', () => {
        try {
          replacePatch(JSON.parse(jsonEditor.value || '{}'), { skipEditorSync: true });
        } catch (error) {
          currentValidation = { ok: false, errors: [error.message], warnings: [] };
          setValidationMessage(currentValidation);
        }
      });
    }
    if (applyCablesButton) {
      applyCablesButton.addEventListener('click', () => {
        try {
          replacePatch(patchWithCableLines(currentPatch, cableEditor.value), { skipEditorSync: true });
        } catch (error) {
          currentValidation = { ok: false, errors: [error.message], warnings: [] };
          setValidationMessage(currentValidation);
        }
      });
    }
    if (resetButton) {
      resetButton.addEventListener('click', () => loadTemplate(currentTemplateId));
    }
    if (downloadButton) {
      downloadButton.addEventListener('click', () => downloadJson(currentPatch, `${currentTemplateId || 'browser'}_patch.json`));
    }
    if (saveDesignJsonButton) saveDesignJsonButton.addEventListener('click', saveCurrentDesignFile);
    if (loadDesignJsonButton) loadDesignJsonButton.addEventListener('click', loadSelectedDesignFile);
    if (saveDesignDraftButton) saveDesignDraftButton.addEventListener('click', saveCurrentDesignDraft);
    if (loadDesignDraftButton) loadDesignDraftButton.addEventListener('click', loadSavedDesignDraft);
    if (designFileInput) {
      designFileInput.addEventListener('change', () => {
        const file = designFileInput.files && designFileInput.files[0];
        renderDesignStorageStatus(designStorageStatus, file ? { action: 'selected-design-file', filename: file.name } : { action: 'selected-design-file', error: 'no file selected' }, Boolean(file));
      });
    }

    renderAll();
    return {
      getPatch: () => clonePlain(currentPatch),
      getValidation: () => clonePlain(currentValidation),
      getTemplateId: () => currentTemplateId,
      replacePatch,
      updatePatchCoefficient,
      loadTemplate,
      syncFromForm,
      reset: () => loadTemplate(currentTemplateId),
      saveCurrentDesignFile,
      loadSelectedDesignFile,
      saveCurrentDesignDraft,
      loadSavedDesignDraft,
      applyImportedDesignText,
      getCableEditorController: () => cableEditorController,
    };
  }

  const api = {
    PATCH_SCHEMA_VERSION,
    DEFAULT_INVENTORY_NAME,
    createEditableDampedPatch,
    createEditablePatchFromTemplate,
    createFullBoardPatchFromTemplate,
    expandPatchToFullBoard,
    fullBoardInventoryComponents,
    patchAllowsOpenInputs,
    normalizeSerializedPatch,
    readDampedPatchCoefficients,
    readPatchTemplateParameters,
    getPatchCoefficient,
    setPatchCoefficient,
    setDampedPatchCoefficients,
    setPatchTemplateParameters,
    readPatchDeviceControls,
    setPatchDeviceControls,
    inferTemplateIdFromPatch,
    cableLinesFromPatch,
    parseCableLines,
    patchWithCableLines,
    validateSerializedPatchForBrowser,
    panelModelFromSerializedPatch,
    templatePanelModelFromSerializedPatch,
    patchSummary,
    initPatchEditorApp,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingPatchEditorApp = api;
}(typeof window !== 'undefined' ? window : global));
