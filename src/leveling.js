// Experience and levels. Kills give XP; every level gives max HP and a choice of one of three permanent
// perks, which the bible calls powers (the game pauses while you choose: screens/levelup.js). Every fifth
// level is a milestone: four choices, one of them a rare "major" perk. Some perks can be taken again, for a
// stronger rank (max: how many times). bonus(rank): what the perk adds to the stat bus (stats.js bonus(), the
// "powers" source). The table is content/powers.js POWERS (PERKS here is the same object).
//
// Two sets, as everywhere (RULES.stats):
//   "legacy"      the parent game exactly: +3 max HP a level, three of its 25 perks offered with Math.random
//                 (four at a milestone, the first a major), and the same log lines, so golden (a) holds.
//   "attributes"  bible §10.7, §15.6: max HP is derived (stats.js: max(1, 3 + TOU mod) a level), the Bent gain a
//                 crease a level, an attribute point comes every 4th level, and the powers are offered from your
//                 open trees and the general pool by offerPowers, seeded from the run's seed and the level.
//
//   xpToNext(level) = lvlXP(level)        10L² + 10: what one level costs (20, 50, 100, 170, 260…)
//   killXp(game, c, { legendary }) → n   bible §10.7: max(1, round(0.01 × lvlXP(creature level))), elites × 2.5,
//                                        legendaries × 10; 2 tiers below your tier 25%, 3 or more nothing
//   xpReward(kind, level) → n            the other sources: RULES.progression.xp.rewards[kind] × lvlXP(level)
//   gainXp(game, amount, { source = "kill" })   Pilgrim (state.mode "pilgrim"): kills give nothing, every other
//                                        source 2.2 times as much; then the levels it buys
//   offerPerks(p, milestone)             the legacy set's offer (Math.random)
//   offerPowers(game, p, { level, milestone, draw }) → ids   the attribute set's: 3 (4 at INT 18+), a major among
//                                        them at a milestone; seeded by (seed, level, draw)
//   takePerk(game, key)                  one more rank; Tough and Mighty raise base fields (stats.js raiseMaxHp/raiseAttr)
//   tierOf(level)                        min(8, ceil((level + 1) / 3)): players and zones alike
import { sfx } from "./sfx.js";
import { invalidateStats, raiseAttr, raiseMaxHp, maxHp, attr } from "./stats.js";
import { RULES, extendRules } from "./rules.js";
import { hasKey, addKey } from "./keyset.js";
import { makeRng, seedFor } from "./rng.js";
import { POWERS, LEGACY_PERKS } from "./content/powers.js";
import { GENOTYPES } from "./content/genotypes.js";

// The attribute set's progression numbers (bible §10.7, §15.6).
extendRules("progression", {
  xp: {
    killShare: 0.01, elite: 2.5, legendary: 10,            // a kill: max(1, round(killShare × lvlXP(Lc))) × elite / legendary
    tiersBelow: { 2: 0.25, 3: 0 },                         // a creature 2 tiers below yours gives 25%; 3 or more, nothing
    pilgrimKill: 0, pilgrimOther: 2.2,                     // Pilgrim mode (bible §10.1)
    rewards: { landmark: 0.3, village: 0.2, siteBottom: 0.4, villageQuest: 0.6, triangulation: 0.15, kindling: 0.08, beat: 0.75 },
    beatEarly: 1.5,                                        // a beat begun below its band
  },
  level: { attrPointEvery: 4, milestoneEvery: 5, offers: 3, offersHighInt: 4, highInt: 18 },
});

export const PERKS = POWERS;

const ROMAN = ["", "", " II", " III", " IV"];
export const perkRank = (p, key) => p.perkRank?.[key] || (hasKey(p.perks, key) ? 1 : 0);
export const perkLabel = (p, key) => PERKS[key].name + ROMAN[perkRank(p, key) + 1];   // the name of the rank you'd get next

// XP needed to go from this level to the next: 20, 50, 100, 170, 260, … — each level takes
// noticeably longer than the last (roughly one level every floor or two). The bible keeps the curve (lvlXP).
export const xpToNext = (level) => 10 * level * level + 10;
export const lvlXP = xpToNext;
export const tierOf = (level) => Math.min(RULES.level.tierMax, Math.ceil((level + 1) / 3));

export function killXp(game, c, { legendary = !!(c.legend || c.boss) } = {}) {
  const X = RULES.progression.xp, p = game.player;
  let xp = Math.max(1, Math.round(X.killShare * lvlXP(c.level || 1)));
  if (legendary) xp *= X.legendary; else if (c.elite) xp *= X.elite;
  const below = tierOf(p?.level || 1) - tierOf(c.level || 1);
  if (below >= 3) return X.tiersBelow[3];
  if (below === 2) xp *= X.tiersBelow[2];
  return Math.round(xp);
}
export const xpReward = (kind, level) => Math.round((RULES.progression.xp.rewards[kind] ?? 0) * lvlXP(level));

// What a run's mode makes of an amount (bible §10.1): Pilgrim's kills give nothing, its other sources 2.2 times as much.
export function modeXp(game, amount, source = "kill") {
  if (game.state?.mode !== "pilgrim") return amount;
  const X = RULES.progression.xp;
  return source === "kill" ? amount * X.pilgrimKill : Math.round(amount * X.pilgrimOther);
}

export function gainXp(game, amount, { source = "kill" } = {}) {
  const p = game.player;
  p.xp += modeXp(game, amount, source);
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    if (RULES.stats !== "legacy") { levelUp(game, p); continue; }
    p.level++;            // max HP follows the level (stats.js maxHp)
    p.hp += 3;
    p.pendingLevels++;
    sfx("levelup");
    game.log(`You reach level ${p.level}${p.level % 5 === 0 ? " (a milestone!)" : ""}! (+3 max HP)`, [255, 230, 120]);
  }
}

// One level under the attribute set: what max HP gains, the Bent's crease, an attribute point every 4th level;
// the power is chosen on the level-up card (screens/levelup.js), one for each pending level.
function levelUp(game, p) {
  const L = RULES.progression.level, before = maxHp(p);
  p.level++;
  const hp = maxHp(p) - before;
  p.hp += hp;
  const creases = GENOTYPES[p.genotype]?.creasesPerLevel || 0;
  if (creases) p.creases = (p.creases || 0) + creases;
  const point = p.level % L.attrPointEvery === 0;
  if (point) p.attrPoints = (p.attrPoints || 0) + 1;
  p.pendingLevels++;
  sfx("levelup");
  const gains = [`+${hp} max HP`, creases && `+${creases} crease${creases > 1 ? "s" : ""}`, point && "an attribute point"].filter(Boolean);
  game.log(`You reach level ${p.level}${p.level % L.milestoneEvery === 0 ? " (a milestone!)" : ""}! (${gains.join(", ")})`, [255, 230, 120]);
}

const open = (p, k) => perkRank(p, k) < (PERKS[k].max || 1);

// The legacy set: three different perks you could still take (or raise a rank); at a milestone, four,
// the first of them a major perk if any are left.
export function offerPerks(p, milestone = false) {
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const minor = shuffle(LEGACY_PERKS.filter((k) => open(p, k) && !PERKS[k].major));
  const major = shuffle(LEGACY_PERKS.filter((k) => open(p, k) && PERKS[k].major));
  if (!milestone) return minor.slice(0, 3);
  return [...major.slice(0, 1), ...minor].slice(0, 4);
}

// The attribute set (bible §10.8): powers from your open trees (p.trees) and the general pool, 3 of them (4 at INT
// 18+); at a milestone the first is a major. Powers still waiting for their hook (needs) are never offered. While
// the trees are thin (until teachers open more, WS6b, and C4 fills them) the rest come from the other trees.
// The same seed, level and draw give the same offers (draw counts offers made at that level: gifts, rerolls).
export function offerPowers(game, p, { level = p.level, milestone = level % RULES.progression.level.milestoneEvery === 0, draw = 0 } = {}) {
  const L = RULES.progression.level, rng = makeRng(seedFor(game.seed ?? 0, "powers", level, draw));
  const n = attr(p, "int") >= L.highInt ? L.offersHighInt : L.offers;
  const trees = new Set(p.trees || []);
  const ids = Object.keys(PERKS).filter((k) => !PERKS[k].needs && open(p, k));
  const inOpen = (k) => PERKS[k].general || trees.has(PERKS[k].tree);
  const majors = rng.shuffle(ids.filter((k) => PERKS[k].major));
  const mine = rng.shuffle(ids.filter((k) => !PERKS[k].major && inOpen(k)));
  const others = rng.shuffle(ids.filter((k) => !PERKS[k].major && !inOpen(k)));
  const out = milestone && majors.length ? [majors[0]] : [];
  for (const k of [...mine, ...others]) if (out.length < n) out.push(k);
  return out;
}

export function takePerk(game, key) {
  const p = game.player;
  const r = perkRank(p, key) + 1;
  addKey(p.perks, key);
  (p.perkRank ||= {})[key] = r;
  invalidateStats(p);
  if (key === "tough") { raiseMaxHp(p, 8); p.hp += 8; }
  if (key === "mighty") raiseAttr(p, "str", 2);
  game.log(`You gain a ${RULES.stats === "legacy" ? "perk" : "power"}: ${PERKS[key].name}${r > 1 ? ROMAN[r] : ""}. ${PERKS[key].info}`, [255, 230, 120]);
}
