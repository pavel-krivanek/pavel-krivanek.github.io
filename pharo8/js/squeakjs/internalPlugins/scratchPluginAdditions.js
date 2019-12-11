module('users.bert.SqueakJS.scratchPluginAdditions').requires("users.bert.SqueakJS.primitives").toRun(function() {

    "use strict";

    Object.extend(Squeak.Primitives.prototype,
        'ScratchPluginAdditions', {
            // methods not handled by generated ScratchPlugin
            scratch_primitiveOpenURL: function(argCount) {
                var url = this.stackNonInteger(0).bytesAsString();
                if (url == "") return false;
                if (/^\/SqueakJS\//.test(url)) {
                    url = url.slice(10);     // remove file root
                    var path = Squeak.splitFilePath(url),
                        template = localStorage["squeak-template:" + path.dirname];
                    if (template) url = JSON.parse(template).url + "/" + path.basename;
                }
                window.open(url, "_blank"); // likely blocked as pop-up, but what can we do?
                return this.popNIfOK(argCount);
            },
            scratch_primitiveGetFolderPath: function(argCount) {
                var index = this.stackInteger(0);
                if (!this.success) return false;
                var path;
                switch (index) {
                    case 1: path = '/'; break;              // home dir
                    // case 2: path = '/desktop'; break;    // desktop
                    // case 3: path = '/documents'; break;  // documents
                    // case 4: path = '/pictures'; break;   // my pictures
                    // case 5: path = '/music'; break;      // my music
                }
                if (!path) return false;
                this.vm.popNandPush(argCount + 1, this.makeStString(this.filenameToSqueak(path)));
                return true;
            },
        });
    
    }) // end of module 