// The real world's gear (bible §13.1-§13.3; TECH_DESIGN §2.18 "content/items/*.js"; C4): the material ladder, the
// weapon classes and the armour for every body slot. Plain tables with no imports, so any module can read them while
// the item modules are still loading (items/legacy.js spreads the new weapons and armour into its tables).
//
// A piece of gear is a class or a piece (a WEAPONS or ARMOURS id) and, in the real world, a material:
//   { kind: "weapon", id: "handAxe", made: "copper", material: 0, ench, known, … }
//     made       a MATERIALS id: what it is made of (its name, price, colour; armour's +AV)
//     material   the damage the material adds to a weapon (combat.js weaponSpec and missiles.js read this number:
//                "the weapon range + material + floor((STR − req) / 2) + enchantment", DECISIONS §1); items/gear.js
//                makeGear sets it from `made`
// The parent's gear has no `made`, so the test world's legacy stack, golden (b) and the legacy fights see the parent's
// items exactly as before.
//
//   MATERIALS[id] = { name, tier, dmg, av, value, color, info, bonus?, strReq?, needs? }
//     tier     bible §13.1's tier (1-8): the zones of that tier find it most often (items/gear.js randomGear)
//     dmg      what it adds to a weapon's damage; av: what it adds to a forged armour piece (FORGED.armour)
//     value    the price multiplier over the class's copper value (VALUE): bible §3.1's anchors are a copper short
//              sword at 40 and an iron longsword at 120
//     info     what the item's line says of it (only what the game does: a rule still to be built is in `needs`)
//     bonus    to the stat bus while a weapon of it is wielded (noonsilver cuts flat beings: creatures.js reads cutsFlat)
//     strReq   pleatmetal's −3 STR requirement (items.js strNeeded doesn't read it yet: docs/c4.md)
//     needs    the rest of the bible's line, for the code that will do it (docs/c4.md, integration requests)
export const MATERIALS = {
  bone:       { name: "bone",       tier: 1, dmg: -1, av: 0, value: 0.5, color: [222, 212, 182], info: "cheap and light",
                needs: "1 hit in 50 snaps it (combat.js)" },
  copper:     { name: "copper",     tier: 2, dmg: 0,  av: 0, value: 1,   color: [205, 125, 75],  info: "soft and green" },
  iron:       { name: "iron",       tier: 3, dmg: 1,  av: 0, value: 1.5, color: [150, 154, 168], info: "plain iron, honest and heavy",
                needs: "rusts in brine (-1) unless lacquered (liquids: brine touch)" },
  saltsteel:  { name: "saltsteel",  tier: 4, dmg: 2,  av: 1, value: 2,   color: [188, 206, 212], info: "brine-tempered by the Drovers; it never rusts" },
  blackglass: { name: "blackglass", tier: 5, dmg: 3,  av: 1, value: 3,   color: [78, 70, 98],    info: "a Glass Sea razor",
                needs: "a crit against armour 4 or more chips it (-1) (combat.js)" },
  truesteel:  { name: "truesteel",  tier: 6, dmg: 4,  av: 2, value: 4,   color: [214, 224, 240], info: "Deepwright alloy; it never bends",
                needs: "ignores 1 point of armour (combat.js soak)" },
  pleatmetal: { name: "pleatmetal", tier: 7, dmg: 5,  av: 2, value: 5.5, color: [176, 146, 206], info: "folded a thousand times", strReq: -3,
                needs: "-3 STR requirement (items.js strNeeded reads strReq); draws as a hairline on the map (renderMap.js)" },
  noonsilver: { name: "noonsilver", tier: 8, dmg: 6,  av: 3, value: 7.5, color: [255, 244, 206], info: "it casts no shadow, and cuts flat beings in 3D",
                bonus: { cutsFlat: 1 }, needs: "glows at noon (hud.js, render3d.js)" },
};
export const MATERIAL_ORDER = Object.keys(MATERIALS);

// Which gear takes a material: every weapon class and the bolt-bow (its shot adds the material: missiles.js
// missileSpec; the sling throws stones); of the armour, the body's metal and the plain helm (bible §13.1: "an armour's
// material adds to its armour value"). The parent's copper cap and iron helm are already their metal, and bracers,
// gauntlets and boots keep their own +1, so a tier-8 body tops out near AV 10 rather than 20.
export const FORGED = { missile: ["boltBow"], armour: ["chain", "scale", "plate", "helm"] };

// --- Weapon classes (bible §13.2) --------------------------------------------------------------------------------------
// CLASSES[id] = { name, info?, needs }: a class's identity. info: what the game does now (the item's line shows it);
// needs: the rest, for the code (docs/c4.md). CLASS_OF maps every WEAPONS id to its class, the parent's too.
export const CLASSES = {
  shortBlade: { name: "short blade", info: "the fastest swing", needs: "bleeds; x2 backstab from the dark (combat.js, a bleeding status)" },
  longBlade:  { name: "long blade", needs: "parry: strike in the 0.2 s before an enemy's blow lands and it is cancelled (combat.js)" },
  cudgel:     { name: "cudgel", needs: "dazes for 1 s; smashes crates and cracked walls (combat.js, interact.js)" },
  axe:        { name: "axe", needs: "cleaves a second adjacent enemy for half; disarms people (combat.js)" },
  polearm:    { name: "polearm", info: "a long reach", needs: "+50% from a ledge above; holds chargers off (combat.js, ai.js)" },
  greatBlade: { name: "great blade", info: "slow and heavy", needs: "knocks the target back 1 tile: off ledges, into chasms (combat.js)" },
  flail:      { name: "lantern-flail", needs: "is your torch; double damage to shades and ghosts; each swing sweeps light around you; useless with the torch out (torch.js, combat.js, light.js)" },
};
export const CLASS_OF = {
  dagger: "shortBlade", stylus: "shortBlade", shortsword: "longBlade", longsword: "longBlade", mace: "cudgel", maul: "cudgel",
  staff: "cudgel", handAxe: "axe", waraxe: "axe", spear: "polearm", glaive: "polearm", greatsword: "greatBlade", lanternFlail: "flail",
};

// The new classes, in the parent's WEAPONS shape (items/legacy.js; hud.js draws `held`, in WEAPON_PALETTE's letters).
// tier 0: not in the parent's loot (items.js randomEquipment draws tiers 1-4 from WEAPONS); the real world draws a
// class and a material instead (items/gear.js randomGear). hands 2: two-handed (body.js).
const rep = (row, n) => Array(n).fill(row);
const alt = (a, b, n) => Array.from({ length: n }, (_, i) => (i % 2 ? b : a));
export const GEAR_WEAPONS = {
  stylus: {
    name: "stylus", dmg: [1, 3], swing: 0.3, reach: 1.4, str: 6, tier: 0,
    held: { length: 0.3, pivot: 9.5 / 13, art: ["  w  ", "  W  ", ...rep(" wWs ", 5), "  s  ", ...alt("  h  ", "  H  ", 4), "  d  "] },
  },
  handAxe: {
    name: "hand-axe", dmg: [3, 6], swing: 0.5, reach: 1.8, str: 11, tier: 0,
    held: { length: 0.5, pivot: 16.5 / 19, art: ["    d   ", " ww k   ", "wWWdk   ", "wWWdkd  ", "wWWdk   ", " ww k   ",
      ...alt("    k   ", "    K   ", 9), ...rep("    h   ", 3), "    d   "] },
  },
  staff: {
    name: "staff", dmg: [2, 6], swing: 0.5, reach: 2.2, str: 9, tier: 0,   // (a walking staff: one hand)
    held: { length: 0.9, pivot: 29.5 / 39, art: ["  d  ", "  D  ", ...alt("  k  ", "  K  ", 26), ...rep("  h  ", 3), ...alt("  k  ", "  K  ", 6), "  D  ", "  d  "] },
  },
  lanternFlail: {
    name: "lantern-flail", dmg: [3, 6], swing: 0.6, reach: 2.2, str: 11, tier: 0,
    held: { length: 0.6, pivot: 22.5 / 25, art: ["  ggg  ", " gGpGg ", " gpGpg ", " gGpGg ", "  ggg  ", "   d   ", "   D   ", "   d   ", "   D   ",
      "   d   ", "  ddd  ", ...alt("   k   ", "   K   ", 10), ...rep("   h   ", 3), "   d   "] },
  },
  glaive: {
    name: "glaive", dmg: [5, 9], swing: 0.7, reach: 2.9, str: 15, tier: 0, hands: 2, thrust: true,
    held: { length: 0.98, pivot: 32 / 40, art: ["   ws ", "  wWWs", "  wWWs", " wWWs ", " wWs  ", " wWs  ", "  Ws  ", "  d   ",
      ...alt("  k   ", "  K   ", 22), ...rep("  h   ", 4), ...alt("  k   ", "  K   ", 5), "  d   "] },
  },
  maul: {
    name: "maul", dmg: [6, 11], swing: 0.85, reach: 2.0, str: 16, tier: 0, hands: 2,
    held: { length: 0.74, pivot: 26 / 29, art: [" dDDDDDd ", "dDdDdDdDd", "dDDDDDDDd", "dDdDdDdDd", " dDDDDDd ", "    d    ",
      ...alt("    k    ", "    K    ", 18), ...rep("    h    ", 4), "    d    "] },
  },
};

// --- Armour by body slot (bible §13.3) ------------------------------------------------------------------------------
// In the parent's ARMOURS shape, every one with a `slot`, so the parent's loot never draws them (items.js
// randomEquipment skips anything with a slot); `tier` is the bible's (the zones where it turns up: items/gear.js).
//   info     what it does that the item's line should say (only what the game does)
//   bonus    to the stat bus while worn (stats.js BONUS_KEYS)
//   veil     a hood or veil: Lightsick's sun doesn't reach you under it (bible §13.5; progression/mutations.js reads
//            it once docs/c4.md's request is in)
//   wornRep  reputation while worn (bible §3.5 "Wearables"): { faction: n }, or "hour" for an Hour mask (+hourRep with
//            that Hour's favoured factions, −hourRep with its hated ones); the hook is docs/c4.md's request
//   needs    the rest of the bible's line, for the code (docs/c4.md)
// A piece that does nothing yet (only `needs`) stays out of the real world's loot until it does (items/gear.js useful).
export const GEAR_ARMOURS = {
  // Head
  helm:          { name: "helm", armour: 2, str: 12, tier: 4, metal: true, slot: "head" },
  plumbHelm:     { name: "plumb-helm", armour: 3, str: 13, tier: 6, metal: true, slot: "head" },
  lampCrownHat:  { name: "lamp crown", armour: 0, str: 0, tier: 4, metal: true, slot: "head", bonus: { torch: 1 / 3 }, info: "your torch reaches 2 tiles further" },
  featheredHood: { name: "feathered hood", armour: 0, str: 0, tier: 2, metal: false, slot: "head", veil: true, wornRep: { kites: 250 },
                   needs: "Kites +250 while worn (the worn reputation hook)" },
  // Face
  monocle:       { name: "examiner's monocle", armour: 0, str: 0, tier: 3, metal: true, slot: "face", bonus: { examine: 3 } },
  saltVeil:      { name: "salt veil", armour: 0, str: 0, tier: 2, metal: false, slot: "face", veil: true, glare: true,
                   needs: "cancels the noon glare (WS1's glare in the Waste and on the Glass shore)" },
  sporeVeil:     { name: "spore veil", armour: 0, str: 0, tier: 3, metal: false, slot: "face", veil: true, spores: true,
                   needs: "immune to spores (C3's spore creatures and clouds)" },
  hourMask:      { name: "Hour mask", armour: 0, str: 0, tier: 4, metal: false, slot: "face", wornRep: "hour", hourRep: 200,
                   needs: "+200 with that Hour's favoured factions, -200 with its hated ones while worn (the worn reputation hook; an item's `hour`)" },
  // Body
  glassScale:    { name: "glass-scale", armour: 3, str: 14, tier: 5, metal: false, slot: "body", bonus: { ward: 1 }, info: "missiles do 1 less",
                   needs: "reflects 15% of missiles (missiles.js)" },
  pleatedCoat:   { name: "pleated coat", armour: 2, str: 10, tier: 7, metal: true, slot: "body", bonus: { dv: 1 } },
  // Back
  reedCloak:     { name: "reed cloak", armour: 0, str: 0, tier: 1, metal: false, slot: "back", bonus: { stealth: 0.1 } },
  featherCloak:  { name: "feather cloak", armour: 0, str: 0, tier: 3, metal: false, slot: "back", bonus: { stealth: 0.05 }, wornRep: { kites: 250 },
                   needs: "Kites +250 while worn (the worn reputation hook)" },
  mapCase:       { name: "map case", armour: 0, str: 0, tier: 1, metal: false, slot: "back", bonus: { navigation: 3 }, info: "you get lost less on the world map" },
  kiteGlider:    { name: "kite-glider", armour: 0, str: 0, tier: 4, metal: false, slot: "back", bonus: { featherFall: 1 }, info: "falls never hurt you",
                   needs: "glide 4 tiles from a height in 3D (player.js)" },
  banner:        { name: "banner", armour: 0, str: 0, tier: 3, metal: false, slot: "back", rally: 1,
                   needs: "allies +1 damage while you carry it (combat.js, followers)" },
  // Arms
  buckler:       { name: "buckler", armour: 0, str: 9, tier: 2, metal: true, slot: "arm", block: 0.2,
                   needs: "blocks 20% of blows (combat.js)" },
  climbingHooks: { name: "climbing hooks", armour: 0, str: 0, tier: 2, metal: true, slot: "arm", climb: 2,
                   needs: "climb 2 blocks on the map, grab walls in 3D (turns.js, player.js)" },
  // Hands
  examiningKit:  { name: "examining kit", armour: 0, str: 0, tier: 1, metal: false, slot: "gloves", bonus: { examine: 2 } },
  inkGloves:     { name: "ink-gloves", armour: 0, str: 0, tier: 4, metal: false, slot: "gloves", markers: true,
                   needs: "place markers that flat followers can see and use (screens/play.js markers, followers)" },
  // Feet
  stiltSandals:  { name: "stilt sandals", armour: 0, str: 0, tier: 1, metal: false, slot: "feet", bonus: { jump: 0.5 } },
  stiltBoots:    { name: "stilt boots", armour: 0, str: 0, tier: 3, metal: false, slot: "feet", bonus: { jump: 1 }, info: "you climb 2 on the map" },
  saltShoes:     { name: "salt-shoes", armour: 0, str: 0, tier: 2, metal: false, slot: "feet", crust: true,
                   needs: "walk on brine and glass crust without breaking it (C1a's crust terrain)" },
  gripSoles:     { name: "grip-soles", armour: 0, str: 0, tier: 4, metal: false, slot: "feet", grip: true,
                   needs: "no slipping, no knockback (WS8's knockback, glim's slip)" },
  // Neck (a document pinned where an amulet hangs)
  assizeWrit:    { name: "Assize writ", armour: 0, str: 0, tier: 2, metal: false, slot: "neck", wornRep: { assize: 100, bentVillages: -100 },
                   needs: "Assize +100, the Bent villages -100 while worn (the worn reputation hook)" },
};

// What a piece is worth in glim before its material (bible §3.1; × MATERIALS[made].value for forged gear). The
// parent's gear keeps the parent's prices when it has no material (items/legacy.js gearPrice).
export const VALUE = {
  dagger: 20, stylus: 12, shortsword: 40, longsword: 80, mace: 45, maul: 110, staff: 25, handAxe: 35, waraxe: 100,
  spear: 45, glaive: 110, greatsword: 140, lanternFlail: 70,
  chain: 70, scale: 110, plate: 160, helm: 40, boltBow: 90,
};

// What examine says of a class or a piece (bible §2: plain, at most 3 sentences; about one in five from above). The
// parent's pieces have theirs here too, so the bible's names read the same in both worlds.
export const TEXT = {
  dagger: "A short blade. It goes where the light doesn't.",
  stylus: "A writing point, sharpened past writing.",
  shortsword: "Worn at the grip by many hands. From above it is a short line.",
  longsword: "Balanced a hand above the guard.",
  mace: "It argues with armour and usually wins.",
  maul: "Subtlety was considered and set aside.",
  staff: "Pilgrims lean on it until they swing it.",
  handAxe: "A reedcutter's axe, for work done twice a day.",
  waraxe: "Made for people rather than reeds.",
  spear: "From above it is a dot that arrives first.",
  glaive: "For keeping a decision at arm's length and a half.",
  greatsword: "Carried on the shoulder, swung with the whole back.",
  lanternFlail: "For people who want to bring the light to someone personally.",
  clothes: "They have seen worse.",
  leather: "Boiled leather, stiff at the elbows.",
  chain: "Rings on rings. It sounds like rain when you run.",
  scale: "Like a fish that took up a trade.",
  plate: "Shaped for a body not quite yours.",
  helm: "It rings when struck, which is the point.",
  plumbHelm: "Cut to a true level. It never sits crooked, even on you.",
  lampCrownHat: "For reading in the dark with both hands.",
  featheredHood: "The Kites take it as good manners.",
  reedHat: "It keeps the noon off.",
  copperCap: "Green where it sits.",
  ironHelm: "For a face you mean to keep.",
  goggles: "The dark looks a little less dark.",
  monocle: "Things look smaller and more honest through it.",
  saltVeil: "It turns noon into a long afternoon.",
  sporeVeil: "Spores find it disagreeable.",
  hourMask: "Worn smooth inside by its last face.",
  glassScale: "Arrows skid. From above it is a puddle.",
  pleatedCoat: "Folded so often it has forgotten its weight.",
  cloak: "It makes you a shape rather than a person.",
  reedCloak: "In the reeds it is mostly reeds.",
  featherCloak: "Moulted over many years and one argument.",
  mapCase: "It keeps the maps dry and you honest.",
  kiteGlider: "It makes falling a slower kind of falling.",
  banner: "People nearby stand straighter.",
  bracers: "Scuffed on the inside of the wrist.",
  buckler: "For the blows you saw coming.",
  climbingHooks: "For walls that wanted no visitors.",
  gloves: "You keep a better grip in them.",
  gauntlets: "A fist in them is a small mace.",
  examiningKit: "The Archive's whole method, folded.",
  inkGloves: "What you touch, the flat can find.",
  sandals: "The salt gets in anyway.",
  boots: "Salt-white to the ankle.",
  stiltSandals: "Rustback work. You walk a little above things.",
  stiltBoots: "The ground becomes a suggestion.",
  saltShoes: "For crust that would rather not be walked on.",
  gripSoles: "They do not agree to move.",
  assizeWrit: "Sealed in quicksilver. It vouches for you, loudly.",
};

// The line an item's info shows for its material: "copper: soft and green".
export const materialLine = (made) => (MATERIALS[made] ? `${MATERIALS[made].name}: ${MATERIALS[made].info}` : "");
export const isForged = (kind, id) => kind === "weapon" || !!FORGED[kind]?.includes(id);
