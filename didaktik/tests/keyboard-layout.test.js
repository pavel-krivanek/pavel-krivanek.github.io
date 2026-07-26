'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = {
  console,
  Uint8Array,
  Uint32Array,
  Int32Array,
  Object,
  Number,
  String,
  Math,
  JSON,
  URL: { createObjectURL() {} },
  setTimeout() {},
  document: {
    documentElement: {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return {}; }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const file of ['emulator/00-namespace.js', 'emulator/05-shared-helpers.js']) {
  vm.runInContext(fs.readFileSync(path.join(projectRoot, file), 'utf8'), context, { filename: file });
}

const physical = context.__qaop.getLogicalKeyCode;

// Czech QWERTZ: the host key labelled Z occupies the Spectrum Y position.
assert.equal(physical({ key: 'z', code: 'KeyY', which: 90, keyCode: 90 }), 89);
assert.equal(physical({ key: 'Z', code: 'KeyY', which: 90, keyCode: 90 }), 89);
assert.equal(physical({ key: 'y', code: 'KeyZ', which: 89, keyCode: 89 }), 90);

// AZERTY is handled by the same physical-position policy.
assert.equal(physical({ key: 'a', code: 'KeyQ', which: 65, keyCode: 65 }), 81);
assert.equal(physical({ key: 'q', code: 'KeyA', which: 81, keyCode: 81 }), 65);

// National symbols on the number and punctuation rows retain the Spectrum key
// at that physical position, irrespective of the generated host character.
assert.equal(physical({ key: 'ě', code: 'Digit2', which: 0, keyCode: 0 }), 50);
assert.equal(physical({ key: 'ů', code: 'Semicolon', which: 0, keyCode: 0 }), 186);
assert.equal(physical({ key: '+', code: 'BracketRight', which: 0, keyCode: 0 }), 221);

// Control keys use their physical code; old browsers can still fall back to
// the legacy fields when KeyboardEvent.code is unavailable.
assert.equal(physical({ key: 'ArrowLeft', code: 'ArrowLeft', which: 0, keyCode: 0 }), 37);
assert.equal(physical({ key: '', code: 'F11', which: 0, keyCode: 0 }), 122);
assert.equal(physical({ key: '', code: '', which: 0, keyCode: 122 }), 122);

console.log('Physical Spectrum keyboard layout tests passed.');
