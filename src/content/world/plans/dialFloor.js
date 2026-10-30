// The Dial Floor (bible §5 B, §15.3 B: (5, 15), the Brine Flats, tier 1; key threeAccounts): a ring of salt-crusted
// flagstones north of Hollowmere round a stone pin. The three readings of one event of the Fifth Hour:
//   the Flat Account   the mosaic in the floor, read on the map: an arrow bearing north-east and a row of five pips
//   the Deep Inscription  a relief carved on the pin's base, read in 3D in light
//   the Dark Gloss     a rune cut in one kerbstone of the rim, read in 3D with your torch out
// All three are the run's: the event of the Fifth Hour whose site lies nearest (history's Hour sites, world/sites.js), the
// arrow laid toward that site and a pip for each span to it (dialFloorReading; B2, C1b #11), so reading all three
// triangulates it (story/secrets.js). A run without a Fifth-Hour site (the test world's fixture) keeps the fixed accounts
// below, the plan's arrow and its five pips.
//
// The letters (the plan is 25 × 19, its corner at (27, 14) in the zone):
//   .  the ground as the world made it        ,  flagstone (tile)        s  salt crust on the flags
//   o  a kerbstone of the rim (a block high)  u  the kerbstone with the rune in it
//   P  the pin: stone 4 high, the relief at eye height in its base
//   a  the arrow's gold tiles   w  the five white pips   b  the blue hour lines of the dial
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { cells, mural } from "./kit.js";

export const DIAL_FLOOR_ROWS = [
  ".........................", // 0
  "........ooooooooo........", // 1
  "......oo,,,,,,,,,oo......", // 2
  ".....o,,,s,,b,,,,,,o.....", // 3
  "....o,,,,,,,b,,aaa,,o....", // 4
  "...o,,s,,,,,b,,,aa,,,o...", // 5
  "...o,,,,,,,,b,,a,a,,,o...", // 6
  "..o,,,,,,,,,b,a,,,,s,,o..", // 7
  "..o,,,,,,,,,,a,,,,,,,,o..", // 8
  "..,bbbbbbbbbP,,,,,,,,,,..", // 9
  "..o,,,,,,,,,,,,,,,,,,,o..", // 10
  "..o,,s,,,,,,,,,,,,,,,,o..", // 11
  "...o,,w,w,w,w,w,,s,,,o...", // 12
  "...o,,,,,,,,,,,,,,,,,o...", // 13
  "....o,,,,,,,,,,,,,,,o....", // 14
  ".....o,,,,,,,,,,,,,u.....", // 15
  "......oo,,,,,,,,,oo......", // 16
  "........ooooo,ooo........", // 17
  ".........................", // 18
];
export const DIAL_FLOOR_ACCOUNTS = {
  map: "In the last year of the Fifth Hour the people of the Flats were sent north-east, five spans and more, to stand where the needle's shadow fell. The Flats count them still, and the count does not change.",
  deep: "BEHOLD THE FIFTH HOUR, WHO CALLED THE FLATS TO KNEEL AT THE NEEDLE'S FOOT, AND THE FLATS KNELT AND WERE GLAD.",
  dark: "they said kneel\nwe said where\nthe floor said here",
};
const LEGEND = { ".": "keep", ",": "lm.ground", s: "lm.ground", o: "lm.stack", u: "lm.stack", P: "lm.stack", a: "lm.ground", w: "lm.ground", b: "lm.ground" };
const GROUNDS = { ",": B.TILE, s: B.SALT, a: B.MOSAIC_GOLD, w: B.MOSAIC_WHITE, b: B.MOSAIC_BLUE };
const STACKS = { o: [B.STONE, 1], u: [B.RUNE, 1], P: [B.STONE, 4] };

// The run's reading (B2, C1b #11): the Fifth Hour's site nearest the Dial Floor's span (wx, wy), its event's three accounts,
// the bearing to it (eight ways, north up) and the pips (its distance in spans, at most MAX_PIPS). null without one.
export const MAX_PIPS = 9;
const BEARINGS = { "0,-1": "north", "1,-1": "north-east", "1,0": "east", "1,1": "south-east", "0,1": "south", "-1,1": "south-west", "-1,0": "west", "-1,-1": "north-west" };
export function dialFloorReading(run, wx, wy) {
  const R = run?.history?.rulers?.[4];
  if (!R) return null;
  const span = (s) => Math.max(Math.abs(s.at.wx - wx), Math.abs(s.at.wy - wy));
  const site = [...(run.sites?.values() || [])].filter((s) => s.kind === "historic" && s.historyRef?.rulerId === R.id)
    .sort((a, b) => span(a) - span(b) || a.id.localeCompare(b.id))[0];
  const e = site && R.events.find((v) => v.id === site.historyRef.eventId);
  if (!e?.text) return null;
  const dx = site.at.wx - wx, dy = site.at.wy - wy, ax = Math.abs(dx), ay = Math.abs(dy);
  const dir = [ay > 2 * ax ? 0 : Math.sign(dx), ax > 2 * ay ? 0 : Math.sign(dy)];
  return { siteId: site.id, eventId: e.id, dir, bearing: BEARINGS[dir.join()] || "here", pips: Math.min(MAX_PIPS, span(site)),
           accounts: { map: e.text.gospel, deep: e.text.inscription, dark: e.text.hostile } };
}

export function stampDialFloor(zone, ox, oy, rng, opts, ctx = {}) {
  const still = makeRng(seedFor(zone.seed, "dialFloor"));
  stampVault(zone, { name: "the Dial Floor", plan: DIAL_FLOOR_ROWS, height: 4, wall: B.STONE, floorBlock: B.TILE, links: [], legend: LEGEND,
                     grounds: GROUNDS, stacks: STACKS }, ox, oy, still, { roof: "none" });
  const [[px, py]] = cells(DIAL_FLOOR_ROWS, "P"), [[ux, uy]] = cells(DIAL_FLOOR_ROWS, "u");
  let arrow = cells(DIAL_FLOOR_ROWS, "a").sort((p, q) => q[1] - p[1])[0];   // the arrow's foot, by the pin
  const reading = dialFloorReading(ctx.run, ctx.wx, ctx.wy), A = reading?.accounts || DIAL_FLOOR_ACCOUNTS;
  if (reading) {
    // The arrow: four gold tiles out from the pin toward the site; the pips: a white tile a span, every other flag of row 12
    // (row 5 when the arrow points south, clear of it).
    for (const [x, y] of [...cells(DIAL_FLOOR_ROWS, "a"), ...cells(DIAL_FLOOR_ROWS, "w")]) zone.set(ox + x, oy + y, FLOOR_Z - 1, B.TILE);
    const [dx, dy] = reading.dir;
    for (let k = 1; k <= 4; k++) zone.set(ox + px + dx * k, oy + py + dy * k, FLOOR_Z - 1, B.MOSAIC_GOLD);
    arrow = [px + dx, py + dy];
    const row = dy > 0 ? 5 : 12;
    for (let k = 0; k < reading.pips; k++) zone.set(ox + 5 + (k % 7) * 2, oy + row + (k >= 7 ? 1 : 0), FLOOR_Z - 1, B.MOSAIC_WHITE);
    zone.dialFloor = { siteId: reading.siteId, eventId: reading.eventId, bearing: reading.bearing, pips: reading.pips };
  }
  zone.set(ox + px, oy + py, FLOOR_Z + 1, B.MURAL);   // the relief, in the pin's base at eye height
  mural(zone, ox + arrow[0], oy + arrow[1], FLOOR_Z - 1, "map", A.map);
  mural(zone, ox + px, oy + py, FLOOR_Z + 1, "3d", A.deep);
  mural(zone, ox + ux, oy + uy, FLOOR_Z, "dark", A.dark);
  // Key points: where you read each account from (the arrow, the flag south of the pin, the flag inside the rune).
  return { spawn: null, keyPoints: [[arrow[0], arrow[1]], [px, py + 1], [ux - 1, uy]].map(([x, y]) => ({ x: ox + x, y: oy + y })) };
}

export const DIAL_FLOOR_PLAN = {
  id: "dialFloor", name: "the Dial Floor", rows: DIAL_FLOOR_ROWS, legend: LEGEND, grounds: GROUNDS, stacks: STACKS,
  height: 4, wall: B.STONE, floorBlock: B.TILE, roof: "none",
  texts: Object.values(DIAL_FLOOR_ACCOUNTS),
  at: [0, 0], hub: [12, 18],   // the gap in the rim's south side, towards Hollowmere
  stamp: (zone, ox, oy, rng, opts, ctx) => stampDialFloor(zone, ox, oy, rng, opts, ctx),
};
