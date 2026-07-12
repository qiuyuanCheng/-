const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const now = Date.now();
  const users = db.collection("users");
  const existing = await users.where({ _openid: openid }).limit(1).get();
  if (existing.data.length) {
    await users.doc(existing.data[0]._id).update({ data: { lastLoginAt: now } });
    return { openid, _id: existing.data[0]._id };
  }
  const res = await users.add({ data: { createdAt: now, lastLoginAt: now } });
  return { openid, _id: res._id };
};
