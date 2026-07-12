const MAPS = {
  TRIANGLE: { id: "TRIANGLE", name: "正三角形", sides: 3, radius: 600 },
  SQUARE: { id: "SQUARE", name: "正方形", sides: 4, radius: 600 },
  PENTAGON: { id: "PENTAGON", name: "正五边形", sides: 5, radius: 600 }
};

const MODES = {
  ONE_VS_ONE: { id: "ONE_VS_ONE", name: "1v1", slots: ["A1", "B1"], teams: { A1: "A", B1: "B" } },
  ONE_VS_TWO: { id: "ONE_VS_TWO", name: "1v2", slots: ["A1", "B1", "B2"], teams: { A1: "A", B1: "B", B2: "B" } },
  ONE_VS_THREE: { id: "ONE_VS_THREE", name: "1v3", slots: ["A1", "B1", "B2", "B3"], teams: { A1: "A", B1: "B", B2: "B", B3: "B" } },
  TWO_VS_TWO: { id: "TWO_VS_TWO", name: "2v2", slots: ["A1", "A2", "B1", "B2"], teams: { A1: "A", A2: "A", B1: "B", B2: "B" } },
  FFA_THREE: { id: "FFA_THREE", name: "1v1v1", slots: ["A1", "B1", "C1"], teams: { A1: "A", B1: "B", C1: "C" } }
};

const MOVEMENT_TUNING = {
  minInitialSpeed: 520,
  maxInitialSpeed: 860,
  parallelBreakAngle: 4,
  unstuckImpulse: 26,
  weaponImpulseScale: 0.45
};

// Current release had already doubled the original body size. The revised spec asks
// for another 1.5x diameter increase, so the physical radius is now 3x original.
const BALL_SIZE_SCALE = 3;

const BASE = {
  hp: 1000,
  radius: 25,
  mass: 1,
  maxSpeed: 410,
  initialSpeed: 340,
  recoverAccel: 170,
  bodyDamage: 0,
  bodyHitInterval: 0.45
};

const SPEC = {
  B01_SPIKE: ["刺钉球", "墨绿金属核心、墙面巨型毒刺、危险三角钉阵", "SFX_B01_SPIKE_STAB_HIT", "#3f6f55", "#b8ffd0", "spike"],
  B02_SWORD: ["巨剑球", "蓝白能量核心、超长大剑、旋转斩击轨迹", "SFX_B02_GREAT_SWORD_HIT", "#4fb8ff", "#f6fbff", "sword"],
  B03_ARCHER: ["长弓球", "青绿长弓纹章、长箭穿射、清晰箭尾光线", "SFX_B03_LONG_ARROW_HIT", "#21cbbd", "#d8fff9", "bow"],
  B04_THREAD: ["毒线球", "荧绿毒液玻璃、粗弧形毒线、持续切割区", "SFX_B04_TOXIC_THREAD_HIT", "#43df72", "#e2ffbf", "thread"],
  B05_LANCE: ["破阵长矛球", "金色冲锋核心、超长骑枪、速度方向穿刺", "SFX_B05_LONG_LANCE_PIERCE_HIT", "#f0c64b", "#fff7b8", "lance"],
  B06_CHAIN: ["重链锤球", "红黑重甲、长链巨锤、低频钝击冲量", "SFX_B06_HEAVY_HAMMER_HIT", "#a83c46", "#ffe0d5", "hammer"],
  B07_SAW: ["巨锯环球", "深蓝黑锯盘、外扩锯齿环、贴身研磨", "SFX_B07_SAW_RING_GRIND_HIT", "#24476f", "#bde8ff", "saw"],
  B08_FLAME: ["炼狱火痕球", "橙红熔核、撞墙大型火痕圈、无外部实体火盘", "SFX_B08_INFERNO_TRAIL_HIT", "#ff6b25", "#ffe0aa", "flame"],
  B09_FROST: ["冰矛球", "浅蓝冰晶核心、长冰矛、命中霜裂纹", "SFX_B09_ICE_SPEAR_HIT", "#8fdcff", "#f1fbff", "frost"],
  B10_ARC: ["雷弧球", "黄白电芯、粗电弧跳击、近中距离爆闪", "SFX_B10_LIGHTNING_ZAP_HIT", "#fff05c", "#ffffff", "arc"],
  B11_CANNON: ["迷你炮球", "深蓝炮座、可见炮管、炮弹爆圈", "SFX_B11_MINI_CANNON_BLAST_HIT", "#395dcc", "#ffc36b", "cannon"],
  B12_RICOCHET: ["弹射刃球", "银紫机体、菱形回弹刃、折线弹射", "SFX_B12_RICOCHET_BLADE_HIT", "#aa92ff", "#ffffff", "dagger"],
  B13_MINE: ["武装雷盘球", "黑黄警戒盘、延迟武装、圆盘爆震", "SFX_B13_ARMED_MINE_HIT", "#ffd536", "#27221a", "mine"],
  B14_SHIELD: ["大盾刃球", "青蓝护盾核心、宽角半月盾、盾缘切割", "SFX_B14_SHIELD_BLADE_HIT", "#63d7ff", "#f2fdff", "shield"],
  B15_DRILL: ["动力钻球", "青铜机芯、长螺旋钻头、高频贴脸钻击", "SFX_B15_POWER_DRILL_HIT", "#34b9b4", "#fff1a6", "drill"],
  B16_BOOMERANG: ["弯月回旋球", "翠绿风纹、宽弯月回旋镖、去返双段", "SFX_B16_CRESCENT_BOOMERANG_HIT", "#55d976", "#e4ffe8", "boomerang"],
  B17_LASER: ["聚焦激光球", "白青透镜核心、粗辉光激光、预警直线", "SFX_B17_FOCUSED_LASER_HIT", "#d8ffff", "#ffffff", "laser"],
  B18_VENOM: ["腐蚀毒点球", "荧光绿毒泡、大片毒点、腐蚀持续伤害", "SFX_B18_VENOM_CORRODE_HIT", "#67ff5c", "#eaffea", "venom"],
  B19_STAR: ["轨道星镖球", "紫色星核、三枚大星镖、等角环绕", "SFX_B19_ORBIT_STAR_HIT", "#9c75ff", "#f0e7ff", "star"],
  B20_SHRAPNEL: ["散射碎片球", "橙黄破片核心、撞墙扇形散射、尖锐碎片", "SFX_B20_SHRAPNEL_CHIP_HIT", "#ffad3d", "#fff0c8", "shrapnel"],
  B21_HARPOON: ["鱼叉钩索球", "铁灰机械芯、鱼叉飞射、粗索短暂绷直", "SFX_B21_HARPOON_TETHER_HIT", "#9aa6ae", "#eff5f8", "harpoon"],
  B22_PRISM: ["棱镜切割球", "透明彩棱核心、旋转棱镜片、折光切割", "SFX_B22_PRISM_SLICE_HIT", "#d7b8ff", "#eaffff", "prism"],
  B23_PULSE: ["力场脉冲球", "蓝紫能量核、外扩冲击环、轻击退", "SFX_B23_FORCE_PULSE_HIT", "#6f7cff", "#f0edff", "pulse"],
  B24_ANCHOR: ["双刃锚球", "冷银锚芯、左右双刃锚刺、横向宽切割", "SFX_B24_TWIN_ANCHOR_CUT_HIT", "#8db7c8", "#e9fbff", "anchor"]
};

const BALLS = [
  ball("B01_SPIKE", { radius: 27, mass: 1.05, bodyDamage: 45 }, { type: "wallSpikeTrap", damage: 27.2, hitInterval: 0.65, cooldown: 0.95, armTime: 0.18, lifeTime: 999, radius: 28, spikeLengthScale: 0.5, dedupDistance: 82, ownerImmunity: true }),
  ball("B02_SWORD", { initialSpeed: 374, maxSpeed: 451 }, { type: "rotatingPart", damage: 38, hitInterval: 0.32, orbitRadius: 54, length: 110, width: 14, angularSpeed: 255, postAngularScale: 2 / 3, impulse: 28, lowHpDamageBonus: 16, lowHpThreshold: 0.5, crit: { midRate: 0.14, midMultiplier: 2, highRate: 0.05, highMultiplier: 3 }, maxCount: 1 }),
  ball("B03_ARCHER", { radius: 24, mass: 0.95 }, { type: "projectile", damage: 38, cooldown: 0.9, projectileSpeed: 1300, radius: 6, lifeTime: 2.6, maxCount: 6, wallBehavior: "destroy", projectileVisual: "arrow", projectileLengthScale: 3, projectileMaterial: "metal" }),
  ball("B04_THREAD", { mass: 0.92, recoverAccel: 185, bodyDamage: 5 }, { type: "wallSegmentTrail", damage: 29, hitInterval: 0.36, retainSegments: 3, lineWidth: 14, ownerGrace: 0.75, hazardVisual: "threadLine" }),
  ball("B05_LANCE", { radius: 26, mass: 1.02, maxSpeed: 430, recoverAccel: 190, bodyDamage: 35, bodyHitInterval: 0.45 }, { type: "fixedPart", damage: 25, hitInterval: 0.22, length: 104, width: 13, offset: 82, impulse: 34, stickyLance: true, lanceWallStop: true, knockbackImpulse: 58, knockbackCooldown: 0.24, bodyOnlyKnockback: true, maxCount: 1 }),
  ball("B06_CHAIN", { radius: 28, mass: 1.12, maxSpeed: 365, recoverAccel: 150 }, { type: "rotatingPart", damage: 54, hitInterval: 0.55, orbitRadius: 84, length: 48, width: 48, angularSpeed: 165, postAngularScale: 0.75, impulse: 48, launchOnHit: true, launchDistanceMapSide: 0.88, wallCrashDamage: 36, rageDamageScale: { missingHpStep: 0.1, damageBonusPerStep: 0.06, maxBonus: 0.6 }, maxCount: 1 }),
  ball("B07_SAW", { radius: 27, mass: 1.04 }, { type: "ring", damage: 60, hitInterval: 0.16, radius: 44, impulse: 34, ringBodyKnockback: true, ringWeaponIgnore: true, crit: { midRate: 0.17, midMultiplier: 2, highRate: 0.07, highMultiplier: 3 }, maxCount: 1 }),
  ball("B08_FLAME", { recoverAccel: 180, bodyDamage: 5 }, { type: "flameBurstTrail", damage: 22, hitInterval: 0.3, cooldown: 0.55, radius: 116, lifeTime: 999, maxCount: 2, replaceOldest: true, ownerGrace: 999, hazardVisual: "flameTrail", noBodyTrail: true }),
  ball("B09_FROST", { radius: 24, mass: 0.95 }, { type: "projectile", damage: 48, cooldown: 1.65, projectileSpeed: 885, radius: 27.5, lifeTime: 2.6, maxCount: 2, wallBehavior: "destroy", slowRatio: 0.5, slowDuration: 0.8, projectileVisual: "iceNeedle", projectileLengthScale: 2.5, crit: { midRate: 0.14, midMultiplier: 2, highRate: 0.05, highMultiplier: 3 } }),
  ball("B10_ARC", { hp: 1100, initialSpeed: 571.2, maxSpeed: 688.8, recoverAccel: 285.6, bodyDamage: 0 }, { type: "contactStun", damage: 60, cooldown: 1.35, stunDuration: 1.5, stopRotatingWeaponDuration: 1.5, comboLimit: 3, comboSeparateImpulse: 240, range: 0, crit: { midRate: 0.14, midMultiplier: 2, highRate: 0.05, highMultiplier: 3 }, maxCount: 1 }),
  ball("B11_CANNON", { radius: 28, mass: 1.15, maxSpeed: 360, recoverAccel: 145, bodyDamage: 6, bodyHitInterval: 0.5 }, { type: "projectile", damage: 54, cooldown: 1.35, projectileSpeed: 520, radius: 11, explosionRadius: 58, lifeTime: 3.2, maxCount: 3, wallBehavior: "explode", recoil: 18, projectileVisual: "cannonball", superEvery: 10, superRadiusScale: 5, superSpeedScale: 2.6, superDamageScale: 2.5, superBounceCount: 1 }),
  ball("B12_RICOCHET", { radius: 24, mass: 0.96 }, { type: "projectile", damage: 26, cooldown: 0.78, projectileSpeed: 870, radius: 9, lifeTime: 999, maxTravelMapSideScale: 1.85, maxCount: 5, wallBehavior: "bounce", bounceCount: 1, projectileVisual: "dagger", crit: { midRate: 0.26, midMultiplier: 2 } }),
  ball("B13_MINE", { radius: 26, mass: 1.02, maxSpeed: 390, bodyDamage: 5, bodyHitInterval: 0.5 }, { type: "mine", damage: 33, cooldown: 2.0, moveDistance: 160, armTime: 0.6, radius: 39, maxCount: 6, lifeTime: 999, stableFill: true, hazardVisual: "mineDisk" }),
  ball("B14_SHIELD", { hp: 1120, radius: 27, mass: 1.1, maxSpeed: 375, recoverAccel: 150 }, { type: "rotatingShield", style: "shield", damage: 36, hitInterval: 0.48, shieldAngle: 160, radius: 62, length: 92, width: 18, impulse: 50, canReflect: false, priorityBlock: true, maxCount: 1 }),
  ball("B15_DRILL", { radius: 26, mass: 1.05, maxSpeed: 430, recoverAccel: 190 }, { type: "fixedPart", damage: 12, hitInterval: 0.12, length: 70, width: 24, offset: 56, impulse: 24, tipDamageMultiplier: 5, pinDuration: 1.35, aimAtEnemy: true, maxCount: 1 }),
  ball("B16_BOOMERANG", { radius: 24, mass: 0.94 }, { type: "boomerang", damage: 50, cooldown: 1.35, projectileSpeed: 1701, returnSpeed: 2016, radius: 12, maxDistance: 675, maxCount: 3, lifeTime: 4, projectileVisual: "boomerang" }),
  ball("B17_LASER", {}, { type: "laser", damage: 76, cooldown: 2.35, warningTime: 0.196875, beamDuration: 0.14, width: 7, lengthMapSideScale: 1, maxCount: 1 }),
  ball("B18_VENOM", { mass: 0.96, recoverAccel: 180, bodyDamage: 5 }, { type: "dot", damage: 10, hitInterval: 0.55, spawnDistance: 82, dotDamage: 5, dotDuration: 3, maxStacks: 2, speedRatio: 0.94, radius: 27, maxCount: 7, lifeTime: 6, hazardVisual: "venomDot" }),
  ball("B19_STAR", { radius: 24, mass: 0.98 }, { type: "multiOrbit", damage: 42, hitInterval: 0.35, orbitRadius: 65, radius: 18.2, count: 3, angularSpeed: 185, rigidWallCollision: true, wallBounceOrbit: false, maxCount: 3 }),
  ball("B20_SHRAPNEL", { hp: 1200, radius: 26, mass: 1.04, bodyDamage: 5 }, { type: "wallBurst", damage: 25, cooldown: 0.85, projectileSpeed: 750, radius: 7, count: 8, spreadAngle: 82, lifeTime: 1.68, maxCount: 22, projectileVisual: "shard" }),
  ball("B21_HARPOON", { radius: 25, mass: 1.02, maxSpeed: 395 }, { type: "harpoon", damage: 52, lineDamage: 7, lineInterval: 0.35, hitInterval: 0.35, cooldown: 2.0, projectileSpeed: 975, radius: 7, lineLife: 0.8, pullImpulse: 18, burstAfterShots: 7, burstCount: 3, burstAngle: 22.5, maxCount: 3, projectileVisual: "harpoon", crit: { midRate: 0.14, midMultiplier: 2, highRate: 0.05, highMultiplier: 3 } }),
  ball("B22_PRISM", { maxSpeed: 385, recoverAccel: 160 }, { type: "prismPartition", damage: 10, hitInterval: 0.50, lineDamage: 12, zoneDamage: 9, zoneInterval: 0.5, minPointDistance: 200, maxCount: 1 }),
  ball("B23_PULSE", { radius: 26, mass: 1.03, bodyDamage: 5 }, { type: "fieldZone", damage: 32, cooldown: 1.65, pulseRadius: 128, hitInterval: 0.45, lifeTime: 3, maxCount: 2 }),
  ball("B24_ANCHOR", { radius: 27, mass: 1.06 }, { type: "dualFixed", damage: 55, hitInterval: 0.28, length: 82, width: 16, offset: 66, impulse: 36, maxCount: 2 })
];

function ball(id, stats, weapon) {
  const s = SPEC[id];
  const scaledStats = scaleStats(Object.assign({}, BASE, stats));
  const scaledWeapon = scaleWeapon(Object.assign({}, weapon));
  const visual = {
    bodyShape: "circle",
    primaryColor: s[3],
    secondaryColor: s[4],
    rimGlowColor: s[4],
    icon: s[5],
    visualBrief: s[1],
    weaponVisual: scaledWeapon.type,
    hitEffect: `${s[5]}Hit`,
    assetPath: `/assets/balls/${id}.png`
  };
  if (id === "B08_FLAME") visual.assetPath = "";
  return {
    id,
    name: s[0],
    color: s[3],
    stats: scaledStats,
    movementTuning: MOVEMENT_TUNING,
    weapon: scaledWeapon,
    visual,
    audio: {
      wallImpactEvent: "SFX_BALL_WALL_IMPACT",
      attackHitEvent: s[2],
      minSameSourceInterval: Math.max(0.1, scaledWeapon.hitInterval || 0.1),
      pitchRandomRange: [-0.04, 0.04],
      volumeRandomRangeDb: [-2, 2]
    }
  };
}

function scaleStats(stats) {
  stats.radius *= BALL_SIZE_SCALE;
  stats.initialSpeed *= 2;
  stats.maxSpeed *= 2;
  stats.recoverAccel *= 2;
  return stats;
}

function scaleWeapon(weapon) {
  const partScale = BALL_SIZE_SCALE;
  const hazardScale = 1.65;
  const projectileScale = 1.55;
  if (["rotatingPart", "fixedPart", "dualFixed", "ring", "reflector", "multiOrbit", "rotatingShield"].includes(weapon.type)) {
    ["orbitRadius", "offset", "radius", "length", "width"].forEach((key) => {
      if (typeof weapon[key] === "number") weapon[key] *= partScale;
    });
  }
  if (["wallDrop", "wallSpikeTrap", "mine", "pulse", "dot", "flameBurstTrail", "fieldZone"].includes(weapon.type)) {
    ["radius", "pulseRadius", "triggerRange"].forEach((key) => {
      if (typeof weapon[key] === "number") weapon[key] *= hazardScale;
    });
  }
  if (["projectile", "boomerang", "harpoon", "wallBurst"].includes(weapon.type)) {
    ["radius", "explosionRadius"].forEach((key) => {
      if (typeof weapon[key] === "number") weapon[key] *= projectileScale;
    });
  }
  if (typeof weapon.angularSpeed === "number") {
    weapon.angularSpeed *= 2;
    if (typeof weapon.postAngularScale === "number") weapon.angularSpeed *= weapon.postAngularScale;
  }
  return weapon;
}

const BALL_BY_ID = BALLS.reduce((map, b) => {
  map[b.id] = b;
  return map;
}, {});

module.exports = { MAPS, MODES, BALLS, BALL_BY_ID, MOVEMENT_TUNING, BALL_SIZE_SCALE };
