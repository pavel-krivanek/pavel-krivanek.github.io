"use strict";

const { makePrimitive } = require("./support/fake-primitives");

exports.run = async function(t) {
    await t.test("UUIDPlugin primitiveMakeUUID fills a 16-byte receiver", async t => {
        const prim = makePrimitive();
        const byteArray = prim.makeStByteArray(new Array(16).fill(0));
        prim.vm.stack = [byteArray];
        prim.vm.sp = 0;
        const ok = prim.namedPrimitive("UUIDPlugin", "primitiveMakeUUID", 0);
        t.ok(ok, "primitive succeeds");
        t.ok(prim.vm.lastPushed === byteArray, "receiver is returned");
        t.equal(byteArray.bytes.length, 16, "receiver remains 16 bytes");
        t.ok(byteArray.bytes.some(each => each !== 0), "UUID bytes are not all zero");
        t.equal(byteArray.bytes[6] & 0xf0, 0x40, "version bits identify UUID v4");
        t.equal(byteArray.bytes[8] & 0xc0, 0x80, "variant bits are RFC 4122 compatible");
    });
};
