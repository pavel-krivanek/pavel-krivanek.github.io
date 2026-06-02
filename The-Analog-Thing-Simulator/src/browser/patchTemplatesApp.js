/* global window, document */
'use strict';

(function attachPatchTemplatesApp(globalScope) {
  const PATCH_SCHEMA_VERSION = 'analog-thing-patch/v1';
  const DEFAULT_INVENTORY_NAME = 'that-prototype-board/v006';

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeText(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clampParameter(value, spec) {
    const min = spec.min === undefined ? 0 : Number(spec.min);
    const max = spec.max === undefined ? 1 : Number(spec.max);
    const numeric = finiteNumber(value, spec.defaultValue === undefined ? 0.5 : spec.defaultValue);
    if (numeric < min) return min;
    if (numeric > max) return max;
    return numeric;
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

  function parameter(name, label, componentId, defaultValue, description) {
    return Object.freeze({
      name,
      label,
      componentId,
      property: 'coefficient',
      defaultValue,
      min: 0,
      max: 1,
      step: 0.01,
      description: description || label,
    });
  }

  function deviceControls(values = {}) {
    return Object.freeze({
      mode: values.mode || 'OP',
      opTimeMs: values.opTimeMs === undefined ? 8 : values.opTimeMs,
      opDurationMs: values.opDurationMs === undefined ? 0 : values.opDurationMs,
      repCycles: values.repCycles === undefined ? 1 : values.repCycles,
      solverDtMs: values.solverDtMs === undefined ? 0.01 : values.solverDtMs,
      sampleEvery: values.sampleEvery === undefined ? 1 : values.sampleEvery,
      simulationPrecision: values.simulationPrecision || values.precision || 'balanced',
      scopeA: values.scopeA || 'Y',
      scopeB: values.scopeB || 'none',
      scopeMode: values.scopeMode || 'time',
      clip: Boolean(values.clip),
    });
  }

  const TEMPLATE_DEFINITIONS = Object.freeze([
    Object.freeze({
      id: 'empty-panel',
      title: 'Empty physical panel setup',
      category: 'blank setup',
      defaultMode: 'OFF',
      defaultRunOptions: Object.freeze({ mode: 'OFF', duration: 0, dt: 0.01, sampleEvery: 1 }),
      defaultDeviceControls: deviceControls({ mode: 'OFF', opTimeMs: 8, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 1, scopeA: 'X', scopeB: 'Y', scopeMode: 'time', clip: false }),
      description: 'Blank THAT panel: all physical modules are present after loading, but no patch cables are installed.',
      parameters: Object.freeze([]),
      patch: Object.freeze(patch(
        'Empty THAT physical panel setup',
        'No predefined wiring. Use this as a clean device-like starting point for patching from scratch.',
        [],
        [],
        {},
        { coefficients: { P1: 0.5, P2: 0.5, P3: 0.5, P4: 0.5, P5: 0.5, P6: 0.5, P7: 0.5, P8: 0.5 } },
      )),
    }),
    Object.freeze({
      id: 'quickstart-damped-oscillation',
      title: 'Damped oscillation template',
      category: 'dynamic system',
      defaultMode: 'REPF',
      defaultRunOptions: Object.freeze({ mode: 'REPF', opTime: 8, cycles: 3, dt: 0.01, sampleEvery: 50 }),
      defaultDeviceControls: deviceControls({ mode: 'REPF', opTimeMs: 8, opDurationMs: 40, repCycles: 3, solverDtMs: 0.01, sampleEvery: 50, scopeA: 'X', scopeB: 'Y', scopeMode: 'time', clip: false }),
      description: 'Reusable two-integrator oscillator template based on the THAT quickstart wiring.',
      parameters: Object.freeze([
        parameter('k', 'spring coefficient k', 'P1', 0.5, 'Scales the position feedback term.'),
        parameter('d', 'damping coefficient d', 'P2', 0.5, 'Scales the velocity feedback term.'),
        parameter('invMass', 'inverse mass 1/m', 'P3', 0.5, 'Scales the computed force before acceleration integration.'),
      ]),
      patch: Object.freeze(patch(
        'THAT quickstart damped oscillation template patch',
        'Two integrators, one inverter, three coefficient potentiometers, one negating summer, and X/Y output routing.',
        [
          { id: 'PLUS1' }, { id: 'I1' }, { id: 'I2' }, { id: 'INV1' },
          { id: 'P1', coefficient: 0.5, label: 'P1 spring coefficient k' },
          { id: 'P2', coefficient: 0.5, label: 'P2 damping coefficient d' },
          { id: 'SUM1' },
          { id: 'P3', coefficient: 0.5, label: 'P3 inverse mass 1/m' },
          { id: 'OUT_X', label: 'X / velocity' }, { id: 'OUT_Y', label: 'Y / position' },
        ],
        [
          { from: 'PLUS1.out', to: 'I1.ic', label: 'initial velocity +1 becomes I1.out = -1' },
          { from: 'P3.out', to: 'I1.in1', label: 'acceleration input to first integrator' },
          { from: 'I1.out', to: 'I2.in1', label: 'integrate minus velocity into position' },
          { from: 'I1.out', to: 'INV1.in', label: 'recover positive velocity' },
          { from: 'I2.out', to: 'P1.in', label: 'spring term k*x' },
          { from: 'INV1.out', to: 'P2.in', label: 'damping term d*x_dot' },
          { from: 'P1.out', to: 'SUM1.in1', label: 'summer input for spring force' },
          { from: 'P2.out', to: 'SUM1.in2', label: 'summer input for damping force' },
          { from: 'SUM1.out', to: 'P3.in', label: 'apply inverse mass to force sum' },
          { from: 'INV1.out', to: 'OUT_X.in', label: 'velocity display' },
          { from: 'I2.out', to: 'OUT_Y.in', label: 'position display' },
        ],
        { velocity: 'OUT_X.out', position: 'OUT_Y.out', minusVelocity: 'I1.out', accelerationInput: 'P3.out' },
        { k: 0.5, d: 0.5, invMass: 0.5 },
      )),
    }),
    Object.freeze({
      id: 'coefficient-inverter',
      title: 'Coefficient + inverter template',
      category: 'linear block',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 1, scopeA: 'Y', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'Small static template for coefficient setting and sign inversion.',
      parameters: Object.freeze([
        parameter('scale', 'coefficient scale', 'P1', 0.6, 'Sets the coefficient potentiometer value before the inverter.'),
      ]),
      patch: Object.freeze(patch(
        'Coefficient and inverter template patch',
        'Feeds +1 through a coefficient potentiometer and inverter.',
        [{ id: 'PLUS1' }, { id: 'P1', coefficient: 0.6 }, { id: 'INV1' }, { id: 'OUT_Y' }],
        [{ from: 'PLUS1.out', to: 'P1.in' }, { from: 'P1.out', to: 'INV1.in' }, { from: 'INV1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', scaled: 'P1.out', inverted: 'INV1.out' },
        { scale: 0.6 },
      )),
    }),
    Object.freeze({
      id: 'multiplier-product',
      title: 'Multiplier product template',
      category: 'nonlinear block',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 1, scopeA: 'Y', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'Template for normalized four-quadrant multiplication from two coefficient-scaled constants.',
      parameters: Object.freeze([
        parameter('xScale', 'x coefficient', 'P1', 0.6, 'Positive multiplicand coefficient.'),
        parameter('yScale', 'y coefficient', 'P2', 0.4, 'Magnitude of the negative multiplicand coefficient.'),
      ]),
      patch: Object.freeze(patch(
        'Multiplier product template patch',
        'Feeds +P1 and -P2 into MUL1 and routes the product to OUT_Y.',
        [{ id: 'PLUS1' }, { id: 'MINUS1' }, { id: 'P1', coefficient: 0.6 }, { id: 'P2', coefficient: 0.4 }, { id: 'MUL1' }, { id: 'OUT_Y' }],
        [{ from: 'PLUS1.out', to: 'P1.in' }, { from: 'MINUS1.out', to: 'P2.in' }, { from: 'P1.out', to: 'MUL1.x' }, { from: 'P2.out', to: 'MUL1.y' }, { from: 'MUL1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', product: 'MUL1.out', x: 'P1.out', yInput: 'P2.out' },
        { xScale: 0.6, yScale: 0.4 },
      )),
    }),
    Object.freeze({
      id: 'comparator-switch',
      title: 'Comparator switch template',
      category: 'hybrid-style block',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 1, scopeA: 'Y', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'Template for the comparator sign test a + b and conditional output selection.',
      parameters: Object.freeze([
        parameter('positiveTerm', 'positive test term', 'P1', 0.3, 'Positive contribution to the comparator test.'),
        parameter('negativeTerm', 'negative test term', 'P2', 0.2, 'Negative contribution to the comparator test.'),
      ]),
      patch: Object.freeze(patch(
        'Comparator switch template patch',
        'Selects +1 or -1 according to the sign of P1(+1) + P2(-1).',
        [{ id: 'PLUS1' }, { id: 'MINUS1' }, { id: 'P1', coefficient: 0.3 }, { id: 'P2', coefficient: 0.2 }, { id: 'CMP1' }, { id: 'OUT_Y' }],
        [{ from: 'PLUS1.out', to: 'P1.in' }, { from: 'MINUS1.out', to: 'P2.in' }, { from: 'P1.out', to: 'CMP1.a' }, { from: 'P2.out', to: 'CMP1.b' }, { from: 'PLUS1.out', to: 'CMP1.positive' }, { from: 'MINUS1.out', to: 'CMP1.nonPositive' }, { from: 'CMP1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', selected: 'CMP1.out', testPositive: 'P1.out', testNegative: 'P2.out' },
        { positiveTerm: 0.3, negativeTerm: 0.2 },
      )),
    }),
    Object.freeze({
      id: 'slow-integrator-ramp',
      title: 'Slow integrator ramp template',
      category: 'dynamic system',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 100, dt: 0.01, sampleEvery: 100 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 100, repCycles: 1, solverDtMs: 0.01, sampleEvery: 100, scopeA: 'Y', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'Template showing the slow integrator input as an approximate 100x rate reduction.',
      parameters: Object.freeze([]),
      patch: Object.freeze(patch(
        'Slow integrator ramp template patch',
        'Feeds -1 into I1.in1, grounds IC, activates slow mode, and displays the ramp.',
        [{ id: 'MINUS1' }, { id: 'I1' }, { id: 'OUT_Y' }],
        [{ from: 'MINUS1.out', to: 'I1.in1' }, { from: 'I1.out', to: 'I1.slow', label: 'feedback OUT to SLOW activates the hardware-like slow range' }, { from: 'I1.out', to: 'OUT_Y.in' }],
        { y: 'OUT_Y.out', ramp: 'I1.out' },
        {},
      )),
    }),
    Object.freeze({
      id: 'first-steps-helper-adjustable-minus-one-plus-one',
      title: 'First Steps Helper: Adjustable Value -1 to +1',
      category: 'First Steps helper',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 1, scopeA: 'Y', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'Section 10.4 helper preset mapping one coefficient knob to the full machine-unit range.',
      parameters: Object.freeze([parameter('valueCoefficient', 'value knob k', 'P1', 0.5, 'Output is 2*k-1; 0.5 gives zero.')]),
      patch: Object.freeze({
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
}),
    }),
    Object.freeze({
      id: 'first-steps-helper-max',
      title: 'First Steps Helper: Maximum of Two Values',
      category: 'First Steps helper',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 1, scopeA: 'Y', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'Section 10.1 helper preset selecting max(A,B) with comparator wiring.',
      parameters: Object.freeze([parameter('aCoefficient', 'A knob kA', 'P1', 0.625, 'A = 2*kA - 1.'), parameter('bCoefficient', 'B knob kB', 'P2', 0.3, 'B = 2*kB - 1.')]),
      patch: Object.freeze({
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
}),
    }),
    Object.freeze({
      id: 'first-steps-helper-min',
      title: 'First Steps Helper: Minimum of Two Values',
      category: 'First Steps helper',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 1, scopeA: 'Y', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'Section 10.2 helper preset selecting min(A,B) with comparator wiring.',
      parameters: Object.freeze([parameter('aCoefficient', 'A knob kA', 'P1', 0.625, 'A = 2*kA - 1.'), parameter('bCoefficient', 'B knob kB', 'P2', 0.3, 'B = 2*kB - 1.')]),
      patch: Object.freeze({
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
}),
    }),
    Object.freeze({
      id: 'first-steps-helper-abs',
      title: 'First Steps Helper: Absolute Value',
      category: 'First Steps helper',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 1, scopeA: 'Y', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'Section 10.3 helper preset selecting A or -A with comparator wiring.',
      parameters: Object.freeze([parameter('aCoefficient', 'A knob kA', 'P1', 0.3, 'A = 2*kA - 1.')]),
      patch: Object.freeze({
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
}),
    }),
    Object.freeze({
      id: 'first-steps-helper-non-negative-only',
      title: 'First Steps Helper: Non-Negative Values Only',
      category: 'First Steps helper',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 1, scopeA: 'Y', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'Section 10.5 helper preset routing A when A>0 and zero otherwise.',
      parameters: Object.freeze([parameter('aCoefficient', 'A knob kA', 'P1', 0.3, 'A = 2*kA - 1.')]),
      patch: Object.freeze({
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
}),
    }),
    Object.freeze({
      id: 'first-steps-radioactive-decay',
      title: 'First Steps: Radioactive Decay',
      category: 'First Steps application',
      defaultMode: 'REPF',
      defaultRunOptions: Object.freeze({ mode: 'REPF', opTime: 4, cycles: 1, dt: 0.01, sampleEvery: 400 }),
      defaultDeviceControls: deviceControls({ mode: 'REPF', opTimeMs: 4, opDurationMs: 0, repCycles: 1, solverDtMs: 0.01, sampleEvery: 400, scopeA: 'X', scopeB: 'none', scopeMode: 'time', clip: false }),
      description: 'First Steps Section 9.1 exponential decay preset: P1 sets N0, P2 sets lambda, I1 carries -N, and INV1 routes N to OUT X.',
      parameters: Object.freeze([
        parameter('n0', 'initial sample N0', 'P1', 0.5, 'Initial value of the positive decay curve.'),
        parameter('lambda', 'decay coefficient lambda', 'P2', 0.5, 'Exponential decay coefficient.'),
      ]),
      patch: Object.freeze({
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps: Radioactive Decay",
      "description": "Exact block-level translation of the First Steps radioactive decay patch: Ndot = -lambda N. The integrator output carries -N, the inverter exposes positive N on OUT X.",
      "components": [
            {
                  "id": "PLUS1"
            },
            {
                  "id": "I1",
                  "label": "Integrator / -N"
            },
            {
                  "id": "INV1",
                  "label": "Inverter / N"
            },
            {
                  "id": "P1",
                  "coefficient": 0.5,
                  "label": "P1 initial sample N0"
            },
            {
                  "id": "P2",
                  "coefficient": 0.5,
                  "label": "P2 decay coefficient lambda"
            },
            {
                  "id": "OUT_X",
                  "label": "X / decay curve N"
            }
      ],
      "cables": [
            {
                  "from": "PLUS1.out",
                  "to": "P1.in",
                  "label": "+1 into P1 so the coefficient knob sets N0"
            },
            {
                  "from": "P1.out",
                  "to": "I1.ic",
                  "label": "IC input sets I1.out to -N0 at the start of each run"
            },
            {
                  "from": "I1.out",
                  "to": "P2.in",
                  "label": "feedback of -N through lambda coefficient"
            },
            {
                  "from": "P2.out",
                  "to": "I1.in1",
                  "label": "lambda*(-N) into the inverting integrator gives decay"
            },
            {
                  "from": "I1.out",
                  "to": "INV1.in",
                  "label": "recover positive N for display"
            },
            {
                  "from": "INV1.out",
                  "to": "OUT_X.in",
                  "label": "decay curve to OUT X"
            }
      ],
      "outputs": {
            "x": "OUT_X.out",
            "n": "OUT_X.out",
            "minusN": "I1.out",
            "lambdaInput": "P2.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-radioactive-decay",
            "page": 15,
            "equation": "Ndot = -lambda*N",
            "n0": 0.5,
            "lambda": 0.5,
            "expectedInitialN": 0.5,
            "expectedNAtT4": 0.06766764161830635
      }
}),
    }),
    Object.freeze({
      id: 'first-steps-mass-spring-damper',
      title: 'First Steps: Mass-Spring-Damper System',
      category: 'First Steps application',
      defaultMode: 'REPF',
      defaultRunOptions: Object.freeze({ mode: 'REPF', opTime: 0.08, cycles: 1, dt: 0.0001, sampleEvery: 800 }),
      defaultDeviceControls: deviceControls({ mode: 'REPF', opTimeMs: 0.08, opDurationMs: 0, repCycles: 1, solverDtMs: 0.0001, sampleEvery: 800, simulationPrecision: 'fine', scopeA: 'X', scopeB: 'Y', scopeMode: 'time', clip: false }),
      description: 'First Steps Section 9.2 underdamped suspension preset with displacement on OUT X and velocity on OUT Y.',
      parameters: Object.freeze([
        parameter('y0', 'initial displacement y0', 'P1', 0.5, 'Initial displacement for the suspension.'),
        parameter('spring', 'spring coefficient s', 'P2', 0.5, 'Spring coefficient.'),
        parameter('damping', 'damping coefficient D', 'P3', 0.05, 'Damper coefficient.'),
        parameter('inverseMass', 'inverse mass 1/m', 'P4', 0.5, 'Mass scaling applied to the force sum.'),
      ]),
      patch: Object.freeze({
      "schemaVersion": "analog-thing-patch/v1",
      "inventory": "that-prototype-board/v006",
      "name": "First Steps: Mass-Spring-Damper System",
      "description": "Exact block-level translation of First Steps Section 9.2: yddot = (1/m) * (-(D*ydot + s*y)). I1 carries -ydot, I2 carries y, and OUT X shows displacement.",
      "components": [
            {
                  "id": "MINUS1"
            },
            {
                  "id": "ZERO"
            },
            {
                  "id": "I1",
                  "rate": 1000,
                  "label": "Integrator / -ydot"
            },
            {
                  "id": "I2",
                  "rate": 1000,
                  "label": "Integrator / y"
            },
            {
                  "id": "INV1",
                  "label": "Inverter / ydot"
            },
            {
                  "id": "SUM1",
                  "label": "Summer / -(D*ydot + s*y)"
            },
            {
                  "id": "P1",
                  "coefficient": 0.5,
                  "label": "P1 initial displacement y0"
            },
            {
                  "id": "P2",
                  "coefficient": 0.5,
                  "label": "P2 spring coefficient s"
            },
            {
                  "id": "P3",
                  "coefficient": 0.05,
                  "label": "P3 damping coefficient D"
            },
            {
                  "id": "P4",
                  "coefficient": 0.5,
                  "label": "P4 inverse mass 1/m"
            },
            {
                  "id": "OUT_X",
                  "label": "X / displacement y"
            },
            {
                  "id": "OUT_Y",
                  "label": "Y / velocity ydot"
            }
      ],
      "cables": [
            {
                  "from": "ZERO.out",
                  "to": "I1.ic",
                  "label": "zero initial velocity: I1.out starts at -ydot = 0"
            },
            {
                  "from": "MINUS1.out",
                  "to": "P1.in",
                  "label": "-1 into P1 gives -y0 for the inverting IC socket"
            },
            {
                  "from": "P1.out",
                  "to": "I2.ic",
                  "label": "initialize I2.out to positive displacement y0"
            },
            {
                  "from": "P4.out",
                  "to": "I1.in1",
                  "label": "acceleration yddot enters the first inverting integrator"
            },
            {
                  "from": "I1.out",
                  "to": "I2.in1",
                  "label": "-ydot into the second inverting integrator yields displacement y"
            },
            {
                  "from": "I1.out",
                  "to": "INV1.in",
                  "label": "invert -ydot to recover positive velocity ydot"
            },
            {
                  "from": "I2.out",
                  "to": "P2.in",
                  "label": "scale displacement by spring coefficient s"
            },
            {
                  "from": "INV1.out",
                  "to": "P3.in",
                  "label": "scale velocity by damping coefficient D"
            },
            {
                  "from": "P2.out",
                  "to": "SUM1.in1",
                  "label": "spring force term s*y"
            },
            {
                  "from": "P3.out",
                  "to": "SUM1.in2",
                  "label": "damper force term D*ydot"
            },
            {
                  "from": "SUM1.out",
                  "to": "P4.in",
                  "label": "negated force sum scaled by inverse mass"
            },
            {
                  "from": "I2.out",
                  "to": "OUT_X.in",
                  "label": "displacement output to OUT X"
            },
            {
                  "from": "INV1.out",
                  "to": "OUT_Y.in",
                  "label": "velocity output to OUT Y for diagnostics"
            }
      ],
      "outputs": {
            "x": "OUT_X.out",
            "y": "OUT_X.out",
            "displacement": "OUT_X.out",
            "velocity": "OUT_Y.out",
            "minusVelocity": "I1.out",
            "forceSum": "SUM1.out",
            "acceleration": "P4.out"
      },
      "parameters": {
            "firstStepsExampleId": "first-steps-mass-spring-damper",
            "page": 16,
            "equation": "yddot = inverseMass * (-(damping*ydot + spring*y))",
            "y0": 0.5,
            "v0": 0,
            "spring": 0.5,
            "damping": 0.05,
            "inverseMass": 0.5,
            "integratorRate": 1000,
            "opTimeSeconds": 0.08,
            "normalizedTimeAtOpTime": 80,
            "expectedInitialDisplacement": 0.5,
            "expectedDisplacementAt80ms": -0.11748783735605553
      }
}),
    }),
    Object.freeze({
      id: 'first-steps-lunar-landing',
      title: 'First Steps: Lunar Landing',
      category: 'First Steps application',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 10, dt: 0.002, sampleEvery: 25 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 10, repCycles: 1, solverDtMs: 0.002, sampleEvery: 25, simulationPrecision: 'fine', scopeA: 'X', scopeB: 'Y', scopeMode: 'time', clip: false }),
      description: 'First Steps Section 9.3 lunar landing preset: P1 is live throttle, OUT X is altitude, OUT Y is vertical velocity, and OUT U is fuel.',
      parameters: Object.freeze([
        parameter('throttle', 'live throttle T control', 'P1', 0.5, 'Pilot descent-engine throttle; the preset includes a booklet-shaped throttle profile for the default run.'),
        parameter('thrustScale', 'thrust scale', 'P2', 0.1, 'Scales the throttle into the T term.'),
        parameter('gravityStageA', 'gravity stage 0.05', 'P3', 0.05, 'First gravity coefficient stage from the booklet diagram.'),
        parameter('gravityStageB', 'gravity stage 0.05', 'P4', 0.05, 'Second gravity coefficient stage from the booklet diagram.'),
        parameter('fuelEfficiency', 'fuel efficiency alpha', 'P5', 0.5, 'Fuel burn per unit thrust.'),
        parameter('altitudeScaleA', 'altitude scale 0.05', 'P6', 0.05, 'First altitude path coefficient stage from the booklet diagram.'),
        parameter('altitudeScaleB', 'altitude scale 0.05', 'P7', 0.05, 'Second altitude path coefficient stage from the booklet diagram.'),
      ]),
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
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 40, dt: 0.002, sampleEvery: 25 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 40, repCycles: 1, solverDtMs: 0.004, sampleEvery: 250, simulationPrecision: 'fine', scopeA: 'X', scopeB: 'Y', scopeMode: 'time', clip: false }),
      description: 'First Steps Section 9.4 scaled Hindmarsh-Rose neuronal bursting preset with x10-weighted x/y equations, x on OUT X, y on OUT Y, -z on OUT Z, XIR/SJ input extension, and SLOW z-channel behavior.',
      parameters: Object.freeze([
        parameter('bStar10', 'b*10 coefficient', 'P1', 0.6, 'Booklet P1 coefficient: x10 input turns this into +6*x².'),
        parameter('aStar10', 'a*10 coefficient', 'P2', 0.4, 'Booklet P2 coefficient: x10 input turns this into -4*x³ after inversion.'),
        parameter('yToX10', '0.75*y x term', 'P3', 0.75, 'Booklet P3 coefficient: x10 input turns this into +7.5*y.'),
        parameter('hundredR', '100r', 'P4', 0.1, 'Scaled slow-channel r coefficient before SLOW division.'),
        parameter('hundredRs', '100rs', 'P5', 0.4, 'Scaled slow-channel rs coefficient before SLOW division.'),
        parameter('hundredRsXr', '100rs*xr offset', 'P6', 0.32, 'Scaled slow-channel offset before SLOW division.'),
        parameter('c', 'c coefficient', 'P7', 0.066, 'Constant c in the y equation.'),
        parameter('dStar10', 'd*10 coefficient', 'P8', 0.133, 'Booklet P8 coefficient: x10 input turns this into about -1.33*x².'),
      ]),
      patch: Object.freeze({
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
}),
    }),
    Object.freeze({
      id: 'first-steps-euler-spiral',
      title: 'First Steps: Euler Spiral',
      category: 'First Steps application',
      defaultMode: 'REPF',
      defaultRunOptions: Object.freeze({ mode: 'REPF', opTime: 120, cycles: 1, dt: 0.005, sampleEvery: 20 }),
      defaultDeviceControls: deviceControls({ mode: 'REPF', opTimeMs: 120, opDurationMs: 0, repCycles: 1, solverDtMs: 0.005, sampleEvery: 20, simulationPrecision: 'fine', scopeA: 'X', scopeB: 'Y', scopeMode: 'xy', clip: false }),
      description: 'First Steps Section 9.5 Euler spiral preset with normalized tau sweep, OP-TIME-aware phase centering, and X/Y oscilloscope display.',
      parameters: Object.freeze([
        parameter('tauRate', 'phase span rate', 'P1', 0.1, 'Virtual phase-span rate used when auto-centering the Euler sweep for the current OP-TIME.'),
        parameter('xScale', 'x scale', 'P2', 0.6, 'Scale for the x-coordinate integration.'),
        parameter('cos0', 'initial cos state magnitude', 'P3', 0.6603167082440802, 'Displayed magnitude of the auto-centered quadrature cos-like state.'),
        parameter('minusSinMagnitude0', 'initial -sin magnitude', 'P4', 0.750987246771676, 'Displayed magnitude of the auto-centered -sin-like quadrature state.'),
        parameter('yScale', 'y scale', 'P5', 0.6, 'Scale for the y-coordinate integration.'),
      ]),
      patch: Object.freeze({
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
}),
    }),
    Object.freeze({
      id: 'first-steps-hunter-prey',
      title: 'First Steps: Hunter/Prey Population Dynamics',
      category: 'First Steps application',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 100, dt: 0.01, sampleEvery: 5 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 100, repCycles: 1, solverDtMs: 0.01, sampleEvery: 5, simulationPrecision: 'balanced', scopeA: 'X', scopeB: 'Y', scopeMode: 'time', clip: false }),
      description: 'First Steps Section 9.6 Lotka-Volterra population preset with hare on OUT X and lynx on OUT Y in booklet roll-mode time display; X/Y phase-space remains available manually.',
      parameters: Object.freeze([
        parameter('h0', 'initial hare population h0', 'P1', 0.6, 'Initial hare population.'),
        parameter('l0', 'initial lynx population l0', 'P2', 0.6, 'Initial lynx population.'),
        parameter('alpha', 'hare growth alpha', 'P3', 0.365, 'Natural hare growth coefficient.'),
        parameter('beta', 'predation beta', 'P4', 0.95, 'Rate at which lynx consume hare.'),
        parameter('gamma', 'lynx death gamma', 'P5', 0.09, 'Natural lynx death coefficient.'),
        parameter('delta', 'lynx growth delta', 'P6', 0.84, 'Lynx growth from available hare population.'),
      ]),
      patch: Object.freeze({
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
}),
    }),
    Object.freeze({
      id: 'first-steps-lorenz-attractor',
      title: 'First Steps: Lorenz Attractor',
      category: 'First Steps application',
      defaultMode: 'OP',
      defaultRunOptions: Object.freeze({ mode: 'OP', duration: 300, dt: 0.01, sampleEvery: 5 }),
      defaultDeviceControls: deviceControls({ mode: 'OP', opTimeMs: 8, opDurationMs: 300, repCycles: 1, solverDtMs: 0.01, sampleEvery: 5, simulationPrecision: 'balanced', scopeA: 'X', scopeB: 'Y', scopeMode: 'xy', clip: false }),
      description: 'First Steps Section 9.7 Lorenz attractor preset with x on OUT X, y on OUT Y, z on OUT Z, and projection-ready scope routing.',
      parameters: Object.freeze([
        parameter('x0', 'initial x helper', 'P7', 0.18, 'Nonzero initial x value used to start the chaotic trajectory.'),
        parameter('yToXCoefficient', 'y-to-x coefficient', 'P1', 0.18, 'Used through x10 weighting as 1.8 in the x equation.'),
        parameter('xyCoefficient', 'xy coefficient', 'P2', 0.15, 'Used through x10 weighting as 1.5 in the z equation.'),
        parameter('zDamping', 'z damping beta', 'P3', 0.2667, 'Damping term in the z equation.'),
        parameter('zShapeCoefficient', 'z shaping coefficient', 'P4', 0.268, 'Used through x10 weighting as 2.68 in s = -(1 - 2.68z).'),
        parameter('rCoefficient', 'r coefficient', 'P5', 0.1536, 'Used through x10 weighting as 1.536 in the y equation.'),
        parameter('yDamping', 'y damping coefficient', 'P6', 0.1, 'Damping term in the y equation.'),
      ]),
      patch: Object.freeze({
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
}),
    }),
    Object.freeze({
      id: 'first-steps-bouncing-ball',
      title: 'First Steps: Bouncing Ball',
      category: 'First Steps application',
      defaultMode: 'REPF',
      defaultRunOptions: Object.freeze({ mode: 'REPF', opTime: 20, cycles: 1, dt: 0.001, sampleEvery: 20 }),
      defaultDeviceControls: deviceControls({ mode: 'REPF', opTimeMs: 20, opDurationMs: 0, repCycles: 1, solverDtMs: 0.001, sampleEvery: 20, simulationPrecision: 'fine', scopeA: 'X', scopeB: 'Y', scopeMode: 'xy', clip: false }),
      description: 'First Steps Section 9.8 bouncing ball preset with x on OUT X, y routed through standard INV2 on OUT Y, velocity diagnostics on OUT Z/U, and diode/Z-diode contact detectors.',
      parameters: Object.freeze([]),
      patch: Object.freeze({
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
})
    }),
    Object.freeze({
      id: 'first-steps-polynomial-generator',
      title: 'First Steps: Polynomial Generator',
      category: 'First Steps application',
      defaultMode: 'REPF',
      defaultRunOptions: Object.freeze({ mode: 'REPF', opTime: 2, cycles: 2, dt: 0.001, sampleEvery: 20 }),
      defaultDeviceControls: deviceControls({ mode: 'REPF', opTimeMs: 2, opDurationMs: 0, repCycles: 2, solverDtMs: 0.001, sampleEvery: 20, simulationPrecision: 'fine', scopeA: 'X', scopeB: 'Y', scopeMode: 'xy', clip: false }),
      description: 'First Steps Section 9.9 polynomial generator preset with x on OUT X, p(x) on OUT Y, and X/Y display routing.',
      parameters: Object.freeze([
        parameter('rampRate', 'tau ramp speed', 'P1', 1, 'Ramp speed for x from -1 to +1 across the default run.'),
        parameter('d', 'constant term d', 'P2', 0.1, 'Constant term in p(x).'),
        parameter('c', 'linear coefficient c', 'P3', 0.7, 'Linear coefficient for c*x.'),
        parameter('b', 'quadratic coefficient b', 'P4', 0.4, 'Quadratic coefficient for b*x^2.'),
        parameter('aMagnitude', 'cubic coefficient magnitude |a|', 'P5', 0.3, 'Magnitude of the default negative cubic coefficient; the patch feeds P5 from -x^3.'),
      ]),
      patch: Object.freeze({
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
}),
    }),
  ]);

  function isQuickStartBookletTemplateId(id) {
    return id === 'empty-panel' || String(id || '').startsWith('first-steps-');
  }

  function visibleTemplateDefinitions(options = {}) {
    return options.includeNonBookletExamples ? TEMPLATE_DEFINITIONS : TEMPLATE_DEFINITIONS.filter((template) => isQuickStartBookletTemplateId(template.id));
  }

  function getPatchTemplates(options = {}) {
    return visibleTemplateDefinitions(options).map((template) => ({
      id: template.id,
      title: template.title,
      category: template.category,
      description: template.description,
      defaultMode: template.defaultMode,
      defaultRunOptions: clonePlain(template.defaultRunOptions),
      defaultDeviceControls: clonePlain(template.defaultDeviceControls || deviceControls()),
      parameters: clonePlain(template.parameters),
      componentCount: template.patch.components.length,
      cableCount: template.patch.cables.length,
      outputNames: Object.keys(template.patch.outputs || {}),
    }));
  }

  function getPatchTemplate(id) {
    const found = TEMPLATE_DEFINITIONS.find((template) => template.id === id) || TEMPLATE_DEFINITIONS[0];
    return {
      id: found.id,
      title: found.title,
      category: found.category,
      description: found.description,
      defaultMode: found.defaultMode,
      defaultRunOptions: clonePlain(found.defaultRunOptions),
      defaultDeviceControls: clonePlain(found.defaultDeviceControls || deviceControls()),
      parameters: clonePlain(found.parameters),
      patch: clonePlain(found.patch),
    };
  }

  function listTemplateParameterSpecs(templateOrId) {
    const template = typeof templateOrId === 'string' ? getPatchTemplate(templateOrId) : templateOrId;
    return clonePlain((template && template.parameters) || []);
  }

  function componentById(patchObject, componentId) {
    return (patchObject.components || []).find((component) => component.id === componentId) || null;
  }

  function setTemplateParameter(patchObject, templateOrId, name, value) {
    const template = typeof templateOrId === 'string' ? getPatchTemplate(templateOrId) : templateOrId;
    const spec = ((template && template.parameters) || []).find((item) => item.name === name);
    if (!spec) throw new Error(`template parameter not found: ${name}`);
    const next = clonePlain(patchObject);
    const component = componentById(next, spec.componentId);
    if (!component) throw new Error(`component ${spec.componentId} for parameter ${name} is not present in patch`);
    const coerced = clampParameter(value, spec);
    component[spec.property || 'coefficient'] = coerced;
    next.parameters = { ...(next.parameters || {}), [name]: coerced };
    return next;
  }

  function setTemplateParameters(patchObject, templateOrId, parameterValues = {}) {
    const template = typeof templateOrId === 'string' ? getPatchTemplate(templateOrId) : templateOrId;
    let next = clonePlain(patchObject);
    for (const spec of template.parameters || []) {
      const value = Object.prototype.hasOwnProperty.call(parameterValues, spec.name) ? parameterValues[spec.name] : spec.defaultValue;
      next = setTemplateParameter(next, template, spec.name, value);
    }
    return next;
  }

  function createPatchFromTemplate(templateId, parameterValues = {}, controlOverrides = {}) {
    const template = getPatchTemplate(templateId);
    const patchObject = clonePlain(template.patch);
    patchObject.name = patchObject.name || template.title;
    patchObject.description = patchObject.description || template.description;
    patchObject.template = { id: template.id, title: template.title, category: template.category };
    patchObject.deviceControls = deviceControlsForTemplate(template, controlOverrides);
    return setTemplateParameters(patchObject, template, parameterValues);
  }

  function normalizeDeviceControls(raw = {}, fallback = deviceControls()) {
    const source = Object.assign({}, fallback || {}, raw || {});
    const mode = ['OFF', 'COEFF', 'IC', 'OP', 'HALT', 'REP', 'REPF', 'MINION'].includes(source.mode) ? source.mode : (fallback && fallback.mode) || 'OP';
    const numeric = (value, fb, min = 0) => {
      const coerced = Number(value);
      return Number.isFinite(coerced) && coerced >= min ? coerced : fb;
    };
    const integer = (value, fb) => Math.max(1, Math.round(numeric(value, fb, 1)));
    return {
      mode,
      opTimeMs: numeric(source.opTimeMs, mode === 'REP' ? 1000 : 8, 0),
      opDurationMs: numeric(source.opDurationMs, 0, 0),
      repCycles: integer(source.repCycles, 1),
      solverDtMs: numeric(source.solverDtMs, 0.01, 0.000001),
      sampleEvery: integer(source.sampleEvery, 1),
      simulationPrecision: ['quick', 'balanced', 'fine', 'ultra'].includes(source.simulationPrecision || source.precision) ? (source.simulationPrecision || source.precision) : 'balanced',
      scopeA: ['X', 'Y', 'Z', 'U'].includes(source.scopeA) ? source.scopeA : 'Y',
      scopeB: source.scopeB === 'none' || ['X', 'Y', 'Z', 'U'].includes(source.scopeB) ? source.scopeB : 'none',
      scopeMode: source.scopeMode === 'xy' ? 'xy' : 'time',
      clip: Boolean(source.clip),
    };
  }

  function deviceControlsForTemplate(templateOrId, overrides = {}) {
    const template = typeof templateOrId === 'string' ? getPatchTemplate(templateOrId) : templateOrId;
    return normalizeDeviceControls(overrides, (template && template.defaultDeviceControls) || deviceControls());
  }

  function deviceControlsFromPatch(patchObject, templateOrId) {
    const template = templateOrId ? (typeof templateOrId === 'string' ? getPatchTemplate(templateOrId) : templateOrId) : null;
    const fallback = template ? deviceControlsForTemplate(template) : deviceControls();
    const embedded = (patchObject && (patchObject.deviceControls || (patchObject.parameters && patchObject.parameters.deviceControls))) || {};
    return normalizeDeviceControls(embedded, fallback);
  }

  function patchWithDeviceControls(patchObject, controls, templateOrId) {
    const next = clonePlain(patchObject);
    next.deviceControls = normalizeDeviceControls(controls, templateOrId ? deviceControlsForTemplate(templateOrId) : deviceControlsFromPatch(patchObject, templateOrId));
    return next;
  }

  function readTemplateParameters(patchObject, templateOrId) {
    const template = typeof templateOrId === 'string' ? getPatchTemplate(templateOrId) : templateOrId;
    const values = {};
    for (const spec of (template && template.parameters) || []) {
      const component = componentById(patchObject, spec.componentId);
      const raw = component && component[spec.property || 'coefficient'];
      values[spec.name] = clampParameter(raw === undefined ? (patchObject.parameters || {})[spec.name] : raw, spec);
    }
    return values;
  }

  function inferComponentType(componentId) {
    if (/^(PLUS1|MINUS1|ZERO)$/.test(componentId)) return 'constant';
    if (/^I\d+$/.test(componentId)) return 'integrator';
    if (/^INV\d+$/.test(componentId)) return 'inverter';
    if (/^SUM\d+$/.test(componentId)) return 'summer';
    if (/^P\d+$/.test(componentId)) return 'potentiometer';
    if (/^MUL\d+$/.test(componentId)) return 'multiplier';
    if (/^CMP\d+$/.test(componentId)) return 'comparator';
    if (/^XIR\d+$/.test(componentId)) return 'xir';
    if (/^OUT_[XYZU]$/.test(componentId)) return 'output';
    return 'component';
  }

  function splitSocket(socketId) {
    const parts = String(socketId).split('.');
    if (parts.length !== 2) return null;
    return { componentId: parts[0], socketName: parts[1] };
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function createGenericPanelModel(patchObject, options = {}) {
    const patchValue = clonePlain(patchObject);
    const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, patchValue.components.length))));
    const w = 116;
    const h = 60;
    const gapX = 52;
    const gapY = 46;
    const left = 32;
    const top = 36;
    const inputSockets = new Map();
    const outputSockets = new Map();
    for (const cable of patchValue.cables || []) {
      const from = splitSocket(cable.from);
      const to = splitSocket(cable.to);
      if (from) outputSockets.set(from.componentId, unique([...(outputSockets.get(from.componentId) || []), from.socketName]));
      if (to) inputSockets.set(to.componentId, unique([...(inputSockets.get(to.componentId) || []), to.socketName]));
    }
    for (const outputSocket of Object.values(patchValue.outputs || {})) {
      const endpoint = splitSocket(outputSocket);
      if (endpoint) outputSockets.set(endpoint.componentId, unique([...(outputSockets.get(endpoint.componentId) || []), endpoint.socketName]));
    }
    const components = (patchValue.components || []).map((component, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const type = component.type || inferComponentType(component.id);
      return {
        id: component.id,
        type,
        label: component.label || component.id,
        role: type,
        x: left + col * (w + gapX),
        y: top + row * (h + gapY),
        w,
        h,
        inputs: inputSockets.get(component.id) || [],
        outputs: outputSockets.get(component.id) || ['out'],
      };
    });
    return {
      name: `${patchValue.name || 'serialized patch'} template panel`,
      activeTemplate: options.templateId || (patchValue.template && patchValue.template.id) || '',
      width: left * 2 + columns * w + Math.max(0, columns - 1) * gapX,
      height: top * 2 + Math.ceil(Math.max(1, components.length) / columns) * h + Math.max(0, Math.ceil(Math.max(1, components.length) / columns) - 1) * gapY,
      components,
      cables: (patchValue.cables || []).map((cable, index) => ({ id: `t-c${index + 1}`, from: cable.from, to: cable.to, label: cable.label || `${cable.from} -> ${cable.to}` })),
      tutorialSteps: [
        'Choose a template to replace the serialized patch JSON with a reusable starting point.',
        'Edit coefficient parameters or cable text, then validate before running the patch.',
        'Use the serialized-patch browser runner to execute any valid template patch.',
      ],
      serializedPatch: patchValue,
    };
  }

  function summarizeTemplatePatch(patchObject, templateOrId) {
    const template = typeof templateOrId === 'string' ? getPatchTemplate(templateOrId) : templateOrId;
    const patchValue = clonePlain(patchObject);
    return {
      name: patchValue.name || '',
      templateId: template && template.id,
      templateTitle: template && template.title,
      schemaVersion: patchValue.schemaVersion || '',
      componentCount: (patchValue.components || []).length,
      cableCount: (patchValue.cables || []).length,
      outputNames: Object.keys(patchValue.outputs || {}),
      parameterValues: template ? readTemplateParameters(patchValue, template) : clonePlain(patchValue.parameters || {}),
      deviceControls: deviceControlsFromPatch(patchValue, template),
    };
  }


  function summarizeDevicePreset(templateOrId, options = {}) {
    const template = typeof templateOrId === 'string' ? getPatchTemplate(templateOrId) : templateOrId;
    const patchObject = options.patch ? clonePlain(options.patch) : createPatchFromTemplate(template.id);
    const controls = deviceControlsFromPatch(patchObject, template);
    const parameters = template ? readTemplateParameters(patchObject, template) : {};
    const coefficientDefaults = [];
    for (const spec of (template && template.parameters) || []) {
      coefficientDefaults.push({
        id: spec.componentId,
        name: spec.name,
        label: spec.label,
        value: parameters[spec.name],
      });
    }
    const wiredOutputs = [];
    for (const [name, socket] of Object.entries((patchObject && patchObject.outputs) || {})) {
      if (/^OUT_[XYZU]\.out$/.test(String(socket))) wiredOutputs.push(String(socket).slice(4, 5));
      else wiredOutputs.push(name);
    }
    return {
      id: template && template.id,
      title: template && template.title,
      category: template && template.category,
      description: template && template.description,
      componentCount: ((patchObject && patchObject.components) || []).length,
      cableCount: ((patchObject && patchObject.cables) || []).length,
      coefficientDefaults,
      controls,
      scope: { ch1: controls.scopeA, ch2: controls.scopeB, mode: controls.scopeMode },
      opTimeLabel: controls.mode === 'REP' ? `${controls.opTimeMs} ms / 0–10000 ms range` : `${controls.opTimeMs} ms / 0–100 ms range`,
      precisionLabel: controls.simulationPrecision || 'balanced',
      outputChannels: wiredOutputs,
    };
  }

  function renderDevicePresetPreview(container, templateOrId, options = {}) {
    if (!container) return summarizeDevicePreset(templateOrId, options);
    const summary = summarizeDevicePreset(templateOrId, options);
    const coefficients = summary.coefficientDefaults.length
      ? summary.coefficientDefaults.map((item) => `${escapeText(item.id)}=${Number(item.value).toFixed(3)}`).join(', ')
      : 'no coefficient preset';
    const scopeB = summary.scope.ch2 && summary.scope.ch2 !== 'none' ? summary.scope.ch2 : 'none';
    container.innerHTML = `<div class="preset-summary-card" data-device-preset-preview="${escapeText(summary.id || '')}">
      <div class="preset-summary-title">
        <strong>${escapeText(summary.title || 'Preset')}</strong>
        <span>${escapeText(summary.category || 'setup')}</span>
      </div>
      <dl class="preset-summary-grid">
        <div><dt>wires</dt><dd>${summary.cableCount}</dd></div>
        <div><dt>components</dt><dd>${summary.componentCount}</dd></div>
        <div><dt>mode</dt><dd>${escapeText(summary.controls.mode)}</dd></div>
        <div><dt>OP-TIME</dt><dd>${escapeText(summary.opTimeLabel)}</dd></div>
        <div><dt>precision</dt><dd>${escapeText(summary.precisionLabel)}</dd></div>
        <div><dt>scope</dt><dd>${escapeText(summary.scope.ch1)} / ${escapeText(scopeB)} · ${escapeText(summary.scope.mode)}</dd></div>
        <div><dt>coefficients</dt><dd>${coefficients}</dd></div>
      </dl>
      <p>Loading this setup replaces the panel wiring and front-panel control preset. It does not recompute the trace unless auto-run is enabled.</p>
    </div>`;
    return summary;
  }

  function populateTemplateSelect(select, templates) {
    if (!select) return;
    select.innerHTML = templates.map((template) => `<option value="${escapeText(template.id)}">${escapeText(template.title)}</option>`).join('');
  }

  function renderTemplateParameters(container, template, values = {}) {
    if (!container) return;
    const specs = (template && template.parameters) || [];
    if (specs.length === 0) {
      container.innerHTML = '<p class="muted">This template has no coefficient parameters.</p>';
      return;
    }
    container.innerHTML = specs.map((spec) => {
      const value = values[spec.name] === undefined ? spec.defaultValue : values[spec.name];
      return `<label class="template-parameter" for="templateParam_${escapeText(spec.name)}">
        <span>${escapeText(spec.label)} <strong data-template-value-for="${escapeText(spec.name)}">${Number(value).toFixed(2)}</strong></span>
        <input id="templateParam_${escapeText(spec.name)}" name="${escapeText(spec.name)}" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${value}">
        <small>${escapeText(spec.description || '')}</small>
      </label>`;
    }).join('');
  }

  const api = {
    PATCH_SCHEMA_VERSION,
    DEFAULT_INVENTORY_NAME,
    getPatchTemplates,
    getPatchTemplate,
    listTemplateParameterSpecs,
    createPatchFromTemplate,
    setTemplateParameter,
    setTemplateParameters,
    readTemplateParameters,
    normalizeDeviceControls,
    deviceControlsForTemplate,
    deviceControlsFromPatch,
    patchWithDeviceControls,
    createGenericPanelModel,
    summarizeTemplatePatch,
    populateTemplateSelect,
    summarizeDevicePreset,
    renderDevicePresetPreview,
    renderTemplateParameters,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingPatchTemplatesApp = api;
}(typeof window !== 'undefined' ? window : global));
