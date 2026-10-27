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
//   needs         what the power waits for before it does anything (another workstream's hook, or content): it is
//                 listed so the trees are whole, and never offered until `needs` is gone
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
  // (Under the attribute set the price multiplier (stats.js priceMul) doesn't read it yet: docs/ws4.md, integration requests.)
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
  bleed:        { tree: "blades",    name: "Bleed",         info: "Short blades make a target bleed for 3 s on a critical hit.", needs: "a bleeding status (WS8, C4)" },
  riposte:      { tree: "blades",    name: "Riposte",       info: "Long blades: strike in the 0.2 s before a blow lands, and it's cancelled.", needs: "WS8" },
  daze:         { tree: "bludgeon",  name: "Daze",          info: "A blow dazes the target for 1 s, a quarter of the time.", needs: "WS8 (an on-hit status for your blows)" },
  wallbreaker:  { tree: "bludgeon",  name: "Wallbreaker",   info: "Smash crates and cracked walls; at rank II open secret rooms without bombs.", max: 2, needs: "WS10" },
  cleave:       { tree: "axe",       name: "Cleave",        info: "A second enemy next to you takes half the blow.", needs: "WS8" },
  disarm:       { tree: "axe",       name: "Disarm",        info: "People you strike sometimes drop their weapon.", needs: "WS8" },
  highGround:   { tree: "polearm",   name: "High ground",   info: "+50% damage striking from a ledge above.", needs: "WS8" },
  brace:        { tree: "polearm",   name: "Brace",         info: "Chargers stop on your point.", needs: "WS8" },
  // (check-content holds every bonus key to stats.js BONUS_KEYS, so `bonus: () => ({ missileAcc: 2 })` comes with the key)
  steadyHand:   { tree: "missile",   name: "Steady hand",   info: "+2 to hit with slings and bolt-bows.", bonus: () => ({ missileAcc: 2 }) },
  pin:          { tree: "missile",   name: "Pin",           info: "Your bolts pin what they hit for 2 s.", needs: "WS8" },
  glimgunner:   { tree: "missile",   name: "Glimgunner",    info: "The glimgun costs 1 glim for every 2 shots.", needs: "a glimgun (WS8, C4)" },
  returnDisc:   { tree: "throwing",  name: "Return",        info: "Thrown discs come back to your hand.", needs: "discs (WS8, C4)" },
  roll:         { tree: "tumbling",  name: "Roll",          info: "A dodge-roll in 3D.", needs: "WS8" },
  darkBackstab: { tree: "shadowcraft", name: "Dark backstab", info: "Double damage against an unaware target while your torch is out.", needs: "WS8" },
  faintRunes:   { tree: "shadowcraft", name: "Faint runes", info: "Runes show faintly while your torch is lit.", needs: "WS3" },
  thriftyWick:  { tree: "glimcraft", name: "Thrifty wick",  info: "Your torch costs half as much glim.", bonus: () => ({ torchCost: -0.5 }) },
  kindleAtRange:{ tree: "glimcraft", name: "Kindle at range", info: "Light braziers from 4 tiles away.", needs: "WS10" },
  oilFire:      { tree: "glimcraft", name: "Oil fire",      info: "Set glim puddles alight.", needs: "WS6b" },
  keenEyeSites: { tree: "survey",    name: "Keen Eye",      info: "You find hidden sites twice as often on the road (20%).", needs: "WS1" },
  readHeights:  { tree: "survey",    name: "Read heights",  info: "For 10 s after a look in 3D, map tiles show their height as a digit.", needs: "WS3" },
  hourScript:   { tree: "lore",      name: "Hour script",   info: "You read one more account on every stele.", needs: "WS7" },
  gossip:       { tree: "lore",      name: "Gossip",        info: "One free rumour in every village.", needs: "WS7" },
  triangulator: { tree: "lore",      name: "Triangulator",  info: "Triangulating an event gives twice the XP.", needs: "WS7" },
  staunch:      { tree: "leechcraft", name: "Staunch",      info: "You stop bleeding.", needs: "a bleeding status (WS8, C4)" },
  brew:         { tree: "leechcraft", name: "Brew",         info: "Mix tonics at a village oven.", needs: "WS6b" },
  repair:       { tree: "artificing", name: "Repair",       info: "Mend your gear.", needs: "WS5" },
  recharge:     { tree: "artificing", name: "Recharge",     info: "Refill cells with glim.", needs: "WS5" },
  keenFingers:  { tree: "artificing", name: "Keen fingers", info: "+3 to examine artifacts.", bonus: () => ({ examine: 3 }) },
  mod:          { tree: "artificing", name: "Mod",          info: "Add one property to an item.", needs: "WS5" },
  pathfinder:   { tree: "pathcraft", name: "Pathfinder",    info: "You travel half again as far in an hour.", bonus: () => ({ travel: 0.5 }), needs: "WS1" },
  terrainLore:  { tree: "pathcraft", name: "Terrain lore",  info: "Three quarters less likely to get lost in one terrain (once for each terrain).", needs: "WS1" },
  homingSense:  { tree: "pathcraft", name: "Homing sense",  info: "Half the time you find your way again at once when lost.", needs: "WS1" },
  warmHands:    { tree: "parley",    name: "Warm Hands",    info: "Later Kindlings go 20 further.", needs: "WS6b" },
  intimidate:   { tree: "parley",    name: "Intimidate",    info: "Make the weak think twice.", needs: "WS6a" },
  chime:        { tree: "parley",    name: "Chime",         info: "Recruit by preaching.", needs: "WS6b" },
};

export const LEGACY_PERKS = ["swimmer", "brightTorch", "tough", "mighty", "fleet", "stealthy", "leaper", "regen", "cartographer",
  "quick", "ironSkin", "featherFall", "keenEye", "executioner", "juggler", "demolitionist", "alchemist", "scholar", "haggler",
  "thickBlood", "nightEyes", "secondWind", "lucky", "foldingStrike", "giantSlayer"];

// The powers of a tree, in the table's order.
export const powersOfTree = (tree) => Object.keys(POWERS).filter((id) => POWERS[id].tree === tree);
