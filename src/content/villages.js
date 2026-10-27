// Village cultures (TECH_DESIGN §2.16 culture: { sacredLiquid, sacred, profane, dish, style, phonemes }, roles,
// building plans; bible §9; WS7, then C2): what story/villages.js generateVillage draws from. Data only.
//
//   VILLAGES.events       bible §9.3's 14 history events of a village: { id, text, abandon (1 in 20), gov?, cruel?, mood }
//                         text is a sentence with {name}, {sacred}, {people}, {neighbour}, {hour}, {mutation}
//   VILLAGES.governments  §9.3's 8: { id, name, leader (the role's title), dialogue (WS6a ROLES id) }
//   VILLAGES.sacred, profane, activities, proverbs, dishes, skills, liquids   §9.3's pools ({…} slots in proverbs)
//   VILLAGES.shrines      §9.2: mosaic (the map), relief (3D in light), rune (the dark), pillar (3D: its height)
//   VILLAGES.peoples      §9.3 "Founding peoples": { id, name, faction (WS6a's id, a second membership), parent: "bent" | "peoples" }
//   VILLAGES.byTerrain    a span's terrain (until C1's regions) → [people ids], style id
//   VILLAGES.styles       §9.4 architecture: { name, wall, floor, roof, lamp ("lamp" | "dark"), ground }; block keys of blocks.js
//   VILLAGES.plans        building plans in the vault letter format (gen/vaults.js): # wall, . floor, D door, l lamp
//                         in the wall, M the lintel over the door (a carved panel: the Deep Inscription), r the
//                         doorstep inside (a rune: the Dark Gloss); every plan's door is on its south row
//   VILLAGES.names        the cast's given names (bible §2.3, per people), and the villagers' callings
//   VILLAGES.questGivers  what a named quest-giver is ("the eel-warden"…)
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
  { id: "council", name: "a Council of Three", leader: "Flat-speaker", dialogue: "villager" },
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

// The shrine decides the view its prayers need (bible §9.2).
const shrines = {
  mosaic: { name: "a mosaic shrine", view: "map", pray: "Kneel on it with the map before you: from above, the picture is the prayer." },
  relief: { name: "a carved shrine", view: "3d", pray: "Look on the carving in good light, face to face." },
  rune: { name: "a rune shrine", view: "dark", pray: "Stand before it with your torch out, in the dark, and read it." },
  pillar: { name: "a shrine pillar", view: "3d", pray: "Look up at its crown, in 3D: from above it is only a dot." },
};

// Founding peoples (bible §9.3). faction: the WS6a faction the villagers carry as a second membership.
const peoples = {
  marshfolk: { name: "Bent marshfolk", faction: "bentVillages", parent: "bent", names: "bent" },
  clatter: { name: "the Clatter", faction: "clatter", parent: "peoples", names: "clatter" },
  drovers: { name: "Drovers", faction: "drovers", parent: "peoples", names: "drover" },
  pressed: { name: "the Pressed", faction: "pressed", parent: "peoples", names: "flat" },
  kites: { name: "Kites", faction: "kites", parent: "peoples", names: "kite" },
  rustbacks: { name: "former Rustbacks", faction: "rustbacks", parent: "peoples", names: "drover" },
  farmers: { name: "Bent farmers", faction: "bentVillages", parent: "bent", names: "bent" },
  exiles: { name: "Plumb exiles", faction: "survey", parent: "peoples", names: "plumb" },
  families: { name: "Bent families", faction: "bentVillages", parent: "bent", names: "bent" },
  sporeMoot: { name: "the Spore Moot's tenders", faction: "sporeMoot", parent: "peoples", names: "bent" },
  errata: { name: "Errata", faction: "errata", parent: "peoples", names: "flat" },
  flatfolk: { name: "Flatfolk", faction: "flatfolk", parent: "peoples", names: "flat" },
  lampless: { name: "the Lampless", faction: "lampless", parent: "peoples", names: "lampless" },
  plan: { name: "the Plan's automata and their scavengers", faction: "plan", parent: "peoples", names: "plumb" },
  hermits: { name: "hermits", faction: "bentVillages", parent: "bent", names: "bent" },
};

// A span's terrain → founding peoples and architecture (bible §9.3, §9.4). The real world's terrains; the test
// world's fixture terrains borrow the nearest. Anything else: Bent families in the Downs style.
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
  glass: { peoples: ["clatter", "errata"], style: "glass" },
  teeth: { peoples: ["kites", "hermits"], style: "cave" },
  lattice: { peoples: ["plan"], style: "storey" },
  // the test world's fixture terrains
  hills: { peoples: ["farmers", "exiles"], style: "turf" },
  forest: { peoples: ["families", "sporeMoot"], style: "bark" },
  marsh: { peoples: ["marshfolk", "clatter"], style: "reed" },
};

// Architecture (bible §9.4). Every style is roofed (a slab at the walls' height) except where the bible leaves the sky
// open; `lamp: "dark"` is the Shade's commons dark (no lamp: a ring of rune stones). Blocks by their blocks.js key.
const styles = {
  reed: { name: "reed houses with boardwalks", wall: "REED", floor: "PLANK", roof: "THATCH", ground: "PLANK", lamp: "lamp" },
  salt: { name: "domes of salt block", wall: "SALT", floor: "SAND", roof: "SALT", ground: "SALT", lamp: "lamp" },
  ledge: { name: "houses cut into the ledges", wall: "CLAY", floor: "DIRT", roof: "CLAY", ground: "DIRT", lamp: "lamp" },
  turf: { name: "turf longhouses", wall: "MUD_BRICK", floor: "DIRT", roof: "THATCH", ground: "DIRT", lamp: "lamp" },
  bark: { name: "folded-bark pods", wall: "TRUNK", floor: "PLANK", roof: "LEAVES", ground: "DIRT", lamp: "lamp" },
  page: { name: "a page-town drawn on the Plane", wall: "STONE", floor: "TILE", roof: "STONE", ground: "TILE", lamp: "lamp" },
  cell: { name: "lampless stone cells", wall: "STONE", floor: "ROCK", roof: "STONE", ground: "ASH", lamp: "dark" },
  storey: { name: "squatted Deepwright floors", wall: "METAL", floor: "TILE", roof: "SCRAP", ground: "SCRAP", lamp: "lamp" },
  glass: { name: "huts of glass brick", wall: "GLASS", floor: "SAND", roof: "GLASS", ground: "SAND", lamp: "lamp" },
  cave: { name: "caves and eyries", wall: "ROCK", floor: "DIRT", roof: "ROCK", ground: "DIRT", lamp: "lamp" },
};

// Building plans: a hall (the leader's), houses, a workshop. 5 rows deep; the door in the middle of the south row with
// its lintel (M) above it, and the doorstep just inside (r: where a cruel event's rune goes). Width varies.
const plans = {
  hall: ["#########", "#.......#", "l.......l", "#...r...#", "####M####"],
  house: ["#######", "#.....#", "l.....#", "#..r..#", "###M###"],
  longhouse: ["#########", "#.......l", "#.......#", "#...r...#", "####M####"],
  workshop: ["######", "#....#", "l....#", "#.r..#", "##M###"],
};

const names = {
  bent: ["Harl", "Ossa", "Brin", "Tansy", "Wick", "Dell", "Marro", "Perrin", "Ivo", "Sedge", "Rush", "Nell", "Corra", "Fenn", "Hob", "Lisk"],
  clatter: ["Kesh-Kesh", "Tik", "Varr", "Klo", "Shellen", "Rattle", "Pinch", "Skerr"],
  drover: ["Abra", "Dunmar", "Keb", "Sallow", "Orrin", "Tey", "Bodd", "Marl"],
  flat: ["Ett", "Line", "Tilde", "Vell", "Ord", "Plait", "Leaf", "Quire"],
  kite: ["Skye", "Arrel", "Fen", "Tarra", "Wend", "Hask", "Plume", "Lir"],
  plumb: ["Brother Arn", "Sister Moll", "Halt", "Mensa", "Corbel", "Level", "True", "Datum"],
  lampless: ["Hush", "Umber", "Dim", "Velle", "Sill", "Oss", "Nonna", "Murr"],
};
const callings = ["reed-cutter", "eel-warden", "salt-raker", "lens-grinder", "wick-trimmer", "weir-mender", "kite-flier",
  "ink-boiler", "rune-cutter", "wax-renderer", "bell-founder", "longback-breeder"];
const questGivers = ["the eel-warden", "the old weaver", "the bell-founder", "the lens-grinder", "the salt-raker", "the kite-flier",
  "the wick-trimmer", "the ink-boiler"];

export const VILLAGES = { events, governments, sacred, profane, activities, proverbs, dishes, skills, liquids, shrines, peoples,
  byTerrain, styles, plans, names, callings, questGivers };
