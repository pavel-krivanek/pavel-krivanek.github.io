#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { runTwoBoardMinionDemo } = require('../examples/multiBoardDemo');

function parseArgs(argv) {
  const options = { run: {} };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--out') { options.out = next; i += 1; }
    else if (arg === '--mode') { options.run.mode = next; i += 1; }
    else if (arg === '--duration') { options.run.duration = Number(next); i += 1; }
    else if (arg === '--dt') { options.run.dt = Number(next); i += 1; }
    else if (arg === '--sample-every') { options.run.sampleEvery = Number(next); i += 1; }
    else if (arg === '--help') { options.help = true; }
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log('Usage: node src/cli/runMultiBoardDemo.js [--out FILE] [--mode OP|IC|HALT|REP|REPF] [--duration N] [--dt N] [--sample-every N]');
}

function main() {
  const options = parseArgs(process.argv);
  if (options.help) { printHelp(); return; }
  const payload = runTwoBoardMinionDemo(options);
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  if (options.out) fs.writeFileSync(options.out, json);
  else process.stdout.write(json);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

module.exports = { parseArgs };
