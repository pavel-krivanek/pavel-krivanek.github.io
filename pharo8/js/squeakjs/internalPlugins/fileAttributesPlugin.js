module('users.bert.SqueakJS.fileAttributesPlugin').requires("users.bert.SqueakJS.primitives").toRun(function() {

    "use strict";


var directoriesRegistry = {};
var lastDirIndex = 0;

    Object.extend(Squeak.Primitives.prototype,
    'FileAttributesPlugin', {
        fileAttr_primitiveVersionString: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveVersionString");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveClosedir: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveClosedir");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveFileExists: function(argCount) {
            var pathObj = this.stackNonInteger(0);
            if (!this.success) return false;
            var path = this.filenameFromSqueak(pathObj.bytesAsString());
            if (!this.success) return false;
            var result = Squeak.fileExists(path);
            this.vm.popNandPush(argCount, result ? this.vm.trueObj : this.vm.falseObj);
            return true;
        },
        fileAttr_primitiveChangeMode: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveChangeMode");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveSymlinkChangeOwner: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveSymlinkChangeOwner");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveChangeOwner: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveChangeOwner");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveFileAttribute: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveFileAttribute");
            var attributeNumber = this.stackInteger(0);
            if (!this.success) return false;
            var pathObj = this.stackNonInteger(1);
            if (!this.success) return false;
            var path = this.filenameFromSqueak(pathObj.bytesAsString());
            var exists = Squeak.fileExists(path);
            var entries = Squeak.dirList("/");
            var isDir = exists && (entries != undefined) ? entries[path][3] : false;
            if (path == "/") isDir = true;
            console.log("path " + path)
            console.log("isDir " + isDir)
            var attributes = isDir ? 0x4000 : 0x8000;
            console.log("attributes " + attributes)

            var result = this.nilObj;
            switch(attributeNumber) {
                case 2: result = attributes; break;
                case 8: result = 0; break;
                case 13:
                case 14:
                case 15: result = exists ? this.vm.trueObj : this.vm.falseObj; break;
            }
            this.vm.popNandPush(argCount, result);
            return true;
        },
        fileAttr_primitiveFileAttributes: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveFileAttributes");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveFileMasks: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveFileMasks");
            var fileMasks = [0xF000, 0xC000, 0xA000, 0x8000, 0x6000, 0x4000, 0x2000, 0x1000];
            this.vm.popNandPush(argCount, this.makeStArray(fileMasks));
            return true;
        },
        fileAttr_primitivePlatToStPath: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitivePlatToStPath");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveLogicalDrives: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveLogicalDrives");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveOpendir: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveOpendir");

            var pathObj = this.stackNonInteger(0);
            if (!this.success) return false;
            var path = this.filenameFromSqueak(pathObj.bytesAsString());
            if (!this.success) return false;
            var entries = Squeak.dirList(path);

            var index = lastDirIndex++;
            lastDirIndex = index;
            directoriesRegistry[index] = {
                entries: entries,
                enumerationIndex: 0
            };
            console.log(directoriesRegistry);

            var name = (Object.keys(entries))[0];
            var nameArray = Array.from(new TextEncoder("utf-8").encode(name));
            var pointer = [0, 0, 0, 1];

            var result = [this.makeStObject(nameArray), this.vm.nilObj, this.makeStArray(pointer)];
            this.vm.popNandPush(argCount,this.makeStArray(result));
            return true;
        },
        fileAttr_primitivePathMax: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitivePathMax");
            this.vm.popNandPush(argCount, 4096);
            return true;
        },
        fileAttr_primitiveReaddir: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveReaddir");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveRewinddir: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveRewinddir");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
        fileAttr_primitiveStToPlatPath: function(argCount) {
            console.log("Call FileAttributesPlugin: fileAttr_primitiveStToPlatPath");
            this.vm.popNandPush(argCount, this.vm.nilObj);
            return true;
        },
    });

}) // end of module 