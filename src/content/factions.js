// Factions (TECH_DESIGN §2.11 FactionDef: { id, name, color, temperament, startRep, homeRegions, members,
// likes, hates, relations: { [otherId]: -1 | 0 | 1 }, sacred, voice, secrets: { buys, sells }, merchantTable,
// flat? }; §2.18; WS6a, then C2). WS6a registers each with factions.js registerFaction.
// P0: empty and not registered, so monsters stay hostile and people neutral (factions.js). Remove STUB when
// the table has data.
export const STUB = "WS6a";
export const FACTIONS = {};
