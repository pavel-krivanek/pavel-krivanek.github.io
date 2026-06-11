"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const {
    makePrimitive,
    stringFromObject,
} = require("./support/fake-primitives");

function makeString(prim, value) {
    return prim.makeStString(value);
}

function runNamedPrimitive(prim, moduleName, primitiveName, stack, argCount) {
    prim.vm.stack = stack.slice();
    prim.vm.sp = prim.vm.stack.length - 1;
    prim.success = true;
    const ok = prim.namedPrimitive(moduleName, primitiveName, argCount);
    return { ok, result: prim.vm.lastPushed };
}

function runNode(args, options) {
    options = options || {};
    return new Promise(resolve => {
        const child = spawn(process.execPath, args, {
            cwd: options.cwd,
            env: Object.assign({}, process.env, options.env || {}),
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs || 25000);
        child.stdout.on("data", data => stdout += data.toString());
        child.stderr.on("data", data => stderr += data.toString());
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, stdout, stderr, timedOut: signal === "SIGKILL" });
        });
    });
}

exports.run = async function(t, context) {
    await t.test("browser primitiveGetenv works when Node process is absent", async t => {
        const oldProcess = global.process;
        try {
            global.process = undefined;
            const prim = makePrimitive();
            let r = runNamedPrimitive(prim, "", "primitiveGetenv", [null, makeString(prim, "HOME")], 1);
            t.ok(r.ok, "primitiveGetenv succeeds for HOME without process.env");
            t.equal(stringFromObject(r.result), "/home/squeak", "browser fallback HOME is returned");

            r = runNamedPrimitive(prim, "", "primitiveGetenv", [null, makeString(prim, "XDG_CONFIG_HOME")], 1);
            t.ok(r.ok, "primitiveGetenv succeeds for XDG_CONFIG_HOME without process.env");
            t.equal(stringFromObject(r.result), "/home/squeak/.config", "browser fallback XDG_CONFIG_HOME is returned");
        } finally {
            global.process = oldProcess;
        }
    });

    await t.test("browser source imports the plugins and environment needed before Pharo startup", async t => {
        const browser = fs.readFileSync(path.join(context.rootDir, "squeak.js"), "utf8");
        const globals = fs.readFileSync(path.join(context.rootDir, "globals.js"), "utf8");
        t.match(browser, /import "\.\/globals\.js";/, "browser loader imports globals before platform/environment setup");
        t.match(browser, /import "\.\/plugins\/FileAttributesPlugin\.js";/, "browser loader imports FileAttributesPlugin");
        t.match(browser, /import "\.\/plugins\/UUIDPlugin\.js";/, "browser loader imports UUIDPlugin before Pharo startup UUID generation");
        t.match(browser, /import "\.\/plugins\/SurfacePlugin\.js";/, "browser loader imports SurfacePlugin before Morphic SDL2 startup");
        t.match(globals, /Squeak\.getEnv = function\(key\)/, "shared environment lookup is installed by globals.js");
        t.match(globals, /Squeak\.virtualUnixLibraryFiles/, "browser startup knows about virtual Unix shared-library placeholders");
        t.match(browser, /"\/home\/squeak\/\.config"/, "browser startup creates the preferences directory advertised by XDG_CONFIG_HOME");
        t.match(browser, /Squeak\.installVirtualUnixLibraries/, "browser startup installs virtual Unix shared-library placeholders before Pharo SDL2 startup");
    });

    await t.test("browser module graph smoke covers plugin imports and /SqueakJS root alias", async t => {
        const r = await runNode(["tools/browser-module-smoke.js"], {
            cwd: context.rootDir,
            timeoutMs: 15000,
        });
        const output = r.stdout + r.stderr;
        t.equal(r.code, 0, "browser module smoke exits with success");
        t.ok(!r.timedOut, "browser module smoke does not time out");
        t.match(output, /browser-module-smoke: ok/, "browser module graph completed its own checks");
        t.ok(!/AssertionError/.test(output), "browser module smoke assertions did not fail");
        t.ok(!/primitive #fileDescriptorType:/.test(output), "browser stdio descriptor primitive does not fail in the module smoke");
    });

    await t.test("run page preserves hash on quit when debugging is enabled", async t => {
        const r = await runNode(["tools/browser-run-index-smoke.js"], {
            cwd: context.rootDir,
            timeoutMs: 15000,
        });
        const output = r.stdout + r.stderr;
        t.equal(r.code, 0, "run/index smoke exits with success");
        t.ok(!r.timedOut, "run/index smoke does not time out");
        t.match(output, /browser-run-index-smoke: ok/, "run/index quit behavior completed its own checks");
        t.ok(!/AssertionError/.test(output), "run/index smoke assertions did not fail");
    });

    await t.test("full Pharo image resolves Unix preferences with host HOME and XDG variables stripped", async t => {
        const imagePath = process.env.PHARO14_FULL_IMAGE || path.join(context.rootDir, "pharo14-full.image");
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 browser sandbox smoke", "set PHARO14_FULL_IMAGE or place pharo14-full.image in the repo root");
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
        const r = await runNode(["tools/pharo14-browser-sandbox-smoke.js", imagePath], {
            cwd: context.rootDir,
            env,
            timeoutMs: 30000,
        });
        const output = r.stdout + r.stderr;
        t.equal(r.code, 0, "browser sandbox smoke exits with success");
        t.ok(!r.timedOut, "browser sandbox smoke does not time out");
        t.match(output, /browser-sandbox-smoke: ok/, "sandbox smoke completed its own checks");
        t.ok(!/Error: Can't find the requested origin/.test(output), "UnixResolver origin lookup failure is absent");
        t.ok(!/UnixResolver>>preferences/.test(output), "UnixResolver preferences failure stack is absent");
        t.match(output, /(?:#\(|an Array\()'unix' '\/home\/squeak' '\/home\/squeak\/\.config' '\/home\/squeak\/\.config' 36 #TFCalloutAPI #TFFIBackend a NullFFIBackend true 1\)/,
            "Pharo resolves HOME, XDG_CONFIG_HOME, FileLocator preferences, UUID generation, ThreadedFFI callout API, forced stale NullFFIBackend allocation fallback, and SDL2 setHint through the startup probe");
        t.ok(!/Cannot generate UUID/.test(output), "UUID generation version fallback failure is absent");
        t.ok(!/FFICalloutMethodBuilder had the subclass responsibility/.test(output), "UFFI does not use the abstract FFICalloutMethodBuilder");
        t.ok(!/SubclassResponsibility: FFICalloutMethodBuilder/.test(output), "ThreadedFFI builder selection avoids subclassResponsibility failures");
        t.ok(!/primitive #allocate: in NullFFIBackend failed|Null FFI Backend|did not understand #primLoadSymbol:module:/.test(output), "stale NullFFIBackend allocation and symbol lookup failures are absent");
    });

    await t.test("interactive Pharo browser sandbox startup reaches Morphic without current browser FFI failures", async t => {
        const imagePath = process.env.PHARO14_FULL_IMAGE || path.join(context.rootDir, "pharo14-full.image");
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 browser interactive smoke", "set PHARO14_FULL_IMAGE or place pharo14-full.image in the repo root");
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
        const r = await runNode(["tools/pharo14-browser-interactive-smoke.js", imagePath], {
            cwd: context.rootDir,
            env,
            timeoutMs: 25000,
        });
        const output = r.stdout + r.stderr;
        t.equal(r.code, 0, "interactive browser smoke exits with success");
        t.ok(!r.timedOut, "interactive browser smoke wrapper does not time out");
        t.match(output, /browser-interactive-smoke: ok/, "interactive smoke completed its own checks");
        t.ok(!/primitive #allocate: in NullFFIBackend failed|Null FFI Backend|did not understand #primLoadSymbol:module:/.test(output), "interactive startup has no stale NullFFIBackend allocation or symbol lookup failure");
        t.ok(!/primitive #primCreateManualSurfaceWidth:height:rowPitch:depth:isMSB:/.test(output), "interactive startup has SurfacePlugin manual-surface support");
    });
};
