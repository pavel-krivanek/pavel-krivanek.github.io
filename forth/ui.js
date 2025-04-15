// --- Minimal stub for window.forth (remove or replace with your own implementation) ---


    // --- Set up Ace Editor ---
    var editor = ace.edit("editor");
    try {
      editor.session.setMode("ace/mode/forth");
    } catch(e) {
      console.warn("Forth mode not available, using plain text.");
      editor.session.setMode("ace/mode/text");
    }
    //editor.setTheme("ace/theme/textmate");
    editor.setTheme("ace/theme/monokai");
    editor.session.setOption("useWorker", false);

    // --- Load saved content from localStorage ---
    var savedContent = localStorage.getItem("forth_code");
    if (savedContent) {
      editor.setValue(savedContent, -1);
    }

    // --- Unsaved changes indicator ---
    var unsavedIndicator = document.getElementById("unsaved");
    var isDirty = false;
    editor.session.on('change', function() {
      isDirty = true;
      unsavedIndicator.style.display = "inline";
    });

    // --- Listen for Ctrl+S to save the editor content ---
    editor.commands.addCommand({
      name: 'save',
      bindKey: {win: 'Ctrl-S', mac: 'Command-S'},
      exec: function(editor) {
        var content = editor.getValue();
        localStorage.setItem("forth_code", content);
        isDirty = false;
        unsavedIndicator.style.display = "none";
        console.log("Content saved.");
      },
      readOnly: false
    });

    // --- Listen for Ctrl+Enter to execute window.forth.run() ---
    editor.commands.addCommand({
      name: 'runCode',
      bindKey: {win: 'Ctrl-Enter', mac: 'Command-Enter'},
      exec: function(editor) {
        window.forth.input(editor.getValue());

        window.forth.makeRunning();
        window.forth.run();
        console.log("Code executed.");
      },
      readOnly: true
    });

    // --- Set up REPL functionality ---
    var replInput = document.getElementById("replInput");
    var replOutput = document.getElementById("replOutput");

    window.replOutput = replOutput;

   // Maximum number of history records
const MAX_HISTORY = 100;

// Retrieve command history from localStorage, or initialize an empty array
var storedHistory = localStorage.getItem("commandHistory");
var commandHistory = storedHistory ? JSON.parse(storedHistory) : [];

// Set the history index to the end of the current history
var historyIndex = commandHistory.length;

replInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    var inputText = replInput.value;
    
    if (inputText.trim() !== "") {
      // Add the command to the history
      commandHistory.push(inputText);
      
      // Ensure the history does not exceed MAX_HISTORY records
      if (commandHistory.length > MAX_HISTORY) {
        // Remove the oldest command if we exceed the limit
        commandHistory.shift();
      }
      
      // Save the updated history to localStorage
      localStorage.setItem("commandHistory", JSON.stringify(commandHistory));
      
      // Reset historyIndex to the end of the history array
      historyIndex = commandHistory.length;
    }
    
    replInput.value = "";
    
    // Execute the REPL command
    window.forth.input(inputText);
    window.forth.makeRunning();
    window.forth.run();
    
    // Convert the byte array to an ASCII string
    var outputStr = "";
    if (Array.isArray(window.forth.outputBuffer)) {
      outputStr = String.fromCharCode.apply(null, window.forth.outputBuffer);
    } else {
      outputStr = window.forth.outputBuffer.toString();
    }
    
    console.log(outputStr);
    replOutput.scrollTop = replOutput.scrollHeight;
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    // Navigate backward in the history if possible
    if (historyIndex > 0) {
      historyIndex--;
      replInput.value = commandHistory[historyIndex];
    }
  }
  
  if (e.key === "ArrowDown") {
    e.preventDefault();
    // Navigate forward in the history if possible
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      replInput.value = commandHistory[historyIndex];
    } else {
      // Clear the input if we're at the most recent entry
      historyIndex = commandHistory.length;
      replInput.value = "";
    }
  }
});
    