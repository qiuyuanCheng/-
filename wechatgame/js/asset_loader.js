class AssetLoader {
  constructor(canvas) {
    this.canvas = canvas;
    this.images = {};
  }

  loadImage(key, src) {
    if (!this.canvas || !this.canvas.createImage || !src) return Promise.resolve(null);
    if (this.images[key]) return Promise.resolve(this.images[key]);
    return new Promise((resolve) => {
      const img = this.canvas.createImage();
      img.onload = () => {
        this.images[key] = img;
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = src.replace(/^\//, "");
    });
  }

  get(key) {
    return this.images[key] || null;
  }
}

module.exports = AssetLoader;
