// A beat's offer, reward and choice, and the campaign's own things (the integrator, C5 #5 and #6; bible §11; the data
// is content/quests.js QUESTS.campaign): what story/campaign.js's beats pay and ask once done.
//
//   campaignItem(id) → item | null   QUESTS.campaign.questItems as quest items (the Assize plumb-seal, the dark-pass, the
//                    Hour Hand, the Plumb Key); else C4's artifact (made, known), the parent's relic (Brann's Lantern), a
//                    tonic (a balm); null for one not made yet (ARTIFACTS_WAITING: the homing pip, the unpress lens, the
//                    Great Theodolite, the Noonglass), which is owed: campaign.owed, paid on a zone:enter once it can be
//   giveCampaignItems(game, items)   [[id, n]] into your pack (each one that can be made), the rest owed
//   payBeat(game, beat)   on "beat": its reward's items, maxHp (Maren's blessing: + max HP, healed by it), rep
//                    (factions.addRep "quest"; a range, beat 9's "by the survivors", pays its low end until the siege counts
//                    them: C5 #13), glim, reading (learnSecret) and face (campaign.faces; Noon's Face: screens/play.js)
//   choicesOpen(game) → [{ beat, choice }]   a done beat's choices not made yet, but those `byRoute` (recorded as the route
//                    happens: C5 #7, #8)
//   choose(game, beatId, choiceId, optionId) → option | null   pays it (rep, glim, items, reading) and records it:
//                    campaign.choices[beat][choice], campaign.alliance (beat 10), campaign.ambushes (beat 2's Seventh-
//                    Chimers: the world map's encounter table reads it once their band exists, a request)
//   isGiver(c, beat) → bool   the talker the beat's `giver` names: every word of it in the talker's name ("Surveyor-
//                    General Quint-Vey" is Surveyor-General Teodor Quint-Vey)
// Routes (C5 #13): a beat's `done` may list matchers, any one finishing it (story/campaign.js beatMatches); the routes'
// own events are "route" { id }. Beat 2's second: Detail C reads the Datum (its type's rule { reads: "datum", price }),
// for 300 glim, free at Plan Warm or better, while beat 2 is open: "datumRead".
// Talk: at a giver, while its beat is open, "What's wrong?" tells its offer; once done, each open choice ("About the
// Assize plumb-seal...") with its options. A beat with no giver (5, 7) asks on its own: once you're back in the world
// (explore or map) the talk screen opens with the beat as its speaker (registerUpdate "campaign:choice").
import { on, emit, registerUpdate } from "../events.js";
import { registerTalkOptions, registerDialogue, talkTo, node, bye } from "../talk.js";
import { openTalk } from "../dialogue.js";
import { QUESTS } from "../content/quests.js";
import { ARTIFACTS } from "../content/items/artifacts.js";
import { makeArtifact } from "../bodymods/artifacts.js";
import { RELICS, makeRelic } from "../content/items/legacy.js";
import { TONICS } from "../content/items/tonics.js";
import { addToInventory, itemName } from "../items.js";
import { receive } from "../currency.js";
import { learnSecret } from "./secrets.js";
import { campaignOf } from "./campaign.js";
import { questActive } from "./quests.js";
import { typeOf } from "../creatures.js";
import { pay } from "../currency.js";
import { standingOf } from "../social/builders.js";
import * as factions from "../factions.js";

const CAMPAIGN = QUESTS.campaign;
const beatOf = (id) => CAMPAIGN.beats.find((b) => b.id === id) || null;

export function campaignItem(id) {
  const q = CAMPAIGN.questItems[id];
  if (q) return { kind: "quest", id, name: q.name, info: q.info, campaign: true };
  if (ARTIFACTS[id]) return { ...makeArtifact(id), known: true };
  if (RELICS[id]) return makeRelic(id);
  if (TONICS[id]) return { kind: "tonic", effect: id };
  return null;
}

export function giveCampaignItems(game, items) {
  const C = campaignOf(game), p = game.player;
  for (const [id, n = 1] of items || []) {
    const it = campaignItem(id);
    if (!it || !p) { C.owed = [...(C.owed || []), [id, n]]; continue; }
    if (it.kind === "tonic") addToInventory(p, { ...it, count: n });
    else for (let k = 0; k < n; k++) addToInventory(p, { ...it });
    game.log?.(`You receive ${n > 1 ? `${n} × ` : ""}${itemName(game, it)}.`, [200, 220, 255]);
  }
}
// What was owed, once it can be made (an artifact registered since).
function payOwed(game) {
  const C = game.state?.campaign;
  if (!C?.owed?.length || !game.player) return;
  const now = C.owed.filter(([id]) => campaignItem(id)), later = C.owed.filter(([id]) => !campaignItem(id));
  if (!now.length) return;
  C.owed = later;
  giveCampaignItems(game, now);
}
on("zone:enter", (game) => payOwed(game));

const rangeLow = (v) => (Array.isArray(v) ? v[0] : v);
function payRep(game, rep) {
  for (const [id, n] of Object.entries(rep || {})) if (rangeLow(n)) factions.addRep(game, id, rangeLow(n), "quest");
}
function payGlim(game, n) {
  const p = game.player;
  if (!n || !p) return;
  const left = receive(game, p, n);
  game.log?.(`You receive ${n - left} glim.${left ? ` (${left} more won't fit in your purse.)` : ""}`, [255, 215, 90]);
}

export function payBeat(game, beat) {
  const r = beat?.reward, C = campaignOf(game), p = game.player;
  if (!r || C.paid?.[beat.id]) return;
  (C.paid ||= {})[beat.id] = game.time || 0;
  giveCampaignItems(game, r.items);
  if (r.maxHp && p) {
    p.maxHpGain = (p.maxHpGain || 0) + r.maxHp;
    p.hp += r.maxHp;
    game.log?.(`Your health rises by ${r.maxHp}, for good.`, [140, 230, 140]);
  }
  payRep(game, r.rep);
  payGlim(game, r.glim);
  if (r.reading) learnSecret(game, r.reading, "quest");
  if (r.face && !(C.faces ||= []).includes(r.face)) {
    C.faces.push(r.face);
    game.log?.(`The Cube has a sixth face now. ${r.text}`, [190, 220, 255]);
  }
  if (beat.choices?.some((c) => !c.byRoute) && !beat.giver) C.asking = beat.id;
}
on("beat", (game, { id }) => payBeat(game, beatOf(id)));

export function choicesOpen(game) {
  const C = campaignOf(game), out = [];
  for (const beat of CAMPAIGN.beats) {
    if (C.done[beat.id] === undefined) continue;
    for (const choice of beat.choices || []) if (!choice.byRoute && C.choices?.[beat.id]?.[choice.id] === undefined) out.push({ beat, choice });
  }
  return out;
}

export function choose(game, beatId, choiceId, optionId) {
  const beat = beatOf(beatId), choice = beat?.choices?.find((c) => c.id === choiceId), o = choice?.options.find((x) => x.id === optionId);
  const C = campaignOf(game);
  if (!o || C.done[beatId] === undefined || C.choices?.[beatId]?.[choiceId] !== undefined) return null;
  ((C.choices ||= {})[beatId] ||= {})[choiceId] = optionId;
  payRep(game, o.rep);
  payGlim(game, o.glim);
  giveCampaignItems(game, o.items);
  if (o.reading) learnSecret(game, o.reading, "quest");
  if (o.alliance) C.alliance = o.alliance;
  if (o.ambush && !(C.ambushes ||= []).includes(o.ambush)) C.ambushes.push(o.ambush);
  emit(game, "campaign:choice", { beat: beatId, choice: choiceId, option: optionId });
  return o;
}

const words = (s) => String(s || "").split(/\s+/).filter(Boolean);
export const isGiver = (c, beat) => !!beat?.giver && !!c?.name && words(beat.giver).every((w) => words(c.name).includes(w));

// The options of one choice, then back to where you were (`back`: the talker's root, or nothing for a beat's own page).
function choiceNode(game, { beat, choice }, back) {
  return node(`${beat.title}: ${choice.label}. What will you do?`, [
    ...choice.options.map((o) => ({ label: o.text, go: () => { choose(game, beat.id, choice.id, o.id); return back ? back() : null; } })),
    ...(back ? [{ label: "Not yet.", go: () => back() }] : []),
  ]);
}

registerTalkOptions("campaign", (game, c) => {
  if (!game.state?.campaign || !c?.name) return null;
  const out = [];
  for (const q of game.quests || []) {
    const beat = q.template === "beat" && !q.done && beatOf(q.id);
    if (beat?.offer && isGiver(c, beat)) out.push({ label: "What's wrong?", go: () => node(beat.offer, [{ label: "Back.", go: () => talkTo(game, c) }]) });
  }
  for (const open of choicesOpen(game)) {
    if (!isGiver(c, open.beat)) continue;
    out.push({ label: `About ${open.choice.label}...`, go: () => choiceNode(game, open, null) });
  }
  return out.length ? out : null;
});

// Beat 2's second route: Detail C's reading of the Datum.
registerTalkOptions("datum", (game, c) => {
  const rule = typeOf(c)?.rule;
  if (rule?.reads !== "datum" || !questActive(game, "beat2")) return null;
  const free = ["liked", "loved"].includes(standingOf(game, c).band), price = free ? 0 : rule.price;
  return [{ label: `Read the Datum for me.${price ? ` (${price} glim)` : ""}`, go: () => {
    if (price && !pay(game, game.player, price)) return node("INSUFFICIENT GLIM. THE DATUM WILL WAIT. IT IS GOOD AT WAITING.", [{ label: "Back.", go: () => talkTo(game, c) }]);
    emit(game, "route", { id: "datumRead", by: c.uid ?? null });
    return node(`THE DATUM IS READ.${price ? ` ${price} GLIM RECEIVED.` : " NO CHARGE. THE PLAN REMEMBERS ITS FRIENDS."}`, [bye()]);
  } }];
});

// A beat with no giver asks on its own, once you're back in the world.
registerDialogue("campaign:choice", (game, c) => {
  const open = choicesOpen(game).find((o) => o.beat.id === c.talk.state.beat);
  return open ? choiceNode(game, open, null) : null;
});
registerUpdate("campaign:choice", (game) => {
  const C = game.state?.campaign;
  if (!C?.asking) return;
  const beat = beatOf(C.asking), open = choicesOpen(game).find((o) => o.beat.id === C.asking);
  if (!open) { C.asking = null; return; }
  openTalk(game, { id: -1, type: "campaign", name: beat.title, vis: {}, talk: { dialogue: "campaign:choice", state: { beat: beat.id }, met: true } });
});
