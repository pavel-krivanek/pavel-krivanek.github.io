(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./terms'),
      require('./unify'),
      require('./freshen'),
      require('./workspace'),
      require('./reader')
    );
  } else {
    root.MicroPrologCleanRoomEngine = factory(
      root.MicroPrologCleanRoomTerms,
      root.MicroPrologCleanRoomUnify,
      root.MicroPrologCleanRoomFreshen,
      root.MicroPrologCleanRoomWorkspace,
      root.MicroPrologCleanRoomReader
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Terms, Unify, Freshen, Workspace, Reader) {
  'use strict';

  const STOP = { type: 'stop' };
  const SUSPEND = { type: 'suspend' };
  const ABORT = { type: 'abort' };
  const HISTORICAL_NON_NEWLINE_OUTPUT_PREFIX = '\u0001NONL:';

  function createEngine(workspace, options) {
    return {
      workspace: workspace || Workspace.createWorkspace(),
      options: Object.assign({ maxSteps: 10000, maxSolutions: 20 }, options || {}),
    };
  }

  function cloneBindingSnapshot(term, seen) {
    const value = Terms.deref(term);
    if (!value) return value;
    if (!seen) seen = new Map();
    if (value.tag === 'Nil') return Terms.Nil;
    if (value.tag === 'Sym') return Terms.Sym(value.name);
    if (value.tag === 'Num') return Terms.Num(value.value);
    if (seen.has(value)) return seen.get(value);
    if (value.tag === 'Var') {
      const clone = Terms.Var(value.nameHint);
      seen.set(value, clone);
      if (value.binding) {
        clone.binding = cloneBindingSnapshot(value.binding, seen);
      }
      return clone;
    }
    if (value.tag === 'Struct') {
      const clone = { tag: 'Struct', name: String(value.name), args: [], argTail: null };
      seen.set(value, clone);
      clone.args = value.args.map(function (arg) {
        return cloneBindingSnapshot(arg, seen);
      });
      clone.argTail = value.argTail ? cloneBindingSnapshot(value.argTail, seen) : null;
      return clone;
    }
    if (value.tag === 'Pair') {
      const clone = { tag: 'Pair', head: Terms.Nil, tail: Terms.Nil };
      seen.set(value, clone);
      clone.head = cloneBindingSnapshot(value.head, seen);
      clone.tail = cloneBindingSnapshot(value.tail, seen);
      return clone;
    }
    throw new Error('Unknown term tag while snapshotting bindings: ' + value.tag);
  }

  function snapshotBindings(variables) {
    return variables.map(function (variable) {
      return {
        variable: variable,
        variableName: variable && variable.nameHint ? String(variable.nameHint) : null,
        value: cloneBindingSnapshot(variable),
      };
    });
  }

  function builtinName(goal) {
    const value = Terms.deref(goal);
    if (!value) return '';
    if (value.tag === 'Struct') return String(value.name || '');
    if (value.tag === 'Sym') return String(value.name || '');
    return '';
  }

  function builtinArgs(goal) {
    const value = Terms.deref(goal);
    if (!value) return [];
    if (value.tag === 'Struct') return value.args.slice();
    if (value.tag === 'Sym') return [];
    return [];
  }

  function builtinArgTail(goal) {
    const value = Terms.deref(goal);
    if (!value || value.tag !== 'Struct') return null;
    return value.argTail || null;
  }

  function outputArgs(goal) {
    const args = builtinArgs(goal);
    const tail = builtinArgTail(goal);
    if (!tail) return args;
    return args.concat(cloneProperListItems(tail));
  }

  function builtinArity(goal) {
    return builtinArgs(goal).length;
  }

  const PRIMITIVE_RELATION_NAMES = new Set([
    'TRUE', 'FAIL', '=', 'EQ', '/', '/*', 'R', 'ACCEPT', 'RFILL', 'LST', 'CON', 'NUM', 'INT', 'VAR', 'SYS', 'SPACE', 'ABORT', 'NEW', 'QT', 'NOT', 'OR', 'IF', 'ONE', '!', 'FORALL', '?',
    'SUM', 'TIMES', 'LESS', 'SIGN', 'STRINGOF', 'CHAROF',
    'P', 'PP', 'CMOD', 'CRMOD', 'OPMOD', 'CLMOD', 'DICT', 'ADDCL', 'CL', 'DELCL', 'KILL', 'LIST', 'LISTP',
    'SAVE', 'LOAD', 'CREATE', 'WRITE', 'W', 'CLOSE', 'OPEN', 'READ', 'RND',
    'HYBRID', 'NORMAL', 'LNE', 'PNT', 'CLS', 'BORDER', 'BP', 'PIO', 'ISALL'
  ]);

  function isPrimitiveRelationName(name) {
    return PRIMITIVE_RELATION_NAMES.has(String(name || ''));
  }

  function hasProperPrimitiveCallShape(term) {
    const value = Terms.deref(term);
    if (!value) return false;
    if (value.tag === 'Sym') return true;
    if (value.tag !== 'Struct') return false;
    if (!value.argTail) return true;
    return builtinName(value) === 'DICT' || builtinName(value) === 'P' || builtinName(value) === 'PP';
  }

  function isSupportedPrimitiveArity(name, arity) {
    return (name === 'TRUE' && arity === 0)
      || (name === 'FAIL' && arity === 0)
      || ((name === '=' || name === 'EQ') && arity === 2)
      || (name === '/' && arity === 0)
      || name === '/*'
      || (name === 'R' && arity === 1)
      || (name === 'ACCEPT' && arity === 1)
      || (name === 'RFILL' && arity === 2)
      || (name === 'LST' && arity === 1)
      || (name === 'CON' && arity === 1)
      || (name === 'NUM' && arity === 1)
      || (name === 'INT' && (arity === 1 || arity === 2))
      || (name === 'VAR' && arity === 1)
      || (name === 'SYS' && arity === 1)
      || (name === 'SPACE' && arity === 1)
      || (name === 'ABORT' && arity === 0)
      || (name === 'NOT' && arity >= 1)
      || (name === 'OR' && arity === 2)
      || (name === 'IF' && (arity === 2 || arity === 3))
      || (name === 'ONE' && arity >= 1)
      || (name === '!' && arity >= 1)
      || (name === 'FORALL' && arity === 2)
      || (name === '?' && arity === 1)
      || (name === 'NEW' && (arity === 0 || arity === 1))
      || (name === 'QT' && (arity === 0 || arity === 1))
      || (name === 'SUM' && arity === 3)
      || (name === 'TIMES' && arity === 3)
      || (name === 'LESS' && arity === 2)
      || (name === 'SIGN' && arity === 2)
      || (name === 'STRINGOF' && arity === 2)
      || (name === 'CHAROF' && arity === 2)
      || name === 'P'
      || name === 'PP'
      || (name === 'CMOD' && arity === 1)
      || (name === 'CRMOD' && arity === 3)
      || (name === 'OPMOD' && arity === 1)
      || (name === 'CLMOD' && arity === 0)
      || (name === 'DICT' && arity >= 3)
      || (name === 'ADDCL' && (arity === 1 || arity === 2))
      || (name === 'CL' && (arity === 1 || arity === 3))
      || (name === 'DELCL' && (arity === 1 || arity === 2))
      || (name === 'KILL' && arity === 1)
      || (name === 'LIST' && arity === 1)
      || (name === 'LISTP' && (arity === 1 || arity === 2))
      || (name === 'SAVE' && (arity === 1 || arity === 2))
      || (name === 'LOAD' && arity === 1)
      || (name === 'CREATE' && arity === 1)
      || (name === 'WRITE' && arity === 2)
      || (name === 'W' && arity === 2)
      || (name === 'CLOSE' && arity === 1)
      || (name === 'OPEN' && arity === 1)
      || (name === 'READ' && arity === 2)
      || (name === 'RND' && (arity === 0 || arity === 1 || arity === 2))
      || ((name === 'HYBRID' || name === 'NORMAL') && (arity === 0 || arity === 1))
      || (name === 'LNE' && (arity === 4 || arity === 5 || arity === 6))
      || (name === 'PNT' && (arity === 2 || arity === 3 || arity === 4))
      || (name === 'CLS' && (arity === 0 || arity === 1))
      || (name === 'BORDER' && arity === 1)
      || (name === 'BP' && arity === 2)
      || (name === 'PIO' && arity === 2)
      || (name === 'ISALL' && arity >= 3);
  }

  function isWellFormedPrimitiveCall(term) {
    const name = builtinName(term);
    if (!isPrimitiveRelationName(name)) return false;
    if (!hasProperPrimitiveCallShape(term)) return false;
    return isSupportedPrimitiveArity(name, builtinArity(term));
  }

  function isMalformedPrimitiveCall(term) {
    const name = builtinName(term);
    if (!isPrimitiveRelationName(name)) return false;
    return !isWellFormedPrimitiveCall(term);
  }

  function isPrimitiveSystemCallTerm(term) {
    return isWellFormedPrimitiveCall(term);
  }

  function normalizeSingleCallableGoalTerm(term) {
    const value = Terms.deref(term);
    if (!value) return null;
    if (value.tag === 'Sym' || value.tag === 'Struct') return value;
    if (value.tag === 'Pair' || value.tag === 'Nil') {
      try {
        const goals = goalListFromMetaTerm(value);
        if (goals.length !== 1) return null;
        return Terms.deref(goals[0]);
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  function isSystemRelationTerm(term) {
    const value = normalizeSingleCallableGoalTerm(term);
    if (!value) return false;
    if (value.tag === 'Sym') return isPrimitiveRelationName(value.name);
    if (value.tag === 'Struct') return isPrimitiveSystemCallTerm(value);
    return false;
  }

  function cloneProperListItems(term) {
    const parts = Terms.cloneListToArray(term);
    const tail = Terms.deref(parts.tail);
    if (!tail || tail.tag !== 'Nil') {
      throw new Error('Expected a proper list.');
    }
    return parts.items;
  }

  function historicalGoalFromList(term) {
    const value = Terms.deref(term);
    if (!value) throw new Error('Expected a goal form.');
    if (value.tag === 'Nil') return Terms.Struct('TRUE', []);
    if (value.tag === 'Sym') return Terms.Struct(value.name, []);
    if (value.tag === 'Num') return Terms.Struct(String(value.value), []);

    const parts = Terms.cloneListToArray(value);
    const items = parts.items;
    if (items.length === 0) return Terms.Struct('TRUE', []);

    const head = Terms.deref(items[0]);
    if (!head) {
      throw new Error('Historical goal forms must start with a symbol.');
    }
    if (head.tag === 'Var') {
      throw new Error('Predicate meta-variable must be bound to a constant before evaluation.');
    }
    if (head.tag !== 'Sym') {
      throw new Error('Predicate meta-variable must be bound to a constant before evaluation.');
    }
    const tail = Terms.deref(parts.tail);
    return Terms.Struct(head.name, items.slice(1), tail && tail.tag !== 'Nil' ? parts.tail : null);
  }

  function looksLikeHistoricalGoalSequence(term) {
    const value = Terms.deref(term);
    if (!value) return false;
    if (value.tag === 'Nil') return true;
    if (value.tag !== 'Pair') return false;
    const first = Terms.deref(value.head);
    return !!first && (first.tag === 'Pair' || first.tag === 'Nil');
  }

  function goalListFromMetaTerm(term) {
    const value = Terms.deref(term);
    if (!value) throw new Error('Expected a goal form.');

    if (value.tag === 'Var') {
      throw new Error('Meta-goal variable must be bound before evaluation.');
    }
    if (value.tag === 'Struct' || value.tag === 'Sym') {
      return [value];
    }
    if (value.tag === 'Nil') {
      return [Terms.Struct('TRUE', [])];
    }
    if (value.tag === 'Pair') {
      if (looksLikeHistoricalGoalSequence(value)) {
        const goals = cloneProperListItems(value).map(historicalGoalFromList);
        const firstGoal = goals[0];
        if (firstGoal && firstGoal.tag === 'Struct' && firstGoal.name === 'NEW' && (firstGoal.args.length === 0 || firstGoal.args.length === 1)) {
          return [firstGoal];
        }
        return goals;
      }
      return [historicalGoalFromList(value)];
    }

    throw new Error('Expected a callable goal form, got ' + value.tag + '.');
  }

  function historicalGoalToList(goalTerm) {
    const goal = Terms.deref(goalTerm);
    if (!goal) throw new Error('Expected a goal term.');
    if (goal.tag === 'Var') return goal;
    if (goal.tag === 'Pair') return goal;
    if (goal.tag === 'Sym') return Terms.list([Terms.Sym(goal.name)]);
    if (goal.tag !== 'Struct') throw new Error('Expected a callable goal term.');
    return Terms.list([Terms.Sym(goal.name)].concat(goal.args), goal.argTail || Terms.Nil);
  }

  function metaTermFromGoalList(goals) {
    const items = (goals || []).map(historicalGoalToList);
    if (!items.length) return Terms.Nil;
    if (items.length === 1) return items[0];
    return Terms.list(items);
  }

  function isMetaGoal(value) {
    const target = Terms.deref(value);
    return !!target && (target.tag === 'Var' || target.tag === 'Pair' || target.tag === 'Nil');
  }

  function activeCutFrame(frame) {
    let cursor = frame;
    while (cursor) {
      if (cursor.cut) return cursor;
      cursor = cursor.parent;
    }
    return null;
  }

  function isStop(result) {
    return !!result && result.type === 'stop';
  }

  function isSuspend(result) {
    return !!result && result.type === 'suspend';
  }

  function isAbort(result) {
    return !!result && result.type === 'abort';
  }

  function isCut(result) {
    return !!result && result.type === 'cut';
  }

  function cutSignal(frame) {
    return frame ? { type: 'cut', target: frame } : null;
  }

  function cloneRuntimeTerm(term, seen) {
    const value = term || null;
    if (!value) return value;
    if (!seen) seen = new Map();
    if (value.tag === 'Nil') return Terms.Nil;
    if (value.tag === 'Sym') return Terms.Sym(value.name);
    if (value.tag === 'Num') return Terms.Num(value.value);
    if (seen.has(value)) return seen.get(value);
    if (value.tag === 'Var') {
      const clone = Terms.Var(value.nameHint);
      seen.set(value, clone);
      if (value.binding) {
        clone.binding = cloneRuntimeTerm(value.binding, seen);
      }
      return clone;
    }
    if (value.tag === 'Struct') {
      const clone = { tag: 'Struct', name: String(value.name), args: [] };
      seen.set(value, clone);
      clone.args = value.args.map(function (arg) {
        return cloneRuntimeTerm(arg, seen);
      });
      return clone;
    }
    if (value.tag === 'Pair') {
      const clone = { tag: 'Pair', head: Terms.Nil, tail: Terms.Nil };
      seen.set(value, clone);
      clone.head = cloneRuntimeTerm(value.head, seen);
      clone.tail = cloneRuntimeTerm(value.tail, seen);
      return clone;
    }
    throw new Error('Unknown term tag while cloning runtime state: ' + value.tag);
  }


  function cloneRuntimeTermsTogether(terms) {
    const seen = new Map();
    return terms.map(function (term) {
      return cloneRuntimeTerm(term, seen);
    });
  }

  function listFromSolutionSnapshots(bindingSets) {
    let result = Terms.Nil;
    bindingSets.forEach(function (bindingSet) {
      if (!bindingSet || bindingSet.length !== 1) {
        throw new Error('Internal ISALL capture error.');
      }
      result = Terms.Pair(bindingSet[0].value, result);
    });
    return result;
  }

  function cloneFrame(frame, seen) {
    if (!frame) return null;
    if (!seen) seen = new Map();
    if (seen.has(frame)) return seen.get(frame);
    const clone = { parent: null, cut: !!frame.cut, moduleName: frame.moduleName ? String(frame.moduleName) : null };
    seen.set(frame, clone);
    clone.parent = cloneFrame(frame.parent, seen);
    return clone;
  }

  function cloneResumeChoice(choice, termSeen, frameSeen) {
    if (!choice) return null;
    if (choice.kind !== 'goal-choice') {
      throw new Error('Unknown resume choice kind: ' + choice.kind);
    }
    return {
      kind: 'goal-choice',
      goal: cloneRuntimeTerm(choice.goal, termSeen),
      restGoals: (choice.restGoals || []).map(function (goal) {
        return cloneRuntimeTerm(goal, termSeen);
      }),
      continuationStack: (choice.continuationStack || []).map(function (item) {
        const frozen = {
          kind: item.kind,
          frame: cloneFrame(item.frame, frameSeen),
        };
        if (item.kind === 'goals') {
          frozen.goals = (item.goals || []).map(function (goal) {
            return cloneRuntimeTerm(goal, termSeen);
          });
        } else if (item.kind === 'meta') {
          frozen.term = cloneRuntimeTerm(item.term, termSeen);
        } else {
          throw new Error('Unknown continuation kind: ' + item.kind);
        }
        return frozen;
      }),
      frame: cloneFrame(choice.frame, frameSeen),
      candidateIndex: choice.candidateIndex || 0,
    };
  }

  function appendResumeChoice(pendingInput, choice) {
    if (!pendingInput || !choice) return;
    const termSeen = pendingInput.__termMap || new Map();
    const frameSeen = pendingInput.__frameMap || new Map();
    pendingInput.__termMap = termSeen;
    pendingInput.__frameMap = frameSeen;
    pendingInput.resumeChoices = pendingInput.resumeChoices || [];
    pendingInput.resumeChoices.push(cloneResumeChoice(choice, termSeen, frameSeen));
  }

  function createHistoricalRuntimeError(kind, code, goal, detail) {
    const message = detail || (kind + ' ' + String(code));
    const error = new Error(message);
    error.historical = {
      kind: kind,
      code: code,
      goal: goal ? cloneRuntimeTerm(goal) : null,
      detail: detail || null,
      actualGoal: goal || null,
    };
    return error;
  }

  function abortQuery(queryState) {
    queryState.stopReason = 'aborted';
    return ABORT;
  }

  function historicalErrorInfoFromException(error, goal) {
    if (!error) return null;
    if (error.historical && typeof error.historical.code === 'number') {
      return {
        kind: error.historical.kind || 'Error',
        code: error.historical.code,
        detail: error.historical.detail || error.message || null,
        goal: error.historical.goal || (goal ? cloneRuntimeTerm(goal) : null),
        actualGoal: error.historical.actualGoal || goal || null,
      };
    }
    const message = String(error && error.message ? error.message : error);
    let kind = null;
    let code = null;
    if (message === 'Arithmetic overflow') {
      kind = 'Arithmetic overflow';
      code = 0;
    } else if (message === 'Control error' || /^Expected /.test(message) || /^Meta-goal variable /.test(message) || /^Predicate meta-variable /.test(message) || /^Expected a callable goal form/.test(message) || /^Historical goal forms /.test(message) || /^Clause pattern /.test(message) || /^Historical clause forms /.test(message) || message === 'Clause list cannot be empty.') {
      kind = 'Control error';
      code = 3;
    } else if (message === 'Cannot add clauses for primitive or protected relations.') {
      kind = 'ADDCL error';
      code = 4;
    } else if (message === 'File error') {
      kind = 'File error';
      code = 5;
    } else if (message === 'Too many files opened') {
      kind = 'Too many files error';
      code = 6;
    } else if (message === 'Illegal use of modules') {
      kind = 'Module error';
      code = 12;
    }
    if (code === null) return null;
    return {
      kind: kind,
      code: code,
      detail: message,
      goal: goal ? cloneRuntimeTerm(goal) : null,
      actualGoal: goal || null,
    };
  }

  function appendDefaultErrorMessage(queryState, code) {
    queryState.outputLines.push('Error: ' + String(code));
  }

  function resolveGoalCandidates(workspace, goal, frame) {
    const candidates = [];
    const seen = new Set();

    function append(list) {
      list.forEach(function (clause) {
        if (seen.has(clause)) return;
        seen.add(clause);
        candidates.push(clause);
      });
    }

    if (frame && frame.moduleName) {
      append(Workspace.localClausesForGoal(workspace, frame.moduleName, goal));
    }
    append(Workspace.clausesForGoal(workspace, goal));
    return candidates;
  }

  function freezeSuspensionSnapshot(queryState, target, goalsLeft, continuationStack, currentFrame, extra) {
    const termSeen = new Map();
    const frameSeen = new Map();
    const frozen = {
      target: cloneRuntimeTerm(target, termSeen),
      goalsLeft: goalsLeft.map(function (goal) {
        return cloneRuntimeTerm(goal, termSeen);
      }),
      continuationStack: continuationStack.map(function (item) {
        const frozen = {
          kind: item.kind,
          frame: cloneFrame(item.frame, frameSeen),
        };
        if (item.kind === 'goals') {
          frozen.goals = item.goals.map(function (goal) {
            return cloneRuntimeTerm(goal, termSeen);
          });
        } else if (item.kind === 'meta') {
          frozen.term = cloneRuntimeTerm(item.term, termSeen);
        } else {
          throw new Error('Unknown continuation kind: ' + item.kind);
        }
        return frozen;
      }),
      currentFrame: cloneFrame(currentFrame, frameSeen),
      queryVariables: queryState.queryVariables.map(function (variable) {
        return cloneRuntimeTerm(variable, termSeen);
      }),
      inputBuffer: (queryState.inputBuffer || []).map(function (term) {
        return cloneRuntimeTerm(term, termSeen);
      }),
    };
    if (extra) {
      if (Object.prototype.hasOwnProperty.call(extra, 'prefillText')) {
        frozen.prefillText = extra.prefillText || '';
      }
      if (Object.prototype.hasOwnProperty.call(extra, 'bufferedTerms')) {
        frozen.bufferedTerms = (extra.bufferedTerms || []).map(function (term) {
          return cloneRuntimeTerm(term, termSeen);
        });
      }
      if (Object.prototype.hasOwnProperty.call(extra, 'rememberedNames')) {
        frozen.rememberedNames = new Map();
        if (extra.rememberedNames) {
          extra.rememberedNames.forEach(function (variable, name) {
            frozen.rememberedNames.set(name, cloneRuntimeTerm(variable, termSeen));
          });
        }
      }
      if (Object.prototype.hasOwnProperty.call(extra, 'metaProbeKind')) {
        frozen.metaProbeKind = extra.metaProbeKind || '';
      }
      if (Object.prototype.hasOwnProperty.call(extra, 'metaProbeQueryState')) {
        frozen.metaProbeQueryState = extra.metaProbeQueryState || null;
      }
      if (Object.prototype.hasOwnProperty.call(extra, 'metaProbeOriginalVariables')) {
        frozen.metaProbeOriginalVariables = (extra.metaProbeOriginalVariables || []).map(function (term) {
          return cloneRuntimeTerm(term, termSeen);
        });
      }
      if (Object.prototype.hasOwnProperty.call(extra, 'metaProbeClonedVariables')) {
        frozen.metaProbeClonedVariables = (extra.metaProbeClonedVariables || []).slice();
      }
      if (Object.prototype.hasOwnProperty.call(extra, 'resumeChoices')) {
        frozen.resumeChoices = (extra.resumeChoices || []).map(function (choice) {
          return cloneResumeChoice(choice, termSeen, frameSeen);
        });
      }
    }
    Object.defineProperty(frozen, '__termMap', {
      value: termSeen,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(frozen, '__frameMap', {
      value: frameSeen,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    return frozen;
  }

  function collectQueryVariables(goals) {
    const variables = [];
    const seen = new Set();
    goals.forEach(function (goal) {
      Terms.collectVariables(goal, seen, variables);
    });
    return variables;
  }

  function createQueryState(engine, goals, options) {
    const config = Object.assign({}, engine.options, options || {});
    return {
      engine: engine,
      config: config,
      queryGoals: goals.slice(),
      queryVariables: collectQueryVariables(goals),
      currentGoals: goals.slice(),
      continuationStack: [],
      currentFrame: { parent: null, cut: false, moduleName: (options && options.initialModuleName) || engine.workspace.currentModuleName },
      startModuleName: engine.workspace.currentModuleName,
      restoreModuleOnFinalize: false,
      trail: [],
      steps: 0,
      stopReason: 'done',
      pendingInput: null,
      inputBuffer: [],
      solutions: [],
      solutionTexts: [],
      outputLines: [],
      currentOutputLine: '',
      handlingHistoricalError: false,
      resumeChoices: [],
    };
  }

  function quoteHistoricalAtom(name) {
    return '"' + String(name).replace(/@/g, '@@').replace(/"/g, '@"') + '"';
  }

  function historicalFormatNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
    if (Object.is(value, -0)) value = 0;
    const abs = Math.abs(value);
    if (Number.isInteger(value)) {
      if (abs < 100000) return String(value);
      const text = value.toExponential(5).replace('e', 'E').replace(/E\+?(-?)/, 'E$1');
      return text.replace(/(?:\.0+)(E)/, '$1').replace(/(\.\d*?[1-9])0+(E)/, '$1$2');
    }
    if (abs < 10) return String(value);
    const text = value.toExponential(2).replace('e', 'E').replace(/E\+?(-?)/, 'E$1');
    return text.replace(/(?:\.0+)(E)/, '$1').replace(/(\.\d*?[1-9])0+(E)/, '$1$2');
  }

  function containsHistoricalListStructure(term) {
    const value = Terms.deref(term);
    if (!value) return false;
    if (value.tag === 'Pair' || value.tag === 'Nil') return true;
    if (value.tag === 'Struct') {
      for (let index = 0; index < value.args.length; index += 1) {
        if (containsHistoricalListStructure(value.args[index])) return true;
      }
      if (value.argTail && containsHistoricalListStructure(value.argTail)) return true;
    }
    return false;
  }

  function renderRawOutputTerm(term) {
    const value = Terms.deref(term);
    if (!value) return '?';
    if (value.tag === 'Sym') return value.name;
    if (value.tag === 'Num') return String(value.value);
    if (value.tag === 'Var') return value.nameHint || ('G' + String(value.id));
    if (value.tag === 'Pair') {
      if (looksLikeHistoricalGoalSequence(value)) {
        try {
          const goals = goalListFromMetaTerm(value);
          if (goals.length === 1) {
            return Workspace.renderHistoricalTerm(goals[0], { preferHints: true });
          }
        } catch (error) {
          // Fall back to rendering the historical pair structure itself.
        }
        return Workspace.renderHistoricalTerm(value, { preferHints: true });
      }
      try {
        const goal = historicalGoalFromList(value);
        return Workspace.renderHistoricalTerm(goal, { preferHints: true });
      } catch (error) {
        // Fall through to ordinary list-style raw rendering.
      }
      const parts = Terms.cloneListToArray(value);
      const tail = Terms.deref(parts.tail);
      if (tail && tail.tag === 'Nil') {
        return parts.items.map(function (item) { return renderRawOutputTerm(item); }).join(' ');
      }
    }
    if (value.tag === 'Struct' && containsHistoricalListStructure(value)) {
      return Workspace.renderHistoricalTerm(value, { preferHints: true });
    }
    return Terms.termToString(value, { preferHints: true });
  }

  function atomNeedsQuotes(name) {
    const value = String(name);
    if (/^[\[\]<>{}]$/.test(value)) return false;
    return !/^(?:-?[A-Za-z][A-Za-z0-9-]*|[!#$%&'*+,./:;=?@\^~`-]+)$/.test(value);
  }

  function renderOutputTerm(term, pretty) {
    const value = Terms.deref(term);
    if (!value) return '?';
    if (pretty) {
      if (value.tag === 'Num') return historicalFormatNumber(value.value);
      return Workspace.renderHistoricalTerm(value, { preferHints: true });
    }
    return renderRawOutputTerm(value);
  }

  function appendOutput(queryState, args, newline, pretty, meta) {
    const rendered = args.length > 0 ? args.map(function (arg) {
      return renderOutputTerm(arg, pretty);
    }).join(' ') : '';
    if (rendered) {
      queryState.currentOutputLine += rendered;
    }
    const uiResult = invokeUiOutput(queryState.engine, rendered, Object.assign({
      builtin: meta && meta.builtin ? String(meta.builtin) : (pretty ? 'PP' : 'P'),
      newline: !!newline,
      pretty: !!pretty,
      queryState: queryState,
      goal: meta && meta.goal ? meta.goal : null,
    }, meta || {}));
    if (newline) {
      queryState.outputLines.push(queryState.currentOutputLine);
      queryState.currentOutputLine = '';
    }
    return uiResult;
  }

  function displayVariableNamesForTerm(term) {
    const namesById = new Map();
    const nextName = function () {
      return Terms.historicalVariableNameForIndex(namesById.size);
    };

    function visit(target) {
      const value = Terms.deref(target);
      if (!value) return;
      if (value.tag === 'Var') {
        if (!namesById.has(value.id)) {
          const hinted = value.nameHint ? Terms.canonicalHistoricalVariableName(value.nameHint) : null;
          namesById.set(value.id, hinted || nextName());
        }
        return;
      }
      if (value.tag === 'Struct') {
        value.args.forEach(visit);
        if (value.argTail) visit(value.argTail);
        return;
      }
      if (value.tag === 'Pair') {
        visit(value.head);
        visit(value.tail);
      }
    }

    visit(term);
    return namesById;
  }

  function rememberedVariableNamesForRFILL(term) {
    const byId = displayVariableNamesForTerm(term);
    const variables = [];
    Terms.collectVariables(term, new Set(), variables);
    const remembered = new Map();
    variables.forEach(function (variable) {
      const name = byId.get(variable.id);
      if (name) remembered.set(name, variable);
    });
    return remembered;
  }

  function restoreRememberedVariables(term, rememberedNames, seen) {
    const value = Terms.deref(term);
    if (!value) return value;
    if (!seen) seen = new Map();
    if (value.tag === 'Nil') return Terms.Nil;
    if (value.tag === 'Sym') return Terms.Sym(value.name);
    if (value.tag === 'Num') return Terms.Num(value.value);
    if (seen.has(value)) return seen.get(value);
    if (value.tag === 'Var') {
      const rememberedName = value.nameHint ? Terms.canonicalHistoricalVariableName(value.nameHint) : null;
      if (rememberedName && rememberedNames && rememberedNames.has(rememberedName)) {
        const remembered = rememberedNames.get(rememberedName);
        seen.set(value, remembered);
        return remembered;
      }
      const clone = Terms.Var(value.nameHint);
      seen.set(value, clone);
      if (value.binding) {
        clone.binding = restoreRememberedVariables(value.binding, rememberedNames, seen);
      }
      return clone;
    }
    if (value.tag === 'Struct') {
      const clone = { tag: 'Struct', name: String(value.name), args: [], argTail: null };
      seen.set(value, clone);
      clone.args = value.args.map(function (arg) {
        return restoreRememberedVariables(arg, rememberedNames, seen);
      });
      clone.argTail = value.argTail ? restoreRememberedVariables(value.argTail, rememberedNames, seen) : null;
      return clone;
    }
    if (value.tag === 'Pair') {
      const clone = { tag: 'Pair', head: Terms.Nil, tail: Terms.Nil };
      seen.set(value, clone);
      clone.head = restoreRememberedVariables(value.head, rememberedNames, seen);
      clone.tail = restoreRememberedVariables(value.tail, rememberedNames, seen);
      return clone;
    }
    throw new Error('Unknown term tag while restoring RFILL variables: ' + value.tag);
  }

  function renderRFILLPrefill(term) {
    return cloneProperListItems(term).map(function (item) {
      return Workspace.renderHistoricalTerm(item, { preferHints: true });
    }).join(' ');
  }

  function isProperList(term) {
    let cursor = Terms.deref(term);
    while (cursor && cursor.tag === 'Pair') {
      cursor = Terms.deref(cursor.tail);
    }
    return !!cursor && cursor.tag === 'Nil';
  }

  function integerValue(term, label) {
    const value = Terms.deref(term);
    if (!value || value.tag !== 'Num' || Math.floor(value.value) !== value.value) {
      throw new Error('Expected ' + String(label || 'an integer') + '.');
    }
    return value.value;
  }

  function nonNegativeIntegerValue(term) {
    const value = Terms.deref(term);
    if (!value || value.tag !== 'Num' || value.value < 0 || Math.floor(value.value) !== value.value) {
      throw new Error('Expected a non-negative integer.');
    }
    return value.value;
  }

  function positiveIntegerValue(term) {
    const value = Terms.deref(term);
    if (!value || value.tag !== 'Num' || value.value < 1 || Math.floor(value.value) !== value.value) {
      throw new Error('Expected a positive integer.');
    }
    return value.value;
  }

  function constantName(term, label) {
    const value = Terms.deref(term);
    if (!value || value.tag !== 'Sym') {
      throw new Error('Expected ' + label + ' to be a constant.');
    }
    return value.name;
  }


  function isUnboundVariable(term) {
    const value = Terms.deref(term);
    return !!value && value.tag === 'Var';
  }

  function numericValue(term) {
    const value = Terms.deref(term);
    return value && value.tag === 'Num' ? value.value : null;
  }

  function countUnboundVariables(terms) {
    return terms.reduce(function (count, term) {
      return count + (isUnboundVariable(term) ? 1 : 0);
    }, 0);
  }

  function unifyNumericResult(target, number, trail) {
    return Unify.unify(target, Terms.Num(number), trail);
  }

  function makeCharacterListFromConstant(name) {
    return Terms.list(String(name).split('').map(function (ch) {
      return Terms.Sym(ch);
    }));
  }

  function packCharacterList(term) {
    const parts = Terms.cloneListToArray(term);
    const tail = Terms.deref(parts.tail);
    if (!tail || tail.tag !== 'Nil') return null;
    const chars = [];
    for (let i = 0; i < parts.items.length; i += 1) {
      const value = Terms.deref(parts.items[i]);
      if (!value || value.tag !== 'Sym' || String(value.name).length !== 1) return null;
      chars.push(String(value.name));
    }
    return chars.join('');
  }

  function modulo256Integer(value) {
    const integer = Math.trunc(value);
    return ((integer % 256) + 256) % 256;
  }

  function firstCharacterCode(name) {
    const value = String(name || '');
    return value.length === 0 ? 0 : value.charCodeAt(0);
  }

  function ensureRuntimeRandomState(engine) {
    if (!engine.options.runtimeRandomState) {
      engine.options.runtimeRandomState = { seed: 1 };
    }
    return engine.options.runtimeRandomState;
  }

  function seedRandomState(engine, seedValue) {
    const state = ensureRuntimeRandomState(engine);
    let seed = Number(seedValue);
    if (!Number.isFinite(seed)) seed = 1;
    seed = Math.trunc(seed);
    seed = ((seed % 2147483647) + 2147483647) % 2147483647;
    if (seed === 0) seed = 1;
    state.seed = seed;
    return seed;
  }

  function seedRandomStateFromRuntime(engine) {
    const effects = engine.options && engine.options.randomEffects;
    if (effects && typeof effects.seedFromClock === 'function') {
      return seedRandomState(engine, effects.seedFromClock());
    }
    return seedRandomState(engine, Date.now());
  }

  function nextRandomInteger(engine, limit) {
    const state = ensureRuntimeRandomState(engine);
    if (!(state.seed > 0)) seedRandomState(engine, 1);
    state.seed = (state.seed * 48271) % 2147483647;
    return state.seed % limit;
  }

  function ensureRuntimeFileState(engine) {
    if (!engine.options.runtimeFileState) {
      engine.options.runtimeFileState = { openFile: null };
    }
    return engine.options.runtimeFileState;
  }

  function ensureRuntimeGraphicsState(engine) {
    if (!engine.options.runtimeGraphicsState) {
      engine.options.runtimeGraphicsState = {
        points: Object.create(null),
        mode: 'normal',
        borderColour: 0,
        paperColour: null,
      };
    }
    return engine.options.runtimeGraphicsState;
  }

  function graphicsPointKey(x, y) {
    return String(x) + ',' + String(y);
  }

  function graphicsPointInRange(x, y) {
    return x >= 0 && x <= 175 && y >= 0 && y <= 255;
  }

  function graphicsReadPointAttribute(engine, x, y) {
    const state = ensureRuntimeGraphicsState(engine);
    const key = graphicsPointKey(x, y);
    return Object.prototype.hasOwnProperty.call(state.points, key) ? state.points[key] : 0;
  }

  function graphicsWritePointAttribute(engine, x, y, attribute) {
    const state = ensureRuntimeGraphicsState(engine);
    state.points[graphicsPointKey(x, y)] = modulo256Integer(attribute);
  }

  function graphicsClearScreen(engine, paperColour) {
    const state = ensureRuntimeGraphicsState(engine);
    state.points = Object.create(null);
    if (paperColour !== undefined && paperColour !== null) {
      state.paperColour = modulo256Integer(paperColour);
    }
  }

  function historicalControlCharacter(letter) {
    const value = String(letter || '');
    if (!/^[A-Z]$/.test(value)) return value;
    return String.fromCharCode(value.charCodeAt(0) - 64);
  }

  function decodeHistoricalScreenControlText(rawText) {
    const raw = String(rawText || '');

    function convert(text) {
      let output = '';
      for (let i = 0; i < text.length; i += 1) {
        const ch = text.charAt(i);
        const next = text.charAt(i + 1);
        if (ch === '@' && /^[A-Z]$/.test(next)) {
          output += historicalControlCharacter(next);
          i += 1;
          continue;
        }
        output += ch;
      }
      return output;
    }

    if (raw === '@R@G') {
      return { text: convert(raw), errorCode: 22 };
    }
    if (raw === '@I@P') {
      return { text: convert(raw) + 'D', errorCode: 22 };
    }
    const rbIndex = raw.indexOf('@R@B');
    if (rbIndex >= 0) {
      return { text: convert(raw.slice(0, rbIndex + 4)), errorCode: 22 };
    }
    return { text: convert(raw), errorCode: null };
  }

  function openNamedFileForWrite(engine, fileName) {
    const state = ensureRuntimeFileState(engine);
    if (state.openFile) {
      if (state.openFile.mode === 'write' && state.openFile.name === fileName) {
        throw new Error('File error');
      }
      throw new Error('Too many files opened');
    }
    state.openFile = { name: fileName, mode: 'write', text: '' };
  }

  function openNamedFileForRead(engine, fileName) {
    const state = ensureRuntimeFileState(engine);
    if (state.openFile) {
      throw new Error('Too many files opened');
    }
    let text;
    try {
      text = readNamedFile(engine, fileName, 'open');
    } catch (error) {
      throw error;
    }
    let terms;
    try {
      terms = Reader.parseHistoricalTermsText(normalizeFileText(text));
    } catch (error) {
      throw new Error('File error');
    }
    state.openFile = { name: fileName, mode: 'read', terms: terms, index: 0 };
  }

  function requireOpenReadableFile(engine, fileName) {
    const state = ensureRuntimeFileState(engine);
    if (!state.openFile || state.openFile.mode !== 'read' || state.openFile.name !== fileName) {
      throw new Error('File error');
    }
    return state.openFile;
  }

  function readNamedOpenFileTerm(engine, fileName) {
    const openFile = requireOpenReadableFile(engine, fileName);
    if (openFile.index >= openFile.terms.length) {
      throw new Error('File error');
    }
    const term = openFile.terms[openFile.index];
    openFile.index += 1;
    return cloneRuntimeTerm(term);
  }

  function requireOpenWritableFile(engine, fileName) {
    const state = ensureRuntimeFileState(engine);
    if (!state.openFile || state.openFile.mode !== 'write' || state.openFile.name !== fileName) {
      throw new Error('File error');
    }
    return state.openFile;
  }

  function appendNamedOpenFile(engine, fileName, text) {
    const openFile = requireOpenWritableFile(engine, fileName);
    openFile.text += String(text || '');
  }

  function closeNamedFile(engine, fileName) {
    const state = ensureRuntimeFileState(engine);
    if (!state.openFile || state.openFile.name !== fileName) {
      throw new Error('File error');
    }
    const openFile = state.openFile;
    state.openFile = null;
    if (openFile.mode === 'write') {
      writeNamedFile(engine, fileName, openFile.text, 'close');
    }
  }

  function renderFileOutputSequence(term, pretty, newline) {
    const parts = cloneProperListItems(term).map(function (item) {
      return renderOutputTerm(item, pretty);
    }).join(' ');
    return parts + (newline ? '\n' : '');
  }

  function writeNamedFile(engine, fileName, text, kind) {
    const effects = engine.options && engine.options.fileEffects;
    if (effects && typeof effects.writeNamedFile === 'function') {
      effects.writeNamedFile(fileName, text, { kind: kind || 'write' });
      return;
    }
    if (!engine.options.fileStore) engine.options.fileStore = Object.create(null);
    engine.options.fileStore[fileName] = text;
  }

  function readNamedFile(engine, fileName, kind) {
    const effects = engine.options && engine.options.fileEffects;
    if (effects && typeof effects.readNamedFile === 'function') {
      const loaded = effects.readNamedFile(fileName, { kind: kind || 'load' });
      if (typeof loaded === 'string') return loaded;
      throw new Error('File error');
    }
    if (engine.options && engine.options.fileStore && Object.prototype.hasOwnProperty.call(engine.options.fileStore, fileName)) {
      return String(engine.options.fileStore[fileName]);
    }
    throw new Error('File error');
  }

  function normalizeFileText(text) {
    return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function nonEmptyFileLines(text) {
    return normalizeFileText(text).split('\n').map(function (line) {
      return line.trim();
    }).filter(function (line) {
      return line.length > 0;
    });
  }

  function constantNamesFromProperList(term, label) {
    return cloneProperListItems(term).map(function (item) {
      return constantName(item, label);
    });
  }

  function parseModuleHeaderLines(lines, index) {
    if (index + 3 >= lines.length) return null;
    try {
      const moduleNameTerm = Reader.parseHistoricalTermText(lines[index]);
      const exportListTerm = Reader.parseHistoricalTermText(lines[index + 1]);
      const importListTerm = Reader.parseHistoricalTermText(lines[index + 2]);
      const markerTerm = Reader.parseHistoricalTermText(lines[index + 3]);
      const markerValue = Terms.deref(markerTerm);
      const moduleNameValue = Terms.deref(moduleNameTerm);
      if (!moduleNameValue || moduleNameValue.tag !== 'Sym') return null;
      if (!markerValue || markerValue.tag !== 'Sym' || markerValue.name !== ':') return null;
      return {
        moduleName: moduleNameValue.name,
        exportsList: constantNamesFromProperList(exportListTerm, 'export list'),
        importsList: constantNamesFromProperList(importListTerm, 'import list'),
        nextIndex: index + 4,
      };
    } catch (error) {
      return null;
    }
  }

  function looksLikeModuleFileText(text) {
    const lines = nonEmptyFileLines(text);
    return !!parseModuleHeaderLines(lines, 0);
  }

  function classifyLoadFileText(text) {
    const normalized = normalizeFileText(text);
    if (looksLikeModuleFileText(normalized)) {
      return { kind: 'saved-module', text: normalized };
    }
    try {
      return Reader.parseHistoricalLoadSourceText(normalized);
    } catch (error) {
      throw new Error('File error');
    }
  }

  function applySourceLoadEntryToWorkspace(workspace, fileName, entry) {
    if (!entry) return;
    if (entry.kind === 'clause') {
      const classifiedError = Workspace.classifyProgramLoadClauseError(workspace, fileName, entry.clause);
      if (classifiedError) {
        throw new Error(classifiedError);
      }
      Workspace.addClause(workspace, entry.clause);
      return;
    }
    if (entry.kind === 'module-open') {
      Workspace.createModule(workspace, entry.moduleNameTerm, entry.exportListTerm, entry.importListTerm);
      return;
    }
    if (entry.kind === 'module-close') {
      Workspace.closeCurrentModule(workspace);
      return;
    }
    throw new Error('File error');
  }

  function loadProgramEntriesIntoWorkspace(workspace, entries, fileName) {
    (entries || []).forEach(function (entry) {
      applySourceLoadEntryToWorkspace(workspace, fileName, entry);
    });
  }

  function loadProgramTextIntoWorkspace(workspace, text, fileName) {
    const classified = Reader.parseHistoricalLoadSourceText(normalizeFileText(text));
    if (classified.kind !== 'program') {
      throw new Error('File error');
    }
    loadProgramEntriesIntoWorkspace(workspace, classified.entries, fileName);
  }

  function loadModuleEntriesIntoWorkspace(workspace, entries) {
    (entries || []).forEach(function (entry) {
      applySourceLoadEntryToWorkspace(workspace, null, entry);
    });
  }

  function loadModuleTextIntoWorkspace(workspace, text) {
    const lines = nonEmptyFileLines(text);
    let index = 0;

    while (index < lines.length) {
      const header = parseModuleHeaderLines(lines, index);
      if (!header) throw new Error('File error');
      Workspace.createModule(workspace, Terms.Sym(header.moduleName), Terms.list(header.exportsList.map(function (name) { return Terms.Sym(name); })), Terms.list(header.importsList.map(function (name) { return Terms.Sym(name); })));
      index = header.nextIndex;
      let closed = false;
      while (index < lines.length) {
        const term = Reader.parseHistoricalTermText(lines[index]);
        const value = Terms.deref(term);
        if (value && value.tag === 'Sym' && value.name === 'CLMOD') {
          Workspace.closeCurrentModule(workspace);
          index += 1;
          closed = true;
          break;
        }
        const entries = Reader.parseHistoricalSourceText(lines[index]);
        if (entries.length !== 1 || entries[0].kind !== 'clause') {
          throw new Error('File error');
        }
        Workspace.addClause(workspace, entries[0].clause);
        index += 1;
      }
      if (!closed) throw new Error('File error');
    }
  }

  function loadNamedFileIntoWorkspace(engine, fileName) {
    if (Workspace.fileNameConflicts(engine.workspace, fileName)) {
      throw new Error('File error');
    }
    const text = readNamedFile(engine, fileName, 'load');
    const classified = classifyLoadFileText(text);
    if (classified.kind === 'saved-module') {
      loadModuleTextIntoWorkspace(engine.workspace, classified.text);
      return;
    }
    if (classified.kind === 'module') {
      loadModuleEntriesIntoWorkspace(engine.workspace, classified.entries);
      return;
    }
    loadProgramEntriesIntoWorkspace(engine.workspace, classified.entries, fileName);
  }

  function uiBuiltinHook(engine) {
    return engine && engine.options && engine.options.uiEffects && typeof engine.options.uiEffects.handleBuiltin === 'function'
      ? engine.options.uiEffects.handleBuiltin
      : null;
  }

  function uiOutputHook(engine) {
    return engine && engine.options && engine.options.uiEffects && typeof engine.options.uiEffects.handleOutput === 'function'
      ? engine.options.uiEffects.handleOutput
      : null;
  }

  function invokeUiBuiltin(engine, name, args, meta) {
    const hook = uiBuiltinHook(engine);
    if (!hook) return null;
    return hook(String(name), args.slice(), Object.assign({ builtin: String(name) }, meta || {}));
  }

  function invokeUiOutput(engine, text, meta) {
    const hook = uiOutputHook(engine);
    if (!hook) return null;
    return hook(String(text || ''), Object.assign({ text: String(text || '') }, meta || {}));
  }
  function finalizeQueryState(queryState) {
    if (!queryState.pendingInput
        && queryState.restoreModuleOnFinalize
        && queryState.engine
        && queryState.engine.workspace
        && Object.prototype.hasOwnProperty.call(queryState, 'startModuleName')) {
      queryState.engine.workspace.currentModuleName = queryState.startModuleName || queryState.engine.workspace.rootModuleName;
    }
    queryState.solutionTexts = queryState.solutions.map(function (bindingSet) {
      if (bindingSet.length === 0) return 'YES';
      return bindingSet.map(function (item) {
        const renderedName = item.variableName || Terms.termToString(item.variable, { preferHints: true });
        return renderedName + ' = ' + Terms.termToString(item.value, { preferHints: true });
      }).join(', ');
    });
    const outputLines = queryState.outputLines.slice();
    if (queryState.currentOutputLine) {
      outputLines.push((queryState.config && queryState.config.preserveHistoricalNonNewlineMarkers ? HISTORICAL_NON_NEWLINE_OUTPUT_PREFIX : '') + queryState.currentOutputLine);
    }
    return {
      goals: queryState.queryGoals,
      steps: queryState.steps,
      stopReason: queryState.stopReason,
      solutions: queryState.solutions,
      solutionTexts: queryState.solutionTexts,
      outputLines: outputLines,
      suspended: !!queryState.pendingInput,
      prompt: queryState.pendingInput ? 'input?' : null,
      prefillText: queryState.pendingInput && queryState.pendingInput.prefillText ? queryState.pendingInput.prefillText : null,
      moduleName: queryState.engine && queryState.engine.workspace ? queryState.engine.workspace.currentModuleName : null,
      currentModuleName: queryState.engine && queryState.engine.workspace ? queryState.engine.workspace.currentModuleName : null,
    };
  }

  function normalizeMetaGoalTermFromArgs(name, args) {
    if (!Array.isArray(args) || args.length === 0) {
      throw new Error('Control error');
    }
    if (args.length === 1) {
      return args[0];
    }
    const head = Terms.deref(args[0]);
    if (!head || (head.tag !== 'Sym' && head.tag !== 'Num')) {
      throw new Error('Control error');
    }
    const goalName = head.tag === 'Num' ? String(head.value) : head.name;
    return Terms.Struct(goalName, args.slice(1));
  }

  function applyProbeSolutionBindings(originalVariables, clonedVariables, bindingSet, trail) {
    const byCloneId = new Map();
    (bindingSet || []).forEach(function (entry) {
      if (entry && entry.variable) byCloneId.set(entry.variable.id, Terms.deref(entry.value));
    });
    for (let i = 0; i < originalVariables.length; i += 1) {
      const originalVariable = originalVariables[i];
      const clonedVariable = clonedVariables[i];
      const boundValue = byCloneId.get(clonedVariable.id);
      if (typeof boundValue === 'undefined') continue;
      if (!Unify.unify(originalVariable, cloneRuntimeTerm(boundValue), trail)) {
        return false;
      }
    }
    return true;
  }

  function advanceQuery(queryState) {
    const trail = queryState.trail;

    function step() {
      queryState.steps += 1;
      if (queryState.steps > queryState.config.maxSteps) {
        queryState.stopReason = 'maxSteps';
        return false;
      }
      return true;
    }

    function unwindAndReturn(mark, result) {
      Unify.unwindTrail(trail, mark);
      return result;
    }

    function dispatchHistoricalError(errorInfo, offenderGoal, restGoals, continuationStack, currentFrame) {
      if (!errorInfo) throw new Error('Missing historical error information.');
      if (queryState.handlingHistoricalError) {
        appendDefaultErrorMessage(queryState, errorInfo.code);
        return abortQuery(queryState);
      }
      const errorGoal = Terms.Struct('?ERROR?', [Terms.Num(errorInfo.code), offenderGoal]);
      const handlers = Workspace.clausesForGoal(queryState.engine.workspace, errorGoal);
      if (!handlers || handlers.length === 0) {
        appendDefaultErrorMessage(queryState, errorInfo.code);
        return abortQuery(queryState);
      }
      const wasHandling = queryState.handlingHistoricalError;
      queryState.handlingHistoricalError = true;
      try {
        return prove([errorGoal].concat(restGoals), continuationStack, currentFrame);
      } finally {
        queryState.handlingHistoricalError = wasHandling;
      }
    }


    function runMetaProbe(metaTerm, maxSolutions, currentFrame, extraOptions) {
      const metaVariables = [];
      Terms.collectVariables(metaTerm, new Set(), metaVariables);
      const cloned = cloneRuntimeTermsTogether([metaTerm].concat(metaVariables));
      const clonedMetaTerm = cloned[0];
      const clonedVariables = cloned.slice(1);
      const probeEngine = createEngine(queryState.engine.workspace, queryState.engine.options);
      const probeGoals = goalListFromMetaTerm(clonedMetaTerm);
      const probeConfig = Object.assign({
        maxSteps: queryState.config.maxSteps,
        maxSolutions: maxSolutions || queryState.config.maxSolutions,
        initialModuleName: currentFrame && currentFrame.moduleName ? currentFrame.moduleName : queryState.engine.workspace.currentModuleName,
      }, extraOptions || {});
      const probeState = createQueryState(probeEngine, probeGoals, probeConfig);
      const probeResult = advanceQuery(probeState);
      ['runtimeRandomState', 'runtimePioState', 'runtimeFileState', 'runtimeGraphicsState', 'fileStore'].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(probeEngine.options, key)) {
          queryState.engine.options[key] = probeEngine.options[key];
        }
      });
      return {
        result: probeResult,
        queryState: probeState,
        originalVariables: metaVariables,
        clonedVariables: clonedVariables,
      };
    }

    function runMetaProbeOnce(metaTerm, currentFrame) {
      return runMetaProbe(metaTerm, queryState.config.maxSolutions, currentFrame, { stopOnFirstSolution: true });
    }

    function continueFromProbe(probe, restGoals, continuationStack, currentFrame) {
      const probeResult = probe.result;
      if (probeResult.stopReason === 'aborted') {
        Array.prototype.push.apply(queryState.outputLines, probeResult.outputLines || []);
        queryState.stopReason = 'aborted';
        return ABORT;
      }
      if (probeResult.outputLines && probeResult.outputLines.length) {
        Array.prototype.push.apply(queryState.outputLines, probeResult.outputLines);
      }
      for (let i = 0; i < probeResult.solutions.length; i += 1) {
        const candidateMark = trail.length;
        if (!applyProbeSolutionBindings(probe.originalVariables, probe.clonedVariables, probeResult.solutions[i], trail)) {
          Unify.unwindTrail(trail, candidateMark);
          continue;
        }
        const result = prove(restGoals, continuationStack, currentFrame);
        Unify.unwindTrail(trail, candidateMark);
        if (isStop(result) || isSuspend(result)) return result;
        if (isCut(result)) return result;
      }
      return null;
    }

    function runDeterministicMetaBranch(metaTerm, currentFrame, restGoals, continuationStack) {
      const branchGoals = goalListFromMetaTerm(metaTerm);
      let committed = false;
      for (let i = 0; i < branchGoals.length; i += 1) {
        const goal = branchGoals[i];
        if (goal && goal.tag === 'Struct' && goal.name === '/' && goal.args.length === 0) {
          committed = true;
          continue;
        }
        const probe = runMetaProbe(goal, 1, currentFrame);
        if (probe.result.suspended) {
          const remainingGoals = branchGoals.slice(i);
          const remainingProbe = runMetaProbe(metaTermFromGoalList(remainingGoals), 1, currentFrame, { stopOnFirstSolution: true });
          if (remainingProbe.result.outputLines && remainingProbe.result.outputLines.length) {
            Array.prototype.push.apply(queryState.outputLines, remainingProbe.result.outputLines);
          }
          if (remainingProbe.result.suspended) {
            queryState.pendingInput = freezeSuspensionSnapshot(queryState, Terms.Nil, restGoals, continuationStack, currentFrame, {
              metaProbeKind: 'deterministic-branch',
              metaProbeQueryState: remainingProbe.queryState,
              metaProbeOriginalVariables: remainingProbe.originalVariables,
              metaProbeClonedVariables: remainingProbe.clonedVariables,
            });
            return { outcome: SUSPEND, committed: committed };
          }
          if (remainingProbe.result.stopReason === 'aborted') {
            queryState.stopReason = 'aborted';
            return { outcome: ABORT, committed: committed };
          }
          if (!remainingProbe.result.solutions.length) {
            return { outcome: null, committed: committed };
          }
          if (!applyProbeSolutionBindings(remainingProbe.originalVariables, remainingProbe.clonedVariables, remainingProbe.result.solutions[0], trail)) {
            return { outcome: null, committed: committed };
          }
          return { outcome: 'success', committed: committed };
        }
        if (probe.result.stopReason === 'aborted') {
          Array.prototype.push.apply(queryState.outputLines, probe.result.outputLines || []);
          queryState.stopReason = 'aborted';
          return { outcome: ABORT, committed: committed };
        }
        if (probe.result.outputLines && probe.result.outputLines.length) {
          Array.prototype.push.apply(queryState.outputLines, probe.result.outputLines);
        }
        if (!probe.result.solutions.length) {
          return { outcome: null, committed: committed };
        }
        if (!applyProbeSolutionBindings(probe.originalVariables, probe.clonedVariables, probe.result.solutions[0], trail)) {
          return { outcome: null, committed: committed };
        }
      }
      return { outcome: 'success', committed: committed };
    }


    function proveGoalCandidates(currentGoal, restGoals, activeContinuations, activeFrame, startIndex) {
      const candidates = resolveGoalCandidates(queryState.engine.workspace, currentGoal, activeFrame);
      if (candidates.length === 0) {
        if (startIndex && startIndex > 0) {
          return activeFrame && activeFrame.cut ? cutSignal(activeFrame) : null;
        }
        throw createHistoricalRuntimeError('Clause error', 2, currentGoal);
      }
        for (let i = startIndex || 0; i < candidates.length; i += 1) {
          if (queryState.stopReason !== 'done') return STOP;
          const mark = trail.length;
          const freshClause = Freshen.freshenClause(candidates[i]);
          const clauseFrame = {
            parent: activeFrame,
            cut: false,
            moduleName: freshClause.ownerModuleName || (activeFrame && activeFrame.moduleName) || queryState.engine.workspace.currentModuleName,
            topLevelQuestionWrapper: !!(
              freshClause.head
              && freshClause.head.tag === 'Struct'
              && freshClause.head.name === '?'
              && activeFrame
              && !activeFrame.parent
            ),
          };

          if (!Unify.unify(currentGoal, freshClause.head, trail)) {
            Unify.unwindTrail(trail, mark);
            continue;
          }

          let clauseContinuations = [{ kind: 'goals', goals: restGoals, frame: activeFrame }].concat(activeContinuations);
          if (freshClause.bodyTail) {
            clauseContinuations = [{ kind: 'meta', term: freshClause.bodyTail, frame: clauseFrame }].concat(clauseContinuations);
          }

          const result = prove(freshClause.body.slice(), clauseContinuations, clauseFrame);
          if (isSuspend(result) && queryState.pendingInput && (i + 1) < candidates.length) {
            appendResumeChoice(queryState.pendingInput, {
              kind: 'goal-choice',
              goal: currentGoal,
              restGoals: restGoals,
              continuationStack: activeContinuations,
              frame: activeFrame,
              candidateIndex: i + 1,
            });
          }
          Unify.unwindTrail(trail, mark);
          if (isStop(result) || isSuspend(result) || isAbort(result)) return result;
          if (isCut(result)) {
            if (result.target === clauseFrame) {
              return null;
            }
            return result;
          }
          if (clauseFrame.cut) {
            return null;
          }
        }

      return activeFrame && activeFrame.cut ? cutSignal(activeFrame) : null;
    }

    function runResumeChoices() {
      while (queryState.resumeChoices && queryState.resumeChoices.length > 0) {
        const choice = queryState.resumeChoices.shift();
        if (!choice || choice.kind !== 'goal-choice') {
          throw new Error('Unknown resume choice kind: ' + (choice && choice.kind));
        }
        const result = proveGoalCandidates(choice.goal, choice.restGoals || [], choice.continuationStack || [], choice.frame || null, choice.candidateIndex || 0);
        if (isSuspend(result)) {
          if (queryState.pendingInput && queryState.resumeChoices.length > 0) {
            queryState.resumeChoices.forEach(function (remainingChoice) {
              appendResumeChoice(queryState.pendingInput, remainingChoice);
            });
            queryState.resumeChoices = [];
          }
          return result;
        }
        if (isStop(result) || isAbort(result) || isCut(result)) return result;
      }
      return null;
    }

    function collectIsAllSolutions(captureTerm, goalTerms, currentFrame) {
      const resultVariable = Terms.Var('X');
      const cloned = cloneRuntimeTermsTogether([captureTerm].concat(goalTerms));
      const clonedCapture = cloned[0];
      const clonedGoals = cloned.slice(1);
      const subGoals = clonedGoals.concat([Terms.Struct('=', [resultVariable, clonedCapture])]);
      const savedSolutions = queryState.solutions;
      const savedQueryVariables = queryState.queryVariables;
      const savedMaxSolutions = queryState.config.maxSolutions;
      const savedStopOnFirstSolution = !!queryState.config.stopOnFirstSolution;
      const collectedSolutions = [];
      queryState.solutions = collectedSolutions;
      queryState.queryVariables = [resultVariable];
      queryState.config.maxSolutions = Number.MAX_SAFE_INTEGER;
      queryState.config.stopOnFirstSolution = false;
      try {
        const result = prove(subGoals, [], {
          parent: null,
          cut: false,
          moduleName: currentFrame && currentFrame.moduleName ? currentFrame.moduleName : queryState.engine.workspace.currentModuleName,
        });
        return {
          result: result,
          values: listFromSolutionSnapshots(collectedSolutions),
        };
      } finally {
        queryState.solutions = savedSolutions;
        queryState.queryVariables = savedQueryVariables;
        queryState.config.maxSolutions = savedMaxSolutions;
        queryState.config.stopOnFirstSolution = savedStopOnFirstSolution;
      }
    }

    function prove(goalsLeft, continuationStack, currentFrame) {
      if (queryState.stopReason !== 'done') return STOP;
      if (!step()) return STOP;

      let activeGoals = goalsLeft;
      let activeContinuations = continuationStack;
      let activeFrame = currentFrame;

      while (activeGoals.length === 0) {
        if (activeContinuations.length === 0) {
          queryState.solutions.push(snapshotBindings(queryState.queryVariables));
          if (queryState.config.stopOnFirstSolution) {
            queryState.stopReason = 'maxSolutions';
            return STOP;
          }
          if (queryState.solutions.length >= queryState.config.maxSolutions) {
            queryState.stopReason = 'maxSolutions';
            return STOP;
          }
          if (activeFrame && activeFrame.cut) {
            return cutSignal(activeFrame);
          }
          return null;
        }

        const nextContinuation = activeContinuations[0];
        activeContinuations = activeContinuations.slice(1);
        activeFrame = nextContinuation.frame;
        if (nextContinuation.kind === 'goals') {
          activeGoals = nextContinuation.goals.slice();
          continue;
        }
        if (nextContinuation.kind === 'meta') {
          activeGoals = goalListFromMetaTerm(nextContinuation.term);
          continue;
        }
        throw new Error('Unknown continuation kind: ' + nextContinuation.kind);
      }

      const currentGoal = Terms.deref(activeGoals[0]);
      const restGoals = activeGoals.slice(1);

      if (isMetaGoal(currentGoal)) {
        let metaGoals;
        try {
          metaGoals = goalListFromMetaTerm(currentGoal);
        } catch (error) {
          const errorInfo = historicalErrorInfoFromException(error, currentGoal);
          if (!errorInfo) throw error;
          return dispatchHistoricalError(errorInfo, currentGoal, restGoals, activeContinuations, activeFrame);
        }
        return prove(
          metaGoals,
          [{ kind: 'goals', goals: restGoals, frame: activeFrame }].concat(activeContinuations),
          activeFrame
        );
      }

      const builtinRelationName = builtinName(currentGoal);
      const preferUserDefinedOne = builtinRelationName === 'ONE'
        && resolveGoalCandidates(queryState.engine.workspace, currentGoal, activeFrame).length > 0;
      if (isMalformedPrimitiveCall(currentGoal) && !preferUserDefinedOne) {
        return dispatchHistoricalError({
          kind: 'Control error',
          code: 3,
          detail: 'Control error',
          goal: cloneRuntimeTerm(currentGoal),
          actualGoal: currentGoal,
        }, currentGoal, restGoals, activeContinuations, activeFrame);
      }

      if (isBuiltin(currentGoal) && !preferUserDefinedOne) {
        try {
          const builtinResult = runBuiltin(currentGoal, trail, restGoals, activeContinuations, activeFrame);
          if (builtinResult === null && activeFrame && activeFrame.cut) {
            return cutSignal(activeFrame);
          }
          return builtinResult;
        } catch (error) {
          const errorInfo = historicalErrorInfoFromException(error, currentGoal);
          if (!errorInfo) throw error;
          if (errorInfo.actualGoal && errorInfo.actualGoal !== currentGoal) throw error;
          return dispatchHistoricalError(errorInfo, currentGoal, restGoals, activeContinuations, activeFrame);
        }
      }

      try {
        return proveGoalCandidates(currentGoal, restGoals, activeContinuations, activeFrame, 0);
      } catch (error) {
        const errorInfo = historicalErrorInfoFromException(error, currentGoal);
        if (!errorInfo) throw error;
        if (errorInfo.actualGoal && errorInfo.actualGoal !== currentGoal) throw error;
        return dispatchHistoricalError(errorInfo, currentGoal, restGoals, activeContinuations, activeFrame);
      }
    }

    function isBuiltin(goal) {
      return isWellFormedPrimitiveCall(goal);
    }

    function runBuiltin(goal, builtinTrail, restGoals, continuationStack, currentFrame) {
      const mark = builtinTrail.length;
      const name = builtinName(goal);
      const args = builtinArgs(goal);

      if (name === 'TRUE' && args.length === 0) {
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'FAIL' && args.length === 0) {
        return unwindAndReturn(mark, null);
      }
      if (name === 'ABORT' && args.length === 0) {
        return unwindAndReturn(mark, abortQuery(queryState));
      }
      if (name === 'NEW' && (args.length === 0 || args.length === 1)) {
        const freshWorkspace = Workspace.createWorkspace();
        Workspace.installDerivedSupport(freshWorkspace);
        Workspace.restoreWorkspace(queryState.engine.workspace, Workspace.snapshotWorkspace(freshWorkspace));
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'QT' && (args.length === 0 || args.length === 1)) {
        queryState.stopReason = 'quit';
        return unwindAndReturn(mark, STOP);
      }
      if (name === 'NOT' && args.length >= 1) {
        const probe = runMetaProbe(normalizeMetaGoalTermFromArgs(name, args), 1, currentFrame);
        if (probe.result.stopReason === 'aborted') {
          Array.prototype.push.apply(queryState.outputLines, probe.result.outputLines || []);
          queryState.stopReason = 'aborted';
          return unwindAndReturn(mark, ABORT);
        }
        return unwindAndReturn(mark, probe.result.solutions.length === 0 ? prove(restGoals, continuationStack, currentFrame) : null);
      }
      if (name === 'OR' && args.length === 2) {
        const leftBranch = runDeterministicMetaBranch(args[0], currentFrame, restGoals, continuationStack);
        if (leftBranch.outcome === ABORT) {
          return unwindAndReturn(mark, ABORT);
        }
        if (leftBranch.outcome === SUSPEND) {
          return unwindAndReturn(mark, SUSPEND);
        }
        if (leftBranch.outcome === 'success') {
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (leftBranch.committed) {
          return unwindAndReturn(mark, null);
        }
        const rightBranch = runDeterministicMetaBranch(args[1], currentFrame, restGoals, continuationStack);
        if (rightBranch.outcome === ABORT) {
          return unwindAndReturn(mark, ABORT);
        }
        if (rightBranch.outcome === SUSPEND) {
          return unwindAndReturn(mark, SUSPEND);
        }
        if (rightBranch.outcome === 'success') {
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        return unwindAndReturn(mark, null);
      }
      if (name === 'IF' && (args.length === 2 || args.length === 3)) {
        const probe = runMetaProbe(args[0], 1, currentFrame);
        if (probe.result.stopReason === 'aborted') {
          Array.prototype.push.apply(queryState.outputLines, probe.result.outputLines || []);
          queryState.stopReason = 'aborted';
          return unwindAndReturn(mark, ABORT);
        }
        if (probe.result.solutions.length > 0) {
          const thenContinuation = [{ kind: 'goals', goals: restGoals, frame: currentFrame }].concat(continuationStack);
          return unwindAndReturn(mark, continueFromProbe(probe, goalListFromMetaTerm(args[1]), thenContinuation, currentFrame));
        }
        if (args.length === 3) {
          return unwindAndReturn(mark, prove(goalListFromMetaTerm(args[2]), [{ kind: 'goals', goals: restGoals, frame: currentFrame }].concat(continuationStack), currentFrame));
        }
        return unwindAndReturn(mark, null);
      }
      if ((name === 'ONE' || name === '!') && args.length >= 1) {
        const probe = runMetaProbe(normalizeMetaGoalTermFromArgs(name, args), 1, currentFrame);
        if (probe.result.stopReason === 'aborted') {
          Array.prototype.push.apply(queryState.outputLines, probe.result.outputLines || []);
          queryState.stopReason = 'aborted';
          return unwindAndReturn(mark, ABORT);
        }
        return unwindAndReturn(mark, continueFromProbe(probe, restGoals, continuationStack, currentFrame));
      }
      if (name === 'FORALL' && args.length === 2) {
        const probe = runMetaProbe(args[0], queryState.config.maxSolutions, currentFrame);
        if (probe.result.stopReason === 'aborted') {
          Array.prototype.push.apply(queryState.outputLines, probe.result.outputLines || []);
          queryState.stopReason = 'aborted';
          return unwindAndReturn(mark, ABORT);
        }
        for (let i = 0; i < probe.result.solutions.length; i += 1) {
          const candidateMark = trail.length;
          if (!applyProbeSolutionBindings(probe.originalVariables, probe.clonedVariables, probe.result.solutions[i], trail)) {
            Unify.unwindTrail(trail, candidateMark);
            return unwindAndReturn(mark, null);
          }
          const bodyProbe = runMetaProbe(args[1], 1);
          Unify.unwindTrail(trail, candidateMark);
          if (bodyProbe.result.stopReason === 'aborted') {
            Array.prototype.push.apply(queryState.outputLines, bodyProbe.result.outputLines || []);
            queryState.stopReason = 'aborted';
            return unwindAndReturn(mark, ABORT);
          }
          if (!bodyProbe.result.solutions.length) {
            return unwindAndReturn(mark, null);
          }
          if (bodyProbe.result.outputLines && bodyProbe.result.outputLines.length) {
            Array.prototype.push.apply(queryState.outputLines, bodyProbe.result.outputLines);
          }
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === '?' && args.length === 1) {
        const probe = runMetaProbeOnce(args[0], currentFrame);
        if (probe.result.suspended) {
          queryState.pendingInput = freezeSuspensionSnapshot(queryState, Terms.Nil, restGoals, continuationStack, currentFrame, {
            prefillText: probe.result.prefillText || '',
            metaProbeKind: 'question',
            metaProbeQueryState: probe.queryState,
            metaProbeOriginalVariables: probe.originalVariables,
            metaProbeClonedVariables: probe.clonedVariables,
          });
          return unwindAndReturn(mark, SUSPEND);
        }
        if (probe.result.stopReason === 'aborted') {
          Array.prototype.push.apply(queryState.outputLines, probe.result.outputLines || []);
          queryState.stopReason = 'aborted';
          return unwindAndReturn(mark, ABORT);
        }
        if (probe.result.outputLines && probe.result.outputLines.length) {
          Array.prototype.push.apply(queryState.outputLines, probe.result.outputLines);
        }
        if (!probe.result.solutions.length) {
          return unwindAndReturn(mark, null);
        }
        if (!applyProbeSolutionBindings(probe.originalVariables, probe.clonedVariables, probe.result.solutions[0], trail)) {
          return unwindAndReturn(mark, null);
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if ((name === '=' || name === 'EQ') && args.length === 2) {
        if (!Unify.unify(args[0], args[1], builtinTrail)) return unwindAndReturn(mark, null);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === '/' && args.length === 0) {
        currentFrame.cut = true;
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === '/*') {
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if ((name === 'R' || name === 'ACCEPT') && args.length === 1) {
        if (queryState.inputBuffer && queryState.inputBuffer.length > 0) {
          const buffered = queryState.inputBuffer.shift();
          if (!Unify.unify(args[0], buffered, builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        queryState.pendingInput = freezeSuspensionSnapshot(queryState, args[0], restGoals, continuationStack, currentFrame);
        return unwindAndReturn(mark, SUSPEND);
      }
      if (name === 'RFILL' && args.length === 2) {
        const parts = Terms.cloneListToArray(args[0]);
        const tail = Terms.deref(parts.tail);
        if (!tail || tail.tag !== 'Nil' || parts.items.length === 0) {
          return unwindAndReturn(mark, null);
        }
        const rememberedNames = rememberedVariableNamesForRFILL(parts.items[0]);
        queryState.pendingInput = freezeSuspensionSnapshot(queryState, args[1], restGoals, continuationStack, currentFrame, {
          prefillText: renderRFILLPrefill(args[0]),
          bufferedTerms: parts.items.slice(1),
          rememberedNames: rememberedNames,
        });
        return unwindAndReturn(mark, SUSPEND);
      }
      if (name === 'LST' && args.length === 1) {
        if (!isProperList(args[0])) return unwindAndReturn(mark, null);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'CON' && args.length === 1) {
        const value = Terms.deref(args[0]);
        if (!value || value.tag !== 'Sym') return unwindAndReturn(mark, null);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'NUM' && args.length === 1) {
        const value = Terms.deref(args[0]);
        if (!value || value.tag !== 'Num') return unwindAndReturn(mark, null);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'INT' && (args.length === 1 || args.length === 2)) {
        const value = Terms.deref(args[0]);
        if (args.length === 1) {
          if (!value || value.tag !== 'Num' || !Number.isInteger(value.value)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (!value || value.tag !== 'Num' || !Number.isFinite(value.value)) return unwindAndReturn(mark, null);
        if (!unifyNumericResult(args[1], Math.trunc(value.value), builtinTrail)) return unwindAndReturn(mark, null);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'VAR' && args.length === 1) {
        const value = Terms.deref(args[0]);
        if (!value || value.tag !== 'Var') return unwindAndReturn(mark, null);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'SYS' && args.length === 1) {
        if (!isSystemRelationTerm(args[0])) return unwindAndReturn(mark, null);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'SPACE' && args.length === 1) {
        const freeKilobytes = Workspace.estimateWorkspaceFreeKilobytes(queryState.engine.workspace);
        if (!Unify.unify(args[0], Terms.Num(freeKilobytes), builtinTrail)) return unwindAndReturn(mark, null);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'SUM' && args.length === 3) {
        const variableCount = countUnboundVariables(args);
        if (variableCount > 1) {
          throw new Error('Control error');
        }
        const x = numericValue(args[0]);
        const y = numericValue(args[1]);
        const z = numericValue(args[2]);
        if (variableCount === 0) {
          if (x === null || y === null || z === null) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, (x + y === z) ? prove(restGoals, continuationStack, currentFrame) : null);
        }
        if (x !== null && y !== null && isUnboundVariable(args[2])) {
          if (!unifyNumericResult(args[2], x + y, builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (x !== null && z !== null && isUnboundVariable(args[1])) {
          if (!unifyNumericResult(args[1], z - x, builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (y !== null && z !== null && isUnboundVariable(args[0])) {
          if (!unifyNumericResult(args[0], z - y, builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        return unwindAndReturn(mark, null);
      }
      if (name === 'TIMES' && args.length === 3) {
        const variableCount = countUnboundVariables(args);
        if (variableCount > 1) {
          throw new Error('Control error');
        }
        const x = numericValue(args[0]);
        const y = numericValue(args[1]);
        const z = numericValue(args[2]);
        if (variableCount === 0) {
          if (x === null || y === null || z === null) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, (x * y === z) ? prove(restGoals, continuationStack, currentFrame) : null);
        }
        if (x !== null && y !== null && isUnboundVariable(args[2])) {
          if (!unifyNumericResult(args[2], x * y, builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (x !== null && z !== null && isUnboundVariable(args[1])) {
          if (x === 0) throw new Error('Arithmetic overflow');
          if (!unifyNumericResult(args[1], z / x, builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (y !== null && z !== null && isUnboundVariable(args[0])) {
          if (y === 0) throw new Error('Arithmetic overflow');
          if (!unifyNumericResult(args[0], z / y, builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        return unwindAndReturn(mark, null);
      }
      if (name === 'LESS' && args.length === 2) {
        const left = Terms.deref(args[0]);
        const right = Terms.deref(args[1]);
        if (!left || !right || left.tag === 'Var' || right.tag === 'Var') {
          throw new Error('Control error');
        }
        if (left.tag === 'Num' && right.tag === 'Num') {
          return unwindAndReturn(mark, left.value < right.value ? prove(restGoals, continuationStack, currentFrame) : null);
        }
        if (left.tag === 'Sym' && right.tag === 'Sym') {
          return unwindAndReturn(mark, String(left.name) < String(right.name) ? prove(restGoals, continuationStack, currentFrame) : null);
        }
        return unwindAndReturn(mark, null);
      }
      if (name === 'SIGN' && args.length === 2) {
        const first = Terms.deref(args[0]);
        const second = Terms.deref(args[1]);
        if (!first || first.tag !== 'Num' || !second || second.tag !== 'Var') {
          throw new Error('Control error');
        }
        const sign = first.value > 0 ? 1 : (first.value < 0 ? -1 : 0);
        if (!unifyNumericResult(args[1], sign, builtinTrail)) return unwindAndReturn(mark, null);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'STRINGOF' && args.length === 2) {
        const left = Terms.deref(args[0]);
        const right = Terms.deref(args[1]);
        if (right && right.tag === 'Sym') {
          const unpacked = makeCharacterListFromConstant(right.name);
          if (!Unify.unify(args[0], unpacked, builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (left && (left.tag === 'Pair' || left.tag === 'Nil') && right && right.tag === 'Var') {
          const packed = packCharacterList(left);
          if (packed === null) return unwindAndReturn(mark, null);
          if (!Unify.unify(args[1], Terms.Sym(packed), builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        throw new Error('Control error');
      }
      if (name === 'CHAROF' && args.length === 2) {
        const left = Terms.deref(args[0]);
        const right = Terms.deref(args[1]);
        if ((!left || left.tag === 'Var') && (!right || right.tag === 'Var')) {
          throw new Error('Control error');
        }
        if (left && left.tag === 'Sym') {
          const code = firstCharacterCode(left.name);
          if (!unifyNumericResult(args[1], code, builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (right && right.tag === 'Num') {
          const code = modulo256Integer(right.value);
          if (!Unify.unify(args[0], Terms.Sym(String.fromCharCode(code)), builtinTrail)) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        return unwindAndReturn(mark, null);
      }
      if (name === 'P') {
        const rendered = outputArgs(goal).map(function (arg) {
          return renderOutputTerm(arg, false);
        }).join(' ');
        const decoded = decodeHistoricalScreenControlText(rendered);
        queryState.currentOutputLine += decoded.text;
        const outputResult = invokeUiOutput(queryState.engine, decoded.text, {
          builtin: 'P',
          newline: false,
          pretty: false,
          queryState: queryState,
          goal: goal,
        });
        const outputErrorCode = outputResult && typeof outputResult.errorCode === 'number' && Number.isFinite(outputResult.errorCode)
          ? Math.trunc(outputResult.errorCode)
          : null;
        const historicalErrorCode = decoded.errorCode !== null ? decoded.errorCode : outputErrorCode;
        if (historicalErrorCode !== null) {
          queryState.currentOutputLine += 'Error:  ' + String(historicalErrorCode);
          queryState.outputLines.push(queryState.currentOutputLine);
          queryState.currentOutputLine = '';
          return abortQuery(queryState);
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'PP') {
        appendOutput(queryState, outputArgs(goal), true, true, { builtin: 'PP', goal: goal });
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'CMOD' && args.length === 1) {
        const cmArg = Terms.deref(args[0]);
        if (!cmArg || cmArg.tag !== 'Var') {
          throw createHistoricalRuntimeError('Control error', 3, goal);
        }
        if (!Unify.unify(args[0], Workspace.currentModuleTerm(queryState.engine.workspace), builtinTrail)) {
          return unwindAndReturn(mark, null);
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'CRMOD' && args.length === 3) {
        Workspace.createModule(queryState.engine.workspace, args[0], args[1], args[2]);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'OPMOD' && args.length === 1) {
        if (currentFrame
          && (!currentFrame.parent || currentFrame.topLevelQuestionWrapper)
          && !(queryState.engine.options && queryState.engine.options.allowTopLevelSupervisorModuleOpen)) {
          return unwindAndReturn(mark, null);
        }
        if (currentFrame && currentFrame.parent) {
          queryState.restoreModuleOnFinalize = true;
        }
        Workspace.openModule(queryState.engine.workspace, args[0]);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'CLMOD' && args.length === 0) {
        if (currentFrame && currentFrame.parent) {
          queryState.restoreModuleOnFinalize = true;
        }
        Workspace.closeCurrentModule(queryState.engine.workspace);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'DICT') {
        const argTail = builtinArgTail(goal);
        if (!argTail && args.length === 4) {
          const entries = [];
          const seenDecl = new Set();
          const moduleRecord = Workspace.currentModule(queryState.engine.workspace);
          moduleRecord.clauses.forEach(function (clause) {
            const head = Terms.deref(clause.head);
            const pred = head && (head.tag === 'Struct' || head.tag === 'Sym') ? String(head.name || '') : '';
            const declArgs = head && head.tag === 'Struct' ? head.args.slice() : [];
            if ((pred === 'dict' || pred === 'func' || pred === 'data-rel') && declArgs.length === 1) {
              const key = pred + '|' + Workspace.renderHistoricalTerm(declArgs[0]);
              if (!seenDecl.has(key)) {
                seenDecl.add(key);
                entries.push({ kind: pred, name: declArgs[0] });
              }
            }
          });
          const builtinNames = ['end', 'yes', 'all', 'is', 'one', 'which', 'save', 'load', 'not', 'forall', 'isall', '=', 'and', 'if', 'then', 'either', 'or', ':'];
          builtinNames.forEach(function (entryName) {
            entries.push({ kind: 'data-rel', name: Terms.Sym(entryName) });
          });
          entries.push({ kind: 'data-rel', name: Terms.Sym('dict') });
          entries.push({ kind: 'data-rel', name: Terms.Sym('func') });
          entries.push({ kind: 'data-rel', name: Terms.Sym('data-rel') });
          for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i];
            if (!Unify.unify(args[0], Terms.Sym(entry.kind), builtinTrail)) {
              continue;
            }
            if (!Unify.unify(args[1], entry.name, builtinTrail)) {
              continue;
            }
            if (!Unify.unify(args[2], Terms.list([]), builtinTrail)) {
              continue;
            }
            if (!Unify.unify(args[3], Terms.list([]), builtinTrail)) {
              continue;
            }
            const result = prove(restGoals, continuationStack, currentFrame);
            if (result !== null) {
              return unwindAndReturn(mark, result);
            }
            while (builtinTrail.length > mark) {
              const variable = builtinTrail.pop();
              variable.binding = null;
            }
          }
          return unwindAndReturn(mark, null);
        }
        if (args.length >= 3) {
          const dictionaryArgs = Workspace.currentModuleDictionaryArgs(queryState.engine.workspace);
          if (argTail) {
            if (args.length > dictionaryArgs.length) return unwindAndReturn(mark, null);
            for (let i = 0; i < args.length; i += 1) {
              if (!Unify.unify(args[i], dictionaryArgs[i], builtinTrail)) {
                return unwindAndReturn(mark, null);
              }
            }
            const remainder = Terms.list(dictionaryArgs.slice(args.length));
            if (!Unify.unify(argTail, remainder, builtinTrail)) {
              return unwindAndReturn(mark, null);
            }
            return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
          }
          if (args.length !== dictionaryArgs.length) return unwindAndReturn(mark, null);
          for (let i = 0; i < args.length; i += 1) {
            if (!Unify.unify(args[i], dictionaryArgs[i], builtinTrail)) {
              return unwindAndReturn(mark, null);
            }
          }
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        return unwindAndReturn(mark, null);
      }
      if (name === 'ADDCL' && (args.length === 1 || args.length === 2)) {
        const afterPosition = args.length === 2 ? nonNegativeIntegerValue(args[1]) : null;
        const clause = Workspace.historicalClauseFromTerm(args[0]);
        Workspace.addClause(queryState.engine.workspace, clause, null, { afterPosition: afterPosition });
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'DELCL' && (args.length === 1 || args.length === 2)) {
        if (args.length === 1) {
            const deleted = Workspace.deleteClauseMatchingPattern(queryState.engine.workspace, args[0], function (candidateTerm) {
            return Unify.unify(args[0], candidateTerm, builtinTrail);
          });
          if (!deleted) return unwindAndReturn(mark, null);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        const position = positiveIntegerValue(args[1]);
        if (!Workspace.deleteClauseAtPosition(queryState.engine.workspace, args[0], position)) {
          return unwindAndReturn(mark, null);
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'KILL' && args.length === 1) {
        if (!Workspace.killTarget(queryState.engine.workspace, args[0])) {
          return unwindAndReturn(mark, null);
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'LIST' && args.length === 1) {
        const lines = Workspace.listTargetLines(queryState.engine.workspace, args[0]);
        lines.forEach(function (line) {
          queryState.outputLines.push(line);
        });
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'LISTP' && (args.length === 1 || args.length === 2)) {
        const fileName = constantName(args[0], 'file name');
        const target = args.length === 2 ? args[1] : Terms.Sym('ALL');
        const lines = Workspace.listTargetLines(queryState.engine.workspace, target);
        if (fileName === 'CON:') {
          lines.forEach(function (line) { queryState.outputLines.push(line); });
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        appendNamedOpenFile(queryState.engine, fileName, Workspace.serializeHistoricalLines(lines));
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'SAVE' && (args.length === 1 || args.length === 2)) {
        const fileName = constantName(args[0], 'file name');
        if (Workspace.fileNameConflicts(queryState.engine.workspace, fileName)) {
          throw new Error('File error');
        }
        const lines = Workspace.saveTargetLines(queryState.engine.workspace, args.length === 2 ? args[1] : null);
        writeNamedFile(queryState.engine, fileName, Workspace.serializeHistoricalLines(lines), 'save');
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'LOAD' && args.length === 1) {
        const fileName = constantName(args[0], 'file name');
        loadNamedFileIntoWorkspace(queryState.engine, fileName);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'CREATE' && args.length === 1) {
        const fileName = constantName(args[0], 'file name');
        openNamedFileForWrite(queryState.engine, fileName);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'OPEN' && args.length === 1) {
        const fileName = constantName(args[0], 'file name');
        openNamedFileForRead(queryState.engine, fileName);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'READ' && args.length === 2) {
        const fileName = constantName(args[0], 'file name');
        const target = Terms.deref(args[1]);
        if (!target || target.tag !== 'Var') {
          throw new Error('Control error');
        }
        if (!Unify.unify(args[1], readNamedOpenFileTerm(queryState.engine, fileName), builtinTrail)) {
          return unwindAndReturn(mark, null);
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'WRITE' && args.length === 2) {
        const fileName = constantName(args[0], 'file name');
        appendNamedOpenFile(queryState.engine, fileName, renderFileOutputSequence(args[1], true, true));
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'W' && args.length === 2) {
        const fileName = constantName(args[0], 'file name');
        appendNamedOpenFile(queryState.engine, fileName, renderFileOutputSequence(args[1], false, false));
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'CLOSE' && args.length === 1) {
        const fileName = constantName(args[0], 'file name');
        closeNamedFile(queryState.engine, fileName);
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'RND') {
        if (args.length === 0) {
          seedRandomState(queryState.engine, 12);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (args.length === 1) {
          const seed = integerValue(args[0], 'random seed');
          seedRandomState(queryState.engine, ((Math.trunc(seed) % 16) + 16) % 16);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        const limit = positiveIntegerValue(args[1]);
        const state = ensureRuntimeRandomState(queryState.engine);
        const currentSeed = typeof state.seed === 'number' ? state.seed : 7;
        const nextState = ((currentSeed * 3) + 11) & 15;
        state.seed = nextState;
        const randomValue = Math.floor((nextState * limit) / 16);
        if (!unifyNumericResult(args[0], randomValue, builtinTrail)) {
          return unwindAndReturn(mark, null);
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'HYBRID' || name === 'NORMAL' || name === 'LNE' || name === 'PNT' || name === 'CLS' || name === 'BORDER' || name === 'BP') {
        const uiResult = invokeUiBuiltin(queryState.engine, name, args, {
          mode: 'side-effect',
          queryState: queryState,
          goal: goal,
        });
        if (uiResult && uiResult.outputLine) {
          queryState.outputLines.push(String(uiResult.outputLine));
        }
        if (name === 'HYBRID') {
          ensureRuntimeGraphicsState(queryState.engine).mode = 'hybrid';
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (name === 'NORMAL') {
          ensureRuntimeGraphicsState(queryState.engine).mode = 'normal';
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (name === 'BORDER' && args.length === 1) {
          ensureRuntimeGraphicsState(queryState.engine).borderColour = modulo256Integer(integerValue(args[0], 'a colour number'));
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (name === 'BP' && args.length === 2) {
          integerValue(args[0], 'a duration');
          integerValue(args[1], 'a frequency');
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (name === 'CLS' && (args.length === 0 || args.length === 1)) {
          const colour = args.length === 1 ? integerValue(args[0], 'a colour number') : null;
          graphicsClearScreen(queryState.engine, colour);
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (name === 'LNE' && (args.length === 4 || args.length === 5 || args.length === 6)) {
          const x1 = integerValue(args[0], 'an x coordinate');
          const y1 = integerValue(args[1], 'a y coordinate');
          const x2 = integerValue(args[2], 'an x coordinate');
          const y2 = integerValue(args[3], 'a y coordinate');
          if (!graphicsPointInRange(x1, y1) || !graphicsPointInRange(x2, y2)) {
            throw createHistoricalRuntimeError('Point off screen', 13, goal);
          }
          if (args.length >= 5) integerValue(args[4], 'an attribute number');
          if (args.length >= 6) integerValue(args[5], 'an attribute number');
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (name === 'PNT' && (args.length === 2 || args.length === 3 || args.length === 4)) {
          const x = integerValue(args[0], 'an x coordinate');
          const y = integerValue(args[1], 'a y coordinate');
          if (!graphicsPointInRange(x, y)) {
            throw createHistoricalRuntimeError('Point off screen', 13, goal);
          }
          if (args.length === 2) {
            return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
          }
          if (args.length === 3) {
            const z = Terms.deref(args[2]);
            if (!z || z.tag === 'Var') {
              if (!unifyNumericResult(args[2], graphicsReadPointAttribute(queryState.engine, x, y), builtinTrail)) {
                return unwindAndReturn(mark, null);
              }
              return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
            }
            graphicsWritePointAttribute(queryState.engine, x, y, integerValue(args[2], 'an attribute number'));
            return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
          }
          integerValue(args[2], 'an attribute number');
          graphicsWritePointAttribute(queryState.engine, x, y, integerValue(args[3], 'an attribute number'));
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'PIO' && args.length === 2) {
        const port = integerValue(args[0], 'a port number');
        const pioValue = Terms.deref(args[1]);
        queryState.engine.options.runtimePioState = queryState.engine.options.runtimePioState || Object.create(null);
        if (pioValue && pioValue.tag === 'Num') {
          queryState.engine.options.runtimePioState[String(port)] = (port === 254) ? 191 : 255;
          invokeUiBuiltin(queryState.engine, 'PIO', args, {
            mode: 'write',
            port: port,
            value: modulo256Integer(pioValue.value),
            queryState: queryState,
            goal: goal,
          });
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        if (!pioValue || pioValue.tag === 'Var') {
          const uiResult = invokeUiBuiltin(queryState.engine, 'PIO', args, {
            mode: 'read',
            port: port,
            queryState: queryState,
            goal: goal,
          });
          let value = uiResult && typeof uiResult.value === 'number' && Number.isFinite(uiResult.value)
            ? modulo256Integer(uiResult.value)
            : Object.prototype.hasOwnProperty.call(queryState.engine.options.runtimePioState, String(port))
              ? queryState.engine.options.runtimePioState[String(port)]
              : ((port === 0 || port === 2 || port === 254) ? 191 : 255);
          if (!unifyNumericResult(args[1], value, builtinTrail)) {
            return unwindAndReturn(mark, null);
          }
          return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
        }
        throw new Error('Control error');
      }
      if (name === 'ISALL' && args.length >= 3) {
        const collection = collectIsAllSolutions(args[1], args.slice(2), currentFrame);
        if (isStop(collection.result) || isSuspend(collection.result) || isAbort(collection.result) || isCut(collection.result)) {
          return unwindAndReturn(mark, collection.result);
        }
        if (!Unify.unify(args[0], collection.values, builtinTrail)) {
          return unwindAndReturn(mark, null);
        }
        return unwindAndReturn(mark, prove(restGoals, continuationStack, currentFrame));
      }
      if (name === 'CL' && (args.length === 1 || args.length === 3)) {
        const relationName = Workspace.relationNameFromHistoricalClausePattern(args[0]);
        const candidates = Workspace.userClausesForRelationName(queryState.engine.workspace, relationName);
        let startPosition = 1;
        if (args.length === 3) {
          const startValue = Terms.deref(args[1]);
          if (startValue && startValue.tag === 'Num' && Math.floor(startValue.value) === startValue.value && startValue.value < 1) {
            return unwindAndReturn(mark, null);
          }
          startPosition = positiveIntegerValue(args[1]);
        }
        for (let i = Math.max(0, startPosition - 1); i < candidates.length; i += 1) {
          const candidateMark = builtinTrail.length;
          const clauseTerm = Workspace.historicalClauseToTerm(Freshen.freshenClause(candidates[i]));
          if (!Unify.unify(args[0], clauseTerm, builtinTrail)) {
            Unify.unwindTrail(builtinTrail, candidateMark);
            continue;
          }
          if (args.length === 3 && !Unify.unify(args[2], Terms.Num(i + 1), builtinTrail)) {
            Unify.unwindTrail(builtinTrail, candidateMark);
            continue;
          }
          const result = prove(restGoals, continuationStack, currentFrame);
          Unify.unwindTrail(builtinTrail, candidateMark);
          if (isStop(result) || isSuspend(result)) return result;
          if (isCut(result)) return result;
          break;
        }
        return unwindAndReturn(mark, null);
      }
      throw new Error('Unsupported builtin: ' + builtinName(goal) + '/' + builtinArity(goal));
    }

    let finalResult = prove(queryState.currentGoals, queryState.continuationStack, queryState.currentFrame);
    if (finalResult === null
        && queryState.resumeChoices
        && queryState.resumeChoices.length > 0
        && queryState.solutions.length === 0) {
      finalResult = runResumeChoices();
    }

    if (isCut(finalResult) && finalResult.target === queryState.currentFrame && queryState.stopReason === 'done') {
      queryState.stopReason = 'cut';
    } else if (isSuspend(finalResult)) {
      queryState.stopReason = 'suspended';
    } else if (isAbort(finalResult) && queryState.stopReason === 'done') {
      queryState.stopReason = 'aborted';
    }

    return finalizeQueryState(queryState);
  }

  function resumeQueryInput(queryState, inputTermOrTerms) {
    if (!queryState.pendingInput) {
      throw new Error('No suspended input is available to resume.');
    }
    const pending = queryState.pendingInput;
    queryState.pendingInput = null;
    queryState.stopReason = 'done';
    queryState.solutions = [];
    queryState.solutionTexts = [];
    queryState.trail = [];

    const submittedTerms = Array.isArray(inputTermOrTerms)
      ? inputTermOrTerms.slice()
      : [inputTermOrTerms];
    if (!submittedTerms.length) {
      throw new Error('Expected at least one submitted input term.');
    }
    if (pending.metaProbeQueryState) {
      const probeResult = resumeQueryInput(pending.metaProbeQueryState, submittedTerms);
      ['runtimeRandomState', 'runtimePioState', 'runtimeFileState', 'runtimeGraphicsState', 'fileStore'].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(pending.metaProbeQueryState.engine.options, key)) {
          queryState.engine.options[key] = pending.metaProbeQueryState.engine.options[key];
        }
      });
      if (probeResult.outputLines && probeResult.outputLines.length) {
        Array.prototype.push.apply(queryState.outputLines, probeResult.outputLines);
      }
      if (probeResult.suspended) {
        queryState.pendingInput = freezeSuspensionSnapshot(queryState, Terms.Nil, pending.goalsLeft, pending.continuationStack, pending.currentFrame, {
          prefillText: probeResult.prefillText || '',
          metaProbeKind: 'question',
          metaProbeQueryState: pending.metaProbeQueryState,
          metaProbeOriginalVariables: pending.metaProbeOriginalVariables || [],
          metaProbeClonedVariables: pending.metaProbeClonedVariables || [],
          resumeChoices: pending.resumeChoices || [],
        });
        queryState.currentOutputLine = '';
        queryState.stopReason = 'suspended';
        return finalizeQueryState(queryState);
      }
      if (probeResult.stopReason === 'aborted') {
        queryState.currentOutputLine = '';
        queryState.stopReason = 'aborted';
        return finalizeQueryState(queryState);
      }
      if (!probeResult.solutions.length) {
        queryState.currentOutputLine = '';
        return finalizeQueryState(queryState);
      }
      queryState.currentGoals = pending.goalsLeft.slice();
      queryState.continuationStack = pending.continuationStack.slice();
      queryState.currentFrame = pending.currentFrame;
      queryState.queryVariables = pending.queryVariables.slice();
      queryState.inputBuffer = (pending.inputBuffer || []).slice().concat((pending.metaProbeQueryState.inputBuffer || []).slice());
      queryState.resumeChoices = (pending.resumeChoices || []).slice();
      queryState.currentOutputLine = '';
      if (!applyProbeSolutionBindings(pending.metaProbeOriginalVariables || [], pending.metaProbeClonedVariables || [], probeResult.solutions[0], queryState.trail)) {
        return finalizeQueryState(queryState);
      }
      return advanceQuery(queryState);
    }

    const firstSubmitted = submittedTerms[0];
    const restoredInput = pending.rememberedNames
      ? restoreRememberedVariables(firstSubmitted, pending.rememberedNames)
      : firstSubmitted;
    const submittedTailTerms = submittedTerms.slice(1);
    const remainingBufferTerms = submittedTailTerms.length > 0
      ? submittedTailTerms
      : ((pending.bufferedTerms || []).slice());
    queryState.currentGoals = [Terms.Struct('=', [pending.target, restoredInput])].concat(pending.goalsLeft);
    queryState.continuationStack = pending.continuationStack.slice();
    queryState.currentFrame = pending.currentFrame;
    queryState.queryVariables = pending.queryVariables.slice();
    queryState.inputBuffer = (pending.inputBuffer || []).slice().concat(remainingBufferTerms);
    queryState.resumeChoices = (pending.resumeChoices || []).slice();
    queryState.currentOutputLine = '';
    return advanceQuery(queryState);
  }

  function runQuery(engine, goals, options) {
    return advanceQuery(createQueryState(engine, goals, options));
  }

  return {
    createEngine: createEngine,
    createHistoricalRuntimeError: createHistoricalRuntimeError,
    createQueryState: createQueryState,
    advanceQuery: advanceQuery,
    resumeQueryInput: resumeQueryInput,
    runQuery: runQuery,
    isPrimitiveRelationName: isPrimitiveRelationName,
    isSupportedPrimitiveArity: isSupportedPrimitiveArity,
  };
});
