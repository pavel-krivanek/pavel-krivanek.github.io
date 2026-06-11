"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function runNodeSync(args, options) {
    const run = spawnSync(process.execPath, args, {
        cwd: options.cwd,
        env: Object.assign({}, process.env, options.env || {}),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: options.timeoutMs || 30000,
        killSignal: "SIGKILL",
    });
    return {
        code: run.status,
        signal: run.signal,
        timedOut: !!(run.error && run.error.code === "ETIMEDOUT"),
        output: (run.stdout || "") + (run.stderr || ""),
    };
}

function runNativeSync(vmPath, imagePath, expression, timeoutMs) {
    const run = spawnSync(vmPath, ["--headless", imagePath, "eval", expression], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMs || 30000,
        killSignal: "SIGKILL",
    });
    return {
        code: run.status,
        signal: run.signal,
        timedOut: !!(run.error && run.error.code === "ETIMEDOUT"),
        output: (run.stdout || "") + (run.stderr || ""),
    };
}

function imagePath(context) {
    return process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
}

function oneLine(source) {
    return source.replace(/\s+/g, " ").trim();
}

const makeProbeClassSource = `
Smalltalk globals removeKey: #SqueakJSEphemeronProbe ifAbsent: [].
cls := ShiftClassBuilder new
    name: #SqueakJSEphemeronProbe;
    superclass: Object;
    layoutClass: EphemeronLayout;
    slots: #(key value);
    package: 'SqueakJS-Probes';
    build.
cls compile: 'key ^ key' classified: 'accessing'.
cls compile: 'key: anObject key := anObject' classified: 'accessing'.
cls compile: 'value ^ value' classified: 'accessing'.
cls compile: 'value: anObject value := anObject' classified: 'accessing'.
`;

const activeEphemeronExpression = oneLine(`
| cls e key value |
${makeProbeClassSource}
e := cls new.
key := Object new.
value := Array with: key.
e key: key.
e value: value.
{ cls instSpec . e key == key . e value == value . e basicSize . cls instSize }
`);

const firedEphemeronExpression = oneLine(`
| cls e mourner p after found |
p := FinalizationProcess runningFinalizationProcess.
p suspend.
[
    [ mourner := FinalizationProcess primitiveFetchMourner. mourner notNil ] whileTrue.
    ${makeProbeClassSource}
    e := [ | key value ep |
        ep := cls new.
        key := Object new.
        value := Array with: key.
        ep key: key.
        ep value: value.
        ep ] value.
    Smalltalk garbageCollect.
    after := OrderedCollection new.
    found := false.
    [ mourner := FinalizationProcess primitiveFetchMourner. mourner notNil ] whileTrue: [
        after add: mourner class name.
        mourner == e ifTrue: [ found := true ] ].
    { after includes: #SqueakJSEphemeronProbe . found . (e instVarAt: 1) class name }
] ensure: [ p resume ]
`);

const registryManualFinalizationExpression = oneLine(`
| flag token registry finalizer process mourner count |
process := FinalizationProcess runningFinalizationProcess.
process suspend.
[
    [ mourner := FinalizationProcess primitiveFetchMourner. mourner notNil ] whileTrue: [ mourner mourn ].
    flag := #squeakjsFinalizationRan -> false.
    token := Object new.
    registry := FinalizationRegistry new.
    finalizer := ObjectFinalizer new
        receiver: flag;
        selector: #value:;
        arguments: { true }.
    registry add: token finalizer: finalizer.
    token := nil.
    Smalltalk garbageCollect.
    count := 0.
    [ mourner := FinalizationProcess primitiveFetchMourner. mourner notNil ] whileTrue: [
        count := count + 1.
        mourner mourn ].
    { flag value . registry isEmpty . count > 0 }
] ensure: [ process resume ]
`);

const registryAutomaticFinalizationExpression = oneLine(`
| flag token registry finalizer deadline |
flag := #squeakjsAutomaticFinalizationRan -> false.
token := Object new.
registry := FinalizationRegistry new.
finalizer := ObjectFinalizer new
    receiver: flag;
    selector: #value:;
    arguments: { true }.
registry add: token finalizer: finalizer.
token := nil.
Smalltalk garbageCollect.
deadline := Time millisecondClockValue + 2000.
[ flag value not and: [ Time millisecondClockValue < deadline ] ] whileTrue: [ Processor yield ].
{ flag value . registry isEmpty }
`);

exports.run = async function(t, context) {
    await t.test("Pharo-level ephemeron layout probe runs under SqueakJS", async t => {
        const image = imagePath(context);
        if (!fs.existsSync(image)) return t.skip("Pharo ephemeron layout probe", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const imageArg = path.relative(context.rootDir, image);
        const r = runNodeSync(["squeak_node.js", imageArg, "eval", activeEphemeronExpression], {
            cwd: context.rootDir,
            timeoutMs: 30000,
        });
        t.equal(r.code, 0, "active ephemeron probe exits successfully");
        t.ok(!r.timedOut, "active ephemeron probe does not time out");
        t.match(r.output, /#\(5 true true 0 2\)|an Array\(5 true true 0 2\)/, "EphemeronLayout creates Spur format-5 objects with ordinary slot bytecode access");
        t.ok(!/primitiveFetchMourner primitive is missing|missing primitive: 172/.test(r.output), "primitive 172 is not reported missing during ephemeron probe startup");
    });

    await t.test("Pharo-level full GC fires an EphemeronLayout object and exposes it as a mourner", async t => {
        const image = imagePath(context);
        if (!fs.existsSync(image)) return t.skip("Pharo ephemeron firing probe", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const imageArg = path.relative(context.rootDir, image);
        const r = runNodeSync(["squeak_node.js", imageArg, "eval", firedEphemeronExpression], {
            cwd: context.rootDir,
            timeoutMs: 40000,
        });
        t.equal(r.code, 0, "fired ephemeron probe exits successfully");
        t.ok(!r.timedOut, "fired ephemeron probe does not time out");
        t.match(r.output, /#\(true true #Object\)|an Array\(true true #Object\)/, "full GC queues the fired ephemeron as a mourner and preserves its key for Smalltalk-side finalization");
        t.ok(!/primitiveFetchMourner primitive is missing|missing primitive: 172/.test(r.output), "primitive 172 remains implemented while fetching the queued ephemeron mourner");
        t.probe("Pharo-level ephemeron firing", "created an EphemeronLayout class in the metacello image, forced full GC, and fetched the fired ephemeron through FinalizationProcess primitiveFetchMourner");
    });

    await t.test("Pharo-level FinalizationRegistry manually mourns a fired ephemeron entry", async t => {
        const image = imagePath(context);
        if (!fs.existsSync(image)) return t.skip("Pharo FinalizationRegistry manual probe", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const imageArg = path.relative(context.rootDir, image);
        const r = runNodeSync(["squeak_node.js", imageArg, "eval", registryManualFinalizationExpression], {
            cwd: context.rootDir,
            timeoutMs: 40000,
        });
        t.equal(r.code, 0, "manual FinalizationRegistry probe exits successfully");
        t.ok(!r.timedOut, "manual FinalizationRegistry probe does not time out");
        t.match(r.output, /#\(true true true\)|an Array\(true true true\)/, "manual mourning runs ObjectFinalizer and removes the registry entry");
        t.ok(!/primitiveFetchMourner primitive is missing|missing primitive: 172/.test(r.output), "primitive 172 remains available for registry mourners");
        t.probe("Pharo-level FinalizationRegistry manual mourning", "registered an ObjectFinalizer, forced GC, fetched the ephemeron mourner through primitive 172, and invoked mourn manually");
    });

    await t.test("Pharo-level FinalizationRegistry is serviced by the running finalization process", async t => {
        const image = imagePath(context);
        if (!fs.existsSync(image)) return t.skip("Pharo FinalizationRegistry automatic probe", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const imageArg = path.relative(context.rootDir, image);
        const r = runNodeSync(["squeak_node.js", imageArg, "eval", registryAutomaticFinalizationExpression], {
            cwd: context.rootDir,
            timeoutMs: 40000,
        });
        t.equal(r.code, 0, "automatic FinalizationRegistry probe exits successfully");
        t.ok(!r.timedOut, "automatic FinalizationRegistry probe does not time out");
        t.match(r.output, /#\(true true\)|an Array\(true true\)/, "the finalization process wakes, mourns the registry entry, and runs the ObjectFinalizer");
        t.ok(!/primitiveFetchMourner primitive is missing|missing primitive: 172/.test(r.output), "primitive 172 remains available for automatic finalization");
    });

    await t.test("optional native Pharo agrees with SqueakJS on the ephemeron and registry probes", async t => {
        const image = imagePath(context);
        const nativeVM = process.env.PHARO_NATIVE_VM;
        if (!fs.existsSync(image) || !nativeVM || !fs.existsSync(nativeVM)) {
            return t.skip("native ephemeron comparison", "set PHARO14_IMAGE and PHARO_NATIVE_VM to compare Pharo-level ephemeron probes");
        }
        const imageArg = path.relative(context.rootDir, image);
        const pairs = [
            ["ephemeron firing", firedEphemeronExpression, /#\(true true #Object\)|an Array\(true true #Object\)/],
            ["manual registry mourning", registryManualFinalizationExpression, /#\(true true true\)|an Array\(true true true\)/],
            ["automatic registry finalization", registryAutomaticFinalizationExpression, /#\(true true\)|an Array\(true true\)/],
        ];
        for (const [label, expression, expected] of pairs) {
            const native = runNativeSync(nativeVM, image, expression, 40000);
            const squeakjs = runNodeSync(["squeak_node.js", imageArg, "eval", expression], {
                cwd: context.rootDir,
                timeoutMs: 40000,
            });
            t.ok(!native.timedOut, `native ${label} probe does not time out`);
            t.equal(native.code, 0, `native ${label} probe exits successfully`);
            t.ok(!squeakjs.timedOut, `SqueakJS ${label} probe does not time out`);
            t.equal(squeakjs.code, 0, `SqueakJS ${label} probe exits successfully`);
            t.match(native.output, expected, `native Pharo passes ${label}`);
            t.match(squeakjs.output, expected, `SqueakJS passes ${label}`);
        }
    });
};
