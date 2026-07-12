import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureAnonymousSession, hasSupabase } from './supabase';
import { listMatches, rooms, saveMatch } from './room-service';
import { loadGameCore } from './game-core';

const image = (id) => `/assets/balls/${id}.png`;
const routeFromHash = () => location.hash.slice(1) || '/';
const readMatch = () => JSON.parse(localStorage.getItem('ball-duel-match') || 'null');

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [core, setCore] = useState(null);
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState('');
  const go = useCallback((path) => { location.hash = path; setRoute(path); }, []);
  const notify = useCallback(setMessage, []);
  useEffect(() => { const update = () => setRoute(routeFromHash()); addEventListener('hashchange', update); return () => removeEventListener('hashchange', update); }, []);
  useEffect(() => { loadGameCore().then(setCore).catch((error) => notify(error.message)); }, [notify]);
  useEffect(() => { if (hasSupabase) ensureAnonymousSession().then(setSession).catch((error) => notify(`Anonymous sign-in failed: ${error.message}`)); }, [notify]);
  const props = { core, go, notify };
  let page = <Home {...props} />;
  if (route === '/setup') page = <Setup {...props} />;
  if (route === '/showcase') page = <Showcase {...props} />;
  if (route === '/history') page = <History {...props} />;
  if (route === '/room') page = <RoomLobby {...props} />;
  if (route.startsWith('/room/')) page = <Room {...props} roomId={route.split('/')[2]} />;
  if (route === '/battle') page = <Battle {...props} match={readMatch()} />;
  return <main className="app"><header><button className="brand" onClick={() => go('/')}>BALL DUEL</button><span>{hasSupabase ? (session ? 'Guest player ready' : 'Connecting...') : 'Local demo mode'}</span></header>{message && <div className="notice" onClick={() => notify('')}>{message}</div>}{page}</main>;
}

function Home({ core, go }) { return <section className="hero"><p className="eyebrow">AUTO WEAPON BALL DUEL</p><h1>Choose your ball.<br/>Win the arena.</h1><p className="lead">24 weapon balls, deterministic physics, and private friend rooms.</p><div className="actions"><button className="primary" disabled={!core} onClick={() => go('/setup')}>{'\u81ea\u4e3b\u6a21\u62df'}</button><button onClick={() => go('/room')}>{'\u597d\u53cb\u623f\u95f4'}</button></div><nav className="nav-cards"><button onClick={() => go('/showcase')}>{'\u7403\u4f53\u56fe\u9274'} <small>All 24 weapons</small></button><button onClick={() => go('/history')}>{'\u5386\u53f2\u6218\u7ee9'} <small>Your latest results</small></button></nav></section>; }

function Setup({ core, go }) {
  const [mode, setMode] = useState('ONE_VS_ONE'); const [map, setMap] = useState('SQUARE'); const [choices, setChoices] = useState({});
  if (!core) return <Loading />;
  const match = core.createDefaultMatch(mode); match.map = map; match.slots.forEach((slot) => { if (choices[slot.slotId]) slot.ballId = choices[slot.slotId]; });
  const start = () => { localStorage.setItem('ball-duel-match', JSON.stringify(match)); go('/battle'); };
  return <section><Back go={go}/><h2>Configure a duel</h2><div className="form-row"><label>Mode<select value={mode} onChange={(e) => setMode(e.target.value)}>{Object.values(core.MODES).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Arena<select value={map} onChange={(e) => setMap(e.target.value)}>{Object.values(core.MAPS).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><div className="slots">{match.slots.map((slot) => <Picker key={slot.slotId} core={core} slot={slot} choose={(id) => setChoices({ ...choices, [slot.slotId]: id })}/>)}</div><button className="primary wide" onClick={start}>Launch battle</button></section>;
}

function Picker({ core, slot, choose }) { const ball = core.BALL_BY_ID[slot.ballId]; return <article className="slot"><img src={image(ball.id)} /><div><b>{slot.slotId}: {ball.name}</b><small>{ball.visual.visualBrief}</small></div><select value={ball.id} onChange={(event) => choose(event.target.value)}>{core.BALLS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></article>; }
function Showcase({ core, go }) { if (!core) return <Loading />; return <section><Back go={go}/><h2>Ball collection</h2><div className="gallery">{core.BALLS.map((ball) => <article key={ball.id}><img src={image(ball.id)} /><b>{ball.name}</b><small>{ball.visual.visualBrief}</small></article>)}</div></section>; }

function Battle({ core, go, notify, match }) {
  const canvasRef = useRef(null); const [result, setResult] = useState(null); const [sound, setSound] = useState(true);
  useEffect(() => { if (!core || !canvasRef.current || !match) return; const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const simulation = new core.Simulation(match); const audio = new core.AudioManager(); audio.setEnabled(sound); const assets = {}; let frame; let stopped = false; const unlock = () => audio.ctx?.resume?.(); const resize = () => { const rect = canvas.getBoundingClientRect(); const ratio = devicePixelRatio || 1; canvas.width = rect.width * ratio; canvas.height = rect.height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); }; resize(); addEventListener('pointerdown', unlock, { once: true }); core.loadBallAssets(canvas, simulation.snapshot().balls, (loaded) => Object.assign(assets, loaded)); const loop = () => { if (stopped) return; for (let i = 0; i < 2 && !simulation.result; i += 1) simulation.step(); const snapshot = simulation.snapshot(); simulation.events.splice(0).filter((event) => event.type === 'audio').forEach((event) => audio.play(event.eventName, event.point, { sourceId: event.sourceId })); core.drawArena(ctx, snapshot, canvas.clientWidth, canvas.clientHeight, match.map, { assets, visualLimits: true }); if (simulation.result) { setResult(simulation.result); return; } frame = requestAnimationFrame(loop); }; loop(); return () => { stopped = true; cancelAnimationFrame(frame); removeEventListener('pointerdown', unlock); cancelAnimationFrame(frame); audio.destroy(); }; }, [core, match, sound]);
  const save = async () => { const summary = { ...result, mode: match?.mode, map: match?.map, seed: match?.seed }; try { if (hasSupabase) await saveMatch(summary); else { const old = JSON.parse(localStorage.getItem('ball-duel-history') || '[]'); localStorage.setItem('ball-duel-history', JSON.stringify([{ summary, created_at: new Date().toISOString() }, ...old].slice(0, 50))); } notify('Match saved'); } catch (error) { notify(`Save failed: ${error.message}`); } };
  if (!match) return <section><Back go={go}/><p>No match configuration found.</p></section>;
  return <section className="battle"><Back go={go}/><div className="battle-bar"><h2>Auto battle</h2><button onClick={() => setSound(!sound)}>Sound: {sound ? 'on' : 'off'}</button></div><canvas className="arena" ref={canvasRef}/>{result && <div className="result"><h2>{result.winnerTeam ? `${result.winnerTeam} wins` : 'Draw'}</h2><button className="primary" onClick={save}>Save result</button><button onClick={() => go('/setup')}>Play again</button></div>}</section>;
}

function RoomLobby({ core, go, notify }) { const [id, setId] = useState(''); const create = async () => { if (!hasSupabase || !core) return notify('Configure Supabase before creating rooms.'); try { await ensureAnonymousSession(); const room = await rooms.create(core.createDefaultMatch('ONE_VS_ONE')); if (!room?.id) throw new Error('Supabase returned no room id. Please check the project migration and try again.'); go(`/room/${room.id}`); } catch (error) { notify(`Could not create room: ${error.message}`); } }; return <section><Back go={go}/><h2>Friend room</h2><p className="lead">Create a room and share its browser link. Both players run the same seed when ready.</p><button className="primary" onClick={create}>Create room</button><label className="join">Room ID<input value={id} onChange={(event) => setId(event.target.value.trim())} placeholder="Paste a room ID"/><button disabled={!id} onClick={() => go(`/room/${id}`)}>Join</button></label></section>; }

function Room({ roomId, go, notify }) { const [room, setRoom] = useState(null); const refresh = useCallback(() => rooms.get(roomId).then(setRoom).catch((error) => notify(`Could not read room: ${error.message}`)), [roomId, notify]); useEffect(() => { if (!hasSupabase) return; refresh(); return rooms.subscribe(roomId, refresh); }, [roomId, refresh]); if (!hasSupabase) return <section><Back go={go}/><p>Friend rooms need Supabase configuration.</p></section>; if (!room) return <Loading/>; const share = () => navigator.clipboard?.writeText(location.href).then(() => notify('Invite link copied.')); const enter = () => { localStorage.setItem('ball-duel-match', JSON.stringify(room.match)); go('/battle'); }; return <section><Back go={go}/><h2>Friend room</h2><p>State: {room.status}; role: {room.role}</p><p className="room-id">{roomId}</p><button onClick={share}>Copy invite link</button>{room.role === 'viewer' && <button className="primary" onClick={() => rooms.join(roomId).then(setRoom).catch((error) => notify(error.message))}>Join room</button>}{room.role !== 'viewer' && room.status !== 'ready' && <button className="primary" onClick={() => rooms.patch(roomId, { ready: true }).then(setRoom).catch((error) => notify(error.message))}>Ready</button>}{room.status === 'ready' && <button className="primary" onClick={enter}>Enter battle</button>}</section>; }
function History({ go, notify }) { const [items, setItems] = useState([]); useEffect(() => { (hasSupabase ? listMatches() : Promise.resolve(JSON.parse(localStorage.getItem('ball-duel-history') || '[]'))).then(setItems).catch((error) => notify(error.message)); }, [notify]); return <section><Back go={go}/><h2>Match history</h2>{items.length ? <div className="history">{items.map((item) => <article key={item.id || item.created_at}><b>{item.summary?.winnerTeam ? `${item.summary.winnerTeam} wins` : 'Draw'}</b><small>{new Date(item.created_at).toLocaleString()}</small></article>)}</div> : <p className="muted">No saved results yet.</p>}</section>; }
function Back({ go }) { return <button className="back" onClick={() => go('/')}>Back to home</button>; }
function Loading() { return <section><p className="muted">Loading battle core...</p></section>; }
