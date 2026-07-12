const { BALL_BY_ID, MAPS, MOVEMENT_TUNING } = require("../../core/configs_v2");
const { buildWalls } = require("../../core/simulation_v2");
const { loadBallAssets } = require("../../core/arena_renderer");
const cloud = require("../../services/cloud");

const UNKNOWN_RADIUS = 75;

Page({
  data: { hint: "点击地图内位置放置第 1 个球" },

  onLoad(query) {
    const pending = getApp().globalData.pendingPlacement;
    if (!pending) {
      wx.redirectTo({ url: "/pages/setup/setup" });
      return;
    }
    this.mode = query.mode || pending.mode || "free";
    this.match = JSON.parse(JSON.stringify(pending.config));
    this.roomId = pending.roomId;
    this.editableTeams = pending.editableTeams || null;
    this.hideEnemyVelocity = !!pending.hideEnemyVelocity;
    this.editableSlots = this.match.slots.filter((s) => this.isEditable(s));
    this.placingIndex = this.nextEditableIndex();
    this.dragSlot = null;
    this.dragPoint = null;
    this.walls = buildWalls(MAPS[this.match.map]);
    this.showFirstPlacementTip();
    this.initCanvas();
  },

  showFirstPlacementTip() {
    try {
      if (wx.getStorageSync("ballDuelPlacementTipSeen")) return;
      wx.setStorageSync("ballDuelPlacementTipSeen", true);
      wx.showModal({
        title: "布阵提示",
        content: "点地图放置小球；放完后拖拽自己的小球，设置初速度方向和力度。",
        showCancel: false
      });
    } catch (err) {}
  },

  initCanvas() {
    wx.createSelectorQuery().select("#placeCanvas").fields({ node: true, size: true }).exec((res) => {
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
      const assetBalls = this.match.slots
        .map((slot) => BALL_BY_ID[slot.ballId])
        .filter(Boolean)
        .map((cfg) => ({ ballId: cfg.id, visual: cfg.visual }));
      this.assets = {};
      loadBallAssets(canvas, assetBalls, (assets) => {
        this.assets = assets;
        this.draw();
      });
      this.draw();
    });
  },

  worldFromTouch(touch) {
    const scale = Math.min(this.width, this.height) / 1400;
    return { x: (touch.x - this.width / 2) / scale, y: (touch.y - this.height / 2) / scale };
  },

  touchStart(e) {
    const p = this.worldFromTouch(e.touches[0]);
    const hit = this.findBall(p);
    if (hit && this.allEditablePlaced()) {
      this.dragSlot = hit;
      this.dragPoint = p;
      this.setData({ hint: `拖拽设置 ${hit.slotId} 的初速度方向和力度` });
      this.draw();
      return;
    }
    if (!this.allEditablePlaced()) this.placeCurrent(p);
  },

  touchMove(e) {
    if (!this.dragSlot) return;
    this.dragPoint = this.worldFromTouch(e.touches[0]);
    this.draw();
  },

  touchEnd() {
    if (!this.dragSlot || !this.dragPoint) return;
    const slot = this.dragSlot;
    const delta = { x: this.dragPoint.x - slot.spawn.x, y: this.dragPoint.y - slot.spawn.y };
    const distance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
    const speed = Math.max(MOVEMENT_TUNING.minInitialSpeed, Math.min(MOVEMENT_TUNING.maxInitialSpeed, distance * 2.1));
    const length = Math.max(1, distance);
    slot.initialVelocity = { x: delta.x / length * speed, y: delta.y / length * speed };
    slot.initialAngleDeg = Math.atan2(slot.initialVelocity.y, slot.initialVelocity.x) * 180 / Math.PI;
    this.dragSlot = null;
    this.dragPoint = null;
    this.setData({ hint: "可继续拖拽任意小球调整方向，或点击开始" });
    this.draw();
  },

  placeCurrent(p) {
    const slot = this.match.slots[this.placingIndex];
    const cfg = BALL_BY_ID[slot.ballId];
    if (!cfg) {
      wx.showToast({ title: "请先选择小球", icon: "none" });
      return;
    }
    if (!this.isLegal(p, cfg.stats.radius, slot.slotId)) {
      wx.showToast({ title: "位置非法：不能贴墙或重叠", icon: "none" });
      return;
    }
    slot.spawn = p;
    slot.initialVelocity = { x: cfg.stats.initialSpeed, y: 0 };
    this.placingIndex = this.nextEditableIndex();
    const next = this.match.slots[this.placingIndex];
    this.setData({ hint: next ? `点击地图放置 ${next.slotId} ${BALL_BY_ID[next.ballId].name}` : "布置完成，拖拽小球设置初速度方向" });
    this.draw();
  },

  isLegal(p, radius, slotId) {
    for (const wall of this.walls) if (p.x * wall.normal.x + p.y * wall.normal.y - wall.c < radius + 20) return false;
    for (const s of this.match.slots) {
      if (!s.spawn || s.slotId === slotId) continue;
      const otherCfg = BALL_BY_ID[s.ballId];
      const other = otherCfg ? otherCfg.stats.radius : UNKNOWN_RADIUS;
      const dx = p.x - s.spawn.x;
      const dy = p.y - s.spawn.y;
      if (Math.sqrt(dx * dx + dy * dy) < radius + other + 40) return false;
    }
    return true;
  },

  allEditablePlaced() {
    return this.editableSlots.every((s) => s.spawn);
  },

  isEditable(slot) {
    return !this.editableTeams || this.editableTeams.includes(slot.teamId);
  },

  nextEditableIndex() {
    for (let i = 0; i < this.match.slots.length; i++) {
      const slot = this.match.slots[i];
      if (this.isEditable(slot) && !slot.spawn) return i;
    }
    return -1;
  },

  findBall(p) {
    for (const slot of this.match.slots) {
      if (!slot.spawn || !this.isEditable(slot)) continue;
      const cfg = BALL_BY_ID[slot.ballId];
      const r = (cfg ? cfg.stats.radius : UNKNOWN_RADIUS) + 12;
      const dx = p.x - slot.spawn.x;
      const dy = p.y - slot.spawn.y;
      if (Math.sqrt(dx * dx + dy * dy) <= r) return slot;
    }
    return null;
  },

  reset() {
    for (const s of this.match.slots) {
      if (!this.isEditable(s)) continue;
      s.spawn = null;
      s.initialVelocity = null;
    }
    this.placingIndex = this.nextEditableIndex();
    this.setData({ hint: "点击地图内位置放置第 1 个球" });
    this.draw();
  },

  async startBattle() {
    if (!this.allEditablePlaced()) {
      wx.showToast({ title: "请先放完自己的小球", icon: "none" });
      return;
    }
    if (this.mode === "roomUpdate") {
      try {
        await cloud.updateRoom(this.roomId, { slots: this.match.slots, placed: true });
        wx.navigateBack();
      } catch (err) {
        wx.showToast({ title: err.message || "保存布阵失败", icon: "none" });
      }
      return;
    }
    if (!this.match.slots.every((s) => s.spawn)) {
      wx.showToast({ title: "请先放完所有小球", icon: "none" });
      return;
    }
    getApp().globalData.lastMatch = { config: this.match };
    wx.navigateTo({ url: "/pages/battle/battle" });
  },

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#081116";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    const scale = Math.min(this.width, this.height) / 1400;
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(scale, scale);
    this.drawMap(ctx);
    for (const slot of this.match.slots) {
      if (!slot.spawn) continue;
      this.drawSlot(ctx, slot);
    }
    if (this.dragSlot && this.dragPoint) this.drawDragArrow(ctx, this.dragSlot, this.dragPoint);
    ctx.restore();
  },

  drawSlot(ctx, slot) {
    const cfg = BALL_BY_ID[slot.ballId];
    const editable = this.isEditable(slot);
    if (!cfg) {
      this.drawUnknownSlot(ctx, slot);
      return;
    }
    const img = this.assets && this.assets[cfg.id];
    if (img) {
      ctx.drawImage(img, slot.spawn.x - cfg.stats.radius, slot.spawn.y - cfg.stats.radius, cfg.stats.radius * 2, cfg.stats.radius * 2);
      ctx.strokeStyle = teamColor(slot.teamId);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(slot.spawn.x, slot.spawn.y, cfg.stats.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = cfg.color;
      ctx.strokeStyle = teamColor(slot.teamId);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(slot.spawn.x, slot.spawn.y, cfg.stats.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (!this.hideEnemyVelocity || editable) {
      const v = slot.initialVelocity || { x: 120, y: 0 };
      this.drawDirectionArrow(ctx, slot.spawn, v, cfg.stats.radius, teamColor(slot.teamId), false);
    }
  },

  drawUnknownSlot(ctx, slot) {
    ctx.save();
    ctx.fillStyle = "rgba(80,96,112,0.82)";
    ctx.strokeStyle = "rgba(216,255,249,0.75)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(slot.spawn.x, slot.spawn.y, UNKNOWN_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 54px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", slot.spawn.x, slot.spawn.y);
    ctx.restore();
  },

  drawDragArrow(ctx, slot, point) {
    const cfg = BALL_BY_ID[slot.ballId];
    if (!cfg) return;
    const delta = { x: point.x - slot.spawn.x, y: point.y - slot.spawn.y };
    this.drawDirectionArrow(ctx, slot.spawn, delta, cfg.stats.radius, "#ffffff", true);
  },

  drawDirectionArrow(ctx, origin, vector, radius, color, active) {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    if (length < 1) return;
    const dir = { x: vector.x / length, y: vector.y / length };
    const shaftStart = { x: origin.x + dir.x * (radius + 12), y: origin.y + dir.y * (radius + 12) };
    const visualLength = active ? Math.max(radius + 115, Math.min(radius + 300, length)) : radius + 145;
    const shaftEnd = { x: origin.x + dir.x * visualLength, y: origin.y + dir.y * visualLength };
    const headLength = active ? 42 : 34;
    const headWidth = active ? 34 : 26;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = active ? "rgba(255,255,255,0.85)" : color;
    ctx.shadowBlur = active ? 18 : 10;
    ctx.strokeStyle = active ? "#ffffff" : color;
    ctx.lineWidth = active ? 12 : 8;
    ctx.beginPath();
    ctx.moveTo(shaftStart.x, shaftStart.y);
    ctx.lineTo(shaftEnd.x, shaftEnd.y);
    ctx.stroke();
    ctx.fillStyle = active ? "#ffffff" : color;
    ctx.beginPath();
    ctx.moveTo(shaftEnd.x, shaftEnd.y);
    ctx.lineTo(shaftEnd.x - dir.x * headLength - dir.y * headWidth * 0.5, shaftEnd.y - dir.y * headLength + dir.x * headWidth * 0.5);
    ctx.lineTo(shaftEnd.x - dir.x * headLength + dir.y * headWidth * 0.5, shaftEnd.y - dir.y * headLength - dir.x * headWidth * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawMap(ctx) {
    const map = MAPS[this.match.map];
    const sides = map.sides;
    const radius = map.radius / Math.cos(Math.PI / sides);
    const start = -Math.PI / 2 + (sides === 4 ? Math.PI / 4 : 0);
    ctx.strokeStyle = "#294957";
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const x = Math.cos(start + i * Math.PI * 2 / sides) * radius;
      const y = Math.sin(start + i * Math.PI * 2 / sides) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
});

function teamColor(teamId) {
  if (teamId === "A") return "#19c2b1";
  if (teamId === "B") return "#ff5f7d";
  return "#f3d45c";
}
