// The legacy fixture site: the parent game (The Rotation Cube) as one site under world tile (0, 0).
// Its surface is the Temple of Angles (content/world/temple.js, stamped by the surface generator as
// the test world's start landmark) and below it lies the 20-level stack (gen/dungeon.js legacyParams),
// so the old game keeps playing while the world is built around it. DECISIONS.md: the test world keeps
// this site at (0, 0); in the real world it becomes the Keeper's Stair under Hollowmere.
// world/zonegen.js asks legacyZone for the levels when a site's dungeon is the legacy one.
import { generateDungeonLevel, legacyParams, LEGACY_LEVELS } from "../gen/dungeon.js";

export const LEGACY_SITE = { id: "legacy", wx: 0, wy: 0, levels: LEGACY_LEVELS };
// On a world other than the test world the parent's people live up top (bible §3, "the original people return as
// residents": Mira, Sir Corwin, Brann, Ess and Tee at Hollowmere, Rook at Molar, Lio in the Square; story/
// landmark-people.js), so the Keeper's Stair keeps none of them, nor what came with them (Brann's skull, Rook's quarry,
// Lio's cell), and its peddler is a peddler, not Pell, who walks his round up top (the integrator, C5 #3). The test
// world's stack stays the parent's, level for level.
export const RESIDENTS = ["corwin", "ess", "tee", "brann", "mira", "rook", "lio"];
export const isLegacy = (zone) => zone?.siteId === LEGACY_SITE.id;

// (game, { wx, wy, z }, site) → legacy level z (1..20), or null. Every level is generated from the run's seed
// exactly as the parent game did (levels 2-20 block for block). The surface (z = 0) is not here. With the
// site whose dungeon is the legacy one (zonegen.js), wherever the world puts it (the real world's Keeper's
// Stair at (5, 16)); without, only under LEGACY_SITE's tile.
export function legacyZone(game, { wx, wy, z }, site = null) {
  const here = site?.dungeon?.legacy || (wx === LEGACY_SITE.wx && wy === LEGACY_SITE.wy);
  if (!here || z < 1 || z > LEGACY_LEVELS) return null;
  const real = !!game.run?.world && game.run.world.id !== "test", p = legacyParams(z, game.seed);
  if (real) p.encounters = p.encounters.filter((e) => !RESIDENTS.includes(e.npc) && e.item !== "skull");
  const zone = generateDungeonLevel(game.seed, p);
  if (real) for (const c of zone.creatures) if (c.type === "pell") { c.name = "a peddler"; c.talk.dialogue = "merchant"; }
  zone.siteId = LEGACY_SITE.id;
  return zone;
}
