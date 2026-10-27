// The mutations' abilities (TECH_DESIGN §2.8; bible §13.5; WS4): what content/mutations.js names in `ability`, given by
// abilities.js's "mutations" source at the mutation's level (a mental one's with EGO's levels). Each works in both
// views with the same cooldown seconds: in 3D on what you aim at (abilities.js aimTarget), on the map on what
// requestTarget picks (the nearest hostile you see; WS8's target screen at the merge) or the way you face, and the
// map charges its mapTime. Fold Step, the P0 sample, stays in abilities.js.
//
//   fling        Thistlehide: quills into every tile around you, 1-3 + floor(level / 2) each
//   wingsUp      Wings: flying (status.js) for 20 + 5 × level s
//   bellows      Bellows Throat: a 3-tile cone of fire, level d4 and burning; braziers in it catch
//   flatwise     Flatwise: pressed flat (status.js "flat") for 3 + floor(level / 2) s: the map view only
//   echo         Echo Throat: every creature within 6 + level tiles shows on the map (a sighting), lit or not
//   overlook     Overlook: a 9 × 9 area up to 20 tiles off is drawn onto the map, with what stands in it
//   shadowsense  Shadowsense: for 8 + 2 × level s, every flat being and ghost on the floor (bible §13.5: "in every
//                view", no reach given) shows in both views (a mark over each in 3D, a sighting on the map), refreshed every half second
//   kindle       Kindle: the nearest cold brazier within 5 + level tiles of what you aim at (3D) or of you (the
//                map) catches, as if you had walked up with your torch
import { registerAbility } from "../abilities.js";
import { registerStatus, addStatus, hasStatus, statusFlag } from "../status.js";
import { hostilesTo, isFlat, isGhostly, canTalk } from "../creatures.js";
import { applyDamage, combatRng } from "../combat.js";
import { usableAt, useColumn } from "../interact.js";
import { refreshView } from "../turns.js";
import { B } from "../world.js";
import { distance } from "../rng.js";

const say = (game, e, text, color = [190, 170, 255]) => { if (e === game.player) game.log(text, color); };
const tileOf = (c) => ({ x: Math.floor(c.x), y: Math.floor(c.y) });
const sight = (game, c) => game.zone.sightings.set(c.id, { x: c.x, y: c.y, glyph: c.glyph, color: c.color, name: c.name, time: game.time });
const mapped = (game) => { if (game.mode === "map") refreshView(game); };

// Where an ability points, flat on the floor plan: 3D the aim (its dir), the map toward the target creature or the
// tile picked (WS8's target screen; the P0 stub gives creatures only), else the way you face.
const pickedTile = (game, target) => (game.mode === "map" && !target?.creature && target?.tile ? { x: target.tile.x + 0.5, y: target.tile.y + 0.5 } : null);
function heading(game, e, target) {
  if (game.mode !== "map" && target?.dir) {
    const [dx, dy] = target.dir, d = Math.hypot(dx, dy);
    if (d > 1e-6) return [dx / d, dy / d];
  }
  const c = target?.creature || pickedTile(game, target);
  if (c) { const d = distance(c.x - e.x, c.y - e.y); if (d > 1e-6) return [(c.x - e.x) / d, (c.y - e.y) / d]; }
  return [Math.cos(e.yaw), Math.sin(e.yaw)];
}
// A tile an ability reaches for: 3D where the aim meets the world (or a creature in the crosshair), the map the
// target's tile, else `ahead` tiles the way you face; inside the zone and at most `range` from you.
function aimedTile(game, e, target, range, ahead) {
  let x, y;
  const picked = pickedTile(game, target);
  if (target?.creature) ({ x, y } = target.creature);
  else if (picked) ({ x, y } = picked);
  else if (game.mode !== "map" && target?.point) ({ x, y } = target.point);
  else { x = e.x + Math.cos(e.yaw) * ahead; y = e.y + Math.sin(e.yaw) * ahead; }
  const d = distance(x - e.x, y - e.y);
  if (d > range) { x = e.x + ((x - e.x) * range) / d; y = e.y + ((y - e.y) * range) / d; }
  const zone = game.zone;
  return { x: Math.max(0, Math.min(zone.w - 1, Math.floor(x))), y: Math.max(0, Math.min(zone.d - 1, Math.floor(y))) };
}

// A cold brazier in the column (x, y): the z of it, or −1.
function coldBrazier(game, x, y) {
  const z = usableAt(game, x, y);
  return z >= 0 && game.zone.get(x, y, z) === B.BRAZIER ? z : -1;
}
// Light the brazier in column (x, y) as your torch would (interact.js's use: the puzzle's order counts).
function kindleAt(game, x, y) {
  const p = game.player, torch = p.torch;
  p.torch = true;
  try { return !!useColumn(game, x, y); } finally { p.torch = torch; }
}

// --- Thistlehide: Fling ------------------------------------------------------------------------------------------
registerAbility("fling", {
  name: "Fling", source: "mutation", target: "self", radius: 1, mapTime: 0.5,
  cooldown: () => 10,
  info: (l) => `Quills into every tile around you: 1-3 + ${Math.floor(l / 2)} each.`,
  use(game, e, lvl) {
    const me = tileOf(e), rng = combatRng(game);
    const near = (e === game.player ? hostilesTo(game, e) : []).filter((c) => {
      const t = tileOf(c);
      return Math.max(Math.abs(t.x - me.x), Math.abs(t.y - me.y)) === 1 && Math.abs(c.z - e.z) < 2;
    });
    let hit = 0;
    for (const c of near) if (applyDamage(game, c, 1 + Math.floor(rng() * 3) + Math.floor(lvl / 2), { src: e, color: [150, 200, 90] }) > 0) hit++;
    if (!hit) { say(game, e, "There's nothing next to you for your quills to find."); return false; }
    say(game, e, `You shake out your quills: ${hit === 1 ? "one of them sticks" : `${hit} of them stick`}.`);
    return true;
  },
});

// --- Wings ------------------------------------------------------------------------------------------------------
registerAbility("wingsUp", {
  name: "Wings", source: "mutation", target: "self", mapTime: 0.5,
  cooldown: () => 60,
  info: (l) => `Fly for ${20 + 5 * l} s (Space rises, C sinks in 3D), then glide down.`,
  use(game, e, lvl) {
    addStatus(game, e, "flying", { t: 20 + 5 * lvl, stack: "max" });
    say(game, e, "Your wings unfold and lift you.");
    return true;
  },
});

// --- Bellows Throat ---------------------------------------------------------------------------------------------
const CONE = Math.cos((35 * Math.PI) / 180);
registerAbility("bellows", {
  name: "Bellows", source: "mutation", target: "dir", range: 3, mapTime: 1,
  cooldown: () => 15,
  info: (l) => `A 3-tile cone of fire: ${l}d4 and burning to what it reaches; braziers catch.`,
  use(game, e, lvl, target) {
    const [hx, hy] = heading(game, e, target), rng = combatRng(game), reach = 3.5;
    const inCone = (x, y) => {
      const dx = x - e.x, dy = y - e.y, d = distance(dx, dy);
      return d <= reach && d > 0.3 && (dx * hx + dy * hy) / d >= CONE;
    };
    let hit = 0;
    for (const c of (e === game.player ? hostilesTo(game, e) : [])) {
      if (!inCone(c.x, c.y) || Math.abs(c.z - e.z) > 2) continue;
      let dmg = 0;
      for (let k = 0; k < lvl; k++) dmg += 1 + Math.floor(rng() * 4);
      if (applyDamage(game, c, dmg, { src: e, color: [255, 150, 60] }) > 0) {
        hit++;
        if (game.zone.creatures.includes(c)) addStatus(game, c, "burning", { t: 3, src: "player" });   // (yours: monsters.js makes its kill yours; "player", not you: a status is saved with its creature)
      }
    }
    let lit = 0;
    if (e === game.player) {
      const tx = Math.floor(e.x), ty = Math.floor(e.y);
      for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++)
        if (inCone(x + 0.5, y + 0.5) && coldBrazier(game, x, y) >= 0 && kindleAt(game, x, y)) lit++;
    }
    say(game, e, hit ? `You breathe fire: ${hit === 1 ? "something burns" : `${hit} things burn`}.` : lit ? "You breathe fire into the brazier." : "You breathe a gout of fire into the air.");
    return true;
  },
});

// --- Flatwise ---------------------------------------------------------------------------------------------------
registerAbility("flatwise", {
  name: "Flatwise", source: "mutation", target: "self", mapTime: 0.5,
  cooldown: () => 30,
  info: (l) => `Press yourself Flat for ${3 + Math.floor(l / 2)} s: the map only, deep blows pass through you.`,
  use(game, e, lvl) {
    if (statusFlag(e, "flat")) { say(game, e, "You're as flat as you can get."); return false; }
    addStatus(game, e, "flat", { t: 3 + Math.floor(lvl / 2) });   // (its onStart turns the view to the map)
    return true;
  },
});

// --- Echo Throat ------------------------------------------------------------------------------------------------
registerAbility("echo", {
  name: "Echo", source: "mutation", target: "self", mapTime: 0.5,
  cooldown: () => 20,
  info: (l) => `A shout: everything within ${6 + l} tiles shows on the map, lit or not.`,
  use(game, e, lvl) {
    if (e !== game.player) return false;
    const r = 6 + lvl;
    const heard = game.zone.creatures.filter((c) => !canTalk(c) && distance(c.x - e.x, c.y - e.y) <= r);
    for (const c of heard) sight(game, c);
    mapped(game);
    say(game, e, heard.length ? `Your shout comes back off ${heard.length === 1 ? "one shape" : `${heard.length} shapes`}: they're on your map.` : "Your shout comes back off nothing alive.");
    return true;
  },
});

// --- Overlook ---------------------------------------------------------------------------------------------------
registerAbility("overlook", {
  name: "Overlook", source: "mutation", target: "tile", range: 20, mapTime: 1,
  cooldown: (l) => Math.max(10, 32 - 2 * l),
  info: (l) => `See a 9 × 9 area from above, up to 20 tiles off: it's drawn onto the map (every ${Math.max(10, 32 - 2 * l)} s).`,
  use(game, e, lvl, target) {
    if (e !== game.player) return false;
    const zone = game.zone, at = aimedTile(game, e, target, 20, 10);
    for (let y = at.y - 4; y <= at.y + 4; y++)
      for (let x = at.x - 4; x <= at.x + 4; x++) if (x >= 0 && y >= 0 && x < zone.w && y < zone.d) zone.seen[x + y * zone.w] = 1;
    const there = zone.creatures.filter((c) => !canTalk(c) && Math.abs(Math.floor(c.x) - at.x) <= 4 && Math.abs(Math.floor(c.y) - at.y) <= 4);
    for (const c of there) sight(game, c);
    mapped(game);
    say(game, e, `You look down on the floor around (${at.x}, ${at.y}) from above${there.length ? `: ${there.length === 1 ? "something stands" : `${there.length} things stand`} there` : ""}.`);
    return true;
  },
});

// --- Shadowsense ------------------------------------------------------------------------------------------------
// A status: every half second (of game time, in either view) each flat being or ghost within reach is marked: a
// glyph over it in 3D (drawn through walls) and a sighting on the map.
registerStatus("shadowsense", { color: [190, 180, 255], kind: "good", t: 10,
  hud: (s) => `SENSE ${Math.ceil(s.t)}s`, ended: "The shadows fold back out of sight.",
  tick(game, e, s, dt) {
    if (e !== game.player || !game.zone) return;
    s.acc += dt;
    if (s.acc < 0.5 && s.marked) return;
    s.acc = 0; s.marked = true;
    for (const c of game.zone.creatures) {
      if (!(isFlat(c) || isGhostly(c))) continue;
      sight(game, c);
      game.effects.push({ kind: "damage", x: c.x, y: c.y, z: c.z + (c.h ?? 1) + 0.3, text: c.glyph, color: [190, 180, 255], time: game.time });
    }
  } });
registerAbility("shadowsense", {
  name: "Shadowsense", source: "mutation", target: "self", mapTime: 0.5,
  cooldown: () => 60,
  info: (l) => `For ${8 + 2 * l} s, every flat being and ghost on this floor shows in every view.`,
  use(game, e, lvl) {
    if (hasStatus(e, "shadowsense")) { say(game, e, "You're sensing the shadows already."); return false; }
    addStatus(game, e, "shadowsense", { t: 8 + 2 * lvl, mag: lvl });
    say(game, e, "You feel for whatever lies flat or has no body.");
    return true;
  },
});

// --- Kindle -----------------------------------------------------------------------------------------------------
registerAbility("kindle", {
  name: "Kindle", source: "mutation", target: "tile", range: 6, rangeFor: (l) => 5 + l, mapTime: 0.5,
  cooldown: () => 5,
  info: (l) => `Light a cold brazier up to ${5 + l} tiles away with a thought.`,
  use(game, e, lvl, target) {
    if (e !== game.player) return false;
    const r = 5 + lvl, zone = game.zone;
    // 3D: the brazier nearest where you aim (within a tile and a half of it); the map: the one on the tile picked
    // (WS8's target screen), else the nearest one you've seen.
    const from = pickedTile(game, target) || (game.mode !== "map" && target?.point ? target.point : null);
    let best = null, bd = Infinity;
    const tx = Math.floor(e.x), ty = Math.floor(e.y);
    for (let y = ty - r; y <= ty + r; y++)
      for (let x = tx - r; x <= tx + r; x++) {
        if (x < 0 || y < 0 || x >= zone.w || y >= zone.d || distance(x + 0.5 - e.x, y + 0.5 - e.y) > r + 0.5) continue;
        if (coldBrazier(game, x, y) < 0) continue;
        if (from ? distance(x + 0.5 - from.x, y + 0.5 - from.y) > 1.5 : !zone.seen[x + y * zone.w]) continue;
        const d = from ? distance(x + 0.5 - from.x, y + 0.5 - from.y) : distance(x + 0.5 - e.x, y + 0.5 - e.y);
        if (d < bd) { bd = d; best = { x, y }; }
      }
    if (!best) { say(game, e, from ? "There's no cold brazier where you're looking." : `There's no cold brazier you know of within ${r} tiles.`); return false; }
    return kindleAt(game, best.x, best.y);
  },
});
