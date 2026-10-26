// The three guardians (floors 5, 10 and 15). Each waits in its hall, in front of the stairs
// down (behind a gate that opens when it dies), and each makes you use both ways of seeing:
//
//   The Flat Queen (5): a being of the plane, so she can only be fought on the map. But every
//     few seconds she peels herself up out of the floor and stands in 3D, and then only a 3D
//     blow will touch her. She keeps calling flatlings to her side.
//   The Gloom Warden (10): a huge ghost, there only in the dark. With your torch lit it's
//     invisible and nothing touches it, though it can still touch you. Put your torch out and
//     you can fight it, but it calls up shades, and shades see in the dark. Shades burn in
//     firelight: light the hall's braziers (with your torch!), which the Warden keeps snuffing.
//   The Colossus (15): rooted to the spot, armoured in stone. Only the glowing core on its
//     head feels a blow: climb the platforms around it and strike from up high. It slams the
//     ground in rings; the map shows which tiles are about to shake (^), and the platforms
//     are out of reach of the quake.
//
// guardianThink(game, m, dt, occ) runs every update before the usual monster AI (monsters.js);
// returning true would skip the rest of that AI for this update.
import { MONSTER_TYPES, spawnMonster, hitPlayer } from "./monsters.js";
import { B, FLOOR_Z } from "./world.js";
import { sampleLight } from "./light.js";
import { sfx } from "./sfx.js";
import { addStatus, statusFlag } from "./status.js";

const QUEEN_FLAT = 4.5, QUEEN_RISEN = 3;
const SLAM_EVERY = 4.5, SLAM_WARN = 1.5;

export function guardianThink(game, m, dt, occ) {
  if (m.state !== "chase") return false;   // asleep until it notices you (or you hit it)
  if (!m.g) game.onGuardianWakes?.(m);
  m.g ||= { t: 0, summon: m.guardian === "warden" ? 3 : 6, snuff: 10, slam: 2.5, sweep: 0, windup: 0 };
  switch (m.guardian) {
    case "flatqueen": return queen(game, m, dt, occ);
    case "warden": return warden(game, m, dt, occ);
    case "colossus": return colossus(game, m, dt);
  }
  return false;
}

// Monsters appear on free tiles around the guardian (2–4 tiles away).
function summon(game, m, type, n, occ) {
  const { zone } = game, { w, stand } = zone;
  const spots = [];
  for (let oy = -4; oy <= 4; oy++)
    for (let ox = -4; ox <= 4; ox++) {
      const x = m.tx + ox, y = m.ty + oy, d = Math.max(Math.abs(ox), Math.abs(oy));
      if (d < 2 || x < 0 || y < 0 || x >= w || y >= zone.d || stand[x + y * w] !== FLOOR_Z || occ[x + y * w]) continue;
      if (Math.hypot(x + 0.5 - game.player.x, y + 0.5 - game.player.y) < 1.5) continue;
      spots.push([x, y]);
    }
  const made = [];
  for (let k = 0; k < n && spots.length; k++) {
    const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    const o = spawnMonster(type, x, y, stand[x + y * w], "chase", zone.level);
    o.xp = Math.ceil(o.xp / 2);   // summoned things are worth less
    zone.monsters.push(o);
    occ[x + y * w] = o.id;
    made.push(o);
  }
  return made;
}

// --- The Flat Queen -----------------------------------------------------------------------
function queen(game, m, dt, occ) {
  const g = m.g;
  g.t += dt;
  if (!m.risen && g.t >= QUEEN_FLAT) {
    g.t = 0;
    m.risen = true;
    game.log("The Flat Queen peels herself up off the floor and stands, suddenly deep! (Only a blow in 3D will touch her now.)", m.color);
    sfx("rotate", { up: true, at: m });
    for (const o of game.zone.monsters) if (o.type === "flatling") { addStatus(game, o, "blinded", { t: QUEEN_RISEN, stack: "refresh" }); o.state = "wander"; }   // her court scatters
  } else if (m.risen && g.t >= QUEEN_RISEN) {
    g.t = 0;
    m.risen = false;
    game.log("The Flat Queen folds back down into the plane. (Fight her on the map.)", m.color);
    sfx("rotate", { up: false, at: m });
  }
  if (!m.risen && (g.summon -= dt) <= 0) {
    g.summon = 10;
    const court = game.zone.monsters.filter((o) => o.type === "flatling").length;
    if (court < 2 && summon(game, m, "flatling", 2 - court, occ).length) game.log("The Flat Queen calls her court. Flatlings slide out of the cracks in the floor!", m.color);
  }
  return false;
}

// --- The Gloom Warden ---------------------------------------------------------------------
function warden(game, m, dt, occ) {
  const g = m.g, zone = game.zone;
  if ((g.summon -= dt) <= 0) {
    g.summon = 7;
    const shades = zone.monsters.filter((o) => o.type === "shade").length;
    if (shades < 4 && summon(game, m, "shade", 2, occ).length) game.log("The Gloom Warden lifts its lantern. Shades pour out of the dark!", m.color);
  }
  if ((g.snuff -= dt) <= 0) {
    g.snuff = 12;
    const lit = (zone.guardianHall?.braziers || []).filter(([x, y]) => zone.get(x, y, FLOOR_Z) === B.BRAZIER_LIT);
    if (lit.length) {
      const [x, y] = lit[Math.floor(Math.random() * lit.length)];
      zone.set(x, y, FLOOR_Z, B.BRAZIER);
      zone.refresh();
      game.log("A cold wind howls through the hall, and a brazier gutters out.", [170, 190, 255]);
    }
  }
  return false;
}

// Shades hate firelight: standing in a lit brazier's (or lamp's) glow burns them away.
export function fearLight(game, m, dt) {
  const light = sampleLight(game.zone, game.zone.lampLight, m.x, m.y, m.z + 0.6);
  if (light < 0.3) return false;
  m.lightBurn = (m.lightBurn || 0) + dt * 6;
  m.hurt = 0.1;
  if (m.lightBurn >= 1) {
    const n = Math.floor(m.lightBurn);
    m.lightBurn -= n;
    m.hp -= n;
    if (m.hp <= 0) {
      game.zone.monsters = game.zone.monsters.filter((o) => o !== m);
      if (Math.hypot(game.player.x - m.x, game.player.y - m.y) < 14) game.log("A shade shrivels away in the firelight.", [255, 200, 140]);
      return true;
    }
  }
  return false;
}

// --- The Colossus -------------------------------------------------------------------------
// Are you up where its core is (standing at least two blocks above its feet)?
export function colossusCore(game, m) {
  return game.player.z >= m.z + 1.8;
}

function colossus(game, m, dt) {
  const g = m.g, zone = game.zone, p = game.player;
  const hall = zone.guardianHall;
  // A slam: warn (the tiles shake on the map), then the quake.
  if (zone.slam && game.time >= zone.slam.at) {
    const onGround = p.z < FLOOR_Z + 0.5 && !statusFlag(p, "flying");
    const ptile = Math.floor(p.x) + Math.floor(p.y) * zone.w;
    game.effects.push({ kind: "boom", x: m.x, y: m.y, z: m.z, time: game.time });
    sfx("boom", { at: m });
    if (onGround && zone.slam.cells.has(ptile)) {
      game.hurtPlayer(7 + Math.floor(Math.random() * 5) + Math.floor(zone.level / 5), "the Colossus's quake");
    }
    zone.slamDone = { cells: zone.slam.cells, time: game.time };
    zone.slam = null;
    g.slam = SLAM_EVERY;
  } else if (!zone.slam && (g.slam -= dt) <= 0 && hall) {
    // Rings of ground around it, alternating near and far. Platform tops never shake.
    g.ring = g.ring === "near" ? "far" : "near";
    const cells = new Set();
    for (let y = hall.y0; y <= hall.y1; y++)
      for (let x = hall.x0; x <= hall.x1; x++) {
        if (zone.stand[x + y * zone.w] !== FLOOR_Z) continue;
        const d = Math.hypot(x + 0.5 - m.x, y + 0.5 - m.y);
        if (g.ring === "near" ? d < 3.6 : d >= 3.6 && d < 7.5) cells.add(x + y * zone.w);
      }
    zone.slam = { cells, at: game.time + SLAM_WARN, start: game.time };
    game.log(g.ring === "near" ? "The Colossus raises both fists high... (the ground close to it will shake)" : "The Colossus stamps, and cracks race outward... (the far ground will shake)", m.color);
  }
  // A sweep of its arm at you up on a platform (on the ground the usual blow does it). It draws
  // its arm back first: hop down (or back) in time and it sweeps through empty air.
  g.sweep -= dt;
  const flat = Math.hypot(p.x - m.x, p.y - m.y), dz = p.z - m.z;
  const upClose = dz >= 1.3 && dz < 4 && flat < 3.4;
  if (g.windup > 0) {
    if ((g.windup -= dt) <= 0) {
      if (upClose) {
        const t = MONSTER_TYPES[m.type];
        const dmg = t.damage[0] + Math.floor(Math.random() * (t.damage[1] - t.damage[0] + 1)) + (m.bonus || 0);
        hitPlayer(game, m, dmg, "the Colossus's sweeping arm", "its sweeping arm");
      } else game.log("The Colossus's arm sweeps through empty air.", [200, 200, 200]);
    }
  } else if (g.sweep <= 0 && upClose) {
    g.sweep = 3.2;
    g.windup = 1.0;
    game.log("The Colossus draws back a huge stone arm...", m.color);
  }
  return false;
}

// 3D: the shaking ground before a slam (dust and grit over every tile about to quake), and
// the burst of rubble right after.
export function guardianSprites(game) {
  const zone = game.zone, out = [];
  const add = (cells, color, glow) => {
    for (const c of cells) {
      const x = c % zone.w, y = (c - x) / zone.w;
      if (Math.hypot(x + 0.5 - game.player.x, y + 0.5 - game.player.y) > 14) continue;
      out.push({ x: x + 0.5, y: y + 0.5, z: FLOOR_Z, w: 0.9, h: 0.18, art: [" c c c ", "ccccccc"], palette: { c: [color, glow] } });
    }
  };
  if (zone.slam) {
    const blink = Math.floor((game.time - zone.slam.start) * 8) % 2 === 0;
    add(zone.slam.cells, blink ? [255, 170, 60] : [180, 110, 50], 0.6);
  }
  if (zone.slamDone && game.time - zone.slamDone.time < 0.4) add(zone.slamDone.cells, [200, 190, 170], 0.2);
  return out;
}

// The map: tiles about to quake.
export function slamState(zone, i, time) {
  if (zone.slam?.cells.has(i)) return "warn";
  if (zone.slamDone && time - zone.slamDone.time < 0.4 && zone.slamDone.cells.has(i)) return "up";
  return null;
}
