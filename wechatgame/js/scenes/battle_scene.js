const BaseScene = require("./base_scene");
const { Button, roundRect } = require("../ui/button");
const { Simulation } = require("../core/simulation_v2");
const { drawArena, loadBallAssets } = require("../core/arena_renderer");
const { MAPS } = require("../core/configs_v2");
const { mapBounds } = require("../core/map_geometry");
const { DAMAGE_FEEDBACK_LEVELS, isTrueDot, feedbackLevel, visualStyleForSource, shouldThrottleDamageVisual } = require("../core/presentation_feedback");
const cloud = require("../services/cloud_service");
const storage = require("../storage");

class BattleScene extends BaseScene {
  enter(params) {
    this.match = JSON.parse(JSON.stringify(params.match));
    this.roomMode = !!(params && params.roomMode);
    this.roomId = (params && params.roomId) || "";
    this.sim = new Simulation(this.match);
    this.assets = {};
    this.floating = [];
    this.rings = [];
    this.particles = [];
    this.broadcasts = [];
    this.dotAt = {};
    this.comboByTeam = {};
    this.dotComboAt = {};
    this.dangerSeen = {};
    this.lastLead = null;
    this.reversalCount = 0;
    this.hitStopUntil = 0;
    this.hitStopSnap = null;
    this.shake = { until: 0, power: 0 };
    this.nameById = {};
    this.teamById = {};
    this.paused = false;
    this.finishStarted = false;
    this.speedOptions = [0.5, 1, 2, 4];
    this.speedIndex = 1;
    this.speed = this.speedOptions[this.speedIndex];
    this.stepCarry = 0;
    this.stats = { totalDamage: 0, highestSingle: 0, highestCombo: 0, bySource: {}, finalHit: null, lastEffectiveHit: null, firstHit: false };
    this.buttons = [
      new Button({ x: 0, y: 0, w: 58, h: 34 }, "\u9996\u9875", () => this.app.sceneManager.replace("home"), { fill: "#1b2933", stroke: "#344a56", fontSize: 14 }),
      new Button({ x: 0, y: 0, w: 66, h: 34 }, "\u97f3\u6548", () => this.app.setAudioEnabled(!this.app.audioEnabled), { fill: "#153830", fontSize: 14 }),
      new Button({ x: 0, y: 0, w: 62, h: 34 }, "1x", () => this.cycleSpeed(), { fill: "#153830", fontSize: 14 }),
      new Button({ x: 0, y: 0, w: 70, h: 34 }, "\u6682\u505c", () => { this.paused = !this.paused; }, { fontSize: 14 })
    ];
    this.layoutButtons();
    loadBallAssets(this.app.canvas, this.sim.snapshot().balls, (assets) => {
      this.assets = assets || {};
    });
    this.refreshMaps(this.sim.snapshot());
  }

  update(dt) {
    if (this.paused || this.finishStarted) return;
    this.stepCarry += this.speed;
    const steps = Math.max(0, Math.floor(this.stepCarry));
    this.stepCarry -= steps;
    for (let i = 0; i < steps; i++) {
      if (!this.sim.result) this.sim.step();
    }
    const snap = this.sim.snapshot();
    this.refreshMaps(snap);
    this.handleEvents(snap);
    if (this.sim.result) this.finish(this.sim.result);
  }

  render(ctx) {
    this.layoutButtons();
    const now = Date.now();
    const snap = this.hitStopSnap && now < this.hitStopUntil ? this.hitStopSnap : this.sim.snapshot();
    if (now >= this.hitStopUntil) this.hitStopSnap = null;
    const shake = this.currentShake(now);
    const view = this.arenaView();
    drawArena(ctx, snap, this.app.width, this.app.height, this.match.map, {
      assets: this.assets,
      visualLimits: true,
      shake,
      scale: view.scale,
      centerX: view.centerX,
      centerY: view.centerY
    });
    this.drawOverlay(ctx, snap, shake, view);
    this.drawHud(ctx);
    this.drawButtons(ctx);
    if (this.finishStarted) this.drawVictory(ctx);
  }

  handleEvents(snap) {
    const events = this.sim.drainEvents();
    events.forEach((event) => {
      if (event.type === "audio") {
        this.app.audio.play(event.eventName, event.point, { sourceId: event.sourceId, kind: event.kind });
      }
      if (event.type === "damage") this.handleDamage(event, snap);
    });
  }

  handleDamage(event, snap) {
    const now = Date.now();
    const amount = Math.round(event.amount || 0);
    if (amount <= 0) return;
    const target = (snap.balls || []).find((b) => b.id === event.targetId);
    const source = (snap.balls || []).find((b) => b.id === event.sourceId);
    const point = event.point || (target ? { x: target.x, y: target.y } : { x: 0, y: 0 });
    const level = feedbackLevel(amount, event.sourceType, event.killed === true);
    const record = {
      sourceName: this.nameById[event.sourceId] || event.sourceId || "?",
      targetName: this.nameById[event.targetId] || event.targetId || "?",
      sourceType: event.sourceType || "none",
      amount
    };
    this.stats.totalDamage += amount;
    this.stats.highestSingle = Math.max(this.stats.highestSingle, amount);
    this.updateSourceStats(event, amount);
    this.stats.lastEffectiveHit = record;
    if (event.killed) this.stats.finalHit = record;
    if (!this.stats.firstHit) {
      this.stats.firstHit = true;
      this.addBroadcast("FIRST HIT", "#d8fff9", 900);
    }
    this.addDamageVisual(event, point, level, amount, source);
    this.updateCombo(this.teamById[event.sourceId], amount, isTrueDot(event.sourceType), now);
    this.updateDanger(snap);
    this.updateReversal(snap);
    if (level === "high") this.app.audio.play("SFX_HIT_HIGH", point, { sourceId: event.sourceId, kind: "feedback" });
    if (level === "heavy") {
      this.setHitStop(snap, 110);
      this.addBroadcast("HEAVY HIT", "#ff5f7d", 850);
      this.app.audio.play("SFX_HIT_HEAVY", point, { sourceId: event.sourceId, kind: "feedback" });
    }
    if (event.killed) {
      this.setHitStop(snap, 260);
      this.addBroadcast(this.sim.result ? "FINISH" : "K.O.", "#ff3d3d", 1100);
    }
  }

  addDamageVisual(event, point, level, amount, source) {
    const now = Date.now();
    const key = `${event.targetId}_${event.sourceType}`;
    if (shouldThrottleDamageVisual(event.sourceType) && (this.dotAt[key] || 0) + 500 > now) return;
    if (shouldThrottleDamageVisual(event.sourceType)) this.dotAt[key] = now;
    const cfg = DAMAGE_FEEDBACK_LEVELS[level] || DAMAGE_FEEDBACK_LEVELS.normal;
    this.floating.push({
      x: point.x, y: point.y,
      text: cfg.label || `-${amount}${cfg.suffix || ""}`,
      color: event.crit === "high" ? "#ff3d3d" : event.crit ? "#ffd86b" : cfg.color,
      size: cfg.size,
      life: cfg.life,
      maxLife: cfg.life,
      vy: cfg.vy,
      priority: cfg.priority
    });
    this.floating.sort((a, b) => b.priority - a.priority || b.life - a.life);
    this.floating = this.floating.slice(0, 20);
    if (cfg.ring) this.rings.push({ x: point.x, y: point.y, radius: cfg.ring, color: cfg.color, life: 420, maxLife: 420 });
    this.rings = this.rings.slice(-18);
    if (cfg.shake) this.addShake(cfg.shake, cfg.shakeMs || 120);
    if (["medium", "high", "heavy", "kill"].includes(level)) this.addParticles(point, event.sourceType, source && source.ballId, level);
  }

  addParticles(point, sourceType, sourceId, level) {
    const palette = paletteFor(sourceType, sourceId);
    const count = level === "kill" ? 16 : level === "heavy" ? 12 : level === "high" ? 8 : 5;
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 2 * i / count;
      const speed = level === "heavy" || level === "kill" ? 160 : 100;
      this.particles.push({ x: point.x, y: point.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color: palette[i % palette.length], life: 360, maxLife: 360, size: 7 });
    }
    this.particles = this.particles.slice(-70);
  }

  drawOverlay(ctx, snap, shake, view) {
    const now = Date.now();
    const dt = Math.min(0.05, Math.max(0.016, (now - (this.lastDrawAt || now)) / 1000));
    this.lastDrawAt = now;
    view = view || this.arenaView();
    const scale = view.scale;
    const toScreen = (p) => ({ x: view.centerX + p.x * scale + (shake.x || 0), y: view.centerY + p.y * scale + (shake.y || 0) });
    this.rings = this.rings.filter((r) => {
      r.life -= dt * 1000;
      const t = Math.max(0, r.life / r.maxLife);
      const p = toScreen(r);
      ctx.save();
      ctx.globalAlpha = t * 0.78;
      ctx.strokeStyle = r.color;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = Math.max(2, 7 * t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r.radius * scale * (1.35 - t * 0.35), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return r.life > 0;
    });
    this.particles = this.particles.filter((p0) => {
      p0.life -= dt * 1000;
      p0.x += p0.vx * dt;
      p0.y += p0.vy * dt;
      const t = Math.max(0, p0.life / p0.maxLife);
      const p = toScreen(p0);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.fillStyle = p0.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, p0.size * t), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return p0.life > 0;
    });
    this.floating = this.floating.filter((f) => {
      f.life -= dt * 1000;
      f.y += f.vy * dt;
      const t = Math.max(0, f.life / f.maxLife);
      const p = toScreen(f);
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.25);
      ctx.font = `900 ${f.size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(0,0,0,0.72)";
      ctx.fillStyle = f.color;
      ctx.strokeText(f.text, p.x, p.y);
      ctx.fillText(f.text, p.x, p.y);
      ctx.restore();
      return f.life > 0;
    });
    this.broadcasts = this.broadcasts.filter((b) => {
      b.life -= dt * 1000;
      const t = Math.max(0, b.life / b.maxLife);
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.4);
      ctx.font = "900 32px sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.76)";
      ctx.fillStyle = b.color;
      ctx.strokeText(b.text, this.app.width / 2, this.app.safeTop + 88);
      ctx.fillText(b.text, this.app.width / 2, this.app.safeTop + 88);
      ctx.restore();
      return b.life > 0;
    });
  }

  drawHud(ctx) {
    const snap = this.sim.snapshot();
    ctx.save();
    const hudBottom = this.app.safeTop + 98;
    ctx.fillStyle = "rgba(3,6,7,0.84)";
    ctx.fillRect(0, 0, this.app.width, hudBottom);
    ctx.strokeStyle = "rgba(148,190,204,0.18)";
    ctx.beginPath();
    ctx.moveTo(0, hudBottom);
    ctx.lineTo(this.app.width, hudBottom);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${this.sim.time.toFixed(1)}s`, this.app.width / 2, this.app.safeTop + 28);
    const slots = snap.balls.slice(0, 4);
    const gap = 6;
    const cardW = Math.min(132, (this.app.width - 28 - gap * (slots.length - 1)) / Math.max(1, slots.length));
    const startX = 14 + Math.max(0, (this.app.width - 28 - (cardW * slots.length + gap * (slots.length - 1))) / 2);
    slots.forEach((b, i) => {
      const x = startX + i * (cardW + gap);
      const y = this.app.safeTop + 48;
      const ratio = Math.max(0, Math.min(1, b.hp / b.maxHp));
      ctx.fillStyle = "rgba(10,22,28,0.92)";
      ctx.strokeStyle = teamColor(b.teamId);
      roundRect(ctx, x, y, cardW, 36, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = b.alive ? teamColor(b.teamId) : "#41515a";
      ctx.font = "900 10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${b.slotId} ${shortName(b.name)}`, x + 7, y + 15);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.ceil(Math.max(0, b.hp))}`, x + cardW - 7, y + 15);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, x + 7, y + 23, cardW - 14, 5, 3);
      ctx.fill();
      ctx.fillStyle = teamColor(b.teamId);
      roundRect(ctx, x + 7, y + 23, (cardW - 14) * ratio, 5, 3);
      ctx.fill();
    });
    ctx.restore();
  }

  drawButtons(ctx) {
    this.buttons[1].text = this.app.audioEnabled ? "\u97f3\u6548" : "\u97f3\u6548\u00d7";
    this.buttons[1].options.fill = this.app.audioEnabled ? "#153830" : "#3b1e27";
    this.buttons[2].text = `${this.speed}x`;
    this.buttons[3].text = this.paused ? "\u7ee7\u7eed" : "\u6682\u505c";
    super.drawButtons(ctx);
  }

  layoutButtons() {
    const gap = 8;
    const widths = [58, 66, 62, 70];
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
    const view = this.arenaView();
    const arenaBottom = view.centerY + view.bounds.maxY * view.scale;
    const y = Math.min(this.app.height - 58, Math.max(this.app.safeTop + 104, arenaBottom + 18));
    let x = Math.max(12, (this.app.width - total) / 2);
    this.buttons.forEach((button, i) => {
      button.rect.x = x;
      button.rect.y = y;
      button.rect.w = widths[i];
      button.rect.h = 34;
      x += widths[i] + gap;
    });
  }
  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.speedOptions.length;
    this.speed = this.speedOptions[this.speedIndex];
    this.stepCarry = 0;
  }

  arenaView() {
    const map = MAPS[this.match.map] || MAPS.SQUARE;
    const bounds = mapBounds(this.match.map, map);
    const hudBottom = this.app.safeTop + 98;
    const bottomReserve = 96;
    const top = hudBottom + 18;
    const bottom = this.app.height - bottomReserve;
    const maxW = this.app.width - 36;
    const maxH = Math.max(260, bottom - top);
    const scale = Math.min(maxW / bounds.width, maxH / bounds.height);
    return {
      scale,
      bounds,
      centerX: this.app.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
      centerY: top - bounds.minY * scale
    };
  }

  drawVictory(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(2,8,10,0.38)";
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.victoryText, this.app.width / 2, this.app.height / 2);
    ctx.restore();
  }

  finish(result) {
    if (this.finishStarted) return;
    this.finishStarted = true;
    this.victoryText = result.winnerTeam ? `${result.winnerTeam} \u961f\u80dc\u5229` : "\u5e73\u5c40";
    const finalResult = Object.assign({}, result, { presentationStats: this.stats });
    this.app.lastResult = finalResult;
    this.saveRecord(finalResult);
    setTimeout(() => this.app.sceneManager.replace("result", { result: finalResult, match: this.match }), 1700);
  }

  async saveRecord(result) {
    if (!this.app.isLoggedIn()) return;
    const record = Object.assign({}, result, {
      mode: this.match.mode,
      map: this.match.map,
      seed: this.match.seed,
      matchType: this.roomMode ? "friend" : "local",
      roomId: this.roomId || "",
      createdAt: Date.now()
    });
    saveLocalRecord(record);
    try {
      await cloud.saveMatch(record);
      this.app.lastRecordSaveError = "";
    } catch (err) {
      this.app.lastRecordSaveError = err.message || String(err || "");
      if (wx.showToast) wx.showToast({ title: "\u6218\u7ee9\u4fdd\u5b58\u5931\u8d25", icon: "none" });
    }
  }

  refreshMaps(snap) {
    this.nameById = {};
    this.teamById = {};
    (snap.balls || []).forEach((b) => {
      this.nameById[b.id] = b.name || b.id;
      this.teamById[b.id] = b.teamId;
    });
  }

  updateCombo(team, amount, isDot, now) {
    if (!team || amount < 2) return;
    if (isDot && (this.dotComboAt[team] || 0) + 500 > now) return;
    if (isDot) this.dotComboAt[team] = now;
    const combo = this.comboByTeam[team] || { count: 0, lastAt: 0 };
    combo.count = now - combo.lastAt <= 1200 ? combo.count + 1 : 1;
    combo.lastAt = now;
    this.comboByTeam[team] = combo;
    this.stats.highestCombo = Math.max(this.stats.highestCombo, combo.count);
    if ([2, 3, 5, 8, 10].includes(combo.count)) this.addBroadcast(`${combo.count} \u8fde\u51fb`, teamColor(team), 700);
  }

  updateSourceStats(event, amount) {
    const key = event.sourceId || "unknown";
    const item = this.stats.bySource[key] || { totalDamage: 0, highestSingle: 0, hits: 0 };
    item.totalDamage += amount;
    item.highestSingle = Math.max(item.highestSingle, amount);
    item.hits += 1;
    this.stats.bySource[key] = item;
  }

  updateDanger(snap) {
    (snap.balls || []).forEach((b) => {
      if (!b.alive || this.dangerSeen[b.id] || b.hp / b.maxHp >= 0.2) return;
      this.dangerSeen[b.id] = true;
      this.addBroadcast("DANGER", teamColor(b.teamId), 780);
    });
  }

  updateReversal(snap) {
    if (this.reversalCount >= 2) return;
    const hp = {};
    (snap.balls || []).forEach((b) => { if (b.alive) hp[b.teamId] = (hp[b.teamId] || 0) + b.hp; });
    const teams = Object.keys(hp);
    if (teams.length < 2) return;
    teams.sort((a, b) => hp[b] - hp[a]);
    const lead = { team: teams[0], margin: hp[teams[0]] - hp[teams[1]] };
    if (this.lastLead && this.lastLead.team !== lead.team && this.lastLead.margin >= 15 && lead.margin >= 5) {
      this.reversalCount += 1;
      this.addBroadcast("REVERSAL", teamColor(lead.team), 900);
    }
    this.lastLead = lead;
  }

  addBroadcast(text, color, ms) {
    this.broadcasts.push({ text, color, life: ms, maxLife: ms });
    this.broadcasts = this.broadcasts.slice(-3);
  }

  addShake(power, ms) {
    const now = Date.now();
    this.shake.power = Math.min(8, Math.max(this.shake.power || 0, power));
    this.shake.until = Math.max(this.shake.until || 0, now + ms);
  }

  currentShake(now) {
    if (!this.shake || now > this.shake.until) return { x: 0, y: 0 };
    const remain = Math.min(1, (this.shake.until - now) / 180);
    const power = Math.min(8, this.shake.power) * Math.max(0.2, remain);
    return { x: Math.sin(now * 0.083) * power, y: Math.cos(now * 0.071) * power };
  }

  setHitStop(snap, ms) {
    const until = Date.now() + ms;
    if (until > this.hitStopUntil) {
      this.hitStopUntil = until;
      this.hitStopSnap = snap;
    }
  }
}

function paletteFor(sourceType, sourceId) {
  const style = visualStyleForSource(sourceType, sourceId);
  if (style === "force") return ["#8aa2ff", "#d7ddff", "#6f7cff"];
  if (style === "flame") return ["#ff6a2a", "#ffd86b", "#ff3d3d"];
  if (style === "poison") return ["#67ff5c", "#b7ff7a", "#2ab36b"];
  if (style === "prism") return ["#f7f2ff", "#9de8ff", "#ff9df1"];
  if (style === "lightning") return ["#fff26b", "#7df8ff", "#ffffff"];
  if (style === "metal" || style === "spark") return ["#e7f2ff", "#9eb3bf", "#ffd86b"];
  return ["#ffffff", "#d8fff9", "#9eb3bf"];
}

function teamColor(team) {
  if (team === "A") return "#19c2b1";
  if (team === "B") return "#ff5f7d";
  return "#f3d45c";
}

function shortName(name) {
  const value = String(name || "");
  return value.length > 4 ? value.slice(0, 4) : value;
}

function saveLocalRecord(record) {
  const key = "ball_duel_match_records";
  const items = storage.get(key, []);
  const next = Array.isArray(items) ? items.slice() : [];
  next.unshift(record);
  storage.set(key, next.slice(0, 50));
}

module.exports = BattleScene;
