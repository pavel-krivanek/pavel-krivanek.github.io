"use strict";

const fs = require("fs");
const path = require("path");
const loadSqueakJS = require("./support/load-squeakjs");
const { makePrimitive } = require("./support/fake-primitives");

function readImage(Squeak, imagePath) {
    const image = new Squeak.Image(imagePath.replace(/\.image$/, ""));
    const bytes = fs.readFileSync(imagePath);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return new Promise((resolve, reject) => {
        try {
            image.readFromBuffer(buffer, () => resolve(image));
        } catch (error) {
            reject(error);
        }
    });
}

function pharoImagePath(context) {
    return process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
}

exports.run = async function(t, context) {
    const Squeak = loadSqueakJS(context.rootDir);

    await t.test("64-bit PC encoding uses the image word size", async t => {
        const vm = Object.create(Squeak.Interpreter.prototype);
        vm.image = { is64Bit: true, bytesPerWord: 8 };
        const method = { pointers: new Array(6) };
        t.equal(vm.encodeSqueakPC(0, method), 49, "compiled block with six pointer words starts at encoded PC 49 in a 64-bit image");
        t.equal(vm.decodeSqueakPC(49, method), 0, "encoded PC 49 decodes to bytecode index zero");
        vm.image = { is64Bit: false, bytesPerWord: 4 };
        t.equal(vm.encodeSqueakPC(0, method), 25, "the 32-bit encoding remains unchanged");
        t.equal(vm.decodeSqueakPC(25, method), 0, "the 32-bit decoding remains unchanged");
    });


    await t.test("new 64-bit Pharo compiled methods are marked for Sista dispatch", async t => {
        const image = new Squeak.Image("synthetic");
        image.is64Bit = true;
        image.isSpur = true;
        image.multipleByteCodeSetsActive = true;
        image.newSpaceCount = 0;
        image.hasNewInstances = {};
        image.lastHash = 1;
        const compiledMethodClass = {
            oop: 12345,
            pointers: [],
            className: () => "CompiledMethod",
            classInstProto: () => Squeak.ObjectSpur,
        };
        compiledMethodClass.pointers[Squeak.Class_format] = 24 << 16;
        const method = image.instantiateClass(compiledMethodClass, 4, { isNil: true });
        t.equal(method.forceSista, true, "fresh Pharo 64-bit CompiledMethod instances use Sista dispatch even before their header is populated");

        const compiledBlockClass = {
            oop: 12346,
            pointers: [],
            className: () => "CompiledBlock",
            classInstProto: () => Squeak.ObjectSpur,
        };
        compiledBlockClass.pointers[Squeak.Class_format] = 24 << 16;
        const block = image.instantiateClass(compiledBlockClass, 4, { isNil: true });
        t.equal(block.forceSista, true, "fresh Pharo 64-bit CompiledBlock instances also use Sista dispatch for runtime-created full closures");

        image.is64Bit = false;
        const oldMethod = image.instantiateClass(compiledMethodClass, 4, { isNil: true });
        const oldBlock = image.instantiateClass(compiledBlockClass, 4, { isNil: true });
        t.equal(oldMethod.forceSista, undefined, "32-bit/new-old methods keep the existing header-selected bytecode dispatch");
        t.equal(oldBlock.forceSista, undefined, "32-bit/new-old blocks keep the existing header-selected bytecode dispatch");
    });

    await t.test("Pharo 14 SystemEnvironment globals are discoverable", async t => {
        const imagePath = pharoImagePath(context);
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 globals", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const image = await readImage(Squeak, imagePath);
        const vm = new Squeak.Interpreter(image, { vmOptions: ["--headless"], argv: ["vm", imagePath, "eval", "1+2"] });
        const objectClass = vm.globalNamed("Object");
        t.ok(objectClass && !objectClass.isNil, "Object global is found through SmalltalkImage -> SystemEnvironment");
        const method = vm.findMethod("BlockClosure>>on:do:");
        t.ok(method && method.bytes && method.bytes.length > 0, "method enumeration works through the Pharo 14 global environment");
    });

    await t.test("CompiledMethod byte indexing respects 64-bit literal words", async t => {
        const imagePath = pharoImagePath(context);
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 compiled-method indexing", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const image = await readImage(Squeak, imagePath);
        const vm = new Squeak.Interpreter(image, { vmOptions: ["--headless"], argv: ["vm", imagePath, "eval", "1+2"] });
        const method = vm.findMethod("BlockClosure>>on:do:");
        const initialPC = method.pointers.length * image.bytesPerWord + 1;
        const prim = makePrimitive([method, initialPC + 1], {}, { image: { is64Bit: true, bytesPerWord: 8 } });
        prim.vm.specialSelectors = vm.specialSelectors;
        prim.initAtCache();
        t.equal(method.indexableSize(prim), method.pointers.length * 8 + method.bytes.length, "method basic size includes 8 bytes per literal/header pointer");
        t.equal(prim.objectAt(false, false, false), 199, "first primitive-index byte is readable at initialPC + 1");
        prim.vm.stack = [method, initialPC + 2];
        prim.success = true;
        t.equal(prim.objectAt(false, false, false), 0, "second primitive-index byte is readable at initialPC + 2");
    });
};
