# Vibra PWA v3.4 — ROOT INSTALL FIX

Problem confirmed by the user's install-check output: /Vibra/assets/icon-192.png, icon-512.png and icon-maskable-512.png returned HTTP 404. This ZIP uses **no assets directory**. The icon files live alongside index.html and manifest.json in the repository root.

## Deploy (GitHub Pages: https://dipam03.github.io/Vibra/)
1. Download this ZIP and **extract/unzip it first**.
2. Open https://github.com/dipam03/Vibra -> Add file -> Upload files.
3. **Open the extracted folder, select ALL its contents (the files, not the enclosing folder), then drag the files onto the upload page.** Upload directly to root of the repository (same level as index.html), not into a nested directory. GitHub will replace matching files. Commit changes to the Pages publishing branch.
4. Keep your existing config.js! It contains your own Supabase URL and public key. The ZIP deliberately does NOT contain config.js. Supabase SQL changes are NOT required.
5. Allow GitHub Pages deployment to complete.
6. Directly test the following URLs (should load an image, not 404):
   - https://dipam03.github.io/Vibra/icon-192.png
   - https://dipam03.github.io/Vibra/icon-512.png
   - https://dipam03.github.io/Vibra/icon-maskable-512.png
7. Open https://dipam03.github.io/Vibra/install-check.html?v=3.4 on mobile Chrome, tap Repair old cache & reload, then open the app and tap Install. Wait for the browser to decide whether to offer a native installation prompt.
8. Android Chrome: if there is still no prompt, use ⋮ -> Install app / Add to Home screen. iOS Safari: Share -> Add to Home Screen. Site scripts cannot force an OS install without browser permission.

Manifest references now point to /Vibra/icon-192.png etc. The service worker and install check use the same paths. Never upload this ZIP as one file expecting GitHub Pages to extract it; GitHub Pages serves ZIPs as downloads.
