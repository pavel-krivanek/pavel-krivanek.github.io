#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const rootDir = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(rootDir, "run/index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert.ok(scripts.length >= 1, "run/index.html contains an inline script");

function makeContext() {
    let captured = null;
    const context = {
        console: {
            log: function() {},
            warn: function() {},
            error: function() {},
        },
        setTimeout: function(fn) { fn(); return 1; },
        location: {
            hash: "#unix&image=pharo.image&traceFFI=true",
            search: "?debug=1",
            href: "http://localhost:8000/run/#unix&image=pharo.image&traceFFI=true",
        },
        history: { pushState: function() {} },
        window: {},
        document: {
            getElementsByTagName: function() { return []; },
            body: {},
        },
        sqText: { style: {} },
        sqCanvas: { style: {} },
        sqSpinner: { style: {} },
        drop: { style: {} },
        files: {},
        filestats: {},
        images: {},
        fileInput: {},
        SqueakJS: {
            appName: "Pharo14",
            runSqueak: function(imageName, canvas, options) {
                captured = { imageName, canvas, options };
                return {};
            },
        },
        Squeak: {
            splitFilePath: function(path) { return { fullname: path, basename: path.replace(/^.*\//, "") }; },
            fileGet: function() {},
            dirList: function() { return {}; },
            fsck: function(cb) { if (cb) cb({ deleted: 0 }); },
            filePut: function(path, buffer, ok) { if (ok) ok(); },
            dirCreate: function() { return true; },
        },
        FileReader: function() {},
        Blob: function() {},
        FileSaver_saveAs: function() {},
        alert: function(message) { throw new Error("alert: " + message); },
    };
    context.window = context;
    vm.createContext(context);
    scripts.forEach(script => vm.runInContext(script, context, { filename: "run/index.html" }));
    context.runSqueak("pharo.image");
    assert.ok(captured && captured.options && typeof captured.options.onQuit === "function", "runSqueak installed onQuit handler");
    context.captured = captured;
    return context;
}

function invokeQuit(context, options) {
    let banner = null;
    const display = { showBanner: function(message) { banner = message; } };
    context.captured.options.onQuit({}, display, Object.assign({}, context.captured.options, options || {}));
    return { banner, hash: context.location.hash, href: context.location.href };
}

let context = makeContext();
let result = invokeQuit(context, { traceFFI: true });
assert.strictEqual(result.hash, "#unix&image=pharo.image&traceFFI=true", "traceFFI preserves hash on quit");
assert.strictEqual(result.href, "http://localhost:8000/run/#unix&image=pharo.image&traceFFI=true", "traceFFI avoids href rewrite on quit");
assert.match(result.banner, /stopped/, "quit banner still appears");

context = makeContext();
result = invokeQuit(context, { keepHashOnQuit: true });
assert.strictEqual(result.hash, "#unix&image=pharo.image&traceFFI=true", "keepHashOnQuit preserves hash on quit");
assert.strictEqual(result.href, "http://localhost:8000/run/#unix&image=pharo.image&traceFFI=true", "keepHashOnQuit avoids href rewrite on quit");

context = makeContext();
result = invokeQuit(context, {});
assert.strictEqual(result.hash, "", "default quit clears hash for original index-page behavior");
assert.strictEqual(result.href, "http://localhost:8000/run/#unix&image=pharo.image&traceFFI=true", "default quit did not need query cleanup for hash-only URL");

context = makeContext();
context.location.href = "http://localhost:8000/run/?debug=1#unix&image=pharo.image";
result = invokeQuit(context, {});
assert.strictEqual(result.hash, "", "default quit clears hash");
assert.strictEqual(result.href, "http://localhost:8000/run/", "default quit removes query string as before");

console.log("browser-run-index-smoke: ok");
