'use strict';

(function attachDesignTemplates(globalScope) {
  const nodeRequire = typeof require === 'function' ? require : null;
  const TEMPLATE_SCHEMA_VERSION = 'analog-thing-design-template/v1';
  const TEMPLATE_MANIFEST_PATH = 'designs/templates/manifest.json';
  const DESIGN_SCHEMA_VERSION = 'analog-thing-design/v1';
  const DEFAULT_NOW = '2026-05-26T00:00:00.000Z';

  function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }

  function getDesignStorage() {
    if (globalScope.AnalogThingDesignStorage) return globalScope.AnalogThingDesignStorage;
    if (nodeRequire) {
      try { return nodeRequire('./designStorage'); } catch (error) { return null; }
    }
    return null;
  }

  function getCoreDesign() {
    if (globalScope.AnalogThingCoreDesign) return globalScope.AnalogThingCoreDesign;
    if (nodeRequire) {
      try { return nodeRequire('./design'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignDiagnostics() {
    if (globalScope.AnalogThingDesignDiagnostics) return globalScope.AnalogThingDesignDiagnostics;
    if (nodeRequire) {
      try { return nodeRequire('./designDiagnostics'); } catch (error) { return null; }
    }
    return null;
  }

  function getDesignRuntime() {
    if (globalScope.AnalogThingDesignRuntime) return globalScope.AnalogThingDesignRuntime;
    if (nodeRequire) {
      try { return nodeRequire('./designRuntime'); } catch (error) { return null; }
    }
    return null;
  }

  function normalizeDesign(design, options = {}) {
    const core = getCoreDesign();
    if (core && core.normalizeDesign) return core.normalizeDesign(design, options);
    if (!design || typeof design !== 'object') throw new Error('template design must be an object');
    return clonePlain(Object.assign({ schemaVersion: DESIGN_SCHEMA_VERSION, kind: 'custom-design' }, design));
  }

  function normalizeWalkthrough(walkthrough) {
    if (!Array.isArray(walkthrough)) return [];
    return walkthrough.map((step, index) => {
      if (typeof step === 'string') return { title: `Step ${index + 1}`, text: step };
      return {
        title: step && step.title ? String(step.title) : `Step ${index + 1}`,
        text: step && step.text ? String(step.text) : '',
        socketFocus: Array.isArray(step && step.socketFocus) ? step.socketFocus.map(String) : [],
        controlFocus: Array.isArray(step && step.controlFocus) ? step.controlFocus.map(String) : [],
      };
    }).filter((step) => step.text);
  }

  const BLANK_TEMPLATE_DESIGN = Object.freeze({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    kind: 'custom-design',
    inventory: 'that-prototype-board/v006',
    metadata: Object.freeze({
      name: 'Blank zero-output design',
      description: 'A safe starter design with a single zero-valued output, intended to be edited into a new custom program.',
      author: '',
      source: 'built-in custom-design template',
      tags: Object.freeze(['template-design', 'blank', 'starter']),
      createdAt: DEFAULT_NOW,
      modifiedAt: DEFAULT_NOW,
      notes: 'Delete or replace the ZERO to OUT_Y cable when starting a real patch. The placeholder keeps the template executable and validation-clean.',
    }),
    components: Object.freeze([
      Object.freeze({ id: 'ZERO' }),
      Object.freeze({ id: 'OUT_Y', label: 'Y / blank zero output' }),
    ]),
    coefficients: Object.freeze({ P1: 0.5, P2: 0.5, P3: 0.5, P4: 0.5, P5: 0.5, P6: 0.5, P7: 0.5, P8: 0.5 }),
    cables: Object.freeze([
      Object.freeze({ id: 'cable-1', from: Object.freeze({ logicalSocketId: 'ZERO.out', physicalSocketId: null }), to: Object.freeze({ logicalSocketId: 'OUT_Y.in', physicalSocketId: null }), label: 'safe zero placeholder', color: null }),
    ]),
    outputRouting: Object.freeze({ channels: Object.freeze({ X: null, Y: 'OUT_Y.out', Z: null, U: null }), aliases: Object.freeze({ y: 'OUT_Y.out', blank: 'OUT_Y.out' }) }),
    operationDefaults: Object.freeze({ mode: 'OP', duration: 0, dt: 0.01, sampleEvery: 1, opTime: 8, cycles: 3, clip: false }),
    notes: 'Safe blank/starter template. Replace the placeholder output and cable with the intended circuit.',
    sourcePatchSchemaVersion: null,
  });

  const TEMPLATE_WALKTHROUGHS = Object.freeze({
    'blank-design': Object.freeze([
      Object.freeze({ title: 'Start from a known-good empty canvas', text: 'The template intentionally routes ZERO to Y so validation and runtime checks succeed before any user edits are made.', socketFocus: Object.freeze(['ZERO.out', 'OUT_Y.in']), controlFocus: Object.freeze(['Y']) }),
      Object.freeze({ title: 'Replace the placeholder', text: 'Delete the ZERO to OUT_Y cable, add the components you need, then route the signal you want to inspect back to X, Y, Z, or U.' }),
    ]),
    'quickstart-damped-oscillation': Object.freeze([
      Object.freeze({ title: 'Initialize the state', text: 'The IC cables set the two integrators before OP or REPF runs: velocity starts from +1 through THAT sign convention, while position starts from zero.', socketFocus: Object.freeze(['I1.ic', 'I2.ic']) }),
      Object.freeze({ title: 'Build the force path', text: 'Position and velocity are scaled by P1 and P2, summed by SUM1, then scaled by P3 as the inverse-mass term feeding the acceleration integrator.', controlFocus: Object.freeze(['P1', 'P2', 'P3']) }),
      Object.freeze({ title: 'Watch repeated operation', text: 'REPF repeats IC followed by OP so the X/Y traces can be compared cycle by cycle for decay and zero crossings.' }),
    ]),
    'static-inverter': Object.freeze([
      Object.freeze({ title: 'Scale +1', text: 'P1 converts the +1 machine-unit source into a coefficient-controlled constant.' }),
      Object.freeze({ title: 'Invert the sign', text: 'INV1 negates the scaled value and routes it to Y, which is useful for checking coefficient and sign conventions.' }),
    ]),
    'summer-scaling': Object.freeze([
      Object.freeze({ title: 'Create two terms', text: 'P1 receives +1 and P2 receives -1, producing a positive and a negative weighted contribution.' }),
      Object.freeze({ title: 'Use the negating summer', text: 'SUM1 emits the negative of the sum of its inputs, matching the THAT-style summer sign convention.' }),
    ]),
    'multiplier-product': Object.freeze([
      Object.freeze({ title: 'Prepare X and Y factors', text: 'P1 and P2 scale +1 and -1 into the two multiplier inputs.' }),
      Object.freeze({ title: 'Route the product', text: 'MUL1 outputs the normalized four-quadrant product and the template routes it to Y.' }),
    ]),
    'comparator-switch': Object.freeze([
      Object.freeze({ title: 'Drive the sign test', text: 'P1 and P2 feed comparator inputs A and B; the comparator selects based on the sign of A + B.' }),
      Object.freeze({ title: 'Use the middle comparator sockets', text: 'The >0 and <0 jacks are explicit middle sockets on the physical panel, and the selected branch appears at OUT.' }),
    ]),
    'xir-summing-junction': Object.freeze([
      Object.freeze({ title: 'Patch an ordinary summer term', text: 'P1 feeds SUM1.in1 as a conventional weighted summer input.' }),
      Object.freeze({ title: 'Add an XIR contribution', text: 'P2 drives XIR1.in10_1, XIR1.out enters the summer summing junction, and SUM1.out shows the combined negated result.' }),
    ]),
    'first-steps-radioactive-decay': Object.freeze([
      Object.freeze({ title: 'Set the initial amount', text: 'PLUS1 feeds P1, so P1 directly sets N0. P1.out goes to I1.ic, which initializes the integrator output to -N0.', socketFocus: Object.freeze(['PLUS1.out', 'P1.in', 'P1.out', 'I1.ic']), controlFocus: Object.freeze(['P1']) }),
      Object.freeze({ title: 'Close the decay feedback loop', text: 'I1.out carries -N and is fed through P2. Because the integrator inverts its input, this loop implements Ndot = -lambda*N.', socketFocus: Object.freeze(['I1.out', 'P2.in', 'P2.out', 'I1.in1']), controlFocus: Object.freeze(['P2']) }),
      Object.freeze({ title: 'Display positive N', text: 'INV1 changes -N back to N and routes the decay curve to OUT X for repeated-sweep display in REPF mode.', socketFocus: Object.freeze(['I1.out', 'INV1.in', 'INV1.out', 'OUT_X.in']), controlFocus: Object.freeze(['X']) }),
    ]),
    'first-steps-mass-spring-damper': Object.freeze([
      Object.freeze({ title: 'Initialize displacement and velocity', text: 'P1 is fed from -1 so its output initializes I2.out to positive y0 through the inverting IC socket. ZERO initializes I1.out to zero velocity.', socketFocus: Object.freeze(['MINUS1.out', 'P1.in', 'P1.out', 'I2.ic', 'ZERO.out', 'I1.ic']), controlFocus: Object.freeze(['P1']) }),
      Object.freeze({ title: 'Cascade the two integrators', text: 'P4.out feeds I1 as acceleration. I1.out carries -ydot, which feeds I2 so I2.out becomes displacement y.', socketFocus: Object.freeze(['P4.out', 'I1.in1', 'I1.out', 'I2.in1', 'I2.out']) }),
      Object.freeze({ title: 'Build the spring and damper force sum', text: 'I2.out is scaled by P2 as s*y. INV1 recovers ydot from -ydot, P3 scales it as D*ydot, and SUM1 forms -(D*ydot + s*y).', socketFocus: Object.freeze(['I2.out', 'P2.in', 'P2.out', 'I1.out', 'INV1.in', 'INV1.out', 'P3.in', 'P3.out', 'SUM1.in1', 'SUM1.in2']), controlFocus: Object.freeze(['P2', 'P3']) }),
      Object.freeze({ title: 'Scale by inverse mass and display displacement', text: 'P4 applies 1/m to the negated force sum. I2.out is routed to OUT X as the underdamped suspension displacement, with velocity also available on OUT Y for diagnostics.', socketFocus: Object.freeze(['SUM1.out', 'P4.in', 'P4.out', 'I2.out', 'OUT_X.in', 'INV1.out', 'OUT_Y.in']), controlFocus: Object.freeze(['P4', 'X', 'Y']) }),
    ]),
    'first-steps-lunar-landing': Object.freeze([
      Object.freeze({ title: 'Initialize altitude and fuel', text: 'The altitude and fuel integrators start from +1 through the THAT inverted IC convention. The vertical velocity integrator starts at zero, matching the booklet roll-mode trace before the throttle-induced descent begins.', socketFocus: Object.freeze(['MINUS1.out', 'I2.ic', 'I3.ic', 'I1.out']), controlFocus: Object.freeze(['P6', 'P7']) }),
      Object.freeze({ title: 'Control thrust with P1', text: 'P1 is the pilot throttle and the preset uses a built-in demonstration profile so the default trace reproduces the booklet-style dip, recovery, and final near-level descent. P2 scales throttle to the T term, CMP1 passes thrust only while fuel F remains positive, and SUM1 combines the two gravity-stage inputs with thrust into the velocity derivative.', socketFocus: Object.freeze(['P1.out', 'P2.in', 'P2.out', 'CMP1.a', 'CMP1.positive', 'CMP1.out', 'P4.out', 'SUM1.in10_1', 'SUM1.in10_2', 'SUM1.in2', 'I1.in1']), controlFocus: Object.freeze(['P1', 'P2', 'P3', 'P4']) }),
      Object.freeze({ title: 'Burn fuel and scale altitude', text: 'P5 converts available thrust into fuel burn for I3. CMP2 watches altitude and sends -v through the P6/P7 altitude-scaling path only while h is above zero, holding altitude after touchdown.', socketFocus: Object.freeze(['CMP1.out', 'P5.in', 'P5.out', 'I3.in1', 'I2.out', 'CMP2.a', 'INV2.out', 'CMP2.positive', 'CMP2.out', 'P6.in', 'P7.in', 'I2.in1']), controlFocus: Object.freeze(['P5', 'P6', 'P7']) }),
      Object.freeze({ title: 'Display the landing', text: 'OUT X carries altitude h, OUT Y carries vertical velocity v, OUT Z carries available thrust, and OUT U carries fuel level for the panel-meter equivalent.', socketFocus: Object.freeze(['OUT_X.in', 'OUT_Y.in', 'OUT_Z.in', 'OUT_U.in']), controlFocus: Object.freeze(['X', 'Y', 'U']) }),
    ]),
    'first-steps-neuronal-bursting': Object.freeze([
      Object.freeze({ title: 'Initialize the neuronal states', text: 'MINUS1 initializes I1.out to x=+1 through the inverting IC socket. ZERO initializes y, and PLUS1 initializes I3.out to -z=-1. P3 is the 0.75*y scaling term used in the x equation.', socketFocus: Object.freeze(['MINUS1.out', 'I1.ic', 'ZERO.out', 'I2.ic', 'PLUS1.out', 'I3.ic', 'P3.in', 'P3.out']), controlFocus: Object.freeze(['P3']) }),
      Object.freeze({ title: 'Generate x² and x³', text: 'MUL1 squares x and MUL2 multiplies x² by x. P1 feeds an x10 summer input to make the effective +6*x² term, while P2 plus INV1 feeds an x10 input to make -4*x³.', socketFocus: Object.freeze(['I1.out', 'MUL1.x', 'MUL1.y', 'MUL1.out', 'MUL2.x', 'MUL2.y', 'MUL2.out', 'P1.out', 'P2.out', 'INV1.out']), controlFocus: Object.freeze(['P1', 'P2']) }),
      Object.freeze({ title: 'Build the x and y equations', text: 'SUM1 combines -4*x³, +6*x², +7.5*y, -z, and Iext from XIR1 to drive the x integrator. SUM2 combines c, about -1.33*x², and -y to drive the y integrator.', socketFocus: Object.freeze(['SUM1.in10_1', 'SUM1.in10_2', 'SUM1.in10_3', 'SUM1.in1', 'XIR1.out', 'SUM1.sj', 'SUM1.out', 'SUM2.in1', 'SUM2.in10_1', 'SUM2.in2', 'SUM2.out']), controlFocus: Object.freeze(['P3', 'P7', 'P8']) }),
      Object.freeze({ title: 'Use SLOW for the z channel', text: 'P5 scales x as 100rs, P6 supplies the 100rs*xr offset, and P4 scales -z as 100r. XIR2 joins the offset and damping terms, while I3.out patched to I3.slow applies the 0.01 speed factor.', socketFocus: Object.freeze(['I1.out', 'P5.in', 'P5.out', 'I3.in1', 'PLUS1.out', 'P6.in', 'P6.out', 'I3.out', 'P4.in', 'P4.out', 'XIR2.out', 'I3.sj', 'I3.slow']), controlFocus: Object.freeze(['P4', 'P5', 'P6']) }),
      Object.freeze({ title: 'Display the burst channels', text: 'OUT X carries the scaled membrane-potential trace x, OUT Y carries y, OUT Z carries -z, and OUT U carries positive z for diagnostics. The preset opens with X as the main time trace.', socketFocus: Object.freeze(['OUT_X.in', 'OUT_Y.in', 'OUT_Z.in', 'OUT_U.in']), controlFocus: Object.freeze(['X', 'Y', 'Z', 'U']) }),
    ]),
    'first-steps-hunter-prey': Object.freeze([
      Object.freeze({ title: 'Initialize the populations', text: 'P1 and P2 are fed from -1 so their outputs initialize I1.out to h0 and I2.out to l0 through the inverting IC sockets.', socketFocus: Object.freeze(['MINUS1.out', 'P1.in', 'P1.out', 'I1.ic', 'P2.in', 'P2.out', 'I2.ic']), controlFocus: Object.freeze(['P1', 'P2']) }),
      Object.freeze({ title: 'Create the interaction term', text: 'I1.out and I2.out feed MUL1, which computes the h*l encounter term shared by both population equations.', socketFocus: Object.freeze(['I1.out', 'MUL1.x', 'I2.out', 'MUL1.y', 'MUL1.out']) }),
      Object.freeze({ title: 'Build both Lotka-Volterra equations', text: 'P3/P4 form alpha*h and beta*h*l for the hare equation. P5/P6 form gamma*l and delta*h*l for the lynx equation. The summers provide the signs needed by the inverting integrators.', controlFocus: Object.freeze(['P3', 'P4', 'P5', 'P6']) }),
      Object.freeze({ title: 'Display time traces or phase space', text: 'OUT X carries hare population h and OUT Y carries lynx population l, so the same run can be viewed as roll traces or an X/Y phase plot.', socketFocus: Object.freeze(['I1.out', 'OUT_X.in', 'I2.out', 'OUT_Y.in']), controlFocus: Object.freeze(['X', 'Y']) }),
    ]),
    'first-steps-lorenz-attractor': Object.freeze([
      Object.freeze({ title: 'Initialize the chaotic state', text: 'The simulator helper P7 sets a small nonzero x initial condition while y and z start at zero; I1/I2/I3 carry -x, -y, and -z to match the booklet sign convention.', socketFocus: Object.freeze(['P7.out', 'I1.ic', 'ZERO.out', 'I2.ic', 'I3.ic']), controlFocus: Object.freeze(['P7']) }),
      Object.freeze({ title: 'Build the x and z equations', text: 'INV2 recovers y for the 1.8*y term. MUL1 multiplies -x and -y to get x*y, while P2/P3 feed the z integrator with 1.5xy and -0.2667z.', socketFocus: Object.freeze(['INV2.out', 'P1.in', 'P1.out', 'I1.in10', 'MUL1.out', 'P2.in', 'P2.out', 'I3.in10', 'P3.out', 'I3.in1']), controlFocus: Object.freeze(['P1', 'P2', 'P3']) }),
      Object.freeze({ title: 'Build s and r for the y equation', text: 'P4 and SUM1 form s = -(1 - 2.68z). MUL2 multiplies -x by s to get r, and P5/P6 drive the -y integrator.', socketFocus: Object.freeze(['I3.out', 'P4.in', 'P4.out', 'SUM1.in10_1', 'SUM1.out', 'MUL2.y', 'MUL2.out', 'P5.in', 'P5.out', 'I2.in10', 'P6.out', 'I2.in1']), controlFocus: Object.freeze(['P4', 'P5', 'P6']) }),
      Object.freeze({ title: 'Choose a projection', text: 'OUT X/Y/Z carry x, y, and z. Use X/Y for the top view, or route Z with X or Y for the front and side projections described in the booklet.', socketFocus: Object.freeze(['OUT_X.in', 'OUT_Y.in', 'OUT_Z.in']), controlFocus: Object.freeze(['X', 'Y', 'Z']) }),
    ]),
    'first-steps-polynomial-generator': Object.freeze([
      Object.freeze({ title: 'Generate the x ramp', text: 'P1 scales -1 into the first inverting integrator. With IC driven by +1, I1.out starts at x=-1 and ramps to +1 across the default REPF run.', socketFocus: Object.freeze(['PLUS1.out', 'I1.ic', 'MINUS1.out', 'P1.in', 'P1.out', 'I1.in1', 'I1.out']), controlFocus: Object.freeze(['P1']) }),
      Object.freeze({ title: 'Generate powers of x', text: 'I2 uses one direct x input and one XIR1 summing-junction input to form -x^2. I3 uses one direct -x^2 input and two XIR2 inputs to form x^3.', socketFocus: Object.freeze(['I1.out', 'I2.in1', 'XIR1.in1', 'XIR1.out', 'I2.sj', 'I2.out', 'I3.in1', 'XIR2.in1', 'XIR2.in2', 'XIR2.out', 'I3.sj', 'I3.out']) }),
      Object.freeze({ title: 'Scale polynomial terms', text: 'P2 produces d, P3 produces c*x, P4 receives x^2 and produces b*x^2, and P5 receives -x^3 to implement the default negative cubic coefficient.', socketFocus: Object.freeze(['P2.out', 'P3.out', 'P4.out', 'P5.out']), controlFocus: Object.freeze(['P2', 'P3', 'P4', 'P5']) }),
      Object.freeze({ title: 'Display p(x)', text: 'SUM1 combines the four terms as a negating summer and INV3 recovers p(x). OUT X carries x and OUT Y carries p(x) for X/Y display.', socketFocus: Object.freeze(['SUM1.out', 'INV3.in', 'INV3.out', 'OUT_X.in', 'OUT_Y.in']), controlFocus: Object.freeze(['X', 'Y']) }),
    ]),
    'first-steps-helper-adjustable-minus-one-plus-one': Object.freeze([
      Object.freeze({ title: 'Create knob value k', text: 'PLUS1 drives P1, so P1.out is an adjustable value k in 0..1.', socketFocus: Object.freeze(['PLUS1.out', 'P1.in', 'P1.out']), controlFocus: Object.freeze(['P1']) }),
      Object.freeze({ title: 'Map to full machine unit', text: 'P1.out is patched into two summer inputs and -1 is patched into a third, giving 2*k-1 before final sign recovery.', socketFocus: Object.freeze(['P1.out', 'SUM1.in1', 'SUM1.in2', 'MINUS1.out', 'SUM1.in3']) }),
      Object.freeze({ title: 'Display the result', text: 'INV1 recovers 2*k-1 and OUT Y carries the adjustable -1..+1 signal.', socketFocus: Object.freeze(['SUM1.out', 'INV1.in', 'INV1.out', 'OUT_Y.in']), controlFocus: Object.freeze(['Y']) }),
    ]),
    'first-steps-helper-max': Object.freeze([
      Object.freeze({ title: 'Generate A and B', text: 'P1 and P2 are mapped through 2*k-1 helpers to create adjustable source stubs A and B.', socketFocus: Object.freeze(['P1.out', 'SUM1.out', 'INV1.out', 'P2.out', 'SUM2.out', 'INV2.out']), controlFocus: Object.freeze(['P1', 'P2']) }),
      Object.freeze({ title: 'Test A-B', text: 'INV3 forms -B. CMP1 receives A and -B, so its sign test is A-B.', socketFocus: Object.freeze(['INV1.out', 'INV2.out', 'INV3.in', 'INV3.out', 'CMP1.a', 'CMP1.b']) }),
      Object.freeze({ title: 'Route the greater value', text: 'The comparator positive branch is A and the non-positive branch is B, so OUT Y shows max(A,B).', socketFocus: Object.freeze(['CMP1.positive', 'CMP1.nonPositive', 'CMP1.out', 'OUT_Y.in']), controlFocus: Object.freeze(['Y']) }),
    ]),
    'first-steps-helper-min': Object.freeze([
      Object.freeze({ title: 'Generate A and B', text: 'P1 and P2 are mapped through 2*k-1 helpers to create adjustable source stubs A and B.', socketFocus: Object.freeze(['P1.out', 'SUM1.out', 'INV1.out', 'P2.out', 'SUM2.out', 'INV2.out']), controlFocus: Object.freeze(['P1', 'P2']) }),
      Object.freeze({ title: 'Test A-B', text: 'INV3 forms -B. CMP1 receives A and -B, so its sign test is A-B.', socketFocus: Object.freeze(['INV1.out', 'INV2.out', 'INV3.in', 'INV3.out', 'CMP1.a', 'CMP1.b']) }),
      Object.freeze({ title: 'Route the smaller value', text: 'The comparator positive branch is B and the non-positive branch is A, so OUT Y shows min(A,B).', socketFocus: Object.freeze(['CMP1.positive', 'CMP1.nonPositive', 'CMP1.out', 'OUT_Y.in']), controlFocus: Object.freeze(['Y']) }),
    ]),
    'first-steps-helper-abs': Object.freeze([
      Object.freeze({ title: 'Generate A', text: 'P1 is mapped through the full-range helper to create input A.', socketFocus: Object.freeze(['P1.out', 'SUM1.out', 'INV1.out']), controlFocus: Object.freeze(['P1']) }),
      Object.freeze({ title: 'Create -A and compare with zero', text: 'INV2 forms -A. CMP1 compares A against ZERO.', socketFocus: Object.freeze(['INV1.out', 'INV2.in', 'INV2.out', 'ZERO.out', 'CMP1.a', 'CMP1.b']) }),
      Object.freeze({ title: 'Display absolute value', text: 'The positive branch is A and the non-positive branch is -A, so OUT Y shows abs(A).', socketFocus: Object.freeze(['CMP1.positive', 'CMP1.nonPositive', 'CMP1.out', 'OUT_Y.in']), controlFocus: Object.freeze(['Y']) }),
    ]),
    'first-steps-helper-non-negative-only': Object.freeze([
      Object.freeze({ title: 'Generate A', text: 'P1 is mapped through the full-range helper to create input A.', socketFocus: Object.freeze(['P1.out', 'SUM1.out', 'INV1.out']), controlFocus: Object.freeze(['P1']) }),
      Object.freeze({ title: 'Compare with zero', text: 'CMP1 compares A against ZERO.', socketFocus: Object.freeze(['INV1.out', 'ZERO.out', 'CMP1.a', 'CMP1.b']) }),
      Object.freeze({ title: 'Clamp negative values', text: 'The positive branch is A and the non-positive branch is ZERO, so OUT Y shows max(A,0).', socketFocus: Object.freeze(['CMP1.positive', 'CMP1.nonPositive', 'CMP1.out', 'OUT_Y.in']), controlFocus: Object.freeze(['Y']) }),
    ]),
    'slow-integrator-ramp': Object.freeze([
      Object.freeze({ title: 'Set the initial condition', text: 'ZERO.out resets the integrator state through the IC input before operation.' }),
      Object.freeze({ title: 'Enable slow mode', text: 'PLUS1.out drives the slow socket so the integrator advances about 100 times more slowly than the ordinary input path.' }),
      Object.freeze({ title: 'Observe the ramp', text: 'A -1 input produces a positive slow ramp in OP mode, routed to Y.' }),
    ]),
  });

  const BUILT_IN_TEMPLATE_ENTRIES = Object.freeze([
    Object.freeze({ id: 'blank-design', title: 'Blank zero-output design', category: 'starter', description: 'A validation-clean starter design with a zero output placeholder.', file: 'blank-design.template.json', sourceDesignId: null, defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'quickstart-damped-oscillation', title: 'Oscillator: damped motion', category: 'dynamic system', description: 'Two-integrator damped oscillator with IC and REPF walkthrough.', file: 'quickstart-damped-oscillation.template.json', sourceDesignId: 'quickstart-damped-oscillation', defaultMode: 'REPF', runnable: true }),
    Object.freeze({ id: 'static-inverter', title: 'Static inverter and coefficient', category: 'linear block', description: 'Coefficient scaling followed by sign inversion.', file: 'static-inverter.template.json', sourceDesignId: 'static-inverter', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'summer-scaling', title: 'Summer scaling and sign', category: 'linear block', description: 'Positive and negative weighted terms through a negating summer.', file: 'summer-scaling.template.json', sourceDesignId: 'summer-scaling', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'multiplier-product', title: 'Multiplier product', category: 'nonlinear block', description: 'Normalized four-quadrant multiplication from two coefficient-scaled constants.', file: 'multiplier-product.template.json', sourceDesignId: 'multiplier-product', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'comparator-switch', title: 'Comparator switch', category: 'hybrid-style block', description: 'Comparator branch selection using A, B, >0, <0, and OUT sockets.', file: 'comparator-switch.template.json', sourceDesignId: 'comparator-switch', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'xir-summing-junction', title: 'XIR summing-junction extension', category: 'patch expansion', description: 'XIR weighted contribution into a summer summing junction.', file: 'xir-summing-junction.template.json', sourceDesignId: 'xir-summing-junction', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'first-steps-radioactive-decay', title: 'First Steps: Radioactive Decay', category: 'First Steps application', description: 'Runnable Section 9.1 exponential decay walkthrough.', file: 'first-steps-radioactive-decay.template.json', sourceDesignId: 'first-steps-radioactive-decay', defaultMode: 'REPF', runnable: true }),
    Object.freeze({ id: 'first-steps-mass-spring-damper', title: 'First Steps: Mass-Spring-Damper System', category: 'First Steps application', description: 'Runnable Section 9.2 underdamped suspension walkthrough.', file: 'first-steps-mass-spring-damper.template.json', sourceDesignId: 'first-steps-mass-spring-damper', defaultMode: 'REPF', runnable: true }),
    Object.freeze({ id: 'first-steps-lunar-landing', title: 'First Steps: Lunar Landing', category: 'First Steps application', description: 'Runnable Section 9.3 lunar landing walkthrough with live throttle and fuel monitor.', file: 'first-steps-lunar-landing.template.json', sourceDesignId: 'first-steps-lunar-landing', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'first-steps-neuronal-bursting', title: 'First Steps: Neuronal Bursting', category: 'First Steps application', description: 'Runnable Section 9.4 scaled Hindmarsh-Rose neuronal bursting walkthrough using x10-weighted inputs, XIR/SJ, and SLOW.', file: 'first-steps-neuronal-bursting.template.json', sourceDesignId: 'first-steps-neuronal-bursting', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'first-steps-hunter-prey', title: 'First Steps: Hunter/Prey Population Dynamics', category: 'First Steps application', description: 'Runnable Section 9.6 Lotka-Volterra hunter/prey walkthrough for booklet roll-mode time display; X/Y phase view remains available manually.', file: 'first-steps-hunter-prey.template.json', sourceDesignId: 'first-steps-hunter-prey', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'first-steps-lorenz-attractor', title: 'First Steps: Lorenz Attractor', category: 'First Steps application', description: 'Runnable Section 9.7 Lorenz chaotic attractor walkthrough with X/Y/Z projection presets.', file: 'first-steps-lorenz-attractor.template.json', sourceDesignId: 'first-steps-lorenz-attractor', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'first-steps-polynomial-generator', title: 'First Steps: Polynomial Generator', category: 'First Steps application', description: 'Runnable Section 9.9 polynomial generator walkthrough for X/Y display.', file: 'first-steps-polynomial-generator.template.json', sourceDesignId: 'first-steps-polynomial-generator', defaultMode: 'REPF', runnable: true }),
    Object.freeze({ id: 'first-steps-helper-adjustable-minus-one-plus-one', title: 'First Steps Helper: Adjustable Value -1 to +1', category: 'First Steps helper', description: 'Runnable Section 10.4 full-range adjustable value helper.', file: 'first-steps-helper-adjustable-minus-one-plus-one.template.json', sourceDesignId: 'first-steps-helper-adjustable-minus-one-plus-one', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'first-steps-helper-max', title: 'First Steps Helper: Maximum of Two Values', category: 'First Steps helper', description: 'Runnable Section 10.1 maximum helper.', file: 'first-steps-helper-max.template.json', sourceDesignId: 'first-steps-helper-max', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'first-steps-helper-min', title: 'First Steps Helper: Minimum of Two Values', category: 'First Steps helper', description: 'Runnable Section 10.2 minimum helper.', file: 'first-steps-helper-min.template.json', sourceDesignId: 'first-steps-helper-min', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'first-steps-helper-abs', title: 'First Steps Helper: Absolute Value', category: 'First Steps helper', description: 'Runnable Section 10.3 absolute-value helper.', file: 'first-steps-helper-abs.template.json', sourceDesignId: 'first-steps-helper-abs', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'first-steps-helper-non-negative-only', title: 'First Steps Helper: Non-Negative Values Only', category: 'First Steps helper', description: 'Runnable Section 10.5 non-negative clamp helper.', file: 'first-steps-helper-non-negative-only.template.json', sourceDesignId: 'first-steps-helper-non-negative-only', defaultMode: 'OP', runnable: true }),
    Object.freeze({ id: 'slow-integrator-ramp', title: 'Slow integrator ramp', category: 'dynamic system', description: 'Slow-mode integrator ramp with IC reset behavior.', file: 'slow-integrator-ramp.template.json', sourceDesignId: 'slow-integrator-ramp', defaultMode: 'OP', runnable: true }),
  ]);

  function projectRootPath() {
    if (typeof __dirname === 'string' && nodeRequire) {
      const path = nodeRequire('path');
      return path.resolve(__dirname, '..', '..');
    }
    return null;
  }

  function readJsonFile(filePath) {
    if (!nodeRequire) return null;
    const fs = nodeRequire('fs');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function templateManifestPath(options = {}) {
    if (options.manifestPath) return options.manifestPath;
    const root = options.projectRoot || projectRootPath();
    if (!root || !nodeRequire) return null;
    const path = nodeRequire('path');
    return path.join(root, TEMPLATE_MANIFEST_PATH);
  }

  function isBookletTemplateEntry(entry) {
    return entry && (entry.id === 'blank-design' || String(entry.id || '').startsWith('first-steps-'));
  }

  function filterBookletTemplateEntries(entries, options = {}) {
    return options.includeNonBookletExamples ? entries : entries.filter(isBookletTemplateEntry);
  }

  function listDesignTemplateEntries(options = {}) {
    if (Array.isArray(options.entries)) return filterBookletTemplateEntries(clonePlain(options.entries), options);
    const manifestPath = templateManifestPath(options);
    if (manifestPath && nodeRequire) {
      try {
        const manifest = readJsonFile(manifestPath);
        if (Array.isArray(manifest)) return filterBookletTemplateEntries(manifest.map(clonePlain), options);
        if (Array.isArray(manifest.templates)) return filterBookletTemplateEntries(manifest.templates.map(clonePlain), options);
      } catch (error) {
        if (options.strict) throw error;
      }
    }
    return filterBookletTemplateEntries(BUILT_IN_TEMPLATE_ENTRIES.map(clonePlain), options);
  }

  function entryById(id, options = {}) {
    const entries = listDesignTemplateEntries(options);
    return entries.find((entry) => entry.id === id) || entries[0] || null;
  }

  function designForEntry(entry, options = {}) {
    if (entry.id === 'blank-design') return clonePlain(BLANK_TEMPLATE_DESIGN);
    const storage = getDesignStorage();
    if (storage && storage.loadDesignGalleryDesign && entry.sourceDesignId) {
      return storage.loadDesignGalleryDesign(entry.sourceDesignId, options.galleryOptions || {});
    }
    throw new Error(`template ${entry.id} has no embedded design and gallery loading is unavailable`);
  }

  function normalizeDesignTemplate(template, options = {}) {
    if (!template || typeof template !== 'object') throw new Error('design template must be an object');
    if (template.schemaVersion && template.schemaVersion !== TEMPLATE_SCHEMA_VERSION) throw new Error(`unsupported design template schemaVersion: ${template.schemaVersion}`);
    const id = String(template.id || options.id || '').trim();
    if (!id) throw new Error('design template requires id');
    const entry = entryById(id, options) || {};
    const design = template.design ? normalizeDesign(template.design, options) : designForEntry(Object.assign({}, entry, template), options);
    const walkthrough = normalizeWalkthrough(template.walkthrough || TEMPLATE_WALKTHROUGHS[id] || []);
    return {
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      id,
      title: template.title || entry.title || id,
      category: template.category || entry.category || 'custom design',
      description: template.description || entry.description || (design.metadata && design.metadata.description) || '',
      sourceDesignId: template.sourceDesignId === undefined ? (entry.sourceDesignId || null) : template.sourceDesignId,
      defaultMode: template.defaultMode || entry.defaultMode || (design.operationDefaults && design.operationDefaults.mode) || 'OP',
      runnable: template.runnable === undefined ? entry.runnable !== false : Boolean(template.runnable),
      tags: Array.from(new Set([].concat(template.tags || [], design.metadata && design.metadata.tags ? design.metadata.tags : [], ['design-template', id]).filter(Boolean))).map(String),
      walkthrough,
      runOptions: clonePlain(Object.assign({}, template.runOptions || entry.runOptions || {}, { mode: template.defaultMode || entry.defaultMode || (design.operationDefaults && design.operationDefaults.mode) || 'OP' })),
      design,
    };
  }

  function loadDesignTemplate(id, options = {}) {
    const entry = entryById(id, options);
    if (!entry) throw new Error('custom design template list is empty');
    if (options.templates && options.templates[entry.id]) return normalizeDesignTemplate(options.templates[entry.id], options);
    const root = options.projectRoot || projectRootPath();
    if (root && entry.file && nodeRequire) {
      try {
        const path = nodeRequire('path');
        return normalizeDesignTemplate(readJsonFile(path.join(root, 'designs', 'templates', entry.file)), options);
      } catch (error) {
        if (options.strict) throw error;
      }
    }
    return normalizeDesignTemplate(Object.assign({}, entry, { design: designForEntry(entry, options), walkthrough: TEMPLATE_WALKTHROUGHS[entry.id] || [] }), options);
  }

  function instantiateDesignTemplate(idOrTemplate, options = {}) {
    const template = typeof idOrTemplate === 'string' ? loadDesignTemplate(idOrTemplate, options) : normalizeDesignTemplate(idOrTemplate, options);
    const design = clonePlain(template.design);
    design.metadata = Object.assign({}, design.metadata || {}, {
      name: options.name || (design.metadata && design.metadata.name) || template.title,
      source: options.source || `custom-design template: ${template.id}`,
      tags: Array.from(new Set([].concat((design.metadata && design.metadata.tags) || [], ['template-instance', template.id]))),
      modifiedAt: options.modifiedAt || options.now || (design.metadata && design.metadata.modifiedAt) || DEFAULT_NOW,
    });
    design.notes = options.notes || design.notes || (design.metadata && design.metadata.notes) || '';
    return normalizeDesign(design, options);
  }

  function templateWalkthroughText(templateOrId, options = {}) {
    const template = typeof templateOrId === 'string' ? loadDesignTemplate(templateOrId, options) : normalizeDesignTemplate(templateOrId, options);
    return template.walkthrough.map((step, index) => `${index + 1}. ${step.title}: ${step.text}`).join('\n');
  }

  function summarizeDesignTemplate(templateOrId, options = {}) {
    const template = typeof templateOrId === 'string' ? loadDesignTemplate(templateOrId, options) : normalizeDesignTemplate(templateOrId, options);
    const core = getCoreDesign();
    const designSummary = core && core.summarizeDesign ? core.summarizeDesign(template.design) : { cableCount: (template.design.cables || []).length, componentCount: (template.design.components || []).length };
    return {
      schemaVersion: template.schemaVersion,
      id: template.id,
      title: template.title,
      category: template.category,
      sourceDesignId: template.sourceDesignId,
      defaultMode: template.defaultMode,
      runnable: template.runnable,
      walkthroughStepCount: template.walkthrough.length,
      componentCount: designSummary.componentCount,
      cableCount: designSummary.cableCount,
      outputChannels: designSummary.outputChannels || [],
    };
  }

  function validateDesignTemplate(templateOrId, options = {}) {
    const template = typeof templateOrId === 'string' ? loadDesignTemplate(templateOrId, options) : normalizeDesignTemplate(templateOrId, options);
    const diagnostics = getDesignDiagnostics();
    const validation = diagnostics && diagnostics.validateCustomDesign ? diagnostics.validateCustomDesign(template.design, options) : { ok: true, errors: [], warnings: [] };
    return { template, validation, ok: Boolean(validation.ok) };
  }

  function runDesignTemplate(templateOrId, options = {}) {
    const template = typeof templateOrId === 'string' ? loadDesignTemplate(templateOrId, options) : normalizeDesignTemplate(templateOrId, options);
    const validation = validateDesignTemplate(template, options).validation;
    if (!template.runnable) return { template, validation, skipped: true, ok: validation.ok, run: null, summary: null };
    const runtime = getDesignRuntime();
    if (!runtime || !runtime.runCustomDesign) throw new Error('custom design runtime is not available for template execution');
    const design = instantiateDesignTemplate(template, options);
    const runOptions = Object.assign({}, template.runOptions || {}, options.runOptions || {});
    const run = runtime.runCustomDesign(design, runOptions);
    return { template, validation, skipped: false, ok: validation.ok && run.summary.sampleCount > 0, run, summary: run.summary };
  }

  function verifyDesignTemplates(options = {}) {
    const entries = listDesignTemplateEntries(options);
    const smokeRunOptions = options.runOptions ? null : { duration: 0.05, opTime: 0.05, cycles: 1, dt: 0.005, sampleEvery: 10 };
    const executionOptions = smokeRunOptions ? Object.assign({}, options, { runOptions: smokeRunOptions }) : options;
    const results = entries.map((entry) => {
      try {
        const execution = runDesignTemplate(entry.id, executionOptions);
        return {
          id: entry.id,
          title: execution.template.title,
          validationOk: execution.validation.ok,
          runOk: execution.skipped ? true : Boolean(execution.run && execution.run.summary && execution.run.summary.sampleCount > 0),
          sampleCount: execution.run && execution.run.summary ? execution.run.summary.sampleCount : 0,
          outputNames: execution.run && execution.run.summary ? execution.run.summary.outputNames : [],
          walkthroughStepCount: execution.template.walkthrough.length,
          error: null,
        };
      } catch (error) {
        return { id: entry.id, title: entry.title || entry.id, validationOk: false, runOk: false, sampleCount: 0, outputNames: [], walkthroughStepCount: 0, error: error.message };
      }
    });
    return {
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      templateCount: results.length,
      runnableCount: results.filter((result) => result.sampleCount > 0).length,
      ok: results.length > 0 && results.every((result) => result.validationOk && result.runOk && result.walkthroughStepCount > 0),
      results,
    };
  }

  const api = {
    TEMPLATE_SCHEMA_VERSION,
    TEMPLATE_MANIFEST_PATH,
    BLANK_TEMPLATE_DESIGN,
    listDesignTemplateEntries,
    loadDesignTemplate,
    normalizeDesignTemplate,
    instantiateDesignTemplate,
    templateWalkthroughText,
    summarizeDesignTemplate,
    validateDesignTemplate,
    runDesignTemplate,
    verifyDesignTemplates,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingDesignTemplates = api;
}(typeof window !== 'undefined' ? window : global));
