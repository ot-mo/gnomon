// Artifacts and charge cells (TECH_DESIGN §2.6 "Identify artifacts", §2.9 kinds `artifact` and `cell`, §8.3 "WS5";
// §1.4 "bodymods (WS5)"; bible §13.4). The tables are content/items/artifacts.js.
//
//   examineArtifact(game, p, it, rng = Math.random) → { ok, known, broke, nat, total, dc, margin }
//       bible §13.4 (it outranks TECH_DESIGN's attr + d10): d20 + mod(int) + bonus(examine) against
//       8 + 2 × complexity. Meet it and it's identified (known: true); miss by 1-5 and you learn its class
//       (known: "class": named, but you can't use it); miss by 6 or more and it breaks (broken: true), unless
//       it's sturdy (then partly known). Each try takes EXAMINE_TIME s; you may try again (and risk it again).
//   identifyChance(p, it) → { known, partial, broke }   the exact odds of one try (the check holds rolls to it)
//   identify(game, it)            it becomes known (a tinker's service, the Readhand mutation: WS4)
//   artifactName(it), cellOf(it) → { id, charge } | null, chargeOf(it), needs(it) → charge one use takes
//   loadCell(game, p, it) → bool  a cell with enough charge from your pack goes in (the old one comes out)
//   fillCell(game, p, cell) → glim   a glim cell refilled from your purse: a glim per 100 charge (bible §3.1)
//   rechargeCells(game, p, t0, t1)   sun and dark cells, in the pack and in artifacts, gain 50 a minute (bus
//                                     "clock:tick": frames in 3D, actions on the map and skipTime alike)
//   useArtifact(game, p, it) → seconds | { aim: it }   E in the pack: try to identify an unknown one, else use it;
//                                     an aimed one asks for a target (aimArtifact) after the inventory closes
//   aimArtifact(game, p, it)         requestTarget (3D: the crosshair at once; the map: abilities.js's seam, the
//                                     target screen once WS8 is in), then fireArtifact and the map's time
//   fireArtifact(game, p, it, target) → seconds   what it does, its charge paid
//   makeArtifact(id, rand) · makeCell(id, rand, full) · randomBodyMod(rand, level)   loot for sites (WS10, C)
// Kinds: `artifact` { kind, id, known, cell, on?, mark?, broken? } and `cell` { kind, id, charge }.
import { ARTIFACTS, CELLS } from "../content/items/artifacts.js";
import { IMPLANTS } from "../content/items/implants.js";
import { registerItemKind, takeOne, addToInventory, mendItem } from "../items.js";
import { carried } from "../body.js";
import { bonus, invalidateStats, examineScore } from "../stats.js";
import { addStatus, removeStatus, hasStatus, registerStatus } from "../status.js";
import { pay, funds, formatPrice } from "../currency.js";
import { requestTarget } from "../abilities.js";
import { mapUseTime } from "../turns.js";
import { applyDamage, elementVs } from "../combat.js";
import { touchable, ghostHidden, theOf, TheOf } from "../creatures.js";
import { arrivalPoint, changeZone, zoneKey } from "../zones.js";
import { attitude } from "../factions.js";
import { findSite, reveal } from "../overworld/discovery.js";
import { nightSeconds } from "../clock.js";
import { zoneIsLightless } from "../light.js";
import { KIND, FLOOR_Z } from "../world.js";
import { on } from "../events.js";
import { implantEffect } from "./implants.js";
import { hasKey } from "../keyset.js";

export const EXAMINE_TIME = 10;      // seconds a try at identifying takes (on the map: game time)
export const USE_TIME = 1;           // a use, on the map
export const RECHARGE = 50;          // sun and dark cells: charge a minute (bible §13.4)
export const CHARGE_PER_GLIM = 100;  // bible §3.1: 100 charge is 1 glim
const MINUTE = 60;                   // "a minute" of game time

// --- Identification -----------------------------------------------------------------------------------
export const examineDc = (it) => 8 + 2 * (ARTIFACTS[it?.id]?.complexity || 0);
export const examineBonus = (p) => examineScore(p);   // stats.js: mod(int) + bonus(examine)
export function identifyChance(p, it) {
  const dc = examineDc(it), b = examineBonus(p), sturdy = !!ARTIFACTS[it?.id]?.sturdy;
  let known = 0, partial = 0, broke = 0;
  for (let nat = 1; nat <= 20; nat++) {
    const miss = dc - (nat + b);
    if (miss <= 0) known++;
    else if (miss <= 5 || sturdy) partial++;
    else broke++;
  }
  return { known: known / 20, partial: partial / 20, broke: broke / 20 };
}

export function examineArtifact(game, p, it, rng = Math.random) {
  const def = ARTIFACTS[it?.id];
  if (it?.kind !== "artifact" || !def || it.broken) return { ok: false, known: it?.known ?? false, broke: !!it?.broken };
  if (it.known === true) return { ok: true, known: true, broke: false };
  const nat = 1 + Math.floor(rng() * 20), total = nat + examineBonus(p), dc = examineDc(it), margin = dc - total;
  let broke = false;
  if (margin <= 0) it.known = true;
  else if (margin <= 5 || def.sturdy) it.known = "class";
  else { it.broken = true; broke = true; it.on = false; }
  invalidateStats(p);
  return { ok: it.known === true, known: it.known, broke, nat, total, dc, margin };
}

export function identify(game, it) {
  if (it?.kind !== "artifact" || it.broken) return false;
  it.known = true;
  if (game?.player) invalidateStats(game.player);
  return true;
}

// --- Cells and charge ---------------------------------------------------------------------------------
export const cellOf = (it) => (it?.kind === "cell" ? it : it?.cell || null);
export const chargeOf = (it) => cellOf(it)?.charge || 0;
export const cellMax = (cell) => CELLS[cell?.id]?.charge || 0;
export const needs = (it) => ARTIFACTS[it?.id]?.charge || 0;
const fits = (def, cell) => !def.cells || def.cells.includes(cell.id);

export function loadCell(game, p, it) {
  const def = ARTIFACTS[it?.id];
  if (!def || !needs(it)) return true;
  if (chargeOf(it) >= needs(it)) return true;
  const best = (p.inv || []).filter((c) => c.kind === "cell" && fits(def, c) && c.charge >= needs(it)).sort((a, b) => b.charge - a.charge)[0];
  if (!best) return false;
  const old = it.cell;
  takeOne(p, best);
  it.cell = { id: best.id, charge: best.charge };
  if (old) addToInventory(p, { kind: "cell", id: old.id, charge: old.charge });
  game.log(`You slot the ${CELLS[best.id].name} into the ${artifactName(it)}.`, [200, 190, 255]);
  return true;
}

// (the Recharge power, B1, C4 #9: sun and dark cells from glim too; a heart cell never)
const fillable = (p, def) => !!def && (def.recharge === "glim" || ((def.recharge === "sun" || def.recharge === "dark") && hasKey(p.perks, "recharge")));
export function fillCell(game, p, cell) {
  const def = CELLS[cell?.id];
  if (!fillable(p, def)) return 0;
  const room = def.charge - cell.charge, glim = Math.min(Math.ceil(room / CHARGE_PER_GLIM), funds(p));
  if (glim <= 0 || !pay(game, p, glim)) return 0;
  cell.charge = Math.min(def.charge, cell.charge + glim * CHARGE_PER_GLIM);
  return glim;
}

// Sun and dark cells drink what they are named for. Exact for any split of the time (skipTime too): the
// daylight part of [t0, t1] comes from the clock, the dark part from your torch for the whole interval.
export function rechargeCells(game, p, t0, t1) {
  if (!(t1 > t0) || !p) return;
  const zone = game.zone, sky = !!zone?.outdoor && !zoneIsLightless(zone);
  const sun = sky ? (t1 - t0) - nightSeconds(t0, t1) : 0, dark = p.torch ? 0 : t1 - t0;
  for (const it of carried(p)) {
    const cell = cellOf(it), def = CELLS[cell?.id];
    if (!def) continue;
    const s = def.recharge === "sun" ? sun : def.recharge === "dark" ? dark : 0;
    if (s > 0) cell.charge = Math.min(def.charge, cell.charge + (RECHARGE * s) / MINUTE);
  }
}

// Something switched on drains as it runs; empty, it goes out.
function drainRunning(game, p, t0, t1) {
  for (const it of p?.inv || []) {
    if (it.kind !== "artifact" || !it.on) continue;
    const def = ARTIFACTS[it.id], cell = it.cell;
    const cost = (def.charge * (t1 - t0)) / MINUTE;
    if (cell && cell.charge >= cost) { cell.charge -= cost; continue; }
    if (cell) cell.charge = 0;
    it.on = false;
    game.log(`The ${artifactName(it)} flickers and goes out: its cell is empty.`, [170, 170, 170]);
  }
  syncRunning(game, p);
}
on("clock:tick", (game, { t0, t1 }) => { rechargeCells(game, game.player, t0, t1); drainRunning(game, game.player, t0, t1); });

// What runs lends its bonuses (the lantern-mote's light) as a status of its own, "running:<id>": a status keeps the stat
// cache right by itself, and the HUD shows it in either view. syncRunning puts the statuses in line with the pack: one
// per artifact switched on in it with charge; anything that left the pack (dropped: at once, through the bus's
// "drop"; sold or taken: by the next tick of the clock) is switched off.
const RUNNING = Object.keys(ARTIFACTS).filter((id) => ARTIFACTS[id].per && ARTIFACTS[id].bonus);
const RUN_T = 1e9;   // (finite: a save holds plain JSON, and Infinity isn't)
for (const id of RUNNING) registerStatus(`running:${id}`, { color: [255, 230, 160], kind: "good", t: RUN_T, stack: "refresh",
  bonus: () => ({ ...ARTIFACTS[id].bonus }), hud: () => ARTIFACTS[id].name.toUpperCase() });
export function syncRunning(game, p) {
  if (!p) return;
  for (const id of RUNNING) {
    const on = (p.inv || []).some((it) => it.kind === "artifact" && it.id === id && it.on && !it.broken && chargeOf(it) > 0);
    const sid = `running:${id}`;
    if (on && !hasStatus(p, sid)) addStatus(game, p, sid, { t: RUN_T });
    else if (!on && hasStatus(p, sid)) removeStatus(game, p, sid);
  }
}
on("drop", (game, { e, item }) => { if (item?.kind === "artifact" && item.on) item.on = false; syncRunning(game, e); });

// --- Names --------------------------------------------------------------------------------------------
export function artifactName(it) {
  const def = ARTIFACTS[it?.id];
  if (!def) return "artifact";
  if (it.broken) return `broken ${it.known === true ? def.name : def.vague.replace(/^(a|an) /, "")}`;
  if (it.known === true) return def.name;
  return def.vague.replace(/^(a|an) /, "") + (it.known === "class" ? ` (${def.class.replace(/^(a|an) /, "")})` : "");
}
const band = (charge, max) => (charge <= 0 ? "empty" : charge >= max ? "full" : charge >= max / 2 ? "over half full" : charge >= max / 5 ? "low" : "nearly empty");
// What you can tell about a cell's charge: the number with a tally-eye, else how full it looks.
export function chargeText(game, cell) {
  if (!cell) return "no cell";
  const name = CELLS[cell.id]?.name || "cell";
  return implantEffect(game?.player, "readsArtifacts") ? `${name}, ${Math.floor(cell.charge)} of ${cellMax(cell)}` : `${name}, ${band(cell.charge, cellMax(cell))}`;
}

// --- Using one ---------------------------------------------------------------------------------------
export function useArtifact(game, p, it) {
  const def = ARTIFACTS[it.id];
  if (it.broken && hasKey(p.perks, "repair")) return mendItem(game, p, it);   // (the Repair power, B1)
  if (it.broken) { game.log(`The ${artifactName(it)} is broken. A tinker might give you a glim or two for it.`, [170, 170, 170]); return 0; }
  if (it.known !== true) {
    const r = examineArtifact(game, p, it);
    if (r.ok) game.log(`You work out what it is: a ${def.name}. ${def.info}`, [200, 190, 255]);
    else if (r.broke) { game.log(`Something inside the ${def.vague.replace(/^(a|an) /, "")} snaps. It's broken.`, [255, 120, 100]); }
    else game.log(`It's ${def.class}, you think, but you can't work out how to use it.`, [190, 180, 230]);
    return EXAMINE_TIME;
  }
  if (def.per) return toggle(game, p, it);
  if (needs(it) && !loadCell(game, p, it)) { game.log(`The ${def.name} needs ${needs(it)} charge (${chargeText(game, it.cell)}), and you have no cell that full.`, [255, 150, 120]); return 0; }
  if (it.id === "glimgun" && funds(p) < 1 && !freeShot(p, it)) { game.log("The glimgun needs a glim from your purse for each shot.", [255, 150, 120]); return 0; }
  if (def.target) return { aim: it };
  return fireArtifact(game, p, it, null);
}

function toggle(game, p, it) {
  const def = ARTIFACTS[it.id];
  if (!it.on && !loadCell(game, p, it)) { game.log(`The ${def.name} needs a charged cell.`, [255, 150, 120]); return 0; }
  it.on = !it.on;
  syncRunning(game, p);
  game.log(it.on ? `The ${def.name} wakes and rises beside you.` : `You put the ${def.name} out.`, [255, 230, 160]);
  return USE_TIME;
}

const AIM_RANGE = { foldKnife: 4, glimgun: 10, lancet: 8 };
// Glimgunner (B1, C4 #9): a glim for every two shots (the first of each pair pays; it.shots counts them).
const freeShot = (p, it) => hasKey(p.perks, "glimgunner") && (it.shots || 0) % 2 === 1;
export function aimArtifact(game, p, it) {
  requestTarget(game, { range: AIM_RANGE[it.id] || 10, target: ARTIFACTS[it.id].target }, (target) => {
    // No target (cancelled, or on the map nothing in sight to aim at): nothing happens, nothing is paid.
    if (!target) { game.log(`You lower the ${ARTIFACTS[it.id].name}: nothing to aim it at.`, [170, 170, 170]); return; }
    const t = fireArtifact(game, p, it, target);
    if (t && game.mode === "map") mapUseTime(game, t);
  });
}

// Pay its charge, then do it. Returns the time it took (0: nothing happened, nothing paid). An effect returns
// true (done), false (nothing happened) or "free" (done, but it costs no charge: the recall bead's marking).
export function fireArtifact(game, p, it, target) {
  const def = ARTIFACTS[it.id], fn = EFFECTS[it.id];
  if (!def || !fn || it.broken || it.known !== true) return 0;
  if (needs(it) && chargeOf(it) < needs(it)) return 0;
  const done = fn(game, p, it, target);
  if (!done) return 0;
  if (needs(it) && done !== "free") it.cell.charge -= needs(it);
  if (def.consumed) takeOne(p, it);
  return USE_TIME;
}

// --- What each one does (both views: the map's tiles, 3D's aim) -----------------------------------------
const holesNear = (zone, x, y, r) => {
  let n = 0;
  for (let ty = Math.max(0, Math.floor(y - r)); ty <= Math.min(zone.d - 1, Math.floor(y + r)); ty++)
    for (let tx = Math.max(0, Math.floor(x - r)); tx <= Math.min(zone.w - 1, Math.floor(x + r)); tx++) {
      const i = tx + ty * zone.w;
      if (zone.kind[i] !== KIND.HOLE || Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > r) continue;
      if (!zone.holeSeen[i]) n++;
      zone.holeSeen[i] = 1; zone.seen[i] = 1;
    }
  return n;
};
export const markHoles = holesNear;
// Every open space within r (and the walls round it) goes onto the map, as a potion of seeing does for the floor.
function revealNear(zone, x, y, r) {
  let n = 0;
  for (let ty = Math.max(0, Math.floor(y - r)); ty <= Math.min(zone.d - 1, Math.floor(y + r)); ty++)
    for (let tx = Math.max(0, Math.floor(x - r)); tx <= Math.min(zone.w - 1, Math.floor(x + r)); tx++) {
      if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > r) continue;
      if (zone.get(tx, ty, FLOOR_Z) && zone.get(tx, ty, FLOOR_Z + 1)) continue;   // solid at body height
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const nx = tx + ox, ny = ty + oy;
          if (nx < 0 || ny < 0 || nx >= zone.w || ny >= zone.d) continue;
          if (!zone.seen[nx + ny * zone.w]) n++;
          zone.seen[nx + ny * zone.w] = 1;
        }
    }
  return n;
}
const d6 = (n) => { let s = 0; for (let k = 0; k < n; k++) s += 1 + Math.floor(Math.random() * 6); return s; };
// Where you face, flat: 3D's yaw, or on the map the way you last moved (the same yaw).
const facing = (p) => [Math.cos(p.yaw), Math.sin(p.yaw)];
function blink(game, p, fx, fy) {
  const zone = game.zone;
  const at = arrivalPoint(zone, "teleport", { fx, fy, yaw: p.yaw, anchor: { x: p.x, y: p.y }, strict: true,
    ok: (x, y) => !zone.creatures.some((c) => c.tx === x && c.ty === y) });
  if (!at) return false;
  Object.assign(p, { x: at.x, y: at.y, z: at.z, vz: 0 });
  game.travel = null;
  return true;
}

// B1 (C4 #7): the homing pip, the snuffer, the theodolite.
export const HOME_CLEAR = 7, SNUFF_R = 6, SNUFF_T = 20;
const EFFECTS = {
  homingPip(game, p) {
    const s = game.run?.world?.start;
    if (!s) return false;
    if (game.zone.creatures.some((m) => attitude(game, m, p) === "hostile" && Math.hypot(m.x - p.x, m.y - p.y) <= HOME_CLEAR)) {
      game.log(`The pip won't settle: something hostile within ${HOME_CLEAR} tiles.`, [255, 150, 120]);
      return false;
    }
    game.log("The pip leans west, then pulls, and the world folds you home.", [200, 160, 255]);
    changeZone(game, zoneKey(s.wx, s.wy, 0), { how: "start" });
    return true;
  },
  snuffer(game, p) {
    const z = game.zone;
    z.snuffs = (z.snuffs || []).filter((d) => d.until > game.time);
    z.snuffs.push({ x: p.x, y: p.y, r: SNUFF_R, until: game.time + SNUFF_T });
    game.log(`You tip the snuffer. The dark pours out ${SNUFF_R} tiles round, torch or no.`, [150, 140, 190]);
    return true;
  },
  theodolite(game, p) {
    const z = game.zone;
    if (!game.run?.sites) return false;
    let found = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const id of game.run.sitesAt?.get(`${z.wx + dx},${z.wy + dy}`) || []) {
          const site = game.run.sites.get(id);
          if (site && site.kind !== "landmark" && findSite(game, site, "theodolite")) found++;
        }
    reveal(game, z.wx, z.wy, 1);
    game.log(found ? `Through the brass eye: ${found} site${found > 1 ? "s" : ""} in the spans around you go onto your world map.` : "Through the brass eye: nothing in the spans around you that you didn't know of.", [220, 200, 140]);
    return true;
  },
  plumbBob(game, p) {
    const n = holesNear(game.zone, p.x, p.y, 3);
    game.log(n ? `The bob swings and points true down. ${n} hidden drop${n > 1 ? "s" : ""} near you go${n > 1 ? "" : "es"} onto your map.` : "The bob hangs still and points true down. No pits within 3 tiles.", [200, 190, 255]);
    return true;
  },
  quicksilverLevel(game, p) {
    const n = holesNear(game.zone, p.x, p.y, 12);
    game.log(`The quicksilver runs off into every low place. ${n ? `${n} hidden drop${n > 1 ? "s" : ""} show${n > 1 ? "" : "s"} on your map.` : "It finds no pits you didn't know of."}`, [200, 200, 215]);
    return true;
  },
  echoBell(game, p) {
    const n = revealNear(game.zone, p.x, p.y, 10);
    game.log(`The bell rings, and its echo comes back off every wall within 10 tiles${n ? ": they go onto your map" : ""}.`, [220, 200, 140]);
    return true;
  },
  glimgun(game, p, it, target) {
    if (!freeShot(p, it) && !pay(game, p, 1)) return false;
    it.shots = (it.shots || 0) + 1;
    const c = target?.creature;
    if (!c || !touchable(game, c) || ghostHidden(game, c)) { game.log("The glimgun spits a bolt of burning glim into the dark.", [255, 160, 70]); return true; }
    const vs = elementVs(c, "fire"), dmg = Math.max(1, Math.round(d6(2) * (vs === "resist" ? 0.5 : vs === "weak" ? 1.5 : 1)));
    game.log(`A bolt of burning glim hits ${theOf(c)}${vs === "weak" ? " (it burns well)" : vs === "resist" ? " (it barely singes)" : ""}.`, [255, 160, 70]);
    applyDamage(game, c, dmg, { src: p, color: [255, 160, 70] });
    if (c.hp > 0 && vs !== "resist") addStatus(game, c, "burning", { t: 3, src: "player" });
    return true;
  },
  foldKnife(game, p, it, target) {
    const [fx, fy] = facing(p), r = AIM_RANGE.foldKnife;
    let tx = p.x + fx * r, ty = p.y + fy * r;
    if (target?.point) {
      const dx = target.point.x - p.x, dy = target.point.y - p.y, d = Math.hypot(dx, dy);
      if (d > 0.5) { const k = Math.min(1, r / d); tx = p.x + dx * k; ty = p.y + dy * k; }
    }
    if (!blink(game, p, tx, ty)) { game.log("The knife folds, but finds nowhere to put you.", [170, 170, 170]); return false; }
    game.log("The knife folds the space in front of you, and you step through the crease.", [200, 160, 255]);
    return true;
  },
  recallBead(game, p, it) {
    const zone = game.zone, mark = it.mark;
    if (!mark || mark.zone !== zone.key) {
      it.mark = { zone: zone.key, x: p.x, y: p.y };
      game.log(mark ? "The bead forgets the old place and holds this one." : "The bead grows heavy: it holds this place now.", [200, 190, 255]);
      return "free";
    }
    if (!blink(game, p, mark.x, mark.y)) { game.log("The bead pulls, but the way back is shut.", [170, 170, 170]); return false; }
    it.mark = null;
    game.log("The bead pulls you back to the place it held.", [200, 160, 255]);
    return true;
  },
  lancet(game, p, it, target) {
    let [dx, dy] = facing(p);
    if (target?.creature || target?.point) {
      const to = target.creature || target.point, d = Math.hypot(to.x - p.x, to.y - p.y);
      if (d > 0.3) { dx = (to.x - p.x) / d; dy = (to.y - p.y) / d; }
    }
    // The beam runs until the first wall at body height (in either view: the same line over the same tiles).
    const zone = game.zone, bz = Math.floor(p.z) + 1;
    let len = AIM_RANGE.lancet;
    for (let t = 0.25; t <= AIM_RANGE.lancet; t += 0.25)
      if (zone.solid(Math.floor(p.x + dx * t), Math.floor(p.y + dy * t), bz)) { len = t - 0.25; break; }
    const hits = [];
    for (const c of game.zone.creatures) {
      if (!touchable(game, c) || ghostHidden(game, c) || Math.abs(c.z - p.z) > 2) continue;
      const along = (c.x - p.x) * dx + (c.y - p.y) * dy;
      if (along < 0 || along > len) continue;
      if (Math.abs((c.x - p.x) * dy - (c.y - p.y) * dx) <= 0.5 + (c.w || 0.6) / 2) hits.push(c);
    }
    game.log(hits.length ? `A black beam lances out and through the ${hits.map((c) => c.name).join(", ")}.` : "A black beam lances out and hits nothing.", [190, 170, 255]);
    for (const c of hits) applyDamage(game, c, d6(3), { src: p, color: [190, 170, 255] });
    return true;
  },
  stillDial(game, p) {
    for (const c of game.zone.creatures) addStatus(game, c, "stilled", { t: 3 });
    game.log("The dial's one hand stops. So does everything else.", [200, 210, 230]);
    return true;
  },
};
// Effects that are switched on (the lantern-mote) do nothing when fired: toggle runs them.
export const artifactEffects = () => Object.keys(EFFECTS);

// --- Loot (for sites and merchants: WS10, WS6b, C) --------------------------------------------------------
export function makeCell(id, rand = Math.random, full = false) {
  const max = CELLS[id].charge;
  return { kind: "cell", id, charge: full ? max : Math.round(max * (0.2 + 0.8 * rand())) };
}
export function makeArtifact(id, rand = Math.random) {
  const def = ARTIFACTS[id], it = { kind: "artifact", id, known: false, cell: null };
  if (def.charge) {
    const cell = makeCell(def.cells?.[0] || "glim", rand);
    it.cell = { id: cell.id, charge: cell.charge };
  }
  return it;
}
// Something for an Hour site's or a ruin's treasure: an artifact (harder ones deeper), a cell, or an implant (rare).
// Never a true-mark: bible §10.4 names their only sources (site bottoms, floor plans, the vow), about 30 a run.
export function randomBodyMod(rand, level) {
  const roll = rand();
  if (roll < 0.5) {
    const ids = Object.keys(ARTIFACTS).filter((id) => ARTIFACTS[id].complexity <= 1 + Math.floor(level / 3));
    return makeArtifact(ids[Math.floor(rand() * ids.length)], rand);
  }
  if (roll < 0.85) { const ids = Object.keys(CELLS).filter((id) => id !== "heart" || level >= 15); return makeCell(ids[Math.floor(rand() * ids.length)], rand); }
  const ids = Object.keys(IMPLANTS).filter((id) => IMPLANTS[id].grade <= 1 + Math.floor(level / 4));
  return { kind: "implant", id: ids[Math.floor(rand() * ids.length)] };
}

// --- The item kinds ---------------------------------------------------------------------------------------
const VIOLET = [200, 170, 255];
function artifactInfo(game, it) {
  const def = ARTIFACTS[it.id];
  if (!def) return "";
  if (it.broken) return "Broken past using.";
  if (it.known !== true) return `${it.known === "class" ? `It's ${def.class}, but you can't work it.` : "You don't know what it is."} E: examine it (it may break).`;
  return def.info + (def.charge ? ` Each use: ${def.charge}${def.per ? " a minute" : ""} charge (${chargeText(game, it.cell)}).` : "");
}
registerItemKind("artifact", {
  stack: false, weight: () => 2,
  // Readhand (B1, C4 #8): you know one by touch, the moment you pick it up.
  onPickup(game, e, it) {
    if (e === game.player && e.mutations?.readhand && it.known !== true && !it.broken) {
      identify(game, it);
      game.log(`You know it by touch: ${artifactName(it)}.`, [200, 190, 255]);
    }
  },
  name: (game, it) => artifactName(it),
  glyph: (game, it) => ["Θ", it.broken ? [120, 110, 130] : VIOLET],
  info: artifactInfo,
  details(game, it) {
    const def = ARTIFACTS[it.id], p = game?.player;
    if (!def) return [];
    const lines = [artifactInfo(game, it)];
    if (implantEffect(p, "readsArtifacts") || it.known === true) lines.push(`Complexity ${def.complexity}${def.sturdy ? ", sturdy" : ""}.`);
    if (it.known !== true && !it.broken && p) {
      const c = identifyChance(p, it);
      lines.push(`One try: ${Math.round(c.known * 100)}% you work it out, ${Math.round(c.partial * 100)}% you learn only its class, ${Math.round(c.broke * 100)}% it breaks.`);
    }
    if (it.mark) lines.push("The bead holds a place on this floor.");
    if (it.on) lines.push("It is switched on.");
    return lines;
  },
  price: (it) => (it.broken ? 2 : it.known === true ? ARTIFACTS[it.id]?.value || 0 : Math.round((ARTIFACTS[it.id]?.value || 0) / 2)),
  use: (game, e, it) => useArtifact(game, e, it),
  art: { w: 0.34, h: 0.34, art: [" ddd ", "dvVvd", "dVwVd", "dvVvd", " ddd "] },
  palette: (game, it) => (it.broken ? { d: [[70, 66, 76], 0], v: [[90, 86, 100], 0], V: [[110, 104, 120], 0], w: [[130, 124, 140], 0] }
                                    : { d: [[90, 80, 120], 0.1], v: [[150, 120, 220], 0.4], V: [[200, 170, 255], 0.7], w: [[240, 230, 255], 1.0] }),
});
registerItemKind("cell", {
  stack: false, weight: () => 1,
  name: (game, it) => CELLS[it.id]?.name || "cell",
  glyph: (game, it) => ["≡", it.id === "sun" ? [255, 220, 110] : it.id === "dark" ? [130, 120, 190] : it.id === "heart" ? [240, 90, 110] : [230, 180, 70]],
  info: (game, it) => `${CELLS[it.id]?.info || ""} (${chargeText(game, it)})`,
  price: (it) => Math.round((CELLS[it.id]?.value || 0) * (0.25 + 0.75 * chargeOf(it) / (cellMax(it) || 1))),
  use(game, e, it) {
    const def = CELLS[it.id];
    if (!fillable(e, def)) { game.log(`The ${def?.name || "cell"} can't be filled from a purse${def?.recharge === "sun" || def?.recharge === "dark" ? " (the Recharge power could)" : ""}.`, [170, 170, 170]); return 0; }
    if (it.charge >= def.charge) { game.log(`The ${def.name} is full.`, [170, 170, 170]); return 0; }
    const glim = fillCell(game, e, it);
    if (!glim) { game.log("Your purse is dry.", [255, 150, 120]); return 0; }
    game.log(`You pour ${formatPrice(glim)} into the ${def.name}. (${chargeText(game, it)})`, [230, 180, 70]);
    return USE_TIME;
  },
  art: { w: 0.24, h: 0.34, art: [" ccc ", "cCCCc", "cyyyc", "cCCCc", "cyyyc", " ccc "] },
  palette: (game, it) => ({ c: [[120, 120, 135], 0.1], C: [[170, 170, 185], 0.2],
    y: [it.id === "sun" ? [255, 220, 110] : it.id === "dark" ? [130, 120, 190] : it.id === "heart" ? [240, 90, 110] : [230, 180, 70], 0.8] }),
});
