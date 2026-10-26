// Talking to people: the dialogue, talk-option and service registries (TECH_DESIGN §2.10, §4; P0, then
// WS6a). Content registers who says what; the talk screen (dialogue.js) only draws nodes and runs options.
//
//   registerDialogue(id, (game, c, { first }) => node)
//                        c.talk.dialogue names it. first: you hadn't met c before this conversation
//                        (talkTo has already set c.talk.met). Registering an id again replaces it.
//   registerTalkOptions(id, (game, c) => option[] | null, { priority = 0 })
//                        extra options on the root node of any talker (quests, gossip: WS7), higher
//                        priority first, put in before the root's closing "goodbye" options.
//   registerService(id, { label(game, c, target), price(game, c, target), available(game, c) → target[],
//                         run(game, c, target), info(game, c, target), glyph?(game, c, target),
//                         done?(game, c, target, price) → log line })
//                        something a merchant does for money (Pell's list; WS5 surgery, WS6b identification).
//   servicesFor(game, c) → [{ id, target }]   c.merchant.services (or its type's), each filtered by available()
//   talkTo(game, c) → node                     dispatches on c.talk.dialogue, then appends registered options
//   node(text, options), bye(label)           the node contract: { text, options: [{ label, go }] }; go()
//                                              returns the next node, null to end, or { shop: tab }
import { typeOf } from "./creatures.js";

export const node = (text, options) => ({ text, options });
export const bye = (label = "Goodbye.") => ({ label, go: () => null, bye: true });

const DIALOGUES = new Map();
const TALK_OPTIONS = new Map();   // id → { fn, priority, order }
const SERVICES = new Map();
let order = 0;

export function registerDialogue(id, fn) { DIALOGUES.set(id, fn); }
export function registerTalkOptions(id, fn, { priority = 0 } = {}) {
  TALK_OPTIONS.set(id, { fn, priority, order: TALK_OPTIONS.get(id)?.order ?? order++ });
}
export function registerService(id, def) {
  for (const k of ["label", "price", "available", "run"])
    if (typeof def[k] !== "function") throw new Error(`service ${id}: ${k} must be a function`);
  SERVICES.set(id, { id, ...def });
}
export const dialogueIds = () => [...DIALOGUES.keys()];
export const serviceDef = (id) => SERVICES.get(id) || null;

// A merchant's services, in the order its list names them; each target that's available now.
export function servicesFor(game, c) {
  const ids = c.merchant?.services ?? typeOf(c).merchant?.services ?? [];
  const out = [];
  for (const id of ids) {
    const s = SERVICES.get(id);
    if (s) for (const target of s.available(game, c) || []) out.push({ id, target });
  }
  return out;
}

export function talkTo(game, c) {
  const first = !c.talk.met;
  c.talk.met = true;
  const say = DIALOGUES.get(c.talk.dialogue);
  const root = say ? say(game, c, { first }) : node("...", [bye()]);
  if (!root || !TALK_OPTIONS.size) return root;
  const extra = [...TALK_OPTIONS.values()].sort((a, b) => b.priority - a.priority || a.order - b.order)
    .flatMap(({ fn }) => fn(game, c) || []);
  if (extra.length) {
    let k = root.options.length;
    while (k > 0 && root.options[k - 1].bye) k--;
    root.options.splice(k, 0, ...extra);
  }
  return root;
}
