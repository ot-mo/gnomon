// Where zones come from (TECH_DESIGN §2.2, §5.3-5.5): the run's world, its sites and the generators.
// Importing this module registers both ZONE_GENERATORS (zones.js).
//
//   surface  "wx,wy,0": gen/surface.js generateSurface(game.run, wx, wy), for every span you can be in
//            (a span whose edges are shut, the sea, has no zone)
//   dungeon  "wx,wy,z", z ≥ 1: the dungeon under the span's site. The legacy stack (the test world's
//            temple, DECISIONS.md) is world/legacy.js legacyZone; any other site's level z is
//            generateDungeonLevel(zoneSeed(run, wx, wy, z), dungeonParams(run, site, z)).
//
//   siteWithDungeon(run, wx, wy) → Site | null    the span's site that has a dungeon below it
//   dungeonParams(run, site, z) → p               generateDungeonLevel's parameters for its level z
import { ZONE_GENERATORS } from "../zones.js";
import { generateSurface } from "../gen/surface.js";
import { generateDungeonLevel } from "../gen/dungeon.js";
import { legacyZone } from "./legacy.js";
import { zoneSeed } from "./run.js";
import { dungeonLevelOf } from "./sites.js";
import { tierOfLevel } from "./worldmodel.js";

export function siteWithDungeon(run, wx, wy) {
  for (const id of run.sitesAt.get(`${wx},${wy}`) || []) {
    const s = run.sites.get(id);
    if (s?.dungeon) return s;
  }
  return null;
}

// Level z of a site's dungeon (1-based): its level from the spec (DECISIONS.md: listed floors for a
// landmark, else the surface level + z), its theme, gimmicks and vaults, and on the last level its
// bottom (a guardian's hall, a boss's throne; "none" and the parts WS10 adds get an ordinary level).
export function dungeonParams(run, site, z) {
  const spec = site.dungeon, level = dungeonLevelOf(spec, z), final = z >= spec.levels;
  const bottom = final && (spec.bottom?.kind === "guardian" || spec.bottom?.kind === "boss") ? { kind: spec.bottom.kind, id: spec.bottom.id } : null;
  return {
    key: `${site.at.wx},${site.at.wy},${z}`, wx: site.at.wx, wy: site.at.wy, z, level, tier: tierOfLevel(level),
    index: z, count: spec.levels, final, theme: spec.theme || "legacy", hasUp: true, forcedVault: null,
    vaultPool: spec.vaultPool || null, gimmicks: [...(spec.gimmicks || [])], bottom, encounters: [],
    name: spec.named?.[z - 1] || `${site.name}, level ${z}`,
  };
}

function surfaceZone(game, { wx, wy }) {
  const run = game.run, t = run?.world.tileAt(wx, wy);
  if (!t || (t.edges !== "open" && !t.landmark)) return null;
  return generateSurface(run, wx, wy);
}

function dungeonZone(game, { wx, wy, z }) {
  const run = game.run;
  if (!run) return null;
  const site = siteWithDungeon(run, wx, wy);
  if (!site || z < 1 || z > site.dungeon.levels) return null;
  if (site.dungeon.legacy) return legacyZone(game, { wx, wy, z });
  const zone = generateDungeonLevel(zoneSeed(run, wx, wy, z), dungeonParams(run, site, z));
  zone.siteId = site.id;
  zone.landmarkId = site.landmarkId || null;
  return zone;
}

ZONE_GENERATORS.surface = surfaceZone;
ZONE_GENERATORS.dungeon = dungeonZone;
