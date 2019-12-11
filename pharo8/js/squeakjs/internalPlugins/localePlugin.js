module('users.bert.SqueakJS.localePlugin').requires("users.bert.SqueakJS.primitives").toRun(function() {

    "use strict";

    Object.extend(Squeak.Primitives.prototype,
        'LocalePlugin', {
            locale_primitiveTimezoneOffset: function(argCount) {
                this.vm.popNandPush(argCount, 0);
                return true;
            },
            locale_primitiveTimezoneOffset: function(argCount) {
                this.vm.popNandPush(argCount, 0);
                return true;
            },
            locale_primitiveTimezoneOffset: function(argCount) {
                this.vm.popNandPush(argCount, 0);
                return true;
            },
        });
    
    }) // end of module 