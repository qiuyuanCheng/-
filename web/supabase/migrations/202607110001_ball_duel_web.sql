create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'joined', 'ready', 'expired')),
  owner_ready boolean not null default false,
  guest_ready boolean not null default false,
  expires_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kept out of the Realtime table so an event cannot disclose the opponent's setup.
create table public.room_matches (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  payload jsonb not null
);

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.rooms enable row level security;
alter table public.room_matches enable row level security;

create policy "profiles are private" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "matches are private" on public.matches for select to authenticated using ((select auth.uid()) = user_id);
create policy "users add their own matches" on public.matches for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "participants receive room state events" on public.rooms for select to authenticated using ((select auth.uid()) in (owner_id, guest_id));

grant select, insert on public.profiles to authenticated;
grant select, insert on public.matches to authenticated;
grant select on public.rooms to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_ball_duel_room(p_match jsonb)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare v_room public.rooms;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_match is null or jsonb_typeof(p_match) <> 'object' then raise exception 'invalid match'; end if;
  insert into public.rooms (owner_id) values (auth.uid()) returning * into v_room;
  insert into public.room_matches (room_id, payload) values (v_room.id, p_match);
  return v_room;
end;
$$;

create or replace function public.join_ball_duel_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room public.rooms;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room not found'; end if;
  if v_room.expires_at < now() then update public.rooms set status = 'expired' where id = p_room_id; raise exception 'room expired'; end if;
  if v_room.owner_id <> auth.uid() and v_room.guest_id is not null and v_room.guest_id <> auth.uid() then raise exception 'room full'; end if;
  if v_room.owner_id <> auth.uid() and v_room.guest_id is null then
    update public.rooms set guest_id = auth.uid(), status = 'joined', updated_at = now() where id = p_room_id;
  end if;
  return public.get_ball_duel_room(p_room_id);
end;
$$;

create or replace function public.get_ball_duel_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room public.rooms; v_match jsonb; v_role text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'room not found'; end if;
  if v_room.owner_id = auth.uid() then v_role := 'owner';
  elsif v_room.guest_id = auth.uid() then v_role := 'guest';
  else v_role := 'viewer'; end if;
  if v_role = 'viewer' then return jsonb_build_object('id', v_room.id, 'status', v_room.status, 'role', v_role); end if;
  select payload into v_match from public.room_matches where room_id = p_room_id;
  return jsonb_build_object('id', v_room.id, 'status', v_room.status, 'role', v_role,
    'ownerReady', v_room.owner_ready, 'guestReady', v_room.guest_ready,
    'myPlaced', true, 'match', v_match, 'expiresAt', v_room.expires_at);
end;
$$;

create or replace function public.patch_ball_duel_room(p_room_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room public.rooms; v_is_owner boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or auth.uid() not in (v_room.owner_id, v_room.guest_id) then raise exception 'permission denied'; end if;
  if v_room.expires_at < now() then update public.rooms set status = 'expired' where id = p_room_id; raise exception 'room expired'; end if;
  v_is_owner := v_room.owner_id = auth.uid();
  if coalesce((p_patch->>'ready')::boolean, false) then
    if v_is_owner then update public.rooms set owner_ready = true, updated_at = now() where id = p_room_id;
    else update public.rooms set guest_ready = true, updated_at = now() where id = p_room_id; end if;
  end if;
  update public.rooms set status = case when owner_ready and guest_ready then 'ready' else status end, updated_at = now() where id = p_room_id;
  return public.get_ball_duel_room(p_room_id);
end;
$$;

revoke all on function public.create_ball_duel_room(jsonb), public.join_ball_duel_room(uuid), public.get_ball_duel_room(uuid), public.patch_ball_duel_room(uuid, jsonb) from public;
grant execute on function public.create_ball_duel_room(jsonb), public.join_ball_duel_room(uuid), public.get_ball_duel_room(uuid), public.patch_ball_duel_room(uuid, jsonb) to authenticated;

alter publication supabase_realtime add table public.rooms;
