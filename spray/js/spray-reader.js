var SprayReader = function(container){
  this.container = $(container);
  this.inputDiv = $('#input-text'); // Reference to the contenteditable div
};
SprayReader.prototype = {
  afterDoneCallback: null,
  wpm: null,

  wordIdx: null,
  input: null,
  words: null,
  wordRecords: null,
  isRunning: false,
  timers: [],
  delay: 1,

	 getWordRecords: function(inputString) {
	    let resultArray = [];
	    let startIdx = null;
	    let word = '';

	    for (let i = 0; i < inputString.length; i++) {
	        let isWhitespace = inputString[i] === ' ' || inputString[i] === '\n' || inputString[i] === '\t';

	        if (isWhitespace || i === inputString.length - 1) {
	            if (!isWhitespace) {
	                word += inputString[i];
	            }

	            if (startIdx !== null) {
	                let newRecord = {
	                                    word: word,
	                                    startIdx: startIdx,
	                                    endIdx: i - (isWhitespace ? 1 : 0),
	 									complexity: 1,
	                                };
					this.setComplexity(newRecord);   
	                resultArray.push(newRecord);
	            }
	            startIdx = null;
	            word = '';
	        } else {
	            if (startIdx === null) {
	                startIdx = i;
	            }
	            word += inputString[i];
	        }
	    }

	    return resultArray;
	},

	setComplexity: function(wordRecord) {
		let w = wordRecord.word;
		 if((w.indexOf(',') != -1 
		 	|| w.indexOf(':') != -1 
		 	|| w.indexOf('-') != -1 
		 	|| w.indexOf('(') != -1
		 	|| w.length > 8) && w.indexOf('.') == -1) {
		        wordRecord.complexity = 2;
		 }

		if(w.indexOf('.') != -1 
			|| w.indexOf('!') != -1 
			|| w.indexOf('?') != -1 
			|| w.indexOf(':') != -1 
			|| w.indexOf(';') != -1
			|| w.indexOf(')') != -1) {
		       wordRecord.complexity = 3;
	     }
      },
  
  
  setInput: function(input) {
    var inputString = this.inputDiv.text(); // Get text from contenteditable div
    this.wordRecords = this.getWordRecords(inputString);
    this.wordIdx = 0;

  },
  
  setWpm: function(wpm) {
    this.wpm = parseInt(wpm, 10);
    this.msPerWord = 60000/wpm;
  },
  
  start: function() {
    this.isRunning = true;
    
    thisObj = this;
    
    this.timers.push(setInterval(function() {
      thisObj.displayWordAndIncrement();
    }, this.msPerWord));
  },
  
  stop: function() {
    this.isRunning = false;
    
    for(var i = 0; i < this.timers.length; i++) {
      clearTimeout(this.timers[i]);
    }
  },

  back: function() {
    this.wordIdx = this.wordIdx - 10;
    if (this.wordIdx < 0) this.wordIdx = 0;
  },

  getLineNumber: function(textarea, index) {
    var text = textarea.value.substring(0, index);
    return (text.match(/\n/g) || []).length ;
},

scrollToLine: function(textarea, lineNumber) {
    var lineHeight = textarea.clientHeight / textarea.rows;
    textarea.scrollTop = lineNumber * lineHeight;
},


highlightWord: function(startIdx, endIdx) {
    var text = this.inputDiv.text();
    var before = text.substring(0, startIdx);
    var word = text.substring(startIdx, endIdx + 1);
    var after = text.substring(endIdx + 1);

    this.inputDiv.html(before + '<span class="highlighted">' + word + '</span>' + after);

    // Scroll to highlighted word
    this.inputDiv.find('.highlighted').get(0).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },


  displayWordAndIncrement: function() {

    this.delay--;
    if (this.delay > 0) return;

    var rec = this.wordRecords[this.wordIdx];
    this.delay = rec.complexity;
    var pivotedWord = pivot(rec.word);

    // Highlight and scroll to the word in the contenteditable div
    this.highlightWord(rec.startIdx, rec.endIdx);
    this.container.html(pivotedWord);

    this.wordIdx++;
    if (thisObj.wordIdx >= thisObj.wordRecords.length) {
      this.wordIdx = 0;
      this.stop();
      if(typeof(this.afterDoneCallback) === 'function') {
        this.afterDoneCallback();
      }
    }
  }
};

// Find the red-character of the current word.
function pivot(word){
    var length = word.length;


        var bit = 1;
        while(word.length < 22){
            if(bit > 0){
                word = word + '∘';
            }
            else{
                word = '∘' + word;
            }
            bit = bit * -1;
        }

        var start = '';
        var end = '';
        if((length % 2) === 0){
            start = word.slice(0, word.length/2);
            end = word.slice(word.length/2, word.length);
        } else{
            start = word.slice(0, word.length/2);
            end = word.slice(word.length/2, word.length);
        }

        var result;
        result = "<span class='spray_start'>" + start.slice(0, start.length -1);
        result = result + "</span><span class='spray_pivot'>";
        result = result + start.slice(start.length-1, start.length);
        result = result + "</span><span class='spray_end'>";
        result = result + end;
        result = result + "</span>";

    result = result.replace(/\∘/g, "<span class='invisible'>.</span>");

    return result;
}

// Let strings repeat themselves,
// because JavaScript isn't as awesome as Python.
String.prototype.repeat = function( num ){
    return new Array( num + 1 ).join( this );
}
