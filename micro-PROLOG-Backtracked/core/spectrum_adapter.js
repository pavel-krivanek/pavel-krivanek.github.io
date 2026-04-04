(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.MicroPrologCleanRoomSpectrumAdapter = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ZX_COLOURS = [
    ['#000000', '#000000'],
    ['#0000d7', '#0000ff'],
    ['#d70000', '#ff0000'],
    ['#d700d7', '#ff00ff'],
    ['#00d700', '#00ff00'],
    ['#00d7d7', '#00ffff'],
    ['#d7d700', '#ffff00'],
    ['#d7d7d7', '#ffffff']
  ];

  const CELL_WIDTH = 8;
  const CELL_HEIGHT = 8;
  const TEXT_COLS = 32;
  const TEXT_ROWS = 24;
  const SCREEN_WIDTH = CELL_WIDTH * TEXT_COLS;
  const SCREEN_HEIGHT = CELL_HEIGHT * TEXT_ROWS;
  const HYBRID_WINDOW_ROWS = 4;
  const HYBRID_WINDOW_BASE_ROW = TEXT_ROWS - HYBRID_WINDOW_ROWS;
  const GRAPHICS_HEIGHT = 176;
  const GLYPH_CACHE = new Map();
  let pendingFontLoad = false;

  function hasBrowserFontApi() {
    return typeof document !== 'undefined' && document && typeof document.createElement === 'function' && document.fonts;
  }

  function isZxFontReady() {
    try {
      return !!(hasBrowserFontApi() && typeof document.fonts.check === 'function' && document.fonts.check('8px "ZX Spectrum"'));
    } catch (_error) {
      return false;
    }
  }

  function scheduleFontReadyRepaint(repaintCanvases) {
    if (pendingFontLoad || !hasBrowserFontApi() || typeof repaintCanvases !== 'function') return;
    pendingFontLoad = true;
    Promise.resolve()
      .then(function () {
        if (typeof document.fonts.load === 'function') return document.fonts.load('8px "ZX Spectrum"');
        return null;
      })
      .catch(function () {
        return null;
      })
      .then(function () {
        pendingFontLoad = false;
        repaintCanvases();
      });
  }

  function rasterizeGlyph(char) {
    if (!char || char === ' ') return null;
    if (GLYPH_CACHE.has(char)) return GLYPH_CACHE.get(char);
    if (!hasBrowserFontApi()) {
      GLYPH_CACHE.set(char, null);
      return null;
    }
    const source = document.createElement('canvas');
    source.width = 32;
    source.height = 32;
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx) {
      GLYPH_CACHE.set(char, null);
      return null;
    }
    sourceCtx.clearRect(0, 0, 32, 32);
    sourceCtx.fillStyle = '#000';
    sourceCtx.imageSmoothingEnabled = false;
    sourceCtx.textBaseline = 'top';
    sourceCtx.textAlign = 'left';
    sourceCtx.font = '32px "ZX Spectrum", monospace';
    sourceCtx.fillText(char, 0, -2);
    const data = sourceCtx.getImageData(0, 0, 32, 32).data;
    const rows = [];
    for (let y = 0; y < 8; y += 1) {
      let bits = 0;
      for (let x = 0; x < 8; x += 1) {
        let alphaHits = 0;
        for (let sy = y * 4; sy < y * 4 + 4; sy += 1) {
          for (let sx = x * 4; sx < x * 4 + 4; sx += 1) {
            const offset = (sy * 32 + sx) * 4 + 3;
            if (data[offset] >= 96) alphaHits += 1;
          }
        }
        if (alphaHits >= 3) bits |= (1 << (7 - x));
      }
      rows.push(bits);
    }
    const glyph = rows.some(function (bits) { return bits !== 0; }) ? rows : null;
    GLYPH_CACHE.set(char, glyph);
    return glyph;
  }

  function drawRasterGlyph(ctx, char, x, y, css) {
    const glyph = rasterizeGlyph(char);
    if (!glyph) return false;
    ctx.fillStyle = css;
    for (let row = 0; row < glyph.length; row += 1) {
      const bits = glyph[row];
      if (!bits) continue;
      for (let col = 0; col < 8; col += 1) {
        if (bits & (1 << (7 - col))) ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
    return true;
  }

  function modulo8(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return ((Math.trunc(n) % 8) + 8) % 8;
  }

  function modulo256(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return ((Math.trunc(n) % 256) + 256) % 256;
  }

  function deref(term) {
    let value = term;
    const seen = new Set();
    while (value && value.tag === 'Var' && value.binding && !seen.has(value)) {
      seen.add(value);
      value = value.binding;
    }
    return value || term;
  }

  function numericArg(arg, fallback) {
    const value = deref(arg);
    if (value && value.tag === 'Num' && Number.isFinite(value.value)) return Math.trunc(value.value);
    return fallback;
  }

  function cloneAttrs(attrs) {
    return {
      ink: modulo8(attrs && attrs.ink),
      paper: modulo8(attrs && attrs.paper != null ? attrs.paper : 6),
      flash: attrs && attrs.flash ? 1 : 0,
      bright: attrs && attrs.bright ? 1 : 0,
      inverse: attrs && attrs.inverse ? 1 : 0,
      over: attrs && attrs.over ? 1 : 0,
    };
  }

  function defaultAttrs(options) {
    return cloneAttrs({
      ink: options && options.defaultInk != null ? options.defaultInk : 0,
      paper: options && options.defaultPaper != null ? options.defaultPaper : 6,
      flash: 0,
      bright: 0,
      inverse: 0,
      over: 0,
    });
  }

  function makeCell(attrs, opaque) {
    return {
      char: ' ',
      attrs: cloneAttrs(attrs),
      opaque: !!opaque,
    };
  }

  function makeRow(cols, attrs) {
    const row = [];
    for (let col = 0; col < cols; col += 1) row.push(makeCell(attrs, false));
    return row;
  }

  function makeGrid(rows, cols, attrs) {
    const grid = [];
    for (let row = 0; row < rows; row += 1) grid.push(makeRow(cols, attrs));
    return grid;
  }

  function colourCss(index, bright) {
    const pair = ZX_COLOURS[modulo8(index)];
    return pair[bright ? 1 : 0];
  }

  function decodePrimaryAttrs(value, fallback) {
    const code = modulo256(value);
    const base = cloneAttrs(fallback || {});
    base.flash = (code & 128) ? 1 : 0;
    base.bright = (code & 64) ? 1 : 0;
    base.paper = modulo8((code >> 3) & 7);
    base.ink = modulo8(code & 7);
    return base;
  }

  function applySecondaryAttrs(attrs, value) {
    const code = modulo256(value);
    const next = cloneAttrs(attrs || {});
    const back = (code & 64) ? 1 : 0;
    const fore = (code & 16) ? 1 : 0;
    next.inverse = (code & 4) ? 1 : 0;
    next.over = (code & 1) ? 1 : 0;
    if (back) next.paper = modulo8(next.paper ^ 7);
    if (fore) next.ink = modulo8(next.ink ^ 7);
    return next;
  }

  function createBaseEventLog() {
    const events = [];
    return {
      push: function (entry) {
        events.push(entry);
      },
      clear: function () {
        events.length = 0;
      },
      snapshot: function () {
        return events.slice();
      }
    };
  }

  function summarizeEventLog(log) {
    return (Array.isArray(log) ? log : []).map(function (entry) {
      if (!entry) return '?';
      if (entry.type === 'text') {
        return 'TEXT ' + String(entry.builtin || '?') + ' ' + JSON.stringify(String(entry.text || '')) + (entry.newline ? ' NL' : '');
      }
      if (entry.type === 'builtin') {
        const suffix = [];
        if (entry.mode) suffix.push(String(entry.mode));
        if (typeof entry.port === 'number') suffix.push('port=' + entry.port);
        if (typeof entry.value === 'number') suffix.push('value=' + entry.value);
        if (typeof entry.argc === 'number') suffix.push('argc=' + entry.argc);
        return 'BUILTIN ' + String(entry.name || '?') + (suffix.length ? ' ' + suffix.join(' ') : '');
      }
      return String(entry.type || '?');
    }).join(' | ');
  }

  function createTextOnlyAdapter(options) {
    const opts = options || {};
    const eventLog = createBaseEventLog();

    function handleOutput(text, meta) {
      eventLog.push({
        type: 'text',
        builtin: meta && meta.builtin ? String(meta.builtin) : '?',
        text: String(text || ''),
        newline: !!(meta && meta.newline)
      });
      return null;
    }

    function handleBuiltin(name, args, meta) {
      eventLog.push({
        type: 'builtin',
        name: String(name || ''),
        mode: meta && meta.mode ? String(meta.mode) : 'side-effect',
        argc: Array.isArray(args) ? args.length : 0,
        port: meta && typeof meta.port === 'number' ? meta.port : undefined,
        value: meta && typeof meta.value === 'number' ? meta.value : undefined,
      });
      if (typeof opts.onBuiltin === 'function') {
        return opts.onBuiltin(String(name || ''), args || [], meta || {}, eventLog.snapshot());
      }
      return null;
    }

    return {
      kind: 'text-only',
      handleOutput: handleOutput,
      handleBuiltin: handleBuiltin,
      reset: function () {
        eventLog.clear();
      },
      getEventLog: function () {
        return eventLog.snapshot();
      },
      summarizeEvents: function () {
        return summarizeEventLog(eventLog.snapshot());
      },
      renderToCanvases: function () {
        return null;
      },
      getTextRows: function () {
        return [];
      },
      getState: function () {
        return { kind: 'text-only' };
      }
    };
  }

  function createSpectrumAdapter(options) {
    const opts = options || {};
    const baseAttrs = defaultAttrs(opts);
    const eventLog = createBaseEventLog();

    function builtinAttrs(args, startIndex, fallback) {
      let attrs = cloneAttrs(fallback || state.activeAttrs);
      if (Array.isArray(args) && args.length > startIndex) attrs = decodePrimaryAttrs(numericArg(args[startIndex], 0), attrs);
      if (Array.isArray(args) && args.length > startIndex + 1) attrs = applySecondaryAttrs(attrs, numericArg(args[startIndex + 1], 0));
      return attrs;
    }

    const state = {
      kind: 'spectrum',
      rows: TEXT_ROWS,
      cols: TEXT_COLS,
      cellWidth: CELL_WIDTH,
      cellHeight: CELL_HEIGHT,
      screenWidth: SCREEN_WIDTH,
      screenHeight: SCREEN_HEIGHT,
      graphicsHeight: GRAPHICS_HEIGHT,
      displayMode: 'normal',
      borderColour: modulo8(opts.defaultBorder != null ? opts.defaultBorder : 6),
      activeAttrs: cloneAttrs(baseAttrs),
      cursorRow: 0,
      cursorCol: 0,
      pendingControl: null,
      cells: makeGrid(TEXT_ROWS, TEXT_COLS, baseAttrs),
      graphics: new Map(),
      graphicsCanvas: null,
      textCanvas: null,
    };

    function windowBaseRow() {
      return state.displayMode === 'hybrid' ? HYBRID_WINDOW_BASE_ROW : 0;
    }

    function windowRows() {
      return state.displayMode === 'hybrid' ? HYBRID_WINDOW_ROWS : TEXT_ROWS;
    }

    function clampCursorToWindow() {
      const base = windowBaseRow();
      const rows = windowRows();
      if (state.cursorRow < base || state.cursorRow >= base + rows) {
        state.cursorRow = base;
        state.cursorCol = 0;
      }
      if (state.cursorCol < 0 || state.cursorCol >= TEXT_COLS) {
        state.cursorCol = 0;
      }
    }

    function clearTextWindow(paperOverride) {
      const base = windowBaseRow();
      const rows = windowRows();
      const paper = paperOverride != null ? modulo8(paperOverride) : state.activeAttrs.paper;
      for (let row = base; row < base + rows; row += 1) {
        for (let col = 0; col < TEXT_COLS; col += 1) {
          state.cells[row][col] = makeCell(Object.assign({}, state.activeAttrs, { paper: paper }));
        }
      }
      state.cursorRow = base;
      state.cursorCol = 0;
      state.pendingControl = null;
    }

    function clearAll(paperOverride) {
      const paper = paperOverride != null ? modulo8(paperOverride) : state.activeAttrs.paper;
      state.graphics.clear();
      for (let row = 0; row < TEXT_ROWS; row += 1) {
        for (let col = 0; col < TEXT_COLS; col += 1) {
          state.cells[row][col] = makeCell(Object.assign({}, state.activeAttrs, { paper: paper }));
        }
      }
      state.cursorRow = windowBaseRow();
      state.cursorCol = 0;
      state.pendingControl = null;
    }

    function scrollWindow() {
      const base = windowBaseRow();
      const rows = windowRows();
      for (let row = base; row < base + rows - 1; row += 1) {
        state.cells[row] = state.cells[row + 1].map(function (cell) {
          return { char: cell.char, attrs: cloneAttrs(cell.attrs), opaque: !!cell.opaque };
        });
      }
      state.cells[base + rows - 1] = makeRow(TEXT_COLS, Object.assign({}, state.activeAttrs));
      state.cursorRow = base + rows - 1;
      state.cursorCol = 0;
    }

    function newline() {
      const base = windowBaseRow();
      const rows = windowRows();
      state.cursorCol = 0;
      if (state.cursorRow < base) state.cursorRow = base;
      else if (state.cursorRow >= base + rows - 1) scrollWindow();
      else state.cursorRow += 1;
    }

    function writeChar(ch) {
      clampCursorToWindow();
      if (state.cursorRow < 0 || state.cursorRow >= TEXT_ROWS) return;
      if (state.cursorCol < 0 || state.cursorCol >= TEXT_COLS) return;
      state.cells[state.cursorRow][state.cursorCol] = {
        char: ch,
        attrs: cloneAttrs(state.activeAttrs),
        opaque: true,
      };
      if (state.cursorCol >= TEXT_COLS - 1) newline();
      else state.cursorCol += 1;
    }

    function beginControl(code) {
      if (code === 16) state.pendingControl = { type: 'ink', remaining: 1 };
      else if (code === 17) state.pendingControl = { type: 'paper', remaining: 1 };
      else if (code === 18) state.pendingControl = { type: 'flash', remaining: 1 };
      else if (code === 19) state.pendingControl = { type: 'bright', remaining: 1 };
      else if (code === 20) state.pendingControl = { type: 'inverse', remaining: 1 };
      else if (code === 21) state.pendingControl = { type: 'over', remaining: 1 };
      else if (code === 22) state.pendingControl = { type: 'at', remaining: 2, values: [] };
    }

    function applyControlValue(kind, code) {
      if (kind === 'ink') state.activeAttrs.ink = modulo8(code);
      else if (kind === 'paper') state.activeAttrs.paper = modulo8(code);
      else if (kind === 'flash') state.activeAttrs.flash = code ? 1 : 0;
      else if (kind === 'bright') state.activeAttrs.bright = code ? 1 : 0;
      else if (kind === 'inverse') state.activeAttrs.inverse = code ? 1 : 0;
      else if (kind === 'over') state.activeAttrs.over = code ? 1 : 0;
    }

    function consumePendingControl(code) {
      if (!state.pendingControl) return null;
      if (state.pendingControl.type === 'at') {
        state.pendingControl.values.push(code);
        state.pendingControl.remaining -= 1;
        if (state.pendingControl.remaining > 0) return null;
        const row = Math.trunc(state.pendingControl.values[0]);
        const col = Math.trunc(state.pendingControl.values[1]);
        const rows = windowRows();
        if (row < 0 || row >= rows || col < 0 || col >= TEXT_COLS) {
          state.pendingControl = null;
          return { errorCode: 7 };
        }
        state.cursorRow = windowBaseRow() + row;
        state.cursorCol = col;
        state.pendingControl = null;
        return null;
      }
      applyControlValue(state.pendingControl.type, code);
      state.pendingControl = null;
      return null;
    }

    function screenPointKey(x, y) {
      return String(x) + ',' + String(y);
    }

    function mapGraphicsPoint(x, y) {
      const ix = Math.trunc(x);
      const iy = Math.trunc(y);
      if (ix >= -128 && ix <= 127 && iy >= -88 && iy <= 87) {
        return { x: ix + 128, y: 87 - iy };
      }
      if (ix >= 0 && ix <= 255 && iy >= 0 && iy <= GRAPHICS_HEIGHT - 1) {
        return { x: ix, y: (GRAPHICS_HEIGHT - 1) - iy };
      }
      if (ix >= 0 && ix <= 175 && iy >= 0 && iy <= 255) {
        return {
          x: Math.max(0, Math.min(255, Math.round((ix / 175) * 255))),
          y: Math.max(0, Math.min(GRAPHICS_HEIGHT - 1, Math.round(((255 - iy) / 255) * (GRAPHICS_HEIGHT - 1))))
        };
      }
      return null;
    }

    function drawMappedPoint(point, attrs) {
      if (!point) return;
      const nextAttrs = cloneAttrs(attrs || state.activeAttrs);
      const key = screenPointKey(point.x, point.y);
      if (nextAttrs.over && state.graphics.has(key)) {
        return;
      }
      state.graphics.set(key, {
        x: point.x,
        y: point.y,
        attrs: nextAttrs,
      });
    }

    function drawPoint(x, y, attrs) {
      drawMappedPoint(mapGraphicsPoint(x, y), attrs);
    }

    function drawLine(x1, y1, x2, y2, attrs) {
      const p1 = mapGraphicsPoint(x1, y1);
      const p2 = mapGraphicsPoint(x2, y2);
      if (!p1 || !p2) return;
      let x = p1.x;
      let y = p1.y;
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);
      const sx = p1.x < p2.x ? 1 : -1;
      const sy = p1.y < p2.y ? 1 : -1;
      let err = dx - dy;
      while (true) {
        drawMappedPoint({ x: x, y: y }, attrs);
        if (x === p2.x && y === p2.y) break;
        const e2 = err * 2;
        if (e2 > -dy) {
          err -= dy;
          x += sx;
        }
        if (e2 < dx) {
          err += dx;
          y += sy;
        }
      }
    }

    function handleCode(code) {
      if (state.pendingControl) return consumePendingControl(code);
      if (code === 10 || code === 13) {
        newline();
        return null;
      }
      if (code >= 16 && code <= 22) {
        beginControl(code);
        return null;
      }
      if (code < 32) return null;
      writeChar(String.fromCharCode(code));
      return null;
    }

    function repaintCanvases() {
      renderToCanvases(state.graphicsCanvas, state.textCanvas);
    }

    function handleOutput(text, meta) {
      const chunk = String(text || '');
      eventLog.push({
        type: 'text',
        builtin: meta && meta.builtin ? String(meta.builtin) : '?',
        text: chunk,
        newline: !!(meta && meta.newline)
      });
      for (let index = 0; index < chunk.length; index += 1) {
        const result = handleCode(chunk.charCodeAt(index) & 255);
        if (result && typeof result.errorCode === 'number') {
          repaintCanvases();
          return result;
        }
      }
      if (meta && meta.newline) newline();
      repaintCanvases();
      return null;
    }

    function handleBuiltin(name, args, meta) {
      eventLog.push({
        type: 'builtin',
        name: String(name || ''),
        mode: meta && meta.mode ? String(meta.mode) : 'side-effect',
        argc: Array.isArray(args) ? args.length : 0,
        port: meta && typeof meta.port === 'number' ? meta.port : undefined,
        value: meta && typeof meta.value === 'number' ? meta.value : undefined,
      });
      const builtin = String(name || '').toUpperCase();
      if (builtin === 'HYBRID') {
        state.displayMode = 'hybrid';
        clearAll(state.activeAttrs.paper);
        repaintCanvases();
        return null;
      }
      if (builtin === 'NORMAL') {
        state.displayMode = 'normal';
        clearAll(state.activeAttrs.paper);
        repaintCanvases();
        return null;
      }
      if (builtin === 'CLS') {
        const paper = Array.isArray(args) && args.length ? numericArg(args[0], state.activeAttrs.paper) : state.activeAttrs.paper;
        state.activeAttrs.paper = modulo8(paper);
        clearAll(state.activeAttrs.paper);
        repaintCanvases();
        return null;
      }
      if (builtin === 'BORDER') {
        state.borderColour = modulo8(Array.isArray(args) && args.length ? numericArg(args[0], state.borderColour) : state.borderColour);
        repaintCanvases();
        return null;
      }
      if (builtin === 'PNT') {
        if (Array.isArray(args) && args.length >= 2) {
          drawPoint(numericArg(args[0], 0), numericArg(args[1], 0), builtinAttrs(args, 2, state.activeAttrs));
        }
        repaintCanvases();
        return null;
      }
      if (builtin === 'LNE') {
        if (Array.isArray(args) && args.length >= 4) {
          drawLine(numericArg(args[0], 0), numericArg(args[1], 0), numericArg(args[2], 0), numericArg(args[3], 0), builtinAttrs(args, 4, state.activeAttrs));
        }
        repaintCanvases();
        return null;
      }
      if (builtin === 'BP') {
        repaintCanvases();
        if (typeof opts.onBeep === 'function') {
          opts.onBeep({
            duration: Array.isArray(args) && args.length ? numericArg(args[0], 0) : 0,
            cycles: Array.isArray(args) && args.length > 1 ? numericArg(args[1], 0) : 0
          });
        }
        return null;
      }
      if (builtin === 'PIO') {
        repaintCanvases();
        return null;
      }
      repaintCanvases();
      return null;
    }

    function renderGraphicsLayer(canvas) {
      if (!canvas || typeof canvas.getContext !== 'function') return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (canvas.width !== SCREEN_WIDTH) canvas.width = SCREEN_WIDTH;
      if (canvas.height !== SCREEN_HEIGHT) canvas.height = SCREEN_HEIGHT;
      ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = colourCss(state.activeAttrs.paper, state.activeAttrs.bright);
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      state.graphics.forEach(function (point) {
        const css = colourCss(point.attrs && point.attrs.ink != null ? point.attrs.ink : state.activeAttrs.ink, point.attrs && point.attrs.bright);
        ctx.fillStyle = css;
        ctx.fillRect(point.x, point.y, 1, 1);
      });
    }

    function renderTextLayer(canvas) {
      if (!canvas || typeof canvas.getContext !== 'function') return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (canvas.width !== SCREEN_WIDTH) canvas.width = SCREEN_WIDTH;
      if (canvas.height !== SCREEN_HEIGHT) canvas.height = SCREEN_HEIGHT;
      ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      ctx.imageSmoothingEnabled = false;
      const zxFontReady = isZxFontReady();
      if (!zxFontReady) scheduleFontReadyRepaint(repaintCanvases);
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.font = '8px "ZX Spectrum", monospace';
      for (let row = 0; row < TEXT_ROWS; row += 1) {
        for (let col = 0; col < TEXT_COLS; col += 1) {
          const cell = state.cells[row][col];
          const attrs = cloneAttrs(cell.attrs);
          let ink = attrs.ink;
          let paper = attrs.paper;
          if (attrs.inverse) {
            const oldInk = ink;
            ink = paper;
            paper = oldInk;
          }
          if (cell.opaque) {
            ctx.fillStyle = colourCss(paper, attrs.bright);
            ctx.fillRect(col * CELL_WIDTH, row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT);
          }
          if (cell.char && cell.char !== ' ') {
            const css = colourCss(ink, attrs.bright);
            if (!(zxFontReady && drawRasterGlyph(ctx, cell.char, col * CELL_WIDTH, row * CELL_HEIGHT, css))) {
              ctx.fillStyle = css;
              ctx.fillText(cell.char, col * CELL_WIDTH, row * CELL_HEIGHT - 1);
            }
          }
        }
      }
    }

    function renderToCanvases(graphicsCanvas, textCanvas) {
      if (graphicsCanvas) state.graphicsCanvas = graphicsCanvas;
      if (textCanvas) state.textCanvas = textCanvas;
      renderGraphicsLayer(state.graphicsCanvas);
      renderTextLayer(state.textCanvas);
      return null;
    }

    function reset() {
      state.displayMode = 'normal';
      state.borderColour = modulo8(opts.defaultBorder != null ? opts.defaultBorder : 6);
      state.activeAttrs = cloneAttrs(baseAttrs);
      state.cursorRow = 0;
      state.cursorCol = 0;
      state.pendingControl = null;
      state.cells = makeGrid(TEXT_ROWS, TEXT_COLS, state.activeAttrs);
      state.graphics = new Map();
      eventLog.clear();
      repaintCanvases();
    }

    function getTextRows() {
      return state.cells.map(function (row) {
        return row.map(function (cell) { return cell.char || ' '; }).join('');
      });
    }

    function getState() {
      return {
        kind: state.kind,
        displayMode: state.displayMode,
        borderColour: state.borderColour,
        activeAttrs: cloneAttrs(state.activeAttrs),
        cursorRow: state.cursorRow,
        cursorCol: state.cursorCol,
        textRows: getTextRows(),
        graphicsCount: state.graphics.size,
      };
    }

    repaintCanvases();

    return {
      kind: 'spectrum',
      handleOutput: handleOutput,
      handleBuiltin: handleBuiltin,
      renderToCanvases: renderToCanvases,
      reset: reset,
      getEventLog: function () {
        return eventLog.snapshot();
      },
      summarizeEvents: function () {
        return summarizeEventLog(eventLog.snapshot());
      },
      getTextRows: getTextRows,
      getState: getState,
    };
  }

  return {
    ZX_COLOURS: ZX_COLOURS,
    colourCss: colourCss,
    CELL_WIDTH: CELL_WIDTH,
    CELL_HEIGHT: CELL_HEIGHT,
    TEXT_COLS: TEXT_COLS,
    TEXT_ROWS: TEXT_ROWS,
    SCREEN_WIDTH: SCREEN_WIDTH,
    SCREEN_HEIGHT: SCREEN_HEIGHT,
    GRAPHICS_HEIGHT: GRAPHICS_HEIGHT,
    createTextOnlyAdapter: createTextOnlyAdapter,
    createSpectrumAdapter: createSpectrumAdapter,
    summarizeEventLog: summarizeEventLog,
  };
});
