const LEGAL_BALL_IDS = new Set([
  "B01_SPIKE", "B02_SWORD", "B03_ARCHER", "B04_THREAD", "B05_LANCE", "B06_CHAIN",
  "B07_SAW", "B08_FLAME", "B09_FROST", "B10_ARC", "B11_CANNON", "B12_RICOCHET",
  "B13_MINE", "B14_SHIELD", "B15_DRILL", "B16_BOOMERANG", "B17_LASER", "B18_VENOM",
  "B19_STAR", "B20_SHRAPNEL", "B21_HARPOON", "B22_PRISM", "B23_PULSE", "B24_ANCHOR"
]);

const MAPS = {
  TRIANGLE: { sides: 3, radius: 600 },
  SQUARE: { sides: 4, radius: 600 },
  PENTAGON: { sides: 5, radius: 600 }
};

const MODES = {
  ONE_VS_ONE: { slots: ["A1", "B1"], teams: { A1: "A", B1: "B" } },
  ONE_VS_TWO: { slots: ["A1", "B1", "B2"], teams: { A1: "A", B1: "B", B2: "B" } },
  ONE_VS_THREE: { slots: ["A1", "B1", "B2", "B3"], teams: { A1: "A", B1: "B", B2: "B", B3: "B" } },
  TWO_VS_TWO: { slots: ["A1", "A2", "B1", "B2"], teams: { A1: "A", A2: "A", B1: "B", B2: "B" } },
  FFA_THREE: { slots: ["A1", "B1", "C1"], teams: { A1: "A", B1: "B", C1: "C" } }
};

const MAX_ROOM_SPEED = 900;
const DEFAULT_BALL_RADIUS = 82;

function sanitizeMatchForCreate(match) {
  const clean = sanitizeMatchBase(match);
  validateNoOverlap(clean.slots);
  return clean;
}

function sanitizeMatchBase(match) {
  if (!match || !MODES[match.mode]) throw new Error("mode invalid");
  if (!MAPS[match.map]) throw new Error("map invalid");
  const mode = MODES[match.mode];
  const slots = mode.slots.map((slotId) => {
    const incoming = (match.slots || []).find((slot) => slot && slot.slotId === slotId) || {};
    if (incoming.teamId && incoming.teamId !== mode.teams[slotId]) throw new Error("slot team invalid");
    return sanitizeSlot(incoming, slotId, mode.teams[slotId], match.map, { allowEmptyBall: mode.teams[slotId] !== "A" });
  });
  return {
    mode: match.mode,
    map: match.map,
    seed: isFiniteNumber(match.seed) ? Number(match.seed) : Date.now() % 1000000000,
    slots
  };
}

function sanitizeSlot(incoming, slotId, teamId, mapId, options) {
  const ballId = incoming.ballId || null;
  if (ballId || !(options && options.allowEmptyBall)) sanitizeBallId(ballId);
  const spawn = incoming.spawn ? sanitizePoint(incoming.spawn, mapId, "spawn invalid") : null;
  const initialVelocity = incoming.initialVelocity ? sanitizeVelocity(incoming.initialVelocity) : null;
  return {
    slotId,
    teamId,
    ballId,
    spawn,
    initialAngleDeg: sanitizeAngle(incoming.initialAngleDeg ?? 0),
    initialVelocity
  };
}

function sanitizeEditableSlots(roomMatch, incomingSlots, editableTeams) {
  const current = sanitizeMatchBase(roomMatch);
  const nextSlots = current.slots.map((slot) => {
    const incoming = (incomingSlots || []).find((s) => s && s.slotId === slot.slotId);
    if (!incoming || !editableTeams.includes(slot.teamId)) return slot;
    return Object.assign({}, slot, {
      ballId: sanitizeBallId(incoming.ballId ?? slot.ballId),
      spawn: sanitizePoint(incoming.spawn ?? slot.spawn, current.map, "spawn invalid"),
      initialAngleDeg: sanitizeAngle(incoming.initialAngleDeg ?? slot.initialAngleDeg ?? 0),
      initialVelocity: sanitizeVelocity(incoming.initialVelocity ?? slot.initialVelocity)
    });
  });
  const next = Object.assign({}, current, { slots: nextSlots });
  validateNoOverlap(next.slots);
  return next;
}

function sanitizeSelectionSlots(roomMatch, selectionSlots, editableTeams) {
  const current = sanitizeMatchBase(roomMatch);
  const nextSlots = current.slots.map((slot) => {
    const incoming = (selectionSlots || []).find((s) => s && s.slotId === slot.slotId);
    if (!incoming || !editableTeams.includes(slot.teamId)) return slot;
    return Object.assign({}, slot, {
      ballId: sanitizeBallId(incoming.ballId),
      spawn: null,
      initialAngleDeg: 0,
      initialVelocity: null
    });
  });
  return Object.assign({}, current, { slots: nextSlots });
}

function assertOwnPlacementComplete(match, editableTeams) {
  const slots = (match.slots || []).filter((slot) => editableTeams.includes(slot.teamId));
  if (!slots.length) throw new Error("no editable slot");
  if (slots.some((slot) => !slot.ballId || !slot.spawn || !slot.initialVelocity)) {
    throw new Error("placement incomplete");
  }
}

function sanitizeBallId(ballId) {
  if (!LEGAL_BALL_IDS.has(ballId)) throw new Error("ball invalid");
  return ballId;
}

function sanitizePoint(point, mapId, message) {
  if (!point || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) throw new Error(message || "point invalid");
  const out = { x: Number(point.x), y: Number(point.y) };
  if (!isPointInsideMap(out, mapId)) throw new Error(message || "point outside map");
  return out;
}

function sanitizeVelocity(v) {
  if (!v || !isFiniteNumber(v.x) || !isFiniteNumber(v.y)) throw new Error("velocity invalid");
  const x = Number(v.x), y = Number(v.y);
  const length = Math.sqrt(x * x + y * y);
  if (length <= 0.001) return { x: MAX_ROOM_SPEED, y: 0 };
  const scale = Math.min(1, MAX_ROOM_SPEED / length);
  return { x: x * scale, y: y * scale };
}

function sanitizeAngle(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function validateNoOverlap(slots) {
  const placed = (slots || []).filter((slot) => slot.spawn);
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const dx = placed[i].spawn.x - placed[j].spawn.x;
      const dy = placed[i].spawn.y - placed[j].spawn.y;
      if (Math.sqrt(dx * dx + dy * dy) < DEFAULT_BALL_RADIUS * 2) throw new Error("spawn overlap");
    }
  }
}

function isPointInsideMap(point, mapId) {
  const map = MAPS[mapId];
  if (!map) return false;
  if (mapId === "SQUARE") return Math.abs(point.x) <= 600 && Math.abs(point.y) <= 600;
  const verts = mapId === "TRIANGLE" ? triangleVertices() : regularVertices(map.sides);
  let sign = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 1e-6) continue;
    const current = cross > 0 ? 1 : -1;
    if (!sign) sign = current;
    else if (sign !== current) return false;
  }
  return true;
}

function triangleVertices() {
  const base = 1040;
  const half = base / 2;
  const side = base * 1.3;
  const height = Math.sqrt(side * side - half * half);
  return [
    { x: 0, y: -height / 2 },
    { x: half, y: height / 2 },
    { x: -half, y: height / 2 }
  ];
}

function regularVertices(sides) {
  const radius = 600 / Math.cos(Math.PI / sides);
  const start = -Math.PI / 2 + (sides === 4 ? Math.PI / 4 : 0);
  const verts = [];
  for (let i = 0; i < sides; i++) {
    verts.push({
      x: Math.cos(start + i * Math.PI * 2 / sides) * radius,
      y: Math.sin(start + i * Math.PI * 2 / sides) * radius
    });
  }
  return verts;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

module.exports = {
  LEGAL_BALL_IDS,
  MAPS,
  MODES,
  MAX_ROOM_SPEED,
  sanitizeMatchForCreate,
  sanitizeEditableSlots,
  sanitizeSelectionSlots,
  assertOwnPlacementComplete,
  sanitizeBallId,
  sanitizePoint,
  sanitizeVelocity,
  sanitizeAngle,
  isPointInsideMap,
  validateNoOverlap
};
