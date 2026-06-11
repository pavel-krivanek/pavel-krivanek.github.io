"use strict";

const fs = require("fs");
const path = require("path");

const {
    Squeak,
    Classes,
    makePrimitive,
} = require("./support/fake-primitives");

function makeSemaphore(sqClass, nilObj, excessSignals) {
    const sema = {
        sqClass,
        pointers: [],
    };
    sema.pointers[Squeak.LinkedList_firstLink] = nilObj;
    sema.pointers[Squeak.LinkedList_lastLink] = nilObj;
    sema.pointers[Squeak.Semaphore_excessSignals] = excessSignals || 0;
    return sema;
}

exports.run = async function(t) {
    await t.test("Semaphore primitives accept Pharo semaphore subclasses such as SymbolTableSemaphore", async t => {
        let prim = makePrimitive([]);
        let sema = makeSemaphore(Classes.SymbolTableSemaphore, prim.vm.nilObj, 1);
        prim.vm.stack = [sema];
        t.ok(prim.primitiveWait(), "primitiveWait accepts a Semaphore subclass");
        t.equal(sema.pointers[Squeak.Semaphore_excessSignals], 0, "primitiveWait consumes an excess signal");

        prim = makePrimitive([]);
        sema = makeSemaphore(Classes.SymbolTableSemaphore, prim.vm.nilObj, 0);
        prim.vm.stack = [sema];
        t.ok(prim.primitiveSignal(), "primitiveSignal accepts a Semaphore subclass");
        t.equal(sema.pointers[Squeak.Semaphore_excessSignals], 1, "primitiveSignal records an excess signal on an empty semaphore");
    });



    await t.test("browser source defaults to Unix-compatible Pharo platform identity", async t => {
        const source = fs.readFileSync(path.resolve(__dirname, "..", "..", "squeak.js"), "utf8");
        t.match(source, /platformName:\s*["']unix["']/, "browser VM reports unix to Pharo OSPlatform");
        t.match(source, /platformSubtype:\s*["']x86_64["']/, "browser VM reports a 64-bit Unix architecture");
        t.match(source, /osVersion:\s*["']linux-gnu/, "browser VM reports a Linux-like OS version prefix");
        t.match(source, /windowSystem:\s*["']HTML["']/, "browser VM still exposes the browser window system");
    });

    await t.test("platform attributes expose the Unix x86_64 shape expected by Pharo OSPlatform", async t => {
        const oldSubtype = Squeak.platformSubtype;
        const oldVersion = Squeak.osVersion;
        const oldWindowSystem = Squeak.windowSystem;
        try {
            Squeak.platformSubtype = "x86_64";
            Squeak.osVersion = "linux-gnu";
            Squeak.windowSystem = "none";
            const display = { argv: ["vm", "image"], vmOptions: ["--headless"] };
            let prim = makePrimitive([1001], display, { vmOptions: { unix: true } });
            t.ok(prim.primitiveGetAttribute(1), "attribute 1001 succeeds");
            t.equal(prim.vm.lastPushed.bytesAsString(), "unix", "operatingSystemName is unix when the VM was started in Unix compatibility mode");
            prim = makePrimitive([1002], display, { vmOptions: { unix: true } });
            t.ok(prim.primitiveGetAttribute(1), "attribute 1002 succeeds");
            t.equal(prim.vm.lastPushed.bytesAsString(), "linux-gnu", "platform subtype version is Linux-compatible");
            prim = makePrimitive([1003], display, { vmOptions: { unix: true } });
            t.ok(prim.primitiveGetAttribute(1), "attribute 1003 succeeds");
            t.equal(prim.vm.lastPushed.bytesAsString(), "x86_64", "architectureName is x86_64");
            prim = makePrimitive([1005], display, { vmOptions: { unix: true } });
            t.ok(prim.primitiveGetAttribute(1), "attribute 1005 succeeds");
            t.equal(prim.vm.lastPushed.bytesAsString(), "none", "window system is explicitly headless");
        } finally {
            Squeak.platformSubtype = oldSubtype;
            Squeak.osVersion = oldVersion;
            Squeak.windowSystem = oldWindowSystem;
        }
    });

    await t.test("browser source advertises Unix-like environment roots", async t => {
        const globals = fs.readFileSync(path.resolve(__dirname, "..", "..", "globals.js"), "utf8");
        const browser = fs.readFileSync(path.resolve(__dirname, "..", "..", "squeak.js"), "utf8");
        t.match(globals, /HOME:\s*["']\/home\/squeak["']/, "browser fallback environment exposes HOME");
        t.match(globals, /XDG_CONFIG_HOME:\s*["']\/home\/squeak\/.config["']/, "browser fallback environment exposes XDG_CONFIG_HOME");
        t.match(browser, /Squeak\.dirCreate\(path, true, ["']force["']\)/, "browser startup pre-creates advertised environment directories");
    });

    await t.test("browser module loader imports startup plugins", async t => {
        const source = fs.readFileSync(path.resolve(__dirname, "..", "..", "squeak.js"), "utf8");
        t.match(source, /import \"\.\/plugins\/FileAttributesPlugin\.js\";/,
            "squeak.js loads FileAttributesPlugin in browser runs");
        t.match(source, /import \"\.\/plugins\/UUIDPlugin\.js\";/,
            "squeak.js loads UUIDPlugin in browser runs");
    });
};

