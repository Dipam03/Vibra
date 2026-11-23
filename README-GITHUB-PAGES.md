# Vibra v3.3 — PWA install repair for GitHub Pages

**Site:** https://dipam03.github.io/Vibra/  
**Diagnostics:** https://dipam03.github.io/Vibra/install-check.html

## Deployment steps (important)

1. Download and extract this ZIP. Upload all files **inside** the ZIP directly into the **root** of `dipam03/Vibra` GitHub repository (where `index.html` is located). Do **not** upload the ZIP alone or add an extra containing folder.
2. **Do not overwrite your working `config.js`** with the placeholder configuration in the ZIP. If in doubt, preserve your currently working copy from GitHub. Supabase key must be a publishable key, never a secret/service_role key.
3. Make sure GitHub Pages is publishing the folder you updated (Settings → Pages → `main`, `/(root)` if you use branch publishing).
4. On your phone open https://dipam03.github.io/Vibra/install-check.html. Confirm the line **Homepage actually deployed with Vibra PWA v3.3** is green. Red means the latest version is **not** what your phone received.
5. Tap **Repair old cache & reload** to clear any previous Vibra service worker. Then open the main app and tap **Install**.
6. On Android Chrome, the native installation prompt opens only if the browser offers `beforeinstallprompt`. Otherwise Chrome ⋮ → Install app / Add to Home screen. On iOS Safari: Share → Add to Home Screen. The website cannot silently install itself.

### What's improved
- Manifest supplied as `manifest.json` (reliable JSON type on GitHub Pages) as well as `.webmanifest` compatibility.
- Stable `id`, `start_url`, `scope` /Vibra/ for GitHub Pages.
- `pwa.js` captures prompt before app.js login, invokes browser prompt synchronously with user click.
- Service worker no longer fails activation when an optional app file is missing.
- Diagnostic runs independently of Supabase and includes a safe Vibra-only service-worker cache reset.

**No database SQL changes required. No Android APK included.** This is a Progressive Web App, which follows the device browser's install permissions.

---
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
