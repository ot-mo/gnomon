// Powers (bible §10.8; TECH_DESIGN §2.4 `powers`, §1.2 "perks become powers content"; WS4, then C4): the parent's
// perks, grown into 16 trees. There are no skill points: each level you pick one of the powers offered
// (leveling.js offerPowers), drawn from your open trees (your background opens two; teachers open more, WS6b)
// and the general pool.
//
//   POWERS[id] = { name, info, tree, general?, major?, max?, bonus?(rank) → { key: n }, needs? }
//   tree          a TREES id (null for the general pool's Mighty)
//   general       also in the general pool, whatever trees are open (Tough, Mighty)
//   major         a milestone power: offered only at levels 5, 10, 15… (one among the offers)
//   max           how many ranks (default 1); bonus(rank): what it adds to the stat bus (stats.js, the "powers"
//                 source reads player.perks and perkRank); powers without one are read where they act
//                 (hasKey(p.perks, id): combat, potions, the torch, the shop…)
//   needs         what the power waits for before it does anything: the code that will read it (C4 named each, with
//                 every Phase 1 workstream merged; docs/c4.md lists them for the integrator). It is listed so the
//                 trees are whole, and never offered until `needs` is gone
// LEGACY_PERKS: the parent's 25 perks in the parent's order. The legacy set (RULES.stats = "legacy") offers only these,
// shuffled with Math.random as the parent did, so golden (a) and the recorded frames stay as they were.
import { RULES } from "../rules.js";

export const TREES = {
  blades: { name: "Blades" }, bludgeon: { name: "Bludgeon" }, axe: { name: "Axe" }, polearm: { name: "Polearm" },
  missile: { name: "Missile" }, throwing: { name: "Throwing" }, tumbling: { name: "Tumbling" }, shadowcraft: { name: "Shadowcraft" },
  glimcraft: { name: "Glimcraft" }, survey: { name: "Survey" }, lore: { name: "Lore" }, leechcraft: { name: "Leechcraft" },
  artificing: { name: "Artificing" }, pathcraft: { name: "Pathcraft" }, parley: { name: "Parley" }, hardiness: { name: "Hardiness" },
};

export const POWERS = {
  // --- The parent's perks (in its order: LEGACY_PERKS) ---
  swimmer:      { tree: "hardiness", name: "Swimmer",       info: "Deep water no longer drags you down: you can swim in it (slowly).", bonus: () => ({ swim: 1 }) },
  brightTorch:  { tree: "glimcraft", name: "Bright torch",  info: "Your torch burns brighter and reaches half again as far.", bonus: () => ({ torch: 0.5 }) },
  tough:        { tree: "hardiness", general: true, name: "Tough", info: "+8 max HP.", max: 3 },
  mighty:       { tree: null, general: true, name: "Mighty", info: "+2 STR.", max: 2 },
  fleet:        { tree: "tumbling",  name: "Fleet-footed",  info: "You move 20% faster, in 3D and on the map.", bonus: () => ({ speed: 0.2 }) },
  stealthy:     { tree: "shadowcraft", name: "Stealthy",    info: "Monsters have to be 30% closer to notice you.", bonus: () => ({ stealth: 0.3 }) },
  leaper:       { tree: "tumbling",  name: "High jumper",   info: "You jump a block higher, about 2.5 (and climb 2 blocks on the map).", bonus: () => ({ jump: 1 }) },
  regen:        { tree: "leechcraft", name: "Regeneration", info: "You slowly heal: 1 HP every 6 seconds (every 3 at rank II).", max: 2, bonus: (r) => ({ regen: 2 * r }) },
  cartographer: { tree: "survey",    name: "Cartographer",  info: "Chasms and pits show on the map as soon as you see them, from either view." },
  quick:        { tree: "blades",    name: "Quick strikes", info: "Your attacks are 20% faster.", max: 2, bonus: (r) => ({ swing: 0.2 * r }) },
  ironSkin:     { tree: "hardiness", name: "Iron skin",     info: "+1 armour, always.", max: 2, bonus: (r) => ({ armour: r }) },
  featherFall:  { tree: "tumbling",  name: "Feather fall",  info: "Falling never hurts you.", bonus: () => ({ featherFall: 1 }) },
  keenEye:      { tree: "blades",    name: "Keen eye",      info: "+8% chance to land a critical hit (double damage).", max: 2, bonus: (r) => ({ crit: 0.08 * r }) },
  executioner:  { tree: "axe",       name: "Executioner",   info: "+50% damage against monsters below a quarter of their health." },
  juggler:      { tree: "throwing",  name: "Knife juggler", info: "Thrown knives do +2 damage, and you throw twice as fast." },
  demolitionist:{ tree: "throwing",  name: "Demolitionist", info: "Your bombs blast wider, and hurt you only half as much." },
  alchemist:    { tree: "leechcraft", name: "Alchemist",    info: "Potions of healing heal half again as much (18 HP)." },
  scholar:      { tree: "lore",      name: "Scholar",       info: "You can tell whether an unread scroll is good, neutral or bad." },
  haggler:      { tree: "parley",    name: "Haggler",       info: "Pell charges you a fifth less, for goods and services." },
  thickBlood:   { tree: "hardiness", name: "Thick blood",   info: "Poison hurts you only half as often." },
  nightEyes:    { tree: "shadowcraft", name: "Night eyes",  info: "With your torch out you can still see a little way around you.", bonus: () => ({ darkSight: 2 }) },
  // Major perks: only offered at milestones (levels 5, 10, 15…).
  secondWind:   { tree: null, major: true, name: "Second wind",   get info() { return `A blow that would kill you leaves you on 1 HP instead (at most once every ${RULES.cooldown.secondWind / 60} minutes).`; } },
  lucky:        { tree: null, major: true, name: "Lucky",         info: "Monsters drop loot twice as often, and the gear they drop is more often blessed." },
  foldingStrike:{ tree: null, major: true, name: "Folding strike", info: "Turning the world (Tab) stuns every monster next to you for 2 s (every 10 s at most)." },
  giantSlayer:  { tree: null, major: true, name: "Giant slayer",  info: "+30% damage against elites, guardians and the Lich King." },

  // --- The bible's other powers. Those with a bonus the game already reads work now; the rest wait (needs). ---
  crushing:     { tree: "bludgeon",  name: "Crushing",      info: "Double damage to the brittle (skeletons, golems).", bonus: () => ({ crush: 1 }) },
  longReach:    { tree: "polearm",   name: "Long reach",    info: "+0.4 reach.", bonus: () => ({ reach: 0.4 }) },
  // (B1: combat.js builds the class's blows these name; each works with its class only)
  bleed:        { tree: "blades",    name: "Bleed",         info: "Short blades make a target bleed for 3 s on a critical hit (1 a second)." },
  riposte:      { tree: "blades",    name: "Riposte",       info: "Long blades: strike in the 0.2 s before a blow lands, and it's cancelled." },
  daze:         { tree: "bludgeon",  name: "Daze",          info: "Cudgels: a blow dazes the target for 1 s, a quarter of the time." },
  wallbreaker:  { tree: "bludgeon",  name: "Wallbreaker",   info: "Smash crates and cracked walls; at rank II open secret rooms without bombs.", max: 2, needs: "smashing crates and cracked walls with a cudgel (interact.js; rank II WS10's secret rooms)" },
  cleave:       { tree: "axe",       name: "Cleave",        info: "Axes: a second enemy next to you takes half the blow." },
  disarm:       { tree: "axe",       name: "Disarm",        info: "Axes: armed foes you strike sometimes drop their weapon (half damage for 10 s)." },
  highGround:   { tree: "polearm",   name: "High ground",   info: "Polearms: +50% damage striking from a ledge above." },
  brace:        { tree: "polearm",   name: "Brace",         info: "Chargers stop on your point.", needs: "chargers stopping on your point (ai.js charges, combat.js)" },
  // (check-content holds every bonus key to stats.js BONUS_KEYS, so `bonus: () => ({ missileAcc: 2 })` comes with the key)
  steadyHand:   { tree: "missile",   name: "Steady hand",   info: "+2 to hit with slings and bolt-bows.", bonus: () => ({ missileAcc: 2 }) },
  pin:          { tree: "missile",   name: "Pin",           info: "Your bolts pin what they hit for 2 s.", needs: "a pin beyond the bolt-bow's own 2 s (missiles.js onHit; the balance pass: say +1 s, or slings' stones too)" },
  glimgunner:   { tree: "missile",   name: "Glimgunner",    info: "The glimgun costs 1 glim for every 2 shots.", needs: "a glim every second shot (bodymods/artifacts.js EFFECTS.glimgun; the Lamplighter's kit holds one)" },
  returnDisc:   { tree: "throwing",  name: "Return",        info: "Thrown discs come back to your hand.", needs: "discs, a thrown kind that bounces to a second target (throwing.js; the item is C4's once it is)" },
  roll:         { tree: "tumbling",  name: "Roll",          info: "A dodge-roll in 3D.", needs: "a dodge-roll in 3D (player.js)" },
  darkBackstab: { tree: "shadowcraft", name: "Dark backstab", info: "Double damage against an unaware target while your torch is out, with any weapon." },
  faintRunes:   { tree: "shadowcraft", name: "Faint runes", info: "Runes show faintly while your torch is lit.", needs: "runes drawn faintly with the torch lit (materials.js, render3d.js; the dark lens's too)" },
  thriftyWick:  { tree: "glimcraft", name: "Thrifty wick",  info: "Your torch costs half as much glim.", bonus: () => ({ torchCost: -0.5 }) },
  kindleAtRange:{ tree: "glimcraft", name: "Kindle at range", info: "Light braziers from 4 tiles away.", needs: "lighting a brazier from 4 tiles (interact.js; Kindle the mutation reaches 5 + level)" },
  oilFire:      { tree: "glimcraft", name: "Oil fire",      info: "Set glim puddles alight.", needs: "glim puddles that burn when lit (C2's glim liquid burns for 6 s if lit: social/liquids.js, status burning)" },
  keenEyeSites: { tree: "survey",    name: "Keen Eye",      info: "You find hidden sites twice as often on the road (20%)." },   // (overworld/encounters.js reads it)
  readHeights:  { tree: "survey",    name: "Read heights",  info: "For 10 s after a look in 3D, map tiles show their height as a digit.", needs: "height digits on the map for 10 s after a look in 3D (renderMap.js; the height lens's too)" },
  hourScript:   { tree: "lore",      name: "Hour script",   info: "You read one more account on every stele.", needs: "one more account read on every stele (story: WS7's steles)" },
  gossip:       { tree: "lore",      name: "Gossip",        info: "One free rumour in every village.", needs: "a free rumour in every village (story/gossip.js's talk option)" },
  triangulator: { tree: "lore",      name: "Triangulator",  info: "Triangulating an event gives twice the XP.", needs: "double XP for a triangulation (story: its xpReward)" },
  staunch:      { tree: "leechcraft", name: "Staunch",      info: "You stop bleeding.", needs: "a bleeding status to stop (status.js)" },
  brew:         { tree: "leechcraft", name: "Brew",         info: "Mix tonics at a village oven.", needs: "mixing tonics at a village oven (a service: social/villages, content/items/tonics.js TONICS)" },
  repair:       { tree: "artificing", name: "Repair",       info: "Mend your gear: E on a snapped weapon, a chipped edge or a broken artifact." },
  recharge:     { tree: "artificing", name: "Recharge",     info: "Refill cells with glim.", needs: "filling sun and dark cells from glim as well (bodymods/artifacts.js fillCell fills glim cells only)" },
  keenFingers:  { tree: "artificing", name: "Keen fingers", info: "+3 to examine artifacts.", bonus: () => ({ examine: 3 }) },
  mod:          { tree: "artificing", name: "Mod",          info: "Add one property to an item.", needs: "adding one property to an item (an item action over items.js PROPERTIES)" },
  pathfinder:   { tree: "pathcraft", name: "Pathfinder",    info: "You travel half again as far in an hour.", bonus: () => ({ travel: 0.5 }) },   // (overworld/travel.js)
  terrainLore:  { tree: "pathcraft", name: "Terrain lore",  info: "Three quarters less likely to get lost in one terrain (once for each terrain)." },   // (overworld/lost.js)
  homingSense:  { tree: "pathcraft", name: "Homing sense",  info: "Half the time you find your way again at once when lost." },   // (overworld/lost.js)
  warmHands:    { tree: "parley",    name: "Warm Hands",    info: "Later Kindlings go 20 further." },   // (social/ritual.js reads it)
  intimidate:   { tree: "parley",    name: "Intimidate",    info: "Make the weak think twice.", needs: "the weak thinking twice: a morale or flee check (ai.js)" },
  chime:        { tree: "parley",    name: "Chime",         info: "Recruit by preaching.", needs: "recruiting by preaching (social: C2's Chime, the followers)" },
};

export const LEGACY_PERKS = ["swimmer", "brightTorch", "tough", "mighty", "fleet", "stealthy", "leaper", "regen", "cartographer",
  "quick", "ironSkin", "featherFall", "keenEye", "executioner", "juggler", "demolitionist", "alchemist", "scholar", "haggler",
  "thickBlood", "nightEyes", "secondWind", "lucky", "foldingStrike", "giantSlayer"];

// The powers of a tree, in the table's order.
export const powersOfTree = (tree) => Object.keys(POWERS).filter((id) => POWERS[id].tree === tree);
