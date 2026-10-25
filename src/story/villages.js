// Village data for a run (TECH_DESIGN §2.16). Made in buildRun, because gossip and secrets need it
// before you arrive; the layout is stamped later, when the zone is generated (SITE_BUILDERS.village, WS7).
//
//   makeVillages(run) → Map<siteId, Village>
//   Village = { id, siteId, name, factionId /* "village:<siteId>" */, culture: { sacredLiquid, sacred, profane, dish, style,
//               phonemes }, history: [eventId], roles: [{ role, uid, name, creatureType, dialogue }], merchantTable,
//               quest: { template, params } | null, layout: { style, buildings: [planId], murals: [eventId] }, checkpoint: true }
//
// P0 stub: one record per village site with the site's name and empty culture, roles and layout. WS7
// replaces it with the generator (drawing from runRng(run, "villages") only).
import { countGen } from "../world/genstats.js";

export function makeVillages(run) {
  countGen("villages");
  const out = new Map();
  for (const site of run.sites.values()) {
    if (site.kind !== "village") continue;
    out.set(site.id, {
      id: site.id, siteId: site.id, name: site.name, factionId: `village:${site.id}`,
      culture: { sacredLiquid: null, sacred: null, profane: null, dish: null, style: "fixture", phonemes: null },
      history: [], roles: [], merchantTable: null, quest: null,
      layout: { style: "fixture", buildings: [], murals: [] }, checkpoint: true,
    });
  }
  return out;
}
