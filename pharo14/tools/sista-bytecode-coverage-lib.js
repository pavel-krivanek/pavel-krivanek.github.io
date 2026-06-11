#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const BYTECODE_FAMILIES = [
    { id: "quick-push-receiver-variable", label: "quick push receiver variable", opcodes: "00-0F", implemented: true },
    { id: "quick-push-literal-variable", label: "quick push literal variable", opcodes: "10-1F", implemented: true },
    { id: "quick-push-literal-constant", label: "quick push literal constant", opcodes: "20-3F", implemented: true },
    { id: "quick-push-temp", label: "quick push temporary", opcodes: "40-4B", implemented: true },
    { id: "quick-push-receiver", label: "quick push receiver", opcodes: "4C", implemented: true },
    { id: "quick-push-true-false-nil", label: "quick push true/false/nil", opcodes: "4D-4F", implemented: true },
    { id: "quick-push-smallint", label: "quick push SmallInteger 0/1", opcodes: "50-51", implemented: true },
    { id: "quick-push-active-context", label: "quick push active context", opcodes: "52", implemented: true },
    { id: "quick-dup", label: "quick duplicate top", opcodes: "53", implemented: true },
    { id: "reserved-quick-54-57", label: "reserved quick opcodes", opcodes: "54-57", implemented: false },
    { id: "quick-return", label: "quick returns", opcodes: "58-5E", implemented: true },
    { id: "quick-nop", label: "quick nop", opcodes: "5F", implemented: true },
    { id: "quick-special-send", label: "quick special selector send", opcodes: "60-7F", implemented: true },
    { id: "quick-send-0-arg", label: "quick literal send, 0 args", opcodes: "80-8F", implemented: true },
    { id: "quick-send-1-arg", label: "quick literal send, 1 arg", opcodes: "90-9F", implemented: true },
    { id: "quick-send-2-arg", label: "quick literal send, 2 args", opcodes: "A0-AF", implemented: true },
    { id: "quick-jump", label: "quick unconditional jump", opcodes: "B0-B7", implemented: true },
    { id: "quick-jump-if-true", label: "quick jump if true", opcodes: "B8-BF", implemented: true },
    { id: "quick-jump-if-false", label: "quick jump if false", opcodes: "C0-C7", implemented: true },
    { id: "quick-pop-receiver-variable", label: "quick pop into receiver variable", opcodes: "C8-CF", implemented: true },
    { id: "quick-pop-temp", label: "quick pop into temporary", opcodes: "D0-D7", implemented: true },
    { id: "quick-pop", label: "quick pop", opcodes: "D8", implemented: true },
    { id: "reserved-quick-D9-DF", label: "reserved quick opcodes", opcodes: "D9-DF", implemented: false },
    { id: "extension-a", label: "extension A prefix", opcodes: "E0", implemented: true },
    { id: "extension-b", label: "extension B prefix", opcodes: "E1", implemented: true },
    { id: "extended-push-receiver-variable", label: "extended push receiver variable", opcodes: "E2", implemented: true },
    { id: "extended-push-literal-variable", label: "extended push literal variable", opcodes: "E3", implemented: true },
    { id: "extended-push-literal-constant", label: "extended push literal constant", opcodes: "E4", implemented: true },
    { id: "extended-push-temp", label: "extended push temporary", opcodes: "E5", implemented: true },
    { id: "reserved-extended-E6", label: "reserved extended opcode", opcodes: "E6", implemented: false },
    { id: "extended-array", label: "extended push/pop array", opcodes: "E7", implemented: true },
    { id: "extended-push-integer", label: "extended push integer", opcodes: "E8", implemented: true },
    { id: "extended-push-character", label: "extended push character", opcodes: "E9", implemented: true },
    { id: "extended-send", label: "extended literal send", opcodes: "EA", implemented: true },
    { id: "extended-super-send", label: "extended super/direct-super send", opcodes: "EB", implemented: true },
    { id: "reserved-extended-EC", label: "reserved extended opcode", opcodes: "EC", implemented: false },
    { id: "extended-jump", label: "extended unconditional jump", opcodes: "ED", implemented: true },
    { id: "extended-jump-if-true", label: "extended jump if true", opcodes: "EE", implemented: true },
    { id: "extended-jump-if-false", label: "extended jump if false", opcodes: "EF", implemented: true },
    { id: "extended-pop-receiver-variable", label: "extended pop into receiver variable", opcodes: "F0", implemented: true },
    { id: "extended-pop-literal-variable", label: "extended pop into literal variable", opcodes: "F1", implemented: true },
    { id: "extended-pop-temp", label: "extended pop into temporary", opcodes: "F2", implemented: true },
    { id: "extended-store-receiver-variable", label: "extended store into receiver variable", opcodes: "F3", implemented: true },
    { id: "extended-store-literal-variable", label: "extended store into literal variable", opcodes: "F4", implemented: true },
    { id: "extended-store-temp", label: "extended store into temporary", opcodes: "F5", implemented: true },
    { id: "reserved-extended-F6-F7", label: "reserved extended opcodes", opcodes: "F6-F7", implemented: false },
    { id: "extended-call-primitive", label: "extended call primitive", opcodes: "F8", implemented: true },
    { id: "extended-full-closure", label: "extended full closure", opcodes: "F9", implemented: true },
    { id: "extended-closure-copy", label: "extended closure copy", opcodes: "FA", implemented: true },
    { id: "extended-remote-temp-push", label: "extended push remote temp", opcodes: "FB", implemented: true },
    { id: "extended-remote-temp-store", label: "extended store remote temp", opcodes: "FC", implemented: true },
    { id: "extended-remote-temp-pop", label: "extended pop remote temp", opcodes: "FD", implemented: true },
    { id: "reserved-extended-FE-FF", label: "reserved extended opcodes", opcodes: "FE-FF", implemented: false },
];

const FAMILY_BY_ID = Object.fromEntries(BYTECODE_FAMILIES.map(family => [family.id, family]));


const FAMILY_CLASSIFICATIONS = {
    "quick-nop": {
        status: "compiler-unemitted-valid",
        rationale: "Implemented by the Sista decoder as a no-op, but not emitted by the current Pharo 14 Opal compiler in the committed corpus or candidate native probes. It remains useful as a synthetic decoder/JIT guard.",
    },
    "extended-push-integer": {
        status: "compiler-unemitted-valid",
        rationale: "Implemented for the Sista extended immediate-integer form. Current Pharo 14 compiler output uses quick 0/1 bytecodes or literal constants for integer constants in the tested corpus instead of emitting E8.",
    },
    "extended-push-character": {
        status: "compiler-unemitted-valid",
        rationale: "Implemented for the Sista extended immediate-character form. Current Pharo 14 compiler output uses literal constants or sends such as Character value: in the tested corpus instead of emitting E9.",
    },
    "extended-closure-copy": {
        status: "compiler-unemitted-valid",
        rationale: "Implemented for the legacy Sista closure-copy form. Current Pharo 14 compiler output uses full closures, so FA is covered synthetically rather than by native-generated fixtures.",
    },
};

function classificationForFamily(stat) {
    if (!stat.implemented) {
        return {
            status: "reserved-unimplemented",
            rationale: "Reserved or currently unimplemented Sista opcode slot; not expected from native Pharo compiler output and not part of the implemented-family coverage target.",
        };
    }
    if (stat.native > 0) {
        return {
            status: "native-generated",
            rationale: "Emitted by native Pharo fixture generation and also checked against SqueakJS decoding.",
        };
    }
    if (stat.synthetic > 0 && FAMILY_CLASSIFICATIONS[stat.id]) return FAMILY_CLASSIFICATIONS[stat.id];
    if (stat.synthetic > 0) {
        return {
            status: "synthetic-covered",
            rationale: "Covered synthetically, but not yet classified against native compiler output.",
        };
    }
    return {
        status: "uncovered-implemented",
        rationale: "Implemented Sista family with no native or synthetic coverage. This should be treated as a test gap.",
    };
}


const SYNTHETIC_DECODER_CASES = [
    { name: "quick push receiver variable", bytes: [0x0F], expected: ["pushReceiverVariable", 15] },
    { name: "quick push literal variable", bytes: [0x1F], expected: ["pushLiteralVariable", "lit15"] },
    { name: "quick push literal constant", bytes: [0x3F], expected: ["pushConstant", "lit31"] },
    { name: "quick push temp", bytes: [0x4B], expected: ["pushTemporaryVariable", 11] },
    { name: "quick push receiver", bytes: [0x4C], expected: ["pushReceiver"] },
    { name: "quick push true", bytes: [0x4D], expected: ["pushConstant", "true"] },
    { name: "quick push false", bytes: [0x4E], expected: ["pushConstant", "false"] },
    { name: "quick push nil", bytes: [0x4F], expected: ["pushConstant", "nil"] },
    { name: "quick push zero", bytes: [0x50], expected: ["pushConstant", 0] },
    { name: "quick push one", bytes: [0x51], expected: ["pushConstant", 1] },
    { name: "quick push active context", bytes: [0x52], expected: ["pushActiveContext"] },
    { name: "quick dup", bytes: [0x53], expected: ["doDup"] },
    { name: "quick return receiver", bytes: [0x58], expected: ["methodReturnReceiver"] },
    { name: "quick return true", bytes: [0x59], expected: ["methodReturnConstant", "true"] },
    { name: "quick return false", bytes: [0x5A], expected: ["methodReturnConstant", "false"] },
    { name: "quick return nil", bytes: [0x5B], expected: ["methodReturnConstant", "nil"] },
    { name: "quick return top", bytes: [0x5C], expected: ["methodReturnTop"] },
    { name: "quick block return nil", bytes: [0x5D], expected: ["blockReturnConstant", "nil"] },
    { name: "quick block return top", bytes: [0x5E], expected: ["blockReturnTop"] },
    { name: "quick nop", bytes: [0x5F], expected: ["nop"] },
    { name: "quick special send 0", bytes: [0x60], expected: ["send", "special0", 0, false] },
    { name: "quick special send 31", bytes: [0x7F], expected: ["send", "special31", 1, false] },
    { name: "quick 0-arg literal send", bytes: [0x80], expected: ["send", "lit0", 0, false] },
    { name: "quick 1-arg literal send", bytes: [0x90], expected: ["send", "lit0", 1, false] },
    { name: "quick 2-arg literal send", bytes: [0xA0], expected: ["send", "lit0", 2, false] },
    { name: "quick jump", bytes: [0xB3], expected: ["jump", 4] },
    { name: "quick jump true", bytes: [0xBA], expected: ["jumpIf", true, 3] },
    { name: "quick jump false", bytes: [0xC5], expected: ["jumpIf", false, 6] },
    { name: "quick pop receiver variable", bytes: [0xCF], expected: ["popIntoReceiverVariable", 7] },
    { name: "quick pop temp", bytes: [0xD7], expected: ["popIntoTemporaryVariable", 7] },
    { name: "quick pop", bytes: [0xD8], expected: ["doPop"] },
    { name: "extended push receiver variable", bytes: [0xE0, 0x01, 0xE2, 0x05], expected: ["pushReceiverVariable", 261] },
    { name: "extended push literal variable", bytes: [0xE0, 0x01, 0xE3, 0x05], expected: ["pushLiteralVariable", "lit261"] },
    { name: "extended push literal constant", bytes: [0xE0, 0x01, 0xE4, 0x05], expected: ["pushConstant", "lit261"] },
    { name: "extended push temp", bytes: [0xE5, 0x12], expected: ["pushTemporaryVariable", 18] },
    { name: "extended push array", bytes: [0xE7, 0x03], expected: ["pushNewArray", 3] },
    { name: "extended pop array", bytes: [0xE7, 0x82], expected: ["popIntoNewArray", 2] },
    { name: "extended push integer", bytes: [0xE1, 0x01, 0xE8, 0x05], expected: ["pushConstant", 261] },
    { name: "extended push character", bytes: [0xE1, 0x01, 0xE9, 0x41], expected: ["pushConstant", "$Ł (321)"] },
    { name: "extended send", bytes: [0xE0, 0x01, 0xE1, 0x02, 0xEA, 0x1A], expected: ["send", "sel35", 18, false] },
    { name: "extended super send", bytes: [0xEB, 0x1A], expected: ["send", "sel3", 2, true] },
    { name: "extended directed super send", bytes: [0xE1, 0x40, 0xEB, 0x1A], expected: ["sendSuperDirected", "sel3"] },
    { name: "extended jump", bytes: [0xE1, 0xFF, 0xED, 0xF0], expected: ["jump", -16] },
    { name: "extended jump true", bytes: [0xEE, 0x07], expected: ["jumpIf", true, 7] },
    { name: "extended jump false", bytes: [0xEF, 0x07], expected: ["jumpIf", false, 7] },
    { name: "extended pop receiver variable", bytes: [0xE0, 0x01, 0xF0, 0x05], expected: ["popIntoReceiverVariable", 261] },
    { name: "extended pop literal variable", bytes: [0xE0, 0x01, 0xF1, 0x05], expected: ["popIntoLiteralVariable", "lit261"] },
    { name: "extended pop temp", bytes: [0xF2, 0x12], expected: ["popIntoTemporaryVariable", 18] },
    { name: "extended store receiver variable", bytes: [0xE0, 0x01, 0xF3, 0x05], expected: ["storeIntoReceiverVariable", 261] },
    { name: "extended store literal variable", bytes: [0xE0, 0x01, 0xF4, 0x05], expected: ["storeIntoLiteralVariable", "lit261"] },
    { name: "extended store temp", bytes: [0xF5, 0x12], expected: ["storeIntoTemporaryVariable", 18] },
    { name: "extended call primitive", bytes: [0xF8, 0x34, 0x12], expected: ["callPrimitive", 0x1234] },
    { name: "extended full closure", bytes: [0xE0, 0x01, 0xF9, 0x05, 0x02], expected: ["pushFullClosure", 261, 2, 2] },
    { name: "extended closure copy", bytes: [0xE0, 0x21, 0xE1, 0x01, 0xFA, 0x2B, 0x04], expected: ["pushClosureCopy", 21, 11, 260] },
    { name: "extended push remote temp", bytes: [0xFB, 0x02, 0x03], expected: ["pushRemoteTemp", 2, 3] },
    { name: "extended store remote temp", bytes: [0xFC, 0x02, 0x03], expected: ["storeIntoRemoteTemp", 2, 3] },
    { name: "extended pop remote temp", bytes: [0xFD, 0x02, 0x03], expected: ["popIntoRemoteTemp", 2, 3] },
];

function familyForOpcode(opcode) {
    if (opcode >= 0x00 && opcode <= 0x0F) return "quick-push-receiver-variable";
    if (opcode >= 0x10 && opcode <= 0x1F) return "quick-push-literal-variable";
    if (opcode >= 0x20 && opcode <= 0x3F) return "quick-push-literal-constant";
    if (opcode >= 0x40 && opcode <= 0x4B) return "quick-push-temp";
    if (opcode === 0x4C) return "quick-push-receiver";
    if (opcode >= 0x4D && opcode <= 0x4F) return "quick-push-true-false-nil";
    if (opcode >= 0x50 && opcode <= 0x51) return "quick-push-smallint";
    if (opcode === 0x52) return "quick-push-active-context";
    if (opcode === 0x53) return "quick-dup";
    if (opcode >= 0x54 && opcode <= 0x57) return "reserved-quick-54-57";
    if (opcode >= 0x58 && opcode <= 0x5E) return "quick-return";
    if (opcode === 0x5F) return "quick-nop";
    if (opcode >= 0x60 && opcode <= 0x7F) return "quick-special-send";
    if (opcode >= 0x80 && opcode <= 0x8F) return "quick-send-0-arg";
    if (opcode >= 0x90 && opcode <= 0x9F) return "quick-send-1-arg";
    if (opcode >= 0xA0 && opcode <= 0xAF) return "quick-send-2-arg";
    if (opcode >= 0xB0 && opcode <= 0xB7) return "quick-jump";
    if (opcode >= 0xB8 && opcode <= 0xBF) return "quick-jump-if-true";
    if (opcode >= 0xC0 && opcode <= 0xC7) return "quick-jump-if-false";
    if (opcode >= 0xC8 && opcode <= 0xCF) return "quick-pop-receiver-variable";
    if (opcode >= 0xD0 && opcode <= 0xD7) return "quick-pop-temp";
    if (opcode === 0xD8) return "quick-pop";
    if (opcode >= 0xD9 && opcode <= 0xDF) return "reserved-quick-D9-DF";
    if (opcode === 0xE0) return "extension-a";
    if (opcode === 0xE1) return "extension-b";
    if (opcode === 0xE2) return "extended-push-receiver-variable";
    if (opcode === 0xE3) return "extended-push-literal-variable";
    if (opcode === 0xE4) return "extended-push-literal-constant";
    if (opcode === 0xE5) return "extended-push-temp";
    if (opcode === 0xE6) return "reserved-extended-E6";
    if (opcode === 0xE7) return "extended-array";
    if (opcode === 0xE8) return "extended-push-integer";
    if (opcode === 0xE9) return "extended-push-character";
    if (opcode === 0xEA) return "extended-send";
    if (opcode === 0xEB) return "extended-super-send";
    if (opcode === 0xEC) return "reserved-extended-EC";
    if (opcode === 0xED) return "extended-jump";
    if (opcode === 0xEE) return "extended-jump-if-true";
    if (opcode === 0xEF) return "extended-jump-if-false";
    if (opcode === 0xF0) return "extended-pop-receiver-variable";
    if (opcode === 0xF1) return "extended-pop-literal-variable";
    if (opcode === 0xF2) return "extended-pop-temp";
    if (opcode === 0xF3) return "extended-store-receiver-variable";
    if (opcode === 0xF4) return "extended-store-literal-variable";
    if (opcode === 0xF5) return "extended-store-temp";
    if (opcode >= 0xF6 && opcode <= 0xF7) return "reserved-extended-F6-F7";
    if (opcode === 0xF8) return "extended-call-primitive";
    if (opcode === 0xF9) return "extended-full-closure";
    if (opcode === 0xFA) return "extended-closure-copy";
    if (opcode === 0xFB) return "extended-remote-temp-push";
    if (opcode === 0xFC) return "extended-remote-temp-store";
    if (opcode === 0xFD) return "extended-remote-temp-pop";
    if (opcode >= 0xFE && opcode <= 0xFF) return "reserved-extended-FE-FF";
    return "unknown";
}

function familiesForInstruction(bytes) {
    if (!Array.isArray(bytes) || bytes.length === 0) return [];
    const families = new Set();
    let pc = 0;
    while (pc + 1 < bytes.length && (bytes[pc] === 0xE0 || bytes[pc] === 0xE1)) {
        families.add(familyForOpcode(bytes[pc]));
        pc += 2;
    }
    families.add(familyForOpcode(bytes[pc]));
    return Array.from(families).filter(id => id && id !== "unknown");
}

function walkNativeMethods(methodRecord, visitor, pathName) {
    pathName = pathName || "method";
    visitor(methodRecord, pathName);
    for (let i = 0; i < (methodRecord.literals || []).length; i++) {
        const literal = methodRecord.literals[i];
        if (literal && literal.compiledBlock) walkNativeMethods(literal.compiledBlock, visitor, pathName + ".literal" + i);
    }
}

function newFamilyStats() {
    return Object.fromEntries(BYTECODE_FAMILIES.map(family => [family.id, {
        id: family.id,
        label: family.label,
        opcodes: family.opcodes,
        implemented: !!family.implemented,
        native: 0,
        synthetic: 0,
    }]));
}

function addInstruction(stats, bytes, source) {
    for (const id of familiesForInstruction(bytes)) {
        if (!stats[id]) continue;
        stats[id][source]++;
    }
}

function collectNative(stats, fixturePayload) {
    let fixtureCount = 0;
    let methodCount = 0;
    let instructionCount = 0;
    let byteCount = 0;
    for (const fixture of fixturePayload.fixtures || []) {
        fixtureCount++;
        walkNativeMethods(fixture.compiledMethod, method => {
            methodCount++;
            byteCount += (method.bytes || []).length;
            for (const instruction of method.symbolicTrace || []) {
                instructionCount++;
                addInstruction(stats, instruction.bytes || [], "native");
            }
        });
    }
    return { fixtureCount, methodCount, instructionCount, byteCount };
}

function collectSynthetic(stats, cases) {
    for (const entry of cases || SYNTHETIC_DECODER_CASES) {
        addInstruction(stats, entry.bytes || [], "synthetic");
    }
    return { caseCount: (cases || SYNTHETIC_DECODER_CASES).length };
}

function bucketForFamily(stat) {
    if (stat.native > 0 && stat.synthetic > 0) return "both";
    if (stat.native > 0) return "nativeOnly";
    if (stat.synthetic > 0) return "syntheticOnly";
    return "neither";
}

function buildCoverageReport(fixturePayload, options) {
    options = options || {};
    const statsByFamily = newFamilyStats();
    const nativeTotals = collectNative(statsByFamily, fixturePayload || { fixtures: [] });
    const syntheticTotals = collectSynthetic(statsByFamily, options.syntheticCases || SYNTHETIC_DECODER_CASES);
    const families = BYTECODE_FAMILIES.map(family => {
        const stat = statsByFamily[family.id];
        const classification = classificationForFamily(stat);
        return Object.assign({}, stat, {
            bucket: bucketForFamily(stat),
            classification: classification.status,
            classificationRationale: classification.rationale,
        });
    });
    const buckets = { both: [], nativeOnly: [], syntheticOnly: [], neither: [] };
    for (const family of families) buckets[family.bucket].push(family.id);
    const implementedFamilies = families.filter(family => family.implemented);
    const implementedCovered = implementedFamilies.filter(family => family.native > 0 || family.synthetic > 0);
    return {
        reportFormat: 2,
        generatedFromFixtureFormat: fixturePayload && fixturePayload.fixtureFormat || null,
        totals: {
            nativeFixtures: nativeTotals.fixtureCount,
            nativeMethods: nativeTotals.methodCount,
            nativeInstructions: nativeTotals.instructionCount,
            nativeBytecodeBytes: nativeTotals.byteCount,
            syntheticCases: syntheticTotals.caseCount,
            families: families.length,
            implementedFamilies: implementedFamilies.length,
            implementedFamiliesCovered: implementedCovered.length,
            implementedFamilyCoveragePercent: implementedFamilies.length ? Number((implementedCovered.length / implementedFamilies.length * 100).toFixed(1)) : 0,
            nativeGeneratedImplementedFamilies: implementedFamilies.filter(family => family.native > 0).length,
            syntheticOnlyImplementedFamilies: implementedFamilies.filter(family => family.native === 0 && family.synthetic > 0).length,
            uncoveredImplementedFamilies: implementedFamilies.filter(family => family.native === 0 && family.synthetic === 0).length,
        },
        buckets,
        families,
    };
}

function loadNativeFixturePayload(rootDirOrFile) {
    const file = fs.statSync(rootDirOrFile).isDirectory()
        ? path.join(rootDirOrFile, "tests", "pharo", "fixtures", "sista-native-fixtures.json")
        : rootDirOrFile;
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function formatMarkdown(report) {
    const lines = [];
    lines.push("# Sista bytecode coverage report");
    lines.push("");
    lines.push("## Totals");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|---|---:|");
    lines.push(`| native fixtures | ${report.totals.nativeFixtures} |`);
    lines.push(`| native methods/blocks | ${report.totals.nativeMethods} |`);
    lines.push(`| native symbolic instructions | ${report.totals.nativeInstructions} |`);
    lines.push(`| native bytecode bytes | ${report.totals.nativeBytecodeBytes} |`);
    lines.push(`| synthetic decoder cases | ${report.totals.syntheticCases} |`);
    lines.push(`| implemented family coverage | ${report.totals.implementedFamiliesCovered}/${report.totals.implementedFamilies} (${report.totals.implementedFamilyCoveragePercent}%) |`);
    lines.push("");
    lines.push("## Family matrix");
    lines.push("");
    lines.push("| Bucket | Opcode family | Opcodes | Native hits | Synthetic hits | Classification | Implemented |");
    lines.push("|---|---|---:|---:|---:|---|---|");
    for (const family of report.families) {
        lines.push(`| ${family.bucket} | ${family.label} | ${family.opcodes} | ${family.native} | ${family.synthetic} | ${family.classification} | ${family.implemented ? "yes" : "reserved"} |`);
    }
    lines.push("");
    lines.push("## Buckets");
    lines.push("");
    for (const bucket of ["both", "nativeOnly", "syntheticOnly", "neither"]) {
        lines.push(`- ${bucket}: ${report.buckets[bucket].length ? report.buckets[bucket].join(", ") : "none"}`);
    }
    lines.push("");
    return lines.join("\n");
}

module.exports = {
    BYTECODE_FAMILIES,
    FAMILY_BY_ID,
    SYNTHETIC_DECODER_CASES,
    FAMILY_CLASSIFICATIONS,
    classificationForFamily,
    familyForOpcode,
    familiesForInstruction,
    buildCoverageReport,
    loadNativeFixturePayload,
    formatMarkdown,
};
