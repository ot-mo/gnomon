// Knowledge: history, villages, quests, secrets, journal (WS7; TECH_DESIGN §8.3 "WS7"). src/features.js imports
// this file; it registers everything WS7 adds (quest templates, secrets on the bus, gossip talk options, the
// village site builder, campaign hooks).
//
//   generateHistory(seed, world) → History           history.js (P0: the fixture History, §2.15)
//   generateVillage(run, site) → Village             villages.js (P0: the fixture record, §2.16)
//   startQuest(game, templateId, params) → quest     quests.js (P0: the bus-driven templates of 0C, §2.13)
//   learnSecret(game, id, source)                    secrets.js
//   gossipFor(game, c) → text                        gossip.js
//   expand(grammar, symbol, rng, ctx)                grammar.js
//
// history.js and villages.js run inside buildRun (world/run.js), quests.js inside the game since 0C; the
// screens journal and story are P0's ports (screens/index.js imports every screen).
// P0: registers nothing new, so the game plays as before. Remove STUB when WS7 registers its parts here.
import "./journal.js";
import "./campaign.js";
export { generateHistory } from "./history.js";
export { generateVillage } from "./villages.js";
export { startQuest } from "./quests.js";
export { learnSecret } from "./secrets.js";
export { gossipFor } from "./gossip.js";
export { expand } from "./grammar.js";
export const STUB = "WS7";
