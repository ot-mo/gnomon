// The real world's gear (bible §13.1-§13.3; TECH_DESIGN §2.18 "content/items/*.js"; C4): the material ladder, the
// weapon classes and the armour for every body slot. Plain tables with no imports, so any module can read them while
// the item modules are still loading (items/legacy.js spreads the new weapons and armour into its tables).
//
// A piece of gear is a class or a piece (a WEAPONS or ARMOURS id) and, in the real world, a material:
//   { kind: "weapon", id: "handAxe", made: "copper", material: 0, ench, known, … }
//     made       a MATERIALS id: what it is made of (its name, price, colour; armour's +AV)
//     material   the damage the material adds to a weapon (combat.js weaponSpec and missiles.js read this number:
//                "the weapon range + material + floor((STR − req) / 2) + enchantment", DECISIONS §1; since the light-weapon
//                fix, 2026-10-30, material and STR over 10 × the swing ÷ RULES.d20.swingRef, rounded); items/gear.js
//                makeGear sets it from `made`
// The parent's gear has no `made`, so the test world's legacy stack, golden (b) and the legacy fights see the parent's
// items exactly as before.
//
//   MATERIALS[id] = { name, tier, dmg, av, value, color, info, bonus?, strReq?, needs? }
//     tier     bible §13.1's tier (1-8): the zones of that tier find it most often (items/gear.js randomGear)
//     dmg      what it adds to a weapon's damage; av: what it adds to a forged armour piece (FORGED.armour)
//     value    the price multiplier over the class's copper value (VALUE): bible §3.1's anchors are a copper short
//              sword at 40 and an iron longsword at 120
//     info     what the item's line says of it (only what the game does: a rule still to be built is in `needs`);
//              weaponInfo: what a weapon of it adds to that (noonsilver's cut: the bonus below is the weapon kind's)
//     bonus    to the stat bus while a weapon of it is wielded (noonsilver cuts flat beings: creatures.js reads cutsFlat)
//     strReq   pleatmetal's −3 STR requirement (items.js strNeeded doesn't read it yet: docs/c4.md)
//     needs    the rest of the bible's line, for the code that will do it (docs/c4.md, integration requests)
export const MATERIALS = {
  bone:       { name: "bone",       tier: 1, dmg: -1, av: 0, value: 0.5, color: [222, 212, 182], info: "cheap and light; 1 hit in 50 snaps it" },
  copper:     { name: "copper",     tier: 2, dmg: 0,  av: 0, value: 1,   color: [205, 125, 75],  info: "soft and green" },
  iron:       { name: "iron",       tier: 3, dmg: 1,  av: 0, value: 1.5, color: [150, 154, 168], info: "plain iron, honest and heavy",
                needs: "rusts in brine (-1) unless lacquered (liquids: brine touch)" },
  saltsteel:  { name: "saltsteel",  tier: 4, dmg: 2,  av: 1, value: 2,   color: [188, 206, 212], info: "brine-tempered by the Drovers; it never rusts" },
  blackglass: { name: "blackglass", tier: 5, dmg: 3,  av: 1, value: 3,   color: [78, 70, 98],    info: "a Glass Sea razor; a crit on armour 4 or more chips it" },
  truesteel:  { name: "truesteel",  tier: 6, dmg: 4,  av: 2, value: 4,   color: [214, 224, 240], info: "Deepwright alloy; it ignores a point of armour" },
  pleatmetal: { name: "pleatmetal", tier: 7, dmg: 5,  av: 2, value: 5.5, color: [176, 146, 206], info: "folded a thousand times; -3 STR needed", strReq: -3,
                needs: "draws as a hairline on the map (renderMap.js)" },
  noonsilver: { name: "noonsilver", tier: 8, dmg: 6,  av: 3, value: 7.5, color: [255, 244, 206], info: "it casts no shadow",
                weaponInfo: "it cuts flat beings in 3D", bonus: { cutsFlat: 1 },
                needs: "glows at noon (hud.js, render3d.js); a noonsilver bolt cutting flat beings too (combat.js passes `blade` for melee only)" },
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
  // (B1: combat.js builds each class's blows; the powers named in brackets open the rest, bible §10.8)
  shortBlade: { name: "short blade", info: "the fastest swing; x2 on the unaware from the dark (Bleed: crits bleed)" },
  longBlade:  { name: "long blade", info: "Riposte: strike in the 0.2 s before a blow lands and it is cancelled" },
  cudgel:     { name: "cudgel", info: "Daze: dazes for 1 s", needs: "smashes crates and cracked walls (Wallbreaker: interact.js, WS10's crates and cracked walls)" },
  axe:        { name: "axe", info: "Cleave: half a blow to a second foe; Disarm: armed foes drop their weapon" },
  polearm:    { name: "polearm", info: "a long reach; High ground: +50% from a ledge above", needs: "holds chargers off (Brace: ai.js, C3's chargers)" },
  greatBlade: { name: "great blade", info: "slow and heavy; knocks the target back a tile" },
  flail:      { name: "lantern-flail", info: "x2 against shades and ghosts; useless with the torch out", needs: "is your torch; each swing sweeps light around you (torch.js, light.js, render3d.js)" },
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
    name: "stylus", dmg: [2, 3], swing: 0.3, reach: 1.4, str: 6, tier: 0,
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
//            that Hour's favoured factions, −hourRep with its hated ones: the mask's `hour`, a ruler id); social/reputation.js
//            syncWornRep applies it (B1)
//   needs    the rest of the bible's line, for the code (docs/c4.md)
// A piece that does nothing yet (only `needs`) stays out of the real world's loot until it does (items/gear.js useful).
export const GEAR_ARMOURS = {
  // Head
  helm:          { name: "close helm", armour: 2, str: 12, tier: 4, metal: true, slot: "head" },   // (forged: "saltsteel close helm", never the parent's "iron helm" twice)
  plumbHelm:     { name: "plumb-helm", armour: 3, str: 13, tier: 6, metal: true, slot: "head" },
  lampCrownHat:  { name: "lamp crown", armour: 0, str: 0, tier: 4, metal: true, slot: "head", bonus: { torch: 1 / 3 }, info: "your torch reaches 2 tiles further" },
  featheredHood: { name: "feathered hood", armour: 0, str: 0, tier: 2, metal: false, slot: "head", veil: true, wornRep: { kites: 250 },
                   info: "the Kites +250 while you wear it" },
  // Face
  monocle:       { name: "examiner's monocle", armour: 0, str: 0, tier: 3, metal: true, slot: "face", bonus: { examine: 3 } },
  saltVeil:      { name: "salt veil", armour: 0, str: 0, tier: 2, metal: false, slot: "face", veil: true, glare: true,
                   needs: "cancels the noon glare (WS1's glare in the Waste and on the Glass shore)" },
  sporeVeil:     { name: "spore veil", armour: 0, str: 0, tier: 3, metal: false, slot: "face", veil: true, spores: true,
                   needs: "immune to spores (C3's spore creatures and clouds)" },
  hourMask:      { name: "Hour mask", armour: 0, str: 0, tier: 4, metal: false, slot: "face", wornRep: "hour", hourRep: 200,
                   info: "+200 with its Hour's favoured factions, -200 with its hated ones while you wear it" },
  // Body
  glassScale:    { name: "glass-scale", armour: 3, str: 14, tier: 5, metal: false, slot: "body", bonus: { ward: 1 }, reflect: 0.15,
                   info: "turns 15% of arrows and bolts aside; the rest do 1 less" },   // (reflect: combat.js turnedAside, B1)
  pleatedCoat:   { name: "pleated coat", armour: 2, str: 10, tier: 7, metal: true, slot: "body", bonus: { dv: 1 } },
  // Back
  reedCloak:     { name: "reed cloak", armour: 0, str: 0, tier: 1, metal: false, slot: "back", bonus: { stealth: 0.1 } },
  featherCloak:  { name: "feather cloak", armour: 0, str: 0, tier: 3, metal: false, slot: "back", bonus: { stealth: 0.05 }, wornRep: { kites: 250 },
                   info: "the Kites +250 while you wear it" },
  // (navigation is taken off a chance: overworld/lost.js; a compass-ring is 0.05, bible §15.6's "-5 points")
  mapCase:       { name: "map case", armour: 0, str: 0, tier: 1, metal: false, slot: "back", bonus: { navigation: 0.03 }, info: "you get lost less on the world map" },
  kiteGlider:    { name: "kite-glider", armour: 0, str: 0, tier: 4, metal: false, slot: "back", bonus: { featherFall: 1 }, info: "falls never hurt you",
                   needs: "glide 4 tiles from a height in 3D (player.js)" },
  pack:          { name: "pack", armour: 0, str: 0, tier: 1, metal: false, slot: "back", carry: 30,
                   needs: "+30 carry, once carrying is limited (RULES.encumbrance is off: stats.js carryCap is read by nothing yet)" },
  banner:        { name: "banner", armour: 0, str: 0, tier: 3, metal: false, slot: "back", rally: 1,
                   needs: "allies +1 damage while you carry it (combat.js, followers)" },
  // Arms
  buckler:       { name: "buckler", armour: 0, str: 9, tier: 2, metal: true, slot: "arm", block: 0.2,
                   info: "takes a fifth of the blows that would land on you" },   // (block: combat.js turnedAside, B1)
  climbingHooks: { name: "climbing hooks", armour: 0, str: 0, tier: 2, metal: true, slot: "arm", climb: 2, info: "you climb 2 on the map",
                   needs: "grab walls in 3D (player.js)" },   // (the map's climb: turns.js, B1)
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
                   info: "the Assize +100 and the Bent villages -100 while you wear it" },
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
  stylus: "A writing point, sharpened past writing. From above it is a full stop.",
  shortsword: "Worn at the grip by many hands. From above it is a short line.",
  longsword: "Balanced a hand above the guard.",
  mace: "It argues with armour and usually wins. From above, a knot.",
  maul: "Subtlety was considered and set aside.",
  staff: "Pilgrims lean on it until they swing it. From above it is a line you can walk.",
  handAxe: "A reedcutter's axe, for work done twice a day.",
  waraxe: "Made for people rather than reeds.",
  spear: "From above it is a dot that arrives first.",
  glaive: "For keeping a decision at arm's length and a half.",
  greatsword: "Carried on the shoulder, swung with the whole back. From above, a long dash.",
  lanternFlail: "For people who want to bring the light to someone personally.",
  clothes: "They have seen worse.",
  leather: "Boiled leather, stiff at the elbows.",
  chain: "Rings on rings. It sounds like rain when you run.",
  scale: "Like a fish that took up a trade.",
  plate: "Shaped for a body not quite yours. From above you are a lid.",
  helm: "It rings when struck, which is the point.",
  plumbHelm: "Cut to a true level. It never sits crooked, even on you.",
  lampCrownHat: "For reading in the dark with both hands.",
  featheredHood: "The Kites take it as good manners.",
  reedHat: "It keeps the noon off. From above you are a hat.",
  copperCap: "Green where it sits.",
  ironHelm: "For a face you mean to keep.",
  goggles: "The dark looks a little less dark.",
  monocle: "Things look smaller and more honest through it.",
  saltVeil: "It turns noon into a long afternoon.",
  sporeVeil: "Spores find it disagreeable.",
  hourMask: "Worn smooth inside by its last face.",
  glassScale: "Arrows skid. From above it is a puddle.",
  pleatedCoat: "Folded so often it has forgotten its weight.",
  cloak: "It makes you a shape rather than a person. From above, a smaller shape.",
  reedCloak: "In the reeds it is mostly reeds.",
  featherCloak: "Moulted over many years and one argument.",
  mapCase: "It keeps the maps dry and you honest. From above it holds another above.",
  kiteGlider: "It makes falling a slower kind of falling. From above it is a kite with ideas.",
  pack: "Canvas and two straps. Room for more than you should carry.",
  banner: "People nearby stand straighter.",
  bracers: "Scuffed on the inside of the wrist.",
  buckler: "For the blows you saw coming. From above, a coin.",
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

// The line an item's info shows for its material: "copper: soft and green" (a weapon's with its weaponInfo).
export const materialLine = (made, kind = null) => {
  const d = MATERIALS[made];
  return d ? `${d.name}: ${d.info}${kind === "weapon" && d.weaponInfo ? `; ${d.weaponInfo}` : ""}` : "";
};
export const isForged = (kind, id) => kind === "weapon" || !!FORGED[kind]?.includes(id);

// --- Requirements and scaling (B4, the attribute set only: items.js requirements, scaling) ------------------------------
// Every weapon, missile weapon and armour piece asks for attributes (bible §10.6's six) under RULES.stats "attributes";
// the legacy set keeps the parent's single STR number (WEAPONS[id].str, ARMOURS[id].str). Not met, an item is used
// badly, not refused (combat.js: to-hit, damage, the class's power; stats.js: armour). A weapon's attribute bonus is
// its scaling: a grade a letter, GRADES its share of (attribute − RULES.d20.strOver) ÷ 2 a blow.
//   REQUIRES[id] = { attr: n }   SCALING[id] = { attr: letter }   (an id with no row asks for nothing / doesn't scale)
// A material shifts both as an affinity does (MATERIAL_REQ[made]: req { attr: ±n } on what the item asks, min { attr: n }
// a floor it adds, grade { attr: ±steps }, from E for an attribute it didn't scale with); a "light"
// armour asks 3 less STR (PROPERTIES.light).
export const GRADES = { S: 1.2, A: 1, B: 0.8, C: 0.6, D: 0.4, E: 0.2 };
export const GRADE_ORDER = ["E", "D", "C", "B", "A", "S"];
export const REQUIRES = {
  // Weapons: light (any start that hasn't left the attribute low), medium (a start built for it), heavy (a strong start),
  // great (growth first)
  dagger: { str: 10, agi: 18 }, stylus: { agi: 15, int: 18 }, shortsword: { str: 16, agi: 16 }, handAxe: { str: 17, tou: 15 },
  staff: { str: 12, wil: 17 }, mace: { str: 20, tou: 16 }, spear: { str: 16, agi: 19 }, lanternFlail: { str: 15, wil: 18 },
  longsword: { str: 21, agi: 17 }, waraxe: { str: 23, tou: 18 }, glaive: { str: 21, agi: 21 }, greatsword: { str: 27, tou: 18 },
  maul: { str: 29, tou: 20 },
  // Missile weapons
  sling: { agi: 16 }, boltBow: { str: 14, int: 19 },
  // Armour
  leather: { str: 15 }, chain: { str: 19, tou: 17 }, scale: { str: 22, tou: 19 }, plate: { str: 26, tou: 20 },
  copperCap: { str: 14 }, ironHelm: { str: 17 }, helm: { str: 18, tou: 16 }, plumbHelm: { str: 18, tou: 20 },
  bracers: { str: 15 }, gauntlets: { str: 18 }, boots: { str: 13 }, buckler: { str: 15, agi: 18 },
  glassScale: { agi: 20, tou: 17 }, pleatedCoat: { agi: 22 },
  lampCrownHat: { wil: 19 }, monocle: { int: 19 }, examiningKit: { int: 17 }, hourMask: { ego: 20 },
  kiteGlider: { agi: 18 }, climbingHooks: { str: 16, agi: 16 }, stiltSandals: { agi: 15 }, stiltBoots: { agi: 19 },
};
export const SCALING = {
  dagger: { agi: "B", str: "E" }, stylus: { int: "C", agi: "D" }, shortsword: { str: "C", agi: "C" }, handAxe: { str: "B", tou: "E" },
  staff: { str: "D", wil: "C" }, mace: { str: "B", tou: "D" }, spear: { agi: "C", str: "C" }, lanternFlail: { wil: "B", str: "D" },
  longsword: { str: "B", agi: "D" }, waraxe: { str: "A", tou: "E" }, glaive: { str: "C", agi: "B" }, maul: { str: "S" },
  greatsword: { str: "A", tou: "D" },
};
// The materials' shifts (an affinity's: bone and pleatmetal lighter, truesteel heavier, blackglass keen, noonsilver
// asks for will).
export const MATERIAL_REQ = {
  bone: { req: { str: -2 } },
  blackglass: { req: { agi: 2 }, grade: { agi: 1, str: -1 } },
  truesteel: { req: { str: 2 }, grade: { str: 1 } },
  pleatmetal: { req: { str: -3 }, grade: { agi: 1 } },
  noonsilver: { min: { wil: 16 }, grade: { wil: 1 } },
};
