# Example walkthroughs

The browser preset picker focuses on examples from the *First Steps* booklet. Each preset loads a visible physical wiring, coefficient defaults, device controls, and oscilloscope routing.

## First Steps applications

- **Radioactive Decay** — first-order exponential decay. Default output is a flattening X trace.
- **Mass-Spring-Damper System** — second-order underdamped displacement. Default output is a decaying oscillation.
- **Lunar Landing** — powered descent with throttle, gravity, altitude, velocity, and fuel signals. Default output is a roll-mode altitude/velocity trace.
- **Neuronal Bursting** — scaled Hindmarsh-Rose burst pattern. Default output shows repeated spike bursts.
- **Euler Spiral** — X/Y quadrature curve with a centered default sweep that shows both arms.
- **Hunter/Prey Population Dynamics** — Lotka-Volterra time traces for prey and predator populations. X/Y phase view can be selected manually.
- **Lorenz Attractor** — chaotic two-lobed attractor projections. Use X/Y, Z/X, or Z/Y output routing for different views.
- **Bouncing Ball** — bounded X/Y path with side-wall and lower-edge rebounds. The visible Y channel uses standard module wiring and is not display-only.
- **Polynomial Generator** — cubic polynomial output plus supporting terms for x, x², and x³.

## Helper functions

- **Maximum of two values** — comparator-based max(A, B).
- **Minimum of two values** — comparator-based min(A, B).
- **Absolute value** — positive output for either sign of A.
- **Adjustable −1 to +1 value** — full-machine-unit coefficient helper.
- **Non-negative values only** — passes A when A > 0, otherwise outputs zero.

## Running a walkthrough

1. Choose the preset from **Physical setup preset**.
2. Press **Load setup preset**.
3. Confirm CH1/CH2 and display mode match the example goal.
4. Press **Run**.
5. Adjust coefficient potentiometers while observing the oscilloscope.
6. Save the edited design when the wiring/control state should be reused.

## Command-line checks

Run a gallery example through Node.js:

```sh
node src/cli/runGalleryExample.js --example first-steps-radioactive-decay --out generated/radioactive_decay_trace.json
```

Run a saved patch:

```sh
node src/cli/runPatch.js --patch patches/gallery/first-steps-euler-spiral.patch.json --mode REPF --op-time 120 --cycles 1 --out generated/euler_spiral_trace.json
```
