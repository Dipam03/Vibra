VIBRA v3.6 — REELS BOTTOM BAR + BACK NAVIGATION FIX
=====================================================
Website: https://dipam03.github.io/Vibra/

DEPLOY TO GITHUB PAGES
1. Extract this ZIP and upload ALL files inside it to the ROOT of the dipam03/Vibra repository (next to index.html). Replace older versions.
2. Keep your existing config.js with your SUPABASE PROJECT URL and public/publishable key. The ZIP deliberately does NOT include config.js.
3. Wait for GitHub Pages to deploy, then close/reopen the installed Vibra app. If old files persist, open https://dipam03.github.io/Vibra/install-check.html?v=3.6 and use Repair old cache & reload.
4. Supabase SQL changes are NOT needed.

CHANGES
• On mobile, the bottom navigation bar (Home, Explore, Create, Reels, Profile) stays visible on Reels. Its buttons work just like elsewhere in the app.
• Reels stay fullscreen behind a dark translucent navigation strip; Like, Comment, Share, Save and profile/caption overlays remain inside the Reel and ABOVE the bottom bar.
• Hardware/browser Back from Reels, Explore, Profile, Messages and any other secondary screen returns Home. Moving between secondary screens replaces one history entry instead of stacking them.
• Tapping the Home button from another section uses browser history.back(), removing the secondary entry. Thus Back again from Home may exit/close the standalone PWA instead of revisiting Reels.
• Home does not intercept the hardware Back button. Android/browser ultimately controls whether Back exits the app or returns to the previous website.
• Retains previous install-button hiding, autoplay-audio restrictions, messages, private media and Supabase config.

VERIFY
https://dipam03.github.io/Vibra/install-check.html?v=3.6
https://dipam03.github.io/Vibra/icon-192.png

TEST FLOW (ANDROID INSTALLED PWA)
Home -> Reels -> (bottom bar visible) -> Profile -> Back -> Home -> Back -> Android exits app (subject to device/browser rules).
Home -> Reels -> Home tab -> Back -> Android exits app (subject to device/browser rules).
