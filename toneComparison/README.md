# Tone Comparison Trainer — PWA

A mobile-friendly, offline-capable version of the supplied tone-comparison trainer.

## GitHub Pages deployment

1. Extract the contents of this ZIP into the **root of the Pages publishing directory**.
2. The main entry point is `index.html`. Keep `manifest.json`, `service-worker.js`, and `icons/` alongside it.
3. Enable GitHub Pages in your repository settings. The relative URLs support both `https://user.github.io/repo/` and a custom domain.
4. Open the site over HTTPS. On iPhone/iPad use Safari → Share → **Add to Home Screen**. On Android use the browser's **Install app** action.
5. Visit the app once while online so the service worker can cache all assets; the next visits can work offline.

The app uses the Web Audio API, so an audio gesture (tap Play) is required when starting playback. It does **not** use the microphone or transmit sound; the tones are synthesized locally. The latest selected settings are stored on the device when storage is available; your score starts fresh when you reopen the app. 

The existing adaptive rules, test intervals, timbres, pitch ranges, and score behavior are preserved. Screen layout is optimized for phone portrait use, while desktop retains a wider layout. Answer buttons remain in a single row on mobile.

To force a new offline cache for future releases, increase the `CACHE_NAME` version in `service-worker.js`.
