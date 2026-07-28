#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

node --check bt100-printer.js
node --check tap-browser.js
node --check hex-viewer.js
node --check emulator/00-namespace.js
node --check emulator/05-shared-helpers.js
node --check emulator/10-ui-shell.js
node --check emulator/30-runtime-media.js
node --check didaktik-d80.js
node --check app.js
node tests/controller.test.js
node tests/keyboard-layout.test.js
python3 tests/keyboard-browser.test.py
python3 tests/bt100-render-controls.test.py
python3 tests/bt100-c2-return-browser.test.py
python3 tests/bt100-i-registration.py
if [ "${D80_BUSY_TEST:-0}" = "1" ]; then
  python3 tests/bt100-busy-soft-browser.test.py
else
  echo 'Busy soft timing test skipped; run D80_BUSY_TEST=1 ./verify.sh to enable it.'
fi
node tests/tap-browser.test.js
node tests/hex-viewer.test.js
python3 tests/dom-bindings.test.py
if grep -q "strokeRect(5, 5" app.js; then
  echo "Exported BT-100 page still contains a drawn border." >&2
  exit 1
fi
sha256sum -c SHA256SUMS

if [ "${D80_BROWSER_TEST:-0}" = "1" ]; then
  python3 tests/browser-smoke.py
else
  echo 'Browser smoke test skipped; run D80_BROWSER_TEST=1 ./verify.sh to enable it.'
fi
