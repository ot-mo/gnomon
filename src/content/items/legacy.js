// The parent game's items as content (TECH_DESIGN §2.9, §1.1 content/items/legacy.js): the tables
// (potions, scrolls, elements, weapons, armour, properties, rings, amulets, relics, floor art) and one
// item kind registered for every kind the parent game had, plus `cash` (a pile of glim).
// items.js re-exports the tables, so `import { WEAPONS } from "./items.js"` keeps working.
// Pixel art: one letter per pixel (a palette entry: [colour, glow]); a space is see-through.
//
// Every potion and scroll has an aura: "good", "neutral" or "bad". A potion of seeing lets you
// sense the auras of everything you're carrying, even before you know what it is.
import { registerItemKind, strNeeded } from "../../items.js";
import { raiseAttr, raiseMaxHp } from "../../stats.js";
import { CURRENCY } from "../currency.js";
import { RULES } from "../../rules.js";
import { receive, formatPrice, purseRoom } from "../../currency.js";

// --- Potions ----------------------------------------------------------------
// Each run shuffles which colour is which effect. Drinking one tells you, for the rest of the run.
export const POTIONS = {
  healing:   { name: "healing",   aura: "good",    weight: 28, info: "Heals 12 HP." },
  strength:  { name: "strength",  aura: "good",    weight: 6,  info: "Permanently adds 1 STR." },
  flying:    { name: "flying",    aura: "good",    weight: 11, info: "Fly for 20 s over chasms and deep water. Space rises, C sinks." },
  haste:     { name: "haste",     aura: "good",    weight: 9,  info: "Move and strike much faster for 15 s." },
  seeing:    { name: "seeing",    aura: "good",    weight: 11, info: "Reveals this floor, its monsters, and whether the things you carry are good or bad." },
  shadows:   { name: "shadows",   aura: "good",    weight: 8,  info: "Monsters struggle to notice you for 30 s." },
  descent:   { name: "descent",   aura: "neutral", weight: 6,  info: "You sink through the floor to the one below." },
  poison:    { name: "poison",    aura: "bad",     weight: 9,  info: "Makes you sick: you lose health for a while." },
  paralysis: { name: "paralysis", aura: "bad",     weight: 6,  info: "You can't move for 5 s." },
  darkness:  { name: "darkness",  aura: "bad",     weight: 6,  info: "Your torch shrinks to a glimmer for 40 s (though monsters see you less, too)." },
};
export const POTION_COLORS = [
  { name: "crimson", rgb: [225, 40, 60] },
  { name: "azure",   rgb: [60, 140, 255] },
  { name: "emerald", rgb: [40, 205, 100] },
  { name: "amber",   rgb: [240, 160, 40] },
  { name: "violet",  rgb: [175, 80, 240] },
  { name: "murky",   rgb: [125, 115, 60] },
  { name: "pearly",  rgb: [230, 230, 245] },
  { name: "golden",  rgb: [255, 210, 60] },
  { name: "teal",    rgb: [40, 190, 190] },
  { name: "rusty",   rgb: [170, 85, 40] },
];

// --- Scrolls ----------------------------------------------------------------
// Each run gives every kind of scroll a random title. Reading one tells you what it was.
export const SCROLLS = {
  uncurse:  { name: "remove curse",  aura: "good",    weight: 12, info: "Lifts every curse from the things you carry and wear." },
  fire:     { name: "fire aspect",   aura: "good",    weight: 7,  info: "Your weapon burns: struck monsters catch fire." },
  frost:    { name: "frost aspect",  aura: "good",    weight: 7,  info: "Your weapon freezes: struck monsters slow down." },
  shock:    { name: "storm aspect",  aura: "good",    weight: 7,  info: "Your weapon crackles: lightning arcs to a second monster." },
  holy:     { name: "holy aspect",   aura: "good",    weight: 5,  info: "Your weapon shines: double damage against the undead." },
  blessing: { name: "blessing",      aura: "good",    weight: 8,  info: "Your weapon becomes 1 better (+1)." },
  teleport: { name: "teleportation", aura: "neutral", weight: 8,  info: "Takes you somewhere else on this floor." },
  summon:   { name: "summoning",     aura: "bad",     weight: 6,  info: "Calls monsters to your side." },
  malice:   { name: "malice",        aura: "bad",     weight: 5,  info: "Curses the weapon in your hand." },
};
export const SYLLABLES = ["xo", "zel", "go", "mer", "ka", "ru", "vel", "nox", "tha", "ir", "bel", "um", "sa", "dra", "en", "ylo", "pha", "kor"];

// --- Elemental aspects (from scrolls, or found on rare weapons) ---------------
export const ELEMENTS = {
  fire:  { adj: "flaming",  color: [255, 140, 50],  info: "sets monsters on fire" },
  frost: { adj: "frost",    color: [140, 210, 255], info: "slows monsters" },
  shock: { adj: "storm",    color: [255, 240, 110], info: "lightning arcs to a second monster" },
  holy:  { adj: "holy",     color: [255, 250, 215], info: "double damage to the undead" },
};

// --- Weapons ------------------------------------------------------------------
// dmg: damage range · swing: seconds per attack · reach: blocks · str: strength needed
// held: the first-person model (pointing up; `pivot` is where the hand holds it, 0 = tip, 1 = end;
//       `length` is its size as a fraction of the screen height). The spear thrusts; the rest slash.
const rep = (row, n) => Array(n).fill(row);
const alt = (a, b, n) => Array.from({ length: n }, (_, i) => (i % 2 ? b : a));
const STEEL = { w: [[235, 240, 250], 0], W: [[190, 198, 215], 0], s: [[110, 118, 135], 0] };
const GOLD = { g: [[215, 170, 60], 0], G: [[255, 220, 110], 0], p: [[230, 185, 75], 0] };
const GRIP = { h: [[80, 50, 30], 0], H: [[125, 80, 45], 0] };
const WOOD = { k: [[110, 70, 40], 0], K: [[145, 95, 55], 0] };
const IRON = { d: [[105, 108, 122], 0], D: [[175, 180, 196], 0] };
const PALETTE = { ...STEEL, ...GOLD, ...GRIP, ...WOOD, ...IRON };

export const WEAPONS = {
  dagger: {
    name: "dagger", dmg: [2, 4], swing: 0.3, reach: 1.6, str: 8, tier: 1,
    held: { length: 0.36, pivot: 10.5 / 13, art: ["   w   ", ...rep("  wWs  ", 7), " ggggg ", "   h   ", "   H   ", "   h   ", "   p   "] },
  },
  shortsword: {
    name: "short sword", dmg: [2, 5], swing: 0.45, reach: 1.9, str: 10, tier: 0,
    held: { length: 0.62, pivot: 26 / 30, art: ["    w    ", ...rep("   wWs   ", 21), "ggggggggg", " gGgGgGg ",
      ...alt("    h    ", "    H    ", 4), "   ppp   ", "    p    "] },
  },
  mace: {
    name: "mace", dmg: [4, 7], swing: 0.6, reach: 1.8, str: 12, tier: 1,
    held: { length: 0.6, pivot: 22.5 / 25, art: ["   d d   ", "  dDDDd  ", " dDdDdDd ", "  dDDDd  ", " dDdDdDd ", "  dDDDd  ",
      "   d d   ", ...alt("    k    ", "    K    ", 14), ...rep("    h    ", 3), "   ddd   "] },
  },
  spear: {
    name: "spear", dmg: [3, 7], swing: 0.5, reach: 2.7, str: 12, tier: 2, thrust: true,
    held: { length: 0.95, pivot: 32 / 40, art: ["  w  ", " wWs ", " wWs ", "wWWWs", " wWs ", "  W  ", "  d  ",
      ...alt("  k  ", "  K  ", 23), ...rep("  h  ", 4), ...alt("  k  ", "  K  ", 5), "  d  "] },
  },
  longsword: {
    name: "longsword", dmg: [4, 8], swing: 0.5, reach: 2.2, str: 13, tier: 2,
    held: { length: 0.74, pivot: 32 / 37, art: ["    w    ", ...rep("   wWs   ", 27), "ggggggggg", " gGgGgGg ",
      ...alt("    h    ", "    H    ", 5), "   ppp   ", "    p    "] },
  },
  waraxe: {
    name: "war axe", dmg: [6, 10], swing: 0.7, reach: 2.0, str: 15, tier: 3,
    held: { length: 0.66, pivot: 25.5 / 28, art: ["     d     ", "  ww k     ", " wWWdk     ", "wWWWdk     ", "wWWWdkd    ",
      "wWWWdk     ", " wWWdk     ", "  ww k     ", ...alt("     k     ", "     K     ", 16), ...rep("     h     ", 3), "     d     "] },
  },
  greatsword: {
    name: "greatsword", dmg: [7, 12], swing: 0.8, reach: 2.4, str: 17, tier: 4,
    held: { length: 0.82, pivot: 35 / 40, art: ["     w     ", "    wWs    ", ...rep("   wWWWs   ", 28), "ggggggggggg", " gGgGgGgGg ",
      ...alt("     h     ", "     H     ", 6), "    ppp    ", "     p     "] },
  },
};
export const WEAPON_PALETTE = PALETTE;

// --- Armour -------------------------------------------------------------------
// armour: each blow is reduced by a random amount from 0 up to this.
export const ARMOURS = {
  clothes: { name: "plain clothes",  armour: 0, str: 0,  tier: 0, metal: false },
  leather: { name: "leather armour", armour: 1, str: 10, tier: 1, metal: false },
  chain:   { name: "chain mail",     armour: 2, str: 13, tier: 2, metal: true },
  scale:   { name: "scale mail",     armour: 3, str: 15, tier: 3, metal: true },
  plate:   { name: "plate armour",   armour: 4, str: 17, tier: 4, metal: true },
};

// --- Bonuses ------------------------------------------------------------------------
// Everything you wear or wield can add to a shared set of bonuses (stats.js bonus() adds them up,
// along with your perks and statuses; stats.js lists every key):
//   crit (chance) · swing (fraction faster) · reach · maxDmg · leech (chance a hit heals 1) ·
//   crush (×2 against brittle monsters) · thorns (damage to whoever hits you) · ward (less from
//   arrows and bolts) · regen (points: 1 HP every 12/points s) · str · maxHp · armour · speed ·
//   torch (fraction brighter) · sense (tiles: monsters that close show on the map) · darkSight
//   (see a little with your torch out) · stealth · firstBlock (a blow misses you, at most once every
//   RULES.cooldown.firstBlock s) · jump (blocks higher) · featherFall · killHeal (HP per kill)
//
// Properties: extra traits gear can come with. You can see them as soon as you see the item
// (unlike its enchantment).
export const PROPERTIES = {
  keen:     { slot: "weapon", adj: "keen",     info: "+10% crits",                 bonus: { crit: 0.1 } },
  swift:    { slot: "weapon", adj: "swift",    info: "swings 15% faster",          bonus: { swing: 0.15 } },
  long:     { slot: "weapon", adj: "long",     info: "+0.4 reach",                 bonus: { reach: 0.4 } },
  vampiric: { slot: "weapon", adj: "vampiric", info: "hits sometimes heal you",    bonus: { leech: 0.3 } },
  brutal:   { slot: "weapon", adj: "brutal",   info: "+2 max damage",              bonus: { maxDmg: 2 } },
  crushing: { slot: "weapon", adj: "crushing", info: "double damage to brittle foes (skeletons, golems)", bonus: { crush: 1 } },
  thorns:   { slot: "armour", suffix: "of thorns",   info: "whoever hits you takes 2", bonus: { thorns: 2 } },
  warding:  { slot: "armour", suffix: "of warding",  info: "arrows and bolts do 2 less", bonus: { ward: 2 } },
  light:    { slot: "armour", adj: "light",          info: "needs 3 less STR",     bonus: {}, strReq: -3 },
  stars:    { slot: "armour", suffix: "of the stars", info: "slowly heals you",    bonus: { regen: 1 } },
};

// --- Rings and amulets ----------------------------------------------------------------
// Like gear, their strength (ench: +1, +2… or cursed −1, −2) is hidden until you put them on,
// and a cursed one won't come off. `fixed` ones are simply on or off: never cursed, never stronger.
export const RINGS = {
  regeneration: { name: "regeneration", info: (n) => (n > 0 ? "slowly heals you" : "slowly drains you"), bonus: (n) => ({ regen: n }) },
  strength:     { name: "strength",     info: (n) => `${n >= 0 ? "+" : ""}${n} STR`, bonus: (n) => ({ str: n }) },
  protection:   { name: "protection",   info: (n) => `${n >= 0 ? "+" : ""}${n} armour`, bonus: (n) => ({ armour: n }) },
  accuracy:     { name: "accuracy",     info: (n) => `${n >= 0 ? "+" : ""}${n * 6}% crits`, bonus: (n) => ({ crit: 0.06 * n }) },
  haste:        { name: "haste",        info: (n) => `${n >= 0 ? "+" : ""}${n * 8}% speed`, bonus: (n) => ({ speed: 0.08 * n }) },
  thorns:       { name: "thorns",       info: (n) => `whoever hits you takes ${Math.max(0, 2 * n)}`, bonus: (n) => ({ thorns: Math.max(0, 2 * n), armour: Math.min(0, n) }) },
  vampirism:    { name: "vampirism",    info: (n) => (n > 0 ? `+${n} HP for every kill` : "kills hurt you"), bonus: (n) => ({ killHeal: n }) },
};
export const AMULETS = {
  life:    { name: "life",     info: (n) => `${n >= 0 ? "+" : ""}${5 * n} max HP`, bonus: (n) => ({ maxHp: 5 * n }) },
  sight:   { name: "sight",    info: (n) => (n > 0 ? "a brighter torch; monsters close by show on the map" : "a dimmer torch"), bonus: (n) => ({ torch: 0.25 * n, sense: Math.max(0, 5 * n) }) },
  dark:    { name: "the dark", info: (n) => (n > 0 ? "with your torch out you see a little, and hide better" : "monsters notice you sooner"), bonus: (n) => ({ darkSight: Math.max(0, n), stealth: 0.12 * n }) },
  warding: { name: "warding",  fixed: true, info: () => `a blow misses you, at most once every ${RULES.cooldown.firstBlock / 60} minutes`, bonus: () => ({ firstBlock: 1 }) },
  climber: { name: "the climber", fixed: true, info: () => "you jump a block higher", bonus: () => ({ jump: 1 }) },
  feather: { name: "feathers", fixed: true, info: () => "falling never hurts you", bonus: () => ({ featherFall: 1 }) },
};
export const jewelTable = (it) => (it.kind === "ring" ? RINGS : AMULETS);
// The stone set in each kind (so you can tell them apart before you know what they do).
export const GEMS = {
  regeneration: [90, 230, 120], strength: [255, 140, 50], protection: [150, 170, 255], accuracy: [255, 240, 120],
  haste: [120, 230, 255], thorns: [120, 160, 60], vampirism: [220, 30, 60],
  life: [240, 70, 100], sight: [170, 120, 255], dark: [90, 80, 130], warding: [220, 225, 240], climber: [140, 210, 140], feather: [235, 235, 255],
};

// --- Relics -----------------------------------------------------------------------------
// One of a kind, each found at most once a run: guardians always drop one, and now and then
// one lies with the treasure of the deepest floors. Never cursed; you know what they do.
export const RELICS = {
  oath:     { name: "Hollowmere's Oath", kind: "weapon", id: "longsword", ench: 3, element: "holy",
              info: "killing the undead heals you 3", bonus: { undeadHeal: 3 } },
  ember:    { name: "Emberheart", kind: "weapon", id: "waraxe", ench: 2, element: "fire",
              info: "burning monsters take half again as much", bonus: { burnBonus: 0.5 } },
  patience: { name: "The Long Patience", kind: "weapon", id: "spear", ench: 3, element: "frost",
              info: "reaches much further", bonus: { reach: 0.8 } },
  thornfang:{ name: "Thornfang", kind: "weapon", id: "dagger", ench: 3,
              info: "every hit poisons", bonus: { poisonHit: 4, crit: 0.08 } },
  sunder:   { name: "Sunder", kind: "weapon", id: "greatsword", ench: 2,
              info: "crits ignore armour and hit three times as hard", bonus: { sunder: 1 } },
  edge:     { name: "The Edge of the Plane", kind: "weapon", id: "shortsword", ench: 4,
              info: "a blade with no thickness: it cuts flat things in 3D too", bonus: { cutsFlat: 1, swing: 0.15 } },
  mantle:   { name: "The Mantle of Angles", kind: "armour", id: "scale", ench: 2,
              info: "turning the world (Tab) leaves you untouchable for 2 s", bonus: { foldGuard: 2 } },
  eye:      { name: "The Eye of the Cube", kind: "amulet", id: "sight", ench: 2,
              info: "every monster within 12 tiles shows on your map", bonus: { sense: 2 } },
  lantern:  { name: "Brann's Lantern", kind: "ring", id: "regeneration", ench: 1,
              info: "with your torch out you heal fast, and see a little", bonus: { darkRegen: 4, darkSight: 2 } },
  deep:     { name: "The Heart of the Deep", kind: "amulet", id: "life", ench: 2,
              info: "+2 STR as well", bonus: { str: 2 } },
};
export function makeRelic(key) {
  const r = RELICS[key];
  return { kind: r.kind, id: r.id, ench: r.ench, known: true, relic: key, ...(r.element ? { element: r.element } : {}) };
}
// A relic you haven't found yet this run (null if you've found them all).
export function pickRelic(found, rand = Math.random, kind = null) {
  const left = Object.keys(RELICS).filter((k) => !found.has(k) && (!kind || RELICS[k].kind === kind));
  return left.length ? left[Math.floor(rand() * left.length)] : null;
}
export const RELIC_COLOR = [255, 205, 90];

// --- How things look lying on the floor ---------------------------------------
export const FLOOR_ART = {
  potion: { w: 0.3, h: 0.42, art: [" ccc ", "  g  ", " ggg ", "grrrg", "grrrg", "grrrg", " ggg "] },
  weapon: { w: 0.3, h: 0.62, art: ["  h  ", "  h  ", "ggggg", " wWs ", " wWs ", " wWs ", " wWs ", "  w  "] },   // stuck in the ground
  armour: { w: 0.55, h: 0.5, art: ["dd   dd", "dDDdDDd", "dDDDDDd", " dDDDd ", " dDDDd ", " dDDDd ", "  ddd  "] },
  key:    { w: 0.45, h: 0.17, art: ["yyy     ", "y yyyyyy", "yyy  y y"] },
  heart:  { w: 0.45, h: 0.4, art: [" rr rr ", "rrrrrrr", "rrrrrrr", " rrrrr ", "  rrr  ", "   r   "] },
  strength: { w: 0.3, h: 0.5, art: ["  o  ", " oOo ", " oOo ", "oOOOo", "oOOOo", " oOo ", " oOo ", "  o  "] },
  scroll: { w: 0.42, h: 0.22, art: [" pppppp ", "pPPPPPPp", "pPPPPPPp", " pppppp "] },
  knife:  { w: 0.32, h: 0.32, art: ["   w", "  W ", " s  ", "h   "] },
  bomb:   { w: 0.36, h: 0.42, art: ["   f ", "  c  ", " bbb ", "bbBbb", "bbbbb", " bbb "] },
  gold:   { w: 0.4, h: 0.22, art: ["  yY  ", " yYyy ", "yYyyYy"] },
  cash:   { w: 0.4, h: 0.22, art: ["  yY  ", " yYyy ", "yYyyYy"] },   // a little heap of glim flasks
  cube:   { w: 0.42, h: 0.42, art: ["  cCC  ", " cCCCC ", "ccCCCCd", "cccCCdd", "ccccddd", " ccddd ", "  cdd  "] },
  quest:  { w: 0.36, h: 0.36, art: [" www ", "wwwww", "wbwbw", "wwwww", " w w "] },   // Brann's skull
  ring:   { w: 0.28, h: 0.28, art: ["  G  ", " gGg ", "g   g", "g   g", " ggg "] },
  amulet: { w: 0.34, h: 0.42, art: ["c   c", " c c ", "  c  ", " gGg ", "gGGGg", " gGg ", "  g  "] },
};

// --- The item kinds (items.js registerItemKind; ItemKindDef in TECH_DESIGN §2.9) -------------
// Gear: "longsword" until you've worn or wielded it (or it was named for you); then
// "+2 longsword" or "-1 chain mail". An element shows from the start: "flaming mace".
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const isJewel = (it) => it.kind === "ring" || it.kind === "amulet";

// What its properties (or relic power) add, for the info line.
function extrasInfo(it) {
  const parts = (it.props || []).map((k) => PROPERTIES[k].info);
  if (it.relic) parts.unshift(RELICS[it.relic].info);
  return parts.length ? " · " + parts.join(" · ") : "";
}

function gearName(game, it) {
  if (it.relic) return RELICS[it.relic].name;
  const jewel = isJewel(it);
  const base = jewel ? `${it.kind} of ${jewelTable(it)[it.id].name}` : (it.kind === "weapon" ? WEAPONS : ARMOURS)[it.id].name;
  const props = (it.props || []).map((k) => PROPERTIES[k]);
  const adj = props.filter((pr) => pr.adj).map((pr) => pr.adj + " ").join("");
  const suffix = props.filter((pr) => pr.suffix).map((pr) => " " + pr.suffix).join("");
  const el = it.element ? `${ELEMENTS[it.element].adj} ` : "";
  const fixed = jewel && jewelTable(it)[it.id].fixed;
  return `${it.known && it.ench && !fixed ? signed(it.ench) + " " : ""}${adj}${el}${base}${suffix}`;
}
// What the peddler charges at level 0 (deeper down, everything costs more: currency.js priceLevel).
function gearPrice(it) {
  if (it.relic) return 400;
  if (it.ench < 0 && it.known) return 5;
  const tier = isJewel(it) ? 3 : (it.kind === "weapon" ? WEAPONS : ARMOURS)[it.id].tier;
  return 30 + tier * 30 + Math.max(0, it.ench) * 30 + (it.props?.length || 0) * 40 + (it.element ? 40 : 0);
}
const gearAura = (game, it) => (it.known || it.auraKnown ? (it.ench > 0 ? "good" : it.ench < 0 ? "bad" : "neutral") : null);
// Every bonus of its own (a ring or amulet's power); properties and relic gifts are added by items.js
// itemBonuses for any kind.
const jewelBonuses = (it) => jewelTable(it)[it.id].bonus(it.ench);
// E in the inventory: "wear" puts it on (an item action, registered by inventory.js; the body decides
// where it goes). Potions are "drink" and scrolls "read" (effects.js, through inventory.js).
const gear = (def) => ({ stack: false, weight: () => 0, price: gearPrice, aura: gearAura, name: gearName, use: "wear", ...def });
// Strength needed (weapons and armour; "light" armour needs less): an attribute requirement.
const strReq = (it) => ({ str: strNeeded(it) });

registerItemKind("potion", {
  stack: true, throwable: true, weight: () => 0,
  name: (game, it) => (game.knownPotions.has(it.effect) ? `potion of ${POTIONS[it.effect].name}` : `${POTION_COLORS[game.potionColor[it.effect]].name} potion`),
  glyph: (game, it) => ["!", POTION_COLORS[game.potionColor[it.effect]].rgb],
  info: (game, it) => (game.knownPotions.has(it.effect) ? POTIONS[it.effect].info : "Unknown. Drink it to find out what it does."),
  price: (it) => (it.effect === "healing" ? 30 : 25),
  aura: (game, it) => (game.knownPotions.has(it.effect) || game.auraKnown.has(`potion:${it.effect}`) ? POTIONS[it.effect].aura : null),
  art: FLOOR_ART.potion,
  palette: (game, it) => ({ c: [[140, 95, 55], 0], g: [[180, 200, 220], 0], r: [POTION_COLORS[game.potionColor[it.effect]].rgb, 0.45] }),
  use: "drink",
});
registerItemKind("scroll", {
  stack: true, weight: () => 0,
  name: (game, it) => (game.knownScrolls.has(it.effect) ? `scroll of ${SCROLLS[it.effect].name}` : `scroll titled "${game.scrollTitle[it.effect]}"`),
  glyph: () => ["?", [235, 220, 175]],
  info: (game, it) => (game.knownScrolls.has(it.effect) ? SCROLLS[it.effect].info : "Unknown. Read it to find out what it does."),
  price: () => 30,
  aura: (game, it) => (game.knownScrolls.has(it.effect) || game.auraKnown.has(`scroll:${it.effect}`) || game.player?.perks.has("scholar") ? SCROLLS[it.effect].aura : null),
  art: FLOOR_ART.scroll,
  palette: () => ({ p: [[190, 165, 120], 0.1], P: [[235, 220, 180], 0.15] }),
  use: "read",
});
registerItemKind("weapon", gear({
  slot: () => "hand", hands: (it) => WEAPONS[it.id].hands || 1, req: strReq, stands: true,
  glyph: (game, it) => [")", it.relic ? RELIC_COLOR : it.element ? ELEMENTS[it.element].color : [205, 210, 225]],
  info(game, it) {
    const w = WEAPONS[it.id];
    const el = it.element ? ` · ${ELEMENTS[it.element].info}` : "";
    return `${w.dmg[0]}-${w.dmg[1]} damage · ${w.swing}s per swing · reach ${w.reach}${w.thrust ? " · thrusts" : ""}${el}${extrasInfo(it)} · needs ${strNeeded(it)} STR`;
  },
  art: FLOOR_ART.weapon,
  palette(game, it) {
    // A weapon with an element glows with it.
    const el = it.element && ELEMENTS[it.element];
    const color = el ? el.color : it.relic ? RELIC_COLOR : null;
    return color ? { ...STEEL, w: [color, 0.6], W: [color, 0.4], ...GOLD, ...GRIP } : { ...STEEL, ...GOLD, ...GRIP };
  },
}));
registerItemKind("armour", gear({
  slot: () => "body", req: strReq,
  glyph: (game, it) => ["[", it.relic ? RELIC_COLOR : [175, 180, 195]],
  info: (game, it) => `armour ${ARMOURS[it.id].armour}${extrasInfo(it)} · needs ${strNeeded(it)} STR`,
  av: (it) => ARMOURS[it.id].armour + it.ench,   // stats.js av() adds up what's worn (not a bonus)
  art: FLOOR_ART.armour,
  palette(game, it) {
    if (it.relic) return { d: [[150, 120, 50], 0.4], D: [RELIC_COLOR, 0.7] };
    return ARMOURS[it.id].metal ? { d: [[80, 84, 98], 0], D: [[160, 165, 182], 0] } : { d: [[90, 55, 30], 0], D: [[150, 100, 60], 0] };
  },
}));
const jewelPalette = (game, it) => {
  const metal = it.relic ? [[255, 200, 80], 0.6] : [[200, 165, 70], 0.25];
  return { g: metal, c: [[150, 120, 70], 0.1], G: [GEMS[it.id], it.relic ? 1.4 : 0.9] };
};
function jewelInfo(game, it) {
  const t = jewelTable(it)[it.id];
  if (it.relic) return RELICS[it.relic].info + ` · ${t.info(it.ench)}`;
  return it.known || t.fixed ? t.info(it.ench) : `${t.info(1)} (how strong, or whether it's cursed, you'll know once you wear it)`;
}
registerItemKind("ring", gear({
  slot: () => "finger", bonuses: jewelBonuses, info: jewelInfo, art: FLOOR_ART.ring, palette: jewelPalette,
  glyph: (game, it) => ["=", it.relic ? RELIC_COLOR : GEMS[it.id]],
}));
registerItemKind("amulet", gear({
  slot: () => "neck", bonuses: jewelBonuses, info: jewelInfo, art: FLOOR_ART.amulet, palette: jewelPalette,
  glyph: (game, it) => ['"', it.relic ? RELIC_COLOR : GEMS[it.id]],
}));
registerItemKind("knife", {
  stack: true, throwable: true, weight: () => 0, price: () => 5,
  name: () => "throwing knife", glyph: () => ["/", [205, 210, 225]],
  info: () => "Thrown: 2-4 damage. Usually lands where you can pick it up again.",
  art: FLOOR_ART.knife, palette: () => ({ ...STEEL, ...GRIP }),
});
registerItemKind("bomb", {
  stack: true, throwable: true, weight: () => 0, price: () => 20,
  name: () => "bomb", glyph: () => ["0", [255, 140, 70]],
  info: () => "Throw it (T). Goes off 2 s later: 10-16 damage to everything close, you too. Some walls are thinner than they look.",
  art: FLOOR_ART.bomb,
  palette: () => ({ b: [[95, 95, 108], 0.2], B: [[200, 200, 215], 0.35], c: [[170, 135, 90], 0.1], f: [[255, 200, 90], 0.9] }),   // dark iron, but not so dark it vanishes in a dim corner
});
registerItemKind("key", {
  stack: false, weight: () => 0, price: () => 0, sound: "key",
  name: () => "brass key", glyph: () => ["k", [240, 200, 70]],
  art: FLOOR_ART.key, palette: () => ({ y: [[240, 200, 70], 0.35] }),
  onPickup(game, e) { e.keys++; game.log("You pick up a brass key.", [240, 200, 70]); return true; },
});
// The crystals (TECH_DESIGN's later `boon` kind): absorbed the moment you pick one up, or buy one.
registerItemKind("heart", {
  stack: false, weight: () => 0, price: () => 150, sound: "crystal",
  name: () => "heart crystal", glyph: () => ["h", [240, 60, 90]],
  art: FLOOR_ART.heart, palette: () => ({ r: [[240, 50, 70], 0.6] }),
  onPickup(game, e) { raiseMaxHp(e, 5); e.hp += 5; game.log("You absorb the heart crystal. Max HP +5!", [240, 90, 110]); return true; },
});
registerItemKind("strength", {
  stack: false, weight: () => 0, price: () => 180, sound: "crystal",
  name: () => "strength crystal", glyph: () => ["S", [255, 160, 60]],
  art: FLOOR_ART.strength, palette: () => ({ o: [[230, 120, 30], 0.6], O: [[255, 190, 90], 0.8] }),
  onPickup(game, e) { raiseAttr(e, "str", 1); game.log("You absorb the strength crystal. STR +1!", [255, 170, 80]); return true; },
});
// Money lying about: `cash`, a pile of the currency of content/currency.js (glim). Walking over it
// puts what fits into your purse (currency.js receive); the rest stays on the floor. `gold` is the
// parent game's pile under its old name (the golden scenarios drop one); it is the same pile.
const pile = (label) => ({
  stack: false, weight: () => 0, price: () => 0, sound: "gold",
  art: FLOOR_ART.gold, palette: () => ({ y: [[230, 175, 40], 0.4], Y: [[255, 230, 120], 0.6] }),
  name: (game, it) => `${it.amount} ${label()}`,
  glyph: () => ["$", [255, 210, 70]],
  canPickUp: (game, e, it) => purseRoom(e) > 0 || !it.fullHint,
  onPickup(game, e, it) {
    const left = receive(game, e, it.amount), took = it.amount - left;
    if (took) game.log(`You pick up ${formatPrice(took)}.`, CURRENCY.color);
    if (!left) return true;
    if (took || !it.fullHint) game.log(`Your purse is full: ${formatPrice(left)} stays where it lies.`, [255, 150, 120]);
    it.amount = left;
    it.fullHint = true;
    return "stay";
  },
});
registerItemKind("gold", pile(() => CURRENCY.plural));
registerItemKind("cash", { ...pile(() => CURRENCY.plural), art: FLOOR_ART.cash, glyph: () => [CURRENCY.glyph, CURRENCY.color] });
registerItemKind("cube", {
  stack: false, weight: () => 0, price: () => 0, sound: "crystal",
  name: () => "the Rotation Cube", glyph: () => ["■", [120, 220, 255]],
  art: FLOOR_ART.cube, palette: () => ({ c: [[90, 200, 255], 1.0], C: [[200, 245, 255], 1.4], d: [[40, 110, 200], 0.8] }),
  onPickup(game) { game.onCube(); return true; },   // the story takes over (game.js)
});
registerItemKind("quest", {
  stack: false, weight: () => 0, price: () => 0,   // quest items: not for sale
  name: (game, it) => it.name, glyph: () => ["*", [230, 225, 205]], info: (game, it) => it.info || "",
  art: FLOOR_ART.quest, palette: () => ({ w: [[225, 220, 200], 0.15], b: [[30, 25, 25], 0] }),   // Brann's skull
});
// Treasure marked "relic?" on deep levels: which relic it is gets chosen when you arrive (game.js).
registerItemKind("relic?", {
  stack: false, weight: () => 0, price: () => 0,
  name: () => "relic", glyph: () => ["*", RELIC_COLOR],
  art: FLOOR_ART.quest, palette: () => ({ w: [RELIC_COLOR, 0.6], b: [[30, 25, 25], 0] }),
});
