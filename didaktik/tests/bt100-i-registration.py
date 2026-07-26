#!/usr/bin/env python3
"""Focused BT-100 V1.1 registration test using LPRINT "I"."""

from pathlib import Path
import mimetypes

from playwright.sync_api import sync_playwright

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


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path='/usr/bin/chromium',
            args=['--no-sandbox']
        )
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        errors: list[str] = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        def serve(route) -> None:
            relative = route.request.url[len('https://d80.test/'):].split('?', 1)[0] or 'index.html'
            path = (ROOT / relative).resolve()
            route.fulfill(
                status=200,
                body=path.read_bytes(),
                content_type=mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
            )

        page.route('https://d80.test/**', serve)
        html = (ROOT / 'index.html').read_text(encoding='utf-8').replace(
            '<head>', '<head><base href="https://d80.test/">' + MOCK_STORAGE, 1
        )
        page.set_content(html, wait_until='domcontentloaded', timeout=30_000)
        page.wait_for_function(
            "window.didaktikD80 && document.getElementById('snapButton').dataset.ready === 'true'",
            timeout=30_000
        )
        page.evaluate("""() => {
          const disk = didaktikD80.drives[0].disk;
          const entry = disk.getCatalog().files.find(file => file.displayName.toLowerCase() === 'bt1.b');
          const bytes = disk.extractFile(entry);
          bytes.forEach((value, offset) => __qaop.pokeMemoryRaw(0xfa00 + offset, value));
          didaktikD80.newPrinterPage();
          didaktikD80.setPrinterSpeedFactor(1);
        }""")

        def call(address: int, accumulator: int | None = None, timeout: int = 180_000) -> None:
            page.evaluate("""([address, accumulator]) => {
              [0xcd, address & 0xff, address >> 8, 0x76].forEach(
                (value, offset) => __qaop.pokeMemoryRaw(0x6000 + offset, value)
              );
              const state = __qaop.cpuCore.getState();
              state.pc = 0x6000;
              state.halt = false;
              if (accumulator !== null) state.a = accumulator;
              __qaop.cpuCore.setState(state);
            }""", [address, accumulator])
            page.wait_for_function(
                "() => { const state = __qaop.cpuCore.getState(); return state.halt && state.pc === 0x6004; }",
                timeout=timeout
            )

        call(0xfa00, timeout=30_000)
        call(0xfaf2, ord('I'), timeout=30_000)
        call(0xfaf2, 13, timeout=240_000)

        result = page.evaluate("""() => {
          const rows = {};
          for (const dot of didaktikD80.printer.printedDots) (rows[dot.y] ||= []).push(dot.x);
          for (const values of Object.values(rows)) values.sort((a, b) => a - b);
          return { rows, status: didaktikD80.getStatus().printer };
        }""")
        browser.close()

    assert not errors, errors
    assert result['status']['dotCount'] == 20
    assert result['status']['headX'] == 0
    expected = {'2': 6, '4': 2, '6': 2, '8': 2, '10': 2, '12': 6}
    assert {key: len(value) for key, value in result['rows'].items()} == expected

    for values in result['rows'].values():
        for left, right in zip(values, values[1:]):
            assert 0.90 < right - left < 1.10, values

    offsets: list[float] = []
    for first, second in [('2', '12'), ('4', '6'), ('8', '10')]:
        for left, right in zip(result['rows'][first], result['rows'][second]):
            offset = abs(left - right)
            assert 0.35 < offset < 0.65, (first, second, left, right)
            offsets.append(offset)

    print(
        'BT-100 LPRINT "I" registration passed: '
        f'{result["status"]["dotCount"]} dots, '
        f'opposite-scan offset {min(offsets):.3f}-{max(offsets):.3f} pitch.'
    )


if __name__ == '__main__':
    main()
