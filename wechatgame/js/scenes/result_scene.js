const BaseScene = require("./base_scene");
const { Button, roundRect } = require("../ui/button");
const { buildSummary, buildRows } = require("../core/result_report");

class ResultScene extends BaseScene {
  enter(params) {
    this.result = params.result || this.app.lastResult || {};
    this.match = params.match || this.app.lastMatch;
    this.summary = buildSummary(this.result);
    this.rows = buildRows(this.result);
    const y = this.app.height - 116;
    this.buttons = [
      new Button({ x: 24, y, w: (this.app.width - 60) / 2, h: 46 }, "\u518d\u6765\u4e00\u5c40", () => this.app.sceneManager.replace("place", { match: this.match })),
      new Button({ x: 36 + (this.app.width - 60) / 2, y, w: (this.app.width - 60) / 2, h: 46 }, "\u8fd4\u56de\u9996\u9875", () => this.app.sceneManager.replace("home"), { fill: "#1b2933", stroke: "#344a56" })
    ];
  }

  render(ctx) {
    this.renderBackground(ctx);
    this.drawTitle(ctx, this.summary.winner, "\u6218\u6597\u62a5\u544a");
    this.drawReport(ctx);
    this.drawButtons(ctx);
  }

  drawReport(ctx) {
    const x = 18;
    let y = this.app.safeTop + 104;
    const w = this.app.width - 36;
    ctx.save();
    ctx.fillStyle = "rgba(10,22,28,0.92)";
    ctx.strokeStyle = "rgba(255,216,107,0.42)";
    roundRect(ctx, x, y, w, 82, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd86b";
    ctx.font = "900 20px sans-serif";
    ctx.fillText(`MVP ${this.summary.mvpName}`, x + 14, y + 30);
    ctx.fillStyle = "#d8fff9";
    ctx.font = "800 13px sans-serif";
    ctx.fillText(`\u4e2a\u4eba\u8f93\u51fa ${this.summary.mvpDamage} \u00b7 \u547d\u4e2d ${this.summary.mvpHits} \u00b7 \u6700\u9ad8\u5355\u6b21 ${this.summary.mvpHighestSingle || "-"}`, x + 14, y + 58);
    y += 96;

    const lines = [
      `\u65f6\u957f ${this.summary.duration}s \u00b7 \u5730\u56fe ${this.summary.mapLabel} \u00b7 \u80dc\u65b9\u5269\u4f59 HP ${this.summary.winnerHp}`,
      this.summary.finalHitText
    ];
    if (this.summary.loserBestName) lines.push(`\u8d25\u65b9\u6700\u4f73\uff1a${this.summary.loserBestName} \u8f93\u51fa ${this.summary.loserBestDamage}`);
    ctx.fillStyle = "rgba(10,22,28,0.72)";
    ctx.strokeStyle = "rgba(148,190,204,0.28)";
    roundRect(ctx, x, y, w, 28 + lines.length * 22, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9eb3bf";
    ctx.font = "700 12px sans-serif";
    lines.forEach((line, i) => ctx.fillText(line, x + 14, y + 24 + i * 22));
    y += 42 + lines.length * 22;

    this.rows.slice(0, 5).forEach((row) => {
      ctx.fillStyle = "rgba(10,22,28,0.82)";
      ctx.strokeStyle = row.teamId === "A" ? "#19c2b1" : row.teamId === "B" ? "#ff5f7d" : "#f3d45c";
      roundRect(ctx, x, y, w, 58, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 13px sans-serif";
      ctx.fillText(`${row.slotId} ${row.name}`, x + 12, y + 22);
      ctx.fillStyle = "#9eb3bf";
      ctx.font = "700 12px sans-serif";
      ctx.fillText(`HP ${row.hp} \u00b7 \u8f93\u51fa ${row.damageDone} \u00b7 \u627f\u4f24 ${row.damageTaken} \u00b7 ${row.mainDamageSource}`, x + 12, y + 44);
      y += 66;
    });
    ctx.restore();
  }
}

module.exports = ResultScene;
