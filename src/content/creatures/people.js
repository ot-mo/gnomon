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
//                  for C1b's and C5's placing and C5's words (each talks with its role's conversation until then)
//     detailC      Benchmark's Truing Cradle keeper (bible §5 D), the surgeon of WS5 #11
//     surveyor, chandler, drover, kiteFolk, folioCitizen, horaryFaithful, lamplessFaithful, lineCitizen, ghostPerson,
//     planAutomaton, pressedFaithful, pleatwoodWarden, sporeMooter, speakingTree   the other landmark people, a plain
//                  person per culture (integrator, C5 #3): `people` names the letters' `who` each stands for (Folio's
//                  are flat, met only on the map; the ghosts are seen only in the dark)
//   STOCKS[id]     the surgeon's and the tinker's packs (WS5 #11, with C4's implants, artifacts and cells): what
//                  social/merchants.js registerStock(id, …) makes of them is integration request 10 in docs/c3.md; a
//                  merchant naming a stock that isn't registered sells the general one meanwhile
import { registerCreatures } from "../../creatures.js";
import { registerDialogue, dialogueIds, node, bye } from "../../talk.js";
import { buildDialogue } from "../../social/builders.js";
import { BESTIARY } from "./bestiary.js";
import { CLOAK, APRON, SMOCK, SPEAR, look } from "./villagers.js";

const d20 = (str, agi, tou, int, wil, ego) => ({ attrs: { str, agi, tou, int, wil, ego }, dv: Math.floor((agi - 16) / 2) });
const FLEES = { flee: true, speed: 2.6 };

// A pilgrim lying full length (16 × 5), a cat (9 × 6) and an automaton (9 × 8): h hair, r robe, s skin, e eyes, m mouth, f feet.
const LYING = ["    hhh         ", "rrrrseserrrrrr  ", "srrrssssrrrrrrff", "rrrrssmsrrrrrr  ", "    hhh         "];
const CAT = [" e    e  ", " ee  ee  ", " cEccEc  ", " cccccc t", "cccccccct", " c c  c  "];
const ENGINE = ["   LLL   ", "  LEEEL  ", "   LLL   ", "  mmmmm  ", " mmMmMmm ", " m mmm m ", "   m m   ", "  mm mm  "];
// A knot in a trunk with a face in it (9 × 7): b bark, k the knot, E eyes, m mouth.
const KNOT = [" bbbbbbb ", "bbkkkkkbb", "bkEkkkEkb", "bkkkkkkkb", "bkkkmkkkb", "bbkkkkkbb", " bbbbbbb "];

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

  // --- Bible §5: the other landmark people, a plain person per culture (integrator, C5 #3, C1b #18) -----------------
  // `people` lists the landmarks.js letters (`who`) each stands for; a placed one takes its name and title from its letter
  // (story/landmark-people.js) and talks under its own words (content/people-words.js).
  surveyor: {
    name: "a surveyor", title: "of the Survey", glyph: "@", color: [118, 168, 214], hp: 18, factions: ["survey"], fight: FLEES,
    ...d20(12, 14, 14, 18, 14, 14), talk: { dialogue: "villager" },
    people: ["quintVey", "saaraTovi", "benchmarkLeech", "benchmarkSignaller", "mapRoomSurveyor", "toviHallen"],
    ...look(CLOAK, [90, 70, 55], [70, 100, 140], [200, 190, 140]),
  },
  chandler: {
    name: "a Chandler", title: "of the Chandler houses", glyph: "@", color: [244, 210, 110], hp: 20, factions: ["chandlers"], fight: FLEES,
    ...d20(12, 14, 14, 16, 14, 18), talk: { dialogue: "merchant" },
    people: ["benchmarkBanker", "saffre", "halfnightBanker", "molarInnkeeper"],
    ...look(APRON, [110, 70, 45], [150, 100, 50], [250, 210, 110]),
  },
  drover: {
    name: "a Drover", title: "of the Drovers", glyph: "@", color: [190, 140, 92], hp: 24, factions: ["drovers"], fight: FLEES,
    ...d20(16, 16, 16, 12, 14, 14), talk: { dialogue: "merchant" },
    people: ["benchmarkDrover", "zaqar", "molarMapSeller"],
    ...look(CLOAK, [60, 45, 35], [150, 110, 70], [210, 180, 120]),
  },
  kiteFolk: {
    name: "a Kite", title: "of the Kites", glyph: "@", color: [176, 214, 236], hp: 16, factions: ["kites"], fight: FLEES,
    ...d20(10, 20, 12, 14, 16, 14), talk: { dialogue: "villager" },
    people: ["kreeva", "featherTrader", "overlookKite"],
    ...look(CLOAK, [230, 230, 235], [150, 190, 220], [255, 255, 255]),
  },
  folioCitizen: {   // met only on the map (bible §5 G): flat, like the Flatfolk of the roads
    name: "a citizen of Folio", title: "of Folio", glyph: "@", color: [110, 124, 226], flat: true, hp: 14, factions: ["flatfolk"], fight: FLEES,
    ...d20(10, 18, 12, 18, 14, 18), w: 0.8, h: 0.1, talk: { dialogue: "villager" },
    people: ["ell", "kay", "doubleEll", "marginKeeper", "folioSurvey", "folioLore"],
  },
  horaryFaithful: {
    name: "one of the Horary", title: "of the Horary", glyph: "@", color: [236, 186, 96], hp: 18, factions: ["horary"], fight: FLEES,
    ...d20(12, 14, 14, 16, 18, 18), talk: { dialogue: "priest" },
    people: ["ilyendra", "horaryTrader"],
    ...look(CLOAK, [200, 150, 70], [215, 160, 70], [255, 230, 140]),
  },
  lamplessFaithful: {
    name: "one of the Lampless", title: "of the Lampless", glyph: "@", color: [128, 110, 170], hp: 18, factions: ["lampless"], darkSight: true, fight: FLEES,
    ...d20(12, 14, 14, 16, 20, 16), talk: { dialogue: "priest" },
    people: ["wisse", "lamplessTrader"],
    ...look(CLOAK, [60, 55, 80], [80, 70, 110], [150, 140, 190]),
  },
  lineCitizen: {
    name: "a citizen of Halfnight", title: "of the Line Court", glyph: "@", color: [204, 198, 172], hp: 22, factions: [], fight: { flee: true, speed: 2.4 },
    ...d20(14, 14, 16, 16, 18, 16), talk: { dialogue: "villager" },
    people: ["gudri"],
    ...look(CLOAK, [120, 110, 100], [170, 160, 130], [200, 170, 90]),
  },
  ghostPerson: {   // seen and talked to only in the dark: your torch out, and no daylight where it stands (creatures.js ghostHidden)
    name: "a ghost", title: "seen only in the dark", glyph: "@", color: [168, 210, 238], ghostly: true, hp: 12, factions: [], fight: FLEES,
    ...d20(8, 16, 10, 14, 20, 16), talk: { dialogue: "wanderer" },
    people: ["thol", "ghostTrader"],
    ...look(CLOAK, [190, 220, 240], [150, 190, 220], [210, 240, 255]),
  },
  planAutomaton: {
    name: "an automaton of the Plan", title: "of the Plan", glyph: "@", color: [176, 198, 210], hp: 30, factions: ["plan"], fight: { stays: true },
    ...d20(18, 12, 20, 20, 16, 4), w: 0.9, h: 1.5, talk: { dialogue: "villager" },
    people: ["sectionNine"],
    art: ENGINE, palette: { L: [[180, 200, 210], 0.1], E: [[120, 220, 255], 1.6], m: [[140, 160, 170], 0], M: [[220, 230, 240], 0] },
  },
  pressedFaithful: {
    name: "one of the Pressed", title: "of the Pressed", glyph: "@", color: [206, 200, 222], hp: 16, factions: ["pressed"], fight: { stays: true },
    ...d20(10, 10, 12, 16, 20, 12), talk: { dialogue: "priest" },
    people: ["bramwyn", "inkSeller", "pressedLibrarian"],
    ...look(SMOCK, [120, 100, 80], [210, 205, 225], [150, 140, 170]),
  },
  pleatwoodWarden: {
    name: "a Pleatwood warden", title: "the Pleatwood's warden", glyph: "@", color: [118, 172, 94], hp: 30, factions: ["pleatwood"],
    fight: { back: true, damage: [3, 6], cooldown: 1.3, reach: 1.6, speed: 2.6, sight: 12 }, ...d20(18, 16, 18, 12, 16, 12), talk: { dialogue: "guard" },
    people: ["lumo"],
    ...look(SPEAR, [70, 55, 40], [90, 130, 70], [160, 190, 110]),
  },
  sporeMooter: {
    name: "one of the Spore Moot", title: "of the Spore Moot", glyph: "@", color: [198, 168, 212], hp: 16, factions: ["sporeMoot"], fight: FLEES,
    ...d20(10, 12, 16, 16, 16, 14), talk: { dialogue: "merchant" },
    people: ["sporeHerbalist"],
    ...look(APRON, [170, 140, 190], [130, 110, 140], [220, 200, 230]),
  },
  speakingTree: {   // Foldmother speaks from the knot at her foot (bible §5 P): it stands, it doesn't walk
    name: "a speaking tree", title: "a speaking tree", glyph: "@", color: [150, 118, 78], statue: true, hp: 90, factions: ["pleatwood"], fight: { stays: true },
    ...d20(24, 4, 28, 18, 26, 22), talk: { dialogue: "priest" },
    people: ["foldmother"],
    art: KNOT, palette: { b: [[110, 85, 55], 0], k: [[150, 118, 78], 0], E: [[200, 240, 150], 1.2], m: [[70, 50, 35], 0] },
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
// Each talks with its role's conversation under its own id (talk.js dispatches on the type's id by default; the
// regions' rows draw the first two into dungeons), until C5 registers its words; Corner is a cat.
const CORNER = (game, c) => node("Corner considers you, then the space beside you, and settles for the space.", [bye()]);
for (const [id, t] of Object.entries(PEOPLE))
  if (!dialogueIds().includes(id)) registerDialogue(id, id === "corner" ? CORNER : buildDialogue(t.talk.dialogue));
