// Secrets (TECH_DESIGN §2.14; bible §3.4 readings, §8.5 three accounts; §1.4 "story (WS7)"; owner WS7).
//
//   learnSecret(game, id, source, { quiet })   into game.state.journal.secrets[id] = { learned, source, sold }; emits
//                                     "secret" { kind, id, at, source }; a location secret is pinned on the world map
//                                     (WS1's pin, once built) and starts a "visit" quest; a history account counts
//                                     towards its event's triangulation. → the new entry, or null (unknown, or known
//                                     already). Sources: "talk", "ritual", "note", "inscription", "mural"…
//   makeSecrets(run) → Map<id, SecretDef>     every learnable secret of a run, made from its sites and history
//                                     (world/run.js's "secrets" step should call it: integration request); ids are
//                                     stable per seed. SecretDef (JSON) = { id, kind: "location" | "history" |
//                                     "gossip" (later "village", "recipe"), reading: "flat" | "deep" | "dark" | null,
//                                     tags, value (glim), at?: { wx, wy }, ref, text? }
//                                       loc:<landmark id> · loc:<site id>      a site's place (reading flat)
//                                       hist:<event id>:<flat | deep | dark>   one account of an Hour's event
//                                       hist:noon:<n>:<flat | deep | dark>     one of Noon's (bible §8.6)
//                                       gossip:<n>                             a rumour from history (gossip.js)
//   secretsOf(run) → Map                run.secrets when the run step filled it, else made here once per run
//   secretDef(run, id) · secretText(run, idOrDef) · secretTitle(run, idOrDef) → string
//   muralSecret(run, text) → id | null  the history account a mural's text is (murals.js)
//   readings(game) → [{ id, kind, reading, text, sold }]   what you know, for WS6b's Kindling; markSold(game, id)
//   TRIANGULATION = { xp(level) → amount }   0.15 of a level's XP at the event's tier (bible §8.5); a seam WS4's
//                                     xpReward("triangulation", level) replaces (integration request)
//
// Triangulation (bible §8.5): all three accounts of one event known → it is triangulated: XP, and a hidden fact comes
// out of the disagreement (the event's site's place, the floor a lost relic waits on, or the Hour's true age), filed
// in Notes. Five triangulated events of one Hour give its cult pass (journal.cultPass; "cultPass" { rulerId }).
import { emit } from "../events.js";
import { makeRng, seedFor } from "../rng.js";
import { GRAMMAR } from "../content/grammar.js";
import { expand, numberWords, cap } from "./grammar.js";
import { journalOf, addNote } from "./journal.js";
import { registerQuest, startQuest, questOf, advanceQuest } from "./quests.js";
import { parseKey } from "../zones.js";
import { gainXp, xpToNext } from "../leveling.js";
import * as discovery from "../overworld/discovery.js";

export const ACCOUNT = { flat: "gospel", deep: "inscription", dark: "hostile" };
export const READINGS = ["flat", "deep", "dark"];
export const TRIANGULATION = { xp: (level) => Math.round(0.15 * xpToNext(level)) };

const PRONOUN_FORMS = { she: { they: "she", them: "her" }, he: { they: "he", them: "him" } };
const forms = (r) => PRONOUN_FORMS[r?.pronoun] || { they: "they", them: "them" };
const levelOfTier = (tier) => 3 * tier - 1;

// --- The run's secrets --------------------------------------------------------------------------------------------
export function makeSecrets(run) {
  const out = new Map(), add = (d) => out.set(d.id, d);
  const sites = [...(run.sites?.values() || [])];
  for (const s of sites) {
    const id = s.kind === "landmark" ? `loc:${s.id.replace(/^landmark:/, "")}` : `loc:${s.id}`;
    add({ id, kind: "location", reading: "flat", tags: [s.kind, `tier:${s.tier}`], value: 10 + 5 * (s.tier || 1),
          at: { wx: s.at.wx, wy: s.at.wy }, ref: { siteId: s.id },
          text: `${s.name}, ${GRAMMAR.titles.sites[s.kind] || "a place"}, at span (${s.at.wx}, ${s.at.wy}).` });
  }
  const h = run.history;
  for (const R of h?.rulers || [])
    for (const e of R.events)
      for (const reading of READINGS)
        add({ id: `hist:${e.id}:${reading}`, kind: "history", reading, tags: [R.id, e.type, ...(R.domains || [])],
              value: 15 + 3 * eventTier(h, R, e), ref: { rulerId: R.id, eventId: e.id } });
  GRAMMAR.noon.forEach((n, k) => {
    for (const reading of READINGS)
      add({ id: `hist:noon:${k + 1}:${reading}`, kind: "history", reading, tags: ["noon"], value: 30, ref: { noon: k + 1 } });
  });
  for (const g of rumours(run)) add(g);
  return out;
}

// Rumours from history (bible §2.2 "Village rumour"): what a site holds, where a relic waits, an Hour's age, a grudge.
function rumours(run) {
  const h = run.history, rng = makeRng(seedFor(run.seed, "run", "secrets")), out = [];
  if (!h) return out;
  const faction = (id) => GRAMMAR.factions[id]?.name || id;
  const say = (rule, R, extra, about = null) => {
    const ctx = { ...forms(R), name: R.name, cog: R.epithet, teller: rng.pick(GRAMMAR.rules.teller), ...extra };
    out.push({ id: `gossip:${out.length + 1}`, kind: "gossip", reading: null, tags: [R.id, ...(R.favoured || []), ...(R.hated || [])], value: 5, ref: { rulerId: R.id, about },
               text: cap(expand(GRAMMAR.rules, rule, rng, ctx)) });
  };
  for (const q of h.siteRequests) {
    const R = h.rulers.find((r) => r.id === q.rulerId);
    if (!R) continue;
    const relic = h.relics.find((r) => r.id === q.relicId);
    const about = run.sites?.has(q.id) ? `loc:${q.id}` : null;
    if (relic?.lostAt) say("rumour/relicLost", R, { relic: relic.name, site: q.name }, about);
    else if (relic) say("rumour/relicDeep", R, { relic: relic.name, site: q.name }, about);
    else say("rumour/site", R, { site: q.name, floors: numberWords(q.floors) }, about);
  }
  for (const R of h.rulers) {
    if (Number.isInteger(R.born?.year)) say("rumour/age", R, { ageWords: numberWords(R.died - R.born.year) });
    const grudge = R.events.find((e) => (e.type === "rampage" || e.type === "field") && R.hated?.length);
    if (grudge) say("rumour/hated", R, { hated: faction(R.hated[0]), cause: grudge.cause });
  }
  return out;
}

// The tier an event's readings belong to: its own site's, else its Hour's first site's, else its period's lowest.
function eventTier(h, R, e) {
  const reqs = h.siteRequests.filter((q) => q.rulerId === R.id);
  const own = reqs.find((q) => q.eventId === e.id) || reqs[0];
  return own?.tier || GRAMMAR.periods[(R.period || 5) - 1].tiers[0];
}

const CACHE = new WeakMap();
export function secretsOf(run) {
  if (!run) return new Map();
  if (run.secrets?.size) return run.secrets;
  if (!CACHE.has(run)) CACHE.set(run, makeSecrets(run));
  return CACHE.get(run);
}
export const secretDef = (run, id) => secretsOf(run).get(id) || null;
const defOf = (run, idOrDef) => (typeof idOrDef === "string" ? secretDef(run, idOrDef) : idOrDef);

function historyOf(run, def) {
  const R = run.history?.rulers.find((r) => r.id === def.ref.rulerId);
  return { R, e: R?.events.find((x) => x.id === def.ref.eventId) };
}

export function secretText(run, idOrDef) {
  const def = defOf(run, idOrDef);
  if (!def) return "";
  if (def.kind === "history") {
    if (def.ref.noon) return GRAMMAR.noon[def.ref.noon - 1][def.reading];
    return historyOf(run, def).e?.text[ACCOUNT[def.reading]] || "";
  }
  return def.text || "";
}

export function secretTitle(run, idOrDef) {
  const def = defOf(run, idOrDef);
  if (!def) return "";
  if (def.kind === "location") return run.sites?.get(def.ref.siteId)?.name || def.id;
  if (def.kind === "history") {
    const acct = GRAMMAR.titles.readings[def.reading];
    if (def.ref.noon) return `Noon: ${GRAMMAR.noon[def.ref.noon - 1].event.toLowerCase()} (${acct})`;
    const { R, e } = historyOf(run, def);
    return `${R?.name}: ${GRAMMAR.titles.events[e?.type] || e?.type} (${acct})`;
  }
  return def.kind === "gossip" ? "a rumour" : def.id;
}

// A mural's text → the account it is, by the history's own texts (WS10 lays murals as { x, y, z, view, text }).
const MURALS = new WeakMap();
export function muralSecret(run, text) {
  if (!run?.history) return null;
  if (!MURALS.has(run)) {
    const idx = new Map();
    for (const R of run.history.rulers)
      for (const e of R.events) for (const r of READINGS) if (!idx.has(e.text[ACCOUNT[r]])) idx.set(e.text[ACCOUNT[r]], `hist:${e.id}:${r}`);
    GRAMMAR.noon.forEach((n, k) => { for (const r of READINGS) idx.set(n[r], `hist:noon:${k + 1}:${r}`); });
    MURALS.set(run, idx);
  }
  return MURALS.get(run).get(text) || null;
}

// --- Learning -------------------------------------------------------------------------------------------------------
export function learnSecret(game, id, source = "talk", { quiet = false } = {}) {
  const def = secretDef(game.run, id);
  if (!def) return null;
  const J = journalOf(game);
  if (J.secrets[id]) return null;
  const entry = (J.secrets[id] = { learned: game.time || 0, source, sold: false });
  emit(game, "secret", { kind: def.kind, id, at: def.at || null, source });
  if (def.kind === "location") {
    if (!discovery.STUB) discovery.pin(game, def.at.wx, def.at.wy, { label: secretTitle(game.run, def), secretId: id });
    if (!quiet) game.log?.(`You learn where ${secretTitle(game.run, def)} lies: span (${def.at.wx}, ${def.at.wy}). (J: journal)`, [150, 220, 255]);
    startVisit(game, def, quiet);
  } else if (def.kind === "history") {
    if (!J.order.history.includes(id)) J.order.history.push(id);
    if (!quiet) game.log?.(`A reading for your journal: ${secretTitle(game.run, def)}. (J: journal)`, [150, 220, 255]);
    triangulate(game, def);
  }
  return entry;
}

function triangulate(game, def) {
  const J = journalOf(game), key = def.ref.noon ? `noon:${def.ref.noon}` : def.ref.eventId;
  const base = def.id.slice(0, def.id.lastIndexOf(":"));
  if (J.triangulated[key] !== undefined || !READINGS.every((r) => J.secrets[`${base}:${r}`])) return;   // (times may be 0)
  J.triangulated[key] = game.time || 0;
  const run = game.run, h = run.history;
  let tier = 1, fact = null;
  if (!def.ref.noon) {
    const { R, e } = historyOf(run, def);
    tier = eventTier(h, R, e);
    const title = `${R.name}'s ${GRAMMAR.titles.events[e.type] || e.type}`;
    const rng = makeRng(seedFor(run.seed, "fact", e.id));
    const lost = h.relics.find((r) => r.lostAt?.eventId === e.id);
    const relicSite = lost && h.siteRequests.find((q) => q.relicId === lost.id);
    const site = e.siteRequest && run.sites?.get(e.siteRequest);
    if (relicSite) fact = expand(GRAMMAR.rules, "fact/relic", rng, { title, relic: lost.name, site: relicSite.name });
    else if (lost) fact = expand(GRAMMAR.rules, "fact/lost", rng, { title, relic: lost.name });
    else if (site) {
      fact = expand(GRAMMAR.rules, "fact/site", rng, { title, site: site.name, at: `(${site.at.wx}, ${site.at.wy})` });
      learnSecret(game, `loc:${site.id}`, "triangulation", { quiet: true });
    } else {
      const age = R.died - (R.born?.year ?? R.events[0].year);
      fact = expand(GRAMMAR.rules, "fact/age", rng, { title, name: R.name, ageWords: numberWords(Math.max(0, age)) });
    }
    if (relicSite && run.sites?.get(relicSite.id)) learnSecret(game, `loc:${relicSite.id}`, "triangulation", { quiet: true });
    addNote(game, fact, e.id);
    const done = R.events.filter((x) => J.triangulated[x.id] !== undefined).length;
    if (done >= 5 && J.cultPass[R.id] === undefined) {
      J.cultPass[R.id] = game.time || 0;
      addNote(game, `${cap(R.cult?.name || `${R.name}'s cult`)} will take you for a pilgrim in ${R.name}'s sites.`, R.id);
      emit(game, "cultPass", { rulerId: R.id });
    }
  }
  const xp = TRIANGULATION.xp(levelOfTier(tier));
  game.log?.(`Triangulated: all three accounts agree on what they disagree about. (+${xp} XP)`, [255, 230, 120]);
  if (fact) game.log?.(fact, [200, 220, 255]);
  emit(game, "triangulate", { key, xp });
  if (game.player) gainXp(game, xp, { source: "triangulation" });
}

// --- Visit quests (bible §8.7 "Hour quests": a quest pointed at the map; finding the place first completes it) ------
const atSpan = (q, wx, wy) => q.target?.wx === wx && q.target?.wy === wy;
registerQuest("visit", {
  stages: { open: { on: {
    "zone:enter": (game, q, ev) => { const k = ev.zone?.key ? parseKey(ev.zone.key) : null; return k && atSpan(q, k.wx, k.wy) ? "done" : null; },
    "world:step": (game, q, ev) => (ev.to && atSpan(q, ev.to.wx, ev.to.wy) ? "done" : null),
  } } },
});

function visited(game, wx, wy) {
  const pre = `${wx},${wy},`;
  if (game.zone?.key?.startsWith(pre)) return true;
  for (const k of game.zones?.keys?.() || []) if (k.startsWith(pre)) return true;
  return Object.keys(game.state?.zoneLeft || {}).some((k) => k.startsWith(pre));
}

function startVisit(game, def, quiet) {
  if (!game.quests) return;
  const name = secretTitle(game.run, def);
  const q = startQuest(game, "visit", { id: `visit:${def.id}`, title: `Visit ${name}`, quiet,
    text: `${cap(name)} lies at span (${def.at.wx}, ${def.at.wy}).`, vars: { secretId: def.id },
    target: { wx: def.at.wx, wy: def.at.wy, siteId: def.ref.siteId } });
  if (q && visited(game, def.at.wx, def.at.wy)) advanceQuest(game, q, "done", { quiet: true });
}
export const visitQuest = (game, secretId) => questOf(game, `visit:${secretId}`);

// --- For the Kindling (WS6b: "give a reading", "ask for a reading") ------------------------------------------------
export function readings(game) {
  const J = journalOf(game), out = [];
  for (const [id, e] of Object.entries(J.secrets)) {
    const def = secretDef(game.run, id);
    if (def) out.push({ id, kind: def.kind, reading: def.reading, text: secretText(game.run, def), sold: !!e.sold });
  }
  return out;
}
export function markSold(game, id) {
  const e = journalOf(game).secrets[id];
  if (!e || e.sold) return false;
  e.sold = true;
  return true;
}
