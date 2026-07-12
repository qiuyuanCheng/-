const { buildSummary, buildRows } = require("../../core/result_report");

Page({
  data: { result: {}, summary: {}, rows: [] },
  onLoad() {
    const last = getApp().globalData.lastMatch || {};
    const result = last.result || {};
    this.setData({ result, summary: buildSummary(result), rows: buildRows(result) });
  },
  again() {
    wx.redirectTo({ url: "/pages/setup/setup" });
  },
  home() {
    wx.reLaunch({ url: "/pages/home/home" });
  }
});
