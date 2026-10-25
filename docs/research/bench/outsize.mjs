import { deflateSync } from "node:zlib";
import { B } from "./src/world.js";
import { noise2, hash } from "./src/rng.js";
for (const [w, d, h] of [[48, 48, 10], [80, 48, 16], [64, 64, 16]]) {
  const blocks = new Uint8Array(w * d * h);
  const set = (x, y, z, id) => { if (x >= 0 && y >= 0 && z >= 0 && x < w && y < d && z < h) blocks[x + y * w + z * w * d] = id; };
  const get = (x, y, z) => (x >= 0 && y >= 0 && z >= 0 && x < w && y < d && z < h ? blocks[x + y * w + z * w * d] : 0);
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
    const n = noise2(x * 0.08 + 1, y * 0.08) * 0.7 + noise2(x * 0.2, y * 0.2 + 1) * 0.3, g = 1 + Math.floor(n * 3.2);
    for (let k = 0; k <= g; k++) set(x, y, k, k === g ? B.GRASS : B.ROCK);
  }
  for (let k = 0; k < (w * d) / 60; k++) {
    const x = 2 + Math.floor(hash(k, 1, 1) * (w - 4)), y = 2 + Math.floor(hash(k, 2, 1) * (d - 4));
    let g = 0; while (get(x, y, g + 1)) g++;
    for (let k2 = g + 1; k2 <= g + 3; k2++) set(x, y, k2, B.PLANK);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) for (let k2 = g + 4; k2 <= g + 5; k2++) set(x + ox, y + oy, k2, B.MOSS);
  }
  const z = deflateSync(Buffer.from(blocks)).length;
  console.log(`${w}x${d}x${h}: raw ${blocks.length} B, deflate ${z} B, base64 ${Math.ceil(z / 3) * 4} chars`);
}
