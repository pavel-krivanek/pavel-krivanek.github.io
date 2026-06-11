#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function usage() {
    console.error("Usage: node tools/pharo14-browser-sandbox-smoke.js /path/to/Pharo14.image [timeout-ms]");
    console.error("Runs a browser-oriented Pharo 14 startup probe under Node with host HOME/XDG variables removed.");
}

const rootDir = path.resolve(__dirname, "..");
const imagePath = process.argv[2] || process.env.PHARO14_FULL_IMAGE || path.join(rootDir, "pharo14-full.image");
const timeoutMs = Number(process.argv[3] || process.env.PHARO14_BROWSER_SANDBOX_TIMEOUT_MS || 25000);
if (!fs.existsSync(imagePath)) {
    usage();
    console.error("Image not found: " + imagePath);
    process.exit(2);
}

const imageArg = path.relative(rootDir, path.resolve(imagePath));
const expression = [
    "{",
    "Smalltalk vm operatingSystemName.",
    "(Smalltalk os environment at: 'HOME' ifAbsent: [ 'missing' ]).",
    "(Smalltalk os environment at: 'XDG_CONFIG_HOME' ifAbsent: [ 'missing' ]).",
    "FileLocator preferences fullName.",
    "UUID new asString size.",
    "FFICalloutAPI calloutAPIClass name.",
    "FFIBackend current class name.",
    "FFIBackend classPool at: #Current put: NullFFIBackend new.",
    "(ExternalAddress fromString: 'abc') isExternalAddress.",
    "(SDL2 setHint: 'SDL_VIDEO_X11_NET_WM_BYPASS_COMPOSITOR' value: '0')",
    "}"
].join(" ");

const env = Object.assign({}, process.env);
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
env.SQUEAKJS_BROWSER_SANDBOX = "1";

const child = spawn(process.execPath, ["squeak_node.js", imageArg, "eval", expression], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
});
let stdout = "";
let stderr = "";
const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
child.stdout.on("data", data => stdout += data.toString());
child.stderr.on("data", data => stderr += data.toString());
child.on("close", (code, signal) => {
    clearTimeout(timer);
    const output = stdout + stderr;
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    const failures = [];
    if (signal === "SIGKILL") failures.push("timed out after " + timeoutMs + " ms");
    if (!/squeak: ready/.test(output)) failures.push("image did not reach squeak: ready");
    if (!/(?:#\(|an Array\()'unix' '\/home\/squeak' '\/home\/squeak\/\.config' '\/home\/squeak\/\.config' 36 #TFCalloutAPI #TFFIBackend a NullFFIBackend true 1\)/.test(output))
        failures.push("did not resolve HOME/XDG_CONFIG_HOME/FileLocator preferences, UUID generation, ThreadedFFI callout API, forced NullFFIBackend ExternalAddress allocation fallback, and SDL2 setHint from browser fallback startup probe");
    if (/Error: Can't find the requested origin/.test(output)) failures.push("FileLocator origin lookup still failed");
    if (/UnixResolver>>preferences/.test(output)) failures.push("UnixResolver preferences stack still appears");
    if (/Cannot generate UUID/.test(output)) failures.push("UUIDPlugin primitive was not available before startup UUID generation");
    if (/FFICalloutMethodBuilder had the subclass responsibility/.test(output)) failures.push("UFFI still used the abstract FFICalloutMethodBuilder");
    if (/SubclassResponsibility: FFICalloutMethodBuilder/.test(output)) failures.push("UFFI still used the abstract FFICalloutMethodBuilder");
    if (/primitive #allocate: in NullFFIBackend failed|Null FFI Backend|did not understand #primLoadSymbol:module:/.test(output)) failures.push("stale NullFFIBackend still handled allocation or symbol lookup");
    if (/primitive #allocate: in NullFFIBackend failed/.test(output)) failures.push("ExternalAddress allocation primitive failed in NullFFIBackend");
    if (/Cannot locate any of.*libSDL2/.test(output)) failures.push("SDL2 library discovery still failed");
    if (/missing primitive: UUIDPlugin\.primitiveMakeUUID/.test(output)) failures.push("UUIDPlugin primitiveMakeUUID is still missing");
    if (/Undeclared variable named/.test(output)) failures.push("probe expression was not parsed correctly");
    if (failures.length) {
        console.error("browser-sandbox-smoke failed:");
        failures.forEach(failure => console.error("- " + failure));
        process.exit(signal === "SIGKILL" ? 124 : (code || 1));
    }
    console.log("browser-sandbox-smoke: ok");
    process.exit(0);
});
