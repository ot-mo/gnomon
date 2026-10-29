// People (C3; bible §12.6's two people, §5's landmark people whose kinds didn't exist, WS5 #11's surgeon's and tinker's
// stock): talker types in the villagers' shape (villagers.js says what each field is), registered with creatures.js
// registerCreatures. People are `@` in their own colour (bible §15.7); each is mortal (hp) and has its d20 numbers.
//
//   PEOPLE[type]   the type; `talk.dialogue` names the role conversation it uses (social/builders.js ROLES) until C5
//                  writes its words; `rule`/`needs` as wildlife.js's
//     flatfolkWanderer, pressedPilgrim   bible §12.6, in the Tessellate's and the Old Rule's rows (content/world/
//                  regions.js): drawn into dungeons like any kind of the rows, so their conversation is registered here
//                  under their own ids (talk.js dispatches on the type's id by default)
//     tamsin, hallen, ottilie, corner    Hollowmere's people of bible §5 A (content/world/landmarks.js letters `who`),
//                  for C1b's and C5's placing and C5's words (registered with no conversation of their own: C5's)
//     detailC      Benchmark's Truing Cradle keeper (bible §5 D), the surgeon of WS5 #11
//   STOCKS[id]     the surgeon's and the tinker's packs (WS5 #11, with C4's implants, artifacts and cells): what
//                  social/merchants.js registerStock(id, …) makes of them is integration request 10 in docs/c3.md; a
//                  merchant naming a stock that isn't registered sells the general one meanwhile
import { registerCreatures } from "../../creatures.js";
import { registerDialogue, dialogueIds } from "../../talk.js";
import { buildDialogue } from "../../social/builders.js";
import { BESTIARY } from "./bestiary.js";
import { CLOAK, APRON, SMOCK, look } from "./villagers.js";

const d20 = (str, agi, tou, int, wil, ego) => ({ attrs: { str, agi, tou, int, wil, ego }, dv: Math.floor((agi - 16) / 2) });
const FLEES = { flee: true, speed: 2.6 };

// A pilgrim lying full length (16 × 5), a cat (9 × 6) and an automaton (9 × 8): h hair, r robe, s skin, e eyes, m mouth, f feet.
const LYING = ["    hhh         ", "rrrrseserrrrrr  ", "srrrssssrrrrrrff", "rrrrssmsrrrrrr  ", "    hhh         "];
const CAT = [" e    e  ", " ee  ee  ", " cEccEc  ", " cccccc t", "cccccccct", " c c  c  "];
const ENGINE = ["   LLL   ", "  LEEEL  ", "   LLL   ", "  mmmmm  ", " mmMmMmm ", " m mmm m ", "   m m   ", "  mm mm  "];

export const PEOPLE = {
  // --- Bible §12.6: the Tessellate's people ------------------------------------------------------------------
  flatfolkWanderer: {
    name: "a Flatfolk wanderer", title: "a trader of the Plane", glyph: "@", color: [92, 108, 208], flat: true, hp: 14,
    factions: ["flatfolk"], fight: FLEES, ...d20(10, 18, 12, 16, 14, 18), w: 0.8, h: 0.1,
    talk: { dialogue: "wanderer" }, merchant: { stock: "general" },
    rule: { directions: "lost" }, needs: "directions for the Lost: found again at once, on the map only (overworld/travel.js lost recovery, a talk option)",
  },
  pressedPilgrim: {
    name: "a pressed pilgrim", title: "a pilgrim of the Plane", glyph: "@", color: [224, 224, 238], hp: 12, w: 1.6, h: 0.45,
    factions: ["pressed"], fight: { stays: true }, ...d20(10, 10, 12, 14, 20, 12),
    talk: { dialogue: "priest" },
    rule: { lies: "mosaic", desecration: true }, needs: "lying on mosaics (gen/biomes); striking one is desecration with the Pressed (C2's holy places, social/reputation.js)",
    art: LYING, palette: { h: [[120, 100, 80], 0], r: [[225, 225, 238], 0.1], s: [[215, 175, 140], 0], e: [[40, 35, 45], 0], m: [[150, 80, 70], 0], f: [[90, 80, 70], 0] },
  },

  // --- Bible §5 A: Hollowmere's people (content/world/landmarks.js letters) ---------------------------------------------
  tamsin: {
    name: "Brother Tamsin", title: "a Horary missionary", glyph: "@", color: [226, 166, 72], hp: 18, factions: ["horary"], fight: FLEES,
    ...d20(12, 14, 14, 16, 18, 18), talk: { dialogue: "priest" },
    rule: { sells: "dial-stele Locations", buys: "Hour readings" }, needs: "his words and trade (C5; WS6b's readings)",
    ...look(CLOAK, [200, 150, 70], [190, 130, 50], [255, 220, 120]),
  },
  hallen: {
    name: "Reeve Hallen", title: "the Reeve of Hollowmere", glyph: "@", color: [146, 194, 118], hp: 30, factions: ["hollowmere"],
    fight: { flee: true, speed: 2.4 }, ...d20(14, 15, 16, 16, 18, 18), talk: { dialogue: "villager" }, named: true,
    rule: { teaches: "Pathcraft", quest: "Grubs in the Kettle" }, needs: "her quest and her words (C5)",
    ...look(CLOAK, [110, 70, 50], [95, 120, 80], [200, 190, 130]),
  },
  ottilie: {
    name: "Old Ottilie", title: "the tinker", glyph: "@", color: [184, 158, 132], hp: 16, factions: ["hollowmere"],
    fight: { flee: true, speed: 2.0 }, ...d20(10, 12, 12, 20, 16, 14), talk: { dialogue: "merchant" },
    merchant: { stock: "tinker", services: ["identifyArtifact", "rechargeCell", "identify"] },
    rule: { repairs: true, examines: 10 }, needs: "repairs and the artifact examination at 10 glim × complexity (bodymods/stations.js); her words (C5)",
    ...look(APRON, [225, 225, 220], [120, 100, 85], [190, 170, 130]),
  },
  corner: {
    name: "Corner", title: "the temple cat", glyph: "@", color: [232, 176, 96], hp: 4, factions: ["hollowmere"], fight: FLEES,
    ...d20(4, 22, 6, 6, 16, 22), w: 0.55, h: 0.45, talk: { dialogue: "villager" },
    rule: { pet: { xp: 0.1, hours: 24 } }, needs: "petting her: +10% XP for a world day (a talk option, leveling.js gainXp)",
    art: CAT, palette: { e: [[200, 140, 80], 0], c: [[225, 165, 90], 0], E: [[120, 220, 120], 0.8], t: [[200, 140, 80], 0] },
  },

  // --- Bible §5 D: Benchmark's Cradle keeper ----------------------------------------------------------------------
  detailC: {
    name: "Detail C", title: "an automaton on loan from the Plan", glyph: "@", color: [158, 182, 194], hp: 26, factions: ["plan"],
    fight: { stays: true }, ...d20(16, 12, 18, 18, 16, 4), talk: { dialogue: "merchant" }, w: 0.9, h: 1.5,
    merchant: { stock: "surgeon", services: ["fitImplant", "removeImplant", "identifyArtifact"] },
    rule: { reads: "datum", price: 300 }, needs: "reading the Datum for 300 glim, free at the Plan Warm (beat 2, C5); its place at Benchmark's Cradle (C1b)",
    art: ENGINE, palette: { L: [[160, 185, 195], 0.1], E: [[120, 220, 255], 1.4], m: [[130, 150, 160], 0], M: [[200, 215, 225], 0] },
  },
};

// The surgeon's table and the tinker's pack (WS5 #11): by C4's ids (content/items/implants.js IMPLANTS, artifacts.js
// ARTIFACTS and CELLS). count [lo, hi] a day; grade: the highest implant grade on the table from a level on; the rest
// of the pack is the general one's.
export const STOCKS = {
  tinker: {
    cells: [["glim", 3], ["sun", 1], ["dark", 1]],
    artifacts: { count: [1, 2], from: ["plumbBob", "quicksilverLevel", "echoBell", "lanternMote", "recallBead", "stillDial", "featherfallLantern", "jumpSprings"] },
    general: true,
  },
  surgeon: {
    implants: { count: [2, 3], grade: [[1, 2], [5, 3], [8, 4], [11, 5], [14, 6], [17, 8], [20, 10]] },
    cells: [["heart", 1], ["glim", 2]],
    general: false,
  },
};

for (const [id, t] of Object.entries(PEOPLE)) {
  t.talks = true;
  const b = BESTIARY[id];
  if (b) { t.info = b.deep; t.lines = { flat: b.flat, deep: b.deep, dark: b.dark }; }
}
registerCreatures(PEOPLE);
// The two the regions' rows draw into dungeons talk with their role's conversation (until C5 writes theirs).
for (const id of ["flatfolkWanderer", "pressedPilgrim"])
  if (!dialogueIds().includes(id)) registerDialogue(id, buildDialogue(PEOPLE[id].talk.dialogue));
