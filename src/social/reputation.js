// Reputation events (TECH_DESIGN §2.11 "Reputation events"; owner WS6a). The design names no function here
// (the API, repOf, addRep, band and attitude, is factions.js's), so nothing is frozen; WS6a chooses the exports
// and subscribes from social/index.js:
//   "attack" on a member witnessed by a same-faction creature within 12 tiles in line of sight (creatures.js
//   creaturesNear): every witness gets a grudge, the faction RULES.rep.attackPenalty; "kill": killPenalty
//   with the victim's factions, +killPenalty / 2 with factions that hate them. Only the player's own actions
//   (and its followers') move rep: an explicit `source`, never a default.
// P0: nothing (no handler is subscribed). Remove STUB when the file is built.
export const STUB = "WS6a";
