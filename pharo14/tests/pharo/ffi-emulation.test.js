"use strict";

const {
    Squeak,
    Classes,
    makePrimitive,
    stringFromObject,
    bigIntFromObject,
} = require("./support/fake-primitives");

function makeString(prim, value) {
    return prim.makeStString(value);
}

function makeType(typeSpec) {
    return { pointers: [{ words: new Uint32Array([typeSpec >>> 0]) }] };
}

function atomicType(atomicType) {
    return makeType((Squeak.FFIFlagAtomic | (atomicType << Squeak.FFIAtomicTypeShift)) >>> 0);
}

function pointerType(atomicType) {
    return makeType((Squeak.FFIFlagAtomicPointer | (atomicType << Squeak.FFIAtomicTypeShift)) >>> 0);
}

function makeExternalFunction(prim, moduleName, functionName, returnType, argTypes, handle) {
    const fn = { sqClass: Classes.ExternalFunction, pointers: new Array(6) };
    fn.pointers[Squeak.ExtLibFunc_handle] = prim.ffiMakeStExternalAddress(handle || 0);
    fn.pointers[Squeak.ExtLibFunc_flags] = 0;
    fn.pointers[Squeak.ExtLibFunc_argTypes] = { pointers: [returnType].concat(argTypes || []) };
    fn.pointers[Squeak.ExtLibFunc_name] = makeString(prim, functionName);
    fn.pointers[Squeak.ExtLibFunc_module] = makeString(prim, moduleName || "");
    fn.pointers[Squeak.ExtLibFunc_errorCodeName] = prim.vm.nilObj;
    return fn;
}

function makeTFBasicType(prim, name, code) {
    return { pointers: [prim.vm.nilObj, makeString(prim, name), code, 0] };
}

function makeArray(values) {
    return { sqClass: Classes.Array, pointers: values.slice() };
}

function makeTFExternalFunction(prim, moduleName, functionName, returnType, parameterTypes) {
    const definition = { pointers: [prim.vm.nilObj, makeArray(parameterTypes || []), returnType, prim.vm.nilObj] };
    return { pointers: [prim.vm.nilObj, definition, makeString(prim, functionName), makeString(prim, moduleName || "")] };
}

function callExternalFunction(prim, extLibFunc, args) {
    const argsObj = { sqClass: Classes.Array, pointers: new Array(args.length) };
    for (let i = 0; i < args.length; i++) argsObj.pointers[i] = args[i];
    prim.vm.stack = [null, extLibFunc, argsObj];
    prim.vm.sp = prim.vm.stack.length - 1;
    prim.success = true;
    const ok = prim.ffi_primitiveCalloutWithArgs(2);
    return { ok, result: prim.vm.lastPushed };
}

function runFFICall(prim, moduleName, functionName, returnType, argTypes, args) {
    return callExternalFunction(prim, makeExternalFunction(prim, moduleName, functionName, returnType, argTypes), args);
}

function runNamedPrimitive(prim, moduleName, primitiveName, stack, argCount) {
    prim.vm.stack = stack.slice();
    prim.vm.sp = prim.vm.stack.length - 1;
    prim.success = true;
    const ok = prim.namedPrimitive(moduleName, primitiveName, argCount);
    return { ok, result: prim.vm.lastPushed };
}

exports.run = async function(t) {
    await t.test("empty-module primitiveGetenv falls back to browser Unix environment", async t => {
        const oldValue = process.env.XDG_CONFIG_HOME;
        delete process.env.XDG_CONFIG_HOME;
        try {
            const prim = makePrimitive();
            const r = runNamedPrimitive(prim, "", "primitiveGetenv", [null, makeString(prim, "XDG_CONFIG_HOME")], 1);
            t.ok(r.ok, "primitive succeeds for browser fallback variable");
            t.equal(stringFromObject(r.result), "/home/squeak/.config", "browser fallback exposes XDG_CONFIG_HOME for UnixResolver preferences");
        } finally {
            if (oldValue !== undefined) process.env.XDG_CONFIG_HOME = oldValue;
        }
    });

    await t.test("empty-module primitiveGetenv returns Node environment strings and nil for absent variables", async t => {
        const oldValue = process.env.SQUEAKJS_TEST_GETENV;
        process.env.SQUEAKJS_TEST_GETENV = "ffi-env-value";
        try {
            const prim = makePrimitive();
            let r = runNamedPrimitive(prim, "", "primitiveGetenv", [null, makeString(prim, "SQUEAKJS_TEST_GETENV")], 1);
            t.ok(r.ok, "primitive succeeds for present variable");
            t.equal(stringFromObject(r.result), "ffi-env-value", "present environment variable is returned as a Smalltalk string");

            r = runNamedPrimitive(prim, "", "primitiveGetenv", [null, makeString(prim, "SQUEAKJS_TEST_GETENV_DOES_NOT_EXIST")], 1);
            t.ok(r.ok, "primitive succeeds for absent variable");
            t.ok(r.result && r.result.isNil, "absent environment variable answers nil");
        } finally {
            if (oldValue === undefined) delete process.env.SQUEAKJS_TEST_GETENV;
            else process.env.SQUEAKJS_TEST_GETENV = oldValue;
        }
    });

    await t.test("empty-module primitiveLoadSymbolFromModule returns fake ExternalAddress handles for registered libc symbols", async t => {
        const prim = makePrimitive();
        const r = runNamedPrimitive(prim, "", "primitiveLoadSymbolFromModule", [null, makeString(prim, "getenv"), prim.vm.nilObj], 2);
        t.ok(r.ok, "primitive succeeds for libc getenv");
        t.ok(r.result && r.result.bytes && r.result.bytes.length === 8, "64-bit ExternalAddress-sized byte object is returned");
        t.equal(r.result.wordsOrBytes()[0], 1, "first symbol handle is stored in address bytes");
        t.equal(r.result.jsData.symbolName, "getenv", "symbol metadata is retained for emulation");
        t.equal(prim.ffiFuncs.length, 1, "symbol handle is registered in the FFI handle table");
        t.equal(prim.ffiFuncs[0].funcName, "getenv", "handle table records the symbol name");
    });

    await t.test("SqueakFFIPrims callback initialization primitive records the semaphore index", async t => {
        const prim = makePrimitive();
        const r = runNamedPrimitive(prim, "SqueakFFIPrims", "primitiveInitilizeCallbacks", [null, 42], 1);
        t.ok(r.ok, "misspelled SqueakFFIPrims callback primitive succeeds");
        t.equal(prim.ffi_callbackSemaphoreIndex, 42, "callback semaphore index is recorded");
        t.equal(prim.vm.stack.length, 1, "primitive leaves the receiver/result by named-primitive stack convention");

        const prim2 = makePrimitive();
        const r2 = runNamedPrimitive(prim2, "", "primitiveInitilizeCallbacks", [null, 77], 1);
        t.ok(r2.ok, "empty-module Pharo callback primitive succeeds");
        t.equal(prim2.ffi_callbackSemaphoreIndex, 77, "empty-module primitive records the callback semaphore index");
    });

    await t.test("empty-module primitiveInterpreterSourceVersion returns a SqueakJS version string", async t => {
        const prim = makePrimitive();
        const r = runNamedPrimitive(prim, "", "primitiveInterpreterSourceVersion", [null], 0);
        t.ok(r.ok, "primitive succeeds");
        t.match(stringFromObject(r.result), /SqueakJS|Interpreter|VM/i, "result identifies the interpreter/VM source");
    });

    await t.test("FFI library resolver canonicalizes libc/libm aliases across Unix, macOS, and Windows names", async t => {
        const prim = makePrimitive();
        t.equal(prim.ffiResolveModuleAndName("c").moduleName, "libc", "short C library name resolves to libc");
        t.equal(prim.ffiResolveModuleAndName("libc.so.6").moduleName, "libc", "Linux libc soname resolves to libc");
        t.equal(prim.ffiResolveModuleAndName("/usr/lib/libSystem.B.dylib").moduleName, "libc", "macOS libSystem path resolves to libc");
        t.equal(prim.ffiResolveModuleAndName("ucrtbase.dll").moduleName, "libc", "Windows UCRT name resolves to libc");
        t.equal(prim.ffiResolveModuleAndName("m").moduleName, "libm", "short math library name resolves to libm");
        t.equal(prim.ffiResolveModuleAndName("libm.so.6").moduleName, "libm", "Linux math soname resolves to libm");
        t.equal(prim.ffiResolveModuleAndName("libfreetype.so.6").moduleName, "libfreetype", "FreeType soname resolves to a quiet stub module");
        t.equal(prim.ffiResolveModuleAndName("/lib/x86_64-linux-gnu/libSDL2-2.0.so.0").moduleName, "libSDL2-2.0", "SDL2 path resolves to a quiet stub module");
    });

    await t.test("primitiveLoadSymbolFromModule resolves registered libc and libm symbols through aliases", async t => {
        const prim = makePrimitive();
        let r = runNamedPrimitive(prim, "", "primitiveLoadSymbolFromModule", [null, makeString(prim, "strlen"), makeString(prim, "libSystem.B.dylib")], 2);
        t.ok(r.ok, "libSystem libc alias resolves strlen");
        t.equal(r.result.jsData.moduleName, "libc", "symbol metadata records the canonical libc module");
        t.equal(prim.ffiFuncs[0].funcName, "strlen", "handle table records strlen");

        const strlenHandle = r.result.wordsOrBytes()[0];
        const intType = atomicType(Squeak.FFITypeSignedInt32);
        const charPtr = pointerType(Squeak.FFITypeUnsignedChar8);
        const byHandle = callExternalFunction(prim, makeExternalFunction(prim, "", "", intType, [charPtr], strlenHandle), [makeString(prim, "abc")]);
        t.ok(byHandle.ok, "ExternalAddress handle produced by symbol lookup can drive a later callout");
        t.equal(byHandle.result, 3, "handle-based callout reaches the stored strlen symbol");

        r = runNamedPrimitive(prim, "", "primitiveLoadSymbolFromModule", [null, makeString(prim, "sqrt"), makeString(prim, "libm.so.6")], 2);
        t.ok(r.ok, "libm soname resolves sqrt");
        t.equal(r.result.jsData.moduleName, "libm", "symbol metadata records the canonical libm module");
        t.equal(prim.ffiFuncs[1].funcName, "sqrt", "handle table records sqrt");
    });

    await t.test("FFI callout invokes libc string and memory functions through the generic C-library emulation", async t => {
        const prim = makePrimitive();
        const intType = atomicType(Squeak.FFITypeSignedInt32);
        const charPtr = pointerType(Squeak.FFITypeUnsignedChar8);
        const voidPtr = pointerType(Squeak.FFITypeVoid);

        let r = runFFICall(prim, "libc.so.6", "strlen", intType, [charPtr], [makeString(prim, "abcdef")]);
        t.ok(r.ok, "strlen callout succeeds");
        t.equal(r.result, 6, "strlen returns the C-string byte length");

        r = runFFICall(prim, "c", "strncmp", intType, [charPtr, charPtr, intType], [makeString(prim, "abc"), makeString(prim, "abd"), 3]);
        t.ok(r.ok, "strncmp callout succeeds");
        t.ok(r.result < 0, "strncmp reports the first differing byte");

        const dest = new Uint8Array(6);
        const src = new Uint8Array([65, 66, 67, 0]);
        const destData = prim.ffiMakeStExternalData(dest, voidPtr);
        const srcData = prim.ffiMakeStExternalData(src, voidPtr);
        r = runFFICall(prim, "libc", "memcpy", voidPtr, [voidPtr, voidPtr, intType], [destData, srcData, 4]);
        t.ok(r.ok, "memcpy callout succeeds");
        t.equal(JSON.stringify(Array.from(dest.slice(0, 4))), JSON.stringify([65, 66, 67, 0]), "memcpy mutates the destination buffer");

        r = runFFICall(prim, "libc", "memset", voidPtr, [voidPtr, intType, intType], [destData, 90, 2]);
        t.ok(r.ok, "memset callout succeeds");
        t.equal(JSON.stringify(Array.from(dest.slice(0, 4))), JSON.stringify([90, 90, 67, 0]), "memset mutates the requested prefix");
    });

    await t.test("FFI callout invokes libm functions through the same emulation registry", async t => {
        const prim = makePrimitive();
        const doubleType = atomicType(Squeak.FFITypeDoubleFloat);
        const r = runFFICall(prim, "m", "sqrt", doubleType, [doubleType], [81]);
        t.ok(r.ok, "sqrt callout succeeds");
        t.equal(r.result, 9, "sqrt returns a floating result through the FFI result bridge");
    });

    await t.test("FFI integer memory primitives read and write 1, 2, 4, and 8 byte values", async t => {
        const prim = makePrimitive();
        const data = prim.ffiMakeStExternalAddress();
        data.jsData = new ArrayBuffer(16);
        const trueObj = prim.vm.trueObj;
        const falseObj = prim.vm.falseObj;

        function atPut(offset, value, size, signed) {
            prim.vm.stack = [null, data, offset, value, size, signed ? trueObj : falseObj];
            prim.vm.sp = prim.vm.stack.length - 1;
            prim.success = true;
            return prim.ffi_primitiveFFIIntegerAtPut(5);
        }
        function at(offset, size, signed) {
            prim.vm.stack = [null, data, offset, size, signed ? trueObj : falseObj];
            prim.vm.sp = prim.vm.stack.length - 1;
            prim.success = true;
            const ok = prim.ffi_primitiveFFIIntegerAt(4);
            return { ok, result: prim.vm.lastPushed };
        }

        t.ok(atPut(1, 255, 1, false), "uint8 put succeeds");
        t.equal(at(1, 1, false).result, 255, "uint8 read succeeds");
        t.ok(atPut(2, -2, 2, true), "int16 put succeeds");
        t.equal(at(2, 2, true).result, -2, "int16 read succeeds");
        t.ok(atPut(4, 0x89ABCDEF, 4, false), "uint32 put accepts large positive values");
        t.equal(bigIntFromObject(at(4, 4, false).result).toString(16), "89abcdef", "uint32 read preserves all bits");
        const large = prim.objectFromBigInt(0x123456789ABCDEFn);
        t.ok(atPut(8, large, 8, false), "uint64 put accepts LargePositiveInteger values");
        t.equal(bigIntFromObject(at(8, 8, false).result).toString(16), "123456789abcdef", "uint64 read preserves all bits");
    });

    await t.test("ThreadedFFI basic type primitives create handles and byte sizes", async t => {
        const prim = makePrimitive();
        const pointerType = makeTFBasicType(prim, "pointer", 12);
        prim.vm.stack = [pointerType];
        prim.vm.sp = 0;
        prim.success = true;
        t.ok(prim.ffi_primitiveFillBasicType(0), "pointer basic type is filled");
        t.ok(pointerType.pointers[0] && pointerType.pointers[0].jsData.tfTypeCode === 12, "type handle records the ThreadedFFI type code");
        t.equal(pointerType.pointers[3], 8, "pointer byte size follows the 64-bit image word size");

        const doubleType = makeTFBasicType(prim, "double", 3);
        prim.vm.stack = [doubleType];
        prim.vm.sp = 0;
        prim.success = true;
        t.ok(prim.ffi_primitiveTypeByteSize(0), "type byte-size primitive succeeds");
        t.equal(prim.vm.lastPushed, 8, "double byte size is reported");
    });

    await t.test("ThreadedFFI same-thread callout invokes libc through TFExternalFunction-shaped objects", async t => {
        const prim = makePrimitive();
        const sintType = makeTFBasicType(prim, "sint", 18);
        const pointerType = makeTFBasicType(prim, "pointer", 12);
        const tfFunction = makeTFExternalFunction(prim, "libc", "strlen", sintType, [pointerType]);
        prim.vm.stack = [null, tfFunction, makeArray([makeString(prim, "abcd")])];
        prim.vm.sp = prim.vm.stack.length - 1;
        prim.success = true;
        t.ok(prim.ffi_primitiveSameThreadCallout(2), "same-thread callout primitive succeeds");
        t.equal(prim.vm.lastPushed, 4, "callout reaches libc strlen and marshals the integer result");
    });

    await t.test("ThreadedFFI function definitions and OOP-address pointers keep enough metadata for callouts", async t => {
        const prim = makePrimitive();
        const sintType = makeTFBasicType(prim, "sint", 18);
        const pointerType = makeTFBasicType(prim, "pointer", 12);
        const definition = { pointers: [prim.vm.nilObj, makeArray([pointerType]), sintType, prim.vm.nilObj] };
        prim.vm.stack = [definition, makeArray([pointerType.pointers[0]]), sintType.pointers[0]];
        prim.vm.sp = prim.vm.stack.length - 1;
        prim.success = true;
        t.ok(prim.ffi_primitiveDefineFunction(2), "function definition primitive succeeds");
        t.ok(definition.pointers[0].jsData.tfFunctionDefinition, "definition handle records ThreadedFFI metadata");

        const bytes = makeString(prim, "abc");
        prim.vm.stack = [null, bytes];
        prim.vm.sp = prim.vm.stack.length - 1;
        prim.success = true;
        t.ok(prim.ffi_primitiveGetAddressOfOOP(1), "OOP-address primitive succeeds");
        const oopHandle = prim.vm.lastPushed;
        const extAddr = prim.ffiMakeStExternalAddress(oopHandle);
        t.equal(prim.ffiTFDataFromExternalAddress(extAddr), bytes.bytes, "ExternalAddress bytes map back to the original pinned object bytes");
    });

    await t.test("ExternalAddress primitive 646 writes a uint8 into FFI allocated memory", async t => {
        const prim = makePrimitive();
        const extAddr = prim.ffiMakeStExternalAddress();
        extAddr.jsData = new ArrayBuffer(4);
        prim.vm.stack = [extAddr, 2, 90];
        prim.vm.sp = prim.vm.stack.length - 1;
        prim.success = true;
        t.ok(prim.ffi_primitiveStoreUInt8IntoExternalAddress(2), "primitive 646 emulation succeeds");
        t.equal(new Uint8Array(extAddr.jsData)[2], 90, "zero-based ExternalAddress byte offset is written");
        t.equal(prim.vm.lastPushed, 90, "primitive answers the stored byte value");
    });


    await t.test("ExternalAddress pointer put tolerates opaque JavaScript-backed pointers", async t => {
        const prim = makePrimitive();
        const dest = prim.ffiMakeStExternalAddress();
        dest.jsData = new ArrayBuffer(8);
        const opaquePointer = prim.ffiMakeStExternalAddress();
        opaquePointer.jsData = { sdlKind: "window" };

        prim.vm.stack = [dest, 0, opaquePointer];
        prim.vm.sp = prim.vm.stack.length - 1;
        prim.success = true;
        t.ok(prim.primitiveExternalAddressPointerAtOffsetPut(2), "pointerAtOffset:put: succeeds for opaque JS-backed pointer");
        t.ok(new DataView(dest.jsData).getUint32(0, true) >= 0, "opaque pointer writes a stable handle or null without throwing");
    });

    await t.test("ExternalAddress direct float primitives read and write zero-based offsets", async t => {
        const prim = makePrimitive();
        const extAddr = prim.ffiMakeStExternalAddress();
        extAddr.jsData = new ArrayBuffer(16);

        prim.vm.stack = [extAddr, 4, prim.makeStObject(96.5)];
        prim.vm.sp = prim.vm.stack.length - 1;
        prim.success = true;
        t.ok(prim.primitiveExternalAddressFloatAtOffsetPut(2, 4), "float32AtOffset:put: succeeds");

        prim.vm.stack = [extAddr, 4];
        prim.vm.sp = prim.vm.stack.length - 1;
        prim.success = true;
        t.ok(prim.primitiveExternalAddressFloatAtOffset(1, 4), "float32AtOffset: succeeds");
        t.equal(prim.vm.lastPushed.float, 96.5, "float32AtOffset: reads the value written by the put primitive");
    });

    await t.test("SDL2 emulation exposes first OSWindow-relevant symbols and mutable window state", async t => {
        const prim = makePrimitive();
        const intType = makeTFBasicType(prim, "sint", 18);
        const uintType = makeTFBasicType(prim, "uint", 19);
        const pointerType = makeTFBasicType(prim, "pointer", 12);

        function call(name, returnType, args) {
            const parameterTypes = args.map(() => pointerType);
            const fn = makeTFExternalFunction(prim, "libSDL2-2.0.so.0", name, returnType, parameterTypes);
            prim.vm.stack = [null, fn, makeArray(args)];
            prim.vm.sp = prim.vm.stack.length - 1;
            prim.success = true;
            const ok = prim.ffi_primitiveSameThreadCallout(2);
            return { ok, result: prim.vm.lastPushed };
        }

        let r = call("SDL_Init", intType, [0x20]);
        t.ok(r.ok, "SDL_Init resolves and succeeds");
        t.equal(r.result, 0, "SDL_Init returns success");

        r = call("SDL_CreateWindow", pointerType, [makeString(prim, "SqueakJS"), 10, 20, 320, 200, 4]);
        t.ok(r.ok, "SDL_CreateWindow resolves and succeeds");
        const windowAddress = r.result;
        t.equal(windowAddress.jsData.sdlKind, "window", "SDL_CreateWindow returns an opaque JS-backed window handle");
        t.equal(windowAddress.jsData.width, 320, "window width is retained");
        t.equal(windowAddress.jsData.height, 200, "window height is retained");

        r = call("SDL_GetWindowID", uintType, [windowAddress]);
        t.ok(r.ok, "SDL_GetWindowID succeeds");
        t.equal(r.result, 1, "first emulated window gets SDL window id 1");

        const wPtr = prim.ffiMakeStExternalAddress();
        wPtr.jsData = new ArrayBuffer(4);
        const hPtr = prim.ffiMakeStExternalAddress();
        hPtr.jsData = new ArrayBuffer(4);
        r = call("SDL_GetWindowSize", intType, [windowAddress, wPtr, hPtr]);
        t.ok(r.ok, "SDL_GetWindowSize succeeds");
        t.equal(new DataView(wPtr.jsData).getInt32(0, true), 320, "SDL_GetWindowSize writes width through int* pointer");
        t.equal(new DataView(hPtr.jsData).getInt32(0, true), 200, "SDL_GetWindowSize writes height through int* pointer");

        const ddpi = prim.ffiMakeStExternalAddress();
        ddpi.jsData = new ArrayBuffer(4);
        const hdpi = prim.ffiMakeStExternalAddress();
        hdpi.jsData = new ArrayBuffer(4);
        const vdpi = prim.ffiMakeStExternalAddress();
        vdpi.jsData = new ArrayBuffer(4);
        r = call("SDL_GetDisplayDPI", intType, [0, ddpi, hdpi, vdpi]);
        t.ok(r.ok, "SDL_GetDisplayDPI succeeds");
        t.equal(new DataView(ddpi.jsData).getFloat32(0, true), 96, "SDL_GetDisplayDPI writes a stable fallback DPI");
    });


    await t.test("SDL2 renderer copies texture pixels into the current SqueakJS display context", async t => {
        const canvas = { width: 0, height: 0, style: {} };
        const calls = [];
        const context = {
            canvas,
            fillStyle: "",
            createImageData(width, height) {
                return { width, height, data: new Uint8ClampedArray(width * height * 4) };
            },
            putImageData(image, x, y) {
                calls.push({ op: "putImageData", width: image.width, height: image.height, x, y, data: Array.from(image.data) });
            },
            fillRect(x, y, width, height) {
                calls.push({ op: "fillRect", x, y, width, height, fillStyle: this.fillStyle });
            },
            save() {},
            restore() {},
        };
        const display = { context, cursorCanvas: { style: {} }, mouseX: 0, mouseY: 0, buttons: 0 };
        const prim = makePrimitive([], display);
        const intType = makeTFBasicType(prim, "sint", 18);
        const pointerType = makeTFBasicType(prim, "pointer", 12);

        function call(name, returnType, args) {
            const fn = makeTFExternalFunction(prim, "libSDL2-2.0.so.0", name, returnType, args.map(() => pointerType));
            prim.vm.stack = [null, fn, makeArray(args)];
            prim.vm.sp = prim.vm.stack.length - 1;
            prim.success = true;
            const ok = prim.ffi_primitiveSameThreadCallout(2);
            return { ok, result: prim.vm.lastPushed };
        }

        let r = call("SDL_CreateWindow", pointerType, [makeString(prim, "Browser"), 0, 0, 2, 2, 4]);
        t.ok(r.ok, "SDL_CreateWindow succeeds");
        const windowAddress = r.result;
        t.equal(canvas.width, 2, "SDL window creation binds and sizes the browser canvas width");
        t.equal(canvas.height, 2, "SDL window creation binds and sizes the browser canvas height");
        t.equal(display.sdlWindow, windowAddress.jsData, "display remembers the SDL window bound through the current primitive context");
        t.equal(canvas.style.cursor, "default", "SDL window binding restores the browser cursor from SqueakJS' old software-cursor hiding");
        t.equal(display.cursorCanvas.style.display, "none", "SDL native cursor path hides the old SqueakJS software cursor overlay");

        r = call("SDL_CreateSystemCursor", pointerType, [11]);
        t.ok(r.ok, "SDL_CreateSystemCursor succeeds for hand cursor");
        const handCursor = r.result;
        t.equal(handCursor.jsData.cssCursor, "pointer", "SDL system hand cursor maps to CSS pointer");

        r = call("SDL_SetCursor", makeTFBasicType(prim, "void", 1), [handCursor]);
        t.ok(r.ok, "SDL_SetCursor succeeds");
        t.equal(canvas.style.cursor, "pointer", "SDL_SetCursor applies the browser CSS cursor");
        t.equal(display.sdlCursorCSS, "pointer", "display diagnostics remember the active CSS cursor");

        r = call("SDL_ShowCursor", intType, [0]);
        t.ok(r.ok, "SDL_ShowCursor disable succeeds");
        t.equal(r.result, 0, "SDL_ShowCursor returns hidden state after disabling");
        t.equal(canvas.style.cursor, "none", "SDL_ShowCursor disable hides the browser cursor");

        r = call("SDL_ShowCursor", intType, [1]);
        t.ok(r.ok, "SDL_ShowCursor enable succeeds");
        t.equal(r.result, 1, "SDL_ShowCursor returns visible state after enabling");
        t.equal(canvas.style.cursor, "pointer", "SDL_ShowCursor enable restores the selected cursor");

        const cursorData = { bytes: new Uint8Array([0x80]) };
        const cursorMask = { bytes: new Uint8Array([0xC0]) };
        r = call("SDL_CreateCursor", pointerType, [cursorData, cursorMask, 2, 1, 1, 0]);
        t.ok(r.ok, "SDL_CreateCursor succeeds for monochrome cursor data");
        const customCursor = r.result;
        t.ok(/^data:image\/svg\+xml,/.test(customCursor.jsData.cssDataURL), "SDL_CreateCursor records a CSS data URL for browser custom cursors");
        r = call("SDL_SetCursor", makeTFBasicType(prim, "void", 1), [customCursor]);
        t.ok(r.ok, "SDL_SetCursor succeeds for custom cursor");
        t.match(canvas.style.cursor, /^url\("data:image\/svg\+xml,/, "custom SDL cursor becomes a browser CSS cursor URL");
        t.match(canvas.style.cursor, / 1 0, auto$/, "custom SDL cursor preserves hot spot coordinates");

        r = call("SDL_CreateRenderer", pointerType, [windowAddress, -1, 0]);
        t.ok(r.ok, "SDL_CreateRenderer succeeds");
        const rendererAddress = r.result;
        r = call("SDL_CreateTexture", pointerType, [rendererAddress, 0, 1, 2, 2]);
        t.ok(r.ok, "SDL_CreateTexture succeeds");
        const textureAddress = r.result;

        const rgba = { bytes: new Uint8Array([
            255, 0, 0, 255,   0, 255, 0, 255,
            0, 0, 255, 255,   255, 255, 255, 255,
        ]) };
        r = call("SDL_UpdateTexture", intType, [textureAddress, prim.vm.nilObj, rgba, 8]);
        t.ok(r.ok, "SDL_UpdateTexture succeeds");
        t.equal(JSON.stringify(Array.from(new Uint8Array(textureAddress.jsData.pixels))), JSON.stringify(Array.from(rgba.bytes)), "texture stores the uploaded RGBA bytes");

        r = call("SDL_RenderClear", intType, [rendererAddress]);
        t.ok(r.ok, "SDL_RenderClear succeeds");
        r = call("SDL_RenderCopy", intType, [rendererAddress, textureAddress, prim.vm.nilObj, prim.vm.nilObj]);
        t.ok(r.ok, "SDL_RenderCopy succeeds");
        t.ok(calls.some(call => call.op === "putImageData" && call.width === 2 && call.height === 2), "render copy paints texture pixels into the current display canvas context");

        const xrgb8888 = 0x16161804;
        r = call("SDL_CreateTexture", pointerType, [rendererAddress, xrgb8888, 1, 1, 1]);
        t.ok(r.ok, "SDL_CreateTexture succeeds for SDL_PIXELFORMAT_XRGB8888");
        const xrgbTexture = r.result;
        const pharoRedXRGBMemory = { bytes: new Uint8Array([0, 0, 255, 0]) }; // little-endian 0x00FF0000
        r = call("SDL_UpdateTexture", intType, [xrgbTexture, prim.vm.nilObj, pharoRedXRGBMemory, 4]);
        t.ok(r.ok, "SDL_UpdateTexture succeeds for XRGB8888 texture data");
        t.equal(JSON.stringify(Array.from(new Uint8Array(xrgbTexture.jsData.pixels))), JSON.stringify([255, 0, 0, 255]), "XRGB8888 upload is converted to Canvas RGBA red");

        calls.length = 0;
        const dstRect = prim.ffiMakeStExternalAddress();
        dstRect.jsData = new ArrayBuffer(16);
        const dstView = new DataView(dstRect.jsData);
        dstView.setInt32(0, 1, true);
        dstView.setInt32(4, 1, true);
        dstView.setInt32(8, 1, true);
        dstView.setInt32(12, 1, true);
        r = call("SDL_RenderCopy", intType, [rendererAddress, xrgbTexture, prim.vm.nilObj, dstRect]);
        t.ok(r.ok, "SDL_RenderCopy succeeds with a destination rectangle");
        const paint = calls.find(call => call.op === "putImageData" && call.width === 1 && call.height === 1);
        t.ok(paint, "render copy paints the destination rectangle size");
        t.equal(paint.x, 1, "destination rectangle x is honored when painting canvas");
        t.equal(paint.y, 1, "destination rectangle y is honored when painting canvas");
        t.equal(JSON.stringify(paint.data.slice(0, 4)), JSON.stringify([255, 0, 0, 255]), "painted canvas pixel is red RGBA");

        r = call("SDL_CreateTexture", pointerType, [rendererAddress, xrgb8888, 1, 1, 1]);
        t.ok(r.ok, "SDL_CreateTexture succeeds for lock/unlock rendering");
        const lockedTexture = r.result;
        const pixelsOut = prim.ffiMakeStExternalAddress();
        const pitchOut = prim.ffiMakeStExternalAddress();
        pitchOut.jsData = new ArrayBuffer(4);
        r = call("SDL_LockTexture", intType, [lockedTexture, prim.vm.nilObj, pixelsOut, pitchOut]);
        t.ok(r.ok, "SDL_LockTexture succeeds");
        const handle = Number(new DataView(pixelsOut.bytes.buffer).getBigUint64(0, true) & 0xFFFFFFFFn);
        t.ok(handle > 0, "SDL_LockTexture writes a non-zero pointer handle through void** pixels");
        t.equal(new DataView(pitchOut.jsData).getInt32(0, true), 4, "SDL_LockTexture writes the pitch through int* pitch");
        t.ok(prim.ffiAddressDataMap && prim.ffiAddressDataMap[handle] instanceof ArrayBuffer, "locked texture pointer handle maps to writable JS pixel memory");

        const surfacePlugin = Squeak.externalModules.SurfacePlugin;
        surfacePlugin.setInterpreter(prim.interpreterProxy);
        if (surfacePlugin.shutdownModule) surfacePlugin.shutdownModule();
        prim.vm.stack = [prim.vm.nilObj, 1, 1, 4, 32, prim.vm.trueObj];
        prim.vm.sp = prim.vm.stack.length - 1;
        prim.success = true;
        t.ok(surfacePlugin.primitiveCreateManualSurface(5), "SurfacePlugin creates a 32-bit manual surface for the locked texture buffer");
        const surfaceId = prim.vm.lastPushed;
        prim.vm.stack = [prim.vm.nilObj, surfaceId, handle];
        prim.vm.sp = prim.vm.stack.length - 1;
        prim.success = true;
        t.ok(surfacePlugin.primitiveSetManualSurfacePointer(2), "SurfacePlugin stores the fake SDL_LockTexture pointer handle");
        let surfacePitch = 0;
        const surfaceBits = surfacePlugin.ioLockSurface(surfaceId, pitch => { surfacePitch = pitch; }, 0, 0, 1, 1);
        t.ok(surfaceBits instanceof Uint32Array, "SurfacePlugin exposes locked texture memory as word-addressable BitBlt storage");
        t.equal(surfacePitch, 4, "SurfacePlugin preserves the locked texture pitch in bytes");
        surfaceBits[0] = 0x00FF0000; // little-endian XRGB8888 red, as BitBlt writes 32-bit Form pixels
        t.ok(surfacePlugin.ioUnlockSurface(surfaceId, 0, 0, 1, 1), "SurfacePlugin unlocks the manual surface before SDL_UnlockTexture");

        r = call("SDL_UnlockTexture", intType, [lockedTexture]);
        t.ok(r.ok, "SDL_UnlockTexture succeeds");
        t.equal(JSON.stringify(Array.from(new Uint8Array(lockedTexture.jsData.pixels))), JSON.stringify([255, 0, 0, 255]), "SDL_UnlockTexture converts BitBlt-written XRGB8888 memory back to Canvas RGBA");
        t.ok(!(prim.ffiAddressDataMap && prim.ffiAddressDataMap[handle]), "SDL_UnlockTexture removes the temporary pointer mapping");
    });

    await t.test("SDL2 browser-managed window follows SqueakJS canvas backing-store size", async t => {
        const canvas = { width: 1200, height: 800, style: { width: "1200px", height: "800px" } };
        const context = { canvas };
        const display = { context, width: 1200, height: 800, cursorCanvas: { style: {} }, mouseX: 0, mouseY: 0, buttons: 0, changedCallbackCount: 0 };
        display.changedCallback = function() { display.changedCallbackCount++; };
        const prim = makePrimitive([], display);
        const intType = makeTFBasicType(prim, "sint", 18);
        const pointerType = makeTFBasicType(prim, "pointer", 12);
        function call(name, returnType, args) {
            const fn = makeTFExternalFunction(prim, "libSDL2-2.0.so.0", name, returnType, args.map(() => pointerType));
            prim.vm.stack = [null, fn, makeArray(args)];
            prim.vm.sp = prim.vm.stack.length - 1;
            prim.success = true;
            const ok = prim.ffi_primitiveSameThreadCallout(2);
            return { ok, result: prim.vm.lastPushed };
        }

        let r = call("SDL_CreateWindow", pointerType, [makeString(prim, "Managed"), 0, 0, 800, 600, 4]);
        t.ok(r.ok, "SDL_CreateWindow succeeds");
        const windowAddress = r.result;
        t.equal(windowAddress.jsData.width, 1200, "SDL window adopts the browser-managed backing-store width on creation");
        t.equal(windowAddress.jsData.height, 800, "SDL window adopts the browser-managed backing-store height on creation");
        t.equal(canvas.width, 1200, "SDL_CreateWindow does not shrink the backing canvas to Pharo's requested width");
        t.equal(canvas.height, 800, "SDL_CreateWindow does not shrink the backing canvas to Pharo's requested height");

        const wPtr = prim.ffiMakeStExternalAddress();
        const hPtr = prim.ffiMakeStExternalAddress();
        wPtr.jsData = new ArrayBuffer(4);
        hPtr.jsData = new ArrayBuffer(4);
        r = call("SDL_GetWindowSize", intType, [windowAddress, wPtr, hPtr]);
        t.ok(r.ok, "SDL_GetWindowSize succeeds");
        t.equal(new DataView(wPtr.jsData).getInt32(0, true), 1200, "SDL_GetWindowSize reports browser-managed width");
        t.equal(new DataView(hPtr.jsData).getInt32(0, true), 800, "SDL_GetWindowSize reports browser-managed height");

        r = call("SDL_SetWindowSize", intType, [windowAddress, 640, 480]);
        t.ok(r.ok, "SDL_SetWindowSize succeeds in browser-managed mode");
        t.equal(windowAddress.jsData.width, 1200, "SDL_SetWindowSize preserves browser-managed width");
        t.equal(windowAddress.jsData.height, 800, "SDL_SetWindowSize preserves browser-managed height");
        t.equal(canvas.width, 1200, "SDL_SetWindowSize does not reintroduce canvas backing/CSS mismatch");

        display.width = 1600;
        display.height = 900;
        canvas.width = 1600;
        canvas.height = 900;
        display.changedCallback();
        t.equal(display.changedCallbackCount, 1, "existing display changed callback is preserved");
        t.equal(windowAddress.jsData.width, 1600, "SqueakJS resize callback updates the SDL window width");
        t.equal(windowAddress.jsData.height, 900, "SqueakJS resize callback updates the SDL window height");
        t.ok(display.sdlEventQueue.some(evt => evt.type === 0x200 && evt.event === 6 && evt.data1 === 1600 && evt.data2 === 900), "browser resize queues SDL_WINDOWEVENT_SIZE_CHANGED");

        r = call("SDL_CreateRenderer", pointerType, [windowAddress, -1, 0]);
        t.ok(r.ok, "SDL_CreateRenderer succeeds");
        const rendererAddress = r.result;
        r = call("SDL_GetRendererOutputSize", intType, [rendererAddress, wPtr, hPtr]);
        t.ok(r.ok, "SDL_GetRendererOutputSize succeeds");
        t.equal(new DataView(wPtr.jsData).getInt32(0, true), 1600, "renderer output width follows browser-managed size");
        t.equal(new DataView(hPtr.jsData).getInt32(0, true), 900, "renderer output height follows browser-managed size");
    });

    await t.test("SDL2 event bridge converts SqueakJS browser events into SDL_PollEvent records", async t => {
        const display = { context: { canvas: {} }, mouseX: 0, mouseY: 0, buttons: 0 };
        const prim = makePrimitive([], display);
        const intType = makeTFBasicType(prim, "sint", 18);
        const pointerType = makeTFBasicType(prim, "pointer", 12);
        function call(name, returnType, args) {
            const fn = makeTFExternalFunction(prim, "libSDL2-2.0.so.0", name, returnType, args.map(() => pointerType));
            prim.vm.stack = [null, fn, makeArray(args)];
            prim.vm.sp = prim.vm.stack.length - 1;
            prim.success = true;
            const ok = prim.ffi_primitiveSameThreadCallout(2);
            return { ok, result: prim.vm.lastPushed };
        }

        let r = call("SDL_CreateWindow", pointerType, [makeString(prim, "Events"), 0, 0, 64, 48, 4]);
        t.ok(r.ok, "SDL_CreateWindow succeeds");
        const windowId = r.result.jsData.id;
        display.sdlEventQueue = [];
        Squeak.externalModules["libSDL2-2.0"].lastMouseState = { x: 0, y: 0, buttons: 0 };

        Squeak.FFIEmulation.enqueueSDLEventFromSqueakEvent(display, [1, 1000, 42, 17, 4, 0]);
        const eventAddress = prim.ffiMakeStExternalAddress();
        eventAddress.jsData = new ArrayBuffer(56);
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "SDL_PollEvent succeeds");
        t.equal(r.result, 1, "SDL_PollEvent reports one queued event");
        let view = new DataView(eventAddress.jsData);
        t.equal(view.getUint32(0, true), 0x401, "mouse button press becomes SDL_MOUSEBUTTONDOWN");
        t.equal(view.getUint32(8, true), windowId, "event carries the SDL window id");
        t.equal(view.getUint8(16), 1, "Squeak red button maps to SDL left button");
        t.equal(view.getInt32(20, true), 42, "mouse event x coordinate is written");
        t.equal(view.getInt32(24, true), 17, "mouse event y coordinate is written");

        Squeak.FFIEmulation.enqueueSDLEventFromSqueakEvent(display, [1, 1010, 45, 18, 4, 0]);
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "second SDL_PollEvent succeeds");
        view = new DataView(eventAddress.jsData);
        t.equal(view.getUint32(0, true), 0x400, "mouse movement with same button state becomes SDL_MOUSEMOTION");
        t.equal(view.getInt32(28, true), 3, "relative x movement is preserved");
        t.equal(view.getInt32(32, true), 1, "relative y movement is preserved");

        Squeak.FFIEmulation.enqueueSDLEventFromSqueakEvent(display, [2, 1020, 97, 0, 0, 97]);
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "keyboard SDL_PollEvent succeeds");
        view = new DataView(eventAddress.jsData);
        t.equal(view.getUint32(0, true), 0x300, "keyboard char first yields SDL_KEYDOWN");
        t.equal(view.getInt32(20, true), 97, "keyboard event stores the unicode symbol");
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "text-input SDL_PollEvent succeeds");
        view = new DataView(eventAddress.jsData);
        t.equal(view.getUint32(0, true), 0x303, "printable keyboard char also yields SDL_TEXTINPUT");
        t.equal(view.getUint8(12), 97, "text input payload contains the typed byte");
    });



    await t.test("SDL2 event queue supports WaitEventTimeout, HasEvent, FlushEvent, and keyboard-state pointers", async t => {
        const display = { context: { canvas: {} }, mouseX: 0, mouseY: 0, buttons: 0 };
        const prim = makePrimitive([], display);
        const intType = makeTFBasicType(prim, "sint", 18);
        const uintType = makeTFBasicType(prim, "uint", 19);
        const pointerType = makeTFBasicType(prim, "pointer", 12);
        function call(name, returnType, args) {
            const fn = makeTFExternalFunction(prim, "libSDL2-2.0.so.0", name, returnType, args.map(() => pointerType));
            prim.vm.stack = [null, fn, makeArray(args)];
            prim.vm.sp = prim.vm.stack.length - 1;
            prim.success = true;
            const ok = prim.ffi_primitiveSameThreadCallout(2);
            return { ok, result: prim.vm.lastPushed };
        }

        let r = call("SDL_CreateWindow", pointerType, [makeString(prim, "Events2"), 0, 0, 64, 48, 4]);
        t.ok(r.ok, "SDL_CreateWindow succeeds");
        display.sdlEventQueue = [];
        const sdl = Squeak.externalModules["libSDL2-2.0"];
        sdl.keyboardState.fill(0);
        sdl.modState = 0;
        sdl.lastMouseState = { x: 0, y: 0, buttons: 0 };

        r = call("SDL_WaitEventTimeout", intType, [prim.ffiMakeStExternalAddress(), 1]);
        t.ok(r.ok, "SDL_WaitEventTimeout succeeds with an empty queue");
        t.equal(r.result, 0, "SDL_WaitEventTimeout is non-blocking in the JS VM and reports no event when the queue is empty");

        Squeak.FFIEmulation.enqueueSDLEventFromSqueakEvent(display, [2, 1000, 97, 0, 0, 97]);
        r = call("SDL_HasEvent", intType, [0x300]);
        t.ok(r.ok, "SDL_HasEvent succeeds");
        t.equal(r.result, 1, "SDL_HasEvent sees a queued keydown event");

        const numKeysAddress = prim.ffiMakeStExternalAddress();
        numKeysAddress.jsData = new ArrayBuffer(4);
        r = call("SDL_GetKeyboardState", pointerType, [numKeysAddress]);
        t.ok(r.ok, "SDL_GetKeyboardState succeeds");
        t.equal(new DataView(numKeysAddress.jsData).getInt32(0, true), 512, "SDL_GetKeyboardState writes the state array length");
        t.equal(r.result.jsData[4], 1, "the scancode for 'a' is marked pressed after keydown enqueue");

        const eventAddress = prim.ffiMakeStExternalAddress();
        eventAddress.jsData = new ArrayBuffer(56);
        r = call("SDL_WaitEventTimeout", intType, [eventAddress, 1]);
        t.ok(r.ok, "SDL_WaitEventTimeout succeeds with a queued event");
        t.equal(r.result, 1, "SDL_WaitEventTimeout returns one queued event");
        t.equal(new DataView(eventAddress.jsData).getUint32(0, true), 0x300, "queued keydown event was written to the SDL event buffer");

        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "SDL_PollEvent drains the text-input companion event");
        Squeak.FFIEmulation.enqueueSDLKeyUpFromBrowserEvent(display, 97, 0);
        t.equal(sdl.keyboardState[4], 0, "browser keyup bridge clears the scancode state");
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "SDL_PollEvent drains the keyup event");
        t.equal(new DataView(eventAddress.jsData).getUint32(0, true), 0x301, "browser keyup bridge queues SDL_KEYUP");

        Squeak.FFIEmulation.enqueueSDLEventFromSqueakEvent(display, [1, 1010, 20, 21, 4, 0]);
        r = call("SDL_HasEvents", intType, [0x400, 0x403]);
        t.ok(r.ok, "SDL_HasEvents succeeds");
        t.equal(r.result, 1, "SDL_HasEvents sees queued mouse events");
        r = call("SDL_FlushEvent", intType, [0x401]);
        t.ok(r.ok, "SDL_FlushEvent succeeds");
        r = call("SDL_HasEvents", intType, [0x400, 0x403]);
        t.equal(r.result, 0, "SDL_FlushEvent removes the queued mouse-button event");

        r = call("SDL_RegisterEvents", uintType, [2]);
        t.ok(r.ok, "SDL_RegisterEvents succeeds");
        t.ok(r.result >= 0x8000, "SDL_RegisterEvents returns a user-event type range");
    });


    await t.test("SDL2 direct browser keyboard bridge preserves scancodes, modifiers, repeats, and UTF-8 text", async t => {
        const display = { context: { canvas: {} }, mouseX: 0, mouseY: 0, buttons: 0 };
        const prim = makePrimitive([], display);
        const intType = makeTFBasicType(prim, "sint", 18);
        const pointerType = makeTFBasicType(prim, "pointer", 12);
        function call(name, returnType, args) {
            const fn = makeTFExternalFunction(prim, "libSDL2-2.0.so.0", name, returnType, args.map(() => pointerType));
            prim.vm.stack = [null, fn, makeArray(args)];
            prim.vm.sp = prim.vm.stack.length - 1;
            prim.success = true;
            const ok = prim.ffi_primitiveSameThreadCallout(2);
            return { ok, result: prim.vm.lastPushed };
        }

        let r = call("SDL_CreateWindow", pointerType, [makeString(prim, "Keyboard"), 0, 0, 64, 48, 4]);
        t.ok(r.ok, "SDL_CreateWindow succeeds");
        display.sdlEventQueue = [];
        const sdl = Squeak.externalModules["libSDL2-2.0"];
        sdl.keyboardState.fill(0);
        sdl.modState = 0;

        Squeak.FFIEmulation.enqueueSDLKeyDownFromBrowserEvent(display, { code: "KeyA", key: "A", shiftKey: true, ctrlKey: true, altKey: false, metaKey: false, repeat: true, timeStamp: 1234 });
        const eventAddress = prim.ffiMakeStExternalAddress();
        eventAddress.jsData = new ArrayBuffer(56);
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "SDL_PollEvent succeeds for direct keydown");
        t.equal(r.result, 1, "one direct keydown is queued");
        let view = new DataView(eventAddress.jsData);
        t.equal(view.getUint32(0, true), 0x300, "direct browser keydown becomes SDL_KEYDOWN");
        t.equal(view.getUint8(13), 1, "browser repeat flag is preserved");
        t.equal(view.getInt32(16, true), 4, "KeyboardEvent.code KeyA maps to SDL scancode A");
        t.equal(view.getInt32(20, true), 97, "SDL letter key symbol remains lowercase while text input carries case");
        t.equal(view.getUint16(24, true) & 0x00C3, 0x00C3, "Shift and Ctrl modifiers are preserved in SDL mod bits");
        t.equal(sdl.keyboardState[4], 1, "keyboard state marks scancode A pressed");

        Squeak.FFIEmulation.enqueueSDLTextInputFromBrowserEvent(display, "Á", 1235);
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "SDL_PollEvent succeeds for direct text input");
        view = new DataView(eventAddress.jsData);
        t.equal(view.getUint32(0, true), 0x303, "direct browser text becomes SDL_TEXTINPUT");
        t.equal(view.getUint8(12), 0xC3, "SDL_TEXTINPUT stores UTF-8 byte 1 for Á");
        t.equal(view.getUint8(13), 0x81, "SDL_TEXTINPUT stores UTF-8 byte 2 for Á");
        t.equal(view.getUint8(14), 0, "SDL_TEXTINPUT payload is NUL terminated");

        Squeak.FFIEmulation.enqueueSDLKeyUpFromBrowserEvent(display, { code: "KeyA", key: "A", shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, timeStamp: 1236 });
        t.equal(sdl.keyboardState[4], 0, "direct keyup clears scancode A state before polling");
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "SDL_PollEvent succeeds for direct keyup");
        view = new DataView(eventAddress.jsData);
        t.equal(view.getUint32(0, true), 0x301, "direct browser keyup becomes SDL_KEYUP");
        t.equal(view.getInt32(16, true), 4, "keyup keeps the physical SDL scancode");

        Squeak.FFIEmulation.enqueueSDLKeyDownFromBrowserEvent(display, { code: "ShiftLeft", key: "Shift", shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, repeat: false, timeStamp: 1237 });
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "SDL_PollEvent succeeds for modifier keydown");
        view = new DataView(eventAddress.jsData);
        t.equal(view.getUint32(0, true), 0x300, "modifier-only keydown is queued");
        t.equal(view.getInt32(16, true), 225, "ShiftLeft maps to SDL_SCANCODE_LSHIFT");
        t.equal(view.getInt32(20, true), 0x400000E1 | 0, "ShiftLeft maps to SDLK_LSHIFT");
        t.equal(sdl.keyboardState[225], 1, "keyboard state records modifier keys too");

        Squeak.FFIEmulation.enqueueSDLKeyDownFromBrowserEvent(display, { code: "ArrowLeft", key: "ArrowLeft", shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false, timeStamp: 1238 });
        r = call("SDL_PollEvent", intType, [eventAddress]);
        t.ok(r.ok, "SDL_PollEvent succeeds for arrow keydown");
        view = new DataView(eventAddress.jsData);
        t.equal(view.getInt32(16, true), 80, "ArrowLeft maps from DOM code to SDL_SCANCODE_LEFT");
        t.equal(view.getInt32(20, true), 0x40000050, "ArrowLeft maps to SDLK_LEFT");
    });

};
