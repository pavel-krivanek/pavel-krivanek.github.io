(function () {
  const STORAGE_KEY = 'z80-workbench-source';
  const SPLIT_KEY = 'z80-workbench-split';
  const THEME_KEY = 'z80-workbench-theme';
  const SNAPSHOTS_OPEN_KEY = 'z80-workbench-snapshots-open';
  const BREAKPOINTS_KEY = 'z80-workbench-breakpoints';
  const QAOP_SCREEN_RATIO = 4 / 3;
  const DISASM_DEFAULT_LINES = 160;
  const DEBUG_DEFAULT_LINES = 120;
  const DEFAULT_SOURCE = [
    '.ORG 32768',
    '.ENT START',
    '',
    '; Simple border-cycle demo.',
    '',
    'START:  DI',
    '        LD B,0',
    '',
    'LOOP:   LD A,B',
    '        AND 7',
    '        OUT (254),A',
    '        INC B',
    '        JR LOOP',
    ''
  ].join('\n');

  let sourceEditor = null;
  let disasmEditor = null;
  let debuggerEditor = null;
  let lastBuild = null;
  let lastSourceHash = null;
  let errorLineHandle = null;
  let emulatorReadyPromise = null;
  let viewportObserver = null;
  let selectedSnapshotName = '';
  let themeChoice = 'auto';
  let uiSyncTimer = null;
  let debuggerCurrentLineHandle = null;
  let debuggerLineAddresses = [];
  let debuggerCurrentLine = -1;
  let debuggerRunToken = 0;
  let debuggerRunning = false;
  let debuggerStatusText = 'Debugger: ready';
  let debuggerBreakpoints = loadBreakpointSet();
  let debuggerRunConfig = null;
  let debuggerPendingBreak = null;
  let debuggerBreakpointPluginInstalled = false;
  let lastObservedPauseState = null;

  const workbenchAppEl = document.getElementById('workbenchApp');
  const sourceEl = document.getElementById('source');
  const disasmOutputEl = document.getElementById('disasmOutput');
  const debuggerDisasmOutputEl = document.getElementById('debuggerDisasmOutput');
  const disasmAddressEl = document.getElementById('disasmAddress');
  const disasmLinesEl = document.getElementById('disasmLines');
  const disasmMetaEl = document.getElementById('disasmMeta');
  const dbgLinesEl = document.getElementById('dbgLines');
  const debuggerRegistersEl = document.getElementById('debuggerRegisters');
  const debuggerStatusEl = document.getElementById('debuggerStatus');
  const listingPanel = document.getElementById('panel-listing');
  const hexOutput = document.getElementById('hexOutput');
  const compileStatus = document.getElementById('compileStatus');
  const programStats = document.getElementById('programStats');
  const emulatorStatus = document.getElementById('emulatorStatus');
  const appShell = document.getElementById('appShell');
  const splitter = document.getElementById('panelSplitter');
  const emulatorScreenSlot = document.getElementById('emulatorScreenSlot');
  const themeSelectEl = document.getElementById('themeSelect');
  const qaopKeyboardImageEl = document.getElementById('qaopKeyboardImage');
  const snapshotsPanelEl = document.getElementById('snapshotsPanel');
  const snapshotListEl = document.getElementById('snapshotList');
  const pauseButtonEl = document.getElementById('btnEmuPause');
  const resetButtonEl = document.getElementById('btnEmuReset');
  const openButtonEl = document.getElementById('btnEmuOpen');
  const saveButtonEl = document.getElementById('btnEmuSave');
  const machineSelectEl = document.getElementById('emuMachineSelect');
  const ayToggleEl = document.getElementById('emuToggleAy');
  const kjToggleEl = document.getElementById('emuToggleKj');
  const if1ToggleEl = document.getElementById('emuToggleIf1');
  const crtToggleEl = document.getElementById('emuToggleCrt');
  const bwToggleEl = document.getElementById('emuToggleBw');
  const muteToggleEl = document.getElementById('emuToggleMute');
  const volumeEl = document.getElementById('emuVolume');
  const layoutButtonEl = document.getElementById('btnEmuLayout');
  const snapshotCreateButtonEl = document.getElementById('btnSnapshotCreate');
  const snapshotRefreshButtonEl = document.getElementById('btnSnapshotRefresh');
  const dbgContinueButtonEl = document.getElementById('btnDbgContinue');
  const dbgBreakButtonEl = document.getElementById('btnDbgBreak');
  const dbgRestartButtonEl = document.getElementById('btnDbgRestart');
  const dbgStepOverButtonEl = document.getElementById('btnDbgStepOver');
  const dbgStepIntoButtonEl = document.getElementById('btnDbgStepInto');
  const dbgStepOutButtonEl = document.getElementById('btnDbgStepOut');
  const dbgRunToCursorButtonEl = document.getElementById('btnDbgRunToCursor');
  const dbgRefreshButtonEl = document.getElementById('btnDbgRefresh');
  const themeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function joinAssetPath(base, relative) {
    const normalizedBase = String(base || '').replace(/\\+$/g, '').replace(/\/+$/g, '');
    const normalizedRelative = String(relative || '').replace(/^\\+|^\/+/, '');
    return (normalizedBase || '.').replace(/\/$/, '') + '/' + normalizedRelative;
  }

  function configureKeyboardImage() {
    if (!qaopKeyboardImageEl) return;
    qaopKeyboardImageEl.src = joinAssetPath(window.QAOP_ASSET_BASE || 'qaop/', 'Keyboard.svg');
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('ok', 'err');
    if (kind) el.classList.add(kind);
  }

  function sampleSource() {
    return DEFAULT_SOURCE;
  }

  function getSource() {
    return sourceEditor ? sourceEditor.getValue() : sourceEl.value;
  }

  function setSource(value) {
    if (sourceEditor) sourceEditor.setValue(value);
    else sourceEl.value = value;
  }

  function setDisassemblyText(value) {
    if (disasmEditor) disasmEditor.setValue(value);
    else disasmOutputEl.value = value;
  }

  function setDebuggerText(value) {
    if (debuggerEditor) debuggerEditor.setValue(value);
    else if (debuggerDisasmOutputEl) debuggerDisasmOutputEl.value = value;
  }

  function loadBreakpointSet() {
    try {
      const raw = JSON.parse(localStorage.getItem(BREAKPOINTS_KEY) || '[]');
      return new Set((Array.isArray(raw) ? raw : []).map(value => (value >>> 0) & 0xFFFF));
    } catch (err) {
      return new Set();
    }
  }

  function persistBreakpoints() {
    try {
      localStorage.setItem(BREAKPOINTS_KEY, JSON.stringify(Array.from(debuggerBreakpoints).sort((a, b) => a - b)));
    } catch (err) {}
  }

  function saveSource() {
    try {
      localStorage.setItem(STORAGE_KEY, getSource());
    } catch (err) {}
  }

  function loadSource() {
    let text = '';
    try {
      text = localStorage.getItem(STORAGE_KEY) || '';
    } catch (err) {
      text = '';
    }
    setSource(text || sampleSource());
  }

  function clearErrorLine() {
    if (sourceEditor && errorLineHandle != null) {
      sourceEditor.removeLineClass(errorLineHandle, 'background', 'cm-error-line');
      errorLineHandle = null;
    }
  }

  function markErrorLine(lineNumber) {
    clearErrorLine();
    if (!sourceEditor || !lineNumber || lineNumber < 1) return;
    errorLineHandle = lineNumber - 1;
    sourceEditor.addLineClass(errorLineHandle, 'background', 'cm-error-line');
    sourceEditor.scrollIntoView({ line: errorLineHandle, ch: 0 }, 120);
    sourceEditor.setCursor({ line: errorLineHandle, ch: 0 });
  }

  function countBytes(listing) {
    let total = 0;
    for (const row of listing || []) total += (row && row.lens && row.lens.length) || 0;
    return total;
  }

  function buildListingHtml(listing, symbolTable) {
    const htmlMode = ASM.PRAGMAS && ASM.PRAGMAS.indexOf('HTML') >= 0;
    if (htmlMode) return ASM.html(listing, symbolTable);
    return '<pre>' + escapeHtml(ASM.lst(listing, symbolTable)) + '</pre>';
  }

  function directiveList() {
    const text = String(ASM.compile || '');
    const matches = text.match(/\.[A-Z][A-Z0-9]+/g) || [];
    const seen = new Set(matches.concat([
      '.ORG', '.ENT', '.EQU', '.BYTE', '.WORD', '.DB', '.DW', '.BLOCK', '.ENDBLOCK',
      '.IF', '.ELSE', '.ENDIF', '.INCLUDE', '.INCBIN', '.PHASE', '.DEPHASE', '.CSTR',
      '.ISTR', '.PSTR', '.RES', '.ALIGN', '.END', '.MACRO', '.ENDM', '.REPT', '.CPU', '.PRAGMA'
    ]));
    return Array.from(seen).sort();
  }

  function regexAlternation(values) {
    return values
      .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length)
      .join('|');
  }

  function defineEditorModes() {
    const opcodeNames = Array.from(new Set(Object.keys(Z80.set).concat(Object.keys(Z80.set2))))
      .filter(name => !/\d$/.test(name) && !/^CAL2|JP2|JR2$/.test(name))
      .sort();
    const registers = ['AF\'', 'AF', 'BC', 'DE', 'HL', 'SP', 'IX', 'IY', 'IXH', 'IXL', 'IYH', 'IYL', 'A', 'B', 'C', 'D', 'E', 'F', 'H', 'L', 'I', 'R', 'NZ', 'Z', 'NC', 'C', 'PO', 'PE', 'P', 'M'];
    const directives = directiveList();
    const opcodeAlt = regexAlternation(opcodeNames);
    const registerAlt = regexAlternation(registers);
    const directiveAlt = regexAlternation(directives);

    CodeMirror.defineSimpleMode('z80asm', {
      start: [
        { regex: /;.*/, token: 'comment' },
        { regex: /^\s*[@A-Za-z_.$][\w.$-]*(?=\s*:)/, token: 'def' },
        { regex: new RegExp('(?:' + directiveAlt + ')(?![\\w.$])', 'i'), token: 'directive' },
        { regex: new RegExp('\\b(?:' + opcodeAlt + ')(?![\\w.$])', 'i'), token: 'keyword' },
        { regex: new RegExp('\\b(?:' + registerAlt + ')(?![\\w.$])', 'i'), token: 'variable-2' },
        { regex: /\b(?:DUP)\b/i, token: 'atom' },
        { regex: /(?:\$[0-9A-Fa-f]+|0x[0-9A-Fa-f]+|%[01]+|\b\d+\b)/, token: 'number' },
        { regex: /"(?:[^\\"]|\\.)*"?/, token: 'string' },
        { regex: /'(?:[^\\']|\\.)*'?/, token: 'string' },
        { regex: /[()\[\],:+\-*/<>=]/, token: 'operator' }
      ],
      meta: { lineComment: ';' }
    });

    CodeMirror.defineSimpleMode('z80asm-listing', {
      start: [
        { regex: /;.*/, token: 'comment' },
        { regex: /^\s*[0-9A-Fa-f]{4}(?=:)/, token: 'number' },
        { regex: /^\s*[0-9A-Fa-f]{4}:\s+/, token: null, next: 'afterAddress' },
        { regex: /(?:\$[0-9A-Fa-f]+|0x[0-9A-Fa-f]+|\b[0-9A-Fa-f]{2,4}\b|%[01]+|\b\d+\b)/, token: 'number' },
        { regex: new RegExp('\\b(?:' + opcodeAlt + ')(?![\\w.$])', 'i'), token: 'keyword' },
        { regex: new RegExp('\\b(?:' + registerAlt + ')(?![\\w.$])', 'i'), token: 'variable-2' },
        { regex: /"(?:[^\\"]|\\.)*"?/, token: 'string' },
        { regex: /'(?:[^\\']|\\.)*'?/, token: 'string' },
        { regex: /[()\[\],:+\-*/<>=]/, token: 'operator' }
      ],
      afterAddress: [
        { regex: /(?:[0-9A-Fa-f]{2}\s+)+/, token: 'comment' },
        { regex: /\s+/, token: null, next: 'start' }
      ],
      meta: { lineComment: ';' }
    });
  }

  function ensureCodeMirror() {
    if (!(window.CodeMirror && CodeMirror.defineSimpleMode)) {
      setStatus(compileStatus, 'CodeMirror failed to load; using plain text areas', 'err');
      sourceEl.style.display = 'block';
      disasmOutputEl.style.display = 'block';
      if (debuggerDisasmOutputEl) debuggerDisasmOutputEl.style.display = 'block';
      sourceEl.addEventListener('input', saveSource);
      return;
    }

    defineEditorModes();

    sourceEditor = CodeMirror.fromTextArea(sourceEl, {
      mode: 'z80asm',
      theme: 'default',
      lineNumbers: true,
      matchBrackets: true,
      styleActiveLine: true,
      indentUnit: 8,
      indentWithTabs: false,
      lineWrapping: false,
      autofocus: false,
      viewportMargin: Infinity
    });
    sourceEditor.on('change', saveSource);

    disasmEditor = CodeMirror.fromTextArea(disasmOutputEl, {
      mode: 'z80asm-listing',
      theme: 'default',
      lineNumbers: true,
      readOnly: true,
      lineWrapping: false,
      viewportMargin: Infinity,
      scrollbarStyle: 'native'
    });

    debuggerEditor = CodeMirror.fromTextArea(debuggerDisasmOutputEl, {
      mode: 'z80asm-listing',
      theme: 'default',
      lineNumbers: true,
      readOnly: true,
      lineWrapping: false,
      viewportMargin: Infinity,
      scrollbarStyle: 'native',
      styleActiveLine: true,
      gutters: ['cm-breakpoint-gutter', 'CodeMirror-linenumbers']
    });
    debuggerEditor.on('gutterClick', (cm, lineNumber) => toggleBreakpointAtLine(lineNumber));
  }

  function compileCurrent() {
    const sourceText = getSource();
    const sourceHash = sourceText;
    clearErrorLine();

    const compileResult = ASM.compile(sourceText, Z80);
    if (compileResult[0]) {
      const error = compileResult[0];
      const line = error && error.s ? error.s.numline : null;
      markErrorLine(line);
      const lineText = line ? sourceText.split(/\r?\n/)[line - 1] : '';
      let message = line ? `Error on line ${line}: ${error.msg}` : `Internal error: ${error}`;
      if (/\bENT\b/.test(lineText) && !/\.ENT\b/i.test(lineText)) message += ' — use .ENT, not ENT';
      setStatus(compileStatus, message, 'err');
      programStats.textContent = 'Bytes: —';
      hexOutput.value = '';
      listingPanel.innerHTML = '<pre>' + escapeHtml(String(error.msg || error)) + '</pre>';
      lastBuild = null;
      lastSourceHash = sourceHash;
      activateBottomTab('listing');
      return null;
    }

    const assembled = compileResult[1];
    const listing = assembled[0];
    const symbolTable = assembled[1];
    const programBytes = countBytes(listing);
    const snaBytes = makeSNA(listing);
    const tapBytes = makeTAP(listing);
    const hexText = ASM.hex(listing);

    hexOutput.value = hexText;
    listingPanel.innerHTML = buildListingHtml(listing, symbolTable);
    setStatus(compileStatus, 'Assembled successfully', 'ok');
    programStats.textContent = `Bytes: ${programBytes} • SNA: ${snaBytes.length} • TAP: ${tapBytes.length}`;

    lastBuild = { sourceText, listing, symbolTable, hexText, snaBytes, tapBytes, sourceHash };
    lastSourceHash = sourceHash;
    return lastBuild;
  }

  function getBuild() {
    const currentSource = getSource();
    if (lastBuild && lastSourceHash === currentSource) return lastBuild;
    return compileCurrent();
  }

  function bytesToFile(bytes, name, type) {
    return new File([new Uint8Array(bytes)], name, { type });
  }

  function downloadBytes(bytes, name, type) {
    const blob = new Blob([new Uint8Array(bytes)], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updateEmulatorViewport() {
    if (!emulatorScreenSlot) return;
    const rect = emulatorScreenSlot.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    let width = Math.floor(rect.width);
    let height = Math.floor(width / QAOP_SCREEN_RATIO);
    if (height > rect.height) {
      height = Math.floor(rect.height);
      width = Math.floor(height * QAOP_SCREEN_RATIO);
    }
    const x = Math.floor(rect.width / 2);
    const y = Math.floor(rect.height / 2);
    emulatorScreenSlot.style.setProperty('--qaop-x', `${x}px`);
    emulatorScreenSlot.style.setProperty('--qaop-y', `${y}px`);
    emulatorScreenSlot.style.setProperty('--qaop-w', `${Math.max(1, width)}px`);
    emulatorScreenSlot.style.setProperty('--qaop-h', `${Math.max(1, height)}px`);
  }

  function setupViewportObserver() {
    updateEmulatorViewport();
    if (window.ResizeObserver) {
      viewportObserver = new ResizeObserver(() => updateEmulatorViewport());
      viewportObserver.observe(emulatorScreenSlot);
      viewportObserver.observe(appShell);
    }
    window.addEventListener('resize', updateEmulatorViewport);
  }

  function applySplitWidth(px, persist) {
    if (!appShell || window.matchMedia('(max-width: 1180px)').matches) {
      updateEmulatorViewport();
      return;
    }
    const shellRect = appShell.getBoundingClientRect();
    const splitterWidth = splitter ? splitter.getBoundingClientRect().width || 12 : 12;
    const minLeft = 420;
    const minRight = 420;
    const maxLeft = Math.max(minLeft, shellRect.width - splitterWidth - minRight);
    const next = clamp(Math.round(px), minLeft, maxLeft);
    document.documentElement.style.setProperty('--split-left', `${next}px`);
    splitter?.setAttribute('aria-valuenow', String(next));
    splitter?.setAttribute('aria-valuemin', String(minLeft));
    splitter?.setAttribute('aria-valuemax', String(maxLeft));
    if (persist) {
      try { localStorage.setItem(SPLIT_KEY, String(next)); } catch (err) {}
    }
    updateEmulatorViewport();
  }

  function setupSplitter() {
    if (!splitter || !appShell) return;

    let pointerId = null;
    let shellLeft = 0;

    const onPointerMove = ev => {
      if (pointerId == null || ev.pointerId !== pointerId) return;
      applySplitWidth(ev.clientX - shellLeft, false);
    };

    const stopDrag = ev => {
      if (pointerId == null || (ev && ev.pointerId != null && ev.pointerId !== pointerId)) return;
      document.body.classList.remove('is-resizing');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
      try { splitter.releasePointerCapture(pointerId); } catch (err) {}
      const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--split-left'));
      if (!Number.isNaN(current)) applySplitWidth(current, true);
      pointerId = null;
    };

    splitter.addEventListener('pointerdown', ev => {
      if (window.matchMedia('(max-width: 1180px)').matches) return;
      ev.preventDefault();
      pointerId = ev.pointerId;
      shellLeft = appShell.getBoundingClientRect().left;
      document.body.classList.add('is-resizing');
      splitter.setPointerCapture(pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', stopDrag);
      window.addEventListener('pointercancel', stopDrag);
    });

    splitter.addEventListener('keydown', ev => {
      if (window.matchMedia('(max-width: 1180px)').matches) return;
      const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--split-left')) || appShell.getBoundingClientRect().width / 2;
      if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        applySplitWidth(current - (ev.shiftKey ? 60 : 24), true);
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        applySplitWidth(current + (ev.shiftKey ? 60 : 24), true);
      } else if (ev.key === 'Home') {
        ev.preventDefault();
        applySplitWidth(420, true);
      } else if (ev.key === 'End') {
        ev.preventDefault();
        const shellRect = appShell.getBoundingClientRect();
        const splitterWidth = splitter.getBoundingClientRect().width || 12;
        applySplitWidth(shellRect.width - splitterWidth - 420, true);
      }
    });

    let saved = null;
    try {
      saved = parseFloat(localStorage.getItem(SPLIT_KEY));
    } catch (err) {
      saved = null;
    }
    if (Number.isFinite(saved)) applySplitWidth(saved, false);
    else applySplitWidth(Math.round(appShell.getBoundingClientRect().width * 0.5), false);

    window.addEventListener('resize', () => {
      const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--split-left'));
      if (Number.isFinite(current)) applySplitWidth(current, false);
      else updateEmulatorViewport();
    });
  }

  function waitForQaop() {
    if (emulatorReadyPromise) return emulatorReadyPromise;
    emulatorReadyPromise = new Promise((resolve, reject) => {
      const started = Date.now();
      (function poll() {
        if (window.qaop && typeof window.qaop.command === 'function' && globalThis.__qaop && typeof globalThis.__qaop.captureState === 'function') {
          setStatus(emulatorStatus, 'Emulator: ready', 'ok');
          updateEmulatorViewport();
          resolve(window.qaop);
          return;
        }
        if (Date.now() - started > 15000) {
          reject(new Error('Qaop did not finish initializing. Check QAOP_ASSET_BASE and ROM availability.'));
          return;
        }
        setTimeout(poll, 100);
      })();
    });
    emulatorReadyPromise.catch(err => setStatus(emulatorStatus, 'Emulator error: ' + err.message, 'err'));
    return emulatorReadyPromise;
  }

  async function runBuild(format) {
    const build = getBuild();
    if (!build) return;
    const api = await waitForQaop();
    const isSna = format === 'sna';
    const file = isSna
      ? bytesToFile(build.snaBytes, 'asm80.sna', 'application/x.zx.sna')
      : bytesToFile(build.tapBytes, 'asm80.tap', 'application/x.zx.tap');
    await stopDebuggerRun('Debugger: program loaded', { keepPaused: false, refresh: false });
    api.command('load', file);
    setStatus(emulatorStatus, isSna ? 'Emulator: loaded generated snapshot' : 'Emulator: loaded generated tape', 'ok');
    queueUiSync();
    if (workbenchAppEl?.dataset.editorView === 'debugger') setTimeout(() => refreshDebuggerView({ activate: false }), 60);
    focusEmulator();
  }

  function focusEmulator() {
    window.focus();
    document.getElementById('f')?.focus();
  }

  function activateBottomTab(name) {
    document.querySelectorAll('.wb-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === name));
    document.querySelectorAll('.wb-tab-panel').forEach(el => el.classList.toggle('active', el.id === 'panel-' + name));
  }

  function activateEditorTab(name) {
    document.querySelectorAll('.wb-editor-tab').forEach(el => el.classList.toggle('active', el.dataset.editorTab === name));
    document.querySelectorAll('.wb-editor-panel').forEach(el => el.classList.toggle('active', el.id === 'editor-panel-' + name));
    if (workbenchAppEl) workbenchAppEl.dataset.editorView = name;
    if (name === 'source') setTimeout(() => sourceEditor ? sourceEditor.refresh() : sourceEl.focus(), 0);
    else if (name === 'disasm') setTimeout(() => disasmEditor ? disasmEditor.refresh() : disasmOutputEl.focus(), 0);
    else if (name === 'debugger') {
      setTimeout(() => {
        if (debuggerEditor) debuggerEditor.refresh();
        else debuggerDisasmOutputEl?.focus();
        refreshDebuggerView({ activate: false });
      }, 0);
    }
  }

  async function copyHex() {
    const build = getBuild();
    if (!build) return;
    await navigator.clipboard.writeText(build.hexText);
    setStatus(compileStatus, 'HEX copied to clipboard', 'ok');
  }

  function formatWord(value) {
    return (value >>> 0).toString(16).toUpperCase().padStart(4, '0');
  }

  function formatByte(value) {
    return (value >>> 0).toString(16).toUpperCase().padStart(2, '0');
  }

  function parseAddress(text, fallback) {
    const raw = String(text || '').trim();
    if (!raw) return fallback;
    let value = NaN;
    if (/^\$[0-9a-f]+$/i.test(raw)) value = parseInt(raw.slice(1), 16);
    else if (/^0x[0-9a-f]+$/i.test(raw)) value = parseInt(raw, 16);
    else if (/^[0-9a-f]+h$/i.test(raw)) value = parseInt(raw.slice(0, -1), 16);
    else if (/^%[01]+$/i.test(raw)) value = parseInt(raw.slice(1), 2);
    else if (/^\d+$/i.test(raw)) value = parseInt(raw, 10);
    return Number.isFinite(value) ? (value & 0xFFFF) : fallback;
  }

  function snapshotToMemory(snapshot) {
    const memory = new Uint8Array(65536);
    const runtime = globalThis.__qaop;
    if (!snapshot || snapshot.ram == null) return memory;
    const ram = snapshot.ram;

    if (ArrayBuffer.isView(ram)) {
      memory.fill(0);
      memory.set(ram.subarray(0, Math.min(65536, ram.length)), 0);
      return memory;
    }

    if (Array.isArray(ram) && ram.length > 8) {
      const flat = Uint8Array.from(ram);
      memory.set(flat.subarray(0, Math.min(65536, flat.length)), 0);
      return memory;
    }

    if (Array.isArray(ram)) {
      let romFilled = false;
      if (snapshot.rom && snapshot.rom.length) {
        const rom = snapshot.rom.slice ? snapshot.rom.slice(0, 16384) : Uint8Array.from(snapshot.rom).slice(0, 16384);
        memory.set(rom, 0);
        romFilled = true;
      }
      if (!romFilled && runtime && typeof runtime.peekMemoryRaw === 'function') {
        for (let i = 0; i < 16384; i++) memory[i] = runtime.peekMemoryRaw(i);
      }
      if (ram[5]) memory.set(ram[5], 0x4000);
      if (ram[2]) memory.set(ram[2], 0x8000);
      const topPage = (snapshot.p7FFD == null ? 0 : snapshot.p7FFD) & 7;
      if (ram[topPage]) memory.set(ram[topPage], 0xC000);
    }

    return memory;
  }

  function createDisassemblerCpu(memory, address) {
    const cpu = window.Z80CPUDisassembler;
    if (!cpu) throw new Error('Disassembler runtime is not loaded.');
    cpu.reset();
    cpu.programMemory(memory);
    cpu.registers.PC = address & 0xFFFF;
    return cpu;
  }

  function disassembleNextLineObject(cpu, memory) {
    const pc = cpu.registers.PC & 0xFFFF;
    const text = cpu.disassemble1();
    if (text == null) return null;
    const nextPc = cpu.registers.PC & 0xFFFF;
    const width = nextPc > pc ? nextPc - pc : 1;
    const bytes = Array.from(memory.slice(pc, Math.min(memory.length, pc + width)), formatByte).join(' ');
    return {
      address: pc,
      text,
      nextPc,
      width,
      bytes,
      formatted: `${formatWord(pc)}: ${bytes.padEnd(11, ' ')} ${text}`.replace(/\s+$/g, '')
    };
  }

  function disassembleLineObjects(memory, startAddress, lineCount) {
    const cpu = createDisassemblerCpu(memory, startAddress);
    const lines = [];
    for (let i = 0; i < lineCount && cpu.registers.PC < memory.length; i++) {
      const line = disassembleNextLineObject(cpu, memory);
      if (!line) break;
      lines.push(line);
      if (line.nextPc === line.address) break;
    }
    return lines;
  }

  function buildDisassemblyText(memory, startAddress, lineCount) {
    return disassembleLineObjects(memory, startAddress, lineCount).map(line => line.formatted).join('\n');
  }

  function captureSnapshotState() {
    const runtime = globalThis.__qaop;
    if (!runtime || typeof runtime.captureState !== 'function') {
      throw new Error('Qaop snapshot API is not available.');
    }
    if (typeof runtime.flushPrefixCycles === 'function') runtime.flushPrefixCycles();
    return runtime.captureState();
  }

  function getDebuggerRuntime() {
    const runtime = globalThis.__qaop;
    if (!(runtime && runtime.cpuCore && runtime.machineBus)) {
      throw new Error('Qaop CPU control API is not available.');
    }
    return runtime;
  }

async function ensureDebuggerPaused() {
  await waitForQaop();
  if (!(window.qaop && typeof window.qaop.set === 'function')) return;
  if (debuggerRunning) {
    finishDebuggerBreak('Debugger: paused');
    await new Promise(resolve => setTimeout(resolve, 0));
    return;
  }
  if (!window.qaop.settings || !window.qaop.settings.pause) {
    window.qaop.set({ pause: true });
    queueUiSync();
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  syncLiveQaopStateToScreen();
}


function syncLiveQaopStateToScreen() {
  const runtime = getDebuggerRuntime();
  if (runtime.flushPrefixCycles) runtime.flushPrefixCycles();
  if (typeof runtime.captureState === 'function' && typeof runtime.setStateAndRefresh === 'function') {
    const snapshot = runtime.captureState();
    runtime.setStateAndRefresh(snapshot);
  }
  queueUiSync();
}

function finishDebuggerBreak(reason, options = {}) {
  debuggerRunToken += 1;
  debuggerRunning = false;
  debuggerRunConfig = null;
  debuggerPendingBreak = null;
  if (window.qaop && typeof window.qaop.set === 'function' && options.pauseEmulator !== false) {
    window.qaop.set({ pause: true });
  }
  try {
    syncLiveQaopStateToScreen();
  } catch (err) {
    queueUiSync();
  }
  updateDebuggerButtons();
  setDebuggerStatus(reason || 'Debugger: paused', 'ok');
  setTimeout(() => refreshDebuggerView({ activate: workbenchAppEl?.dataset.editorView === 'debugger' }), 0);
}

function scheduleDebuggerBreak(reason) {
  if (debuggerPendingBreak) return;
  debuggerPendingBreak = { reason };
  setTimeout(() => {
    const pending = debuggerPendingBreak;
    if (!pending) return;
    finishDebuggerBreak(pending.reason);
  }, 0);
}

const debuggerBreakpointPlugin = {
  name: 'Workbench Debugger Breakpoints',
  reset() {
    debuggerPendingBreak = null;
    debuggerRunConfig = null;
  },
  m1(pc, ir) {
    const result = debuggerBreakpointPlugin.edge_m1(pc, ir);
    if (!debuggerRunning || !debuggerRunConfig) return result;
    const runtime = globalThis.__qaop;
    const currentPc = pc & 0xFFFF;
    if (debuggerRunConfig.ignoreFirstPc === currentPc) {
      debuggerRunConfig.ignoreFirstPc = null;
      return result;
    }
    let reason = null;
    if (debuggerRunConfig.targetPc != null && currentPc === (debuggerRunConfig.targetPc & 0xFFFF)) {
      if (debuggerRunConfig.targetSp == null) {
        reason = `Debugger: reached 0x${formatWord(currentPc)}`;
      } else {
        const sp = runtime && runtime.cpuCore && runtime.cpuCore.getState ? (runtime.cpuCore.getState().sp & 0xFFFF) : null;
        if (sp === (debuggerRunConfig.targetSp & 0xFFFF)) {
          reason = `Debugger: reached 0x${formatWord(currentPc)}`;
        }
      }
    }
    if (!reason && debuggerBreakpoints.has(currentPc)) {
      reason = `Debugger: breakpoint at 0x${formatWord(currentPc)}`;
    }
    if (!reason) return result;
    if (runtime && runtime.machineBus) {
      runtime.machineBus.limit = runtime.machineBus.time;
    }
    scheduleDebuggerBreak(reason);
    return result;
  }
};

async function ensureDebuggerBreakpointPlugin() {
  await waitForQaop();
  if (debuggerBreakpointPluginInstalled) return;
  if (!(window.qaop && typeof window.qaop.plug === 'function')) {
    throw new Error('Qaop plugin API is not available.');
  }
  window.qaop.plug(debuggerBreakpointPlugin, 1);
  debuggerBreakpointPluginInstalled = true;
}

  function populateDisasmAddressFromPc() {
    const snapshot = captureSnapshotState();
    const pc = snapshot && typeof snapshot.pc === 'number' ? snapshot.pc & 0xFFFF : 0;
    disasmAddressEl.value = `0x${formatWord(pc)}`;
    return snapshot;
  }

  function refreshDisassembly(options) {
    const opts = options || {};
    try {
      const snapshot = opts.snapshot || captureSnapshotState();
      const start = opts.usePc
        ? (typeof snapshot.pc === 'number' ? snapshot.pc & 0xFFFF : 0)
        : parseAddress(disasmAddressEl.value, typeof snapshot.pc === 'number' ? snapshot.pc & 0xFFFF : 0);
      const lineCount = clamp(parseInt(disasmLinesEl.value || DISASM_DEFAULT_LINES, 10) || DISASM_DEFAULT_LINES, 1, 2048);
      disasmAddressEl.value = `0x${formatWord(start)}`;
      disasmLinesEl.value = String(lineCount);
      const memory = snapshotToMemory(snapshot);
      const text = buildDisassemblyText(memory, start, lineCount) || '; no disassembly output';
      setDisassemblyText(text);
      disasmMetaEl.textContent = `Snapshot PC 0x${formatWord(typeof snapshot.pc === 'number' ? snapshot.pc & 0xFFFF : 0)} • Start 0x${formatWord(start)} • ${lineCount} lines`;
      activateEditorTab('disasm');
    } catch (err) {
      setDisassemblyText(`; ${err.message || err}`);
      disasmMetaEl.textContent = 'Disassembly unavailable';
      activateEditorTab('disasm');
    }
  }

  function unpackFlags(byteValue) {
    const value = byteValue >>> 0;
    return {
      S: !!(value & 0x80),
      Z: !!(value & 0x40),
      Y: !!(value & 0x20),
      H: !!(value & 0x10),
      X: !!(value & 0x08),
      P: !!(value & 0x04),
      N: !!(value & 0x02),
      C: !!(value & 0x01)
    };
  }

  function buildPcAlignedDisassembly(memory, pc, totalLines) {
    const beforeCount = Math.max(8, Math.floor((totalLines - 1) * 0.45));
    const afterCount = Math.max(8, totalLines - beforeCount - 1);
    const cpu = createDisassemblerCpu(memory, 0);
    const history = [];
    let current = null;

    while (cpu.registers.PC < memory.length) {
      const line = disassembleNextLineObject(cpu, memory);
      if (!line) break;
      if (line.address === (pc & 0xFFFF)) {
        current = line;
        break;
      }
      history.push(line);
      if (history.length > beforeCount) history.shift();
      if (line.address > (pc & 0xFFFF)) break;
    }

    const lines = history.slice(-beforeCount);
    let currentIndex = lines.length - 1;
    if (current) {
      currentIndex = lines.length;
      lines.push(current);
      for (let i = 0; i < afterCount && cpu.registers.PC < memory.length; i++) {
        const line = disassembleNextLineObject(cpu, memory);
        if (!line) break;
        lines.push(line);
      }
    }

    return {
      lines,
      currentIndex,
      currentPc: pc & 0xFFFF,
      text: lines.map(line => line.formatted).join('\n'),
      addresses: lines.map(line => line.address)
    };
  }

  function debuggerMarkerForLine(lineNumber) {
    const address = debuggerLineAddresses[lineNumber];
    if (address == null) return null;
    const hasBreakpoint = debuggerBreakpoints.has(address);
    const isCurrent = lineNumber === debuggerCurrentLine;
    if (!hasBreakpoint && !isCurrent) return null;
    const marker = document.createElement('span');
    marker.className = 'cm-debug-marker' + (isCurrent ? ' is-current' : '');
    marker.textContent = isCurrent && hasBreakpoint ? '▶●' : isCurrent ? '▶' : '●';
    marker.title = isCurrent && hasBreakpoint ? 'Current PC, breakpoint' : isCurrent ? 'Current PC' : 'Breakpoint';
    return marker;
  }

  function applyDebuggerMarkers() {
    if (!debuggerEditor) return;
    debuggerEditor.clearGutter('cm-breakpoint-gutter');
    const lineCount = debuggerEditor.lineCount();
    for (let lineNumber = 0; lineNumber < lineCount; lineNumber++) {
      debuggerEditor.setGutterMarker(lineNumber, 'cm-breakpoint-gutter', debuggerMarkerForLine(lineNumber));
      debuggerEditor.removeLineClass(lineNumber, 'background', 'cm-current-pc-line');
    }
    if (debuggerCurrentLine >= 0 && debuggerCurrentLine < lineCount) {
      debuggerEditor.addLineClass(debuggerCurrentLine, 'background', 'cm-current-pc-line');
      debuggerEditor.setCursor({ line: debuggerCurrentLine, ch: 0 });
      debuggerEditor.scrollIntoView({ line: debuggerCurrentLine, ch: 0 }, 120);
    }
  }

  function setDebuggerStatus(text, kind) {
    debuggerStatusText = text;
    setStatus(debuggerStatusEl, text, kind);
  }

  function updateDebuggerButtons() {
    if (dbgContinueButtonEl) dbgContinueButtonEl.textContent = debuggerRunning ? 'Running…' : 'Continue';
    if (dbgContinueButtonEl) dbgContinueButtonEl.disabled = debuggerRunning;
    if (dbgBreakButtonEl) dbgBreakButtonEl.disabled = !debuggerRunning && !!(window.qaop && window.qaop.settings && window.qaop.settings.pause);
    if (dbgStepIntoButtonEl) dbgStepIntoButtonEl.disabled = debuggerRunning;
    if (dbgStepOverButtonEl) dbgStepOverButtonEl.disabled = debuggerRunning;
    if (dbgStepOutButtonEl) dbgStepOutButtonEl.disabled = debuggerRunning;
    if (dbgRunToCursorButtonEl) dbgRunToCursorButtonEl.disabled = debuggerRunning;
    if (dbgRestartButtonEl) dbgRestartButtonEl.disabled = debuggerRunning;
    if (dbgRefreshButtonEl) dbgRefreshButtonEl.disabled = debuggerRunning;
  }

  function renderRegisterState(snapshot) {
    if (!debuggerRegistersEl) return;
    if (!snapshot) { debuggerRegistersEl.innerHTML = ''; return; }
    const flags = unpackFlags(snapshot.f || 0);
    const flagsAlt = unpackFlags(snapshot.f_ || 0);
    const cards = [
      ['PC', formatWord(snapshot.pc || 0)],
      ['SP', formatWord(snapshot.sp || 0)],
      ['AF', `${formatByte(snapshot.a || 0)} ${formatByte(snapshot.f || 0)}`],
      ['BC', formatWord(snapshot.bc || 0)],
      ['DE', formatWord(snapshot.de || 0)],
      ['HL', formatWord(snapshot.hl || 0)],
      ['IX', formatWord(snapshot.ix || 0)],
      ['IY', formatWord(snapshot.iy || 0)],
      ["AF'", `${formatByte(snapshot.a_ || 0)} ${formatByte(snapshot.f_ || 0)}`],
      ["BC'", formatWord(snapshot.bc_ || 0)],
      ["DE'", formatWord(snapshot.de_ || 0)],
      ["HL'", formatWord(snapshot.hl_ || 0)],
      ['I', formatByte(snapshot.i || 0)],
      ['R', formatByte(snapshot.r || 0)],
      ['IM', String(snapshot.im == null ? 0 : snapshot.im)],
      ['IFF', String(snapshot.iff == null ? 0 : snapshot.iff)],
      ['WZ', formatWord(snapshot.wz || 0)],
      ['PX', String(snapshot.px || 0)],
      ['HALT', snapshot.halt ? 'yes' : 'no'],
      ['Flags', `S${+flags.S} Z${+flags.Z} H${+flags.H} P/V${+flags.P} N${+flags.N} C${+flags.C}`, 'reg-card--wide'],
      ["Flags'", `S${+flagsAlt.S} Z${+flagsAlt.Z} H${+flagsAlt.H} P/V${+flagsAlt.P} N${+flagsAlt.N} C${+flagsAlt.C}`, 'reg-card--wide']
    ];
    debuggerRegistersEl.innerHTML = cards.map(([label, value, extraClass]) => (
      `<div class="reg-card${extraClass ? ' ' + extraClass : ''}"><div class="reg-card__label">${escapeHtml(label)}</div><code class="reg-card__value">${escapeHtml(value)}</code></div>`
    )).join('');
  }

  function refreshDebuggerView(options = {}) {
    try {
      const snapshot = options.snapshot || captureSnapshotState();
      const pc = typeof snapshot.pc === 'number' ? snapshot.pc & 0xFFFF : 0;
      const memory = snapshotToMemory(snapshot);
      const lineCount = clamp(parseInt(dbgLinesEl?.value || DEBUG_DEFAULT_LINES, 10) || DEBUG_DEFAULT_LINES, 20, 400);
      if (dbgLinesEl) dbgLinesEl.value = String(lineCount);
      const view = buildPcAlignedDisassembly(memory, pc, lineCount);
      debuggerLineAddresses = view.addresses;
      debuggerCurrentLine = view.currentIndex;
      setDebuggerText(view.text || '; no debugger disassembly output');
      if (debuggerEditor) {
        debuggerEditor.refresh();
        applyDebuggerMarkers();
      }
      renderRegisterState(snapshot);
      disasmMetaEl.textContent = `PC 0x${formatWord(pc)} • ${lineCount} debugger lines • ${debuggerBreakpoints.size} breakpoint${debuggerBreakpoints.size === 1 ? '' : 's'}`;
      if (options.activate !== false) activateEditorTab('debugger');
      if (!debuggerRunning) setDebuggerStatus(`Debugger: paused at 0x${formatWord(pc)}`, 'ok');
      updateDebuggerButtons();
    } catch (err) {
      setDebuggerText(`; ${err.message || err}`);
      debuggerLineAddresses = [];
      debuggerCurrentLine = -1;
      renderRegisterState(null);
      setDebuggerStatus('Debugger unavailable', 'err');
      if (options.activate !== false) activateEditorTab('debugger');
    }
  }

  function toggleBreakpointAtAddress(address) {
    const normalized = (address >>> 0) & 0xFFFF;
    if (debuggerBreakpoints.has(normalized)) debuggerBreakpoints.delete(normalized);
    else debuggerBreakpoints.add(normalized);
    persistBreakpoints();
    applyDebuggerMarkers();
    setDebuggerStatus(`Breakpoint ${debuggerBreakpoints.has(normalized) ? 'set' : 'cleared'} at 0x${formatWord(normalized)}`, 'ok');
    disasmMetaEl.textContent = `PC ${debuggerCurrentLine >= 0 ? 'view active' : 'n/a'} • ${debuggerBreakpoints.size} breakpoint${debuggerBreakpoints.size === 1 ? '' : 's'}`;
  }

  function toggleBreakpointAtLine(lineNumber) {
    const address = debuggerLineAddresses[lineNumber];
    if (address == null) return;
    toggleBreakpointAtAddress(address);
  }

  function toggleBreakpointAtCursor() {
    if (!debuggerEditor) return;
    toggleBreakpointAtLine(debuggerEditor.getCursor().line);
  }

  function readLiveMemoryByte(address) {
    const runtime = globalThis.__qaop;
    if (!(runtime && typeof runtime.peekMemoryRaw === 'function')) throw new Error('Qaop live memory API is not available.');
    return runtime.peekMemoryRaw(address & 0xFFFF) & 0xFF;
  }

  function disassembleInstructionInfo(memory, address) {
    const cpu = createDisassemblerCpu(memory, address);
    const text = cpu.disassemble1() || 'db ?';
    const nextPc = cpu.registers.PC & 0xFFFF;
    return {
      text,
      nextPc,
      length: nextPc > (address & 0xFFFF) ? nextPc - (address & 0xFFFF) : 1
    };
  }

  function manualSingleStep(runtime) {
    const cpu = runtime.cpuCore;
    const bus = runtime.machineBus;
    if (runtime.flushPrefixCycles) runtime.flushPrefixCycles();
    const start = cpu.getState();
    const startPc = start.pc & 0xFFFF;
    const originalLimit = bus.limit;
    let guard = 0;
    try {
      do {
        bus.limit = bus.time + 1;
        cpu.run();
        guard += 1;
        const current = cpu.getState();
        if (!current.px && ((current.pc & 0xFFFF) !== startPc || current.halt !== start.halt || guard > 1)) break;
      } while (guard < 8);
    } finally {
      bus.limit = originalLimit;
    }
  }

async function stopDebuggerRun(reason = 'Debugger: break requested', options = {}) {
  debuggerRunToken += 1;
  debuggerRunning = false;
  debuggerRunConfig = null;
  debuggerPendingBreak = null;
  if (options.keepPaused !== false && window.qaop && typeof window.qaop.set === 'function') {
    window.qaop.set({ pause: true });
  }
  try {
    if (options.syncScreen !== false) syncLiveQaopStateToScreen();
    else queueUiSync();
  } catch (err) {
    queueUiSync();
  }
  updateDebuggerButtons();
  setDebuggerStatus(reason, 'ok');
  if (options.refresh !== false) setTimeout(() => refreshDebuggerView({ activate: workbenchAppEl?.dataset.editorView === 'debugger' }), 0);
}

async function continueDebugger(options = {}) {
  await ensureDebuggerBreakpointPlugin();
  await ensureDebuggerPaused();
  const runtime = getDebuggerRuntime();
  debuggerRunToken += 1;
  debuggerPendingBreak = null;
  debuggerRunConfig = {
    targetPc: options.targetPc == null ? null : (options.targetPc & 0xFFFF),
    targetSp: options.targetSp == null ? null : (options.targetSp & 0xFFFF),
    ignoreFirstPc: runtime.cpuCore.getState().pc & 0xFFFF
  };
  debuggerRunning = true;
  setDebuggerStatus('Debugger: running', 'ok');
  updateDebuggerButtons();
  if (window.qaop && typeof window.qaop.set === 'function') {
    window.qaop.set({ pause: false });
  }
  queueUiSync();
  focusEmulator();
}

  async function restartDebugger() {
    await waitForQaop();
    await stopDebuggerRun('Debugger: restart', { keepPaused: false, refresh: false });
    commandQaop('reset');
    setQaopSetting({ pause: true });
    setTimeout(() => refreshDebuggerView({ activate: workbenchAppEl?.dataset.editorView === 'debugger' }), 80);
  }

  async function stepDebuggerInto() {
    await ensureDebuggerPaused();
    manualSingleStep(getDebuggerRuntime());
    syncLiveQaopStateToScreen();
    refreshDebuggerView({ activate: workbenchAppEl?.dataset.editorView === 'debugger' });
  }

  async function stepDebuggerOver() {
    await ensureDebuggerPaused();
    const snapshot = captureSnapshotState();
    const memory = snapshotToMemory(snapshot);
    const pc = snapshot.pc & 0xFFFF;
    const info = disassembleInstructionInfo(memory, pc);
    if (/^(call|rst)\b/i.test(info.text)) {
      await continueDebugger({ targetPc: info.nextPc });
      return;
    }
    manualSingleStep(getDebuggerRuntime());
    syncLiveQaopStateToScreen();
    refreshDebuggerView({ activate: workbenchAppEl?.dataset.editorView === 'debugger' });
  }

  async function stepDebuggerOut() {
    await ensureDebuggerPaused();
    const runtime = getDebuggerRuntime();
    const state = runtime.cpuCore.getState();
    const startSp = state.sp & 0xFFFF;
    const targetPc = readLiveMemoryByte(startSp) | (readLiveMemoryByte(startSp + 1) << 8);
    await continueDebugger({ targetPc, targetSp: (startSp + 2) & 0xFFFF });
  }

  async function runDebuggerToCursor() {
    if (!debuggerEditor) return;
    const lineNumber = debuggerEditor.getCursor().line;
    const address = debuggerLineAddresses[lineNumber];
    if (address == null) return;
    await continueDebugger({ targetPc: address });
  }

  function normalizeModelValue(value) {
    const raw = String(value == null ? '' : value).toLowerCase();
    if (raw === '0' || raw === '48' || raw.includes('48')) return '48';
    if (raw === '1' || raw === '128' || raw.includes('128')) return '128';
    if (raw.includes('tc')) return 'tc2048';
    return '48';
  }

  function resolveTheme(choice) {
    if (choice === 'black' || choice === 'white') return choice;
    return themeMedia && !themeMedia.matches ? 'white' : 'black';
  }

  function applyTheme(choice, persist) {
    themeChoice = choice || 'auto';
    const resolved = resolveTheme(themeChoice);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-choice', themeChoice);
    if (themeSelectEl) themeSelectEl.value = themeChoice;
    if (persist) {
      try { localStorage.setItem(THEME_KEY, themeChoice); } catch (err) {}
    }
    sourceEditor?.refresh();
    disasmEditor?.refresh();
    debuggerEditor?.refresh();
    updateEmulatorViewport();
  }

  function initTheme() {
    let stored = 'auto';
    try {
      stored = localStorage.getItem(THEME_KEY) || 'auto';
    } catch (err) {
      stored = 'auto';
    }
    applyTheme(stored, false);
    if (themeMedia) {
      const listener = () => {
        if (themeChoice === 'auto') applyTheme('auto', false);
      };
      if (themeMedia.addEventListener) themeMedia.addEventListener('change', listener);
      else if (themeMedia.addListener) themeMedia.addListener(listener);
    }
  }

  function readUiState() {
    const api = window.qaop;
    return {
      state: api && typeof api.state === 'object' ? api.state : {},
      settings: api && typeof api.settings === 'object' ? api.settings : {}
    };
  }

  function syncEmulatorControls() {
    const { state, settings } = readUiState();
    const pauseState = !!settings.pause;
    if (pauseButtonEl) pauseButtonEl.textContent = pauseState ? 'Resume' : 'Pause';
    if (machineSelectEl) machineSelectEl.value = normalizeModelValue(state.model);
    if (ayToggleEl) ayToggleEl.checked = !!state.ay;
    if (kjToggleEl) kjToggleEl.checked = !!state.kj;
    if (if1ToggleEl) if1ToggleEl.checked = !!state.if1;
    if (crtToggleEl) crtToggleEl.checked = !!settings.crt;
    if (bwToggleEl) bwToggleEl.checked = !!settings.bw;
    if (muteToggleEl) muteToggleEl.checked = !!settings.mute;
    if (volumeEl) volumeEl.value = String(clamp(Math.round(((settings.volume == null ? 1 : settings.volume) * 100)), 0, 100));
    if (layoutButtonEl) layoutButtonEl.classList.toggle('secondary', document.documentElement.classList.contains('h'));
    if (lastObservedPauseState !== pauseState) {
      lastObservedPauseState = pauseState;
      if (pauseState && debuggerRunning) {
        debuggerRunning = false;
        debuggerRunConfig = null;
        debuggerPendingBreak = null;
        setDebuggerStatus('Debugger: paused', 'ok');
        setTimeout(() => refreshDebuggerView({ activate: workbenchAppEl?.dataset.editorView === 'debugger' }), 0);
      } else if (pauseState && workbenchAppEl?.dataset.editorView === 'debugger') {
        setTimeout(() => refreshDebuggerView({ activate: false }), 0);
      }
    }
    updateDebuggerButtons();
  }

  function queueUiSync() {
    clearTimeout(uiSyncTimer);
    uiSyncTimer = setTimeout(syncEmulatorControls, 40);
  }

  function withSnapshotStore(readonly, worker) {
    return new Promise((resolve, reject) => {
      const runtime = globalThis.__qaop;
      if (!(runtime && runtime.withSnapshotsStore && runtime.runIndexedDbRequest)) {
        reject(new Error('Snapshot storage API is not available.'));
        return;
      }
      try {
        runtime.withSnapshotsStore(store => worker(runtime, store, resolve, reject), !readonly);
      } catch (err) {
        reject(err);
      }
    });
  }

  async function listStoredSnapshots() {
    const rows = await withSnapshotStore(true, (runtime, store, resolve) => {
      runtime.runIndexedDbRequest(store, 'getAll', records => resolve(records || []));
    });
    return rows
      .filter(row => row && row.file && row.file.name)
      .sort((a, b) => (b.file.lastModified || 0) - (a.file.lastModified || 0) || String(a.file.name).localeCompare(String(b.file.name)));
  }

  function formatTimestamp(ms) {
    if (!ms) return 'unknown time';
    try {
      return new Date(ms).toLocaleString();
    } catch (err) {
      return String(ms);
    }
  }

  async function refreshSnapshotList() {
    if (!snapshotListEl) return;
    try {
      const rows = await listStoredSnapshots();
      if (!rows.length) {
        snapshotListEl.innerHTML = '<div class="snapshot-empty">No stored snapshots yet.</div>';
        return;
      }
      if (!selectedSnapshotName || !rows.some(row => row.file.name === selectedSnapshotName)) selectedSnapshotName = rows[0].file.name;
      snapshotListEl.innerHTML = '';
      for (const row of rows) {
        const name = row.file.name;
        const item = document.createElement('div');
        item.className = 'snapshot-item' + (name === selectedSnapshotName ? ' is-active' : '');
        item.setAttribute('role', 'listitem');

        const meta = document.createElement('div');
        meta.className = 'snapshot-item__meta';
        const title = document.createElement('div');
        title.className = 'snapshot-item__name';
        title.textContent = name;
        const details = document.createElement('div');
        details.className = 'snapshot-item__details';
        details.textContent = `${row.file.type || 'application/octet-stream'} • ${formatTimestamp(row.file.lastModified)}`;
        meta.append(title, details);

        const actions = document.createElement('div');
        actions.className = 'snapshot-item__actions';
        const loadButton = document.createElement('button');
        loadButton.textContent = 'Load';
        loadButton.addEventListener('click', () => loadStoredSnapshotByName(name).catch(err => setStatus(emulatorStatus, 'Snapshot error: ' + err.message, 'err')));
        const deleteButton = document.createElement('button');
        deleteButton.className = 'ghost';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteStoredSnapshot(name).catch(err => setStatus(emulatorStatus, 'Snapshot error: ' + err.message, 'err')));
        actions.append(loadButton, deleteButton);

        item.addEventListener('click', ev => {
          if (ev.target.closest('button')) return;
          selectedSnapshotName = name;
          refreshSnapshotList();
        });
        item.append(meta, actions);
        snapshotListEl.append(item);
      }
    } catch (err) {
      snapshotListEl.innerHTML = `<div class="snapshot-empty">${escapeHtml(err.message || String(err))}</div>`;
    }
  }

  async function loadStoredSnapshotByName(name) {
    const file = await withSnapshotStore(true, (runtime, store, resolve, reject) => {
      runtime.runIndexedDbRequest(store, 'get', name, record => {
        if (!record || !record.file) {
          reject(new Error(`Snapshot ${name} was not found`));
          return;
        }
        resolve(record.file);
      });
    });
    const api = await waitForQaop();
    await stopDebuggerRun('Debugger: snapshot loaded', { keepPaused: false, refresh: false });
    selectedSnapshotName = name;
    api.command('load', file);
    setStatus(emulatorStatus, `Emulator: loaded snapshot ${name}`, 'ok');
    queueUiSync();
    refreshSnapshotList();
    if (workbenchAppEl?.dataset.editorView === 'debugger') setTimeout(() => refreshDebuggerView({ activate: false }), 60);
    focusEmulator();
  }

  async function deleteStoredSnapshot(name) {
    const runtime = globalThis.__qaop;
    if (!(runtime && runtime.deleteSnapshotFromIndexedDb)) throw new Error('Snapshot deletion is not available.');
    runtime.deleteSnapshotFromIndexedDb(name);
    if (selectedSnapshotName === name) selectedSnapshotName = '';
    setStatus(emulatorStatus, `Snapshot ${name} deleted`, 'ok');
    await refreshSnapshotList();
  }

  async function createSnapshot() {
    const runtime = globalThis.__qaop;
    if (!(runtime && runtime.exportSnapshotOrScreen && runtime.saveSnapshotFileToStorage)) {
      throw new Error('Snapshot creation is not available.');
    }
    const api = await waitForQaop();
    const snapshotFile = runtime.exportSnapshotOrScreen('z80', api.state);
    const listItem = runtime.saveSnapshotFileToStorage(snapshotFile);
    selectedSnapshotName = listItem && listItem.textContent ? String(listItem.textContent).trim() : snapshotFile.name;
    setStatus(emulatorStatus, `Emulator: snapshot ${selectedSnapshotName} stored`, 'ok');
    await refreshSnapshotList();
  }

  function restoreSnapshotsPanelState() {
    if (!snapshotsPanelEl) return;
    let open = true;
    try {
      const raw = localStorage.getItem(SNAPSHOTS_OPEN_KEY);
      if (raw != null) open = raw !== '0';
    } catch (err) {}
    snapshotsPanelEl.open = open;
    snapshotsPanelEl.addEventListener('toggle', () => {
      try { localStorage.setItem(SNAPSHOTS_OPEN_KEY, snapshotsPanelEl.open ? '1' : '0'); } catch (err) {}
      updateEmulatorViewport();
    });
  }

  function setQaopSetting(partial) {
    if (window.qaop && typeof window.qaop.set === 'function') {
      window.qaop.set(partial);
      queueUiSync();
    }
  }

  function commandQaop(name, value) {
    if (!(window.qaop && typeof window.qaop.command === 'function')) return;
    if (value === undefined) window.qaop.command(name);
    else window.qaop.command(name, value);
    queueUiSync();
  }

  function wireUi() {
    document.getElementById('btnAssemble').addEventListener('click', () => compileCurrent());
    document.getElementById('btnRunSna').addEventListener('click', () => runBuild('sna').catch(err => setStatus(emulatorStatus, 'Emulator error: ' + err.message, 'err')));
    document.getElementById('btnRunTap').addEventListener('click', () => runBuild('tap').catch(err => setStatus(emulatorStatus, 'Emulator error: ' + err.message, 'err')));
    document.getElementById('btnDownloadSna').addEventListener('click', () => {
      const build = getBuild();
      if (build) downloadBytes(build.snaBytes, 'asm80.sna', 'application/x.zx.sna');
    });
    document.getElementById('btnDownloadTap').addEventListener('click', () => {
      const build = getBuild();
      if (build) downloadBytes(build.tapBytes, 'asm80.tap', 'application/x.zx.tap');
    });
    document.getElementById('btnCopyHex').addEventListener('click', () => copyHex().catch(err => setStatus(compileStatus, 'Clipboard error: ' + err.message, 'err')));
    document.getElementById('btnResetSource').addEventListener('click', () => {
      setSource(sampleSource());
      compileCurrent();
      activateEditorTab('source');
    });

    document.getElementById('btnRefreshDisasm').addEventListener('click', () => refreshDisassembly());
    document.getElementById('btnDisasmPc').addEventListener('click', () => {
      const snapshot = populateDisasmAddressFromPc();
      refreshDisassembly({ snapshot, usePc: true });
    });
    disasmAddressEl.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        refreshDisassembly();
      }
    });
    disasmLinesEl.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        refreshDisassembly();
      }
    });

    dbgContinueButtonEl?.addEventListener('click', () => continueDebugger().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err')));
    dbgBreakButtonEl?.addEventListener('click', () => stopDebuggerRun('Debugger: break requested').catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err')));
    dbgRestartButtonEl?.addEventListener('click', () => restartDebugger().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err')));
    dbgStepIntoButtonEl?.addEventListener('click', () => stepDebuggerInto().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err')));
    dbgStepOverButtonEl?.addEventListener('click', () => stepDebuggerOver().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err')));
    dbgStepOutButtonEl?.addEventListener('click', () => stepDebuggerOut().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err')));
    dbgRunToCursorButtonEl?.addEventListener('click', () => runDebuggerToCursor().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err')));
    dbgRefreshButtonEl?.addEventListener('click', () => refreshDebuggerView());
    dbgLinesEl?.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        refreshDebuggerView();
      }
    });

    pauseButtonEl.addEventListener('click', async () => {
      await waitForQaop();
      if (debuggerRunning) await stopDebuggerRun('Debugger: stopped', { keepPaused: false, refresh: false });
      commandQaop('pause');
      focusEmulator();
    });
    resetButtonEl.addEventListener('click', async () => {
      await waitForQaop();
      await stopDebuggerRun('Debugger: reset', { keepPaused: false, refresh: false });
      commandQaop('reset');
      if (workbenchAppEl?.dataset.editorView === 'debugger') setTimeout(() => refreshDebuggerView({ activate: false }), 80);
      focusEmulator();
    });
    openButtonEl.addEventListener('click', async () => {
      await waitForQaop();
      await stopDebuggerRun('Debugger: open', { keepPaused: false, refresh: false });
      commandQaop('open');
    });
    saveButtonEl.addEventListener('click', async () => {
      await waitForQaop();
      commandQaop('save');
    });
    machineSelectEl.addEventListener('change', async () => {
      await waitForQaop();
      await stopDebuggerRun('Debugger: machine changed', { keepPaused: false, refresh: false });
      commandQaop('model', machineSelectEl.value);
      focusEmulator();
    });
    ayToggleEl.addEventListener('change', async () => {
      await waitForQaop();
      commandQaop('ay', ayToggleEl.checked);
    });
    kjToggleEl.addEventListener('change', async () => {
      await waitForQaop();
      commandQaop('kj', kjToggleEl.checked);
    });
    if1ToggleEl.addEventListener('change', async () => {
      await waitForQaop();
      commandQaop('if1', if1ToggleEl.checked);
    });
    crtToggleEl.addEventListener('change', async () => {
      await waitForQaop();
      commandQaop('crt', crtToggleEl.checked);
    });
    bwToggleEl.addEventListener('change', async () => {
      await waitForQaop();
      commandQaop('bw', bwToggleEl.checked);
    });
    muteToggleEl.addEventListener('change', async () => {
      await waitForQaop();
      commandQaop('mute', muteToggleEl.checked);
    });
    volumeEl.addEventListener('input', async () => {
      await waitForQaop();
      const volume = clamp(parseInt(volumeEl.value || '0', 10) || 0, 0, 100) / 100;
      setQaopSetting({ volume, mute: muteToggleEl.checked && volume === 0 ? true : muteToggleEl.checked && volume > 0 ? false : muteToggleEl.checked });
      if (volume > 0 && muteToggleEl.checked) muteToggleEl.checked = false;
    });
    layoutButtonEl.addEventListener('click', async () => {
      await waitForQaop();
      commandQaop('layout');
      focusEmulator();
    });
    themeSelectEl.addEventListener('change', () => applyTheme(themeSelectEl.value, true));

    snapshotCreateButtonEl.addEventListener('click', () => createSnapshot().catch(err => setStatus(emulatorStatus, 'Snapshot error: ' + err.message, 'err')));
    snapshotRefreshButtonEl.addEventListener('click', () => refreshSnapshotList().catch(err => setStatus(emulatorStatus, 'Snapshot error: ' + err.message, 'err')));

    document.querySelectorAll('.wb-tab').forEach(btn => btn.addEventListener('click', () => activateBottomTab(btn.dataset.tab)));
    document.querySelectorAll('.wb-editor-tab').forEach(btn => btn.addEventListener('click', () => activateEditorTab(btn.dataset.editorTab)));

    window.addEventListener('keydown', ev => {
      const typingIntoWorkbench = !!(ev.target && (ev.target.closest('.CodeMirror') || ev.target.closest('#workbenchApp')));
      const editorView = workbenchAppEl?.dataset.editorView || 'source';
      if (!typingIntoWorkbench) return;

      if (editorView === 'debugger') {
        if (ev.key === 'F5' && ev.shiftKey) {
          ev.preventDefault();
          stopDebuggerRun('Debugger: break requested').catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err'));
          return;
        }
        if (ev.key === 'F5') {
          ev.preventDefault();
          continueDebugger().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err'));
          return;
        }
        if (ev.key === 'F10' && ev.ctrlKey) {
          ev.preventDefault();
          runDebuggerToCursor().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err'));
          return;
        }
        if (ev.key === 'F10') {
          ev.preventDefault();
          stepDebuggerOver().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err'));
          return;
        }
        if (ev.key === 'F11' && ev.shiftKey) {
          ev.preventDefault();
          stepDebuggerOut().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err'));
          return;
        }
        if (ev.key === 'F11') {
          ev.preventDefault();
          stepDebuggerInto().catch(err => setDebuggerStatus('Debugger error: ' + err.message, 'err'));
          return;
        }
        if (ev.key === 'F9') {
          ev.preventDefault();
          toggleBreakpointAtCursor();
          return;
        }
        if (ev.key === 'F6') {
          ev.preventDefault();
          refreshDebuggerView();
          return;
        }
      }

      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        compileCurrent();
      } else if (ev.key === 'F5' && ev.shiftKey) {
        ev.preventDefault();
        runBuild('tap').catch(err => setStatus(emulatorStatus, 'Emulator error: ' + err.message, 'err'));
      } else if (ev.key === 'F5') {
        ev.preventDefault();
        runBuild('sna').catch(err => setStatus(emulatorStatus, 'Emulator error: ' + err.message, 'err'));
      } else if (ev.key === 'F6') {
        ev.preventDefault();
        if (editorView === 'disasm') refreshDisassembly();
        else refreshDebuggerView();
      }
    });
  }

  initTheme();
  configureKeyboardImage();
  ensureCodeMirror();
  loadSource();
  wireUi();
  restoreSnapshotsPanelState();
  setupSplitter();
  setupViewportObserver();
  updateDebuggerButtons();

  waitForQaop().then(() => {
    syncEmulatorControls();
    ensureDebuggerBreakpointPlugin().catch(() => {});
    refreshSnapshotList().catch(() => {});
    try {
      populateDisasmAddressFromPc();
      refreshDisassembly();
      refreshDebuggerView({ activate: false });
    } catch (err) {
      disasmMetaEl.textContent = 'Disassembly unavailable until the emulator is ready';
    }
    setInterval(syncEmulatorControls, 250);
  }).catch(() => {});

  compileCurrent();
})();
