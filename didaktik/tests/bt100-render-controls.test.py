#!/usr/bin/env python3
"""Focused Chromium test for live BT-100 dot-rendering controls."""

from pathlib import Path
import mimetypes

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print('SKIP: Python Playwright is not installed.')
    raise SystemExit(0)

ROOT = Path(__file__).resolve().parents[1]
MOCK_STORAGE = r'''<script>
const __ls = new Map();
Object.defineProperty(window, 'localStorage', { value: {
  getItem: key => __ls.get(key) ?? null,
  setItem: (key, value) => __ls.set(key, String(value)),
  removeItem: key => __ls.delete(key), clear: () => __ls.clear(),
  key: index => Array.from(__ls.keys())[index] ?? null,
  get length() { return __ls.size; }
}});
const __records = [];
const __request = value => { const request = {}; queueMicrotask(() => {
  request.result = value; request.onsuccess?.({ target: request });
}); return request; };
const __store = { getAll: () => __request(__records), put: value => {
  __records.push(value); return __request(value);
}, delete: () => __request(undefined) };
const __db = { transaction: () => { const tx = { objectStore: () => __store };
  queueMicrotask(() => tx.oncomplete?.()); return tx;
}, createObjectStore: () => __store };
Object.defineProperty(window, 'indexedDB', { value: { open: () => __request(__db) }});
</script>'''

with sync_playwright() as playwright:
    executable = Path('/usr/bin/chromium')
    if not executable.exists():
        print('SKIP: /usr/bin/chromium is not available.')
        raise SystemExit(0)

    browser = playwright.chromium.launch(
        headless=True,
        executable_path=str(executable),
        args=['--no-sandbox'],
    )
    page = browser.new_page(viewport={'width': 1400, 'height': 1000})
    page_errors = []
    console_errors = []
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)

    def serve(route):
        url = route.request.url
        if not url.startswith('https://d80.test/'):
            return route.abort()
        relative = url[len('https://d80.test/'):].split('?', 1)[0].split('#', 1)[0] or 'index.html'
        path = (ROOT / relative).resolve()
        try:
            path.relative_to(ROOT.resolve())
        except ValueError:
            return route.abort()
        if path.is_dir():
            path = path / 'index.html'
        if not path.exists():
            return route.fulfill(status=404, body='not found')
        return route.fulfill(
            status=200,
            body=path.read_bytes(),
            content_type=mimetypes.guess_type(str(path))[0] or 'application/octet-stream',
        )

    page.route('https://d80.test/**', serve)
    html = (ROOT / 'index.html').read_text(encoding='utf-8').replace(
        '<head>', '<head><base href="https://d80.test/">' + MOCK_STORAGE, 1
    )
    page.set_content(html, wait_until='domcontentloaded', timeout=30_000)
    page.wait_for_function(
        "window.didaktikD80 && document.getElementById('printerPreview')",
        timeout=30_000,
    )

    initial = page.evaluate("""async () => {
      didaktikD80.printer.fireDot();
      const dot = didaktikD80.printer.printedDots[0];
      dot.jitterX = 1;
      dot.jitterY = 1;
      dot.opacity = 0.9;
      didaktikD80.scheduleNotify();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        image: document.getElementById('printerPreview').toDataURL(),
        randomDots: document.getElementById('printerRandomDots').checked,
        darknessVariability: document.getElementById('printerDarknessVariabilityValue').textContent,
        dotSize: document.getElementById('printerDotSizeValue').textContent,
        paperColor: document.getElementById('printerPaperColor').value,
        paperColorText: document.getElementById('printerPaperColorValue').textContent,
        inkColor: document.getElementById('printerInkColor').value,
        inkColorText: document.getElementById('printerInkColorValue').textContent,
        notchSize: document.getElementById('printerNotchSizeValue').textContent,
        randomOffset: document.getElementById('printerRandomOffsetValue').textContent,
        darkness: document.getElementById('printerDarknessValue').textContent,
        connection: document.getElementById('printerConnection').value,
        connectionHelp: document.getElementById('printerConnectionHelp').textContent,
        connectionOptions: document.getElementById('printerConnection').options.length
      };
    }""")
    assert initial['randomDots'] is True
    assert initial['darkness'] == '75%'
    assert initial['darknessVariability'] == '33%'
    assert initial['dotSize'] == '110%'
    assert initial['paperColor'] == '#ffffff'
    assert initial['paperColorText'] == '#FFFFFF'
    assert initial['inkColor'] == '#3f3936'
    assert initial['inkColorText'] == '#3F3936'
    assert initial['notchSize'] == '20%'
    assert initial['randomOffset'] == '±11%'
    assert initial['connection'] == 'didaktik-ab'
    assert initial['connectionOptions'] == 5
    assert 'PA4' in initial['connectionHelp'] and 'PB0' in initial['connectionHelp']

    result = page.evaluate("""async initialImage => {
      const changeRange = async (id, value) => {
        const input = document.getElementById(id);
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return document.getElementById('printerPreview').toDataURL();
      };
      const changeColor = async (id, value) => {
        const input = document.getElementById(id);
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return document.getElementById('printerPreview').toDataURL();
      };
      const paperImage = await changeColor('printerPaperColor', '#f0d090');
      const inkImage = await changeColor('printerInkColor', '#c02080');
      const darknessImage = await changeRange('printerDarkness', 40);
      const variabilityImage = await changeRange('printerDarknessVariability', 80);
      const sizeImage = await changeRange('printerDotSize', 100);
      const notchImage = await changeRange('printerNotchSize', 60);
      const offsetImage = await changeRange('printerRandomOffset', 50);
      const randomDots = document.getElementById('printerRandomDots');
      randomDots.checked = false;
      randomDots.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const roundedImage = document.getElementById('printerPreview').toDataURL();
      const uniformRoundedImage = await changeRange('printerDarknessVariability', 0);
      const connection = document.getElementById('printerConnection');
      connection.value = 'ur4-c';
      connection.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const connectionStatus = didaktikD80.getStatus().printer;
      return {
        paperImageChanged: paperImage !== initialImage,
        inkImageChanged: inkImage !== paperImage,
        darknessImageChanged: darknessImage !== inkImage,
        variabilityImageChanged: variabilityImage !== darknessImage,
        sizeImageChanged: sizeImage !== variabilityImage,
        notchImageChanged: notchImage !== sizeImage,
        offsetImageChanged: offsetImage !== notchImage,
        roundedImageChanged: roundedImage !== offsetImage,
        roundedVariabilityChanged: uniformRoundedImage !== roundedImage,
        paperColor: document.getElementById('printerPaperColor').value,
        inkColor: document.getElementById('printerInkColor').value,
        darknessValue: document.getElementById('printerDarknessValue').textContent,
        variabilityValue: document.getElementById('printerDarknessVariabilityValue').textContent,
        sizeValue: document.getElementById('printerDotSizeValue').textContent,
        notchValue: document.getElementById('printerNotchSizeValue').textContent,
        offsetValue: document.getElementById('printerRandomOffsetValue').textContent,
        randomDotsChecked: randomDots.checked,
        storedPaperColor: localStorage.getItem('didaktik-d80.bt100-paper-color'),
        storedInkColor: localStorage.getItem('didaktik-d80.bt100-ink-color'),
        storedDarkness: localStorage.getItem('didaktik-d80.bt100-darkness'),
        storedVariability: localStorage.getItem('didaktik-d80.bt100-darkness-variability'),
        storedSize: localStorage.getItem('didaktik-d80.bt100-dot-size'),
        storedNotch: localStorage.getItem('didaktik-d80.bt100-notch-size'),
        storedOffset: localStorage.getItem('didaktik-d80.bt100-random-offset'),
        storedRandomDots: localStorage.getItem('didaktik-d80.bt100-random-dots'),
        connectionValue: connection.value,
        connectionHelp: document.getElementById('printerConnectionHelp').textContent,
        connectionStatusId: connectionStatus.connectionId,
        connectionControlWord: connectionStatus.controlWord,
        storedConnection: localStorage.getItem('didaktik-d80.bt100-connection')
      };
    }""", initial['image'])

    assert result['paperImageChanged']
    assert result['inkImageChanged']
    assert result['darknessImageChanged']
    assert result['variabilityImageChanged']
    assert result['sizeImageChanged']
    assert result['notchImageChanged']
    assert result['offsetImageChanged']
    assert result['roundedImageChanged']
    assert result['roundedVariabilityChanged']
    assert result['paperColor'] == '#f0d090'
    assert result['inkColor'] == '#c02080'
    assert result['darknessValue'] == '40%'
    assert result['variabilityValue'] == '0%'
    assert result['sizeValue'] == '100%'
    assert result['notchValue'] == '60%'
    assert result['offsetValue'] == '±50%'
    assert result['randomDotsChecked'] is False
    assert result['storedPaperColor'] == '#f0d090'
    assert result['storedInkColor'] == '#c02080'
    assert result['storedDarkness'] == '40'
    assert result['storedVariability'] == '0'
    assert result['storedSize'] == '100'
    assert result['storedNotch'] == '60'
    assert result['storedOffset'] == '50'
    assert result['storedRandomDots'] == '0'
    assert result['connectionValue'] == 'ur4-c'
    assert 'PC0' in result['connectionHelp'] and 'PC7' in result['connectionHelp']
    assert result['connectionStatusId'] == 'ur4-c'
    assert result['connectionControlWord'] == 0x9A
    assert result['storedConnection'] == 'ur4-c'
    assert not page_errors, page_errors
    assert not console_errors, console_errors

    browser.close()
    print('Focused Chromium BT-100 rendering-controls test passed.')
