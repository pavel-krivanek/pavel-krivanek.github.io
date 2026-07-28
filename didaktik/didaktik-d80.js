(function (global) {
  'use strict';

  const PORT_MSR = 0x83;
  const PORT_DATA = 0x87;
  const PORT_OPERATION = 0x8f;
  const PORT_8255_PORT_A = 0x1f;
  const PORT_8255_PORT_B = 0x3f;
  const PORT_8255_PORT_C = 0x5f;
  const PORT_8255_CONTROL = 0x7f;
  const PORT_8255_DISABLE = 0x97;
  const PORT_8255_ENABLE = 0x99;
  const KEMPSTON_MOUSE_BUTTONS_PORT = 0xfadf;
  const KEMPSTON_MOUSE_X_PORT = 0xfbdf;
  const KEMPSTON_MOUSE_Y_PORT = 0xffdf;
  const KEMPSTON_MOUSE_BUTTONS_MASK = 0x0120;
  const KEMPSTON_MOUSE_AXIS_MASK = 0x0520;
  const SECTOR_SIZE = 512;

  const MACHINE_PROFILES = Object.freeze({
    didaktik80: Object.freeze({
      id: 'didaktik80',
      label: 'Didaktik 80K',
      shortLabel: 'GAMA',
      qaopModel: 0,
      memoryProfile: 'didaktik80',
      bundledRom: 'gama',
      builtInAy: false,
      memoryDescription: '16K ROM + fixed 16K screen RAM + two switchable 32K RAM banks',
      bankPort: 0x7f,
      frameCycles: 69888
    }),
    didaktikM: Object.freeze({
      id: 'didaktikM',
      label: 'Didaktik M',
      shortLabel: 'M',
      qaopModel: 0,
      memoryProfile: 'spectrum48',
      bundledRom: 'm',
      builtInAy: false,
      memoryDescription: '16K Didaktik M 1992 ROM + linear 48K RAM',
      frameCycles: 69888
    }),
    didaktikKompakt: Object.freeze({
      id: 'didaktikKompakt',
      label: 'Didaktik Kompakt',
      shortLabel: 'KOMPAKT',
      qaopModel: 0,
      memoryProfile: 'spectrum48',
      bundledRom: 'kompakt',
      builtInAy: false,
      memoryDescription: '16K Didaktik Kompakt 1993 ROM + linear 48K RAM with integrated D80',
      frameCycles: 69888
    }),
    spectrum48: Object.freeze({
      id: 'spectrum48',
      label: 'ZX Spectrum 48K',
      shortLabel: '48K',
      qaopModel: 0,
      memoryProfile: 'spectrum48',
      bundledRom: null,
      builtInAy: false,
      memoryDescription: '16K ROM + linear 48K RAM',
      frameCycles: 69888
    }),
    spectrum128: Object.freeze({
      id: 'spectrum128',
      label: 'ZX Spectrum 128K',
      shortLabel: '128K',
      qaopModel: 1,
      memoryProfile: 'spectrum128',
      bundledRom: null,
      builtInAy: true,
      memoryDescription: 'two 16K ROMs + eight 16K RAM pages, selected through port 7FFDh',
      frameCycles: 70908
    })
  });

  const CMD_PARAM_COUNTS = new Map([
    [0x03, 2], // SPECIFY
    [0x04, 1], // SENSE DRIVE STATUS
    [0x05, 8], // WRITE DATA
    [0x06, 8], // READ DATA
    [0x07, 1], // RECALIBRATE
    [0x08, 0], // SENSE INTERRUPT STATUS
    [0x0a, 1], // READ ID
    [0x0d, 5], // FORMAT TRACK
    [0x0f, 2]  // SEEK
  ]);

  function ascii(bytes) {
    return Array.from(bytes, value => value >= 32 && value < 127 ? String.fromCharCode(value) : '').join('').replace(/\0+$/g, '').trim();
  }

  function inferGeometry(bytes, fallbackTracks = 80, fallbackSectors = 9) {
    let tracks = fallbackTracks;
    let sides = 2;
    let sectorsPerTrack = fallbackSectors;

    if (bytes.length >= SECTOR_SIZE && ascii(bytes.slice(204, 208)) === 'SDOS') {
      const bootTracks = bytes[178];
      const bootSectors = bytes[179];
      const bootSides = bytes[177] & 0x10 ? 2 : 1;
      if (bootTracks >= 1 && bootTracks <= 82) tracks = bootTracks;
      if (bootSectors >= 1 && bootSectors <= 16) sectorsPerTrack = bootSectors;
      sides = bootSides;
    } else {
      const standard = [
        { size: 40 * 2 * 9 * SECTOR_SIZE, tracks: 40, sectors: 9 },
        { size: 40 * 2 * 10 * SECTOR_SIZE, tracks: 40, sectors: 10 },
        { size: 80 * 2 * 9 * SECTOR_SIZE, tracks: 80, sectors: 9 },
        { size: 80 * 2 * 10 * SECTOR_SIZE, tracks: 80, sectors: 10 }
      ].find(candidate => candidate.size === bytes.length);
      if (standard) {
        tracks = standard.tracks;
        sectorsPerTrack = standard.sectors;
      } else if (bytes.length % (2 * SECTOR_SIZE) === 0) {
        const sectorsPerSide = bytes.length / (2 * SECTOR_SIZE);
        for (const sectors of [9, 10]) {
          const possibleTracks = sectorsPerSide / sectors;
          if (Number.isInteger(possibleTracks) && possibleTracks >= 1 && possibleTracks <= 82) {
            tracks = possibleTracks;
            sectorsPerTrack = sectors;
            break;
          }
        }
      }
    }

    return { tracks, sides, sectorsPerTrack, sectorSize: SECTOR_SIZE };
  }

  const MDOS_FILE_TYPES = Object.freeze({
    P: 'BASIC program',
    B: 'Bytes',
    N: 'Number array',
    C: 'Character array',
    S: 'Snapshot',
    Q: 'Sequence'
  });
  const MDOS_FAT_SECTORS = 5;
  const MDOS_FAT_ENTRIES_PER_SECTOR = 341;
  const MDOS_DIRECTORY_FIRST_SECTOR = 6;
  const MDOS_DIRECTORY_SECTORS = 8;
  const MDOS_DIRECTORY_ENTRY_SIZE = 32;

  function littleEndian16(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function decodeMdosName(bytes, typeLetter) {
    const name = Array.from(bytes, value => value ? String.fromCharCode(value) : ' ')
      .join('').replace(/ +$/g, '');
    const baseName = name || 'unnamed';
    return {
      baseName,
      displayName: `${baseName}.${typeLetter}`
    };
  }

  class DiskImage {
    constructor(bytes, options = {}) {
      this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
      this.fileName = options.fileName || 'untitled.d80';
      this.writeProtected = !!options.writeProtected;
      this.dirty = false;
      this.geometry = inferGeometry(this.bytes, options.tracks || 80, options.sectorsPerTrack || 9);
      this.revision = 0;
      this.catalogCache = null;
      this.catalogRevision = -1;
    }

    get byteLength() {
      return this.bytes.length;
    }

    get isMdosFormatted() {
      return this.bytes.length >= SECTOR_SIZE && ascii(this.bytes.slice(204, 208)) === 'SDOS';
    }

    get volumeName() {
      if (this.isMdosFormatted) return ascii(this.bytes.slice(192, 202)) || 'Unnamed';
      return 'Unformatted';
    }

    markChanged() {
      this.dirty = true;
      this.revision += 1;
      this.catalogCache = null;
    }

    sectorOffset(cylinder, head, sector) {
      const { tracks, sides, sectorsPerTrack } = this.geometry;
      if (cylinder < 0 || cylinder >= tracks || head < 0 || head >= sides || sector < 1 || sector > sectorsPerTrack) {
        return -1;
      }
      const logicalTrack = cylinder * sides + head;
      const offset = (logicalTrack * sectorsPerTrack + sector - 1) * SECTOR_SIZE;
      return offset + SECTOR_SIZE <= this.bytes.length ? offset : -1;
    }

    logicalSectorOffset(sector) {
      const offset = sector * SECTOR_SIZE;
      return sector >= 0 && offset + SECTOR_SIZE <= this.bytes.length ? offset : -1;
    }

    readSector(cylinder, head, sector) {
      const offset = this.sectorOffset(cylinder, head, sector);
      return offset < 0 ? null : this.bytes.slice(offset, offset + SECTOR_SIZE);
    }

    writeSector(cylinder, head, sector, data) {
      if (this.writeProtected) return false;
      const offset = this.sectorOffset(cylinder, head, sector);
      if (offset < 0 || data.length < SECTOR_SIZE) return false;
      this.bytes.set(data.subarray(0, SECTOR_SIZE), offset);
      this.markChanged();
      return true;
    }

    formatTrack(cylinder, physicalHead, ids, filler) {
      if (this.writeProtected) return false;
      let wrote = false;
      for (const id of ids) {
        const [c, , r, n] = id;
        if (n !== 2) continue;
        const offset = this.sectorOffset(c, physicalHead, r);
        if (offset < 0) continue;
        this.bytes.fill(filler, offset, offset + SECTOR_SIZE);
        wrote = true;
      }
      if (wrote) this.markChanged();
      return wrote;
    }

    readFatEntry(index) {
      if (!this.isMdosFormatted || index < 0) return null;
      const fatSector = Math.floor(index / MDOS_FAT_ENTRIES_PER_SECTOR);
      if (fatSector >= MDOS_FAT_SECTORS) return null;
      const localIndex = index % MDOS_FAT_ENTRIES_PER_SECTOR;
      const pairIndex = Math.floor(localIndex / 2);
      const offset = (1 + fatSector) * SECTOR_SIZE + pairIndex * 3;
      if (offset + 2 >= this.bytes.length) return null;
      if ((localIndex & 1) === 0) return this.bytes[offset] | ((this.bytes[offset + 1] & 0xf0) << 4);
      return this.bytes[offset + 2] | ((this.bytes[offset + 1] & 0x0f) << 8);
    }

    traceFatChain(firstSector, byteLength) {
      const expectedSectors = Math.ceil(byteLength / SECTOR_SIZE);
      if (!expectedSectors) return { sectors: [], complete: true, error: '' };
      const totalSectors = Math.floor(this.bytes.length / SECTOR_SIZE);
      const sectors = [];
      const visited = new Set();
      let current = firstSector;
      let error = '';

      while (sectors.length < expectedSectors) {
        if (!Number.isInteger(current) || current < 0 || current >= totalSectors) {
          error = `Sector ${current} is outside the image.`;
          break;
        }
        if (visited.has(current)) {
          error = `FAT loop at sector ${current}.`;
          break;
        }
        visited.add(current);
        sectors.push(current);
        if (sectors.length >= expectedSectors) break;

        const next = this.readFatEntry(current);
        if (next === null) {
          error = `FAT entry ${current} is unavailable.`;
          break;
        }
        if (next >= 0xe00) {
          error = 'FAT chain ends before the directory length.';
          break;
        }
        if (next === 0 || next === 0xddd || next === 0xdff || next >= 0xd00) {
          error = `Invalid FAT value ${next.toString(16).toUpperCase().padStart(3, '0')}h after sector ${current}.`;
          break;
        }
        current = next;
      }

      return { sectors, complete: sectors.length === expectedSectors, error };
    }

    getCatalog() {
      if (this.catalogCache && this.catalogRevision === this.revision) return this.catalogCache;
      const totalSectors = Math.floor(this.bytes.length / SECTOR_SIZE);
      const catalog = {
        formatted: this.isMdosFormatted,
        volumeName: this.volumeName,
        totalSectors,
        totalBytes: this.bytes.length,
        freeSectors: 0,
        badSectors: 0,
        files: [],
        error: ''
      };

      if (!catalog.formatted) {
        this.catalogCache = catalog;
        this.catalogRevision = this.revision;
        return catalog;
      }

      const directoryOffset = MDOS_DIRECTORY_FIRST_SECTOR * SECTOR_SIZE;
      const directoryLength = MDOS_DIRECTORY_SECTORS * SECTOR_SIZE;
      if (directoryOffset + directoryLength > this.bytes.length) {
        catalog.error = 'The image is too short to contain the MDOS directory.';
        this.catalogCache = catalog;
        this.catalogRevision = this.revision;
        return catalog;
      }

      const entryCount = directoryLength / MDOS_DIRECTORY_ENTRY_SIZE;
      for (let directoryIndex = 0; directoryIndex < entryCount; directoryIndex += 1) {
        const offset = directoryOffset + directoryIndex * MDOS_DIRECTORY_ENTRY_SIZE;
        const typeLetter = String.fromCharCode(this.bytes[offset]);
        if (!MDOS_FILE_TYPES[typeLetter]) continue;
        const name = decodeMdosName(this.bytes.slice(offset + 1, offset + 11), typeLetter);
        const byteLength = littleEndian16(this.bytes, offset + 11) | (this.bytes[offset + 21] << 16);
        const startAddress = littleEndian16(this.bytes, offset + 13);
        const basicLength = littleEndian16(this.bytes, offset + 15);
        const firstSector = littleEndian16(this.bytes, offset + 17);
        const attributes = this.bytes[offset + 20];
        const chain = this.traceFatChain(firstSector, byteLength);
        const attributeText = 'HSPARWED'.split('').filter((letter, bit) => attributes & (0x80 >> bit)).join('');

        catalog.files.push({
          directoryIndex,
          typeLetter,
          typeLabel: MDOS_FILE_TYPES[typeLetter],
          baseName: name.baseName,
          displayName: name.displayName,
          byteLength,
          startAddress,
          basicLength,
          firstSector,
          attributes,
          attributeText,
          sectors: chain.sectors,
          chainComplete: chain.complete,
          chainError: chain.error
        });
      }

      const maximumFatSector = Math.min(totalSectors, MDOS_FAT_SECTORS * MDOS_FAT_ENTRIES_PER_SECTOR);
      for (let sector = 0; sector < maximumFatSector; sector += 1) {
        const value = this.readFatEntry(sector);
        if (value === 0) catalog.freeSectors += 1;
        else if (value === 0xdff) catalog.badSectors += 1;
      }

      this.catalogCache = catalog;
      this.catalogRevision = this.revision;
      return catalog;
    }

    extractFile(fileOrDirectoryIndex) {
      const catalog = this.getCatalog();
      const file = typeof fileOrDirectoryIndex === 'number'
        ? catalog.files.find(entry => entry.directoryIndex === fileOrDirectoryIndex)
        : fileOrDirectoryIndex;
      if (!file) throw new Error('The selected directory entry no longer exists.');
      if (!file.chainComplete) throw new Error(file.chainError || 'The file has an incomplete FAT chain.');
      const result = new Uint8Array(file.byteLength);
      let outputOffset = 0;
      for (const sector of file.sectors) {
        const inputOffset = this.logicalSectorOffset(sector);
        if (inputOffset < 0) throw new Error(`Sector ${sector} is outside the image.`);
        const length = Math.min(SECTOR_SIZE, result.length - outputOffset);
        result.set(this.bytes.subarray(inputOffset, inputOffset + length), outputOffset);
        outputOffset += length;
        if (outputOffset >= result.length) break;
      }
      return result;
    }
  }


  class Drive {
    constructor(index) {
      this.index = index;
      this.disk = null;
      this.currentTrack = 0;
      this.motor = false;
      this.led = false;
      this.physicalTracks = 80;
    }

    get ready() {
      return !!this.disk;
    }
  }

  class UPD765Subset {
    constructor(drives, notify) {
      this.drives = drives;
      this.notify = notify;
      this.operationRegister = 0x04;
      this.selectedDrive = 0;
      this.commandByte = null;
      this.commandCode = null;
      this.params = [];
      this.expectedParams = 0;
      this.phase = 'idle';
      this.transfer = null;
      this.transferIndex = 0;
      this.result = [];
      this.resultIndex = 0;
      this.interruptResults = [];
    }

    reset() {
      this.commandByte = null;
      this.commandCode = null;
      this.params = [];
      this.expectedParams = 0;
      this.phase = 'idle';
      this.transfer = null;
      this.transferIndex = 0;
      this.result = [];
      this.resultIndex = 0;
      this.interruptResults.length = 0;
      this.pendingTransfer = null;
      this.pendingResult = null;
      this.notify();
    }

    powerReset() {
      this.operationRegister = 0x04;
      this.selectedDrive = 0;
      for (const drive of this.drives) {
        drive.motor = false;
        drive.led = false;
        drive.currentTrack = 0;
      }
      this.reset();
    }

    readMainStatus() {
      switch (this.phase) {
        case 'command': return 0x90;
        case 'exec-read': return 0xf0;
        case 'exec-write': return 0xb0;
        case 'result': return 0xd0;
        default: return 0x80;
      }
    }

    readData() {
      if (this.phase === 'exec-read') {
        const value = this.transfer[this.transferIndex++] ?? 0xff;
        if (this.transferIndex >= this.transfer.length) this.enterResult(this.pendingResult || []);
        return value;
      }
      if (this.phase === 'result') {
        const value = this.result[this.resultIndex++] ?? 0x80;
        if (this.resultIndex >= this.result.length) this.enterIdle();
        return value;
      }
      return 0xff;
    }

    writeData(value) {
      value &= 0xff;
      if (this.phase === 'exec-write') {
        this.transfer[this.transferIndex++] = value;
        if (this.transferIndex >= this.transfer.length) this.finishWriteTransfer();
        return;
      }

      if (this.phase === 'idle') {
        this.commandByte = value;
        this.commandCode = value & 0x1f;
        this.params = [];
        this.expectedParams = CMD_PARAM_COUNTS.get(this.commandCode);
        if (this.expectedParams === undefined) {
          this.enterResult([0x80]);
        } else if (this.expectedParams === 0) {
          this.executeCommand();
        } else {
          this.phase = 'command';
        }
        return;
      }

      if (this.phase === 'command') {
        this.params.push(value);
        if (this.params.length >= this.expectedParams) this.executeCommand();
      }
    }

    writeOperation(value) {
      value &= 0xff;
      const previous = this.operationRegister;
      this.operationRegister = value;
      this.selectedDrive = value & 1;
      this.drives[0].motor = !!(value & 0x10);
      this.drives[1].motor = !!(value & 0x20);
      this.drives[0].led = this.drives[0].motor && this.selectedDrive === 0;
      this.drives[1].led = this.drives[1].motor && this.selectedDrive === 1;
      if ((previous & 0x04) && !(value & 0x04)) this.reset();
      this.notify();
    }

    enterIdle() {
      this.phase = 'idle';
      this.commandByte = null;
      this.commandCode = null;
      this.params = [];
      this.expectedParams = 0;
      this.transfer = null;
      this.transferIndex = 0;
      this.result = [];
      this.resultIndex = 0;
      this.pendingResult = null;
      this.notify();
    }

    enterResult(bytes) {
      this.phase = 'result';
      this.result = Array.from(bytes, value => value & 0xff);
      this.resultIndex = 0;
      this.transfer = null;
      this.transferIndex = 0;
      this.pendingResult = null;
      this.notify();
    }

    executeCommand() {
      const command = this.commandCode;
      switch (command) {
        case 0x03: // SPECIFY
          this.enterIdle();
          break;
        case 0x04:
          this.senseDriveStatus();
          break;
        case 0x05:
          this.beginWriteData();
          break;
        case 0x06:
          this.beginReadData();
          break;
        case 0x07:
          this.recalibrate();
          break;
        case 0x08:
          this.senseInterruptStatus();
          break;
        case 0x0a:
          this.readId();
          break;
        case 0x0d:
          this.beginFormatTrack();
          break;
        case 0x0f:
          this.seek();
          break;
        default:
          this.enterResult([0x80]);
          break;
      }
    }

    decodeDriveHead(value = this.params[0] || 0) {
      const unit = value & 0x03;
      const index = unit & 1;
      const head = (value >> 2) & 1;
      return { unit, index, head, drive: this.drives[index] };
    }

    status0(unit, head, abnormal = false, notReady = false) {
      return (abnormal ? 0x40 : 0) | (notReady ? 0x08 : 0) | ((head & 1) << 2) | (unit & 3);
    }

    senseDriveStatus() {
      const { unit, head, drive } = this.decodeDriveHead();
      let status = (unit & 3) | ((head & 1) << 2) | 0x08;
      if (drive.currentTrack === 0) status |= 0x10;
      if (drive.ready) status |= 0x20;
      if (drive.disk?.writeProtected) status |= 0x40;
      this.enterResult([status]);
    }

    recalibrate() {
      const { unit, index, head, drive } = this.decodeDriveHead();
      drive.currentTrack = 0;
      const st0 = 0x20 | ((head & 1) << 2) | (unit & 3);
      this.interruptResults.push([st0, 0]);
      this.enterIdle();
      this.notify();
    }

    seek() {
      const { unit, head, drive } = this.decodeDriveHead();
      const requested = this.params[1] & 0xff;
      drive.currentTrack = Math.min(requested, Math.max(0, drive.physicalTracks - 1));
      let st0 = 0x20 | ((head & 1) << 2) | (unit & 3);
      if (requested >= drive.physicalTracks) st0 |= 0x10;
      this.interruptResults.push([st0, drive.currentTrack]);
      this.enterIdle();
      this.notify();
    }

    senseInterruptStatus() {
      const pending = this.interruptResults.shift();
      this.enterResult(pending || [0x80]);
    }

    readId() {
      const { unit, head, drive } = this.decodeDriveHead();
      const cylinder = drive.disk?.geometry.tracks <= 40 && drive.physicalTracks >= 80
        ? Math.floor(drive.currentTrack / 2)
        : drive.currentTrack;
      if (!drive.ready) {
        this.enterResult([
          this.status0(unit, head, true, true), 0x05, 0x00,
          cylinder, head, 1, 2
        ]);
        return;
      }
      const sector = 1;
      this.enterResult([
        this.status0(unit, head), 0x00, 0x00,
        cylinder, head, sector, 2
      ]);
    }

    beginReadData() {
      const { unit, head, drive } = this.decodeDriveHead();
      const [driveHead, c, h, r, n] = this.params;
      void driveHead;
      if (!drive.ready) {
        this.enterResult([this.status0(unit, head, true, true), 0x05, 0, c, h, r, n]);
        return;
      }
      const sector = drive.disk.readSector(c, head, r);
      if (!sector) {
        this.enterResult([this.status0(unit, head, true), 0x04, 0, c, h, r, n]);
        return;
      }
      this.phase = 'exec-read';
      this.transfer = sector;
      this.transferIndex = 0;
      // MDOS requests one sector with EOT equal to R. A real uPD765 ends that
      // transfer with IC=01 (abnormal termination) plus ST1.EN=1; MDOS treats
      // precisely that pair as the successful single-sector completion.
      this.pendingResult = [this.status0(unit, head, true), 0x80, 0x00, c, h, r, n];
      drive.led = true;
      this.notify();
    }

    beginWriteData() {
      const { unit, head, drive } = this.decodeDriveHead();
      const [, c, h, r, n] = this.params;
      if (!drive.ready) {
        this.enterResult([this.status0(unit, head, true, true), 0x05, 0, c, h, r, n]);
        return;
      }
      if (drive.disk.writeProtected) {
        this.enterResult([this.status0(unit, head, true), 0x02, 0, c, h, r, n]);
        return;
      }
      const length = n <= 7 ? 128 << n : SECTOR_SIZE;
      this.phase = 'exec-write';
      this.transfer = new Uint8Array(length);
      this.transferIndex = 0;
      this.pendingTransfer = { type: 'write', unit, head, c, h, r, n, drive };
      drive.led = true;
      this.notify();
    }

    beginFormatTrack() {
      const { unit, head, drive } = this.decodeDriveHead();
      const [, n, sectorCount, , filler] = this.params;
      if (!drive.ready) {
        this.enterResult([this.status0(unit, head, true, true), 0x05, 0, drive.currentTrack, head, 1, n]);
        return;
      }
      if (drive.disk.writeProtected) {
        this.enterResult([this.status0(unit, head, true), 0x02, 0, drive.currentTrack, head, 1, n]);
        return;
      }
      this.phase = 'exec-write';
      this.transfer = new Uint8Array(sectorCount * 4);
      this.transferIndex = 0;
      this.pendingTransfer = { type: 'format', unit, head, n, sectorCount, filler, drive };
      drive.led = true;
      this.notify();
    }

    finishWriteTransfer() {
      const job = this.pendingTransfer;
      this.pendingTransfer = null;
      if (!job) {
        this.enterResult([0x80]);
        return;
      }

      if (job.type === 'write') {
        const ok = job.drive.disk.writeSector(job.c, job.head, job.r, this.transfer);
        this.enterResult([
          this.status0(job.unit, job.head, true), ok ? 0x80 : 0x04, 0,
          job.c, job.h, job.r, job.n
        ]);
      } else {
        const ids = [];
        for (let offset = 0; offset + 3 < this.transfer.length; offset += 4) {
          ids.push(Array.from(this.transfer.slice(offset, offset + 4)));
        }
        const first = ids[0] || [job.drive.currentTrack, job.head, 1, job.n];
        const ok = job.drive.disk.formatTrack(job.drive.currentTrack, job.head, ids, job.filler);
        this.enterResult([
          this.status0(job.unit, job.head, !ok), ok ? 0x00 : 0x04, 0,
          first[0], first[1], first[2], first[3]
        ]);
      }
      this.notify();
    }
  }

  class KempstonMouse {
    constructor(notify = () => {}) {
      this.notify = notify;
      this.enabled = false;
      this.x = 0;
      this.y = 0;
      this.buttons = 0xff;
    }

    setEnabled(enabled) {
      const next = !!enabled;
      if (this.enabled === next) return this.getStatus();
      this.enabled = next;
      if (!next) this.buttons = 0xff;
      this.notify();
      return this.getStatus();
    }

    move(deltaX, deltaY) {
      if (!this.enabled) return false;
      const dx = Math.trunc(Number(deltaX) || 0);
      const dy = Math.trunc(Number(deltaY) || 0);
      if (!dx && !dy) return false;
      this.x = (this.x + dx) & 0xff;
      // Kempston Y is a free-running counter whose conventional screen driver
      // direction is opposite to DOM movementY (positive DOM Y means down).
      this.y = (this.y - dy) & 0xff;
      this.notify();
      return true;
    }

    setButton(browserButton, pressed) {
      if (!this.enabled) return false;
      const bit = browserButton === 0 ? 1 : browserButton === 1 ? 2 : browserButton === 2 ? 0 : -1;
      if (bit < 0) return false;
      const mask = 1 << bit;
      const next = pressed ? (this.buttons & ~mask) : (this.buttons | mask);
      if (next === this.buttons) return false;
      this.buttons = next & 0xff;
      this.notify();
      return true;
    }

    releaseButtons() {
      if (this.buttons === 0xff) return false;
      this.buttons = 0xff;
      this.notify();
      return true;
    }

    readPort(port) {
      if (!this.enabled) return null;
      port &= 0xffff;
      if ((port & KEMPSTON_MOUSE_BUTTONS_MASK) === (KEMPSTON_MOUSE_BUTTONS_PORT & KEMPSTON_MOUSE_BUTTONS_MASK)) {
        return this.buttons;
      }
      if ((port & KEMPSTON_MOUSE_AXIS_MASK) === (KEMPSTON_MOUSE_X_PORT & KEMPSTON_MOUSE_AXIS_MASK)) {
        return this.x;
      }
      if ((port & KEMPSTON_MOUSE_AXIS_MASK) === (KEMPSTON_MOUSE_Y_PORT & KEMPSTON_MOUSE_AXIS_MASK)) {
        return this.y;
      }
      return null;
    }

    getStatus() {
      return {
        enabled: this.enabled,
        x: this.x,
        y: this.y,
        buttons: this.buttons,
        left: !(this.buttons & 0x02),
        right: !(this.buttons & 0x01),
        middle: !(this.buttons & 0x04)
      };
    }
  }

  class DidaktikD80 {
    constructor(runtime, mdosRom, options = {}) {
      this.runtime = runtime;
      this.machineProfiles = MACHINE_PROFILES;
      this.machineRoms = options.machineRoms || (options.baseRom ? { gama: options.baseRom } : {});
      this.currentMachineId = options.machineId || 'didaktik80';
      this.melodikEnabled = !!options.melodikEnabled;
      this.listeners = new Set();
      this.drives = [new Drive(0), new Drive(1)];
      this.memory = new Uint8Array(0x4000);
      this.memory.fill(0xff);
      this.memory.set(mdosRom.subarray(0, 0x3800), 0);
      this.memory.fill(0, 0x3800, 0x4000);
      this.memory.qaopWriteStart = 0x3800;
      this.paged = false;
      this.controller = new UPD765Subset(this.drives, () => this.scheduleNotify());
      this.printer = new global.BT100Printer(() => this.scheduleNotify());
      this.mouse = new KempstonMouse(() => this.scheduleNotify());
      this.printer.setFrameCycles(this.getMachineProfile().frameCycles);
      this.device = this.createDevice();
    }

    createDevice() {
      const self = this;
      return {
        name: 'Didaktik D80',
        rom: null,
        reset() {
          self.pageOut();
          self.controller.reset();
        },
        m1(address, ir) {
          let flags = self.device.edge_m1(address, ir);
          if (address === 0x0000 || address === 0x0008) {
            if (self.pageIn()) flags |= 2;
          } else if (address === 0x1700) {
            if (self.pageOut()) flags |= 2;
          }
          return flags;
        },
        in(port, time) {
          const low = port & 0xff;
          if (low === PORT_MSR) return self.controller.readMainStatus();
          if (low === PORT_DATA) return self.controller.readData();
          if (low === PORT_OPERATION) return self.controller.operationRegister;
          if (low === PORT_8255_PORT_A) return self.printer.readPortA(time);
          if (low === PORT_8255_PORT_B) return self.printer.readPortB(time);
          if (low === PORT_8255_PORT_C) return self.printer.readPortC(time);
          const mouseValue = self.mouse.readPort(port);
          if (mouseValue !== null) return mouseValue;
          return self.device.edge_in(port, time);
        },
        out(port, value, time) {
          self.device.edge_out(port, value, time);
          const low = port & 0xff;
          if (low === PORT_DATA) self.controller.writeData(value);
          else if (low === PORT_OPERATION) self.controller.writeOperation(value);
          else if (low === PORT_8255_PORT_A) self.printer.writePortA(value, time);
          else if (low === PORT_8255_PORT_B) self.printer.writePortB(value, time);
          else if (low === PORT_8255_PORT_C) self.printer.writePortC(value, time);
          else if (low === PORT_8255_CONTROL) self.printer.writeControl(value, time);
          else if (low === PORT_8255_DISABLE || low === PORT_8255_ENABLE) {
            // MDOS uses these writes to isolate the optional 8255 path. The BT-100 tab keeps
            // the PPI logically attached so BT-100 software can drive it directly through
            // ports 1Fh/3Fh/5Fh/7Fh.
          }
        }
      };
    }

    install() {
      global.qaop.plug(this.device, 1);
      this.scheduleNotify();
    }

    pageIn() {
      if (this.paged) return false;
      this.paged = true;
      this.device.rom = this.memory;
      this.scheduleNotify();
      return true;
    }

    pageOut() {
      if (!this.paged) return false;
      this.paged = false;
      this.device.rom = null;
      this.scheduleNotify();
      return true;
    }

    snap() {
      this.pageIn();
      this.runtime.rebuildBusHandlers();
      this.runtime.cpuCore.nmi();
      this.scheduleNotify();
    }

    getMachineProfile(id = this.currentMachineId) {
      const profile = this.machineProfiles[id];
      if (!profile) throw new RangeError(`Unknown machine profile: ${id}`);
      return profile;
    }

    isMelodikAvailable(profile = this.getMachineProfile()) {
      return !profile.builtInAy;
    }

    isAyEnabled(profile = this.getMachineProfile()) {
      return !!profile.builtInAy || (this.melodikEnabled && this.isMelodikAvailable(profile));
    }

    setMelodikEnabled(enabled) {
      this.melodikEnabled = !!enabled;
      const profile = this.getMachineProfile();
      global.qaop.set({ ay: this.isAyEnabled(profile) });
      this.scheduleNotify();
      return {
        available: this.isMelodikAvailable(profile),
        enabled: this.melodikEnabled && this.isMelodikAvailable(profile),
        requested: this.melodikEnabled,
        builtInAy: !!profile.builtInAy,
        ayEnabled: this.isAyEnabled(profile)
      };
    }

    setKempstonMouseEnabled(enabled) {
      return this.mouse.setEnabled(enabled);
    }

    moveKempstonMouse(deltaX, deltaY) {
      return this.mouse.move(deltaX, deltaY);
    }

    setKempstonMouseButton(button, pressed) {
      return this.mouse.setButton(button, pressed);
    }

    releaseKempstonMouseButtons() {
      return this.mouse.releaseButtons();
    }

    setPrinterSpeedFactor(value) {
      return this.printer.setSpeedFactor(value);
    }

    setPrinterNotchSize(value) {
      return this.printer.setNotchSize(value);
    }

    setPrinterCarbonColor(color) {
      return this.printer.setCarbonColor(color);
    }

    setPrinterConnectionProfile(id) {
      return this.printer.setConnectionProfile(id);
    }

    advancePrinterPaper(dx = 0, dy = 0) {
      return this.printer.shiftPaper(dx, dy);
    }

    newPrinterPage() {
      return this.printer.newPage();
    }

    resetPrinterHead() {
      return this.printer.resetHead();
    }

    async setMachine(id, options = {}) {
      const profile = this.getMachineProfile(id);
      this.pageOut();
      this.printer.setFrameCycles(profile.frameCycles);
      this.runtime.setMachineMemoryProfile(profile.memoryProfile, 0);
      const rom = profile.bundledRom ? this.machineRoms[profile.bundledRom] : null;
      if (profile.bundledRom && !rom) throw new Error(`ROM asset '${profile.bundledRom}' is not loaded.`);
      global.qaop.set({
        model: profile.qaopModel,
        rom,
        ay: this.isAyEnabled(profile),
        kj: false,
        if1: false
      });
      this.currentMachineId = profile.id;
      if (options.reset !== false) this.powerCycle();
      else this.scheduleNotify();
      return profile;
    }

    powerCycle() {
      this.memory.fill(0, 0x3800, 0x4000);
      this.controller.powerReset();
      this.printer.resetHead();
      this.mouse.releaseButtons();
      this.pageOut();
      this.runtime.rebuildBusHandlers();
      this.runtime.resetMachine();
    }

    insert(index, bytes, options = {}) {
      const drive = this.drives[index];
      if (!drive) throw new RangeError('Drive index must be 0 or 1.');
      drive.disk = new DiskImage(bytes, options);
      drive.currentTrack = 0;
      this.scheduleNotify();
      return drive.disk;
    }

    eject(index) {
      const drive = this.drives[index];
      if (!drive) return null;
      const disk = drive.disk;
      drive.disk = null;
      drive.currentTrack = 0;
      this.scheduleNotify();
      return disk;
    }

    createBlank(index, tracks, sectorsPerTrack = 9) {
      const extension = tracks <= 40 ? 'd40' : 'd80';
      const bytes = new Uint8Array(tracks * 2 * sectorsPerTrack * SECTOR_SIZE);
      return this.insert(index, bytes, {
        fileName: `blank-${tracks}t-${sectorsPerTrack}s.${extension}`,
        tracks,
        sectorsPerTrack
      });
    }

    setWriteProtected(index, value) {
      const disk = this.drives[index]?.disk;
      if (disk) disk.writeProtected = !!value;
      this.scheduleNotify();
    }

    onChange(listener) {
      this.listeners.add(listener);
      listener(this.getStatus());
      return () => this.listeners.delete(listener);
    }

    scheduleNotify() {
      if (this.notifyPending) return;
      this.notifyPending = true;
      requestAnimationFrame(() => {
        this.notifyPending = false;
        const status = this.getStatus();
        for (const listener of this.listeners) listener(status);
      });
    }

    isInitialized() {
      const start = 0x3eef;
      for (let address = start; address < start + 8; address += 1) {
        if (this.memory[address] !== ((address >> 8) ^ (address & 0xff))) return false;
      }
      return true;
    }

    getStatus() {
      const profile = this.getMachineProfile();
      const bankState = this.runtime.getMachineBankState?.() || { profile: profile.memoryProfile, bank: null };
      const melodikAvailable = this.isMelodikAvailable(profile);
      return {
        machine: {
          ...profile,
          bank: bankState.bank,
          upperPages: bankState.upperPages
        },
        sound: {
          melodikAvailable,
          melodikEnabled: melodikAvailable && this.melodikEnabled,
          melodikRequested: this.melodikEnabled,
          builtInAy: !!profile.builtInAy,
          ayEnabled: this.isAyEnabled(profile)
        },
        printer: this.printer.getStatus(),
        mouse: this.mouse.getStatus(),
        paged: this.paged,
        initialized: this.isInitialized(),
        selectedDrive: this.controller.selectedDrive,
        controllerPhase: this.controller.phase,
        operationRegister: this.controller.operationRegister,
        drives: this.drives.map(drive => ({
          index: drive.index,
          currentTrack: drive.currentTrack,
          motor: drive.motor,
          led: drive.led,
          ready: drive.ready,
          disk: drive.disk ? {
            fileName: drive.disk.fileName,
            volumeName: drive.disk.volumeName,
            writeProtected: drive.disk.writeProtected,
            dirty: drive.disk.dirty,
            byteLength: drive.disk.bytes.length,
            geometry: { ...drive.disk.geometry }
          } : null
        }))
      };
    }
  }

  global.DidaktikD80Internals = Object.freeze({
    DiskImage,
    Drive,
    UPD765Subset,
    DidaktikD80,
    BT100Printer: global.BT100Printer,
    KempstonMouse,
    MACHINE_PROFILES,
    inferGeometry
  });

  async function waitForQaop() {
    while (!(global.qaop && global.__qaop?.cpuCore && global.__qaop?.rebuildBusHandlers)) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return global.__qaop;
  }

  global.createDidaktikD80 = async function createDidaktikD80(options = {}) {
    const runtime = await waitForQaop();
    const romRequests = {
      gama: fetch(options.gamaRomUrl || options.baseRomUrl || 'roms/didaktik-gama-1989.rom'),
      m: fetch(options.didaktikMRomUrl || 'roms/didaktik-m-1992.rom'),
      kompakt: fetch(options.kompaktRomUrl || 'roms/didaktik-kompakt-1993.rom'),
      mdos: fetch(options.mdosRomUrl || 'roms/mdos-2.93.rom')
    };
    const responses = Object.fromEntries(await Promise.all(
      Object.entries(romRequests).map(async ([name, request]) => [name, await request])
    ));
    const failed = Object.entries(responses).filter(([, response]) => !response.ok).map(([name]) => name);
    if (failed.length) throw new Error(`Unable to load ROM assets: ${failed.join(', ')}.`);

    const machineRoms = {};
    for (const name of ['gama', 'm', 'kompakt']) {
      machineRoms[name] = new Uint8Array(await responses[name].arrayBuffer());
      if (machineRoms[name].length !== 0x4000) {
        throw new Error(`${name} ROM must be 16384 bytes, got ${machineRoms[name].length}.`);
      }
    }
    const mdosRom = new Uint8Array(await responses.mdos.arrayBuffer());
    if (mdosRom.length !== 0x3800) throw new Error(`MDOS ROM must be 14336 bytes, got ${mdosRom.length}.`);

    const initialMachine = options.machineId && MACHINE_PROFILES[options.machineId] ? options.machineId : 'didaktik80';
    const emulator = new DidaktikD80(runtime, mdosRom, {
      machineRoms,
      machineId: initialMachine,
      melodikEnabled: !!options.melodikEnabled
    });
    emulator.install();
    await emulator.setMachine(initialMachine, { reset: false });

    const preload = async (index, url) => {
      if (!url) return;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load disk image: ${url}`);
      const fileName = url.split('/').pop() || `drive-${index}.d80`;
      emulator.insert(index, new Uint8Array(await response.arrayBuffer()), { fileName });
    };
    await Promise.all([preload(0, options.driveAUrl), preload(1, options.driveBUrl)]);

    runtime.resetMachine();
    global.didaktikD80 = emulator;
    return emulator;
  };
})(window);
