VIBRA v3.8 — REELS VIEW COUNTS
======================================
Production URL: https://dipam03.github.io/Vibra/

GitHub upload
1. Extract this archive and upload ALL files at the ROOT of your Vibra GitHub repository.
2. Keep your existing configured config.js (this ZIP does not contain it).
3. The supplied supabase-upgrade-v3-8.sql has already been executed on the connected Vibra
   project (xzbrtvhmfugpesmyshae). Do NOT run it again on that project.
4. After GitHub Pages redeploys, fully close and reopen the installed Vibra app.
   If old files remain cached, use /Vibra/install-check.html to repair its cache.

Where views show
- Reel player: compact view badge over the video.
- Home feed: Reel preview badge and views beside the likes.
- Profile Reels grid, Explore grid and Search results: views on each Reel thumbnail.

Definition of a view
A signed-in viewer counts once for a Reel after 2 seconds of real video playback.
Scrolling past a Reel is not enough. The creator's own plays do not count. Multiple
rewatches by the same account count once, avoiding accidental inflation. This is a
UNIQUE-VIEWER count, not Instagram's proprietary replay-based Plays metric.

Views begin tracking when v3.8 is deployed; historic plays cannot be recovered.
Database triggers maintain public per-Reel totals without exposing viewer identities.
The viewer table is protected by per-account RLS, with no client permission to edit totals.

Test
Use two different accounts. From account B watch account A's Reel for at least 2
seconds, then check the view badge and account A's Profile Reels grid. Reload and
confirm the number persists. Replay with B and confirm it does not increase again.
