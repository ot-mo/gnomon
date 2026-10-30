// Places the peoples care about (B3; C2 #5, #3): which faction holds the ground you stand on as holy, which rule it
// keeps there, and where the dial-steles stand with their carved hours. Read from the zone first (whoever builds it may
// say `zone.holy`, `zone.holyAreas`, `zone.steles`), then from the site (`site.holy`; an Hour site is its cult's), then
// from the landmark the span belongs to (content/world/landmarks.js `holy`, `holyFloors`, its plans' `areas` and
// `steles`, in the plan's own coordinates from the landmark's footprint corner). Pure: nothing here changes the game.
//
//   holyAt(game, x, y) → { faction, rule } | null    the holy place you'd be in at (x, y) of the current zone: a plan's
//                                                    area first (its own rule), else the landmark's span or floor, else
//                                                    the site's; rule "holy" unless the area names another
//   landmarkHere(game) → LandmarkModel | null        the landmark of the zone's span (world model), on any floor of it
//   stelesNear(game, x, y, r) → [{ x, y, z, hour }]  the dial-steles within r tiles (Chebyshev) on the surface
//   cultIdOf(run, rulerId) → "cult:<short>" | null    an Hour's cult's faction id (world/run.js registers it)
import { PLANS } from "../content/world/landmarks.js";

const span = (zone) => (Number.isInteger(zone?.wx) && Number.isInteger(zone?.wy) ? `${zone.wx},${zone.wy}` : null);

export function landmarkHere(game) {
  const zone = game.zone, w = game.run?.world;
  if (!zone || !w?.landmarkAt || !span(zone)) return null;
  return w.landmarkAt(zone.wx, zone.wy) || null;
}

// The plan the zone's span is stamped with: the landmark's own, or a multi-span landmark's other span's.
function planHere(game, L) {
  const id = L.spanPlans?.[span(game.zone)] || L.plan;
  return id ? PLANS[id] || null : null;
}
const inRect = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

export function cultIdOf(run, rulerId) {
  const R = run?.history?.rulers?.find((r) => r.id === rulerId);
  return R?.short ? `cult:${R.short}` : null;
}

export function holyAt(game, x, y) {
  const zone = game.zone;
  if (!zone) return null;
  const tx = Math.floor(x), ty = Math.floor(y);
  for (const a of zone.holyAreas || []) if (a.rect && inRect(tx, ty, a.rect)) return { faction: a.faction, rule: a.rule || "holy" };
  if (typeof zone.holy === "string") return { faction: zone.holy, rule: "holy" };
  const L = landmarkHere(game);
  if (L) {
    if ((zone.z || 0) === 0) {
      const plan = planHere(game, L), ox = L.rect?.x || 0, oy = L.rect?.y || 0;
      for (const a of plan?.areas || []) {
        const [x0, y0, x1, y1] = a.rect;
        if (inRect(tx, ty, [x0 + ox, y0 + oy, x1 + ox, y1 + oy])) return { faction: a.faction, rule: a.rule || "holy" };
      }
      const h = typeof L.holy === "string" ? L.holy : L.holy?.[span(zone)];
      if (h) return { faction: h, rule: "holy" };
    } else {
      const h = L.holyFloors?.[zone.z];
      if (h) return { faction: h, rule: "holy" };
    }
  }
  const site = zone.siteId && game.run?.sites?.get(zone.siteId);
  if (site?.holy) return { faction: site.holy, rule: "holy" };
  const cult = site?.historyRef?.rulerId && cultIdOf(game.run, site.historyRef.rulerId);
  if (cult) return { faction: cult, rule: "holy" };
  return null;
}

export function stelesNear(game, x, y, r = 3) {
  const zone = game.zone, out = [];
  const near = (sx, sy) => Math.max(Math.abs(sx - Math.floor(x)), Math.abs(sy - Math.floor(y))) <= r;
  for (const s of zone?.steles || []) if (near(s.x, s.y)) out.push(s);
  const L = landmarkHere(game);
  if (L && (zone?.z || 0) === 0) {
    const plan = planHere(game, L), ox = L.rect?.x || 0, oy = L.rect?.y || 0;
    for (const s of plan?.steles || []) {
      const sx = s.at[0] + ox, sy = s.at[1] + oy;
      if (near(sx, sy) && !out.some((o) => o.x === sx && o.y === sy)) out.push({ x: sx, y: sy, z: s.z ?? null, hour: s.hour });
    }
  }
  return out;
}
