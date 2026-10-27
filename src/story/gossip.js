// Gossip (TECH_DESIGN §2.14 "gossip" secrets, §8.3 "WS7"; §1.4 "story (WS7)"; owner WS7): rumours from the run's
// history (secrets.js makes them: what a site holds, where a relic waits, an Hour's age, an old grudge).
//
//   gossipFor(game, c) → text | null     the rumour this talker would tell now, or null: only talkers that gossip
//                                        (their own or their type's talk.gossip; 7b's villagers), and only one you
//                                        haven't heard; the same talker tells the same one all day
//   gossipDef(game, c) → SecretDef | null   the same, as the secret
// Registered as the talk option "gossip" ("Heard anything lately?"): telling it files it in the journal.
import { registerTalkOptions, node, bye } from "../talk.js";
import { typeOf } from "../creatures.js";
import { hash } from "../rng.js";
import { secretsOf, learnSecret } from "./secrets.js";
import { knows } from "./journal.js";

const DAY = 24 * 60;   // a world day in game seconds (a world hour is 60 s)
export const gossips = (c) => !!(c?.talk?.gossip ?? (c?.type && typeOf(c)?.talk?.gossip));

export function gossipDef(game, c) {
  if (!gossips(c) || !game.run) return null;
  const all = [...secretsOf(game.run).values()].filter((d) => d.kind === "gossip" && !knows(game, d.id));
  if (!all.length) return null;
  const mine = all.filter((d) => c.faction && d.tags.includes(c.faction));
  const pool = mine.length ? mine : all;
  const who = typeof c.uid === "string" ? [...c.uid].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7) : c.id | 0;
  return pool[Math.floor(hash(who, Math.floor((game.time || 0) / DAY), 17) * pool.length)];
}

export function gossipFor(game, c) {
  return gossipDef(game, c)?.text ?? null;
}

registerTalkOptions("gossip", (game, c) => {
  const d = gossipDef(game, c);
  if (!d) return null;
  return [{ label: "Heard anything lately?", go: () => {
    learnSecret(game, d.id, "talk");
    return node(d.text, [bye("I'll keep it in mind.")]);
  } }];
});
