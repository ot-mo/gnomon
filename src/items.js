// Items: potions and scrolls (unidentified until used), weapons and armour (possibly blessed or
// cursed), keys and crystals.
// Pixel art: one letter per pixel (a palette entry: [colour, glow]); a space is see-through.
//
// Every potion and scroll has an aura: "good", "neutral" or "bad". A potion of seeing lets you
// sense the auras of everything you're carrying, even before you know what it is.

import { sfx } from "./sfx.js";
import { seededSort } from "./rng.js";

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
const SYLLABLES = ["xo", "zel", "go", "mer", "ka", "ru", "vel", "nox", "tha", "ir", "bel", "um", "sa", "dra", "en", "ylo", "pha", "kor"];
// A random title for every kind of scroll, different every run.
export function scrollTitles(rand) {
  const word = () => Array.from({ length: 2 + Math.floor(rand() * 2) }, () => SYLLABLES[Math.floor(rand() * SYLLABLES.length)]).join("");
  return Object.fromEntries(Object.keys(SCROLLS).map((k) => [k, `${word()} ${word()}`.toUpperCase()]));
}

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
// Everything you wear or wield can add to a shared set of bonuses (player.js bonus() adds them up,
// along with your perks):
//   crit (chance) · swing (fraction faster) · reach · maxDmg · leech (chance a hit heals 1) ·
//   crush (×2 against brittle monsters) · thorns (damage to whoever hits you) · ward (less from
//   arrows and bolts) · regen (points: 1 HP every 12/points s) · str · maxHp · armour · speed ·
//   torch (fraction brighter) · sense (tiles: monsters that close show on the map) · darkSight
//   (see a little with your torch out) · stealth · firstBlock (the first blow on each floor
//   misses) · jump (blocks higher) · featherFall · killHeal (HP per kill)
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
  warding: { name: "warding",  fixed: true, info: () => "the first blow on each floor misses you", bonus: () => ({ firstBlock: 1 }) },
  climber: { name: "the climber", fixed: true, info: () => "you jump a block higher", bonus: () => ({ jump: 1 }) },
  feather: { name: "feathers", fixed: true, info: () => "falling never hurts you", bonus: () => ({ featherFall: 1 }) },
};
const jewelTable = (it) => (it.kind === "ring" ? RINGS : AMULETS);
// The stone set in each kind (so you can tell them apart before you know what they do).
const GEMS = {
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

// Every bonus one worn or wielded item gives (its properties, a ring or amulet's power, a
// relic's gift, and for armour its enchantment as armour).
export function itemBonuses(it) {
  const out = {};
  const add = (b) => { for (const k in b) out[k] = (out[k] || 0) + b[k]; };
  if (!it) return out;
  if (it.kind === "ring" || it.kind === "amulet") add(jewelTable(it)[it.id].bonus(it.ench));
  for (const k of it.props || []) add(PROPERTIES[k].bonus);
  if (it.relic) add(RELICS[it.relic].bonus);
  return out;
}

// Strength needed to use a weapon or armour ("light" armour needs less).
export function strNeeded(it) {
  const base = (it.kind === "weapon" ? WEAPONS : ARMOURS)[it.id].str;
  return Math.max(0, base + (it.props || []).reduce((s, k) => s + (PROPERTIES[k].strReq || 0), 0));
}
export const isGear = (it) => it && (it.kind === "weapon" || it.kind === "armour" || it.kind === "ring" || it.kind === "amulet");

// --- How things look lying on the floor ---------------------------------------
const FLOOR_ART = {
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
  cube:   { w: 0.42, h: 0.42, art: ["  cCC  ", " cCCCC ", "ccCCCCd", "cccCCdd", "ccccddd", " ccddd ", "  cdd  "] },
  quest:  { w: 0.36, h: 0.36, art: [" www ", "wwwww", "wbwbw", "wwwww", " w w "] },   // Brann's skull
  ring:   { w: 0.28, h: 0.28, art: ["  G  ", " gGg ", "g   g", "g   g", " ggg "] },
  amulet: { w: 0.34, h: 0.42, art: ["c   c", " c c ", "  c  ", " gGg ", "gGGGg", " gGg ", "  g  "] },
};
export { FLOOR_ART };

export function itemPalette(game, it) {
  switch (it.kind) {
    case "potion": return { c: [[140, 95, 55], 0], g: [[180, 200, 220], 0], r: [POTION_COLORS[game.potionColor[it.effect]].rgb, 0.45] };
    case "weapon": {
      // A weapon with an element glows with it.
      const el = it.element && ELEMENTS[it.element];
      const color = el ? el.color : it.relic ? RELIC_COLOR : null;
      return color ? { ...STEEL, w: [color, 0.6], W: [color, 0.4], ...GOLD, ...GRIP } : { ...STEEL, ...GOLD, ...GRIP };
    }
    case "armour":
      if (it.relic) return { d: [[150, 120, 50], 0.4], D: [RELIC_COLOR, 0.7] };
      return ARMOURS[it.id].metal ? { d: [[80, 84, 98], 0], D: [[160, 165, 182], 0] } : { d: [[90, 55, 30], 0], D: [[150, 100, 60], 0] };
    case "key": return { y: [[240, 200, 70], 0.35] };
    case "heart": return { r: [[240, 50, 70], 0.6] };
    case "strength": return { o: [[230, 120, 30], 0.6], O: [[255, 190, 90], 0.8] };
    case "scroll": return { p: [[190, 165, 120], 0.1], P: [[235, 220, 180], 0.15] };
    case "knife": return { ...STEEL, ...GRIP };
    case "bomb": return { b: [[95, 95, 108], 0.2], B: [[200, 200, 215], 0.35], c: [[170, 135, 90], 0.1], f: [[255, 200, 90], 0.9] };   // dark iron, but not so dark it vanishes in a dim corner
    case "gold": return { y: [[230, 175, 40], 0.4], Y: [[255, 230, 120], 0.6] };
    case "cube": return { c: [[90, 200, 255], 1.0], C: [[200, 245, 255], 1.4], d: [[40, 110, 200], 0.8] };
    case "quest": return { w: [[225, 220, 200], 0.15], b: [[30, 25, 25], 0] };
    case "ring": case "amulet": {
      const metal = it.relic ? [[255, 200, 80], 0.6] : [[200, 165, 70], 0.25];
      return { g: metal, c: [[150, 120, 70], 0.1], G: [GEMS[it.id], it.relic ? 1.4 : 0.9] };
    }
  }
}

export function itemSprite(game, it, time) {
  const a = FLOOR_ART[it.kind];
  const lift = it.kind === "weapon" ? -0.12 : 0.25 + 0.06 * Math.sin(time * 3 + it.x * 7);   // weapons stand, the rest bob
  return { x: it.x, y: it.y, z: it.z + lift, w: a.w, h: a.h, art: a.art, palette: itemPalette(game, it) };
}

// --- Names, glyphs, descriptions -----------------------------------------------
// Gear: "longsword" until you've worn or wielded it (or it was named for you); then
// "+2 longsword" or "-1 chain mail". An element shows from the start: "flaming mace".
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

export function itemName(game, it) {
  switch (it.kind) {
    case "potion":
      return game.knownPotions.has(it.effect) ? `potion of ${POTIONS[it.effect].name}`
                                              : `${POTION_COLORS[game.potionColor[it.effect]].name} potion`;
    case "scroll":
      return game.knownScrolls.has(it.effect) ? `scroll of ${SCROLLS[it.effect].name}`
                                              : `scroll titled "${game.scrollTitle[it.effect]}"`;
    case "weapon": case "armour": case "ring": case "amulet": {
      if (it.relic) return RELICS[it.relic].name;
      const jewel = it.kind === "ring" || it.kind === "amulet";
      const base = jewel ? `${it.kind} of ${jewelTable(it)[it.id].name}` : (it.kind === "weapon" ? WEAPONS : ARMOURS)[it.id].name;
      const props = (it.props || []).map((k) => PROPERTIES[k]);
      const adj = props.filter((pr) => pr.adj).map((pr) => pr.adj + " ").join("");
      const suffix = props.filter((pr) => pr.suffix).map((pr) => " " + pr.suffix).join("");
      const el = it.element ? `${ELEMENTS[it.element].adj} ` : "";
      const fixed = jewel && jewelTable(it)[it.id].fixed;
      return `${it.known && it.ench && !fixed ? signed(it.ench) + " " : ""}${adj}${el}${base}${suffix}`;
    }
    case "key": return "brass key";
    case "heart": return "heart crystal";
    case "strength": return "strength crystal";
    case "knife": return "throwing knife";
    case "bomb": return "bomb";
    case "gold": return `${it.amount} gold`;
    case "cube": return "the Rotation Cube";
    case "quest": return it.name;
  }
}
export const withArticle = (name) => (/^[aeiou]/.test(name) ? "an " : "a ") + name;

export function itemGlyph(game, it) {
  switch (it.kind) {
    case "potion": return ["!", POTION_COLORS[game.potionColor[it.effect]].rgb];
    case "scroll": return ["?", [235, 220, 175]];
    case "weapon": return [")", it.relic ? RELIC_COLOR : it.element ? ELEMENTS[it.element].color : [205, 210, 225]];
    case "armour": return ["[", it.relic ? RELIC_COLOR : [175, 180, 195]];
    case "ring": return ["=", it.relic ? RELIC_COLOR : GEMS[it.id]];
    case "amulet": return ['"', it.relic ? RELIC_COLOR : GEMS[it.id]];
    case "key": return ["k", [240, 200, 70]];
    case "heart": return ["h", [240, 60, 90]];
    case "strength": return ["S", [255, 160, 60]];
    case "knife": return ["/", [205, 210, 225]];
    case "bomb": return ["0", [255, 140, 70]];
    case "gold": return ["$", [255, 210, 70]];
    case "cube": return ["■", [120, 220, 255]];
    case "quest": return ["*", [230, 225, 205]];
    case "relic?": return ["*", RELIC_COLOR];
  }
}

// "good" | "neutral" | "bad" if you know it (by identifying the item, or from a potion of
// seeing), otherwise null.
export function itemAura(game, it) {
  if (it.kind === "potion") return game.knownPotions.has(it.effect) || game.auraKnown.has(`potion:${it.effect}`) ? POTIONS[it.effect].aura : null;
  if (it.kind === "scroll") return game.knownScrolls.has(it.effect) || game.auraKnown.has(`scroll:${it.effect}`) || game.player?.perks.has("scholar") ? SCROLLS[it.effect].aura : null;
  if (isGear(it)) return it.known || it.auraKnown ? (it.ench > 0 ? "good" : it.ench < 0 ? "bad" : "neutral") : null;
  return null;
}

// What its properties (or relic power) add, for the info line.
function extrasInfo(it) {
  const parts = (it.props || []).map((k) => PROPERTIES[k].info);
  if (it.relic) parts.unshift(RELICS[it.relic].info);
  return parts.length ? " · " + parts.join(" · ") : "";
}

// One-line summary for the inventory.
export function itemInfo(game, it) {
  switch (it.kind) {
    case "potion": return game.knownPotions.has(it.effect) ? POTIONS[it.effect].info : "Unknown. Drink it to find out what it does.";
    case "scroll": return game.knownScrolls.has(it.effect) ? SCROLLS[it.effect].info : "Unknown. Read it to find out what it does.";
    case "weapon": {
      const w = WEAPONS[it.id];
      const el = it.element ? ` · ${ELEMENTS[it.element].info}` : "";
      return `${w.dmg[0]}-${w.dmg[1]} damage · ${w.swing}s per swing · reach ${w.reach}${w.thrust ? " · thrusts" : ""}${el}${extrasInfo(it)} · needs ${strNeeded(it)} STR`;
    }
    case "armour": { const a = ARMOURS[it.id]; return `armour ${a.armour}${extrasInfo(it)} · needs ${strNeeded(it)} STR`; }
    case "ring": case "amulet": {
      const t = jewelTable(it)[it.id];
      if (it.relic) return RELICS[it.relic].info + ` · ${t.info(it.ench)}`;
      return it.known || t.fixed ? t.info(it.ench) : `${t.info(1)} (how strong, or whether it's cursed, you'll know once you wear it)`;
    }
    case "knife": return "Thrown: 2-4 damage. Usually lands where you can pick it up again.";
    case "bomb": return "Throw it (T). Goes off 2 s later: 10-16 damage to everything close, you too. Some walls are thinner than they look.";
    case "quest": return it.info || "";
    default: return "";
  }
}

// --- Loot -------------------------------------------------------------------------
// `rand` is any function returning 0..1 (a seeded rng while generating, Math.random for drops).
function weighted(rand, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let pick = rand() * total;
  for (const [v, w] of entries) if ((pick -= w) < 0) return v;
  return entries[entries.length - 1][0];
}

export function randomPotion(rand = Math.random) {
  return { kind: "potion", effect: weighted(rand, Object.entries(POTIONS).map(([k, p]) => [k, p.weight])) };
}

export function randomScroll(rand = Math.random) {
  return { kind: "scroll", effect: weighted(rand, Object.entries(SCROLLS).map(([k, s]) => [k, s.weight])) };
}

// The heaviest gear that turns up at a depth: light gear on the first floors, and the best
// (greatsword, plate) only from floor 12. The newest tier is the commonest, older ones linger.
export const maxTierAt = (depth) => (depth >= 12 ? 4 : depth >= 8 ? 3 : depth >= 4 ? 2 : 1);

// A weapon or armour suited to this depth.
// Its enchantment is hidden: about 1 in 5 is cursed, 1 in 5 blessed; how much grows slowly with
// depth (±1 at first, up to ±4 at the bottom). `luck` shifts the odds toward blessed.
// Elements and properties get commoner the deeper you go.
export function randomEquipment(rand, depth, luck = 0) {
  const maxTier = maxTierAt(depth);
  const weight = (tier) => (tier === maxTier ? 4 : tier === maxTier - 1 ? 2 : 1);
  const pool = [
    ...Object.entries(WEAPONS).filter(([, w]) => w.tier > 0 && w.tier <= maxTier).map(([id, w]) => [{ kind: "weapon", id }, weight(w.tier)]),
    ...Object.entries(ARMOURS).filter(([, a]) => a.tier > 0 && a.tier <= maxTier).map(([id, a]) => [{ kind: "armour", id }, weight(a.tier)]),
  ];
  const it = { ...weighted(rand, pool), ench: 0, known: false };
  const roll = rand(), size = 1 + Math.floor(rand() * Math.min(4, 1 + depth / 5));
  if (roll < 0.2 - luck) it.ench = -size;
  else if (roll > 0.8 - luck) it.ench = size;
  if (it.kind === "weapon" && rand() < 0.03 + depth * 0.008) it.element = Object.keys(ELEMENTS)[Math.floor(rand() * 4)];
  // Properties: none on the first floors, then one now and then, two deep down.
  const props = Object.keys(PROPERTIES).filter((k) => PROPERTIES[k].slot === it.kind);
  const count = depth < 5 ? 0 : rand() < Math.min(0.55, 0.06 * depth) ? (depth >= 12 && rand() < 0.35 ? 2 : 1) : 0;
  if (count) it.props = seededSort(props, () => rand() - 0.5).slice(0, count);   // (not Array sort: see rng.js)
  return it;
}

// A ring or an amulet (from floor 3 on). Mostly +1; deeper, sometimes +2 or +3. 1 in 5 cursed.
export function randomJewel(rand, depth, luck = 0) {
  const kind = rand() < 0.55 ? "ring" : "amulet";
  const table = kind === "ring" ? RINGS : AMULETS, keys = Object.keys(table);
  const id = keys[Math.floor(rand() * keys.length)];
  let ench = 1 + (rand() < Math.min(0.5, depth * 0.03) ? 1 : 0) + (depth >= 12 && rand() < 0.25 ? 1 : 0);
  if (!table[id].fixed && rand() < 0.2 - luck) ench = -ench;
  if (table[id].fixed) ench = 1;
  return { kind, id, ench, known: false };
}

// Something worth risking a jump for. Crystals are the rare prize; on the deepest floors, now
// and then a relic ("relic?": which one is chosen when you arrive, so you never find one twice).
export function randomTreasure(rand, depth) {
  if (depth >= 14 && depth < 20 && rand() < 0.15) return { kind: "relic?" };
  const roll = rand();
  if (roll < 0.08) return { kind: "strength" };
  if (roll < 0.16) return { kind: "heart" };
  if (roll < 0.5) return randomEquipment(rand, depth + 1, 0.15);
  if (roll < 0.62 && depth >= 3) return randomJewel(rand, depth + 1, 0.1);
  if (roll < 0.8) return randomScroll(rand);
  return { kind: "knife", count: 3 + Math.floor(rand() * 3) };
}

// What the peddler charges at depth 0 (deeper down, everything costs more: shopPrice), and
// what he pays (less than a third).
export function itemPrice(it) {
  switch (it.kind) {
    case "potion": return it.effect === "healing" ? 30 : 25;
    case "scroll": return 30;
    case "bomb": return 20;
    case "knife": return 5;
    case "heart": return 150;
    case "strength": return 180;
    case "weapon": case "armour": case "ring": case "amulet": {
      if (it.relic) return 400;
      if (it.ench < 0 && it.known) return 5;
      const tier = it.kind === "ring" || it.kind === "amulet" ? 3 : (it.kind === "weapon" ? WEAPONS : ARMOURS)[it.id].tier;
      return 30 + tier * 30 + Math.max(0, it.ench) * 30 + (it.props?.length || 0) * 40 + (it.element ? 40 : 0);
    }
    default: return 0;   // quest items: not for sale
  }
}
export const priceFactor = (depth) => 1 + depth / 15;
export const sellPrice = (it) => Math.floor(itemPrice(it) * 0.3);

// Where something dropped at (x, y) comes to rest: not pressed up against a wall (it would
// half disappear into it), but at least 0.3 from any wall of its tile.
export function awayFromWalls(zone, x, y, z) {
  const tx = Math.floor(x), ty = Math.floor(y), zz = Math.floor(z);
  if (zone.solid(tx - 1, ty, zz)) x = Math.max(x, tx + 0.3);
  if (zone.solid(tx + 1, ty, zz)) x = Math.min(x, tx + 0.7);
  if (zone.solid(tx, ty - 1, zz)) y = Math.max(y, ty + 0.3);
  if (zone.solid(tx, ty + 1, zz)) y = Math.min(y, ty + 0.7);
  return [x, y];
}

export function makeItem(item, x, y, z) {
  return { ...item, x, y, z };
}

// --- Picking things up ---------------------------------------------------------------
export function addToInventory(p, it) {
  const { x, y, z, dropped, ...item } = it;
  if (item.kind === "potion" || item.kind === "scroll" || item.kind === "knife" || item.kind === "bomb") {   // these stack
    const n = item.count || 1;
    const stack = p.inv.find((s) => s.kind === item.kind && s.effect === item.effect);
    if (stack) { stack.count += n; return; }
    p.inv.push({ ...item, count: n });
  } else p.inv.push(item);
}

export function pickUpItems(game) {
  const { zone, player: p } = game;
  zone.items = zone.items.filter((it) => {
    const near = Math.hypot(it.x - p.x, it.y - p.y) <= 0.65 && Math.abs(it.z - p.z) <= 1.2;
    if (it.dropped) {                      // just dropped: leave it until you've stepped away
      if (Math.hypot(it.x - p.x, it.y - p.y) > 1) delete it.dropped;
      return true;
    }
    if (!near) return true;
    const name = itemName(game, it);
    sfx(it.relic ? "crystal" : { gold: "gold", heart: "crystal", strength: "crystal", key: "key", cube: "crystal" }[it.kind] || "pickup");
    if (it.kind === "heart") { p.maxHp += 5; p.hp += 5; game.log("You absorb the heart crystal. Max HP +5!", [240, 90, 110]); }
    else if (it.kind === "strength") { p.str += 1; game.log("You absorb the strength crystal. STR +1!", [255, 170, 80]); }
    else if (it.kind === "key") { p.keys++; game.log("You pick up a brass key.", [240, 200, 70]); }
    else if (it.kind === "gold") { p.gold += it.amount; game.log(`You pick up ${it.amount} gold.`, [255, 210, 70]); }
    else if (it.kind === "cube") game.onCube();   // the story takes over (game.js)
    else if (it.relic) {
      addToInventory(p, it);
      game.log(`You pick up ${name}, a relic! ${RELICS[it.relic].info[0].toUpperCase() + RELICS[it.relic].info.slice(1)}.`, RELIC_COLOR);
    } else {
      addToInventory(p, it);
      game.log(it.count > 1 ? `You pick up ${it.count} ${name}s.` : `You pick up ${it.kind === "quest" ? name : withArticle(name)}.`, itemGlyph(game, it)[1]);
    }
    return false;
  });
}
