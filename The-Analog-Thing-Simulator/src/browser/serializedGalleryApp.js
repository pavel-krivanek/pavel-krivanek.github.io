/* global window, document */
'use strict';

(function attachSerializedGalleryApp(globalScope) {
  const PATCH_SCHEMA_VERSION = 'analog-thing-patch/v1';
  const DEFAULT_INVENTORY_NAME = 'that-prototype-board/v006';

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeText(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function patch(name, description, components, cables, outputs, parameters) {
    return {
      schemaVersion: PATCH_SCHEMA_VERSION,
      inventory: DEFAULT_INVENTORY_NAME,
      name,
      description,
      components,
      cables,
      outputs,
      parameters: parameters || {},
    };
  }


  const QUICK_START_BOOKLET_EXAMPLE_IDS = Object.freeze([
    'first-steps-radioactive-decay',
    'first-steps-mass-spring-damper',
    'first-steps-lunar-landing',
    'first-steps-neuronal-bursting',
    'first-steps-euler-spiral',
    'first-steps-hunter-prey',
    'first-steps-lorenz-attractor',
    'first-steps-bouncing-ball',
    'first-steps-polynomial-generator',
    'first-steps-helper-max',
    'first-steps-helper-min',
    'first-steps-helper-abs',
    'first-steps-helper-adjustable-minus-one-plus-one',
    'first-steps-helper-non-negative-only',
  ]);
  const QUICK_START_BOOKLET_EXAMPLE_ID_SET = new Set(QUICK_START_BOOKLET_EXAMPLE_IDS);

  function isQuickStartBookletExampleId(id) {
    return QUICK_START_BOOKLET_EXAMPLE_ID_SET.has(String(id || ''));
  }

  const SERIALIZED_GALLERY = Object.freeze([
    Object.freeze({
      id: 'quickstart-damped-oscillation',
      title: 'Quickstart damped oscillation',
      category: 'dynamic system',
      description: 'Two-integrator damped oscillator serialized as patch JSON.',
      defaultMode: 'REPF',
      patch: patch(
        'THAT quickstart damped oscillation prototype',
        'Serialized block-level patch for the THAT quickstart damped oscillator.',
        [
          { id: 'PLUS1' }, { id: 'I1' }, { id: 'I2' }, { id: 'INV1' },
          { id: 'P1', coefficient: 0.5, label: 'P1 spring coefficient k' },
          { id: 'P2', coefficient: 0.5, label: 'P2 damping coefficient d' },
          { id: 'SUM1' },
          { id: 'P3', coefficient: 0.5, label: 'P3 inverse mass 1/m' },
          { id: 'OUT_X', label: 'X / velocity' }, { id: 'OUT_Y', label: 'Y / position' },
        ],
        [
          { from: 'PLUS1.out', to: 'I1.ic' },
          { from: 'P3.out', to: 'I1.in1' }, { from: 'I1.out', to: 'I2.in1' },
          { from: 'I1.out', to: 'INV1.in' }, { from: 'I2.out', to: 'P1.in' },
          { from: 'INV1.out', to: 'P2.in' }, { from: 'P1.out', to: 'SUM1.in1' },
          { from: 'P2.out', to: 'SUM1.in2' }, { from: 'SUM1.out', to: 'P3.in' },
          { from: 'INV1.out', to: 'OUT_X.in' }, { from: 'I2.out', to: 'OUT_Y.in' },
        ],
        { velocity: 'OUT_X.out', position: 'OUT_Y.out' },
        { k: 0.5, d: 0.5, invMass: 0.5 },
      ),
    }),
    Object.freeze({
      id: 'first-steps-radioactive-decay',
      title: 'First Steps: Radioactive Decay',
      category: 'First Steps application',
      description: 'Section 9.1 exponential decay: P1 sets N0, P2 sets lambda, I1 carries -N, INV1 sends N to OUT X.',
      defaultMode: 'REPF',
      patch: patch(
        'First Steps: Radioactive Decay',
        'Exact block-level translation of the First Steps radioactive decay patch: Ndot = -lambda N.',
        [
          { id: 'PLUS1' },
          { id: 'I1', label: 'Integrator / -N' },
          { id: 'INV1', label: 'Inverter / N' },
          { id: 'P1', coefficient: 0.5, label: 'P1 initial sample N0' },
          { id: 'P2', coefficient: 0.5, label: 'P2 decay coefficient lambda' },
          { id: 'OUT_X', label: 'X / decay curve N' },
        ],
        [
          { from: 'PLUS1.out', to: 'P1.in', label: '+1 into P1 so the coefficient knob sets N0' },
          { from: 'P1.out', to: 'I1.ic', label: 'IC input sets I1.out to -N0' },
          { from: 'I1.out', to: 'P2.in', label: 'feedback of -N through lambda coefficient' },
          { from: 'P2.out', to: 'I1.in1', label: 'lambda*(-N) into the inverting integrator gives decay' },
          { from: 'I1.out', to: 'INV1.in', label: 'recover positive N for display' },
          { from: 'INV1.out', to: 'OUT_X.in', label: 'decay curve to OUT X' },
        ],
        { x: 'OUT_X.out', n: 'OUT_X.out', minusN: 'I1.out', lambdaInput: 'P2.out' },
        { firstStepsExampleId: 'first-steps-radioactive-decay', page: 15, equation: 'Ndot = -lambda*N', n0: 0.5, lambda: 0.5, expectedInitialN: 0.5, expectedNAtT4: 0.06766764161830635 },
      ),
    }),
    Object.freeze({
      id: 'first-steps-mass-spring-damper',
      title: 'First Steps: Mass-Spring-Damper System',
      category: 'First Steps application',
      description: 'Section 9.2 underdamped suspension: P1 sets y0, P2/P3/P4 set s, D, and 1/m, I2 sends displacement to OUT X.',
      defaultMode: 'REPF',
      patch: patch(
        'First Steps: Mass-Spring-Damper System',
        'Exact block-level translation of First Steps Section 9.2: yddot = (1/m) * (-(D*ydot + s*y)).',
        [
          { id: 'MINUS1' }, { id: 'ZERO' },
          { id: 'I1', rate: 1000, label: 'Integrator / -ydot' },
          { id: 'I2', rate: 1000, label: 'Integrator / y' },
          { id: 'INV1', label: 'Inverter / ydot' },
          { id: 'SUM1', label: 'Summer / -(D*ydot + s*y)' },
          { id: 'P1', coefficient: 0.5, label: 'P1 initial displacement y0' },
          { id: 'P2', coefficient: 0.5, label: 'P2 spring coefficient s' },
          { id: 'P3', coefficient: 0.05, label: 'P3 damping coefficient D' },
          { id: 'P4', coefficient: 0.5, label: 'P4 inverse mass 1/m' },
          { id: 'OUT_X', label: 'X / displacement y' }, { id: 'OUT_Y', label: 'Y / velocity ydot' },
        ],
        [
          { from: 'ZERO.out', to: 'I1.ic', label: 'zero initial velocity: I1.out starts at -ydot = 0' },
          { from: 'MINUS1.out', to: 'P1.in', label: '-1 into P1 gives -y0 for the inverting IC socket' },
          { from: 'P1.out', to: 'I2.ic', label: 'initialize I2.out to positive displacement y0' },
          { from: 'P4.out', to: 'I1.in1', label: 'acceleration yddot enters the first inverting integrator' },
          { from: 'I1.out', to: 'I2.in1', label: '-ydot into the second inverting integrator yields displacement y' },
          { from: 'I1.out', to: 'INV1.in', label: 'invert -ydot to recover positive velocity ydot' },
          { from: 'I2.out', to: 'P2.in', label: 'scale displacement by spring coefficient s' },
          { from: 'INV1.out', to: 'P3.in', label: 'scale velocity by damping coefficient D' },
          { from: 'P2.out', to: 'SUM1.in1', label: 'spring force term s*y' },
          { from: 'P3.out', to: 'SUM1.in2', label: 'damper force term D*ydot' },
          { from: 'SUM1.out', to: 'P4.in', label: 'negated force sum scaled by inverse mass' },
          { from: 'I2.out', to: 'OUT_X.in', label: 'displacement output to OUT X' },
          { from: 'INV1.out', to: 'OUT_Y.in', label: 'velocity output to OUT Y for diagnostics' },
        ],
        { x: 'OUT_X.out', y: 'OUT_X.out', displacement: 'OUT_X.out', velocity: 'OUT_Y.out', minusVelocity: 'I1.out', forceSum: 'SUM1.out', acceleration: 'P4.out' },
        { firstStepsExampleId: 'first-steps-mass-spring-damper', page: 16, equation: 'yddot = inverseMass * (-(damping*ydot + spring*y))', y0: 0.5, v0: 0, spring: 0.5, damping: 0.05, inverseMass: 0.5, integratorRate: 1000, opTimeSeconds: 0.08, normalizedTimeAtOpTime: 80, expectedInitialDisplacement: 0.5, expectedDisplacementAt80ms: -0.11748783735605553 },
      ),
    }),
    Object.freeze({
      id: 'first-steps-lunar-landing',
      title: 'First Steps: Lunar Landing',
      category: 'First Steps application',
      description: 'Section 9.3 powered lunar descent: P1 throttle, altitude on OUT X, vertical velocity on OUT Y, and fuel on OUT U.',
      defaultMode: 'OP',
      patch: Object.freeze({
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps: Lunar Landing",
      "description": "Booklet-style active-block translation of First Steps Section 9.3. P1 is the descent-engine throttle, CMP1 disables thrust when fuel is empty, CMP2 prevents below-ground altitude integration, OUT X carries altitude h, OUT Y vertical velocity v, and OUT U fuel F.",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "MINUS1"
            },
            {
                  "id": "ZERO"
            },
            {
                  "id": "I1",
                  "label": "Integrator / vertical velocity v"
            },
            {
                  "id": "I2",
                  "rate": 159.99999999999997,
                  "label": "Integrator / altitude h"
            },
            {
                  "id": "I3",
                  "label": "Integrator / fuel level F"
            },
            {
                  "id": "SUM1",
                  "label": "Summer / T - g, inverted by I1 to vdot = g - T"
            },
            {
                  "id": "INV1",
                  "label": "Inverter / -T thrust term"
            },
            {
                  "id": "INV2",
                  "label": "Inverter / -v for altitude integration"
            },
            {
                  "id": "CMP1",
                  "label": "Comparator / fuel-positive thrust gate"
            },
            {
                  "id": "CMP2",
                  "label": "Comparator / altitude-positive motion gate"
            },
            {
                  "id": "P1",
                  "coefficient": 0.5,
                  "timeProfile": {
                        "kind": "linear-points",
                        "scale": "multiplier",
                        "repeat": false,
                        "points": [
                              {
                                    "t": 0,
                                    "value": 1.44
                              },
                              {
                                    "t": 5,
                                    "value": 1.44
                              },
                              {
                                    "t": 5.8,
                                    "value": 0.04
                              },
                              {
                                    "t": 7.2,
                                    "value": 0.04
                              },
                              {
                                    "t": 8,
                                    "value": 1
                              },
                              {
                                    "t": 10,
                                    "value": 1
                              }
                        ]
                  },
                  "label": "P1 descent-engine throttle / booklet demonstration profile"
            },
            {
                  "id": "P2",
                  "coefficient": 0.1,
                  "label": "P2 thrust scale 0.1"
            },
            {
                  "id": "P3",
                  "coefficient": 0.05,
                  "label": "P3 lunar gravity stage 0.05"
            },
            {
                  "id": "P4",
                  "coefficient": 0.05,
                  "label": "P4 lunar gravity stage 0.05"
            },
            {
                  "id": "P5",
                  "coefficient": 0.5,
                  "label": "P5 fuel efficiency alpha"
            },
            {
                  "id": "P6",
                  "coefficient": 0.05,
                  "label": "P6 altitude path scale 0.05"
            },
            {
                  "id": "P7",
                  "coefficient": 0.05,
                  "label": "P7 altitude path scale 0.05"
            },
            {
                  "id": "OUT_X",
                  "label": "X / altitude h"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / vertical velocity v"
            },
            {
                  "id": "OUT_Z",
                  "label": "Z / available thrust T"
            },
            {
                  "id": "OUT_U",
                  "label": "U / fuel level F"
            }
      ],
      "cables": [
            {
                  "from": "PLUS1.out",
                  "to": "P1.in",
                  "label": "P1 is the pilot throttle coefficient; the preset uses a booklet-shaped demonstration profile"
            },
            {
                  "from": "P1.out",
                  "to": "P2.in",
                  "label": "scale throttle to the booklet T = 0.1 * P1 range"
            },
            {
                  "from": "PLUS1.out",
                  "to": "P3.in",
                  "label": "first 0.05 gravity stage"
            },
            {
                  "from": "P3.out",
                  "to": "P4.in",
                  "label": "second 0.05 gravity stage"
            },
            {
                  "from": "MINUS1.out",
                  "to": "I2.ic",
                  "label": "initialize altitude h to +1 through THAT IC sign convention"
            },
            {
                  "from": "MINUS1.out",
                  "to": "I3.ic",
                  "label": "initialize fuel F to +1 through THAT IC sign convention"
            },
            {
                  "from": "I3.out",
                  "to": "CMP1.a",
                  "label": "fuel level tests whether thrust is still available"
            },
            {
                  "from": "ZERO.out",
                  "to": "CMP1.b",
                  "label": "fuel-positive threshold at zero"
            },
            {
                  "from": "P2.out",
                  "to": "CMP1.positive",
                  "label": "thrust branch while fuel remains"
            },
            {
                  "from": "ZERO.out",
                  "to": "CMP1.nonPositive",
                  "label": "no thrust when fuel is depleted"
            },
            {
                  "from": "CMP1.out",
                  "to": "INV1.in",
                  "label": "available thrust T"
            },
            {
                  "from": "P4.out",
                  "to": "SUM1.in10_1",
                  "label": "gravity stage through x10 input, first half"
            },
            {
                  "from": "P4.out",
                  "to": "SUM1.in10_2",
                  "label": "gravity stage through x10 input, second half"
            },
            {
                  "from": "INV1.out",
                  "to": "SUM1.in2",
                  "label": "-T term so SUM1.out is T - g"
            },
            {
                  "from": "SUM1.out",
                  "to": "I1.in1",
                  "label": "I1 inversion yields vdot = g - T"
            },
            {
                  "from": "CMP1.out",
                  "to": "P5.in",
                  "label": "fuel burn is proportional to available thrust"
            },
            {
                  "from": "P5.out",
                  "to": "I3.in1",
                  "label": "I3 inversion gives Fdot = -alpha*T"
            },
            {
                  "from": "I1.out",
                  "to": "INV2.in",
                  "label": "invert v to feed an inverting altitude integrator"
            },
            {
                  "from": "I2.out",
                  "to": "CMP2.a",
                  "label": "altitude-positive touchdown test"
            },
            {
                  "from": "ZERO.out",
                  "to": "CMP2.b",
                  "label": "ground threshold"
            },
            {
                  "from": "INV2.out",
                  "to": "CMP2.positive",
                  "label": "while h > 0, feed -v so I2 derivative is scaled v"
            },
            {
                  "from": "ZERO.out",
                  "to": "CMP2.nonPositive",
                  "label": "after touchdown, hold altitude"
            },
            {
                  "from": "CMP2.out",
                  "to": "P6.in",
                  "label": "first 0.05 altitude scaling stage from the booklet patch"
            },
            {
                  "from": "P6.out",
                  "to": "P7.in",
                  "label": "second 0.05 altitude scaling stage from the booklet patch"
            },
            {
                  "from": "P7.out",
                  "to": "I2.in1",
                  "label": "scaled altitude integration path"
            },
            {
                  "from": "I2.out",
                  "to": "OUT_X.in",
                  "label": "altitude h to OUT X"
            },
            {
                  "from": "I1.out",
                  "to": "OUT_Y.in",
                  "label": "vertical velocity v to OUT Y"
            },
            {
                  "from": "CMP1.out",
                  "to": "OUT_Z.in",
                  "label": "available thrust to OUT Z for diagnostics"
            },
            {
                  "from": "I3.out",
                  "to": "OUT_U.in",
                  "label": "fuel level F to OUT U / panel-meter equivalent"
            }
      ],
      "outputs": {
            "x": "OUT_X.out",
            "y": "OUT_Y.out",
            "u": "OUT_U.out",
            "altitude": "OUT_X.out",
            "velocity": "OUT_Y.out",
            "thrust": "OUT_Z.out",
            "fuel": "OUT_U.out",
            "gravity": "P4.out",
            "fuelBurn": "P5.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-lunar-landing",
            "page": 17,
            "equation": "vdot = g - T; hdot = v; Fdot = -alpha*T, with comparator gates for fuel and touchdown",
            "scopePreset": "roll",
            "throttle": 0.5,
            "throttleProfile": {
                  "kind": "linear-points",
                  "scale": "multiplier",
                  "repeat": false,
                  "points": [
                        {
                              "t": 0,
                              "value": 1.44
                        },
                        {
                              "t": 5,
                              "value": 1.44
                        },
                        {
                              "t": 5.8,
                              "value": 0.04
                        },
                        {
                              "t": 7.2,
                              "value": 0.04
                        },
                        {
                              "t": 8,
                              "value": 1
                        },
                        {
                              "t": 10,
                              "value": 1
                        }
                  ]
            },
            "thrustScale": 0.1,
            "gravity": 0.05,
            "gravityStage": 0.05,
            "initialVelocity": 0,
            "initialAltitude": 1,
            "initialFuel": 1,
            "altitudeCoefficientA": 0.05,
            "altitudeCoefficientB": 0.05,
            "altitudeScale": 0.4,
            "altitudeIntegratorRate": 159.99999999999997,
            "fuelEfficiency": 0.5,
            "duration": 10,
            "coefficients": {
                  "P1": 0.5,
                  "P2": 0.1,
                  "P3": 0.05,
                  "P4": 0.05,
                  "P5": 0.5,
                  "P6": 0.05,
                  "P7": 0.05
            },
            "expectedFinalAt10s": {
                  "velocity": 0.0879999999999944,
                  "altitude": 0.8327199999999896,
                  "fuel": 0.7940000000001993,
                  "thrust": 0.002,
                  "touchdownTime": null,
                  "fuelEmptyTime": null
            }
      }
}),
    }),
    Object.freeze({
      id: 'first-steps-neuronal-bursting',
      title: 'First Steps: Neuronal Bursting',
      category: 'First Steps application',
      description: 'Section 9.4 scaled Hindmarsh-Rose neuronal bursting patch with x10-weighted x/y equations, x on OUT X, y on OUT Y, -z on OUT Z, XIR/SJ input extension, and SLOW z-channel behavior.',
      defaultMode: 'OP',
      patch: {
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps: Neuronal Bursting",
      "description": "Booklet-style active-block translation of First Steps Section 9.4 using the scaled Hindmarsh-Rose equations. I1 carries scaled membrane output x, I2 carries y, I3 carries -z in SLOW mode, MUL1/MUL2 generate x^2/x^3, and OUT X/Y/Z expose x, y, and -z.",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "MINUS1"
            },
            {
                  "id": "ZERO"
            },
            {
                  "id": "I1",
                  "rate": 50,
                  "label": "Integrator / scaled x membrane output"
            },
            {
                  "id": "I2",
                  "rate": 50,
                  "label": "Integrator / scaled y fast-ion channel state"
            },
            {
                  "id": "I3",
                  "rate": 50,
                  "slowFactor": 100,
                  "label": "SLOW integrator / -z slow-channel state"
            },
            {
                  "id": "MUL1",
                  "label": "Multiplier / x^2"
            },
            {
                  "id": "MUL2",
                  "label": "Multiplier / x^3"
            },
            {
                  "id": "SUM1",
                  "label": "Summer / scaled -xdot drive"
            },
            {
                  "id": "SUM2",
                  "label": "Summer / scaled -ydot drive"
            },
            {
                  "id": "XIR1",
                  "label": "XIR helper / Iext summing-junction input"
            },
            {
                  "id": "XIR2",
                  "label": "XIR helper / slow z summing-junction inputs"
            },
            {
                  "id": "INV1",
                  "label": "Inverter / -a*10*x^3 preweighted term"
            },
            {
                  "id": "INV2",
                  "label": "Inverter / -d*10*x^2 preweighted term"
            },
            {
                  "id": "INV3",
                  "label": "Inverter / -y"
            },
            {
                  "id": "INV4",
                  "label": "Inverter / z display"
            },
            {
                  "id": "P1",
                  "coefficient": 0.6,
                  "label": "P1 b*10 coefficient shown as 0.6"
            },
            {
                  "id": "P2",
                  "coefficient": 0.4,
                  "label": "P2 a*10 coefficient shown as 0.4"
            },
            {
                  "id": "P3",
                  "coefficient": 0.75,
                  "label": "P3 0.75*y term into x equation"
            },
            {
                  "id": "P4",
                  "coefficient": 0.1,
                  "label": "P4 100r coefficient"
            },
            {
                  "id": "P5",
                  "coefficient": 0.4,
                  "label": "P5 100rs coefficient"
            },
            {
                  "id": "P6",
                  "coefficient": 0.32,
                  "label": "P6 100rs*xr offset magnitude"
            },
            {
                  "id": "P7",
                  "coefficient": 0.066,
                  "label": "P7 c coefficient"
            },
            {
                  "id": "P8",
                  "coefficient": 0.133,
                  "label": "P8 d*10 coefficient shown as 0.133"
            },
            {
                  "id": "OUT_X",
                  "label": "X / neuronal burst output x"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / y channel state"
            },
            {
                  "id": "OUT_Z",
                  "label": "Z / -z slow channel"
            },
            {
                  "id": "OUT_U",
                  "label": "U / z display"
            }
      ],
      "cables": [
            {
                  "from": "MINUS1.out",
                  "to": "I1.ic",
                  "label": "-1 on IC initializes I1.out to x = +1"
            },
            {
                  "from": "ZERO.out",
                  "to": "I2.ic",
                  "label": "initialize y to zero"
            },
            {
                  "from": "PLUS1.out",
                  "to": "I3.ic",
                  "label": "+1 on IC initializes I3.out to -z = -1"
            },
            {
                  "from": "I1.out",
                  "to": "MUL1.x",
                  "label": "x into x^2 multiplier"
            },
            {
                  "from": "I1.out",
                  "to": "MUL1.y",
                  "label": "x into x^2 multiplier"
            },
            {
                  "from": "MUL1.out",
                  "to": "MUL2.x",
                  "label": "x^2 into x^3 multiplier"
            },
            {
                  "from": "I1.out",
                  "to": "MUL2.y",
                  "label": "x into x^3 multiplier"
            },
            {
                  "from": "MUL1.out",
                  "to": "P1.in",
                  "label": "x^2 scaled by b*10=0.6 before x10 input gives 6*x^2"
            },
            {
                  "from": "MUL2.out",
                  "to": "P2.in",
                  "label": "x^3 scaled by a*10=0.4 before x10 input gives 4*x^3"
            },
            {
                  "from": "P2.out",
                  "to": "INV1.in",
                  "label": "invert a*10*x^3 to form the negative cubic term"
            },
            {
                  "from": "INV1.out",
                  "to": "SUM1.in10_1",
                  "label": "x10 input implements -4*x^3"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in10_2",
                  "label": "x10 input implements +6*x^2"
            },
            {
                  "from": "I2.out",
                  "to": "P3.in",
                  "label": "scale y by 0.75 before x10 input"
            },
            {
                  "from": "P3.out",
                  "to": "SUM1.in10_3",
                  "label": "x10 input implements +7.5*y"
            },
            {
                  "from": "I3.out",
                  "to": "SUM1.in1",
                  "label": "-z term, represented by I3.out"
            },
            {
                  "from": "PLUS1.out",
                  "to": "XIR1.in1",
                  "label": "Iext = +1 input can be disconnected in the physical exercise"
            },
            {
                  "from": "XIR1.out",
                  "to": "SUM1.sj",
                  "label": "add Iext through the summing-junction helper"
            },
            {
                  "from": "SUM1.out",
                  "to": "I1.in1",
                  "label": "SUM1 emits -xdot for the inverting x integrator"
            },
            {
                  "from": "PLUS1.out",
                  "to": "P7.in",
                  "label": "constant c"
            },
            {
                  "from": "MUL1.out",
                  "to": "P8.in",
                  "label": "x^2 scaled by d*10=0.133 before x10 input gives about 1.33*x^2"
            },
            {
                  "from": "P8.out",
                  "to": "INV2.in",
                  "label": "invert d*10*x^2 to form the negative y-equation term"
            },
            {
                  "from": "I2.out",
                  "to": "INV3.in",
                  "label": "invert y to form -y"
            },
            {
                  "from": "P7.out",
                  "to": "SUM2.in1",
                  "label": "c term"
            },
            {
                  "from": "INV2.out",
                  "to": "SUM2.in10_1",
                  "label": "x10 input implements -1.33*x^2"
            },
            {
                  "from": "INV3.out",
                  "to": "SUM2.in2",
                  "label": "-y term"
            },
            {
                  "from": "SUM2.out",
                  "to": "I2.in1",
                  "label": "SUM2 emits -ydot for the inverting y integrator"
            },
            {
                  "from": "I1.out",
                  "to": "P5.in",
                  "label": "x scaled by 100rs before SLOW division"
            },
            {
                  "from": "P5.out",
                  "to": "I3.in1",
                  "label": "100rs*x contribution to the -z slow integrator input"
            },
            {
                  "from": "PLUS1.out",
                  "to": "P6.in",
                  "label": "100rs*xr offset magnitude"
            },
            {
                  "from": "I3.out",
                  "to": "P4.in",
                  "label": "-z scaled by 100r before SLOW division"
            },
            {
                  "from": "P6.out",
                  "to": "XIR2.in1",
                  "label": "offset contribution for the slow z equation"
            },
            {
                  "from": "P4.out",
                  "to": "XIR2.in2",
                  "label": "100r*(-z) damping contribution"
            },
            {
                  "from": "XIR2.out",
                  "to": "I3.sj",
                  "label": "combine slow z offset and damping through summing junction"
            },
            {
                  "from": "I3.out",
                  "to": "I3.slow",
                  "label": "output-to-SLOW feedback activates the 0.01 speed scale"
            },
            {
                  "from": "I3.out",
                  "to": "INV4.in",
                  "label": "recover positive z for diagnostics"
            },
            {
                  "from": "I1.out",
                  "to": "OUT_X.in",
                  "label": "neuronal burst output x to OUT X"
            },
            {
                  "from": "I2.out",
                  "to": "OUT_Y.in",
                  "label": "y state to OUT Y"
            },
            {
                  "from": "I3.out",
                  "to": "OUT_Z.in",
                  "label": "-z state to OUT Z"
            },
            {
                  "from": "INV4.out",
                  "to": "OUT_U.in",
                  "label": "positive z to OUT U"
            }
      ],
      "outputs": {
            "x": "OUT_X.out",
            "y": "OUT_Y.out",
            "minusZ": "OUT_Z.out",
            "z": "OUT_U.out",
            "x2": "MUL1.out",
            "x3": "MUL2.out",
            "xCubicTerm": "INV1.out",
            "yEquationDrive": "SUM2.out",
            "iExt": "XIR1.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-neuronal-bursting",
            "page": 18,
            "equation": "xdot = -4*x^3 + 6*x^2 + 7.5*y - z + Iext; ydot = -1.33*x^2 + c - y; zdot = 0.004*x + 0.0032 - z/1000",
            "scopePreset": "time-x",
            "x0": 1,
            "y0": 0,
            "z0": 1,
            "minusZ0": -1,
            "bStar10": 0.6,
            "aStar10": 0.4,
            "yToX10": 0.75,
            "c": 0.066,
            "dStar10": 0.133,
            "hundredR": 0.1,
            "hundredRs": 0.4,
            "hundredRsXr": 0.32,
            "iExt": 1,
            "slowFactor": 100,
            "timeScale": 50,
            "duration": 40,
            "coefficients": {
                  "P1": 0.6,
                  "P2": 0.4,
                  "P3": 0.75,
                  "P4": 0.1,
                  "P5": 0.4,
                  "P6": 0.32,
                  "P7": 0.066,
                  "P8": 0.133
            },
            "expectedFinalAt40s": {
                  "x": -0.23798707930618868,
                  "y": -0.2969329545427756,
                  "minusZ": -0.9022592524298505,
                  "z": 0.9022592524298505,
                  "maxAbs": {
                        "x": 1.1668120240929403,
                        "y": 0.8170538343071003,
                        "minusZ": 1.0620368419387158
                  },
                  "peakCount": 38
            }
      }
},
    }),
    Object.freeze({
      id: 'first-steps-euler-spiral',
      title: 'First Steps: Euler Spiral',
      category: 'First Steps application',
      description: 'Section 9.5 Euler spiral: normalized tau sweep, OP-TIME-aware phase centering, and two-arm X/Y output trace.',
      defaultMode: 'REPF',
      patch: {
        "schemaVersion": "analog-thing-patch/v1",
        "inventory": "that-prototype-board/v006",
        "name": "First Steps: Euler Spiral",
        "description": "Booklet-style active-block translation of First Steps Section 9.5. I1 generates a normalized tau sweep, I2/I3 form a variable-frequency quadrature oscillator, and I4/I5 integrate the quadrature pair to OUT X/Y. The preset auto-centers the phase and coordinate initial states for the selected OP-TIME so the X/Y display shows both point-symmetric Euler spiral arms.",
        "components": [
                {
                        "id": "PLUS1"
                },
                {
                        "id": "MINUS1"
                },
                {
                        "id": "ZERO"
                },
                {
                        "id": "I1",
                        "initialState": -1,
                        "label": "Integrator / normalized tau ramp"
                },
                {
                        "id": "I2",
                        "rate": 0.6,
                        "initialState": 0.6603167082440802,
                        "label": "Integrator / cos(tau^2/2) approximation"
                },
                {
                        "id": "I3",
                        "rate": 0.6,
                        "initialState": 0.7509872467716762,
                        "label": "Integrator / -sin(tau^2/2) approximation"
                },
                {
                        "id": "I4",
                        "rate": 0.05,
                        "initialState": -0.227496485419856,
                        "label": "Integrator / x spiral coordinate, centered initial value"
                },
                {
                        "id": "I5",
                        "rate": 0.05,
                        "initialState": -0.2339582398432739,
                        "label": "Integrator / y spiral coordinate, centered initial value"
                },
                {
                        "id": "INV1",
                        "label": "Inverter / sin(tau^2/2)"
                },
                {
                        "id": "INV2",
                        "label": "Inverter / -scaled cos for x integrator"
                },
                {
                        "id": "MUL1",
                        "label": "Multiplier / tau*sin"
                },
                {
                        "id": "MUL2",
                        "label": "Multiplier / tau*cos"
                },
                {
                        "id": "P1",
                        "coefficient": 0.016666666666666666,
                        "label": "P1 normalized tau ramp rate"
                },
                {
                        "id": "P2",
                        "coefficient": 0.6,
                        "label": "P2 x scale"
                },
                {
                        "id": "P3",
                        "coefficient": 0.6603167082440802,
                        "label": "P3 displayed cos initial magnitude"
                },
                {
                        "id": "P4",
                        "coefficient": 0.7509872467716762,
                        "label": "P4 displayed -sin initial magnitude"
                },
                {
                        "id": "P5",
                        "coefficient": 0.6,
                        "label": "P5 y scale"
                },
                {
                        "id": "OUT_X",
                        "label": "X / Euler spiral x"
                },
                {
                        "id": "OUT_Y",
                        "label": "Y / Euler spiral y"
                }
        ],
        "cables": [
                {
                        "from": "MINUS1.out",
                        "to": "P1.in",
                        "label": "-1 through P1 makes normalized tau ramp upward"
                },
                {
                        "from": "P1.out",
                        "to": "I1.in1",
                        "label": "normalized tau derivative is +P1"
                },
                {
                        "from": "PLUS1.out",
                        "to": "P3.in",
                        "label": "feed displayed cosine IC magnitude control"
                },
                {
                        "from": "PLUS1.out",
                        "to": "P4.in",
                        "label": "feed displayed sine IC magnitude control"
                },
                {
                        "from": "I3.out",
                        "to": "INV1.in",
                        "label": "recover sin-like signal from I3.out = -sin"
                },
                {
                        "from": "I1.out",
                        "to": "MUL1.x",
                        "label": "normalized tau into first multiplier"
                },
                {
                        "from": "INV1.out",
                        "to": "MUL1.y",
                        "label": "sin-like signal into first multiplier"
                },
                {
                        "from": "MUL1.out",
                        "to": "I2.in1",
                        "label": "tau*sin drives cos derivative through the inverting integrator"
                },
                {
                        "from": "I1.out",
                        "to": "MUL2.x",
                        "label": "normalized tau into second multiplier"
                },
                {
                        "from": "I2.out",
                        "to": "MUL2.y",
                        "label": "cos-like signal into second multiplier"
                },
                {
                        "from": "MUL2.out",
                        "to": "I3.in1",
                        "label": "tau*cos drives -sin derivative through the inverting integrator"
                },
                {
                        "from": "I2.out",
                        "to": "P2.in",
                        "label": "scale cos-like signal for x integration"
                },
                {
                        "from": "P2.out",
                        "to": "INV2.in",
                        "label": "invert scaled cos so the inverting x integrator advances positively"
                },
                {
                        "from": "INV2.out",
                        "to": "I4.in1",
                        "label": "x integrates scaled cos"
                },
                {
                        "from": "I3.out",
                        "to": "P5.in",
                        "label": "scale -sin-like signal for y integration"
                },
                {
                        "from": "P5.out",
                        "to": "I5.in1",
                        "label": "y integrates scaled sin because I5 is inverting"
                },
                {
                        "from": "I4.out",
                        "to": "OUT_X.in",
                        "label": "spiral x coordinate to OUT X"
                },
                {
                        "from": "I5.out",
                        "to": "OUT_Y.in",
                        "label": "spiral y coordinate to OUT Y"
                }
        ],
        "outputs": {
                "x": "OUT_X.out",
                "y": "OUT_Y.out",
                "tau": "I1.out",
                "cos": "I2.out",
                "minusSin": "I3.out",
                "sin": "INV1.out"
        },
        "parameters": {
                "firstStepsExampleId": "first-steps-euler-spiral",
                "page": 19,
                "equation": "x(t)=integral cos(tau^2/2) dtau, y(t)=integral sin(tau^2/2) dtau",
                "scopePreset": "time",
                "tauRate": 0.1,
                "tauSpan": 6,
                "normalizedTauSweep": true,
                "eulerSpiralAutoCenterForRun": true,
                "rampRate": 0.016666666666666666,
                "oscillatorRate": 0.6,
                "xScale": 0.6,
                "cos0": 0.6603167082440802,
                "minusSin0": 0.7509872467716762,
                "minusSinMagnitude0": 0.7509872467716762,
                "yScale": 0.6,
                "coordinateRate": 0.05,
                "opTimeSeconds": 120,
                "coefficients": {
                        "P1": 0.016666666666666666,
                        "P2": 0.6,
                        "P3": 0.6603167082440802,
                        "P4": 0.7509872467716762,
                        "P5": 0.6
                },
                "centeredInitial": {
                        "x0": -0.227496485419856,
                        "y0": -0.2339582398432739,
                        "expectedCenteredFinalX": 0.227496485419856,
                        "expectedCenteredFinalY": 0.2339582398432739
                },
                "centeredSweep": {
                        "opTimeSeconds": 120,
                        "tauRate": 0.1,
                        "tauSpan": 6,
                        "normalizedTauStart": -1,
                        "normalizedTauEnd": 1,
                        "rampRate": 0.016666666666666666,
                        "oscillatorRate": 0.6,
                        "coordinateRate": 0.05,
                        "xScale": 0.6,
                        "yScale": 0.6,
                        "cos0": 0.6603167082440802,
                        "minusSin0": 0.7509872467716762,
                        "x0": -0.227496485419856,
                        "y0": -0.2339582398432739,
                        "expectedCenteredFinalX": 0.227496485419856,
                        "expectedCenteredFinalY": 0.2339582398432739
                },
                "expectedFinalAtDefaultOpTime": {
                        "tau": 0.9999999999997894,
                        "cos": 0.6603167082383918,
                        "minusSin": 0.7509872467766892,
                        "x": 0.2274964854212502,
                        "y": 0.23395823984297467
                },
                "expectedFinalAt20s": {
                        "tau": 0.9999999999997894,
                        "cos": 0.6603167082383918,
                        "minusSin": 0.7509872467766892,
                        "x": 0.2274964854212502,
                        "y": 0.23395823984297467
                }
        }
},
    }),
    Object.freeze({
      id: 'first-steps-hunter-prey',
      title: 'First Steps: Hunter/Prey Population Dynamics',
      category: 'First Steps application',
      description: 'Section 9.6 Lotka-Volterra hare/lynx dynamics with h on OUT X and l on OUT Y; default display is the booklet roll-mode time trace, with X/Y phase view available manually.',
      defaultMode: 'OP',
      patch: {
        "schemaVersion": "analog-thing-patch/v1",
        "inventory": "that-prototype-board/v006",
        "name": "First Steps: Hunter/Prey Population Dynamics",
        "description": "Booklet-style Lotka-Volterra active-block patch from First Steps Section 9.6. I1 carries hare population h, I2 carries lynx population l, MUL1 computes h*l, and OUT X/Y provide the roll-mode time traces; the same two outputs can still be switched to X/Y for phase-space exploration.",
        "components": [
                {
                        "id": "MINUS1"
                },
                {
                        "id": "I1",
                        "label": "Integrator / hare population h"
                },
                {
                        "id": "I2",
                        "label": "Integrator / lynx population l"
                },
                {
                        "id": "MUL1",
                        "label": "Multiplier / h*l interaction"
                },
                {
                        "id": "SUM1",
                        "label": "Summer / -h_dot input"
                },
                {
                        "id": "SUM2",
                        "label": "Summer / -l_dot input"
                },
                {
                        "id": "INV1",
                        "label": "Inverter / -beta*h*l"
                },
                {
                        "id": "INV2",
                        "label": "Inverter / -gamma*l"
                },
                {
                        "id": "P1",
                        "coefficient": 0.6,
                        "label": "P1 initial hare population h0"
                },
                {
                        "id": "P2",
                        "coefficient": 0.6,
                        "label": "P2 initial lynx population l0"
                },
                {
                        "id": "P3",
                        "coefficient": 0.365,
                        "label": "P3 hare growth alpha"
                },
                {
                        "id": "P4",
                        "coefficient": 0.95,
                        "label": "P4 predation beta"
                },
                {
                        "id": "P5",
                        "coefficient": 0.09,
                        "label": "P5 lynx death gamma"
                },
                {
                        "id": "P6",
                        "coefficient": 0.84,
                        "label": "P6 lynx growth delta"
                },
                {
                        "id": "OUT_X",
                        "label": "X / hare population h"
                },
                {
                        "id": "OUT_Y",
                        "label": "Y / lynx population l"
                }
        ],
        "cables": [
                {
                        "from": "MINUS1.out",
                        "to": "P1.in",
                        "label": "-1 through P1 gives -h0 for the inverting IC socket"
                },
                {
                        "from": "P1.out",
                        "to": "I1.ic",
                        "label": "initialize I1.out to positive hare population h0"
                },
                {
                        "from": "MINUS1.out",
                        "to": "P2.in",
                        "label": "-1 through P2 gives -l0 for the inverting IC socket"
                },
                {
                        "from": "P2.out",
                        "to": "I2.ic",
                        "label": "initialize I2.out to positive lynx population l0"
                },
                {
                        "from": "I1.out",
                        "to": "MUL1.x",
                        "label": "hare population into h*l interaction multiplier"
                },
                {
                        "from": "I2.out",
                        "to": "MUL1.y",
                        "label": "lynx population into h*l interaction multiplier"
                },
                {
                        "from": "I1.out",
                        "to": "P3.in",
                        "label": "scale hare population by alpha"
                },
                {
                        "from": "MUL1.out",
                        "to": "P4.in",
                        "label": "scale interaction by beta"
                },
                {
                        "from": "P4.out",
                        "to": "INV1.in",
                        "label": "invert beta*h*l for the hare equation"
                },
                {
                        "from": "P3.out",
                        "to": "SUM1.in1",
                        "label": "alpha*h term"
                },
                {
                        "from": "INV1.out",
                        "to": "SUM1.in2",
                        "label": "-beta*h*l term"
                },
                {
                        "from": "SUM1.out",
                        "to": "I1.in1",
                        "label": "summer output is -h_dot, so the inverting integrator advances h_dot"
                },
                {
                        "from": "MUL1.out",
                        "to": "P6.in",
                        "label": "scale interaction by delta"
                },
                {
                        "from": "I2.out",
                        "to": "P5.in",
                        "label": "scale lynx population by gamma"
                },
                {
                        "from": "P5.out",
                        "to": "INV2.in",
                        "label": "invert gamma*l for the lynx equation"
                },
                {
                        "from": "P6.out",
                        "to": "SUM2.in1",
                        "label": "delta*h*l term"
                },
                {
                        "from": "INV2.out",
                        "to": "SUM2.in2",
                        "label": "-gamma*l term"
                },
                {
                        "from": "SUM2.out",
                        "to": "I2.in1",
                        "label": "summer output is -l_dot, so the inverting integrator advances l_dot"
                },
                {
                        "from": "I1.out",
                        "to": "OUT_X.in",
                        "label": "hare population to OUT X"
                },
                {
                        "from": "I2.out",
                        "to": "OUT_Y.in",
                        "label": "lynx population to OUT Y"
                }
        ],
        "outputs": {
                "x": "OUT_X.out",
                "y": "OUT_Y.out",
                "hare": "OUT_X.out",
                "lynx": "OUT_Y.out",
                "interaction": "MUL1.out",
                "hareGrowth": "P3.out",
                "predation": "P4.out",
                "lynxDeath": "P5.out",
                "lynxGrowth": "P6.out"
        },
        "parameters": {
                "firstStepsExampleId": "first-steps-hunter-prey",
                "page": 20,
                "equation": "h_dot = alpha*h - beta*h*l; l_dot = delta*h*l - gamma*l",
                "scopePreset": "time",
                "h0": 0.6,
                "l0": 0.6,
                "alpha": 0.365,
                "beta": 0.95,
                "gamma": 0.09,
                "delta": 0.84,
                "duration": 100,
                "coefficients": {
                        "P1": 0.6,
                        "P2": 0.6,
                        "P3": 0.365,
                        "P4": 0.95,
                        "P5": 0.09,
                        "P6": 0.84
                },
                "expectedFinalAt100s": {
                        "h": 0.024789002723988287,
                        "l": 1.0048489823043394
                }
        }
},
    }),
    Object.freeze({
      id: 'first-steps-lorenz-attractor',
      title: 'First Steps: Lorenz Attractor',
      category: 'First Steps application',
      description: 'Section 9.7 chaotic Lorenz attractor with x/y/z outputs and X/Y, Z/X, and Z/Y projection presets.',
      defaultMode: 'OP',
      patch: {
        "schemaVersion": "analog-thing-patch/v1",
        "inventory": "that-prototype-board/v006",
        "name": "First Steps: Lorenz Attractor",
        "description": "Booklet-style active-block translation of First Steps Section 9.7. I1/I2/I3 carry -x, -y, and -z; MUL1 computes x*y; SUM1 forms s = -(1 - 2.68z); MUL2 computes r = -x*s; OUT X/Y/Z provide projection-ready channels.",
        "components": [
                {
                        "id": "PLUS1"
                },
                {
                        "id": "ZERO"
                },
                {
                        "id": "I1",
                        "label": "Integrator / -x"
                },
                {
                        "id": "I2",
                        "label": "Integrator / -y"
                },
                {
                        "id": "I3",
                        "label": "Integrator / -z"
                },
                {
                        "id": "INV1",
                        "label": "Inverter / x display"
                },
                {
                        "id": "INV2",
                        "label": "Inverter / y display and x-equation drive"
                },
                {
                        "id": "INV3",
                        "label": "Inverter / z display"
                },
                {
                        "id": "MUL1",
                        "label": "Multiplier / x*y"
                },
                {
                        "id": "SUM1",
                        "label": "Summer / s = -(1 - 2.68z)"
                },
                {
                        "id": "MUL2",
                        "label": "Multiplier / r = -x*s"
                },
                {
                        "id": "P1",
                        "coefficient": 0.18,
                        "label": "P1 y-to-x coefficient 0.18, used through x10 as 1.8"
                },
                {
                        "id": "P2",
                        "coefficient": 0.15,
                        "label": "P2 xy coefficient 0.15, used through x10 as 1.5"
                },
                {
                        "id": "P3",
                        "coefficient": 0.2667,
                        "label": "P3 z damping coefficient 0.2667"
                },
                {
                        "id": "P4",
                        "coefficient": 0.268,
                        "label": "P4 z shape coefficient 0.268, used through x10 as 2.68"
                },
                {
                        "id": "P5",
                        "coefficient": 0.1536,
                        "label": "P5 r coefficient 0.1536, used through x10 as 1.536"
                },
                {
                        "id": "P6",
                        "coefficient": 0.1,
                        "label": "P6 y damping coefficient 0.1"
                },
                {
                        "id": "P7",
                        "coefficient": 0.18,
                        "label": "P7 simulator IC helper for initial x"
                },
                {
                        "id": "OUT_X",
                        "label": "X / Lorenz x"
                },
                {
                        "id": "OUT_Y",
                        "label": "Y / Lorenz y"
                },
                {
                        "id": "OUT_Z",
                        "label": "Z / Lorenz z"
                }
        ],
        "cables": [
                {
                        "from": "PLUS1.out",
                        "to": "P7.in",
                        "label": "P7 sets the nonzero x initial condition used to start the attractor"
                },
                {
                        "from": "P7.out",
                        "to": "I1.ic",
                        "label": "initialize I1.out to -x0 through the inverting IC convention"
                },
                {
                        "from": "ZERO.out",
                        "to": "I2.ic",
                        "label": "initialize y to zero"
                },
                {
                        "from": "ZERO.out",
                        "to": "I3.ic",
                        "label": "initialize z to zero"
                },
                {
                        "from": "I1.out",
                        "to": "INV1.in",
                        "label": "recover x from I1.out = -x"
                },
                {
                        "from": "I2.out",
                        "to": "INV2.in",
                        "label": "recover y from I2.out = -y"
                },
                {
                        "from": "I3.out",
                        "to": "INV3.in",
                        "label": "recover z from I3.out = -z"
                },
                {
                        "from": "I1.out",
                        "to": "I1.in1",
                        "label": "-x state supplies the +x term inside d(-x)/dt"
                },
                {
                        "from": "INV2.out",
                        "to": "P1.in",
                        "label": "scale y by 0.18 before x10 weighting"
                },
                {
                        "from": "P1.out",
                        "to": "I1.in10",
                        "label": "x10 input implements 1.8*y in the -x equation"
                },
                {
                        "from": "I1.out",
                        "to": "MUL1.x",
                        "label": "-x into xy multiplier"
                },
                {
                        "from": "I2.out",
                        "to": "MUL1.y",
                        "label": "-y into xy multiplier, product is x*y"
                },
                {
                        "from": "MUL1.out",
                        "to": "P2.in",
                        "label": "scale x*y by 0.15 before x10 weighting"
                },
                {
                        "from": "P2.out",
                        "to": "I3.in10",
                        "label": "x10 input implements 1.5*x*y in the -z equation"
                },
                {
                        "from": "I3.out",
                        "to": "P3.in",
                        "label": "scale -z by beta=0.2667 for the -z equation"
                },
                {
                        "from": "P3.out",
                        "to": "I3.in1",
                        "label": "adds -0.2667*z so I3 derivative becomes -1.5xy + 0.2667z"
                },
                {
                        "from": "I3.out",
                        "to": "P4.in",
                        "label": "scale -z by 0.268 for the s expression"
                },
                {
                        "from": "PLUS1.out",
                        "to": "SUM1.in1",
                        "label": "+1 term for s = -(1 - 2.68z)"
                },
                {
                        "from": "P4.out",
                        "to": "SUM1.in10_1",
                        "label": "x10 contribution gives -2.68z before the negating summer"
                },
                {
                        "from": "I1.out",
                        "to": "MUL2.x",
                        "label": "-x into r multiplier"
                },
                {
                        "from": "SUM1.out",
                        "to": "MUL2.y",
                        "label": "s into r multiplier so output is r = -x*s"
                },
                {
                        "from": "MUL2.out",
                        "to": "P5.in",
                        "label": "scale r by 0.1536 before x10 weighting"
                },
                {
                        "from": "P5.out",
                        "to": "I2.in10",
                        "label": "x10 input implements 1.536*r in the -y equation"
                },
                {
                        "from": "I2.out",
                        "to": "P6.in",
                        "label": "scale -y by 0.1 for the -y equation"
                },
                {
                        "from": "P6.out",
                        "to": "I2.in1",
                        "label": "adds -0.1*y before the inverting integrator"
                },
                {
                        "from": "INV1.out",
                        "to": "OUT_X.in",
                        "label": "Lorenz x to OUT X"
                },
                {
                        "from": "INV2.out",
                        "to": "OUT_Y.in",
                        "label": "Lorenz y to OUT Y"
                },
                {
                        "from": "INV3.out",
                        "to": "OUT_Z.in",
                        "label": "Lorenz z to OUT Z"
                }
        ],
        "outputs": {
                "x": "OUT_X.out",
                "y": "OUT_Y.out",
                "z": "OUT_Z.out",
                "minusX": "I1.out",
                "minusY": "I2.out",
                "minusZ": "I3.out",
                "xy": "MUL1.out",
                "s": "SUM1.out",
                "r": "MUL2.out"
        },
        "parameters": {
                "firstStepsExampleId": "first-steps-lorenz-attractor",
                "page": 21,
                "equation": "-x = - integral(1.8*y - x) dt + C; -z = - integral(1.5*x*y - 0.2667*z) dt; -y = - integral(1.536*r - 0.1*y) dt",
                "scopePreset": "time",
                "projectionPresets": {
                        "xy": [
                                "OUT_X.out",
                                "OUT_Y.out"
                        ],
                        "zx": [
                                "OUT_Z.out",
                                "OUT_X.out"
                        ],
                        "zy": [
                                "OUT_Z.out",
                                "OUT_Y.out"
                        ]
                },
                "x0": 0.18,
                "y0": 0,
                "z0": 0,
                "yToXCoefficient": 0.18,
                "xyCoefficient": 0.15,
                "zDamping": 0.2667,
                "zShapeCoefficient": 0.268,
                "rCoefficient": 0.1536,
                "yDamping": 0.1,
                "duration": 300,
                "coefficients": {
                        "P1": 0.18,
                        "P2": 0.15,
                        "P3": 0.2667,
                        "P4": 0.268,
                        "P5": 0.1536,
                        "P6": 0.1,
                        "P7": 0.18
                },
                "expectedFinalAt300s": {
                        "x": 0.03255285445849124,
                        "y": 0.017078833725393067,
                        "z": 0.2277742064393617,
                        "maxAbs": {
                                "x": 0.790944471551823,
                                "y": 0.6109010769380436,
                                "z": 0.6435165977935211
                        }
                }
        }
},
    }),
    Object.freeze({
      "id": "first-steps-bouncing-ball",
      "title": "First Steps: Bouncing Ball",
      "category": "First Steps application",
      "description": "Section 9.8 passive-accessory rebound approximation with capacitors for x/vx/y/vy, diode/Z-diode wall/floor contact detectors, and OUT Y routed through the standard INV2 module.",
      "defaultMode": "REPF",
      "patch": {
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps: Bouncing Ball",
      "description": "Runnable Section 9.8 Bouncing Ball approximation. Ideal diode/Z-diode overdrive blocks detect wall/floor penetration, capacitor states store x/vx/y/vy, and tuned spring-style contact forces create the repeated rebound trace. The vertical path uses a standard inverter module for the OUT Y sign convention; no hidden helper component is inserted.",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "MINUS1"
            },
            {
                  "id": "P3",
                  "coefficient": 0.16,
                  "label": "P3 gravity coefficient g"
            },
            {
                  "id": "P4",
                  "coefficient": 0.2,
                  "label": "P4 vertical drag coefficient d"
            },
            {
                  "id": "CAP1",
                  "type": "capacitor",
                  "label": "Capacitor / horizontal velocity vx",
                  "initialState": 0.36
            },
            {
                  "id": "CAP2",
                  "type": "capacitor",
                  "label": "Capacitor / horizontal position x",
                  "initialState": -0.8
            },
            {
                  "id": "CAP3",
                  "type": "capacitor",
                  "label": "Capacitor / vertical velocity vy",
                  "initialState": 0
            },
            {
                  "id": "CAP4",
                  "type": "capacitor",
                  "label": "Capacitor / vertical position y",
                  "initialState": -0.8
            },
            {
                  "id": "INV1",
                  "label": "Inverter / -x for left-wall detector"
            },
            {
                  "id": "INV2",
                  "label": "Standard inverter / OUT Y sign convention"
            },
            {
                  "id": "D1",
                  "type": "diode",
                  "label": "Right-wall ideal diode x>+1",
                  "forwardDrop": 0
            },
            {
                  "id": "D2",
                  "type": "diode",
                  "label": "Left-wall ideal diode x<-1",
                  "forwardDrop": 0
            },
            {
                  "id": "ZD1",
                  "type": "z-diode",
                  "label": "Floor Z-diode y>+1",
                  "zenerVoltage": 1,
                  "mode": "positive-overdrive"
            },
            {
                  "id": "ZD2",
                  "type": "z-diode",
                  "label": "Ceiling Z-diode y<-1",
                  "zenerVoltage": 1,
                  "mode": "negative-overdrive"
            },
            {
                  "id": "D3",
                  "type": "diode",
                  "label": "Floor contact diode",
                  "forwardDrop": 0
            },
            {
                  "id": "SUM1",
                  "type": "summer",
                  "label": "Horizontal acceleration sum",
                  "inputs": [
                        {
                              "name": "right",
                              "weight": 200,
                              "required": false
                        },
                        {
                              "name": "left",
                              "weight": -200,
                              "required": false
                        },
                        {
                              "name": "drag",
                              "weight": 0.02,
                              "required": false
                        }
                  ]
            },
            {
                  "id": "SUM2",
                  "type": "summer",
                  "label": "Vertical acceleration sum",
                  "inputs": [
                        {
                              "name": "gravityNeg",
                              "weight": 1,
                              "required": false
                        },
                        {
                              "name": "drag",
                              "weight": 1,
                              "required": false
                        },
                        {
                              "name": "floor",
                              "weight": 300,
                              "required": false
                        },
                        {
                              "name": "ceiling",
                              "weight": -300,
                              "required": false
                        }
                  ]
            },
            {
                  "id": "OUT_X",
                  "label": "X / horizontal position x"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / vertical position y"
            },
            {
                  "id": "OUT_Z",
                  "label": "Z / horizontal velocity vx"
            },
            {
                  "id": "OUT_U",
                  "label": "U / vertical velocity vy"
            }
      ],
      "cables": [
            {
                  "from": "CAP1.out",
                  "to": "CAP2.in",
                  "label": "integrate horizontal velocity into x"
            },
            {
                  "from": "CAP3.out",
                  "to": "CAP4.in",
                  "label": "integrate vertical velocity into y"
            },
            {
                  "from": "CAP2.out",
                  "to": "D1.in",
                  "label": "right-wall detector input x"
            },
            {
                  "from": "PLUS1.out",
                  "to": "D1.reference",
                  "label": "right wall at +1 machine unit"
            },
            {
                  "from": "CAP2.out",
                  "to": "INV1.in",
                  "label": "invert x for left-wall detector"
            },
            {
                  "from": "INV1.out",
                  "to": "D2.in",
                  "label": "left-wall detector input -x"
            },
            {
                  "from": "PLUS1.out",
                  "to": "D2.reference",
                  "label": "left wall at -1 machine unit"
            },
            {
                  "from": "D1.out",
                  "to": "SUM1.right",
                  "label": "right-wall penetration pushes left"
            },
            {
                  "from": "D2.out",
                  "to": "SUM1.left",
                  "label": "left-wall penetration pushes right"
            },
            {
                  "from": "CAP1.out",
                  "to": "SUM1.drag",
                  "label": "horizontal drag damps vx"
            },
            {
                  "from": "SUM1.out",
                  "to": "CAP1.in",
                  "label": "horizontal acceleration updates vx"
            },
            {
                  "from": "CAP4.out",
                  "to": "ZD1.in",
                  "label": "floor detector y>+1"
            },
            {
                  "from": "CAP4.out",
                  "to": "ZD2.in",
                  "label": "ceiling detector y<-1"
            },
            {
                  "from": "ZD1.out",
                  "to": "D3.in",
                  "label": "floor Z-diode overdrive through ideal diode"
            },
            {
                  "from": "MINUS1.out",
                  "to": "P3.in",
                  "label": "-1 into P3 creates the gravity term -g"
            },
            {
                  "from": "P3.out",
                  "to": "SUM2.gravityNeg",
                  "label": "gravity contribution through standard coefficient P3"
            },
            {
                  "from": "CAP3.out",
                  "to": "P4.in",
                  "label": "vertical velocity through standard drag coefficient P4"
            },
            {
                  "from": "P4.out",
                  "to": "SUM2.drag",
                  "label": "vertical drag damps vy"
            },
            {
                  "from": "D3.out",
                  "to": "SUM2.floor",
                  "label": "floor contact pushes upward"
            },
            {
                  "from": "ZD2.out",
                  "to": "SUM2.ceiling",
                  "label": "ceiling contact pushes downward"
            },
            {
                  "from": "SUM2.out",
                  "to": "CAP3.in",
                  "label": "vertical acceleration updates vy"
            },
            {
                  "from": "CAP2.out",
                  "to": "OUT_X.in",
                  "label": "x to OUT X"
            },
            {
                  "from": "CAP4.out",
                  "to": "INV2.in",
                  "label": "standard inverter forms the visible OUT Y sign"
            },
            {
                  "from": "INV2.out",
                  "to": "OUT_Y.in",
                  "label": "visible y to OUT Y through a standard inverter module"
            },
            {
                  "from": "CAP1.out",
                  "to": "OUT_Z.in",
                  "label": "vx to OUT Z"
            },
            {
                  "from": "CAP3.out",
                  "to": "OUT_U.in",
                  "label": "vy to OUT U"
            }
      ],
      "outputs": {
            "x": "OUT_X.out",
            "y": "OUT_Y.out",
            "displayY": "OUT_Y.out",
            "physicalY": "CAP4.out",
            "vx": "OUT_Z.out",
            "vy": "OUT_U.out",
            "rightWallContact": "D1.out",
            "leftWallContact": "D2.out",
            "floorContact": "D3.out",
            "ceilingContact": "ZD2.out",
            "horizontalAcceleration": "SUM1.out",
            "verticalAcceleration": "SUM2.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-bouncing-ball",
            "page": 22,
            "equation": "xDot = vx; vxDot = wall/drag response; yDot = vy; vyDot = g - d*vy - c*max(y-1,0) + c*max(-y-1,0); OUT_Y is formed through standard INV2",
            "x0": -0.8,
            "vx0": 0.36,
            "y0": -0.8,
            "vy0": 0,
            "gravity": 0.16,
            "verticalDrag": 0.2,
            "horizontalDrag": 0.02,
            "wallStiffness": 200,
            "floorStiffness": 300,
            "boundary": 1,
            "scopePreset": "time",
            "opTimeSeconds": 20,
            "accessoryRuntime": "ideal diode/Z-diode overdrive plus capacitor state storage with tuned contact stiffness; OUT_Y sign is routed through standard inverter INV2, not a hidden display transform",
            "expectedFinalAtOpTime": {
                  "vx": 0.1746915126802045,
                  "x": 1.0118863503788578,
                  "vy": -0.03575341455289606,
                  "y": 0.8791699642507337,
                  "displayY": -0.8791699642507337,
                  "visibleY": -0.8791699642507337,
                  "rightOverdrive": 0.011886350378857768,
                  "leftOverdrive": 0,
                  "floorOverdrive": 0,
                  "ceilingOverdrive": 0,
                  "floorContactCount": 4,
                  "rightWallContactCount": 2,
                  "leftWallContactCount": 1,
                  "peakY": 1.0314519286561619,
                  "minY": -0.8,
                  "displayPeakY": 0.8,
                  "displayMinY": -1.0314519286561619,
                  "maxX": 1.0228848149790064,
                  "minX": -1.0200085988067786
            },
            "expectedDisplayYAtOpTime": -0.8791699642507337
      }
}
}),

    Object.freeze({
      id: 'first-steps-polynomial-generator',
      title: 'First Steps: Polynomial Generator',
      category: 'First Steps application',
      description: 'Section 9.9 polynomial generator: x ramp, -x², x³, and p(x) routed to X/Y display.',
      defaultMode: 'REPF',
      patch: {
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps: Polynomial Generator",
      "description": "Booklet-style active-block translation of First Steps Section 9.9. I1 ramps x from -1 to +1, I2 generates -x^2 through an XIR summing-junction helper, I3 generates x^3, and P2-P5 form d, c, b, and a terms for p(x).",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "MINUS1"
            },
            {
                  "id": "I1",
                  "label": "Integrator / x ramp"
            },
            {
                  "id": "I2",
                  "label": "Integrator / -x^2"
            },
            {
                  "id": "I3",
                  "label": "Integrator / x^3"
            },
            {
                  "id": "XIR1",
                  "label": "XIR helper / second x input for -x^2"
            },
            {
                  "id": "XIR2",
                  "label": "XIR helper / second and third -x^2 inputs for x^3"
            },
            {
                  "id": "INV1",
                  "label": "Inverter / x^2"
            },
            {
                  "id": "INV2",
                  "label": "Inverter / -x^3 for negative a default"
            },
            {
                  "id": "INV3",
                  "label": "Inverter / final p(x)"
            },
            {
                  "id": "SUM1",
                  "label": "Summer / -(a*x^3 + b*x^2 + c*x + d)"
            },
            {
                  "id": "P1",
                  "coefficient": 1,
                  "label": "P1 tau ramp speed"
            },
            {
                  "id": "P2",
                  "coefficient": 0.1,
                  "label": "P2 constant term d"
            },
            {
                  "id": "P3",
                  "coefficient": 0.7,
                  "label": "P3 linear coefficient c"
            },
            {
                  "id": "P4",
                  "coefficient": 0.4,
                  "label": "P4 quadratic coefficient b"
            },
            {
                  "id": "P5",
                  "coefficient": 0.3,
                  "label": "P5 cubic coefficient |a|, fed from -x^3 for the default negative a"
            },
            {
                  "id": "OUT_X",
                  "label": "X / polynomial input x"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / polynomial output p(x)"
            }
      ],
      "cables": [
            {
                  "from": "PLUS1.out",
                  "to": "I1.ic",
                  "label": "+1 on IC makes I1.out start at x=-1"
            },
            {
                  "from": "MINUS1.out",
                  "to": "P1.in",
                  "label": "-1 through P1 sets the positive ramp derivative dx/dt"
            },
            {
                  "from": "P1.out",
                  "to": "I1.in1",
                  "label": "inverting integrator turns -tau into a positive x ramp"
            },
            {
                  "from": "PLUS1.out",
                  "to": "I2.ic",
                  "label": "+1 on IC makes I2.out start at -x^2=-1"
            },
            {
                  "from": "I1.out",
                  "to": "I2.in1",
                  "label": "first x contribution for d(-x^2)/dt=-2x"
            },
            {
                  "from": "I1.out",
                  "to": "XIR1.in1",
                  "label": "second x contribution through XIR1"
            },
            {
                  "from": "XIR1.out",
                  "to": "I2.sj",
                  "label": "XIR1 adds the second x input at the summing junction"
            },
            {
                  "from": "PLUS1.out",
                  "to": "I3.ic",
                  "label": "+1 on IC makes I3.out start at x^3=-1"
            },
            {
                  "from": "I2.out",
                  "to": "I3.in1",
                  "label": "first -x^2 contribution for d(x^3)/dt=3x^2"
            },
            {
                  "from": "I2.out",
                  "to": "XIR2.in1",
                  "label": "second -x^2 contribution through XIR2"
            },
            {
                  "from": "I2.out",
                  "to": "XIR2.in2",
                  "label": "third -x^2 contribution through XIR2"
            },
            {
                  "from": "XIR2.out",
                  "to": "I3.sj",
                  "label": "XIR2 adds two more -x^2 inputs at the summing junction"
            },
            {
                  "from": "I2.out",
                  "to": "INV1.in",
                  "label": "recover positive x^2 from -x^2"
            },
            {
                  "from": "I3.out",
                  "to": "INV2.in",
                  "label": "recover -x^3 so P5 can implement the default a=-0.3"
            },
            {
                  "from": "PLUS1.out",
                  "to": "P2.in",
                  "label": "constant term d"
            },
            {
                  "from": "I1.out",
                  "to": "P3.in",
                  "label": "linear term c*x"
            },
            {
                  "from": "INV1.out",
                  "to": "P4.in",
                  "label": "quadratic term b*x^2"
            },
            {
                  "from": "INV2.out",
                  "to": "P5.in",
                  "label": "cubic term a*x^3 with default negative sign"
            },
            {
                  "from": "P2.out",
                  "to": "SUM1.in1",
                  "label": "d into final polynomial summer"
            },
            {
                  "from": "P3.out",
                  "to": "SUM1.in2",
                  "label": "c*x into final polynomial summer"
            },
            {
                  "from": "P4.out",
                  "to": "SUM1.in3",
                  "label": "b*x^2 into final polynomial summer"
            },
            {
                  "from": "P5.out",
                  "to": "SUM1.in4",
                  "label": "a*x^3 into final polynomial summer"
            },
            {
                  "from": "SUM1.out",
                  "to": "INV3.in",
                  "label": "invert negating-summer output to get p(x)"
            },
            {
                  "from": "I1.out",
                  "to": "OUT_X.in",
                  "label": "x ramp to OUT X for X/Y display"
            },
            {
                  "from": "INV3.out",
                  "to": "OUT_Y.in",
                  "label": "polynomial p(x) to OUT Y"
            }
      ],
      "outputs": {
            "x": "OUT_X.out",
            "y": "OUT_Y.out",
            "polynomial": "OUT_Y.out",
            "minusX2": "I2.out",
            "x2": "INV1.out",
            "x3": "I3.out",
            "aTerm": "P5.out",
            "bTerm": "P4.out",
            "cTerm": "P3.out",
            "dTerm": "P2.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-polynomial-generator",
            "page": 23,
            "equation": "p(x) = a*x^3 + b*x^2 + c*x + d",
            "scopePreset": "time",
            "rampRate": 1,
            "a": -0.3,
            "b": 0.4,
            "c": 0.7,
            "d": 0.1,
            "opTimeSeconds": 2,
            "coefficients": {
                  "P1": 1,
                  "P2": 0.1,
                  "P3": 0.7,
                  "P4": 0.4,
                  "P5": 0.3
            },
            "defaultPolynomial": "p(x) = -0.3*x^3 + 0.4*x^2 + 0.7*x + 0.1",
            "expectedFinalAt2s": {
                  "x": 1,
                  "minusX2": -1,
                  "x3": 1,
                  "aTerm": -0.3,
                  "bTerm": 0.4,
                  "cTerm": 0.7,
                  "dTerm": 0.1,
                  "p": 0.9
            }
      }
},
    }),
    Object.freeze({
      id: 'first-steps-helper-adjustable-minus-one-plus-one',
      title: 'First Steps Helper: Adjustable Value -1 to +1',
      category: 'First Steps helper',
      description: 'Section 10.4 adjustable helper: one coefficient knob mapped to -1..+1.',
      defaultMode: 'OP',
      patch: {
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps Helper: Adjustable Value -1 to +1",
      "description": "Section 10.4 helper. P1 is mapped from 0..1 to a full machine-unit output by summing 2*P1 - 1 and displaying the result on OUT Y.",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "MINUS1"
            },
            {
                  "id": "P1",
                  "coefficient": 0.5,
                  "label": "P1 adjustable knob k"
            },
            {
                  "id": "SUM1",
                  "label": "Summer / -(2*k - 1)"
            },
            {
                  "id": "INV1",
                  "label": "Inverter / 2*k - 1"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / adjustable -1..+1 value"
            }
      ],
      "cables": [
            {
                  "from": "PLUS1.out",
                  "to": "P1.in",
                  "label": "+1 into P1 gives knob value k in 0..1"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in1",
                  "label": "first k contribution"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in2",
                  "label": "second k contribution, giving 2*k"
            },
            {
                  "from": "MINUS1.out",
                  "to": "SUM1.in3",
                  "label": "-1 offset contribution"
            },
            {
                  "from": "SUM1.out",
                  "to": "INV1.in",
                  "label": "recover non-inverted 2*k - 1"
            },
            {
                  "from": "INV1.out",
                  "to": "OUT_Y.in",
                  "label": "full machine-unit adjustable value to OUT Y"
            }
      ],
      "outputs": {
            "y": "OUT_Y.out",
            "adjustable": "OUT_Y.out",
            "rawSummer": "SUM1.out",
            "knob": "P1.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-helper-adjustable-minus-one-plus-one",
            "page": 24,
            "equation": "out = 2*k - 1, with k in [0,1]",
            "coefficient": 0.5,
            "expectedValue": 0
      }
},
      runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    }),
    Object.freeze({
      id: 'first-steps-helper-max',
      title: 'First Steps Helper: Maximum of Two Values',
      category: 'First Steps helper',
      description: 'Section 10.1 comparator helper selecting max(A,B).',
      defaultMode: 'OP',
      patch: {
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps Helper: Maximum of Two Values",
      "description": "Section 10.1 helper. Two adjustable input stubs generate A and B, CMP1 tests A-B, and OUT Y receives max(A,B).",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "MINUS1"
            },
            {
                  "id": "P1",
                  "coefficient": 0.625,
                  "label": "P1 input A knob"
            },
            {
                  "id": "P2",
                  "coefficient": 0.3,
                  "label": "P2 input B knob"
            },
            {
                  "id": "SUM1",
                  "label": "A source summer"
            },
            {
                  "id": "SUM2",
                  "label": "B source summer"
            },
            {
                  "id": "INV1",
                  "label": "A source output"
            },
            {
                  "id": "INV2",
                  "label": "B source output"
            },
            {
                  "id": "INV3",
                  "label": "-B for A-B comparison"
            },
            {
                  "id": "CMP1",
                  "label": "Comparator / choose greater value"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / max(A,B)"
            }
      ],
      "cables": [
            {
                  "from": "PLUS1.out",
                  "to": "P1.in",
                  "label": "A: +1 into coefficient knob"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in1",
                  "label": "A: first k contribution"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in2",
                  "label": "A: second k contribution"
            },
            {
                  "from": "MINUS1.out",
                  "to": "SUM1.in3",
                  "label": "A: -1 offset for 2*k-1"
            },
            {
                  "from": "SUM1.out",
                  "to": "INV1.in",
                  "label": "A: invert summer output to recover full-range signal"
            },
            {
                  "from": "PLUS1.out",
                  "to": "P2.in",
                  "label": "B: +1 into coefficient knob"
            },
            {
                  "from": "P2.out",
                  "to": "SUM2.in1",
                  "label": "B: first k contribution"
            },
            {
                  "from": "P2.out",
                  "to": "SUM2.in2",
                  "label": "B: second k contribution"
            },
            {
                  "from": "MINUS1.out",
                  "to": "SUM2.in3",
                  "label": "B: -1 offset for 2*k-1"
            },
            {
                  "from": "SUM2.out",
                  "to": "INV2.in",
                  "label": "B: invert summer output to recover full-range signal"
            },
            {
                  "from": "INV2.out",
                  "to": "INV3.in",
                  "label": "form -B"
            },
            {
                  "from": "INV1.out",
                  "to": "CMP1.a",
                  "label": "A into comparator sign input"
            },
            {
                  "from": "INV3.out",
                  "to": "CMP1.b",
                  "label": "-B into comparator sign input, testing A-B"
            },
            {
                  "from": "INV1.out",
                  "to": "CMP1.positive",
                  "label": "if A>B choose A"
            },
            {
                  "from": "INV2.out",
                  "to": "CMP1.nonPositive",
                  "label": "otherwise choose B"
            },
            {
                  "from": "CMP1.out",
                  "to": "OUT_Y.in",
                  "label": "max(A,B) to OUT Y"
            }
      ],
      "outputs": {
            "y": "OUT_Y.out",
            "max": "OUT_Y.out",
            "a": "INV1.out",
            "b": "INV2.out",
            "compare": "CMP1.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-helper-max",
            "page": 24,
            "equation": "out = max(A, B)",
            "aCoefficient": 0.625,
            "bCoefficient": 0.3,
            "a": 0.25,
            "b": -0.4,
            "expectedValue": 0.25
      }
},
      runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    }),
    Object.freeze({
      id: 'first-steps-helper-min',
      title: 'First Steps Helper: Minimum of Two Values',
      category: 'First Steps helper',
      description: 'Section 10.2 comparator helper selecting min(A,B).',
      defaultMode: 'OP',
      patch: {
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps Helper: Minimum of Two Values",
      "description": "Section 10.2 helper. Two adjustable input stubs generate A and B, CMP1 tests A-B, and OUT Y receives min(A,B).",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "MINUS1"
            },
            {
                  "id": "P1",
                  "coefficient": 0.625,
                  "label": "P1 input A knob"
            },
            {
                  "id": "P2",
                  "coefficient": 0.3,
                  "label": "P2 input B knob"
            },
            {
                  "id": "SUM1",
                  "label": "A source summer"
            },
            {
                  "id": "SUM2",
                  "label": "B source summer"
            },
            {
                  "id": "INV1",
                  "label": "A source output"
            },
            {
                  "id": "INV2",
                  "label": "B source output"
            },
            {
                  "id": "INV3",
                  "label": "-B for A-B comparison"
            },
            {
                  "id": "CMP1",
                  "label": "Comparator / choose smaller value"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / min(A,B)"
            }
      ],
      "cables": [
            {
                  "from": "PLUS1.out",
                  "to": "P1.in",
                  "label": "A: +1 into coefficient knob"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in1",
                  "label": "A: first k contribution"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in2",
                  "label": "A: second k contribution"
            },
            {
                  "from": "MINUS1.out",
                  "to": "SUM1.in3",
                  "label": "A: -1 offset for 2*k-1"
            },
            {
                  "from": "SUM1.out",
                  "to": "INV1.in",
                  "label": "A: invert summer output to recover full-range signal"
            },
            {
                  "from": "PLUS1.out",
                  "to": "P2.in",
                  "label": "B: +1 into coefficient knob"
            },
            {
                  "from": "P2.out",
                  "to": "SUM2.in1",
                  "label": "B: first k contribution"
            },
            {
                  "from": "P2.out",
                  "to": "SUM2.in2",
                  "label": "B: second k contribution"
            },
            {
                  "from": "MINUS1.out",
                  "to": "SUM2.in3",
                  "label": "B: -1 offset for 2*k-1"
            },
            {
                  "from": "SUM2.out",
                  "to": "INV2.in",
                  "label": "B: invert summer output to recover full-range signal"
            },
            {
                  "from": "INV2.out",
                  "to": "INV3.in",
                  "label": "form -B"
            },
            {
                  "from": "INV1.out",
                  "to": "CMP1.a",
                  "label": "A into comparator sign input"
            },
            {
                  "from": "INV3.out",
                  "to": "CMP1.b",
                  "label": "-B into comparator sign input, testing A-B"
            },
            {
                  "from": "INV2.out",
                  "to": "CMP1.positive",
                  "label": "if A>B choose B"
            },
            {
                  "from": "INV1.out",
                  "to": "CMP1.nonPositive",
                  "label": "otherwise choose A"
            },
            {
                  "from": "CMP1.out",
                  "to": "OUT_Y.in",
                  "label": "min(A,B) to OUT Y"
            }
      ],
      "outputs": {
            "y": "OUT_Y.out",
            "min": "OUT_Y.out",
            "a": "INV1.out",
            "b": "INV2.out",
            "compare": "CMP1.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-helper-min",
            "page": 24,
            "equation": "out = min(A, B)",
            "aCoefficient": 0.625,
            "bCoefficient": 0.3,
            "a": 0.25,
            "b": -0.4,
            "expectedValue": -0.4
      }
},
      runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    }),
    Object.freeze({
      id: 'first-steps-helper-abs',
      title: 'First Steps Helper: Absolute Value',
      category: 'First Steps helper',
      description: 'Section 10.3 comparator helper selecting abs(A).',
      defaultMode: 'OP',
      patch: {
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps Helper: Absolute Value",
      "description": "Section 10.3 helper. An adjustable input stub generates A, CMP1 tests A>0, and OUT Y receives A or -A.",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "MINUS1"
            },
            {
                  "id": "ZERO"
            },
            {
                  "id": "P1",
                  "coefficient": 0.3,
                  "label": "P1 input A knob"
            },
            {
                  "id": "SUM1",
                  "label": "A source summer"
            },
            {
                  "id": "INV1",
                  "label": "A source output"
            },
            {
                  "id": "INV2",
                  "label": "-A branch"
            },
            {
                  "id": "CMP1",
                  "label": "Comparator / absolute value"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / abs(A)"
            }
      ],
      "cables": [
            {
                  "from": "PLUS1.out",
                  "to": "P1.in",
                  "label": "A: +1 into coefficient knob"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in1",
                  "label": "A: first k contribution"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in2",
                  "label": "A: second k contribution"
            },
            {
                  "from": "MINUS1.out",
                  "to": "SUM1.in3",
                  "label": "A: -1 offset for 2*k-1"
            },
            {
                  "from": "SUM1.out",
                  "to": "INV1.in",
                  "label": "A: invert summer output to recover full-range signal"
            },
            {
                  "from": "INV1.out",
                  "to": "INV2.in",
                  "label": "form -A"
            },
            {
                  "from": "INV1.out",
                  "to": "CMP1.a",
                  "label": "test A"
            },
            {
                  "from": "ZERO.out",
                  "to": "CMP1.b",
                  "label": "compare against zero"
            },
            {
                  "from": "INV1.out",
                  "to": "CMP1.positive",
                  "label": "if A>0 choose A"
            },
            {
                  "from": "INV2.out",
                  "to": "CMP1.nonPositive",
                  "label": "otherwise choose -A"
            },
            {
                  "from": "CMP1.out",
                  "to": "OUT_Y.in",
                  "label": "abs(A) to OUT Y"
            }
      ],
      "outputs": {
            "y": "OUT_Y.out",
            "abs": "OUT_Y.out",
            "a": "INV1.out",
            "minusA": "INV2.out",
            "compare": "CMP1.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-helper-abs",
            "page": 24,
            "equation": "out = abs(A)",
            "aCoefficient": 0.3,
            "a": -0.4,
            "expectedValue": 0.4
      }
},
      runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    }),
    Object.freeze({
      id: 'first-steps-helper-non-negative-only',
      title: 'First Steps Helper: Non-Negative Values Only',
      category: 'First Steps helper',
      description: 'Section 10.5 comparator helper returning A when A>0, otherwise zero.',
      defaultMode: 'OP',
      patch: {
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps Helper: Non-Negative Values Only",
      "description": "Section 10.5 helper. An adjustable input stub generates A, CMP1 tests A>0, and OUT Y receives A or zero.",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "MINUS1"
            },
            {
                  "id": "ZERO"
            },
            {
                  "id": "P1",
                  "coefficient": 0.3,
                  "label": "P1 input A knob"
            },
            {
                  "id": "SUM1",
                  "label": "A source summer"
            },
            {
                  "id": "INV1",
                  "label": "A source output"
            },
            {
                  "id": "CMP1",
                  "label": "Comparator / positive clamp"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / max(A,0)"
            }
      ],
      "cables": [
            {
                  "from": "PLUS1.out",
                  "to": "P1.in",
                  "label": "A: +1 into coefficient knob"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in1",
                  "label": "A: first k contribution"
            },
            {
                  "from": "P1.out",
                  "to": "SUM1.in2",
                  "label": "A: second k contribution"
            },
            {
                  "from": "MINUS1.out",
                  "to": "SUM1.in3",
                  "label": "A: -1 offset for 2*k-1"
            },
            {
                  "from": "SUM1.out",
                  "to": "INV1.in",
                  "label": "A: invert summer output to recover full-range signal"
            },
            {
                  "from": "INV1.out",
                  "to": "CMP1.a",
                  "label": "test A"
            },
            {
                  "from": "ZERO.out",
                  "to": "CMP1.b",
                  "label": "compare against zero"
            },
            {
                  "from": "INV1.out",
                  "to": "CMP1.positive",
                  "label": "if A>0 choose A"
            },
            {
                  "from": "ZERO.out",
                  "to": "CMP1.nonPositive",
                  "label": "otherwise choose 0"
            },
            {
                  "from": "CMP1.out",
                  "to": "OUT_Y.in",
                  "label": "non-negative value to OUT Y"
            }
      ],
      "outputs": {
            "y": "OUT_Y.out",
            "nonNegative": "OUT_Y.out",
            "a": "INV1.out",
            "compare": "CMP1.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-helper-non-negative-only",
            "page": 24,
            "equation": "out = A if A > 0; otherwise 0",
            "aCoefficient": 0.3,
            "a": -0.4,
            "expectedValue": 0
      }
},
      runOptions: Object.freeze({ duration: 0, dt: 0.01, sampleEvery: 1 }),
    }),
    Object.freeze({
      id: 'static-inverter',
      title: 'Static inverter and coefficient',
      category: 'linear block',
      description: 'Coefficient scaling followed by sign inversion; expected Y is -0.6.',
      defaultMode: 'OP',
      patch: patch(
        'Static inverter and coefficient demo',
        'A small serialized patch that feeds +1 through a potentiometer and inverter.',
        [{ id: 'PLUS1' }, { id: 'P1', coefficient: 0.6 }, { id: 'INV1' }, { id: 'OUT_Y' }],
        [{ from: 'PLUS1.out', to: 'P1.in' }, { from: 'P1.out', to: 'INV1.in' }, { from: 'INV1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', scaled: 'P1.out', inverted: 'INV1.out' },
        { expectedY: -0.6 },
      ),
    }),
    Object.freeze({
      id: 'summer-scaling',
      title: 'Summer scaling and sign',
      category: 'linear block',
      description: 'A THAT-style negating summer combines +0.35 and -0.20; expected Y is -0.15.',
      defaultMode: 'OP',
      patch: patch(
        'Summer scaling and sign demo',
        'Combines a positive and a negative coefficient through a negating summer.',
        [{ id: 'PLUS1' }, { id: 'MINUS1' }, { id: 'P1', coefficient: 0.35 }, { id: 'P2', coefficient: 0.2 }, { id: 'SUM1' }, { id: 'OUT_Y' }],
        [{ from: 'PLUS1.out', to: 'P1.in' }, { from: 'MINUS1.out', to: 'P2.in' }, { from: 'P1.out', to: 'SUM1.in1' }, { from: 'P2.out', to: 'SUM1.in2' }, { from: 'SUM1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', positiveTerm: 'P1.out', negativeTerm: 'P2.out' },
        { expectedY: -0.15 },
      ),
    }),
    Object.freeze({
      id: 'multiplier-product',
      title: 'Multiplier product',
      category: 'nonlinear block',
      description: 'Two coefficient-scaled constants feed a normalized four-quadrant multiplier; expected Y is -0.24.',
      defaultMode: 'OP',
      patch: patch(
        'Multiplier product demo',
        'Uses two coefficient potentiometers and one multiplier.',
        [{ id: 'PLUS1' }, { id: 'MINUS1' }, { id: 'P1', coefficient: 0.6 }, { id: 'P2', coefficient: 0.4 }, { id: 'MUL1' }, { id: 'OUT_Y' }],
        [{ from: 'PLUS1.out', to: 'P1.in' }, { from: 'MINUS1.out', to: 'P2.in' }, { from: 'P1.out', to: 'MUL1.x' }, { from: 'P2.out', to: 'MUL1.y' }, { from: 'MUL1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', product: 'MUL1.out' },
        { expectedY: -0.24 },
      ),
    }),
    Object.freeze({
      id: 'comparator-switch',
      title: 'Comparator switch',
      category: 'hybrid-style block',
      description: 'The comparator selects +1 because the default a + b sign test is positive.',
      defaultMode: 'OP',
      patch: patch(
        'Comparator switch demo',
        'Routes +1 or -1 according to the sign of a + b.',
        [{ id: 'PLUS1' }, { id: 'MINUS1' }, { id: 'P1', coefficient: 0.3 }, { id: 'P2', coefficient: 0.2 }, { id: 'CMP1' }, { id: 'OUT_Y' }],
        [{ from: 'PLUS1.out', to: 'P1.in' }, { from: 'MINUS1.out', to: 'P2.in' }, { from: 'P1.out', to: 'CMP1.a' }, { from: 'P2.out', to: 'CMP1.b' }, { from: 'PLUS1.out', to: 'CMP1.positive' }, { from: 'MINUS1.out', to: 'CMP1.nonPositive' }, { from: 'CMP1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', selected: 'CMP1.out' },
        { expectedY: 1 },
      ),
    }),
    Object.freeze({
      id: 'xir-summing-junction',
      title: 'XIR summing-junction extension',
      category: 'patch expansion',
      description: 'An XIR x10 contribution enters SUM1.sj; expected Y is -0.5.',
      defaultMode: 'OP',
      patch: patch(
        'XIR summing-junction extension demo',
        'Adds one ordinary summer input and one x10 XIR contribution.',
        [{ id: 'PLUS1' }, { id: 'P1', coefficient: 0.2 }, { id: 'P2', coefficient: 0.03 }, { id: 'XIR1' }, { id: 'SUM1' }, { id: 'OUT_Y' }],
        [{ from: 'PLUS1.out', to: 'P1.in' }, { from: 'PLUS1.out', to: 'P2.in' }, { from: 'P1.out', to: 'SUM1.in1' }, { from: 'P2.out', to: 'XIR1.in10_1' }, { from: 'XIR1.out', to: 'SUM1.sj' }, { from: 'SUM1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', xirContribution: 'XIR1.out' },
        { expectedY: -0.5 },
      ),
    }),
    Object.freeze({
      id: 'slow-integrator-ramp',
      title: 'Slow integrator ramp',
      category: 'dynamic system',
      description: 'A single integrator demonstrates slow-mode approximation and IC reset.',
      defaultMode: 'OP',
      patch: patch(
        'Slow integrator ramp demo',
        'Feeds -1 into an integrator with the slow socket active.',
        [{ id: 'MINUS1' }, { id: 'I1' }, { id: 'OUT_Y' }],
        [{ from: 'MINUS1.out', to: 'I1.in1' }, { from: 'I1.out', to: 'I1.slow' }, { from: 'I1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', ramp: 'I1.out' },
        { expectedFinalYAt10: 0.1 },
      ),
    }),
  ]);

  function runOptionsForSerializedExample(exampleOrId) {
    const id = typeof exampleOrId === 'string' ? exampleOrId : exampleOrId.id;
    if (id === 'quickstart-damped-oscillation' || id === 'first-steps-radioactive-decay') return { opTime: 8, cycles: 3, dt: 0.01, sampleEvery: 50 };
    if (id === 'first-steps-mass-spring-damper') return { opTime: 0.08, cycles: 3, dt: 0.0001, sampleEvery: 25 };
    if (id === 'first-steps-lunar-landing') return { duration: 10, dt: 0.002, sampleEvery: 25 };
    if (id === 'first-steps-neuronal-bursting') return { duration: 40, dt: 0.002, sampleEvery: 25 };
    if (id === 'first-steps-euler-spiral') return { opTime: 120, cycles: 1, dt: 0.005, sampleEvery: 20 };
    if (id === 'first-steps-hunter-prey') return { duration: 100, dt: 0.01, sampleEvery: 5 };
    if (id === 'first-steps-lorenz-attractor') return { duration: 300, dt: 0.01, sampleEvery: 5 };
    if (id === 'first-steps-bouncing-ball') return { opTime: 20, cycles: 1, dt: 0.001, sampleEvery: 20 };
    if (id === 'slow-integrator-ramp') return { duration: 10, dt: 0.01, sampleEvery: 100 };
    return { duration: 0, dt: 0.01, sampleEvery: 1 };
  }

  function getSerializedGalleryExamples(options = {}) {
    const examples = options.includeNonBookletExamples ? SERIALIZED_GALLERY : SERIALIZED_GALLERY.filter((example) => isQuickStartBookletExampleId(example.id));
    return examples.map((example) => ({
      id: example.id,
      title: example.title,
      category: example.category,
      description: example.description,
      defaultMode: example.defaultMode,
      runOptions: runOptionsForSerializedExample(example),
      patch: clonePlain(example.patch),
    }));
  }

  function getSerializedGalleryExample(id) {
    const found = SERIALIZED_GALLERY.find((example) => example.id === id) || SERIALIZED_GALLERY.find((example) => isQuickStartBookletExampleId(example.id)) || SERIALIZED_GALLERY[0];
    return {
      id: found.id,
      title: found.title,
      category: found.category,
      description: found.description,
      defaultMode: found.defaultMode,
      runOptions: runOptionsForSerializedExample(found),
      patch: clonePlain(found.patch),
    };
  }

  function getSerializedGalleryPatch(id) {
    return getSerializedGalleryExample(id).patch;
  }

  function summarizeSerializedPatch(patchObject) {
    const patchValue = patchObject || {};
    const components = Array.isArray(patchValue.components) ? patchValue.components : [];
    const cables = Array.isArray(patchValue.cables) ? patchValue.cables : [];
    const types = {};
    for (const component of components) {
      const prefix = String(component.id || '').replace(/[0-9_]+$/g, '') || 'unknown';
      types[prefix] = (types[prefix] || 0) + 1;
    }
    return {
      name: patchValue.name || 'unnamed patch',
      schemaVersion: patchValue.schemaVersion || '',
      inventory: patchValue.inventory || '',
      componentCount: components.length,
      cableCount: cables.length,
      outputNames: Object.keys(patchValue.outputs || {}),
      componentPrefixes: types,
      parameterKeys: Object.keys(patchValue.parameters || {}),
    };
  }

  function populateSerializedGallerySelect(select, examples) {
    if (!select) return;
    select.innerHTML = examples.map((example) => `<option value="${escapeText(example.id)}">${escapeText(example.title)}</option>`).join('');
  }

  function populateOutputSelect(select, outputNames) {
    if (!select) return;
    const names = outputNames.length > 1 ? ['all', ...outputNames] : outputNames;
    select.innerHTML = names.map((name) => `<option value="${escapeText(name)}">${escapeText(name)}</option>`).join('');
  }

  function renderSerializedGallery(example, elements, options) {
    const summary = summarizeSerializedPatch(example.patch);
    if (elements.description) elements.description.textContent = `${example.category}: ${example.description}`;
    if (elements.summary) elements.summary.textContent = JSON.stringify(summary, null, 2);
    if (elements.json) elements.json.textContent = JSON.stringify(example.patch, null, 2);
    if (elements.outputSelect) populateOutputSelect(elements.outputSelect, summary.outputNames);
    if (elements.runSummary) elements.runSummary.textContent = '{}';
    if (options && options.copyToEditor && elements.patchJsonEditor) {
      elements.patchJsonEditor.value = `${JSON.stringify(example.patch, null, 2)}\n`;
    }
    return { example, summary, run: null };
  }

  function runSerializedGalleryExampleInBrowser(id, runOptions = {}) {
    const runtime = globalScope.AnalogThingBrowserPatchRuntime;
    if (!runtime || typeof runtime.runSerializedPatch !== 'function') {
      throw new Error('AnalogThingBrowserPatchRuntime is not available');
    }
    const example = getSerializedGalleryExample(id);
    const options = Object.assign({}, example.runOptions, runOptions, { mode: runOptions.mode || example.defaultMode });
    const payload = runtime.runSerializedPatch(example.patch, options);
    return {
      example: {
        id: example.id,
        title: example.title,
        category: example.category,
        description: example.description,
      },
      patch: example.patch,
      parameters: payload.parameters,
      result: payload.result,
      summary: runtime.summarizeTraceResult(payload),
    };
  }

  function initSerializedGalleryApp(rootDocument, options = {}) {
    const doc = rootDocument || document;
    const select = doc.querySelector('#serializedExampleSelect');
    const loadButton = doc.querySelector('#loadSerializedExample');
    const copyButton = doc.querySelector('#copySerializedExampleToEditor');
    const runButton = doc.querySelector('#runSerializedExample');
    const outputSelect = doc.querySelector('#serializedRunOutput');
    const description = doc.querySelector('#serializedExampleDescription');
    const summary = doc.querySelector('#serializedExampleSummary');
    const json = doc.querySelector('#serializedExampleJson');
    const runSummary = doc.querySelector('#serializedRunSummary');
    const runCanvas = doc.querySelector('#serializedRunCanvas');
    const patchJsonEditor = doc.querySelector('#patchJsonEditor');
    const examples = getSerializedGalleryExamples();
    populateSerializedGallerySelect(select, examples);
    let current = null;

    function apply(id, applyOptions = {}) {
      const example = getSerializedGalleryExample(id || (select && select.value));
      if (select) select.value = example.id;
      current = renderSerializedGallery(example, { description, summary, json, patchJsonEditor, outputSelect, runSummary }, applyOptions);
      return current;
    }

    function runCurrent(runOptions = {}) {
      const runtime = globalScope.AnalogThingBrowserPatchRuntime;
      if (!current) apply(select && select.value);
      if (!runtime || typeof runtime.runSerializedPatch !== 'function') {
        if (runSummary) runSummary.textContent = 'Browser patch runtime is not loaded.';
        throw new Error('AnalogThingBrowserPatchRuntime is not available');
      }
      const payload = runSerializedGalleryExampleInBrowser(current.example.id, runOptions);
      current.run = payload;
      if (runSummary) runSummary.textContent = JSON.stringify(payload.summary, null, 2);
      if (runCanvas) runtime.drawRuntimeTrace(runCanvas, payload.result, { outputName: outputSelect ? outputSelect.value : 'all' });
      return payload;
    }

    if (loadButton) loadButton.addEventListener('click', () => apply(select && select.value));
    if (select) select.addEventListener('change', () => apply(select.value));
    if (copyButton) copyButton.addEventListener('click', () => apply(select && select.value, { copyToEditor: true }));
    if (runButton) runButton.addEventListener('click', () => runCurrent());
    if (outputSelect) outputSelect.addEventListener('change', () => { if (current && current.run) runCurrent(); });
    apply(options.initialExample || 'first-steps-radioactive-decay');
    return {
      apply,
      runCurrent,
      runSerializedGalleryExampleInBrowser,
      getExamples: getSerializedGalleryExamples,
      getCurrentSummary: () => current && current.summary,
      getCurrentRunSummary: () => current && current.run && current.run.summary,
    };
  }

  const api = {
    PATCH_SCHEMA_VERSION,
    DEFAULT_INVENTORY_NAME,
    QUICK_START_BOOKLET_EXAMPLE_IDS,
    isQuickStartBookletExampleId,
    getSerializedGalleryExamples,
    getSerializedGalleryExample,
    getSerializedGalleryPatch,
    summarizeSerializedPatch,
    runOptionsForSerializedExample,
    runSerializedGalleryExampleInBrowser,
    initSerializedGalleryApp,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingSerializedGalleryApp = api;
}(typeof window !== 'undefined' ? window : global));
