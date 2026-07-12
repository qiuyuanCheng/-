const { BALLS, MAPS, MODES } = require("../../core/configs_v2");
const { createDefaultMatch } = require("../../core/simulation_v2");
const cloud = require("../../services/cloud");

const modeIds = Object.keys(MODES);
const mapIds = Object.keys(MAPS);

Page({
  data: {
    mode: "free",
    roomId: "",
    role: "",
    modeIndex: 0,
    mapIndex: 1,
    currentModeName: MODES[modeIds[0]].name,
    currentMapName: MAPS[mapIds[1]].name,
    modeNames: modeIds.map((id) => MODES[id].name),
    mapNames: mapIds.map((id) => MAPS[id].name),
    ballCards: BALLS.map((b) => Object.assign({}, b, guideForBall(b))),
    slots: [],
    title: "对战设置",
    startText: "进入地图布置"
  },

  onLoad(query) {
    this.room = null;
    this.setData({
      mode: query.mode || "free",
      roomId: query.roomId || "",
      role: query.role || ""
    });
    if (query.mode === "roomSelect" && query.roomId) {
      this.loadRoomSelection(query.roomId);
      return;
    }
    this.rebuildSlots();
  },

  async loadRoomSelection(roomId) {
    try {
      const room = await cloud.getRoom(roomId);
      this.room = room;
      const role = room.role;
      const editableTeams = role === "owner" ? ["A"] : role === "guest" ? ["B", "C"] : [];
      const slots = (room.match.slots || []).filter((slot) => editableTeams.includes(slot.teamId)).map((slot) => {
        const fallback = BALLS[0];
        const cfg = BALLS.find((b) => b.id === slot.ballId) || fallback;
        const ballIndex = BALLS.findIndex((b) => b.id === cfg.id);
        return Object.assign({}, slot, { ballId: cfg.id, ballIndex, ballName: cfg.name, ballGuide: guideForBall(cfg) });
      });
      this.setData({
        role,
        modeIndex: Math.max(0, modeIds.indexOf(room.match.mode)),
        mapIndex: Math.max(0, mapIds.indexOf(room.match.map)),
        currentModeName: MODES[room.match.mode].name,
        currentMapName: MAPS[room.match.map].name,
        slots,
        title: role === "owner" ? "选择 A 队小球" : "选择 B 队小球",
        startText: "确认选球"
      });
    } catch (err) {
      wx.showToast({ title: err.message || "读取房间失败", icon: "none" });
    }
  },

  editableTeamsForMode() {
    if (this.data.mode === "room") return ["A"];
    if (this.data.mode === "roomSelect") return this.data.role === "owner" ? ["A"] : ["B", "C"];
    return null;
  },

  rebuildSlots() {
    const match = createDefaultMatch(modeIds[this.data.modeIndex]);
    match.map = mapIds[this.data.mapIndex];
    const editableTeams = this.editableTeamsForMode();
    const slots = match.slots.filter((slot) => !editableTeams || editableTeams.includes(slot.teamId)).map((slot) => {
      const ballIndex = BALLS.findIndex((b) => b.id === slot.ballId);
      return Object.assign({}, slot, { ballIndex, ballName: BALLS[ballIndex].name, ballGuide: guideForBall(BALLS[ballIndex]) });
    });
    this.setData({
      slots,
      currentModeName: this.data.modeNames[this.data.modeIndex],
      currentMapName: this.data.mapNames[this.data.mapIndex],
      title: this.data.mode === "room" ? "联机暗选小球" : "对战设置",
      startText: this.data.mode === "room" ? "创建房间" : "进入地图布置"
    });
  },

  changeMode(e) {
    this.setData({ modeIndex: Number(e.detail.value) });
    this.rebuildSlots();
  },

  changeMap(e) {
    const mapIndex = Number(e.detail.value);
    this.setData({ mapIndex, currentMapName: this.data.mapNames[mapIndex] });
  },

  changeBall(e) {
    const slots = this.data.slots.slice();
    const i = Number(e.currentTarget.dataset.slot);
    slots[i].ballIndex = Number(e.detail.value);
    slots[i].ballId = BALLS[slots[i].ballIndex].id;
    slots[i].ballName = BALLS[slots[i].ballIndex].name;
    slots[i].ballGuide = guideForBall(BALLS[slots[i].ballIndex]);
    this.setData({ slots });
  },
  chooseBall(e) {
    const slotIndex = Number(e.currentTarget.dataset.slot);
    const ballIndex = Number(e.currentTarget.dataset.ball);
    const slots = this.data.slots.slice();
    slots[slotIndex].ballIndex = ballIndex;
    slots[slotIndex].ballId = BALLS[ballIndex].id;
    slots[slotIndex].ballName = BALLS[ballIndex].name;
    slots[slotIndex].ballGuide = guideForBall(BALLS[ballIndex]);
    this.setData({ slots });
  },

  buildMatch() {
    const modeId = modeIds[this.data.modeIndex];
    const match = createDefaultMatch(modeId);
    match.map = mapIds[this.data.mapIndex];
    match.seed = Date.now() % 1000000000;
    match.slots = match.slots.map((slot) => {
      const selected = this.data.slots.find((s) => s.slotId === slot.slotId);
      return {
        slotId: slot.slotId,
        teamId: slot.teamId,
        ballId: selected ? selected.ballId : null,
        spawn: null,
        initialAngleDeg: 0,
        initialVelocity: null
      };
    });
    return match;
  },

  async start() {
    if (this.data.mode === "roomSelect") {
      await this.submitRoomSelection();
      return;
    }
    const match = this.buildMatch();
    if (this.data.mode === "room") {
      try {
        const room = await cloud.createRoom({ match });
        wx.navigateTo({ url: `/pages/room/room?roomId=${room._id}` });
      } catch (err) {
        wx.showToast({ title: err.message || "创建房间失败", icon: "none" });
      }
      return;
    }
    getApp().globalData.pendingPlacement = { config: match, mode: this.data.mode };
    wx.navigateTo({ url: `/pages/place/place?mode=${this.data.mode}` });
  },

  async submitRoomSelection() {
    try {
      const room = await cloud.updateRoom(this.data.roomId, {
        selectionSlots: this.data.slots.map((s) => ({ slotId: s.slotId, ballId: s.ballId }))
      });
      getApp().globalData.pendingRoomSnapshot = room;
      wx.navigateBack();
    } catch (err) {
      wx.showToast({ title: err.message || "保存选球失败", icon: "none" });
    }
  }
});

function guideForBall(ball) {
  const guides = {
    spike: ["地图封锁", "适合新手", "墙边刺钉能压缩走位", "需要撞墙启动，空旷时慢热"],
    sword: ["近战爆发", "适合新手", "旋转大剑直观好懂", "怕远程消耗"],
    bow: ["远程穿射", "进阶", "箭矢长、射程远", "需要角度和距离"],
    thread: ["路线控制", "进阶", "毒线能切割路径", "依赖墙体轨迹"],
    lance: ["冲锋推进", "进阶", "粘住后能推墙持续伤害", "方向没对准会空转"],
    hammer: ["重击击飞", "高风险", "命中后击飞很强", "攻速慢、容易挥空"],
    saw: ["贴身研磨", "适合新手", "近身持续压制", "需要贴住目标"],
    flame: ["区域压制", "进阶", "火痕能长期占场", "需要频繁撞墙"],
    frost: ["远程控制", "适合新手", "冰矛命中带减速", "发射间隔较长"],
    arc: ["麻痹控制", "适合新手", "接触能麻痹并停转武器", "需要主动贴脸"],
    cannon: ["爆炸炮击", "进阶", "炮弹范围伤害高", "弹道较慢"],
    dagger: ["弹射飞刃", "进阶", "墙面反弹制造角度", "需要空间判断"],
    mine: ["陷阱布控", "进阶", "雷盘稳定占点", "启动和触发有延迟"],
    shield: ["防守反切", "适合新手", "盾牌能挡投射物", "机动压制较弱"],
    drill: ["贴脸钻压", "高风险", "钻尖爆发高", "贴不上会亏输出"],
    boomerang: ["往返切割", "进阶", "去返两段都有威胁", "命中稳定性依赖距离"],
    laser: ["预警激光", "进阶", "直线爆发强", "预警会给对手反应"],
    venom: ["腐蚀消耗", "进阶", "毒点持续伤害", "爆发较低"],
    star: ["环绕防区", "适合新手", "星镖覆盖稳定", "怕被远程拉开"],
    shrapnel: ["撞墙散射", "高风险", "碎片覆盖广", "非常依赖墙面节奏"],
    harpoon: ["牵制钩索", "进阶", "鱼叉能拉扯目标", "单发失误窗口大"],
    prism: ["分区切割", "高风险", "棱镜区控上限高", "机制复杂、需要墙点"],
    pulse: ["力场控场", "适合新手", "脉冲区留场压制", "直接爆发一般"],
    anchor: ["横向近战", "高风险", "双侧锚刃覆盖宽", "贴身命中难度高"]
  };
  const g = guides[ball.visual.icon] || ["自动攻击", "适合新手", "机制稳定", "缺少特殊爆发"];
  return { roleTag: g[0], skillTag: g[1], attackBrief: ball.visual.visualBrief, strength: g[2], weakness: g[3] };
}
