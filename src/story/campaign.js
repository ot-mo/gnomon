// The campaign (TECH_DESIGN §1.2 game.js "the cube gate, win() and guardian hooks move to events and campaign.js",
// §8.3 "WS7": intro pages, the start, the main beats as data; bible §10.5, §11). The data is content/quests.js
// QUESTS.campaign; this file runs it on the bus. The test world keeps the parent game's story (story/legacy.js,
// content/legacy/story-hooks.js) and none of this: the campaign starts only on another world.
//
//   CAMPAIGN                         QUESTS.campaign: { intro, starter, beats }
//   introPages(run) → [page]         what the run opens with: the parent's INTRO on the test world, the campaign's
//                                    elsewhere (game.js startRun should show these: integration request)
//   campaignOf(game) → state         game.state.campaign = { started, done: { [beatId]: time }, lengthening } (JSON)
//   beginCampaign(game) → bool       the start (on "zone:enter" with how "start", off the test world): beat 1 as a quest
//                                    (template "beat", id = the beat's id) and a note of the starter chain
//   beatReady(game, beat) → bool     its `after` beats done (any one; all with needsAll)
//   beatMatches(m, type, ev) → bool  a matcher { event, landmark?, z?, id?, uid? } against a bus event
//   BEAT_XP(level)                   WS4's xpReward("beat", level) when it exists, else 0.75 of a level's XP at the band's
//                                    floor; × 1.5 for a beat begun below its band (bible §11 "the early bonus")
// Events: "beat" { id, n } when one is done; "lengthen" { n } when the Lengthening advances (after beat 5, the first of
// beats 7 and 8, and beat 9: bible §11, §4.8; WS1 and WS3 move the Hand on it).
import { on, emit } from "../events.js";
import { QUESTS } from "../content/quests.js";
import { INTRO } from "./legacy.js";
import { registerQuest, startQuest } from "./quests.js";
import { addNote } from "./journal.js";
import * as leveling from "../leveling.js";

export const CAMPAIGN = QUESTS.campaign;
export const BEAT_XP = (level) => (leveling.xpReward ? leveling.xpReward("beat", level) : Math.round(0.75 * leveling.xpToNext(level)));
const EARLY = 1.5;

const isTest = (run) => !run?.world || run.world.id === "test";
export const introPages = (run) => (isTest(run) ? INTRO : CAMPAIGN.intro);

export function campaignOf(game) {
  const st = game.state || (game.state = {});
  const C = (st.campaign ||= {});
  C.started ??= null;
  C.done ||= {};
  C.lengthening ||= 0;
  return C;
}

export function beatMatches(m, type, ev) {
  if (!m || m.event !== type) return false;
  if (type === "zone:enter") return ev?.zone?.landmarkId === m.landmark && (m.z === undefined || ev.zone.z === m.z);
  if (type === "secret") return ev?.id === m.id;
  if (type === "kill") return (ev?.uid ?? ev?.c?.uid) === m.uid;
  if (type === "quest:done") return ev?.q?.id === m.id;
  return false;
}

export function beatReady(game, beat) {
  const C = campaignOf(game);
  if (!beat.after.length) return true;
  return beat.needsAll ? beat.after.every((id) => C.done[id] !== undefined) : beat.after.some((id) => C.done[id] !== undefined);
}

const beatOf = (id) => CAMPAIGN.beats.find((b) => b.id === id) || null;
const doneBy = (type) => (game, q, ev) => (beatMatches(beatOf(q.id)?.done, type, ev) ? "done" : null);
registerQuest("beat", {
  start: "open",
  stages: { open: { on: { "zone:enter": doneBy("zone:enter"), secret: doneBy("secret"), kill: doneBy("kill"), "quest:done": doneBy("quest:done") } } },
  onComplete: (game, q) => beatDone(game, beatOf(q.id), q),
});

function startBeat(game, beat, quiet = false) {
  if (!beat || game.quests?.some((q) => q.id === beat.id)) return null;
  const q = startQuest(game, "beat", { id: beat.id, title: `${beat.n}. ${beat.title}`, text: beat.goal, quiet,
    vars: { beat: beat.id, startedAt: game.player?.level ?? 1 }, target: { landmark: beat.landmark } });
  return q;
}

function beatDone(game, beat, q) {
  if (!beat) return;
  const C = campaignOf(game);
  C.done[beat.id] = game.time || 0;
  const level = beat.band[0], early = (q.vars.startedAt ?? 99) < beat.band[0];
  const xp = Math.round(BEAT_XP(level) * (early ? EARLY : 1));
  q.reward = { xp };
  game.log?.(`${beat.title}: done. (+${xp} XP${early ? ", early" : ""})`, [255, 230, 120]);
  if (game.player) leveling.gainXp(game, xp, { source: "beat" });
  emit(game, "beat", { id: beat.id, n: beat.n });
  // The Lengthening: after beat 5, the first of beats 7 and 8, and beat 9.
  const firstOf = beat.lengthens === "first"
    && !CAMPAIGN.beats.some((b) => b.lengthens === "first" && b.id !== beat.id && C.done[b.id] !== undefined);
  if (beat.lengthens === true || firstOf) { C.lengthening++; emit(game, "lengthen", { n: C.lengthening }); }
  for (const b of CAMPAIGN.beats) if (C.done[b.id] === undefined && b.after.includes(beat.id) && beatReady(game, b)) startBeat(game, b);
}

export function beginCampaign(game) {
  if (isTest(game.run)) return false;
  const C = campaignOf(game);
  if (C.started !== null) return false;
  C.started = game.time || 0;
  addNote(game, `Hollowmere: ${CAMPAIGN.starter.map((s) => s.title).join(", then ")}.`, "campaign");
  for (const b of CAMPAIGN.beats) if (!b.after.length) startBeat(game, b, true);
  return true;
}

on("zone:enter", (game, ev) => { if (ev.how === "start") beginCampaign(game); });
