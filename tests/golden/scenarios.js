// The golden scenarios: what tools/golden-record.mjs recorded at the parent commit 75edbd3, and
// what tools/check-golden.mjs replays against today's code to prove a refactor changed nothing.
//
// Every scenario takes an `api`: an adapter over one version of the game (legacy-api.js for the
// parent's modules, current-api.js for today's). The scenario code itself is shared, so both
// sides do exactly the same things in the same order; only the adapters know the APIs.
//
//   (a) mechanics  seed 1234, level 3: drink every potion, read every scroll, wield, swap, wear
//                  every ring, amulet and relic (cursed ones too), pick up crystals, take perks.
//                  After each step: the player's derived numbers (STR, max HP, armour, reach and
//                  every bonus() key), gear, pack, perks and what's identified. Nothing that
//                  depends on time passing, so a bot can replay it in either view.
//   (b) frames     render3d and renderMap cell buffers at 180×56 from 3 cameras on levels 3, 8
//                  and 15 (seed 1234), torch on and off.
//   (c) dungeons   the blocks (and items, creatures, people, layout facts) of the legacy stack:
//                  5 seeds × depths 1-20. Depth 1 differs on purpose since 0A1 (the sky well
//                  is gone, and level 1 has stairs up to the surface); the gate compares 2-20.
//   vaults         every legacy vault stamped with default options into an empty level.
//   temple         the Temple of Angles (buildTemple) for two seeds.
//
// Math.random is re-seeded before every step (api.seedRandom), so a refactor that stops using
// Math.random somewhere (generation now draws creature looks from its own stream) doesn't shift
// what later steps roll.
import { hashBytes, hashJSON } from "../lib/hash.js";

export const FORMAT = 1;

// The stat bus vocabulary at 75edbd3 (items.js:126-134 plus the seven undocumented keys,
// TECH_DESIGN Appendix A).
export const BONUS_KEYS = ["crit", "swing", "reach", "maxDmg", "leech", "crush", "thorns", "ward", "regen", "darkRegen",
  "str", "maxHp", "armour", "speed", "torch", "sense", "darkSight", "stealth", "firstBlock", "jump", "featherFall",
  "killHeal", "undeadHeal", "burnBonus", "poisonHit", "sunder", "cutsFlat", "foldGuard"];

export const MECHANICS = { seed: 1234, depth: 3 };
export const FRAMES = { seed: 1234, depths: [3, 8, 15] };
export const DUNGEONS = { seeds: [1, 7, 42, 1234, 31337], depths: Array.from({ length: 20 }, (_, k) => k + 1) };
export const VAULT_SEEDS = [1, 2, 3];
export const TEMPLE_SEEDS = [1, 1234];

const RING_IDS = ["regeneration", "strength", "protection", "accuracy", "haste", "thorns", "vampirism"];
const AMULET_IDS = ["life", "sight", "dark", "warding", "climber", "feather"];
const RELIC_KEYS = ["oath", "ember", "patience", "thornfang", "sunder", "edge", "mantle", "eye", "lantern", "deep"];
const PERK_ORDER = ["tough", "tough", "mighty", "ironSkin", "keenEye", "fleet", "brightTorch", "regen", "quick", "leaper",
  "stealthy", "nightEyes", "featherFall", "swimmer"];

// The fields of an item that matter (never its position, never a `dropped` flag).
const ITEM_FIELDS = ["kind", "id", "effect", "ench", "known", "element", "props", "relic", "count", "amount", "auraKnown", "name"];
export function itemFacts(it) {
  if (!it) return null;
  const out = {};
  for (const k of ITEM_FIELDS) if (it[k] !== undefined) out[k] = Array.isArray(it[k]) ? [...it[k]] : it[k];
  return out;
}

// --- (a) Mechanics ------------------------------------------------------------------------------
export function recordMechanics(api) {
  api.seedRandom(1);
  api.newRun(MECHANICS.seed);
  api.seedRandom(2);
  const level = api.generateLevel(MECHANICS.seed, MECHANICS.depth);
  api.seedRandom(3);
  api.enterLevel(level, MECHANICS.depth, "down");
  api.prepare();
  api.clearCreatures();   // nothing may interfere: the trace is about the player

  const steps = [];
  const snap = (name) => {
    const f = api.playerFacts(BONUS_KEYS);
    steps.push({
      step: name,
      derived: f.derived,
      gear: Object.fromEntries(Object.entries(f.gear).map(([k, it]) => [k, itemFacts(it)])),
      inv: f.inv.map(itemFacts),
      keys: f.keys, gold: f.gold, torch: f.torch,
      perks: f.perks.slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      known: { potions: [...f.known.potions].sort(), scrolls: [...f.known.scrolls].sort(), auras: [...f.known.auras].sort() },
    });
  };
  const run = (name, fn) => { api.seedRandom(1000 + steps.length); fn(); snap(name); };
  const use = (item) => () => api.useInv(api.give(item));
  const swap = () => api.invKey("KeyR");
  const potion = (effect) => ({ kind: "potion", effect });
  const scroll = (effect) => ({ kind: "scroll", effect });
  const pickUp = (item) => () => { api.dropAtFeet(item); api.pickUp(); };

  snap("start");
  for (const e of ["healing", "strength", "flying", "haste", "seeing", "shadows", "poison", "paralysis", "darkness"])
    run(`drink ${e}`, use(potion(e)));
  run("wield a mace +1 (too weak: refused)", use({ kind: "weapon", id: "mace", ench: 1, known: false }));
  run("wield a dagger +1", use({ kind: "weapon", id: "dagger", ench: 1, known: false }));
  run("swap weapons (R)", swap);
  run("swap back (R)", swap);
  for (const e of ["fire", "frost", "shock", "holy", "blessing", "teleport", "summon"]) run(`read ${e}`, use(scroll(e)));
  run("clear creatures", () => api.clearCreatures());
  run("read uncurse (nothing cursed)", use(scroll("uncurse")));
  run("read malice", use(scroll("malice")));
  run("swap with a cursed weapon (refused)", swap);
  run("wield a dagger over a cursed weapon (refused)", use({ kind: "weapon", id: "dagger", ench: 0, known: false }));
  run("read uncurse", use(scroll("uncurse")));
  run("swap weapons (R)", swap);
  run("wear cursed leather -2", use({ kind: "armour", id: "leather", ench: -2, known: false }));
  run("wear leather +1 over a cursed one (refused)", use({ kind: "armour", id: "leather", ench: 1, known: false }));
  run("read uncurse", use(scroll("uncurse")));
  run("wear leather +1", use({ kind: "armour", id: "leather", ench: 1, known: false }));
  for (const id of RING_IDS) run(`ring of ${id} +1`, use({ kind: "ring", id, ench: 1, known: false }));
  run("cursed ring of strength -1", use({ kind: "ring", id: "strength", ench: -1, known: false }));
  run("ring of protection +2 over a cursed ring (refused)", use({ kind: "ring", id: "protection", ench: 2, known: false }));
  run("read uncurse", use(scroll("uncurse")));
  run("ring of protection +2", use({ kind: "ring", id: "protection", ench: 2, known: false }));
  for (const id of AMULET_IDS) run(`amulet of ${id}`, use({ kind: "amulet", id, ench: 1, known: false }));
  run("cursed amulet of life -1", use({ kind: "amulet", id: "life", ench: -1, known: false }));
  run("amulet of sight +1 over a cursed amulet (refused)", use({ kind: "amulet", id: "sight", ench: 1, known: false }));
  run("read uncurse", use(scroll("uncurse")));
  run("amulet of life +2", use({ kind: "amulet", id: "life", ench: 2, known: false }));
  for (const kind of ["heart", "strength", "heart", "key"]) run(`pick up a ${kind}`, pickUp({ kind }));
  run("pick up gold", pickUp({ kind: "gold", amount: 12 }));
  for (const key of PERK_ORDER) run(`perk ${key}`, () => api.takePerk(key));
  run("drink strength", use(potion("strength")));
  run("wield a mace +1", use({ kind: "weapon", id: "mace", ench: 1, known: false }));
  for (const key of RELIC_KEYS) run(`relic ${key}`, use(api.relic(key)));
  run("drink healing", use(potion("healing")));
  run("drink descent", use(potion("descent")));   // last: it takes you a level down
  return { seed: MECHANICS.seed, depth: MECHANICS.depth, bonusKeys: BONUS_KEYS, steps };
}

// --- (b) Frames ---------------------------------------------------------------------------------
export function recordFrames(api) {
  const frames = {};
  for (const depth of FRAMES.depths) {
    api.seedRandom(50 + depth);
    api.newRun(FRAMES.seed);
    api.seedRandom(60 + depth);
    const level = api.generateLevel(FRAMES.seed, depth);
    api.seedRandom(70 + depth);
    api.enterLevel(level, depth, "down");
    api.prepare();
    api.prepareFrames(level);
    const p = api.player();
    const start = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
    const e = level.vault.entrance;
    const vx = e.x + e.dx, vy = e.y + e.dy, vs = level.stand[vx + vy * level.w];
    const cameras = [
      ["arrival", start.x, start.y, start.z, start.yaw, 0],
      ["behind", start.x, start.y, start.z, start.yaw + Math.PI, -0.35],
      ["vault", vx + 0.5, vy + 0.5, vs >= 0 ? vs : api.FLOOR_Z, Math.atan2(-e.dy, -e.dx), -0.1],
    ];
    for (const [name, x, y, z, yaw, pitch] of cameras) {
      api.placeCamera(x, y, z, yaw, pitch);
      frames[`${depth}/${name}/3d-torch`] = api.frame3d(true);
      frames[`${depth}/${name}/3d-dark`] = api.frame3d(false);
      frames[`${depth}/${name}/map`] = api.frameMap(true);
    }
  }
  return { seed: FRAMES.seed, cols: api.cols, rows: api.rows, frames };
}

// --- (c) Dungeon levels -------------------------------------------------------------------------
// Everything about a generated level that the layout RNG decides. Creature and NPC ids come from
// module counters, so they're left out (a bounty's target is recorded by its index instead).
export function levelFacts(api, f) {
  const creatures = api.creatures(f), npcs = api.npcs(f);
  const indexOf = (id) => creatures.findIndex((m) => m.id === id);
  return {
    blocks: hashBytes(f.blocks),
    items: hashJSON(f.items.map((it) => ({ ...itemFacts(it), x: it.x, y: it.y, z: it.z }))),
    creatures: hashJSON(creatures.map((m) => ({ type: m.type, tx: m.tx, ty: m.ty, z: m.z, elite: m.elite, guardian: m.guardian }))),
    creatureStats: hashJSON(creatures.map((m) => ({ hp: m.hp, maxHp: m.maxHp, xp: m.xp, bonus: m.bonus, state: m.state, bounty: !!m.bounty }))),
    npcs: hashJSON(npcs.map((n) => ({ type: n.type, tx: n.tx, ty: n.ty, z: n.z, depth: n.depth, met: n.met,
      state: n.state?.target !== undefined ? { ...n.state, target: indexOf(n.state.target) } : n.state }))),
    layout: hashJSON({
      spawn: f.spawn, stairs: f.stairs, upStairs: f.upStairs, vault: f.vault, secret: f.secret, secretWalls: f.secretWalls,
      links: f.links, groups: f.groups, spikes: f.spikes, braziers: f.braziers, guardianHall: f.guardianHall,
      leverRecord: f.leverRecord, leverRecordAt: f.leverRecordAt, hasSky: !!f.hasSky,
      rooms: f.rooms.map((r) => ({ ...r, theme: [r.theme.wall, r.theme.floor] })),
    }),
    attempts: f.attempts,
    counts: { creatures: creatures.length, items: f.items.length, npcs: npcs.length },
  };
}

export function recordDungeons(api) {
  const levels = {};
  for (const seed of DUNGEONS.seeds)
    for (const depth of DUNGEONS.depths) {
      api.seedRandom(seed * 100 + depth);
      levels[`${seed}/${depth}`] = levelFacts(api, api.generateLevel(seed, depth));
    }
  return { seeds: DUNGEONS.seeds, depths: DUNGEONS.depths, levels };
}

// --- Vaults and the temple ----------------------------------------------------------------------
function stampFacts(api, f, entrance) {
  return {
    blocks: hashBytes(f.blocks),
    entrance,
    items: f.items.map((it) => ({ ...itemFacts(it), x: it.x, y: it.y, z: it.z })),
    creatures: api.creatures(f).map((m) => ({ type: m.type, tx: m.tx, ty: m.ty, z: m.z, state: m.state })),
    npcs: api.npcs(f).map((n) => ({ type: n.type, tx: n.tx, ty: n.ty, z: n.z, state: hashJSON(n.state) })),
    layout: hashJSON({ links: f.links, groups: f.groups, spikes: f.spikes, braziers: f.braziers, guardianHall: f.guardianHall,
      leverRecord: f.leverRecord, stairs: f.stairs }),
  };
}

export function recordVaults(api) {
  const vaults = {};
  for (const v of api.vaultCatalog())
    for (const seed of v.kind === "vault" ? VAULT_SEEDS : [1]) {
      api.seedRandom(seed);
      const rng = api.makeRng(seed);
      const built = v.build(rng);
      const f = api.emptyLevel(7);
      const entrance = api.stampVault(f, built, 3, 3, rng);
      vaults[`${v.name}#${seed}`] = stampFacts(api, f, entrance);
    }
  return { vaults };
}

export function recordTemple(api) {
  const temples = {};
  for (const seed of TEMPLE_SEEDS) {
    api.seedRandom(seed);
    const f = api.buildTemple(seed);
    temples[seed] = { ...stampFacts(api, f, null), spawn: f.spawn, returnPoint: f.returnPoint, cubeWall: f.cubeWall, hasSky: !!f.hasSky };
  }
  return { temples };
}
