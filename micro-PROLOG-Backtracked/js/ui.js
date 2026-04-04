(function (root) {
  'use strict';

  function install() {
    if (typeof document === 'undefined') return;
    const CR = root && root.MicroPrologCleanRoomPrototype;
    const SpectrumAdapter = CR && CR.SpectrumAdapter ? CR.SpectrumAdapter : (root && root.MicroPrologCleanRoomSpectrumAdapter);
    if (!CR || !CR.Shell || !CR.Workspace || !CR.TranscriptProfiles || !SpectrumAdapter) {
      console.error('Clean-room browser UI requires MicroPrologCleanRoomPrototype and MicroPrologCleanRoomSpectrumAdapter.');
      return;
    }

    const els = {
      replTranscript: document.getElementById('replTranscript'),
      replInput: document.getElementById('replInput'),
      replPrompt: document.querySelector('.zx-input-line .zx-prompt'),
      replInlineTail: document.getElementById('replInlineTail'),
      runReplInput: document.getElementById('runReplInput'),
      editorSource: document.getElementById('editorSource'),
      runEditorSource: document.getElementById('runEditorSource'),
      saveEditorSource: document.getElementById('saveEditorSource'),
      themeMode: document.getElementById('themeMode'),
      editorStatus: document.getElementById('editorStatus'),
      replInitFromSimple: document.getElementById('replInitFromSimple'),
      replClearTranscript: document.getElementById('replClearTranscript'),
      replDisplayMode: document.getElementById('replDisplayMode'),
      spectrumScreenPanel: document.getElementById('spectrumScreenPanel'),
      spectrumGraphicsCanvas: document.getElementById('spectrumGraphicsCanvas'),
      spectrumTextCanvas: document.getElementById('spectrumTextCanvas'),
      spectrumScreenMeta: document.getElementById('spectrumScreenMeta'),
      toggleReplFont: document.getElementById('toggleReplFont'),
      replBreak: document.getElementById('replBreak'),
      replStatus: document.getElementById('replStatus'),
      fileList: document.getElementById('fileList'),
      fileListSummary: document.getElementById('fileListSummary'),
      selectedFileMeta: document.getElementById('selectedFileMeta'),
      replInitFromSelectedFile: document.getElementById('replInitFromSelectedFile'),
      importWorkspaceFiles: document.getElementById('importWorkspaceFiles'),
      importFileInput: document.getElementById('importFileInput'),
      downloadSelectedFile: document.getElementById('downloadSelectedFile'),
      deleteSelectedFile: document.getElementById('deleteSelectedFile'),
      fileDropZone: document.getElementById('fileDropZone'),
      toggleSidebar: document.getElementById('toggleSidebar'),
      clauseList: document.getElementById('clauseList'),
      clauseViewerSummary: document.getElementById('clauseViewerSummary'),
      clauseModuleSelect: document.getElementById('clauseModuleSelect'),
      tabButtons: Array.prototype.slice.call(document.querySelectorAll('[data-tab]')),
      tabPanels: Array.prototype.slice.call(document.querySelectorAll('[data-tab-panel]')),
    };
    if (!els.replInput || !els.replTranscript) return;

    const BUNDLED_FILES = [
      'utilities/deftrap.pl',
      'utilities/editor.pl',
      'utilities/errtrap.pl',
      'utilities/exptran.pl',
      'utilities/micro.pl',
      'utilities/micshow.pl',
      'utilities/modules.pl',
      'utilities/program.pl',
      'utilities/simple.pl',
      'utilities/simshow.pl',
      'utilities/simtrace.pl',
      'utilities/spytrace.pl',
      'utilities/told.pl',
      'utilities/trace.pl'
    ];
    const MAX_STEPS = 15000;
    const MAX_SOLUTIONS = 30;
    const FONT_COOKIE_KEY = 'microprolog-program293-repl-font';
    const LIBRARY_HIDDEN_KEY = 'microprolog-program293-library-hidden';
    const FILE_CACHE_KEY = 'microprolog-program293-cleanroom-files';
    const REPL_HISTORY_KEY = 'microprolog-program293-cleanroom-repl-history';
    const EDITOR_SOURCE_KEY = 'microprolog-program293-editor-source';
    const EDITOR_FILE_NAME_KEY = 'microprolog-program293-editor-file-name';
    const THEME_MODE_KEY = 'microprolog-program293-theme-mode';
    const SUPERVISOR_COMMAND_NAMES = new Set(['LIST', 'ADDCL', 'DELCL', 'KILL', 'LOAD', 'SAVE', 'NEW', 'CRMOD', 'OPMOD', 'CLMOD', 'CLS', 'QT', 'IS', 'WHICH', 'ONE', 'ALL']);

    const state = {
      files: new Map(),
      fileStore: Object.create(null),
      selectedFileKey: null,
      session: null,
      transcriptLines: [],
      boringFont: readCookie(FONT_COOKIE_KEY) === 'normal',
      libraryHidden: readStorageFlag(LIBRARY_HIDDEN_KEY),
      selectedClauseModuleName: null,
      statusText: 'Clean-room kernel ready.',
      outputMode: 'normal',
      textOnlyAdapter: SpectrumAdapter.createTextOnlyAdapter(),
      spectrumAdapter: null,
      uiBridge: null,
      replHistory: [],
      replHistoryIndex: null,
      replHistoryDraft: '',
      editorSource: '',
      editorFileName: 'source.pl',
      themeMode: 'system',
      resolvedThemeMode: 'light',
      audioContext: null,
    };


    function getAudioContext() {
      const AudioCtor = root.AudioContext || root.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!state.audioContext) {
        try {
          state.audioContext = new AudioCtor();
        } catch (err) {
          state.audioContext = null;
        }
      }
      if (state.audioContext && state.audioContext.state === 'suspended' && typeof state.audioContext.resume === 'function') {
        state.audioContext.resume().catch(function () {});
      }
      return state.audioContext;
    }

    function playBeepFromBuiltin(payload) {
      const ctx = getAudioContext();
      const cycles = Math.max(1, Number(payload && payload.cycles) || 0);
      const durationValue = Math.max(0, Number(payload && payload.duration) || 0);
      const seconds = Math.max(0.03, Math.min(4, (durationValue * 300000) / cycles / 1000));
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(cycles, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.06, now + Math.min(0.02, seconds / 3));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + seconds + 0.02);
      } catch (err) {}
    }

    function readCookie(name) {
      const pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
      const match = document.cookie.match(pattern);
      return match ? decodeURIComponent(match[1]) : null;
    }

    function writeCookie(name, value) {
      document.cookie = name + '=' + encodeURIComponent(String(value)) + '; path=/; max-age=31536000; SameSite=Lax';
    }

    function readStorageFlag(key) {
      try {
        return root.localStorage && root.localStorage.getItem(key) === '1';
      } catch (err) {
        return false;
      }
    }

    function loadThemeMode() {
      try {
        if (!root.localStorage) return 'system';
        const stored = String(root.localStorage.getItem(THEME_MODE_KEY) || '').trim().toLowerCase();
        return stored === 'light' || stored === 'dark' ? stored : 'system';
      } catch (err) {
        return 'system';
      }
    }

    function persistThemeMode() {
      try {
        if (!root.localStorage) return;
        root.localStorage.setItem(THEME_MODE_KEY, String(state.themeMode || 'system'));
      } catch (err) {}
    }

    function systemPrefersDark() {
      try {
        return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
      } catch (err) {
        return false;
      }
    }

    function resolveThemeMode(mode) {
      const normalized = mode === 'light' || mode === 'dark' ? mode : 'system';
      return normalized === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : normalized;
    }

    function safeLoadHistory() {
      try {
        if (!root.localStorage) return [];
        const raw = root.localStorage.getItem(REPL_HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(function (item) { return String(item || '').trim(); }).filter(Boolean).slice(-500) : [];
      } catch (err) {
        return [];
      }
    }

    function persistReplHistory() {
      try {
        if (!root.localStorage) return;
        root.localStorage.setItem(REPL_HISTORY_KEY, JSON.stringify((state.replHistory || []).slice(-500)));
      } catch (err) {}
    }

    function shouldUseTextareaHistoryNavigation(value, selectionStart, selectionEnd, direction) {
      if (selectionStart !== selectionEnd) return false;
      const text = String(value || '');
      const start = Math.max(0, Math.min(text.length, Number(selectionStart) || 0));
      if (direction < 0) return text.slice(0, start).indexOf('\n') === -1;
      return text.slice(start).indexOf('\n') === -1;
    }

    function navigateReplHistory(history, historyIndex, historyDraft, currentInput, direction) {
      const items = Array.isArray(history) ? history : [];
      if (!items.length) return { historyIndex: historyIndex, historyDraft: historyDraft, nextInput: currentInput, changed: false };
      if (direction < 0) {
        if (historyIndex === null || historyIndex === undefined) {
          return { historyIndex: items.length - 1, historyDraft: currentInput, nextInput: items[items.length - 1], changed: true };
        }
        const nextIndex = Math.max(0, historyIndex - 1);
        return { historyIndex: nextIndex, historyDraft: historyDraft, nextInput: items[nextIndex], changed: nextIndex !== historyIndex };
      }
      if (historyIndex === null || historyIndex === undefined) {
        return { historyIndex: historyIndex, historyDraft: historyDraft, nextInput: currentInput, changed: false };
      }
      const nextIndex = historyIndex + 1;
      if (nextIndex >= items.length) {
        return { historyIndex: null, historyDraft: historyDraft, nextInput: historyDraft || '', changed: true };
      }
      return { historyIndex: nextIndex, historyDraft: historyDraft, nextInput: items[nextIndex], changed: true };
    }

    function appendReplHistoryEntry(history, entry, maxEntries) {
      const items = Array.isArray(history) ? history.slice() : [];
      const trimmed = String(entry || '').trim();
      if (!trimmed) return items;
      if (items.length && items[items.length - 1] === trimmed) return items;
      items.push(trimmed);
      const limit = Number.isInteger(maxEntries) && maxEntries > 0 ? maxEntries : 500;
      if (items.length > limit) return items.slice(items.length - limit);
      return items;
    }

    function setReplInputValue(value) {
      if (!els.replInput) return;
      els.replInput.value = String(value || '');
      try {
        const end = els.replInput.value.length;
        els.replInput.setSelectionRange(end, end);
      } catch (err) {}
    }


    function loadEditorFileName() {
      try {
        if (!root.localStorage) return 'source.pl';
        const stored = String(root.localStorage.getItem(EDITOR_FILE_NAME_KEY) || '').trim();
        return stored || 'source.pl';
      } catch (err) {
        return 'source.pl';
      }
    }

    function persistEditorFileName() {
      try {
        if (!root.localStorage) return;
        root.localStorage.setItem(EDITOR_FILE_NAME_KEY, String(state.editorFileName || 'source.pl'));
      } catch (err) {}
    }

    function normalizeEditorFileName(value) {
      let fileName = String(value || '').trim();
      if (!fileName) fileName = 'source.pl';
      if (!/\.[A-Za-z0-9_-]+$/.test(fileName)) fileName += '.pl';
      return fileName;
    }

    function setEditorFileName(value) {
      state.editorFileName = normalizeEditorFileName(value);
      persistEditorFileName();
    }

    function loadEditorSource() {
      try {
        if (!root.localStorage) return '';
        return String(root.localStorage.getItem(EDITOR_SOURCE_KEY) || '');
      } catch (err) {
        return '';
      }
    }

    function persistEditorSource() {
      try {
        if (!root.localStorage) return;
        root.localStorage.setItem(EDITOR_SOURCE_KEY, String(state.editorSource || ''));
      } catch (err) {}
    }

    function setEditorSourceValue(value) {
      state.editorSource = String(value || '');
      if (els.editorSource && els.editorSource.value !== state.editorSource) {
        els.editorSource.value = state.editorSource;
      }
      persistEditorSource();
      renderEditorStatus();
    }

    function renderEditorStatus(message) {
      if (!els.editorStatus) return;
      const text = message || ('Editor file: ' + normalizeEditorFileName(state.editorFileName) + '. Cached in browser storage. Press Ctrl+Enter to run.');
      els.editorStatus.textContent = text;
    }

    function loadCachedUserFiles() {
      try {
        if (!root.localStorage) return [];
        const raw = root.localStorage.getItem(FILE_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }

    function persistCachedUserFiles() {
      try {
        if (!root.localStorage) return;
        const payload = [];
        state.files.forEach(function (record) {
          if (!record || record.readOnly) return;
          payload.push({ key: record.key, name: record.name, text: record.text || '' });
        });
        root.localStorage.setItem(FILE_CACHE_KEY, JSON.stringify(payload));
      } catch (err) {}
    }

    function normalizeLoadKey(name) {
      const raw = String(name || '').trim();
      if (!raw) return '';
      const leaf = raw.split(/[\/]/).slice(-1)[0];
      return leaf.replace(/\.[^.]+$/, '').toUpperCase();
    }

    function normalizeTextForLoad(record, text) {
      return String(text || '');
    }

    function ensureStoredFileRecord(fileName, fileText) {
      const key = normalizeLoadKey(fileName);
      if (!key) return null;
      const existingKey = Array.from(state.files.keys()).find(function (candidateKey) {
        const record = state.files.get(candidateKey);
        return record && !record.readOnly && normalizeLoadKey(record.name || record.key || '') === key;
      });
      const recordKey = existingKey || ('user/' + key + '.pl');
      const record = {
        key: recordKey,
        name: key + '.pl',
        text: String(fileText || ''),
        readOnly: false,
        bundled: false,
      };
      state.files.set(recordKey, record);
      state.selectedFileKey = recordKey;
      return record;
    }

    function registerLoadedRecord(record, text) {
      if (!record) return;
      const normalizedText = normalizeTextForLoad(record, text);
      const aliases = new Set();
      [record.name, record.key, record.path].forEach(function (value) {
        const alias = normalizeLoadKey(value || '');
        if (alias) aliases.add(alias);
      });
      aliases.forEach(function (alias) {
        state.fileStore[alias] = normalizedText;
      });
    }

    function storeNamedFile(fileName, fileText) {
      const key = normalizeLoadKey(fileName);
      if (!key) return;
      const text = String(fileText || '');
      state.fileStore[key] = text;
      const record = ensureStoredFileRecord(fileName, text);
      if (record) registerLoadedRecord(record, text);
      persistCachedUserFiles();
      renderFileList();
      renderSelectedFileMeta();
    }

    function isBundledLibraryAlias(key) {
      const alias = normalizeLoadKey(key);
      if (!alias) return false;
      let matched = false;
      state.files.forEach(function (record) {
        if (matched || !record || !record.readOnly) return;
        const recordAlias = normalizeLoadKey(record.name || record.key || record.path || '');
        if (recordAlias === alias) matched = true;
      });
      return matched;
    }

    function syncUserFilesFromFileStore() {
      Object.keys(state.fileStore).forEach(function (key) {
        if (!key || isBundledLibraryAlias(key)) return;
        const text = String(state.fileStore[key] || '');
        const record = ensureStoredFileRecord(key, text);
        if (record) registerLoadedRecord(record, text);
      });
      persistCachedUserFiles();
      renderFileList();
      renderSelectedFileMeta();
    }

    function setOutputMode(mode, statusText) {
      state.outputMode = mode === 'hybrid' ? 'hybrid' : 'normal';
      renderSpectrumScreen();
      if (statusText) {
        state.statusText = statusText;
        renderStatus();
      }
    }

    function runLoadCommand(loadKey, statusText) {
      if (!loadKey) return;
      switchTab('repl');
      runCompiledEntries('LOAD ' + loadKey, statusText || ('Loaded ' + loadKey + '.'));
    }

    function rebuildUiBridge() {
      state.uiBridge = {
        readNamedFile: function (fileName) {
          const key = normalizeLoadKey(fileName);
          return Object.prototype.hasOwnProperty.call(state.fileStore, key) ? state.fileStore[key] : undefined;
        },
        writeNamedFile: function (fileName, fileText) {
          storeNamedFile(fileName, fileText);
        },
        handleOutput: function (text, meta) {
          let response = null;
          [state.textOnlyAdapter, state.spectrumAdapter].forEach(function (adapter) {
            if (!adapter || typeof adapter.handleOutput !== 'function') return;
            const next = adapter.handleOutput(text, meta || {});
            if (response == null && next != null) response = next;
          });
          if (String(name || '').toUpperCase() === 'HYBRID') state.outputMode = 'hybrid';
          if (String(name || '').toUpperCase() === 'NORMAL') state.outputMode = 'normal';
          renderSpectrumScreen();
          return response;
        },
        handleBuiltin: function (name, args, meta) {
          let response = null;
          [state.textOnlyAdapter, state.spectrumAdapter].forEach(function (adapter) {
            if (!adapter || typeof adapter.handleBuiltin !== 'function') return;
            const next = adapter.handleBuiltin(name, args || [], meta || {});
            if (response == null && next != null) response = next;
          });
          if (String(name || '').toUpperCase() === 'HYBRID') state.outputMode = 'hybrid';
          if (String(name || '').toUpperCase() === 'NORMAL') state.outputMode = 'normal';
          renderSpectrumScreen();
          return response;
        },
      };
    }

    state.spectrumAdapter = SpectrumAdapter.createSpectrumAdapter({ onBeep: playBeepFromBuiltin });

    function createSession(workspaceText) {
      if (!state.uiBridge) rebuildUiBridge();
      return CR.Shell.createSessionState(String(workspaceText || ''), {
        maxSteps: MAX_STEPS,
        maxSolutions: MAX_SOLUTIONS,
        transcriptProfile: CR.TranscriptProfiles.historicalProfile(),
        fileStore: state.fileStore,
        uiEffects: state.uiBridge,
      });
    }

    function resetSession(workspaceText, statusText) {
      state.textOnlyAdapter.reset();
      state.spectrumAdapter.reset();
      state.session = createSession(workspaceText);
      state.selectedClauseModuleName = null;
      state.transcriptLines = [];
      state.statusText = statusText || 'Clean-room kernel ready.';
      renderTranscript();
      renderClauseViewer();
      renderSpectrumScreen();
      renderStatus();
    }

    function initializeFileCatalog() {
      BUNDLED_FILES.forEach(function (path) {
        state.files.set(path, {
          key: path,
          name: path.split('/').slice(-1)[0],
          path: path,
          text: null,
          readOnly: true,
          bundled: true,
        });
      });
      loadCachedUserFiles().forEach(function (record) {
        if (!record || !record.key) return;
        state.files.set(record.key, {
          key: record.key,
          name: record.name || record.key,
          text: String(record.text || ''),
          readOnly: false,
          bundled: false,
        });
      });
      state.files.forEach(function (record) {
        if (typeof record.text === 'string') registerLoadedRecord(record, record.text);
      });
      if (!state.selectedFileKey || !state.files.has(state.selectedFileKey)) {
        state.selectedFileKey = BUNDLED_FILES[0] || null;
      }
    }

    function ensureFileText(record) {
      if (!record) return Promise.resolve('');
      if (typeof record.text === 'string') return Promise.resolve(record.text);
      if (record.loadingPromise) return record.loadingPromise;
      if (!record.path) return Promise.resolve('');
      record.loadingPromise = fetch(record.path)
        .then(function (response) {
          if (!response.ok) throw new Error('Could not load ' + record.path + '.');
          return response.text();
        })
        .then(function (text) {
          record.text = String(text || '');
          record.loadingPromise = null;
          registerLoadedRecord(record, record.text);
          renderFileList();
          renderSelectedFileMeta();
          return record.text;
        })
        .catch(function (err) {
          record.loadingPromise = null;
          throw err;
        });
      return record.loadingPromise;
    }

    function preloadBundledFiles() {
      return Promise.all(BUNDLED_FILES.map(function (path) {
        return ensureFileText(state.files.get(path));
      }));
    }

    function selectedFileRecord() {
      return state.selectedFileKey ? state.files.get(state.selectedFileKey) || null : null;
    }

    function sessionModuleName() {
      if (!state.session || !state.session.workspace) return null;
      const current = CR.Workspace.currentModule(state.session.workspace);
      return current && current.name ? current.name : null;
    }

    function appendTranscript(lines) {
      const items = Array.isArray(lines) ? lines.slice() : [];
      if (!items.length) return;
      if (CR && CR.TranscriptProfiles && typeof CR.TranscriptProfiles.mergeHistoricalTranscriptChunks === 'function') {
        state.transcriptLines = CR.TranscriptProfiles.mergeHistoricalTranscriptChunks([state.transcriptLines, items]);
      } else {
        state.transcriptLines = state.transcriptLines.concat(items);
      }
      renderTranscript();
    }


    function appendErrorTranscript(err) {
      appendTranscript(['Error: ' + (err && err.message ? err.message : String(err)), '']);
    }

    function sanitizeTranscriptLine(line) {
      return String(line == null ? '' : line).replace(/\u0008/g, '');
    }

    function transcriptTailText() {
      if (!state.transcriptLines.length) return '';
      return sanitizeTranscriptLine(state.transcriptLines[state.transcriptLines.length - 1]);
    }

    function transcriptVisibleLines() {
      if (!state.transcriptLines.length) return [];
      return state.transcriptLines.slice(0, -1).map(sanitizeTranscriptLine);
    }

    function renderTranscript() {
      els.replTranscript.textContent = transcriptVisibleLines().join('\n');
      if (els.replInlineTail) els.replInlineTail.textContent = transcriptTailText() || activePromptText();
      els.replTranscript.scrollTop = els.replTranscript.scrollHeight;
    }

    function renderSpectrumScreen() {
      if (!els.spectrumScreenPanel || !state.spectrumAdapter) return;
      const active = state.outputMode === 'hybrid';
      els.spectrumScreenPanel.classList.toggle('active', active);
      if (els.replDisplayMode && els.replDisplayMode.value !== state.outputMode) {
        els.replDisplayMode.value = state.outputMode;
      }
      state.spectrumAdapter.renderToCanvases(els.spectrumGraphicsCanvas, els.spectrumTextCanvas);
      const screenState = state.spectrumAdapter.getState();
      const frame = els.spectrumGraphicsCanvas && els.spectrumGraphicsCanvas.parentElement;
      if (frame && screenState) {
        const borderCss = SpectrumAdapter.colourCss ? SpectrumAdapter.colourCss(screenState.borderColour, 0) : null;
        const paperCss = SpectrumAdapter.colourCss ? SpectrumAdapter.colourCss(screenState.activeAttrs && screenState.activeAttrs.paper, screenState.activeAttrs && screenState.activeAttrs.bright) : null;
        if (borderCss) frame.style.borderColor = borderCss;
        if (paperCss) frame.style.background = paperCss;
      }
      if (els.spectrumScreenMeta && screenState) {
        els.spectrumScreenMeta.textContent = [
          'Mode: ' + String(screenState.displayMode || 'normal'),
          'Cursor: ' + String(screenState.cursorRow) + ',' + String(screenState.cursorCol),
          'Border: ' + String(screenState.borderColour),
          'Graphics points: ' + String(screenState.graphicsCount || 0)
        ].join(' · ');
      }
    }

    function activePromptText() {
      if (state.session && state.session.pendingAnswers) return '&?';
      if (state.session && state.session.pendingInput) return '&?';
      if (state.session && state.session.pendingTopLevelContinuation) {
        if (state.session.pendingTopLevelContinuation.reason === 'unclosed-parentheses') {
          return String(Math.max(1, Number(state.session.pendingTopLevelContinuation.depth) || 1)) + '.';
        }
        return '.';
      }
      return '&.';
    }

    function updatePrompt() {
      if (els.replPrompt) els.replPrompt.textContent = '';
      if (els.replInlineTail) els.replInlineTail.textContent = transcriptTailText() || activePromptText();
    }

    function renderStatus(extra) {
      const parts = [state.statusText || ''];
      const moduleName = sessionModuleName();
      if (moduleName) parts.push('Module: ' + moduleName);
      parts.push('Output: ' + (state.outputMode === 'hybrid' ? 'Hybrid' : 'Normal') + '.');
      if (state.session && state.session.pendingInput) parts.push('Awaiting input term.');
      else if (state.session && state.session.pendingAnswers) parts.push('Awaiting y/n.');
      else parts.push('Supervisor input.');
      if (extra) parts.push(extra);
      els.replStatus.textContent = parts.filter(Boolean).join(' ');
      updatePrompt();
    }

    function clauseViewerModuleNames() {
      if (!state.session || !state.session.workspace) return [];
      return Object.keys(state.session.workspace.modulesByName || {}).sort(function (left, right) {
        if (left === state.session.workspace.rootModuleName) return -1;
        if (right === state.session.workspace.rootModuleName) return 1;
        return String(left).localeCompare(String(right));
      });
    }

    function selectedClauseModuleRecord() {
      if (!state.session || !state.session.workspace) return null;
      const workspace = state.session.workspace;
      const currentModule = CR.Workspace.currentModule(workspace);
      const moduleNames = clauseViewerModuleNames();
      const fallbackName = currentModule && currentModule.name ? currentModule.name : workspace.rootModuleName;
      const preferredName = state.selectedClauseModuleName && workspace.modulesByName[state.selectedClauseModuleName]
        ? state.selectedClauseModuleName
        : fallbackName;
      if (moduleNames.indexOf(preferredName) === -1) return null;
      state.selectedClauseModuleName = preferredName;
      return workspace.modulesByName[preferredName] || null;
    }

    function renderClauseModuleSelect() {
      if (!els.clauseModuleSelect) return;
      els.clauseModuleSelect.innerHTML = '';
      if (!state.session || !state.session.workspace) {
        els.clauseModuleSelect.disabled = true;
        return;
      }
      const moduleNames = clauseViewerModuleNames();
      const currentModule = CR.Workspace.currentModule(state.session.workspace);
      const selectedModule = selectedClauseModuleRecord();
      moduleNames.forEach(function (moduleName) {
        const option = document.createElement('option');
        option.value = moduleName;
        option.textContent = moduleName === currentModule.name ? moduleName + ' (current)' : moduleName;
        if (selectedModule && selectedModule.name === moduleName) option.selected = true;
        els.clauseModuleSelect.appendChild(option);
      });
      els.clauseModuleSelect.disabled = moduleNames.length <= 1;
    }

    function renderClauseViewer() {
      if (!els.clauseList || !els.clauseViewerSummary) return;
      els.clauseList.innerHTML = '';
      renderClauseModuleSelect();
      if (!state.session || !state.session.workspace) {
        els.clauseViewerSummary.textContent = 'No current system loaded.';
        return;
      }
      const currentModule = CR.Workspace.currentModule(state.session.workspace);
      const selectedModule = selectedClauseModuleRecord();
      const clauses = selectedModule ? selectedModule.clauses.slice() : [];
      const derivedCount = CR.Workspace.listDerivedClauses(state.session.workspace).length;
      const moduleLabel = selectedModule ? selectedModule.name : currentModule.name;
      const currentNote = selectedModule && selectedModule.name !== currentModule.name
        ? ' Current module remains ' + currentModule.name + '.'
        : '';
      els.clauseViewerSummary.textContent = 'Showing module: ' + moduleLabel + '. User clauses: ' + clauses.length + '. Derived support clauses: ' + derivedCount + '.' + currentNote;
      clauses.forEach(function (clause) {
        const item = document.createElement('div');
        item.className = 'clause-item';
        const body = document.createElement('div');
        body.className = 'clause-body';
        body.textContent = CR.Workspace.renderHistoricalClauseLines(clause).join('\n');
        item.appendChild(body);
        els.clauseList.appendChild(item);
      });
    }

    function renderFileList() {
      if (!els.fileList) return;
      const records = Array.from(state.files.values()).sort(function (a, b) {
        if (!!a.readOnly !== !!b.readOnly) return a.readOnly ? -1 : 1;
        return String(a.key).localeCompare(String(b.key));
      });
      els.fileList.innerHTML = '';
      records.forEach(function (record) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'file-item' + (record.key === state.selectedFileKey ? ' active' : '');
        button.addEventListener('click', function () {
          state.selectedFileKey = record.key;
          renderFileList();
          renderSelectedFileMeta();
          updateFileButtons();
        });
        button.addEventListener('dblclick', function () {
          state.selectedFileKey = record.key;
          renderFileList();
          renderSelectedFileMeta();
          updateFileButtons();
          openRecordInEditor(record);
        });

        const header = document.createElement('div');
        header.className = 'file-item-header';
        const name = document.createElement('span');
        name.className = 'file-item-name';
        name.textContent = record.name;
        const badge = document.createElement('span');
        badge.className = 'file-badge' + (record.readOnly ? ' readonly' : '');
        badge.textContent = record.readOnly ? 'bundled' : 'user';
        header.appendChild(name);
        header.appendChild(badge);

        const meta = document.createElement('div');
        meta.className = 'file-item-meta';
        const keyEl = document.createElement('span');
        keyEl.className = 'file-item-key';
        keyEl.textContent = record.key;
        const status = document.createElement('span');
        status.className = 'muted';
        status.textContent = typeof record.text === 'string' ? (record.text.split(/\r?\n/).length + ' lines') : 'not loaded';
        meta.appendChild(keyEl);
        meta.appendChild(status);

        button.appendChild(header);
        button.appendChild(meta);
        els.fileList.appendChild(button);
      });
      if (els.fileListSummary) {
        const count = records.length;
        els.fileListSummary.textContent = count + ' file' + (count === 1 ? '' : 's') + ' available.';
      }
      renderSelectedFileMeta();
      updateFileButtons();
    }

    function renderSelectedFileMeta() {
      if (!els.selectedFileMeta) return;
      const record = selectedFileRecord();
      if (!record) {
        els.selectedFileMeta.textContent = 'No file selected.';
        return;
      }
      const details = [record.name, record.readOnly ? 'bundled' : 'user'];
      if (typeof record.text === 'string') details.push(record.text.split(/\r?\n/).length + ' lines');
      else details.push('text not loaded yet');
      details.push('LOAD name: ' + normalizeLoadKey(record.name || record.key || record.path || ''));
      els.selectedFileMeta.textContent = details.join(' · ');
    }

    function updateFileButtons() {
      const record = selectedFileRecord();
      if (els.replInitFromSelectedFile) els.replInitFromSelectedFile.disabled = !record;
      if (els.downloadSelectedFile) els.downloadSelectedFile.disabled = !record;
      if (els.deleteSelectedFile) els.deleteSelectedFile.disabled = !record || !!record.readOnly;
      if (els.downloadUserZip) els.downloadUserZip.disabled = true;
      if (els.importZipBundle) els.importZipBundle.disabled = true;
      if (els.importZipInput) els.importZipInput.disabled = true;
    }

    function switchTab(name) {
      els.tabButtons.forEach(function (button) {
        const active = button.getAttribute('data-tab') === name;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      els.tabPanels.forEach(function (panel) {
        panel.classList.toggle('active', panel.getAttribute('data-tab-panel') === name);
      });
    }

    function switchToEditorTab(focusEditor) {
      switchTab('editor');
      if (focusEditor && els.editorSource && typeof els.editorSource.focus === 'function') {
        els.editorSource.focus();
      }
    }

    function applyThemeMode() {
      state.resolvedThemeMode = resolveThemeMode(state.themeMode);
      if (document && document.documentElement) {
        document.documentElement.setAttribute('data-theme-resolved', state.resolvedThemeMode);
        document.documentElement.setAttribute('data-theme-mode', state.themeMode || 'system');
      }
      if (els.themeMode) els.themeMode.value = state.themeMode || 'system';
      persistThemeMode();
    }

    function setThemeMode(value) {
      const next = value === 'light' || value === 'dark' ? value : 'system';
      state.themeMode = next;
      applyThemeMode();
    }

    function applySidebarVisibility() {
      document.body.classList.toggle('library-hidden', !!state.libraryHidden);
      if (els.toggleSidebar) els.toggleSidebar.textContent = state.libraryHidden ? 'Show library' : 'Hide library';
      try {
        if (root.localStorage) root.localStorage.setItem(LIBRARY_HIDDEN_KEY, state.libraryHidden ? '1' : '0');
      } catch (err) {}
    }

    function applyFontMode() {
      document.documentElement.style.setProperty('--terminal-font-current', state.boringFont ? 'var(--terminal-font-normal)' : 'var(--terminal-font-zx)');
      if (document && document.body) {
        document.body.classList.toggle('repl-font-normal', !!state.boringFont);
      }
      if (els.toggleReplFont) els.toggleReplFont.textContent = state.boringFont ? 'Use ZX style' : 'Use boring style';
      writeCookie(FONT_COOKIE_KEY, state.boringFont ? 'normal' : 'zx');
    }

    function linesFromText(text) {
      return String(text || '').replace(/\r\n?/g, '\n').split('\n');
    }

    function looksLikeSupervisorInput(text) {
      const lines = linesFromText(text).map(function (line) { return line.trim(); }).filter(Boolean);
      if (!lines.length) return false;
      return lines.every(function (line) {
        const firstToken = (line.match(/^([^\s.()]+)/) || [null, ''])[1].toUpperCase();
        return SUPERVISOR_COMMAND_NAMES.has(firstToken);
      });
    }

    function looksLikeClauseSource(text) {
      return /^\s*\(\(/.test(String(text || ''));
    }

    function compileEntriesFromSubmission(text) {
      return String(text || '').trim();
    }

    function runCompiledEntries(textOrEntries, statusText) {
      const result = CR.Shell.executeHistoricalCommands(state.session, textOrEntries, {
        maxSteps: MAX_STEPS,
        maxSolutions: MAX_SOLUTIONS,
        transcriptProfile: CR.TranscriptProfiles.historicalProfile(),
      });
      appendTranscript(result.transcriptLines);
      state.statusText = statusText || ('Executed ' + result.entries.length + ' command' + (result.entries.length === 1 ? '' : 's') + '.');
      renderClauseViewer();
      renderSpectrumScreen();
      renderStatus();
      syncUserFilesFromFileStore();
      return result;
    }


    function saveEditorAsFile() {
      const source = String((els.editorSource && els.editorSource.value) || state.editorSource || '');
      setEditorSourceValue(source);
      const proposed = root.prompt('Save editor content as file name:', normalizeEditorFileName(state.editorFileName));
      if (proposed == null) {
        renderEditorStatus('Save cancelled.');
        return;
      }
      let fileName = String(proposed || '').trim();
      if (!fileName) {
        renderEditorStatus('Save cancelled: file name is empty.');
        return;
      }
      fileName = normalizeEditorFileName(fileName);
      setEditorFileName(fileName);
      storeNamedFile(fileName, source);
      renderEditorStatus('Saved editor content as ' + fileName + '.');
      state.statusText = 'Saved ' + fileName + ' to browser file storage.';
      renderStatus();
    }

    function runEditorSource() {
      const source = String((els.editorSource && els.editorSource.value) || state.editorSource || '');
      setEditorSourceValue(source);
      switchTab('repl');
      resetSession('', 'Started a fresh micro-PROLOG session from editor source.');
      if (!source.trim()) {
        state.statusText = 'Editor is empty.';
        renderStatus();
        renderEditorStatus('Nothing to run: editor is empty.');
        return;
      }
      try {
        runCompiledEntries(compileEntriesFromSubmission(source), 'Executed editor source.');
        renderEditorStatus('Editor source executed.');
        if (state.session && state.session.pendingInput) {
          setReplInputValue(state.session.pendingInputBufferText || '');
        } else {
          setReplInputValue('');
        }
        if (els.replInput && typeof els.replInput.focus === 'function') els.replInput.focus();
      } catch (err) {
        state.statusText = 'Editor execution stopped after an error.';
        appendErrorTranscript(err);
        renderStatus();
        renderEditorStatus('Editor run stopped: ' + (err && err.message ? err.message : String(err)));
      }
    }

    function runSubmission() {
      const rawInput = String(els.replInput.value || '');
      const trimmed = rawInput.trim();
      if (!trimmed) return;
      try {
        const submissionText = compileEntriesFromSubmission(trimmed);
        if (!submissionText) return;
        runCompiledEntries(submissionText);
        state.replHistory = appendReplHistoryEntry(state.replHistory, rawInput, 500);
        state.replHistoryIndex = null;
        state.replHistoryDraft = '';
        persistReplHistory();
        if (state.session && state.session.pendingInput) {
          setReplInputValue(state.session.pendingInputBufferText || '');
          if (els.replInput && typeof els.replInput.focus === 'function') {
            els.replInput.focus();
          }
        } else {
          setReplInputValue('');
        }
      } catch (err) {
        state.statusText = 'Execution failed.';
        appendErrorTranscript(err);
        renderStatus();
      }
    }

    function openRecordInEditor(record) {
      if (!record) return;
      ensureFileText(record).then(function (text) {
        setEditorSourceValue(text);
        setEditorFileName(record.name || record.key || 'source.pl');
        switchTab('editor');
        renderEditorStatus('Opened ' + normalizeEditorFileName(state.editorFileName) + ' in the editor.');
        state.statusText = 'Opened ' + record.name + ' in the editor.';
        renderStatus();
        if (els.editorSource && typeof els.editorSource.focus === 'function') els.editorSource.focus();
      }).catch(function (err) {
        appendErrorTranscript(err);
        state.statusText = 'Could not open selected file in editor.';
        renderStatus();
      });
    }

    function loadSelectedFile() {
      const record = selectedFileRecord();
      if (!record) return;
      ensureFileText(record).then(function (text) {
        registerLoadedRecord(record, text);
        const loadKey = normalizeLoadKey(record.name || record.key || record.path || '');
        runLoadCommand(loadKey, 'Loaded ' + loadKey + '.');
      }).catch(function (err) {
        state.statusText = 'Could not load selected file.';
        appendErrorTranscript(err);
        renderStatus();
      });
    }

    function loadSimpleBundle() {
      const record = state.files.get('utilities/simple.pl');
      if (!record) return;
      state.selectedFileKey = record.key;
      renderFileList();
      ensureFileText(record).then(function (text) {
        registerLoadedRecord(record, text);
        runLoadCommand('SIMPLE', 'Loaded SIMPLE.');
      }).catch(function (err) {
        state.statusText = 'Could not load SIMPLE.';
        appendErrorTranscript(err);
        renderStatus();
      });
    }

    function importTextFiles(fileList) {
      const files = Array.prototype.slice.call(fileList || []);
      if (!files.length) return;
      Promise.all(files.map(function (file) {
        return file.text().then(function (text) {
          const key = 'user/' + file.name;
          const loadedText = String(text || '');
          state.files.set(key, {
            key: key,
            name: file.name,
            text: loadedText,
            readOnly: false,
            bundled: false,
          });
          registerLoadedRecord(state.files.get(key), loadedText);
          state.selectedFileKey = key;
        });
      })).then(function () {
        persistCachedUserFiles();
        renderFileList();
        state.statusText = 'Imported ' + files.length + ' file' + (files.length === 1 ? '' : 's') + '.';
        renderStatus();
      }).catch(function (err) {
        appendErrorTranscript(err);
        state.statusText = 'File import failed.';
        renderStatus();
      });
    }

    function downloadTextFile(filename, text) {
      const blob = new Blob([String(text || '')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    }

    function deleteSelectedFile() {
      const record = selectedFileRecord();
      if (!record || record.readOnly) return;
      [record.name, record.key, record.path].forEach(function (value) {
        const alias = normalizeLoadKey(value || '');
        if (alias && Object.prototype.hasOwnProperty.call(state.fileStore, alias)) delete state.fileStore[alias];
      });
      state.files.delete(record.key);
      state.selectedFileKey = BUNDLED_FILES[0] || Array.from(state.files.keys())[0] || null;
      persistCachedUserFiles();
      renderFileList();
      state.statusText = 'Deleted ' + record.name + '.';
      renderStatus();
    }

    function wireEvents() {

      if (els.runEditorSource) els.runEditorSource.addEventListener('click', runEditorSource);
      if (els.saveEditorSource) els.saveEditorSource.addEventListener('click', saveEditorAsFile);
      if (els.editorSource) {
        els.editorSource.addEventListener('input', function () {
          setEditorSourceValue(els.editorSource.value);
        });
        els.editorSource.addEventListener('keydown', function (event) {
          if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
            event.preventDefault();
            const start = els.editorSource.selectionStart;
            const end = els.editorSource.selectionEnd;
            const value = els.editorSource.value;
            const nextValue = value.slice(0, start) + '	' + value.slice(end);
            els.editorSource.value = nextValue;
            els.editorSource.selectionStart = els.editorSource.selectionEnd = start + 1;
            setEditorSourceValue(nextValue);
            return;
          }
          if (event.key === 'Enter' && event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing) {
            event.preventDefault();
            runEditorSource();
          }
        });
      }
      els.runReplInput.addEventListener('click', runSubmission);
      els.replInput.addEventListener('keydown', function (event) {
        if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
          event.preventDefault();
          switchToEditorTab(true);
          return;
        }
        if (event.key === 'ArrowUp' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
          if (!shouldUseTextareaHistoryNavigation(els.replInput.value, els.replInput.selectionStart, els.replInput.selectionEnd, -1)) return;
          const next = navigateReplHistory(state.replHistory, state.replHistoryIndex, state.replHistoryDraft, els.replInput.value, -1);
          if (!next.changed) return;
          event.preventDefault();
          state.replHistoryIndex = next.historyIndex;
          state.replHistoryDraft = next.historyDraft;
          setReplInputValue(next.nextInput);
          return;
        }
        if (event.key === 'ArrowDown' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
          if (!shouldUseTextareaHistoryNavigation(els.replInput.value, els.replInput.selectionStart, els.replInput.selectionEnd, 1)) return;
          const next = navigateReplHistory(state.replHistory, state.replHistoryIndex, state.replHistoryDraft, els.replInput.value, 1);
          if (!next.changed) return;
          event.preventDefault();
          state.replHistoryIndex = next.historyIndex;
          state.replHistoryDraft = next.historyDraft;
          setReplInputValue(next.nextInput);
          return;
        }
        if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing) {
          event.preventDefault();
          runSubmission();
        }
      });
      els.replInitFromSimple.addEventListener('click', loadSimpleBundle);
      if (els.replInitFromSelectedFile) {
        els.replInitFromSelectedFile.addEventListener('click', loadSelectedFile);
      }
      els.replClearTranscript.addEventListener('click', function () {
        state.transcriptLines = [];
        renderTranscript();
        renderSpectrumScreen();
        state.statusText = 'Transcript cleared.';
        renderStatus();
      });
      els.toggleReplFont.addEventListener('click', function () {
        state.boringFont = !state.boringFont;
        applyFontMode();
      });
      if (els.replDisplayMode) {
        els.replDisplayMode.addEventListener('change', function (event) {
          const mode = event && event.target ? String(event.target.value || 'normal') : 'normal';
          setOutputMode(mode, mode === 'hybrid' ? 'Hybrid output enabled.' : 'Normal output enabled.');
        });
      }
      if (els.toggleSidebar) {
        els.toggleSidebar.addEventListener('click', function () {
          state.libraryHidden = !state.libraryHidden;
          applySidebarVisibility();
        });
      }
      if (els.importWorkspaceFiles && els.importFileInput) {
        els.importWorkspaceFiles.addEventListener('click', function () {
          els.importFileInput.click();
        });
        els.importFileInput.addEventListener('change', function (event) {
          importTextFiles(event.target.files);
          event.target.value = '';
        });
      }
      els.downloadSelectedFile.addEventListener('click', function () {
        const record = selectedFileRecord();
        if (!record) return;
        ensureFileText(record).then(function (text) {
          downloadTextFile(record.name, text);
        }).catch(function (err) {
          appendErrorTranscript(err);
          state.statusText = 'Download failed.';
          renderStatus();
        });
      });
      els.deleteSelectedFile.addEventListener('click', deleteSelectedFile);
      if (els.fileDropZone) {
        ['dragenter', 'dragover'].forEach(function (eventName) {
          els.fileDropZone.addEventListener(eventName, function (event) {
            event.preventDefault();
            els.fileDropZone.classList.add('active');
          });
        });
        ['dragleave', 'drop'].forEach(function (eventName) {
          els.fileDropZone.addEventListener(eventName, function (event) {
            event.preventDefault();
            if (eventName === 'drop') importTextFiles(event.dataTransfer && event.dataTransfer.files);
            els.fileDropZone.classList.remove('active');
          });
        });
      }
      els.tabButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          switchTab(button.getAttribute('data-tab'));
        });
      });
      if (els.replBreak) {
        els.replBreak.disabled = true;
        els.replBreak.title = 'The clean-room browser UI runs synchronously; break is unavailable.';
      }
      if (els.clauseModuleSelect) {
        els.clauseModuleSelect.addEventListener('change', function () {
          state.selectedClauseModuleName = els.clauseModuleSelect.value || null;
          renderClauseViewer();
        });
      }
      if (els.themeMode) {
        els.themeMode.addEventListener('change', function () {
          setThemeMode(els.themeMode.value || 'system');
        });
      }
      try {
        if (root.matchMedia) {
          const media = root.matchMedia('(prefers-color-scheme: dark)');
          const handleThemeMediaChange = function () {
            if (state.themeMode === 'system') applyThemeMode();
          };
          if (typeof media.addEventListener === 'function') media.addEventListener('change', handleThemeMediaChange);
          else if (typeof media.addListener === 'function') media.addListener(handleThemeMediaChange);
        }
      } catch (err) {}
    }

    state.replHistory = safeLoadHistory();
    state.editorSource = loadEditorSource();
    state.editorFileName = loadEditorFileName();
    state.themeMode = loadThemeMode();

    initializeFileCatalog();
    rebuildUiBridge();
    wireEvents();
    applyThemeMode();
    applySidebarVisibility();
    applyFontMode();
    renderFileList();
    setEditorSourceValue(state.editorSource);
    renderSpectrumScreen();
    resetSession('', 'Started an empty micro-PROLOG session.');
    preloadBundledFiles().then(function () {
      state.statusText = 'Bundled files ready.';
      renderStatus();
      renderSelectedFileMeta();
    }).catch(function (err) {
      state.statusText = 'Bundled file preload failed.';
      appendErrorTranscript(err);
      renderStatus();
    });
    switchTab('repl');
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : this);
