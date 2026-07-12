class InputManager {
  constructor(app) {
    this.app = app;
  }

  bind() {
    wx.onTouchStart((e) => this.forward("onTouchStart", e));
    wx.onTouchMove((e) => this.forward("onTouchMove", e));
    wx.onTouchEnd((e) => this.forward("onTouchEnd", e));
    wx.onTouchCancel((e) => this.forward("onTouchCancel", e));
  }

  forward(method, event) {
    if (method === "onTouchStart" && this.app.audio && this.app.audio.unlock) {
      this.app.audio.unlock();
    }
    const scene = this.app.sceneManager && this.app.sceneManager.current();
    if (!scene || !scene[method]) return;
    const touches = event.changedTouches || event.touches || [];
    const first = touches[0] || {};
    scene[method]({
      x: first.clientX || 0,
      y: first.clientY || 0,
      touches: (event.touches || []).map((t) => ({ x: t.clientX || 0, y: t.clientY || 0 })),
      raw: event
    });
  }
}

module.exports = InputManager;
