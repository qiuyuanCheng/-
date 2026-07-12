const cloud = require("../../services/cloud");

Page({
  data: {
    roomId: "",
    room: {},
    roleText: "等待加入",
    statusText: "等待好友进入",
    canSelect: false,
    canPlace: false,
    canReady: false
  },

  onLoad(query) {
    this.setData({ roomId: query.roomId || "" });
    this.refresh();
  },

  onShow() {
    if (this.data.roomId) this.refresh();
  },

  onUnload() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
  },

  onShareAppMessage() {
    return { title: "来球球对决挑战我", path: `/pages/home/home?roomId=${this.data.roomId}` };
  },

  scheduleRefresh() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.refresh(true), 1800);
  },

  async refresh(silent) {
    if (!this.data.roomId) return;
    try {
      const room = await cloud.getRoom(this.data.roomId);
      this.applyRoom(room);
      if (room.status === "ready" || room.status === "playing") {
        this.enterBattle(room);
      } else {
        this.scheduleRefresh();
      }
    } catch (err) {
      if (!silent) wx.showToast({ title: err.message || "房间读取失败", icon: "none" });
    }
  },

  async join() {
    try {
      const room = await cloud.joinRoom(this.data.roomId);
      this.applyRoom(room);
    } catch (err) {
      wx.showToast({ title: err.message || "加入失败", icon: "none" });
    }
  },

  selectBalls() {
    if (!this.data.room || !this.data.room.match) {
      wx.showToast({ title: "请先加入房间", icon: "none" });
      return;
    }
    if (this.data.room.role !== "owner" && this.data.room.role !== "guest") {
      wx.showToast({ title: "请先加入房间", icon: "none" });
      return;
    }
    wx.navigateTo({ url: `/pages/setup/setup?mode=roomSelect&roomId=${this.data.roomId}&role=${this.data.room.role}` });
  },

  configure() {
    const room = this.data.room;
    if (!room || !room.match) {
      wx.showToast({ title: "请先加入房间", icon: "none" });
      return;
    }
    const role = room.role;
    const editableTeams = role === "owner" ? ["A"] : role === "guest" ? ["B", "C"] : [];
    if (!editableTeams.length) {
      wx.showToast({ title: "请先加入房间", icon: "none" });
      return;
    }
    if (!this.mySelectionDone(room)) {
      wx.showToast({ title: "请先选择小球", icon: "none" });
      return;
    }
    if (!room.ownerSelected || !room.guestSelected) {
      wx.showToast({ title: "等待双方完成选球", icon: "none" });
      return;
    }
    getApp().globalData.pendingPlacement = {
      config: room.match,
      mode: "roomUpdate",
      roomId: this.data.roomId,
      editableTeams,
      hideEnemyVelocity: true
    };
    wx.navigateTo({ url: "/pages/place/place?mode=roomUpdate" });
  },

  async ready() {
    try {
      const room = await cloud.updateRoom(this.data.roomId, { ready: true });
      this.applyRoom(room);
      if (room.status === "ready" || room.status === "playing") {
        this.enterBattle(room);
      } else {
        wx.showToast({ title: "等待好友准备", icon: "none" });
      }
    } catch (err) {
      wx.showToast({ title: err.message || "准备失败", icon: "none" });
    }
  },

  mySelectionDone(room) {
    return room.role === "owner" ? !!room.ownerSelected : room.role === "guest" ? !!room.guestSelected : false;
  },

  myPlacementDone(room) {
    return room.role === "owner" ? !!room.ownerPlaced : room.role === "guest" ? !!room.guestPlaced : false;
  },

  applyRoom(room) {
    const role = room.role;
    const ownerSelected = !!room.ownerSelected;
    const guestSelected = !!room.guestSelected;
    const ownerPlaced = !!room.ownerPlaced;
    const guestPlaced = !!room.guestPlaced;
    const mySelected = this.mySelectionDone(room);
    const bothSelected = ownerSelected && guestSelected;
    const myPlaced = this.myPlacementDone(room);
    const bothPlaced = ownerPlaced && guestPlaced;
    this.setData({
      room,
      roleText: role === "owner" ? "A 阵营" : role === "guest" ? "B 阵营" : "请先加入房间",
      statusText: this.statusText(room),
      canSelect: role === "owner" || role === "guest",
      canPlace: mySelected && bothSelected,
      canReady: myPlaced,
      ownerSelected,
      guestSelected,
      ownerPlaced,
      guestPlaced,
      bothSelected,
      bothPlaced
    });
  },

  enterBattle(room) {
    if (this.enteringBattle) return;
    this.enteringBattle = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    getApp().globalData.lastMatch = { config: room.match };
    wx.navigateTo({ url: "/pages/battle/battle" });
  },

  statusText(room) {
    if (room.status === "ready" || room.status === "playing") return "双方已准备，开始战斗";
    if (!room.guestOpenid) return "等待好友加入";
    if (!room.ownerSelected || !room.guestSelected) return "双方暗选小球中";
    if (!room.ownerPlaced || !room.guestPlaced) return "双方布置位置和速度方向中";
    if (!room.ownerReady || !room.guestReady) return "等待双方准备";
    return "房间已就绪";
  }
});
