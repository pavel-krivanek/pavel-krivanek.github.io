# Troubleshooting

## JSON import fails

Check braces, commas, quotes, and array/object structure. Export a known-good design and compare the shape. Imported JSON should be either design JSON, serialized patch JSON, or supported adopted panel wiring JSON.

## Unknown component or socket

Choose sockets from the visible panel or from a known template. Logical socket IDs use forms such as `P1.out`, `SUM1.in1`, and `OUT_X.in`. Physical socket IDs should come from the panel editor export.

## Direction error

Cables must connect an output to an input. The click editor can normalize endpoint order, but handwritten JSON should still use source output to target input.

## Multiple drivers

Ordinary inputs accept only one driver. Remove the extra cable, replace the existing driver, or combine signals through a summer or XIR summing junction.

## Missing required input

Patch a valid source into the required input. For coefficient potentiometers, remember to wire a source into `P*.in` before using `P*.out` elsewhere.

## Stateless cycle

A pure summer/inverter/comparator feedback loop has no state and no well-defined evaluation order. Break the loop with an integrator or restructure the patch around a state variable.

## Overload

Values outside ±1 machine unit usually indicate a scaling problem. Lower coefficients, reduce initial conditions, shorten OP time, or rescale the modeled system. Clipping can protect a display but should not be treated as a mathematical fix.

## Empty oscilloscope

Check the output status strip. CH1 or CH2 may be routed to an open X/Y/Z/U jack. Also check whether a coefficient output is zero because its potentiometer input is open. After wiring or control edits, press **Run** because auto-run is off by default.

## Long run appears stuck

Use the progress panel. High-precision and long OP-TIME runs are chunked in the browser; press **Halt** to stop and keep any completed partial trace.

## Accessory wiring does not execute

Physical capacitor, diode, and Z-diode terminals execute only when the editor sees a complete unambiguous two-terminal pattern: one executable output into one accessory terminal and the complementary terminal into one executable input. Half-wired, reversed, or ambiguous patterns remain visible but are not guessed.

## Panel is clipped or hard to navigate

Use **Fit** to show the full SVG panel, **Width** for horizontal inspection, and **100%** for alignment checks. Switch to **Move panel** before panning so clicks do not edit cables.

## Saved design reloads incorrectly

Reload the saved file through **Load file** and inspect validation messages. If an old design uses unsupported runtime-only helper endpoints, reload the current built-in preset and save a fresh design.
