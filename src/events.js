// The event bus and the per-frame update registry (TECH_DESIGN §2.12).
//
//   on(type, handler, { priority })   subscribe; returns a function that unsubscribes.
//                                     Higher priority runs first; equal priorities in the order added.
//   emit(game, type, payload)         call every handler now: handler(game, payload). Synchronous.
//   registerUpdate(id, fn, { modes, every })
//                                     fn(game, dt) runs once per frame after the mode's own update,
//                                     in the listed modes ("play" means explore and map). With
//                                     `every` (seconds), at most that often, and dt is the time since
//                                     its last run. Registering an id again replaces it.
//   runUpdates(game, dt)              game.js calls this once per frame.
//
// Events so far: "zone:prepare" { zone, arrival, from } (before you're placed: open gates, resolve
// loot), "zone:enter" { zone, arrival, how, away, first, from /* the key of the zone you left, or null */ } (after), "zone:leave" { zone, side, how, to };
// since 0C "attack" { att, tgt, result } and "hurt" { tgt, src, dmg } (combat.js), "kill" { c, src, uid,
// factions } (monsters.js killMonster; it replaced game.questEvent, game.onGuardianDies and game.win()),
// "guardian:wake" { c } (guardians.js; it replaced game.onGuardianWakes), "quest:start", "quest:stage",
// "quest:done" { q } (story/quests.js) and "quest:report" { id, quiet } (a giver says a quest is done:
// story/quests.js finishQuest; a legacy one-stage quest finishes on it).
const handlers = new Map();   // type → [{ fn, priority, order }]
let order = 0;

export function on(type, fn, { priority = 0 } = {}) {
  const list = handlers.get(type) || [];
  const entry = { fn, priority, order: order++ };
  list.push(entry);
  list.sort((a, b) => b.priority - a.priority || a.order - b.order);
  handlers.set(type, list);
  return () => {
    const l = handlers.get(type);
    const k = l ? l.indexOf(entry) : -1;
    if (k >= 0) l.splice(k, 1);
  };
}

export function emit(game, type, payload = {}) {
  const list = handlers.get(type);
  if (!list) return payload;
  for (const { fn } of [...list]) fn(game, payload);
  return payload;
}

const updates = new Map();   // id → { fn, modes, every, acc }

export function registerUpdate(id, fn, { modes = ["explore", "map"], every = 0 } = {}) {
  const expanded = modes.flatMap((m) => (m === "play" ? ["explore", "map"] : [m]));
  updates.set(id, { fn, modes: new Set(expanded), every, acc: 0 });
}

export function unregisterUpdate(id) { updates.delete(id); }

export function runUpdates(game, dt) {
  for (const u of updates.values()) {
    if (!u.modes.has(game.mode) && !u.modes.has("*")) continue;
    if (!u.every) { u.fn(game, dt); continue; }
    u.acc += dt;
    if (u.acc >= u.every) { const t = u.acc; u.acc = 0; u.fn(game, t); }
  }
}
