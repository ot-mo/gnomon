// The Dial Floor (bible §5 B, §15.3 B: (5, 15), the Brine Flats, tier 1; key threeAccounts): a ring of salt-crusted
// flagstones north of Hollowmere round a stone pin. The three readings of one event of the Fifth Hour:
//   the Flat Account   the mosaic in the floor, read on the map: an arrow bearing north-east and a row of five pips
//   the Deep Inscription  a relief carved on the pin's base, read in 3D in light
//   the Dark Gloss     a rune cut in one kerbstone of the rim, read in 3D with your torch out
// Until history names the Fifth-Hour event the stele carries (integration request: the run's event, its nearest site's
// bearing and distance), the three are the fixed accounts below.
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
  "....o,,,,,,,b,,,,a,,o....", // 4
  "...o,,s,,,,,b,,,aa,,,o...", // 5
  "...o,,,,,,,,b,,a,a,,,o...", // 6
  "..o,,,,,,,,,b,a,,,,s,,o..", // 7
  "..o,,,,,,,,,,a,,,,,,,,o..", // 8
  "..,bbbbbbbbbP,,,,,,,,,,..", // 9
  "..o,,,,,,,,,,,,,,,,,,,o..", // 10
  "..o,,s,,,,,,,,,,,,,,,,o..", // 11
  "...o,,,wwwww,,,,,s,,,o...", // 12
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

export function stampDialFloor(zone, ox, oy) {
  const still = makeRng(seedFor(zone.seed, "dialFloor"));
  stampVault(zone, { name: "the Dial Floor", plan: DIAL_FLOOR_ROWS, height: 4, wall: B.STONE, floorBlock: B.TILE, links: [], legend: LEGEND,
                     grounds: GROUNDS, stacks: STACKS }, ox, oy, still, { roof: "none" });
  const [[px, py]] = cells(DIAL_FLOOR_ROWS, "P"), [[ux, uy]] = cells(DIAL_FLOOR_ROWS, "u");
  const arrow = cells(DIAL_FLOOR_ROWS, "a").sort((p, q) => q[1] - p[1])[0];   // the arrow's foot, by the pin
  zone.set(ox + px, oy + py, FLOOR_Z + 1, B.MURAL);   // the relief, in the pin's base at eye height
  mural(zone, ox + arrow[0], oy + arrow[1], FLOOR_Z - 1, "map", DIAL_FLOOR_ACCOUNTS.map);
  mural(zone, ox + px, oy + py, FLOOR_Z + 1, "3d", DIAL_FLOOR_ACCOUNTS.deep);
  mural(zone, ox + ux, oy + uy, FLOOR_Z, "dark", DIAL_FLOOR_ACCOUNTS.dark);
  // Key points: where you read each account from (the arrow, the flag south of the pin, the flag inside the rune).
  return { spawn: null, keyPoints: [[arrow[0], arrow[1]], [px, py + 1], [ux - 1, uy]].map(([x, y]) => ({ x: ox + x, y: oy + y })) };
}

export const DIAL_FLOOR_PLAN = {
  id: "dialFloor", name: "the Dial Floor", rows: DIAL_FLOOR_ROWS, legend: LEGEND, grounds: GROUNDS, stacks: STACKS,
  height: 4, wall: B.STONE, floorBlock: B.TILE, roof: "none",
  at: [0, 0], hub: [12, 18],   // the gap in the rim's south side, towards Hollowmere
  stamp: (zone, ox, oy) => stampDialFloor(zone, ox, oy),
};
