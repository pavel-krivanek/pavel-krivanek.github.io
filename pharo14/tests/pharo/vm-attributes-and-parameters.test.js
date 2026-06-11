"use strict";

const {
    makePrimitive,
    stringFromObject,
} = require("./support/fake-primitives");

function getAttribute(display, attr) {
    const prim = makePrimitive([attr], display);
    const ok = prim.primitiveGetAttribute(1);
    return { ok, result: prim.vm.lastPushed };
}

exports.run = async function(t) {
    await t.test("primitiveGetAttribute exposes Pharo-compatible headless argv layout", async t => {
        const display = {
            vmOptions: ["--headless", "-vm-display-null", "-nodisplay"],
            argv: ["/SqueakJS/vm.js", "pharo14-metacello.image", "evaluate", "1+2"],
        };
        let r = getAttribute(display, -1);
        t.ok(r.ok, "negative VM option attribute succeeds");
        t.equal(stringFromObject(r.result), "--headless", "attribute -1 is --headless");
        r = getAttribute(display, 0);
        t.ok(r.ok, "attribute 0 succeeds");
        t.equal(stringFromObject(r.result), "/SqueakJS/vm.js", "attribute 0 is VM path");
        r = getAttribute(display, 1);
        t.ok(r.ok, "attribute 1 succeeds");
        t.equal(stringFromObject(r.result), "pharo14-metacello.image", "attribute 1 is image path");
        r = getAttribute(display, 2);
        t.ok(r.ok, "attribute 2 succeeds");
        t.equal(stringFromObject(r.result), "evaluate", "attribute 2 is image command");
        r = getAttribute(display, 3);
        t.ok(r.ok, "attribute 3 succeeds");
        t.equal(stringFromObject(r.result), "1+2", "attribute 3 is image command argument");
    });

    await t.test("primitiveGetAttribute fails for absent arguments instead of inventing document-name arguments", async t => {
        const display = { vmOptions: ["--headless"], argv: ["vm", "image"], documentName: "image" };
        let r = getAttribute(display, 2);
        t.equal(r.ok, false, "missing first image-side argument fails instead of returning the image path");
        r = getAttribute(display, 4);
        t.equal(r.ok, false, "missing later attribute fails");
    });

    await t.test("vmParameterAt: 40 reports the loaded image word size", async t => {
        let prim = makePrimitive([], {}, { image: { is64Bit: true, bytesPerWord: 8 } });
        t.equal(prim.vmParameterAt(40), 8, "64-bit image reports 8 bytes per word");
        prim = makePrimitive([], {}, { image: { is64Bit: false, bytesPerWord: 4 } });
        t.equal(prim.vmParameterAt(40), 4, "32-bit image reports 4 bytes per word");
    });
};
