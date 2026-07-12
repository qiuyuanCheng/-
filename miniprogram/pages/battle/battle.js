const { Simulation } = require("../../core/simulation_v2");
const { drawArena, loadBallAssets } = require("../../core/arena_renderer");
const { AudioManager } = require("../../core/audio_manager");
const { BALL_BY_ID } = require("../../core/configs_v2");
const {
  DAMAGE_FEEDBACK_LEVELS,
  isTrueDot,
  feedbackLevel,
  visualStyleForSource,
  shouldThrottleDamageVisual
} = require("../../core/presentation_feedback");
const cloud = require("../../services/cloud");

const AUDIO_STORAGE_KEY = "ballDuelAudioSettings";
const VOLUME_LEVELS = [
  { key: "low", label: "低", value: 0.45 },
  { key: "mid", label: "中", value: 0.85 },
  { key: "high", label: "高", value: 1.25 }
];

const SOURCE_LABELS = {
  swordSweep: "斩击命中",
  prismZone: "棱镜区域伤害",
  prismRefract: "棱镜折光",
  flameTrail: "火痕灼烧",
  flameRing: "火痕灼烧",
  corrosionDot: "腐蚀中毒",
  explosion: "爆炸命中",
  projectile: "投射命中",
  sawRing: "锯环切割",
  chainHammer: "链锤重击",
  flailHead: "链锤重击",
  anchorBlade: "锚刃重砍",
  dualFixed: "双刃横切",
  laser: "激光命中",
  laserBeam: "激光灼烧",
  arc: "雷弧跳击",
  arcStun: "雷弧麻痹",
  mine: "雷盘爆震",
  pulse: "力场脉冲",
  fieldZone: "力场余波",
  drill: "钻头撕裂",
  drillTip: "钻头贯穿",
  lancePierce: "长矛穿刺",
  lancePin: "长矛推刺",
  shieldBash: "盾刃命中",
  fixedPart: "武器穿刺",
  rotatingPart: "旋转打击",
  rotatingShield: "盾刃命中",
  multiOrbit: "星镖刮擦",
  body: "本体碰撞",
  wallCrash: "撞墙伤害",
  spike: "刺钉命中",
  dot: "毒点腐蚀",
  line: "轨迹切割"
};

const TEAM_COLORS = { A: "#19c2b1", B: "#ff5f7d", C: "#f3d45c" };
const MAX_FLOATING = 20;
const MAX_PARTICLES = 80;
const MAX_RINGS = 18;

Page({
  data: {
    time: "0.00",
    paused: false,
    speed: 1,
    fighters: [],
    recentEvents: ["等待交锋"],
    audioEnabled: true,
    volumeLabel: "中",
    victoryText: "",
    showVictory: false,
    debugOpen: false,
    debugText: "",
    vsVisible: true,
    vsTeams: []
  },

  onLoad() {
    const audioSettings = this.loadAudioSettings();
    this.setData({ speed: 0.5, audioEnabled: audioSettings.enabled, volumeLabel: audioSettings.level.label });
    const holder = getApp().globalData.lastMatch;
    if (!holder || !holder.config) {
      wx.redirectTo({ url: "/pages/setup/setup" });
      return;
    }
    this.sim = new Simulation(holder.config);
    this.audio = new AudioManager();
    this.audio.setEnabled(audioSettings.enabled);
    this.audio.setVolume(audioSettings.level.value);
    this.nameById = {};
    this.teamById = {};
    this.recentEvents = ["等待交锋"];
    this.eventsDirty = true;
    this.resultSaved = false;
    this.finishStarted = false;
    this.lastHudTime = -1;
    this.lastDebugTime = -1;
    this.lastFrameAt = Date.now();
    this.speedCarry = 0;
    this.floating = [];
    this.rings = [];
    this.particles = [];
    this.broadcasts = [];
    this.squashById = {};
    this.dotFeedbackAt = {};
    this.dotComboAt = {};
    this.comboByTeam = {};
    this.dangerSeen = {};
    this.reversalCount = 0;
    this.lastLead = null;
    this.shake = { until: 0, power: 0 };
    this.hitStopUntil = 0;
    this.hitStopSnap = null;
    this.stats = {
      totalDamage: 0,
      highestSingle: 0,
      highestCombo: 0,
      finalHit: null,
      lastEffectiveHit: null,
      firstHit: false
    };
    this.vsEndAt = Date.now() + 1000;
    this.setData({ vsTeams: this.buildVsTeams(this.sim.snapshot()) });
    this.initCanvas();
  },

  onUnload() {
    this.stopped = true;
    if (this.finishTimer) clearTimeout(this.finishTimer);
    if (this.victoryTimer) clearTimeout(this.victoryTimer);
    try {
      if (this.canvas && this.canvas.cancelAnimationFrame && this.rafId) this.canvas.cancelAnimationFrame(this.rafId);
    } catch (err) {}
    if (this.audio && this.audio.destroy) this.audio.destroy();
  },

  initCanvas() {
    wx.createSelectorQuery().select("#arena").fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext("2d");
      const dpr = wx.getSystemInfoSync().pixelRatio || 1;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);
      this.canvas = canvas;
      this.ctx = ctx;
      this.width = res[0].width;
      this.height = res[0].height;
      this.assets = {};
      loadBallAssets(canvas, this.sim.snapshot().balls, (assets) => {
        this.assets = assets;
      });
      this.refreshNameMap(this.sim.snapshot());
      this.loop();
    });
  },

  loop() {
    if (this.stopped || !this.canvas) return;
    const now = Date.now();
    const delta = Math.max(1, now - (this.lastFrameAt || now));
    this.lastFrameAt = now;
    this.fps = Math.round(1000 / delta);

    if (this.data.vsVisible && now >= this.vsEndAt) this.setData({ vsVisible: false });

    if (!this.data.paused && !this.data.vsVisible && this.sim && !this.finishStarted) {
      this.speedCarry = (this.speedCarry || 0) + this.data.speed;
      const steps = Math.floor(this.speedCarry);
      this.speedCarry -= steps;
      for (let i = 0; i < steps; i++) this.sim.step();
      this.handleEvents();
      if (this.sim.result) this.finish(this.sim.result);
    }

    this.draw(now);
    this.updateHud();
    this.rafId = this.canvas.requestAnimationFrame(() => this.loop());
  },

  handleEvents() {
    const events = this.sim.drainEvents();
    if (!events.length) return;
    let logChanged = false;
    const snap = this.sim.snapshot();
    this.refreshNameMap(snap);
    events.forEach((event) => {
      if (event.type === "audio") {
        this.audio.play(event.eventName, event.point, { sourceId: event.sourceId, kind: event.kind });
      } else if (event.type === "damage") {
        this.handleDamageEvent(event, snap);
        this.recentEvents = [this.formatEvent(event)].concat(this.recentEvents || []).slice(0, 3);
        logChanged = true;
      }
    });
    if (logChanged) this.eventsDirty = true;
  },

  handleDamageEvent(event, snap) {
    const now = Date.now();
    const amount = Math.round(event.amount || 0);
    if (amount <= 0) return;
    const sourceTeam = this.teamById[event.sourceId] || "";
    const target = (snap.balls || []).find((b) => b.id === event.targetId);
    const source = (snap.balls || []).find((b) => b.id === event.sourceId);
    const isKill = event.killed === true;
    const isDot = isTrueDot(event.sourceType);
    const level = feedbackLevel(amount, event.sourceType, isKill);
    const point = event.point || (target ? { x: target.x, y: target.y } : { x: 0, y: 0 });

    this.stats.totalDamage += amount;
    this.stats.highestSingle = Math.max(this.stats.highestSingle, amount);
    const hitRecord = {
      sourceName: this.nameById[event.sourceId] || event.sourceId || "?",
      targetName: this.nameById[event.targetId] || event.targetId || "?",
      sourceType: event.sourceType || "none",
      amount
    };
    this.stats.lastEffectiveHit = hitRecord;
    if (isKill) this.stats.finalHit = hitRecord;

    if (!this.stats.firstHit) {
      this.stats.firstHit = true;
      this.addBroadcast("FIRST HIT", "#d8fff9", 900);
    }

    this.addDamageVisual(event, point, level, amount, isDot, now, source);
    this.addSquash(event, source, target, level, amount, now);
    this.updateCombo(sourceTeam, amount, isDot, now);
    this.updateDanger(snap);
    this.updateReversal(snap);

    if (level === "heavy") {
      this.setVisualHitStop(snap, 110);
      this.addBroadcast("HEAVY HIT", "#ff5f7d", 850);
      this.audio.play("SFX_HIT_HEAVY", point, { sourceId: event.sourceId, kind: "feedback" });
    }
    if (isKill) {
      this.setVisualHitStop(snap, 260);
      this.addBroadcast(this.sim.result ? "FINISH" : "K.O.", "#ff3d3d", 1100);
      this.audio.play("SFX_HIT_HEAVY", point, { sourceId: event.sourceId, kind: "finish" });
    } else if (level === "high") {
      this.audio.play("SFX_HIT_HIGH", point, { sourceId: event.sourceId, kind: "feedback" });
    }
  },

  addDamageVisual(event, point, level, amount, isDot, now, source) {
    const cfg = DAMAGE_FEEDBACK_LEVELS[level] || DAMAGE_FEEDBACK_LEVELS.normal;
    const dotKey = `${event.targetId}_${event.sourceType}`;
    if (shouldThrottleDamageVisual(event.sourceType) && (this.dotFeedbackAt[dotKey] || 0) + 500 > now) return;
    if (shouldThrottleDamageVisual(event.sourceType)) this.dotFeedbackAt[dotKey] = now;
    const text = cfg.label || `-${amount}${cfg.suffix || ""}`;
    const critColor = event.crit === "high" ? "#ff3d3d" : event.crit ? "#ffd86b" : cfg.color;
    this.floating.push({
      x: point.x, y: point.y, text, color: critColor, size: cfg.size,
      life: cfg.life, maxLife: cfg.life, vy: cfg.vy, priority: cfg.priority
    });
    this.trimFloating();
    if (cfg.ring) this.addRing(point, cfg.ring, cfg.color, cfg.priority);
    if (cfg.shake) this.addShake(cfg.shake, cfg.shakeMs || 120);
    if (level === "medium" || level === "high" || level === "heavy" || level === "kill") {
      this.addHitParticles(point, event.sourceType, level, source && source.ballId);
    }
  },

  addSquash(event, source, target, level, amount, now) {
    if (!target || isTrueDot(event.sourceType)) return;
    const strength = level === "kill" ? 0.18 : level === "heavy" ? 0.16 : level === "high" ? 0.12 : level === "medium" ? 0.08 : 0.05;
    const angle = source ? Math.atan2(target.y - source.y, target.x - source.x) : Math.atan2(target.vy || 0, target.vx || 1);
    this.squashById[target.id] = {
      createdAt: now,
      life: level === "high" || level === "heavy" || level === "kill" ? 170 : 120,
      angle,
      strength: Math.min(0.18, strength + Math.min(0.04, amount / 1200))
    };
  },

  addRing(point, radius, color, priority) {
    this.rings.push({ x: point.x, y: point.y, radius, color, life: 420, maxLife: 420, priority });
    if (this.rings.length > MAX_RINGS) this.rings = this.rings.slice(-MAX_RINGS);
  },

  addHitParticles(point, sourceType, level, sourceId) {
    const palette = particlePalette(sourceType, sourceId);
    const count = level === "kill" ? 18 : level === "heavy" ? 14 : level === "high" ? 10 : 6;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * (i / count) + (level === "medium" ? 0.2 : 0);
      const speed = (level === "heavy" || level === "kill") ? 160 : level === "high" ? 120 : 82;
      this.particles.push({
        x: point.x, y: point.y,
        vx: Math.cos(angle) * speed * (0.65 + (i % 3) * 0.16),
        vy: Math.sin(angle) * speed * (0.65 + (i % 2) * 0.18),
        color: palette[i % palette.length],
        size: level === "heavy" || level === "kill" ? 9 : 6,
        life: 360,
        maxLife: 360
      });
    }
    if (this.particles.length > MAX_PARTICLES) this.particles = this.particles.slice(-MAX_PARTICLES);
  },

  addShake(power, ms) {
    const now = Date.now();
    this.shake.power = Math.min(8, Math.max(this.shake.power || 0, power));
    this.shake.until = Math.max(this.shake.until || 0, now + ms);
  },

  setVisualHitStop(snap, ms) {
    const until = Date.now() + ms;
    if (until > (this.hitStopUntil || 0)) {
      this.hitStopUntil = until;
      this.hitStopSnap = snap;
    }
  },

  addBroadcast(text, color, ms) {
    const now = Date.now();
    this.broadcasts.push({ text, color, life: ms, maxLife: ms, createdAt: now });
    this.broadcasts = this.broadcasts.slice(-3);
  },

  updateCombo(team, amount, isDot, now) {
    if (!team || amount < 2) return;
    if (isDot && (this.dotComboAt[team] || 0) + 500 > now) return;
    if (isDot) this.dotComboAt[team] = now;
    const combo = this.comboByTeam[team] || { count: 0, lastAt: 0 };
    combo.count = now - combo.lastAt <= 1200 ? combo.count + 1 : 1;
    combo.lastAt = now;
    this.comboByTeam[team] = combo;
    this.stats.highestCombo = Math.max(this.stats.highestCombo, combo.count);
    if ([2, 3, 5, 8, 10].includes(combo.count)) {
      this.addBroadcast(`${combo.count} COMBO`, TEAM_COLORS[team] || "#f3d45c", combo.count >= 8 ? 900 : 650);
      if (combo.count >= 5) this.audio.play("SFX_COMBO_UP", { x: 0, y: 0 }, { sourceId: team, kind: "combo" });
    }
  },

  updateDanger(snap) {
    (snap.balls || []).forEach((b) => {
      if (!b.alive || this.dangerSeen[b.id] || b.hp / b.maxHp >= 0.2) return;
      this.dangerSeen[b.id] = true;
      this.addBroadcast("DANGER", TEAM_COLORS[b.teamId] || "#ffd86b", 780);
    });
  },

  updateReversal(snap) {
    if (this.reversalCount >= 2) return;
    const hp = {};
    (snap.balls || []).forEach((b) => {
      if (b.alive) hp[b.teamId] = (hp[b.teamId] || 0) + b.hp;
    });
    const teams = Object.keys(hp);
    if (teams.length < 2) return;
    const sorted = teams.sort((a, b) => hp[b] - hp[a]);
    const lead = { team: sorted[0], margin: hp[sorted[0]] - hp[sorted[1]] };
    if (this.lastLead && this.lastLead.team !== lead.team && this.lastLead.margin >= 15 && lead.margin >= 5) {
      this.reversalCount += 1;
      this.addBroadcast("REVERSAL", TEAM_COLORS[lead.team] || "#ffd86b", 900);
    }
    this.lastLead = lead;
  },

  trimFloating() {
    if (this.floating.length <= MAX_FLOATING) return;
    this.floating.sort((a, b) => b.priority - a.priority || b.life - a.life);
    this.floating = this.floating.slice(0, MAX_FLOATING);
  },

  currentShake(now) {
    if (!this.shake || now > this.shake.until) {
      if (this.shake) this.shake.power = 0;
      return { x: 0, y: 0 };
    }
    const remain = Math.min(1, (this.shake.until - now) / 180);
    const power = Math.min(8, this.shake.power) * Math.max(0.2, remain);
    return {
      x: Math.sin(now * 0.083) * power,
      y: Math.cos(now * 0.071) * power
    };
  },

  draw(now) {
    const snap = this.hitStopSnap && now < this.hitStopUntil ? this.hitStopSnap : this.sim.snapshot();
    if (now >= this.hitStopUntil) this.hitStopSnap = null;
    const start = Date.now();
    const shake = this.currentShake(now);
    drawArena(this.ctx, snap, this.width, this.height, this.sim.config.map, {
      assets: this.assets || {},
      visualLimits: true,
      shake,
      squashById: this.currentSquash(now)
    });
    this.drawPresentation(now, shake, snap);
    this.drawCost = Date.now() - start;
    this.lastSnapCounts = {
      projectiles: snap.projectiles.length,
      hazards: snap.hazards.length,
      effects: snap.effects.length
    };
  },

  drawPresentation(now, shake, snap) {
    const ctx = this.ctx;
    const dt = Math.min(0.05, Math.max(0.016, (now - (this.lastDrawAt || now)) / 1000));
    this.lastDrawAt = now;
    const scale = Math.min(this.width, this.height) / 1400;
    const toScreen = (p) => ({
      x: this.width / 2 + p.x * scale + (shake.x || 0),
      y: this.height / 2 + p.y * scale + (shake.y || 0)
    });

    this.drawWinnerGlow(ctx, snap, toScreen);
    this.rings = this.rings.filter((r) => {
      r.life -= dt * 1000;
      const t = Math.max(0, r.life / r.maxLife);
      const p = toScreen(r);
      ctx.save();
      ctx.globalAlpha = t * 0.8;
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
      p0.vx *= 0.92;
      p0.vy *= 0.92;
      const t = Math.max(0, p0.life / p0.maxLife);
      const p = toScreen(p0);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.fillStyle = p0.color;
      ctx.shadowColor = p0.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, p0.size * scale * 2.2 * t), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return p0.life > 0;
    });

    this.floating = this.floating.filter((f) => {
      f.life -= dt * 1000;
      f.y += f.vy * dt;
      const t = Math.max(0, f.life / f.maxLife);
      const p = toScreen(f);
      const pop = 1 + Math.sin((1 - t) * Math.PI) * 0.18;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.25);
      ctx.font = `900 ${f.size * pop}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#000000";
      ctx.shadowBlur = 8;
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
      ctx.font = `900 ${Math.round(30 + (1 - t) * 6)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.76)";
      ctx.fillStyle = b.color;
      const y = Math.max(54, this.height * 0.18);
      ctx.strokeText(b.text, this.width / 2, y);
      ctx.fillText(b.text, this.width / 2, y);
      ctx.restore();
      return b.life > 0;
    });
  },

  currentSquash(now) {
    const output = {};
    Object.keys(this.squashById || {}).forEach((id) => {
      const item = this.squashById[id];
      const elapsed = now - item.createdAt;
      if (elapsed >= item.life) {
        delete this.squashById[id];
        return;
      }
      const t = elapsed / item.life;
      const wave = Math.sin(t * Math.PI);
      const s = item.strength * wave;
      output[id] = {
        angle: item.angle,
        scaleX: Math.min(1.18, 1 + s),
        scaleY: Math.max(0.82, 1 - s * 0.9)
      };
    });
    return output;
  },

  drawWinnerGlow(ctx, snap, toScreen) {
    if (!this.finishStarted || !this.finishWinner) return;
    (snap.balls || []).forEach((b) => {
      if (!b.alive || b.teamId !== this.finishWinner) return;
      const p = toScreen(b);
      ctx.save();
      ctx.globalAlpha = 0.45 + Math.sin(Date.now() * 0.015) * 0.16;
      ctx.strokeStyle = TEAM_COLORS[b.teamId] || "#ffd86b";
      ctx.shadowColor = TEAM_COLORS[b.teamId] || "#ffd86b";
      ctx.shadowBlur = 22;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, b.radius * (Math.min(this.width, this.height) / 1400) + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  },

  updateHud() {
    if (!this.sim || this.sim.time - this.lastHudTime < 0.12) return;
    this.lastHudTime = this.sim.time;
    const patch = Object.assign({ time: this.sim.time.toFixed(2) }, this.buildHud());
    if (this.eventsDirty) {
      patch.recentEvents = this.recentEvents;
      this.eventsDirty = false;
    }
    if (this.data.debugOpen && this.sim.time - this.lastDebugTime >= 0.5) {
      this.lastDebugTime = this.sim.time;
      const c = this.lastSnapCounts || {};
      patch.debugText = `FPS ${this.fps || 0} / P ${c.projectiles || 0} / H ${c.hazards || 0} / FX ${c.effects || 0} / Draw ${this.drawCost || 0}ms`;
    }
    this.setData(patch);
  },

  refreshNameMap(snap) {
    this.nameById = {};
    this.teamById = {};
    (snap.balls || []).forEach((b) => {
      this.nameById[b.id] = b.name || b.id;
      this.teamById[b.id] = b.teamId;
    });
  },

  buildHud() {
    const snap = this.sim.snapshot();
    return {
      fighters: snap.balls.slice(0, 4).map((b) => {
        const hpRatio = Math.max(0, Math.min(1, b.hp / b.maxHp));
        return {
          slotId: b.slotId,
          teamId: b.teamId,
          name: b.name,
          hp: Math.ceil(Math.max(0, b.hp)),
          hpWidth: `${Math.round(hpRatio * 100)}%`,
          alive: b.alive,
          statuses: (b.statuses || []).slice(0, 2).map((s) => s.type === "corrosion" ? "毒" : s.type === "slow" ? "缓" : s.type === "stun" ? "麻" : "控")
        };
      })
    };
  },

  buildVsTeams(snap) {
    const grouped = {};
    (snap.balls || []).forEach((b) => {
      if (!grouped[b.teamId]) grouped[b.teamId] = [];
      const cfg = BALL_BY_ID[b.ballId] || {};
      grouped[b.teamId].push({ name: b.name, role: roleText(cfg, b) });
    });
    return Object.keys(grouped).sort().map((teamId) => ({
      teamId,
      title: `${teamId} 队`,
      color: TEAM_COLORS[teamId] || "#f3d45c",
      names: grouped[teamId].map((b) => b.name).join(" + "),
      role: summarizeRoles(grouped[teamId].map((b) => b.role))
    }));
  },

  formatEvent(event) {
    const amount = Math.round(event.amount || 0);
    const sourceName = this.nameById[event.sourceId] || event.sourceId || "?";
    const targetName = this.nameById[event.targetId] || event.targetId || "?";
    const label = SOURCE_LABELS[event.sourceType] || event.sourceType || "命中";
    const critText = event.crit === "high" ? "重击" : event.crit ? "暴击" : "";
    return `${sourceName} ${critText}${label} ${targetName} -${amount}`;
  },

  togglePause() {
    if (this.finishStarted || this.data.vsVisible) return;
    this.setData({ paused: !this.data.paused });
  },

  toggleDebug() {
    this.setData({ debugOpen: !this.data.debugOpen });
  },

  toggleAudio() {
    const enabled = !this.data.audioEnabled;
    if (this.audio) this.audio.setEnabled(enabled);
    this.setData({ audioEnabled: enabled });
    this.saveAudioSettings(enabled, this.data.volumeLabel);
  },

  cycleVolume() {
    const current = VOLUME_LEVELS.findIndex((item) => item.label === this.data.volumeLabel);
    const next = VOLUME_LEVELS[(current + 1) % VOLUME_LEVELS.length];
    if (this.audio) this.audio.setVolume(next.value);
    this.setData({ volumeLabel: next.label });
    this.saveAudioSettings(this.data.audioEnabled, next.label);
  },

  loadAudioSettings() {
    let stored = {};
    try { stored = wx.getStorageSync(AUDIO_STORAGE_KEY) || {}; } catch (err) {}
    const level = VOLUME_LEVELS.find((item) => item.label === stored.volumeLabel || item.key === stored.volumeKey) || VOLUME_LEVELS[1];
    return { enabled: stored.enabled !== false, level };
  },

  saveAudioSettings(enabled, volumeLabel) {
    const level = VOLUME_LEVELS.find((item) => item.label === volumeLabel) || VOLUME_LEVELS[1];
    try { wx.setStorageSync(AUDIO_STORAGE_KEY, { enabled: !!enabled, volumeKey: level.key, volumeLabel: level.label }); } catch (err) {}
  },

  speedUp() {
    if (this.finishStarted || this.data.vsVisible) return;
    const next = this.data.speed === 0.5 ? 1 : this.data.speed === 1 ? 2 : this.data.speed === 2 ? 4 : 0.5;
    this.speedCarry = 0;
    this.setData({ speed: next });
  },

  async finish(result) {
    if (this.finishStarted) return;
    this.finishStarted = true;
    this.finishWinner = result.winnerTeam;
    this.speedCarry = 0;
    const finalResult = Object.assign({}, result, {
      presentationStats: Object.assign({}, this.stats, {
        highestCombo: this.stats.highestCombo || 0,
        totalDamage: Math.round(this.stats.totalDamage || 0),
        highestSingle: Math.round(this.stats.highestSingle || 0)
      })
    });
    getApp().globalData.lastMatch.result = finalResult;
    const victoryText = result.winnerTeam ? `${result.winnerTeam} 队胜利` : "平局";
    let savePromise = Promise.resolve();
    if (getApp().globalData.user && !this.resultSaved) {
      this.resultSaved = true;
      savePromise = cloud.saveMatch(finalResult).catch(() => {});
    }
    this.victoryTimer = setTimeout(() => {
      if (!this.stopped) this.setData({ paused: true, showVictory: true, victoryText });
    }, 520);
    this.finishTimer = setTimeout(async () => {
      await savePromise;
      if (this.stopped) return;
      wx.redirectTo({ url: "/pages/result/result" });
    }, 1720);
  }
});

function particlePalette(sourceType, sourceId) {
  const style = visualStyleForSource(sourceType, sourceId);
  if (style === "force") return ["#8aa2ff", "#d7ddff", "#6f7cff"];
  if (style === "flame") return ["#ff6a2a", "#ffd86b", "#ff3d3d"];
  if (style === "poison") return ["#67ff5c", "#b7ff7a", "#2ab36b"];
  if (style === "prism") return ["#f7f2ff", "#9de8ff", "#ff9df1"];
  if (style === "lightning") return ["#fff26b", "#7df8ff", "#ffffff"];
  if (style === "laser") return ["#ffffff", "#b9ffff", "#5eefff"];
  if (style === "metal" || style === "spark") return ["#e7f2ff", "#9eb3bf", "#ffd86b"];
  if (style === "impact") return ["#ffffff", "#ffb66b", "#9eb3bf"];
  if (/frost|ice/i.test(sourceType || "")) return ["#b8f2ff", "#ffffff", "#6ccaff"];
  return ["#ffffff", "#d8fff9", "#9eb3bf"];
}

function roleText(cfg, ball) {
  const type = cfg && cfg.weapon && cfg.weapon.type;
  if (["projectile", "laser", "prism"].includes(type)) return "远程压制";
  if (["ring", "rotatingPart", "dualFixed", "drill"].includes(type)) return "近战爆发";
  if (["fieldZone", "mine", "trail"].includes(type)) return "区域控制";
  if ((ball && ball.name || "").indexOf("毒") >= 0) return "持续消耗";
  return "灵活对抗";
}

function summarizeRoles(roles) {
  const unique = Array.from(new Set(roles)).slice(0, 2);
  return unique.join(" + ") || "综合对抗";
}
