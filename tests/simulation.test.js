const assert = require("assert");
const { Simulation, createDefaultMatch } = require("../miniprogram/core/simulation_v2");
const { BALLS, MODES } = require("../miniprogram/core/configs_v2");
const { SFX_PROFILES, profileFor } = require("../miniprogram/core/audio_manager");
const { feedbackLevel, isTrueDot, isThrottledArea, visualStyleForSource } = require("../miniprogram/core/presentation_feedback");
const { buildSummary, finalHitText } = require("../miniprogram/core/result_report");
const { sanitizeMatchForCreate, sanitizeEditableSlots, assertOwnPlacementComplete, sanitizeAngle } = require("../cloudfunctions/rooms/room_validation");

function run(config) {
  const sim = new Simulation(config);
  return sim.runUntilDone(90);
}

const base = createDefaultMatch("ONE_VS_ONE");
base.seed = 12345;
base.slots[0].ballId = "B03_ARCHER";
base.slots[1].ballId = "B07_SAW";
const a = run(base);
const b = run(JSON.parse(JSON.stringify(base)));
assert.deepStrictEqual(a, b, "same seed and config should produce same result");

for (const ball of BALLS) {
  const config = createDefaultMatch("ONE_VS_ONE");
  config.seed = 1000 + BALLS.indexOf(ball);
  config.slots[0].ballId = ball.id;
  config.slots[1].ballId = "B03_ARCHER";
  const sim = new Simulation(config);
  const result = sim.runUntilDone(90);
  assert(result.winnerTeam, `${ball.id} should finish with winner`);
  assert(result.duration <= 90.02, `${ball.id} should respect timeout`);
  const hadAudio = sim.drainEvents().some((event) => event.type === "audio");
  assert(hadAudio || result.balls.some((item) => item.damageDone > 0), `${ball.id} should produce combat activity`);
}

for (const mode of Object.keys(MODES)) {
  const config = createDefaultMatch(mode);
  config.seed = 2222;
  const result = run(config);
  assert(result.winnerTeam, `${mode} should produce winner`);
}

const collision = createDefaultMatch("ONE_VS_ONE");
collision.seed = 777;
collision.slots[0].spawn = { x: -45, y: 0 };
collision.slots[1].spawn = { x: 45, y: 0 };
collision.slots[0].initialVelocity = { x: 360, y: 0 };
collision.slots[1].initialVelocity = { x: -360, y: 0 };
const sim = new Simulation(collision);
for (let i = 0; i < 180; i++) sim.step();
const distance = Math.hypot(sim.balls[0].pos.x - sim.balls[1].pos.x, sim.balls[0].pos.y - sim.balls[1].pos.y);
assert(distance > sim.balls[0].radius + sim.balls[1].radius - 1, "head-on balls should not remain stuck together");

const attackEvents = BALLS.map((ball) => ball.audio.attackHitEvent);
assert.strictEqual(new Set(attackEvents).size, 24, "24 balls should use independent attack hit events");
for (const eventName of attackEvents) {
  assert(SFX_PROFILES[eventName], `${eventName} should have a dedicated audio profile`);
  const profile = profileFor(eventName);
  assert.strictEqual(profile, SFX_PROFILES[eventName], `${eventName} should map directly to its dedicated profile`);
  assert(Array.isArray(profile.layers) && profile.layers.length > 0, `${eventName} should contain synth layers`);
}
assert(profileFor("SFX_UNKNOWN_EVENT").layers.length > 0, "unknown events should fall back to a safe profile");
assert(profileFor("SFX_BALL_WALL_IMPACT").minInterval >= 0.08, "wall impact profile should stay throttled");

const damageConfig = createDefaultMatch("ONE_VS_ONE");
const damageSim = new Simulation(damageConfig);
const target = damageSim.balls[1];
target.hp = 10;
damageSim.damage(target, 7, null, "body", { x: 1, y: 2 });
let damageEvent = damageSim.drainEvents().find((event) => event.type === "damage");
assert.strictEqual(damageEvent.hpBefore, 10, "damage event should expose hpBefore");
assert.strictEqual(damageEvent.hpAfter, 3, "damage event should expose hpAfter");
assert.strictEqual(damageEvent.killed, false, "non-lethal damage should not be killed");
damageSim.damage(target, 5, null, "body", { x: 1, y: 2 });
damageEvent = damageSim.drainEvents().find((event) => event.type === "damage");
assert.strictEqual(damageEvent.hpBefore, 3, "lethal damage should record pre-hit hp");
assert.strictEqual(damageEvent.hpAfter, 0, "lethal damage should clamp hpAfter to zero");
assert.strictEqual(damageEvent.killed, true, "lethal damage should set killed once");
damageSim.damage(target, 5, null, "body", { x: 1, y: 2 });
assert(!damageSim.drainEvents().some((event) => event.type === "damage"), "dead target should not emit extra kill damage");

assert.strictEqual(feedbackLevel(8, "body", false), "normal", "small damage should be normal");
assert.strictEqual(feedbackLevel(22, "body", false), "medium", "20 damage should be medium");
assert.strictEqual(feedbackLevel(45, "body", false), "high", "40-60 damage should be high");
assert.strictEqual(feedbackLevel(61, "body", false), "heavy", "damage above 60 should be heavy");
assert.strictEqual(feedbackLevel(120, "body", true), "kill", "kill should override numeric level");
assert.strictEqual(feedbackLevel(80, "corrosionDot", false), "dot", "true DOT should stay subdued");
assert.strictEqual(feedbackLevel(45, "flameRing", false), "high", "area flame damage should still use numeric feedback");
assert.strictEqual(feedbackLevel(45, "fieldZone", false), "high", "field zone damage should not become DOT");
assert(isTrueDot("corrosionDot"), "corrosionDot should be true DOT");
assert(!isTrueDot("flameRing"), "flameRing should not be true DOT");
assert(isThrottledArea("prismZone"), "prism zones should be throttled as area damage");
assert.strictEqual(visualStyleForSource("fieldZone"), "force", "fieldZone should use force style");
assert.strictEqual(visualStyleForSource("flameRing"), "flame", "flameRing should use flame style");
assert.strictEqual(visualStyleForSource("line", "B21_HARPOON"), "metal", "harpoon line should use metal style");

const report = buildSummary({
  winnerTeam: "A",
  map: "SQUARE",
  duration: 12.5,
  balls: [
    { teamId: "A", name: "胜方球", hp: 80, damageDone: 40, hits: 2 },
    { teamId: "B", name: "败方高输出", hp: 0, damageDone: 120, hits: 7 }
  ],
  presentationStats: { totalDamage: 160, highestSingle: 50, highestCombo: 3, finalHit: { sourceName: "胜方球", targetName: "败方高输出", sourceType: "body", amount: 50 } }
});
assert.strictEqual(report.mvpName, "胜方球", "MVP should default to winner team");
assert.strictEqual(report.loserBestName, "败方高输出", "high-output loser should be shown separately");
assert.strictEqual(report.mapLabel, "正方形", "map label should be localized");
assert(finalHitText({ timeout: true }, { sourceName: "A", targetName: "B", sourceType: "body", amount: 8 }).indexOf("超时判定胜负") >= 0, "timeout text should not claim a finish");

const roomMatch = {
  mode: "ONE_VS_ONE",
  map: "SQUARE",
  seed: 1,
  slots: [
    { slotId: "A1", teamId: "A", ballId: "B01_SPIKE", spawn: null, initialVelocity: null, initialAngleDeg: 0 },
    { slotId: "B1", teamId: "B", ballId: null, spawn: null, initialVelocity: null, initialAngleDeg: 0 }
  ]
};
const sanitizedRoom = sanitizeMatchForCreate(roomMatch);
assert.strictEqual(sanitizedRoom.slots[0].ballId, "B01_SPIKE", "room create should keep legal owner ball");
assert.throws(() => sanitizeMatchForCreate(Object.assign({}, roomMatch, { mode: "BAD" })), /mode invalid/, "invalid mode should fail");
assert.throws(() => sanitizeMatchForCreate(Object.assign({}, roomMatch, { map: "BAD" })), /map invalid/, "invalid map should fail");
assert.strictEqual(sanitizeAngle(0), 0, "zero angle should be preserved");
const placedMatch = sanitizeEditableSlots(roomMatch, [{ slotId: "A1", ballId: "B02_SWORD", spawn: { x: -120, y: 0 }, initialVelocity: { x: 5000, y: 0 }, initialAngleDeg: 0 }], ["A"]);
assert(placedMatch.slots[0].initialVelocity.x <= 900, "room velocity should be clamped");
assertOwnPlacementComplete(placedMatch, ["A"]);
assert.throws(() => assertOwnPlacementComplete(roomMatch, ["A"]), /placement incomplete/, "placed/ready should require full placement");
assert.throws(() => sanitizeEditableSlots(roomMatch, [{ slotId: "A1", ballId: "B02_SWORD", spawn: { x: 2000, y: 0 }, initialVelocity: { x: 1, y: 0 } }], ["A"]), /spawn invalid/, "outside-map spawn should fail");
assert.throws(() => sanitizeMatchForCreate({
  mode: "TWO_VS_TWO",
  map: "SQUARE",
  seed: 2,
  slots: [
    { slotId: "A1", teamId: "A", ballId: "B01_SPIKE", spawn: { x: 0, y: 0 }, initialVelocity: { x: 1, y: 0 } },
    { slotId: "A2", teamId: "A", ballId: "B02_SWORD", spawn: { x: 10, y: 0 }, initialVelocity: { x: -1, y: 0 } },
    { slotId: "B1", teamId: "B", ballId: null, spawn: null, initialVelocity: null },
    { slotId: "B2", teamId: "B", ballId: null, spawn: null, initialVelocity: null }
  ]
}), /spawn overlap/, "overlapping spawns should fail");

console.log("simulation tests passed");
