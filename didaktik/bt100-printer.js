(function (global) {
  'use strict';

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

      // BT1 sets 8255 mode 0: port A input, ports B/C output.
      this.controlWord = 0x90;
      this.portAInput = 0;
      this.portBOutput = 0x0d;
      this.portC = 0;

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
      // Desktop transmits an initial sync cycle and then 480 pixel cycles.
      // The carriage therefore needs enough run-out beyond x=480 for the
      // trailing edge of the last pulse to pass the sensor.
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
      this.portBOutput = 0x0d;
      this.lastFireBit = 0;
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
      this.portBOutput = (this.portBOutput & 0xf0) | 0x0d;
      this.lastFireBit = 0;
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
      // PB0 -> BT-100 IN6, active low. 0Ch feeds paper, 0Dh stops it.
      return (this.portBOutput & 0x01) === 0;
    }

    decodeHeadDirection(value = this.portBOutput) {
      // PB2/PB3 drive the two opposite ends of the carriage motor.
      const towardHome = !!(value & 0x04); // PB2 -> IN1
      const awayFromHome = !!(value & 0x08); // PB3 -> IN4
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
        const rightStop = this.pageWidthDots + this.carriageRunout;
        this.headPosition = Math.max(0, Math.min(rightStop, next));
        this.headX = this.headPosition;
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
      // OUT1 is the start-of-line/left-end optical stop and has finite width.
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
      this.printedDots.push({
        x,
        y,
        dir: this.lastDirection,
        variant,
        color: this.carbonColor,
        dx: (Math.random() - 0.5) * 0.26,
        dy: (Math.random() - 0.5) * 0.24,
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
        this.portBOutput = 0x0d;
        this.portC = 0;
        this.headDirection = 0;
        this.lastFireBit = 0;
      } else {
        // 8255 BSR mode. Didaktik Gama bank switching is PC0 reset/set via
        // OUT 7Fh,0/1; it must not destroy the 90h PPI mode configuration.
        const bit = (value >> 1) & 7;
        const mask = 1 << bit;
        if (value & 1) this.portC |= mask;
        else this.portC &= ~mask;
      }
      return this.controlWord;
    }

    writePortB(value, time) {
      this.advanceMechanics(time);
      value &= 0xff;
      const previousFire = this.lastFireBit;
      this.portBOutput = value;
      this.headDirection = this.decodeHeadDirection(value);
      if (this.headDirection) this.lastDirection = this.headDirection;

      const fireBit = value & 0x02;
      if (!previousFire && fireBit) this.fireDot();
      this.lastFireBit = fireBit;
      if (!this.paperMotorActive) this.paperSignal = false;
      return this.portBOutput;
    }

    buildPortAValue() {
      let value = this.portAInput & 0x0f;
      if (this.paperSignal) value |= 0x10; // PA4 <- OUT3: paper encoder
      if (this.fineEncoderSignal()) value |= 0x20; // PA5 <- OUT7: fine head encoder
      if (this.coarseMarkerSignal()) value |= 0x40; // PA6 <- OUT6: deeper every-20th notch
      if (this.homeSignal()) value |= 0x80; // PA7 <- OUT1: home stop
      return value & 0xff;
    }

    readPortA(time) {
      this.advanceMechanics(time);
      this.lastStatusReadTime = Number.isFinite(time) ? time : this.syntheticTime;
      return this.buildPortAValue();
    }

    readPortB(time) {
      this.advanceMechanics(time);
      return this.portBOutput & 0xff;
    }

    readPortC(time) {
      this.advanceMechanics(time);
      return this.portC & 0xff;
    }

    writePortC(value, time) {
      this.advanceMechanics(time);
      this.portC = value & 0xff;
      return this.portC;
    }

    getStatus() {
      return {
        pageWidthDots: this.pageWidthDots,
        pageHeightDots: this.pageHeightDots,
        pageSerial: this.pageSerial,
        dotCount: this.dotCount,
        headX: Math.round(this.headPosition),
        headY: this.headY,
        direction: this.lastDirection,
        motorDirection: this.headDirection,
        paperShiftX: this.paperShiftX,
        paperShiftY: this.paperShiftY,
        carbonColor: this.carbonColor,
        speedFactor: this.speedFactor,
        controlWord: this.controlWord,
        portAInput: this.buildPortAValue(),
        portBOutput: this.portBOutput,
        portC: this.portC,
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
  global.DidaktikBT100Internals = Object.freeze({ BT100Printer });
})(window);
