"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const loadSqueakJS = require("./support/load-squeakjs");

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

function runNodeSync(args, options) {
    options = options || {};
    const r = spawnSync(process.execPath, args, {
        cwd: options.cwd,
        env: Object.assign({}, process.env, options.env || {}),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: options.timeoutMs || 20000,
        killSignal: "SIGKILL",
    });
    const stdout = r.stdout || "";
    const stderr = r.stderr || "";
    return {
        code: r.status,
        signal: r.signal,
        stdout,
        stderr,
        output: stdout + stderr,
        timedOut: !!(r.error && r.error.code === "ETIMEDOUT"),
    };
}

function literalObject(label, compiledBlock) {
    return {
        label,
        compiledBlock,
        pointers: [label + "Key", label + "Value"],
        bytesAsString: () => label,
        assnKeyAsString: () => label,
        methodNumArgs: () => compiledBlock ? compiledBlock.methodNumArgs() : 0,
        sqInstName: () => label,
        toString: () => label,
    };
}

function buildFixtureMethod(methodRecord) {
    const literals = (methodRecord.literals || []).map((literal, index) => {
        const compiledBlock = literal.compiledBlock ? buildFixtureMethod(literal.compiledBlock) : null;
        return literalObject(literal.printString || ("literal" + index), compiledBlock);
    });
    return {
        bytes: Uint8Array.from(methodRecord.bytes || []),
        forceSista: true,
        methodSignFlag: () => false,
        methodGetLiteral: index => literals[index] || literalObject("missingLiteral" + index),
        methodGetSelector: index => literals[index] || literalObject("missingSelector" + index),
        methodNumArgs: () => methodRecord.numArgs || 0,
        methodTempCount: () => methodRecord.numTemps || 0,
        methodNeedsLargeFrame: () => false,
        pointers: [],
    };
}

function walkMethods(methodRecord, pathName, visitor) {
    visitor(methodRecord, pathName);
    (methodRecord.literals || []).forEach((literal, index) => {
        if (literal.compiledBlock) walkMethods(literal.compiledBlock, pathName + ".literal" + index, visitor);
    });
}

function makeSpecialSelectors() {
    const selectors = [
        ["+", 1], ["-", 1], ["<", 1], [">", 1], ["<=", 1], [">=", 1], ["=", 1], ["~=", 1],
        ["*", 1], ["/", 1], ["\\", 1], ["@", 1], ["bitShift:", 1], ["//", 1], ["bitAnd:", 1], ["bitOr:", 1],
        ["at:", 1], ["at:put:", 2], ["size", 0], ["next", 0], ["nextPut:", 1], ["atEnd", 0], ["==", 1], ["class", 0],
        ["blockCopy:", 1], ["value", 0], ["value:", 1], ["do:", 1], ["new", 0], ["new:", 1], ["x", 0], ["y", 0],
    ];
    const flat = [];
    selectors.forEach(([name, argc]) => {
        flat.push(literalObject(name));
        flat.push(argc);
    });
    return flat;
}

function loadFixtures(rootDir) {
    return JSON.parse(fs.readFileSync(path.join(rootDir, "tests", "pharo", "fixtures", "sista-native-fixtures.json"), "utf8"));
}

function parseSqueakJSDisassembly(disassembly) {
    return disassembly.trim().split(/\r?\n/).filter(Boolean).map(line => {
        const match = line.match(/^(\d+) <([^>]+)> (.*)$/);
        if (!match) throw new Error("cannot parse SqueakJS disassembly line: " + line);
        return {
            relativePc: Number(match[1]),
            bytes: match[2].split(/\s+/).filter(Boolean).map(hex => parseInt(hex, 16)),
            description: match[3],
        };
    });
}

function normalizeInstructionDescription(description, baseOffset) {
    let d = String(description);
    d = d.replace(/^pushConstant:/, "pushConst:");
    d = d.replace(/^push: self$/, "self");
    d = d.replace(/^pushThisContext$/, "pushActiveContext");
    d = d.replace(/^push: thisContext$/, "pushActiveContext");
    d = d.replace(/^primitive: (\d+)$/, "callPrimitive: $1");
    d = d.replace(/^returnTop$/, "return: topOfStack");
    d = d.replace(/^jumpFalse: (\d+)$/, (_all, target) => "jumpIfFalse: " + (Number(target) - baseOffset));
    d = d.replace(/^jumpTrue: (\d+)$/, (_all, target) => "jumpIfTrue: " + (Number(target) - baseOffset));
    d = d.replace(/^jumpTo: (\d+)$/, (_all, target) => "jumpTo: " + (Number(target) - baseOffset));
    d = d.replace(/^send: #+/, "send: ");
    d = d.replace(/^send: /, "send: ").replace(/^send: #+/, "send: ");
    d = d.replace(/^superSend: #+/, "superSend: ");
    d = d.replace(/^directedSuperSend: #+/, "directedSuperSend: ");
    d = d.replace(/^pushLit: (.*)$/, "pushBinding: $1");
    d = d.replace(/^pushBinding: #?([^\-]+)->.*$/, "pushBinding: $1");
    d = d.replace(/^pushInstVar: (\d+)$/, "pushRcvr: $1");
    d = d.replace(/^popIntoInstVar: (\d+)$/, "popIntoRcvr: $1");
    d = d.replace(/^storeIntoInstVar: (\d+)$/, "storeIntoRcvr: $1");
    d = d.replace(/^popIntoLit: #?(.+)$/, "popIntoLit: $1");
    d = d.replace(/^storeIntoLit: #?(.+)$/, "storeIntoLit: $1");
    d = d.replace(/^popIntoBinding: #?([^\-]+)->.*$/, "popIntoLit: $1");
    d = d.replace(/^storeIntoBinding: #?([^\-]+)->.*$/, "storeIntoLit: $1");
    d = d.replace(/^push: (\d+) ofTemp: (\d+)$/, "pushTemp: $1 inVectorAt: $2");
    d = d.replace(/^storeInto: (\d+) ofTemp: (\d+)$/, "storeIntoTemp: $1 inVectorAt: $2");
    d = d.replace(/^popInto: (\d+) ofTemp: (\d+)$/, "popIntoTemp: $1 inVectorAt: $2");
    d = d.replace(/^pop: (\d+) into: \(Array new: \1\)$/, "pop $1 into (Array new: $1)");
    d = d.replace(/^fullClosure:.* NumCopied: (\d+)$/, "pushFullClosure: numCopied: $1");
    d = d.replace(/^pushFullClosure: .* numCopied: (\d+) numArgs: \d+$/, "pushFullClosure: numCopied: $1");
    return d;
}

function nativeTraceWithNormalizedDescriptions(methodRecord) {
    const trace = methodRecord.symbolicTrace || [];
    const baseOffset = trace.length ? trace[0].offset : 0;
    return trace.map(instruction => ({
        relativePc: instruction.relativePc,
        bytes: instruction.bytes,
        description: normalizeInstructionDescription(instruction.description, baseOffset),
    }));
}

function squeakJSTraceForMethod(Squeak, methodRecord, vm) {
    const method = buildFixtureMethod(methodRecord);
    const disassembly = new Squeak.InstructionPrinter(method, vm).printInstructions();
    return parseSqueakJSDisassembly(disassembly).map(instruction => ({
        relativePc: instruction.relativePc,
        bytes: instruction.bytes,
        description: normalizeInstructionDescription(instruction.description, 0),
    }));
}

exports.run = async function(t, context) {
    const Squeak = loadSqueakJS(context.rootDir);
    const fixturePayload = loadFixtures(context.rootDir);

    await t.test("native-generated Sista fixture file is internally consistent", async t => {
        const corpus = JSON.parse(fs.readFileSync(path.join(context.rootDir, "tests", "pharo", "fixtures", "sista-expression-corpus.json"), "utf8"));
        t.equal(fixturePayload.fixtureFormat, 4, "fixture format version is current");
        t.equal(fixturePayload.fixtureCount, fixturePayload.fixtures.length, "fixtureCount matches fixture array length");
        t.equal(fixturePayload.fixtures.length, corpus.length, "native fixture count matches corpus count");
        for (const fixture of fixturePayload.fixtures) {
            t.ok(fixture.name && fixture.expression && fixture.expectedPrintString, "fixture has name, expression, and expected result");
            t.ok(typeof fixture.source === "string", fixture.name + " records the native source that was compiled");
            t.ok(typeof fixture.className === "string", fixture.name + " records the native class that was compiled against");
            t.ok(typeof fixture.skipEval === "boolean", fixture.name + " records whether it participates in SqueakJS eval checks");
            t.ok(Array.isArray(fixture.compiledMethod.bytes), fixture.name + " has top-level byte array");
            t.ok(fixture.compiledMethod.bytes.length > 0, fixture.name + " top-level byte array is non-empty");
            t.ok(Array.isArray(fixture.compiledMethod.symbolicTrace), fixture.name + " has native symbolic instruction trace");
            t.ok(fixture.compiledMethod.symbolicTrace.length > 0, fixture.name + " native symbolic trace is non-empty");
            if (!fixture.skipEval) t.ok(fixture.compiledMethod.literals.some(lit => lit.compiledBlock), fixture.name + " includes the native-compiled expression block");
        }
    });

    await t.test("SqueakJS Sista decoder consumes every native-generated method and block fixture", async t => {
        const vm = {
            trueObj: literalObject("true"),
            falseObj: literalObject("false"),
            nilObj: literalObject("nil"),
            specialSelectors: makeSpecialSelectors(),
        };
        let methodCount = 0;
        let byteCount = 0;
        let fullClosureCount = 0;
        let remoteTempCount = 0;
        let primitiveCallCount = 0;
        let directedSuperSendCount = 0;
        let activeContextCount = 0;
        let extendedLiteralInstructionCount = 0;
        let extendedTempInstructionCount = 0;
        for (const fixture of fixturePayload.fixtures) {
            walkMethods(fixture.compiledMethod, fixture.name, (methodRecord, methodPath) => {
                methodCount++;
                byteCount += methodRecord.bytes.length;
                fullClosureCount += methodRecord.bytes.filter(byte => byte === 0xF9).length;
                remoteTempCount += methodRecord.bytes.filter(byte => byte === 0xFB || byte === 0xFC || byte === 0xFD).length;
                primitiveCallCount += methodRecord.bytes.filter(byte => byte === 0xF8).length;
                directedSuperSendCount += (methodRecord.symbolicTrace || []).filter(instruction => /^directedSuperSend:/.test(instruction.description)).length;
                activeContextCount += (methodRecord.symbolicTrace || []).filter(instruction => instruction.description === "pushThisContext").length;
                extendedLiteralInstructionCount += (methodRecord.symbolicTrace || []).filter(instruction => instruction.bytes && instruction.bytes[0] === 0xE0 && instruction.bytes.includes(0xE4)).length;
                extendedTempInstructionCount += (methodRecord.symbolicTrace || []).filter(instruction => instruction.bytes && (instruction.bytes[0] === 0xE5 || instruction.bytes[0] === 0xF2)).length;
                const method = buildFixtureMethod(methodRecord);
                const printer = new Squeak.InstructionPrinter(method, vm);
                const disassembly = printer.printInstructions();
                t.ok(disassembly.length > 0, methodPath + " disassembles to non-empty text");
                t.ok(!/!!!|Unknown bytecode|not a bytecode|undefined/.test(disassembly), methodPath + " has no decoder/printer error");
                const nativeTrace = nativeTraceWithNormalizedDescriptions(methodRecord);
                const squeakJSTrace = parseSqueakJSDisassembly(disassembly).map(instruction => ({
                    relativePc: instruction.relativePc,
                    bytes: instruction.bytes,
                    description: normalizeInstructionDescription(instruction.description, 0),
                }));
                t.equal(JSON.stringify(squeakJSTrace), JSON.stringify(nativeTrace), methodPath + " symbolic Sista trace matches native Pharo instruction-by-instruction");
            });
        }
        t.ok(methodCount >= fixturePayload.fixtures.length * 2, "decoder visited top-level methods and embedded compiled blocks");
        t.ok(byteCount > 200, "native fixture corpus covers a substantial bytecode body");
        t.ok(fullClosureCount > 0, "native fixture corpus includes Sista full-closure bytecodes");
        t.ok(remoteTempCount > 0, "native fixture corpus includes remote-temp bytecodes");
        t.ok(primitiveCallCount > 0, "native fixture corpus includes primitive-call bytecodes");
        t.ok(directedSuperSendCount > 0, "native fixture corpus includes directed-super-send bytecodes");
        t.ok(activeContextCount > 0, "native fixture corpus includes active-context bytecodes");
        t.ok(extendedLiteralInstructionCount > 0, "native fixture corpus includes extended literal/index bytecodes");
        t.ok(extendedTempInstructionCount > 0, "native fixture corpus includes extended temp-index bytecodes");
        t.probe("native Sista bytecode fixtures", methodCount + " compiled methods/blocks, " + byteCount + " bytecode bytes, " + fullClosureCount + " full closures, " + remoteTempCount + " remote-temp operations, " + primitiveCallCount + " primitive calls, " + directedSuperSendCount + " directed super sends decoded");
    });

    await t.test("Pharo 14 metacello evaluates native-generated Sista fixture expressions under SqueakJS", async t => {
        const imagePath = process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
        if (!fs.existsSync(imagePath)) return t.skip("native-generated fixture eval", "set PHARO14_IMAGE or place pharo14-metacello.image in the repo root");
        const imageArg = path.relative(context.rootDir, imagePath);
        const evalFixtures = fixturePayload.fixtures.filter(fixture => !fixture.skipEval);
        const regularFixtures = evalFixtures.filter(fixture => fixture.name !== "non local return");
        const nonLocalReturnFixture = evalFixtures.find(fixture => fixture.name === "non local return");
        const groupedExpression = "{ " + regularFixtures.map(fixture => "[ " + fixture.expression + " ] value").join(" . ") + " }";
        const groupedExpected = "#(" + regularFixtures.map(fixture => fixture.expectedPrintString).join(" ") + ")";
        const grouped = runNodeSync(["squeak_node.js", imageArg, "eval", groupedExpression], {
            cwd: context.rootDir,
            timeoutMs: 30000,
        });
        const groupedResults = resultLines(grouped.output);
        t.equal(grouped.code, 0, "grouped native fixture expression exits successfully");
        t.ok(!grouped.timedOut, "grouped native fixture expression does not time out");
        t.equal(groupedResults[groupedResults.length - 1], groupedExpected, "grouped fixture result array matches native Pharo printStrings");
        t.ok(!/not a bytecode: undefined|not a bytecode: |Unknown bytecode: |Cannot read properties of undefined/.test(grouped.output),
            "grouped fixture expression has no bytecode dispatch crash");

        if (nonLocalReturnFixture) {
            const nonLocal = runNodeSync(["squeak_node.js", imageArg, "eval", nonLocalReturnFixture.expression], {
                cwd: context.rootDir,
                timeoutMs: 20000,
            });
            const nonLocalResults = resultLines(nonLocal.output);
            t.equal(nonLocal.code, 0, "non-local return fixture exits successfully");
            t.ok(!nonLocal.timedOut, "non-local return fixture does not time out");
            t.equal(nonLocalResults[nonLocalResults.length - 1], nonLocalReturnFixture.expectedPrintString, "non-local return fixture matches native Pharo expected printString");
            t.ok(!/not a bytecode: undefined|not a bytecode: |Unknown bytecode: |Cannot read properties of undefined/.test(nonLocal.output),
                "non-local return fixture has no bytecode dispatch crash");
        }
        t.probe("native fixture eval corpus", evalFixtures.length + " native-compiled fixture expressions checked by SqueakJS in grouped eval form and matched native printString results; " + (fixturePayload.fixtures.length - evalFixtures.length) + " decode-only fixtures retained for bytecode coverage");
    });

    await t.test("optional native Pharo regenerates the same Sista bytecode fixture payload", async t => {
        const imagePath = process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
        const nativeVM = process.env.PHARO_NATIVE_VM;
        if (!fs.existsSync(imagePath) || !nativeVM || !fs.existsSync(nativeVM)) {
            return t.skip("native fixture regeneration", "set PHARO14_IMAGE and PHARO_NATIVE_VM to regenerate and compare fixtures");
        }
        const tmp = path.join(os.tmpdir(), "squeakjs-sista-fixtures-" + process.pid + ".json");
        const run = spawnSync(process.execPath, [
            path.join(context.rootDir, "tools", "generate-native-sista-fixtures.js"),
            "--vm", nativeVM,
            "--image", imagePath,
            "--corpus", path.join(context.rootDir, "tests", "pharo", "fixtures", "sista-expression-corpus.json"),
            "--out", tmp,
        ], {
            cwd: context.rootDir,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 45000,
            killSignal: "SIGKILL",
        });
        t.equal(run.status, 0, "native fixture generator exits successfully: " + (run.stdout || run.stderr));
        const regenerated = JSON.parse(fs.readFileSync(tmp, "utf8"));
        fs.unlinkSync(tmp);
        t.equal(JSON.stringify(regenerated.fixtures), JSON.stringify(fixturePayload.fixtures), "regenerated native bytecode fixtures match the committed fixtures exactly");
    });
};
