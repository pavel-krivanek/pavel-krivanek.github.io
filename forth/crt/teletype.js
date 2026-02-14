"use strict";

/*
Terminal / teletype UI

This implementation provides:
- Line-buffered input editor (multi-line, cursor, insert/overwrite, history)
- Raw input mode for Forth (KEYRAW) which bypasses the editor and feeds bytes immediately
*/

var typingDelay = 0;

const resolutionX = 72;
const resolutionY = 25;
const tab_width = 8;

var started = true;

// ---- Output (screen) state ----
var currentLineLenght = 0; // kept for compatibility (note the historical misspelling)
var printBuffer = [];

// Transcript of everything that has been printed (including committed user input).
var outputContent = "";

// When true, output_character() will not trigger a re-render (used for batching).
var suspendRender = false;

// ---- Line editor state ----
var inputText = "";
var cursorIndex = 0;          // 0..inputText.length
var insertMode = true;        // true = insert, false = overwrite
var inputScrollRow = 0;

// NOTE: cannot use the name `history` in browser globals (window.history is a non-writable accessor).
var inputHistory = [];
var historyIndex = null;      // null => not navigating history
var historyDraft = "";        // preserved current edit buffer when entering history navigation

// ---- Utilities ----
function start() { started = true; }
function stop() { started = false; }

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function isWordChar(ch) {
    return /[A-Za-z0-9_]/.test(ch);
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

// ---- Rendering ----
function computeInputLayout() {
    let lines = [];
    let rowStarts = [];

    let row = 0;
    let col = 0;
    let current = "";
    let startIndex = 0;

    let cursorRow = 0;
    let cursorCol = 0;

    rowStarts.push(0);

    for (let i = 0; i < inputText.length; i++) {
        if (i === cursorIndex) {
            cursorRow = row;
            cursorCol = col;
        }

        let ch = inputText[i];
        if (ch === "\n") {
            lines.push(current);
            current = "";
            col = 0;
            row += 1;
            startIndex = i + 1;
            rowStarts.push(startIndex);
            continue;
        }

        current += ch;
        col += 1;

        if (col === resolutionX) {
            lines.push(current);
            current = "";
            col = 0;
            row += 1;
            startIndex = i + 1;
            rowStarts.push(startIndex);
        }
    }

    if (cursorIndex === inputText.length) {
        cursorRow = row;
        cursorCol = col;
    }

    lines.push(current);

    return { lines, rowStarts, cursorRow, cursorCol };
}

function escapeHtml(s) {
    // Keep it minimal: prevents accidental HTML injection from Forth output.
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTerminal() {
    let element = $(".output");
    if (element.length === 0) return;

    let rawMode = (window.forth && window.forth.awaitingRawInput === true);

    // Compute input area lines (always allocate at least 1 line).
    let layout = computeInputLayout();
    let allInputLines = layout.lines;
    if (allInputLines.length === 0) allInputLines = [""];

    // Input area can extend, but must leave at least 1 row for output.
    let maxInputRows = Math.max(1, resolutionY - 1);

    // Keep cursor-visible scrolling for long multi-line input.
    let cursorRow = layout.cursorRow;
    if (!rawMode) {
        if (cursorRow < inputScrollRow) inputScrollRow = cursorRow;
        if (cursorRow >= inputScrollRow + maxInputRows) inputScrollRow = cursorRow - maxInputRows + 1;
        inputScrollRow = clamp(inputScrollRow, 0, Math.max(0, allInputLines.length - 1));
    } else {
        // In raw mode, keep the editor visually stable.
        inputScrollRow = 0;
    }

    let visibleInputLines = allInputLines.slice(inputScrollRow, inputScrollRow + maxInputRows);
    if (visibleInputLines.length === 0) visibleInputLines = [""];

    let outputRows = resolutionY - visibleInputLines.length;
    outputRows = Math.max(1, outputRows);

    // Output lines: we rely on embedded newlines (including wrap-inserted CRLFs).
    let outLinesAll = outputContent.split("\n");
    let lastOut = outLinesAll.slice(-outputRows);
    let pad = outputRows - lastOut.length;
    if (pad > 0) lastOut = Array(pad).fill("").concat(lastOut);

    element.empty();

    // Render output lines. In raw mode we show the cursor at the end of the last output line.
    for (let i = 0; i < lastOut.length; i++) {
        let line = escapeHtml(lastOut[i]);
        let cursor = (rawMode && i === lastOut.length - 1) ? "<span class=\"cursorSpan\">&#9608;</span>" : "";
        element.append(`<pre class="char">${line}${cursor}</pre>`);
    }

    // Render input lines at the bottom.
    for (let i = 0; i < visibleInputLines.length; i++) {
        let line = visibleInputLines[i];
        let cursorHtml = "";
        if (!rawMode) {
            let absoluteRow = inputScrollRow + i;
            if (absoluteRow === layout.cursorRow) {
                let col = clamp(layout.cursorCol, 0, line.length);
                let before = escapeHtml(line.slice(0, col));
                let after = escapeHtml(line.slice(col));
                cursorHtml = `${before}<span class="cursorSpan">&#9608;</span>${after}`;
                element.append(`<pre class="char">${cursorHtml}</pre>`);
                continue;
            }
        }
        element.append(`<pre class="char">${escapeHtml(line)}</pre>`);
    }
}

// ---- Output functions used by the Forth VM ----
function typeCharacter(charCode, shiftKey) {
    // Adds a character to the print buffer (used by Forth EMIT / TELL).
    printBuffer.unshift(charCode);
}

function printer() {
    for (var i = 1; i <= 10; i++) {
        if (printBuffer.length > 0) {
            var code = printBuffer.pop();
            typeCharacterImmediately(code);
        }
    }
    setTimeout(printer, typingDelay);
}

function typeCharacterImmediately(asciiCode, shiftKey) {
    let charCode = asciiCode;

    if (charCode === 13) return; // ignore CR
    if (charCode === 0) return;  // ignore NUL

    // DEL = erase (render as space)
    if (charCode === 127) charCode = 32;

    if (charCode === 10) {
        currentLineLenght = 0;
        output_character("\n");
        return;
    }

    let c = String.fromCharCode(charCode);
    output_character(c);
    advance_one_space();
}

function output_character(aCharacter) {
    outputContent = outputContent + aCharacter;
    if (!suspendRender) renderTerminal();
}

// ---- Line editor operations ----
function clearInput() {
    inputText = "";
    cursorIndex = 0;
    historyIndex = null;
    historyDraft = "";
    inputScrollRow = 0;
}

function insertTextAtCursor(text, allowOverwriteSingleChar) {
    if (text.length === 0) return;

    // Normalize newlines from clipboard.
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Overwrite is only applied for single-character typing (not paste).
    if (!insertMode && allowOverwriteSingleChar && text.length === 1) {
        let ch = text[0];
        if (cursorIndex < inputText.length && inputText[cursorIndex] !== "\n" && ch !== "\n") {
            inputText = inputText.slice(0, cursorIndex) + ch + inputText.slice(cursorIndex + 1);
            cursorIndex += 1;
            return;
        }
    }

    inputText = inputText.slice(0, cursorIndex) + text + inputText.slice(cursorIndex);
    cursorIndex += text.length;
}

function backspace() {
    if (cursorIndex <= 0) return;
    inputText = inputText.slice(0, cursorIndex - 1) + inputText.slice(cursorIndex);
    cursorIndex -= 1;
}

function deleteForward() {
    if (cursorIndex >= inputText.length) return;
    inputText = inputText.slice(0, cursorIndex) + inputText.slice(cursorIndex + 1);
}

function moveCursorLeft(ctrl) {
    if (!ctrl) {
        cursorIndex = Math.max(0, cursorIndex - 1);
        return;
    }
    // Ctrl+Left: jump by words.
    let i = cursorIndex;
    if (i === 0) return;
    i -= 1;
    while (i > 0 && !isWordChar(inputText[i])) i -= 1;
    while (i > 0 && isWordChar(inputText[i - 1])) i -= 1;
    cursorIndex = i;
}

function moveCursorRight(ctrl) {
    if (!ctrl) {
        cursorIndex = Math.min(inputText.length, cursorIndex + 1);
        return;
    }
    // Ctrl+Right: jump by words.
    let i = cursorIndex;
    while (i < inputText.length && !isWordChar(inputText[i])) i += 1;
    while (i < inputText.length && isWordChar(inputText[i])) i += 1;
    cursorIndex = i;
}

function moveCursorUpOrHistory() {
    let layout = computeInputLayout();
    if (layout.cursorRow > 0) {
        // Move within the buffer.
        let targetRow = layout.cursorRow - 1;
        let targetStart = layout.rowStarts[targetRow];
        let targetLine = layout.lines[targetRow] || "";
        let newIndex = targetStart + Math.min(layout.cursorCol, targetLine.length);
        cursorIndex = clamp(newIndex, 0, inputText.length);
        return;
    }

    // History navigation.
    if (inputHistory.length === 0) return;
    if (historyIndex === null) {
        historyDraft = inputText;
        historyIndex = inputHistory.length - 1;
    } else {
        historyIndex = Math.max(0, historyIndex - 1);
    }
    inputText = inputHistory[historyIndex];
    cursorIndex = inputText.length;
    inputScrollRow = 0;
}

function moveCursorDownOrHistory() {
    let layout = computeInputLayout();
    if (layout.cursorRow < layout.lines.length - 1) {
        // Move within the buffer.
        let targetRow = layout.cursorRow + 1;
        let targetStart = layout.rowStarts[targetRow];
        let targetLine = layout.lines[targetRow] || "";
        let newIndex = targetStart + Math.min(layout.cursorCol, targetLine.length);
        cursorIndex = clamp(newIndex, 0, inputText.length);
        return;
    }

    // History navigation.
    if (historyIndex === null) return;

    if (historyIndex < inputHistory.length - 1) {
        historyIndex += 1;
        inputText = inputHistory[historyIndex];
    } else {
        historyIndex = null;
        inputText = historyDraft;
        historyDraft = "";
    }
    cursorIndex = inputText.length;
    inputScrollRow = 0;
}

function insertTab() {
    let layout = computeInputLayout();
    let col = layout.cursorCol;
    let spaces = tab_width - (col % tab_width);
    insertTextAtCursor(" ".repeat(spaces), false);
}

function commitInputToOutput(text) {
    // Move the current input buffer into the output transcript, preserving wraps.
    suspendRender = true;

    for (let i = 0; i < text.length; i++) {
        let ch = text[i];
        if (ch === "\n") {
            crlf();
        } else {
            output_character(ch);
            advance_one_space();
        }
    }
    crlf(); // final newline after Enter

    suspendRender = false;
    renderTerminal();
}

function submitInputBuffer() {
    let textToSend = inputText;

    // Echo to transcript.
    commitInputToOutput(textToSend);

    // Store in history (typical terminals skip empty lines).
    if (textToSend.trim().length > 0) {
        inputHistory.push(textToSend);
    }

    clearInput();
    renderTerminal();

    // Send to Forth.
    if (window.forth) {
        window.forth.input(textToSend + "\n");
        window.forth.makeRunning();
        window.forth.run();
    }
}

// ---- Raw input mode (KEYRAW) ----
function sendRawBytes(bytes) {
    if (!window.forth) return;
    for (let b of bytes) {
        window.forth.inputBuffer.push(b & 0xFF);
    }
    if (window.forth.state !== "running") {
        window.forth.makeRunning();
        window.forth.run();
    }
}

function handleRawKeydown(e) {
    // In raw mode, we bypass the line editor and feed bytes immediately.
    // Keep this minimal: printable chars + a few control keys.
    let bytes = null;

    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bytes = [e.key.charCodeAt(0) & 0xFF];
    } else {
        switch (e.key) {
            case "Enter": bytes = [10]; break;
            case "Backspace": bytes = [8]; break;
            case "Tab": bytes = [9]; break;
            case "Escape": bytes = [27]; break;
            default: bytes = null;
        }
    }

    if (bytes) {
        e.preventDefault();
        e.stopPropagation();
        sendRawBytes(bytes);
        renderTerminal();
    }
}

// ---- Event handling / focus ----
function handleBufferedKeydown(e) {
    // Allow system shortcuts and paste.
    let isPaste = (e.key && e.key.toLowerCase() === "v" && (e.ctrlKey || e.metaKey));
    if (isPaste) return;

    // Prevent browser navigation / default behavior for keys we handle.
    // (We still allow Ctrl/Cmd combos except paste.)
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
    }

    switch (e.key) {
        case "Escape":
            clearInput();
            renderTerminal();
            return;

        case "Enter":
            if (e.shiftKey) {
                insertTextAtCursor("\n", false);
                renderTerminal();
            } else {
                submitInputBuffer();
            }
            return;

        case "Backspace":
            backspace();
            renderTerminal();
            return;

        case "Delete":
            deleteForward();
            renderTerminal();
            return;

        case "Insert":
            insertMode = !insertMode;
            renderTerminal();
            return;

        case "ArrowLeft":
            moveCursorLeft(e.ctrlKey);
            renderTerminal();
            return;

        case "ArrowRight":
            moveCursorRight(e.ctrlKey);
            renderTerminal();
            return;

        case "ArrowUp":
            moveCursorUpOrHistory();
            renderTerminal();
            return;

        case "ArrowDown":
            moveCursorDownOrHistory();
            renderTerminal();
            return;

        case "Tab":
            insertTab();
            renderTerminal();
            return;

        case "Home": {
            // Move to start of current visual line.
            let layout = computeInputLayout();
            let row = layout.cursorRow;
            cursorIndex = layout.rowStarts[row] || 0;
            renderTerminal();
            return;
        }

        case "End": {
            // Move to end of current visual line.
            let layout = computeInputLayout();
            let row = layout.cursorRow;
            let start = layout.rowStarts[row] || 0;
            let len = (layout.lines[row] || "").length;
            cursorIndex = clamp(start + len, 0, inputText.length);
            renderTerminal();
            return;
        }

        default:
            // Printable characters
            if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                insertTextAtCursor(e.key, true);
                renderTerminal();
                return;
            }
    }
}

function keydown(e) {
    if (!started) start();

    // If Forth requests raw input, bypass the editor.
    if (window.forth && window.forth.awaitingRawInput === true) {
        handleRawKeydown(e);
        return;
    }

    handleBufferedKeydown(e);
}

// onLoad setup
$(function() {
    // Focus sink: lets us receive keyboard + paste without showing a native caret.
    let $focus = $('<div id="tty-focus" tabindex="0" aria-hidden="true"></div>');
    $focus.css({
        position: "fixed",
        left: "-10000px",
        top: "0px",
        width: "1px",
        height: "1px",
        opacity: 0,
        outline: "none",
        pointerEvents: "none"
    });
    $("body").append($focus);

    function focusTerminal() {
        // Some browsers scroll on focus unless prevented.
        try { $focus[0].focus({ preventScroll: true }); }
        catch (_) { $focus.trigger("focus"); }
    }

    $(document)
        .on("mousedown", function() { focusTerminal(); })
        .on("touchstart", function() { focusTerminal(); })
        .on("keydown", function(e) { keydown(e); })
        .on("paste", function(e) {
            // Clipboard paste (multiline supported).
            let oe = e.originalEvent || e;
            if (oe && oe.clipboardData) {
                let text = oe.clipboardData.getData("text");
                if (window.forth && window.forth.awaitingRawInput === true) {
                    // In raw mode, paste feeds bytes immediately.
                    sendRawBytes(Array.from(text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")).map(ch => ch.charCodeAt(0) & 0xFF));
                } else {
                    insertTextAtCursor(text, false);
                }
                e.preventDefault();
                e.stopPropagation();
                renderTerminal();
            }
        });

    focusTerminal();
    renderTerminal();
});
