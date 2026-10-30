// World liquids (TECH_DESIGN §2.10 "World liquids are separate from money", §2.2 zone.liquid / zone.liquids;
// DECISIONS §1: one dominant liquid per tile, no mixing; liquids are the factions' sacraments for the Kindling and
// the base of tonics; bible §13.7; owner WS6b). The data is content/liquids.js.
//
//   liquidAt(zone, x, y) → liquidId     which liquid the water blocks of column (x, y) hold: zone.liquids[x + y ×
//                                       zone.w] (WS2 sets them; a plain object, so it is JSON), else the zone's
//                                       default zone.liquid, else "water" (fresh water)
//   liquidDef(id) → def | null          the table's entry, through `sameAs` ("water" is fresh water)
//   sameLiquid(a, b) → bool             one liquid under two ids ("water" and "freshWater")
//   liquidName(id) → string
//   sacramentOf(factionId) → liquidId | "any" | null    content/factions.js `liquid` ("any, poured": the Unlit)
//   isSacrament(factionId, liquidId) → bool
//   drinkLiquid(game, e, id) → line     what drinking one vial of it does (bible §13.7, with the statuses the game
//                                       has: see below); the line is logged for you
//
//   pourLiquid(game, e, id, x, y) → line   a vial poured out (dropped from the pack, or in the Kindling's Pouring): a
//                                       puddle where it lands (zone.props, kind "puddle_<id>": drawn in both views, named
//                                       on the map) and its touch on whoever stands there; brine pours a line of 3
//   touchLiquid(game, e, id) → line     what stepping into it does (a puddle, or a pool of zone.liquids)
//   lightPuddle(game, x, y) → bool      a glim or clear-glim puddle set alight (the Oil fire power: L on it, torch lit)
//
// Drinking applies content/liquids.js effects.drink (B3, C2 #9; bible §13.7): heal, hurt, a status (after s seconds,
// its time perTou a TOU modifier, light: only in bright light), again (a second within s seconds), the turnwater's
// re-roll (the Bent: one random mutation for another; the Plumb: one implant's bonuses gone for a world day), clear
// glim's sight of the Plane (seePlane: flat beings marked in 3D and on the map for 30 min, as Shadowsense marks them)
// and the Lampless' −100 when one of them sees you drink it. The new statuses: glowing (a light of 1 tile with the
// torch out, 10 s), nausea (3 s: half speed, no drinking), confused (5 s: in 3D your heading drifts; the map's steps
// wait on turns.js), stained (30 s: seen at twice the range).
// Touch (pools and puddles): glim slips you (an AGI save, d20 + AGI modifier ≥ 12, or 1 s stunned) and burns 6 s once
// lit (clear glim 12), setting fire to what stands in it; brine's line holds a ghost or a shade standing on it; ink and
// blood stain you; blood draws the Saltbeasts within 20 tiles to you; umbra is a hole of dark (your torch shrinks in it);
// quicksilver runs to the low places and shows the pits within 3 tiles on the map; sunwine and sap stick you for 1 s;
// fresh water washes off stains and puts out fire; turnwater turns a creature it is poured on into another of its
// level. Ink's shortcut for flat beings waits on their movement (docs/b3.md). No liquid is money.
import { LIQUIDS } from "../content/liquids.js";
import { FACTIONS } from "../factions.js";
import { addStatus, registerStatus, removeStatus, hasStatus, statusOf } from "../status.js";
import { maxHp, mod, invalidateStats, registerBonusSource } from "../stats.js";
import { itemBonuses, addToInventory } from "../items.js";
import { on, registerUpdate } from "../events.js";
import { PROPS } from "../content/biomes.js";
import { MUTATIONS } from "../content/mutations.js";
import { FLOOR_Z } from "../world.js";
import { KIND } from "../blocks.js";
import { inDark } from "../light.js";
import { hashInt } from "../rng.js";
import { spawnCreature, addCreature, removeCreature, isGhostly, sees, pickCreatureType } from "../creatures.js";
import { addRep, membershipsOf } from "../factions.js";
import { worn } from "../body.js";
import * as mutations from "../progression/mutations.js";
import { installedImplants } from "../bodymods/implants.js";

export function liquidAt(zone, x, y) {
  const own = zone?.liquids?.[x + y * (zone?.w || 0)];
  return own || zone?.liquid || "water";
}

export function liquidDef(id) {
  const d = LIQUIDS[id];
  return d?.sameAs ? LIQUIDS[d.sameAs] || null : d || null;
}
const canon = (id) => LIQUIDS[id]?.sameAs || id;
export const sameLiquid = (a, b) => !!a && !!b && canon(a) === canon(b);
export const liquidName = (id) => liquidDef(id)?.name || id || "nothing";

export function sacramentOf(factionId) {
  const l = FACTIONS[factionId]?.liquid;
  if (!l) return null;
  return /^any\b/.test(l) ? "any" : l;
}
export function isSacrament(factionId, liquidId) {
  const s = sacramentOf(factionId);
  return !!liquidId && (s === "any" ? !!liquidDef(liquidId) : sameLiquid(s, liquidId));
}

registerStatus("nightEyes", { color: [150, 130, 210], kind: "good", t: 60, bonus: () => ({ darkSight: 1 }),
  hud: (s) => `NIGHT EYES ${Math.ceil(s.t)}s`, ended: "The dark closes in again." });

const heal = (e, n) => { const before = e.hp; e.hp = Math.min(maxHp(e), e.hp + n); return e.hp - before; };
const hurt = (game, e, n, source) => { if (e === game.player) game.hurtPlayer(n, source); else e.hp -= n; };
const isYou = (game, e) => e === game.player;
const secs = (s) => Math.max(0, Math.ceil(s.t));

// --- The statuses §13.7 asks for ------------------------------------------------------------------------------------
registerStatus("nightEyes", { color: [150, 130, 210], kind: "good", t: 60, bonus: () => ({ darkSight: 1 }),
  hud: (s) => `NIGHT EYES ${Math.ceil(s.t)}s`, ended: "The dark closes in again." });
// A light of radius 1: with the torch out, you see a tile round you (player.js torchRange reads darkSight × 1.5).
registerStatus("glowing", { color: [255, 220, 110], kind: "bad", t: 10, bonus: () => ({ darkSight: 0.7 }),
  hud: (s) => `GLOWING ${secs(s)}s`, ended: "The glow in your mouth goes out." });
registerStatus("nausea", { color: [170, 200, 110], t: 3, stack: "max", speed: 0.5, hud: (s) => `NAUSEA ${secs(s)}s`, ended: "Your stomach settles." });
registerStatus("confused", { color: [200, 160, 230], t: 5, stack: "max", hud: (s) => `CONFUSED ${secs(s)}s`, ended: "Your head clears." });
registerStatus("stained", { color: [90, 90, 140], t: 30, stack: "refresh", bonus: () => ({ stealth: -0.5 }), hud: (s) => `STAINED ${secs(s)}s`,
  ended: "The stain fades enough not to matter." });
// The Plane, seen: every half second each flat being on the floor within 16 tiles is marked over its head in 3D and
// on the map (as Shadowsense marks them; progression/abilities.js).
registerStatus("seePlane", { color: [255, 250, 225], kind: "good", t: 1800, hud: (s) => `PLANE ${Math.ceil(s.t / 60)}m`,
  ended: "The floor thickens again. The flat ones are only shadows.",
  tick(game, e, s, dt) {
    if (e !== game.player || !game.zone) return;
    s.acc += dt;
    if (s.acc < 0.5 && s.marked) return;
    s.acc = 0; s.marked = true;
    for (const c of game.zone.creatures) {
      if (!c.vis?.flat || Math.hypot(c.x - e.x, c.y - e.y) > 16) continue;
      game.zone.sightings?.set?.(c.id, { x: c.x, y: c.y, glyph: c.glyph, color: c.color, name: c.name, time: game.time });
      game.effects.push({ kind: "damage", x: c.x, y: c.y, z: c.z + 0.6, text: c.glyph, color: [255, 250, 225], time: game.time });
    }
  } });
// A status that starts later (umbra's blindness after 60 s): the record waits on the entity, e.later = [{ at, id, t, light }].
function later(game, e, eff, t) { (e.later ||= []).push({ at: (game.time || 0) + eff.after, id: eff.status, t, light: !!eff.light }); }
on("clock:tick", (game) => {
  const p = game.player;
  if (!p?.later?.length) return;
  const now = game.time || 0, due = p.later.filter((l) => l.at <= now);
  if (!due.length) return;
  p.later = p.later.filter((l) => l.at > now);
  for (const l of due) {
    if (l.light && (!game.zone || inDark(game, game.zone, p.x, p.y, p.z + 0.5))) continue;   // (in the dark nothing comes of it)
    addStatus(game, p, l.id, { t: l.t, stack: "max" });
    if (l.id === "blinded") game.log("The light comes at you all at once. You can't see.", [200, 190, 230]);
  }
});
// Confused, in 3D: your heading drifts as you go (the map's steps need turns.js: docs/b3.md).
registerUpdate("liquids:confused", (game, dt) => {
  const p = game.player;
  if (!p || game.view === "map" || !hasStatus(p, "confused")) return;
  const s = statusOf(p, "confused");
  s.drift = (s.drift || 0) + dt;
  if (s.drift < 0.25) return;
  s.drift = 0;
  p.yaw += ((hashInt(Math.floor((game.time || 0) * 4), "confused") % 7) - 3) * 0.06;
}, { modes: ["explore"] });

// --- The turnwater ------------------------------------------------------------------------------------------------
// The Bent: one random mutation (not a defect) for another the body could take, at level 1. The Plumb: one implant's
// bonuses taken away for a world day (it still fits; its ability and its own effect wait on WS5's implants.js: b3.md).
function reroll(game, e) {
  const have = Object.keys(e.mutations || {}).filter((id) => !mutations.isDefect(id));
  if (!have.length) return "Something in you turns over, finds nothing to turn, and settles.";
  const n = (e.rerolls = (e.rerolls || 0) + 1), old = have[hashInt(game.seed ?? 0, "turnwater", n) % have.length];
  const level = e.mutations[old];
  delete e.mutations[old];
  e.creases = (e.creases || 0);
  if (MUTATIONS[old]?.ability && e.hotbar) e.hotbar = e.hotbar.map((a) => (a === MUTATIONS[old].ability ? null : a));
  invalidateStats(e);
  const open = Object.keys(MUTATIONS).filter((id) => id !== old && !mutations.isDefect(id) && !mutations.canGain(null, { ...e, creases: 99 }, id)).sort();
  if (!open.length) return `${MUTATIONS[old].name} turns over in you and is gone.`;
  const id = open[hashInt(game.seed ?? 0, "turnwater:new", n) % open.length];
  e.creases += MUTATIONS[id].cost ?? 0;   // (the turn costs no creases: it is the old one's, re-angled)
  mutations.gainMutation(isYou(game, e) ? game : null, e, id);
  return `${MUTATIONS[old].name}${level > 1 ? ` (level ${level})` : ""} turns over in you and comes up ${MUTATIONS[id].name}.`;
}
function shutdown(game, e, days) {
  const list = installedImplants(e).filter(({ item }) => !item.shutUntil || item.shutUntil <= (game.time || 0));
  if (!list.length) return "It runs through your fittings and finds nothing to stop.";
  const { item, def } = list[hashInt(game.seed ?? 0, "shutdown", (e.shutdowns = (e.shutdowns || 0) + 1)) % list.length];
  item.shutUntil = (game.time || 0) + days * 24 * 60;
  invalidateStats(e);
  return `Your ${def?.name || "implant"} goes cold and quiet. It will wake in a day.`;
}

// --- Drinking -----------------------------------------------------------------------------------------------------
// Each effect of the liquid's effects.drink, in order; the line is the words of what happened.
function drinkEffect(game, e, id, eff, out) {
  if (eff.heal) out.healed = (out.healed || 0) + heal(e, eff.heal);
  if (eff.hurt) { hurt(game, e, eff.hurt, liquidName(id)); out.hurt = (out.hurt || 0) + eff.hurt; }
  if (eff.status && !eff.again) {
    const t = Math.max(1, eff.t + (eff.perTou ? eff.perTou * mod(e, "tou") : 0));
    if (eff.after) later(game, e, eff, t);
    else { addStatus(game, e, eff.status, { t, stack: "max" }); (out.statuses ||= []).push([eff.status, t]); }
  }
  if (eff.again) {
    const again = e.drankAt?.[id] !== undefined && (game.time || 0) - e.drankAt[id] < eff.again;
    if (again) { addStatus(game, e, eff.status, { t: eff.t, stack: "max" }); out.again = true; }
  }
  if (eff.reroll === "mutation" && e.genotype !== "plumb") out.turn = reroll(game, e);
  if (eff.shutdown === "implant" && e.genotype === "plumb") out.turn = shutdown(game, e, eff.days || 1);
  if (eff.seePlane) addStatus(game, e, "seePlane", { t: eff.seePlane, stack: "refresh" });
  if (eff.rep && eff.seen && isYou(game, e)) {   // only when one of them sees you do it
    for (const [f, n] of Object.entries(eff.rep))
      if (game.zone?.creatures?.some((c) => membershipsOf(c).some(([m]) => m === f) && sees(game, c, e))) { addRep(game, f, n, "liquid"); out.seen = f; }
  }
}
const WORDS = {
  freshWater: (o) => `Cool and clean. (+${o.healed || 0} HP)`,
  glim: () => "Lamp oil. Your mouth glows and your stomach doesn't forgive you. (1 damage; glowing, 10 s)",
  brine: () => "Salt. Your stomach turns over, and keeps turning. (1 damage; nausea, 3 s)",
  ink: (o, e) => `The ink goes down like a closing book. The room swims; in a moment you will be Flat. (confused 5 s, then Flat ${Math.max(1, 60 - 3 * mod(e, "tou"))} s)`,
  umbra: () => "Liquid shadow. The dark opens like an eye. (Night eyes, 60 s; then bright light will blind you a while)",
  quicksilver: () => "Heavy and cold. It finds the lowest place in you. (Poisoned)",
  sunwine: (o) => (o.again ? `Sunwine on sunwine. The sky turns a slow wheel. (+${o.healed || 0} HP, confused)` : `It tastes of noon. (+${o.healed || 0} HP)`),
  turnwater: (o) => o.turn || "Something in you turns over once, and settles.",
  clearGlim: (o) => `It burns clear all the way down, and the floor goes thin as paper: the flat ones show. (30 min)${o.seen ? " Someone in the dark saw that." : ""}`,
  blood: () => "Copper and regret. Nothing good comes of it.",
  longbackMilk: (o) => `Sour and thick. (+${o.healed || 0} HP)`,
  mulchWine: (o) => `The ground tilts and comes back. (+${o.healed || 0} HP)`,
  sap: (o) => `It sticks in the throat. (+${o.healed || 0} HP)`,
};

export function drinkLiquid(game, e, id) {
  const key = canon(id), def = liquidDef(id);
  if (hasStatus(e, "nausea")) {
    const line = "Your stomach won't take anything just now.";
    if (isYou(game, e)) game.log(line, [170, 200, 110]);
    return line;
  }
  const out = {};
  for (const eff of def?.effects?.drink || []) drinkEffect(game, e, key, eff, out);
  (e.drankAt ||= {})[key] = game.time || 0;
  const line = def ? (WORDS[key] ? WORDS[key](out, e) : `You drink the ${liquidName(id)}.`) : `You drink the ${liquidName(id)}. Nothing happens.`;
  if (isYou(game, e)) game.log(line, def?.color || [170, 190, 230]);
  return line;
}

// --- Touch: pools and puddles --------------------------------------------------------------------------------------
export const PUDDLE = { seconds: 240, line: 3 };
const puddleKind = (id) => `puddle_${canon(id)}`;
for (const [id, d] of Object.entries(LIQUIDS)) {
  if (d.sameAs) continue;
  const c = d.color, dim = c.map((v) => Math.round(v * 0.7));
  PROPS[puddleKind(id)] = { name: `a puddle of ${d.name}`, glyph: "~", color: c, art: ["ppPpp", " ppp "],
    palette: { p: [dim, id === "glim" || id === "clearGlim" ? 0.3 : 0], P: [c, 0.4] } };
}
const puddleAt = (zone, x, y) => (zone?.props || []).find((pr) => pr.liquid && Math.floor(pr.x) === x && Math.floor(pr.y) === y) || null;
// The liquid under (x, y): a puddle, else a pool's (water blocks of zone.liquids at the floor).
export function touchedLiquid(zone, x, y) {
  const pd = puddleAt(zone, x, y);
  if (pd) return pd.liquid;
  if (!zone?.liquids || !zone.kind) return null;
  const k = zone.kind[x + y * zone.w];
  return (k === KIND.SHALLOW || k === KIND.DEEP) && zone.liquids[x + y * zone.w] ? zone.liquids[x + y * zone.w] : null;
}

const saltbeast = (c) => membershipsOf(c).some(([f]) => f === "saltbeasts");
export function touchLiquid(game, e, id) {
  const key = canon(id), you = isYou(game, e);
  const parts = [];
  for (const eff of liquidDef(id)?.effects?.touch || []) {
    if (eff.save && you) {
      const roll = 1 + (hashInt(Math.floor((game.time || 0) * 10), "slip", e.id ?? 0) % 20);
      if (roll + mod(e, eff.save) < 12) { addStatus(game, e, eff.fail.status, { t: eff.fail.t, stack: "max" }); parts.push("you slip"); }
    }
    if (eff.status && !eff.save) { addStatus(game, e, eff.status, { t: eff.t, stack: "max" }); parts.push("it holds your feet"); }
    if (eff.stain) { addStatus(game, e, "stained", { t: eff.stain.t, stack: "refresh" }); parts.push("it stains you"); }
    if (eff.clean) { for (const s of ["stained", "glowing", "burning"]) if (hasStatus(e, s)) removeStatus(game, e, s); }
    if (eff.draws && you) for (const c of game.zone.creatures)
      if (saltbeast(c) && Math.hypot(c.x - e.x, c.y - e.y) <= 20) { (c.brain ||= {}).target = e; c.state = "chase"; }
    if (eff.dark && you && e.torch) { addStatus(game, e, "darkened", { t: 1, stack: "max" }); }
    if (eff.seek && you) {
      const z = game.zone, x0 = Math.floor(e.x), y0 = Math.floor(e.y);
      for (let y = y0 - 3; y <= y0 + 3; y++) for (let x = x0 - 3; x <= x0 + 3; x++)
        if (x >= 0 && y >= 0 && x < z.w && y < z.d && z.kind[x + y * z.w] === KIND.HOLE) { z.holeSeen[x + y * z.w] = 1; z.seen[x + y * z.w] = 1; }
      parts.push("it runs off towards the low places");
    }
  }
  return parts.length && you ? `The ${liquidName(key)}: ${parts.join(", ")}.` : "";
}

// A vial poured at (x, y): a puddle (brine: a line of 3 the way you face), and its touch on whoever stands in it.
export function pourLiquid(game, e, id, x = Math.floor(e.x), y = Math.floor(e.y)) {
  const zone = game.zone, key = canon(id);
  if (!zone || !liquidDef(id)) return "";
  zone.props ||= [];
  const ward = (liquidDef(id).effects?.touch || []).find((t) => t.ward);
  const cells = [[x, y]];
  if (ward) {
    const dx = Math.round(Math.cos(e.yaw || 0)), dy = Math.round(Math.sin(e.yaw || 0));
    for (let k = 1; k < ward.ward; k++) cells.push([x + dx * k, y + dy * k]);
  }
  const z = Math.floor(e.z ?? FLOOR_Z);
  for (const [cx, cy] of cells) {
    if (cx < 0 || cy < 0 || cx >= zone.w || cy >= zone.d || zone.kind?.[cx + cy * zone.w] === KIND.WALL) continue;
    const old = puddleAt(zone, cx, cy);
    if (old) zone.props.splice(zone.props.indexOf(old), 1);   // (one liquid to a tile: no mixing)
    zone.props.push({ x: cx + 0.5, y: cy + 0.5, z, kind: puddleKind(key), liquid: key, until: (game.time || 0) + PUDDLE.seconds,
      ...(ward ? { ward: ward.against } : {}) });
  }
  // Poured on a creature: the turnwater turns it (bible §13.7).
  const words = [`You pour out the ${liquidName(key)}.`];
  for (const c of [...zone.creatures]) if (c !== e && cells.some(([cx, cy]) => Math.floor(c.x) === cx && Math.floor(c.y) === cy)) {
    const w = creatureTouch(game, c, key);
    if (w) words.push(w);
  }
  return words.join(" ");
}

// What a puddle does to a creature in it: turnwater turns it into another of its tier; a ward holds a ghost or a shade.
function creatureTouch(game, c, key) {
  for (const eff of liquidDef(key)?.effects?.touch || []) {
    if (eff.transform === "sameTier" && !c.talk && !c.boss && !c.flags?.legend) {
      const tier = Math.min(8, Math.max(1, Math.ceil(((c.level || 1) + 1) / 3)));
      const rng = () => (hashInt(game.seed ?? 0, "transform", c.id, game.time || 0) % 10000) / 10000;
      let type = c.type;
      for (let k = 0; k < 6 && type === c.type; k++) type = pickCreatureType(() => (hashInt(game.seed ?? 0, "transform", c.id, k) % 10000) / 10000, c.level || 1);
      if (type === c.type) return "";
      const n = spawnCreature(type, Math.floor(c.x), Math.floor(c.y), c.z, { rng, level: c.level || 3 * tier - 1, state: "idle" });
      removeCreature(game.zone, c);
      addCreature(game.zone, n);
      return `The ${c.name} turns over, and stands up a ${n.name}.`;
    }
    if (eff.status && !eff.save) addStatus(game, c, eff.status, { t: eff.t, stack: "max" });
  }
  return "";
}

// A glim puddle set alight (Oil fire): it burns 6 s (clear glim 12), and whatever stands in it catches fire.
export function lightPuddle(game, x, y) {
  const pd = puddleAt(game.zone, x, y);
  const burns = pd && (liquidDef(pd.liquid)?.effects?.touch || []).find((t) => t.burns)?.burns;
  if (!burns || pd.lit) return false;
  pd.lit = (game.time || 0) + burns;
  pd.until = Math.min(pd.until, pd.lit);
  game.effects?.push({ kind: "burst", x: pd.x, y: pd.y, z: pd.z + 0.2, color: [255, 160, 60], time: game.time || 0 });
  return true;
}

// Every tick: puddles dry; a lit one sets fire to what stands in it; a ward holds the dead; you touch what you step in.
const stepped = new WeakMap();
on("clock:tick", (game) => {
  const zone = game.zone, p = game.player;
  if (!zone || !p) return;
  const now = game.time || 0;
  if (zone.props?.some((pr) => pr.liquid)) {
    zone.props = zone.props.filter((pr) => !pr.liquid || pr.until > now);
    for (const pr of zone.props) {
      if (!pr.liquid) continue;
      const tx = Math.floor(pr.x), ty = Math.floor(pr.y);
      for (const c of zone.creatures) {
        if (Math.floor(c.x) !== tx || Math.floor(c.y) !== ty) continue;
        if (pr.lit && pr.lit > now) addStatus(game, c, "burning", { t: 1, stack: "max", src: "player" });
        if (pr.ward && (isGhostly(c) || pr.ward.some((k) => String(c.type).toLowerCase().includes(k)))) addStatus(game, c, "pinned", { t: 0.5, stack: "max" });
      }
      if (pr.lit && pr.lit > now && Math.floor(p.x) === tx && Math.floor(p.y) === ty) addStatus(game, p, "burning", { t: 1, stack: "max" });
    }
  }
  const tx = Math.floor(p.x), ty = Math.floor(p.y), last = stepped.get(game), key = `${zone.key}|${tx},${ty}`;
  if (last === key) return;
  stepped.set(game, key);
  const id = touchedLiquid(zone, tx, ty);
  if (!id || Math.abs((p.z ?? FLOOR_Z) - FLOOR_Z) > 1.5 && !puddleAt(zone, tx, ty)) return;
  const line = touchLiquid(game, p, id);
  if (line) game.log(line, liquidDef(id)?.color || [170, 190, 230]);
});

// A filled vial dropped is poured out where you stand (its glass stays in your hand: you keep the empty vial).
on("drop", (game, { e, item }) => {
  if (!item || item.kind !== "vial" || !item.effect || !game.zone) return;
  const id = item.effect;
  item.effect = "";
  game.zone.items = game.zone.items.filter((it) => it !== item);
  e.inv && addToInventory(e, { kind: "vial", effect: "" });
  const line = pourLiquid(game, e, id);
  if (isYou(game, e)) game.log(line, liquidDef(id)?.color || [170, 190, 230]);
});

// The Plumb's shut implants: their bonuses away until they wake (a bonus source that takes them back).
registerBonusSource("liquids:shutdown", function* (e) {
  const now = shutClock.now;
  for (const it of worn(e)) if (it.shutUntil && it.shutUntil > now) {
    const b = itemBonuses(it);
    yield Object.fromEntries(Object.entries(b).filter(([, v]) => typeof v === "number").map(([k, v]) => [k, -v]));
  }
});
const shutClock = { now: 0 };
on("clock:tick", (game) => {
  shutClock.now = game.time || 0;
  const p = game.player;
  if (!p) return;
  for (const it of worn(p)) if (it.shutUntil && it.shutUntil <= shutClock.now) { delete it.shutUntil; invalidateStats(p); game.log("An implant hums back to life.", [200, 210, 230]); }
});
