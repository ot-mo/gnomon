// The legacy fixture site: the parent game (The Rotation Cube) as one site under world tile (0, 0).
// Its surface is the Temple of Angles (content/world/temple.js, stamped by the surface generator as
// the test world's start landmark) and below it lies the 20-level stack (gen/dungeon.js legacyParams),
// so the old game keeps playing while the world is built around it. DECISIONS.md: the test world keeps
// this site at (0, 0); in the real world it becomes the Keeper's Stair under Hollowmere.
// world/zonegen.js asks legacyZone for the levels when a site's dungeon is the legacy one.
import { generateDungeonLevel, legacyParams, LEGACY_LEVELS } from "../gen/dungeon.js";

export const LEGACY_SITE = { id: "legacy", wx: 0, wy: 0, levels: LEGACY_LEVELS };
export const isLegacy = (zone) => zone?.siteId === LEGACY_SITE.id;

// (game, { wx, wy, z }) → legacy level z (1..20), or null. Every level is generated from the run's seed
// exactly as the parent game did (levels 2-20 block for block). The surface (z = 0) is not here.
export function legacyZone(game, { wx, wy, z }) {
  if (wx !== LEGACY_SITE.wx || wy !== LEGACY_SITE.wy || z < 1 || z > LEGACY_LEVELS) return null;
  const zone = generateDungeonLevel(game.seed, legacyParams(z, game.seed));
  zone.siteId = LEGACY_SITE.id;
  return zone;
}
