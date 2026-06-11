"use strict";

const fs = require("fs");
const path = require("path");
const {
    makePrimitive,
    stringFromObject,
} = require("./support/fake-primitives");

function runNamedPrimitive(moduleName, primitiveName, stack, argCount) {
    const prim = makePrimitive(stack || [null]);
    const ok = prim.namedPrimitive(moduleName, primitiveName, argCount || 0);
    return { ok, prim, result: prim.vm.lastPushed };
}

exports.run = async function(t, context) {
    await t.test("empty-module primitiveGetCurrentWorkingDirectory returns the Node cwd", async t => {
        const oldCwd = process.cwd();
        process.chdir(context.rootDir);
        try {
            const r = runNamedPrimitive("", "primitiveGetCurrentWorkingDirectory", [null], 0);
            t.ok(r.ok, "primitive succeeds");
            t.equal(stringFromObject(r.result), context.rootDir, "current working directory is reported exactly");
        } finally {
            process.chdir(oldCwd);
        }
    });

    await t.test("FileAttributesPlugin primitiveFileMasks returns Pharo's POSIX mode-mask table", async t => {
        const r = runNamedPrimitive("FileAttributesPlugin", "primitiveFileMasks", [null], 0);
        t.ok(r.ok, "primitive succeeds");
        const values = r.result.pointers.map(each => typeof each === "number" ? each : null);
        t.equal(values.join(","), "61440,49152,40960,32768,24576,16384,8192,4096", "mode masks match native Pharo order");
    });


    await t.test("FileAttributesPlugin primitiveFileExists checks Node paths", async t => {
        const existing = runNamedPrimitive("FileAttributesPlugin", "primitiveFileExists", [null, (() => { const prim = makePrimitive(); return prim.makeStString(context.rootDir); })()], 1);
        t.ok(existing.ok, "primitive succeeds for existing path");
        t.ok(existing.result && existing.result.isTrue, "existing path answers true");

        const missingPrim = makePrimitive();
        const missing = runNamedPrimitive("FileAttributesPlugin", "primitiveFileExists", [null, missingPrim.makeStString(path.join(context.rootDir, "definitely-missing-squeakjs-path"))], 1);
        t.ok(missing.ok, "primitive succeeds for missing path");
        t.ok(missing.result && missing.result.isFalse, "missing path answers false");
    });


    await t.test("FileAttributesPlugin primitiveFileAttribute reports POSIX mode and access booleans", async t => {
        const prim = makePrimitive();
        let r = runNamedPrimitive("FileAttributesPlugin", "primitiveFileAttribute", [null, prim.makeStString(context.rootDir), 2], 2);
        t.ok(r.ok, "mode attribute primitive succeeds");
        t.ok(typeof r.result === "number", "mode is returned as an integer for normal POSIX modes");
        t.ok((r.result & 16384) !== 0, "mode identifies the test root as a directory");

        const prim2 = makePrimitive();
        r = runNamedPrimitive("FileAttributesPlugin", "primitiveFileAttribute", [null, prim2.makeStString(context.rootDir), 13], 2);
        t.ok(r.ok, "read-access attribute primitive succeeds");
        t.ok(r.result && r.result.isTrue, "test root is readable");
    });


    await t.test("FileAttributesPlugin gives conservative non-existing-path attributes for startup probes", async t => {
        const prim = makePrimitive();
        const missingPath = path.join(context.rootDir, "definitely-missing-squeakjs-attributes-path");

        let r = runNamedPrimitive("FileAttributesPlugin", "primitiveFileAttribute", [null, prim.makeStString(missingPath), 2], 2);
        t.ok(r.ok, "missing-path mode attribute primitive succeeds");
        t.equal(r.result, 0, "missing-path mode is conservatively zero, so isDirectory answers false");

        const prim2 = makePrimitive();
        r = runNamedPrimitive("FileAttributesPlugin", "primitiveFileAttribute", [null, prim2.makeStString(missingPath), 13], 2);
        t.ok(r.ok, "missing-path read-access attribute primitive succeeds");
        t.ok(r.result && r.result.isFalse, "missing-path read access answers false");

        const prim3 = makePrimitive();
        r = runNamedPrimitive("FileAttributesPlugin", "primitiveFileAttribute", [null, prim3.makeStString(missingPath), 16], 2);
        t.ok(r.ok, "missing-path symlink attribute primitive succeeds");
        t.ok(r.result && r.result.isFalse, "missing-path symlink attribute answers false");
    });


    await t.test("FileAttributesPlugin directory stream primitives enumerate Node directories", async t => {
        const prim = makePrimitive();
        let r = runNamedPrimitive("FileAttributesPlugin", "primitiveOpendir", [null, prim.makeStString(context.rootDir)], 1);
        t.ok(r.ok, "opendir primitive succeeds");
        t.ok(r.result && r.result.pointers && r.result.pointers.length === 3, "opendir returns entry/attributes/handle triple");
        const handle = r.result.pointers[2];
        t.ok(handle && handle.jsData, "directory handle keeps JS stream state");

        r = runNamedPrimitive("FileAttributesPlugin", "primitiveReaddir", [null, handle], 1);
        t.ok(r.ok, "readdir primitive succeeds");
        t.ok((r.result && r.result.isNil) || (r.result && r.result.pointers && r.result.pointers.length === 3), "readdir returns nil or another triple");

        r = runNamedPrimitive("FileAttributesPlugin", "primitiveRewinddir", [null, handle], 1);
        t.ok(r.ok, "rewinddir primitive succeeds");
        t.ok(r.result === handle, "rewinddir returns the same handle");

        r = runNamedPrimitive("FileAttributesPlugin", "primitiveClosedir", [null, handle], 1);
        t.ok(r.ok, "closedir primitive succeeds");
        t.ok(!handle.jsData, "closedir releases JS stream state");
    });


    await t.test("FileAttributesPlugin browser fallback uses the SqueakJS virtual filesystem", async t => {
        const oldForce = Squeak.forceBrowserFileAttributes;
        const oldSplit = Squeak.splitFilePath;
        const oldDirList = Squeak.dirList;
        const oldTotalSeconds = Squeak.totalSeconds;
        try {
            Squeak.forceBrowserFileAttributes = true;
            Squeak.totalSeconds = () => 4000;
            Squeak.splitFilePath = function(filepath) {
                if (filepath[0] !== "/") filepath = "/" + filepath;
                filepath = filepath.replace(/\/\//g, "/");
                const match = filepath.match(/(.*)\/(.*)/);
                const dirname = match[1] ? match[1] : "/";
                const basename = match[2] ? match[2] : null;
                return { fullname: filepath, dirname, basename };
            };
            Squeak.dirList = function(dirpath) {
                const full = Squeak.splitFilePath(dirpath).fullname;
                if (full === "/") return { pharo14: ["pharo14", 1000, 2000, true, 0] };
                if (full === "/pharo14") return {
                    "image.image": ["image.image", 1001, 2001, false, 1234],
                    prefs: ["prefs", 1002, 2002, true, 0],
                };
                if (full === "/pharo14/prefs") return {};
                return null;
            };

            const prim = makePrimitive();
            let r = runNamedPrimitive("FileAttributesPlugin", "primitiveFileAttribute", [null, prim.makeStString("/pharo14"), 2], 2);
            t.ok(r.ok, "browser mode attribute primitive succeeds for virtual directory");
            t.ok((r.result & 16384) !== 0, "virtual directory mode has S_IFDIR");

            const prim2 = makePrimitive();
            r = runNamedPrimitive("FileAttributesPlugin", "primitiveFileAttribute", [null, prim2.makeStString("/pharo14/image.image"), 8], 2);
            t.ok(r.ok, "browser size attribute primitive succeeds for virtual file");
            t.equal(r.result, 1234, "virtual file size comes from SqueakJS directory entry");

            const prim3 = makePrimitive();
            r = runNamedPrimitive("FileAttributesPlugin", "primitiveFileExists", [null, prim3.makeStString("/pharo14/prefs")], 1);
            t.ok(r.ok, "browser file-exists primitive succeeds for virtual directory");
            t.ok(r.result && r.result.isTrue, "virtual directory exists");

            const prim4 = makePrimitive();
            r = runNamedPrimitive("FileAttributesPlugin", "primitiveOpendir", [null, prim4.makeStString("/pharo14")], 1);
            t.ok(r.ok, "browser opendir primitive succeeds for virtual directory");
            t.ok(r.result && r.result.pointers && r.result.pointers.length === 3, "opendir returns entry/attributes/handle triple");
        } finally {
            Squeak.forceBrowserFileAttributes = oldForce;
            Squeak.splitFilePath = oldSplit;
            Squeak.dirList = oldDirList;
            Squeak.totalSeconds = oldTotalSeconds;
        }
    });



    await t.test("FilePlugin primitiveFileSize reports Node file-handle size", async t => {
        const tmpPath = path.join(context.rootDir, ".squeakjs-file-size-test.tmp");
        fs.writeFileSync(tmpPath, Buffer.from("abcdef"));
        const prim = makePrimitive();
        const fd = fs.openSync(tmpPath, "r");
        try {
            const handle = prim.makeFileHandle(tmpPath, fd, false);
            const r = runNamedPrimitive("FilePlugin", "primitiveFileSize", [null, handle], 1);
            t.ok(r.ok, "file-size primitive succeeds for SqueakJS Node handles");
            t.equal(r.result, 6, "file-size primitive answers the actual byte size");
        } finally {
            try { fs.closeSync(fd); } catch (_e) {}
            try { fs.unlinkSync(tmpPath); } catch (_e) {}
        }
    });

    await t.test("FilePlugin primitiveFileSize quietly fails foreign byte handles", async t => {
        const prim = makePrimitive();
        const foreignHandle = prim.makeStString("foreign-file-handle-without-node-fd");
        const oldError = console.error;
        const messages = [];
        console.error = function() { messages.push(Array.from(arguments).join(" ")); };
        try {
            const r = runNamedPrimitive("FilePlugin", "primitiveFileSize", [null, foreignHandle], 1);
            t.ok(!r.ok, "foreign handle fails the primitive so the image fallback can run");
            t.equal(messages.join("\n"), "", "foreign handles do not produce Node fstat noise");
        } finally {
            console.error = oldError;
        }
    });

    await t.test("FilePlugin primitiveFileDescriptorType classifies stdio file descriptors without failing", async t => {
        [0, 1, 2].forEach(fd => {
            const r = runNamedPrimitive("FilePlugin", "primitiveFileDescriptorType", [null, fd], 1);
            t.ok(r.ok, "primitive succeeds for fd " + fd);
            t.ok([-1, 1, 2, 3, 4].includes(r.result), "descriptor type is in Pharo's documented result range for fd " + fd);
        });
    });

    await t.test("FilePlugin primitiveConnectToFileDescriptor creates a SqueakJS file handle", async t => {
        const prim = makePrimitive([null]);
        prim.vm.stack = [null, 1, prim.vm.trueObj];
        prim.vm.sp = prim.vm.stack.length - 1;
        const ok = prim.namedPrimitive("FilePlugin", "primitiveConnectToFileDescriptor", 2);
        const result = prim.vm.lastPushed;
        t.ok(ok, "primitive succeeds for stdout");
        t.equal(result.fd, 1, "handle keeps the fd");
        t.equal(result.fileWrite, true, "handle records writability");
        t.match(result.bytesAsString(), /^squeakjs:\/dev\/fd\/1$/, "handle string describes the descriptor");
    });
};
