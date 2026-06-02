# Browser user guide

The browser workbench is a static patch-panel-first simulator. It uses the supplied THAT panel SVG as the main editable surface and places the oscilloscope plus device controls in the side panel. It does not require npm, a build step, or network access.

## Opening the workbench

Open `public/index.html` from the unpacked repository. A browser may restrict local file access in some configurations; if that happens, serve the repository root with a simple static file server and open `public/index.html` through that server.

## Loading a predefined setup

Use **Physical setup preset** in the side panel, choose a setup, review the summary, and press **Load setup preset**. The visible preset list is restricted to *First Steps* booklet examples and helper functions. The repository still contains small low-level regression fixtures used by tests and command-line runners.

## Editing cables

The patch panel is the primary editable surface.

- **Wire** mode connects sockets. Start from an output or input; the editor normalizes endpoint order when possible.
- **Inspect socket** mode reports the visible socket, logical endpoint, section, role, and status.
- **Delete wire** mode removes a clicked cable.
- Selecting a cable shows endpoint handles that can be dragged to new sockets.
- Use **Undo**, **Redo**, **Delete selected**, and **Mark saved** for editing state.

Endpoint highlight rings are white and translucent so they remain visible on the dark panel theme. Selected endpoint handles are unlabeled drag targets; the editor no longer paints `OUT` or `IN` text beside them.

## Viewport, save, and load controls

Use **Fit**, **Width**, **100%**, zoom, and pan controls to inspect the SVG. The design file and draft controls are stacked underneath those viewport controls so they do not overlap the patch panel.

- **Save design** exports the current editable design JSON.
- **Load file** imports a selected JSON design or compatible adopted panel wiring file.
- **Store draft** saves the current design through the browser storage abstraction.
- **Load draft** restores that stored design.

## Running the simulator

Set the physical **mode selector**, OP-TIME, precision, clipping, and coefficient potentiometers in the side panel. Press **Run** after wiring or control changes. Auto-run is off by default so editing the panel does not repeatedly restart long simulations.

The progress area reports long browser runs and the **Halt** button can stop an in-progress simulation. A stopped run keeps any completed partial trace.

## Oscilloscope

The oscilloscope panel supports time-trace and X/Y display modes. Select CH1 and CH2 from X/Y/Z/U output jacks. The output status strip shows which jacks are patched, open, or currently selected. Open selected outputs display as zero until a wire is patched into the corresponding output jack.

## Accessory and feedback wiring

Summer `FB` sockets and neighboring ground ties are executable physical endpoints. Complete physical capacitor, diode, and Z-diode terminal pairs are materialized into explicit idealized runtime components when the wiring pattern is unambiguous. Incomplete, reversed, or ambiguous accessory patterns remain visible and diagnosable rather than being guessed.

## Exporting traces

After a run, **Export trace** emits a JSON payload containing the selected outputs, run settings, trace samples, summary metrics, and overload information.
