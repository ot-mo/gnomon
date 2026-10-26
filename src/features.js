// The Phase 1 features (TECH_DESIGN §1.1, §8.4): one import per workstream index. Each index registers
// everything its workstream adds (screens, keys, HUD segments, bus handlers, updates, registries), so this file
// is never edited after P0. main.js imports it after game.js and content/index.js; tools/node-env.mjs does the
// same, so the checks play the game the browser plays.
//
// In P0 every index is a stub that registers nothing new (check-imports holds them to it), so the game plays as
// before. WS2, WS3, WS8 and WS10 have no folder: their files are ones the game already loads (gen/surface.js
// through world/zonegen.js, the renderers, combat.js, ai.js, turns.js, gen/dungeon.js through game.js), so
// they register from those, and their content through content/index.js.
import "./overworld/index.js";     // WS1   overworld travel
import "./progression/index.js";   // WS4   character creation and progression
import "./bodymods/index.js";      // WS5   body mods, items and equipment
import "./social/index.js";        // WS6a  factions, reputation, dialogue builders; WS6b trade, the Kindling
import "./story/index.js";         // WS7   history, villages, quests, secrets, journal
import "./save/index.js";          // WS9   persistence (game.js loads it too, for the write-behind)
