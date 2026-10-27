// Planning a village's quest at buildRun (bible §9.6: "every quest points at a specific span, given as a landmark plus
// a direction and a distance"; TECH_DESIGN §2.13 targets by zone key and uid). Data only, like villages.js: what the
// quest will ask and where, fixed for the run; story/villagequests.js turns it into a quest when it is given.
//
//   planQuest(run, site, v, template, rng) → params | null     null: this village can't give that one (no village
//                                                              near enough to carry a word to, no dungeon to chart)
//   QUEST_ORDER                                                the templates a village draws from (story/villagequests.js
//                                                              registers each)
//   where(run, wx, wy) → "3 spans north-east of the Tall Table" (the nearest landmark or site; "at X" on its own span)
//
//   params = { giver: uid, giverName, village: siteId, tier, level, target?: { key, wx, wy, z }, where, place?, thing?,
//              itemUid?, to?, toUid?, secret?, beast?, beastUid?, lost?, lostUid?, percent?, shrine? }
import { QUESTS } from "../content/quests.js";
import { VILLAGES } from "../content/villages.js";
import { villageArt } from "./villages.js";   // (a cycle: villages.js imports this file; both only call at run time)

export const QUEST_ORDER = ["recover", "carry", "readFloor", "pray", "climb", "find", "hunt", "rescue", "chart"];
const RANGE = [2, 5];   // spans from the village for an outward target

const cheb = (a, b) => Math.max(Math.abs(a.wx - b.wx), Math.abs(a.wy - b.wy));
function dirWord(dx, dy) {
  const a = Math.atan2(-dy, dx);   // north is up (wy grows southward)
  return QUESTS.directions[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

// The nearest named place to a span: a landmark, else a site; "N spans <dir> of <name>", or "at <name>".
export function where(run, wx, wy) {
  let best = null, bd = Infinity;
  for (const s of run.sites?.values() || []) {
    const d = cheb(s.at, { wx, wy }) * 2 + (s.kind === "landmark" ? 0 : 1);   // a landmark wins a tie
    if (d < bd || (d === bd && s.id < best.id)) { bd = d; best = s; }
  }
  if (!best) return `at span (${wx}, ${wy})`;
  const n = cheb(best.at, { wx, wy });
  if (!n) return `at ${best.name}`;
  return `${n} span${n === 1 ? "" : "s"} ${dirWord(wx - best.at.wx, wy - best.at.wy)} of ${best.name}`;
}

// Spans you can walk into (they have a surface zone), 2-5 spans out, not the village's own; sorted for stable draws.
function outward(run, site) {
  const out = [];
  for (const t of run.world?.tiles || []) {
    if (!t || t.travel !== "yes" || t.edges !== "open") continue;
    const d = cheb(t, site.at);
    if (d >= RANGE[0] && d <= RANGE[1]) out.push(t);
  }
  return out;
}
const span = (t, z = 0) => ({ key: `${t.wx},${t.wy},${z}`, wx: t.wx, wy: t.wy, z });

export function planQuest(run, site, v, template, rng) {
  const giver = v.roles.find((r) => r.role === "questGiver");
  if (!giver) return null;
  const base = { giver: giver.uid, giverName: giver.name, village: site.id, tier: v.tier, level: v.level };
  const id = `${site.id}:quest`;
  const T = QUESTS;
  switch (template) {
    case "recover": {
      // A lair's or ruin's first level within reach (bible: "carried off to {lair}"), else a span out there.
      const dens = [...run.sites.values()].filter((s) => (s.kind === "lair" || s.kind === "ruin") && s.dungeon && cheb(s.at, site.at) <= 6)
        .sort((a, b) => cheb(a.at, site.at) - cheb(b.at, site.at) || (a.id < b.id ? -1 : 1));
      const den = dens.length ? rng.pick(dens.slice(0, 3)) : null;
      const spans = outward(run, site);
      if (!den && !spans.length) return null;
      const t = den ? { wx: den.at.wx, wy: den.at.wy } : rng.pick(spans);
      return { ...base, thing: rng.pick(T.things), itemUid: `${id}:thing`, target: span(t, den ? 1 : 0),
               place: den ? den.name : "the wilds", where: where(run, t.wx, t.wy) };
    }
    case "carry": {
      const others = [...run.sites.values()].filter((s) => s.kind === "village" && s.id !== site.id && cheb(s.at, site.at) <= 10);
      if (!others.length) return null;
      others.sort((a, b) => cheb(a.at, site.at) - cheb(b.at, site.at) || (a.id < b.id ? -1 : 1));
      const to = others[0];
      return { ...base, to: to.id, toName: to.name, toUid: `${to.id}:leader`, target: span(to.at), where: where(run, to.at.wx, to.at.wy) };
    }
    case "readFloor": {
      // Another village's mosaic (its first event's Flat Account), one this village doesn't show itself.
      const others = [...run.sites.values()].filter((s) => s.kind === "village" && s.id !== site.id && cheb(s.at, site.at) <= 10)
        .sort((a, b) => cheb(a.at, site.at) - cheb(b.at, site.at) || (a.id < b.id ? -1 : 1));
      for (const o of others) {
        const art = villageArt(run, o);
        const e = art.find((x) => !v.history.includes(x));
        if (e) return { ...base, secret: `hist:${e}:flat`, place: o.name, target: span(o.at), where: where(run, o.at.wx, o.at.wy) };
      }
      return null;
    }
    case "pray": {
      const sh = VILLAGES.shrines[v.culture.shrine];
      return { ...base, shrine: v.culture.shrine, view: sh.view, target: span(site.at), place: v.name, where: `at ${v.name}` };
    }
    case "climb":
      return { ...base, thing: rng.pick(T.things), itemUid: `${id}:thing`, target: span(site.at), place: v.name, where: `on the green at ${v.name}` };
    case "find": {
      const spans = outward(run, site).filter((t) => !run.sitesAt?.has(`${t.wx},${t.wy}`));
      if (!spans.length) return null;
      const t = rng.pick(spans);
      return { ...base, target: span(t), where: where(run, t.wx, t.wy) };
    }
    case "hunt": {
      const spans = outward(run, site);
      if (!spans.length) return null;
      const t = rng.pick(spans);
      return { ...base, beast: rng.pick(T.beasts), beastUid: `${id}:beast`, beastLevel: Math.max(1, v.level + 1), target: span(t), where: where(run, t.wx, t.wy) };
    }
    case "rescue": {
      const spans = outward(run, site);
      if (!spans.length) return null;
      const t = rng.pick(spans);
      const names = VILLAGES.names[VILLAGES.peoples[v.people]?.names] || VILLAGES.names.bent;
      return { ...base, lost: rng.pick(names), lostUid: `${id}:lost`, target: span(t), where: where(run, t.wx, t.wy) };
    }
    case "chart": {
      const dens = [...run.sites.values()].filter((s) => s.dungeon && s.kind !== "landmark" && cheb(s.at, site.at) <= 6)
        .sort((a, b) => cheb(a.at, site.at) - cheb(b.at, site.at) || (a.id < b.id ? -1 : 1));
      if (!dens.length) return null;
      const d = dens[0];
      return { ...base, place: `${d.name}, level 1`, target: span(d.at, 1), percent: 60, where: where(run, d.at.wx, d.at.wy) };
    }
    default: return null;
  }
}

