#!/usr/bin/env python3
"""Busy soft BT-100 timing regression using the original C-2 test utility."""

from pathlib import Path
import mimetypes

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print('SKIP: Python Playwright is not installed.')
    raise SystemExit(0)

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).resolve().parent / 'fixtures'

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


def tap_payloads(path: Path) -> list[bytes]:
    source = path.read_bytes()
    blocks: list[bytes] = []
    cursor = 0
    while cursor + 2 <= len(source):
        length = source[cursor] | (source[cursor + 1] << 8)
        cursor += 2
        block = source[cursor:cursor + length]
        if len(block) != length:
            raise AssertionError(f'truncated TAP block in {path.name}')
        cursor += length
        if len(block) >= 2:
            blocks.append(block[1:-1])  # omit TAP flag and XOR checksum
    return blocks


code = list(tap_payloads(FIXTURES / 'BT-BCS.TAP')[3])
text = list(tap_payloads(FIXTURES / 'BT-TST.TAP')[1])
assert len(code) == 1229
assert len(text) == 1856

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
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors: list[str] = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def serve(route) -> None:
        relative = route.request.url[len('https://d80.test/'):].split('?', 1)[0] or 'index.html'
        path = (ROOT / relative).resolve()
        route.fulfill(
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
        "window.__qaop && window.didaktikD80 && document.getElementById('snapButton').dataset.ready === 'true'",
        timeout=30_000,
    )
    page.evaluate('__qaop.setPaused(true)')
    page.evaluate("""([driver, documentBytes]) => {
      driver.forEach((value, index) => __qaop.pokeMemoryRaw(0x8000 + index, value));
      documentBytes.forEach((value, index) => __qaop.pokeMemoryRaw(0x8ca0 + index, value));
      didaktikD80.setPrinterConnectionProfile('ur4-c');
      didaktikD80.setPrinterSpeedFactor(1);
    }""", [code, text])

    def call(address: int, max_chunks: int = 20) -> int:
        page.evaluate("""address => {
          [0xcd, address & 0xff, address >> 8, 0x76].forEach(
            (value, offset) => __qaop.pokeMemoryRaw(0x6000 + offset, value)
          );
          const state = __qaop.cpuCore.getState();
          state.pc = 0x6000;
          state.halt = false;
          state.sp = 0x7ff0;
          state.iff = 0;
          __qaop.cpuCore.setState(state);
          __qaop.machineBus.int = -1;
        }""", address)
        for chunk in range(max_chunks):
            result = page.evaluate("""cycles => {
              const bus = __qaop.machineBus;
              bus.limit = bus.time + cycles;
              __qaop.cpuCore.run();
              const state = __qaop.cpuCore.getState();
              return { pc: state.pc, halt: state.halt };
            }""", 10_000_000)
            if result['halt'] and result['pc'] == 0x6004:
                return chunk + 1
        raise AssertionError(f'BT-BCS call {address:04X} did not return: {result}')

    def print_line(line: int) -> dict:
        page.evaluate("""line => {
          didaktikD80.newPrinterPage();
          __qaop.pokeMemoryRaw(0x5c76, line & 0xff);
          __qaop.pokeMemoryRaw(0x5c77, line >> 8);
        }""", line)
        call(0x8000, max_chunks=2)
        chunks = call(0x8002)
        return page.evaluate("""chunks => {
          const dots = didaktikD80.printer.printedDots;
          const xs = dots.map(dot => dot.x);
          const ys = dots.map(dot => dot.y);
          const fractions = new Set(xs.map(x => Math.round((x - Math.floor(x)) * 65536)));
          const rows = {};
          for (const dot of dots) (rows[dot.y] ||= []).push(dot.x);
          for (const values of Object.values(rows)) values.sort((a, b) => a - b);
          return {
            chunks,
            count: dots.length,
            minX: Math.min(...xs), maxX: Math.max(...xs),
            minY: Math.min(...ys), maxY: Math.max(...ys),
            rowCount: new Set(ys).size,
            fractionalPositions: fractions.size,
            rows,
            bitmap: Array.from({ length: 0x400 }, (_, index) => __qaop.peekMemoryRaw(0x854d + index)),
            status: didaktikD80.getStatus().printer,
          };
        }""", chunks)

    miniature = print_line(6)   # bidirectional miniature mode
    browser.close()

assert not errors, errors
for label, result in [('miniature', miniature)]:
    assert result['chunks'] < 20, (label, result)
    assert 700 < result['count'] < 1000, (label, result)
    assert result['maxX'] - result['minX'] > 200, (label, result)
    assert result['minY'] >= 1 and result['maxY'] == 8, (label, result)
    assert result['rowCount'] == 8, (label, result)
    assert result['fractionalPositions'] > 20, (label, result)
    assert result['status']['dotCount'] == result['count']
    assert result['status']['headX'] == 0
    assert result['status']['motorDirection'] == 0
    assert result['status']['internalStepsPerPitch'] == 65536

    # The generated 1024-bit miniature raster occupies eight 128-byte planes.
    # Each set bit is half an optical pitch apart. Compare physical strikes
    # against that raster; counting dots alone allowed a one-pitch direction
    # indexing error to pass while the text remained unreadable.
    maximum_position_error = 0.0
    for row_index in range(8):
        expected_positions: list[float] = []
        plane = result['bitmap'][row_index * 128:(row_index + 1) * 128]
        for byte_index, value in enumerate(plane):
            for bit_index in range(8):
                if value & (0x80 >> bit_index):
                    expected_positions.append(byte_index * 4 + bit_index * 0.5)
        actual_positions = result['rows'].get(str(row_index + 1), [])
        assert len(actual_positions) == len(expected_positions), (
            label, row_index + 1, len(actual_positions), len(expected_positions)
        )
        for actual, expected in zip(actual_positions, expected_positions):
            maximum_position_error = max(maximum_position_error, abs(actual - expected))
    # A real finite notch intentionally moves opposite-direction timing away
    # from the ideal zero-width bitmap grid. Keep the error below half a pitch;
    # the former C-2 cell-numbering defect was close to two full pitches.
    assert maximum_position_error < 0.50, (label, maximum_position_error)

print(
    'Busy soft BT-100 regression passed: '
    f'miniature {miniature["count"]} dots; '
    f'maximum raster error {maximum_position_error:.3f} pitch; '
    'the real driver returned home with sub-pitch strike timing preserved.'
)
