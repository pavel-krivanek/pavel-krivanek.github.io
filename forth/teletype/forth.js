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
    return[ (num & 0xFF00) >>> 8, num & 0xFF ];
}
Number.prototype.asUnsigned4Bytes = function() {
    let num = this.asUnsigned32();
    return[ (num & 0xFF000000) >>> 24, (num & 0xFF0000) >>> 16, (num & 0xFF00) >>> 8, num & 0xFF ];
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

class ForthDisk {
	constructor() {
		this.content = new Uint8Array(1474560).fill(32);
	}
	readFromDisk(blockNumber, memory, address) {
		let blockStart = 1024 * blockNumber;
		for (let i = 0; i < 1024; i++) {
			memory.writeByteAt(this.content[blockStart + i], address + i);
		}
	}
	writeToDisk(blockNumber, memory, address) {
		let blockStart = 1024 * blockNumber;
		for (let i = 0; i < 1024; i++) {
			this.content[blockStart + i] = memory.byteAt(address + i);
		}
	}
	writeBlock(blockNumber, memory, address) {
		this.writeToDisk(blockNumber, memory, address);
	}
	setByte(index, aByte) {
		this.content[index] = aByte;
	}
	clearBlock(blockNumber, fillByte = 32) {
		let blockStart = 1024 * blockNumber;
		this.content.fill(fillByte & 0xFF, blockStart, blockStart + 1024);
	}
}

class ForthBlockBuffers {
    constructor(disk, memory, startAddress, count) {
        this.disk = disk;
        this.memory = memory;
        this.startAddress = startAddress;
        this.count = count;
        this.buffers =[];
        for (let i = 0; i < count; i++) {
            this.buffers.push({
                blockNum: -1,
                updated: false,
                address: startAddress + i * 1024,
                lastAccessed: 0
            });
        }
        this.accessCounter = 0;
        this.lastAccessedBuffer = null;
    }

    findBufferForBlock(blockNumber) {
        return this.buffers.find(buffer => buffer.blockNum === blockNumber);
    }

    selectVictimBuffer() {
        return this.buffers.reduce((oldest, buffer) =>
            (buffer.lastAccessed < oldest.lastAccessed ? buffer : oldest));
    }

    noteAccess(buffer) {
        buffer.lastAccessed = ++this.accessCounter;
        this.lastAccessedBuffer = buffer;
        return buffer.address;
    }

    replaceBufferContents(buffer, blockNumber, shouldReadFromDisk) {
        if (buffer.updated && buffer.blockNum !== -1) {
            this.disk.writeToDisk(buffer.blockNum, this.memory, buffer.address);
            buffer.updated = false;
        }
        buffer.blockNum = blockNumber;
        if (shouldReadFromDisk) {
            this.disk.readFromDisk(blockNumber, this.memory, buffer.address);
        }
        return this.noteAccess(buffer);
    }

    getBlock(blockNumber) {
        let buffer = this.findBufferForBlock(blockNumber);
        if (buffer) {
            return this.noteAccess(buffer);
        }
        return this.replaceBufferContents(this.selectVictimBuffer(), blockNumber, true);
    }

    getBuffer(blockNumber) {
        let buffer = this.findBufferForBlock(blockNumber);
        if (buffer) {
            return this.noteAccess(buffer);
        }
        return this.replaceBufferContents(this.selectVictimBuffer(), blockNumber, false);
    }

    update() {
        if (this.lastAccessedBuffer) {
            this.lastAccessedBuffer.updated = true;
        }
    }

    saveBuffers() {
        this.buffers.forEach(buffer => {
            if (buffer.updated && buffer.blockNum !== -1) {
                this.disk.writeToDisk(buffer.blockNum, this.memory, buffer.address);
                buffer.updated = false;
            }
        });
    }

    emptyBuffers() {
        this.buffers.forEach(buffer => {
            buffer.blockNum = -1;
            buffer.updated = false;
            buffer.lastAccessed = 0;
        });
        this.lastAccessedBuffer = null;
    }
}

class Forth {
    constructor() {
       this.memory = new ForthMemory(this);
       this.disk = new ForthDisk(this);
       this.blockBuffers = new ForthBlockBuffers(this.disk, this.memory, 40000, 4);
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

       this.awaitingRawInput = false;
}
    resetBuffers() {
        this.inputBuffer = [];
        this.outputBuffer =[];
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
    searchVocab(nameArray, startAddress) {
        let current = startAddress;
        let found = false;
        do {
            if (current === 0) return 0;
            found = this.matchAt(nameArray, current) && !this.isHidden(current);
            if (!found) { current = this.memory.wordAt(current) }
        } while (!found);
        return current;
    }
    find(nameArray) {
        let contextVocab = this.memory.wordAt(this.varContext());
        let currentVocab = this.memory.wordAt(this.varCurrent());

        let result = this.searchVocab(nameArray, this.memory.wordAt(contextVocab));
        if (result !== 0) return result;

        if (contextVocab !== currentVocab) {
            result = this.searchVocab(nameArray, this.memory.wordAt(currentVocab));
            if (result !== 0) return result;
        }

        let forthVocab = this.addressForLabel("var_FORTH_VOCAB");
        if (contextVocab !== forthVocab && currentVocab !== forthVocab) {
             result = this.searchVocab(nameArray, this.memory.wordAt(forthVocab));
        }

        return result;
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
    noInput() {
		this.setVarBlkValue(0);
		this.state = "noInput";
	}
    clearInputSource() {
        this.inputBuffer = [];
        this.awaitingRawInput = false;
        this.setVarBlkValue(0);
        this.setVarToInValue(0);
    }
    abortToQuit() {
        this.clearInputSource();
        this.setVarStateValue(0);
        this.memory.resetStack();
        this.memory.resetReturnStack();
        this.makeRunning();
        this.pcCurrent = this.addressForLabel("codeword_QUIT");
        this.pcNext = this.pcCurrent + this.wordSize();
        this.pc = this.memory.wordAt(this.pcCurrent) - 1;
    }
    emergencyStop() {
        // na error occured
        this.noInput();
        this.awaitingRawInput = false;
        this.resetBuffers();
        this.memory.resetStack();
        this.memory.resetReturnStack();

    }
    memoryInitializer() { return new ForthStandardMemoryInitializer(this); }
    outputBufferString() { return this.outputBuffer.toByteString(); }
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
    digitValue(asciiCode, base = this.varBaseValue()) {
        let value = -1;
        if ((asciiCode >= 48) && (asciiCode <= 57)) value = asciiCode - 48;
        else if ((asciiCode >= 65) && (asciiCode <= 90)) value = asciiCode - 65 + 10;
        else if ((asciiCode >= 97) && (asciiCode <= 122)) value = asciiCode - 97 + 10;
        return (value >= 0 && value < base) ? value : -1;
    }
    isDoubleSeparator(asciiCode) {
         return ((asciiCode >= 44) && (asciiCode <= 47)) // ,-./
            || (asciiCode === 58) // :
    }
    privNumber(wordStringAddress, length) {
        let isDouble = false;
        let base = this.varBaseValue();
        let toParse =[];
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
            || (asciiCode === 10)
            || (asciiCode === 12)
            || this.isEndOfLine(asciiCode) ;
    }
    inputBufferEmpty() { return  this.inputBuffer.length === 0 }

    privWord() {
        let length = 0;
        let charCode;
		let usesBlock = this.readsFromBlock();
        do {
            if (this.atInputEnd(usesBlock)) {
                if (!usesBlock) {
                    this.awaitingRawInput = false;
                    this.noInput();
                    typeOk();
                }
                return[this.wordBufferAddress(), 0];
            }
            charCode = this.readCharacter(usesBlock);
        } while (this.isSeparator(charCode));

        let atWordEnd;
        do {
            this.memory.memoryAtPut(this.wordBufferAddress() + length, charCode);
            length += 1;
            atWordEnd = this.atInputEnd(usesBlock)
                ? true
                : this.isSeparator(charCode = this.readCharacter(usesBlock));
        } while (!atWordEnd);

        return[this.wordBufferAddress(), length]
    }

	readsFromBlock() {
		return !(this.varBlkValue() === 0);
	}

	readFromBlock() {
        let toIn = this.varToInValue();
		if (toIn >= 1024) {
			return 0;
		}

        let oldLast = this.blockBuffers.lastAccessedBuffer;
        let oldBlockNum = oldLast ? oldLast.blockNum : -1;
		let addr = this.blockBuffers.getBlock(this.blockNumberWithOffset(this.varBlkValue()));
        if (oldLast && oldLast.blockNum === oldBlockNum) {
            this.blockBuffers.lastAccessedBuffer = oldLast;
        } else if (!oldLast) {
            this.blockBuffers.lastAccessedBuffer = null;
        } else {
            this.blockBuffers.lastAccessedBuffer = null;
        }
		let aByte = this.memory.memoryAt(addr + toIn);
		this.setVarToInValue(toIn + 1);
		return aByte;
	}

	atInputEnd(usesBlock) {
		return (usesBlock) ? this.varToInValue() >= 1024 : this.inputBufferEmpty();
	}

	readCharacter(usesBlock) {
		let aCharacter = (usesBlock) ? this.readFromBlock() : this.readInputBuffer();
		return aCharacter;
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
        if (this.isRunning()) { this.pc += 1; }
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

    varToIn() { return this.addressForLabel("var_>IN"); }
    varToInValue() { return this.memory.unsignedWordAt(this.varToIn()); }
    setVarToInValue(aValue) { return this.memory.writeWordAt(aValue, this.varToIn()); }

    varBlk() { return this.addressForLabel("var_BLK"); }
    varBlkValue() { return this.memory.signedWordAt(this.varBlk()); }
    setVarBlkValue(aValue) { return this.memory.writeWordAt(aValue, this.varBlk()); }

    varContext() { return this.addressForLabel("var_CONTEXT"); }
    varCurrent() { return this.addressForLabel("var_CURRENT"); }
    offsetVariableAddress() {
        let name = Array.from("OFFSET").map(each => each.charCodeAt(0));
        let offsetWord = this.find(name);
        if (offsetWord === 0) return undefined;
        let codeword = this.codewordOf(offsetWord);
        return this.memory.unsignedWordAt(codeword + (this.wordSize() * 2));
    }
    varOffsetValue() {
        let offsetVarAddress = this.offsetVariableAddress();
        return (offsetVarAddress === undefined) ? 0 : this.memory.signedWordAt(offsetVarAddress);
    }
    blockNumberWithOffset(aBlockNumber) {
        return aBlockNumber + this.varOffsetValue();
    }

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
		this.initializeBlockPrimitives();
        this.initializeInterpreterPrimitives();
        this.initializeVocabularyPrimitives();

        let lastWord = this.forth.lastWord;
        this.forth.setVarLatestValue(lastWord);

        let forthVocab = this.forth.addressForLabel("var_FORTH_VOCAB");
        this.forth.memory.writeWordAt(lastWord, forthVocab);
        this.forth.memory.writeWordAt(forthVocab, this.forth.varContext());
        this.forth.memory.writeWordAt(forthVocab, this.forth.varCurrent());

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
        ForthCodeUDDivMod,
        ForthCodeMStarSlash,
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
        this.addCode(new ForthCodeConstant(this.forth, "F-LENMASK", this.forth.flagLengthMask()));
        this.addCode(new ForthCodeConstant(this.forth, "F-HIDDEN", this.forth.flagHidden()));
        this.addCode(new ForthCodeConstant(this.forth, "F-IMMED", this.forth.flagImmediate()));
        this.addCode(new ForthCodeConstant(this.forth, "R0", this.forth.memory.r0()));
    }
    initializeBuitInVarialbes() {
        this.addCode(new ForthCodeVariable(this.forth, "state"));
        this.addCode(new ForthCodeVariable(this.forth, "here"));
        this.addCode(new ForthCodeVariable(this.forth, "latest", 0));
        this.addCode(new ForthCodeVariable(this.forth, "base", 10));
        this.addCode(new ForthCodeVariable(this.forth, "s0", this.forth.memory.s0()));
        this.addCode(new ForthCodeVariable(this.forth, ">in", 0));
        this.addCode(new ForthCodeVariable(this.forth, "blk", 0));
        this.addCode(new ForthCodeVariable(this.forth, "context", 0));
        this.addCode(new ForthCodeVariable(this.forth, "current", 0));
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
        ForthCodeKeyRaw,
        ForthCodeEmit,
        ForthCodeTell
    ]); }
    initializeInterpreterPrimitives() { this.installAll([
		ForthCodeExecute,
		ForthCodeHalt,
		ForthCodeAbort,
		ForthCodeAbortQuote,
		ForthCodeQuit,
		ForthCodeInterpret
        ]); }
    initializeVocabularyPrimitives() { this.installAll([
        ForthCodeDefinitions,
        ForthCodeForth
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
        ForthCodeNumber,
        ForthCodeDigitQ,
        ForthCodeConvert,

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
        ForthCodeAbortQRuntime,
        ForthCodeChar
        ]); }
    initializeBlockPrimitives() { this.installAll([
        ForthCodeBlock,
        ForthCodeBuffer,
        ForthCodeUpdate,
        ForthCodeSaveBuffers,
        ForthCodeEmptyBuffers,
        ForthCodeFlush,
        ForthCodeLoad
        ]); }
}

class ForthCode {
    constructor(forth) {
        this.forth = forth;
    }
    execute() { throw new Error("subclassResponsibility") };
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
    popUnsigned32() { return this.forth.memory.pop(4).asUnsigned32(); }
    memory() { return this.forth.memory; }
    true() { return 0xFFFF; }
    false() { return 0; }
    numberValue() { return 0; }
}

class ForthCodeWithHead extends ForthCode {
    codewordFor(position) { return position + this.forth.wordSize(); }
    finishAt(originalPosition) {
        let newPosition = originalPosition + 1;
        this.forth.addLabelAddress("next_" + this.label(), newPosition);
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

class ForthCodeUDDivMod extends ForthCodeWithHead {
    name() { return "ud/mod"; }
    execute() {
        let divisor = this.popUnsigned();
        let dividend = this.popUnsigned32();
        let remainder = dividend % divisor;
        let quotient = Math.floor(dividend / divisor);
        this.push(remainder);
        this.push2(quotient);
    }
}

class ForthCodeMStarSlash extends ForthCodeWithHead {
    name() { return "m*/"; }
    execute() {
        let divisor = this.popUnsigned();
        let multiplier = this.popSigned();
        let multiplicand = this.popSigned32();
        let product = multiplicand * multiplier;
        let quotient = Math.floor(product / divisor);
        this.push2(quotient);
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
    codewordLabels() { return["WORD", "CREATEHEAD", "LIT", "DOCOL", "COMMA", "LATEST", "FETCH", "HIDDEN", "RBRAC", "EXIT"]}
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

        let currentVocabPointer = this.memory().wordAt(this.forth.varCurrent());
        let latest = this.memory().wordAt(currentVocabPointer);

        this.memory().writeWordAt(latest, header);
        this.memory().writeByteAt(length, header + this.forth.wordSize());
        for (let i=1; i<=length; i++)
            this.memory().writeByteAt(this.memory().byteAt(nameAddress+i-1), header + this.forth.wordSize() + i)

        this.memory().writeWordAt(header, currentVocabPointer);

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
    codewordLabels() { return["LIT", "EXIT", "COMMA", "LATEST", "FETCH", "HIDDEN", "LBRAC", "EXIT"]}
}

// Vocabulary primitives
class ForthCodeDefinitions extends ForthCodeWithHead {
    name() { return "definitions"; }
    execute() {
        let contextVocab = this.memory().wordAt(this.forth.varContext());
        this.memory().writeWordAt(contextVocab, this.forth.varCurrent());
    }
}

class ForthCodeForth extends ForthCodeWithHead {
    name() { return "forth"; }
    execute() {
        let forthVocab = this.forth.addressForLabel("var_FORTH_VOCAB");
        this.memory().writeWordAt(forthVocab, this.forth.varContext());
    }
    finishAt(initialPosition) {
        let newPosition = super.finishAt(initialPosition);
        newPosition++;
        this.forth.addLabelAddress("var_FORTH_VOCAB", newPosition);
        this.memory().writeWordAt(0, newPosition);
        newPosition += this.forth.wordSize();
        return newPosition;
    }
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
        this.forth.outputBuffer.push(...text);
    }
}

class ForthCodeKey extends ForthCodeWithHead {
    name() { return "key"; }
    execute() {
        this.forth.awaitingRawInput = false;
        let usesBlock = this.forth.readsFromBlock();

        // If we have reached the end of the block (or empty terminal buffer),
        // halt execution and fallback to waiting for console input.
        if (this.forth.atInputEnd(usesBlock)) {
            this.forth.noInput();
            return;
        }

        let input = this.forth.readCharacter(usesBlock);
        if (this.forth.isRunning()) this.push(input);
    }
}


class ForthCodeKeyRaw extends ForthCodeWithHead {
    name() { return "keyraw"; }
    execute() {
        // Signal the host UI that we are waiting for raw key input (character-at-a-time).
        this.forth.awaitingRawInput = true;
        let input = this.forth.readInputBuffer();
        if (this.forth.isRunning()) {
            this.push(input);
            // Clear the flag once we successfully consumed a character.
            this.forth.awaitingRawInput = false;
        }
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

class ForthCodeAbort extends ForthCodeWithHead {
    name() { return "abort"; }
    execute() {
        this.forth.abortToQuit();
    }
}

class ForthCodeAbortQuote extends ForthCodeWithHead {
    name() { return 'abort"'; }
    flags() { return this.forth.flagImmediate(); }
    execute() {
        let text = this.forth.readStringUntil(34);
        if (this.forth.varStateValue() === 0) {
            let flag = this.popSigned();
            if (flag !== 0) {
                text.forEach(each => typeCharacter(each));
                this.forth.outputBuffer.push(...text);
                this.forth.abortToQuit();
            }
            return;
        }

        this.forth.privComma(this.forth.addressForLabel('codeword_ABORTQRUNTIME'));
        this.forth.privComma(text.length);
        let here = this.forth.varHereValue();
        text.forEach((each, index) => {
            this.memory().writeByteAt(each, here + index);
        });
        this.forth.setVarHereValue(here + text.length);
        this.forth.alignHere();
    }
}

class ForthCodeInterpret extends ForthCodeWithHead {
    name() { return "interpret"; }
    execute() {
        let interpretIsLit = false;
        let executeImmediate = false;
        let addressLengthPair = this.forth.privWord();
        let address = addressLengthPair[0];
console.log(address);
        let length = addressLengthPair[1];
        if (length === 0) return;
        let aCodeword = 0;
        let toFind = this.memory().memoryCopyFromTo(address, address + length - 1);
        let resultOfFind = this.forth.find(toFind);
        let numberErrorPair =[0, 0];
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
            this.forth.privNext();
        }
    }
}

class ForthCodeQuit extends ForthCodeWithHeadCompiled {
    name() { return "quit"; }
    flags() { return 0; } // QUIT should never be immediate
    codewordLabels() { return["INTERPRET", "BRANCH", -4 ]}
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
        let destination = this.popUnsigned();   // c-addr2
        let source = this.popUnsigned();        // c-addr1

        let byte = this.memory().byteAt(source) & 0xFF;
        this.memory().writeByteAt(byte, destination);

        this.push(source + 1);
        this.push(destination + 1);
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

class ForthCodeDigitQ extends ForthCodeWithHead {
    name() { return "digit?"; }
    execute() {
        let asciiCode = this.popUnsigned();
        let digit = this.forth.digitValue(asciiCode);
        if (digit >= 0) {
            this.push(digit);
            this.push(this.true());
        } else {
            this.push(asciiCode);
            this.push(this.false());
        }
    }
}

class ForthCodeConvert extends ForthCodeWithHead {
    name() { return "convert"; }
    execute() {
        let addr = this.popUnsigned();
        let value = this.popUnsigned32();
        let ptr = addr + 1;
        let base = this.forth.varBaseValue();
        while (true) {
            let digit = this.forth.digitValue(this.memory().byteAt(ptr), base);
            if (digit < 0) break;
            value = ((value * base) + digit).asUnsigned32();
            ptr += 1;
        }
        this.push2(value);
        this.push(ptr);
    }
}

class ForthCodeLoad extends ForthCodeWithHeadCompiled {
    name() { return "LOADPRIM"; }
    flags() { return 0; }
    codewordLabels() {
        return [
            "BLK", "FETCH", "TOR",
            ">IN", "FETCH", "TOR",
            "BLK", "STORE",
            "LIT", 0, ">IN", "STORE",

            ">IN", "FETCH",
            "LIT", 1024,
            "LT",
            "ZBRANCH", 8,

            "INTERPRET",
            "BRANCH", -18,
            "FROMR", ">IN", "STORE",
            "FROMR", "BLK", "STORE",
            "EXIT"
        ];
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

class ForthCodeAbortQRuntime extends ForthCodeWithHead {
    name() { return "abortq"; }
    execute() {
        let flag = this.popSigned();
        let length = this.memory().wordAt(this.forth.pcNext);
        let addr = this.forth.pcNext + this.forth.wordSize();
        let nextPc = addr + length;
        if ((nextPc & 1) !== 0) {
            nextPc += 1;
        }
        this.forth.pcCurrent = this.forth.pcNext;
        this.forth.pcNext = nextPc;
        if (flag !== 0) {
            let text = (length > 0)
                ? this.memory().memoryCopyFromTo(addr, addr + length - 1)
                : [];
            text.forEach(each => typeCharacter(each));
            this.forth.outputBuffer.push(...text);
            this.forth.abortToQuit();
        }
    }
}

class ForthCodeLitTell extends ForthCodeWithHead {
    name() { return "tell"; }
    execute() {
        let length = this.popSigned();
        let address = this.popUnsigned();
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

// Block primitives

class ForthCodeBlock extends ForthCodeWithHead {
    name() { return "block"; }
    execute() {
		let u = this.popUnsigned();
        let addr = this.forth.blockBuffers.getBlock(this.forth.blockNumberWithOffset(u));
        this.push(addr);
	}
}

class ForthCodeBuffer extends ForthCodeWithHead {
    name() { return "buffer"; }
    execute() {
        let u = this.popUnsigned();
        let addr = this.forth.blockBuffers.getBuffer(this.forth.blockNumberWithOffset(u));
        this.push(addr);
    }
}

class ForthCodeUpdate extends ForthCodeWithHead {
    name() { return "update"; }
    execute() {
        this.forth.blockBuffers.update();
    }
}

class ForthCodeSaveBuffers extends ForthCodeWithHead {
    name() { return "save-buffers"; }
    execute() {
        this.forth.blockBuffers.saveBuffers();
    }
}

class ForthCodeEmptyBuffers extends ForthCodeWithHead {
    name() { return "empty-buffers"; }
    execute() {
        this.forth.blockBuffers.emptyBuffers();
    }
}

class ForthCodeFlush extends ForthCodeWithHead {
    name() { return "flush"; }
    execute() {
        this.forth.blockBuffers.saveBuffers();
        this.forth.blockBuffers.emptyBuffers();
    }
}

function run() {

let val;
let forth = new Forth();

globalThis.forth = forth;
if (typeof window !== "undefined") {
    window.forth = forth;
}
forth.init();

let source = `















: --> IMMEDIATE
    1 BLK +!
    0 >IN !
;

: / /MOD SWAP DROP ;
: MOD /MOD DROP ;

: U/ U/MOD SWAP DROP ;

: 2* 2 * ;
: 2/ 2 / ;

: '\\n' 10 ;
: BL   32 ;
-->
: CR '\\n' EMIT ;
: SPACE BL EMIT ;
: NEGATE 0 SWAP - ;
: TRUE  -1 ;
: FALSE 0 ;
: NOT   0= ;

: LITERAL IMMEDIATE
    ' LIT , , ;
-->
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
: '.' [ CHAR . ] LITERAL ; -->
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
-->
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
-->
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
-->
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
-->
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
-->
: UNLESS IMMEDIATE
	' NOT ,
	[COMPILE] IF
;
-->
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
; -->
(
    From now on we can use ( ... ) for comments.
)

: NIP ( x y -- y ) SWAP DROP ;
: TUCK ( x y -- y x y ) SWAP OVER ;
: PICK ( x_u ... x_1 x_0 u -- x_u ... x_1 x_0 x_u )
	1+	( add one because of 'u' on the stack )
	2 *	( multiply by the word size )
	DSP@ + ( add to the stack pointer )
	@    	 ( and fetch )
;
-->
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
-->
( This is the underlying recursive definition of U. )
: U.		( u -- )
	BASE @ U/MOD	( width rem quot )
    ?DUP IF			( if quotient <> 0 then )
		RECURSE		( print the quotient )
	THEN
	( print the remainder )
	DUP 10 < IF
		'0'	( decimal digits 0..9 )
	ELSE
		10 -	( hex and beyond digits A..Z )
		'A'
	THEN
	+
	EMIT
; -->

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
-->
: UWIDTH	( u -- width )
	BASE @ U/	( rem quot )
	?DUP IF		( if quotient <> 0 then )
		RECURSE 1+	( return 1+recursive call )
	ELSE
		1		( return 1 )
	THEN
;
-->
: U.R		( u width -- )
	SWAP
	DUP
	UWIDTH
	ROT
	SWAP -
	SPACES
	U.
;
-->
: .R ( n width -- )
	SWAP DUP 0< IF
		NEGATE 1 SWAP ROT 1-
	ELSE
		0 SWAP ROT
	THEN
	SWAP DUP UWIDTH ROT SWAP - SPACES SWAP
	IF
		'-' EMIT
	THEN
	U.
;
    
: . 0 .R SPACE ;
: U. U. SPACE ;
-->
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
-->
: DEPTH		( -- n )
	S0 @ DSP@ -
	2- 2 U/
;

: ALIGNED	( addr -- addr )
   ( 1 U+ [ BINARY ] 1111111111111110 [ DECIMAL ] AND )
;

: ALIGN HERE @ ALIGNED HERE ! ;

: C,
	HERE @ C!
	1 HERE +!
;
-->
: S" IMMEDIATE ( -- addr len )
	STATE @ IF ' LITSTRING , HERE @ 0 ,
		BEGIN KEY DUP '"' <> WHILE C, REPEAT DROP
		DUP HERE @ SWAP - 2- SWAP ! ALIGN
	ELSE HERE @
		BEGIN KEY DUP '"' <> WHILE
                OVER C! 1+ REPEAT DROP
		HERE @ - HERE @ SWAP
	THEN
;
-->
: ." IMMEDIATE ( -- )
	STATE @ IF
		[COMPILE] S" ' TELL ,
	ELSE
		BEGIN
			KEY DUP '"' = IF DROP EXIT THEN
			EMIT
		AGAIN
	THEN
;
-->
: CONSTANT
	WORD
	CREATEHEAD
	DOCOL ,
	' LIT ,
	,
	' EXIT ,
;



: ALLOT		( n -- addr )
	HERE @ SWAP
	HERE +!
;
-->
: CELLS ( n -- n ) 2 * ;

: VARIABLE
	1 CELLS ALLOT
	WORD CREATEHEAD
	DOCOL ,
	' LIT ,
	,
	' EXIT ,
;
-->
: VALUE		( n -- )
	WORD CREATEHEAD

	DOCOL ,
	' LIT ,
	,
	' EXIT ,
;
-->
: TO IMMEDIATE	( n -- )
	WORD
	FIND
	>DFA
	2+
	STATE @ IF
		' LIT ,
		,
		' ! ,
	ELSE
		!
	THEN
;
-->
: +TO IMMEDIATE
	WORD
	FIND
	>DFA
	2+
	STATE @ IF
		' LIT ,
		,
		' +! ,
	ELSE
		+!
	THEN
; 
-->
: ID.
	2+		( skip over the link pointer )
	DUP C@		( get the flags/length byte )
	F-LENMASK AND	( just want the length )

	BEGIN
		DUP 0>
	WHILE
		SWAP 1+
		DUP C@
		EMIT
		SWAP 1-
	REPEAT
	2DROP		( len addr -- )
;
-->
: ?HIDDEN
	2+
	C@
	F-HIDDEN AND
;
: ?IMMEDIATE
	2+
	C@
	F-IMMED AND
; 
-->
: WORDS
	CONTEXT @ @
	BEGIN
		?DUP
	WHILE
		DUP ?HIDDEN NOT IF
			DUP ID.
			SPACE
		THEN
		@
	REPEAT
	CR
;
-->
: FORGET
	WORD FIND
	DUP @ CURRENT @ !
	DUP @ LATEST !
	HERE !
;
-->
: DUMP ( addr len -- )
 CR BASE @ -ROT HEX
 BEGIN ?DUP WHILE
  OVER 4 U.R SPACE
  2DUP 1- 15 AND 1+
  BEGIN ?DUP WHILE SWAP DUP C@ 2 .R SPACE 1+ SWAP 1- REPEAT DROP
  2DUP 1- 15 AND 1+
  BEGIN ?DUP WHILE
   SWAP DUP C@ DUP 32 128 WITHIN IF EMIT ELSE DROP '.' EMIT THEN
   1+ SWAP 1-
  REPEAT DROP
  CR
  DUP 1- 15 AND 1+ TUCK - >R + R>
  REPEAT
  DROP BASE !
; -->
: CASE IMMEDIATE
	0 ( push 0 to mark the bottom of the stack )
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
-->
: ENDCASE IMMEDIATE
 ' DROP ,	( compile DROP )

 ( keep compiling THEN until we get to our zero marker )
 BEGIN
 	?DUP
 WHILE
 	[COMPILE] THEN
 REPEAT
;
-->
: CFA>
	CONTEXT @ @	( start at CONTEXT dictionary entry )
	BEGIN
		?DUP
	WHILE
		2DUP SWAP
		< IF
			NIP
			EXIT
		THEN
		@
	REPEAT
	DROP		( restore stack )
	0		( sorry, nothing found )
;
-->
: SEE WORD FIND HERE @ LATEST @
  BEGIN 2 PICK OVER <> WHILE NIP DUP @ REPEAT DROP SWAP
  ':' EMIT SPACE DUP ID. SPACE DUP ?IMMEDIATE
  IF ." IMMEDIATE " THEN >DFA BEGIN 2DUP > WHILE DUP @ CASE
    ' LIT OF 2 + DUP @ . ENDOF
    ' LITSTRING OF [ CHAR S ] LITERAL EMIT '"' EMIT SPACE
      2 + DUP @ SWAP 2 + SWAP 2DUP TELL '"' EMIT SPACE
      + ALIGNED 2 - ENDOF
    ' 0BRANCH OF ." 0BRANCH ( " 2 + DUP @ . ." ) " ENDOF
    ' BRANCH OF ." BRANCH ( " 2 + DUP @ . ." ) " ENDOF
    ' ' OF [ CHAR ' ] LITERAL EMIT SPACE
      2 + DUP @ CFA> ID. SPACE ENDOF
    ' EXIT OF 2DUP 2 + <> IF ." EXIT " THEN ENDOF
    DUP CFA> ID. SPACE ENDCASE
    2 + REPEAT ';' EMIT CR 2DROP ;
-->
: :NONAME
	0 0 CREATEHEAD
	HERE @
	DOCOL ,
	]
;

: ['] IMMEDIATE
	' LIT ,		( compile LIT )
;
-->
: DO IMMEDIATE  ['] SWAP , ['] >R , ['] >R ,
     [COMPILE] BEGIN ;
: LOOP IMMEDIATE ['] R> , ['] R> , ['] SWAP ,
       ['] 1+ ,  ['] 2DUP ,  ['] = ,
    ['] -ROT , ['] SWAP , ['] >R , ['] >R ,
    [COMPILE] UNTIL ['] RDROP , ['] RDROP , ;
: +LOOP IMMEDIATE ['] R> , ['] R> , ['] SWAP ,
        ['] ROT , ['] + ,  ['] 2DUP ,  ['] = ,
    ['] -ROT , ['] SWAP , ['] >R , ['] >R ,
    [COMPILE] UNTIL ['] RDROP , ['] RDROP , ;
: LEAVE R> R> R> DROP DUP 1+ >R >R >R ;
-->
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
-->
: MAX 2DUP > IF DROP ELSE SWAP DROP THEN ;
: MIN 2DUP > IF SWAP DROP ELSE DROP THEN ;

HEX
CFFC CONSTANT PAD
DECIMAL

-->
: LEAVE R> R> R> DROP DUP >R >R >R ;
: -ROT ROT ROT ;
-->
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
-->
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
-->
: DOES> IMMEDIATE
    ['] LIT , HERE @ 6 CELLS + , ['] LATEST , ['] @ ,
    ['] >DFA , ['] ! , ['] EXIT ,
;

: VOCABULARY
	CREATE 0 ,
	DOES> CONTEXT ! ;

: 2@ DUP 2+ @ SWAP @ ;
: 2! TUCK 2+ ! ! ;

: 2CONSTANT CREATE , , DOES> 2@ ;
: 2VARIABLE CREATE 0 , 0 , DOES> ;
-->
: S>D DUP 0< IF -1 ELSE 0 THEN ;


( ---- )

( --- Arithmetic & Double Math --- )
: */ ( n1 n2 n3 -- q ) */MOD SWAP DROP ;
: U* ( u1 u2 -- ud ) UM* ;
-->
: D+ ( l1 h1 l2 h2 -- l3 h3 )
    ROT + >R     ( l1 l2 )      ( R: h1+h2 )
    OVER OVER +  ( l1 l2 l3 )
    DUP >R       ( l1 l2 l3 )   ( R: h1+h2 l3 )
    ROT U< NIP   ( carry )      ( R: h1+h2 l3 )
    IF 1 ELSE 0 THEN
    R> SWAP R> + ;

: DNEGATE ( d -- -d ) INVERT SWAP INVERT SWAP 1 0 D+ ;
: D- ( d1 d2 -- d3 ) DNEGATE D+ ;
: DABS ( d -- |d| ) DUP 0< IF DNEGATE THEN ;
: M+ ( d n -- d+n ) S>D D+ ;
: M/ ( d n -- q ) FM/MOD NIP ;
 -->
( --- Comparisons --- )
: D= ( d1 d2 -- f ) ROT = -ROT = AND ;
: D0= ( d -- f ) OR 0= ;

: D< ( d1 d2 -- f )
    ROT 2DUP = IF
        2DROP U<
    ELSE
        >R >R 2DROP R> R> >
    THEN ;
-->
: DU< ( d1 d2 -- f )
    ROT 2DUP = IF
        2DROP U<
    ELSE
        >R >R 2DROP R> R> SWAP U<
    THEN ;

: DMIN ( d1 d2 -- min ) 2OVER 2OVER D< IF 2DROP
  ELSE 2SWAP 2DROP THEN ;
: DMAX ( d1 d2 -- max ) 2OVER 2OVER D< IF 2SWAP
  2DROP ELSE 2DROP THEN ;

( --- String & Memory --- )
: TYPE ( addr len -- ) TELL ;
: >TYPE ( addr len -- ) TYPE ;
-->
: -TRAILING ( addr len -- addr len' )
    BEGIN
        DUP 0> IF
            2DUP 1- + C@ BL = IF
                1- FALSE
            ELSE TRUE THEN
        ELSE TRUE THEN
    UNTIL ;
-->
: -TEXT ( addr1 len addr2 -- diff )
    >R BEGIN
        DUP 0>
    WHILE
        OVER C@ R@ C@ - ?DUP IF
            >R 2DROP R> R> DROP EXIT
        THEN
        SWAP 1+ SWAP 1-
        R> 1+ >R
    REPEAT
    2DROP R> DROP 0 ;
-->
: MOVE ( addr1 addr2 u -- )
    0 DO
        OVER @ OVER !
        2+ SWAP 2+ SWAP
    LOOP 2DROP ;

: <CMOVE ( addr1 addr2 u -- )
    DUP 0> IF
        1- -1 SWAP DO
            2DUP I + SWAP I + C@ SWAP C!
        -1 +LOOP
    ELSE DROP THEN 2DROP ;

: ERASE ( addr u -- ) 0 FILL ;
: BLANK ( addr u -- ) BL FILL ;
-->
( --- Character I/O --- )
VARIABLE SPAN
-->
: EXPECT ( addr len -- )
  0 SPAN ! OVER + SWAP
  BEGIN
    2DUP = IF TRUE ELSE
      KEY DUP 10 = OVER 13 = OR IF
        DROP SPACE TRUE
      ELSE DUP 8 = OVER 127 = OR IF
        DROP SPAN @ 0> IF
          -1 SPAN +! 1- 8 EMIT BL EMIT 8 EMIT
        THEN FALSE
      ELSE
        DUP EMIT OVER C! 1+ 1 SPAN +! FALSE THEN
      THEN
    THEN
  UNTIL 2DROP
; -->

( --- Compilation --- )
: COMPILE IMMEDIATE
    WORD FIND >CFA
    ' LIT , ,
    ' , , ;

: [CHAR] IMMEDIATE
  CHAR
  [COMPILE] LITERAL
;
-->
( --- Pictured Numeric Output --- )
VARIABLE HLD
: <# ( -- ) PAD HLD ! ;
: HOLD ( char -- ) HLD @ 1- DUP HLD ! C! ;
: #> ( d -- addr len ) 2DROP HLD @ PAD OVER - ;
-->
: # ( d -- d' )
    BASE @ FM/MOD ( rem quot )
    SWAP DUP 9 > IF 7 + THEN '0' + HOLD
    0 ;

: #S ( d -- 0 0 )
    BEGIN # 2DUP OR 0= UNTIL ;

: SIGN ( n -- ) 0< IF '-' HOLD THEN ;

: D. ( d -- )
    DUP >R ( save high cell to return stack )
    DABS <# #S R> SIGN #> TYPE SPACE ;
-->
: D.R ( d width -- )
    >R DUP >R DABS <# #S R> SIGN #> ( addr len )
    ( R: width )
    R> OVER - SPACES TYPE ;

( --- Operating System & Variables --- )
: ?STACK ( -- )
    DSP@ S0 @ > IF ." Stack Underflow " CR QUIT THEN ;

VARIABLE ORIG-HERE   HERE @ ORIG-HERE !
VARIABLE ORIG-LATEST LATEST @ ORIG-LATEST !
: EMPTY ( -- )
    ORIG-HERE @ HERE !
    ORIG-LATEST @ LATEST ! ;
-->
( ABORT" is provided as a JS immediate primitive. )

VARIABLE OFFSET 0 OFFSET !
VARIABLE SCR
VARIABLE R#
: H HERE ;
-->
( --- Virtual Memory --- )
: LIST ( n -- )
    DUP SCR !
    DUP ." Screen " . CR
    BLOCK ( addr )
    16 0 DO
        I DUP 10 < IF
            SPACE '0' + EMIT
        ELSE
            '0' 1+ EMIT 10 - '0' + EMIT
        THEN
        SPACE
        DUP I 64 * + 64 -TRAILING TYPE CR
    LOOP DROP ;
 -->
: L LIST ;

: LOAD ( n -- )
    BLK @ >R
    >IN @ >R
    BLK !
    0 >IN !
    BEGIN
        >IN @ 1024 <
    WHILE
        INTERPRET
    REPEAT
    R> >IN !
    R> BLK !
;
-->
: THRU ( n1 n2 -- )
    1+ SWAP DO I LOAD LOOP
;

: COPY ( n1 n2 -- )
    SWAP BLOCK SWAP BUFFER 1024 CMOVE UPDATE
    SAVE-BUFFERS
;

: WIPE ( n -- )
    BUFFER 1024 BLANK UPDATE SAVE-BUFFERS
;

: SCRUB ( n -- ) WIPE ;
-->
: /LOOP IMMEDIATE
    ['] R> , ['] R> ,     ( -- inc index limit )
    ['] SWAP , ['] ROT ,  ( -- limit index inc )
    ['] + ,               ( -- limit index' )
    ['] 2DUP ,            ( -- limit index' limit index' )
    ['] SWAP , ['] U< ,   ( -- limit index' flag_continue )
    ['] 0= ,              ( -- limit index' flag_exit )
    ['] -ROT , ['] SWAP , ( -- exit_flag index' limit )
    ['] >R , ['] >R ,     ( -- exit_flag )
    [COMPILE] UNTIL
    ['] RDROP , ['] RDROP ,
;
-->
( --- EDITOR vocabulary (Starting Forth style subset) )
VOCABULARY EDITOR
EDITOR DEFINITIONS
VARIABLE ED-LINE
0 ED-LINE !
VARIABLE ED-CURSOR
0 ED-CURSOR !
VARIABLE PARSE-BUF
VARIABLE PARSE-LENPTR
VARIABLE ED-TEMP
VARIABLE ED-TEMP2
VARIABLE ED-SAVE1
VARIABLE ED-SAVE2
VARIABLE ED-MATCH
-->
HERE @ 64 ALLOT CONSTANT ED-IBUF
VARIABLE ED-ILEN
0 ED-ILEN !
HERE @ 64 ALLOT CONSTANT ED-FBUF
VARIABLE ED-FLEN
0 ED-FLEN !
: .OK S" ok" TELL ;
: .NONE S" NONE" TELL ;

: END-PARSE? ( c -- f )
    DUP 94 = IF DROP TRUE EXIT THEN
    DUP 10 = IF DROP TRUE EXIT THEN
    DUP 13 = IF DROP TRUE EXIT THEN
    0=
;
-->
: SET-CURSOR ( n -- )
    DUP ED-CURSOR !
    64 MOD R# !
;

: CUR-BLOCK-ADDR ( -- addr )
    SCR @ BLOCK
;

: LINE-ADDR ( n -- addr )
    64 * CUR-BLOCK-ADDR +
;

: CLINE-ADDR ( -- addr )
    ED-LINE @ LINE-ADDR
; -->
: LINE-END ( -- n )
    ED-LINE @ 1+ 64 *
;
-->
: PARSE-INTO ( addr lenaddr -- )
  PARSE-LENPTR ! PARSE-BUF !
  KEY DUP END-PARSE? IF DROP EXIT THEN
  DUP BL = IF
    DROP KEY DUP END-PARSE? IF
      DROP 0 PARSE-LENPTR @ ! EXIT
    THEN
  THEN
  0 PARSE-LENPTR @ !
  BEGIN DUP END-PARSE? NOT WHILE
    PARSE-LENPTR @ @ 64 < IF
      DUP PARSE-BUF @ PARSE-LENPTR @ @ + C!
      1 PARSE-LENPTR @ +!
    THEN
    KEY
  REPEAT DROP ; -->
: >INSERT ( addr len -- )
    DUP ED-ILEN !
    ED-IBUF 64 BLANK
    ED-IBUF SWAP CMOVE
;

: >FIND ( addr len -- )
    DUP ED-FLEN !
    ED-FBUF 64 BLANK
    ED-FBUF SWAP CMOVE
;

: LINE>INSERT ( addr -- )
    DUP 64 -TRAILING >INSERT DROP
;
-->
: PUT-INSERT ( addr -- )
    DUP 64 BLANK
    ED-IBUF OVER ED-ILEN @ CMOVE
    DROP
;

: FIND-MATCH? ( pos -- f )
    CUR-BLOCK-ADDR + ED-FLEN @ ED-FBUF -TEXT 0=
;
-->
: SEARCH-BLOCK ( start limit -- f )
    ED-TEMP2 !
    BEGIN
        DUP ED-TEMP2 @ <
    WHILE
        DUP FIND-MATCH? IF
            DUP ED-MATCH !
            DROP TRUE EXIT

        THEN
        1+
    REPEAT
    DROP FALSE
;
-->
: FOUND>STATE ( pos -- )
    DUP 64 / ED-LINE !
    ED-FLEN @ + SET-CURSOR
;

: SEARCH-CURRENT-BLOCK ( -- f )
    ED-FLEN @ 0= IF FALSE EXIT THEN
    ED-CURSOR @
    1024 ED-FLEN @ - 1+
    SEARCH-BLOCK
    DUP IF ED-MATCH @ FOUND>STATE THEN
;
-->
: SEARCH-CURRENT-LINE ( -- f )
    ED-FLEN @ 0= IF FALSE EXIT THEN
    ED-CURSOR @
    LINE-END ED-FLEN @ - 1+
    SEARCH-BLOCK
    DUP IF ED-MATCH @ FOUND>STATE THEN
;
-->
: TYPE-CURRENT-LINE ( -- )
    CLINE-ADDR 64 -TRAILING NIP ED-TEMP2 !
    ED-CURSOR @ ED-LINE @ 64 * - DUP
    0< IF DROP 0 THEN ED-TEMP !
    ED-TEMP @ ED-TEMP2 @ MAX ED-MATCH !
    0
    BEGIN DUP ED-MATCH @ <
    WHILE
        DUP ED-TEMP @ = IF 94 EMIT THEN
        DUP ED-TEMP2 @ < IF CLINE-ADDR OVER + C@ EMIT
        ELSE BL EMIT THEN
        1+
    REPEAT
    DUP ED-TEMP @ = IF 94 EMIT THEN
    DROP
; -->
: .LINE-OK ( -- )
    TYPE-CURRENT-LINE
    SPACE ED-LINE @ . SPACE .OK CR
;

: .LINE-BLOCK-OK ( -- )
    TYPE-CURRENT-LINE
    SPACE ED-LINE @ . SPACE SCR @ . SPACE .OK CR
;

: L ( -- )
    SCR @ LIST
;
-->
: T ( n -- )
    DUP ED-LINE !
    64 * SET-CURSOR
    .LINE-OK
;

: P ( -- )
    ED-IBUF ED-ILEN PARSE-INTO
    CLINE-ADDR PUT-INSERT
    UPDATE
;
-->
: (U) ( -- )
    ED-LINE @ 14 <= IF
        ED-LINE @ 1+ LINE-ADDR
        ED-LINE @ 2+ LINE-ADDR
        14 ED-LINE @ - 64 * <CMOVE
        1 ED-LINE +!
    THEN
    ED-LINE @ 64 * SET-CURSOR
    CLINE-ADDR PUT-INSERT
    UPDATE
;
: U ( -- )
    ED-IBUF ED-ILEN PARSE-INTO
    (U)
;
-->
: X ( -- )
    CLINE-ADDR LINE>INSERT
    ED-LINE @ 15 < IF
        ED-LINE @ 1+ LINE-ADDR
        CLINE-ADDR
        15 ED-LINE @ - 64 * CMOVE
    THEN
    15 LINE-ADDR 64 BLANK
    UPDATE
;
-->
: M ( block line -- )
    SWAP ED-TEMP ! ED-TEMP2 !
    X
    ED-TEMP @ SCR !
    ED-TEMP2 @ ED-LINE !
    (U)
;
-->
: F ( -- )
    ED-FBUF ED-FLEN PARSE-INTO
    SEARCH-CURRENT-BLOCK IF
        .LINE-OK
    ELSE
        .NONE CR
    THEN
;
-->
: I ( -- )
  ED-IBUF ED-ILEN PARSE-INTO
  ED-ILEN @ 0= IF .LINE-OK EXIT THEN
  LINE-END ED-CURSOR @ - DUP 0<= IF
    DROP .LINE-OK EXIT
  THEN
  DUP ED-ILEN @ > IF
    LINE-END ED-CURSOR @ - ED-ILEN @ -
    CUR-BLOCK-ADDR ED-CURSOR @ + DUP ED-ILEN @ +
    ROT <CMOVE
  ELSE DROP THEN
  ED-IBUF CUR-BLOCK-ADDR ED-CURSOR @ +
  LINE-END ED-CURSOR @ - ED-ILEN @ MIN CMOVE
  ED-CURSOR @ ED-ILEN @ + LINE-END MIN SET-CURSOR
  UPDATE .LINE-OK
; -->
: E ( -- )
    ED-FLEN @ 0= IF
        .LINE-OK EXIT
    THEN
    ED-CURSOR @ ED-FLEN @ - DUP ED-LINE @ 64 * < IF
        DROP .LINE-OK EXIT
    THEN
    ED-TEMP !
    CUR-BLOCK-ADDR ED-CURSOR @ +
    CUR-BLOCK-ADDR ED-TEMP @ +
    LINE-END ED-CURSOR @ - CMOVE
    LINE-END ED-FLEN @ - ED-FLEN @ BLANK
    ED-TEMP @ SET-CURSOR
    UPDATE
    .LINE-OK
; -->

: D ( -- )
    ED-FBUF ED-FLEN PARSE-INTO
    SEARCH-CURRENT-LINE IF
        E
    ELSE
        .NONE CR
    THEN
;
-->
: R ( -- )
  ED-IBUF ED-ILEN PARSE-INTO
  ED-FLEN @ 0= IF .LINE-OK EXIT THEN
  ED-CURSOR @ ED-FLEN @ - ED-TEMP ! ED-ILEN @ ED-FLEN @ > IF
    ED-ILEN @ ED-FLEN @ - ED-TEMP2 ! LINE-END ED-CURSOR @ -
    ED-TEMP2 @ - DUP 0> IF CUR-BLOCK-ADDR ED-CURSOR @ +
      DUP ED-TEMP2 @ + ROT <CMOVE ELSE DROP THEN THEN
  ED-ILEN @ ED-FLEN @ < IF CUR-BLOCK-ADDR ED-CURSOR @ +
    CUR-BLOCK-ADDR ED-TEMP @ + ED-ILEN @ +
    LINE-END ED-CURSOR @ - CMOVE
    LINE-END ED-FLEN @ ED-ILEN @ - - ED-FLEN @ ED-ILEN @ -
    BLANK THEN
  ED-IBUF CUR-BLOCK-ADDR ED-TEMP @ +
  LINE-END ED-TEMP @ - ED-ILEN @ MIN CMOVE
  ED-TEMP @ ED-ILEN @ + LINE-END MIN SET-CURSOR UPDATE
  .LINE-OK ; -->
: TILL ( -- )
    ED-FBUF ED-FLEN PARSE-INTO
    ED-FLEN @ 0= IF
        .LINE-OK
        EXIT
    THEN
    ED-FLEN @ ED-SAVE1 !
    ED-CURSOR @ ED-SAVE2 !
    SEARCH-CURRENT-LINE IF
        ED-CURSOR @ ED-SAVE2 @ - ED-FLEN !
        E
    ELSE
        .NONE CR
    THEN
    ED-SAVE1 @ ED-FLEN !
; -->
: D-LINE ( n -- ) T ;  ( convenience only, not used )
: S ( n -- )
    ED-FBUF ED-FLEN PARSE-INTO FALSE ED-TEMP !
    SEARCH-CURRENT-BLOCK IF TRUE ED-TEMP !
    ELSE
        SCR @ 1+ SWAP
        DO
            I SCR ! 0 ED-LINE ! 0 SET-CURSOR
            SEARCH-CURRENT-BLOCK IF
                TRUE ED-TEMP !
                LEAVE
            THEN
        LOOP
    THEN
    ED-TEMP @ IF .LINE-BLOCK-OK ELSE .NONE CR THEN
; -->
: N ( -- ) 1 SCR +! ;
: B ( -- ) -1 SCR +! ;
: FLUSH ( -- ) SAVE-BUFFERS ;

DROP
DROP

FORTH DEFINITIONS
-->
( ---------------------------------------- )

: TESTING ; ( will be forgotten )

: HASH
 SWAP 1+ XOR
;
-->
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
-->
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
-->
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
-->
TSTART

    HEX
    T{ -> }T

    T{ : BITSSET? IF 0 0 ELSE 0 THEN ; -> }T
    T{  0 BITSSET? -> 0 }T   ( ZERO IS ALL BITS CLEAR )
    T{  1 BITSSET? -> 0 0 }T
      ( OTHER NUMBER HAVE AT LEAST ONE BIT )
    T{ -1 BITSSET? -> 0 0 }T

    T{ 0 0 AND -> 0 }T
    T{ 0 1 AND -> 0 }T
    T{ 1 0 AND -> 0 }T
    T{ 1 1 AND -> 1 }T
-->
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
-->
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
-->
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
-->
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
-->
    0 INVERT                    CONSTANT MAX-UINT
    0 INVERT 1 RSHIFT           CONSTANT MAX-INT
    0 INVERT 1 RSHIFT INVERT    CONSTANT MIN-INT
    0 INVERT 1 RSHIFT           CONSTANT MID-UINT
    0 INVERT 1 RSHIFT INVERT    CONSTANT MID-UINT+1

    0S CONSTANT <FALSE>
    1S CONSTANT <TRUE>
-->
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
-->
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
-->
    T{ 1 1 < -> <FALSE> }T
    T{ 1 0 < -> <FALSE> }T
    T{ 2 1 < -> <FALSE> }T
    T{ 0 -1 < -> <FALSE> }T
    T{ 1 -1 < -> <FALSE> }T
    T{ 0 MIN-INT < -> <FALSE> }T
    T{ MAX-INT MIN-INT < -> <FALSE> }T
    T{ MAX-INT 0 < -> <FALSE> }T
-->
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
-->
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
-->
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
-->
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
-->
    T{ 0 0 MAX -> 0 }T
    T{ 1 1 MAX -> 1 }T
    T{ 1 0 MAX -> 1 }T
    T{ 2 1 MAX -> 2 }T
    T{ 0 -1 MAX -> 0 }T
    T{ 1 -1 MAX -> 1 }T
    T{ 0 MIN-INT MAX -> 0 }T
    T{ MAX-INT MIN-INT MAX -> MAX-INT }T
    T{ MAX-INT 0 MAX -> MAX-INT }T
-->
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
-->
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
-->
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
-->
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
-->
    T{ 0 NEGATE -> 0 }T
    T{ 1 NEGATE -> -1 }T
    T{ -1 NEGATE -> 1 }T
    T{ 2 NEGATE -> -2 }T
    T{ -2 NEGATE -> 2 }T

    T{ 0 ABS -> 0 }T
    T{ 1 ABS -> 1 }T
    T{ -1 ABS -> 1 }T
    T{ MIN-INT ABS -> MID-UINT+1 }T
-->
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
-->
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
-->
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
-->
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
-->
    T{ DECIMAL 131071. HEX 2CONSTANT 2c0 -> }T
    T{ 2c0 -> 1 -1 }T

    T{ 1 2 2CONSTANT 2c1 -> }T
    T{ 2c1 -> 1 2 }T
    T{ : cd1 2c1 ; -> }T
    T{ cd1 -> 1 2 }T

    T{ : cd2 2CONSTANT ; -> }T
    T{ -1 -2 cd2 2c2 -> }T
    T{ 2c2 -> -1 -2 }T
-->
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
-->
    T{ : cd3 2v2 2! ; -> }T
    T{ -2 -1 cd3 -> }T
    T{ 2v2 2@ -> -2 -1 }T
    T{ 2VARIABLE 2v3 IMMEDIATE 5 6 2v3 2! -> }T
    T{ 2v3 2@ -> 5 6 }T
-->
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
-->
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
-->
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
-->
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
-->
    T{      -7 2       3 */MOD ->      -7 2       3 T*/MOD }T
    T{      -7 2      -3 */MOD ->      -7 2      -3 T*/MOD }T
    T{ MAX-INT 2 MAX-INT */MOD -> MAX-INT 2 MAX-INT T*/MOD }T
    T{ MIN-INT 2 MIN-INT */MOD -> MIN-INT 2 MIN-INT T*/MOD }T

    DECIMAL

    ( Arithmetic )
    T{ 10 2 5 */ -> 4 }T
    T{ 3 4 U* -> 12 0 }T
-->
    ( Double Addition & Math )

    T{ 1 0 2 0 D+ -> 3 0 }T
    T{ -1 0 1 0 D+ -> 0 1 }T  ( Carry test )
    T{ 5 0 2 0 D- -> 3 0 }T
    T{ 0 0 DNEGATE -> 0 0 }T
    T{ 1 0 DNEGATE -> -1 -1 }T
    T{ -1 -1 DABS -> 1 0 }T
    T{ -1 0 1 M+ -> 0 1 }T
-->
    ( Double Comparisons )
    T{ 1 2 1 2 D= -> <TRUE> }T
    T{ 1 2 3 4 D= -> <FALSE> }T
    T{ 0 0 D0= -> <TRUE> }T
    T{ 1 0 D0= -> <FALSE> }T
    T{ 1 0 2 0 D< -> <TRUE> }T
    T{ -1 -1 0 0 D< -> <TRUE> }T
    T{ -1 -1 0 0 DU< -> <FALSE> }T
    T{ 1 0 2 0 DMIN -> 1 0 }T
    T{ 1 0 2 0 DMAX -> 2 0 }T
    ( Memory )
    VARIABLE B1 2 ALLOT
    VARIABLE B2 2 ALLOT
    T{ 0 B1 ! 0 B2 ! B1 B2 1 MOVE B2 @ -> 0 }T
-->
    ( Strings )
    : STR1 S" ABC" ;
    : STR2 S" ABD" ;
    : STR3 S" ABC  " ;

    T{ STR1 STR1 DROP -TEXT -> 0 }T
    T{ STR1 STR2 DROP -TEXT -> -1 }T
    T{ STR3 -TRAILING NIP -> 3 }T

    ( Pictured Output )
    T{ 0 0 <# #S #> NIP -> 1 }T
    T{ 123 0 <# #S #> NIP -> 3 }T
    T{ 123 0 <# #S #> DROP C@ -> 49 }T ( ASCII '1' )
-->
    ( Block primitives and buffers )
    : PUT-BLOCK ( addr len n -- )
        >R
        R@ BUFFER 1024 BLANK
        R@ BUFFER SWAP CMOVE
        UPDATE SAVE-BUFFERS
        R> DROP
    ;

    T{ 20 WIPE -> }T
    T{ CHAR X 20 BUFFER C! UPDATE SAVE-BUFFERS
    EMPTY-BUFFERS 20 BLOCK C@ -> CHAR X }T
-->
    T{ 21 WIPE -> }T
    T{ CHAR Y 21 BUFFER C! UPDATE EMPTY-BUFFERS 21
    BLOCK C@ -> BL }T

    T{ 22 WIPE -> }T
    T{ CHAR Z 22 BUFFER C! UPDATE FLUSH 22 BLOCK C@
    -> CHAR Z }T

    T{ 23 WIPE -> }T
    T{ CHAR Q 23 BUFFER C! UPDATE SAVE-BUFFERS 23 24
    COPY 24 BLOCK C@ -> CHAR Q }T

    T{ 25 WIPE 25 BLOCK C@ -> BL }T
-->
    T{ S" : BLOCK-LOAD-A 333 ; " 26 PUT-BLOCK 26 LOAD
    BLOCK-LOAD-A -> 333 }T

    T{ S" : BLOCK-LOAD-B 444 ; 28 LOAD : BLOCK-LOAD-D
    666 ; " 27 PUT-BLOCK
       S" : BLOCK-LOAD-C 555 ; " 28 PUT-BLOCK
       27 LOAD BLOCK-LOAD-B BLOCK-LOAD-C BLOCK-LOAD-D
       -> 444 555 666 }T

    HEX

    DECIMAL
TEND
-->
: STAR 42 EMIT ;
: STARS   0 DO STAR  LOOP ;
: MARGIN  CR 30 SPACES ;
: BLIP MARGIN STAR ;
: BAR  MARGIN 5 STARS ;
: F    BAR BLIP BAR BLIP BLIP CR ;

: TEST 4 0  do I . I' . ." hello"  CR 2 +LOOP ;

: TEST 10 0 DO I DUP . 5 = IF LEAVE THEN LOOP ;

FORGET TESTING

`.toUpperCase();


let lines = source.replace(/\t/g, "    ").split(/\r?\n/);

let blockContents = [];
let currentBlock = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  currentBlock.push(line);

  let endsBlock = line.trimEnd().endsWith("-->");
  let maxLinesReached = currentBlock.length === 16;

  if (endsBlock || maxLinesReached) {
    blockContents.push(currentBlock);
    currentBlock = [];
  }
}

if (currentBlock.length > 0) {
  blockContents.push(currentBlock);
}

blockContents.forEach((blockLines, blockIndex) => {
  blockLines.forEach((blockLine, lineIndex) => {
	let cutLine = blockLine.slice(0, 64);
	for (let charIndex = 0; charIndex < cutLine.length; charIndex++) {
		let diskAddress = (blockIndex*1024) + (lineIndex*64) + charIndex;
		let aByte = blockLine.charCodeAt(charIndex) & 0xFF;
		forth.disk.setByte(diskAddress, aByte);
	};
  });
});

let bootstrapCode = "1 LOADPRIM";

forth.input(bootstrapCode);

forth.run();

val = forth.outputBufferString();
val = forth.memory.memoryCopyFromTo(forth.memory.dsp, forth.memory.s0()-1);

//val = forth.memory.memoryCopyFromTo(1018, 1050);
//console.log(val);

console.log("finished!");
return forth;
}

function assertHost(condition, message)
{
    if (!condition) throw new Error(message);
}

function setDiskBlockText(forth, blockNumber, text)
{
    forth.disk.clearBlock(blockNumber, 32);
    let start = blockNumber * 1024;
    let limit = Math.min(text.length, 1024);
    for (let i = 0; i < limit; i++) {
        forth.disk.setByte(start + i, text.charCodeAt(i) & 0xFF);
    }
}

function setDiskBlockLines(forth, blockNumber, lines)
{
    forth.disk.clearBlock(blockNumber, 32);
    let start = blockNumber * 1024;
    lines.forEach((line, lineIndex) => {
        let cutLine = line.slice(0, 64);
        for (let i = 0; i < cutLine.length; i++) {
            forth.disk.setByte(start + lineIndex * 64 + i, cutLine.charCodeAt(i) & 0xFF);
        }
    });
}

function runForthSnippet(forth, text)
{
    let before = forth.outputBuffer.length;
    forth.input(text);
    forth.makeRunning();
    forth.run();
    return forth.outputBuffer.slice(before).toByteString();
}

function runHostBlockTests(forth)
{
    setDiskBlockLines(forth, 60, [
        "FIRST LINE",
        "SECOND LINE"
    ]);

    let listing = runForthSnippet(forth, "60 LIST ");
    assertHost(listing.includes("SCREEN 60"), "LIST did not print the expected screen header");
    assertHost(listing.includes("FIRST LINE"), "LIST did not print the first line");
    assertHost(listing.includes("SECOND LINE"), "LIST did not print the second line");

    setDiskBlockLines(forth, 61,[': HOST-LOAD-ONE 901 ; 62 LOAD : HOST-LOAD-THREE 903 ; ']);
    setDiskBlockLines(forth, 62,[': HOST-LOAD-TWO 902 ; ']);
    let loaded = runForthSnippet(forth, '61 LOAD HOST-LOAD-ONE . HOST-LOAD-TWO . HOST-LOAD-THREE . ');
    assertHost(loaded.includes("901 902 903"), "Nested LOAD did not restore BLK and >IN correctly");

    setDiskBlockLines(forth, 63,[
        "",
        "SECOND VISIBLE LINE"
    ]);
    let blankFirstLine = runForthSnippet(forth, "63 LIST ");
    assertHost(blankFirstLine.includes("SCREEN 63"), "LIST with a blank first line did not print the expected header");
    assertHost(blankFirstLine.includes("SECOND VISIBLE LINE"), "LIST with a blank first line did not reach the next line");

    setDiskBlockLines(forth, 64, ["ALPHA SCREEN"]);
    setDiskBlockLines(forth, 65, ["BETA SCREEN"]);
    let list64 = runForthSnippet(forth, "64 LIST ");
    let list65 = runForthSnippet(forth, "65 LIST ");
    assertHost(list64.includes("ALPHA SCREEN"), "LIST did not show block 64 contents");
    assertHost(!list64.includes("BETA SCREEN"), "LIST for block 64 leaked block 65 contents");
    assertHost(list65.includes("BETA SCREEN"), "LIST did not show block 65 contents");
    assertHost(!list65.includes("ALPHA SCREEN"), "LIST for block 65 leaked block 64 contents");

    setDiskBlockLines(forth, 70,['71 BUFFER DUP CHAR X SWAP C! UPDATE SAVE-BUFFERS']);
    setDiskBlockLines(forth, 71, [""]);
    runForthSnippet(forth, '70 LOAD ');
    let afterUpdateDuringLoad = runForthSnippet(forth, '71 BLOCK C@ . ');
    assertHost(afterUpdateDuringLoad.includes("88"), "UPDATE during LOAD did not persist the explicitly buffered block");
}



function currentBlockLineText(forth, blockNumber, lineNumber)
{
    let addr = forth.blockBuffers.getBlock(blockNumber);
    let chars = [];
    for (let i = 0; i < 64; i++) {
        let code = forth.memory.byteAt(addr + lineNumber * 64 + i);
        chars.push(String.fromCharCode(code === 0 ? 32 : code));
    }
    return chars.join("").replace(/[ \x00]+$/, "");
}

function runHostEditorForthTests()







{
    let forth;

    forth = run();
    setDiskBlockLines(forth, 80, ["ALPHA", "BRAVO"]);
    runForthSnippet(forth, "EDITOR 80 SCR ! 0 T P HELLO^ ");
    assertHost(currentBlockLineText(forth, 80, 0) === "HELLO", "EDITOR P failed");
    assertHost(currentBlockLineText(forth, 80, 1) === "BRAVO", "EDITOR P damaged next line");

    forth = run();
    setDiskBlockLines(forth, 81, ["ONE", "TWO", "THREE"]);
    runForthSnippet(forth, "EDITOR 81 SCR ! 0 T U INSERTED^ ");
    assertHost(currentBlockLineText(forth, 81, 0) === "ONE", "EDITOR U changed current line");
    assertHost(currentBlockLineText(forth, 81, 1) === "INSERTED", "EDITOR U failed to insert below");
    assertHost(currentBlockLineText(forth, 81, 2) === "TWO", "EDITOR U failed to shift line 1");
    assertHost(currentBlockLineText(forth, 81, 3) === "THREE", "EDITOR U damaged later lines");

    forth = run();
    setDiskBlockLines(forth, 82, ["ONE", "TWO", "THREE"]);
    runForthSnippet(forth, "EDITOR 82 SCR ! 1 T X 2 T P ^ ");
    assertHost(currentBlockLineText(forth, 82, 0) === "ONE", "EDITOR X damaged first line");
    assertHost(currentBlockLineText(forth, 82, 1) === "THREE", "EDITOR X did not pull line up");
    assertHost(currentBlockLineText(forth, 82, 2) === "TWO", "EDITOR X/P did not preserve insert buffer");

    forth = run();
    setDiskBlockLines(forth, 83, ["HELLO HELLO"]);
    runForthSnippet(forth, "EDITOR 83 SCR ! 0 T F HELLO^ D ^ ");
    assertHost(currentBlockLineText(forth, 83, 0) === "HELLO", "EDITOR F/D failed");

    forth = run();
    setDiskBlockLines(forth, 84, ["ABC DEF GHI"]);
    runForthSnippet(forth, "EDITOR 84 SCR ! 0 T F DEF^ TILL GHI^ ");
    assertHost(currentBlockLineText(forth, 84, 0) === "ABC DEF", "EDITOR TILL failed");

    forth = run();
    setDiskBlockLines(forth, 85, ["ABEF"]);
    runForthSnippet(forth, "EDITOR 85 SCR ! 0 T F AB^ I CD^ ");
    assertHost(currentBlockLineText(forth, 85, 0) === "ABCDEF", "EDITOR I failed");

    forth = run();
    setDiskBlockLines(forth, 86, ["ABXXEF"]);
    runForthSnippet(forth, "EDITOR 86 SCR ! 0 T F XX^ R CD^ ");
    assertHost(currentBlockLineText(forth, 86, 0) === "ABCDEF", "EDITOR R failed");

    forth = run();
    setDiskBlockLines(forth, 87, ["SOURCE"]);
    setDiskBlockLines(forth, 88, ["DEST0", "DEST1"]);
    runForthSnippet(forth, "EDITOR 87 SCR ! 0 T 88 0 M ");
    assertHost(currentBlockLineText(forth, 88, 0) === "DEST0", "EDITOR M damaged destination line 0");
    assertHost(currentBlockLineText(forth, 88, 1) === "SOURCE", "EDITOR M failed to move line under destination");
    assertHost(currentBlockLineText(forth, 88, 2) === "DEST1", "EDITOR M damaged destination line 1");
}


function addchar(char)
{
    globalThis.forth.inputBuffer.push(char & 0xFF);

    if (char === 95) // underscore
    {
        globalThis.forth.inputBuffer.pop();
        globalThis.forth.inputBuffer.pop();
    }

    if (char === 10) {
        typeCharacter(32);
        globalThis.forth.makeRunning();
        globalThis.forth.run();
    } else {
        typeCharacter(char);
    }
}

function typeError(aString)
{
    for (let i = 0; i < aString.length; i++)
        typeCharacter(aString.charCodeAt(i));
    typeCharacter(10);
}

function typeOk()
{
    typeError("OK");
}