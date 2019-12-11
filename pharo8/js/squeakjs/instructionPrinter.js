module('users.bert.SqueakJS.instructionPrinter').requires("users.bert.SqueakJS.vm").toRun(function() {
    
    "use strict";


    
    Object.subclass('Squeak.InstructionPrinter',
    'initialization', {
        initialize: function(method, vm) {
            this.method = method;
            this.vm = vm;
        },
    },
    'printing', {
        printInstructions: function(indent, highlight, highlightPC) {
            // all args are optional
            this.indent = indent;           // prepend to every line except if highlighted
            this.highlight = highlight;     // prepend to highlighted line
            this.highlightPC = highlightPC; // PC of highlighted line
            this.innerIndents = {};
            this.result = '';
            this.scanner = new Squeak.InstructionStream(this.method, this.vm);
            this.oldPC = this.scanner.pc;
            this.endPC = 0;                 // adjusted while scanning
            this.done = false;
            while (!this.done)
                this.scanner.interpretNextInstructionFor(this);
            return this.result;
        },
        print: function(instruction) {
            if (this.oldPC === this.highlightPC) {
                if (this.highlight) this.result += this.highlight;
            } else {
                if (this.indent) this.result += this.indent;
            }
            this.result += this.oldPC;
            for (var i = 0; i < this.innerIndents[this.oldPC] || 0; i++)
                this.result += "   ";
            this.result += " <";
            for (var i = this.oldPC; i < this.scanner.pc; i++) {
                if (i > this.oldPC) this.result += " ";
                this.result += (this.method.bytes[i]+0x100).toString(16).substr(-2).toUpperCase(); // padded hex
            }
            this.result += "> " + instruction + "\n";
            this.oldPC = this.scanner.pc;
        }
    },
    'decoding', {
        blockReturnTop: function() {
            this.print('blockReturn');
        },
        doDup: function() {
            this.print('dup');
        },
        doPop: function() {
            this.print('pop');
        },
        jump: function(offset) {
            this.print('jumpTo: ' + (this.scanner.pc + offset));
            if (this.scanner.pc + offset > this.endPC) this.endPC = this.scanner.pc + offset;
        },
        jumpIf: function(condition, offset) {
            this.print((condition ? 'jumpIfTrue: ' : 'jumpIfFalse: ') + (this.scanner.pc + offset));
            if (this.scanner.pc + offset > this.endPC) this.endPC = this.scanner.pc + offset;
        },
        methodReturnReceiver: function() {
            this.print('return: receiver');
            this.done = this.scanner.pc > this.endPC;
        },
        methodReturnTop: function() {
            this.print('return: topOfStack');
            this.done = this.scanner.pc > this.endPC;
        },
        methodReturnConstant: function(obj) {
            this.print('returnConst: ' + obj.toString());
            this.done = this.scanner.pc > this.endPC;
        },
        popIntoLiteralVariable: function(anAssociation) {
            this.print('popIntoBinding: ' + anAssociation.assnKeyAsString());
        },
        popIntoReceiverVariable: function(offset) {
            this.print('popIntoInstVar: ' + offset);
        },
        popIntoTemporaryVariable: function(offset) {
            this.print('popIntoTemp: ' + offset);
        },
        pushActiveContext: function() {
            this.print('push: thisContext');
        },
        pushConstant: function(obj) {
            var value = obj.sqInstName ? obj.sqInstName() : obj.toString();
            this.print('pushConst: ' + value);
        },
        pushLiteralVariable: function(anAssociation) {
            this.print('pushBinding: ' + anAssociation.assnKeyAsString());
        },
        pushReceiver: function() {
            this.print('push: self');
        },
        pushReceiverVariable: function(offset) {
            this.print('pushInstVar: ' + offset);
        },
        pushTemporaryVariable: function(offset) {
            this.print('pushTemp: ' + offset);
        },
        send: function(selector, numberArguments, supered) {
            this.print( (supered ? 'superSend: #' : 'send: #') + (selector.bytesAsString ? selector.bytesAsString() : selector));
        },
        storeIntoLiteralVariable: function(anAssociation) {
            this.print('storeIntoBinding: ' + anAssociation.assnKeyAsString());
        },
        storeIntoReceiverVariable: function(offset) {
            this.print('storeIntoInstVar: ' + offset);
        },
        storeIntoTemporaryVariable: function(offset) {
            this.print('storeIntoTemp: ' + offset);
        },
        pushNewArray: function(size) {
            this.print('push: (Array new: ' + size + ')');
        },
        popIntoNewArray: function(numElements) {
            this.print('pop: ' + numElements + ' into: (Array new: ' + numElements + ')');
        },
        pushRemoteTemp: function(offset , arrayOffset) {
            this.print('push: ' + offset + ' ofTemp: ' + arrayOffset);
        },
        storeIntoRemoteTemp: function(offset , arrayOffset) {
            this.print('storeInto: ' + offset + ' ofTemp: ' + arrayOffset);
        },
        popIntoRemoteTemp: function(offset , arrayOffset) {
            this.print('popInto: ' + offset + ' ofTemp: ' + arrayOffset);
        },
        pushClosureCopy: function(numCopied, numArgs, blockSize) {
            var from = this.scanner.pc,
                to = from + blockSize;
            this.print('closure(' + from + '-' + (to-1) + '): ' + numCopied + ' copied, ' + numArgs + ' args');
            for (var i = from; i < to; i++)
                this.innerIndents[i] = (this.innerIndents[i] || 0) + 1;
            if (to > this.endPC) this.endPC = to;
        },
        callPrimitive: function(primitiveIndex) {
            this.print('primitive: ' + primitiveIndex);
        },
    });
    
    Object.subclass('Squeak.InstructionStream',
    'initialization', {
        initialize: function(method, vm) {
            this.vm = vm;
            this.method = method;
            this.pc = 0;
            this.specialConstants = [vm.trueObj, vm.falseObj, vm.nilObj, -1, 0, 1, 2];
        },
    },
    'decoding',
    {
        interpretNextInstructionFor: function(client) {
            // Send to the argument, client, a message that specifies the type of the next instruction.
            var method = this.method;
            var byte = method.bytes[this.pc++];
            var type = (byte / 16) | 0;
            var offset = byte % 16;
            if (type === 0) return client.pushReceiverVariable(offset);
            if (type === 1) return client.pushTemporaryVariable(offset);
            if (type === 2) return client.pushConstant(method.methodGetLiteral(offset));
            if (type === 3) return client.pushConstant(method.methodGetLiteral(offset + 16));
            if (type === 4) return client.pushLiteralVariable(method.methodGetLiteral(offset));
            if (type === 5) return client.pushLiteralVariable(method.methodGetLiteral(offset + 16));
            if (type === 6)
                if (offset<8) return client.popIntoReceiverVariable(offset)
                else return client.popIntoTemporaryVariable(offset-8);
            if (type === 7) {
                if (offset===0) return client.pushReceiver()
                if (offset < 8) return client.pushConstant(this.specialConstants[offset - 1])
                if (offset===8) return client.methodReturnReceiver();
                if (offset < 12) return client.methodReturnConstant(this.specialConstants[offset - 9]);
                if (offset===12) return client.methodReturnTop();
                if (offset===13) return client.blockReturnTop();
                if (offset > 13) throw Error("unusedBytecode");
            }
            if (type === 8) return this.interpretExtension(offset, method, client);
            if (type === 9) // short jumps
                    if (offset<8) return client.jump(offset+1);
                    else return client.jumpIf(false, offset-8+1);
            if (type === 10) {// long jumps
                byte = this.method.bytes[this.pc++];
                if (offset<8) return client.jump((offset-4)*256 + byte);
                else return client.jumpIf(offset<12, (offset & 3)*256 + byte);
            }
            if (type === 11)
                return client.send(this.vm.specialSelectors[2 * offset],
                    this.vm.specialSelectors[2 * offset + 1],
                    false);
            if (type === 12)
                return client.send(this.vm.specialSelectors[2 * (offset + 16)],
                    this.vm.specialSelectors[2 * (offset + 16) + 1],
                    false);
            if (type > 12)
                return client.send(method.methodGetLiteral(offset), type-13, false);
        },
        interpretExtension: function(offset, method, client) {
            if (offset <= 6) { // Extended op codes 128-134
                var byte2 = this.method.bytes[this.pc++];
                if (offset <= 2) { // 128-130:  extended pushes and pops
                    var type = byte2 / 64 | 0;
                    var offset2 = byte2 % 64;
                    if (offset === 0) {
                        if (type === 0) return client.pushReceiverVariable(offset2);
                        if (type === 1) return client.pushTemporaryVariable(offset2);
                        if (type === 2) return client.pushConstant(this.method.methodGetLiteral(offset2));
                        if (type === 3) return client.pushLiteralVariable(this.method.methodGetLiteral(offset2));
                    }
                    if (offset === 1) {
                        if (type === 0) return client.storeIntoReceiverVariable(offset2);
                        if (type === 1) return client.storeIntoTemporaryVariable(offset2);
                        if (type === 2) throw Error("illegalStore");
                        if (type === 3) return client.storeIntoLiteralVariable(this.method.methodGetLiteral(offset2));
                    }
                    if (offset === 2) {
                        if (type === 0) return client.popIntoReceiverVariable(offset2);
                        if (type === 1) return client.popIntoTemporaryVariable(offset2);
                        if (type === 2) throw Error("illegalStore");
                        if (type === 3) return client.popIntoLiteralVariable(this.method.methodGetLiteral(offset2));
                    }
                }
                // 131-134 (extended sends)
                if (offset === 3) // Single extended send
                    return client.send(this.method.methodGetLiteral(byte2 % 32), byte2 / 32 | 0, false);
                if (offset === 4) { // Double extended do-anything
                    var byte3 = this.method.bytes[this.pc++];
                    var type = byte2 / 32 | 0;
                    if (type === 0) return client.send(this.method.methodGetLiteral(byte3), byte2 % 32, false);
                    if (type === 1) return client.send(this.method.methodGetLiteral(byte3), byte2 % 32, true);
                    if (type === 2) return client.pushReceiverVariable(byte3);
                    if (type === 3) return client.pushConstant(this.method.methodGetLiteral(byte3));
                    if (type === 4) return client.pushLiteralVariable(this.method.methodGetLiteral(byte3));
                    if (type === 5) return client.storeIntoReceiverVariable(byte3);
                    if (type === 6) return client.popIntoReceiverVariable(byte3);
                    if (type === 7) return client.storeIntoLiteralVariable(this.method.methodGetLiteral(byte3));
                }
                if (offset === 5) // Single extended send to super
                    return client.send(this.method.methodGetLiteral(byte2 & 31), byte2 >> 5, true);
                if (offset === 6) // Second extended send
                    return client.send(this.method.methodGetLiteral(byte2 & 63), byte2 >> 6, false);
            }
            if (offset === 7) return client.doPop();
            if (offset === 8) return client.doDup();
            if (offset === 9) return client.pushActiveContext();
            // closures
            var byte2 = this.method.bytes[this.pc++];
            if (offset === 10)
                return byte2 < 128 ? client.pushNewArray(byte2) : client.popIntoNewArray(byte2 - 128);
            var byte3 = this.method.bytes[this.pc++];
            if (offset === 11) return client.callPrimitive(byte2 + 256 * byte3);
            if (offset === 12) return client.pushRemoteTemp(byte2, byte3);
            if (offset === 13) return client.storeIntoRemoteTemp(byte2, byte3);
            if (offset === 14) return client.popIntoRemoteTemp(byte2, byte3);
            // offset === 15
            var byte4 = this.method.bytes[this.pc++];
            return client.pushClosureCopy(byte2 >> 4, byte2 & 0xF, (byte3 * 256) + byte4);
        }
    });
    
}) // end of module   