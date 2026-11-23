# Vibra PWA GitHub Pages fix — exact host

This package is specifically configured for **https://dipam03.github.io/Vibra/** (capital **V**). It is **not** configured for localhost and does not change the Supabase database.

## Deploy: important
1. Extract ZIP. Put `index.html`, `manifest.webmanifest`, `sw.js`, `pwa.js`, `app.js`, `styles.css`, `install-check.html`, `config.js`, and the **assets** folder directly in `dipam03/Vibra` repository root (not under an extra `vibra-github-pages-install-fixed/` folder).
2. **Preserve existing working `config.js`**. The downloadable example contains placeholders, so do not overwrite your connected keys with placeholders. Never put Supabase service-role/secret keys in browser files.
3. Deploy via GitHub Pages (Settings → Pages → branch `main`, `/(root)` if that is your setup).
4. Open **https://dipam03.github.io/Vibra/install-check.html** on Android Chrome. Every line should be green. A red line identifies a missing or incorrectly deployed file.
5. Open **https://dipam03.github.io/Vibra/** and click **Install**. If Chrome has generated `beforeinstallprompt`, it shows the native installation dialog. Otherwise use Chrome ⋮ → Install app or Add to Home Screen.
6. iPhone/iPad: Open site in Safari → Share → Add to Home Screen. This cannot be started silently by a website button.

## Paths configured
- Manifest: `/Vibra/manifest.webmanifest`
- Manifest `id`, `scope`, `start_url`: `/Vibra/`
- Worker: `/Vibra/sw.js` scoped to `/Vibra/`
- Icons: `/Vibra/assets/...`
- Worker cache version: `vibra-shell-v3-2` (old caches are invalidated).

If Chrome shows only **Create shortcut**, the browser has not made native PWA installation available; the app can't override its installation policy. Avoid in-app browsers such as Instagram or WhatsApp.

No SQL changes are needed. This maintains the v3 app features. **Not verified on the user's live GitHub Pages deployment**, because the hosting site could not be fetched from the execution environment.
