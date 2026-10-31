// RULES: every tunable formula constant of the core in one place (TECH_DESIGN §0.2, §2.6, §8.1).
//
//   RULES.<ns>.<field>               read anywhere; RULES itself, and every namespace in it, is frozen
//   extendRules(ns, values)          a module adds its own namespace once (a workstream's RULES.<ws>);
//                                    an existing namespace can't be replaced or changed
//   overrideRules(ns, value) → undo  tests and the debug console only: swap one namespace (or a switch
//                                    such as RULES.stats) for a while; call undo() to put it back
//
// The numbers come from the bible (§10.6, §15.6) where it gives them; DECISIONS.md wins over both.
// This file belongs to the integrator: workstreams extend RULES, they don't edit it.

const deepFreeze = (v) => {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(v[k]);
  }
  return v;
};

const CORE = {
  // Which formula sets run. Phase 0 kept the parent game's numbers ("legacy") so the golden traces proved the
  // refactor changed nothing; with WS4 and WS8 in, the integrator flipped both (§8.5). The checks that replay the
  // parent's fixtures (golden (a), the legacy fights) set "legacy" themselves (overrideRules).
  stats: "attributes",  // "legacy" | "attributes" (the flip, at p2-flip: the user's call, 2026-10-27)
  combat: "d20",        // "legacy" | "d20" (0C; flipped with stats)

  // The d20 set (DECISIONS; bible §10.6, §15.6; combat.js). To-hit: d20 + mods > DV; a natural 1 misses, a
  // natural ≥ critNat hits and crits (× crit); critNat = 20 − round(20 × (bonus(crit) + critPerAgi × AGI mod)),
  // never below minCritNat. Creatures: d20 + floor(level / hitPerLevels) vs your DV; their DV is creatureDv +
  // floor(level / dvPerLevels) + the species' dv. aimed: a projectile that physically reached its target;
  // reqPenalty per missing STR point of the wielded weapon, at most reqPenaltyMax. strOver: every blow of
  // your blade, fists too, counts STR over this, not over the weapon's requirement (which still costs to-hit when you
  // lack it); swingRef: that STR term and the material scale by the weapon's swing ÷ this, so a fast blade's damage a
  // second matches a slow one's (the light-weapon fix, approved by the user 2026-10-30: docs/balance/
  // light-weapons-2026-10-30.md, rule B; until then fistReq 10 for bare hands and the weapon's requirement otherwise).
  // Creatures (creatures.js spawnCreature, not bosses or guardians): health × (1 + creatureHp × (level − 1)), damage +
  // creatureDmg + floor((level − 1) / creatureDmgEvery); the legacy set keeps the parent's +6% and +1 per 4. (The
  // balance phase, approved by the user 2026-10-30: docs/balance/proposal-2026-10-30.md §3.1.) // B1: from tier8From
  // (tier 8: level 21 up) their health × tier8Hp and their damage − tier8Dmg (the user's decision of 2026-10-30, "Retune
  // tier 8", HP ×0.85 and damage −2, measured in the coordinator's b1-ttk-measured.md: a typical kill at tier 8 ~38%).
  d20: { die: 20, crit: 2, critPerAgi: 0.02, minCritNat: 2, highGround: 1, highGroundZ: 1, aimed: 3,
         creatureDv: 5, dvPerLevels: 4, hitPerLevels: 3, reqPenalty: 2, reqPenaltyMin: 4, reqPenaltyMax: 8, reqDmg: 0.6, strOver: 10, swingRef: 0.7,
         creatureHp: 0.18, creatureDmg: 3, creatureDmgEvery: 1.5, tier8From: 21, tier8Hp: 0.85, tier8Dmg: 2 },   // B1

  // Attributes (bible §10.6): modifier = floor((score − center) / 2); everyone has `base` until WS4.
  attr: { list: ["str", "agi", "tou", "int", "wil", "ego"], base: 16, center: 16 },

  // The legacy set: today's numbers exactly. STR reads 10 (base − 6), max HP is 20 + 3 per level.
  legacy: { str: 10, hp: 20, hpPerLevel: 3, crit: 0.12, sellShare: 0.3, haggle: 0.8 },

  // The attribute set (bible §10.6, §15.6; TECH_DESIGN §2.6).
  hp: { touPlus: 4, perLevel: 3, perLevelMin: 1 },     // TOU + 4 at level 1, then max(1, 3 + TOU mod) per level
  dv: { base: 6 },                                     // player DV = 6 + AGI mod + worn DV + bonus(dv); 0 while unable to act
  ma: { base: 4 },                                     // MA = 4 + WIL mod + bonus(ma)
  cooldown: { perPoint: 0.05, min: 0.2, max: 2,        // × (1 − 0.05 × (WIL − 16)), clamped
              // Once-per-floor effects are game-time cooldowns (TECH_DESIGN §2.4, review #26), in seconds;
              // a rest of an hour clears the first two: one world hour, 60 s (the clock below; Phase 2, WS1 #7).
              secondWind: 300, firstBlock: 120, foldingStrike: 10, restClears: 60 },
  price: { buy: 1.5, buyPerMod: 0.1, sell: 0.3, sellPerMod: 0.05, minBuy: 0.2,   // value × (1.5 − 0.1·EGO mod − step) …
           levelStep: 15, haggle: 0.8 },                                     // … × (1 + level / 15) (currency.js priceLevel); the Haggler × 0.8
  carry: { perStr: 15 },
  encumbrance: false,
  regen: { base: 60 },                                 // attribute set: 1 HP per base / (1 + 0.1 (TOU mod + WIL mod)) s
  haste: 1.6,                                          // speed (and action time) while hasted
  drown: { air: 10, dps: 1, speed: 0.4 },              // TECH_DESIGN §2.7: breath in s, then damage per s; speed ×0.4
  // skipTime (time.js): a status with its own tick (drowning) catches up in chunks this long, and until()
  // is asked at least every 60 chunks; hostiles awake within activeRadius tiles interrupt.
  time: { chunk: 1, activeRadius: 12 },

  // Body and items (TECH_DESIGN §2.5, §2.9): what equipping, drinking, reading and the belt swap (R) cost
  // in seconds of game time (the parent's numbers), the off-hand chance for extra holding hands (WS4/WS5),
  // and the levels where a treasure may be a relic (the parent's floors 14–19).
  body: { equipTime: 1, drinkTime: 0.5, readTime: 1, beltSwap: 0.4, offhandChance: 0.15 },
  relics: { minLevel: 14, maxLevel: 19, chance: 0.15 },

  // The dark (TECH_DESIGN §6.3, R12, light.js inDark): with your torch out, a place is dark where natural
  // light (sky × daylight, no lamps) is below this. Underground there is none, so it's the torch alone.
  dark: { threshold: 0.3 },

  // Levels (DECISIONS: surface zone level = 3 × tier − 1; legacy tables read min(level, 20) until C3).
  level: { contentMax: 23, tierMax: 8 },   // (23: the surface's top level, tier 8; was 20, the parent's last, until C3 gave levels above it: integrator, C3 #1)

  // The clock (DECISIONS §1, bible §4.6; clock.js): one world hour is 60 s of game time in both views (a
  // world minute per second). The run starts on day 1 at 06:00. Hours of the day: dawn 05-06, day 06-18,
  // dusk 18-19, night 19-05; the noon window 11-13.
  clock: { secondsPerMinute: 1, startMinute: 6 * 60, dawn: 5, day: 6, dusk: 18, night: 19, noon: [11, 13] },

  // The torch's glim (DECISIONS §1, bible §3.2; torch.js): 1 glim per hoursPerGlim world hours lit in
  // darkness (underground, the Shade, surface night), nothing by day. With an empty purse it gutters to a
  // flicker gutterRange tiles across, at gutterPower of a torch's strength, and never goes out.
  torch: { hoursPerGlim: 4, gutterRange: 1, gutterPower: 0.35 },

  // One Wick (DECISIONS §1: RULES.classic.* became RULES.oneWick.*; save/save.js, WS9 #6 at the WS9 merge): a One Wick
  // slot loaded after a session that never saved cleanly is warned about ("warn"), or counted a death ("death": the
  // slot goes, with a grave).
  oneWick: { unclean: "warn" },
};

const store = new Map(Object.entries(CORE).map(([k, v]) => [k, deepFreeze(v)]));

export const RULES = new Proxy({}, {   // (an extensible target, or the descriptor trap would break proxy invariants)
  get: (_, k) => store.get(k),
  has: (_, k) => store.has(k),
  ownKeys: () => [...store.keys()],
  getOwnPropertyDescriptor: (_, k) => store.has(k) ? { value: store.get(k), writable: false, enumerable: true, configurable: true } : undefined,
  set: (_, k) => { throw new TypeError(`RULES is frozen (RULES.${String(k)}): add a namespace with extendRules()`); },
  defineProperty: (_, k) => { throw new TypeError(`RULES is frozen (RULES.${String(k)})`); },
  deleteProperty: (_, k) => { throw new TypeError(`RULES is frozen (RULES.${String(k)})`); },
});

// A module's own namespace: RULES[ns] = values (frozen), once.
export function extendRules(ns, values) {
  if (typeof ns !== "string" || !ns) throw new TypeError("extendRules: the namespace must be a name");
  if (store.has(ns)) throw new Error(`extendRules: RULES.${ns} already exists`);
  store.set(ns, deepFreeze(values));
  return store.get(ns);
}

// Tests and debugging only: RULES[ns] = value until undo() is called. Undo calls nest (last in, first out).
export function overrideRules(ns, value) {
  if (!store.has(ns)) throw new Error(`overrideRules: no RULES.${ns}`);
  const old = store.get(ns);
  const next = old && typeof old === "object" && value && typeof value === "object" && !Array.isArray(value)
    ? { ...old, ...value } : value;
  store.set(ns, deepFreeze(next));
  return () => store.set(ns, old);
}
