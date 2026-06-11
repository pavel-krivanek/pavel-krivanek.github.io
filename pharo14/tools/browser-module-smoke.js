#!/usr/bin/env node
"use strict";

const path = require("path");
const assert = require("assert");
const rootDir = path.resolve(__dirname, "..");

function load(file) { require(path.join(rootDir, file)); }

global.Squeak = {};
global.self = global;
global.window = global;
global.localStorage = {};
global.indexedDB = undefined;
global.location = { hash: "#unix&root=/pharo14", search: "" };
global.document = {
    baseURI: "http://localhost:8000/run/",
    createElement: function() { return { style: {}, getContext: function() { return null; } }; },
    addEventListener: function() {},
    removeEventListener: function() {},
};
global.alert = function(message) { throw new Error("alert: " + message); };
global.btoa = function(string) { return Buffer.from(string, "ascii").toString("base64"); };
global.atob = function(string) { return Buffer.from(string, "base64").toString("ascii"); };
Object.defineProperty(global, "navigator", {
    value: { userAgent: "SqueakJS browser-module-smoke" },
    configurable: true,
});
Object.defineProperty(global, "crypto", {
    value: {
        getRandomValues: function(bytes) {
            for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + 11) & 255;
            return bytes;
        }
    },
    configurable: true,
});

[
    "globals.js",
    "vm.js",
    "vm.object.js",
    "vm.object.spur.js",
    "vm.image.js",
    "vm.interpreter.js",
    "vm.interpreter.proxy.js",
    "vm.instruction.stream.js",
    "vm.instruction.stream.sista.js",
    "vm.instruction.printer.js",
    "vm.primitives.js",
    "jit.js",
    "vm.audio.browser.js",
    "vm.display.js",
    "vm.display.browser.js",
    "vm.files.browser.js",
    "vm.input.js",
    "vm.input.browser.js",
    "vm.plugins.js",
    "vm.plugins.ffi.js",
    "vm.plugins.javascript.js",
    "vm.plugins.obsolete.js",
    "vm.plugins.drop.browser.js",
    "vm.plugins.file.browser.js",
    "vm.plugins.jpeg2.browser.js",
    "vm.plugins.scratch.browser.js",
    "vm.plugins.sound.browser.js",
    "plugins/FileAttributesPlugin.js",
    "plugins/SurfacePlugin.js",
    "plugins/UUIDPlugin.js",
    "ffi/libc.js",
].forEach(load);

Object.extend(Squeak, {
    forceBrowserFileAttributes: true,
    vmPath: "/",
    platformName: "unix",
    platformSubtype: "x86_64",
    osVersion: "linux-gnu (SqueakJS browser-module-smoke)",
    windowSystem: "HTML",
});

[
    "/home",
    "/home/squeak",
    "/home/squeak/.config",
    "/home/squeak/.cache",
    "/home/squeak/.local",
    "/home/squeak/.local/share",
    "/tmp",
].forEach(function(dir) { assert.strictEqual(Squeak.dirCreate(dir, true, "force"), true, "precreate " + dir); });
assert.strictEqual(Squeak.installVirtualUnixLibraries(), true, "precreate virtual Unix shared-library placeholders");

const {
    makePrimitive,
    stringFromObject,
} = require(path.join(rootDir, "tests/pharo/support/fake-primitives"));


function primitiveAttribute(display, attr) {
    const p = makePrimitive([attr], display);
    const ok = p.primitiveGetAttribute(1);
    return { ok, result: ok ? stringFromObject(p.vm.lastPushed) : null };
}

function runNamedPrimitive(prim, moduleName, primitiveName, stack, argCount) {
    prim.vm.stack = stack.slice();
    prim.vm.sp = prim.vm.stack.length - 1;
    prim.success = true;
    const ok = prim.namedPrimitive(moduleName, primitiveName, argCount);
    return { ok, result: prim.vm.lastPushed };
}

let prim = makePrimitive();
assert.strictEqual(Squeak.dirCreate("/", true, "force"), true, "browser VFS root mkdir is idempotent");
assert.strictEqual(prim.filenameFromSqueak("/SqueakJS"), "/", "fake /SqueakJS root maps to VFS root");

prim.vm.stack = [null, prim.makeStString("/SqueakJS")];
prim.vm.sp = 1;
prim.success = true;
assert.strictEqual(prim.primitiveDirectoryCreate(1), true, "FilePlugin mkdir /SqueakJS succeeds as root alias");

prim = makePrimitive();
let r = runNamedPrimitive(prim, "FileAttributesPlugin", "primitiveFileExists", [null, prim.makeStString("/SqueakJS")], 1);
assert.strictEqual(r.ok, true, "FileAttributesPlugin sees /SqueakJS alias");
assert.ok(r.result && r.result.isTrue, "/SqueakJS alias exists");

prim = makePrimitive();
r = runNamedPrimitive(prim, "FileAttributesPlugin", "primitiveFileAttribute", [null, prim.makeStString("/SqueakJS"), 15], 2);
assert.strictEqual(r.ok, true, "FileAttributesPlugin executable/directory attribute succeeds for /SqueakJS");
assert.ok(r.result && r.result.isTrue, "/SqueakJS alias is a directory");

prim = makePrimitive();
r = runNamedPrimitive(prim, "FileAttributesPlugin", "primitiveFileExists", [null, prim.makeStString("/lib/x86_64-linux-gnu/libSDL2-2.0.so.0")], 1);
assert.strictEqual(r.ok, true, "FileAttributesPlugin can probe the virtual SDL2 shared library");
assert.ok(r.result && r.result.isTrue, "virtual SDL2 shared library exists for Pharo's FFIUnix64LibraryFinder");

prim = makePrimitive();
r = runNamedPrimitive(prim, "FileAttributesPlugin", "primitiveFileAttribute", [null, prim.makeStString("/lib/x86_64-linux-gnu/libSDL2-2.0.so.0"), 2], 2);
assert.strictEqual(r.ok, true, "FileAttributesPlugin can stat the virtual SDL2 shared library");
assert.ok((r.result & 32768) !== 0, "virtual SDL2 shared library is reported as a regular Unix file");

assert.strictEqual(Squeak.fileExists("/lib/x86_64-linux-gnu/libSDL2-2.0.so.0"), true, "FilePlugin-side fileExists also sees the virtual SDL2 shared library");

const savedProcess = global.process;
try {
    global.process = undefined;
    prim = makePrimitive();
    r = runNamedPrimitive(prim, "", "primitiveGetenv", [null, prim.makeStString("HOME")], 1);
    assert.strictEqual(r.ok, true, "browser primitiveGetenv succeeds");
    assert.strictEqual(stringFromObject(r.result), "/home/squeak", "browser HOME fallback");
} finally {
    global.process = savedProcess;
}

prim = makePrimitive();
r = runNamedPrimitive(prim, "FilePlugin", "primitiveFileDescriptorType", [null, 1], 1);
assert.strictEqual(r.ok, true, "browser FilePlugin classifies stdout fd");
assert.strictEqual(r.result, 2, "browser stdout is a pipe-like console stream");

prim = makePrimitive();
r = runNamedPrimitive(prim, "FilePlugin", "primitiveFileDescriptorType", [null, 2], 1);
assert.strictEqual(r.ok, true, "browser FilePlugin classifies stderr fd");
assert.strictEqual(r.result, 2, "browser stderr is a pipe-like console stream");

prim = makePrimitive();
r = runNamedPrimitive(prim, "FilePlugin", "primitiveFileDescriptorType", [null, 0], 1);
assert.strictEqual(r.ok, true, "browser FilePlugin classifies stdin fd without primitive failure");
assert.strictEqual(r.result, -1, "browser stdin is unavailable until async input is modeled");

prim = makePrimitive();
r = runNamedPrimitive(prim, "FilePlugin", "primitiveConnectToFileDescriptor", [null, 1, prim.vm.trueObj], 2);
assert.strictEqual(r.ok, true, "browser FilePlugin connects stdout fd");
assert.strictEqual(r.result.file, "log", "stdout fd maps to console.log handle");
assert.strictEqual(r.result.fileWrite, true, "stdout handle is writable");

prim = makePrimitive();
r = runNamedPrimitive(prim, "FilePlugin", "primitiveConnectToFileDescriptor", [null, 2, prim.vm.trueObj], 2);
assert.strictEqual(r.ok, true, "browser FilePlugin connects stderr fd");
assert.strictEqual(r.result.file, "error", "stderr fd maps to console.error handle");

assert.ok(Squeak.externalModules.FileAttributesPlugin, "FileAttributesPlugin registered in browser graph");
assert.ok(Squeak.externalModules.UUIDPlugin, "UUIDPlugin registered in browser graph");
assert.ok(Squeak.externalModules.SurfacePlugin, "SurfacePlugin registered in browser graph");
assert.ok(Squeak.externalModules.libc && typeof Squeak.externalModules.libc.memcpy === "function", "legacy ffi/libc.js import must not clobber the rich libc emulation");

prim = makePrimitive();
r = runNamedPrimitive(prim, "", "primitiveLoadSymbolFromModule", [null, prim.makeStString("memcpy"), prim.makeStString("libc.so.6")], 2);
assert.strictEqual(r.ok, true, "browser graph resolves libc.so.6 memcpy through primitiveLoadSymbolFromModule");
assert.strictEqual(r.result.jsData && r.result.jsData.moduleName, "libc", "memcpy lookup records the canonical libc module");
assert.strictEqual(r.result.jsData && r.result.jsData.symbolName, "memcpy", "memcpy lookup records the requested symbol");

prim = makePrimitive();
r = runNamedPrimitive(prim, "SurfacePlugin", "primitiveCreateManualSurface", [null, 16, 8, 64, 32, prim.vm.trueObj], 5);
assert.strictEqual(r.ok, true, "SurfacePlugin creates a manual surface for OSSDL2ExternalForm");
assert.strictEqual(typeof r.result, "number", "manual surface id is an integer");
const surfaceID = r.result;
r = runNamedPrimitive(prim, "SurfacePlugin", "primitiveSetManualSurfacePointer", [null, surfaceID, 0x1234], 2);
assert.strictEqual(r.ok, true, "SurfacePlugin sets a manual surface pointer");
prim.ffiAddressDataMap = prim.ffiAddressDataMap || {};
prim.ffiAddressDataMap[0x1234] = new ArrayBuffer(64 * 8);
let manualPitch = 0;
let manualBits = Squeak.externalModules.SurfacePlugin.ioLockSurface(surfaceID, pitch => { manualPitch = pitch; }, 0, 0, 16, 8);
assert.ok(manualBits instanceof Uint32Array, "SurfacePlugin locks manual surfaces as word-addressable storage for BitBlt");
assert.strictEqual(manualPitch, 64, "SurfacePlugin reports the manual surface row pitch in bytes");
manualBits[0] = 0x00FF0000;
assert.strictEqual(new Uint32Array(prim.ffiAddressDataMap[0x1234])[0], 0x00FF0000, "SurfacePlugin word view writes into the mapped external buffer");
assert.strictEqual(Squeak.externalModules.SurfacePlugin.ioUnlockSurface(surfaceID, 0, 0, 16, 8), true, "SurfacePlugin unlocks the manual surface");
r = runNamedPrimitive(prim, "SurfacePlugin", "primitiveDestroyManualSurface", [null, surfaceID], 1);
assert.strictEqual(r.ok, true, "SurfacePlugin destroys a manual surface");

function fakeClassVariable(name, value) {
    return {
        pointers: [{ bytesAsString: function() { return name; } }, value, null, null],
        sqClass: { className: function() { return "ClassVariable"; } },
    };
}
const nilObj = { isNil: true };
const staleFFICalloutAPI = { sqClass: { className: function() { return "FFICalloutAPI class"; } } };
const tfCalloutAPI = { pointers: [], sqClass: { className: function() { return "Metaclass"; } } };
const tffiBackendClass = { pointers: [], classInstProto: function() { return function FakeObject() {}; }, sqClass: { className: function() { return "Metaclass"; } } };
const ffiCalloutAPIClass = { pointers: [null, { pointers: [fakeClassVariable("CalloutAPIClass", staleFFICalloutAPI)] }], dirty: false };
const ffiBackendClass = { pointers: [null, { pointers: [fakeClassVariable("Current", staleFFICalloutAPI)] }], dirty: false };
const nullAllocateMethod = { isMethod: function() { return true; }, name: "NullFFIBackend>>allocate:" };
const tffiAllocateMethod = { isMethod: function() { return true; }, name: "TFFIBackend>>allocate:" };
const nullFreeMethod = { isMethod: function() { return true; }, name: "NullFFIBackend>>free:" };
const tffiFreeMethod = { isMethod: function() { return true; }, name: "TFFIBackend>>free:" };
const nullLoadSymbolMethod = { isMethod: function() { return true; }, name: "NullFFIBackend>>loadSymbol:module:" };
const tffiPrimLoadSymbolMethod = { isMethod: function() { return true; }, name: "TFFIBackend>>primLoadSymbol:module:" };
const allocateSelector = { hash: 17, bytesSize: function() { return "allocate:".length; }, bytesAsString: function() { return "allocate:"; } };
const freeSelector = { hash: 23, bytesSize: function() { return "free:".length; }, bytesAsString: function() { return "free:"; } };
const loadSymbolSelector = { hash: 31, bytesSize: function() { return "loadSymbol:module:".length; }, bytesAsString: function() { return "loadSymbol:module:"; } };
const primLoadSymbolSelector = { hash: 37, bytesSize: function() { return "primLoadSymbol:module:".length; }, bytesAsString: function() { return "primLoadSymbol:module:"; } };
const nullBackendMethods = { pointers: [nullAllocateMethod, nullFreeMethod, nullLoadSymbolMethod], dirty: false };
const tffiBackendMethods = { pointers: [tffiAllocateMethod, tffiFreeMethod, tffiPrimLoadSymbolMethod], dirty: false };
const nullBackendClass = {
    pointers: [null, { pointers: [null, nullBackendMethods, allocateSelector, freeSelector, loadSymbolSelector], dirty: false }],
    dirty: false,
    className: function() { return "NullFFIBackend"; },
};
tffiBackendClass.pointers = [null, { pointers: [null, tffiBackendMethods, allocateSelector, freeSelector, primLoadSymbolSelector], dirty: false }];
tffiBackendClass.className = function() { return "TFFIBackend"; };
const fakeInterpreter = {
    nilObj: nilObj,
    globalNamed: function(name) {
        if (name === "TFCalloutAPI") return tfCalloutAPI;
        if (name === "TFFIBackend") return tffiBackendClass;
        if (name === "FFICalloutAPI") return ffiCalloutAPIClass;
        if (name === "FFIBackend") return ffiBackendClass;
        if (name === "NullFFIBackend") return nullBackendClass;
        return null;
    },
    allMethodsDo: function(callback) {
        [[nullBackendClass, nullAllocateMethod, allocateSelector], [nullBackendClass, nullFreeMethod, freeSelector], [nullBackendClass, nullLoadSymbolMethod, loadSymbolSelector], [tffiBackendClass, tffiAllocateMethod, allocateSelector], [tffiBackendClass, tffiFreeMethod, freeSelector], [tffiBackendClass, tffiPrimLoadSymbolMethod, primLoadSymbolSelector]].some(function(each) { return callback(each[0], each[1], each[2]); });
    },
    flushMethodCacheForSelector: function(selector) { selector.flushed = true; },
    findClassVariable: Squeak.Interpreter.prototype.findClassVariable,
    setClassVariableValue: Squeak.Interpreter.prototype.setClassVariableValue,
    findMethodSlot: Squeak.Interpreter.prototype.findMethodSlot,
    replaceMethodWithSelector: Squeak.Interpreter.prototype.replaceMethodWithSelector,
    replaceMethodWith: Squeak.Interpreter.prototype.replaceMethodWith,
    hackPharo14ThreadedFFICalloutAPI: Squeak.Interpreter.prototype.hackPharo14ThreadedFFICalloutAPI,
    instantiateClass: function(aClass, indexableSize) { return { sqClass: aClass, pointers: [], isTFFIBackendInstance: true }; },
};
fakeInterpreter.hackPharo14ThreadedFFICalloutAPI();
assert.strictEqual(ffiCalloutAPIClass.pointers[1].pointers[0].pointers[1], tfCalloutAPI, "Pharo 14 startup hack forces UFFI to TFCalloutAPI");
assert.strictEqual(ffiBackendClass.pointers[1].pointers[0].pointers[1].sqClass, tffiBackendClass, "Pharo 14 startup hack pins cached FFIBackend Current to TFFIBackend");
assert.strictEqual(nullBackendMethods.pointers[0], tffiAllocateMethod, "Pharo 14 startup hack makes stale NullFFIBackend allocate through the TFFI primitive");
assert.strictEqual(nullBackendMethods.pointers[1], tffiFreeMethod, "Pharo 14 startup hack makes stale NullFFIBackend free through the TFFI primitive");
assert.strictEqual(nullBackendMethods.pointers[2], tffiPrimLoadSymbolMethod, "Pharo 14 startup hack makes stale NullFFIBackend symbol lookup through the TFFI primitive");
assert.strictEqual(allocateSelector.flushed, true, "allocate: method-cache entries are flushed after patching");
assert.strictEqual(freeSelector.flushed, true, "free: method-cache entries are flushed after patching");

let argv = Squeak.defaultArgvForImage({ unix: true }, "/pharo14/Pharo14.image");
assert.deepStrictEqual(argv, ["/vm.js", "/pharo14/Pharo14.image", "--interactive"], "browser Unix Pharo run defaults to --interactive");

let browserDisplay = { argv: Squeak.defaultArgvForImage({ unix: true }, "/pharo14/Pharo14.image"), documentName: "/pharo14/Pharo14.image" };
r = primitiveAttribute(browserDisplay, 0);
assert.strictEqual(r.ok, true, "browser argv attribute 0 succeeds");
assert.strictEqual(r.result, "/vm.js", "attribute 0 is VM file");
r = primitiveAttribute(browserDisplay, 1);
assert.strictEqual(r.ok, true, "browser argv attribute 1 succeeds");
assert.strictEqual(r.result, "/pharo14/Pharo14.image", "attribute 1 is image path");
r = primitiveAttribute(browserDisplay, 2);
assert.strictEqual(r.ok, true, "browser argv attribute 2 succeeds");
assert.strictEqual(r.result, "--interactive", "attribute 2 is the image-side --interactive argument, not the image path");
r = primitiveAttribute({ argv: ["/vm.js", "/pharo14/Pharo14.image"], documentName: "/pharo14/Pharo14.image" }, 2);
assert.strictEqual(r.ok, false, "missing image-side argv does not fall back to the image path");

argv = Squeak.defaultArgvForImage({ unix: true, args: ["eval", "1+2"] }, "/pharo14/Pharo14.image");
assert.deepStrictEqual(argv, ["/vm.js", "/pharo14/Pharo14.image", "eval", "1+2"], "explicit image args suppress default --interactive");

argv = Squeak.defaultArgvForImage({ unix: true, imageArgs: "--interactive" }, "/pharo14/Pharo14.image");
assert.deepStrictEqual(argv, ["/vm.js", "/pharo14/Pharo14.image", "--interactive"], "string imageArgs are accepted");

argv = Squeak.defaultArgvForImage({ unix: true, argv: ["custom-vm", "custom.image", "--headless"] }, "/pharo14/Pharo14.image");
assert.deepStrictEqual(argv, ["custom-vm", "custom.image", "--headless"], "explicit argv overrides browser default argv");


function makeTFBasicType(prim, name, code) {
    return { pointers: [prim.vm.nilObj, prim.makeStString(name), code, 0] };
}
function makeArray(values) {
    return { pointers: values.slice() };
}
function makeTFExternalFunction(prim, moduleName, functionName, returnType, parameterTypes) {
    const definition = { pointers: [prim.vm.nilObj, makeArray(parameterTypes || []), returnType, prim.vm.nilObj] };
    return { pointers: [prim.vm.nilObj, definition, prim.makeStString(functionName), prim.makeStString(moduleName || "")] };
}
function callSDL(prim, name, returnType, args, pointerType) {
    const fn = makeTFExternalFunction(prim, "libSDL2-2.0.so.0", name, returnType, args.map(() => pointerType));
    prim.vm.stack = [null, fn, makeArray(args)];
    prim.vm.sp = prim.vm.stack.length - 1;
    prim.success = true;
    const ok = prim.ffi_primitiveSameThreadCallout(2);
    return { ok, result: prim.vm.lastPushed };
}

const renderCalls = [];
const renderCanvas = { width: 1200, height: 800, style: { width: "1200px", height: "800px" } };
const renderContext = {
    canvas: renderCanvas,
    createImageData(width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; },
    putImageData(image, x, y) { renderCalls.push({ op: "putImageData", width: image.width, height: image.height, x, y, data: Array.from(image.data) }); },
    fillRect(x, y, width, height) { renderCalls.push({ op: "fillRect", x, y, width, height }); },
    save() {},
    restore() {},
};
let renderDisplay = { context: renderContext, width: 1200, height: 800, cursorCanvas: { style: {} }, mouseX: 0, mouseY: 0, buttons: 0 };
let renderPrim = makePrimitive([], renderDisplay);
let intType = makeTFBasicType(renderPrim, "sint", 18);
let pointerType = makeTFBasicType(renderPrim, "pointer", 12);
r = callSDL(renderPrim, "SDL_CreateWindow", pointerType, [renderPrim.makeStString("Render"), 0, 0, 2, 2, 4], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke creates an SDL window");
const renderWindow = r.result;
assert.strictEqual(renderWindow.jsData.width, 1200, "browser render smoke keeps SDL window width bound to the managed canvas backing store");
assert.strictEqual(renderWindow.jsData.height, 800, "browser render smoke keeps SDL window height bound to the managed canvas backing store");
assert.strictEqual(renderCanvas.width, 1200, "browser render smoke does not shrink the managed canvas width to SDL_CreateWindow's requested size");
assert.strictEqual(renderCanvas.height, 800, "browser render smoke does not shrink the managed canvas height to SDL_CreateWindow's requested size");
assert.strictEqual(renderCanvas.style.cursor, "default", "browser render smoke restores a visible default SDL cursor on the canvas");
r = callSDL(renderPrim, "SDL_CreateSystemCursor", pointerType, [11], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke creates a system hand cursor");
const handCursor = r.result;
r = callSDL(renderPrim, "SDL_SetCursor", makeTFBasicType(renderPrim, "void", 1), [handCursor], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke sets the SDL cursor");
assert.strictEqual(renderCanvas.style.cursor, "pointer", "browser render smoke maps SDL hand cursor to CSS pointer");
r = callSDL(renderPrim, "SDL_ShowCursor", intType, [0], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke hides the SDL cursor");
assert.strictEqual(renderCanvas.style.cursor, "none", "browser render smoke maps SDL hidden cursor to CSS none");
r = callSDL(renderPrim, "SDL_ShowCursor", intType, [1], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke shows the SDL cursor");
assert.strictEqual(renderCanvas.style.cursor, "pointer", "browser render smoke restores the active SDL cursor after show");
renderDisplay.width = 1600;
renderDisplay.height = 900;
renderCanvas.width = 1600;
renderCanvas.height = 900;
renderDisplay.changedCallback();
assert.strictEqual(renderWindow.jsData.width, 1600, "browser render smoke updates SDL window width after managed canvas resize");
assert.strictEqual(renderWindow.jsData.height, 900, "browser render smoke updates SDL window height after managed canvas resize");
assert.ok(renderDisplay.sdlEventQueue.some(evt => evt.type === 0x200 && evt.event === 6 && evt.data1 === 1600 && evt.data2 === 900), "browser render smoke queues SDL size changed after managed canvas resize");

r = callSDL(renderPrim, "SDL_CreateRenderer", pointerType, [renderWindow, -1, 0], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke creates an SDL renderer");
const renderRenderer = r.result;
r = callSDL(renderPrim, "SDL_CreateTexture", pointerType, [renderRenderer, 0x16161804, 1, 1, 1], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke creates an XRGB8888 texture");
const renderTexture = r.result;
r = callSDL(renderPrim, "SDL_UpdateTexture", intType, [renderTexture, renderPrim.vm.nilObj, { bytes: new Uint8Array([0, 0, 255, 0]) }, 4], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke uploads Pharo/XRGB red texture data");
assert.deepStrictEqual(Array.from(new Uint8Array(renderTexture.jsData.pixels)), [255, 0, 0, 255], "browser render smoke normalizes texture bytes to Canvas RGBA");
const renderDst = renderPrim.ffiMakeStExternalAddress();
renderDst.jsData = new ArrayBuffer(16);
const renderDstView = new DataView(renderDst.jsData);
renderDstView.setInt32(0, 1, true);
renderDstView.setInt32(4, 1, true);
renderDstView.setInt32(8, 1, true);
renderDstView.setInt32(12, 1, true);
r = callSDL(renderPrim, "SDL_RenderCopy", intType, [renderRenderer, renderTexture, renderPrim.vm.nilObj, renderDst], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke copies the texture to the canvas");
const renderPaint = renderCalls.find(call => call.op === "putImageData" && call.width === 1 && call.height === 1);
assert.ok(renderPaint, "browser render smoke observes putImageData from SDL_RenderCopy");
assert.strictEqual(renderPaint.x, 1, "browser render smoke honors destination rectangle x");
assert.strictEqual(renderPaint.y, 1, "browser render smoke honors destination rectangle y");
assert.deepStrictEqual(renderPaint.data.slice(0, 4), [255, 0, 0, 255], "browser render smoke observes a red RGBA canvas pixel");

r = callSDL(renderPrim, "SDL_CreateTexture", pointerType, [renderRenderer, 0x16161804, 1, 1, 1], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke creates a lockable XRGB8888 texture");
const lockedTexture = r.result;
const pixelsOut = renderPrim.ffiMakeStExternalAddress();
const pitchOut = renderPrim.ffiMakeStExternalAddress();
pitchOut.jsData = new ArrayBuffer(4);
r = callSDL(renderPrim, "SDL_LockTexture", intType, [lockedTexture, renderPrim.vm.nilObj, pixelsOut, pitchOut], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke locks the texture");
const lockedHandle = Number(new DataView(pixelsOut.bytes.buffer).getBigUint64(0, true) & 0xFFFFFFFFn);
assert.ok(lockedHandle > 0, "browser render smoke receives a non-zero texture pixel pointer");
assert.strictEqual(new DataView(pitchOut.jsData).getInt32(0, true), 4, "browser render smoke receives texture pitch");
assert.ok(renderPrim.ffiAddressDataMap[lockedHandle] instanceof ArrayBuffer, "browser render smoke maps the texture pointer to writable pixel memory");
new Uint8Array(renderPrim.ffiAddressDataMap[lockedHandle]).set([0, 0, 255, 0]);
r = callSDL(renderPrim, "SDL_UnlockTexture", intType, [lockedTexture], pointerType);
assert.strictEqual(r.ok, true, "browser render smoke unlocks the texture");
assert.deepStrictEqual(Array.from(new Uint8Array(lockedTexture.jsData.pixels)), [255, 0, 0, 255], "browser render smoke converts locked XRGB pixels to canvas RGBA");
assert.ok(!renderPrim.ffiAddressDataMap[lockedHandle], "browser render smoke releases the temporary texture pointer mapping");

console.log("browser-module-smoke: ok");
