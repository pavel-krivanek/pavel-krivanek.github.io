'use strict';

(function attachDesignAccessories(globalScope) {
  const nodeRequire = typeof require === 'function' ? require : null;
  const physicalApi = globalScope.AnalogThingPhysicalSockets || (nodeRequire ? nodeRequire('./physicalSockets') : null);

  const ACCESSORY_SCHEMA_VERSION = 'analog-thing-design-accessories/v1';
  const ACCESSORY_TYPES = Object.freeze({
    CAPACITOR: 'capacitor',
    DIODE: 'diode',
    Z_DIODE: 'z-diode',
    FEEDBACK: 'feedback',
    GROUND_TIE: 'ground-tie',
  });

  const DEFAULT_ZENER_VOLTAGE = 0.68;
  const DEFAULT_DIODE_DROP = 0;

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }

  function socketMapFromOptions(options = {}) {
    if (options.physicalSocketMap || options.socketMap) return physicalApi.normalizePhysicalSocketMap(options.physicalSocketMap || options.socketMap);
    return physicalApi && physicalApi.createThatPhysicalSocketMap ? physicalApi.createThatPhysicalSocketMap() : { sockets: [] };
  }

  function faradsFromLabel(label) {
    const text = String(label || '').trim().toLowerCase();
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*([unpµm]?f?|p|n|u|µ)/);
    if (!match) return null;
    const value = Number(match[1]);
    const unit = match[2];
    const scale = unit.startsWith('p') ? 1e-12 : unit.startsWith('n') ? 1e-9 : unit.startsWith('u') || unit.startsWith('µ') ? 1e-6 : unit.startsWith('m') ? 1e-3 : 1;
    return Number.isFinite(value) ? value * scale : null;
  }

  function normalizeAccessoryType(type) {
    const text = String(type || '').trim().toLowerCase();
    if (text === 'capacitors' || text === 'cap') return ACCESSORY_TYPES.CAPACITOR;
    if (text === 'diodes') return ACCESSORY_TYPES.DIODE;
    if (text === 'zdiode' || text === 'z-diode' || text === 'z-diodes' || text === 'zener') return ACCESSORY_TYPES.Z_DIODE;
    if (text === 'feedback' || text === 'fb') return ACCESSORY_TYPES.FEEDBACK;
    if (text === 'ground' || text === 'tie' || text === 'ground-or-tie' || text === 'ground-tie') return ACCESSORY_TYPES.GROUND_TIE;
    return text || null;
  }

  function accessoryFromSocket(socket) {
    if (!socket) return null;
    const explicitType = normalizeAccessoryType(socket.accessoryType);
    let type = explicitType;
    if (!type) {
      if (socket.group === 'CAPACITORS' || socket.role === 'capacitor-terminal') type = ACCESSORY_TYPES.CAPACITOR;
      else if (socket.group === 'DIODES' || socket.role === 'diode-terminal') type = ACCESSORY_TYPES.DIODE;
      else if (socket.group === 'Z-DIODES' || socket.role === 'z-diode-terminal') type = ACCESSORY_TYPES.Z_DIODE;
      else if (socket.role === 'feedback-accessory') type = ACCESSORY_TYPES.FEEDBACK;
      else if (socket.role === 'ground-or-tie-accessory') type = ACCESSORY_TYPES.GROUND_TIE;
    }
    if (!type) return null;
    const accessoryId = socket.accessoryId || socket.id.replace(/\.(a|b|fb|t)$/i, '');
    const terminal = socket.terminal || (socket.id.endsWith('.a') ? 'a' : socket.id.endsWith('.b') ? 'b' : socket.role === 'feedback-accessory' ? 'fb' : socket.role === 'ground-or-tie-accessory' ? 't' : 'terminal');
    return {
      schemaVersion: ACCESSORY_SCHEMA_VERSION,
      id: accessoryId,
      type,
      group: socket.group,
      terminal,
      terminalSocketId: socket.id,
      label: socket.label || '',
      value: socket.value || null,
      valueFarads: socket.valueFarads === undefined || socket.valueFarads === null ? faradsFromLabel(socket.value || socket.label) : Number(socket.valueFarads),
      polarity: socket.polarity || null,
      runtimeSupport: socket.runtimeSupport || 'unsupported-two-terminal-panel-accessory',
      reason: socket.reason || socket.notes || '',
    };
  }

  function listPanelAccessories(options = {}) {
    const socketMap = socketMapFromOptions(options);
    const byId = new Map();
    for (const socket of socketMap.sockets || []) {
      const entry = accessoryFromSocket(socket);
      if (!entry) continue;
      if (!byId.has(entry.id)) {
        byId.set(entry.id, {
          schemaVersion: ACCESSORY_SCHEMA_VERSION,
          id: entry.id,
          type: entry.type,
          group: entry.group,
          label: entry.value || entry.label || entry.id,
          value: entry.value || null,
          valueFarads: entry.valueFarads || null,
          runtimeSupport: entry.runtimeSupport,
          terminals: [],
          supportedInRuntime: accessoryRuntimeAvailable(entry.type),
          behavior: accessoryBehaviorDescription(entry.type),
        });
      }
      const accessory = byId.get(entry.id);
      if (entry.value && !accessory.value) accessory.value = entry.value;
      if (entry.valueFarads && !accessory.valueFarads) accessory.valueFarads = entry.valueFarads;
      accessory.terminals.push({ socketId: entry.terminalSocketId, terminal: entry.terminal, label: entry.label, polarity: entry.polarity });
    }
    return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id)).map((entry) => {
      entry.terminals.sort((a, b) => a.terminal.localeCompare(b.terminal));
      return clonePlain(entry);
    });
  }

  function accessoryMaterializable(type) {
    const normalized = normalizeAccessoryType(type);
    return normalized === ACCESSORY_TYPES.CAPACITOR || normalized === ACCESSORY_TYPES.DIODE || normalized === ACCESSORY_TYPES.Z_DIODE;
  }

  function accessoryDirectRuntimeSocket(type) {
    const normalized = normalizeAccessoryType(type);
    return normalized === ACCESSORY_TYPES.FEEDBACK || normalized === ACCESSORY_TYPES.GROUND_TIE;
  }

  function accessoryRuntimeAvailable(type) {
    const normalized = normalizeAccessoryType(type);
    return accessoryMaterializable(normalized) || accessoryDirectRuntimeSocket(normalized);
  }

  function accessoryBehaviorDescription(type) {
    switch (normalizeAccessoryType(type)) {
      case ACCESSORY_TYPES.CAPACITOR:
        return 'idealized capacitive storage element available as a block-level capacitor runtime component';
      case ACCESSORY_TYPES.DIODE:
        return 'idealized diode overdrive element available as a block-level runtime component';
      case ACCESSORY_TYPES.Z_DIODE:
        return 'idealized Z-diode clamp/overdrive element available as a block-level runtime component';
      case ACCESSORY_TYPES.FEEDBACK:
        return 'active panel FB jack exposed as a SUM*.fb runtime input; grounding it approximates THAT open-amplifier behavior';
      case ACCESSORY_TYPES.GROUND_TIE:
        return 'active panel ground jack exposed as ZERO.out for FB-to-ground and zero-reference patching';
      default:
        return 'panel accessory socket';
    }
  }

  function accessoryById(id, options = {}) {
    return listPanelAccessories(options).find((entry) => entry.id === id) || null;
  }

  function accessoryByTerminalId(physicalSocketId, options = {}) {
    const socketMap = socketMapFromOptions(options);
    const socket = (socketMap.sockets || []).find((entry) => entry.id === physicalSocketId);
    const terminal = accessoryFromSocket(socket);
    if (!terminal) return null;
    const accessory = accessoryById(terminal.id, { socketMap });
    return accessory ? Object.assign({}, accessory, { matchedTerminal: terminal }) : null;
  }

  function unsupportedAccessoryDiagnosticDetails(socket) {
    const terminal = accessoryFromSocket(socket);
    if (!terminal) {
      return {
        code: 'unsupported-accessory-socket',
        hint: 'This visible panel jack is not currently represented by the block-level runtime; reconnect to an active logical socket.',
      };
    }
    if (terminal.type === ACCESSORY_TYPES.FEEDBACK) {
      return {
        code: 'supported-accessory-socket',
        accessoryCode: 'supported-feedback-socket',
        accessoryType: terminal.type,
        accessoryId: terminal.id,
        hint: 'The FB jack is an executable SUM*.fb input. Connect it to the neighboring ground jack/ZERO.out for open-amplifier mode.',
      };
    }
    if (terminal.type === ACCESSORY_TYPES.GROUND_TIE) {
      return {
        code: 'supported-accessory-socket',
        accessoryCode: 'supported-ground-tie-socket',
        accessoryType: terminal.type,
        accessoryId: terminal.id,
        hint: 'The rotated T/ground-style jack is an executable ZERO.out source.',
      };
    }
    const name = terminal.type === ACCESSORY_TYPES.Z_DIODE ? 'Z-diode' : terminal.type;
    return {
      code: 'unsupported-accessory-socket',
      accessoryCode: `unsupported-${terminal.type}-socket`,
      accessoryType: terminal.type,
      accessoryId: terminal.id,
      accessoryTerminal: terminal.terminal,
      hint: `The ${name} section has an idealized block-level runtime component. Complete two-cable physical accessory patterns are auto-materialized, but this endpoint is incomplete or ambiguous; connect the other accessory terminal to one executable endpoint, or replace the wiring with an explicit D*, ZD*, or CAP* logical component.`,
    };
  }

  function endpointPhysicalId(endpoint) {
    if (!endpoint) return null;
    if (typeof endpoint === 'string') return /^phys\./.test(endpoint.trim()) ? endpoint.trim() : null;
    const physical = endpoint.physicalSocketId || endpoint.physical || null;
    if (physical) return physical;
    const logical = endpoint.logicalSocketId || endpoint.logical || endpoint.socketId || endpoint.socket || null;
    return typeof logical === 'string' && /^phys\./.test(logical.trim()) ? logical.trim() : null;
  }

  function endpointLogicalId(endpoint) {
    if (!endpoint) return null;
    if (typeof endpoint === 'string') return /^phys\./.test(endpoint.trim()) ? null : endpoint;
    const logical = endpoint.logicalSocketId || endpoint.logical || endpoint.socketId || endpoint.socket || null;
    return typeof logical === 'string' && /^phys\./.test(logical.trim()) ? null : logical;
  }

  function normalizeEndpoint(endpoint) {
    const logicalSocketId = endpointLogicalId(endpoint);
    const physicalSocketId = endpointPhysicalId(endpoint);
    return {
      logicalSocketId: logicalSocketId ? String(logicalSocketId).trim() : null,
      physicalSocketId: physicalSocketId ? String(physicalSocketId).trim() : null,
    };
  }

  function bridgeComponentType(type) {
    const normalized = normalizeAccessoryType(type);
    if (normalized === ACCESSORY_TYPES.CAPACITOR) return 'capacitor';
    if (normalized === ACCESSORY_TYPES.DIODE) return 'diode';
    if (normalized === ACCESSORY_TYPES.Z_DIODE) return 'z-diode';
    return null;
  }

  function uniqueComponentId(baseId, existingIds) {
    const cleaned = String(baseId || 'ACCESSORY').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
    if (!existingIds.has(cleaned)) {
      existingIds.add(cleaned);
      return cleaned;
    }
    for (let suffix = 1; suffix < 1000; suffix += 1) {
      const id = `${cleaned}_BRIDGE_${suffix}`;
      if (!existingIds.has(id)) {
        existingIds.add(id);
        return id;
      }
    }
    throw new Error(`could not allocate unique component id for physical accessory ${baseId}`);
  }

  function activePeerEndpoint(cable, accessoryEndpointRole) {
    return normalizeEndpoint(accessoryEndpointRole === 'to' ? cable.from : cable.to);
  }

  function bridgeablePolarity(terminal, type, position) {
    const normalized = normalizeAccessoryType(type);
    if (normalized === ACCESSORY_TYPES.CAPACITOR) return { ok: true, mode: null };
    if (normalized === ACCESSORY_TYPES.DIODE) {
      const ok = position === 'source' ? terminal.polarity === 'anode' : terminal.polarity === 'cathode';
      return { ok, mode: null, reason: ok ? null : 'diode bridge currently requires anode as source and cathode as sink' };
    }
    if (normalized === ACCESSORY_TYPES.Z_DIODE) {
      if (position === 'source' && terminal.polarity === 'anode') return { ok: true, mode: 'positive-overdrive' };
      if (position === 'source' && terminal.polarity === 'cathode') return { ok: true, mode: 'negative-overdrive' };
      return { ok: true, mode: null };
    }
    return { ok: false, mode: null, reason: 'unsupported physical accessory type' };
  }

  function componentDefinitionForBridge(accessory, componentId, sourceUse) {
    const type = normalizeAccessoryType(accessory.type);
    const componentType = bridgeComponentType(type);
    if (!componentType) throw new Error(`cannot materialize unsupported accessory type ${accessory.type}`);
    const label = `${accessory.id} physical ${type}`;
    if (type === ACCESSORY_TYPES.CAPACITOR) {
      return {
        id: componentId,
        type: componentType,
        label,
        initialState: 0,
        rate: 1,
        value: accessory.value || null,
        valueFarads: accessory.valueFarads || null,
        inputs: [{ name: 'in', weight: 1, required: false, description: 'materialized physical capacitor drive' }],
      };
    }
    if (type === ACCESSORY_TYPES.DIODE) {
      return { id: componentId, type: componentType, label, forwardDrop: DEFAULT_DIODE_DROP };
    }
    const polarity = bridgeablePolarity(sourceUse.terminal, type, 'source');
    return {
      id: componentId,
      type: componentType,
      label,
      zenerVoltage: DEFAULT_ZENER_VOLTAGE,
      forwardDrop: DEFAULT_DIODE_DROP,
      mode: polarity.mode || 'positive-overdrive',
    };
  }

  function materializePhysicalAccessoriesFromDesign(design, options = {}) {
    const socketMap = socketMapFromOptions(options);
    const socketsById = new Map((socketMap.sockets || []).map((socket) => [socket.id, socket]));
    const next = clonePlain(design || {});
    const cables = (next.cables || next.connections || []).map((cable, index) => Object.assign({ id: `cable-${index + 1}` }, clonePlain(cable)));
    const components = (next.components || next.componentRefs || []).map(clonePlain);
    const existingComponentIds = new Set(components.map((component) => component.id));
    const usesByAccessory = new Map();

    for (const [index, cable] of cables.entries()) {
      for (const role of ['from', 'to']) {
        const physicalSocketId = endpointPhysicalId(cable[role]);
        if (!physicalSocketId) continue;
        const socket = socketsById.get(physicalSocketId);
        const terminal = accessoryFromSocket(socket);
        if (!terminal || !accessoryMaterializable(terminal.type)) continue;
        if (!usesByAccessory.has(terminal.id)) {
          const accessory = accessoryById(terminal.id, { socketMap }) || {
            id: terminal.id,
            type: terminal.type,
            value: terminal.value,
            valueFarads: terminal.valueFarads,
            terminals: [],
          };
          usesByAccessory.set(terminal.id, { accessory, uses: [] });
        }
        usesByAccessory.get(terminal.id).uses.push({
          cable,
          cableIndex: index,
          cableId: cable.id || `cable-${index + 1}`,
          endpointRole: role,
          physicalSocketId,
          terminal,
          peerEndpoint: activePeerEndpoint(cable, role),
        });
      }
    }

    const removedCableIndexes = new Set();
    const materializedAccessories = [];
    const unresolvedAccessoryUses = [];
    const addedCables = [];

    for (const entry of Array.from(usesByAccessory.values()).sort((a, b) => a.accessory.id.localeCompare(b.accessory.id))) {
      const sourceUses = entry.uses.filter((use) => use.endpointRole === 'to');
      const sinkUses = entry.uses.filter((use) => use.endpointRole === 'from');
      const type = normalizeAccessoryType(entry.accessory.type);
      const sourceUse = sourceUses[0];
      const sinkUse = sinkUses[0];
      const baseUnresolved = {
        accessoryId: entry.accessory.id,
        accessoryType: type,
        cableIds: entry.uses.map((use) => use.cableId),
        terminalSocketIds: entry.uses.map((use) => use.physicalSocketId),
      };
      if (entry.uses.length !== 2 || sourceUses.length !== 1 || sinkUses.length !== 1) {
        unresolvedAccessoryUses.push(Object.assign({}, baseUnresolved, { reason: 'needs exactly one cable from an active output into one accessory terminal and one cable from the other terminal into an active input' }));
        continue;
      }
      if (sourceUse.terminal.terminal === sinkUse.terminal.terminal || sourceUse.physicalSocketId === sinkUse.physicalSocketId) {
        unresolvedAccessoryUses.push(Object.assign({}, baseUnresolved, { reason: 'both accessory terminals must be used exactly once' }));
        continue;
      }
      if (!sourceUse.peerEndpoint.logicalSocketId && !sourceUse.peerEndpoint.physicalSocketId) {
        unresolvedAccessoryUses.push(Object.assign({}, baseUnresolved, { reason: 'source side is not connected to an executable output endpoint' }));
        continue;
      }
      if (!sinkUse.peerEndpoint.logicalSocketId && !sinkUse.peerEndpoint.physicalSocketId) {
        unresolvedAccessoryUses.push(Object.assign({}, baseUnresolved, { reason: 'sink side is not connected to an executable input endpoint' }));
        continue;
      }
      const sourcePolarity = bridgeablePolarity(sourceUse.terminal, type, 'source');
      const sinkPolarity = bridgeablePolarity(sinkUse.terminal, type, 'sink');
      if (!sourcePolarity.ok || !sinkPolarity.ok) {
        unresolvedAccessoryUses.push(Object.assign({}, baseUnresolved, { reason: sourcePolarity.reason || sinkPolarity.reason || 'unsupported accessory polarity for automatic bridge' }));
        continue;
      }

      const componentId = uniqueComponentId(entry.accessory.id, existingComponentIds);
      const component = componentDefinitionForBridge(entry.accessory, componentId, sourceUse);
      components.push(component);
      removedCableIndexes.add(sourceUse.cableIndex);
      removedCableIndexes.add(sinkUse.cableIndex);
      const inputSocket = component.type === 'capacitor' ? 'in' : 'in';
      addedCables.push({
        id: `${sourceUse.cableId}__${componentId}_in`,
        from: sourceUse.peerEndpoint,
        to: { logicalSocketId: `${componentId}.${inputSocket}`, physicalSocketId: null },
        label: sourceUse.cable.label || `${entry.accessory.id} source`,
      });
      addedCables.push({
        id: `${componentId}_out__${sinkUse.cableId}`,
        from: { logicalSocketId: `${componentId}.out`, physicalSocketId: null },
        to: sinkUse.peerEndpoint,
        label: sinkUse.cable.label || `${entry.accessory.id} output`,
      });
      materializedAccessories.push({
        accessoryId: entry.accessory.id,
        accessoryType: type,
        componentId,
        componentType: component.type,
        sourceCableId: sourceUse.cableId,
        sinkCableId: sinkUse.cableId,
        sourceTerminalSocketId: sourceUse.physicalSocketId,
        sinkTerminalSocketId: sinkUse.physicalSocketId,
        mode: component.mode || null,
      });
    }

    next.components = components;
    next.cables = cables.filter((cable, index) => !removedCableIndexes.has(index)).concat(addedCables);
    delete next.componentRefs;
    delete next.connections;
    const removedCableIds = cables
      .map((cable, index) => ({ cable, index }))
      .filter((entry) => removedCableIndexes.has(entry.index))
      .map((entry) => entry.cable.id || `cable-${entry.index + 1}`);
    return {
      design: next,
      materializedCount: materializedAccessories.length,
      materializedAccessories,
      materializedAccessoryIds: materializedAccessories.map((entry) => entry.accessoryId),
      removedCableIds,
      addedComponentIds: materializedAccessories.map((entry) => entry.componentId),
      addedCableCount: addedCables.length,
      addedCables: clonePlain(addedCables),
      unresolvedAccessoryUses,
    };
  }

  function previewPhysicalAccessoryMaterialization(design, options = {}) {
    const bridge = materializePhysicalAccessoriesFromDesign(design, options);
    const beforeCableCount = ((design && (design.cables || design.connections)) || []).length;
    const beforeComponentCount = ((design && (design.components || design.componentRefs)) || []).length;
    const afterComponents = bridge.design && bridge.design.components ? bridge.design.components : [];
    const afterCables = bridge.design && bridge.design.cables ? bridge.design.cables : [];
    const componentsById = new Map(afterComponents.map((component) => [component.id, component]));
    const cablesById = new Map(afterCables.map((cable) => [cable.id, cable]));
    const rows = (bridge.materializedAccessories || []).map((entry) => {
      const generatedCableIds = [`${entry.sourceCableId}__${entry.componentId}_in`, `${entry.componentId}_out__${entry.sinkCableId}`];
      return Object.assign({}, clonePlain(entry), {
        generatedComponent: clonePlain(componentsById.get(entry.componentId) || null),
        generatedCableIds,
        generatedCables: generatedCableIds.map((id) => clonePlain(cablesById.get(id) || null)).filter(Boolean),
      });
    });
    const preview = {
      schemaVersion: ACCESSORY_SCHEMA_VERSION,
      kind: 'physical-accessory-materialization-preview',
      ok: (bridge.unresolvedAccessoryUses || []).length === 0,
      materializedCount: bridge.materializedCount || 0,
      unresolvedCount: (bridge.unresolvedAccessoryUses || []).length,
      before: { componentCount: beforeComponentCount, cableCount: beforeCableCount },
      after: { componentCount: afterComponents.length, cableCount: afterCables.length },
      delta: { componentCount: afterComponents.length - beforeComponentCount, cableCount: afterCables.length - beforeCableCount },
      removedCableIds: clonePlain(bridge.removedCableIds || []),
      addedComponentIds: clonePlain(bridge.addedComponentIds || []),
      addedCableCount: bridge.addedCableCount || 0,
      addedCables: clonePlain(bridge.addedCables || []),
      materializedAccessories: rows,
      unresolvedAccessoryUses: clonePlain(bridge.unresolvedAccessoryUses || []),
      canConvert: (bridge.materializedCount || 0) > 0,
      conversionHint: (bridge.materializedCount || 0) > 0
        ? 'Convert to replace the physical accessory terminal cables with explicit logical diode/Z-diode/capacitor runtime components before running.'
        : 'No complete physical capacitor/diode/Z-diode terminal pair is ready for conversion.',
    };
    if (options.includeDesign) preview.design = clonePlain(bridge.design);
    return preview;
  }

  function summarizeAccessoryUse(design, options = {}) {
    const socketMap = socketMapFromOptions(options);
    const socketsById = new Map((socketMap.sockets || []).map((socket) => [socket.id, socket]));
    const bridge = materializePhysicalAccessoriesFromDesign(design, { socketMap });
    const bridgeableAccessoryIds = new Set(bridge.materializedAccessoryIds || []);
    const accessoryTerminalUses = [];
    const feedbackSocketUses = [];
    const unsupportedByType = {};
    const accessoryCableIds = [];
    for (const [index, cable] of ((design && design.cables) || []).entries()) {
      for (const role of ['from', 'to']) {
        const physicalSocketId = endpointPhysicalId(cable[role]);
        if (!physicalSocketId) continue;
        const socket = socketsById.get(physicalSocketId);
        const terminal = accessoryFromSocket(socket);
        if (!terminal) continue;
        const use = { cableId: cable.id || `cable-${index + 1}`, cableIndex: index, endpointRole: role, physicalSocketId, accessoryId: terminal.id, accessoryType: terminal.type, terminal: terminal.terminal };
        accessoryTerminalUses.push(use);
        accessoryCableIds.push(use.cableId);
        if (!bridgeableAccessoryIds.has(terminal.id) && !accessoryDirectRuntimeSocket(terminal.type)) unsupportedByType[terminal.type] = (unsupportedByType[terminal.type] || 0) + 1;
        if (terminal.type === ACCESSORY_TYPES.FEEDBACK) feedbackSocketUses.push(Object.assign({}, use, { executable: true, logicalSocketId: `${String(terminal.id).replace(/\.feedback$/, '')}.fb` }));
      }
    }
    const xirSjHelpers = findXirSjHelpers(design);
    return {
      schemaVersion: ACCESSORY_SCHEMA_VERSION,
      panelAccessoryCount: listPanelAccessories({ socketMap }).length,
      accessoryTerminalUseCount: accessoryTerminalUses.length,
      accessoryTerminalUses,
      accessoryCableIds: Array.from(new Set(accessoryCableIds)),
      unsupportedByType,
      feedbackSocketUses,
      feedbackSocketUseCount: feedbackSocketUses.length,
      xirSjHelpers,
      xirSjHelperCount: xirSjHelpers.length,
      runtimeSupportedAccessoryUseCount: bridge.materializedCount,
      materializedAccessoryCount: bridge.materializedCount,
      materializedAccessories: bridge.materializedAccessories,
      unresolvedAccessoryUses: bridge.unresolvedAccessoryUses,
    };
  }


  function terminalUseFromDesignCable(cable, index, role, socketMap) {
    const physicalSocketId = endpointPhysicalId(cable && cable[role]);
    if (!physicalSocketId) return null;
    const socket = (socketMap.sockets || []).find((entry) => entry.id === physicalSocketId) || null;
    const terminal = accessoryFromSocket(socket);
    if (!terminal || !accessoryMaterializable(terminal.type)) return null;
    return {
      cableId: cable.id || `cable-${index + 1}`,
      cableIndex: index,
      endpointRole: role,
      physicalSocketId,
      accessoryId: terminal.id,
      accessoryType: terminal.type,
      terminal: terminal.terminal,
      polarity: terminal.polarity || null,
      peerEndpoint: activePeerEndpoint(cable, role),
    };
  }

  function accessoryGuidanceHint(row) {
    const typeName = row.accessoryType === ACCESSORY_TYPES.Z_DIODE ? 'Z-diode' : row.accessoryType;
    if (row.status === 'complete') return `${row.accessoryId} is complete: convert it to an explicit logical ${typeName} runtime component before execution/export.`;
    if (row.status === 'partial') {
      if (row.missingDirection === 'sink') return `${row.accessoryId} is half-wired: connect terminal ${row.missingTerminal || 'the other terminal'} to one executable input socket to complete the ${typeName} pair.`;
      if (row.missingDirection === 'source') return `${row.accessoryId} is half-wired: connect one executable output socket to terminal ${row.missingTerminal || 'the other terminal'} to complete the ${typeName} pair.`;
      return `${row.accessoryId} is half-wired: use one cable from an output into one terminal and one cable from the other terminal into an input.`;
    }
    if (row.status === 'ambiguous') return `${row.accessoryId} has ambiguous accessory wiring; use exactly two cables, one into one terminal and one out of the other terminal.`;
    return `${row.accessoryId} is open: use one cable from an output into one terminal and one cable from the other terminal into an input.`;
  }

  function accessoryPairGuidance(design, options = {}) {
    const socketMap = socketMapFromOptions(options);
    const socketsById = new Map((socketMap.sockets || []).map((socket) => [socket.id, socket]));
    const accessories = listPanelAccessories({ socketMap }).filter((entry) => accessoryMaterializable(entry.type));
    const usesByAccessory = new Map();
    for (const accessory of accessories) usesByAccessory.set(accessory.id, []);
    for (const [index, cable] of ((design && (design.cables || design.connections)) || []).entries()) {
      for (const role of ['from', 'to']) {
        const use = terminalUseFromDesignCable(cable, index, role, socketMap);
        if (!use) continue;
        if (!usesByAccessory.has(use.accessoryId)) usesByAccessory.set(use.accessoryId, []);
        usesByAccessory.get(use.accessoryId).push(use);
      }
    }
    const rows = accessories.map((accessory) => {
      const uses = usesByAccessory.get(accessory.id) || [];
      const sourceUses = uses.filter((use) => use.endpointRole === 'to');
      const sinkUses = uses.filter((use) => use.endpointRole === 'from');
      const terminalEntries = (accessory.terminals || []).map((terminal) => {
        const socket = socketsById.get(terminal.socketId) || {};
        return Object.assign({}, terminal, {
          x: Number(socket.x),
          y: Number(socket.y),
          position: socket.position ? clonePlain(socket.position) : { x: Number(socket.x), y: Number(socket.y) },
        });
      }).sort((a, b) => String(a.terminal).localeCompare(String(b.terminal)));
      const usedTerminals = new Set(uses.map((use) => use.terminal));
      const missingTerminalEntry = terminalEntries.find((terminal) => !usedTerminals.has(terminal.terminal)) || null;
      const statusBase = {
        schemaVersion: ACCESSORY_SCHEMA_VERSION,
        kind: 'physical-accessory-pair-guidance',
        accessoryId: accessory.id,
        accessoryType: accessory.type,
        label: accessory.label || accessory.id,
        value: accessory.value || null,
        valueFarads: accessory.valueFarads || null,
        terminals: terminalEntries,
        terminalSocketIds: terminalEntries.map((terminal) => terminal.socketId),
        uses: uses.map(clonePlain),
        useCount: uses.length,
        sourceUseCount: sourceUses.length,
        sinkUseCount: sinkUses.length,
        missingTerminal: missingTerminalEntry ? missingTerminalEntry.terminal : null,
        missingTerminalSocketId: missingTerminalEntry ? missingTerminalEntry.socketId : null,
        missingDirection: null,
        status: 'open',
        readyToMaterialize: false,
        title: '',
        hint: '',
      };
      if (uses.length === 0) {
        statusBase.status = 'open';
      } else if (uses.length === 2 && sourceUses.length === 1 && sinkUses.length === 1 && sourceUses[0].terminal !== sinkUses[0].terminal) {
        const sourcePolarity = bridgeablePolarity(sourceUses[0].terminal, accessory.type, 'source');
        const sinkPolarity = bridgeablePolarity(sinkUses[0].terminal, accessory.type, 'sink');
        if (sourcePolarity.ok && sinkPolarity.ok) {
          statusBase.status = 'complete';
          statusBase.readyToMaterialize = true;
        } else {
          statusBase.status = 'ambiguous';
          statusBase.reason = sourcePolarity.reason || sinkPolarity.reason || 'unsupported accessory polarity for automatic bridge';
        }
      } else if (uses.length === 1) {
        statusBase.status = 'partial';
        statusBase.missingDirection = uses[0].endpointRole === 'to' ? 'sink' : 'source';
      } else {
        statusBase.status = 'ambiguous';
        statusBase.reason = 'needs exactly one output-to-terminal cable and one terminal-to-input cable on different terminals';
      }
      statusBase.hint = accessoryGuidanceHint(statusBase);
      statusBase.title = `${statusBase.accessoryId} ${statusBase.accessoryType}: ${statusBase.status}. ${statusBase.hint}`;
      return statusBase;
    });
    const byStatus = {};
    for (const row of rows) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    return {
      schemaVersion: ACCESSORY_SCHEMA_VERSION,
      kind: 'physical-accessory-pair-guidance-summary',
      accessoryCount: rows.length,
      completeCount: byStatus.complete || 0,
      partialCount: byStatus.partial || 0,
      ambiguousCount: byStatus.ambiguous || 0,
      openCount: byStatus.open || 0,
      readyToMaterializeCount: rows.filter((row) => row.readyToMaterialize).length,
      byStatus,
      rows,
    };
  }

  function accessoryPairGuidanceForPhysicalSocketId(design, physicalSocketId, options = {}) {
    const wanted = String(physicalSocketId || '').trim();
    const summary = accessoryPairGuidance(design, options);
    return summary.rows.find((row) => row.terminalSocketIds.includes(wanted)) || null;
  }

  function findXirSjHelpers(design) {
    const helpers = [];
    for (const [index, cable] of ((design && design.cables) || []).entries()) {
      const from = endpointLogicalId(cable.from);
      const to = endpointLogicalId(cable.to);
      const match = /^XIR(\d+)\.out$/.exec(from || '');
      if (match && /\.(sj)$/.test(to || '')) {
        helpers.push({
          cableId: cable.id || `cable-${index + 1}`,
          cableIndex: index,
          xirId: `XIR${match[1]}`,
          targetSocketId: to,
          targetComponentId: to.split('.')[0],
          behavior: 'adds the XIR weighted contribution into the target summing-junction input',
        });
      }
    }
    return helpers;
  }

  function feedbackSocketSemantics(socketOrId, options = {}) {
    const socket = typeof socketOrId === 'string' ? (socketMapFromOptions(options).sockets || []).find((entry) => entry.id === socketOrId) : socketOrId;
    const terminal = accessoryFromSocket(socket);
    if (!terminal || terminal.type !== ACCESSORY_TYPES.FEEDBACK) return null;
    const owner = String(socket.id || '').match(/phys\.(sum\d+)\.fb/i);
    return {
      socketId: socket.id,
      accessoryId: terminal.id,
      ownerComponentId: owner ? owner[1].toUpperCase() : null,
      executable: true,
      replacement: owner ? `${owner[1].toUpperCase()}.fb` : null,
      groundedBy: owner ? 'ZERO.out' : null,
      hint: 'The FB jack is executable as a SUM*.fb input; connect the neighboring ground jack/ZERO.out to approximate open-amplifier operation.',
    };
  }

  function evaluateIdealDiode(anodeVoltage, cathodeVoltage, options = {}) {
    const drop = Number(options.forwardDrop === undefined ? DEFAULT_DIODE_DROP : options.forwardDrop);
    const va = Number(anodeVoltage);
    const vc = Number(cathodeVoltage);
    if (!Number.isFinite(va) || !Number.isFinite(vc) || !Number.isFinite(drop)) throw new Error('diode voltages and forwardDrop must be finite numbers');
    const differential = va - vc;
    return {
      model: 'ideal-diode',
      anodeVoltage: va,
      cathodeVoltage: vc,
      differential,
      forwardDrop: drop,
      conducting: differential > drop,
      state: differential > drop ? 'forward-conducting' : 'reverse-blocking',
      outputVoltage: differential > drop ? vc + drop : null,
    };
  }

  function evaluateZDiode(anodeVoltage, cathodeVoltage, options = {}) {
    const forwardDrop = Number(options.forwardDrop === undefined ? DEFAULT_DIODE_DROP : options.forwardDrop);
    const zenerVoltage = Number(options.zenerVoltage === undefined ? DEFAULT_ZENER_VOLTAGE : options.zenerVoltage);
    const va = Number(anodeVoltage);
    const vc = Number(cathodeVoltage);
    if (!Number.isFinite(va) || !Number.isFinite(vc) || !Number.isFinite(forwardDrop) || !Number.isFinite(zenerVoltage)) throw new Error('Z-diode voltages and thresholds must be finite numbers');
    const differential = va - vc;
    let state = 'blocking';
    if (differential > forwardDrop) state = 'forward-conducting';
    else if (differential < -Math.abs(zenerVoltage)) state = 'reverse-breakdown';
    return {
      model: 'ideal-z-diode',
      anodeVoltage: va,
      cathodeVoltage: vc,
      differential,
      forwardDrop,
      zenerVoltage: Math.abs(zenerVoltage),
      conducting: state !== 'blocking',
      state,
    };
  }

  function capacitorChargeDelta(capacitanceFarads, voltageDelta) {
    const c = Number(capacitanceFarads);
    const dv = Number(voltageDelta);
    if (!Number.isFinite(c) || !Number.isFinite(dv)) throw new Error('capacitance and voltageDelta must be finite numbers');
    return c * dv;
  }

  function summarizePanelAccessories(options = {}) {
    const accessories = listPanelAccessories(options);
    const byType = {};
    for (const accessory of accessories) byType[accessory.type] = (byType[accessory.type] || 0) + 1;
    return {
      schemaVersion: ACCESSORY_SCHEMA_VERSION,
      accessoryCount: accessories.length,
      byType,
      runtimeSupportedCount: accessories.filter((entry) => entry.supportedInRuntime).length,
      unsupportedCount: accessories.filter((entry) => !entry.supportedInRuntime).length,
      accessories,
    };
  }

  const api = {
    ACCESSORY_SCHEMA_VERSION,
    ACCESSORY_TYPES,
    listPanelAccessories,
    accessoryById,
    accessoryByTerminalId,
    accessoryFromSocket,
    unsupportedAccessoryDiagnosticDetails,
    summarizeAccessoryUse,
    materializePhysicalAccessoriesFromDesign,
    previewPhysicalAccessoryMaterialization,
    accessoryPairGuidance,
    accessoryPairGuidanceForPhysicalSocketId,
    findXirSjHelpers,
    feedbackSocketSemantics,
    evaluateIdealDiode,
    evaluateZDiode,
    capacitorChargeDelta,
    accessoryRuntimeAvailable,
    accessoryMaterializable,
    accessoryDirectRuntimeSocket,
    summarizePanelAccessories,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDesignAccessories = api;
}(typeof window !== 'undefined' ? window : global));
