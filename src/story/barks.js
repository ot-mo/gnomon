// Barks (the integrator, C5 #11; content/people-words.js PEOPLE_WORDS[id].bark): the line a creature that doesn't talk
// says as it wakes or first sees you, once (c.barked, kept by a save).
//
//   barkOf(c) → line | null   by c.who (a placed one's: the landmark dungeons' bottoms, B2's, set it: the Grub Mother,
//                             the Press-Master), else by its type (gloamWarden, escapement, drownedBellwether, vesper,
//                             plumbknight, assizeEngineer once there is one)
// When: "creature:notice" (ai.js: a monster notices you) and "guardian:wake" (guardians.js).
import { on } from "../events.js";
import { PEOPLE_WORDS } from "../content/people-words.js";
import { registerCreatureField } from "../save/codec.js";

export const barkOf = (c) => PEOPLE_WORDS[c?.who]?.bark || PEOPLE_WORDS[c?.type]?.bark || null;

function bark(game, c) {
  const line = barkOf(c);
  if (!line || c.barked) return;
  c.barked = true;
  game.log?.(line, c.color || [230, 230, 230]);
}
on("creature:notice", (game, { c }) => bark(game, c));
on("guardian:wake", (game, { c }) => bark(game, c));
registerCreatureField("barked");
