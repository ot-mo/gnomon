// The first-person view (learn/05 §9–10) plus sprites for monsters, items and map markers.
import * as S from "./screen.js";
import { castRay, hit, setGhostVisible } from "./raycast.js";
import { sampleLight } from "./light.js";
import { material, albedo, setMaterialTime, setDarkSight } from "./materials.js";
import { noise2 } from "./rng.js";
import { monsterSprite, MONSTER_TYPES, isFlat } from "./monsters.js";
import { guardianSprites } from "./guardians.js";
import { npcSprite, NPC_TYPES } from "./npcs.js";
import { spikeSprites } from "./traps.js";
import { itemSprite } from "./items.js";
import { projectileSprites } from "./throwing.js";
import { EYE, torchRange, torchPower } from "./player.js";
import { FLOOR_Z, B } from "./world.js";

const AMBIENT = [0.045, 0.045, 0.06];
const SKY_COLOR = [0.55, 0.65, 0.85];
const SUN_COLOR = [1.25, 1.12, 0.9];
const LAMP_COLOR = [2.0, 1.35, 0.75];
const TORCH_COLOR = [1.0, 0.82, 0.55];
const FOG = [4, 5, 9];             // the dark swallows distant things
const FOG_DENSITY = 0.05;
const EXPOSURE = 1.8;
const MAX_DIST = 32;
const SUN = (() => { const v = [-0.3, 0.35, 0.89], l = Math.hypot(...v); return v.map((c) => c / l); })();

// The camera, shared with sprites.
export const cam = { ex: 0, ey: 0, ez: 0, fX: 1, fY: 0, fZ: 0, rX: 0, rY: 1, uX: 0, uY: 0, uZ: 1, halfW: 1, halfH: 1 };
let depth = new Float32Array(0);   // distance to whatever each cell shows (for hiding sprites behind walls)
let outR = 0, outG = 0, outB = 0;

// override (the cube's rotation): { pitch, yaw (added), lift (height above your eyes) }
function setCamera(player, fovDeg, override) {
  const pitch = override ? override.pitch : player.pitch, yaw = player.yaw + (override?.yaw || 0);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  cam.fX = cp * cy; cam.fY = cp * sy; cam.fZ = sp;
  cam.rX = -sy; cam.rY = cy;
  cam.uX = -sp * cy; cam.uY = -sp * sy; cam.uZ = cp;
  cam.halfW = Math.tan(fovDeg * Math.PI / 360);
  cam.halfH = cam.halfW * (S.rows * S.cellH) / (S.cols * S.cellW);
  cam.ex = player.x; cam.ey = player.y;
  cam.ez = player.z + EYE - 0.35 * (player.wade || 0) + (override?.lift || 0);   // knee-deep in water: your view dips
}

// Tone-map the current colour, then let its brightness pick the character.
function plot(cx, cy, density = 1) {
  outR = 255 * (1 - Math.exp((-outR / 255) * EXPOSURE));
  outG = 255 * (1 - Math.exp((-outG / 255) * EXPOSURE));
  outB = 255 * (1 - Math.exp((-outB / 255) * EXPOSURE));
  const L = Math.max(outR, outG, outB) / 255;
  S.put(cx, cy, S.rampChar(L * density), outR, outG, outB);
}

function applyFog(t) {
  const f = 1 - Math.exp(-t * FOG_DENSITY);
  outR += (FOG[0] - outR) * f;
  outG += (FOG[1] - outG) * f;
  outB += (FOG[2] - outB) * f;
}

// Light arriving at a point from sky wells and lamps (no direction needed).
let lightR = 0, lightG = 0, lightB = 0;
function ambientAt(zone, x, y, z, airOnly = false) {
  const sky = sampleLight(zone, zone.skyLight, x, y, z, airOnly);
  const lamp = sampleLight(zone, zone.lampLight, x, y, z, airOnly);
  const lamp2 = lamp * Math.sqrt(lamp);   // lamp^1.5: bright near the lamp, a soft edge further out
  lightR = AMBIENT[0] + SKY_COLOR[0] * sky + LAMP_COLOR[0] * lamp2;
  lightG = AMBIENT[1] + SKY_COLOR[1] * sky + LAMP_COLOR[1] * lamp2;
  lightB = AMBIENT[2] + SKY_COLOR[2] * sky + LAMP_COLOR[2] * lamp2;
  return sky;
}

function openSky() {
  lightR = AMBIENT[0] + SKY_COLOR[0]; lightG = AMBIENT[1] + SKY_COLOR[1]; lightB = AMBIENT[2] + SKY_COLOR[2];
  return 1;
}

// Your torch this frame: strength and reach (perks and potions change them).
const torch = { power: 0, range: 0 };

function torchAt(dx, dy, dz, t, facing) {
  if (!torch.power) return;
  const cone = dx * cam.fX + dy * cam.fY + dz * cam.fZ;
  const spot = 0.45 + 0.55 * Math.min(1, Math.max(0, (cone - 0.88) / 0.1));
  const d = (t * 6) / torch.range;   // distance in "standard torch" units
  const k = (torch.power * spot * facing) / (1 + d * d * 0.06);
  lightR += TORCH_COLOR[0] * k; lightG += TORCH_COLOR[1] * k; lightB += TORCH_COLOR[2] * k;
}

function shadeHit(zone, player, dx, dy, dz) {
  const t = hit.t, block = hit.block, nx = hit.nx, ny = hit.ny, nz = hit.nz;
  const px = cam.ex + dx * t, py = cam.ey + dy * t, pz = cam.ez + dz * t;
  material(block, nx !== 0 ? py : px, nz !== 0 ? py : pz, nz > 0);
  // A flat being here? On the floor there's a shadow with nobody casting it.
  if (nz > 0 && shadows.length) {
    for (const s of shadows) {
      const d = Math.hypot(px - s.x, py - s.y);
      if (d < 0.48 && Math.abs(pz - s.z) < 0.3) {
        const k = 0.15 + 0.85 * (d / 0.48) ** 2;
        albedo.r *= k; albedo.g *= k; albedo.b *= k;
      }
    }
  }
  // A thin wall with a lit room behind it: in the dark, up close, light shows through the cracks.
  if (!player.torch && t < 4.5 && nz === 0 && hit.z >= FLOOR_Z && hit.z <= FLOOR_Z + 1 && !hit.apron &&
      zone.secretWalls.has(hit.x + hit.y * zone.w)) crackLight(nx !== 0 ? py : px, pz - FLOOR_Z, t);
  const ar = albedo.r, ag = albedo.g, ab = albedo.b, glow = albedo.glow;

  // The apron (the next zone's ground beyond an open edge) has no light arrays of its own: it gets the
  // open sky's light, so it doesn't draw dark (its real shading is WS3's, TECH_DESIGN §6.1).
  const sky = hit.apron ? openSky() : ambientAt(zone, px + nx * 0.5, py + ny * 0.5, pz + nz * 0.5);
  if (zone.hasSky && sky > 0.05) {
    const facing = nx * SUN[0] + ny * SUN[1] + nz * SUN[2];
    if (facing > 0 && !castRay(zone, px + nx * 0.001, py + ny * 0.001, pz + nz * 0.001, SUN[0], SUN[1], SUN[2], 40)) {
      lightR += SUN_COLOR[0] * facing; lightG += SUN_COLOR[1] * facing; lightB += SUN_COLOR[2] * facing;
    }
  }
  torchAt(dx, dy, dz, t, Math.max(0, -(nx * dx + ny * dy + nz * dz)));

  outR = ar * (lightR + glow); outG = ag * (lightG + glow); outB = ab * (lightB + glow);
  if (block === B.WATER_SHALLOW || block === B.WATER_DEEP) {
    // Water reflects the light around it, more and more as you look across it at a low angle.
    const sheen = 0.1 + 0.9 * Math.pow(1 - Math.abs(dz), 4);
    outR += lightR * sheen * 90; outG += lightG * sheen * 120; outB += lightB * sheen * 150;
  }
  applyFog(t);
}

// Hairline cracks across a two-block-tall wall face (u along the wall, v = height above the floor).
function crackLight(u, v, t) {
  const fu = u - Math.floor(u);
  const x1 = 0.5 + 0.17 * Math.sin(v * 4.1 + 1) + 0.06 * Math.sin(v * 13.7);
  const x2 = x1 + (v - 0.9) * 0.55;   // a branch splitting off halfway up
  const onCrack = Math.abs(fu - x1) < 0.022 || (v > 0.9 && v < 1.5 && Math.abs(fu - x2) < 0.018);
  if (!onCrack) return;
  const k = 1 - t / 4.5;
  albedo.r = 255; albedo.g = 205; albedo.b = 130;
  albedo.glow = 0.25 + 0.9 * k;
}

function shadeSky(dx, dy, dz, time) {
  const h = Math.sqrt(Math.max(0, dz));
  outR = 170 - 120 * h; outG = 200 - 105 * h; outB = 240 - 50 * h;
  const s = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
  if (s > 0.9985) { outR = 255; outG = 250; outB = 215; return 1; }
  const glow = Math.pow(Math.max(0, s), 60) * 120;
  outR += glow; outG += glow * 0.9; outB += glow * 0.6;
  let density = 0.45;
  if (dz > 0.02) {
    const k = (40 - cam.ez) / dz;
    const cx = (cam.ex + dx * k) * 0.025 + time * 0.02, cy = (cam.ey + dy * k) * 0.025;
    const n = noise2(cx, cy) * 0.65 + noise2(cx * 2.3, cy * 2.3) * 0.35;
    const c = Math.min(1, Math.max(0, (n - 0.56) / 0.2)) * Math.min(1, dz * 5);
    outR += (245 - outR) * c; outG += (245 - outG) * c; outB += (250 - outB) * c;
    density += 0.45 * c;
  }
  return density;
}

// Flat beings near you this frame (their shadows are drawn onto the floor in shadeHit).
let shadows = [];

export function render3d(game) {
  const { zone, player } = game;
  setCamera(player, game.fov, game.cam);
  shadows = [];
  for (const m of zone.monsters) if (isFlat(m) && Math.hypot(m.x - player.x, m.y - player.y) < 20) shadows.push(m);
  for (const n of zone.npcs) if (NPC_TYPES[n.type].flat && Math.hypot(n.x - player.x, n.y - player.y) < 20) shadows.push(n);
  setMaterialTime(game.time);   // water ripples move
  if (depth.length !== S.cols * S.rows) depth = new Float32Array(S.cols * S.rows);
  torch.power = torchPower(player);
  torch.range = torchRange(player);
  const seeRange = torch.range;
  setDarkSight(!player.torch);     // runes glow and ghost planks show only with your torch out
  setGhostVisible(!player.torch);

  for (let cy = 0; cy < S.rows; cy++) {
    const v = (1 - (2 * (cy + 0.5)) / S.rows) * cam.halfH;
    for (let cx = 0; cx < S.cols; cx++) {
      const u = ((2 * (cx + 0.5)) / S.cols - 1) * cam.halfW;
      let dx = cam.fX + u * cam.rX + v * cam.uX;
      let dy = cam.fY + u * cam.rY + v * cam.uY;
      let dz = cam.fZ + v * cam.uZ;
      const len = Math.hypot(dx, dy, dz);
      dx /= len; dy /= len; dz /= len;

      const i = cy * S.cols + cx;
      let density = 1;
      if (castRay(zone, cam.ex, cam.ey, cam.ez, dx, dy, dz, MAX_DIST, zone.seen, seeRange, zone.holeSeen)) {
        shadeHit(zone, player, dx, dy, dz);
        depth[i] = hit.t;
      } else {
        depth[i] = Infinity;
        if (dz > 0 && zone.hasSky) density = shadeSky(dx, dy, dz, game.time);
        else outR = outG = outB = 0;        // looking into a bottomless pit, or into the far dark
      }
      plot(cx, cy, density);
    }
  }

  setGhostVisible(false);          // everything else (sight lines, aiming…) sees straight through them
  drawSprites(game);
  drawDamageNumbers(game);
  // A bomb going off close by: a flash of light.
  for (const e of game.effects)
    if (e.kind === "boom" && game.time - e.time < 0.15 && Math.hypot(e.x - player.x, e.y - player.y) < 10) S.tint(1.7, 1.4, 1.1);
  if (player.hurt > 0) S.tint(1 + player.hurt * 1.6, 1 - player.hurt * 1.4, 1 - player.hurt * 1.4);
  // Sinking in deep water: everything goes murky blue.
  if (zone.get(Math.floor(cam.ex), Math.floor(cam.ey), Math.floor(cam.ez)) === B.WATER_DEEP) S.tint(0.3, 0.55, 1.1);
}

// Numbers that pop up above a monster when you hit it, then float up and fade.
// Also the ring of droplets when a thrown potion shatters.
function drawDamageNumbers(game) {
  for (const e of game.effects) {
    if (e.kind === "burst") { drawBurst(game, e); continue; }
    if (e.kind !== "damage" || e.onPlayer) continue;
    const age = game.time - e.time;
    if (age > 0.9) continue;
    const vx = e.x - cam.ex, vy = e.y - cam.ey, vz = e.z + age * 0.8 - cam.ez;
    const zc = vx * cam.fX + vy * cam.fY + vz * cam.fZ;
    if (zc < 0.2) continue;
    const sx = ((vx * cam.rX + vy * cam.rY) / zc / cam.halfW + 1) * 0.5 * S.cols;
    const sy = (1 - (vx * cam.uX + vy * cam.uY + vz * cam.uZ) / zc / cam.halfH) * 0.5 * S.rows;
    const k = 1 - age / 0.9;
    S.text(Math.round(sx - e.text.length / 2), Math.round(sy), e.text, e.color[0] * k, e.color[1] * k, e.color[2] * k);
  }
}

// A splash: droplets flying out in a ring around where the potion broke.
function drawBurst(game, e) {
  const age = game.time - e.time;
  if (age > 0.6) return;
  const n = e.big ? 32 : 16, r = (0.3 + age * 3) * (e.big ? 1.3 : 1), k = 1 - age / 0.6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const vx = e.x + Math.cos(a) * r - cam.ex, vy = e.y + Math.sin(a) * r - cam.ey, vz = e.z + (i % 3) * 0.2 - age - cam.ez;
    const zc = vx * cam.fX + vy * cam.fY + vz * cam.fZ;
    if (zc < 0.2) continue;
    const sx = Math.round(((vx * cam.rX + vy * cam.rY) / zc / cam.halfW + 1) * 0.5 * S.cols);
    const sy = Math.round((1 - (vx * cam.uX + vy * cam.uY + vz * cam.uZ) / zc / cam.halfH) * 0.5 * S.rows);
    S.put(sx, sy, i % 2 ? "*" : "o", e.color[0] * k + 60, e.color[1] * k + 60, e.color[2] * k + 60);
  }
}

// ---------------------------------------------------------------------------
// Sprites ("billboards"): flat pixel-art pictures that always face the camera,
// scaled by distance and hidden behind walls using the depth buffer.
function drawSprites(game) {
  const { zone } = game;
  // Marker beacons first: they show faintly through walls, but monsters and items cover them.
  for (const mk of zone.markers) {
    const z = zone.stand[mk.x + mk.y * zone.w];
    drawSprite(game, {
      x: mk.x + 0.5, y: mk.y + 0.5, z: z >= 0 ? z : FLOOR_Z, w: 0.12, h: 3.6,
      art: ["c"], palette: { c: [[90, 230, 255], 1.6] }, beacon: true,
    });
  }
  // (Flat beings only cast a shadow; a ghostly guardian is only there with your torch out.)
  for (const m of zone.monsters) if (!isFlat(m) && !(MONSTER_TYPES[m.type].ghostly && game.player.torch)) drawSprite(game, monsterSprite(m, zone));
  for (const sp of guardianSprites(game)) drawSprite(game, sp);
  for (const n of zone.npcs) { const sp = npcSprite(game, n); if (sp) drawSprite(game, sp); }
  for (const sp of spikeSprites(game)) drawSprite(game, sp);
  for (const item of zone.items) drawSprite(game, itemSprite(game, item, game.time));
  for (const s of projectileSprites(game)) drawSprite(game, s);   // knives and potions in flight, gas clouds
}

function drawSprite(game, s) {
  const { zone, player } = game;
  const cz = s.z + s.h * 0.5;
  const vx = s.x - cam.ex, vy = s.y - cam.ey, vz = cz - cam.ez;
  const zc = vx * cam.fX + vy * cam.fY + vz * cam.fZ;       // distance straight ahead
  if (zc < 0.15) return;                                    // behind us
  const xc = vx * cam.rX + vy * cam.rY;
  const yc = vx * cam.uX + vy * cam.uY + vz * cam.uZ;
  const dist = Math.hypot(vx, vy, vz);

  // Centre and half-size on screen, in cells.
  const sx = (xc / zc / cam.halfW + 1) * 0.5 * S.cols;
  const sy = (1 - yc / zc / cam.halfH) * 0.5 * S.rows;
  const hw = (s.w * 0.5 / zc / cam.halfW) * 0.5 * S.cols;
  const hh = (s.h * 0.5 / zc / cam.halfH) * 0.5 * S.rows;
  const thinX = hw < 0.5, thinY = hh < 0.5;   // smaller than a cell: draw one cell
  const x0 = thinX ? Math.floor(sx) : Math.max(0, Math.floor(sx - hw));
  const x1 = thinX ? Math.floor(sx) : Math.min(S.cols - 1, Math.ceil(sx + hw));
  const y0 = thinY ? Math.floor(sy) : Math.max(0, Math.floor(sy - hh));
  const y1 = thinY ? Math.floor(sy) : Math.min(S.rows - 1, Math.ceil(sy + hh));
  if (x1 < 0 || y1 < 0 || x0 >= S.cols || y0 >= S.rows) return;

  // Light at the sprite (it faces the camera, so the torch hits it head-on).
  ambientAt(zone, s.x, s.y, cz, true);
  torchAt(vx / dist, vy / dist, vz / dist, dist, 1);
  let lr = lightR, lg = lightG, lb = lightB;
  if (s.emit) { lr += s.emit[0]; lg += s.emit[1]; lb += s.emit[2]; }   // its own glow (on fire)
  if (s.tint) { lr *= s.tint[0]; lg *= s.tint[1]; lb *= s.tint[2]; }   // burning / chilled colouring
  const art = s.art, ah = art.length, aw = art[0].length;
  // A sprite is one flat picture at one distance, but the thing it shows has a size: an item
  // lying against a wall pokes into it. So only hide it where the scene is clearly in front of
  // it (by more than about its half-width), not just in front of its centre.
  const slack = Math.min(0.6, s.w * 0.5 + 0.15);
  let visible = 0;

  for (let y = Math.max(0, y0); y <= Math.min(S.rows - 1, y1); y++) {
    const v = thinY ? 0.5 : (y + 0.5 - (sy - hh)) / (2 * hh);
    if (v < 0 || v >= 1) continue;
    const row = art[Math.floor(v * ah)];
    for (let x = Math.max(0, x0); x <= Math.min(S.cols - 1, x1); x++) {
      const u = thinX ? 0.5 : (x + 0.5 - (sx - hw)) / (2 * hw);
      if (u < 0 || u >= 1) continue;
      const ch = row[Math.floor(u * aw)];
      if (ch === " ") continue;
      const i = y * S.cols + x;
      const hidden = depth[i] < dist - (s.beacon ? 0 : slack);
      if (hidden && !s.beacon) continue;
      const [col, glow] = s.palette[ch];
      if (s.flash) { outR = outG = outB = 400; }
      else { outR = col[0] * (lr + glow); outG = col[1] * (lg + glow); outB = col[2] * (lb + glow); }
      if (hidden) { outR *= 0.3; outG *= 0.3; outB *= 0.3; }   // markers show faintly through walls
      else applyFog(dist);
      plot(x, y);
      if (!s.beacon) depth[i] = dist;
      visible++;
    }
  }

  // A monster you can actually see (on screen, not hidden, not lost in the dark) is
  // remembered on the map at this spot.
  if (s.monster && visible > 0 && (lr + lg + lb > 0.35 || dist < torch.range)) {
    const m = s.monster;
    zone.sightings.set(m.id, { x: m.x, y: m.y, glyph: m.glyph, color: m.color, name: m.name, time: game.time });
  }
}
