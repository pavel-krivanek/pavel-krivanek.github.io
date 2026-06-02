'use strict';

(function attachDesignDiagnostics(globalScope) {
  const nodeRequire = typeof require === 'function' ? require : null;
  const physicalApi = globalScope.AnalogThingPhysicalSockets || (nodeRequire ? nodeRequire('./physicalSockets') : null);
  const componentApi = nodeRequire ? nodeRequire('./components') : null;
  const inventoryApi = nodeRequire ? nodeRequire('./inventory') : null;
  const designApi = globalScope.AnalogThingCoreDesign || (nodeRequire ? nodeRequire('./design') : null);
  const accessoryApi = globalScope.AnalogThingDesignAccessories || (nodeRequire ? nodeRequire('./designAccessories') : null);

  const SOCKET_DIRECTIONS = componentApi ? componentApi.SOCKET_DIRECTIONS : { INPUT: 'input', OUTPUT: 'output' };
  const PHYSICAL_SOCKET_SCHEMA_VERSION = physicalApi ? physicalApi.PHYSICAL_SOCKET_SCHEMA_VERSION : 'analog-thing-physical-sockets/v1';

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }

  function normalizeEndpoint(endpoint) {
    if (typeof endpoint === 'string') return { logicalSocketId: endpoint.trim(), physicalSocketId: null };
    if (!endpoint || typeof endpoint !== 'object') return { logicalSocketId: null, physicalSocketId: null };
    const logicalSocketId = endpoint.logicalSocketId || endpoint.logical || endpoint.socketId || endpoint.socket || null;
    const physicalSocketId = endpoint.physicalSocketId || endpoint.physical || null;
    return {
      logicalSocketId: logicalSocketId ? String(logicalSocketId).trim() : null,
      physicalSocketId: physicalSocketId ? String(physicalSocketId).trim() : null,
    };
  }

  function normalizeCable(cable, index) {
    return {
      id: cable && cable.id ? String(cable.id) : `cable-${index + 1}`,
      from: normalizeEndpoint(cable && cable.from),
      to: normalizeEndpoint(cable && cable.to),
      label: cable && cable.label ? String(cable.label) : '',
    };
  }

  function normalizeDesignLoose(design) {
    if (designApi && designApi.normalizeDesign) {
      try { return designApi.normalizeDesign(design); } catch (error) { /* fall through to non-throwing shape normalization */ }
    }
    return {
      schemaVersion: design && design.schemaVersion ? design.schemaVersion : 'analog-thing-design/v1',
      kind: design && design.kind ? design.kind : 'custom-design',
      inventory: design && design.inventory ? design.inventory : 'that-prototype-board/v006',
      metadata: clonePlain((design && design.metadata) || {}),
      components: clonePlain((design && (design.components || design.componentRefs)) || []),
      coefficients: clonePlain((design && design.coefficients) || {}),
      cables: ((design && (design.cables || design.connections)) || []).map(normalizeCable),
      outputRouting: clonePlain((design && design.outputRouting) || {}),
      operationDefaults: clonePlain((design && design.operationDefaults) || {}),
    };
  }

  function defaultInventory(options = {}) {
    if (options.inventory) return options.inventory;
    if (inventoryApi && inventoryApi.createThatPrototypeInventory) return inventoryApi.createThatPrototypeInventory();
    return null;
  }

  function componentDefinition(entry, inventory) {
    if (!entry || typeof entry.id !== 'string') throw new Error('component entry requires id');
    if (entry.type) return clonePlain(entry);
    if (!inventory || typeof inventory.getComponentDefinition !== 'function') throw new Error(`component ${entry.id} references inventory but no inventory is available`);
    const overrides = clonePlain(entry);
    delete overrides.id;
    delete overrides.note;
    return inventory.getComponentDefinition(entry.id, overrides);
  }

  function socketMetadataForComponents(components, options = {}) {
    const inventory = defaultInventory(options);
    const metadata = [];
    const componentDefs = [];
    const componentErrors = [];
    for (const entry of components || []) {
      try {
        const def = componentDefinition(entry, inventory);
        componentDefs.push(def);
        if (!componentApi || !componentApi.createComponent) continue;
        const component = componentApi.createComponent(def);
        metadata.push(...component.socketMetadata());
      } catch (error) {
        componentErrors.push({ componentId: entry && entry.id ? entry.id : null, message: error.message });
      }
    }
    return { metadata, componentDefs, componentErrors };
  }

  function socketCatalog(metadata) {
    const sockets = new Map();
    for (const socket of metadata || []) sockets.set(socket.id, socket);
    return sockets;
  }

  function socketMapFromOptions(options = {}) {
    if (options.physicalSocketMap || options.socketMap) return physicalApi.normalizePhysicalSocketMap(options.physicalSocketMap || options.socketMap);
    return physicalApi && physicalApi.createThatPhysicalSocketMap ? physicalApi.createThatPhysicalSocketMap() : { sockets: [] };
  }

  function physicalSocketIndex(socketMap) {
    const index = new Map();
    for (const socket of (socketMap && socketMap.sockets) || []) index.set(socket.id, socket);
    return index;
  }

  function makeDiagnostic(severity, code, message, extra = {}) {
    return Object.assign({ severity, code, message, hint: repairHintForCode(code, extra) }, extra);
  }

  function repairHintForCode(code, extra = {}) {
    switch (code) {
      case 'unknown-physical-socket':
        return 'Remove this endpoint or reconnect it to a visible socket from the current physical socket map.';
      case 'unsupported-accessory-socket':
        return extra && extra.hint ? extra.hint : 'This accessory jack is visible on the panel but is not implemented by the block-level runtime yet; remove the cable or replace it with a supported active socket.';
      case 'physical-logical-mismatch':
        return 'Use either the physical socket mapping or the logical socket id from the same endpoint; do not mix a physical jack with a different logical node.';
      case 'physical-direction-mismatch':
      case 'logical-direction-mismatch':
        return 'Connect cables from an output socket to an input socket.';
      case 'unknown-logical-socket':
        return 'Check the component id and socket name, or add the missing component to the design.';
      case 'multiple-drivers':
        return 'Keep only one driver for an ordinary input, or route the signals through a summer/summing junction.';
      case 'required-input-unconnected':
        return 'Patch this required input, or remove the component from the design if it is not part of the intended program.';
      case 'stateless-algebraic-cycle':
        return 'Break the loop with an integrator/stateful element, or rewire the stateless feedback path.';
      case 'invalid-endpoint':
        return 'Each cable endpoint needs a logicalSocketId or a physicalSocketId.';
      case 'output-routing-unknown':
      case 'output-routing-direction':
        return 'Route output channels to executable output sockets.';
      case 'component-definition-error':
        return 'Use a component id from the board inventory or provide a complete supported component definition.';
      default:
        return extra && extra.hint ? extra.hint : 'Inspect the cable and reconnect it to a supported executable socket.';
    }
  }

  function resolveEndpoint(endpoint, role, cable, cableIndex, context) {
    const expectedDirection = role === 'from' ? SOCKET_DIRECTIONS.OUTPUT : SOCKET_DIRECTIONS.INPUT;
    const diagnostics = [];
    let logicalSocketId = endpoint.logicalSocketId || null;
    let physicalSocket = null;
    if (!logicalSocketId && !endpoint.physicalSocketId) {
      diagnostics.push(makeDiagnostic('error', 'invalid-endpoint', `cable ${cableIndex + 1} ${role} endpoint needs logicalSocketId or physicalSocketId`, { cableId: cable.id, cableIndex, endpointRole: role }));
      return { logicalSocketId: null, diagnostics };
    }
    if (endpoint.physicalSocketId) {
      physicalSocket = context.physicalSockets.get(endpoint.physicalSocketId) || null;
      if (!physicalSocket) {
        diagnostics.push(makeDiagnostic('error', 'unknown-physical-socket', `cable ${cableIndex + 1} ${role} references unknown physical socket ${endpoint.physicalSocketId}`, { cableId: cable.id, cableIndex, endpointRole: role, physicalSocketId: endpoint.physicalSocketId }));
      } else if (physicalSocket.displayOnly || physicalSocket.unsupported || !physicalSocket.logicalSocketId) {
        const accessoryDetails = accessoryApi && accessoryApi.unsupportedAccessoryDiagnosticDetails ? accessoryApi.unsupportedAccessoryDiagnosticDetails(physicalSocket) : { code: 'unsupported-accessory-socket' };
        const accessoryText = accessoryDetails.accessoryType ? ` ${accessoryDetails.accessoryType}` : '';
        diagnostics.push(makeDiagnostic('error', accessoryDetails.code || 'unsupported-accessory-socket', `cable ${cableIndex + 1} ${role} uses unsupported/display-only${accessoryText} ${physicalSocket.group} socket ${physicalSocket.id}`, Object.assign({}, accessoryDetails, { cableId: cable.id, cableIndex, endpointRole: role, physicalSocketId: physicalSocket.id, group: physicalSocket.group, socketIds: [physicalSocket.id] })));
      } else {
        if (logicalSocketId && logicalSocketId !== physicalSocket.logicalSocketId) {
          diagnostics.push(makeDiagnostic('error', 'physical-logical-mismatch', `cable ${cableIndex + 1} ${role} physical socket ${physicalSocket.id} maps to ${physicalSocket.logicalSocketId}, not ${logicalSocketId}`, { cableId: cable.id, cableIndex, endpointRole: role, physicalSocketId: physicalSocket.id, logicalSocketId, mappedLogicalSocketId: physicalSocket.logicalSocketId, socketIds: [physicalSocket.id] }));
        }
        if (!logicalSocketId) logicalSocketId = physicalSocket.logicalSocketId;
        if (physicalSocket.direction !== expectedDirection) {
          diagnostics.push(makeDiagnostic('error', 'physical-direction-mismatch', `cable ${cableIndex + 1} ${role} physical socket ${physicalSocket.id} is ${physicalSocket.direction}, expected ${expectedDirection}`, { cableId: cable.id, cableIndex, endpointRole: role, physicalSocketId: physicalSocket.id, logicalSocketId, expectedDirection, actualDirection: physicalSocket.direction, socketIds: [physicalSocket.id] }));
        }
      }
    }
    if (logicalSocketId) {
      const logical = context.logicalSockets.get(logicalSocketId) || null;
      if (!logical) {
        diagnostics.push(makeDiagnostic('error', 'unknown-logical-socket', `cable ${cableIndex + 1} ${role} references unknown logical socket ${logicalSocketId}`, { cableId: cable.id, cableIndex, endpointRole: role, logicalSocketId, physicalSocketId: endpoint.physicalSocketId || null }));
      } else if (logical.direction !== expectedDirection) {
        diagnostics.push(makeDiagnostic('error', 'logical-direction-mismatch', `cable ${cableIndex + 1} ${role} ${logicalSocketId} is ${logical.direction}, expected ${expectedDirection}`, { cableId: cable.id, cableIndex, endpointRole: role, logicalSocketId, physicalSocketId: endpoint.physicalSocketId || null, expectedDirection, actualDirection: logical.direction }));
      }
    }
    return { logicalSocketId, physicalSocket, diagnostics };
  }

  function detectMultipleDrivers(cables, resolved, context) {
    const diagnostics = [];
    const inputDrivers = new Map();
    resolved.forEach((entry, index) => {
      if (!entry.to || !entry.to.logicalSocketId || !entry.from || !entry.from.logicalSocketId) return;
      const target = context.logicalSockets.get(entry.to.logicalSocketId);
      if (!target || target.direction !== SOCKET_DIRECTIONS.INPUT || target.ordinary === false) return;
      if (!inputDrivers.has(entry.to.logicalSocketId)) inputDrivers.set(entry.to.logicalSocketId, []);
      inputDrivers.get(entry.to.logicalSocketId).push({ from: entry.from.logicalSocketId, cable: cables[index] });
    });
    for (const [to, drivers] of inputDrivers.entries()) {
      if (drivers.length > 1) {
        diagnostics.push(makeDiagnostic('error', 'multiple-drivers', `ordinary input ${to} has ${drivers.length} drivers: ${drivers.map((driver) => driver.from).join(', ')}`, { logicalSocketId: to, cableIds: drivers.map((driver) => driver.cable.id), driverSocketIds: drivers.map((driver) => driver.from) }));
      }
    }
    return diagnostics;
  }

  function detectMissingRequiredInputs(resolved, context) {
    const connectedInputs = new Set(resolved.map((entry) => entry.to && entry.to.logicalSocketId).filter(Boolean));
    const diagnostics = [];
    for (const socket of context.logicalSockets.values()) {
      if (socket.direction === SOCKET_DIRECTIONS.INPUT && socket.required && !connectedInputs.has(socket.id)) {
        diagnostics.push(makeDiagnostic('error', 'required-input-unconnected', `required input ${socket.id} is not connected`, { logicalSocketId: socket.id, componentId: socket.componentId, socketName: socket.name }));
      }
    }
    return diagnostics;
  }

  function isStatefulComponentDefinition(def) {
    if (!def) return false;
    if (def.type === 'integrator' || def.type === 'capacitor') return true;
    if (componentApi && typeof componentApi.createComponent === 'function') {
      try {
        const component = componentApi.createComponent(def);
        return typeof component.derivative === 'function' && typeof component.stateFromIc === 'function';
      } catch (error) { return false; }
    }
    return false;
  }

  function detectStatelessCycles(resolved, context) {
    const componentStatefulness = new Map(context.componentDefs.map((component) => [component.id, isStatefulComponentDefinition(component)]));
    const stateless = new Set();
    for (const [id, stateful] of componentStatefulness.entries()) if (!stateful) stateless.add(id);
    const graph = new Map();
    for (const id of stateless) graph.set(id, new Set());
    for (const entry of resolved) {
      if (!entry.from || !entry.to || !entry.from.logicalSocketId || !entry.to.logicalSocketId) continue;
      const fromComponent = entry.from.logicalSocketId.split('.')[0];
      const toComponent = entry.to.logicalSocketId.split('.')[0];
      if (fromComponent !== toComponent && stateless.has(fromComponent) && stateless.has(toComponent)) graph.get(fromComponent).add(toComponent);
    }
    const visiting = new Set();
    const visited = new Set();
    const stack = [];
    const cycles = [];
    function visit(id) {
      if (visiting.has(id)) {
        const start = stack.indexOf(id);
        const cycle = stack.slice(start).concat(id);
        cycles.push(cycle);
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      stack.push(id);
      for (const next of graph.get(id) || []) visit(next);
      stack.pop();
      visiting.delete(id);
      visited.add(id);
    }
    for (const id of graph.keys()) visit(id);
    const seen = new Set();
    return cycles.filter((cycle) => {
      const key = cycle.join(' -> ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((cycle) => makeDiagnostic('error', 'stateless-algebraic-cycle', `stateless algebraic cycle detected: ${cycle.join(' -> ')}`, { componentIds: cycle, cycle }));
  }

  function validateOutputRouting(design, context) {
    const diagnostics = [];
    const channels = (design.outputRouting && design.outputRouting.channels) || {};
    const aliases = (design.outputRouting && design.outputRouting.aliases) || {};
    for (const [label, socketId] of Object.entries(Object.assign({}, aliases, Object.fromEntries(Object.entries(channels).map(([key, value]) => [key.toLowerCase(), value]).filter((entry) => entry[1]))))) {
      const socket = context.logicalSockets.get(socketId);
      if (!socket) diagnostics.push(makeDiagnostic('error', 'output-routing-unknown', `output ${label} references unknown logical socket ${socketId}`, { outputLabel: label, logicalSocketId: socketId }));
      else if (socket.direction !== SOCKET_DIRECTIONS.OUTPUT) diagnostics.push(makeDiagnostic('error', 'output-routing-direction', `output ${label} must reference an output socket, got ${socket.direction} ${socketId}`, { outputLabel: label, logicalSocketId: socketId, actualDirection: socket.direction }));
    }
    return diagnostics;
  }

  function validateCustomDesign(design, options = {}) {
    const normalized = normalizeDesignLoose(design);
    const socketMap = socketMapFromOptions(options);
    const bridge = accessoryApi && accessoryApi.materializePhysicalAccessoriesFromDesign
      ? accessoryApi.materializePhysicalAccessoriesFromDesign(normalized, { socketMap })
      : { design: normalized, materializedCount: 0, materializedAccessories: [], unresolvedAccessoryUses: [] };
    const runtimeDesign = normalizeDesignLoose(bridge.design);
    const physicalSockets = physicalSocketIndex(socketMap);
    const componentInfo = socketMetadataForComponents(runtimeDesign.components, options);
    const logicalSockets = socketCatalog(componentInfo.metadata);
    const diagnostics = [];

    for (const componentError of componentInfo.componentErrors) {
      diagnostics.push(makeDiagnostic('error', 'component-definition-error', componentError.message, { componentId: componentError.componentId }));
    }

    const cables = (runtimeDesign.cables || []).map(normalizeCable);
    const resolved = [];
    cables.forEach((cable, index) => {
      const from = resolveEndpoint(cable.from, 'from', cable, index, { logicalSockets, physicalSockets });
      const to = resolveEndpoint(cable.to, 'to', cable, index, { logicalSockets, physicalSockets });
      diagnostics.push(...from.diagnostics, ...to.diagnostics);
      resolved.push({ cableId: cable.id, from: { logicalSocketId: from.logicalSocketId, physicalSocketId: cable.from.physicalSocketId || null }, to: { logicalSocketId: to.logicalSocketId, physicalSocketId: cable.to.physicalSocketId || null } });
    });

    diagnostics.push(...detectMultipleDrivers(cables, resolved, { logicalSockets }));
    diagnostics.push(...detectMissingRequiredInputs(resolved, { logicalSockets }));
    diagnostics.push(...detectStatelessCycles(resolved, { componentDefs: componentInfo.componentDefs }));
    diagnostics.push(...validateOutputRouting(runtimeDesign, { logicalSockets }));
    const accessorySummary = accessoryApi && accessoryApi.summarizeAccessoryUse ? accessoryApi.summarizeAccessoryUse(normalized, { socketMap }) : null;

    const errors = diagnostics.filter((entry) => entry.severity === 'error');
    const warnings = diagnostics.filter((entry) => entry.severity === 'warning');
    const invalidCableIds = Array.from(new Set(diagnostics.map((entry) => entry.cableId).filter(Boolean)));
    const invalidPhysicalSocketIds = Array.from(new Set(diagnostics.flatMap((entry) => entry.socketIds || (entry.physicalSocketId ? [entry.physicalSocketId] : [])).filter(Boolean)));
    const invalidLogicalSocketIds = Array.from(new Set(diagnostics.map((entry) => entry.logicalSocketId).filter(Boolean)));
    const repairHints = Array.from(new Set(diagnostics.map((entry) => entry.hint).filter(Boolean)));
    return {
      ok: errors.length === 0,
      diagnostics,
      errors: errors.map((entry) => entry.message),
      warnings: warnings.map((entry) => entry.message),
      errorCount: errors.length,
      warningCount: warnings.length,
      invalidCableIds,
      invalidPhysicalSocketIds,
      invalidLogicalSocketIds,
      repairHints,
      resolvedCables: resolved,
      checkedCableCount: cables.length,
      logicalSocketCount: logicalSockets.size,
      physicalSocketCount: physicalSockets.size,
      accessorySummary,
      accessoryBridge: {
        materializedCount: bridge.materializedCount || 0,
        materializedAccessories: bridge.materializedAccessories || [],
        unresolvedAccessoryUses: bridge.unresolvedAccessoryUses || [],
      },
    };
  }

  function diagnosticCodes(validation) {
    return (validation && validation.diagnostics ? validation.diagnostics : []).map((entry) => entry.code);
  }

  function validationAttributesForCable(cableIdOrIndex, validation) {
    const key = String(cableIdOrIndex);
    const entries = (validation && validation.diagnostics ? validation.diagnostics : []).filter((entry) => String(entry.cableId) === key || String(entry.cableIndex) === key);
    const severity = entries.some((entry) => entry.severity === 'error') ? 'error' : entries.some((entry) => entry.severity === 'warning') ? 'warning' : 'ok';
    return {
      'data-validation': severity,
      'data-validation-codes': entries.map((entry) => entry.code).join(' '),
      'aria-invalid': severity === 'error' ? 'true' : 'false',
      title: entries.map((entry) => `${entry.code}: ${entry.message}`).join('\n'),
    };
  }

  function diagnosticCssClassForCable(cableIdOrIndex, validation) {
    const attrs = validationAttributesForCable(cableIdOrIndex, validation);
    if (attrs['data-validation'] === 'error') return 'diagnostic-error invalid-cable';
    if (attrs['data-validation'] === 'warning') return 'diagnostic-warning';
    return 'diagnostic-ok';
  }

  function highlightInvalidCablesInSvg(svg, validation) {
    if (!svg || !svg.querySelectorAll) return { updated: 0, invalidCableCount: 0 };
    const invalid = new Set(validation && validation.invalidCableIds ? validation.invalidCableIds : []);
    let updated = 0;
    for (const path of Array.from(svg.querySelectorAll('[data-cable-id], [data-cable-index]'))) {
      const cableId = path.getAttribute('data-cable-id');
      const cableIndex = path.getAttribute('data-cable-index');
      const invalidCable = invalid.has(cableId) || invalid.has(cableIndex);
      path.setAttribute('data-validation', invalidCable ? 'error' : 'ok');
      path.setAttribute('aria-invalid', invalidCable ? 'true' : 'false');
      const cls = path.getAttribute('class') || '';
      const cleaned = cls.replace(/\bdiagnostic-error\b|\binvalid-cable\b|\bdiagnostic-ok\b/g, '').replace(/\s+/g, ' ').trim();
      path.setAttribute('class', `${cleaned}${cleaned ? ' ' : ''}${invalidCable ? 'diagnostic-error invalid-cable' : 'diagnostic-ok'}`);
      updated += 1;
    }
    return { updated, invalidCableCount: invalid.size };
  }

  function summarizeDesignValidation(design, options = {}) {
    const validation = validateCustomDesign(design, options);
    const byCode = {};
    for (const diagnostic of validation.diagnostics) byCode[diagnostic.code] = (byCode[diagnostic.code] || 0) + 1;
    return {
      ok: validation.ok,
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      diagnosticCount: validation.diagnostics.length,
      checkedCableCount: validation.checkedCableCount,
      invalidCableCount: validation.invalidCableIds.length,
      invalidPhysicalSocketCount: validation.invalidPhysicalSocketIds.length,
      invalidLogicalSocketCount: validation.invalidLogicalSocketIds.length,
      byCode,
      repairHints: validation.repairHints,
      physicalSocketSchemaVersion: PHYSICAL_SOCKET_SCHEMA_VERSION,
      accessorySummary: validation.accessorySummary || null,
    };
  }

  const api = {
    validateCustomDesign,
    summarizeDesignValidation,
    diagnosticCodes,
    validationAttributesForCable,
    diagnosticCssClassForCable,
    highlightInvalidCablesInSvg,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDesignDiagnostics = api;
}(typeof window !== 'undefined' ? window : global));
