const { BALL_BY_ID } = require("../core/configs_v2");

function editableTeamsForRole(role) {
  if (role === "owner") return ["A"];
  if (role === "guest") return ["B", "C"];
  return [];
}

function canEditSlot(slot, role) {
  return editableTeamsForRole(role).includes(slot && slot.teamId);
}

function cloneMatch(match) {
  return JSON.parse(JSON.stringify(match || {}));
}

function buildRoomCreateMatch(match) {
  const safe = cloneMatch(match);
  safe.slots = (safe.slots || []).map((slot) => {
    if (slot.teamId === "A") {
      return {
        slotId: slot.slotId,
        teamId: slot.teamId,
        ballId: slot.ballId,
        spawn: null,
        initialAngleDeg: 0,
        initialVelocity: null
      };
    }
    return {
      slotId: slot.slotId,
      teamId: slot.teamId,
      ballId: null,
      spawn: null,
      initialAngleDeg: 0,
      initialVelocity: null
    };
  });
  return safe;
}

function selectedSlotsForRole(match, role) {
  return (match.slots || [])
    .filter((slot) => canEditSlot(slot, role))
    .map((slot) => ({ slotId: slot.slotId, teamId: slot.teamId, ballId: slot.ballId }));
}

function placedSlotsForRole(match, role) {
  return (match.slots || [])
    .filter((slot) => canEditSlot(slot, role))
    .map((slot) => ({
      slotId: slot.slotId,
      teamId: slot.teamId,
      ballId: slot.ballId,
      spawn: slot.spawn,
      initialAngleDeg: slot.initialAngleDeg,
      initialVelocity: slot.initialVelocity
    }));
}

function ownSlots(match, role) {
  return (match.slots || []).filter((slot) => canEditSlot(slot, role));
}

function hasOwnSelection(match, role) {
  const slots = ownSlots(match, role);
  return !!slots.length && slots.every((slot) => !!BALL_BY_ID[slot.ballId]);
}

function hasOwnPlacement(match, role) {
  const slots = ownSlots(match, role);
  return !!slots.length && slots.every((slot) => !!BALL_BY_ID[slot.ballId] && !!slot.spawn && !!slot.initialVelocity);
}

function allSelected(room) {
  return !!(room && room.ownerSelected && room.guestSelected);
}

function allPlaced(room) {
  return !!(room && room.ownerPlaced && room.guestPlaced);
}

function roleLabel(role) {
  if (role === "owner") return "A \u9635\u8425";
  if (role === "guest") return "B/C \u9635\u8425";
  return "\u89c2\u6218";
}

function getBallName(ballId) {
  return BALL_BY_ID[ballId] ? BALL_BY_ID[ballId].name : "\u672a\u9009\u62e9";
}

module.exports = {
  editableTeamsForRole,
  canEditSlot,
  cloneMatch,
  buildRoomCreateMatch,
  selectedSlotsForRole,
  placedSlotsForRole,
  ownSlots,
  hasOwnSelection,
  hasOwnPlacement,
  allSelected,
  allPlaced,
  roleLabel,
  getBallName
};
