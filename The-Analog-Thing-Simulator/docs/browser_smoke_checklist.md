# Browser smoke-test checklist

Use this checklist after changes to the static workbench or before handing off a bundle.

## Startup

- Open `public/index.html` with no build step.
- Confirm the physical SVG patch panel is the first and largest functional workbench element.
- Confirm the right side contains the oscilloscope, device controls, coefficient controls, and physical setup preset selector.
- Confirm no Advanced JSON, diagnostics, or guide panels appear on the main page.

## Presets

- Load Radioactive Decay and run in REPF; the X trace should decay and flatten.
- Load Mass-Spring-Damper and run with fine precision; the displacement should oscillate with a shrinking envelope.
- Load Lunar Landing and run in OP; altitude and velocity should follow the descent/recovery shape, with fuel monitorable through U.
- Load Euler Spiral in X/Y mode; the trace should show two point-symmetric arms for the default run.
- Load Hunter/Prey; the default display should be roll-mode time traces, with X/Y still usable manually.
- Load Bouncing Ball; panel wires should start and end on visible sockets, and the visible Y trace should rebound from the lower edge rather than the top.

## Patch editing

- Create a new cable by clicking two compatible sockets.
- Select a cable, move one endpoint, and confirm the cable remains attached to visible sockets.
- Move an endpoint on a loaded predefined demo wire that did not originally store connector IDs.
- Delete a selected cable.
- Use Undo and Redo after wiring and deletion.
- Confirm selected endpoint rings are visible and do not show `OUT`/`IN` text labels.

## Save and load

- Save the current design JSON.
- Load that JSON back into the workbench and confirm cables, coefficients, mode, output routes, and OP-TIME are restored.
- Store a browser draft, reload the page, and load the draft.
- Import an adopted panel wiring JSON file and confirm mapped wires convert into simulator cables.

## Runtime controls

- Change P1–P8 and press Run; confirm the old trace is marked stale until rerun.
- Select an open X/Y/Z/U output and confirm the status strip explains the open route.
- Run a long high-precision simulation, watch progress, then press Halt and confirm the partial trace remains.
- Try exact numeric values such as `8` and `0.01` in OP-TIME and solver fields.

## Layout and theme

- Use Fit, Width, 100%, zoom, and pan controls.
- Confirm save/load controls are stacked below the viewport controls.
- Confirm the oscilloscope controls use the same theme as the rest of the workbench while the display area remains dark.
