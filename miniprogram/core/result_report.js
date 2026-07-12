const MAP_LABELS = {
  SQUARE: "正方形",
  TRIANGLE: "正三角形",
  PENTAGON: "正五边形"
};

const SOURCE_LABELS = {
  swordSweep: "巨剑斩击",
  projectile: "投射命中",
  sawRing: "锯环切割",
  flailHead: "链锤重击",
  chainHammer: "链锤重击",
  flameRing: "火痕灼烧",
  flameTrail: "火痕灼烧",
  prismZone: "棱镜区域",
  prismRefract: "棱镜折光",
  corrosionDot: "腐蚀中毒",
  explosion: "爆炸",
  laserBeam: "聚焦激光",
  laser: "聚焦激光",
  arcStun: "雷弧麻痹",
  arc: "雷弧跳击",
  mine: "武装雷盘",
  pulse: "力场脉冲",
  fieldZone: "力场余波",
  drillTip: "钻头贯穿",
  drill: "动力钻头",
  lancePin: "长矛推刺",
  lancePierce: "长矛穿刺",
  dualFixed: "双刃锚击",
  anchorBlade: "锚刃重砍",
  body: "本体碰撞",
  wallCrash: "撞墙伤害",
  fixedPart: "固定武器",
  rotatingPart: "旋转武器",
  rotatingShield: "盾刃命中",
  multiOrbit: "星镖刮擦",
  line: "线段切割",
  dot: "毒点腐蚀",
  none: "无"
};

function buildSummary(result) {
  result = result || {};
  const balls = result.balls || [];
  const stats = result.presentationStats || {};
  const winnerBalls = result.winnerTeam ? balls.filter((b) => b.teamId === result.winnerTeam) : balls;
  const mvp = sortByContribution(winnerBalls)[0] || sortByContribution(balls)[0] || {};
  const bestLoser = result.winnerTeam ? sortByContribution(balls.filter((b) => b.teamId !== result.winnerTeam))[0] : null;
  const totalDamage = stats.totalDamage || balls.reduce((sum, b) => sum + (b.damageDone || 0), 0);
  const winnerHp = balls
    .filter((b) => b.teamId === result.winnerTeam)
    .reduce((sum, b) => sum + Math.max(0, b.hp || 0), 0);
  const finalHit = result.timeout ? (stats.lastEffectiveHit || stats.finalHit || {}) : (stats.finalHit || {});
  return {
    winner: result.winnerTeam ? `${result.winnerTeam} 队胜利` : "平局",
    mvpName: mvp.name || "-",
    loserBestName: bestLoser && (bestLoser.damageDone || 0) >= (mvp.damageDone || 0) * 0.85 ? bestLoser.name : "",
    loserBestDamage: bestLoser ? bestLoser.damageDone || 0 : 0,
    totalDamage,
    highestSingle: stats.highestSingle || 0,
    highestCombo: stats.highestCombo || 0,
    duration: result.duration || 0,
    winnerHp,
    mapLabel: MAP_LABELS[result.map] || result.map || "-",
    finalHitText: finalHitText(result, finalHit)
  };
}

function buildRows(result) {
  return ((result && result.balls) || []).map((b) => ({
    slotId: b.slotId,
    teamId: b.teamId,
    name: b.name,
    hp: Math.max(0, b.hp || 0),
    damageDone: b.damageDone || 0,
    damageTaken: b.damageTaken || 0,
    hits: b.hits || 0,
    mainDamageSource: sourceLabel(b.mainDamageSource)
  }));
}

function finalHitText(result, finalHit) {
  if (!finalHit || !finalHit.sourceName) return "没有记录到最后一击";
  const text = `${finalHit.sourceName} 的${sourceLabel(finalHit.sourceType)}对 ${finalHit.targetName} 造成 ${finalHit.amount} 点伤害`;
  if (result && result.timeout) return `超时判定胜负，最后有效伤害为：${text}`;
  return `${finalHit.sourceName} 用${sourceLabel(finalHit.sourceType)}终结 ${finalHit.targetName}，造成 ${finalHit.amount} 点伤害`;
}

function sourceLabel(type) {
  return SOURCE_LABELS[type] || type || SOURCE_LABELS.none;
}

function sortByContribution(list) {
  return (list || []).slice().sort((a, b) => {
    return (b.damageDone || 0) - (a.damageDone || 0)
      || (b.hits || 0) - (a.hits || 0)
      || (b.hp || 0) - (a.hp || 0);
  });
}

module.exports = { MAP_LABELS, SOURCE_LABELS, buildSummary, buildRows, sourceLabel, finalHitText };
