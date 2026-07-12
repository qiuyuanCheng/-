class Button {
  constructor(rect, text, onTap, options) {
    this.rect = rect;
    this.text = text;
    this.onTap = onTap;
    this.options = options || {};
  }

  hitTest(x, y) {
    const r = this.rect;
    const pad = this.options.hitPad || 8;
    return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
  }

  tap() {
    if (this.onTap) this.onTap();
  }

  draw(ctx) {
    const r = this.rect;
    ctx.save();
    ctx.fillStyle = this.options.fill || "#153830";
    ctx.strokeStyle = this.options.stroke || "#1e776b";
    ctx.lineWidth = 1;
    roundRect(ctx, r.x, r.y, r.w, r.h, this.options.radius || 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.options.color || "#d8fff9";
    ctx.font = `800 ${this.options.fontSize || 16}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, r.x + r.w / 2, r.y + r.h / 2);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

module.exports = { Button, roundRect };
