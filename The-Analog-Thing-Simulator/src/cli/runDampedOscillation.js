#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { createDampedOscillationMachine } = require('../examples/dampedOscillation');
const { runMode, MODES } = require('../core/modes');

function parseArgs(argv) {
  const options = {
    mode: MODES.OP,
    dt: 0.01,
    duration: 40,
    sampleEvery: 10,
    clip: false,
    opTime: 12,
    cycles: 3,
    k: 0.5,
    d: 0.5,
    invMass: 0.5,
    out: path.join(__dirname, '..', '..', 'generated', 'damped_oscillation_trace.json'),
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    function takeNumber(name) {
      if (next === undefined) throw new Error(`${arg} requires a value`);
      const parsed = Number(next);
      if (!Number.isFinite(parsed)) throw new Error(`${arg} requires a finite number`);
      options[name] = parsed;
      i += 1;
    }
    switch (arg) {
      case '--mode':
        if (!Object.values(MODES).includes(next) || ![MODES.IC, MODES.OP, MODES.HALT, MODES.REP, MODES.REPF].includes(next)) {
          throw new Error('--mode must be IC, OP, HALT, REP, or REPF');
        }
        options.mode = next;
        i += 1;
        break;
      case '--dt':
        takeNumber('dt');
        break;
      case '--duration':
        takeNumber('duration');
        break;
      case '--sample-every':
        takeNumber('sampleEvery');
        break;
      case '--op-time':
        takeNumber('opTime');
        break;
      case '--cycles':
        takeNumber('cycles');
        break;
      case '--k':
        takeNumber('k');
        break;
      case '--d':
        takeNumber('d');
        break;
      case '--inv-mass':
        takeNumber('invMass');
        break;
      case '--clip':
        options.clip = true;
        break;
      case '--out':
        if (next === undefined) throw new Error('--out requires a file path');
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
  const machine = createDampedOscillationMachine({ k: options.k, d: options.d, invMass: options.invMass });
  const result = runMode(machine, options);
  const payload = {
    name: machine.name,
    parameters: { k: options.k, d: options.d, invMass: options.invMass },
    result,
  };
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, JSON.stringify(payload, null, 2));
  const overloaded = result.trace.some((point) => point.overload);
  console.log(`wrote ${result.trace.length} samples to ${options.out}`);
  console.log(`mode=${result.mode} overload=${overloaded}`);
  console.log(`finalState=${JSON.stringify(result.finalState)}`);
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
