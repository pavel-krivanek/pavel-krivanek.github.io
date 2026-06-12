# Pharo 14 headless bring-up test pass v015


## New in v026

- Browser SqueakJS now reports a Unix-compatible platform identity by default for Pharo 14:
  - `platformName -> unix`
  - `platformSubtype -> x86_64`
  - `osVersion -> linux-gnu (SqueakJS browser; <user-agent>)`
  - `windowSystem -> HTML`
- This fixes the browser startup failure seen in `PharoDebug.log`, where Pharo 14 aborted in `OSPlatform class>>determineActivePlatform` because the browser VM previously reported `JS - Browser - <user-agent>` and none of Pharo's platform classes matched it.
- The browser test URL now keeps the explicit `#unix` flag as documentation, but the source default is also Unix-like so a missing flag no longer trips `OSPlatform` at startup.
- Added a regression test checking that the browser source keeps the Unix-compatible platform identity required by Pharo startup.

### Updated browser start URL

```text
http://localhost:8000/run/#unix&url=../local-pharo14&files=[Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image,Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.changes,Pharo14.0-64bit-6a0497e.sources]&root=/pharo14&traceFFI=true
```

## New in v025

- Expanded the SDL2 event emulation from simple `SDL_PollEvent` support to the broader event API shape expected by interactive OSWindow loops:
  - `SDL_PumpEvents`
  - `SDL_WaitEvent`
  - `SDL_WaitEventTimeout`
  - `SDL_HasEvent` / `SDL_HasEvents`
  - `SDL_FlushEvent` / `SDL_FlushEvents`
  - `SDL_PeepEvents`
  - `SDL_PushEvent`
  - `SDL_RegisterEvents`
- Added SDL keyboard state support via `SDL_GetKeyboardState`, plus `SDL_GetModState` / `SDL_SetModState`, focus probes, and browser-keyup bridging from `squeak.js` into SDL `SDL_KEYUP` events.
- Corrected mouse-button translation at the SDL boundary: SqueakJS still uses its internal red/yellow/blue bit convention, while SDL-facing events and `SDL_GetMouseState` now use SDL left/middle/right masks and button numbers.
- Added mouse/focus helpers useful for browser-hosted OSWindow work: `SDL_GetGlobalMouseState`, `SDL_GetRelativeMouseState`, `SDL_GetMouseFocus`, `SDL_GetKeyboardFocus`, and `SDL_CaptureMouse`.
- Kept the browser bridge non-blocking: `SDL_WaitEvent*` drains queued events if present and otherwise returns no event instead of blocking the JavaScript VM. This is intentional for now because a synchronous FFI callout cannot suspend the browser event loop safely.

### Browser test start procedure

A practical first browser smoke is to serve this bundle and the full Pharo image from a local HTTP server. Do not open the page directly from `file://`, because the browser VM fetches images through normal HTTP requests.

```sh
unzip SqueakJS-pharo14-tffi-sdl2-browser-unix-v026.zip
cd SqueakJS-main
mkdir -p local-pharo14
unzip /path/to/pharoImage-x86_64.zip -d local-pharo14
python3 -m http.server 8000
```

Then open this URL in a desktop browser:

```text
http://localhost:8000/run/#unix&url=../local-pharo14&files=[Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image,Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.changes,Pharo14.0-64bit-6a0497e.sources]&root=/pharo14&traceFFI=true
```

For a lower-noise run, omit `&traceFFI=true`. The first run stores the files into the browser-backed SqueakJS filesystem; later reloads can reuse the stored files.

Once the image is running, use a Playground/Workspace to force the OSWindow SDL2 path:

```smalltalk
| attrs w f r |
attrs := OSWindowAttributes new
  title: 'SqueakJS SDL2';
  extent: 320@200;
  yourself.
w := OSWindow createWithAttributes: attrs.
f := Form extent: 320@200 depth: 32.
f fillColor: Color red.
r := w newFormRenderer: f.
r updateAll.
r present.
{ w isValid . w backendWindow windowId . w backendWindow extent . r class name }
```

Expected current behavior: the code should create a valid SDL-backed OSWindow object and drive `OSSDL2FormRenderer` through the emulated SDL renderer/texture path. The canvas-backed rendering is still experimental; focus first on console errors, missing symbols, and whether the browser remains responsive.


## New in v024

- Added an FFI callout-context bridge so emulated C libraries can see the current `Squeak.Primitives` instance during both classic FFI and ThreadedFFI same-thread callouts.
- SDL2 windows now bind to the current SqueakJS display/canvas when a browser display context is available. The binding sizes the canvas, remembers `display.sdlWindow`, and keeps Node/headless behavior deterministic when no canvas exists.
- SDL2 renderer and texture emulation now carries real RGBA pixel buffers through `SDL_UpdateTexture`, `SDL_RenderCopy`, `SDL_RenderClear`, and `SDL_RenderPresent`. In browser-shaped displays, render copy/update paths paint through the display canvas 2D context.
- SDL window surfaces now have pitch/depth/pixel metadata and `SDL_UpdateWindowSurface` / `SDL_UpdateWindowSurfaceRects` can paint the surface buffer into the bound canvas context.
- Added an SDL event bridge from SqueakJS browser-style mouse, wheel, keyboard, and window events to SDL2 `SDL_PollEvent` records. This is the first browser-input path needed by Pharo OSWindow over SDL2 instead of the legacy Squeak event primitives.
- `squeak.js` now mirrors browser input events into the SDL2 emulation queue when the FFI emulation layer is loaded, while preserving the existing legacy `display.eventQueue` behavior.
- Expanded SDL2 unit coverage for browser-shaped canvas binding, texture upload/render-copy behavior, and SDL event record layout.

The project started with a minimal headless/Sista bring-up layer and now also uses the full Pharo image as an active FFI/OSWindow target. The current focus is to keep the Sista/ephemeron regressions stable while growing ThreadedFFI, libc, and SDL2 emulation toward browser-hosted Pharo execution.

## Runtime changes under test

Carried forward from earlier passes:

- Direct LargeInteger primitive dispatch for primitive numbers 20-37 uses JavaScript BigInt.
- SmallInteger arithmetic primitives 1, 2, and 9 promote overflowing 64-bit bridge results into LargeInteger objects.
- `primitiveHashMultiply` supports LargeInteger receivers so boxed 64-bit SmallInteger keys such as `2^60-1` use the native Pharo hash-multiply behavior.
- For 64-bit images, the JS-number SmallInteger bridge is limited to the exact-safe integer range `[-2^53, 2^53-1]`.
- The image reader records `image.is64Bit`, `image.bytesPerWord`, and `image.multipleByteCodeSetsActive`.
- `vmParameterAt: 40` reports the current image word size.
- `squeak_node.js` passes a Pharo-compatible `getSystemAttribute:` layout:
  - `-1 -> --headless`
  - `0 -> VM path`
  - `1 -> image path`
  - `2... -> image-side arguments`
- `squeak_node.js` exits non-zero when the interpreter throws.
- `squeak_node.js` has an opt-in diagnostic dump mode via `SQUEAKJS_DUMP_AFTER_MS=<milliseconds>` for timeout/crash-path smoke tests.
- 64-bit compiled-method byte indexing uses the image word size rather than assuming four-byte literal words.
- 64-bit PC encoding/decoding uses the image word size.
- The old 64-bit PC fixup pass is no longer applied by default, because current Pharo 64-bit images already carry the correct encoded PCs for this interpreter path.
- Pharo `SystemEnvironment` globals are recognized alongside the older `SystemDictionary` shape.
- Semaphore primitives accept subclasses such as `SymbolTableSemaphore`.
- Node startup exposes Unix/x86_64 platform attributes expected by Pharo `OSPlatform`.
- Minimal file/startup primitives are covered:
  - empty-module `primitiveGetCurrentWorkingDirectory`
  - `FileAttributesPlugin.primitiveFileMasks`
  - `FilePlugin.primitiveFileDescriptorType`
  - `FilePlugin.primitiveConnectToFileDescriptor`
  - `FilePlugin.primitiveFileSync`
  - `FilePlugin.primitiveWaitForDataWithSemaphore`
- Freshly instantiated 64-bit Spur `CompiledMethod` and `CompiledBlock` objects in multiple-bytecode-set images are marked with `forceSista`.
- `InstructionPrinter` honors `method.forceSista` for diagnostic disassembly.
- `InstructionStreamSista` no longer depends on undefined `this.mod` / `this.div` helpers for extended closure-copy decoding.

New in v006:

- The JIT compiler now honors `method.forceSista`, not only `method.methodSignFlag()`. Without this, runtime-created Pharo methods/blocks could be interpreted as Sista but compiled as V3 on later activations.
- The JIT full-closure generator now computes extended Sista full-closure literal indexes as `b2 + extA * 256` instead of `b2 + extA * 255`.
- Sista process tests now use grouped eval expressions for the main corpus. This keeps the test focused on bytecode semantics while avoiding long, brittle sequences of separate image startups.
- A nested-closure stress corpus now covers copied-temp reads/writes, repeated copied-temp mutation, nested local temps, temp-vector mutation, escaped closure factories, collection iteration blocks, `cull:`, `caseOf:`, and loop bytecodes.


New in v007/v008:

- `tools/generate-native-sista-fixtures.js` asks native Pharo to compile a curated expression corpus and records byte arrays, literals, expected `printString` results, and `SymbolicBytecodeBuilder` instruction traces.
- `tests/pharo/sista-native-fixtures.test.js` compares SqueakJS instruction decoding against native Pharo instruction-by-instruction, including relative PC, consumed bytes, and normalized symbolic operation.

New in v009:

- The native fixture generator now supports explicit method `source` and `skipEval` metadata. This allows decode-only fixtures for bytecode forms whose runtime semantics depend on VM services not yet under test.
- The native fixture corpus now includes directed-super sends, active-context access, ensure/exception handler shapes, larger temp indexes, many-argument closures, large literal/send indexes requiring extension bytecodes, and a primitive-call fallback method.
- The committed native fixture payload is format 4 and covers 33 fixtures: 24 are also evaluated under SqueakJS with the Pharo 14 metacello image, and 9 are decode-only fixtures retained for bytecode coverage.

New in v010:

- Added `tools/sista-bytecode-coverage-lib.js` and `tools/report-sista-bytecode-coverage.js`. The report classifies Sista bytecode-family coverage across native Pharo-generated fixtures and synthetic decoder fixtures.
- Added `tests/pharo/fixtures/sista-bytecode-coverage.json`, a committed coverage snapshot generated from the v009 native fixture payload plus the synthetic decoder matrix.
- Added `tests/pharo/sista-bytecode-coverage.test.js`, which verifies the committed coverage snapshot is reproducible and that native+synthetic fixtures cover every currently implemented Sista bytecode family.
- The synthetic Sista decoder matrix is now shared through the coverage library so the coverage report and the decoder unit test use the same synthetic fixture definitions.


New in v011:

- The native fixture generator now records `className` and can compile decode-only fixtures against a class other than `UndefinedObject`. This lets the corpus include receiver-variable bytecodes from native Pharo classes without requiring those methods to execute under SqueakJS.
- The generator creates temporary native global bindings `SqueakJSSistaProbeGlobal01` through `SqueakJSSistaProbeGlobal40` during fixture generation. These are used only to make Pharo emit literal-variable access/store bytecodes in a deterministic decode-only fixture.
- The native fixture corpus now includes receiver-variable access/pop/store forms, literal-variable extended push/pop/store forms, quick jump-if-true, and extended jump-if-true.
- Current coverage snapshot: 33 native fixtures, 74 compiled methods/blocks, 1851 native symbolic instructions, 3009 native bytecode bytes, 57 synthetic decoder cases, and 47/47 implemented Sista bytecode families covered. 43 implemented families are native-generated; 4 implemented families are `compiler-unemitted-valid` and remain synthetic-only: quick nop, extended push integer, extended push character, and extended closure copy. Reserved/unimplemented opcode slots remain in the neither bucket and are classified as `reserved-unimplemented`.

New in v012:

- The Sista bytecode coverage report is now format 2 and includes an explicit per-family classification. Implemented families are classified as `native-generated`, `compiler-unemitted-valid`, or `uncovered-implemented`; reserved slots are classified as `reserved-unimplemented`.
- The four remaining synthetic-only implemented families are now deliberately classified rather than merely listed: `quick-nop`, `extended-push-integer`, `extended-push-character`, and `extended-closure-copy`. The current conclusion is that these are valid implemented bytecode forms that current Pharo 14 compiler output does not emit in the committed native corpus.
- `tests/pharo/sista-bytecode-coverage.test.js` now verifies that there are no `uncovered-implemented` families and that the reserved opcode slots are not mistaken for missing implementation coverage.
- With `PHARO14_IMAGE` and `PHARO_NATIVE_VM` set, the coverage test runs a candidate native compiler-emission probe for integer constants, character constants/sends, and nested block shapes. This probe keeps the four remaining implemented families synthetic-only under the current Pharo 14 compiler.
- `tools/generate-native-sista-fixtures.js` now strips embedded NUL bytes from the marker JSON payload before parsing. This makes ad-hoc native candidate probes more robust when Pharo writes wide-string fixture data to stdout.

## Sista test layer

`tests/pharo/sista-bytecodes.test.js` currently checks:

1. Diagnostic disassembly for the observed runtime `DoIt` byte sequence `51 20 60 5c`:
   - `0x51 -> push constant 1`
   - `0x20 -> push literal constant 0`
   - `0x60 -> special send +`
   - `0x5c -> return top`
2. A synthetic decoder coverage matrix for quick, extended, closure, primitive-call, jump, store, remote-temp, and full-closure Sista bytecode forms.
3. JIT generation regressions for:
   - `forceSista` dispatch without relying on the method-header sign flag.
   - extended full-closure literal indexes.
4. A Pharo 14 metacello eval corpus containing 15 logical expressions grouped into 4 eval runs.
5. A nested closure stress corpus containing 16 logical expressions grouped into 3 eval runs.
6. Native-generated fixture comparison against Pharo `SymbolicBytecodeBuilder`, including 74 compiled methods/blocks and 3009 bytecode bytes in the current committed payload.
7. A bytecode-family coverage report that classifies native-only, synthetic-only, both-covered, and neither-covered Sista families, with explicit status labels for compiler-unemitted valid forms and reserved/unimplemented opcode slots.

## Test command

```sh
./verify.sh
```

Optional external Pharo image fixture:

```sh
PHARO14_IMAGE=/path/to/pharo14-metacello.image ./verify.sh
```

If the image is not present, the Pharo-specific smoke probes and eval corpora are skipped; the unit tests, bundled SqueakJS headless fixture, and native-fixture decoder comparison still run.

Optional native Pharo regeneration check:

```sh
PHARO14_IMAGE=/path/to/pharo14-metacello.image \
PHARO_NATIVE_VM=/path/to/pharo \
node tools/run-pharo-tests.js tests/pharo/sista-native-fixtures.test.js
```


Optional native candidate probe for the remaining synthetic-only implemented families:

```sh
PHARO14_IMAGE=/path/to/pharo14-metacello.image \
PHARO_NATIVE_VM=/path/to/pharo \
node tools/run-pharo-tests.js tests/pharo/sista-bytecode-coverage.test.js
```

Generate the Sista bytecode coverage report:

```sh
node tools/report-sista-bytecode-coverage.js
```

Generate the machine-readable report snapshot:

```sh
node tools/report-sista-bytecode-coverage.js --format json --out tests/pharo/fixtures/sista-bytecode-coverage.json
```

## Current known runtime probes

- Pharo 14 metacello image completes the minimal headless command:
  ```sh
  node squeak_node.js pharo14-metacello.image eval '1+2'
  ```
  Expected output includes `3`, and the process exits successfully.
- The metacello path still logs non-fatal missing/faked primitives such as `primitiveCompareWith`, `primitiveInterpreterSourceVersion`, and `LocalePlugin.primitiveTimezoneOffset`; these are not currently blocking the minimal eval/Sista corpus path.
- The full image is intentionally a smoke/progress probe, not a hard target. v013 moved it past initial environment/FFI/origin-resolution startup; v014 moves it past primitiveFetchMourner into later startup/debugging behavior.

## New in v013-ffi

Focus shifted from Sista proof expansion to incremental FFI/full-image bring-up. The full Pharo image remains a smoke/progress probe, not a pass/fail runtime target.

Added initial deterministic FFI and host-service emulation:

- `squeak_node.js` and the test loader now load `vm.plugins.ffi.js`.
- Empty-module Pharo VM primitives now include:
  - `primitiveGetenv`
  - `primitiveLoadSymbolFromModule`
  - `primitiveInterpreterSourceVersion`
  - `primitiveInitilizeCallbacks` / `primitiveInitializeCallbacks`
- `vm.plugins.ffi.js` now has a minimal JS-backed libc module registry and fake `ExternalAddress` symbol handles for resolved functions such as `getenv`.
- `SqueakFFIPrims.primitiveInitilizeCallbacks` records the callback semaphore index and succeeds without implementing actual callback invocation yet.
- Added minimal `UUIDPlugin.primitiveMakeUUID` for Pharo startup UUID generation.
- Expanded minimal `FileAttributesPlugin` with:
  - `primitiveFileExists`
  - `primitiveFileAttribute`
  - `primitiveFileAttributes`
  - `primitiveOpendir`
  - `primitiveReaddir`
  - `primitiveRewinddir`
  - `primitiveClosedir`
- `primitiveGetImmutability` is now faked as false, matching the current no-immutability emulation stance.

New tests:

- `tests/pharo/ffi-emulation.test.js`
- `tests/pharo/uuid-plugin.test.js`
- expanded `tests/pharo/file-primitives.test.js`

Full-image smoke progress after v013-ffi:

- The previous origin-resolution blocker is gone:
  - no missing `.primitiveGetenv`
  - no missing `.primitiveLoadSymbolFromModule`
  - no `Error: Can't find the requested origin`
- Callback initialization and UUID generation now pass their first startup use:
  - no missing `.primitiveInitilizeCallbacks`
  - no missing `UUIDPlugin.primitiveMakeUUID`
- The full image now advances into later startup/UI/file/ephemeron behavior. Current visible blockers include:
  - `Error: Improper store into indexable object` on a Morphic/Bitmap drawing path
  - a later `File class>>primFileAttribute:number:` error path for some startup preference directories
  - later startup/debugging behavior after primitiveFetchMourner

Updated optional full-image smoke command:

```sh
PHARO14_IMAGE=/path/to/pharo14-metacello.image \
PHARO14_FULL_IMAGE=/path/to/full-pharo14.image \
./verify.sh
```

## New in v014-ffi-ephemerons

Focus shifted from generic FFI shims to the first ephemeron/finalization layer needed by the full Pharo image.

Reference points from the local Pharo VM sources:

- Spur object format `5` is the ephemeron format.
- An ephemeron's first slot is the key guarded by the ephemeron.
- Ephemerons delay tracing their key/value graph until the key is known live independently.
- When an ephemeron fires, the VM queues it as a mourner, converts its format to ordinary non-indexable pointer format, and signals the finalization semaphore.
- Primitive `172` is `primitiveFetchNextMourner`; it pops from the mourner queue or fails with `PrimErrNotFound` when empty.

Implemented in SqueakJS:

- `ObjectSpur>>isEphemeron` equivalent for format `5`.
- Full-GC ephemeron processing:
  - live key: trace the ephemeron's body and do not fire;
  - key reachable only through ephemeron/value graph: fire, preserve key/value for mourning, and queue the ephemeron;
  - fired ephemerons are changed to Spur non-indexable pointer format `1`.
- VM mourner queue on the image object:
  - `queueMourner`
  - `dequeueMourner`
- Primitive `172` now fetches queued mourners instead of warning and returning a fake nil.

New tests:

- `tests/pharo/ephemeron-gc.test.js`
  - format `5` classification;
  - dead-key ephemeron firing through a self-retaining value graph;
  - independently-live-key ephemeron non-firing;
  - primitive `172` queue pop and empty-queue `PrimErrNotFound` behavior.

Full-image smoke progress after v014:

- `missing primitive: 172 (primitiveFetchMourner)` is no longer the visible full-image blocker.
- The full image now advances past initial FFI/environment startup and primitiveFetchMourner into later startup/debugging behavior. A representative diagnostic stack reaches `OCBytecodeToASTCache`, `Dictionary>>noCheckAdd:`, and related source-node/debug-printing paths.

Remaining limitations:

- The current ephemeron implementation is full-GC oriented. Partial/scavenger ephemeron handling is still simplified compared with Pharo's generational scavenger.
- Weak-array finalization remains mostly the pre-existing SqueakJS behavior.
- The full Pharo image is still only a progress probe, not a passing target.

## New in v015-ffi-ephemerons

This pass continues the ephemeron work and moves the implementation from full-GC-only behavior toward SqueakJS's partial-GC/scavenger path.

Reference points from the local Pharo VM `SpurGenerationScavenger` sources:

- Partial GC/scavenge only collects new-space objects.
- Weak arrays and ephemerons in new space, or old-space objects reached through the remembered set, must be deferred until ordinary strong young survivors are known.
- A partial-GC ephemeron key is considered live if it is immediate, old-space, or a young object already marked independently.
- If no pending ephemeron has a live key, the pending ephemerons fire, are queued as mourners, and are then traced so key/value state survives for image-side finalization.

Implemented in SqueakJS:

- Partial GC now defers young ephemerons instead of treating them as ordinary strong pointer objects.
- Dirty old-space remembered ephemerons are collected into the partial-GC ephemeron worklist when they point into young space.
- Partial-GC ephemeron processing reuses the fixed-point algorithm from full GC, but with partial-GC key liveness:
  - immediate keys are live;
  - old-space keys are live;
  - young keys are live only if they have already survived through non-ephemeron reachability or through a previously resolved live-key ephemeron.
- Fired young/remembered ephemerons preserve their key/value fields for mourning, are queued through the existing mourner queue, and request finalization.
- Partial-GC weak-array handling was tightened at the same boundary:
  - old dirty weak arrays no longer keep young weak fields alive merely because the weak array is dirty;
  - dead young weak fields are nilled after survivor assignment;
  - finalization signalling is preserved.
- `finalizeWeakReferences` is now defensive for immediates and missing weak-object lists.

New tests in `tests/pharo/ephemeron-gc.test.js`:

- partial-GC firing for a young ephemeron whose key is reachable only through the ephemeron value graph;
- partial-GC non-firing for a young ephemeron whose key is independently live;
- partial-GC firing for an old remembered ephemeron with a dead young key;
- fixed-point chained ephemerons, where one live-key ephemeron marks another ephemeron's key before firing decisions are made;
- immediate-key and old-key ephemerons during partial GC;
- dirty old weak arrays with dead young weak referents.

Current limitation:

- This is still a simplified SqueakJS model of Pharo's generational scavenger. It now respects the important liveness/firing distinctions for SqueakJS partial GC, but it does not implement Pharo's exact future/past/eden-space forwarding-list machinery.

## New in v016-ffi-ephemerons

This pass keeps the focus on ephemerons and adds image-level probes against the Pharo 14 metacello image.

Reference points checked in the local Pharo image and VM sources:

- `EphemeronLayout` has instance specification `5`, matching Spur ephemeron format.
- A class built with `ShiftClassBuilder` and `layoutClass: EphemeronLayout` creates real format-5 ephemeron instances.
- `FinalizationProcess class>>primitiveFetchMourner` is the image-side primitive-172 entry point.
- Suspending the running finalization process lets the test fetch VM-queued mourners deterministically before the background finalizer consumes them.

New test file:

- `tests/pharo/ephemeron-pharo-probe.test.js`

New Pharo-level probes:

- build a temporary `SqueakJSEphemeronProbe` class using `EphemeronLayout`;
- verify `cls instSpec = 5`, `basicSize = 0`, and two named slots are accessible through normal compiled accessors;
- construct an ephemeron whose key is otherwise unreachable but retained through its value graph;
- suspend the image finalization process, force `Smalltalk garbageCollect`, and verify `FinalizationProcess primitiveFetchMourner` can fetch the fired ephemeron;
- compare the same firing probe with native Pharo when `PHARO_NATIVE_VM` is available.

This adds a useful proof boundary above the JS unit tests: SqueakJS now passes not only synthetic ephemeron object tests, but also a real Smalltalk-level `EphemeronLayout`/`FinalizationProcess` scenario compiled and executed by the Pharo 14 metacello image.

No VM/runtime semantic patch was needed in this pass; v015's full/partial GC implementation already satisfied the image-level probes.

## New in v017-ffi-ephemerons

This pass continues ephemeron/finalization work in two directions: preserving queued mourners across later collections, and proving Pharo's `FinalizationRegistry` path above the raw `EphemeronLayout` probe.

Reference point from the local Pharo VM sources:

- `SpurMemoryManager>>dequeueMourner` pops from the VM `mournQueue` object stack.
- The VM treats `mournQueue` as a root during marking/compaction. A queued mourner must not disappear just because the image has not fetched it yet.
- Pharo's `FinalizationRegistry` stores `FinalizationRegistryEntry` ephemerons; when such an entry fires, `mourn` asks the registry to remove the entry and run the registered finalizer.

Implemented in SqueakJS:

- `Image>>gcRoots` now includes all objects currently in `image.mournQueue`.
- This makes queued ephemeron/weak mourners survive later full GCs and partial GCs until primitive `172` fetches them.
- The queue still keeps VM-like arbitrary/LIFO pop order; Pharo explicitly does not promise mourner order.

New JS-level tests in `tests/pharo/ephemeron-gc.test.js`:

- a fired ephemeron queued as a mourner remains in image space and keeps its key/value alive across a later full GC;
- a young queued mourner and its young fields survive a partial GC through the mourner-queue root;
- the primitive-172 queue pop / empty-queue behavior remains unchanged.

New Pharo-level probes in `tests/pharo/ephemeron-pharo-probe.test.js`:

- `FinalizationRegistry` manual mourning: register an `ObjectFinalizer`, force GC, fetch the fired ephemeron through `FinalizationProcess primitiveFetchMourner`, send `mourn`, and verify the finalizer ran and the registry entry was removed.
- `FinalizationRegistry` automatic finalization: let the running Pharo finalization process wake after `Smalltalk garbageCollect`, yield until it processes the mourner, and verify the finalizer ran without manual primitive fetching.
- Optional native comparison now covers raw ephemeron firing, manual registry mourning, and automatic registry finalization.

The full Pharo image remains only a smoke/progress probe. v017 does not intentionally address the later Morphic/indexable-store blocker.

## New in v018-ffi-ephemerons

This pass pivots from ephemeron internals to the next full-image startup blocker while keeping the ephemeron/FFI test suite as regression coverage.

Visible full-image blocker before this pass:

- Morphic startup reached `Bitmap>>at:put:` through `Color>>bitPatternForDepth:` and failed with `Error: Improper store into indexable object`.
- After that was fixed, startup preference probing reached `File class>>primFileAttribute:number:` for a missing preferences directory and collapsed into `PrimitiveFailed: primitive #signalError:for: in File class failed`.

Root causes found:

- SqueakJS used JavaScript signed 32-bit bitwise operators for quick `bitShift:`, `bitAnd:`, and `bitOr:` paths. In a 64-bit Pharo image, values such as `(255 bitShift: 24) bitOr: (255 bitShift: 16)` must remain positive SmallInteger/word-pattern values like `4294901760`. JavaScript's `|`, `&`, and `<<` were turning these into negative signed-32-bit numbers, which `Bitmap>>at:put:` correctly rejected.
- `Squeak.NonSmallInt` is a 32-bit sentinel. Under the current 64-bit safe-SmallInteger bridge, it is numerically a valid JS SmallInteger unless explicitly rejected. The integer push helpers now reject that sentinel explicitly.
- The minimal `FileAttributesPlugin` had native-like failure for missing stat paths, but SqueakJS does not yet build Pharo's full OS-error `PrimitiveError` object. For startup preference directory probes, the plugin now answers conservative false/zero attributes for missing paths so `isDirectory` answers false instead of escalating to `primitiveFailed`.

Implemented in SqueakJS:

- BigInt-backed quick helpers for high-bit SmallInteger bit operations:
  - `quickBitAnd`
  - `quickBitOr`
  - BigInt-backed `safeShift`
- BigInt-backed primitive bit operations:
  - `doBitAnd`
  - `doBitOr`
  - `doBitXor`
  - `doBitShift`
- JIT generation now calls the same quick bit helpers for `bitAnd:` and `bitOr:`.
- `pop2AndPushIntResult` and `popNandPushIntIfOK` reject the `Squeak.NonSmallInt` sentinel explicitly.
- `FileAttributesPlugin.primitiveFileAttribute` now handles missing paths conservatively for the startup-probe attributes used by Pharo:
  - mode/size-like attributes answer `0`;
  - access and symlink booleans answer `false`;
  - name/creation-style unsupported values answer `nil` where appropriate.

New/expanded tests:

- `tests/pharo/integer-bitops.test.js`
  - checks 64-bit quick SmallInteger high-bit shifts and bit operations;
  - checks primitive BigInt bit-operation paths;
  - with `PHARO14_IMAGE`, verifies the metacello image evaluates `(255 bitShift: 24) bitOr: (255 bitShift: 16)` as `4294901760`.
- `tests/pharo/file-primitives.test.js`
  - now covers conservative missing-path attributes for mode/readability/symlink probes.
- `tests/pharo/process-smoke.test.js`
  - the full Pharo image smoke now asserts that the bitmap improper-store blocker and File class `signalError:for:` primitive failure are gone;
  - with `PHARO14_FULL_IMAGE`, the full image now completes `eval '1+2'` and prints `3`.

Current full-image status:

- The full image now completes the minimal headless eval path under SqueakJS.
- Remaining visible warnings are not yet treated as hard blockers:
  - `missing primitive: 158 (primitiveCompareWith)`
  - `primitive 156 not implemented yet`
  - `stack unbalanced after primitive 113` during quit handling

The full image is still a progress probe rather than a production target, but v018 moves it from “advances into later startup” to “prints the requested eval result”.

## New in v019-ffi-ephemerons

This pass cleans up the remaining visible warnings on the full-image minimal eval path.

Reference points from the local Pharo VM sources:

- `StackInterpreter` maps primitive `156` to `primitiveCompareBytes`, not to an old file primitive in modern Spur images.
- `StackInterpreter` maps primitive `158` to `primitiveStringCompareWith`.
- `InterpreterPrimitives>>primitiveStringCompareWith` answers the raw byte difference at the first mismatch, or the length difference after an equal prefix. With a collation table, the compared bytes are first remapped through the 256-byte order table.
- `StackInterpreter>>primitiveCompareBytes` compares two byte- or word-indexable objects for equality only. It fails for incompatible storage formats.
- `primitiveQuit` can be invoked with an exit-status argument. In the real VM it exits immediately; in SqueakJS it breaks out of the interpreter loop, so the argument must be popped first to satisfy SqueakJS's primitive stack-balance check.

Implemented in SqueakJS:

- primitive `156`, `primitiveCompareBytes`:
  - byte-indexable equality;
  - word-indexable equality;
  - format-family mismatch failure.
- primitive `158`, `primitiveStringCompareWith`:
  - one-argument byte-string compare;
  - two-argument collated compare with a 256-byte order table;
  - empty byte objects without allocated `bytes` storage are treated as zero-length strings.
- primitive `113`, `primitiveQuit`:
  - pops an optional exit-status argument before requesting interpreter break, avoiding the previous stack-balance warning.

New tests:

- `tests/pharo/string-and-compare-primitives.test.js`
  - unit coverage for primitive `158` raw and collated comparison;
  - unit coverage for primitive `156` byte/word equality and incompatible-format failure;
  - unit coverage for primitive `113` stack balancing with an exit-code argument;
  - with `PHARO14_FULL_IMAGE`, verifies that full-image `eval '1+2'` no longer emits the primitive `156`, primitive `158`, or primitive `113` stack-balance warnings.
- `tests/pharo/process-smoke.test.js`
  - the full-image smoke now asserts these three warnings are gone.

Current full-image status:

- The full image still completes `eval '1+2'` and prints `3`.
- The previous visible warnings are gone:
  - `missing primitive: 158 (primitiveCompareWith)`;
  - `primitive 156 not implemented yet`;
  - `stack unbalanced after primitive 113`.
- Remaining non-fatal startup noise currently includes file-size probing messages and the fake `LocalePlugin.primitiveTimezoneOffset` shim.

## New in v020-ffi-ephemerons

This pass removes the remaining non-fatal full-image startup noise seen after v019 on the minimal headless eval path.

Reference points from the local Pharo VM sources:

- `FilePlugin>>primitiveFileSize` obtains an `SQFile *` through `fileValueOf:` and fails the primitive if the object is not a valid VM file record.
- The Unix `sqFileSize` implementation also fails for invalid file records and stdio streams instead of treating arbitrary byte objects as OS file descriptors.
- `LocalePlugin>>primitiveTimezoneOffset` delegates to `sqLocGetTimezoneOffset`.
- The Unix locale implementation answers minutes east of GMT; JavaScript's `Date#getTimezoneOffset` answers minutes west of UTC, so SqueakJS must negate it.

Implemented in SqueakJS:

- Node `FilePlugin` now validates that a file handle has a non-negative integer `fd` before invoking Node `fs` operations for size, at-end, read, write, flush, sync, truncate, and close.
- Foreign Pharo byte handles without SqueakJS `fd` state now fail the FilePlugin primitive quietly, allowing the image-side fallback path to run without `Failed to get file size` noise.
- `LocalePlugin.primitiveTimezoneOffset` is now a real built-in primitive returning minutes east of GMT instead of a fake primitive returning zero.

New/expanded tests:

- `tests/pharo/file-primitives.test.js`
  - checks `primitiveFileSize` on a real SqueakJS/Node file handle;
  - checks that foreign byte handles fail quietly without console noise.
- `tests/pharo/locale-plugin.test.js`
  - checks `primitiveTimezoneOffset` using a non-zero test timezone.
- `tests/pharo/process-smoke.test.js`
  - the full-image smoke now asserts that `Failed to get file size` is gone;
  - the full-image smoke now asserts that `LocalePlugin.primitiveTimezoneOffset` is not using the fake-primitive shim.

Current full-image status:

- The full Pharo image still completes `eval '1+2'` and prints `3`.
- The previously visible file-size and fake-timezone warnings are gone.
- The remaining visible output is ordinary SqueakJS/module/GC progress output, followed by the requested result and `Break: quit`.

## New in v021-ffi-libc-general

This pass broadens the FFI work from startup-specific shims toward a reusable C-library emulation registry.

Implemented in SqueakJS:

- Added `Squeak.FFIEmulation`, a small registry for JavaScript-backed C-library modules.
- The FFI resolver now canonicalizes common C-library names and paths before falling back to the older prefix/suffix probing logic.
- Registered canonical library modules and aliases for:
  - `libc`: `c`, `libc.so`, `libc.so.6`, `libSystem.B.dylib`, `libSystem.dylib`, `msvcrt`, `ucrtbase`, and related DLL aliases;
  - `libm`: `m`, `libm.so`, `libm.so.6`, `libm.dylib`;
  - `libdl`: `dl`, `libdl.so`, `libdl.so.2`.
- Expanded the libc surface with reusable implementations for common string, memory, environment, allocation, errno, process-id, and uid/gid style functions:
  - `getenv`, `setenv`, `unsetenv`;
  - `strlen`, `strnlen`, `strcmp`, `strncmp`;
  - `memcmp`, `memcpy`, `memmove`, `memset`;
  - `malloc`, `calloc`, `realloc`, `free`;
  - `atoi`, `atol`, `atoll`, `abs`, `labs`, `llabs`;
  - `getpid`, `getuid`, `geteuid`, `getgid`, `getegid`;
  - `__errno_location`, `___errno_location`, `__error`.
- Added a first `libm` surface for common math callouts such as `sqrt`, `pow`, `sin`, `cos`, `tan`, `exp`, `log`, `floor`, `ceil`, `fabs`, and related functions.
- Added a conservative `libdl` shell for `dlopen`, `dlsym`, `dlclose`, and `dlerror` so future library-handle emulation has a central place to grow.
- FFI symbol handles and module caches are now per primitive-handler instance instead of prototype-shared state.
- `ffiMakeStExternalAddress(0)` now creates a true null ExternalAddress instead of accidentally allocating a fake non-zero address.
- `void *` arguments can now carry opaque JavaScript pointer data, which is needed for generic library-handle and memory-buffer emulation.
- `primitiveFFIIntegerAt` and `primitiveFFIIntegerAtPut` now support 1-, 2-, 4-, and 8-byte signed/unsigned memory access using byte offsets and BigInt-backed LargeInteger conversion where needed.
- `primitiveFFIDoubleAtPut` now works on `ArrayBuffer` and typed-array-backed storage through a single DataView path.

New/expanded tests:

- `tests/pharo/ffi-emulation.test.js`
  - checks libc/libm alias canonicalization across Linux, macOS, and Windows-style names;
  - checks symbol lookup from aliases such as `libSystem.B.dylib` and `libm.so.6`;
  - checks that an ExternalAddress returned by `primitiveLoadSymbolFromModule` can drive a later handle-based FFI callout;
  - checks generic callout to libc `strlen`, `strncmp`, `memcpy`, and `memset`;
  - checks generic callout to libm `sqrt`;
  - checks 1-, 2-, 4-, and 8-byte FFI integer memory reads/writes, including unsigned 32-bit and 64-bit values.
- `tests/pharo/support/fake-primitives.js`
  - now creates pointer-style fake objects for ExternalData and ExternalFunction so FFI callout tests can exercise the normal object layouts.

Current full-image status:

- The full Pharo image still completes `eval '1+2'` and prints `3`.
- The minimal full-image eval path remains warning-clean for the previously fixed primitive 156/158, quit stack balance, file-size probing, and fake-timezone issues.
- This pass does not yet make the full image depend on the new libc/libm callouts; it prepares the general FFI surface for broader full-image experiments that will start touching more native-library symbols.

## New in v022-tffi-libc

This pass connects the reusable FFI emulation registry from v021 to Pharo 14's ThreadedFFI path, so ordinary Pharo-side `LibC` callouts can reach JavaScript-backed C-library functions instead of stopping at `NullFFIBackend`.

Implemented in SqueakJS:

- `TFFIBackend` is now selectable in the full Pharo image because the empty-module `primitiveLoadSymbolFromModule` probe can resolve the marker symbol used by `TFFIBackend class>>isAvailable`.
- Added first ThreadedFFI VM primitives:
  - `primitiveFillBasicType`;
  - `primitiveTypeByteSize`;
  - `primitiveGetSameThreadRunnerAddress`;
  - `primitiveGetAddressOfOOP`;
  - `primitiveDefineFunction`;
  - `primitiveFreeDefinition`;
  - `primitiveSameThreadCallout`.
- `primitiveSameThreadCallout` now dispatches `TFExternalFunction`-shaped objects through the same canonical library resolver used by the older FFI callout layer.
- Added object-address bookkeeping for `PointerUtils oopForObject:` style pinned-object access, allowing ByteArray-backed Pharo objects to be passed to C memory functions.
- Added libc `system`, implemented through Node's `child_process.execSync` in headless Node mode, returning the process status code.
- Added primitive 646, `ExternalAddress>>uint8AtOffset:put:`, so C-string marshalling into allocated ExternalAddress memory no longer falls back with `primitive 646 not implemented yet`.
- Fixed `primitiveFFIFree` stack balance for the ThreadedFFI cleanup path.
- Registered quiet stub modules for native-library probes that the full image performs during startup:
  - `libfreetype.so.6`;
  - `/lib/x86_64-linux-gnu/libSDL2-2.0.so.0` and related SDL2 aliases.

New/expanded tests:

- `tests/pharo/ffi-emulation.test.js`
  - checks FreeType and SDL2 alias resolution to quiet stub modules;
  - checks ThreadedFFI basic-type handle/byte-size filling;
  - checks same-thread callout through `TFExternalFunction`-shaped fake objects;
  - checks function-definition metadata handles;
  - checks OOP-address mapping back to pinned object bytes;
  - checks primitive 646 writes a byte into FFI allocated memory.
- `tests/pharo/process-smoke.test.js`
  - the full-image smoke now asserts that FreeType and SDL2 native-load noise is gone;
  - adds a full-image ThreadedFFI probe that checks `TFFIBackend` selection and executes `LibC getpid`, `LibC memCopy:to:size:`, and `LibC system:`.

Current full-image status:

- The full Pharo image still completes `eval '1+2'` and prints `3`.
- `FFIBackend current class name` now answers `#TFFIBackend` in the full image.
- A richer full-image probe now answers `#(true #TFFIBackend true #[65 66 67 0] 0)` for availability, backend selection, `getpid > 0`, `memCopy`, and `system: 'true'`.
- The previously visible FreeType/SDL plugin-load noise, primitive 646 warning, and ThreadedFFI primitive-missing warnings are gone on the tested full-image paths.

## New in v023-tffi-sdl2

This pass shifts the FFI work from generic libc proof probes toward browser-relevant OSWindow/SDL2 behavior.

Clarification of the previous v022 FFI result:

- The v022 `LibC uniqueInstance getpid`, `LibC memCopy:to:size:`, and `LibC system:` calls were deliberately forced Pharo-side probes. They proved that Pharo 14 selected `TFFIBackend` and that same-thread callouts reached JavaScript, but they were not evidence that those exact libc calls occurred naturally during normal full-image startup.
- v023 adds an opt-in FFI trace (`SQUEAKJS_TRACE_FFI=1`) and uses it to observe the OSWindow path directly.

Observed OSWindow/SDL2 FFI calls from the full image while creating a minimal 320x200 OSWindow include:

```text
FFI lookup: libSDL2-2.0::SDL_Init()
FFI lookup: libSDL2-2.0::SDL_SetHint()
FFI same-thread: libSDL2-2.0::SDL_SetHint(...)
FFI same-thread: libSDL2-2.0::SDL_Init(1048576)
FFI same-thread: libSDL2-2.0::SDL_InitSubSystem(29233)
FFI same-thread: libSDL2-2.0::SDL_CreateWindow(..., 320, 200, 8228)
FFI same-thread: libSDL2-2.0::SDL_SetWindowTitle(SDL:window#1, ...)
FFI same-thread: libSDL2-2.0::SDL_GetWindowDisplayIndex(SDL:window#1)
FFI same-thread: libSDL2-2.0::SDL_GetDisplayDPI(...)
FFI same-thread: libSDL2-2.0::SDL_GetWindowID(SDL:window#1)
FFI same-thread: libSDL2-2.0::SDL_GetWindowSize(SDL:window#1, ...)
```

The minimal OSWindow probe now answers:

```smalltalk
| attrs w |
attrs := OSWindowAttributes new title: 'SqueakJS'; extent: 320@200; yourself.
w := OSWindow createWithAttributes: attrs.
{ w isValid . w backendWindow windowId . w backendWindow extent }
```

with:

```text
{true. 1. (320@200)}
Break: quit
```

Implemented in v023:

- First stateful SDL2 emulation module instead of a quiet symbol-only stub.
- SDL2 initialization, hints, window creation/state, DPI fallback, event-poll no-event behavior, clipboard, mouse/modifier probes, basic renderer/texture/surface/cursor/OpenGL-shell calls.
- Opaque JS-backed SDL handles (`window`, `renderer`, `texture`, `surface`, `cursor`, `glcontext`) returned through the existing ExternalAddress path.
- FFI tracing for symbol lookup and callout dispatch via `SQUEAKJS_TRACE_FFI=1`.
- Direct ExternalAddress primitive coverage for integer, pointer, boolean, and float offset access used by ThreadedFFI and SDL structure probing:
  - read primitives: 630-639, 643, 644
  - write primitives: 645-654, 658, 659
  - primitive 646 remains the `uint8AtOffset:put:` path and now delegates to the generic ExternalAddress integer writer.

Not yet implemented:

- ExternalAddress character primitive object marshalling for 640-642 and 655-657.
- Browser canvas/event integration. Current SDL2 emulation is a headless/stateful model; the browser target still needs to map emulated SDL windows/renderers/surfaces/textures and `SDL_PollEvent` to SqueakJS browser display/input.
- SDL callbacks and real OpenGL/FreeType surfaces.

### tinyBenchmarks comparison

Native Pharo 14 full image on the local x86_64 VM averaged approximately:

```text
3,460,855,950 bytecodes/sec
  272,771,020 sends/sec
```

The same full image under SqueakJS/Node averaged approximately:

```text
  418,065,942 bytecodes/sec
    2,421,202 sends/sec
```

So on this host, `0 tinyBenchmarks` reports SqueakJS as roughly:

```text
  8.3x slower for bytecodes/sec
112.7x slower for sends/sec
```

This is a headless Node measurement and does not include browser rendering/event overhead. The send benchmark is the more alarming number for interactive Pharo-in-browser work.

New tests:

- `tests/pharo/ffi-emulation.test.js` now covers direct float ExternalAddress primitives and stateful SDL2 window/DPI-size callouts.
- `tests/pharo/oswindow-sdl2-smoke.test.js` is an opt-in full-image smoke test. It is skipped by default because it is slower and should be run deliberately with:

```sh
PHARO14_OSWINDOW_SMOKE=1 \
PHARO14_FULL_IMAGE=/path/to/pharo14-full.image \
node tools/run-pharo-tests.js tests/pharo/oswindow-sdl2-smoke.test.js
```

## v027 browser FileAttributesPlugin startup fix

The second browser `PharoDebug.log` showed that the Unix-platform emulation from v026 worked, but startup then failed in `File class>>primFileMasks`:

```text
PrimitiveFailed: primitive #signalError:for: in File class failed
File class>>primFileMasks
```

Root cause: `plugins/FileAttributesPlugin.js` existed and was loaded by the Node test harness, but `squeak.js` did not import it for browser module startup.  The browser run therefore reached Pharo's `File class>>reset`, attempted `FileAttributesPlugin.primitiveFileMasks`, and fell through to `File class>>signalError:for:`.

v027 imports `FileAttributesPlugin` from `squeak.js` and extends the plugin with a browser fallback.  When Node's `fs` module is unavailable, the plugin now derives conservative Unix-like attributes from SqueakJS's browser virtual filesystem (`Squeak.dirList`, `Squeak.splitFilePath`, and directory entries).  This covers `primitiveFileMasks`, `primitiveFileExists`, `primitiveFileAttribute`, `primitiveFileAttributes`, and directory-stream startup probes well enough to get past `File class>>reset` in the browser path.

## v028 browser Unix environment-origin fix

The third browser `PharoDebug.log` showed that v027 reached past both Unix platform selection and `FileAttributesPlugin.primitiveFileMasks`, then failed while resolving `FileLocator preferences`:

```text
Error: Can't find the requested origin
UnixResolver>>home
UnixResolver>>preferences
GlobalIdentifierStonPersistence>>defaultPreferences
```

Root cause: the browser VM was now presenting itself as Unix, but `primitiveGetenv` and libc `getenv` only looked at Node `process.env`.  In the browser, variables such as `HOME` and `XDG_CONFIG_HOME` were absent, so Pharo's Unix resolver could not derive the `#preferences` origin and aborted in the non-interactive startup path.

v028 adds a shared SqueakJS environment fallback for browser runs:

- `HOME=/home/squeak`
- `XDG_CONFIG_HOME=/home/squeak/.config`
- `XDG_CACHE_HOME=/home/squeak/.cache`
- `XDG_DATA_HOME=/home/squeak/.local/share`
- `TMPDIR=/tmp`
- plus conservative `USER`, `LOGNAME`, `SHELL`, `PWD`, `LANG`, and `LC_ALL` values.

Both empty-module `primitiveGetenv` and JS-emulated libc `getenv` now use this shared lookup path.  Browser startup also pre-creates the advertised virtual filesystem directories so that Pharo's Unix `FileLocator` origins can resolve without an interactive resolver prompt.

## v029 sandbox browser-startup regression

Added `tools/pharo14-browser-sandbox-smoke.js` and
`tests/pharo/browser-sandbox.test.js` so browser-only startup issues are not
only checked by manual Chrome logs.  The smoke runs the full Pharo image under
Node with host `HOME`/`XDG_*` variables removed and verifies that Pharo resolves
`HOME`, `XDG_CONFIG_HOME`, and `FileLocator preferences` from SqueakJS's
browser fallback environment.

The direct command is:

```sh
node tools/pharo14-browser-sandbox-smoke.js /path/to/Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image
```

Expected Smalltalk result:

```smalltalk
#('unix' '/home/squeak' '/home/squeak/.config' '/home/squeak/.config')
```

## v030 browser UUIDPlugin startup fix

The next browser `PharoDebug.log` reached past Unix platform selection,
`FileAttributesPlugin`, and Unix environment-origin resolution, then failed in
startup UUID generation:

```text
Error: Cannot generate UUID. It requires at least version 10.3.9 of the Pharo vm.
ByteArray>>generateUUIDInPlace
UUID class>>new
GlobalIdentifier>>computerUUID
```

Root cause: `plugins/UUIDPlugin.js` existed and was loaded by the Node harness,
but `squeak.js` did not import it for browser module startup.  Pharo therefore
entered the Smalltalk fallback body of `ByteArray>>generateUUIDInPlace`, whose
Pharo 14 fallback deliberately errors when the VM-side UUID primitive is absent.

v030 imports `UUIDPlugin` in `squeak.js` so the browser has
`UUIDPlugin.primitiveMakeUUID` registered before Pharo startup asks for a
computer UUID.  The plugin now also prefers browser `crypto.getRandomValues`
when available, before falling back to Node `crypto.randomFillSync` or
`Math.random`.

The browser sandbox smoke now includes UUID generation in addition to Unix
preferences resolution.  Expected result:

```smalltalk
#('unix' '/home/squeak' '/home/squeak/.config' '/home/squeak/.config' 36)
```

### v031 browser sandbox hardening

The v030 harness still did not exercise the browser FilePlugin path-translation surface.  It could therefore miss failures where Pharo sees the historical `/SqueakJS` fake root while SqueakJS stores files under the virtual filesystem root.

v031 adds `tools/browser-module-smoke.js`, which loads the browser-side module graph under a Node DOM/browser shim and verifies the same early-startup assumptions that previously only failed in Chrome:

- browser `FileAttributesPlugin` and `UUIDPlugin` are actually registered;
- the browser virtual filesystem treats `mkdir('/')` as an idempotent success;
- `FilePlugin primitiveDirectoryCreate` succeeds for the fake `/SqueakJS` root alias;
- `FileAttributesPlugin` resolves `/SqueakJS` through the same `filenameFromSqueak` translation as `FilePlugin`;
- browser `primitiveGetenv` still answers the Unix fallback environment when `process` is absent.

This is now run by `verify.sh` and by `tests/pharo/browser-sandbox.test.js`.

### v032 browser stdio descriptor startup fix

The next browser startup log reached Pharo's command-line/stdout setup and failed in:

```text
PrimitiveFailed: primitive #fileDescriptorType: in File class failed
Stdio class>>standardIOStreamNamed:forWrite:
ClapContext>>stdout
```

Root cause: `primitiveFileDescriptorType` and `primitiveConnectToFileDescriptor` had been added to the Node FilePlugin path, but not to the browser FilePlugin path.  The browser module graph therefore still lacked the primitives that Pharo uses to decide whether stdout/stderr are available before printing Clap help or diagnostics.

v032 implements these primitives in `vm.plugins.file.browser.js`:

- fd `1` and `2` are reported as pipe-like streams and connect to `console.log` and `console.error` handles;
- fd `0` is reported as unavailable for now because browser input is asynchronous while the FilePlugin read primitive is synchronous.

`tools/browser-module-smoke.js` now checks the browser FilePlugin descriptor primitives directly, so this class of browser-only stdio startup failure is caught before asking for a manual Chrome run.

## v033 browser run-page quit preservation

v033 adds a run-page option for browser debugging:

```text
keepHashOnQuit=true
```

When this option is present, `run/index.html` no longer clears `location.hash` in its `onQuit` handler.  `traceFFI=true` also enables the same preservation automatically, because it is already a debugging mode.  This is intended for cases where the image stops without writing `PharoDebug.log`; preserving the page keeps the JavaScript console and FFI trace visible.

Regression command:

```sh
node tools/browser-run-index-smoke.js
```

This executes the inline `run/index.html` script under a browser-like Node VM context and verifies that `traceFFI=true` and `keepHashOnQuit=true` preserve the hash, while the default historical behavior still clears it.


### v034 browser interactive command-line default

The browser run reached filesystem persistence and stdio setup, then stopped after printing Pharo command-line options.  No `PharoDebug.log` was produced, which indicates a command-line-mode exit rather than a Smalltalk exception path.

v034 adds a browser Unix/Pharo command-line default: when no explicit image arguments are supplied, SqueakJS passes `--interactive` as the first image-side argument.  The browser argument vector is now generated as:

```text
/vm.js /pharo14/<image>.image --interactive
```

Explicit `argv`, `imageArgs`, `pharoArgs`, `args`, or `arguments` URL parameters can still be used for deliberate non-interactive command execution.  `tools/browser-module-smoke.js` now checks the default `--interactive` vector and the explicit-argument override behavior.

### v035 browser command-line attribute fix

v034 built the intended browser argument vector:

```text
/vm.js /pharo14/<image>.image --interactive
```

but `primitiveGetAttribute` still had an old fallback for attribute `2`: when an argv array existed but had no first image-side argument, it returned `display.documentName`, which is the image path.  That made Pharo's command-line dispatcher see `/pharo14/<image>.image` as a command-line argument and print:

```text
Error: Unrecognized arguments: /pharo14/<image>.image
```

v035 tightens `primitiveGetAttribute`: if an explicit argv array exists, attributes `0`, `1`, and `2` are read only from that array.  Missing argv entries now fail the primitive instead of falling back to `documentName`.  The document-name fallback remains only for legacy displays without an explicit argv array.

`Squeak.defaultArgvForImage` also now defaults browser Pharo runs to `--interactive` whenever the browser VM is presenting a Unix platform, not only when the URL explicitly contains `unix`.

Regression coverage:

- `tests/pharo/vm-attributes-and-parameters.test.js` now checks that a missing first image-side argument does not become the image path.
- `tools/browser-module-smoke.js` checks that browser attribute `2` is `--interactive`, not `/pharo14/<image>.image`.

## v036 browser interactive FFI builder selection

The browser interactive startup reached Morphic activation and then failed in the SDL2 initialization path with:

- `FFICalloutMethodBuilder had the subclass responsibility to implement #createFFICalloutLiteralFromSpec:`
- `SDL2 class>>setHint:value:`

This showed that the interactive startup path could use the older UFFI method-builder API while `FFICalloutAPI` still had a stale or abstract `CalloutAPIClass`.  The VM now repairs this at image startup by setting `FFICalloutAPI`'s `CalloutAPIClass` class variable to `TFCalloutAPI` and resetting `FFIBackend Current` to nil, so Pharo recomputes the backend through the ThreadedFFI implementation.

Regression coverage added in this pass:

- `tools/browser-module-smoke.js` now exercises the VM-side class-variable repair logic on browser-shaped objects.
- `tools/pharo14-browser-sandbox-smoke.js` now checks that a full Pharo image reports both `#TFCalloutAPI` and `#TFFIBackend` in the browser-oriented startup probe.
- `tests/pharo/browser-sandbox.test.js` rejects the previous `FFICalloutMethodBuilder` subclass-responsibility failure.
- `tests/pharo/ffi-emulation.test.js` covers `ExternalAddress pointerAtOffset:put:` with opaque JavaScript-backed FFI pointers, preventing JS exceptions when SDL2/OSWindow stores opaque handles through pointer slots.


## v037 browser Unix SDL2 library discovery

Observed browser startup advanced into Morphic/OSWindow activation and failed in
Smalltalk-side UFFI library discovery before JS FFI symbol dispatch:

```text
Cannot locate any of #('libSDL2-2.0.so.0.2.1' 'libSDL2-2.0.so.0'). Please check if it installed on your system
FFIUnix64LibraryFinder>>findAnyLibrary:
SDL2Library>>unix64LibraryName
TFCalloutMethodBuilder>>createFFICalloutLiteralFromSpec:
SDL2 class>>setHint:value:
```

This was not a missing `SDL_SetHint` implementation.  The SDL2 emulation registry
already canonicalizes `/lib/x86_64-linux-gnu/libSDL2-2.0.so.0` and related
aliases.  The failure happened earlier: Pharo's Unix64 library finder refused to
build the callout literal because no browser filesystem entry looked like a Unix
shared library.

v037 adds zero-byte browser VFS placeholders for conventional Linux shared
libraries, including:

- `/lib/x86_64-linux-gnu/libSDL2-2.0.so.0`
- `/lib/x86_64-linux-gnu/libSDL2-2.0.so.0.2.1`
- `/usr/lib/x86_64-linux-gnu/libSDL2-2.0.so.0`
- `/usr/lib/x86_64-linux-gnu/libSDL2-2.0.so.0.2.1`
- related libc/libm/libdl/freetype placeholders

The placeholders are only discovery entries.  Actual callout behavior remains in
`Squeak.FFIEmulation`; the fake files simply let `FFIUnix64LibraryFinder` produce
a library name that ThreadedFFI can pass to SqueakJS.

Regression coverage:

- `tools/browser-module-smoke.js` now installs the virtual Unix libraries and
  verifies that browser `FileAttributesPlugin` and browser `FilePlugin` both see
  `/lib/x86_64-linux-gnu/libSDL2-2.0.so.0` as an existing regular file.
- `tests/pharo/browser-sandbox.test.js` checks that `squeak.js` installs the
  virtual shared-library placeholders during browser startup.

Expected browser result: the `Cannot locate any of #('libSDL2-2.0.so.0.2.1' ... )`
error should disappear, and startup should advance to the first real SDL2 symbol,
struct, renderer, or event-loop semantic gap.

## v038 browser ThreadedFFI allocation / SurfacePlugin pass

This pass tightens the browser harness around the exact class of failures that previously only appeared in a manual Chrome run.

Fixed runtime issues:

- Browser/interactive startup can now catch `ExternalAddress class>>allocate:` regressions before manual testing.  `FFICalloutAPI CalloutAPIClass` is still forced to `TFCalloutAPI`, but `FFIBackend Current` is now pinned to a concrete `TFFIBackend` instance instead of being merely reset to `nil`.  This prevents SDL2 string marshalling from routing allocation through stale `NullFFIBackend` state.
- Added browser loading for a minimal `SurfacePlugin`.
- Implemented enough manual-surface support for Pharo's `OSSDL2ExternalForm` startup path:
  - `primitiveCreateManualSurface`
  - `primitiveSetManualSurfacePointer`
  - `primitiveDestroyManualSurface`
  - `ioGetSurfaceFormat`
  - `ioLockSurface`
  - `ioUnlockSurface`
- Fixed `primitiveExternalAddressPointerAtOffsetPut` and boolean pointer put to use the real interpreter stack API rather than a test-only `vm.stack` array.
- Added a map from fake external-address handles to JavaScript buffers allocated by `primitiveFFIAllocate`.
- Added byte-array memory accessor primitives used during interactive SDL2/Morphic startup:
  - load: `600-609`, `613`, `614`
  - store: `615-624`, `628`, `629`

Harness improvements:

- `tools/pharo14-browser-sandbox-smoke.js` now evaluates `ExternalAddress fromString:` and `SDL2 setHint:value:` in the full image, so `NullFFIBackend>>allocate:` failures are detected locally.
- Added `tools/pharo14-browser-interactive-smoke.js`, which starts the full image with `--interactive` under browser-sandbox assumptions and fails on known browser startup regressions:
  - stale `NullFFIBackend`
  - SDL2 library discovery failure
  - abstract `FFICalloutMethodBuilder`
  - failed `OSSDL2ExternalForm` manual-surface primitive
  - host-side SqueakJS exceptions
- `tools/browser-module-smoke.js` now verifies `SurfacePlugin` registration and its create/set-pointer/destroy primitive surface.

Observed sandbox result after this pass:

```text
Loaded module: SurfacePlugin
Loaded module: UUIDPlugin
browser-interactive-smoke: ok
```

The interactive sandbox no longer reports the previous `NullFFIBackend>>allocate:` failure or the manual-surface primitive failure.

## v039 stale NullFFIBackend fallback hardening

The v038 browser fix was insufficient.  The manual browser run could still fail during SDL2 startup with:

```text
primitive #allocate: in NullFFIBackend failed
NullFFIBackend>>allocate:
ExternalAddress class>>fromString:
TFStringType>>allocateString:
SDL2 class>>setHint:value:
```

The earlier v038 sandbox smoke was too weak because it queried `FFIBackend current` before forcing the problematic path.  That warmed the Smalltalk-side cache and hid the stale-`NullFFIBackend` startup case.

v039 strengthens both the runtime repair and the harness:

- `FFIBackend Current` is still pinned to a concrete `TFFIBackend` instance.
- In addition, the VM startup repair patches stale `NullFFIBackend` fallback methods to execute the corresponding `TFFIBackend` primitive methods:
  - `allocate:`
  - `free:`
  - `loadSymbol:module:` via `TFFIBackend>>primLoadSymbol:module:`
  - integer and float accessors used by ThreadedFFI memory access
  - callback lookup fallback
- The sandbox probe now deliberately sets `FFIBackend Current` back to `NullFFIBackend new` before evaluating `ExternalAddress fromString:` and `SDL2 setHint:value:`.  That reproduces the browser failure locally and verifies that even a stale Null backend no longer fails allocation or symbol lookup.
- `tools/browser-module-smoke.js` now checks that the VM startup repair can patch `NullFFIBackend>>allocate:`, `NullFFIBackend>>free:`, and `NullFFIBackend>>loadSymbol:module:` in the image-method table.

The key local regression command is:

```sh
node tools/pharo14-browser-sandbox-smoke.js /path/to/Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image
```

Expected probe shape includes the deliberately forced stale backend object and successful SDL hint call:

```text
... #TFCalloutAPI #TFFIBackend a NullFFIBackend true 1 ...
```

The specific browser failure patterns now checked locally include:

```text
primitive #allocate: in NullFFIBackend failed
Null FFI Backend
NullFFIBackend did not understand #primLoadSymbol:module:
```

## v040 browser libc symbol-registry hardening

The next browser run reached SDL2 string marshalling and then failed while resolving `memcpy`:

```text
Could not find symbol named: #memcpy searching in module: 'libc.so.6'
NullFFIBackend(TFFIBackend)>>primLoadSymbol:module:
ExternalAddress class>>loadSymbol:module:
LibC>>memCopy:to:size:
ExternalAddress class>>fromString:
TFStringType>>allocateString:
SDL2 class>>setHint:value:
```

This was a browser-module-order issue rather than a missing implementation of `memcpy` in the main FFI emulation layer.  The browser loader imported the legacy demo `ffi/libc.js` after `vm.plugins.ffi.js`.  That legacy module re-registered `libc` and overwrote the richer Pharo 14 libc emulation, removing symbols such as `memcpy` while leaving the resolver to canonicalize `libc.so.6` to `libc`.

v040 changes `ffi/libc.js` so it does not clobber an already-installed rich libc module.  It still registers the legacy demo libc when no richer module exists.

Harness improvement:

- `tools/browser-module-smoke.js` now imports the browser graph including `ffi/libc.js` and asserts that `Squeak.externalModules.libc.memcpy` is still present.
- The same smoke now performs an actual `primitiveLoadSymbolFromModule` lookup for `memcpy` in `libc.so.6`, which catches the exact symbol-resolution failure before a manual browser run.

The browser graph smoke command is:

```sh
node tools/browser-module-smoke.js
```

The expected result is:

```text
browser-module-smoke: ok
```

## v041 browser SDL2 rendering path

After v040 the browser image can start without the earlier SDL2/libc symbol failures, but the rendering path still needed pixel-level validation.  The first concrete rendering issue was format conversion: Pharo's `OSSDL2FormRenderer` creates streaming textures with `SDL_PIXELFORMAT_XRGB8888`, while the browser canvas requires RGBA byte order in `ImageData`.

v041 normalizes SDL 8888 texture uploads into Canvas RGBA during `SDL_UpdateTexture`.  This covers the packed formats used by Pharo's SDL renderers, including `XRGB8888`, `ARGB8888`, `RGBX8888`, `RGBA8888`, `XBGR8888`, `ABGR8888`, `BGRX8888`, and `BGRA8888`.  Unknown formats keep the previous raw-RGBA behavior for debugging.

Rendering behavior also improved in `SDL_RenderCopy`: destination rectangles are now honored when painting to the browser canvas instead of always using the source rectangle/origin.  This matters for Pharo's partial-damage update path where `OSSDL2FormRenderer>>copyAndPresentTextureRectangle:` passes both source and destination SDL rectangles.

Harness improvement:

- `tests/pharo/ffi-emulation.test.js` now asserts that an XRGB8888 little-endian red pixel (`0x00FF0000`, bytes `00 00 FF 00`) becomes Canvas RGBA `FF 00 00 FF`.
- `tools/browser-module-smoke.js` now creates a browser-shaped canvas context, runs `SDL_CreateWindow`, `SDL_CreateRenderer`, `SDL_CreateTexture`, `SDL_UpdateTexture`, and `SDL_RenderCopy`, then inspects the mock `putImageData` call to verify that a red RGBA pixel is painted at the requested destination rectangle.

The local browser rendering smoke is part of:

```sh
node tools/browser-module-smoke.js
```

and the broader verification:

```sh
./verify.sh
```

## v042 SDL_LockTexture manual-surface rendering path

After v041, basic `SDL_UpdateTexture` uploads converted packed SDL 8888 texture data into Canvas RGBA correctly, but the Pharo 14 Morphic damage path can avoid `SDL_UpdateTexture` entirely.  `OSSDL2FormRenderer>>updateRectangle:` locks the streaming texture with `SDL_LockTexture`, builds an `OSSDL2ExternalForm` on the returned `void** pixels` pointer, and lets `SurfacePlugin`/BitBlt write the damaged rectangle directly into that memory before `SDL_UnlockTexture` and `SDL_RenderCopy`.

The previous browser bridge did not write a stable external pointer handle through the `void** pixels` argument.  In the same-thread FFI path that argument can arrive as a raw pointer-sized `ArrayBuffer`, so assigning a JavaScript property was not enough for Pharo's `ExternalAddress` and `SurfacePlugin` manual-surface machinery.  The observed full-image symptom was a suppressed BitBlt failure during `updateRectangle:`:

```text
There was an error during copy, we should not throw an exception here:Error: Bad BitBlt arg (Fraction?); proceed to convert.
```

v042 makes `SDL_LockTexture` allocate a raw SDL-format lock buffer, registers it in the active primitive's `ffiAddressDataMap`, writes the non-zero fake pointer handle through `void** pixels`, and writes the pitch through `int* pitch`.  `SDL_UnlockTexture` then converts the modified SDL-format lock buffer back into the internal Canvas RGBA texture buffer and unregisters the temporary pointer mapping.

Harness improvement:

- `tests/pharo/ffi-emulation.test.js` now verifies that `SDL_LockTexture` writes a non-zero pointer handle, that the handle maps to writable JS pixel memory, that an XRGB8888 red pixel written through the lock buffer becomes internal Canvas RGBA red after `SDL_UnlockTexture`, and that the temporary mapping is released.
- `tools/browser-module-smoke.js` performs the same lock/unlock pointer-map check through the browser module graph.
- A full-image focused probe now runs `OSWindow createWithAttributes:`, `newFormRenderer:`, and `updateRectangle:` without the previous suppressed BitBlt copy error, then proceeds through `SDL_UnlockTexture`, `SDL_RenderCopy`, and `SDL_RenderPresent`.

Focused full-image probe:

```sh
SQUEAKJS_TRACE_FFI=1 /usr/bin/timeout 60 node squeak_node.js pharo14-full.image eval \
  "| attrs w f r | attrs := OSWindowAttributes new title: 'SqueakJS'; extent: 8@8; yourself. w := OSWindow createWithAttributes: attrs. f := Form extent: 8@8 depth: 32. f fillColor: Color red. r := w newFormRenderer: f. r updateRectangle: (0@0 corner: 8@8). { r class name . r form extent }"
```

Expected result includes:

```text
{#OSSDL2FormRenderer. (8@8)}
```

and should not include the previous `Bad BitBlt arg` copy failure.

## v043 SurfacePlugin manual-surface word-view fix

v042 made `SDL_LockTexture` return a stable fake external pointer handle and connected that handle to JavaScript pixel memory through `ffiAddressDataMap`.  That was enough for Pharo's manual-surface machinery to stop failing with `Bad BitBlt arg`, but it was not enough to prove that BitBlt really changed the locked texture pixels.

The missing detail was the type returned by `SurfacePlugin>>ioLockSurface`.  `BitBltPlugin` expects the locked surface storage to be word-addressable and writes 32-bit pixels with `destBits[destIndex >>> 2]`.  Returning a raw `ArrayBuffer` satisfies neither typed indexing nor byte mutation: assigning `arrayBuffer[0] = 0x00FF0000` only creates an object property and leaves the backing bytes unchanged.  The resulting full-image behavior can therefore be: no exception, successful `SDL_UnlockTexture`, successful `SDL_RenderPresent`, but still a blank/unchanged texture.

v043 fixes `SurfacePlugin>>ioLockSurface` so mapped FFI pointer data is converted to a `Uint32Array` word view before being handed to BitBlt.  `ArrayBuffer`, aligned typed arrays, and existing word storage are handled conservatively.  The lock callback still reports the byte pitch, while the returned value supports BitBlt's word-indexed writes.

Harness improvement:

- `tests/pharo/ffi-emulation.test.js` now drives the rendering path through `SDL_LockTexture`, `SurfacePlugin primitiveCreateManualSurface`, `primitiveSetManualSurfacePointer`, `ioLockSurface`, a BitBlt-shaped 32-bit word write, `SDL_UnlockTexture`, and `SDL_RenderCopy`.  It asserts that the locked surface is a `Uint32Array` and that writing `0x00FF0000` becomes Canvas RGBA red.
- `tools/browser-module-smoke.js` now performs the same browser-module-level manual-surface pointer check and verifies that a `Uint32Array` word write mutates the `ArrayBuffer` backing the fake FFI pointer.
- `SDL_RenderPresent` now records present diagnostics and yields to the browser display loop when possible; `SDL_RenderCopy` records the last copy rectangle for browser debugging.
- Basic SDL renderer draw primitives are implemented for paths that may draw directly through the renderer instead of using only texture copies.

Focused checks:

```sh
node tools/browser-module-smoke.js
node tools/run-pharo-tests.js tests/pharo/ffi-emulation.test.js
PHARO14_FULL_IMAGE=/path/to/Pharo14.image PHARO14_OSWINDOW_SMOKE=1 node tools/run-pharo-tests.js tests/pharo/oswindow-sdl2-smoke.test.js
```

## v044 SDL native cursor bridge

v043 proved that Pharo's SDL2 Form renderer can put pixels on the browser canvas.  The next visible gap was cursor rendering.  The legacy SqueakJS browser input layer hides the browser cursor because old images render a software cursor through `primitiveBeCursor` and a separate cursor canvas.  Pharo's OSWindow/SDL2 path expects SDL native cursor calls to control the pointer instead, so the browser canvas stayed at CSS `cursor: none`.

v044 implements enough SDL cursor behavior for the browser path:

- `SDL_CreateWindow` applies the current SDL cursor state to the bound browser canvas.
- `SDL_CreateSystemCursor` maps SDL system cursor ids to CSS cursor names.
- `SDL_SetCursor`, `SDL_GetCursor`, `SDL_GetDefaultCursor`, and `SDL_ShowCursor` maintain and expose SDL cursor state.
- `SDL_CreateCursor` converts SDL monochrome data/mask cursor bits into a CSS SVG data-URL cursor while preserving hot-spot coordinates.
- `SDL_CreateColorCursor` converts a 32-bit SDL surface cursor into a CSS SVG data-URL cursor.
- The SDL path hides the old SqueakJS software cursor canvas overlay, because Pharo SDL rendering now uses browser-native cursor styling rather than `primitiveBeCursor`.

Regression coverage:

- `tests/pharo/ffi-emulation.test.js` checks that SDL window binding restores CSS `default`, system hand cursor maps to CSS `pointer`, `SDL_ShowCursor` toggles CSS `none`, and custom monochrome cursor data becomes a CSS data URL with the expected hot spot.
- `tools/browser-module-smoke.js` checks the same visible canvas cursor state through the browser module graph.

## v045 browser-managed SDL window sizing

v044 fixed the visible cursor, but the browser canvas could still start with a mismatched backing-store size.  The visible symptom was: the canvas initially stretched Pharo's requested SDL window size over the browser area, then after a browser resize the aspect ratio corrected but Pharo rendered into only part of the available canvas.

The cause was `SDL_CreateWindow`/`bindWindowToDisplay` forcing the canvas backing-store size to the requested SDL extent.  That behavior is acceptable for small local harnesses, but wrong for the browser-hosted Pharo environment where `createSqueakDisplay` already owns the canvas CSS layout and backing-store size.  With Pharo's SDL2 path active, SDL must treat the existing SqueakJS browser backing-store size as the real SDL window size and notify Pharo when that size changes.

v045 changes the SDL2 browser bridge as follows:

- Detects browser-managed displays through `display.width`/`display.height` from `createSqueakDisplay`.
- Binds SDL windows to the existing browser canvas backing-store size instead of shrinking the canvas to Pharo's requested `SDL_CreateWindow` extent.
- Preserves `canvas.style.width`/`canvas.style.height`, avoiding the CSS/backing-store aspect-ratio mismatch that caused the initial stretched display.
- Installs a display `changedCallback` chain so SqueakJS browser resizes update the SDL window width/height.
- Queues SDL window `RESIZED`, `SIZE_CHANGED`, and `EXPOSED` events when the browser-managed canvas size changes.
- Makes `SDL_GetWindowSize`, `SDL_GL_GetDrawableSize`, and `SDL_GetRendererOutputSize` synchronize with the current browser-managed size before reporting dimensions.
- In browser-managed mode, `SDL_SetWindowSize` no longer re-shrinks the browser canvas; it preserves the available browser size and reports that size back to Pharo.

Regression coverage:

- `tests/pharo/ffi-emulation.test.js` now covers a browser-managed 1200x800 canvas with a Pharo-requested 800x600 SDL window, verifies that the canvas backing store remains 1200x800, verifies `SDL_GetWindowSize`, verifies that `SDL_SetWindowSize` does not reintroduce mismatch, and verifies that a later 1600x900 display resize updates SDL state and queues `SDL_WINDOWEVENT_SIZE_CHANGED`.
- `tools/browser-module-smoke.js` performs the same managed-canvas checks through the browser module graph.

Focused checks:

```sh
node tools/browser-module-smoke.js
node tools/run-pharo-tests.js tests/pharo/ffi-emulation.test.js
PHARO14_FULL_IMAGE=/path/to/Pharo14.image node tools/run-pharo-tests.js tests/pharo/browser-sandbox.test.js
PHARO14_FULL_IMAGE=/path/to/Pharo14.image PHARO14_OSWINDOW_SMOKE=1 node tools/run-pharo-tests.js tests/pharo/oswindow-sdl2-smoke.test.js
./verify.sh
```

Manual browser test remains the same URL.  After a hard reload, the initial display should no longer be CSS-stretched, and after resizing the browser area Pharo should be told the new SDL window size instead of continuing to render into the old partial extent.

## v046 direct SDL browser keyboard bridge

v045 fixed canvas sizing; the next browser-visible issue was keyboard input.  The old bridge generated SDL keyboard events indirectly from SqueakJS's legacy key-char event stream.  That is not sufficient for Pharo's SDL2/OSWindow path because SDL distinguishes physical key events from text input:

- `SDL_KEYDOWN`/`SDL_KEYUP` carry a physical scancode, key symbol, modifier mask, and repeat flag.
- `SDL_TEXTINPUT` carries UTF-8 text produced by the current keyboard layout / IME.
- Modifier-only keys such as Shift, Ctrl, Alt, and Meta must still generate keydown/keyup events and update `SDL_GetKeyboardState`.

The legacy char-derived bridge lost or distorted those details.  It could not report modifier-only transitions, derived scancodes from Unicode characters instead of DOM `KeyboardEvent.code`, and encoded non-ASCII `SDL_TEXTINPUT` bytes by truncating JavaScript UTF-16 code units.

v046 adds a direct browser-to-SDL keyboard path once an SDL window is bound to a SqueakJS display:

- `SDL_CreateWindow` marks the display as using direct SDL keyboard input.
- Browser `keydown` now queues SDL keydown records directly from DOM `KeyboardEvent.code`, `key`, modifier flags, and `repeat`.
- Browser `keyup` queues direct SDL keyup records and clears the scancode in `SDL_GetKeyboardState`.
- Browser `input` queues SDL text-input events separately, while the old Squeak key-char event queue is still maintained for non-SDL images.
- `SDL_TEXTINPUT` payloads are now UTF-8 encoded and NUL-terminated, matching SDL's `char text[32]` contract.
- DOM codes for letters, digits, punctuation, arrows, navigation keys, function keys, numpad keys, and modifier keys are mapped to SDL scancodes and key symbols.
- SDL modifier masks now come from DOM Shift/Ctrl/Alt/Meta state for direct keyboard events, instead of overloading Squeak's legacy `Keyboard_Cmd` bit.

Regression coverage:

- `tests/pharo/ffi-emulation.test.js` now verifies direct browser keydown/keyup for `KeyA`, Shift/Ctrl modifiers, repeat state, modifier-only `ShiftLeft`, `ArrowLeft`, keyboard-state updates, and UTF-8 text input for `Á`.
- The existing Squeak-event-derived keyboard test remains in place for compatibility with the older event path.

Focused checks:

```sh
node tools/browser-module-smoke.js
node tools/run-pharo-tests.js tests/pharo/ffi-emulation.test.js
PHARO14_FULL_IMAGE=/path/to/Pharo14.image node tools/run-pharo-tests.js tests/pharo/browser-sandbox.test.js
PHARO14_FULL_IMAGE=/path/to/Pharo14.image PHARO14_OSWINDOW_SMOKE=1 node tools/run-pharo-tests.js tests/pharo/oswindow-sdl2-smoke.test.js
./verify.sh
```

Manual browser test remains the same URL.  After a hard reload, normal text keys, arrows/navigation keys, shortcuts with modifiers, and Shift/Ctrl/Alt/Meta state should reach Pharo through SDL rather than through the lossy legacy char-event translation.
