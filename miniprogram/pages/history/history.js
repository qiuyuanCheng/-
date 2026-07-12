const cloud = require("../../services/cloud");

Page({
  data: { items: [] },
  async onShow() {
    try {
      const res = await cloud.listMatches();
      const items = (res.items || []).map((item) => Object.assign(item, { createdAtText: new Date(item.createdAt).toLocaleString() }));
      this.setData({ items });
    } catch (err) {
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  }
});
