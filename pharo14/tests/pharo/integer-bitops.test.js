"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const loadSqueakJS = require("./support/load-squeakjs");
const {
    Squeak,
    makePrimitive,
    bigIntFromObject,
} = require("./support/fake-primitives");

function makeInterpreterProbe(is64Bit) {
    const vm = Object.create(Squeak.Interpreter.prototype);
    vm.image = { is64Bit: is64Bit !== false };
    vm.success = true;
    return vm;
}

exports.run = async function(t, context) {
    loadSqueakJS(context.rootDir);

    await t.test("64-bit quick SmallInteger bit operations do not truncate through signed JS 32-bit operators", async t => {
        const vm = makeInterpreterProbe(true);
        t.equal(vm.safeShift(255, 24), 4278190080, "255 bitShift: 24 remains a positive 64-bit SmallInteger value");
        t.equal(vm.quickBitOr(4278190080, 16711680), 4294901760, "high-bit bitOr: remains positive instead of becoming a signed JS int");
        t.equal(vm.quickBitAnd(4294901760, 0xFFFF0000), 4294901760, "high-bit bitAnd: preserves the unsigned bitmap pattern");
    });

    await t.test("primitive bit operations use BigInt semantics for high-bit word patterns", async t => {
        let prim = makePrimitive([255, 24]);
        let shifted = prim.doBitShift();
        t.equal(bigIntFromObject(shifted).toString(), "4278190080", "primitive bitShift: can produce a high-bit positive result");

        prim = makePrimitive([4278190080, 16711680]);
        let ored = prim.doBitOr();
        t.equal(bigIntFromObject(ored).toString(), "4294901760", "primitive bitOr: keeps the result positive");

        prim = makePrimitive([4294901760, 0xFFFF0000]);
        let anded = prim.doBitAnd();
        t.equal(bigIntFromObject(anded).toString(), "4294901760", "primitive bitAnd: keeps the result positive");
    });

    await t.test("Pharo metacello evaluates high-bit bitmap-style integer expressions", async t => {
        const imagePath = process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 metacello high-bit integer probe", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const run = spawnSync(process.execPath, ["squeak_node.js", imageArg, "eval", "(255 bitShift: 24) bitOr: (255 bitShift: 16)"], {
            cwd: context.rootDir,
            encoding: "utf8",
            timeout: 12000,
        });
        const output = (run.stdout || "") + (run.stderr || "");
        t.equal(run.status, 0, "SqueakJS exits successfully");
        t.match(output, /(?:^|\n)4294901760(?:\n|$)/, "high-bit expression matches native Pharo's unsigned bitmap-pattern result");
        t.ok(!/Improper store into indexable object/.test(output), "high-bit result is not represented as a negative SmallInteger");
    });
};
