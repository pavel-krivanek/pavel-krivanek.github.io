# Didaktik machine and D40/D80 emulation notes

## 1. Machine profiles

The emulator exposes five profiles while keeping one QAOP CPU/video/runtime core and one D40/D80 subsystem:

| Profile | Main memory model | Computer ROM | Sound |
|---|---|---|---|
| Didaktik 80K | fixed 16 KiB lower RAM plus two 32 KiB upper banks | supplied Didaktik Gama 1989 ROM | beeper; optional Melodik AY |
| Didaktik M | linear 48 KiB | supplied Didaktik M 1992 ROM | beeper; optional Melodik AY |
| Didaktik Kompakt | linear 48 KiB, D80 attached | supplied Didaktik Kompakt 1993 ROM | beeper; optional Melodik AY |
| ZX Spectrum 48K | linear 48 KiB | QAOP Spectrum 48K ROM | beeper; optional Melodik AY |
| ZX Spectrum 128K | eight 16 KiB pages and two ROMs | QAOP Spectrum 128K ROM set | beeper + built-in AY |

The three Didaktik profiles use their supplied model-specific ROM images. Didaktik M and Kompakt retain QAOP's 48K video timing because the present work changes ROM and memory mapping, not the underlying ULA model. Their ROM execution is exact at the byte level; model-specific timing and peripheral differences beyond D80 remain outside scope.

Changing profile performs a cold reset of the computer and D80 interface RAM. Disk objects are not recreated, so inserted media, dirty bytes and write-protection state survive the change. The UI stores the selected profile in `localStorage`.

Bundled computer ROMs:

```text
Didaktik Gama 1989
  size:   16384 bytes (4000h)
  SHA256: dac528146fa9161cff21517a6f70c67829c87f1212d87850b8368784d04936f0

Didaktik M 1992
  size:   16384 bytes (4000h)
  SHA256: b4fd4460f77216e1972814b20be96b2b92bc79b774c3a0d6cc357f93797925d7

Didaktik Kompakt 1993
  size:   16384 bytes (4000h)
  SHA256: e25291e6f13379f79f0179b124f09b257c72f695416a3f984cc79cbac040b178
```

The M and Kompakt images differ at 22 byte positions. Their embedded startup identification strings name the 1992 Didaktik M and 1993 Didaktik Kompakt releases, which also gives the browser test a model-specific ROM signature independent of the UI selection.

## 2. Didaktik 80K/Gama memory architecture

The original Didaktik documentation describes 80 KiB of RAM as a fixed Spectrum-compatible lower 16 KiB region plus two alternative 32 KiB regions. The resulting CPU address map is:

```text
0000h-3FFFh  16 KiB ROM
4000h-7FFFh  fixed 16 KiB screen/system RAM
8000h-BFFFh  first half of selected 32 KiB bank
C000h-FFFFh  second half of selected 32 KiB bank
```

The upper area is switched as a complete 32 KiB unit:

```text
OUT 127,0    select bank 0
OUT 127,1    select bank 1
```

Only bit 0 of the output value is used by the mapper. The implementation decodes the low I/O-port byte `7Fh`, matching Z80 programs that use either `OUT (n),A` or a full 16-bit port address whose low byte is `7Fh`.

Internally, QAOP already allocates eight 16 KiB RAM arrays for its 128K model. The Gama profile reuses four of those arrays without copying memory:

```text
4000h-7FFFh  page 5, fixed
bank 0:
  8000h-BFFFh  page 2
  C000h-FFFFh  page 0
bank 1:
  8000h-BFFFh  page 1
  C000h-FFFFh  page 3
```

The page numbers are internal storage choices, not externally visible Gama page numbers. The important invariant is that both 16 KiB halves change atomically while `4000h-7FFFh` remains the same object.

The switching logic lives in QAOP's bus-output handler. Consequently it affects:

- normal Z80 instruction fetches and data accesses;
- debugger/raw memory reads and writes;
- snapshots and restored states;
- D80 NMI/SNAP code when it accesses main RAM;
- any program that switches banks directly rather than through ROM routines.

RESET and power cycle select bank 0. Serialized QAOP states include both `memoryProfile` and `didaktikBank`; restoring a state rebuilds the bus mappings before execution resumes. The UI status badge polls the same mapper state and displays the active 32 KiB bank.

## 3. ZX Spectrum memory models

### 48K, Didaktik M and Didaktik Kompakt profiles

These profiles expose the ordinary linear layout:

```text
0000h-3FFFh  ROM
4000h-7FFFh  RAM
8000h-BFFFh  RAM
C000h-FFFFh  RAM
```

There is no computer-side RAM paging. The D80 interface can still temporarily replace `0000h-3FFFh` through its own M1-controlled external-ROM window.

### ZX Spectrum 128K

The 128K selector returns QAOP to its native Spectrum 128 model. It retains the standard `7FFDh` paging register, eight 16 KiB RAM pages, selectable ROM, selectable display bank and paging-disable latch. The UI reports the RAM page currently mapped at `C000h-FFFFh`.

The Didaktik `7Fh` handler is active only in the `didaktik80` memory profile, so it cannot interfere with 48K or 128K operation.

## 4. Melodik AY interface

The optional Melodik peripheral is available on Didaktik 80K, Didaktik M, Didaktik Kompakt and ZX Spectrum 48K. The 128K profile does not expose an external-Melodik option because its AY-3-8912 is already part of the base machine.

Melodik is software-compatible with the Spectrum 128K AY connection:

```text
FFFDh  output: select register 0-15
FFFDh  input:  read the selected register
BFFDh  output: write the selected register
```

No separate sound-chip implementation was added. QAOP already contains an AY/YM-compatible synthesizer, register file, envelope/noise/tone generation and audio mixing. The standalone emulator enables or removes that existing device by applying the QAOP `ay` machine-state field. This keeps the same I/O decoding, timing path and audio mixer used by QAOP's native Spectrum 128K profile.

The UI stores a persistent Melodik preference independently from the selected computer. Consequently:

- switching among the four non-128K profiles keeps Melodik attached;
- switching to Spectrum 128K hides the external device but retains the preference;
- switching back restores Melodik automatically;
- disabling Melodik on a non-128K profile removes AY state immediately without resetting RAM or the D80 subsystem;
- Spectrum 128K always keeps AY active even when the stored Melodik preference is false.

The status model distinguishes `melodikRequested`, `melodikEnabled`, `builtInAy` and effective `ayEnabled`; this prevents the disabled 128K checkbox from being mistaken for disabled AY sound.

## 5. Kempston mouse interface

The Kempston mouse is implemented as another device in QAOP's chained I/O bus. It is independent of QAOP's optional Kempston joystick state and does not modify keyboard or joystick handling. The standalone UI leaves it disabled at startup.

The interface follows the original partial address decoding rather than matching only three exact 16-bit values:

```text
FADFh  buttons   decode mask 0120h
FBDFh  X counter decode mask 0520h
FFDFh  Y counter decode mask 0520h
```

The button register idles at `FFh`. Pressed buttons clear their bits: D0 is right, D1 left and D2 middle. The X and Y registers are free-running 8-bit counters and therefore wrap at both ends. DOM `movementX` increments X. DOM `movementY` is subtracted from Y because browser coordinates increase downward, while classic Kempston drivers conventionally invert the raw Y counter when mapping it to screen coordinates.

Pointer lock is a UI concern only. With the interface enabled, a trusted click on the emulator screen requests pointer lock; movement and button events are intercepted before QAOP's normal pointer handlers. **Esc** calls `exitPointerLock`, releases all emulated buttons and restores the normal screen cursor. Disabling the interface performs the same cleanup.

Sensitivity is applied before deltas reach the device. The UI keeps fractional X/Y remainders, so a 25% setting converts four one-pixel host movements into one counter step instead of dropping all four. The sensitivity setting is persistent; the enable state intentionally is not.

## 6. Emulated disk-hardware generation

The original Didaktik D40 described in the manual uses a WD2797 controller, a 16 KiB EPROM of which 14 KiB is occupied, and 2 KiB of interface RAM. Later D80/Didaktik Kompakt hardware changed the controller, and MDOS 2.x rewrote the low-level disk routines for it.

The supplied `mdos-2.93.rom` is from that later generation. Its bytes match the supplied `mdos20.lst` machine-code listing, and the listing uses a uPD765/WD37C65-style command protocol. Consequently, emulating only the original WD2797 register set would not run this ROM correctly.

Bundled MDOS ROM:

```text
size:   14336 bytes (3800h)
SHA256: a701402806c401762eb9ade4b32fbd0dc8eb1a7c6ee45199805a455f905ddd93
```

## 7. D80 interface memory and paging

The external 16 KiB window is arranged as:

```text
0000h-37FFh  MDOS ROM, 14 KiB
3800h-3FFFh  interface RAM, 2 KiB
```

The interface pages in on an M1 instruction fetch at `0000h` or `0008h`, and pages out on an M1 fetch at `1700h`. Paging is attached to instruction fetches rather than ordinary memory reads, matching the address/instruction decoder described for the hardware.

QAOP normally treats a plug-in low-memory page as wholly read-only. The copied QAOP core therefore has one contained extension: a plug-in byte array may declare `qaopWriteStart`. The D80 page sets it to `3800h`, preserving ROM write protection below that address while allowing both CPU writes and debugger-style raw writes in the 2 KiB interface RAM.

The D80 plug-in is layered after computer-memory selection. It temporarily replaces only `0000h-3FFFh`; it does not alter the selected Gama upper bank or Spectrum 128 RAM page. Paging the interface out reveals whichever computer ROM belongs to the current profile.

## 8. RESET and SNAP entry

At reset, the first instruction fetch at address zero selects the MDOS window. A cold start tests and clears the interface RAM, writes a private system marker, initializes both drives, and then returns to the computer ROM through the page-out address.

The physical SNAP switch drives NMI. The emulation therefore:

1. pages in the D80 memory window;
2. rebuilds QAOP's memory bus handlers;
3. requests a Z80 NMI.

The real MDOS NMI routine saves the registers, constructs a name from `SNAPSHOT00` through `SNAPSHOT99`, writes a `C080h`-byte snapshot file through the normal disk routines, restores the machine state, pages out the interface, and resumes the interrupted program.

The UI does not permit SNAP during reset initialization. This is important because the computer ROM temporarily uses startup stack and register states that are not representative of a running machine.

## 9. I/O ports used by MDOS 2.93

The later ROM uses the low eight bits of the following Z80 I/O addresses:

```text
83h  controller main-status register
87h  controller command/data register
8Fh  operation and drive-control register
97h  disable/isolate optional 8255 path
99h  enable/isolate optional 8255 path
```

The operation register behavior used by the ROM is modeled as:

```text
bit 0   selected drive, 0=A and 1=B
bit 2   controller reset, active low
bit 4   drive A motor
bit 5   drive B motor
```

The optional 8255 path is now modeled as a simple PPI at:

```text
1Fh  8255 port A
3Fh  8255 port B
5Fh  8255 port C
7Fh  8255 control register
```

The BT-100 tab uses that interface directly. The bundled `BT1`/`BT2` software configures the PPI with control word `90h`, which matches the observed traffic: port A is read as printer status and port B is written as printer control. The `97h`/`99h` isolation writes are still accepted because MDOS issues them during setup and shutdown, but the browser BT-100 model keeps the PPI logically attached so the printer programs can talk to it without extra switching.

### BT-100 connection profiles

The preserved DESKTOP installer contains five BT-100 connection records. Its reconstructed profile sources identify the exact status port, control port, status masks, command bytes and 8255 initializer for each connection:

```text
profile  status       control      initializer
A,B      A upper      B lower      90h
C,B      C upper      B lower      98h
C-1      C upper      C lower      9Ah
C-2      C upper      C lower      9Ah
C-3      C lower      C upper      93h
```

`C-1` and `C-2` use the same half-port directions but different bit assignments. The TextMachine and ScreenMachine manuals identify the UR-4 wiring with the `C-2` assignment:

```text
PC0  needle output       PC4  paper encoder input
PC1  carriage output     PC5  home detector input
PC2  paper-motor output  PC6  coarse marker input
PC3  carriage output     PC7  fine encoder input
```

The complete emulated profiles are:

```text
A,B:   PA4 paper, PA5 fine, PA6 coarse, PA7 home
       PB0 paper, PB1 needle, PB2/PB3 carriage

C,B:   PC4 paper, PC5 fine, PC6 coarse, PC7 home
       PB0 paper, PB1 needle, PB2/PB3 carriage

C-1:   PC4 paper, PC5 fine, PC6 coarse, PC7 home
       PC0 paper, PC1 needle, PC2/PC3 carriage

C-2:   PC4 paper, PC5 home, PC6 coarse, PC7 fine
       PC0 needle, PC1/PC3 carriage, PC2 paper

C-3:   PC0 fine, PC1 paper, PC2 coarse, PC3 home
       PC4 paper, PC5/PC6 carriage, PC7 needle
```

For a shared port-C profile, a read combines the latched output half with live sensor bits on the input half. Writes affect only the selected profile's logical control signals. The UI stores the profile independently from the printed page and defaults to `A,B`; changing it stops both motors and resets the interface latch without clearing the page or moving the head.

The printer mechanism stores each strike at a mechanical raster coordinate plus normalized random samples. Dot darkness, per-dot darkness variability, diameter, bidirectional notch registration, positional offset and shape are applied only by the page renderer. Changing one of these controls invalidates and redraws the whole retained page, so existing marks update immediately without altering the emulated 8255 traffic or carriage timing. `100%` dot size means a diameter equal to one nominal raster pitch. The current defaults are 75% darkness, 33% darkness variability, 185% dot size, 20% notch size and ±11% random positional offset, with randomized dot shapes enabled.


### BT-100 V1.1 handshake and end-of-line regression

The printer model is implemented as the standalone classic-script module `bt100-printer.js`. It exports `window.BT100Printer`; the D80 module constructs it and maps its PPI methods to the Didaktik bus. This keeps printer mechanics independent of the disk controller and machine-memory implementation.

The supplied `bt1.B` driver polls the four upper bits of 8255 port A:

```text
PA4  paper-feed encoder pulse
PA5  fine carriage encoder: 480 periods across the printable width
PA6  deeper-notch marker, asserted every twentieth carriage position
PA7  left-end/start-of-line detector
```

Port B drives the motors and needle. The important states used by V1.1 are `05h` toward home, `09h` away from home, `0Dh` motor stop, and bit 1 as the needle pulse. The driver routine at `FD45h` waits for PA5 to become high and then low for each fine position.

The first BT-100 implementation generated a synthetic ready pulse and clamped the carriage at printable column 479. Under an accelerated setting, V1.1 could miss an optical level and eventually reach the clamp with PA5 permanently high. `LPRINT` then remained in the second half of the `FD45h` loop.

The corrected model uses continuous carriage motion, a finite-width PA5 encoder pulse, a finite PA6 marker pulse at every twentieth notch, PA7 home sensing, and non-printing run-out beyond position 480. Accelerated motion has a minimum 8,192-cycle fine-pulse period, long enough for the original polling loops to observe both levels. A browser regression test extracts the real `bt1.B` from the mounted image, initializes it at `FA00h`, sends `I` plus carriage return through its stream routine, and requires the driver to return with the head home and motors stopped.

### BT-BCS C-2 return-to-origin regression

The supplied BT-BCS program selects the C-2 wiring with 8255 mode `9Ah`: PC7 is the fine carriage encoder, PC6 the coarse marker, PC5 home, and PC4 paper. Its `K - skuska kolmosti` BASIC command calls `USR 32778`; the entry fills the print buffer with `I` characters and enters the normal bidirectional raster path.

On the return side, the machine-code synchronizer at `82B8h..82D7h` reads port `5Fh`, waits for PC7 to become low, then waits for PC7 to become high again. This is a complete optical encoder cycle, not merely a home-switch test. In the earlier model, carriage motion was clamped at logical `x=0`. Position zero is inside the asserted portion of the fine pulse, so PC7 could never fall and the loop at `82B8h` ran forever.

The carriage now has the same one-pitch non-printing run-out at the left edge as at the right edge. The final C-2 cycle can pass through PC7 low and back to high before the carriage is stopped. PC5 home remains asserted throughout this short run-out, while the public/UI head position is clamped to zero. A unit regression reproduces the exact C-2 edge sequence, and a focused Chromium regression executes the corresponding Z80 `IN/AND/JR` loop through the real peripheral bus.

A separate registration defect became clear with `LPRINT "I"`. At authentic speed, the real driver fired the two stem dots at approximately `4.476/5.476` while moving away from home and `5.944/6.944` while returning. The latter are raw encoder interval numbers, not final page columns: on the reverse scan, interval `N` corresponds to visual column `N-1`. Rendering raw head positions, then adding a synthetic ±0.22 offset, produced a repeatable displacement of about 1.03 dot pitches between alternate rows. The correction maps reverse-scan strikes to `headPosition - 1` and removes the second synthetic edge bias. The remaining difference is about 0.47 pitch, arising naturally from the finite PA5 pulse and the driver's instruction timing. The regression test verifies the six-dot/two-dot/two-dot/two-dot/two-dot/six-dot raster structure, one-pitch spacing within each row, and a 0.35–0.65-pitch offset—not a whole-column jump—between opposite-direction rows.

A second defect affected raster quality rather than termination. QAOP passes the current cycle position within a video frame to peripheral I/O handlers; at the next frame the value wraps backwards by 69,888 cycles on the 48K-derived profiles. Treating that wrap as a printer-clock reset discarded the motion between the last access of one frame and the first access of the next. When the boundary fell after an encoder edge but before the needle pulse, the strike was placed early and a glyph row could appear torn. The printer now maintains a frame epoch (69,888 cycles for 48K profiles, 70,908 for 128K) and integrates carriage and paper motion on an unwrapped cycle clock. A unit test starts the motor late in one frame and verifies the exact travel reported by the first poll in the following frame.

## 10. Controller phases

MDOS waits for exact high-nibble patterns in the main-status register:

```text
80h  idle; command byte may be written
90h  command parameters may be written
B0h  execution phase; CPU writes sector or format data
D0h  result phase; CPU reads result bytes
F0h  execution phase; CPU reads sector data
```

Unknown commands return the uPD765 invalid-command result `80h`.

## 11. Implemented commands

```text
03h  SPECIFY
04h  SENSE DRIVE STATUS
05h  WRITE DATA       (the ROM sends command byte 45h with MFM flag)
06h  READ DATA        (the ROM sends command byte 46h with MFM flag)
07h  RECALIBRATE
08h  SENSE INTERRUPT STATUS
0Ah  READ ID          (the ROM sends command byte 4Ah with MFM flag)
0Dh  FORMAT TRACK     (the ROM sends command byte 4Dh with MFM flag)
0Fh  SEEK
```

READ and WRITE use the ROM's normal parameter sequence:

```text
unit/head, C, H, R, N=2, EOT=R, GPL=10, DTL=255
```

Thus each command transfers one 512-byte sector.

### Successful single-sector result

The superficially surprising success result is essential:

```text
ST0 = 40h  IC=01, abnormal termination
ST1 = 80h  EN=1, end of cylinder
ST2 = 00h
C, H, R, N follow
```

Because MDOS sets EOT equal to the requested sector number, a real uPD765 finishes the single-sector command at end-of-cylinder. The MDOS 2.93 `CODERR` routine explicitly requires the `ST0=40h` class together with `ST1.EN=1`; returning `ST0=00h` is treated as error 59, `Internal error`.

## 12. Drive model

Two drive instances are present throughout the machine lifetime. Each stores:

- inserted image or empty state;
- 80-track physical head position;
- motor and activity state;
- ready and write-protect status.

SEEK and RECALIBRATE queue the two-byte result consumed later by SENSE INTERRUPT STATUS. SENSE DRIVE STATUS reports unit, head, track-zero, ready and write-protect flags. Both drives can be selected by MDOS and can be used simultaneously for operations such as `MOVE`.

A D40 image can be used in the 80-track mechanism. MDOS itself decides when double stepping is required; the controller keeps physical seek position separate from the C/H/R identifier used to locate a sector in the raw image.

## 13. Raw image mapping

Images are flat sector dumps. For ordinary 40/80-track, two-sided media:

```text
offset = ((cylinder * sides + head) * sectorsPerTrack + sector - 1) * 512
```

Geometry is taken first from an MDOS boot sector carrying the `SDOS` signature. If no signature is present, common image lengths are recognized, including 40 or 80 tracks and 9 or 10 sectors per track.

The supplied image has:

```text
80 cylinders
2 sides
9 sectors per track
512 bytes per sector
737280 bytes total
volume name: NoNameDisk
```

## 14. MDOS filesystem facts relevant to emulation

The controller does not interpret files, but these details explain the access patterns produced by the ROM:

- standard media use 40 or 80 tracks, two sides, 9 sectors per track and 512-byte sectors;
- boot-sector bytes `192-201` contain the ten-character volume name;
- bytes `204-207` contain `SDOS`;
- byte `177` contains double-step and double-sided flags;
- bytes `178` and `179` contain tracks per side and sectors per track;
- allocation uses 12-bit FAT entries;
- directory sectors are logical sectors 7 through 14;
- each directory entry is 32 bytes, giving 128 entries.

New images made by the UI are intentionally zero-filled and unformatted. The real MDOS `FORMAT` command creates the boot sector, FAT, directory and data-area markers through FORMAT TRACK and WRITE DATA commands.

## 15. Image browser and extraction

The **Image files** tab is a read-only filesystem view over the currently mounted byte array. It does not bypass the controller for machine operations and does not modify the image. Its parser uses the MDOS on-disk structures directly:

- raw sectors `1-5` contain five FAT sectors;
- raw sectors `6-13` contain the 128-entry directory;
- each directory entry stores a ten-character name, a one-character MDOS type, length, start/autostart information, FAT start sector and attributes;
- FAT packing restarts in every 512-byte FAT sector, with 341 twelve-bit entries per sector and the high-nibble break marker at the end.

The byte layout of each two-entry FAT group differs in nibble placement from PC-compatible FAT12:

```text
entry 2n     = byte0 + high_nibble(byte1) * 256
entry 2n + 1 = byte2 + low_nibble(byte1)  * 256
```

Extraction follows the chain until the number of sectors implied by the directory length has been collected. The directory length is authoritative for the last partial sector. Out-of-range links, loops, reserved/bad-sector values and prematurely terminated chains disable extraction and are shown as errors. A catalog cache is keyed by the image revision and is invalidated after every controller write or format operation, so files created by MDOS or SNAP appear without remounting the image.

Drag-and-drop uses the same insertion path, validation and dirty-image confirmation as the hidden file inputs. One file is mounted in the drop target; a second dropped file is mounted in the other mechanism.

## 16. Deliberate limits

The current disk model is command- and sector-accurate for ordinary MDOS images. It does not model:

- index pulses or rotational latency;
- real head-settle and motor-spin-up timing;
- CRC generation, CRC injection or missing address marks;
- deleted-data marks and weak or deliberately malformed sectors;
- arbitrary sector sizes beyond the ROM's 512-byte path;
- analogue flux behavior;

Machine-profile limits are:

- Didaktik M and Kompakt use their supplied ROMs, but retain QAOP's Spectrum 48K video timing model;
- model-specific keyboard matrices, joystick connectors and peripheral ports beyond the D80 and Melodik AY are not distinguished;
- the Didaktik 80K implementation targets the documented memory topology and bank port, while video timing remains QAOP's 48K timing model.

These omissions do not replace MDOS filesystem logic. The supplied ROM still performs command construction, controller polling, FAT traversal, directory handling, file allocation, formatting and SNAP creation.

### Host keyboard physical-position mapping

QAOP's keyboard table expects the conventional PC key codes associated with a US QWERTY arrangement. Browser `KeyboardEvent.key` is unsuitable for this purpose because it describes the character generated by the active host layout. On Czech QWERTZ, for example, the physical Spectrum Y position generates the character `z`.

The standalone core now derives the table index primarily from `KeyboardEvent.code`, which identifies the physical key independently of the selected operating-system layout. `KeyY` therefore always drives Spectrum Y and `KeyZ` always drives Spectrum Z. This deliberately means that a Czech keycap labelled Z types Y in the emulator, matching the real Spectrum keyboard position. The same policy naturally handles AZERTY and other rearranged alphabetic layouts.

Physical mappings are explicit for A-Z, the digit row, common punctuation, arrows, modifiers, editing keys and F1-F12. Legacy `which`/`keyCode` values remain only as a compatibility fallback when `KeyboardEvent.code` is absent. Key-down and key-up pass through the same function, so modifier changes or national-layout character differences cannot leave a matrix key held.

On-screen keys and paste-driven text injection bypass browser keyboard events and remain character-oriented.

## 17. Verification coverage

`tests/controller.test.js` covers:

- SDOS geometry and sector mapping;
- directory decoding, FAT-chain traversal, cache invalidation and exact file extraction;
- READ DATA phase and the MDOS-specific completion result;
- WRITE DATA and write protection;
- two-drive selection;
- SEEK, RECALIBRATE and SENSE INTERRUPT STATUS;
- FORMAT TRACK and its normal completion status;
- D40 logical-cylinder access with an 80-track physical double-step position;
- controller power reset;
- disabled-bus behavior, partial Kempston port decoding, counter wrapping, Y direction and active-low three-button mapping.

`tests/keyboard-layout.test.js` verifies physical QWERTZ and AZERTY letter positions, national number/punctuation rows, control keys, function keys and legacy fallback. `tests/keyboard-browser.test.py` drives the same positions through the complete QAOP browser handler in Chromium and checks clean release.

The optional browser smoke test additionally:

- drives synthetic Czech-QWERTZ `KeyY` and `KeyZ` events through the complete QAOP key handler, verifies Spectrum Y and Z physical positions respectively, and confirms both keys release cleanly;
- boots the supplied Didaktik Gama, Didaktik M, Didaktik Kompakt and MDOS ROMs;
- writes different values into both halves of both Gama upper banks and verifies them after `OUT 127,n` switching;
- confirms that fixed RAM at `4000h` does not change with the upper bank;
- confirms RESET selects Gama bank 0;
- switches through all five profiles, verifies the active QAOP memory model, and compares each Didaktik system-ROM signature with its bundled image;
- confirms drive A remains mounted across machine changes;
- attaches Melodik on a 48K-derived profile, writes and reads AY register 0 through `FFFDh`/`BFFDh`, and checks QAOP serializes active AY state;
- carries the Melodik preference across Didaktik M, Kompakt, Spectrum 48K and Didaktik 80K, while verifying Spectrum 128K disables the external control but retains built-in AY;
- detaches Melodik again and verifies that AY state disappears on the Didaktik profile;
- verifies the mouse starts disabled, enables it from its standalone tab, captures the pointer from a trusted screen click, exercises the three ports and releases capture with Escape;
- opens and selects entries in the image browser;
- mounts a second image through a synthetic browser drag-and-drop event;
- confirms interface RAM writes and MDOS ROM protection;
- presses SNAP, waits for actual disk writes and verifies that execution returns;
- rejects any page or console error.

## 18. Primary references

- Didaktik Gama bank-switching example and `OUT 127,n`: https://z00m.speccy.cz/files/DG-Pripojenie-periferii.pdf
- MDOS disk format: https://cygnus.speccy.cz/popis_mdos-format.php
- Didaktik D40 manual: https://mts.speccy.cz/doc/d40manu.pdf
- ZX Spectrum 128K technical reference: https://worldofspectrum.org/faq/reference/128kreference.htm
- AY-3-8912 and Melodik-compatible port description: https://cygnus.speccy.cz/popis_ay38912.php
- Melodik overview and Spectrum-128-compatible connection: https://cs.wikipedia.org/wiki/Melodik
- Kempston mouse port addresses, partial decode masks and button bit assignment: https://worldofspectrum.org/faq/reference/ports.htm
- Kempston mouse 8-bit wrapping counters and standard button mapping: https://sinclair.wiki.zxnet.co.uk/wiki/Kempston_Mouse
- BT-100 mechanism overview, one slotted wheel per motor and 480 carriage positions: https://dexovo.cz/specifika-socialistickej-tlace.php
- BT-100 overview and approximate 150-dot/s specification: https://pmd85.borik.net/wiki/BT-100
- Reconstructed DESKTOP BT-100 profile sources (`ab`, `cb`, `c1`, `c2`, `c3`): https://github.com/oldcompcz/Desktop/tree/master/src/desktop/editor/output/devices/bt100/profiles
- Supplied `mdos20.lst`, used to identify the exact MDOS 2.x controller protocol and verify the ROM bytes.

## Desktop full-width row termination

The recovered Desktop BT-100 frontend explains the right-edge hang without guesswork. For the A/B connection profile it drives the carriage away from home, waits for one complete `PA5|PA6` synchronization pulse, and then calls `wait_bt100_mask_20_cycle` once for each of the 480 raster bits in the 60-byte row. Each call requires two high samples followed by two low samples.

The previous model clamped the carriage at exactly `480.0`. Encoder phase zero is the high part of PA5, so the 480th pixel wait reached the rightmost position and could never observe the required falling edge. It also drove PA6 as a latched right-edge signal; because Desktop's initial synchronization mask is `60h`, a latched PA6 could make the combined status permanently nonzero.

The carriage now has one non-printing pitch of run-out beyond each logical edge. On the right this lets the pulse beginning at position 480 pass through its trailing edge before the mechanical stop; on the left it lets return-side software complete the encoder cycle crossing position zero. PA6 is a finite pulse coincident with the deeper notch every twentieth position, as indicated by the hardware and by Desktop's status masks; it is never used as a right-limit latch. A source-grounded unit regression executes the exact A/B command sequence, consumes the initial combined pulse and all 480 PA5 cycles, verifies that PA5 and PA6 are low after the final cycle, advances the paper, and stops the printer.

At 1×, the carriage period is derived from the active video-frame length: `frameCycles × 50 × 6 / 480` T-states per encoder position. This makes a complete 480-position pass exactly six emulated seconds on both 48K-derived and 128K profiles. The UI exposes only 1×, 10×, and 100×. Acceleration changes printer mechanics only; the original Z80 driver and its encoder polling remain the practical speed limit.

PNG generation fills the A4 bitmap with the paper colour only. The preview border and shadow are CSS decorations outside the bitmap, and print media removes the preview shadow as well.


## BT-100 print-preview handoff

The browser print action creates a self-contained HTML Blob containing the current borderless A4 canvas, navigates a synchronously opened popup to that Blob URL, and invokes `window.print()` only after the embedded PNG has decoded. The popup is deliberately not opened with the `noopener` feature: Chromium can create the tab yet return a null window handle in that mode, which previously left the user with an empty `about:blank` page. The opener reference is cleared after navigation is scheduled.

### Fullscreen binding robustness

The compact control panel retains a visible `fullscreenButton`, while F11 is handled independently at capture phase. The JavaScript binding is null-safe so an omitted optional button cannot abort emulator startup. `tests/dom-bindings.test.py` checks required fullscreen elements and literal event-listener targets against `index.html`.


### Standalone display filtering

QAOP keeps a 336 × 544 backing canvas for a 336 × 272 logical display. The previous `image-rendering: pixelated` rule preserved the doubled vertical scanline structure while the page scaled it by a non-integer factor, producing conspicuous horizontal striping. The standalone shell now uses normal browser resampling, which combines the row pairs before presentation, and explicitly disables QAOP CRT distortion so settings from another QAOP installation cannot affect this emulator.


## TAP browser and selectable tape head

`tap-browser.js` parses standard TAP framing independently of the ROM loader: each block begins with a little-endian 16-bit byte count, followed by the flag byte, payload and XOR checksum. Standard 19-byte header blocks are decoded and paired with their following data blocks for display.

The QAOP runtime now exposes three narrow tape hooks:

- `getTapeState()` returns the mounted byte stream and current byte offset;
- `setTapeHeadOffset(offset)` cancels any partial fast-load transfer and sets both the current and next block cursors;
- `ejectTape()` aborts pending tape input and clears both active and fallback tape references.

The UI only supplies offsets that came from parsed TAP block boundaries. Selecting a row therefore positions the tape before its two-byte length field, exactly where QAOP's ROM fast-loader expects the next block to begin. The current-row marker follows the loader cursor and shows the end-of-tape state separately.


## Viewport-contained control layout

The desktop shell uses `100dvh` as a fixed workspace height. Its padding is included by `border-box`, the emulator width is calculated from the remaining vertical room after bezel chrome, and the document body has no desktop overflow. The right panel receives `overflow: auto`, so long drive, tape, printer and hex-browser content scrolls without moving the emulator or producing a second page scrollbar. Below 980 pixels the layout returns to normal document flow. The browser integration test checks document height, emulator bounds, internal panel scrolling and minimum control font sizes.
