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
  // Which formula sets run. Phase 0 keeps the parent game's numbers ("legacy") so the golden traces
  // prove the refactor changed nothing; the integrator flips both once WS4 and WS8 are in (§8.5).
  stats: "legacy",      // "legacy" | "attributes"
  combat: "legacy",     // "legacy" | "d20" (0C)

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
              // a rest of an hour clears the first two.
              secondWind: 300, firstBlock: 120, foldingStrike: 10, restClears: 3600 },
  price: { buy: 1.5, buyPerMod: 0.1, sell: 0.3, sellPerMod: 0.05, minBuy: 0.2 },   // value × (1.5 − 0.1·EGO mod − step) …
  carry: { perStr: 15 },
  encumbrance: false,
  regen: { base: 60 },                                 // attribute set: 1 HP per base / (1 + 0.1 (TOU mod + WIL mod)) s
  haste: 1.6,                                          // speed (and action time) while hasted
  drown: { air: 10, dps: 1, speed: 0.4 },              // TECH_DESIGN §2.7: breath in s, then damage per s; speed ×0.4
  // skipTime (time.js): the player catches up in chunks this long (statuses, regen and cooldowns are exact
  // within a chunk; the chunk only bounds how their interplay at full HP rounds); hostiles awake within
  // activeRadius tiles interrupt.
  time: { chunk: 1, activeRadius: 12 },

  // Levels (DECISIONS: surface zone level = 3 × tier − 1; legacy tables read min(level, 20) until C3).
  level: { contentMax: 20, tierMax: 8 },
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
