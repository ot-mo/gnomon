// Dungeon themes and gimmick weights (TECH_DESIGN §1.4 gen/dungeon.js DUNGEON_THEMES, GIMMICKS, §2.18; WS10,
// then C3): theme id → { rooms: [{ wall, floor }], darkRate(level), count(level), liquid, creatureTable,
// vaultPool }, and which gimmicks a site's levels draw. WS10 registers them into gen/dungeon.js's tables.
// P0: empty, and nothing reads it yet (the legacy themes live in gen/dungeon.js). Remove STUB when the table
// has data.
export const STUB = "WS10";
export const DUNGEONS = {};
