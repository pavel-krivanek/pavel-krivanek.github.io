# Sight Reading Lab PWA — source bundle 0020

This is the original **SightReading_0020** application adapted for installation as an offline-capable PWA. Its built-in SVG engraver, twenty starter phrase sources, generation algorithms, instrument choices, ranges, score controls, ABC/SVG export, local MusicXML import and playback are preserved.

## GitHub Pages

1. Extract the **contents** of this ZIP directly into the directory served by GitHub Pages (usually the repository root, `/docs`, or your `gh-pages` branch).
2. Enable Pages in **Settings → Pages**, choosing the correct branch/folder.
3. Visit `https://USERNAME.github.io/REPOSITORY/`, open the page, and use the browser's install / Add to Home Screen command.
4. Open the app once while online to cache it. Subsequent visits work offline (subject to browser storage eviction).

`index.html` is the main application. All PWA URLs are **relative**, so a project subpath or a custom domain works without edits. No CDN, external JS, sound or font requests are required. Portrait offers the score and a Settings panel; **landscape is recommended** for reading full-width notation, with a score-first toolbar and zoom control.

## Structure

- `index.html` — entire bundled application, including JS, SVG renderer, and starter corpus
- `manifest.json` — app name, standalone display, icons and relative scope
- `service-worker.js` — offline shell, scoped caching and online-first updates
- `icons/` — 192/512px icons, 512px maskable icon, 180px Apple touch icon
- `THIRD_PARTY_NOTICES.md` — licensing and provenance notes from source bundle

## Notes

- To publish a revised build, update the `CACHE_NAME` version in `service-worker.js` so clients replace cached assets. Users may need to close and reopen the installed app after an update.
- If you install another app under another repository on the same host, this app's cache cleanup will not delete the other app's caches.
- If you import MusicXML, the files are processed locally; the service worker does not upload them. Imported phrases are not automatically saved across restarts: export them as corpus JSON if you want to keep them.
- GitHub Pages supplies HTTPS. A service worker cannot register when opening this `index.html` directly from the filesystem; for local PWA testing use a localhost HTTP server.
- The existing generator is a prototype with documented notation limitations. The original sources and unbundled JS are in the supplied `SightReading_0020.zip`.
