#!/usr/bin/env python3
"""Focused Chromium integration test for physical host-key mapping."""

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
    page = browser.new_page(viewport={'width': 1200, 'height': 800})
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
        "window.__qaop && __qaop.handleKey && __qaop.driveKeyboardMatrix && document.getElementById('f')",
        timeout=30_000,
    )

    result = page.evaluate("""() => {
      const canvas = document.getElementById('f');
      const event = (type, key, code, legacy) => ({
        type, key, code, which: legacy, keyCode: legacy, target: canvas,
        repeat: false, altKey: false, metaKey: false, ctrlKey: false, shiftKey: false,
        timeStamp: performance.now(), getModifierState: () => false,
        preventDefault() { this.defaultPrevented = true; }
      });
      const expected = legacy => {
        __qaop.driveKeyboardMatrix(~legacy, true, 0);
        const rows = Array.from(__qaop.keyMatrixRows);
        __qaop.driveKeyboardMatrix();
        return rows;
      };
      const allReleased = Array(8).fill(255);
      const expectedY = expected(89);
      const expectedZ = expected(90);
      const expectedQ = expected(81);

      __qaop.handleKey(event('keydown', 'z', 'KeyY', 90));
      const qwertzZPosition = Array.from(__qaop.keyMatrixRows);
      __qaop.handleKey(event('keyup', 'z', 'KeyY', 90));
      const qwertzZReleased = Array.from(__qaop.keyMatrixRows);

      __qaop.handleKey(event('keydown', 'y', 'KeyZ', 89));
      const qwertzYPosition = Array.from(__qaop.keyMatrixRows);
      __qaop.handleKey(event('keyup', 'y', 'KeyZ', 89));
      const qwertzYReleased = Array.from(__qaop.keyMatrixRows);

      __qaop.handleKey(event('keydown', 'a', 'KeyQ', 65));
      const azertyAPosition = Array.from(__qaop.keyMatrixRows);
      __qaop.handleKey(event('keyup', 'a', 'KeyQ', 65));
      const azertyAReleased = Array.from(__qaop.keyMatrixRows);

      return {
        expectedY, expectedZ, expectedQ, allReleased,
        qwertzZPosition, qwertzZReleased,
        qwertzYPosition, qwertzYReleased,
        azertyAPosition, azertyAReleased
      };
    }""")

    assert result['qwertzZPosition'] == result['expectedY']
    assert result['qwertzYPosition'] == result['expectedZ']
    assert result['azertyAPosition'] == result['expectedQ']
    assert result['qwertzZReleased'] == result['allReleased']
    assert result['qwertzYReleased'] == result['allReleased']
    assert result['azertyAReleased'] == result['allReleased']
    assert not page_errors, page_errors
    assert not console_errors, console_errors

    browser.close()
    print('Focused Chromium physical-keyboard test passed.')
