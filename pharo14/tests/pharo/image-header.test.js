"use strict";

const fs = require("fs");
const path = require("path");
const loadSqueakJS = require("./support/load-squeakjs");

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

exports.run = async function(t, context) {
    const Squeak = loadSqueakJS(context.rootDir);
    await t.test("bundled SqueakJS headless image is readable as a non-64-bit image", async t => {
        const imagePath = path.join(context.rootDir, "headless", "headless.image");
        const image = await readImage(Squeak, imagePath);
        t.ok(image.version > 0, "image version was parsed");
        t.equal(image.is64Bit, false, "headless fixture is not marked as 64-bit");
        t.equal(image.bytesPerWord, 4, "headless fixture is 32-bit word size");
    });

    await t.test("Pharo 14 metacello image header is detected as 64-bit Spur when fixture is available", async t => {
        const imagePath = process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 image header", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const image = await readImage(Squeak, imagePath);
        t.equal(image.version, 68021, "Pharo 14 image version");
        t.equal(image.isSpur, true, "Pharo 14 image is Spur");
        t.equal(image.is64Bit, true, "Pharo 14 image is 64-bit");
        t.equal(image.bytesPerWord, 8, "Pharo 14 image has 8-byte words");
        t.equal(image.multipleByteCodeSetsActive, true, "Pharo 14 image advertises the multiple-bytecode-set header flag");
        t.ok(image.oldSpaceCount > 100000, "Pharo 14 metacello old-space object count parsed");
    });
};
