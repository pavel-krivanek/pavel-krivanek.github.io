const Sim = window.SimCore;
const visibility = { p:true, pDepl:true, n:true, poly:true, metal1:true, contacts:true, transistors:true, junctions:false, ports:true, labels:true };
const TOOL_DEFS = [
  { key:'1', id:'p', label:'p', kind:'layer', layer:'p' },
  { key:'2', id:'pDepl', label:'p-depl', kind:'layer', layer:'pDepl' },
  { key:'3', id:'n', label:'n', kind:'layer', layer:'n' },
  { key:'4', id:'poly', label:'poly', kind:'layer', layer:'poly' },
  { key:'5', id:'metal1', label:'metal1', kind:'layer', layer:'metal1' },
  { key:'6', id:'via', label:'via', kind:'contactGeneric' },
  { key:'7', id:'select', label:'select', kind:'select' },
  { key:'V', id:'portVcc', label:'VCC', kind:'port', portRole:'supply', portName:'VCC', voltage:() => Sim.Params.VCC },
  { key:'G', id:'portGnd', label:'GND', kind:'port', portRole:'supply', portName:'GND', voltage:() => 0 },
  { key:'I', id:'portInput', label:'input', kind:'portInput' },
  { key:'O', id:'portOut', label:'output', kind:'portOutput' },
  { key:'0', id:'erase', label:'erase', kind:'erase' }
];

let visualReplay = { timer:null, index:0, running:false, mode:'voltage' };
let currentExample = 'blank';
let currentLayout = null;
let currentTool = 'select';
let openMenuId = null;
let cursor = { x:0, y:0 };
let dirty = false;
let lastRun = null;
let undoHistory = [];
let redoHistory = [];
let selectionRect = null;
let selectionDrag = null;
let clipboardRegion = null;
let chipBounds = null;
let mousePan = null;
let activeTab = 'Die';
let waveformDrawState = null;
const MAX_UNDO = 200;
const view = { scale:126, offsetX:0, offsetY:0 };
const DEFAULT_PARAMS = JSON.parse(JSON.stringify({
  VCC: Sim.Params.VCC,
  VTH_ENH: Sim.Params.VTH_ENH,
  VTH_DEPL: Sim.Params.VTH_DEPL,
  RSQ: Sim.Params.RSQ,
  CAP_PER_CELL: { p: Sim.Params.CAP_PER_CELL.p, n: Sim.Params.CAP_PER_CELL.n, poly: Sim.Params.CAP_PER_CELL.poly, metal1: Sim.Params.CAP_PER_CELL.metal1 },
  CONTACT_CAP: Sim.Params.CONTACT_CAP,
  JUNCTION_CAP_PER_EDGE: Sim.Params.JUNCTION_CAP_PER_EDGE,
  TRANSISTOR: {
    BETA_PER_WIDTH: Sim.Params.TRANSISTOR.BETA_PER_WIDTH,
    LAMBDA: Sim.Params.TRANSISTOR.LAMBDA,
    DEPLETION_STRENGTH_SCALE: Sim.Params.TRANSISTOR.DEPLETION_STRENGTH_SCALE
  }
}));
let waveformConfig = { intervalPs: 1000, intervalCount: 6, inputs: [], outputs: [] };
const APP_VERSION = 'v0.8.10';
const APP_NAME = 'nMOS Chip Lab';
const THEME_STORAGE_KEY = 'chipLayoutThemeMode';
let themeMode = 'system';
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function updateDirtyUi() {
  document.title = `${dirty ? '* ' : ''}${APP_NAME} ${APP_VERSION}`;
  const el = document.getElementById('dirtyReadout');
  if (el) el.textContent = dirty ? 'Unsaved changes' : 'Saved';
}
function markDirty() { dirty = true; updateDirtyUi(); }
function clearDirty() { dirty = false; updateDirtyUi(); }
function confirmDiscardChanges() { return !dirty || window.confirm('You have unsaved changes. Discard them?'); }

function ffToUi(v) { return v * 1e15; }
function uiToFf(v) { return Number(v) * 1e-15; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function coordKey(x, y) { return `${x},${y}`; }
function screenToWorld(px, py) { return { x: Math.floor((px - view.offsetX) / view.scale), y: Math.floor((py - view.offsetY) / view.scale) }; }
function worldToScreen(x, y) { return { x: view.offsetX + x * view.scale, y: view.offsetY + y * view.scale }; }
function currentOverlayMode() { return document.getElementById('showCurrent').checked ? 'current' : 'voltage'; }

function safeStorageGet(key) { try { return window.localStorage.getItem(key); } catch { return null; } }
function safeStorageSet(key, value) { try { window.localStorage.setItem(key, value); } catch { } }
function effectiveThemeMode(mode) {
  if (mode === 'dark' || mode === 'light') return mode;
  return systemThemeQuery?.matches ? 'dark' : 'light';
}
function applyThemeMode(mode, persist=true) {
  themeMode = ['system','light','dark'].includes(mode) ? mode : 'system';
  const effective = effectiveThemeMode(themeMode);
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.themeEffective = effective;
  const sel = document.getElementById('themeMode');
  if (sel) sel.value = themeMode;
  if (persist) safeStorageSet(THEME_STORAGE_KEY, themeMode);
  renderAll();
}
function initThemeMode() {
  const stored = safeStorageGet(THEME_STORAGE_KEY);
  applyThemeMode(stored || 'system', false);
  const sel = document.getElementById('themeMode');
  if (sel) sel.addEventListener('change', ev => applyThemeMode(ev.target.value, true));
  if (systemThemeQuery) {
    const handler = () => { if (themeMode === 'system') applyThemeMode('system', false); };
    if (systemThemeQuery.addEventListener) systemThemeQuery.addEventListener('change', handler);
    else if (systemThemeQuery.addListener) systemThemeQuery.addListener(handler);
  }
}
function themeVar(name, fallback='') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const INPUT_TOOL_COLOR = '#c2b76d';
const OUTPUT_TOOL_COLOR = '#7b7068';
function dynamicToolDefs() {
  const defs = TOOL_DEFS.filter(def => !['portInput','portOut'].includes(def.id)).map(def => ({ ...def }));
  const selectDef = defs.find(def => def.id === 'select');
  const eraseDef = defs.find(def => def.id === 'erase');
  const base = defs.filter(def => !['select','erase'].includes(def.id));
  const signalDefs = [];
  waveformConfig.inputs.forEach((sig, idx) => signalDefs.push({ key:'', id:`portInput_${idx}`, label:`in ${sig.name}`, kind:'portInputNamed', portName:sig.name }));
  waveformConfig.outputs.forEach((sig, idx) => signalDefs.push({ key:'', id:`portOutput_${idx}`, label:`out ${sig.name}`, kind:'portOutputNamed', portName:sig.name }));
  return { utility:[selectDef, eraseDef].filter(Boolean), main:[...base, ...signalDefs].filter(Boolean) };
}
function currentToolDef() {
  const defs = dynamicToolDefs();
  return [...defs.utility, ...defs.main].find(t => t.id === currentTool) || TOOL_DEFS.find(t => t.id === currentTool);
}
function toolColor(def) {
  if (def.kind === 'layer') return ({ p:'#8dd0a3', pDepl:'#4ca36b', n:'#8ec1ff', poly:'#d45858', metal1:'#d4d8df' })[def.layer] || '#fff';
  if (def.kind === 'contactGeneric') return '#6b7280';
  if (def.kind === 'select') return '#c084fc';
  if (def.id === 'portVcc') return '#1d4ed8';
  if (def.id === 'portGnd') return '#2563eb';
  if (def.kind === 'portInputNamed' || def.id === 'portInput') return INPUT_TOOL_COLOR;
  if (def.kind === 'portOutputNamed' || def.id === 'portOut') return OUTPUT_TOOL_COLOR;
  return '#fff';
}

function buildToolButtons() {
  const wrap = document.getElementById('toolButtons');
  wrap.innerHTML = '';
  const groups = dynamicToolDefs();
  const appendToolButton = (def) => {
    const btn = document.createElement('button');
    btn.className = 'tool';
    btn.dataset.tool = def.id;
    const shortcut = def.key ? ` Shortcut ${def.key}.` : '';
    btn.setAttribute('aria-label', `Select ${def.label} tool.${shortcut}`);
    if (def.kind === 'select') {
      btn.classList.add('utilityTool');
      btn.innerHTML = `<span class="toolIcon" aria-hidden="true">↖</span>${def.label}`;
    } else if (def.kind === 'erase') {
      btn.classList.add('utilityTool');
      btn.innerHTML = `<span class="toolIcon" aria-hidden="true">⌫</span>${def.label}`;
    } else {
      btn.innerHTML = `<span class="swatch" style="background:${toolColor(def)}"></span>${def.label}`;
    }
    btn.onclick = () => { currentTool = def.id; syncButtons(); focusCanvas(); };
    wrap.appendChild(btn);
  };
  groups.utility.forEach(appendToolButton);
  if (groups.utility.length && groups.main.length) {
    const sep = document.createElement('div');
    sep.className = 'toolSeparator';
    sep.setAttribute('aria-hidden', 'true');
    wrap.appendChild(sep);
  }
  groups.main.forEach(appendToolButton);
}
function syncButtons() {
  for (const btn of document.querySelectorAll('#toolButtons button')) btn.classList.toggle('active', btn.dataset.tool === currentTool);
  document.getElementById('exampleSelect').value = currentExample;
  document.getElementById('toolReadout').textContent = `Tool ${currentToolDef()?.label || currentTool}`;
}


function loadParamsToUi() {
  document.getElementById('paramVcc').value = Sim.Params.VCC;
  document.getElementById('paramVthEnh').value = Sim.Params.VTH_ENH;
  document.getElementById('paramVthDepl').value = Sim.Params.VTH_DEPL;
  document.getElementById('paramRsqP').value = Sim.Params.RSQ.p;
  document.getElementById('paramRsqN').value = Sim.Params.RSQ.n;
  document.getElementById('paramRsqPoly').value = Sim.Params.RSQ.poly;
  document.getElementById('paramCapP').value = ffToUi(Sim.Params.CAP_PER_CELL.p).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
  document.getElementById('paramCapN').value = ffToUi(Sim.Params.CAP_PER_CELL.n).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
  document.getElementById('paramCapPoly').value = ffToUi(Sim.Params.CAP_PER_CELL.poly).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
  document.getElementById('paramCapM1').value = ffToUi(Sim.Params.CAP_PER_CELL.metal1).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
  document.getElementById('paramJuncCap').value = ffToUi(Sim.Params.JUNCTION_CAP_PER_EDGE).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
  document.getElementById('paramContactCap').value = ffToUi(Sim.Params.CONTACT_CAP).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
  document.getElementById('paramBeta').value = Sim.Params.TRANSISTOR.BETA_PER_WIDTH;
  document.getElementById('paramLambda').value = Sim.Params.TRANSISTOR.LAMBDA;
  document.getElementById('paramDeplScale').value = Sim.Params.TRANSISTOR.DEPLETION_STRENGTH_SCALE;
}
function applyParamsFromUi() {
  Sim.Params.VCC = Number(document.getElementById('paramVcc').value);
  Sim.Params.VTH_ENH = Number(document.getElementById('paramVthEnh').value);
  Sim.Params.VTH_DEPL = Number(document.getElementById('paramVthDepl').value);
  Sim.Params.RSQ.p = Number(document.getElementById('paramRsqP').value);
  Sim.Params.RSQ.n = Number(document.getElementById('paramRsqN').value);
  Sim.Params.RSQ.poly = Number(document.getElementById('paramRsqPoly').value);
  Sim.Params.CAP_PER_CELL.p = uiToFf(document.getElementById('paramCapP').value);
  Sim.Params.CAP_PER_CELL.n = uiToFf(document.getElementById('paramCapN').value);
  Sim.Params.CAP_PER_CELL.poly = uiToFf(document.getElementById('paramCapPoly').value);
  Sim.Params.CAP_PER_CELL.metal1 = uiToFf(document.getElementById('paramCapM1').value);
  Sim.Params.JUNCTION_CAP_PER_EDGE = uiToFf(document.getElementById('paramJuncCap').value);
  Sim.Params.CONTACT_CAP = uiToFf(document.getElementById('paramContactCap').value);
  Sim.Params.TRANSISTOR.BETA_PER_WIDTH = Number(document.getElementById('paramBeta').value);
  Sim.Params.TRANSISTOR.LAMBDA = Number(document.getElementById('paramLambda').value);
  Sim.Params.TRANSISTOR.DEPLETION_STRENGTH_SCALE = Number(document.getElementById('paramDeplScale').value);
  for (const p of currentLayout.ports) if (p.role === 'supply' && p.name === 'VCC') p.voltage = Sim.Params.VCC;
  markDirty();
  renderAll();
}
function resetParamsPreset() {
  Sim.Params.VCC = DEFAULT_PARAMS.VCC;
  Sim.Params.VTH_ENH = DEFAULT_PARAMS.VTH_ENH;
  Sim.Params.VTH_DEPL = DEFAULT_PARAMS.VTH_DEPL;
  Sim.Params.RSQ.p = DEFAULT_PARAMS.RSQ.p;
  Sim.Params.RSQ.n = DEFAULT_PARAMS.RSQ.n;
  Sim.Params.RSQ.poly = DEFAULT_PARAMS.RSQ.poly;
  Sim.Params.CAP_PER_CELL.p = DEFAULT_PARAMS.CAP_PER_CELL.p;
  Sim.Params.CAP_PER_CELL.n = DEFAULT_PARAMS.CAP_PER_CELL.n;
  Sim.Params.CAP_PER_CELL.poly = DEFAULT_PARAMS.CAP_PER_CELL.poly;
  Sim.Params.CAP_PER_CELL.metal1 = DEFAULT_PARAMS.CAP_PER_CELL.metal1;
  Sim.Params.CONTACT_CAP = DEFAULT_PARAMS.CONTACT_CAP;
  Sim.Params.JUNCTION_CAP_PER_EDGE = DEFAULT_PARAMS.JUNCTION_CAP_PER_EDGE;
  Sim.Params.TRANSISTOR.BETA_PER_WIDTH = DEFAULT_PARAMS.TRANSISTOR.BETA_PER_WIDTH;
  Sim.Params.TRANSISTOR.LAMBDA = DEFAULT_PARAMS.TRANSISTOR.LAMBDA;
  Sim.Params.TRANSISTOR.DEPLETION_STRENGTH_SCALE = DEFAULT_PARAMS.TRANSISTOR.DEPLETION_STRENGTH_SCALE;
  loadParamsToUi();
  applyParamsFromUi();
}

function normalizePortsAndLabels(L) {
  if (!L) return;
  if (!Array.isArray(L.ports)) L.ports = [];
  if (!Array.isArray(L.labels)) L.labels = [];
  L.labels = [];
  const byName = new Map();
  for (const p of L.ports) byName.set(p.name, p);
  L.ports = [...byName.values()].map(p => ({ ...p }));
  for (const p of L.ports) L.labels.push({ name:p.name, layer:p.layer, x:p.x, y:p.y });
}
function cloneLayoutState(L) { return L.clone(); }
function layoutSignature(L) {
  return JSON.stringify({
    layers: Object.fromEntries(Object.entries(L.layers).map(([k,v]) => [k, Array.from(v).sort()])),
    contacts: L.contacts.map(c => ({x:c.x,y:c.y,type:c.type})).sort((a,b)=>(a.y-b.y)||(a.x-b.x)||a.type.localeCompare(b.type)),
    ports: L.ports.map(p => ({name:p.name,role:p.role,x:p.x,y:p.y,layer:p.layer,voltage:p.voltage})).sort((a,b)=>a.name.localeCompare(b.name)||(a.y-b.y)||(a.x-b.x)),
    labels: L.labels.map(l => ({name:l.name,layer:l.layer,x:l.x,y:l.y})).sort((a,b)=>a.name.localeCompare(b.name)||(a.y-b.y)||(a.x-b.x))
  });
}
function commitLayoutChange(beforeState, beforeSig) {
  normalizePortsAndLabels(currentLayout);
  const afterSig = layoutSignature(currentLayout);
  if (afterSig === beforeSig) return false;
  undoHistory.push(beforeState);
  if (undoHistory.length > MAX_UNDO) undoHistory.shift();
  redoHistory = [];
  stopVisualReplay();
  markDirty();
  syncWaveformConfigFromLayout();
  renderAll();
  return true;
}
function undoEdit() {
  stopVisualReplay();
  if (!undoHistory.length) return;
  redoHistory.push(cloneLayoutState(currentLayout));
  currentLayout = undoHistory.pop();
  normalizePortsAndLabels(currentLayout);
  markDirty();
  syncWaveformConfigFromLayout();
  renderAll();
}
function redoEdit() {
  stopVisualReplay();
  if (!redoHistory.length) return;
  undoHistory.push(cloneLayoutState(currentLayout));
  currentLayout = redoHistory.pop();
  normalizePortsAndLabels(currentLayout);
  markDirty();
  syncWaveformConfigFromLayout();
  renderAll();
}
function clearAllLayout() {
  const before = cloneLayoutState(currentLayout), beforeSig = layoutSignature(currentLayout);
  currentLayout.layers = { p:new Set(), pDepl:new Set(), n:new Set(), poly:new Set(), metal1:new Set() };
  currentLayout.contacts = []; currentLayout.ports = []; currentLayout.labels = []; selectionRect = null;
  commitLayoutChange(before, beforeSig);
}

function getBoundsFromUi() {
  const x0 = Number(document.getElementById('boundX0').value), y0 = Number(document.getElementById('boundY0').value);
  const x1 = Number(document.getElementById('boundX1').value), y1 = Number(document.getElementById('boundY1').value);
  return { x0:Math.min(x0,x1), y0:Math.min(y0,y1), x1:Math.max(x0,x1), y1:Math.max(y0,y1) };
}
function syncBoundsFromUi(mark=true) { chipBounds = document.getElementById('boundsEnabled').checked ? getBoundsFromUi() : null; if (mark) markDirty(); renderAll(); }
function setBounds(bounds, enabled=true, keepClean=false) {
  document.getElementById('boundX0').value = bounds.x0;
  document.getElementById('boundY0').value = bounds.y0;
  document.getElementById('boundX1').value = bounds.x1;
  document.getElementById('boundY1').value = bounds.y1;
  document.getElementById('boundsEnabled').checked = enabled;
  syncBoundsFromUi();
  if (!keepClean) markDirty();
}
function inBounds(x, y) { return !chipBounds || (x >= chipBounds.x0 && x <= chipBounds.x1 && y >= chipBounds.y0 && y <= chipBounds.y1); }

function makeEditableLayout(example) {
  if (example === 'inverter') return Sim.makeInverterLayout().clone();
  if (example === 'nand') return Sim.makeNandLayout().clone();
  return new Sim.Layout(1, 1);
}
function measureLayoutExtent(L) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x,y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  for (const layer of Object.keys(L.layers)) for (const k of L.layers[layer]) { const [x,y] = k.split(',').map(Number); add(x,y); }
  for (const c of L.contacts) add(c.x,c.y);
  for (const p of L.ports) add(p.x,p.y);
  if (selectionRect) { add(selectionRect.x0, selectionRect.y0); add(selectionRect.x1, selectionRect.y1); }
  if (chipBounds) { add(chipBounds.x0, chipBounds.y0); add(chipBounds.x1, chipBounds.y1); }
  add(cursor.x, cursor.y);
  if (!isFinite(minX)) return { minX:-6, minY:-4, maxX:18, maxY:14 };
  return { minX, minY, maxX, maxY };
}
function defaultBoundsForLayout(L) { const ext = measureLayoutExtent(L); return { x0: ext.minX - 2, y0: ext.minY - 2, x1: ext.maxX + 2, y1: ext.maxY + 2 }; }
function fitViewToContent() {
  const canvas = document.getElementById('layout');
  if (!canvas) return;
  resizeCanvasToDisplay();
  const ext = measureLayoutExtent(currentLayout);
  const pad = 2.2;
  const contentW = Math.max(1, ext.maxX - ext.minX + 1 + pad * 2);
  const contentH = Math.max(1, ext.maxY - ext.minY + 1 + pad * 2);
  const usableW = Math.max(80, canvas.width - 24);
  const usableH = Math.max(80, canvas.height - 24);
  const fitted = Math.min(usableW / contentW, usableH / contentH);
  view.scale = Math.max(24, Math.min(220, fitted));
  const cx = (ext.minX + ext.maxX + 1) / 2;
  const cy = (ext.minY + ext.maxY + 1) / 2;
  view.offsetX = canvas.width / 2 - cx * view.scale;
  view.offsetY = canvas.height / 2 - cy * view.scale;
  updateViewportNote();
}
function zoomAt(screenX, screenY, factor) {
  const before = screenToWorld(screenX, screenY);
  view.scale = Math.max(4, Math.min(120, view.scale * factor));
  view.offsetX = screenX - before.x * view.scale;
  view.offsetY = screenY - before.y * view.scale;
  updateViewportNote();
  renderAll();
}
function updateViewportNote() { }

function makeDefaultLevels(index, count) { return Array.from({ length: count }, (_, i) => ((i + index) % 2 ? 1 : 0)); }
function ensureLevelLength(levels, count) { const out = (levels || []).slice(0, count); while (out.length < count) out.push(0); return out; }
function syncWaveformConfigFromLayout() {
  waveformConfig.intervalPs = Math.max(1, Number(document.getElementById('wfIntervalPs')?.value || waveformConfig.intervalPs || 1000));
  waveformConfig.intervalCount = Math.max(1, Number(document.getElementById('wfIntervalCount')?.value || waveformConfig.intervalCount || 6));
  const inputs = currentLayout.ports.filter(p => p.role === 'input').map(p => p.name);
  const outputs = currentLayout.ports.filter(p => p.role === 'output').map(p => p.name);
  const inMap = new Map(waveformConfig.inputs.map(s => [s.name, s]));
  const outMap = new Map(waveformConfig.outputs.map(s => [s.name, s]));
  waveformConfig.inputs = (inputs.length ? inputs : ['IN']).map((name, idx) => ({ name, levels: ensureLevelLength(inMap.get(name)?.levels || makeDefaultLevels(idx, waveformConfig.intervalCount), waveformConfig.intervalCount) }));
  waveformConfig.outputs = (outputs.length ? outputs : ['OUT']).map((name, idx) => ({ name, levels: ensureLevelLength(outMap.get(name)?.levels || makeDefaultLevels(idx + 1, waveformConfig.intervalCount), waveformConfig.intervalCount) }));
    document.getElementById('wfIntervalPs').value = waveformConfig.intervalPs;
  document.getElementById('wfIntervalCount').value = waveformConfig.intervalCount;
}
function applyWaveformNamesToLayout() {
  const inputs = currentLayout.ports.filter(p => p.role === 'input');
  const outputs = currentLayout.ports.filter(p => p.role === 'output');
  inputs.forEach((p, i) => { if (waveformConfig.inputs[i]) p.name = (waveformConfig.inputs[i].name || `IN${i+1}`).trim(); });
  outputs.forEach((p, i) => { if (waveformConfig.outputs[i]) p.name = (waveformConfig.outputs[i].name || `OUT${i+1}`).trim(); });
  normalizePortsAndLabels(currentLayout);
  }
function renderSignalCard(sig, sigIndex, kind) {
  sig.levels = ensureLevelLength(sig.levels, waveformConfig.intervalCount);
  const card = document.createElement('div');
  card.className = 'signalCard';
  const title = kind === 'input' ? 'Input' : 'Expected output';
  card.innerHTML = `<div class="signalHeader"><div class="sectionTitle">${title} ${sigIndex + 1}</div><div class="inlineTools"><button data-act="duplicate">Duplicate</button><button data-act="remove">Remove</button></div></div><div class="signalRow"><label style="flex:1">Name <input data-field="name" type="text" value="${sig.name}"></label><div class="tiny">Click cells or draw.</div></div><div class="signalLevels"></div><canvas class="drawCanvas" width="720" height="70" aria-label="Editable waveform for ${sig.name}. Drag near the top for logic one and near the bottom for logic zero."></canvas>`;
  const levelWrap = card.querySelector('.signalLevels');
  sig.levels.forEach((value, idx) => {
    const btn = document.createElement('button');
    btn.className = `levelBtn ${value ? 'on' : 'off'}`;
    btn.textContent = value ? '1' : '0';
    btn.setAttribute('aria-label', `${sig.name} interval ${idx + 1} is ${value ? 'on' : 'off'}`);
    btn.onclick = () => { sig.levels[idx] = value ? 0 : 1; markDirty(); renderWaveformDefinitions(); };
    levelWrap.appendChild(btn);
  });
  card.querySelector('[data-field=name]').addEventListener('input', ev => {
    sig.name = (ev.target.value || `${kind.toUpperCase()}${sigIndex+1}`).trim();
    applyWaveformNamesToLayout();
    markDirty();
    renderAll();
  });
  card.querySelector('[data-act=remove]').onclick = () => {
    const list = kind === 'input' ? waveformConfig.inputs : waveformConfig.outputs;
    if (list.length <= 1) return;
    list.splice(sigIndex, 1);
    applyWaveformNamesToLayout();
    markDirty();
    renderAll();
  };
  card.querySelector('[data-act=duplicate]').onclick = () => {
    const list = kind === 'input' ? waveformConfig.inputs : waveformConfig.outputs;
    list.splice(sigIndex + 1, 0, { name: `${sig.name}_copy`, levels: sig.levels.slice() });
    markDirty();
    renderAll();
  };
  const drawCanvas = card.querySelector('.drawCanvas');
  function paintWaveformCanvas() {
    const ctx = drawCanvas.getContext('2d');
    ctx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
    ctx.fillStyle = themeVar('--grid-bg', '#fff'); ctx.fillRect(0,0,drawCanvas.width,drawCanvas.height);
    const m = 8, w = drawCanvas.width - m*2, h = drawCanvas.height - m*2;
    ctx.strokeStyle = themeVar('--canvas-edge', '#d7deea'); ctx.strokeRect(m,m,w,h);
    ctx.strokeStyle = themeVar('--grid-line', '#edf1f7');
    for (let i = 1; i < waveformConfig.intervalCount; i++) {
      const x = m + (i / waveformConfig.intervalCount) * w;
      ctx.beginPath(); ctx.moveTo(x,m); ctx.lineTo(x,m+h); ctx.stroke();
    }
    ctx.beginPath();
    sig.levels.forEach((v, idx) => {
      const x0 = m + (idx / waveformConfig.intervalCount) * w;
      const x1 = m + ((idx + 1) / waveformConfig.intervalCount) * w;
      const y = m + (v ? 0.2 : 0.8) * h;
      if (idx === 0) ctx.moveTo(x0, y); else ctx.lineTo(x0, y);
      ctx.lineTo(x1, y);
    });
    ctx.strokeStyle = '#295fd1'; ctx.lineWidth = 2; ctx.stroke();
  }
  function applyWavePoint(ev) {
    const rect = drawCanvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (drawCanvas.width / rect.width);
    const y = (ev.clientY - rect.top) * (drawCanvas.height / rect.height);
    const idx = Math.max(0, Math.min(waveformConfig.intervalCount - 1, Math.floor(((x - 8) / Math.max(1, drawCanvas.width - 16)) * waveformConfig.intervalCount)));
    sig.levels[idx] = y < drawCanvas.height / 2 ? 1 : 0;
    markDirty();
    paintWaveformCanvas();
  }
  drawCanvas.addEventListener('mousedown', ev => { waveformDrawState = { kind, sigIndex }; applyWavePoint(ev); });
  drawCanvas.addEventListener('mousemove', ev => { if (waveformDrawState && waveformDrawState.kind === kind && waveformDrawState.sigIndex === sigIndex) applyWavePoint(ev); });
  drawCanvas.addEventListener('mouseup', () => { waveformDrawState = null; renderAll(); });
  drawCanvas.addEventListener('mouseleave', () => { waveformDrawState = null; });
  paintWaveformCanvas();
  return card;
}
function renderWaveformDefinitions() {
  document.getElementById('wfIntervalPs').value = waveformConfig.intervalPs;
  document.getElementById('wfIntervalCount').value = waveformConfig.intervalCount;
  const inputsWrap = document.getElementById('wfInputsList');
  const outputsWrap = document.getElementById('wfOutputsList');
  inputsWrap.innerHTML = '';
  outputsWrap.innerHTML = '';
  waveformConfig.inputs.forEach((sig, i) => inputsWrap.appendChild(renderSignalCard(sig, i, 'input')));
  waveformConfig.outputs.forEach((sig, i) => outputsWrap.appendChild(renderSignalCard(sig, i, 'output')));
}
function syncInputNamesFromLayout() { syncWaveformConfigFromLayout(); renderWaveformDefinitions(); }

function builtInWaveformPreset(example) {
  const count = Math.max(1, waveformConfig.intervalCount || 6);
  const rep = arr => ensureLevelLength(arr, count);
  if (example === 'inverter') {
    return {
      inputs: [{ name:'IN', levels: rep([0,1,0,1,0,1]) }],
      outputs: [{ name:'OUT', levels: rep([1,0,1,0,1,0]) }]
    };
  }
  if (example === 'nand') {
    return {
      inputs: [
        { name:'A', levels: rep([0,0,1,1,0,1]) },
        { name:'B', levels: rep([0,1,0,1,1,0]) }
      ],
      outputs: [{ name:'OUT', levels: rep([1,1,1,0,1,1]) }]
    };
  }
  return null;
}

function setExample(example) {
  stopVisualReplay();
  currentExample = example;
  currentLayout = makeEditableLayout(example);
  normalizePortsAndLabels(currentLayout);
  undoHistory = []; redoHistory = []; selectionRect = null; clipboardRegion = null; lastRun = null; clearDirty();
  cursor = { x:0, y:0 };
  if (example !== 'blank') {
    const ext = measureLayoutExtent(currentLayout);
    cursor = { x: ext.minX, y: ext.minY };
    setBounds(defaultBoundsForLayout(currentLayout), false, true);
  } else {
    setBounds({ x0:0, y0:0, x1:31, y1:23 }, false, true);
  }
  const preset = builtInWaveformPreset(example);
  if (preset) {
    waveformConfig.inputs = preset.inputs.map(sig => ({ name:sig.name, levels: sig.levels.slice() }));
    waveformConfig.outputs = preset.outputs.map(sig => ({ name:sig.name, levels: sig.levels.slice() }));
  }
  syncInputNamesFromLayout();
  applyWaveformNamesToLayout();
  resizeCanvasToDisplay();
  fitViewToContent();
  renderMainTab();
  renderAll();
  updateDirtyUi();
}

function serializeLayout(layout) {
  return {
    layers: Object.fromEntries(Object.entries(layout.layers).map(([k,v]) => [k, Array.from(v)])),
    contacts: layout.contacts.map(c => ({...c})),
    ports: layout.ports.map(p => ({...p})),
    labels: layout.labels.map(l => ({...l}))
  };
}
function applySerializedLayout(data) {
  const L = new Sim.Layout(1, 1);
  L.layers = { p:new Set(data.layers?.p || []), pDepl:new Set(data.layers?.pDepl || []), n:new Set(data.layers?.n || []), poly:new Set(data.layers?.poly || []), metal1:new Set(data.layers?.metal1 || []) };
  L.contacts = Array.isArray(data.contacts) ? data.contacts.map(c => ({ x:Number(c.x), y:Number(c.y), type:c.type })) : [];
  L.ports = Array.isArray(data.ports) ? data.ports.map(p => ({ name:String(p.name), role:p.role, x:Number(p.x), y:Number(p.y), layer:p.layer || 'metal1', voltage:p.voltage == null ? undefined : Number(p.voltage) })) : [];
  L.labels = Array.isArray(data.labels) ? data.labels.map(l => ({ name:String(l.name), layer:l.layer || 'metal1', x:Number(l.x), y:Number(l.y) })) : [];
  normalizePortsAndLabels(L);
  return L;
}
function collectDesignDocument() {
  return {
    format: 'chip-layout-design',
    version: '0.8.6.1',
    savedAt: new Date().toISOString(),
    currentExample,
    activeTab,
    viewState: { scale:view.scale, offsetX:view.offsetX, offsetY:view.offsetY },
    bounds: { enabled: !!chipBounds, values: getBoundsFromUi() },
    visibility: { ...visibility },
    params: {
      VCC: Sim.Params.VCC,
      VTH_ENH: Sim.Params.VTH_ENH,
      VTH_DEPL: Sim.Params.VTH_DEPL,
      RSQ: { ...Sim.Params.RSQ },
      CAP_PER_CELL: { ...Sim.Params.CAP_PER_CELL },
      CONTACT_CAP: Sim.Params.CONTACT_CAP,
      JUNCTION_CAP_PER_EDGE: Sim.Params.JUNCTION_CAP_PER_EDGE,
      TRANSISTOR: { ...Sim.Params.TRANSISTOR }
    },
    waveformConfig: JSON.parse(JSON.stringify(waveformConfig)),
    layout: serializeLayout(currentLayout)
  };
}
function suggestedSaveName() {
  return `chip-design-${new Date().toISOString().replace(/[:T]/g,'-').slice(0,19)}.chipdesign`;
}
function saveDesignToFile() {
  const blob = new Blob([JSON.stringify(collectDesignDocument(), null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = suggestedSaveName();
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  clearDirty();
  renderAll();
}
function applyLoadedDesign(doc) {
  if (!doc || doc.format !== 'chip-layout-design' || !doc.layout) throw new Error('Unrecognized design file.');
  stopVisualReplay();
  currentExample = doc.currentExample || 'blank';
  currentLayout = applySerializedLayout(doc.layout);
  waveformConfig = JSON.parse(JSON.stringify(doc.waveformConfig || waveformConfig));
  if (doc.params) {
    Sim.Params.VCC = Number(doc.params.VCC ?? Sim.Params.VCC);
    Sim.Params.VTH_ENH = Number(doc.params.VTH_ENH ?? Sim.Params.VTH_ENH);
    Sim.Params.VTH_DEPL = Number(doc.params.VTH_DEPL ?? Sim.Params.VTH_DEPL);
    if (doc.params.RSQ) Object.assign(Sim.Params.RSQ, doc.params.RSQ);
    if (doc.params.CAP_PER_CELL) Object.assign(Sim.Params.CAP_PER_CELL, doc.params.CAP_PER_CELL);
    if (doc.params.CONTACT_CAP != null) Sim.Params.CONTACT_CAP = Number(doc.params.CONTACT_CAP);
    if (doc.params.JUNCTION_CAP_PER_EDGE != null) Sim.Params.JUNCTION_CAP_PER_EDGE = Number(doc.params.JUNCTION_CAP_PER_EDGE);
    if (doc.params.TRANSISTOR) Object.assign(Sim.Params.TRANSISTOR, doc.params.TRANSISTOR);
  }
  loadParamsToUi();
  if (doc.visibility) {
    for (const [k,v] of Object.entries(doc.visibility)) if (k in visibility) visibility[k] = !!v;
    for (const cb of document.querySelectorAll('input[data-layer]')) cb.checked = !!visibility[cb.dataset.layer];
  }
  if (doc.bounds?.values) setBounds(doc.bounds.values, !!doc.bounds.enabled, true); else setBounds(defaultBoundsForLayout(currentLayout), false, true);
  undoHistory = []; redoHistory = []; selectionRect = null; clipboardRegion = null; lastRun = null;
  cursor = { x:0, y:0 };
  activeTab = doc.activeTab || activeTab;
  syncWaveformConfigFromLayout();
  applyWaveformNamesToLayout();
  resizeCanvasToDisplay();
  if (doc.viewState && Number.isFinite(doc.viewState.scale)) {
    view.scale = Math.max(4, Math.min(220, Number(doc.viewState.scale)));
    view.offsetX = Number(doc.viewState.offsetX) || 0;
    view.offsetY = Number(doc.viewState.offsetY) || 0;
  } else {
    fitViewToContent();
  }
  clearDirty();
  renderMainTab();
  renderAll();
}
async function loadDesignFromFile(file) {
  if (!file) return;
  if (!confirmDiscardChanges()) return;
  const text = await file.text();
  const doc = JSON.parse(text);
  applyLoadedDesign(doc);
}

function inferGenericContactType(L, x, y) {
  const k = coordKey(x, y); const hasP = L.layers.p.has(k) || L.layers.pDepl.has(k); const hasN = L.layers.n.has(k); const hasPoly = L.layers.poly.has(k); const hasM1 = L.layers.metal1.has(k);
  if (!hasM1) return null; if (hasPoly) return 'poly_m1'; if (hasN) return 'n_m1'; if (hasP) return 'p_m1'; return null;
}
function removeCellEverywhere(L, x, y) { const k = coordKey(x, y); for (const layer of Object.keys(L.layers)) L.layers[layer].delete(k); }
function removeContactsAt(L, x, y) { L.contacts = L.contacts.filter(c => !(c.x === x && c.y === y)); }
function removePortAt(L, x, y) { L.ports = L.ports.filter(p => !(p.x === x && p.y === y)); }
function removePortByName(L, name) { L.ports = L.ports.filter(p => p.name !== name); }
function ensureMetalAt(L, x, y) { L.layers.metal1.add(coordKey(x, y)); }
function placePort(L, name, role, x, y, extra={}) { removePortByName(L, name); ensureMetalAt(L, x, y); L.ports.push({ name, layer:'metal1', x, y, role, ...extra }); }
function normalizeRect(a, b) { return { x0:Math.min(a.x,b.x), y0:Math.min(a.y,b.y), x1:Math.max(a.x,b.x), y1:Math.max(a.y,b.y) }; }
function cellInRect(x, y, r) { return r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1; }
function copyRectFromLayout(L, r) {
  if (!r) return null;
  const clip = { width:r.x1-r.x0+1, height:r.y1-r.y0+1, layers:{ p:[], pDepl:[], n:[], poly:[], metal1:[] }, contacts:[], ports:[] };
  for (const layer of Object.keys(clip.layers)) for (const k of L.layers[layer]) { const [x,y] = k.split(',').map(Number); if (cellInRect(x,y,r)) clip.layers[layer].push({ x:x-r.x0, y:y-r.y0 }); }
  for (const c of L.contacts) if (cellInRect(c.x,c.y,r)) clip.contacts.push({ x:c.x-r.x0, y:c.y-r.y0, type:c.type });
  for (const p of L.ports) if (cellInRect(p.x,p.y,r)) clip.ports.push({ x:p.x-r.x0, y:p.y-r.y0, name:p.name, role:p.role, voltage:p.voltage });
  return clip;
}
function deleteRectFromLayout(L, r) {
  for (const layer of Object.keys(L.layers)) for (const k of [...L.layers[layer]]) { const [x,y] = k.split(',').map(Number); if (cellInRect(x,y,r)) L.layers[layer].delete(k); }
  L.contacts = L.contacts.filter(c => !cellInRect(c.x,c.y,r));
  L.ports = L.ports.filter(p => !cellInRect(p.x,p.y,r));
}
function copySelection() { if (selectionRect) clipboardRegion = copyRectFromLayout(currentLayout, selectionRect); renderAll(); }
function cutSelection() {
  if (!selectionRect) return;
  const before = cloneLayoutState(currentLayout), beforeSig = layoutSignature(currentLayout);
  clipboardRegion = copyRectFromLayout(currentLayout, selectionRect);
  deleteRectFromLayout(currentLayout, selectionRect);
  selectionRect = null;
  commitLayoutChange(before, beforeSig);
}
function pasteClipboard() {
  if (!clipboardRegion) return;
  const before = cloneLayoutState(currentLayout), beforeSig = layoutSignature(currentLayout);
  for (const [layer, items] of Object.entries(clipboardRegion.layers)) for (const item of items) currentLayout.layers[layer].add(coordKey(cursor.x + item.x, cursor.y + item.y));
  for (const c of clipboardRegion.contacts) if (inBounds(cursor.x+c.x, cursor.y+c.y)) currentLayout.contacts.push({ x:cursor.x+c.x, y:cursor.y+c.y, type:c.type });
  for (const p of clipboardRegion.ports) {
    const x = cursor.x + p.x, y = cursor.y + p.y;
    if (!inBounds(x,y)) continue;
    placePort(currentLayout, p.name, p.role, x, y, p.voltage !== undefined ? { voltage:p.voltage } : {});
  }
  selectionRect = { x0:cursor.x, y0:cursor.y, x1:cursor.x + clipboardRegion.width - 1, y1:cursor.y + clipboardRegion.height - 1 };
  commitLayoutChange(before, beforeSig);
}

function applyToolAt(x, y) {
  if (!inBounds(x, y)) return;
  const tool = currentToolDef(); if (!tool) return;
  const before = cloneLayoutState(currentLayout), beforeSig = layoutSignature(currentLayout);
  if (tool.kind === 'erase') {
    removeCellEverywhere(currentLayout, x, y); removeContactsAt(currentLayout, x, y); removePortAt(currentLayout, x, y);
  } else if (tool.kind === 'layer') {
    currentLayout.layers[tool.layer].add(coordKey(x, y));
    if (tool.layer === 'pDepl') currentLayout.layers.p.delete(coordKey(x, y));
    if (tool.layer === 'p') currentLayout.layers.pDepl.delete(coordKey(x, y));
  } else if (tool.kind === 'contactGeneric') {
    removeContactsAt(currentLayout, x, y);
    const inferred = inferGenericContactType(currentLayout, x, y);
    if (inferred) currentLayout.contacts.push({ x, y, type: inferred });
  } else if (tool.kind === 'port') {
    placePort(currentLayout, tool.portName, tool.portRole, x, y, { voltage: tool.voltage() });
  } else if (tool.kind === 'portInput') {
    placePort(currentLayout, waveformConfig.inputs[0]?.name || 'IN', 'input', x, y);
  } else if (tool.kind === 'portOutput') {
    placePort(currentLayout, waveformConfig.outputs[0]?.name || 'OUT', 'output', x, y);
  } else if (tool.kind === 'portInputNamed') {
    placePort(currentLayout, tool.portName || 'IN', 'input', x, y);
  } else if (tool.kind === 'portOutputNamed') {
    placePort(currentLayout, tool.portName || 'OUT', 'output', x, y);
  }
  commitLayoutChange(before, beforeSig);
}
function moveCursor(dx, dy, paint=false) {
  const nx = cursor.x + dx, ny = cursor.y + dy; if (!inBounds(nx, ny)) return; cursor = { x:nx, y:ny }; if (paint) applyToolAt(nx, ny); else renderAll();
}


function getCellVisualInfo(layout, x, y) {
  const k = coordKey(x, y);
  const port = layout.ports.find(p => p.x === x && p.y === y);
  if (port?.role === 'input') return { fill: INPUT_TOOL_COLOR, text: '#111827' };
  if (port?.role === 'output') return { fill: OUTPUT_TOOL_COLOR, text: '#ffffff' };
  if (port?.role === 'supply') return { fill: '#1d4ed8', text: '#ffffff' };
  if (layout.layers.metal1.has(k)) return { fill:'#d4d8df', text:'#111827' };
  if (layout.layers.poly.has(k)) return { fill:'#d45858', text:'#ffffff' };
  if (layout.layers.n.has(k)) return { fill:'#8ec1ff', text:'#111827' };
  if (layout.layers.pDepl.has(k)) return { fill:'#4ca36b', text:'#ffffff' };
  if (layout.layers.p.has(k)) return { fill:'#8dd0a3', text:'#111827' };
  return { fill:'#ffffff', text:'#111827' };
}
function fitLabelFont(ctx, text, maxWidth, maxHeight) {
  const safeMaxWidth = Math.max(6, maxWidth);
  for (let size = Math.max(8, Math.floor(maxHeight)); size >= 7; size--) {
    ctx.font = `700 ${size}px system-ui`;
    if (ctx.measureText(text).width <= safeMaxWidth) return size;
  }
  return 7;
}
function drawTriangle(ctx, ax, ay, bx, by, cx, cy, fill) {
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.2; ctx.stroke();
}

function buildCellOverlay(layout, net, overlayStep, mode) {
  if (!overlayStep) return null;
  const coordValues = new Map(); let maxVal = 0;
  const addCoord = (x, y, val) => { const k = `${x},${y}`; const prev = coordValues.get(k) || 0; const next = Math.max(prev, val); coordValues.set(k, next); maxVal = Math.max(maxVal, next); };
  if (mode === 'voltage') {
    for (const [node, v] of overlayStep.voltages.entries()) {
      const m = /^([^:]+):(-?\d+),(-?\d+)$/.exec(node); if (!m) continue; addCoord(Number(m[2]), Number(m[3]), Math.max(0, Math.min(1, v / Math.max(Sim.Params.VCC, 1e-9))));
    }
    maxVal = 1;
  } else {
    const currents = Sim.edgeCurrents(overlayStep.edges || [], overlayStep.voltages, overlayStep.fixedVoltages || new Map());
    for (const e of currents) for (const node of [e.a, e.b]) { const m = /^([^:]+):(-?\d+),(-?\d+)$/.exec(node); if (!m) continue; addCoord(Number(m[2]), Number(m[3]), e.absI); }
  }
  return { mode, coordValues, maxVal: Math.max(maxVal, 1e-12) };
}
function drawLayoutOnCanvas(canvas, layout, net, overlayStep=null, overlayMode='voltage') {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const gridBg = themeVar('--grid-bg', '#fcfcfc');
  const gridLine = themeVar('--grid-line', '#d8d8d8');
  const gridBound = themeVar('--grid-bound', '#2458bf');
  const canvasEdge = themeVar('--canvas-edge', '#6b6b6b');
  canvas.style.background = gridBg;
  canvas.style.borderColor = canvasEdge;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = gridBg; ctx.fillRect(0,0,canvas.width,canvas.height);
  const startX = Math.floor((-view.offsetX) / view.scale) - 1, endX = Math.ceil((canvas.width - view.offsetX) / view.scale) + 1;
  const startY = Math.floor((-view.offsetY) / view.scale) - 1, endY = Math.ceil((canvas.height - view.offsetY) / view.scale) + 1;
  ctx.strokeStyle = gridLine; ctx.lineWidth = 1;
  for (let x = startX; x <= endX; x++) { const sx = Math.round(view.offsetX + x * view.scale) + 0.5; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); ctx.stroke(); }
  for (let y = startY; y <= endY; y++) { const sy = Math.round(view.offsetY + y * view.scale) + 0.5; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy); ctx.stroke(); }
  const overlay = buildCellOverlay(layout, net, overlayStep, overlayMode);
  const drawCell = (x, y, fill, alpha=1) => { const p = worldToScreen(x,y); ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fillRect(p.x + 1, p.y + 1, view.scale - 2, view.scale - 2); ctx.globalAlpha = 1; };
  if (overlay) for (const [k, value] of overlay.coordValues.entries()) { const [x,y] = k.split(',').map(Number); const t = overlay.mode === 'voltage' ? value : Math.min(1, value / overlay.maxVal); drawCell(x, y, overlay.mode === 'voltage' ? `rgba(255,200,0,${0.15 + 0.55 * t})` : `rgba(255,0,0,${0.1 + 0.6 * t})`, 1); }
  if (visibility.p) for (const k of layout.layers.p) { const [x,y] = k.split(',').map(Number); drawCell(x,y,'#8dd0a3',0.9); }
  if (visibility.pDepl) for (const k of layout.layers.pDepl) { const [x,y] = k.split(',').map(Number); drawCell(x,y,'#4ca36b',0.95); const p = worldToScreen(x,y); ctx.strokeStyle='#1f6b40'; ctx.strokeRect(p.x+3,p.y+3,view.scale-6,view.scale-6); }
  if (visibility.n) for (const k of layout.layers.n) { const [x,y] = k.split(',').map(Number); drawCell(x,y,'#8ec1ff',0.95); }
  if (visibility.poly) for (const k of layout.layers.poly) { const [x,y] = k.split(',').map(Number); drawCell(x,y,'#d45858',0.78); }
  if (visibility.metal1) for (const k of layout.layers.metal1) { const [x,y] = k.split(',').map(Number); drawCell(x,y,'#d4d8df',0.76); }
  if (chipBounds) {
    const a = worldToScreen(chipBounds.x0, chipBounds.y0), b = worldToScreen(chipBounds.x1 + 1, chipBounds.y1 + 1);
    ctx.strokeStyle = gridBound; ctx.lineWidth = 2; ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
  if (visibility.contacts) for (const c of layout.contacts) { const p = worldToScreen(c.x, c.y); ctx.fillStyle='#111827'; ctx.beginPath(); ctx.arc(p.x + view.scale/2, p.y + view.scale/2, Math.max(2, view.scale*0.16), 0, Math.PI*2); ctx.fill(); }
  if (visibility.junctions) {
    const suppressed = new Set();
    for (const tx of net.transistorDevices) {
      if (tx.orientation === 'h') {
        suppressed.add(`${tx.x},${tx.y}|${tx.x-1},${tx.y}`);
        suppressed.add(`${tx.x},${tx.y}|${tx.x+1},${tx.y}`);
      } else {
        suppressed.add(`${tx.x},${tx.y}|${tx.x},${tx.y-1}`);
        suppressed.add(`${tx.x},${tx.y}|${tx.x},${tx.y+1}`);
      }
    }
    ctx.strokeStyle='#a855f7'; ctx.lineWidth=Math.max(2, view.scale * 0.08);
    for (const j of net.junctions) {
      if (suppressed.has(`${j.x},${j.y}|${j.nx},${j.ny}`)) continue;
      const a = worldToScreen(j.x, j.y), b = worldToScreen(j.nx, j.ny);
      const ax = a.x + view.scale/2, ay = a.y + view.scale/2, bx = b.x + view.scale/2, by = b.y + view.scale/2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
  }
  if (visibility.transistors) for (const tx of net.transistorDevices) {
    const p = worldToScreen(tx.x, tx.y);
    const cx = p.x + view.scale/2, cy = p.y + view.scale/2;
    const wing = Math.max(6, view.scale * 0.2), reach = Math.max(8, view.scale * 0.32), dot = Math.max(2.5, view.scale * 0.08);
    const butterflyFill = tx.mode === 'depletion' ? '#111111' : '#ffffff';
    if (tx.orientation === 'h') {
      drawTriangle(ctx, cx - wing, cy, cx - reach, cy - wing, cx - reach, cy + wing, butterflyFill);
      drawTriangle(ctx, cx + wing, cy, cx + reach, cy - wing, cx + reach, cy + wing, butterflyFill);
    } else {
      drawTriangle(ctx, cx, cy - wing, cx - wing, cy - reach, cx + wing, cy - reach, butterflyFill);
      drawTriangle(ctx, cx, cy + wing, cx - wing, cy + reach, cx + wing, cy + reach, butterflyFill);
    }
    ctx.fillStyle=butterflyFill; ctx.beginPath(); ctx.arc(cx, cy, dot, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = tx.mode === 'depletion' ? '#ffffff' : '#111827'; ctx.lineWidth=1.4; ctx.stroke();
  }
  if (visibility.ports) for (const p of layout.ports) {
    const s = worldToScreen(p.x, p.y);
    ctx.fillStyle = p.role === 'input' ? INPUT_TOOL_COLOR : p.role === 'output' ? OUTPUT_TOOL_COLOR : '#1d4ed8';
    ctx.fillRect(s.x+4,s.y+4,view.scale-8,view.scale-8);
  }
  if (visibility.labels) {
    ctx.textBaseline='middle'; ctx.textAlign='center';
    for (const lab of layout.labels) {
      if (!visibility.ports) continue;
      const p = worldToScreen(lab.x, lab.y);
      const visual = getCellVisualInfo(layout, lab.x, lab.y);
      const fontSize = fitLabelFont(ctx, lab.name, view.scale - 6, view.scale * 0.42);
      ctx.font = `700 ${fontSize}px system-ui`;
      ctx.fillStyle = visual.text;
      ctx.strokeStyle = visual.text === '#ffffff' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2.5;
      const tx = p.x + view.scale / 2, ty = p.y + view.scale / 2;
      ctx.strokeText(lab.name, tx, ty);
      ctx.fillText(lab.name, tx, ty);
    }
    ctx.textAlign='start'; ctx.textBaseline='alphabetic';
  }
  if (selectionRect) {
    const a = worldToScreen(selectionRect.x0, selectionRect.y0), b = worldToScreen(selectionRect.x1 + 1, selectionRect.y1 + 1);
    ctx.strokeStyle='#8b5cf6'; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.strokeRect(a.x+1,a.y+1,b.x-a.x-2,b.y-a.y-2); ctx.setLineDash([]);
  }
  const cp = worldToScreen(cursor.x, cursor.y); ctx.strokeStyle='#111827'; ctx.lineWidth=2; ctx.strokeRect(cp.x+1, cp.y+1, view.scale-2, view.scale-2);
}
function drawLayout(layout, net, overlayStep=null, overlayMode='voltage') { drawLayoutOnCanvas(document.getElementById('layout'), layout, net, overlayStep, overlayMode); }

function createCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function drawWave(canvas, series, label, color, yMax, markerT=null, clipT=null) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const m = { l:40, r:12, t:16, b:20 }, x0 = m.l, y0 = m.t, w = canvas.width - m.l - m.r, h = canvas.height - m.t - m.b;
  const waveBg = themeVar('--wave-bg', themeVar('--grid-bg', '#fff'));
  const waveGrid = themeVar('--wave-grid', themeVar('--canvas-edge', '#d7deea'));
  const waveText = themeVar('--wave-text', '#111827');
  const waveMarker = themeVar('--wave-marker', waveText);
  ctx.fillStyle = waveBg; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = waveGrid; ctx.strokeRect(x0,y0,w,h);
  ctx.strokeStyle = waveGrid; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const gy = y0 + (i / 4) * h;
    ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + w, gy); ctx.stroke();
  }
  ctx.fillStyle = waveText; ctx.font = '12px system-ui'; ctx.fillText(label, 10, 13);
  const tmax = Math.max(series.at(-1)?.t || 1, 1e-12);
  ctx.beginPath(); let started = false;
  for (const s of series) {
    if (clipT != null && s.t > clipT) break;
    const x = x0 + (s.t / tmax) * w;
    const y = y0 + h - ((s.v || 0) / Math.max(yMax, 1e-9)) * h;
    if (!started) { ctx.moveTo(x,y); started = true; } else ctx.lineTo(x,y);
  }
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  if (markerT != null) { const mx = x0 + (markerT / tmax) * w; ctx.strokeStyle = waveMarker; ctx.beginPath(); ctx.moveTo(mx, y0); ctx.lineTo(mx, y0+h); ctx.stroke(); }
}
function showWaveformsIn(targetId, series, signalNames, markerT=null, clipT=null, width=320, height=130) {
  const wrap = document.getElementById(targetId); if (!wrap) return;
  wrap.innerHTML = '';
  const colors = ['#295fd1','#059669','#dc2626','#9333ea','#b45309','#0f766e'];
  signalNames.forEach((name, idx) => {
    const c = createCanvas(width, height);
    c.setAttribute('aria-label', `Waveform plot for ${name}. Horizontal axis is time and vertical axis is voltage.`);
    drawWave(c, Sim.measureNode(series, name), name, colors[idx % colors.length], Sim.Params.VCC, markerT, clipT);
    wrap.appendChild(c);
  });
}

function makeDriveFromLevels(levels, intervalPs) {
  const interval = Math.max(1, Number(intervalPs) || 1) * 1e-12;
  const seq = ensureLevelLength(levels, Math.max(1, levels.length));
  return function(t) { const idx = Math.min(seq.length - 1, Math.max(0, Math.floor(t / interval))); return seq[idx] ? Sim.Params.VCC : 0; };
}
function compareExpectedOutputs(series) {
  const rows = [];
  for (const sig of waveformConfig.outputs) {
    const measured = Sim.measureNode(series, sig.name);
    const expected = ensureLevelLength(sig.levels, waveformConfig.intervalCount);
    let mismatches = 0;
    measured.forEach(step => {
      const idx = Math.min(expected.length - 1, Math.floor(step.t / (waveformConfig.intervalPs * 1e-12)));
      if (Sim.logicLevel(step.v) !== expected[idx]) mismatches++;
    });
    rows.push({ name:sig.name, mismatches, samples: measured.length });
  }
  return rows;
}
function runSimulation() {
  stopVisualReplay();
  try {
    const dt = Number(document.getElementById('dtPs').value) * 1e-12;
    syncWaveformConfigFromLayout();
    const totalTime = waveformConfig.intervalCount * waveformConfig.intervalPs * 1e-12;
    const steps = Math.max(1, Math.ceil(totalTime / Math.max(dt, 1e-15)));
    const testLayout = currentLayout.clone();
    const inputPorts = testLayout.ports.filter(p => p.role === 'input');
    inputPorts.forEach((p, idx) => {
      const def = waveformConfig.inputs.find(s => s.name === p.name) || waveformConfig.inputs[idx];
      testLayout.setDrive(p.name, def ? makeDriveFromLevels(def.levels, waveformConfig.intervalPs) : 0);
    });
    const net0 = Sim.extractNetwork(testLayout, 0);
    if (net0.conflicts.length) { const err = new Error('passive-net conflicts'); err.conflicts = net0.conflicts; throw err; }
    const dc = Sim.solveDC(net0);
    const series = Sim.transientSim(testLayout, { dt, steps });
    let signalNames = testLayout.ports.filter(p => p.role === 'input' || p.role === 'output').map(p => p.name);
    if (!signalNames.length) signalNames = ['OUT'];
    let extra = `<div class="muted">DC operating point at t = 0</div><table><tr><th>Node</th><th>Voltage</th></tr>`;
    for (const name of signalNames) { const node = net0.labelNodes.get(name); if (node) extra += `<tr><td>${name}</td><td>${(dc.voltages.get(node) ?? 0).toFixed(3)}</td></tr>`; }
    extra += '</table>';
    const cmp = compareExpectedOutputs(series);
    if (cmp.length) {
      extra += '<div class="muted" style="margin-top:8px">Expected output check</div><table><tr><th>Signal</th><th>Mismatches</th><th>Samples</th></tr>';
      for (const row of cmp) extra += `<tr><td>${row.name}</td><td class="${row.mismatches ? 'bad' : 'ok'}">${row.mismatches}</td><td>${row.samples}</td></tr>`;
      extra += '</table>';
    }
    lastRun = { series, extra, signalNames, comparison: cmp };
  } catch (err) {
    lastRun = { error: err.message, conflicts: err.conflicts || [] };
  }
  renderAll();
}
function replayFrame() {
  if (!visualReplay.running || !lastRun || lastRun.error) return;
  const series = lastRun.series; if (!series || !series.length) return;
  const idx = Math.min(visualReplay.index, series.length - 1), step = series[idx], markerT = step.t, clipT = document.getElementById('showPartial').checked ? markerT : null;
  const runNet = Sim.extractNetwork(currentLayout, markerT);
  drawLayout(currentLayout, runNet, step, visualReplay.mode);
  document.getElementById('waveStats').textContent = `Replay ${idx + 1}/${series.length} at ${(markerT * 1e9).toFixed(3)} ns`;
  if (!document.getElementById('waveWrap').classList.contains('hidden')) showWaveformsIn('waveforms', series, lastRun.signalNames, markerT, clipT, 320, 130);
  showWaveformsIn('waveGridMain', series, lastRun.signalNames, markerT, clipT, 820, 160);
  document.getElementById('extra').innerHTML = lastRun.extra;
  if (idx >= series.length - 1) { visualReplay.running = false; visualReplay.timer = null; return; }
  visualReplay.index += 1;
  visualReplay.timer = setTimeout(replayFrame, Number(document.getElementById('visualMs').value) || 1);
}
function startVisualReplay() { if (dirty || !lastRun) runSimulation(); if (!lastRun || lastRun.error) return; stopVisualReplay(); visualReplay.running = true; visualReplay.index = 0; visualReplay.mode = currentOverlayMode(); replayFrame(); }
function stopVisualReplay() { if (visualReplay.timer) clearTimeout(visualReplay.timer); visualReplay = { timer:null, index:0, running:false, mode:'voltage' }; }

function renderResults() {
  const waveWrap = document.getElementById('waveWrap');
  const waveTitle = document.getElementById('waveTitle');
  const extra = document.getElementById('extra');
  const waveStats = document.getElementById('waveStats');
  if (!lastRun) {
    waveTitle.textContent = 'Waveforms'; waveStats.textContent = '';
    document.getElementById('waveforms').innerHTML = ''; document.getElementById('waveGridMain').innerHTML = '';
    extra.innerHTML = '<div class="muted">Run the current die to populate transient and DC results.</div>';
    return;
  }
  if (lastRun.error) {
    waveTitle.textContent = 'Waveforms'; waveStats.textContent = 'blocked';
    document.getElementById('waveforms').innerHTML = ''; document.getElementById('waveGridMain').innerHTML = '';
    extra.innerHTML = lastRun.conflicts?.length ? `<pre class="bad">${JSON.stringify(lastRun.conflicts, null, 2)}</pre>` : `<div class="bad">Simulation blocked: ${lastRun.error}</div>`;
    return;
  }
  waveTitle.textContent = 'Waveforms'; waveStats.textContent = `${lastRun.signalNames.length} signals`;
  if (!waveWrap.classList.contains('hidden')) showWaveformsIn('waveforms', lastRun.series, lastRun.signalNames, null, null, 320, 130);
  showWaveformsIn('waveGridMain', lastRun.series, lastRun.signalNames, null, null, 820, 160);
  extra.innerHTML = lastRun.extra;
}
function renderMeta() {
  if (!currentLayout) return;
  normalizePortsAndLabels(currentLayout);
  const net = Sim.extractNetwork(currentLayout, 0);
  document.getElementById('editorStatus').innerHTML = [
    `<div><strong>Cursor</strong><br>(${cursor.x}, ${cursor.y})</div>`,
    `<div><strong>Tool</strong><br>${currentToolDef()?.label || currentTool}</div>`,
    `<div><strong>Selection</strong><br>${selectionRect ? `(${selectionRect.x0},${selectionRect.y0})–(${selectionRect.x1},${selectionRect.y1})` : 'none'}</div>`,
    `<div><strong>Clipboard</strong><br>${clipboardRegion ? `${clipboardRegion.width}×${clipboardRegion.height}` : 'empty'}</div>`,
    `<div><strong>Undo</strong><br>${undoHistory.length}</div>`,
    `<div><strong>Status</strong><br><span class="${dirty ? 'warn' : 'ok'}">${dirty ? 'edited' : 'ready'}</span></div>`
  ].join('');
  document.getElementById('summary').innerHTML = `
    <div><strong>Transistors</strong><br>${net.transistorDevices.length}</div>
    <div><strong>p-n bounds</strong><br>${net.junctions.length}</div>
    <div><strong>Ports</strong><br>${currentLayout.ports.map(p => p.name).join(', ') || 'none'}</div>
    <div><strong>Cells</strong><br>${Object.values(currentLayout.layers).reduce((sum, set) => sum + set.size, 0)}</div>
    <div><strong>Bounds</strong><br>${chipBounds ? `(${chipBounds.x0},${chipBounds.y0})–(${chipBounds.x1},${chipBounds.y1})` : 'unbounded'}</div>
    <div><strong>Intervals</strong><br>${waveformConfig.intervalCount} × ${waveformConfig.intervalPs} ps</div>`;
  document.getElementById('conflicts').innerHTML = net.conflicts.length ? `<div class="bad"><strong>Layout conflicts</strong><pre>${JSON.stringify(net.conflicts, null, 2)}</pre></div>` : `<div class="ok">No passive-net conflicts in the current edit state.</div>`;
  drawLayout(currentLayout, net, null, currentOverlayMode());
  document.getElementById('cursorReadout').textContent = `Cursor ${cursor.x},${cursor.y}`;
  document.getElementById('boundsReadout').textContent = `Bounds ${chipBounds ? `(${chipBounds.x0},${chipBounds.y0})–(${chipBounds.x1},${chipBounds.y1})` : 'unbounded'}`;
}
function renderAll() {
  buildToolButtons();
  syncButtons();
  updateViewportNote();
  if (!currentLayout) return;
  renderMeta();
  renderResults();
  renderWaveformDefinitions();
}
function renderMainTab() {
  document.querySelectorAll('.mainTab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTab));
  document.getElementById('tabDie').classList.toggle('active', activeTab === 'Die');
  document.getElementById('tabParams').classList.toggle('active', activeTab === 'Params');
  document.getElementById('tabWaveforms').classList.toggle('active', activeTab === 'Waveforms');
  document.getElementById('tabWaveDefs').classList.toggle('active', activeTab === 'WaveDefs');
  resizeCanvasToDisplay();
}

function closeMenus() {
  openMenuId = null;
  document.querySelectorAll('.menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.menuButton').forEach(b => { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
}
function openMenu(button) {
  const menu = document.getElementById(button.dataset.menu);
  if (!menu) return;
  document.querySelectorAll('.menu').forEach(m => m.classList.toggle('open', m === menu));
  document.querySelectorAll('.menuButton').forEach(b => { const isOpen = b === button; b.classList.toggle('open', isOpen); b.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); });
  openMenuId = menu.id;
}

function onCanvasPointerDown(ev) {
  const canvas = document.getElementById('layout'); const rect = canvas.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * (canvas.width / rect.width), py = (ev.clientY - rect.top) * (canvas.height / rect.height);
  if (ev.button === 1 || ev.button === 2) { mousePan = { x:ev.clientX, y:ev.clientY, ox:view.offsetX, oy:view.offsetY }; return; }
  const cell = screenToWorld(px, py); if (!inBounds(cell.x, cell.y)) return; cursor = cell;
  if (currentTool === 'select') { selectionDrag = cell; selectionRect = normalizeRect(selectionDrag, cell); renderAll(); }
  else applyToolAt(cell.x, cell.y);
  focusCanvas();
}
function onCanvasPointerMove(ev) {
  const canvas = document.getElementById('layout'); const rect = canvas.getBoundingClientRect();
  if (mousePan) { view.offsetX = mousePan.ox + (ev.clientX - mousePan.x) * (canvas.width / rect.width); view.offsetY = mousePan.oy + (ev.clientY - mousePan.y) * (canvas.height / rect.height); renderAll(); return; }
  if (!(ev.buttons & 1)) return;
  const px = (ev.clientX - rect.left) * (canvas.width / rect.width), py = (ev.clientY - rect.top) * (canvas.height / rect.height);
  const cell = screenToWorld(px, py); if (!inBounds(cell.x, cell.y)) return; cursor = cell;
  if (currentTool === 'select') { if (!selectionDrag) selectionDrag = cell; selectionRect = normalizeRect(selectionDrag, cell); renderAll(); }
  else applyToolAt(cell.x, cell.y);
}
function onCanvasPointerUp() { mousePan = null; selectionDrag = null; }
function onCanvasWheel(ev) {
  ev.preventDefault(); const canvas = document.getElementById('layout'); const rect = canvas.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * (canvas.width / rect.width), py = (ev.clientY - rect.top) * (canvas.height / rect.height);
  zoomAt(px, py, ev.deltaY < 0 ? 1.1 : 1/1.1);
}
function focusCanvas() { document.getElementById('layout').focus(); }
function handleKey(ev) {
  const tag = (ev.target?.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const key = ev.key, upper = key.length === 1 ? key.toUpperCase() : key;
  if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && upper === 'Z') { ev.preventDefault(); undoEdit(); return; }
  if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && upper === 'C') { ev.preventDefault(); copySelection(); return; }
  if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && upper === 'X') { ev.preventDefault(); cutSelection(); return; }
  if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && upper === 'V') { ev.preventDefault(); pasteClipboard(); return; }
  if (((ev.ctrlKey || ev.metaKey) && ((ev.shiftKey && upper === 'Z') || upper === 'Y')) || upper === 'Y') { ev.preventDefault(); redoEdit(); return; }
  if (upper === 'R') { ev.preventDefault(); runSimulation(); return; }
  if (upper === 'P') { ev.preventDefault(); startVisualReplay(); return; }
  if (upper === 'S') { ev.preventDefault(); stopVisualReplay(); renderAll(); return; }
  if (key === ' ' || key === 'Enter') { ev.preventDefault(); applyToolAt(cursor.x, cursor.y); return; }
  if (ev.shiftKey && (key === 'Backspace' || key === 'Delete')) { ev.preventDefault(); clearAllLayout(); return; }
  if (key === 'Backspace' || key === 'Delete') { ev.preventDefault(); currentTool = 'erase'; syncButtons(); applyToolAt(cursor.x, cursor.y); return; }
  if (key === 'ArrowLeft') { ev.preventDefault(); moveCursor(-1, 0, ev.shiftKey); return; }
  if (key === 'ArrowRight') { ev.preventDefault(); moveCursor(1, 0, ev.shiftKey); return; }
  if (key === 'ArrowUp') { ev.preventDefault(); moveCursor(0, -1, ev.shiftKey); return; }
  if (key === 'ArrowDown') { ev.preventDefault(); moveCursor(0, 1, ev.shiftKey); return; }
  if (upper === 'E') { currentTool = 'erase'; renderAll(); return; }
  const hit = dynamicToolDefs().find(t => t.key && t.key.toUpperCase() === upper); if (hit) { currentTool = hit.id; renderAll(); }
}
function resizeCanvasToDisplay() {
  const sizeCanvas = (id, minW, minH) => {
    const c = document.getElementById(id); if (!c) return false;
    const rect = c.getBoundingClientRect();
    const w = Math.max(minW, Math.round(rect.width || minW));
    const h = Math.max(minH, Math.round(rect.height || minH));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; return true; }
    return false;
  };
  const changed = sizeCanvas('layout', 800, 560);
  renderMeta();
  return changed;
}

document.querySelectorAll('.menuButton').forEach(btn => {
  btn.addEventListener('mousedown', ev => { ev.preventDefault(); ev.stopPropagation(); if (openMenuId === btn.dataset.menu) closeMenus(); else openMenu(btn); });
  btn.addEventListener('mouseenter', () => { if (openMenuId) openMenu(btn); });
});
document.addEventListener('mousedown', ev => { if (!ev.target.closest('.menuRoot')) closeMenus(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeMenus(); });
for (const menu of document.querySelectorAll('.menu')) menu.addEventListener('click', ev => { if (ev.target.closest('button')) closeMenus(); });

for (const cb of document.querySelectorAll('input[data-layer]')) cb.addEventListener('change', () => { visibility[cb.dataset.layer] = cb.checked; renderAll(); });
document.getElementById('showCurrent').addEventListener('change', renderAll);
document.getElementById('boundsEnabled').addEventListener('change', () => syncBoundsFromUi(true));
for (const id of ['boundX0','boundY0','boundX1','boundY1']) document.getElementById(id).addEventListener('input', () => { if (document.getElementById('boundsEnabled').checked) syncBoundsFromUi(true); });
document.getElementById('btnFitBounds').onclick = () => setBounds(defaultBoundsForLayout(currentLayout), true, false);
document.getElementById('btnClearBounds').onclick = () => { document.getElementById('boundsEnabled').checked = false; syncBoundsFromUi(true); };
document.getElementById('btnZoomIn').onclick = () => zoomAt(document.getElementById('layout').width / 2, document.getElementById('layout').height / 2, 1.15);
document.getElementById('btnZoomOut').onclick = () => zoomAt(document.getElementById('layout').width / 2, document.getElementById('layout').height / 2, 1 / 1.15);
document.getElementById('btnFitView').onclick = () => { fitViewToContent(); renderAll(); };
document.getElementById('btnLoadExample').onclick = () => { if (confirmDiscardChanges()) setExample(document.getElementById('exampleSelect').value); };
document.getElementById('btnRun').onclick = runSimulation;
document.getElementById('btnVisual').onclick = startVisualReplay;
document.getElementById('btnStopVisual').onclick = () => { stopVisualReplay(); renderAll(); };
document.getElementById('btnUndo').onclick = undoEdit;
document.getElementById('btnRedo').onclick = redoEdit;
document.getElementById('btnCopy').onclick = copySelection;
document.getElementById('btnCut').onclick = cutSelection;
document.getElementById('btnPaste').onclick = pasteClipboard;
document.getElementById('menuUndo').onclick = undoEdit;
document.getElementById('menuRedo').onclick = redoEdit;
document.getElementById('menuCopy').onclick = copySelection;
document.getElementById('menuCut').onclick = cutSelection;
document.getElementById('menuPaste').onclick = pasteClipboard;
document.getElementById('btnSaveDesign').onclick = saveDesignToFile;
document.getElementById('btnLoadDesign').onclick = () => document.getElementById('designFileInput').click();
const btnSaveToolbar = document.getElementById('btnSaveToolbar');
if (btnSaveToolbar) btnSaveToolbar.onclick = saveDesignToFile;
const btnLoadToolbar = document.getElementById('btnLoadToolbar');
if (btnLoadToolbar) btnLoadToolbar.onclick = () => document.getElementById('designFileInput').click();
document.getElementById('designFileInput').addEventListener('change', async ev => { try { await loadDesignFromFile(ev.target.files[0]); } catch (err) { window.alert(err?.message || 'Could not load design file.'); } finally { ev.target.value = ''; } });
document.getElementById('btnClearAll').onclick = () => { if (confirmDiscardChanges()) setExample('blank'); };
document.getElementById('btnApplyParams').onclick = applyParamsFromUi;
document.getElementById('btnResetParams').onclick = resetParamsPreset;
document.getElementById('toggleWaveforms').onclick = () => { const panel = document.getElementById('waveWrap'); panel.classList.toggle('hidden'); document.getElementById('toggleWaveforms').textContent = panel.classList.contains('hidden') ? 'Show' : 'Hide'; renderResults(); };
document.getElementById('wfIntervalPs').addEventListener('input', () => { waveformConfig.intervalPs = Math.max(1, Number(document.getElementById('wfIntervalPs').value) || 1000); markDirty(); renderAll(); });
document.getElementById('wfIntervalCount').addEventListener('input', () => { waveformConfig.intervalCount = Math.max(1, Number(document.getElementById('wfIntervalCount').value) || 6); syncWaveformConfigFromLayout(); markDirty(); renderAll(); });
document.getElementById('wfAddInterval').onclick = () => { waveformConfig.intervalCount += 1; waveformConfig.inputs.forEach((s,i) => s.levels.push(i % 2)); waveformConfig.outputs.forEach((s,i) => s.levels.push((i+1) % 2)); markDirty(); renderAll(); };
document.getElementById('wfTrimInterval').onclick = () => { waveformConfig.intervalCount = Math.max(1, waveformConfig.intervalCount - 1); waveformConfig.inputs.forEach(s => s.levels = ensureLevelLength(s.levels, waveformConfig.intervalCount)); waveformConfig.outputs.forEach(s => s.levels = ensureLevelLength(s.levels, waveformConfig.intervalCount)); markDirty(); renderAll(); };
document.getElementById('wfAddInput').onclick = () => { waveformConfig.inputs.push({ name:`IN${waveformConfig.inputs.length+1}`, levels: makeDefaultLevels(waveformConfig.inputs.length, waveformConfig.intervalCount) }); markDirty(); renderAll(); };
document.getElementById('wfAddOutput').onclick = () => { waveformConfig.outputs.push({ name:`OUT${waveformConfig.outputs.length+1}`, levels: makeDefaultLevels(waveformConfig.outputs.length+1, waveformConfig.intervalCount) }); markDirty(); renderAll(); };
document.querySelectorAll('.mainTab').forEach(btn => btn.addEventListener('click', () => { activeTab = btn.dataset.tab; renderMainTab(); renderAll(); }));

const canvas = document.getElementById('layout');
canvas.addEventListener('mousedown', onCanvasPointerDown);
canvas.addEventListener('mousemove', onCanvasPointerMove);
canvas.addEventListener('mouseup', onCanvasPointerUp);
canvas.addEventListener('mouseleave', onCanvasPointerUp);
canvas.addEventListener('wheel', onCanvasWheel, { passive:false });
canvas.addEventListener('contextmenu', ev => ev.preventDefault());
document.addEventListener('mouseup', () => { onCanvasPointerUp(); waveformDrawState = null; });
document.addEventListener('keydown', handleKey);
window.addEventListener('resize', () => { if (resizeCanvasToDisplay()) renderAll(); });
window.addEventListener('beforeunload', ev => { if (!dirty) return; ev.preventDefault(); ev.returnValue = ''; });
const dropOverlay = document.getElementById('dropOverlay');
let dragDepth = 0;
function dragHasFiles(ev) { return Array.from(ev.dataTransfer?.types || []).includes('Files'); }
for (const type of ['dragenter','dragover']) document.addEventListener(type, ev => { if (!dragHasFiles(ev)) return; ev.preventDefault(); dragDepth += type === 'dragenter' ? 1 : 0; dropOverlay.classList.add('show'); });
document.addEventListener('dragleave', ev => { if (!dragHasFiles(ev)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dropOverlay.classList.remove('show'); });
document.addEventListener('drop', async ev => { if (!dragHasFiles(ev)) return; ev.preventDefault(); dragDepth = 0; dropOverlay.classList.remove('show'); try { await loadDesignFromFile(ev.dataTransfer.files[0]); } catch (err) { window.alert(err?.message || 'Could not load dropped design file.'); } });

buildToolButtons();
loadParamsToUi();
updateDirtyUi();
setExample('inverter');
initThemeMode();
renderMainTab();
resizeCanvasToDisplay();
focusCanvas();
