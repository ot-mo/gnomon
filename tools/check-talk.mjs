// Talk, services and quests: the dialogue and talk-option registries, Pell's services against the parent's
// list, quest templates on the bus (see tests/checks/talk.js). The encounters themselves: check-bot.
//   node tools/check-talk.mjs
import { installNodeEnv } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const { game, startRun } = await import("../src/game.js");
const mods = {
  creatures: await import("../src/creatures.js"), talk: await import("../src/talk.js"), quests: await import("../src/story/quests.js"),
  items: await import("../src/items.js"), body: await import("../src/body.js"), events: await import("../src/events.js"),
  currency: await import("../src/currency.js"),
};
const { checkTalk } = await import("../tests/checks/talk.js");
process.exit(report(checkTalk({ game, startRun, ...mods })));
