class BaseScene {
  constructor(app) {
    this.app = app;
    this.buttons = [];
  }

  enter() {}
  leave() {}
  update() {}

  renderBackground(ctx) {
    const { width, height } = this.app;
    ctx.fillStyle = "#030607";
    ctx.fillRect(0, 0, width, height);
    const grad = ctx.createRadialGradient(width * 0.5, height * 0.25, 20, width * 0.5, height * 0.35, height * 0.7);
    grad.addColorStop(0, "rgba(25,194,177,0.16)");
    grad.addColorStop(0.55, "rgba(11,24,28,0.26)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  drawTitle(ctx, title, subtitle) {
    const top = this.app.safeTop + 44;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(25,194,177,0.55)";
    ctx.shadowBlur = 18;
    ctx.fillText(title, this.app.width / 2, top);
    if (subtitle) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#9eb3bf";
      ctx.font = "700 14px sans-serif";
      ctx.fillText(subtitle, this.app.width / 2, top + 36);
    }
    ctx.restore();
  }

  drawButtons(ctx) {
    this.buttons.forEach((button) => button.draw(ctx));
  }

  onTouchEnd(e) {
    const button = this.buttons.find((b) => b.hitTest(e.x, e.y));
    if (button) button.tap();
  }
}

module.exports = BaseScene;
