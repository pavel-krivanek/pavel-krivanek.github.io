'use strict';

(function attachDesignPanelPolish(globalScope) {
  const nodeRequire = typeof require === 'function' ? require : null;
  const usabilityApi = globalScope.AnalogThingDesignUsability || (nodeRequire ? nodeRequire('./designUsability') : null);
  const physicalApi = globalScope.AnalogThingPhysicalSockets || (nodeRequire ? nodeRequire('./physicalSockets') : null);
  const designApi = globalScope.AnalogThingCoreDesign || (nodeRequire ? nodeRequire('./design') : null);
  const templateApi = globalScope.AnalogThingDesignTemplates || (nodeRequire ? nodeRequire('./designTemplates') : null);

  const PANEL_POLISH_SCHEMA_VERSION = 'analog-thing-panel-polish/v1';

  const SECTION_ORDER = Object.freeze([
    'COEFF',
    'INTEGRATORS',
    'SUMMERS',
    'INVERTERS',
    '-1/+1',
    'MULTIPLIERS',
    'COMPARATORS',
    'XIR',
    'CAPACITORS',
    'DIODES',
    'Z-DIODES',
    'OUT',
  ]);

  const SECTION_TITLES = Object.freeze({
    COEFF: 'COEFFICIENTS',
    INTEGRATORS: 'INTEGRATORS',
    SUMMERS: 'SUMMERS',
    INVERTERS: 'INVERTERS',
    '-1/+1': '-1 / +1',
    MULTIPLIERS: 'MULTIPLIERS',
    COMPARATORS: 'COMPARATORS',
    XIR: 'XIR',
    CAPACITORS: 'CAPACITORS',
    DIODES: 'DIODES',
    'Z-DIODES': 'Z-DIODES',
    OUT: 'OUTPUTS',
  });

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }
  function slug(text) { return String(text || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown'; }
  function finiteNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function endpointCopy(endpoint) {
    if (typeof endpoint === 'string') return { logicalSocketId: endpoint, physicalSocketId: null };
    return Object.assign({ logicalSocketId: null, physicalSocketId: null }, clonePlain(endpoint || {}));
  }


  function endpointLogicalId(endpoint) {
    if (typeof endpoint === 'string') return endpoint;
    return endpoint && endpoint.logicalSocketId ? endpoint.logicalSocketId : null;
  }

  function endpointPhysicalId(endpoint) {
    if (typeof endpoint === 'string') return null;
    return endpoint && endpoint.physicalSocketId ? endpoint.physicalSocketId : null;
  }

  function normalizeDesignLoose(design, options = {}) {
    if (designApi && designApi.normalizeDesign) return designApi.normalizeDesign(design, Object.assign({ requireComponents: false }, options));
    const copy = clonePlain(design || {});
    copy.schemaVersion = copy.schemaVersion || 'analog-thing-design/v1';
    copy.kind = copy.kind || 'custom-design';
    copy.inventory = copy.inventory || 'that-prototype-board/v006';
    copy.metadata = Object.assign({ name: 'Untitled custom design', tags: [], createdAt: 'unknown', modifiedAt: 'unknown' }, copy.metadata || {});
    copy.components = clonePlain(copy.components || []);
    copy.cables = clonePlain(copy.cables || []);
    copy.outputRouting = clonePlain(copy.outputRouting || { channels: { X: null, Y: null, Z: null, U: null }, aliases: {} });
    copy.operationDefaults = clonePlain(copy.operationDefaults || {});
    return copy;
  }

  function socketMapFromOptions(options = {}) {
    if (options.physicalSocketMap || options.socketMap) {
      return physicalApi && physicalApi.normalizePhysicalSocketMap ? physicalApi.normalizePhysicalSocketMap(options.physicalSocketMap || options.socketMap) : (options.physicalSocketMap || options.socketMap);
    }
    if (physicalApi && physicalApi.createThatPhysicalSocketMap) return physicalApi.createThatPhysicalSocketMap({ referenceSvg: options.referenceSvg });
    return { panel: { referenceSvg: null, width: 800, height: 638 }, sockets: [] };
  }

  function logicalComponentId(logicalSocketId) {
    const id = String(logicalSocketId || '');
    const dot = id.indexOf('.');
    return dot > 0 ? id.slice(0, dot) : null;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean).map(String))).sort((a, b) => a.localeCompare(b));
  }

  function socketSort(a, b) {
    return finiteNumber(a.y) - finiteNumber(b.y) || finiteNumber(a.x) - finiteNumber(b.x) || String(a.id).localeCompare(String(b.id));
  }

  function machineUnitSocketPreferenceRank(socket) {
    if (!socket) return 1000;
    const id = String(socket.id || '');
    const group = String(socket.group || '');
    if (group === '-1/+1') {
      if (/\.out\.a$/.test(id)) return 0;
      if (/\.out\.b$/.test(id)) return 1;
      return 2;
    }
    if (group === 'INTEGRATORS') return 10;
    return 20;
  }

  function sortSocketsForLogicalPreference(logicalSocketId, sockets) {
    const id = String(logicalSocketId || '').trim();
    const list = (sockets || []).slice();
    if (/^(PLUS1|MINUS1)\.out$/.test(id)) {
      return list.sort((a, b) => (machineUnitSocketPreferenceRank(a) - machineUnitSocketPreferenceRank(b)) || finiteNumber(a.y) - finiteNumber(b.y) || finiteNumber(a.x) - finiteNumber(b.x) || String(a.id).localeCompare(String(b.id)));
    }
    return list.sort(socketSort);
  }

  function sectionSpecs() {
    return SECTION_ORDER.map((id, index) => ({
      id,
      title: SECTION_TITLES[id] || id,
      className: `panel-section panel-section-${slug(id)}`,
      order: index + 1,
      emphasis: ['INTEGRATORS', 'SUMMERS', 'COEFF', 'OUT'].includes(id) ? 'primary' : 'secondary',
    }));
  }

  function sectionSpecForGroup(group) {
    return sectionSpecs().find((entry) => entry.id === group) || { id: group || 'UNKNOWN', title: group || 'UNKNOWN', className: `panel-section panel-section-${slug(group)}`, order: 999, emphasis: 'secondary' };
  }

  function socketStatus(socket, validation = null) {
    if (usabilityApi && usabilityApi.socketVisualState) return usabilityApi.socketVisualState(socket, validation).status;
    if (!socket) return 'unknown';
    if (validation && Array.isArray(validation.invalidPhysicalSocketIds) && validation.invalidPhysicalSocketIds.includes(socket.id)) return 'invalid';
    if (socket.unsupported) return 'unsupported';
    if (socket.displayOnly || !socket.logicalSocketId) return 'display-only';
    if (socket.active) return 'editable';
    return 'inactive';
  }

  function socketLabelPlacement(socket) {
    const group = socket && socket.group ? socket.group : 'UNKNOWN';
    const role = socket && socket.role ? socket.role : '';
    const direction = socket && socket.direction ? socket.direction : 'display-only';
    let dx = 0;
    let dy = -12;
    let anchor = 'middle';
    let baseline = 'auto';
    let rotate = 0;

    if (group === 'COEFF') {
      dy = 3;
      anchor = direction === 'input' ? 'end' : 'start';
      dx = direction === 'input' ? -12 : 12;
    } else if (group === 'INTEGRATORS' || group === 'SUMMERS') {
      dy = -11;
      anchor = 'middle';
    } else if (group === 'COMPARATORS') {
      dy = -11;
      anchor = 'middle';
      if (role === 'comparator-selector' || /positive|nonPositive/.test(socket.logicalSocketId || '')) dy = -13;
    } else if (group === 'OUT') {
      dy = 18;
      anchor = 'middle';
      baseline = 'hanging';
    } else if (group === 'XIR') {
      dy = -11;
      anchor = 'middle';
    } else if (group === '-1/+1') {
      dy = 16;
      anchor = 'middle';
      baseline = 'hanging';
    } else if (group === 'CAPACITORS' || group === 'DIODES' || group === 'Z-DIODES') {
      dx = 12;
      dy = 3;
      anchor = 'start';
    }

    if ((socket && socket.label === 'T') || role === 'ground-or-tie-accessory') rotate = -90;

    const suppressExplicitPanelLabel = group === 'CAPACITORS' || group === 'DIODES' || group === 'Z-DIODES';

    return {
      schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
      socketId: socket && socket.id ? socket.id : null,
      text: suppressExplicitPanelLabel ? '' : (socket && socket.label ? socket.label : ''),
      x: finiteNumber(socket && (socket.x !== undefined ? socket.x : socket.position && socket.position.x), 0) + dx,
      y: finiteNumber(socket && (socket.y !== undefined ? socket.y : socket.position && socket.position.y), 0) + dy,
      dx,
      dy,
      anchor,
      baseline,
      rotate,
      className: `socket-label socket-label-${slug(group)} socket-label-${slug(role || direction)}`,
    };
  }

  function socketRenderSpec(socket, validation = null) {
    const status = socketStatus(socket, validation);
    const group = socket && socket.group ? socket.group : 'UNKNOWN';
    const direction = socket && socket.direction ? socket.direction : 'display-only';
    const section = sectionSpecForGroup(group);
    const active = status === 'editable' || status === 'invalid';
    const radius = active ? 5.4 : status === 'unsupported' ? 4.7 : 4.2;
    const hitRadius = active ? 10.5 : 9;
    const label = socketLabelPlacement(socket);
    const visual = usabilityApi && usabilityApi.socketVisualState ? usabilityApi.socketVisualState(socket, validation) : { className: `socket physical-socket ${status} ${direction}`, dataAttributes: {} };
    const classParts = [
      'socket',
      'socket-hit',
      'physical-socket',
      'original-panel-socket',
      `status-${status}`,
      status,
      `direction-${slug(direction)}`,
      `panel-section-${slug(group)}`,
      socket && socket.role ? `role-${slug(socket.role)}` : null,
      visual.className,
    ].filter(Boolean).join(' ').split(/\s+/);
    const classes = Array.from(new Set(classParts)).join(' ');
    const dataAttributes = Object.assign({}, visual.dataAttributes || {}, {
      'data-panel-section': group,
      'data-section-title': section.title,
      'data-panel-role': socket && socket.role ? socket.role : '',
      'data-label-anchor': label.anchor,
      'data-label-dx': String(label.dx),
      'data-label-dy': String(label.dy),
      'data-hit-radius': String(hitRadius),
      'data-render-radius': String(radius),
      'data-original-style': 'true',
    });
    return {
      schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
      socketId: socket && socket.id ? socket.id : null,
      logicalSocketId: socket && socket.logicalSocketId ? socket.logicalSocketId : null,
      status,
      direction,
      group,
      section,
      x: finiteNumber(socket && (socket.x !== undefined ? socket.x : socket.position && socket.position.x), 0),
      y: finiteNumber(socket && (socket.y !== undefined ? socket.y : socket.position && socket.position.y), 0),
      radius,
      hitRadius,
      className: classes,
      dataAttributes,
      label,
    };
  }

  function physicalSocketsFromModel(model = {}) {
    if (Array.isArray(model.physicalSockets) && model.physicalSockets.length) return model.physicalSockets;
    if (model.physicalSocketMap && Array.isArray(model.physicalSocketMap.sockets)) return model.physicalSocketMap.sockets;
    if (physicalApi && physicalApi.createThatPhysicalSocketMap) return physicalApi.createThatPhysicalSocketMap().sockets;
    return [];
  }

  function socketByPhysicalId(model, id) {
    if (!id) return null;
    return physicalSocketsFromModel(model).find((socket) => socket.id === id) || null;
  }

  function fallbackPanelSocketForLogical(model, logicalSocketId, direction) {
    const id = String(logicalSocketId || '');
    const sumMatch = /^SUM(\d+)\.[A-Za-z0-9_-]+$/.exec(id);
    if (sumMatch && direction === 'input') {
      const sockets = physicalSocketsFromModel(model)
        .filter((socket) => socket.logicalSocketId && socket.logicalSocketId.startsWith(`SUM${sumMatch[1]}.`) && socket.direction === 'input')
        .sort(socketSort);
      if (sockets.length) return Object.assign({}, sockets[0], { id: `virtual.${id}`, logicalSocketId: id, virtualAliasRuntimeSocket: true });
    }
    if (id === 'GNEG.out') {
      const socket = sortSocketsForLogicalPreference('MINUS1.out', physicalSocketsFromModel(model).filter((entry) => entry.logicalSocketId === 'MINUS1.out'))[0];
      if (socket) return Object.assign({}, socket, { id: `virtual.${id}`, logicalSocketId: id, virtualAliasRuntimeSocket: true });
    }
    return null;
  }

  function accessoryVirtualSocketForLogical(model, logicalSocketId, direction) {
    const match = /^(CAP|D|ZD)(\d+)\.(out|in|ic|reference)$/.exec(String(logicalSocketId || ''));
    if (!match) return fallbackPanelSocketForLogical(model, logicalSocketId, direction);
    const [, kind, rawIndex, socketName] = match;
    const index = Number.parseInt(rawIndex, 10);
    const sockets = physicalSocketsFromModel(model);
    const prefix = kind === 'CAP' ? `phys.cap${index}` : (kind === 'D' ? `phys.diode${index}` : `phys.zdiode${index}`);
    const terminal = socketName === 'out' ? 'a' : 'b';
    const physical = sockets.find((socket) => socket.id === `${prefix}.${terminal}`) || sockets.find((socket) => socket.id && socket.id.startsWith(prefix));
    if (!physical) return null;
    return Object.assign({}, physical, {
      id: `virtual.${logicalSocketId}`,
      physicalSocketId: physical.id,
      logicalSocketId,
      direction: direction || (socketName === 'out' ? 'output' : 'input'),
      displayOnly: false,
      unsupported: false,
      active: true,
      role: `${kind.toLowerCase()}-runtime-${socketName}`,
      virtualAccessoryRuntimeSocket: true,
    });
  }

  function firstSocketForLogical(model, logicalSocketId, direction) {
    if (!logicalSocketId) return null;
    const sockets = physicalSocketsFromModel(model).filter((socket) => socket.logicalSocketId === logicalSocketId && (!direction || socket.direction === direction));
    if (!sockets.length) return accessoryVirtualSocketForLogical(model, logicalSocketId, direction);
    return sortSocketsForLogicalPreference(logicalSocketId, sockets)[0];
  }

  function endpointSocket(model, endpoint, role) {
    const normalized = endpointCopy(endpoint);
    const direction = role === 'from' ? 'output' : 'input';
    return socketByPhysicalId(model, normalized.physicalSocketId) || firstSocketForLogical(model, normalized.logicalSocketId, direction);
  }

  function cableRouteSpec(model, cable, index = 0, options = {}) {
    const from = endpointSocket(model, cable && cable.from, 'from');
    const to = endpointSocket(model, cable && cable.to, 'to');
    const start = from ? { x: finiteNumber(from.x), y: finiteNumber(from.y) } : { x: 0, y: 0 };
    const end = to ? { x: finiteNumber(to.x), y: finiteNumber(to.y) } : { x: 0, y: 0 };
    const lane = Number.isInteger(options.lane) ? options.lane : index % 6;
    const lateral = Math.max(18, Math.abs(end.x - start.x) * 0.12);
    const vertical = ((lane % 3) - 1) * 7;
    const midX = (start.x + end.x) / 2;
    const c1 = { x: midX - lateral * 0.35, y: start.y - 10 - vertical };
    const c2 = { x: midX + lateral * 0.35, y: end.y + 10 + vertical };
    const d = `M ${start.x} ${start.y} C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${end.x} ${end.y}`;
    return {
      schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
      cableId: cable && cable.id ? cable.id : `cable-${index + 1}`,
      fromPhysicalSocketId: from ? from.id : null,
      toPhysicalSocketId: to ? to.id : null,
      fromLogicalSocketId: endpointLogicalId(cable && cable.from) || (from && from.logicalSocketId) || null,
      toLogicalSocketId: endpointLogicalId(cable && cable.to) || (to && to.logicalSocketId) || null,
      lane,
      start,
      end,
      controlPoints: [c1, c2],
      path: d,
      className: `panel-cable original-panel-cable cable-lane-${lane}`,
      dataAttributes: {
        'data-original-route': 'true',
        'data-cable-lane': String(lane),
        'data-from-physical-socket-id': from ? from.id : '',
        'data-to-physical-socket-id': to ? to.id : '',
        'data-from-logical-socket-id': endpointLogicalId(cable && cable.from) || (from && from.logicalSocketId) || '',
        'data-to-logical-socket-id': endpointLogicalId(cable && cable.to) || (to && to.logicalSocketId) || '',
      },
    };
  }


  function physicalSocketsUsedByCables(cables = []) {
    const ids = [];
    for (const cable of cables || []) {
      ids.push(endpointPhysicalId(cable && cable.from));
      ids.push(endpointPhysicalId(cable && cable.to));
    }
    return uniqueSorted(ids);
  }

  function logicalSocketsUsedByDesign(design = {}) {
    const ids = [];
    for (const cable of design.cables || []) {
      ids.push(endpointLogicalId(cable && cable.from));
      ids.push(endpointLogicalId(cable && cable.to));
    }
    const routing = design.outputRouting || {};
    for (const socketId of Object.values(routing.channels || {})) ids.push(socketId);
    for (const socketId of Object.values(routing.aliases || {})) ids.push(socketId);
    return uniqueSorted(ids);
  }

  function sectionUsageForDesign(design, sockets, physicalCables) {
    const usedPhysical = new Set(physicalSocketsUsedByCables(physicalCables));
    const usedLogical = new Set(logicalSocketsUsedByDesign(design));
    const bySection = {};
    for (const socket of sockets || []) {
      const sectionId = socket.group || 'UNKNOWN';
      if (!bySection[sectionId]) {
        const spec = sectionSpecForGroup(sectionId);
        bySection[sectionId] = {
          id: sectionId,
          title: spec.title,
          socketCount: 0,
          activeSocketCount: 0,
          usedSocketCount: 0,
          usedLogicalSocketCount: 0,
          cableEndpointCount: 0,
          statusCounts: {},
          usedSocketIds: [],
          usedLogicalSocketIds: [],
        };
      }
      const row = bySection[sectionId];
      row.socketCount += 1;
      if (socket.active) row.activeSocketCount += 1;
      const status = socketStatus(socket);
      row.statusCounts[status] = (row.statusCounts[status] || 0) + 1;
      const physicallyUsed = usedPhysical.has(socket.id);
      const logicallyUsed = socket.logicalSocketId && usedLogical.has(socket.logicalSocketId);
      if (physicallyUsed || logicallyUsed) {
        row.usedSocketCount += 1;
        row.usedSocketIds.push(socket.id);
        if (socket.logicalSocketId) row.usedLogicalSocketIds.push(socket.logicalSocketId);
      }
      if (logicallyUsed) row.usedLogicalSocketCount += 1;
      if (physicallyUsed) row.cableEndpointCount += 1;
    }
    const ordered = SECTION_ORDER.concat(Object.keys(bySection).filter((id) => !SECTION_ORDER.includes(id)).sort());
    return ordered.filter((id) => bySection[id]).map((id) => {
      const row = bySection[id];
      row.usedSocketIds = uniqueSorted(row.usedSocketIds);
      row.usedLogicalSocketIds = uniqueSorted(row.usedLogicalSocketIds);
      row.active = row.usedSocketCount > 0;
      row.className = `design-panel-section-use section-${slug(row.id)}${row.active ? ' active' : ''}`;
      return row;
    });
  }

  function componentUsageForDesign(design) {
    const declared = (design.components || []).map((component) => component.id).filter(Boolean);
    const logicalComponents = logicalSocketsUsedByDesign(design).map(logicalComponentId).filter(Boolean);
    return uniqueSorted(declared.concat(logicalComponents));
  }

  function designCableRouteSpecs(model) {
    return (model.cables || []).map((cable, index) => cableRouteSpec(model, cable, index));
  }

  function designPanelModelFromDesign(design, options = {}) {
    const normalized = normalizeDesignLoose(design, options);
    const socketMap = socketMapFromOptions(options);
    const physicalized = physicalApi && physicalApi.physicalizeDesignCables ? physicalApi.physicalizeDesignCables(normalized, { socketMap }) : normalized;
    const sockets = (socketMap.sockets || []).map((socket) => clonePlain(socket));
    const usedPhysical = new Set(physicalSocketsUsedByCables(physicalized.cables || []));
    const usedLogical = new Set(logicalSocketsUsedByDesign(normalized));
    const decoratedSockets = sockets.map((socket) => Object.assign({}, socket, {
      designUsed: usedPhysical.has(socket.id) || Boolean(socket.logicalSocketId && usedLogical.has(socket.logicalSocketId)),
      designCableEndpoint: usedPhysical.has(socket.id),
      designLogicalUsed: Boolean(socket.logicalSocketId && usedLogical.has(socket.logicalSocketId)),
      className: `${socket.className || ''} ${usedPhysical.has(socket.id) ? 'design-cable-endpoint' : ''} ${socket.logicalSocketId && usedLogical.has(socket.logicalSocketId) ? 'design-logical-used' : ''}`.trim(),
    }));
    const model = {
      schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
      kind: 'design-panel-model',
      name: normalized.metadata && normalized.metadata.name ? normalized.metadata.name : 'Custom design panel model',
      templateId: options.templateId || normalized.templateId || null,
      category: options.category || null,
      style: 'uploaded-reference-svg-original-style',
      referenceSvg: (socketMap.panel && socketMap.panel.referenceSvg) || options.referenceSvg || null,
      width: (socketMap.panel && socketMap.panel.width) || 800,
      height: (socketMap.panel && socketMap.panel.height) || 586,
      design: normalized,
      components: clonePlain(normalized.components || []),
      componentIds: componentUsageForDesign(normalized),
      cables: clonePlain(physicalized.cables || []),
      physicalSocketMap: socketMap,
      physicalSockets: decoratedSockets,
      usedPhysicalSocketIds: uniqueSorted(Array.from(usedPhysical)),
      usedLogicalSocketIds: uniqueSorted(Array.from(usedLogical)),
      sectionUsage: [],
      cableRoutes: [],
    };
    model.sectionUsage = sectionUsageForDesign(normalized, decoratedSockets, model.cables);
    model.cableRoutes = designCableRouteSpecs(model);
    return model;
  }

  function templatePanelModel(templateOrId, options = {}) {
    if (!templateApi || !templateApi.loadDesignTemplate) throw new Error('design template helpers are not available');
    const template = typeof templateOrId === 'string' ? templateApi.loadDesignTemplate(templateOrId, options) : templateOrId;
    const design = template.design || (templateApi.instantiateDesignTemplate ? templateApi.instantiateDesignTemplate(template, options) : null);
    if (!design) throw new Error('template has no design payload');
    const model = designPanelModelFromDesign(design, Object.assign({}, options, { templateId: template.id, category: template.category }));
    model.template = {
      id: template.id,
      title: template.title,
      category: template.category,
      defaultMode: template.defaultMode,
      walkthroughStepCount: Array.isArray(template.walkthrough) ? template.walkthrough.length : 0,
    };
    model.walkthroughFocus = (template.walkthrough || []).map((step, index) => ({
      order: index + 1,
      title: step.title || `Step ${index + 1}`,
      socketFocus: uniqueSorted((step.socketFocus || []).concat(step.logicalFocus || [])),
      controlFocus: uniqueSorted(step.controlFocus || []),
    }));
    return model;
  }

  function verifyTemplatePanelModels(options = {}) {
    if (!templateApi || !templateApi.listDesignTemplateEntries) throw new Error('design template helpers are not available');
    const entries = templateApi.listDesignTemplateEntries(options);
    const results = entries.map((entry) => {
      try {
        const model = templatePanelModel(entry.id, options);
        const summary = panelPolishSummary(model);
        const activeSections = model.sectionUsage.filter((section) => section.active).map((section) => section.id);
        return {
          id: entry.id,
          title: entry.title || entry.id,
          ok: model.usedPhysicalSocketIds.length > 0 && summary.routedCableCount === model.cables.length,
          componentCount: model.componentIds.length,
          cableCount: model.cables.length,
          routedCableCount: summary.routedCableCount,
          usedPhysicalSocketCount: model.usedPhysicalSocketIds.length,
          usedLogicalSocketCount: model.usedLogicalSocketIds.length,
          activeSections,
          walkthroughFocusCount: model.walkthroughFocus.reduce((sum, step) => sum + step.socketFocus.length + step.controlFocus.length, 0),
        };
      } catch (error) {
        return { id: entry.id, title: entry.title || entry.id, ok: false, componentCount: 0, cableCount: 0, routedCableCount: 0, usedPhysicalSocketCount: 0, usedLogicalSocketCount: 0, activeSections: [], walkthroughFocusCount: 0, error: error.message };
      }
    });
    return {
      schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
      templateCount: results.length,
      ok: results.length > 0 && results.every((row) => row.ok),
      nonOscillatorCount: results.filter((row) => row.id !== 'quickstart-damped-oscillation' && row.ok).length,
      results,
    };
  }

  function panelPolishSummary(model = {}, validation = null) {
    const sockets = physicalSocketsFromModel(model);
    const bySection = {};
    let labeledSocketCount = 0;
    let comparatorMiddleSocketCount = 0;
    let duplicateOutputPhysicalJacks = 0;
    const multiplicitySeen = new Set();
    const statuses = {};
    for (const socket of sockets) {
      bySection[socket.group] = (bySection[socket.group] || 0) + 1;
      if (socket.label) labeledSocketCount += 1;
      const status = socketRenderSpec(socket, validation).status;
      statuses[status] = (statuses[status] || 0) + 1;
      if (socket.group === 'COMPARATORS' && ['>0', '<0'].includes(socket.label)) comparatorMiddleSocketCount += 1;
      if (socket.direction === 'output' && socket.multiplicity && socket.multiplicity.count > 1) {
        const key = `${socket.logicalSocketId}|${socket.multiplicity.index}`;
        if (!multiplicitySeen.has(key)) {
          multiplicitySeen.add(key);
          duplicateOutputPhysicalJacks += 1;
        }
      }
    }
    const cableRoutes = ((model && model.cables) || []).map((cable, index) => cableRouteSpec(model, cable, index));
    return {
      schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
      referenceSvg: model.referenceSvg || (model.physicalSocketMap && model.physicalSocketMap.referenceSvg) || null,
      sectionOrder: SECTION_ORDER.slice(),
      sectionCount: Object.keys(bySection).length,
      bySection,
      socketCount: sockets.length,
      labeledSocketCount,
      comparatorMiddleSocketCount,
      duplicateOutputPhysicalJacks,
      statuses,
      cableCount: cableRoutes.length,
      routedCableCount: cableRoutes.filter((route) => route.fromPhysicalSocketId && route.toPhysicalSocketId).length,
      lanes: Array.from(new Set(cableRoutes.map((route) => route.lane))).sort((a, b) => a - b),
      usedPhysicalSocketCount: Array.isArray(model.usedPhysicalSocketIds) ? model.usedPhysicalSocketIds.length : physicalSocketsUsedByCables(model.cables || []).length,
      usedLogicalSocketCount: Array.isArray(model.usedLogicalSocketIds) ? model.usedLogicalSocketIds.length : logicalSocketsUsedByDesign(model.design || model).length,
      activeSectionCount: Array.isArray(model.sectionUsage) ? model.sectionUsage.filter((section) => section.active).length : 0,
      componentCount: Array.isArray(model.componentIds) ? model.componentIds.length : (Array.isArray(model.components) ? model.components.length : 0),
    };
  }



  function countBy(items, selector) {
    const counts = {};
    for (const item of items || []) {
      const key = selector(item) || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  function overlayLegendFromParts(socketHighlights = [], cableHighlights = [], sectionBadges = []) {
    const statusLabels = {
      editable: 'Editable active socket',
      invalid: 'Invalid endpoint or route',
      unsupported: 'Unsupported/displayed hardware accessory',
      'display-only': 'Display-only reference socket',
      inactive: 'Inactive socket',
      unknown: 'Unknown socket state',
    };
    const roleLabels = {
      'cable-endpoint': 'Cable endpoint in this design',
      'logical-use': 'Logical socket used by this design',
      invalid: 'Socket involved in a validation diagnostic',
      focus: 'Walkthrough focus socket',
      unknown: 'Other highlighted socket',
    };
    const statuses = countBy(socketHighlights, (socket) => socket.status || 'unknown');
    const roles = countBy(socketHighlights, (socket) => socket.role || 'unknown');
    const lanes = countBy(cableHighlights, (route) => route.lane !== undefined ? String(route.lane) : 'unrouted');
    const activeSections = (sectionBadges || []).filter((section) => section.active);
    return {
      schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
      kind: 'design-panel-overlay-legend',
      statusCount: Object.keys(statuses).length,
      roleCount: Object.keys(roles).length,
      laneCount: Object.keys(lanes).length,
      activeSectionCount: activeSections.length,
      statuses: Object.keys(statuses).sort().map((id) => ({ id, label: statusLabels[id] || id, count: statuses[id] })),
      roles: Object.keys(roles).sort().map((id) => ({ id, label: roleLabels[id] || id, count: roles[id] })),
      lanes: Object.keys(lanes).sort((a, b) => Number(a) - Number(b)).map((id) => ({ id, label: id === 'unrouted' ? 'Unrouted cable' : `Cable lane ${id}`, count: lanes[id] })),
      sections: activeSections.map((section) => ({ id: section.id, title: section.title || section.id, usedSocketCount: section.usedSocketCount || 0, cableEndpointCount: section.cableEndpointCount || 0 })),
    };
  }

  function panelOverlayLegend(overlayOrModel, options = {}) {
    if (!overlayOrModel) return overlayLegendFromParts([], [], []);
    if (Array.isArray(overlayOrModel.socketHighlights) || Array.isArray(overlayOrModel.sectionBadges)) {
      return overlayLegendFromParts(overlayOrModel.socketHighlights || [], overlayOrModel.cableHighlights || [], overlayOrModel.sectionBadges || []);
    }
    const overlay = panelOverlayFromModel(overlayOrModel, options);
    return overlay.legend || overlayLegendFromParts(overlay.socketHighlights || [], overlay.cableHighlights || [], overlay.sectionBadges || []);
  }

  function inferredPhysicalFocusForStep(model, step) {
    const text = `${step && step.title ? step.title : ''} ${step && step.text ? step.text : ''}`.toLowerCase();
    const sockets = physicalSocketsFromModel(model).filter((socket) => socket.designUsed || socket.designCableEndpoint || socket.designLogicalUsed);
    const groups = [];
    if (/comparator|\bcmp\b|>0|<0|sign-test|branch/.test(text)) groups.push('COMPARATORS');
    if (/multiplier|product|\bmul\b|\bx\b.*\by\b/.test(text)) groups.push('MULTIPLIERS');
    if (/xir|summing-junction extension/.test(text)) groups.push('XIR');
    if (/summer|summing junction|\bsum\b/.test(text)) groups.push('SUMMERS');
    if (/integrator|ic|slow|ramp/.test(text)) groups.push('INTEGRATORS');
    if (/coefficient|potentiometer|\bp[1-8]\b/.test(text)) groups.push('COEFF');
    if (/output|trace|\by\b|\bx\b|\bz\b|\bu\b/.test(text)) groups.push('OUT');
    let matches = sockets.filter((socket) => groups.includes(socket.group));
    if (/middle|>0|<0/.test(text)) matches = matches.filter((socket) => ['>0', '<0'].includes(socket.label) || /positive|nonPositive/.test(socket.logicalSocketId || ''));
    return uniqueSorted(matches.map((socket) => socket.id));
  }

  function physicalFocusForStep(model, step) {
    const focus = (step && step.socketFocus ? step.socketFocus : []).concat(step && step.logicalFocus ? step.logicalFocus : []);
    const sockets = physicalSocketsFromModel(model);
    const result = [];
    for (const focusId of focus) {
      const id = String(focusId || '');
      if (!id) continue;
      if (id.startsWith('phys.')) {
        if (sockets.some((socket) => socket.id === id)) result.push(id);
      } else {
        for (const socket of sockets) if (socket.logicalSocketId === id) result.push(socket.id);
      }
    }
    return uniqueSorted(result.length ? result : inferredPhysicalFocusForStep(model, step));
  }

  function templateGuidedEditingPlan(templateOrId, options = {}) {
    if (!templateApi || !templateApi.loadDesignTemplate) throw new Error('design template helpers are not available');
    const template = typeof templateOrId === 'string' ? templateApi.loadDesignTemplate(templateOrId, options) : templateOrId;
    const model = templatePanelModel(template, options);
    const overlay = panelOverlayFromModel(model, options);
    const walkthrough = Array.isArray(template.walkthrough) ? template.walkthrough : [];
    const steps = walkthrough.map((step, index) => {
      const focusPhysicalSocketIds = physicalFocusForStep(model, step);
      const controlFocus = uniqueSorted(step.controlFocus || []);
      const activeSectionIds = uniqueSorted(physicalSocketsFromModel(model).filter((socket) => focusPhysicalSocketIds.includes(socket.id)).map((socket) => socket.group));
      const action = controlFocus.length ? 'edit-controls' : focusPhysicalSocketIds.length ? 'inspect-or-wire-sockets' : 'read-notes';
      return {
        schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
        order: index + 1,
        title: step.title || `Step ${index + 1}`,
        text: step.text || '',
        action,
        socketFocus: uniqueSorted((step.socketFocus || []).concat(step.logicalFocus || [])),
        focusPhysicalSocketIds,
        controlFocus,
        activeSectionIds,
        overlay: panelOverlayFromModel(model, Object.assign({}, options, { focusPhysicalSocketIds })),
      };
    });
    return {
      schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
      kind: 'template-guided-editing-plan',
      template: clonePlain(model.template || { id: template.id, title: template.title, category: template.category }),
      stepCount: steps.length,
      socketFocusedStepCount: steps.filter((step) => step.focusPhysicalSocketIds.length).length,
      controlFocusedStepCount: steps.filter((step) => step.controlFocus.length).length,
      overlayLegend: overlay.legend || panelOverlayLegend(overlay),
      activeSectionIds: overlay.activeSectionIds || [],
      steps,
    };
  }

  function panelOverlayFromModel(model, options = {}) {
    const summary = panelPolishSummary(model, options.validation || null);
    const usedPhysical = new Set(model.usedPhysicalSocketIds || physicalSocketsUsedByCables(model.cables || []));
    const usedLogical = new Set(model.usedLogicalSocketIds || logicalSocketsUsedByDesign(model.design || model));
    const focusIds = uniqueSorted((options.focusPhysicalSocketIds || []).concat(model.usedPhysicalSocketIds || []));
    const invalidIds = new Set(options.validation && Array.isArray(options.validation.invalidPhysicalSocketIds) ? options.validation.invalidPhysicalSocketIds : []);
    const socketHighlights = physicalSocketsFromModel(model)
      .filter((socket) => usedPhysical.has(socket.id) || invalidIds.has(socket.id) || (socket.logicalSocketId && usedLogical.has(socket.logicalSocketId)))
      .sort(socketSort)
      .map((socket) => {
        const render = socketRenderSpec(socket, options.validation || null);
        const role = invalidIds.has(socket.id) ? 'invalid' : usedPhysical.has(socket.id) ? 'cable-endpoint' : 'logical-use';
        return {
          socketId: socket.id,
          logicalSocketId: socket.logicalSocketId || null,
          label: socket.label || socket.id,
          group: socket.group || 'UNKNOWN',
          role,
          focus: focusIds.includes(socket.id),
          status: render.status,
          x: render.x,
          y: render.y,
          className: `${render.className} overlay-${slug(role)}${focusIds.includes(socket.id) ? ' overlay-focus' : ''}`,
          dataAttributes: Object.assign({}, render.dataAttributes, {
            'data-design-panel-overlay-socket': socket.id,
            'data-design-overlay-role': role,
            'data-design-overlay-focus': focusIds.includes(socket.id) ? 'true' : 'false',
          }),
        };
      });
    const cableHighlights = (model.cableRoutes || designCableRouteSpecs(model)).map((route) => Object.assign({}, route, {
      className: `${route.className || 'panel-cable'} design-panel-overlay-cable`,
      dataAttributes: Object.assign({}, route.dataAttributes || {}, {
        'data-design-panel-overlay-cable': route.cableId,
        'data-design-overlay-lane': String(route.lane),
      }),
    }));
    const sectionBadges = (model.sectionUsage || []).map((section) => ({
      id: section.id,
      title: section.title,
      active: Boolean(section.active),
      usedSocketCount: section.usedSocketCount || 0,
      cableEndpointCount: section.cableEndpointCount || 0,
      usedLogicalSocketCount: section.usedLogicalSocketCount || 0,
      className: `${section.className || `design-panel-section-use section-${slug(section.id)}`}${section.active ? ' design-panel-overlay-active' : ''}`,
      dataAttributes: {
        'data-design-panel-overlay-section': section.id,
        'data-design-overlay-active': section.active ? 'true' : 'false',
      },
    }));
    return {
      schemaVersion: PANEL_POLISH_SCHEMA_VERSION,
      kind: 'design-panel-overlay',
      name: model.name || 'Custom design panel overlay',
      templateId: model.templateId || null,
      category: model.category || null,
      referenceSvg: model.referenceSvg || null,
      width: model.width || 800,
      height: model.height || 586,
      summary,
      activeSectionIds: sectionBadges.filter((section) => section.active).map((section) => section.id),
      socketHighlightCount: socketHighlights.length,
      cableHighlightCount: cableHighlights.length,
      sectionBadgeCount: sectionBadges.length,
      focusPhysicalSocketIds: focusIds,
      socketHighlights,
      cableHighlights,
      sectionBadges,
      legend: overlayLegendFromParts(socketHighlights, cableHighlights, sectionBadges),
      dataAttributes: {
        'data-design-panel-overlay': 'true',
        'data-design-panel-overlay-kind': 'design',
        'data-template-id': model.templateId || '',
        'data-active-sections': sectionBadges.filter((section) => section.active).map((section) => section.id).join(','),
      },
    };
  }

  function panelOverlayForDesign(design, options = {}) {
    const model = options.model || designPanelModelFromDesign(design, options);
    return panelOverlayFromModel(model, options);
  }

  function templatePanelOverlay(templateOrId, options = {}) {
    const model = templatePanelModel(templateOrId, options);
    const overlay = panelOverlayFromModel(model, options);
    overlay.kind = 'template-panel-overlay';
    overlay.template = clonePlain(model.template || {});
    overlay.walkthroughFocus = clonePlain(model.walkthroughFocus || []);
    try { overlay.guidedEditingPlan = templateGuidedEditingPlan(templateOrId, options); } catch (error) { overlay.guidedEditingPlan = null; }
    overlay.dataAttributes = Object.assign({}, overlay.dataAttributes, {
      'data-design-panel-overlay-kind': 'template',
      'data-template-panel-overlay': model.template && model.template.id ? model.template.id : '',
    });
    return overlay;
  }

  const api = {
    PANEL_POLISH_SCHEMA_VERSION,
    sectionSpecs,
    sectionSpecForGroup,
    socketLabelPlacement,
    socketRenderSpec,
    cableRouteSpec,
    logicalSocketsUsedByDesign,
    physicalSocketsUsedByCables,
    sectionUsageForDesign,
    designPanelModelFromDesign,
    templatePanelModel,
    verifyTemplatePanelModels,
    panelOverlayFromModel,
    panelOverlayForDesign,
    templatePanelOverlay,
    panelOverlayLegend,
    templateGuidedEditingPlan,
    panelPolishSummary,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDesignPanelPolish = api;
}(typeof window !== 'undefined' ? window : global));
