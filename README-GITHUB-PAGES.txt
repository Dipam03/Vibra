VIBRA v3.9 — CLEAN HOME + TWO-STEP ANDROID BACK
====================================================
Production URL: https://dipam03.github.io/Vibra/

CHANGELOG
- Removed the “GOOD TO SEE YOU AGAIN / Home feed ✦” greeting from Home.
- Feed now begins with Stories, then For You / Following tabs and posts.
- Scrolling more than 120px down Home creates a temporary one-step Back guard.
- Android Back on scrolled Home moves to the TOP of the feed.
- Android Back again from Home at the top exits via the browser/Android PWA.
- Android Back from Explore/Reels/Profile/Messages goes to Home (top).
- Visiting another page while scrolled clears the Home scroll guard, so there is no extra Back step.
- Manually scrolling back to Home top also removes the scroll guard.

UPLOAD
1. Extract this ZIP and upload its contents at the repository ROOT.
2. Keep your existing configured config.js (not included).
3. GitHub Pages will redeploy. Fully close/reopen installed Vibra.
4. If old cache persists, use https://dipam03.github.io/Vibra/install-check.html
5. No Supabase SQL change is required for this update.

LIMITATIONS
The exact app-exit behavior of Back is controlled by Android/Chrome after the Home
history entry is exhausted. In a browser tab, Back may navigate to the previous site.
