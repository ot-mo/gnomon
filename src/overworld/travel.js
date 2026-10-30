// World-map travel (TECH_DESIGN §5.2; bible §4.1, §4.9, §15.6; WS1). The `world` screen (screens/worldmap.js) is
// how you play it; these are the rules, callable from Node as they are.
//
//   enterWorldMap(game, { viewOnly, center }) → { ok, why }
//        O on a surface zone (z 0), not lost, with no hostile awake within RULES.overworld.hostileRadius tiles:
//        the journey starts on your span and the `world` screen opens over your view. viewOnly (the journal's
//        Locations tab, from anywhere): the map to look at, centred on `center`, no travel.
//   worldStep(game, dx, dy, { confirm, fast, drop = true }) → result
//        one 8-way step: skipTime(hours × 60 s, { interruptible: false, reason: "travel" }), then the rolls:
//        getting lost (lost.js), else an encounter (encounters.js), else (not on fast travel) a hidden site.
//        result = { ok, why?, confirm?: "tier", from, to, hours, seconds, lost, encounter, site, dropped, dead,
//                   chance: { lost, encounter } (what was rolled against; none onto a "drop" span) }
//        Emits "world:step" { from, to, seconds, lost, encounter } (to = { wx, wy }: WS7's visit and find quests).
//        A span 2+ tiers above yours is asked about first (result.confirm "tier"; again with confirm: true).
//        drop: false (Node checks) keeps you on the world map whatever is rolled.
//   fastTravel(game, to, { confirm }) → result
//        to a known span: the cheapest path (travelPath) over steps along roads and rivers and onto spans you
//        have visited; encounters × 0.25, never lost, no hidden sites; it stops at an encounter that drops you.
//        result = { ok, why?, confirm?, steps, seconds, path, stopped? }
//   leaveWorldMap(game, { at = "edge", siteId })   down into the span you are on:
//        "edge"   at the edge you came in through (a corner after a diagonal), facing the way you went; where
//                 you stood if you haven't moved
//        "center" the zone's anchor;  "site" a known site's entrance (or its footprint's middle);  "lost" a
//                 random reachable spot, lost (lost.js)
//        → true, or a promise when the zone is read back from the save (WS9).
//   stepHours(game, from, to, edge) → world hours   the terrain's travelHours (3 along a road edge), +25% at
//        night off roads, ÷ (1 + bonus(travel)) (Wings, Pathfinder)
//   travelPath(game, from, to) → [{ wx, wy }] | null   (Dijkstra over hours by day; the path's spans, from excluded)
//   dropInto(game, encounter)            down at the edge, then a band or legend 8-12 tiles from where you arrive
//   answer(game, yes)                    the open prompt (a hidden site: "Stop and look?"; a span far above your tier)
//   toggleTorch(game)                    F on the world map
//
// No zone is simulated while you travel: the zone you left stays as it was (skipTime only catches up its
// creatures' statuses), and no zone is made until you go down into one (R10: every hour is skipTime's).
import { skipTime } from "../time.js";
import { isNight } from "../clock.js";
import { emit, on } from "../events.js";
import { pushMode, popMode, setMode } from "../screens.js";
import { changeZone, cachedZone, makeZone, getZone, arrivalPoint, zoneKey, ZONE_LOADER } from "../zones.js";
import { hostilesTo } from "../creatures.js";
import { bonus } from "../stats.js";
import { statusFlag } from "../status.js";
import { refreshView } from "../turns.js";
import { OW, atlas, roll, spanKey, tileOf, hourSeconds, playerTier, edgeBetween, canStep } from "./state.js";
import { isLost, lostChance, getLost } from "./lost.js";
import { rollEncounter, placeEncounter, meetTravellers, hiddenSiteRoll, siteLine, encounterChance } from "./encounters.js";
import { sight, findSite, isKnown } from "./discovery.js";
import { ENCOUNTERS } from "../content/encounters.js";

const say = (game, line, color = [170, 170, 170]) => { game.log?.(line, color); return line; };

// --- Opening the map ---------------------------------------------------------------------------------------------
export function enterWorldMap(game, { viewOnly = false, center = null } = {}) {
  const zone = game.zone, p = game.player;
  if (!zone || !game.run) return { ok: false, why: "no zone" };
  const here = { wx: zone.wx, wy: zone.wy };
  if (viewOnly) {
    const c = center && game.run.world.inBounds(center.wx, center.wy) ? center : here;
    game.trip = { ...here, came: null, moved: false, fromKey: zone.key, view: game.view, viewOnly: true, cursor: { wx: c.wx, wy: c.wy }, prompt: null };
    pushMode(game, "world");
    return { ok: true };
  }
  if (zone.type !== "surface" || zone.z !== 0) return { ok: false, why: say(game, "The world map needs the open sky: go up first.") };
  if (isLost(game)) return { ok: false, why: say(game, "You've lost your bearings: the world map is no use to you until you find them.") };
  const r = OW().hostileRadius;
  if (hostilesTo(game, p).some((m) => m.state === "chase" && Math.hypot(m.x - p.x, m.y - p.y) <= r))
    return { ok: false, why: say(game, "Not with something hunting you this close.") };
  game.trip = { ...here, came: null, moved: false, fromKey: zone.key, view: game.view, viewOnly: false, cursor: null, prompt: null, warned: {} };
  sight(game, here.wx, here.wy);
  pushMode(game, "world");
  return { ok: true };
}

// A journey ends when you go down (leaveWorldMap clears it first), so any other zone entry finds a stale one: a new
// run or a load (both enter a zone) after you died on the road. Clear it, so nothing reads the old run's span.
on("zone:enter", (game) => { game.trip = null; game.bearingsLook = null; }, { priority: 50 });
// A save made on the world map ("world" is saveable since Phase 2, so WS9's travel saves are made) holds the journey as
// state.trip (save/codec.js snapshotSlot): a load puts you back on it, at that span, over the view you set out from.
on("save:loaded", (game) => {
  const t = game.state?.trip;
  if (!t) return;
  delete game.state.trip;
  game.trip = { ...t, came: t.came ?? null, moved: !!t.moved, warned: t.warned || {}, prompt: t.prompt ?? null, viewOnly: false, cursor: null, menu: null, busy: false };
  setMode(game, t.view === "map" ? "map" : "explore", null, { pointer: false });
  pushMode(game, "world");
});

// --- One step ------------------------------------------------------------------------------------------------------
export function stepHours(game, from, to, edge = edgeBetween(game.run.world, from, to)) {
  const O = OW(), t = tileOf(game, to.wx, to.wy), f = tileOf(game, from.wx, from.wy);
  let h;
  if (t.travel === "drop") h = (f?.travelHours ?? O.roadHours) * O.dropHours;
  else if (edge.road) h = O.roadHours;
  else h = t.travelHours ?? O.roadHours;
  if (!edge.road && isNight(game)) h *= O.nightHours;
  return h / (1 + Math.max(0, bonus(game.player, "travel")));
}

const REFUSED = {
  edge: "The world ends there.",
  travel: "You can't travel that way on the world map: walk it from the next zone, or find a road.",
  diagonal: "Not between those two: go round.",
};

export const SLEEPWALK = 0.1;
export function worldStep(game, dx, dy, { confirm = false, fast = false, drop = true } = {}) {
  const trip = game.trip;
  if (!trip || trip.viewOnly) return { ok: false, why: "not travelling" };
  if (trip.prompt) return { ok: false, why: "prompt" };
  const world = game.run.world, from = { wx: trip.wx, wy: trip.wy };
  const no = canStep(world, from, dx, dy);
  if (no) { if (!fast) say(game, REFUSED[no] || "You can't go that way."); return { ok: false, why: no, from }; }
  let to = { wx: from.wx + dx, wy: from.wy + dy }, t = world.tileAt(to.wx, to.wy), edge = edgeBetween(world, from, to);
  const k = spanKey(to.wx, to.wy);
  if (!confirm && t.tier >= playerTier(game) + OW().tierWarning && !trip.warned?.[k]) {
    trip.prompt = { kind: "tier", dx, dy, to, line: `${capital(regionName(game, t))} is tier ${t.tier}, far beyond you. Go on?` };
    return { ok: false, why: "tier", confirm: "tier", from, to };
  }
  // Sleepwalker (B1, C4 #8): 1 move in 10 drifts a span off course, to one side of the way you meant (where that
  // step is open from here).
  let drifted = false;
  if (game.player.mutations?.sleepwalker && roll(game) < SLEEPWALK) {
    const sides = dx && dy ? [[dx, 0], [0, dy]] : dx ? [[dx, 1], [dx, -1]] : [[1, dy], [-1, dy]];
    const [ex, ey] = sides[roll(game) < 0.5 ? 0 : 1], side = world.tileAt(from.wx + ex, from.wy + ey);
    // (never into a span the tier warning would have asked about: you wake before that; verification finding)
    if (!canStep(world, from, ex, ey) && side && side.tier < playerTier(game) + OW().tierWarning) {
      to = { wx: from.wx + ex, wy: from.wy + ey }; t = world.tileAt(to.wx, to.wy); edge = edgeBetween(world, from, to); drifted = true;
      say(game, "You walk on half asleep, and wake a span off your way.", [200, 190, 230]);
    }
  }
  const hours = stepHours(game, from, to, edge), flying = statusFlag(game.player, "flying");   // as you set out
  const sk = skipTime(game, hours * hourSeconds(), { interruptible: false, reason: "travel" });
  const res = { ok: true, from, to, hours, seconds: sk.elapsed, lost: false, encounter: null, site: null, dropped: false, dead: false, drifted };
  trip.wx = to.wx; trip.wy = to.wy; trip.came = { dx: to.wx - from.wx, dy: to.wy - from.wy }; trip.moved = true; trip.cursor = null;   // (the way you really came: a drift's too)
  if (game.mode === "dead") {
    res.dead = true;
    game.trip = null;
    emit(game, "world:step", { from, to, seconds: res.seconds, lost: false, encounter: null });
    return res;
  }
  sight(game, to.wx, to.wy);
  if (t.travel !== "drop") {
    const lc = lostChance(game, to, edge, { fast, learn: true, flying });
    res.chance = { lost: lc, encounter: encounterChance(game, t, { fast }) };
    if (lc > 0 && roll(game) < lc) res.lost = true;
    else res.encounter = rollEncounter(game, to, { fast });
    if (!res.lost && !res.encounter && !fast) res.site = hiddenSiteRoll(game, to);
  }
  emit(game, "world:step", { from, to, seconds: res.seconds, lost: res.lost, encounter: res.encounter?.kind ?? null });

  if (t.travel === "drop") {
    const T = world.terrains[t.terrain];
    say(game, T?.edgeMessage || `${T?.name || t.terrain} can't be crossed on the world map: you have to walk it.`);
    if (drop) { res.dropped = true; leaveWorldMap(game, { at: "edge" }); }
  } else if (res.lost) {
    say(game, ENCOUNTERS.lines.lost, [255, 200, 120]);
    if (drop) { res.dropped = true; leaveWorldMap(game, { at: "lost" }); }
  } else if (res.encounter?.kind === "travellers") {
    meetTravellers(game, to);
  } else if (res.encounter) {
    if (drop) { res.dropped = true; dropInto(game, res.encounter); }
  } else if (res.site) {
    trip.prompt = { kind: "site", siteId: res.site.id, line: siteLine(res.site) };
  }
  return res;
}

const regionName = (game, t) => game.run.world.regions?.[t.region]?.name || game.run.world.terrains?.[t.terrain]?.name || t.terrain;
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);   // "the Eastfells" opens a sentence

// The open prompt: yes or no.
export function answer(game, yes) {
  const trip = game.trip, q = trip?.prompt;
  if (!q) return null;
  trip.prompt = null;
  if (q.kind === "tier") {
    if (!yes) return null;
    (trip.warned ||= {})[spanKey(q.to.wx, q.to.wy)] = 1;
    return q.path ? fastTravel(game, q.path[q.path.length - 1], { confirm: true }) : worldStep(game, q.dx, q.dy, { confirm: true });
  }
  if (q.kind === "site") {
    if (!yes) return null;   // declined: not recorded (bible §4.9)
    const site = game.run.sites.get(q.siteId);
    findSite(game, site, "road");
    return leaveWorldMap(game, { at: "site", siteId: site.id });
  }
  return null;
}

// --- Fast travel -------------------------------------------------------------------------------------------------
export function travelPath(game, from, to) {
  const world = game.run.world, A = atlas(game), { w, h } = world;
  const idx = (x, y) => x + y * w, goal = idx(to.wx, to.wy), start = idx(from.wx, from.wy);
  if (goal === start || !world.inBounds(to.wx, to.wy)) return null;
  const dist = new Float64Array(w * h).fill(Infinity), prev = new Int32Array(w * h).fill(-1), done = new Uint8Array(w * h);
  dist[start] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < w * h; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || u === goal) break;
    done[u] = 1;
    const a = { wx: u % w, wy: Math.floor(u / w) };
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (canStep(world, a, dx, dy)) continue;
        const b = { wx: a.wx + dx, wy: a.wy + dy }, i = idx(b.wx, b.wy);
        if (done[i]) continue;
        const e = edgeBetween(world, a, b), t = world.tileAt(b.wx, b.wy);
        if (!(e.road || e.river || A.visited[spanKey(b.wx, b.wy)] !== undefined)) continue;   // roads, rivers, visited spans only
        if (t.travel === "drop" && i !== goal) continue;
        const c = dist[u] + (e.road ? OW().roadHours : t.travelHours ?? OW().roadHours) + 1e-6 * (dx && dy ? 1 : 0);
        if (c < dist[i]) { dist[i] = c; prev[i] = u; }
      }
  }
  if (prev[goal] < 0) return null;
  const path = [];
  for (let i = goal; i !== start; i = prev[i]) path.push({ wx: i % w, wy: Math.floor(i / w) });
  return path.reverse();
}

export function fastTravel(game, to, { confirm = false } = {}) {
  const trip = game.trip;
  if (!trip || trip.viewOnly) return { ok: false, why: "not travelling" };
  if (trip.prompt) return { ok: false, why: "prompt" };
  if (!isKnown(game, to.wx, to.wy)) return { ok: false, why: say(game, "You don't know the way there.") };
  const path = travelPath(game, trip, to);
  if (!path) return { ok: false, why: say(game, "You know no way there by roads, rivers and places you've been.") };
  // The highest tier on the way, so one yes covers what it names.
  const far = path.filter((s) => tileOf(game, s.wx, s.wy).tier >= playerTier(game) + OW().tierWarning && !trip.warned?.[spanKey(s.wx, s.wy)])
    .sort((a, b) => tileOf(game, b.wx, b.wy).tier - tileOf(game, a.wx, a.wy).tier)[0];
  if (far && !confirm) {
    trip.prompt = { kind: "tier", to: far, path, line: `The way goes through tier ${tileOf(game, far.wx, far.wy).tier} land, far beyond you. Go on?` };
    return { ok: false, why: "tier", confirm: "tier", path };
  }
  let seconds = 0, steps = 0, stopped = null;
  for (const s of path) {
    const r = worldStep(game, s.wx - game.trip.wx, s.wy - game.trip.wy, { fast: true, confirm: true });
    if (!r.ok) { stopped = r.why; break; }
    seconds += r.seconds; steps++;
    if (r.dead) { stopped = "dead"; break; }
    if (r.dropped) { stopped = r.encounter?.kind || (r.lost ? "lost" : "drop"); break; }
  }
  return { ok: true, steps, seconds, path, stopped };
}

// --- Going down ---------------------------------------------------------------------------------------------------
function arrivalFor(game, zone, trip, at, siteId) {
  const { w, d } = zone;
  if (at === "lost") return arrivalPoint(zone, "teleport", { rng: () => roll(game) });
  if (at === "site") {
    const site = game.run.sites.get(siteId), r = site?.surface?.rect, e = zone.entrance;
    if (r) {
      const inside = e && e.x >= r.x - 2 && e.y >= r.y - 2 && e.x < r.x + r.w + 2 && e.y < r.y + r.d + 2;
      const fx = inside ? e.x + 0.5 : r.x + r.w / 2, fy = inside ? e.y + 1.5 : r.y + r.d + 1.5;
      return arrivalPoint(zone, "teleport", { fx, fy, yaw: -Math.PI / 2 });
    }
    return { ...zone.spawn };
  }
  if (at === "center" || !trip.came) return { ...zone.spawn };
  const { dx, dy } = trip.came;
  const fx = dx > 0 ? 0.5 : dx < 0 ? w - 0.5 : w / 2, fy = dy > 0 ? 0.5 : dy < 0 ? d - 0.5 : d / 2;
  return arrivalPoint(zone, "teleport", { fx, fy, yaw: Math.atan2(dy, dx) });
}

export function leaveWorldMap(game, { at = "edge", siteId = null } = {}) {
  const trip = game.trip;
  if (!trip) return false;
  const view = trip.view === "map" ? "map" : "explore";
  if (trip.viewOnly) { game.trip = null; popMode(game); return true; }
  if (!trip.moved && at === "edge") {   // back where you stood
    game.trip = null;
    setMode(game, view);
    if (view === "map") refreshView(game);
    return true;
  }
  const key = zoneKey(trip.wx, trip.wy, 0);
  const go = (zone) => {
    if (!zone) { say(game, "There is nothing there to go down into."); return false; }
    zone.ensureDerived();   // (a zone in memory may have dropped its stand arrays: keepDerived)
    const arrival = arrivalFor(game, zone, trip, at, siteId);
    game.trip = null;
    if (changeZone(game, key, { how: "travel", at: arrival }) !== true) return false;
    if (at === "lost") getLost(game, key);
    setMode(game, view);
    if (view === "map") refreshView(game);
    return true;
  };
  const cached = cachedZone(game, key);
  if (cached) return go(cached);
  if (ZONE_LOADER.has?.(game, key)) {   // read back from the save (WS9): the screen waits, and a failed read lets you go
    trip.busy = true;
    return getZone(game, key).then(go, (e) => {
      console.error(`reading zone ${key} from the save:`, e);
      trip.busy = false;
      say(game, "The way down won't come clear. Try another span, or again.", [255, 150, 120]);
      return false;
    });
  }
  return go(makeZone(game, key));
}

// Down at the edge, then the encounter: a band or a legend is placed into the zone you are then in, so it waits
// 8-12 tiles from where you arrive, also when that is the zone you left (a patch for the zone you are in applies
// at once, from where you stand: placed before going down, it measured from where you had stood).
export function dropInto(game, enc) {
  const place = (ok) => { if (ok === true && game.zone) placeEncounter(game, game.zone.key, enc); return ok; };
  const r = leaveWorldMap(game, { at: "edge" });
  return r && typeof r.then === "function" ? r.then(place) : place(r);
}

// --- F on the world map ------------------------------------------------------------------------------------------
export function toggleTorch(game) {
  const p = game.player;
  p.torch = !p.torch;
  say(game, p.torch ? "You light your torch." : "You put out your torch. Harder to see, harder to be seen.", [255, 200, 120]);
}

