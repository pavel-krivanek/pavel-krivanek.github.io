(function (global) {
  'use strict';

  // DESKTOP preserved five BT-100/8255 connection profiles. They all drive
  // the same printer mechanics, but differ in the PPI port used for status and
  // control and, for the C-only variants, in the bit order inside port C.
  //
  // The profile constants follow the reconstructed DESKTOP front ends:
  //   A,B  initializer 90h
  //   C,B  initializer 98h
  //   C-1  initializer 9Ah
  //   C-2  initializer 9Ah (the UR-4 wiring documented by TextMachine)
  //   C-3  initializer 93h
  const BT100_CONNECTIONS = Object.freeze({
    'didaktik-ab': Object.freeze({
      id: 'didaktik-ab',
      label: 'BT-100 A,B',
      shortLabel: 'A status · B control',
      description: 'PA4 paper, PA5 fine, PA6 coarse, PA7 home; PB0 paper, PB1 needle, PB2/PB3 carriage',
      statusPort: 'A',
      controlPort: 'B',
      controlWord: 0x90,
      // Keep the needle line low in the internal quiescent state. The real
      // driver writes its own finish command as soon as it initializes.
      idleValue: 0x0d,
      statusBits: Object.freeze({ paper: 4, fine: 5, coarse: 6, home: 7 }),
      controlBits: Object.freeze({ paper: 0, needle: 1, towardHome: 2, awayFromHome: 3 })
    }),
    'bt100-cb': Object.freeze({
      id: 'bt100-cb',
      label: 'BT-100 C,B',
      shortLabel: 'C status · B control',
      description: 'PC4 paper, PC5 fine, PC6 coarse, PC7 home; PB0 paper, PB1 needle, PB2/PB3 carriage',
      statusPort: 'C',
      controlPort: 'B',
      controlWord: 0x98,
      idleValue: 0x0d,
      statusBits: Object.freeze({ paper: 4, fine: 5, coarse: 6, home: 7 }),
      controlBits: Object.freeze({ paper: 0, needle: 1, towardHome: 2, awayFromHome: 3 })
    }),
    'bt100-c1': Object.freeze({
      id: 'bt100-c1',
      label: 'BT-100 C-1',
      shortLabel: 'C lower control · C upper status',
      description: 'PC4 paper, PC5 fine, PC6 coarse, PC7 home; PC0 paper, PC1 needle, PC2/PC3 carriage',
      statusPort: 'C',
      controlPort: 'C',
      controlWord: 0x9a,
      idleValue: 0x0d,
      statusBits: Object.freeze({ paper: 4, fine: 5, coarse: 6, home: 7 }),
      controlBits: Object.freeze({ paper: 0, needle: 1, towardHome: 2, awayFromHome: 3 })
    }),
    'ur4-c': Object.freeze({
      id: 'ur4-c',
      label: 'BT-100 C-2 (UR-4)',
      shortLabel: 'UR-4 split port C',
      description: 'PC4 paper, PC5 home, PC6 coarse, PC7 fine; PC0 needle, PC1/PC3 carriage, PC2 paper',
      statusPort: 'C',
      controlPort: 'C',
      controlWord: 0x9a,
      idleValue: 0x0e,
      statusBits: Object.freeze({ paper: 4, home: 5, coarse: 6, fine: 7 }),
      controlBits: Object.freeze({ needle: 0, towardHome: 1, paper: 2, awayFromHome: 3 })
    }),
    'bt100-c3': Object.freeze({
      id: 'bt100-c3',
      label: 'BT-100 C-3',
      shortLabel: 'C upper control · C lower status',
      description: 'PC0 fine, PC1 paper, PC2 coarse, PC3 home; PC4 paper, PC5/PC6 carriage, PC7 needle',
      statusPort: 'C',
      controlPort: 'C',
      controlWord: 0x93,
      idleValue: 0x70,
      statusBits: Object.freeze({ fine: 0, paper: 1, coarse: 2, home: 3 }),
      controlBits: Object.freeze({ paper: 4, awayFromHome: 5, towardHome: 6, needle: 7 })
    })
  });

  class BT100Printer {
    constructor(notify) {
      this.notify = notify || (() => {});
      this.pageWidthDots = 480;
      this.pageHeightDots = 700;
      this.leftMarginDots = 20;
      this.rightMarginDots = 20;
      this.topMarginDots = 18;
      this.bottomMarginDots = 18;
      this.dotPitchPx = 4;
      this.dotDiameterPx = 2.45;
      this.speedFactor = 1;
      this.carbonColor = 'black';
      this.pageSerial = 0;
      this.printedDots = [];
      this.dotCount = 0;
      this.paperShiftX = 0;
      this.paperShiftY = 0;

      // The bundled Kompakt BT1 driver uses the Didaktik A/B profile. Keep
      // that as the power-on default; changing wiring profiles does not alter
      // the retained page or the common printer mechanics.
      this.connectionId = 'didaktik-ab';
      this.controlWord = BT100_CONNECTIONS[this.connectionId].controlWord;
      this.portAInput = 0;
      this.portAOutput = 0;
      this.portBOutput = 0;
      this.portC = 0;
      this.resetPortOutputs();

      // Continuous mechanical coordinates. One head unit is one of the 480
      // fine encoder periods across A4. The real DC motor is not a stepper;
      // software learns position exclusively from optical pulses.
      this.headPosition = 0;
      this.headX = 0;
      this.headY = 0;
      this.headDirection = 0;
      this.lastDirection = 1;
      this.paperTravel = 0;
      this.paperEncoderPhase = 0.58;
      this.paperSignal = false;
      this.lastFireBit = 0;
      this.lastMechanicalTime = null;
      this.lastRawTime = null;
      this.cycleEpoch = 0;
      this.frameCycles = 69888;
      // Fine encoder: one pulse per raster pitch. The deeper mechanical notch
      // every twentieth pitch also asserts PA6 while PA5 remains active.
      this.finePulseWidth = 0.42;
      this.coarseMarkerInterval = 20;
      // Desktop transmits an initial sync cycle and then 480 pixel cycles,
      // while BT-BCS completes one final encoder cycle as it returns through
      // x=0. The optical encoder therefore continues beyond both logical
      // raster edges.
      // The optical encoder continues for one non-printing pitch beyond both
      // logical raster edges. Software may wait for the trailing edge of the
      // final encoder pulse before it stops or reverses the carriage.
      this.carriageRunout = 1;
      this.syntheticTime = 0;
      this.lastStatusReadTime = 0;
    }

    effectiveSpeedProfile() {
      const speed = [1, 10, 100].includes(this.speedFactor) ? this.speedFactor : 1;
      // QAOP's peripheral timestamp is the T-state position within a 50 Hz
      // video frame. Calibrate the authentic carriage so a complete 480-pitch
      // traversal takes six seconds on every machine profile:
      //
      //   cycles per pitch = frameCycles * 50 * 6 / 480
      //                    = frameCycles * 0.625
      //
      // Very high settings remain bounded by the encoder-polling rate of the
      // original Z80 driver; the minimum period prevents it from skipping a
      // complete optical pulse and hanging.
      const authenticPitchCycles = this.frameCycles * 50 * 6 / this.pageWidthDots;
      return {
        headPeriodCycles: Math.max(8192, authenticPitchCycles / speed),
        paperPeriodCycles: Math.max(8192, authenticPitchCycles / speed),
        authenticPitchCycles
      };
    }

    setSpeedFactor(value) {
      const number = Number(value);
      this.speedFactor = [1, 10, 100].includes(number) ? number : 1;
      this.notify();
      return this.getStatus();
    }

    setCarbonColor(color) {
      if (color === 'blue' || color === 'black') this.carbonColor = color;
      this.notify();
      return this.getStatus();
    }

    getConnectionProfile() {
      return BT100_CONNECTIONS[this.connectionId] || BT100_CONNECTIONS['didaktik-ab'];
    }

    resetPortOutputs() {
      this.portAOutput = 0;
      this.portBOutput = 0;
      this.portC = 0;
      const profile = this.getConnectionProfile();
      if (profile.controlPort === 'A') this.portAOutput = profile.idleValue;
      else if (profile.controlPort === 'B') this.portBOutput = profile.idleValue;
      else this.portC = profile.idleValue;
      this.headDirection = 0;
      this.lastFireBit = 0;
    }

    setConnectionProfile(id) {
      const profile = BT100_CONNECTIONS[id] || BT100_CONNECTIONS['didaktik-ab'];
      if (profile.id === this.connectionId) return this.getStatus();
      this.connectionId = profile.id;
      this.controlWord = profile.controlWord;
      this.resetPortOutputs();
      this.paperSignal = false;
      this.resetMechanicalClock();
      this.notify();
      return this.getStatus();
    }

    controlOutputValue(profile = this.getConnectionProfile()) {
      if (profile.controlPort === 'A') return this.portAOutput & 0xff;
      if (profile.controlPort === 'B') return this.portBOutput & 0xff;
      return this.portC & 0xff;
    }

    setRawPortOutput(port, value) {
      value &= 0xff;
      if (port === 'A') this.portAOutput = value;
      else if (port === 'B') this.portBOutput = value;
      else this.portC = value;
      return value;
    }

    resetMechanicalClock() {
      this.lastMechanicalTime = null;
      this.lastRawTime = null;
      this.cycleEpoch = 0;
      this.syntheticTime = 0;
    }

    setFrameCycles(value) {
      const cycles = Number(value);
      if (Number.isFinite(cycles) && cycles > 10000) this.frameCycles = cycles;
      this.resetMechanicalClock();
      return this.frameCycles;
    }

    newPage() {
      this.printedDots = [];
      this.dotCount = 0;
      this.headPosition = 0;
      this.headX = 0;
      this.headY = 0;
      this.headDirection = 0;
      this.lastDirection = 1;
      this.paperTravel = 0;
      this.paperEncoderPhase = 0.58;
      this.paperSignal = false;
      this.resetPortOutputs();
      this.resetMechanicalClock();
      this.pageSerial += 1;
      this.notify();
      return this.getStatus();
    }

    resetHead() {
      this.headPosition = 0;
      this.headX = 0;
      this.headDirection = 0;
      this.lastDirection = 1;
      this.resetPortOutputs();
      this.resetMechanicalClock();
      this.notify();
      return this.getStatus();
    }

    shiftPaper(dx = 0, dy = 0) {
      this.paperShiftX = Math.max(-60, Math.min(60, this.paperShiftX + dx));
      this.paperShiftY = Math.max(-60, Math.min(60, this.paperShiftY + dy));
      this.pageSerial += 1;
      this.notify();
      return this.getStatus();
    }

    get paperMotorActive() {
      const profile = this.getConnectionProfile();
      const value = this.controlOutputValue(profile);
      // IN6 is active low in both documented connections.
      return (value & (1 << profile.controlBits.paper)) === 0;
    }

    decodeHeadDirection(value = this.controlOutputValue(), profile = this.getConnectionProfile()) {
      // IN1 and IN4 drive the two opposite ends of the carriage motor.
      const towardHome = !!(value & (1 << profile.controlBits.towardHome));
      const awayFromHome = !!(value & (1 << profile.controlBits.awayFromHome));
      if (towardHome === awayFromHome) return 0;
      return awayFromHome ? 1 : -1;
    }

    normalizeTime(time) {
      if (!Number.isFinite(time)) {
        this.syntheticTime += 64;
        return this.syntheticTime;
      }

      // QAOP exposes the cycle position inside the current video frame. At
      // the frame boundary the value jumps backwards by roughly one complete
      // frame. Keep an epoch so the printer sees a continuous mechanical
      // clock. Dropping that interval occasionally placed a needle strike up
      // to about half a raster pitch early when an encoder wait crossed a
      // video-frame boundary.
      if (this.lastRawTime !== null && time < this.lastRawTime) {
        this.cycleEpoch += this.frameCycles;
      }
      this.lastRawTime = time;
      return time + this.cycleEpoch;
    }

    advanceMechanics(time) {
      const now = this.normalizeTime(time);
      if (this.lastMechanicalTime === null) {
        this.lastMechanicalTime = now;
        return;
      }
      if (now < this.lastMechanicalTime) {
        // A genuine reset/state restore, rather than a normal frame wrap.
        this.lastMechanicalTime = now;
        return;
      }
      const delta = Math.min(20000, Math.max(0, now - this.lastMechanicalTime));
      this.lastMechanicalTime = now;
      if (!delta) return;

      const profile = this.effectiveSpeedProfile();
      if (this.headDirection) {
        const previous = this.headPosition;
        const next = previous + this.headDirection * delta / profile.headPeriodCycles;
        // The 480-pixel Desktop path first consumes a start-of-row sync pulse
        // and then waits for 480 complete PA5 cycles. The last cycle starts at
        // x=480, so the carriage must continue through its falling edge. A
        // clamp at exactly 480 leaves PA5 permanently high and the Z80 loop
        // hangs at the end of the first full-width row.
        const leftStop = -this.carriageRunout;
        const rightStop = this.pageWidthDots + this.carriageRunout;
        this.headPosition = Math.max(leftStop, Math.min(rightStop, next));
        this.headX = Math.max(0, Math.min(this.pageWidthDots, this.headPosition));
      }

      if (this.paperMotorActive) {
        const oldPhase = this.paperEncoderPhase;
        const advance = delta / profile.paperPeriodCycles;
        const total = oldPhase + advance;
        this.paperEncoderPhase = total - Math.floor(total);
        this.paperTravel += advance;
        const oldSignal = oldPhase < 0.42;
        const newSignal = this.paperEncoderPhase < 0.42;
        // Count completed high slots. The driver stops at the falling edge.
        const completed = Math.floor(total) - (oldSignal && !newSignal ? 0 : 0);
        if ((oldSignal && !newSignal) || completed > 0) {
          const lines = Math.max(1, completed);
          this.headY = Math.min(this.pageHeightDots - 1, this.headY + lines);
        }
        this.paperSignal = newSignal;
      }
    }

    encoderPhase() {
      let phase = this.headPosition - Math.floor(this.headPosition);
      if (phase < 0) phase += 1;
      return phase;
    }

    fineEncoderSignal() {
      // PA5 / OUT7 reports every carriage-gear notch.
      return this.encoderPhase() < this.finePulseWidth;
    }

    coarseMarkerSignal() {
      // PA6 / OUT6 reports the deeper notch at every twentieth position. It is
      // a pulse, not a right-limit latch; consequently it always has a falling
      // edge. Desktop waits on PA5|PA6 for row synchronization and would hang
      // if PA6 remained asserted at the right edge.
      const notch = Math.floor(Math.max(0, this.headPosition) + 1e-9);
      return notch % this.coarseMarkerInterval === 0 && this.fineEncoderSignal();
    }

    rightLimitSignal() {
      // Internal UI/debug indication only. No BT-100 status input is driven by
      // this value; the attached Desktop source uses PA6 as the 20-notch marker.
      return this.headPosition >= this.pageWidthDots;
    }

    homeSignal() {
      // OUT1 is the start-of-line/left-end optical stop. It remains active
      // through the short non-printing run-out up to the mechanical stop.
      return this.headPosition <= 0.34;
    }

    fireDot() {
      // BT1 traverses the bitmap in opposite orders on alternate raster rows.
      // On the return scan, a strike observed in encoder interval N belongs to
      // visual microcolumn N-1. Mapping the raw carriage coordinate directly
      // therefore displaced every return row by almost one complete pitch.
      //
      // Do not add a second synthetic notch-edge bias here. The finite PA5
      // pulse and the driver's real instruction timing already leave the
      // expected roughly half-pitch left/right registration difference.
      const reverseCellCorrection = this.lastDirection < 0 ? -1 : 0;
      const maxX = this.pageWidthDots - 1;
      const maxY = this.pageHeightDots - 1;
      const x = Math.max(0, Math.min(maxX, this.headPosition + reverseCellCorrection));
      const y = Math.max(0, Math.min(maxY, this.headY));
      const variant = Math.floor(Math.random() * 20) % 20;
      const jitterX = Math.random() * 2 - 1;
      const jitterY = Math.random() * 2 - 1;
      const darknessJitter = Math.random() * 2 - 1;
      this.printedDots.push({
        x,
        y,
        dir: this.lastDirection,
        variant,
        color: this.carbonColor,
        // Store normalized random samples. The standalone renderer applies
        // the currently selected offset ratio, so already printed dots react
        // immediately when the visual setting changes.
        jitterX,
        jitterY,
        darknessJitter,
        // Legacy fields preserve compatibility with older page renderers.
        dx: jitterX * 0.13,
        dy: jitterY * 0.12,
        opacity: 0.78 + Math.random() * 0.17
      });
      this.dotCount = this.printedDots.length;
      this.notify();
    }

    writeControl(value, time) {
      this.advanceMechanics(time);
      value &= 0xff;
      if (value & 0x80) {
        this.controlWord = value;
        this.resetPortOutputs();
      } else {
        // 8255 BSR mode. Didaktik Gama bank switching is PC0 reset/set via
        // OUT 7Fh,0/1; it must not destroy the selected PPI mode word.
        const bit = (value >> 1) & 7;
        const mask = 1 << bit;
        if (value & 1) this.portC |= mask;
        else this.portC &= ~mask;
        if (this.getConnectionProfile().controlPort === 'C') {
          this.applyControlOutput(this.portC);
        }
      }
      return this.controlWord;
    }

    applyControlOutput(value, profile = this.getConnectionProfile()) {
      const previousFire = this.lastFireBit;
      this.headDirection = this.decodeHeadDirection(value, profile);
      if (this.headDirection) this.lastDirection = this.headDirection;

      const fireBit = value & (1 << profile.controlBits.needle);
      if (!previousFire && fireBit) this.fireDot();
      this.lastFireBit = fireBit;
      if (!this.paperMotorActive) this.paperSignal = false;
    }

    writePort(port, value, time) {
      this.advanceMechanics(time);
      value = this.setRawPortOutput(port, value);
      const profile = this.getConnectionProfile();
      if (profile.controlPort === port) this.applyControlOutput(value, profile);
      return value;
    }

    writePortA(value, time) {
      return this.writePort('A', value, time);
    }

    writePortB(value, time) {
      return this.writePort('B', value, time);
    }

    signalStatusValue(profile = this.getConnectionProfile()) {
      let value = 0;
      if (this.paperSignal) value |= 1 << profile.statusBits.paper;
      if (this.fineEncoderSignal()) value |= 1 << profile.statusBits.fine;
      if (this.coarseMarkerSignal()) value |= 1 << profile.statusBits.coarse;
      if (this.homeSignal()) value |= 1 << profile.statusBits.home;
      return value & 0xff;
    }

    rawPortValue(port) {
      if (port === 'A') return this.portAOutput & 0xff;
      if (port === 'B') return this.portBOutput & 0xff;
      return this.portC & 0xff;
    }

    buildPortValue(port) {
      const profile = this.getConnectionProfile();
      if (profile.statusPort !== port) return this.rawPortValue(port);
      const statusMask = Object.values(profile.statusBits)
        .reduce((mask, bit) => mask | (1 << bit), 0);
      const base = port === 'A' ? this.portAInput : this.rawPortValue(port);
      return ((base & ~statusMask) | this.signalStatusValue(profile)) & 0xff;
    }

    // Retain the old named helper: existing A/B tests and third-party probes use it.
    buildPortAValue() {
      return this.buildPortValue('A');
    }

    buildPortBValue() {
      return this.buildPortValue('B');
    }

    buildPortCValue() {
      return this.buildPortValue('C');
    }

    readPort(port, time) {
      this.advanceMechanics(time);
      if (this.getConnectionProfile().statusPort === port) {
        this.lastStatusReadTime = Number.isFinite(time) ? time : this.syntheticTime;
      }
      return this.buildPortValue(port);
    }

    readPortA(time) {
      return this.readPort('A', time);
    }

    readPortB(time) {
      return this.readPort('B', time);
    }

    readPortC(time) {
      return this.readPort('C', time);
    }

    writePortC(value, time) {
      return this.writePort('C', value, time);
    }

    getStatus() {
      return {
        pageWidthDots: this.pageWidthDots,
        pageHeightDots: this.pageHeightDots,
        pageSerial: this.pageSerial,
        dotCount: this.dotCount,
        // Keep the public/UI coordinate on the printable raster. The internal
        // mechanical coordinate may briefly enter the non-printing run-out.
        headX: Math.round(Math.max(0, Math.min(this.pageWidthDots, this.headPosition))),
        headY: this.headY,
        direction: this.lastDirection,
        motorDirection: this.headDirection,
        paperShiftX: this.paperShiftX,
        paperShiftY: this.paperShiftY,
        carbonColor: this.carbonColor,
        speedFactor: this.speedFactor,
        connectionId: this.connectionId,
        connectionLabel: this.getConnectionProfile().label,
        connectionDescription: this.getConnectionProfile().description,
        connectionShortLabel: this.getConnectionProfile().shortLabel,
        controlWord: this.controlWord,
        portAInput: this.buildPortAValue(),
        portA: this.buildPortAValue(),
        portBOutput: this.buildPortBValue(),
        portB: this.buildPortBValue(),
        portC: this.buildPortCValue(),
        leftLimit: this.homeSignal(),
        rightLimit: this.rightLimitSignal(),
        fineSignal: this.fineEncoderSignal(),
        coarseSignal: this.coarseMarkerSignal(),
        rightSignal: this.rightLimitSignal(),
        paperSignal: this.paperSignal
      };
    }
  }

  global.BT100Printer = BT100Printer;
  global.DidaktikBT100Internals = Object.freeze({ BT100Printer, BT100_CONNECTIONS });
})(window);
