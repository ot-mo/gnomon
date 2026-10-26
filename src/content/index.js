// Every content file (TECH_DESIGN §1.1 "content/index.js (P0) imports every content file", §2.18). main.js and
// tools/node-env.mjs import it after game.js; a content file that registers something (creatures.js
// registerCreatures, factions.js registerFaction, …) does it when it loads, so this list is how the game finds
// them. The Phase 1 files are listed from 0D2 as stubs that register nothing (owners in TECH_DESIGN §8.4), so
// this file needs no edit when a workstream or a content phase fills one in.
//
// The legacy files come first, in the order game.js already loads them (their bus handlers' order matters:
// story-hooks last).
import "./currency.js";
import "./world/terrains.js";
import "./world/worldmap.js";
import "./world/test-world.js";
import "./world/temple.js";
import "./items/legacy.js";
import "./creatures/legacy.js";
import "./legacy/encounters.js";
import "./legacy/story-hooks.js";
import "./encounters.js";             // WS1
import "./biomes.js";                 // WS2
import "./creatures/wildlife.js";      // WS2
import "./moods.js";                  // WS3
import "./genotypes.js";              // WS4
import "./backgrounds.js";            // WS4
import "./mutations.js";              // WS4
import "./powers.js";                 // WS4
import "./items/artifacts.js";        // WS5
import "./items/implants.js";         // WS5
import "./factions.js";               // WS6a
import "./liquids.js";                // WS6b
import "./items/containers.js";       // WS6b
import "./grammar.js";                // WS7
import "./quests.js";                 // WS7
import "./villages.js";               // WS7
import "./creatures/villagers.js";    // WS7
import "./items/missiles.js";         // WS8
import "./dungeons.js";               // WS10
import "./creatures/legends.js";      // WS10
