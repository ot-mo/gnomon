// Quests (TECH_DESIGN §2.13; P0, then WS7): templates with stages, driven by the bus (events.js).
//
//   registerQuest(id, template)   template = { title(game, q), text(game, q),
//                                   stages: { [stage]: { on: { [eventType]: (game, q, ev) → nextStage | null } } },
//                                   start = first stage, onComplete?(game, q) }
//                                 Registering subscribes the bus to every event type its stages listen for.
//   startQuest(game, id, { title, text, vars, giver, target, quiet }) → q | null   (null: already given)
//                                 q = { id, template, title, text, giver, target, stage, vars, reward, done,
//                                       failed, log } (JSON only), in game.quests; emits "quest:start" { q }
//   advanceQuest(game, q, next, { quiet })   "done" | "failed" | a stage name; emits "quest:done" or "quest:stage"
//   finishQuest(game, id, title = null, { quiet })
//                                 a giver says it's done: emits "quest:report" { id, quiet }, which a legacy
//                                 one-stage quest turns into "done". title: for a quest solved on the spot,
//                                 before it was ever given (it goes straight in, then is done).
//   questOf, questActive, questDone (game, id);  mapPercent(zone): the share of a floor on your map.
//
// Each stage handler sees every event of its type for every active quest that is in that stage; a
// handler returns the next stage, or null to stay. Today's quests (content/legacy/encounters.js) are
// one-stage templates: "open" until their giver reports them done, Rook's also hearing "kill".
import { on, emit } from "../events.js";
import { KIND } from "../blocks.js";

const TEMPLATES = new Map();
const SUBSCRIBED = new Set();

export function registerQuest(id, template) {
  TEMPLATES.set(id, { id, start: "open", ...template });
  for (const stage of Object.values(template.stages || {}))
    for (const type of Object.keys(stage.on || {})) subscribe(type);
}
export const questTemplate = (id) => TEMPLATES.get(id) || null;

function subscribe(type) {
  if (SUBSCRIBED.has(type)) return;
  SUBSCRIBED.add(type);
  on(type, (game, ev) => route(game, type, ev));
}

// One event to the current stage of every active quest that listens for it.
function route(game, type, ev) {
  for (const q of [...(game.quests || [])]) {
    if (q.done || q.failed) continue;
    const h = TEMPLATES.get(q.template)?.stages?.[q.stage]?.on?.[type];
    if (!h) continue;
    const next = h(game, q, ev);
    if (next && next !== q.stage) advanceQuest(game, q, next, { quiet: ev?.quiet });
  }
}

export function startQuest(game, id, { title, text = "", vars = {}, giver = null, target = null, quiet = false } = {}) {
  if (game.quests.some((q) => q.id === id)) return null;
  const t = TEMPLATES.get(id);
  if (!t) throw new Error(`no quest template "${id}"`);
  const q = { id, template: id, title: title ?? id, text, giver, target, stage: t.start,
              vars, reward: null, done: false, failed: false, log: [] };
  if (!title && t.title) q.title = t.title(game, q);
  if (!text && t.text) q.text = t.text(game, q);
  game.quests.push(q);
  if (!quiet) game.log(`New quest: ${q.title}. (J: journal)`, [255, 220, 120]);
  emit(game, "quest:start", { q });
  return q;
}

export function advanceQuest(game, q, next, { quiet = false } = {}) {
  if (q.done || q.failed) return;
  q.log.push(next);
  if (next === "done") {
    q.done = true;
    if (!quiet) game.log(`Quest complete: ${q.title}.`, [140, 255, 160]);
    TEMPLATES.get(q.template)?.onComplete?.(game, q);
    emit(game, "quest:done", { q });
  } else if (next === "failed") {
    q.failed = true;
    emit(game, "quest:done", { q });
  } else {
    q.stage = next;
    emit(game, "quest:stage", { q });
  }
}

export function finishQuest(game, id, title = null, { quiet = false } = {}) {
  if (!questOf(game, id) && title) startQuest(game, id, { title, quiet: true });
  emit(game, "quest:report", { id, quiet });
}

export const questOf = (game, id) => game.quests.find((q) => q.id === id) || null;
export const questActive = (game, id) => game.quests.some((q) => q.id === id && !q.done && !q.failed);
export const questDone = (game, id) => game.quests.some((q) => q.id === id && q.done);

// The share of this floor (everything that isn't solid rock) that's on your map ("map a zone").
export function mapPercent(zone) {
  let total = 0, seen = 0;
  for (let i = 0; i < zone.w * zone.d; i++) if (zone.kind[i] !== KIND.WALL) { total++; if (zone.seen[i]) seen++; }
  return Math.round((seen / Math.max(1, total)) * 100);
}

// A quest of the parent game: one stage, done when its giver reports it (finishQuest), plus any
// other handlers the content gives that stage.
export function registerLegacyQuest(id, extra = {}) {
  registerQuest(id, { stages: { open: { on: { "quest:report": (game, q, ev) => (ev.id === q.id ? "done" : null), ...extra } } } });
}
