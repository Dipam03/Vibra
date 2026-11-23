# Vibra Social v3 — messaging, sharing, mentions and verification

Responsive Instagram-style social web app, built with **HTML, CSS, vanilla JavaScript, Supabase Auth, PostgreSQL, Storage and Realtime**. This is an independent project, not Instagram or a Meta product.

## Upgrade the EXISTING Vibra site (GitHub Pages + Supabase)

1. **Back up your Supabase database and existing configured `config.js` before upgrading.**
2. If you use the *same* connected Supabase project named **Vibra** that was updated in this chat, the **v3 SQL database changes are already applied**. Do **not** run the migration again unnecessarily. If you use another project, open Supabase → SQL Editor, paste `supabase-upgrade-v3.sql`, run it, and check for errors. It is written to be repeatable and does not delete accounts/posts/messages.
3. Replace the website files in your GitHub repository root with the contents of this folder. **Preserve the real Supabase URL and publishable key from your existing `config.js`** (the copy bundled here contains placeholders). Never expose the `service_role` or secret API key.
4. In GitHub Pages ensure deployment from `main` / `(root)`; your site must run via HTTPS. Close/reopen the installed PWA or hard-refresh your browser after deployment. The service-worker cache key is now `vibra-shell-v3-0`.
5. Use two accounts in separate browsers or private windows to test message requests, reply auto-approval, mutual followers, reel sharing, comment mentions, profile badges, and account switching.

## Install a NEW project

1. Create a Supabase project. Run `supabase-schema.sql` in the SQL Editor first (baseline schema). Then run `supabase-upgrade-v3.sql` (v3 additions/changes).
2. Edit `config.js` with Project URL and **publishable** API key only.
3. Configure Supabase Auth site and redirect URLs (your GitHub Pages site; optionally `http://localhost:8000/**` for local development). Set up Google OAuth in Supabase and Google Cloud if required.
4. Host these files on GitHub Pages, Netlify or any static HTTPS host. Locally: `python -m http.server 8000` in this folder, and visit `http://localhost:8000`.

## v3 features

- **Message request repairs:** New conversations begin as requests unless both users already follow each other with *accepted* follows. On mutual accepted follows, chats are accepted automatically, including pre-existing pending chats. This does **not** bypass private-profile follow approvals.
- **Reply auto-accept:** A recipient can reply directly to a pending request; the message and transition to accepted status are enforced in the database. The requester can send only one initial message until approved.
- **Chat improvements:** Latest-message snippets, unread badges, chat sorting by activity, realtime inbox updates, read receipts, own-message unsend and existing image/video attachments.
- **In-app reels/post sharing:** Use the send/share icon on any reel/post, search a Vibra user, and send a linked preview inside DMs. Post owners' privacy/blocking rules are enforced in Postgres for both participants; a private reel is not sent to an unauthorized viewer. The sender must be allowed to initiate the DM. Copy-link is also available.
- **Mentions/tagging:** Type `@username` in post captions or comments/replies; matching usernames from loaded profiles appear as suggestions in comment inputs, and typed mentions are clickable links in posts, comments, and messages. This version does not send a separate mention notification.
- **500-follower custom badge:** An **app-specific blue check** appears beside usernames only while they have at least **500 accepted followers**. A DB trigger recomputes it when follows are added, accepted, removed, or changed. It is not Instagram/Meta verification, official identity verification, or a paid badge. Users cannot edit the server-generated `is_verified` field.
- **Switch/add account:** Settings → **Switch / add account** signs out locally and shows login with selectable previously used email addresses. You must authenticate again; the app does not store multiple passwords or session tokens for quick switching.
- The black/white/red theme, Stories, Comments, View Insights, PWA Install, privacy and other v2 features remain.

## Known limitations and safety notes

- The user interface is a **feature-rich starter**, not full Instagram parity. Reels sharing depends on the recipient's actual access to the source post. Source reels deleted by their author also remove attached share-only messages.
- Only accepted follows count toward the custom badge. If a profile changes privacy or blocks a user, a previously shared preview may become inaccessible when reloaded.
- Direct messages are protected by RLS, not end-to-end encrypted. Never claim end-to-end encryption. For production, add abuse/reporting features, deletion/export workflows, rate limits, monitoring, and load testing.
- `@username` works as clickable text, not as a user-ID-backed permanent mention; if the username changes, old text can stop resolving. Suggestions are based on profiles loaded in the current UI, and more users can be loaded by Search.
- Recent account suggestions are email *hints* stored locally in the browser, not sign-in credentials. Re-authentication is required to switch accounts.
- Message previews load the last 500 messages across up to 120 conversations, and open chats load the newest 200 messages. A larger app should implement cursor pagination and more scalable message summary tables.
- A browser UI smoke test with sample data succeeded, as did database-transaction tests of request replies, mutual-follow chat approval and shared-post message insertion. Those tests were rolled back. **An end-to-end test on your deployed website using real logins has not been performed.**

## Files

- `index.html`, `styles.css`, `app.js` — responsive web UI and functionality
- `config.js` — public client configuration; replace placeholders or retain configured version
- `supabase-schema.sql` — baseline for an entirely new database
- **`supabase-upgrade-v3.sql`** — additive upgrades for existing v2/partially upgraded projects
- `manifest.webmanifest`, `sw.js`, `assets/` — installable PWA
- `supabase-upgrade-v2.sql`, `supabase-fix-comments-insights.sql` — historical scripts only; do **not** rerun by default on a database already upgraded in this conversation
