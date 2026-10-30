// Items (TECH_DESIGN §2.9): the item kind registry and everything that works on any item.
// The parent game's tables and kinds live in content/items/legacy.js (re-exported here).
//
//   registerItemKind(kind, def)     ItemKindDef: { stack, slot?(it) → part type, hands?(it), req?(it) → { str },
//                                   name(game, it), glyph(game, it) → [ch, rgb], info?(game, it), details?(game, it),
//                                   price(it), weight(it), art, palette(game, it), stands?,
//                                   use?: (game, e, it) → s | the name of an item action,
//                                   throwable?, onImpact?, onPickup?(game, e, it) → consumed | "stay", canPickUp?(game, e, it), sound?, bonuses?(it),
//                                   aura?(game, it), av?(it) (worn armour value), abilities?(it), examine? }
//   registerItemAction(name, fn)    fn(game, e, it) → seconds: a use shared by kinds ("drink", "read", "wear"),
//                                   so content can name it without importing the modules that do it
//   itemActions() → [names]         the registered actions (read-only; check-content)
//   useItem(game, e, it) → seconds  0 if it has no use
//   itemName itemGlyph itemInfo itemDetails itemPrice itemWeight itemAura itemPalette itemSprite itemBonuses
//   stackKey(it) → key | null       items with the same key stack (null: never)
//   isGear(it)                      the kind has a slot (body.js puts it on a part)
//   addToInventory(e, it) → stack   takeOne(e, stack) → item (the one way to split a stack)
//   pickUpItems(game)  pickUpHere(game) → n (G)  makeItem(item, x, y, z)  awayFromWalls(zone, x, y, z)
//
// Unknown kinds answer with the defaults (no name, no price, no aura) instead of throwing.
import { sfx } from "./sfx.js";
import { emit } from "./events.js";
import { seededSort } from "./rng.js";
import { hasKey } from "./keyset.js";
import { RULES } from "./rules.js";
import { POTIONS, SCROLLS, SYLLABLES, ELEMENTS, WEAPONS, ARMOURS, PROPERTIES, RINGS, AMULETS, RELICS, RELIC_COLOR } from "./content/items/legacy.js";
import { MATERIALS } from "./content/items/forge.js";
export { POTIONS, POTION_COLORS, SCROLLS, ELEMENTS, WEAPONS, WEAPON_PALETTE, ARMOURS, PROPERTIES, RINGS, AMULETS, GEMS, RELICS,
  RELIC_COLOR, FLOOR_ART, makeRelic, pickRelic } from "./content/items/legacy.js";

// --- The registry ---------------------------------------------------------------------------
// (Kept on a function so content modules can register while this module is still loading: the
// content imports items.js and items.js imports the content, and a function exists from the start.)
function kinds() { return (kinds.table ||= {}); }
export const ITEM_KINDS = kinds();
export function registerItemKind(kind, def) {
  if (kinds()[kind]) throw new Error(`registerItemKind: ${kind} is already registered`);
  if (typeof def.name !== "function" || typeof def.glyph !== "function") throw new Error(`registerItemKind: ${kind} needs name() and glyph()`);
  kinds()[kind] = def;
}
const kindOf = (it) => kinds()[it?.kind];
function actions() { return (actions.table ||= {}); }
export function registerItemAction(name, fn) { actions()[name] = fn; }
export const itemActions = () => Object.keys(actions());
export function useItem(game, e, it) {
  const use = kindOf(it)?.use;
  const fn = typeof use === "string" ? actions()[use] : use;
  return fn ? fn(game, e, it) : 0;
}
export const canUse = (it) => !!kindOf(it)?.use;

export const itemName = (game, it) => kindOf(it)?.name(game, it);
export const itemGlyph = (game, it) => kindOf(it)?.glyph(game, it);
export const itemInfo = (game, it) => kindOf(it)?.info?.(game, it) ?? "";
export const itemDetails = (game, it) => kindOf(it)?.details?.(game, it) ?? [itemInfo(game, it)].filter(Boolean);
export const itemPrice = (it) => kindOf(it)?.price?.(it) ?? 0;
export const itemWeight = (it) => kindOf(it)?.weight?.(it) ?? 0;
// "good" | "neutral" | "bad" if you know it (by identifying the item, or from a potion of
// seeing), otherwise null.
export const itemAura = (game, it) => kindOf(it)?.aura?.(game, it) ?? null;
export const itemPalette = (game, it) => kindOf(it)?.palette?.(game, it);
export const isGear = (it) => !!(it && kindOf(it)?.slot);
export function stackKey(it) {
  const s = kindOf(it)?.stack;
  return s ? `${it.kind}:${it.effect ?? ""}` : null;
}

// A random title for every kind of scroll, different every run.
export function scrollTitles(rand) {
  const word = () => Array.from({ length: 2 + Math.floor(rand() * 2) }, () => SYLLABLES[Math.floor(rand() * SYLLABLES.length)]).join("");
  return Object.fromEntries(Object.keys(SCROLLS).map((k) => [k, `${word()} ${word()}`.toUpperCase()]));
}

// Every bonus one worn or wielded item gives (its kind's own, such as a ring or amulet's power; its
// properties; a relic's gift). Armour's armour value is not a bonus: stats.js av() reads the piece.
export function itemBonuses(it) {
  const out = {};
  const add = (b) => { for (const k in b) out[k] = (out[k] || 0) + b[k]; };
  if (!it) return out;
  const own = kindOf(it)?.bonuses;
  if (own) add(own(it));
  for (const k of it.props || []) add(PROPERTIES[k].bonus);
  if (it.relic) add(RELICS[it.relic].bonus);
  if (it.histRelic) for (const b of it.powers || []) if (b && typeof b === "object") add(b);   // a history relic's bonus powers (gen/vaults.js BOTTOM_LOOT.relic); an ability id's (a string) isn't a bonus (integrator, C2 #10: its letters were walked as keys)
  return out;
}

// Strength needed to use a weapon or armour ("light" armour needs less).
export function strNeeded(it) {
  const base = (it.kind === "weapon" ? WEAPONS : ARMOURS)[it.id].str;
  // (B1, C4 #4: a material's own, pleatmetal's -3)
  return Math.max(0, base + (MATERIALS[it.made]?.strReq || 0) + (it.props || []).reduce((s, k) => s + (PROPERTIES[k].strReq || 0), 0));
}

// The Repair power (B1, bible §10.8 Artificing): E on a broken thing mends it, a snapped bone weapon or a broken
// artifact (and a chipped blackglass blade's edge with it). Without the power it says what would.
//   mendItem(game, e, it) → seconds (0: nothing done)
export const MEND_TIME = 10;
export function mendItem(game, e, it) {
  const chipped = it?.made && it.chips > 0;
  if (!it || (!it.broken && !chipped)) return 0;
  const name = itemName(game, it);
  if (!hasKey(e.perks, "repair")) {
    if (e === game.player) game.log(`The ${name} needs mending first (the Repair power).`, [170, 170, 170]);
    return 0;
  }
  it.broken = false;
  if (chipped) { it.material = MATERIALS[it.made].dmg; it.chips = 0; }
  if (e === game.player) game.log(`You mend the ${itemName(game, it)}.`, [200, 220, 200]);
  return MEND_TIME;
}

// --- How things look lying on the floor ---------------------------------------
// Things that stand (weapons, stuck in the ground) stand; the rest bob.
export function itemSprite(game, it, time) {
  const def = kindOf(it), a = def.art;
  const lift = def.stands ? -0.12 : 0.25 + 0.06 * Math.sin(time * 3 + it.x * 7);
  return { x: it.x, y: it.y, z: it.z + lift, w: a.w, h: a.h, art: a.art, palette: itemPalette(game, it) };
}

export const withArticle = (name) => (/^[aeiou]/.test(name) ? "an " : "a ") + name;

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
    ...Object.entries(ARMOURS).filter(([, a]) => a.tier > 0 && a.tier <= maxTier && !a.slot).map(([id, a]) => [{ kind: "armour", id }, weight(a.tier)]),
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

// The real world's loot (B1, C4 #1): its gear is C4's classes and pieces in materials (content/items/gear.js
// randomGear, by level) and a share of its potions are tonics (content/items/tonics.js randomTonic), which those
// modules register here as they load (they import this one). The test world, the legacy stack under it and the
// parent's peddler keep the parent's draws exactly (golden (b)); `real` is realWorld(game.run) or the generator's flag.
//   realWorld(run) → bool                      a run on GNOMON's world (not the test world)
//   lootGear(rand, depth, luck, real)          randomGear(rand, level, luck) on the real world, else randomEquipment
//   lootPotion(rand, real)                     on the real world a tonic TONIC_SHARE of the time, else randomPotion
//   lootTonic(rand) → { kind: "tonic", effect } | null   a tonic (a shelf's)
//   registerLoot("gear" | "tonic", fn)        (a function, so gear.js and tonics.js can call it while this module loads)
function loot() { return (loot.table ||= { gear: null, tonic: null }); }
export function registerLoot(kind, fn) { loot()[kind] = fn; }
export const TONIC_SHARE = 0.4;
export const realWorld = (run) => !!run?.world && run.world.id !== "test";
export const lootGear = (rand, depth, luck = 0, real = false) =>
  (real && loot().gear ? loot().gear(rand, depth, luck) : randomEquipment(rand, depth, luck));
export const lootTonic = (rand = Math.random) => loot().tonic?.(rand) ?? null;
export const lootPotion = (rand = Math.random, real = false) =>
  (real && loot().tonic && rand() < TONIC_SHARE ? loot().tonic(rand) : randomPotion(rand));

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
export function randomTreasure(rand, depth, real = false) {
  const R = RULES.relics;
  if (depth >= R.minLevel && depth <= R.maxLevel && rand() < R.chance) return { kind: "relic?" };
  const roll = rand();
  if (roll < 0.08) return { kind: "strength" };
  if (roll < 0.16) return { kind: "heart" };
  if (roll < 0.5) return lootGear(rand, depth + 1, 0.15, real);
  if (roll < 0.62 && depth >= 3) return randomJewel(rand, depth + 1, 0.1);
  if (roll < 0.8) return randomScroll(rand);
  return { kind: "knife", count: 3 + Math.floor(rand() * 3) };
}

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

// --- Stacks -----------------------------------------------------------------------------------
// Into the pack: stackable things join a stack with the same key. Returns the stack it's in.
export function addToInventory(e, it) {
  const { x, y, z, dropped, ...item } = it;
  // Readhand (B1, C4 #8): an artifact is known as it comes into your hands, by any way (found, bought, given). The
  // artifact kind's onPickup says so for one picked up; a trade or a gift hands its onPickup a copy (verification finding).
  if (item.kind === "artifact" && e.mutations?.readhand && item.known !== true && !item.broken) item.known = true;
  const key = stackKey(item);
  if (key) {
    const n = item.count || 1;
    const stack = e.inv.find((s) => stackKey(s) === key);
    if (stack) { stack.count += n; return stack; }
    const fresh = { ...item, count: n };
    e.inv.push(fresh);
    return fresh;
  }
  e.inv.push(item);
  return item;
}

// Take one thing out of the pack (one off a stack, or the whole item) and return it.
export function takeOne(e, stack) {
  const at = e.inv.indexOf(stack);
  if (at < 0) return null;
  if (stackKey(stack)) {
    stack.count--;
    if (stack.count <= 0) e.inv.splice(at, 1);
    return { kind: stack.kind, effect: stack.effect };
  }
  e.inv.splice(at, 1);
  return stack;
}

// --- Picking things up ---------------------------------------------------------------
// G (TECH_DESIGN §4.3): pick up what lies at your feet now, even something you've just dropped (walking over things
// picks them up anyway; this is for the thing you dropped and changed your mind about). Returns how many were taken.
export function pickUpHere(game) {
  const { zone, player: p } = game, before = zone.items.length;
  for (const it of zone.items)
    if (it.dropped && Math.hypot(it.x - p.x, it.y - p.y) <= 0.65 && Math.abs(it.z - p.z) <= 1.2) delete it.dropped;
  pickUpItems(game);
  const n = before - zone.items.length;
  if (!n) game.log("There's nothing here to pick up.", [170, 170, 170]);
  return n;
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
    const name = itemName(game, it), def = kindOf(it);
    if (def?.canPickUp && !def.canPickUp(game, p, it)) return true;   // (a full purse, once told)
    sfx(it.relic ? "crystal" : def?.sound || "pickup");
    const taken = def?.onPickup?.(game, p, it);
    if (taken === "stay") return true;                // only part of it (a full purse): the rest stays
    if (taken) return false;                          // absorbed, counted or the story took over
    addToInventory(p, it);
    emit(game, "pickup", { e: p, item: it });   // (TECH §2.12; WS7b's fetch quests)
    if (it.relic) game.log(`You pick up ${name}, a relic! ${RELICS[it.relic].info[0].toUpperCase() + RELICS[it.relic].info.slice(1)}.`, RELIC_COLOR);
    else game.log(it.count > 1 ? `You pick up ${it.count} ${name}s.` : `You pick up ${it.kind === "quest" ? name : withArticle(name)}.`, itemGlyph(game, it)[1]);
    return false;
  });
}
