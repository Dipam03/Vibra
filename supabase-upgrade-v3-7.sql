-- Vibra 3.7: private cross-device Reel position and hashtag preferences. Run once in the
-- SQL Editor of the same Supabase project already configured in Vibra. Existing data is untouched.
begin;
create table if not exists public.reel_watch_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reel_id uuid references public.posts(id) on delete set null,
  position_seconds double precision not null default 0 check (position_seconds >= 0 and position_seconds < 864000),
  hashtag_preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(hashtag_preferences)='object'),
  updated_at timestamptz not null default now()
);
alter table public.reel_watch_state enable row level security;
drop policy if exists "reel watch state read own" on public.reel_watch_state;
create policy "reel watch state read own" on public.reel_watch_state for select to authenticated
using (user_id=(select auth.uid()));
drop policy if exists "reel watch state insert own" on public.reel_watch_state;
create policy "reel watch state insert own" on public.reel_watch_state for insert to authenticated
with check (user_id=(select auth.uid()) and (reel_id is null or exists
 (select 1 from public.posts p where p.id=reel_id and p.is_reel)));
drop policy if exists "reel watch state update own" on public.reel_watch_state;
create policy "reel watch state update own" on public.reel_watch_state for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()) and (reel_id is null or exists
 (select 1 from public.posts p where p.id=reel_id and p.is_reel)));
revoke all on public.reel_watch_state from anon;
grant select,insert,update on public.reel_watch_state to authenticated;
notify pgrst, 'reload schema';
commit;
