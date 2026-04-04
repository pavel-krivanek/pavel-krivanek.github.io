(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./terms'));
  } else {
    root.MicroPrologCleanRoomUnify = factory(root.MicroPrologCleanRoomTerms);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Terms) {
  'use strict';

  if (!Terms) throw new Error('terms.js must be loaded before unify.js');

  function occurs(variable, term) {
    const target = Terms.deref(term);
    if (!target) return false;
    if (target === variable) return true;
    if (target.tag === 'Struct') {
      return target.args.some(function (arg) { return occurs(variable, arg); }) || (target.argTail ? occurs(variable, target.argTail) : false);
    }
    if (target.tag === 'Pair') {
      return occurs(variable, target.head) || occurs(variable, target.tail);
    }
    return false;
  }

  function bindVariable(variable, value, trail) {
    if (value === variable) return true;
    if (occurs(variable, value)) return false;
    variable.binding = value;
    trail.push(variable);
    return true;
  }

  function unwindTrail(trail, mark) {
    while (trail.length > mark) {
      trail.pop().binding = null;
    }
  }

  function unify(left, right, trail) {
    const a = Terms.deref(left);
    const b = Terms.deref(right);

    if (a === b) return true;
    if (!a || !b) return false;

    if (a.tag === 'Var') return bindVariable(a, b, trail);
    if (b.tag === 'Var') return bindVariable(b, a, trail);

    if (a.tag !== b.tag) return false;

    switch (a.tag) {
      case 'Nil':
        return true;
      case 'Sym':
        return a.name === b.name;
      case 'Num':
        return a.value === b.value;
      case 'Pair':
        return unify(a.head, b.head, trail) && unify(a.tail, b.tail, trail);
      case 'Struct':
        if (a.name !== b.name || a.args.length !== b.args.length) return false;
        if (!!a.argTail !== !!b.argTail) return false;
        for (let i = 0; i < a.args.length; i += 1) {
          if (!unify(a.args[i], b.args[i], trail)) return false;
        }
        if (a.argTail || b.argTail) {
          return unify(a.argTail, b.argTail, trail);
        }
        return true;
      default:
        throw new Error('Unknown term tag during unification: ' + a.tag);
    }
  }

  return {
    occurs: occurs,
    bindVariable: bindVariable,
    unwindTrail: unwindTrail,
    unify: unify,
  };
});
