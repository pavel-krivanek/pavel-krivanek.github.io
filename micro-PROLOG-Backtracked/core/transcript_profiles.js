(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.MicroPrologCleanRoomTranscriptProfiles = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function asLines(lines) {
    return Array.isArray(lines) ? lines.slice() : [];
  }

  function entryDisplayText(entry) {
    return String(
      entry && entry.displayText != null
        ? entry.displayText
        : entry && entry.sourceText != null
          ? entry.sourceText
          : ''
    );
  }

  function normalizedProfile() {
    return {
      name: 'normalized',
      commandSeparatorLines: function () {
        return [''];
      },
      renderCommandEcho: function () {
        return [];
      },
      renderInputPrompt: function () {
        return 'input?';
      },
      renderMorePrompt: function () {
        return 'more?(y/n)';
      },
      renderNoSolution: function () {
        return 'NO';
      },
      renderNoMoreAnswers: function () {
        return 'No (more) answers';
      },
      renderClauseLoadResult: function () {
        return ['ADDED'];
      },
      renderQueryResult: function (result, context) {
        const lines = (result && Array.isArray(result.solutionTexts) ? result.solutionTexts : []).slice();
        if (result && (result.stopReason === 'done' || result.stopReason === 'cut') && !context.waitingForDecision) {
          lines.push('No (more) answers');
        }
        if (!lines.length && !context.allowEmpty) {
          lines.push('NO');
        }
        return lines;
      },
      renderAfterCommand: function () {
        return [];
      },
      entryDisplayText: entryDisplayText,
    };
  }

  function continuationPromptForDepth(depth) {
    return String(Math.max(1, depth)) + '.\b ';
  }

  function trimHistoricalContinuationIndent(line) {
    return String(line || '').replace(/^\s/, '');
  }

  function prefixHistoricalCommandLines(text, prefix) {
    const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (!lines.length) return [prefix];
    const rendered = [];
    let currentDepth = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const prompt = index === 0 ? prefix : continuationPromptForDepth(currentDepth);
      rendered.push(prompt + (index === 0 ? line : trimHistoricalContinuationIndent(line)));
      for (let i = 0; i < line.length; i += 1) {
        if (line.charAt(i) === '(') currentDepth += 1;
        if (line.charAt(i) === ')') currentDepth -= 1;
      }
      if (currentDepth < 0) currentDepth = 0;
    }
    return rendered;
  }

  function historicalPromptModuleName(state) {
    if (state && state.workspace) {
      const root = state.workspace.rootModuleName;
      if (root != null && String(root)) return String(root);
      const current = state.workspace.currentModuleName;
      if (current != null && String(current)) return String(current);
    }
    if (state && state.rootModuleName != null && String(state.rootModuleName)) {
      return String(state.rootModuleName);
    }
    if (state && state.currentModuleName != null && String(state.currentModuleName)) {
      return String(state.currentModuleName);
    }
    return '&';
  }

  function historicalPromptText(state, suffix, moduleNameOverride) {
    const moduleName = moduleNameOverride != null && String(moduleNameOverride)
      ? String(moduleNameOverride)
      : historicalPromptModuleName(state);
    return moduleName + String(suffix || '.');
  }

  function isHistoricalPromptOnlyLine(line) {
    return typeof line === 'string' && /^[^\s]+[.?](?:\u0008)?$/.test(line);
  }

  function mergeHistoricalTranscriptChunks(chunks) {
    const ATTACH_NEXT_PROMPT_PREFIX = '\u0001ATTACH_NEXT_PROMPT:';
    const lines = [];
    (Array.isArray(chunks) ? chunks : []).forEach(function (chunk) {
      const sourceLines = Array.isArray(chunk)
        ? chunk.slice()
        : String(chunk || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      sourceLines.forEach(function (line, indexWithinChunk) {
        if (!lines.length) {
          lines.push(line);
          return;
        }
        const previous = lines[lines.length - 1];
        if (indexWithinChunk === 0 && typeof previous === 'string' && previous.indexOf(ATTACH_NEXT_PROMPT_PREFIX) === 0 && typeof line === 'string') {
          const promptLine = previous.slice(ATTACH_NEXT_PROMPT_PREFIX.length);
          const promptWithoutBackspace = /\u0008$/.test(promptLine) ? promptLine.slice(0, -1) : promptLine;
          if (line.indexOf(promptWithoutBackspace) === 0 && line.length > promptWithoutBackspace.length) {
            lines[lines.length - 1] = promptLine + line.slice(promptWithoutBackspace.length);
            return;
          }
          lines[lines.length - 1] = promptLine;
        }
        const normalizedPrevious = typeof previous === 'string' && previous.indexOf(ATTACH_NEXT_PROMPT_PREFIX) === 0
          ? previous.slice(ATTACH_NEXT_PROMPT_PREFIX.length)
          : previous;
        if (indexWithinChunk === 0 && isHistoricalPromptOnlyLine(normalizedPrevious) && typeof line === 'string' && line.indexOf(normalizedPrevious) === 0 && line.length > normalizedPrevious.length) {
          lines[lines.length - 1] = line;
          return;
        }
        if (indexWithinChunk === 0 && isHistoricalPromptOnlyLine(normalizedPrevious) && isHistoricalPromptOnlyLine(line) && normalizedPrevious === line) {
          return;
        }
        lines.push(line);
      });
    });
    return lines.map(function (line) {
      return typeof line === 'string' && line.indexOf(ATTACH_NEXT_PROMPT_PREFIX) === 0
        ? line.slice(ATTACH_NEXT_PROMPT_PREFIX.length)
        : line;
    });
  }

  function historicalProfile() {
    return {
      name: 'historical',
      commandSeparatorLines: function () {
        return [];
      },
      renderCommandEcho: function (entry, state, context) {
        const text = entryDisplayText(entry);
        if (entry && entry.kind === 'input_reply') {
          if (!text) return [];
          if (context && context.dottedInputReply) {
            return prefixHistoricalCommandLines(text, '.');
          }
          return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        }
        if (entry && entry.continuationLine) {
          const continuationPrompt = entry && entry.continuationPromptText != null
            ? String(entry.continuationPromptText)
            : '.';
          if (!text) return [continuationPrompt];
          return prefixHistoricalCommandLines(text, continuationPrompt);
        }
        if (!text) return [];
        const suffix = entry && entry.kind === 'more_answer' ? '?' : '.';
        const promptModuleName = context && Object.prototype.hasOwnProperty.call(context, 'echoPromptModuleName')
          ? context.echoPromptModuleName
          : (context && Object.prototype.hasOwnProperty.call(context, 'commandPromptModuleName')
            ? context.commandPromptModuleName
            : null);
        return prefixHistoricalCommandLines(text, historicalPromptText(state, suffix, promptModuleName));
      },
      renderInputPrompt: function (entry, result, state) {
        return historicalPromptText(state, '?');
      },
      renderMorePrompt: function (entry, result, state) {
        return historicalPromptText(state, '?');
      },
      renderNoSolution: function () {
        return '?';
      },
      renderNoMoreAnswers: function () {
        return [];
      },
      renderClauseLoadResult: function () {
        return [];
      },
      renderQueryResult: function (result, context) {
        const lines = (result && Array.isArray(result.solutionTexts) ? result.solutionTexts : []).slice();
        const outputLines = result && Array.isArray(result.outputLines) ? result.outputLines : [];
        if (outputLines.length) return [];
        const meaningful = lines.filter(function (line) { return line !== 'YES'; });
        if (!meaningful.length && !context.allowEmpty) {
          return [];
        }
        return [];
      },
      renderAfterCommand: function (entry, state, context) {
        if (context && (context.suspended || context.waitingForDecision)) return [];
        const promptModuleName = context && Object.prototype.hasOwnProperty.call(context, 'commandPromptModuleName')
          ? context.commandPromptModuleName
          : null;
        const prompt = historicalPromptText(state, '.', promptModuleName);
        return [prompt === '&.' ? prompt : prompt + ''];
      },
      entryDisplayText: entryDisplayText,
    };
  }

  function normalizeProfile(profile) {
    if (!profile) return normalizedProfile();
    if (typeof profile === 'string') {
      if (profile === 'historical') return historicalProfile();
      if (profile === 'normalized') return normalizedProfile();
    }
    return Object.assign(normalizedProfile(), profile);
  }

  return {
    normalizedProfile: normalizedProfile,
    historicalProfile: historicalProfile,
    normalizeProfile: normalizeProfile,
    entryDisplayText: entryDisplayText,
    prefixHistoricalCommandLines: prefixHistoricalCommandLines,
    mergeHistoricalTranscriptChunks: mergeHistoricalTranscriptChunks,
  };
});
