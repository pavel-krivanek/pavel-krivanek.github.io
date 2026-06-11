#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function usage() {
    console.error("Usage: node tools/pharo14-browser-interactive-smoke.js /path/to/Pharo14.image [run-ms]");
    console.error("Starts Pharo with --interactive under browser-sandbox assumptions and fails on known browser startup regressions.");
}

const rootDir = path.resolve(__dirname, "..");
const imagePath = process.argv[2] || process.env.PHARO14_FULL_IMAGE || path.join(rootDir, "pharo14-full.image");
const runMs = Number(process.argv[3] || process.env.PHARO14_BROWSER_INTERACTIVE_MS || 15000);
if (!fs.existsSync(imagePath)) {
    usage();
    console.error("Image not found: " + imagePath);
    process.exit(2);
}

const imageArg = path.relative(rootDir, path.resolve(imagePath));
const env = Object.assign({}, process.env, { SQUEAKJS_BROWSER_SANDBOX: "1" });
[
    "HOME",
    "XDG_CONFIG_HOME",
    "XDG_CACHE_HOME",
    "XDG_DATA_HOME",
    "XDG_RUNTIME_DIR",
    "TMPDIR",
    "TEMP",
    "TMP",
].forEach(key => { delete env[key]; });

const child = spawn(process.execPath, ["squeak_node.js", imageArg, "--interactive"], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
});
let stdout = "";
let stderr = "";
let killedForSuccess = false;
const timer = setTimeout(() => {
    killedForSuccess = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 1000).unref();
}, runMs);
child.stdout.on("data", data => stdout += data.toString());
child.stderr.on("data", data => stderr += data.toString());
child.on("close", (code, signal) => {
    clearTimeout(timer);
    const output = stdout + stderr;
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    const failures = [];
    if (!/squeak: ready/.test(output)) failures.push("image did not reach squeak: ready");
    if (!/Loaded module: SurfacePlugin/.test(output)) failures.push("SurfacePlugin was not loaded during interactive Morphic startup");
    if (/primitive #allocate: in NullFFIBackend failed|Null FFI Backend|did not understand #primLoadSymbol:module:/.test(output)) failures.push("stale NullFFIBackend still handled allocation or symbol lookup");
    if (/primitive #allocate: in NullFFIBackend failed/.test(output)) failures.push("NullFFIBackend allocate primitive failed");
    if (/Cannot locate any of.*libSDL2/.test(output)) failures.push("SDL2 library discovery failed");
    if (/FFICalloutMethodBuilder had the subclass responsibility/.test(output)) failures.push("UFFI used abstract FFICalloutMethodBuilder");
    if (/SubclassResponsibility: FFICalloutMethodBuilder/.test(output)) failures.push("UFFI used abstract FFICalloutMethodBuilder");
    if (/primitive #primCreateManualSurfaceWidth:height:rowPitch:depth:isMSB:/.test(output)) failures.push("SurfacePlugin primitiveCreateManualSurface failed");
    if (/Failure during Squeak run/.test(output)) failures.push("SqueakJS threw a host-side failure");
    if (/Error: Oh No!/.test(output)) failures.push("interpreter aborted with Oh No");
    if (failures.length) {
        console.error("browser-interactive-smoke failed:");
        failures.forEach(failure => console.error("- " + failure));
        process.exit(code && code !== 0 ? code : 1);
    }
    if (!killedForSuccess && code !== 0) {
        console.error("browser-interactive-smoke failed: process exited early with code " + code + (signal ? " signal " + signal : ""));
        process.exit(code || 1);
    }
    console.log("browser-interactive-smoke: ok");
    process.exit(0);
});
