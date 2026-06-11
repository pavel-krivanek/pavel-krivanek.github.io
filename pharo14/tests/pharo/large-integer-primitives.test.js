"use strict";

const {
    makePrimitive,
    objectFromBigInt,
    bigIntFromObject,
} = require("./support/fake-primitives");

function runPrimitive(index, receiver, argument) {
    const prim = makePrimitive([receiver, argument]);
    const ok = prim.doPrimitive(index, 1, null);
    return { ok, prim, result: prim.vm.lastPushed };
}

function runUnaryPrimitive(index, receiver) {
    const prim = makePrimitive([receiver]);
    const ok = prim.doPrimitive(index, 0, null);
    return { ok, prim, result: prim.vm.lastPushed };
}

function assertBigInt(t, actual, expected, message) {
    t.equal(bigIntFromObject(actual).toString(), BigInt(expected).toString(), message);
}

exports.run = async function(t) {
    await t.test("BigInt round-trips through LargePositiveInteger and LargeNegativeInteger byte objects", async t => {
        const positive = (1n << 80n) + 12345n;
        const negative = -((1n << 80n) + 54321n);
        assertBigInt(t, objectFromBigInt(positive), positive, "positive round-trip");
        assertBigInt(t, objectFromBigInt(negative), negative, "negative round-trip");
    });


    await t.test("64-bit LargeInteger normalization respects the JS safe-integer SmallInteger bridge", async t => {
        let r = objectFromBigInt((1n << 53n) - 1n);
        t.equal(typeof r, "number", "2^53-1 is represented as a JS-number SmallInteger bridge");
        t.equal(r, Math.pow(2, 53) - 1, "2^53-1 value is preserved");
        r = objectFromBigInt(1n << 53n);
        t.equal(typeof r, "object", "2^53 is boxed as LargePositiveInteger");
        assertBigInt(t, r, 1n << 53n, "2^53 boxed value round-trips");
        r = objectFromBigInt(-(1n << 53n));
        t.equal(typeof r, "number", "-2^53 is represented as a JS-number SmallInteger bridge");
        t.equal(r, -Math.pow(2, 53), "-2^53 value is preserved");
        r = objectFromBigInt(-(1n << 53n) - 1n);
        t.equal(typeof r, "object", "-2^53-1 is boxed as LargeNegativeInteger");
        assertBigInt(t, r, -(1n << 53n) - 1n, "-2^53-1 boxed value round-trips");
    });

    await t.test("SmallInteger arithmetic primitives promote overflowing 64-bit bridge results to LargeInteger", async t => {
        let r = runPrimitive(1, Math.pow(2, 52), Math.pow(2, 52));
        t.ok(r.ok, "overflowing SmallInteger addition succeeds through LargeInteger path");
        assertBigInt(t, r.result, 1n << 53n, "addition result is boxed 2^53");
        r = runPrimitive(2, -Math.pow(2, 53), 1);
        t.ok(r.ok, "overflowing SmallInteger subtraction succeeds through LargeInteger path");
        assertBigInt(t, r.result, -(1n << 53n) - 1n, "subtraction result is boxed below the safe bridge");
        r = runPrimitive(9, Math.pow(2, 30), Math.pow(2, 30));
        t.ok(r.ok, "overflowing SmallInteger multiplication succeeds through LargeInteger path");
        assertBigInt(t, r.result, 1n << 60n, "multiplication result is boxed 2^60");
    });

    await t.test("primitive 159 hashMultiply accepts LargeInteger receivers used for boxed 64-bit SmallInteger keys", async t => {
        let r = runUnaryPrimitive(159, 1);
        t.ok(r.ok, "SmallInteger hashMultiply succeeds");
        t.equal(r.result, 1664525, "1 hashMultiply matches the VM multiplier");
        r = runUnaryPrimitive(159, objectFromBigInt((1n << 60n) - 1n));
        t.ok(r.ok, "LargeInteger hashMultiply succeeds");
        t.equal(r.result, 266770931, "2^60-1 hashMultiply matches native Pharo 64-bit SmallInteger maxVal hash");
    });

    await t.test("direct primitive 21 and 22 add/subtract beyond JS safe integer range", async t => {
        const a = objectFromBigInt(1n << 70n);
        const b = objectFromBigInt((1n << 69n) + 7n);
        let r = runPrimitive(21, a, b);
        t.ok(r.ok, "addition primitive succeeds");
        assertBigInt(t, r.result, (1n << 70n) + (1n << 69n) + 7n, "large addition result");
        r = runPrimitive(22, b, a);
        t.ok(r.ok, "subtraction primitive succeeds");
        assertBigInt(t, r.result, -((1n << 69n) - 7n), "large subtraction result");
    });

    await t.test("direct primitive 29 multiply returns normalized LargeInteger", async t => {
        const r = runPrimitive(29, objectFromBigInt(1n << 42n), objectFromBigInt((1n << 35n) + 3n));
        t.ok(r.ok, "multiplication primitive succeeds");
        assertBigInt(t, r.result, (1n << 42n) * ((1n << 35n) + 3n), "large multiplication result");
    });

    await t.test("direct primitive 30 exact divide succeeds and inexact divide fails", async t => {
        let r = runPrimitive(30, objectFromBigInt(1n << 72n), objectFromBigInt(1n << 12n));
        t.ok(r.ok, "exact divide succeeds");
        assertBigInt(t, r.result, 1n << 60n, "exact quotient");
        r = runPrimitive(30, objectFromBigInt(7n), objectFromBigInt(3n));
        t.equal(r.ok, false, "inexact divide must fail for image fallback");
    });

    await t.test("direct primitives 31/32 implement floor div/mod sign semantics", async t => {
        let r = runPrimitive(32, objectFromBigInt(-7n), objectFromBigInt(3n));
        t.ok(r.ok, "negative floor div succeeds");
        assertBigInt(t, r.result, -3n, "-7 // 3");
        r = runPrimitive(31, objectFromBigInt(-7n), objectFromBigInt(3n));
        t.ok(r.ok, "positive-divisor mod succeeds");
        assertBigInt(t, r.result, 2n, "-7 \\ 3");
        r = runPrimitive(32, objectFromBigInt(7n), objectFromBigInt(-3n));
        t.ok(r.ok, "negative-divisor floor div succeeds");
        assertBigInt(t, r.result, -3n, "7 // -3");
        r = runPrimitive(31, objectFromBigInt(7n), objectFromBigInt(-3n));
        t.ok(r.ok, "negative-divisor mod succeeds");
        assertBigInt(t, r.result, -2n, "7 \\ -3");
    });

    await t.test("direct primitives 20/33 implement quo/rem truncation semantics", async t => {
        let r = runPrimitive(33, objectFromBigInt(-7n), objectFromBigInt(3n));
        t.ok(r.ok, "quo succeeds");
        assertBigInt(t, r.result, -2n, "-7 quo: 3");
        r = runPrimitive(20, objectFromBigInt(-7n), objectFromBigInt(3n));
        t.ok(r.ok, "rem succeeds");
        assertBigInt(t, r.result, -1n, "-7 rem: 3");
    });

    await t.test("direct primitives 34-37 implement two's-complement bit operations", async t => {
        let r = runPrimitive(34, objectFromBigInt(-1n), objectFromBigInt(255n));
        t.ok(r.ok, "bitAnd succeeds");
        assertBigInt(t, r.result, 255n, "-1 bitAnd: 255");
        r = runPrimitive(35, objectFromBigInt(1n << 40n), objectFromBigInt(7n));
        t.ok(r.ok, "bitOr succeeds");
        assertBigInt(t, r.result, (1n << 40n) | 7n, "bitOr result");
        r = runPrimitive(36, objectFromBigInt((1n << 40n) + 3n), objectFromBigInt(7n));
        t.ok(r.ok, "bitXor succeeds");
        assertBigInt(t, r.result, ((1n << 40n) + 3n) ^ 7n, "bitXor result");
        r = runPrimitive(37, objectFromBigInt(1n << 40n), -8);
        t.ok(r.ok, "right bitShift succeeds");
        assertBigInt(t, r.result, 1n << 32n, "right shift result");
        r = runPrimitive(37, 1, 40);
        t.ok(r.ok, "left bitShift from SmallInteger succeeds");
        assertBigInt(t, r.result, 1n << 40n, "left shift result");
    });

    await t.test("comparison primitives 23-28 compare values above 53 bits", async t => {
        const a = objectFromBigInt(1n << 80n);
        const b = objectFromBigInt((1n << 80n) + 1n);
        let r = runPrimitive(23, a, b);
        t.ok(r.ok, "less-than primitive succeeds");
        t.equal(r.result, r.prim.vm.trueObj, "2^80 < 2^80+1");
        r = runPrimitive(27, a, objectFromBigInt(1n << 80n));
        t.ok(r.ok, "equality primitive succeeds");
        t.equal(r.result, r.prim.vm.trueObj, "2^80 = 2^80");
        r = runPrimitive(28, a, b);
        t.ok(r.ok, "not-equal primitive succeeds");
        t.equal(r.result, r.prim.vm.trueObj, "2^80 ~= 2^80+1");
    });

    await t.test("division by zero fails without mutating the stack", async t => {
        const receiver = objectFromBigInt(123n);
        const argument = objectFromBigInt(0n);
        const r = runPrimitive(31, receiver, argument);
        t.equal(r.ok, false, "mod by zero fails");
        t.equal(r.prim.vm.stack.length, 2, "stack remains unchanged on primitive failure");
    });
};
