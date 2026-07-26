'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'hex-viewer.js'), 'utf8'),
  context,
  { filename: 'hex-viewer.js' }
);

const bytes = new Uint8Array([
  0x00, 0x20, 0x41, 0x7e, 0x7f, 0x80, 0x31, 0x32,
  0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a,
  0xff, 0x42
]);
const dump = context.DidaktikHex.format(bytes, { baseOffset: 0x1234 });
const lines = dump.split('\n');
assert.equal(lines[0], 'Offset    00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F  ASCII');
assert.equal(lines[2], '00001234  00 20 41 7E 7F 80 31 32 33 34 35 36 37 38 39 3A  . A~..123456789:');
assert.equal(lines[3], '00001244  FF 42                                            .B              ');
assert.equal(context.DidaktikHex.BYTES_PER_ROW, 16);
assert.match(context.DidaktikHex.format(new Uint8Array()), /00000000/);
console.log('Hex viewer tests passed.');
