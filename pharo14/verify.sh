#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
node --check vm.image.js
node --check vm.primitives.js
node --check vm.plugins.js
node --check vm.instruction.stream.sista.js
node --check vm.instruction.printer.js
node --check squeak_node.js
node --check squeak.js
node --check vm.plugins.file.browser.js
node --check vm.plugins.ffi.js
node --check plugins/FileAttributesPlugin.js
node --check plugins/UUIDPlugin.js
node --check plugins/SurfacePlugin.js
node --check tests/pharo/support/load-squeakjs.js
node --check tests/pharo/support/fake-primitives.js
node --check tests/pharo/ephemeron-gc.test.js
node --check tests/pharo/ephemeron-pharo-probe.test.js
node --check tests/pharo/ffi-emulation.test.js
node --check tests/pharo/locale-plugin.test.js
node --check tests/pharo/oswindow-sdl2-smoke.test.js
node --check tests/pharo/uuid-plugin.test.js
node --check tests/pharo/string-and-compare-primitives.test.js
node --check tests/pharo/sista-native-fixtures.test.js
node --check tests/pharo/sista-bytecode-coverage.test.js
node --check tools/report-sista-bytecode-coverage.js
node --check tools/sista-bytecode-coverage-lib.js
node --check tools/generate-native-sista-fixtures.js
node --check tools/run-pharo-tests.js
node --check tools/pharo14-browser-sandbox-smoke.js
node --check tools/pharo14-browser-interactive-smoke.js
node --check tools/browser-module-smoke.js
node --check tools/browser-run-index-smoke.js
node tools/browser-module-smoke.js
node tools/browser-run-index-smoke.js
node tools/run-pharo-tests.js
