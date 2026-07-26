#!/usr/bin/env python3
"""Fail when a literal byId(...).addEventListener binding has no matching DOM id."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'index.html').read_text(encoding='utf-8')
js = (ROOT / 'app.js').read_text(encoding='utf-8')
html_ids = set(re.findall(r'\bid="([^"]+)"', html))
listener_ids = set(re.findall(r"byId\('([^']+)'\)\.addEventListener", js))
required_ids = {'fullscreenButton', 'emulatorFullscreenTarget'}
missing = sorted((listener_ids | required_ids) - html_ids)
if missing:
    raise SystemExit('Missing DOM elements for listeners: ' + ', '.join(missing))
print('DOM listener binding test passed.')
