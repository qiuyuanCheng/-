const BaseScene = require("./base_scene");
const { Button, roundRect } = require("../ui/button");
const { BALLS, BALL_BY_ID, MAPS, MODES } = require("../core/configs_v2");
const { createDefaultMatch } = require("../core/simulation_v2");
const cloud = require("../services/cloud_service");
const {
  buildRoomCreateMatch,
  selectedSlotsForRole,
  editableTeamsForRole,
  getBallName
} = require("../services/room_helpers");

const MAP_IDS = ["SQUARE", "TRIANGLE", "PENTAGON"];

class SetupScene extends BaseScene {
  enter(params) {
    this.params = params || {};
    this.roomMode = this.params.roomMode || "";
    this.roomId = this.params.roomId || "";
    this.role = this.params.role || (this.roomMode === "create" ? "owner" : "");
    this.modeId = this.params.modeId || (this.params.match && this.params.match.mode) || "ONE_VS_ONE";
    this.mapId = this.params.mapId || (this.params.match && this.params.match.map) || "SQUARE";
    this.match = this.params.match ? JSON.parse(JSON.stringify(this.params.match)) : createDefaultMatch(this.modeId);
    this.match.map = this.mapId;
    if (this.roomMode === "create") this.prepareCreateMatch();
    this.selectedSlotIndex = 0;
    this.scrollY = 0;
    this.dragStartY = 0;
    this.startScrollY = 0;
    this.message = "";
    this.loading = false;
    this.ensureSelectedEditable();
    this.buttons = [
      new Button({ x: 0, y: 0, w: 86, h: 36 }, "\u8fd4\u56de", () => this.goBack(), { fill: "#1b2933", stroke: "#344a56" }),
      new Button({ x: 0, y: 0, w: 126, h: 36 }, this.actionText(), () => this.submit(), { fill: "#153830" })
    ];
    this.layoutButtons();
  }

  prepareCreateMatch() {
    this.match.slots = (this.match.slots || []).map((slot) => {
      if (slot.teamId === "A") return slot;
      return Object.assign({}, slot, { ballId: null, spawn: null, initialVelocity: null, initialAngleDeg: 0 });
    });
  }

  editableSlots() {
    if (!this.roomMode) return this.match.slots || [];
    const teams = editableTeamsForRole(this.role);
    return (this.match.slots || []).filter((slot) => teams.includes(slot.teamId));
  }

  ensureSelectedEditable() {
    const editable = this.editableSlots();
    if (!editable.length) return;
    const current = this.match.slots[this.selectedSlotIndex];
    if (!current || !editable.includes(current)) this.selectedSlotIndex = this.match.slots.indexOf(editable[0]);
  }

  render(ctx) {
    this.layoutButtons();
    this.renderBackground(ctx);
    this.drawTitle(ctx, this.titleText(), this.subtitleText());
    this.drawMapTabs(ctx);
    this.drawSlots(ctx);
    this.drawBallList(ctx);
    this.drawMessage(ctx);
    this.drawButtons(ctx);
  }

  titleText() {
    if (this.roomMode === "create") return "\u521b\u5efa\u597d\u53cb\u623f\u95f4";
    if (this.roomMode === "select") return "\u9009\u62e9\u6211\u7684\u5c0f\u7403";
    return "\u9009\u62e9\u5730\u56fe\u548c\u5c0f\u7403";
  }

  subtitleText() {
    if (this.roomMode === "create") return "\u5148\u9009\u62e9\u4f60\u7684 A \u9635\u8425\u5c0f\u7403";
    if (this.roomMode === "select") return "\u53ea\u80fd\u4fee\u6539\u81ea\u5df1\u7684\u9635\u8425";
    return `${MODES[this.modeId].name} \u00b7 ${MAPS[this.mapId].name}`;
  }

  actionText() {
    if (this.roomMode === "create") return "\u521b\u5efa\u623f\u95f4";
    if (this.roomMode === "select") return "\u4fdd\u5b58\u9009\u62e9";
    return "\u53bb\u5e03\u9635";
  }

  drawSlots(ctx) {
    const slots = this.editableSlots();
    const top = this.app.safeTop + 150;
    const cardW = slots.length > 1 ? (this.app.width - 40) / Math.min(2, slots.length) : this.app.width - 32;
    slots.forEach((slot, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = slots.length > 1 ? 16 + col * (cardW + 8) : 16;
      const y = top + row * 54;
      const selected = this.match.slots.indexOf(slot) === this.selectedSlotIndex;
      ctx.save();
      ctx.fillStyle = selected ? "rgba(25,194,177,0.24)" : "rgba(10,22,28,0.92)";
      ctx.strokeStyle = teamColor(slot.teamId);
      roundRect(ctx, x, y, cardW, 44, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${slot.slotId} ${getBallName(slot.ballId)}`, x + 10, y + 26);
      ctx.restore();
    });
  }

  drawMapTabs(ctx) {
    const canChoose = !this.roomMode || this.roomMode === "create";
    const top = this.app.safeTop + 104;
    const gap = 8;
    const w = Math.min(94, (this.app.width - 48 - gap * 2) / 3);
    const startX = (this.app.width - (w * 3 + gap * 2)) / 2;
    ctx.save();
    MAP_IDS.forEach((id, i) => {
      const x = startX + i * (w + gap);
      const selected = this.mapId === id;
      ctx.fillStyle = selected ? "rgba(25,194,177,0.28)" : "rgba(10,22,28,0.88)";
      ctx.strokeStyle = selected ? "#35e6d0" : "rgba(148,190,204,0.28)";
      roundRect(ctx, x, top, w, 32, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = canChoose ? "#d8fff9" : "rgba(216,255,249,0.48)";
      ctx.font = "800 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(MAPS[id].name.replace("\u6b63", ""), x + w / 2, top + 16);
    });
    ctx.restore();
  }

  drawBallList(ctx) {
    const listTop = this.app.safeTop + 272;
    const bottom = this.app.height - 76;
    const current = this.match.slots[this.selectedSlotIndex] || {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, this.app.width, bottom - listTop);
    ctx.clip();
    BALLS.forEach((ball, i) => {
      const y = listTop + 8 + i * 72 - this.scrollY;
      if (y < listTop - 80 || y > bottom) return;
      const selected = current.ballId === ball.id;
      ctx.fillStyle = selected ? "rgba(25,194,177,0.22)" : "rgba(10,22,28,0.9)";
      ctx.strokeStyle = selected ? "#19c2b1" : "rgba(148,190,204,0.28)";
      roundRect(ctx, 16, y, this.app.width - 32, 62, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.arc(46, y + 31, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = teamColor(current.teamId || "A");
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 15px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(ball.name, 76, y + 25);
      ctx.fillStyle = "#9eb3bf";
      ctx.font = "700 12px sans-serif";
      ctx.fillText(labelFor(ball), 76, y + 45);
    });
    ctx.restore();
  }

  drawMessage(ctx) {
    if (!this.message && !this.loading) return;
    ctx.save();
    ctx.fillStyle = this.message.startsWith("!") ? "#ffb8c4" : "#d8fff9";
    ctx.font = "800 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.loading ? "\u6b63\u5728\u5904\u7406..." : this.message.replace(/^!/, ""), this.app.width / 2, this.app.height - 72);
    ctx.restore();
  }

  layoutButtons() {
    const gap = 10;
    const total = 86 + 126 + gap;
    const y = this.app.height - 54;
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
    this.buttons[1].text = this.actionText();
  }

  async submit() {
    if (this.loading) return;
    if (!this.roomMode) {
      this.app.sceneManager.replace("place", { match: this.match });
      return;
    }
    try {
      this.loading = true;
      this.message = "";
      if (this.editableSlots().some((slot) => !BALL_BY_ID[slot.ballId])) {
        this.message = "!\u8bf7\u5148\u9009\u62e9\u5c0f\u7403";
        toast(this.message.slice(1));
        return;
      }
      if (this.roomMode === "create") {
        const safeMatch = buildRoomCreateMatch(this.match);
        const room = await cloud.createRoom({ match: safeMatch });
        this.app.sceneManager.replace("room", { roomId: room._id });
        return;
      }
      await cloud.updateRoom(this.roomId, { selectionSlots: selectedSlotsForRole(this.match, this.role) });
      this.app.sceneManager.replace("room", { roomId: this.roomId });
    } catch (err) {
      this.message = `!${err.message || err}`;
      toast(this.message.slice(1));
    } finally {
      this.loading = false;
    }
  }

  goBack() {
    if (this.roomMode === "select") this.app.sceneManager.replace("room", { roomId: this.roomId });
    else this.app.sceneManager.replace("mode", this.roomMode === "create" ? { roomFlow: true } : {});
  }

  onTouchStart(e) {
    this.dragStartY = e.y;
    this.startScrollY = this.scrollY;
  }

  onTouchMove(e) {
    const listTop = this.app.safeTop + 272;
    if (e.y >= listTop) {
      const max = Math.max(0, BALLS.length * 72 - (this.app.height - listTop - 88));
      this.scrollY = clamp(this.startScrollY - (e.y - this.dragStartY), 0, max);
    }
  }

  onTouchEnd(e) {
    const button = this.buttons.find((b) => b.hitTest(e.x, e.y));
    if (button) return button.tap();
    if ((!this.roomMode || this.roomMode === "create") && this.hitMapTab(e.x, e.y)) return;
    const slots = this.editableSlots();
    const top = this.app.safeTop + 150;
    const cardW = slots.length > 1 ? (this.app.width - 40) / Math.min(2, slots.length) : this.app.width - 32;
    for (let i = 0; i < slots.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = slots.length > 1 ? 16 + col * (cardW + 8) : 16;
      const y = top + row * 54;
      if (e.x >= x && e.x <= x + cardW && e.y >= y && e.y <= y + 44) {
        this.selectedSlotIndex = this.match.slots.indexOf(slots[i]);
        return;
      }
    }
    const listTop = this.app.safeTop + 272;
    const idx = Math.floor((e.y - listTop - 8 + this.scrollY) / 72);
    const current = this.match.slots[this.selectedSlotIndex];
    if (current && idx >= 0 && idx < BALLS.length) current.ballId = BALLS[idx].id;
  }

  hitMapTab(x, y) {
    const top = this.app.safeTop + 104;
    if (y < top || y > top + 32) return false;
    const gap = 8;
    const w = Math.min(94, (this.app.width - 48 - gap * 2) / 3);
    const startX = (this.app.width - (w * 3 + gap * 2)) / 2;
    for (let i = 0; i < MAP_IDS.length; i++) {
      const id = MAP_IDS[i];
      const bx = startX + i * (w + gap);
      if (x >= bx && x <= bx + w) {
        this.mapId = id;
        this.match.map = id;
        return true;
      }
    }
    return false;
  }
}

function labelFor(ball) {
  const type = ball.weapon.type;
  if (["projectile", "laser", "harpoon"].includes(type)) return "\u8fdc\u7a0b\u8f93\u51fa";
  if (["ring", "rotatingPart", "dualFixed", "fixedPart"].includes(type)) return "\u8fd1\u6218\u538b\u5236";
  if (["fieldZone", "mine", "wallSegmentTrail", "flameBurstTrail", "prismPartition"].includes(type)) return "\u533a\u57df\u63a7\u5236";
  return "\u7efc\u5408\u5bf9\u6297";
}

function teamColor(team) {
  if (team === "A") return "#19c2b1";
  if (team === "B") return "#ff5f7d";
  return "#f3d45c";
}

function toast(title) {
  if (typeof wx !== "undefined" && wx.showToast) wx.showToast({ title, icon: "none" });
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

module.exports = SetupScene;
