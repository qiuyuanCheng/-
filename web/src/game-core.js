import { MAPS, MODES, BALLS, BALL_BY_ID, MOVEMENT_TUNING } from './game/configs_v2.js';
import { Simulation, createDefaultMatch, buildWalls } from './game/simulation_v2.js';
import { drawArena, loadBallAssets } from './game/arena_renderer.js';
import { AudioManager } from './game/audio_manager.js';

export function loadGameCore() {
  return Promise.resolve({ MAPS, MODES, BALLS, BALL_BY_ID, MOVEMENT_TUNING, Simulation, createDefaultMatch, buildWalls, drawArena, loadBallAssets, AudioManager });
}
