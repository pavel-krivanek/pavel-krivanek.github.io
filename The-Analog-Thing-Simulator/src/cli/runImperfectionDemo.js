#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { MODES } = require('../core/modes');
const { runImperfectionDemo } = require('../examples/imperfectionDemo');

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
    mode: MODES.OP,
    duration: 8,
    opTime: 8,
    cycles: 1,
    dt: 0.01,
    sampleEvery: 50,
    clip: false,
    imperfections: {},
    out: 'generated/imperfection_demo_trace.json',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--mode':
        if (!next || ![MODES.IC, MODES.OP, MODES.HALT, MODES.REP, MODES.REPF].includes(next)) throw new Error('--mode must be IC, OP, HALT, REP, or REPF');
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
      case '--seed':
        options.imperfections.seed = integerArg(next, '--seed');
        i += 1;
        break;
      case '--tolerance':
        options.imperfections.toleranceStdDev = numberArg(next, '--tolerance');
        i += 1;
        break;
      case '--gain':
        options.imperfections.outputGainStdDev = numberArg(next, '--gain');
        i += 1;
        break;
      case '--noise':
        options.imperfections.noiseStdDev = numberArg(next, '--noise');
        i += 1;
        break;
      case '--offset':
        options.imperfections.outputOffset = numberArg(next, '--offset');
        i += 1;
        break;
      case '--drift':
        options.imperfections.driftPerSecond = numberArg(next, '--drift');
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
  const payload = runImperfectionDemo(options);
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote imperfection comparison to ${options.out}`);
  console.log(`ideal samples=${payload.ideal.trace.length} imperfect samples=${payload.imperfect.trace.length}`);
  console.log(`deltaAtFinalSample=${JSON.stringify(payload.deltaAtFinalSample)}`);
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
