"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const coverage = require("../../tools/sista-bytecode-coverage-lib");

exports.run = async function(t, context) {
    const fixturePayload = coverage.loadNativeFixturePayload(context.rootDir);
    const committedReport = JSON.parse(fs.readFileSync(path.join(context.rootDir, "tests", "pharo", "fixtures", "sista-bytecode-coverage.json"), "utf8"));

    await t.test("Sista bytecode coverage report is reproducible from committed native and synthetic fixtures", async t => {
        const report = coverage.buildCoverageReport(fixturePayload);
        t.equal(JSON.stringify(report), JSON.stringify(committedReport), "committed coverage report matches freshly computed report");
        t.equal(report.reportFormat, 2, "coverage report format is current");
        t.equal(report.generatedFromFixtureFormat, 4, "coverage report is generated from current native fixture format");
    });

    await t.test("Sista bytecode coverage report classifies native, synthetic, both, and missing families", async t => {
        const report = committedReport;
        t.ok(report.totals.nativeInstructions >= 1600, "native symbolic corpus remains substantial");
        t.ok(report.totals.syntheticCases >= 50, "synthetic decoder matrix remains substantial");
        t.equal(report.totals.implementedFamilyCoveragePercent, 100, "native plus synthetic fixtures cover every implemented Sista family");
        t.equal(report.totals.nativeGeneratedImplementedFamilies, 43, "all but four implemented Sista families are covered by native Pharo-generated fixtures");
        t.equal(report.totals.syntheticOnlyImplementedFamilies, 4, "the four remaining implemented families are deliberately synthetic-only");
        t.equal(report.totals.uncoveredImplementedFamilies, 0, "no implemented Sista family is uncovered");
        t.ok(report.buckets.both.includes("extended-super-send"), "directed/super send family is covered by both native and synthetic fixtures");
        t.ok(report.buckets.both.includes("extended-full-closure"), "full-closure family is covered by both native and synthetic fixtures");
        t.ok(report.buckets.both.includes("quick-push-receiver-variable"), "receiver-variable access moved from synthetic-only to native-plus-synthetic coverage");
        t.ok(report.buckets.both.includes("extended-store-literal-variable"), "literal-variable store moved from synthetic-only to native-plus-synthetic coverage");
        t.equal(JSON.stringify(report.buckets.syntheticOnly), JSON.stringify([
            "quick-nop",
            "extended-push-integer",
            "extended-push-character",
            "extended-closure-copy",
        ]), "synthetic-only bucket is limited to current compiler-unemitted but implemented forms");
        for (const id of report.buckets.syntheticOnly) {
            const family = report.families.find(family => family.id === id);
            t.equal(family.classification, "compiler-unemitted-valid", id + " is explicitly classified as a valid implemented form not emitted by current native fixtures");
            t.ok(family.classificationRationale.length > 40, id + " records a classification rationale");
        }
        t.ok(report.buckets.neither.includes("reserved-extended-FE-FF"), "neither bucket captures reserved/unimplemented bytecode slots");
        for (const id of report.buckets.neither) {
            const family = report.families.find(family => family.id === id);
            t.equal(family.classification, "reserved-unimplemented", id + " is classified as reserved/unimplemented rather than a coverage gap");
        }
        t.equal(report.buckets.nativeOnly.length, 0, "current synthetic matrix covers all native-emitted implemented families");
    });

    await t.test("Sista bytecode coverage markdown report contains the same core totals", async t => {
        const markdown = coverage.formatMarkdown(committedReport);
        t.match(markdown, /implemented family coverage \| 47\/47 \(100%\)/, "markdown report includes implemented-family coverage total");
        t.match(markdown, /compiler-unemitted-valid/, "markdown report includes the synthetic-only family classification");
        t.match(markdown, /syntheticOnly/, "markdown report includes synthetic-only bucket rows");
        t.match(markdown, /reserved-extended-FE-FF/, "markdown report lists reserved missing bytecode slots");
    });

    await t.test("optional native Pharo candidate probes keep remaining implemented families synthetic-only", async t => {
        const imagePath = process.env.PHARO14_IMAGE || path.join(context.rootDir, "pharo14-metacello.image");
        const nativeVM = process.env.PHARO_NATIVE_VM;
        if (!fs.existsSync(imagePath) || !nativeVM || !fs.existsSync(nativeVM)) {
            return t.skip("native synthetic-only candidate probes", "set PHARO14_IMAGE and PHARO_NATIVE_VM to run candidate compiler-emission probes");
        }
        const candidateCorpus = [
            { name: "integer constant 2", expression: "2" },
            { name: "integer constant 42", expression: "42" },
            { name: "integer constant 255", expression: "255" },
            { name: "integer constant 256", expression: "256" },
            { name: "integer constant negative", expression: "-1" },
            { name: "integer constant large positive", expression: "123456" },
            { name: "character literal A", expression: "$A" },
            { name: "character value A", expression: "Character value: 65" },
            { name: "simple nested block", expression: "[ 42 ] value" },
            { name: "argument nested block", expression: "[ :x | x + 1 ] value: 2" },
        ];
        const tmpCorpus = path.join(os.tmpdir(), "squeakjs-sista-candidate-corpus-" + process.pid + ".json");
        const tmpFixtures = path.join(os.tmpdir(), "squeakjs-sista-candidate-fixtures-" + process.pid + ".json");
        fs.writeFileSync(tmpCorpus, JSON.stringify(candidateCorpus, null, 2) + "\n");
        const run = spawnSync(process.execPath, [
            path.join(context.rootDir, "tools", "generate-native-sista-fixtures.js"),
            "--vm", nativeVM,
            "--image", imagePath,
            "--corpus", tmpCorpus,
            "--out", tmpFixtures,
        ], {
            cwd: context.rootDir,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 45000,
            killSignal: "SIGKILL",
        });
        try {
            t.equal(run.status, 0, "candidate native fixture generation exits successfully: " + (run.stdout || run.stderr));
            const candidatePayload = JSON.parse(fs.readFileSync(tmpFixtures, "utf8"));
            const candidateReport = coverage.buildCoverageReport(candidatePayload);
            for (const id of ["quick-nop", "extended-push-integer", "extended-push-character", "extended-closure-copy"]) {
                const family = candidateReport.families.find(family => family.id === id);
                t.equal(family.native, 0, id + " is not emitted by the native candidate corpus");
                t.equal(family.classification, "compiler-unemitted-valid", id + " keeps its compiler-unemitted classification in the candidate probe");
            }
        } finally {
            try { fs.unlinkSync(tmpCorpus); } catch (_err) {}
            try { fs.unlinkSync(tmpFixtures); } catch (_err) {}
        }
    });

};
