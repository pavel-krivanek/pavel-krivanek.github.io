(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./workspace'), require('./reader'), require('./engine'));
  } else {
    root.MicroPrologCleanRoomLoader = factory(
      root.MicroPrologCleanRoomWorkspace,
      root.MicroPrologCleanRoomReader,
      root.MicroPrologCleanRoomEngine
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Workspace, Reader, Engine) {
  'use strict';

  if (!Workspace || !Reader || !Engine) {
    throw new Error('loader.js requires workspace.js, reader.js, and engine.js.');
  }

  function applySourceEntryToWorkspace(workspace, entry) {
    if (!entry) return;
    if (entry.kind === 'clause') {
      Workspace.addClause(workspace, entry.clause);
      return;
    }
    if (entry.kind === 'module-open') {
      Workspace.createModule(workspace, entry.moduleNameTerm, entry.exportListTerm, entry.importListTerm);
      return;
    }
    if (entry.kind === 'module-close') {
      Workspace.closeCurrentModule(workspace);
      return;
    }
    throw new Error('Unsupported source entry kind: ' + String(entry.kind));
  }

  function loadWorkspaceFromEntries(entries) {
    const workspace = Workspace.createWorkspace();
    Workspace.installDerivedSupport(workspace);
    entries.forEach(function (entry) {
      applySourceEntryToWorkspace(workspace, entry);
    });
    return {
      workspace: workspace,
      entries: entries,
      clauses: Workspace.listClauses(workspace),
      derivedClauses: Workspace.listDerivedClauses(workspace),
    };
  }

  function loadWorkspaceFromText(text) {
    const classified = Reader.parseHistoricalLoadSourceText(text);
    return loadWorkspaceFromEntries(classified.entries);
  }

  function loadHistoricalWorkspaceFromText(text) {
    return loadWorkspaceFromText(text);
  }

  function runTextQuery(workspaceOrText, queryText, options) {
    const loaded = typeof workspaceOrText === 'string'
      ? loadWorkspaceFromText(workspaceOrText)
      : { workspace: workspaceOrText };
    const engine = Engine.createEngine(loaded.workspace, options);
    const goals = Reader.parseQueryText(queryText);
    return Engine.runQuery(engine, goals, options);
  }

  function runHistoricalTextQuery(workspaceOrText, queryText, options) {
    const loaded = typeof workspaceOrText === 'string'
      ? loadWorkspaceFromText(workspaceOrText)
      : { workspace: workspaceOrText };
    const engine = Engine.createEngine(loaded.workspace, options);
    const trimmed = String(queryText || '').trim();
    const historicalText = trimmed.charAt(0) === '?' ? trimmed.slice(1).trim() : trimmed;
    const goals = Reader.parseHistoricalGoalListText(historicalText);
    return Engine.runQuery(engine, goals, options);
  }

  return {
    loadWorkspaceFromEntries: loadWorkspaceFromEntries,
    loadWorkspaceFromText: loadWorkspaceFromText,
    loadHistoricalWorkspaceFromText: loadHistoricalWorkspaceFromText,
    runTextQuery: runTextQuery,
    runHistoricalTextQuery: runHistoricalTextQuery,
    applySourceEntryToWorkspace: applySourceEntryToWorkspace,
  };
});
