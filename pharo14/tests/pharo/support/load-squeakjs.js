"use strict";

const path = require("path");

module.exports = function loadSqueakJS(rootDir) {
    if (global.Squeak && global.Squeak.Primitives) return global.Squeak;
    global.Squeak = global.Squeak || {};
    Object.assign(global, {
        self: new Proxy({}, {
            get: function(_obj, prop) { return global[prop]; },
            set: function(_obj, prop, value) { global[prop] = value; return true; }
        })
    });
    Object.assign(self, {
        localStorage: {},
        btoa: function(string) { return Buffer.from(string, "ascii").toString("base64"); },
        atob: function(string) { return Buffer.from(string, "base64").toString("ascii"); },
        sha1: require(path.join(rootDir, "lib", "sha1")),
    });
    [
        "globals.js",
        "vm.js",
        "vm.object.js",
        "vm.object.spur.js",
        "vm.image.js",
        "vm.interpreter.js",
        "vm.interpreter.proxy.js",
        "vm.instruction.stream.js",
        "vm.instruction.stream.sista.js",
        "vm.instruction.printer.js",
        "vm.primitives.js",
        "vm.plugins.js",
        "vm.plugins.ffi.js",
        "vm.plugins.file.node.js",
        "plugins/FileAttributesPlugin.js",
        "plugins/UUIDPlugin.js",
        "plugins/SurfacePlugin.js",
    ].forEach(file => require(path.join(rootDir, file)));
    return global.Squeak;
};
