module('users.bert.SqueakJS.ffi').requires("users.bert.SqueakJS.primitives").toRun(function() {

    "use strict";

    Object.extend(Squeak.Primitives.prototype,
        'FFI', {
            ffi_primitiveCalloutWithArgs: function(argCount) {
                var extLibFunc = this.stackNonInteger(1),
                    argsObj = this.stackNonInteger(0);
                if (!this.isKindOf(extLibFunc, Squeak.splOb_ClassExternalFunction)) return false;
                var moduleName = extLibFunc.pointers[Squeak.ExtLibFunc_module].bytesAsString();
                var funcName = extLibFunc.pointers[Squeak.ExtLibFunc_name].bytesAsString();
                var args = argsObj.pointers.join(', ');
                this.vm.warnOnce('FFI: ignoring ' + moduleName + ': ' + funcName + '(' + args + ')');
                return false;
            },
        });

    }) // end of module