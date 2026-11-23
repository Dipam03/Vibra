-- VIBRA SOCIAL — execute once in Supabase Dashboard → SQL Editor.
-- For a NEW Supabase project. No service key belongs in the browser.
-- All public tables have Row Level Security; media bucket is PRIVATE.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '',
  bio text not null default '' check (char_length(bio) <= 250),
  website text not null default '',
  avatar_path text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Deliberate SECURITY DEFINER used ONLY for a checked privacy predicate.
-- The caller can ask about their own relationship with a target, not another viewer.
create or replace function public.can_see_user(target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = target_id)
         or (b.blocked_id = (select auth.uid()) and b.blocker_id = target_id)
    )
    and exists (
      select 1 from public.profiles p
      where p.id = target_id and (
        p.id = (select auth.uid()) or not p.is_private
        or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = target_id and f.status = 'accepted')
      )
    );
$$;
revoke all on function public.can_see_user(uuid) from public, anon;
grant execute on function public.can_see_user(uuid) to authenticated;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2200),
  location text not null default '' check (char_length(location) <= 140),
  is_reel boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  position int not null default 0 check (position between 0 and 9)
);
create unique index if not exists post_media_order_idx on public.post_media(post_id, position);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create table if not exists public.saved_posts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  caption text not null default '' check (char_length(caption) <= 250),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id,user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  pair_key text generated always as (least(created_by::text,recipient_id::text) || ':' || greatest(created_by::text,recipient_id::text)) stored unique,
  created_at timestamptz not null default now(),
  check (created_by <> recipient_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  media_path text,
  media_type text check (media_type in ('image','video')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or media_path is not null)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('like','comment','follow','follow_request','follow_accept','message')),
  target_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists posts_recent_idx on public.posts(created_at desc);
create index if not exists posts_author_idx on public.posts(user_id,created_at desc);
create index if not exists post_media_post_idx on public.post_media(post_id);
create index if not exists follows_to_idx on public.follows(following_id,status);
create index if not exists likes_post_idx on public.likes(post_id);
create index if not exists comments_post_idx on public.comments(post_id,created_at desc);
create index if not exists stories_latest_idx on public.stories(expires_at desc);
create index if not exists messages_convo_idx on public.messages(conversation_id,created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id,created_at desc);

create or replace function public.handle_new_vibra_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  candidate text;
begin
  candidate := lower(coalesce(new.raw_user_meta_data->>'username',''));
  if candidate !~ '^[a-z0-9_]{3,24}$' or exists(select 1 from public.profiles where username = candidate) then
    candidate := 'user_' || substr(replace(new.id::text,'-',''),1,16);
  end if;
  insert into public.profiles(id, username, display_name)
    values(new.id, candidate, left(coalesce(new.raw_user_meta_data->>'display_name',candidate),80))
    on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_vibra_user() from public, anon, authenticated;
drop trigger if exists vibra_auth_user_created on auth.users;
create trigger vibra_auth_user_created after insert on auth.users
for each row execute function public.handle_new_vibra_user();

-- Populate profiles for any users created before this SQL was run.
insert into public.profiles(id,username,display_name)
select u.id,'user_' || substr(replace(u.id::text,'-',''),1,16),coalesce(u.raw_user_meta_data->>'display_name','New member')
from auth.users u where not exists (select 1 from public.profiles p where p.id=u.id)
on conflict do nothing;

create or replace function public.vibra_follow_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.blocks b where (b.blocker_id=new.follower_id and b.blocked_id=new.following_id) or (b.blocker_id=new.following_id and b.blocked_id=new.follower_id)) then
    raise exception 'This account is not available';
  end if;
  select case when p.is_private then 'pending' else 'accepted' end into new.status
  from public.profiles p where p.id=new.following_id;
  return new;
end;$$;
revoke all on function public.vibra_follow_insert() from public, anon, authenticated;
drop trigger if exists vibra_follow_before_insert on public.follows;
create trigger vibra_follow_before_insert before insert on public.follows for each row execute function public.vibra_follow_insert();

create or replace function public.vibra_follow_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.follower_id <> old.follower_id or new.following_id <> old.following_id or new.created_at <> old.created_at then
    raise exception 'Cannot change follow identities';
  end if;
  return new;
end;$$;
revoke all on function public.vibra_follow_update() from public, anon;
grant execute on function public.vibra_follow_update() to authenticated;
drop trigger if exists vibra_follow_before_update on public.follows;
create trigger vibra_follow_before_update before update on public.follows for each row execute function public.vibra_follow_update();

-- ====================================== ROW-LEVEL SECURITY ======================================
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.saved_posts enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "profiles view" on public.profiles for select to authenticated using (true);
create policy "profiles edit own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "follows view" on public.follows for select to authenticated
  using ((status = 'accepted' and public.can_see_user(following_id) and public.can_see_user(follower_id))
    or follower_id = (select auth.uid()) or following_id = (select auth.uid()));
create policy "follows initiate" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and following_id <> (select auth.uid()));
create policy "follows respond" on public.follows for update to authenticated
  using (following_id = (select auth.uid()))
  with check (following_id = (select auth.uid()) and status = 'accepted');
create policy "follows remove" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

create policy "blocks view own" on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks create" on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "blocks delete" on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));

create policy "posts view" on public.posts for select to authenticated using (public.can_see_user(user_id));
create policy "posts create" on public.posts for insert to authenticated with check (user_id = (select auth.uid()));
create policy "posts delete own" on public.posts for delete to authenticated using (user_id = (select auth.uid()));

create policy "media metadata view" on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p where p.id=post_id));
create policy "media metadata create" on public.post_media for insert to authenticated
  with check (storage_path like ((select auth.uid())::text || '/%') and exists(select 1 from public.posts p where p.id=post_id and p.user_id=(select auth.uid())));
create policy "media metadata delete" on public.post_media for delete to authenticated
  using (exists(select 1 from public.posts p where p.id=post_id and p.user_id=(select auth.uid())));

create policy "likes visible" on public.likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id=post_id));
create policy "likes add" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id));
create policy "likes unlike" on public.likes for delete to authenticated using (user_id = (select auth.uid()));

create policy "comments visible" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id=post_id));
create policy "comments add" on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id)
    and (parent_id is null or exists(select 1 from public.comments parent where parent.id=parent_id and parent.post_id=post_id)));
create policy "comments remove" on public.comments for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.posts p where p.id=post_id and p.user_id=(select auth.uid())));

create policy "saved view own" on public.saved_posts for select to authenticated using (user_id = (select auth.uid()));
create policy "saved create" on public.saved_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id));
create policy "saved remove" on public.saved_posts for delete to authenticated using (user_id = (select auth.uid()));

create policy "stories view" on public.stories for select to authenticated
  using (expires_at > now() and public.can_see_user(user_id));
create policy "stories add" on public.stories for insert to authenticated
  with check (user_id = (select auth.uid()) and storage_path like ((select auth.uid())::text || '/%'));
create policy "stories remove" on public.stories for delete to authenticated using (user_id = (select auth.uid()));
create policy "story views view" on public.story_views for select to authenticated
  using (user_id=(select auth.uid()) or exists(select 1 from public.stories s where s.id=story_id and s.user_id=(select auth.uid())));
create policy "story views add" on public.story_views for insert to authenticated
  with check (user_id=(select auth.uid()) and exists(select 1 from public.stories s where s.id=story_id));

create policy "conversations participants view" on public.conversations for select to authenticated
  using (created_by=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy "conversations start" on public.conversations for insert to authenticated
  with check (created_by=(select auth.uid()) and recipient_id <> (select auth.uid()) and public.can_see_user(recipient_id));

create policy "messages participants view" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id=conversation_id));
create policy "messages send" on public.messages for insert to authenticated
  with check (sender_id=(select auth.uid()) and exists (
    select 1 from public.conversations c where c.id=conversation_id
      and (c.created_by=(select auth.uid()) or c.recipient_id=(select auth.uid()))
      and public.can_see_user(case when c.created_by=(select auth.uid()) then c.recipient_id else c.created_by end)
  ) and (media_path is null or media_path like ((select auth.uid())::text || '/%')));
create policy "messages mark read" on public.messages for update to authenticated
  using (sender_id <> (select auth.uid()) and exists (select 1 from public.conversations c where c.id=conversation_id))
  with check (sender_id <> (select auth.uid()) and exists (select 1 from public.conversations c where c.id=conversation_id));

create policy "notifications view" on public.notifications for select to authenticated using (user_id=(select auth.uid()));
create policy "notifications read" on public.notifications for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

-- Event notifications: generated on the server, no client INSERT permission.
create or replace function public.vibra_notify_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  if tg_table_name='likes' then
    select user_id into recipient from public.posts where id=new.post_id;
    if recipient is distinct from new.user_id then
      insert into public.notifications(user_id,actor_id,kind,target_id) values(recipient,new.user_id,'like',new.post_id);
    end if;
  elsif tg_table_name='comments' then
    select user_id into recipient from public.posts where id=new.post_id;
    if recipient is distinct from new.user_id then
      insert into public.notifications(user_id,actor_id,kind,target_id) values(recipient,new.user_id,'comment',new.post_id);
    end if;
  elsif tg_table_name='follows' then
    if tg_op='INSERT' then
      insert into public.notifications(user_id,actor_id,kind,target_id)
        values(new.following_id,new.follower_id,case when new.status='pending' then 'follow_request' else 'follow' end,new.follower_id);
    elsif old.status='pending' and new.status='accepted' then
      insert into public.notifications(user_id,actor_id,kind,target_id)
        values(new.follower_id,new.following_id,'follow_accept',new.following_id);
    end if;
  elsif tg_table_name='messages' then
    select case when c.created_by=new.sender_id then c.recipient_id else c.created_by end
       into recipient from public.conversations c where c.id=new.conversation_id;
    if recipient is not null then
      insert into public.notifications(user_id,actor_id,kind,target_id) values(recipient,new.sender_id,'message',new.conversation_id);
    end if;
  end if;
  return new;
end;$$;
revoke all on function public.vibra_notify_event() from public, anon, authenticated;
drop trigger if exists vibra_likes_notify on public.likes;
create trigger vibra_likes_notify after insert on public.likes for each row execute function public.vibra_notify_event();
drop trigger if exists vibra_comments_notify on public.comments;
create trigger vibra_comments_notify after insert on public.comments for each row execute function public.vibra_notify_event();
drop trigger if exists vibra_follows_notify on public.follows;
create trigger vibra_follows_notify after insert or update on public.follows for each row execute function public.vibra_notify_event();
drop trigger if exists vibra_messages_notify on public.messages;
create trigger vibra_messages_notify after insert on public.messages for each row execute function public.vibra_notify_event();

-- ====================================== STORAGE ======================================
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true, file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('media','media',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;

create policy "avatars upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "avatars replace own" on storage.objects for update to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "avatars read own metadata" on storage.objects for select to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id='media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "media read authorized" on storage.objects for select to authenticated using (
  bucket_id='media' and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists (select 1 from public.post_media pm join public.posts p on p.id=pm.post_id where pm.storage_path=name and public.can_see_user(p.user_id))
    or exists (select 1 from public.stories s where s.storage_path=name and s.expires_at>now() and public.can_see_user(s.user_id))
    or exists (select 1 from public.messages m join public.conversations c on c.id=m.conversation_id
       where m.media_path=name and ((c.created_by=(select auth.uid())) or (c.recipient_id=(select auth.uid()))))
  )
);
create policy "media remove own" on storage.objects for delete to authenticated
  using (bucket_id='media' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Tables must be exposed to authenticated role in Data API settings.
grant usage on schema public to authenticated;
grant select on public.profiles,public.follows,public.blocks,public.posts,public.post_media,
  public.likes,public.comments,public.saved_posts,public.stories,public.story_views,
  public.conversations,public.messages,public.notifications to authenticated;
grant insert, update, delete on public.profiles,public.follows,public.blocks,public.posts,public.post_media,public.likes,public.comments,public.saved_posts,public.stories,public.story_views,public.conversations,public.messages to authenticated;
revoke update on public.messages from authenticated;
grant update(read_at) on public.messages to authenticated;
grant update(is_read) on public.notifications to authenticated;

-- Realtime only needed for DMs, notifications and follow requests.
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.follows; exception when duplicate_object then null; end;
end $$;


-- ====================== VIBRA 2.0 INTEGRATED UPGRADE ======================
-- Upgrade is integrated for clean installs.
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

-- Enable realtime for message requests and approvals.
do $$ begin
  begin alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null; end;
end $$;
