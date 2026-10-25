// Small, dependency-free hashing for test fixtures. Runs the same in Node and in the browser.
//
//   hashBytes(bytes)   64-bit hash (16 hex digits) of a byte array or any array of 0..255 numbers
//   hashString(str)    the same over a string's UTF-16 code units
//   canon(value)       JSON with object keys sorted (Maps, Sets and typed arrays turned into arrays),
//                      so two equal structures always give the same text
//   hashJSON(value)    hashString(canon(value))
//
// The mixing is cyrb53's (two 32-bit lanes); collisions are not a concern at this scale.

function mix(h1, h2) {
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

export function hashBytes(bytes, seed = 0) {
  let h1 = 0xdeadbeef ^ seed ^ bytes.length, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    h1 = Math.imul(h1 ^ b, 2654435761);
    h2 = Math.imul(h2 ^ b, 1597334677);
  }
  return mix(h1, h2);
}

export function hashString(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed ^ str.length, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  return mix(h1, h2);
}

// Numbers are rounded to 9 decimals: sums of bonuses may be added up in a different order after a
// refactor, which can move the last bits of a float without changing the game.
export const round9 = (n) => (Number.isInteger(n) ? n : Math.round(n * 1e9) / 1e9);

// Maps and Sets are sorted by key: their insertion order is not part of what a fixture checks.
const byKey = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);

function plain(v) {
  if (v === null || v === undefined) return v ?? null;
  if (typeof v === "number") return Number.isFinite(v) ? round9(v) : String(v);
  if (typeof v !== "object") return v;
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (v instanceof Map) return [...v.entries()].sort((a, b) => byKey(a[0], b[0])).map(([k, x]) => [plain(k), plain(x)]);
  if (v instanceof Set) return [...v].sort(byKey).map(plain);
  if (Array.isArray(v)) return v.map(plain);
  const out = {};
  for (const k of Object.keys(v).sort()) {
    if (v[k] === undefined || typeof v[k] === "function") continue;
    out[k] = plain(v[k]);
  }
  return out;
}

export const canon = (v) => JSON.stringify(plain(v));
export const hashJSON = (v) => hashString(canon(v));
