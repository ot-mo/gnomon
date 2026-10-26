// Wildlife (TECH_DESIGN §2.18 content/creatures/*.js; WS2, then C3): the surface's creatures, in the creature
// table shape { [type]: { name, glyph, color, frames | art, palette, w, h, levels: [lo, hi], weight, regions,
// tags, factions, temperament, attrs?, hp, speed, dv, av, attack: { dmg, cooldown, reach }, … } } (no `pv`:
// DECISIONS §1, d20 combat). Glyphs follow bible §15.7 (check-creatures). WS2 registers it with
// creatures.js registerCreatures.
// P0: empty and not registered. Remove STUB when the table has data.
export const STUB = "WS2";
export const WILDLIFE = {};
