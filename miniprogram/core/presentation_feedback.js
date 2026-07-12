const TRUE_DOT_SOURCE_TYPES = new Set([
  "corrosionDot",
  "poison",
  "burn",
  "bleed",
  "damageOverTime"
]);

const THROTTLED_AREA_SOURCE_TYPES = new Set([
  "fieldZone",
  "line",
  "flameRing",
  "flameTrail",
  "prismZone"
]);

const DAMAGE_FEEDBACK_LEVELS = {
  dot: { size: 18, life: 520, vy: -38, color: "#67ff5c", priority: 0, ring: 0, shake: 0 },
  normal: { size: 22, life: 620, vy: -48, color: "#ffffff", priority: 1, ring: 0, shake: 0 },
  medium: { size: 28, life: 700, vy: -62, color: "#d8fff9", priority: 2, ring: 34, shake: 0.8, shakeMs: 70 },
  high: { size: 36, life: 820, vy: -76, color: "#ffd86b", priority: 3, ring: 64, shake: 3.2, shakeMs: 140, suffix: "!" },
  heavy: { size: 46, life: 960, vy: -90, color: "#ff5f7d", priority: 4, ring: 92, shake: 6, shakeMs: 210, suffix: "!!" },
  kill: { size: 52, life: 1100, vy: -98, color: "#ff3d3d", priority: 5, ring: 118, shake: 7, shakeMs: 240, label: "K.O." }
};

function isTrueDot(sourceType) {
  return TRUE_DOT_SOURCE_TYPES.has(sourceType);
}

function isThrottledArea(sourceType) {
  return THROTTLED_AREA_SOURCE_TYPES.has(sourceType);
}

function feedbackLevel(amount, sourceType, killed) {
  const value = Number(amount) || 0;
  if (killed) return "kill";
  if (isTrueDot(sourceType)) return "dot";
  if (value > 60) return "heavy";
  if (value >= 40) return "high";
  if (value >= 20) return "medium";
  if (value > 0) return "normal";
  return "normal";
}

function visualStyleForSource(sourceType, sourceId) {
  if (sourceType === "fieldZone" || sourceType === "pulse") return "force";
  if (sourceType === "flameRing" || sourceType === "flameTrail" || sourceType === "burn") return "flame";
  if (sourceType === "line") return sourceId && String(sourceId).indexOf("B21") >= 0 ? "metal" : "poison";
  if (sourceType === "corrosionDot" || sourceType === "poison" || sourceType === "dot") return "poison";
  if (sourceType === "prismZone" || sourceType === "prismRefract") return "prism";
  if (sourceType === "arc" || sourceType === "arcStun") return "lightning";
  if (sourceType === "laser" || sourceType === "laserBeam") return "laser";
  if (sourceType === "sawRing" || sourceType === "anchorBlade" || sourceType === "dualFixed" || sourceType === "swordSweep") return "metal";
  if (sourceType === "chainHammer" || sourceType === "flailHead" || sourceType === "explosion" || sourceType === "mine") return "impact";
  if (sourceType === "drill" || sourceType === "drillTip") return "spark";
  if (sourceType === "projectile") return "pierce";
  return "neutral";
}

function shouldThrottleDamageVisual(sourceType) {
  return isTrueDot(sourceType) || isThrottledArea(sourceType);
}

module.exports = {
  DAMAGE_FEEDBACK_LEVELS,
  TRUE_DOT_SOURCE_TYPES,
  THROTTLED_AREA_SOURCE_TYPES,
  isTrueDot,
  isThrottledArea,
  feedbackLevel,
  visualStyleForSource,
  shouldThrottleDamageVisual
};
