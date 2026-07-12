const BaseScene = require("./base_scene");
const { Button } = require("../ui/button");
const { MODES } = require("../core/configs_v2");

const MODE_IDS = ["ONE_VS_ONE", "ONE_VS_TWO", "ONE_VS_THREE", "TWO_VS_TWO", "FFA_THREE"];

class ModeScene extends BaseScene {
  enter(params) {
    this.roomFlow = !!(params && params.roomFlow);
    this.layoutButtons();
  }

  layoutButtons() {
    const w = this.app.width;
    const bw = Math.min(268, w - 64);
    const startY = this.app.safeTop + 178;
    this.buttons = MODE_IDS.map((id, i) => new Button(
      { x: (w - bw) / 2, y: startY + i * 58, w: bw, h: 46 },
      MODES[id].name,
      () => this.app.sceneManager.replace("setup", this.roomFlow ? { modeId: id, roomMode: "create" } : { modeId: id }),
      { fill: i === 0 ? "#138473" : "#152f38", stroke: i === 0 ? "#35e6d0" : "#4e8fa3", radius: 10 }
    ));
    this.buttons.push(new Button({ x: 18, y: this.app.safeTop + 16, w: 72, h: 36 }, "\u8fd4\u56de", () => this.app.sceneManager.replace("home"), { fill: "#1b2933", stroke: "#344a56" }));
  }

  render(ctx) {
    this.layoutButtons();
    this.renderBackground(ctx);
    this.drawModeTitle(ctx);
    this.drawButtons(ctx);
  }

  drawModeTitle(ctx) {
    const y = this.app.safeTop + 92;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(25,194,177,0.55)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 30px sans-serif";
    ctx.fillText(this.roomFlow ? "\u597d\u53cb\u623f\u95f4" : "\u9009\u62e9\u6a21\u5f0f", this.app.width / 2, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#9eb3bf";
    ctx.font = "700 13px sans-serif";
    ctx.fillText(this.roomFlow ? "\u9009\u62e9\u9635\u5bb9\u89c4\u6a21\uff0c\u521b\u5efa\u623f\u95f4\u9080\u8bf7\u597d\u53cb" : "\u9009\u597d\u9635\u5bb9\uff0c\u8fdb\u5165\u5e03\u9635", this.app.width / 2, y + 34);
    ctx.restore();
  }
}

module.exports = ModeScene;
