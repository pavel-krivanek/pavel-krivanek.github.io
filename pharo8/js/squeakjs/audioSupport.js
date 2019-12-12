module('users.bert.SqueakJS.audioSupport').requires("users.bert.SqueakJS.vm").toRun(function() {

    "use strict";

    Object.extend(Squeak,
        "audio", {
            startAudioOut: function() {
                if (!this.audioOutContext) {
                    var ctxProto = window.AudioContext || window.webkitAudioContext
                        || window.mozAudioContext || window.msAudioContext;
                    this.audioOutContext = ctxProto && new ctxProto();
                }
                return this.audioOutContext;
            },
            startAudioIn: function(thenDo, errorDo) {
                if (this.audioInContext) {
                    this.audioInSource.disconnect();
                    return thenDo(this.audioInContext, this.audioInSource);
                }
                navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia
                    || navigator.mozGetUserMedia || navigator.msGetUserMedia;
                if (!navigator.getUserMedia) return errorDo("test: audio input not supported");
                navigator.getUserMedia({audio: true, toString: function() {return "audio"}},
                    function onSuccess(stream) {
                        var ctxProto = window.AudioContext || window.webkitAudioContext
                            || window.mozAudioContext || window.msAudioContext;
                        this.audioInContext = ctxProto && new ctxProto();
                        this.audioInSource = this.audioInContext.createMediaStreamSource(stream);
                        thenDo(this.audioInContext, this.audioInSource);
                    },
                    function onError() {
                        errorDo("cannot access microphone");
                    });
            },
            stopAudio: function() {
                if (this.audioInSource)
                    this.audioInSource.disconnect();
            },
        },
        "time", {
            Epoch: Date.UTC(1901,0,1) + (new Date()).getTimezoneOffset()*60000,        // local timezone
            EpochUTC: Date.UTC(1901,0,1),
            totalSeconds: function() {
                // seconds since 1901-01-01, local time
                return Math.floor((Date.now() - Squeak.Epoch) / 1000);
            },
        },
        "utils", {
            bytesAsString: function(bytes) {
                var chars = [];
                for (var i = 0; i < bytes.length; )
                    chars.push(String.fromCharCode.apply(
                        null, bytes.subarray(i, i += 16348)));
                return chars.join('');
            },
        });

    }) // end of module