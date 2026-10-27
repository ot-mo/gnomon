// The ancient history of a run (TECH_DESIGN §2.15; bible §8: the Hours, the god-kings of the morning).
//
//   generateHistory(seed, world) → History
//   History = { rulers: [{ id, name, epithet, domains, born: { region }, died, favoured, hated, events: [{ id, year, type,
//               cause, text: { gospel, inscription, hostile }, siteRequest?, relicId? }] }],
//               siteRequests: [{ id, rulerId, eventId, name, tier, regionPrefs, floors, relicId }],
//               relics: [{ id, name, base: { kind, id }, powers, domain, lovedBy, slays }] }
//   validateHistory(history, { strict = true, world }) → [problem]   strict: bible §8's numbers too (not the fixture's)
//   fixtureHistory() → History                                       P0's fixture (a fresh copy)
//
// The test world keeps P0's fixture: the same History for every seed (two Hours, two site requests, one relic),
// which WS10's checks place there by region and tier, and the old game plays on that world. Every other world (the
// real one) gets the generator, bible §8.1-§8.3 and §8.7:
//   - five Hours, First (oldest) to Fifth, each born in the age of the one before; one domain each (by era, §8.3),
//     gaining up to two more; 2-3 historical regions per period with 6-8 places in the oldest, down to 2;
//   - 10-14 events each: the origin, 8 core events drawn by weight, a crowning if none crowned it, one event in every
//     region not yet visited, the death (which makes the Hour's mask). Effect first, cause after: an event's state
//     change is chosen, then its cause is found in the Hour's state (a favoured faction persecuted, a domain's
//     practice banned), or made up and cited (a new favoured faction);
//   - three accounts per event from content/grammar.js: the gospel (the Flat Account, the map's; plain, with the age
//     when under 16 or over 70), the inscription (the Deep Inscription, the 3D's; capitals, defeats left out) and the
//     hostile gloss (the dark's; lower case, lines split at " / ");
//   - 2-4 relics per Hour (made, given at a wedding, the mask at its death), with its domain's powers; a lost one
//     waits where it was lost;
//   - eight site requests (Fifth 2, Fourth 2, Third 2, Second 1, First 1) on the period's tier band, with its floors:
//     the Hour's tomb first (its deepest, holding a relic it didn't lose), then a renamed city, a battlefield, a
//     founded town or a caravanserai (holding what was lost there).
// Extra fields beyond the contract (for the journal, the secrets and the checks): a ruler's short, ordinal, period,
// pronoun, cognomens, colour, profession, regions, cult, born.year; an event's variant, age, place, region, disagree
// (the Deep Inscription leaves out what the Flat Account says), falseDeath, stele, renamed, noonReading; a relic's
// rulerId, eventId, lostAt, mask, text { flat, deep, dark }.
// R6: draws only from seedFor(seed, "run", "history"), the stream runRng(run, "history") gives, never Math.random.
// A fresh object each call: callers may keep it.
import { countGen } from "../world/genstats.js";
import { makeRng, seedFor } from "../rng.js";
import { GRAMMAR } from "../content/grammar.js";
import { expand, hourName, placeName, regionName, cap, ordinal, numberWords, nameAllowed } from "./grammar.js";

const FIXTURE = {
  rulers: [
    {
      id: "hour:ishvalet", name: "Ishvalet", epithet: "the Glazier", domains: ["glass"], born: { region: "the Clear Coast" },
      died: 214, favoured: ["kites", "plan", "flatfolk"], hated: ["unlit"],
      events: [
        { id: "ishvalet:1", year: 140, type: "origin", cause: "heir to the reigning Hour",
          text: { gospel: "Ishvalet was born under a pane that would not break.",
                  inscription: "HERE THE GLAZIER FIRST SAW THE MORNING THROUGH GLASS.",
                  hostile: "A lens-grinder's child, spoiled by mirrors." } },
        { id: "ishvalet:2", year: 171, type: "forgedRelic", cause: "grinding lenses", relicId: "relic:morningLens",
          text: { gospel: "She ground the Morning Lens from the sea's first glaze.",
                  inscription: "THE LENS SEES WHAT THE EYE REFUSES.",
                  hostile: "She stole the sea's glass and called it a gift." } },
        { id: "ishvalet:3", year: 198, type: "longShadow", cause: "two suns in one lens", siteRequest: "site:glazierRest",
          text: { gospel: "Where two suns stood in one lens, she raised a house of clear walls.",
                  inscription: "REST, GLAZIER. THE PANES KEEP WATCH.",
                  hostile: "A glass house for a glass heart." } },
      ],
    },
    {
      id: "hour:ammaruth", name: "Ammaruth", epithet: "Who Wept Salt", domains: ["salt"], born: { region: "the White Pans" },
      died: 402, favoured: ["clatter", "saltbeasts", "errata"], hated: ["pleatwood"],
      events: [
        { id: "ammaruth:1", year: 330, type: "origin", cause: "found pressed in a floor and unpressed as a babe",
          text: { gospel: "Ammaruth was lifted from a salt floor, and wept the first salt.",
                  inscription: "FROM THE CRUST, A CROWN.",
                  hostile: "Dug out of the pans like a stone, and as cold." } },
        { id: "ammaruth:2", year: 371, type: "armyAtGate", cause: "a ban on salting the dead", siteRequest: "site:saltedField",
          text: { gospel: "He salted the field where the gate fell, so nothing would grow against him.",
                  inscription: "THE WHITE FIELD REMEMBERS.",
                  hostile: "He burned the harvest white and called it law." } },
      ],
    },
  ],
  siteRequests: [
    { id: "site:glazierRest", rulerId: "hour:ishvalet", eventId: "ishvalet:3", name: "Ishvalet's Rest", tier: 2,
      regionPrefs: ["midwood", "tessellate"], floors: 2, relicId: "relic:morningLens" },
    { id: "site:saltedField", rulerId: "hour:ammaruth", eventId: "ammaruth:2", name: "the Salted Field of the Gate", tier: 1,
      regionPrefs: ["westreach", "waste"], floors: 2, relicId: null },
  ],
  relics: [
    { id: "relic:morningLens", name: "the Morning Lens", base: { kind: "amulet", id: "sight" }, powers: [{ examine: 5 }],
      domain: "glass", lovedBy: ["kites"], slays: ["unlit"] },
  ],
};

const clone = (v) => JSON.parse(JSON.stringify(v));
export const fixtureHistory = () => clone(FIXTURE);

export function generateHistory(seed, world) {
  countGen("history");
  if (world?.id === "test") return clone(FIXTURE);
  return makeHistory(seed >>> 0, world);
}

// --- The generator ------------------------------------------------------------------------------------------------
const PRONOUNS = [
  { they: "she", them: "her", their: "her", theirs: "hers", themselves: "herself", was: "was", has: "has" },
  { they: "he", them: "him", their: "his", theirs: "his", themselves: "himself", was: "was", has: "has" },
  { they: "they", them: "them", their: "their", theirs: "theirs", themselves: "themselves", was: "were", has: "have" },
];
const ORIGIN_CAUSE = { heir: "heir to the reigning Hour", unpressed: "found pressed in a floor and unpressed as a babe",
                       crypt: "born in the dark, in a crypt" };
const DEATH_CAUSE = { natural: "old age", dark: "a vow to the dark", plane: "the Plane's call" };
const CROWNING = ["contest", "armyAtGate", "wedding"];
const RELIC_CAP = 3;   // made and given relics per Hour; with the mask, 2-4 in all (bible §8.1)

function weighted(rng, entries) {   // [[key, weight]] → key
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = rng() * total;
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[entries.length - 1][0];
}
const CORE_TYPES = Object.entries(GRAMMAR.events).filter(([, e]) => e.weight > 0).map(([k, e]) => [k, e.weight]);
const pickVariant = (rng, type, only) =>
  weighted(rng, Object.entries(GRAMMAR.events[type].variants).filter(([v]) => !only || only.includes(v)).map(([v, d]) => [v, d.weight]));

// The tiers that have a span a site can use (WS10's rule: no landmark, walkable, open edges, no road or river).
function usableTiers(world) {
  if (!world?.tiles) return null;
  const out = new Set();
  for (const t of world.tiles) if (!t.landmark && t.travel === "yes" && t.edges === "open" && !t.roadWidth && !t.riverWidth) out.add(t.tier);
  return out;
}

function makeHistory(seed, world) {
  const rng = makeRng(seedFor(seed, "run", "history"));
  const tiers = usableTiers(world);
  const taken = new Set();   // every name handed out, so no two places, regions or Hours share one
  const fresh = (make) => { for (let k = 0; k < 60; k++) { const n = make(); if (!taken.has(n)) { taken.add(n); return n; } } throw new Error("history: ran out of fresh names"); };
  const history = { rulers: [], siteRequests: [], relics: [] };

  // Lifetimes: each Hour born in the age of the one before, each age ending with its Hour's death.
  const eras = [];
  let prevDeath = 0;
  for (let k = 0; k < 5; k++) {
    const born = k === 0 ? rng.int(10, 40) : prevDeath - rng.int(4, 36);
    const died = Math.max(born + rng.int(28, 96), prevDeath + rng.int(10, 35));
    eras.push({ start: prevDeath, end: died, born });
    prevDeath = died;
  }
  const when = (year) => {
    let e = eras.findIndex((x) => year <= x.end);   // an age runs from the death before it to its own Hour's death
    if (e < 0) e = eras.length - 1;
    return `In the ${ordinal(Math.max(1, year - eras[e].start))} year of the ${GRAMMAR.names.ordinals[e]} Hour`;
  };

  for (let k = 0; k < 5; k++) {
    const H = makeHour(rng, k, eras[k], fresh, when);
    history.rulers.push(H.ruler);
    history.relics.push(...H.relics);
    history.siteRequests.push(...siteRequestsOf(rng, H, tiers, fresh));
  }
  return history;
}

function makeHour(rng, k, era, fresh, when) {
  const G = GRAMMAR, period = G.periods[k];
  const name = fresh(() => hourName(rng)), short = name.toLowerCase();
  const pron = rng.pick(PRONOUNS);
  const d0 = rng.pick(G.eras[k]);
  const regions = [];
  for (let r = 0, n = rng.int(...period.regions); r < n; r++) {
    const domain = rng.pick(G.eras[k]);
    const places = [];
    for (let p = 0, m = rng.int(...period.places); p < m; p++) places.push(fresh(() => placeName(rng)));
    regions.push({ name: fresh(() => regionName(rng, domain)), domain, places });
  }
  const H = {
    k, name, short, pron, id: `hour:${short}`, domains: [d0], favoured: [], hated: [], cognomens: [G.domains[d0].cognomens[0]],
    colour: G.domains[d0].colour, profession: G.domains[d0].profession, regions, region: regions[0], crowned: false,
    born: era.born, died: era.end, falseDeath: false, relics: [], events: [], renames: {}, fresh,
  };
  const deathAge = H.died - H.born;

  // The plan: origin, 8 core events (a relic made if none came of them), a crowning if none, region coverage, death
  // (bible §8.3's generation order).
  const coreAges = [];
  for (let i = 0; i < 8; i++) coreAges.push(rng.int(rng.chance(0.15) ? 5 : 16, deathAge - 1));
  coreAges.sort((a, b) => a - b);
  const core = coreAges.map((age) => ({ type: weighted(rng, CORE_TYPES), age }));
  if (!core.some((e) => e.type === "forgedRelic" || e.type === "wedding")) core[rng.int(0, 7)].type = "forgedRelic";

  happen(rng, H, { type: "origin", age: 0 }, when);
  for (const e of core) happen(rng, H, e, when);
  if (!H.relics.length) happen(rng, H, { type: "forgedRelic", age: rng.int(16, deathAge - 1) }, when);   // a wedding that gave nothing
  if (!H.crowned) {
    const type = rng.pick(CROWNING);
    happen(rng, H, { type, age: rng.int(Math.max(16, coreAges[0]), deathAge - 1), crown: true }, when);
  }
  for (const reg of regions)
    if (!H.events.some((e) => e.region === reg.name)) {
      H.region = reg;
      happen(rng, H, { type: rng.pick(["metPeople", "raisedDial", "secretRite", "readFloor"]), age: rng.int(16, deathAge - 1) }, when);
    }
  happen(rng, H, { type: "death", age: deathAge }, when);
  while (H.favoured.length < 3) befriend(rng, H);   // bible §8.3, step 6
  for (const r of H.relics) if (r.mask) r.lovedBy = [...H.favoured];   // the mask: +200 with every favoured faction

  // Ids by date: "<short>:<n>", 1-based.
  H.events.sort((a, b) => a.year - b.year || (a.type === "death") - (b.type === "death") || (b.type === "origin") - (a.type === "origin"));
  H.events.forEach((e, n) => { e.id = `${short}:${n + 1}`; });
  H.relics.forEach((r, n) => { r.id = `relic:${short}:${n + 1}`; r.eventId = r._event.id; delete r._event; });
  for (const e of H.events) {
    if (e._relic) { e.relicId = e._relic.id; delete e._relic; }
    if (e.relicId === undefined) delete e.relicId;
  }
  for (const r of H.relics) if (r.lostAt) { r.lostAt.eventId = r.lostAt._event.id; delete r.lostAt._event; }

  const epithet = H.cognomens[H.cognomens.length - 1];
  const cultWord = rng.pick(G.names.cults);
  H.ruler = {
    id: H.id, name, epithet, domains: [...H.domains], born: { region: regions[0].name, year: H.born }, died: H.died,
    favoured: [...H.favoured], hated: [...H.hated], events: H.events,
    short, ordinal: G.names.ordinals[k], period: k + 1, pronoun: pron.they, cognomens: [...H.cognomens], colour: H.colour,
    profession: H.profession, regions: regions.map((r) => ({ name: r.name, places: [...r.places] })),
    cult: { name: `the ${cultWord} of ${epithet.startsWith("the ") ? epithet.slice(4) : name}` },
  };
  return H;
}

const factionName = (id) => GRAMMAR.factions[id]?.name || id;
const notMine = (H, id) => !H.favoured.includes(id) && !H.hated.includes(id);

// A favoured faction: one of the Hour's domains' first, else any old faction it has no feeling about yet.
function befriend(rng, H) {
  const all = Object.keys(GRAMMAR.factions).filter((f) => notMine(H, f));
  const near = all.filter((f) => GRAMMAR.factions[f].domains.some((d) => H.domains.includes(d)));
  const f = rng.pick(near.length ? near : all);
  if (f) H.favoured.push(f);
  return f;
}
function makeEnemy(rng, H) {
  const all = Object.keys(GRAMMAR.factions).filter((f) => notMine(H, f));
  const f = rng.pick(all);
  if (f) H.hated.push(f);
  return f;
}

function newRelic(rng, H, domain, ev, { mask = false } = {}) {
  const D = GRAMMAR.domains[domain];
  let name, base, powers;
  if (mask) {
    name = `the Mask of ${H.name}`;
    base = { kind: "amulet", id: "life" };
    powers = [];
  } else {
    const [noun, b] = rng.pick(D.relicNouns);
    const cog = H.cognomens[H.cognomens.length - 1];
    const adj = rng.pick(D.ruins.filter((a) => !a.startsWith(noun.slice(0, 4))));   // never "the Sealed Seal"
    name = `the ${adj} ${noun} of ${cog.startsWith("the ") || cog.includes(" of ") ? H.name : cog}`;
    base = { ...b };
    const pool = rng.shuffle([...D.powers]);
    powers = pool.slice(0, rng.chance(0.35) ? 2 : 1);
  }
  const lovedBy = [], slays = [];
  if (mask) lovedBy.push(...H.favoured);
  else if (H.hated.length && rng.chance(0.5)) slays.push(rng.pick(H.hated));
  else if (H.favoured.length) lovedBy.push(rng.pick(H.favoured));
  const r = { id: null, name, base, powers: powers.map((p) => p.power), domain, lovedBy, slays,
              rulerId: H.id, eventId: null, lostAt: null, mask, _event: ev, powerText: powers.map((p) => p.text) };
  H.relics.push(r);
  return r;
}

// The relic's three registers (bible §2.1 rule 3).
function relicText(rng, H, r, place) {
  const noun = r.mask ? "Mask" : r.name.split(" of ")[0].split(" ").pop();
  const ctx = { ...H.pron, name: H.name, relicNoun: noun, colour: GRAMMAR.domains[r.domain].colour, place, theirs: H.pron.theirs };
  const flat = r.mask
    ? `MASK. ${H.name}'s face. Worn, the Hour's friends warm to you and its enemies cool.`
    : `${noun.toUpperCase()}. ${cap(GRAMMAR.domains[r.domain].profession)}'s work. ${r.powers.length}. ${r.powerText.map(cap).join(". ")}.`;
  const kind = r.mask ? "mask" : "relic";
  r.text = { flat, deep: expand(GRAMMAR.rules, `${kind}/deep`, rng, ctx), dark: expand(GRAMMAR.rules, `${kind}/dark`, rng, ctx).toLowerCase() };
  delete r.powerText;
}

// One event: its state change first, then its cause from the state, then its three accounts.
function happen(rng, H, plan, when) {
  const G = GRAMMAR;
  let { type } = plan;
  const ownRelics = () => H.relics.filter((r) => !r.mask && !r.lostAt);
  if (type === "lostRelic" && !ownRelics().length) type = "forgedRelic";
  if (type === "forgedRelic" && H.relics.filter((r) => !r.mask).length >= RELIC_CAP) type = "metPeople";
  let variant = pickVariant(rng, type, plan.crown ? { contest: ["ousts"], armyAtGate: null, wedding: ["faction"] }[type] : null);
  if (type === "field" && variant === "loses" && !ownRelics().length) variant = "costly";
  if (type === "wedding" && variant === "faction" && H.relics.filter((r) => !r.mask).length >= RELIC_CAP) variant = "artisan";
  if (type === "rampage" && H.regions.length > 1 && rng.chance(0.6)) H.region = rng.pick(H.regions.filter((r) => r !== H.region));
  const region = H.region, place = rng.pick(region.places);
  const year = H.born + plan.age;
  const ev = { id: null, year, type, cause: "", text: null, variant, age: plan.age, place, region: region.name };
  const domainOf = () => rng.pick(H.domains);
  const c = { faction: null, hated: null, relic: null, newName: null, count: null, years: null, domain: H.domains[0], practice: null };
  const practice = (d) => (c.practice ||= rng.pick(G.domains[d || domainOf()].practices));
  const causeOf = (kind, extra = {}) => expand(G.rules, `cause/${kind}`, rng, { ...H.pron, practice: practice(), faction: factionName(c.faction || H.favoured[0] || "clatter"),
    hated: factionName(c.hated || H.hated[0] || "askew"), relic: c.relic?.name || "a relic", omen: rng.pick(G.domains[domainOf()].omens), domain: G.domains[domainOf()].noun, ...extra });
  const crown = () => { H.crowned = true; };
  const cognomen = (d = domainOf()) => {
    const pool = G.domains[d].cognomens.filter((x) => !H.cognomens.includes(x));
    if (pool.length) H.cognomens.push(rng.pick(pool));
  };

  switch (type) {
    case "origin":
      if (variant === "raised") { c.faction = befriend(rng, H); ev.cause = `raised by ${factionName(c.faction)}`; }
      else ev.cause = ORIGIN_CAUSE[variant];
      break;
    case "readFloor": {
      const d = H.domains.includes(region.domain) ? rng.pick(Object.keys(G.domains).filter((x) => !H.domains.includes(x))) : region.domain;
      if (H.domains.length < 3) H.domains.push(d);
      c.domain = d;
      ev.cause = `the ${variant} at ${place}`;
      break;
    }
    case "metPeople":
      c.faction = befriend(rng, H);
      ev.cause = causeOf("practice");
      break;
    case "secretRite":
      c.faction = variant === "welcomed" ? befriend(rng, H) : makeEnemy(rng, H);
      ev.cause = practice();
      break;
    case "contest":
      if (variant === "ousts") { crown(); c.faction = H.favoured.length ? rng.pick(H.favoured) : befriend(rng, H); c.count = numberWords(rng.int(2, 40)); ev.cause = causeOf("urging"); }
      else if (variant === "repels") { cognomen(); ev.cause = causeOf("practice"); }
      else { H.falseDeath = true; ev.falseDeath = true; c.years = rng.int(3, 30); ev.cause = causeOf("practice"); }
      break;
    case "forgedRelic": {
      const d = domainOf();
      c.domain = d;
      c.relic = newRelic(rng, H, d, ev);
      ev._relic = c.relic;
      c.count = numberWords(rng.int(3, 90));
      ev.cause = practice(d);
      break;
    }
    case "longShadow": {
      const d = domainOf();
      H.colour = G.domains[d].colour;
      cognomen(d);
      ev.stele = true;
      ev.cause = c.omen = rng.pick(G.domains[d].omens);
      break;
    }
    case "armyAtGate":
      if (H.favoured.length && rng.chance(0.6)) { c.faction = rng.pick(H.favoured); ev.cause = causeOf("persecution"); }
      else if (rng.chance(0.5)) ev.cause = causeOf("ban");
      else { c.faction = befriend(rng, H); ev.cause = causeOf("persecution"); }   // nothing to cite: make it, then cite it
      c.newName = H.fresh(() => `${H.name}'s ${rng.pick(G.names.renamed)}`);
      H.renames[place] = c.newName;
      ev.renamed = { from: place, to: c.newName };
      c.count = numberWords(rng.int(2, 9) * 100);
      if (plan.crown || rng.chance(0.4)) crown();
      break;
    case "rampage": {
      const lost = H.relics.find((r) => r.lostAt);
      if (lost) { c.relic = lost; ev.cause = causeOf("loss"); }
      else if (H.hated.length) { c.hated = rng.pick(H.hated); ev.cause = causeOf("insult"); }
      else ev.cause = causeOf("invented");
      const a = makeEnemy(rng, H), b = makeEnemy(rng, H);
      c.hated = c.hated || a || b;
      cognomen();
      break;
    }
    case "raisedDial":
      c.faction = H.favoured.length && rng.chance(0.6) ? rng.pick(H.favoured) : befriend(rng, H);
      c.newName = H.fresh(() => placeName(rng));
      region.places.push(c.newName);
      ev.renamed = { from: null, to: c.newName };
      H.profession = G.domains[domainOf()].profession;
      ev.cause = practice();
      break;
    case "lostRelic": {
      const r = rng.pick(ownRelics());
      r.lostAt = { place, _event: ev };
      c.relic = r;
      ev._relic = r;
      ev.cause = causeOf("accident");
      break;
    }
    case "field":
      c.hated = H.hated.length ? rng.pick(H.hated) : makeEnemy(rng, H);
      c.newName = H.fresh(() => `the ${rng.pick(G.domains[domainOf()].ruins)} Field of ${place}`);
      H.renames[place] = c.newName;
      ev.renamed = { from: place, to: c.newName };
      c.count = numberWords(rng.int(1, 30) * 10);
      if (variant === "loses") { const r = rng.pick(ownRelics()); r.lostAt = { place: c.newName, _event: ev }; c.relic = r; ev._relic = r; }
      ev.cause = causeOf("feud");
      break;
    case "pressed":
      if (variant === "rescued") { c.faction = befriend(rng, H); c.count = numberWords(rng.int(2, 40)); ev.cause = `rescued by ${factionName(c.faction)}`; }
      else { H.falseDeath = true; ev.falseDeath = true; c.years = rng.int(3, 30); ev.cause = "pressed into a floor"; }
      break;
    case "wedding":
      if (variant === "faction") { c.faction = befriend(rng, H); c.relic = newRelic(rng, H, rng.pick(G.factions[c.faction]?.domains || H.domains), ev); ev._relic = c.relic; if (plan.crown) crown(); }
      else if (variant === "artisan") { const d = rng.pick(Object.keys(G.domains)); H.profession = G.domains[d].profession; cognomen(d); }
      else { H.cognomens.push(`Twice ${H.cognomens[H.cognomens.length - 1].replace(/^the /, "")}`); ev.mirrored = true; }
      ev.cause = causeOf("practice");
      break;
    case "turnedHand": {
      const d = rng.pick(Object.keys(G.domains).filter((x) => !H.domains.includes(x)));
      if (H.domains.length < 3) { H.domains.push(d); c.domain = d; } else crown();
      ev.noonReading = true;
      ev.cause = causeOf("practice");
      break;
    }
    case "death":
      if (variant === "pressed") { c.hated = H.hated.length ? rng.pick(H.hated) : makeEnemy(rng, H); ev.cause = causeOf("feud"); }
      else ev.cause = DEATH_CAUSE[variant];
      c.relic = newRelic(rng, H, H.domains[0], ev, { mask: true });
      ev._relic = c.relic;
      break;
  }
  if (G.events[type].variants[variant].disagree) ev.disagree = true;

  // The three accounts.
  const d = c.domain || H.domains[0], D = G.domains[d];
  const ctx = {
    ...H.pron, name: H.name, cog: H.cognomens[H.cognomens.length - 1], hour: `the ${G.names.ordinals[H.k]} Hour`, when: when(year),
    place, region: region.name, newName: c.newName || place, faction: factionName(c.faction || H.favoured[0] || "clatter"),
    hated: factionName(c.hated || H.hated[0] || "askew"), practice: practice(), omen: c.omen || rng.pick(D.omens), weapon: rng.pick(D.weapons),
    ruin: rng.pick(D.ruins), relic: c.relic?.name || "a relic", relicNoun: c.relic ? c.relic.name.split(" of ")[0].split(" ").pop() : "relic",
    colour: H.colour, profession: H.profession, guild: D.guild, count: c.count || "many", years: String(c.years || 0), cause: ev.cause,
    domain: D.noun, age: String(plan.age),
  };
  let gospel = expand(G.rules, `${type}/${variant}/flat`, rng, ctx);
  if (ev.falseDeath && type === "contest") gospel += " " + expand(G.rules, "returned", rng, ctx);
  if (type !== "origin" && type !== "death" && (plan.age < 16 || plan.age > 70))
    gospel += ` ${cap(H.pron.they)} ${H.pron.was} ${numberWords(plan.age)}.`;
  ev.text = {
    gospel: cap(gospel),
    inscription: expand(G.rules, `${type}/${variant}/deep`, rng, ctx).toUpperCase(),
    hostile: expand(G.rules, `${type}/${variant}/dark`, rng, ctx).toLowerCase(),
  };
  if (c.relic && ev._relic === c.relic && !c.relic.text) relicText(rng, H, c.relic, place);
  H.events.push(ev);
  return ev;
}

// Bible §8.7: the period's sites on its tier band, with its floors. The tomb first (the Hour's deepest; a relic the Hour
// didn't lose lies there), then places history renamed, founded or lost things at.
function siteRequestsOf(rng, H, tiers, fresh) {
  const G = GRAMMAR, period = G.periods[H.k], out = [];
  const death = H.events.find((e) => e.type === "death");
  const candidates = H.events.filter((e) => e.type !== "death" && (e.renamed || e.type === "lostRelic" || (e.type === "field")));
  rng.shuffle(candidates);
  const picks = [death, ...candidates].slice(0, period.sites);
  while (picks.length < period.sites) {   // an Hour with nothing renamed: any event with a place, named for the Hour
    const e = rng.pick(H.events.filter((x) => !picks.includes(x) && x.type !== "origin"));
    picks.push(e);
  }
  const placedRelics = new Set();
  picks.forEach((ev, j) => {
    let name;
    if (ev.type === "death") name = fresh(() => `${H.name}'s ${rng.pick(G.names.tomb)}`);
    else if (ev.type === "lostRelic") name = fresh(() => `the Caravanserai of ${ev.place}`);
    else if (ev.renamed?.to && !taken(out, ev.renamed.to)) name = ev.renamed.to;
    else name = fresh(() => `${H.name}'s ${rng.pick(G.names.renamed)}`);
    let relicId = null;
    const lost = H.relics.find((r) => r.lostAt?.eventId === ev.id);
    if (lost) relicId = lost.id;
    else if (ev.type === "death") {
      const keep = H.relics.filter((r) => !r.lostAt && !r.mask);
      relicId = (keep[keep.length - 1] || H.relics.find((r) => r.mask)).id;
    }
    if (relicId && placedRelics.has(relicId)) relicId = null;
    if (relicId) placedRelics.add(relicId);
    const id = `site:${H.short}:${j + 1}`;
    ev.siteRequest = id;
    out.push({ id, rulerId: H.id, eventId: ev.id, name, tier: tierFor(rng, period.tiers, tiers), regionPrefs: [...period.regionPrefs],
               floors: period.floors, relicId });
  });
  return out;
}
const taken = (reqs, name) => reqs.some((r) => r.name === name);

// A tier of the band [lo, hi] that has a usable span; else the usable tier nearest the band.
function tierFor(rng, [lo, hi], usable) {
  const band = [];
  for (let t = lo; t <= hi; t++) if (!usable || usable.has(t)) band.push(t);
  if (band.length) return rng.pick(band);
  const all = [...usable].sort((a, b) => Math.min(Math.abs(a - lo), Math.abs(a - hi)) - Math.min(Math.abs(b - lo), Math.abs(b - hi)) || a - b);
  return all[0] ?? lo;
}

// --- Validation (check-story; tests/checks/world.js on the real world) ---------------------------------------------
const SENTENCES = (s) => (s.match(/[.!?](\s|$)/g) || []).length;
const BASES = new Set(["weapon", "armour", "amulet", "ring"]);

export function validateHistory(h, { strict = true, world = null } = {}) {
  const out = [], G = GRAMMAR;
  if (!h || !Array.isArray(h.rulers) || !Array.isArray(h.siteRequests) || !Array.isArray(h.relics)) return ["not a History"];
  const relicIds = new Set(h.relics.map((r) => r.id)), reqIds = new Set(h.siteRequests.map((r) => r.id));
  const eventIds = new Set();
  if (relicIds.size !== h.relics.length) out.push("two relics share an id");
  if (reqIds.size !== h.siteRequests.length) out.push("two site requests share an id");
  if (strict && h.rulers.length !== 5) out.push(`${h.rulers.length} Hours, not five`);
  if (new Set(h.rulers.map((r) => r.id)).size !== h.rulers.length) out.push("two Hours share an id");
  for (const R of h.rulers) {
    const at = R.id;
    if (!R.name || !nameAllowed(R.name)) out.push(`${at}: the name "${R.name}"`);
    if (!R.epithet) out.push(`${at}: no epithet`);
    if (!Array.isArray(R.domains) || !R.domains.length || R.domains.length > 3 || R.domains.some((d) => !G.domains[d])) out.push(`${at}: domains ${JSON.stringify(R.domains)}`);
    if (!R.born?.region) out.push(`${at}: no birth region`);
    if (!Number.isInteger(R.died)) out.push(`${at}: died ${R.died}`);
    for (const f of [...(R.favoured || []), ...(R.hated || [])]) if (!G.factions[f]) out.push(`${at}: ${f} is not an old faction`);
    if (strict && (R.favoured?.length || 0) < 3) out.push(`${at}: ${R.favoured?.length} favoured factions, fewer than 3`);
    if ((R.favoured || []).some((f) => R.hated?.includes(f))) out.push(`${at}: a faction both favoured and hated`);
    const ev = R.events || [];
    if (strict && (ev.length < 10 || ev.length > 14)) out.push(`${at}: ${ev.length} events, not 10-14`);
    if (strict && (ev[0]?.type !== "origin" || ev[ev.length - 1]?.type !== "death")) out.push(`${at}: doesn't run from origin to death`);
    if (strict && ev.some((e) => e.year > R.died)) out.push(`${at}: an event after the death`);
    for (let i = 1; i < ev.length; i++) if (ev[i].year < ev[i - 1].year) out.push(`${at}: events out of date order at ${ev[i].id}`);
    for (const e of ev) {
      const w = `${at} ${e.id}`;
      if (!e.id || eventIds.has(e.id)) out.push(`${w}: a missing or repeated event id`);
      eventIds.add(e.id);
      if (!G.events[e.type]) out.push(`${w}: type ${e.type}`);
      if (!Number.isInteger(e.year)) out.push(`${w}: year ${e.year}`);
      if (typeof e.cause !== "string" || !e.cause.trim()) out.push(`${w}: no cause`);
      for (const k of ["gospel", "inscription", "hostile"])
        if (typeof e.text?.[k] !== "string" || !e.text[k].trim()) out.push(`${w}: no ${k}`);
        else if (/#/.test(e.text[k]) || /undefined|null|NaN/.test(e.text[k])) out.push(`${w}: ${k} unexpanded: "${e.text[k]}"`);
      if (e.text?.inscription && e.text.inscription !== e.text.inscription.toUpperCase()) out.push(`${w}: the inscription isn't carved in capitals`);
      if (strict && e.text?.hostile && e.text.hostile !== e.text.hostile.toLowerCase()) out.push(`${w}: the gloss isn't in lower case`);
      if (strict && e.text?.gospel && (SENTENCES(e.text.gospel) < 1 || SENTENCES(e.text.gospel) > 3)) out.push(`${w}: a gospel of ${SENTENCES(e.text.gospel)} sentences`);
      if (strict && e.type !== "origin" && e.type !== "death" && (e.age < 16 || e.age > 70) && !/ (was|were) [a-z -]+\.$/.test(e.text.gospel)) out.push(`${w}: aged ${e.age} and the gospel doesn't say so`);
      if (e.relicId !== undefined && !relicIds.has(e.relicId)) out.push(`${w}: relic ${e.relicId} doesn't exist`);
      if (e.siteRequest !== undefined && !reqIds.has(e.siteRequest)) out.push(`${w}: site request ${e.siteRequest} doesn't exist`);
    }
    if (strict) {
      const mine = h.relics.filter((r) => r.rulerId === R.id);
      if (mine.length < 2 || mine.length > 4) out.push(`${at}: ${mine.length} relics, not 2-4`);
      if (mine.filter((r) => r.mask).length !== 1) out.push(`${at}: not one mask`);
    }
  }
  const tiersOk = usableTiers(world);
  const names = new Set(), relicsPlaced = new Set();
  const perPeriod = [0, 0, 0, 0, 0];
  for (const q of h.siteRequests) {
    const w = q.id, R = h.rulers.find((r) => r.id === q.rulerId), e = R?.events.find((x) => x.id === q.eventId);
    if (!R) out.push(`${w}: ruler ${q.rulerId} doesn't exist`);
    if (!e) out.push(`${w}: event ${q.eventId} isn't its ruler's`);
    else if (e.siteRequest !== q.id) out.push(`${w}: its event doesn't point back at it`);
    if (typeof q.name !== "string" || !q.name.trim() || names.has(q.name)) out.push(`${w}: a missing or repeated name "${q.name}"`);
    else if (!nameAllowed(q.name, { long: true })) out.push(`${w}: the name "${q.name}"`);
    names.add(q.name);
    if (!Number.isInteger(q.tier) || q.tier < 1 || q.tier > 8) out.push(`${w}: tier ${q.tier}`);
    if (tiersOk && !tiersOk.has(q.tier)) out.push(`${w}: tier ${q.tier} has no span a site can use`);
    if (!Array.isArray(q.regionPrefs) || !q.regionPrefs.length || q.regionPrefs.some((r) => typeof r !== "string")) out.push(`${w}: regionPrefs ${JSON.stringify(q.regionPrefs)}`);
    if (!Number.isInteger(q.floors) || q.floors < 1 || q.floors > 5) out.push(`${w}: ${q.floors} floors`);
    if (q.relicId !== null && !relicIds.has(q.relicId)) out.push(`${w}: relic ${q.relicId} doesn't exist`);
    if (q.relicId && relicsPlaced.has(q.relicId)) out.push(`${w}: relic ${q.relicId} placed twice`);
    if (q.relicId) relicsPlaced.add(q.relicId);
    if (strict && R?.period) {
      const p = G.periods[R.period - 1];
      perPeriod[R.period - 1]++;
      if (q.floors !== p.floors) out.push(`${w}: ${q.floors} floors, the ${R.ordinal} Hour's sites have ${p.floors}`);
      if (!tiersOk && (q.tier < p.tiers[0] || q.tier > p.tiers[1])) out.push(`${w}: tier ${q.tier} outside ${p.tiers.join("-")}`);
    }
  }
  if (strict) G.periods.forEach((p, k) => { if (perPeriod[k] !== p.sites) out.push(`the ${G.names.ordinals[k]} Hour has ${perPeriod[k]} sites, not ${p.sites}`); });
  for (const r of h.relics) {
    const w = r.id;
    if (!r.name || !nameAllowed(r.name, { long: true })) out.push(`${w}: the name "${r.name}"`);
    if (!BASES.has(r.base?.kind) || typeof r.base?.id !== "string") out.push(`${w}: base ${JSON.stringify(r.base)}`);
    if (!Array.isArray(r.powers) || r.powers.some((p) => typeof p !== "string" && (typeof p !== "object" || p === null))) out.push(`${w}: powers`);
    if (!G.domains[r.domain]) out.push(`${w}: domain ${r.domain}`);
    if (!Array.isArray(r.lovedBy) || !Array.isArray(r.slays)) out.push(`${w}: lovedBy / slays`);
    if (strict && (!r.text?.flat || !r.text?.deep || !r.text?.dark)) out.push(`${w}: not three registers`);
  }
  return out;
}
