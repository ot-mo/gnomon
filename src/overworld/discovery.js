// What you know of the world (TECH_DESIGN §5.2 "Entering", §5.2 "Discovery XP", §2.14; bible §4.9; WS1). The
// terrain of every span is common knowledge from the start; its sites and landmarks show on the world map once
// you know of them. Everything is kept in game.state.atlas (state.js).
//
//   reveal(game, wx, wy, radius = 0) → n    spans within `radius` (8-way) become known: their landmarks and sites
//                                           show on the world map (a reading, a survey, travellers' talk). → how
//                                           many spans were new
//   isKnown(game, wx, wy) → bool            visited, revealed, seen from a landmark's visibleFrom, or learned
//   pin(game, wx, wy, { label, secretId })  a note on the world map; the span becomes known. learnSecret pins
//                                           location secrets (story/secrets.js); one pin per secret. → the pin
//   unpin(game, id) · pinsAt(game, wx, wy) → [pin]
//   knownSites(game, wx, wy) → [Site]       the span's sites you know of (a landmark's once its span is known)
//   findSite(game, site, how)               you know of this one site now (a hidden site seen from the road, a
//                                           rumour); emits "discover" { kind, id, at } the first time
//   visit(game, wx, wy, { pay })            you are in the span's zone (or under it): it is visited and known, its
//                                           sites found, and the discovery XP of each site there paid once (pay
//                                           false: marked paid, nothing given; a load)
//   sight(game, wx, wy)                     landmarks whose visibleFrom reaches (wx, wy) become known
//   discoveryXp(game, site) → n             what a site's first visit pays (0 for a village: its own pays, WS7b)
//
// Discovery XP: the first visit to a landmark gives 0.3 of one level's XP at its surface level, any other site
// but a village RULES.overworld.xp.site (bible §4.9, §15.6). It goes through leveling.gainXp with source
// "discovery" (Pilgrim's ×2.2 where WS4's gainXp reads the source). The world's start span pays nothing: you
// begin there. A visit is entering the span's zone, in either view, or a dungeon level under it. A load is never a
// first visit (WS9's rule; WS7b's village XP keeps it too): a save made before WS1 has no atlas, so the span it loads
// into has its sites marked paid, without paying them.
import { on, emit } from "../events.js";
import { RULES } from "../rules.js";
import { xpToNext, gainXp } from "../leveling.js";
import { levelOfTier } from "../world/worldmodel.js";
import { atlas, spanKey, OW } from "./state.js";

const sitesAt = (game, wx, wy) => (game.run?.sitesAt?.get(spanKey(wx, wy)) || []).map((id) => game.run.sites.get(id)).filter(Boolean);
const now = (game) => game.time || 0;

export function reveal(game, wx, wy, radius = 0) {
  const world = game.run?.world, A = atlas(game);
  if (!world) return 0;
  let n = 0;
  for (let y = wy - radius; y <= wy + radius; y++)
    for (let x = wx - radius; x <= wx + radius; x++) {
      if (!world.inBounds(x, y)) continue;
      const k = spanKey(x, y);
      if (A.revealed[k] === undefined) { A.revealed[k] = now(game); n++; }
      for (const s of sitesAt(game, x, y)) findSite(game, s, "reveal");
    }
  return n;
}

export function isKnown(game, wx, wy) {
  const A = game.state?.atlas, k = spanKey(wx, wy);
  return !!(A && (A.visited[k] !== undefined || A.revealed[k] !== undefined));
}

export function pin(game, wx, wy, { label = "", secretId = null } = {}) {
  const A = atlas(game);
  const id = secretId ? `secret:${secretId}` : `pin:${spanKey(wx, wy)}:${A.n}`;
  const p = (A.pins[id] ||= { id, wx, wy, label: label || "", secretId: secretId || null, at: now(game) });
  if (label) p.label = label;
  reveal(game, wx, wy, 0);
  return p;
}

export function unpin(game, id) {
  const A = atlas(game);
  if (!A.pins[id]) return false;
  delete A.pins[id];
  return true;
}

export const pinsAt = (game, wx, wy) => Object.values(game.state?.atlas?.pins || {}).filter((p) => p.wx === wx && p.wy === wy);

export function knownSites(game, wx, wy) {
  const A = game.state?.atlas;
  if (!A) return [];
  return sitesAt(game, wx, wy).filter((s) => A.found[s.id] || (s.kind === "landmark" && isKnown(game, wx, wy)));
}

export function findSite(game, site, how = "road") {
  const A = atlas(game);
  if (A.found[site.id]) return false;
  A.found[site.id] = how;
  emit(game, "discover", { kind: site.kind, id: site.id, at: { ...site.at }, how });
  return true;
}

// Any site but a village: × one level's XP at the site's surface level.
export function discoveryXp(game, site) {
  if (!site || site.kind === "village") return 0;
  const kind = site.kind === "landmark" ? "landmark" : "site";
  const share = RULES.progression?.xp?.rewards?.[kind] ?? OW().xp[kind] ?? 0;
  return Math.round(share * xpToNext(levelOfTier(site.tier || 1)));
}

export function visit(game, wx, wy, { pay = true } = {}) {
  const world = game.run?.world, A = atlas(game);
  if (!world?.inBounds(wx, wy)) return;
  const k = spanKey(wx, wy), first = A.visited[k] === undefined;
  if (first) A.visited[k] = now(game);
  reveal(game, wx, wy, 0);
  const start = world.start.wx === wx && world.start.wy === wy;
  for (const s of sitesAt(game, wx, wy)) {
    if (A.paid[s.id]) continue;
    A.paid[s.id] = 1;
    const xp = start || !pay ? 0 : discoveryXp(game, s);
    if (!xp) continue;
    game.log?.(`You've found ${s.name}. (+${xp} XP)`, [150, 220, 255]);
    gainXp(game, xp, { source: "discovery" });
  }
  if (first) sight(game, wx, wy);
}

export function sight(game, wx, wy) {
  const world = game.run?.world;
  if (!world) return;
  for (const L of world.landmarks.values()) {
    if (isKnown(game, L.wx, L.wy)) continue;
    const r = Math.min(...L.spans.map(([x, y]) => Math.max(Math.abs(x - wx), Math.abs(y - wy))));   // to its nearest span
    if (r <= (L.visibleFrom || 0)) for (const [x, y] of L.spans) reveal(game, x, y, 0);
  }
}

// Entering a zone is a visit to its span, from either view and from below (a dungeon level under it).
on("zone:enter", (game, ev) => {
  const z = ev.zone;
  if (game.run && Number.isInteger(z?.wx) && Number.isInteger(z?.wy)) visit(game, z.wx, z.wy, { pay: ev.how !== "load" });
});
