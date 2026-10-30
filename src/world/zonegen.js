// Where zones come from (TECH_DESIGN §2.2, §5.3-5.5): the run's world, its sites and the generators.
// Importing this module registers both ZONE_GENERATORS and the apron's builder (zones.js).
//
//   surface  "wx,wy,0": gen/surface.js generateSurface(game.run, wx, wy), for every span you can be in
//            (a span whose edges are shut, the sea, has no zone); ZONE_STAGED.surface is the same in
//            stages (surfaceSteps), for 3D prefetch
//   dungeon  "wx,wy,z", z ≥ 1: the dungeon under the span's site. The legacy stack (the test world's
//            temple, DECISIONS.md) is world/legacy.js legacyZone; any other site's level z is
//            generateDungeonLevel(zoneSeed(run, wx, wy, z), dungeonParams(run, site, z)).
//
//   apron    APRON_BUILDERS.surface = gen/surface.js buildApronBand (the neighbour's blocks, or the world
//            functions); APRON_STEPS.surface = gen/apron.js apronBandSteps (a neighbour read from the save)
//
//   siteWithDungeon(run, wx, wy) → Site | null    the span's site that has a dungeon below it
//   dungeonParams(run, site, z) → p               generateDungeonLevel's parameters for its level z
import { ZONE_GENERATORS, ZONE_STAGED, APRON_BUILDERS, APRON_STEPS } from "../zones.js";
import { apronBandSteps } from "../gen/apron.js";
import { generateSurface, surfaceSteps, buildApronBand } from "../gen/surface.js";
import { generateDungeonLevel } from "../gen/dungeon.js";
import { legacyZone } from "./legacy.js";
import { zoneSeed } from "./run.js";
import { realWorld } from "../items.js";
import { siteWithDungeon, dungeonParams } from "./sites.js";

export { siteWithDungeon, dungeonParams };   // they live in sites.js (gen/surface.js needs them too)

function surfaceZone(game, { wx, wy }) {
  const run = game.run, t = run?.world.tileAt(wx, wy);
  if (!t || (t.edges !== "open" && !t.landmark)) return null;
  return generateSurface(run, wx, wy);
}
// The same in stages (3D prefetch spreads it over frames, zones.js prefetchNeighbours).
function* surfaceStaged(game, { wx, wy }) {
  const run = game.run, t = run?.world.tileAt(wx, wy);
  if (!t || (t.edges !== "open" && !t.landmark)) return null;
  return yield* surfaceSteps(run, wx, wy);
}

function dungeonZone(game, { wx, wy, z }) {
  const run = game.run;
  if (!run) return null;
  const site = siteWithDungeon(run, wx, wy);
  if (!site || z < 1 || z > site.dungeon.levels) return null;
  if (site.dungeon.legacy) return legacyZone(game, { wx, wy, z }, site);
  const zone = generateDungeonLevel(zoneSeed(run, wx, wy, z), { ...dungeonParams(run, site, z), realLoot: realWorld(run) });   // (B1, C4 #1)
  zone.siteId = site.id;
  zone.landmarkId = site.landmarkId || null;
  return zone;
}

ZONE_GENERATORS.surface = surfaceZone;
ZONE_STAGED.surface = surfaceStaged;
ZONE_GENERATORS.dungeon = dungeonZone;
APRON_BUILDERS.surface = buildApronBand;
APRON_STEPS.surface = apronBandSteps;   // (a neighbour read from the save: its far bands, one a frame)
