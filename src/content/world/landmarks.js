// The landmarks' authored data (TECH_DESIGN §2.18 content/world/landmarks.js + plans/*.js; bible §5, §15.3): what
// worldmap.js adds to LANDMARK_INDEX's entry for each landmark: C1a Hollowmere, the start; C1b the other 15.
//
//   LANDMARKS = [{ id, plan, spanPlans?, anchor, flatten, visibleFrom, checkpoint, description, lines, letters, below?, holy? }]
//     spanPlans    a multi-span landmark's other spans' plans, { "wx,wy": planId } (Halfnight's Middle and East Wards;
//                  integration request: gen/surface.js stamps only `plan`, on the landmark's own span)
//     anchor       the plan's corner in its zone ([x, y]), so its footprint is the plan's size from there (every plan
//                  of a landmark is anchored the same)
//     visibleFrom  how many spans away it is known (overworld/discovery.js); checkpoint: a settlement's (commonsLamp)
//     description  the Deep line (bible §2.1: what you see in 3D); lines: all three registers, Flat, Deep and Dark
//     letters      who stands on each of the plans' people letters (C5 writes their words; each is placed once its
//                  kind exists: C3, C5; `kind` names C3's creature where its tag p3-c3 has one). Maren is the temple's own
//                  (content/world/temple.js "M")
//     below        who lives in its dungeon, [{ who, name, role, floor | up }] (C3's kinds, C5's words: the dungeon's
//                  floors are generated, so they are placed by code once their kinds exist)
//     holy         the faction whose holy place its surface is (C2 #5: a neutral member hostile there below Warm, and
//                  its rule), or { "wx,wy": factionId } span by span; holyFloors { floor: factionId }, its dungeon's floors
//                  that are (the Pressyard's is its surface mosaic alone: the Press below is the Assize's works). A plan's
//                  `areas` are finer: [{ faction, rule, rect }] in the plan (Halfnight's rows, Molar's checkpoint,
//                  Benchmark's Cradle), and its `steles` the dial-steles with their carved hours
//   PLANS = { [id]: plan }   (plans/*.js; gen/surface.js stamps a plan through its `stamp` or stampVault; a plan's
//                             `texts` are its carvings' words, for check-content's count)
import { HOLLOWMERE_PLAN } from "./plans/hollowmere.js";
import { DIAL_FLOOR_PLAN } from "./plans/dialFloor.js";
import { KETTLE_MESA_PLAN } from "./plans/kettleMesa.js";
import { BENCHMARK_PLAN } from "./plans/benchmark.js";
import { TALL_TABLE_PLAN } from "./plans/tallTable.js";
import { MOLAR_PLAN } from "./plans/molar.js";
import { FOLIO_PLAN } from "./plans/folio.js";
import { HALFNIGHT_WEST_PLAN, HALFNIGHT_MIDDLE_PLAN, HALFNIGHT_EAST_PLAN } from "./plans/halfnight.js";
import { PRESSYARD_PLAN } from "./plans/pressyard.js";
import { UNLIT_CHOIR_PLAN } from "./plans/unlitChoir.js";
import { METRONOME_PLAN } from "./plans/metronome.js";
import { DROWNED_LANTERN_PLAN } from "./plans/drownedLantern.js";
import { SQUARE_PLAN } from "./plans/square.js";
import { GNOMON_PLAN } from "./plans/gnomon.js";
import { SALTPAGE_PLAN } from "./plans/saltpage.js";
import { FOLDMOTHER_PLAN } from "./plans/foldmother.js";

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
      c: { who: "detailC", kind: "detailC", name: "Detail C", role: "an automaton on loan from the Plan; works Truing Cradle #1" },
      b: { who: "benchmarkBanker", name: "the Chandler banker", role: "a Chandler bank" },
      d: { who: "benchmarkDrover", name: "the caravan-master", role: "the Drovers' caravan stop" },
      n: { who: "pell", name: "Pell", role: "peddler (days 3-4 of his round)" },
      g: { who: "benchmarkSignaller", name: "the signaller", role: "keeps the Signal Room, which shows the Hand on the world map" },
      m: { who: "mapRoomSurveyor", name: "the Map Room's surveyor", role: "sells Location readings and shows the tier layer" },
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
      O: { who: "overlookKite", name: "the Kite at the overlook", role: "sells the Kites' view reading: every span within 6, on the world map" },
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
  {
    id: "folio", plan: "folio", anchor: [9, 6], flatten: true, visibleFrom: 1, checkpoint: true,
    description: "An empty paved plain, and several hundred shadows sliding over the stones with nobody casting them.",
    lines: {   // bible §5 G
      flat: "FOLIO. Streets 31. Inn: the Margin. Archive 1.",
      deep: "An empty paved plain, and several hundred shadows sliding over the stones with nobody casting them.",
      dark: "the scratching is writing\nthey are writing you down",
    },
    letters: {   // bible §5 G: Flatfolk, met only on the map
      e: { who: "ell", name: "Ell, once the Flat Queen", role: "Folio's magistrate (\"a person now\"); keeps the Margin court; gives Folio's side quest" },
      k: { who: "kay", name: "Kay of the Long Line", role: "archivist (legendary): buys deep readings, sells the Flat Accounts of every Hour" },
      l: { who: "doubleEll", name: "Double-Ell", role: "merchant: ink, stencils, maps" },
      m: { who: "marginKeeper", name: "the Margin's keeper", role: "the Margin: rest" },
      s: { who: "folioSurvey", name: "the teacher of Survey", role: "teaches Survey" },
      o: { who: "folioLore", name: "the teacher of Lore", role: "teaches Lore" },
    },
  },
  {
    // Three spans, a plan each: `plan` is the West Ward's (the landmark's own span, which gen/surface.js stamps today);
    // spanPlans the other two wards' (integration request: a multi-span landmark's other spans on their own plans).
    id: "halfnight", plan: "halfnightWest", spanPlans: { "25,11": "halfnightMiddle", "26,11": "halfnightEast" },
    anchor: [6, 2], flatten: true, visibleFrom: 1, checkpoint: true,
    description: "Sundials on one side of the street, shuttered cells on the other, and a brass line down the middle that nobody steps on.",
    lines: {   // bible §5 H
      flat: "HALFNIGHT. Length 3 spans. Width 1 street. Line 1.",
      deep: "Sundials on one side of the street, shuttered cells on the other, and a brass line down the middle that nobody steps on.",
      dark: "the north side is listening\nthe south side is ringing",
    },
    letters: {   // bible §5 H, by ward
      p: { who: "ilyendra", name: "Primate Ilyendra", role: "of the Horary, in the Hour-house (West Ward); teaches Lore" },
      g: { who: "gudri", name: "Linekeeper Hasay Gudri", role: "the city's reeve, at the Line Court (Middle Ward)" },
      b: { who: "halfnightBanker", name: "the Chandler banker", role: "a Chandler bank (Middle Ward)" },
      q: { who: "horaryTrader", name: "a Horary trader", role: "the Horary's readings (Middle Ward)" },
      w: { who: "lamplessTrader", name: "a Lampless trader", role: "the Lampless' readings (Middle Ward)" },
      a: { who: "wisse", name: "Abbess Wisse", role: "of the Lampless, in the Hush (East Ward); teaches Shadowcraft" },
      v: { who: "ghostTrader", name: "a ghost trader", role: "the ghost market (East Ward): seen only with your torch out, at night" },
    },
    holy: { "24,11": "horary", "26,11": "lampless" },   // the Hour-house, the Hush (C2 #5)
  },
  {
    id: "pressyard", plan: "pressyard", anchor: [9, 5], flatten: true, visibleFrom: 1,
    description: "Faded tiles in a field, and a stair going down where a well should be.",
    lines: {   // bible §5 I
      flat: "PRESSYARD. Houses 41. People 300, all mid-stride. Well 1 (stair).",
      deep: "Faded tiles in a field, and a stair going down where a well should be.",
      dark: "they are still walking\nthe floor is very tight",
    },
    letters: {},
    below: [{ who: "pressMaster", name: "Press-Master Sevrin Marr-Orrum", role: "the Press's master, who fights beside the Press: its three pistons stand on gantries 3 to 5 blocks up, and they keep the beat", floor: 5 },
            { who: "toviHallen", name: "Tovi Hallen", role: "a Survey engineer, the Reeve's son, pressed flat; he knows how the Press is stopped", floor: 3 },
            { who: "assizeEngineer", name: "Assize engineers", role: "with press-hounds, mosaic golems, pressed captives and errata at the margins", floor: 1 }],
    holy: "pressed",   // the Pressyard's surface mosaic (FAITHS.pressed; beyond C2's six)
  },
  {
    id: "unlitChoir", plan: "unlitChoir", anchor: [14, 9], flatten: true, visibleFrom: 1,
    description: "A cathedral sunk to its shoulders in the dusk, full of a song that doesn't come from anywhere.",
    lines: {   // bible §5 J
      flat: "UNLIT CHOIR. Floors 6. Lamps 0.",
      deep: "A cathedral sunk to its shoulders in the dusk, full of a song that doesn't come from anywhere.",
      dark: "we sing\nso you can find the stairs",
    },
    letters: {   // bible §5 J
      t: { who: "thol", name: "thol", role: "the choirmaster ghost (seen only with your torch out)" },
      c: { who: "lamplessChanter", kind: "lamplessChanter", name: "a Lampless chanter", role: "keeps the song" },
    },
    below: [{ who: "gloamWarden", kind: "gloamWarden", name: "the Gloam Warden", role: "the warden of the dark floors, seen only in the dark; braziers hurt it", floor: 4 },
            { who: "noon", name: "Noon", role: "a flat ghost, only on the map and only with your torch out: a mosaic of a woman with no shadow", floor: 6 }],
    holy: "lampless",   // a lit torch inside is trespass, unless you carry the dark-pass (FAITHS.lampless; beyond C2's six)
    holyFloors: { 1: "lampless", 2: "lampless", 3: "lampless", 4: "lampless", 5: "lampless", 6: "noonVigil" },   // floor 6: where Noon lies (FAITHS.noonVigil)
  },
  {
    id: "metronome", plan: "metronome", anchor: [12, 4], flatten: true, visibleFrom: 2,
    description: "A tower of iron floors threaded on a pendulum that never stops.",
    lines: {   // bible §5 K
      flat: "METRONOME. Floors 6. Beat: 2 per second.",
      deep: "A tower of iron floors threaded on a pendulum that never stops.",
      dark: "tick\ntick\nit has been counting to something",
    },
    letters: {   // bible §5 K
      s: { who: "sectionNine", name: "Section Nine", role: "Chief Draughtsman (legendary automaton)" },
      d: { who: "draughtsman", kind: "draughtsman", name: "a draughtsman", role: "of the Plan" },
    },
    below: [{ who: "escapement", kind: "escapement", name: "the Escapement", role: "a brass colossus with its core on its head, reached by the pendulum's gantries 5 blocks up; the map shows where it will slam", floor: 6 }],
    holy: "plan",   // bombing walls here is desecration (C2 #5)
    holyFloors: { 1: "plan", 2: "plan", 3: "plan", 4: "plan", 5: "plan", 6: "plan" },
  },
  {
    id: "drownedLantern", plan: "drownedLantern", anchor: [0, 5], flatten: true, visibleFrom: 3,
    description: "A lighthouse standing in glass up to its knees, its lamp long dead.",
    lines: {   // bible §5 L
      flat: "DROWNED LANTERN. Floors 5, below sea. Water: by the hour.",
      deep: "A lighthouse standing in glass up to its knees, its lamp long dead.",
      dark: "the bell still rings\nunder the water\nfor the noon",
    },
    letters: {},
    below: [{ who: "drownedBellwether", kind: "drownedBellwether", name: "the Drowned Bellwether", role: "a legendary bell-headed ghost whose toll forces every flat thing deep for 3 s", floor: 5 },
            { who: "noonglass", name: "the Noonglass", role: "the relic on a dais that is dry only at noon", floor: 5 }],
  },
  {
    id: "square", plan: "square", anchor: [18, 2], flatten: true, visibleFrom: 2,
    description: "A clearing cut perfectly square out of the folding forest, the stumps in rows, and in the middle a cube with no windows.",
    lines: {   // bible §5 M
      flat: "THE SQUARE. Sides 4, equal. Rooms 144, equal.",
      deep: "A clearing cut perfectly square out of the folding forest, the stumps in rows, and in the middle a cube with no windows.",
      dark: "every room is the same room\nexcept the one you are in",
    },
    letters: {   // the gate (bible §5 M: Plumb characters are let in at the gate)
      g: { who: "gateAssizer", kind: "assizer", name: "the gate's assizer", role: "lets the Plumb in" },
    },
    below: [{ who: "strade", name: "Hierarch Aurel Strade-Orrum", role: "the Assize's head", up: 2 },
            { who: "lio", name: "Lio", role: "a pressed prisoner in the cells (map only)", floor: 2 },
            { who: "plumbknight", kind: "plumbknight", name: "plumbknights and assizers", role: "patrols in dead-straight lines", floor: 1 }],
    holy: "assize",   // a Bent below Bright is trespass (C2 #5)
    holyFloors: { 1: "assize", 2: "assize", 3: "assize" },
  },
  {
    id: "gnomon", plan: "gnomon", anchor: [25, 14], flatten: true, visibleFrom: 42,   // seen from every span (bible §4.12)
    description: "A black needle leaning over the world, so tall that the top of it is weather.",
    lines: {   // bible §5 N
      flat: "GNOMON. Height: off the page. Shadow: 15.5 spans at noon, and lengthening.",
      deep: "A black needle leaning over the world, so tall that the top of it is weather.",
      dark: "the works are turning\nthe works are always turning",
    },
    letters: {},
    below: [{ who: "vesper", kind: "vesper", name: "Vesper", role: "waits in the Noon Socket, where the age's hand is set", floor: 8 }],
  },
  {
    id: "saltpage", plan: "saltpage", anchor: [7, 4], flatten: true, visibleFrom: 1, checkpoint: true,
    description: "A salt pan so flat your footsteps come back off the horizon.",
    lines: {   // bible §5 O
      flat: "SALTPAGE. Storeys 1. Page 1 (city, drowned, 9 × 9 spans of mosaic).",
      deep: "A salt pan so flat your footsteps come back off the horizon.",
      dark: "the page is a city\nthe city is reading you back",
    },
    letters: {   // bible §5 O
      b: { who: "bramwyn", name: "Father Bramwyn the Flattened", role: "the Pressing rite: for a world day, once a floor, you may turn flat for 3 s (free at Pressed ≥ +250, else −100 with the Pressed)" },
      i: { who: "inkSeller", name: "the ink-and-brine seller", role: "ink and brine" },
      y: { who: "pressedLibrarian", name: "the librarian", role: "the Pressed's library of flat readings" },
    },
    below: [{ who: "speakingDoor", name: "the Speaking Door", role: "guards floor 2: it asks for the number written upon its floor", floor: 2 },
            { who: "secondHourStele", name: "a Second-Hour stele", role: "all three accounts, the Pressed's founding relic and a reading that names Vesper", floor: 3 }],
    holy: "pressed",   // the monastery and the Page (C2 #5)
    holyFloors: { 1: "pressed", 2: "pressed", 3: "pressed" },   // the Under-Page, where their founding relic lies
  },
  {
    id: "foldmother", plan: "foldmother", anchor: [20, 5], flatten: true, visibleFrom: 3, checkpoint: true,
    description: "A tree as tall as a mesa, pleated like a paper lantern, with houses in the pleats.",
    lines: {   // bible §5 P
      flat: "FOLDMOTHER. Platforms 30 (day), 0 (night).",
      deep: "A tree as tall as a mesa, pleated like a paper lantern, with houses in the pleats.",
      dark: "at dusk she closes\nlike a hand\ncount your children",
    },
    letters: {   // bible §5 P
      m: { who: "foldmother", name: "Foldmother", role: "a speaking tree (legendary): the knot at her foot where she speaks" },
      w: { who: "lumo", name: "Warden Lumo", role: "the Pleatwood's warden" },
      e: { who: "sporeHerbalist", name: "the Spore Moot's herbalist", role: "tonics, and fungal limbs for reputation" },
    },
  },
];

export const PLANS = {
  hollowmere: HOLLOWMERE_PLAN, dialFloor: DIAL_FLOOR_PLAN, kettleMesa: KETTLE_MESA_PLAN, benchmark: BENCHMARK_PLAN, tallTable: TALL_TABLE_PLAN,
  molar: MOLAR_PLAN, folio: FOLIO_PLAN, halfnightWest: HALFNIGHT_WEST_PLAN, halfnightMiddle: HALFNIGHT_MIDDLE_PLAN, halfnightEast: HALFNIGHT_EAST_PLAN,
  pressyard: PRESSYARD_PLAN, unlitChoir: UNLIT_CHOIR_PLAN, metronome: METRONOME_PLAN, drownedLantern: DROWNED_LANTERN_PLAN, square: SQUARE_PLAN,
  gnomon: GNOMON_PLAN, saltpage: SALTPAGE_PLAN, foldmother: FOLDMOTHER_PLAN,
};
