// Villagers (TECH_DESIGN §2.16 roles; bible §9.5 standard roles; §15.7 glyphs: people are @ in their own colour;
// WS7, then C3): talker types in the creature table shape, registered with creatures.js registerCreatures.
//
//   VILLAGERS[type] = { name, title, role, glyph "@", color (each pair unique), art, palette, talks: true,
//                       talk: { dialogue, gossip }, hp, merchant?, named? }
//     role       what story/villages.js casts it as (bible §9.5): leader, warden, merchant, tinker, leech,
//                lamplighter, questGiver, villager
//     dialogue   one of social/builders.js ROLES (WS6a: villager, priest, guard, wanderer, merchant); a leader's comes
//                from its government (VILLAGES.governments) and is set on the creature
//     gossip     true: it tells rumours (story/gossip.js's talk option "Heard anything lately?")
//     hp         a villager is mortal (WS6a #1: a talker whose type has hp gets hp like a monster once the
//                integrator wires it; until then talkers can't be struck, as in P0)
// The village sets each one's own name, uid ("village:<site>:<role>[:n]"), level, faction memberships (c.faction), and
// for leaders named, opinions, readings and teaches (WS6b's Kindling).
import { registerCreatures } from "../../creatures.js";

// 9 × 16 pixel art: h hair or hood, s skin, e eyes, m mouth, r robe or coat, b belt, g trim, t tool, f feet.
const SMOCK = [
  "   hhh   ", "  hhhhh  ", "  seses  ", "  sssss  ", "  ssmss  ", "  rrrrr  ", " rrrrrrr ", "rrrrrrrrr",
  "s rbbbr s", "  rrrrr  ", "  rrrrr  ", "  rrrrr  ", "  rr rr  ", "  rr rr  ", "  rr rr  ", "  ff ff  ",
];
const CLOAK = [
  "  hhhhh  ", " hhhhhhh ", " hsesesh ", " hsssssh ", " hhsmshh ", " grrrrrg ", "grrrrrrrg", "grrrrrrrg",
  "s rrbrr s", " grrrrrg ", " grrrrrg ", " grrrrrg ", " grrrrrg ", "grrrrrrrg", "grrrrrrrg", "  ff ff  ",
];
const APRON = [
  "   hhh   ", "  hhhhh  ", "  seses  ", "  sssss  ", "  ssmss  ", " rrrrrrr ", "rrggggrrt", "rrggggrrt",
  "s gggg st", "  gggg  t", "  gggg   ", "  rrrrr  ", "  rr rr  ", "  rr rr  ", "  rr rr  ", "  ff ff  ",
];
const SPEAR = [
  "t  hhh   ", "t hhhhh  ", "t seses  ", "t sssss  ", "t ssmss  ", "trrrrrrr ", "trrbrrbrr", "trrrrrrrr",
  "s rrrrr s", "t rbbbr  ", "t rrrrr  ", "t rrrrr  ", "t rr rr  ", "t rr rr  ", "t rr rr  ", "t ff ff  ",
];
const SKIN = [[215, 170, 130], 0], EYES = [[40, 35, 45], 0], MOUTH = [[150, 80, 70], 0], BOOTS = [[80, 62, 48], 0];
const look = (art, hair, robe, trim, extra = {}) => ({
  art, palette: { h: [hair, 0], s: SKIN, e: EYES, m: MOUTH, r: [robe, 0], g: [trim, 0.15], b: [[70, 55, 40], 0], t: [[150, 120, 80], 0], f: BOOTS, ...extra },
});

export const VILLAGERS = {
  villageLeader: { name: "the reeve", title: "the village's leader", role: "leader", glyph: "@", color: [255, 245, 200], hp: 30,
    talk: { dialogue: "villager", gossip: true }, named: true, ...look(CLOAK, [90, 70, 55], [120, 60, 90], [235, 205, 120]) },
  villageWarden: { name: "the warden", title: "the village's warden", role: "warden", glyph: "@", color: [170, 190, 150], hp: 34,
    talk: { dialogue: "guard" }, ...look(SPEAR, [60, 50, 45], [95, 110, 80], [150, 150, 160]) },
  villageMerchant: { name: "the trader", title: "a village trader", role: "merchant", glyph: "@", color: [235, 160, 120], hp: 18,
    talk: { dialogue: "merchant", gossip: true }, merchant: { stock: "general" }, ...look(APRON, [140, 95, 50], [130, 95, 60], [200, 175, 120]) },
  villageTinker: { name: "the tinker", title: "a tinker", role: "tinker", glyph: "@", color: [160, 170, 200], hp: 18,
    talk: { dialogue: "merchant" }, merchant: { stock: "general", services: ["identify", "uncurse"] },
    ...look(APRON, [50, 45, 40], [85, 90, 110], [170, 170, 185]) },
  villageLeech: { name: "the leech", title: "the village healer", role: "leech", glyph: "@", color: [200, 235, 170], hp: 16,
    talk: { dialogue: "priest", gossip: true }, merchant: { stock: "general" }, ...look(SMOCK, [200, 200, 190], [215, 225, 200], [120, 170, 90]) },
  villageLamplighter: { name: "the lamplighter", title: "keeper of the commons lamp", role: "lamplighter", glyph: "@", color: [255, 215, 150], hp: 16,
    talk: { dialogue: "wanderer", gossip: true }, ...look(CLOAK, [70, 55, 40], [160, 120, 60], [255, 200, 90]) },
  villageBellKeeper: { name: "the bell-keeper", title: "keeper of the commons dark", role: "lamplighter", glyph: "@", color: [140, 130, 170], hp: 16,
    talk: { dialogue: "wanderer", gossip: true }, ...look(CLOAK, [40, 35, 50], [60, 55, 75], [150, 140, 190]) },
  villageQuestGiver: { name: "a villager in need", title: "someone with a task", role: "questGiver", glyph: "@", color: [235, 200, 235], hp: 16,
    talk: { dialogue: "villager", gossip: true }, ...look(SMOCK, [160, 80, 50], [150, 100, 140], [230, 200, 120]) },
  villager: { name: "a villager", title: "a villager", role: "villager", glyph: "@", color: [190, 200, 160], hp: 14,
    talk: { dialogue: "villager", gossip: true }, ...look(SMOCK, [110, 80, 55], [120, 135, 95], [180, 160, 110]) },
};
for (const t of Object.values(VILLAGERS)) t.talks = true;
registerCreatures(VILLAGERS);
