const cloud = require("wx-server-sdk");
const {
  sanitizeMatchForCreate,
  sanitizeEditableSlots,
  sanitizeSelectionSlots,
  assertOwnPlacementComplete
} = require("./room_validation");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID;
  const action = event.action;
  if (action === "create") return create(openid, event.payload || {});
  if (action === "join") return join(openid, event.roomId);
  if (action === "update") return update(openid, event.roomId, event.patch || {});
  if (action === "get") return get(openid, event.roomId);
  throw new Error("unknown action");
};

async function create(openid, payload) {
  const now = Date.now();
  const match = sanitizeMatchForCreate(payload.match);
  const doc = {
    ownerOpenid: openid,
    guestOpenid: null,
    match,
    ownerSelected: true,
    guestSelected: false,
    ownerPlaced: false,
    guestPlaced: false,
    ownerReady: false,
    guestReady: false,
    status: "selecting",
    createdAt: now,
    expiresAt: now + 30 * 60 * 1000
  };
  const res = await db.collection("rooms").add({ data: doc });
  return Object.assign({ _id: res._id }, doc);
}

async function join(openid, roomId) {
  const room = await readRoom(roomId);
  if (room.expiresAt < Date.now()) throw new Error("room expired");
  if (room.ownerOpenid !== openid && room.guestOpenid && room.guestOpenid !== openid) throw new Error("room full");
  if (room.ownerOpenid !== openid && !room.guestOpenid) {
    await db.collection("rooms").doc(roomId).update({ data: { guestOpenid: openid, status: "joined" } });
  }
  return get(openid, roomId);
}

async function update(openid, roomId, patch) {
  const room = await readRoom(roomId);
  if (room.expiresAt < Date.now()) throw new Error("room expired");
  assertParticipant(room, openid);
  const data = {};
  const isOwner = room.ownerOpenid === openid;
  const editableTeams = isOwner ? ["A"] : ["B", "C"];

  if (Array.isArray(patch.slots)) {
    data.match = sanitizeEditableSlots(room.match, patch.slots, editableTeams);
  }

  if (Array.isArray(patch.selectionSlots)) {
    data.match = sanitizeSelectionSlots(data.match || room.match, patch.selectionSlots, editableTeams);
    if (isOwner) {
      data.ownerSelected = true;
      data.ownerPlaced = false;
      data.ownerReady = false;
    } else {
      data.guestSelected = true;
      data.guestPlaced = false;
      data.guestReady = false;
    }
  }

  if (patch.placed) {
    const currentMatch = data.match || room.match;
    assertOwnPlacementComplete(currentMatch, editableTeams);
    if (isOwner) data.ownerPlaced = true;
    else data.guestPlaced = true;
  }

  if (patch.ready) {
    const currentMatch = data.match || room.match;
    assertOwnPlacementComplete(currentMatch, editableTeams);
    if (isOwner) data.ownerReady = true;
    else data.guestReady = true;
  }

  const ownerSelected = "ownerSelected" in data ? data.ownerSelected : room.ownerSelected;
  const guestSelected = "guestSelected" in data ? data.guestSelected : room.guestSelected;
  const ownerPlaced = "ownerPlaced" in data ? data.ownerPlaced : room.ownerPlaced;
  const guestPlaced = "guestPlaced" in data ? data.guestPlaced : room.guestPlaced;
  const ownerReady = "ownerReady" in data ? data.ownerReady : room.ownerReady;
  const guestReady = "guestReady" in data ? data.guestReady : room.guestReady;
  if (ownerReady && guestReady) data.status = "ready";
  else if (ownerPlaced && guestPlaced) data.status = "placingReady";
  else if (ownerSelected && guestSelected) data.status = "placing";
  else if (room.guestOpenid) data.status = "selecting";

  await db.collection("rooms").doc(roomId).update({ data });
  return get(openid, roomId);
}

async function get(openid, roomId) {
  const room = await readRoom(roomId);
  assertParticipantOrOpen(room, openid);
  if (room.expiresAt < Date.now() && room.status !== "expired") {
    await db.collection("rooms").doc(roomId).update({ data: { status: "expired" } });
    room.status = "expired";
  }
  const role = room.ownerOpenid === openid ? "owner" : room.guestOpenid === openid ? "guest" : "viewer";
  return Object.assign({}, sanitizeRoomForRole(room, role), { role });
}

async function readRoom(roomId) {
  if (!roomId) throw new Error("room not found");
  const res = await db.collection("rooms").doc(roomId).get();
  if (!res.data) throw new Error("room not found");
  return res.data;
}

function assertParticipant(room, openid) {
  if (room.ownerOpenid !== openid && room.guestOpenid !== openid) throw new Error("join room first");
}

function assertParticipantOrOpen(room, openid) {
  if (!room.guestOpenid || room.ownerOpenid === openid || room.guestOpenid === openid) return;
  throw new Error("permission denied");
}

function sanitizeRoomForRole(room, role) {
  if (room.status === "ready" || room.status === "playing") return room;
  const visibleTeams = role === "owner" ? ["A"] : role === "guest" ? ["B", "C"] : [];
  const match = Object.assign({}, room.match, {
    slots: (room.match.slots || []).map((slot) => {
      if (visibleTeams.includes(slot.teamId)) return slot;
      return Object.assign({}, slot, {
        ballId: slot.spawn ? "UNKNOWN" : null,
        initialAngleDeg: 0,
        initialVelocity: null
      });
    })
  });
  return Object.assign({}, room, { match });
}

exports._test = { sanitizeRoomForRole };
