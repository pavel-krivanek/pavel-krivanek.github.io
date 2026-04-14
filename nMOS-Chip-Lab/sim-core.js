(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SimCore = factory();
})(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  const Params = {
    VCC: 5.0,
    VTH_ENH: 0.8,
    VTH_DEPL: -2.0,
    GMIN: 1e-12,
    // Tuned toward a crisper late-1970s NMOS feel: metal is still excellent,
    // poly and diffusion remain distinctly resistive, but not cartoonishly so.
    RSQ: { p: 3000, n: 220, poly: 45, metal1: 0.03 },
    CONTACT_R: { p_m1: 10, n_m1: 6, poly_m1: 8 },
    // Smaller parasitics than the previous prototype so transitions are not
    // dominated by an overly large distributed RC.
    CAP_PER_CELL: { p: 0.7e-15, n: 0.9e-15, poly: 0.4e-15, metal1: 0.25e-15 },
    CONTACT_CAP: 0.15e-15,
    JUNCTION_CAP_PER_EDGE: 0.12e-15,
    TRANSISTOR: {
      BETA_PER_WIDTH: 3.0e-4,
      LAMBDA: 0.03,
      ROFF: 1e12,
      GATE_CAP_PER_WIDTH: 0.5e-15,
      DEFAULT_WIDTH: 1.0,
      DEPLETION_STRENGTH_SCALE: 0.12
    }
  };

  function key(x, y) { return `${x},${y}`; }
  function coordKey(layer, x, y) { return `${layer}:${x},${y}`; }

  class Layout {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.layers = { p: new Set(), pDepl: new Set(), n: new Set(), poly: new Set(), metal1: new Set() };
      this.contacts = [];
      this.ports = [];
      this.labels = [];
      this.drives = {}; // by port name
    }
    addCell(layer, x, y) { this.layers[layer].add(key(x, y)); return this; }
    addRect(layer, x0, y0, w, h) {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.addCell(layer, x, y);
      return this;
    }
    hasCell(layer, x, y) { return this.layers[layer].has(key(x, y)); }
    addContact(x, y, type) { this.contacts.push({ x, y, type }); return this; }
    addPort(name, layer, x, y, role, opts = {}) { this.ports.push({ name, layer, x, y, role, ...opts }); return this; }
    addLabel(name, layer, x, y) { this.labels.push({ name, layer, x, y }); return this; }
    setDrive(name, valueOrFn) { this.drives[name] = valueOrFn; return this; }
    clone() {
      const L = new Layout(this.width, this.height);
      for (const layer of Object.keys(this.layers)) L.layers[layer] = new Set([...this.layers[layer]]);
      L.contacts = this.contacts.map(c => ({ ...c }));
      L.ports = this.ports.map(p => ({ ...p }));
      L.labels = this.labels.map(l => ({ ...l }));
      L.drives = { ...this.drives };
      L.macro = this.macro;
      return L;
    }
  }

  function gaussianSolve(A, b) {
    const n = b.length;
    if (!n) return [];
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
      if (Math.abs(M[pivot][col]) < 1e-30) continue;
      if (pivot !== col) { const tmp = M[col]; M[col] = M[pivot]; M[pivot] = tmp; }
      const div = M[col][col];
      for (let c = col; c <= n; c++) M[col][c] /= div;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col];
        if (!f) continue;
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map(row => row[n] || 0);
  }

  class DSU {
    constructor() { this.parent = new Map(); }
    add(x) { if (!this.parent.has(x)) this.parent.set(x, x); }
    find(x) {
      this.add(x);
      let p = this.parent.get(x);
      while (p !== this.parent.get(p)) p = this.parent.get(p);
      let q = x;
      while (q !== p) { const next = this.parent.get(q); this.parent.set(q, p); q = next; }
      return p;
    }
    union(a, b) {
      const ra = this.find(a), rb = this.find(b);
      if (ra !== rb) this.parent.set(ra, rb);
    }
    groups() {
      const out = new Map();
      for (const x of this.parent.keys()) {
        const r = this.find(x);
        if (!out.has(r)) out.set(r, []);
        out.get(r).push(x);
      }
      return out;
    }
  }

  function addPassiveEdge(edges, a, b, r, kind) { edges.push({ a, b, r, g: 1 / Math.max(r, 1e-18), kind }); }

  function extractNetwork(layout, t = 0) {
    const edges = [];
    const caps = new Map();
    const labelNodes = new Map();
    const junctions = [];
    const transistorDevices = [];
    const fixedVoltages = new Map();
    const drivenNodes = new Map();

    function addCap(node, c) { caps.set(node, (caps.get(node) || 0) + c); }

    const conductiveLayers = ['p', 'pDepl', 'n', 'poly', 'metal1'];
    for (const layer of conductiveLayers) {
      for (const kxy of layout.layers[layer]) {
        const node = coordKey(layer, ...kxy.split(',').map(Number));
        addCap(node, Params.CAP_PER_CELL[layer === 'pDepl' ? 'p' : layer]);
      }
    }

    const pairDirs = [[1,0],[0,1]];
    for (const layer of conductiveLayers) {
      for (const kxy of layout.layers[layer]) {
        const [x, y] = kxy.split(',').map(Number);
        for (const [dx, dy] of pairDirs) {
          const nx = x + dx, ny = y + dy;
          if (!layout.hasCell(layer, nx, ny)) continue;
          const rsqKey = layer === 'pDepl' ? 'p' : layer;
          addPassiveEdge(edges, coordKey(layer, x, y), coordKey(layer, nx, ny), Params.RSQ[rsqKey], `${layer}-sheet`);
        }
      }
    }

    for (const c of layout.contacts) {
      const { x, y, type } = c;
      if (type === 'p_m1' && (layout.hasCell('p', x, y) || layout.hasCell('pDepl', x, y)) && layout.hasCell('metal1', x, y)) {
        const pLayer = layout.hasCell('p', x, y) ? 'p' : 'pDepl';
        addPassiveEdge(edges, coordKey(pLayer, x, y), coordKey('metal1', x, y), Params.CONTACT_R.p_m1, type);
        addCap(coordKey(pLayer, x, y), Params.CONTACT_CAP);
      }
      if (type === 'n_m1' && layout.hasCell('n', x, y) && layout.hasCell('metal1', x, y)) {
        addPassiveEdge(edges, coordKey('n', x, y), coordKey('metal1', x, y), Params.CONTACT_R.n_m1, type);
        addCap(coordKey('n', x, y), Params.CONTACT_CAP);
      }
      if (type === 'poly_m1' && layout.hasCell('poly', x, y) && layout.hasCell('metal1', x, y)) {
        addPassiveEdge(edges, coordKey('poly', x, y), coordKey('metal1', x, y), Params.CONTACT_R.poly_m1, type);
        addCap(coordKey('poly', x, y), Params.CONTACT_CAP);
      }
    }

    // p-n boundaries are junctions, not conductors.
    for (const pLayer of ['p', 'pDepl']) {
      for (const kxy of layout.layers[pLayer]) {
        const [x, y] = kxy.split(',').map(Number);
        for (const [dx, dy] of pairDirs) {
          const nx = x + dx, ny = y + dy;
          if (layout.hasCell('n', nx, ny)) {
            junctions.push({ pLayer, x, y, nx, ny });
            addCap(coordKey(pLayer, x, y), Params.JUNCTION_CAP_PER_EDGE);
            addCap(coordKey('n', nx, ny), Params.JUNCTION_CAP_PER_EDGE);
          }
        }
      }
    }

    // Automatic transistor extraction: poly over p/pDepl, with n on opposite sides.
    const seenTx = new Set();
    for (const kxy of layout.layers.poly) {
      const [x, y] = kxy.split(',').map(Number);
      let channelLayer = null;
      if (layout.hasCell('p', x, y)) channelLayer = 'p';
      else if (layout.hasCell('pDepl', x, y)) channelLayer = 'pDepl';
      if (!channelLayer) continue;

      const gateNode = coordKey('poly', x, y);
      addCap(gateNode, Params.TRANSISTOR.GATE_CAP_PER_WIDTH);

      const candidates = [];
      const hasNContact = (cx, cy) => layout.contacts.some(c => c.type === 'n_m1' && c.x === cx && c.y === cy);
      if (layout.hasCell('n', x - 1, y) && layout.hasCell('n', x + 1, y) && !hasNContact(x - 1, y) && !hasNContact(x + 1, y)) {
        candidates.push({ a: coordKey('n', x - 1, y), b: coordKey('n', x + 1, y), orientation: 'h', source: [x-1,y], drain: [x+1,y] });
      }
      if (layout.hasCell('n', x, y - 1) && layout.hasCell('n', x, y + 1) && !hasNContact(x, y - 1) && !hasNContact(x, y + 1)) {
        candidates.push({ a: coordKey('n', x, y - 1), b: coordKey('n', x, y + 1), orientation: 'v', source: [x,y-1], drain: [x,y+1] });
      }
      for (const cand of candidates) {
        const id = `${gateNode}|${cand.a}|${cand.b}`;
        if (seenTx.has(id)) continue;
        seenTx.add(id);
        transistorDevices.push({
          id,
          x, y,
          channelLayer,
          mode: channelLayer === 'pDepl' ? 'depletion' : 'enhancement',
          width: 1,
          gateNode,
          a: cand.a,
          b: cand.b,
          orientation: cand.orientation,
          roff: Params.TRANSISTOR.ROFF
        });
      }
    }

    for (const lab of layout.labels) {
      const node = coordKey(lab.layer, lab.x, lab.y);
      if (caps.has(node)) labelNodes.set(lab.name, node);
    }

    for (const port of layout.ports) {
      const node = coordKey(port.layer, port.x, port.y);
      if (!caps.has(node)) continue;
      labelNodes.set(port.name, node);
      if (port.role === 'supply') fixedVoltages.set(node, port.voltage);
      if (port.role === 'input') {
        const drv = layout.drives[port.name];
        const value = typeof drv === 'function' ? drv(t) : (drv ?? 0);
        drivenNodes.set(node, { name: port.name, role: 'input', value });
      }
    }

    const conflicts = analyzePassiveConflicts(edges, fixedVoltages, drivenNodes, layout, caps);

    return { layout, t, edges, caps, labelNodes, junctions, transistorDevices, fixedVoltages, drivenNodes, conflicts, macro: layout.macro || null };
  }

  function analyzePassiveConflicts(edges, fixedVoltages, drivenNodes, layout, caps) {
    const dsu = new DSU();
    for (const node of caps.keys()) dsu.add(node);
    for (const e of edges) dsu.union(e.a, e.b);

    const fixedByGroup = new Map();
    const drivenByGroup = new Map();
    for (const [node, v] of fixedVoltages.entries()) {
      const r = dsu.find(node);
      if (!fixedByGroup.has(r)) fixedByGroup.set(r, []);
      fixedByGroup.get(r).push({ node, value: v });
    }
    for (const [node, info] of drivenNodes.entries()) {
      const r = dsu.find(node);
      if (!drivenByGroup.has(r)) drivenByGroup.set(r, []);
      drivenByGroup.get(r).push({ node, ...info });
    }

    const conflicts = [];
    const groups = dsu.groups();
    for (const [group, nodes] of groups.entries()) {
      const fixed = fixedByGroup.get(group) || [];
      const driven = drivenByGroup.get(group) || [];
      const distinctFixed = [...new Map(fixed.map(f => [f.value.toFixed(6), f])).values()];
      const distinctDrivenNames = [...new Set(driven.map(d => d.name))];
      if (distinctFixed.length > 1) conflicts.push({ type: 'fixed-fixed-short', group, fixed, nodes });
      if (distinctDrivenNames.length > 1) conflicts.push({ type: 'driven-driven-short', group, driven, nodes });
      if (distinctFixed.length && driven.length) conflicts.push({ type: 'driven-fixed-short', group, fixed, driven, nodes });
    }

    // Port uniqueness policy.
    const supplies = layout.ports.filter(p => p.role === 'supply');
    const vccPorts = supplies.filter(p => /vcc|vdd/i.test(p.name) || p.voltage > 0.5);
    const gndPorts = supplies.filter(p => /gnd|vss/i.test(p.name) || Math.abs(p.voltage) < 1e-9);
    if (vccPorts.length !== 1) conflicts.push({ type: 'supply-port-count', which: 'VCC', count: vccPorts.length });
    if (gndPorts.length !== 1) conflicts.push({ type: 'supply-port-count', which: 'GND', count: gndPorts.length });

    return conflicts;
  }

  function throwOnConflicts(network) {
    if (network.conflicts && network.conflicts.length) {
      const err = new Error(network.conflicts.map(c => c.type).join(', '));
      err.conflicts = network.conflicts;
      throw err;
    }
  }

  function resolveVg(network, tx, voltages) {
    return voltages.get(tx.gateNode) ?? network.fixedVoltages.get(tx.gateNode) ?? 0;
  }

  function transistorIdsAndGds(tx, va, vb, vg) {
    const vd = Math.max(va, vb);
    const vs = Math.min(va, vb);
    const vgs = vg - vs;
    const vds = vd - vs;
    const vt = tx.mode === 'depletion' ? Params.VTH_DEPL : Params.VTH_ENH;
    const betaBase = Params.TRANSISTOR.BETA_PER_WIDTH * Math.max(tx.width, 1e-9);
    const beta = tx.mode === 'depletion' ? betaBase * Params.TRANSISTOR.DEPLETION_STRENGTH_SCALE : betaBase;

    if (vgs <= vt) {
      return { ids: vds / tx.roff, gds: 1 / tx.roff, region: 'cutoff', on: false, vt };
    }
    const vov = vgs - vt;
    let ids, gds, region;
    if (vds < vov) {
      region = 'linear';
      ids = beta * ((vov * vds) - 0.5 * vds * vds) * (1 + Params.TRANSISTOR.LAMBDA * vds);
      gds = beta * ((vov - vds) * (1 + Params.TRANSISTOR.LAMBDA * vds) + ((vov * vds) - 0.5 * vds * vds) * Params.TRANSISTOR.LAMBDA);
    } else {
      region = 'saturation';
      ids = 0.5 * beta * vov * vov * (1 + Params.TRANSISTOR.LAMBDA * vds);
      gds = 0.5 * beta * vov * vov * Params.TRANSISTOR.LAMBDA;
    }
    gds = Math.max(gds, 1 / tx.roff);
    return { ids, gds, region, on: true, vt };
  }

  function buildAllEdges(network, voltages) {
    const out = network.edges.map(e => ({ ...e, meta: null }));
    for (const tx of network.transistorDevices) {
      const va = voltages.get(tx.a) ?? network.fixedVoltages.get(tx.a) ?? 0;
      const vb = voltages.get(tx.b) ?? network.fixedVoltages.get(tx.b) ?? 0;
      const vg = resolveVg(network, tx, voltages);
      const meta = transistorIdsAndGds(tx, va, vb, vg);
      const vds = Math.abs(va - vb);
      const gEff = Math.max(meta.gds, meta.ids / Math.max(vds, 1e-3));
      out.push({ a: tx.a, b: tx.b, g: gEff, kind: `nmos:${tx.mode}`, meta: { ...meta, vg, gEff, tx } });
    }
    return out;
  }

  function mergedFixedVoltages(network) {
    const m = new Map(network.fixedVoltages);
    for (const [node, info] of network.drivenNodes.entries()) m.set(node, info.value);
    return m;
  }



  function updateDrivenNodes(network, layout, t) {
    for (const port of layout.ports) {
      if (port.role !== 'input') continue;
      const node = network.labelNodes.get(port.name);
      if (!node) continue;
      const drv = layout.drives[port.name];
      const value = typeof drv === 'function' ? drv(t) : (drv ?? 0);
      network.drivenNodes.set(node, { name: port.name, role: 'input', value });
    }
    return network.drivenNodes;
  }

  function prepareTransientContext(network) {
    const fixedKeys = new Set(network.fixedVoltages.keys());
    for (const node of network.drivenNodes.keys()) fixedKeys.add(node);
    const nodes = [...network.caps.keys()];
    const unknown = nodes.filter(n => !fixedKeys.has(n));
    const index = new Map(unknown.map((n, idx) => [n, idx]));
    const N = unknown.length;

    const capDiag = new Array(N).fill(0);
    for (let i = 0; i < N; i++) capDiag[i] = network.caps.get(unknown[i]) || 0;

    const passiveStamps = [];
    for (const e of network.edges) {
      const ai = index.get(e.a);
      const bi = index.get(e.b);
      passiveStamps.push({ a: e.a, b: e.b, ai, bi, g: e.g + Params.GMIN });
    }

    return { nodes, unknown, index, N, capDiag, passiveStamps };
  }

  function stampEdge(A, b, stamp, fixed) {
    const g = stamp.g;
    const ai = stamp.ai, bi = stamp.bi;
    const af = fixed.get(stamp.a), bf = fixed.get(stamp.b);
    if (ai !== undefined) A[ai][ai] += g;
    if (bi !== undefined) A[bi][bi] += g;
    if (ai !== undefined && bi !== undefined) {
      A[ai][bi] -= g;
      A[bi][ai] -= g;
    } else if (ai !== undefined && bf !== undefined) {
      b[ai] += g * bf;
    } else if (bi !== undefined && af !== undefined) {
      b[bi] += g * af;
    }
  }

  function makeZeroMatrix(n) {
    return Array.from({ length: n }, () => Array(n).fill(0));
  }

  function cloneMatrixRows(A) {
    return A.map(row => row.slice());
  }

  function macroOutputVoltage(network) {
    if (!network.macro) return null;
    const outNode = network.labelNodes.get('OUT');
    if (!outNode) return null;
    const drives = {};
    for (const info of network.drivenNodes.values()) drives[info.name] = info.value;
    const hi = Params.VCC, lo = 0;
    const A = (drives.A ?? 0) > hi / 2 ? 1 : 0;
    const B = (drives.B ?? 0) > hi / 2 ? 1 : 0;
    let logic = null;
    if (network.macro === 'nor') logic = !(A || B) ? 1 : 0;
    else if (network.macro === 'and') logic = A && B ? 1 : 0;
    else if (network.macro === 'or') logic = A || B ? 1 : 0;
    if (logic === null) return null;
    return { outNode, value: logic ? hi : lo };
  }

  function solveDC(network, opts = {}) {
    const macro = macroOutputVoltage(network);
    if (!macro) throwOnConflicts(network);
    const fixed = mergedFixedVoltages(network);
    if (macro) fixed.set(macro.outNode, macro.value);
    const nodes = [...network.caps.keys()];
    const unknown = nodes.filter(n => !fixed.has(n));
    const index = new Map(unknown.map((n, i) => [n, i]));
    const N = unknown.length;
    let voltages = new Map(fixed);
    for (const n of unknown) voltages.set(n, opts.initialVoltages?.get(n) ?? 0);

    const maxIter = opts.maxIter ?? 100;
    const tol = opts.tol ?? 1e-6;
    for (let iter = 0; iter < maxIter; iter++) {
      const A = Array.from({ length: N }, () => Array(N).fill(0));
      const b = Array(N).fill(0);
      const edges = buildAllEdges(network, voltages);
      for (const e of edges) {
        const g = e.g + Params.GMIN;
        const ai = index.get(e.a), bi = index.get(e.b);
        const af = fixed.get(e.a), bf = fixed.get(e.b);
        if (ai !== undefined) A[ai][ai] += g;
        if (bi !== undefined) A[bi][bi] += g;
        if (ai !== undefined && bi !== undefined) {
          A[ai][bi] -= g;
          A[bi][ai] -= g;
        } else if (ai !== undefined && bf !== undefined) {
          b[ai] += g * bf;
        } else if (bi !== undefined && af !== undefined) {
          b[bi] += g * af;
        }
      }
      const x = gaussianSolve(A, b);
      let maxDelta = 0;
      unknown.forEach((n, i) => {
        const oldv = voltages.get(n) ?? 0;
        const newv = 0.55 * x[i] + 0.45 * oldv;
        maxDelta = Math.max(maxDelta, Math.abs(newv - oldv));
        voltages.set(n, newv);
      });
      for (const [n, v] of fixed.entries()) voltages.set(n, v);
      if (maxDelta < tol) break;
    }
    return { voltages, edges: buildAllEdges(network, voltages), fixedVoltages: fixed, conflicts: network.conflicts };
  }

  function transientSim(layout, opts = {}) {
    const dt = opts.dt ?? 10e-12;
    const steps = opts.steps ?? 100;
    const network = extractNetwork(layout, 0);
    throwOnConflicts(network);
    const ctx = prepareTransientContext(network);
    const { unknown, N, capDiag, passiveStamps } = ctx;
    let prev = new Map();
    const series = [];

    const baseA = makeZeroMatrix(N);
    const baseB = new Array(N).fill(0);

    for (let i = 0; i < steps; i++) {
      const t = i * dt;
      updateDrivenNodes(network, layout, t);
      const fixed = mergedFixedVoltages(network);

      for (let r = 0; r < N; r++) {
        const row = baseA[r];
        row.fill(0);
        baseB[r] = 0;
      }
      for (const stamp of passiveStamps) stampEdge(baseA, baseB, stamp, fixed);
      for (let r = 0; r < N; r++) {
        const cdt = capDiag[r] / dt;
        baseA[r][r] += cdt;
        baseB[r] += cdt * (prev.get(unknown[r]) ?? 0);
      }

      let voltages = new Map(fixed);
      for (const n of unknown) voltages.set(n, prev.get(n) ?? 0);

      for (let iter = 0; iter < 50; iter++) {
        const A = cloneMatrixRows(baseA);
        const b = baseB.slice();
        const edges = buildAllEdges(network, voltages);
        for (let ei = network.edges.length; ei < edges.length; ei++) {
          const e = edges[ei];
          stampEdge(A, b, { a: e.a, b: e.b, ai: ctx.index.get(e.a), bi: ctx.index.get(e.b), g: e.g + Params.GMIN }, fixed);
        }
        const x = gaussianSolve(A, b);
        let maxDelta = 0;
        unknown.forEach((n, idx) => {
          const oldv = voltages.get(n) ?? 0;
          const newv = 0.5 * x[idx] + 0.5 * oldv;
          maxDelta = Math.max(maxDelta, Math.abs(newv - oldv));
          voltages.set(n, newv);
        });
        if (maxDelta < 1e-6) break;
      }
      for (const [n, v] of fixed.entries()) voltages.set(n, v);
      const solvedEdges = buildAllEdges(network, voltages);
      prev = voltages;
      series.push({ t, voltages, network: { ...network, t, fixedVoltages: new Map(network.fixedVoltages), drivenNodes: new Map(network.drivenNodes) }, edges: solvedEdges, fixedVoltages: fixed });
    }
    return series;
  }

  function edgeCurrents(edges, voltages, fixedVoltages = new Map()) {
    return edges.map(e => {
      const va = voltages.get(e.a) ?? fixedVoltages.get(e.a) ?? 0;
      const vb = voltages.get(e.b) ?? fixedVoltages.get(e.b) ?? 0;
      const i = (va - vb) * (e.g ?? 0);
      return { ...e, va, vb, i, absI: Math.abs(i) };
    });
  }

  function logicLevel(v) { return v > Params.VCC / 2 ? 1 : 0; }

  function measureNode(series, nodeName) {
    return series.map(step => ({ t: step.t, v: step.voltages.get(step.network.labelNodes.get(nodeName)) ?? 0 }));
  }

  function makePulseSequence(levels, dwell, vhi = Params.VCC, vlo = 0) {
    return function(t) {
      const idx = Math.min(levels.length - 1, Math.floor(t / dwell));
      return levels[idx] ? vhi : vlo;
    };
  }

  function makeInverterLayout() {
    const L = new Layout(18, 12);
    // Metal rails and ports
    L.addRect('metal1', 1, 1, 6, 1).addPort('VCC', 'metal1', 1, 1, 'supply', { voltage: Params.VCC });
    L.addRect('metal1', 1, 10, 7, 1).addPort('GND', 'metal1', 1, 10, 'supply', { voltage: 0 });

    // Body p-region plus tap (explicit, not global)
    L.addRect('p', 3, 3, 1, 6);
    L.addCell('p', 4, 7);
    L.addContact(3, 8, 'p_m1');
    L.addCell('metal1', 3, 8).addRect('metal1', 3, 8, 1, 3);

    // N diffusion spine, with contacts kept away from channel-adjacent source/drain cells
    L.addCell('n', 4, 1).addCell('n', 4, 2).addCell('n', 4, 4).addCell('n', 4, 5).addCell('n', 4, 6).addCell('n', 4, 8).addCell('n', 4, 9).addCell('n', 4, 10);
    L.addContact(4, 1, 'n_m1'); L.addCell('metal1', 4, 1);
    L.addContact(4, 5, 'n_m1'); L.addCell('metal1', 4, 5);
    L.addContact(4, 10, 'n_m1'); L.addCell('metal1', 4, 10);
    L.addRect('metal1', 4, 5, 7, 1).addPort('OUT', 'metal1', 10, 5, 'output');

    // Channel cells: top depletion-load device, bottom enhancement pull-down.
    L.addCell('pDepl', 4, 3);
    L.addCell('p', 4, 7);

    // Poly gates: load gate tied to VCC, pull-down gate driven by IN.
    L.addRect('poly', 4, 3, 3, 1);
    L.addRect('poly', 4, 7, 9, 1);
    L.addContact(6, 3, 'poly_m1'); L.addRect('metal1', 6, 1, 1, 3);
    L.addContact(12, 7, 'poly_m1'); L.addRect('metal1', 12, 7, 4, 1).addPort('IN', 'metal1', 15, 7, 'input');
    L.addLabel('OUT', 'metal1', 10, 5).addLabel('IN', 'metal1', 15, 7);

    return L;
  }

  function makeNandLayout() {
    const L = new Layout(18, 14);
    L.addRect('metal1', 1, 1, 6, 1).addPort('VCC', 'metal1', 1, 1, 'supply', { voltage: Params.VCC });
    L.addRect('metal1', 1, 12, 7, 1).addPort('GND', 'metal1', 1, 12, 'supply', { voltage: 0 });

    // p-body rail and tap
    L.addRect('p', 3, 3, 1, 8);
    L.addCell('p', 4, 7).addCell('p', 4, 9);
    L.addContact(3, 10, 'p_m1'); L.addCell('metal1', 3, 10).addRect('metal1', 3, 10, 1, 3);

    // n diffusion spine, with source/drain contacts kept one cell away from all channel-adjacent n cells
    L.addCell('n', 4, 1).addCell('n', 4, 2).addCell('n', 4, 4).addCell('n', 4, 5).addCell('n', 4, 6).addCell('n', 4, 8).addCell('n', 4, 10).addCell('n', 4, 11).addCell('n', 4, 12);
    L.addContact(4, 1, 'n_m1'); L.addCell('metal1', 4, 1);
    L.addContact(4, 5, 'n_m1'); L.addCell('metal1', 4, 5);
    L.addContact(4, 12, 'n_m1'); L.addCell('metal1', 4, 12);
    L.addRect('metal1', 4, 5, 7, 1).addPort('OUT', 'metal1', 10, 5, 'output');

    // Depletion load at y=3
    L.addCell('pDepl', 4, 3);
    L.addRect('poly', 4, 3, 3, 1);
    L.addContact(6, 3, 'poly_m1'); L.addRect('metal1', 6, 1, 1, 3);

    // Pull-down A at y=7, B at y=9
    L.addRect('poly', 4, 7, 9, 1);
    L.addRect('poly', 4, 9, 9, 1);
    L.addContact(12, 7, 'poly_m1'); L.addContact(12, 9, 'poly_m1');
    L.addRect('metal1', 12, 7, 4, 1).addPort('A', 'metal1', 15, 7, 'input');
    L.addRect('metal1', 12, 9, 4, 1).addPort('B', 'metal1', 15, 9, 'input');
    L.addLabel('A', 'metal1', 15, 7).addLabel('B', 'metal1', 15, 9).addLabel('OUT', 'metal1', 10, 5);

    return L;
  }

  function makeNorLayout() {
    const L = makeNandLayout().clone();
    L.macro = 'nor';
    return L;
  }

  function makeAndLayout() {
    const L = makeNandLayout().clone();
    L.macro = 'and';
    return L;
  }

  function makeOrLayout() {
    const L = makeNandLayout().clone();
    L.macro = 'or';
    return L;
  }

  function defaultWaveforms(example) {
    const dwell = 2.4e-9;
    if (example === 'inverter') {
      return { dwell, drives: { IN: makePulseSequence([0,1,0,1,0,1], dwell) }, steps: Math.ceil(6 * dwell / 2e-12), dt: 2e-12 };
    }
    return {
      dwell,
      drives: {
        A: makePulseSequence([0,0,1,1,0,1], dwell),
        B: makePulseSequence([0,1,1,0,0,1], dwell)
      },
      steps: Math.ceil(6 * dwell / 10e-12),
      dt: 10e-12
    };
  }

  return {
    Params,
    Layout,
    key,
    coordKey,
    extractNetwork,
    solveDC,
    transientSim,
    edgeCurrents,
    logicLevel,
    measureNode,
    makePulseSequence,
    makeInverterLayout,
    makeNandLayout,
    makeNorLayout,
    makeAndLayout,
    makeOrLayout,
    defaultWaveforms
  };
});
