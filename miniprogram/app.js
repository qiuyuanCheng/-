App({
  globalData: {
    user: null,
    lastMatch: null,
    pendingRoom: null
  },
  onLaunch(options) {
    if (wx.cloud) {
      wx.cloud.init({ traceUser: false });
    }
    this.capturePendingRoom(options);
  },
  onShow(options) {
    this.capturePendingRoom(options);
  },
  capturePendingRoom(options) {
    if (options && options.query && options.query.roomId) this.globalData.pendingRoom = options.query.roomId;
  }
});
