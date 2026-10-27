// Village data for a run (TECH_DESIGN §2.16; bible §9.1's abstract half). Made in buildRun, because gossip, secrets
// and quests need it before you arrive; the layout is stamped later, when the zone is generated (village-site.js,
// SITE_BUILDERS.village). This file stays light (world/run.js imports it): data only.
//
//   makeVillages(run) → Map<siteId, Village>        every village site's record (buildRun's "villages" step)
//   generateVillage(run, site) → Village            one site's record (TECH_DESIGN §1.4 "story (WS7)", frozen); pure:
//                                                   the same run and site always give the same record
//   villageFaction(v) → FactionDef                  the village's own faction (WS6a's shape; run.js's factions step
//                                                   should register it: integration request)
//   villageOf(run, siteId) → Village | null         run.villages, else made once per run here
//   validateVillage(run, v) → [problem]             the record's contract (check-story)
//
//   Village = { id, siteId, name, factionId /* "village:<siteId>" */, tier, level, people, parent: "bent" | "peoples",
//     abandoned, founding: [{ event, text, cruel }] (bible §9.3's two village events), government (null if abandoned),
//     culture: { sacredLiquid, sacred, profane, dish, style, phonemes, activity, proverb, skill, shrine },
//     history: [eventId] (two of the Hours' events, the village's art), likedBy: [factionId], hates: [factionId],
//     roles: [{ role, uid, name, creatureType, dialogue, named?, readings? }] ([] when abandoned), merchantTable,
//     quest: { template, params } | null, layout: { style, buildings: [planId], murals: [eventId], rune: eventId | null,
//     shrine, perch }, checkpoint: true }
//
// R6: every draw comes from the villages stream of the run keyed by the site, seedFor(seed, "run", "villages", site.id),
// so one village never moves another and a record is the same whether made alone or with the rest.
import { makeRng, seedFor } from "../rng.js";
import { VILLAGES } from "../content/villages.js";
import { countGen } from "../world/genstats.js";
import { planQuest, QUEST_ORDER } from "./questplan.js";

const levelOfTier = (tier) => 3 * tier - 1;
export const VILLAGE_ROLES = ["leader", "warden", "merchant", "tinker", "leech", "lamplighter", "questGiver"];
const TYPE_OF = { leader: "villageLeader", warden: "villageWarden", merchant: "villageMerchant", tinker: "villageTinker",
  leech: "villageLeech", lamplighter: "villageLamplighter", questGiver: "villageQuestGiver", villager: "villager" };
const DIALOGUE_OF = { warden: "guard", merchant: "merchant", tinker: "merchant", leech: "priest", lamplighter: "wanderer",
  questGiver: "villager", villager: "villager" };
// Factions a pact may be with, and why they still like the village (bible §9.3 event 4).
const PACTS = [["noonVigil", "the Noon Vigil"], ["survey", "the Survey"], ["kites", "the Kites"], ["drovers", "the Drovers"],
  ["clatter", "the Clatter"], ["horary", "the Horary"]];
const MUTATIONS = ["gills", "a shell back", "ink glands", "lampskin", "long fingers", "horns"];

export function makeVillages(run) {
  countGen("villages");
  const out = new Map();
  for (const site of run.sites.values()) if (site.kind === "village") out.set(site.id, generateVillage(run, site));
  return out;
}

const CACHE = new WeakMap();
export function villageOf(run, siteId) {
  if (!run) return null;
  if (run.villages?.has(siteId) && run.villages.get(siteId).culture?.style !== "fixture") return run.villages.get(siteId);
  if (!CACHE.has(run)) CACHE.set(run, new Map());
  const c = CACHE.get(run), site = run.sites?.get(siteId);
  if (!c.has(siteId) && site?.kind === "village") c.set(siteId, generateVillage(run, site));
  return c.get(siteId) || null;
}

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

export function generateVillage(run, site) {
  const rng = makeRng(seedFor(run.seed, "run", "villages", site.id));
  const V = VILLAGES, tile = run.world?.tileAt?.(site.at.wx, site.at.wy);
  const terr = V.byTerrain[tile?.terrain] || V.byTerrain[tile?.region] || V.byTerrain.downs;
  const peopleId = rng.pick(terr.peoples), people = V.peoples[peopleId], style = terr.style;
  const tier = site.tier || tile?.tier || 1, level = levelOfTier(tier);

  // The culture (bible §9.2).
  const culture = {
    sacred: rng.pick(V.sacred), profane: rng.pick(V.profane), activity: rng.pick(V.activities), dish: rng.pick(V.dishes),
    skill: rng.pick(V.skills), sacredLiquid: rng.pick(V.liquids), shrine: rng.pick(Object.keys(V.shrines)), style,
    phonemes: people.names, proverb: null,
  };
  culture.proverb = fill(rng.pick(V.proverbs), culture);

  // Two village events (each 1 in 20 leaves it abandoned), a government from them.
  const evs = rng.shuffle(V.events.slice()).slice(0, 2);
  let abandoned = false;
  for (const e of evs) if (rng() < e.abandon) abandoned = true;
  const pact = rng.pick(PACTS), mutation = rng.pick(MUTATIONS);
  const neighbour = nearestVillage(run, site);
  const vars = { name: site.name, sacred: culture.sacred, dish: culture.dish, pactName: pact[1], mutation,
    neighbour: neighbour?.name || "the next village", pressedTown: "" };
  const founding = evs.map((e) => ({ event: e.id, text: fill(e.text, vars), cruel: !!e.cruel }));
  const govId = evs.find((e) => e.gov)?.gov || rng.pick(V.governments).id;
  const government = abandoned ? null : govId;

  // The village's art: two of the Hours' events (a mosaic each, a lintel each, a rune if one was cruel).
  const history = villageArt(run, site);
  const cruelHour = history.find((id) => eventById(run, id)?.disagree);
  const rune = cruelHour || (founding.some((f) => f.cruel) && history[0]) || null;

  // Factions: who likes it (its founders, a pact), whom it hates (bible §6.1, WS6a #6).
  const likedBy = [], hates = [];
  if (people.faction && people.faction !== "bentVillages") likedBy.push(people.faction);
  if (evs.some((e) => e.id === "pact") && !likedBy.includes(pact[0])) likedBy.push(pact[0]);
  if (people.parent === "bent" || evs.some((e) => e.id === "assize")) hates.push("assize");
  if (evs.some((e) => e.id === "feud") && neighbour) hates.push(`village:${neighbour.id}`);

  // The cast (bible §9.5): leader, warden, merchant, tinker, leech, lamplighter (a bell-keeper in the Shade), a named
  // quest-giver and 2-6 villagers. Abandoned: nobody.
  const roles = [];
  const names = rng.shuffle((V.names[people.names] || V.names.bent).slice());
  const nextName = () => names.shift() || null;
  const callings = rng.shuffle(V.callings.slice());
  if (!abandoned) {
    const gov = V.governments.find((g) => g.id === government);
    const base = `${site.id}`;
    const add = (role, extra) => roles.push({ role, uid: `${base}:${role}`, creatureType: TYPE_OF[role], dialogue: DIALOGUE_OF[role], ...extra });
    const lead = nextName();
    add("leader", { name: lead ? `${gov.leader} ${lead}` : gov.leader, dialogue: gov.dialogue, named: true });
    add("warden", { name: `${nextName() || "Ward"} the warden` });
    add("merchant", { name: `${nextName() || "Trader"} the trader` });
    add("tinker", { name: `${nextName() || "Tinker"} the tinker` });
    add("leech", { name: `${nextName() || "Leech"} the leech` });
    if (style === "cell") add("lamplighter", { name: `${nextName() || "Keeper"} the bell-keeper`, creatureType: "villageBellKeeper" });
    else add("lamplighter", { name: `${nextName() || "Keeper"} the lamplighter` });
    add("questGiver", { name: `${nextName() || "Someone"}, ${rng.pick(V.questGivers)}`, named: true });
    const n = rng.int(2, 6);
    for (let k = 1; k <= n; k++) {
      const given = nextName();
      roles.push({ role: "villager", uid: `${base}:villager:${k}`, creatureType: "villager", dialogue: "villager",
                   name: given ? `${given} the ${callings[k % callings.length]}` : `a ${callings[k % callings.length]}` });
    }
  }
  // Readings the cast can give in the Kindling (WS6b: c.readings): the leader its founding stories, the lamplighter
  // the flat accounts of its art.
  const own = founding.map((f, k) => `village:${site.id}:${k + 1}`);
  for (const r of roles) {
    if (r.role === "leader") r.readings = own;
    if (r.role === "lamplighter") r.readings = history.map((id) => `hist:${id}:flat`);
  }

  const buildings = abandoned ? ["hall", "house", "house"] : ["hall", rng.pick(["house", "longhouse"]), "house", "workshop", "house"];
  const v = {
    id: site.id, siteId: site.id, name: site.name, factionId: `village:${site.id}`, tier, level,
    people: peopleId, parent: people.parent, abandoned, founding, government, culture, history, likedBy, hates, roles,
    merchantTable: abandoned ? null : "general", quest: null,
    layout: { style, buildings, murals: history.slice(), rune, shrine: culture.shrine, perch: false },
    checkpoint: true,
  };
  // One quest (bible §9.1 step 6, §9.6), planned now so its target is fixed for the run; none in an empty village.
  if (!abandoned) {
    for (const template of rng.shuffle(QUEST_ORDER.slice())) {
      const params = planQuest(run, site, v, template, rng);
      if (params) { v.quest = { template, params }; break; }
    }
    if (v.quest?.template === "climb") v.layout.perch = true;
  }
  return v;
}

// Which two of the Hours' events a village shows: a stream of its own (seedFor(seed, "run", "villages", site.id,
// "art")), so another village's quest can name a mosaic here without making this whole record.
export function villageArt(run, site) {
  const all = (run.history?.rulers || []).flatMap((R) => R.events.map((e) => e.id));
  if (!all.length) return [];
  const rng = makeRng(seedFor(run.seed, "run", "villages", site.id, "art"));
  return rng.shuffle(all).slice(0, Math.min(2, all.length));
}
export function eventById(run, id) {
  for (const R of run.history?.rulers || []) for (const e of R.events) if (e.id === id) return e;
  return null;
}

// The nearest other village site (feuds, word to carry), by span distance then id.
export function nearestVillage(run, site, { max = 99 } = {}) {
  let best = null, bd = Infinity;
  for (const s of run.sites?.values() || []) {
    if (s.kind !== "village" || s.id === site.id) continue;
    const d = Math.max(Math.abs(s.at.wx - site.at.wx), Math.abs(s.at.wy - site.at.wy));
    if (d < bd || (d === bd && s.id < best.id)) { bd = d; best = s; }
  }
  return bd <= max ? best : null;
}

export function villageFaction(v) {
  const relations = {};
  for (const id of v.likedBy) relations[id] = 1;
  for (const id of v.hates) relations[id] = -1;
  const P = VILLAGES.peoples[v.people];
  return {
    id: v.factionId, name: v.name, parent: v.parent, temperament: "docile", startRep: 0, generated: true, siteId: v.siteId,
    likes: v.likedBy.map((id) => [id, id === P?.faction ? "our founders" : "an old pact"]),
    hates: v.hates.map((id) => [id, id === "assize" ? "they come with writs" : "an old feud"]),
    relations, color: [190, 200, 160], glyph: "@", liquid: v.culture.sacredLiquid, rite: "deep", voice: null, homeRegions: [],
    about: `${v.name}: ${P?.name || "villagers"}${v.government ? `, ruled by ${VILLAGES.governments.find((g) => g.id === v.government).name}` : ", empty now"}.`,
  };
}

// The record's contract (check-story): the fields §2.16 names, the cast, history ids from this run, its quest.
export function validateVillage(run, v) {
  const out = [], site = run.sites?.get(v.siteId);
  if (!site || site.kind !== "village") out.push(`${v.id}: no village site`);
  if (v.factionId !== `village:${v.siteId}`) out.push(`${v.id}: factionId ${v.factionId}`);
  if (!["bent", "peoples"].includes(v.parent)) out.push(`${v.id}: parent ${v.parent}`);
  for (const k of ["sacredLiquid", "sacred", "profane", "dish", "style", "activity", "proverb", "skill", "shrine"])
    if (!v.culture?.[k]) out.push(`${v.id}: culture.${k} missing`);
  if (/\{\w+\}/.test(v.culture?.proverb || "") || v.founding.some((f) => /\{\w+\}/.test(f.text))) out.push(`${v.id}: an unfilled slot`);
  if (v.founding.length !== 2) out.push(`${v.id}: ${v.founding.length} village events`);
  const events = new Set((run.history?.rulers || []).flatMap((R) => R.events.map((e) => e.id)));
  if (v.history.length !== Math.min(2, events.size) || v.history.some((id) => !events.has(id))) out.push(`${v.id}: history ${v.history}`);
  if (v.layout.murals.some((id) => !v.history.includes(id)) || (v.layout.rune && !v.history.includes(v.layout.rune))) out.push(`${v.id}: murals not its own events`);
  if (v.abandoned) {
    if (v.roles.length || v.government || v.quest) out.push(`${v.id}: abandoned, but with a cast, a government or a quest`);
  } else {
    for (const r of VILLAGE_ROLES) if (!v.roles.some((x) => x.role === r)) out.push(`${v.id}: no ${r}`);
    const n = v.roles.filter((x) => x.role === "villager").length;
    if (n < 2 || n > 6) out.push(`${v.id}: ${n} villagers`);
    if (new Set(v.roles.map((r) => r.uid)).size !== v.roles.length) out.push(`${v.id}: uids repeat`);
    if (!v.roles.find((r) => r.role === "leader")?.named) out.push(`${v.id}: the leader isn't named`);
    if (!v.quest) out.push(`${v.id}: no quest`);
  }
  return out;
}
