"use strict";
var typingSpeed = 50;
const bell_width = 72 - 5;
const max_width = 72 - 1;
const tab_width = 8;
const xpx = 12; // characters width/heigth
const ypx = 30;
const char_height = 20;
const margin_top = 40;
const margin_left = 90;
const max_brokenness = 99;
const max_ink_level = 600;
const subclips = false;

var pageScrollSpeed = 200;
var x = 0 * xpx;
var y = ypx;
var maxY = y;
var minY = y;
var vmid = $(window).height() / 2;
var hmid = $(window).width() / 2;
var voffset = {};
var brokenness = 15;
var ink_remaining = 280;
var ink_variation = 0.3;
var keydown_keys = {};
var keypress_keys = {};
var keydown_keycode = false;
var started = true;
var shift_lock = false;
var spoolPosition = 1;

var headImage = "head.png";
var printBuffer = [];
var forthBootstrapRun = null;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function start() {
    $('.buttons, .output, .cursor').show();
    started = true;
}

function stop() {
    $('.buttons, .output, .cursor').hide();
    started = false;
}

function crlf() {
    y += ypx;
    maxY = Math.max(maxY, y);
    x = 0;
}

function advance_one_space() {
    if ((x / xpx) < max_width) {
        x += xpx;
    }

    if ((x / xpx) === max_width) {
        crlf();
        move_page();
    }
}

function currentForth() {
    return globalThis.forth;
}

function captureBootstrapRun() {
    if (!forthBootstrapRun && typeof globalThis.run === "function" && globalThis.run !== run) {
        forthBootstrapRun = globalThis.run;
    }
    return forthBootstrapRun;
}

function updateBusyIndicator() {
    const forth = currentForth();
    const busy = !!(forth && forth.awaitingRawInput);
    $('#rkbusy').toggle(busy);
}

function normalizeInputChar(charCode) {
    if (charCode === undefined || charCode === null) return null;
    if (charCode === 13) return 10;

    charCode = charCode & 0xFF;

    // convert a-z to A-Z
    if (charCode >= 97 && charCode <= 122) {
        charCode -= 32;
    }

    return charCode;
}

function maybeResumeForth() {
    const forth = currentForth();
    if (!forth) return;

    if (forth.awaitingRawInput || ((!forth.readsFromBlock || !forth.readsFromBlock()) && forth.state !== "running")) {
        forth.makeRunning();
        forth.run();
    }

    updateBusyIndicator();
}

function clearTypewriter() {
    x = 0 * xpx;
    y = ypx;
    maxY = y;
    minY = y;
    vmid = $(window).height() / 2;
    hmid = $(window).width() / 2;
    voffset = {};
    brokenness = 15;
    ink_remaining = 280;
    ink_variation = 0.3;
    keydown_keys = {};
    keypress_keys = {};
    keydown_keycode = false;
    shift_lock = false;
    spoolPosition = 1;
    headImage = "head.png";
    printBuffer = [];

    $('.output').empty();
    $('#terminal').val('');
    $('#debug').val('');
    $('#cursorImage').attr('src', headImage);
    $('#Carriage, .output, .cursor').stop(true, true);
    $('#Carriage').css({ top: (vmid - y) + 'px' });
    $('.output').css({ height: '0px' });
    $('.cursor').css({ top: (y + 10) + 'px', left: (x - 185) + 'px' });
    updateBusyIndicator();
}

function reset() {
    captureBootstrapRun();
    clearTypewriter();
    start();

    if (!forthBootstrapRun) {
        throw new Error("forth.js was loaded, but its bootstrap run() function was not captured.");
    }

    const forth = forthBootstrapRun();
    globalThis.forth = forth;
    updateBusyIndicator();
    return forth;
}

function run() {
    captureBootstrapRun();
    let forth = currentForth();
    if (!forth) {
        if (!forthBootstrapRun) {
            throw new Error("forth.js was loaded, but its bootstrap run() function was not captured.");
        }
        forth = forthBootstrapRun();
        globalThis.forth = forth;
        updateBusyIndicator();
        return forth;
    }

    forth.makeRunning();
    forth.run();
    updateBusyIndicator();
    return forth;
}

function keypress(e) {
    // Prevent browser special key actions as long as ctrl/alt/cmd is not being held
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Don't handle keys that are handled by keydown functions
    if (e.charCode == 0) {
        switch (e.keyCode) {
            case 8:
            case 9:
            case 13:
            case 37:
            case 38:
            case 39:
            case 40:
            case 16:
            case 18:
            case 20:
            case 27:
            case 17:
            case 224:
                return false;
        }
    }

    keypress_keys[keydown_keycode] = 1;

    if (Object.keys(keypress_keys).length > 1) {
        return false;
    }

    if ((e.charCode != 10) && (e.charCode != 13)) {
        let ch = e.charCode & 0xFF;

        // convert a-z to A-Z
        if (ch >= 97 && ch <= 122) {
            ch -= 32;
        }

        addchar(ch);
        // do not call specialchar() for printable characters
    }
}

function typeCharacter(charCode, shiftKey) {
    // just adds a character to the print buffer
    printBuffer.unshift(charCode);
}

function printer() {
    setTimeout(function() {
        var delay = typingSpeed;
        if (printBuffer.length > 0) {
            var code = printBuffer.pop();
            typeCharacterImmediately(code);
        }
        setTimeout(printer, delay);
    }, typingSpeed);
}

function typeCharacterImmediately(charCode, shiftKey) {
    var nosound = false;
    if (charCode == null || charCode === 0) return;

    if (charCode === 10 || charCode === 13) {
        crlf();
        move_page();
        setCursorPosition();
        return;
    }

    if (charCode === 9) {
        let spaces = tab_width - ((x / xpx) % tab_width);
        if (spaces === 0) spaces = tab_width;
        for (let i = 0; i < spaces; i++) {
            typeCharacterImmediately(32, shiftKey);
        }
        return;
    }

    if (charCode != 32 && charCode != 127)
        $("#cursorImage").attr("src", "head2.png");

    var c = String.fromCharCode(charCode);
    if (charCode == 127) c = " ";

    // Vertical offset
    if (!(c in voffset)) {
        voffset[c] = {
            threshold: Math.floor(Math.random() * 99) + 1, // 1..99
            direction: Math.floor(Math.random() * 3) - 1, // -1..+1
        };
    }

    let this_voffset = (voffset[c].threshold <= brokenness) ? Math.round(voffset[c].direction * brokenness / 33) : 0;

    output_character(c, this_voffset, '.output');
    advance_one_space();

    if (charCode == 127) {
        advance_one_space();
        advance_one_space();
        advance_one_space();
    }

    if (c.match(/\S/)) {
        ink_remaining = ink_remaining - 0.02;
    }

    if ((x / xpx) == bell_width) {
        $.ionSound.play('bell');
    } else if (!nosound) {
        switch (charCode) {
            case 32:
            case 127:
                $.ionSound.play('type-space');
                break;
            default:
                $.ionSound.play('type-char');
        }
    }

    setCursorPosition();

    setTimeout(function() {
        if (charCode != 32 && charCode != 9) {
            switch (spoolPosition) {
                case 1:
                    headImage = "head.png";
                    break;
                case 2:
                    headImage = "head3.png";
                    break;
                default:
                    headImage = "head4.png";
            }
            spoolPosition = ((spoolPosition) % 3) + 1;
        }

        $("#cursorImage").attr("src", headImage);
    }, typingSpeed);
}

function output_character(aCharacter, this_voffset, where) {
    let c = aCharacter.toUpperCase();
    // Choose an alpha level with a random element to simulate uneven key pressure and ribbon ink
    var ink_level = (ink_remaining > 0) ? ink_remaining / 400 - ink_variation + Math.random() * ink_variation : 0;

    var hpos = 'left: ' + (x + margin_left) + 'px; ';
    var vpos = 'top: ' + (y + this_voffset + margin_top) + 'px; ';

    var black_height = ypx;
    var black_height_style = '';
    var base_colour = '0,0,0';

    if (black_height > 0) {
        // Output the (possibly partial) character in black
        $(where).append('<div style="position: absolute; ' + vpos + hpos + ' color: rgba(' + base_colour + ', ' + ink_level + '); ' + black_height_style + '">' + c + '</div>');

        if (subclips) {
            // Maybe output further subcropped character(s) in black to make the colouring more uneven
            for (var subclipIndex = 0; subclipIndex < 3; subclipIndex++) {
                var subclip_right = Math.floor(Math.random() * xpx) + 1;
                var subclip_left = Math.floor(Math.random() * subclip_right);
                var subclip_bottom = Math.floor(Math.random() * black_height) + 1;
                var subclip_top = Math.floor(Math.random() * subclip_bottom);
                var r = Math.random();
                var sign = Math.random() < 0.5 ? -1 : 1;
                var b = brokenness / (max_brokenness + 1); // max_brokenness is 99, but let's use a percentage
                var i = ink_remaining / max_ink_level;
                // Thanks to John Valentine for help with the following formula
                var subclip_opacity = i * (0.5 + 0.5 * Math.sqrt(r * b) * sign);
                var subclip_color = 'color: rgba(' + base_colour + ', ' + subclip_opacity + '); ';
                var subclip_clip = 'clip: rect(' + subclip_top + 'px, ' + subclip_right + 'px, ' + subclip_bottom + 'px, ' + subclip_left + 'px); ';
                $(where).append('<div style="position: absolute; ' + vpos + hpos + subclip_color + subclip_clip + '">' + c + '</div>');
            }
        }
    }
}

function feedForthChar(charCode) {
    let forth = currentForth();
    if (!forth) {
        forth = run();
    }

    if (!forth) return;

    const original = charCode;
    charCode = normalizeInputChar(charCode);

    console.log("feedForthChar", {
        original: original,
        normalized: charCode,
        originalChar: original ? String.fromCharCode(original) : "",
        normalizedChar: charCode ? String.fromCharCode(charCode) : ""
    });

    if (charCode === null) return;

    forth.inputBuffer.push(charCode & 0xFF);

    if (charCode === 95) {
        forth.inputBuffer.pop();
        forth.inputBuffer.pop();
    }

    if (forth.awaitingRawInput) {
        typeCharacter(charCode);
        maybeResumeForth();
        return;
    }

    if (charCode === 10) {
        typeCharacter(32);
        maybeResumeForth();
    } else {
        typeCharacter(charCode);
        updateBusyIndicator();
    }
}

function addchar(char) {
    feedForthChar(char);
}

function typeError(aString) {
    for (let i = 0; i < aString.length; i++) {
        typeCharacter(aString.charCodeAt(i));
    }
    typeCharacter(10);
}

function typeOk() {
    typeError("OK");
}

function specialchar(char) {
    const forth = currentForth();

    switch (char) {
        case 8:  // backspace
        case 46: // delete
            feedForthChar(95);
            break;
        case 9:  // tab
            feedForthChar(9);
            break;
        case 10:
        case 13:
            updateBusyIndicator();
            break;
        case 27:
            if (forth && typeof forth.abortToQuit === "function") {
                forth.abortToQuit();
                updateBusyIndicator();
            }
            break;
        default:
            updateBusyIndicator();
    }
}

function keydown_nonmod(e) {
    keydown_keycode = e.keyCode;

    // Always record the keydown for mutex purposes, even if we aren't going to act on it
    keydown_keys[e.keyCode] = 1;
    if (Object.keys(keydown_keys).length > 1) {
        return false;
    }

    switch (e.which) {
        case 8: // backspace
            if (e.charCode == 0) {
                e.preventDefault();
                specialchar(8);
            }
            break;
        case 9: // tab
            if (e.charCode == 0) {
                e.preventDefault();
                specialchar(9);
            }
            break;
        case 13: // enter
            e.preventDefault();
            addchar(10);
            specialchar(10);
            break;
        case 46: // del
            if (e.charCode == 0) {
                e.preventDefault();
                specialchar(46);
            }
            break;
        default: // all other characters are handled by the keypress handler
    }
}


function keydown(e) {
    if (!started) {
        start();
    }

    // If this key is already being held down, ignore it (keyboard auto-repeat may fire multiple events)
    if (keydown_keys[e.keyCode]) {
        return;
    }
    switch (e.which) {
        case 27: // esc
            e.preventDefault();
            specialchar(27);
            break;
        case 17: // ctrl - ignore
        case 224: // cmd  - ignore
            break;
        default:
            keydown_nonmod(e);
    }
    return;
}

function move_page() {
    $('#Carriage').attr('height', '+=' + ypx + 'px');
    $(function() {
        $('#Carriage').animate({
            top: (vmid - y) + 'px',
        }, {
            duration: pageScrollSpeed,
            queue: false
        });

        $('.output').animate({
            height: '+=' + ypx + 'px',
        }, {
            duration: pageScrollSpeed,
            queue: false
        });

        $('.cursor').animate({
            top: (y + 10) + 'px',
        }, {
            duration: pageScrollSpeed,
            queue: false
        });
    });
}

// Handler for keyup events
function keyup(e) {
    if (Object.keys(keydown_keys).length) {

        delete keydown_keys[e.keyCode];
        delete keypress_keys[e.keyCode];
    }
}

function setCursorPosition() {
    $(function() {
        $('.cursor').animate({
            left: (x - 185) + 'px',
        }, {
            duration: typingSpeed,
            queue: false
        });
    });
}

function installForthUiBridge() {
    captureBootstrapRun();

    globalThis.run = run;
    globalThis.reset = reset;
    globalThis.addchar = addchar;
    globalThis.specialchar = specialchar;
    globalThis.typeError = typeError;
    globalThis.typeOk = typeOk;
}

// onLoad setup
$(function() {
    installForthUiBridge();
    move_page();
    setCursorPosition();
    $.ionSound({
        path: "",
        sounds: [{
                name: 'type-char'
            },
            {
                name: 'type-space'
            },
            {
                name: 'bell'
            },
        ],
        multiplay: true,
        preload: true,
    });

    $(document)
        .on('keydown', function(e) {
            keydown(e);
        })
        .on('keypress', function(e) {
            keypress(e);
        })
        .on('keyup', function(e) {
            keyup(e);
        });

    $(document).ready(function() {
        $('#Carriage').bind('wheel', function(e) {
            var delta = e.originalEvent ? e.originalEvent.deltaY : event.deltaY;
            var deltaMode = e.originalEvent ? e.originalEvent.deltaMode : event.deltaMode;
            if (deltaMode === 1)
                delta *= char_height;
            else if (deltaMode === 2)
                delta *= char_height * 20;

            y = Math.min(maxY, y - delta);
            y = Math.max(minY, y);
            $(function() {
                $('#Carriage').animate({
                    top: (vmid - y) + 'px',
                }, {
                    duration: pageScrollSpeed,
                    queue: false
                });
                $('.cursor').animate({
                    top: (y + 10) + 'px',
                }, {
                    duration: pageScrollSpeed,
                    queue: false
                });
            });
        });
    });
});