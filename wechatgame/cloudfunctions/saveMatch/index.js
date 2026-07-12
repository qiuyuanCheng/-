const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (event.action === "list") {
    const res = await db.collection("matches")
      .where({ _openid: openid })
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    return { items: res.data };
  }
  const match = event.match || {};
  const doc = {
    winnerTeam: match.winnerTeam,
    timeout: !!match.timeout,
    duration: match.duration,
    seed: match.seed,
    mode: match.mode,
    map: match.map,
    balls: match.balls || [],
    createdAt: Date.now()
  };
  const res = await db.collection("matches").add({ data: doc });
  return { _id: res._id };
};
