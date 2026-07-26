#!/usr/bin/env python3
"""Optional browser integration test. Requires Python Playwright and Chromium."""

from pathlib import Path
import json
import mimetypes
import sys

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
    executable = '/usr/bin/chromium'
    if not Path(executable).exists():
        print('SKIP: /usr/bin/chromium is not available.')
        raise SystemExit(0)

    browser = playwright.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
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

    initial = page.evaluate("""() => ({
      notice: document.getElementById('notice').textContent,
      canvas: [s.width, s.height],
      status: didaktikD80.getStatus(),
      cpu: __qaop.cpuCore.getState()
    })""")

    layout = page.evaluate("""() => {
      const panel = document.querySelector('.control-panel');
      const emulator = document.querySelector('.emulator-pane');
      return {
        viewportHeight: innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight,
        panelHeight: panel.getBoundingClientRect().height,
        panelScrollHeight: panel.scrollHeight,
        panelOverflowY: getComputedStyle(panel).overflowY,
        emulatorBottom: emulator.getBoundingClientRect().bottom,
        machineLabelSize: parseFloat(getComputedStyle(document.querySelector('.machine-selector')).fontSize),
        browserTableSize: parseFloat(getComputedStyle(document.querySelector('.browser-table')).fontSize)
      };
    }""")

    page.check('#melodikControl')
    page.wait_for_function("window.qaop.state.ay && didaktikD80.getStatus().sound.melodikEnabled")
    melodik = page.evaluate("""() => {
      __qaop.machineBus.out(0xfffd, 0);
      __qaop.machineBus.out(0xbffd, 0x34);
      __qaop.machineBus.out(0xfffd, 0);
      const state = qaop.state;
      return {
        controlChecked: document.getElementById('melodikControl').checked,
        controlDisabled: document.getElementById('melodikControl').disabled,
        badge: document.getElementById('soundStatus').textContent,
        ayRegister0: state.ay.reg[0],
        ayRead0: __qaop.machineBus.in(0xfffd) & 0xff,
        stored: localStorage.getItem('didaktik-d80.melodik'),
        sound: didaktikD80.getStatus().sound
      };
    }""")

    page.click('#filesTab')
    page.wait_for_function("document.querySelectorAll('#imageFileRows tr').length > 100")
    page.click('#imageFileRows tr')
    browser_view = page.evaluate("""() => ({
      activeTab: document.getElementById('filesTab').getAttribute('aria-selected'),
      fileCount: document.querySelectorAll('#imageFileRows tr').length,
      firstName: document.querySelector('#imageFileRows tr td').textContent,
      selectedName: document.getElementById('selectedFileName').textContent,
      downloadEnabled: !document.getElementById('downloadFileButton').disabled,
      catalogCount: didaktikD80.drives[0].disk.getCatalog().files.length
    })""")

    page.click('#drivesTab')
    page.evaluate("""async () => {
      const response = await fetch('disks/036-KOMPAKT.d80');
      const file = new File([await response.arrayBuffer()], 'dropped-copy.d80', { type: 'application/octet-stream' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      document.querySelector('.drive-card[data-drive="1"]').dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer: transfer
      }));
    }""")
    page.wait_for_function("didaktikD80.drives[1].disk && didaktikD80.drives[1].disk.fileName === 'dropped-copy.d80'")
    page.click('#filesTab')
    page.click('#browserDriveB')
    page.wait_for_function("document.querySelectorAll('#imageFileRows tr').length > 100")
    drag_drop = page.evaluate("""() => ({
      driveBName: didaktikD80.drives[1].disk.fileName,
      fileCount: document.querySelectorAll('#imageFileRows tr').length,
      activeDrive: document.getElementById('browserDriveB').getAttribute('aria-pressed')
    })""")

    page.click('#drivesTab')
    page.click('#snapButton')
    page.wait_for_function('didaktikD80.drives[0].disk.dirty', timeout=15_000)
    page.wait_for_function('!didaktikD80.paged && didaktikD80.controller.phase === "idle"', timeout=15_000)
    snapshot = page.evaluate("""() => ({
      dirty: didaktikD80.drives[0].disk.dirty,
      counter: didaktikD80.memory[0x3e61],
      paged: didaktikD80.paged
    })""")

    memory = page.evaluate("""() => {
      didaktikD80.pageIn();
      __qaop.rebuildBusHandlers();
      __qaop.pokeMemoryRaw(0x3800, 0x5a);
      const ram = __qaop.peekMemoryRaw(0x3800);
      const before = __qaop.peekMemoryRaw(0x0100);
      __qaop.pokeMemoryRaw(0x0100, before ^ 0xff);
      const romProtected = __qaop.peekMemoryRaw(0x0100) === before;
      didaktikD80.pageOut();
      __qaop.rebuildBusHandlers();
      return { ram, romProtected };
    }""")


    bank_switching = page.evaluate("""() => {
      didaktikD80.pageOut();
      __qaop.rebuildBusHandlers();
      __qaop.machineBus.out(0x007f, 0);
      __qaop.pokeMemoryRaw(0x4000, 0x44);
      __qaop.pokeMemoryRaw(0x8000, 0x10);
      __qaop.pokeMemoryRaw(0xc000, 0x20);
      __qaop.machineBus.out(0x127f, 3);
      const fixedInBank1 = __qaop.peekMemoryRaw(0x4000);
      const bank1Before = [__qaop.peekMemoryRaw(0x8000), __qaop.peekMemoryRaw(0xc000)];
      __qaop.pokeMemoryRaw(0x8000, 0x11);
      __qaop.pokeMemoryRaw(0xc000, 0x21);
      __qaop.machineBus.out(0x007f, 0);
      const bank0 = [__qaop.peekMemoryRaw(0x8000), __qaop.peekMemoryRaw(0xc000)];
      __qaop.machineBus.out(0x007f, 1);
      const bank1 = [__qaop.peekMemoryRaw(0x8000), __qaop.peekMemoryRaw(0xc000)];
      return { fixedInBank1, bank1Before, bank0, bank1, state: __qaop.getMachineBankState() };
    }""")

    page.click('#resetButton')
    page.wait_for_function("__qaop.getMachineBankState().profile === 'didaktik80' && __qaop.getMachineBankState().bank === 0")
    page.wait_for_function("document.getElementById('snapButton').dataset.ready === 'true'", timeout=30_000)
    reset_bank = page.evaluate("() => __qaop.getMachineBankState()")

    machine_profiles = []
    for machine_id in ['didaktikM', 'didaktikKompakt', 'spectrum48', 'spectrum128', 'didaktik80']:
        page.select_option('#machineSelect', machine_id)
        page.wait_for_function(
            "id => window.didaktikD80.currentMachineId === id && !document.getElementById('machineSelect').disabled",
            arg=machine_id, timeout=30_000
        )
        page.wait_for_function("document.getElementById('snapButton').dataset.ready === 'true'", timeout=30_000)
        machine_profiles.append(page.evaluate("""() => ({
          id: didaktikD80.currentMachineId,
          label: document.getElementById('machineSelect').selectedOptions[0].textContent,
          profile: __qaop.getMachineMemoryProfile(),
          bank: didaktikD80.getStatus().machine.bank,
          bundledRom: didaktikD80.getStatus().machine.bundledRom,
          romSignature: Array.from({length: 24}, (_, offset) => __qaop.peekMemoryRaw(0x1538 + offset)),
          driveA: didaktikD80.drives[0].disk.fileName,
          sound: didaktikD80.getStatus().sound,
          ayActive: !!qaop.state.ay,
          melodikChecked: document.getElementById('melodikControl').checked,
          melodikDisabled: document.getElementById('melodikControl').disabled,
          soundBadge: document.getElementById('soundStatus').textContent
        })"""))

    page.uncheck('#melodikControl')
    page.wait_for_function("!window.qaop.state.ay && !didaktikD80.getStatus().sound.melodikEnabled")
    melodik_off = page.evaluate("""() => ({
      ayActive: !!qaop.state.ay,
      checked: document.getElementById('melodikControl').checked,
      badge: document.getElementById('soundStatus').textContent,
      stored: localStorage.getItem('didaktik-d80.melodik')
    })""")

    # Extract the real BT-100 V1.1 driver from the mounted MDOS image and use
    # LPRINT "I" as a registration test. Its six-dot caps and two-dot stem make
    # alternate-direction whole-column errors immediately measurable.
    page.evaluate("""() => {
      const disk = didaktikD80.drives[0].disk;
      const entry = disk.getCatalog().files.find(file => file.displayName.toLowerCase() === 'bt1.b');
      if (!entry) throw new Error('bt1.B is missing from the sample D80 image.');
      const bytes = disk.extractFile(entry);
      bytes.forEach((value, offset) => __qaop.pokeMemoryRaw(0xfa00 + offset, value));
      didaktikD80.newPrinterPage();
      didaktikD80.setPrinterSpeedFactor(1);
    }""")

    def call_bt100(address, accumulator=None, timeout=15_000):
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

    call_bt100(0xfa00, timeout=15_000)
    call_bt100(0xfaf2, ord('I'))
    call_bt100(0xfaf2, 13, timeout=60_000)
    bt100 = page.evaluate("""() => {
      const rows = {};
      for (const dot of didaktikD80.printer.printedDots) (rows[dot.y] ||= []).push(dot.x);
      for (const values of Object.values(rows)) values.sort((a, b) => a - b);
      return {
        cpu: __qaop.cpuCore.getState(),
        printer: didaktikD80.getStatus().printer,
        rows,
        privateState: Array.from({length: 8}, (_, offset) => __qaop.peekMemoryRaw(0x5bf8 + offset))
      };
    })""")



    result = {
        'initial': initial,
        'layout': layout,
        'melodik': melodik,
        'melodikOff': melodik_off,
        'bt100': bt100,
        'browserView': browser_view,
        'dragDrop': drag_drop,
        'memory': memory,
        'snapshot': snapshot,
        'bankSwitching': bank_switching,
        'resetBank': reset_bank,
        'machineProfiles': machine_profiles,
        'pageErrors': page_errors,
        'consoleErrors': console_errors,
    }
    print(json.dumps(result, indent=2))

    assert initial['status']['initialized']
    assert layout['documentHeight'] <= layout['viewportHeight']
    assert layout['bodyHeight'] <= layout['viewportHeight']
    assert layout['emulatorBottom'] <= layout['viewportHeight']
    assert layout['panelOverflowY'] == 'auto'
    assert layout['machineLabelSize'] >= 13
    assert layout['browserTableSize'] >= 10.5
    assert not initial['status']['paged']
    assert initial['status']['drives'][0]['disk']['byteLength'] == 737_280
    assert initial['status']['sound'] == {
        'melodikAvailable': True, 'melodikEnabled': False, 'melodikRequested': False,
        'builtInAy': False, 'ayEnabled': False
    }
    assert initial['canvas'][0] and initial['canvas'][1]
    assert melodik['controlChecked'] and not melodik['controlDisabled']
    assert melodik['badge'] == 'Melodik AY'
    assert melodik['ayRegister0'] == 0x34 and melodik['ayRead0'] == 0x34
    assert melodik['stored'] == '1'
    assert melodik['sound'] == {
        'melodikAvailable': True, 'melodikEnabled': True, 'melodikRequested': True,
        'builtInAy': False, 'ayEnabled': True
    }
    assert browser_view == {
        'activeTab': 'true', 'fileCount': 118, 'firstName': 'KALENDAR.P',
        'selectedName': 'KALENDAR.P', 'downloadEnabled': True, 'catalogCount': 118
    }
    assert drag_drop == {'driveBName': 'dropped-copy.d80', 'fileCount': 118, 'activeDrive': 'true'}
    assert memory == {'ram': 0x5a, 'romProtected': True}
    assert snapshot['dirty'] and snapshot['counter'] == 1 and not snapshot['paged']
    assert bank_switching['fixedInBank1'] == 0x44
    assert bank_switching['bank1Before'] == [0, 0]
    assert bank_switching['bank0'] == [0x10, 0x20]
    assert bank_switching['bank1'] == [0x11, 0x21]
    assert bank_switching['state']['profile'] == 'didaktik80' and bank_switching['state']['bank'] == 1
    assert reset_bank['profile'] == 'didaktik80' and reset_bank['bank'] == 0
    assert [item['id'] for item in machine_profiles] == ['didaktikM', 'didaktikKompakt', 'spectrum48', 'spectrum128', 'didaktik80']
    assert [item['profile'] for item in machine_profiles] == ['spectrum48', 'spectrum48', 'spectrum48', 'spectrum128', 'didaktik80']
    assert [item['bundledRom'] for item in machine_profiles] == ['m', 'kompakt', None, None, 'gama']
    expected_rom_files = {
        'didaktikM': 'didaktik-m-1992.rom',
        'didaktikKompakt': 'didaktik-kompakt-1993.rom',
        'didaktik80': 'didaktik-gama-1989.rom',
    }
    for item in machine_profiles:
        rom_file = expected_rom_files.get(item['id'])
        if rom_file:
            expected = list((ROOT / 'roms' / rom_file).read_bytes()[0x1538:0x1550])
            assert item['romSignature'] == expected
    assert all(item['driveA'] == '036-KOMPAKT.d80' for item in machine_profiles)
    for item in machine_profiles:
        assert item['ayActive']
        if item['id'] == 'spectrum128':
            assert item['sound'] == {
                'melodikAvailable': False, 'melodikEnabled': False, 'melodikRequested': True,
                'builtInAy': True, 'ayEnabled': True
            }
            assert item['melodikDisabled'] and not item['melodikChecked']
            assert item['soundBadge'] == 'AY built in'
        else:
            assert item['sound'] == {
                'melodikAvailable': True, 'melodikEnabled': True, 'melodikRequested': True,
                'builtInAy': False, 'ayEnabled': True
            }
            assert not item['melodikDisabled'] and item['melodikChecked']
            assert item['soundBadge'] == 'Melodik AY'
    assert melodik_off == {'ayActive': False, 'checked': False, 'badge': 'Beeper only', 'stored': '0'}
    assert bt100['cpu']['halt'] and bt100['cpu']['pc'] == 0x6004
    assert bt100['printer']['dotCount'] == 20
    assert bt100['printer']['headY'] > 0
    assert bt100['printer']['headX'] == 0
    assert bt100['printer']['motorDirection'] == 0
    assert bt100['printer']['portBOutput'] & 0x0f == 0x0d
    expected_row_sizes = {'2': 6, '4': 2, '6': 2, '8': 2, '10': 2, '12': 6}
    assert {key: len(value) for key, value in bt100['rows'].items()} == expected_row_sizes
    # Adjacent dots within one raster row remain one encoder pitch apart.
    for values in bt100['rows'].values():
        for left, right in zip(values, values[1:]):
            assert 0.90 < right - left < 1.10
    # Opposite-direction rows retain the real finite-notch offset, around half
    # a pitch, but must never jump by a whole microcolumn.
    for first, second in [('2', '12'), ('4', '6'), ('8', '10')]:
        for left, right in zip(bt100['rows'][first], bt100['rows'][second]):
            assert 0.35 < abs(left - right) < 0.65
    assert not page_errors and not console_errors
    browser.close()
