'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = {
  console,
  Uint8Array,
  ArrayBuffer,
  Map,
  Set,
  Object,
  Number,
  String,
  RangeError,
  Error,
  Math,
  Promise,
  setTimeout,
  clearTimeout,
  requestAnimationFrame(callback) { callback(); },
  qaop: { plug() {}, set() {} }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'bt100-printer.js'), 'utf8'), context, {
  filename: 'bt100-printer.js'
});
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'didaktik-d80.js'), 'utf8'), context, {
  filename: 'didaktik-d80.js'
});

const { DiskImage, Drive, UPD765Subset, DidaktikD80, MACHINE_PROFILES, inferGeometry } = context.DidaktikD80Internals;
const sampleBytes = new Uint8Array(fs.readFileSync(path.join(projectRoot, 'disks', '036-KOMPAKT.d80')));

function makeController(images = [sampleBytes, null]) {
  const drives = [new Drive(0), new Drive(1)];
  for (let index = 0; index < images.length; index += 1) {
    if (images[index]) drives[index].disk = new DiskImage(new Uint8Array(images[index]), { fileName: `drive-${index}.d80` });
  }
  const controller = new UPD765Subset(drives, () => {});
  return { controller, drives };
}

function send(controller, bytes) {
  for (const value of bytes) controller.writeData(value);
}

function readBytes(controller, count) {
  return Array.from({ length: count }, () => controller.readData());
}

(function geometryAndBootSector() {
  const geometry = inferGeometry(sampleBytes);
  assert.deepEqual({ ...geometry }, { tracks: 80, sides: 2, sectorsPerTrack: 9, sectorSize: 512 });
  const disk = new DiskImage(new Uint8Array(sampleBytes), { fileName: 'sample.d80' });
  assert.equal(disk.volumeName, 'NoNameDisk');
  assert.equal(String.fromCharCode(...disk.readSector(0, 0, 1).slice(204, 208)), 'SDOS');
  assert.equal(disk.sectorOffset(0, 1, 1), 9 * 512);
  assert.equal(disk.sectorOffset(80, 0, 1), -1);
})();

(function readDataUsesMdosCompletionStatus() {
  const { controller } = makeController();
  send(controller, [0x46, 0x00, 0, 0, 1, 2, 1, 10, 255]);
  assert.equal(controller.readMainStatus(), 0xf0);
  const data = readBytes(controller, 512);
  assert.deepEqual(data, Array.from(sampleBytes.slice(0, 512)));
  assert.equal(controller.readMainStatus(), 0xd0);
  assert.deepEqual(readBytes(controller, 7), [0x40, 0x80, 0x00, 0, 0, 1, 2]);
  assert.equal(controller.readMainStatus(), 0x80);
})();

(function writeDataAndWriteProtection() {
  const { controller, drives } = makeController();
  const payload = Uint8Array.from({ length: 512 }, (_, index) => index & 0xff);
  send(controller, [0x45, 0x00, 0, 0, 2, 2, 2, 10, 255]);
  assert.equal(controller.readMainStatus(), 0xb0);
  send(controller, payload);
  assert.deepEqual(readBytes(controller, 7), [0x40, 0x80, 0x00, 0, 0, 2, 2]);
  assert.deepEqual(Array.from(drives[0].disk.readSector(0, 0, 2)), Array.from(payload));
  assert.equal(drives[0].disk.dirty, true);

  drives[0].disk.writeProtected = true;
  send(controller, [0x45, 0x00, 0, 0, 3, 2, 3, 10, 255]);
  assert.deepEqual(readBytes(controller, 7), [0x40, 0x02, 0x00, 0, 0, 3, 2]);
})();

(function seekRecalibrateAndTwoDrives() {
  const second = new Uint8Array(sampleBytes);
  const { controller, drives } = makeController([sampleBytes, second]);
  send(controller, [0x0f, 0x01, 37]);
  assert.equal(drives[1].currentTrack, 37);
  send(controller, [0x08]);
  assert.deepEqual(readBytes(controller, 2), [0x21, 37]);

  send(controller, [0x07, 0x01]);
  assert.equal(drives[1].currentTrack, 0);
  send(controller, [0x08]);
  assert.deepEqual(readBytes(controller, 2), [0x21, 0]);

  send(controller, [0x04, 0x01]);
  const status3 = controller.readData();
  assert.equal(status3 & 0x01, 1);
  assert.equal(status3 & 0x20, 0x20);
})();

(function d40DoubleStepKeepsPhysicalTrackSeparateFromSectorId() {
  const bytes = new Uint8Array(40 * 2 * 9 * 512);
  const marker = Uint8Array.from({ length: 512 }, (_, index) => (index * 3 + 7) & 0xff);
  const disk = new DiskImage(bytes, { fileName: 'double-step.d40' });
  assert.equal(disk.geometry.tracks, 40);
  assert.equal(disk.writeSector(1, 0, 1, marker), true);

  const drives = [new Drive(0), new Drive(1)];
  drives[0].disk = disk;
  drives[0].currentTrack = 2; // physical cylinder 2 corresponds to logical D40 cylinder 1
  const controller = new UPD765Subset(drives, () => {});

  send(controller, [0x4a, 0x00]);
  assert.deepEqual(readBytes(controller, 7), [0x00, 0x00, 0x00, 1, 0, 1, 2]);

  send(controller, [0x46, 0x00, 1, 0, 1, 2, 1, 10, 255]);
  assert.deepEqual(readBytes(controller, 512), Array.from(marker));
  assert.deepEqual(readBytes(controller, 7), [0x40, 0x80, 0x00, 1, 0, 1, 2]);
  assert.equal(drives[0].currentTrack, 2);
})();

(function formatTrackAndReset() {
  const blank = new Uint8Array(40 * 2 * 9 * 512);
  const { controller, drives } = makeController([blank, null]);
  drives[0].currentTrack = 3;
  send(controller, [0x4d, 0x00, 2, 9, 80, 0xe5]);
  assert.equal(controller.readMainStatus(), 0xb0);
  const ids = [];
  for (let sector = 1; sector <= 9; sector += 1) ids.push(3, 0, sector, 2);
  send(controller, ids);
  assert.deepEqual(readBytes(controller, 7), [0x00, 0x00, 0x00, 3, 0, 1, 2]);
  assert.equal(drives[0].disk.readSector(3, 0, 1).every(value => value === 0xe5), true);

  send(controller, [0x46, 0x00, 0]);
  assert.equal(controller.phase, 'command');
  controller.powerReset();
  assert.equal(controller.phase, 'idle');
  assert.equal(controller.operationRegister, 0x04);
  assert.equal(drives[0].motor, false);
  assert.equal(drives[0].currentTrack, 0);
})();


(function mdosCatalogAndFileExtraction() {
  const disk = new DiskImage(new Uint8Array(sampleBytes), { fileName: 'sample.d80' });
  const catalog = disk.getCatalog();
  assert.equal(catalog.formatted, true);
  assert.equal(catalog.volumeName, 'NoNameDisk');
  assert.equal(catalog.files.length, 118);

  const help = catalog.files.find(file => file.displayName === 'help   bas.P');
  assert.equal(help.displayName, 'help   bas.P');
  assert.equal(help.typeLetter, 'P');
  assert.equal(help.typeLabel, 'BASIC program');
  assert.equal(help.byteLength, 782);
  assert.equal(help.firstSector, 591);
  assert.deepEqual(Array.from(help.sectors), [591, 592]);
  assert.equal(help.chainComplete, true);

  const extracted = disk.extractFile(help);
  const expected = new Uint8Array(help.byteLength);
  expected.set(sampleBytes.slice(591 * 512, 592 * 512), 0);
  expected.set(sampleBytes.slice(592 * 512, 592 * 512 + (help.byteLength - 512)), 512);
  assert.deepEqual(Array.from(extracted), Array.from(expected));

  const cached = disk.getCatalog();
  assert.equal(cached, catalog);
  disk.writeSector(0, 0, 1, new Uint8Array(512));
  assert.notEqual(disk.getCatalog(), cached);
})();

(function unformattedImageHasNoDirectory() {
  const disk = new DiskImage(new Uint8Array(40 * 2 * 9 * 512), { fileName: 'blank.d40' });
  const catalog = disk.getCatalog();
  assert.equal(catalog.formatted, false);
  assert.equal(catalog.files.length, 0);
  assert.throws(() => disk.extractFile(0), /no longer exists/i);
})();

(async function melodikUsesQaopAyWithoutChangingThe128KProfile() {
  const qaopCalls = [];
  context.qaop = {
    plug() {},
    set(state) { qaopCalls.push({ ...state }); }
  };
  const runtime = {
    setMachineMemoryProfile(profile) { this.profile = profile; },
    getMachineBankState() { return { profile: this.profile || 'spectrum48', bank: null, upperPages: null }; },
    rebuildBusHandlers() {},
    resetMachine() {},
    cpuCore: { nmi() {} }
  };
  const rom = () => new Uint8Array(0x4000);
  const emulator = new DidaktikD80(runtime, new Uint8Array(0x3800), {
    machineId: 'didaktik80',
    machineRoms: { gama: rom(), m: rom(), kompakt: rom() }
  });

  assert.equal(MACHINE_PROFILES.spectrum128.builtInAy, true);
  assert.equal(MACHINE_PROFILES.didaktik80.builtInAy, false);

  await emulator.setMachine('didaktik80', { reset: false });
  assert.equal(qaopCalls.at(-1).ay, false);
  let sound = emulator.setMelodikEnabled(true);
  assert.deepEqual({ ...sound }, {
    available: true, enabled: true, requested: true, builtInAy: false, ayEnabled: true
  });
  assert.equal(qaopCalls.at(-1).ay, true);

  await emulator.setMachine('spectrum128', { reset: false });
  assert.equal(qaopCalls.at(-1).ay, true);
  sound = emulator.getStatus().sound;
  assert.equal(sound.melodikAvailable, false);
  assert.equal(sound.melodikEnabled, false);
  assert.equal(sound.melodikRequested, true);
  assert.equal(sound.builtInAy, true);
  assert.equal(sound.ayEnabled, true);

  sound = emulator.setMelodikEnabled(false);
  assert.equal(sound.ayEnabled, true);
  assert.equal(qaopCalls.at(-1).ay, true);

  await emulator.setMachine('spectrum48', { reset: false });
  assert.equal(qaopCalls.at(-1).ay, false);
  emulator.setMelodikEnabled(true);
  await emulator.setMachine('didaktikM', { reset: false });
  assert.equal(qaopCalls.at(-1).ay, true);
  assert.equal(emulator.getStatus().sound.melodikEnabled, true);

  
(function bt100PrinterBasics() {
  const printer = new context.DidaktikD80Internals.BT100Printer(() => {});
  printer.setSpeedFactor(10);
  assert.equal(printer.readPortA() & 0x80, 0x80); // OUT1: home stop active at the left margin
  printer.writePortB(0x09, 0); // move away from home
  printer.readPortA(9000);
  assert.equal(printer.headX > 0, true);
  assert.equal(printer.readPortA(9100) & 0x80, 0x00);
  printer.writePortB(0x0b, 9200); // same direction plus needle pulse
  assert.equal(printer.printedDots.length, 1);
  printer.writePortB(0x0c, 9300); // paper motor, head stopped
  printer.readPortA(18000);
  assert.equal(printer.headY > 0, true);
  printer.writeControl(0x90);
  printer.writeControl(0x01); // BSR: set PC0 without destroying the mode word
  assert.equal(printer.controlWord, 0x90);
  assert.equal(printer.readPortC() & 1, 1);

  // PA6/OUT6 is the deeper every-20th-notch marker. It must pulse and
  // return low; Desktop waits for both edges of PA5|PA6 at row start.
  printer.headPosition = 19.1;
  assert.equal(printer.buildPortAValue() & 0x40, 0x00);
  printer.headPosition = 20.1;
  assert.equal(printer.buildPortAValue() & 0x40, 0x40);
  printer.headPosition = 20.5;
  assert.equal(printer.buildPortAValue() & 0x40, 0x00);
  printer.headPosition = 40.1;
  assert.equal(printer.buildPortAValue() & 0x40, 0x40);
  printer.headPosition = 41.1;
  assert.equal(printer.buildPortAValue() & 0x40, 0x00);
})();

(function bt100DesktopFullWidthRowReachesFinalFallingEdge() {
  const printer = new context.DidaktikD80Internals.BT100Printer(() => {});
  printer.setSpeedFactor(100);
  const frame = printer.frameCycles;
  let elapsed = 0;

  function rawTime() {
    return elapsed % frame;
  }

  function readStatus() {
    elapsed += 128;
    return printer.readPortA(rawTime());
  }

  function waitStable(mask, asserted, label) {
    let consecutive = 0;
    for (let polls = 0; polls < 20000; polls += 1) {
      const active = (readStatus() & mask) !== 0;
      consecutive = active === asserted ? consecutive + 1 : 0;
      if (consecutive === 2) return;
    }
    assert.fail(`BT-100 Desktop handshake timed out waiting for ${label}`);
  }

  function waitPulse(mask, label) {
    waitStable(mask, true, `${label} high`);
    waitStable(mask, false, `${label} low`);
  }

  // Exact A/B profile command sequence from Desktop raster-frontend.asm.
  printer.writeControl(0x90, rawTime());
  printer.writePortB(0x07, rawTime());       // seek home
  waitStable(0x80, true, 'PA7 home');
  printer.writePortB(0x0b, rawTime());       // leave home, carriage right
  waitStable(0x80, false, 'PA7 home release');
  waitPulse(0x60, 'PA5|PA6 row synchronization');

  for (let pixel = 0; pixel < 480; pixel += 1) {
    waitPulse(0x20, `PA5 pixel ${pixel + 1}`);
  }

  assert.ok(printer.headPosition > 480 + printer.finePulseWidth,
    `final pulse did not reach its falling edge: x=${printer.headPosition}`);
  assert.equal(printer.buildPortAValue() & 0x60, 0,
    'PA5/PA6 must be low after the 480th full-width pixel cycle');

  printer.writePortB(0x0e, rawTime());       // stop head, advance paper
  waitPulse(0x10, 'PA4 line advance');
  printer.writePortB(0x0f, rawTime());       // finish/stop
})();

(function bt100ClockContinuesAcrossQaopFrameWrap() {
  const printer = new context.DidaktikD80Internals.BT100Printer(() => {});
  printer.setSpeedFactor(1);
  printer.setFrameCycles(69888);
  printer.writePortB(0x09, 53000); // start the carriage late in a video frame
  printer.readPortA(3000);         // first poll in the following frame
  const expected = (69888 - 53000 + 3000) / (69888 * 0.625);
  assert.ok(Math.abs(printer.headPosition - expected) < 0.0001,
    `frame-wrap travel ${printer.headPosition} differs from ${expected}`);
})();


(function bt100AuthenticSpeedIsSixSecondsPerFullRow() {
  const printer = new context.DidaktikD80Internals.BT100Printer(() => {});
  printer.setSpeedFactor(1);
  for (const frameCycles of [69888, 70908]) {
    printer.setFrameCycles(frameCycles);
    const profile = printer.effectiveSpeedProfile();
    const seconds = profile.headPeriodCycles * printer.pageWidthDots / (frameCycles * 50);
    assert.ok(Math.abs(seconds - 6) < 1e-9, `full-row time ${seconds} differs from 6 seconds`);
  }
  printer.setSpeedFactor(2);
  assert.equal(printer.speedFactor, 1);
  printer.setSpeedFactor(10);
  assert.equal(printer.speedFactor, 10);
  printer.setSpeedFactor(100);
  assert.equal(printer.speedFactor, 100);
})();

console.log('Controller and machine-profile tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
