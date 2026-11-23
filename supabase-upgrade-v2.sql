-- VIBRA 2.0 UPGRADE — run ONCE in Supabase SQL Editor for an existing Vibra database.
-- For a NEW project instead execute supabase-schema.sql (which includes this upgrade).
-- Changes: fixes comment/reply permissions, message requests, account privacy,
-- story reactions/insights, post views, caption/media editing, and secure storage.

alter table public.profiles
  add column if not exists comment_privacy text not null default 'everyone',
  add column if not exists message_privacy text not null default 'everyone',
  add column if not exists story_audience text not null default 'everyone';
do $$ begin
  alter table public.profiles add constraint vibra_comments_pref_check check (comment_privacy in ('everyone','followers','off'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint vibra_messages_pref_check check (message_privacy in ('everyone','followers','none'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint vibra_stories_pref_check check (story_audience in ('everyone','followers'));
exception when duplicate_object then null; end $$;

alter table public.conversations add column if not exists status text not null default 'accepted';
do $$ begin
  alter table public.conversations add constraint vibra_conversation_status_check check (status in ('pending','accepted','declined'));
exception when duplicate_object then null; end $$;
create index if not exists vibra_conversation_request_idx on public.conversations (recipient_id,status,created_at desc);

-- Each post view is a unique, authenticated user; only author/viewer can read it.
create table if not exists public.post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create index if not exists vibra_post_views_post_idx on public.post_views(post_id);
alter table public.post_views enable row level security;
drop policy if exists "v2 post views read" on public.post_views;
create policy "v2 post views read" on public.post_views for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid())));
drop policy if exists "v2 post views create" on public.post_views;
create policy "v2 post views create" on public.post_views for insert to authenticated
  with check (user_id=(select auth.uid()) and exists (select 1 from public.posts p where p.id=post_id and p.user_id <> (select auth.uid())));

-- The story owner can see the identities of viewers and people who liked it.
create table if not exists public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(story_id,user_id)
);
create index if not exists vibra_story_likes_story_idx on public.story_likes(story_id);
alter table public.story_likes enable row level security;
drop policy if exists "v2 story likes read" on public.story_likes;
create policy "v2 story likes read" on public.story_likes for select to authenticated
  using (user_id = (select auth.uid()) or exists(select 1 from public.stories s where s.id=story_id and s.user_id=(select auth.uid())));
drop policy if exists "v2 story likes insert" on public.story_likes;
create policy "v2 story likes insert" on public.story_likes for insert to authenticated
  with check (user_id=(select auth.uid()) and exists(select 1 from public.stories s where s.id=story_id));
drop policy if exists "v2 story likes delete" on public.story_likes;
create policy "v2 story likes delete" on public.story_likes for delete to authenticated using (user_id=(select auth.uid()));

-- Row-level access checks. Definer functions are needed to consult private follows/blocks
-- without accidental RLS recursion. They only answer permissions for auth.uid().
create or replace function public.vibra_can_view_story(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_see_user(target) and exists (
    select 1 from public.profiles p where p.id=target and (
      p.id=(select auth.uid()) or p.story_audience='everyone' or
      exists(select 1 from public.follows f where f.follower_id=(select auth.uid()) and f.following_id=target and f.status='accepted')
    )
  );
$$;
revoke all on function public.vibra_can_view_story(uuid) from public, anon;
grant execute on function public.vibra_can_view_story(uuid) to authenticated;

create or replace function public.vibra_can_comment(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_see_user(target) and exists (
    select 1 from public.profiles p where p.id=target and (
      p.id=(select auth.uid()) or p.comment_privacy='everyone' or
      (p.comment_privacy='followers' and exists (
         select 1 from public.follows f where f.follower_id=(select auth.uid()) and f.following_id=target and f.status='accepted'))
    )
  );
$$;
revoke all on function public.vibra_can_comment(uuid) from public, anon;
grant execute on function public.vibra_can_comment(uuid) to authenticated;

create or replace function public.vibra_can_request_dm(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and target <> (select auth.uid())
  and not exists(select 1 from public.blocks b where
      (b.blocker_id=target and b.blocked_id=(select auth.uid())) or
      (b.blocked_id=target and b.blocker_id=(select auth.uid())))
  and exists (select 1 from public.profiles p where p.id=target and
      (p.message_privacy='everyone' or (p.message_privacy='followers' and exists (
        select 1 from public.follows f where f.follower_id=(select auth.uid()) and f.following_id=target and f.status='accepted'))));
$$;
revoke all on function public.vibra_can_request_dm(uuid) from public, anon;
grant execute on function public.vibra_can_request_dm(uuid) to authenticated;

-- IMPORTANT COMMENT FIX: the old INSERT policy recursively queried comments.
-- Validate reply's parent with a BEFORE trigger; the RLS policy only checks author/post.
create or replace function public.vibra_check_comment_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments p where p.id=new.parent_id and p.post_id=new.post_id
  ) then raise exception 'Reply must belong to the same post'; end if;
  return new;
end $$;
revoke all on function public.vibra_check_comment_parent() from public,anon,authenticated;
drop trigger if exists vibra_comment_parent_check on public.comments;
create trigger vibra_comment_parent_check before insert or update of parent_id,post_id
on public.comments for each row execute function public.vibra_check_comment_parent();
drop policy if exists "comments add" on public.comments;
create policy "comments add" on public.comments for insert to authenticated
  with check (user_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id and public.vibra_can_comment(p.user_id)));

-- Story audience is enforced both in database rows and private media access.
drop policy if exists "stories view" on public.stories;
create policy "stories view" on public.stories for select to authenticated
  using (expires_at>now() and public.vibra_can_view_story(user_id));
drop policy if exists "story views add" on public.story_views;
create policy "story views add" on public.story_views for insert to authenticated
  with check (user_id=(select auth.uid()) and exists (select 1 from public.stories s where s.id=story_id and s.user_id<>(select auth.uid())));

-- Story edits retain the original 24-hour expiry and engagement records.
drop policy if exists "v2 stories edit" on public.stories;
create policy "v2 stories edit" on public.stories for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and storage_path like ((select auth.uid())::text||'/%'));
drop policy if exists "v2 posts edit" on public.posts;
create policy "v2 posts edit" on public.posts for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

-- Decide if a newly initiated chat is a normal inbox chat or a request.
create or replace function public.vibra_initialize_dm()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is distinct from (select auth.uid()) or not public.vibra_can_request_dm(new.recipient_id) then
    raise exception 'This account cannot receive your message request';
  end if;
  if exists(select 1 from public.follows f where f.follower_id=new.recipient_id
    and f.following_id=new.created_by and f.status='accepted') then
    new.status := 'accepted';
  else
    new.status := 'pending';
  end if;
  return new;
end $$;
revoke all on function public.vibra_initialize_dm() from public,anon,authenticated;
drop trigger if exists vibra_dm_initialize on public.conversations;
create trigger vibra_dm_initialize before insert on public.conversations
for each row execute function public.vibra_initialize_dm();
drop policy if exists "conversations start" on public.conversations;
create policy "conversations start" on public.conversations for insert to authenticated
  with check (created_by=(select auth.uid()) and public.vibra_can_request_dm(recipient_id));
drop policy if exists "v2 conversations manage requests" on public.conversations;
create policy "v2 conversations manage requests" on public.conversations for update to authenticated
  using (recipient_id=(select auth.uid()) and status in ('pending','declined'))
  with check (recipient_id=(select auth.uid()) and status in ('accepted','declined'));
-- Status is the ONLY editable conversation column in the browser.
revoke update on public.conversations from authenticated;
grant update(status) on public.conversations to authenticated;

-- Prevent messages from bypassing a pending/declined request via direct API calls.
create or replace function public.vibra_can_send_dm(chat_id uuid, sender uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select sender=(select auth.uid()) and exists (
    select 1 from public.conversations c where c.id=chat_id and
    (c.created_by=sender or c.recipient_id=sender) and
    not exists(select 1 from public.blocks b where
        (b.blocker_id=c.created_by and b.blocked_id=c.recipient_id) or
        (b.blocked_id=c.created_by and b.blocker_id=c.recipient_id)) and
    (c.status='accepted' or (c.status='pending' and c.created_by=sender and
      not exists(select 1 from public.messages m where m.conversation_id=chat_id)))
  );
$$;
revoke all on function public.vibra_can_send_dm(uuid,uuid) from public,anon;
grant execute on function public.vibra_can_send_dm(uuid,uuid) to authenticated;
drop policy if exists "messages send" on public.messages;
create policy "messages send" on public.messages for insert to authenticated
  with check (sender_id=(select auth.uid()) and public.vibra_can_send_dm(conversation_id,sender_id)
    and (media_path is null or media_path like ((select auth.uid())::text||'/%')));
-- The insert check above protects ordinary inserts. A trigger also enforces it
-- inside the database transaction to prevent two concurrent initial messages.
create or replace function public.vibra_verify_dm_send()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.conversations where id=new.conversation_id for update;
  if not public.vibra_can_send_dm(new.conversation_id,new.sender_id) then
    raise exception 'Message request is pending approval or messaging is unavailable';
  end if;
  return new;
end $$;
revoke all on function public.vibra_verify_dm_send() from public,anon,authenticated;
drop trigger if exists vibra_dm_send_guard on public.messages;
create trigger vibra_dm_send_guard before insert on public.messages
for each row execute function public.vibra_verify_dm_send();

-- Keep own media accessible; restrict story media to its audience.
drop policy if exists "media read authorized" on storage.objects;
create policy "media read authorized" on storage.objects for select to authenticated using (
  bucket_id='media' and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists (select 1 from public.post_media pm join public.posts p on p.id=pm.post_id where pm.storage_path=name and public.can_see_user(p.user_id))
    or exists (select 1 from public.stories s where s.storage_path=name and s.expires_at>now() and public.vibra_can_view_story(s.user_id))
    or exists (select 1 from public.messages m join public.conversations c on c.id=m.conversation_id
       where m.media_path=name and ((c.created_by=(select auth.uid())) or (c.recipient_id=(select auth.uid()))))
  )
);

-- Exactly scoped client grants; no service key needed.
grant select, insert on public.post_views,public.story_likes to authenticated;
grant delete on public.story_likes to authenticated;
revoke update on public.posts from authenticated;
grant update(caption,location) on public.posts to authenticated;
revoke update on public.stories from authenticated;
grant update(caption,storage_path,media_type) on public.stories to authenticated;
-- Notify both participants when request status changes in real time.
do $$ begin
  begin alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null; end;
end $$;

-- Refresh PostgREST after running the upgrade.
notify pgrst, 'reload schema';
