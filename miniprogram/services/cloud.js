function call(name, data) {
  if (!wx.cloud) return Promise.reject(new Error("当前环境不支持云开发"));
  return wx.cloud.callFunction({ name, data }).then((res) => res.result);
}

function login() {
  return call("login", {});
}

function saveMatch(match) {
  return call("saveMatch", { match });
}

function listMatches() {
  return call("saveMatch", { action: "list" });
}

function createRoom(payload) {
  return call("rooms", { action: "create", payload });
}

function joinRoom(roomId) {
  return call("rooms", { action: "join", roomId });
}

function updateRoom(roomId, patch) {
  return call("rooms", { action: "update", roomId, patch });
}

function getRoom(roomId) {
  return call("rooms", { action: "get", roomId });
}

module.exports = { login, saveMatch, listMatches, createRoom, joinRoom, updateRoom, getRoom };
