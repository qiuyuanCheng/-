const MAPS = {
  TRIANGLE: { id: "TRIANGLE", name: "正三角形", sides: 3, radius: 600 },
  SQUARE: { id: "SQUARE", name: "正方形", sides: 4, radius: 600 },
  PENTAGON: { id: "PENTAGON", name: "正五边形", sides: 5, radius: 600 }
};

const MODES = {
  ONE_VS_ONE: { id: "ONE_VS_ONE", name: "1v1", slots: ["A1", "B1"], teams: { A1: "A", B1: "B" } },
  ONE_VS_TWO: { id: "ONE_VS_TWO", name: "1v2", slots: ["A1", "B1", "B2"], teams: { A1: "A", B1: "B", B2: "B" } },
  TWO_VS_TWO: { id: "TWO_VS_TWO", name: "2v2", slots: ["A1", "A2", "B1", "B2"], teams: { A1: "A", A2: "A", B1: "B", B2: "B" } },
  FFA_THREE: { id: "FFA_THREE", name: "1v1v1", slots: ["A1", "B1", "C1"], teams: { A1: "A", B1: "B", C1: "C" } }
};

const BASE = { hp: 1000, radius: 25, mass: 1, maxSpeed: 240, initialSpeed: 230, recoverAccel: 105, bodyDamage: 0, bodyHitInterval: 0.45 };

const BALLS = [
  ball("B01_SPIKE", "刺钉球", "#7f8b95", { radius: 27, mass: 1.05, maxSpeed: 235, bodyDamage: 6 }, { type: "wallDrop", damage: 18, hitInterval: 0.5, cooldown: 0.35, maxCount: 12, lifeTime: 10, radius: 18, ownerCanTrigger: true }),
  ball("B02_SWORD", "宝剑球", "#8fd6ff", {}, { type: "rotatingPart", damage: 34, hitInterval: 0.32, orbitRadius: 38, length: 54, width: 8, angularSpeed: 240, maxCount: 1 }),
  ball("B03_ARCHER", "弓箭球", "#23d7c8", { radius: 24, mass: 0.95 }, { type: "projectile", damage: 32, cooldown: 0.85, projectileSpeed: 420, radius: 4, lifeTime: 3, maxCount: 5, wallBehavior: "destroy" }),
  ball("B04_THREAD", "织线球", "#b06cff", { mass: 0.92, maxSpeed: 250, recoverAccel: 115, bodyDamage: 5 }, { type: "trail", damage: 14, hitInterval: 0.4, spawnDistance: 85, maxCount: 8, lifeTime: 6, ownerGrace: 0.75 }),
  ball("B05_LANCE", "长矛球", "#f3d45c", { radius: 26, mass: 1.02, maxSpeed: 255, recoverAccel: 120 }, { type: "fixedPart", damage: 42, hitInterval: 0.38, length: 62, width: 8, offset: 48, maxCount: 1 }),
  ball("B06_CHAIN", "链锤球", "#b98bff", { radius: 28, mass: 1.12, maxSpeed: 220, recoverAccel: 92 }, { type: "rotatingPart", damage: 55, hitInterval: 0.55, orbitRadius: 72, length: 24, width: 24, angularSpeed: 150, maxCount: 1 }),
  ball("B07_SAW", "锯环球", "#ff5f7d", { radius: 27, mass: 1.04, bodyDamage: 8 }, { type: "ring", damage: 12, hitInterval: 0.16, radius: 38, maxCount: 1 }),
  ball("B08_FLAME", "火痕球", "#ff7a2f", { maxSpeed: 248, recoverAccel: 112, bodyDamage: 5 }, { type: "trail", damage: 10, hitInterval: 0.25, spawnDistance: 60, maxCount: 10, lifeTime: 4, ownerGrace: 999 }),
  ball("B09_FROST", "冰针球", "#9bdcff", { radius: 24, mass: 0.95 }, { type: "projectile", damage: 20, cooldown: 1.1, projectileSpeed: 390, radius: 4, lifeTime: 3, maxCount: 4, wallBehavior: "destroy", slowRatio: 0.82, slowDuration: 1.8 }),
  ball("B10_ARC", "电弧球", "#fff36b", { maxSpeed: 238, bodyDamage: 6 }, { type: "conditional", damage: 36, cooldown: 1.4, range: 160, maxCount: 1 }),
  ball("B11_CANNON", "炮弹球", "#4169d8", { radius: 28, mass: 1.15, maxSpeed: 215, recoverAccel: 90, bodyDamage: 6, bodyHitInterval: 0.5 }, { type: "projectile", damage: 50, cooldown: 1.5, projectileSpeed: 340, radius: 8, explosionRadius: 42, lifeTime: 3.5, maxCount: 3, wallBehavior: "explode" }),
  ball("B12_RICOCHET", "弹射飞镖球", "#d8b5ff", { radius: 24, mass: 0.96, maxSpeed: 245 }, { type: "projectile", damage: 24, cooldown: 0.95, projectileSpeed: 380, radius: 6, lifeTime: 3.5, maxCount: 5, wallBehavior: "bounce", bounceCount: 1 }),
  ball("B13_MINE", "雷盘球", "#ffd536", { radius: 26, mass: 1.02, maxSpeed: 230, recoverAccel: 100, bodyDamage: 5, bodyHitInterval: 0.5 }, { type: "mine", damage: 42, cooldown: 1.2, moveDistance: 180, armTime: 0.6, radius: 35, maxCount: 6, lifeTime: 8 }),
  ball("B14_SHIELD", "盾刃球", "#74e0ff", { radius: 27, mass: 1.1, maxSpeed: 225, recoverAccel: 95 }, { type: "reflector", damage: 18, hitInterval: 0.45, angle: 110, length: 45, reflectDamageRatio: 0.8, cooldown: 0.2, maxCount: 1 }),
  ball("B15_DRILL", "钻头球", "#f6c34a", { radius: 26, mass: 1.05, maxSpeed: 250, recoverAccel: 118 }, { type: "fixedPart", damage: 11, hitInterval: 0.12, length: 34, width: 18, offset: 38, maxCount: 1 }),
  ball("B16_BOOMERANG", "回旋镖球", "#65d979", { radius: 24, mass: 0.94, maxSpeed: 242 }, { type: "boomerang", damage: 28, cooldown: 1.6, projectileSpeed: 360, returnSpeed: 420, radius: 7, maxDistance: 260, maxCount: 2, lifeTime: 4 }),
  ball("B17_LASER", "激光线球", "#d8ffff", {}, { type: "laser", damage: 42, cooldown: 1.8, warningTime: 0.12, beamDuration: 0.18, width: 6, maxCount: 1 }),
  ball("B18_VENOM", "毒点球", "#69ff65", { mass: 0.96, maxSpeed: 248, recoverAccel: 110, bodyDamage: 5 }, { type: "dot", damage: 8, hitInterval: 0.5, spawnDistance: 90, dotDamage: 4, dotDuration: 2, maxCount: 8, lifeTime: 7 }),
  ball("B19_STAR", "星镖球", "#9c75ff", { radius: 24, mass: 0.98, maxSpeed: 238 }, { type: "multiOrbit", damage: 22, hitInterval: 0.35, orbitRadius: 58, radius: 6, count: 3, angularSpeed: 160, maxCount: 3 }),
  ball("B20_SHRAPNEL", "碎片球", "#ffb347", { radius: 26, mass: 1.04, bodyDamage: 5 }, { type: "wallBurst", damage: 14, cooldown: 1, projectileSpeed: 310, radius: 5, count: 5, spreadAngle: 70, lifeTime: 1.4, maxCount: 15 }),
  ball("B21_HARPOON", "钩索球", "#a7b0b8", { radius: 25, mass: 1.02, maxSpeed: 236, recoverAccel: 100 }, { type: "harpoon", damage: 22, lineDamage: 15, hitInterval: 0.35, cooldown: 2, projectileSpeed: 450, radius: 5, lineLife: 1, maxCount: 1 }),
  ball("B22_PRISM", "棱镜球", "#d7b8ff", { maxSpeed: 232, recoverAccel: 98 }, { type: "reflector", damage: 12, hitInterval: 0.45, orbitRadius: 34, length: 42, angularSpeed: 120, reflectDamageRatio: 0.75, cooldown: 0.25, maxCount: 1 }),
  ball("B23_PULSE", "脉冲环球", "#6f7cff", { radius: 26, mass: 1.03, maxSpeed: 235, recoverAccel: 102, bodyDamage: 5 }, { type: "pulse", damage: 26, cooldown: 1.25, triggerRange: 92, pulseRadius: 105, maxCount: 1 }),
  ball("B24_ANCHOR", "双刃锚球", "#d0e2e8", { radius: 27, mass: 1.06, maxSpeed: 238, recoverAccel: 104 }, { type: "dualFixed", damage: 30, hitInterval: 0.36, length: 38, width: 10, offset: 40, maxCount: 2 })
];

function ball(id, name, color, stats, weapon) {
  return { id, name, color, stats: Object.assign({}, BASE, stats), weapon };
}

const BALL_BY_ID = BALLS.reduce((map, b) => {
  map[b.id] = b;
  return map;
}, {});

module.exports = { MAPS, MODES, BALLS, BALL_BY_ID };
