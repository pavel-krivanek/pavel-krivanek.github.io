'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(new URL('../tap-browser.js', `file://${__filename}`).pathname, 'utf8');
const context = { Uint8Array, ArrayBuffer, DataView, console, setTimeout, clearTimeout };
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'tap-browser.js' });

function tapBlock(content) {
  const bytes = Uint8Array.from(content);
  return Uint8Array.from([bytes.length & 0xff, bytes.length >> 8, ...bytes]);
}

function xorChecksum(bytes) {
  return bytes.reduce((value, byte) => value ^ byte, 0);
}

const name = Array.from(Buffer.from('HELLO     ', 'ascii'));
const headerWithoutChecksum = [
  0x00, // header flag
  0x00, // Program
  ...name,
  0x03, 0x00, // data length
  0x0a, 0x00, // autostart line 10
  0x03, 0x00 // variable area
];
const header = tapBlock([...headerWithoutChecksum, xorChecksum(headerWithoutChecksum)]);
const dataWithoutChecksum = [0xff, 0x01, 0x02, 0x03];
const data = tapBlock([...dataWithoutChecksum, xorChecksum(dataWithoutChecksum)]);
const tapeBytes = Uint8Array.from([...header, ...data]);

const image = new context.DidaktikTap.TapImage(tapeBytes, 'hello.tap');
assert.equal(image.blocks.length, 2);
assert.equal(image.blocks[0].kind, 'Program');
assert.equal(image.blocks[0].name, 'HELLO');
assert.equal(image.blocks[0].header.declaredLength, 3);
assert.equal(image.blocks[0].header.param1, 10);
assert.equal(image.blocks[0].checksumValid, true);
assert.equal(image.blocks[1].kind, 'Program data');
assert.equal(image.blocks[1].name, 'HELLO');
assert.equal(image.blocks[1].payloadLength, 3);
assert.equal(image.blocks[1].checksumValid, true);
assert.equal(image.blockAtOffset(0).index, 0);
assert.equal(image.blockAtOffset(header.length).index, 1);
assert.equal(image.blockAtOffset(tapeBytes.length), null);

const bad = tapeBytes.slice();
bad[bad.length - 1] ^= 1;
const badImage = new context.DidaktikTap.TapImage(bad, 'bad.tap');
assert.equal(badImage.blocks[1].checksumValid, false);

assert.throws(
  () => new context.DidaktikTap.TapImage(Uint8Array.from([5, 0, 0xff, 1]), 'short.tap'),
  /truncated/
);

console.log('TAP browser parser tests passed.');
