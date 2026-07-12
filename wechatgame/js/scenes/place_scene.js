const BaseScene = require("./base_scene");
const { Button, roundRect } = require("../ui/button");
const { BALL_BY_ID, BALLS, MAPS } = require("../core/configs_v2");
const { buildWalls } = require("../core/simulation_v2");
const { mapVertices, mapBounds } = require("../core/map_geometry");
const cloud = require("../services/cloud_service");
const { canEditSlot, placedSlotsForRole, getBallName } = require("../services/room_helpers");

const DEFAULT_RADIUS = 82;

class PlaceScene extends BaseScene {
  enter(params) {
    this.params = params || {};
    this.roomMode = this.params.roomMode || "";
    this.roomId = this.params.roomId || "";
    this.role = this.params.role || "";
    this.match = JSON.parse(JSON.stringify(params.match));
    this.updateMapLayout();
    this.selected = 0;
    this.dragMode = "";
    this.message = "";
    this.loading = false;
    this.assignDefaults();
    this.ensureEditableSelected();
    this.buttons = [
      new Button({ x: 0, y: 0, w: 86, h: 36 }, "\u8fd4\u56de", () => this.goBack(), { fill: "#1b2933", stroke: "#344a56" }),
      new Button({ x: 0, y: 0, w: 126, h: 36 }, this.actionText(), () => this.submit())
    ];
    this.layoutButtons();
  }

  editableSlots() {
    if (!this.roomMode) return this.match.slots || [];
    return (this.match.slots || []).filter((slot) => canEditSlot(slot, this.role));
  }

  ensureEditableSelected() {
    const editable = this.editableSlots();
    if (!editable.length) return;
    if (!canEditSlot(this.match.slots[this.selected], this.role) && this.roomMode) this.selected = this.match.slots.indexOf(editable[0]);
  }

  assignDefaults() {
    const positions = defaultPositions(this.editableSlots().length || this.match.slots.length);
    let editableIndex = 0;
    this.match.slots.forEach((slot, i) => {
      const editable = !this.roomMode || canEditSlot(slot, this.role);
      if (!editable) return;
      if (!slot.ballId) slot.ballId = BALLS[i % BALLS.length].id;
      const ball = BALL_BY_ID[slot.ballId];
      if (!ball) return;
      slot.spawn = slot.spawn || positions[editableIndex] || positions[0];
      slot.spawn = this.keepInside(slot.spawn, ball.stats.radius || DEFAULT_RADIUS);
      slot.initialVelocity = slot.initialVelocity || velocityToward(slot.spawn, { x: 0, y: 0 });
      slot.initialAngleDeg = Math.atan2(slot.initialVelocity.y, slot.initialVelocity.x) * 180 / Math.PI;
      editableIndex += 1;
    });
  }

  updateMapLayout() {
    const map = MAPS[this.match.map] || MAPS.SQUARE;
    const bounds = mapBounds(this.match.map, map);
    const maxW = this.app.width - 56;
    const maxH = this.app.height * 0.48;
    this.mapScale = Math.min(maxW / (bounds.width + 34), maxH / (bounds.height + 34));
    this.mapCenter = {
      x: this.app.width / 2 - ((bounds.minX + bounds.maxX) / 2) * this.mapScale,
      y: this.app.safeTop + 178 - bounds.minY * this.mapScale
    };
  }

  actionText() {
    return this.roomMode ? "\u4fdd\u5b58\u5e03\u9635" : "\u5f00\u59cb\u6218\u6597";
  }

  render(ctx) {
    this.updateMapLayout();
    this.layoutButtons();
    this.renderBackground(ctx);
    this.drawTitle(ctx, this.roomMode ? "\u623f\u95f4\u5e03\u9635" : "\u5e03\u9635", "\u62d6\u52a8\u5c0f\u7403\u8bbe\u7f6e\u4f4d\u7f6e\uff0c\u62d6\u51fa\u7bad\u5934\u8bbe\u7f6e\u901f\u5ea6");
    this.drawMap(ctx);
    this.drawBalls(ctx);
    this.drawButtons(ctx);
    this.drawInfo(ctx);
  }

  layoutButtons() {
    const gap = 10;
    const total = 86 + 126 + gap;
    const bounds = mapBounds(this.match.map, MAPS[this.match.map] || MAPS.SQUARE);
    const mapBottom = this.mapCenter.y + bounds.maxY * this.mapScale;
    const y = Math.min(this.app.height - 100, Math.max(this.app.safeTop + 92, mapBottom + 16));
    let x = Math.max(14, (this.app.width - total) / 2);
    this.buttons[0].rect.x = x;
    this.buttons[0].rect.y = y;
    this.buttons[0].rect.w = 86;
    this.buttons[0].rect.h = 36;
    x += 86 + gap;
    this.buttons[1].rect.x = x;
    this.buttons[1].rect.y = y;
    this.buttons[1].rect.w = 126;
    this.buttons[1].rect.h = 36;
    this.buttons[1].text = this.loading ? "\u4fdd\u5b58\u4e2d..." : this.actionText();
  }

  drawMap(ctx) {
    const map = MAPS[this.match.map] || MAPS.SQUARE;
    const verts = mapVertices(this.match.map, map);
    const bounds = mapBounds(this.match.map, map);
    ctx.save();
    ctx.translate(this.mapCenter.x, this.mapCenter.y);
    ctx.scale(this.mapScale, this.mapScale);
    ctx.beginPath();
    verts.forEach((v, i) => {
      if (i === 0) ctx.moveTo(v.x, v.y);
      else ctx.lineTo(v.x, v.y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    const step = 150;
    for (let p = Math.floor(bounds.minX / step) * step; p <= bounds.maxX; p += step) {
      ctx.beginPath();
      ctx.moveTo(p, bounds.minY);
      ctx.lineTo(p, bounds.maxY);
      ctx.stroke();
    }
    for (let p = Math.floor(bounds.minY / step) * step; p <= bounds.maxY; p += step) {
      ctx.beginPath();
      ctx.moveTo(bounds.minX, p);
      ctx.lineTo(bounds.maxX, p);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(this.mapCenter.x, this.mapCenter.y);
    ctx.scale(this.mapScale, this.mapScale);
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#f4f7fb";
    ctx.lineWidth = 7;
    ctx.beginPath();
    verts.forEach((v, i) => {
      if (i === 0) ctx.moveTo(v.x, v.y);
      else ctx.lineTo(v.x, v.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#294957";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  drawBalls(ctx) {
    (this.match.slots || []).forEach((slot, i) => {
      const editable = !this.roomMode || canEditSlot(slot, this.role);
      if (!editable && !slot.spawn) return;
      const ball = BALL_BY_ID[slot.ballId];
      if (editable && !ball) return;
      const p = this.worldToScreen(slot.spawn || { x: 0, y: 0 });
      const r = Math.max(14, (ball ? ball.stats.radius : DEFAULT_RADIUS) * this.mapScale);
      ctx.save();
      if (!editable) {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = "rgba(120,135,145,0.5)";
      } else {
        ctx.fillStyle = ball.color;
      }
      ctx.shadowColor = i === this.selected ? "#ffffff" : (ball ? ball.color : "#9eb3bf");
      ctx.shadowBlur = i === this.selected ? 16 : 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = teamColor(slot.teamId);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(editable ? slot.slotId : "\u6697", p.x, p.y);
      if (editable) this.drawArrow(ctx, p, slot.initialVelocity, r);
      ctx.restore();
    });
  }

  drawArrow(ctx, p, v, r) {
    if (!v) return;
    const length = Math.min(110, Math.max(52, Math.hypot(v.x, v.y) * 0.14));
    const a = Math.atan2(v.y, v.x);
    const sx = p.x + Math.cos(a) * (r + 6);
    const sy = p.y + Math.sin(a) * (r + 6);
    const ex = p.x + Math.cos(a) * (r + length);
    const ey = p.y + Math.sin(a) * (r + length);
    ctx.save();
    ctx.strokeStyle = "#d8fff9";
    ctx.shadowColor = "#19c2b1";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = "#d8fff9";
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(a - 0.48) * 18, ey - Math.sin(a - 0.48) * 18);
    ctx.lineTo(ex - Math.cos(a + 0.48) * 18, ey - Math.sin(a + 0.48) * 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawInfo(ctx) {
    const slot = this.match.slots[this.selected] || this.editableSlots()[0] || {};
    const y = Math.min(this.app.height - 56, this.buttons[0].rect.y + 44);
    ctx.save();
    ctx.fillStyle = "rgba(10,22,28,0.92)";
    ctx.strokeStyle = "rgba(148,190,204,0.28)";
    roundRect(ctx, 16, y, this.app.width - 32, 46, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.message.startsWith("!") ? "#ffb8c4" : "#ffffff";
    ctx.font = "900 13px sans-serif";
    ctx.fillText(this.message ? this.message.replace(/^!/, "") : `${slot.slotId || ""} ${getBallName(slot.ballId)}`, 30, y + 19);
    ctx.fillStyle = "#9eb3bf";
    ctx.font = "700 11px sans-serif";
    ctx.fillText(this.roomMode ? "\u53ea\u80fd\u5e03\u7f6e\u81ea\u5df1\u7684\u9635\u8425\uff0c\u5bf9\u65b9\u65b9\u5411\u4e0d\u53ef\u89c1" : "\u4ece\u7403\u4f53\u5411\u5916\u62d6\u52a8\u8bbe\u7f6e\u901f\u5ea6\u65b9\u5411", 30, y + 37);
    ctx.restore();
  }

  async submit() {
    if (this.loading) return;
    if (!this.roomMode) {
      this.app.lastMatch = JSON.parse(JSON.stringify(this.match));
      this.app.sceneManager.replace("battle", { match: this.match });
      return;
    }
    if (!this.editableSlots().every((slot) => BALL_BY_ID[slot.ballId] && slot.spawn && slot.initialVelocity)) {
      this.message = "!\u8bf7\u5148\u5b8c\u6210\u5e03\u9635";
      toast(this.message.slice(1));
      return;
    }
    try {
      this.loading = true;
      await cloud.updateRoom(this.roomId, { slots: placedSlotsForRole(this.match, this.role), placed: true });
      this.app.sceneManager.replace("room", { roomId: this.roomId });
    } catch (err) {
      this.message = `!${err.message || err}`;
      toast(this.message.slice(1));
    } finally {
      this.loading = false;
    }
  }

  goBack() {
    if (this.roomMode) this.app.sceneManager.replace("room", { roomId: this.roomId });
    else this.app.sceneManager.replace("setup", { modeId: this.match.mode, mapId: this.match.map });
  }

  onTouchStart(e) {
    const button = this.buttons.find((b) => b.hitTest(e.x, e.y));
    if (button) return;
    const hit = this.hitBall(e.x, e.y);
    if (hit >= 0) {
      this.selected = hit;
      const slot = this.match.slots[hit];
      const center = this.worldToScreen(slot.spawn);
      const radius = Math.max(22, this.slotRadius(slot) * this.mapScale);
      this.dragMode = Math.hypot(e.x - center.x, e.y - center.y) <= radius * 0.65 ? "ball" : "arrow";
      return;
    }
    if (this.editableSlots().length) this.dragMode = "arrow";
  }

  onTouchMove(e) {
    if (!this.dragMode) return;
    const slot = this.match.slots[this.selected];
    if (!slot || (this.roomMode && !canEditSlot(slot, this.role))) return;
    if (this.dragMode === "ball") {
      const p = this.screenToWorld(e);
      const next = this.keepInside(p, this.slotRadius(slot));
      if (!this.overlapsAny(next, this.selected)) slot.spawn = next;
      return;
    }
    const origin = this.worldToScreen(slot.spawn);
    const vx = e.x - origin.x;
    const vy = e.y - origin.y;
    const len = Math.max(1, Math.hypot(vx, vy));
    const speed = Math.min(860, Math.max(520, len * 8));
    slot.initialVelocity = { x: vx / len * speed, y: vy / len * speed };
    slot.initialAngleDeg = Math.atan2(slot.initialVelocity.y, slot.initialVelocity.x) * 180 / Math.PI;
  }

  onTouchEnd(e) {
    const button = this.buttons.find((b) => b.hitTest(e.x, e.y));
    if (button) return button.tap();
    const hit = this.hitBall(e.x, e.y);
    if (hit >= 0) this.selected = hit;
    this.dragMode = "";
  }

  hitBall(x, y) {
    for (let i = (this.match.slots || []).length - 1; i >= 0; i--) {
      const slot = this.match.slots[i];
      if (this.roomMode && !canEditSlot(slot, this.role)) continue;
      if (!slot.spawn || !BALL_BY_ID[slot.ballId]) continue;
      const p = this.worldToScreen(slot.spawn);
      const r = Math.max(22, this.slotRadius(slot) * this.mapScale);
      if (Math.hypot(x - p.x, y - p.y) <= r + 8) return i;
    }
    return -1;
  }

  slotRadius(slot) {
    return BALL_BY_ID[slot.ballId] ? BALL_BY_ID[slot.ballId].stats.radius : DEFAULT_RADIUS;
  }

  worldToScreen(p) {
    return { x: this.mapCenter.x + p.x * this.mapScale, y: this.mapCenter.y + p.y * this.mapScale };
  }

  screenToWorld(p) {
    return { x: (p.x - this.mapCenter.x) / this.mapScale, y: (p.y - this.mapCenter.y) / this.mapScale };
  }

  keepInside(pos, radius) {
    let p = { x: pos.x, y: pos.y };
    const walls = buildWalls(MAPS[this.match.map] || MAPS.SQUARE);
    for (let pass = 0; pass < 3; pass++) {
      walls.forEach((wall) => {
        const d = p.x * wall.normal.x + p.y * wall.normal.y - wall.c;
        if (d < radius) {
          p.x += wall.normal.x * (radius - d + 1);
          p.y += wall.normal.y * (radius - d + 1);
        }
      });
    }
    return p;
  }

  overlapsAny(pos, index) {
    const radius = this.slotRadius(this.match.slots[index]);
    return (this.match.slots || []).some((slot, i) => {
      if (i === index || !slot.spawn) return false;
      const otherRadius = this.slotRadius(slot);
      return Math.hypot(pos.x - slot.spawn.x, pos.y - slot.spawn.y) < radius + otherRadius + 8;
    });
  }
}

function defaultPositions(count) {
  const presets = [
    { x: -260, y: -180 }, { x: 260, y: 180 }, { x: 260, y: -180 },
    { x: -260, y: 180 }, { x: 0, y: 260 }
  ];
  return presets.slice(0, Math.max(1, count));
}

function velocityToward(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  return { x: dx / len * 650, y: dy / len * 650 };
}

function teamColor(team) {
  if (team === "A") return "#19c2b1";
  if (team === "B") return "#ff5f7d";
  return "#f3d45c";
}

function toast(title) {
  if (typeof wx !== "undefined" && wx.showToast) wx.showToast({ title, icon: "none" });
}

module.exports = PlaceScene;
