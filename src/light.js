// Light spread through the air of a floor with a flood fill (learn/05 §7).
// skyLight comes down light wells open to the sky; lampLight radiates from lamp blocks.
const SKY_FALLOFF = 0.13;
const LAMP_FALLOFF = 0.07;
const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export function computeLight(zone, lampId, lampId2 = -1) {
  const { w, d, h, blocks } = zone;
  const n = w * d * h;
  const sky = new Float32Array(n), lamp = new Float32Array(n);
  const skySeeds = [], lampSeeds = [];

  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++)
      for (let z = h - 1; z >= 0; z--) {
        const i = x + y * w + z * w * d;
        if (blocks[i]) break;
        sky[i] = 1;
        skySeeds.push(i);
      }
  for (let i = 0; i < n; i++) if (blocks[i] === lampId || blocks[i] === lampId2) { lamp[i] = 1; lampSeeds.push(i); }

  flood(zone, sky, skySeeds, SKY_FALLOFF);
  flood(zone, lamp, lampSeeds, LAMP_FALLOFF);

  // Which air cells are bright enough to see into (used by the auto-map).
  const lit = new Uint8Array(n);
  for (let i = 0; i < n; i++) lit[i] = !blocks[i] && sky[i] * 0.7 + lamp[i] * lamp[i] > 0.06 ? 1 : 0;

  zone.skyLight = sky;
  zone.lampLight = lamp;
  zone.litMask = lit;
}

function flood(zone, grid, queue, falloff) {
  const { w, d, h, blocks } = zone;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const level = grid[i] - falloff;
    if (level <= 0) continue;
    const x = i % w, y = Math.floor(i / w) % d, z = Math.floor(i / (w * d));
    for (const [ox, oy, oz] of NEIGHBOURS) {
      const nx = x + ox, ny = y + oy, nz = z + oz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= w || ny >= d || nz >= h) continue;
      const ni = nx + ny * w + nz * w * d;
      if (blocks[ni] || grid[ni] >= level) continue;
      grid[ni] = level;
      queue.push(ni);
    }
  }
}

// Trilinear blend of the 8 nearest light values (they live at block centres).
// airOnly: leave out solid blocks (their light is always 0) and blend the rest. Sprites use
// this: otherwise an item lying in a corner averages in the dark inside of two walls and
// comes out at a third of its proper brightness.
export function sampleLight(zone, grid, x, y, z, airOnly = false) {
  const { w, d, h, blocks } = zone;
  x -= 0.5; y -= 0.5; z -= 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  let sum = 0, weights = 0;
  for (let k = 0; k < 8; k++) {
    const ix = x0 + (k & 1), iy = y0 + ((k >> 1) & 1);
    let iz = z0 + (k >> 2);
    const wgt = (k & 1 ? fx : 1 - fx) * (k & 2 ? fy : 1 - fy) * (k & 4 ? fz : 1 - fz);
    if (wgt === 0 || ix < 0 || iy < 0 || iz < 0 || ix >= w || iy >= d) continue;
    if (iz >= h) iz = h - 1;
    const i = ix + iy * w + iz * w * d;
    if (airOnly && blocks[i]) continue;
    sum += wgt * grid[i];
    weights += wgt;
  }
  return airOnly ? (weights > 0 ? sum / weights : 0) : sum;
}
