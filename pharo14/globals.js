"use strict";
/*
 * Copyright (c) 2013-2025 Vanessa Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// Create Squeak VM namespace
if (!self.Squeak) self.Squeak = {};

// Setup a storage for settings
if (!Squeak.Settings) {
    // Try (a working) localStorage and fall back to regular dictionary otherwise
    var settings;
    try {
        // fails in restricted iframe
        settings = self.localStorage;
        settings["squeak-foo:"] = "bar";
        if (settings["squeak-foo:"] !== "bar") throw Error();
        delete settings["squeak-foo:"];
    } catch(e) {
        settings = {};
    }
    Squeak.Settings = settings;
}


// Minimal process-environment emulation shared by browser and Node-like runs.
// Pharo's UnixPlatform/FileSystem startup asks for variables such as HOME and
// XDG_CONFIG_HOME.  Browsers do not have process.env, so SqueakJS supplies a
// conservative Unix-like environment rooted in the virtual filesystem.
if (!Squeak.env) {
    Squeak.env = {
        HOME: "/home/squeak",
        USER: "squeakjs",
        LOGNAME: "squeakjs",
        SHELL: "/bin/sh",
        PWD: "/",
        TMPDIR: "/tmp",
        TEMP: "/tmp",
        TMP: "/tmp",
        XDG_CONFIG_HOME: "/home/squeak/.config",
        XDG_CACHE_HOME: "/home/squeak/.cache",
        XDG_DATA_HOME: "/home/squeak/.local/share",
        XDG_RUNTIME_DIR: "/tmp",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
    };
}

Squeak.getEnv = function(key) {
    if (typeof process !== "undefined" && process.env &&
        Object.prototype.hasOwnProperty.call(process.env, key))
        return process.env[key];
    if (Squeak.env && Object.prototype.hasOwnProperty.call(Squeak.env, key))
        return Squeak.env[key];
    return undefined;
};

Squeak.setEnv = function(key, value, overwrite) {
    if (!overwrite && Squeak.getEnv(key) !== undefined) return true;
    if (typeof process !== "undefined" && process.env) process.env[key] = String(value);
    else Squeak.env[key] = String(value);
    return true;
};

Squeak.unsetEnv = function(key) {
    if (typeof process !== "undefined" && process.env) delete process.env[key];
    if (Squeak.env) delete Squeak.env[key];
    return true;
};

// Virtual Unix shared libraries that browser Pharo must be able to locate
// before the JS FFI emulation receives a symbol lookup.  Pharo's
// FFIUnix64LibraryFinder first probes the filesystem for these names, so the
// browser VFS advertises zero-byte placeholder files at conventional Linux
// locations.  The actual implementations live in Squeak.FFIEmulation.
if (!Squeak.virtualUnixLibraryFiles) {
    Squeak.virtualUnixLibraryFiles = [
        "/lib/x86_64-linux-gnu/libSDL2-2.0.so.0",
        "/lib/x86_64-linux-gnu/libSDL2-2.0.so.0.2.1",
        "/usr/lib/x86_64-linux-gnu/libSDL2-2.0.so.0",
        "/usr/lib/x86_64-linux-gnu/libSDL2-2.0.so.0.2.1",
        "/lib/x86_64-linux-gnu/libfreetype.so.6",
        "/usr/lib/x86_64-linux-gnu/libfreetype.so.6",
        "/lib/x86_64-linux-gnu/libc.so.6",
        "/lib/x86_64-linux-gnu/libm.so.6",
        "/lib/x86_64-linux-gnu/libdl.so.2"
    ];
}

Squeak.installVirtualUnixLibraries = function() {
    if (!Squeak.dirCreate || !Squeak.filePut || !Squeak.splitFilePath) return false;
    Squeak.virtualUnixLibraryFiles.forEach(function(filePath) {
        var path = Squeak.splitFilePath(filePath);
        Squeak.dirCreate(path.dirname, true, "force");
        if (!Squeak.fileExists || !Squeak.fileExists(path.fullname))
            Squeak.filePut(path.fullname, new Uint8Array(0).buffer);
    });
    return true;
};

// Build a VM-compatible argument vector for browser Pharo runs.
// Pharo's command-line startup interprets getSystemAttribute: values as:
//   0 -> VM executable, 1 -> image path, 2... -> image-side arguments.
// A browser Pharo run should be interactive unless explicit image arguments
// were supplied, otherwise Pharo treats the invocation as command-line mode
// and prints command-line options before quitting.
Squeak.normalizeArgvOption = function(value) {
    if (value === undefined || value === null || value === false) return null;
    if (value.constructor === Array) return value.map(function(each) { return String(each); });
    if (typeof value === "string") {
        var trimmed = value.trim();
        if (!trimmed) return [];
        if (trimmed[0] === "[") {
            try {
                var parsed = JSON.parse(trimmed);
                if (parsed && parsed.constructor === Array)
                    return parsed.map(function(each) { return String(each); });
            } catch(e) {
                // fall through to a simple whitespace split below
            }
        }
        return trimmed.split(/\s+/);
    }
    return [String(value)];
};

Squeak.defaultArgvForImage = function(options, imagePath) {
    options = options || {};
    var explicitArgv = Squeak.normalizeArgvOption(options.argv);
    if (explicitArgv) return explicitArgv;

    var imageArgs = Squeak.normalizeArgvOption(
        options.imageArgs !== undefined ? options.imageArgs :
        options.pharoArgs !== undefined ? options.pharoArgs :
        options.args !== undefined ? options.args :
        options.arguments);
    if (!imageArgs) imageArgs = [];

    var shouldDefaultInteractive =
        (options.unix || Squeak.platformName === "unix") &&
        options.interactive !== false &&
        options.headless !== true &&
        imageArgs.length === 0;
    if (shouldDefaultInteractive) imageArgs = ["--interactive"];
    else if (options.interactive === true && imageArgs.indexOf("--interactive") < 0)
        imageArgs = ["--interactive"].concat(imageArgs);

    var vmFile = (Squeak.vmPath || "/") + (Squeak.vmFile || "vm.js");
    return [vmFile, imagePath].concat(imageArgs);
};

if (!Object.extend) {
    // Extend object by adding specified properties
    Object.extend = function(obj /* + more args */ ) {
        // skip arg 0, copy properties of other args to obj
        for (var i = 1; i < arguments.length; i++)
            if (typeof arguments[i] == 'object')
                for (var name in arguments[i])
                    obj[name] = arguments[i][name];
    };
}


// This mimics the Lively Kernel's subclassing scheme.
// When running there, Lively's subclasses and modules are used.
// Modules serve as namespaces in Lively. SqueakJS uses a flat namespace
// named "Squeak", but the code below still supports hierarchical names.
if (!Function.prototype.subclass) {
    // Create subclass using specified class path and given properties
    Function.prototype.subclass = function(classPath /* + more args */ ) {
        // create subclass
        var subclass = function() {
            if (this.initialize) {
                var result = this.initialize.apply(this, arguments);
                if (result !== undefined) return result;
            }
            return this;
        };
        // set up prototype
        var protoclass = function() { };
        protoclass.prototype = this.prototype;
        subclass.prototype = new protoclass();
        // skip arg 0, copy properties of other args to prototype
        for (var i = 1; i < arguments.length; i++)
            Object.extend(subclass.prototype, arguments[i]);
        // add class to namespace
        var path = classPath.split("."),
            className = path.pop(),
            // Walk path starting at the global namespace (self)
            // creating intermediate namespaces if necessary
            namespace = path.reduce(function(namespace, path) {
                if (!namespace[path]) namespace[path] = {};
                return namespace[path];
            }, self);
        namespace[className] = subclass;
        return subclass;
    };

}
