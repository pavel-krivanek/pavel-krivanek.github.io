#!/usr/bin/env python3
"""Focused Chromium regression for the BT-BCS C-2 return-to-origin handshake."""

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
    page = browser.new_page(viewport={'width': 1200, 'height': 900})
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
        "window.didaktikD80 && window.__qaop && document.getElementById('snapButton').dataset.ready === 'true'",
        timeout=30_000,
    )

    page.evaluate("""() => {
      didaktikD80.setPrinterConnectionProfile('ur4-c');
      didaktikD80.setPrinterSpeedFactor(100);

      const printer = didaktikD80.printer;
      printer.headPosition = 0.30;
      printer.headX = 0.30;
      printer.resetMechanicalClock();

      // Exact C-2 return-side fine-encoder handshake used by BT-BCS at
      // 82B8h..82D7h: wait for PC7 low, then PC7 high, stop, and return.
      const program = [
        0xf3,                   // DI
        0x3e, 0x9a,            // LD A,9Ah: C-2 8255 mode
        0xd3, 0x7f,            // OUT (7Fh),A
        0x3e, 0xf7,            // LD A,F7h: carriage toward home (PC3 low)
        0xd3, 0x5f,            // OUT (5Fh),A
        0xdb, 0x5f,            // low:  IN A,(5Fh)
        0xe6, 0x80,            //       AND 80h
        0x20, 0xfa,            //       JR NZ,low
        0xdb, 0x5f,            // high: IN A,(5Fh)
        0xe6, 0x80,            //       AND 80h
        0x28, 0xfa,            //       JR Z,high
        0x3e, 0xff,            //       LD A,FFh
        0xd3, 0x5f,            //       OUT (5Fh),A
        0x76                    //       HALT
      ];
      program.forEach((value, offset) => __qaop.pokeMemoryRaw(0x6000 + offset, value));

      const state = __qaop.cpuCore.getState();
      state.pc = 0x6000;
      state.halt = false;
      __qaop.cpuCore.setState(state);
    }""")

    page.wait_for_function(
        "() => { const s = __qaop.cpuCore.getState(); return s.halt && s.pc === 0x601a; }",
        timeout=10_000,
    )

    result = page.evaluate("""() => ({
      cpu: __qaop.cpuCore.getState(),
      mechanicalX: didaktikD80.printer.headPosition,
      printer: didaktikD80.getStatus().printer
    })""")

    assert result['mechanicalX'] < 0, result
    assert result['printer']['headX'] == 0, result
    assert result['printer']['motorDirection'] == 0, result
    assert result['printer']['portC'] & 0x80 == 0x80, result  # PC7 rose again
    assert result['printer']['portC'] & 0x20 == 0x20, result  # PC5 home remains active
    assert not page_errors, page_errors
    assert not console_errors, console_errors

    browser.close()
    print('Focused Chromium BT-100 C-2 return-to-origin test passed.')
