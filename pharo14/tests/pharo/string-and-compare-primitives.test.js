"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
    makePrimitive,
    stringFromObject,
} = require("./support/fake-primitives");

function makeString(prim, value) {
    return prim.makeStString(value);
}

function makeByteArray(prim, bytes) {
    const obj = prim.makeStByteArray(bytes);
    return obj;
}

function makeWords(words) {
    return {
        words: Uint32Array.from(words),
        isBytes() { return false; },
        isWords() { return true; },
        isWordsOrBytes() { return true; },
    };
}

function invokePrimitive(prim, index, stack, argCount) {
    prim.vm.stack = stack.slice();
    prim.vm.sp = prim.vm.stack.length - 1;
    prim.success = true;
    const ok = prim.doPrimitive(index, argCount, null);
    return { ok, result: prim.vm.lastPushed, stack: prim.vm.stack.slice() };
}

exports.run = async function(t, context) {
    await t.test("primitive 158 compares byte strings with native Pharo raw-difference semantics", async t => {
        let prim = makePrimitive();
        let r = invokePrimitive(prim, 158, [makeString(prim, "abc"), makeString(prim, "abd")], 1);
        t.ok(r.ok, "plain byte-string comparison succeeds");
        t.equal(r.result, -1, "first differing byte answers the raw byte difference");

        prim = makePrimitive();
        r = invokePrimitive(prim, 158, [makeString(prim, "abc"), makeString(prim, "ab")], 1);
        t.ok(r.ok, "length comparison succeeds");
        t.equal(r.result, 1, "equal prefix answers the length difference");

        prim = makePrimitive();
        const order = makeByteArray(prim, Array.from({ length: 256 }, (_, i) => i));
        order.bytes["a".charCodeAt(0)] = 2;
        order.bytes["b".charCodeAt(0)] = 1;
        r = invokePrimitive(prim, 158, [makeString(prim, "a"), makeString(prim, "b"), order], 2);
        t.ok(r.ok, "collated comparison succeeds with a 256-byte order table");
        t.equal(r.result, 1, "order table remaps compared bytes before subtraction");
    });

    await t.test("primitive 156 compares byte/word-indexable objects for equality", async t => {
        let prim = makePrimitive();
        let r = invokePrimitive(prim, 156, [makeByteArray(prim, [1, 2, 3]), makeByteArray(prim, [1, 2, 3])], 1);
        t.ok(r.ok, "byte-object equality comparison succeeds");
        t.ok(r.result && r.result.isTrue, "equal byte arrays answer true");

        prim = makePrimitive();
        r = invokePrimitive(prim, 156, [makeByteArray(prim, [1, 2, 3]), makeByteArray(prim, [1, 9, 3])], 1);
        t.ok(r.ok, "byte-object inequality comparison succeeds");
        t.ok(r.result && r.result.isFalse, "different byte arrays answer false");

        prim = makePrimitive();
        r = invokePrimitive(prim, 156, [makeWords([0x12345678, 0x9abcdef0]), makeWords([0x12345678, 0x9abcdef0])], 1);
        t.ok(r.ok, "word-object equality comparison succeeds");
        t.ok(r.result && r.result.isTrue, "equal word arrays answer true");

        prim = makePrimitive();
        r = invokePrimitive(prim, 156, [makeByteArray(prim, [1, 2, 3, 4]), makeWords([0x04030201])], 1);
        t.ok(!r.ok, "mixed byte/word formats fail like the VM primitive");
    });

    await t.test("primitive 113 with an exit status argument balances the stack before breaking", async t => {
        const display = {};
        const prim = makePrimitive(["Smalltalk", 0], display);
        let breakMessage = null;
        prim.vm.breakNow = msg => { breakMessage = msg; };
        const ok = prim.doPrimitive(113, 1, null);
        t.ok(ok, "quit primitive succeeds");
        t.equal(breakMessage, "quit", "quit requests interpreter break");
        t.equal(display.quitFlag, true, "quit flag is set");
        t.equal(prim.vm.stack.length, 1, "exit status argument is popped and receiver remains");
        t.equal(prim.vm.sp, 0, "stack pointer is balanced for argCount 1");
    });

    await t.test("full Pharo image eval no longer emits primitive 156/158 or quit stack-balance warnings", async t => {
        const imagePath = process.env.PHARO14_FULL_IMAGE || path.join(context.rootDir, "pharo14-full.image");
        if (!fs.existsSync(imagePath)) return t.skip("full Pharo warning-clean probe", "set PHARO14_FULL_IMAGE or place pharo14-full.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const run = spawnSync(process.execPath, ["squeak_node.js", imageArg, "eval", "1+2"], {
            cwd: context.rootDir,
            encoding: "utf8",
            timeout: 15000,
        });
        const output = (run.stdout || "") + (run.stderr || "");
        t.equal(run.status, 0, "full image eval exits successfully");
        t.match(output, /(?:^|\n)3(?:\n|$)/, "full image still evaluates 1+2");
        t.ok(!/missing primitive: 158 \(primitiveCompareWith\)/.test(output), "primitive 158 warning is gone");
        t.ok(!/primitive 156 not implemented yet/.test(output), "primitive 156 warning is gone");
        t.ok(!/stack unbalanced after primitive 113/.test(output), "quit primitive no longer reports stack imbalance");
    });
};
