const BaseScene = require("./base_scene");
const { Button, roundRect } = require("../ui/button");
const cloud = require("../services/cloud_service");
const {
  roleLabel,
  hasOwnSelection,
  hasOwnPlacement,
  allSelected,
  allPlaced
} = require("../services/room_helpers");

class RoomScene extends BaseScene {
  enter(params) {
    this.roomId = params.roomId || "";
    this.room = null;
    this.role = "viewer";
    this.statusText = "";
    this.errorText = "";
    this.loading = false;
    this.pollIn = 0;
    this.closed = false;
    this.buttons = [];
    this.refresh(false);
  }

  leave() {
    this.closed = true;
  }

  update(dt) {
    if (!this.roomId || this.loading || this.closed) return;
    this.pollIn -= dt || 0.016;
    if (this.pollIn <= 0) {
      this.pollIn = 1.6;
      this.refresh(true);
    }
  }

  async refresh(silent) {
    if (!this.roomId) {
      this.errorText = "\u623f\u95f4\u4e0d\u5b58\u5728";
      return;
    }
    try {
      if (!silent) this.loading = true;
      const room = await cloud.getRoom(this.roomId);
      if (this.closed) return;
      this.applyRoom(room);
    } catch (err) {
      if (!silent) {
        this.errorText = err.message || String(err || "");
        toast(this.errorText);
      }
    } finally {
      this.loading = false;
    }
  }

  applyRoom(room) {
    this.room = room;
    this.role = room.role || "viewer";
    this.errorText = "";
    this.statusText = statusText(room);
    if ((room.status === "ready" || room.status === "playing") && room.match) {
      this.app.sceneManager.replace("battle", { match: room.match, roomId: this.roomId, roomMode: true });
    }
  }

  render(ctx) {
    this.renderBackground(ctx);
    this.layoutButtons();
    this.drawPanel(ctx);
    this.drawButtons(ctx);
  }

  drawPanel(ctx) {
    const w = this.app.width;
    const top = this.app.safeTop + 62;
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 30px sans-serif";
    ctx.shadowColor = "rgba(30,255,230,0.65)";
    ctx.shadowBlur = 16;
    ctx.fillText("\u597d\u53cb\u6311\u6218", w / 2, top);
    ctx.shadowBlur = 0;

    const x = 18;
    const y = top + 46;
    const h = Math.min(300, this.app.height - y - 260);
    ctx.fillStyle = "rgba(8,18,24,0.92)";
    ctx.strokeStyle = "rgba(90,190,205,0.38)";
    roundRect(ctx, x, y, w - 36, h, 12);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = "800 13px sans-serif";
    let lineY = y + 30;
    const roomNo = this.roomId || "--";
    this.drawLine(ctx, "\u623f\u95f4\u53f7", roomNo, x + 18, lineY);
    lineY += 28;
    this.drawLine(ctx, "\u8eab\u4efd", roleLabel(this.role), x + 18, lineY);
    lineY += 28;
    this.drawLine(ctx, "\u72b6\u6001", this.statusText || "\u6b63\u5728\u8fde\u63a5...", x + 18, lineY);
    lineY += 34;

    if (this.room) {
      this.drawTeamRow(ctx, "A", this.room.ownerSelected, this.room.ownerPlaced, this.room.ownerReady, x + 18, lineY);
      lineY += 30;
      this.drawTeamRow(ctx, "B/C", this.room.guestSelected, this.room.guestPlaced, this.room.guestReady, x + 18, lineY);
    }

    const msg = this.errorText || (this.loading ? "\u6b63\u5728\u540c\u6b65\u623f\u95f4..." : hintText(this.room, this.role));
    ctx.fillStyle = this.errorText ? "#ffb8c4" : "#9eb3bf";
    ctx.font = "700 12px sans-serif";
    wrapText(ctx, msg, x + 18, y + h - 42, w - 72, 18);
    ctx.restore();
  }

  drawLine(ctx, label, value, x, y) {
    ctx.fillStyle = "#7fb8bd";
    ctx.fillText(`${label}:`, x, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(value), x + 72, y);
  }

  drawTeamRow(ctx, team, selected, placed, ready, x, y) {
    ctx.fillStyle = team === "A" ? "#19c2b1" : "#ff5f7d";
    ctx.font = "900 13px sans-serif";
    ctx.fillText(`${team} \u9635\u8425`, x, y);
    ctx.font = "800 12px sans-serif";
    ctx.fillStyle = selected ? "#d8fff9" : "#667984";
    ctx.fillText(selected ? "\u5df2\u9009" : "\u672a\u9009", x + 78, y);
    ctx.fillStyle = placed ? "#d8fff9" : "#667984";
    ctx.fillText(placed ? "\u5df2\u5e03\u9635" : "\u672a\u5e03\u9635", x + 128, y);
    ctx.fillStyle = ready ? "#d8fff9" : "#667984";
    ctx.fillText(ready ? "\u5df2\u51c6\u5907" : "\u672a\u51c6\u5907", x + 206, y);
  }

  layoutButtons() {
    const w = this.app.width;
    const bw = Math.min(270, w - 64);
    const startY = Math.max(this.app.safeTop + 390, this.app.height - 284);
    const specs = [
      ["\u9080\u8bf7\u597d\u53cb", () => this.invite(), this.canInvite()],
      [this.role === "viewer" ? "\u52a0\u5165\u623f\u95f4" : "\u9009\u62e9\u6211\u7684\u5c0f\u7403", () => this.role === "viewer" ? this.join() : this.selectBalls(), this.role === "viewer" ? this.canJoin() : this.canSelect()],
      ["\u5e03\u7f6e\u4f4d\u7f6e\u548c\u65b9\u5411", () => this.configure(), this.canConfigure()],
      ["\u51c6\u5907\u5f00\u6218", () => this.ready(), this.canReady()],
      ["\u5237\u65b0", () => this.refresh(false), true],
      ["\u8fd4\u56de\u9996\u9875", () => this.app.sceneManager.replace("home"), true]
    ];
    this.buttons = specs.map((spec, i) => new Button(
      { x: (w - bw) / 2, y: startY + i * 42, w: bw, h: 34 },
      spec[0],
      () => spec[2] ? spec[1]() : this.explainDisabled(spec[0]),
      { fill: spec[2] ? (i === 0 ? "#138473" : "#153830") : "#1d2a30", stroke: spec[2] ? "#35e6d0" : "#344a56", fontSize: 14, radius: 8, color: spec[2] ? "#d8fff9" : "#72858d" }
    ));
  }

  canInvite() {
    return this.role === "owner" && !!this.roomId;
  }

  canJoin() {
    return this.role === "viewer" && this.room && !this.room.guestOpenid && this.room.status !== "expired";
  }

  canSelect() {
    return this.role === "owner" || this.role === "guest";
  }

  canConfigure() {
    return this.canSelect() && this.room && allSelected(this.room) && hasOwnSelection(this.room.match, this.role);
  }

  canReady() {
    return this.canSelect() && this.room && hasOwnPlacement(this.room.match, this.role);
  }

  explainDisabled(label) {
    let msg = "\u6682\u65f6\u4e0d\u53ef\u7528";
    if (label.includes("\u52a0\u5165")) msg = "\u623f\u95f4\u5df2\u6ee1\u6216\u5df2\u8fc7\u671f";
    else if (label.includes("\u5e03\u7f6e")) msg = !this.canSelect() ? "\u8bf7\u5148\u52a0\u5165\u623f\u95f4" : "\u7b49\u5f85\u53cc\u65b9\u9009\u62e9\u5c0f\u7403";
    else if (label.includes("\u51c6\u5907")) msg = "\u8bf7\u5148\u5b8c\u6210\u5e03\u9635";
    else if (label.includes("\u9080\u8bf7")) msg = "\u53ea\u6709\u623f\u4e3b\u53ef\u4ee5\u9080\u8bf7\u597d\u53cb";
    this.errorText = msg;
    toast(msg);
  }

  async join() {
    try {
      this.loading = true;
      const room = await cloud.joinRoom(this.roomId);
      this.applyRoom(room);
    } catch (err) {
      this.errorText = err.message || String(err || "");
      toast(this.errorText);
    } finally {
      this.loading = false;
    }
  }

  invite() {
    if (typeof wx === "undefined" || !wx.shareAppMessage) {
      this.errorText = "\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301\u5206\u4eab";
      return;
    }
    wx.shareAppMessage({
      title: "\u6765\u300a\u7403\u7403\u4e71\u6597\u300b\u6311\u6218\u6211",
      query: `roomId=${this.roomId}`
    });
  }

  selectBalls() {
    if (!this.canSelect()) return this.explainDisabled("\u9009\u62e9");
    this.app.sceneManager.replace("setup", { roomMode: "select", roomId: this.roomId, role: this.role, match: this.room.match });
  }

  configure() {
    if (!this.canConfigure()) return this.explainDisabled("\u5e03\u7f6e");
    this.app.sceneManager.replace("place", { roomMode: "place", roomId: this.roomId, role: this.role, match: this.room.match });
  }

  async ready() {
    if (!this.canReady()) return this.explainDisabled("\u51c6\u5907");
    try {
      this.loading = true;
      const room = await cloud.updateRoom(this.roomId, { ready: true });
      this.applyRoom(room);
    } catch (err) {
      this.errorText = err.message || String(err || "");
      toast(this.errorText);
    } finally {
      this.loading = false;
    }
  }
}

function statusText(room) {
  if (!room) return "\u6b63\u5728\u8fde\u63a5...";
  if (room.status === "expired") return "\u623f\u95f4\u5df2\u8fc7\u671f";
  if (!room.guestOpenid) return "\u7b49\u5f85\u597d\u53cb\u52a0\u5165";
  if (!allSelected(room)) return "\u53cc\u65b9\u6697\u9009\u5c0f\u7403\u4e2d";
  if (!allPlaced(room)) return "\u53cc\u65b9\u5e03\u9635\u4e2d";
  if (!room.ownerReady || !room.guestReady) return "\u7b49\u5f85\u53cc\u65b9\u51c6\u5907";
  return "\u5f00\u59cb\u6218\u6597";
}

function hintText(room, role) {
  if (!room) return "\u6b63\u5728\u83b7\u53d6\u623f\u95f4\u4fe1\u606f";
  if (role === "viewer") return "\u70b9\u51fb\u52a0\u5165\u623f\u95f4\uff0c\u6210\u4e3a\u6311\u6218\u8005";
  if (!room.guestOpenid && role === "owner") return "\u5206\u4eab\u623f\u95f4\u7ed9\u597d\u53cb\uff0c\u7b49\u5f85\u5bf9\u65b9\u52a0\u5165";
  if (!allSelected(room)) return "\u8bf7\u53cc\u65b9\u5148\u9009\u62e9\u5c0f\u7403";
  if (!allPlaced(room)) return "\u9009\u7403\u5b8c\u6210\uff0c\u53ef\u4ee5\u5f00\u59cb\u5e03\u9635";
  return "\u5e03\u9635\u5b8c\u6210\u540e\u70b9\u51fb\u51c6\u5907\u5f00\u6218";
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = String(text || "").split("");
  let line = "";
  let lineY = y;
  chars.forEach((ch) => {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = ch;
      lineY += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, lineY);
}

function toast(title) {
  if (typeof wx !== "undefined" && wx.showToast) wx.showToast({ title, icon: "none" });
}

module.exports = RoomScene;
