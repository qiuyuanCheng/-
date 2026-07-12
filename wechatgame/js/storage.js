function get(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value === "" || value === undefined ? fallback : value;
  } catch (err) {
    return fallback;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (err) {}
}

function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (err) {}
}

module.exports = { get, set, remove };
