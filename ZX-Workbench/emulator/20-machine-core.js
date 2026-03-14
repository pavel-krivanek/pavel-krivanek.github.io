// Video/layout constants, Z80 core, Interface 1 plugin, and base emulation speed. Original top-level statements 40-43.
(function (Q, T, d, g, g1) {
  with (Q) {
    Q.C1 = 5;
    Q.T5 = 40;
    Q.U1 = 8 * (C1 + 32 + C1);
    Q.L5 = T5 + 192 + T5;
    Q.A1 = (keyMatrixRows = $1(8).fill(255), 1);
    Q.R5 = 4;
    Q.D1 = 8;
    Q.q5 = 16;
    Q.M5 = 64;
    Q.I1 = [{
      T: D1 | q5 | 32,
      R: [69888, 14335, 224, 32],
      q: "48"
    }, {
      T: A1 | D1 | q5 | 32 | M5,
      R: [70908, 14361, 228, 36],
      q: "128s"
    }, {
      T: R5 | D1,
      R: [69888, 14320, 224, 32],
      q: "tc2k"
    }, {
      T: A1 | M5,
      R: [71680, 17985, 224, 36],
      q: "128s"
    }];
    {
      cpuCore = new function (f) {
        var pc, regA, l, u, c, s, sp, regB, regC, regD, regE, regHL, regIX, regIY, altA, e, B, N, O, altB, altC, altD, altE, altHL, regIR, interruptMode, iffState, wz, prefixState, isHalted, opcodeTable, indexedOpcodeTable, edOpcodeTable, cbRotateTable, cbBitSetResetTable;
        function packFlags() {
          var e = s >> 8,
            t = u ^ c;
          return 168 & l | l >> 8 & 1 | !u << 6 | 2 & e | 16 & (t ^ s ^ e) | 4 & (256 & c ? 154020 >> (15 & (u ^ u >> 4)) : (t & (s ^ u)) >> 5);
        }
        function unpackFlags(e) {
          u = 64 & ~e, l = e |= e << 8, c = 255 & (s = -129 & e | (4 & e) << 5);
        }
        function setBC(e) {
          regB = e >> 8, regC = 255 & e;
        }
        function setDE(e) {
          regD = e >> 8, regE = 255 & e;
        }
        function swapBCDEHLWithAlt() {
          [regB, regC, regD, regE, regHL, altB, altC, altD, altE, altHL] = [altB, altC, altD, altE, altHL, regB, regC, regD, regE, regHL];
        }
        function swapAFScratchWithAlt() {
          [regA, l, u, c, s, altA, e, B, N, O] = [altA, e, B, N, O, regA, l, u, c, s];
        }
        function writeByteTimed(e, t) {
          f.put(e, t), f.time += 3;
        }
        function push16(e) {
          f.time++, f.put(sp - 1 & 65535, e >> 8), f.time += 3, f.put(sp = sp - 2 & 65535, 255 & e), f.time += 3;
        }
        function pop16() {
          var e = f.get(sp);
          return f.time += 3, e |= f.get(sp + 1 & 65535) << 8, f.time += 3, sp = sp + 2 & 65535, e;
        }
        function compare8(e) {
          var t = (c = regA) - e;
          s = ~e, l = 384 & t | 40 & e, u = 255 & t;
        }
        function inc8(e) {
          return l = 256 & l | (u = e = (c = e) + (s = 1) & 255), e;
        }
        function dec8(e) {
          return l = 256 & l | (u = e = (c = e) + (s = -1) & 255), e;
        }
        function setLogicResult8(e) {
          l = 256 & l | (u = e), c = 256 | e, s = 0;
        }
        function setAccumulatorFromShiftResult(e) {
          l = 215 & l | 296 & e, s &= 128, c = 384 & c | 16 & u, regA = 255 & e;
        }
        function add16(e, t) {
          var r = e + t;
          return l = 128 & l | r >> 8 & 296, c &= -17, s = 128 & s | 16 & ((r ^ e ^ t) >> 8 ^ u), wz = e + 1, f.time += 7, 65535 & r;
        }
        function fetchByte() {
          var e = f.get(pc);
          return pc = pc + 1 & 65535, f.time += 3, e;
        }
        function fetchWord() {
          var e = f.get(pc);
          return f.time += 3, e |= f.get(pc + 1 & 65535) << 8, f.time += 3, pc = pc + 2 & 65535, e;
        }
        function updateLogicFlagsFromResult(e) {
          c &= -17, s = 128 & s | 16 & (e >> 4 ^ u), l = 256 ^ e | 128 & l | 40 & regA;
        }
        function jumpRelative() {
          wz = pc = pc + (128 ^ f.get(pc)) - 127 & 65535, f.time += 8;
        }
        function jumpOrCallConditional(e) {
          wz = fetchWord(), e && (push16(pc), pc = wz);
        }
        function ret() {
          wz = pc = pop16();
        }
        function runHalt() {
          isHalted = !0;
          var e = f.limit - f.time + 3 >> 2;
          0 < e && (e = f.halt(e, pc, regIR), regIR = -128 & regIR | regIR + e & 127, f.time += 4 * e);
        }
        function acceptInterrupt() {
          isHalted = !1, iffState = 0, regIR = -128 & regIR | regIR + 1 & 127, f.time += 6;
          var t,
            r = f.int;
          if (interruptMode) {
            push16(pc);
            let e = 56;
            1 < interruptMode && (t = 65280 & regIR | r, e = f.get(t), f.time += 3, e |= f.get(1 + t & 65535) << 8, f.time += 3), wz = pc = e;
          } else opcodeTable[r]();
        }
        function indexedAddress(e) {
          var t = f.get(pc);
          return pc = pc + 1 & 65535, f.time += 8, wz = e + (128 ^ t) - 128 & 65535;
        }
        function indexedReadByte(e) {
          var t = f.get(pc);
          return pc = pc + 1 & 65535, f.time += 8, t = f.get(wz = e + (128 ^ t) - 128 & 65535), f.time += 3, t;
        }
        function addToHL(e, t) {
          t = regHL + e + (l >> 8 & 1 ^ t);
          wz = regHL + 1, l = t >> 8, c = regHL >> 8, s = e >> 8, regHL = t &= 65535, u = t >> 8 | t << 8, f.time += 7;
        }
        function loadA(e) {
          l = 256 & l | (regA = e), u = +!!e, c = s = iffState << 6 & 128, f.time++;
        }
        function inputFromBC() {
          var e = regB << 8 | regC,
            t = f.in(e);
          return wz = 1 + e, setLogicResult8(t), f.time += 4, t;
        }
        function outputToBC(e) {
          var t = regB << 8 | regC;
          wz = 1 + t, f.out(t, e), f.time += 4;
        }
        function blockTransfer(e, t) {
          var r = regHL,
            n = f.get(r);
          f.time += 3, regHL = r + e & 65535, r = regD << 8 | regE, f.put(r, n), f.time += 5, regD = (r += e) >> 8 & 255, regE = 255 & r, --regC < 0 && (regB = regB - 1 & (regC = 255)), n = (c = s = regB | regC && 128) && t ? (f.time += 5, wz = 1 + (pc = pc - 2 & 65535), pc >> 8) : (n += regA) << 4 | 8 & n, l = 384 & l | 40 & n, u = u && 1;
        }
        function blockCompare(e, t) {
          var r = regHL,
            n = f.get(r),
            i = regA - n & 255;
          regHL = r + e & 65535, f.time += 8, --regC < 0 && (regB = regB - 1 & (regC = 255)), l = 256 & l | 128 & i, u = 127 & i | i >> 7, s = ~(128 | n), c = 127 & regA, regB | regC && (c |= 128, s |= 128, t) && i ? (f.time += 5, wz = 1 + (pc = pc - 2 & 65535), l |= pc >> 8 & 40) : (16 & (i ^ n ^ regA) && i--, l |= i << 4 & 32 | 8 & i, wz += e);
        }
        function blockIo(e) {
          var t,
            r = e >> 2,
            n = regHL + r & 65535,
            i = regB << 8 | regC;
          if (f.time++, r = 1 & e ? (t = f.get(regHL), f.time += 3, wz = (i = i - 256 & 65535) + r, f.out(i, t), f.time += 4, n) : (t = f.in(i), f.time += 4, wz = i + r, i = i - 256 & 65535, f.put(regHL, t), f.time += 3, i + r), regHL = n, n = 7 & (r = (255 & r) + t) ^ (regB = i >> 8), l = regB | 256 & r, c = 128 ^ (u = regB), 2 & e && regB) {
            f.time += 5, wz = 1 + (pc = pc - 2 & 65535), l = -41 & l | pc >> 8 & 40;
            let e = 0;
            256 & r && (e = 128 & t ? 1 : -1, regB - (e >> 1) & 15) && (r ^= 256), n ^= regB - e & 7;
          }
          s = 128 & ((n = 4928640 >> (15 & (n ^ n >> 4))) ^ regB) | r >> 4 & 16 | t << 2 & 512;
        }
        function negA() {
          regA = u = 255 & (l = 1 + (s = ~regA)), c = 0;
        }
        function restoreIffAndRet() {
          iffState |= iffState >> 1, ret();
        }
        function rotateShiftByMode(e, t) {
          return t = [e => 257 * e >> 7, e => e >> 1 | (1 + (1 & e) ^ 1) << 7, e => e << 1 | l >> 8 & 1, e => (513 * e | 256 & l) >> 1, e => e << 1, e => (513 * e + 128 ^ 128) >> 1, e => e << 1 | 1, e => 513 * e >> 1][e](t), c = 256 | (u = t = 255 & (l = t)), s = 0, t;
        }
        function setBitTestFlags(e, t) {
          l = 256 & l | 40 & t | (t &= 1 << e), c = ~(u = t), s = 0;
        }
        pc = regIR = interruptMode = iffState = 0, sp = regIX = regIY = regHL = altHL = 65535, regA = regB = regC = regD = regE = altA = altB = altC = altD = altE = 255, l = u = c = s = e = B = N = O = wz = 0, prefixState = 0, isHalted = !1, this.getState = e => {
          var t = {
            pc: pc,
            sp: sp,
            a: regA,
            f: packFlags(),
            bc: regB << 8 | regC,
            de: regD << 8 | regE,
            hl: regHL,
            ix: regIX,
            iy: regIY,
            bc_: altB << 8 | altC,
            de_: altD << 8 | altE,
            hl_: altHL,
            a_: altA,
            r: 255 & regIR,
            i: regIR >> 8,
            im: interruptMode,
            iff: iffState,
            wz: 65535 & wz,
            px: prefixState,
            halt: isHalted
          };
          return swapAFScratchWithAlt(), t.f_ = packFlags(), swapAFScratchWithAlt(), t;
        }, this.setState = e => {
          var t;
          pc = e.pc ?? pc, sp = e.sp ?? sp, regA = e.a ?? regA, (t = e.f) != g1 && unpackFlags(t), setBC(e.bc ?? regB << 8 | regC), setDE(e.de ?? regD << 8 | regE), regHL = e.hl ?? regHL, regIX = e.ix ?? regIX, regIY = e.iy ?? regIY, swapBCDEHLWithAlt(), swapAFScratchWithAlt(), regA = e.a_ ?? regA, (t = e.f_) != g1 && unpackFlags(t), setBC(e.bc_ ?? regB << 8 | regC), setDE(e.de_ ?? regD << 8 | regE), regHL = e.hl_ ?? regHL, swapBCDEHLWithAlt(), swapAFScratchWithAlt(), regIR = (e.r ?? 255 & regIR) | (e.i ?? regIR >> 8) << 8, interruptMode = 3 & (e.im ?? interruptMode), iffState = e.iff ?? iffState, wz = e.wz ?? wz, prefixState = e.px ?? prefixState, isHalted = e.halt ?? isHalted;
        }, this.run = e => {
          var t, r, n;
          if (isHalted && (prefixState || 1 & ~iffState || f.int < 0)) return runHalt();
          for (; f.time < f.limit;) if (!prefixState && iffState & 0 <= f.int) acceptInterrupt();else {
            if (t = f.m1(pc, regIR, prefixState), pc = pc + 1 & 65535, regIR = -128 & regIR | regIR + 1 & 127, f.time += 4, r = prefixState) {
              if (118 == t & iffState & (prefixState = 0) <= f.int) {
                acceptInterrupt();
                continue;
              }
              if (221 == (223 & r) && (r = 32 & r, n = indexedOpcodeTable[t])) {
                (n = n(r ? regIY : regIX)) != g1 && (r ? regIY = n : regIX = n);
                continue;
              }
            }
            opcodeTable[t]();
          }
        }, this.nmi = e => {
          isHalted = !1, iffState &= 2, regIR = -128 & regIR | regIR + 1 & 127, f.time += 6, push16(pc), pc = 102;
        }, this.reset = e => {
          isHalted = !1, pc = regIR = interruptMode = iffState = 0;
        }, opcodeTable = [e => e, e => (e = fetchWord(), regB = e >> 8, regC = 255 & e), e => (writeByteTimed(e = regB << 8 | regC, regA), wz = 1 + e & 255 | regA << 8), e => ((regC = regC + 1 & 255) || (regB = regB + 1 & 255), f.time += 2), e => regB = inc8(regB), e => regB = dec8(regB), e => regB = fetchByte(), e => setAccumulatorFromShiftResult(257 * regA >> 7), swapAFScratchWithAlt, e => regHL = add16(regHL, regB << 8 | regC), e => (regA = f.get(e = regB << 8 | regC), wz = 1 + e, f.time += 3), e => (--regC < 0 && (regB = regB - 1 & (regC = 255)), f.time += 2), e => regC = inc8(regC), e => regC = dec8(regC), e => regC = fetchByte(), e => setAccumulatorFromShiftResult(regA >> 1 | (1 + (1 & regA) ^ 1) << 7), e => (f.time++, e = fetchByte(), (regB = regB - 1 & 255) && (f.time += 5, wz = pc = pc + (128 ^ e) - 128 & 65535)), e => (e = fetchWord(), regD = e >> 8, regE = 255 & e), e => (writeByteTimed(e = regD << 8 | regE, regA), wz = 1 + e & 255 | regA << 8), e => ((regE = regE + 1 & 255) || (regD = regD + 1 & 255), f.time += 2), e => regD = inc8(regD), e => regD = dec8(regD), e => regD = fetchByte(), e => setAccumulatorFromShiftResult(regA << 1 | l >> 8 & 1), jumpRelative, e => regHL = add16(regHL, regD << 8 | regE), e => (regA = f.get(e = regD << 8 | regE), wz = 1 + e, f.time += 3), e => (--regE < 0 && (regD = regD - 1 & (regE = 255)), f.time += 2), e => regE = inc8(regE), e => regE = dec8(regE), e => regE = fetchByte(), e => setAccumulatorFromShiftResult((513 * regA | 256 & l) >> 1), e => (u ? jumpRelative : fetchByte)(), e => regHL = fetchWord(), e => (writeByteTimed(e = fetchWord(), 255 & regHL), writeByteTimed(wz = e + 1 & 65535, regHL >> 8)), e => (regHL = regHL + 1 & 65535, f.time += 2), e => regHL = 255 & regHL | inc8(regHL >> 8) << 8, e => regHL = 255 & regHL | dec8(regHL >> 8) << 8, e => regHL = 255 & regHL | fetchByte() << 8, function () {
          var e = 153 < (regA | 256 & l) ? 352 : 0;
          9 < (15 & regA | 16 & (u ^ c ^ s ^ s >> 8)) && (e += 6), c = 256 | regA, 512 & s ? (regA -= e, s = ~e) : regA += s = e, l = (u = regA &= 255) | 256 & e;
        }, e => (u ? fetchByte : jumpRelative)(), e => regHL = add16(regHL, regHL), e => (regHL = f.get(e = fetchWord()), f.time += 3, regHL |= f.get(wz = e + 1 & 65535) << 8, f.time += 3), e => (regHL = regHL - 1 & 65535, f.time += 2), e => regHL = -256 & regHL | inc8(255 & regHL), e => regHL = -256 & regHL | dec8(255 & regHL), e => regHL = -256 & regHL | fetchByte(), function () {
          l = 384 & l | 40 & (regA ^= 255), s |= -129, c = 384 & c | 16 & ~u;
        }, e => (256 & l ? fetchByte : jumpRelative)(), e => sp = fetchWord(), e => (writeByteTimed(e = fetchWord(), regA), wz = e + 1 & 255 | regA << 8), e => (sp = sp + 1 & 65535, f.time += 2), e => (e = inc8(f.get(regHL)), f.time += 4, writeByteTimed(regHL, e)), e => (e = dec8(f.get(regHL)), f.time += 4, writeByteTimed(regHL, e)), e => writeByteTimed(regHL, fetchByte()), e => updateLogicFlagsFromResult(0), e => (256 & l ? jumpRelative : fetchByte)(), e => regHL = add16(regHL, sp), e => (regA = f.get(e = fetchWord()), wz = e + 1, f.time += 3), e => (sp = sp - 1 & 65535, f.time += 2), e => regA = inc8(regA), e => regA = dec8(regA), e => regA = fetchByte(), e => updateLogicFlagsFromResult(256 & l), e => e, e => regB = regC, e => regB = regD, e => regB = regE, e => regB = regHL >> 8, e => regB = 255 & regHL, e => (regB = f.get(regHL), f.time += 3), e => regB = regA, e => regC = regB, e => e, e => regC = regD, e => regC = regE, e => regC = regHL >> 8, e => regC = 255 & regHL, e => (regC = f.get(regHL), f.time += 3), e => regC = regA, e => regD = regB, e => regD = regC, e => e, e => regD = regE, e => regD = regHL >> 8, e => regD = 255 & regHL, e => (regD = f.get(regHL), f.time += 3), e => regD = regA, e => regE = regB, e => regE = regC, e => regE = regD, e => e, e => regE = regHL >> 8, e => regE = 255 & regHL, e => (regE = f.get(regHL), f.time += 3), e => regE = regA, e => regHL = 255 & regHL | regB << 8, e => regHL = 255 & regHL | regC << 8, e => regHL = 255 & regHL | regD << 8, e => regHL = 255 & regHL | regE << 8, e => e, e => regHL = 255 & regHL | (255 & regHL) << 8, e => (regHL = 255 & regHL | f.get(regHL) << 8, f.time += 3), e => regHL = 255 & regHL | regA << 8, e => regHL = -256 & regHL | regB, e => regHL = -256 & regHL | regC, e => regHL = -256 & regHL | regD, e => regHL = -256 & regHL | regE, e => regHL = -256 & regHL | regHL >> 8, e => e, e => (regHL = -256 & regHL | f.get(regHL), f.time += 3), e => regHL = -256 & regHL | regA, e => writeByteTimed(regHL, regB), e => writeByteTimed(regHL, regC), e => writeByteTimed(regHL, regD), e => writeByteTimed(regHL, regE), e => writeByteTimed(regHL, regHL >> 8), e => writeByteTimed(regHL, 255 & regHL), runHalt, e => writeByteTimed(regHL, regA), e => regA = regB, e => regA = regC, e => regA = regD, e => regA = regE, e => regA = regHL >> 8, e => regA = 255 & regHL, e => (regA = f.get(regHL), f.time += 3), e => e, e => regA = u = 255 & (l = (c = regA) + (s = regB)), e => regA = u = 255 & (l = (c = regA) + (s = regC)), e => regA = u = 255 & (l = (c = regA) + (s = regD)), e => regA = u = 255 & (l = (c = regA) + (s = regE)), e => regA = u = 255 & (l = (c = regA) + (s = regHL >> 8)), e => regA = u = 255 & (l = (c = regA) + (s = 255 & regHL)), e => (regA = u = 255 & (l = (c = regA) + (s = f.get(regHL))), f.time += 3), e => regA = u = 255 & (l = 2 * (c = s = regA)), e => regA = u = 255 & (l = (c = regA) + (s = regB) + (l >> 8 & 1)), e => regA = u = 255 & (l = (c = regA) + (s = regC) + (l >> 8 & 1)), e => regA = u = 255 & (l = (c = regA) + (s = regD) + (l >> 8 & 1)), e => regA = u = 255 & (l = (c = regA) + (s = regE) + (l >> 8 & 1)), e => regA = u = 255 & (l = (c = regA) + (s = regHL >> 8) + (l >> 8 & 1)), e => regA = u = 255 & (l = (c = regA) + (s = 255 & regHL) + (l >> 8 & 1)), e => (regA = u = 255 & (l = (c = regA) + (s = f.get(regHL)) + (l >> 8 & 1)), f.time += 3), e => regA = u = 255 & (l = 2 * (c = s = regA) + (l >> 8 & 1)), e => regA = u = 255 & (l = (c = regA) + (s = ~regB) + 1), e => regA = u = 255 & (l = (c = regA) + (s = ~regC) + 1), e => regA = u = 255 & (l = (c = regA) + (s = ~regD) + 1), e => regA = u = 255 & (l = (c = regA) + (s = ~regE) + 1), e => regA = u = 255 & (l = (c = regA) + (s = ~(regHL >> 8)) + 1), e => regA = u = 255 & (l = (c = regA) + (s = ~(255 & regHL)) + 1), e => (regA = u = 255 & (l = (c = regA) + (s = ~f.get(regHL)) + 1), f.time += 3), e => (s = ~(c = regA), regA = u = l = 0), e => regA = u = 255 & (l = (c = regA) + (s = ~regB) + (l >> 8 & 1 ^ 1)), e => regA = u = 255 & (l = (c = regA) + (s = ~regC) + (l >> 8 & 1 ^ 1)), e => regA = u = 255 & (l = (c = regA) + (s = ~regD) + (l >> 8 & 1 ^ 1)), e => regA = u = 255 & (l = (c = regA) + (s = ~regE) + (l >> 8 & 1 ^ 1)), e => regA = u = 255 & (l = (c = regA) + (s = ~(regHL >> 8)) + (l >> 8 & 1 ^ 1)), e => regA = u = 255 & (l = (c = regA) + (s = ~(255 & regHL)) + (l >> 8 & 1 ^ 1)), e => (regA = u = 255 & (l = (c = regA) + (s = ~f.get(regHL)) + (l >> 8 & 1 ^ 1)), f.time += 3), e => (s = ~(c = regA), regA = u = 255 & (l = (l >> 8 & 1 ^ 1) - 1)), e => (c = ~(regA = l = u = regA & regB), s = 0), e => (c = ~(regA = l = u = regA & regC), s = 0), e => (c = ~(regA = l = u = regA & regD), s = 0), e => (c = ~(regA = l = u = regA & regE), s = 0), e => (c = ~(regA = l = u = regA & regHL >> 8), s = 0), e => (c = ~(regA = l = u = regA & regHL & 255), s = 0), e => (c = ~(regA = l = u = regA & f.get(regHL)), s = 0, f.time += 3), e => (c = ~(l = u = regA), s = 0), e => (c = 256 | (regA = l = u = regA ^ regB), s = 0), e => (c = 256 | (regA = l = u = regA ^ regC), s = 0), e => (c = 256 | (regA = l = u = regA ^ regD), s = 0), e => (c = 256 | (regA = l = u = regA ^ regE), s = 0), e => (c = 256 | (regA = l = u = regA ^ regHL >> 8), s = 0), e => (c = 256 | (regA = l = u = regA ^ 255 & regHL), s = 0), e => (c = 256 | (regA = l = u = regA ^ f.get(regHL)), s = 0, f.time += 3), e => (regA = l = u = s = 0, c = 256), e => (c = 256 | (regA = l = u = regA | regB), s = 0), e => (c = 256 | (regA = l = u = regA | regC), s = 0), e => (c = 256 | (regA = l = u = regA | regD), s = 0), e => (c = 256 | (regA = l = u = regA | regE), s = 0), e => (c = 256 | (regA = l = u = regA | regHL >> 8), s = 0), e => (c = 256 | (regA = l = u = regA | 255 & regHL), s = 0), e => (c = 256 | (regA = l = u = regA | f.get(regHL)), s = 0, f.time += 3), e => (c = 256 | (l = u = regA), s = 0), e => compare8(regB), e => compare8(regC), e => compare8(regD), e => compare8(regE), e => compare8(regHL >> 8), e => compare8(255 & regHL), e => (compare8(f.get(regHL)), f.time += 3), e => compare8(regA), e => (f.time++, u && ret()), e => (e = pop16(), regB = e >> 8, regC = 255 & e), e => (wz = fetchWord(), u && (pc = wz)), e => wz = pc = fetchWord(), e => jumpOrCallConditional(u), e => push16(regB << 8 | regC), e => regA = u = 255 & (l = (c = regA) + (s = fetchByte())), e => (push16(pc), wz = pc = 0), e => (f.time++, !u && ret()), ret, e => (wz = fetchWord(), !u && (pc = wz)), function () {
          var e,
            t,
            r = f.m1(pc, regIR, 203);
          pc = pc + 1 & 65535, regIR = -128 & regIR | regIR + 1 & 127, f.time += 4, t = 7 & (e = r >> 3), e = 8 & e | 7 & r, r < 128 ? cbRotateTable[e](t) : cbBitSetResetTable[e](1 << t);
        }, e => jumpOrCallConditional(!u), e => (e = fetchWord(), push16(pc), wz = pc = e), e => regA = u = 255 & (l = (c = regA) + (s = fetchByte()) + (l >> 8 & 1)), e => (push16(pc), wz = pc = 8), e => (f.time++, !(256 & l) && ret()), e => (e = pop16(), regD = e >> 8, regE = 255 & e), e => (wz = fetchWord(), !(256 & l) && (pc = wz)), e => (f.out(e = fetchByte() | regA << 8, regA), wz = 1 + e & 255 | -256 & e, f.time += 4), e => jumpOrCallConditional(!(256 & l)), e => push16(regD << 8 | regE), e => regA = u = 255 & (l = (c = regA) + (s = ~fetchByte()) + 1), e => (push16(pc), wz = pc = 16), e => (f.time++, 256 & l && ret()), swapBCDEHLWithAlt, e => (wz = fetchWord(), 256 & l && (pc = wz)), e => (regA = f.in(e = fetchByte() | regA << 8), wz = 1 + e, f.time += 4), e => jumpOrCallConditional(256 & l), e => prefixState = 221, e => regA = u = 255 & (l = (c = regA) + (s = ~fetchByte()) + (l >> 8 & 1 ^ 1)), e => (push16(pc), wz = pc = 24), e => (f.time++, 4 & ~packFlags() && ret()), e => regHL = pop16(), e => (wz = fetchWord(), 4 & ~packFlags() && (pc = wz)), e => (wz = pop16(), push16(regHL), regHL = wz, f.time += 2), e => jumpOrCallConditional(4 & ~packFlags()), e => push16(regHL), e => (c = ~(regA = l = u = regA & fetchByte()), s = 0), e => (push16(pc), wz = pc = 32), e => (f.time++, 4 & packFlags() && ret()), e => pc = regHL, e => (wz = fetchWord(), 4 & packFlags() && (pc = wz)), e => (e = regHL, regHL = regD << 8 | regE, regD = e >> 8, regE = 255 & e), e => jumpOrCallConditional(4 & packFlags()), function () {
          var e = f.m1(pc, regIR, 237);
          pc = pc + 1 & 65535, regIR = -128 & regIR | regIR + 1 & 127, f.time += 4, edOpcodeTable[e]?.();
        }, e => (c = 256 | (regA = l = u = regA ^ fetchByte()), s = 0), e => (push16(pc), wz = pc = 40), e => (f.time++, 128 & ~l && ret()), e => {
          var t;
          unpackFlags(255 & (t = pop16())), regA = t >> 8;
        }, e => (wz = fetchWord(), 128 & ~l && (pc = wz)), e => (prefixState = 243, iffState = 0), e => jumpOrCallConditional(128 & ~l), e => push16(regA << 8 | packFlags()), e => (c = 256 | (regA = l = u = regA | fetchByte()), s = 0), e => (push16(pc), wz = pc = 48), e => (f.time++, 128 & l && ret()), e => (sp = regHL, f.time += 2), e => (wz = fetchWord(), 128 & l && (pc = wz)), e => (prefixState = 251, iffState = 3), e => jumpOrCallConditional(128 & l), e => prefixState = 253, e => compare8(fetchByte()), e => (push16(pc), wz = pc = 56)], indexedOpcodeTable = [,,,,,,,,, e => add16(e, regB << 8 | regC),,,,,,,,,,,,,,,, e => add16(e, regD << 8 | regE),,,,,,,, fetchWord, e => {
          writeByteTimed(wz = fetchWord(), 255 & e), writeByteTimed(wz = wz + 1 & 65535, e >> 8);
        }, e => (f.time += 2, e + 1 & 65535), e => 255 & e | inc8(e >> 8) << 8, e => 255 & e | dec8(e >> 8) << 8, e => 255 & e | fetchByte() << 8,,, e => add16(e, e), e => (e = f.get(wz = fetchWord()), f.time += 3, e |= f.get(wz = wz + 1 & 65535) << 8, f.time += 3, e), e => (f.time += 2, e - 1 & 65535), e => -256 & e | inc8(255 & e), e => -256 & e | dec8(255 & e), e => -256 & e | fetchByte(),,,,,, (e, t) => {
          e = indexedAddress(e), t = inc8(f.get(e)), f.time += 4, writeByteTimed(e, t);
        }, (e, t) => {
          e = indexedAddress(e), t = dec8(f.get(e)), f.time += 4, writeByteTimed(e, t);
        }, (e, t) => {
          e = indexedAddress(e), f.time -= 5, t = fetchByte(), f.time += 2, writeByteTimed(e, t);
        },,, e => add16(e, sp),,,,,,,,,,, e => {
          regB = e >> 8;
        }, e => {
          regB = 255 & e;
        }, e => {
          regB = indexedReadByte(e);
        },,,,,, e => {
          regC = e >> 8;
        }, e => {
          regC = 255 & e;
        }, e => {
          regC = indexedReadByte(e);
        },,,,,, e => {
          regD = e >> 8;
        }, e => {
          regD = 255 & e;
        }, e => {
          regD = indexedReadByte(e);
        },,,,,, e => {
          regE = e >> 8;
        }, e => {
          regE = 255 & e;
        }, e => {
          regE = indexedReadByte(e);
        },, e => 255 & e | regB << 8, e => 255 & e | regC << 8, e => 255 & e | regD << 8, e => 255 & e | regE << 8,, e => 255 & e | (255 & e) << 8, e => {
          regHL = 255 & regHL | indexedReadByte(e) << 8;
        }, e => 255 & e | regA << 8, e => -256 & e | regB, e => -256 & e | regC, e => -256 & e | regD, e => -256 & e | regE, e => -256 & e | e >> 8,, e => {
          regHL = -256 & regHL | indexedReadByte(e);
        }, e => -256 & e | regA, e => {
          writeByteTimed(indexedAddress(e), regB);
        }, e => {
          writeByteTimed(indexedAddress(e), regC);
        }, e => {
          writeByteTimed(indexedAddress(e), regD);
        }, e => {
          writeByteTimed(indexedAddress(e), regE);
        }, e => {
          writeByteTimed(indexedAddress(e), regHL >> 8);
        }, e => {
          writeByteTimed(indexedAddress(e), 255 & regHL);
        },, e => {
          writeByteTimed(indexedAddress(e), regA);
        },,,,, e => {
          regA = e >> 8;
        }, e => {
          regA = 255 & e;
        }, e => {
          regA = indexedReadByte(e);
        },,,,,, e => {
          regA = u = 255 & (l = (c = regA) + (s = e >> 8));
        }, e => {
          regA = u = 255 & (l = (c = regA) + (s = 255 & e));
        }, e => {
          regA = u = 255 & (l = (c = regA) + (s = indexedReadByte(e)));
        },,,,,, e => {
          regA = u = 255 & (l = (c = regA) + (s = e >> 8) + (l >> 8 & 1));
        }, e => {
          regA = u = 255 & (l = (c = regA) + (s = 255 & e) + (l >> 8 & 1));
        }, e => {
          regA = u = 255 & (l = (c = regA) + (s = indexedReadByte(e)) + (l >> 8 & 1));
        },,,,,, e => {
          regA = u = 255 & (l = (c = regA) + (s = ~(e >> 8)) + 1);
        }, e => {
          regA = u = 255 & (l = (c = regA) + (s = ~(255 & e)) + 1);
        }, e => {
          regA = u = 255 & (l = (c = regA) + (s = ~indexedReadByte(e)) + 1);
        },,,,,, e => {
          regA = u = 255 & (l = (c = regA) + (s = ~(e >> 8)) + (l >> 8 & 1 ^ 1));
        }, e => {
          regA = u = 255 & (l = (c = regA) + (s = ~(255 & e)) + (l >> 8 & 1 ^ 1));
        }, e => {
          regA = u = 255 & (l = (c = regA) + (s = ~indexedReadByte(e)) + (l >> 8 & 1 ^ 1));
        },,,,,, e => {
          c = ~(regA = l = u = regA & e >> 8), s = 0;
        }, e => {
          c = ~(regA = l = u = regA & e & 255), s = 0;
        }, e => {
          c = ~(regA = l = u = regA & indexedReadByte(e)), s = 0;
        },,,,,, e => {
          c = 256 | (regA = l = u = regA ^ e >> 8), s = 0;
        }, e => {
          c = 256 | (regA = l = u = regA ^ 255 & e), s = 0;
        }, e => {
          c = 256 | (regA = l = u = regA ^ indexedReadByte(e)), s = 0;
        },,,,,, e => {
          c = 256 | (regA = l = u = regA | e >> 8), s = 0;
        }, e => {
          c = 256 | (regA = l = u = regA | 255 & e), s = 0;
        }, e => {
          c = 256 | (regA = l = u = regA | indexedReadByte(e)), s = 0;
        },,,,,, e => {
          compare8(e >> 8);
        }, e => {
          compare8(255 & e);
        }, e => {
          compare8(indexedReadByte(e));
        },,,,,,,,,,,,, function (e) {
          var t,
            r,
            n,
            e = wz = e + (128 ^ f.get(pc)) - 128 & 65535;
          if (f.time += 3, t = f.get(pc + 1 & 65535), pc = pc + 2 & 65535, f.time += 5, r = f.get(e), f.time += 4, n = t >> 3 & 7, t < 128) {
            if (63 < t) return setBitTestFlags(n, r), void (l = 384 & l | e >> 8 & 40);
            r = rotateShiftByMode(n, r);
          } else t < 192 ? r &= ~(1 << n) : r |= 1 << n;
          f.put(e, r), f.time += 3, [e => regB = r, e => regC = r, e => regD = r, e => regE = r, e => regHL = 255 & regHL | r << 8, e => regHL = -256 & regHL | r, e => r, e => regA = r][7 & t]();
        },,,,,,,,,,,,,,,,,,,,,, pop16,, e => (wz = pop16(), push16(e), f.time += 2, wz),, push16,,,, e => pc = e,,,,,,,,,,,,,,,, e => (f.time += 2, sp = e)], edOpcodeTable = [,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,, e => regB = inputFromBC(), e => outputToBC(regB), e => addToHL(~(regB << 8 | regC), 1), e => (writeByteTimed(e = fetchWord(), regC), writeByteTimed(wz = e + 1 & 65535, regB)), negA, restoreIffAndRet, e => interruptMode = 0, e => (regIR = 255 & regIR | regA << 8, f.time++), e => regC = inputFromBC(), e => outputToBC(regC), e => addToHL(regB << 8 | regC, 0), e => (regC = f.get(e = fetchWord()), f.time += 3, regB = f.get(wz = e + 1 & 65535), f.time += 3), negA, restoreIffAndRet, e => interruptMode = 0, e => (regIR = -256 & regIR | regA, f.time++), e => regD = inputFromBC(), e => outputToBC(regD), e => addToHL(~(regD << 8 | regE), 1), e => (writeByteTimed(e = fetchWord(), regE), writeByteTimed(wz = e + 1 & 65535, regD)), negA, restoreIffAndRet, e => interruptMode = 1, e => loadA(regIR >> 8), e => regE = inputFromBC(), e => outputToBC(regE), e => addToHL(regD << 8 | regE, 0), e => (regE = f.get(e = fetchWord()), f.time += 3, regD = f.get(wz = e + 1 & 65535), f.time += 3), negA, restoreIffAndRet, e => interruptMode = 2, e => loadA(255 & regIR), e => regHL = 255 & regHL | inputFromBC() << 8, e => outputToBC(regHL >> 8), e => addToHL(~regHL, 1), e => (writeByteTimed(e = fetchWord(), 255 & regHL), writeByteTimed(wz = e + 1 & 65535, regHL >> 8)), negA, restoreIffAndRet, e => interruptMode = 0, function () {
          var e = f.get(regHL) | regA << 8;
          f.time += 7, setLogicResult8(regA = 240 & regA | 15 & e), f.put(regHL, e >> 4 & 255), wz = regHL + 1, f.time += 3;
        }, e => regHL = -256 & regHL | inputFromBC(), e => outputToBC(255 & regHL), e => addToHL(regHL, 0), e => (regHL = f.get(e = fetchWord()), f.time += 3, regHL |= f.get(wz = e + 1 & 65535) << 8, f.time += 3), negA, restoreIffAndRet, e => interruptMode = 0, function () {
          var e = f.get(regHL) << 4 | 15 & regA;
          f.time += 7, setLogicResult8(regA = 240 & regA | e >> 8), f.put(regHL, 255 & e), wz = regHL + 1, f.time += 3;
        }, inputFromBC, e => outputToBC(0), e => addToHL(~sp, 1), e => (writeByteTimed(e = fetchWord(), 255 & sp), writeByteTimed(wz = e + 1 & 65535, sp >> 8)), negA, restoreIffAndRet, e => interruptMode = 1,, e => regA = inputFromBC(), e => outputToBC(regA), e => addToHL(sp, 0), e => (sp = f.get(e = fetchWord()), f.time += 3, sp |= f.get(wz = e + 1 & 65535) << 8, f.time += 3), negA, restoreIffAndRet, e => interruptMode = 2,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,, e => blockTransfer(1, 0), e => blockCompare(1, 0), e => blockIo(4), e => blockIo(5),,,,, e => blockTransfer(-1, 0), e => blockCompare(-1, 0), e => blockIo(-4), e => blockIo(-3),,,,, e => blockTransfer(1, 1), e => blockCompare(1, 1), e => blockIo(6), e => blockIo(7),,,,, e => blockTransfer(-1, 1), e => blockCompare(-1, 1), e => blockIo(-2), e => blockIo(-1)], cbRotateTable = [e => regB = rotateShiftByMode(e, regB), e => regC = rotateShiftByMode(e, regC), e => regD = rotateShiftByMode(e, regD), e => regE = rotateShiftByMode(e, regE), e => regHL = 255 & regHL | rotateShiftByMode(e, regHL >> 8) << 8, e => regHL = -256 & regHL | rotateShiftByMode(e, 255 & regHL), e => (e = rotateShiftByMode(e, f.get(regHL)), f.time += 4, writeByteTimed(regHL, e)), e => regA = rotateShiftByMode(e, regA), e => setBitTestFlags(e, regB), e => setBitTestFlags(e, regC), e => setBitTestFlags(e, regD), e => setBitTestFlags(e, regE), e => setBitTestFlags(e, regHL >> 8), e => setBitTestFlags(e, 255 & regHL), e => (setBitTestFlags(e, f.get(regHL)), l = 384 & l | wz >> 8 & 40, f.time += 4), e => setBitTestFlags(e, regA)], cbBitSetResetTable = [e => regB &= ~e, e => regC &= ~e, e => regD &= ~e, e => regE &= ~e, e => regHL &= ~(e << 8), e => regHL &= ~e, e => (e = f.get(regHL) & ~e, f.time += 4, writeByteTimed(regHL, e)), e => regA &= ~e, e => regB |= e, e => regC |= e, e => regD |= e, e => regE |= e, e => regHL |= e << 8, e => regHL |= e, e => (e |= f.get(regHL), f.time += 4, writeByteTimed(regHL, e)), e => regA |= e];
      }(machineBus = {
        time: 0,
        limit: 0,
        m1: N5,
        get: function (e) {
          var t,
            r = e < 32768 ? e < 16384 ? (t = f, 1) : (t = u, 2) : e < 49152 ? (t = c, 4) : (t = s, 8),
            n = machineBus.time - o;
          return 0 < n && P5(n), o = 99999, v & r && (G5(0), o = machineBus.time + 3), t[16383 & e];
        },
        put: function (e, t) {
          var r,
            n,
            i = v;
          e < 32768 ? e < 16384 ? (r = f, i &= 17) : (r = u, i &= 34) : e < 49152 ? (r = c, i &= 68) : (r = s, i &= 136), 0 < (n = machineBus.time - o) && P5(n), o = 99999, i && (15 & i && (G5(0), o = machineBus.time + 3), r[e &= 16383] !== t) && (r === _ && T1(machineBus.time), r[e] = t);
        },
        in: function (e) {
          J5(e);
          var t,
            r,
            n,
            i,
            f = machineBus.time,
            o = O(e, f);
          return o < 256 || (t = 255, 1 & ~e ? (t = y << 2 & 64 | 160 & t | 31, t &= (t => {
            var r,
              n,
              i = 255;
            if (t) {
              for (r = 0; 255 == keyMatrixRows[r];) if (8 == ++r) return i;
              for (let e = r; e < 8; e++) i & ~(n = keyMatrixRows[e]) && (t & 1 << e || 255 ^ (i | n)) && (i &= n, e = r - 1);
            }
            return i;
          })(e >> 8 ^ 255)) : 0 <= U && 49152 == (49154 & e) ? t = A[U] : !(255 & ~e) && a & R5 ? t = w : 0 <= f && a & q5 && (r = f / h, n = f % h, r < 192) && n < 124 && 4 & ~n && (i = n >> 1 & 1 | n >> 2, i += 1 & ~n ? 6144 & r | r << 2 & 224 | r << 8 & 1792 : 6144 | r << 2 & 992, t = _[i]), o &= t | o >> 8 ^ 255, !(32770 & e) && 32 & ~m && (8 & (m ^ o) && T1(f), O5(o))), o;
        },
        out: function (e, t) {
          var r;
          if (J5(e), r = machineBus.time, G(e, t, r), 1 & ~e && (24 & (y ^ t) && V5(r), y = t), 2 & ~e) if (e < 32768) {
            if (32 & m) return;
            8 & (m ^ t) && T1(r), O5(t);
          } else 0 <= U && (e < 49152 ? (V5(r), t2(U, t)) : U = 15 & t);
          !(255 & ~e) && a & R5 && (T1(r), x = 8191 & x | (1 & t) << 13, w = t, W5()), (e = W()) ^ k && (T1(r), k = e);
        },
        halt: function (e, t, r) {
          if (v & 1 << (t >> 14)) {
            for (e = 0; N5(t, r = 65408 & r | r + 1 & 127), machineBus.time += 4, e++, machineBus.time < machineBus.limit;);
            machineBus.time -= 4 * e;
          }
          return e;
        }
      });
      let t,
        a = D1 | q5 | 32;
      function j5(e) {
        t = e, r = romPages[e.q], a = e.T, l = e.R, h = l[2], i = 191 * h + 126;
      }
      function E5(e, t, r, n, i) {
        e.set(r.slice(n, n + i), t);
      }
      initializeEmulatorCore = e => {
        n = Z1(256), J = Z1(256);
        for (let e = 0; e < 256; e++) n[e] = (e << 1 & 240 | e >> 3 & 8 | 7 & e) << 8;
        n[64] = n[192] = 0, b = n, g = Z1(U1 * L5 / 8), d = [];
        for (let e = 0; e < 8; e++) d[e] = $1(16384);
        j5(I1[0]), rebuildBusHandlers(), _.fill(56, 6144, 6912), machineBus.time = -l[1], X5();
      }, resetMachine = e => {
        cpuCore.reset(), O5(a & A1 ? 0 : 48);
        var t = machineBus.time;
        for (let e = pluginChain; e; e = e.edge) e.reset?.(t);
      }, serializeMachineState = (e = {}, r = 0) => {
        var n;
        if (Y1(e, {
          model: t,
          pFE: y,
          border: 7 & y,
          p7FFD: m,
          pFF: w,
          cont: !!(a & D1),
          fbus: !!(a & q5),
          ay: 0 <= U && {
            idx: U,
            reg: A.slice()
          },
          kj: joystickState != g1,
          time: machineBus.time + l[1],
          frt: l[0]
        }), 3 != r) {
          let t;
          if (1 == r) (t = $1(49152)).set(u, 0), t.set(c, 16384), t.set(s, 32768);else {
            t = [];
            for (let e = 0; e < 8; e++) n = d[e], t[e] = 0 ^ r ? n.slice() : n;
          }
          e.ram = t, p && (e.rom = p);
        }
        return e;
      }, applyMachineState = e => {
        var t,
          r,
          n,
          i,
          f = 16384,
          o = e.pFE;
        if (o != g1 && (y = o), o = e.border, r = 7 & ((t = y) ^ (y = o != g1 ? -8 & t | o : y)), "rom" in e && (p = e.rom), o = e.model, (t = e.p7FFD) != +t && (t = m), o != g1 && (j5(o), n = !!(a & M5), ~a & A1) && (s != d[0] && E5(d[0] = $1(f), 0, s, 0, f), t = 48), r |= 8 & (t ^ m), m = t, (o = (o = e.pFF) == g1 && ~a & R5 ? 0 : o) == (0 | o) && (w = o, W5(), r = 1), (o = W()) ^ k && (k = o, r = 1), (o = e.cont) != g1 && (a &= ~D1, v &= -16, o) && (a |= D1, v |= 2 | (1 & m) << 3), (o = e.fbus) != g1 && (a = o ? a | q5 : a & ~q5), o = e.ram) {
          r = 1;
          let e = o.length;
          if (8 < e) E5(u, 0, o, 0, f), E5(c, 0, o, f, f), E5(s, 0, o, 32768, f);else for (; e;) (i = o[--e]) && d[e] != i && d[e].set(i);
        }
        if ("" === (o = e.ay ?? n) && (o = 0 <= U, U = -1), o != g1) if (o) {
          if (U < 0 && (A = $1(16), U = 0, f1 = o1 = a1 = 0, D = I = T = d1 = L = 0, l1 = u1 = c1 = s1 = v1 = 0, p1 = R = q = M = 0, y1 = m1 = j = E = 0, h1 = 1), o.reg) for (t = 0; t < 15; t++) o.reg[t] != g1 && t2(t, 0 | o.reg[t]);
          (t = o.idx) != g1 && (U = 15 & t);
        } else U = -1;
        (o = e.kj) != g1 && (joystickState = e.kj ? 0 : g1), (o = e.time) == +o && (f = machineBus.time, n = o - l[1], machineBus.time = n, $ -= f - n), rebuildBusHandlers(), r && (e = machineBus.time, B5(2), machineBus.time = e), C = Q5() + (U < 0 ? 0 : e2());
      };
      let l, h, i;
      function B5(t) {
        if (S) {
          var r = machineBus.time,
            [n, i] = (x = (1 & w) << 13, X = 4 + -h * T5 - 4 * C1, Z = 0, H = 0, K = C1 + 32 + C1, Q = T5 * (C1 + 32 + C1) + C1, 2 & t && T1(r), l),
            f = n - i;
          if (1 & t) {
            let e = frameStopPlugin ?? pluginChain;
            for (frameStopPlugin = g1; e; e = e.edge) if (e.frame?.(n, r, t), e.stop) {
              frameStopPlugin = e;
              break;
            }
            frameStopPlugin || (V5(r), 64 & ~w && o(255, l[3] - i), o(-1, f), f = machineBus.time, machineBus.time -= n, $ -= n);
          }
          2 & t && T1(f);
        }
        function o(e, t) {
          try {
            frameAbortRequested || (machineBus.int = e, machineBus.limit = t, cpuCore.run());
          } finally {
            if (frameAbortRequested) return machineBus.time = t;
          }
        }
      }
      runFrame = e => {
        var t;
        if (! --P) {
          P = 16;
          for (let e = 128; e < 256; e++) t = (t = n[e]) << 4 & 61440 | t >> 4 & 3840, n[e] = t;
        }
        var [r] = l;
        return r1 = 50 * r, B5(e);
      };
      let f, u, c, s, v, d, r, B, _, p;
      peekMemoryRaw = pokeMemoryRaw = (e, t) => {
        var r,
          n = (e &= 65535) < 32768 ? e < 16384 ? (r = f, 16) : (r = u, 32) : e < 49152 ? (r = c, 64) : (r = s, 128);
        return e &= 16383, t != g1 && v & n && (r[e] = t), r[e];
      }, rebuildBusHandlers = e => {
        var t,
          r,
          n,
          i,
          f,
          o = [];
        for (let e = pluginChain; e; e = e.edge) (i = e.rom) && !t && (t = i), o.unshift(e);
        B = t || p, u = d[5], c = d[2], O5(m), r = {
          m1: e => 0,
          in: e => 31 == (255 & e) && joystickState < 256 ? joystickState : 65535,
          out() {}
        };
        for (n of o) for (f in r) n[f] && (n["edge_" + f] = r[f], r[f] = n[f]);
        N = r.m1, O = r.in, G = r.out;
      };
      let N, O, G;
      function N5(e, t) {
        var r,
          n,
          i = N(e, t);
        return 1 & i && rebuildBusHandlers(), n = e < 32768 ? e < 16384 ? (r = f, 1) : (r = u, 2) : e < 49152 ? (r = c, 4) : (r = s, 8), 2 & i && rebuildBusHandlers(), 0 < (i = machineBus.time - o) && P5(i), v & n && G5(0), o = 99999, v & 1 << (t >> 14) && (i = machineBus.time, o = i + 4, 32 & a) && (T1(i + 2), T1(i + 3, 2), T1(i + 4), T1(i + 5, 1, t)), r[16383 & e];
      }
      let y = 0,
        m = 48,
        w = 0;
      function O5(e) {
        m = e, s = d[7 & e], v = a & D1 ? 226 | e << 3 & 8 : 224, _ = d[8 & e ? 7 : 5], f = B || (16 & e ? r : romPages["128e"]);
      }
      let o;
      function G5(e) {
        (e += machineBus.time) < 0 || e >= i || (e %= h) < 126 && 0 < (e = 6 - (7 & e)) && (machineBus.time += e);
      }
      function P5(e) {
        var t,
          r,
          n = o;
        if (!(n + e <= 0 || (t = i - n) < 0)) {
          if (126 < (t %= h)) {
            if ((e -= t - 126) <= 0) return;
            n = 6, r = 15;
          } else {
            if (r = t >> 3, 7 == (t &= 7) && (t--, ! --e)) return;
            n = t;
          }
          r < (e = e - 1 >> 1) && (e = r), machineBus.time += n + 6 * e;
        }
      }
      function J5(e) {
        var t = machineBus.time - o,
          r = 1 & e;
        0 < t && P5(t), o = ~a & D1 ? 99999 : e >> 14 ^ 1 ? (r || G5(1), 99999) : (o = machineBus.time, P5(1 + r << 1), machineBus.time + 4);
      }
      let P = 16,
        g,
        n,
        J,
        b;
      function W5() {
        if (b = n, 4 & w) {
          var t = (-8 ^ 17 * (w >> 3 & 7)) << 16;
          for (let e = 0; e < 256; e++) J[e] = t | e << 8;
          b = J;
        }
      }
      let W = e => b[b == n ? (7 & y) << 3 : 0],
        k = 0,
        X = 0,
        x = 0,
        Z = 0,
        H = 0,
        K = 0,
        Q = 0;
      function T1(e, r = 0, n) {
        var i, f, o, a, l, u, c, s, v, d;
        if (!(e < X)) {
          i = x, f = X, o = Z, a = H, l = 1 << (i >> 5 & 7 | i >> 8 & 24), 2 & w ? (u = 1 & w ? 0 : -8192, c = s = v = 0) : (u = (7936 & i) - (i >> 3 & 768) - 6144, c = 256, s = 2048, v = 1792), d = 0;
          do {
            if (o >= Q) {
              let e,
                t = 1 & r ? -128 & i | 127 & n : i;
              e = b[_[t - u]] | _[t], i++, g[o] !== e && (g[o] = e, S(o, a, e), d |= l), o++, 2 & ~r && (e = b[_[i - u]] | _[i]), i++, g[o] !== e && (g[o] = e, S(o, a, e), d |= l), o++, f += 8, 31 & i || (6144 & ~i ? (Q += C1 + 32 + C1, u += c, 1792 & (i += 224) || (l <<= 1, u -= s, 224 & (i -= 2016)) || (u += v, i += 1792)) : Q = 99999);
            } else if (g[o] ^ k && (g[o] = k, S(o, a, k), d = -1), f += 4, ++o == K) {
              if (o == g.length) {
                f = 99999;
                break;
              }
              a += U1, f += h - 4 * (C1 + 32 + C1), K += C1 + 32 + C1;
            }
          } while (f <= e);
          if (x = i, X = f, Z = o, H = a, d) {
            if (d < 0) return X5();
            var [t, p, y, m] = dirtyRect,
              p = K1(p, 8 * C1 + 256),
              m = H1(m, 8 * C1),
              t = H1(t, T5 + 248 - 8 * Q1(d ^ d - 1)),
              y = K1(y, T5 + 256 - 8 * Q1(d));
            dirtyRect = [t, p, y, m];
          }
        }
      }
      function X5() {
        dirtyRect = [0, U1, L5, 0];
      }
      let Y, V, z, S;
      function Z5(e, t, r) {
        var n, i, f;
        for (r < 0 && (r = K5(r)), n = V, i = z[r >> 12], f = z[r >> 8 & 15], e <<= 3; n[e] = 128 & r ? f : i, r <<= 1, 7 & ++e;);
      }
      function H5(e, t, r) {
        var n, i, f, o, a;
        for (r < 0 && (r = K5(r)), n = V, i = r >> 12, f = r >> 8 & 15, o = z[i], a = z[f] ^ o, i = z[i + 16], f = z[16 + f] ^ i, r ^= r >> 1 & 127, t += e << 3; 128 & r && (o ^= a, i ^= f), r <<= 1, n[t] = o, n[t + U1] = i, 7 & ++t;);
      }
      function K5(t) {
        var r = 0;
        for (let e = 0; e < 4; e++) r >>= 1, 3 & t && (r |= 128), 768 & t && (r |= 8), t >>= 2;
        return r | 65280 & t;
      }
      renderFrameImage = (e, t) => {
        var r,
          n,
          i = e * L5;
        for (Y = new ImageData(U1, i), (V = X1(Y.data.buffer)).fill(255 << 24), z = [[[0, 11406853, 198, 11996364, 311808, 12373765, 1032645, 12963275, 0, 12065042, 1316055, 13708518, 3008039, 15268407, 4781817, 16777215], [0, 11734533, 203, 12324305, 313344, 12702725, 1099466, 13292240, 0, 12392978, 1381853, 14101996, 3075113, 15662904, 4914431, 16777215, 0, 11144453, 192, 11668422, 244992, 12044549, 965823, 12568517, 0, 11737105, 1250258, 13314784, 2875430, 14873909, 4648946, 16777215]], [[0, 1644824, 6842471, 8421246, 9868948, 11447724, 12171703, 13553100, 0, 2631719, 7829365, 10000278, 12105654, 14276822, 15855853, 16777215], [0, 1710617, 7039849, 8618881, 10132120, 11776688, 12500668, 13947857, 0, 2763048, 8026745, 10263450, 12434618, 14605787, 16250612, 16777215, 0, 1579031, 6645092, 8158330, 9605520, 11119015, 11842738, 13224134, 0, 2565926, 7631730, 9737106, 11776689, 13882064, 15395303, 16777215]]][+t][--e].map(e => e | -1 << 24), S = [Z5, H5][e], n = r = 0; r < g.length;) {
          for (let e = C1 + 32 + C1; e--; r++) S(r, n, g[r]);
          n += U1;
        }
        return X5(), Y;
      };
      let e1 = [0, 0.02, 0.93, 1],
        t1 = [0, 0.014, 0.02, 0.029, 0.042, 0.062, 0.085, 0.137, 0.169, 0.265, 0.353, 0.45, 0.57, 0.687, 0.848, 1],
        F,
        r1,
        n1,
        i1 = 0,
        $ = 0,
        C = 0;
      function Q5() {
        var e = y;
        return e1[e >> 3 & 3];
      }
      function Y5(e, t) {
        var r, n, i, f;
        if (F) {
          for (r = i1 * t / r1, n = F.M, i = F.j, f = F.B, n[i] += r, n[i = i + 1 & f] += t - r, t = i, e = i1 - n1 * e; e < 0;) e += r1, n[i = i + 1 & f] = 0;
          i1 = e, (F.N - t & f) <= (i - t & f) && (F.N = i + 1 & f), F.j = i - 1 & f;
        }
      }
      function V5(e) {
        var t,
          r,
          n,
          i,
          f = e - $;
        if (!(f <= 0)) if ($ = e, t = Q5(), 0 <= U) {
          do {
            if (n = t + e2(), i = f, Y5(i = f > (w1 = w1 || 16) ? w1 : i, n - C), !(w1 -= i)) {
              if (void 0, r = 0, --l1 & D || (l1 = -1, r ^= 1), --u1 & I || (u1 = -1, r ^= 2), --c1 & T || (c1 = -1, r ^= 4), _1 ^= 1) {
                if (!(--s1 & d1)) {
                  s1 = -1;
                  let e = h1;
                  R = -57 & R | 7 * (1 & e) << 3, 1 & e && (e ^= 147456), h1 = e >> 1;
                }
                --v1 & L || (v1 = -1, y1 && (E || (j ^= m1, y1 >>= 1, E = 16), E--, M) && (r2(), r |= 256));
              }
              R ^= r;
            }
          } while (C = n, f -= i);
        } else Y5(f, t - C), C = t;
      }
      attachAudioBuffer = e => {
        (F = e) && (n1 = e.hz, $ = machineBus.time);
      };
      let U = -1,
        A,
        f1,
        o1,
        a1,
        l1,
        u1,
        c1,
        s1,
        v1,
        D,
        I,
        T,
        d1,
        L,
        p1,
        R,
        q,
        M,
        y1,
        m1,
        j,
        E,
        h1,
        _1,
        w1 = 0;
      function e2() {
        var e = p1 & R;
        return (9 & e ? 0 : f1) + (18 & e ? 0 : o1) + (36 & e ? 0 : a1);
      }
      function t2(r, n) {
        function t() {
          var e = n &= 31,
            t = 9 << r - 8;
          return n ? n < 16 ? (q &= t = ~t, M &= t) : (q &= ~t, M |= t, e = E ^ j) : (q |= t, M &= ~t), p1 = ~(A[7] | q), t1[e];
        }
        [e => D = 3840 & D | n, e => D = 255 & D | (n &= 15) << 8, e => I = 3840 & I | n, e => I = 255 & I | (n &= 15) << 8, e => T = 3840 & T | n, e => T = 255 & T | (n &= 15) << 8, e => d1 = n &= 31, e => p1 = ~(n | q), e => f1 = t(), e => o1 = t(), e => a1 = t(), e => L = 65280 & L | n, e => L = 255 & L | n << 8, e => (n = 7 < (n &= 15) ? n : n < 4 ? 1 : 7, y1 = 1 & n ? 1 : -1, m1 = n + 1 & 2 ? 15 : 0, j = 4 & n ? 15 : 0, E = 15, v1 = -1, r2())][r]?.(), A[r] = n;
      }
      function r2() {
        var e,
          t = M;
        t && (e = t1[E ^ j], 1 & t && (f1 = e), 2 & t && (o1 = e), 4 & t) && (a1 = e);
      }
    }
    {
      let r = !1,
        i = {
          name: "Interface 1",
          reset() {
            frameAbortRequested = !1;
          },
          frame(e) {
            n2(n, 0), m -= e;
          },
          m1(t, r) {
            r = i.edge_m1(t, r);
            if (8 == t || 5896 == t || 1792 == t) {
              let e;
              8 & t && (e = romPages.if1), i.rom != e && (i.rom = e, r = 2);
            }
            return r;
          },
          in(e, t) {
            var r = i.edge_in(e, t);
            if (24 & ~e) if (r = n2((e &= 24) ? n : h, r), 16 & e) r = 255;else if (e) {
              r &= 247;
              for (let e = microdriveState; e; e = e._edge) e.O && (r &= e.G);
            }
            return r;
          },
          out(e, r, t) {
            if (i.edge_out(e, r, t), 24 & ~e && (n2((e &= 24) ? n : _, r), 8 & e)) {
              if (u & ~r & 2) {
                let t = 1 & ~r;
                for (let e = microdriveState; e; e = e._edge) [e.O, t] = [t, e.O];
                queueUiRefresh();
              }
              u = r;
            }
          }
        },
        u,
        c = (setUiFocusPauseFlag = e => {
          var t,
            e = e.if1;
          e != g1 && ((t = !!e) ^ r && (qaop.plug(i, t), r = t, u = 238, frameAbortRequested = !1, queueUiRefresh()), i.rom = !!e.paged && romPages.if1, (t = e.pEF) != g1 && (u = 255 & t), (t = e.in0) != g1) && (frameAbortRequested = !!t);
        }, setTextInputMode = e => {
          var n = r;
          if (n) {
            let t = 1,
              r = 0;
            for (let e = microdriveState; e; e = e._edge) e.O && (r |= t), t += t;
            n = {
              paged: !!i.rom,
              pEF: u,
              in0: frameAbortRequested,
              led: r
            };
          }
          e.if1 = n;
        }, 1),
        s = 2,
        v = 4,
        d = 4,
        p = 8,
        y = (microdriveState = {
          P: new Int16Array(144e3).fill(-1),
          C: 0,
          G: v | s | c,
          O: 0
        }, 162),
        m = 0,
        n = 0,
        h = 1,
        _ = 2;
      function n2(n, i = 255) {
        var f, o, a, l;
        for (let e = microdriveState; e; e = e._edge) if ((o = e.P) && e.O) {
          f == g1 && ((f = (machineBus.time - m) / y | 0) < 0 && (f = 0), n && !f && (machineBus.time = m + y, f = 1), m += y * f), a = o.length;
          let {
            C: t,
            G: r
          } = e;
          for (let e = f; e--;) if (++t == a && (t = 0), ~u & p && (o[t] = -1), !(~u & d)) if ((l = o[t]) < 0) r = v | s | r & c;else if ((r &= ~v) & s) {
            let e = r >> 3;
            e < 1 || 255 != l ? e = 0 == l : 3 == ++e && (r &= ~s), r = e << 3 | r & (v | s | c);
          }
          e.C = t, e.G = r, n && (n < _ ? i &= o[t] : ~u & d && (o[t] = i));
        }
        if (f || n != h) return i;
        throw frameAbortRequested = !0;
      }
    }
    emulationSpeed = 1;
  }
})(globalThis.__qaop = globalThis.__qaop || {}, globalThis, document, setTimeout, undefined);
