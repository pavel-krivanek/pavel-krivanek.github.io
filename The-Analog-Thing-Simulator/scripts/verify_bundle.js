#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
function rel(...parts) { return path.join(root, ...parts); }
function read(file) { return fs.readFileSync(rel(file), 'utf8'); }
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'generated-bundles'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
function countJsLines() {
  return walk(rel('src')).filter((file) => file.endsWith('.js')).reduce((sum, file) => sum + fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line.trim()).length, 0);
}
function listMarkdownWithOldVersionRefs() {
  const allowedCurrent = /v104\b/g;
  const files = [rel('README.md'), rel('src/README.md'), ...walk(rel('docs')).filter((file) => file.endsWith('.md'))];
  const hits = [];
  for (const file of files) {
    const relative = path.relative(root, file);
    const text = fs.readFileSync(file, 'utf8').replace(allowedCurrent, '');
    const match = text.match(/\bv0?\d{2,3}\b|older version|obsolete document|prototype milestone|change log/i);
    if (match) hits.push(`${relative}: ${match[0]}`);
  }
  return hits;
}

const checks = [];
function check(name, pass, details = '') { checks.push({ name, pass: Boolean(pass), details }); }
function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: options.timeout || 120000, maxBuffer: 20 * 1024 * 1024 });
}

const required = [
  'VERSION', 'README.md', 'public/index.html', 'public/THAT_panel.svg',
  'src/browser/cableInteractionApp.js', 'src/browser/patchEditorApp.js', 'src/browser/deviceWorkbenchApp.js', 'src/browser/styles.css',
  'src/core/physicalSockets.js', 'src/core/adoptedPatchPanelConnectors.js', 'src/core/designAccessories.js',
  'docs/browser_user_guide.md', 'docs/browser_smoke_checklist.md', 'docs/custom_design_architecture.md', 'docs/example_walkthroughs.md', 'docs/research_basis.md', 'docs/troubleshooting.md',
  'tests/run_tests.js',
];
for (const file of required) check(`required file exists: ${file}`, fs.existsSync(rel(file)));
check('version is v104', /^v104\s*$/.test(read('VERSION')));

const removedDocs = [
  'docs/development_plan.md',
  'docs/custom_design_editor_plan.md',
  'docs/that_first_steps_development_plan.md',
  'docs/damped_oscillation_prototype.md',
  'docs/source_index.md',
];
for (const file of removedDocs) check(`obsolete document removed: ${file}`, !fs.existsSync(rel(file)));
const generatedFiles = walk(rel('generated')).map((file) => path.relative(rel('generated'), file)).sort();
check('generated directory has no stale trace or summary artifacts before verification', generatedFiles.length === 0 || generatedFiles.every((file) => file === 'test_stats.json'), generatedFiles.join(', '));
check('generated-bundles directory is absent', !fs.existsSync(rel('generated-bundles')));

const oldRefHits = listMarkdownWithOldVersionRefs();
check('README and docs do not carry older-version references', oldRefHits.length === 0, oldRefHits.slice(0, 10).join('; '));
const readme = read('README.md');
check('README documents clean final handoff and no-npm policy', /cleaned, final handoff bundle/i.test(readme) && /No npm install/i.test(readme) && /Historical planning logs/i.test(readme));
check('README documents current verification flow', /node tests\/run_tests\.js/.test(readme) && /node scripts\/verify_bundle\.js/.test(readme));

const packagingSource = read('src/browser/packagingApp.js');
check('packaging app references only current docs', !/damped_oscillation_prototype|development_plan|source_index/.test(packagingSource) && /docs\/example_walkthroughs\.md/.test(packagingSource) && /docs\/custom_design_architecture\.md/.test(packagingSource));

const cableSource = read('src/browser/cableInteractionApp.js');
check('endpoint reconnect fallback helper is present', /function connectorForCableEndpoint/.test(cableSource) && /connectorCanReplaceCableSide/.test(cableSource));
check('endpoint handles do not render OUT\/IN text labels', !/label\.textContent\s*=\s*endpointLabel/.test(cableSource) && !/Drag the <b>OUT<\/b> or <b>IN<\/b>/.test(cableSource));
const css = read('src/browser/styles.css');
check('loaded patch endpoint rings are styled as translucent white', /is-patch-endpoint/.test(css) && /rgba\(255, 255, 255, 0\.42\)/.test(css));
check('endpoint-handle-label is hidden', /endpoint-handle-label[\s\S]*display:\s*none/.test(css));

for (const file of walk(rel('src')).filter((f) => f.endsWith('.js'))) {
  const result = run(process.execPath, ['-c', file]);
  check(`syntax ok: ${path.relative(root, file)}`, result.status === 0, result.stderr.trim());
}

const testRanges = ['55:63', '160:166', '194:205', '213:215'];
let testPassed = 0;
let testExpected = 0;
for (const range of testRanges) {
  const [start, end] = range.split(':').map(Number);
  testExpected += end - start;
  const rerun = spawnSync(process.execPath, ['tests/run_tests.js'], { cwd: root, env: { ...process.env, ANALOG_TEST_RANGE: range }, encoding: 'utf8', timeout: 180000, maxBuffer: 20 * 1024 * 1024 });
  const passCount = (rerun.stdout.match(/^PASS /gm) || []).length;
  testPassed += rerun.status === 0 ? passCount : 0;
  check(`targeted tests pass: ${range}`, rerun.status === 0 && passCount === end - start, (rerun.stdout + rerun.stderr).trim().split('\n').slice(-5).join('\n'));
}

const patchPanelApp = require('../src/browser/patchPanelApp');
const cableInteractionApp = require('../src/browser/cableInteractionApp');
const physicalSockets = require('../src/core/physicalSockets');
const model = patchPanelApp.getDampedOscillationPanelModel();
const galleryDir = rel('patches/gallery');
let visibleWireFailures = [];
for (const name of fs.readdirSync(galleryDir).filter((file) => file.endsWith('.json'))) {
  const patch = JSON.parse(fs.readFileSync(path.join(galleryDir, name), 'utf8'));
  const wires = cableInteractionApp.integratedWiresFromPatch(model, patch);
  wires.forEach((wire, index) => {
    if (!wire.from.connectorId || !wire.to.connectorId) visibleWireFailures.push(`${name}#${index + 1}`);
  });
}
check('all gallery wires resolve to visible panel endpoints', visibleWireFailures.length === 0, visibleWireFailures.slice(0, 10).join(', '));
const demoPatch = JSON.parse(fs.readFileSync(rel('patches/gallery/first-steps-radioactive-decay.patch.json'), 'utf8'));
const replacement = cableInteractionApp.connectorMapForModel(model).map.get('coeff_03');
const moved = cableInteractionApp.replaceIntegratedCableEndpoint(demoPatch, model, 0, 'to', replacement, { style: { id: 'wire_001' } });
check('prebuilt demo endpoint can be moved without stored connector ids', moved.patch.cables[0].from === 'PLUS1.out' && moved.patch.cables[0].to === 'P2.in' && moved.patch.cables[0].fromConnectorId && moved.patch.cables[0].toConnectorId === 'coeff_03');

const stats = {
  bundle: 'analog-thing-simulator-v104',
  generatedAt: new Date().toISOString(),
  counts: {
    checks: checks.length,
    passed: checks.filter((c) => c.pass).length,
    failed: checks.filter((c) => !c.pass).length,
    targetedTests: testExpected,
    targetedTestsPassed: testPassed,
    jsLinesInSrc: countJsLines(),
    physicalSockets: physicalSockets.listPhysicalSockets().length,
    activePhysicalSockets: physicalSockets.summarizePhysicalSocketMap().activeSocketCount,
    adoptedPatchEditorConnectors: require('../src/core/adoptedPatchPanelConnectors').listAdoptedPanelConnectors().length,
  },
  checks,
};
fs.mkdirSync(rel('generated'), { recursive: true });
fs.writeFileSync(rel('generated/test_stats.json'), JSON.stringify(stats, null, 2));
for (const item of checks) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` :: ${item.details}` : ''}`);
console.log(`\nVerification stats: ${stats.counts.passed}/${stats.counts.checks} checks passed.`);
console.log(`Targeted test stats: ${stats.counts.targetedTestsPassed}/${stats.counts.targetedTests} tests passed.`);
console.log(`JavaScript lines in src: ${stats.counts.jsLinesInSrc}`);
console.log(`Physical sockets: ${stats.counts.physicalSockets} total, ${stats.counts.activePhysicalSockets} active.`);
console.log(`Adopted patch editor connectors: ${stats.counts.adoptedPatchEditorConnectors}.`);
if (stats.counts.failed) process.exit(1);
