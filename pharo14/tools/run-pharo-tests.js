#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

class TestFailure extends Error {}
class TestSkip extends Error {
    constructor(reason) {
        super(reason || "skipped");
        this.reason = reason || "skipped";
    }
}

class TestContext {
    constructor(stats, prefix) {
        this.stats = stats;
        this.prefix = prefix || "";
    }
    _name(name) { return this.prefix ? this.prefix + " / " + name : name; }
    ok(value, message) {
        this.stats.assertions++;
        if (!value) throw new TestFailure(message || "expected truthy value");
    }
    equal(actual, expected, message) {
        this.stats.assertions++;
        if (actual !== expected) {
            throw new TestFailure((message || "values differ") + `\n  actual:   ${String(actual)}\n  expected: ${String(expected)}`);
        }
    }
    match(value, regexp, message) {
        this.stats.assertions++;
        if (!regexp.test(String(value))) {
            throw new TestFailure((message || "value did not match") + `\n  value: ${String(value)}\n  regexp: ${regexp}`);
        }
    }
    async test(name, fn) {
        const fullName = this._name(name);
        this.stats.tests++;
        try {
            await fn(new TestContext(this.stats, fullName));
            this.stats.passed++;
            console.log(`ok ${this.stats.tests} - ${fullName}`);
        } catch (error) {
            if (error instanceof TestSkip) {
                this.stats.skipped++;
                console.log(`ok ${this.stats.tests} - ${fullName} # SKIP ${error.reason}`);
                return;
            }
            this.stats.failed++;
            console.log(`not ok ${this.stats.tests} - ${fullName}`);
            console.log(String(error && error.stack || error).split("\n").map(line => "  " + line).join("\n"));
        }
    }
    skip(_name, reason) {
        throw new TestSkip(reason || _name || "skipped");
    }
    probe(name, details) {
        this.stats.probes++;
        console.log(`# probe - ${this._name(name)}: ${details}`);
    }
}

async function main() {
    const rootDir = path.resolve(__dirname, "..");
    const testDir = path.join(rootDir, "tests", "pharo");
    const requested = process.argv.slice(2);
    const files = (requested.length ? requested : fs.readdirSync(testDir)
        .filter(name => name.endsWith(".test.js"))
        .sort()
        .map(name => path.join(testDir, name)))
        .map(file => path.resolve(file));
    const stats = { tests: 0, passed: 0, failed: 0, skipped: 0, assertions: 0, probes: 0 };
    const t = new TestContext(stats, "");
    for (const file of files) {
        console.log(`# ${path.relative(rootDir, file)}`);
        const mod = require(file);
        await mod.run(t, { rootDir });
    }
    console.log(`# tests ${stats.tests}`);
    console.log(`# passed ${stats.passed}`);
    console.log(`# failed ${stats.failed}`);
    console.log(`# skipped ${stats.skipped}`);
    console.log(`# assertions ${stats.assertions}`);
    console.log(`# probes ${stats.probes}`);
    if (stats.failed) process.exitCode = 1;
}

main().catch(error => {
    console.error(error && error.stack || error);
    process.exit(1);
});
