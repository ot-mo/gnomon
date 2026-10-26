// Travel encounters (TECH_DESIGN §5.2 "Encounters"; WS1). A P0 stub: the design names no function here, so
// nothing is frozen; WS1 chooses the exports.
//
// What it does: per world step, region.encounterRate × terrain.encounterMul × (night ? 1.5 : 1), rolled on
// content/encounters.js: a hostile band, travellers, a legendary wanderer (only when claimUid succeeds) or a
// hidden site (revealed and pinned). A band drops you into the span's zone, visited or not, placed by a zone
// patch relativeTo "arrival", 8-12 tiles away (zones.js addZonePatch). Resting rolls once per game hour at half
// the rate. Draws only from a seeded stream (rng.js), never Math.random.
// Remove STUB when the file is built.
export const STUB = "WS1";
