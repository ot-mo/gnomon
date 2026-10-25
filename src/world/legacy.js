// The legacy fixture site: the parent game (The Rotation Cube) as one site under world tile (0, 0).
// Its surface zone is the Temple of Angles (content/world/temple.js) and below it lies the 20-level
// stack (gen/dungeon.js legacyParams), so the old game keeps playing while the world is built
// around it. Until the world model arrives (0A2), these are the only zones there are; from 0A2 the
// test world keeps this site at (0, 0) (DECISIONS.md: in the real world it becomes the Keeper's
// Stair under Hollowmere).
import { ZONE_GENERATORS } from "../zones.js";
import { generateDungeonLevel, legacyParams, LEGACY_LEVELS } from "../gen/dungeon.js";
import { templeFixture } from "../content/world/temple.js";

export const LEGACY_SITE = { id: "legacy", wx: 0, wy: 0, levels: LEGACY_LEVELS };
export const isLegacy = (zone) => zone?.siteId === LEGACY_SITE.id;

// (game, { wx, wy, z }) → the site's zone at that address, or null. Every level is generated from
// the run's seed exactly as the parent game did (levels 2-20 block for block).
export function legacyZone(game, { wx, wy, z }) {
  if (wx !== LEGACY_SITE.wx || wy !== LEGACY_SITE.wy || z < 0 || z > LEGACY_LEVELS) return null;
  const zone = z === 0 ? templeFixture(game.seed) : generateDungeonLevel(game.seed, legacyParams(z, game.seed));
  zone.siteId = LEGACY_SITE.id;
  if (z === 0) zone.hasBelow = true;   // the stairs at the bottom of the shaft lead to level 1
  return zone;
}

ZONE_GENERATORS.surface = legacyZone;
ZONE_GENERATORS.dungeon = legacyZone;
