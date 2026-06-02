#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { MODES, listSerializedGalleryExamples, runSerializedGalleryExample } = require('../index');

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
    example: 'quickstart-damped-oscillation',
    mode: undefined,
    duration: undefined,
    opTime: undefined,
    cycles: undefined,
    dt: undefined,
    sampleEvery: undefined,
    clip: false,
    list: false,
    out: 'generated/gallery_example_trace.json',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--list':
        options.list = true;
        break;
      case '--example':
      case '--id':
        if (!next) throw new Error(`${arg} requires an example id`);
        options.example = next;
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
  if (options.list) {
    const examples = listSerializedGalleryExamples();
    console.log(JSON.stringify(examples, null, 2));
    return;
  }
  const runOptions = {};
  for (const name of ['duration', 'opTime', 'cycles', 'dt', 'sampleEvery', 'clip']) {
    if (options[name] !== undefined) runOptions[name] = options[name];
  }
  const payload = runSerializedGalleryExample(options.example, { mode: options.mode, runOptions });
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, `${JSON.stringify(payload, null, 2)}\n`);
  const overloaded = payload.result.trace.some((point) => point.overload);
  console.log(`ran gallery example ${payload.example.id}`);
  console.log(`wrote ${payload.result.trace.length} samples to ${options.out}`);
  console.log(`mode=${payload.result.mode} overload=${overloaded}`);
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
