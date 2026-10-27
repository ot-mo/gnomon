// Dialogue builders (TECH_DESIGN §8.3 "WS6a"; owner WS6a): the villager, priest, guard, wanderer and merchant
// conversations, registered with talk.js registerDialogue under those ids, so a talker of any faction (WS7's
// villagers, C's people) needs only c.talk.dialogue = "villager" (and so on) and a membership. The legacy people
// keep their own dialogues (content/legacy/encounters.js).
//
//   ROLES                       ["villager", "priest", "guard", "wanderer", "merchant"]
//   buildDialogue(role)         (game, c, { first }) → node: what registerDialogue holds for each role
//   standingOf(game, c) → { faction, def, band, name, attitude }   the talker's main faction (its heaviest
//                               membership, or null) and how it and its faction see you
//   checkNode(node, path) → [problem]       one node against the contract (talk.js: { text, options: [{ label,
//                               go }] }; text a non-empty string, at least one option, labels non-empty strings,
//                               go functions)
//   walkDialogue(game, c, { depth = 4, max = 60 }) → { nodes, problems }   talkTo, then every option's go()
//                               down to `depth`: each answer must be a node, null (the talk ends) or { shop: tab }
//
// What a talker says follows how it feels about you (factions.js attitude) and its faction's band: Dark, or a
// fighter out for you → a short refusal and goodbye; Cold, or wary of you (a grudge, or a talker who can't fight
// where a fighter would be hostile) → curt, and a merchant won't trade; Grey → plain;
// Warm → glad of you; Bright → you are one of theirs. Every role can be asked who it is, about its faction (its
// likes and hates, with the bible's reasons) and where you stand with them. Greetings are at most two lines
// (bible §2.1), in the plain register.
import { node, bye, talkTo, registerDialogue } from "../talk.js";
import { FACTIONS, membershipsOf, repOf, band, BAND_NAMES, attitude } from "../factions.js";
import { typeOf } from "../creatures.js";

export const ROLES = ["villager", "priest", "guard", "wanderer", "merchant"];

export function standingOf(game, c) {
  const [main] = membershipsOf(c).sort((a, b) => b[1] - a[1]);
  const id = main?.[0] ?? null, def = id ? FACTIONS[id] : null;
  const b = id ? band(repOf(game, id)) : "indifferent";
  return { faction: id, def, band: b, name: BAND_NAMES[b], attitude: attitude(game, c, game.player) };
}

// --- What they say --------------------------------------------------------------------------------------------
export const GREET = {
  villager: {
    disliked: "You again. Say it quickly.",
    indifferent: "Mind the salt on the step. It gets everywhere.",
    liked: "Oh, it's you. Sit down if you like, the bench is dry.",
    loved: "There you are. We kept your place by the lamp.",
  },
  priest: {
    disliked: "The door is open to everyone. Some of everyone should use it to leave.",
    indifferent: "Peace on your shadow, whichever way it falls.",
    liked: "Welcome back. Your name was said here, kindly.",
    loved: "Kin. Come in out of the glare and be counted with us.",
  },
  guard: {
    disliked: "Keep your hands where I can see them, and keep walking.",
    indifferent: "Halt. Business? Fine. Go on.",
    liked: "You. Good. The road's been quiet, more or less.",
    loved: "Stand easy, friend. Nobody here will trouble you.",
  },
  wanderer: {
    disliked: "I don't want company. Least of all yours.",
    indifferent: "Long road. Longer shadows. What do you want?",
    liked: "Well met. I was hoping for someone who listens.",
    loved: "Of all the people on this road. Sit, share the shade.",
  },
  merchant: {
    disliked: "I'm closed. To you, I'm closed.",
    indifferent: "Glim on the table and we'll talk.",
    liked: "Ah, a good customer. I put something aside.",
    loved: "For you, the back shelf. The good stock lives there.",
  },
};
const REFUSE = {
  villager: "Get away from me.",
  priest: "Not here. Not you. Go.",
  guard: "One more step and you answer for it.",
  wanderer: "Walk on. I'm not talking to you.",
  merchant: "Nothing for sale. Not to you.",
};
const WHO = {
  villager: (n, f) => `${n}. I live here${f ? `, with ${f}` : ""}. Reeds, salt, the usual.`,
  priest: (n, f) => `${n}. I keep the lamps and say the hours${f ? ` for ${f}` : ""}.`,
  guard: (n, f) => `${n}. I watch the road${f ? ` for ${f}` : ""}. That's the whole job.`,
  wanderer: (n) => `${n}. I walk. The road is long and I'm not finished with it.`,
  merchant: (n, f) => `${n}. I buy cheap and sell dear${f ? `, and ${f} take their share` : ""}.`,
};
// Something each role has to say besides (the second option of the root, after "Who are you?").
const ASIDE = {
  villager: ["What's it like here?", ["The eels come up at dusk and the gossip at noon. Both bite.",
    "Quiet. We like it quiet. Last time it was loud, a wall fell down.",
    "The shadows are short at noon, and so is everyone's patience."]],
  priest: ["What do you keep here?", ["Lamps, mostly. And the count of who passed through, and in which light.",
    "A short shadow at noon, and a long memory after.",
    "The words we were given. From above they are a single line."]],
  guard: ["Any trouble on the road?", ["Rustbacks in the hills again. They took a lamp and left the post.",
    "Nothing I couldn't handle. Nothing I'd want twice.",
    "A Kite circled the post all morning. Counting us, I think."]],
  wanderer: ["Any news?", ["They say the noon is longer this year. The Survey measured it twice and didn't like either answer.",
    "A caravan lost a longback at the ford. The Drovers are blaming the Clatter, the Clatter are blaming the ford.",
    "There's a stele on the Flats with three accounts of the same day. None of them agree."]],
  merchant: ["How's trade?", ["Glim is dear and the roads are long. So, as ever.",
    "The Chandlers raised the oil again. I raised everything else.",
    "Good, until you asked."]],
};
const pick = (c, list) => list[Math.abs(c.id | 0) % list.length];

function aboutFaction(def) {
  const named = (list) => list.map(([id, why]) => (FACTIONS[id] ? FACTIONS[id].name + (why ? ` (${why})` : "") : null)).filter(Boolean);
  const likes = [...named(def.likes || []), ...(def.likesToo || [])], hates = [...named(def.hates || []), ...(def.hatesToo || [])];
  let s = def.about || def.name;
  if (likes.length) s += ` We get on with ${list(likes)}.`;
  if (hates.length) s += ` We don't forgive ${list(hates)}.`;
  return s;
}
const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

const STANDING = {
  hated: "Dark. Nobody here would pour you a cup.",
  disliked: "Cold. People remember what you did.",
  indifferent: "Grey. Nobody's made up their mind about you.",
  liked: "Warm. Folk speak well of you.",
  loved: "Bright. You're one of us, as far as anyone's concerned.",
};

export function buildDialogue(role) {
  return function say(game, c, { first } = {}) {
    const st = standingOf(game, c);
    const name = c.name || typeOf(c)?.name || "Nobody";
    const fname = st.def?.name ?? null;
    if (st.band === "hated" || st.attitude === "hostile") return node(REFUSE[role], [bye("Leave.")]);
    const curt = st.band === "disliked" || st.attitude === "wary";
    const back = { label: "Back.", go: () => talkTo(game, c) };
    const options = [
      { label: "Who are you?", go: () => node(WHO[role](name, fname), [back, bye()]) },
      { label: ASIDE[role][0], go: () => node(pick(c, ASIDE[role][1]), [back, bye()]) },
    ];
    if (st.def) {
      options.push({ label: `Tell me about ${st.def.name}.`, go: () => node(aboutFaction(st.def), [back, bye()]) });
      options.push({ label: "How do your people see me?", go: () => node(STANDING[st.band], [back, bye()]) });
    }
    if (role === "merchant") options.unshift({ label: "Show me what you have.", go: () => shopOf(game, c, curt, back) });
    const greet = GREET[role][curt ? "disliked" : st.band] ?? GREET[role].indifferent;
    return node(first && st.band === "indifferent" ? `${greet} New face.` : greet, [...options, bye()]);
  };
}

// A merchant's pack: the parent's shop screen while its stock is in talk.state (WS6b's trade screen takes over).
function shopOf(game, c, curt, back) {
  if (curt) return node("Not for you. Find someone who doesn't know your face.", [back, bye()]);
  return c.talk.state?.stock?.length ? { shop: "buy" } : node("The pack's empty. The road ate it.", [back, bye()]);
}

for (const role of ROLES) registerDialogue(role, buildDialogue(role));

// --- Checking nodes ---------------------------------------------------------------------------------------------
export function checkNode(n, path = "root") {
  const out = [];
  if (!n || typeof n !== "object") return [`${path}: not a node (${JSON.stringify(n)})`];
  if (typeof n.text !== "string" || !n.text.trim()) out.push(`${path}: no text`);
  if (!Array.isArray(n.options) || !n.options.length) out.push(`${path}: no options`);
  else n.options.forEach((o, k) => {
    if (typeof o?.label !== "string" || !o.label.trim()) out.push(`${path}.${k}: no label`);
    if (typeof o?.go !== "function") out.push(`${path}.${k}: go isn't a function`);
  });
  return out;
}

export function walkDialogue(game, c, { depth = 4, max = 60 } = {}) {
  const problems = [];
  let nodes = 0;
  const visit = (n, path, d) => {
    if (++nodes > max) return;
    const bad = checkNode(n, path);
    problems.push(...bad);
    if (bad.length || d >= depth) return;
    n.options.forEach((o, k) => {
      let next;
      try { next = o.go(); } catch (err) { problems.push(`${path}.${k} "${o.label}": go() threw ${err.message}`); return; }
      if (next === null || next === undefined) return;
      if (next.shop) { if (!["buy", "sell", "services"].includes(next.shop)) problems.push(`${path}.${k}: shop tab ${next.shop}`); return; }
      visit(next, `${path}.${k}`, d + 1);
    });
  };
  let root;
  try { root = talkTo(game, c); } catch (err) { return { nodes: 0, problems: [`talkTo threw ${err.message}`] }; }
  visit(root, "root", 0);
  return { nodes, problems };
}
