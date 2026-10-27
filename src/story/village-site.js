// A village on its span (TECH_DESIGN §2.16, §5.4; bible §9.1's concrete half, §9.4, §9.5): SITE_BUILDERS.village stamps
// it when the surface zone is generated; on entering it, its faction is registered and the first visit is rewarded.
// story/index.js registers the builder (registerSiteBuilder("village", buildVillage)).
//
//   buildVillage(ctx, site)      ctx = { run, zone, rng, rect, hub, H, plan, reserved } (gen/surface.js step 7). The site's
//                                24 × 16 footprint is flat at the datum; on it:
//     - five buildings (the hall north, two beside it, two south; three in an empty village) in the style's blocks
//       (VILLAGES.plans in the vault format, stamped with gen/vaults.js stampVault), roofed with a slab of the style's
//       roof block (an empty village's roofs are gone), doors facing the green;
//     - the green between them, paved with the style's ground: two mosaic tablets (5 wide, read from above: the Flat
//       Account of each of the village's two Hour events), the commons lamp on a post (the Shade: the commons dark, four
//       rune stones), the shrine (VILLAGES.shrines: a mosaic, a carved stone, a rune stone or a tall pillar);
//     - murals (story/murals.js, learned through inspect): a "map" one on each tablet, a "3d" one on the lintel over the
//       hall's door and the next building's (the Deep Inscription), a "dark" one on the hall's doorstep inside (the Dark
//       Gloss) when an event was cruel. An empty village keeps one event's three accounts (What Happened Here);
//     - the climbing perch when its quest is "climb": crates up to 3 blocks, a gap, and a pole 3 blocks high (3D only:
//       the map steps one block at a time and never jumps);
//     - the cast (bible §9.5), each a talker with its uid, name, level, memberships (c.faction: the village 1, and its
//       people's faction or the Bent villages 0.25-0.5), the leader named with its opinions, readings and teaches.
//   zone.village = { siteId, shrine: { x, y, z, view }, lamp: { x, y, dark }, perch: { x, y, z } | null, buildings }
//
//   ensureVillageFaction(game, v)   registers the village's faction (factions.js registerFaction), or brings a generated one
//                                   registered by an earlier run in this page up to this run's
//   VILLAGE_REWARD                  the first visit's XP: 0.2 of a level's at the village's level (bible §9.1); WS4's
//                                   xpReward("village", level) when it exists
// The layout draws from its own stream (seedFor(zone seed, "village", site id)), so the surface's own draws don't move.
import { B, FLOOR_Z } from "../world.js";
import { makeRng, seedFor } from "../rng.js";
import { on } from "../events.js";
import { stampVault } from "../gen/vaults.js";
import { spawnCreature, addCreature } from "../creatures.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../pathing.js";
import { standWith } from "../world.js";
import * as factions from "../factions.js";
import * as powers from "../content/powers.js";
import * as leveling from "../leveling.js";
import { VILLAGES } from "../content/villages.js";
import { villageOf, villageFaction, eventById } from "./villages.js";
import { registerDialogue, dialogueIds, node, bye } from "../talk.js";
import { VILLAGERS } from "../content/creatures/villagers.js";
import { registerCreatureField } from "../save/codec.js";

const W = 24, D = 16;               // the village footprint (world/sites.js SITE_SHAPES.village)
const WALL_H = 3;                   // walls 3 blocks high, the roof slab on top (z = FLOOR_Z + 3)
const SLOTS = { hall: [7, 0], nw: [0, 0], ne: [-1, 0], sw: [0, 11], se: [-1, 11] };   // -1: right-aligned
const LAMP = [12, 8], SHRINE = [12, 6], TABLETS = [[3, 9], [20, 9]], PERCH = [1, 7];

export const VILLAGE_REWARD = { xp: (level) => (leveling.xpReward ? leveling.xpReward("village", level) : Math.round(0.2 * leveling.xpToNext(level))) };

const block = (key) => B[key] ?? B.STONE;

export function buildVillage(ctx, site) {
  const { run, zone, rect } = ctx;
  const v = villageOf(run, site.id);
  if (!v || !rect) return;
  const rng = makeRng(seedFor(zone.seed, "village", site.id));
  const S = VILLAGES.styles[v.layout.style] || VILLAGES.styles.turf;
  const wall = block(S.wall), floor = block(S.floor), roof = block(S.roof), ground = block(S.ground);
  const at = (lx, ly) => [rect.x + lx, rect.y + ly];
  const mark = (x, y) => { if (ctx.plan) ctx.plan[x + y * zone.w] = 1; };
  const walls = (zone.planWalls ||= new Uint8Array(zone.w * zone.d));
  const murals = [];

  // 1. The green: the footprint paved, open to the sky.
  for (let ly = 0; ly < D; ly++)
    for (let lx = 0; lx < W; lx++) {
      const [x, y] = at(lx, ly);
      for (let z = 0; z < zone.h; z++) zone.set(x, y, z, z < FLOOR_Z - 1 ? B.ROCK : z === FLOOR_Z - 1 ? ground : B.AIR);
    }

  // 2. The buildings, in their slots: the hall first, then the rest in order (NW, NE, SW, SE).
  const order = ["hall", "nw", "ne", "sw", "se"];
  const plans = v.layout.buildings.map((id, k) => ({ id, slot: k === 0 ? "hall" : order[k] }));
  const built = [];
  for (const { id, slot } of plans) {
    let rows = VILLAGES.plans[id].slice();
    const south = slot === "sw" || slot === "se";
    if (south) rows = rows.slice().reverse();   // the door faces the green
    if (v.abandoned) rows = rows.map((r, y) => [...r].map((ch, x) => {
      if (ch === "l") return "#";
      const edge = y === 0 || y === rows.length - 1 || x === 0 || x === r.length - 1;
      return ch === "#" && edge && rng.chance(0.2) && !/[M]/.test(rows[y]) ? "." : ch;
    }).join(""));
    const w = rows[0].length, [sx, sy] = SLOTS[slot], lx = sx < 0 ? W - w : sx, ly = sy;
    const [x0, y0] = at(lx, ly);
    stampVault(zone, { id: `village:${id}`, name: `${v.name} ${id}`, height: WALL_H, wall, floorBlock: floor, plan: rows, links: [],
                       legend: { M: "door" } }, x0, y0, rng, { roof: v.abandoned ? "none" : "slab", wallHeight: WALL_H, cosmetic: rng });
    const b = { id, slot, x0, y0, w, d: rows.length, door: null, step: null, inside: [] };
    rows.forEach((r, py) => [...r].forEach((ch, px) => {
      const x = x0 + px, y = y0 + py;
      mark(x, y);
      if (!v.abandoned) zone.set(x, y, FLOOR_Z + WALL_H, roof);
      if (ch === "#" || ch === "l") walls[x + y * zone.w] = 1;
      if (ch === "M") {
        b.door = { x, y };
        if (v.abandoned) { zone.set(x, y, FLOOR_Z, B.AIR); zone.set(x, y, FLOOR_Z + 1, B.AIR); }   // the doors are gone
      }
      if (ch === "r") b.step = { x, y };
      else if (ch === "." && !(v.abandoned && (py === 0 || py === rows.length - 1 || px === 0 || px === r.length - 1))) b.inside.push([x, y]);
    }));
    // Nobody stands right inside the door or on the doorstep.
    b.inside = b.inside.filter(([x, y]) => Math.abs(x - b.door.x) + Math.abs(y - b.door.y) > 1);
    built.push(b);
  }
  const hall = built[0], second = built[1];

  // 3. The art. A lintel is a carved panel in the wall over the door; a tablet a row of five mosaic tiles.
  const hist = v.history.map((id) => eventById(run, id)).filter(Boolean);
  const lintel = (b, e) => {
    zone.set(b.door.x, b.door.y, FLOOR_Z + 2, B.MURAL);
    murals.push({ x: b.door.x, y: b.door.y, z: FLOOR_Z + 2, view: "3d", text: e.text.inscription, secret: `hist:${e.id}:deep` });
  };
  const tablet = ([tx, ty], e, k) => {
    const [x, y] = at(tx, ty);
    const tiles = [B.MOSAIC_WHITE, k ? B.MOSAIC_BLUE : B.MOSAIC_RED, B.MOSAIC_GOLD, k ? B.MOSAIC_BLUE : B.MOSAIC_RED, B.MOSAIC_WHITE];
    tiles.forEach((t, i) => { zone.set(x - 2 + i, y, FLOOR_Z - 1, t); mark(x - 2 + i, y); });
    murals.push({ x, y, z: FLOOR_Z - 1, view: "map", text: e.text.gospel, secret: `hist:${e.id}:flat` });
  };
  const rune = (b, e) => {
    zone.set(b.step.x, b.step.y, FLOOR_Z - 1, B.RUNE);
    murals.push({ x: b.step.x, y: b.step.y, z: FLOOR_Z, view: "dark", text: e.text.hostile, secret: `hist:${e.id}:dark` });
  };
  if (v.abandoned) {
    // What Happened Here: one event, in all three views.
    if (hist[0]) { tablet(TABLETS[0], hist[0], 0); lintel(hall, hist[0]); rune(hall, hist[0]); }
  } else {
    hist.forEach((e, k) => tablet(TABLETS[k], e, k));
    if (hist[0]) lintel(hall, hist[0]);
    if (hist[1] && second) lintel(second, hist[1]);
    const cruel = v.layout.rune && eventById(run, v.layout.rune);
    if (cruel) rune(hall, cruel);
  }

  // 4. The commons lamp (or the commons dark), the shrine, the perch.
  const [lx, ly] = at(...LAMP);
  const dark = S.lamp === "dark";
  if (!v.abandoned) {
    if (dark) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { zone.set(lx + dx, ly + dy, FLOOR_Z, B.RUNE); mark(lx + dx, ly + dy); }
    else { zone.set(lx, ly, FLOOR_Z, wall); zone.set(lx, ly, FLOOR_Z + 1, wall); zone.set(lx, ly, FLOOR_Z + 2, B.LAMP); walls[lx + ly * zone.w] = 1; }
    mark(lx, ly);
  }
  const [sx, sy] = at(...SHRINE), kind = v.culture.shrine, view = VILLAGES.shrines[kind].view;
  let shrineZ = FLOOR_Z;
  if (kind === "mosaic") {
    zone.set(sx - 1, sy, FLOOR_Z - 1, B.MOSAIC_RED); zone.set(sx, sy, FLOOR_Z - 1, B.MOSAIC_GOLD); zone.set(sx + 1, sy, FLOOR_Z - 1, B.MOSAIC_RED);
    shrineZ = FLOOR_Z - 1;
  } else if (kind === "pillar") {
    for (let z = FLOOR_Z; z < FLOOR_Z + 4; z++) zone.set(sx, sy, z, B.COLUMN);
    shrineZ = FLOOR_Z + 3; walls[sx + sy * zone.w] = 1;
  } else {
    zone.set(sx, sy, FLOOR_Z, B.STONE); zone.set(sx, sy, FLOOR_Z + 1, kind === "rune" ? B.RUNE : B.MURAL);
    shrineZ = FLOOR_Z + 1; walls[sx + sy * zone.w] = 1;
  }
  mark(sx, sy);
  let perch = null;
  if (v.layout.perch) {
    const [px, py] = at(...PERCH);
    [1, 2, 3].forEach((h, i) => { for (let z = FLOOR_Z; z < FLOOR_Z + h; z++) zone.set(px + i, py, z, B.CRATE); mark(px + i, py); });
    for (let z = FLOOR_Z; z < FLOOR_Z + 3; z++) zone.set(px + 4, py, z, B.COLUMN);
    mark(px + 3, py); mark(px + 4, py); walls[px + 4 + py * zone.w] = 1;
    perch = { x: px + 4, y: py, z: FLOOR_Z + 3 };
  }

  zone.murals = [...(zone.murals || []), ...murals];
  zone.village = { siteId: site.id, shrine: { x: sx, y: sy, z: shrineZ, view, kind }, lamp: { x: lx, y: ly, dark },
                   perch, buildings: built.map((b) => ({ id: b.id, x0: b.x0, y0: b.y0, w: b.w, d: b.d, door: b.door, step: b.step })) };

  // 5. The cast: the leader in the hall, the trader and the leech in the next two buildings, the tinker in the
  //    workshop if there is one; everyone else on the green.
  if (v.abandoned) return;
  const taken = new Set();
  const key = (x, y) => `${x},${y}`;
  const blocked = new Set([...murals.map((m) => key(m.x, m.y)), key(lx, ly), key(sx, sy), key(sx - 1, sy), key(sx + 1, sy)]);
  if (dark) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) blocked.add(key(lx + dx, ly + dy));
  if (perch) for (let i = -1; i <= 5; i++) for (const dy of [-1, 0, 1]) blocked.add(key(perch.x - 4 + i, perch.y + dy));
  for (const b of built) {
    for (const dy of [-1, 1]) blocked.add(key(b.door.x, b.door.y + dy));   // doorsteps, in and out
  }
  for (const [tx, ty] of TABLETS) for (let i = -2; i <= 2; i++) blocked.add(key(...at(tx + i, ty)));
  const green = [];
  for (let gy = 5; gy <= 10; gy++) for (let gx = 0; gx < W; gx++) { const [x, y] = at(gx, gy); if (!blocked.has(key(x, y))) green.push([x, y]); }
  rng.shuffle(green);
  const home = { leader: hall, merchant: built[1], leech: built[2], tinker: built.find((b) => b.id === "workshop") };
  const spot = (role) => {
    const b = home[role];
    const pool = b ? b.inside.filter(([x, y]) => !taken.has(key(x, y))) : [];
    const pick = pool.length ? pool[rng.int(0, pool.length - 1)] : green.find(([x, y]) => !taken.has(key(x, y)));
    if (pick) taken.add(key(...pick));
    return pick;
  };
  const P = VILLAGES.peoples[v.people];
  for (const r of v.roles) {
    const p = spot(r.role);
    if (!p) continue;
    const c = spawnCreature(r.creatureType, p[0], p[1], FLOOR_Z, { uid: r.uid, name: r.name, level: v.level,
      talk: { dialogue: r.dialogue, state: {} } });
    c.village = site.id;
    c.villageRole = r.role;
    const second = P?.faction || "bentVillages";
    c.faction = { [v.factionId]: 1, [second]: 0.25 + 0.05 * rng.int(0, 5) };
    if (r.named) c.named = { epithet: r.role === "leader" ? `of ${v.name}` : "", history: null };
    if (r.readings) c.readings = r.readings.slice();
    if (r.role === "leader") {
      c.opinions = [...v.likedBy.map((id) => [id, "likes", "an old friendship"]), ...v.hates.map((id) => [id, "hates", "an old grievance"])];
      c.teaches = teachesFor(v.culture.skill);
    }
    addCreature(zone, c);
  }
}

// The village's skill (bible §9.2: one power from one tree, taught through the Kindling): the first power of that
// tree in WS4's POWERS (content/powers.js) that works today (one with `needs` is never offered until it's gone); none before.
function teachesFor(skill) {
  const found = Object.entries(powers.POWERS || {}).find(([, p]) => String(p.tree || "").toLowerCase() === skill && !p.needs);
  return found ? [found[0]] : [];
}

// --- Its faction and the first visit -----------------------------------------------------------------------------
export function ensureVillageFaction(game, v) {
  const def = villageFaction(v), have = factions.FACTIONS[def.id];
  if (!have) factions.registerFaction(def.id, def);
  else if (have.generated) Object.assign(have, def);   // another run in this page: the same id, maybe other relations
  return factions.FACTIONS[def.id];
}

on("zone:enter", (game, ev) => {
  const zone = ev.zone, site = zone?.siteId && game.run?.sites?.get(zone.siteId);
  if (!site || site.kind !== "village" || zone.z !== 0) return;
  const v = villageOf(game.run, site.id);
  if (!v) return;
  ensureVillageFaction(game, v);
  const st = (game.state.villages ||= {});
  if (st[site.id]?.visited !== undefined || ev.how === "load") return;
  st[site.id] = { ...(st[site.id] || {}), visited: game.time || 0 };
  const xp = VILLAGE_REWARD.xp(v.level);
  game.log?.(v.abandoned ? `${v.name} stands empty. Something happened here. (+${xp} XP)`
    : `You come to ${v.name}. Everyone here seems to be ${v.culture.activity}. (+${xp} XP)`, [200, 230, 160]);
  if (game.player) leveling.gainXp(game, xp, { source: "village" });
});

// What a saved villager keeps beyond the codec's own whitelist (save/codec.js CREATURE_FIELDS): its village and role
// (the quest talk options read them), the Kindling's readings, opinions and teaches, and a quest's own marks.
export const VILLAGER_FIELDS = ["village", "villageRole", "readings", "opinions", "teaches", "questBeast", "lostFrom"];
for (const f of VILLAGER_FIELDS) registerCreatureField(f);

// What a villager says when no one has written its conversation (talk.js dispatches on c.talk.dialogue, the type's id
// by default): WS6a's role dialogues (social/builders.js ROLES) when they are registered, which they are before this
// file loads (features.js: social before story); otherwise its village's proverb. Registered only where nothing is.
const sayProverb = (game, c) => {
  const v = c.village && villageOf(game.run, c.village);
  return node(v ? `"${v.culture.proverb}" ${c.name} says it the way everyone in ${v.name} does.` : `${c.name} nods to you.`, [bye()]);
};
for (const id of [...Object.keys(VILLAGERS), "villager", "priest", "guard", "wanderer", "merchant"])
  if (!dialogueIds().includes(id)) registerDialogue(id, sayProverb);

// Who can reach whom: every cast member's tile from the zone's anchor, doors open (check-story).
export function castReachable(zone) {
  const open = standWith(zone, "open");
  const dist = reachable(open, zone.w, zone.d, Math.floor(zone.spawn.x), Math.floor(zone.spawn.y), PLAYER_STEP_UP, PLAYER_DROP);
  return zone.creatures.filter((c) => c.village).map((c) => ({ c, ok: dist[c.tx + c.ty * zone.w] >= 0 }));
}
