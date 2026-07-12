const BaseScene = require("./base_scene");
const { Button, roundRect } = require("../ui/button");

class HomeScene extends BaseScene {
  enter() {
    this.t = 0;
    this.layoutButtons();
  }

  update(dt) {
    this.t += dt || 0.016;
  }

  layoutButtons() {
    const w = this.app.width;
    const h = this.app.height;
    const bw = Math.min(270, w - 64);
    const previewSize = Math.min(w - 78, 285);
    const previewCenterY = Math.min(h * 0.43, this.app.safeTop + 312);
    const previewBottom = previewCenterY + previewSize / 2;
    const y = Math.min(h - 272, Math.max(this.app.safeTop + 392, h * 0.58, previewBottom + 24));
    this.buttons = [
      new Button({ x: (w - bw) / 2, y, w: bw, h: 52 }, "\u5f00\u59cb\u5bf9\u6218", () => this.app.sceneManager.replace("mode"), { fontSize: 18, fill: "#138473", stroke: "#35e6d0", radius: 10 }),
      new Button({ x: (w - bw) / 2, y: y + 62, w: bw, h: 46 }, "\u597d\u53cb\u623f\u95f4", () => this.app.openLoginFeature("mode", { roomFlow: true }), { fill: "#153830", stroke: "#35e6d0", radius: 10 }),
      new Button({ x: (w - bw) / 2, y: y + 118, w: bw, h: 46 }, "\u5bf9\u6218\u8bb0\u5f55", () => this.app.openLoginFeature("records"), { fill: "#16313d", stroke: "#4e8fa3", radius: 10 }),
      new Button({ x: (w - bw) / 2, y: y + 174, w: bw, h: 46 }, "\u5c0f\u7403\u56fe\u9274", () => this.app.sceneManager.replace("showcase"), { fill: "#152f38", stroke: "#4e8fa3", radius: 10 }),
      new Button({ x: 18, y: this.app.safeTop + 18, w: 86, h: 34 }, this.app.isLoggedIn() ? "\u5df2\u767b\u5f55" : "\u767b\u5f55", () => this.app.login(), { fill: this.app.isLoggedIn() ? "#153830" : "#1b2933", stroke: "#35e6d0", fontSize: 14, radius: 8 })
    ];
  }

  render(ctx) {
    this.layoutButtons();
    this.drawCover(ctx);
    this.drawButtons(ctx);
  }

  drawCover(ctx) {
    const w = this.app.width;
    const h = this.app.height;
    const top = this.app.safeTop;
    const t = this.t || 0;
    ctx.save();
    ctx.fillStyle = "#020708";
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w * 0.5, h * 0.34, 16, w * 0.5, h * 0.34, h * 0.62);
    glow.addColorStop(0, "rgba(39, 224, 205, 0.22)");
    glow.addColorStop(0.42, "rgba(7, 52, 55, 0.38)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    this.drawArenaPreview(ctx, w, h, top, t);
    this.drawLogo(ctx, w, top);
    this.drawTagline(ctx, w, h);
    this.drawFooter(ctx, w, h);
    ctx.restore();
  }

  drawLogo(ctx, w, top) {
    const y = top + 86;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(30, 255, 230, 0.75)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 38px sans-serif";
    ctx.fillText("\u7403\u7403\u4e71\u6597", w / 2, y);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawArenaPreview(ctx, w, h, top, t) {
    const cx = w / 2;
    const cy = Math.min(h * 0.43, top + 312);
    const size = Math.min(w - 78, 285);
    const x = cx - size / 2;
    const y = cy - size / 2;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(210, 252, 255, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const p = i / 5;
      ctx.beginPath();
      ctx.moveTo(x + size * p, y);
      ctx.lineTo(x + size * p, y + size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + size * p);
      ctx.lineTo(x + size, y + size * p);
      ctx.stroke();
    }
    ctx.shadowColor = "#eaffff";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "rgba(238, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, size, size, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const a = t * 1.1;
    const p1 = { x: cx + Math.cos(a) * size * 0.26, y: cy + Math.sin(a * 0.9) * size * 0.19 };
    const p2 = { x: cx + Math.cos(a + Math.PI) * size * 0.28, y: cy + Math.sin(a * 0.85 + Math.PI) * size * 0.22 };
    this.drawWeaponBall(ctx, p1.x, p1.y, 28, "#1cb6ff", "#19c2b1", a, "sword");
    this.drawWeaponBall(ctx, p2.x, p2.y, 30, "#ff4f6d", "#ff5f7d", -a * 1.25, "saw");
    this.drawClash(ctx, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2, t);
    ctx.restore();
  }

  drawWeaponBall(ctx, x, y, r, color, teamColor, angle, type) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    if (type === "sword") {
      const grad = ctx.createLinearGradient(r * 0.2, -r * 0.55, r * 2.9, r * 0.55);
      grad.addColorStop(0, "#1a4a6a");
      grad.addColorStop(0.35, "#f6fbff");
      grad.addColorStop(0.7, "#6fd1ff");
      grad.addColorStop(1, "#12375e");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(r * 2.9, 0);
      ctx.lineTo(r * 0.55, -r * 0.48);
      ctx.lineTo(r * 0.2, 0);
      ctx.lineTo(r * 0.55, r * 0.48);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = "#e8fbff";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ff86a0";
      ctx.lineWidth = 3;
      for (let i = 0; i < 14; i++) {
        const a = i * Math.PI * 2 / 14;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45);
        ctx.lineTo(Math.cos(a) * r * 1.92, Math.sin(a) * r * 1.92);
        ctx.stroke();
      }
    }
    ctx.rotate(-angle);
    const body = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.32, color);
    body.addColorStop(1, "#071015");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  drawClash(ctx, x, y, t) {
    const pulse = 0.5 + Math.sin(t * 5) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.55 + pulse * 0.25;
    ctx.strokeStyle = "#fff7bf";
    ctx.fillStyle = "#fff7bf";
    ctx.shadowColor = "#ffd86b";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7 + t;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
      ctx.lineTo(x + Math.cos(a) * (26 + pulse * 8), y + Math.sin(a) * (26 + pulse * 8));
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTagline(ctx, w, h) {
    const previewSize = Math.min(w - 78, 285);
    const previewCenterY = Math.min(h * 0.43, this.app.safeTop + 312);
    const y = previewCenterY - previewSize / 2 - 28;
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#d9fffb";
    ctx.font = "900 16px sans-serif";
    ctx.fillText("\u9009\u62e9\u6b66\u5668\uff0c\u5e03\u9635\u51fa\u51fb", w / 2, y);
    ctx.restore();
  }

  drawFooter(ctx, w, h) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(216, 255, 249, 0.55)";
    ctx.font = "700 11px sans-serif";
    ctx.fillText("\u51c6\u5907\u5f00\u6218", w / 2, h - 28);
    ctx.restore();
  }
}

module.exports = HomeScene;
