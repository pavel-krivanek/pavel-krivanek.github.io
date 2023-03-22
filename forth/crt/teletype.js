"use strict";
var typingDelay = 0;

const resolutionX = 72;
const resolutionY = 25;
const tab_width = 8;

var currentLineLenght = 0;
var keydown_keys = {};
var keypress_keys = {};
var keydown_keycode = false;
var started = true;

var printBuffer = [];
var content = "";

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function start() {
     started = true;
}

function stop() {
    started = false;
}

function crlf() {
    currentLineLenght = 0;
    output_character("\n");
}

function advance_one_space() {
    currentLineLenght++;
    if (currentLineLenght === resolutionX) {
        crlf();
     }
}

function keypress(e) {

    // Prevent browser special key actions as long as ctrl/alt/cmd is not being held
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Don't handle keys that are handled by keydown functions
    if (e.charCode == 0) {
        // Note the use of keyCode here so these numbers will match the keydown ones
        switch (e.keyCode) {
            case 8:
            case 9:
            case 10:
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
    keypress_keys[keydown_keycode] = 1; // Have to use charCode as that's the only one available to both keypress and keyup

    // Only one printing keypress allowed at a time
    if (Object.keys(keypress_keys).length > 1) {
        return false;
    }

    if ((e.charCode != 10) && (e.charCode != 13)) {
        addchar(e.charCode);
    }
}

function typeCharacter(charCode, shiftKey) {
    // just adds a character to the print buffer
    printBuffer.unshift(charCode);
}

function printer() {
    var delay = typingDelay;
    
    for (var i=1; i<=10; i++)
    {
        if (printBuffer.length > 0) {
            var code = printBuffer.pop();
            typeCharacterImmediately(code);
        }
    }
     setTimeout(printer, typingDelay);
}

function typeCharacterImmediately(asciiCode, shiftKey) {
    let charCode = asciiCode;
    if (charCode == 8) charCode = 95;
    if (charCode == 13) return; // ignore
    if (charCode == 0) return; // ignore
    if (charCode == 10) {
        //crlf();
        currentLineLenght = 0;
    }

    let c;
    c = String.fromCharCode(charCode);

    if (charCode == 127) c = " ";

    output_character(c);

    if (charCode != 10) {
        advance_one_space();
    }
    if (charCode == 127) {
        advance_one_space();
        advance_one_space();
        advance_one_space();
    }
}

function contentLines() {
  const array = content.split('\n');
  const lastEight = array.slice(-resolutionY);
  const difference = resolutionY - lastEight.length;

  if (difference > 0) {
   //return Array(difference).fill('123456789012345678901234567890123456789012345678901234567890123456789012').concat(lastEight);
    return Array(difference).fill('').concat(lastEight);
  }

  return lastEight;
}

function output_character(aCharacter) {
//         $('.char').attr('margin-left:', margin_left  + 'px');
//$('.output').css('margin-left', margin_left + 'px');
    let element = $(".output");
    let c = aCharacter.toUpperCase();
    content = content + aCharacter;
    element.empty();
//     $(where).text(content);

    let lines = contentLines();
    lines.lenght
    lines.forEach((line, index) => {
        let cursor = index === lines.length-1 ? "<span class=\"cursorSpan\">&#9608;</span>" : "";
        element.append(`<pre class="char">${line}${cursor}</pre>`);
    });
}

function keydown_nonmod(e) {
    keydown_keycode = e.keyCode;

    // Always record the keydown for mutex purposes, even if we aren't going to act on it
    keydown_keys[e.keyCode] = 1;
    if (Object.keys(keydown_keys).length > 1) {
        return false;
    }

    switch (e.which) {
        case 9: // tab
            if (e.charCode == 0) {
                e.preventDefault();

                e.preventDefault();
            }
            break;
            case 13: // enter
            addchar(10);
            break;
        case 8: // enter
            addchar(8);
            break;
        case 46: // del
            if (e.charCode == 0) {
                e.preventDefault();
                printBuffer = [];
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
        case 27: // esc  - ignore
        case 17: // ctrl - ignore
        case 224: // cmd  - ignore
            break;
        default:
            keydown_nonmod(e);
    }
    return;
}


// Handler for keyup events
function keyup(e) {
    if (Object.keys(keydown_keys).length) {

        delete keydown_keys[e.keyCode];
        delete keypress_keys[e.keyCode];
    }
}

// onLoad setup
$(function() {

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
});