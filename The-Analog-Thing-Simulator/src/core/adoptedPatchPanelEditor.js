'use strict';

(function attachAdoptedPatchPanelEditor(globalScope) {
  const ADOPTED_PATCH_EDITOR_VERSION = 'v021';
  const ADOPTED_WIRING_SCHEMA = 'analog-thing-patch-panel-wiring';
  const ADOPTED_PATCH_EDITOR_ASSET_ROOT = 'adopted_patch_panel_editor_v021';
  const DEFAULT_BRIDGE_MAX_DISTANCE = 22;
  const DEFAULT_INVENTORY_COMPONENTS = Object.freeze([
    'PLUS1', 'MINUS1', 'ZERO',
    'I1', 'I2', 'I3', 'I4', 'I5',
    'INV1', 'INV2', 'INV3', 'INV4',
    'SUM1', 'SUM2', 'SUM3', 'SUM4',
    'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8',
    'MUL1', 'MUL2', 'CMP1', 'CMP2', 'XIR1', 'XIR2',
    'OUT_X', 'OUT_Y', 'OUT_Z', 'OUT_U',
  ]);

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }

  function getConnectorCore() {
    if (globalScope.AnalogThingAdoptedPatchPanelConnectors) return globalScope.AnalogThingAdoptedPatchPanelConnectors;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./adoptedPatchPanelConnectors'); } catch (error) { return null; }
    }
    return null;
  }

  function getPhysicalSocketsCore() {
    if (globalScope.AnalogThingPhysicalSockets) return globalScope.AnalogThingPhysicalSockets;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./physicalSockets'); } catch (error) { return null; }
    }
    return null;
  }

  function getCoreDesign() {
    if (globalScope.AnalogThingCoreDesign) return globalScope.AnalogThingCoreDesign;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try { return require('./design'); } catch (error) { return null; }
    }
    return null;
  }

  function listAdoptedPanelConnectors() {
    const core = getConnectorCore();
    const connectors = core && core.ADOPTED_PANEL_CONNECTORS ? core.ADOPTED_PANEL_CONNECTORS : [];
    return connectors.map((connector) => clonePlain(connector));
  }

  function connectorById(id) {
    const wanted = String(id || '').trim();
    return listAdoptedPanelConnectors().find((connector) => connector.id === wanted) || null;
  }

  function distance(a, b) {
    const dx = Number(a.x) - Number(b.x);
    const dy = Number(a.y) - Number(b.y);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function listPhysicalSockets(options = {}) {
    const core = getPhysicalSocketsCore();
    if (!core || !core.createThatPhysicalSocketMap || !core.listPhysicalSockets) return [];
    const socketMap = options.socketMap || core.createThatPhysicalSocketMap({ referenceSvg: 'THAT_panel.svg' });
    return core.listPhysicalSockets(socketMap).map((socket) => clonePlain(socket));
  }

  function nearestPhysicalSocketForConnector(connector, physicalSockets = listPhysicalSockets()) {
    let best = null;
    for (const socket of physicalSockets) {
      const d = distance(connector, socket.position || socket);
      if (!best || d < best.distance) best = { socket, distance: d };
    }
    return best;
  }

  function createConnectorPhysicalBridge(options = {}) {
    const maxDistance = Number.isFinite(Number(options.maxDistance)) ? Number(options.maxDistance) : DEFAULT_BRIDGE_MAX_DISTANCE;
    const connectors = options.connectors ? options.connectors.map(clonePlain) : listAdoptedPanelConnectors();
    const physicalSockets = options.physicalSockets ? options.physicalSockets.map(clonePlain) : listPhysicalSockets(options);
    const byConnectorId = {};
    const byPhysicalSocketId = {};
    const mapped = [];
    const unmapped = [];
    for (const connector of connectors) {
      const nearest = nearestPhysicalSocketForConnector(connector, physicalSockets);
      const entry = {
        connectorId: connector.id,
        connector: clonePlain(connector),
        physicalSocketId: nearest && nearest.distance <= maxDistance ? nearest.socket.id : null,
        physicalSocket: nearest && nearest.distance <= maxDistance ? clonePlain(nearest.socket) : null,
        distance: nearest ? Math.round(nearest.distance * 1000) / 1000 : null,
        mapped: Boolean(nearest && nearest.distance <= maxDistance),
        active: Boolean(nearest && nearest.distance <= maxDistance && nearest.socket.active),
        displayOnly: Boolean(nearest && nearest.distance <= maxDistance && nearest.socket.displayOnly),
        unsupported: Boolean(nearest && nearest.distance <= maxDistance && nearest.socket.unsupported),
      };
      byConnectorId[connector.id] = entry;
      if (entry.physicalSocketId && !byPhysicalSocketId[entry.physicalSocketId]) byPhysicalSocketId[entry.physicalSocketId] = entry;
      (entry.mapped ? mapped : unmapped).push(entry);
    }
    return {
      schemaVersion: 'analog-thing-adopted-patch-editor-bridge/v1',
      editorVersion: ADOPTED_PATCH_EDITOR_VERSION,
      sourceSchema: ADOPTED_WIRING_SCHEMA,
      maxDistance,
      connectorCount: connectors.length,
      physicalSocketCount: physicalSockets.length,
      mappedCount: mapped.length,
      unmappedCount: unmapped.length,
      activeMappedCount: mapped.filter((entry) => entry.active).length,
      displayOnlyMappedCount: mapped.filter((entry) => entry.displayOnly).length,
      unsupportedMappedCount: mapped.filter((entry) => entry.unsupported).length,
      byConnectorId,
      byPhysicalSocketId,
      unmappedConnectorIds: unmapped.map((entry) => entry.connectorId),
    };
  }

  function normalizeEndpoint(endpoint, bridge = createConnectorPhysicalBridge(), role = 'endpoint') {
    if (!endpoint || typeof endpoint !== 'object') throw new Error(`${role} endpoint must be an object`);
    const connectorId = String(endpoint.connectorId || endpoint.id || '').trim();
    let connector = connectorId ? connectorById(connectorId) : null;
    if (!connector && Number.isFinite(Number(endpoint.x)) && Number.isFinite(Number(endpoint.y))) {
      const point = { x: Number(endpoint.x), y: Number(endpoint.y) };
      let best = null;
      for (const candidate of listAdoptedPanelConnectors()) {
        const d = distance(point, candidate);
        if (!best || d < best.distance) best = { connector: candidate, distance: d };
      }
      if (best && best.distance <= 1.5) connector = best.connector;
    }
    if (!connector) throw new Error(`${role} endpoint references unknown adopted connector ${connectorId || JSON.stringify(endpoint)}`);
    const bridgeEntry = bridge.byConnectorId[connector.id] || null;
    return {
      connectorId: connector.id,
      x: Number.isFinite(Number(endpoint.x)) ? Number(endpoint.x) : connector.x,
      y: Number.isFinite(Number(endpoint.y)) ? Number(endpoint.y) : connector.y,
      section: endpoint.section || connector.section || '',
      label: endpoint.label || connector.id,
      physicalSocketId: bridgeEntry ? bridgeEntry.physicalSocketId : null,
      logicalSocketId: bridgeEntry && bridgeEntry.physicalSocket ? bridgeEntry.physicalSocket.logicalSocketId || null : null,
      direction: bridgeEntry && bridgeEntry.physicalSocket ? bridgeEntry.physicalSocket.direction || null : null,
      active: Boolean(bridgeEntry && bridgeEntry.active),
      displayOnly: Boolean(bridgeEntry && bridgeEntry.displayOnly),
      unsupported: Boolean(bridgeEntry && bridgeEntry.unsupported),
      mapped: Boolean(bridgeEntry && bridgeEntry.mapped),
      bridgeDistance: bridgeEntry ? bridgeEntry.distance : null,
    };
  }

  function normalizeAdoptedWire(wire, index = 0, bridge = createConnectorPhysicalBridge()) {
    if (!wire || typeof wire !== 'object') throw new Error(`wire ${index + 1} must be an object`);
    const from = normalizeEndpoint(wire.from, bridge, `wire ${index + 1} from`);
    const to = normalizeEndpoint(wire.to, bridge, `wire ${index + 1} to`);
    return {
      id: wire.id || `wire_${String(index + 1).padStart(3, '0')}`,
      from,
      to,
      color: wire.color || null,
      opacity: Number.isFinite(Number(wire.opacity)) ? Number(wire.opacity) : 0.72,
      strokeWidth: Number.isFinite(Number(wire.strokeWidth)) ? Number(wire.strokeWidth) : 2.6,
      bend: Number.isFinite(Number(wire.bend)) ? Number(wire.bend) : 0,
    };
  }

  function normalizeAdoptedWiring(value, options = {}) {
    if (!value || typeof value !== 'object') throw new Error('adopted patch-panel wiring JSON must be an object');
    if (value.schema && value.schema !== ADOPTED_WIRING_SCHEMA) throw new Error(`unsupported adopted wiring schema ${value.schema}`);
    if (value.schemaVersion && value.schemaVersion !== ADOPTED_WIRING_SCHEMA) throw new Error(`unsupported adopted wiring schemaVersion ${value.schemaVersion}`);
    const wires = value.wires || value.cables || [];
    if (!Array.isArray(wires)) throw new Error('adopted wiring JSON requires a wires array');
    const bridge = options.bridge || createConnectorPhysicalBridge(options);
    const normalizedWires = wires.map((wire, index) => normalizeAdoptedWire(wire, index, bridge));
    return {
      schema: ADOPTED_WIRING_SCHEMA,
      editorVersion: value.editorVersion || ADOPTED_PATCH_EDITOR_VERSION,
      panel: clonePlain(value.panel || { sourceSvg: 'assets/THAT_panel.svg', connectorCount: bridge.connectorCount }),
      wires: normalizedWires,
      bridgeSummary: summarizeConnectorPhysicalBridge(bridge),
    };
  }

  function logicalEndpointForNormalized(endpoint) {
    if (!endpoint.mapped || !endpoint.physicalSocketId || !endpoint.logicalSocketId || !endpoint.active || endpoint.displayOnly || endpoint.unsupported) return null;
    return {
      logicalSocketId: endpoint.logicalSocketId,
      physicalSocketId: endpoint.physicalSocketId,
      direction: endpoint.direction,
    };
  }

  function designCableFromAdoptedWire(wire) {
    const first = logicalEndpointForNormalized(wire.from);
    const second = logicalEndpointForNormalized(wire.to);
    if (!first || !second) return { cable: null, reason: 'one or both endpoints are unmapped, display-only, or unsupported' };
    if (first.direction === second.direction) return { cable: null, reason: `both endpoints have direction ${first.direction}` };
    const output = first.direction === 'output' ? first : second;
    const input = first.direction === 'input' ? first : second;
    return {
      cable: {
        id: wire.id,
        from: { logicalSocketId: output.logicalSocketId, physicalSocketId: output.physicalSocketId },
        to: { logicalSocketId: input.logicalSocketId, physicalSocketId: input.physicalSocketId },
        label: `adopted editor ${wire.from.connectorId} -> ${wire.to.connectorId}`,
        color: wire.color || null,
      },
      reason: null,
    };
  }

  function componentIdsForDesignCables(cables) {
    const ids = new Set(DEFAULT_INVENTORY_COMPONENTS);
    for (const cable of cables || []) {
      for (const endpoint of [cable.from, cable.to]) {
        const logical = endpoint && endpoint.logicalSocketId;
        if (logical && logical.includes('.')) ids.add(logical.split('.')[0]);
      }
    }
    return Array.from(ids).map((id) => ({ id }));
  }

  function adoptedWiringToDesign(value, options = {}) {
    const normalized = normalizeAdoptedWiring(value, options);
    const converted = [];
    const skipped = [];
    normalized.wires.forEach((wire, index) => {
      const result = designCableFromAdoptedWire(wire);
      if (result.cable) converted.push(result.cable);
      else skipped.push({ wireId: wire.id, index, reason: result.reason });
    });
    const core = getCoreDesign();
    const now = options.now || new Date().toISOString();
    const design = {
      schemaVersion: 'analog-thing-design/v1',
      kind: 'custom-design',
      inventory: 'that-prototype-board/v006',
      metadata: {
        name: options.name || 'Imported adopted patch-panel wiring',
        description: options.description || 'Custom design imported from the adopted standalone patch-panel editor v021 wiring JSON.',
        author: options.author || '',
        source: options.source || 'adopted patch panel editor v021',
        tags: options.tags || ['adopted-editor', 'imported-wiring'],
        createdAt: options.createdAt || now,
        modifiedAt: options.modifiedAt || now,
        notes: options.notes || `Converted ${converted.length} executable wires; skipped ${skipped.length} display-only, unsupported, or unmapped wires.`,
      },
      components: options.components || componentIdsForDesignCables(converted),
      cables: converted,
      coefficients: options.coefficients || {},
      outputRouting: options.outputRouting || { channels: { X: 'OUT_X.out', Y: 'OUT_Y.out', Z: null, U: null }, aliases: {} },
      operationDefaults: options.operationDefaults || { mode: 'REPF', duration: 40, dt: 0.01, sampleEvery: 10, opTime: 8, cycles: 3, clip: false },
      notes: options.notes || '',
      adoptedPatchEditor: {
        schemaVersion: 'analog-thing-adopted-patch-editor-import/v1',
        sourceSchema: ADOPTED_WIRING_SCHEMA,
        sourceEditorVersion: normalized.editorVersion,
        convertedWireCount: converted.length,
        skippedWireCount: skipped.length,
        skipped,
        bridgeSummary: normalized.bridgeSummary,
      },
    };
    return core && core.normalizeDesign ? core.normalizeDesign(design, { requireComponents: false }) : design;
  }

  function adoptedWiringToDesignImportResult(value, options = {}) {
    try {
      const design = adoptedWiringToDesign(value, options);
      return { ok: true, design, sourceKind: 'adopted-patch-panel-wiring', sourceSchemaVersion: ADOPTED_WIRING_SCHEMA, error: null };
    } catch (error) {
      return { ok: false, design: null, sourceKind: 'adopted-patch-panel-wiring', sourceSchemaVersion: ADOPTED_WIRING_SCHEMA, error: error.message };
    }
  }

  function summarizeConnectorPhysicalBridge(bridge = createConnectorPhysicalBridge()) {
    return {
      schemaVersion: bridge.schemaVersion,
      editorVersion: bridge.editorVersion,
      connectorCount: bridge.connectorCount,
      physicalSocketCount: bridge.physicalSocketCount,
      mappedCount: bridge.mappedCount,
      unmappedCount: bridge.unmappedCount,
      activeMappedCount: bridge.activeMappedCount,
      displayOnlyMappedCount: bridge.displayOnlyMappedCount,
      unsupportedMappedCount: bridge.unsupportedMappedCount,
      maxDistance: bridge.maxDistance,
      unmappedConnectorIds: bridge.unmappedConnectorIds.slice(),
    };
  }

  function createAdoptedEditorSummary(options = {}) {
    const connectors = listAdoptedPanelConnectors();
    const bridge = createConnectorPhysicalBridge(options);
    const sectionCounts = {};
    for (const connector of connectors) sectionCounts[connector.section] = (sectionCounts[connector.section] || 0) + 1;
    return {
      schemaVersion: 'analog-thing-adopted-patch-editor-summary/v1',
      editorVersion: ADOPTED_PATCH_EDITOR_VERSION,
      wiringSchema: ADOPTED_WIRING_SCHEMA,
      assetRoot: ADOPTED_PATCH_EDITOR_ASSET_ROOT,
      connectorCount: connectors.length,
      sectionCounts,
      bridge: summarizeConnectorPhysicalBridge(bridge),
      standaloneFiles: [
        'index.html',
        'css/styles.css',
        'js/app.js',
        'js/connectors.js',
        'assets/THAT_panel.svg',
        'tools/verify_bundle.js',
      ],
      adoptedFeatures: [
        'drag from connector to connector to create translucent wires',
        'select a wire and delete it with Delete or Backspace',
        'drag selected endpoint handles to reconnect either side',
        'live JSON export using analog-thing-patch-panel-wiring',
        'copy/download/load wiring JSON workflows',
      ],
    };
  }

  function looksLikeAdoptedWiring(value) {
    return Boolean(value && typeof value === 'object' && (value.schema === ADOPTED_WIRING_SCHEMA || value.schemaVersion === ADOPTED_WIRING_SCHEMA || (Array.isArray(value.wires) && value.panel && value.editorVersion)));
  }

  const api = {
    ADOPTED_PATCH_EDITOR_VERSION,
    ADOPTED_WIRING_SCHEMA,
    ADOPTED_PATCH_EDITOR_ASSET_ROOT,
    DEFAULT_BRIDGE_MAX_DISTANCE,
    listAdoptedPanelConnectors,
    connectorById,
    createConnectorPhysicalBridge,
    summarizeConnectorPhysicalBridge,
    normalizeAdoptedWiring,
    adoptedWiringToDesign,
    adoptedWiringToDesignImportResult,
    createAdoptedEditorSummary,
    looksLikeAdoptedWiring,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingAdoptedPatchPanelEditor = api;
}(typeof window !== 'undefined' ? window : global));
