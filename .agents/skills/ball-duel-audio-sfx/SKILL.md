---
name: ball-duel-audio-sfx
description: Improve procedural WebAudio hit SFX for the Ball Duel WeChat miniprogram. Use for modifying miniprogram/core/audio_manager.js, miniprogram/core/configs_v2.js, and simulation audio event handling so each ball has differentiated attack sounds based on its weapon style.
---

# Ball Duel Audio SFX Skill

## Project context
This project is a WeChat miniprogram auto-battle game. It uses fixed-step simulation in `miniprogram/core/simulation_v2.js`, canvas rendering in `miniprogram/core/arena_renderer.js`, and procedural placeholder SFX in `miniprogram/core/audio_manager.js` using `wx.createWebAudioContext()`.

Key files:
- `miniprogram/core/audio_manager.js`: procedural audio synthesis entry point.
- `miniprogram/core/configs_v2.js`: 24 balls, each with `audio.attackHitEvent`, `audio.wallImpactEvent`, and `audio.minSameSourceInterval`.
- `miniprogram/core/simulation_v2.js`: emits `{ type: "audio", eventName, sourceId, point, kind }` through `emitAudio()` and sends them to the page via `drainEvents()`.
- `miniprogram/pages/battle/battle.js`: calls `this.audio.play(event.eventName, event.point)`.
- `tests/simulation.test.js`: must still pass with `npm test`.

## Goal
Replace the current one-oscillator placeholder SFX with a lightweight procedural SFX engine that gives every ball a recognizable hit sound matching its attack identity, while staying safe for mobile performance and WeChat compatibility.

## Non-negotiables
1. Do not add copyrighted game audio assets.
2. Prefer procedural WebAudio synthesis over external files unless the user explicitly supplies licensed assets.
3. Keep simulation deterministic. Audio randomization is allowed only in presentation code, not in simulation results.
4. Never let audio failure break combat. If WebAudio is unavailable, silently no-op.
5. Keep global and per-event throttling; avoid audio spam during multi-hit weapons.
6. Run `npm test` after changes.

## Implementation plan
1. Refactor `audio_manager.js` into profile-driven synthesis:
   - `SFX_PROFILES[eventName]` table.
   - `play(eventName, point, meta)` as public method.
   - helper layers: `toneLayer`, `noiseLayer`, `clickLayer`, optional `filterNode`, `panner`.
   - random pitch/volume variation in a small range using `Math.random()` only inside audio code.
2. Support layered envelopes:
   - attack 0.003-0.015s;
   - decay 0.05-0.35s;
   - no long looping sound unless explicitly requested.
3. Add category fallback matching current event names:
   - spike/stab, blade/slash, arrow/pierce, toxic/acid, lance/thrust, hammer/impact, saw/grind, flame/burn, frost/crack, lightning/zap, cannon/blast, ricochet/tink, mine/thump, shield/block, drill/burr, boomerang/whoosh, laser/charge+zap, venom/bubble, star/chime, shrapnel/chips, harpoon/tether, prism/glass, pulse/force, anchor/chop.
4. Keep `SFX_BALL_WALL_IMPACT` universal: short `tok/tuk`, volume and pitch can vary slightly; same-ball throttle around 0.08s and global throttle for dense wall hits.
5. Optional: add `meta` from battle page using event.kind/sourceId if helpful, but do not alter simulation outcome.
6. Add minimal tests if possible:
   - profile table contains all 24 `attackHitEvent` values from `BALLS`.
   - `profileFor()` returns a valid profile for unknown events.
   - `npm test` remains green.

## Sound design table
- B01 SPIKE: dry sharp stab, short high transient + low body tick.
- B02 SWORD: clean metal slash, rising whoosh + bright cut.
- B03 ARCHER: bow twang + thin arrow whistle, very short impact click.
- B04 THREAD: sticky toxic wire slice, filtered hiss + sine scrape.
- B05 LANCE: fast piercing thrust, narrow high attack with falling body.
- B06 CHAIN: heavy low hammer, noisy impact + metallic tail.
- B07 SAW: short abrasive buzz, square/saw oscillator with noise.
- B08 FLAME: soft fire burst, filtered noise + warm low pop.
- B09 FROST: icy crack, glassy high partial + brittle noise.
- B10 ARC: electric zap, square wave jump + tiny random crackle.
- B11 CANNON: low boom, noise burst + falling low sawtooth.
- B12 RICOCHET: sharp blade ping, high metal chirp and quick bounce feel.
- B13 MINE: armed blast thump, deep hit + short explosion noise.
- B14 SHIELD: shield edge block/cut, bright block ping + dull thud.
- B15 DRILL: high-frequency drill burr, repeated micro-pulses under 0.18s.
- B16 BOOMERANG: air whoosh + crescent cut, mid sweep.
- B17 LASER: charge uses rising sine; hit uses focused bright zap.
- B18 VENOM: corrosive bubble pop, wet filtered noise + low gurgle.
- B19 STAR: star shuriken chime, quick metallic sparkle.
- B20 SHRAPNEL: multiple tiny chips, short clustered ticks.
- B21 HARPOON: hook impact + cable snap, metal hit then low twang.
- B22 PRISM: glass slice, high crystalline ping + shimmer.
- B23 PULSE: force thump, low sine impulse + expanding airy tail.
- B24 ANCHOR: heavy twin-edge chop, medium-low metal cut.

## Acceptance checklist
- Each of the 24 attack events has a distinct profile.
- Wall impact still works and remains subtle.
- Multi-hit weapons do not produce painful audio spam.
- Battle page runs even if `createStereoPanner`, `BiquadFilter`, or `createBufferSource` is unavailable.
- No external network audio loading.
- `npm test` passes.
