# Microphone Pitch & Drone Tuner PWA

This is the existing tuning application packaged as an installable, offline-capable PWA.
It does not require a build step, npm, or external libraries.

## Publish to GitHub Pages

1. Extract the **contents** of this ZIP into your GitHub Pages publishing directory
   (repository root, or `/docs` if that is your Pages source).
2. The `index.html`, `manifest.json`, and `service-worker.js` must be next to
   each other, with `icons/` alongside them.
3. In GitHub repository **Settings > Pages**, configure the branch and folder.
4. Visit `https://<username>.github.io/<repository>/` and install using your
   browser menu (Chrome: Install app; iPhone Safari: Share > Add to Home Screen).

All asset URLs are relative and work under a repository subpath or custom domain.
Microphone access needs HTTPS (provided by GitHub Pages) and user permission.
After the first successful visit, the app shell also works offline.

**Important:** A microphone permission prompt must be accepted. The app intentionally
runs continuous tuning and drone playback only while open; it cannot record in the
background. Use headphones to keep the drone out of the microphone input.

When publishing future changes to local app files, increment `CACHE_NAME` in
`service-worker.js` to ensure all offline resources are refreshed.
