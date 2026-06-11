"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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
        const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs || 5000);
        child.stdout.on("data", data => stdout += data.toString());
        child.stderr.on("data", data => stderr += data.toString());
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, stdout, stderr, timedOut: signal === "SIGKILL" });
        });
    });
}

exports.run = async function(t, context) {
    await t.test("Pharo 14 full image creates a minimal OSWindow through SDL2 FFI emulation", async t => {
        if (!process.env.PHARO14_OSWINDOW_SMOKE) {
            return t.skip("Pharo 14 OSWindow SDL2 probe", "set PHARO14_OSWINDOW_SMOKE=1 with PHARO14_FULL_IMAGE or pharo14-full.image");
        }
        const imagePath = process.env.PHARO14_FULL_IMAGE || path.join(context.rootDir, "pharo14-full.image");
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 OSWindow SDL2 probe", "set PHARO14_FULL_IMAGE or place pharo14-full.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const expression = "| attrs w | attrs := OSWindowAttributes new title: 'SqueakJS'; extent: 320@200; yourself. w := OSWindow createWithAttributes: attrs. { w isValid . w backendWindow windowId . w backendWindow extent }";
        const r = await runNode(["squeak_node.js", imageArg, "eval", expression], {
            cwd: context.rootDir,
            timeoutMs: 20000,
        });
        const output = r.stdout + r.stderr;
        t.equal(r.code, 0, "OSWindow smoke exits normally");
        t.match(output, /\{true\. 1\. \(320@200\)\}/, "OSWindow creation reaches the SDL2 emulation and reports a valid 320x200 window");
        t.ok(!/SymbolNotFoundError: Could not find symbol named: #SDL_SetHint/.test(output), "SDL_SetHint is now exported by the SDL2 emulation");
        t.ok(!/primitive 643 not implemented yet/.test(output), "float32 ExternalAddress reads used by DPI probing are implemented");
        t.ok(!/PrimitiveFailed: primitive #on:float32At:/.test(output), "TFFI float32 pointer reads succeed after SDL_GetDisplayDPI");
        t.probe("Pharo 14 OSWindow SDL2", "created a minimal OSWindow through emulated SDL_Init, SDL_SetHint, SDL_CreateWindow, SDL_GetDisplayDPI, SDL_GetWindowID, and SDL_GetWindowSize");
    });


    await t.test("Pharo 14 full image renders an OSWindow Form renderer through SDL2 texture calls", async t => {
        if (!process.env.PHARO14_OSWINDOW_SMOKE) {
            return t.skip("Pharo 14 OSWindow SDL2 Form renderer probe", "set PHARO14_OSWINDOW_SMOKE=1 with PHARO14_FULL_IMAGE or pharo14-full.image");
        }
        const imagePath = process.env.PHARO14_FULL_IMAGE || path.join(context.rootDir, "pharo14-full.image");
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 OSWindow SDL2 Form renderer probe", "set PHARO14_FULL_IMAGE or place pharo14-full.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const expression = "| attrs w f r | attrs := OSWindowAttributes new title: 'SqueakJS'; extent: 64@48; yourself. w := OSWindow createWithAttributes: attrs. f := Form extent: 64@48 depth: 32. f fillColor: Color red. r := w newFormRenderer: f. r updateAll. r present. { r class name . r form extent }";
        const r = await runNode(["squeak_node.js", imageArg, "eval", expression], {
            cwd: context.rootDir,
            timeoutMs: 30000,
        });
        const output = r.stdout + r.stderr;
        t.equal(r.code, 0, "OSWindow Form renderer smoke exits normally");
        t.match(output, /\{#OSSDL2FormRenderer\. \(64@48\)\}/, "OSWindow Form renderer reaches SDL2 texture update/copy/present path");
        t.ok(!/SymbolNotFoundError: Could not find symbol named: #SDL_UpdateTexture/.test(output), "SDL_UpdateTexture is exported by the SDL2 emulation");
        t.ok(!/SymbolNotFoundError: Could not find symbol named: #SDL_RenderCopy/.test(output), "SDL_RenderCopy is exported by the SDL2 emulation");
        t.ok(!/SymbolNotFoundError: Could not find symbol named: #SDL_RenderPresent/.test(output), "SDL_RenderPresent is exported by the SDL2 emulation");
        t.probe("Pharo 14 OSWindow SDL2 Form renderer", "created an OSSDL2FormRenderer and exercised SDL_CreateRenderer, SDL_CreateTexture, SDL_UpdateTexture, SDL_RenderCopy, and SDL_RenderPresent");
    });
};
