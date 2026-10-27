// Factions (TECH_DESIGN §2.11 FactionDef: { id, name, color, temperament, startRep, homeRegions, members,
// likes, hates, relations: { [otherId]: -1 | 0 | 1 }, sacred, voice, secrets: { buys, sells }, merchantTable,
// flat? }; §2.18; WS6a, then C2). The 21 fixed factions of bible §6.2 and §15.4, their hidden parent groups
// (§6.1), and the Bent villages (one pool for every generated Bent village until WS7 gives each its own).
// Each is registered with factions.js registerFaction when this file loads.
//
//   FACTIONS[id] = { name, parent, temperament, startRep: { bent, plumb }, color, glyph, liquid, rite, voice,
//                    about, likes: [[id, why]], hates: [[id, why]], pilgrimFloor?, hidden?, flat?, homeRegions }
//   GROUPS[id]   = the hidden parents (peoples, faiths, plane, dark, engines, beasts, growths, askew, and the Bent
//                  under the peoples: Hollowmere and the Bent villages, whom the Assize hates by birth): never
//                  shown, never a rep of their own; a relation to a group holds for everything under it
//
// likes and hates become relations (+1 / −1, factions.js) and are what the factions screen lists; the reasons
// are the bible's. A hate that isn't a faction ("the Bent", "their own originals") is in `hatesToo` as text.
// startRep is the bible's "Start (Bent / Plumb)". pilgrimFloor: false for the factions Pilgrim leaves below zero
// (bible §3.5: the Askew and the Hour cults). voice is bible §15.4's, for WS6b's voices.js.
import { registerFaction } from "../factions.js";

const both = (n) => ({ bent: n, plumb: n });

export const GROUPS = {
  peoples: { name: "the peoples" }, bent: { name: "the Bent", parent: "peoples" }, faiths: { name: "the faiths" }, plane: { name: "the Plane" }, dark: { name: "the Dark" },
  engines: { name: "the engines" }, beasts: { name: "the beasts" }, growths: { name: "the growths" }, askewGroup: { name: "the Askew" },
};

export const FACTIONS = {
  hollowmere: {
    name: "Hollowmere", parent: "bent", temperament: "docile", startRep: both(100), color: [120, 170, 110], glyph: "@",
    liquid: "glim", rite: "deep", voice: { hz: 255, wave: "triangle" }, homeRegions: ["A"],
    about: "A village of the Bent, and a few Plumb, on the Brine Flats. They keep the Temple of Angles.",
    likes: [["noonVigil", "they keep our temple"], ["clatter", "good neighbours, bad jokes"], ["survey", "Mira's maps found the eel weirs"]],
    hates: [["rustbacks", "they raid the reed beds"], ["assize", "they've been digging under the temple"]],
  },
  noonVigil: {
    name: "the Noon Vigil", parent: "faiths", temperament: "docile", startRep: both(50), color: [240, 220, 150], glyph: "@",
    liquid: "freshWater", rite: "deep", voice: { hz: 270, wave: "triangle" }, homeRegions: ["A", "H"],
    about: "A faith that keeps the noon-posts and the Temple of Angles. Fresh water, clear as noon.",
    likes: [["hollowmere", "the keepers' village"], ["flatfolk", "they kept Noon's true account"]],
    hates: [["lampless", "they pray to her shadow"], ["horary", "they call her a thief"], ["assize", "they want the Cube"]],
  },
  survey: {
    name: "the Survey", parent: "peoples", temperament: "neutral", startRep: both(0), color: [200, 170, 90], glyph: "@",
    liquid: "freshWater", rite: "deep or flat", voice: { hz: 300, wave: "square", flags: ["beat"] }, homeRegions: ["D"],
    about: "A guild of tinker-cartographers out of Benchmark. They will take a Tracing too: mapmakers.",
    likes: [["flatfolk", "perfect maps"], ["plan", "the blueprints"], ["kites", "the view from above"]],
    hates: [["rustbacks", "they steal instruments"], ["askew", "they ruin measurements by existing"]],
  },
  assize: {
    name: "the Plumb Assize", parent: "peoples", temperament: "aggressive", startRep: { bent: -700, plumb: -100 },
    color: [150, 170, 200], glyph: "K", liquid: "quicksilver", rite: "deep", voice: { hz: 120, wave: "square" }, homeRegions: ["M", "F"],
    about: "A zealot order of pure-born judges, sitting in the Square. Quicksilver: it always finds the level.",
    likes: [["plan", "straight and obedient"], ["chandlers", "they fund us"], ["horary", "the dial must turn"]],
    hates: [["bent", "crooked lines"], ["flatfolk", "unfinished people"], ["askew", ""], ["rustbacks", ""], ["errata", "errors to be corrected"]],
  },
  horary: {
    name: "the Horary", parent: "faiths", temperament: "neutral", startRep: both(0), color: [230, 170, 60], glyph: "H",
    liquid: "sunwine", rite: "deep, at the stele's hour", voice: { hz: 420, wave: "triangle", flags: ["vibrato"] }, homeRegions: ["H"],
    about: "The faith of the Hours, with an Hour-house in Halfnight and a dial by every road.",
    likes: [["kites", "birds of the high sun"], ["plan", "it built the dials with us"]],
    hates: [["lampless", "across the Line"], ["noonVigil", "Noon stole the hour"]],
    likesToo: ["the Hour cults: misguided fellow believers"],
  },
  pressed: {
    name: "the Pressed", parent: "faiths", temperament: "docile", startRep: both(-50), color: [220, 220, 230], glyph: "@",
    liquid: "brine", rite: "flat", voice: { hz: 150, wave: "sine" }, homeRegions: ["O"],
    about: "The Church of the Plane. They hold that pressing is a gift.",
    likes: [["flatfolk", "saints"], ["unlit", "they are also past the deep"]],
    hates: [["kites", "for flying"], ["plan", "it builds upward"], ["assize", "they press as punishment; pressing is a gift"]],
  },
  lampless: {
    name: "the Lampless", parent: "faiths", temperament: "neutral", startRep: both(-100), color: [110, 90, 150], glyph: "N",
    liquid: "umbra", rite: "dark", voice: { hz: 110, wave: "sine", flags: ["ghost"] }, homeRegions: ["H", "J"],
    about: "A choir of the dark, east of the Line. They sing at the Hushes with their lamps poured out.",
    likes: [["unlit", "their company"], ["pressed", "fellow quiet ones"]],
    hates: [["moths", "they worship light"], ["chandlers", "they sell it"], ["horary", "across the Line"]],
  },
  drovers: {
    name: "the Salt Drovers", parent: "peoples", temperament: "neutral", startRep: both(0), color: [220, 150, 60], glyph: "@",
    liquid: "longbackMilk", rite: "deep", voice: { hz: 165, wave: "sawtooth" }, homeRegions: ["F"],
    about: "Caravan merchants of the Steps and Waste roads.",
    likes: [["clatter", "trade partners"], ["chandlers", "credit"], ["kites", "scouts"]],
    hates: [["rustbacks", "they raid caravans"], ["assize", "tolls and searches"]],
  },
  chandlers: {
    name: "the Chandler Houses", parent: "peoples", temperament: "neutral", startRep: both(-50), color: [250, 210, 90], glyph: "J",
    liquid: "clearGlim", rite: "deep", voice: { hz: 330, wave: "square" }, homeRegions: ["F", "H"],
    about: "Lamp-oil barons. Every lit wick pays a House something.",
    likes: [["assize", "order and supply"], ["moths", "customers"], ["drovers", "they carry the oil"]],
    hates: [["lampless", "they won't buy light"], ["rustbacks", "they steal it"]],
  },
  rustbacks: {
    name: "the Rustbacks", parent: "peoples", temperament: "aggressive", startRep: both(-450), color: [180, 90, 50], glyph: "g",
    liquid: "blood", rite: "deep", voice: { hz: 130, wave: "sawtooth", flags: ["grit"] }, homeRegions: [],
    about: "Scavenger clans of the Steps, the Downs and the edges of the Stacks.",
    likes: [["saltbeasts", "we ride the brinehogs"]],
    hates: [["drovers", "prey"], ["plan", "it guards the ruins"], ["survey", "it fences them off"]],
  },
  flatfolk: {
    name: "the Flatfolk", parent: "plane", temperament: "docile", startRep: both(0), color: [90, 110, 200], glyph: "@", flat: true,
    liquid: "ink", rite: "flat only", voice: { hz: [430, 560], wave: "square", flags: ["thin"] }, homeRegions: ["G"],
    about: "The people of the Plane, in Folio and the Tessellate. From above they are the whole of themselves.",
    likes: [["survey", "good maps"], ["pressed", "devotees"], ["noonVigil", "they keep Noon's memory"]],
    hates: [["assize", "they press people as punishment"], ["askew", "they crumple the Plane"], ["errata", "bad copies of good lines"]],
  },
  unlit: {
    name: "the Unlit", parent: "dark", temperament: "neutral", startRep: both(0), color: [200, 220, 255], glyph: "U",
    liquid: "any, poured", rite: "dark only", voice: { hz: 205, wave: "triangle", flags: ["ghost"] }, homeRegions: [],
    about: "Ghosts. They show only where the light doesn't reach.",
    likes: [["lampless", "they keep us company"], ["noonVigil", "they pray for us"]],
    hates: [["moths", "they eat ghost-stuff"], ["chandlers", "they light everything"]],
  },
  askew: {
    name: "the Askew", parent: "askewGroup", temperament: "aggressive", startRep: both(-500), color: [220, 80, 220], glyph: "A",
    liquid: "turnwater", rite: "none", voice: { hz: 300, wave: "triangle", flags: ["glide"] }, homeRegions: [], pilgrimFloor: false,
    about: "Living wrong angles, out of the Lattice.",
    likes: [["pleatwood", "fellow folders"], ["sporeMoot", "it has no corners"]],
    hates: [["assize", "for being square"], ["survey", "for measuring"], ["plan", "for its straight lines"]],
  },
  plan: {
    name: "the Plan", parent: "engines", temperament: "neutral", startRep: { bent: -100, plumb: 100 }, color: [160, 180, 190], glyph: "R",
    liquid: "glim", rite: "deep or flat", voice: { hz: [180, 260], wave: "square", flags: ["beat"] }, homeRegions: ["K"],
    about: "A machine faith of automata, at the Metronome and in the Stacks.",
    likes: [["survey", "accuracy"], ["assize", "clear orders"], ["horary", "the dials we built together"]],
    hates: [["rustbacks", "they strip ruins"], ["askew", "unbuildable"], ["sporeMoot", "rot"]],
  },
  moths: {
    name: "the Lantern Moths", parent: "beasts", temperament: "docile", startRep: both(300), color: [250, 240, 170], glyph: "m",
    liquid: "glim", rite: "deep, Moon-Wick only", voice: { hz: 700, wave: "sine", flags: ["tremolo"] }, homeRegions: [],
    about: "Animals. They gather wherever lamps burn.",
    likes: [["chandlers", ""]], likesToo: ["you, while your torch is lit"],
    hates: [["lampless", "they put the light out"], ["unlit", "they put the light out"]],
  },
  kites: {
    name: "the Kites", parent: "beasts", temperament: "neutral", startRep: both(-100), color: [130, 170, 220], glyph: "v",
    liquid: "freshWater", rite: "deep, 8 blocks up or more", voice: { hz: 600, wave: "square" }, homeRegions: ["E"],
    about: "Uplifted birds of the Tall Table and the Teeth.",
    likes: [["survey", "they share our view"], ["drovers", "scraps"]],
    hates: [["pressed", "they hate height"], ["assize", "they shoot us for sport"]],
  },
  clatter: {
    name: "the Clatter", parent: "beasts", temperament: "docile", startRep: both(50), color: [230, 120, 90], glyph: "c",
    liquid: "brine", rite: "deep", voice: { hz: 150, wave: "square", flags: ["grit"] }, homeRegions: [],
    about: "Uplifted crab-folk of the Flats and the Glass shore.",
    likes: [["drovers", "trade partners"], ["hollowmere", "neighbours"]],
    hates: [["saltbeasts", "brinehogs eat crabs"], ["rustbacks", ""]],
  },
  saltbeasts: {
    name: "the Saltbeasts", parent: "beasts", temperament: "aggressive", startRep: both(-400), color: [150, 120, 90], glyph: "",
    liquid: "blood", rite: "deep, Herdmothers only", voice: null, homeRegions: [],
    about: "Wild animals: brinehogs, cairn hounds, ledgehorns, saltrats, dusk bats.",
    likes: [["rustbacks", "they ride us"]],
    hates: [["drovers", "they herd us"], ["clatter", "food"]],
  },
  sporeMoot: {
    name: "the Spore Moot", parent: "growths", temperament: "neutral", startRep: both(-200), color: [190, 120, 200], glyph: "F",
    liquid: "mulchWine", rite: "dark", voice: { hz: 95, wave: "sine" }, homeRegions: ["P"],
    about: "A fungal parliament in the Pleatwood groves. It sits in session for years.",
    likes: [["pleatwood", "we feed it, it feeds us"], ["unlit", "their patience"]],
    hates: [["chandlers", "they burn things"], ["plan", "it is sterile"]],
  },
  pleatwood: {
    name: "the Pleatwood", parent: "growths", temperament: "docile", startRep: both(0), color: [60, 140, 80], glyph: "♣",
    liquid: "sap", rite: "deep, at dusk", voice: { hz: 70, wave: "sawtooth", flags: ["stone"] }, homeRegions: ["P"],
    about: "Folding trees, from the Pleatwood to the Deep Pleat.",
    likes: [["sporeMoot", ""], ["kites", "they nest in us"], ["askew", "fellow folders"]],
    hates: [["assize", "they cut down the Square"], ["chandlers", "they burn wood for their presses"]],
  },
  errata: {
    name: "the Errata", parent: "plane", temperament: "neutral", startRep: both(-250), color: [200, 200, 215], glyph: "E",
    liquid: "turnwater", rite: "deep, then flat", voice: { hz: 300, wave: "triangle", flags: ["doubled"] }, homeRegions: ["I"],
    about: "Misprinted doubles, along the Glass shore and the edges of the Tessellate.",
    likes: [["askew", "they understand angles"], ["unlit", "two of everything in the dark"]],
    hates: [["assize", "they would correct us"], ["flatfolk", "they call us smudges"]],
    hatesToo: ["their own originals, always"],
  },
  // Every generated Bent village shares this pool until WS7 gives each village its own faction (whose
  // members can carry it as a second membership). The Assize writ and the Aspirant of the Rule move it.
  bentVillages: {
    name: "the Bent villages", parent: "bent", temperament: "docile", startRep: both(0), color: [150, 160, 110], glyph: "@",
    liquid: "glim", rite: "deep", voice: null, homeRegions: [],
    about: "The small villages of the Bent, wherever there is reed, salt or shade enough.",
    likes: [["hollowmere", "the old village"]],
    hates: [["assize", "they come with writs"]],
  },
};

for (const [id, def] of Object.entries(GROUPS)) registerFaction(id, { ...def, hidden: true, group: true, likes: [], hates: [] });
for (const [id, def] of Object.entries(FACTIONS)) registerFaction(id, def);
