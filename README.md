# Vibra 2.0 — Instagram-style social web app

A mobile-responsive HTML/CSS/JavaScript web app using **Supabase Auth, PostgreSQL (RLS), private Storage and Realtime**. It is not affiliated with Instagram or Meta. **Github Pages can host the frontend** without a separate Node backend; Supabase handles all persistent data and authentication.

## ⚠️ IMPORTANT: Upgrading from your previous Vibra app

**Existing Supabase project with the earlier Vibra schema:**

1. Make a backup in Supabase and review SQL changes.
2. Open your existing Supabase project's **SQL Editor**. Run **`supabase-upgrade-v2.sql` ONCE**. This fixes comment/reply permissions and adds the new tables, policies, triggers, privacy settings and chat requests. **Do not rerun the original `supabase-schema.sql` on an existing database**; it tries to recreate named policies.
3. Replace your old GitHub Pages website files with all the updated app files. Keep your **current configured `config.js`** URL/publishable key if it was already working; don't upload the placeholder version over your configured one.
4. Hard refresh (Ctrl+Shift+R) or close/reopen the installed app, so the v2 service worker replaces the cached files.
5. Open your site in two different browsers/accounts to verify posts, comments, incoming requests, and story views.

**New Supabase project:** run the complete **`supabase-schema.sql` once** instead. It includes all the v2 changes. DO NOT run both SQL files for a new project.

## What's new in 2.0

| Feature | Behavior |
| --- | --- |
| Comment fix | Removes a self-referencing INSERT RLS check that could cause comment/reply permission issues; a secure trigger now validates reply parent IDs |
| Colors | Black, charcoal, white with red accent; optional light theme in Settings |
| Post insights | Owner can see unique signed-in viewers, total likes, commenter count, and viewer/liker identities |
| Story on avatar | Tap the account's existing story-ring profile icon, in the story strip or profile/post header; a separate `+` uploads another story |
| Story management | Story author can change the caption, replace media, delete story, see viewers and story likers |
| Story likes | Viewers can like/unlike a story, stored in Supabase |
| Message requests | New chats from people you don't follow land in **Messages → Requests**. Recipient can accept or decline; requester can send one initial message before approval |
| Privacy | Private account, who can comment (everyone/followers/off), who can start messages (everyone/followers/nobody), and story audience (everyone allowed by profile privacy / approved followers only) |
| PWA | **Install app** button in login screen, navigation, mobile header and Settings; installable over HTTPS in supported browsers |

Other existing features remain: email/password & optional Google sign-in, password reset, posts/reels/photos/videos, likes, comments/replies, saved posts, follows/private follow requests, explore/search, chat with media, notifications, blocking, and profiles.

## Connect Supabase

1. Create a project at <https://supabase.com/dashboard/projects>.
2. In **SQL Editor**, run the correct SQL file according to the instructions above.
3. Find your **Project URL** and **publishable key** in Supabase → Project Settings → API Keys / Connect.
4. Edit `config.js` (public browser configuration):

   ```js
   window.VIBRA_CONFIG = {
     supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
     supabasePublishableKey: 'sb_publishable_YOUR_KEY',
     appName: 'Vibra'
   };
   ```

5. Supabase → Authentication → URL Configuration: set your deployed site as the **Site URL**, and include the deployed URL and `http://localhost:8000/**` in Redirect URLs. For Google OAuth also enable the provider with a Google Cloud **Web application** OAuth client and the Supabase callback URL.
6. **Never commit service_role, Supabase secret keys or Google Client Secret to HTML/JS or a public GitHub repository.** Only the publishable key is safe to include in `config.js`, because database/storage access is restricted using RLS.

## Deploy on GitHub Pages

1. Extract the ZIP. Open the **`vibra-social-updated`** folder and upload its contents to the **root** of your GitHub repository (not the ZIP itself).
2. Keep your configured `config.js` or edit the placeholder before publishing.
3. Repository → Settings → Pages → **Deploy from a branch** → `main` → `/(root)` → Save.
4. Site URL will resemble `https://YOUR-USERNAME.github.io/REPOSITORY/`.
5. Add that exact URL to Supabase Auth's Site URL / Redirect URLs and test both the login and Google sign-in flow.
6. Subsequent updates: upload the changed files, let GitHub Pages deploy, and refresh your browsers.

To run locally, in the app folder run `python -m http.server 8000` and visit <http://localhost:8000/>. `file://` is not a supported deployment method.

## Install on mobile

- **Android (Chrome/Edge):** Open the HTTPS website and tap **Install app**. If your browser does not expose the install prompt, use menu → **Install app** or **Add to Home screen**.
- **iPhone (Safari):** Open the HTTPS website, tap **Share → Add to Home Screen → Add**. The app's Install button explains these manual steps since iOS does not reliably offer the `beforeinstallprompt` event.
- The PWA (`manifest.webmanifest`, `sw.js`, icon files) installs a home-screen shortcut/standalone website; it is **not** an Android APK or a native iOS application. Online Supabase connectivity is needed for user-generated content.

## Technical and security notes

- The `supabase-upgrade-v2.sql` script uses RLS on **all new public tables** (`post_views`, `story_likes`) and narrows UPDATE permissions on posts/stories/conversations. `conversations` is added to the Realtime publication for request status updates.
- Analytics are **unique signed-in accounts** (not anonymous visitors or a full analytics solution). Feed impressions are recorded when posts enter view, and post details/reels also record views. These counts start from v2 deployment; historical views are not reconstructed. Viewer/liker lists show up to 150 for posts / 250 for stories; for busy accounts implement pagination and exact story counts.
- Story audience is a **profile-wide** control applied to all currently active stories; stories expire 24 hours after their original publication even if edited.
- Message privacy governs **new** conversations. Accepted/previous conversations can remain open until blocked; incoming requests accept/decline are enforced by SQL. Messages are encrypted in transit and access-controlled but **not end-to-end encrypted**.
- Private media signed links can be shared until their expiry. Supabase Storage file deletion or network interruption can leave orphaned media; production deployments should schedule cleanup.
- PWA install requires HTTPS (or localhost) and browser support. Platform prompts are not guaranteed; the fallback instructions explain manual installation.
- This is an extended starter, not full Instagram feature parity: no native push notifications, voice/video calls, live streaming, music licensing, close-friends lists, automated content moderation/reporting, or recommendation ML. Before a public launch add rate-limiting, spam prevention, moderation, abuse reporting, account export/deletion, load testing and full multi-user integration tests.

### Testing after migration

1. Create two accounts. Sign in on separate devices/browsers.
2. User A posts a photo. User B comments and replies. Verify both comments remain after refresh.
3. User B likes and views A's post. In A's **Post options → View insights**, verify the unique view and liker.
4. User A uploads a story and taps their story-ring avatar; User B views and likes it. In A's story viewer, open **views/likes**, then edit caption and delete.
5. User B (not followed by A) sends one DM. On A's Messages → Requests tab accept/decline; verify a second initial DM cannot be sent before approval.
6. Update A's privacy controls and confirm B's ability to comment, message, and view stories changes as expected.
7. Visit GitHub Pages over HTTPS and test **Install app** on Android Chrome or manual Safari home-screen installation.

### Troubleshooting

| Issue | Check |
| --- | --- |
| Comment or reply gives an RLS/permission error | Run **`supabase-upgrade-v2.sql` on the exact existing project**; double-check that your deployed `config.js` points to it |
| Column `status` or `story_audience` does not exist | The v2 SQL upgrade has not run; check Supabase SQL Editor errors |
| Posts/photos not visible | Confirm Storage private `media` policies, login session, and follow/story audience settings |
| Message requests missing | Check the Requests tab, privacy controls and Realtime publication settings for `conversations` |
| Google login does not work | Check Google OAuth Client ID/Secret **in Supabase dashboard only**, callback URI, Site URL / redirect URLs |
| Install button only shows instructions | Use HTTPS in a supported browser; browsers decide if/when to show the native install prompt |
| App still looks pink | Clear cached service worker/website data or reload; verify updated `styles.css` and `sw.js` deployed |

Vibra is an independent example social application. Not affiliated with Instagram or Meta.
