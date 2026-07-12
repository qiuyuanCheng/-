const SceneManager = require("./scene_manager");
const InputManager = require("./input_manager");
const AssetLoader = require("./asset_loader");
const { AudioManager } = require("./core/audio_manager");
const HomeScene = require("./scenes/home_scene");
const ModeScene = require("./scenes/mode_scene");
const SetupScene = require("./scenes/setup_scene");
const PlaceScene = require("./scenes/place_scene");
const BattleScene = require("./scenes/battle_scene");
const ResultScene = require("./scenes/result_scene");
const ShowcaseScene = require("./scenes/showcase_scene");
const RoomScene = require("./scenes/room_scene");
const RecordsScene = require("./scenes/records_scene");
const cloud = require("./services/cloud_service");
const storage = require("./storage");

class GameApp {
  init() {
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext("2d");
    this.system = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    this.dpr = this.system.pixelRatio || 1;
    this.width = this.system.windowWidth || this.canvas.width || 375;
    this.height = this.system.windowHeight || this.canvas.height || 667;
    this.safeTop = (this.system.safeArea && this.system.safeArea.top) || 0;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);

    this.assets = new AssetLoader(this.canvas);
    this.audio = new AudioManager();
    this.audioEnabled = true;
    this.lastMatch = null;
    this.lastResult = null;
    this.pendingRoom = null;
    this.user = storage.get("ball_duel_user", null);
    this.loginBusy = false;

    if (wx.cloud) {
      try { wx.cloud.init({ env: "cloud1-d2g68hihz3775df3f", traceUser: false }); } catch (err) {}
    }
    if (wx.showShareMenu) {
      try { wx.showShareMenu({ withShareTicket: false }); } catch (err) {}
    }

    this.sceneManager = new SceneManager(this);
    this.sceneManager.register("home", (app) => new HomeScene(app));
    this.sceneManager.register("mode", (app) => new ModeScene(app));
    this.sceneManager.register("setup", (app) => new SetupScene(app));
    this.sceneManager.register("place", (app) => new PlaceScene(app));
    this.sceneManager.register("battle", (app) => new BattleScene(app));
    this.sceneManager.register("result", (app) => new ResultScene(app));
    this.sceneManager.register("showcase", (app) => new ShowcaseScene(app));
    this.sceneManager.register("room", (app) => new RoomScene(app));
    this.sceneManager.register("records", (app) => new RecordsScene(app));

    this.input = new InputManager(this);
    this.input.bind();
    this.sceneManager.replace("home");
    this.bindLifecycle();
  }

  bindLifecycle() {
    if (wx.onShow) wx.onShow((options) => {
      this.pausedBySystem = false;
      this.captureRoom(options);
    });
    if (wx.onHide) wx.onHide(() => {
      this.pausedBySystem = true;
    });
    try {
      const launch = wx.getLaunchOptionsSync && wx.getLaunchOptionsSync();
      this.captureRoom(launch);
    } catch (err) {}
  }

  captureRoom(options) {
    const roomId = options && options.query && options.query.roomId;
    if (!roomId) return;
    this.pendingRoom = roomId;
    const current = this.sceneManager && this.sceneManager.current && this.sceneManager.current();
    if (this.sceneManager && (!current || current.name !== "battle")) {
      this.openLoginFeature("room", { roomId });
    }
  }

  start() {
    this.lastFrameAt = Date.now();
    const raf = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 16);
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameAt) / 1000));
      this.lastFrameAt = now;
      if (!this.pausedBySystem) this.tick(dt);
      this.rafId = raf(loop);
    };
    this.rafId = raf(loop);
  }

  tick(dt) {
    const scene = this.sceneManager.current();
    if (scene && scene.update) scene.update(dt);
    if (scene && scene.render) scene.render(this.ctx);
  }

  setAudioEnabled(enabled) {
    this.audioEnabled = !!enabled;
    if (this.audio) this.audio.setEnabled(this.audioEnabled);
    if (this.audioEnabled && this.audio && this.audio.unlock) this.audio.unlock();
  }

  isLoggedIn() {
    return !!(this.user && this.user.openid);
  }

  async login() {
    if (this.loginBusy) return this.user;
    this.loginBusy = true;
    try {
      if (wx.showLoading) wx.showLoading({ title: "登录中" });
      const user = await cloud.login();
      this.user = user || null;
      if (this.user) storage.set("ball_duel_user", this.user);
      if (wx.showToast) wx.showToast({ title: "登录成功", icon: "success" });
      return this.user;
    } catch (err) {
      if (wx.showToast) wx.showToast({ title: err.message || "登录失败", icon: "none" });
      return null;
    } finally {
      this.loginBusy = false;
      if (wx.hideLoading) wx.hideLoading();
    }
  }

  async ensureLogin() {
    if (this.isLoggedIn()) return true;
    const user = await this.login();
    return !!(user && user.openid);
  }

  async openLoginFeature(sceneName, params) {
    const ok = await this.ensureLogin();
    if (ok) this.sceneManager.replace(sceneName, params || {});
  }
}

module.exports = GameApp;
