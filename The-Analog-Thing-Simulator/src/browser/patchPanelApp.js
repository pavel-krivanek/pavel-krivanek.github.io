/* global window, document */
'use strict';

(function attachPatchPanelApp(globalScope) {
  const PANEL_REFERENCE_SVG = 'THAT_panel.svg';
  const PANEL_WIDTH = 702.65399;
  const PANEL_HEIGHT = 514.23199;
  const GALLERY_EXAMPLES = Object.freeze([
    Object.freeze({ id: 'quickstart-default', title: 'Quickstart damped oscillation', description: 'Default THAT quickstart-style setup: k, d, and 1/m are all 0.5 and the trace runs in REPF cycles.', options: Object.freeze({ k: 0.5, d: 0.5, invMass: 0.5, mode: 'REPF', output: 'both', duration: 40, opTime: 8, cycles: 3, dt: 0.01, sampleEvery: 50, clip: false }) }),
    Object.freeze({ id: 'light-damping', title: 'Light damping', description: 'Smaller damping coefficient. This keeps the oscillator alive longer and makes the repeated-cycle view easier to see.', options: Object.freeze({ k: 0.5, d: 0.12, invMass: 0.5, mode: 'REPF', output: 'both', duration: 48, opTime: 12, cycles: 3, dt: 0.01, sampleEvery: 50, clip: false }) }),
    Object.freeze({ id: 'heavy-damping', title: 'Heavy damping', description: 'A high damping coefficient suppresses oscillation and demonstrates how the patch changes behavior without changing cables.', options: Object.freeze({ k: 0.35, d: 0.95, invMass: 0.45, mode: 'OP', output: 'both', duration: 30, opTime: 8, cycles: 2, dt: 0.01, sampleEvery: 25, clip: false }) }),
    Object.freeze({ id: 'fast-spring', title: 'Stiffer spring / faster motion', description: 'A larger spring coefficient and inverse mass produce faster movement while still using the same educational patch.', options: Object.freeze({ k: 0.9, d: 0.28, invMass: 0.75, mode: 'REPF', output: 'both', duration: 30, opTime: 6, cycles: 4, dt: 0.005, sampleEvery: 80, clip: false }) }),
    Object.freeze({ id: 'ic-only', title: 'Initial condition inspection', description: 'Shows only the IC state: +1 applied to I1.IC becomes I1.out = -1, so the displayed velocity is +1 after the inverter.', options: Object.freeze({ k: 0.5, d: 0.5, invMass: 0.5, mode: 'IC', output: 'both', duration: 40, opTime: 8, cycles: 1, dt: 0.01, sampleEvery: 10, clip: false }) }),
    Object.freeze({ id: 'clipped-overload-demo', title: 'Clipping demonstration', description: 'Uses strong coefficients and enabled clipping to show the simulator boundary behavior around ±1 machine unit.', options: Object.freeze({ k: 1.0, d: 0.05, invMass: 1.0, mode: 'OP', output: 'both', duration: 16, opTime: 4, cycles: 2, dt: 0.01, sampleEvery: 20, clip: true }) }),
  ]);

  const TUTORIAL_STEPS = Object.freeze([
    'The browser patch panel now uses the uploaded SVG as the visual reference/background, so the panel looks like the provided layout instead of a hand-drawn approximation.',
    'Editable sockets are transparent overlays placed at the same coordinates as the visible sockets in the uploaded SVG; this keeps the original look while preserving cable editing.',
    'Integrator, summer, coefficient, multiplier, comparator, XIR, capacitor, diode, Z-diode, and output sections are therefore visually supplied by the reference SVG.',
    'IC mode: PLUS1 is patched to I1.IC. Because THAT integrator IC inputs are sign-inverted, I1 starts at -1 machine unit.',
    'I1.out is the stored negative velocity. INV1 turns it into positive velocity for display and for the damping term.',
    'I2 starts from the open/zero IC condition and integrates velocity into position. This gives the second state variable of the oscillator.',
    'P1 scales position by k. P2 scales velocity by d. P3 scales the force sum by 1/m.',
    'SUM1 is a negating summer, so spring plus damping becomes the negative force term that feeds the first integrator.',
    'OUT_X and OUT_Y route velocity and position to the virtual oscilloscope, analogous to THAT output jacks.',
  ]);

  const PANEL_CABLES = Object.freeze([
    Object.freeze({ id: 'c1', from: 'PLUS1.out', to: 'I1.ic', label: '+1 -> I1.IC' }),
    Object.freeze({ id: 'c3', from: 'P3.out', to: 'I1.in1', label: 'acceleration -> I1' }),
    Object.freeze({ id: 'c4', from: 'I1.out', to: 'I2.in1', label: '-velocity -> I2' }),
    Object.freeze({ id: 'c5', from: 'I1.out', to: 'INV1.in', label: '-velocity -> inverter' }),
    Object.freeze({ id: 'c6', from: 'I2.out', to: 'P1.in', label: 'position -> k' }),
    Object.freeze({ id: 'c7', from: 'INV1.out', to: 'P2.in', label: 'velocity -> d' }),
    Object.freeze({ id: 'c8', from: 'P1.out', to: 'SUM1.in1', label: 'k*x -> summer' }),
    Object.freeze({ id: 'c9', from: 'P2.out', to: 'SUM1.in2', label: 'd*v -> summer' }),
    Object.freeze({ id: 'c10', from: 'SUM1.out', to: 'P3.in', label: '-(k*x+d*v) -> 1/m' }),
    Object.freeze({ id: 'c11', from: 'INV1.out', to: 'OUT_X.in', label: 'velocity -> X' }),
    Object.freeze({ id: 'c12', from: 'I2.out', to: 'OUT_Y.in', label: 'position -> Y' }),
  ]);

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }
  function escapeText(text) { return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

  function getPhysicalSocketsCore() {
    if (globalScope.AnalogThingPhysicalSockets) return globalScope.AnalogThingPhysicalSockets;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/physicalSockets'); } catch (error) { return null; }
    }
    return null;
  }


  function getPanelPolishCore() {
    if (globalScope.AnalogThingDesignPanelPolish) return globalScope.AnalogThingDesignPanelPolish;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designPanelPolish'); } catch (error) { return null; }
    }
    return null;
  }


  function getDesignUsabilityCore() {
    if (globalScope.AnalogThingDesignUsability) return globalScope.AnalogThingDesignUsability;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('../core/designUsability'); } catch (error) { return null; }
    }
    return null;
  }

  function createPanelPhysicalSocketMap() {
    const core = getPhysicalSocketsCore();
    return core && core.createThatPhysicalSocketMap ? core.createThatPhysicalSocketMap({ referenceSvg: PANEL_REFERENCE_SVG }) : null;
  }
  function getGalleryExamples() { return GALLERY_EXAMPLES.map(clonePlain); }
  function getGalleryExample(id) { return clonePlain(GALLERY_EXAMPLES.find((example) => example.id === id) || GALLERY_EXAMPLES[0]); }
  function applyGalleryExampleToOptions(existingOptions, exampleId) { return Object.assign({}, existingOptions || {}, getGalleryExample(exampleId).options); }
  function componentById(components, id) { return components.find((component) => component.id === id) || null; }

  function parseSocketId(socketId) {
    const parts = String(socketId).split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`invalid socket id ${socketId}`);
    return { componentId: parts[0], socketName: parts[1] };
  }

  function socketPosition(component, socketName, direction) {
    if (component && component.socketPositions && component.socketPositions[socketName]) return clonePlain(component.socketPositions[socketName]);
    const inputNames = component.inputs || [];
    const outputNames = component.outputs || [];
    const isInput = direction === 'input';
    const names = isInput ? inputNames : outputNames;
    const index = Math.max(0, names.indexOf(socketName));
    const count = Math.max(1, names.length);
    return { x: isInput ? component.x : component.x + component.w, y: component.y + ((index + 1) / (count + 1)) * component.h };
  }

  function createComponent(id, type, label, role, x, y, w, h, inputs, outputs, socketPositions, options = {}) {
    return Object.assign({ id, type, label, role, x, y, w, h, inputs: inputs || [], outputs: outputs || [], requiredInputs: options.requiredInputs || [], socketPositions: socketPositions || {}, group: options.group || '' }, options);
  }

  function coeff(id, n, y) {
    return createComponent(id, 'potentiometer', id, `coefficient ${n}`, 0, y - 18, 100, 36, ['in'], ['out'], { in: { x: 30, y }, out: { x: 70, y } }, { group: 'COEFF', requiredInputs: ['P1', 'P2', 'P3'].includes(id) ? ['in'] : [] });
  }

  function integrator(id, index) {
    const x1 = 130 + index * 140;
    const x10 = 170 + index * 140;
    const xOut = 210 + index * 140;
    const xIc = 210 + index * 140;
    return createComponent(id, 'integrator', id, id === 'I1' ? 'integrates acceleration into -velocity' : id === 'I2' ? 'integrates velocity into position' : 'spare integrator', 101 + index * 140, 19, 138, 180,
      ['in1', 'in10', 'sj', 'ic', 'slow'], ['out'], {
        in1: { x: x1, y: 125 },
        in10: { x: x10, y: 45 },
        sj: { x: x10, y: 125 },
        ic: { x: xIc, y: 125 },
        slow: { x: x10, y: 165 },
        out: { x: xOut, y: 45 },
      }, { group: 'INTEGRATORS', requiredInputs: id === 'I1' ? ['ic', 'in1'] : id === 'I2' ? ['in1'] : [] });
  }

  function summer(id, index) {
    const x1 = 130 + index * 140;
    const x10 = 170 + index * 140;
    const xOut = 210 + index * 140;
    const xFb = 210 + index * 140;
    return createComponent(id, 'summer', id, id === 'SUM1' ? 'negates spring + damping' : 'spare summer', 101 + index * 140, 219, 138, 180,
      ['in1', 'in2', 'in3', 'in4', 'in10_1', 'in10_2', 'in10_3', 'sj', 'fb'], ['out'], {
        in1: { x: x1, y: 245 },
        in2: { x: x1, y: 285 },
        in3: { x: x1, y: 325 },
        in4: { x: x1, y: 365 },
        in10_1: { x: x10, y: 245 },
        in10_2: { x: x10, y: 285 },
        in10_3: { x: x10, y: 325 },
        sj: { x: x10, y: 365 },
        fb: { x: xFb, y: 325 },
        out: { x: xOut, y: 245 },
      }, { group: 'SUMMERS', requiredInputs: id === 'SUM1' ? ['in1', 'in2'] : [] });
  }

  function inverter(id, index) {
    const rows = [245, 285, 325, 365];
    const y = rows[index];
    return createComponent(id, 'inverter', id, id === 'INV1' ? 'recovers positive velocity' : 'spare inverter', 661, y - 18, 138, 36, ['in', 'sj'], ['out'], { in: { x: 730, y }, sj: { x: 690, y }, out: { x: 770, y } }, { group: 'INVERTERS', requiredInputs: id === 'INV1' ? ['in'] : [] });
  }

  function constant(id, label, x, y, required = false) {
    return createComponent(id, 'constant', label, label, x - 18, y - 18, 36, 36, [], ['out'], { out: { x, y } }, { group: 'MACHINE', requiredInputs: required ? ['out'] : [] });
  }

  function multiplier(id, y) {
    return createComponent(id, 'multiplier', id, 'spare multiplier', 101, y - 20, 138, 38, ['x', 'y'], ['out'], { x: { x: 130, y }, y: { x: 170, y }, out: { x: 210, y } }, { group: 'MULTIPLIERS' });
  }

  function comparator(id, index) {
    const xA = 270 + index * 140;
    const xSel = 310 + index * 140;
    const xOut = 350 + index * 140;
    return createComponent(id, 'comparator', id, 'spare comparator', 241 + index * 140, 422, 138, 85, ['a', 'positive', 'b', 'nonPositive'], ['out'], { a: { x: xA, y: 450.85059 }, positive: { x: xSel, y: 450.85059 }, b: { x: xA, y: 490.85059 }, nonPositive: { x: xSel, y: 490.85059 }, out: { x: xOut, y: 450.85059 } }, { group: 'COMPARATORS' });
  }

  function xir(id, xOffset) {
    return createComponent(id, 'xir', id, 'spare resistor network', 521 + xOffset, 422, 138, 85, ['in1', 'in10_1', 'in2', 'in3', 'in10_2'], ['out'], { out: { x: 550 + xOffset, y: 450.85059 }, in1: { x: 590 + xOffset, y: 450.85059 }, in10_1: { x: 630 + xOffset, y: 450.85059 }, in2: { x: 550 + xOffset, y: 490.85059 }, in3: { x: 590 + xOffset, y: 490.85059 }, in10_2: { x: 630 + xOffset, y: 490.85059 } }, { group: 'XIR' });
  }

  function output(id, label, x, y) {
    return createComponent(id, 'output', label, `${label} output`, x - 12, y - 18, 24, 36, ['in'], ['out'], { in: { x, y }, out: { x, y } }, { group: 'OUT', requiredInputs: id === 'OUT_X' || id === 'OUT_Y' ? ['in'] : [] });
  }

  function buildThatLikeComponents() {
    const coeffYs = [45, 85, 125, 165, 245, 285, 325, 365];
    const components = coeffYs.map((y, i) => coeff(`P${i + 1}`, i + 1, y));
    for (let i = 0; i < 5; i += 1) components.push(integrator(`I${i + 1}`, i));
    for (let i = 0; i < 4; i += 1) components.push(summer(`SUM${i + 1}`, i));
    for (let i = 0; i < 4; i += 1) components.push(inverter(`INV${i + 1}`, i));
    components.push(constant('MINUS1', '-1', 30, 450.85059));
    components.push(constant('PLUS1', '+1', 70, 450.85059));
    components.push(createComponent('ZERO', 'constant', '0', 'hidden zero for IC patch compatibility', 46, 472, 20, 20, [], ['out'], { out: { x: 50, y: 490.85059 } }, { group: 'MACHINE' }));
    components.push(multiplier('MUL1', 450.85059));
    components.push(multiplier('MUL2', 490.85059));
    components.push(comparator('CMP1', 0));
    components.push(comparator('CMP2', 1));
    components.push(xir('XIR1', 0));
    components.push(xir('XIR2', 140));
    components.push(output('OUT_X', 'X', 699.00894100, 568.09270659));
    components.push(output('OUT_Y', 'Y', 725.19319900, 602.48562788));
    components.push(output('OUT_Z', 'Z', 751.05306800, 568.09270659));
    components.push(output('OUT_U', 'U', 777.23732635, 602.48562788));
    return components;
  }

  function createPanelDecor() {
    return {
      reference: PANEL_REFERENCE_SVG,
      groups: [
        { id: 'COEFF' }, { id: 'INTEGRATORS' }, { id: 'SUMMERS' }, { id: 'INVERTERS' }, { id: 'MACHINE' }, { id: 'MULTIPLIERS' }, { id: 'COMPARATORS' }, { id: 'XIR' }, { id: 'CAPACITORS' }, { id: 'DIODES' }, { id: 'Z-DIODES' }, { id: 'OUT' },
      ],
      accessoryAreas: [{ id: 'CAPACITORS' }, { id: 'DIODES' }, { id: 'Z-DIODES' }],
    };
  }

  function getDampedOscillationPanelModel(options = {}) {
    const activeExample = options.activeExample || 'quickstart-default';
    const physicalSocketMap = createPanelPhysicalSocketMap();
    return { name: 'THAT quickstart damped oscillation patch panel', activeExample, example: getGalleryExample(activeExample), style: 'uploaded-reference-svg', referenceSvg: PANEL_REFERENCE_SVG, width: (physicalSocketMap && physicalSocketMap.panel && physicalSocketMap.panel.width) || PANEL_WIDTH, height: (physicalSocketMap && physicalSocketMap.panel && physicalSocketMap.panel.height) || PANEL_HEIGHT, components: buildThatLikeComponents(), cables: clonePlain(PANEL_CABLES), tutorialSteps: clonePlain(TUTORIAL_STEPS), decor: createPanelDecor(), physicalSocketMap, physicalSockets: physicalSocketMap ? clonePlain(physicalSocketMap.sockets) : [] };
  }

  function validatePanelModel(model) {
    const errors = [];
    const ids = new Set(model.components.map((component) => component.id));
    for (const cable of model.cables) {
      if (cable.panelOnly) continue;
      for (const endpointName of ['from', 'to']) {
        try {
          const endpoint = parseSocketId(cable[endpointName]);
          if (!ids.has(endpoint.componentId)) errors.push(`${cable.id}: unknown component ${endpoint.componentId}`);
          const component = componentById(model.components, endpoint.componentId);
          if (component) {
            const socketList = endpointName === 'from' ? (component.outputs || []) : (component.inputs || []);
            if (!socketList.includes(endpoint.socketName)) errors.push(`${cable.id}: unknown ${endpointName} socket ${cable[endpointName]}`);
          }
        } catch (error) { errors.push(`${cable.id}: ${error.message}`); }
      }
    }
    return { ok: errors.length === 0, errors };
  }

  function summarizePanelPatch(model) {
    const validation = validatePanelModel(model);
    const byType = {};
    for (const component of model.components) byType[component.type] = (byType[component.type] || 0) + 1;
    return { name: model.name, activeExample: model.activeExample, style: model.style || 'unknown', referenceSvg: model.referenceSvg || '', componentCount: model.components.length, cableCount: model.cables.length, componentTypes: byType, physicalSocketCount: ((model && model.physicalSockets) || []).length, activePhysicalSocketCount: ((model && model.physicalSockets) || []).filter((socket) => socket.active).length, displayOnlyPhysicalSocketCount: ((model && model.physicalSockets) || []).filter((socket) => socket.displayOnly || socket.unsupported).length, tutorialStepCount: model.tutorialSteps.length, groupCount: model.decor && Array.isArray(model.decor.groups) ? model.decor.groups.length : 0, accessoryAreaCount: model.decor && Array.isArray(model.decor.accessoryAreas) ? model.decor.accessoryAreas.length : 0, valid: validation.ok, validationErrors: validation.errors }; 
  }

  function physicalSocketPosition(model, physicalSocketId) {
    const socket = ((model && model.physicalSockets) || []).find((entry) => entry.id === physicalSocketId);
    return socket ? { x: Number(socket.x), y: Number(socket.y) } : null;
  }

  function endpointPositionForCable(model, cable, side, direction) {
    const connectorId = side === 'from' ? cable.fromConnectorId : cable.toConnectorId;
    const physicalId = connectorId && String(connectorId).startsWith('phys.') ? connectorId : cable[side];
    const physical = physicalSocketPosition(model, physicalId);
    if (physical) return physical;
    const parsed = parseSocketId(cable[side]);
    return socketPosition(componentById(model.components, parsed.componentId), parsed.socketName, direction);
  }

  function pathForCable(model, cable, index = 0) {
    const polish = getPanelPolishCore();
    if (!cable.panelOnly && polish && typeof polish.cableRouteSpec === 'function') return polish.cableRouteSpec(model, cable, index).path;
    const start = endpointPositionForCable(model, cable, 'from', 'output');
    const end = endpointPositionForCable(model, cable, 'to', 'input');
    const midX = (start.x + end.x) / 2;
    const lift = Math.max(14, Math.abs(end.x - start.x) * 0.08);
    return `M ${start.x} ${start.y} C ${midX} ${start.y - lift}, ${midX} ${end.y + lift}, ${end.x} ${end.y}`;
  }

  function renderSocketOverlay(component, socketName, direction) {
    const pos = socketPosition(component, socketName, direction);
    const id = `${component.id}.${socketName}`;
    return `<circle class="socket socket-hit ${escapeText(direction)}" data-socket-id="${escapeText(id)}" data-component-id="${escapeText(component.id)}" data-socket-name="${escapeText(socketName)}" data-direction="${escapeText(direction)}" tabindex="0" cx="${pos.x}" cy="${pos.y}" r="10"><title>${escapeText(id)}</title></circle>`;
  }

  function physicalSocketIdsForLogical(model, logicalSocketId, direction) {
    return ((model && model.physicalSockets) || [])
      .filter((socket) => socket.logicalSocketId === logicalSocketId && (!direction || socket.direction === direction))
      .map((socket) => socket.id);
  }

  function dataAttributesToSvg(attrs) {
    return Object.entries(attrs || {}).map(([key, value]) => `${escapeText(key)}="${escapeText(value)}"`).join(' ');
  }

  function cableTooltip(model, cable, index) {
    const usability = getDesignUsabilityCore();
    if (usability && typeof usability.cableAccessibilityLabel === 'function') return usability.cableAccessibilityLabel(cable, index, model).replace(/, /g, '\n');
    if (cable.panelOnly) {
      return [
        `panel-only cable ${index + 1}: ${cable.fromConnectorId || cable.from} -> ${cable.toConnectorId || cable.to}`,
        cable.label || '',
        'ignored by the current block-level runtime',
      ].filter(Boolean).join('\n');
    }
    const fromPhysical = physicalSocketIdsForLogical(model, cable.from, 'output');
    const toPhysical = physicalSocketIdsForLogical(model, cable.to, 'input');
    return [
      `cable ${index + 1}: ${cable.from} -> ${cable.to}`,
      cable.label || '',
      fromPhysical.length ? `from physical: ${fromPhysical.join(', ')}` : '',
      toPhysical.length ? `to physical: ${toPhysical.join(', ')}` : '',
    ].filter(Boolean).join('\n');
  }

  function renderPhysicalSocketOverlay(socket) {
    const logicalId = socket.logicalSocketId || socket.id;
    const direction = socket.direction || 'display-only';
    const usability = getDesignUsabilityCore();
    const polish = getPanelPolishCore();
    const spec = polish && typeof polish.socketRenderSpec === 'function' ? polish.socketRenderSpec(socket) : null;
    const visual = spec || (usability && typeof usability.socketVisualState === 'function'
      ? usability.socketVisualState(socket)
      : { status: socket.unsupported ? 'unsupported' : socket.active ? 'editable' : 'display-only', className: ['socket', 'socket-hit', 'physical-socket', direction, socket.active ? 'editable' : 'display-only'].join(' '), dataAttributes: {}, radius: 5, hitRadius: 10 });
    const tooltip = usability && typeof usability.socketAccessibilityLabel === 'function'
      ? usability.socketAccessibilityLabel(socket)
      : [
        socket.id,
        socket.logicalSocketId ? `logical: ${socket.logicalSocketId}` : 'display-only',
        `direction: ${direction}`,
        socket.group ? `group: ${socket.group}` : '',
        socket.role ? `role: ${socket.role}` : '',
        socket.unsupported ? 'unsupported by current runtime' : '',
      ].filter(Boolean).join(', ');
    const attr = Object.assign({}, visual.dataAttributes || {});
    const extraAttr = Object.assign({}, attr);
    delete extraAttr['data-socket-status'];
    delete extraAttr['data-editable'];
    delete extraAttr['data-unsupported'];
    delete extraAttr['aria-invalid'];
    const className = visual.className || ['socket', 'socket-hit', 'physical-socket', direction, socket.active ? 'editable' : 'display-only'].join(' ');
    const r = visual.hitRadius || 10;
    const renderRadius = visual.radius || 5;
    const label = visual.label && visual.label.text ? `<text class="${escapeText(visual.label.className)}" data-label-for="${escapeText(socket.id)}" x="${visual.label.x}" y="${visual.label.y}" text-anchor="${escapeText(visual.label.anchor)}"${visual.label.rotate ? ` transform="rotate(${visual.label.rotate} ${visual.label.x} ${visual.label.y})"` : ''}>${escapeText(visual.label.text)}</text>` : '';
    return `<g class="physical-socket-group ${escapeText(attr['data-panel-section'] || socket.group || '')}" data-physical-socket-id="${escapeText(socket.id)}"><circle class="${escapeText(className)}" data-socket-id="${escapeText(logicalId)}" data-editor-socket-id="${escapeText(socket.id)}" data-physical-socket-id="${escapeText(socket.id)}" data-logical-socket-id="${escapeText(socket.logicalSocketId || '')}" data-component-id="${escapeText(socket.componentId || '')}" data-socket-name="${escapeText(socket.socketName || '')}" data-direction="${escapeText(direction)}" data-group="${escapeText(socket.group)}" data-active="${socket.active ? 'true' : 'false'}" data-socket-status="${escapeText(attr['data-socket-status'] || visual.status)}" data-editable="${escapeText(attr['data-editable'] || (visual.editable ? 'true' : 'false'))}" data-unsupported="${escapeText(attr['data-unsupported'] || (socket.unsupported ? 'true' : 'false'))}" aria-invalid="${escapeText(attr['aria-invalid'] || 'false')}" aria-label="${escapeText(tooltip)}" ${dataAttributesToSvg(extraAttr)} tabindex="0" cx="${socket.x}" cy="${socket.y}" r="${r}"><title>${escapeText(tooltip.replace(/, /g, '\n'))}</title></circle><circle class="physical-socket-core ${escapeText(visual.status || '')}" cx="${socket.x}" cy="${socket.y}" r="${renderRadius}" aria-hidden="true"></circle>${label}</g>`;
  }

  function svgForPanelModel(model) {
    const validation = validatePanelModel(model);
    const polish = getPanelPolishCore();
    const cableSvg = model.cables.map((cable, index) => {
      const route = !cable.panelOnly && polish && typeof polish.cableRouteSpec === 'function' ? polish.cableRouteSpec(model, cable, index) : null;
      const routeAttrs = route ? dataAttributesToSvg(route.dataAttributes) : '';
      const routeClass = route ? route.className : 'panel-cable';
      return `<path class="${escapeText(routeClass)}" data-cable-id="${escapeText(cable.id)}" data-cable-index="${index}" data-from="${escapeText(cable.from)}" data-to="${escapeText(cable.to)}" ${routeAttrs} tabindex="0" role="button" aria-label="${escapeText(cableTooltip(model, cable, index))}" d="${route ? route.path : pathForCable(model, cable, index)}"><title>${escapeText(cableTooltip(model, cable, index))}</title></path>`;
    }).join('');
    const socketSvg = model.physicalSockets && model.physicalSockets.length
      ? model.physicalSockets.map(renderPhysicalSocketOverlay).join('')
      : model.components.map((component) => [
        ...(component.inputs || []).map((socket) => renderSocketOverlay(component, socket, 'input')),
        ...(component.outputs || []).map((socket) => renderSocketOverlay(component, socket, 'output')),
      ].join('')).join('');
    const status = validation.ok ? 'valid THAT panel based on uploaded SVG reference' : `invalid patch model: ${validation.errors.join('; ')}`;
    return `<svg class="that-reference-panel" tabindex="0" viewBox="0 0 ${model.width} ${model.height}" role="img" aria-label="${escapeText(status)}" xmlns="http://www.w3.org/2000/svg">
      <image class="panel-reference-image" href="${escapeText(model.referenceSvg || PANEL_REFERENCE_SVG)}" x="0" y="0" width="${model.width}" height="${model.height}" preserveAspectRatio="xMidYMid meet"></image>
      <g class="panel-cable-layer">${cableSvg}</g>
      <g class="panel-socket-overlay-layer">${socketSvg}</g>
    </svg>`;
  }

  function renderPatchPanel(container, model) { if (!container) return null; container.innerHTML = svgForPanelModel(model); return container.querySelector('svg'); }
  function renderTutorialList(container, steps) { if (container) container.innerHTML = steps.map((step, index) => `<li><strong>${index + 1}.</strong> ${escapeText(step)}</li>`).join(''); }
  function renderCableList(container, model) { if (container) container.innerHTML = model.cables.map((cable) => `<li><code>${escapeText(cable.from)}</code> → <code>${escapeText(cable.to)}</code><span>${escapeText(cable.label)}</span></li>`).join(''); }
  function setFormValue(form, name, value) { if (!form || !form[name]) return; const field = form[name]; if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = value; }
  function applyExampleToForm(form, example) { for (const [name, value] of Object.entries(example.options)) setFormValue(form, name, value); }
  function populateGallerySelect(select, examples) { if (select) select.innerHTML = examples.map((example) => `<option value="${escapeText(example.id)}">${escapeText(example.title)}</option>`).join(''); }

  function initPatchPanelApp(rootDocument, options = {}) {
    const doc = rootDocument || document;
    const select = doc.querySelector('#exampleSelect');
    const loadButton = doc.querySelector('#loadExample');
    const description = doc.querySelector('#exampleDescription');
    const panelContainer = doc.querySelector('#patchPanelSvg');
    const tutorialList = doc.querySelector('#tutorialSteps');
    const cableList = doc.querySelector('#cableList');
    const patchSummary = doc.querySelector('#patchPanelSummary');
    const form = doc.querySelector('#controls');
    populateGallerySelect(select, getGalleryExamples());
    let current = null;

    function apply(id) {
      const example = getGalleryExample(id || (select && select.value));
      const model = getDampedOscillationPanelModel({ activeExample: example.id });
      if (select) select.value = example.id;
      if (description) description.textContent = example.description;
      applyExampleToForm(form, example);
      renderPatchPanel(panelContainer, model);
      renderTutorialList(tutorialList, model.tutorialSteps);
      renderCableList(cableList, model);
      if (patchSummary) patchSummary.textContent = JSON.stringify(summarizePanelPatch(model), null, 2);
      const editor = options.patchEditor || globalScope.AnalogThingPatchEditorInstance;
      if (editor && typeof editor.syncFromForm === 'function') editor.syncFromForm();
      if (options.oscilloscope && typeof options.oscilloscope.run === 'function') options.oscilloscope.run();
      current = { example, model, summary: summarizePanelPatch(model) };
      return current;
    }

    if (loadButton) loadButton.addEventListener('click', () => apply(select && select.value));
    if (select) select.addEventListener('change', () => apply(select.value));
    apply(options.initialExample || 'quickstart-default');
    return { apply, getExamples: getGalleryExamples, getCurrentSummary: () => current && current.summary };
  }

  const api = { GALLERY_EXAMPLES, TUTORIAL_STEPS, PANEL_REFERENCE_SVG, getGalleryExamples, getGalleryExample, applyGalleryExampleToOptions, getDampedOscillationPanelModel, validatePanelModel, summarizePanelPatch, parseSocketId, socketPosition, pathForCable, svgForPanelModel, renderPatchPanel, initPatchPanelApp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingPatchPanelApp = api;
}(typeof window !== 'undefined' ? window : global));
