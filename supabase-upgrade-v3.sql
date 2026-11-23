-- Vibra v3 upgrade. Safe to rerun on the original Vibra database or a v2 database.
-- Back up your project before applying schema changes. Keeps users/posts/messages.
begin;
alter table public.profiles add column if not exists comment_privacy text not null default 'everyone';
alter table public.profiles add column if not exists message_privacy text not null default 'everyone';
alter table public.profiles add column if not exists story_audience text not null default 'everyone';
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.conversations add column if not exists status text not null default 'accepted';
alter table public.messages add column if not exists shared_post_id uuid;
-- Remove share-only message when its source post is deleted, preventing invalid empty rows.
alter table public.messages drop constraint if exists messages_shared_post_id_fkey;
alter table public.messages add constraint messages_shared_post_id_fkey foreign key(shared_post_id) references public.posts(id) on delete cascade;
-- A message may contain text, an uploaded file, OR an in-app shared post/reel.
alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_check check (char_length(trim(body))>0 or media_path is not null or shared_post_id is not null);
create index if not exists vibra_dm_request_v3_idx on public.conversations(recipient_id,status,created_at desc);
create index if not exists vibra_messages_shared_post_idx on public.messages(shared_post_id) where shared_post_id is not null;

do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.conversations'::regclass and conname='vibra_conversation_status_check') then
   alter table public.conversations add constraint vibra_conversation_status_check check(status in('pending','accepted','declined'));
 end if;
end $$;

-- Users cannot fake the verification badge: it is derived only from accepted followers.
create or replace function public.vibra_recalculate_badge(target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 update public.profiles p set is_verified=(
   select count(*)>=500 from public.follows f where f.following_id=target and f.status='accepted'
 ) where p.id=target;
end $$;
revoke all on function public.vibra_recalculate_badge(uuid) from public,anon,authenticated;
create or replace function public.vibra_follow_badge_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='DELETE' then
   perform public.vibra_recalculate_badge(old.following_id);
 elsif tg_op='INSERT' then
   perform public.vibra_recalculate_badge(new.following_id);
 else
   if new.following_id is distinct from old.following_id then
     perform public.vibra_recalculate_badge(old.following_id);
   end if;
   perform public.vibra_recalculate_badge(new.following_id);
 end if;
 return null;
end $$;
revoke all on function public.vibra_follow_badge_update() from public,anon,authenticated;
drop trigger if exists vibra_follow_badge_update on public.follows;
create trigger vibra_follow_badge_update after insert or update of status,following_id or delete
  on public.follows for each row execute function public.vibra_follow_badge_update();
update public.profiles p set is_verified=(select count(*)>=500 from public.follows f where f.following_id=p.id and f.status='accepted');
-- RLS protects row ownership; column-level grants protect server-calculated is_verified.
revoke update on public.profiles from authenticated;
grant update(username,display_name,bio,website,avatar_path,is_private,comment_privacy,message_privacy,story_audience,updated_at)
  on public.profiles to authenticated;

-- New requests respect the target's privacy AND blocks; existing accepted chats persist.
create or replace function public.vibra_can_request_dm(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select (select auth.uid()) is not null and target<>(select auth.uid())
  and not exists(select 1 from public.blocks b where
    (b.blocker_id=target and b.blocked_id=(select auth.uid()))
    or (b.blocked_id=target and b.blocker_id=(select auth.uid())))
  and exists(select 1 from public.profiles p where p.id=target and (
    p.message_privacy='everyone' or (p.message_privacy='followers' and exists(
       select 1 from public.follows f where f.follower_id=(select auth.uid())
       and f.following_id=target and f.status='accepted'))
  ));
$$;
revoke all on function public.vibra_can_request_dm(uuid) from public,anon;
grant execute on function public.vibra_can_request_dm(uuid) to authenticated;

-- A mutual *accepted* follow goes straight to Messages, otherwise Requests.
-- Profile follow approvals for private accounts are NOT bypassed.
create or replace function public.vibra_initialize_dm()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.created_by is distinct from (select auth.uid()) or not public.vibra_can_request_dm(new.recipient_id) then
   raise exception 'Messaging is blocked or this account does not accept new messages';
 end if;
 if exists(select 1 from public.follows f where f.follower_id=new.created_by and f.following_id=new.recipient_id and f.status='accepted')
    and exists(select 1 from public.follows f where f.follower_id=new.recipient_id and f.following_id=new.created_by and f.status='accepted') then
   new.status='accepted';
 else
   new.status='pending';
 end if;
 return new;
end $$;
revoke all on function public.vibra_initialize_dm() from public,anon,authenticated;
drop trigger if exists vibra_dm_initialize on public.conversations;
create trigger vibra_dm_initialize before insert on public.conversations for each row execute function public.vibra_initialize_dm();
drop policy if exists "conversations start" on public.conversations;
create policy "conversations start" on public.conversations for insert to authenticated
 with check(created_by=(select auth.uid()) and public.vibra_can_request_dm(recipient_id));
drop policy if exists "v2 conversations manage requests" on public.conversations;
create policy "v2 conversations manage requests" on public.conversations for update to authenticated
 using(recipient_id=(select auth.uid()) and status='pending')
 with check(recipient_id=(select auth.uid()) and status in('accepted','declined'));
revoke update on public.conversations from authenticated;
grant update(status) on public.conversations to authenticated;

-- When a follow becomes mutual, pending DM requests are automatically accepted.
create or replace function public.vibra_accept_mutual_dm()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status='accepted' and exists(select 1 from public.follows f where
   f.follower_id=new.following_id and f.following_id=new.follower_id and f.status='accepted') then
   update public.conversations c set status='accepted'
   where c.status='pending' and c.pair_key=(least(new.follower_id::text,new.following_id::text)||':'||greatest(new.follower_id::text,new.following_id::text));
 end if;
 return null;
end $$;
revoke all on function public.vibra_accept_mutual_dm() from public,anon,authenticated;
drop trigger if exists vibra_accept_mutual_dm on public.follows;
create trigger vibra_accept_mutual_dm after insert or update of status on public.follows
 for each row execute function public.vibra_accept_mutual_dm();
-- Apply the mutual-follow rule to requests already in the database.
update public.conversations c set status='accepted'
where c.status='pending'
 and exists(select 1 from public.follows f where f.follower_id=c.created_by and f.following_id=c.recipient_id and f.status='accepted')
 and exists(select 1 from public.follows f where f.follower_id=c.recipient_id and f.following_id=c.created_by and f.status='accepted');

-- Enforce recipient replies and the one-initial-message rule in the DATABASE.
create or replace function public.vibra_can_send_dm(chat_id uuid, sender uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
 select (select auth.uid())=sender and exists(select 1 from public.conversations c
 where c.id=chat_id and (c.created_by=sender or c.recipient_id=sender)
 and not exists(select 1 from public.blocks b where
   (b.blocker_id=c.created_by and b.blocked_id=c.recipient_id)
   or (b.blocked_id=c.created_by and b.blocker_id=c.recipient_id))
 and (c.status='accepted'
   or (c.status='pending' and c.recipient_id=sender)
   or (c.status='pending' and c.created_by=sender and not exists(
      select 1 from public.messages m where m.conversation_id=chat_id))));
$$;
revoke all on function public.vibra_can_send_dm(uuid,uuid) from public,anon;
grant execute on function public.vibra_can_send_dm(uuid,uuid) to authenticated;

create or replace function public.vibra_verify_dm_send()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 c public.conversations%rowtype;
 author_id uuid;
 viewer_id uuid;
begin
 select * into c from public.conversations where id=new.conversation_id for update;
 if not found or not public.vibra_can_send_dm(new.conversation_id,new.sender_id) then
   raise exception 'Message cannot be sent: request is pending, declined or blocked';
 end if;
 if new.shared_post_id is not null then
   select p.user_id into author_id from public.posts p where p.id=new.shared_post_id;
   if author_id is null then raise exception 'Shared post does not exist'; end if;
   -- Never leak private posts via an otherwise authorized chat.
   foreach viewer_id in array array[c.created_by,c.recipient_id] loop
     if exists(select 1 from public.blocks b where
       (b.blocker_id=viewer_id and b.blocked_id=author_id) or (b.blocked_id=viewer_id and b.blocker_id=author_id))
       or not exists(select 1 from public.profiles a where a.id=author_id and (
         a.is_private=false or a.id=viewer_id or exists(select 1 from public.follows f
           where f.follower_id=viewer_id and f.following_id=author_id and f.status='accepted'))) then
       raise exception 'The recipient cannot view this private post or reel';
     end if;
   end loop;
 end if;
 if c.status='pending' and c.recipient_id=new.sender_id then
   update public.conversations set status='accepted' where id=c.id;
 end if;
 return new;
end $$;
revoke all on function public.vibra_verify_dm_send() from public,anon,authenticated;
drop trigger if exists vibra_dm_send_guard on public.messages;
create trigger vibra_dm_send_guard before insert on public.messages for each row execute function public.vibra_verify_dm_send();
drop policy if exists "messages send" on public.messages;
create policy "messages send" on public.messages for insert to authenticated
 with check(sender_id=(select auth.uid()) and public.vibra_can_send_dm(conversation_id,sender_id)
  and (media_path is null or media_path like ((select auth.uid())::text||'/%')));
-- Note: RLS WITH CHECK is evaluated AFTER BEFORE triggers; reply updates chat status to accepted first.
-- Message unsend: owner only. Others' messages cannot be removed by this API.
drop policy if exists "v3 messages unsend" on public.messages;
create policy "v3 messages unsend" on public.messages for delete to authenticated using(sender_id=(select auth.uid()));
grant delete on public.messages to authenticated;
-- Read receipts may only edit read_at, not sender, content, or shared reels.
revoke update on public.messages from authenticated;
grant update(read_at) on public.messages to authenticated;

-- Realtime: changes in requests visible to both participants.
do $$ begin
 begin alter publication supabase_realtime add table public.conversations;
 exception when duplicate_object then null; end;
end $$;
notify pgrst,'reload schema';
commit;
