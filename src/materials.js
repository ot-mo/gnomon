// Procedural textures (learn/05 §8). Given a block and the hit point's coordinates
// along the face (u across, v up for walls), set the surface colour in `albedo`.
// `glow` > 0 makes that part of the surface emit light of its own colour.
import { hash, noise2 } from "./rng.js";
import { BLOCKS, B } from "./world.js";

export const albedo = { r: 0, g: 0, b: 0, glow: 0 };

// Game time, so water can ripple. Set once per frame by the renderer.
let time = 0;
export function setMaterialTime(t) { time = t; }

// "Dark sight": with your torch out, runes glow and ghost planks show. Torchlight washes
// them out (runes become faint scratches; ghost planks vanish). Set each frame by the renderer.
let darkSight = false;
export function setDarkSight(v) { darkSight = v; }
// The blocks that read it (in a zone with sky the renderer asks light.js inDark at each hit on one).
export const DARK_SIGHT_BLOCKS = new Set([B.RUNE, B.RUNE_1, B.RUNE_2, B.RUNE_3, B.RUNE_4, B.MURAL, B.MURAL_LIT]);

// 5×5 rune bitmaps carved into RUNE blocks — they only exist in the 3D view.
const RUNES = [
  ["..#..", ".###.", "#.#.#", "..#..", "..#.."],
  ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  ["####.", "#..#.", "####.", "#.#..", "#..#."],
  [".###.", "#...#", "..##.", ".#...", "#####"],
];

// Tally marks for the numeral runes (RUNE_1 … RUNE_4).
const NUMERALS = [1, 2, 3, 4].map((n) => {
  const row = ["...#...", "..#.#..", ".#.#.#.", "#.#.#.#"][n - 1];
  return [row, row, row, row, row];
});

// Draw a rune bitmap into the middle of a wall face: glowing in the dark, barely
// scratched into the stone in torchlight. Returns true if (fu, fv) is on a stroke.
function runeStroke(bitmap, fu, fv) {
  const m = 0.18;
  const ru = (fu - m) / (1 - 2 * m), rv = (1 - fv - m) / (1 - 2 * m);
  if (ru < 0 || ru >= 1 || rv < 0 || rv >= 1) return false;
  return bitmap[Math.floor(rv * bitmap.length)][Math.floor(ru * bitmap[0].length)] === "#";
}

function stoneK(u, v) {
  const row = Math.floor(v * 2);
  const su = u * 2 + (row & 1) * 0.5;
  const seam = v * 2 - row < 0.07 || su - Math.floor(su) < 0.05;
  return seam ? 0.5 : 0.75 + 0.3 * hash(row, Math.floor(su), 3);
}

export function material(id, u, v, isTop) {
  let [r, g, b] = BLOCKS[id].color;
  let k = 1, glow = 0;
  const fu = u - Math.floor(u), fv = v - Math.floor(v);

  switch (id) {
    case B.ROCK:
      k = 0.6 + 0.4 * noise2(u * 2.3, v * 2.3) + 0.12 * hash(Math.floor(u * 7), Math.floor(v * 7), 5);
      break;
    case B.STONE:
      k = stoneK(u, v);
      break;
    case B.MOSS:
      k = stoneK(u, v);
      if (hash(Math.floor(u * 5), Math.floor(v * 5), 9) < 0.5) [r, g, b] = [150, 150, 160];
      break;
    case B.BRICK: {
      const row = Math.floor(v * 4);
      const bu = u * 2 + (row & 1) * 0.5;
      const mortar = v * 4 - row < 0.15 || bu - Math.floor(bu) < 0.08;
      k = mortar ? 0.4 : 0.8 + 0.35 * hash(row, Math.floor(bu));
      break;
    }
    case B.TILE: {
      const tu = Math.floor(u * 2), tv = Math.floor(v * 2);
      const grout = u * 2 - tu < 0.06 || v * 2 - tv < 0.06;
      k = grout ? 0.45 : (tu + tv) & 1 ? 1.0 : 0.72;
      break;
    }
    case B.PLANK: {
      const board = Math.floor(v * 4);
      k = v * 4 - board < 0.1 ? 0.45
        : 0.8 + 0.15 * Math.sin(u * 25 + hash(board, 0) * 20) + 0.1 * hash(board, Math.floor(u));
      break;
    }
    case B.GRASS:
      k = 0.8 + 0.3 * hash(Math.floor(u * 6), Math.floor(v * 6), 7);
      g *= 0.9 + 0.2 * hash(Math.floor(u * 3), Math.floor(v * 3), 8);
      break;
    case B.COLUMN:
      k = 0.82 + 0.12 * Math.sin((u + v * 0.6) * 9 + Math.sin(v * 7) * 1.5);
      if (!isTop) k *= 0.8 + 0.2 * Math.abs(Math.sin(u * Math.PI * 4));
      break;
    case B.CRATE:
      if (fu < 0.13 || fu > 0.87 || fv < 0.13 || fv > 0.87 || Math.abs(fu - fv) < 0.1) k = 1.05;
      else k = 0.6 + 0.1 * Math.sin(fv * 40);
      break;
    case B.LAMP: {
      const d = Math.max(Math.abs(fu - 0.5), Math.abs(fv - 0.5));
      k = 1; glow = d < 0.3 ? 1.3 : d < 0.38 ? 0.15 : 0.7;
      break;
    }
    case B.DOOR: {
      const band = Math.abs(fv - 0.25) < 0.05 || Math.abs(fv - 0.75) < 0.05;
      if (band && !isTop) { [r, g, b] = [80, 80, 90]; k = 0.9; }
      else k = fu * 4 - Math.floor(fu * 4) < 0.08 ? 0.45 : 0.85 + 0.15 * Math.sin(fv * 30 + Math.floor(fu * 4));
      break;
    }
    case B.LOCKED: {
      const rivet = (fu * 4 - Math.floor(fu * 4) - 0.5) ** 2 + (fv * 4 - Math.floor(fv * 4) - 0.5) ** 2 < 0.03;
      const hole = (fu - 0.5) ** 2 + ((fv - 0.5) * 0.7) ** 2;
      if (!isTop && hole < 0.004) k = 0.1;
      else if (!isTop && hole < 0.012) { [r, g, b] = [230, 190, 80]; glow = 0.35; }
      else k = rivet ? 1.1 : 0.75;
      break;
    }
    case B.GATE:
      k = fu * 5 - Math.floor(fu * 5) < 0.35 || Math.abs(fv - 0.5) < 0.04 ? 1.0 : 0.1;
      break;
    case B.RUNE: case B.RUNE_1: case B.RUNE_2: case B.RUNE_3: case B.RUNE_4: {
      k = stoneK(u, v);
      if (isTop) break;
      const n = BLOCKS[id].numeral;
      const bitmap = n ? NUMERALS[n - 1] : RUNES[Math.floor(hash(Math.floor(u), Math.floor(v), 11) * RUNES.length)];
      if (runeStroke(bitmap, fu, fv)) {
        if (darkSight) { [r, g, b] = n ? [255, 200, 110] : [90, 220, 255]; k = 1; glow = 1.1; }
        else k *= 0.82;   // in torchlight: worn scratches you'd hardly notice
      }
      break;
    }
    case B.MURAL: case B.MURAL_LIT: {
      // A framed panel with a lever carved in it: the record of a Rune Lever room's levers.
      // By torchlight they all look the same (worn grooves). In the dark the carvings glow
      // faintly, and the levers you should pull blaze.
      k = stoneK(u, v);
      if (isTop) break;
      const frame = fu < 0.1 || fu > 0.9 || fv < 0.08 || fv > 0.92;
      const stick = Math.abs(fu - 0.5) < 0.06 && fv > 0.3 && fv < 0.78;
      const knob = Math.hypot(fu - 0.5, fv - 0.8) < 0.1;
      const base = Math.abs(fv - 0.25) < 0.05 && Math.abs(fu - 0.5) < 0.22;
      if (frame) { k *= 0.7; if (darkSight) { [r, g, b] = [90, 95, 120]; k = 1; glow = 0.25; } }
      else if (stick || knob || base) {
        if (!darkSight) k *= 0.8;
        else if (id === B.MURAL_LIT) { [r, g, b] = [90, 220, 255]; k = 1; glow = 1.1; }
        else { [r, g, b] = [150, 120, 170]; k = 1; glow = 0.45; }
      }
      break;
    }
    case B.MOSAIC_RED: case B.MOSAIC_BLUE: case B.MOSAIC_GOLD: case B.MOSAIC_WHITE: {
      // Small square tiles. At eye level the colours are faded and alike — the picture only
      // jumps out from above, on the map.
      const tu = Math.floor(u * 3), tv = Math.floor(v * 3);
      const grout = u * 3 - tu < 0.08 || v * 3 - tv < 0.08;
      const grey = (r + g + b) / 3;
      r = grey + (r - grey) * 0.35; g = grey + (g - grey) * 0.35; b = grey + (b - grey) * 0.35;
      k = grout ? 0.5 : 0.62 + 0.12 * hash(tu, tv, 21);
      break;
    }
    case B.SPIKES: {
      // Iron plate full of holes the spikes come out of.
      k = stoneK(u, v) * 0.85;
      if (isTop) {
        const hu = fu * 3 - Math.floor(fu * 3) - 0.5, hv = fv * 3 - Math.floor(fv * 3) - 0.5;
        if (hu * hu + hv * hv < 0.06) { [r, g, b] = [20, 18, 18]; k = 1; }
        else [r, g, b] = [105, 100, 98];
      }
      break;
    }
    case B.ALTAR:
      k = 0.85 + 0.1 * Math.sin((u + v * 0.6) * 9);
      if (!isTop && (fv > 0.82 || fv < 0.1)) { [r, g, b] = [215, 175, 70]; k = 1; glow = 0.1; }   // gold bands
      break;
    case B.GHOST: {
      // Only ever drawn in the dark: pale, translucent-looking boards.
      const board = Math.floor(v * 3);
      k = v * 3 - board < 0.12 ? 0.35 : 0.55 + 0.25 * noise2(u * 3 + board * 5, time * 0.6);
      glow = 0.35 + 0.15 * Math.sin(time * 2 + u * 2);
      break;
    }
    case B.BRAZIER: case B.BRAZIER_LIT: {
      const lit = id === B.BRAZIER_LIT;
      if (isTop) {
        // The bowl: cold grey coals, or flames that flicker.
        const rim = Math.max(Math.abs(fu - 0.5), Math.abs(fv - 0.5)) > 0.38;
        if (rim) { [r, g, b] = [85, 80, 78]; k = 0.9; }
        else if (lit) {
          const f = noise2(u * 6, v * 6 - time * 3);
          [r, g, b] = f > 0.55 ? [255, 230, 140] : [255, 130, 40]; k = 1; glow = 1.0 + 0.4 * f;
        } else { [r, g, b] = [60, 58, 56]; k = 0.6 + 0.3 * hash(Math.floor(u * 8), Math.floor(v * 8), 3); }
      } else {
        // Iron sides with two bands; a lit one glows red-hot near the top.
        [r, g, b] = [85, 80, 78];
        const band = Math.abs(fv - 0.25) < 0.05 || Math.abs(fv - 0.8) < 0.05;
        k = band ? 1.15 : 0.7 + 0.1 * Math.sin(fu * 30);
        if (lit && fv > 0.8) { [r, g, b] = [255, 120, 50]; glow = 0.5 + 0.2 * Math.sin(time * 9 + u * 5); }
      }
      break;
    }
    case B.LEVER: case B.LEVER_ON: {
      k = stoneK(u, v);
      if (isTop) break;
      const on = id === B.LEVER_ON;
      // Handle from the pivot to the tip: pointing up = not pulled, down = pulled.
      const px = 0.5, py = 0.5, tx = 0.62, ty = on ? 0.18 : 0.82;
      const ex = tx - px, ey = ty - py;
      const s = Math.max(0, Math.min(1, ((fu - px) * ex + (fv - py) * ey) / (ex * ex + ey * ey)));
      const dHandle = Math.hypot(fu - (px + ex * s), fv - (py + ey * s));
      const dKnob = Math.hypot(fu - tx, fv - ty);
      if (dKnob < 0.09) { [r, g, b] = on ? [80, 220, 100] : [230, 70, 60]; k = 1; glow = 0.3; }
      else if (dHandle < 0.045) { [r, g, b] = [175, 175, 185]; k = 1; }
      else if (Math.abs(fu - 0.5) < 0.17 && fv > 0.12 && fv < 0.88) { [r, g, b] = [60, 60, 70]; k = 1; }
      break;
    }
    case B.WATER_SHALLOW: {
      // You can see the stony bottom through it; ripples drift across.
      const ripple = Math.sin(u * 5 + time * 1.6 + Math.sin(v * 3.5 + time * 0.9) * 1.6) * Math.sin(v * 4.5 - time * 1.2);
      const bottom = 0.75 + 0.25 * hash(Math.floor(u * 3), Math.floor(v * 3), 4);
      r *= bottom; g *= bottom; b *= bottom;
      k = 0.85 + 0.25 * ripple;
      glow = ripple > 0.7 ? 0.12 : 0;   // glints catch the eye even in dim light
      break;
    }
    case B.WATER_DEEP: {
      const swell = noise2(u * 1.6 + time * 0.35, v * 1.6 - time * 0.25);
      const ripple = Math.sin(u * 3 - time * 0.8 + swell * 4) * Math.sin(v * 3.3 + time * 0.6);
      k = 0.6 + 0.35 * swell + 0.2 * ripple;
      glow = ripple > 0.85 ? 0.18 : 0.02;
      break;
    }
    case B.STAIRS_UP:
      if (isTop) {
        k = 0.45 + 0.2 * Math.floor((1 - fv) * 4);   // four steps, brightening the other way
        glow = 0.25;                                  // a pale glow, so you can find your way back
      } else k = stoneK(u, v);
      break;
    case B.STAIRS:
      if (isTop) {
        k = 0.25 + 0.2 * Math.floor(fv * 4);   // four steps going down
        glow = 0.12;
      } else k = stoneK(u, v);
      break;
  }
  albedo.r = r * k; albedo.g = g * k; albedo.b = b * k; albedo.glow = glow;
}
