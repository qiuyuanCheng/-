const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (event.action === "list") {
    const res = await db.collection("matches")
      .where({ _openid: openid })
      .limit(50)
      .get();
    const items = (res.data || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { items };
  }
  if (event.action && event.action !== "save") throw new Error("invalid action");
  const match = event.match || {};
  const doc = {
    winnerTeam: match.winnerTeam,
    timeout: !!match.timeout,
    duration: match.duration,
    seed: match.seed,
    mode: match.mode,
    map: match.map,
    matchType: match.matchType === "friend" ? "friend" : "local",
    roomId: typeof match.roomId === "string" ? match.roomId : "",
    balls: match.balls || [],
    presentationStats: match.presentationStats || {},
    createdAt: Date.now()
  };
  const res = await db.collection("matches").add({ data: doc });
  return { _id: res._id };
};
