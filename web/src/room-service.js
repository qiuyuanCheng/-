import { supabase } from './supabase';

function unwrap(result) {
  if (result.error) throw result.error;
  const data = Array.isArray(result.data) ? result.data[0] : result.data;
  if (data == null) throw new Error('Supabase returned no room data.');
  return data;
}

export const rooms = {
  create: (match) => unwrap(supabase.rpc('create_ball_duel_room', { p_match: match })),
  join: (roomId) => unwrap(supabase.rpc('join_ball_duel_room', { p_room_id: roomId })),
  get: (roomId) => unwrap(supabase.rpc('get_ball_duel_room', { p_room_id: roomId })),
  patch: (roomId, patch) => unwrap(supabase.rpc('patch_ball_duel_room', { p_room_id: roomId, p_patch: patch })),
  subscribe(roomId, refresh) {
    const channel = supabase.channel(`room-${roomId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, refresh).subscribe();
    return () => supabase.removeChannel(channel);
  }
};

export async function saveMatch(summary) {
  const result = await supabase.from('matches').insert({ summary });
  if (result.error) throw result.error;
}

export async function listMatches() {
  const result = await supabase.from('matches').select('id, summary, created_at').order('created_at', { ascending: false }).limit(50);
  if (result.error) throw result.error;
  return result.data;
}
