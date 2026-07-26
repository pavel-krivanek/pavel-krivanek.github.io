(function (global) {
  'use strict';

  const HEADER_TYPE_NAMES = ['Program', 'Number array', 'Character array', 'CODE'];

  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new TypeError('TAP data must be an ArrayBuffer or Uint8Array.');
  }

  function readWord(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function spectrumText(bytes) {
    let text = '';
    for (const byte of bytes) {
      if (byte >= 32 && byte <= 126) text += String.fromCharCode(byte);
      else text += ' ';
    }
    return text.replace(/\s+$/g, '');
  }

  function checksumIsValid(bytes, start, end) {
    let checksum = 0;
    for (let offset = start; offset < end; offset += 1) checksum ^= bytes[offset];
    return checksum === 0;
  }

  function describeHeader(type, length, param1, param2) {
    if (type === 0) {
      const autostart = param1 >= 0x8000 ? 'no autostart' : `autostart line ${param1}`;
      return `${length} bytes, ${autostart}, variables at ${param2}`;
    }
    if (type === 3) return `${length} bytes, load address ${param1}`;
    if (type === 1 || type === 2) {
      const letter = String.fromCharCode((param1 & 0x1f) + 64);
      return `${length} bytes, variable ${letter}`;
    }
    return `${length} bytes`;
  }

  class TapImage {
    constructor(value, fileName = 'tape.tap') {
      this.bytes = asBytes(value);
      this.fileName = fileName || 'tape.tap';
      this.blocks = [];
      this.trailingBytes = 0;
      this.parse();
    }

    parse() {
      const bytes = this.bytes;
      let offset = 0;
      let index = 0;
      let pendingHeader = null;

      while (offset + 2 <= bytes.length) {
        const length = readWord(bytes, offset);
        const dataOffset = offset + 2;
        const endOffset = dataOffset + length;
        if (endOffset > bytes.length) {
          throw new Error(`TAP block ${index + 1} is truncated: expected ${length} bytes, only ${bytes.length - dataOffset} remain.`);
        }
        if (length < 2) throw new Error(`TAP block ${index + 1} is too short (${length} byte${length === 1 ? '' : 's'}).`);

        const flag = bytes[dataOffset];
        const payloadLength = Math.max(0, length - 2);
        const block = {
          index,
          number: index + 1,
          offset,
          dataOffset,
          endOffset,
          length,
          payloadLength,
          flag,
          flagLabel: flag === 0x00 ? 'Header' : flag === 0xff ? 'Data' : `Data $${flag.toString(16).toUpperCase().padStart(2, '0')}`,
          checksumValid: checksumIsValid(bytes, dataOffset, endOffset),
          kind: flag === 0x00 ? 'Header' : 'Data',
          name: '',
          detail: `${payloadLength} payload bytes`,
          header: null,
          pairedHeaderIndex: null
        };

        if (flag === 0x00 && length === 19) {
          const type = bytes[dataOffset + 1];
          const name = spectrumText(bytes.slice(dataOffset + 2, dataOffset + 12)) || '(unnamed)';
          const declaredLength = readWord(bytes, dataOffset + 12);
          const param1 = readWord(bytes, dataOffset + 14);
          const param2 = readWord(bytes, dataOffset + 16);
          const header = {
            type,
            typeName: HEADER_TYPE_NAMES[type] || `Type ${type}`,
            name,
            declaredLength,
            param1,
            param2
          };
          block.kind = header.typeName;
          block.name = name;
          block.detail = describeHeader(type, declaredLength, param1, param2);
          block.header = header;
          pendingHeader = block;
        } else if (flag === 0xff && pendingHeader) {
          block.kind = `${pendingHeader.header.typeName} data`;
          block.name = pendingHeader.name;
          block.pairedHeaderIndex = pendingHeader.index;
          block.header = pendingHeader.header;
          block.detail = `${payloadLength} payload bytes${payloadLength === pendingHeader.header.declaredLength ? '' : `; header declares ${pendingHeader.header.declaredLength}`}`;
          pendingHeader = null;
        } else {
          pendingHeader = null;
        }

        this.blocks.push(block);
        offset = endOffset;
        index += 1;
      }

      this.trailingBytes = bytes.length - offset;
      if (this.trailingBytes) throw new Error(`TAP image has ${this.trailingBytes} trailing byte${this.trailingBytes === 1 ? '' : 's'} after the last complete block.`);
      if (!this.blocks.length) throw new Error('The TAP image contains no blocks.');
    }

    blockAtOffset(offset) {
      if (!Number.isFinite(offset)) return null;
      if (offset === this.bytes.length) return null;
      return this.blocks.find(block => offset >= block.offset && offset < block.endOffset) || null;
    }
  }

  function qaopNamespace() {
    const qaop = global.__qaop;
    if (!qaop) throw new Error('QAOP runtime is not initialized.');
    return qaop;
  }

  function mountFile(file, timeoutMs = 10000) {
    if (!(file instanceof File)) return Promise.reject(new TypeError('A TAP File is required.'));
    return new Promise((resolve, reject) => {
      const qaop = qaopNamespace();
      let settled = false;
      const timer = global.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Timed out while mounting the TAP image.'));
      }, timeoutMs);
      try {
        qaop.ejectTape?.();
        qaop.beginLoad(2, file, () => {
          if (settled) return;
          const state = qaop.getTapeState?.();
          if (!state?.bytes) return;
          settled = true;
          global.clearTimeout(timer);
          resolve(state);
        });
      } catch (error) {
        settled = true;
        global.clearTimeout(timer);
        reject(error);
      }
    });
  }

  function getState() {
    return qaopNamespace().getTapeState?.() || null;
  }

  function setHeadOffset(offset) {
    return !!qaopNamespace().setTapeHeadOffset?.(offset);
  }

  function eject() {
    qaopNamespace().ejectTape?.();
  }

  global.DidaktikTap = {
    TapImage,
    mountFile,
    getState,
    setHeadOffset,
    eject
  };
})(globalThis);
