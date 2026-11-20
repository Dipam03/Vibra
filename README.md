# Vibra — Instagram-style social web app

A responsive **vanilla HTML + CSS + JavaScript** social app, powered by **Supabase Auth, PostgreSQL, private Storage, and Realtime**. Built as an original social experience, not an official Instagram product.

## What's included

| Feature | Working implementation |
| --- | --- |
| Accounts | Email/password registration, sign in/out, optional Google OAuth, password reset, change password, persisted sessions |
| Profiles | Username, display name, bio, link, avatar upload, public/private profile, follower/following counts |
| Posts | Create image/video posts, up to 10 media items, captions, location, delete own posts, multi-item carousel |
| Interactions | Like/unlike, comment, reply, delete comments, save/unsave posts, share link |
| Feed | Latest public/accessible posts, following-only filter, stories row, user suggestions |
| Stories | Images/videos, visible for 24 hours, story viewer, view tracking |
| Reels | Video-only uploads, vertical scroll, playback, likes, comments and save |
| Explore/search | Photo grid, profile search, display name and caption/hashtag search |
| Social graph | Follow/unfollow, follow requests on private accounts, approve requests, block/unblock users |
| DMs | One-to-one messaging, message/photo/video attachments, real-time updates, read receipts |
| Notifications | Real-time likes, comments, follow requests/acceptances, new-message events, mark read |
| Appearance | Responsive desktop/mobile layout, light/dark mode, installable PWA shell |
| Data | Supabase only for persistent app data, RLS on every app table, private post/story/message media with short-lived signed URLs |

This is an **extended working starter**, not a literal reproduction of *every* feature currently available on Instagram. It does **not** include live streaming, audio/video calling, broadcast channels, shopping/ads, end-to-end encrypted DMs, music licensing/library, collaborative posts, AI recommendation ranking, moderation/reporting workflows, comment likes, story stickers/polls, push notifications, or automatic transcoding. See **Production notes** below.

## 1. Create a Supabase project

1. Go to [Supabase](https://supabase.com/dashboard/projects) and create a **new** project.
2. Open **SQL Editor** and execute the entire contents of `supabase-schema.sql` **once**. The script creates social tables, indices, profile/signup triggers, notification triggers, RLS policies, private `media` and public `avatars` buckets, and Realtime publications. Use an empty project to avoid duplicate policy names.
3. In **Project Settings → API Keys / Connect**, copy the **Project URL** and **publishable** key (`sb_publishable_...`). A legacy `anon` key may work if your project uses one.
4. Edit `config.js`:

   ```js
   window.VIBRA_CONFIG = {
     supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
     supabasePublishableKey: 'sb_publishable_YOUR_PUBLIC_KEY',
     appName: 'Vibra'
   };
   ```

   **NEVER put a service_role, secret, or database password in client code.** Browser publishable keys are designed to be public; security relies on the included Row Level Security policies.

5. Under **Authentication → Providers → Email**, enable email/password sign-in. If **Confirm email** is enabled, new users must confirm their email before logging in.
6. Under **Authentication → URL Configuration**, set **Site URL** to your deployed web app URL, and add `http://localhost:8000/**` under Redirect URLs for local development. Add your production URL as well.
7. Optional: enable **Google** in Authentication → Providers and configure the OAuth client IDs and provider redirect URI in Google Cloud. The Google button works only after you enable this provider.
8. In **Database → Publications**, verify `messages`, `notifications`, `follows` are in the `supabase_realtime` publication (the SQL tries to add them). If real-time events don't arrive, toggle them on there.

## 2. Run the site

No Node tooling or frontend compilation is required. From the extracted directory, run:

```bash
python -m http.server 8000
```

On Windows, run `python -m http.server 8000`; on macOS/Linux you can use `python3 -m http.server 8000`. Then visit **http://localhost:8000/** and register an account. You can also use VS Code **Live Server**. Do not open the app directly as `file://`; module/PWA and redirects need HTTP(S).

To test shared data, create two accounts in separate browsers and follow, comment, message, and publish between them.

## 3. Deploy

Upload the folder to a static host such as **Netlify, Cloudflare Pages, Vercel (static)**, or GitHub Pages. Set the host's publish directory to the app folder. Your `config.js` is **public**, so it must contain only the public URL and publishable key. Add the deployed origin in Supabase Authentication redirect settings. HTTPS enables PWA installation and clipboard/share features.

## Architecture

```
index.html           DOM shell
styles.css           Responsive design and themes
app.js               State, views, form logic, Supabase client, Realtime
config.js            YOUR PUBLIC Supabase values
supabase-schema.sql  Tables, triggers, policies, buckets and Realtime
manifest.webmanifest PWA metadata
sw.js                Network-first offline app shell
assets/              App icons
```

Data flow: Supabase Auth creates the user; an SQL trigger creates `profiles`. The browser uses a per-user access token for PostgREST; database RLS limits each request. Media uploads go to user-ID-based folders in **private `media` Storage**. Authorized clients obtain temporary signed media URLs. Avatars use a public bucket. Supabase Realtime listens to message, follow and notification changes.

## Security and operational notes

- Test with **two different users** (public/private) before exposing the site; private account media is intended to be authorized by Storage policies. Signed URLs are shareable until expiry (~1 hour), even if someone unfollows after receiving one.
- The app prevents overwriting files and sets upload size limits to **50 MB media** / **5 MB avatars**. Your hosted Supabase plan may impose a lower limit.
- Deleting a post removes its media from Storage through the client. Orphaned Storage objects can occur after interrupted uploads, deleted accounts, or failed cleanup. Add scheduled cleanup as part of production operations.
- Expired stories are hidden from reads by RLS but remain in the table and Storage until purged. Schedule server-side expiration cleanup in production.
- New messages are plaintext **in the database**, protected by RLS and transport encryption; **not end-to-end encrypted**.
- User-to-user DMs are limited to accounts the sender can view. Private accounts not followed cannot currently receive message requests.
- Standard Supabase pagination limits mean counts and feeds are suitable for an MVP, not large-scale usage. Add aggregate counts, full-text search, cursor pagination, optimized indexes, CDN media transformations, and rate limiting before high traffic.
- A production launch needs spam/abuse reporting, moderation, admin tools, copyright/DMCA workflow, account recovery, data exports/deletion, accessibility review, test coverage, and observability.
- Content generated by users is escaped before insertion into HTML to mitigate XSS. External profile website links are restricted to HTTP(S).
- Keep the pinned Supabase JS CDN dependency up to date after reviewing new releases, or install it locally via npm and commit a lockfile. Supabase docs: [JavaScript client](https://supabase.com/docs/reference/javascript/installing), [Storage access](https://supabase.com/docs/guides/storage/security/access-control), [Realtime](https://supabase.com/docs/guides/realtime/postgres-changes).

## Troubleshooting

| Problem | What to check |
| --- | --- |
| App says “Connect Supabase” | Replace both placeholders in `config.js`; reload the page |
| Invalid login credentials | Confirm email if required; check Authentication → Users; verify password |
| Google sign-in fails | Enable Google provider, set its OAuth credentials and authorized redirect URIs |
| “relation does not exist” / missing table | Run `supabase-schema.sql` on the **same** project used by `config.js` |
| Permission denied / RLS error | Check that SQL ran successfully, Data API exposes `public`, and the logged-in user is correct |
| Upload errors | Check private `media`/public `avatars` bucket, file MIME and size, Storage policies, plan limits |
| Posts won't show | Verify post media was saved; inspect the browser console and Storage policies; private posts require an approved follow |
| Realtime updates not appearing | Verify Postgres changes publication and Realtime are enabled in Supabase |
| Login link redirects to wrong URL | Fix Authentication → URL Configuration / Redirect URLs |
| Photos show broken | Check `createSignedUrl` access; expired signed URLs need refreshing |

### Suggested test checklist

- [ ] Register two accounts and confirm email
- [ ] Login from two different devices and see shared profile/post data
- [ ] Upload a photo, carousel, story and video reel
- [ ] Like, comment, reply, save and unsave a post
- [ ] Set private account, request follow, accept and verify private media visibility
- [ ] Start direct chat with text and media attachments; verify real-time delivery
- [ ] Mark notifications read; refresh and confirm state remains
- [ ] Block an account and check content is hidden
- [ ] Edit profile, upload avatar and change password
- [ ] Install as PWA over HTTPS

---
Built with HTML, CSS, JavaScript and Supabase. Not affiliated with Instagram or Meta.
