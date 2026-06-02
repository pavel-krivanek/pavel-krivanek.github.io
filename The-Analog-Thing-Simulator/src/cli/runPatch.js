#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { createThatPrototypeInventory, loadPatchJson, runMode, MODES } = require('../index');

function numberArg(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number, got ${value}`);
  return parsed;
}

function integerArg(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer, got ${value}`);
  return parsed;
}

function parseArgs(argv) {
  const options = {
    patch: 'patches/damped_oscillation.patch.json',
    mode: MODES.REPF,
    duration: 40,
    opTime: 8,
    cycles: 3,
    dt: 0.01,
    sampleEvery: 10,
    clip: false,
    out: 'generated/patch_trace.json',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--patch':
        if (!next) throw new Error('--patch requires a file path');
        options.patch = next;
        i += 1;
        break;
      case '--mode':
        if (!next || ![MODES.IC, MODES.OP, MODES.HALT, MODES.REP, MODES.REPF].includes(next)) {
          throw new Error('--mode must be IC, OP, HALT, REP, or REPF');
        }
        options.mode = next;
        i += 1;
        break;
      case '--duration':
        options.duration = numberArg(next, '--duration');
        i += 1;
        break;
      case '--op-time':
        options.opTime = numberArg(next, '--op-time');
        i += 1;
        break;
      case '--cycles':
        options.cycles = integerArg(next, '--cycles');
        i += 1;
        break;
      case '--dt':
        options.dt = numberArg(next, '--dt');
        i += 1;
        break;
      case '--sample-every':
        options.sampleEvery = integerArg(next, '--sample-every');
        i += 1;
        break;
      case '--clip':
        options.clip = true;
        break;
      case '--out':
        if (!next) throw new Error('--out requires a file path');
        options.out = next;
        i += 1;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv);
  const inventory = createThatPrototypeInventory();
  const machine = loadPatchJson(options.patch, { inventory, asMachine: true });
  const result = runMode(machine, options);
  const payload = {
    name: machine.name,
    sourcePatch: options.patch,
    parameters: machine.parameters,
    result,
  };
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`loaded ${options.patch}`);
  console.log(`wrote ${result.trace.length} samples to ${options.out}`);
  console.log(`mode=${result.mode} overload=${result.trace.some((point) => point.overload)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { parseArgs };
