(function (global) {
  'use strict';

  const BYTES_PER_ROW = 16;

  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new TypeError('Hex-viewer data must be an ArrayBuffer or typed byte array.');
  }

  function hex(value, width) {
    return Math.max(0, Number(value) || 0).toString(16).toUpperCase().padStart(width, '0');
  }

  function ascii(byte) {
    return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.';
  }

  function format(value, options = {}) {
    const bytes = asBytes(value);
    const baseOffset = Math.max(0, Math.trunc(Number(options.baseOffset) || 0));
    const lastOffset = baseOffset + Math.max(0, bytes.length - 1);
    const offsetWidth = Math.max(8, lastOffset.toString(16).length);
    const lines = [
      `${'Offset'.padEnd(offsetWidth)}  ${Array.from({ length: BYTES_PER_ROW }, (_, index) => hex(index, 2)).join(' ')}  ASCII`,
      `${'-'.repeat(offsetWidth)}  ${'-'.repeat(BYTES_PER_ROW * 3 - 1)}  ${'-'.repeat(BYTES_PER_ROW)}`
    ];

    if (!bytes.length) {
      lines.push(`${hex(baseOffset, offsetWidth)}  ${''.padEnd(BYTES_PER_ROW * 3 - 1)}  `);
      return lines.join('\n');
    }

    for (let rowOffset = 0; rowOffset < bytes.length; rowOffset += BYTES_PER_ROW) {
      const row = bytes.subarray(rowOffset, Math.min(bytes.length, rowOffset + BYTES_PER_ROW));
      const byteColumn = Array.from(row, byte => hex(byte, 2)).join(' ').padEnd(BYTES_PER_ROW * 3 - 1);
      const asciiColumn = Array.from(row, ascii).join('').padEnd(BYTES_PER_ROW);
      lines.push(`${hex(baseOffset + rowOffset, offsetWidth)}  ${byteColumn}  ${asciiColumn}`);
    }

    return lines.join('\n');
  }

  global.DidaktikHex = Object.freeze({ BYTES_PER_ROW, format });
})(globalThis);
