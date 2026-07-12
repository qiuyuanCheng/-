const BaseScene = require("./base_scene");
const { Button, roundRect } = require("../ui/button");
const cloud = require("../services/cloud_service");
const { MAP_LABELS } = require("../core/result_report");
const storage = require("../storage");

class RecordsScene extends BaseScene {
  enter() {
    this.items = [];
    this.loading = false;
    this.errorText = "";
    this.scrollY = 0;
    this.startY = 0;
    this.startScrollY = 0;
    this.buttons = [
      new Button({ x: 16, y: this.app.safeTop + 14, w: 68, h: 34 }, "\u8fd4\u56de", () => this.app.sceneManager.replace("home"), { fill: "#1b2933", stroke: "#344a56", fontSize: 14 }),
      new Button({ x: this.app.width - 92, y: this.app.safeTop + 14, w: 76, h: 34 }, "\u5237\u65b0", () => this.load(), { fill: "#153830", stroke: "#35e6d0", fontSize: 14 })
    ];
    this.load();
  }

  async load() {
    if (this.loading) return;
    this.loading = true;
    this.errorText = "";
    try {
      const localItems = localRecords();
      this.items = localItems;
      const res = await cloud.listMatches();
      this.items = mergeRecords((res && res.items) || [], localItems);
    } catch (err) {
      this.errorText = localRecords().length ? "\u4e91\u7aef\u540c\u6b65\u5931\u8d25\uff0c\u5df2\u663e\u793a\u672c\u5730\u8bb0\u5f55" : (err.message || "\u8bfb\u53d6\u5931\u8d25");
      this.items = localRecords();
    } finally {
      this.loading = false;
    }
  }

  render(ctx) {
    this.renderBackground(ctx);
    this.drawTitle(ctx, "\u5bf9\u6218\u8bb0\u5f55", this.app.isLoggedIn() ? "\u767b\u5f55\u540e\u81ea\u52a8\u4fdd\u5b58\u4e91\u7aef\u6218\u7ee9" : "\u8bf7\u5148\u767b\u5f55");
    this.drawList(ctx);
    this.drawButtons(ctx);
  }

  drawList(ctx) {
    const top = this.app.safeTop + 96;
    const bottom = this.app.height - 20;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, this.app.width, bottom - top);
    ctx.clip();

    if (this.loading) {
      this.drawEmpty(ctx, "\u6b63\u5728\u8bfb\u53d6\u8bb0\u5f55...", top + 90);
      ctx.restore();
      return;
    }
    if (!this.items.length) {
      this.drawEmpty(ctx, this.errorText || "\u8fd8\u6ca1\u6709\u5bf9\u6218\u8bb0\u5f55", top + 90);
      ctx.restore();
      return;
    }
    if (this.errorText) this.drawSyncHint(ctx, this.errorText, top + 16);

    this.items.forEach((item, i) => {
      const y = top + i * 106 - this.scrollY;
      if (y < top - 116 || y > bottom) return;
      this.drawRecord(ctx, item, 16, y, this.app.width - 32, 92);
    });
    ctx.restore();
  }

  drawRecord(ctx, item, x, y, w, h) {
    const winner = item.winnerTeam ? `${item.winnerTeam} \u961f\u80dc\u5229` : "\u5e73\u5c40";
    const type = item.matchType === "friend" ? "\u597d\u53cb\u5bf9\u6218" : "\u672c\u5730\u5bf9\u6218";
    const balls = (item.balls || []).map((b) => `${b.slotId || b.teamId} ${b.name || b.ballId || ""}`).slice(0, 4).join("  ");
    const timeText = formatTime(item.createdAt);
    ctx.save();
    ctx.fillStyle = "rgba(10,22,28,0.92)";
    ctx.strokeStyle = item.winnerTeam === "A" ? "#19c2b1" : item.winnerTeam === "B" ? "#ff5f7d" : "#f3d45c";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(winner, x + 14, y + 24);
    ctx.fillStyle = "#9eb3bf";
    ctx.font = "800 12px sans-serif";
    ctx.fillText(`${type} / ${modeLabel(item.mode)} / ${MAP_LABELS[item.map] || item.map || "-"} / ${Number(item.duration || 0).toFixed(1)}s`, x + 14, y + 48);
    ctx.fillText(balls || "\u672a\u8bb0\u5f55\u5c0f\u7403", x + 14, y + 70);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(216,255,249,0.7)";
    ctx.fillText(timeText, x + w - 14, y + 24);
    ctx.restore();
  }

  drawEmpty(ctx, text, y) {
    ctx.save();
    ctx.fillStyle = "rgba(216,255,249,0.74)";
    ctx.font = "800 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, this.app.width / 2, y);
    ctx.restore();
  }

  drawSyncHint(ctx, text, y) {
    ctx.save();
    ctx.fillStyle = "rgba(255,216,107,0.82)";
    ctx.font = "700 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, this.app.width / 2, y);
    ctx.restore();
  }

  onTouchStart(e) {
    this.startY = e.y;
    this.startScrollY = this.scrollY;
  }

  onTouchMove(e) {
    const top = this.app.safeTop + 96;
    const max = Math.max(0, this.items.length * 106 - (this.app.height - top - 20));
    this.scrollY = clamp(this.startScrollY - (e.y - this.startY), 0, max);
  }

  onTouchEnd(e) {
    const button = this.buttons.find((b) => b.hitTest(e.x, e.y));
    if (button) button.tap();
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function modeLabel(mode) {
  const labels = { "1v1": "1v1", "1v2": "1v2", "1v3": "1v3", "2v2": "2v2", "1v1v1": "1v1v1" };
  return labels[mode] || mode || "\u5bf9\u6218";
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

function localRecords() {
  const items = storage.get("ball_duel_match_records", []);
  return Array.isArray(items) ? items : [];
}

function mergeRecords(remote, local) {
  const out = [];
  const seen = {};
  (remote || []).concat(local || []).forEach((item) => {
    const key = [item.createdAt || 0, item.seed || "", item.duration || "", item.winnerTeam || ""].join("_");
    if (seen[key]) return;
    seen[key] = true;
    out.push(item);
  });
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 50);
}

module.exports = RecordsScene;
