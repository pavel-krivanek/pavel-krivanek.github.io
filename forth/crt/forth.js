"use strict";

class ForthMemory {

     constructor(forth) {
        this.forth = forth;
        this.resetStack();
        this.resetReturnStack();
        this.resetMemory();
    }

    resetMemory() {  
        this.memory = new Array(0xFFFF);
        this.memory.fill(0); 
    }
    resetStack() { this.dsp = this.s0(); }
    resetReturnStack() { this.rsp = this.r0(); }
    s0() { return 0xEFFC; }
    r0() { return 0xDFFC; }

    memoryAt(address) { return this.memory[address]; }
    memoryAtPut(address, value) { return this.memory[address] = value; }
    memoryCopyFromTo(start, end) { return this.memory.slice(start, end+1); }
 
    peek() { return this.memoryCopyFromTo(this.dsp, this.dsp+1); }
    peekReturnStack() { return this.memoryCopyFromTo(this.rsp, this.rsp+1); }
    pop(count = 2) { 
        let result = this.memoryCopyFromTo(this.dsp, this.dsp+count-1);
        this.dsp += count;
        return result; 
    }
    popFromReturnStack(count = 2) { 
        let result = this.memoryCopyFromTo(this.rsp, this.rsp+count-1);
        this.rsp += count;
        return result; 
    }
    push(bytes) { 
        this.dsp = this.dsp - bytes.length;
        bytes.forEach((each, index) => {
            this.memoryAtPut(this.dsp+index, each)
        });
        return bytes; 
    }
    returnStackPush(bytes) { 
        this.rsp = this.rsp - 2;
        bytes.forEach((each, index) => {
            this.memoryAtPut(this.rsp+index, each);
        });
        return bytes; 
    }
    pushAddressToReturnStack(address) { 
        let bytes = address.asUnsigned2Bytes();
        this.returnStackPush(bytes);
        return bytes; 
    }
    returnStackSize() { this.r0() - this.rsp; }    
    stackSize() { this.s0() - this.dsp; }
    
    wordAt(address) { 
        return (this.memoryAt(address + 1) << 0) +
               (this.memoryAt(address + 0) << 8);
    }
    signedWordAt(address) { return this.wordAt(address).asSigned16(); }
    unsignedWordAt(address) { return this.wordAt(address); }
    byteAt(address) { return this.memoryAt(address) }
    writeByteAt(byte, address) { this.memoryAtPut(address, byte) }
    writeCodeAt(aCode, address) { this.memoryAtPut(address, aCode) }
    writeWordAt(aWord, address) {
        let num = aWord.asUnsigned16();
        let bytes = num.asUnsigned2Bytes();
        this.memoryAtPut(address+0, bytes[0])
        this.memoryAtPut(address+1, bytes[1])
    }
} 

Number.prototype.asUnsigned16 = function() {
    return this < 0 ? ((Math.abs(this+1) & 0xFFFF) ^ 0xFFFF) : this & 0xFFFF ;
}
Number.prototype.asUnsigned32 = function() {
    if (this >= 0) return this & 0xFFFFFFFF;
    let num = Math.abs(this+1) % 0x100000000;
    return 0xFFFFFFFF - num; 
}
Number.prototype.asSigned16 = function() {
    return this > 0x7FFF ? 0 - (((this & 0xFFFF) ^ 0xFFFF) + 1) : this ;     
}
Number.prototype.asSigned32 = function() {
    return this > 0x7FFFFFFF ? 0 - (((this & 0xFFFFFFFF) ^ 0xFFFFFFFF) + 1) : this ;     
}
Number.prototype.asUnsigned2Bytes = function() {
    let num = this.asUnsigned16();
    return [ (num & 0xFF00) >>> 8, num & 0xFF ];  
}
Number.prototype.asUnsigned4Bytes = function() {
    let num = this.asUnsigned32();
    return [ (num & 0xFF000000) >>> 24, (num & 0xFF0000) >>> 16, (num & 0xFF00) >>> 8, num & 0xFF ];  
}
Number.prototype.numberValue = function() {
    return this; 
}
Array.prototype.asUnsigned16 = function() {
    return (this[1]+(this[0] << 8));
}
Array.prototype.asUnsigned32 = function() {
    return (this[3]+(this[2] << 8)+(this[1] << 16)+(this[0] << 24));
}
Array.prototype.asSigned16 = function() {
    return this.asUnsigned16().asSigned16();
}
Array.prototype.asSigned32 = function() {
    return this.asUnsigned32().asSigned32();
}
Array.prototype.isSameAs = function(anArray) {
    return (this.length === anArray.length)
        && this.every((v,i) => v === anArray[i]);;
}
Array.prototype.toByteString = function() {
    return String.fromCharCode.apply(null, this);
}

class Forth {
    constructor(forth) {
       this.memory = new ForthMemory(this);
       this.labels = {};
       this.unknownLabels = {};
       this.pc = 0;
       this.pcNext = 0;
       this.pcCurrent = 0;
       this.initPos = 0;
   
       this.lastWord = 0;
       this.resetBuffers(); 
       this.memoryInitializer().initializeMemory();
       
       this.state = "running";
    }
    resetBuffers() {
        this.inputBuffer = [];
        this.outputBuffer = []; 
    }
    input(aString) {
        for (var i = 0; i < aString.length; i++) {
            this.inputBuffer.push(aString.charCodeAt(i) & 0xFF);
        }
    }
    addLabelAddress(aLabel, anAddress) { this.labels[aLabel] = anAddress; }
    addressForLabel(aLabel) { return this.labels[aLabel]; }
    registerUnknownLabelUsageAtPosition(aLabel, address) { 
        let aSet = this.unknownLabels[aLabel];
        if (aSet === undefined) {
            aSet = new Set();
            this.unknownLabels[aLabel] = aSet }
        aSet.add(address);            
    }
    addressForLabelInFutureSet(aLabel, anAddress) { 
        let found = this.addressForLabel(aLabel);
        if (found === undefined) {
            this.registerUnknownLabelUsageAtPosition(aLabel, anAddress);
            return 0;
        }
        return found; 
    }
    codewordOf(dictionaryWordAddress) {
        let current = dictionaryWordAddress + this.wordSize();
        let length = this.lengthByteAt(current);
        return current + 1 + length;
    }
    matchAt(nameArray, wordAddress) {
        let lengthAddress = wordAddress+this.wordSize();
        let length = this.lengthByteAt(lengthAddress);
        if (length != nameArray.length) return false;
        let anArray = this.memory.memoryCopyFromTo(lengthAddress+1, lengthAddress+nameArray.length)
        return nameArray.isSameAs(anArray);
    }
    find(nameArray) {
        let current = this.varLatestValue();
        let found = false;
        do {
            if (current === 0) return 0;
            found = this.matchAt(nameArray, current) && !this.isHidden(current);
            if (!found) { current = this.memory.wordAt(current) }
        } while (!found);
        return current;
    }
    fixUnknownLabels() {
        for (let [label, usages] of Object.entries(this.unknownLabels)) {
            let correctAddress = this.addressForLabel(label);
            for (let usageAddress of usages) {
                this.memory.writeWordAt(correctAddress, usageAddress); } }
    }
    flagHidden() { return 0x20; }
    flagImmediate() { return 0x80; }
    flagLengthMask() { return 0x1F; }
    init() {
        this.pc = 0 // docol
        this.pcCurrent = this.addressForLabel("codeword_QUIT");
        this.pcNext = this.pcCurrent + this.wordSize();
        this.setVarStateValue(0);
    }
    hasFlag(dictionaryWordAddress, flag ) {
        return ((this.memory.byteAt(dictionaryWordAddress+this.wordSize())) & flag) !== 0;
    } 
    isHidden(dictionaryWordAddress) {
        return this.hasFlag(dictionaryWordAddress, this.flagHidden());
    }
    isImmediate(dictionaryWordAddress) {
        return this.hasFlag(dictionaryWordAddress, this.flagImmediate());
    }
    isRunning() { return this.state === "running"; }
    labelsFor(index) { 
        return  (Object.entries(this.labels).filter(pair => {
            return pair[1] === index; }).map(pair => { return pair[0] })) 
    }
    lengthByteAt(address) {
        return this.memory.byteAt(address) & this.flagLengthMask();
    }
    makeRunning() { this.state = "running"; }
    noInput() { this.state = "noInput"; }
    emergencyStop() { 
        // na error occured
        this.noInput();
        this.resetBuffers();
        this.memory.resetStack();
        this.memory.resetReturnStack();  
  
    }
    memoryInitializer() { return new ForthStandardMemoryInitializer(this); }
    outputBufferoutputBufferString() { return this.outputBuffer.toByteString(); }
    privComma(value) {
        this.memory.writeWordAt(value, this.varHereValue());
        this.setVarHereValue(this.varHereValue() + this.wordSize());
    }
    privNext() {
        this.pcCurrent = this.memory.wordAt(this.pcNext);
        this.pcNext = this.pcNext + this.wordSize();
        this.pc = this.memory.wordAt(this.pcCurrent)-1;
        // subtract one because the address will be immediately increased
    }
    allowedForBase(asciiCode, base) {
        if (asciiCode === 45) return true;
        if (base <= 10) return (asciiCode >= 48) && (asciiCode <= 48-1+base);
        return ((asciiCode >= 48) && (asciiCode <= 57)) 
            || ((asciiCode >= 65) && (asciiCode <= 65+base-11))
            || ((asciiCode >= 97) && (asciiCode <= 97+base-11))
            || ((asciiCode >= 44) && (asciiCode <= 47)) // ,-
            || (asciiCode === 58)
    }
    isDoubleSeparator(asciiCode) {
         return ((asciiCode >= 44) && (asciiCode <= 47)) // ,-./
            || (asciiCode === 58) // :
    }
    privNumber(wordStringAddress, length) {
        let isDouble = false;
        let base = this.varBaseValue();
        let toParse = [];
        let bytes = this.memory.memoryCopyFromTo(wordStringAddress, wordStringAddress+length-1);
        for (let i = 0; i < bytes.length; i++) {
            let isSeparator = (i > 0 && this.isDoubleSeparator(bytes[i]));
            let allowed = this.allowedForBase(bytes[i], base) || isSeparator; 
            if (!allowed) return [0, i+1];
            if (isSeparator)  isDouble = true;
                else toParse.push(bytes[i]);  
        }
        let anInteger = parseInt(toParse.toByteString(), base);
        if (isDouble) {
            anInteger = anInteger.asUnsigned4Bytes();
        } else 
            anInteger = anInteger.asUnsigned2Bytes();
        
        return [anInteger, 0, isDouble];
    }
    isEndOfLine(asciiCode) { return (asciiCode === 10) || (asciiCode === 9) };
    isSeparator(asciiCode) {
        return (asciiCode === 32) 
            || (asciiCode === 13) 
            || (asciiCode === 12) 
            || this.isEndOfLine(asciiCode) ;
    }
    inputBufferEmpty() { return  this.inputBuffer.length === 0 }
    privWord() {
        let length = 0;
        let charCode;
        do {
            if (this.inputBufferEmpty()) {
                this.noInput();
                typeOk();
                return [this.wordBufferAddress(), 0];
            }
            charCode = this.readInputBuffer();
        } while (this.isSeparator(charCode));
        let atWordEnd;
        do {
            this.memory.memoryAtPut(this.wordBufferAddress()+length, charCode);
            length += 1;
            atWordEnd = this.inputBufferEmpty() ?
                true : this.isSeparator(charCode = this.readInputBuffer())
        } while (!atWordEnd); 
        
        return [this.wordBufferAddress(), length]
    }

    readInputBuffer() {
        if(this.inputBuffer.length === 0) {
            this.noInput();
            return 0;
        }
        return this.inputBuffer.shift();
    }

    run() {
        while (this.state === "running") {
            this.step();
        }
    }
    step() {
        //console.log(this.memory.memoryAt(this.pc))
        //if (this.memory.memoryAt(this.pc).execute === undefined) debugger;
        this.memory.memoryAt(this.pc).execute();
        if (this.isRunning) { this.pc += 1; }
    }

    toggleFlagOf(flag, wordAddress) {
        let flagAddress = wordAddress + this.wordSize();
        this.memory.writeByteAt(this.memory.byteAt(flagAddress) ^ flag, flagAddress);
    }
    uppercase() { return true; }
    varHere() { return this.addressForLabel("var_HERE"); }
    varHereValue() { return this.memory.unsignedWordAt(this.varHere()); }
    setVarHereValue(aValue) { return this.memory.writeWordAt(aValue, this.varHere()); }
 
    varLatest() { return this.addressForLabel("var_LATEST"); }
    varLatestValue() { return this.memory.unsignedWordAt(this.varLatest()); }
    setVarLatestValue(aValue) { return this.memory.writeWordAt(aValue, this.varLatest()); }
 
    varState() { return this.addressForLabel("var_STATE"); }
    varStateValue() { return this.memory.signedWordAt(this.varState()); }
    setVarStateValue(aValue) { return this.memory.writeWordAt(aValue, this.varState()); }
 
    varBase() { return this.addressForLabel("var_BASE"); }
    varBaseValue() { return this.memory.signedWordAt(this.varBase()); }
    setVarBaseValue(aValue) { return this.memory.writeWordAt(aValue, this.varBase()); }

    wordBufferAddress() { return this.addressForLabel("word_buffer") };
    wordBufferSize() { return 32 };
    wordSize() { return 2; }
}

class ForthMemoryInitializer {
    constructor(forth) {
        this.forth = forth;
        this.initPos = 0;
    }
    initializeMemory() { throw new Error("subclassResponsibility"); }
    addCode(aCode) {
        let newPosition = this.initPos;
        let oldPosition = newPosition;
        newPosition = aCode.installAt(newPosition);
        this.initPos = newPosition + 1;
        return oldPosition;        
    }
    install(codeClass) {
        let codeClassInstance = new codeClass(this.forth);
        this.addCode(codeClassInstance);
    }
    installAll(codeClasses) {
        codeClasses.forEach(each => this.install(each));
    }
}

class ForthStandardMemoryInitializer extends ForthMemoryInitializer {
    initializeMemory() {
        this.forth.memory.resetMemory();
        this.addCode(new ForthCodeDoCol(this.forth));
        this.addCode(new ForthCodeNext(this.forth));
        this.addCode(new ForthCodeDoDoes(this.forth));
        this.initializeBasicPrimitives();
        this.initializeComparisonPrimitives();
        this.initializeBitwisePrimitives();
        this.initializeLiteralsPrimitives();
        this.initializeMemoryPrimitives();
        this.initializeExit();
        this.initializeBuitInVarialbes();
        this.initializeBuitInConstants();
        this.initializeReturnStackPrimitives();
        this.initializeDataStackPrimitives();
        this.initializeIOPrimitives();
        this.initializeParsingPrimitives();
        this.initializeDictionaryLookupPrimitives();	
        this.initializeCompilingPrimitives();	
        this.initializeCompilerExtendingPrimitives();
        this.initializeBranchingPrimitives();
        this.initializeStringLiteralsPrimitives();
        this.initializeInterpreterPrimitives();  
        this.forth.setVarLatestValue(this.forth.addressForLabel("name_INTERPRET"));
        this.forth.setVarHereValue(this.initPos);
        this.forth.fixUnknownLabels();      
    };
    initializeBasicPrimitives() { this.installAll([
        ForthCodeDrop,
        ForthCodeSwap,
        ForthCodeDup,
        ForthCodeOver,
        ForthCodeRot,
        ForthCodeNRot,
        ForthCodeTwoDrop,
        ForthCodeTwoDup,
        ForthCodeTwoSwap,
        ForthCodeAbs,
        ForthCodeQDup,
        ForthCodeIncr,
        ForthCodeDecr,
        ForthCodeIncr2,
        ForthCodeDecr2,
        ForthCodeAdd,
        ForthCodeSub,
        ForthCodeMul,
        ForthCodeMMul,
        ForthCodeUMMul,
        ForthCodeDivMod,
        ForthCodeUDivMod,
        ForthCodeMulDivMod,
        ForthCodeFMDivMod,
        ForthCodeLShift,
        ForthCodeRShift
        ]); }
    initializeBitwisePrimitives() { this.installAll([
        ForthCodeAnd,
        ForthCodeOr,
        ForthCodeXor,
        ForthCodeInvert,
        ]); }
    initializeBranchingPrimitives() { this.installAll([
		ForthCodeBranch,
		ForthCodeZBranch
        ]); } 
    initializeBuitInConstants() { 
        this.addCode(new ForthCodeConstant(this.forth, "VERSION", 7));
        this.addCode(new ForthCodeConstant(this.forth, "DOCOL", this.forth.labels["DOCOL"]));
        this.addCode(new ForthCodeConstant(this.forth, "DODOES", this.forth.labels["DODOES"]));
        this.addCode(new ForthCodeConstant(this.forth, "F_LENMASK", this.forth.flagLengthMask()));
        this.addCode(new ForthCodeConstant(this.forth, "F_HIDDEN", this.forth.flagHidden()));
        this.addCode(new ForthCodeConstant(this.forth, "F_IMMED", this.forth.flagImmediate()));
        this.addCode(new ForthCodeConstant(this.forth, "R0", this.forth.memory.r0()));
    } 
    initializeBuitInVarialbes() {
        this.addCode(new ForthCodeVariable(this.forth, "state"));
        this.addCode(new ForthCodeVariable(this.forth, "here"));
        this.addCode(new ForthCodeVariable(this.forth, "latest", 0));
        this.addCode(new ForthCodeVariable(this.forth, "base", 10));
        this.addCode(new ForthCodeVariable(this.forth, "s0", this.forth.memory.s0()));
    } 
    initializeComparisonPrimitives() { this.installAll([
		ForthCodeEqu,
		ForthCodeNEqu,
		ForthCodeLT,
		ForthCodeULT,
		ForthCodeGT,
		ForthCodeLE,
		ForthCodeGE,
		ForthCodeZEqu,
		ForthCodeZNEqu,
		ForthCodeZLT,
		ForthCodeZGT,
		ForthCodeZLE,
		ForthCodeZGE
        ]); } 
    initializeCompilerExtendingPrimitives() { this.installAll([
        ForthCodeImmediate,
        ForthCodeHidden,
        ForthCodeHide,
        ForthCodeTick
        ]); } 
    initializeCompilingPrimitives() { this.installAll([
        ForthCodeCreateHead,
        ForthCodeComma,
        ForthCodeLBrac,
        ForthCodeRBrac,
        ForthCodeColon,
        ForthCodeSemicolon
        ]); }         
    initializeDataStackPrimitives() { this.installAll([
        ForthCodeDSPFetch,
        ForthCodeDSPStore
        ]); }             
    initializeDictionaryLookupPrimitives() { this.installAll([
        ForthCodeFind,
        ForthCodeTCFA,
        ForthCodeTDFA
        ]); }                   
    initializeExit() { this.installAll([
        ForthCodeExit
        ]); }                      
    initializeIOPrimitives() { this.installAll([
        ForthCodeKey,
        ForthCodeEmit,
        ForthCodeTell
    ]); }                          
    initializeInterpreterPrimitives() { this.installAll([
		ForthCodeExecute,
		ForthCodeHalt,
		ForthCodeQuit,
		ForthCodeInterpret
        ]); }                                
    initializeLiteralsPrimitives() { this.installAll([
        ForthCodeLit
        ]); }                                  
    initializeMemoryPrimitives() { this.installAll([
        ForthCodeStore,
        ForthCodeFetch,
        ForthCodeAddStore,
        ForthCodeSubStore,    
        ForthCodeStoreByte,
        ForthCodeFetchByte,
        ForthCodeCCopy,
        ForthCodeCMove
        ]); }                                     
        initializeParsingPrimitives() { this.installAll([
        ForthCodeWord,
        ForthCodeNumber
        ]); }                                           
    initializeDataStackPrimitives() { this.installAll([
        ForthCodeDSPFetch,
        ForthCodeDSPStore
        ]); }     
    initializeReturnStackPrimitives() { this.installAll([
        ForthCodeToR,
        ForthCodeFromR,
        ForthCodeRSPFetch,
        ForthCodeRSPStore,
        ForthCodeRDrop
        ]); }                                               
    initializeStringLiteralsPrimitives() { this.installAll([
        ForthCodeLitString,
        ForthCodeChar
        ]); }                                                 
}

class ForthCode {
    constructor(forth) {
        this.forth = forth;
    }
    execude() { throw new Error("subclassResponsibility") };
    installAt(initialPosition) {
        this.installLabelAt(initialPosition);
        this.forth.memory.memoryAtPut(initialPosition, this);
        return initialPosition;
    }
    installLabelAt(position) {
        this.forth.addLabelAddress(this.label(), position);
    }
    label() { 
        return this.constructor.name.slice("ForthCode".length).toUpperCase(); 
    }
    pushBytes(bytes) { this.forth.memory.push(bytes); }
    push(number) { 
        this.forth.memory.push(number.numberValue().asUnsigned2Bytes()); }
    push2(number) { 
        this.forth.memory.push(number.numberValue().asUnsigned4Bytes()); }
    pop() { return this.forth.memory.pop(); }
    popSigned() { return this.pop().asSigned16(); }
    popSigned32() { return this.forth.memory.pop(4).asSigned32(); }
    popUnsigned() { return this.pop().asUnsigned16(); }
    memory() { return this.forth.memory; }
    true() { return 0xFFFF; }
    false() { return 0; }
    numberValue() { return 0; }
}

class ForthCodeWithHead extends ForthCode {
    codewordFor(position) { return position + this.forth.wordSize(); }
    finishAt(originalPosition) { 
        let newPosition = originalPosition + 1;
        this.forth.addLabelAddress("next_" + this.label, newPosition);
        this.forth.memory.writeCodeAt(new ForthCodeNext(this.forth), newPosition);
        return newPosition;
    }
    flags() { return 0; }
    installAt(initialPosition) { 
        let position = initialPosition;
        let headAddress = position;
        let wordName = this.forth.uppercase() ? this.name().toUpperCase() : this.name();
        this.forth.addLabelAddress("name_" + this.label(), position);
        this.forth.memory.writeWordAt(this.forth.lastWord, position);
        position += this.forth.wordSize();
        this.forth.memory.writeByteAt(wordName.length + this.flags(), position);
        position++;
        wordName.split("").forEach((char, i) => {
            this.forth.memory.writeByteAt(wordName.charCodeAt(i), position + i)
        });
        position += wordName.length;
        this.forth.addLabelAddress(this.label(), position);
        this.forth.addLabelAddress("codeword_" + this.label(), position);
        this.forth.memory.writeWordAt(this.codewordFor(position), position);
        position += this.forth.wordSize();
        this.forth.addLabelAddress("code_" + this.label(), position);
        position = this.writeCodeAt(position);
        position = this.finishAt(position);
        this.forth.lastWord = headAddress;
        return position;
     }
     name() { throw new Error("subclassResponsibility") };
     writeCodeAt(originalPosition) {
        this.forth.addLabelAddress("code_" + this.label(), originalPosition)
        this.forth.memory.writeCodeAt(this, originalPosition);
        return originalPosition;
     }
}

class ForthCodeWithHeadCompiled extends ForthCodeWithHead {
    codewordFor(position) { return this.forth.addressForLabel("DOCOL"); }
    codewordLabels() { throw new Error("subclassResponsibility"); }
    execute() { /* do nothing here */ }
    finishAt(originalPosition) { return originalPosition }
    writeCodeAt(originalPosition) {
        let position = originalPosition;
        this.codewordLabels().forEach(labelOrNumber => {
            if (typeof labelOrNumber === "number") {
                this.forth.memory.writeWordAt(labelOrNumber, position);
            } else {
                let aValue = this.forth.addressForLabelInFutureSet(labelOrNumber, position);
                this.forth.memory.writeWordAt(aValue, position);
            }
            position += this.forth.wordSize();
        });
        return position;
    }
}

class ForthCodeDoCol extends ForthCode {
    execute() {
        this.forth.memory.pushAddressToReturnStack(this.forth.pcNext);
        this.forth.pcCurrent += this.forth.wordSize();  // set to the codeword
        this.forth.pcNext = this.forth.pcCurrent;
    }
}

class ForthCodeDoDoes extends ForthCode {
    execute() {
        this.forth.memory.pushAddressToReturnStack(this.forth.pcNext);
        let refAddress = this.forth.pcCurrent + this.forth.wordSize(); 
        let aPFA = refAddress + this.forth.wordSize();
        let codeAddress = this.forth.memory.memoryCopyFromTo(refAddress, refAddress+1).asUnsigned16();
        let codewordAddress = this.forth.memory.memoryCopyFromTo(codeAddress, codeAddress+1).asUnsigned16();
        this.forth.pcCurrent = codeAddress ; 
        this.forth.pcNext = this.forth.pcCurrent;
        this.forth.memory.push(aPFA.asUnsigned2Bytes());
        this.forth.privNext();
    }
}

class ForthCodeNext extends ForthCode {
    execute() {
        this.forth.privNext();
    }
}

// Basic primitves

class ForthCodeAdd extends ForthCodeWithHead {
    name() { return "+"; }
    execute() {
        this.push(this.popSigned() + this.popSigned());
    }
}

class ForthCodeChar extends ForthCodeWithHead {
    name() { return "char"; }
    execute() {
        let addressAndLength = this.forth.privWord();
        if (!this.forth.isRunning()) return;
        this.push(this.forth.memory.byteAt(addressAndLength[0]));
    }
}

class ForthCodeDecr extends ForthCodeWithHead {
    name() { return "1-"; }
    execute() {
        this.push(this.popSigned() - 1);
    }
}

class ForthCodeDecr2 extends ForthCodeWithHead {
    name() { return "2-"; }
    execute() {
        this.push(this.popSigned() - 2);
    }
}

class ForthCodeDivMod extends ForthCodeWithHead {
    name() { return "/mod"; }
    execute() {
        let b = this.popSigned();
        let a = this.popSigned();
        this.push(a % b);
        this.push(Math.floor(a / b));
    }
}

class ForthCodeUDivMod extends ForthCodeWithHead {
    name() { return "u/mod"; }
    execute() {
        let b = this.popUnsigned();
        let a = this.popUnsigned();
        this.push(a % b);
        this.push(Math.floor(a / b));
    }
}

class ForthCodeMulDivMod extends ForthCodeWithHead {
    name() { return "*/mod"; }
    execute() {
        let c = this.popSigned();
        let b = this.popSigned();
        let a = this.popSigned();
        let mul = a * b;
        let div = Math.floor(mul / c);
        this.push(mul - (div * c ));
        this.push(div);
    }
}

class ForthCodeFMDivMod extends ForthCodeWithHead {
    name() { return "fm/mod"; }
    execute() {
        let b = this.popSigned();
        let a = this.popSigned32();
        let div = Math.floor(a / b);
        this.push(a - (div * b));
        this.push(div);
    }
}

class ForthCodeLShift extends ForthCodeWithHead {
    name() { return "lshift"; }
    execute() {
        let b = this.popUnsigned();
        let a = this.popUnsigned();
        this.push((a << b).asUnsigned16());
    }
}

class ForthCodeRShift extends ForthCodeWithHead {
    name() { return "rshift"; }
    execute() {
        let b = this.popUnsigned();
        let a = this.popUnsigned();
        this.push((a >> b).asUnsigned16());
    }
}

class ForthCodeDrop extends ForthCodeWithHead {
    constructor(forth) { return super(forth); }
    name() { return "drop"; }
    execute() {
        this.popSigned();
    }
}

class ForthCodeDup extends ForthCodeWithHead {
    name() { return "dup"; }
    execute() {
        this.forth.memory.push(this.forth.memory.peek());
    }
}

class ForthCodeIncr extends ForthCodeWithHead {
    name() { return "1+"; }
    execute() {
        this.push(this.popSigned() + 1);
    }
}

class ForthCodeIncr2 extends ForthCodeWithHead {
    name() { return "2+"; }
    execute() {
        this.push(this.popSigned() + 2);
    }
}

class ForthCodeMul extends ForthCodeWithHead {
    name() { return "*"; }
    execute() {
        this.push(this.popSigned() * this.popSigned());
    }
}

class ForthCodeMMul extends ForthCodeWithHead {
    name() { return "M*"; }
    execute() {
        this.push2(this.popSigned() * this.popSigned());
    }
}

class ForthCodeUMMul extends ForthCodeWithHead {
    name() { return "UM*"; }
    execute() {
        this.push2(this.popUnsigned() * this.popUnsigned());
    }
}

class ForthCodeNRot extends ForthCodeWithHead {
    name() { return "-rot"; }
    execute() {
        let a = this.popSigned();
        let b = this.popSigned();
        let c = this.popSigned();
        this.push(a);
        this.push(c);
        this.push(b);
    }
}

class ForthCodeOver extends ForthCodeWithHead {
    name() { return "over"; }
    execute() {
        this.pushBytes(this.forth.memory.memoryCopyFromTo(this.forth.memory.dsp+2, this.forth.memory.dsp+3));
    }
}

class ForthCodeQDup extends ForthCodeWithHead {
    name() { return "?dup"; }
    execute() {
        let peekBytes = this.forth.memory.peek();
        if ((peekBytes.asSigned16() !== 0))
            this.pushBytes(peekBytes);
     }
}

class ForthCodeRot extends ForthCodeWithHead {
    name() { return "rot"; }
    execute() {
        let a = this.popSigned();
        let b = this.popSigned();
        let c = this.popSigned();
        this.push(b);
        this.push(a);
        this.push(c);
    }
}

class ForthCodeSub extends ForthCodeWithHead {
    name() { return "-"; }
    execute() {
        let a = this.popSigned();
        this.push(this.popSigned() - a);
    }
}

class ForthCodeSwap extends ForthCodeWithHead {
    name() { return "swap"; }
    execute() {
        let a = this.popSigned();
        let b = this.popSigned();
        this.push(a);
        this.push(b);
    }
}

class ForthCodeTwoDrop extends ForthCodeWithHead {
    name() { return "2drop"; }
    execute() {
        this.memory().pop(4);
    }
}

class ForthCodeTwoDup extends ForthCodeWithHead {
    name() { return "2dup"; }
    execute() {
        let a = this.memory().memoryCopyFromTo(this.memory().dsp+2, this.memory().dsp+3);
        let b = this.memory().memoryCopyFromTo(this.memory().dsp+0, this.memory().dsp+1);
        this.pushBytes(a);
        this.pushBytes(b);
    }
}

class ForthCodeTwoSwap extends ForthCodeWithHead {
    name() { return "2swap"; }
    execute() {
        let a = this.popSigned();
        let b = this.popSigned();
        let c = this.popSigned();
        let d = this.popSigned();
        this.push(b);
        this.push(a);
        this.push(d);
        this.push(c);
    }
}

class ForthCodeAbs extends ForthCodeWithHead {
    name() { return "abs"; }
    execute() {
        this.push(Math.abs(this.popSigned()));
    }
}

// Bitwise primitives

class ForthCodeAnd extends ForthCodeWithHead {
    name() { return "and"; }
    execute() {
        let a = this.popSigned();
        let b = this.popSigned();
        this.push(a & b);
    }
}

class ForthCodeInvert extends ForthCodeWithHead {
    name() { return "invert"; }
    execute() {

        let a = this.popUnsigned();
        this.push(~a);
    }
}

class ForthCodeOr extends ForthCodeWithHead {
    name() { return "or"; }
    execute() {
        let a = this.popSigned();
        let b = this.popSigned();
        this.push(a | b);
    }
}

class ForthCodeXor extends ForthCodeWithHead {
    name() { return "xor"; }
    execute() {
        let a = this.popSigned();
        let b = this.popSigned();
        this.push(a ^ b);
    }
}

// Branching primitives

class ForthCodeBranch extends ForthCodeWithHead {
    name() { return "branch"; }
    execute() {
        this.forth.pcNext += this.memory().signedWordAt(this.forth.pcNext);
    }
}

class ForthCodeZBranch extends ForthCodeWithHead {
    name() { return "0branch"; }
    execute() {
        let value = this.popSigned();
        if (value === 0) {
            this.forth.pcNext += this.memory().signedWordAt(this.forth.pcNext);  
        } else {
            this.forth.pcCurrent = this.memory().wordAt(this.forth.pcNext);
            this.forth.pcNext += this.forth.wordSize();
        }
    }
}

// Comparison primitives

class ForthCodeEqu extends ForthCodeWithHead {
    name() { return "="; }
    execute() {
        let b = this.popSigned();
        let a = this.popSigned();
        this.push(a === b ? this.true() : this.false());
    }
}

class ForthCodeGE extends ForthCodeWithHead {
    name() { return ">="; }
    execute() {
        let b = this.popSigned();
        let a = this.popSigned();
        this.push(a >= b ? this.true() : this.false());
    }
}

class ForthCodeGT extends ForthCodeWithHead {
    name() { return ">"; }
    execute() {
        let b = this.popSigned();
        let a = this.popSigned();
        this.push(a > b ? this.true() : this.false());
    }
}

class ForthCodeLE extends ForthCodeWithHead {
    name() { return "<="; }
    execute() {
        let b = this.popSigned();
        let a = this.popSigned();
        this.push(a <= b ? this.true() : this.false());
    }
}

class ForthCodeLT extends ForthCodeWithHead {
    name() { return "<"; }
    execute() {
        let b = this.popSigned();
        let a = this.popSigned();
        this.push(a < b ? this.true() : this.false());
    }
}

class ForthCodeULT extends ForthCodeWithHead {
    name() { return "U<"; }
    execute() {
        let b = this.popUnsigned();
        let a = this.popUnsigned();
        this.push(a < b ? this.true() : this.false());
    }
}

class ForthCodeNEqu extends ForthCodeWithHead {
    name() { return "<>"; }
    execute() {
        let b = this.popSigned();
        let a = this.popSigned();
        this.push(a === b ? this.false() : this.true());
    }
}

class ForthCodeZEqu extends ForthCodeWithHead {
    name() { return "0="; }
    execute() {
        this.push(this.popSigned() === 0 ? this.true() : this.false());
    }
}

class ForthCodeZGE extends ForthCodeWithHead {
    name() { return "0>="; }
    execute() {
        this.push(this.popSigned() >= 0 ?this.true() : this.false());
    }
}

class ForthCodeZLE extends ForthCodeWithHead {
    name() { return "0<="; }
    execute() {
        this.push(this.popSigned() <= 0 ?this.true() : this.false());
    }
}

class ForthCodeZGT extends ForthCodeWithHead {
    name() { return "0>"; }
    execute() {
        this.push(this.popSigned() > 0 ? this.true() : this.false());
    }
}

class ForthCodeZLT extends ForthCodeWithHead {
    name() { return "0<"; }
    execute() {
        this.push(this.popSigned() < 0 ? this.true() : this.false());
    }
}

class ForthCodeZNEqu extends ForthCodeWithHead {
    name() { return "0<>"; }
    execute() {
        this.push(this.popSigned() !== 0 ? this.true() : this.false());
    }
}

// Compiler extenting primitives

class ForthCodeHidden extends ForthCodeWithHead {
    name() { return "hidden"; }
    execute() {
        let entry = this.popUnsigned();
        this.forth.toggleFlagOf(this.forth.flagHidden(), entry)
    }
}

class ForthCodeHide extends ForthCodeWithHeadCompiled {
    name() { return "hide"; }
    codewordLabels() { return ["WORD", "FIND", "HIDDEN", "EXIT"]}
}

class ForthCodeImmediate extends ForthCodeWithHead {
    name() { return "immediate"; }
    flags() { return this.forth.flagImmediate(); }
    execute() {
        this.forth.toggleFlagOf(this.forth.flagImmediate(), this.forth.varLatestValue()); 
    }
}

class ForthCodeTick extends ForthCodeWithHead {
    name() { return "'"; }
    execute() {
        this.forth.pcCurrent = this.memory().wordAt(this.forth.pcNext);
        this.forth.pcNext += this.forth.wordSize();
        this.push(this.forth.pcCurrent);
    }
}

// Compiling primitives

class ForthCodeColon extends ForthCodeWithHeadCompiled {
    name() { return ":"; }
    codewordLabels() { return ["WORD", "CREATEHEAD", "LIT", "DOCOL", "COMMA", "LATEST", "FETCH", "HIDDEN", "RBRAC", "EXIT"]}
}

class ForthCodeComma extends ForthCodeWithHead {
    name() { return ","; }
    execute() {
        this.forth.privComma(this.popSigned());
    }
}

class ForthCodeCreateHead extends ForthCodeWithHead {
    name() { return "createhead"; }
    execute() {
        let length = this.popSigned();
        let nameAddress = this.popUnsigned();
        let header = this.forth.varHereValue();
        let latest = this.forth.varLatestValue();
        this.memory().writeWordAt(latest, header);
        this.memory().writeByteAt(length, header + this.forth.wordSize());
        for (let i=1; i<=length; i++)
            this.memory().writeByteAt(this.memory().byteAt(nameAddress+i-1), header + this.forth.wordSize() + i)
        this.forth.setVarLatestValue(header);
        this.forth.setVarHereValue(header + this.forth.wordSize() + length + 1) 
    }
}

class ForthCodeLBrac extends ForthCodeWithHead {
    name() { return "["; }
    flags() { return this.forth.flagImmediate(); }
    execute() {
        this.forth.setVarStateValue(this.false());
    }
}

class ForthCodeRBrac extends ForthCodeWithHead {
    name() { return "]"; }
    flags() { return this.forth.flagImmediate(); }
    execute() {
        this.forth.setVarStateValue(this.true());
    }
}

class ForthCodeSemicolon extends ForthCodeWithHeadCompiled {
    name() { return ";"; }
    flags() { return this.forth.flagImmediate(); }
    codewordLabels() { return ["LIT", "EXIT", "COMMA", "LATEST", "FETCH", "HIDDEN", "LBRAC", "EXIT"]}
}

// Data stack primitives

class ForthCodeDSPFetch extends ForthCodeWithHead {
    name() { return "dsp@"; }
    execute() {
        this.push(this.memory().dsp);
    }
}

class ForthCodeDSPStore extends ForthCodeWithHead {
    name() { return "dsp!"; }
    execute() {
        this.memory().dsp = this.popUnsigned();
    }
}

// Dictionary lookup primitives

class ForthCodeFind extends ForthCodeWithHead {
    name() { return "find"; }
    execute() {
        let length = this.popSigned();
        let address = this.popUnsigned();
        let toFind = this.memory().memoryCopyFromTo(address, address+length-1);
        this.push(this.forth.find(toFind))
    }
}

class ForthCodeTCFA extends ForthCodeWithHead {
    name() { return ">cfa"; }
    execute() {
        let wordAddress = this.popUnsigned();
        this.push(this.forth.codewordOf(wordAddress))
    }
}

class ForthCodeTDFA extends ForthCodeWithHead {
    name() { return ">dfa"; }
    execute() {
        let wordAddress = this.popUnsigned();
        this.push(this.forth.codewordOf(wordAddress) + this.forth.wordSize());
    }
}

// Exit primitive

class ForthCodeExit extends ForthCodeWithHead {
    name() { return "exit"; }
    execute() {
        this.forth.pcNext = this.memory().popFromReturnStack().asUnsigned16();
    }
}

// I/O primitive

class ForthCodeEmit extends ForthCodeWithHead {
    name() { return "emit"; }
    execute() {
        let charCode = this.popSigned();
        typeCharacter(charCode);
        this.forth.outputBuffer.push(charCode);
    }
}

class ForthCodeTell extends ForthCodeWithHead {
    name() { return "tell"; }
    execute() {
        let length = this.popSigned();
        let address = this.popUnsigned();
        let text = this.forth.memory.memoryCopyFromTo(address, address + length - 1);
        for (let i = 0; i < length; i++)
            typeCharacter(text[i]);
        this.forth.outputBuffer.push(text);
    }
}

class ForthCodeKey extends ForthCodeWithHead {
    name() { return "key"; }
    execute() {
        let input = this.forth.readInputBuffer();
        if (this.forth.isRunning()) this.push(input);
    }
}

// Interpreter primitves

class ForthCodeExecute extends ForthCodeWithHead {
    name() { return "execute"; }
    finishAt(originalPosition) { 
        return originalPosition + 1; 
    }
    execute() {
        this.forth.pcCurrent = this.popUnsigned();
        this.forth.pc = this.memory().wordAt(this.forth.pcCurrent) - 1;
    }
}

class ForthCodeHalt extends ForthCodeWithHead {
    name() { return "halt"; }
    execute() {
        debugger;
    }
}

class ForthCodeInterpret extends ForthCodeWithHead {
    name() { return "interpret"; }
    execute() {
        let interpretIsLit = false;
        let executeImmediate = false;
        let addressLengthPair = this.forth.privWord();
        let address = addressLengthPair[0];
        let length = addressLengthPair[1];
        if (length === 0) return;
        let aCodeword = 0;
        let toFind = this.memory().memoryCopyFromTo(address, address + length - 1);
        let resultOfFind = this.forth.find(toFind);
        let numberErrorPair = [0, 0];
        if (resultOfFind === 0) {
            "not in the dictionary (not a word) so assume it's a literal number"
            interpretIsLit = true;
            numberErrorPair = this.forth.privNumber(address, length);
            if (numberErrorPair[1] === 0) {
                interpretIsLit = true;
                aCodeword = this.forth.addressForLabel('codeword_LIT');
            } else {
                typeError("Unknown word: " + toFind.toByteString());
                this.forth.emergencyStop();
                return;
            }         
        } else {
            aCodeword = this.forth.codewordOf(resultOfFind);
            this.forth.pcCurrent = aCodeword;
            if (this.forth.isImmediate(resultOfFind))
                executeImmediate = true;
        }
        if ((this.forth.varStateValue() === 0) || executeImmediate) {
            if (interpretIsLit) {
                    this.memory().push(numberErrorPair[0]);
                    this.forth.privNext(); 
                } else { 
                    this.forth.pc = this.memory().wordAt(aCodeword) - 1;    
            } 
        } else {
            this.forth.privComma(aCodeword);
            if (interpretIsLit) 
                this.forth.privComma(numberErrorPair[0]);
            this.privNex;
        }
    }
}

class ForthCodeQuit extends ForthCodeWithHeadCompiled {
    name() { return "quit"; }
    flags() { return this.forth.flagImmediate(); }
    codewordLabels() { return ["INTERPRET", "BRANCH", -4 ]}
}

// Literal primitives

class ForthCodeLit extends ForthCodeWithHead {
    name() { return "lit"; }
    execute() {
        let value = this.memory().wordAt(this.forth.pcNext);
        this.forth.pcCurrent = this.forth.pcNext;
        this.forth.pcNext += this.forth.wordSize();
        this.push(value);
    }
}

// Memory primitives

class ForthCodeAddStore extends ForthCodeWithHead {
    name() { return "+!"; }
    execute() {
        let address = this.popUnsigned();
        let increment = this.popSigned();
        this.memory().writeWordAt(this.memory().signedWordAt(address)+increment, address);
    }
}

class ForthCodeCCopy extends ForthCodeWithHead {
    name() { return "c@c!"; }
    execute() {
        throw new Error("shouldBeImplemented");
    }
}

class ForthCodeCMove extends ForthCodeWithHead {
    name() { return "cmove"; }
    execute() {
        let length = this.popUnsigned();
        let destination = this.popUnsigned();
        let source = this.popUnsigned();
        for (let i = 0; i < length; i++)
        {
            this.forth.memory.memoryAtPut(destination + i, this.forth.memory.memoryAt(source + i))
        }
     }
}

class ForthCodeFetch extends ForthCodeWithHead {
    name() { return "@"; }
    execute() {
        let address = this.popUnsigned();
        this.push(this.memory().signedWordAt(address))
    }
}

class ForthCodeFetchByte extends ForthCodeWithHead {
    name() { return "c@"; }
    execute() {
        let address = this.popUnsigned();
        this.push(this.memory().byteAt(address))
    }
}

class ForthCodeStore extends ForthCodeWithHead {
    name() { return "!"; }
    execute() {
        let address = this.popUnsigned();
        let value = this.popSigned();
        this.memory().writeWordAt(value, address);
    }
}

class ForthCodeStoreByte extends ForthCodeWithHead {
    name() { return "c!"; }
    execute() {
        let address = this.popUnsigned();
        let value = this.popSigned();
        this.memory().writeByteAt(value & 0xFF, address);
    }
}

class ForthCodeSubStore extends ForthCodeWithHead {
    name() { return "-!"; }
    execute() {
        let address = this.popUnsigned();
        let decrement = this.popSigned();
        this.memory().writeWordAt(this.memory().signedWordAt(address)-decrement, address);
    }
}

// Parsing primitives

class ForthCodeNumber extends ForthCodeWithHead {
    name() { return "number"; }
    execute() {
        let length = this.popSigned();
        let wordStringAddress = this.popUnsigned();
        let numberErrorPair = this.forth.privNumber(wordStringAddress, length);
        this.memory().push(numberErrorPair[0]);
        this.push(numberErrorPair[1]); // error character index
    }
}

class ForthCodeWord extends ForthCodeWithHead {
    name() { return "word"; }
    finishAt(initialPosition) {
        let newPosition = super.finishAt(initialPosition);
        newPosition++;
        this.forth.addLabelAddress("word_buffer", newPosition);
        this.bufferAddress = newPosition;
        return newPosition + this.forth.wordBufferSize();
    }
    execute() {
        let addressLengthPair = this.forth.privWord();
        if (!this.forth.isRunning()) return;
        this.push(addressLengthPair[0]);
        this.push(addressLengthPair[1]);
    }
}

// Return stack primitives

class ForthCodeFromR extends ForthCodeWithHead {
    name() { return "r>"; }
    execute() {
        this.pushBytes(this.memory().popFromReturnStack());
    }
}

class ForthCodeRDrop extends ForthCodeWithHead {
    name() { return "rdrop"; }
    execute() {
        this.memory().popFromReturnStack();
    }
}

class ForthCodeRSPFetch extends ForthCodeWithHead {
    name() { return "rsp@"; }
    execute() {
        this.push(this.memory().rsp);
    }
}

class ForthCodeRSPStore extends ForthCodeWithHead {
    name() { return "rsp!"; }
    execute() {
        this.memory().rsp = this.popUnsigned();
    }
}

class ForthCodeToR extends ForthCodeWithHead {
    name() { return ">r"; }
    execute() {
        this.memory().returnStackPush(this.memory().pop());
    }
}

// String literals primitives

class ForthCodeLitString extends ForthCodeWithHead {
    name() { return "litstring"; }
    execute() {
        this.forth.pcCurrent = this.memory().wordAt(this.forth.pcNext);
        this.forth.pcNext += this.forth.wordSize();
        this.push(this.forth.pcNext);
        this.push(this.forth.pcCurrent);
        this.forth.pcNext += this.forth.pcCurrent;
    }
}

class ForthCodeLitTell extends ForthCodeWithHead {
    name() { return "tell"; }
    execute() {
        let length = this.popSigned();
        let address = this.popUnsinged();
        let text = this.memory().memoryCopyFromTo(address, address + length - 1);
        this.forth.outputBuffer.push(...text);
    }
}

// Variables primitives

class ForthCodeConstant extends ForthCodeWithHead {
    constructor(forth, name, value) {
        super(forth);
        this.constantName = name;
        this.value = value;
    }
    name() { return this.constantName }
    execute() {
        this.push(this.value)
    }
}

class ForthCodeVariable extends ForthCodeWithHead {
    constructor(forth, name, initialValue = 0) {
        super(forth);
        this.varName = name;
        this.initialValue = initialValue;
        this.address = 0;
    }
    name() { return this.varName };
    label() { return this.name().toUpperCase(); }
    execute() {
        this.push(this.address)
    }
    finishAt(initialPosition) {
        let newPosition = super.finishAt(initialPosition);
        newPosition++;
        this.forth.addLabelAddress("var_"+this.label(), newPosition);
        this.memory().writeWordAt(this.initialValue, newPosition);
        this.address = newPosition;
        newPosition += this.forth.wordSize();
        return newPosition;
    }
}


function run() {

let val;
let forth = new Forth();

window.forth = forth;
forth.init();
forth.input(`

: / /MOD SWAP DROP ;
: MOD /MOD DROP ;

: U/ U/MOD SWAP DROP ;

: 2* 2 * ;
: 2/ 2 / ;

: '\\n' 13 ;
: BL   32 ; 
: CR '\\n' EMIT ;
: SPACE BL EMIT ;
: NEGATE 0 SWAP - ;
: TRUE  -1 ;
: FALSE 0 ;
: NOT   0= ;

: LITERAL IMMEDIATE
    ' LIT , , ;

: ':'
	[	
	CHAR :
	]
	LITERAL	
;

: ';' [ CHAR ; ] LITERAL ;
: '(' [ CHAR ( ] LITERAL ;
: ')' [ CHAR ) ] LITERAL ;
: '"' [ CHAR " ] LITERAL ;
: 'A' [ CHAR A ] LITERAL ;
: '0' [ CHAR 0 ] LITERAL ;
: '-' [ CHAR - ] LITERAL ;
: '.' [ CHAR . ] LITERAL ;


: [COMPILE] IMMEDIATE
	WORD	
	FIND	
	>CFA	
	,	
;

: RECURSE IMMEDIATE
	LATEST @	
	>CFA
	,
;

: IF IMMEDIATE
	' 0BRANCH ,
	HERE @
	0 ,
;

: THEN IMMEDIATE
	DUP
	HERE @ SWAP -
	SWAP !
;

: ELSE IMMEDIATE
	' BRANCH ,	
	HERE @	
	0 ,		
	SWAP	
	DUP		
	HERE @ SWAP -
	SWAP !
;

: BEGIN IMMEDIATE
	HERE @	
;

: UNTIL IMMEDIATE
	' 0BRANCH ,	
	HERE @ -
	,
;

: AGAIN IMMEDIATE
	' BRANCH ,
	HERE @ -
	,
;

: WHILE IMMEDIATE
	' 0BRANCH ,
	HERE @	
	0 ,
;

: REPEAT IMMEDIATE
	' BRANCH ,	
	SWAP	
	HERE @ - ,	
	DUP
	HERE @ SWAP -	
	SWAP !		
;

: UNLESS IMMEDIATE
	' NOT ,	
	[COMPILE] IF
;

: ( IMMEDIATE
	1		
	BEGIN
		KEY		
		DUP '(' = IF	
			DROP	
			1+		
		ELSE
			')' = IF	
				1-		
			THEN
		THEN
	DUP 0= UNTIL	
	DROP	
;
(
    From now on we can use ( ... ) for comments.
)

: NIP ( x y -- y ) SWAP DROP ;
: TUCK ( x y -- y x y ) SWAP OVER ;
: PICK ( x_u ... x_1 x_0 u -- x_u ... x_1 x_0 x_u )
	1+		( add one because of 'u' on the stack )
	2 *		( multiply by the word size )
	DSP@ +		( add to the stack pointer )
	@    		( and fetch )
;

: SPACES	( n -- )
	BEGIN
		DUP 0>		( while n > 0 )
	WHILE
		SPACE		( print a space )
		1-		( until we count down to 0 )
	REPEAT
	DROP
;

( Standard words for manipulating BASE. )
: BINARY  ( -- )  2 BASE ! ;
: OCTAL   ( -- )  8 BASE ! ;
: DECIMAL ( -- ) 10 BASE ! ;
: HEX     ( -- ) 16 BASE ! ;

( This is the underlying recursive definition of U. )
: U.		( u -- )
	BASE @ U/MOD	( width rem quot )
    ?DUP IF			( if quotient <> 0 then )
		RECURSE		( print the quotient )
	THEN

	( print the remainder )
	DUP 10 < IF
		'0'		( decimal digits 0..9 )
	ELSE
		10 -		( hex and beyond digits A..Z )
		'A'
	THEN
	+
	EMIT
;

: .S		( -- )
	DSP@		( get current stack pointer )
	BEGIN
		DUP S0 @ <
	WHILE
		DUP @ U.	( print the stack element )
		SPACE
		2+		( move up )
	REPEAT
	DROP
;

: UWIDTH	( u -- width )
	BASE @ U/	( rem quot )
	?DUP IF		( if quotient <> 0 then )
		RECURSE 1+	( return 1+recursive call )
	ELSE
		1		( return 1 )
	THEN
;

: U.R		( u width -- )
	SWAP		( width u )
	DUP		( width u u )
	UWIDTH		( width u uwidth )
	ROT		( u uwidth width )
	SWAP -		( u width-uwidth )
	( At this point if the requested width is narrower, we'll have a negative number on the stack.
	  Otherwise the number on the stack is the number of spaces to print.  But SPACES won't print
	  a negative number of spaces anyway, so it's now safe to call SPACES ... )
	SPACES
	( ... and then call the underlying implementation of U. )
	U.
;

: .R		( n width -- )
	SWAP		( width n )
	DUP 0< IF
		NEGATE		( width u )
		1		( save a flag to remember that it was negative | width n 1 )
		SWAP		( width 1 u )
		ROT		( 1 u width )
		1-		( 1 u width-1 )
	ELSE
		0		( width u 0 )
		SWAP		( width 0 u )
		ROT		( 0 u width )
	THEN
	SWAP		( flag width u )
	DUP		( flag width u u )
    UWIDTH		( flag width u uwidth ) 
 	ROT		( flag u uwidth width )
	SWAP -		( flag u width-uwidth )

	SPACES		( flag u )
	SWAP		( u flag )

	IF			( was it negative? print the - character )
		'-' EMIT
	THEN

	U.
;

: . 0 .R SPACE ;
: U. U. SPACE ;

: ? ( addr -- ) @ . ;

: WITHIN
	-ROT		( b c a )
	OVER		( b c a c )
	<= IF
		> IF		( b c -- )
			TRUE
		ELSE
			FALSE
		THEN
	ELSE
		2DROP		( b c -- )
		FALSE
	THEN
;

: DEPTH		( -- n )
	S0 @ DSP@ -
	2- 2 U/			( adjust because S0 was on the stack when we pushed DSP )
;

: ALIGNED	( addr -- addr )
   ( 1 U+ [ BINARY ] 1111111111111110 [ DECIMAL ] AND )
;

: ALIGN HERE @ ALIGNED HERE ! ;

: C,
	HERE @ C!	( store the character in the compiled image )
	1 HERE +!	( increment HERE pointer by 1 byte )
;

: S" IMMEDIATE		( -- addr len )
	STATE @ IF	( compiling? )
		' LITSTRING ,	( compile LITSTRING )
		HERE @		( save the address of the length word on the stack )
		0 ,		( dummy length - we don't know what it is yet )
		BEGIN
			KEY 		( get next character of the string )
			DUP '"' <>
		WHILE
			C,		( copy character )
		REPEAT
		DROP		( drop the double quote character at the end )
		DUP		( get the saved address of the length word )
		HERE @ SWAP -	( calculate the length )
		2-		( subtract 2 (because we measured from the start of the length word) )
		SWAP !		( and back-fill the length location )
		 ALIGN		( round up to next multiple of 2 bytes for the remaining code )
	ELSE		( immediate mode )
		HERE @		( get the start address of the temporary space )
		BEGIN
			KEY
			DUP '"' <>
		WHILE
			OVER C!		( save next character )
			1+		( increment address )
		REPEAT
		DROP		( drop the final " character )
		HERE @ -	( calculate the length )
		HERE @		( push the start address )
		SWAP 		( addr len )
	THEN
;

: ." IMMEDIATE		( -- )
	STATE @ IF	( compiling? )
		[COMPILE] S"	( read the string, and compile LITSTRING, etc. )
		' TELL ,	( compile the final TELL )
	ELSE
		( In immediate mode, just read characters and print them until we get
		  to the ending double quote. )
		BEGIN
			KEY
			DUP '"' = IF
				DROP	( drop the double quote character )
				EXIT	( return from this function )
			THEN
			EMIT
		AGAIN
	THEN
;

: CONSTANT
	WORD		( get the name (the name follows CONSTANT) )
	CREATEHEAD  ( make the dictionary entry )
	DOCOL ,		( append DOCOL (the codeword field of this word) )
	' LIT ,		( append the codeword LIT )
	,		( append the value on the top of the stack )
	' EXIT ,	( append the codeword EXIT )
;



: ALLOT		( n -- addr )
	HERE @ SWAP	( here n )
	HERE +!		( adds n to HERE, after this the old value of HERE is still on the stack )
;

: CELLS ( n -- n ) 2 * ;

: VARIABLE
	1 CELLS ALLOT	( allocate 1 cell of memory, push the pointer to this memory )
	WORD CREATEHEAD	( make the dictionary entry (the name follows VARIABLE) )
	DOCOL ,		( append DOCOL (the codeword field of this word) )
	' LIT ,		( append the codeword LIT )
	,		( append the pointer to the new memory )
	' EXIT ,	( append the codeword EXIT )
;

: VALUE		( n -- )
	WORD CREATEHEAD	( make the dictionary entry (the name follows VALUE) )
	DOCOL ,		( append DOCOL )
	' LIT ,		( append the codeword LIT )
	,		( append the initial value )
	' EXIT ,	( append the codeword EXIT )
;

: TO IMMEDIATE	( n -- )
	WORD		( get the name of the value )
	FIND		( look it up in the dictionary )
	>DFA		( get a pointer to the first data field (the 'LIT') )
	2+		( increment to point at the value )
	STATE @ IF	( compiling? )
		' LIT ,		( compile LIT )
		,		( compile the address of the value )
		' ! ,		( compile ! )
	ELSE		( immediate mode )
		!		( update it straightaway )
	THEN
;

: +TO IMMEDIATE
	WORD		( get the name of the value )
	FIND		( look it up in the dictionary )
	>DFA		( get a pointer to the first data field (the 'LIT') )
	2+		( increment to point at the value )
	STATE @ IF	( compiling? )
		' LIT ,		( compile LIT )
		,		( compile the address of the value )
		' +! ,		( compile +! )
	ELSE		( immediate mode )
		+!		( update it straightaway )
	THEN
;

: ID.
	2+		( skip over the link pointer )
	DUP C@		( get the flags/length byte )
	F_LENMASK AND	( mask out the flags - just want the length )

	BEGIN
		DUP 0>		( length > 0? )
	WHILE
		SWAP 1+		( addr len -- len addr+1 )
		DUP C@		( len addr -- len addr char | get the next character)
		EMIT		( len addr char -- len addr | and print it)
		SWAP 1-		( len addr -- addr len-1    | subtract one from length )
	REPEAT
	2DROP		( len addr -- )
;

: ?HIDDEN
	2+		( skip over the link pointer )
	C@		( get the flags/length byte )
	F_HIDDEN AND	( mask the F_HIDDEN flag and return it (as a truth value) )
;
: ?IMMEDIATE
	2+		( skip over the link pointer )
	C@		( get the flags/length byte )
	F_IMMED AND	( mask the F_IMMED flag and return it (as a truth value) )
;

: WORDS
	LATEST @	( start at LATEST dictionary entry )
	BEGIN
		?DUP		( while link pointer is not null )
	WHILE
		DUP ?HIDDEN NOT IF	( ignore hidden words )
			DUP ID.		( but if not hidden, print the word )
			SPACE
		THEN
		@		( dereference the link pointer - go to previous word )
	REPEAT
	CR
;

: FORGET
	WORD FIND	( find the word, gets the dictionary entry address )
	DUP @ LATEST !	( set LATEST to point to the previous word )
	HERE !		( and store HERE with the dictionary address )
;

: DUMP		( addr len -- )
    CR
	BASE @ -ROT		( save the current BASE at the bottom of the stack )
	HEX			( and switch to hexadecimal mode )

	BEGIN
		?DUP		( while len > 0 )
	WHILE
		OVER 4 U.R	( print the address )
		SPACE

		( print up to 16 words on this line )
		2DUP		( addr len addr len )
		1- 15 AND 1+	( addr len addr linelen )
		BEGIN
			?DUP		( while linelen > 0 )
		WHILE
			SWAP		( addr len linelen addr )
			DUP C@		( addr len linelen addr byte )
			2 .R SPACE	( print the byte )
			1+ SWAP 1-	( addr len linelen addr -- addr len addr+1 linelen-1 )
		REPEAT
		DROP		( addr len )

		( print the ASCII equivalents )
		2DUP 1- 15 AND 1+ ( addr len addr linelen )
		BEGIN
			?DUP		( while linelen > 0)
		WHILE
			SWAP		( addr len linelen addr )
			DUP C@		( addr len linelen addr byte )
			DUP 32 128 WITHIN IF	( 32 <= c < 128? )
				EMIT
			ELSE
				DROP '.' EMIT
			THEN
			1+ SWAP 1-	( addr len linelen addr -- addr len addr+1 linelen-1 )
		REPEAT
		DROP		( addr len )
		CR

		DUP 1- 15 AND 1+ ( addr len linelen )
		TUCK		( addr linelen len linelen )
		-		( addr linelen len-linelen )
		>R + R>		( addr+linelen len-linelen )
	REPEAT

	DROP			( restore stack )
	BASE !			( restore saved BASE )
;

: CASE IMMEDIATE
	0		( push 0 to mark the bottom of the stack )
;


: OF IMMEDIATE
	' OVER ,	( compile OVER )
	' = ,		( compile = )
	[COMPILE] IF	( compile IF )
	' DROP ,  	( compile DROP )
;

: ENDOF IMMEDIATE
	[COMPILE] ELSE	( ENDOF is the same as ELSE )
;

: ENDCASE IMMEDIATE
	' DROP ,	( compile DROP )

	( keep compiling THEN until we get to our zero marker )
	BEGIN
		?DUP
	WHILE
		[COMPILE] THEN
	REPEAT
;

: CFA>
	LATEST @	( start at LATEST dictionary entry )
	BEGIN
		?DUP		( while link pointer is not null )
	WHILE
		2DUP SWAP	( cfa curr curr cfa )
		< IF		( current dictionary entry < cfa? )
			NIP		( leave curr dictionary entry on the stack )
			EXIT
		THEN
		@		( follow link pointer back )
	REPEAT
	DROP		( restore stack )
	0		( sorry, nothing found )
;

: SEE
	WORD FIND	( find the dictionary entry to decompile )

	( Now we search again, looking for the next word in the dictionary.  This gives us
	  the length of the word that we will be decompiling.  (Well, mostly it does). )
	HERE @		( address of the end of the last compiled word )
	LATEST @	( word last curr )
	BEGIN
		2 PICK		( word last curr word )
		OVER		( word last curr word curr )
		<>		( word last curr word<>curr? )
	WHILE			( word last curr )
		NIP		( word curr )
		DUP @		( word curr prev (which becomes: word last curr) )
	REPEAT

	DROP		( at this point, the stack is: start-of-word end-of-word )
	SWAP		( end-of-word start-of-word )

	( begin the definition with : NAME [IMMEDIATE] )
	':' EMIT SPACE DUP ID. SPACE
	DUP ?IMMEDIATE IF ." IMMEDIATE " THEN

	>DFA		( get the data address, ie. points after DOCOL | end-of-word start-of-data )

	( now we start decompiling until we hit the end of the word )
	BEGIN		( end start )
		2DUP >
	WHILE
		DUP @		( end start codeword )

		CASE
		' LIT OF		( is it LIT ? )
			2 + DUP @		( get next word which is the integer constant )
			.			( and print it )
		ENDOF
		' LITSTRING OF		( is it LITSTRING ? )
			[ CHAR S ] LITERAL EMIT '"' EMIT SPACE ( print S"<space> )
			2 + DUP @		( get the length word )
			SWAP 2 + SWAP		( end start+4 length )
			2DUP TELL		( print the string )
			'"' EMIT SPACE		( finish the string with a final quote )
			+ ALIGNED		( end start+4+len, aligned )
			2 -			( because we're about to add 2 below )
		ENDOF
		' 0BRANCH OF		( is it 0BRANCH ? )
			." 0BRANCH ( "
			2 + DUP @		( print the offset )
			.
			." ) "
		ENDOF
		' BRANCH OF		( is it BRANCH ? )
			." BRANCH ( "
			2 + DUP @		( print the offset )
			.
			." ) "
		ENDOF
		' ' OF			( is it ' (TICK) ? )
			[ CHAR ' ] LITERAL EMIT SPACE
			2 + DUP @		( get the next codeword )
			CFA>			( and force it to be printed as a dictionary entry )
			ID. SPACE
		ENDOF
		' EXIT OF		( is it EXIT? )
			( We expect the last word to be EXIT, and if it is then we don't print it
			  because EXIT is normally implied by ;.  EXIT can also appear in the middle
			  of words, and then it needs to be printed. )
			2DUP			( end start end start )
			2 +			( end start end start+4 )
			<> IF			( end start | we're not at the end )
				." EXIT "
			THEN
		ENDOF
					( default case: )
			DUP			( in the default case we always need to DUP before using )
			CFA>			( look up the codeword to get the dictionary entry )
			ID. SPACE		( and print it )
		ENDCASE

		2 +		( end start+2 )
	REPEAT

	';' EMIT CR

	2DROP		( restore stack )
;


: :NONAME
	0 0 CREATEHEAD	( create a word with no name - we need a dictionary header because ; expects it )
	HERE @		( current HERE value is the address of the codeword, ie. the xt )
	DOCOL ,		( compile DOCOL (the codeword) )
	]		( go into compile mode )
;

: ['] IMMEDIATE
	' LIT ,		( compile LIT )
;

: DO IMMEDIATE  ['] SWAP , ['] >R , ['] >R , [COMPILE] BEGIN ;
: LOOP IMMEDIATE ['] R> , ['] R> , ['] SWAP , ['] 1+ ,  ['] 2DUP ,  ['] = ,  
    ['] -ROT , ['] SWAP , ['] >R , ['] >R , [COMPILE] UNTIL ['] RDROP , ['] RDROP , ;
: +LOOP IMMEDIATE ['] R> , ['] R> , ['] SWAP , ['] ROT , ['] + ,  ['] 2DUP ,  ['] = ,  
    ['] -ROT , ['] SWAP , ['] >R , ['] >R , [COMPILE] UNTIL ['] RDROP , ['] RDROP , ;
: LEAVE R> R> R> DROP DUP 1+ >R >R >R ;

: R@ RSP@ 2+ @ ;
: I RSP@ 2+ @ ;
: I' RSP@ 4 + @ ;
: J RSP@ 6 + @ ;

: 2OVER >R >R 2DUP R> R> 2SWAP ;
: 2ROT >R >R 2SWAP R> R> ;

0 CONSTANT 0
1 CONSTANT 1
: 0. 0 0 ;

: ' WORD FIND >CFA ;

: MAX 2DUP > IF DROP ELSE SWAP DROP THEN ;
: MIN 2DUP > IF SWAP DROP ELSE DROP THEN ;

HEX
DFFC CONSTANT PAD
DECIMAL

: LEAVE R> R> R> DROP DUP >R >R >R ;
: -ROT ROT ROT ;
: FILL          ( A C V )
    SWAP        ( A V C )
    BEGIN 
        DUP 0> 
    WHILE
        1-      ( A V C )
        -ROT    ( C A V )
        2DUP    ( C A V A V )
        SWAP    ( C A V V A )
        C!      ( C A V )
        SWAP 1+ SWAP
        ROT     ( A V C )
    REPEAT 
    2DROP DROP
    ; 
  
    : COUNT DUP 1+ SWAP C@ ;
    : TEXT PAD 72 32 FILL WORD  ( A L )
    DUP -ROT                    ( L A L )
    PAD                         ( L A L PAD )
    SWAP                        ( L A PAD L )
    CMOVE                       ( L )
    PAD SWAP                    ( PAD L )
    ;
 
: PAGE CR 34 0 DO  ." - " LOOP ." -" CR ; 

: CREATE 
    WORD CREATEHEAD DODOES , 0 ,
;

: DOES> IMMEDIATE
    ['] LIT , HERE @ 6 CELLS + , ['] LATEST , ['] @ , ['] >DFA , ['] ! , ['] EXIT ,
;

: 2@ DUP 2+ @ SWAP @ ;
: 2! TUCK 2+ ! ! ;

: 2CONSTANT CREATE , , DOES> 2@ ;
: 2VARIABLE CREATE , , DOES> ;

: S>D DUP 0< IF -1 ELSE 0 THEN ;

( --------------------------------------------------------------------- )

: TESTING ; ( will be forgotten )

: HASH
 SWAP 1+ XOR
;

: HASH-N ( x1 x2 ... xn n -- h )
 0 >R
 BEGIN
 DUP 0 >
 WHILE
 SWAP R> HASH >R
 1-
 REPEAT
 DROP R>
;

VARIABLE TEST-NUMBER
VARIABLE TDEPTH

: TSTART
    0 TEST-NUMBER !
;

: T{
    TEST-NUMBER @ 1+ TEST-NUMBER !
    DEPTH TDEPTH !
;

: ->
    DEPTH TDEPTH @ -
    HASH-N 
    DEPTH TDEPTH !
;

: }T
    DEPTH TDEPTH @ -
    HASH-N
    = 0= IF
           BASE @  DECIMAL
           ." TEST FAILED: " TEST-NUMBER @ . CR
           BASE !
        QUIT 
    THEN
;

: TEND ;

TSTART

    HEX
    T{ -> }T

    T{ : BITSSET? IF 0 0 ELSE 0 THEN ; -> }T
    T{  0 BITSSET? -> 0 }T      ( ZERO IS ALL BITS CLEAR )
    T{  1 BITSSET? -> 0 0 }T      ( OTHER NUMBER HAVE AT LEAST ONE BIT )
    T{ -1 BITSSET? -> 0 0 }T

    T{ 0 0 AND -> 0 }T
    T{ 0 1 AND -> 0 }T
    T{ 1 0 AND -> 0 }T
    T{ 1 1 AND -> 1 }T 

    T{ 0 INVERT 1 AND -> 1 }T
    T{ 1 INVERT 1 AND -> 0 }T

    0    CONSTANT 0S
    0 INVERT CONSTANT 1S
    
    T{ 0S INVERT -> 1S }T
    T{ 1S INVERT -> 0S }T

    T{ 0S 0S AND -> 0S }T
    T{ 0S 1S AND -> 0S }T
    T{ 1S 0S AND -> 0S }T
    T{ 1S 1S AND -> 1S }T

    T{ 0S 0S OR -> 0S }T
    T{ 0S 1S OR -> 1S }T
    T{ 1S 0S OR -> 1S }T
    T{ 1S 1S OR -> 1S }T
    
    T{ 0S 0S XOR -> 0S }T
    T{ 0S 1S XOR -> 1S }T
    T{ 1S 0S XOR -> 1S }T
    T{ 1S 1S XOR -> 0S }T

    BINARY 1000000000000000 CONSTANT MSB
    HEX

    T{ 0S 2* -> 0S }T
    T{ 1 2* -> 2 }T
    T{ 4000 2* -> 8000 }T
    T{ 1S 2* 1 XOR -> 1S }T
    T{ MSB 2* -> 0S }T
  
    T{ 0S 2/ -> 0S }T
    T{ 1 2/ -> 0 }T
    T{ 4000 2/ -> 2000 }T
    T{ 1S 2/ -> 1S }T           
    T{ 1S 1 XOR 2/ -> 1S }T
    T{ MSB 2/ MSB AND -> MSB }T
 
    T{ 1 0 LSHIFT -> 1 }T
    T{ 1 1 LSHIFT -> 2 }T
    T{ 1 2 LSHIFT -> 4 }T      
    T{ 1 F LSHIFT -> 8000 }T 
    T{ 1S 1 LSHIFT 1 XOR -> 1S }T
    T{ MSB 1 LSHIFT -> 0 }T   

    T{ 1 0 RSHIFT -> 1 }T
    T{ 1 1 RSHIFT -> 0 }T
    T{ 2 1 RSHIFT -> 1 }T
    T{ 4 2 RSHIFT -> 1 }T
    T{ 8000 F RSHIFT -> 1 }T         
    T{ MSB 1 RSHIFT MSB AND -> 0 }T     
    T{ MSB 1 RSHIFT 2* -> MSB }T

    0 INVERT                    CONSTANT MAX-UINT
    0 INVERT 1 RSHIFT           CONSTANT MAX-INT
    0 INVERT 1 RSHIFT INVERT    CONSTANT MIN-INT
    0 INVERT 1 RSHIFT           CONSTANT MID-UINT
    0 INVERT 1 RSHIFT INVERT    CONSTANT MID-UINT+1

    0S CONSTANT <FALSE>
    1S CONSTANT <TRUE>

    T{ 0 0= -> <TRUE> }T
    T{ 1 0= -> <FALSE> }T
    T{ 2 0= -> <FALSE> }T
    T{ -1 0= -> <FALSE> }T
    T{ MAX-UINT 0= -> <FALSE> }T
    T{ MIN-INT 0= -> <FALSE> }T
    T{ MAX-INT 0= -> <FALSE> }T
    
    T{ 0 0 = -> <TRUE> }T
    T{ 1 1 = -> <TRUE> }T
    T{ -1 -1 = -> <TRUE> }T
    T{ 1 0 = -> <FALSE> }T
    T{ -1 0 = -> <FALSE> }T
    T{ 0 1 = -> <FALSE> }T
    T{ 0 -1 = -> <FALSE> }T
    
    T{ 0 0< -> <FALSE> }T
    T{ -1 0< -> <TRUE> }T
    T{ MIN-INT 0< -> <TRUE> }T
    T{ 1 0< -> <FALSE> }T
    T{ MAX-INT 0< -> <FALSE> }T
    
    T{ 0 1 < -> <TRUE> }T
    T{ 1 2 < -> <TRUE> }T
    T{ -1 0 < -> <TRUE> }T
    T{ -1 1 < -> <TRUE> }T
    T{ MIN-INT 0 < -> <TRUE> }T
    T{ MIN-INT MAX-INT < -> <TRUE> }T
    T{ 0 MAX-INT < -> <TRUE> }T
    T{ 0 0 < -> <FALSE> }T
    T{ 1 1 < -> <FALSE> }T
    T{ 1 0 < -> <FALSE> }T
    T{ 2 1 < -> <FALSE> }T
    T{ 0 -1 < -> <FALSE> }T
    T{ 1 -1 < -> <FALSE> }T
    T{ 0 MIN-INT < -> <FALSE> }T
    T{ MAX-INT MIN-INT < -> <FALSE> }T
    T{ MAX-INT 0 < -> <FALSE> }T
    
    T{ 0 1 > -> <FALSE> }T
    T{ 1 2 > -> <FALSE> }T
    T{ -1 0 > -> <FALSE> }T
    T{ -1 1 > -> <FALSE> }T
    T{ MIN-INT 0 > -> <FALSE> }T
    T{ MIN-INT MAX-INT > -> <FALSE> }T
    T{ 0 MAX-INT > -> <FALSE> }T
    T{ 0 0 > -> <FALSE> }T
    T{ 1 1 > -> <FALSE> }T
    T{ 1 0 > -> <TRUE> }T
    T{ 2 1 > -> <TRUE> }T
    T{ 0 -1 > -> <TRUE> }T
    T{ 1 -1 > -> <TRUE> }T
    T{ 0 MIN-INT > -> <TRUE> }T
    T{ MAX-INT MIN-INT > -> <TRUE> }T
    T{ MAX-INT 0 > -> <TRUE> }T
    
    T{ 0 1 U< -> <TRUE> }T
    T{ 1 2 U< -> <TRUE> }T
    T{ 0 MID-UINT U< -> <TRUE> }T
    T{ 0 MAX-UINT U< -> <TRUE> }T
    T{ MID-UINT MAX-UINT U< -> <TRUE> }T
    T{ 0 0 U< -> <FALSE> }T
    T{ 1 1 U< -> <FALSE> }T
    T{ 1 0 U< -> <FALSE> }T
    T{ 2 1 U< -> <FALSE> }T
    T{ MID-UINT 0 U< -> <FALSE> }T
    T{ MAX-UINT 0 U< -> <FALSE> }T
    T{ MAX-UINT MID-UINT U< -> <FALSE> }T

    T{ 0 1 MIN -> 0 }T
    T{ 1 2 MIN -> 1 }T
    T{ -1 0 MIN -> -1 }T
    T{ -1 1 MIN -> -1 }T
    T{ MIN-INT 0 MIN -> MIN-INT }T
    T{ MIN-INT MAX-INT MIN -> MIN-INT }T
    T{ 0 MAX-INT MIN -> 0 }T
    T{ 0 0 MIN -> 0 }T
    T{ 1 1 MIN -> 1 }T
    T{ 1 0 MIN -> 0 }T
    T{ 2 1 MIN -> 1 }T
    T{ 0 -1 MIN -> -1 }T
    T{ 1 -1 MIN -> -1 }T
    T{ 0 MIN-INT MIN -> MIN-INT }T
    T{ MAX-INT MIN-INT MIN -> MIN-INT }T
    T{ MAX-INT 0 MIN -> 0 }T
    
    T{ 0 1 MAX -> 1 }T
    T{ 1 2 MAX -> 2 }T
    T{ -1 0 MAX -> 0 }T
    T{ -1 1 MAX -> 1 }T
    T{ MIN-INT 0 MAX -> 0 }T
    T{ MIN-INT MAX-INT MAX -> MAX-INT }T
    T{ 0 MAX-INT MAX -> MAX-INT }T
    T{ 0 0 MAX -> 0 }T
    T{ 1 1 MAX -> 1 }T
    T{ 1 0 MAX -> 1 }T
    T{ 2 1 MAX -> 2 }T
    T{ 0 -1 MAX -> 0 }T
    T{ 1 -1 MAX -> 1 }T
    T{ 0 MIN-INT MAX -> 0 }T
    T{ MAX-INT MIN-INT MAX -> MAX-INT }T
    T{ MAX-INT 0 MAX -> MAX-INT }T

    T{ 1 2 2DROP -> }T
    T{ 1 2 2DUP -> 1 2 1 2 }T
    T{ 1 2 3 4 2OVER -> 1 2 3 4 1 2 }T
    T{ 1 2 3 4 2SWAP -> 3 4 1 2 }T
    T{ 0 ?DUP -> 0 }T
    T{ 1 ?DUP -> 1 1 }T
    T{ -1 ?DUP -> -1 -1 }T
    T{ DEPTH -> 0 }T
    T{ 0 DEPTH -> 0 1 }T
    T{ 0 1 DEPTH -> 0 1 2 }T
    T{ 0 DROP -> }T
    T{ 1 2 DROP -> 1 }T
    T{ 1 DUP -> 1 1 }T
    T{ 1 2 OVER -> 1 2 1 }T
    T{ 1 2 3 ROT -> 2 3 1 }T
    T{ 1 2 SWAP -> 2 1 }T

    T{ : GR1 >R R> ; -> }T
    T{ : GR2 >R R@ R> DROP ; -> }T
    T{ 123 GR1 -> 123 }T
    T{ 123 GR2 -> 123 }T
    T{ 1S GR1 -> 1S }T   ( RETURN STACK HOLDS CELLS )

    T{ 0 5 + -> 5 }T
    T{ 5 0 + -> 5 }T
    T{ 0 -5 + -> -5 }T
    T{ -5 0 + -> -5 }T
    T{ 1 2 + -> 3 }T
    T{ 1 -2 + -> -1 }T
    T{ -1 2 + -> 1 }T
    T{ -1 -2 + -> -3 }T
    T{ -1 1 + -> 0 }T
    T{ MID-UINT 1 + -> MID-UINT+1 }T

    T{ 0 5 - -> -5 }T
    T{ 5 0 - -> 5 }T
    T{ 0 -5 - -> 5 }T
    T{ -5 0 - -> -5 }T
    T{ 1 2 - -> -1 }T
    T{ 1 -2 - -> 3 }T
    T{ -1 2 - -> -3 }T
    T{ -1 -2 - -> 1 }T
    T{ 0 1 - -> -1 }T
    T{ MID-UINT+1 1 - -> MID-UINT }T

    T{ 0 1+ -> 1 }T
    T{ -1 1+ -> 0 }T
    T{ 1 1+ -> 2 }T
    T{ MID-UINT 1+ -> MID-UINT+1 }T
    
    T{ 2 1- -> 1 }T
    T{ 1 1- -> 0 }T
    T{ 0 1- -> -1 }T
    T{ MID-UINT+1 1- -> MID-UINT }T
    
    T{ 0 NEGATE -> 0 }T
    T{ 1 NEGATE -> -1 }T
    T{ -1 NEGATE -> 1 }T
    T{ 2 NEGATE -> -2 }T
    T{ -2 NEGATE -> 2 }T
    
    T{ 0 ABS -> 0 }T
    T{ 1 ABS -> 1 }T
    T{ -1 ABS -> 1 }T
    T{ MIN-INT ABS -> MID-UINT+1 }T

    T{ 0 S>D -> 0 0 }T
    T{ 1 S>D -> 1 0 }T
    T{ 2 S>D -> 2 0 }T
    T{ -1 S>D -> -1 -1 }T
    T{ -2 S>D -> -2 -1 }T
    T{ MIN-INT S>D -> MIN-INT -1 }T
    T{ MAX-INT S>D -> MAX-INT 0 }T
    
    T{ 0 0 M* -> 0 S>D }T
    T{ 0 1 M* -> 0 S>D }T
    T{ 1 0 M* -> 0 S>D }T
    T{ 1 2 M* -> 2 S>D }T
    T{ 2 1 M* -> 2 S>D }T
    T{ 3 3 M* -> 9 S>D }T
    T{ -3 3 M* -> -9 S>D }T
    T{ 3 -3 M* -> -9 S>D }T
    T{ -3 -3 M* -> 9 S>D }T
    T{ 0 MIN-INT M* -> 0 S>D }T
    T{ 1 MIN-INT M* -> MIN-INT S>D }T
    T{ 2 MIN-INT M* -> 0 1S }T
    T{ 0 MAX-INT M* -> 0 S>D }T
    T{ 1 MAX-INT M* -> MAX-INT S>D }T
    T{ 2 MAX-INT M* -> MAX-INT 1 LSHIFT 0 }T
    T{ MIN-INT MIN-INT M* -> 0 MSB 1 RSHIFT }T
    T{ MAX-INT MIN-INT M* -> MSB MSB 2/ }T
    T{ MAX-INT MAX-INT M* -> 1 MSB 2/ INVERT }T

    T{ 0 0 UM* -> 0 0 }T
    T{ 0 1 UM* -> 0 0 }T
    T{ 1 0 UM* -> 0 0 }T
    T{ 1 2 UM* -> 2 0 }T
    T{ 2 1 UM* -> 2 0 }T
    T{ 3 3 UM* -> 9 0 }T
    T{ MID-UINT+1 1 RSHIFT 2 UM* ->  MID-UINT+1 0 }T
    T{ MID-UINT+1          2 UM* ->           0 1 }T
    T{ MID-UINT+1          4 UM* ->           0 2 }T
    T{         1S          2 UM* -> 1S 1 LSHIFT 1 }T
    T{   MAX-UINT   MAX-UINT UM* ->    1 1 INVERT }T
    

    T{ 0 0 * -> 0 }T          
    T{ 0 1 * -> 0 }T
    T{ 1 0 * -> 0 }T
    T{ 1 2 * -> 2 }T
    T{ 2 1 * -> 2 }T
    T{ 3 3 * -> 9 }T
    T{ -3 3 * -> -9 }T
    T{ 3 -3 * -> -9 }T
    T{ -3 -3 * -> 9 }T

    T{ MID-UINT+1 1 RSHIFT 2 * -> MID-UINT+1 }T
    T{ MID-UINT+1 2 RSHIFT 4 * -> MID-UINT+1 }T
    T{ MID-UINT+1 1 RSHIFT MID-UINT+1 OR 2 * -> MID-UINT+1 }T
 
    T{ DECIMAL 131071. HEX 2CONSTANT 2c0 -> }T
    T{ 2c0 -> 1 -1 }T
 
    T{ 1 2 2CONSTANT 2c1 -> }T
    T{ 2c1 -> 1 2 }T
    T{ : cd1 2c1 ; -> }T
    T{ cd1 -> 1 2 }T
    
    T{ : cd2 2CONSTANT ; -> }T
    T{ -1 -2 cd2 2c2 -> }T
    T{ 2c2 -> -1 -2 }T
    
    (
        T{ 4 5 2CONSTANT 2c3 IMMEDIATE 2c3 -> 4 5 }T
        T{ : cd6 2c3 2LITERAL ; cd6 -> 4 5 }T
    )

    

    T{ 2VARIABLE 2v1 -> }T
    T{ 0. 2v1 2! ->    }T
    T{    2v1 2@ -> 0. }T
    T{ -1 -2 2v1 2! ->       }T
    T{       2v1 2@ -> -1 -2 }T
    T{ : cd2 2VARIABLE ; -> }T
    T{ cd2 2v2 -> }T
    T{ : cd3 2v2 2! ; -> }T
    T{ -2 -1 cd3 -> }T
    T{ 2v2 2@ -> -2 -1 }T    
    T{ 2VARIABLE 2v3 IMMEDIATE 5 6 2v3 2! -> }T
    T{ 2v3 2@ -> 5 6 }T

    T{       0 S>D              1 FM/MOD ->  0       0 }T 
    T{       1 S>D              1 FM/MOD ->  0       1 }T 
    T{       2 S>D              1 FM/MOD ->  0       2 }T
    T{      -1 S>D              1 FM/MOD ->  0      -1 }T
    T{      -2 S>D              1 FM/MOD ->  0      -2 }T
    T{       0 S>D             -1 FM/MOD ->  0       0 }T 
    T{       1 S>D             -1 FM/MOD ->  0      -1 }T
    T{       2 S>D             -1 FM/MOD ->  0      -2 }T
    T{      -1 S>D             -1 FM/MOD ->  0       1 }T
    T{      -2 S>D             -1 FM/MOD ->  0       2 }T
    T{       2 S>D              2 FM/MOD ->  0       1 }T
    T{      -1 S>D             -1 FM/MOD ->  0       1 }T 
    T{      -2 S>D             -2 FM/MOD ->  0       1 }T 
    T{       7 S>D              3 FM/MOD ->  1       2 }T 
    T{       7 S>D             -3 FM/MOD -> -2      -3 }T 
    T{      -7 S>D              3 FM/MOD ->  2      -3 }T
    T{      -7 S>D             -3 FM/MOD -> -1       2 }T
    T{ MAX-INT S>D              1 FM/MOD ->  0 MAX-INT }T
    T{ MIN-INT S>D              1 FM/MOD ->  0 MIN-INT }T
    T{ MAX-INT S>D        MAX-INT FM/MOD ->  0       1 }T
    T{ MIN-INT S>D        MIN-INT FM/MOD ->  0       1 }T
    T{    1S 1                  4 FM/MOD ->  3 MAX-INT }T
    T{       1 MIN-INT M*       1 FM/MOD ->  0 MIN-INT }T
    T{       1 MIN-INT M* MIN-INT FM/MOD ->  0       1 }T
    T{       2 MIN-INT M*       2 FM/MOD ->  0 MIN-INT }T
    T{       2 MIN-INT M* MIN-INT FM/MOD ->  0       2 }T
    T{       1 MAX-INT M*       1 FM/MOD ->  0 MAX-INT }T
    T{       1 MAX-INT M* MAX-INT FM/MOD ->  0       1 }T
    T{       2 MAX-INT M*       2 FM/MOD ->  0 MAX-INT }T
    T{       2 MAX-INT M* MAX-INT FM/MOD ->  0       2 }T
    T{ MIN-INT MIN-INT M* MIN-INT FM/MOD ->  0 MIN-INT }T
    T{ MIN-INT MAX-INT M* MIN-INT FM/MOD ->  0 MAX-INT }T
    T{ MIN-INT MAX-INT M* MAX-INT FM/MOD ->  0 MIN-INT }T
    T{ MAX-INT MAX-INT M* MAX-INT FM/MOD ->  0 MAX-INT }T

    : T*/MOD >R M* R> FM/MOD ;

    T{       0 2       1 */MOD ->       0 2       1 T*/MOD }T
    T{       1 2       1 */MOD ->       1 2       1 T*/MOD }T
    T{       2 2       1 */MOD ->       2 2       1 T*/MOD }T
    T{      -1 2       1 */MOD ->      -1 2       1 T*/MOD }T
    T{      -2 2       1 */MOD ->      -2 2       1 T*/MOD }T
    T{       0 2      -1 */MOD ->       0 2      -1 T*/MOD }T
    T{       1 2      -1 */MOD ->       1 2      -1 T*/MOD }T
    T{       2 2      -1 */MOD ->       2 2      -1 T*/MOD }T
    T{      -1 2      -1 */MOD ->      -1 2      -1 T*/MOD }T
    T{      -2 2      -1 */MOD ->      -2 2      -1 T*/MOD }T
    T{       2 2       2 */MOD ->       2 2       2 T*/MOD }T
    T{      -1 2      -1 */MOD ->      -1 2      -1 T*/MOD }T
    T{      -2 2      -2 */MOD ->      -2 2      -2 T*/MOD }T 
    T{       7 2       3 */MOD ->       7 2       3 T*/MOD }T 
    T{       7 2      -3 */MOD ->       7 2      -3 T*/MOD }T  
    T{      -7 2       3 */MOD ->      -7 2       3 T*/MOD }T 
    T{      -7 2      -3 */MOD ->      -7 2      -3 T*/MOD }T  
    T{ MAX-INT 2 MAX-INT */MOD -> MAX-INT 2 MAX-INT T*/MOD }T
    T{ MIN-INT 2 MIN-INT */MOD -> MIN-INT 2 MIN-INT T*/MOD }T
 
    DECIMAL 
  

    HEX

    DECIMAL
TEND

: STAR 42 EMIT ;
: STARS   0 DO STAR  LOOP ;
: MARGIN  CR 30 SPACES ;
: BLIP MARGIN STAR ;
: BAR  MARGIN 5 STARS ;
: F    BAR BLIP BAR BLIP BLIP CR ;

: TEST 4 0  do I . I' . ." hello"  CR 2 +LOOP ; 

: TEST 10 0 DO I DUP . 5 = IF LEAVE THEN LOOP ; 

FORGET TESTING

 ."  "

( ." FINISHED" CR )

`.toUpperCase() );
//val = forth.memory;
forth.run();
val = forth.outputBufferoutputBufferString();
val = forth.memory.memoryCopyFromTo(forth.memory.dsp, forth.memory.s0()-1);

//val = forth.memory.memoryCopyFromTo(1018, 1050);
//console.log(val);

console.log("finished!");
}


function addchar(char)
{
    forth.inputBuffer.push(char & 0xFF);
    if (char === 13) {
        typeCharacter(32);
        forth.makeRunning();
        forth.run();
    } else {
        typeCharacter(char);
    }
}

function typeError(aString)
{
    for (let i = 0; i < aString.length; i++)
        typeCharacter(aString.charCodeAt(i));
    typeCharacter(13);
}

function typeOk()
{
    typeError("OK");
}

function specialchar(char)
{
 console.log(char)   
}