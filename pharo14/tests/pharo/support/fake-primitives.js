"use strict";

const path = require("path");
const loadSqueakJS = require("./load-squeakjs");
const rootDir = path.resolve(__dirname, "..", "..", "..");
const Sq = loadSqueakJS(rootDir);

function makeClass(name, superclass) {
    const cls = { name };
    cls.superclass = function() { return superclass || { isNil: true }; };
    return cls;
}

const Classes = {
    Object: makeClass("Object"),
};
Classes.String = makeClass("String", Classes.Object);
Classes.Array = makeClass("Array", Classes.Object);
Classes.LargePositiveInteger = makeClass("LargePositiveInteger", Classes.Object);
Classes.LargeNegativeInteger = makeClass("LargeNegativeInteger", Classes.Object);
Classes.ByteArray = makeClass("ByteArray", Classes.Object);
Classes.Float = makeClass("Float", Classes.Object);
Classes.Semaphore = makeClass("Semaphore", Classes.Object);
Classes.SymbolTableSemaphore = makeClass("SymbolTableSemaphore", Classes.Semaphore);
Classes.ExternalAddress = makeClass("ExternalAddress", Classes.Object);
Classes.ExternalData = makeClass("ExternalData", Classes.Object);
Classes.ExternalFunction = makeClass("ExternalFunction", Classes.Object);

class FakeByteObject {
    constructor(sqClass, size) {
        this.sqClass = sqClass;
        this.bytes = new Uint8Array(size);
    }
    bytesSize() { return this.bytes.length; }
    bytesAsString() { return Array.from(this.bytes, b => String.fromCharCode(b)).join(""); }
    wordsOrBytes() { return new Uint32Array(this.bytes.buffer, 0, this.bytes.length >>> 2); }
    isBytes() { return true; }
    isWords() { return false; }
    isWordsOrBytes() { return true; }
}

class FakePointerObject {
    constructor(sqClass, size) {
        this.sqClass = sqClass;
        this.pointers = new Array(size);
    }
}

class FakeVM {
    constructor(stack, options) {
        options = options || {};
        this.stack = stack ? stack.slice() : [];
        this.sp = this.stack.length - 1;
        this.nilObj = { isNil: true };
        this.trueObj = { isTrue: true };
        this.falseObj = { isFalse: true };
        this.specialObjects = [];
        this.specialObjects[Sq.splOb_NilObject] = this.nilObj;
        this.specialObjects[Sq.splOb_FalseObject] = this.falseObj;
        this.specialObjects[Sq.splOb_TrueObject] = this.trueObj;
        this.specialObjects[Sq.splOb_ClassString] = Classes.String;
        this.specialObjects[Sq.splOb_ClassArray] = Classes.Array;
        this.specialObjects[Sq.splOb_ClassLargePositiveInteger] = Classes.LargePositiveInteger;
        this.specialObjects[Sq.splOb_ClassLargeNegativeInteger] = Classes.LargeNegativeInteger;
        this.specialObjects[Sq.splOb_ClassByteArray] = Classes.ByteArray;
        this.specialObjects[Sq.splOb_ClassFloat] = Classes.Float;
        this.specialObjects[Sq.splOb_ClassSemaphore] = Classes.Semaphore;
        this.specialObjects[Sq.splOb_ClassExternalAddress] = Classes.ExternalAddress;
        this.specialObjects[Sq.splOb_ClassExternalData] = Classes.ExternalData;
        this.specialObjects[Sq.splOb_ClassExternalFunction] = Classes.ExternalFunction;
        this.image = Object.assign({
            isSpur: true,
            is64Bit: true,
            bytesPerWord: 8,
            oldSpaceBytes: 0,
            totalMemory: 0,
            allocationCount: 0,
            newSpaceCount: 0,
            gcCount: 0,
            gcMilliseconds: 0,
            pgcCount: 0,
            pgcMilliseconds: 0,
            gcTenured: 0,
            extraVMMemory: 0,
            bytesLeft: () => 0,
            formatVersion: () => 68021,
        }, options.image || {});
        this.options = options.vmOptions || {};
    }
    stackValue(nDeep) { return this.stack[this.stack.length - 1 - nDeep]; }
    top() { return this.stack[this.stack.length - 1]; }
    popN(n) {
        this.stack.splice(this.stack.length - n, n);
        this.sp = this.stack.length - 1;
    }
    popNandPush(n, value) {
        this.stack.splice(this.stack.length - n, n, value);
        this.lastPushed = value;
        this.sp = this.stack.length - 1;
    }
    pop2AndPushBoolResult(value) {
        this.popNandPush(2, value ? this.trueObj : this.falseObj);
        return true;
    }
    canBeSmallInt(value) {
        const min = this.image.is64Bit ? -Math.pow(2, 53) : Sq.MinSmallInt;
        const max = this.image.is64Bit ? Math.pow(2, 53) - 1 : Sq.MaxSmallInt;
        return Number.isInteger(value) && value >= min && value <= max;
    }
    instantiateClass(sqClass, size) {
        if (sqClass === this.specialObjects[Sq.splOb_ClassArray] ||
            sqClass === this.specialObjects[Sq.splOb_ClassExternalData] ||
            sqClass === this.specialObjects[Sq.splOb_ClassExternalFunction]) return new FakePointerObject(sqClass, size);
        return new FakeByteObject(sqClass, size);
    }
    warnOnce() {}
}

function makePrimitive(stack, display, options) {
    const prim = Object.create(Sq.Primitives.prototype);
    prim.vm = new FakeVM(stack || [], options);
    prim.vm.primHandler = prim;
    prim.display = display || {};
    prim.success = true;
    prim.initModules();
    prim.initPlugins();
    return prim;
}

function objectFromBigInt(value) {
    const prim = makePrimitive();
    return prim.objectFromBigInt(BigInt(value));
}

function bigIntFromObject(obj) {
    const prim = makePrimitive();
    return prim.bigIntFromObject(obj);
}

function stringFromObject(obj) {
    return obj && obj.bytes ? obj.bytesAsString() : obj;
}

module.exports = {
    Squeak: Sq,
    Classes,
    FakeVM,
    makePrimitive,
    objectFromBigInt,
    bigIntFromObject,
    stringFromObject,
};
