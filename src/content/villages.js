// Village cultures (TECH_DESIGN §2.16 culture: { sacredLiquid, sacred, profane, dish, style, phonemes }, roles,
// building plans; bible §9; WS7, then C2): what story/villages.js generateVillage draws from. Data only.
//
//   VILLAGES.events       bible §9.3's 14 history events of a village: { id, text, abandon (1 in 20), gov?, cruel?, mood }
//                         text is a sentence with {name}, {sacred}, {people}, {neighbour}, {hour}, {mutation}
//   VILLAGES.governments  §9.3's 8: { id, name, leader (the role's title), dialogue (WS6a ROLES id) }
//   VILLAGES.sacred, profane, activities, proverbs, dishes, skills, liquids   §9.3's pools ({…} slots in proverbs)
//   VILLAGES.shrines      §9.2: mosaic (the map), relief (3D in light), rune (the dark), pillar (3D: its height)
//   VILLAGES.peoples      §9.3 "Founding peoples": { id, name, faction (WS6a's id, a second membership), parent: "bent" | "peoples" }
//   VILLAGES.byTerrain    a span's region (bible §9.3's, by C1a's region ids, docs/c1.md: the terrain's id where the
//                         two coincide, `glassShore` for the Glass shore) → [people ids], style id; the test world's
//                         fixture terrains borrow the nearest. story/villages.js looks the terrain up first, so a
//                         Glass-shore village needs the region first (integration request); docs/c2.md lists the ids
//   VILLAGES.styles       §9.4 architecture: { name, wall, floor, roof, lamp ("lamp" | "dark"), ground }; block keys of blocks.js;
//                         C2 adds what the builder doesn't stamp yet (integration request): heights { stilts, ledges,
//                         canopy, storeys, sunk, cliff } in blocks, and the style's flags (boardwalks, cistern,
//                         barrow, bridges, shaft, mapOnly, realInn, seeThrough, runeDoors, windows) and `views`,
//                         how it plays in each view
//   VILLAGES.plans        building plans in the vault letter format (gen/vaults.js): # wall, . floor, D door, l lamp
//                         in the wall, M the lintel over the door (a carved panel: the Deep Inscription), r the
//                         doorstep inside (a rune: the Dark Gloss); every plan's door is on its south row
//   VILLAGES.names        the cast's given names (bible §2.3's phonology, per people: the people's `names` key), and
//                         the villagers' callings
//   VILLAGES.questGivers  what a named quest-giver is ("the eel-warden"…)
//   VILLAGES.dishBook     §9.2, §9.3: each dish's note and its oven buff (a day; C2's numbers, bible gives none)
//   VILLAGES.commons      §3.1, §9.1: the commons lamp's take and the commons dark, with their lines
//   VILLAGES.shrines      each shrine kind also carries `wrong` (§7: a prayer in the wrong view says so) and
//                         `reward` (what a prayer at a village shrine gives, once a world day; C2's)
const events = [
  { id: "refugees", text: "{name} was founded by refugees from a pressed town{pressedTown}.", mood: "grief" },
  { id: "pressing", text: "{name} survived a pressing: half the old village is a mosaic on the green.", mood: "grief", cruel: true },
  { id: "feud", text: "{name} won a long feud with {neighbour}, and has never let them forget it.", mood: "pride" },
  { id: "pact", text: "{name} made a pact with {pactName}, who still speak well of it.", mood: "pride" },
  { id: "assize", text: "{name} drove the Assize out with rakes and lamp oil, and they have not come back.", mood: "pride", cruel: true },
  { id: "legend", text: "{name} was saved by a great beast that still lives in the hills nearby.", mood: "awe" },
  { id: "spring", text: "A glim spring opened under {name}, ran for three generations, and closed again.", mood: "grief" },
  { id: "stele", text: "A child of {name} read a stele no one else could, and the village keeps what the Hour left behind.", mood: "awe" },
  { id: "council", text: "{name} formed a council, and has argued in it ever since.", mood: "pride", gov: "council" },
  { id: "anarchy", text: "{name} threw out its last reeve, and lets the commons lamp decide by lot.", mood: "pride", gov: "anarchy" },
  { id: "dish", text: "Someone in {name} first made {dish}, and the village has made it every feast day since.", mood: "pride" },
  { id: "moths", text: "A moth plague came to {name} one summer and ate every wick in the village.", mood: "grief", cruel: true },
  { id: "shade", text: "The Shade touched {name}: one quarter of the village lies in dusk all day.", mood: "awe", cruel: true },
  { id: "mutation", text: "Everyone in the Flats with {mutation} came to {name}, and all its people share it now.", mood: "pride" },
];
// One in 20 of each event leaves the village empty (bible §9.1).
for (const e of events) e.abandon = 0.05;

const governments = [
  { id: "reeve", name: "a Reeve", leader: "Reeve", dialogue: "villager" },
  { id: "council", name: "a Council of Three", leader: "Flat-speaker", dialogue: "villager", speakers: ["Flat-speaker", "Deep-speaker", "Dark-speaker"] },
  { id: "moot", name: "a Moot, voting with stones", leader: "Stone-keeper", dialogue: "villager" },
  { id: "lampwarden", name: "a Lampwarden", leader: "Lampwarden", dialogue: "priest" },
  { id: "abbess", name: "an Abbess of the Dark", leader: "Abbess", dialogue: "priest" },
  { id: "herdmother", name: "a Herdmother, read by her keepers", leader: "Herd-reader", dialogue: "priest" },
  { id: "drawn", name: "a Drawn plan, kept by an automaton", leader: "Plan-reader", dialogue: "villager" },
  { id: "anarchy", name: "the lot of the commons lamp", leader: "Lot-caller", dialogue: "villager" },
];

const sacred = ["the commons lamp", "a dial-stele", "the noon shadow", "a drowned bell", "the first glimseed", "an Hour relic",
  "the oldest tree", "the founders' mosaic", "a sleeping ghost", "a fallen stone of salt", "the village longback", "silence at dusk"];
const profane = ["long shadows", "lamps lit after dark", "the plumb-bob", "ink", "standing on mosaics", "climbing", "brinehogs",
  "the Chandlers", "mirrors", "counting aloud", "eating eel", "whistling"];
const activities = ["pressing glimseed", "mending eel weirs", "sweeping the mosaics", "founding bells", "raking salt",
  "breeding longbacks", "grinding lenses", "boiling ink", "cutting runes", "rendering wax", "scavenging the Stacks", "flying message-kites"];
const proverbs = [
  "Who salts the {sacred} sweetens the {profane}.",
  "A short shadow tells no lies; a long one tells them slowly.",
  "Light your lamp from your own wick and you'll never owe the {profane}.",
  "The map is flat, but the {sacred} is deep.",
  "Don't count the {activity} before noon.",
  "Every crease remembers the press.",
  "Sit in the dark long enough and the {sacred} will speak.",
  "A straight road never visits anyone.",
  "The {profane} casts the longest shadow at dusk.",
  "What the floor knows, the feet forget.",
  "Measure twice; the Assize only measures once.",
];
const dishes = ["eel fried in glimseed oil", "salted reed hearts", "brinehog baked in its own salt crust", "longback-milk curd",
  "folded-leaf dumplings", "mosaic bread", "ink-squid noodles", "honeycomb in sunwine", "ash-baked ledgehorn", "spore broth",
  "shore crab boiled in brine", "dusk soup"];
const skills = ["pathcraft", "survey", "lore", "leechcraft", "artificing", "shadowcraft", "glimcraft", "tumbling", "hardiness",
  "parley", "blades", "bludgeon", "axe", "polearm", "missile", "throwing"];
const liquids = ["glim", "water", "brine", "ink", "umbra", "sunwine", "longbackMilk", "sap", "mulchWine", "quicksilver"];

// The shrine decides the view its prayers need (bible §9.2). A prayer in the wrong view does nothing and says so
// (bible §7); one in the right view, once a world day, gives the shrine's reward: the mosaic and the carving one of
// the village's own two tales as a reading (`tale`: 1 is the flat one, 2 the deep one), the rune a minute of night
// eyes, the pillar a full heal (an inn's worth: 10 glim). Small on purpose: money is never plentiful.
const shrines = {
  mosaic: { name: "a mosaic shrine", view: "map", pray: "Kneel on it with the map before you: from above, the picture is the prayer.",
    wrong: "The mosaic can't hear you from up there.", reward: { tale: 1, heal: 5, text: "The picture comes clear: the village's first tale, as a flat reading." } },
  relief: { name: "a carved shrine", view: "3d", pray: "Look on the carving in good light, face to face.",
    wrong: "From above, the carving is a smudge. Look at it face to face.", reward: { tale: 2, heal: 5, text: "The carving tells you the village's other tale, as a deep reading." } },
  rune: { name: "a rune shrine", view: "dark", pray: "Stand before it with your torch out, in the dark, and read it.",
    wrong: "The rune is shy of your light. Put it out.", reward: { status: "nightEyes", t: 60, text: "The rune reads you back. The dark opens a little. (Night eyes, 60 s)" } },
  pillar: { name: "a shrine pillar", view: "3d", pray: "Look up at its crown, in 3D: from above it is only a dot.",
    wrong: "From above, the pillar is a dot, and dots don't listen.", reward: { heal: "full", text: "You look up at the crown until your neck aches, and then it doesn't." } },
};

// Founding peoples (bible §9.3). faction: the WS6a faction the villagers carry as a second membership.
const peoples = {
  marshfolk: { name: "Bent marshfolk", faction: "bentVillages", parent: "bent", names: "bent" },
  clatter: { name: "the Clatter", faction: "clatter", parent: "peoples", names: "clatter" },
  drovers: { name: "Drovers", faction: "drovers", parent: "peoples", names: "drover" },
  pressed: { name: "the Pressed", faction: "pressed", parent: "peoples", names: "flat" },
  kites: { name: "Kites", faction: "kites", parent: "peoples", names: "kite" },
  rustbacks: { name: "former Rustbacks", faction: "rustbacks", parent: "peoples", names: "rustback" },
  farmers: { name: "Bent farmers", faction: "bentVillages", parent: "bent", names: "bent" },
  exiles: { name: "Plumb exiles", faction: "survey", parent: "peoples", names: "plumb" },
  families: { name: "Bent families", faction: "bentVillages", parent: "bent", names: "bent" },
  sporeMoot: { name: "the Spore Moot's tenders", faction: "sporeMoot", parent: "peoples", names: "tender" },
  errata: { name: "Errata", faction: "errata", parent: "peoples", names: "errata" },
  flatfolk: { name: "Flatfolk", faction: "flatfolk", parent: "peoples", names: "flat" },
  lampless: { name: "the Lampless", faction: "lampless", parent: "peoples", names: "lampless" },
  plan: { name: "the Plan's automata and their scavengers", faction: "plan", parent: "peoples", names: "machine" },
  hermits: { name: "hermits", faction: "bentVillages", parent: "bent", names: "bent" },
};

// A span's region → founding peoples and architecture (bible §9.3, §9.4), by C1a's region ids (the terrain's id where
// they coincide); the test world's fixture terrains borrow the nearest. Anything else: the Downs' (story/villages.js).
const byTerrain = {
  flats: { peoples: ["marshfolk", "clatter"], style: "reed" },
  waste: { peoples: ["drovers", "pressed"], style: "salt" },
  steps: { peoples: ["drovers", "kites", "rustbacks"], style: "ledge" },
  downs: { peoples: ["farmers", "exiles"], style: "turf" },
  pleatwood: { peoples: ["families", "sporeMoot"], style: "bark" },
  deepPleat: { peoples: ["families", "errata"], style: "bark" },
  tessellate: { peoples: ["flatfolk", "pressed"], style: "page" },
  shade: { peoples: ["lampless"], style: "cell" },
  stacks: { peoples: ["plan"], style: "storey" },
  glassShore: { peoples: ["clatter", "errata"], style: "glass" },
  teeth: { peoples: ["kites", "hermits"], style: "cave" },
  lattice: { peoples: ["plan"], style: "storey" },
  // the test world's fixture terrains
  hills: { peoples: ["farmers", "exiles"], style: "turf" },
  forest: { peoples: ["families", "sporeMoot"], style: "bark" },
  marsh: { peoples: ["marshfolk", "clatter"], style: "reed" },
};

// Architecture (bible §9.4). Every style is roofed (a slab at the walls' height) except where the bible leaves the sky
// open; `lamp: "dark"` is the Shade's commons dark (no lamp: a ring of rune stones). Blocks by their blocks.js key.
// heights, in blocks above the green's datum (DECISIONS "Heights": standable ground at most 12 up), and the flags are
// what story/village-site.js stamps once its integration request lands; until then every village stands on the datum.
//   stilts n      the houses' floors n up, joined by boardwalks over shallow brine (boardwalks read as floor on the map)
//   ledges [a, b] a to b levels cut into a mesa, 3 blocks apart, joined by ladders and ramps (a Flat Lie: the map shows one)
//   sunk n        the longhouses' floors n below the green, round a barrow with a 1-floor crypt
//   canopy [a, b] pods on platforms a to b up, rope bridges between them that fold away at dusk
//   storeys [a, b] a to b storeys of 4 blocks round a lift shaft you can fall down (the map shows one storey)
//   cliff [a, b]  caves and eyries from a to b up a cliff, the market at the top
const styles = {
  reed: { name: "reed houses on stilts, with boardwalks", wall: "REED", floor: "PLANK", roof: "THATCH", ground: "PLANK", lamp: "lamp",
    heights: { stilts: 1 }, boardwalks: true, views: "Boardwalks read as floor on the map; in 3D the brine under them is shallow water." },
  salt: { name: "domes of salt block round a cistern", wall: "SALT", floor: "SAND", roof: "SALT", ground: "SALT", lamp: "lamp",
    heights: {}, cistern: true, darkInside: true, views: "Dark inside, so the commons lamp matters; outside, the noon glare." },
  ledge: { name: "houses cut into the ledges", wall: "CLAY", floor: "DIRT", roof: "CLAY", ground: "DIRT", lamp: "lamp",
    heights: { ledges: [3, 4] }, flatLie: true, views: "A Flat Lie: the map shows one layer, 3D shows four." },
  turf: { name: "turf longhouses round a barrow", wall: "MUD_BRICK", floor: "DIRT", roof: "THATCH", ground: "DIRT", lamp: "lamp",
    heights: { sunk: 1 }, barrow: { floors: 1 }, views: "Sunk a block into the ground; the barrow has a crypt of one floor." },
  bark: { name: "folded-bark pods in the canopy", wall: "TRUNK", floor: "PLANK", roof: "LEAVES", ground: "DIRT", lamp: "lamp",
    heights: { canopy: [6, 10] }, bridges: "fold away at dusk", views: "A climbing village; the map can't show which platform is at which height." },
  page: { name: "a page-town drawn on the Plane", wall: "STONE", floor: "TILE", roof: "STONE", ground: "TILE", lamp: "lamp",
    heights: {}, mapOnly: true, realInn: true, views: "The town exists only on the map; only the inn for deep visitors is real." },
  cell: { name: "lampless stone cells", wall: "STONE", floor: "ROCK", roof: "STONE", ground: "ASH", lamp: "dark",
    heights: {}, runeDoors: true, windows: false, views: "Rune doors and no windows; a commons dark instead of a commons lamp." },
  storey: { name: "squatted Deepwright floors round a lift shaft", wall: "METAL", floor: "TILE", roof: "SCRAP", ground: "SCRAP", lamp: "lamp",
    heights: { storeys: [2, 3] }, shaft: true, views: "Falls go down the shaft; the map shows one storey at a time." },
  glass: { name: "huts of glass brick", wall: "GLASS", floor: "SAND", roof: "GLASS", ground: "SAND", lamp: "lamp",
    heights: {}, seeThrough: true, views: "You can see through the walls in 3D; on the map they're walls." },
  cave: { name: "caves and eyries up a cliff", wall: "ROCK", floor: "DIRT", roof: "ROCK", ground: "DIRT", lamp: "lamp",
    heights: { cliff: [4, 12] }, marketAtTop: true, views: "A vertical climb; the market sits at the top." },
};

// Building plans: a hall (the leader's), houses, a workshop. 5 rows deep; the door in the middle of the south row with
// its lintel (M) above it, and the doorstep just inside (r: where a cruel event's rune goes). Widths: the hall 9, the
// rest at most 8 (story/village-site.js lays them in five slots round a 24 × 16 green).
const plans = {
  hall: ["#########", "#.......#", "l.......l", "#...r...#", "####M####"],
  house: ["#######", "#.....#", "l.....#", "#..r..#", "###M###"],
  longhouse: ["########", "#......l", "#......#", "#..r...#", "###M####"],
  workshop: ["######", "#....#", "l....#", "#.r..#", "##M###"],
};

// Given names by bible §2.3's phonology. Nobody named in bible §5 (the landmarks' people: Maren, Saara, Zaqar, Abbess
// Wisse, Section Nine, Kay of the Long Line…) or among the parent's people: they are somebody already (check-story 10). Marshfolk two syllables, soft and doubled; Drovers CV-CVC, clipped; the Plumb
// a Latinate given name; the Flatfolk a letter, an elder's with a line; the Lampless whispered; the Plan's units drawing
// titles; the Moot's tenders slow descriptions; former Rustbacks a nickname and a scrap; Kites and the Clatter sounds;
// Errata an original's name, mirrored.
const names = {
  bent: ["Ilka", "Ossa", "Ilke", "Osse", "Hamo", "Vessa", "Kevi", "Anke", "Mitte", "Tilo", "Rosse", "Haaro", "Vemo", "Peri", "Sarin", "Lumel"],
  clatter: ["Tkrr", "Chitt-Ashell", "Krrik", "Chatt", "Tikkr", "Krett", "Chik-Shellen", "Tkk-Rasp", "Krr-Kesh", "Ttcha", "Chkk", "Tirr-Shell", "Krrach", "Tchett"],
  drover: ["Sebbu", "Dakkat", "Debbek", "Qamu", "Azzu", "Ennat", "Rozek", "Guffar", "Murat", "Sedek", "Rozar", "Bekku", "Tuffe", "Yezri", "Dasay", "Hubbat"],
  flat: ["Ex", "Vee", "Zed", "Emm", "Aitch", "Wye", "Arr", "Eff", "Jay", "Cue", "Dee", "Bee", "Vee of the Short Line", "Double-Emm", "Ess Underlined", "Pee Struck Through"],
  kite: ["Wiiree", "Aawik", "Riiva", "Keewi", "Aarii", "Aariw", "Wiiko", "Keeri", "Riiwa", "Aaki", "Weeri", "Wikee", "Aarik", "Riikee"],
  plumb: ["Ysolde", "Sevine", "Dexant", "Corel", "Talis", "Ostade", "Verine", "Marex", "Delor", "Quinel", "Ysade", "Quinex", "Talant", "Corris"],
  lampless: ["Ishel", "Hulven", "Ishe", "Thol", "Sesh", "Ovhe", "Nelle", "Velen", "Thossa", "Ulshe", "Sathe", "Nevhe", "Olen", "Hussa"],
  machine: ["Section Six", "Elevation East", "Revision Seven", "Grid Four", "Sheet Twelve", "Hatch Two", "Scale One", "Datum Three",
    "Section Eleven", "Elevation North", "Detail F", "Revision Two", "Sheet Nine", "Grid Fourteen"],
  tender: ["Keeps-the-Damp", "Turns-the-Mulch", "Hears-Slowly", "Sleeps-in-Moss", "Counts-Spores", "Smells-Rain", "Waits-Twice",
    "Feeds-the-Roots", "Minds-the-Rot", "Walks-Wet", "Grows-Late", "Rests-Long", "Knows-Mould", "Drinks-Fog"],
  rustback: ["Grak", "Mogdut", "Harrib", "Two-Nail", "Kettle-Ear", "Dubak", "Skib", "Gradut", "Harrak", "Mogib", "Bolt-Tooth", "Pan-Lid", "Skak", "Hinge-Hand"],
  errata: ["Akli", "Ivot", "Araas", "Esso", "Omul", "Ufset", "Kebbed", "Irdug", "Yasah", "Tanne", "Umaq", "Uzza", "Asso", "Omah"],
};
const callings = ["reed-cutter", "eel-warden", "salt-raker", "lens-grinder", "wick-trimmer", "weir-mender", "kite-flier",
  "ink-boiler", "rune-cutter", "wax-renderer", "bell-founder", "longback-breeder"];
const questGivers = ["the eel-warden", "the old weaver", "the bell-founder", "the lens-grinder", "the salt-raker", "the kite-flier",
  "the wick-trimmer", "the ink-boiler"];

// The dish (bible §9.2, §9.3): learned in the Kindling for −40 reputation, cooked at the village oven for a buff
// that lasts one world day (integration request: the oven and the menu row). The bible names no buffs; these are
// C2's, small, on bonus keys the stat bus reads (torch ×, navigation and stealth as fractions).
const dishBook = {
  "eel fried in glimseed oil": { note: "Fried in the oil the lamps burn. The lamps don't mind.", bonus: { torch: 0.15 }, text: "your torch reaches a little further" },
  "salted reed hearts": { note: "The heart of the reed, salted until it gives up.", bonus: { navigation: 0.05 }, text: "you lose your way less on the world map" },
  "brinehog baked in its own salt crust": { note: "You break the crust with a hammer. The brinehog had it coming.", bonus: { maxHp: 3 }, text: "+3 max HP" },
  "longback-milk curd": { note: "Sour, thick and Drover-proud. It keeps for a season and tastes like one.", bonus: { carry: 10 }, text: "you carry 10 more" },
  "folded-leaf dumplings": { note: "Folded so many times that nobody knows what's in the middle.", bonus: { stealth: 0.1 }, text: "you are noticed 10% later" },
  "mosaic bread": { note: "Stamped with the founders' faces. You eat the Reeve first; everyone does.", bonus: { examine: 2 }, text: "+2 to examine" },
  "ink-squid noodles": { note: "From the Inkrun. Your teeth are blue until the next day.", bonus: { dv: 1 }, text: "+1 DV" },
  "honeycomb in sunwine": { note: "Sweet on sweet. Two bowls and the sky turns.", bonus: { speed: 0.05 }, text: "you move 5% faster" },
  "ash-baked ledgehorn": { note: "Baked under the ashes for a day. The horns are a garnish, not food.", bonus: { av: 1 }, text: "+1 armour" },
  "spore broth": { note: "The Moot's own recipe. Don't ask the Moot what's in it; it will tell you, slowly.", bonus: { maxHp: 2 }, text: "+2 max HP" },
  "shore crab boiled in brine": { note: "Never served to the Clatter, who would have questions.", bonus: { maxHp: 2 }, text: "+2 max HP" },
  "dusk soup": { note: "Eaten cold and in the dark, as the recipe insists.", bonus: { darkSight: 2 }, text: "you see 2 tiles with the torch out" },
};

// The commons lamp (bible §3.1, §9.1): anyone may take 5 glim a day from it without giving offence; more costs 25
// village reputation for each 5. The Shade's villages keep a commons dark instead: nothing to take, and a rest there
// is a rest in the dark. In a Commons Lamp run it is the checkpoint (bible §10.1). The lamplighter keeps it.
const commons = {
  take: { free: 5, per: 5, rep: -25 },
  lines: {
    take: "You take a thimble of glim from the commons lamp. Nobody minds. That's what it's for.",
    more: "You take more than the day's share. The lamp gutters, and so does everyone's opinion of you.",
    empty: "The commons lamp is down to its wick. Come back tomorrow.",
    dark: "The commons dark: four rune stones and nothing to take. It is for sitting in.",
  },
};

export const VILLAGES = { events, governments, sacred, profane, activities, proverbs, dishes, skills, liquids, shrines, peoples,
  byTerrain, styles, plans, names, callings, questGivers, dishBook, commons };
