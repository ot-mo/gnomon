// The Hour cults (bible §6.3, §7.7, §8.7, §12.13 "Hourbound"; C2 #6, WS7a #7; B3). Every Hour of the run's history has a
// cult: a generated faction made from content/factions.js HOUR_CULT by the run's factions step (world/run.js calls
// cultFaction for each ruler; run.factions keeps it, so a save does), registered with factions.js when you enter one
// of its Hour's sites (as a village's faction is), and the Horary like it back then (FACTIONS.horary.relations).
//   - the creatures of its sites' floors are its members (c.faction { cult: 1 }, given on entering a floor of the site);
//   - −500 to start, kept there in a Pilgrim run (pilgrimFloor: false); at +600 (passRep, Bright) they let you walk;
//   - with the cult pass (all three accounts of five of the Hour's events: game.state.journal.cultPass[rulerId],
//     story/secrets.js) they treat you as a pilgrim in its sites: neutral (social/holy.js's rule; its sites are its
//     holy places: social/places.js);
//   - the mask (HOUR_CULT.maskRep) is C4's worn item, read through worn reputation (C2 #12, not here).
// The Hourbound (bible §12.13): an Hour site's reliquary keeps the cult's leader, once a run: a creature of the floor's
// level + 3, ×2 health and ×10 experience, in the legends' magenta, named for its Hour, a member of the cult. A Deep
// Inscription is carved on its armour and a Dark Gloss cut on its back: look at it (L) in 3D in good light for the one,
// with your torch out in the dark for the other, and you learn that account of the Hour's event (story/secrets.js).
//
//   cultFaction(ruler) → FactionDef                   C2's recipe (docs/c2.md request 6), id `cult:<short>`
//   ensureCult(game, id) → FactionDef | null          registers it (once per page; a later run's replaces it)
//   cultOfSite(game, site) → id | null                the cult whose Hour's site this is
// State: game.state.cults = { leaders: { [uid]: "dead" } } (JSON).
import { FACTIONS, registerFaction, membershipsOf } from "../factions.js";
import { cultFaction } from "./cultdef.js";
import { on } from "../events.js";
import { B } from "../world.js";
import { spawnCreature, addCreature, pickCreatureType } from "../creatures.js";
import { makeRng, seedFor } from "../rng.js";
import { registerCreatureField } from "../save/codec.js";
import { readable } from "../story/murals.js";
import { learnSecret } from "../story/secrets.js";
import { knows } from "../story/journal.js";
import { cultIdOf } from "./places.js";

export { cultFaction };

export function ensureCult(game, id) {
  const def = game.run?.factions?.get?.(id);
  if (!def) return FACTIONS[id] || null;
  const have = FACTIONS[id];
  if (!have) registerFaction(id, JSON.parse(JSON.stringify(def)));
  else if (have.generated) { const { relations, ...rest } = def; Object.assign(have, JSON.parse(JSON.stringify(rest))); }
  if (FACTIONS.horary) FACTIONS.horary.relations[id] = 1;   // the Horary like the cults back (bible §15.4, likesToo)
  return FACTIONS[id];
}

export function cultOfSite(game, site) {
  return site?.historyRef?.rulerId ? cultIdOf(game.run, site.historyRef.rulerId) : null;
}

const cstate = (game) => (game.state.cults ||= { leaders: {} });
const altarOf = (zone) => {
  for (let i = 0; i < zone.w * zone.d; i++) {
    const x = i % zone.w, y = (i - x) / zone.w;
    for (let z = 0; z < zone.h; z++) if (zone.get(x, y, z) === B.ALTAR) return { x, y, z };
  }
  return null;
};

// On a floor of an Hour site: the cult registered, its creatures made members, and in the reliquary its leader.
on("zone:enter", (game, ev) => {
  const zone = ev.zone, site = zone?.siteId && game.run?.sites?.get(zone.siteId);
  const id = cultOfSite(game, site);
  if (!id || !game.state || !ensureCult(game, id)) return;
  for (const c of zone.creatures) if (c.hourbound) c.color = [235, 90, 235];   // (the legends' magenta: a load doesn't keep a colour)
  // Every creature of the floor joins (its own factions kept beside, at half: a goblin of the cult is still a goblin).
  for (const c of zone.creatures) if (!c.talk && !c.brain?.leader && !membershipsOf(c).some(([f]) => f === id))
    c.faction = { ...Object.fromEntries(membershipsOf(c).map(([f, w]) => [f, Math.min(0.5, w)])), [id]: 1 };
  if (!zone.bottomLoot || site.kind === "village") return;   // (the reliquary: the floor whose hall holds the relic's altar)
  const uid = `hourbound:${site.id}`, st = cstate(game);
  if (st.leaders[uid] === "dead" || zone.creatures.some((c) => c.uid === uid)) return;
  const at = altarOf(zone);
  if (!at) return;
  const R = game.run.history.rulers.find((r) => r.id === site.historyRef.rulerId);
  const rng = makeRng(seedFor(game.run.seed, "hourbound", site.id));
  const level = (zone.level || 1) + 3, type = pickCreatureType(rng, Math.min(20, level));
  const c = spawnCreature(type, at.x, Math.min(zone.d - 2, at.y + 2), at.z, { rng, level, uid, state: "idle",
    name: `the Hourbound of ${R?.name || "the Hour"}` });
  c.maxHp = c.hp = c.hp * 2;
  c.xp = (c.xp || 0) * 10;
  c.named = true;
  c.color = [235, 90, 235];
  c.faction = { [id]: 1 };
  c.hourbound = { rulerId: site.historyRef.rulerId, eventId: site.historyRef.eventId };
  addCreature(zone, c);
  st.leaders[uid] = "placed";
});
on("kill", (game, { c }) => { if (c?.hourbound && c.uid && game.state) cstate(game).leaders[c.uid] = "dead"; });

// Its armour and its back: L on it, in the right light.
on("inspect", (game, ev) => {
  if (!ev?.open || !game.run) return;
  const c = (ev.zone || game.zone)?.creatures?.find((m) => m.hourbound && m.tx === ev.x && m.ty === ev.y);
  if (!c) return;
  const { eventId } = c.hourbound;
  for (const [view, reading, where] of [["3d", "deep", "carved on its armour"], ["dark", "dark", "cut into its back"]]) {
    if (!readable(game, game.zone, { x: c.tx, y: c.ty, z: c.z + 1, view })) continue;
    const id = `hist:${eventId}:${reading}`;
    game.log(`Words ${where}.${knows(game, id) ? " You know them already." : ""}`, [230, 210, 150]);
    if (!knows(game, id)) learnSecret(game, id, "mural");
    return;
  }
  game.log("Something is written on it. In 3D, in good light, or in the dark with your torch out, it might read.", [170, 170, 185]);
});

registerCreatureField("hourbound");
