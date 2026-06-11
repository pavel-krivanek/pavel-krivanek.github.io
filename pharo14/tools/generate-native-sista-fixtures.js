#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function usage() {
    console.error("usage: node tools/generate-native-sista-fixtures.js [--vm /path/pharo] [--image /path/image] [--corpus file] [--out file]");
    console.error("       or set PHARO_NATIVE_VM and PHARO14_IMAGE");
}

function parseArgs(argv) {
    const args = {
        vm: process.env.PHARO_NATIVE_VM,
        image: process.env.PHARO14_IMAGE,
        corpus: path.join(__dirname, "..", "tests", "pharo", "fixtures", "sista-expression-corpus.json"),
        out: path.join(__dirname, "..", "tests", "pharo", "fixtures", "sista-native-fixtures.json"),
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") {
            usage();
            process.exit(0);
        }
        if (!["--vm", "--image", "--corpus", "--out"].includes(arg) || i + 1 >= argv.length) {
            usage();
            process.exit(2);
        }
        args[arg.slice(2)] = argv[++i];
    }
    return args;
}

function smalltalkString(value) {
    return "'" + String(value).replace(/'/g, "''") + "'";
}

function parseMarkerJson(raw) {
    // Pharo can produce a WideString JSON payload when the generated fixture includes
    // character/unicode strings.  On stdout that can arrive with embedded NUL bytes.
    // Removing NULs keeps the ASCII JSON syntax intact and makes candidate probes robust.
    return JSON.parse(String(raw).replace(/\u0000/g, ""));
}

function buildSmalltalk(corpus) {
    const specs = corpus.map(item => {
        const expression = item.expression || "";
        const source = item.source || "";
        const skipEval = item.skipEval ? "true" : "false";
        const className = item.className || "";
        return `{ ${smalltalkString(item.name)} . ${smalltalkString(expression)} . ${smalltalkString(source)} . ${skipEval} . ${smalltalkString(className)} }`;
    }).join(" .\n        ");
    return `| specs dumpMethod dumpTrace fixtures |

1 to: 40 do: [ :i |
    Smalltalk globals
        at: ('SqueakJSSistaProbeGlobal', (i printPaddedWith: $0 to: 2)) asSymbol
        put: i ].

specs := {
        ${specs}
    }.

dumpTrace := [ :cm |
    | decoded firstOffset |
    decoded := (SymbolicBytecodeBuilder new method: cm) decode.
    firstOffset := decoded isEmpty ifTrue: [ 0 ] ifFalse: [ decoded first offset ].
    (decoded collect: [ :bc |
        | td |
        td := Dictionary new.
        td at: 'offset' put: bc offset.
        td at: 'relativePc' put: bc offset - firstOffset.
        td at: 'bytes' put: bc bytes asArray.
        td at: 'description' put: bc description.
        td ]) asArray ].

dumpMethod := nil.
dumpMethod := [ :cm |
    | d literalDumper |
    literalDumper := [ :lit |
        | ld |
        ld := Dictionary new.
        ld at: 'class' put: lit class name asString.
        ld at: 'printString' put: lit printString.
        lit isCompiledBlock
            ifTrue: [
                ld at: 'kind' put: 'compiledBlockLiteral'.
                ld at: 'compiledBlock' put: (dumpMethod value: lit) ]
            ifFalse: [
                (lit respondsTo: #compiledBlock)
                    ifTrue: [
                        ld at: 'kind' put: 'compiledBlockLiteral'.
                        ld at: 'compiledBlock' put: (dumpMethod value: lit compiledBlock) ]
                    ifFalse: [ ld at: 'kind' put: 'literal' ] ].
        ld ].
    d := Dictionary new.
    d at: 'class' put: cm class name asString.
    d at: 'numArgs' put: cm numArgs.
    d at: 'numTemps' put: cm numTemps.
    d at: 'numLiterals' put: cm numLiterals.
    d at: 'bytes' put: cm bytecodes asArray.
    d at: 'symbolicTrace' put: (dumpTrace value: cm).
    d at: 'literals' put: ((cm literals collect: [ :lit | literalDumper value: lit ]) asArray).
    d ].

fixtures := specs collect: [ :spec |
    | name expression source skipEval className compileClass compileResult method result dict |
    name := spec first.
    expression := spec second.
    source := spec third.
    skipEval := spec fourth.
    className := spec fifth.
    source isEmptyOrNil ifTrue: [ source := 'DoIt ^ [ ', expression, ' ] value' ].
    compileClass := className isEmptyOrNil
        ifTrue: [ UndefinedObject ]
        ifFalse: [ Smalltalk globals at: className asSymbol ].
    compileResult := OpalCompiler new source: source; class: compileClass; doCompile.
    method := compileResult compiledMethod.
    result := skipEval
        ifTrue: [ '<decode-only>' ]
        ifFalse: [ [ (nil withArgs: #() executeMethod: method) printString ]
            on: Error
            do: [ :ex | 'ERROR: ', ex class name asString, ': ', ex messageText ] ].
    dict := Dictionary new.
    dict at: 'name' put: name.
    dict at: 'expression' put: expression.
    dict at: 'source' put: source.
    dict at: 'skipEval' put: skipEval.
    dict at: 'className' put: className.
    dict at: 'expectedPrintString' put: result.
    dict at: 'compiledMethod' put: (dumpMethod value: method).
    dict ].

Stdio stdout
    nextPutAll: '@@SISTA_FIXTURES@@';
    nextPutAll: (STONJSON toString: fixtures asArray);
    lf.
nil`;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.vm || !args.image || !fs.existsSync(args.vm) || !fs.existsSync(args.image)) {
        usage();
        process.exit(2);
    }
    const corpus = JSON.parse(fs.readFileSync(args.corpus, "utf8"));
    const code = buildSmalltalk(corpus);
    const run = spawnSync(args.vm, ["--headless", args.image, "eval", code], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
        killSignal: "SIGKILL",
    });
    const output = (run.stdout || "") + (run.stderr || "");
    if (run.error || run.status !== 0) {
        console.error(output);
        throw run.error || new Error("native Pharo fixture generation failed with status " + run.status);
    }
    const markerLine = output.split(/\r?\n/).find(line => line.startsWith("@@SISTA_FIXTURES@@"));
    if (!markerLine) {
        console.error(output);
        throw new Error("native Pharo fixture generation did not emit @@SISTA_FIXTURES@@ marker");
    }
    const fixtures = parseMarkerJson(markerLine.slice("@@SISTA_FIXTURES@@".length));
    const payload = {
        generatedBy: "tools/generate-native-sista-fixtures.js",
        image: path.basename(args.image),
        fixtureFormat: 4,
        fixtureCount: fixtures.length,
        fixtures,
    };
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(payload, null, 2) + "\n");
    console.log(`wrote ${args.out} (${fixtures.length} fixtures)`);
}

main();
