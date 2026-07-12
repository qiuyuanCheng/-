class SceneManager {
  constructor(app) {
    this.app = app;
    this.factories = {};
    this.stack = [];
  }

  register(name, factory) {
    this.factories[name] = factory;
  }

  current() {
    return this.stack[this.stack.length - 1] || null;
  }

  replace(name, params) {
    const old = this.current();
    if (old && old.leave) old.leave();
    this.stack = [this.create(name, params)];
  }

  push(name, params) {
    const old = this.current();
    if (old && old.pause) old.pause();
    this.stack.push(this.create(name, params));
  }

  back(params) {
    const old = this.stack.pop();
    if (old && old.leave) old.leave();
    const scene = this.current();
    if (scene && scene.resume) scene.resume(params);
  }

  create(name, params) {
    const factory = this.factories[name];
    if (!factory) throw new Error(`scene not found: ${name}`);
    const scene = factory(this.app);
    scene.name = name;
    if (scene.enter) scene.enter(params || {});
    return scene;
  }
}

module.exports = SceneManager;
