// Sets kept as plain JSON (TECH_DESIGN R5: what persists holds only objects, arrays, strings, numbers and
// booleans, and "Sets become { key: 1 } maps"), so game.state and the player save with JSON.stringify.
//
//   keySet(obj) → view           a Set-like view of obj ({ key: 1 }): has, add, delete, clear, size and
//                                iteration (keys in the order added), so code written for a Set reads and
//                                writes the plain object. The view is runtime only (game.knownPotions over
//                                game.state.ident.known.potion); the object is what is saved.
//   hasKey(set, k) → bool        set: a { key: 1 } map, or a Set (checks still build entities with one)
//   addKey(set, k)               the same two kinds
//   keysOf(set) → [key]          in the order added
export class KeySet {
  constructor(obj) { this.obj = obj; }
  has(k) { return Object.hasOwn(this.obj, k); }
  add(k) { this.obj[k] = 1; return this; }
  delete(k) { const had = this.has(k); delete this.obj[k]; return had; }
  clear() { for (const k of Object.keys(this.obj)) delete this.obj[k]; }
  get size() { return Object.keys(this.obj).length; }
  keys() { return Object.keys(this.obj)[Symbol.iterator](); }
  values() { return this.keys(); }
  forEach(fn, self) { for (const k of Object.keys(this.obj)) fn.call(self, k, k, this); }
  [Symbol.iterator]() { return this.keys(); }
}

export const keySet = (obj) => new KeySet(obj);

export const hasKey = (set, k) => !!set && (typeof set.has === "function" ? set.has(k) : Object.hasOwn(set, k));
export function addKey(set, k) {
  if (typeof set.add === "function") set.add(k);
  else set[k] = 1;
}
export const keysOf = (set) => (!set ? [] : typeof set.has === "function" ? [...set] : Object.keys(set));
