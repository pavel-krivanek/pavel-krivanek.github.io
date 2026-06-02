# Source tree overview

The `src` tree contains the dependency-free JavaScript implementation. Core modules use CommonJS so they run directly under Node.js; browser modules also attach themselves to `window` when loaded from `public/index.html`.

## Core modules

- `core/components.js`, `core/inventory.js`, `core/patch.js`, `core/solver.js`, `core/modes.js`, and `core/value.js` implement the block-level analog computer: integrators, summers, inverters, coefficient potentiometers, multipliers, comparators, XIR summing extensions, constants, output jacks, operation modes, overload reporting, and numerical stepping.
- `core/physicalSockets.js` maps visible SVG sockets to executable logical endpoints, including duplicate output jacks, comparator middle sockets, machine-unit jacks, accessory terminals, summer feedback sockets, and ground ties.
- `core/design.js`, `core/designControls.js`, `core/designDiagnostics.js`, `core/designRuntime.js`, `core/designStorage.js`, and `core/designTemplates.js` manage editable design JSON, validation, control synchronization, template loading, save/load workflows, and design-to-runtime conversion.
- `core/designAccessories.js` conservatively materializes complete physical capacitor, diode, and Z-diode terminal pairs into explicit block-level runtime components.
- `core/designRepairs.js`, `core/designHistory.js`, `core/designPanelPolish.js`, and `core/designUsability.js` provide repair previews, undo/redo state, original-style overlay metadata, viewport helpers, keyboard navigation, and socket labeling.
- `core/hybrid.js`, `core/multiboard.js`, and `core/imperfections.js` provide educational hybrid-port, master/minion, and optional imperfection abstractions.

## Browser modules

- `browser/cableInteractionApp.js` is the integrated SVG wire editor. It supports hit testing, click-to-wire, endpoint moves, selected-wire deletion, stable cable bends, visible endpoint rings, and import/export of adopted panel wiring JSON.
- `browser/patchPanelApp.js`, `browser/patchEditorApp.js`, and `browser/patchTemplatesApp.js` expose patch-panel models, serialized-patch editing helpers, and predefined template metadata.
- `browser/browserPatchRuntime.js` runs serialized patches in the browser, including IC/OP/HALT/REP/REPF modes and async chunked simulation.
- `browser/deviceWorkbenchApp.js` coordinates the main static page: mode selector, OP-TIME, precision presets, P1–P8, X/Y/Z/U routing, oscilloscope rendering, progress, stopping, presets, and design persistence.
- `browser/customDesignApp.js`, `browser/educationApp.js`, and `browser/packagingApp.js` provide design import/export, validation summaries, user-facing explanations, walkthrough metadata, and troubleshooting helpers.
- `browser/oscilloscopeApp.js`, `browser/serializedGalleryApp.js`, and `browser/styles.css` provide trace rendering, example access, and the analog-computer-era visual theme.

## Examples and CLI

- `examples/firstSteps.js` contains the executable *First Steps* application set and helper-function coverage.
- `examples/scopeExpectations.js` stores deterministic qualitative checks for the booklet-style oscilloscope outputs.
- `examples/dampedOscillation.js`, `examples/serializedGallery.js`, `examples/multiBoardDemo.js`, and `examples/imperfectionDemo.js` provide reusable command-line and test fixtures.
- `cli/*.js` files are small runners for patch traces, gallery examples, multiboard output, and imperfection comparisons.
