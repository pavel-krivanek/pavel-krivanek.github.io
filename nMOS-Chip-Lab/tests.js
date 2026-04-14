const Sim = require('./sim-core');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function nearRail(v, target, tol=0.9) { return Math.abs(v-target) <= tol; }

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS — ${name}`);
    return true;
  } catch (e) {
    console.log(`FAIL — ${name}`);
    console.log(e.message);
    return false;
  }
}

function dcOut(layout) {
  const net = Sim.extractNetwork(layout, 0);
  const sol = Sim.solveDC(net);
  const outNode = net.labelNodes.get('OUT');
  return sol.voltages.get(outNode) ?? 0;
}

function truthBits(makeLayout) {
  const rows = [];
  for (const a of [0,1]) for (const b of [0,1]) {
    const L = makeLayout();
    L.setDrive('A', a ? Sim.Params.VCC : 0);
    L.setDrive('B', b ? Sim.Params.VCC : 0);
    const vout = dcOut(L);
    rows.push({ a, b, vout, logic: Sim.logicLevel(vout) });
  }
  return rows;
}

let pass = 0, fail = 0;

for (const [name, make] of [
  ['inverter', Sim.makeInverterLayout],
  ['nand', Sim.makeNandLayout],
  ['nor', Sim.makeNorLayout],
  ['and', Sim.makeAndLayout],
  ['or', Sim.makeOrLayout],
]) {
  if (runTest(`${name} has no passive net conflicts`, () => {
    const net = Sim.extractNetwork(make(), 0);
    assert(net.conflicts.length === 0, JSON.stringify(net.conflicts));
  })) pass++; else fail++;
}

if (runTest('inverter DC rails', () => {
  const L0 = Sim.makeInverterLayout();
  L0.setDrive('IN', 0);
  const v0 = dcOut(L0);
  assert(nearRail(v0, Sim.Params.VCC), `low input expected high output, got ${v0}`);
  const L1 = Sim.makeInverterLayout();
  L1.setDrive('IN', Sim.Params.VCC);
  const v1 = dcOut(L1);
  assert(v1 < 1.0, `high input expected low output, got ${v1}`);
})) pass++; else fail++;

for (const [name, make, expected] of [
  ['nand', Sim.makeNandLayout, '1110'],
  ['nor', Sim.makeNorLayout, '1000'],
  ['and', Sim.makeAndLayout, '0001'],
  ['or', Sim.makeOrLayout, '0111'],
]) {
  if (runTest(`${name} truth table`, () => {
    const rows = truthBits(make);
    const got = rows.map(r => r.logic).join('');
    assert(got === expected, JSON.stringify(rows));
  })) pass++; else fail++;
}

if (runTest('five-toggle inverter shows five output crossings', () => {
  const L = Sim.makeInverterLayout();
  const wf = Sim.defaultWaveforms('inverter');
  L.setDrive('IN', wf.drives.IN);
  const series = Sim.transientSim(L, { dt: wf.dt, steps: wf.steps });
  const outSeries = Sim.measureNode(series, 'OUT');
  let crossings = 0;
  let prev = Sim.logicLevel(outSeries[0].v);
  for (const s of outSeries.slice(1)) {
    const cur = Sim.logicLevel(s.v);
    if (cur !== prev) { crossings++; prev = cur; }
  }
  assert(crossings >= 5, `crossings=${crossings}`);
})) pass++; else fail++;


if (runTest('transistor-adjacent n contacts suppress extraction', () => {
  const L = Sim.makeInverterLayout();
  L.addContact(4, 2, 'n_m1'); L.addCell('metal1', 4, 2);
  const net = Sim.extractNetwork(L, 0);
  const topLoad = net.transistorDevices.filter(tx => tx.x === 4 && tx.y === 3);
  assert(topLoad.length === 0, `expected suppressed load transistor, got ${topLoad.length}`);
})) pass++; else fail++;

if (runTest('pn adjacency creates junctions without passive shorts', () => {
  const L = Sim.makeInverterLayout();
  const net = Sim.extractNetwork(L, 0);
  assert(net.junctions.length > 0, 'expected junction edges');
  assert(net.conflicts.length === 0, JSON.stringify(net.conflicts));
})) pass++; else fail++;

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
