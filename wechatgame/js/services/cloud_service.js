function call(name, data) {
  if (typeof wx === "undefined" || !wx.cloud || !wx.cloud.callFunction) {
    return Promise.reject(new Error("\u5f53\u524d\u73af\u5883\u4e0d\u652f\u6301\u4e91\u5f00\u53d1"));
  }
  return wx.cloud.callFunction({ name, data }).then((res) => {
    if (!res || !res.result) return res && res.result;
    return res.result;
  }).catch((err) => {
    throw new Error(friendlyError(err));
  });
}

function friendlyError(err) {
  const raw = (err && (err.message || err.errMsg)) || String(err || "");
  if (raw.includes("room not found")) return "\u623f\u95f4\u4e0d\u5b58\u5728";
  if (raw.includes("room expired")) return "\u623f\u95f4\u5df2\u8fc7\u671f";
  if (raw.includes("room full")) return "\u623f\u95f4\u5df2\u6ee1";
  if (raw.includes("join room first")) return "\u8bf7\u5148\u52a0\u5165\u623f\u95f4";
  if (raw.includes("placement incomplete")) return "\u8bf7\u5148\u5b8c\u6210\u5e03\u9635";
  if (raw.includes("ball invalid")) return "\u5c0f\u7403\u9009\u62e9\u65e0\u6548";
  if (raw.includes("spawn")) return "\u5e03\u9635\u4f4d\u7f6e\u65e0\u6548";
  if (raw.includes("velocity")) return "\u521d\u901f\u5ea6\u65e0\u6548";
  if (raw.includes("permission")) return "\u65e0\u6743\u64cd\u4f5c\u8be5\u623f\u95f4";
  if (raw.includes("cloud") || raw.includes("fail")) return "\u4e91\u51fd\u6570\u8c03\u7528\u5931\u8d25";
  return raw || "\u4e91\u51fd\u6570\u8c03\u7528\u5931\u8d25";
}

module.exports = {
  login() {
    return call("login", {});
  },

  saveMatch(match) {
    return call("saveMatch", { action: "save", match });
  },

  listMatches() {
    return call("saveMatch", { action: "list" });
  },

  createRoom(payload) {
    return call("rooms", { action: "create", payload });
  },

  joinRoom(roomId) {
    return call("rooms", { action: "join", roomId });
  },

  updateRoom(roomId, patch) {
    return call("rooms", { action: "update", roomId, patch });
  },

  getRoom(roomId) {
    return call("rooms", { action: "get", roomId });
  },

  friendlyError
};
