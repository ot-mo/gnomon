// Villagers (TECH_DESIGN §2.16 roles; bible §9.5 standard roles; §15.7 glyphs: people are @ in their own colour;
// WS7, then C3): talker types in the creature table shape, registered with creatures.js registerCreatures.
//
//   VILLAGERS[type] = { name, title, role, glyph "@", color (each pair unique), art, palette, talks: true,
//                       talk: { dialogue, gossip }, hp, fight, dv, attrs, merchant?, named? }
//     role       what story/villages.js casts it as (bible §9.5): leader, warden, merchant, tinker, leech,
//                lamplighter, questGiver, villager
//     dialogue   one of social/builders.js ROLES (WS6a: villager, priest, guard, wanderer, merchant); a leader's comes
//                from its government (VILLAGES.governments) and is set on the creature
//     gossip     true: it tells rumours (story/gossip.js's talk option "Heard anything lately?")
//     hp         a villager is mortal (WS6a #1; since p2-ws7b a talker whose type has hp is struck and killed like a
//                monster, and neither fights back nor flees)
//     fight      what it does when struck (C3, for WS7b's people's brains: ai.js reads it once built, docs/c3.md
//                integration requests): { back: true, damage, cooldown, reach, speed, sight } fights whoever struck it
//                with a monster's numbers (bible §9.5: the warden keeps the peace); { flee: true, speed } runs from them
//     dv, attrs  the d20 numbers, as wildlife.js's (combat.js reads dv for a mortal talker as for a monster)
//     merchant   stock: a social/merchants.js stock table ("tinker": people.js STOCKS, falling back to "general" until
//                it is registered)
// The village sets each one's own name, uid ("village:<site>:<role>[:n]"), level, faction memberships (c.faction), and
// for leaders named, opinions, readings and teaches (WS6b's Kindling).
import { registerCreatures } from "../../creatures.js";

const d20 = (str, agi, tou, int, wil, ego) => ({ attrs: { str, agi, tou, int, wil, ego }, dv: Math.floor((agi - 16) / 2) });

// 9 × 16 pixel art: h hair or hood, s skin, e eyes, m mouth, r robe or coat, b belt, g trim, t tool, f feet.
export const SMOCK = [
  "   hhh   ", "  hhhhh  ", "  seses  ", "  sssss  ", "  ssmss  ", "  rrrrr  ", " rrrrrrr ", "rrrrrrrrr",
  "s rbbbr s", "  rrrrr  ", "  rrrrr  ", "  rrrrr  ", "  rr rr  ", "  rr rr  ", "  rr rr  ", "  ff ff  ",
];
export const CLOAK = [
  "  hhhhh  ", " hhhhhhh ", " hsesesh ", " hsssssh ", " hhsmshh ", " grrrrrg ", "grrrrrrrg", "grrrrrrrg",
  "s rrbrr s", " grrrrrg ", " grrrrrg ", " grrrrrg ", " grrrrrg ", "grrrrrrrg", "grrrrrrrg", "  ff ff  ",
];
export const APRON = [
  "   hhh   ", "  hhhhh  ", "  seses  ", "  sssss  ", "  ssmss  ", " rrrrrrr ", "rrggggrrt", "rrggggrrt",
  "s gggg st", "  gggg  t", "  gggg   ", "  rrrrr  ", "  rr rr  ", "  rr rr  ", "  rr rr  ", "  ff ff  ",
];
export const SPEAR = [
  "t  hhh   ", "t hhhhh  ", "t seses  ", "t sssss  ", "t ssmss  ", "trrrrrrr ", "trrbrrbrr", "trrrrrrrr",
  "s rrrrr s", "t rbbbr  ", "t rrrrr  ", "t rrrrr  ", "t rr rr  ", "t rr rr  ", "t rr rr  ", "t ff ff  ",
];
export const SKIN = [[215, 170, 130], 0], EYES = [[40, 35, 45], 0], MOUTH = [[150, 80, 70], 0], BOOTS = [[80, 62, 48], 0];
export const look = (art, hair, robe, trim, extra = {}) => ({
  art, palette: { h: [hair, 0], s: SKIN, e: EYES, m: MOUTH, r: [robe, 0], g: [trim, 0.15], b: [[70, 55, 40], 0], t: [[150, 120, 80], 0], f: BOOTS, ...extra },
});
const FLEES = { flee: true, speed: 2.6 };

export const VILLAGERS = {
  villageLeader: { name: "the reeve", title: "the village's leader", role: "leader", glyph: "@", color: [255, 245, 200], hp: 30,
    fight: { flee: true, speed: 2.4 }, ...d20(14, 15, 16, 16, 16, 18),
    talk: { dialogue: "villager", gossip: true }, named: true, ...look(CLOAK, [90, 70, 55], [120, 60, 90], [235, 205, 120]) },
  villageWarden: { name: "the warden", title: "the village's warden", role: "warden", glyph: "@", color: [170, 190, 150], hp: 34,
    fight: { back: true, damage: [3, 6], cooldown: 1.3, reach: 1.6, speed: 2.6, sight: 12 }, ...d20(18, 16, 18, 12, 16, 12),
    talk: { dialogue: "guard" }, ...look(SPEAR, [60, 50, 45], [95, 110, 80], [150, 150, 160]) },
  villageMerchant: { name: "the trader", title: "a village trader", role: "merchant", glyph: "@", color: [235, 160, 120], hp: 18,
    fight: FLEES, ...d20(12, 15, 14, 16, 14, 16),
    talk: { dialogue: "merchant", gossip: true }, merchant: { stock: "general" }, ...look(APRON, [140, 95, 50], [130, 95, 60], [200, 175, 120]) },
  villageTinker: { name: "the tinker", title: "a tinker", role: "tinker", glyph: "@", color: [160, 170, 200], hp: 18,
    fight: { flee: true, speed: 2.4 }, ...d20(14, 14, 14, 18, 14, 12),
    talk: { dialogue: "merchant" }, merchant: { stock: "tinker", services: ["identify", "uncurse", "identifyArtifact", "rechargeCell"] },
    ...look(APRON, [50, 45, 40], [85, 90, 110], [170, 170, 185]) },
  villageLeech: { name: "the leech", title: "the village healer", role: "leech", glyph: "@", color: [200, 235, 170], hp: 16,
    fight: { flee: true, speed: 2.4 }, ...d20(10, 15, 14, 18, 16, 14),
    talk: { dialogue: "priest", gossip: true }, merchant: { stock: "general" }, ...look(SMOCK, [200, 200, 190], [215, 225, 200], [120, 170, 90]) },
  villageLamplighter: { name: "the lamplighter", title: "keeper of the commons lamp", role: "lamplighter", glyph: "@", color: [255, 215, 150], hp: 16,
    fight: FLEES, ...d20(12, 16, 14, 14, 16, 14),
    talk: { dialogue: "wanderer", gossip: true }, ...look(CLOAK, [70, 55, 40], [160, 120, 60], [255, 200, 90]) },
  villageBellKeeper: { name: "the bell-keeper", title: "keeper of the commons dark", role: "lamplighter", glyph: "@", color: [140, 130, 170], hp: 16,
    fight: FLEES, ...d20(12, 16, 14, 14, 18, 12),
    talk: { dialogue: "wanderer", gossip: true }, ...look(CLOAK, [40, 35, 50], [60, 55, 75], [150, 140, 190]) },
  villageQuestGiver: { name: "a villager in need", title: "someone with a task", role: "questGiver", glyph: "@", color: [235, 200, 235], hp: 16,
    fight: FLEES, ...d20(12, 15, 14, 14, 14, 14),
    talk: { dialogue: "villager", gossip: true }, ...look(SMOCK, [160, 80, 50], [150, 100, 140], [230, 200, 120]) },
  villager: { name: "a villager", title: "a villager", role: "villager", glyph: "@", color: [190, 200, 160], hp: 14,
    fight: FLEES, ...d20(13, 15, 14, 12, 14, 12),
    talk: { dialogue: "villager", gossip: true }, ...look(SMOCK, [110, 80, 55], [120, 135, 95], [180, 160, 110]) },
};
for (const t of Object.values(VILLAGERS)) t.talks = true;
registerCreatures(VILLAGERS);
