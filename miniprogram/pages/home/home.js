const cloud = require("../../services/cloud");

Page({
  data: { user: null, guideOpen: false },
  onShow() {
    this.setData({ user: getApp().globalData.user });
    const roomId = getApp().globalData.pendingRoom;
    if (roomId) {
      getApp().globalData.pendingRoom = null;
      wx.navigateTo({ url: `/pages/room/room?roomId=${roomId}` });
    }
  },
  startFree() {
    wx.navigateTo({ url: "/pages/setup/setup?mode=free" });
  },
  showcase() {
    wx.navigateTo({ url: "/pages/showcase/showcase" });
  },
  showGuide() {
    this.setData({ guideOpen: true });
  },
  hideGuide() {
    this.setData({ guideOpen: false });
  },
  noop() {},
  async login() {
    try {
      const user = await cloud.login();
      getApp().globalData.user = user;
      this.setData({ user });
    } catch (err) {
      wx.showToast({ title: "登录失败", icon: "none" });
    }
  },
  friendRoom() {
    if (!getApp().globalData.user) {
      wx.showToast({ title: "好友挑战需要登录", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/setup/setup?mode=room" });
  },
  history() {
    if (!getApp().globalData.user) {
      wx.showToast({ title: "登录后查看历史", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/history/history" });
  }
});
