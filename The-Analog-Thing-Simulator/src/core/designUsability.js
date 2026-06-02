'use strict';

(function attachDesignUsability(globalScope) {
  const nodeRequire = typeof require === 'function' ? require : null;
  const physicalApi = globalScope.AnalogThingPhysicalSockets || (nodeRequire ? nodeRequire('./physicalSockets') : null);
  const diagnosticsApi = globalScope.AnalogThingDesignDiagnostics || (nodeRequire ? nodeRequire('./designDiagnostics') : null);

  const USABILITY_SCHEMA_VERSION = 'analog-thing-design-usability/v1';
  const PANEL_ZOOM_PRESETS = Object.freeze({
    FIT_WIDTH: 'fit-width',
    ONE_TO_ONE: '100',
    FIT_PANEL: 'fit-panel',
  });
  const PANEL_VIEWPORT_LIMITS = Object.freeze({ minScale: 0.25, maxScale: 4 });

  function finiteNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function panelSizeFromModel(model) {
    return { width: finiteNumber(model && model.width, 1200), height: finiteNumber(model && model.height, 680) };
  }
  function containerSizeFromOptions(options = {}) {
    return {
      width: finiteNumber(options.containerWidth, 1200),
      height: finiteNumber(options.containerHeight, 680),
      padding: finiteNumber(options.padding, 24),
    };
  }

  function normalizePanelViewport(viewport = {}, model = {}, options = {}) {
    const panel = panelSizeFromModel(model);
    const limits = Object.assign({}, PANEL_VIEWPORT_LIMITS, options.limits || {});
    const scale = clamp(finiteNumber(viewport.scale, 1), limits.minScale, limits.maxScale);
    const offsetX = finiteNumber(viewport.offsetX, 0);
    const offsetY = finiteNumber(viewport.offsetY, 0);
    return {
      schemaVersion: USABILITY_SCHEMA_VERSION,
      mode: viewport.mode || PANEL_ZOOM_PRESETS.ONE_TO_ONE,
      scale,
      offsetX,
      offsetY,
      panelWidth: panel.width,
      panelHeight: panel.height,
      minScale: limits.minScale,
      maxScale: limits.maxScale,
    };
  }

  function panelViewportForPreset(preset, model = {}, options = {}) {
    const panel = panelSizeFromModel(model);
    const container = containerSizeFromOptions(options);
    const usableWidth = Math.max(1, container.width - container.padding * 2);
    const usableHeight = Math.max(1, container.height - container.padding * 2);
    let scale = 1;
    const normalizedPreset = Object.values(PANEL_ZOOM_PRESETS).includes(preset) ? preset : PANEL_ZOOM_PRESETS.FIT_PANEL;
    if (normalizedPreset === PANEL_ZOOM_PRESETS.FIT_WIDTH) scale = usableWidth / panel.width;
    else if (normalizedPreset === PANEL_ZOOM_PRESETS.FIT_PANEL) scale = Math.min(1, usableWidth / panel.width, usableHeight / panel.height);
    return normalizePanelViewport({ mode: normalizedPreset, scale, offsetX: 0, offsetY: 0 }, panel, options);
  }

  function panPanelViewport(viewport, deltaX, deltaY, model = {}, options = {}) {
    const next = normalizePanelViewport(viewport, model, options);
    next.mode = 'custom';
    next.offsetX += finiteNumber(deltaX, 0);
    next.offsetY += finiteNumber(deltaY, 0);
    return next;
  }

  function zoomPanelViewport(viewport, factor, model = {}, options = {}) {
    const current = normalizePanelViewport(viewport, model, options);
    const nextScale = clamp(current.scale * finiteNumber(factor, 1), current.minScale, current.maxScale);
    return Object.assign({}, current, { mode: 'custom', scale: nextScale });
  }

  function physicalSocketsFromModel(model = {}) {
    if (Array.isArray(model.physicalSockets) && model.physicalSockets.length) return model.physicalSockets;
    const map = physicalApi && physicalApi.createThatPhysicalSocketMap ? physicalApi.createThatPhysicalSocketMap() : { sockets: [] };
    return map.sockets || [];
  }

  function socketStatus(socket, validation = null) {
    const id = socket && socket.id;
    const invalidSockets = validation && Array.isArray(validation.invalidSockets) ? validation.invalidSockets : [];
    if (id && invalidSockets.includes(id)) return 'invalid';
    if (!socket) return 'unknown';
    if (socket.unsupported) return 'unsupported';
    if (socket.displayOnly || !socket.logicalSocketId || !socket.direction || socket.direction === 'display-only') return 'display-only';
    if (socket.active) return 'editable';
    return 'inactive';
  }

  function socketVisualState(socket, validation = null) {
    const status = socketStatus(socket, validation);
    const classes = ['socket', 'socket-hit', 'physical-socket', status];
    const direction = socket && socket.direction ? socket.direction : 'display-only';
    classes.push(direction);
    return {
      id: socket && socket.id ? socket.id : '',
      status,
      direction,
      editable: status === 'editable',
      focusable: status !== 'inactive' && status !== 'unknown',
      className: Array.from(new Set(classes)).join(' '),
      dataAttributes: {
        'data-socket-status': status,
        'data-editable': status === 'editable' ? 'true' : 'false',
        'data-unsupported': status === 'unsupported' ? 'true' : 'false',
        'aria-invalid': status === 'invalid' ? 'true' : 'false',
      },
    };
  }

  function socketAccessibilityLabel(socket, validation = null) {
    const status = socketStatus(socket, validation);
    const parts = [
      `${socket && socket.label ? socket.label : socket && socket.id ? socket.id : 'socket'} socket`,
      socket && socket.logicalSocketId ? `logical ${socket.logicalSocketId}` : 'no executable logical endpoint',
      socket && socket.direction ? `${socket.direction} direction` : 'display-only direction',
      socket && socket.group ? `${socket.group} section` : null,
      `status ${status}`,
      socket && socket.role ? socket.role : null,
    ].filter(Boolean);
    return parts.join(', ');
  }

  function cableAccessibilityLabel(cable, index = 0, model = {}) {
    const sockets = physicalSocketsFromModel(model);
    const fromPhysical = sockets.filter((socket) => socket.logicalSocketId === cable.from && socket.direction === 'output').map((socket) => socket.id);
    const toPhysical = sockets.filter((socket) => socket.logicalSocketId === cable.to && socket.direction === 'input').map((socket) => socket.id);
    return [
      `cable ${Number(index) + 1}`,
      `logical ${cable.from} to ${cable.to}`,
      cable.label || null,
      fromPhysical.length ? `from physical ${fromPhysical.join(', ')}` : null,
      toPhysical.length ? `to physical ${toPhysical.join(', ')}` : null,
    ].filter(Boolean).join(', ');
  }

  function orderedKeyboardSockets(model = {}) {
    return physicalSocketsFromModel(model)
      .filter((socket) => socketStatus(socket) === 'editable')
      .slice()
      .sort((a, b) => {
        const ay = finiteNumber(a.y !== undefined ? a.y : a.position && a.position.y, 0);
        const by = finiteNumber(b.y !== undefined ? b.y : b.position && b.position.y, 0);
        const ax = finiteNumber(a.x !== undefined ? a.x : a.position && a.position.x, 0);
        const bx = finiteNumber(b.x !== undefined ? b.x : b.position && b.position.x, 0);
        if (Math.abs(ay - by) > 8) return ay - by;
        if (Math.abs(ax - bx) > 8) return ax - bx;
        return String(a.id).localeCompare(String(b.id));
      })
      .map((socket, index) => ({ id: socket.id, index, label: socketAccessibilityLabel(socket), x: finiteNumber(socket.x !== undefined ? socket.x : socket.position && socket.position.x, 0), y: finiteNumber(socket.y !== undefined ? socket.y : socket.position && socket.position.y, 0) }));
  }

  function nextKeyboardSocket(model, currentSocketId, direction = 1) {
    const ordered = orderedKeyboardSockets(model);
    if (!ordered.length) return null;
    const currentIndex = ordered.findIndex((socket) => socket.id === currentSocketId);
    const delta = finiteNumber(direction, 1) >= 0 ? 1 : -1;
    if (currentIndex < 0) return ordered[delta >= 0 ? 0 : ordered.length - 1];
    return ordered[(currentIndex + delta + ordered.length) % ordered.length];
  }

  function summarizeSocketVisualStates(model = {}, validation = null) {
    const sockets = physicalSocketsFromModel(model);
    const counts = { total: sockets.length, editable: 0, displayOnly: 0, unsupported: 0, invalid: 0, inactive: 0, input: 0, output: 0 };
    const rows = sockets.map((socket) => {
      const state = socketVisualState(socket, validation);
      if (state.status === 'display-only') counts.displayOnly += 1;
      else if (state.status === 'editable') counts.editable += 1;
      else if (state.status === 'unsupported') counts.unsupported += 1;
      else if (state.status === 'invalid') counts.invalid += 1;
      else counts.inactive += 1;
      if (state.direction === 'input') counts.input += 1;
      if (state.direction === 'output') counts.output += 1;
      return { id: socket.id, logicalSocketId: socket.logicalSocketId || null, status: state.status, direction: state.direction, ariaLabel: socketAccessibilityLabel(socket, validation) };
    });
    return { schemaVersion: USABILITY_SCHEMA_VERSION, counts, rows };
  }

  function designUsabilitySummary(design, model = {}) {
    const validation = design && diagnosticsApi && diagnosticsApi.validateCustomDesign ? diagnosticsApi.validateCustomDesign(design) : null;
    const socketSummary = summarizeSocketVisualStates(model, validation);
    const keyboard = orderedKeyboardSockets(model);
    return {
      schemaVersion: USABILITY_SCHEMA_VERSION,
      validationOk: validation ? validation.ok : null,
      diagnosticCount: validation ? validation.diagnosticCount : 0,
      socketSummary: socketSummary.counts,
      keyboardSocketCount: keyboard.length,
      firstKeyboardSocket: keyboard[0] || null,
      zoomPresets: Object.values(PANEL_ZOOM_PRESETS),
    };
  }

  function manualBrowserSmokeChecklist() {
    return [
      { id: 'load-template', title: 'Load a template', steps: ['Open public/index.html', 'Choose Quickstart damped oscillator from custom-design templates', 'Click Load template'], expected: 'Panel, controls, validation, and serialized JSON update without console errors.' },
      { id: 'zoom-pan', title: 'Exercise zoom and pan', steps: ['Use Fit width, 100%, and Fit panel controls', 'Switch to Pan/zoom mode', 'Drag the panel or use arrow keys'], expected: 'Panel remains readable and sockets/cables stay aligned with the uploaded SVG.' },
      { id: 'keyboard-wire', title: 'Wire with keyboard', steps: ['Tab to an editable socket', 'Use Enter or Space in Cable mode', 'Move to an opposite-direction socket and press Enter or Space'], expected: 'A cable is created, undo becomes available, and validation remains actionable.' },
      { id: 'diagnostics', title: 'Inspect diagnostics', steps: ['Connect an unsupported accessory socket or load a deliberately invalid JSON design', 'Read validation panel and highlighted SVG markers'], expected: 'Invalid or unsupported endpoints are visually distinct and include repair hints.' },
      { id: 'save-load-run', title: 'Save, reload, and run', steps: ['Download design JSON', 'Import the same JSON', 'Run OP or REPF', 'Export trace JSON'], expected: 'Imported design preserves cables, coefficients, output routing, and produces a trace export.' },
    ];
  }

  function architectureOverview() {
    return {
      schemaVersion: USABILITY_SCHEMA_VERSION,
      layers: [
        { name: 'Uploaded SVG panel', responsibility: 'Visual background and visible THAT-style layout; overlay sockets and cables align to this coordinate system.' },
        { name: 'Physical socket map', responsibility: 'Every visible jack has a physical ID, coordinate, status, and optional mapping to an executable logical socket.' },
        { name: 'Custom design JSON', responsibility: 'User-facing saved program: metadata, coefficients, physical cable endpoints, operation defaults, output routing, and notes.' },
        { name: 'Logical patch JSON', responsibility: 'Executable simulator program compiled from a valid design; duplicate jacks collapse to logical component sockets.' },
        { name: 'Runtime and trace export', responsibility: 'Runs IC, OP, HALT, REP, and REPF modes, filters selected outputs, summarizes overloads, and exports trace metadata.' },
        { name: 'Diagnostics and usability', responsibility: 'Non-throwing validation, repair hints, socket/cable accessibility labels, keyboard navigation, and panel viewport controls.' },
      ],
    };
  }

  const api = {
    USABILITY_SCHEMA_VERSION,
    PANEL_ZOOM_PRESETS,
    PANEL_VIEWPORT_LIMITS,
    normalizePanelViewport,
    panelViewportForPreset,
    panPanelViewport,
    zoomPanelViewport,
    socketStatus,
    socketVisualState,
    socketAccessibilityLabel,
    cableAccessibilityLabel,
    orderedKeyboardSockets,
    nextKeyboardSocket,
    summarizeSocketVisualStates,
    designUsabilitySummary,
    manualBrowserSmokeChecklist,
    architectureOverview,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDesignUsability = api;
}(typeof window !== 'undefined' ? window : global));
