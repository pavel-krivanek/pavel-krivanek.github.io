"use strict";
/*
 * Copyright (c) 2013-2025 Vanessa Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

Object.extend(Squeak,
"known classes", {
    // ExternalLibraryFunction layout:
    ExtLibFunc_handle: 0,
    ExtLibFunc_flags: 1,
    ExtLibFunc_argTypes: 2,
    ExtLibFunc_name: 3,
    ExtLibFunc_module: 4,
    ExtLibFunc_errorCodeName: 5,
},
"FFI error codes", {
    FFINoCalloutAvailable: -1, // No callout mechanism available
    FFIErrorGenericError: 0, // generic error
    FFIErrorNotFunction: 1, // primitive invoked without ExternalFunction
    FFIErrorBadArgs: 2, // bad arguments to primitive call
    FFIErrorBadArg: 3, // generic bad argument
    FFIErrorIntAsPointer: 4, // int passed as pointer
    FFIErrorBadAtomicType: 5, // bad atomic type (e.g., unknown)
    FFIErrorCoercionFailed: 6, // argument coercion failed
    FFIErrorWrongType: 7, // Type check for non-atomic types failed
    FFIErrorStructSize: 8, // struct size wrong or too large
    FFIErrorCallType: 9, // unsupported calling convention
    FFIErrorBadReturn: 10, // cannot return the given type
    FFIErrorBadAddress: 11, // bad function address
    FFIErrorNoModule: 12, // no module given but required for finding address
    FFIErrorAddressNotFound: 13, // function address not found
    FFIErrorAttemptToPassVoid: 14, // attempt to pass 'void' parameter
    FFIErrorModuleNotFound: 15, // module not found
    FFIErrorBadExternalLibrary: 16, // external library invalid
    FFIErrorBadExternalFunction: 17, // external function invalid
    FFIErrorInvalidPointer: 18, // ExternalAddress points to ST memory (don't you dare to do this!)
    FFIErrorCallFrameTooBig: 19, // Stack frame required more than 16k bytes to pass arguments.
},
"FFI types", {
    // type void
    FFITypeVoid: 0,
    // type bool
    FFITypeBool: 1,
    // basic integer types.
    // note: (integerType anyMask: 1) = integerType isSigned
    FFITypeUnsignedInt8: 2,
    FFITypeSignedInt8: 3,
    FFITypeUnsignedInt16: 4,
    FFITypeSignedInt16: 5,
    FFITypeUnsignedInt32: 6,
    FFITypeSignedInt32: 7,
    FFITypeUnsignedInt64: 8,
    FFITypeSignedInt64: 9,
    // original character types
    // note: isCharacterType ^type >> 1 >= 5 and: [(type >> 1) odd]
    FFITypeUnsignedChar8: 10,
    FFITypeSignedChar8: 11, // N.B. misnomer!
    // float types
    // note: isFloatType ^type >> 1 = 6
    FFITypeSingleFloat: 12,
    FFITypeDoubleFloat: 13,
    // new character types
    // note: isCharacterType ^type >> 1 >= 5 and: [(type >> 1) odd]
    FFITypeUnsignedChar16: 14,
    FFITypeUnsignedChar32: 15,
    // type flags
    FFIFlagAtomic: 0x40000, // type is atomic
    FFIFlagPointer: 0x20000, // type is pointer to base type (a.k.a. array)
    FFIFlagStructure: 0x10000, // baseType is structure of 64k length
    FFIFlagAtomicPointer: 0x60000, // baseType is atomic and pointer (array)
    FFIFlagMask: 0x70000, // mask for flags
    FFIStructSizeMask: 0xFFFF, // mask for max size of structure
    FFIAtomicTypeMask: 0x0F000000, // mask for atomic type spec
    FFIAtomicTypeShift: 24, // shift for atomic type
});

Object.extend(Squeak.Primitives.prototype,
'FFI', {
    // naming:
    //   - ffi_* for public methods of SqueakFFIPrims module
    //     (see vm.plugins.js)
    //   - other ffi* for private methods of this module
    //   - primitiveCalloutToFFI: old callout primitive (not in SqueakFFIPrims)
    ffi_lastError: 0,

    ffiModules: {}, // map library name to module name

    ffiFuncs: [], // functions loaded via dlsym (index + 1 is handle)

    ffiTraceCall: function(kind, moduleName, functionName, args) {
        var options = this.vm && this.vm.options;
        var enabled = (typeof process !== "undefined" && process.env && process.env.SQUEAKJS_TRACE_FFI) ||
            (options && options.traceFFI);
        if (!enabled) return;
        function describe(arg) {
            if (arg === null || arg === undefined) return String(arg);
            if (typeof arg === "number" || typeof arg === "boolean" || typeof arg === "bigint") return String(arg);
            if (typeof arg === "string") return JSON.stringify(arg.length > 80 ? arg.slice(0, 77) + "..." : arg);
            if (arg instanceof ArrayBuffer) return "ArrayBuffer(" + arg.byteLength + ")";
            if (ArrayBuffer.isView(arg)) return arg.constructor.name + "(" + arg.byteLength + ")";
            if (arg && arg.sdlKind) return "SDL:" + arg.sdlKind + "#" + (arg.id || "?");
            if (arg && arg.constructor && arg.constructor.name && arg.constructor.name !== "Object") return arg.constructor.name;
            return "Object";
        }
        var rendered = (args || []).map(describe).join(", ");
        console.log("FFI " + kind + ": " + (moduleName || "") + "::" + functionName + "(" + rendered + ")");
    },

    // create an external address as handle for a function dynamically
    // this is a hook for other modules equivalent to dlsym() in C.
    // Later we can retrieve the module and func by handle
    ffiLookupFunc: function(mod, funcName) {
        var modName = Object.keys(this.loadedModules).find(name => this.loadedModules[name] === mod)
            || Object.keys(Squeak.externalModules || {}).find(name => Squeak.externalModules[name] === mod);
        if (modName === undefined && mod && mod.getModuleName) modName = mod.getModuleName();
        var handle = this.ffiFuncs.findIndex(func => func.funcName === funcName && func.modName === modName) + 1;
        if (!handle) {
            if (!mod || typeof mod[funcName] !== "function") return 0;
            var libName = Object.keys(this.ffiModules).find(name => this.ffiModules[name] === modName) || modName || "libc";
            this.ffiFuncs.push({libName: libName, modName: modName, funcName: funcName});
            handle = this.ffiFuncs.length;
        }
        return handle;
    },

    ffiResolveModuleAndName: function(libName) {
        if (!libName) libName = "libc";
        if (this.ffiModules[libName]) {
            return { moduleName: this.ffiModules[libName], module: this.loadedModules[this.ffiModules[libName]] || Squeak.externalModules[this.ffiModules[libName]] };
        }
        var external = Squeak.externalModules || {},
            ffiEmulation = Squeak.FFIEmulation,
            modName = ffiEmulation && ffiEmulation.resolveLibraryName && ffiEmulation.resolveLibraryName(libName);
        if (modName === undefined || modName === null) {
            var prefixes = ["", "lib"],
                suffixes = ["", ".so", ".so.12", ".12", ".so.11", ".11", ".so.10", ".10", ".so.9", ".9", ".so.8", ".8", ".so.7", ".7", ".so.6", ".6", ".so.5", ".5", ".so.4", ".4", ".so.3", ".3", ".so.2", ".2", ".so.1", ".1", ".dylib", ".dll" ];
            if (external[libName]) modName = libName;
            if (modName === undefined || modName === null) {
                loop: for (var p = 0; p < prefixes.length; p++) {
                    var prefix = prefixes[p];
                    for (var s = 0; s < suffixes.length; s++) {
                        var suffix = suffixes[s];
                        if (external[prefix + libName + suffix]) { modName = prefix + libName + suffix; break loop; }
                        if (prefix && libName.startsWith(prefix) && external[libName.slice(prefix.length) + suffix]) { modName = libName.slice(prefix.length) + suffix; break loop; }
                        if (suffix && libName.endsWith(suffix) && external[prefix + libName.slice(0, -suffix.length)]) { modName = prefix + libName.slice(0, -suffix.length); break loop; }
                    }
                }
            }
        }
        if (modName === undefined || modName === null) modName = libName;
        this.ffiModules[libName] = modName;
        return { moduleName: modName, module: this.loadedModules[modName] || external[modName] };
    },

    ffiDoCallout: function(argCount, extLibFunc, stArgs) {
        this.ffi_lastError = Squeak.FFIErrorGenericError;
        var libName = extLibFunc.pointers[Squeak.ExtLibFunc_module].bytesAsString();
        var funcName = extLibFunc.pointers[Squeak.ExtLibFunc_name].bytesAsString();
        var funcAddr = extLibFunc.pointers[Squeak.ExtLibFunc_handle].wordsOrBytes()[0];
        var modName = this.ffiModules[libName];

        if (funcAddr) {
            // this func was looked up originally via ffiLookupFunc
            var func = this.ffiFuncs[funcAddr - 1];
            if (!func) throw Error("FFI: not a valid External Address: " + funcAddr);
            libName = func.libName;
            modName = func.modName;
            funcName = func.funcName;
        }

        if (!libName) libName = "libc"; // default to libc

        if (modName === undefined) {
            var resolved = this.ffiResolveModuleAndName(libName);
            modName = resolved.moduleName;
            if (modName && modName !== libName) console.log("FFI: found library " + libName + " as module " + modName);
        }

        var mod = this.loadedModules[modName];
        if (mod === undefined) { // null if earlier load failed
            mod = this.loadModule(modName);
            this.loadedModules[modName] = mod;
            if (!mod) {
                this.vm.warnOnce('FFI: library not found: ' + libName);
            }
        }
        if (!mod) {
            this.ffi_lastError = Squeak.FFIErrorModuleNotFound;
            return false;
        }
        // types[0] is return type, types[1] is first arg type, etc.
        var stTypes = extLibFunc.pointers[Squeak.ExtLibFunc_argTypes].pointers;
        var jsArgs = [];
        for (var i = 0; i < stArgs.length; i++) {
            jsArgs.push(this.ffiArgFromSt(stArgs[i], stTypes[i+1]));
        }
        this.ffiTraceCall("callout", libName, funcName, jsArgs);
        var jsResult, oldPrimitive = Squeak.FFIEmulation && Squeak.FFIEmulation.currentPrimitive;
        if (Squeak.FFIEmulation) Squeak.FFIEmulation.currentPrimitive = this;
        try {
            if (!(funcName in mod)) {
                if (this.vm.warnOnce('FFI: function not found: ' + libName + '::' + funcName)) {
                    console.warn(jsArgs);
                }
                if (mod.ffiFunctionNotFoundHandler) {
                    jsResult = mod.ffiFunctionNotFoundHandler(funcName, jsArgs);
                }
                if (jsResult === undefined) {
                    this.ffi_lastError = Squeak.FFIErrorAddressNotFound;
                    return false;
                }
            } else {
                jsResult = mod[funcName].apply(mod, jsArgs);
            }
        } finally {
            if (Squeak.FFIEmulation) Squeak.FFIEmulation.currentPrimitive = oldPrimitive || null;
        }
        var stResult = this.ffiResultToSt(jsResult, stTypes[0]);
        return this.popNandPushIfOK(argCount + 1, stResult);
    },
    ffiArgFromSt: function(stObj, stType) {
        var typeSpec = stType.pointers[0].words[0];
        switch (typeSpec & Squeak.FFIFlagMask) {
            case Squeak.FFIFlagAtomic:
                // single value
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    case Squeak.FFITypeVoid:
                        return null;
                    case Squeak.FFITypeBool:
                        if (stObj.isTrue) return true;
                        if (stObj.isFalse) return false;
                        if (typeof stObj === "number") return !!stObj;
                        if (stObj.isFloat || stObj.float !== undefined) return !!stObj.float;
                        throw Error("FFI: expected bool, got " + stObj);
                    case Squeak.FFITypeUnsignedInt8:
                    case Squeak.FFITypeSignedInt8:
                    case Squeak.FFITypeUnsignedInt16:
                    case Squeak.FFITypeSignedInt16:
                    case Squeak.FFITypeUnsignedInt32:
                    case Squeak.FFITypeSignedInt32:
                    case Squeak.FFITypeUnsignedInt64:
                    case Squeak.FFITypeSignedInt64:
                    case Squeak.FFITypeUnsignedChar8:
                    case Squeak.FFITypeSignedChar8:
                    case Squeak.FFITypeUnsignedChar16:
                    case Squeak.FFITypeUnsignedChar32:
                        // we ignore the signedness and size of the integer for now
                        if (typeof stObj === "number") return stObj;
                        if (stObj.isTrue) return 1;
                        if (stObj.isFalse) return 0;
                        throw Error("FFI: expected integer, got " + stObj);
                    case Squeak.FFITypeSingleFloat:
                    case Squeak.FFITypeDoubleFloat:
                        if (typeof stObj === "number") return stObj;
                        if (stObj.isFloat || stObj.float !== undefined) return stObj.float;
                        throw Error("FFI: expected float, got " + stObj);
                    default:
                        throw Error("FFI: unimplemented atomic arg type: " + atomicType);
                }
            case Squeak.FFIFlagAtomicPointer:
                // array of values
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    case Squeak.FFITypeUnsignedChar8:
                    case Squeak.FFITypeUnsignedInt8:
                        if (stObj.bytes) return stObj.bytes;
                        if (stObj.words) return stObj.wordsAsUint8Array();
                        if (stObj.isWordsOrBytes && this.interpreterProxy.isWordsOrBytes(stObj)) return new Uint8Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Uint8Array) return data;
                            if (data instanceof ArrayBuffer) return new Uint8Array(data);
                        }
                        throw Error("FFI: expected bytes, got " + stObj);
                    case Squeak.FFITypeUnsignedInt32:
                        if (stObj.words) return stObj.words;
                        if (stObj.isWords && this.interpreterProxy.isWords(stObj)) return new Uint32Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Uint32Array) return data;
                            if (data instanceof ArrayBuffer) return new Uint32Array(data);
                        }
                        throw Error("FFI: expected words, got " + stObj);
                    case Squeak.FFITypeSignedInt32:
                        if (stObj.words) return stObj.wordsAsInt32Array();
                        if (stObj.isWords && this.interpreterProxy.isWords(stObj)) return new Int32Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Int32Array) return data;
                            if (data instanceof ArrayBuffer) return new Int32Array(data);
                        }
                        throw Error("FFI: expected words, got " + stObj);
                    case Squeak.FFITypeSingleFloat:
                        if (stObj.words) return stObj.wordsAsFloat32Array();
                        if (stObj.isFloat) return new Float32Array([stObj.float]);
                        if (stObj.isWords && this.interpreterProxy.isWords(stObj)) return new Float32Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Float32Array) return data;
                            if (data instanceof ArrayBuffer) return new Float32Array(data);
                        }
                        throw Error("FFI: expected floats, got " + stObj);
                    case Squeak.FFITypeDoubleFloat:
                        if (stObj.words) return stObj.wordsAsFloat64Array();
                        if (stObj.isFloat) return new Float64Array([stObj.float]);
                        if (stObj.isWords && this.interpreterProxy.isWords(stObj)) return new Float64Array(0);
                        if (stObj.pointers && stObj.pointers[0].jsData) {
                            var data = stObj.pointers[0].jsData;
                            if (data instanceof Float64Array) return data;
                            if (data instanceof ArrayBuffer) return new Float64Array(data);
                        }
                        throw Error("FFI: expected floats, got " + stObj);
                    case Squeak.FFITypeVoid: // void* is passed as opaque pointer data
                        if (stObj.words) return stObj.words.buffer;
                        if (stObj.bytes) return stObj.bytes.buffer;
                        if (stObj.isNil || (stObj.isWordsOrBytes && this.interpreterProxy.isWordsOrBytes(stObj))) return null;
                        if (stObj.jsData !== undefined) return stObj.jsData;
                        if (stObj.pointers && stObj.pointers[0] && stObj.pointers[0].jsData !== undefined) return stObj.pointers[0].jsData;
                        throw Error("FFI: expected external data, words, or bytes, got " + stObj);
                    default:
                        throw Error("FFI: unimplemented atomic array arg type: " + atomicType);
                }
            default:
                throw Error("FFI: unimplemented arg type flags: " + typeSpec);
        }
    },
    ffiResultToSt: function(jsResult, stType) {
        var typeSpec = stType.pointers[0].words[0];
        switch (typeSpec & Squeak.FFIFlagMask) {
            case Squeak.FFIFlagAtomic:
                // single value
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    case Squeak.FFITypeVoid:
                        return this.vm.nilObj;
                    case Squeak.FFITypeBool:
                        return jsResult ? this.vm.trueObj : this.vm.falseObj;
                    case Squeak.FFITypeUnsignedInt8:
                    case Squeak.FFITypeSignedInt8:
                    case Squeak.FFITypeUnsignedInt16:
                    case Squeak.FFITypeSignedInt16:
                    case Squeak.FFITypeUnsignedInt32:
                    case Squeak.FFITypeSignedInt32:
                    case Squeak.FFITypeUnsignedInt64:
                    case Squeak.FFITypeSignedInt64:
                    case Squeak.FFITypeUnsignedChar8:
                    case Squeak.FFITypeSignedChar8:
                    case Squeak.FFITypeUnsignedChar16:
                    case Squeak.FFITypeUnsignedChar32:
                    case Squeak.FFITypeSingleFloat:
                    case Squeak.FFITypeDoubleFloat:
                        if (typeof jsResult !== "number") throw Error("FFI: expected number, got " + jsResult);
                        return this.makeStObject(jsResult);
                    default:
                        throw Error("FFI: unimplemented atomic return type: " + atomicType);
                }
            case Squeak.FFIFlagAtomicPointer:
                // array of values
                if (!jsResult) return this.vm.nilObj;
                var atomicType = (typeSpec & Squeak.FFIAtomicTypeMask) >> Squeak.FFIAtomicTypeShift;
                switch (atomicType) {
                    // char* is returned as string
                    case Squeak.FFITypeSignedChar8:
                    case Squeak.FFITypeUnsignedChar8:
                        if (typeof jsResult === "string") return this.makeStString(jsResult);
                        else return this.makeStStringFromBytes(jsResult, true);
                    // all other arrays are returned as ExternalData
                    default:
                        return this.ffiMakeStExternalData(jsResult, stType);
                }
            default:
                throw Error("FFI: unimplemented return type flags: " + typeSpec);
        }
    },
    ffiNextExtAddr: 0, // fake addresses for ExternalAddress objects
    ffiMakeStExternalAddress: function(handle) {
        var size = (this.vm.image && this.vm.image.bytesPerWord) || 4;
        var extAddr = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassExternalAddress], size);
        var value = (handle === undefined || handle === null) ? ++this.ffiNextExtAddr : handle;
        new (Uint32Array)(extAddr.bytes.buffer)[0] = value >>> 0;
        return extAddr;
    },
    ffiMakeStExternalData: function(jsData, stType) {
        var extAddr = this.ffiMakeStExternalAddress();
        extAddr.jsData = jsData; // save for later
        var extData = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassExternalData], 0);
        extData.pointers[0] = extAddr;
        extData.pointers[1] = stType;
        return extData;
    },
    ffiDataFromStack: function(arg) {
        var oop = this.stackNonInteger(arg);
        if (oop.jsData !== undefined) return oop.jsData;
        if (oop.bytes) return oop.bytes;
        if (oop.words) return oop.words;
        this.vm.warnOnce("FFI: expected ExternalAddress with jsData, got " + oop);
        this.success = false;
    },
    ffiDataViewOn: function(data) {
        if (data instanceof ArrayBuffer) return new DataView(data);
        if (ArrayBuffer.isView(data)) return new DataView(data.buffer, data.byteOffset || 0, data.byteLength);
        return null;
    },
    ffiIntegralFromSt: function(stObj) {
        if (typeof stObj === "number") return BigInt(stObj);
        return this.bigIntFromObject(stObj);
    },

    ffiTFTypeCodeOf: function(tfType) {
        if (!tfType || !tfType.pointers || tfType.pointers.length < 3) return null;
        var code = tfType.pointers[2];
        return typeof code === "number" ? code : null;
    },
    ffiTFTypeSizeForCode: function(code) {
        switch (code) {
            case 1: return 0;  // void
            case 2: return 4;  // float
            case 3: return 8;  // double
            case 4: case 8: case 13: case 14: return 1;
            case 5: case 9: case 15: case 16: return 2;
            case 6: case 10: case 17: case 18: return 4;
            case 7: case 11: case 12: case 19: case 20: return (this.vm.image && this.vm.image.bytesPerWord) || 8;
            default: return null;
        }
    },
    ffi_primitiveFillBasicType: function(argCount) {
        if (argCount !== 0) return false;
        var type = this.vm.stackValue(0), code = this.ffiTFTypeCodeOf(type), size = this.ffiTFTypeSizeForCode(code);
        if (size === null) return false;
        // TFBasicType layout: handle, typeName, typeCode, byteSize.
        // The native primitive installs an opaque libffi type handle; for the
        // JS emulation a stable ExternalAddress-like handle with jsData is enough.
        if (!type.pointers[0] || type.pointers[0].isNil) {
            var handle = this.ffiMakeStExternalAddress();
            handle.jsData = { tfTypeCode: code, byteSize: size };
            type.pointers[0] = handle;
        }
        type.pointers[3] = size;
        return true;
    },
    ffi_primitiveTypeByteSize: function(argCount) {
        if (argCount !== 0) return false;
        var type = this.vm.stackValue(0), code = this.ffiTFTypeCodeOf(type), size = this.ffiTFTypeSizeForCode(code);
        if (size === null) return false;
        return this.popNandPushIfOK(argCount + 1, size);
    },


    ffiStringFromSt: function(obj) {
        if (!obj || obj.isNil) return "";
        if (typeof obj === "string") return obj;
        if (obj.bytesAsString) return obj.bytesAsString();
        if (obj.bytes) return Array.from(obj.bytes, function(b) { return String.fromCharCode(b); }).join("");
        return String(obj);
    },
    ffiTFDataFromExternalAddress: function(obj) {
        if (!obj || obj.isNil) return null;
        if (obj.jsData !== undefined) return obj.jsData;
        if (obj.pointers && obj.pointers[0]) return this.ffiTFDataFromExternalAddress(obj.pointers[0]);
        if (obj.bytes) {
            var words = obj.wordsOrBytes && obj.wordsOrBytes();
            if (words && words.length) {
                if (this.ffiOopAddressMap && this.ffiOopAddressMap[words[0]])
                    return this.ffiOopAddressMap[words[0]];
                if (this.ffiAddressDataMap && this.ffiAddressDataMap[words[0]])
                    return this.ffiAddressDataMap[words[0]];
            }
            return obj.bytes;
        }
        if (obj.words) return obj.words;
        return obj;
    },
    ffiTFArgToJS: function(obj) {
        if (!obj || obj.isNil) return null;
        if (typeof obj === "number") return obj;
        if (obj.isTrue) return true;
        if (obj.isFalse) return false;
        if (obj.isFloat || obj.float !== undefined) return obj.float;
        if (obj.jsData !== undefined || obj.bytes || obj.words || obj.pointers) return this.ffiTFDataFromExternalAddress(obj);
        return obj;
    },
    ffiTFReturnTypeOfFunction: function(tfFunction) {
        var definition = tfFunction && tfFunction.pointers && tfFunction.pointers[1];
        return definition && definition.pointers && definition.pointers[2];
    },
    ffiTFResultToSt: function(jsResult, returnType) {
        var code = this.ffiTFTypeCodeOf(returnType);
        switch (code) {
            case 1: return this.vm.nilObj;
            case 2: case 3:
                return this.makeStObject(Number(jsResult || 0));
            case 12:
                if (!jsResult) return this.ffiMakeStExternalAddress(0);
                var pointerAddress = this.ffiMakeStExternalAddress();
                pointerAddress.jsData = jsResult;
                return pointerAddress;
            default:
                if (typeof jsResult === "bigint") return this.objectFromBigInt(jsResult);
                if (typeof jsResult === "boolean") return jsResult ? this.vm.trueObj : this.vm.falseObj;
                if (typeof jsResult === "number") return this.makeStObject(jsResult);
                if (typeof jsResult === "string") return this.makeStString(jsResult);
                if (jsResult === null || jsResult === undefined) return this.vm.nilObj;
                var externalAddress = this.ffiMakeStExternalAddress();
                externalAddress.jsData = jsResult;
                return externalAddress;
        }
    },
    ffi_primitiveSameThreadCallout: function(argCount) {
        if (argCount !== 2) return false;
        var tfFunction = this.vm.stackValue(1), argsObj = this.vm.stackValue(0);
        if (!tfFunction || !tfFunction.pointers) return false;
        var functionName = this.ffiStringFromSt(tfFunction.pointers[2]),
            moduleName = this.ffiStringFromSt(tfFunction.pointers[3]) || "libc",
            modInfo = this.ffiResolveModuleAndName ? this.ffiResolveModuleAndName(moduleName) : { moduleName: moduleName, module: this.loadedModules[moduleName] || Squeak.externalModules[moduleName] },
            mod = modInfo && modInfo.module;
        if (!mod && modInfo && modInfo.moduleName) {
            mod = this.loadModule(modInfo.moduleName);
            this.loadedModules[modInfo.moduleName] = mod;
        }
        if (!mod || typeof mod[functionName] !== "function") {
            this.ffi_lastError = Squeak.FFIErrorAddressNotFound;
            return false;
        }
        var stArgs = argsObj && argsObj.pointers ? argsObj.pointers : [], jsArgs = [];
        for (var i = 0; i < stArgs.length; i++) jsArgs.push(this.ffiTFArgToJS(stArgs[i]));
        this.ffiTraceCall("same-thread", modInfo && modInfo.moduleName || moduleName, functionName, jsArgs);
        var jsResult, oldPrimitive = Squeak.FFIEmulation && Squeak.FFIEmulation.currentPrimitive;
        if (Squeak.FFIEmulation) Squeak.FFIEmulation.currentPrimitive = this;
        try {
            jsResult = mod[functionName].apply(mod, jsArgs);
        } finally {
            if (Squeak.FFIEmulation) Squeak.FFIEmulation.currentPrimitive = oldPrimitive || null;
        }
        var stResult = this.ffiTFResultToSt(jsResult, this.ffiTFReturnTypeOfFunction(tfFunction));
        return this.popNandPushIfOK(argCount + 1, stResult);
    },
    ffi_primitiveDefineFunction: function(argCount) {
        if (argCount !== 2 && argCount !== 3) return false;
        var definition = this.vm.stackValue(argCount),
            paramHandlers = this.vm.stackValue(argCount - 1),
            returnHandle = this.vm.stackValue(argCount - 2),
            abi = argCount === 3 ? this.vm.stackValue(0) : null;
        if (!definition || !definition.pointers) return false;
        var handle = this.ffiMakeStExternalAddress();
        handle.jsData = {
            tfFunctionDefinition: true,
            parameterHandlers: paramHandlers && paramHandlers.pointers ? paramHandlers.pointers.slice() : [],
            returnHandle: returnHandle,
            abi: abi
        };
        definition.pointers[0] = handle;
        return this.popNIfOK(argCount);
    },
    ffi_primitiveFreeDefinition: function(argCount) {
        return this.popNIfOK(argCount);
    },
    ffi_primitiveGetSameThreadRunnerAddress: function(argCount) {
        if (argCount !== 0) return false;
        var address = this.ffiMakeStExternalAddress();
        address.jsData = { tfRunner: "sameThread" };
        return this.popNandPushIfOK(argCount + 1, address);
    },
    ffi_primitiveGetAddressOfOOP: function(argCount) {
        if (argCount !== 1) return false;
        var obj = this.vm.stackValue(0), handle = ++this.ffiNextExtAddr;
        if (!this.ffiOopAddressMap) this.ffiOopAddressMap = {};
        this.ffiOopAddressMap[handle] = obj && obj.bytes ? obj.bytes : obj;
        return this.popNandPushIfOK(argCount + 1, handle);
    },
    ffiExternalAddressDataView: function(extAddr) {
        var data = extAddr && extAddr.jsData !== undefined ? extAddr.jsData : this.ffiTFDataFromExternalAddress(extAddr);
        return this.ffiDataViewOn(data);
    },
    ffiExternalAddressIntegerAtOffset: function(extAddr, byteOffset, byteSize, isSigned) {
        var view = this.ffiExternalAddressDataView(extAddr);
        if (!view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return null;
        switch (byteSize) {
            case 1: return isSigned ? BigInt(view.getInt8(byteOffset)) : BigInt(view.getUint8(byteOffset));
            case 2: return isSigned ? BigInt(view.getInt16(byteOffset, true)) : BigInt(view.getUint16(byteOffset, true));
            case 4: return isSigned ? BigInt(view.getInt32(byteOffset, true)) : BigInt(view.getUint32(byteOffset, true));
            case 8: return isSigned ? view.getBigInt64(byteOffset, true) : view.getBigUint64(byteOffset, true);
            default: return null;
        }
    },
    primitiveExternalAddressIntegerAtOffset: function(argCount, byteSize, isSigned) {
        if (argCount !== 1) return false;
        var extAddr = this.stackNonInteger(1), byteOffset = this.stackInteger(0);
        if (!this.success) return false;
        var value = this.ffiExternalAddressIntegerAtOffset(extAddr, byteOffset, byteSize, isSigned);
        if (value === null) return false;
        return this.popNandPushIfOK(argCount + 1, this.objectFromBigInt(value));
    },
    primitiveExternalAddressIntegerAtOffsetPut: function(argCount, byteSize, isSigned) {
        if (argCount !== 2) return false;
        var extAddr = this.stackNonInteger(2), byteOffset = this.stackInteger(1), valueOop = this.vm.stackValue(0);
        if (!this.success) return false;
        var value = this.ffiIntegralFromSt(valueOop), view = this.ffiExternalAddressDataView(extAddr);
        if (!this.success || !view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        function inRange(v, lo, hi) { return v >= lo && v <= hi; }
        switch (byteSize) {
            case 1:
                if (!inRange(value, isSigned ? -128n : 0n, isSigned ? 127n : 255n)) return false;
                isSigned ? view.setInt8(byteOffset, Number(value)) : view.setUint8(byteOffset, Number(value));
                break;
            case 2:
                if (!inRange(value, isSigned ? -32768n : 0n, isSigned ? 32767n : 65535n)) return false;
                isSigned ? view.setInt16(byteOffset, Number(value), true) : view.setUint16(byteOffset, Number(value), true);
                break;
            case 4:
                if (!inRange(value, isSigned ? -2147483648n : 0n, isSigned ? 2147483647n : 4294967295n)) return false;
                isSigned ? view.setInt32(byteOffset, Number(value), true) : view.setUint32(byteOffset, Number(value), true);
                break;
            case 8:
                if (!inRange(value, isSigned ? -(1n << 63n) : 0n, isSigned ? (1n << 63n) - 1n : (1n << 64n) - 1n)) return false;
                isSigned ? view.setBigInt64(byteOffset, value, true) : view.setBigUint64(byteOffset, value, true);
                break;
            default: return false;
        }
        return this.popNandPushIfOK(argCount + 1, valueOop);
    },
    primitiveExternalAddressBooleanAtOffset: function(argCount) {
        if (argCount !== 1) return false;
        var extAddr = this.stackNonInteger(1), byteOffset = this.stackInteger(0);
        if (!this.success) return false;
        var value = this.ffiExternalAddressIntegerAtOffset(extAddr, byteOffset, 1, false);
        if (value === null) return false;
        return this.popNandPushIfOK(argCount + 1, value !== 0n ? this.vm.trueObj : this.vm.falseObj);
    },
    primitiveExternalAddressBooleanAtOffsetPut: function(argCount) {
        if (argCount !== 2) return false;
        var bool = this.stackBoolean(0);
        if (!this.success) return false;
        (this.vm.stackTopPut ? this.vm.stackTopPut(bool ? 1 : 0) : (this.vm.stack[this.vm.sp] = bool ? 1 : 0));
        return this.primitiveExternalAddressIntegerAtOffsetPut(argCount, 1, false);
    },
    primitiveExternalAddressFloatAtOffset: function(argCount, byteSize) {
        if (argCount !== 1) return false;
        var extAddr = this.stackNonInteger(1), byteOffset = this.stackInteger(0);
        if (!this.success) return false;
        var view = this.ffiExternalAddressDataView(extAddr);
        if (!view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        var value = byteSize === 4 ? view.getFloat32(byteOffset, true) : view.getFloat64(byteOffset, true);
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(value));
    },
    primitiveExternalAddressFloatAtOffsetPut: function(argCount, byteSize) {
        if (argCount !== 2) return false;
        var extAddr = this.stackNonInteger(2), byteOffset = this.stackInteger(1), valueOop = this.vm.stackValue(0),
            value = valueOop && valueOop.float !== undefined ? valueOop.float : valueOop;
        if (!this.success || typeof value !== "number") return false;
        var view = this.ffiExternalAddressDataView(extAddr);
        if (!view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        byteSize === 4 ? view.setFloat32(byteOffset, value, true) : view.setFloat64(byteOffset, value, true);
        return this.popNandPushIfOK(argCount + 1, valueOop);
    },
    primitiveExternalAddressPointerAtOffset: function(argCount) {
        if (argCount !== 1) return false;
        var extAddr = this.stackNonInteger(1), byteOffset = this.stackInteger(0), size = (this.vm.image && this.vm.image.bytesPerWord) || 4;
        if (!this.success) return false;
        var value = this.ffiExternalAddressIntegerAtOffset(extAddr, byteOffset, size, false);
        if (value === null) return false;
        return this.popNandPushIfOK(argCount + 1, this.ffiMakeStExternalAddress(Number(value & 0xFFFFFFFFn)));
    },
    primitiveExternalAddressPointerAtOffsetPut: function(argCount) {
        if (argCount !== 2) return false;
        var extAddr = this.stackNonInteger(2), byteOffset = this.stackInteger(1), valueAddr = this.stackNonInteger(0), size = (this.vm.image && this.vm.image.bytesPerWord) || 4;
        if (!this.success || !valueAddr || !valueAddr.wordsOrBytes) return false;
        var words = valueAddr.wordsOrBytes(), value = 0n;
        if (words && words.length) {
            value = BigInt(words[0] >>> 0);
        } else if (valueAddr.jsData && typeof valueAddr.jsData.handle === "number") {
            value = BigInt(valueAddr.jsData.handle >>> 0);
        } else if (valueAddr.jsData && typeof valueAddr.jsData.address === "number") {
            value = BigInt(valueAddr.jsData.address >>> 0);
        } else if (valueAddr.jsData !== undefined) {
            // Opaque JavaScript-backed pointers have no raw Smalltalk bytes.  Store
            // a stable non-zero handle when available, otherwise conservatively
            // store null instead of crashing the VM.
            value = 0n;
        }
        (this.vm.stackTopPut ? this.vm.stackTopPut(this.objectFromBigInt(value)) : (this.vm.stack[this.vm.sp] = this.objectFromBigInt(value)));
        return this.primitiveExternalAddressIntegerAtOffsetPut(argCount, size, false);
    },
    ffiByteArrayDataView: function(byteObj) {
        if (!byteObj || !byteObj.bytes) return null;
        return new DataView(byteObj.bytes.buffer, byteObj.bytes.byteOffset || 0, byteObj.bytes.byteLength);
    },
    primitiveByteArrayBooleanAtOffset: function(argCount) {
        if (argCount !== 1) return false;
        var bytes = this.stackNonInteger(1), byteOffset = this.stackInteger(0);
        if (!this.success) return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset >= view.byteLength) return false;
        return this.popNandPushIfOK(argCount + 1, view.getUint8(byteOffset) ? this.vm.trueObj : this.vm.falseObj);
    },
    primitiveByteArrayIntegerAtOffset: function(argCount, byteSize, isSigned) {
        if (argCount !== 1) return false;
        var bytes = this.stackNonInteger(1), byteOffset = this.stackInteger(0);
        if (!this.success) return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        var value;
        switch (byteSize) {
            case 1: value = isSigned ? BigInt(view.getInt8(byteOffset)) : BigInt(view.getUint8(byteOffset)); break;
            case 2: value = isSigned ? BigInt(view.getInt16(byteOffset, true)) : BigInt(view.getUint16(byteOffset, true)); break;
            case 4: value = isSigned ? BigInt(view.getInt32(byteOffset, true)) : BigInt(view.getUint32(byteOffset, true)); break;
            case 8: value = isSigned ? view.getBigInt64(byteOffset, true) : view.getBigUint64(byteOffset, true); break;
            default: return false;
        }
        return this.popNandPushIfOK(argCount + 1, this.objectFromBigInt(value));
    },
    primitiveByteArrayPointerAtOffset: function(argCount) {
        if (argCount !== 1) return false;
        var bytes = this.stackNonInteger(1), byteOffset = this.stackInteger(0), size = (this.vm.image && this.vm.image.bytesPerWord) || 4;
        if (!this.success) return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + size > view.byteLength) return false;
        var value = size === 8 ? Number(view.getBigUint64(byteOffset, true) & 0xFFFFFFFFn) : view.getUint32(byteOffset, true);
        var extAddr = this.ffiMakeStExternalAddress(value >>> 0);
        if (this.ffiAddressDataMap && this.ffiAddressDataMap[value >>> 0]) extAddr.jsData = this.ffiAddressDataMap[value >>> 0];
        return this.popNandPushIfOK(argCount + 1, extAddr);
    },
    primitiveByteArrayFloatAtOffset: function(argCount, byteSize) {
        if (argCount !== 1) return false;
        var bytes = this.stackNonInteger(1), byteOffset = this.stackInteger(0);
        if (!this.success) return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        var value = byteSize === 4 ? view.getFloat32(byteOffset, true) : view.getFloat64(byteOffset, true);
        return this.popNandPushIfOK(argCount + 1, this.makeFloat(value));
    },
    primitiveByteArrayBooleanAtOffsetPut: function(argCount) {
        if (argCount !== 2) return false;
        var bool = this.stackBoolean(0);
        if (!this.success) return false;
        (this.vm.stackTopPut ? this.vm.stackTopPut(bool ? 1 : 0) : (this.vm.stack[this.vm.sp] = bool ? 1 : 0));
        return this.primitiveByteArrayIntegerAtOffsetPut(argCount, 1, false);
    },
    primitiveByteArrayIntegerAtOffsetPut: function(argCount, byteSize, isSigned) {
        if (argCount !== 2) return false;
        var bytes = this.stackNonInteger(2), byteOffset = this.stackInteger(1), valueOop = this.vm.stackValue(0);
        if (!this.success) return false;
        var value = this.ffiIntegralFromSt(valueOop), view = this.ffiByteArrayDataView(bytes);
        if (!this.success || !view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        function inRange(v, lo, hi) { return v >= lo && v <= hi; }
        switch (byteSize) {
            case 1:
                if (!inRange(value, isSigned ? -128n : 0n, isSigned ? 127n : 255n)) return false;
                isSigned ? view.setInt8(byteOffset, Number(value)) : view.setUint8(byteOffset, Number(value));
                break;
            case 2:
                if (!inRange(value, isSigned ? -32768n : 0n, isSigned ? 32767n : 65535n)) return false;
                isSigned ? view.setInt16(byteOffset, Number(value), true) : view.setUint16(byteOffset, Number(value), true);
                break;
            case 4:
                if (!inRange(value, isSigned ? -2147483648n : 0n, isSigned ? 2147483647n : 4294967295n)) return false;
                isSigned ? view.setInt32(byteOffset, Number(value), true) : view.setUint32(byteOffset, Number(value), true);
                break;
            case 8:
                if (!inRange(value, isSigned ? -(1n << 63n) : 0n, isSigned ? (1n << 63n) - 1n : (1n << 64n) - 1n)) return false;
                isSigned ? view.setBigInt64(byteOffset, value, true) : view.setBigUint64(byteOffset, value, true);
                break;
            default: return false;
        }
        return this.popNandPushIfOK(argCount + 1, valueOop);
    },
    primitiveByteArrayPointerAtOffsetPut: function(argCount) {
        if (argCount !== 2) return false;
        var bytes = this.stackNonInteger(2), byteOffset = this.stackInteger(1), valueAddr = this.stackNonInteger(0), size = (this.vm.image && this.vm.image.bytesPerWord) || 4;
        if (!this.success || !valueAddr || !valueAddr.wordsOrBytes) return false;
        var words = valueAddr.wordsOrBytes(), value = words && words.length ? (words[0] >>> 0) : 0;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + size > view.byteLength) return false;
        if (size === 8) view.setBigUint64(byteOffset, BigInt(value), true);
        else view.setUint32(byteOffset, value, true);
        return this.popNandPushIfOK(argCount + 1, valueAddr);
    },
    primitiveByteArrayFloatAtOffsetPut: function(argCount, byteSize) {
        if (argCount !== 2) return false;
        var bytes = this.stackNonInteger(2), byteOffset = this.stackInteger(1), valueOop = this.vm.stackValue(0), value = valueOop.isFloat ? valueOop.float : valueOop;
        if (!this.success || typeof value !== "number") return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        byteSize === 4 ? view.setFloat32(byteOffset, value, true) : view.setFloat64(byteOffset, value, true);
        return this.popNandPushIfOK(argCount + 1, valueOop);
    },
    ffiByteArrayDataView: function(byteObj) {
        if (!byteObj || !byteObj.bytes) return null;
        return new DataView(byteObj.bytes.buffer, byteObj.bytes.byteOffset || 0, byteObj.bytes.byteLength);
    },
    primitiveByteArrayBooleanAtOffset: function(argCount) {
        if (argCount !== 1) return false;
        var bytes = this.stackNonInteger(1), byteOffset = this.stackInteger(0);
        if (!this.success) return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset >= view.byteLength) return false;
        return this.popNandPushIfOK(argCount + 1, view.getUint8(byteOffset) ? this.vm.trueObj : this.vm.falseObj);
    },
    primitiveByteArrayIntegerAtOffset: function(argCount, byteSize, isSigned) {
        if (argCount !== 1) return false;
        var bytes = this.stackNonInteger(1), byteOffset = this.stackInteger(0);
        if (!this.success) return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        var value;
        switch (byteSize) {
            case 1: value = isSigned ? BigInt(view.getInt8(byteOffset)) : BigInt(view.getUint8(byteOffset)); break;
            case 2: value = isSigned ? BigInt(view.getInt16(byteOffset, true)) : BigInt(view.getUint16(byteOffset, true)); break;
            case 4: value = isSigned ? BigInt(view.getInt32(byteOffset, true)) : BigInt(view.getUint32(byteOffset, true)); break;
            case 8: value = isSigned ? view.getBigInt64(byteOffset, true) : view.getBigUint64(byteOffset, true); break;
            default: return false;
        }
        return this.popNandPushIfOK(argCount + 1, this.objectFromBigInt(value));
    },
    primitiveByteArrayPointerAtOffset: function(argCount) {
        if (argCount !== 1) return false;
        var bytes = this.stackNonInteger(1), byteOffset = this.stackInteger(0), size = (this.vm.image && this.vm.image.bytesPerWord) || 4;
        if (!this.success) return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + size > view.byteLength) return false;
        var value = size === 8 ? Number(view.getBigUint64(byteOffset, true) & 0xFFFFFFFFn) : view.getUint32(byteOffset, true);
        var extAddr = this.ffiMakeStExternalAddress(value >>> 0);
        if (this.ffiAddressDataMap && this.ffiAddressDataMap[value >>> 0]) extAddr.jsData = this.ffiAddressDataMap[value >>> 0];
        return this.popNandPushIfOK(argCount + 1, extAddr);
    },
    primitiveByteArrayFloatAtOffset: function(argCount, byteSize) {
        if (argCount !== 1) return false;
        var bytes = this.stackNonInteger(1), byteOffset = this.stackInteger(0);
        if (!this.success) return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        var value = byteSize === 4 ? view.getFloat32(byteOffset, true) : view.getFloat64(byteOffset, true);
        return this.popNandPushIfOK(argCount + 1, this.makeFloat(value));
    },
    primitiveByteArrayBooleanAtOffsetPut: function(argCount) {
        if (argCount !== 2) return false;
        var bool = this.stackBoolean(0);
        if (!this.success) return false;
        (this.vm.stackTopPut ? this.vm.stackTopPut(bool ? 1 : 0) : (this.vm.stack[this.vm.sp] = bool ? 1 : 0));
        return this.primitiveByteArrayIntegerAtOffsetPut(argCount, 1, false);
    },
    primitiveByteArrayIntegerAtOffsetPut: function(argCount, byteSize, isSigned) {
        if (argCount !== 2) return false;
        var bytes = this.stackNonInteger(2), byteOffset = this.stackInteger(1), valueOop = this.vm.stackValue(0);
        if (!this.success) return false;
        var value = this.ffiIntegralFromSt(valueOop), view = this.ffiByteArrayDataView(bytes);
        if (!this.success || !view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        function inRange(v, lo, hi) { return v >= lo && v <= hi; }
        switch (byteSize) {
            case 1:
                if (!inRange(value, isSigned ? -128n : 0n, isSigned ? 127n : 255n)) return false;
                isSigned ? view.setInt8(byteOffset, Number(value)) : view.setUint8(byteOffset, Number(value));
                break;
            case 2:
                if (!inRange(value, isSigned ? -32768n : 0n, isSigned ? 32767n : 65535n)) return false;
                isSigned ? view.setInt16(byteOffset, Number(value), true) : view.setUint16(byteOffset, Number(value), true);
                break;
            case 4:
                if (!inRange(value, isSigned ? -2147483648n : 0n, isSigned ? 2147483647n : 4294967295n)) return false;
                isSigned ? view.setInt32(byteOffset, Number(value), true) : view.setUint32(byteOffset, Number(value), true);
                break;
            case 8:
                if (!inRange(value, isSigned ? -(1n << 63n) : 0n, isSigned ? (1n << 63n) - 1n : (1n << 64n) - 1n)) return false;
                isSigned ? view.setBigInt64(byteOffset, value, true) : view.setBigUint64(byteOffset, value, true);
                break;
            default: return false;
        }
        return this.popNandPushIfOK(argCount + 1, valueOop);
    },
    primitiveByteArrayPointerAtOffsetPut: function(argCount) {
        if (argCount !== 2) return false;
        var bytes = this.stackNonInteger(2), byteOffset = this.stackInteger(1), valueAddr = this.stackNonInteger(0), size = (this.vm.image && this.vm.image.bytesPerWord) || 4;
        if (!this.success || !valueAddr || !valueAddr.wordsOrBytes) return false;
        var words = valueAddr.wordsOrBytes(), value = words && words.length ? (words[0] >>> 0) : 0;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + size > view.byteLength) return false;
        if (size === 8) view.setBigUint64(byteOffset, BigInt(value), true);
        else view.setUint32(byteOffset, value, true);
        return this.popNandPushIfOK(argCount + 1, valueAddr);
    },
    primitiveByteArrayFloatAtOffsetPut: function(argCount, byteSize) {
        if (argCount !== 2) return false;
        var bytes = this.stackNonInteger(2), byteOffset = this.stackInteger(1), valueOop = this.vm.stackValue(0), value = valueOop.isFloat ? valueOop.float : valueOop;
        if (!this.success || typeof value !== "number") return false;
        var view = this.ffiByteArrayDataView(bytes);
        if (!view || byteOffset < 0 || byteOffset + byteSize > view.byteLength) return false;
        byteSize === 4 ? view.setFloat32(byteOffset, value, true) : view.setFloat64(byteOffset, value, true);
        return this.popNandPushIfOK(argCount + 1, valueOop);
    },
    ffi_primitiveStoreUInt8IntoExternalAddress: function(argCount) {
        return this.primitiveExternalAddressIntegerAtOffsetPut(argCount, 1, false);
    },
    ffi_primitiveFFIAllocate: function(argCount) {
        var size = this.stackInteger(0);
        if (!this.success) return false;
        var extAddr = this.ffiMakeStExternalAddress();
        extAddr.jsData = new ArrayBuffer(size);
        var words = extAddr.wordsOrBytes && extAddr.wordsOrBytes();
        if (words && words.length) {
            if (!this.ffiAddressDataMap) this.ffiAddressDataMap = {};
            this.ffiAddressDataMap[words[0] >>> 0] = extAddr.jsData;
        }
        return this.popNandPushIfOK(argCount + 1, extAddr);
    },
    ffi_primitiveFFIFree: function(argCount) {
        var extAddr = this.stackNonInteger(0);
        if (!this.success) return false;
        if (extAddr.jsData === undefined) {
            this.vm.warnOnce("primitiveFFIFree: expected ExternalAddress with jsData, got " + extAddr);
            return false;
        }
        var words = extAddr.wordsOrBytes && extAddr.wordsOrBytes();
        if (words && words.length && this.ffiAddressDataMap) delete this.ffiAddressDataMap[words[0] >>> 0];
        delete extAddr.jsData;
        return this.popNIfOK(argCount);
    },
    ffi_primitiveInitilizeCallbacks: function(argCount) {
        // Pharo's VM-side primitive is intentionally misspelled as
        // primitiveInitilizeCallbacks.  The minimal emulation records the
        // semaphore index and succeeds; actual callback invocation is deferred.
        var semaphoreIndex = this.stackInteger(0);
        if (!this.success) return false;
        this.ffi_callbackSemaphoreIndex = semaphoreIndex;
        return this.popNIfOK(argCount);
    },
    ffi_primitiveInitializeCallbacks: function(argCount) {
        return this.ffi_primitiveInitilizeCallbacks(argCount);
    },
    primitiveCalloutToFFI: function(argCount, method) {
        var extLibFunc = method.pointers[1];
        if (!this.isKindOf(extLibFunc, Squeak.splOb_ClassExternalFunction)) return false;
        var args = [];
        for (var i = argCount - 1; i >= 0; i--)
            args.push(this.vm.stackValue(i));
        return this.ffiDoCallout(argCount, extLibFunc, args);
    },
    ffi_primitiveCalloutWithArgs: function(argCount) {
        var extLibFunc = this.stackNonInteger(1),
            argsObj = this.stackNonInteger(0);
        if (!this.isKindOf(extLibFunc, Squeak.splOb_ClassExternalFunction)) return false;
        return this.ffiDoCallout(argCount, extLibFunc, argsObj.pointers);
    },
    ffi_primitiveFFIGetLastError: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, this.ffi_lastError);
    },
    ffi_primitiveFFIIntegerAt: function(argCount) {
        var data = this.ffiDataFromStack(3),
            byteOffset = this.stackInteger(2),
            byteSize = this.stackInteger(1),
            isSigned = this.stackBoolean(0);
        if (!this.success) return false;
        byteOffset--; // 1-based byte indexing
        if (byteOffset < 0 || byteSize < 1 || byteSize > 8 ||
            (byteSize & (byteSize - 1)) !== 0) return false;
        if (typeof data === "string") {
            if (byteSize !== 1) return false;
            var charCode = byteOffset < data.length ? data.charCodeAt(byteOffset) & 255 : 0;
            return this.popNandPushIfOK(argCount + 1, charCode);
        }
        var view = this.ffiDataViewOn(data);
        if (!view || byteOffset + byteSize > view.byteLength) return false;
        var result;
        switch (byteSize) {
            case 1: result = isSigned ? BigInt(view.getInt8(byteOffset)) : BigInt(view.getUint8(byteOffset)); break;
            case 2: result = isSigned ? BigInt(view.getInt16(byteOffset, true)) : BigInt(view.getUint16(byteOffset, true)); break;
            case 4: result = isSigned ? BigInt(view.getInt32(byteOffset, true)) : BigInt(view.getUint32(byteOffset, true)); break;
            case 8: result = isSigned ? view.getBigInt64(byteOffset, true) : view.getBigUint64(byteOffset, true); break;
            default: return false;
        }
        return this.popNandPushIfOK(argCount + 1, this.objectFromBigInt(result));
    },
    ffi_primitiveFFIIntegerAtPut: function(argCount) {
        var data = this.ffiDataFromStack(4),
            byteOffset = this.stackInteger(3),
            valueOop = this.vm.stackValue(2),
            byteSize = this.stackInteger(1),
            isSigned = this.stackBoolean(0);
        if (!this.success) return false;
        var value = this.ffiIntegralFromSt(valueOop);
        if (!this.success) return false;
        byteOffset--; // 1-based byte indexing
        if (byteOffset < 0 || byteSize < 1 || byteSize > 8 ||
            (byteSize & (byteSize - 1)) !== 0) return false;
        var view = this.ffiDataViewOn(data);
        if (!view || byteOffset + byteSize > view.byteLength) return false;
        function inRange(v, lo, hi) { return v >= lo && v <= hi; }
        switch (byteSize) {
            case 1:
                if (!inRange(value, isSigned ? -128n : 0n, isSigned ? 127n : 255n)) return false;
                isSigned ? view.setInt8(byteOffset, Number(value)) : view.setUint8(byteOffset, Number(value));
                break;
            case 2:
                if (!inRange(value, isSigned ? -32768n : 0n, isSigned ? 32767n : 65535n)) return false;
                isSigned ? view.setInt16(byteOffset, Number(value), true) : view.setUint16(byteOffset, Number(value), true);
                break;
            case 4:
                if (!inRange(value, isSigned ? -2147483648n : 0n, isSigned ? 2147483647n : 4294967295n)) return false;
                isSigned ? view.setInt32(byteOffset, Number(value), true) : view.setUint32(byteOffset, Number(value), true);
                break;
            case 8:
                if (!inRange(value, isSigned ? -(1n << 63n) : 0n, isSigned ? (1n << 63n) - 1n : (1n << 64n) - 1n)) return false;
                isSigned ? view.setBigInt64(byteOffset, value, true) : view.setBigUint64(byteOffset, value, true);
                break;
            default: return false;
        }
        return this.popNandPushIfOK(argCount + 1, valueOop);
    },
    ffi_primitiveFFIDoubleAtPut: function(argCount) {
        var data = this.ffiDataFromStack(2),
            byteOffset = this.stackInteger(1),
            valueOop = this.vm.stackValue(0),
            value = valueOop.isFloat ? valueOop.float : valueOop;
        if (!this.success || typeof value !== "number") return false;
        byteOffset--; // 1-based byte indexing
        var view = this.ffiDataViewOn(data);
        if (!view || byteOffset < 0 || byteOffset + 8 > view.byteLength) return false;
        view.setFloat64(byteOffset, value, true);
        return this.popNandPushIfOK(argCount + 1, valueOop);
    },
});

(function registerFFIEmulationModules() {
    "use strict";
    if (typeof Squeak !== "object" || !Squeak.registerExternalModule) return;

    function makeCString(value) {
        if (value === null || value === undefined) return "";
        if (typeof value === "string") return value.replace(/\0.*$/, "");
        if (value && value.bytesAsString) return value.bytesAsString().replace(/\0.*$/, "");
        var view = byteView(value);
        if (!view) return String(value);
        var chars = [];
        for (var i = 0; i < view.length && view[i] !== 0; i++) chars.push(String.fromCharCode(view[i]));
        return chars.join("");
    }

    function byteView(value) {
        if (value === null || value === undefined) return null;
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength);
        if (value && value.bytes) return value.bytes;
        if (typeof value === "string") {
            var bytes = new Uint8Array(value.length + 1);
            for (var i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 255;
            return bytes;
        }
        return null;
    }

    function utf8ByteView(value) {
        if (value === null || value === undefined) return new Uint8Array([0]);
        if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value) || value && value.bytes)
            return byteView(value);
        var string = String(value);
        if (typeof TextEncoder === "function") {
            var encoded = new TextEncoder().encode(string), out = new Uint8Array(encoded.length + 1);
            out.set(encoded);
            return out;
        }
        var bytes = [];
        for (var i = 0; i < string.length; i++) {
            var cp = string.codePointAt(i);
            if (cp > 0xFFFF) i++;
            if (cp <= 0x7F) bytes.push(cp);
            else if (cp <= 0x7FF) bytes.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
            else if (cp <= 0xFFFF) bytes.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
            else bytes.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
        }
        bytes.push(0);
        return new Uint8Array(bytes);
    }

    function cStringLength(value, maxLen) {
        var view = byteView(value);
        if (!view) return makeCString(value).length;
        var limit = maxLen === undefined ? view.length : Math.min(view.length, maxLen);
        for (var i = 0; i < limit; i++) if (view[i] === 0) return i;
        return limit;
    }

    function compareBytes(a, b, maxLen) {
        var av = byteView(a), bv = byteView(b),
            alen = cStringLength(a, maxLen), blen = cStringLength(b, maxLen),
            limit = maxLen === undefined ? Math.max(alen, blen) + 1 : maxLen;
        if (!av || !bv) {
            var as = makeCString(a), bs = makeCString(b), n = maxLen === undefined ? Math.max(as.length, bs.length) + 1 : maxLen;
            for (var si = 0; si < n; si++) {
                var ac = si < as.length ? as.charCodeAt(si) & 255 : 0,
                    bc = si < bs.length ? bs.charCodeAt(si) & 255 : 0;
                if (ac !== bc) return ac - bc;
                if (ac === 0) return 0;
            }
            return 0;
        }
        for (var i = 0; i < limit; i++) {
            var ac = i < av.length ? av[i] : 0,
                bc = i < bv.length ? bv[i] : 0;
            if (ac !== bc) return ac - bc;
            if (maxLen === undefined && ac === 0) return 0;
        }
        return 0;
    }

    function copyBytes(dest, src, n, overlapSafe) {
        var dv = byteView(dest), sv = byteView(src), len = n >>> 0;
        if (!dv || !sv) return null;
        var slice = overlapSafe ? sv.slice(0, len) : sv.subarray(0, len);
        dv.set(slice.subarray(0, Math.min(slice.length, dv.length)));
        return dest;
    }

    function setErrno(module, value) {
        Squeak.FFIEmulation.errno = value | 0;
        module.errnoValue[0] = Squeak.FFIEmulation.errno >>> 0;
        return Squeak.FFIEmulation.errno;
    }

    var libc = {
        errnoValue: new Uint32Array(1),
        getModuleName: function() { return "libc"; },
        primitiveLoadSymbolFromModule: function() {
            // Threaded FFI probes this VM primitive through the same symbol loader
            // it later uses for C library symbols.  It is not called as libc; it
            // only needs to be resolvable so Pharo selects TFFIBackend instead of
            // falling back to NullFFIBackend.
            return 0;
        },
        getenv: function(name) {
            var key = makeCString(name), value = Squeak.getEnv ? Squeak.getEnv(key) : undefined;
            return value === undefined ? null : String(value);
        },
        setenv: function(name, value, overwrite) {
            var key = makeCString(name);
            return Squeak.setEnv && Squeak.setEnv(key, makeCString(value), !!overwrite) ? 0 : -1;
        },
        unsetenv: function(name) {
            return Squeak.unsetEnv && Squeak.unsetEnv(makeCString(name)) ? 0 : -1;
        },
        system: function(command) {
            if (typeof require !== "function") return -1;
            try {
                require("child_process").execSync(makeCString(command), { stdio: "ignore" });
                return 0;
            } catch (e) {
                return typeof e.status === "number" ? e.status : -1;
            }
        },
        strlen: function(s) { return cStringLength(s); },
        strnlen: function(s, maxLen) { return cStringLength(s, maxLen); },
        strcmp: function(a, b) { return compareBytes(a, b); },
        strncmp: function(a, b, n) { return compareBytes(a, b, n >>> 0); },
        memcmp: function(a, b, n) {
            var av = byteView(a), bv = byteView(b), len = n >>> 0;
            if (!av || !bv) return 0;
            for (var i = 0; i < len; i++) {
                var ac = i < av.length ? av[i] : 0,
                    bc = i < bv.length ? bv[i] : 0;
                if (ac !== bc) return ac - bc;
            }
            return 0;
        },
        memcpy: function(dest, src, n) { return copyBytes(dest, src, n, false); },
        memmove: function(dest, src, n) { return copyBytes(dest, src, n, true); },
        memset: function(dest, value, n) {
            var view = byteView(dest), len = n >>> 0;
            if (!view) return null;
            view.fill(value & 255, 0, Math.min(len, view.length));
            return dest;
        },
        malloc: function(size) { return new ArrayBuffer(Math.max(0, size | 0)); },
        calloc: function(count, size) { return new ArrayBuffer(Math.max(0, (count | 0) * (size | 0))); },
        realloc: function(ptr, size) {
            var old = byteView(ptr), buffer = new ArrayBuffer(Math.max(0, size | 0)), newer = new Uint8Array(buffer);
            if (old) newer.set(old.subarray(0, Math.min(old.length, newer.length)));
            return buffer;
        },
        free: function(_ptr) { return null; },
        atoi: function(s) { return parseInt(makeCString(s), 10) || 0; },
        atol: function(s) { return parseInt(makeCString(s), 10) || 0; },
        atoll: function(s) { return parseInt(makeCString(s), 10) || 0; },
        abs: function(n) { return Math.abs(n | 0); },
        labs: function(n) { return Math.abs(n); },
        llabs: function(n) { return Math.abs(n); },
        getpid: function() { return (typeof process !== "undefined" && process.pid) ? process.pid : 1; },
        getuid: function() { return (typeof process !== "undefined" && process.getuid) ? process.getuid() : 0; },
        geteuid: function() { return (typeof process !== "undefined" && process.geteuid) ? process.geteuid() : 0; },
        getgid: function() { return (typeof process !== "undefined" && process.getgid) ? process.getgid() : 0; },
        getegid: function() { return (typeof process !== "undefined" && process.getegid) ? process.getegid() : 0; },
        __errno_location: function() { return this.errnoValue; },
        ___errno_location: function() { return this.errnoValue; },
        __error: function() { return this.errnoValue; },
        ffiFunctionNotFoundHandler: function(funcName, args) {
            // A conservative fallback for probes that only check for symbol presence
            // or call common no-op lifecycle hooks in libc-shaped libraries.
            if (/^(initiali[sz]e|finali[sz]e|shutdown|cleanup)/i.test(funcName)) return 0;
            if (/^_/.test(funcName) && this[funcName.slice(1)]) return this[funcName.slice(1)].apply(this, args);
            return undefined;
        }
    };

    var libm = {
        getModuleName: function() { return "libm"; },
        acos: Math.acos, asin: Math.asin, atan: Math.atan, atan2: Math.atan2,
        cos: Math.cos, sin: Math.sin, tan: Math.tan,
        cosh: Math.cosh || function(x) { return (Math.exp(x) + Math.exp(-x)) / 2; },
        sinh: Math.sinh || function(x) { return (Math.exp(x) - Math.exp(-x)) / 2; },
        tanh: Math.tanh || function(x) { var e = Math.exp(2 * x); return (e - 1) / (e + 1); },
        exp: Math.exp, log: Math.log, log10: Math.log10 || function(x) { return Math.log(x) / Math.LN10; },
        sqrt: Math.sqrt, pow: Math.pow,
        ceil: Math.ceil, floor: Math.floor, trunc: Math.trunc || function(x) { return x < 0 ? Math.ceil(x) : Math.floor(x); },
        fabs: Math.abs, fmod: function(x, y) { return x % y; },
        ffiFunctionNotFoundHandler: libc.ffiFunctionNotFoundHandler
    };

    var libdl = {
        handles: {},
        getModuleName: function() { return "libdl"; },
        dlopen: function(name, _flags) {
            var libName = name ? makeCString(name) : "libc",
                resolved = Squeak.FFIEmulation.resolveLibraryName(libName),
                module = resolved && Squeak.externalModules[resolved];
            if (!module) { Squeak.FFIEmulation.lastDlError = "module not found: " + libName; return null; }
            this.handles[resolved] = { libraryName: libName, moduleName: resolved, module: module };
            return this.handles[resolved];
        },
        dlsym: function(handle, symbol) {
            var sym = makeCString(symbol), module = handle && handle.module ? handle.module : libc;
            return module && typeof module[sym] === "function" ? module[sym] : null;
        },
        dlclose: function(_handle) { return 0; },
        dlerror: function() { var error = Squeak.FFIEmulation.lastDlError || null; Squeak.FFIEmulation.lastDlError = null; return error; },
        ffiFunctionNotFoundHandler: libc.ffiFunctionNotFoundHandler
    };

    Squeak.FFIEmulation = Squeak.FFIEmulation || {};
    Object.extend(Squeak.FFIEmulation, {
        errno: 0,
        lastDlError: null,
        currentPrimitive: null,
        canonicalNames: {},
        libraries: {},
        byteView: byteView,
        makeCString: makeCString,
        registerLibrary: function(canonicalName, aliases, module) {
            this.libraries[canonicalName] = module;
            this.canonicalNames[canonicalName] = canonicalName;
            Squeak.registerExternalModule(canonicalName, module);
            aliases = aliases || [];
            for (var i = 0; i < aliases.length; i++) {
                this.canonicalNames[aliases[i]] = canonicalName;
                Squeak.registerExternalModule(aliases[i], module);
            }
        },
        resolveLibraryName: function(name) {
            if (!name) return "libc";
            if (this.canonicalNames[name]) return this.canonicalNames[name];
            var normalized = String(name).replace(/\\/g, "/").split("/").pop();
            if (this.canonicalNames[normalized]) return this.canonicalNames[normalized];
            var withoutVersion = normalized.replace(/\.so(?:\.\d+)*$/, ".so");
            if (this.canonicalNames[withoutVersion]) return this.canonicalNames[withoutVersion];
            var withoutPrefix = withoutVersion.replace(/^lib/, "");
            if (this.canonicalNames[withoutPrefix]) return this.canonicalNames[withoutPrefix];
            return Squeak.externalModules && Squeak.externalModules[name] ? name : undefined;
        },
        enqueueSDLEventFromSqueakEvent: function(display, event) {
            var sdl = this.libraries && this.libraries["libSDL2-2.0"];
            if (sdl && sdl.enqueueSqueakDisplayEvent) sdl.enqueueSqueakDisplayEvent(display, event);
        },
        enqueueSDLKeyDownFromBrowserEvent: function(display, event) {
            var sdl = this.libraries && this.libraries["libSDL2-2.0"];
            if (sdl && sdl.queueBrowserKeyDown) return sdl.queueBrowserKeyDown(display, event);
            return false;
        },
        enqueueSDLKeyUpFromBrowserEvent: function(display, unicode, modifiers) {
            var sdl = this.libraries && this.libraries["libSDL2-2.0"];
            if (sdl && sdl.queueBrowserKeyUp) return sdl.queueBrowserKeyUp(display, unicode, modifiers);
            return false;
        },
        enqueueSDLTextInputFromBrowserEvent: function(display, text, timestamp) {
            var sdl = this.libraries && this.libraries["libSDL2-2.0"];
            if (sdl && sdl.queueBrowserTextInput) return sdl.queueBrowserTextInput(display, text, timestamp);
            return false;
        }
    });

    var freetype = {
        getModuleName: function() { return "libfreetype"; },
        ffiFunctionNotFoundHandler: libc.ffiFunctionNotFoundHandler
    };

    function writeInt32Pointer(ptr, value) {
        var view = byteView(ptr);
        if (!view || view.byteLength < 4) return false;
        new DataView(view.buffer, view.byteOffset || 0, view.byteLength).setInt32(0, value | 0, true);
        return true;
    }

    function writeUint8Pointer(ptr, offset, value) {
        var view = byteView(ptr);
        if (!view || offset < 0 || offset >= view.byteLength) return false;
        view[offset] = value & 255;
        return true;
    }

    function writeFloat32Pointer(ptr, value) {
        var view = byteView(ptr);
        if (!view || view.byteLength < 4) return false;
        new DataView(view.buffer, view.byteOffset || 0, view.byteLength).setFloat32(0, Number(value) || 0, true);
        return true;
    }

    function dataView(ptr) {
        var view = byteView(ptr);
        return view ? new DataView(view.buffer, view.byteOffset || 0, view.byteLength) : null;
    }

    function currentFFIPrimitive() {
        return Squeak.FFIEmulation && Squeak.FFIEmulation.currentPrimitive;
    }

    function registerPointerData(data) {
        var prim = currentFFIPrimitive();
        if (!prim) return 0;
        if (!prim.ffiAddressDataMap) prim.ffiAddressDataMap = {};
        var handle = 0;
        do { handle = (++prim.ffiNextExtAddr) >>> 0; } while (!handle || prim.ffiAddressDataMap[handle]);
        prim.ffiAddressDataMap[handle] = data;
        return handle;
    }

    function unregisterPointerData(handle) {
        var prim = currentFFIPrimitive();
        if (prim && prim.ffiAddressDataMap && handle) delete prim.ffiAddressDataMap[handle >>> 0];
    }

    function writePointerValue(ptr, value) {
        var view = dataView(ptr);
        if (!view || view.byteLength < 4) return false;
        if (view.byteLength >= 8 && typeof view.setBigUint64 === "function") view.setBigUint64(0, BigInt(value >>> 0), true);
        else view.setUint32(0, value >>> 0, true);
        return true;
    }

    function readSDLRect(rect) {
        var view = dataView(rect);
        if (!view || view.byteLength < 16) return null;
        return {
            x: view.getInt32(0, true),
            y: view.getInt32(4, true),
            w: view.getInt32(8, true),
            h: view.getInt32(12, true)
        };
    }

    function writeSDLRect(rect, x, y, w, h) {
        var view = dataView(rect);
        if (!view || view.byteLength < 16) return false;
        view.setInt32(0, x | 0, true);
        view.setInt32(4, y | 0, true);
        view.setInt32(8, w | 0, true);
        view.setInt32(12, h | 0, true);
        return true;
    }

    function blitRGBA(destPixels, destWidth, destHeight, srcPixels, srcWidth, srcHeight, srcRect, dstRect, srcPitch) {
        var dest = byteView(destPixels), src = byteView(srcPixels);
        if (!dest || !src) return false;
        srcPitch = srcPitch || srcWidth * 4;
        srcRect = srcRect || { x: 0, y: 0, w: srcWidth, h: srcHeight };
        dstRect = dstRect || { x: 0, y: 0, w: srcRect.w, h: srcRect.h };
        var copyW = Math.max(0, Math.min(srcRect.w | 0, dstRect.w | 0, srcWidth - (srcRect.x | 0), destWidth - (dstRect.x | 0))),
            copyH = Math.max(0, Math.min(srcRect.h | 0, dstRect.h | 0, srcHeight - (srcRect.y | 0), destHeight - (dstRect.y | 0)));
        for (var y = 0; y < copyH; y++) {
            var s0 = ((srcRect.y + y) * srcPitch) + srcRect.x * 4,
                d0 = ((dstRect.y + y) * destWidth + dstRect.x) * 4,
                row = src.subarray(s0, Math.min(s0 + copyW * 4, src.length));
            dest.set(row, d0);
        }
        return true;
    }

    var SDL_PIXELFORMAT_XRGB8888 = 0x16161804,
        SDL_PIXELFORMAT_RGBX8888 = 0x16261804,
        SDL_PIXELFORMAT_ARGB8888 = 0x16362004,
        SDL_PIXELFORMAT_RGBA8888 = 0x16462004,
        SDL_PIXELFORMAT_XBGR8888 = 0x16561804,
        SDL_PIXELFORMAT_BGRX8888 = 0x16661804,
        SDL_PIXELFORMAT_ABGR8888 = 0x16762004,
        SDL_PIXELFORMAT_BGRA8888 = 0x16862004;

    function unpackSDLPixelToRGBA(src, offset, format, out, outOffset) {
        var b0 = src[offset] || 0, b1 = src[offset + 1] || 0, b2 = src[offset + 2] || 0, b3 = src[offset + 3] || 0;
        // SDL packed 8888 formats are described as integer layouts. On the
        // little-endian platforms Pharo/SqueakJS emulate, the in-memory byte
        // order is the reverse of the symbolic component order. Canvas ImageData
        // always wants RGBA bytes, so normalize texture memory at upload/unlock time.
        switch (format >>> 0) {
            case SDL_PIXELFORMAT_XRGB8888: // memory: B G R X
                out[outOffset] = b2; out[outOffset + 1] = b1; out[outOffset + 2] = b0; out[outOffset + 3] = 255; break;
            case SDL_PIXELFORMAT_ARGB8888: // memory: B G R A
                out[outOffset] = b2; out[outOffset + 1] = b1; out[outOffset + 2] = b0; out[outOffset + 3] = b3; break;
            case SDL_PIXELFORMAT_RGBX8888: // memory: X B G R
                out[outOffset] = b3; out[outOffset + 1] = b2; out[outOffset + 2] = b1; out[outOffset + 3] = 255; break;
            case SDL_PIXELFORMAT_RGBA8888: // memory: A B G R
                out[outOffset] = b3; out[outOffset + 1] = b2; out[outOffset + 2] = b1; out[outOffset + 3] = b0; break;
            case SDL_PIXELFORMAT_XBGR8888: // memory: R G B X
                out[outOffset] = b0; out[outOffset + 1] = b1; out[outOffset + 2] = b2; out[outOffset + 3] = 255; break;
            case SDL_PIXELFORMAT_ABGR8888: // memory: R G B A
                out[outOffset] = b0; out[outOffset + 1] = b1; out[outOffset + 2] = b2; out[outOffset + 3] = b3; break;
            case SDL_PIXELFORMAT_BGRX8888: // memory: X R G B
                out[outOffset] = b1; out[outOffset + 1] = b2; out[outOffset + 2] = b3; out[outOffset + 3] = 255; break;
            case SDL_PIXELFORMAT_BGRA8888: // memory: A R G B
                out[outOffset] = b1; out[outOffset + 1] = b2; out[outOffset + 2] = b3; out[outOffset + 3] = b0; break;
            default:
                // Keep unknown formats visible rather than black. This is the old
                // raw-RGBA behavior and is useful for browser-side debugging.
                out[outOffset] = b0; out[outOffset + 1] = b1; out[outOffset + 2] = b2; out[outOffset + 3] = b3 === undefined ? 255 : b3;
        }
    }

    function packRGBAToSDLPixel(src, offset, format, out, outOffset) {
        var r = src[offset] || 0, g = src[offset + 1] || 0, b = src[offset + 2] || 0, a = src[offset + 3] === undefined ? 255 : src[offset + 3];
        switch (format >>> 0) {
            case SDL_PIXELFORMAT_XRGB8888: out[outOffset] = b; out[outOffset + 1] = g; out[outOffset + 2] = r; out[outOffset + 3] = 0; break;
            case SDL_PIXELFORMAT_ARGB8888: out[outOffset] = b; out[outOffset + 1] = g; out[outOffset + 2] = r; out[outOffset + 3] = a; break;
            case SDL_PIXELFORMAT_RGBX8888: out[outOffset] = 0; out[outOffset + 1] = b; out[outOffset + 2] = g; out[outOffset + 3] = r; break;
            case SDL_PIXELFORMAT_RGBA8888: out[outOffset] = a; out[outOffset + 1] = b; out[outOffset + 2] = g; out[outOffset + 3] = r; break;
            case SDL_PIXELFORMAT_XBGR8888: out[outOffset] = r; out[outOffset + 1] = g; out[outOffset + 2] = b; out[outOffset + 3] = 0; break;
            case SDL_PIXELFORMAT_ABGR8888: out[outOffset] = r; out[outOffset + 1] = g; out[outOffset + 2] = b; out[outOffset + 3] = a; break;
            case SDL_PIXELFORMAT_BGRX8888: out[outOffset] = 0; out[outOffset + 1] = r; out[outOffset + 2] = g; out[outOffset + 3] = b; break;
            case SDL_PIXELFORMAT_BGRA8888: out[outOffset] = a; out[outOffset + 1] = r; out[outOffset + 2] = g; out[outOffset + 3] = b; break;
            default: out[outOffset] = r; out[outOffset + 1] = g; out[outOffset + 2] = b; out[outOffset + 3] = a;
        }
    }

    function makeSDLTextureLockBuffer(texture, rect) {
        rect = rect || { x: 0, y: 0, w: texture.width, h: texture.height };
        var x = rect.x | 0, y = rect.y | 0, w = Math.max(0, rect.w | 0), h = Math.max(0, rect.h | 0),
            pitch = Math.max(0, w * 4), buffer = new ArrayBuffer(Math.max(0, pitch * h)),
            src = byteView(texture.pixels), out = new Uint8Array(buffer);
        if (src) {
            for (var row = 0; row < h; row++) {
                for (var col = 0; col < w; col++) {
                    var s0 = ((y + row) * texture.width + x + col) * 4, d0 = row * pitch + col * 4;
                    if (s0 + 3 < src.length && d0 + 3 < out.length) packRGBAToSDLPixel(src, s0, texture.format, out, d0);
                }
            }
        }
        return { buffer: buffer, pitch: pitch, rect: rect };
    }

    function blitSDLToRGBATexture(texture, rect, pixels, pitch) {
        if (!texture || !texture.pixels) return false;
        var src = byteView(pixels), dest = byteView(texture.pixels);
        if (!src || !dest) return false;
        rect = rect || { x: 0, y: 0, w: texture.width, h: texture.height };
        var x = rect.x | 0, y = rect.y | 0, w = Math.max(0, rect.w | 0), h = Math.max(0, rect.h | 0),
            srcPitch = pitch | 0 || w * 4, maxW = Math.max(0, Math.min(w, texture.width - x)),
            maxH = Math.max(0, Math.min(h, texture.height - y));
        for (var row = 0; row < maxH; row++) {
            for (var col = 0; col < maxW; col++) {
                var s0 = row * srcPitch + col * 4, d0 = ((y + row) * texture.width + x + col) * 4;
                if (s0 + 3 < src.length && d0 + 3 < dest.length) unpackSDLPixelToRGBA(src, s0, texture.format, dest, d0);
            }
        }
        return true;
    }

    function copyPixelsToCanvas(context, pixels, width, height, srcRect, dstRect) {
        var src = byteView(pixels);
        if (!context || !src || width <= 0 || height <= 0 || !context.createImageData || !context.putImageData) return false;
        srcRect = srcRect || { x: 0, y: 0, w: width, h: height };
        dstRect = dstRect || { x: srcRect.x | 0, y: srcRect.y | 0, w: srcRect.w | 0, h: srcRect.h | 0 };
        var sx = srcRect.x | 0, sy = srcRect.y | 0, sw = Math.max(0, Math.min(srcRect.w | 0, width - sx)), sh = Math.max(0, Math.min(srcRect.h | 0, height - sy)),
            dx = dstRect.x | 0, dy = dstRect.y | 0, dw = Math.max(0, dstRect.w | 0), dh = Math.max(0, dstRect.h | 0);
        if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return false;
        var image = context.createImageData(dw, dh), out = image.data;
        for (var y = 0; y < dh; y++) {
            var srcY = sy + Math.min(sh - 1, Math.floor(y * sh / dh));
            for (var x = 0; x < dw; x++) {
                var srcX = sx + Math.min(sw - 1, Math.floor(x * sw / dw)), s0 = (srcY * width + srcX) * 4, d0 = (y * dw + x) * 4;
                out[d0] = src[s0] || 0;
                out[d0 + 1] = src[s0 + 1] || 0;
                out[d0 + 2] = src[s0 + 2] || 0;
                out[d0 + 3] = src[s0 + 3] === undefined ? 255 : src[s0 + 3];
            }
        }
        context.putImageData(image, dx, dy);
        return true;
    }

    function writeSDLEvent(ptr, evt) {
        var view = dataView(ptr);
        if (!view || view.byteLength < 8 || !evt) return false;
        for (var i = 0; i < Math.min(view.byteLength, 56); i++) view.setUint8(i, 0);
        if (evt.rawData) {
            var raw = byteView(evt.rawData);
            if (!raw) return false;
            for (var ri = 0; ri < Math.min(raw.length, view.byteLength, 56); ri++) view.setUint8(ri, raw[ri]);
            return true;
        }
        view.setUint32(0, evt.type >>> 0, true);
        view.setUint32(4, evt.timestamp === undefined ? ((Date.now() - sdl2.startTime) >>> 0) : evt.timestamp >>> 0, true);
        switch (evt.type >>> 0) {
            case 0x200: // SDL_WINDOWEVENT
                if (view.byteLength >= 24) {
                    view.setUint32(8, evt.windowID >>> 0, true);
                    view.setUint8(12, evt.event & 255);
                    view.setInt32(16, evt.data1 | 0, true);
                    view.setInt32(20, evt.data2 | 0, true);
                }
                break;
            case 0x400: // SDL_MOUSEMOTION
                if (view.byteLength >= 36) {
                    view.setUint32(8, evt.windowID >>> 0, true);
                    view.setUint32(16, evt.state >>> 0, true);
                    view.setInt32(20, evt.x | 0, true);
                    view.setInt32(24, evt.y | 0, true);
                    view.setInt32(28, evt.xrel | 0, true);
                    view.setInt32(32, evt.yrel | 0, true);
                }
                break;
            case 0x401: // SDL_MOUSEBUTTONDOWN
            case 0x402: // SDL_MOUSEBUTTONUP
                if (view.byteLength >= 28) {
                    view.setUint32(8, evt.windowID >>> 0, true);
                    view.setUint8(16, evt.button & 255);
                    view.setUint8(17, evt.state & 255);
                    view.setUint8(18, evt.clicks === undefined ? 1 : evt.clicks & 255);
                    view.setInt32(20, evt.x | 0, true);
                    view.setInt32(24, evt.y | 0, true);
                }
                break;
            case 0x403: // SDL_MOUSEWHEEL
                if (view.byteLength >= 28) {
                    view.setUint32(8, evt.windowID >>> 0, true);
                    view.setInt32(16, evt.x | 0, true);
                    view.setInt32(20, evt.y | 0, true);
                    view.setUint32(24, evt.direction >>> 0, true);
                }
                break;
            case 0x300: // SDL_KEYDOWN
            case 0x301: // SDL_KEYUP
                if (view.byteLength >= 28) {
                    view.setUint32(8, evt.windowID >>> 0, true);
                    view.setUint8(12, evt.state & 255);
                    view.setUint8(13, evt.repeat & 255);
                    view.setInt32(16, evt.scancode | 0, true);
                    view.setInt32(20, evt.sym | 0, true);
                    view.setUint16(24, evt.mod & 65535, true);
                }
                break;
            case 0x303: // SDL_TEXTINPUT
                if (view.byteLength >= 44) {
                    view.setUint32(8, evt.windowID >>> 0, true);
                    var text = utf8ByteView(evt.text || "");
                    for (var ti = 0; text && ti < Math.min(31, text.length); ti++) view.setUint8(12 + ti, text[ti]);
                }
                break;
        }
        return true;
    }

    function sdlButtonFromSqueakMask(mask) {
        var mouseRed = Squeak.Mouse_Red || 4,
            mouseYellow = Squeak.Mouse_Yellow || 2,
            mouseBlue = Squeak.Mouse_Blue || 1;
        if (mask & mouseRed) return 1;      // SDL_BUTTON_LEFT
        if (mask & mouseYellow) return 2;   // SDL_BUTTON_MIDDLE
        if (mask & mouseBlue) return 3;     // SDL_BUTTON_RIGHT
        return 0;
    }

    function sdlButtonMaskFromSqueak(mask) {
        var sdlMask = 0,
            mouseRed = Squeak.Mouse_Red || 4,
            mouseYellow = Squeak.Mouse_Yellow || 2,
            mouseBlue = Squeak.Mouse_Blue || 1;
        if (mask & mouseRed) sdlMask |= 1;      // SDL_BUTTON_LMASK
        if (mask & mouseYellow) sdlMask |= 2;   // SDL_BUTTON_MMASK
        if (mask & mouseBlue) sdlMask |= 4;     // SDL_BUTTON_RMASK
        return sdlMask;
    }

    function sdlModMaskFromSqueak(mask) {
        var mod = 0;
        if (mask & (Squeak.Keyboard_Shift || 8)) mod |= 0x0003; // KMOD_LSHIFT|KMOD_RSHIFT
        if (mask & (Squeak.Keyboard_Ctrl || 16)) mod |= 0x00C0; // KMOD_LCTRL|KMOD_RCTRL
        if (mask & (Squeak.Keyboard_Cmd || 64)) mod |= 0x0300;  // KMOD_LGUI|KMOD_RGUI
        return mod;
    }

    function sdlScancodeForUnicode(unicode) {
        unicode = unicode | 0;
        if (unicode >= 97 && unicode <= 122) return 4 + unicode - 97;      // a-z
        if (unicode >= 65 && unicode <= 90) return 4 + unicode - 65;       // A-Z
        if (unicode >= 49 && unicode <= 57) return 30 + unicode - 49;      // 1-9
        if (unicode === 48) return 39;                                     // 0
        switch (unicode) {
            case 13: return 40; case 27: return 41; case 8: return 42; case 9: return 43; case 32: return 44;
            case 28: return 80; case 29: return 79; case 30: return 82; case 31: return 81;
            case 127: return 76; case 1: return 74; case 4: return 77; case 5: return 73; case 11: return 75; case 12: return 78;
            default: return unicode > 0 && unicode < 512 ? unicode : 0;
        }
    }

    function sdlKeySymForUnicode(unicode) {
        unicode = unicode | 0;
        switch (unicode) {
            case 28: return 0x40000050; // SDLK_LEFT
            case 29: return 0x4000004F; // SDLK_RIGHT
            case 30: return 0x40000052; // SDLK_UP
            case 31: return 0x40000051; // SDLK_DOWN
            case 1: return 0x4000004A;  // SDLK_HOME
            case 4: return 0x4000004D;  // SDLK_END
            case 5: return 0x40000049;  // SDLK_INSERT
            case 11: return 0x4000004B; // SDLK_PAGEUP
            case 12: return 0x4000004E; // SDLK_PAGEDOWN
            case 127: return 127;
            default: return unicode;
        }
    }


    var SDL_SCANCODE_MASK = 0x40000000;
    var SDL_DOM_CODE_SCANCODES = (function() {
        var map = {
            Enter: 40, Escape: 41, Backspace: 42, Tab: 43, Space: 44,
            Minus: 45, Equal: 46, BracketLeft: 47, BracketRight: 48, Backslash: 49,
            Semicolon: 51, Quote: 52, Backquote: 53, Comma: 54, Period: 55, Slash: 56,
            CapsLock: 57, PrintScreen: 70, ScrollLock: 71, Pause: 72,
            Insert: 73, Home: 74, PageUp: 75, Delete: 76, End: 77, PageDown: 78,
            ArrowRight: 79, ArrowLeft: 80, ArrowDown: 81, ArrowUp: 82,
            NumLock: 83, NumpadDivide: 84, NumpadMultiply: 85, NumpadSubtract: 86,
            NumpadAdd: 87, NumpadEnter: 88, NumpadDecimal: 99, IntlBackslash: 100,
            ContextMenu: 101, NumpadEqual: 103,
            ControlLeft: 224, ShiftLeft: 225, AltLeft: 226, MetaLeft: 227,
            ControlRight: 228, ShiftRight: 229, AltRight: 230, MetaRight: 231,
        };
        for (var i = 0; i < 26; i++) map["Key" + String.fromCharCode(65 + i)] = 4 + i;
        for (var d = 1; d <= 9; d++) map["Digit" + d] = 29 + d;
        map.Digit0 = 39;
        for (var f = 1; f <= 12; f++) map["F" + f] = 57 + f;
        for (var n = 1; n <= 9; n++) map["Numpad" + n] = 88 + n;
        map.Numpad0 = 98;
        return map;
    })();

    var SDL_DOM_CODE_KEYSYMS = {
        Enter: 13, Escape: 27, Backspace: 8, Tab: 9, Space: 32,
        Minus: 45, Equal: 61, BracketLeft: 91, BracketRight: 93, Backslash: 92,
        Semicolon: 59, Quote: 39, Backquote: 96, Comma: 44, Period: 46, Slash: 47,
        CapsLock: SDL_SCANCODE_MASK | 57, PrintScreen: SDL_SCANCODE_MASK | 70, ScrollLock: SDL_SCANCODE_MASK | 71, Pause: SDL_SCANCODE_MASK | 72,
        Insert: SDL_SCANCODE_MASK | 73, Home: SDL_SCANCODE_MASK | 74, PageUp: SDL_SCANCODE_MASK | 75,
        Delete: 127, End: SDL_SCANCODE_MASK | 77, PageDown: SDL_SCANCODE_MASK | 78,
        ArrowRight: SDL_SCANCODE_MASK | 79, ArrowLeft: SDL_SCANCODE_MASK | 80, ArrowDown: SDL_SCANCODE_MASK | 81, ArrowUp: SDL_SCANCODE_MASK | 82,
        NumLock: SDL_SCANCODE_MASK | 83, NumpadDivide: 47, NumpadMultiply: 42, NumpadSubtract: 45,
        NumpadAdd: 43, NumpadEnter: 13, NumpadDecimal: 46, NumpadEqual: 61,
        ContextMenu: SDL_SCANCODE_MASK | 101,
        ControlLeft: SDL_SCANCODE_MASK | 224, ShiftLeft: SDL_SCANCODE_MASK | 225, AltLeft: SDL_SCANCODE_MASK | 226, MetaLeft: SDL_SCANCODE_MASK | 227,
        ControlRight: SDL_SCANCODE_MASK | 228, ShiftRight: SDL_SCANCODE_MASK | 229, AltRight: SDL_SCANCODE_MASK | 230, MetaRight: SDL_SCANCODE_MASK | 231,
    };
    for (var sf = 1; sf <= 12; sf++) SDL_DOM_CODE_KEYSYMS["F" + sf] = SDL_SCANCODE_MASK | (57 + sf);
    for (var sd = 1; sd <= 9; sd++) SDL_DOM_CODE_KEYSYMS["Digit" + sd] = 48 + sd;
    SDL_DOM_CODE_KEYSYMS.Digit0 = 48;
    for (var sn = 1; sn <= 9; sn++) SDL_DOM_CODE_KEYSYMS["Numpad" + sn] = 48 + sn;
    SDL_DOM_CODE_KEYSYMS.Numpad0 = 48;

    function sdlModMaskFromBrowserEvent(evt) {
        evt = evt || {};
        var mod = 0;
        if (evt.shiftKey) mod |= 0x0003; // KMOD_SHIFT
        if (evt.ctrlKey) mod |= 0x00C0;  // KMOD_CTRL
        if (evt.altKey) mod |= 0x0300;   // KMOD_ALT
        if (evt.metaKey) mod |= 0x0C00;  // KMOD_GUI
        if (evt.getModifierState) {
            if (evt.getModifierState("NumLock")) mod |= 0x1000;
            if (evt.getModifierState("CapsLock")) mod |= 0x2000;
            if (evt.getModifierState("AltGraph")) mod |= 0x4000;
        }
        return mod >>> 0;
    }

    function sdlScancodeForBrowserEvent(evt) {
        evt = evt || {};
        var code = evt.code || "";
        if (SDL_DOM_CODE_SCANCODES[code] !== undefined) return SDL_DOM_CODE_SCANCODES[code] | 0;
        if (evt.key && evt.key.length === 1) return sdlScancodeForUnicode(evt.key.codePointAt(0));
        return 0;
    }

    function sdlKeySymForBrowserEvent(evt) {
        evt = evt || {};
        var code = evt.code || "";
        if (SDL_DOM_CODE_KEYSYMS[code] !== undefined) return SDL_DOM_CODE_KEYSYMS[code] | 0;
        if (evt.key && evt.key.length === 1) {
            var cp = evt.key.codePointAt(0);
            if (cp >= 65 && cp <= 90) return cp + 32; // SDL letter keysyms are lowercase key codes; text comes via SDL_TEXTINPUT.
            return cp | 0;
        }
        return sdlKeySymForUnicode(evt.keyCode || evt.which || 0);
    }

    function browserKeyboardEventTimestamp(evt) {
        return evt && evt.timeStamp !== undefined ? evt.timeStamp >>> 0 : ((Date.now() - sdl2.startTime) >>> 0);
    }

    function parseSDLEvent(ptr) {
        var view = dataView(ptr);
        if (!view || view.byteLength < 8) return null;
        var raw = new Uint8Array(Math.min(view.byteLength, 56));
        for (var i = 0; i < raw.length; i++) raw[i] = view.getUint8(i);
        return { type: view.getUint32(0, true), rawData: raw };
    }

    function eventMatchesType(evt, minType, maxType) {
        if (!evt) return false;
        var type = evt.type >>> 0, min = minType >>> 0, max = maxType >>> 0;
        return type >= min && type <= max;
    }

    function sdlSystemCursorCSS(cursorId) {
        switch (cursorId | 0) {
            case 0: return "default";       // SDL_SYSTEM_CURSOR_ARROW
            case 1: return "text";          // SDL_SYSTEM_CURSOR_IBEAM
            case 2: return "wait";          // SDL_SYSTEM_CURSOR_WAIT
            case 3: return "crosshair";     // SDL_SYSTEM_CURSOR_CROSSHAIR
            case 4: return "progress";      // SDL_SYSTEM_CURSOR_WAITARROW
            case 5: return "nwse-resize";   // SDL_SYSTEM_CURSOR_SIZENWSE
            case 6: return "nesw-resize";   // SDL_SYSTEM_CURSOR_SIZENESW
            case 7: return "ew-resize";     // SDL_SYSTEM_CURSOR_SIZEWE
            case 8: return "ns-resize";     // SDL_SYSTEM_CURSOR_SIZENS
            case 9: return "move";          // SDL_SYSTEM_CURSOR_SIZEALL
            case 10: return "not-allowed";  // SDL_SYSTEM_CURSOR_NO
            case 11: return "pointer";      // SDL_SYSTEM_CURSOR_HAND
            default: return "default";
        }
    }

    function sdlDefaultCursor() {
        if (!sdl2.defaultCursor) sdl2.defaultCursor = sdlHandle("cursor", { systemCursor: 0, cssCursor: "default", defaultCursor: true });
        return sdl2.defaultCursor;
    }

    function customCursorSVGDataURI(data, mask, width, height) {
        var dataBytes = byteView(data), maskBytes = byteView(mask), w = Math.max(1, width | 0), h = Math.max(1, height | 0), stride = Math.ceil(w / 8);
        if (!dataBytes || !maskBytes || dataBytes.length < stride * h || maskBytes.length < stride * h) return null;
        var parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges">'];
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var index = y * stride + (x >> 3), bit = 0x80 >> (x & 7), visible = (maskBytes[index] & bit) !== 0;
                if (!visible) continue;
                var black = (dataBytes[index] & bit) !== 0;
                parts.push('<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + (black ? 'black' : 'white') + '"/>');
            }
        }
        parts.push('</svg>');
        return 'data:image/svg+xml,' + encodeURIComponent(parts.join(''));
    }

    function maskShift(mask) {
        mask = mask >>> 0;
        if (!mask) return 0;
        var shift = 0;
        while (((mask >>> shift) & 1) === 0 && shift < 32) shift++;
        return shift;
    }

    function maskBits(mask) {
        mask = mask >>> 0;
        var bits = 0;
        while (mask) { bits += mask & 1; mask >>>= 1; }
        return bits;
    }

    function extractMaskedComponent(word, mask) {
        mask = mask >>> 0;
        if (!mask) return 255;
        var shift = maskShift(mask), bits = maskBits(mask), max = bits ? ((1 << bits) - 1) : 255, value = (word & mask) >>> shift;
        return Math.round(value * 255 / max) & 255;
    }

    function surfaceCursorDataURI(surface) {
        if (!surface || !surface.pixels || (surface.width | 0) <= 0 || (surface.height | 0) <= 0) return null;
        var src = byteView(surface.pixels), w = surface.width | 0, h = surface.height | 0, pitch = surface.pitch | 0 || w * 4;
        if (!src || (surface.depth | 0) !== 32) return null;
        var svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges">'],
            view = new DataView(src.buffer, src.byteOffset || 0, src.byteLength),
            rmask = surface.rmask >>> 0 || 0x00FF0000,
            gmask = surface.gmask >>> 0 || 0x0000FF00,
            bmask = surface.bmask >>> 0 || 0x000000FF,
            amask = surface.amask >>> 0;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var o = y * pitch + x * 4;
                if (o + 3 >= view.byteLength) continue;
                var word = view.getUint32(o, true), a = amask ? extractMaskedComponent(word, amask) : 255;
                if (a === 0) continue;
                var r = extractMaskedComponent(word, rmask), g = extractMaskedComponent(word, gmask), b = extractMaskedComponent(word, bmask);
                svg.push('<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="rgba(' + r + ',' + g + ',' + b + ',' + (a / 255) + ')"/>');
            }
        }
        svg.push('</svg>');
        return 'data:image/svg+xml,' + encodeURIComponent(svg.join(''));
    }

    function cssForSDLCursor(cursor) {
        cursor = cursor || sdlDefaultCursor();
        if (cursor.cssCursor) return cursor.cssCursor;
        if (cursor.cssDataURL) return 'url("' + cursor.cssDataURL + '") ' + (cursor.hotX | 0) + ' ' + (cursor.hotY | 0) + ', auto';
        if (cursor.systemCursor !== undefined) return sdlSystemCursorCSS(cursor.systemCursor);
        return "default";
    }

    function applySDLCursorToWindow(window) {
        var display = window && window.display || sdl2.currentDisplay(),
            canvas = window && window.canvas || display && display.context && display.context.canvas;
        if (!canvas || !canvas.style) return;
        var visible = sdl2.cursorVisible !== false,
            cursor = sdl2.currentCursor || sdlDefaultCursor(),
            css = visible ? cssForSDLCursor(cursor) : "none";
        canvas.style.cursor = css;
        if (display) {
            display.sdlCursorVisible = visible;
            display.sdlCurrentCursor = cursor;
            display.sdlCursorCSS = css;
            if (display.cursorCanvas && display.cursorCanvas.style) display.cursorCanvas.style.display = "none";
        }
    }

    function applySDLCursorToDisplays() {
        var ids = Object.keys(sdl2.windowsById || {});
        if (!ids.length) applySDLCursorToWindow(null);
        for (var i = 0; i < ids.length; i++) applySDLCursorToWindow(sdl2.windowsById[ids[i]]);
    }

    function sdlHandle(kind, properties) {
        var handle = Object.assign({ sdlKind: kind, id: ++sdl2.nextId }, properties || {});
        sdl2.handles[handle.id] = handle;
        return handle;
    }

    function sdlDisplayCanvas(display) {
        return display && display.context && display.context.canvas;
    }

    function sdlBrowserManagedSize(display) {
        var canvas = sdlDisplayCanvas(display),
            w = display && (display.width | 0),
            h = display && (display.height | 0);
        // createSqueakDisplay's browser layout owns display.width/height.
        // When present, SDL must treat that backing-store size as the real
        // window size; otherwise Pharo's requested SDL window size can leave
        // the canvas CSS stretched over a differently-shaped backing store.
        if (w > 0 && h > 0) return { width: w, height: h, managed: true };
        if (canvas && (canvas.width | 0) > 0 && (canvas.height | 0) > 0)
            return { width: canvas.width | 0, height: canvas.height | 0, managed: false };
        return null;
    }

    function sdlResizeWindowSurface(window) {
        if (!window || !window.surface) return;
        window.surface.width = window.width | 0;
        window.surface.height = window.height | 0;
        window.surface.pitch = (window.width | 0) * 4;
        window.surface.pixels = new ArrayBuffer(Math.max(0, (window.width | 0) * (window.height | 0) * 4));
    }

    function sdlSyncWindowToDisplay(window, queueEvents) {
        var display = window && window.display, canvas = sdlDisplayCanvas(display), size = sdlBrowserManagedSize(display);
        if (!window || !size || size.width <= 0 || size.height <= 0) return false;
        var oldW = window.width | 0, oldH = window.height | 0, changed = oldW !== size.width || oldH !== size.height;
        window.width = size.width | 0;
        window.height = size.height | 0;
        window.browserManagedSize = !!size.managed;
        if (canvas && (!size.managed || (canvas.width | 0) <= 0 || (canvas.height | 0) <= 0)) {
            canvas.width = window.width;
            canvas.height = window.height;
        }
        if (changed) {
            sdlResizeWindowSurface(window);
            if (queueEvents && sdl2 && sdl2.queueWindowEvent) {
                sdl2.queueWindowEvent(window, 5, window.width, window.height); // SDL_WINDOWEVENT_RESIZED
                sdl2.queueWindowEvent(window, 6, window.width, window.height); // SDL_WINDOWEVENT_SIZE_CHANGED
                sdl2.queueWindowEvent(window, 3, window.width, window.height); // SDL_WINDOWEVENT_EXPOSED
            }
        }
        if (display) {
            display.sdlWindowWidth = window.width;
            display.sdlWindowHeight = window.height;
            display.sdlCanvasWidth = canvas && (canvas.width | 0) || 0;
            display.sdlCanvasHeight = canvas && (canvas.height | 0) || 0;
        }
        return changed;
    }

    function sdlInstallDisplayResizeCallback(display, window) {
        if (!display || display.sdlResizeCallbackInstalled) return;
        var previous = display.changedCallback;
        display.sdlPreviousChangedCallback = previous;
        display.sdlResizeCallbackInstalled = true;
        display.changedCallback = function() {
            if (previous) previous.apply(this, arguments);
            if (display.sdlResizeCallbackBusy) return;
            display.sdlResizeCallbackBusy = true;
            try {
                sdlSyncWindowToDisplay(display.sdlWindow || window, true);
            } finally {
                display.sdlResizeCallbackBusy = false;
            }
        };
    }

    var sdl2 = {
        nextId: 0,
        initFlags: 0,
        lastError: "",
        clipboardText: "",
        hints: {},
        handles: {},
        startTime: Date.now(),
        windowsById: {},
        eventQueue: [],
        keyboardState: new Uint8Array(512),
        modState: 0,
        nextUserEventType: 0x8000,
        lastMouseState: { x: 0, y: 0, buttons: 0 },
        cursorVisible: true,
        currentCursor: null,
        defaultCursor: null,
        getModuleName: function() { return "libSDL2-2.0"; },
        currentPrimitive: function() { return Squeak.FFIEmulation && Squeak.FFIEmulation.currentPrimitive; },
        currentDisplay: function() { var prim = this.currentPrimitive(); return prim && prim.display; },
        defaultWindow: function() {
            var ids = Object.keys(this.windowsById);
            return ids.length ? this.windowsById[ids[0]] : null;
        },
        bindWindowToDisplay: function(window) {
            var display = this.currentDisplay(), context = display && display.context, canvas = context && context.canvas;
            if (!window || !context) return window;
            window.display = display;
            window.context = context;
            window.canvas = canvas || window.canvas;
            sdlInstallDisplayResizeCallback(display, window);
            // In the browser, SqueakJS owns canvas CSS layout and backing-store
            // resize. Bind SDL's logical window to that actual backing-store size
            // instead of forcing Pharo's requested CreateWindow size into the
            // canvas and stretching it over the browser area.
            if (!sdlSyncWindowToDisplay(window, false) && window.canvas) {
                if ((window.width | 0) > 0) window.canvas.width = window.width | 0;
                if ((window.height | 0) > 0) window.canvas.height = window.height | 0;
            }
            display.sdlWindow = window;
            display.sdlEventQueue = display.sdlEventQueue || [];
            display.sdlKeyboardDirect = true;
            applySDLCursorToWindow(window);
            return window;
        },
        queueEvent: function(evt, display) {
            if (!evt) return;
            this.rememberEventState(evt);
            if (display) {
                display.sdlEventQueue = display.sdlEventQueue || [];
                display.sdlEventQueue.push(evt);
            } else this.eventQueue.push(evt);
        },
        rememberEventState: function(evt) {
            var type = evt && (evt.type >>> 0);
            if (type === 0x300 || type === 0x301) {
                var scancode = evt.scancode | 0;
                if (scancode >= 0 && scancode < this.keyboardState.length) this.keyboardState[scancode] = type === 0x300 ? 1 : 0;
                this.modState = evt.mod >>> 0;
            } else if (type === 0x400 || type === 0x401 || type === 0x402 || type === 0x403) {
                this.lastMouseState = {
                    x: evt.x === undefined ? this.lastMouseState.x : evt.x | 0,
                    y: evt.y === undefined ? this.lastMouseState.y : evt.y | 0,
                    buttons: evt.buttons === undefined ? (evt.state === undefined ? this.lastMouseState.buttons : evt.state | 0) : evt.buttons | 0
                };
            }
        },
        queueBrowserKeyEvent: function(display, evt, down) {
            var window = display && display.sdlWindow || this.defaultWindow(), windowID = window && window.id || 0,
                scancode = sdlScancodeForBrowserEvent(evt), sym = sdlKeySymForBrowserEvent(evt), mod = sdlModMaskFromBrowserEvent(evt),
                type = down ? 0x300 : 0x301;
            this.queueEvent({ type: type, windowID: windowID, timestamp: browserKeyboardEventTimestamp(evt), state: down ? 1 : 0, repeat: down && evt && evt.repeat ? 1 : 0, scancode: scancode, sym: sym, mod: mod }, display);
            return true;
        },
        queueBrowserKeyDown: function(display, evt) {
            return this.queueBrowserKeyEvent(display, evt || {}, true);
        },
        queueBrowserKeyUp: function(display, evtOrUnicode, modifiers) {
            if (evtOrUnicode && typeof evtOrUnicode === "object" && (evtOrUnicode.key !== undefined || evtOrUnicode.code !== undefined))
                return this.queueBrowserKeyEvent(display, evtOrUnicode, false);
            var unicode = evtOrUnicode | 0, window = display && display.sdlWindow || this.defaultWindow(), windowID = window && window.id || 0,
                scancode = sdlScancodeForUnicode(unicode), sym = sdlKeySymForUnicode(unicode), mod = sdlModMaskFromSqueak(modifiers || 0);
            this.queueEvent({ type: 0x301, windowID: windowID, state: 0, repeat: 0, scancode: scancode, sym: sym, mod: mod }, display);
            return true;
        },
        queueBrowserTextInput: function(display, text, timestamp) {
            if (text === null || text === undefined || text === "") return false;
            var window = display && display.sdlWindow || this.defaultWindow(), windowID = window && window.id || 0;
            this.queueEvent({ type: 0x303, windowID: windowID, timestamp: timestamp === undefined ? undefined : timestamp >>> 0, text: String(text) }, display);
            return true;
        },
        queueWindowEvent: function(window, event, data1, data2) {
            this.queueEvent({ type: 0x200, windowID: window && window.id || 0, event: event, data1: data1 || 0, data2: data2 || 0 }, window && window.display);
        },
        enqueueSqueakDisplayEvent: function(display, event) {
            if (!event || !display) return;
            var window = display.sdlWindow || this.defaultWindow(), windowID = window && window.id || 0,
                eventTypeMouse = Squeak.EventTypeMouse || 1,
                eventTypeKeyboard = Squeak.EventTypeKeyboard || 2,
                eventTypeWindow = Squeak.EventTypeWindow || 5,
                eventTypeMouseWheel = Squeak.EventTypeMouseWheel || 7;
            switch (event[0]) {
                case eventTypeMouse: {
                    var x = event[2] | 0, y = event[3] | 0, squeakButtons = event[4] | 0, buttons = sdlButtonMaskFromSqueak(squeakButtons),
                        last = this.lastMouseState || { x: x, y: y, buttons: 0 },
                        changed = buttons ^ (last.buttons | 0), type = 0x400;
                    if (changed) type = buttons ? 0x401 : 0x402;
                    var button = changed & 1 ? 1 : changed & 2 ? 2 : changed & 4 ? 3 : 0;
                    this.queueEvent({ type: type, windowID: windowID, state: type === 0x401 ? 1 : type === 0x402 ? 0 : buttons, buttons: buttons, button: button, x: x, y: y, xrel: x - (last.x | 0), yrel: y - (last.y | 0) }, display);
                    break;
                }
                case eventTypeMouseWheel:
                    this.queueEvent({ type: 0x403, windowID: windowID, x: event[2] | 0, y: event[3] | 0, direction: 0 }, display);
                    break;
                case eventTypeKeyboard: {
                    var unicode = event[5] || event[2] || 0, scancode = sdlScancodeForUnicode(unicode), mod = sdlModMaskFromSqueak(event[4] | 0);
                    this.queueEvent({ type: 0x300, windowID: windowID, state: 1, repeat: 0, scancode: scancode, sym: sdlKeySymForUnicode(unicode), mod: mod }, display);
                    if (unicode >= 32) this.queueEvent({ type: 0x303, windowID: windowID, text: String.fromCharCode(unicode) }, display);
                    break;
                }
                case eventTypeWindow:
                    this.queueEvent({ type: 0x200, windowID: windowID, event: event[2] | 0, data1: event[3] | 0, data2: event[4] | 0 }, display);
                    break;
            }
        },
        SDL_SetHint: function(name, value) { this.hints[makeCString(name)] = makeCString(value); return 1; },
        SDL_GetError: function() { return this.lastError || ""; },
        SDL_ClearError: function() { this.lastError = ""; },
        SDL_Init: function(flags) { this.initFlags |= flags >>> 0; return 0; },
        SDL_InitSubSystem: function(flags) { this.initFlags |= flags >>> 0; return 0; },
        SDL_Quit: function() { this.initFlags = 0; },
        SDL_QuitSubSystem: function(flags) { this.initFlags &= ~(flags >>> 0); },
        SDL_WasInit: function(flags) { flags = flags >>> 0; return flags ? (this.initFlags & flags) : this.initFlags; },
        SDL_GetTicks: function() { return (Date.now() - this.startTime) >>> 0; },
        SDL_Delay: function(_milliseconds) { },
        SDL_GetVersion: function(ver) {
            writeUint8Pointer(ver, 0, 2);
            writeUint8Pointer(ver, 1, 24);
            writeUint8Pointer(ver, 2, 1);
        },
        SDL_GetDisplayDPI: function(_displayIndex, ddpi, hdpi, vdpi) {
            writeFloat32Pointer(ddpi, 96);
            writeFloat32Pointer(hdpi, 96);
            writeFloat32Pointer(vdpi, 96);
            return 0;
        },
        SDL_ShowCursor: function(toggle) {
            toggle = toggle | 0;
            if (toggle >= 0) {
                this.cursorVisible = toggle !== 0;
                applySDLCursorToDisplays();
            }
            return this.cursorVisible !== false ? 1 : 0;
        },
        SDL_GetMouseState: function(x, y) {
            var display = this.currentDisplay(), state = this.lastMouseState || { x: 0, y: 0, buttons: 0 };
            if (display) {
                state = { x: display.mouseX | 0, y: display.mouseY | 0, buttons: sdlButtonMaskFromSqueak(display.buttons & Squeak.Mouse_All) };
                this.lastMouseState = state;
            }
            writeInt32Pointer(x, state.x | 0);
            writeInt32Pointer(y, state.y | 0);
            return state.buttons | 0;
        },
        SDL_GetGlobalMouseState: function(x, y) { return this.SDL_GetMouseState(x, y); },
        SDL_GetRelativeMouseState: function(x, y) {
            writeInt32Pointer(x, 0);
            writeInt32Pointer(y, 0);
            return (this.lastMouseState && this.lastMouseState.buttons) | 0;
        },
        SDL_CaptureMouse: function(_enabled) { return 0; },
        SDL_SetRelativeMouseMode: function(enabled) { this.relativeMouseMode = !!enabled; return 0; },
        SDL_GetRelativeMouseMode: function() { return this.relativeMouseMode ? 1 : 0; },
        SDL_GetModState: function() { return this.modState >>> 0; },
        SDL_SetModState: function(modstate) { this.modState = modstate >>> 0; },
        SDL_GetKeyboardFocus: function() { return this.defaultWindow(); },
        SDL_GetMouseFocus: function() { return this.defaultWindow(); },
        SDL_GetKeyboardState: function(numkeys) {
            writeInt32Pointer(numkeys, this.keyboardState.length);
            return this.keyboardState;
        },
        SDL_EventState: function(_type, state) { return state & 255; },
        SDL_PumpEvents: function() { },
        sdlEventQueueForCurrentDisplay: function() {
            var display = this.currentDisplay();
            return display && display.sdlEventQueue ? display.sdlEventQueue : this.eventQueue;
        },
        SDL_PollEvent: function(event) {
            var queue = this.sdlEventQueueForCurrentDisplay(), evt = queue && queue.shift && queue.shift();
            if (!evt) return 0;
            return writeSDLEvent(event, evt) ? 1 : 0;
        },
        SDL_WaitEvent: function(event) { return this.SDL_PollEvent(event); },
        SDL_WaitEventTimeout: function(event, _timeout) { return this.SDL_PollEvent(event); },
        SDL_HasEvent: function(type) { return this.SDL_HasEvents(type, type); },
        SDL_HasEvents: function(minType, maxType) {
            var queue = this.sdlEventQueueForCurrentDisplay();
            if (!queue) return 0;
            for (var i = 0; i < queue.length; i++) if (eventMatchesType(queue[i], minType, maxType)) return 1;
            return 0;
        },
        SDL_FlushEvent: function(type) { this.SDL_FlushEvents(type, type); },
        SDL_FlushEvents: function(minType, maxType) {
            var queue = this.sdlEventQueueForCurrentDisplay();
            if (!queue) return;
            for (var i = queue.length - 1; i >= 0; i--) if (eventMatchesType(queue[i], minType, maxType)) queue.splice(i, 1);
        },
        SDL_PeepEvents: function(events, numevents, action, minType, maxType) {
            var queue = this.sdlEventQueueForCurrentDisplay(), count = Math.max(0, numevents | 0), act = action | 0;
            if (!queue || count <= 0) return 0;
            if (act === 0) { // SDL_ADDEVENT
                var added = 0, view = dataView(events);
                for (var i = 0; view && i < count && i * 56 + 8 <= view.byteLength; i++) {
                    var raw = new Uint8Array(Math.min(56, view.byteLength - i * 56));
                    for (var j = 0; j < raw.length; j++) raw[j] = view.getUint8(i * 56 + j);
                    queue.push({ type: new DataView(raw.buffer).getUint32(0, true), rawData: raw });
                    added++;
                }
                return added;
            }
            var matched = [], remove = act === 2; // SDL_GETEVENT
            for (var qi = 0; qi < queue.length && matched.length < count; qi++) {
                if (eventMatchesType(queue[qi], minType, maxType)) {
                    matched.push(queue[qi]);
                    if (remove) { queue.splice(qi, 1); qi--; }
                }
            }
            for (var mi = 0; mi < matched.length; mi++) {
                var ptr = events;
                if (events && events.jsData instanceof ArrayBuffer) ptr = { jsData: events.jsData.slice(mi * 56, mi * 56 + 56) };
                if (ptr && ptr.jsData && mi > 0) {
                    var dst = new Uint8Array(events.jsData, mi * 56, Math.min(56, events.jsData.byteLength - mi * 56));
                    var tmp = new ArrayBuffer(dst.length), tmpPtr = { jsData: tmp };
                    writeSDLEvent(tmpPtr, matched[mi]);
                    dst.set(new Uint8Array(tmp));
                } else writeSDLEvent(ptr, matched[mi]);
            }
            return matched.length;
        },
        SDL_PushEvent: function(event) {
            var evt = parseSDLEvent(event);
            if (!evt) return -1;
            this.queueEvent(evt, this.currentDisplay());
            return 1;
        },
        SDL_RegisterEvents: function(numevents) {
            var n = numevents | 0;
            if (n <= 0 || this.nextUserEventType + n > 0xFFFF) return 0xFFFFFFFF;
            var first = this.nextUserEventType;
            this.nextUserEventType += n;
            return first;
        },
        SDL_SetClipboardText: function(text) { this.clipboardText = makeCString(text); return 0; },
        SDL_GetClipboardText: function() { return this.clipboardText; },
        SDL_Free: function(_ptr) { },
        SDL_NumJoysticks: function() { return 0; },
        SDL_IsGameController: function(_deviceIndex) { return 0; },
        SDL_GameControllerNameForIndex: function(_deviceIndex) { return null; },
        SDL_GameControllerOpen: function(_deviceIndex) { return null; },
        SDL_JoystickOpen: function(_deviceIndex) { return null; },
        SDL_JoystickEventState: function(state) { return state; },
        SDL_OpenAudioDevice: function(_device, _isCapture, _desired, _obtained, _allowedChanges) { return 1; },
        SDL_CloseAudioDevice: function(_dev) { },
        SDL_PauseAudioDevice: function(_dev, _pauseOn) { },
        SDL_QueueAudio: function(_dev, _data, len) { return len ? 0 : 0; },
        SDL_GetQueuedAudioSize: function(_dev) { return 0; },
        SDL_GetNumAudioDevices: function(_isCapture) { return 0; },
        SDL_GetAudioDeviceName: function(_index, _isCapture) { return null; },
        SDL_CreateWindow: function(title, x, y, w, h, flags) {
            var window = sdlHandle("window", {
                title: makeCString(title), x: x | 0, y: y | 0, width: w | 0, height: h | 0,
                flags: flags >>> 0, shown: !!(flags & 4), surface: null
            });
            this.windowsById[window.id] = window;
            this.bindWindowToDisplay(window);
            this.queueWindowEvent(window, 1, window.width, window.height); // SDL_WINDOWEVENT_SHOWN
            this.queueWindowEvent(window, 3, window.width, window.height); // SDL_WINDOWEVENT_EXPOSED
            return window;
        },
        SDL_DestroyWindow: function(window) {
            if (window && window.id) {
                this.queueWindowEvent(window, 14, 0, 0); // SDL_WINDOWEVENT_CLOSE
                if (window.display && window.display.sdlWindow === window) window.display.sdlWindow = null;
                delete this.windowsById[window.id];
                delete this.handles[window.id];
            }
        },
        SDL_GetWindowID: function(window) { return window && window.id ? window.id : 0; },
        SDL_GetWindowFlags: function(window) { return window && window.flags !== undefined ? window.flags >>> 0 : 0; },
        SDL_GetWindowTitle: function(window) { return window && window.title !== undefined ? window.title : ""; },
        SDL_SetWindowTitle: function(window, title) { if (window) window.title = makeCString(title); },
        SDL_ShowWindow: function(window) { if (window) window.shown = true; },
        SDL_HideWindow: function(window) { if (window) window.shown = false; },
        SDL_RaiseWindow: function(_window) { },
        SDL_MaximizeWindow: function(window) { if (window) window.maximized = true; },
        SDL_MinimizeWindow: function(window) { if (window) window.minimized = true; },
        SDL_RestoreWindow: function(window) { if (window) { window.maximized = false; window.minimized = false; } },
        SDL_SetWindowBordered: function(window, bordered) { if (window) window.borderless = !bordered; },
        SDL_SetWindowFullscreen: function(window, flags) { if (window) window.fullscreenFlags = flags >>> 0; return 0; },
        SDL_SetWindowPosition: function(window, x, y) { if (window) { window.x = x | 0; window.y = y | 0; } },
        SDL_GetWindowPosition: function(window, x, y) { writeInt32Pointer(x, window ? window.x : 0); writeInt32Pointer(y, window ? window.y : 0); },
        SDL_SetWindowSize: function(window, w, h) {
            if (window) {
                var displaySize = sdlBrowserManagedSize(window.display);
                if (displaySize && displaySize.managed) {
                    // Browser-hosted SDL windows are controlled by the canvas
                    // layout. Preserve the available browser size and report it
                    // back to Pharo instead of reintroducing CSS/backing-store
                    // aspect mismatch.
                    sdlSyncWindowToDisplay(window, true);
                } else {
                    window.width = w | 0;
                    window.height = h | 0;
                    if (window.canvas) { window.canvas.width = window.width; window.canvas.height = window.height; }
                    sdlResizeWindowSurface(window);
                    this.queueWindowEvent(window, 6, window.width, window.height); // SDL_WINDOWEVENT_SIZE_CHANGED
                }
            }
            return 0;
        },
        SDL_GetWindowSize: function(window, w, h) { sdlSyncWindowToDisplay(window, true); writeInt32Pointer(w, window ? window.width : 0); writeInt32Pointer(h, window ? window.height : 0); },
        SDL_GL_GetDrawableSize: function(window, w, h) { this.SDL_GetWindowSize(window, w, h); },
        SDL_GetWindowDisplayIndex: function(_window) { return 0; },
        SDL_GetWindowWMInfo: function(_window, _info) { return 0; },
        SDL_SetWindowHitTest: function(_window, _callback, _userdata) { return 0; },
        SDL_StartTextInput: function() { this.textInputActive = true; },
        SDL_StopTextInput: function() { this.textInputActive = false; },
        SDL_IsTextInputActive: function() { return !!this.textInputActive; },
        SDL_SetTextInputRect: function(_rect) { },
        SDL_GetWindowSurface: function(window) {
            if (!window) return null;
            if (!window.surface) window.surface = sdlHandle("surface", { window: window, width: window.width, height: window.height, depth: 32, pitch: window.width * 4, pixels: new ArrayBuffer(Math.max(0, window.width * window.height * 4)) });
            return window.surface;
        },
        SDL_UpdateWindowSurface: function(window) {
            if (!window || !window.surface) return 0;
            copyPixelsToCanvas(window.context, window.surface.pixels, window.surface.width, window.surface.height);
            return 0;
        },
        SDL_UpdateWindowSurfaceRects: function(window, rects, numrects) {
            if (!window || !window.surface) return 0;
            var view = dataView(rects), count = numrects | 0;
            if (!view || count <= 0) return this.SDL_UpdateWindowSurface(window);
            for (var i = 0; i < count; i++) {
                var rect = { x: view.getInt32(i * 16, true), y: view.getInt32(i * 16 + 4, true), w: view.getInt32(i * 16 + 8, true), h: view.getInt32(i * 16 + 12, true) };
                copyPixelsToCanvas(window.context, window.surface.pixels, window.surface.width, window.surface.height, rect);
            }
            return 0;
        },
        SDL_SetWindowIcon: function(_window, _surface) { },
        SDL_CreateRenderer: function(window, driverIndex, flags) {
            if (window) this.bindWindowToDisplay(window);
            return sdlHandle("renderer", { window: window, context: window && window.context, driverIndex: driverIndex | 0, flags: flags >>> 0, drawColor: [0, 0, 0, 255], target: null });
        },
        SDL_DestroyRenderer: function(_renderer) { },
        SDL_GetRendererOutputSize: function(renderer, w, h) { var win = renderer && renderer.window; sdlSyncWindowToDisplay(win, true); writeInt32Pointer(w, win ? win.width : 0); writeInt32Pointer(h, win ? win.height : 0); return 0; },
        SDL_RenderGetLogicalSize: function(renderer, w, h) { return this.SDL_GetRendererOutputSize(renderer, w, h); },
        SDL_GetRendererInfo: function(_renderer, _info) { return 0; },
        SDL_RenderTargetSupported: function(_renderer) { return 1; },
        SDL_SetRenderTarget: function(renderer, target) { if (renderer) renderer.target = target || null; return 0; },
        SDL_SetRenderDrawBlendMode: function(renderer, mode) { if (renderer) renderer.blendMode = mode; return 0; },
        SDL_SetRenderDrawColor: function(renderer, r, g, b, a) { if (renderer) renderer.drawColor = [r & 255, g & 255, b & 255, a & 255]; return 0; },
        SDL_RenderSetClipRect: function(renderer, rect) { if (renderer) renderer.clipRect = rect || null; return 0; },
        SDL_RenderClear: function(renderer) {
            if (renderer && renderer.context && renderer.context.fillRect) {
                var c = renderer.drawColor || [0, 0, 0, 255], ctx = renderer.context;
                if (ctx.save) ctx.save();
                if ('fillStyle' in ctx) ctx.fillStyle = "rgba(" + (c[0] & 255) + "," + (c[1] & 255) + "," + (c[2] & 255) + "," + ((c[3] & 255) / 255) + ")";
                ctx.fillRect(0, 0, renderer.window ? renderer.window.width : 0, renderer.window ? renderer.window.height : 0);
                if (ctx.restore) ctx.restore();
            }
            return 0;
        },
        SDL_RenderPresent: function(renderer) {
            if (renderer && renderer.presentTexture) this.SDL_RenderCopy(renderer, renderer.presentTexture, null, null);
            if (renderer && renderer.window && renderer.window.display) {
                var display = renderer.window.display;
                display.sdlPresentCount = (display.sdlPresentCount || 0) + 1;
                display.sdlLastPresent = {
                    windowID: renderer.window.id || 0,
                    width: renderer.window.width || 0,
                    height: renderer.window.height || 0,
                    copies: renderer.copyCount || 0
                };
                if (display.changedCallback) display.changedCallback();
                if (display.vm && display.vm.breakOut) display.vm.breakOut();
            }
        },
        SDL_RenderDrawPoint: function(renderer, x, y) {
            if (!renderer || !renderer.context || !renderer.context.fillRect) return 0;
            var c = renderer.drawColor || [0, 0, 0, 255], ctx = renderer.context;
            if ('fillStyle' in ctx) ctx.fillStyle = "rgba(" + (c[0] & 255) + "," + (c[1] & 255) + "," + (c[2] & 255) + "," + ((c[3] & 255) / 255) + ")";
            ctx.fillRect(x | 0, y | 0, 1, 1);
            return 0;
        },
        SDL_RenderDrawLine: function(renderer, x1, y1, x2, y2) {
            if (!renderer || !renderer.context || !renderer.context.beginPath) return 0;
            var c = renderer.drawColor || [0, 0, 0, 255], ctx = renderer.context;
            if ('strokeStyle' in ctx) ctx.strokeStyle = "rgba(" + (c[0] & 255) + "," + (c[1] & 255) + "," + (c[2] & 255) + "," + ((c[3] & 255) / 255) + ")";
            ctx.beginPath(); ctx.moveTo(x1 | 0, y1 | 0); ctx.lineTo(x2 | 0, y2 | 0); ctx.stroke();
            return 0;
        },
        SDL_RenderDrawRect: function(renderer, rect) {
            if (!renderer || !renderer.context || !renderer.context.strokeRect) return 0;
            var r = readSDLRect(rect) || { x: 0, y: 0, w: renderer.window ? renderer.window.width : 0, h: renderer.window ? renderer.window.height : 0 },
                c = renderer.drawColor || [0, 0, 0, 255], ctx = renderer.context;
            if ('strokeStyle' in ctx) ctx.strokeStyle = "rgba(" + (c[0] & 255) + "," + (c[1] & 255) + "," + (c[2] & 255) + "," + ((c[3] & 255) / 255) + ")";
            ctx.strokeRect(r.x | 0, r.y | 0, r.w | 0, r.h | 0);
            return 0;
        },
        SDL_RenderFillRect: function(renderer, rect) {
            if (!renderer) return 0;
            var r = readSDLRect(rect) || { x: 0, y: 0, w: renderer.window ? renderer.window.width : 0, h: renderer.window ? renderer.window.height : 0 },
                c = renderer.drawColor || [0, 0, 0, 255];
            if (renderer.context && renderer.context.fillRect) {
                var ctx = renderer.context;
                if ('fillStyle' in ctx) ctx.fillStyle = "rgba(" + (c[0] & 255) + "," + (c[1] & 255) + "," + (c[2] & 255) + "," + ((c[3] & 255) / 255) + ")";
                ctx.fillRect(r.x | 0, r.y | 0, r.w | 0, r.h | 0);
            }
            if (renderer.target && renderer.target.pixels) {
                var dest = byteView(renderer.target.pixels), width = renderer.target.width | 0, height = renderer.target.height | 0,
                    x0 = Math.max(0, r.x | 0), y0 = Math.max(0, r.y | 0),
                    x1 = Math.min(width, x0 + Math.max(0, r.w | 0)), y1 = Math.min(height, y0 + Math.max(0, r.h | 0));
                if (dest) for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) {
                    var o = (yy * width + xx) * 4; dest[o] = c[0] & 255; dest[o + 1] = c[1] & 255; dest[o + 2] = c[2] & 255; dest[o + 3] = c[3] & 255;
                }
            }
            return 0;
        },
        SDL_RenderCopy: function(renderer, texture, srcRect, dstRect) {
            if (!renderer || !texture) return 0;
            renderer.presentTexture = texture;
            renderer.copyCount = (renderer.copyCount || 0) + 1;
            var src = readSDLRect(srcRect) || { x: 0, y: 0, w: texture.width, h: texture.height },
                dst = readSDLRect(dstRect) || { x: src.x | 0, y: src.y | 0, w: src.w | 0, h: src.h | 0 };
            renderer.lastCopy = { src: { x: src.x | 0, y: src.y | 0, w: src.w | 0, h: src.h | 0 }, dst: { x: dst.x | 0, y: dst.y | 0, w: dst.w | 0, h: dst.h | 0 } };
            if (renderer.window && renderer.window.display) renderer.window.display.sdlLastCopy = renderer.lastCopy;
            if (renderer.context) copyPixelsToCanvas(renderer.context, texture.pixels, texture.width, texture.height, src, dst);
            if (renderer.target && renderer.target.pixels) blitRGBA(renderer.target.pixels, renderer.target.width, renderer.target.height, texture.pixels, texture.width, texture.height, src, dst, texture.pitch);
            return 0;
        },
        SDL_CreateTexture: function(renderer, format, access, width, height) { return sdlHandle("texture", { renderer: renderer, format: format >>> 0, access: access | 0, width: width | 0, height: height | 0, pitch: (width | 0) * 4, pixels: new ArrayBuffer(Math.max(0, (width | 0) * (height | 0) * 4)) }); },
        SDL_DestroyTexture: function(_texture) { },
        SDL_SetTextureBlendMode: function(texture, mode) { if (texture) texture.blendMode = mode; return 0; },
        SDL_SetTextureAlphaMod: function(texture, alpha) { if (texture) texture.alpha = alpha & 255; return 0; },
        SDL_SetTextureColorMod: function(texture, r, g, b) { if (texture) texture.colorMod = [r & 255, g & 255, b & 255]; return 0; },
        SDL_UpdateTexture: function(texture, rect, pixels, pitch) {
            if (!texture || !texture.pixels) return -1;
            var r = readSDLRect(rect) || { x: 0, y: 0, w: texture.width, h: texture.height };
            return blitSDLToRGBATexture(texture, r, pixels, pitch | 0 || r.w * 4) ? 0 : -1;
        },
        SDL_LockTexture: function(texture, rect, pixels, pitch) {
            if (!texture || !texture.pixels) return -1;
            var r = readSDLRect(rect) || { x: 0, y: 0, w: texture.width, h: texture.height },
                lock = makeSDLTextureLockBuffer(texture, r),
                handle = registerPointerData(lock.buffer);
            texture.lockedPixels = lock.buffer;
            texture.lockedPitch = lock.pitch;
            texture.lockedRect = r;
            texture.lockedPointerHandle = handle;
            writeInt32Pointer(pitch, lock.pitch);
            if (pixels) {
                writePointerValue(pixels, handle);
                pixels.jsData = lock.buffer;
                if (pixels instanceof ArrayBuffer || ArrayBuffer.isView(pixels)) pixels.squeakJSFFIPointerValue = lock.buffer;
            }
            return 0;
        },
        SDL_UnlockTexture: function(texture) {
            if (texture && texture.lockedPixels) {
                blitSDLToRGBATexture(texture, texture.lockedRect || { x: 0, y: 0, w: texture.width, h: texture.height }, texture.lockedPixels, texture.lockedPitch || texture.width * 4);
                unregisterPointerData(texture.lockedPointerHandle);
                delete texture.lockedPixels;
                delete texture.lockedPitch;
                delete texture.lockedRect;
                delete texture.lockedPointerHandle;
            }
        },
        SDL_CreateRGBSurface: function(_flags, width, height, depth, rmask, gmask, bmask, amask) { return sdlHandle("surface", { width: width | 0, height: height | 0, depth: depth | 0, pitch: (width | 0) * Math.max(1, (depth | 0) >>> 3), rmask: rmask >>> 0, gmask: gmask >>> 0, bmask: bmask >>> 0, amask: amask >>> 0, pixels: new ArrayBuffer(Math.max(0, (width | 0) * (height | 0) * 4)) }); },
        SDL_CreateRGBSurfaceFrom: function(pixels, width, height, depth, pitch, rmask, gmask, bmask, amask) { return sdlHandle("surface", { width: width | 0, height: height | 0, depth: depth | 0, pitch: pitch | 0, rmask: rmask >>> 0, gmask: gmask >>> 0, bmask: bmask >>> 0, amask: amask >>> 0, pixels: pixels }); },
        SDL_FreeSurface: function(_surface) { },
        SDL_LockSurface: function(_surface) { return 0; },
        SDL_UnlockSurface: function(_surface) { return 0; },
        SDL_CreateCursor: function(data, mask, w, h, hotX, hotY) {
            return sdlHandle("cursor", { width: w | 0, height: h | 0, hotX: hotX | 0, hotY: hotY | 0, cssDataURL: customCursorSVGDataURI(data, mask, w, h) });
        },
        SDL_CreateColorCursor: function(surface, hotX, hotY) {
            return sdlHandle("cursor", { width: surface && surface.width | 0, height: surface && surface.height | 0, hotX: hotX | 0, hotY: hotY | 0, cssDataURL: surfaceCursorDataURI(surface) });
        },
        SDL_CreateSystemCursor: function(cursorId) { return sdlHandle("cursor", { systemCursor: cursorId | 0, cssCursor: sdlSystemCursorCSS(cursorId) }); },
        SDL_GetCursor: function() { return this.currentCursor || sdlDefaultCursor(); },
        SDL_GetDefaultCursor: function() { return sdlDefaultCursor(); },
        SDL_FreeCursor: function(cursor) {
            if (cursor && cursor !== this.defaultCursor) {
                delete this.handles[cursor.id];
                if (this.currentCursor === cursor) this.currentCursor = sdlDefaultCursor();
                applySDLCursorToDisplays();
            }
        },
        SDL_SetCursor: function(cursor) {
            this.currentCursor = cursor || sdlDefaultCursor();
            applySDLCursorToDisplays();
        },
        SDL_GL_SetAttribute: function(_attr, _value) { return 0; },
        SDL_GL_GetAttribute: function(_attr, value) { writeInt32Pointer(value, 0); return 0; },
        SDL_GL_CreateContext: function(window) { return sdlHandle("glcontext", { window: window }); },
        SDL_GL_DeleteContext: function(_context) { },
        SDL_GL_MakeCurrent: function(_window, _context) { return 0; },
        SDL_GL_SwapWindow: function(_window) { },
        SDL_GL_GetProcAddress: function(_procName) { return null; },
        SDL_ComposeCustomBlendMode: function(srcColorFactor, dstColorFactor, colorOperation, srcAlphaFactor, dstAlphaFactor, alphaOperation) {
            return (((srcColorFactor & 31) << 27) ^ ((dstColorFactor & 31) << 22) ^ ((colorOperation & 15) << 18) ^ ((srcAlphaFactor & 31) << 13) ^ ((dstAlphaFactor & 31) << 8) ^ (alphaOperation & 15)) >>> 0;
        },
        ffiFunctionNotFoundHandler: libc.ffiFunctionNotFoundHandler
    };

    Squeak.FFIEmulation.registerLibrary("libc", [
        "c", "libc.so", "libc.so.6", "libSystem.B.dylib", "libSystem.dylib",
        "msvcrt", "msvcrt.dll", "ucrtbase", "ucrtbase.dll", "cygwin1.dll"
    ], libc);
    Squeak.FFIEmulation.registerLibrary("libm", ["m", "libm.so", "libm.so.6", "libm.dylib"], libm);
    Squeak.FFIEmulation.registerLibrary("libdl", ["dl", "libdl.so", "libdl.so.2"], libdl);
    Squeak.FFIEmulation.registerLibrary("libfreetype", ["freetype", "libfreetype.so", "libfreetype.so.6"], freetype);
    Squeak.FFIEmulation.registerLibrary("libSDL2-2.0", ["SDL2", "SDL2-2.0", "libSDL2-2.0.so", "libSDL2-2.0.so.0"], sdl2);
})();
