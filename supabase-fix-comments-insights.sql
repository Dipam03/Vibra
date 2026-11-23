-- Vibra v2.1: fix comments/replies, post view insights and story likes/views.
-- Safe to rerun on a Vibra v1/v2 database. Does not delete existing social data.
-- Apply to the existing Vibra Supabase project (SQL Editor), not to a new project.
begin;

-- Honor the owner's comment visibility and follow settings without RLS recursion.
create or replace function public.vibra_can_comment(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and public.can_see_user(target)
    and exists (
      select 1 from public.profiles p
      where p.id = target and (
        p.id = (select auth.uid())
        or p.comment_privacy = 'everyone'
        or (p.comment_privacy = 'followers' and exists (
          select 1 from public.follows f
          where f.following_id = target
            and f.follower_id = (select auth.uid())
            and f.status = 'accepted'
        ))
      )
    );
$$;
revoke all on function public.vibra_can_comment(uuid) from public, anon;
grant execute on function public.vibra_can_comment(uuid) to authenticated;

-- Validate reply parent on the database side; do NOT self-query comments in an RLS policy.
create or replace function public.vibra_check_comment_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.comments parent
    where parent.id = new.parent_id and parent.post_id = new.post_id
  ) then
    raise exception 'Reply parent must belong to the same post';
  end if;
  return new;
end;
$$;
revoke all on function public.vibra_check_comment_parent() from public, anon, authenticated;
drop trigger if exists vibra_comment_parent_check on public.comments;
create trigger vibra_comment_parent_check
  before insert or update of parent_id, post_id on public.comments
  for each row execute function public.vibra_check_comment_parent();

drop policy if exists "comments add" on public.comments;
create policy "comments add" on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.posts post
      where post.id = post_id and public.vibra_can_comment(post.user_id)
    )
  );

-- Post impressions: one record per signed-in viewer per post.
create table if not exists public.post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create index if not exists vibra_post_views_post_idx on public.post_views(post_id);
alter table public.post_views enable row level security;
drop policy if exists "v2 post views read" on public.post_views;
create policy "v2 post views read" on public.post_views
  for select to authenticated
  using (user_id=(select auth.uid()) or exists (
    select 1 from public.posts p where p.id=post_id and p.user_id=(select auth.uid())
  ));
drop policy if exists "v2 post views create" on public.post_views;
create policy "v2 post views create" on public.post_views
  for insert to authenticated
  with check (user_id=(select auth.uid()) and exists (
    select 1 from public.posts p
    where p.id=post_id and p.user_id<>(select auth.uid())
  ));
grant select,insert on public.post_views to authenticated;

-- Story likes: owners can see who liked a story; viewers can like and unlike.
create table if not exists public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(story_id,user_id)
);
create index if not exists vibra_story_likes_story_idx on public.story_likes(story_id);
alter table public.story_likes enable row level security;
drop policy if exists "v2 story likes read" on public.story_likes;
create policy "v2 story likes read" on public.story_likes
  for select to authenticated
  using (user_id=(select auth.uid()) or exists (
    select 1 from public.stories s where s.id=story_id and s.user_id=(select auth.uid())
  ));
drop policy if exists "v2 story likes insert" on public.story_likes;
create policy "v2 story likes insert" on public.story_likes
  for insert to authenticated
  with check (user_id=(select auth.uid()) and exists (
    select 1 from public.stories s
    where s.id=story_id and s.user_id<>(select auth.uid()) and s.expires_at>now()
  ));
drop policy if exists "v2 story likes delete" on public.story_likes;
create policy "v2 story likes delete" on public.story_likes
  for delete to authenticated using (user_id=(select auth.uid()));
grant select,insert,delete on public.story_likes to authenticated;

-- Tell the Data API to recognize new tables and policies immediately.
notify pgrst, 'reload schema';
commit;
