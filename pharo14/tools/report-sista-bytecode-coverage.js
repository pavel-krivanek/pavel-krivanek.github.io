#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const coverage = require("./sista-bytecode-coverage-lib");

function usage() {
    console.error("usage: node tools/report-sista-bytecode-coverage.js [--fixture FILE] [--format json|markdown] [--out FILE]");
    process.exit(2);
}

let fixtureFile = path.join(__dirname, "..", "tests", "pharo", "fixtures", "sista-native-fixtures.json");
let format = "markdown";
let outFile = null;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--fixture") fixtureFile = args[++i] || usage();
    else if (arg === "--format") format = args[++i] || usage();
    else if (arg === "--out") outFile = args[++i] || usage();
    else usage();
}
if (!["json", "markdown"].includes(format)) usage();
const payload = coverage.loadNativeFixturePayload(path.resolve(fixtureFile));
const report = coverage.buildCoverageReport(payload);
const text = format === "json" ? JSON.stringify(report, null, 2) + "\n" : coverage.formatMarkdown(report);
if (outFile) fs.writeFileSync(path.resolve(outFile), text);
else process.stdout.write(text);
