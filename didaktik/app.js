(function () {
  'use strict';

  const drivePrefix = ['driveA', 'driveB'];
  const MACHINE_STORAGE_KEY = 'didaktik-d80.machine';
  const MELODIK_STORAGE_KEY = 'didaktik-d80.melodik';
  const PRINTER_SPEED_STORAGE_KEY = 'didaktik-d80.bt100-speed';
  const PRINTER_COLOR_STORAGE_KEY = 'didaktik-d80.bt100-color';
  const PRINTER_DARKNESS_STORAGE_KEY = 'didaktik-d80.bt100-darkness';
  const PRINTER_DOT_SIZE_STORAGE_KEY = 'didaktik-d80.bt100-dot-size';
  const PRINTER_RANDOM_OFFSET_STORAGE_KEY = 'didaktik-d80.bt100-random-offset';
  const PRINTER_RANDOM_DOTS_STORAGE_KEY = 'didaktik-d80.bt100-random-dots';
  const PRINTER_CONNECTION_STORAGE_KEY = 'didaktik-d80.bt100-connection';
  const MOUSE_SENSITIVITY_STORAGE_KEY = 'didaktik-d80.kempston-mouse-sensitivity';
  const PRINTER_SPEED_OPTIONS = [1, 10, 100];
  const PRINTER_CONNECTION_OPTIONS = ['didaktik-ab', 'bt100-cb', 'bt100-c1', 'ur4-c', 'bt100-c3'];
  let emulator = null;
  let paused = false;
  let machineReady = false;
  let activeStorageTab = 'drives';
  let browserDrive = 0;
  let selectedDirectoryIndex = null;
  let tapeImage = null;
  let selectedTapeBlockIndex = null;
  let machineSwitching = false;
  let mouseEnabled = false;
  let mouseSensitivity = 100;
  let mouseFractionX = 0;
  let mouseFractionY = 0;
  const hexViewState = { file: null, tape: null };
  const printerView = {
    fullCanvas: null,
    fullContext: null,
    renderedDots: 0,
    pageSerial: -1,
    stampKey: '',
    stamps: [],
    darkness: 75,
    dotSize: 220,
    randomOffset: 13,
    randomDots: true
  };

  const byId = id => document.getElementById(id);

  function setNotice(message, kind = '') {
    const notice = byId('notice');
    notice.textContent = message;
    notice.className = `notice${kind ? ` is-${kind}` : ''}`;
  }

  function readableBytes(bytes) {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(bytes >= 1024 * 1024 ? 0 : 1)} KiB`;
  }

  function hexadecimal(value) {
    return `$${Number(value).toString(16).toUpperCase().padStart(4, '0')}`;
  }

  function basicAutostart(value) {
    return value >= 0x8000 ? 'none' : String(value);
  }

  function hideHexViewer(kind) {
    const viewer = byId(`${kind}HexViewer`);
    if (viewer) viewer.hidden = true;
    hexViewState[kind] = null;
  }

  function showHexViewer(kind, key, title, summary, bytes, baseOffset = 0) {
    const viewer = byId(`${kind}HexViewer`);
    const dump = byId(`${kind}HexDump`);
    if (!viewer || !dump || !window.DidaktikHex) return;
    viewer.hidden = false;
    byId(`${kind}HexTitle`).textContent = title;
    byId(`${kind}HexSummary`).textContent = summary;
    if (hexViewState[kind] === key) return;
    const content = typeof bytes === 'function' ? bytes() : bytes;
    dump.textContent = window.DidaktikHex.format(content, { baseOffset });
    dump.scrollTop = 0;
    dump.scrollLeft = 0;
    hexViewState[kind] = key;
  }

  function printerGeometry(status) {
    const pitch = 4;
    const leftMarginDots = 20;
    const topMarginDots = 18;
    return {
      pitch,
      leftMarginDots,
      topMarginDots,
      width: (status.pageWidthDots + leftMarginDots * 2) * pitch,
      height: (status.pageHeightDots + topMarginDots * 2) * pitch
    };
  }

  function printerPalette(color) {
    return color === 'blue'
      ? { fill: [38, 58, 122], edge: [22, 36, 84], paper: '#ffffff' }
      : { fill: [63, 57, 54], edge: [39, 35, 33], paper: '#ffffff' };
  }


  function printerDarknessMultiplier() {
    return Math.max(0.4, Math.min(1, printerView.darkness / 100));
  }

  function printerDotSizeRatio() {
    return Math.max(0.4, Math.min(2.6, printerView.dotSize / 100));
  }

  function printerRandomOffsetRatio() {
    return Math.max(0, Math.min(0.5, printerView.randomOffset / 100));
  }

  function invalidatePrinterPreview() {
    printerView.pageSerial = -1;
    printerView.renderedDots = 0;
  }

  function ensurePrinterSurface(status) {
    const preview = byId('printerPreview');
    if (!preview || !status) return null;
    const geometry = printerGeometry(status);
    if (!printerView.fullCanvas) {
      printerView.fullCanvas = document.createElement('canvas');
      printerView.fullContext = printerView.fullCanvas.getContext('2d');
    }
    if (printerView.fullCanvas.width !== geometry.width || printerView.fullCanvas.height !== geometry.height) {
      printerView.fullCanvas.width = geometry.width;
      printerView.fullCanvas.height = geometry.height;
      preview.width = geometry.width;
      preview.height = geometry.height;
      printerView.pageSerial = -1;
      printerView.renderedDots = 0;
    } else if (preview.width !== geometry.width || preview.height !== geometry.height) {
      preview.width = geometry.width;
      preview.height = geometry.height;
    }
    return { geometry, previewContext: preview.getContext('2d') };
  }

  function createDotStamp(index, color, darkness, dotSize, randomized, pitch) {
    const palette = printerPalette(color);
    const [r, g, b] = palette.fill;
    const [er, eg, eb] = palette.edge;
    const seed = index + 1;
    const nominalDiameter = pitch * dotSize;
    const sizeVariation = randomized ? 0.94 + (seed % 7) * 0.018 : 1;
    const radius = nominalDiameter * sizeVariation / 2;
    const padding = Math.max(4, Math.ceil(radius * 0.75));
    const side = Math.max(12, Math.ceil(radius * 2 + padding * 2));
    const center = side / 2;
    const stamp = document.createElement('canvas');
    stamp.width = side;
    stamp.height = side;
    const ctx = stamp.getContext('2d');
    ctx.translate(center, center);

    if (randomized) ctx.rotate((seed % 11) * 0.11);
    ctx.shadowColor = `rgba(${er}, ${eg}, ${eb}, ${0.12 + darkness * 0.12})`;
    ctx.shadowBlur = randomized ? 0.7 + (seed % 3) * 0.25 : 0.55;
    ctx.beginPath();
    if (randomized) {
      for (let step = 0; step < 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        const wobble = (
          Math.sin(angle * (2 + (seed % 3)) + seed * 0.3) * 0.09
          + Math.cos(angle * (3 + (seed % 4)) - seed * 0.17) * 0.055
        );
        const local = radius * (1 + wobble);
        const x = Math.cos(angle) * local;
        const y = Math.sin(angle) * local * (0.91 + (seed % 4) * 0.025);
        if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else {
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    }

    const shapeOpacity = randomized ? 0.84 + (seed % 6) * 0.027 : 1;
    const fillAlpha = Math.min(1, darkness * shapeOpacity);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillAlpha})`;
    ctx.fill();
    ctx.lineWidth = Math.max(0.4, nominalDiameter * 0.055);
    ctx.strokeStyle = `rgba(${er}, ${eg}, ${eb}, ${Math.min(0.72, 0.16 + darkness * 0.42)})`;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (randomized) {
      ctx.beginPath();
      ctx.arc(-radius * 0.22, -radius * 0.24, Math.max(0.45, radius * 0.22), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.025 + (1 - darkness) * 0.04 + (seed % 4) * 0.006})`;
      ctx.fill();
    }
    return stamp;
  }

  function ensurePrinterStamps(color, darkness, dotSize, randomized, pitch) {
    const count = randomized ? 20 : 1;
    const key = `${color}:${darkness}:${dotSize}:${randomized ? 1 : 0}:${pitch}`;
    if (printerView.stampKey === key && printerView.stamps.length === count) return;
    printerView.stamps = Array.from(
      { length: count },
      (_, index) => createDotStamp(index, color, darkness, dotSize, randomized, pitch)
    );
    printerView.stampKey = key;
  }

  function paintPrinterPaper(status) {
    const surface = ensurePrinterSurface(status);
    if (!surface) return null;
    const { geometry } = surface;
    const ctx = printerView.fullContext;
    const palette = printerPalette(status.carbonColor);
    ctx.save();
    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, geometry.width, geometry.height);
    ctx.restore();
    return surface;
  }

  function drawPrintedDot(mark, status, geometry) {
    const randomized = printerView.randomDots;
    ensurePrinterStamps(
      mark.color || status.carbonColor,
      printerDarknessMultiplier(),
      printerDotSizeRatio(),
      randomized,
      geometry.pitch
    );
    const variant = randomized ? (Number(mark.variant) || 0) : 0;
    const stamp = printerView.stamps[variant % printerView.stamps.length];
    const jitterX = Number.isFinite(mark.jitterX)
      ? mark.jitterX
      : Number.isFinite(mark.dx) ? Math.max(-1, Math.min(1, mark.dx / 0.13)) : 0;
    const jitterY = Number.isFinite(mark.jitterY)
      ? mark.jitterY
      : Number.isFinite(mark.dy) ? Math.max(-1, Math.min(1, mark.dy / 0.12)) : 0;
    const randomOffset = printerRandomOffsetRatio();
    const dx = jitterX * randomOffset;
    const dy = jitterY * randomOffset;
    const ctx = printerView.fullContext;
    const x = ((geometry.leftMarginDots + status.paperShiftX + mark.x + dx) * geometry.pitch) - stamp.width / 2;
    const y = ((geometry.topMarginDots + status.paperShiftY + mark.y + dy) * geometry.pitch) - stamp.height / 2;
    ctx.save();
    ctx.globalAlpha = randomized ? (mark.opacity || 0.88) : 1;
    ctx.drawImage(stamp, x, y);
    ctx.restore();
  }

  function syncPrinterPreview(status) {
    const preview = byId('printerPreview');
    if (!preview || !status || !emulator?.printer) return;
    const surface = ensurePrinterSurface(status);
    if (!surface) return;
    const { geometry, previewContext } = surface;
    if (printerView.pageSerial !== status.pageSerial) {
      paintPrinterPaper(status);
      printerView.renderedDots = 0;
      printerView.pageSerial = status.pageSerial;
    }
    const marks = emulator.printer.printedDots || [];
    for (let index = printerView.renderedDots; index < marks.length; index += 1) drawPrintedDot(marks[index], status, geometry);
    printerView.renderedDots = marks.length;

    previewContext.clearRect(0, 0, preview.width, preview.height);
    previewContext.drawImage(printerView.fullCanvas, 0, 0);

    const headX = (geometry.leftMarginDots + status.paperShiftX + status.headX) * geometry.pitch;
    const headY = (geometry.topMarginDots + status.paperShiftY + status.headY) * geometry.pitch;
    previewContext.save();
    previewContext.strokeStyle = 'rgba(164, 104, 56, 0.95)';
    previewContext.fillStyle = 'rgba(164, 104, 56, 0.18)';
    previewContext.lineWidth = 1.2;
    previewContext.beginPath();
    previewContext.arc(headX, headY, 8, 0, Math.PI * 2);
    previewContext.fill();
    previewContext.stroke();
    previewContext.restore();
  }

  function renderPrinterPanel(status) {
    if (!emulator) return;
    const printer = status?.printer || emulator.getStatus().printer;
    byId('printerSummary').textContent = `${printer.dotCount.toLocaleString()} dots on page · head ${printer.headX},${printer.headY} · ${printer.direction >= 0 ? 'left → right' : 'right ← left'}`;
    byId('printerHead').textContent = `${printer.headX}, ${printer.headY}`;
    byId('printerPorts').textContent = `${hexadecimal(printer.portA)} / ${hexadecimal(printer.portB)} / ${hexadecimal(printer.portC)} / ${hexadecimal(printer.controlWord)}`;
    byId('printerLimits').textContent = `${printer.leftLimit ? 'left ' : ''}${printer.rightLimit ? 'right' : ''}`.trim() || 'none';
    byId('printerDots').textContent = printer.dotCount.toLocaleString();
    byId('printerConnection').value = printer.connectionId;
    byId('printerConnectionHelp').textContent = printer.connectionDescription;
    byId('printerColor').value = printer.carbonColor;
    byId('printerSpeed').value = String(printer.speedFactor);
    byId('printerDarkness').value = String(printerView.darkness);
    byId('printerDarknessValue').textContent = `${printerView.darkness}%`;
    byId('printerDotSize').value = String(printerView.dotSize);
    byId('printerDotSizeValue').textContent = `${printerView.dotSize}%`;
    byId('printerRandomOffset').value = String(printerView.randomOffset);
    byId('printerRandomOffsetValue').textContent = `±${printerView.randomOffset}%`;
    byId('printerRandomDots').checked = printerView.randomDots;
    syncPrinterPreview(printer);
  }

  function printBt100Page() {
    const status = emulator?.getStatus().printer;
    if (!status) return;

    // Open synchronously from the click event so browser popup protection sees
    // a direct user gesture. Do not use the noopener window feature here:
    // Chromium may create an about:blank tab but return null, preventing us
    // from navigating or populating it.
    const popup = window.open('', 'bt100-print-preview', 'popup=yes,width=920,height=1050');
    if (!popup) {
      setNotice('Unable to open the print preview. Allow pop-ups for this page.', 'error');
      return;
    }

    syncPrinterPreview(status);
    const dataUrl = printerView.fullCanvas.toDataURL('image/png');
    const documentHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BT-100 page</title>
  <style>
    html,body{margin:0;min-height:100%;background:#d9d9d9}
    body{font-family:system-ui,sans-serif}
    main{display:flex;justify-content:center;padding:18px}
    img{display:block;width:min(210mm,96vw);height:auto;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.22)}
    .print-help{position:fixed;right:12px;bottom:12px;padding:7px 10px;border-radius:6px;background:#222;color:#fff;font-size:12px;opacity:.82}
    @page{size:A4 portrait;margin:0}
    @media print{
      html,body{width:210mm;height:297mm;background:#fff}
      main{display:block;padding:0}
      img{width:210mm;height:297mm;object-fit:contain;box-shadow:none}
      .print-help{display:none}
    }
  </style>
</head>
<body>
  <main><img id="bt100PrintImage" src="${dataUrl}" alt="BT-100 page"></main>
  <div class="print-help">Use the print dialog to select a printer or Save as PDF.</div>
  <script>
    (() => {
      const image = document.getElementById('bt100PrintImage');
      const invokePrint = () => setTimeout(() => { window.focus(); window.print(); }, 100);
      if (image.complete) invokePrint();
      else image.addEventListener('load', invokePrint, { once: true });
    })();
  <\/script>
</body>
</html>`;

    // Navigate to a real Blob URL instead of leaving the window at
    // about:blank. The printable page is self-contained and invokes print only
    // after its data-URL image has decoded.
    const printUrl = URL.createObjectURL(new Blob([documentHtml], { type: 'text/html;charset=utf-8' }));
    popup.location.replace(printUrl);
    popup.opener = null;
    window.setTimeout(() => URL.revokeObjectURL(printUrl), 60_000);
    setNotice('BT-100 print preview opened. Select a printer or Save as PDF in the browser dialog.', 'success');
  }

  function downloadBt100Png() {
    const status = emulator?.getStatus().printer;
    if (!status) return;
    syncPrinterPreview(status);
    printerView.fullCanvas.toBlob(blob => {
      if (!blob) return;
      const fileName = `bt100-page-${Date.now()}.png`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function renderDrive(index, drive, selectedDrive) {
    const prefix = drivePrefix[index];
    const card = document.querySelector(`.drive-card[data-drive="${index}"]`);
    const disk = drive.disk;
    card.classList.toggle('is-selected', selectedDrive === index);
    byId(`${prefix}Lamp`).classList.toggle('is-on', !!drive.led);
    byId(`${prefix}Track`).textContent = String(drive.currentTrack);
    byId(`${prefix}Name`).textContent = disk?.fileName || 'Empty';
    byId(`${prefix}Volume`).textContent = disk?.volumeName || '—';
    byId(`${prefix}Geometry`).textContent = disk
      ? `${disk.geometry.tracks}T × ${disk.geometry.sides}S × ${disk.geometry.sectorsPerTrack} (${readableBytes(disk.byteLength)})`
      : '—';

    const states = [];
    if (!disk) states.push('No disk');
    else {
      states.push(drive.motor ? 'Motor on' : 'Ready');
      if (disk.writeProtected) states.push('protected');
      if (disk.dirty) states.push('modified');
    }
    byId(`${prefix}State`).textContent = states.join(', ');

    const protect = byId(`${prefix}WriteProtect`);
    protect.disabled = !disk;
    protect.checked = !!disk?.writeProtected;
    card.querySelector('[data-action="eject"]').disabled = !disk;
    card.querySelector('[data-action="save"]').disabled = !disk;
  }

  function mouseCaptureTarget() {
    return byId('f');
  }

  function mouseIsCaptured() {
    return document.pointerLockElement === mouseCaptureTarget();
  }

  function renderMousePanel(status = emulator?.getStatus()) {
    const mouse = status?.mouse || { enabled: false, x: 0, y: 0, left: false, right: false, middle: false };
    const captured = mouse.enabled && mouseIsCaptured();
    const enabledControl = byId('mouseEnabled');
    if (enabledControl) enabledControl.checked = !!mouse.enabled;
    const sensitivityControl = byId('mouseSensitivity');
    if (sensitivityControl) sensitivityControl.value = String(mouseSensitivity);
    const sensitivityValue = byId('mouseSensitivityValue');
    if (sensitivityValue) sensitivityValue.textContent = `${mouseSensitivity}%`;
    const captureStatus = byId('mouseCaptureStatus');
    if (captureStatus) captureStatus.textContent = !mouse.enabled ? 'Disabled' : captured ? 'Captured' : 'Ready';
    const coordinates = byId('mouseCoordinates');
    if (coordinates) coordinates.textContent = `${mouse.x}, ${mouse.y}`;
    const pressed = [];
    if (mouse.left) pressed.push('left');
    if (mouse.right) pressed.push('right');
    if (mouse.middle) pressed.push('middle');
    const buttons = byId('mouseButtons');
    if (buttons) buttons.textContent = pressed.join(' + ') || 'none';

    const card = byId('mouseCaptureCard');
    const target = mouseCaptureTarget();
    if (card) {
      card.classList.toggle('is-ready', !!mouse.enabled && !captured);
      card.classList.toggle('is-captured', captured);
      const heading = card.querySelector('strong');
      if (heading) heading.textContent = !mouse.enabled
        ? 'Mouse capture is disabled.'
        : captured ? 'Pointer captured by the emulator.' : 'Click the emulator screen to capture the mouse.';
    }
    const help = byId('mouseCaptureHelp');
    if (help) help.textContent = captured
      ? 'Move and click normally. Press Esc to release the pointer.'
      : 'Enable the interface, then click the emulator screen to grab the pointer. Press Esc to release it.';
    if (target) {
      target.classList.toggle('mouse-capture-ready', !!mouse.enabled && !captured);
      target.classList.toggle('mouse-captured', captured);
    }
  }

  function scaledMouseDelta(value, axis) {
    const scaled = value * mouseSensitivity / 100 + (axis === 'x' ? mouseFractionX : mouseFractionY);
    const whole = scaled < 0 ? Math.ceil(scaled) : Math.floor(scaled);
    if (axis === 'x') mouseFractionX = scaled - whole;
    else mouseFractionY = scaled - whole;
    return whole;
  }

  function resetMouseFractions() {
    mouseFractionX = 0;
    mouseFractionY = 0;
  }

  function setMouseEnabled(enabled) {
    mouseEnabled = !!enabled;
    resetMouseFractions();
    const mouse = emulator?.setKempstonMouseEnabled(mouseEnabled);
    if (!mouseEnabled && mouseIsCaptured()) document.exitPointerLock?.();
    renderMousePanel(emulator?.getStatus());
    setNotice(mouseEnabled
      ? 'Kempston mouse enabled. Click the emulator screen to capture it; press Esc to release.'
      : 'Kempston mouse disabled.', 'success');
    if (!mouseEnabled) focusMachine();
    return mouse;
  }

  function bindKempstonMouse() {
    const target = mouseCaptureTarget();
    if (!target) return;

    target.addEventListener('click', () => {
      if (!mouseEnabled || mouseIsCaptured()) return;
      focusMachine();
      if (!target.requestPointerLock) {
        setNotice('This browser does not support pointer-lock mouse capture.', 'error');
        return;
      }
      try {
        const request = target.requestPointerLock();
        if (request?.catch) request.catch(error => {
          console.error(error);
          setNotice('The browser refused mouse capture.', 'error');
        });
      } catch (error) {
        console.error(error);
        setNotice('The browser refused mouse capture.', 'error');
      }
    });

    target.addEventListener('contextmenu', event => {
      if (!mouseEnabled) return;
      event.preventDefault();
    });

    document.addEventListener('pointerlockchange', () => {
      resetMouseFractions();
      emulator?.releaseKempstonMouseButtons();
      renderMousePanel(emulator?.getStatus());
      if (mouseEnabled) setNotice(mouseIsCaptured()
        ? 'Mouse captured. Press Esc to release it.'
        : 'Mouse released. Click the emulator screen to capture it again.');
    });

    document.addEventListener('pointerlockerror', () => {
      renderMousePanel(emulator?.getStatus());
      setNotice('The browser could not capture the mouse pointer.', 'error');
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !mouseIsCaptured()) return;
      document.exitPointerLock?.();
      event.stopImmediatePropagation();
    }, true);

    document.addEventListener('mousemove', event => {
      if (!mouseEnabled || !mouseIsCaptured() || !emulator) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const dx = scaledMouseDelta(event.movementX || 0, 'x');
      const dy = scaledMouseDelta(event.movementY || 0, 'y');
      if (dx || dy) emulator.moveKempstonMouse(dx, dy);
    }, true);

    const handleButton = pressed => event => {
      if (!mouseEnabled || !mouseIsCaptured() || !emulator || event.button > 2) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      emulator.setKempstonMouseButton(event.button, pressed);
      renderMousePanel(emulator.getStatus());
    };
    document.addEventListener('mousedown', handleButton(true), true);
    document.addEventListener('mouseup', handleButton(false), true);
  }

  function render(status) {
    const machine = status.machine || { id: 'didaktik80', label: 'Didaktik 80K', shortLabel: 'GAMA', memoryDescription: '' };
    byId('machineSelect').value = machine.id;
    byId('machineMemory').textContent = machine.memoryDescription;
    const isSpectrum = machine.id === 'spectrum48' || machine.id === 'spectrum128';
    byId('machineBrand').textContent = isSpectrum ? 'ZX SPECTRUM' : 'DIDAKTIK';
    byId('machineModelMark').textContent = machine.shortLabel;
    const bankStatus = byId('bankStatus');
    if (machine.id === 'didaktik80') {
      bankStatus.textContent = `32K bank ${machine.bank ?? 0}`;
      bankStatus.className = 'status-badge status-badge--active';
    } else if (machine.id === 'spectrum128') {
      bankStatus.textContent = `RAM page ${machine.bank ?? 0}`;
      bankStatus.className = 'status-badge status-badge--active';
    } else {
      bankStatus.textContent = 'Linear 48K';
      bankStatus.className = 'status-badge status-badge--muted';
    }
    const sound = status.sound || {};
    const melodikControl = byId('melodikControl');
    melodikControl.checked = !!sound.melodikEnabled;
    melodikControl.disabled = machineSwitching || !sound.melodikAvailable;
    byId('melodikLabel').title = sound.builtInAy
      ? 'ZX Spectrum 128K already has a built-in AY-3-8912; external Melodik is unavailable.'
      : 'Attach a Didaktik Melodik AY-3-8912 interface.';
    const soundStatus = byId('soundStatus');
    if (sound.builtInAy) {
      soundStatus.textContent = 'AY built in';
      soundStatus.className = 'status-badge status-badge--active';
    } else if (sound.melodikEnabled) {
      soundStatus.textContent = 'Melodik AY';
      soundStatus.className = 'status-badge status-badge--active';
    } else {
      soundStatus.textContent = 'Beeper only';
      soundStatus.className = 'status-badge status-badge--muted';
    }
    byId('systemStatus').textContent = machineSwitching ? 'Switching…' : paused ? 'Paused' : 'Running';
    byId('systemStatus').className = `status-badge${paused ? ' status-badge--active' : ''}`;
    byId('romStatus').textContent = status.paged ? 'MDOS ROM paged' : status.initialized ? 'MDOS resident' : 'BASIC ROM active';
    byId('romStatus').className = `status-badge ${(status.paged || status.initialized) ? 'status-badge--active' : 'status-badge--muted'}`;
    byId('controllerStatus').textContent = `FDC ${status.controllerPhase}`;
    byId('controllerStatus').className = `status-badge ${status.controllerPhase === 'idle' ? 'status-badge--muted' : 'status-badge--active'}`;
    status.drives.forEach((drive, index) => renderDrive(index, drive, status.selectedDrive));
    renderMousePanel(status);
    if (activeStorageTab === 'files') renderFileBrowser();
    else if (activeStorageTab === 'tape') renderTapeBrowser();
    else if (activeStorageTab === 'printer') renderPrinterPanel(status);
    else if (activeStorageTab === 'mouse') renderMousePanel(status);
  }

  function focusMachine() {
    requestAnimationFrame(() => byId('f').focus());
  }

  function activeFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  async function toggleEmulatorFullscreen() {
    const target = byId('emulatorFullscreenTarget');
    if (!target) return;
    try {
      const active = activeFullscreenElement();
      if (active === target) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        if (active) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (exit) await exit.call(document);
        }
        const enter = target.requestFullscreen || target.webkitRequestFullscreen;
        if (!enter) throw new Error('This browser does not support element fullscreen mode.');
        await enter.call(target, { navigationUI: 'hide' });
      }
    } catch (error) {
      setNotice(error.message || 'Unable to enter fullscreen mode.', 'error');
    } finally {
      focusMachine();
    }
  }

  function isFullscreenShortcut(event) {
    return event.key === 'F11' || event.code === 'F11' || event.keyCode === 122;
  }

  function bindEmulatorFullscreen() {
    const handleF11Down = event => {
      if (!isFullscreenShortcut(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) void toggleEmulatorFullscreen();
    };
    const suppressF11Up = event => {
      if (!isFullscreenShortcut(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', handleF11Down, true);
    window.addEventListener('keyup', suppressF11Up, true);

    const syncFullscreenButton = () => {
      const active = activeFullscreenElement() === byId('emulatorFullscreenTarget');
      const button = byId('fullscreenButton');
      if (button) button.textContent = active ? 'Exit fullscreen' : 'Fullscreen';
      if (active) focusMachine();
    };
    document.addEventListener('fullscreenchange', syncFullscreenButton);
    document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
    const fullscreenButton = byId('fullscreenButton');
    if (fullscreenButton) fullscreenButton.addEventListener('click', () => void toggleEmulatorFullscreen());
  }

  function setSnapEnabled(enabled) {
    machineReady = !!enabled;
    const button = byId('snapButton');
    button.disabled = !machineReady;
    button.dataset.ready = machineReady ? 'true' : 'false';
  }

  function confirmReplace(index, operation) {
    const disk = emulator.drives[index].disk;
    if (!disk?.dirty) return true;
    return window.confirm(`${disk.fileName} has unsaved changes. ${operation} anyway?`);
  }

  function triggerDownload(bytes, fileName) {
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadDisk(index) {
    const disk = emulator.drives[index].disk;
    if (!disk) return;
    triggerDownload(disk.bytes, disk.fileName || `drive-${index ? 'B' : 'A'}.d80`);
    disk.dirty = false;
    emulator.scheduleNotify();
    setNotice(`${disk.fileName} downloaded.`, 'success');
  }

  async function loadDiskFromFile(index, file, options = {}) {
    if (!file || !confirmReplace(index, 'Replace it')) return false;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length || bytes.length % 512 !== 0) throw new Error('A D40/D80 image must contain a whole number of 512-byte sectors.');
    emulator.insert(index, bytes, { fileName: file.name });
    browserDrive = index;
    selectedDirectoryIndex = null;
    setNotice(`${file.name} inserted into drive ${index ? 'B' : 'A'}.`, 'success');
    if (options.focus !== false) focusMachine();
    renderFileBrowser();
    return true;
  }

  function setStorageTab(tab) {
    if (!['drives', 'files', 'tape', 'printer', 'mouse'].includes(tab)) return;
    activeStorageTab = tab;
    for (const button of document.querySelectorAll('[data-storage-tab]')) {
      const active = button.dataset.storageTab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    byId('drivesPanel').hidden = tab !== 'drives';
    byId('filesPanel').hidden = tab !== 'files';
    byId('tapePanel').hidden = tab !== 'tape';
    byId('printerPanel').hidden = tab !== 'printer';
    byId('mousePanel').hidden = tab !== 'mouse';
    if (tab === 'files') renderFileBrowser();
    else if (tab === 'tape') renderTapeBrowser();
    else if (tab === 'printer') renderPrinterPanel();
    else if (tab === 'mouse') renderMousePanel();
  }

  function setBrowserDrive(index) {
    browserDrive = Number(index) ? 1 : 0;
    selectedDirectoryIndex = null;
    renderFileBrowser();
  }

  function makeCell(text, className = '') {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function selectedFile() {
    const disk = emulator?.drives[browserDrive]?.disk;
    return disk?.getCatalog().files.find(file => file.directoryIndex === selectedDirectoryIndex) || null;
  }

  function selectFile(directoryIndex) {
    selectedDirectoryIndex = directoryIndex;
    renderFileBrowser();
  }

  function renderSelectedFile(disk, file) {
    const details = byId('fileDetails');
    const download = byId('downloadFileButton');
    if (!disk || !file) {
      details.hidden = true;
      download.disabled = true;
      hideHexViewer('file');
      return;
    }

    details.hidden = false;
    byId('selectedFileName').textContent = file.displayName;
    const metadata = byId('selectedFileMetadata');
    metadata.replaceChildren();
    const fields = [
      ['MDOS type', `${file.typeLetter} — ${file.typeLabel}`],
      ['Length', `${file.byteLength.toLocaleString()} bytes`],
      [file.typeLetter === 'P' ? 'Autostart line' : 'Load address', file.typeLetter === 'P' ? basicAutostart(file.startAddress) : `${file.startAddress} (${hexadecimal(file.startAddress)})`],
      ...(file.typeLetter === 'P' ? [['Program length', `${file.basicLength.toLocaleString()} bytes without variables`]] : []),
      ['First sector', String(file.firstSector)],
      ['FAT chain', file.sectors.length ? file.sectors.join(' → ') : 'empty file'],
      ['Attributes', file.attributeText || 'none']
    ];
    for (const [term, value] of fields) {
      const wrapper = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = term;
      dd.textContent = value;
      wrapper.append(dt, dd);
      metadata.append(wrapper);
    }
    const warning = byId('selectedFileWarning');
    warning.hidden = file.chainComplete;
    warning.textContent = file.chainError || 'The FAT chain is incomplete.';
    download.disabled = !file.chainComplete;
    if (file.chainComplete) {
      try {
        showHexViewer(
          'file',
          file,
          `${file.displayName} — file contents`,
          `${file.byteLength.toLocaleString()} bytes · offsets relative to the extracted file`,
          () => disk.extractFile(file),
          0
        );
      } catch (error) {
        hideHexViewer('file');
        warning.hidden = false;
        warning.textContent = error.message;
      }
    } else {
      hideHexViewer('file');
    }
  }

  function renderFileBrowser() {
    if (!emulator) return;
    for (const button of document.querySelectorAll('[data-browser-drive]')) {
      const active = Number(button.dataset.browserDrive) === browserDrive;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    const disk = emulator.drives[browserDrive].disk;
    const summary = byId('imageBrowserSummary');
    const empty = byId('imageBrowserEmpty');
    const tableWrap = byId('imageBrowserTableWrap');
    const rows = byId('imageFileRows');
    rows.replaceChildren();

    if (!disk) {
      summary.textContent = `Drive ${browserDrive ? 'B' : 'A'} is empty.`;
      empty.textContent = 'Insert or drop an MDOS image to browse its directory.';
      empty.hidden = false;
      tableWrap.hidden = true;
      renderSelectedFile(null, null);
      return;
    }

    const catalog = disk.getCatalog();
    if (!catalog.formatted) {
      summary.textContent = `${disk.fileName} · ${readableBytes(disk.byteLength)}`;
      empty.textContent = 'This image has no SDOS boot signature and does not contain a readable MDOS directory.';
      empty.hidden = false;
      tableWrap.hidden = true;
      renderSelectedFile(null, null);
      return;
    }

    summary.textContent = `${catalog.volumeName} · ${catalog.files.length} files · ${readableBytes(catalog.freeSectors * 512)} free · ${disk.fileName}`;
    const filter = byId('fileFilter').value.trim().toLocaleLowerCase();
    const visibleFiles = catalog.files.filter(file => !filter || `${file.displayName} ${file.typeLetter} ${file.typeLabel}`.toLocaleLowerCase().includes(filter));
    const current = catalog.files.find(file => file.directoryIndex === selectedDirectoryIndex) || null;
    if (!current) selectedDirectoryIndex = null;

    if (catalog.error || !visibleFiles.length) {
      empty.textContent = catalog.error || (catalog.files.length ? 'No files match the filter.' : 'The MDOS directory is empty.');
      empty.hidden = false;
      tableWrap.hidden = true;
    } else {
      empty.hidden = true;
      tableWrap.hidden = false;
      for (const file of visibleFiles) {
        const row = document.createElement('tr');
        row.dataset.directoryIndex = String(file.directoryIndex);
        row.tabIndex = 0;
        row.classList.toggle('is-selected', file.directoryIndex === selectedDirectoryIndex);
        row.append(
          makeCell(file.displayName, 'file-name-cell'),
          makeCell(`${file.typeLetter} · ${file.typeLabel}`),
          makeCell(readableBytes(file.byteLength), 'numeric-cell'),
          makeCell(file.typeLetter === 'P' ? (file.startAddress >= 0x8000 ? 'no autostart' : `line ${file.startAddress}`) : hexadecimal(file.startAddress), 'numeric-cell'),
          makeCell(file.attributeText || '—')
        );
        row.addEventListener('click', () => selectFile(file.directoryIndex));
        row.addEventListener('dblclick', () => {
          selectFile(file.directoryIndex);
          downloadSelectedFile();
        });
        row.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectFile(file.directoryIndex);
          }
        });
        rows.append(row);
      }
    }

    renderSelectedFile(disk, catalog.files.find(file => file.directoryIndex === selectedDirectoryIndex) || null);
  }

  function tapeHeadBlock(state = window.DidaktikTap?.getState?.()) {
    if (!tapeImage || !state) return null;
    return tapeImage.blockAtOffset(state.headOffset);
  }

  function renderTapeBrowser() {
    const rows = byId('tapeBlockRows');
    if (!rows) return;
    rows.replaceChildren();
    const summary = byId('tapeSummary');
    const empty = byId('tapeEmpty');
    const tableWrap = byId('tapeTableWrap');
    const rewind = byId('tapeRewind');
    const eject = byId('tapeEject');
    const position = byId('tapeCurrentPosition');
    const state = window.DidaktikTap?.getState?.() || null;

    if (!tapeImage || !state) {
      summary.textContent = 'No tape inserted.';
      empty.hidden = false;
      tableWrap.hidden = true;
      rewind.disabled = true;
      eject.disabled = true;
      position.textContent = 'No tape';
      selectedTapeBlockIndex = null;
      hideHexViewer('tape');
      return;
    }

    const current = tapeHeadBlock(state);
    if (current) selectedTapeBlockIndex = current.index;
    if (selectedTapeBlockIndex === null || !tapeImage.blocks[selectedTapeBlockIndex]) selectedTapeBlockIndex = 0;
    const selectedBlock = tapeImage.blocks[selectedTapeBlockIndex] || null;
    summary.textContent = `${tapeImage.fileName} · ${tapeImage.blocks.length} blocks · ${readableBytes(tapeImage.bytes.length)}`;
    empty.hidden = true;
    tableWrap.hidden = false;
    rewind.disabled = state.headOffset === 0;
    eject.disabled = false;
    position.textContent = current
      ? `Head at block ${current.number} of ${tapeImage.blocks.length}`
      : state.headOffset >= tapeImage.bytes.length ? 'Head at end of tape' : `Head at byte ${state.headOffset}`;

    for (const block of tapeImage.blocks) {
      const isCurrent = current?.index === block.index;
      const row = document.createElement('tr');
      row.dataset.tapeBlock = String(block.index);
      row.tabIndex = 0;
      row.classList.toggle('is-current', isCurrent);
      row.classList.toggle('is-selected', selectedBlock?.index === block.index);
      row.title = `${block.detail}. Click to set the tape head here.`;

      const headCell = makeCell(isCurrent ? '●' : '○', 'tape-head-cell');
      headCell.setAttribute('aria-label', isCurrent ? 'Current tape head position' : 'Set tape head here');
      row.append(
        headCell,
        makeCell(String(block.number), 'numeric-cell'),
        makeCell(block.kind),
        makeCell(block.name || '—', 'file-name-cell'),
        makeCell(readableBytes(block.payloadLength), 'numeric-cell'),
        makeCell(block.checksumValid ? 'OK' : 'Bad', block.checksumValid ? 'tape-checksum-ok' : 'chain-warning')
      );
      const select = () => setTapeHeadToBlock(block.index);
      row.addEventListener('click', select);
      row.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        select();
      });
      rows.append(row);
    }

    if (selectedBlock) {
      const blockBytes = tapeImage.bytes.subarray(selectedBlock.dataOffset, selectedBlock.endOffset);
      showHexViewer(
        'tape',
        selectedBlock,
        `Block ${selectedBlock.number}: ${selectedBlock.name || selectedBlock.kind}`,
        `${blockBytes.length.toLocaleString()} bytes · absolute TAP offsets · flag, payload and checksum`,
        blockBytes,
        selectedBlock.dataOffset
      );
    } else {
      hideHexViewer('tape');
    }
  }

  function setTapeHeadToBlock(index) {
    const block = tapeImage?.blocks[index];
    if (!block) return;
    selectedTapeBlockIndex = block.index;
    if (!window.DidaktikTap.setHeadOffset(block.offset)) {
      setNotice('Unable to move the tape head because no TAP image is mounted.', 'error');
      return;
    }
    renderTapeBrowser();
    setNotice(`Tape head positioned at block ${block.number}: ${block.name || block.kind}.`, 'success');
    focusMachine();
  }

  async function loadTapeFromFile(file) {
    if (!file) return false;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = new window.DidaktikTap.TapImage(bytes, file.name);
    await window.DidaktikTap.mountFile(file);
    tapeImage = parsed;
    selectedTapeBlockIndex = 0;
    window.DidaktikTap.setHeadOffset(0);
    setStorageTab('tape');
    renderTapeBrowser();
    setNotice(`${file.name} inserted: ${parsed.blocks.length} TAP blocks.`, 'success');
    return true;
  }

  function ejectTape() {
    window.DidaktikTap?.eject?.();
    const name = tapeImage?.fileName || 'Tape';
    tapeImage = null;
    selectedTapeBlockIndex = null;
    renderTapeBrowser();
    setNotice(`${name} ejected.`);
    focusMachine();
  }

  function downloadSelectedFile() {
    const disk = emulator?.drives[browserDrive]?.disk;
    const file = selectedFile();
    if (!disk || !file) return;
    try {
      const bytes = disk.extractFile(file);
      const safeName = file.displayName.replace(/[\\/:*?"<>|]/g, '_') || `file-${file.directoryIndex}`;
      triggerDownload(bytes, safeName);
      setNotice(`${file.displayName} extracted from drive ${browserDrive ? 'B' : 'A'}.`, 'success');
    } catch (error) {
      console.error(error);
      setNotice(error.message || String(error), 'error');
    }
  }

  function handleDriveAction(event) {
    const target = event.target.closest('[data-action][data-drive]');
    if (!target || !emulator) return;
    const index = Number(target.dataset.drive);
    const action = target.dataset.action;

    try {
      if (action === 'load') {
        byId(`${drivePrefix[index]}File`).click();
      } else if (action === 'eject') {
        if (!confirmReplace(index, 'Eject it')) return;
        const disk = emulator.eject(index);
        if (browserDrive === index) selectedDirectoryIndex = null;
        setNotice(`${disk?.fileName || 'Disk'} ejected from drive ${index ? 'B' : 'A'}.`);
        renderFileBrowser();
        renderPrinterPanel();
      } else if (action === 'save') {
        downloadDisk(index);
      } else if (action === 'new40' || action === 'new80') {
        if (!confirmReplace(index, 'Replace it')) return;
        const tracks = action === 'new40' ? 40 : 80;
        emulator.createBlank(index, tracks, 9);
        browserDrive = index;
        selectedDirectoryIndex = null;
        setNotice(`New unformatted ${tracks}-track image inserted into drive ${index ? 'B' : 'A'}. Use FORMAT in MDOS before storing files.`, 'success');
        renderFileBrowser();
        renderPrinterPanel();
      }
    } catch (error) {
      console.error(error);
      setNotice(error.message || String(error), 'error');
    }
  }

  function isFileDrag(event) {
    return Array.from(event.dataTransfer?.types || []).includes('Files');
  }

  function clearDragState() {
    document.documentElement.classList.remove('is-file-dragging');
    for (const card of document.querySelectorAll('.drive-card.is-drag-over')) card.classList.remove('is-drag-over');
  }

  async function mountDroppedFiles(files, preferredIndex) {
    const incoming = Array.from(files || []).filter(file => file && file.size);
    if (!incoming.length) return;
    const tape = incoming.find(file => /\.tap$/i.test(file.name));
    if (tape) await loadTapeFromFile(tape);

    const images = incoming.filter(file => file !== tape);
    if (!images.length) return;
    const firstIndex = preferredIndex ?? (emulator.drives[0].disk ? (emulator.drives[1].disk ? 0 : 1) : 0);
    const assignments = [[firstIndex, images[0]]];
    if (images[1]) assignments.push([1 - firstIndex, images[1]]);
    for (const [index, file] of assignments) await loadDiskFromFile(index, file, { focus: false });
    if (images.length > 2) setNotice(`Mounted the first two disk images; ${images.length - 2} additional file(s) were ignored.`);
  }

  function bindDragAndDrop() {
    for (const card of document.querySelectorAll('.drive-card')) {
      card.addEventListener('dragenter', event => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        document.documentElement.classList.add('is-file-dragging');
        card.classList.add('is-drag-over');
      });
      card.addEventListener('dragover', event => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        card.classList.add('is-drag-over');
      });
      card.addEventListener('dragleave', event => {
        if (!card.contains(event.relatedTarget)) card.classList.remove('is-drag-over');
      });
      card.addEventListener('drop', async event => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        const index = Number(card.dataset.drive);
        clearDragState();
        try {
          await mountDroppedFiles(event.dataTransfer.files, index);
        } catch (error) {
          console.error(error);
          setNotice(error.message || String(error), 'error');
        }
      });
    }

    document.addEventListener('dragenter', event => {
      if (isFileDrag(event)) document.documentElement.classList.add('is-file-dragging');
    });
    document.addEventListener('dragover', event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    document.addEventListener('dragleave', event => {
      if (!event.relatedTarget) clearDragState();
    });
    document.addEventListener('drop', async event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      clearDragState();
      try {
        await mountDroppedFiles(event.dataTransfer.files);
      } catch (error) {
        console.error(error);
        setNotice(error.message || String(error), 'error');
      }
    });
  }

  async function selectMachine(machineId) {
    if (!emulator || machineSwitching || emulator.currentMachineId === machineId) return;
    machineSwitching = true;
    const select = byId('machineSelect');
    select.disabled = true;
    setSnapEnabled(false);
    setNotice('Switching machine and resetting the D80 interface…');
    try {
      const profile = await emulator.setMachine(machineId);
      paused = false;
      byId('pauseButton').textContent = 'Pause';
      localStorage.setItem(MACHINE_STORAGE_KEY, profile.id);
      render(emulator.getStatus());
      await waitForMdosReady();
      setSnapEnabled(true);
      setNotice(`${profile.label} is ready. Mounted disk images were preserved.`, 'success');
    } catch (error) {
      console.error(error);
      setNotice(error.message || String(error), 'error');
    } finally {
      machineSwitching = false;
      select.disabled = false;
      render(emulator.getStatus());
      focusMachine();
    }
  }

  function bindControls() {
    bindEmulatorFullscreen();
    bindKempstonMouse();
    byId('machineSelect').addEventListener('change', event => selectMachine(event.target.value));

    byId('resetButton').addEventListener('click', async () => {
      setSnapEnabled(false);
      window.__qaop.resetMachine();
      paused = false;
      byId('pauseButton').textContent = 'Pause';
      setNotice('Machine reset; MDOS is reconnecting to the drives…');
      try {
        await waitForMdosReady();
        setSnapEnabled(true);
        setNotice('Reset complete. Disk images remain inserted.', 'success');
      } catch (error) {
        setNotice(error.message || String(error), 'error');
      }
      focusMachine();
    });

    byId('powerButton').addEventListener('click', async () => {
      setSnapEnabled(false);
      emulator.powerCycle();
      paused = false;
      byId('pauseButton').textContent = 'Pause';
      setNotice('Machine and D80 interface power-cycled; MDOS is initializing…');
      try {
        await waitForMdosReady();
        setSnapEnabled(true);
        setNotice('Power cycle complete.', 'success');
      } catch (error) {
        setNotice(error.message || String(error), 'error');
      }
      focusMachine();
    });

    byId('pauseButton').addEventListener('click', () => {
      window.qaop.command('pause');
      paused = !paused;
      byId('pauseButton').textContent = paused ? 'Resume' : 'Pause';
      setNotice(paused ? 'Emulation paused.' : 'Emulation resumed.');
      emulator.scheduleNotify();
      focusMachine();
    });

    byId('snapButton').addEventListener('click', () => {
      if (!machineReady) {
        setNotice('Wait until MDOS and the Spectrum ROM have finished reset initialization.');
        return;
      }
      emulator.snap();
      setNotice('SNAP requested. MDOS is saving the current machine state to the active disk.', 'success');
      focusMachine();
    });

    byId('keyboardButton').addEventListener('click', () => byId('keyboardDialog').showModal());

    byId('melodikControl').addEventListener('change', event => {
      const enabled = event.target.checked;
      const sound = emulator.setMelodikEnabled(enabled);
      localStorage.setItem(MELODIK_STORAGE_KEY, enabled ? '1' : '0');
      render(emulator.getStatus());
      setNotice(sound.enabled
        ? 'Melodik attached. AY software can use ports FFFDh and BFFDh.'
        : 'Melodik detached; this machine now uses the 1-bit beeper only.', 'success');
      focusMachine();
    });

    byId('volumeControl').addEventListener('input', event => {
      const hidden = document.querySelector('#v input[type="range"]');
      if (!hidden) return;
      hidden.value = String(Number(event.target.value));
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
    });

    byId('muteControl').addEventListener('change', event => {
      window.qaop.command('mute', event.target.checked);
    });

    byId('mouseEnabled').addEventListener('change', event => setMouseEnabled(event.target.checked));
    byId('mouseSensitivity').addEventListener('input', event => {
      mouseSensitivity = Math.max(25, Math.min(300, Number(event.target.value) || 100));
      localStorage.setItem(MOUSE_SENSITIVITY_STORAGE_KEY, String(mouseSensitivity));
      resetMouseFractions();
      renderMousePanel(emulator?.getStatus());
    });

    document.querySelector('.storage-panel').addEventListener('click', handleDriveAction);
    const storageTabs = Array.from(document.querySelectorAll('[data-storage-tab]'));
    for (const button of storageTabs) {
      button.addEventListener('click', () => setStorageTab(button.dataset.storageTab));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const index = storageTabs.indexOf(button);
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const next = storageTabs[(index + delta + storageTabs.length) % storageTabs.length];
        setStorageTab(next.dataset.storageTab);
        next.focus();
      });
    }
    for (const button of document.querySelectorAll('[data-browser-drive]')) {
      button.addEventListener('click', () => setBrowserDrive(Number(button.dataset.browserDrive)));
    }
    byId('fileFilter').addEventListener('input', renderFileBrowser);
    byId('downloadFileButton').addEventListener('click', downloadSelectedFile);

    byId('tapeInsert').addEventListener('click', () => byId('tapeFile').click());
    byId('tapeRewind').addEventListener('click', () => {
      if (!tapeImage?.blocks.length) return;
      setTapeHeadToBlock(0);
    });
    byId('tapeEject').addEventListener('click', ejectTape);
    byId('tapeFile').addEventListener('change', async event => {
      try {
        await loadTapeFromFile(event.target.files[0]);
      } catch (error) {
        console.error(error);
        setNotice(error.message || String(error), 'error');
      } finally {
        event.target.value = '';
      }
    });

    byId('printerConnection').addEventListener('change', event => {
      const requested = event.target.value;
      const connection = PRINTER_CONNECTION_OPTIONS.includes(requested) ? requested : 'didaktik-ab';
      const printer = emulator.setPrinterConnectionProfile(connection);
      localStorage.setItem(PRINTER_CONNECTION_STORAGE_KEY, connection);
      renderPrinterPanel();
      setNotice(`BT-100 connection set to ${printer.connectionLabel} (${printer.connectionShortLabel}).`);
    });

    byId('printerColor').addEventListener('change', event => {
      const color = event.target.value === 'blue' ? 'blue' : 'black';
      emulator.setPrinterCarbonColor(color);
      localStorage.setItem(PRINTER_COLOR_STORAGE_KEY, color);
      invalidatePrinterPreview();
      renderPrinterPanel();
      setNotice(`BT-100 carbon paper color set to ${color}.`);
    });

    byId('printerSpeed').addEventListener('change', event => {
      const requested = Number(event.target.value);
      const speed = PRINTER_SPEED_OPTIONS.includes(requested) ? requested : 1;
      emulator.setPrinterSpeedFactor(speed);
      localStorage.setItem(PRINTER_SPEED_STORAGE_KEY, String(speed));
      renderPrinterPanel();
      setNotice(`BT-100 speed set to ${speed}× of the base mechanical delay.`);
    });

    byId('printerDarkness').addEventListener('input', event => {
      printerView.darkness = Math.max(40, Math.min(100, Number(event.target.value) || 75));
      localStorage.setItem(PRINTER_DARKNESS_STORAGE_KEY, String(printerView.darkness));
      invalidatePrinterPreview();
      renderPrinterPanel();
    });

    byId('printerDotSize').addEventListener('input', event => {
      printerView.dotSize = Math.max(40, Math.min(260, Number(event.target.value) || 220));
      localStorage.setItem(PRINTER_DOT_SIZE_STORAGE_KEY, String(printerView.dotSize));
      invalidatePrinterPreview();
      renderPrinterPanel();
    });

    byId('printerRandomOffset').addEventListener('input', event => {
      printerView.randomOffset = Math.max(0, Math.min(50, Number(event.target.value) || 0));
      localStorage.setItem(PRINTER_RANDOM_OFFSET_STORAGE_KEY, String(printerView.randomOffset));
      invalidatePrinterPreview();
      renderPrinterPanel();
    });

    byId('printerRandomDots').addEventListener('change', event => {
      printerView.randomDots = event.target.checked;
      localStorage.setItem(PRINTER_RANDOM_DOTS_STORAGE_KEY, printerView.randomDots ? '1' : '0');
      invalidatePrinterPreview();
      renderPrinterPanel();
      setNotice(printerView.randomDots
        ? 'BT-100 randomized dot shapes enabled.'
        : 'BT-100 dots set to uniform rounded shapes.');
    });

    byId('printerNewPage').addEventListener('click', () => {
      emulator.newPrinterPage();
      renderPrinterPanel();
      setNotice('Inserted a fresh A4 sheet into the BT-100.', 'success');
    });

    byId('printerResetHead').addEventListener('click', () => {
      emulator.resetPrinterHead();
      renderPrinterPanel();
      setNotice('BT-100 head manually shifted back to the home position.', 'success');
    });

    byId('printerShiftLeft').addEventListener('click', () => { emulator.advancePrinterPaper(-2, 0); renderPrinterPanel(); });
    byId('printerShiftRight').addEventListener('click', () => { emulator.advancePrinterPaper(2, 0); renderPrinterPanel(); });
    byId('printerShiftUp').addEventListener('click', () => { emulator.advancePrinterPaper(0, -2); renderPrinterPanel(); });
    byId('printerShiftDown').addEventListener('click', () => { emulator.advancePrinterPaper(0, 2); renderPrinterPanel(); });
    byId('printerPrint').addEventListener('click', printBt100Page);
    byId('printerDownloadPng').addEventListener('click', downloadBt100Png);

    for (let index = 0; index < 2; index += 1) {
      byId(`${drivePrefix[index]}File`).addEventListener('change', async event => {
        try { await loadDiskFromFile(index, event.target.files[0]); }
        catch (error) {
          console.error(error);
          setNotice(error.message || String(error), 'error');
        } finally {
          event.target.value = '';
        }
      });
      byId(`${drivePrefix[index]}WriteProtect`).addEventListener('change', event => {
        emulator.setWriteProtected(index, event.target.checked);
        setNotice(`Drive ${index ? 'B' : 'A'} is ${event.target.checked ? 'write protected' : 'writable'}.`);
      });
    }
    bindDragAndDrop();
  }

  async function waitForMdosReady(timeoutMs = 15000) {
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      const status = emulator.getStatus();
      const cpu = window.__qaop.cpuCore.getState();
      const machineReady = cpu.sp >= 0x4000 && cpu.im === 1;
      if (status.initialized && !status.paged && status.controllerPhase === 'idle' && machineReady) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('MDOS did not finish its reset initialization in time.');
  }

  async function start() {
    try {
      bindControls();
      const savedMachine = localStorage.getItem(MACHINE_STORAGE_KEY);
      const machineId = ['didaktik80', 'didaktikM', 'didaktikKompakt', 'spectrum48', 'spectrum128'].includes(savedMachine)
        ? savedMachine : 'didaktik80';
      const melodikEnabled = localStorage.getItem(MELODIK_STORAGE_KEY) === '1';
      const storedPrinterSpeed = Number(localStorage.getItem(PRINTER_SPEED_STORAGE_KEY));
      const printerSpeed = PRINTER_SPEED_OPTIONS.includes(storedPrinterSpeed) ? storedPrinterSpeed : 1;
      const printerColor = localStorage.getItem(PRINTER_COLOR_STORAGE_KEY) === 'blue' ? 'blue' : 'black';
      const printerDarkness = Math.max(40, Math.min(100, Number(localStorage.getItem(PRINTER_DARKNESS_STORAGE_KEY)) || 75));
      const printerDotSize = Math.max(40, Math.min(260, Number(localStorage.getItem(PRINTER_DOT_SIZE_STORAGE_KEY)) || 220));
      const storedRandomOffsetValue = localStorage.getItem(PRINTER_RANDOM_OFFSET_STORAGE_KEY);
      const storedRandomOffset = storedRandomOffsetValue === null ? NaN : Number(storedRandomOffsetValue);
      const printerRandomOffset = Number.isFinite(storedRandomOffset)
        ? Math.max(0, Math.min(50, storedRandomOffset)) : 13;
      const storedRandomDots = localStorage.getItem(PRINTER_RANDOM_DOTS_STORAGE_KEY);
      const printerRandomDots = storedRandomDots === null ? true : storedRandomDots === '1';
      const storedPrinterConnection = localStorage.getItem(PRINTER_CONNECTION_STORAGE_KEY);
      const printerConnection = PRINTER_CONNECTION_OPTIONS.includes(storedPrinterConnection)
        ? storedPrinterConnection : 'didaktik-ab';
      mouseSensitivity = Math.max(25, Math.min(300, Number(localStorage.getItem(MOUSE_SENSITIVITY_STORAGE_KEY)) || 100));
      byId('machineSelect').value = machineId;
      byId('melodikControl').checked = melodikEnabled;
      byId('printerConnection').value = printerConnection;
      byId('printerSpeed').value = String(printerSpeed);
      byId('printerColor').value = printerColor;
      byId('printerDarkness').value = String(printerDarkness);
      byId('printerDarknessValue').textContent = `${printerDarkness}%`;
      byId('printerDotSize').value = String(printerDotSize);
      byId('printerDotSizeValue').textContent = `${printerDotSize}%`;
      byId('printerRandomOffset').value = String(printerRandomOffset);
      byId('printerRandomOffsetValue').textContent = `±${printerRandomOffset}%`;
      byId('printerRandomDots').checked = printerRandomDots;
      byId('mouseEnabled').checked = false;
      byId('mouseSensitivity').value = String(mouseSensitivity);
      byId('mouseSensitivityValue').textContent = `${mouseSensitivity}%`;
      printerView.darkness = printerDarkness;
      printerView.dotSize = printerDotSize;
      printerView.randomOffset = printerRandomOffset;
      printerView.randomDots = printerRandomDots;
      emulator = await window.createDidaktikD80({
        driveAUrl: 'disks/036-KOMPAKT.d80',
        machineId,
        melodikEnabled
      });
      // The standalone UI uses clean browser resampling. Do not inherit QAOP's
      // optional CRT distortion from settings saved by another QAOP page.
      window.qaop.set({ crt: false });
      emulator.setKempstonMouseEnabled(false);
      mouseEnabled = false;
      emulator.setPrinterConnectionProfile(printerConnection);
      emulator.setPrinterSpeedFactor(printerSpeed);
      emulator.setPrinterCarbonColor(printerColor);
      emulator.onChange(render);
      setSnapEnabled(false);
      setNotice('MDOS is initializing the two-drive subsystem…');
      await waitForMdosReady();
      setSnapEnabled(true);
      setNotice(`${emulator.getMachineProfile().label} is ready. MDOS is resident and 036-KOMPAKT.d80 is mounted in drive A.`, 'success');
      renderFileBrowser();
      renderTapeBrowser();
      renderPrinterPanel();
      renderMousePanel();
      window.setInterval(() => emulator && render(emulator.getStatus()), 200);
      focusMachine();
    } catch (error) {
      console.error(error);
      byId('systemStatus').textContent = 'Startup failed';
      byId('systemStatus').className = 'status-badge status-badge--active';
      setNotice(error.message || String(error), 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
