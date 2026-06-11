"use strict";

const { makePrimitive } = require("./support/fake-primitives");

function runNamedPrimitive(moduleName, primitiveName, stack, argCount) {
    const prim = makePrimitive(stack || [null]);
    const ok = prim.namedPrimitive(moduleName, primitiveName, argCount || 0);
    return { ok, prim, result: prim.vm.lastPushed };
}

exports.run = async function(t) {
    await t.test("LocalePlugin primitiveTimezoneOffset answers minutes east of GMT", async t => {
        const oldTZ = process.env.TZ;
        process.env.TZ = "Etc/GMT-2"; // POSIX sign convention: GMT-2 means UTC+02:00.
        try {
            const r = runNamedPrimitive("LocalePlugin", "primitiveTimezoneOffset", [null], 0);
            t.ok(r.ok, "timezone offset primitive succeeds");
            t.equal(r.result, 120, "offset matches native LocalePlugin convention: minutes east of GMT");
        } finally {
            if (oldTZ === undefined) delete process.env.TZ;
            else process.env.TZ = oldTZ;
        }
    });
};
