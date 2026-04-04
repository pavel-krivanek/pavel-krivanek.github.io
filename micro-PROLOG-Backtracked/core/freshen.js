(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./terms'));
  } else {
    root.MicroPrologCleanRoomFreshen = factory(root.MicroPrologCleanRoomTerms);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Terms) {
  'use strict';

  if (!Terms) throw new Error('terms.js must be loaded before freshen.js');

  function freshenTerm(term, mapping) {
    const map = mapping || new Map();
    const target = Terms.deref(term);
    if (!target) return target;

    switch (target.tag) {
      case 'Nil':
      case 'Sym':
      case 'Num':
        return target;
      case 'Var':
        if (!map.has(target.id)) {
          map.set(target.id, Terms.Var(target.nameHint));
        }
        return map.get(target.id);
      case 'Pair':
        return Terms.Pair(freshenTerm(target.head, map), freshenTerm(target.tail, map));
      case 'Struct':
        return Terms.Struct(
          target.name,
          target.args.map(function (arg) { return freshenTerm(arg, map); }),
          target.argTail ? freshenTerm(target.argTail, map) : null
        );
      default:
        throw new Error('Unknown term tag during freshening: ' + target.tag);
    }
  }

  function Clause(head, body, bodyTail) {
    return {
      head: head,
      body: Array.isArray(body) ? body.slice() : [],
      bodyTail: bodyTail || null,
    };
  }

  function freshenClause(clause) {
    const map = new Map();
    const freshClause = Clause(
      freshenTerm(clause.head, map),
      clause.body.map(function (goal) { return freshenTerm(goal, map); }),
      clause.bodyTail ? freshenTerm(clause.bodyTail, map) : null
    );
    if (clause && Object.prototype.hasOwnProperty.call(clause, 'ownerModuleName')) {
      freshClause.ownerModuleName = clause.ownerModuleName;
    }
    if (clause && Object.prototype.hasOwnProperty.call(clause, 'signature')) {
      freshClause.signature = clause.signature;
    }
    if (clause && Object.prototype.hasOwnProperty.call(clause, 'sourceIndex')) {
      freshClause.sourceIndex = clause.sourceIndex;
    }
    return freshClause;
  }

  return {
    Clause: Clause,
    freshenTerm: freshenTerm,
    freshenClause: freshenClause,
  };
});
