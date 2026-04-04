(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.MicroPrologCleanRoomTerms = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let nextVariableId = 1;

  const Nil = Object.freeze({ tag: 'Nil' });

  function Sym(name) {
    return { tag: 'Sym', name: String(name) };
  }

  function Num(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Num requires a finite JavaScript number.');
    }
    return { tag: 'Num', value: value };
  }

  function Var(nameHint) {
    return { tag: 'Var', id: nextVariableId++, nameHint: nameHint || null, binding: null };
  }

  const HISTORICAL_VARIABLE_PREFIXES = new Set(['x', 'y', 'z', 'X', 'Y', 'Z']);

  function canonicalHistoricalVariableName(name) {
    const value = String(name || '');
    if (!value || !HISTORICAL_VARIABLE_PREFIXES.has(value[0])) return null;
    const suffix = value.slice(1);
    if (!/^\d*$/.test(suffix)) return null;
    if (suffix.length === 0) return value[0];
    const subscript = Number(suffix);
    if (!Number.isFinite(subscript) || Math.floor(subscript) !== subscript || subscript < 0) return null;
    return subscript === 0 ? value[0] : value[0] + String(subscript);
  }

  function historicalVariableNameForIndex(index) {
    const prefixes = ['x', 'y', 'z', 'X', 'Y', 'Z'];
    const cycle = index % prefixes.length;
    const round = Math.floor(index / prefixes.length);
    return prefixes[cycle] + (round === 0 ? '' : String(round));
  }

  function Struct(name, args, argTail) {
    return {
      tag: 'Struct',
      name: String(name),
      args: Array.isArray(args) ? args.slice() : [],
      argTail: argTail === undefined ? null : argTail,
    };
  }

  function Pair(head, tail) {
    return { tag: 'Pair', head: head, tail: tail };
  }

  function list(items, tail) {
    let result = tail === undefined ? Nil : tail;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      result = Pair(items[i], result);
    }
    return result;
  }

  function resetVariableIds() {
    nextVariableId = 1;
  }

  function isVariable(term) {
    return !!term && term.tag === 'Var';
  }

  function deref(term) {
    let current = term;
    while (current && current.tag === 'Var' && current.binding) {
      current = current.binding;
    }
    return current;
  }

  function relationSignature(term) {
    const target = deref(term);
    if (!target) return '?/?';
    if (target.tag === 'Struct') return target.name + '/' + target.args.length + (target.argTail ? '+' : '');
    if (target.tag === 'Sym') return target.name + '/0';
    throw new Error('Expected a relation term, got ' + target.tag + '.');
  }

  function collectVariables(term, seen, output) {
    const target = deref(term);
    if (!seen) seen = new Set();
    if (!output) output = [];
    if (!target) return output;
    if (target.tag === 'Var') {
      if (!seen.has(target.id)) {
        seen.add(target.id);
        output.push(target);
      }
      return output;
    }
    if (target.tag === 'Struct') {
      target.args.forEach(function (arg) { collectVariables(arg, seen, output); });
      if (target.argTail) collectVariables(target.argTail, seen, output);
      return output;
    }
    if (target.tag === 'Pair') {
      collectVariables(target.head, seen, output);
      collectVariables(target.tail, seen, output);
    }
    return output;
  }

  function cloneListToArray(term) {
    const items = [];
    let cursor = deref(term);
    while (cursor && cursor.tag === 'Pair') {
      items.push(cursor.head);
      cursor = deref(cursor.tail);
    }
    return { items: items, tail: cursor };
  }

  function makeVariableNamer() {
    return function nameFor(index) {
      return historicalVariableNameForIndex(index);
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

  function renderHistoricalAtom(name) {
    const value = String(name);
    return historicalAtomNeedsQuotes(value) ? quoteHistoricalAtom(value) : value;
  }

  function termToString(term, options) {
    const seenNames = new Map();
    const nextName = makeVariableNamer();
    const config = options || {};

    function render(target) {
      const value = deref(target);
      if (!value) return '?';
      switch (value.tag) {
        case 'Nil':
          return '[]';
        case 'Sym':
          return renderHistoricalAtom(value.name);
        case 'Num':
          return String(value.value);
        case 'Var': {
          if (!seenNames.has(value.id)) {
            const assignedHint = value.nameHint && config.preferHints ? canonicalHistoricalVariableName(value.nameHint) : null;
            const assigned = assignedHint || nextName(seenNames.size);
            seenNames.set(value.id, assigned);
          }
          return seenNames.get(value.id);
        }
        case 'Struct':
          return value.name + '(' + value.args.map(render).join(', ') + (value.argTail ? ' | ' + render(value.argTail) : '') + ')';
        case 'Pair':
          return renderList(value);
        default:
          throw new Error('Unknown term tag: ' + value.tag);
      }
    }

    function renderList(pair) {
      const pieces = [];
      let cursor = pair;
      while (cursor && cursor.tag === 'Pair') {
        pieces.push(render(cursor.head));
        cursor = deref(cursor.tail);
      }
      if (cursor && cursor.tag === 'Nil') return '[' + pieces.join(', ') + ']';
      return '[' + pieces.join(', ') + ' | ' + render(cursor) + ']';
    }

    return render(term);
  }

  return {
    Nil: Nil,
    Sym: Sym,
    Num: Num,
    Var: Var,
    Struct: Struct,
    Pair: Pair,
    list: list,
    resetVariableIds: resetVariableIds,
    isVariable: isVariable,
    deref: deref,
    relationSignature: relationSignature,
    collectVariables: collectVariables,
    cloneListToArray: cloneListToArray,
    canonicalHistoricalVariableName: canonicalHistoricalVariableName,
    historicalVariableNameForIndex: historicalVariableNameForIndex,
    quoteHistoricalAtom: quoteHistoricalAtom,
    historicalAtomNeedsQuotes: historicalAtomNeedsQuotes,
    renderHistoricalAtom: renderHistoricalAtom,
    termToString: termToString,
  };
});
