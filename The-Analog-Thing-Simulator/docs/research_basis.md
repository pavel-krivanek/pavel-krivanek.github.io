# Research and modeling basis

This simulator models The Analog Thing at a block level for educational patch design, deterministic regression testing, and browser-based exploration. It follows the qualitative conventions used in the *First Steps* booklet: machine units are normalized to −1…+1, integrators and summers invert sign, coefficient potentiometers scale input signals, and output jacks route selected internal signals to X/Y/Z/U display channels.

## Implemented computing elements

- Integrators with weighted inputs, IC input, optional slow operation, implicit sign inversion, and overload reporting.
- Summers with weighted inputs, summing junction support, feedback socket behavior, and implicit sign inversion.
- Inverters, coefficient potentiometers, multipliers, comparators, constants, XIR summing extensions, output jacks, idealized capacitors, idealized diodes, and idealized Z-diodes.

## Operation modes

The runtime supports IC, OP, HALT, REP, and REPF. REP and REPF repeatedly apply initial conditions and then operate for the selected OP-TIME. Browser runs can be chunked asynchronously so progress can be displayed and stopped.

## Numerical model

The solver uses deterministic numerical integration over normalized machine-unit values. The intent is qualitative agreement with analog-computer patch behavior, not transistor-level electrical simulation. Overload is reported when values exceed the machine-unit range; optional clipping is available for experiments but changes the simulated state.

## Physical panel model

The SVG socket map distinguishes input/output direction, weighted inputs, IC, SLOW, SJ, FB, ground, machine-unit jacks, duplicate output jacks, and passive accessory terminals. Only supported executable mappings affect simulation. Ambiguous physical passive networks are not guessed.

## First Steps coverage

The repository includes runnable presets and scope-output checks for the booklet applications and helper functions: Radioactive Decay, Mass-Spring-Damper, Lunar Landing, Neuronal Bursting, Euler Spiral, Hunter/Prey, Lorenz Attractor, Bouncing Ball, Polynomial Generator, maximum, minimum, absolute value, adjustable −1…+1, and non-negative clamp.

## Deliberate limitations

The simulator does not model op-amp slew rate, bandwidth, thermal noise, exact passive network physics, front-panel electrical tolerances, or hybrid-port electrical timing by default. Optional imperfection and hybrid abstractions are present for controlled demonstrations, but core examples are idealized and reproducible.
