const BaseScene = require("./base_scene");
const { Button, roundRect } = require("../ui/button");
const { BALLS } = require("../core/configs_v2");
const { buildGuideEntry } = require("../core/ball_guide");

class ShowcaseScene extends BaseScene {
  enter() {
    this.entries = BALLS.map((ball) => Object.assign({}, ball, buildGuideEntry(ball)));
    this.scrollY = 0;
    this.startY = 0;
    this.startScrollY = 0;
    this.detail = null;
    this.buttons = [
      new Button({ x: 16, y: this.app.safeTop + 14, w: 68, h: 34 }, "返回", () => this.app.sceneManager.replace("home"), { fill: "#1b2933", stroke: "#344a56" })
    ];
  }

  render(ctx) {
    this.renderBackground(ctx);
    this.drawTitle(ctx, "小球图鉴", "24 个小球 · 点击卡片查看详情和试听音效");
    this.drawList(ctx);
    if (this.detail) this.drawDetail(ctx);
    this.drawButtons(ctx);
  }

  drawList(ctx) {
    const top = this.app.safeTop + 94;
    const bottom = this.app.height - 16;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, this.app.width, bottom - top);
    ctx.clip();
    this.entries.forEach((ball, i) => {
      const y = top + i * 92 - this.scrollY;
      if (y < top - 100 || y > bottom) return;
      ctx.fillStyle = "rgba(10,22,28,0.9)";
      ctx.strokeStyle = "rgba(148,190,204,0.28)";
      roundRect(ctx, 16, y, this.app.width - 32, 78, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.arc(48, y + 39, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d8fff9";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 16px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(ball.name, 84, y + 24);
      ctx.fillStyle = "#19c2b1";
      ctx.font = "800 12px sans-serif";
      ctx.fillText(ball.playStyleLabel, 84, y + 44);
      ctx.fillStyle = "#9eb3bf";
      ctx.fillText(ball.damageLabel.slice(0, 28), 84, y + 64);
    });
    ctx.restore();
  }

  drawDetail(ctx) {
    const ball = this.detail;
    const x = 18;
    const y = this.app.safeTop + 82;
    const w = this.app.width - 36;
    const h = this.app.height - y - 24;
    ctx.save();
    ctx.fillStyle = "rgba(3,6,7,0.92)";
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    ctx.fillStyle = "rgba(10,22,28,0.98)";
    ctx.strokeStyle = ball.color;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(x + 42, y + 46, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 22px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(ball.name, x + 84, y + 38);
    ctx.fillStyle = "#d8fff9";
    ctx.font = "800 13px sans-serif";
    ctx.fillText(ball.hpLabel, x + 84, y + 62);
    const lines = wrapLines(ctx, [
      ball.playStyleLabel,
      ball.strengthLabel,
      ball.weaknessLabel,
      ball.attackLabel,
      ball.damageLabel,
      ball.critLabel
    ].filter(Boolean), w - 32, 13);
    ctx.fillStyle = "#9eb3bf";
    ctx.font = "700 13px sans-serif";
    lines.slice(0, 14).forEach((line, i) => ctx.fillText(line, x + 16, y + 104 + i * 21));
    this.detailButtons = [
      new Button({ x: x + 18, y: y + h - 56, w: 120, h: 38 }, "试听音效", () => this.app.audio.play(ball.audio.attackHitEvent, { x: 0, y: 0 }, { sourceId: ball.id, kind: "showcase" })),
      new Button({ x: x + w - 96, y: y + h - 56, w: 78, h: 38 }, "关闭", () => { this.detail = null; }, { fill: "#1b2933", stroke: "#344a56" })
    ];
    this.detailButtons.forEach((button) => button.draw(ctx));
    ctx.restore();
  }

  onTouchStart(e) {
    this.startY = e.y;
    this.startScrollY = this.scrollY;
  }

  onTouchMove(e) {
    if (this.detail) return;
    const top = this.app.safeTop + 94;
    const max = Math.max(0, this.entries.length * 92 - (this.app.height - top - 16));
    this.scrollY = clamp(this.startScrollY - (e.y - this.startY), 0, max);
  }

  onTouchEnd(e) {
    if (this.detail && this.detailButtons) {
      const hit = this.detailButtons.find((b) => b.hitTest(e.x, e.y));
      if (hit) return hit.tap();
      return;
    }
    const button = this.buttons.find((b) => b.hitTest(e.x, e.y));
    if (button) return button.tap();
    const top = this.app.safeTop + 94;
    const idx = Math.floor((e.y - top + this.scrollY) / 92);
    if (idx >= 0 && idx < this.entries.length && Math.abs(e.y - this.startY) < 12) this.detail = this.entries[idx];
  }
}

function wrapLines(ctx, values, width) {
  const out = [];
  values.forEach((value) => {
    let line = "";
    String(value).split("").forEach((ch) => {
      const next = line + ch;
      if (ctx.measureText(next).width > width && line) {
        out.push(line);
        line = ch;
      } else {
        line = next;
      }
    });
    if (line) out.push(line);
  });
  return out;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

module.exports = ShowcaseScene;
