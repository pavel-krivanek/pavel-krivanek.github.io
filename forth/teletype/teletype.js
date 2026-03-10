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
var statusMessageTimer = null;
var focusSink = null;

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
    return charCode & 0xFF;
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

function clearKeyboardState() {
    keydown_keys = {};
    keypress_keys = {};
    keydown_keycode = false;
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

function currentDiskDownloadFilename() {
    let now = new Date();
    let yy = pad2(now.getFullYear() % 100);
    let mm = pad2(now.getMonth() + 1);
    let dd = pad2(now.getDate());
    let hh = pad2(now.getHours());
    let mi = pad2(now.getMinutes());
    let ss = pad2(now.getSeconds());
    return `forth-${yy}${mm}${dd}-${hh}${mi}${ss}.img`;
}

function ensureStatusMessageElement() {
    let element = $("#tty-status-message");
    if (element.length > 0) return element;

    element = $('<div id="tty-status-message" aria-live="polite"></div>');
    element.css({
        position: "fixed",
        right: "16px",
        bottom: "16px",
        display: "none",
        maxWidth: "min(40rem, calc(100vw - 32px))",
        padding: "10px 14px",
        borderRadius: "6px",
        color: "#fff",
        background: "rgba(0, 0, 0, 0.82)",
        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.35)",
        fontFamily: "monospace",
        fontSize: "14px",
        zIndex: 2147483647,
        pointerEvents: "none"
    });
    $("body").append(element);
    return element;
}

function setStatusMessage(message, isError) {
    let element = ensureStatusMessageElement();
    if (statusMessageTimer !== null) {
        clearTimeout(statusMessageTimer);
        statusMessageTimer = null;
    }

    element.stop(true, true);
    element.text(message || "");
    element.css("background", isError ? "rgba(140, 24, 24, 0.92)" : "rgba(0, 0, 0, 0.82)");
    element.show();

    statusMessageTimer = setTimeout(function() {
        element.fadeOut(700);
        statusMessageTimer = null;
    }, 3200);
}

function ensureFocusSink() {
    if (focusSink) return focusSink;

    focusSink = $('<div id="tty-focus" tabindex="0" aria-hidden="true"></div>');
    focusSink.css({
        position: "fixed",
        left: "-10000px",
        top: "0px",
        width: "1px",
        height: "1px",
        opacity: 0,
        outline: "none",
        pointerEvents: "none"
    });

    $("body").append(focusSink);
    return focusSink;
}

function focusTerminal() {
    let sink = ensureFocusSink();
    try {
        sink[0].focus({ preventScroll: true });
    } catch (_) {
        sink[0].focus();
    }
}

function saveCurrentDisk() {
    const forth = currentForth();
    if (!forth || !forth.disk || !forth.disk.content) {
        setStatusMessage("No disk is available to save.", true);
        return;
    }

    if (forth.blockBuffers && typeof forth.blockBuffers.saveBuffers === "function") {
        forth.blockBuffers.saveBuffers();
    }

    let bytes = forth.disk.content;
    let blob = new Blob([bytes], { type: "application/octet-stream" });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    let filename = currentDiskDownloadFilename();

    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function() {
        URL.revokeObjectURL(url);
    }, 1000);

    setStatusMessage("Saved disk image as " + filename + ".", false);
    focusTerminal();
}

function isImgFilename(name) {
    return /\.img$/i.test(name || "");
}

function loadCurrentDiskFromBytes(bytes, sourceName) {
    const forth = currentForth();
    if (!forth || !forth.disk || !forth.disk.content) {
        setStatusMessage("No disk is available to replace.", true);
        return;
    }

    let diskBytes = forth.disk.content;
    if (bytes.length > diskBytes.length) {
        setStatusMessage("The dropped disk image is too large for the current virtual disk.", true);
        return;
    }

    if (forth.blockBuffers && typeof forth.blockBuffers.emptyBuffers === "function") {
        forth.blockBuffers.emptyBuffers();
    }

    diskBytes.fill(32);
    diskBytes.set(bytes);
    clearKeyboardState();
    updateBusyIndicator();
    setStatusMessage("Loaded disk image " + sourceName + ".", false);
    focusTerminal();
}

function loadDiskImageFile(file) {
    if (!file) return;
    if (!isImgFilename(file.name)) {
        setStatusMessage("Only .img files can be loaded as disks.", true);
        return;
    }

    let reader = new FileReader();
    reader.onload = function(event) {
        try {
            let bytes = new Uint8Array(event.target.result);
            loadCurrentDiskFromBytes(bytes, file.name);
        } catch (error) {
            console.error(error);
            setStatusMessage("Failed to read the dropped disk image.", true);
        }
    };
    reader.onerror = function() {
        setStatusMessage("Failed to read the dropped disk image.", true);
    };
    reader.readAsArrayBuffer(file);
}

function eventHasFiles(event) {
    let dataTransfer = event && event.dataTransfer;
    if (!dataTransfer) return false;
    if (dataTransfer.items && dataTransfer.items.length > 0) {
        return Array.from(dataTransfer.items).some(item => item.kind === "file");
    }
    if (dataTransfer.types && dataTransfer.types.length > 0) {
        return Array.from(dataTransfer.types).indexOf("Files") !== -1;
    }
    return dataTransfer.files && dataTransfer.files.length > 0;
}

function preventBrowserFileDrop(event) {
    if (!eventHasFiles(event)) return false;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
    }
    return true;
}

function installDiskDropHandlers() {
    let targets = [window, document, document.documentElement, document.body].filter(Boolean);

    targets.forEach(function(target) {
        ["dragenter", "dragover"].forEach(function(eventName) {
            target.addEventListener(eventName, function(event) {
                preventBrowserFileDrop(event);
            }, true);
        });

        target.addEventListener("drop", function(event) {
            if (!preventBrowserFileDrop(event)) return;
            let files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
            let file = files.find(function(candidate) { return isImgFilename(candidate.name); });
            if (!file) {
                setStatusMessage("Drop a .img file to load a disk image.", true);
                focusTerminal();
                return;
            }
            loadDiskImageFile(file);
        }, true);
    });
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
    focusTerminal();
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
        focusTerminal();
        return forth;
    }

    forth.makeRunning();
    forth.run();
    updateBusyIndicator();
    focusTerminal();
    return forth;
}

function keypress(e) {
    // Let browser/system shortcuts through (Ctrl/Cmd+key), but keep AltGr combinations working.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        return false;
    }

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

    // Record the keypress for mutex purposes, even if we're not going to act on it
    keypress_keys[keydown_keycode] = 1;

    // Only one printing keypress allowed at a time
    if (Object.keys(keypress_keys).length > 1) {
        return false;
    }

    if ((e.charCode != 10) && (e.charCode != 13)) {
        let ch = e.charCode & 0xFF;

        // convert a-z to A-Z on the printable input path
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

    charCode = normalizeInputChar(charCode);
    if (charCode === null) return;

    forth.inputBuffer.push(charCode & 0xFF);

    if (charCode === 95) { // underscore acts like rubout in the host UI
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

    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key && e.key.toLowerCase() === "s") {
        if (keydown_keys[e.keyCode]) {
            return;
        }
        keydown_keys[e.keyCode] = 1;
        e.preventDefault();
        e.stopPropagation();
        saveCurrentDisk();
        return;
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
    installDiskDropHandlers();
    ensureStatusMessageElement();
    ensureFocusSink();
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
        .on('mousedown', function() {
            focusTerminal();
        })
        .on('touchstart', function() {
            focusTerminal();
        })
        .on('keydown', function(e) {
            keydown(e);
        })
        .on('keypress', function(e) {
            keypress(e);
        })
        .on('keyup', function(e) {
            keyup(e);
        });

    focusTerminal();
    setStatusMessage("Ctrl+S saves the current disk. Drop a .img file anywhere to load it.", false);

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