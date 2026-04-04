(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./terms'), require('./lexer'), require('./freshen'));
  } else {
    root.MicroPrologCleanRoomReader = factory(
      root.MicroPrologCleanRoomTerms,
      root.MicroPrologCleanRoomLexer,
      root.MicroPrologCleanRoomFreshen
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Terms, Lexer, Freshen) {
  'use strict';

  if (!Terms || !Lexer || !Freshen) {
    throw new Error('reader.js requires terms.js, lexer.js, and freshen.js.');
  }

  function createParser(tokens) {
    return {
      tokens: tokens,
      index: 0,
      variableMap: new Map(),
    };
  }

  function peek(parser) {
    return parser.tokens[parser.index];
  }

  function consume(parser, type) {
    const token = peek(parser);
    if (token.type !== type) {
      throw Lexer.syntaxError('Expected ' + type + ' but found ' + token.type + '.', token.index, token.line, token.column);
    }
    parser.index += 1;
    return token;
  }

  function maybeConsume(parser, type) {
    if (peek(parser).type === type) {
      return consume(parser, type);
    }
    return null;
  }

  function parseVariable(parser, token) {
    if (!parser.variableMap.has(token.value)) {
      parser.variableMap.set(token.value, Terms.Var(token.value));
    }
    return parser.variableMap.get(token.value);
  }

  function parseHistoricalTerm(parser) {
    const token = peek(parser);
    parser.index += 1;
    switch (token.type) {
      case 'variable':
        return parseVariable(parser, token);
      case 'number':
        return Terms.Num(Number(token.value));
      case 'atom':
        return Terms.Sym(token.value);
      case '(':
        parser.index -= 1;
        return parseHistoricalList(parser);
      default:
        throw Lexer.syntaxError('Expected a historical term.', token.index, token.line, token.column);
    }
  }

  function parseHistoricalList(parser) {
    consume(parser, '(');
    if (maybeConsume(parser, ')')) return Terms.Nil;

    const items = [];
    let tail = Terms.Nil;
    while (true) {
      items.push(parseHistoricalTerm(parser));
      if (maybeConsume(parser, ')')) break;
      if (maybeConsume(parser, '|')) {
        tail = parseHistoricalTerm(parser);
        consume(parser, ')');
        break;
      }
    }
    return Terms.list(items, tail);
  }

  function historicalListItems(term) {
    const parts = Terms.cloneListToArray(term);
    if (parts.tail.tag !== 'Nil') {
      throw new Error('Historical goal/head forms must be proper lists.');
    }
    return parts.items;
  }

  function decomposeHistoricalList(term) {
    const parts = Terms.cloneListToArray(term);
    return {
      items: parts.items,
      tail: Terms.deref(parts.tail),
    };
  }

  function historicalListToGoal(term) {
    const value = Terms.deref(term);
    if (value.tag === 'Nil') {
      return Terms.Struct('TRUE', []);
    }
    if (value.tag === 'Sym') {
      return Terms.Struct(value.name, []);
    }
    if (value.tag === 'Num') {
      return Terms.Struct(String(value.value), []);
    }
    if (value.tag !== 'Pair') {
      throw new Error('Historical goal/head forms must start with a symbol.');
    }
    const parts = decomposeHistoricalList(value);
    const items = parts.items;
    if (items.length === 0) return Terms.Struct('TRUE', []);
    const head = Terms.deref(items[0]);
    if (!head || (head.tag !== 'Sym' && head.tag !== 'Num')) {
      throw new Error('Historical goal/head forms must start with a symbol.');
    }
    const argTail = parts.tail && parts.tail.tag !== 'Nil' ? parts.tail : null;
    const name = head.tag === 'Num' ? String(head.value) : head.name;
    return Terms.Struct(name, items.slice(1), argTail);
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

  function historicalBodyItemToGoal(term) {
    const value = Terms.deref(term);
    if (!value) throw new Error('Expected a historical body item.');
    if (value.tag === 'Var') return value;
    if (value.tag === 'Sym') return Terms.Struct(value.name, []);
    const predicateMetaVariableForm = historicalBodyPredicateMetaVariableForm(value);
    if (predicateMetaVariableForm) return predicateMetaVariableForm;
    return historicalListToGoal(value);
  }

  function isHistoricalGoalSequence(term) {
    const value = Terms.deref(term);
    if (value.tag === 'Nil') return true;
    if (value.tag !== 'Pair') return false;
    const first = Terms.deref(value.head);
    return !!first && (first.tag === 'Pair' || first.tag === 'Nil');
  }

  function parseHistoricalTermText(text) {
    const parser = createParser(Lexer.tokenize(text));
    parser.variableMap = new Map();
    const term = parseHistoricalTerm(parser);
    consume(parser, 'eof');
    return term;
  }

  function parseHistoricalGoalListTextFromParser(parser) {
    const term = parseHistoricalTerm(parser);
    if (isHistoricalGoalSequence(term)) {
      return historicalListItems(term).map(historicalListToGoal);
    }
    return [historicalListToGoal(term)];
  }

  function parseHistoricalGoalListText(text) {
    const parser = createParser(Lexer.tokenize(text));
    parser.variableMap = new Map();
    const goals = parseHistoricalGoalListTextFromParser(parser);
    consume(parser, 'eof');
    return goals;
  }

  function parseHistoricalSourceClauseFromTerm(clauseForm) {
    const value = Terms.deref(clauseForm);
    if (!value || value.tag !== 'Pair') {
      throw new Error('Historical clause forms must be parenthesized lists.');
    }

    const parts = decomposeHistoricalList(value);
    if (parts.items.length === 0) {
      throw new Error('Historical clause forms must contain at least one goal.');
    }

    const head = historicalListToGoal(parts.items[0]);
    const body = parts.items.slice(1).map(historicalBodyItemToGoal);
    const bodyTail = parts.tail && parts.tail.tag !== 'Nil' ? parts.tail : null;
    return { kind: 'clause', clause: Freshen.Clause(head, body, bodyTail) };
  }

  function parseHistoricalSourceEntry(parser) {
    parser.variableMap = new Map();
    const firstTerm = parseHistoricalTerm(parser);
    const firstValue = Terms.deref(firstTerm);

    if (firstValue && firstValue.tag === 'Pair') {
      return parseHistoricalSourceClauseFromTerm(firstTerm);
    }

    if (!firstValue || firstValue.tag !== 'Sym') {
      throw new Error('Historical source entries must be clauses, module openings, or CLMOD.');
    }

    if (firstValue.name === 'CLMOD') {
      return { kind: 'module-close' };
    }

    const exportListTerm = parseHistoricalTerm(parser);
    const importListTerm = parseHistoricalTerm(parser);
    return {
      kind: 'module-open',
      moduleNameTerm: firstTerm,
      exportListTerm: exportListTerm,
      importListTerm: importListTerm,
    };
  }

  function parseHistoricalSourceText(text) {
    const parser = createParser(Lexer.tokenize(text));
    const entries = [];
    while (peek(parser).type !== 'eof') {
      entries.push(parseHistoricalSourceEntry(parser));
    }
    return entries;
  }

  function classifyHistoricalSourceEntries(entries) {
    const sourceEntries = Array.isArray(entries) ? entries.slice() : [];
    if (sourceEntries.length === 0) {
      return { kind: 'program', entries: sourceEntries };
    }

    const firstKind = sourceEntries[0] && sourceEntries[0].kind;
    if (firstKind === 'clause') {
      sourceEntries.forEach(function (entry) {
        if (!entry || entry.kind !== 'clause') {
          throw new Error('Historical source files that start with a clause may only contain clauses.');
        }
      });
      return { kind: 'program', entries: sourceEntries };
    }

    if (firstKind === 'module-open') {
      let depth = 0;
      sourceEntries.forEach(function (entry) {
        if (!entry) throw new Error('Historical source entries must be clauses, module openings, or CLMOD.');
        if (entry.kind === 'module-open') {
          if (depth !== 0) {
            throw new Error('Historical module source files cannot nest module headers.');
          }
          depth = 1;
          return;
        }
        if (entry.kind === 'clause') {
          if (depth !== 1) {
            throw new Error('Historical module source clauses must appear inside an open module.');
          }
          return;
        }
        if (entry.kind === 'module-close') {
          if (depth !== 1) {
            throw new Error('Historical module source files must close an open module with CLMOD.');
          }
          depth = 0;
          return;
        }
        throw new Error('Historical source entries must be clauses, module openings, or CLMOD.');
      });
      if (depth !== 0) {
        throw new Error('Historical module source files must end with CLMOD.');
      }
      return { kind: 'module', entries: sourceEntries };
    }

    throw new Error('Historical source files must start with a clause or a module header.');
  }

  function parseHistoricalLoadSourceText(text) {
    return classifyHistoricalSourceEntries(parseHistoricalSourceText(text));
  }

  function parseHistoricalTermsText(text) {
    const parser = createParser(Lexer.tokenize(text));
    const terms = [];
    while (peek(parser).type !== 'eof') {
      parser.variableMap = new Map();
      terms.push(parseHistoricalTerm(parser));
    }
    return terms;
  }

  return {
    parseTermText: parseHistoricalTermText,
    parseQueryText: parseHistoricalGoalListText,
    parseSourceText: parseHistoricalSourceText,
    parseHistoricalTermText: parseHistoricalTermText,
    parseHistoricalGoalListText: parseHistoricalGoalListText,
    parseHistoricalSourceText: parseHistoricalSourceText,
    classifyHistoricalSourceEntries: classifyHistoricalSourceEntries,
    parseHistoricalLoadSourceText: parseHistoricalLoadSourceText,
    parseHistoricalTermsText: parseHistoricalTermsText,
  };
});
