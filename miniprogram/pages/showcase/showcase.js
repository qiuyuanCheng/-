const { BALLS } = require("../../core/configs_v2");
const { AudioManager } = require("../../core/audio_manager");

Page({
  data: { balls: BALLS.map((b) => Object.assign({}, b, buildGuideEntry(b))) },
  onLoad() {
    this.audio = new AudioManager();
    this.audio.setVolume(0.9);
  },
  onUnload() {
    if (this.audio && this.audio.destroy) this.audio.destroy();
  },
  previewSfx(e) {
    const id = e.currentTarget.dataset.id;
    const cfg = BALLS.find((b) => b.id === id);
    if (!cfg || !this.audio) return;
    this.audio.play(cfg.audio.attackHitEvent, { x: 0, y: 0 }, { sourceId: id, kind: "showcase" });
  }
});

function buildGuideEntry(cfg) {
  return {
    guideImage: cfg.id === "B08_FLAME" ? "" : `/assets/balls/${cfg.id}.png`,
    fallbackClass: cfg.id === "B08_FLAME" ? "flame-fallback" : "",
    hpLabel: `生命值：${Math.round(cfg.stats.hp)}`,
    attackLabel: `攻击手段：${attackDescription(cfg)}`,
    damageLabel: `攻击伤害：${damageDescription(cfg)}`,
    critLabel: critDescription(cfg),
    playStyleLabel: `玩法定位：${guideFor(cfg).role}；${guideFor(cfg).level}`,
    strengthLabel: `优点：${guideFor(cfg).strength}`,
    weaknessLabel: `弱点：${guideFor(cfg).weakness}`,
    tags: tagsFor(cfg)
  };
}

function guideFor(cfg) {
  const map = {
    spike: ["地图封锁", "适合新手", "墙边刺钉能封路", "需要撞墙启动"],
    sword: ["近战爆发", "适合新手", "大剑命中直观", "怕远程拉扯"],
    bow: ["远程穿射", "进阶", "射程长、箭矢快", "需要角度"],
    thread: ["路线控制", "进阶", "毒线持续切割", "依赖墙体轨迹"],
    lance: ["冲锋推进", "进阶", "粘住可推墙", "方向要求高"],
    hammer: ["重击击飞", "高风险", "击飞收益高", "挥空代价大"],
    saw: ["贴身研磨", "适合新手", "近身压制强", "需要贴脸"],
    flame: ["区域压制", "进阶", "火痕占场强", "需要撞墙节奏"],
    frost: ["远程控制", "适合新手", "伤害带减速", "冷却偏长"],
    arc: ["麻痹控制", "适合新手", "接触能控场", "需要靠近"],
    cannon: ["爆炸炮击", "进阶", "范围伤害高", "弹道较慢"],
    dagger: ["弹射飞刃", "进阶", "反弹角度多", "依赖空间判断"],
    mine: ["陷阱布控", "进阶", "雷盘稳定占点", "触发有延迟"],
    shield: ["防守反切", "适合新手", "可格挡投射物", "进攻较慢"],
    drill: ["贴脸钻压", "高风险", "尖端爆发高", "贴不上会弱"],
    boomerang: ["往返切割", "进阶", "去返双段命中", "距离要求高"],
    laser: ["预警激光", "进阶", "直线爆发强", "会提前预警"],
    venom: ["腐蚀消耗", "进阶", "持续中毒", "爆发偏低"],
    star: ["环绕防区", "适合新手", "覆盖稳定", "怕远程消耗"],
    shrapnel: ["撞墙散射", "高风险", "碎片覆盖广", "依赖墙面"],
    harpoon: ["牵制钩索", "进阶", "鱼叉能拉扯", "单发容错低"],
    prism: ["分区切割", "高风险", "上限很高", "机制复杂"],
    pulse: ["力场控场", "适合新手", "区域残留稳定", "爆发一般"],
    anchor: ["横向近战", "高风险", "双侧覆盖宽", "贴身难度高"]
  };
  const g = map[cfg.visual.icon] || ["自动攻击", "适合新手", "机制稳定", "缺少爆发"];
  return { role: g[0], level: g[1], strength: g[2], weakness: g[3] };
}

function attackDescription(cfg) {
  const w = cfg.weapon;
  const byId = {
    B01_SPIKE: `撞到墙后在墙边布置刺钉陷阱，刺钉会贴墙形成封锁；本体接触也会造成碰撞伤害。`,
    B02_SWORD: `巨剑围绕球体旋转斩击，生命低于 50% 时每次剑击额外增加 ${w.lowHpDamageBonus || 0} 点伤害。`,
    B03_ARCHER: `按间隔向敌人发射金属长箭，箭矢长度很长、飞行速度高，命中后消失。`,
    B04_THREAD: `撞墙后保留最近两段粗毒线，敌人穿过毒线会持续受到切割伤害。`,
    B05_LANCE: `前方长矛接触敌人会粘住并持续向墙边推进，球体直接碰撞也有伤害。`,
    B06_CHAIN: `长链锤绕体旋转，锤头命中会把敌方击飞；被击飞撞墙会继续受伤，缺血越多伤害越高。`,
    B07_SAW: `外侧巨锯环持续研磨近身目标，并产生推挤/弹飞效果。`,
    B08_FLAME: `撞墙时留下大型火痕圈，场上最多保留 2 个，第三个生成时替换最早的火痕。`,
    B09_FROST: `每隔一段时间发射巨大冰矛，命中造成伤害并让目标短暂减速。`,
    B10_ARC: `接触敌人或敌方旋转武器时触发雷弧，造成麻痹并短暂停止对方旋转武器；连续命中会强制分开。`,
    B11_CANNON: `发射炮弹，命中或爆炸造成范围伤害；每第 10 发变成超级炮弹，可弹墙一次。`,
    B12_RICOCHET: `发射弹射刃，按总飞行距离消失，可在墙面反弹后继续切割。`,
    B13_MINE: `持续补充武装雷盘，场上稳定维持最多 ${w.maxCount || 0} 个，敌人触发后爆震。`,
    B14_SHIELD: `大盾刃围绕前方防守，盾牌能格挡投射物但不反弹，同时盾缘接触会造成伤害。`,
    B15_DRILL: `动力钻头始终指向最近敌人，贴脸持续钻击，钻头尖端命中会有更高爆发。`,
    B16_BOOMERANG: `发射弯月回旋镖，飞到射程后返回，去程和回程都能造成伤害。`,
    B17_LASER: `先出现预警线，短暂延迟后发射长度接近地图边长的聚焦激光。`,
    B18_VENOM: `投放腐蚀毒点，基础命中后附加持续中毒，可叠加并轻微影响目标。`,
    B19_STAR: `三枚星镖等角环绕，外部星镖可与地图边界碰撞并带来反弹表现。`,
    B20_SHRAPNEL: `撞墙时扇形散射多枚碎片，适合用墙面制造覆盖火力。`,
    B21_HARPOON: `发射鱼叉并形成短暂钩索牵制；每第 ${w.burstAfterShots || 7} 发触发三支鱼叉齐射。`,
    B22_PRISM: `棱镜切割会生成分区切割线，并能通过棱镜效果折光反制投射物。`,
    B23_PULSE: `释放残留力场脉冲，力场持续存在一段时间，敌人进入后受到脉冲伤害。`,
    B24_ANCHOR: `左右双刃锚横向展开切割，覆盖身体两侧的近距离区域。`
  };
  return byId[cfg.id] || attackLabel(w.type, cfg.visual.icon).replace(/^攻击：/, "");
}

function damageDescription(cfg) {
  const w = cfg.weapon;
  const parts = [];
  if (typeof w.damage === "number") parts.push(`主攻击 ${fmt(w.damage)} 点`);
  if (typeof cfg.stats.bodyDamage === "number" && cfg.stats.bodyDamage > 0) parts.push(`本体碰撞 ${fmt(cfg.stats.bodyDamage)} 点`);
  if (typeof w.dotDamage === "number") parts.push(`持续中毒每跳 ${fmt(w.dotDamage)} 点`);
  if (typeof w.lineDamage === "number") parts.push(`钩索 ${fmt(w.lineDamage)} 点`);
  if (typeof w.wallCrashDamage === "number") parts.push(`击飞撞墙 ${fmt(w.wallCrashDamage)} 点`);
  if (typeof w.zoneDamage === "number") parts.push(`分区 ${fmt(w.zoneDamage)} 点`);
  if (typeof w.refractDamage === "number") parts.push(`折光 ${fmt(w.refractDamage)} 点`);
  if (w.superDamageScale && w.damage) parts.push(`超级弹 ${fmt(w.damage * w.superDamageScale)} 点`);
  if (w.tipDamageMultiplier && w.damage) parts.push(`钻头尖端最高 ${fmt(w.damage * w.tipDamageMultiplier)} 点`);
  return parts.length ? parts.join("；") : "以控制、格挡或区域机制为主，无独立直接伤害数值";
}

function critDescription(cfg) {
  const crit = cfg.weapon && cfg.weapon.crit;
  if (!crit) return "";
  const parts = [];
  if (crit.midRate) parts.push(`中级暴击 ${fmtPercent(crit.midRate)}，造成 ${fmt(crit.midMultiplier || 2)} 倍伤害，黄色伤害数字`);
  if (crit.highRate) parts.push(`高级暴击 ${fmtPercent(crit.highRate)}，造成 ${fmt(crit.highMultiplier || 3)} 倍伤害，红色伤害数字`);
  return parts.length ? `暴击机制：${parts.join("；")}` : "";
}

function fmt(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function fmtPercent(value) {
  return `${fmt(value * 100)}%`;
}

function attackLabel(type, icon) {
  const iconLabels = {
    spike: "撞墙布置巨型毒刺",
    sword: "超长大剑环绕斩击",
    bow: "长箭直线穿射",
    thread: "粗毒线轨迹切割",
    lance: "速度方向长矛穿刺",
    hammer: "长链巨锤钝击",
    saw: "外扩锯环持续研磨",
    flame: "宽火痕持续灼烧",
    frost: "冰矛命中减速",
    arc: "近中距离雷弧跳击",
    cannon: "炮弹命中爆圈",
    dagger: "飞刃弹墙折返",
    mine: "延迟武装雷盘",
    shield: "大盾弧面与盾刃",
    drill: "动力钻头高频贴脸",
    boomerang: "弯月回旋镖往返",
    laser: "预警后聚焦激光",
    venom: "腐蚀毒点持续伤害",
    star: "三枚大星镖环绕",
    shrapnel: "撞墙散射尖锐碎片",
    harpoon: "鱼叉与绷直钩索",
    prism: "旋转棱镜切割反射",
    pulse: "外扩力场脉冲",
    anchor: "左右双刃锚横向切割"
  };
  const fallback = {
    wallDrop: "撞墙生成陷阱",
    rotatingPart: "环绕武器接触",
    projectile: "自动远程投射物",
    trail: "移动轨迹伤害",
    fixedPart: "前方固定武器",
    ring: "外圈持续切割",
    conditional: "近距自动触发",
    mine: "延迟陷阱",
    reflector: "反射窗口接触",
    boomerang: "往返投射物",
    laser: "直线激光",
    dot: "毒点持续伤害",
    multiOrbit: "多武器环绕",
    wallBurst: "撞墙散射",
    harpoon: "鱼叉线段",
    pulse: "近身脉冲",
    dualFixed: "左右双武器",
    wallSegmentTrail: "最近两段毒线切割",
    flameBurstTrail: "撞墙爆燃区域",
    contactStun: "接触麻痹控制",
    rotatingShield: "旋转大盾格挡",
    prismPartition: "棱镜分区切割",
    fieldZone: "残留脉冲力场"
  };
  return `攻击：${iconLabels[icon] || fallback[type] || type}`;
}

function tagsFor(cfg) {
  const w = cfg.weapon;
  const map = {
    wallDrop: ["地图封锁", "永久墙刺"],
    wallSegmentTrail: ["路线切割", "毒线"],
    flameBurstTrail: ["爆燃压制", "短寿命"],
    contactStun: ["硬控", "接触麻痹"],
    rotatingShield: ["格挡", "弹飞"],
    prismPartition: ["区域切割", "折光"],
    fieldZone: ["区域控制", "残留力场"],
    harpoon: ["牵制", "第7发三连"],
    fixedPart: cfg.id === "B15_DRILL" ? ["尖端爆发", "钻压"] : ["击退", "穿刺"],
    ring: ["贴身压制", "弹飞"],
    rotatingPart: cfg.id === "B06_CHAIN" ? ["残血增伤", "重击"] : ["近战扫击", "击退"],
    multiOrbit: ["三枚星镖", "高伤"],
    wallBurst: ["撞墙散射", "8碎片"],
    boomerang: ["去返双段", "高速回旋"]
  };
  return map[w.type] || ["自动攻击"];
}

function previewWeapons(cfg) {
  const w = cfg.weapon;
  if (["rotatingPart", "multiOrbit", "reflector", "rotatingShield"].includes(w.type)) {
    const count = w.count || 1;
    const result = [];
    for (let i = 0; i < count; i++) {
      const a = -0.6 + i * Math.PI * 2 / count;
      result.push({
        ownerId: "A1",
        teamId: "A",
        ballId: cfg.id,
        ownerX: 0,
        ownerY: 0,
        color: cfg.color,
        visual: cfg.visual.icon,
        weaponType: w.type,
        pos: { x: Math.cos(a) * (w.orbitRadius || 44), y: Math.sin(a) * (w.orbitRadius || 44) },
        angle: a,
        radius: w.radius || 10,
        length: w.length || 42,
        width: w.width || 8
      });
    }
    return result;
  }
  if (["fixedPart", "dualFixed", "ring"].includes(w.type)) {
    return [{
      ownerId: "A1",
      teamId: "A",
      ballId: cfg.id,
      ownerX: 0,
      ownerY: 0,
      color: cfg.color,
      visual: cfg.visual.icon,
      weaponType: w.type,
      pos: w.type === "ring" ? { x: 0, y: 0 } : { x: w.offset || 48, y: 0 },
      angle: 0,
      radius: w.radius || 12,
      length: w.length || 44,
      width: w.width || 8
    }];
  }
  return [];
}

function previewProjectiles(cfg) {
  const w = cfg.weapon;
  if (!["projectile", "boomerang", "harpoon", "wallBurst"].includes(w.type)) return [];
  return [{ x: 165, y: -50, vx: 1, vy: -0.15, radius: w.radius || 6, color: cfg.color, visual: w.projectileVisual || w.type }];
}

function previewHazards(cfg) {
  const w = cfg.weapon;
  if (w.type === "trail") return [{ x: 0, y: 126, x1: -170, y1: 126, x2: 170, y2: 126, radius: 5, color: cfg.color, kind: "line", visual: w.hazardVisual || "line", armed: true, alpha: 0.9 }];
  if (w.type === "wallSegmentTrail") return [{ x: 0, y: 126, x1: -180, y1: 116, x2: 180, y2: 136, radius: 12, color: cfg.color, kind: "line", visual: "threadLine", armed: true, alpha: 0.9 }];
  if (w.type === "flameBurstTrail") return [{ x: 120, y: 80, radius: w.radius || 90, color: cfg.color, kind: "flameRing", visual: "flameTrail", armed: true, alpha: 0.75 }];
  if (w.type === "fieldZone") return [{ x: 120, y: 80, radius: w.pulseRadius || 90, color: cfg.color, kind: "fieldZone", visual: "fieldZone", armed: true, alpha: 0.75 }];
  if (w.type === "prismPartition") return [{ x: 0, y: 0, x1: -170, y1: -100, x2: 170, y2: 120, radius: 8, color: cfg.color, kind: "prismZone", visual: "prismZone", side: 1, armed: true, alpha: 0.75 }];
  if (w.type === "dot" || w.type === "mine") return [{ x: 170, y: 85, radius: w.radius || 18, color: cfg.color, kind: w.type === "mine" ? "mine" : "dot", visual: w.hazardVisual || w.type, armed: w.type !== "mine", alpha: 0.9 }];
  if (w.type === "wallDrop") return [{ x: 170, y: 80, radius: w.radius || 28, color: cfg.color, kind: "spike", visual: "spike", armed: true, alpha: 0.9 }];
  if (w.type === "pulse") return [{ x: 0, y: 0, radius: w.pulseRadius || 90, color: cfg.color, kind: "pulse", visual: "pulse", armed: true, alpha: 0.35 }];
  return [];
}

function previewBeams(cfg) {
  if (cfg.weapon.type !== "laser" && cfg.weapon.type !== "conditional") return [];
  return [{ x1: -190, y1: 0, x2: 190, y2: 0, color: cfg.color, life: 0.1 }];
}
