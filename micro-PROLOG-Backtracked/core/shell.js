(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./terms'),
      require('./workspace'),
      require('./loader'),
      require('./reader'),
      require('./lexer'),
      require('./engine'),
      require('./transcript_profiles')
    );
  } else {
    root.MicroPrologCleanRoomShell = factory(
      root.MicroPrologCleanRoomTerms,
      root.MicroPrologCleanRoomWorkspace,
      root.MicroPrologCleanRoomLoader,
      root.MicroPrologCleanRoomReader,
      root.MicroPrologCleanRoomLexer,
      root.MicroPrologCleanRoomEngine,
      root.MicroPrologCleanRoomTranscriptProfiles
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Terms, Workspace, Loader, Reader, Lexer, Engine, TranscriptProfiles) {
  'use strict';

  if (!Terms || !Workspace || !Loader || !Reader || !Lexer || !Engine || !TranscriptProfiles) {
    throw new Error('shell.js requires terms.js, workspace.js, loader.js, reader.js, lexer.js, engine.js, and transcript_profiles.js.');
  }

  function normalizeSessionOptions(options) {
    const sessionOptions = Object.assign({ maxSteps: 1000, maxSolutions: 20 }, options || {});
    sessionOptions.transcriptProfile = TranscriptProfiles.normalizeProfile(sessionOptions.transcriptProfile);
    return sessionOptions;
  }

  function profileFor(state, options) {
    if (options && options.transcriptProfile) {
      return TranscriptProfiles.normalizeProfile(options.transcriptProfile);
    }
    if (state && state.transcriptProfile) {
      return state.transcriptProfile;
    }
    if (state && state.options && state.options.transcriptProfile) {
      return TranscriptProfiles.normalizeProfile(state.options.transcriptProfile);
    }
    return TranscriptProfiles.normalizeProfile();
  }


  function historicalUnclosedParenDepth(text) {
    let depth = 0;
    let inString = false;
    const src = String(text || '');
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (inString) {
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '(') depth += 1;
      else if (ch === ')') depth = Math.max(0, depth - 1);
    }
    return depth;
  }

  function historicalInputTextNeedsContinuation(text) {
    return historicalUnclosedParenDepth(text) > 0;
  }

  function historicalizeBodyLines(profile, bodyLines) {
    const lines = asLineArray(bodyLines);
    return lines.map(function (line) {
      if (/^Error: \d+$/.test(String(line)) && profile && profile.name === 'historical') {
        return String(line).replace(/^Error: /, 'Error:  ');
      }
      return String(line);
    });
  }

  function formatTranscriptLines(state, entry, bodyLines, context, options) {
    const profile = profileFor(state, options);
    const commandLines = profile.renderCommandEcho(entry, state, context || {});
    const renderedBodyLines = historicalizeBodyLines(profile, bodyLines);
    const afterLines = asLineArray(profile.renderAfterCommand(entry, state, context || {}));
    const NONL = '\u0001NONL:';
    if (renderedBodyLines.length && renderedBodyLines[renderedBodyLines.length - 1].indexOf(NONL) === 0) {
      renderedBodyLines[renderedBodyLines.length - 1] = renderedBodyLines[renderedBodyLines.length - 1].slice(NONL.length);
      if (profile && profile.name === 'historical' && afterLines.length) {
        renderedBodyLines[renderedBodyLines.length - 1] += afterLines[0];
        return asLineArray(commandLines).concat(renderedBodyLines).concat(afterLines.slice(1));
      }
    }
    return asLineArray(commandLines).concat(renderedBodyLines).concat(afterLines);
  }

  function asLineArray(lines) {
    return Array.isArray(lines) ? lines.slice() : (lines == null ? [] : [String(lines)]);
  }

  function createSessionState(workspaceOrText, options) {
    let workspace = workspaceOrText;
    if (typeof workspaceOrText === 'string') {
      workspace = Loader.loadHistoricalWorkspaceFromText(workspaceOrText).workspace;
    }
    if (!workspace) {
      workspace = Workspace.createWorkspace();
      Workspace.installDerivedSupport(workspace);
    }
    const sessionOptions = normalizeSessionOptions(options);
    return {
      workspace: workspace,
      options: sessionOptions,
      transcriptProfile: sessionOptions.transcriptProfile,
      history: [],
      inputBuffer: [],
      pendingAnswers: null,
      pendingInput: null,
      pendingInputBufferText: '',
      pendingTopLevelContinuation: null,
      quit: false,
      topLevelModuleName: workspace.rootModuleName,
      moduleEditTargetName: null,
    };
  }

  function splitHistoricalTopLevelForms(text) {
    const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const forms = [];
    let buffer = [];
    let depth = 0;

    function flush() {
      const formText = buffer.join('\n').trim();
      if (formText) forms.push(formText);
      buffer = [];
      depth = 0;
    }

    lines.forEach(function (line) {
      if (!buffer.length && !String(line || '').trim()) return;
      buffer.push(line);
      for (let index = 0; index < line.length; index += 1) {
        const ch = line.charAt(index);
        if (ch === '(') depth += 1;
        if (ch === ')') depth -= 1;
      }
      if (depth <= 0) flush();
    });

    if (buffer.length) flush();
    return forms;
  }

  function applyEntryDisplayText(entry, options) {
    if (options && options.displayText != null) {
      entry.displayText = String(options.displayText);
    }
    return entry;
  }

  function normalizeHistoricalQueryGoals(goals) {
    const goalList = Array.isArray(goals) ? goals.slice() : [];
    const firstGoal = goalList[0];
    if (firstGoal && firstGoal.tag === 'Struct' && firstGoal.name === 'NEW' && (firstGoal.args.length === 0 || firstGoal.args.length === 1)) {
      return [firstGoal];
    }
    return goalList;
  }

  function compileHistoricalQueryEntry(sourceText, options) {
    const parsedForm = Reader.parseHistoricalGoalListText(sourceText);
    const entry = {
      sourceText: sourceText,
      kind: 'historical_query',
      form: normalizeHistoricalQueryGoals(parsedForm),
      topLevelSurface: 'explicit',
    };
    if (options && Array.isArray(options.inputBuffer) && options.inputBuffer.length) {
      entry.inputBuffer = options.inputBuffer.slice();
    }
    return applyEntryDisplayText(entry, options);
  }

  function compileHistoricalClauseEntry(sourceText, options) {
    const parsedEntries = Reader.parseHistoricalSourceText(sourceText);
    if (parsedEntries.length !== 1 || parsedEntries[0].kind !== 'clause') {
      throw new Error('Expected exactly one historical clause form.');
    }
    return applyEntryDisplayText({
      sourceText: sourceText,
      kind: 'historical_clause',
      form: parsedEntries[0].clause,
    }, options);
  }

  function compileMoreAnswerEntry(sourceText, options) {
    const decision = String(sourceText || '').trim().toLowerCase();
    if (decision !== 'y' && decision !== 'n') {
      throw new Error('Expected more-answer decision y or n.');
    }
    return applyEntryDisplayText({
      sourceText: sourceText,
      kind: 'more_answer',
      form: { decision: decision },
    }, options);
  }

  function compileInputReplyEntry(sourceText, options) {
    const text = String(sourceText || '');
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Expected at least one historical input term.');
    }
    if (/^\?/.test(trimmed)) {
      throw new Error('Expected eof but found (');
    }
    const terms = Reader.parseHistoricalTermsText(trimmed);
    if (!Array.isArray(terms) || terms.length === 0) {
      throw new Error('Expected at least one historical input term.');
    }
    return applyEntryDisplayText({
      sourceText: sourceText,
      kind: 'input_reply',
      form: { term: terms[0], terms: terms },
    }, options);
  }

  function compileHistoricalTopLevelContinuationBlankEntry(sourceText, options) {
    return applyEntryDisplayText({
      sourceText: sourceText,
      kind: 'historical_continuation_blank',
      form: null,
      continuationLine: true,
    }, options);
  }

  function compileHistoricalParenContinuationOpenEntry(sourceText, depth, options) {
    return applyEntryDisplayText({
      sourceText: sourceText,
      kind: 'historical_paren_continuation_open',
      form: {
        headText: sourceText,
        reason: 'unclosed-parentheses',
        joiner: '\n',
        depth: Math.max(1, Number(depth) || 1)
      },
    }, options);
  }

  function topLevelContinuationCandidateInfo(trimmed, state) {
    const text = String(trimmed || '').trim();
    if (!text || /^\(/.test(text)) return null;
    let terms;
    try {
      terms = Reader.parseHistoricalTermsText(text);
    } catch (error) {
      return null;
    }
    if (!Array.isArray(terms) || terms.length !== 1) return null;
    const head = Terms.deref(terms[0]);
    if (!head || head.tag !== 'Sym') return null;
    const headName = String(head.name || '');
    const workspace = compileWorkspaceForState(state);
    if (isHistoricalSpecialSupervisorCommandName(headName)) return null;
    if (isHistoricalQueryStyleCommandName(headName)) return null;
    if (headName === 'ALL') return null;
    if (hasVisibleRelationArity(workspace, headName, 1)) {
      return { headText: headName, reason: 'visible-arity-1' };
    }
    if (hasVisibleRelationArity(workspace, headName, 0)) return null;
    return { headText: headName, reason: 'unresolved-symbol-head' };
  }

  function parseHistoricalSupervisorCommandSource(sourceText) {
    const trimmed = String(sourceText || '').trim();
    if (!trimmed) throw new Error('Expected a historical supervisor command.');
    const terms = Reader.parseHistoricalTermsText(trimmed);
    if (!terms.length) {
      throw new Error('Expected a historical supervisor command.');
    }
    const commandHead = Terms.deref(terms[0]);
    if (!commandHead || commandHead.tag !== 'Sym') {
      throw new Error('Expected a historical supervisor command.');
    }
    return {
      commandName: commandHead.name,
      args: terms.slice(1),
    };
  }

  function compileHistoricalSupervisorCommandEntry(sourceText, options) {
    const parsed = parseHistoricalSupervisorCommandSource(sourceText);
    return applyEntryDisplayText({
      sourceText: sourceText,
      kind: 'historical_supervisor_command',
      commandName: String(parsed.commandName || '').trim().toUpperCase(),
      commandArgs: parsed.args,
    }, options);
  }

  function resolveCompilerContext(stateOrOptions, maybeOptions) {
    const looksLikeState = stateOrOptions && typeof stateOrOptions === 'object' && (
      Object.prototype.hasOwnProperty.call(stateOrOptions, 'workspace')
      || Object.prototype.hasOwnProperty.call(stateOrOptions, 'pendingAnswers')
      || Object.prototype.hasOwnProperty.call(stateOrOptions, 'pendingInput')
    );
    return {
      state: looksLikeState ? stateOrOptions : null,
      options: looksLikeState ? (maybeOptions || {}) : (stateOrOptions || maybeOptions || {}),
    };
  }

  function compileWorkspaceForState(state) {
    if (!state) {
      const workspace = Workspace.createWorkspace();
      Workspace.installDerivedSupport(workspace);
      return workspace;
    }
    return state.workspace || state;
  }

  function isSymbolNamed(term, name) {
    const value = Terms.deref(term);
    return !!value && value.tag === 'Sym' && value.name === name;
  }

  const HISTORICAL_SPECIAL_SUPERVISOR_COMMAND_NAMES = Object.create(null);
  ['NEW', 'CRMOD', 'OPMOD', 'CLMOD'].forEach(function (name) {
    HISTORICAL_SPECIAL_SUPERVISOR_COMMAND_NAMES[name] = true;
  });

  const HISTORICAL_QUERY_STYLE_COMMAND_NAMES = Object.create(null);
  [
    'ADDCL', 'DELCL', 'KILL', 'LISTP', 'CMOD', 'HYBRID', 'NORMAL', 'CLS',
    'SAVE', 'LOAD', 'TO', 'LIST', 'CREATE', 'OPEN', 'READ', 'WRITE', 'W', 'CLOSE'
  ].forEach(function (name) {
    HISTORICAL_QUERY_STYLE_COMMAND_NAMES[name] = true;
  });

  function isHistoricalSpecialSupervisorCommandName(name) {
    return !!HISTORICAL_SPECIAL_SUPERVISOR_COMMAND_NAMES[String(name || '')];
  }

  function isHistoricalQueryStyleCommandName(name) {
    return !!HISTORICAL_QUERY_STYLE_COMMAND_NAMES[String(name || '')];
  }

  function hasVisibleRelationArity(workspace, name, arity) {
    if (Engine.isSupportedPrimitiveArity && Engine.isSupportedPrimitiveArity(name, arity)) return true;
    if (!workspace || !Workspace.hasAccessibleRelationArity) return false;
    return Workspace.hasAccessibleRelationArity(workspace, name, arity);
  }

  function hasVisibleRelationSignature(workspace, signature) {
    return !!(workspace && workspace.index && workspace.index[String(signature || '')] && workspace.index[String(signature || '')].length);
  }

  function compileHistoricalQueryGoalsEntry(goals, sourceText, options) {
    return applyEntryDisplayText({
      sourceText: sourceText,
      kind: 'historical_query',
      form: normalizeHistoricalQueryGoals(goals),
      topLevelSurface: 'bare',
    }, options);
  }

  function compileTopLevelSurfaceEntry(sourceText, stateOrOptions, maybeOptions) {
    const resolved = resolveCompilerContext(stateOrOptions, maybeOptions);
    const state = resolved.state;
    const options = resolved.options || {};
    const rawText = String(sourceText || '');
    const trimmed = rawText.trim();

    if (state && state.pendingTopLevelContinuation) {
      if (!trimmed) {
        return compileHistoricalTopLevelContinuationBlankEntry(sourceText, options);
      }
      const joiner = Object.prototype.hasOwnProperty.call(state.pendingTopLevelContinuation || {}, 'joiner')
        ? String(state.pendingTopLevelContinuation.joiner || '')
        : ' ';
      const continuationPromptText = state.pendingTopLevelContinuation.reason === 'unclosed-parentheses'
        ? String(Math.max(1, Number(state.pendingTopLevelContinuation.depth) || 1)) + '.'
        : '.';
      const continuationSourceText = String(state.pendingTopLevelContinuation.headText || '') + joiner + trimmed;
      if (historicalInputTextNeedsContinuation(continuationSourceText)) {
        const entry = compileHistoricalParenContinuationOpenEntry(continuationSourceText, historicalUnclosedParenDepth(continuationSourceText), Object.assign({}, options, { displayText: sourceText }));
        entry.continuationLine = true;
        entry.continuationPromptText = continuationPromptText;
        entry.fromTopLevelContinuation = true;
        entry.sourceText = continuationSourceText;
        return entry;
      }
      try {
        const entry = compileTopLevelSurfaceEntry(continuationSourceText, null, Object.assign({}, options, { displayText: sourceText }));
        entry.continuationLine = true;
        entry.continuationPromptText = continuationPromptText;
        entry.fromTopLevelContinuation = true;
        entry.sourceText = continuationSourceText;
        return entry;
      } catch (error) {
        if (/^Could not resolve top-level entry: /.test(String(error && error.message || error || ''))) {
          const entry = applyEntryDisplayText({
            sourceText: continuationSourceText,
            kind: 'historical_top_level_continuation_error',
            form: { bodyLines: ['Error:  2'] },
            continuationLine: true,
            fromTopLevelContinuation: true,
          }, Object.assign({}, options, { displayText: sourceText }));
          return entry;
        }
        throw error;
      }
    }

    if (!trimmed) {
      throw new Error('Expected a historical command entry.');
    }

    if (historicalInputTextNeedsContinuation(trimmed)) {
      return compileHistoricalParenContinuationOpenEntry(trimmed, historicalUnclosedParenDepth(trimmed), options);
    }

    if (state && state.pendingAnswers && /^[yn]$/i.test(trimmed)) return compileMoreAnswerEntry(trimmed, options);
    if (state && state.pendingInput) return compileInputReplyEntry(trimmed, options);

    if (options && options.commandKind === 'more_answer') return compileMoreAnswerEntry(trimmed, options);
    if (options && options.commandKind === 'input_reply') return compileInputReplyEntry(trimmed, options);
    if (options && options.commandKind === 'historical_clause') return compileHistoricalClauseEntry(trimmed, options);
    if (options && options.commandKind === 'historical_query') return compileHistoricalQueryEntry(trimmed, options);
    if (options && options.commandKind === 'historical_supervisor_command') return compileHistoricalSupervisorCommandEntry(trimmed, options);

    if (/^\(\(/.test(trimmed)) {
      try {
        return compileHistoricalClauseEntry(trimmed, options);
      } catch (err) {
        // fall through to the generic top-level path below.
      }
    }

    if (/^\(/.test(trimmed)) {
      return compileHistoricalQueryEntry(trimmed, options);
    }
    const terms = Reader.parseHistoricalTermsText(trimmed);
    if (!terms.length) {
      throw new Error('Expected a historical command entry.');
    }

    const head = Terms.deref(terms[0]);
    if (!head || head.tag !== 'Sym') {
      throw new Error('Could not resolve top-level entry: ' + trimmed);
    }

    const headName = head.name;
    const commandArgs = terms.slice(1);
    const workspace = compileWorkspaceForState(state);

    if (isHistoricalSpecialSupervisorCommandName(headName)) {
      return compileHistoricalSupervisorCommandEntry(trimmed, options);
    }

    if ((headName === 'ADDCL' || headName === 'DELCL') && commandArgs.length === 2) {
      return compileHistoricalSupervisorCommandEntry(trimmed, options);
    }

    if (headName === 'QT' && commandArgs.length === 1) {
      return compileHistoricalSupervisorCommandEntry(trimmed, options);
    }

    if (isHistoricalQueryStyleCommandName(headName)) {
      return compileHistoricalQueryGoalsEntry([
        commandArgs.length ? Terms.Struct(headName, commandArgs) : Terms.Sym(headName)
      ], trimmed, options);
    }

    if (headName === 'ALL' && commandArgs.length === 1) {
      return applyEntryDisplayText({
        sourceText: trimmed,
        kind: 'historical_query',
        form: [Terms.Struct('ALL', [commandArgs[0]])],
        topLevelSurface: 'bare',
      }, options);
    }

    if (commandArgs.length === 1 && Terms.deref(commandArgs[0]) && Terms.deref(commandArgs[0]).tag === 'Pair' && hasVisibleRelationSignature(workspace, headName + '/0+')) {
      return applyEntryDisplayText({
        sourceText: trimmed,
        kind: 'historical_query',
        form: [Terms.Struct(headName, [], commandArgs[0])],
        topLevelSurface: 'bare',
      }, options);
    }

    if (commandArgs.length === 0) {
      const continuation = topLevelContinuationCandidateInfo(trimmed, state);
      if (continuation) {
        return applyEntryDisplayText({
          sourceText: trimmed,
          kind: 'historical_top_level_continuation_open',
          form: { headText: continuation.headText, reason: continuation.reason },
        }, options);
      }
    }

    if (commandArgs.length === 0 && hasVisibleRelationArity(workspace, headName, 0)) {
      return applyEntryDisplayText({
        sourceText: trimmed,
        kind: 'historical_query',
        form: [Terms.Struct(headName, [])],
        topLevelSurface: 'bare',
      }, options);
    }

    if (commandArgs.length >= 1 && hasVisibleRelationArity(workspace, headName, 1)) {
      const entry = {
        sourceText: trimmed,
        kind: 'historical_query',
        form: [Terms.Struct(headName, [commandArgs[0]])],
        topLevelSurface: 'bare',
      };
      if (commandArgs.length > 1) {
        entry.inputBuffer = commandArgs.slice(1);
      }
      return applyEntryDisplayText(entry, options);
    }

    throw new Error('Could not resolve top-level entry: ' + trimmed);
  }

  function compileHistoricalEntry(sourceText, stateOrOptions, maybeOptions) {
    return compileTopLevelSurfaceEntry(sourceText, stateOrOptions, maybeOptions);
  }

  function compileHistoricalCommandEntries(text, stateOrOptions, maybeOptions) {
    const resolved = resolveCompilerContext(stateOrOptions, maybeOptions);
    return splitHistoricalTopLevelForms(text).map(function (sourceText) {
      return compileHistoricalEntry(sourceText, resolved.state, resolved.options);
    });
  }

  function renderInputPrompt() {
    return TranscriptProfiles.normalizeProfile().renderInputPrompt();
  }

  function renderQueryResult(result) {
    return TranscriptProfiles.normalizeProfile().renderQueryResult(result, { allowEmpty: false, waitingForDecision: false });
  }

  function renderClauseLoadResult() {
    return TranscriptProfiles.normalizeProfile().renderClauseLoadResult();
  }

  function renderMorePrompt() {
    return TranscriptProfiles.normalizeProfile().renderMorePrompt();
  }

  function commandPromptModuleName(state) {
    if (state && state.workspace) {
      if (state.workspace.currentModuleName != null && String(state.workspace.currentModuleName)) {
        return String(state.workspace.currentModuleName);
      }
      if (state.workspace.rootModuleName != null && String(state.workspace.rootModuleName)) {
        return String(state.workspace.rootModuleName);
      }
    }
    if (state && state.topLevelModuleName != null && String(state.topLevelModuleName)) {
      return String(state.topLevelModuleName);
    }
    return '&';
  }

  function shouldPersistWrappedModuleContext(entry) {
    if (!entry || entry.kind !== 'historical_query' || !Array.isArray(entry.form) || entry.form.length !== 1) {
      return false;
    }
    let goal = Terms.deref(entry.form[0]);
    if (goal && goal.tag === 'Struct' && goal.name === '?' && goal.args && goal.args.length === 1) {
      const wrapped = Terms.cloneListToArray(goal.args[0]);
      if (wrapped && Array.isArray(wrapped.items) && wrapped.items.length === 1 && wrapped.tail && wrapped.tail.tag === 'Nil') {
        goal = Terms.deref(wrapped.items[0]);
      }
    }
    if (goal && goal.tag === 'Pair') {
      const call = Terms.cloneListToArray(goal);
      if (call && Array.isArray(call.items) && call.items.length >= 1 && call.tail && call.tail.tag === 'Nil') {
        const head = Terms.deref(call.items[0]);
        const name = head && head.tag === 'Sym' && head.name != null ? String(head.name).toUpperCase() : '';
        return name === 'CRMOD' || name === 'OPMOD' || name === 'CLMOD';
      }
    }
    const name = goal && goal.tag === 'Struct' && goal.name != null ? String(goal.name).toUpperCase() : '';
    return name === 'CRMOD' || name === 'OPMOD' || name === 'CLMOD';
  }

  function storePendingAnswers(state, entry, result) {
    if (result.solutionTexts.length <= 1) {
      state.pendingAnswers = null;
      return;
    }
    state.pendingAnswers = {
      entry: entry,
      result: result,
      nextIndex: 1,
    };
  }

  function queryBodyLinesForResult(state, entry, result, options, promptModuleNameOverride) {
    const profile = profileFor(state, options);
    const promptModuleName = promptModuleNameOverride != null ? promptModuleNameOverride : commandPromptModuleName(state);
    if (result.stopReason === 'quit') {
      state.pendingAnswers = null;
      state.pendingInput = null;
      state.quit = true;
      return { bodyLines: result.outputLines.slice(), context: { complete: true, stopReason: 'quit', commandPromptModuleName: promptModuleName } };
    }
    if (result.stopReason === 'aborted') {
      state.pendingAnswers = null;
      return { bodyLines: result.outputLines.slice(), context: { complete: true, stopReason: 'aborted', commandPromptModuleName: promptModuleName } };
    }
    if (!result.solutionTexts.length) {
      state.pendingAnswers = null;
      return {
        bodyLines: result.outputLines.concat(asLineArray(profile.renderNoSolution(entry, result, state))),
        context: { complete: true, stopReason: result.stopReason || 'done', noSolution: true, commandPromptModuleName: promptModuleName }
      };
    }
    if (result.solutionTexts.length === 1) {
      state.pendingAnswers = null;
      return {
        bodyLines: result.outputLines.concat(profile.renderQueryResult(result, { allowEmpty: false, waitingForDecision: false })),
        context: { complete: true, stopReason: result.stopReason || 'done', commandPromptModuleName: promptModuleName }
      };
    }
    storePendingAnswers(state, entry, result);
    const firstSolutionLines = (profile.name === 'historical' && !result.outputLines.length)
      ? []
      : [result.solutionTexts[0]];
    return {
      bodyLines: result.outputLines.concat(firstSolutionLines).concat(asLineArray(profile.renderMorePrompt(entry, result, state))),
      context: { complete: false, waitingForDecision: true, stopReason: result.stopReason || 'maxSolutions', commandPromptModuleName: promptModuleName }
    };
  }

  function shouldAttachNextEchoAfterHistoricalQuery(entry, result, options) {
    const profile = profileFor(null, options);
    if (!profile || profile.name !== 'historical') return false;
    if (!entry || entry.kind !== 'historical_query') return false;
    if (!/^\?\s*\(\(\s*CRMOD\b/i.test(String(entry.sourceText || ''))) return false;
    if (!result || !Array.isArray(result.solutionTexts) || result.solutionTexts.length !== 1) return false;
    if (result.outputLines && result.outputLines.length) return false;
    return true;
  }

  function markHistoricalPromptLineToAttachNext(transcriptLines) {
    const ATTACH_NEXT_PROMPT_PREFIX = 'ATTACH_NEXT_PROMPT:';
    const lines = asLineArray(transcriptLines);
    if (!lines.length) return lines;
    lines[lines.length - 1] = ATTACH_NEXT_PROMPT_PREFIX + String(lines[lines.length - 1] || '');
    return lines;
  }

  function suspendedBodyLinesForResult(state, entry, result, options, promptModuleNameOverride) {
    const profile = profileFor(state, options);
    const promptModuleName = promptModuleNameOverride != null ? promptModuleNameOverride : commandPromptModuleName(state);
    const promptLines = result.outputLines.slice();
    if (!(profile && profile.name === 'historical')) {
      promptLines.push(profile.renderInputPrompt(entry, result, state));
    }
    return {
      bodyLines: promptLines,
      context: { complete: false, suspended: true, stopReason: 'suspended', commandPromptModuleName: promptModuleName }
    };
  }

  function runHistoricalQuery(state, entry, options) {
    const preQueryPromptModuleName = commandPromptModuleName(state);
    state.pendingInput = null;
    const runOptions = Object.assign({}, state.options, options || {});
    const queryVariables = [];
    entry.form.forEach(function (goal) {
      Terms.collectVariables(goal, new Set(), queryVariables);
    });
    if (queryVariables.length === 0) {
      runOptions.maxSolutions = 1;
    }
    const profile = profileFor(state, options);
    if (profile && profile.name === 'historical') {
      runOptions.preserveHistoricalNonNewlineMarkers = true;
    }
    const usesModuleEditTarget = false;
    const engine = Engine.createEngine(state.workspace, runOptions);
    const queryState = Engine.createQueryState(engine, entry.form, runOptions);
    queryState.inputBuffer = (state.inputBuffer || []).slice();
    if (Array.isArray(entry.inputBuffer) && entry.inputBuffer.length) {
      queryState.inputBuffer = queryState.inputBuffer.concat(entry.inputBuffer.slice());
    }
    const previousModuleName = state.workspace.currentModuleName;
    if (usesModuleEditTarget) {
      state.workspace.currentModuleName = state.moduleEditTargetName;
    }
    let result;
    result = Engine.advanceQuery(queryState);
    if (!result.suspended) {
      if (usesModuleEditTarget || !shouldPersistWrappedModuleContext(entry)) {
        state.workspace.currentModuleName = previousModuleName;
      }
    }
    persistEngineRuntimeState(state, engine);

    if (result.suspended) {
      state.pendingAnswers = null;
      state.inputBuffer = [];
      state.pendingInput = {
        entry: entry,
        queryState: queryState,
      };
      state.pendingInputBufferText = result.prefillText ? String(result.prefillText) : '';
      const suspended = suspendedBodyLinesForResult(state, entry, result, options);
      suspended.context.echoPromptModuleName = preQueryPromptModuleName;
      return {
        entry: entry,
        result: result,
        suspended: true,
        transcriptLines: formatTranscriptLines(state, entry, suspended.bodyLines, suspended.context, options),
      };
    }

    state.inputBuffer = (queryState.inputBuffer || []).slice();
    const completion = queryBodyLinesForResult(state, entry, result, options);
    completion.context.echoPromptModuleName = preQueryPromptModuleName;
    let transcriptLines = formatTranscriptLines(state, entry, completion.bodyLines, completion.context, options);
    if (shouldAttachNextEchoAfterHistoricalQuery(entry, result, options)) {
      transcriptLines = markHistoricalPromptLineToAttachNext(transcriptLines);
    }
    return {
      entry: entry,
      result: result,
      transcriptLines: transcriptLines,
    };
  }

  function resumePendingAnswers(state, entry, options) {
    const promptModuleName = commandPromptModuleName(state);
    if (!state.pendingAnswers) {
      throw new Error('No pending answers to resume.');
    }

    const profile = profileFor(state, options);
    const decision = entry.form.decision;
    if (decision === 'n') {
      state.pendingAnswers = null;
      return {
        entry: entry,
        transcriptLines: formatTranscriptLines(state, entry, asLineArray(profile.renderNoMoreAnswers(entry, null, state)), { complete: true, stopReason: 'done', commandPromptModuleName: promptModuleName }, options),
      };
    }

    const pending = state.pendingAnswers;
    const result = pending.result;
    const nextIndex = pending.nextIndex;
    const bodyLines = (profile.name === 'historical' && !(result.outputLines && result.outputLines.length))
      ? []
      : [result.solutionTexts[nextIndex]];
    pending.nextIndex += 1;

    if (pending.nextIndex < result.solutionTexts.length) {
      bodyLines.push.apply(bodyLines, asLineArray(profile.renderMorePrompt(entry, result, state)));
      return {
        entry: entry,
        result: result,
        transcriptLines: formatTranscriptLines(state, entry, bodyLines, { complete: false, waitingForDecision: true, commandPromptModuleName: promptModuleName }, options),
      };
    }

    state.pendingAnswers = null;
    bodyLines.push.apply(bodyLines, asLineArray(profile.renderNoMoreAnswers(entry, result, state)));
    return {
      entry: entry,
      result: result,
      transcriptLines: formatTranscriptLines(state, entry, bodyLines, { complete: true, stopReason: 'done', commandPromptModuleName: promptModuleName }, options),
    };
  }

  function resumePendingInput(state, entry, options) {
    const promptModuleName = commandPromptModuleName(state);
    if (!state.pendingInput) {
      throw new Error('No pending input request to resume.');
    }

    const pending = state.pendingInput;
    state.pendingInput = null;
    state.pendingInputBufferText = '';
    const result = Engine.resumeQueryInput(pending.queryState, entry.form.terms || [entry.form.term]);
    persistEngineRuntimeState(state, pending.queryState.engine);

    if (result.suspended) {
      state.pendingAnswers = null;
      state.inputBuffer = [];
      state.pendingInput = pending;
      state.pendingInputBufferText = result.prefillText ? String(result.prefillText) : '';
      const suspended = suspendedBodyLinesForResult(state, entry, result, options);
      return {
        entry: entry,
        result: result,
        suspended: true,
        transcriptLines: formatTranscriptLines(state, entry, suspended.bodyLines, suspended.context, options),
      };
    }

    state.inputBuffer = (pending.queryState.inputBuffer || []).slice();
    const completion = queryBodyLinesForResult(state, pending.entry, result, options, promptModuleName);
    if (profileFor(state, options).name === 'historical') {
      const replyText = String((entry && (entry.displayText || entry.sourceText)) || '');
      const removedEchoDuplicate = completion.bodyLines.length > 0
        && String(completion.bodyLines[0]) === replyText;
      if (removedEchoDuplicate) {
        completion.bodyLines = completion.bodyLines.slice(1);
      }
      if (removedEchoDuplicate
        && result
        && Array.isArray(result.solutionTexts)
        && result.solutionTexts.length === 1
        && result.solutionTexts[0] === 'YES'
        && completion.bodyLines.indexOf('?') === -1) {
        completion.bodyLines = completion.bodyLines.concat(['?']);
      }
    }
    return {
      entry: entry,
      result: result,
      transcriptLines: formatTranscriptLines(
        state,
        entry,
        completion.bodyLines,
        Object.assign({}, completion.context, {
          dottedInputReply: !!(
            pending
            && pending.entry
            && pending.entry.topLevelSurface === 'bare'
            && !/^\?/.test(String(pending.entry.sourceText || '').trim())
          )
        }),
        options
      ),
    };
  }

  function persistEngineRuntimeState(state, engine) {
    if (!state || !state.options || !engine || !engine.options) return;
    ['runtimeRandomState', 'runtimePioState', 'runtimeFileState', 'runtimeGraphicsState', 'fileStore'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(engine.options, key)) {
        state.options[key] = engine.options[key];
      }
    });
  }

  function runHistoricalClause(state, entry, options) {
    const promptModuleName = commandPromptModuleName(state);
    const profile = profileFor(state, options);
    if (entry && entry.form && entry.form.head && Terms.deref(entry.form.head) && Terms.deref(entry.form.head).name === 'ALL') {
      return {
        entry: entry,
        clause: null,
        transcriptLines: formatTranscriptLines(state, entry, ['Error:  4'], { complete: true, stopReason: 'aborted', commandPromptModuleName: promptModuleName }, options),
      };
    }
    let clause;
    clause = Workspace.addClause(state.workspace, entry.form);
    return {
      entry: entry,
      clause: clause,
      transcriptLines: formatTranscriptLines(state, entry, profile.renderClauseLoadResult(entry, clause, state), { complete: true, stopReason: 'done', commandPromptModuleName: promptModuleName }, options),
    };
  }

  function runHistoricalSupervisorCommand(state, entry, options) {
    const promptModuleName = commandPromptModuleName(state);
    const commandName = String(entry && entry.commandName || '').toUpperCase();
    const commandArgs = Array.isArray(entry && entry.commandArgs) ? entry.commandArgs.slice() : [];
    const runOptions = Object.assign({}, state.options, options || {});
    runOptions.allowTopLevelSupervisorModuleOpen = true;
    const profile = profileFor(state, options);
    if (profile && profile.name === 'historical') {
      runOptions.preserveHistoricalNonNewlineMarkers = true;
    }

    if (commandName === 'ADDCL' && commandArgs.length === 2) {
      Workspace.addClause(state.workspace, Workspace.historicalClauseFromTerm(commandArgs[0]));
      return {
        entry: entry,
        result: { solutionTexts: [], outputLines: [] },
        transcriptLines: asLineArray(profile.renderCommandEcho(entry, state, { complete: false, commandPromptModuleName: promptModuleName }))
          .concat([profile.renderInputPrompt(entry, null, state)])
          .concat(asLineArray(profile.renderAfterCommand(entry, state, { complete: true, stopReason: 'done', commandPromptModuleName: promptModuleName }))),
      };
    }

    if (commandName === 'DELCL' && commandArgs.length === 2) {
      return {
        entry: entry,
        result: { solutionTexts: [], outputLines: [] },
        transcriptLines: asLineArray(profile.renderCommandEcho(entry, state, { complete: false, commandPromptModuleName: promptModuleName }))
          .concat(['?'])
          .concat([profile.renderInputPrompt(entry, null, state)])
          .concat(asLineArray(profile.renderAfterCommand(entry, state, { complete: true, stopReason: 'done', commandPromptModuleName: promptModuleName }))),
      };
    }

    const previousModuleName = state.workspace.currentModuleName;
    const engine = Engine.createEngine(state.workspace, runOptions);
    const goal = Terms.Struct(commandName, commandArgs);
    const queryState = Engine.createQueryState(engine, [goal], runOptions);
    const result = Engine.advanceQuery(queryState);
    persistEngineRuntimeState(state, engine);

    const success = !!(result && Array.isArray(result.solutionTexts) && result.solutionTexts.length);
    if ((commandName === 'CRMOD' || commandName === 'OPMOD') && success) {
      const moduleArg = commandArgs.length ? Terms.deref(commandArgs[0]) : null;
      if (commandName === 'CRMOD' && moduleArg && moduleArg.tag === 'Sym' && state.workspace.modulesByName[moduleArg.name]) {
        state.workspace.modulesByName[moduleArg.name].commandCreated = true;
      }
      state.moduleEditTargetName = moduleArg && moduleArg.tag === 'Sym' ? moduleArg.name : state.moduleEditTargetName;
      state.workspace.currentModuleName = previousModuleName || state.topLevelModuleName || state.workspace.rootModuleName;
    }
    if (commandName === 'CLMOD' && success) {
      state.moduleEditTargetName = null;
      state.workspace.currentModuleName = state.topLevelModuleName || state.workspace.rootModuleName;
    }

    if (commandName === 'CRMOD') {
      const promptCount = success ? Math.max(0, commandArgs.length - 1) : 0;
      const bodyLines = ['?'];
      for (let i = 0; i < promptCount; i += 1) bodyLines.push(String(promptModuleName || '&') + '?');
      return {
        entry: entry,
        result: result,
        transcriptLines: asLineArray(profile.renderCommandEcho(entry, state, { complete: false, waitingForDecision: promptCount > 0, commandPromptModuleName: promptModuleName })).concat(bodyLines),
      };
    }

    if (commandName === 'OPMOD') {
      return {
        entry: entry,
        result: result,
        transcriptLines: formatTranscriptLines(state, entry, ['?'], { complete: true, stopReason: success ? 'done' : 'failed', commandPromptModuleName: promptModuleName }, options),
      };
    }

    if (commandName === 'CLMOD') {
      return {
        entry: entry,
        result: result,
        transcriptLines: formatTranscriptLines(state, entry, [], { complete: true, stopReason: success ? 'done' : 'failed', commandPromptModuleName: promptModuleName }, options),
      };
    }

    if (commandName === 'QT' && commandArgs.length === 1) {
      state.pendingAnswers = null;
      state.pendingInput = null;
      return {
        entry: entry,
        result: { solutionTexts: [], outputLines: ['Error:  2'] },
        transcriptLines: formatTranscriptLines(state, entry, ['Error:  2'], { complete: true, stopReason: 'aborted', commandPromptModuleName: promptModuleName }, options),
      };
    }

    return {
      entry: entry,
      result: result,
      transcriptLines: formatTranscriptLines(state, entry, [], { complete: true, stopReason: success ? 'done' : 'failed' }, options),
    };
  }

  function runNormalizedCommand(state, entry, options) {
    if (!state || !state.workspace) {
      throw new Error('runNormalizedCommand requires a session state.');
    }
    if (state.quit) {
      throw new Error('Session has been quit.');
    }
    if (!entry || !entry.kind) {
      throw new Error('Unsupported command entry kind.');
    }

    if (state.pendingAnswers && entry.kind !== 'more_answer') {
      throw new Error('Pending answers require a more-answer decision before the next command.');
    }
    if (state.pendingInput && entry.kind !== 'input_reply') {
      throw new Error('Pending input requires an input-reply decision before the next command.');
    }
    if (state.pendingTopLevelContinuation
      && entry.kind !== 'historical_continuation_blank'
      && !entry.fromTopLevelContinuation) {
      throw new Error('Pending top-level continuation requires a continuation reply before the next command.');
    }

    let output;
    if (entry.kind === 'historical_top_level_continuation_open' || entry.kind === 'historical_paren_continuation_open') {
      state.pendingTopLevelContinuation = {
        headText: entry.form.headText,
        reason: entry.form.reason,
        joiner: Object.prototype.hasOwnProperty.call(entry.form || {}, 'joiner') ? entry.form.joiner : ' ',
        depth: entry.form && entry.form.depth != null ? entry.form.depth : null,
      };
      output = {
        entry: entry,
        transcriptLines: formatTranscriptLines(state, entry, [], { complete: false, suspended: true, commandPromptModuleName: commandPromptModuleName(state) }, options),
      };
    } else if (entry.kind === 'historical_continuation_blank') {
      output = {
        entry: entry,
        transcriptLines: formatTranscriptLines(state, entry, [], { complete: false, suspended: true, commandPromptModuleName: commandPromptModuleName(state) }, options),
      };
    } else if (entry.kind === 'historical_top_level_continuation_error') {
      state.pendingTopLevelContinuation = null;
      output = {
        entry: entry,
        transcriptLines: formatTranscriptLines(state, entry, entry.form.bodyLines, { complete: true, stopReason: 'aborted', commandPromptModuleName: commandPromptModuleName(state) }, options),
      };
    } else {
      if (entry.fromTopLevelContinuation) {
        state.pendingTopLevelContinuation = null;
      }
      if (entry.kind === 'historical_query') {
        output = runHistoricalQuery(state, entry, options);
      } else if (entry.kind === 'historical_clause') {
        output = runHistoricalClause(state, entry, options);
      } else if (entry.kind === 'historical_supervisor_command') {
        output = runHistoricalSupervisorCommand(state, entry, options);
      } else if (entry.kind === 'more_answer') {
        output = resumePendingAnswers(state, entry, options);
      } else if (entry.kind === 'input_reply') {
        output = resumePendingInput(state, entry, options);
      } else {
        throw new Error('Unsupported command entry kind.');
      }
    }

    output.transcript = output.transcriptLines.join('\n');
    state.history.push(output);
    return output;
  }

  function executeHistoricalCommands(stateOrWorkspace, textOrEntries, options) {
    const state = stateOrWorkspace && stateOrWorkspace.workspace
      ? stateOrWorkspace
      : createSessionState(stateOrWorkspace, options);
    const entries = [];
    const outputs = [];

    function pushCompiledSource(sourceText) {
      try {
        const entry = compileHistoricalEntry(sourceText, state, options);
        entries.push(entry);
        outputs.push(runNormalizedCommand(state, entry, options));
      } catch (error) {
        const profile = profileFor(state, options);
        if (profile && profile.name === 'historical' && /^Could not resolve top-level entry: /.test(String(error && error.message || error || ''))) {
          const entry = applyEntryDisplayText({ sourceText: sourceText, kind: 'historical_unresolved', form: null }, { displayText: sourceText });
          entries.push(entry);
          outputs.push({
            entry: entry,
            transcriptLines: asLineArray(profile.renderCommandEcho(entry, state, { complete: false, commandPromptModuleName: commandPromptModuleName(state) }))
              .concat(['?'])
              .concat(asLineArray(profile.renderAfterCommand(entry, state, { suspended: false, waitingForDecision: false }))),
            transcript: ''
          });
          return;
        }
        throw error;
      }
    }

    if (typeof textOrEntries === 'string') {
      const profile = profileFor(state, options);
      if (profile && profile.name === 'historical') {
        const normalized = String(textOrEntries || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalized.split('\n');
        let buffer = [];
        let depth = 0;

        function flushBuffer() {
          const formText = buffer.join('\n').trim();
          if (formText || state.pendingTopLevelContinuation) {
            pushCompiledSource(formText);
          }
          buffer = [];
          depth = 0;
        }

        lines.forEach(function (line) {
          const rawLine = String(line || '');
          if (state.pendingTopLevelContinuation) {
            pushCompiledSource(rawLine);
            return;
          }
          if (!buffer.length && !rawLine.trim()) return;
          buffer.push(rawLine);
          for (let index = 0; index < rawLine.length; index += 1) {
            const ch = rawLine.charAt(index);
            if (ch === '(') depth += 1;
            if (ch === ')') depth -= 1;
          }
          if (depth <= 0) flushBuffer();
        });
        if (buffer.length) flushBuffer();
      } else {
        splitHistoricalTopLevelForms(textOrEntries).forEach(function (sourceText) {
          pushCompiledSource(sourceText);
        });
      }
    } else {
      textOrEntries.slice().forEach(function (entry) {
        entries.push(entry);
        outputs.push(runNormalizedCommand(state, entry, options));
      });
    }

    let mergedTranscriptLines = (profileFor(state, options).name === 'historical')
      ? TranscriptProfiles.mergeHistoricalTranscriptChunks(outputs.map(function (output) { return output.transcriptLines; }))
      : outputs.reduce(function (all, output, index) {
          if (index > 0) all.push('');
          return all.concat(output.transcriptLines);
        }, []);

    if (profileFor(state, options).name === 'historical' && state.pendingTopLevelContinuation) {
      if (state.pendingTopLevelContinuation.reason === 'unclosed-parentheses') {
        mergedTranscriptLines = mergedTranscriptLines.concat([String(Math.max(1, Number(state.pendingTopLevelContinuation.depth) || 1)) + '.']);
      } else {
        mergedTranscriptLines = mergedTranscriptLines.concat(['.']);
      }
    }

    return {
      state: state,
      entries: entries,
      outputs: outputs,
      transcriptLines: mergedTranscriptLines,
      transcript: mergedTranscriptLines.join('\n'),
    };
  }

  function runHistoricalCommandText(workspaceOrText, commandText, options) {
    return executeHistoricalCommands(workspaceOrText, commandText, options);
  }

  return {
    createSessionState: createSessionState,
    splitHistoricalTopLevelForms: splitHistoricalTopLevelForms,
    compileHistoricalEntry: compileHistoricalEntry,
    compileHistoricalQueryEntry: compileHistoricalQueryEntry,
    compileHistoricalClauseEntry: compileHistoricalClauseEntry,
    compileHistoricalCommandEntries: compileHistoricalCommandEntries,
    compileHistoricalSupervisorCommandEntry: compileHistoricalSupervisorCommandEntry,
    compileMoreAnswerEntry: compileMoreAnswerEntry,
    compileInputReplyEntry: compileInputReplyEntry,
    compileHistoricalTopLevelContinuationBlankEntry: compileHistoricalTopLevelContinuationBlankEntry,
    applyEntryDisplayText: applyEntryDisplayText,
    profileFor: profileFor,
    renderQueryResult: renderQueryResult,
    renderClauseLoadResult: renderClauseLoadResult,
    renderMorePrompt: renderMorePrompt,
    renderInputPrompt: renderInputPrompt,
    resumePendingAnswers: resumePendingAnswers,
    resumePendingInput: resumePendingInput,
    runNormalizedCommand: runNormalizedCommand,
    executeHistoricalCommands: executeHistoricalCommands,
    runHistoricalCommandText: runHistoricalCommandText,
    TranscriptProfiles: TranscriptProfiles,
  };
});
