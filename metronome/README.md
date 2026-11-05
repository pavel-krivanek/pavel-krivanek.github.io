# Metronome PWA

A self-contained, mobile-first metronome for GitHub Pages. No dependencies, accounts, or network APIs.

## Deploy to GitHub Pages

1. Copy the **contents** of this directory to the repository's publishing directory (root or `/docs`).
2. In the repository's Settings → Pages, configure GitHub Pages to publish that directory and branch.
3. Open `https://USERNAME.github.io/REPOSITORY/` in a browser.
4. Install via the browser's app-install option (on iOS Safari, Share → Add to Home Screen).
5. Visit once while online to cache the files; later visits work offline.

All assets use **relative paths**, so GitHub Pages project URLs work without modifications. If you release an updated version, change `CACHE` in `service-worker.js` to ensure an offline cache refresh.

## Controls

- **BPM**: directly enter any integer from 20–300 or use the ± buttons.
- **Italian marking**: choose Grave, Largo, Larghetto, Adagio, Andante, Moderato, Allegretto, Allegro, Vivace, Presto, or Prestissimo. Each sets a representative BPM. These labels have conventional but nonstandard, overlapping ranges.
- **Time signature**: simple 2/4–7/4, 2/2–4/2, 3/8; compound 6/8, 9/8, 12/8; or asymmetric 5/8 and 7/8 with accent grouping.
- **Subdivision**: quieter clicks between pulses (2 per beat in simple/asymmetric meters, 3 per beat in compound meters).
- **Downbeat**: toggle an accent on the first beat; asymmetric meters also accent group starts.
- **Tap tempo**: tap several times; recent intervals yield a tempo estimate.
- **Volume**: master click level, with click sounds synthesized directly using the Web Audio API.

### Beat-unit conventions

In 4/4, BPM refers to quarter notes. In 2/2 it refers to half notes. In 6/8, 9/8 and 12/8 BPM refers to **dotted quarters** (2, 3, 4 main beats respectively). In 5/8 and 7/8 it refers to **eighth notes**, with optional groupings such as 2+3 or 2+2+3. The pulse unit is displayed below the BPM value.

## Browser notes

- Works best from an HTTPS origin such as GitHub Pages. Local `file://` can run the page but usually cannot install a service worker.
- Sound starts only from a user gesture, as required by mobile browser autoplay policies.
- A screen wake lock is requested when supported. Background audio and locked-screen behavior depend on the browser/OS; continuous timing cannot be guaranteed when a browser suspends its page.
- Preferences are kept locally in the browser.
