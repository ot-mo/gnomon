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
