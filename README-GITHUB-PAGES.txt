VIBRA v3.5 — GITHUB PAGES UPDATE
================================
Target: https://dipam03.github.io/Vibra/

1. Download and EXTRACT the ZIP; do not upload the ZIP itself.
2. Open https://github.com/dipam03/Vibra and upload every extracted file directly into the repository ROOT (next to index.html). Replace the existing files and commit.
3. KEEP your working config.js already in the repository. This ZIP deliberately does NOT contain it. No Supabase database changes are needed.
4. Confirm GitHub Pages deployment. On your phone, open https://dipam03.github.io/Vibra/install-check.html?v=3.5 and refresh/repair old service worker caches if the old version still appears.
5. Reopen Vibra from the installed app icon (or install with Android Chrome / iOS Safari's Add to Home Screen).

WHAT CHANGED
- Installed PWA: Install button is hidden in standalone mode and after an appinstalled event. The app remembers confirmed installation for the same browser origin. Browser APIs cannot always detect installations from different browsers.
- Mobile header with Vibra logo, Activity and Messages icons is shown only on Home.
- Browser/Android Back from another app section lands on Home by using real History API entries, rather than immediately exiting the PWA. Back from Home may still leave the app, as expected on Android.
- Reels fill the screen; on-screen Like/Comment/Share/Save actions, Back to Home and create buttons overlay the video. Tap on the video to pause/resume. No mute button or native controls are exposed on Reels.
- Browser restrictions: autoplay with sound often requires a first tap. Reels are never deliberately muted to bypass autoplay restrictions. Device volume/audio settings remain under the user's control.

PWA FILES INCLUDED
index.html, app.js, styles.css, pwa.js, sw.js, manifest.json, install-check.html, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, icon.svg.

Check: https://dipam03.github.io/Vibra/icon-192.png (should show the icon, not a 404).
No SQL migration needed.
