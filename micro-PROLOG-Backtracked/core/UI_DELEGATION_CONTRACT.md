# Clean-room UI delegation contract

This document defines the narrow runtime/UI seam used for the remaining display, graphics, sound, and device-facing built-ins in the clean-room implementation.

The goal is to keep the clean-room core simple:

- the runtime keeps parsing, term handling, search, modules, database updates, file handling, and control semantics
- the UI layer may choose how to display pixels, clear the screen, change border colour, or emulate port I/O
- no fake Spectrum state should be grown inside `workspace.js` or `engine.js` merely to satisfy these built-ins

## Hook location

The hook is supplied when the engine is created:

```js
const engine = Engine.createEngine(workspace, {
  uiEffects: {
    handleBuiltin(name, args, meta) {
      // implement delegated UI/device effect here
    },
    handleOutput(text, meta) {
      // optional console/screen-output adapter hook for P / PP
    }
  }
});
```

If no hook is provided, the clean-room runtime still behaves deterministically:

- `HYBRID`, `NORMAL`, `LNE`, `PNT`, `CLS`, `BORDER`, and `BP` succeed as no-ops
- `PIO` write form succeeds as a no-op
- `PIO` read form is not available and therefore raises control error `3`


## Optional console-output hook

The same `uiEffects` object may also provide:

```js
handleOutput(text, meta)
```

This hook is called for `P` and `PP` output after the runtime has rendered the emitted text.

- `text` is the rendered chunk passed to the console device
- `meta.builtin` is `"P"` or `"PP"`
- `meta.newline` is `true` only for `PP`
- `meta.pretty` is `true` only for `PP`
- `meta.queryState` and `meta.goal` are the current runtime objects

Return contract:

- `null` / `undefined` means “output handled or ignored”
- `{ errorCode: 7 }` or another finite numeric code asks the runtime to append the historical error text and abort the query after emitting the already-written output chunk

This is intended for host-side console/screen adapters such as a Spectrum-style screen model. The transcript still remains runtime-owned.

## Delegated built-ins

The clean-room runtime delegates only these built-ins through the hook:

- `HYBRID`
- `NORMAL`
- `LNE`
- `PNT`
- `CLS`
- `BORDER`
- `BP`
- `PIO`

All other built-ins remain runtime-owned.

## Call contract

The runtime calls:

```js
handleBuiltin(name, args, meta)
```

with these rules:

- `name` is the builtin name as an uppercase string
- `args` is a shallow copy of the runtime argument array
- `meta` is a small descriptor object produced by the runtime

The hook is synchronous. It must not return a promise and must not depend on background completion.

The hook should treat `args`, `meta.goal`, and `meta.queryState` as read-only engine-owned objects.

## `meta` fields

Every delegated call includes:

- `meta.builtin`: same as `name`
- `meta.queryState`: the current query state object
- `meta.goal`: the current builtin goal term

Additional fields depend on the builtin mode.

### Side-effect built-ins

These built-ins use `meta.mode === "side-effect"`:

- `HYBRID`
- `NORMAL`
- `LNE`
- `PNT`
- `CLS`
- `BORDER`
- `BP`

Return contract:

- `null` or `undefined` means “effect handled or ignored; builtin succeeds”
- `{ outputLine: string }` additionally appends one textual output line to the query transcript

All other returned fields are ignored by the runtime.

### `PIO` write form

When the goal is `(PIO port value)` and `value` is numeric, the runtime calls the hook with:

- `meta.mode === "write"`
- `meta.port`: integer port number
- `meta.value`: integer value reduced modulo 256

Return contract:

- return value is ignored
- the builtin succeeds after the hook returns

### `PIO` read form

When the goal is `(PIO port x)` and `x` is an unbound variable, the runtime calls the hook with:

- `meta.mode === "read"`
- `meta.port`: integer port number

Return contract:

- the hook must return an object with a finite numeric `value` field, for example `{ value: 123 }`
- the runtime reduces that value modulo 256 and unifies it with the second argument
- if the returned value is missing, non-numeric, or non-finite, the runtime raises historical control error `3`

## Failure and error semantics

The delegated side-effect built-ins are deterministic and succeed once the hook returns.

The hook should prefer one of these behaviours:

- handle the effect and return normally
- ignore the effect and return normally
- for `PIO` read, return `{ value: n }`

The hook should not signal logical failure directly. Logical failure remains a runtime concern.

If the hook throws an exception, that exception escapes through the runtime. Therefore the preferred contract is to return ordinary values rather than throw. If a host deliberately wants the Micro-PROLOG query to see a historical control error, it should arrange for the runtime-facing result to be invalid in the same way the runtime already checks, rather than throwing unrelated host exceptions.

## Argument interpretation

The runtime enforces builtin arity before the hook is called. Numeric argument checks also happen in the runtime for the delegated built-ins.

That means the hook can assume the following historical surface shapes:

- `HYBRID` / `NORMAL`: arity `0` or `1`
- `LNE`: arity `4`, `5`, or `6`
- `PNT`: arity `2`, `3`, or `4`
- `CLS`: arity `0` or `1`
- `BORDER`: arity `1`
- `BP`: arity `2`
- `PIO`: arity `2`

The hook still receives the original term objects in `args`; it may inspect them if the host wants to preserve historical distinctions such as optional colour arguments.

## Non-goals

This seam does not attempt to define:

- exact ZX Spectrum screen geometry
- exact sound timing or tone generation
- exact keyboard, joystick, or hardware-port behaviour
- cassette, printer, or media pragmatics
- asynchronous UI workflows

Those remain host/UI decisions above the clean-room runtime.

## Minimal host example

```js
const engine = Engine.createEngine(workspace, {
  uiEffects: {
    handleBuiltin(name, args, meta) {
      if (name === 'CLS') {
        screen.clear();
        return null;
      }
      if (name === 'BORDER') {
        screen.setBorderColour(Number(args[0].value));
        return null;
      }
      if (name === 'PIO' && meta.mode === 'read') {
        return { value: host.readPort(meta.port) };
      }
      if (name === 'PIO' && meta.mode === 'write') {
        host.writePort(meta.port, meta.value);
        return null;
      }
      return null;
    }
  }
});
```

## Design rule

If a future change makes this contract substantially larger, that is a sign the work should move into a dedicated UI adapter layer rather than into the clean-room runtime itself.
