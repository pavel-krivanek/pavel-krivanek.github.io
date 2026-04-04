(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./terms'), require('./freshen'));
  } else {
    root.MicroPrologCleanRoomWorkspace = factory(root.MicroPrologCleanRoomTerms, root.MicroPrologCleanRoomFreshen);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Terms, Freshen) {
  'use strict';

  if (!Terms || !Freshen) throw new Error('terms.js and freshen.js must be loaded before workspace.js');

  const ROOT_MODULE_NAME = '&';
  const MUTATION_BLOCKED_RELATION_NAMES = new Set([
    'TRUE', 'FAIL', '=', '/', '/*', 'R', 'ACCEPT', 'RFILL', 'EQ', 'LST', 'CON', 'NUM', 'INT', 'VAR', 'SYS', 'SPACE', 'ABORT', 'NEW', 'QT',
    'SUM', 'TIMES', 'LESS', 'SIGN', 'STRINGOF', 'CHAROF', 'CL', 'ADDCL', 'P', 'PP',
    'CMOD', 'CRMOD', 'OPMOD', 'CLMOD', 'DICT', 'DELCL', 'KILL', 'LIST', 'LISTP', 'SAVE', 'LOAD',
    'CREATE', 'WRITE', 'W', 'CLOSE', 'OPEN', 'READ', 'RND',
    'HYBRID', 'NORMAL', 'LNE', 'PNT', 'CLS', 'BORDER', 'BP', 'PIO', 'ISALL'
  ]);

  function createModuleRecord(name, exportsList, importsList, options) {
    const config = options || {};
    return {
      name: String(name),
      exports: Array.isArray(exportsList) ? exportsList.slice() : [],
      imports: Array.isArray(importsList) ? importsList.slice() : [],
      clauses: [],
      localIndex: Object.create(null),
      localDictionary: [],
      commandCreated: !!config.commandCreated,
    };
  }

  function createWorkspace() {
    const rootModule = createModuleRecord(ROOT_MODULE_NAME, [], []);
    const workspace = {
      rootModuleName: ROOT_MODULE_NAME,
      currentModuleName: ROOT_MODULE_NAME,
      modulesByName: Object.create(null),
      derivedClauses: [],
      derivedInstalled: false,
      clauses: rootModule.clauses,
      index: Object.create(null),
    };
    workspace.modulesByName[ROOT_MODULE_NAME] = rootModule;
    syncWorkspaceViews(workspace);
    return workspace;
  }

  function currentModule(workspace) {
    const moduleRecord = workspace.modulesByName[workspace.currentModuleName];
    if (!moduleRecord) throw new Error('Current module is missing: ' + workspace.currentModuleName);
    return moduleRecord;
  }

  function rootModule(workspace) {
    const moduleRecord = workspace.modulesByName[workspace.rootModuleName];
    if (!moduleRecord) throw new Error('Root module is missing: ' + workspace.rootModuleName);
    return moduleRecord;
  }

  function relationName(term) {
    const target = Terms.deref(term);
    if (!target) return '';
    if (target.tag === 'Struct' || target.tag === 'Sym') return String(target.name || '');
    throw new Error('Expected a relation term.');
  }

  function relationSignature(term) {
    return Terms.relationSignature(term);
  }

  function cloneProperListItems(term) {
    const parts = Terms.cloneListToArray(term);
    const tail = Terms.deref(parts.tail);
    if (!tail || tail.tag !== 'Nil') {
      throw new Error('Expected a proper list.');
    }
    return parts.items;
  }

  function collectConstantNames(term, seen, output) {
    const value = Terms.deref(term);
    if (!seen) seen = new Set();
    if (!output) output = [];
    if (!value) return output;
    if (value.tag === 'Sym') {
      if (!seen.has(value.name)) {
        seen.add(value.name);
        output.push(value.name);
      }
      return output;
    }
    if (value.tag === 'Struct') {
      if (!seen.has(value.name)) {
        seen.add(value.name);
        output.push(value.name);
      }
      value.args.forEach(function (arg) {
        collectConstantNames(arg, seen, output);
      });
      return output;
    }
    if (value.tag === 'Pair') {
      collectConstantNames(value.head, seen, output);
      collectConstantNames(value.tail, seen, output);
    }
    return output;
  }

  function rebuildModuleLocalState(moduleRecord) {
    const localIndex = Object.create(null);
    const dictionaryNames = [];
    const dictionarySeen = new Set();

    moduleRecord.clauses.forEach(function (clause, clauseIndex) {
      const signature = relationSignature(clause.head);
      clause.signature = signature;
      clause.sourceIndex = clauseIndex;
      clause.ownerModuleName = moduleRecord.name;
      if (!localIndex[signature]) localIndex[signature] = [];
      localIndex[signature].push(clause);
      collectConstantNames(historicalClauseToTerm(clause), dictionarySeen, dictionaryNames);
    });

    moduleRecord.localIndex = localIndex;
    moduleRecord.localDictionary = dictionaryNames;
  }

  function appendRelationClausesFromModule(index, seenClauses, moduleRecord, relation) {
    Object.keys(moduleRecord.localIndex).forEach(function (signature) {
      if (signature.split('/')[0] !== relation) return;
      moduleRecord.localIndex[signature].forEach(function (clause) {
        if (seenClauses.has(clause)) return;
        seenClauses.add(clause);
        if (!index[signature]) index[signature] = [];
        index[signature].push(clause);
      });
    });
  }

  function rebuildAccessibleIndex(workspace) {
    const index = Object.create(null);

    function appendClause(clause) {
      const signature = relationSignature(clause.head);
      clause.signature = signature;
      if (!index[signature]) index[signature] = [];
      index[signature].push(clause);
    }

    workspace.derivedClauses.forEach(function (clause, derivedIndex) {
      clause.sourceIndex = derivedIndex;
      appendClause(clause);
    });

    const current = currentModule(workspace);
    const seenClauses = new Set();

    current.clauses.forEach(function (clause, clauseIndex) {
      clause.sourceIndex = clauseIndex;
      seenClauses.add(clause);
      appendClause(clause);
    });

    if (current.name === workspace.rootModuleName) {
      Object.keys(workspace.modulesByName).forEach(function (moduleName) {
        if (moduleName === workspace.rootModuleName) return;
        const moduleRecord = workspace.modulesByName[moduleName];
        moduleRecord.exports.forEach(function (exportName) {
          appendRelationClausesFromModule(index, seenClauses, moduleRecord, exportName);
        });
      });
    } else {
      rootModule(workspace).clauses.forEach(function (clause, clauseIndex) {
        clause.sourceIndex = clauseIndex;
        if (seenClauses.has(clause)) return;
        seenClauses.add(clause);
        appendClause(clause);
      });

      const importNames = new Set(current.imports || []);
      Object.keys(workspace.modulesByName).forEach(function (moduleName) {
        if (moduleName === workspace.rootModuleName || moduleName === current.name) return;
        const moduleRecord = workspace.modulesByName[moduleName];
        moduleRecord.exports.forEach(function (exportName) {
          if (!importNames.has(exportName)) return;
          appendRelationClausesFromModule(index, seenClauses, moduleRecord, exportName);
        });
      });
    }

    workspace.index = index;
  }

  function updateRootImports(workspace) {
    const imports = [];
    const seen = new Set();
    Object.keys(workspace.modulesByName).forEach(function (moduleName) {
      if (moduleName === workspace.rootModuleName) return;
      const moduleRecord = workspace.modulesByName[moduleName];
      if (moduleRecord && moduleRecord.commandCreated) return;
      moduleRecord.exports.forEach(function (exportName) {
        if (seen.has(exportName)) return;
        seen.add(exportName);
        imports.push(exportName);
      });
    });
    rootModule(workspace).imports = imports;
  }

  function syncWorkspaceViews(workspace) {
    workspace.clauses = currentModule(workspace).clauses;
    rebuildAccessibleIndex(workspace);
  }

  function rebuildWorkspace(workspace) {
    Object.keys(workspace.modulesByName).forEach(function (moduleName) {
      rebuildModuleLocalState(workspace.modulesByName[moduleName]);
    });
    updateRootImports(workspace);
    syncWorkspaceViews(workspace);
  }

  function relationIsDerived(workspace, signature) {
    return workspace.derivedClauses.some(function (clause) {
      return relationSignature(clause.head) === signature;
    });
  }

  function exportedRelationOwnerNames(workspace, relation) {
    const owners = [];
    Object.keys(workspace.modulesByName).forEach(function (moduleName) {
      if (moduleName === workspace.rootModuleName) return;
      const moduleRecord = workspace.modulesByName[moduleName];
      if (moduleRecord && moduleRecord.commandCreated) return;
      if (moduleRecord.exports.includes(relation)) owners.push(moduleName);
    });
    return owners;
  }

  function relationExportedByOtherModule(workspace, relation) {
    const currentName = workspace.currentModuleName;
    return exportedRelationOwnerNames(workspace, relation).some(function (moduleName) {
      return moduleName !== currentName;
    });
  }

  function mutationBlocked(workspace, clause) {
    const name = relationName(clause.head);
    const signature = relationSignature(clause.head);
    if (name === 'ONE') {
      return MUTATION_BLOCKED_RELATION_NAMES.has(name)
        || relationExportedByOtherModule(workspace, relationName(clause.head));
    }
    return MUTATION_BLOCKED_RELATION_NAMES.has(name)
      || relationIsDerived(workspace, signature)
      || relationExportedByOtherModule(workspace, relationName(clause.head));
  }

  function normalizeClause(head, body, options) {
    return head && head.head && Array.isArray(head.body)
      ? head
      : Freshen.Clause(head, body || [], options && options.bodyTail);
  }

  function insertCurrentModuleClause(workspace, clause, afterPosition) {
    const moduleRecord = currentModule(workspace);
    const signature = relationSignature(clause.head);

    if (afterPosition === undefined || afterPosition === null) {
      moduleRecord.clauses.push(clause);
      rebuildWorkspace(workspace);
      return clause;
    }

    const matches = [];
    moduleRecord.clauses.forEach(function (existing, index) {
      if (relationSignature(existing.head) === signature) {
        matches.push(index);
      }
    });

    let insertionIndex = moduleRecord.clauses.length;
    if (matches.length > 0) {
      if (afterPosition <= 0) {
        insertionIndex = matches[0];
      } else if (afterPosition < matches.length) {
        insertionIndex = matches[afterPosition - 1] + 1;
      } else {
        insertionIndex = matches[matches.length - 1] + 1;
      }
    }

    moduleRecord.clauses.splice(insertionIndex, 0, clause);
    rebuildWorkspace(workspace);
    return clause;
  }

  function addClause(workspace, head, body, options) {
    const clause = normalizeClause(head, body, options);
    const derived = !!(options && options.derived);
    if (!derived && mutationBlocked(workspace, clause)) {
      throw new Error('Cannot add clauses for primitive or protected relations.');
    }
    if (derived) {
      workspace.derivedClauses.push(clause);
      rebuildAccessibleIndex(workspace);
      return clause;
    }
    return insertCurrentModuleClause(workspace, clause, options && options.afterPosition);
  }

  function addDerivedClause(workspace, head, body, bodyTail) {
    return addClause(workspace, head, body, { derived: true, bodyTail: bodyTail || null });
  }

  function variable(name) {
    return Terms.Var(name);
  }

  function goal(name, args) {
    return Terms.Struct(name, args || []);
  }

  function snapshotHistoricalTerm(term, mapping) {
    return Freshen.freshenTerm(Terms.deref(term), mapping);
  }

  function historicalGoalFromList(term, mapping) {
    const value = Terms.deref(term);
    if (!value) throw new Error('Expected a goal form.');
    if (value.tag === 'Nil') return Terms.Struct('TRUE', []);

    const parts = Terms.cloneListToArray(value);
    const items = parts.items;
    if (items.length === 0) return Terms.Struct('TRUE', []);

    const head = Terms.deref(items[0]);
    if (!head || head.tag !== 'Sym') {
      throw new Error('Historical goal forms must start with a symbol.');
    }
    const argTail = Terms.deref(parts.tail) && Terms.deref(parts.tail).tag !== 'Nil' ? snapshotHistoricalTerm(parts.tail, mapping) : null;
    return Terms.Struct(head.name, items.slice(1).map(function (item) { return snapshotHistoricalTerm(item, mapping); }), argTail);
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

  function historicalBodyPredicateMetaVariableForm(term) {
    const value = Terms.deref(term);
    if (!value || value.tag !== 'Pair') return null;
    const parts = Terms.cloneListToArray(value);
    if (parts.items.length === 0) return null;
    const head = Terms.deref(parts.items[0]);
    if (!head || head.tag !== 'Var') return null;
    return value;
  }

  function historicalBodyTermFromClauseItem(item, mapping) {
    const value = Terms.deref(item);
    if (!value) throw new Error('Expected a historical body item.');
    if (value.tag === 'Var') return snapshotHistoricalTerm(value, mapping);
    if (value.tag === 'Sym') return Terms.Struct(value.name, []);
    const predicateMetaVariableForm = historicalBodyPredicateMetaVariableForm(value);
    if (predicateMetaVariableForm) return snapshotHistoricalTerm(predicateMetaVariableForm, mapping);
    return historicalGoalFromList(value, mapping);
  }

  function historicalClauseFromTerm(term) {
    const value = Terms.deref(term);
    if (!value || value.tag !== 'Pair') {
      throw new Error('Expected a historical clause list term.');
    }
    const parts = Terms.cloneListToArray(value);
    if (!parts.items.length) {
      throw new Error('Clause list cannot be empty.');
    }
    const mapping = new Map();
    const head = historicalGoalFromList(parts.items[0], mapping);
    const body = parts.items.slice(1).map(function (item) { return historicalBodyTermFromClauseItem(item, mapping); });
    const tail = Terms.deref(parts.tail);
    const bodyTail = tail && tail.tag !== 'Nil' ? parts.tail : null;
    return Freshen.Clause(head, body, bodyTail);
  }

  function historicalClauseToTerm(clause) {
    const items = [historicalGoalToList(clause.head)].concat(clause.body.map(historicalGoalToList));
    return Terms.list(items, clause.bodyTail || Terms.Nil);
  }

  function relationNameFromHistoricalClausePattern(term) {
    const value = Terms.deref(term);
    if (!value || value.tag !== 'Pair') {
      throw new Error('Expected a historical clause pattern.');
    }
    const headForm = Terms.deref(value.head);
    if (!headForm || headForm.tag !== 'Pair') {
      throw new Error('Clause pattern must start with a head atom form.');
    }
    const relation = Terms.deref(headForm.head);
    if (!relation || relation.tag !== 'Sym') {
      throw new Error('Clause pattern must name a relation with a constant.');
    }
    return relation.name;
  }

  function userClausesForRelationName(workspace, name) {
    return currentModule(workspace).clauses.filter(function (clause) {
      return relationName(clause.head) === name;
    });
  }

  function clausesForGoal(workspace, goal) {
    const signature = Terms.relationSignature(goal);
    return workspace.index[signature] ? workspace.index[signature].slice() : [];
  }

  function localClausesForGoal(workspace, moduleName, goal) {
    const moduleRecord = workspace.modulesByName[String(moduleName || '')];
    if (!moduleRecord) return [];
    const signature = Terms.relationSignature(goal);
    return moduleRecord.localIndex[signature] ? moduleRecord.localIndex[signature].slice() : [];
  }

  function listClauses(workspace) {
    return currentModule(workspace).clauses.slice();
  }

  function listDerivedClauses(workspace) {
    return workspace.derivedClauses.slice();
  }

  function symbolName(term, label) {
    const value = Terms.deref(term);
    if (!value || value.tag !== 'Sym') {
      throw new Error('Expected ' + label + ' name to be a constant.');
    }
    return value.name;
  }

  function constantNameList(term, label) {
    return cloneProperListItems(term).map(function (item) {
      const value = Terms.deref(item);
      if (!value || value.tag !== 'Sym') {
        throw new Error('Expected ' + label + ' to be a list of constants.');
      }
      return value.name;
    }).filter(function (name, index, names) {
      return names.indexOf(name) === index;
    });
  }

  function accessibleRootRelationNames(workspace) {
    const names = new Set(Array.from(MUTATION_BLOCKED_RELATION_NAMES));
    workspace.derivedClauses.forEach(function (clause) {
      names.add(relationName(clause.head));
    });
    rootModule(workspace).clauses.forEach(function (clause) {
      names.add(relationName(clause.head));
    });
    Object.keys(workspace.modulesByName).forEach(function (moduleName) {
      if (moduleName === workspace.rootModuleName) return;
      const moduleRecord = workspace.modulesByName[moduleName];
      moduleRecord.exports.forEach(function (exportName) {
        names.add(exportName);
      });
    });
    return names;
  }

  function createModule(workspace, moduleNameTerm, exportListTerm, importListTerm, options) {
    if (workspace.currentModuleName !== workspace.rootModuleName) {
      throw new Error('Illegal use of modules');
    }

    const name = symbolName(moduleNameTerm, 'module');
    const exportsList = constantNameList(exportListTerm, 'export list');
    const importsList = constantNameList(importListTerm, 'import list');
    const rootVisibleNames = accessibleRootRelationNames(workspace);

    if (workspace.modulesByName[name] || rootVisibleNames.has(name)) {
      throw new Error('Illegal use of modules');
    }

    for (let i = 0; i < exportsList.length; i += 1) {
      const exportName = exportsList[i];
      if (rootModule(workspace).clauses.some(function (clause) { return relationName(clause.head) === exportName; })) {
        throw new Error('Illegal use of modules');
      }
      if (exportedRelationOwnerNames(workspace, exportName).length > 0) {
        throw new Error('Illegal use of modules');
      }
    }

    const moduleRecord = createModuleRecord(name, exportsList, importsList, options);
    workspace.modulesByName[name] = moduleRecord;
    rebuildWorkspace(workspace);
    workspace.currentModuleName = name;
    syncWorkspaceViews(workspace);
    return moduleRecord;
  }

  function openModule(workspace, moduleNameTerm) {
    const name = symbolName(moduleNameTerm, 'module');
    if (!workspace.modulesByName[name]) {
      throw new Error('Illegal use of modules');
    }
    workspace.currentModuleName = name;
    syncWorkspaceViews(workspace);
    return currentModule(workspace);
  }

  function closeCurrentModule(workspace) {
    if (workspace.currentModuleName === workspace.rootModuleName) {
      return currentModule(workspace);
    }
    workspace.currentModuleName = workspace.rootModuleName;
    syncWorkspaceViews(workspace);
    return currentModule(workspace);
  }

  function currentModuleTerm(workspace) {
    return Terms.Sym(workspace.currentModuleName);
  }

  function moduleNameTerms(names) {
    return (Array.isArray(names) ? names : []).map(function (name) {
      return Terms.Sym(name);
    });
  }


  function makeVariableNamer() {
    return function nameFor(index) {
      return Terms.historicalVariableNameForIndex(index);
    };
  }

  function quoteHistoricalAtom(name) {
    return '"' + String(name).replace(/@/g, '@@').replace(/"/g, '@"') + '"';
  }

  function historicalAtomNeedsQuotes(name) {
    const value = String(name);
    if (/^[\[\]<>{}]$/.test(value)) return false;
    return !/^(?:-?[A-Za-z][A-Za-z0-9-]*|[!#$%&'*+,./:;=?@\^~`-]+)$/.test(value);
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

  function createHistoricalTermRenderer(options) {
    const config = Object.assign({ preferHints: true }, options || {});
    const seenNames = new Map();
    const nextName = makeVariableNamer();

    function render(target) {
      const value = Terms.deref(target);
      if (!value) return '?';
      switch (value.tag) {
        case 'Nil':
          return '()';
        case 'Sym':
          return historicalAtomNeedsQuotes(value.name) ? quoteHistoricalAtom(value.name) : value.name;
        case 'Num':
          return historicalFormatNumber(value.value);
        case 'Var': {
          if (!seenNames.has(value.id)) {
            const assignedHint = value.nameHint && config.preferHints ? Terms.canonicalHistoricalVariableName(value.nameHint) : null;
            const nameForIndex = typeof config.variableNameForIndex === 'function' ? config.variableNameForIndex : nextName;
            const assigned = assignedHint || nameForIndex(seenNames.size);
            seenNames.set(value.id, assigned);
          }
          return seenNames.get(value.id);
        }
        case 'Struct':
          return '(' + [render(Terms.Sym(value.name))].concat(value.args.map(render)).join(' ') + ')';
        case 'Pair':
          return renderList(value);
        default:
          throw new Error('Unknown term tag: ' + value.tag);
      }
    }

    function renderList(pair) {
      const pieces = [];
      let cursor = Terms.deref(pair);
      while (cursor && cursor.tag === 'Pair') {
        pieces.push(render(cursor.head));
        cursor = Terms.deref(cursor.tail);
      }
      if (cursor && cursor.tag === 'Nil') return '(' + pieces.join(' ') + ')';
      return '(' + pieces.join(' ') + '|' + render(cursor) + ')';
    }

    return render;
  }

  function renderHistoricalTerm(term, options) {
    return createHistoricalTermRenderer(options)(term);
  }

  function renderHistoricalBodyItem(item, render) {
    const value = Terms.deref(item);
    if (value && value.tag === 'Struct' && value.name === '/' && value.args.length === 0) {
      return '/';
    }
    return render(item);
  }

  function uppercaseHistoricalVariableNameForIndex(index) {
    const prefixes = ['X', 'Y', 'Z', 'x', 'y', 'z'];
    const cycle = index % prefixes.length;
    const round = Math.floor(index / prefixes.length);
    return prefixes[cycle] + (round === 0 ? '' : String(round));
  }

  function renderHistoricalClauseLines(clause, options) {
    const render = createHistoricalTermRenderer(Object.assign({ preferHints: false, variableNameForIndex: uppercaseHistoricalVariableNameForIndex }, options || {}));
    const headText = render(historicalGoalToList(clause.head));
    if (!clause.body.length && !clause.bodyTail) {
      return ['(' + headText + ')'];
    }
    const lines = ['(' + headText];
    clause.body.forEach(function (bodyItem, index) {
      const isLast = index === clause.body.length - 1 && !clause.bodyTail;
      lines.push('  ' + renderHistoricalBodyItem(bodyItem, render) + (isLast ? ')' : ''));
    });
    if (clause.bodyTail) {
      lines.push('  |' + render(clause.bodyTail) + ')');
    }
    return lines;
  }

  function renderHistoricalClause(clause, options) {
    return renderHistoricalClauseLines(clause, options).join('\n');
  }

  function accessibleClausesForRelationName(workspace, name) {
    const matches = [];
    const seen = new Set();
    Object.keys(workspace.index).forEach(function (signature) {
      if (signature.split('/')[0] !== name) return;
      workspace.index[signature].forEach(function (clause) {
        if (seen.has(clause)) return;
        seen.add(clause);
        matches.push(clause);
      });
    });
    return matches;
  }


  function relationArity(term) {
    const value = Terms.deref(term);
    if (!value) return null;
    if (value.tag === 'Sym') return 0;
    if (value.tag === 'Struct') return value.args.length;
    return null;
  }

  function hasAccessibleRelationArity(workspace, name, arity) {
    return accessibleClausesForRelationName(workspace, name).some(function (clause) {
      return relationArity(clause.head) === arity;
    });
  }

  function relationGroupSortKey(name) {
    const value = String(name || '');
    const first = value.charAt(0);
    const isUpper = first && first >= 'A' && first <= 'Z';
    return { isUpper: isUpper, name: value };
  }

  function listCurrentModuleClauseLines(workspace) {
    const grouped = Object.create(null);
    const nameOrder = [];
    currentModule(workspace).clauses.forEach(function (clause) {
      const name = relationName(clause.head);
      if (!grouped[name]) {
        grouped[name] = [];
        nameOrder.push(name);
      }
      grouped[name].push(clause);
    });
    const orderedNames = nameOrder.slice().sort(function (left, right) {
      const a = relationGroupSortKey(left);
      const b = relationGroupSortKey(right);
      if (a.isUpper && b.isUpper) return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
      if (a.isUpper !== b.isUpper) return a.isUpper ? -1 : 1;
      return nameOrder.indexOf(left) - nameOrder.indexOf(right);
    });
    return orderedNames.reduce(function (lines, name) {
      grouped[name].forEach(function (clause) {
        renderHistoricalClauseLines(clause).forEach(function (line) {
          lines.push(line);
        });
      });
      return lines;
    }, []);
  }

  function saveCurrentModuleClauseLines(workspace) {
    return listCurrentModuleClauseLines(workspace);
  }

  function allWorkspaceListingLines(workspace) {
    const lines = [];
    rootModule(workspace).clauses.forEach(function (clause) {
      renderHistoricalClauseLines(clause).forEach(function (line) {
        lines.push(line);
      });
    });
    Object.keys(workspace.modulesByName).sort().forEach(function (moduleName) {
      if (moduleName === workspace.rootModuleName) return;
      const moduleLines = listNamedModuleLines(workspace, moduleName);
      if (!moduleLines) return;
      moduleLines.forEach(function (line) {
        lines.push(line);
      });
    });
    return lines;
  }

  function estimateWorkspaceFreeKilobytes(workspace) {
    const capacityBytes = 19 * 1024;
    const usedBytes = serializeHistoricalLines(allWorkspaceListingLines(workspace)).length;
    const remaining = Math.max(0, capacityBytes - usedBytes);
    return Math.floor(remaining / 1024);
  }

  function saveTargetLines(workspace, targetTerm) {
    if (targetTerm === undefined || targetTerm === null) {
      return saveCurrentModuleClauseLines(workspace);
    }

    const value = Terms.deref(targetTerm);
    if (!value) return [];

    if (value.tag === 'Sym') {
      if (workspace.modulesByName[value.name] && value.name !== workspace.rootModuleName) {
        return listNamedModuleLines(workspace, value.name) || [];
      }
      return listRelationLines(workspace, value.name);
    }

    if (value.tag === 'Pair' || value.tag === 'Nil') {
      const names = constantNameList(value, 'relation list');
      const lines = [];
      names.forEach(function (name) {
        listRelationLines(workspace, name).forEach(function (line) {
          lines.push(line);
        });
      });
      return lines;
    }

    throw new Error('Expected SAVE target to be a relation-name list or a module name.');
  }

  function relationNamesOwnedByCurrentModule(workspace) {
    const names = [];
    const seen = new Set();
    rootModule(workspace).clauses.forEach(function (clause) {
      const name = relationName(clause.head);
      if (seen.has(name)) return;
      seen.add(name);
      names.push(name);
    });
    return names;
  }

  function accessibleRelationNameInCurrentModule(workspace, relation) {
    const current = currentModule(workspace);
    if (currentModuleRelationOwned(workspace, relation)) return true;
    if (current.name === workspace.rootModuleName) {
      return exportedRelationOwnerNames(workspace, relation).length > 0;
    }
    return current.imports.indexOf(relation) !== -1;
  }

  function fileNameConflicts(workspace, fileName) {
    if (workspace.modulesByName[fileName]) return true;
    return accessibleRelationNameInCurrentModule(workspace, fileName);
  }

  function classifyProgramLoadClauseError(workspace, fileName, clause) {
    const relation = relationName(clause.head);
    if (relation === fileName) {
      return 'File error';
    }
    if (workspace.modulesByName[relation]) {
      return 'File error';
    }
    if (relationExportedByOtherModule(workspace, relation)) {
      return 'Illegal use of modules';
    }
    return null;
  }

  function serializeHistoricalLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return '';
    return lines.join('\n') + '\n';
  }

  function syntheticDictionaryClause(workspace) {
    return Terms.Struct('DICT', currentModuleDictionaryArgs(workspace));
  }

  function workspaceDisplayDictionaryArgs(workspace) {
    const orderedNames = [];
    const seenNames = new Set();

    function addName(name) {
      if (name == null) return;
      const text = String(name);
      if (!text || text === 'dict' || text === 'func' || text === 'data-rel') return;
      if (seenNames.has(text)) return;
      seenNames.add(text);
      orderedNames.push(text);
    }

    Object.keys(workspace.modulesByName).forEach(function (moduleName) {
      if (moduleName === workspace.rootModuleName) return;
      const moduleRecord = workspace.modulesByName[moduleName];
      addName(moduleRecord.name);
      moduleRecord.exports.forEach(addName);
      moduleRecord.imports.forEach(addName);
    });

    Object.keys(workspace.modulesByName).forEach(function (moduleName) {
      const moduleRecord = workspace.modulesByName[moduleName];
      moduleRecord.clauses.forEach(function (clause) {
        collectConstantNames(historicalClauseToTerm(clause), seenNames, orderedNames);
      });
    });

    const displayNames = orderedNames.slice().reverse();
    if (displayNames.indexOf('?ERROR?') === -1) displayNames.push('?ERROR?');
    return [
      Terms.Sym(workspace.rootModuleName),
      Terms.list([]),
      Terms.list([])
    ].concat(moduleNameTerms(displayNames));
  }

  function listRelationLines(workspace, relationName) {
    if (relationName === 'DICT') {
      return renderHistoricalClauseLines(Freshen.Clause(Terms.Struct('DICT', workspaceDisplayDictionaryArgs(workspace)), []));
    }
    if (relationName === '<SUP>') {
      return [
        '(("<SUP>")',
        '  (CMOD Y)',
        '  (P Y)',
        '  (R X)',
        '  ("<>" X)',
        '  /',
        '  ("<SUP>"))'
      ];
    }
    return accessibleClausesForRelationName(workspace, relationName).reduce(function (lines, clause) {
      renderHistoricalClauseLines(clause).forEach(function (line) {
        lines.push(line);
      });
      return lines;
    }, []);
  }

  function listNamedModuleLines(workspace, moduleName) {
    const moduleRecord = workspace.modulesByName[moduleName];
    if (!moduleRecord || moduleName === workspace.rootModuleName) return null;
    if (moduleRecord.commandCreated) return [];
    const lines = [
      renderHistoricalTerm(Terms.Sym(moduleRecord.name)),
      renderHistoricalTerm(Terms.list(moduleNameTerms(moduleRecord.exports))),
      renderHistoricalTerm(Terms.list(moduleNameTerms(moduleRecord.imports))),
      ':',
    ];
    moduleRecord.clauses.forEach(function (clause) {
      renderHistoricalClauseLines(clause).forEach(function (line) {
        lines.push(line);
      });
    });
    lines.push('CLMOD');
    return lines;
  }

  function listTargetLines(workspace, targetTerm) {
    const value = Terms.deref(targetTerm);
    if (!value) return [];

    if (value.tag === 'Sym') {
      if (value.name === 'ALL') return listCurrentModuleClauseLines(workspace);
      if (workspace.modulesByName[value.name] && value.name !== workspace.rootModuleName) {
        return listNamedModuleLines(workspace, value.name) || [];
      }
      return listRelationLines(workspace, value.name);
    }

    if (value.tag === 'Pair' || value.tag === 'Nil') {
      const names = constantNameList(value, 'relation list');
      const lines = [];
      names.forEach(function (name) {
        listRelationLines(workspace, name).forEach(function (line) {
          lines.push(line);
        });
      });
      return lines;
    }

    throw new Error('Expected LIST target to be a relation name, relation-name list, ALL, or a module name.');
  }

  function currentModuleDictionaryArgs(workspace) {
    const moduleRecord = currentModule(workspace);
    return [
      Terms.Sym(moduleRecord.name),
      Terms.list(moduleNameTerms(moduleRecord.exports)),
      Terms.list(moduleNameTerms(moduleRecord.imports)),
    ].concat(moduleNameTerms(moduleRecord.localDictionary));
  }

  function currentModuleDisplayDictionaryArgs(workspace) {
    const moduleRecord = currentModule(workspace);
    const extraNames = [];
    if (moduleRecord.name === workspace.rootModuleName) {
      Object.keys(workspace.modulesByName).forEach(function (moduleName) {
        if (moduleName === workspace.rootModuleName) return;
        extraNames.push(moduleName);
      });
    }
    moduleRecord.localDictionary.slice().reverse().forEach(function (name) {
      extraNames.push(name);
    });
    extraNames.push('?ERROR?');
    return [
      Terms.Sym(moduleRecord.name),
      Terms.list(moduleNameTerms(moduleRecord.exports)),
      Terms.list(moduleNameTerms(moduleRecord.imports)),
    ].concat(moduleNameTerms(extraNames));
  }

  function currentModuleRelationOwned(workspace, relation) {
    return currentModule(workspace).clauses.some(function (clause) {
      return relationName(clause.head) === relation;
    });
  }

  function assertRelationDeletionAllowed(workspace, relation) {
    const current = currentModule(workspace);
    if (current.name !== workspace.rootModuleName && current.imports.indexOf(relation) !== -1 && !currentModuleRelationOwned(workspace, relation)) {
      throw new Error('Illegal use of modules');
    }
    if (MUTATION_BLOCKED_RELATION_NAMES.has(String(relation))) {
      throw new Error('Cannot delete clauses for primitive or protected relations.');
    }
  }

  function deleteClauseMatchingPattern(workspace, clausePatternTerm, unifyAgainstPattern) {
    const moduleRecord = currentModule(workspace);
    const relation = relationNameFromHistoricalClausePattern(clausePatternTerm);
    assertRelationDeletionAllowed(workspace, relation);

    for (let i = 0; i < moduleRecord.clauses.length; i += 1) {
      const candidate = moduleRecord.clauses[i];
      if (relationName(candidate.head) !== relation) continue;
      const candidateTerm = historicalClauseToTerm(Freshen.freshenClause(candidate));
      if (!unifyAgainstPattern(candidateTerm)) continue;
      moduleRecord.clauses.splice(i, 1);
      rebuildWorkspace(workspace);
      return true;
    }
    return false;
  }

  function deleteClauseAtPosition(workspace, relationNameTerm, clausePosition) {
    const relation = symbolName(relationNameTerm, 'relation');
    assertRelationDeletionAllowed(workspace, relation);

    const moduleRecord = currentModule(workspace);
    let seen = 0;
    for (let i = 0; i < moduleRecord.clauses.length; i += 1) {
      if (relationName(moduleRecord.clauses[i].head) !== relation) continue;
      seen += 1;
      if (seen !== clausePosition) continue;
      moduleRecord.clauses.splice(i, 1);
      rebuildWorkspace(workspace);
      return true;
    }
    return false;
  }

  function killRelationName(workspace, relation) {
    assertRelationDeletionAllowed(workspace, relation);
    const moduleRecord = currentModule(workspace);
    moduleRecord.clauses = moduleRecord.clauses.filter(function (clause) {
      return relationName(clause.head) !== relation;
    });
    rebuildWorkspace(workspace);
    return true;
  }

  function killAllCurrentModuleClauses(workspace) {
    currentModule(workspace).clauses = [];
    rebuildWorkspace(workspace);
    return true;
  }

  function killModule(workspace, moduleName) {
    if (workspace.currentModuleName !== workspace.rootModuleName) {
      throw new Error('Illegal use of modules');
    }
    if (moduleName === workspace.rootModuleName) return false;
    if (!workspace.modulesByName[moduleName]) return false;
    delete workspace.modulesByName[moduleName];
    rebuildWorkspace(workspace);
    workspace.currentModuleName = workspace.rootModuleName;
    syncWorkspaceViews(workspace);
    return true;
  }

  function killTarget(workspace, targetTerm) {
    const value = Terms.deref(targetTerm);
    if (!value) return false;

    if (value.tag === 'Sym') {
      if (value.name === 'ALL') return killAllCurrentModuleClauses(workspace);
      if (workspace.currentModuleName === workspace.rootModuleName && workspace.modulesByName[value.name] && value.name !== workspace.rootModuleName) {
        return killModule(workspace, value.name);
      }
      return killRelationName(workspace, value.name);
    }

    if (value.tag === 'Pair' || value.tag === 'Nil') {
      const names = constantNameList(value, 'relation list');
      names.forEach(function (name) {
        killRelationName(workspace, name);
      });
      return true;
    }

    throw new Error('Expected KILL target to be a relation name, list of relation names, ALL, or a module name.');
  }

  function listModuleNames(workspace) {
    return Object.keys(workspace.modulesByName);
  }

  function snapshotWorkspace(workspace) {
    const snapshot = {
      rootModuleName: workspace.rootModuleName,
      currentModuleName: workspace.currentModuleName,
      derivedInstalled: !!workspace.derivedInstalled,
      derivedClauses: workspace.derivedClauses.map(function (clause) {
        return Freshen.freshenClause(clause);
      }),
      modules: Object.create(null),
    };

    Object.keys(workspace.modulesByName).forEach(function (moduleName) {
      const moduleRecord = workspace.modulesByName[moduleName];
      snapshot.modules[moduleName] = {
        name: moduleRecord.name,
        exports: moduleRecord.exports.slice(),
        imports: moduleRecord.imports.slice(),
        clauses: moduleRecord.clauses.map(function (clause) {
          return Freshen.freshenClause(clause);
        }),
      };
    });

    return snapshot;
  }

  function restoreWorkspace(workspace, snapshot) {
    if (!snapshot) throw new Error('Expected a workspace snapshot.');

    workspace.rootModuleName = snapshot.rootModuleName;
    workspace.currentModuleName = snapshot.currentModuleName;
    workspace.derivedInstalled = !!snapshot.derivedInstalled;
    workspace.derivedClauses = snapshot.derivedClauses.map(function (clause) {
      return Freshen.freshenClause(clause);
    });
    workspace.modulesByName = Object.create(null);

    Object.keys(snapshot.modules).forEach(function (moduleName) {
      const moduleSnapshot = snapshot.modules[moduleName];
      const moduleRecord = createModuleRecord(moduleSnapshot.name, moduleSnapshot.exports, moduleSnapshot.imports);
      moduleRecord.clauses = moduleSnapshot.clauses.map(function (clause) {
        return Freshen.freshenClause(clause);
      });
      workspace.modulesByName[moduleName] = moduleRecord;
    });

    rebuildWorkspace(workspace);
  }

  function installDerivedSupport(workspace) {
    if (workspace.derivedInstalled) return workspace;
    workspace.derivedInstalled = true;

    (function installOr() {
      const x1 = variable('X');
      const y1 = variable('Y');
      addDerivedClause(workspace, goal('OR', [x1, y1]), [], x1);

      const x2 = variable('X');
      const y2 = variable('Y');
      addDerivedClause(workspace, goal('OR', [x2, y2]), [], y2);
    })();

    (function installNot() {
      const x1 = variable('X');
      addDerivedClause(workspace, goal('NOT', [x1]), [x1, goal('/', []), goal('FAIL', [])]);

      const x2 = variable('X');
      addDerivedClause(workspace, goal('NOT', [x2]), []);
    })();

    (function installIf() {
      const x1 = variable('X');
      const y1 = variable('Y');
      addDerivedClause(workspace, goal('IF', [x1, y1]), [x1, goal('/', [])], y1);

      const x2 = variable('X');
      const y2 = variable('Y');
      const z2 = variable('Z');
      addDerivedClause(workspace, goal('IF', [x2, y2, z2]), [x2, goal('/', [])], y2);

      const x3 = variable('X');
      const y3 = variable('Y');
      const z3 = variable('Z');
      addDerivedClause(workspace, goal('IF', [x3, y3, z3]), [], z3);
    })();

    (function installOne() {
      const x1 = variable('X');
      addDerivedClause(workspace, goal('ONE', [x1]), [x1, goal('/', [])]);
    })();

    (function installQuestion() {
      const x1 = variable('X');
      addDerivedClause(workspace, goal('?', [x1]), [], x1);
    })();

    (function installForall() {
      const x1 = variable('X');
      const y1 = variable('Y');
      const forallTest = Terms.list([
        Terms.list([Terms.Sym('?'), x1]),
        Terms.list([Terms.Sym('NOT'), Terms.list([Terms.Sym('?'), y1])])
      ]);
      addDerivedClause(workspace, goal('FORALL', [x1, y1]), [goal('NOT', [forallTest])]);
    })();

    (function installBang() {
      const x1 = variable('X');
      addDerivedClause(workspace, goal('!', [x1]), [x1, goal('/', [])]);
    })();

    (function installSupervisor() {
      const xPrompt = variable('X');
      const yPrompt = variable('Y');
      addDerivedClause(workspace, goal('<SUP>', []), [
        goal('CMOD', [yPrompt]),
        goal('P', [yPrompt]),
        goal('R', [xPrompt]),
        goal('<>', [xPrompt]),
        goal('/', []),
        goal('<SUP>', []),
      ]);

      const xCommand = variable('X');
      const yCommand = variable('Y');
      addDerivedClause(workspace, goal('<>', [xCommand]), [
        goal('CON', [xCommand]),
        goal('R', [yCommand]),
        Terms.list([xCommand, yCommand]),
      ]);

      const xClause = variable('X');
      const yClause = variable('Y');
      addDerivedClause(workspace, goal('<>', [Terms.list([xClause], yClause)]), [
        goal('ADDCL', [Terms.list([xClause], yClause)]),
      ]);

      const xFallback = variable('X');
      addDerivedClause(workspace, goal('<>', [xFallback]), [
        goal('PP', [Terms.Sym('?')]),
      ]);
    })();

    return workspace;
  }

  return {
    ROOT_MODULE_NAME: ROOT_MODULE_NAME,
    createWorkspace: createWorkspace,
    addClause: addClause,
    addDerivedClause: addDerivedClause,
    installDerivedSupport: installDerivedSupport,
    clausesForGoal: clausesForGoal,
    localClausesForGoal: localClausesForGoal,
    listClauses: listClauses,
    listDerivedClauses: listDerivedClauses,
    hasAccessibleRelationArity: hasAccessibleRelationArity,
    historicalClauseFromTerm: historicalClauseFromTerm,
    historicalClauseToTerm: historicalClauseToTerm,
    relationNameFromHistoricalClausePattern: relationNameFromHistoricalClausePattern,
    userClausesForRelationName: userClausesForRelationName,
    currentModule: currentModule,
    currentModuleTerm: currentModuleTerm,
    createModule: createModule,
    openModule: openModule,
    closeCurrentModule: closeCurrentModule,
    currentModuleDictionaryArgs: currentModuleDictionaryArgs,
    currentModuleDisplayDictionaryArgs: currentModuleDisplayDictionaryArgs,
    workspaceDisplayDictionaryArgs: workspaceDisplayDictionaryArgs,
    renderHistoricalTerm: renderHistoricalTerm,
    renderHistoricalClause: renderHistoricalClause,
    renderHistoricalClauseLines: renderHistoricalClauseLines,
    listTargetLines: listTargetLines,
    saveTargetLines: saveTargetLines,
    estimateWorkspaceFreeKilobytes: estimateWorkspaceFreeKilobytes,
    fileNameConflicts: fileNameConflicts,
    classifyProgramLoadClauseError: classifyProgramLoadClauseError,
    serializeHistoricalLines: serializeHistoricalLines,
    deleteClauseMatchingPattern: deleteClauseMatchingPattern,
    deleteClauseAtPosition: deleteClauseAtPosition,
    killTarget: killTarget,
    listModuleNames: listModuleNames,
    snapshotWorkspace: snapshotWorkspace,
    restoreWorkspace: restoreWorkspace,
  };
});
