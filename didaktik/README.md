# Didaktik + D80 + BT-100

A standalone browser emulator for Didaktik and ZX Spectrum machines with MDOS 2.93, two independently emulated D40/D80 disk mechanisms, BT-100 printing and an optional Kempston mouse. It uses the QAOP machine core extracted from the supplied ZX Workbench, but it is a separate page and does not depend on the Workbench application.

The machine selector provides:

- **Didaktik 80K** — the Didaktik Gama memory model, including its two 32 KiB upper-memory banks;
- **Didaktik M** — supplied 1992 Didaktik M ROM with linear 48 KiB RAM;
- **Didaktik Kompakt** — supplied 1993 Kompakt ROM with linear 48 KiB RAM and the integrated D80 subsystem;
- **ZX Spectrum 48K** — standard linear 48 KiB model;
- **ZX Spectrum 128K** — standard eight-page 128 KiB memory model and built-in AY sound.

For the four non-128K profiles, **Melodik (AY)** can be attached or detached while the machine is running. The preference is remembered across machine changes and browser sessions.

The package runs the supplied Didaktik Gama 1989, Didaktik M 1992, Didaktik Kompakt 1993 and MDOS 2.93 ROMs. Disk operations are performed by the real MDOS code through an emulated uPD765-compatible controller, rather than by replacing MDOS with JavaScript filesystem calls.

## Start the page

The ROM and disk assets are loaded with `fetch`, so serve the directory over HTTP:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

MDOS initializes automatically during reset. The **SNAP** button stays unavailable until both MDOS and the selected machine ROM have completed startup.

## Desktop layout

On desktop-sized windows, the emulator remains fixed on the left and the right control panel uses the remaining width. The document itself is constrained to the browser viewport; only the control panel scrolls. Control labels, status values, browser tables and hex dumps use larger, higher-contrast type. The selected computer is shown only by the machine selector.

## Host keyboard mapping

Direct keyboard input follows the **physical ZX Spectrum QWERTY layout**, not the active character layout of the host operating system. The browser's layout-independent `KeyboardEvent.code` identifies each physical key position.

On a Czech or German QWERTZ keyboard, the key labelled **Z** occupies the Spectrum **Y** position and therefore enters **Y**; the key labelled **Y** enters **Z**. The same rule applies to other national layouts such as AZERTY. Number-row and punctuation keys likewise retain their Spectrum physical positions, so Czech `ě`/`Digit2` operates Spectrum **2**.

The same physical identity is used for key-down and key-up, preventing stuck keys. The on-screen keyboard and pasted-text input are unchanged because they already address Spectrum keys directly.

## Machine selection and memory banking

Changing the machine performs a power cycle but keeps both mounted disk images, write-protection settings and unsaved modifications. The selected profile is remembered in browser storage.

### Didaktik 80K

The Didaktik 80K/Gama map is:

```text
0000h-3FFFh  16 KiB ROM
4000h-7FFFh  fixed 16 KiB screen/system RAM
8000h-FFFFh  selected 32 KiB RAM bank 0 or 1
```

`OUT 127,0` selects bank 0 and `OUT 127,1` selects bank 1. The entire upper 32 KiB changes as one unit; the display RAM remains fixed. RESET and power cycle select bank 0. The header badge tracks the active bank while software is running.

The mapper is part of QAOP's memory bus. CPU reads and writes, raw memory inspection, snapshots and MDOS activity therefore all observe the same active bank.

### ZX Spectrum 128K

The 128K profile retains QAOP's normal `7FFDh` paging model: the display page, ROM and the RAM page at `C000h-FFFFh` are selected by the paging register. The header badge displays the active upper RAM page.

### Didaktik M and Kompakt

Both profiles now boot their supplied model-specific 16 KiB ROMs. The M and Kompakt ROMs are related but not identical: their startup identification areas report the 1992 Didaktik M and 1993 Didaktik Kompakt releases respectively. Both use the linear 48 KiB RAM map. Kompakt keeps the D80 interface permanently available as part of the selected machine profile.

Video timing remains QAOP's Spectrum 48K timing model. The change therefore provides exact supplied ROM contents and the correct linear memory topology, but does not claim transistor-level ULA differences or model-specific peripheral ports beyond D80.

## Melodik sound interface

Enable **Melodik (AY)** for Didaktik 80K, Didaktik M, Didaktik Kompakt or ZX Spectrum 48K to attach an AY-3-8912-compatible sound interface. It uses QAOP's existing AY synthesizer and the standard Spectrum 128K-compatible port pair:

```text
FFFDh  select an AY register; read the selected register
BFFDh  write data to the selected AY register
```

The interface can be toggled without resetting the computer. Disabling it removes the AY device and leaves only the normal 1-bit beeper. The selection survives changes among the four compatible machine profiles.

On **ZX Spectrum 128K**, the Melodik control is disabled and unchecked because that profile already contains its own AY-3-8912. AY sound remains active through the built-in device.

## Kempston mouse

Open the **Mouse** tab to attach a standard Kempston mouse interface. The interface is deliberately disabled on every page load. Enabling it does not reset the emulated computer or D80 subsystem.

When enabled, click the emulator screen to enter browser pointer lock. Mouse movement and all three standard buttons are then sent to the emulated interface until **Esc** releases the pointer. Disabling the interface also releases pointer lock and clears any held button state.

The sensitivity slider covers 25% through 300%. Its value is remembered in browser storage, while the enabled state is not. Fractional movement is accumulated so sensitivities below 100% do not discard repeated small movements.

The emulated hardware exposes the standard partially decoded ports:

```text
FADFh  buttons, active low: D0 right, D1 left, D2 middle
FBDFh  8-bit X counter
FFDFh  8-bit Y counter
```

Both counters wrap naturally between 0 and 255. Browser movement to the right increments X; downward browser movement decrements the Kempston Y counter, matching the convention expected by classic Spectrum mouse drivers.

## Disk mechanisms

Drive A starts with `036-KOMPAKT.d80`. Drive B starts empty. Each drive has independent:

- image insertion by file picker or drag-and-drop onto either drive;
- D40/D80 geometry detection;
- current head position, motor and activity state;
- write protection and dirty-state tracking;
- download of the modified image.

**New D40 image** and **New D80 image** create raw, unformatted media. Format them from MDOS before saving files.

You can drop one image directly onto drive A or B. Dropping two images mounts the first one in the target drive and the second one in the other drive. A drop elsewhere on the page uses the first empty drive, or drive A when both are occupied. Unsaved-change confirmation is applied to drag-and-drop in the same way as to the file picker.

## Image file browser

Open the **Image files** tab to inspect either mounted image without asking MDOS to print a catalogue. The browser shows:

- the volume name, file count and free capacity;
- the ten-character MDOS name and one-character file type;
- file length, BASIC autostart line or binary load address, and attributes;
- the first logical sector and resolved FAT chain for the selected file.

The browser understands MDOS's sector-local 12-bit FAT encoding and follows fragmented chains. **Download file** extracts the selected file's exact payload, trimmed to the directory length. Unformatted images and damaged or incomplete chains are reported rather than guessed.


## TAP browser and tape head

Open the **Tape** tab to insert a standard Spectrum `.tap` image. The browser lists every physical TAP block and decodes standard 19-byte headers, including program or CODE type, file name, declared payload length, autostart line or load address, and checksum state.

Click any block row to place the virtual cassette head at the beginning of that block. The next ROM `LOAD`, `VERIFY` or related tape operation starts from that position. **Rewind** returns to block 1, and **Eject** removes the tape. The highlighted row follows the head as ROM loading advances through the image. TAP files may also be dropped onto the page.

The parser and UI are isolated in [`tap-browser.js`](tap-browser.js). Small QAOP runtime hooks expose the currently mounted TAP byte stream and allow block-aligned head positioning without replacing the ROM loading implementation.

## BT-100 printer tab

The BT-100 mechanical and 8255 peripheral model is isolated in [`bt100-printer.js`](bt100-printer.js). `didaktik-d80.js` only wires that device into the common I/O bus. Visual rendering remains in the standalone UI, including carbon colour, darkness, dot diameter, positional jitter and irregular-versus-rounded dot shape.

The new **BT-100** tab emulates the optional Didaktik 8255 parallel path as a dedicated BT-100 printer:

- 8255 ports are exposed at `1Fh`, `3Fh`, `5Fh` and `7Fh`;
- the **Connection** selector covers the five preserved DESKTOP BT-100 profiles (`A,B`, `C,B`, `C-1`, `C-2`, and `C-3`), remembers the selection, and keeps `A,B` as the default;
- the BT-100 handshake follows the real software on the supplied Kompakt disk (`BT1`/`BT2`);
- PA5 reports every carriage-gear notch, PA6 reports the deeper notch at each twentieth position, and PA7 is the left/home detector;
- head motion is bidirectional and the rendered dots include a small left/right positional bias that mimics the notch-width asymmetry of the real carriage encoder;
- a large A4-like page preview is rendered with 480 printable dot columns, visible margins and slightly irregular carbon-paper dots;
- the tab provides paper change, manual head reset, paper shifting, carbon-paper colour selection, speed selection and browser printing / PDF export;
- dot darkness, size and maximum random offset are adjustable and redraw the complete current page immediately;
- dot size is expressed relative to the nominal 480-column pixel pitch (`100%` equals one pitch), and randomized irregular dots are enabled by default but can be replaced with uniform rounded dots.
- **Print / save as PDF** opens a self-contained Blob preview, waits for the A4 image to decode, and then opens the browser print dialog; it no longer leaves an unusable `about:blank` tab.

The five connection choices are wiring profiles rather than different printer mechanisms:

| Profile | Status inputs | Control outputs | 8255 initializer |
|---|---|---|---:|
| **A,B** (default) | port A, upper nibble | port B, lower nibble | `90h` |
| **C,B** | port C, upper nibble | port B, lower nibble | `98h` |
| **C-1** | port C, upper nibble | port C, lower nibble; standard A/B bit order | `9Ah` |
| **C-2 / UR-4** | PC4 paper, PC5 home, PC6 coarse, PC7 fine | PC0 needle, PC1/PC3 carriage, PC2 paper | `9Ah` |
| **C-3** | port C, lower nibble | port C, upper nibble | `93h` |

Changing the profile stops the emulated motors and resets the PPI output latch, but preserves the current paper, dots, head position and visual settings. Software must use a driver built for the selected wiring.

The **1× authentic** setting is calibrated from the selected machine clock so a complete 480-position carriage pass takes six seconds. The selector intentionally offers only **1×**, **10×**, and **100×**. Faster settings shorten only the printer-side mechanical delay; the original Z80 driver and its encoder polling still impose a practical upper limit.

The page bitmap exported as PNG is borderless. The on-screen preview still has a CSS frame and shadow, but those UI decorations are not drawn into the image or the printed/PDF page.

A Spectrum `LLIST` is deliberately not aligned like a direct `LPRINT` string. The ROM formatter reserves a line-number field before each listed BASIC line. Thus a listed `10 PRINT "ahoj"` starts to the right of a later direct `LPRINT "10 PRINT ""ahoj"""`; this is formatter output, not lost encoder pulses.


`LPRINT "I"` is used as the carriage-registration test. Its top and bottom bars contain six adjacent dots, while four middle rows contain a two-dot vertical stem and alternate carriage direction. The raw V1.1 return scan numbers encoder intervals in reverse order: a strike made while travelling toward home in interval `N` belongs to visual microcolumn `N-1`. Earlier builds rendered the raw carriage coordinate and therefore shifted every return raster by almost one complete dot pitch. The standalone printer module now applies this interval-to-column conversion and leaves the finite-notch timing itself untouched. Opposite-direction rows retain an approximately half-pitch physical registration difference, but no whole-column jump.

The printer software waits for both edges of every encoder pulse. Desktop's full-width path performs one initial `PA5|PA6` synchronization cycle and then 480 complete PA5 cycles, one per raster bit. The BT-BCS C-2 alignment test also waits for a complete `PC7` fine-encoder cycle while returning through logical position zero. The emulator therefore preserves a minimum pulse width at accelerated settings and allows one non-printing carriage pitch beyond both raster edges. Clamping at exactly `480.0` hangs Desktop on the final right-side falling edge; clamping at exactly `0.0` leaves PC7 permanently high and hangs BT-BCS on the return to origin. The visible head coordinate remains limited to `0..480` while the internal mechanical coordinate traverses the run-out.

PA6 is not a right-edge latch. The attached Desktop source explicitly waits for a complete `PA5|PA6` pulse, and the printer mechanism reports the deeper gear notch every twentieth position through PA6. The emulation now generates that finite marker pulse while keeping the visual dot registration independent of PA6.

QAOP reports I/O timestamps as cycle positions inside the current video frame. The BT-100 clock unwraps those values into a continuous mechanical timeline. This is necessary even at authentic speed: otherwise a video-frame boundary between an encoder edge and a needle pulse discards part of the carriage travel and can shift an isolated dot or raster row.

## MDOS use

Enter MDOS commands directly at the BASIC prompt, for example:

```text
CAT
CAT "B:"
LOAD *"name"
```

The physical **SNAP** function is emulated. It stops the running program, writes the complete machine state to the active writable disk as `SNAPSHOT00` through `SNAPSHOT99`, and resumes execution. Download the disk image afterward to preserve the newly written snapshot.

## Disk-controller accuracy

Implemented controller commands:

- `03h` SPECIFY
- `04h` SENSE DRIVE STATUS
- `05h` WRITE DATA
- `06h` READ DATA
- `07h` RECALIBRATE
- `08h` SENSE INTERRUPT STATUS
- `0Ah` READ ID
- `0Dh` FORMAT TRACK
- `0Fh` SEEK

The implementation models the command, execution and result phases expected by MDOS 2.93, including the uPD765 end-of-cylinder completion status used by its single-sector routines. Raw sector reads, writes and track formatting are handled by the controller model; FAT12, directory management, BASIC syntax and SNAP file creation remain inside the original MDOS ROM.

Rotational timing, flux transitions, CRC fault injection, weak sectors and other analogue disk effects are outside the present scope. See [`TECHNICAL-NOTES.md`](TECHNICAL-NOTES.md).

## Verification

Run the portable checks with:

```sh
./verify.sh
```

This validates JavaScript syntax, controller behavior, Kempston mouse port decoding and wrapping counters, MDOS directory/FAT parsing, file extraction, TAP block parsing, bundled media hashes, the source-grounded Desktop BT-100 handshake that completes all 480 pixel cycles of a 60-byte row, and the BT-BCS C-2 return-to-origin encoder cycle.

A focused Playwright regression uses the real V1.1 driver and `LPRINT "I"` at authentic printer speed:

```sh
python3 tests/bt100-i-registration.py
```

It verifies the exact 20-dot glyph structure, one-pitch spacing inside each raster row and a half-pitch—not whole-column—difference between opposite carriage directions.

An optional comprehensive Playwright integration test additionally:

- boots and verifies the supplied Gama, Didaktik M, Kompakt and MDOS ROMs;
- verifies fixed display RAM and independent Didaktik upper-bank contents;
- checks `OUT 127,n`, reset-to-bank-0 behavior and all five selector profiles;
- enables Melodik, verifies AY register write/read through `FFFDh` and `BFFDh`, preserves it across compatible profiles, and rejects it as an external peripheral on 128K;
- confirms that mounted disks survive profile changes;
- exercises the image browser and drag-and-drop mounting;
- verifies writable 2 KiB interface RAM and protected MDOS ROM;
- performs a real MDOS SNAP save;
- repeats the BT-100 `LPRINT "I"` registration check;
- fails on browser or console errors.

Run it with:

```sh
D80_BROWSER_TEST=1 ./verify.sh
```


## Screen scaling

The emulator display uses browser resampling rather than nearest-neighbour scaling. QAOP renders the 272 logical screen rows in a 544-row backing canvas; resampling combines each pair cleanly and avoids prominent uneven scanlines at non-integer window sizes. The optional QAOP CRT distortion is disabled for this standalone application.
