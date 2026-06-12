# Browser testing Pharo 14 in SqueakJS

This branch is still experimental. The useful browser target is not yet “full desktop Pharo is finished”; it is “Pharo 14 starts far enough that OSWindow can drive the emulated SDL2/ThreadedFFI path without immediate missing-symbol failures”.

## Start a local browser run

From outside the unpacked bundle:

```sh
unzip SqueakJS-pharo14-browser-interactive-v034.zip
cd SqueakJS-main
mkdir -p local-pharo14
unzip /path/to/pharoImage-x86_64.zip -d local-pharo14
python3 -m http.server 8000
```

Open this in a desktop browser:

```text
http://localhost:8000/run/#unix&url=../local-pharo14&files=[Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image,Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.changes,Pharo14.0-64bit-6a0497e.sources]&root=/pharo14&keepHashOnQuit=true&traceFFI=true
```

`unix` is now also the browser default in this branch, but keep it in the URL while testing Pharo 14 so the run is explicit. Remove `&traceFFI=true` for less console output.

The browser VM currently reports this Unix-compatible platform shape to Pharo:

```smalltalk
{
  Smalltalk vm operatingSystemName.
  Smalltalk vm platformSubtype.
  Smalltalk vm operatingSystemVersion.
  Smalltalk vm windowSystemName
}
```

Expected shape:

```smalltalk
#('unix' 'x86_64' 'linux-gnu ...' 'HTML')
```

The first run imports the image, changes, and sources into the browser-backed SqueakJS filesystem. Later reloads can reuse those stored files.

## OSWindow smoke code

Once the image is running, open a Playground/Workspace and evaluate:

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

Expected current result:

```smalltalk
{ true . 1 . (320@200) . #OSSDL2FormRenderer }
```

The canvas-backed rendering path is intentionally still early. The first things to watch are browser-console errors, missing FFI symbols, unimplemented SDL functions, and responsiveness after mouse/keyboard input.

## Useful debugging switches

Add `traceFFI=true` to the URL hash to log FFI symbol resolution and same-thread callouts in the browser console.

In Node, use:

```sh
SQUEAKJS_TRACE_FFI=1 node squeak_node.js pharo14-full.image eval '1+2'
```

For the opt-in Node OSWindow smoke:

```sh
PHARO14_OSWINDOW_SMOKE=1 \
PHARO14_FULL_IMAGE=/path/to/pharo14-full.image \
node tools/run-pharo-tests.js tests/pharo/oswindow-sdl2-smoke.test.js
```

## v027 note

If startup previously wrote a `PharoDebug.log` ending in `File class>>primFileMasks` / `primitive #signalError:for: in File class failed`, use v027 or later.  v026 reported Unix correctly, but the browser module loader did not import `FileAttributesPlugin`; v027 fixes that and adds browser virtual-filesystem-backed file attributes.

## v028 note

If startup previously wrote a `PharoDebug.log` ending with:

```text
Error: Can't find the requested origin
UnixResolver>>home
UnixResolver>>preferences
```

use v028 or later.  v027 reported Unix and loaded `FileAttributesPlugin`, but the browser environment had no `HOME` / `XDG_CONFIG_HOME`.  v028 supplies a Unix-like browser environment and creates the corresponding virtual filesystem directories:

```text
HOME=/home/squeak
XDG_CONFIG_HOME=/home/squeak/.config
XDG_CACHE_HOME=/home/squeak/.cache
XDG_DATA_HOME=/home/squeak/.local/share
TMPDIR=/tmp
```

After switching bundles, use a hard reload with cache disabled.  If the browser still jumps back to `http://localhost:8000/run/#`, check the new `PharoDebug.log`; the next failure should be past `UnixResolver>>preferences`.

## Sandbox browser-startup regression test

The browser failures seen so far can now be checked without a real browser by
running a full Pharo image under Node with the host Unix environment stripped:

```sh
PHARO14_FULL_IMAGE=/path/to/Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image \
  node tools/run-pharo-tests.js tests/pharo/browser-sandbox.test.js
```

For a direct smoke command:

```sh
node tools/pharo14-browser-sandbox-smoke.js /path/to/Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image
```

This probe intentionally removes `HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`,
`XDG_DATA_HOME`, and related temporary-directory variables before startup.  It
then asks Pharo to resolve `HOME`, `XDG_CONFIG_HOME`, and `FileLocator
preferences`.  The expected answer is:

```smalltalk
#('unix' '/home/squeak' '/home/squeak/.config' '/home/squeak/.config')
```

This specifically guards the browser failures that previously showed:

```text
Error: Can't find the requested origin
UnixResolver>>preferences
```

## v030 note

If startup writes a `PharoDebug.log` ending with:

```text
Cannot generate UUID. It requires at least version 10.3.9 of the Pharo vm.
ByteArray>>generateUUIDInPlace
UUID class>>new
GlobalIdentifier>>computerUUID
```

use v030 or later.  Earlier browser bundles had `plugins/UUIDPlugin.js`, but the
browser module loader did not import it, so Pharo fell through to the Smalltalk
fallback error.  v030 imports `UUIDPlugin` in `squeak.js` and the browser
sandbox smoke now also checks `UUID new asString size`, expecting `36`.

The direct sandbox smoke expected answer is now:

```smalltalk
#('unix' '/home/squeak' '/home/squeak/.config' '/home/squeak/.config' 36)
```

### Local browser-module smoke

Before asking for a manual Chrome run, use:

```sh
node tools/browser-module-smoke.js
```

This does not run a browser UI, but it does load the browser VM modules under a DOM shim and checks the exact startup assumptions that caused the previous browser-only failures: plugin registration, Unix environment fallback, and `/SqueakJS` path alias handling.

Run the stronger browser-startup sandbox against the full image with:

```sh
PHARO14_FULL_IMAGE=/path/to/Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image \
  node tools/run-pharo-tests.js tests/pharo/browser-sandbox.test.js
```

## v032 stdio descriptor note

If startup writes a `PharoDebug.log` ending with:

```text
PrimitiveFailed: primitive #fileDescriptorType: in File class failed
Stdio class>>standardIOStreamNamed:forWrite:
ClapContext>>stdout
```

use v032 or later.  Earlier browser bundles had descriptor support only in the Node FilePlugin.  v032 adds browser-side `primitiveFileDescriptorType` and `primitiveConnectToFileDescriptor`, mapping stdout and stderr to console-backed pipe-like streams.

The local browser module smoke now checks this directly:

```sh
node tools/browser-module-smoke.js
```

## v033 preserving the browser URL after VM stop

If the image stops without producing a `PharoDebug.log`, the stop may be a normal VM quit/break rather than an image-side exception.  Earlier run-page code immediately cleared the hash after VM stop, which returned the page to:

```text
http://localhost:8000/run/#
```

That also makes it harder to inspect the console because the page reloads.  v033 adds a debug quit-preservation path.  Use either of these URL switches:

```text
keepHashOnQuit=true
traceFFI=true
```

`traceFFI=true` now also preserves the hash automatically, because it is already a debugging mode.  For debugging with less FFI noise, use `keepHashOnQuit=true` without `traceFFI=true`.

Recommended browser URL while chasing startup stops:

```text
http://localhost:8000/run/#unix&url=../local-pharo14&files=[Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image,Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.changes,Pharo14.0-64bit-6a0497e.sources]&root=/pharo14&keepHashOnQuit=true&traceFFI=true
```

If the VM stops, the page should remain on the same `run/#...` URL and show the stopped banner instead of returning to the index hash.  The JavaScript console should remain available for inspection.

This behavior is covered by:

```sh
node tools/browser-run-index-smoke.js
```


## v034 browser Pharo command line

Pharo 14 must receive an image-side `--interactive` argument in browser runs. Without it, startup can enter command-line mode, print command-line options, and quit even though VM startup and filesystem initialization succeeded.

For the normal browser URL above, SqueakJS now builds this argument vector automatically when `unix` mode is active and no explicit image arguments are supplied:

```text
/vm.js /pharo14/<image-name>.image --interactive
```

Explicit command-line arguments still override the default. Use `args=[...]`, `imageArgs=[...]`, or a complete `argv=[...]` URL parameter when intentionally running a non-interactive command. For example, an explicit eval run would suppress the default interactive argument:

```text
args=[eval,1+2]
```

With `traceFFI=true`, the browser console prints the computed `SqueakJS argv:` line so the active command-line shape can be checked directly.

## v035 argv / getSystemAttribute correction

If the browser console prints:

```text
Error: Unrecognized arguments: /pharo14/Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image
```

then Pharo is seeing the image path as an image-side command-line argument.  In the correct browser startup shape, the image path is VM argument slot 1 and `--interactive` is the first image-side argument:

```text
/vm.js /pharo14/Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image --interactive
```

With `traceFFI=true`, the console should print a `SqueakJS argv:` line with that exact shape.  Attribute 2 must be `--interactive`, not the image path.  This is covered by:

```sh
node tools/browser-module-smoke.js
node tools/run-pharo-tests.js tests/pharo/vm-attributes-and-parameters.test.js
```

### v036 note: interactive SDL2 callout builder

If the browser console shows `FFICalloutMethodBuilder had the subclass responsibility to implement #createFFICalloutLiteralFromSpec:` near `SDL2 class>>setHint:value:`, the image has entered the SDL2 interactive startup path but UFFI selected the abstract builder.  v036 repairs `FFICalloutAPI CalloutAPIClass` to `TFCalloutAPI` during VM startup, so this failure should be absent.  Keep `keepHashOnQuit=true` while testing so the console remains available if a later SDL2 or Morphic failure appears.

## v037 SDL2 Unix library discovery

For browser Pharo 14 we still report `unix`, so Pharo's `SDL2Library` asks
`FFIUnix64LibraryFinder` to locate native-looking shared libraries such as
`libSDL2-2.0.so.0`.  The browser has no real `/lib` tree, therefore v037 creates
zero-byte virtual filesystem placeholders under conventional Linux paths, for
example:

```text
/lib/x86_64-linux-gnu/libSDL2-2.0.so.0
/lib/x86_64-linux-gnu/libSDL2-2.0.so.0.2.1
```

These are discovery placeholders only.  The actual SDL2 functions are still
implemented by the JavaScript `Squeak.FFIEmulation` SDL2 module.  If browser
startup still reports `Cannot locate any of #('libSDL2-2.0.so.0.2.1' ...)`, hard
reload with cache disabled and confirm that the console is running the v037
bundle.

## v038 browser startup harness

The browser-specific startup harness is now stronger than the previous source-string checks.

Run the non-interactive browser startup probe with a full Pharo image:

```sh
PHARO14_FULL_IMAGE=/path/to/Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image \
  node tools/run-pharo-tests.js tests/pharo/browser-sandbox.test.js
```

For the direct interactive startup smoke:

```sh
node tools/pharo14-browser-interactive-smoke.js /path/to/Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image
```

This starts the image with `--interactive` under browser-like Unix/filesystem/environment assumptions, lets Morphic/SDL2 startup run briefly, and treats the timeout as success only if the known fatal patterns are absent.  It now catches the `NullFFIBackend>>allocate:` regression and the `OSSDL2ExternalForm>>primCreateManualSurfaceWidth:height:rowPitch:depth:isMSB:` regression locally.

## v039 stale NullFFIBackend fallback

If the browser console still shows:

```text
primitive #allocate: in NullFFIBackend failed
ExternalAddress class>>fromString:
TFStringType>>allocateString:
SDL2 class>>setHint:value:
```

then the image is reaching SDL2 string marshalling with a stale `NullFFIBackend` object.  v039 patches that fallback path during VM startup.  The console should contain a startup repair line similar to:

```text
Hacking FFICalloutAPI CalloutAPIClass -> TFCalloutAPI, FFIBackend Current -> TFFIBackend, NullFFIBackend fallbacks -> TFFIBackend primitives [... loadSymbol:module:]
```

The local harness now deliberately forces `FFIBackend Current` back to `NullFFIBackend new` before testing `ExternalAddress fromString:` and `SDL2 setHint:value:`, so this failure should be caught without a manual browser run.

## v040 note: browser libc registry check

If the browser console reports:

```text
Could not find symbol named: #memcpy searching in module: 'libc.so.6'
```

then the browser graph has probably allowed the legacy `ffi/libc.js` demo module to overwrite the richer Pharo 14 libc emulation.  v040 prevents that overwrite and adds a local check:

```sh
node tools/browser-module-smoke.js
```

This smoke imports the same browser-side modules and verifies that `libc.so.6` resolves `memcpy` through `primitiveLoadSymbolFromModule`.

## v041 rendering check

The browser SDL2 bridge now converts Pharo's `SDL_PIXELFORMAT_XRGB8888` texture data to Canvas RGBA before calling `putImageData`.  This fixes the first expected symptom of broken rendering: red/blue swaps or transparent pixels caused by copying Pharo/Squeak 32-bit form words directly into browser `ImageData`.

Before testing manually in Chrome, run the local browser rendering smoke:

```sh
node tools/browser-module-smoke.js
```

That smoke imports the browser module graph, creates a mock browser canvas, uploads a one-pixel Pharo-style XRGB red texture through SDL2, calls `SDL_RenderCopy`, and verifies that the resulting `putImageData` payload is RGBA red at the requested destination rectangle.

For browser testing, use the same URL pattern:

```text
http://localhost:8000/run/#unix&url=../local-pharo14&files=[Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.image,Pharo14.0-SNAPSHOT-64bit-6a0497e0d7.changes,Pharo14.0-64bit-6a0497e.sources]&root=/pharo14&keepHashOnQuit=true&traceFFI=true
```

If the image runs but the canvas is still blank, the next likely issue is not the basic texture upload byte order; it is probably one of these later rendering details: renderer selection between Form/Athens/GL paths, manual surface locking through `SurfacePlugin`, damage rectangle propagation, or the Morphic world process not producing screen damage.

## v042 rendering check: SDL_LockTexture and SurfacePlugin manual surfaces

If v041 starts the image but the browser canvas is still blank, the next important path is `OSSDL2FormRenderer>>updateRectangle:`.  Pharo can lock a streaming SDL texture, expose the returned pixel pointer as an `OSSDL2ExternalForm`, and ask `SurfacePlugin`/BitBlt to draw the damaged rectangle directly into that locked memory.  This path depends on `SDL_LockTexture` writing a real external pointer value through `void** pixels`, not just attaching JavaScript data to the argument object.

v042 adds that pointer-backed lock path.  `SDL_LockTexture` now creates a temporary raw SDL-format texture buffer, registers it in the primitive `ffiAddressDataMap`, writes the fake external pointer handle through `void** pixels`, and writes the pitch.  `SDL_UnlockTexture` converts the modified packed 8888 buffer back into Canvas RGBA and releases the temporary pointer mapping.

Before testing manually in Chrome, run:

```sh
node tools/browser-module-smoke.js
./verify.sh
```

For an image-enabled local check, copy the full Pharo 14 image into the checkout as `pharo14-full.image` and run:

```sh
SQUEAKJS_TRACE_FFI=1 /usr/bin/timeout 60 node squeak_node.js pharo14-full.image eval \
  "| attrs w f r | attrs := OSWindowAttributes new title: 'SqueakJS'; extent: 8@8; yourself. w := OSWindow createWithAttributes: attrs. f := Form extent: 8@8 depth: 32. f fillColor: Color red. r := w newFormRenderer: f. r updateRectangle: (0@0 corner: 8@8). { r class name . r form extent }"
```

The trace should show the texture lock/unlock and present sequence and should not show the earlier suppressed BitBlt copy error.  If the browser remains blank after this point, the remaining suspects move later in the rendering stack: canvas sizing or resize propagation, Morphic damage scheduling, renderer state such as clip/viewport/scale, or additional SDL renderer primitives used by a non-Form renderer path.

## v043 rendering check: SurfacePlugin word view for BitBlt writes

If v042 removes the `Bad BitBlt arg` failure but the browser canvas is still blank, the important distinction is that `SurfacePlugin` had become able to lock the manual surface, but BitBlt still did not necessarily write into the locked texture buffer.

`BitBltPlugin` treats the result of `ioLockSurface` as C-style word-addressable storage and writes pixels through expressions shaped like:

```js
surfaceBits[byteIndex >>> 2] = pixelWord;
```

In v042, `ioLockSurface` could return the raw `ArrayBuffer` registered for the fake FFI pointer.  Numeric writes to an `ArrayBuffer` object do not mutate the underlying bytes.  That means the Pharo `OSSDL2FormRenderer>>updateRectangle:` path could complete without throwing, then unlock and present an unchanged/blank texture.

v043 changes `SurfacePlugin>>ioLockSurface` to return a `Uint32Array` word view over mapped FFI pointer data.  This matches what BitBlt expects and makes the existing manual-surface path actually mutate the SDL locked texture memory.  `SDL_UnlockTexture` then converts those modified XRGB8888 words into Canvas RGBA, and `SDL_RenderCopy`/`SDL_RenderPresent` copy the result to the browser canvas.

Additional browser-side diagnostics were also added:

- `SDL_RenderCopy` records `display.sdlLastCopy` and increments a renderer copy counter.
- `SDL_RenderPresent` records `display.sdlPresentCount` and `display.sdlLastPresent`.
- `SDL_RenderPresent` calls the display change callback and asks the VM to break out/yield when available, giving the browser a paint opportunity after a present.
- Simple canvas-backed draw primitives (`SDL_RenderDrawPoint`, `SDL_RenderDrawLine`, `SDL_RenderDrawRect`, `SDL_RenderFillRect`) are now present for renderer paths that use SDL drawing instead of only texture copies.

Before testing manually in Chrome, run:

```sh
node tools/browser-module-smoke.js
./verify.sh
```

The browser smoke now also verifies that a manual surface pointer backed by an `ArrayBuffer` locks as a `Uint32Array`, and that a BitBlt-shaped 32-bit word write mutates the backing buffer.

If v043 is still blank in a real browser, check these display fields in the console on the active SqueakJS display/VM object if reachable:

```js
sdlPresentCount
sdlLastPresent
sdlLastCopy
```

If those counters stay empty, the problem is before presentation, likely Morphic damage scheduling or renderer selection.  If they update, the problem is probably canvas identity, canvas sizing, CSS visibility, or a final browser paint/presentation mismatch.

## v044 SDL native cursor bridge

After v043, Morphic/OSWindow rendering reaches the browser canvas, but the cursor can still be invisible.  The cause is that the legacy SqueakJS browser input setup hides the browser cursor with `canvas.style.cursor = "none"` because classic Squeak images draw their own software cursor in a separate cursor canvas.  Pharo's SDL2 OSWindow path instead asks SDL to manage a native cursor through APIs such as `SDL_ShowCursor`, `SDL_CreateSystemCursor`, and `SDL_SetCursor`.

v044 adds a browser-side SDL native cursor bridge:

- `SDL_CreateWindow` now applies a visible default browser cursor to the bound canvas.
- `SDL_CreateSystemCursor` maps SDL system cursor ids to CSS cursor values such as `default`, `text`, `wait`, `crosshair`, `pointer`, and resize cursors.
- `SDL_SetCursor` applies the selected SDL cursor to the active browser canvas.
- `SDL_ShowCursor` implements SDL query/hide/show behavior and maps hidden state to CSS `cursor: none`.
- `SDL_GetCursor` and `SDL_GetDefaultCursor` return stable SDL cursor handles.
- `SDL_CreateCursor` creates a CSS data-URL cursor from SDL monochrome data/mask bytes.
- `SDL_CreateColorCursor` creates a CSS data-URL cursor from a 32-bit SDL surface when the image uses color cursor surfaces.
- Once the SDL cursor path is active, the old SqueakJS software cursor overlay is hidden to avoid an empty/stale overlay competing with the browser cursor.

The browser module smoke now verifies that window creation restores the default cursor, that SDL's hand cursor becomes CSS `pointer`, and that `SDL_ShowCursor` toggles CSS `none` and restores the selected cursor.

Run:

```sh
node tools/browser-module-smoke.js
./verify.sh
```

Manual browser test remains the same URL.  After a hard reload, the Morphic world should still render as in v043, and the browser cursor should be visible over the canvas.  If the pointer appears but does not match Pharo's intended cursor shape in some tools, the next cursor-specific target is to capture which SDL cursor creation path Pharo uses there: system cursor, monochrome `SDL_CreateCursor`, or color-surface `SDL_CreateColorCursor`.

## v045 browser canvas sizing and SDL window resize propagation

After v044, the image renders and the cursor is visible, but the canvas can still start in a stretched state.  This happens when Pharo requests an SDL window size such as 800x600 while SqueakJS has already laid out a browser canvas with a different backing-store size.  The old SDL bridge wrote the requested SDL size directly into `canvas.width`/`canvas.height` without updating the CSS layout.  The browser therefore scaled that backing store to the available window area, distorting the aspect ratio.

v045 treats `createSqueakDisplay` as the owner of browser canvas layout.  When `display.width` and `display.height` are present, `SDL_CreateWindow` adopts that existing backing-store size as the real SDL window size instead of resizing the canvas to the requested Pharo extent.  Later SqueakJS resize callbacks update the SDL window and queue SDL window resize/expose events, so Pharo can adjust its renderer and display extent.

Useful browser-console diagnostics on the active display object after v045:

```js
sdlWindowWidth
sdlWindowHeight
sdlCanvasWidth
sdlCanvasHeight
sdlLastPresent
sdlLastCopy
```

Expected behavior:

- Initial load: no obvious CSS stretch of the Pharo world.
- Browser resize: Pharo receives SDL size-change events and should eventually render to the new available extent.
- `sdlWindowWidth`/`sdlWindowHeight` should match the canvas backing-store size, not the stale original Pharo-requested SDL window extent.

Run before manual browser testing:

```sh
node tools/browser-module-smoke.js
./verify.sh
```

## v046 keyboard mapping

v046 changes browser keyboard delivery for the Pharo SDL2 path.  Classic SqueakJS keyboard input is still maintained for old images, but once Pharo creates an SDL window the browser DOM events are also translated directly into SDL events.

Expected behavior after a hard reload:

- Printable text is delivered as SDL text input (`SDL_TEXTINPUT`) encoded as UTF-8.
- Physical keydown/keyup events use DOM `KeyboardEvent.code` for SDL scancodes, so shifted letters and non-text keys are no longer guessed from Unicode characters.
- Modifier-only keys generate SDL key events and update `SDL_GetKeyboardState`.
- Arrow keys, Home/End, PageUp/PageDown, Insert/Delete, function keys, punctuation, and numpad keys have explicit SDL scancode/keycode mappings.
- Repeated keys preserve the browser repeat flag in the SDL keydown event.

Useful browser-console diagnostics on the active display object:

```js
sdlKeyboardDirect
sdlEventQueue
```

For a quick manual check, click/focus the Pharo canvas and try:

- typing lowercase and uppercase letters;
- Backspace/Delete and arrow keys in a text editor;
- Shift-only and Ctrl/Alt/Meta shortcuts;
- holding a key long enough to repeat.

Run before manual browser testing:

```sh
node tools/run-pharo-tests.js tests/pharo/ffi-emulation.test.js
./verify.sh
```
