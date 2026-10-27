// The world model (TECH_DESIGN §2.1): the fixed world map, compiled once from its content data into
// tiles that the world map, the zone edges and the surface generator all read.
//
//   compileWorld(def) → WorldModel        def = { world, terrains, regions?, landmarks?, plans? } (§2.18)
//   validateWorld(def | model) → string[] every problem found (empty: the world is fine)
//   levelOfTier(tier) / tierOfLevel(level) the level rules (DECISIONS.md; bible §4.5)
//
// def.world = { id, version, w, h, name?, terrain: [h strings of w chars], terrainKey: { ch: terrainId | [{ from?, to?, id }] },
//               regions?: [h strings], regionKey?: { ch: regionId }, tiers?: [h strings of 1-8], elevation?: [h strings of 0-3],
//               roads: [{ id, path: [[wx, wy], …], width? }], rivers: [{ id, path, width, liquid? }], start: landmarkId }
//   A terrainKey entry may be a list of x ranges, for a glyph that means two terrains (the real world's &).
//   Without regions, a span's region is its terrain id (the real world until content phase C1).
//   Without tiers, a span's tier is its region's tier. A landmark's own tier always wins.
// def.terrains[id] = { name, glyph, color, enter: "map" | "walk" | "drop" | "never", travelHours, lostChance, biome?,
//                      encounterMul?, edgeMessage?, … }   (content/world/terrains.js explains enter)
// def.regions[id] = { name, tier, music?, encounterRate?, sites?: { village, ruin, lair, historic }, travel?, edges? }
// def.landmarks = [{ id, name, at: [wx, wy], spans?: [[wx, wy], …], tier?, kind?, plan?, anchor?, rect?, datum?, flatten?,
//                    visibleFrom?, checkpoint?, description?, dungeon? }]
//
// How a terrain's enter becomes travel and edges:
//   map   → travel "yes",  edges "open"     (you travel onto it on the world map)
//   walk  → travel "no",   edges "open"     (mountains: only walked into from a neighbouring zone)
//   drop  → travel "drop", edges "open"     (moving onto it on the world map ends the journey in its zone)
//   never → travel "no",   edges "solid"    (the sea)
// A region may override either. A span that a road or river runs through, or a landmark span, whose
// terrain would refuse travel gets travel "road" (only along a road or river edge: the Molar pass, the
// Glass Causeway) and open edges (the Drowned Lantern stands in the sea, at the causeway's end). A
// river does neither (its mouth may lie in the sea).
import { SURFACE } from "../world.js";

export const SIDES = ["n", "e", "s", "w"];
export const SIDE_STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
export const OPPOSITE = { n: "s", e: "w", s: "n", w: "e" };
export const WORLD_LIMITS = { minW: 40, maxW: 64, minH: 20, maxH: 32 };   // §2.18
export const MAX_TIER = 8;
export const SITE_MARGIN = 6;      // per-run sites keep 6 tiles from every zone edge (§5.1 e)
export const FLATTEN_SKIRT = 2;
export const ROAD_HOURS = 3;    // a landmark footprint is flattened with a 2-tile skirt (§5.3)

// Surface zone level = 3 × tier − 1; the tier of a level = min(8, ceil((level + 1) / 3)) (DECISIONS.md).
export const levelOfTier = (tier) => 3 * tier - 1;
export const tierOfLevel = (level) => Math.max(1, Math.min(MAX_TIER, Math.ceil((level + 1) / 3)));

const ENTER = {
  map: { travel: "yes", edges: "open" },
  walk: { travel: "no", edges: "open" },
  drop: { travel: "drop", edges: "open" },
  never: { travel: "no", edges: "solid" },
};
const TRAVEL = ["yes", "no", "road", "drop"], EDGES = ["open", "solid"];

// The terrain id of glyph ch at column x, or undefined.
function terrainOf(key, ch, x) {
  const k = key[ch];
  if (!Array.isArray(k)) return k;
  return k.find((r) => (r.from === undefined || x >= r.from) && (r.to === undefined || x <= r.to))?.id;
}

// A landmark's footprint in its zone: given as rect, or from its plan's size and anchor, or null (no plan yet).
function footprint(l, plans) {
  if (l.rect) return { x: l.rect.x, y: l.rect.y, w: l.rect.w, d: l.rect.d };
  const plan = l.plan && plans?.[l.plan];
  if (!plan?.rows?.length) return null;
  const w = plan.rows[0].length, d = plan.rows.length;
  const [x, y] = Array.isArray(l.anchor) ? l.anchor : [Math.floor((SURFACE.w - w) / 2), Math.floor((SURFACE.d - d) / 2)];
  return { x, y, w, d };
}

// Problems in a definition that would stop it compiling (or make it compile into nonsense).
function defProblems(def) {
  const out = [];
  const W = def?.world;
  if (!W) return ["no world"];
  const { w, h } = W;
  if (!Number.isInteger(w) || !Number.isInteger(h)) return ["w and h must be integers"];
  if (w < WORLD_LIMITS.minW || w > WORLD_LIMITS.maxW || h < WORLD_LIMITS.minH || h > WORLD_LIMITS.maxH)
    out.push(`size ${w}×${h} is outside ${WORLD_LIMITS.minW}..${WORLD_LIMITS.maxW} × ${WORLD_LIMITS.minH}..${WORLD_LIMITS.maxH}`);
  const rows = (name, list, need = true) => {
    if (!list) { if (need) out.push(`no ${name} rows`); return false; }
    if (list.length !== h) out.push(`${name}: ${list.length} rows, not ${h}`);
    list.forEach((r, y) => { if (typeof r !== "string" || r.length !== w) out.push(`${name} row ${y}: not ${w} characters`); });
    return list.length === h && list.every((r) => typeof r === "string" && r.length === w);
  };
  if (!rows("terrain", W.terrain)) return out;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = W.terrain[y][x], t = terrainOf(W.terrainKey || {}, ch, x);
      if (!t) out.push(`terrain (${x}, ${y}): glyph "${ch}" has no terrain`);
      else if (!def.terrains?.[t]) out.push(`terrain (${x}, ${y}): unknown terrain "${t}"`);
    }
  for (const t of Object.keys(def.terrains || {})) {
    const T = def.terrains[t];
    if (!T.travel && !ENTER[T.enter]) out.push(`terrain ${t}: enter "${T.enter}" is not map, walk, drop or never`);
    if (T.travel && !TRAVEL.includes(T.travel)) out.push(`terrain ${t}: travel "${T.travel}"`);
    if (T.edges && !EDGES.includes(T.edges)) out.push(`terrain ${t}: edges "${T.edges}"`);
  }
  if (W.regions && rows("regions", W.regions)) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const r = W.regionKey?.[W.regions[y][x]];
        if (!r) out.push(`regions (${x}, ${y}): glyph "${W.regions[y][x]}" has no region`);
        else if (!def.regions?.[r]) out.push(`regions (${x}, ${y}): unknown region "${r}"`);
      }
  }
  for (const [id, R] of Object.entries(def.regions || {}))
    if (!(Number.isInteger(R.tier) && R.tier >= 1 && R.tier <= MAX_TIER)) out.push(`region ${id}: tier ${R.tier} is not 1..8`);
  if (!W.regions && !W.tiers) out.push("neither regions nor tiers: no span has a tier");
  if (W.tiers && rows("tiers", W.tiers))
    W.tiers.forEach((r, y) => [...r].forEach((c, x) => { if (!(c >= "1" && c <= "8")) out.push(`tiers (${x}, ${y}): "${c}" is not 1..8`); }));
  if (W.elevation && rows("elevation", W.elevation, false))
    W.elevation.forEach((r, y) => [...r].forEach((c, x) => { if (!(c >= "0" && c <= "3")) out.push(`elevation (${x}, ${y}): "${c}" is not 0..3`); }));
  const inside = ([x, y]) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w && y < h;
  for (const [what, list] of [["road", W.roads || []], ["river", W.rivers || []]])
    for (const p of list) {
      if (!p.id) out.push(`a ${what} has no id`);
      if (!Array.isArray(p.path) || p.path.length < 2) { out.push(`${what} ${p.id}: a path needs 2 spans or more`); continue; }
      p.path.forEach((s, i) => {
        if (!inside(s)) out.push(`${what} ${p.id}: span ${i} (${s}) is off the map`);
        else if (i > 0 && Math.abs(s[0] - p.path[i - 1][0]) + Math.abs(s[1] - p.path[i - 1][1]) !== 1)
          out.push(`${what} ${p.id}: spans ${i - 1} and ${i} are not 4-connected`);
      });
      if (what === "river" && !(p.width >= 3 && p.width <= 5)) out.push(`river ${p.id}: width ${p.width} is not 3..5`);
    }
  const ids = new Set(), taken = new Map();
  for (const l of def.landmarks || []) {
    if (!l.id) { out.push("a landmark has no id"); continue; }
    if (ids.has(l.id)) out.push(`landmark ${l.id} is listed twice`);
    ids.add(l.id);
    const spans = l.spans || [l.at];
    if (!spans.every((s) => Array.isArray(s) && inside(s))) { out.push(`landmark ${l.id}: a span is off the map`); continue; }
    if (l.at && !spans.some((s) => s[0] === l.at[0] && s[1] === l.at[1])) out.push(`landmark ${l.id}: at is not one of its spans`);
    for (const s of spans) {
      const k = `${s[0]},${s[1]}`;
      if (taken.has(k)) out.push(`landmarks ${taken.get(k)} and ${l.id} share span (${k})`);
      taken.set(k, l.id);
    }
    spans.forEach((s, i) => {   // a multi-span landmark is one 4-connected piece
      if (i > 0 && !spans.slice(0, i).some((o) => Math.abs(o[0] - s[0]) + Math.abs(o[1] - s[1]) === 1))
        out.push(`landmark ${l.id}: span (${s}) doesn't touch the ones before it`);
    });
    if (l.tier !== undefined && !(Number.isInteger(l.tier) && l.tier >= 1 && l.tier <= MAX_TIER)) out.push(`landmark ${l.id}: tier ${l.tier}`);
    if (l.plan && !(def.plans && l.plan in def.plans)) out.push(`landmark ${l.id}: unknown plan "${l.plan}"`);
    const r = footprint(l, def.plans);
    if (r && (r.x < 0 || r.y < 0 || r.w < 1 || r.d < 1 || r.x + r.w > SURFACE.w || r.y + r.d > SURFACE.d))
      out.push(`landmark ${l.id}: footprint ${JSON.stringify(r)} is outside its ${SURFACE.w}×${SURFACE.d} zone`);
  }
  if (!ids.has(W.start)) out.push(`the start landmark "${W.start}" doesn't exist`);
  return out;
}

const compiled = new WeakMap();   // def → model (cached per def and VERSION.world)

export function compileWorld(def) {
  const hit = compiled.get(def);
  if (hit && hit.version === def.world.version) return hit;
  const bad = defProblems(def);
  if (bad.length) throw new Error(`compileWorld: ${bad.length} problems, the first: ${bad[0]}`);
  const W = def.world, { w, h } = W, regions = def.regions || {};
  const tiles = new Array(w * h);
  const inBounds = (wx, wy) => Number.isInteger(wx) && Number.isInteger(wy) && wx >= 0 && wy >= 0 && wx < w && wy < h;
  const tileAt = (wx, wy) => (inBounds(wx, wy) ? tiles[wx + wy * w] : null);

  for (let wy = 0; wy < h; wy++)
    for (let wx = 0; wx < w; wx++) {
      const terrain = terrainOf(W.terrainKey, W.terrain[wy][wx], wx), T = def.terrains[terrain];
      const region = W.regions ? W.regionKey[W.regions[wy][wx]] : terrain, R = regions[region] || {};
      const how = T.travel ? { travel: T.travel, edges: T.edges || "open" } : ENTER[T.enter];
      const tier = W.tiers ? Number(W.tiers[wy][wx]) : R.tier;
      tiles[wx + wy * w] = {
        wx, wy, terrain, region, tier, level: levelOfTier(tier),
        elev: W.elevation ? Number(W.elevation[wy][wx]) : 0,
        biome: T.biome || terrain,
        travel: R.travel || how.travel, edges: R.edges || how.edges,
        travelHours: T.travelHours ?? null, lostChance: T.lostChance ?? null,
        encounterRate: (R.encounterRate ?? 0.1) * (T.encounterMul ?? 1),
        road: { n: false, e: false, s: false, w: false }, river: { n: false, e: false, s: false, w: false },
        roadWidth: 0, riverWidth: 0, landmark: null, music: R.music ?? null,
      };
    }

  // Roads and rivers: each step of a path joins the two spans' facing sides.
  const link = (list, kind, defWidth) => {
    for (const p of list || [])
      p.path.forEach(([x, y], i) => {
        const t = tileAt(x, y);
        t[`${kind}Width`] = Math.max(t[`${kind}Width`], p.width ?? defWidth);
        if (i === 0) return;
        const [px, py] = p.path[i - 1], from = tileAt(px, py);
        const side = SIDES.find((s) => SIDE_STEP[s][0] === x - px && SIDE_STEP[s][1] === y - py);
        from[kind][side] = true;
        t[kind][OPPOSITE[side]] = true;
      });
  };
  link(W.roads, "road", 2);
  link(W.rivers, "river", 3);
  // A river's liquid (rivers[].liquid; none: plain water) on every span of its path, for the ports (gen/ports.js).
  for (const r of W.rivers || []) if (r.liquid) for (const [x, y] of r.path) tileAt(x, y).riverLiquid = r.liquid;

  // Landmarks.
  const landmarks = new Map(), flatten = [];
  for (const l of def.landmarks || []) {
    const spans = (l.spans || [l.at]).map(([x, y]) => [x, y]);
    const [wx, wy] = l.at || spans[0];
    const rect = footprint(l, def.plans);
    const L = {
      id: l.id, name: l.name, wx, wy, spans, tier: l.tier ?? tileAt(wx, wy).tier, kind: l.kind || "landmark",
      plan: l.plan || null, anchor: l.anchor || "center", rect, datum: l.datum ?? 0, flatten: l.flatten !== false,
      visibleFrom: l.visibleFrom ?? 0, checkpoint: !!l.checkpoint, description: l.description || "",
      dungeon: l.dungeon ? JSON.parse(JSON.stringify(l.dungeon)) : null,
    };
    landmarks.set(L.id, L);
    for (const [x, y] of spans) {
      const t = tileAt(x, y);
      t.landmark = L.id;
      t.tier = L.tier; t.level = levelOfTier(L.tier);
    }
    if (rect && L.flatten) flatten.push({ wx, wy, rect: { ...rect }, z: L.datum });
  }

  // Spans a road or a landmark makes enterable although their terrain is not. A river doesn't: the
  // Inkrun's last span is its mouth in the Glass Sea, and the sea stays shut.
  for (const t of tiles) {
    const onRoad = SIDES.some((s) => t.road[s]);
    if ((onRoad || t.landmark) && t.travel === "no") {
      t.travel = "road";
      t.travelHours ??= ROAD_HOURS;   // a road span takes 3 hours whatever lies under it (bible §4.4)
      t.lostChance ??= 0;
    }
    if ((onRoad || t.landmark) && t.edges === "solid") t.edges = "open";
  }

  const startL = landmarks.get(W.start);
  const model = {
    id: W.id, name: W.name || W.id, version: W.version, w, h, tiles, terrains: def.terrains, regions, plans: def.plans || {},
    tileAt, inBounds,
    // World-map movement onto (wx, wy): viaRoad when the move follows a road or river edge.
    canTravel(wx, wy, viaRoad = false) {
      const t = tileAt(wx, wy);
      if (!t) return false;
      return t.travel === "yes" || t.travel === "drop" || (t.travel === "road" && !!viaRoad);
    },
    // Whether the zone edge on `side` of (wx, wy) can be walked through: both spans exist and both
    // have open edges, so the answer is the same from either side.
    edgeOpen(wx, wy, side) {
      const a = tileAt(wx, wy), [dx, dy] = SIDE_STEP[side] || [];
      const b = dx === undefined ? null : tileAt(wx + dx, wy + dy);
      return !!(a && b && a.edges === "open" && b.edges === "open");
    },
    // The 8 spans around (wx, wy) that exist, as { wx, wy, dx, dy, side } (side only for the 4 straight ones).
    neighbours(wx, wy) {
      const out = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || !inBounds(wx + dx, wy + dy)) continue;
          out.push({ wx: wx + dx, wy: wy + dy, dx, dy, side: SIDES.find((s) => SIDE_STEP[s][0] === dx && SIDE_STEP[s][1] === dy) || null });
        }
      return out;
    },
    landmarks,
    landmarkAt(wx, wy) { const id = tileAt(wx, wy)?.landmark; return id ? landmarks.get(id) : null; },
    start: { wx: startL.wx, wy: startL.wy, landmarkId: startL.id },
    flatten,
    // One id for an edge, the same from both spans: "wx,wy,e" or "wx,wy,s" of the west or north span.
    edgeId(wx, wy, side) {
      if (side === "w") return `${wx - 1},${wy},e`;
      if (side === "n") return `${wx},${wy - 1},s`;
      if (side === "e" || side === "s") return `${wx},${wy},${side}`;
      throw new Error(`edgeId: side "${side}"`);
    },
  };
  compiled.set(def, model);
  return model;
}

// Every problem with a world, as plain sentences. Takes a definition (checked, then compiled and the
// model checked) or a compiled model.
export function validateWorld(defOrModel) {
  let model = defOrModel, out = [];
  if (!defOrModel?.tileAt) {
    out = defProblems(defOrModel);
    if (out.length) return out;
    model = compileWorld(defOrModel);
  }
  const { w, h, tiles } = model;
  if (tiles.length !== w * h) return [...out, `${tiles.length} tiles for ${w}×${h}`];
  for (const t of tiles) {
    const at = `(${t.wx}, ${t.wy})`;
    if (model.tileAt(t.wx, t.wy) !== t) out.push(`tile ${at} isn't where tileAt finds it`);
    if (!TRAVEL.includes(t.travel)) out.push(`tile ${at}: travel "${t.travel}"`);
    if (!EDGES.includes(t.edges)) out.push(`tile ${at}: edges "${t.edges}"`);
    if (!(Number.isInteger(t.tier) && t.tier >= 1 && t.tier <= MAX_TIER)) out.push(`tile ${at}: tier ${t.tier}`);
    if ((t.travel === "yes" || t.travel === "road") && !(t.travelHours > 0)) out.push(`tile ${at}: travel ${t.travel} but no travel hours`);
    for (const s of SIDES) {   // a road or river edge is shared: both sides say so
      const [dx, dy] = SIDE_STEP[s], n = model.tileAt(t.wx + dx, t.wy + dy);
      for (const k of ["road", "river"])
        if (t[k][s] && (!n || !n[k][OPPOSITE[s]])) out.push(`tile ${at}: a ${k} leaves ${s} with no ${k} on the other side`);
      if (t.road[s] && !model.edgeOpen(t.wx, t.wy, s)) out.push(`tile ${at}: a road crosses the solid ${s} edge`);
    }
  }
  if (!model.landmarks.size) out.push("no landmarks");
  for (const L of model.landmarks.values()) {
    const t = model.tileAt(L.wx, L.wy);
    if (t.edges !== "open") out.push(`landmark ${L.id} stands on a span with solid edges`);
    if (!SIDES.some((s) => model.edgeOpen(L.wx, L.wy, s)) && t.travel === "no") out.push(`landmark ${L.id} can't be reached`);
  }
  const s = model.start, st = model.tileAt(s.wx, s.wy);
  if (!st || st.landmark !== s.landmarkId) out.push("the start isn't on its landmark");
  for (const f of model.flatten)
    if (f.rect.x < 0 || f.rect.y < 0 || f.rect.x + f.rect.w > SURFACE.w || f.rect.y + f.rect.d > SURFACE.d)
      out.push(`flatten at (${f.wx}, ${f.wy}) leaves its zone`);
  return out;
}
