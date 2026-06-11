"use strict";

const loadSqueakJS = require("./support/load-squeakjs");
const { makePrimitive } = require("./support/fake-primitives");
const path = require("path");
const Squeak = loadSqueakJS(path.resolve(__dirname, "..", ".."));

let nextOldOop = 1000;
let nextNewOop = -1;

function makeClass(name, instSize) {
    const cls = {
        name,
        oop: nextOldOop++,
        mark: true,
        pointers: [],
        classInstSize: () => instSize || 0,
        totalBytes: () => 16,
        setAddr(addr) { this.oop = addr + 1; return addr + this.totalBytes(); },
    };
    cls.sqClass = cls;
    return cls;
}

function makeObject(name, format, pointers, sqClass) {
    return {
        name,
        oop: nextOldOop++,
        mark: false,
        dirty: false,
        sqClass: sqClass || makeClass(name + " class", 0),
        _format: format == null ? 1 : format,
        pointers: pointers || [],
        isWeak() { return this._format === 4; },
        isEphemeron() { return this._format === 5; },
        totalBytes: () => 16,
        setAddr(addr) { this.oop = addr + 1; return addr + this.totalBytes(); },
    };
}

function makeOldObject(name, format, pointers, sqClass) {
    const object = makeObject(name, format, pointers, sqClass);
    object.oop = nextOldOop++;
    return object;
}

function makeYoungObject(name, format, pointers, sqClass) {
    const object = makeObject(name, format, pointers, sqClass);
    object.oop = nextNewOop--;
    return object;
}

function linkOldObjects(image, oldObjects) {
    for (let i = 0; i < oldObjects.length; i++) {
        oldObjects[i].oop = i + 1;
        oldObjects[i].nextObject = oldObjects[i + 1] || null;
    }
    image.firstOldObject = oldObjects[0];
    image.lastOldObject = oldObjects[oldObjects.length - 1];
    image.oldSpaceCount = oldObjects.length;
    image.oldSpaceBytes = oldObjects.length * 16;
}

function makeImageWithRoots(rootPointers) {
    const image = new Squeak.Image("ephemeron-test");
    const nilObj = { isNil: true, mark: true, oop: 1, pointers: [], totalBytes: () => 0, setAddr(addr) { this.oop = addr + 1; return addr; } };
    const activeContext = makeObject("active context", 1, []);
    const specialObjectsArray = makeObject("specialObjectsArray", 2, rootPointers || []);
    image.isSpur = true;
    image.newSpaceCount = 0;
    image.youngSpaceCount = 0;
    image.allocationCount = 0;
    image.gcCount = 0;
    image.gcMilliseconds = 0;
    image.gcTenured = 0;
    image.totalMemory = 1024 * 1024;
    image.hasNewInstances = {};
    image.vm = {
        nilObj,
        activeContext,
        pendingFinalizationSignals: 0,
        interruptCheckForced: false,
        storeContextRegisters() {},
        isContext() { return false; },
        forceInterruptCheck() { this.interruptCheckForced = true; },
        addMessage() {},
        signalLowSpaceIfNecessary() {},
    };
    image.specialObjectsArray = specialObjectsArray;
    linkOldObjects(image, [nilObj, specialObjectsArray, activeContext]);
    return image;
}

function makePartialImageWithRoots(rootPointers, extraOldObjects) {
    const image = makeImageWithRoots(rootPointers);
    image.specialObjectsArray.dirty = true;
    const oldObjects = [image.firstOldObject, image.specialObjectsArray, image.vm.activeContext].concat(extraOldObjects || []);
    linkOldObjects(image, oldObjects);
    image.newSpaceCount = countYoungObjects(rootPointers || [], extraOldObjects || []);
    image.youngSpaceCount = 0;
    image.allocationCount = 0;
    image.pgcCount = 0;
    image.pgcMilliseconds = 0;
    image.hasNewInstances = {};
    image.totalMemory = 1024 * 1024;
    return image;
}

function countYoungObjects() {
    const seen = new Set();
    function visit(value) {
        if (!value || typeof value !== "object" || seen.has(value)) return;
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        seen.add(value);
        if (value.pointers) value.pointers.forEach(visit);
    }
    for (let i = 0; i < arguments.length; i++) visit(arguments[i]);
    let count = 0;
    seen.forEach(object => { if (object.oop < 0) count++; });
    return count;
}

exports.run = async function(t) {
    await t.test("Spur ObjectSpur exposes format 5 as ephemeron, distinct from weak array", async t => {
        const obj = Object.create(Squeak.ObjectSpur.prototype);
        obj._format = 5;
        t.ok(obj.isEphemeron(), "format 5 is an ephemeron");
        t.ok(!obj.isWeak(), "format 5 is not treated as an ordinary weak array");
        obj._format = 4;
        t.ok(obj.isWeak(), "format 4 remains ordinary weak array");
        t.ok(!obj.isEphemeron(), "format 4 is not an ephemeron");
    });

    await t.test("full-GC ephemeron processing fires when the key is reachable only through the ephemeron value graph", async t => {
        const key = makeObject("key", 1, []);
        const value = makeObject("value", 1, [key]);
        const ephemeron = makeObject("ephemeron", 5, [key, value]);
        const image = makeImageWithRoots([ephemeron]);

        image.markReachableObjects();

        t.ok(ephemeron.mark, "the reachable ephemeron object itself remains live");
        t.ok(key.mark, "the fired mourner preserves its key for later Smalltalk-side mourning");
        t.ok(value.mark, "the fired mourner preserves its value/contents");
        t.equal(ephemeron._format, 1, "fired ephemeron is converted to ordinary non-indexable pointer format");
        t.equal(image.vm.pendingFinalizationSignals, 1, "finalization semaphore is scheduled once");
        t.ok(image.vm.interruptCheckForced, "interrupt check is requested so the finalization process can run");
        t.equal(image.dequeueMourner(), ephemeron, "primitive 172 can later fetch the fired ephemeron");
        t.equal(image.dequeueMourner(), null, "mourner queue is emptied after fetch");
    });

    await t.test("full-GC ephemeron processing does not fire when the key is independently live", async t => {
        const key = makeObject("key", 1, []);
        const value = makeObject("value", 1, []);
        const ephemeron = makeObject("ephemeron", 5, [key, value]);
        const image = makeImageWithRoots([key, ephemeron]);

        image.markReachableObjects();

        t.ok(key.mark, "key is live independently");
        t.ok(value.mark, "value is traced once the key is known live");
        t.equal(ephemeron._format, 5, "unfired ephemeron keeps ephemeron format");
        t.equal(image.vm.pendingFinalizationSignals, 0, "no finalization signal is scheduled");
        t.equal(image.dequeueMourner(), null, "no mourner is queued");
    });

    await t.test("partial-GC fires a young ephemeron when its young key is reachable only through the ephemeron value graph", async t => {
        const key = makeYoungObject("partial key", 1, []);
        const value = makeYoungObject("partial value", 1, [key]);
        const ephemeron = makeYoungObject("partial ephemeron", 5, [key, value]);
        const image = makePartialImageWithRoots([ephemeron]);

        image.partialGC("test");

        t.equal(ephemeron._format, 1, "fired young ephemeron is converted to ordinary pointer format");
        t.ok(key.oop < 0, "the fired key survives the scavenge as a young object");
        t.ok(value.oop < 0, "the fired value survives the scavenge as a young object");
        t.equal(image.vm.pendingFinalizationSignals, 1, "partial GC schedules finalization for the fired ephemeron");
        t.equal(image.dequeueMourner(), ephemeron, "partial-GC mourner is queued for primitive 172");
    });

    await t.test("partial-GC does not fire a young ephemeron when its young key is independently live", async t => {
        const key = makeYoungObject("partial live key", 1, []);
        const value = makeYoungObject("partial live value", 1, []);
        const ephemeron = makeYoungObject("partial live ephemeron", 5, [key, value]);
        const image = makePartialImageWithRoots([key, ephemeron]);

        image.partialGC("test");

        t.equal(ephemeron._format, 5, "unfired young ephemeron keeps ephemeron format");
        t.ok(value.oop < 0, "value is retained because the key was live independently");
        t.equal(image.vm.pendingFinalizationSignals, 0, "no finalization signal is scheduled");
        t.equal(image.dequeueMourner(), null, "no mourner is queued");
    });

    await t.test("partial-GC fires an old remembered ephemeron with a dead young key", async t => {
        const key = makeYoungObject("remembered key", 1, []);
        const value = makeYoungObject("remembered value", 1, [key]);
        const ephemeron = makeOldObject("remembered ephemeron", 5, [key, value]);
        ephemeron.dirty = true;
        const image = makePartialImageWithRoots([], [ephemeron]);

        image.partialGC("test");

        t.equal(ephemeron._format, 1, "fired old remembered ephemeron becomes ordinary pointer format");
        t.ok(key.oop < 0, "dead young key is preserved for mourning");
        t.ok(value.oop < 0, "young value is preserved for mourning");
        t.equal(image.dequeueMourner(), ephemeron, "old remembered ephemeron is queued as mourner");
    });

    await t.test("partial-GC ephemeron processing reaches a fixed point before firing chained ephemerons", async t => {
        const k1 = makeYoungObject("chain key 1", 1, []);
        const k2 = makeYoungObject("chain key 2", 1, []);
        const v1 = makeYoungObject("chain value 1", 1, [k2]);
        const v2 = makeYoungObject("chain value 2", 1, []);
        const e1 = makeYoungObject("chain ephemeron 1", 5, [k1, v1]);
        const e2 = makeYoungObject("chain ephemeron 2", 5, [k2, v2]);
        const image = makePartialImageWithRoots([k1, e1, e2]);

        image.partialGC("test");

        t.equal(e1._format, 5, "first ephemeron remains unfired because its key is live");
        t.equal(e2._format, 5, "second ephemeron remains unfired after the first value marks its key");
        t.ok(k2.oop < 0, "key of second ephemeron survived through first ephemeron value");
        t.ok(v2.oop < 0, "second ephemeron value is traced after fixed-point progress");
        t.equal(image.dequeueMourner(), null, "no chained ephemeron was fired prematurely");
    });

    await t.test("partial-GC keeps immediate and old ephemeron keys live", async t => {
        const valueForImmediate = makeYoungObject("immediate value", 1, []);
        const eImmediate = makeYoungObject("immediate-key ephemeron", 5, [17, valueForImmediate]);
        const oldKey = makeOldObject("old key", 1, []);
        const valueForOld = makeYoungObject("old-key value", 1, []);
        const eOld = makeYoungObject("old-key ephemeron", 5, [oldKey, valueForOld]);
        const image = makePartialImageWithRoots([eImmediate, eOld], [oldKey]);

        image.partialGC("test");

        t.equal(eImmediate._format, 5, "immediate-key ephemeron does not fire");
        t.equal(eOld._format, 5, "old-key ephemeron does not fire during partial GC");
        t.ok(valueForImmediate.oop < 0, "immediate-key value is traced");
        t.ok(valueForOld.oop < 0, "old-key value is traced");
        t.equal(image.dequeueMourner(), null, "no mourner is queued for live immediate/old keys");
    });

    await t.test("partial-GC weak-array processing does not keep dead young weak fields alive", async t => {
        const deadYoung = makeYoungObject("dead weak referent", 1, []);
        const weakClass = makeClass("weak array class", 0);
        const weak = makeOldObject("old weak array", 4, [deadYoung], weakClass);
        weak.dirty = true;
        const image = makePartialImageWithRoots([], [weak]);

        image.partialGC("test");

        t.equal(weak.pointers[0], image.vm.nilObj, "dead young weak referent is nilled instead of traced");
        t.equal(image.vm.pendingFinalizationSignals, 1, "weak finalization signal is still scheduled");
        t.ok(image.vm.interruptCheckForced, "weak finalization also forces interrupt check");
    });


    await t.test("mourn queue roots fired ephemerons across later full GCs", async t => {
        const key = makeOldObject("queued key", 1, []);
        const value = makeOldObject("queued value", 1, [key]);
        const ephemeron = makeOldObject("queued ephemeron", 5, [key, value]);
        const image = makeImageWithRoots([ephemeron]);
        linkOldObjects(image, [image.firstOldObject, image.specialObjectsArray, image.vm.activeContext, ephemeron, key, value]);

        image.fullGC("queue-root-fire");
        t.equal(image.dequeueMourner(), ephemeron, "sanity check: first full GC queues the fired ephemeron");
        image.queueMourner(ephemeron); // put it back exactly as primitiveFetchMourner would have left it unfetched
        image.specialObjectsArray.pointers = [];

        image.fullGC("queue-root-preserve");

        t.equal(image.dequeueMourner(), ephemeron, "queued mourner remains fetchable after another full GC");
        t.ok(ephemeron.oop >= 0, "queued mourner remains in old/image space instead of becoming a detached corpse");
        t.ok(key.oop >= 0, "mourner key is kept alive by the queued mourner root");
        t.ok(value.oop >= 0, "mourner value is kept alive by the queued mourner root");
    });

    await t.test("mourn queue roots young mourners across partial GC", async t => {
        const key = makeYoungObject("queued partial key", 1, []);
        const value = makeYoungObject("queued partial value", 1, [key]);
        const mourner = makeYoungObject("queued partial mourner", 1, [key, value]);
        const image = makePartialImageWithRoots([]);
        image.queueMourner(mourner);
        image.newSpaceCount = countYoungObjects(mourner);

        image.partialGC("queue-root-partial");

        t.equal(image.dequeueMourner(), mourner, "young queued mourner remains fetchable after partial GC");
        t.ok(mourner.oop < 0, "queued young mourner survives in young space");
        t.ok(key.oop < 0, "queued young mourner key survives partial GC");
        t.ok(value.oop < 0, "queued young mourner value survives partial GC");
    });

    await t.test("ephemeron primitive 172 fetches queued mourners and fails with PrimErrNotFound when empty", async t => {
        const mourner = makeObject("mourner", 1, []);
        const image = {
            queue: [mourner],
            dequeueMourner() { return this.queue.length ? this.queue.pop() : null; },
        };
        const prim = makePrimitive([null], null, { image });
        let ok = prim.doPrimitive(172, 0, null);
        t.ok(ok, "primitive succeeds while a mourner is queued");
        t.equal(prim.vm.lastPushed, mourner, "queued mourner is pushed as primitive result");

        prim.vm.stack = [null];
        prim.vm.sp = 0;
        prim.vm.lastPushed = null;
        ok = prim.doPrimitive(172, 0, null);
        t.ok(!ok, "primitive fails when the queue is empty so the image fallback can answer nil");
        t.equal(prim.vm.primFailCode, Squeak.PrimErrNotFound, "empty queue reports PrimErrNotFound");
    });
};
