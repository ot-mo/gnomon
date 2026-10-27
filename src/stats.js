// The single stat bus (TECH_DESIGN §2.6, Appendix A): attributes, bonuses and every derived number.
//
//   ATTRS                                the six attributes: str agi tou int wil ego
//   registerBonusSource(name, fn)        fn(e) → iterable of { key: n } objects; sources run in the order registered
//   bonus(e, key) → number               the sum over every source (cached per entity until invalidateStats(e))
//   bonusTable(e) → { key: sum }         the whole cached table (frozen)
//   invalidateStats(e)                   after anything a source reads changes: gear, perks, statuses, mutations
//   attr(e, k), mod(e, k)                the score with its bonuses, and floor((score − 16) / 2)
//   maxHp(e), av(e), dv(e), ma(e), speedMul(e), cooldownMul(e), carryCap(e), priceMul(game, e, trader),
//   regenEvery(e), mentalLevel(e), examineScore(e), canSwim(e)
//   raiseAttr(e, k, n), raiseMaxHp(e, n) permanent changes (potions, crystals, perks, gifts): the only writes to base fields
//   contentLevel(level)                  min(level, RULES.level.contentMax): what legacy tables are read with
//   setStatusBonus(fn)                   status.js plugs in fn(id, s) → { key: n } | null for the "statuses" source
//   guardBaseFields(e, onWrite) → proxy  debug: a view of e that reports (or throws on) any write to a base field
//
// Base fields (never written by gear, statuses or anything temporary; R3): e.attrs, e.maxHpGain, e.level.
// The cache is a cache of derived values, not baking: dropping it never changes a number.
//
// Two formula sets, picked by RULES.stats:
//   "legacy"      the parent game's numbers exactly (golden (a)): STR = 10 + gains + bonus(str), max HP =
//                 20 + 3 per level + gains + bonus(maxHp) (at least 1), armour = the worn armour + its
//                 enchantment + bonus(armour), speed = 1 + bonus(speed).
//   "attributes"  bible §10.6 / §15.6: STR = attrs.str + bonus(str), max HP = TOU + 4 + (level − 1) ×
//                 max(1, 3 + TOU mod) + gains + bonus(maxHp), AV adds bonus(av) and natural AV, DV, MA…
// Where the legacy game had no such number (DV, MA, cooldowns, carry), both sets use the attribute formula.
//
// Bonus keys (Appendix A). Kept from the parent game (items.js "Bonuses"):
//   crit (chance) · swing (fraction faster) · reach · maxDmg · leech (chance a hit heals 1) · crush (×2 vs brittle)
//   thorns · ward (less from arrows) · regen (1 HP every 12/points s) · darkRegen (regen with the torch out)
//   str · maxHp · armour · speed · torch (fraction brighter) · sense (tiles) · darkSight · stealth · firstBlock
//   jump (blocks) · featherFall · killHeal · undeadHeal · burnBonus · poisonHit · sunder · cutsFlat · foldGuard
// New: the six attributes (str agi tou int wil ego) · av · dv · ma · toHit · examine · navigation · travel ·
//   carry · price · cooldown · resistFire · resistFrost · resistShock · resistPoison · swim · missileAcc (to hit with
//   a missile weapon: missiles.js missileSpec; WS4's Steady hand) · torchCost (the torch's glim: −0.5 half, −1 free;
//   torch.js burnTorch; Cassin's Level, Thrifty wick, Lampskin, a glim heart).
// (`pv` from the tech design is gone: DECISIONS, no penetration dice.)
import { RULES } from "./rules.js";
import { itemBonuses, ITEM_KINDS } from "./items.js";
import { worn } from "./body.js";
import { PERKS, perkRank } from "./leveling.js";
import { hasKey, keysOf } from "./keyset.js";

export const ATTRS = ["str", "agi", "tou", "int", "wil", "ego"];
export const BONUS_KEYS = ["crit", "swing", "reach", "maxDmg", "leech", "crush", "thorns", "ward", "regen", "darkRegen",
  "str", "maxHp", "armour", "speed", "torch", "sense", "darkSight", "stealth", "firstBlock", "jump", "featherFall",
  "killHeal", "undeadHeal", "burnBonus", "poisonHit", "sunder", "cutsFlat", "foldGuard",
  "agi", "tou", "int", "wil", "ego", "av", "dv", "ma", "toHit", "examine", "navigation", "travel", "carry", "price",
  "cooldown", "resistFire", "resistFrost", "resistShock", "resistPoison", "swim", "missileAcc", "torchCost"];
export const BASE_FIELDS = ["attrs", "maxHpGain", "level"];

// --- Sources ----------------------------------------------------------------------------------
const cache = new WeakMap();
const guarded = new WeakMap();   // guardBaseFields' proxy → its entity, so the cache keys on the real entity
let cacheEpoch = 0;
const SOURCES = [];
export function registerBonusSource(name, fn) {
  const at = SOURCES.findIndex((s) => s.name === name);
  if (at >= 0) SOURCES[at] = { name, fn }; else SOURCES.push({ name, fn });
  cacheEpoch++;   // a new source changes every table
}
export const bonusSources = () => SOURCES.map((s) => s.name);

// What an entity wears and wields (body.js worn(): equipped items and implants; the weapon on the
// belt only counts once it's in your hand).
registerBonusSource("gear", (e) => worn(e).map(itemBonuses));
registerBonusSource("powers", function* (e) {
  if (!e.perks) return;
  for (const k of keysOf(e.perks)) { const b = PERKS[k]?.bonus; if (b) yield b(perkRank(e, k)); }
});
let statusBonus = () => null;
export function setStatusBonus(fn) { statusBonus = fn || (() => null); cacheEpoch++; }
registerBonusSource("statuses", function* (e) {
  if (!e.status) return;
  for (const id in e.status) { const b = statusBonus(id, e.status[id], e); if (b) yield b; }
});
// An entity's own bonus table, e.bonuses (0C; a creature's natural DV, say). Not e.innate: that is abilities.js's list
// of ability ids (the player's ["foldStep"], a creature's for ai.js), which this source used to add up as a table
// with a key "0" (WS8's integration request 11).
registerBonusSource("innate", (e) => (e.bonuses ? [e.bonuses] : []));

// --- The cache --------------------------------------------------------------------------------
// Per entity: { epoch, table }. A table is built on the first bonus() after invalidateStats(e)
// (or after a source is registered) and is a frozen { key: sum } with only the keys that occur.
export const STATS_DEBUG = { verify: false, builds: 0 };   // verify: every bonus() also rebuilds and compares

export function bonusTableUncached(e) {
  const out = {};
  for (const { fn } of SOURCES)
    for (const b of fn(e)) for (const k in b) out[k] = (out[k] || 0) + b[k];
  return out;
}
const real = (e) => guarded.get(e) || e;
export function bonusTable(e) {
  e = real(e);
  let c = cache.get(e);
  if (!c || c.epoch !== cacheEpoch) {
    c = { epoch: cacheEpoch, table: Object.freeze(bonusTableUncached(e)) };
    cache.set(e, c);
    STATS_DEBUG.builds++;
  } else if (STATS_DEBUG.verify) {
    const fresh = bonusTableUncached(e);
    for (const k of new Set([...Object.keys(fresh), ...Object.keys(c.table)]))
      if ((fresh[k] || 0) !== (c.table[k] || 0))
        throw new Error(`stale stat cache: bonus(${k}) is ${c.table[k] || 0}, the sources say ${fresh[k] || 0} (missing invalidateStats)`);
  }
  return c.table;
}
export const bonus = (e, key) => bonusTable(e)[key] || 0;
export function invalidateStats(e) { if (e) cache.delete(real(e)); }

// --- Attributes -------------------------------------------------------------------------------
const legacy = () => RULES.stats === "legacy";
const baseAttr = (e, k) => e.attrs?.[k] ?? RULES.attr.base;
export function attr(e, k) {
  if (k === "str" && legacy()) return baseAttr(e, k) - RULES.attr.base + RULES.legacy.str + bonus(e, k);
  return baseAttr(e, k) + bonus(e, k);
}
export const mod = (e, k) => Math.floor((attr(e, k) - RULES.attr.center) / 2);

// --- Derived numbers --------------------------------------------------------------------------
export function maxHp(e) {
  if (!e.attrs) return e.maxHp;                          // creatures keep their own max HP until 0C
  const level = e.level || 1, gain = e.maxHpGain || 0;
  if (legacy()) return Math.max(1, RULES.legacy.hp + RULES.legacy.hpPerLevel * (level - 1) + gain + bonus(e, "maxHp"));
  const H = RULES.hp, perLevel = Math.max(H.perLevelMin, H.perLevel + mod(e, "tou"));
  return Math.max(1, attr(e, "tou") + H.touPlus + (level - 1) * perLevel + gain + bonus(e, "maxHp"));
}
// Armour (can be negative with cursed armour: then blows hurt more): the worn pieces' armour values
// (ITEM_KINDS[kind].av, today only body armour) plus bonuses.
export function av(e) {
  let body = 0;
  for (const it of worn(e)) body += ITEM_KINDS[it.kind]?.av?.(it) || 0;
  if (legacy()) return body + bonus(e, "armour");
  return body + bonus(e, "armour") + bonus(e, "av") + (e.naturalAv || 0);
}
export function dv(e, { unable = false } = {}) {
  if (unable) return 0;                                  // stunned or paralysed (status.js passes its noAct flag)
  return RULES.dv.base + mod(e, "agi") + bonus(e, "dv");
}
export const ma = (e) => RULES.ma.base + mod(e, "wil") + bonus(e, "ma");
export const speedMul = (e) => 1 + bonus(e, "speed");   // haste is applied by whoever moves (× RULES.haste)
export function cooldownMul(e) {
  const C = RULES.cooldown;
  return Math.max(C.min, Math.min(C.max, (1 - C.perPoint * (attr(e, "wil") - RULES.attr.center)) * (1 - bonus(e, "cooldown"))));
}
export const carryCap = (e) => RULES.carry.perStr * attr(e, "str") + bonus(e, "carry");
export const mentalLevel = (e) => (e.level || 1) + mod(e, "ego");
export const examineScore = (e) => attr(e, "int") + bonus(e, "examine");   // + d10 by the caller, vs complexity
export const canSwim = (e) => bonus(e, "swim") > 0;
// Seconds per point of natural regeneration (the attribute set; the legacy game had none).
export function regenEvery(e) {
  if (legacy()) return Infinity;
  return RULES.regen.base / Math.max(0.1, 1 + 0.1 * (mod(e, "tou") + mod(e, "wil")));
}
// Price multipliers on an item's value: { buy, sell }. `step` is the reputation step with the trader's
// faction (bible §15.6: Warm +0.1, Bright +0.2, Cold −0.1); 0 until factions exist (WS6a).
export function priceMul(game, e, trader = null) {
  if (legacy()) return { buy: hasKey(e.perks, "haggler") ? RULES.legacy.haggle : 1, sell: RULES.legacy.sellShare };
  const P = RULES.price, m = mod(e, "ego") + bonus(e, "price"), step = trader?.repStep || 0;
  const sell = Math.max(0, P.sell + P.sellPerMod * m + step / 2);
  return { buy: Math.max(P.minBuy, sell, P.buy - P.buyPerMod * m - step), sell };
}

export const contentLevel = (level) => Math.min(level, RULES.level.contentMax);

// --- Permanent changes ------------------------------------------------------------------------
// The only writes to base fields: a potion or crystal of strength, a perk, a gift.
export function raiseAttr(e, k, n) {
  if (!ATTRS.includes(k)) throw new Error(`raiseAttr: no attribute ${k}`);
  (e.attrs ||= Object.fromEntries(ATTRS.map((a) => [a, RULES.attr.base])))[k] += n;
  invalidateStats(e);
}
export function raiseMaxHp(e, n) { e.maxHpGain = (e.maxHpGain || 0) + n; invalidateStats(e); }
export const makeAttrs = (v = RULES.attr.base) => Object.fromEntries(ATTRS.map((a) => [a, v]));

// HP never above max HP (after gear that gave max HP comes off, say). Current HP isn't a base field.
export function clampHp(e) {
  const m = maxHp(e);
  if (e.hp > m) e.hp = Math.max(1, m);
}

// --- Debug: catch writes to base fields -------------------------------------------------------
// guardBaseFields(e, onWrite) → a Proxy of e (and of e.attrs) that calls onWrite(path, value) for
// every write to a base field, then lets it through. Pass `allow` to whitelist the permanent
// changes you expect (raiseAttr / raiseMaxHp go through the proxy too).
export function guardBaseFields(e, onWrite) {
  const attrs = new Proxy(e.attrs, {
    set(t, k, v) { onWrite(`attrs.${String(k)}`, v); t[k] = v; return true; },
  });
  const proxy = new Proxy(e, {
    get(t, k) { return k === "attrs" ? attrs : t[k]; },
    set(t, k, v) { if (BASE_FIELDS.includes(k)) onWrite(String(k), v); t[k] = v; return true; },
    deleteProperty(t, k) { if (BASE_FIELDS.includes(k)) onWrite(String(k), undefined); delete t[k]; return true; },
  });
  guarded.set(proxy, e);
  return proxy;
}
