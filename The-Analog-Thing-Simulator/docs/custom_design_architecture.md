# Custom design architecture

The simulator separates visible panel editing, serialized design data, executable patch data, and numerical runtime. This keeps the browser workbench close to the physical THAT panel while allowing deterministic tests and command-line execution.

## Layers

1. **Physical socket map** — `src/core/physicalSockets.js` describes visible SVG sockets, coordinates, direction, shape, section, role, duplicate jacks, and optional executable logical endpoints.
2. **Integrated wire editor** — `src/browser/cableInteractionApp.js` edits cables on the SVG panel, maintains endpoint metadata, supports undo/redo, and exports panel wiring JSON.
3. **Design JSON** — `src/core/design.js` stores user-facing metadata, coefficients, operation defaults, output routes, and physical/logical cable endpoints.
4. **Diagnostics and repairs** — `src/core/designDiagnostics.js` reports unknown sockets, direction mistakes, multiple drivers, missing inputs, algebraic cycles, and accessory gaps. `src/core/designRepairs.js` provides conservative repair previews and guided actions.
5. **Accessory materialization** — `src/core/designAccessories.js` turns complete physical capacitor, diode, and Z-diode terminal pairs into explicit runtime components when the pattern is safe and unambiguous.
6. **Executable patch JSON** — serialized patch data uses component IDs, logical socket IDs, cable lists, outputs, parameters, and device controls.
7. **Runtime** — `src/core/patch.js`, `src/core/solver.js`, `src/core/modes.js`, and `src/browser/browserPatchRuntime.js` evaluate the patch in IC, OP, HALT, REP, and REPF modes.
8. **Browser workbench** — `src/browser/deviceWorkbenchApp.js` binds the panel, oscilloscope, controls, preset loading, save/load, async progress, and trace export.

## Endpoint policy

Cables are executable only when they can be mapped to valid output-to-input logical endpoints or a supported physical pattern. Ordinary inputs allow one driver. Output fan-out is allowed. Unsupported physical-only wires remain visible but must not silently affect runtime results.

## Persistence policy

Saved designs preserve physical endpoint information so reloaded files can redraw wires on the panel. Runtime conversion derives logical patch JSON from that design state. Draft storage uses the same design payload and can be cleared or overwritten by the user.

## Scope of the model

The runtime is a block-level educational analog-computer simulator. It intentionally does not attempt SPICE-level circuit solving, op-amp bandwidth, resistor tolerances by default, leakage, or full passive-network inference. Optional imperfection helpers exist for controlled demonstrations but the default examples remain ideal and deterministic.
