// The first-person view (learn/05 §9–10) plus sprites for monsters, items and map markers.
//
// Outdoors (a zone with sky; TECH_DESIGN §6, WS3) the look follows the clock (clock.js): sky light ×
// daylight with a moonlit floor at night, the sun's colour and strength by its height, the baked sun for
// shadows (light.js zone.sunlit), the sky's gradient with the sun's disc, clouds and stars, haze in the
// horizon's colour, rays out to MAX_DIST_OUT, the apron lit like open ground, and beyond it the horizon
// plane: a ray that leaves the voxels going down meets a plane at the apron's far height, in that side's
// ground colour. A zone without sky (every dungeon level) draws exactly as the parent game did (golden (b)).
//   render3d(game)
//   setDynamicResolution(on) · dynamicResolution() → { on, half }   §6.7: outdoors, a cast that averages
//       over 17 ms for 2 s casts every other column and copies it to the next, until the full cast's cost
//       (twice the halved one) is back under 12 ms for 2 s. On by default in a page, off in Node.
//   horizonOf(game, zone) → { n, e, s, w: { z, color } }   the horizon plane's height and colour per side
//   judgeFrame(ms, now)       one frame's cast time (ms) at time now (ms) for dynamic resolution (render3d calls it)
import * as S from "./screen.js";
import { castRay, hit, setGhostVisible, rayInfo } from "./raycast.js";
import { sampleGrid, inDark, zoneIsLightless, daylight, syncLight, sunState, sunlitGrid } from "./light.js";
import { sunDir, skyColors, fogFor, spanOf } from "./clock.js";
import { material, albedo, setMaterialTime, setDarkSight, DARK_SIGHT_BLOCKS } from "./materials.js";
import { noise2, hash } from "./rng.js";
import { creatureSprite, hostilesTo, talkersIn, isFlat } from "./creatures.js";
import { guardianSprites } from "./guardians.js";
import { spikeSprites } from "./traps.js";
import { itemSprite } from "./items.js";
import { projectileSprites } from "./throwing.js";
import { EYE, torchRange, torchPower } from "./player.js";
import { FLOOR_Z, B, BLOCKS } from "./world.js";
import { liquidAt } from "./social/liquids.js";
import { LIQUIDS } from "./content/liquids.js";

const AMBIENT = [0.045, 0.045, 0.06];
const SKY_COLOR = [0.55, 0.65, 0.85];
const NIGHT_SKY = [0.08, 0.1, 0.18];      // moonlight: the sky term at night (§6.3's night floor)
const SUN_COLOR = [1.25, 1.12, 0.9];
const LOW_SUN = [1.3, 0.72, 0.42];       // the sun near the horizon
const LAMP_COLOR = [2.0, 1.35, 0.75];
const TORCH_COLOR = [1.0, 0.82, 0.55];
const FOG = [4, 5, 9];             // the dark swallows distant things
const FOG_DENSITY = 0.05;
const EXPOSURE = 1.8;
const MAX_DIST = 32;
const MAX_DIST_OUT = 48;           // outdoors: far enough to cross the apron (§6.2)
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

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

// Tone-map the current colour, then let its brightness pick the character. The last cell plotted is kept
// (plotCh, plotR…) so a halved frame can copy it to the next column.
// Outdoors the curve is read from a table (TONE, a step of 1/TONE_STEP, linear between), which is within a
// hundredth of a colour step of the exact one; underground it is computed exactly, as the parent game did.
let plotCh = " ", plotR = 0, plotG = 0, plotB = 0;
const TONE_STEP = 4, TONE_MAX = 1024, TONE = new Float64Array(TONE_MAX * TONE_STEP + 2);
for (let k = 0; k < TONE.length; k++) TONE[k] = 255 * (1 - Math.exp((-(k / TONE_STEP) / 255) * EXPOSURE));
const toneOf = (v) => {
  if (!(v > 0)) return v === 0 ? 0 : 255 * (1 - Math.exp((-v / 255) * EXPOSURE));
  if (v >= TONE_MAX) return 255 * (1 - Math.exp((-v / 255) * EXPOSURE));
  const f = v * TONE_STEP, k = f | 0;
  return TONE[k] + (TONE[k + 1] - TONE[k]) * (f - k);
};
function plot(cx, cy, density = 1) {
  if (outdoor) { outR = toneOf(outR); outG = toneOf(outG); outB = toneOf(outB); }
  else {
    outR = 255 * (1 - Math.exp((-outR / 255) * EXPOSURE));
    outG = 255 * (1 - Math.exp((-outG / 255) * EXPOSURE));
    outB = 255 * (1 - Math.exp((-outB / 255) * EXPOSURE));
  }
  const L = Math.max(outR, outG, outB) / 255;
  plotCh = S.rampChar(L * density); plotR = outR; plotG = outG; plotB = outB;
  S.put(cx, cy, plotCh, outR, outG, outB);
}

// --- This frame's look (frameLook) ---------------------------------------------------------------
// Underground every value is the parent game's constant, so its frames don't change by a bit.
let outdoor = false, maxDist = MAX_DIST;
let skyR = SKY_COLOR[0], skyG = SKY_COLOR[1], skyB = SKY_COLOR[2];            // sky light's colour × daylight
let fogR = FOG[0], fogG = FOG[1], fogB = FOG[2], fogD = FOG_DENSITY;
let sunOn = false, sunX = 0, sunY = 0, sunZ = 1, sunR = 0, sunG = 0, sunB = 0;  // the faces' sun (the bake's)
let zen = [50, 95, 190], hor = [170, 200, 240];                                // the sky's gradient
let discX = 0, discY = 0, discZ = 1, discVis = 0, discR = 255, discG = 250, discB = 215;
let cloudR = 245, cloudG = 245, cloudB = 250, starK = 0, horizon = null;

// The zone's arrays and sizes, read once a frame: the per-pixel code below never reads the zone object
// (each zone has its own shape, and code tuned to one zone's would be thrown out in the first frame of the next).
let ZW = 0, ZD = 0, ZH = 0, zBlocks = null, zSky = null, zLamp = null, zSun = null, zSecret = null, zPlainWater = true;
function frameZone(zone) {
  ZW = zone.w; ZD = zone.d; ZH = zone.h; zBlocks = zone.blocks; zSky = zone.skyLight; zLamp = zone.lampLight;
  zSun = zone.sunlit; zSecret = zone.secretWalls;
  zPlainWater = (zone.liquid || "water") === "water" && !Object.keys(zone.liquids || {}).length;
}

function frameLook(game, zone) {
  outdoor = !!zone.hasSky;
  if (!outdoor) {
    maxDist = MAX_DIST; sunOn = false; horizon = null;
    skyR = SKY_COLOR[0]; skyG = SKY_COLOR[1]; skyB = SKY_COLOR[2];
    fogR = FOG[0]; fogG = FOG[1]; fogB = FOG[2]; fogD = FOG_DENSITY;
    return;
  }
  maxDist = MAX_DIST_OUT;
  syncLight(game, zone);   // the lit mask and the baked sun up to the clock
  const dl = daylight(game), nd = 1 - dl;
  skyR = SKY_COLOR[0] * dl + NIGHT_SKY[0] * nd; skyG = SKY_COLOR[1] * dl + NIGHT_SKY[1] * nd; skyB = SKY_COLOR[2] * dl + NIGHT_SKY[2] * nd;
  const fog = fogFor(game, zone);
  [fogR, fogG, fogB] = fog.color; fogD = fog.density;
  ({ zenith: zen, horizon: hor } = skyColors(game));
  // The faces' sun is the one the zone was baked for, so lit faces and shadows agree.
  const real = sunDir(game), baked = sunState(zone).sun || real;
  [sunX, sunY, sunZ] = baked;
  const k = dl * smooth(sunZ / 0.25), warm = smooth(sunZ / 0.5);
  sunR = (LOW_SUN[0] + (SUN_COLOR[0] - LOW_SUN[0]) * warm) * k;
  sunG = (LOW_SUN[1] + (SUN_COLOR[1] - LOW_SUN[1]) * warm) * k;
  sunB = (LOW_SUN[2] + (SUN_COLOR[2] - LOW_SUN[2]) * warm) * k;
  sunOn = k > 0.001;
  // The disc in the sky follows the real sun; it reddens and dims as it sets, and is gone below the horizon.
  [discX, discY, discZ] = real;
  const dwarm = smooth(discZ / 0.4);
  discVis = smooth((discZ + 0.03) / 0.08) * (0.35 + 0.65 * dl);
  discR = 255; discG = 175 + 75 * dwarm; discB = 105 + 110 * dwarm;
  // Clouds: white by day, taking the horizon's colour at dusk and dawn, dark at night. Stars as daylight goes.
  const tw = 0.55 * smooth(nd * 2) * (dl > 0 ? 1 : 0);
  cloudR = (245 + (hor[0] - 245) * tw) * dl + 26 * nd; cloudG = (245 + (hor[1] - 245) * tw) * dl + 28 * nd; cloudB = (250 + (hor[2] - 250) * tw) * dl + 40 * nd;
  starK = smooth((0.55 - dl) / 0.4);
  horizon = horizonOf(game, zone);
}

function applyFog(t) {
  const f = 1 - Math.exp(-t * fogD);
  outR += (fogR - outR) * f;
  outG += (fogG - outG) * f;
  outB += (fogB - outB) * f;
}

// Light arriving at a point from sky wells and lamps (no direction needed).
let lightR = 0, lightG = 0, lightB = 0;
function ambientAt(x, y, z, airOnly = false) {
  const sky = sampleGrid(zSky, zBlocks, ZW, ZD, ZH, outdoor, x, y, z, airOnly);
  const lamp = sampleGrid(zLamp, zBlocks, ZW, ZD, ZH, outdoor, x, y, z, airOnly);
  const lamp2 = lamp * Math.sqrt(lamp);   // lamp^1.5: bright near the lamp, a soft edge further out
  lightR = AMBIENT[0] + skyR * sky + LAMP_COLOR[0] * lamp2;
  lightG = AMBIENT[1] + skyG * sky + LAMP_COLOR[1] * lamp2;
  lightB = AMBIENT[2] + skyB * sky + LAMP_COLOR[2] * lamp2;
  return sky;
}

// The apron and the horizon plane: open ground under the sky (no lamps, no shadows).
function openSky() {
  lightR = AMBIENT[0] + skyR; lightG = AMBIENT[1] + skyG; lightB = AMBIENT[2] + skyB;
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

// What water holds, when it isn't water (the zone's liquid, or its column's: social/liquids.js liquidAt):
// the liquid's colour, or null.
function liquidTint(zone, x, y) {
  if (zPlainWater) return null;
  const id = liquidAt(zone, x, y);
  return id !== "water" ? LIQUIDS[id]?.color || null : null;
}

function shadeHit(game, zone, dx, dy, dz) {
  const t = hit.t, block = hit.block, nx = hit.nx, ny = hit.ny, nz = hit.nz;
  const px = cam.ex + dx * t, py = cam.ey + dy * t, pz = cam.ez + dz * t;
  // Under the sky, whether runes glow is asked where they are (the air in front of the face).
  if (darkPerHit && DARK_SIGHT_BLOCKS.has(block)) setDarkSight(inDark(game, zone, px + nx * 0.5, py + ny * 0.5, pz + nz * 0.5));
  material(block, nx !== 0 ? py : px, nz !== 0 ? py : pz, nz > 0);
  const water = block === B.WATER_SHALLOW || block === B.WATER_DEEP;
  if (water && outdoor && !hit.apron) {
    const tint = liquidTint(zone, hit.x, hit.y);
    if (tint) { const k = (albedo.r + albedo.g + albedo.b) / 3 / 160; albedo.r = tint[0] * k; albedo.g = tint[1] * k; albedo.b = tint[2] * k; }
  }
  // A flat being here? On the floor there's a shadow with nobody casting it.
  if (nz > 0 && shadowCount) {
    for (let k = 0; k < shadowCount; k++) {
      const d = Math.hypot(px - shadowAt[k * 3], py - shadowAt[k * 3 + 1]);
      if (d < 0.48 && Math.abs(pz - shadowAt[k * 3 + 2]) < 0.3) {
        const k = 0.15 + 0.85 * (d / 0.48) ** 2;
        albedo.r *= k; albedo.g *= k; albedo.b *= k;
      }
    }
  }
  // A thin wall with a lit room behind it: in the dark, up close, light shows through the cracks.
  if (!torchOn && t < 4.5 && nz === 0 && hit.z >= FLOOR_Z && hit.z <= FLOOR_Z + 1 && !hit.apron &&
      zSecret.has(hit.x + hit.y * ZW) && (!darkPerHit || inDark(game, zone, px + nx * 0.5, py + ny * 0.5, pz)))
    crackLight(nx !== 0 ? py : px, pz - FLOOR_Z, t);
  const ar = albedo.r, ag = albedo.g, ab = albedo.b, glow = albedo.glow;

  // The apron (the next zone's ground beyond an open edge) has no light arrays of its own: it is lit as open
  // ground, sky × daylight and the sun without shadows (TECH_DESIGN §6.1: cheap, and inside the haze).
  const sky = hit.apron ? openSky() : ambientAt(px + nx * 0.5, py + ny * 0.5, pz + nz * 0.5);
  if (outdoor && sunOn && sky > 0.05) {
    const facing = nx * sunX + ny * sunY + nz * sunZ;
    if (facing > 0) {
      const k = hit.apron ? facing : facing * sunlitGrid(zSun, ZW, ZD, ZH, hit.x, hit.y, hit.z, nx, ny, nz, px, py, pz);
      lightR += sunR * k; lightG += sunG * k; lightB += sunB * k;
    }
  }
  torchAt(dx, dy, dz, t, Math.max(0, -(nx * dx + ny * dy + nz * dz)));

  outR = ar * (lightR + glow); outG = ag * (lightG + glow); outB = ab * (lightB + glow);
  if (water) {
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

// The sky: the horizon colour blending into the zenith's as the ray climbs, the sun's disc and glow,
// clouds drifting at height 40, and stars once daylight goes (fixed to the sky: hashed by direction).
function shadeSky(dx, dy, dz, time) {
  const h = Math.sqrt(Math.max(0, dz));
  outR = hor[0] + (zen[0] - hor[0]) * h; outG = hor[1] + (zen[1] - hor[1]) * h; outB = hor[2] + (zen[2] - hor[2]) * h;
  const s = dx * discX + dy * discY + dz * discZ;
  if (discVis > 0.02 && s > 0.9985) {
    outR += (discR - outR) * discVis; outG += (discG - outG) * discVis; outB += (discB - outB) * discVis;
    return 1;
  }
  const glow = Math.pow(Math.max(0, s), 60) * 120 * discVis;
  outR += glow; outG += glow * (0.55 + 0.35 * discG / 250); outB += glow * 0.6 * discB / 215;
  let density = 0.45, c = 0;
  if (dz > 0.02) {
    const k = (40 - cam.ez) / dz;
    const cx = (cam.ex + dx * k) * 0.025 + time * 0.02, cy = (cam.ey + dy * k) * 0.025;
    const n = noise2(cx, cy) * 0.65 + noise2(cx * 2.3, cy * 2.3) * 0.35;
    c = Math.min(1, Math.max(0, (n - 0.56) / 0.2)) * Math.min(1, dz * 5);
    outR += (cloudR - outR) * c; outG += (cloudG - outG) * c; outB += (cloudB - outB) * c;
    density += 0.45 * c;
  }
  if (starK > 0 && dz > 0.04 && c < 0.6) {
    const q = 70, hs = hash(Math.floor(dx * q), Math.floor(dy * q), Math.floor(dz * q));
    if (hs > 0.993) {
      const b = (0.45 + 0.55 * (hs - 0.993) / 0.007) * starK * (1 - c) * (0.8 + 0.2 * Math.sin(time * 3 + hs * 900));
      outR += 210 * b; outG += 215 * b; outB += 230 * b;
      density = Math.max(density, 0.5 + 0.5 * b);
    }
  }
  return density;
}

// --- The horizon plane (TECH_DESIGN §6.1, "beyond the apron") -----------------------------------------
// Per side: the mean height of the apron band's far row (the top of its ground) and its mean ground colour.
// A side with no band (a shut edge) takes its own edge row's height and, when the world knows it, the ground
// of the terrain beyond (else its own edge's). Cached per zone and apron (raycast.js rayInfo is rebuilt
// when a band is replaced or the zone refreshed).
const HORIZONS = new WeakMap();
function columnTop(blocks, i, step, h) {
  for (let z = h - 1; z >= 0; z--) { const b = blocks[i + z * step]; if (b) return [z + 1, b]; }
  return [0, 0];
}
function rowLook(cells) {   // [[top, block]…] → { z, color }
  let zs = 0, r = 0, g = 0, b = 0, n = 0;
  for (const [top, block] of cells) {
    if (!block) continue;
    const c = BLOCKS[block].color || [120, 120, 120];
    zs += top; r += c[0]; g += c[1]; b += c[2]; n++;
  }
  return n ? { z: zs / n, color: [r / n, g / n, b / n] } : null;
}
export function horizonOf(game, zone) {
  const info = rayInfo(zone);
  let out = HORIZONS.get(info);
  if (out) return out;
  const { w, d, h, blocks } = zone, wd = w * d, ap = zone.apron || {};
  out = {};
  for (const side of ["n", "e", "s", "w"]) {
    const band = ap[side], cells = [];
    if (band) {
      const n = band.bw * band.bd;
      const far = side === "n" ? 0 : side === "s" ? band.bd - 1 : side === "w" ? 0 : band.bw - 1;
      if (side === "n" || side === "s") for (let lx = 0; lx < band.bw; lx++) cells.push(columnTop(band.blocks, lx + far * band.bw, n, h));
      else for (let ly = 0; ly < band.bd; ly++) cells.push(columnTop(band.blocks, far + ly * band.bw, n, h));
    } else if (side === "n" || side === "s") for (let x = 0; x < w; x++) cells.push(columnTop(blocks, x + (side === "n" ? 0 : d - 1) * w, wd, h));
    else for (let y = 0; y < d; y++) cells.push(columnTop(blocks, (side === "w" ? 0 : w - 1) + y * w, wd, h));
    const look = rowLook(cells) || { z: FLOOR_Z, color: [90, 110, 70] };
    if (!band) {   // a shut edge: the terrain beyond, when the world knows it
      const [sx, sy] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[side];
      const beyond = spanOf(game, { wx: zone.wx + sx, wy: zone.wy + sy });
      const ground = beyond?.terrain?.ground, id = ground !== undefined ? B[ground] : undefined;
      if (beyond?.terrain?.enter === "never" && !id) look.color = BLOCKS[B.WATER_DEEP].color;
      else if (id) look.color = BLOCKS[id].color;
    }
    out[side] = look;
  }
  HORIZONS.set(info, out);
  return out;
}

// A ray that left the voxels going down (dz < 0) without hitting: the plane at its side's height, from
// where the ray left (tExit) at the nearest; lit as open ground, a noise texture for its characters, hazed.
function shadeHorizon(dx, dy, dz, tExit, time) {
  const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? horizon.e : horizon.w) : (dy > 0 ? horizon.s : horizon.n);
  let t = (side.z - cam.ez) / dz;
  if (!(t > tExit)) t = tExit;
  const px = cam.ex + dx * t, py = cam.ey + dy * t;
  const n = noise2(px * 0.31, py * 0.31);
  openSky();
  if (sunOn && sunZ > 0) { lightR += sunR * sunZ; lightG += sunG * sunZ; lightB += sunB * sunZ; }
  const k = 0.78 + 0.32 * n, c = side.color;
  outR = c[0] * k * lightR; outG = c[1] * k * lightG; outB = c[2] * k * lightB;
  applyFog(t);
  return 0.55 + 0.45 * n;
}

// --- Dynamic resolution (§6.7) ----------------------------------------------------------------------
const dyn = { on: typeof document !== "undefined", half: false, avg: 0, since: 0 };
export function setDynamicResolution(on) { dyn.on = !!on; if (!on) dyn.half = false; }
export const dynamicResolution = () => ({ on: dyn.on, half: dyn.half });
export function judgeFrame(ms, now) {
  if (!dyn.on || !outdoor) { dyn.half = false; dyn.since = 0; return; }
  const full = dyn.half ? ms * 2 : ms;   // the full cast's cost
  dyn.avg = dyn.avg ? dyn.avg + (full - dyn.avg) * 0.1 : full;
  const leave = dyn.half ? dyn.avg < 12 : dyn.avg > 17;
  if (!leave) { dyn.since = 0; return; }
  if (!dyn.since) dyn.since = now;
  else if (now - dyn.since >= 2000) { dyn.half = !dyn.half; dyn.since = 0; }
}

// This frame is under the sky with your torch out: the dark-only things ask light.js where they are.
let darkPerHit = false;

// Flat beings near you this frame: where they stand (x, y, z), their shadows drawn onto the floor in shadeHit.
let shadowAt = new Float64Array(24), shadowCount = 0;
let torchOn = false;   // your torch is lit (this frame)

export function render3d(game) {
  const { zone, player } = game;
  setCamera(player, game.fov, game.cam);
  shadowCount = 0;
  for (const c of [...hostilesTo(game, player), ...talkersIn(zone)])
    if (isFlat(c) && Math.hypot(c.x - player.x, c.y - player.y) < 20) {
      if (shadowAt.length < (shadowCount + 1) * 3) { const more = new Float64Array(shadowAt.length * 2); more.set(shadowAt); shadowAt = more; }
      shadowAt[shadowCount * 3] = c.x; shadowAt[shadowCount * 3 + 1] = c.y; shadowAt[shadowCount * 3 + 2] = c.z; shadowCount++;
    }
  torchOn = !!player.torch;
  setMaterialTime(game.time);   // water ripples move
  if (depth.length !== S.cols * S.rows) depth = new Float32Array(S.cols * S.rows);
  torch.power = torchPower(player, game.time);
  torch.range = torchRange(player);
  const seeRange = torch.range;
  frameLook(game, zone);
  // Runes glow and ghost planks show only in the dark (light.js inDark). Without sky that's your torch
  // alone, decided once for the frame; under the sky it's asked at each ghost block or rune a ray meets.
  darkPerHit = !zoneIsLightless(zone) && !player.torch;
  setDarkSight(!player.torch && !darkPerHit);
  setGhostVisible(!darkPerHit ? !player.torch : (x, y, z) => inDark(game, zone, x, y, z));

  frameZone(zone);
  const t0 = performance.now();
  castFrame(game, zone, rayInfo(zone), zone.seen, zone.holeSeen, seeRange, game.time, dyn.half && outdoor);
  judgeFrame(performance.now() - t0, performance.now());

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

// Every cell of the view: a ray each (every other column when halved). Its own function, reading nothing
// from the game, the zone or the player but what it is handed, so the shapes of those objects (a new zone's,
// the player's after a zone change) never throw this hot loop back to slow code.
function castFrame(game, zone, info, seen, holes, seeRange, time, half) {
  for (let cy = 0; cy < S.rows; cy++) {
    const v = (1 - (2 * (cy + 0.5)) / S.rows) * cam.halfH;
    for (let cx = 0; cx < S.cols; cx++) {
      const i = cy * S.cols + cx;
      if (half && cx & 1) { S.put(cx, cy, plotCh, plotR, plotG, plotB); depth[i] = depth[i - 1]; continue; }
      const u = ((2 * (cx + 0.5)) / S.cols - 1) * cam.halfW;
      let dx = cam.fX + u * cam.rX + v * cam.uX;
      let dy = cam.fY + u * cam.rY + v * cam.uY;
      let dz = cam.fZ + v * cam.uZ;
      const len = outdoor ? Math.sqrt(dx * dx + dy * dy + dz * dz) : Math.hypot(dx, dy, dz);
      dx /= len; dy /= len; dz /= len;

      let density = 1;
      if (castRay(zone, cam.ex, cam.ey, cam.ez, dx, dy, dz, maxDist, seen, seeRange, holes, info)) {
        shadeHit(game, zone, dx, dy, dz);
        depth[i] = hit.t;
      } else {
        depth[i] = Infinity;
        if (dz > 0 && outdoor) density = shadeSky(dx, dy, dz, time);
        else if (outdoor && dz < 0 && hit.out !== 2) density = shadeHorizon(dx, dy, dz, hit.missT, time);
        else outR = outG = outB = 0;        // looking into a bottomless pit, or into the far dark
      }
      plot(cx, cy, density);
    }
  }
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
  // Monsters, then the guardians' extras, then people (the order the parent game drew them in).
  for (const m of hostilesTo(game, game.player)) { const sp = creatureSprite(game, m); if (sp) drawSprite(game, sp); }
  for (const sp of guardianSprites(game)) drawSprite(game, sp);
  for (const n of talkersIn(zone)) { const sp = creatureSprite(game, n); if (sp) drawSprite(game, sp); }
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
  ambientAt(s.x, s.y, cz, true);
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
