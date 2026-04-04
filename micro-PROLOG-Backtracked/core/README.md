# Clean-room prototype slice

This directory is the executable clean-room path for the rewrite plan.

It is intentionally small and readable. It does **not** replace the verified runtime.
It runs in parallel so the historical implementation can stay stable while the new
architecture is proven in narrow slices.


## Test layout

All clean-room test assets now live under `core-tests/`. That folder currently holds:

- `cleanroom_smoke_tests.js`
- `cleanroom_smoke_report.txt`
- `cleanroom_historical_session_tests.js`
- `cleanroom_historical_session_test_report.txt`
- `core-tests/all-sessions.io.json`

Runtime and shell implementation files stay under `core/`. The historical-session suite compares transcript behavior against the recorded original implementation sessions, ignoring only the Spectrum banner.

## Included pieces

- `terms.js` — explicit term model with symbols, numbers, variables, structures, and lists
- `unify.js` — trail-based unification with rollback support
- `freshen.js` — clause freshening / renaming-apart support
- `workspace.js` — tiny ordered clause store with relation indexing plus a small derived-control bootstrap
- `engine.js` — small depth-first direct-query solver for user clauses plus a still-small historical builtin layer centered on `R`, output, and workspace access
- `lexer.js` — tiny tokenizer for the clean-room historical subset
- `reader.js` — historical parenthesized term, clause, and query parser
- `loader.js` — workspace loader and parsed text-query helpers for the historical parenthesized source path
- `shell.js` — tiny structured command-entry/session layer for parenthesized historical query and clause-load commands
- `index.js` — single import surface and small text-demo helpers
- `cleanroom_smoke_tests.js` — executable proof that the slice works

## Control shape in this pass

This pass deliberately moves the clean-room control layer closer to the manual shape.

Hardwired in the engine:

- `=` and `EQ`
- `TRUE`
- `FAIL`
- `/`
- `/*`
- `R` with `ACCEPT` kept as a compatibility alias
- `LST`
- `CON`
- `NUM`
- `INT`
- `VAR`
- `SYS`
- `SPACE`
- `SUM`
- `TIMES`
- `LESS`
- `SIGN`
- `STRINGOF`
- `CHAROF`
- `P` and `PP`
- `NEW` and `QT`
- `RFILL`
- `ADDCL`
- `CL`
- `CMOD`
- `CRMOD`
- `OPMOD`
- `CLMOD`
- `DICT`
- `DELCL`
- `KILL`
- `LIST`
- `LISTP`
- `SAVE`
- `LOAD`
- `CREATE`, `WRITE`, `W`, and `CLOSE`
- `ISALL`

Installed as ordinary derived clauses in the workspace:

- `NOT`
- `OR`
- `IF/2`
- `IF/3`
- `ONE`
- `?`
- `FORALL`
- `!`
- `<SUP>`
- `<>`

The point is to keep only one low-level control primitive in the engine and define the
higher-level control forms above it.

This pass removes the earlier `APPLY` stand-in. Instead, the clean-room engine now
executes historical meta-variable body forms directly. The small derived supervisor helper
`?` is now also present in its historical clause form `((? X)|X)`, so conjunctions can be
passed through places that syntactically require a single atom without widening the shell:


- a variable in the body can name one goal or one historical atom list
- a variable as the predicate symbol of a body atom is preserved until runtime and must be bound to a constant relation name before that atom is evaluated
- a variable as the tail of the body can name a whole historical goal sequence

That is closer to the manual and makes the derived control clauses read like ordinary
program clauses rather than engine-specific helper calls.

## Supported source subset in this pass

The only native clean-room source syntax is the parenthesized standard micro-PROLOG syntax.

The native lexer also now follows the historical variable rule from the manual: only `x`, `y`, `z`, `X`, `Y`, and `Z` optionally followed by digits are variables. Forms such as `Who`, `Tail`, `M`, or `x12c` are native constants, not variables. Historical canonicalization is also applied, so `x0` is the same variable as `x`, `x03` is the same variable as `x3`, and out-of-range subscripts fold back into the historical `0..127` space so `x128` aliases `x`. Chapter 2.2 floating-point literals with a required decimal point and optional `e` exponent are now accepted too; the clean-room path deliberately keeps numeric range enforcement simple and accepts ordinary finite JavaScript numbers rather than reproducing historical storage limits.

Included forms:

- list terms such as `(a b|Y)`
- facts such as `((parent henry edward))`
- rules such as `((ancestor X Y) (parent X Z) (ancestor Z Y))`
- goal lists such as `((ancestor henry X))`
- empty goal forms `()` bridged to `TRUE` in clause-body and query-goal positions
- double-quoted constants, numbers, alpha-numeric constants, and graphic atoms within the same parenthesized surface
- the historical special single-character constants `[ ] < > { }` as ordinary constants rather than structural delimiters

Deliberate non-goal in the clean-room core:

- no native SIMPLE/readable syntax such as `parent(henry, edward).` or `?- ancestor(henry, X).`

If SIMPLE-style readable interaction is supported later, it should come from loading the
historical `SIMPLE` utility/module path rather than from baking a second native syntax into
the clean-room parser.

This is still a deliberately small reader. It is not yet a full historical lexer/parser, but a few ahistorical conveniences have now been removed: `%` is no longer treated as a line-comment introducer, single quotes are no longer accepted as quoted constants, underscores are no longer accepted inside alpha-numeric tokens, and dotted clause separators are no longer accepted by the native reader.
The clean-room runtime is also now stricter about undefined relations: a non-builtin goal with no matching clauses no longer yields ordinary logical failure in the clean-room engine, and instead raises historical `Clause error 2`.
This pass adds the low-level historical type predicates `NUM`, `INT`, and `VAR` alongside the earlier `CON` test and the first small `RFILL` slice: the first prefilled term is read back through the existing suspended-input path, unchanged tail terms remain available to later `R` calls, and remembered variable names from the first prefilled term are restored when the edited term is read back in. Native floating-point input is now also accepted in the clean-room reader; number display still uses ordinary JavaScript formatting rather than a separate historical normalization pass.
The clean-room runtime also now treats `/*` as the historical always-true comment predicate and protects it as a primitive relation so it can no longer be defined accidentally as an ordinary user relation.
It also adds `SYS` and `SPACE` as core built-ins: `SYS` recognises primitive relation names and primitive call forms, and `SPACE` returns a small runtime-owned kilobyte estimate derived from the current clean-room workspace rather than from a shell constant.
This pass also adds the first arithmetic and string built-ins as true core runtime predicates: `SUM`, `TIMES`, `LESS`, `SIGN`, `STRINGOF`, and `CHAROF`. The arithmetic forms now support the historically important check/compute/divide slices, `LESS` compares both numbers and constants, `STRINGOF` converts between packed constants and character lists, and `CHAROF` maps between constants and ASCII codes.
Utility installation no longer belongs to the clean-room core surface: utilities such as `MODULES` or `SIMPLE` may still be assembled in tests or external loaders, but `workspace.js` no longer embeds utility installers.
The clean-room solver now keeps successful `ADDCL` and `DELCL` database effects as true side effects in the manual sense: once one of these calls succeeds its change is not undone by later backtracking or branch failure, and it also remains live across `R`/`RFILL` suspension.
The goal of this pass is to prove that the clean-room path can read and execute one narrow
parenthesized historical subset without importing the old runtime structure.

## What this slice still omits

- full historical shell/session formatting
- directives and storage hooks
- storage/input effects
- utility/module loaders beyond test-only assembly
- chapter 4/5/6 wrappers
- browser integration
- the broader historical parser surface beyond this first parenthesized bridge

## Why it exists

The verified runtime already passes the active suites. The clean-room work should
therefore advance in narrow, separately verifiable slices that prioritize simplicity
and readability without risking regressions in the historical implementation.

Parser boundary kept on purpose in this pass:

- bare zero-arity names are not given any special reader rule
- top-level clause and query forms must stay parenthesized
- unsupported non-parenthesized forms fail normally rather than being given a SIMPLE-style fallback parser


## First shell/session slice in this pass

This pass adds one deliberately small shell layer above the clean-room core.

Included behavior:

- split one or more top-level historical parenthesized forms into command entries
- keep the command kind explicit rather than guessing from ambiguous surface text
- normalize each command into a structured entry with `sourceText`, `kind`, and parsed `form`
- execute query entries directly against a session state without transcript reconstruction
- execute clause-load entries by mutating the session workspace through the same normalized path
- render a minimal transcript result using `YES`, substitutions, `NO`, `No (more) answers`, and `ADDED`
- preserve session history across repeated command execution calls

Deliberate limits:

- no heuristic auto-detection between historical clause text and historical query text
- minimal historical `more?(y/n)` answer supervision for explicit y/n resume commands
- no browser adapter involvement

The point of this slice is to prove that the clean-room path can step one layer up
from raw engine calls into a structured command-entry/session flow while staying small.


## Answer supervision in this pass

This pass adds one narrow supervision layer above query execution.

Included behavior:

- a query with more than one collected answer now shows only the first answer immediately
- the shell stores pending answers inside the session state
- explicit `more_answer` commands with `y` or `n` resume or stop answer delivery
- while pending answers exist, the shell rejects any new query or clause command
- answer supervision still stays mostly inside `shell.js`; the engine now also exposes resumable query state for suspended input

Deliberate limits:

- `more?(y/n)` is modeled through an explicit structured command kind, not a browser prompt
- supervision only ranges over the answers already collected for that query run
- there is still no full historical utility-level suspended input system beyond the current explicit answer-resume and engine-centered `R/1` slice


## Suspended input in this pass

This pass moves suspended input from shell-side replay into the clean-room engine.

Included behavior:

- explicit `input_reply` command entries remain in the shell/session layer
- historical `R(X)` suspends as the primitive input operation
- `ACCEPT(X)` remains supported as a compatibility alias over the same engine path
- the shell stores one pending suspended query in `state.pendingInput`
- each explicit input reply term resumes the suspended query through engine state rather than by replaying the whole original query
- multiple `R(...)` or `ACCEPT(...)` goals can suspend and resume one at a time
- while pending input exists, the shell rejects new query and clause commands
- prompt timing now keeps the already chosen proof prefix before the suspended input goal

Deliberate limits:

- this is still frozen residual-query resume, not a full live continuation object
- earlier prefix bindings and continuation shape are preserved, but earlier unexplored search alternatives are not yet resumed as live engine state
- utility-level command cadence still needs a later pass
- there is still no browser or stdin wiring

The point of this slice is to center historical interactive behavior on `R/1` while keeping the clean-room implementation small and explicit.

## Historical utility primitives in this pass

This pass adds the first small builtin layer needed to let interactive utilities emerge from Prolog code instead of shell tricks.

Included behavior:

- `EQ` is accepted as a direct equality alias
- `LST` checks that a term is a proper list
- `P` appends console-style output without forcing a newline
- `PP` appends output and then terminates the line
- query results now carry emitted output lines alongside answer text
- browser/test hosts may now attach a dedicated output adapter through `uiEffects.handleOutput(...)` so `P`/`PP` can drive a Spectrum-style screen model without changing transcript semantics
- `ADDCL` can add one historical clause term directly from a query
- `CL` can retrieve matching workspace clauses in both one-argument and three-argument forms
- workspace mutation and lookup stay in the engine/workspace layer rather than being reimplemented in the shell

Deliberate limits:

- `P` and `PP` formatting is only the first readable approximation of the manual surface
- `CL`, `DELCL`, and relation-name `KILL` currently range over the current clean-room module only, not yet over broader supervisor ownership states
- `DICT` is implemented as an engine builtin with historical variable-tail query support and synthetic `LIST DICT` rendering from the current module store
- `LISTP`, `SAVE`, `LOAD`, `CREATE`, `OPEN`, `READ`, `WRITE`, `W`, and `CLOSE` now share one deliberately small runtime-owned text-file hook
- `LOAD` currently distinguishes ordinary saved programs from saved module files by the saved text shape and keeps module loading in the runtime/workspace layer
- the clean-room shell still uses explicit normalized command kinds rather than trying to mimic every historical prompt shape

The point of this slice is to keep shrinking the shell by moving historically meaningful interaction into a small runtime primitive layer.

## Native syntax constraint

The clean-room rewrite should treat the parenthesized standard micro-PROLOG syntax as the
only native syntax.

That means:

- parser, loader, and shell examples should use the parenthesized form
- readable/SIMPLE syntax should not be a built-in alternate parse path
- any later SIMPLE-style user surface should come from loading the historical `SIMPLE`
  module/utility layer rather than from changing the kernel parser
- shell-side convenience is now kept narrow: live input no longer strips prompt text such as `&.`/`&?`, dotted surface text gets no dedicated parser privilege and instead flows through ordinary tokenization (so forms such as `PP.` behave like `PP .`), `?` gets no parser special case beyond ordinary unary-command handling, and multi-argument unary command text is no longer rewritten into buffered input
- the only remaining live shell shortcut beyond supervisor commands is the manual-described unary-relation command surface, so `?` works because `?/1` is an ordinary unary relation rather than because the shell has a dedicated `?` parser case

This keeps the core aligned with the manual and avoids carrying two competing surface
languages inside the rewrite.

## Module kernel progress in this pass

This pass hardens the first real module-facing kernel slice instead of adding more shell
surface.

Included behavior:

- the workspace remains an explicit module store with `&` as the root module
- accessible relation lookup is now module-aware by relation name, not by accidental
  overlap with a local signature in the current module
- `CMOD` reports the current module name
- `CRMOD` creates a new module and enters it
- `OPMOD` enters an existing module
- `CLMOD` returns from the current non-root module to `&`
- the root module can call exported relations of loaded modules
- a non-root module can call exported relations only when it imports those names

Deliberate limits:

- `LOAD` and `SAVE` are still later work
- collision details and broader module utility flows still need more parity checks
- the shell still uses explicit normalized command kinds rather than historical prompt text

The point of this slice is to pin down the module-facing kernel rules before more storage
or editor-style behavior is layered on top.

## Module-first architectural constraint

After rereading the manual sections on modules, `DICT`, `LOAD`/`SAVE`, and the `MODULES`
utility, the clean-room path should treat modules as a kernel/workspace concern rather
than a later wrapper.

That means:

- the root workspace `&` should be modeled as the special root module
- clause ownership should be explicit per module
- relation visibility should be resolved from import/export rules in the runtime
- module dictionaries should be per-module, matching the `DICT` shape in the manual
- file loading/saving should be added only after the module store exists

So the next structural step is not more shell surface. It is the workspace refactor toward
an explicit module store. See `MODULE-FOUNDATION-NOTES.md`.

## Missing features and rough estimates

These are clean-room-path estimates, not promises. They assume the verified historical runtime stays authoritative and unchanged.

1. Historical suspended input inside clause bodies and utility-style flows beyond the current residual-query model — about `1-2` iterations
2. Listing / program rendering from the clean-room workspace — about `1` iteration
3. `DELCL`, `KILL`, and the rest of the database primitive layer — about `1-2` iterations
4. Chapter-style answer/input cadence closer to `MICRO` / `TRACE` shells — about `1-2` iterations
5. Shell-side clause/query command parsing beyond the current explicit command-kind split — about `1` iteration
6. Readable REPL command-entry path parallel to the historical parenthesized path — about `1` iteration
7. Module, directive, export, and import support — about `2-3` iterations
8. Storage / save / load effect hooks — about `1-2` iterations
9. Arithmetic / expression builtins beyond plain `=` and `EQ` — about `1-2` iterations
10. Broader manual-surface lexer/parser parity — about `2-3` iterations
11. Meta-predicate surface beyond the current derived-control slice — about `1-2` iterations
12. Chapter 4/5/6 shell wrappers and closer parity behavior — about `2` iterations
13. Trace / show / utility interaction support — about `2-3` iterations
14. Browser adapter over normalized clean-room command entries — about `1-2` iterations
15. End-to-end clean-room parity hardening against the corpus / primer surfaces — about `3-5` iterations after the above foundations

## Module database progress in this pass

This pass adds the next small module-aware database layer without widening the shell.

Included behavior:

- `DICT` returns the current module dictionary from the explicit module store
- `DELCL` supports both historical forms:
  - unary deletion by matching clause pattern
  - binary deletion by relation name and clause position
- `KILL` can now:
  - delete all local clauses for one relation
  - delete all local clauses for a list of relations
  - delete all local clauses of the current module with `ALL`
  - delete a named module from root `&`
- root `KILL ALL` clears only workspace clauses and leaves loaded modules intact
- deleting a module immediately updates root import visibility

Deliberate limits:

- `LIST` now lists current-module clauses, selected relations, relation lists, and named modules through the runtime/workspace layer
- `DICT` now also matches historical variable-tail calls such as `((DICT X Y Z|X1))`
- imported-name deletion errors are only lightly characterized so far
- module/file persistence still waits on the rest of the module kernel path

The point of this slice is to continue moving module semantics into the runtime/workspace layer instead of letting them leak into shell special cases.


## Listing/runtime rendering progress in this pass

This pass adds the first small `LIST` implementation without expanding the shell.

Included behavior:

- `LIST` is now a runtime builtin, not a shell-side transcript formatter
- clause and module rendering use the historical parenthesized surface rather than the readable/SIMPLE syntax
- `(LIST R)` lists the accessible program for relation `R`
- `(LIST (R1 ... Rk))` lists the accessible programs for each named relation
- `(LIST ALL)` lists only the clauses owned by the current module
- `(LIST <module-name>)` lists the named module in save-style form
- root `&` can list an exported relation of a loaded module without listing the whole module

Deliberate limits:

- formatting is still a first compact historical approximation rather than the final indented supervisor surface
- `LISTP`, `SAVE`, and `LOAD` now exist, but only over the deliberately narrow runtime text-file seam

The point of this slice is to keep rendering semantics in the runtime/workspace layer and avoid rebuilding a second interpreter inside the shell.


## File-effect seam in this pass

This pass adds the smallest runtime-owned text-file seam needed for `LISTP`, `SAVE`, and `LOAD`.

Included behavior:

- `LISTP` can write listing text for `ALL`, one relation, a relation-name list, or a named module
- `SAVE` can write the current workspace/module program, a relation-name list, or a named module
- `LOAD` can read ordinary saved programs into the current module and can load one or more saved modules when the file has module-save shape
- module saves use the same save-style form already used by `LIST <module-name>`
- when no explicit file hook is supplied, reads and writes go to an in-memory `fileStore` on engine options for testing

Deliberate limits:

- `SAVE` still manages whole files directly rather than going through open-file state
- `LISTP` and the new output-side primitives share one narrow text serialization path rather than simulating device pragmatics
- `OPEN` and `READ` now exist over the same narrow runtime text-file seam used by the higher-level file operations
- `READ` currently expects one file to have been opened explicitly and reports a file error when no next term is available
- `LOAD` now rejects file-name collisions against visible relation names in the current module context and against loaded module names


## LOAD parity tightening in this pass

This pass keeps `LOAD` runtime-owned but tightens several historical edge cases.

Included behavior:

- `LOAD` now rejects a file name that collides with a visible relation name in the current module context or with a loaded module name
- ordinary program `LOAD` now rejects a clause whose relation name matches the file name being loaded
- ordinary program `LOAD` now rejects a clause whose relation name matches a loaded module name
- ordinary program `LOAD` now reports `Illegal use of modules` when a loaded clause targets a relation exported by a current module
- `LOAD` still behaves incrementally: clauses successfully read before a later failing clause remain loaded

Decision for now:

- keep the lower-level file slice runtime-owned and small
- keep `SAVE` and `LOAD` as direct whole-file operations so the shell does not grow a second file subsystem
- keep device/media pragmatics out of the clean-room core

## Output-side file primitives in this pass

This pass adds the smallest lower-level file slice that is justified by the historical
module utilities.

Included behavior:

- `CREATE` opens one named file for writing inside the runtime
- `WRITE` appends one PP-style line to the open file
- `W` appends one P-style fragment to the open file
- `CLOSE` flushes the buffered file text through the same runtime-owned file seam used by
  `LISTP`, `SAVE`, and `LOAD`
- `LISTP` now writes to an already open file instead of behaving like a hidden whole-file save

Deliberate limits:

- still only one open file state per evaluation
- no device/media pragmatics
- `SAVE` and `LOAD` still manage whole files directly because they are supervisor-level
  operations in the clean-room path

This keeps the kernel small while covering the concrete historical need exposed by the
`MODULES` utility path.

This pass also adds `OPEN` and `READ` as the matching read-side file slice: `OPEN` reads one named runtime file into a sequential term buffer, and `READ` binds an unbound variable to the next term from that buffer. This pass also adds `RND` as a small runtime builtin with explicit-seed and generated-integer forms, using a deterministic engine-owned generator while allowing the zero-arity seed to come from an injected runtime clock hook. The remaining graphics/sound/display/device-facing builtins (`HYBRID`, `NORMAL`, `LNE`, `PNT`, `CLS`, `BORDER`, `BP`, and `PIO`) are now prepared for delegation through a narrow `uiEffects.handleBuiltin(...)` hook so they do not force fake graphics/device logic into the clean-room core. The precise host/runtime contract for that seam is now documented in `core/UI_DELEGATION_CONTRACT.md`.


## Historical session replay suite

This bundle now also includes a separate exploratory corpus suite:

- `core-tests/cleanroom_historical_session_tests.js`
- `core-tests/cleanroom_historical_session_test_report.txt`

Purpose:

- replay the real recorded sessions from `core-tests/all-sessions.io.json` against the clean-room path
- compare *core-semantic* output rather than full Spectrum transcript choreography
- expose where the clean-room runtime/shell still diverges from the historical recordings

This suite is intentionally **not** a gating verifier yet. It is a backstop and discovery tool for the testing site.

Normalization used by this suite:

- ignore the Spectrum banner
- remove historical prompt/echo lines such as `&.` from the expected output
- remove clean-room shell scaffolding such as `YES`, `No (more) answers`, `more?(y/n)`, and `ADDED` from the actual output
- treat bare recorded clause entries as silent workspace updates in the replay adapter rather than as normalized `ADDED` shell events

Run it with:

```bash
node core-tests/cleanroom_historical_session_tests.js
```

The generated report is a snapshot of the current clean-room replay status against the full `core-tests/all-sessions.io.json` corpus. In this pass the suite is created first; failures are expected and informative.


## Pluggable transcript profiles and historical replay

The clean-room shell now treats command echoing, prompts, and shell-status text as a pluggable transcript layer rather than as hardwired normalized strings.

Implemented in `transcript_profiles.js`:

- `normalizedProfile()` keeps the compact testing/session style such as `YES`, `NO`, `No (more) answers`, `more?(y/n)`, `input?`, and `ADDED`
- `historicalProfile()` renders the historical command/prompt surface such as `&.`, continuation prefixes like `1. `, `&?`, clause-load silence, and historical `?` for failed commands and queries

The shell accepts a transcript profile through session options:

- `Shell.createSessionState(workspace, { transcriptProfile: ... })`
- `Shell.runNormalizedCommand(state, entry, { transcriptProfile: ... })`
- `Shell.executeHistoricalCommands(state, text, { transcriptProfile: ... })`

This still does not make the clean-room shell a full historical supervisor, but it does move transcript policy out of the runtime core and into one host-selectable module.

The historical corpus replay suite now uses the historical transcript profile and compares full transcript output from `core-tests/all-sessions.io.json` apart from Spectrum-banner stripping plus line-ending and trailing-space normalization. That means command echoes like `&.LIST likes`, continuation prompts, `&?`, and shell failure output are now part of the comparison surface instead of being normalized away.

## Browser output modes

The HTML REPL now keeps the existing transcript-first text mode as the default, and also offers a Spectrum mode driven by `core/spectrum_adapter.js`.

The current browser adapter split is:

- text-only mode: transcript remains authoritative and Spectrum control bytes are ignored visually
- Spectrum mode: `P`/`PP` feed a 32×24 attributed text screen, `AT`/`INK`/`PAPER`-style control bytes affect that screen, and delegated graphics built-ins render into a layered canvas view
- The browser REPL input now behaves more like a shell command line: `↑`/`↓` walk command history, the current draft is restored when stepping back past the newest entry, and consecutive duplicate submissions are not stored twice in a row
- tests can use the same adapter seam to record text-output chunks plus graphics/device commands without asserting against browser rendering
