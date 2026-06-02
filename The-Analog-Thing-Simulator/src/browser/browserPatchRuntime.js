/* global window, document */
'use strict';

(function attachBrowserPatchRuntime(globalScope) {
  const PATCH_SCHEMA_VERSION = 'analog-thing-patch/v1';
  const DEFAULT_INVENTORY_NAME = 'that-prototype-board/v006';
  const MODES = Object.freeze({ OFF: 'OFF', COEFF: 'COEFF', IC: 'IC', OP: 'OP', HALT: 'HALT', REP: 'REP', REPF: 'REPF', MINION: 'MINION' });

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeTimeProfile(profile) {
    if (!profile || !Array.isArray(profile.points) || profile.points.length === 0) return null;
    const points = profile.points
      .map((point) => ({ t: finiteNumber(point.t, NaN), value: finiteNumber(point.value, NaN) }))
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.value))
      .sort((a, b) => a.t - b.t);
    if (!points.length) return null;
    return { kind: profile.kind || 'linear-points', scale: profile.scale || 'absolute', repeat: Boolean(profile.repeat), points };
  }

  function evaluateTimeProfile(profile, context = {}, fallback = 0) {
    const normalized = normalizeTimeProfile(profile);
    if (!normalized) return fallback;
    const points = normalized.points;
    let t = finiteNumber(context.time, 0);
    if (normalized.repeat && points.length > 1) {
      const start = points[0].t;
      const end = points[points.length - 1].t;
      const period = end - start;
      if (period > 0) t = start + ((((t - start) % period) + period) % period);
    }
    if (t <= points[0].t) return points[0].value;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const next = points[index];
      if (t <= next.t) {
        const span = next.t - previous.t;
        if (span <= 0) return next.value;
        const alpha = (t - previous.t) / span;
        return previous.value + alpha * (next.value - previous.value);
      }
    }
    return points[points.length - 1].value;
  }

  function effectivePotentiometerCoefficient(component, context = {}) {
    const coefficient = finiteNumber(component.coefficient, 0.5);
    if (!component.timeProfile) return coefficient;
    const profile = normalizeTimeProfile(component.timeProfile);
    if (!profile) return coefficient;
    const profiled = evaluateTimeProfile(profile, context, coefficient);
    const scaled = profile.scale === 'multiplier' ? coefficient * profiled : profiled;
    return Math.max(0, Math.min(1, scaled));
  }

  function assertFiniteNumber(value, name) {
    if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number, got ${value}`);
  }

  function clampMachineUnit(value) {
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  }


  function eulerSimpsonIntegral(fn, from, to, panels = 8000) {
    let n = Math.max(2, Math.round(panels));
    if (n % 2) n += 1;
    const h = (to - from) / n;
    let sum = fn(from) + fn(to);
    for (let index = 1; index < n; index += 1) sum += (index % 2 ? 4 : 2) * fn(from + index * h);
    return (h / 3) * sum;
  }

  function componentByIdInPatch(patch, id) {
    return ((patch && patch.components) || []).find((component) => component && component.id === id) || null;
  }

  function coefficientFromPatch(patch, id, fallback) {
    const component = componentByIdInPatch(patch, id);
    return finiteNumber(component && component.coefficient, fallback);
  }

  function eulerSpiralRunOpTime(patch, options = {}) {
    const mode = options.mode || (patch && patch.deviceControls && patch.deviceControls.mode) || MODES.REPF;
    if (mode === MODES.REP || mode === MODES.REPF) return Math.max(0.001, finiteNumber(options.opTime, finiteNumber(patch && patch.parameters && patch.parameters.opTimeSeconds, 120)));
    return Math.max(0.001, finiteNumber(options.duration, finiteNumber(patch && patch.parameters && patch.parameters.opTimeSeconds, 120)));
  }

  function eulerSpiralCenteredSweepForRuntime(patch, options = {}) {
    const parameters = (patch && patch.parameters) || {};
    const opTimeSeconds = eulerSpiralRunOpTime(patch, options);
    const tauRate = finiteNumber(parameters.tauRate, coefficientFromPatch(patch, 'P1', 0.1));
    const xScale = coefficientFromPatch(patch, 'P2', finiteNumber(parameters.xScale, 0.6));
    const yScale = coefficientFromPatch(patch, 'P5', finiteNumber(parameters.yScale, 0.6));
    const coordinateRate = finiteNumber(parameters.coordinateRate, tauRate / 2);
    const tauSpan = Math.max(1, finiteNumber(options.eulerSpiralTauSpan, tauRate * opTimeSeconds / 2));
    const rampRate = 2 / opTimeSeconds;
    const oscillatorRate = (2 * tauSpan * tauSpan) / opTimeSeconds;
    const phase = (tauSpan * tauSpan) / 2;
    const cos0 = Math.cos(phase);
    const minusSin0 = -Math.sin(phase);
    const panels = Math.min(100000, Math.max(4000, Math.ceil(tauSpan * 2000)));
    const cosIntegral = eulerSimpsonIntegral((s) => Math.cos((tauSpan * tauSpan * s * s) / 2), -1, 1, panels);
    const sinIntegral = eulerSimpsonIntegral((s) => Math.sin((tauSpan * tauSpan * s * s) / 2), -1, 1, panels);
    const deltaX = coordinateRate * xScale * (opTimeSeconds / 2) * cosIntegral;
    const deltaY = coordinateRate * yScale * (opTimeSeconds / 2) * sinIntegral;
    return {
      opTimeSeconds,
      tauRate,
      tauSpan,
      normalizedTauStart: -1,
      normalizedTauEnd: 1,
      rampRate,
      oscillatorRate,
      coordinateRate,
      xScale,
      yScale,
      cos0,
      minusSin0,
      x0: -deltaX / 2,
      y0: -deltaY / 2,
      expectedCenteredFinalX: deltaX / 2,
      expectedCenteredFinalY: deltaY / 2,
    };
  }

  function removeEulerIcAndDisplayCables(cables) {
    const removedTargets = new Set(['I1.ic', 'I2.ic', 'I3.ic', 'I4.ic', 'I5.ic']);
    return (cables || []).filter((cable) => cable && !removedTargets.has(cable.to));
  }

  function upsertEulerCable(cables, from, to, label) {
    if (!cables.some((cable) => cable.from === from && cable.to === to)) cables.push({ from, to, label });
  }

  function autoCenterEulerSpiralPatchForRun(serializedPatch, options = {}) {
    const patch = normalizeSerializedPatch(serializedPatch);
    const parameters = patch.parameters || {};
    if (parameters.firstStepsExampleId !== 'first-steps-euler-spiral' || parameters.eulerSpiralAutoCenterForRun === false) return patch;
    const sweep = eulerSpiralCenteredSweepForRuntime(patch, options);
    const componentUpdates = {
      I1: { initialState: sweep.normalizedTauStart },
      I2: { rate: sweep.oscillatorRate, initialState: sweep.cos0 },
      I3: { rate: sweep.oscillatorRate, initialState: sweep.minusSin0 },
      I4: { rate: sweep.coordinateRate, initialState: sweep.x0 },
      I5: { rate: sweep.coordinateRate, initialState: sweep.y0 },
      P1: { coefficient: sweep.rampRate },
      P2: { coefficient: sweep.xScale },
      P3: { coefficient: Math.abs(sweep.cos0) },
      P4: { coefficient: Math.abs(sweep.minusSin0) },
      P5: { coefficient: sweep.yScale },
    };
    patch.components = patch.components.map((component) => Object.assign({}, component, componentUpdates[component.id] || {}));
    patch.connections = removeEulerIcAndDisplayCables(patch.connections);
    upsertEulerCable(patch.connections, 'MINUS1.out', 'P1.in', '-1 through P1 makes normalized tau ramp upward');
    upsertEulerCable(patch.connections, 'P1.out', 'I1.in1', 'normalized tau derivative is +P1');
    upsertEulerCable(patch.connections, 'PLUS1.out', 'P3.in', 'feed displayed cosine IC magnitude control');
    upsertEulerCable(patch.connections, 'PLUS1.out', 'P4.in', 'feed displayed sine IC magnitude control');
    patch.cables = patch.connections;
    patch.parameters = Object.assign({}, parameters, {
      normalizedTauSweep: true,
      eulerSpiralAutoCenterForRun: true,
      opTimeSeconds: sweep.opTimeSeconds,
      tauRate: sweep.tauRate,
      tauSpan: sweep.tauSpan,
      rampRate: sweep.rampRate,
      oscillatorRate: sweep.oscillatorRate,
      coordinateRate: sweep.coordinateRate,
      xScale: sweep.xScale,
      yScale: sweep.yScale,
      cos0: sweep.cos0,
      minusSin0: sweep.minusSin0,
      minusSinMagnitude0: Math.abs(sweep.minusSin0),
      coefficients: Object.assign({}, parameters.coefficients || {}, { P1: sweep.rampRate, P2: sweep.xScale, P3: Math.abs(sweep.cos0), P4: Math.abs(sweep.minusSin0), P5: sweep.yScale }),
      centeredInitial: { x0: sweep.x0, y0: sweep.y0, expectedCenteredFinalX: sweep.expectedCenteredFinalX, expectedCenteredFinalY: sweep.expectedCenteredFinalY },
      centeredSweep: sweep,
    });
    return patch;
  }

  function isOverloaded(value) {
    return Math.abs(value) > 1;
  }

  function weightedInputNames(prefix, count, weight) {
    const result = [];
    for (let index = 1; index <= count; index += 1) result.push({ name: `${prefix}${index}`, weight, required: false });
    return result;
  }

  function createPrototypeInventoryComponents(defaultCoefficient = 0.5) {
    const components = [
      { id: 'PLUS1', type: 'constant', label: '+1 machine unit', value: 1 },
      { id: 'MINUS1', type: 'constant', label: '-1 machine unit', value: -1 },
      { id: 'ZERO', type: 'constant', label: 'ground / zero', value: 0 },
    ];
    for (let index = 1; index <= 5; index += 1) {
      components.push({
        id: `I${index}`,
        type: 'integrator',
        label: `Integrator ${index}`,
        inputs: [
          { name: 'in1', weight: 1, required: true, description: 'THAT integrator x1 input' },
          { name: 'in10', weight: 10, required: false, description: 'THAT integrator x10 input' },
        ],
        initialState: 0,
        rate: 1,
      });
    }
    for (let index = 1; index <= 4; index += 1) components.push({ id: `INV${index}`, type: 'inverter', label: `Inverter ${index}` });
    for (let index = 1; index <= 4; index += 1) {
      components.push({
        id: `SUM${index}`,
        type: 'summer',
        label: `Summer ${index}`,
        inputs: [...weightedInputNames('in', 4, 1), ...weightedInputNames('in10_', 3, 10)],
        hasFeedbackJack: true,
      });
    }
    for (let index = 1; index <= 8; index += 1) components.push({ id: `P${index}`, type: 'potentiometer', label: `Coefficient potentiometer ${index}`, coefficient: defaultCoefficient });
    for (let index = 1; index <= 2; index += 1) components.push({ id: `MUL${index}`, type: 'multiplier', label: `Multiplier ${index}` });
    for (let index = 1; index <= 2; index += 1) components.push({ id: `CMP${index}`, type: 'comparator', label: `Comparator ${index}` });
    for (let index = 1; index <= 2; index += 1) {
      components.push({
        id: `XIR${index}`,
        type: 'xir',
        label: `XIR resistor network ${index}`,
        inputs: [...weightedInputNames('in', 4, 1), ...weightedInputNames('in10_', 3, 10)],
      });
    }
    for (let index = 1; index <= 4; index += 1) components.push({ id: `D${index}`, type: 'diode', label: `Diode ${index}`, forwardDrop: 0 });
    for (let index = 1; index <= 2; index += 1) components.push({ id: `ZD${index}`, type: 'z-diode', label: `Z-diode ${index}`, zenerVoltage: 0.68, mode: 'positive-overdrive' });
    for (let index = 1; index <= 5; index += 1) components.push({ id: `CAP${index}`, type: 'capacitor', label: `Capacitor ${index}`, initialState: 0, rate: 1 });
    for (const id of ['X', 'Y', 'Z', 'U']) components.push({ id: `OUT_${id}`, type: 'output', label: id });
    return components;
  }

  function createPrototypeInventory() {
    const components = createPrototypeInventoryComponents();
    const byId = new Map(components.map((component) => [component.id, component]));
    return {
      name: 'THAT prototype board inventory',
      components,
      getComponentDefinition(id, overrides = {}) {
        const found = byId.get(id);
        if (!found) throw new Error(`inventory component not found: ${id}`);
        return { ...clonePlain(found), ...clonePlain(overrides) };
      },
    };
  }

  function normalizeConnection(connection, index = 0) {
    if (Array.isArray(connection) && connection.length === 2) return { from: connection[0], to: connection[1] };
    if (connection && typeof connection.from === 'string' && typeof connection.to === 'string') {
      const normalized = { from: connection.from.trim(), to: connection.to.trim() };
      if (typeof connection.label === 'string') normalized.label = connection.label;
      return normalized;
    }
    throw new Error(`invalid connection ${index + 1}: ${JSON.stringify(connection)}`);
  }

  function parsePhysicalAccessorySocketId(socketId) {
    const text = String(socketId || '').trim();
    const match = /^phys\.(cap|diode|zdiode)(\d+)\.(a|b)$/i.exec(text);
    if (!match) return null;
    const kind = match[1].toLowerCase();
    const number = Number(match[2]);
    const terminal = match[3].toLowerCase();
    if (kind === 'cap') {
      return { socketId: text, accessoryId: `CAP${number}`, componentType: 'capacitor', accessoryType: 'capacitor', terminal, polarity: null };
    }
    if (kind === 'diode') {
      return { socketId: text, accessoryId: `DIODE${number}`, componentType: 'diode', accessoryType: 'diode', terminal, polarity: terminal === 'a' ? 'anode' : 'cathode' };
    }
    return { socketId: text, accessoryId: `ZDIODE${number}`, componentType: 'z-diode', accessoryType: 'z-diode', terminal, polarity: terminal === 'a' ? 'anode' : 'cathode' };
  }

  function isPhysicalAccessorySocketId(socketId) {
    return Boolean(parsePhysicalAccessorySocketId(socketId));
  }

  function bridgeablePhysicalAccessoryPolarity(sourceTerminal, sinkTerminal) {
    if (!sourceTerminal || !sinkTerminal) return { ok: false, mode: null };
    if (sourceTerminal.componentType === 'capacitor') return { ok: true, mode: null };
    if (sourceTerminal.componentType === 'diode') {
      return { ok: sourceTerminal.polarity === 'anode' && sinkTerminal.polarity === 'cathode', mode: null };
    }
    if (sourceTerminal.componentType === 'z-diode') {
      if (sourceTerminal.polarity === 'anode') return { ok: true, mode: 'positive-overdrive' };
      if (sourceTerminal.polarity === 'cathode') return { ok: true, mode: 'negative-overdrive' };
    }
    return { ok: false, mode: null };
  }

  function uniqueGeneratedComponentId(baseId, usedIds) {
    if (!usedIds.has(baseId)) {
      usedIds.add(baseId);
      return baseId;
    }
    for (let suffix = 1; suffix < 1000; suffix += 1) {
      const id = `${baseId}_BRIDGE_${suffix}`;
      if (!usedIds.has(id)) {
        usedIds.add(id);
        return id;
      }
    }
    throw new Error(`could not allocate physical accessory component id for ${baseId}`);
  }

  function componentForPhysicalAccessoryBridge(accessory, componentId, polarity) {
    if (accessory.componentType === 'capacitor') {
      return { id: componentId, type: 'capacitor', label: `${accessory.accessoryId} physical capacitor`, initialState: 0, rate: 1 };
    }
    if (accessory.componentType === 'diode') {
      return { id: componentId, type: 'diode', label: `${accessory.accessoryId} physical diode`, forwardDrop: 0 };
    }
    return { id: componentId, type: 'z-diode', label: `${accessory.accessoryId} physical Z-diode`, zenerVoltage: 0.68, forwardDrop: 0, mode: polarity.mode || 'positive-overdrive' };
  }

  function materializePhysicalAccessoryPanelConnections(serialized) {
    const components = clonePlain(serialized.components || serialized.componentRefs || []);
    const rawConnections = clonePlain(serialized.connections || serialized.cables || []);
    const usedIds = new Set(components.map((component) => component && component.id).filter(Boolean));
    const usesByAccessory = new Map();

    rawConnections.forEach((connection, index) => {
      if (!connection || typeof connection.from !== 'string' || typeof connection.to !== 'string') return;
      const fromAccessory = parsePhysicalAccessorySocketId(connection.from);
      const toAccessory = parsePhysicalAccessorySocketId(connection.to);
      if (fromAccessory && !toAccessory) {
        const entry = usesByAccessory.get(fromAccessory.accessoryId) || { accessory: fromAccessory, uses: [] };
        entry.uses.push({ index, role: 'sink', terminal: fromAccessory, peerSocketId: connection.to, cable: connection });
        usesByAccessory.set(fromAccessory.accessoryId, entry);
      } else if (toAccessory && !fromAccessory) {
        const entry = usesByAccessory.get(toAccessory.accessoryId) || { accessory: toAccessory, uses: [] };
        entry.uses.push({ index, role: 'source', terminal: toAccessory, peerSocketId: connection.from, cable: connection });
        usesByAccessory.set(toAccessory.accessoryId, entry);
      }
    });

    const removeIndexes = new Set();
    const addedConnections = [];
    const materializedAccessories = [];
    for (const entry of Array.from(usesByAccessory.values()).sort((a, b) => a.accessory.accessoryId.localeCompare(b.accessory.accessoryId))) {
      const sourceUses = entry.uses.filter((use) => use.role === 'source');
      const sinkUses = entry.uses.filter((use) => use.role === 'sink');
      if (entry.uses.length !== 2 || sourceUses.length !== 1 || sinkUses.length !== 1) continue;
      const sourceUse = sourceUses[0];
      const sinkUse = sinkUses[0];
      if (sourceUse.terminal.terminal === sinkUse.terminal.terminal) continue;
      const polarity = bridgeablePhysicalAccessoryPolarity(sourceUse.terminal, sinkUse.terminal);
      if (!polarity.ok) continue;
      const componentId = uniqueGeneratedComponentId(entry.accessory.accessoryId, usedIds);
      components.push(componentForPhysicalAccessoryBridge(entry.accessory, componentId, polarity));
      removeIndexes.add(sourceUse.index);
      removeIndexes.add(sinkUse.index);
      addedConnections.push({ from: sourceUse.peerSocketId, to: `${componentId}.in`, label: sourceUse.cable.label || `${entry.accessory.accessoryId} physical accessory source` });
      addedConnections.push({ from: `${componentId}.out`, to: sinkUse.peerSocketId, label: sinkUse.cable.label || `${entry.accessory.accessoryId} physical accessory output` });
      materializedAccessories.push({ accessoryId: entry.accessory.accessoryId, componentId, componentType: entry.accessory.componentType, sourcePhysicalSocketId: sourceUse.terminal.socketId, sinkPhysicalSocketId: sinkUse.terminal.socketId });
    }

    const remainingConnections = rawConnections.filter((connection, index) => !removeIndexes.has(index));
    return {
      components,
      connections: remainingConnections.concat(addedConnections),
      materializedAccessories,
    };
  }

  function normalizeSerializedPatch(serialized) {
    if (!serialized || typeof serialized !== 'object') throw new Error('serialized patch must be an object');
    if (serialized.schemaVersion && serialized.schemaVersion !== PATCH_SCHEMA_VERSION) throw new Error(`unsupported patch schemaVersion: ${serialized.schemaVersion}`);
    const sourceComponents = serialized.components || serialized.componentRefs;
    if (!Array.isArray(sourceComponents)) throw new Error('serialized patch requires components array');
    const sourceConnections = serialized.connections || serialized.cables || [];
    if (!Array.isArray(sourceConnections)) throw new Error('serialized patch connections/cables must be an array');
    const materialized = materializePhysicalAccessoryPanelConnections(Object.assign({}, serialized, { components: sourceComponents, connections: sourceConnections }));
    const runtimeConnections = materialized.connections.filter((connection) => !connection || connection.panelOnly !== true);
    const parameters = clonePlain(serialized.parameters || {});
    if (materialized.materializedAccessories.length) parameters.physicalAccessoryMaterialization = materialized.materializedAccessories;
    return {
      schemaVersion: PATCH_SCHEMA_VERSION,
      inventory: serialized.inventory || DEFAULT_INVENTORY_NAME,
      name: serialized.name || 'unnamed serialized patch',
      description: serialized.description || '',
      components: materialized.components,
      connections: runtimeConnections.filter((connection) => !connection || connection.panelOnly !== true).map(normalizeConnection),
      outputs: clonePlain(serialized.outputs || {}),
      parameters,
    };
  }

  function normalizeComponentEntry(entry, inventory) {
    if (!entry || typeof entry.id !== 'string') throw new Error(`serialized component entry requires id: ${JSON.stringify(entry)}`);
    if (entry.type) return clonePlain(entry);
    const overrides = { ...entry };
    delete overrides.id;
    delete overrides.note;
    return inventory.getComponentDefinition(entry.id, overrides);
  }

  function splitSocketId(socketId) {
    const text = String(socketId || '');
    const index = text.indexOf('.');
    if (index <= 0 || index === text.length - 1 || text.indexOf('.', index + 1) !== -1) throw new Error(`socket id must use component.socket form: ${socketId}`);
    return { componentId: text.slice(0, index), socketName: text.slice(index + 1) };
  }

  function inputDefinition(inputDef) {
    if (typeof inputDef === 'string') return { name: inputDef, weight: 1, required: true };
    const weight = inputDef.weight === undefined ? 1 : finiteNumber(inputDef.weight, 1);
    return { name: inputDef.name, weight, required: inputDef.required === undefined ? true : Boolean(inputDef.required), description: inputDef.description || '' };
  }

  function weightedInputs(def, defaults) {
    return (def.inputs || defaults).map(inputDefinition);
  }

  function socketDef(component, name, direction, options = {}) {
    return {
      id: `${component.id}.${name}`,
      componentId: component.id,
      componentType: component.type,
      name,
      direction,
      required: Boolean(options.required),
      weight: options.weight,
      ordinary: options.ordinary !== false,
      description: options.description || '',
    };
  }

  function socketDefinitions(component) {
    switch (component.type) {
      case 'constant':
        return [socketDef(component, 'out', 'output')];
      case 'potentiometer':
        return [socketDef(component, 'in', 'input', { required: true }), socketDef(component, 'out', 'output')];
      case 'inverter': {
        const sockets = [socketDef(component, 'in', 'input', { required: true })];
        if (component.hasSummingJunction !== false) sockets.push(socketDef(component, 'sj', 'input', { required: false }));
        sockets.push(socketDef(component, 'out', 'output'));
        return sockets;
      }
      case 'summer': {
        const sockets = weightedInputs(component, [{ name: 'in1', weight: 1, required: true }]).map((input) => socketDef(component, input.name, 'input', { required: input.required, weight: input.weight }));
        if (component.hasSummingJunction !== false) sockets.push(socketDef(component, 'sj', 'input', { required: false }));
        if (component.hasFeedbackJack !== false) sockets.push(socketDef(component, 'fb', 'input', { required: false }));
        sockets.push(socketDef(component, 'out', 'output'));
        return sockets;
      }
      case 'integrator': {
        const sockets = weightedInputs(component, [{ name: 'in1', weight: 1, required: true }]).map((input) => socketDef(component, input.name, 'input', { required: input.required, weight: input.weight }));
        sockets.push(socketDef(component, 'ic', 'input', { required: false }));
        sockets.push(socketDef(component, 'slow', 'input', { required: false }));
        if (component.hasSummingJunction !== false) sockets.push(socketDef(component, 'sj', 'input', { required: false }));
        sockets.push(socketDef(component, 'out', 'output'));
        return sockets;
      }
      case 'multiplier':
        return [socketDef(component, 'x', 'input', { required: true }), socketDef(component, 'y', 'input', { required: true }), socketDef(component, 'out', 'output')];
      case 'comparator':
        return [
          socketDef(component, 'a', 'input', { required: true }),
          socketDef(component, 'b', 'input', { required: true }),
          socketDef(component, 'positive', 'input', { required: true }),
          socketDef(component, 'nonPositive', 'input', { required: true }),
          socketDef(component, 'out', 'output'),
        ];
      case 'diode':
        return [socketDef(component, 'in', 'input', { required: true }), socketDef(component, 'reference', 'input', { required: false }), socketDef(component, 'out', 'output')];
      case 'z-diode':
        return [socketDef(component, 'in', 'input', { required: true }), socketDef(component, 'reference', 'input', { required: false }), socketDef(component, 'out', 'output')];
      case 'capacitor':
        return [
          ...weightedInputs(component, [{ name: 'in', weight: 1, required: false }]).map((input) => socketDef(component, input.name, 'input', { required: input.required, weight: input.weight })),
          socketDef(component, 'ic', 'input', { required: false }),
          socketDef(component, 'out', 'output'),
        ];
      case 'xir':
        return [
          ...weightedInputs(component, [{ name: 'in1', weight: 1, required: false }, { name: 'in10', weight: 10, required: false }]).map((input) => socketDef(component, input.name, 'input', { required: input.required, weight: input.weight })),
          socketDef(component, 'out', 'output'),
        ];
      case 'output':
        return [socketDef(component, 'in', 'input', { required: true }), socketDef(component, 'out', 'output')];
      default:
        throw new Error(`unsupported component type: ${component.type}`);
    }
  }

  function socketId(component, name) {
    return `${component.id}.${name}`;
  }

  function getInput(inputValues, id) {
    const value = inputValues.get(id);
    if (value === undefined) return 0;
    assertFiniteNumber(value, id);
    return value;
  }

  function weightedTotal(component, inputValues, defaults) {
    let total = 0;
    for (const input of weightedInputs(component, defaults)) total += input.weight * getInput(inputValues, socketId(component, input.name));
    return total;
  }

  function evaluateStatelessComponent(component, inputValues, context = {}) {
    switch (component.type) {
      case 'constant':
        return [[socketId(component, 'out'), finiteNumber(component.value, 0)]];
      case 'potentiometer':
        return [[socketId(component, 'out'), effectivePotentiometerCoefficient(component, context) * getInput(inputValues, socketId(component, 'in'))]];
      case 'inverter':
        return [[socketId(component, 'out'), -(getInput(inputValues, socketId(component, 'in')) + (component.hasSummingJunction === false ? 0 : getInput(inputValues, socketId(component, 'sj'))))]];
      case 'summer': {
        const total = weightedTotal(component, inputValues, [{ name: 'in1', weight: 1, required: true }]) + (component.hasSummingJunction === false ? 0 : getInput(inputValues, socketId(component, 'sj')));
        const gain = finiteNumber(component.openAmplifierGain, 1000);
        const output = component.feedbackGrounded ? clampMachineUnit(-gain * total) : -total;
        return [[socketId(component, 'out'), output]];
      }
      case 'multiplier':
        return [[socketId(component, 'out'), getInput(inputValues, socketId(component, 'x')) * getInput(inputValues, socketId(component, 'y'))]];
      case 'comparator': {
        const sign = getInput(inputValues, socketId(component, 'a')) + getInput(inputValues, socketId(component, 'b'));
        return [[socketId(component, 'out'), getInput(inputValues, socketId(component, sign > 0 ? 'positive' : 'nonPositive'))]];
      }
      case 'diode': {
        const input = getInput(inputValues, socketId(component, 'in'));
        const reference = getInput(inputValues, socketId(component, 'reference'));
        const drop = finiteNumber(component.forwardDrop, 0);
        return [[socketId(component, 'out'), Math.max(0, input - reference - drop)]];
      }
      case 'z-diode': {
        const input = getInput(inputValues, socketId(component, 'in'));
        const reference = getInput(inputValues, socketId(component, 'reference'));
        const relative = input - reference;
        const z = Math.abs(finiteNumber(component.zenerVoltage, 0.68));
        const mode = component.mode || 'positive-overdrive';
        let output = 0;
        if (mode === 'negative-overdrive') output = Math.max(0, -relative - z);
        else if (mode === 'window-clamp') output = Math.max(-z, Math.min(z, relative));
        else output = Math.max(0, relative - z);
        return [[socketId(component, 'out'), output]];
      }
      case 'xir':
        return [[socketId(component, 'out'), weightedTotal(component, inputValues, [{ name: 'in1', weight: 1, required: false }, { name: 'in10', weight: 10, required: false }])]];
      case 'output':
        return [[socketId(component, 'out'), getInput(inputValues, socketId(component, 'in'))]];
      default:
        throw new Error(`unsupported stateless component type: ${component.type}`);
    }
  }

  function isStateful(component) {
    return component.type === 'integrator' || component.type === 'capacitor';
  }

  function stateDerivative(component, inputValues) {
    if (component.type === 'integrator') {
      const slowActive = Boolean(component.slowMode) || inputValues.has(socketId(component, 'slow'));
      const rate = finiteNumber(component.rate, 1) / (slowActive ? finiteNumber(component.slowFactor, 100) : 1);
      const sj = component.hasSummingJunction === false ? 0 : getInput(inputValues, socketId(component, 'sj'));
      return -rate * (weightedTotal(component, inputValues, [{ name: 'in1', weight: 1, required: true }]) + sj);
    }
    if (component.type === 'capacitor') return finiteNumber(component.rate, 1) * weightedTotal(component, inputValues, [{ name: 'in', weight: 1, required: false }]);
    return 0;
  }

  function stateFromIc(component, inputValues) {
    if (component.type === 'integrator') return inputValues.has(socketId(component, 'ic')) ? -getInput(inputValues, socketId(component, 'ic')) : finiteNumber(component.initialState, 0);
    if (component.type === 'capacitor') return inputValues.has(socketId(component, 'ic')) ? getInput(inputValues, socketId(component, 'ic')) : finiteNumber(component.initialState, 0);
    return finiteNumber(component.initialState, 0);
  }

  class BrowserPatchMachine {
    constructor(serializedPatch, options = {}) {
      const normalized = normalizeSerializedPatch(serializedPatch);
      const inventory = options.inventory || createPrototypeInventory();
      this.schemaVersion = normalized.schemaVersion;
      this.name = normalized.name;
      this.description = normalized.description;
      this.inventory = normalized.inventory;
      this.components = normalized.components.map((entry) => normalizeComponentEntry(entry, inventory));
      this.connections = normalized.connections;
      this.outputMap = normalized.outputs;
      this.parameters = normalized.parameters;
      this.allowUnconnectedInputs = Boolean(options.allowUnconnectedInputs);
      this.componentById = new Map();
      for (const component of this.components) {
        if (this.componentById.has(component.id)) throw new Error(`duplicate component id: ${component.id}`);
        this.componentById.set(component.id, component);
      }
      this.socketById = this.buildSocketIndex();
      this.integrators = this.components.filter((component) => component.type === 'integrator');
      this.statefulComponents = this.components.filter(isStateful);
      this.configureFeedbackJacks();
      this.validateConnections();
    }

    configureFeedbackJacks() {
      const fbConnections = new Map();
      for (const connection of this.connections) {
        const target = typeof connection.to === 'string' ? connection.to.match(/^(SUM\d+)\.fb$/) : null;
        if (target) fbConnections.set(target[1], connection.from);
      }
      for (const component of this.components) {
        if (component.type !== 'summer') continue;
        const source = fbConnections.get(component.id) || null;
        component.feedbackJackConnected = Boolean(source);
        component.feedbackGrounded = source === 'ZERO.out';
      }
    }

    buildSocketIndex() {
      const sockets = new Map();
      for (const component of this.components) {
        for (const socket of socketDefinitions(component)) {
          if (sockets.has(socket.id)) throw new Error(`duplicate socket id: ${socket.id}`);
          sockets.set(socket.id, socket);
        }
      }
      return sockets;
    }

    socketMetadata() {
      return Array.from(this.socketById.values()).map(clonePlain);
    }

    validateConnections() {
      const ordinaryInputDrivers = new Map();
      const connectedInputs = new Set();
      for (const connection of this.connections) {
        const source = this.socketById.get(connection.from);
        const target = this.socketById.get(connection.to);
        splitSocketId(connection.from);
        splitSocketId(connection.to);
        if (!source) throw new Error(`connection source references unknown socket: ${connection.from}`);
        if (!target) throw new Error(`connection target references unknown socket: ${connection.to}`);
        if (source.direction !== 'output') throw new Error(`connection source ${connection.from} must be an output socket, got ${source.direction}`);
        if (target.direction !== 'input') throw new Error(`connection target ${connection.to} must be an input socket, got ${target.direction}`);
        connectedInputs.add(connection.to);
        if (target.ordinary !== false) ordinaryInputDrivers.set(connection.to, (ordinaryInputDrivers.get(connection.to) || 0) + 1);
      }
      for (const [id, count] of ordinaryInputDrivers.entries()) {
        if (count > 1) throw new Error(`ordinary input ${id} has ${count} drivers; use a summer or explicit multi-input socket instead`);
      }
      if (!this.allowUnconnectedInputs) {
        for (const socket of this.socketById.values()) {
          if (socket.direction === 'input' && socket.required && !connectedInputs.has(socket.id)) throw new Error(`required input ${socket.id} is not connected`);
        }
      }
      for (const [label, outputSocket] of Object.entries(this.outputMap)) {
        const socket = this.socketById.get(outputSocket);
        if (!socket) throw new Error(`output ${label} references unknown socket: ${outputSocket}`);
        if (socket.direction !== 'output') throw new Error(`output ${label} ${outputSocket} must be an output socket, got ${socket.direction}`);
      }
      this.validateNoStatelessCycles();
    }

    validateNoStatelessCycles() {
      const statelessIds = new Set(this.components.filter((component) => !isStateful(component)).map((component) => component.id));
      const graph = new Map(Array.from(statelessIds).map((id) => [id, new Set()]));
      for (const connection of this.connections) {
        const from = splitSocketId(connection.from).componentId;
        const to = splitSocketId(connection.to).componentId;
        if (statelessIds.has(from) && statelessIds.has(to)) graph.get(from).add(to);
      }
      const visiting = new Set();
      const visited = new Set();
      const stack = [];
      const visit = (id) => {
        if (visiting.has(id)) {
          const cycleStart = stack.indexOf(id);
          const cycle = stack.slice(cycleStart).concat(id).join(' -> ');
          throw new Error(`stateless cycle detected: ${cycle}; insert an integrator/stateful element to break the loop`);
        }
        if (visited.has(id)) return;
        visiting.add(id);
        stack.push(id);
        for (const next of graph.get(id) || []) visit(next);
        stack.pop();
        visiting.delete(id);
        visited.add(id);
      };
      for (const id of graph.keys()) visit(id);
    }

    defaultStateVector() {
      const state = {};
      for (const component of this.statefulComponents) state[component.id] = finiteNumber(component.initialState, 0);
      return state;
    }

    propagate(values) {
      const inputValues = new Map();
      for (const connection of this.connections) {
        const value = values.get(connection.from);
        if (value !== undefined) inputValues.set(connection.to, value);
      }
      return inputValues;
    }

    evaluate(stateVector = this.defaultStateVector(), context = {}) {
      const values = new Map();
      for (const component of this.statefulComponents) values.set(socketId(component, 'out'), finiteNumber(stateVector[component.id], 0));
      let inputValues = this.propagate(values);
      const stateless = this.components.filter((component) => !isStateful(component));
      for (let pass = 0; pass < 32; pass += 1) {
        let changed = false;
        for (const component of stateless) {
          for (const [outputSocket, value] of evaluateStatelessComponent(component, inputValues, context)) {
            const previous = values.get(outputSocket);
            if (previous === undefined || Math.abs(previous - value) > 1e-15) {
              values.set(outputSocket, value);
              changed = true;
            }
          }
        }
        const nextInputValues = this.propagate(values);
        for (const [inputSocket, value] of nextInputValues.entries()) {
          const previous = inputValues.get(inputSocket);
          if (previous === undefined || Math.abs(previous - value) > 1e-15) changed = true;
        }
        inputValues = nextInputValues;
        if (!changed) break;
        if (pass === 31) throw new Error(`stateless patch evaluation did not settle for ${this.name}`);
      }
      const derivatives = {};
      for (const component of this.statefulComponents) derivatives[component.id] = stateDerivative(component, inputValues);
      const outputs = {};
      const outputDetails = {};
      for (const [label, outputSocket] of Object.entries(this.outputMap)) {
        const machineUnit = values.get(outputSocket) ?? inputValues.get(outputSocket) ?? 0;
        const clippedMachineUnit = clampMachineUnit(machineUnit);
        outputs[label] = machineUnit;
        outputDetails[label] = {
          socket: outputSocket,
          machineUnit,
          panelVolts: machineUnit * 10,
          rcaVolts: machineUnit,
          overloaded: isOverloaded(machineUnit),
          clippedMachineUnit,
          clippedPanelVolts: clippedMachineUnit * 10,
          clippedRcaVolts: clippedMachineUnit,
        };
      }
      const overloadedSockets = [];
      for (const [id, value] of values.entries()) if (isOverloaded(value)) overloadedSockets.push({ socket: id, value });
      for (const [id, value] of inputValues.entries()) if (isOverloaded(value)) overloadedSockets.push({ socket: id, value });
      return { values, inputValues, derivatives, outputs, outputDetails, overload: overloadedSockets.length > 0, overloadedSockets };
    }

    applyInitialConditions(baseState = this.defaultStateVector(), context = {}) {
      const preliminary = this.evaluate(baseState, context);
      const nextState = { ...baseState };
      for (const component of this.statefulComponents) nextState[component.id] = stateFromIc(component, preliminary.inputValues);
      return nextState;
    }
  }

  function addScaledState(state, derivatives, scale) {
    const next = {};
    for (const id of Object.keys(state)) next[id] = state[id] + scale * derivatives[id];
    return next;
  }

  function combineRk4(state, k1, k2, k3, k4, dt) {
    const next = {};
    for (const id of Object.keys(state)) next[id] = state[id] + (dt / 6) * (k1[id] + 2 * k2[id] + 2 * k3[id] + k4[id]);
    return next;
  }

  function clipStateVector(state) {
    const clipped = {};
    for (const [id, value] of Object.entries(state)) clipped[id] = clampMachineUnit(value);
    return clipped;
  }

  function rk4Step(machine, state, dt, options = {}) {
    if (dt <= 0) throw new Error(`dt must be > 0, got ${dt}`);
    const time = finiteNumber(options.time, 0);
    const k1 = machine.evaluate(state, { time, phase: 'k1' }).derivatives;
    const k2 = machine.evaluate(addScaledState(state, k1, dt / 2), { time: time + dt / 2, phase: 'k2' }).derivatives;
    const k3 = machine.evaluate(addScaledState(state, k2, dt / 2), { time: time + dt / 2, phase: 'k3' }).derivatives;
    const k4 = machine.evaluate(addScaledState(state, k3, dt), { time: time + dt, phase: 'k4' }).derivatives;
    const next = combineRk4(state, k1, k2, k3, k4, dt);
    return options.clip ? clipStateVector(next) : next;
  }

  function makeTracePoint(machine, state, t, cycle = 0, trigger = false, mode = 'OP') {
    const evaluation = machine.evaluate(state, { time: t, phase: 'trace' });
    return { t, cycle, trigger, mode, outputs: evaluation.outputs, outputDetails: evaluation.outputDetails, state: { ...state }, overload: evaluation.overload };
  }

  function positiveInteger(value, fallback) {
    const number = Math.round(finiteNumber(value, fallback));
    return number > 0 ? number : fallback;
  }

  function runMode(machine, options = {}) {
    const mode = options.mode || MODES.OP;
    const dt = finiteNumber(options.dt, 0.01);
    const sampleEvery = positiveInteger(options.sampleEvery, 10);
    const clip = Boolean(options.clip);
    if (mode === MODES.IC) {
      let state = machine.applyInitialConditions(options.initialState || machine.defaultStateVector());
      if (clip) state = clipStateVector(state);
      return { mode, dt, sampleEvery, clip, finalState: state, trace: [makeTracePoint(machine, state, 0, 0, true, mode)] };
    }
    if (mode === MODES.HALT) {
      const duration = finiteNumber(options.duration, 1);
      let state = options.reset === false && options.initialState ? { ...options.initialState } : machine.applyInitialConditions(options.initialState || machine.defaultStateVector());
      if (clip) state = clipStateVector(state);
      const trace = [];
      const steps = Math.round(duration / dt);
      for (let step = 0; step <= steps; step += 1) {
        if (step === 0 || step % sampleEvery === 0 || step === steps) trace.push(makeTracePoint(machine, state, step * dt, 0, step === 0, mode));
      }
      return { mode, dt, duration, sampleEvery, clip, finalState: state, trace };
    }
    if (mode === MODES.REP || mode === MODES.REPF) {
      const opTime = finiteNumber(options.opTime, 12);
      const cycles = positiveInteger(options.cycles, 3);
      const steps = Math.round(opTime / dt);
      const trace = [];
      let finalState = null;
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        let state = machine.applyInitialConditions();
        if (clip) state = clipStateVector(state);
        for (let step = 0; step <= steps; step += 1) {
          const t = cycle * opTime + step * dt;
          if (step === 0 || step % sampleEvery === 0 || step === steps) trace.push(makeTracePoint(machine, state, t, cycle, step === 0, mode));
          if (step < steps) state = rk4Step(machine, state, dt, { clip, time: t });
        }
        finalState = state;
      }
      return { mode, dt, opTime, cycles, sampleEvery, clip, finalState, trace };
    }
    if (mode === MODES.OFF || mode === MODES.COEFF || mode === MODES.MINION || mode === null) {
      return { mode, dt, duration: 0, sampleEvery, clip, finalState: options.initialState || machine.defaultStateVector(), trace: [] };
    }
    if (mode !== MODES.OP) throw new Error(`unsupported browser patch runtime mode: ${mode}`);
    const duration = finiteNumber(options.duration, machine.integrators.length === 0 ? 0 : 40);
    let state = options.initialState ? { ...options.initialState } : machine.applyInitialConditions();
    if (clip) state = clipStateVector(state);
    const trace = [makeTracePoint(machine, state, 0, 0, true, mode)];
    const steps = Math.round(duration / dt);
    for (let step = 1; step <= steps; step += 1) {
      const t = (step - 1) * dt;
      state = rk4Step(machine, state, dt, { clip, time: t });
      if (step % sampleEvery === 0 || step === steps) trace.push(makeTracePoint(machine, state, step * dt, 0, false, mode));
    }
    return { mode, dt, duration, sampleEvery, clip, finalState: state, trace };
  }

  function clampProgressPercent(currentStep, totalSteps) {
    if (!Number.isFinite(totalSteps) || totalSteps <= 0) return 1;
    return Math.max(0, Math.min(1, currentStep / totalSteps));
  }

  function abortError(message, partialResult = null, progress = null) {
    const error = new Error(message || 'Simulation stopped');
    error.name = 'AbortError';
    error.code = 'SIMULATION_ABORTED';
    if (partialResult) error.partialResult = partialResult;
    if (progress) error.progress = progress;
    return error;
  }

  function abortMessage(signal) {
    if (!signal) return 'Simulation stopped';
    if (typeof signal.reason === 'string') return signal.reason;
    if (signal.reason && typeof signal.reason.message === 'string') return signal.reason.message;
    return 'Simulation stopped';
  }

  function isAbortSignalAborted(signal) {
    return Boolean(signal && signal.aborted);
  }

  function emitProgress(onProgress, progress) {
    if (typeof onProgress === 'function') onProgress(progress);
    return progress;
  }

  function yieldToEventLoop() {
    if (typeof setTimeout === 'function') return new Promise((resolve) => setTimeout(resolve, 0));
    return Promise.resolve();
  }

  function progressPayload(details) {
    const percent = clampProgressPercent(details.currentStep || 0, details.totalSteps || 0);
    return {
      mode: details.mode,
      phase: details.phase || 'running',
      currentStep: details.currentStep || 0,
      totalSteps: details.totalSteps || 0,
      percent,
      percentText: `${Math.round(percent * 100)}%`,
      cycle: details.cycle || 0,
      cycles: details.cycles || 1,
      step: details.step || 0,
      steps: details.steps || details.totalSteps || 0,
      sampleCount: details.sampleCount || 0,
      triggerCount: details.triggerCount || 0,
      t: details.t || 0,
    };
  }

  function partialResultForMode(mode, settings, finalState, trace, extra = {}) {
    return Object.assign({
      mode,
      dt: settings.dt,
      sampleEvery: settings.sampleEvery,
      clip: settings.clip,
      stopped: true,
      finalState,
      trace,
    }, extra);
  }

  function totalStepsForMode(machine, mode, options, dt) {
    if (mode === MODES.HALT) return Math.round(finiteNumber(options.duration, 1) / dt);
    if (mode === MODES.REP || mode === MODES.REPF) {
      return positiveInteger(options.cycles, 3) * Math.round(finiteNumber(options.opTime, 12) / dt);
    }
    if (mode === MODES.OP) return Math.round(finiteNumber(options.duration, machine.integrators.length === 0 ? 0 : 40) / dt);
    return 0;
  }

  function shouldYield(step, yieldEvery) {
    return yieldEvery > 0 && step > 0 && step % yieldEvery === 0;
  }

  async function runModeAsync(machine, options = {}) {
    const mode = options.mode || MODES.OP;
    const dt = finiteNumber(options.dt, 0.01);
    const sampleEvery = positiveInteger(options.sampleEvery, 10);
    const clip = Boolean(options.clip);
    const yieldEvery = positiveInteger(options.yieldEvery, 250);
    const onProgress = options.onProgress;
    const signal = options.signal;
    const totalSteps = totalStepsForMode(machine, mode, options, dt);
    const settings = { dt, sampleEvery, clip };
    const progressBase = { mode, totalSteps, currentStep: 0, sampleCount: 0, triggerCount: 0 };

    function checkAbort(partialResult, progress) {
      if (isAbortSignalAborted(signal)) throw abortError(abortMessage(signal), partialResult, progress);
    }

    emitProgress(onProgress, progressPayload(Object.assign({}, progressBase, { phase: 'starting' })));
    checkAbort(null, progressPayload(Object.assign({}, progressBase, { phase: 'starting' })));

    if (mode === MODES.IC) {
      let state = machine.applyInitialConditions(options.initialState || machine.defaultStateVector());
      if (clip) state = clipStateVector(state);
      const trace = [makeTracePoint(machine, state, 0, 0, true, mode)];
      const result = { mode, dt, sampleEvery, clip, finalState: state, trace };
      emitProgress(onProgress, progressPayload({ mode, phase: 'complete', currentStep: 1, totalSteps: 1, sampleCount: trace.length, triggerCount: 1 }));
      return result;
    }

    if (mode === MODES.OFF || mode === MODES.COEFF || mode === MODES.MINION || mode === null) {
      const result = { mode, dt, duration: 0, sampleEvery, clip, finalState: options.initialState || machine.defaultStateVector(), trace: [] };
      emitProgress(onProgress, progressPayload({ mode, phase: 'complete', currentStep: 1, totalSteps: 1, sampleCount: 0, triggerCount: 0 }));
      return result;
    }

    if (mode === MODES.HALT) {
      const duration = finiteNumber(options.duration, 1);
      let state = options.reset === false && options.initialState ? { ...options.initialState } : machine.applyInitialConditions(options.initialState || machine.defaultStateVector());
      if (clip) state = clipStateVector(state);
      const trace = [];
      const steps = Math.round(duration / dt);
      for (let step = 0; step <= steps; step += 1) {
        const currentStep = Math.min(step, steps);
        const t = step * dt;
        if (step === 0 || step % sampleEvery === 0 || step === steps) trace.push(makeTracePoint(machine, state, t, 0, step === 0, mode));
        const progress = progressPayload({ mode, phase: 'running', currentStep, totalSteps: steps, step, steps, sampleCount: trace.length, triggerCount: 1, t });
        if (step === 0 || shouldYield(step, yieldEvery) || step === steps) emitProgress(onProgress, progress);
        checkAbort(partialResultForMode(mode, settings, state, trace, { duration }), progress);
        if (shouldYield(step, yieldEvery) && step < steps) await yieldToEventLoop();
      }
      const result = { mode, dt, duration, sampleEvery, clip, finalState: state, trace };
      emitProgress(onProgress, progressPayload({ mode, phase: 'complete', currentStep: steps, totalSteps: steps, step: steps, steps, sampleCount: trace.length, triggerCount: trace.filter((point) => point.trigger).length, t: duration }));
      return result;
    }

    if (mode === MODES.REP || mode === MODES.REPF) {
      const opTime = finiteNumber(options.opTime, 12);
      const cycles = positiveInteger(options.cycles, 3);
      const steps = Math.round(opTime / dt);
      const trace = [];
      let finalState = null;
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        let state = machine.applyInitialConditions();
        if (clip) state = clipStateVector(state);
        for (let step = 0; step <= steps; step += 1) {
          const t = cycle * opTime + step * dt;
          if (step === 0 || step % sampleEvery === 0 || step === steps) trace.push(makeTracePoint(machine, state, t, cycle, step === 0, mode));
          const currentStep = Math.min(cycle * steps + step, totalSteps);
          const progress = progressPayload({ mode, phase: 'running', currentStep, totalSteps, cycle: cycle + 1, cycles, step, steps, sampleCount: trace.length, triggerCount: trace.filter((point) => point.trigger).length, t });
          if (step === 0 || shouldYield(currentStep, yieldEvery) || (cycle === cycles - 1 && step === steps)) emitProgress(onProgress, progress);
          checkAbort(partialResultForMode(mode, settings, state, trace, { opTime, cycles }), progress);
          if (step < steps) state = rk4Step(machine, state, dt, { clip, time: t });
          if (shouldYield(currentStep, yieldEvery) && !(cycle === cycles - 1 && step === steps)) await yieldToEventLoop();
        }
        finalState = state;
      }
      const result = { mode, dt, opTime, cycles, sampleEvery, clip, finalState, trace };
      emitProgress(onProgress, progressPayload({ mode, phase: 'complete', currentStep: totalSteps, totalSteps, cycle: cycles, cycles, step: steps, steps, sampleCount: trace.length, triggerCount: trace.filter((point) => point.trigger).length, t: cycles * opTime }));
      return result;
    }

    if (mode !== MODES.OP) throw new Error(`unsupported browser patch runtime mode: ${mode}`);
    const duration = finiteNumber(options.duration, machine.integrators.length === 0 ? 0 : 40);
    let state = options.initialState ? { ...options.initialState } : machine.applyInitialConditions();
    if (clip) state = clipStateVector(state);
    const trace = [makeTracePoint(machine, state, 0, 0, true, mode)];
    const steps = Math.round(duration / dt);
    emitProgress(onProgress, progressPayload({ mode, phase: 'running', currentStep: 0, totalSteps: steps, step: 0, steps, sampleCount: trace.length, triggerCount: 1, t: 0 }));
    for (let step = 1; step <= steps; step += 1) {
      const tStart = (step - 1) * dt;
      state = rk4Step(machine, state, dt, { clip, time: tStart });
      const t = step * dt;
      if (step % sampleEvery === 0 || step === steps) trace.push(makeTracePoint(machine, state, t, 0, false, mode));
      const progress = progressPayload({ mode, phase: 'running', currentStep: step, totalSteps: steps, step, steps, sampleCount: trace.length, triggerCount: 1, t });
      if (shouldYield(step, yieldEvery) || step === steps) emitProgress(onProgress, progress);
      checkAbort(partialResultForMode(mode, settings, state, trace, { duration }), progress);
      if (shouldYield(step, yieldEvery) && step < steps) await yieldToEventLoop();
    }
    const result = { mode, dt, duration, sampleEvery, clip, finalState: state, trace };
    emitProgress(onProgress, progressPayload({ mode, phase: 'complete', currentStep: steps, totalSteps: steps, step: steps, steps, sampleCount: trace.length, triggerCount: trace.filter((point) => point.trigger).length, t: duration }));
    return result;
  }

  async function runSerializedPatchAsync(serializedPatch, options = {}) {
    const runnablePatch = autoCenterEulerSpiralPatchForRun(serializedPatch, options);
    const machine = createRuntimeMachineFromSerializedPatch(runnablePatch, options);
    try {
      const result = await runModeAsync(machine, options);
      return { patch: normalizeSerializedPatch(runnablePatch), parameters: machine.parameters, result };
    } catch (error) {
      if (error && error.partialResult) error.partialPayload = { patch: normalizeSerializedPatch(runnablePatch), parameters: machine.parameters, result: error.partialResult };
      throw error;
    }
  }

  function createRuntimeMachineFromSerializedPatch(serializedPatch, options = {}) {
    return new BrowserPatchMachine(serializedPatch, options);
  }

  function runSerializedPatch(serializedPatch, options = {}) {
    const runnablePatch = autoCenterEulerSpiralPatchForRun(serializedPatch, options);
    const machine = createRuntimeMachineFromSerializedPatch(runnablePatch, options);
    const result = runMode(machine, options);
    return { patch: normalizeSerializedPatch(runnablePatch), parameters: machine.parameters, result };
  }

  function summarizeTraceResult(payload) {
    const result = payload && payload.result ? payload.result : payload;
    const trace = (result && result.trace) || [];
    const outputNames = trace[0] ? Object.keys(trace[0].outputs || {}) : [];
    const peaks = {};
    const finals = {};
    for (const name of outputNames) {
      peaks[name] = Math.max(...trace.map((point) => Math.abs(point.outputs[name] || 0)));
      finals[name] = trace.length ? trace[trace.length - 1].outputs[name] : 0;
    }
    return {
      mode: result && result.mode,
      sampleCount: trace.length,
      outputNames,
      finalState: result && result.finalState,
      overload: trace.some((point) => point.overload),
      triggerCount: trace.filter((point) => point.trigger).length,
      peaks,
      finals,
    };
  }

  function drawRuntimeTrace(canvas, resultOrPayload, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const result = resultOrPayload && resultOrPayload.result ? resultOrPayload.result : resultOrPayload;
    const trace = (result && result.trace) || [];
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#d6d6d6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    if (trace.length === 0) return;
    const requested = options.outputNames && Array.isArray(options.outputNames) ? options.outputNames : (options.outputName || 'all');
    const outputNames = Object.keys(trace[0].outputs || {});
    const names = Array.isArray(requested) ? outputNames.filter((name) => requested.includes(name)).slice(0, 4) : (requested === 'all' ? outputNames.slice(0, 4) : outputNames.filter((name) => name === requested).slice(0, 1));
    const maxT = Math.max(...trace.map((point) => point.t), 1e-9);
    const palette = ['#0f4c81', '#9a3412', '#047857', '#7c3aed'];
    names.forEach((name, index) => {
      ctx.strokeStyle = palette[index % palette.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      trace.forEach((point, pointIndex) => {
        const x = maxT === 0 ? 0 : (point.t / maxT) * width;
        const y = (height / 2) - clampMachineUnit(point.outputs[name] || 0) * (height * 0.42);
        if (pointIndex === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }

  const api = {
    PATCH_SCHEMA_VERSION,
    DEFAULT_INVENTORY_NAME,
    MODES,
    createPrototypeInventory,
    normalizeSerializedPatch,
    createRuntimeMachineFromSerializedPatch,
    runMode,
    runModeAsync,
    runSerializedPatch,
    runSerializedPatchAsync,
    summarizeTraceResult,
    drawRuntimeTrace,
    normalizeTimeProfile,
    evaluateTimeProfile,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingBrowserPatchRuntime = api;
}(typeof window !== 'undefined' ? window : global));
