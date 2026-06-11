"use strict";

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const loadSqueakJS = require("./support/load-squeakjs");
const { SYNTHETIC_DECODER_CASES } = require("../../tools/sista-bytecode-coverage-lib");

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
        const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs || 9000);
        child.stdout.on("data", data => stdout += data.toString());
        child.stderr.on("data", data => stderr += data.toString());
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, stdout, stderr, timedOut: signal === "SIGKILL" });
        });
    });
}

function runNodeSync(args, options) {
    options = options || {};
    const r = spawnSync(process.execPath, args, {
        cwd: options.cwd,
        env: Object.assign({}, process.env, options.env || {}),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: options.timeoutMs || 12000,
        killSignal: "SIGKILL",
    });
    const stdout = r.stdout || "";
    const stderr = r.stderr || "";
    return {
        code: r.status,
        signal: r.signal,
        stdout,
        stderr,
        timedOut: !!(r.error && r.error.code === "ETIMEDOUT"),
    };
}

function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAnsi(string) {
    return String(string).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function diagnosticLine(line) {
    return !line ||
        /^squeak: /.test(line) ||
        /^Not hacking /.test(line) ||
        /^Hacking /.test(line) ||
        /^missing primitive: /.test(line) ||
        /^Loaded module: /.test(line) ||
        /^faking primitive: /.test(line) ||
        /^Failed to get file size/.test(line) ||
        /^Partial GC/.test(line) ||
        /^\s+old space: /.test(line) ||
        /^Break: quit/.test(line) ||
        /^stack unbalanced after primitive/.test(line);
}

function resultLines(output) {
    return stripAnsi(output).split(/\r?\n/).filter(line => !diagnosticLine(line));
}

async function runEval(rootDir, imageArg, expression) {
    const r = await runNode(["squeak_node.js", imageArg, "eval", expression], {
        cwd: rootDir,
        timeoutMs: 12000,
    });
    const output = r.stdout + r.stderr;
    return Object.assign(r, { output, results: resultLines(output) });
}

function runEvalSync(rootDir, imageArg, expression) {
    const r = runNodeSync(["squeak_node.js", imageArg, "eval", expression], {
        cwd: rootDir,
        timeoutMs: 20000,
    });
    const output = r.stdout + r.stderr;
    return Object.assign(r, { output, results: resultLines(output) });
}

function makeLiteral(name, value) {
    return {
        name,
        pointers: [name + "Key", value === undefined ? name + "Value" : value],
        bytesAsString: () => name,
        assnKeyAsString: () => name + "Key",
        methodNumArgs: () => 2,
        sqInstName: () => name,
        toString: () => name,
    };
}

function makeMethod(bytes, literals) {
    literals = literals || [];
    return {
        bytes: Uint8Array.from(bytes),
        forceSista: true,
        methodSignFlag: () => false,
        methodGetLiteral: index => literals[index] || makeLiteral("lit" + index),
        methodGetSelector: index => "sel" + index,
    };
}

function decodeOnce(Squeak, bytes, literals, vm) {
    const calls = [];
    const client = new Proxy({}, {
        get(_target, prop) {
            return function() {
                calls.push([String(prop)].concat(Array.from(arguments)));
            };
        }
    });
    const stream = new Squeak.InstructionStreamSista(makeMethod(bytes, literals), vm);
    stream.interpretNextInstructionFor(client);
    return calls[0].map(value => value && value.name ? value.name : value);
}

exports.run = async function(t, context) {
    const Squeak = loadSqueakJS(context.rootDir);

    await t.test("Sista InstructionPrinter honors forceSista for freshly compiled Pharo methods", async t => {
        const literals = [makeLiteral("lit0"), makeLiteral("lit1"), makeLiteral("two", 2)];
        const method = makeMethod([0x51, 0x20, 0x60, 0x5C], literals);
        const vm = {
            trueObj: true,
            falseObj: false,
            nilObj: null,
            specialSelectors: ["+", 1],
        };
        const printer = new Squeak.InstructionPrinter(method, vm);
        const disassembly = printer.printInstructions();
        t.match(disassembly, /<51> pushConst: 1/, "0x51 is decoded as Sista push constant 1, not V3 loadLiteralIndirect 17");
        t.match(disassembly, /<20> pushConst: lit0/, "0x20 is decoded as Sista literal constant 0");
        t.match(disassembly, /<60> send: #\+/, "0x60 is decoded as Sista special-send plus");
        t.match(disassembly, /<5C> return: topOfStack/, "0x5C is decoded as Sista return-top");
    });

    await t.test("Sista decoder covers quick, extended, closure, and remote-temp bytecode forms", async t => {
        const literals = Array.from({ length: 300 }, (_unused, i) => makeLiteral("lit" + i));
        const specialSelectors = [];
        for (let i = 0; i < 64; i++) {
            specialSelectors[2 * i] = "special" + i;
            specialSelectors[2 * i + 1] = i % 3;
        }
        const vm = { trueObj: "true", falseObj: "false", nilObj: "nil", specialSelectors };
        const cases = SYNTHETIC_DECODER_CASES;
        for (const { bytes, expected, name } of cases) {
            t.equal(JSON.stringify(decodeOnce(Squeak, bytes, literals, vm)), JSON.stringify(expected),
                "decode " + name + " / " + bytes.map(b => b.toString(16).padStart(2, "0")).join(" "));
        }
    });

    await t.test("Sista JIT honors forceSista and extended full-closure literal indexes", async t => {
        require(path.join(context.rootDir, "jit.js"));
        const compiler = new Squeak.Compiler({ specialObjects: [] });
        const forceSistaMethod = {
            bytes: Uint8Array.from([0x51, 0x5C]),
            forceSista: true,
            methodSignFlag: () => false,
            methodGetLiteral: index => makeLiteral("lit" + index),
            methodGetSelector: index => "sel" + index,
            methodNumArgs: () => 0,
            methodTempCount: () => 0,
            methodNeedsLargeFrame: () => false,
            pointers: [],
        };
        const forceSistaFunction = compiler.generate(forceSistaMethod);
        t.ok(compiler.sista, "JIT treats forceSista methods as Sista even when the method header sign flag is absent");
        t.match(String(forceSistaFunction), /stack\[\+\+vm\.sp\] = 1;/, "JIT decodes byte 0x51 as Sista push-constant-one, not as a V3 bytecode");

        const extendedFullClosureMethod = {
            bytes: Uint8Array.from([0xE0, 0x01, 0xF9, 0x05, 0x00, 0x5B]),
            forceSista: true,
            methodSignFlag: () => false,
            methodGetLiteral: index => makeLiteral("lit" + index),
            methodGetSelector: index => "sel" + index,
            methodNumArgs: () => 0,
            methodTempCount: () => 0,
            methodNeedsLargeFrame: () => false,
            pointers: [],
        };
        const extendedFullClosureFunction = compiler.generate(extendedFullClosureMethod);
        t.match(String(extendedFullClosureFunction), /lit\[262\]/,
            "JIT computes Sista full-closure literal index as b2 + extA * 256, plus the CompiledMethod literal-header slot");
    });


    await t.test("Pharo 14 metacello evaluates a Sista expression corpus under SqueakJS", async t => {
        const imagePath = process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
        if (!fs.existsSync(imagePath)) return t.skip("Sista eval corpus", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const corpus = [
            ["constants and quick arithmetic group",
                "{ nil . 1 + 2 . 7 - 9 . 3 < 4 . (-7) // 3 . 2 bitShift: 10 }",
                "#(nil 3 -2 true -3 2048)"],
            ["arrays temps branches loops and cascades group",
                "{ { 1 . 2 + 3 } second . [ | x | x := 3. x + 4 ] value . (true ifTrue: [ 5 ] ifFalse: [ 6 ]) . [ | x | x := 0. [ x < 3 ] whileTrue: [ x := x + 1 ]. x ] value . (OrderedCollection new add: 1; add: 2; size) }",
                "#(5 7 5 3 2)"],
            ["full and copied closure group",
                "{ [ 1 + 2 ] value . [ :x | x + 2 ] value: 5 . [ | x | x := 5. [ x + 2 ] value ] value }",
                "#(3 7 7)"],
            ["non-local return", "[ ^ 5 ] value", "5"],
        ];
        for (const [name, expression, expected] of corpus) {
            const r = runEvalSync(context.rootDir, imageArg, expression);
            t.equal(r.code, 0, name + " exits successfully");
            t.ok(!r.timedOut, name + " does not time out");
            t.match(r.output, new RegExp("(?:^|\\n)" + escapeRegExp(expected) + "(?:\\n|$)"), name + " prints " + expected);
            t.ok(!/not a bytecode: undefined|not a bytecode: |Unknown bytecode: |Cannot read properties of undefined/.test(r.output),
                name + " has no bytecode dispatch crash");
        }
        t.probe("Sista eval corpus", "15 logical Pharo expressions grouped into " + corpus.length + " eval runs exercised constants, quick sends, jumps, arrays, temps, loops, cascades, full closures, copied closures, and non-local return");
    });

    await t.test("Pharo 14 metacello evaluates a nested closure stress corpus under SqueakJS", async t => {
        const imagePath = process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
        if (!fs.existsSync(imagePath)) return t.skip("Sista nested closure stress corpus", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const corpus = [
            ["nested closure mutation group",
                "{ [ | x | x := 1. [ [ x + 2 ] value ] value ] value . [ | x | x := 1. [ x := x + 2 ] value. x ] value . [ | x f | x := 1. f := [ x := x + 1 ]. f value. f value. x ] value . [ | x | x := 1. [ | y | y := 2. [ x + y ] value ] value ] value . [ | x | x := 1. [ | y | y := 2. [ x := x + y ] value ] value. x ] value . [ | a b | a := 1. b := [ a := a + 1. [ a := a + 1 ] value ]. b value. a ] value }",
                "#(3 3 3 3 3 3)"],
            ["loop and collection closure group",
                "{ [ | sum | sum := 0. 1 to: 5 do: [ :i | sum := sum + i ]. sum ] value . [ | blocks | blocks := (1 to: 3) collect: [ :i | [ i + 10 ] ]. blocks inject: 0 into: [ :sum :b | sum + b value ] ] value . [ | x | x := 0. 1 to: 4 do: [ :i | (i even) ifTrue: [ x := x + i ] ]. x ] value . ([ :a :b | a + b ] cull: 2 cull: 3) . { [ 1 ] value . [ 2 ] value . [ 3 ] value } sum . (2 caseOf: { [1] -> [10]. [2] -> [20] } otherwise: [30]) . [ | x | x := 0. [ x := x + 1. x = 4 ] whileFalse. x ] value }",
                "#(15 36 6 5 6 20 4)"],
            ["closure factory group",
                "{ (([ :x | [ :y | x + y ] ] value: 3) value: 4) . [ | f | f := [ :x | [ :y | x + y ] ] value: 3. f value: 4 ] value . ((([ :x | [ :y | [ :z | x + y + z ] ] ] value: 1) value: 2) value: 3) }",
                "#(7 7 6)"],
        ];
        for (const [name, expression, expected] of corpus) {
            const r = runEvalSync(context.rootDir, imageArg, expression);
            t.equal(r.code, 0, name + " exits successfully");
            t.ok(!r.timedOut, name + " does not time out");
            t.match(r.output, new RegExp("(?:^|\\n)" + escapeRegExp(expected) + "(?:\\n|$)"), name + " prints " + expected);
            t.ok(!/not a bytecode: undefined|not a bytecode: |Unknown bytecode: |Cannot read properties of undefined/.test(r.output),
                name + " has no bytecode dispatch crash");
        }
        t.probe("Sista nested closure stress corpus", "16 logical Pharo expressions grouped into " + corpus.length + " eval runs exercised nested closures, copied temp mutation, temp vectors, escaped closures, loops, cull");
    });

    await t.test("optional native Pharo agrees with the SqueakJS Sista eval corpus", async t => {
        const imagePath = process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
        const nativeVM = process.env.PHARO_NATIVE_VM;
        if (!fs.existsSync(imagePath) || !nativeVM || !fs.existsSync(nativeVM)) {
            return t.skip("native Pharo comparison", "set PHARO14_IMAGE and PHARO_NATIVE_VM to compare SqueakJS results with native Pharo");
        }
        const imageArg = path.relative(context.rootDir, imagePath);
        const corpus = [
            ["1 + 2", "3"],
            ["7 - 9", "-2"],
            ["true ifTrue: [ 5 ] ifFalse: [ 6 ]", "5"],
            ["| x | x := 0. [ x < 3 ] whileTrue: [ x := x + 1 ]. x", "3"],
            ["[ :x | x + 2 ] value: 5", "7"],
            ["| x | x := 5. [ x + 2 ] value", "7"],
        ];
        for (const [expression, expected] of corpus) {
            const nativeRun = spawnSync(nativeVM, ["--headless", imagePath, "eval", expression], {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
                timeout: 20000,
                killSignal: "SIGKILL",
            });
            const nativeOutput = (nativeRun.stdout || "") + (nativeRun.stderr || "");
            const native = {
                code: nativeRun.status,
                signal: nativeRun.signal,
                timedOut: !!(nativeRun.error && nativeRun.error.code === "ETIMEDOUT"),
                output: nativeOutput,
                results: resultLines(nativeOutput),
            };
            const squeakjs = runEvalSync(context.rootDir, imageArg, expression);
            t.ok(!native.timedOut, "native Pharo does not time out for " + expression);
            t.equal(native.code, 0, "native Pharo exits successfully for " + expression);
            t.ok(!squeakjs.timedOut, "SqueakJS does not time out for " + expression);
            t.equal(squeakjs.code, 0, "SqueakJS exits successfully for " + expression);
            t.equal(native.results[native.results.length - 1], expected, "native expected result for " + expression);
            t.equal(squeakjs.results[squeakjs.results.length - 1], native.results[native.results.length - 1], "SqueakJS agrees with native Pharo for " + expression);
        }
    });
};
