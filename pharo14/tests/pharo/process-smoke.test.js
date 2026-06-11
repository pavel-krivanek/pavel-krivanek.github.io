"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function runNode(args, options) {
    options = options || {};
    return new Promise(resolve => {
        const child = spawn(process.execPath, args, {
            cwd: options.cwd,
            env: Object.assign({}, process.env, options.env || {}),
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
        }, options.timeoutMs || 5000);
        child.stdout.on("data", data => stdout += data.toString());
        child.stderr.on("data", data => stderr += data.toString());
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, stdout, stderr, timedOut: signal === "SIGKILL" });
        });
    });
}

exports.run = async function(t, context) {
    await t.test("squeak_node.js still runs the bundled headless fixture to completion", async t => {
        const r = await runNode(["squeak_node.js", "headless/headless.image"], { cwd: context.rootDir, timeoutMs: 10000 });
        t.equal(r.code, 0, "headless fixture exits with success");
        t.match(r.stdout + r.stderr, /3 \+ 4 = 7/, "headless fixture printed arithmetic result");
    });

    await t.test("Pharo 14 metacello evaluates a minimal headless expression", async t => {
        const imagePath = process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 metacello smoke", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const r = await runNode(["squeak_node.js", imageArg, "eval", "1+2"], {
            cwd: context.rootDir,
            timeoutMs: 9000,
        });
        const output = r.stdout + r.stderr;
        t.equal(r.code, 0, "Pharo metacello eval exits with success");
        t.match(output, /squeak: ready/, "Pharo image reached interpreter-ready state");
        t.match(output, /(?:^|\n)3(?:\n|$)/, "Pharo evaluated 1+2 and printed 3");
        t.ok(!/missing primitive: (20|21|22|29|30|31|32|33|34|35|36|37)/.test(output), "no direct LargeInteger primitive missing warning appears");
        t.ok(!/not a bytecode: undefined/.test(output), "CompiledBlock PC handling no longer crashes with an undefined bytecode");
        t.ok(!/Cannot read properties of undefined \(reading 'pointers'\)/.test(output), "runtime-compiled DoIt no longer runs Sista bytecodes as V3 bytecodes");
        t.ok(!/KeyNotFound.*0FFFFFFFFFFFFFFF/.test(output), "64-bit SmallInteger maxVal dictionary/hash lookup blocker is gone");
        t.ok(!/SmallInteger class>>startUp/.test(output), "SmallInteger class startup no longer remains the active blocker");
        t.ok(!/SymbolTableSemaphore.*primitive #wait/.test(output), "Semaphore subclass wait failure is gone");
        t.ok(!/OSPlatform class>>determineActivePlatform not found/.test(output), "OSPlatform active-platform detection failure is gone");
        t.ok(!/missing module: FileAttributesPlugin/.test(output), "FileAttributesPlugin is now loadable");
        t.ok(!/missing primitive: \.primitiveGetCurrentWorkingDirectory/.test(output), "current-working-directory named primitive is now available");
        t.ok(!/missing primitive: FilePlugin\.primitiveFileDescriptorType/.test(output), "FilePlugin descriptor-type primitive is now available");
        t.ok(!/primitive #signalError:for: in File class failed/.test(output), "File class signalError startup failure is gone");
        t.probe("Pharo 14 metacello eval", "completed headless eval of 1+2 through OpalEvaluator/DoIt under SqueakJS");
    });

    await t.test("Pharo 14 full image advances past the previous CompiledBlock bytecode crash", async t => {
        const imagePath = process.env.PHARO14_FULL_IMAGE || path.join(context.rootDir, "pharo14-full.image");
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 full image probe", "set PHARO14_FULL_IMAGE or place pharo14-full.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const r = await runNode(["squeak_node.js", imageArg, "eval", "1+2"], {
            cwd: context.rootDir,
            timeoutMs: 16000,
        });
        const output = r.stdout + r.stderr;
        t.match(output, /squeak: ready/, "full image reached interpreter-ready state");
        t.ok(!/not a bytecode: undefined/.test(output), "previous CompiledBlock/Sista PC crash is gone");
        t.ok(!/KeyNotFound.*0FFFFFFFFFFFFFFF/.test(output), "64-bit SmallInteger maxVal dictionary/hash lookup blocker is gone");
        t.ok(!/OSPlatform class>>determineActivePlatform not found/.test(output), "OSPlatform active-platform detection failure is gone");
        t.ok(!/missing module: FileAttributesPlugin/.test(output), "FileAttributesPlugin is now loadable");
        t.ok(!/missing primitive: FilePlugin\.primitiveFileDescriptorType/.test(output), "FilePlugin descriptor-type primitive is now available");
        t.ok(!/missing primitive: \.primitiveGetenv/.test(output), "empty-module primitiveGetenv is now available");
        t.ok(!/missing primitive: \.primitiveLoadSymbolFromModule/.test(output), "empty-module primitiveLoadSymbolFromModule is now available");
        t.ok(!/missing primitive: \.primitiveInitilizeCallbacks/.test(output), "empty-module callback initialization primitive is now available");
        t.ok(!/Error: Can't find the requested origin/.test(output), "resolver no longer dies at environment/origin lookup");
        t.ok(!/missing module: UUIDPlugin/.test(output), "UUIDPlugin is now loadable");
        t.ok(!/missing primitive: UUIDPlugin\.primitiveMakeUUID/.test(output), "UUID generation primitive is now available");
        t.ok(!/missing primitive: FileAttributesPlugin\.primitiveFileExists/.test(output), "FileAttributesPlugin primitiveFileExists is now available");
        t.ok(!/missing primitive: FileAttributesPlugin\.primitiveFileAttribute/.test(output), "FileAttributesPlugin primitiveFileAttribute is now available");
        t.ok(!/missing primitive: FileAttributesPlugin\.primitiveOpendir/.test(output), "FileAttributesPlugin directory stream startup primitive is now available");
        t.ok(!/missing primitive: 172 \(primitiveFetchMourner\)/.test(output), "primitive 172 fetches VM-queued mourners instead of being a stub");
        t.ok(!/Improper store into indexable object/.test(output), "Bitmap/high-bit integer startup path no longer reaches improper indexable stores");
        t.ok(!/primitive #signalError:for: in File class failed/.test(output), "missing startup preference directories no longer collapse into File class primitiveFailed");
        t.ok(!/missing primitive: 158 \(primitiveCompareWith\)/.test(output), "primitiveCompareWith warning is gone");
        t.ok(!/primitive 156 not implemented yet/.test(output), "primitiveCompareBytes warning is gone");
        t.ok(!/stack unbalanced after primitive 113/.test(output), "quit primitive exits without stack-balance warning");
        t.ok(!/Failed to get file size/.test(output), "foreign file-handle size probes fail quietly without Node fstat noise");
        t.ok(!/faking primitive: LocalePlugin\.primitiveTimezoneOffset/.test(output), "LocalePlugin timezone offset is implemented without the fake-primitive shim");
        t.ok(!/Plugin libfreetype\.so\.6 could not be loaded/.test(output), "FreeType FFI startup probes resolve to a quiet stub module");
        t.ok(!/Plugin .*libSDL2-2\.0\.so\.0 could not be loaded/.test(output), "SDL2 FFI startup probes resolve to a quiet stub module");
        t.match(output, /(?:^|\n)3(?:\n|$)/, "full Pharo image now evaluates the requested headless expression");
        t.probe("Pharo 14 full image", "advanced through initial FFI, ephemerons, Morphic bitmap color-pattern creation, missing startup preference-directory probing, and completed eval 1+2");
    });

    await t.test("Pharo 14 full image uses ThreadedFFI for LibC callouts", async t => {
        const imagePath = process.env.PHARO14_FULL_IMAGE || path.join(context.rootDir, "pharo14-full.image");
        if (!fs.existsSync(imagePath)) return t.skip("Pharo 14 full image TFFI probe", "set PHARO14_FULL_IMAGE or place pharo14-full.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const expression = "{ TFFIBackend isAvailable . FFIBackend current class name . (LibC uniqueInstance getpid > 0) . ([ | src dest | src := #[65 66 67 0]. dest := ByteArray new: 4. LibC memCopy: src to: dest size: 4. dest ] value) . LibC uniqueInstance system: 'true' }";
        const r = await runNode(["squeak_node.js", imageArg, "eval", expression], {
            cwd: context.rootDir,
            timeoutMs: 18000,
        });
        const output = r.stdout + r.stderr;
        t.match(output, /#\(true #TFFIBackend true #\[65 66 67 0\] 0\)/, "TFFIBackend is selected and LibC getpid/memCopy/system callouts work");
        t.ok(!/SubclassResponsibility: FFICalloutMethodBuilder/.test(output), "LibC callouts no longer fall back to the abstract NullFFIBackend builder");
        t.ok(!/missing primitive: \.primitiveFillBasicType/.test(output), "ThreadedFFI type fill primitive is available");
        t.ok(!/missing primitive: \.primitiveDefineFunction/.test(output), "ThreadedFFI function-definition primitive is available");
        t.ok(!/missing primitive: \.primitiveSameThreadCallout/.test(output), "ThreadedFFI same-thread callout primitive is available");
        t.ok(!/primitive 646 not implemented yet/.test(output), "ExternalAddress uint8 store primitive used by C-string marshalling is implemented");
        t.ok(!/Plugin libfreetype\.so\.6 could not be loaded/.test(output), "FreeType FFI probes are quiet in richer callout startup");
        t.ok(!/Plugin .*libSDL2-2\.0\.so\.0 could not be loaded/.test(output), "SDL2 FFI probes are quiet in richer callout startup");
        t.probe("Pharo 14 full-image ThreadedFFI", "selected TFFIBackend and executed LibC getpid, memCopy, and system through JS FFI emulation");
    });


};
