create index matches_user_created_at_idx on public.matches (user_id, created_at desc);
create index rooms_owner_id_idx on public.rooms (owner_id);
create index rooms_guest_id_idx on public.rooms (guest_id);

create policy "room matches are rpc only" on public.room_matches for all to authenticated using (false) with check (false);

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_ball_duel_room(jsonb) from public, anon, authenticated;
revoke all on function public.join_ball_duel_room(uuid) from public, anon, authenticated;
revoke all on function public.get_ball_duel_room(uuid) from public, anon, authenticated;
revoke all on function public.patch_ball_duel_room(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_ball_duel_room(jsonb), public.join_ball_duel_room(uuid), public.get_ball_duel_room(uuid), public.patch_ball_duel_room(uuid, jsonb) to authenticated;
