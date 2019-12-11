module('users.bert.SqueakJS.dropPlugin').requires("users.bert.SqueakJS.primitives").toRun(function() {

    "use strict";

    Object.extend(Squeak.Primitives.prototype,
        'DropPlugin', {
            primitiveDropRequestFileHandle: function(argCount) {
                var index = this.stackInteger(0),
                    fileNames = this.display.droppedFiles || [];
                if (index < 1 || index > fileNames.length) return false;
                // same code as primitiveFileOpen()
                var fileName = fileNames[index - 1],
                    file = this.fileOpen(fileName, false);
                if (!file) return false;
                var handle = this.makeFileHandle(fileName, file, false);
                this.popNandPushIfOK(argCount+1, handle);
                return true;
            },
            primitiveDropRequestFileName: function(argCount) {
                var index = this.stackInteger(0),
                    fileNames = this.display.droppedFiles || [];
                if (index < 1 || index > fileNames.length) return false;
                var result = this.makeStString(this.filenameToSqueak(fileNames[index - 1]));
                return this.popNandPushIfOK(argCount+1, result);
            },
        });
    
    }) // end of module 