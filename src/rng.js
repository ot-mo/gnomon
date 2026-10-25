// Seeded random numbers, so a run (and every floor in it) can be replayed from its seed.
export function makeRng(seed) {
  let a = seed >>> 0;
  function rng() {   // mulberry32: tiny, fast, good enough for games
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));   // inclusive on both ends
  rng.pick = (list) => list[Math.floor(rng() * list.length)];
  rng.chance = (p) => rng() < p;
  rng.shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  return rng;
}

// A repeatable "random" number in 0..1 for integer inputs (textures, stars, noise).
export function hash(x, y, z = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The length of (dx, dy), the same in every JavaScript engine. Generation must use this rather
// than Math.hypot: hypot's last bits differ between engines (and between Chrome's JIT tiers in one
// session), and a level that compares distances would then come out differently. Multiplication,
// addition and sqrt are exactly rounded everywhere.
export function distance(dx, dy) { return Math.sqrt(dx * dx + dy * dy); }

// Sort a short list (under 64) in place with exactly the comparisons Node 20's engine makes
// (V8 11 TimSort: one run, then binary insertion). Generation needs this whenever the comparator
// draws random numbers (`() => rand() - 0.5`): engines sort differently and call the comparator a
// different number of times, which would shift every random number after it. With an ordinary
// comparator it gives the same stable order as Array.prototype.sort.
export function seededSort(list, compare) {
  const n = list.length;
  if (n < 2) return list;
  if (n >= 64) throw new Error("seededSort: lists under 64 only");
  const cmp = (x, y) => { const v = Number(compare(x, y)); return Number.isNaN(v) ? 0 : v; };
  let run = 2;   // the run at the start: ascending, or strictly descending (then reversed)
  const descending = cmp(list[1], list[0]) < 0;
  for (let i = 2, prev = list[1]; i < n; i++) {
    const order = cmp(list[i], prev);
    if (descending ? order >= 0 : order < 0) break;
    prev = list[i]; run++;
  }
  if (descending) for (let lo = 0, hi = run - 1; lo < hi; lo++, hi--) [list[lo], list[hi]] = [list[hi], list[lo]];
  for (let start = run; start < n; start++) {   // binary insertion of the rest
    let left = 0, right = start;
    const pivot = list[start];
    while (left < right) {
      const mid = left + ((right - left) >> 1);
      if (cmp(pivot, list[mid]) < 0) right = mid; else left = mid + 1;
    }
    for (let p = start; p > left; p--) list[p] = list[p - 1];
    list[left] = pivot;
  }
  return list;
}

// Smooth value noise: random values at grid points, blended in between.
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// --- Seeds and world functions (TECH_DESIGN §5.3) ---------------------------------------------
// Everything below is built from integer multiplies, shifts, + − × ÷, floor and sqrt, which give
// the same bits in every JavaScript engine, so a world function gives the same terrain in Node and
// in any browser.

// A 32-bit hash of integers and strings (murmur3's mixing). Numbers are taken as 32-bit integers.
const mix32 = (h, k) => {
  k = Math.imul(k, 0xcc9e2d51); k = (k << 15) | (k >>> 17); k = Math.imul(k, 0x1b873593);
  h ^= k; h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
};
const strHash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return h | 0; };
export function hashInt(...parts) {
  let h = 0x9747b28c;
  for (const p of parts) h = mix32(h, typeof p === "number" ? p | 0 : strHash(String(p)));
  h ^= parts.length;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
// A seed for one purpose of a run: seedFor(runSeed, "zone", wx, wy, z). Each purpose gets its own
// stream, so a change in one step of generation never reshuffles another (R6).
export const seedFor = (seed, ...purpose) => hashInt(seed, ...purpose);
// hashInt as a number in 0..1.
export const hashFloat = (...parts) => hashInt(...parts) / 4294967296;

// Value noise like noise2, on its own lattice for each seed (an integer).
export function seededNoise(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const s = seed | 0;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// Fractal noise in 0..1: `octaves` layers of seededNoise, each twice as fine and half as strong.
// Its steepest slope is 1.5 × (1/scale) × Σ gain^k (2^k)… per unit of x; heightAt keeps it gentle.
export function fbm(seed, x, y, octaves = 2, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let k = 0; k < octaves; k++) {
    sum += amp * seededNoise(seed + k * 1013, x * f, y * f);
    norm += amp; amp *= gain; f *= 2;
  }
  return sum / norm;
}
