// The starter chain as quests (the integrator, C5 #4; bible §10.5; content/quests.js QUESTS.campaign.starter): each step a
// quest "starter:<id>", started by its giver's talk option (its offer; the Turning by the campaign's start), its text in the
// journal, finished by its events and paid from its rewards as its giver says its `done` words.
//
//   turning      the Cube touched (screens/play.js onCube: "cube:touched"); no giver, paid at once
//   grubs        the Grub Mother killed (her uid, legend:<Kettle Mesa's site>), then home through the culvert (Hollowmere
//                entered from Kettle Mesa's floor 3), then Reeve Hallen
//   blankCorner  Mira's: held back (WAITS) until the wreck in the Hollow Mere (its deck mosaic, its hold) is built: a
//                request
//   skull        Brann's skull (world/legacy.js lays it on the real Keeper's Stair's floor 2), carried to Brann in the crypt
//   dialFloor    the Dial Floor's three accounts read (its event triangulated: story/secrets.js "triangulate"), its
//                Fifth-Hour site visited, then Brother Tamsin
//   payStep(game, step)   its rewards: rep ("quest"), items and glim (story/beats.js), a power of the tree it names
//                (rewards.power: the tree's first power you can take: "a free Pathcraft power"), a Bent's creases. Not paid
//                yet, each waiting on its system: Mira's map (reveal), the Hush Stair reading, the Keeper's Stair unsealed
//                (opens), the Fifth-Hour site's relic, a Plumb's true-mark.
import { on } from "../events.js";
import { registerQuest, startQuest, advanceQuest, questOf } from "./quests.js";
import { registerTalkOptions, node, bye } from "../talk.js";
import { QUESTS } from "../content/quests.js";
import { campaignOf } from "./campaign.js";
import { journalOf } from "./journal.js";
import { giveCampaignItems, payGlim, isGiver } from "./beats.js";
import { dialFloorReading } from "../content/world/plans/dialFloor.js";
import { POWERS } from "../content/powers.js";
import { takePerk, perkRank } from "../leveling.js";
import * as factions from "../factions.js";

export const STARTER = QUESTS.campaign.starter;
const stepOf = (id) => STARTER.find((s) => s.id === id) || null;
const qid = (id) => `starter:${id}`;
const quest = (game, id) => questOf(game, qid(id));
// A step whose world isn't built is held back (not offered: a quest that can't finish would sit open in the journal):
// Mira's Blank Corner wants the wreck in the Hollow Mere, its deck mosaic and its hold (a request).
export const WAITS = { blankCorner: "the wreck in the Hollow Mere (its deck mosaic read on the map, its hold looked into in 3D)" };

const landmark = (game, id) => game.run?.world?.landmarks?.get(id) || null;
const siteOfLandmark = (game, id) => [...(game.run?.sites?.values() || [])].find((s) => s.landmarkId === id) || null;
const dial = (game) => { const L = landmark(game, "dialFloor"); return L ? dialFloorReading(game.run, L.wx, L.wy) : null; };

registerQuest("starter", {
  start: "open",
  stages: {
    open: { on: {
      "cube:touched": (game, q) => (q.vars.step === "turning" ? "done" : null),
      kill: (game, q, ev) => (q.vars.step === "grubs" && ev?.uid === `legend:${siteOfLandmark(game, "kettleMesa")?.id}` ? "culvert" : null),
      triangulate: (game, q, ev) => (q.vars.step === "dialFloor" && ev?.key && ev.key === dial(game)?.eventId ? "visit" : null),
    } },
    culvert: { on: { "zone:enter": (game, q, ev) => {
      const k = landmark(game, "kettleMesa");
      // (the culvert's own arrival: up from Kettle Mesa's floor 3, screens/play.js changeFloor; a homing pip's is "travel")
      return ev?.zone?.landmarkId === "hollowmere" && ev.zone.z === 0 && ev.how === "up" && k && ev.from === `${k.wx},${k.wy},3` ? "return" : null;
    } } },
    visit: { on: { "zone:enter": (game, q, ev) => {
      const s = game.run?.sites?.get(dial(game)?.siteId);
      return s && ev?.zone?.wx === s.at.wx && ev.zone.wy === s.at.wy && ev.zone.z === 0 ? "return" : null;
    } } },
    return: { on: {} },
  },
  onComplete: (game, q) => payStep(game, stepOf(q.vars.step)),
});

export function startStep(game, id, quiet = false) {
  const s = stepOf(id);
  if (!s || quest(game, id)) return null;
  const q = startQuest(game, "starter", { id: qid(id), title: s.title, text: s.text, quiet, vars: { step: id } });
  // A deed done before the step was taken moves it on at once (the Grub Mother never comes back; an event is triangulated
  // once): campaign.starterDeeds, and the journal's triangulated events.
  const D = campaignOf(game).starterDeeds || {}, ev = dial(game)?.eventId;
  if (q && id === "grubs" && D.grubMother) advanceQuest(game, q, "culvert", { quiet: true });
  if (q && id === "dialFloor" && (D.dialFloor || (ev && journalOf(game).triangulated?.[ev] !== undefined))) advanceQuest(game, q, "visit", { quiet: true });
  return q;
}
// What a step's deed is, remembered whether or not the step is taken yet.
on("kill", (game, ev) => {
  const s = siteOfLandmark(game, "kettleMesa");
  if (s && ev?.uid === `legend:${s.id}` && game.state?.campaign) (game.state.campaign.starterDeeds ||= {}).grubMother = true;
});
on("triangulate", (game, ev) => {
  if (ev?.key && ev.key === dial(game)?.eventId && game.state?.campaign) (game.state.campaign.starterDeeds ||= {}).dialFloor = true;
});

// A free power of the tree a reward names: its first you can take (one with no `needs`, not held to its max).
function powerOfTree(p, tree) {
  return Object.entries(POWERS).find(([k, v]) => v.tree === tree && !v.needs && perkRank(p, k) < (v.max || 1))?.[0] || null;
}

export function payStep(game, s) {
  if (!s) return;
  const r = s.rewards || {}, p = game.player, C = campaignOf(game);
  if (C.starterPaid?.[s.id] !== undefined) return;
  (C.starterPaid ||= {})[s.id] = game.time || 0;
  if (s.done) game.log?.(s.done.split("\n").join(" "), [255, 230, 160]);
  for (const [id, n] of Object.entries(r.rep || {})) factions.addRep(game, id, n, "quest");
  giveCampaignItems(game, r.items);
  payGlim(game, r.glim);
  if (r.power && p) { const k = powerOfTree(p, r.power); if (k) takePerk(game, k); }
  if (r.bent?.creases && p && p.creases !== undefined) { p.creases += r.bent.creases; game.log?.(`You may spend ${r.bent.creases} more creases.`, [190, 220, 255]); }
}

// The Turning begins with the campaign (it has no giver); the rest wait for their givers.
on("zone:enter", (game, ev) => { if (ev.how === "start" && game.state?.campaign?.started != null) startStep(game, "turning", true); });

// Talk: a giver offers its step ("Is there anything I can do?", its offer), and takes it back ("It's done.") when the step
// waits on it; Brann takes his skull.
registerTalkOptions("starter", (game, c) => {
  if (game.state?.campaign?.started == null) return null;   // (the test world has no campaign)
  const out = [];
  for (const s of STARTER) {
    if (!s.giver || WAITS[s.id] || !isGiver(c, { giver: s.giver })) continue;
    const q = quest(game, s.id);
    if (!q && s.offer) out.push({ label: "Is there anything I can do?", go: () => node(s.offer.split("\n").join(" "), [
      { label: "I'll do it.", go: () => { startStep(game, s.id); return node("Good.", [bye()]); } }, bye("Not now.")]) });
    else if (q && !q.done && q.stage === "return") out.push({ label: "It's done.", go: () => { advanceQuest(game, q, "done"); return null; } });
    else if (q && !q.done && s.id === "skull") {
      const at = game.player?.inv?.findIndex((it) => it.kind === "quest" && it.id === "skull") ?? -1;
      if (at >= 0) out.push({ label: "Here is your skull.", go: () => { game.player.inv.splice(at, 1); advanceQuest(game, q, "done"); return null; } });
    }
  }
  return out.length ? out : null;
});
