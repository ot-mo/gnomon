// The landmarks' authored data (TECH_DESIGN §2.18 content/world/landmarks.js + plans/*.js; bible §5, §15.3): what
// worldmap.js adds to LANDMARK_INDEX's entry for each landmark that has its plan. C1a: Hollowmere, the start; C1b adds
// the other 15 (until then they stand on stub footprints, gen/surface.js).
//
//   LANDMARKS = [{ id, plan, anchor, flatten, visibleFrom, checkpoint, description, lines, letters }]
//     anchor       the plan's corner in its zone ([x, y]), so its footprint is the plan's size from there
//     description  the Deep line (bible §2.1: what you see in 3D); lines: all three registers, Flat, Deep and Dark
//     letters      who stands on each of the plan's people letters (C5 writes their words; each is placed once its
//                  kind exists: C3, C5). Maren is the temple's own (content/world/temple.js "M")
//   PLANS = { [id]: plan }   (plans/*.js; gen/surface.js stamps a plan through its `stamp` or stampVault)
import { HOLLOWMERE_PLAN } from "./plans/hollowmere.js";
import { DIAL_FLOOR_PLAN } from "./plans/dialFloor.js";
import { KETTLE_MESA_PLAN } from "./plans/kettleMesa.js";
import { BENCHMARK_PLAN } from "./plans/benchmark.js";
import { TALL_TABLE_PLAN } from "./plans/tallTable.js";
import { MOLAR_PLAN } from "./plans/molar.js";

export const LANDMARKS = [
  {
    id: "hollowmere", plan: "hollowmere", anchor: [0, 0], flatten: true, visibleFrom: 2, checkpoint: true,
    description: "Reed roofs, eel smoke, and a squat temple whose walls meet at angles nobody likes.",
    lines: {   // bible §5 A
      flat: "HOLLOWMERE. Stilts 212. Lamps 1 (commons). Cube 1.",
      deep: "Reed roofs, eel smoke, and a squat temple whose walls meet at angles nobody likes.",
      dark: "the floor has been shaking\nsomething under it is counting",
    },
    letters: {   // bible §5 A, "Inhabitants and services"
      a: { who: "mira", name: "Mira", role: "the Survey's cartographer" },
      b: { who: "tamsin", name: "Brother Tamsin", role: "a Horary missionary" },
      c: { who: "brann", name: "Brann", role: "a ghost in the crypt, seen only with your torch out" },
      e: { who: "hallen", name: "Reeve Hallen", role: "the Reeve" },
      i: { who: "ottilie", name: "Old Ottilie", role: "tinker" },
      j: { who: "corwin", name: "Sir Corwin", role: "the village warden" },
      n: { who: "pell", name: "Pell", role: "peddler (days 1-2 of his round)" },
      o: { who: "essAndTee", name: "Ess and Tee", role: "Flatfolk envoys of Folio, only on the map" },
      q: { who: "corner", name: "Corner", role: "the temple cat" },
    },
    holy: "noonVigil",   // the Temple of Angles (C2 #5; the Vigil's rule is only the Cube's altar)
  },
  {
    id: "dialFloor", plan: "dialFloor", anchor: [27, 14], flatten: true, visibleFrom: 1,
    description: "A salt-crusted ring of flagstones round a stone pin, its base carved with a crowd of kneeling people.",
    lines: {   // bible §5 B
      flat: "DIAL FLOOR. Pips 5. Arrow 1, bearing north-east.",
      deep: "A salt-crusted ring of flagstones round a stone pin, its base carved with a crowd of kneeling people.",
      dark: "we were not kneeling\nwe were being pressed",
    },
    letters: {},
  },
  {
    id: "kettleMesa", plan: "kettleMesa", anchor: [23, 6], flatten: true, visibleFrom: 2,
    description: "A hollow mesa like an upturned kettle, open to the sky; every floor a ring of ledges round a drop.",
    lines: {   // bible §5 C
      flat: "KETTLE MESA. Floors 3. Shaft 1.",
      deep: "A hollow mesa like an upturned kettle, open to the sky; every floor a ring of ledges round a drop.",
      dark: "the grubs hum when they dig\nlisten",
    },
    letters: {},
    below: [{ who: "grubMother", name: "the Grub Mother", role: "a legendary brine-grub; she burrows, and her tunnel shows on the map as disturbed ground", floor: 3 }],
  },
  {
    id: "benchmark", plan: "benchmark", anchor: [8, 5], flatten: true, visibleFrom: 2, checkpoint: true,
    description: "A walled station of brass instruments around a grey pillar cut with a single level line.",
    lines: {   // bible §5 D
      flat: "BENCHMARK. Towers 6. Mark: 0.",
      deep: "A walled station of brass instruments around a grey pillar cut with a single level line.",
      dark: "the pillar is older than the line\nthe line was cut to lie",
    },
    letters: {   // bible §5 D, "Inhabitants and services"
      t: { who: "quintVey", name: "Surveyor-General Teodor Quint-Vey", role: "the Survey's head" },
      a: { who: "saaraTovi", name: "Saara Tovi", role: "instrument-master (the tinker)" },
      e: { who: "benchmarkLeech", name: "the leech", role: "healer" },
      c: { who: "detailC", name: "Detail C", role: "an automaton on loan from the Plan; works Truing Cradle #1" },
      b: { who: "benchmarkBanker", name: "the Chandler banker", role: "a Chandler bank" },
      d: { who: "benchmarkDrover", name: "the caravan-master", role: "the Drovers' caravan stop" },
      n: { who: "pell", name: "Pell", role: "peddler (days 3-4 of his round)" },
    },
  },
  {
    id: "tallTable", plan: "tallTable", anchor: [20, 12], flatten: true, visibleFrom: 3,
    description: "A mesa sheer on every side, chimes ringing at the top in a wind you can't feel down here.",
    lines: {   // bible §5 E
      flat: "TALL TABLE. Height: not recorded.",
      deep: "A mesa sheer on every side, chimes ringing at the top in a wind you can't feel down here.",
      dark: "there is a stair\nit only comes out at night",
    },
    letters: {   // on the top, 12 blocks up: reached only by the climb in 3D (bible §5 E)
      K: { who: "kreeva", name: "Kreeva Old-Wing", role: "the Kite elder (legendary); teaches Tumbling" },
      T: { who: "featherTrader", name: "the feather-trader", role: "sells the feather cloak (+250 Kites)" },
      O: { who: "overlook", name: "the overlook", role: "buy the Kites' view reading: every span within 6 on the world map" },
    },
  },
  {
    id: "molar", plan: "molar", anchor: [8, 3], flatten: true, visibleFrom: 2, checkpoint: true,
    description: "A caravanserai hollowed out of one enormous tooth, its gullet full of longbacks and argument.",
    lines: {   // bible §5 F
      flat: "MOLAR. Gate 1. Toll: 40.",
      deep: "A caravanserai hollowed out of one enormous tooth, its gullet full of longbacks and argument.",
      dark: "the canals under the tooth are older than the toll\nso are we",
    },
    letters: {   // bible §5 F, "Inhabitants and services"
      s: { who: "saffre", name: "Mother Saffre", role: "factor of Chandler House Saffre: the toll, the bank, the clear-glim exchange" },
      z: { who: "zaqar", name: "Zaqar Tesfu of Nine Longbacks", role: "Drover caravan-master: the market, longback hire (× 1.5 travel)" },
      c: { who: "castor", name: "Assizer Castor Dell-Cassin", role: "from beat 2: the checkpoint that turns back the Bent and seizes Deepwright contraband" },
      r: { who: "rook", name: "Rook", role: "bounty hunter: the bounty board, named legendaries for glim" },
      i: { who: "molarInnkeeper", name: "the innkeeper", role: "the inn: rest" },
      m: { who: "molarMapSeller", name: "the map-seller", role: "readings" },
      n: { who: "pell", name: "Pell", role: "peddler (days 5-6 of his round)" },
    },
  },
];

export const PLANS = { hollowmere: HOLLOWMERE_PLAN, dialFloor: DIAL_FLOOR_PLAN, kettleMesa: KETTLE_MESA_PLAN, benchmark: BENCHMARK_PLAN, tallTable: TALL_TABLE_PLAN, molar: MOLAR_PLAN };
