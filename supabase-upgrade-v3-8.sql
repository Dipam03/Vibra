-- Vibra v3.8: unique video Reel viewers and public Reel view totals.
-- Safe for existing accounts/posts, and idempotent. Requires v3.x posts/profiles schema.
begin;
create schema if not exists vibra_internal;
revoke all on schema vibra_internal from public, anon, authenticated;

create table if not exists public.reel_video_views (
  reel_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (reel_id, viewer_id)
);
create index if not exists vibra_reel_video_views_user_idx on public.reel_video_views(viewer_id);
alter table public.reel_video_views enable row level security;
drop policy if exists "reel viewers own rows" on public.reel_video_views;
create policy "reel viewers own rows" on public.reel_video_views
  for select to authenticated using (viewer_id=(select auth.uid()));
drop policy if exists "reel views add while accessible" on public.reel_video_views;
create policy "reel views add while accessible" on public.reel_video_views
  for insert to authenticated
  with check (
    viewer_id=(select auth.uid()) and
    exists(select 1 from public.posts p where p.id=reel_id and p.is_reel and p.user_id<>(select auth.uid()))
  );
revoke all on public.reel_video_views from anon, authenticated;
grant select, insert on public.reel_video_views to authenticated;

create table if not exists public.reel_view_totals (
  reel_id uuid primary key references public.posts(id) on delete cascade,
  views bigint not null default 0 check (views>=0)
);
alter table public.reel_view_totals enable row level security;
drop policy if exists "reel totals visible if reel visible" on public.reel_view_totals;
create policy "reel totals visible if reel visible" on public.reel_view_totals
  for select to authenticated
  using (exists(select 1 from public.posts p where p.id=reel_id and p.is_reel));
revoke all on public.reel_view_totals from anon, authenticated;
grant select on public.reel_view_totals to authenticated;

create or replace function vibra_internal.adjust_reel_view_total()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP='INSERT' then
    insert into public.reel_view_totals(reel_id,views) values(new.reel_id,1)
      on conflict(reel_id) do update set views=public.reel_view_totals.views+1;
  elsif TG_OP='DELETE' then
    update public.reel_view_totals set views=greatest(0,views-1) where reel_id=old.reel_id;
  end if;
  return null;
end $$;
revoke all on function vibra_internal.adjust_reel_view_total() from public,anon,authenticated;
drop trigger if exists vibra_reel_views_counter on public.reel_video_views;
create trigger vibra_reel_views_counter after insert or delete on public.reel_video_views
  for each row execute function vibra_internal.adjust_reel_view_total();
-- Recalculate totals so rerunning the migration is safe even after view rows exist.
insert into public.reel_view_totals(reel_id,views)
select p.id, count(rv.viewer_id)::bigint from public.posts p
left join public.reel_video_views rv on rv.reel_id=p.id
where p.is_reel group by p.id
on conflict(reel_id) do update set views=excluded.views;
notify pgrst, 'reload schema';
commit;
