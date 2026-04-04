(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./terms'),
      require('./unify'),
      require('./freshen'),
      require('./workspace'),
      require('./engine'),
      require('./lexer'),
      require('./reader'),
      require('./loader'),
      require('./shell'),
      require('./transcript_profiles'),
      require('./spectrum_adapter')
    );
  } else {
    root.MicroPrologCleanRoomPrototype = factory(
      root.MicroPrologCleanRoomTerms,
      root.MicroPrologCleanRoomUnify,
      root.MicroPrologCleanRoomFreshen,
      root.MicroPrologCleanRoomWorkspace,
      root.MicroPrologCleanRoomEngine,
      root.MicroPrologCleanRoomLexer,
      root.MicroPrologCleanRoomReader,
      root.MicroPrologCleanRoomLoader,
      root.MicroPrologCleanRoomShell,
      root.MicroPrologCleanRoomTranscriptProfiles,
      root.MicroPrologCleanRoomSpectrumAdapter
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Terms, Unify, Freshen, Workspace, Engine, Lexer, Reader, Loader, Shell, TranscriptProfiles, SpectrumAdapter) {
  'use strict';

  function createFamilyDemoWorkspace() {
    Terms.resetVariableIds();
    const workspace = Workspace.createWorkspace();
    Workspace.installDerivedSupport(workspace);

    Workspace.addClause(workspace, Terms.Struct('parent', [Terms.Sym('henry'), Terms.Sym('edward')]), []);
    Workspace.addClause(workspace, Terms.Struct('parent', [Terms.Sym('edward'), Terms.Sym('alice')]), []);
    Workspace.addClause(workspace, Terms.Struct('parent', [Terms.Sym('edward'), Terms.Sym('beatrice')]), []);

    const x1 = Terms.Var('x');
    const y1 = Terms.Var('y');
    Workspace.addClause(workspace, Terms.Struct('ancestor', [x1, y1]), [Terms.Struct('parent', [x1, y1])]);

    const x2 = Terms.Var('x');
    const y2 = Terms.Var('y');
    const z2 = Terms.Var('z');
    Workspace.addClause(workspace, Terms.Struct('ancestor', [x2, y2]), [
      Terms.Struct('parent', [x2, z2]),
      Terms.Struct('ancestor', [z2, y2]),
    ]);

    return workspace;
  }

  function runFamilyDemo() {
    const workspace = createFamilyDemoWorkspace();
    const engine = Engine.createEngine(workspace, { maxSteps: 1000, maxSolutions: 10 });
    const who = Terms.Var('who');
    const result = Engine.runQuery(engine, [Terms.Struct('ancestor', [Terms.Sym('henry'), who])]);
    return {
      workspace: workspace,
      result: result,
      transcript: result.solutionTexts.join('\n'),
    };
  }

  function runHistoricalTextDemo() {
    const workspaceText = [
      '((parent henry edward))',
      '((parent edward alice))',
      '((parent edward beatrice))',
      '((ancestor X Y) (parent X Y))',
      '((ancestor X Y) (parent X Z) (ancestor Z Y))',
    ].join('\n');
    const result = Loader.runHistoricalTextQuery(workspaceText, '((ancestor henry Who))', {
      maxSteps: 1000,
      maxSolutions: 10,
    });
    return {
      workspaceText: workspaceText,
      result: result,
      transcript: result.solutionTexts.join('\n'),
    };
  }

  function runHistoricalShellDemo() {
    const workspaceText = [
      '((parent henry edward))',
      '((? X)|X)',
    ].join('\n');
    const session = Shell.runHistoricalCommandText(workspaceText, '((? ((parent henry edward))))', {
      maxSteps: 1000,
      maxSolutions: 10,
    });
    return {
      workspaceText: workspaceText,
      transcript: session.transcript,
      outputs: session.outputs,
    };
  }

  return {
    Terms: Terms,
    Unify: Unify,
    Freshen: Freshen,
    Workspace: Workspace,
    Engine: Engine,
    Lexer: Lexer,
    Reader: Reader,
    Loader: Loader,
    Shell: Shell,
    TranscriptProfiles: TranscriptProfiles,
    SpectrumAdapter: SpectrumAdapter,
    createFamilyDemoWorkspace: createFamilyDemoWorkspace,
    runFamilyDemo: runFamilyDemo,    runHistoricalTextDemo: runHistoricalTextDemo,
    runHistoricalShellDemo: runHistoricalShellDemo,
  };
});
