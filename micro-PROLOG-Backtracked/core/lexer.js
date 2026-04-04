(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.MicroPrologCleanRoomLexer = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STRUCTURAL_TOKENS = Object.freeze({
    '(': '(',
    ')': ')',
    '|': '|',
  });
  const HISTORICAL_SPECIAL_CONSTANTS = new Set(['[', ']', '<', '>', '{', '}']);
  const HISTORICAL_VARIABLE_PREFIXES = new Set(['x', 'y', 'z', 'X', 'Y', 'Z']);
  const RESERVED_UPPERCASE_ATOMS = new Set([
    'TRUE', 'FAIL', 'NOT', 'OR', 'IF', 'ONE', 'R', 'ACCEPT', 'EQ', 'LST', 'CL', 'ADDCL',
    'P', 'PP', 'CMOD', 'CRMOD', 'OPMOD', 'CLMOD', 'DICT', 'DELCL', 'KILL', 'LIST',
    'LISTP', 'SAVE', 'LOAD', 'CREATE', 'WRITE', 'W', 'CLOSE', 'ALL'
  ]);

  function tokenize(text) {
    const source = String(text || '');
    const tokens = [];
    let index = 0;
    let line = 1;
    let column = 1;

    function current() {
      return source[index] || '';
    }

    function next(offset) {
      return source[index + (offset || 1)] || '';
    }

    function advance() {
      const ch = source[index] || '';
      index += 1;
      if (ch === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      return ch;
    }

    function makeToken(type, value, startIndex, startLine, startColumn) {
      return {
        type: type,
        value: value,
        index: startIndex,
        line: startLine,
        column: startColumn,
      };
    }

    function readWhile(test) {
      let value = '';
      while (index < source.length && test(current())) {
        value += advance();
      }
      return value;
    }

    function isWhitespace(ch) {
      return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
    }

    function isDigit(ch) {
      return ch >= '0' && ch <= '9';
    }

    function readHistoricalNumberToken(startIndex, startLine, startColumn) {
      let value = '';
      if (current() === '-') {
        value += advance();
      }
      value += readWhile(isDigit);
      if (current() === '.' && isDigit(next())) {
        value += advance();
        value += readWhile(isDigit);
        if (current() === 'e' && (isDigit(next()) || (next() === '-' && isDigit(source[index + 2] || '')))) {
          value += advance();
          if (current() === '-') {
            value += advance();
          }
          value += readWhile(isDigit);
        }
      }
      return makeToken('number', value, startIndex, startLine, startColumn);
    }

    function isLetter(ch) {
      return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
    }

    function isAlphaNumericTokenStart(ch) {
      return isLetter(ch) || (ch === '-' && isLetter(next()));
    }

    function isAlphaNumericTokenPart(ch) {
      return isLetter(ch) || isDigit(ch) || ch === '-';
    }

    function isSpecialBoundaryChar(ch) {
      return !!STRUCTURAL_TOKENS[ch] || HISTORICAL_SPECIAL_CONSTANTS.has(ch);
    }

    function isGraphicAtomChar(ch) {
      return !!ch
        && !isWhitespace(ch)
        && !isAlphaNumericTokenStart(ch)
        && !isDigit(ch)
        && !isSpecialBoundaryChar(ch)
        && ch !== '"';
    }

    function readQuotedAtom(startIndex, startLine, startColumn) {
      advance();
      let value = '';
      while (index < source.length) {
        const ch = advance();
        if (ch === '@' && current() === '"') {
          value += advance();
          continue;
        }
        if (ch === '@' && current() === '@') {
          value += advance();
          continue;
        }
        if (ch === '"') {
          return makeToken('atom', value, startIndex, startLine, startColumn);
        }
        value += ch;
      }
      throw syntaxError('Unterminated quoted atom.', startIndex, startLine, startColumn);
    }

    function canonicalHistoricalVariableName(value) {
      if (!value || !HISTORICAL_VARIABLE_PREFIXES.has(value[0])) return null;
      const suffix = value.slice(1);
      if (!/^\d*$/.test(suffix)) return null;
      if (suffix.length === 0) return value[0];
      const subscript = Number(suffix);
      if (!Number.isFinite(subscript) || Math.floor(subscript) !== subscript || subscript < 0) return null;
      const historicalSubscript = subscript % 128;
      return historicalSubscript === 0 ? value[0] : value[0] + String(historicalSubscript);
    }

    function classifyAlphaNumericToken(value) {
      if (RESERVED_UPPERCASE_ATOMS.has(value)) return { type: 'atom', value: value };
      const canonicalVariableName = canonicalHistoricalVariableName(value);
      if (canonicalVariableName) return { type: 'variable', value: canonicalVariableName };
      return { type: 'atom', value: value };
    }

    while (index < source.length) {
      const ch = current();
      if (isWhitespace(ch)) {
        advance();
        continue;
      }

      const startIndex = index;
      const startLine = line;
      const startColumn = column;

      if (STRUCTURAL_TOKENS[ch]) {
        advance();
        tokens.push(makeToken(STRUCTURAL_TOKENS[ch], ch, startIndex, startLine, startColumn));
        continue;
      }
      if (HISTORICAL_SPECIAL_CONSTANTS.has(ch)) {
        advance();
        tokens.push(makeToken('atom', ch, startIndex, startLine, startColumn));
        continue;
      }
      if (ch === '"') {
        tokens.push(readQuotedAtom(startIndex, startLine, startColumn));
        continue;
      }
      if ((ch === '-' && isDigit(next())) || isDigit(ch)) {
        tokens.push(readHistoricalNumberToken(startIndex, startLine, startColumn));
        continue;
      }
      if (isAlphaNumericTokenStart(ch)) {
        const value = readWhile(isAlphaNumericTokenPart);
        const classified = classifyAlphaNumericToken(value);
        tokens.push(makeToken(classified.type, classified.value, startIndex, startLine, startColumn));
        continue;
      }
      if (isGraphicAtomChar(ch)) {
        const value = readWhile(isGraphicAtomChar);
        tokens.push(makeToken('atom', value, startIndex, startLine, startColumn));
        continue;
      }

      throw syntaxError('Unexpected character ' + JSON.stringify(ch) + '.', startIndex, startLine, startColumn);
    }

    tokens.push(makeToken('eof', '', index, line, column));
    return tokens;
  }

  function syntaxError(message, index, line, column) {
    const error = new Error(message + ' At line ' + line + ', column ' + column + '.');
    error.index = index;
    error.line = line;
    error.column = column;
    return error;
  }

  return {
    tokenize: tokenize,
    syntaxError: syntaxError,
  };
});
