const MAP_LABELS = {
  SQUARE: "\u6b63\u65b9\u5f62",
  TRIANGLE: "\u7b49\u8170\u4e09\u89d2\u5f62",
  PENTAGON: "\u6b63\u4e94\u8fb9\u5f62"
};

const SOURCE_LABELS = {
  swordSweep: "\u5de8\u5251\u65a9\u51fb",
  projectile: "\u6295\u5c04\u547d\u4e2d",
  sawRing: "\u952f\u73af\u5207\u5272",
  flailHead: "\u94fe\u9524\u91cd\u51fb",
  chainHammer: "\u94fe\u9524\u91cd\u51fb",
  flameRing: "\u706b\u75d5\u707c\u70e7",
  flameTrail: "\u706b\u75d5\u707c\u70e7",
  prismZone: "\u68f1\u955c\u533a\u57df",
  prismRefract: "\u68f1\u955c\u6298\u5149",
  corrosionDot: "\u8150\u8680\u4e2d\u6bd2",
  explosion: "\u7206\u70b8",
  laserBeam: "\u805a\u7126\u6fc0\u5149",
  laser: "\u805a\u7126\u6fc0\u5149",
  arcStun: "\u96f7\u5f27\u9ebb\u75f9",
  arc: "\u96f7\u5f27\u8df3\u51fb",
  mine: "\u6b66\u88c5\u96f7\u76d8",
  pulse: "\u529b\u573a\u8109\u51b2",
  fieldZone: "\u529b\u573a\u4f59\u6ce2",
  drillTip: "\u94bb\u5934\u8d2f\u7a7f",
  drill: "\u52a8\u529b\u94bb\u5934",
  lancePin: "\u957f\u77db\u63a8\u523a",
  lancePierce: "\u957f\u77db\u7a7f\u523a",
  dualFixed: "\u53cc\u5203\u951a\u51fb",
  anchorBlade: "\u951a\u5203\u91cd\u780d",
  body: "\u672c\u4f53\u78b0\u649e",
  wallCrash: "\u649e\u5899\u4f24\u5bb3",
  fixedPart: "\u56fa\u5b9a\u6b66\u5668",
  rotatingPart: "\u65cb\u8f6c\u6b66\u5668",
  rotatingShield: "\u76fe\u5203\u547d\u4e2d",
  multiOrbit: "\u661f\u9556\u522e\u64e6",
  line: "\u7ebf\u6bb5\u5207\u5272",
  dot: "\u6bd2\u70b9\u8150\u8680",
  none: "\u672a\u77e5"
};

function buildSummary(result) {
  result = result || {};
  const balls = result.balls || [];
  const stats = result.presentationStats || {};
  const winnerBalls = result.winnerTeam ? balls.filter((b) => b.teamId === result.winnerTeam) : balls;
  const mvp = sortByContribution(winnerBalls)[0] || sortByContribution(balls)[0] || {};
  const mvpSourceStats = (stats.bySource && stats.bySource[mvp.slotId]) || {};
  const bestLoser = result.winnerTeam ? sortByContribution(balls.filter((b) => b.teamId !== result.winnerTeam))[0] : null;
  const winnerHp = balls
    .filter((b) => b.teamId === result.winnerTeam)
    .reduce((sum, b) => sum + Math.max(0, b.hp || 0), 0);
  const finalHit = result.timeout ? (stats.lastEffectiveHit || stats.finalHit || {}) : (stats.finalHit || {});
  return {
    winner: result.winnerTeam ? `${result.winnerTeam} \u961f\u80dc\u5229` : "\u5e73\u5c40",
    mvpSlotId: mvp.slotId || "",
    mvpName: mvp.name || "-",
    mvpDamage: mvp.damageDone || mvpSourceStats.totalDamage || 0,
    mvpHighestSingle: mvpSourceStats.highestSingle || 0,
    mvpHits: mvp.hits || mvpSourceStats.hits || 0,
    totalDamage: balls.reduce((sum, b) => sum + (b.damageDone || 0), 0),
    highestSingle: stats.highestSingle || 0,
    highestCombo: stats.highestCombo || 0,
    loserBestName: bestLoser && (bestLoser.damageDone || 0) >= (mvp.damageDone || 0) * 0.85 ? bestLoser.name : "",
    loserBestDamage: bestLoser ? bestLoser.damageDone || 0 : 0,
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
  if (!finalHit || !finalHit.sourceName) return "\u672a\u8bb0\u5f55\u6700\u540e\u6709\u6548\u4f24\u5bb3";
  const source = sourceLabel(finalHit.sourceType);
  const text = `${finalHit.sourceName} ${source} ${finalHit.targetName} -${finalHit.amount}`;
  if (result && result.timeout) return `\u8d85\u65f6\u5224\u5b9a\u80dc\u8d1f\uff0c\u6700\u540e\u6709\u6548\u4f24\u5bb3\u4e3a\uff1a${text}`;
  return `${finalHit.sourceName} \u7528${source}\u7ec8\u7ed3 ${finalHit.targetName}\uff0c\u9020\u6210 ${finalHit.amount} \u70b9\u4f24\u5bb3`;
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
