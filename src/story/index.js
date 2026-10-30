// Knowledge: history, villages, quests, secrets, journal (WS7; TECH_DESIGN §8.3 "WS7"). src/features.js imports
// this file; it registers everything WS7 adds (quest templates, secrets on the bus, gossip talk options, the
// village site builder, campaign hooks).
//
//   generateHistory(seed, world) → History           history.js (the fixture on the test world, the Hours elsewhere)
//   generateVillage(run, site) → Village             villages.js (P0: the fixture record, §2.16; 7b)
//   startQuest(game, templateId, params) → quest     quests.js (the bus-driven templates of 0C, §2.13)
//   learnSecret(game, id, source)                    secrets.js (and makeSecrets, readings, markSold)
//   gossipFor(game, c) → text                        gossip.js (registers the talk option "gossip")
//   expand(grammar, symbol, rng, ctx)                grammar.js
//
// What loading registers (7a): the quest template "visit" (secrets.js); the `inspect` handler that reads murals and
// the map describer "murals" (murals.js); the talk option "gossip" (gossip.js). history.js and villages.js run
// inside buildRun (world/run.js), quests.js inside the game since 0C; the screens journal and story are
// screens/journal.js and screens/story.js (screens/index.js imports every screen).
import "./journal.js";
import "./campaign.js";
import "./secrets.js";
import "./murals.js";
import "./gossip.js";
import "../content/creatures/villagers.js";
import { registerSiteBuilder } from "../world/sites.js";
import { buildVillage } from "./village-site.js";
import "./villagequests.js";
import "./landmark-people.js";   // who stands on the landmark plans' letters (C5 #3)
import "./beats.js";   // a beat's reward and choice, the campaign's things (C5 #5, #6, #13)
import "./barks.js";   // the barks of those who don't talk (C5 #11)
import "./dungeon-people.js";   // who stands in the landmark dungeons (C5 #12)
export { generateHistory } from "./history.js";
export { generateVillage } from "./villages.js";
export { startQuest } from "./quests.js";
export { learnSecret, makeSecrets, readings, markSold } from "./secrets.js";
export { gossipFor } from "./gossip.js";
export { expand } from "./grammar.js";

registerSiteBuilder("village", buildVillage);   // (here, not in village-site.js: world/run.js imports villages.js early)
