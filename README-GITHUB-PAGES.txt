VIBRA v3.7 — REELS RESUME + EXACT HOME REEL + HASHTAG SUGGESTIONS
================================================================
Production app: https://dipam03.github.io/Vibra/

INSTALL
1. Extract ZIP; upload ALL files at root of dipam03/Vibra GitHub repo. Replace earlier files.
2. Keep your current working config.js. This package intentionally excludes config.js.
3. In Supabase Dashboard (Vibra project) run supabase-upgrade-v3-7.sql in SQL Editor
   ONLY if this migration has not already been applied to that project.
4. Wait for Pages deployment, close/reopen Vibra installed PWA; if needed use
   https://dipam03.github.io/Vibra/install-check.html?v=3.7 -> Repair old cache.

FEATURES
- The Reels tab resumes at the account's last watched Reel and video second. Account sync uses
  private Supabase reel_watch_state (per-user RLS); localStorage is an offline fallback.
- A Reel clicked in Home opens that EXACT Reel, including older Reels not on the first page.
- Reels from Explore, Profile and search grids open the selected video, not its comments.
- Scrolling loads more recommended Reels in batches with hashtag/engagement/follow relevance.
- Tap a #hashtag from the Reel, or the For you / hashtag pills, to browse matching Reels.
- Likes, saves, watched reels and followed creators influence the simple transparent
  local ranking heuristic. It is NOT Instagram's proprietary recommendation algorithm.
- Bottom nav and fullscreen Reels from v3.6 remain. Videos play with sound if the browser permits;
  autoplay with sound may need a tap. Manually paused Reels stay paused.
- Home scroll position returns when you leave Reels and go back Home.
- Reels shared with a link (?reel=<uuid>) open their Reel viewer directly.

TEST
Open Home, scroll to an old Reel, tap its video, check exact Reel opens; scroll to another,
visit Profile, go back to Reels: the same Reel/time should continue. Tap #tag, browse matches,
tap For you. Test with a second account/device to confirm Supabase sync.

If installing from a separate Supabase project, run the v3.7 SQL on that project also.
No auth, message, comment or post records are removed.
