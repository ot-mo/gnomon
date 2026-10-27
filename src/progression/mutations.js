// Mutations (TECH_DESIGN §8.3 "WS4", §2.8; §1.4 "progression (WS4)"; bible §10.3, §10.4, §13.5, §15.6): the
// Bent's second track, bought with creases (DECISIONS §1), over content/mutations.js.
//
//   mutationOffers(game, p, rng) → ids    3 seeded offers of mutations you could gain (the same for the same rng
//                                         seed and the same body), at least one of them planar; defects are never
//                                         offered (they're taken at creation, the wizard lists them). Without an
//                                         rng: offerRng(game, p)
//   offerRng(game, p) → rng               seeded by the run's seed and how many you've gained (offerSeed), so the
//                                         offers stand until you buy one (no rerolling them away), and the sheet
//                                         shows the three the wizard showed last if you kept your creases
//   offerSeed(seed, gained) → seed        the one seed path of the wizard's offers and the sheet's
//   gainMutation(game, p, id)             a new mutation at level 1 for its cost (4 creases; a defect gives 2-3
//                                         back, and only at creation, game = null); the reputation changes of
//                                         bible §10.4 (with no game, beginRun applies them: mutationRep); an
//                                         ability goes on the first free hotbar key; invalidateStats(p); emits
//                                         "mutate" { e, id, level, how: "gain" }. Throws "gainMutation: <why>"
//                                         when canGain refuses it
//   raiseMutation(game, p, id)            one level more for 1 crease, up to levelCap; emits "mutate" (how
//                                         "raise"). Throws "raiseMutation: <why>" when canRaise refuses it
//   canGain(game, p, id) · canRaise(p, id) → null | why (a sentence)
//   levelCap(p, id)                       min(its max, floor(level / 2) + 1, 10)
//   mutationLevel(e, id)                  the level it works at: what you bought, and for a mental mutation EGO's
//                                         levels on top (bible §10.6), at least 1; 0 if you haven't it
//   isMental(id) · isDefect(id) · creasesSpent(ids) · mutationRep(game, p, id)
//   castOf(e) · wakeChance(e)             bible §10.3: Cast is the sum of your mental mutations' levels (EGO's
//                                         included); a turn of the world leaves a wake with max(0, Cast − 10 −
//                                         2 × EGO mod) × 2% (at most 75%)
//   turnWorld(game)                       one turn of the world (Tab): the wake roll (seeded by the run's seed and
//                                         the turn's number); the third wake within an hour in one zone warns you
//                                         and, 10 s of game time later, emits "smoothers" { zone, size, burnisher,
//                                         great } (bible §10.3's pack, for the creatures' owner to send)
//
// p.mutations = { [id]: level } (§2.4), plain JSON. p.creases: the Bent's (content/genotypes.js).
//
// Watched every frame in the views (events.js registerUpdate):
//   - turns of the world: game.view changing between the map and 3D in the same zone while you aren't flat (Tab;
//     the cube's first turn and a forced flat aren't yours). game.state.cast = { turns, wakes: { zoneKey: [time] },
//     pack: { zone, at, size, burnisher, great } | null } is saved with the state.
//   - defects that come and go: Dark-fear "shaken" while your torch is out, Moth-kissed "mobbed" while it's lit,
//     Lightsick "sunsick" (1 HP every 20 s you stand under an open sky by day, counted through map actions and skips);
//     each status lasts until its cause goes (see "Defects that come and go" below).
import { MUTATIONS, BIBLE_FACTIONS } from "../content/mutations.js";
import { GENOTYPES } from "../content/genotypes.js";
import { invalidateStats, mod, maxHp } from "../stats.js";
import { emit, registerUpdate } from "../events.js";
import { registerStatus, addStatus, removeStatus, hasStatus, statusFlag } from "../status.js";
import { addRep, FACTIONS } from "../factions.js";
import { naturalLight } from "../light.js";
import { RULES, extendRules } from "../rules.js";
import { makeRng, seedFor } from "../rng.js";

extendRules("mutations", {
  cost: 4, raiseCost: 1, levelsPerCap: 2, maxLevel: 10, offers: 3, planarOffers: 1,
  cast: { free: 10, perEgo: 2, chance: 0.02, max: 0.75, wakes: 3, fadeHours: 1, delay: 10,
          pack: { over: 12, per: 8, max: 4, burnisher: 30, great: 45 } },
  sunsick: { period: 20, light: 0.5 },
});

const HOTBAR = 9;
export const isMental = (id) => MUTATIONS[id]?.kind === "mental";
export const isDefect = (id) => MUTATIONS[id]?.kind === "defect";
const costOf = (id) => MUTATIONS[id]?.cost ?? RULES.mutations.cost;
export const creasesSpent = (ids) => ids.reduce((n, id) => n + costOf(id), 0);
const has = (p, id) => !!p.mutations?.[id];
const bent = (p) => GENOTYPES[p.genotype]?.track === "mutations";
const excluded = (p, id) => Object.keys(p.mutations || {}).some((h) => MUTATIONS[h]?.excludes?.includes(id) || MUTATIONS[id]?.excludes?.includes(h));

export function mutationLevel(e, id) {
  const lvl = e?.mutations?.[id] || 0;
  if (!lvl) return 0;
  return isMental(id) ? Math.max(1, lvl + mod(e, "ego")) : lvl;
}
export function levelCap(p, id) {
  const M = RULES.mutations;
  return Math.min(MUTATIONS[id]?.max ?? M.maxLevel, M.maxLevel, Math.floor((p.level || 1) / M.levelsPerCap) + 1);
}

// --- Offers ------------------------------------------------------------------------------------------------------
const gained = (p) => Object.keys(p.mutations || {}).filter((id) => !isDefect(id)).length;
export const offerSeed = (seed, n) => seedFor(seed ?? 0, "mutations", n);
export const offerRng = (game, p) => makeRng(offerSeed(game?.seed, gained(p)));

export function mutationOffers(game, p, rng = offerRng(game, p)) {
  const M = RULES.mutations;
  const open = Object.keys(MUTATIONS).filter((id) => !isDefect(id) && !has(p, id) && !excluded(p, id));
  const planar = rng.shuffle(open.filter((id) => MUTATIONS[id].planar));
  const out = planar.slice(0, M.planarOffers);
  for (const id of rng.shuffle(open.filter((id) => !out.includes(id)))) if (out.length < M.offers) out.push(id);
  return rng.shuffle(out);
}

// --- Gaining and raising -----------------------------------------------------------------------------------------
export function canGain(game, p, id) {
  const def = MUTATIONS[id];
  if (!def) return `there's no mutation ${id}`;
  if (!bent(p)) return `${GENOTYPES[p.genotype]?.plural ?? "you"} take no mutations`.replace(/^./, (c) => c.toUpperCase());
  if (has(p, id)) return `you have ${def.name} already`;
  if (excluded(p, id)) return `${def.name} can't share a body with ${Object.keys(p.mutations).filter((h) => MUTATIONS[h]?.excludes?.includes(id) || def.excludes?.includes(h)).map((h) => MUTATIONS[h].name).join(", ")}`;
  if (def.kind === "defect" && game) return "defects come with you from the start: none can be taken later";
  if (costOf(id) > (p.creases || 0)) return `${def.name} needs ${costOf(id)} creases; you have ${p.creases || 0}`;
  return null;
}
export function canRaise(p, id) {
  const def = MUTATIONS[id];
  if (!def || !has(p, id)) return `you haven't ${def?.name ?? id}`;
  if (def.kind === "defect") return "a defect has no levels";
  const cap = levelCap(p, id);
  if (p.mutations[id] >= cap)
    return p.mutations[id] >= Math.min(def.max ?? RULES.mutations.maxLevel, RULES.mutations.maxLevel) ? `${def.name} is as strong as it gets`
      : `${def.name} can't pass level ${cap} until you're level ${2 * cap}`;
  if ((p.creases || 0) < RULES.mutations.raiseCost) return `a level costs ${RULES.mutations.raiseCost} crease; you have none`;
  return null;
}

// A change that alters max HP (Spare Heart's TOU) brings the HP it adds with it, as a TOU point on the card does.
function reshape(p, change) {
  const before = maxHp(p);
  change();
  invalidateStats(p);
  p.hp += Math.max(0, maxHp(p) - before);
}

export function gainMutation(game, p, id) {
  const why = canGain(game, p, id);
  if (why) throw new Error(`gainMutation: ${why}`);
  const def = MUTATIONS[id];
  reshape(p, () => { p.creases = (p.creases || 0) - costOf(id); (p.mutations ||= {})[id] = 1; });
  if (def.ability && !(p.hotbar ||= []).includes(def.ability)) {
    const k = [...Array(HOTBAR).keys()].find((i) => !p.hotbar[i]);
    if (k !== undefined) p.hotbar[k] = def.ability;
  }
  if (game) {
    mutationRep(game, p, id);
    game.log(def.kind === "defect" ? `You carry a defect: ${def.name}.` : `You gain a mutation: ${def.name}. ${def.info(1)}`, [200, 150, 255]);
    emit(game, "mutate", { e: p, id, level: 1, how: "gain" });
  }
  return p.mutations[id];
}

export function raiseMutation(game, p, id) {
  const why = canRaise(p, id);
  if (why) throw new Error(`raiseMutation: ${why}`);
  reshape(p, () => { p.creases -= RULES.mutations.raiseCost; p.mutations[id]++; });
  const lvl = p.mutations[id];
  if (game) {
    game.log(`${MUTATIONS[id].name} grows to level ${lvl}. ${MUTATIONS[id].info(mutationLevel(p, id))}`, [200, 150, 255]);
    emit(game, "mutate", { e: p, id, level: lvl, how: "raise" });
  }
  return lvl;
}

// Bible §10.4: what a body like yours does to how they see you (once, when it's gained; Crooked Manner with
// everyone: every faction the bible names and any registered).
export function mutationRep(game, p, id) {
  const def = MUTATIONS[id];
  for (const [faction, n] of Object.entries(def?.rep || {})) addRep(game, faction, n, "mutation");
  if (def?.repAll) for (const faction of new Set([...BIBLE_FACTIONS, ...Object.keys(FACTIONS)])) addRep(game, faction, def.repAll, "mutation");
}

// --- Cast and the Smoothers (bible §10.3) -------------------------------------------------------------------------
export const castOf = (e) => Object.keys(e?.mutations || {}).filter(isMental).reduce((n, id) => n + mutationLevel(e, id), 0);
export function wakeChance(e) {
  const C = RULES.mutations.cast;
  return Math.min(C.max, Math.max(0, castOf(e) - C.free - C.perEgo * mod(e, "ego")) * C.chance);
}
export function packFor(cast) {
  const P = RULES.mutations.cast.pack;
  return { size: Math.max(1, Math.min(P.max, 1 + Math.floor((cast - P.over) / P.per))), burnisher: cast >= P.burnisher, great: cast >= P.great };
}
const castState = (game) => (game.state.cast ||= { turns: 0, wakes: {}, pack: null });

export function turnWorld(game) {
  const p = game.player, chance = wakeChance(p);
  if (!(chance > 0) || !game.state) return false;
  const C = RULES.mutations.cast, st = castState(game), key = game.zone.key;
  const rng = makeRng(seedFor(game.seed ?? 0, "cast", st.turns++));
  if (!(rng() < chance)) return false;
  const fade = C.fadeHours * 60 * RULES.clock.secondsPerMinute;   // one world hour: 60 s of game time (DECISIONS §1)
  const wakes = (st.wakes[key] || []).filter((t) => game.time - t < fade);
  wakes.push(game.time);
  st.wakes[key] = wakes;
  game.log("The Plane creases behind your turn.", [200, 200, 215]);
  if (wakes.length >= C.wakes && !st.pack) {
    st.wakes[key] = [];
    st.pack = { zone: key, at: game.time + C.delay, ...packFor(castOf(p)) };
    game.log("The floor smooths itself out towards you.", [235, 235, 245]);
  }
  return true;
}

function sendPack(game) {
  const st = game.state?.cast, pack = st?.pack;
  if (!pack || game.time < pack.at) return;
  st.pack = null;
  if (pack.zone === game.zone.key) emit(game, "smoothers", { zone: game.zone, size: pack.size, burnisher: pack.burnisher, great: pack.great });
}

// A turn of the world is the view changing in the same zone while you aren't flat: Tab (or Esc on the map). The
// cube's first turn (before game.story.cube) and being pressed flat onto the map aren't turns of yours.
const lastView = new WeakMap();   // game → { view, zone, cube }
registerUpdate("mutations:turns", (game) => {
  const was = lastView.get(game), now = { view: game.view, zone: game.zone, cube: !!game.story?.cube };
  lastView.set(game, now);
  if (was && was.view !== now.view && was.zone === now.zone && was.cube && !statusFlag(game.player, "flat")) turnWorld(game);
  sendPack(game);
}, { modes: ["play"] });

// --- Defects that come and go ------------------------------------------------------------------------------------
// Their statuses last (LASTING: finite, so a save holds them; JSON has no Infinity) and the watch below puts them on
// and takes them off as their cause comes and goes, so they hold through a long map action or a skip as through
// frames. Dark-fear and Moth-kissed follow the torch (it can't change during a skip). Lightsick's stays on as long as
// you have it and counts only while you stand in the sun: its tick runs in game time in both views, and skipTime steps
// a status with a tick in short chunks with the clock moving (time.js), so a skip from day into dusk counts the day
// part; the 20 s count carries over a stretch in the shade (stepping out of the sun doesn't start it again).
const LASTING = 1e9;
export const lasting = (s) => s.t >= LASTING / 2;
registerStatus("shaken", { color: [150, 130, 170], t: LASTING, bonus: () => ({ toHit: -2, dv: -1 }), hud: () => "SHAKEN" });
registerStatus("mobbed", { color: [250, 240, 170], t: LASTING, bonus: () => ({ stealth: -0.3 }), hud: () => "MOTHS" });
const sunlit = (game, p) => !!game.zone?.hasSky && naturalLight(game, game.zone, p.x, p.y, p.z + 1.45) >= RULES.mutations.sunsick.light;
registerStatus("sunsick", { color: [255, 210, 120], t: LASTING, cause: "sunlight",
  hud: (s, game) => (game?.player && sunlit(game, game.player) ? "SUNSICK" : null),
  tick(game, e, s, dt) {
    if (!game || e !== game.player || !sunlit(game, e)) return;
    const P = RULES.mutations.sunsick.period;
    s.acc += dt;
    while (s.acc >= P - 1e-9 && e.hp > 0 && game.mode !== "dead") { s.acc -= P; game.hurtPlayer(1, "sunlight", true); }
  } });
const DEFECT_WHEN = {
  shaken: (game, p) => !p.torch,
  mobbed: (game, p) => !!p.torch,
  sunsick: () => true,
};
export function watchDefects(game, p = game.player) {
  if (!p?.mutations) return;
  for (const id in p.mutations) {
    const status = MUTATIONS[id]?.status;
    if (!status) continue;
    if (DEFECT_WHEN[status](game, p)) { if (!hasStatus(p, status)) addStatus(game, p, status); }
    else if (hasStatus(p, status)) removeStatus(game, p, status);
  }
}
registerUpdate("mutations:defects", (game) => watchDefects(game), { modes: ["play"] });
