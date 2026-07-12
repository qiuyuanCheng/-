function createRng(seed) {
  let state = (seed >>> 0) || 1;
  return {
    next() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    },
    range(min, max) {
      return min + (max - min) * this.next();
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    }
  };
}

module.exports = { createRng };
