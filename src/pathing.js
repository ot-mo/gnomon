// Walking on a floor, tile by tile, using each column's standing height (Floor.stand).
// Monsters can climb one block and drop three. The player jumps about 1.5 blocks, so on
// the map also climbs one (two with the High jumper perk).
export const MONSTER_STEP_UP = 1;
export const MONSTER_DROP = 3;
export const PLAYER_STEP_UP = 1;
export const PLAYER_DROP = 8;
export const UNREACHABLE = 32767;

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRS8 = [...DIRS4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
export { DIRS8 };

// Can something step from tile a to the neighbouring tile b?
// Diagonal steps are only allowed across flat ground (no cutting corners).
export function canWalk(stand, w, ax, ay, bx, by, up, down) {
  const za = stand[ax + ay * w], zb = stand[bx + by * w];
  if (za < 0 || zb < 0) return false;
  if (zb - za > up || za - zb > down) return false;
  if (ax !== bx && ay !== by) {
    if (zb !== za || stand[bx + ay * w] !== za || stand[ax + by * w] !== za) return false;
  }
  return true;
}

// Breadth-first "distance to the target" for every tile, following the step rules
// backwards. A monster walks downhill on this field to reach the player.
export function flowField(zone, tx, ty, up = MONSTER_STEP_UP, down = MONSTER_DROP) {
  const { w, d, stand } = zone;
  const dist = new Int16Array(w * d).fill(UNREACHABLE);
  if (tx < 0 || ty < 0 || tx >= w || ty >= d || stand[tx + ty * w] < 0) return dist;
  const start = tx + ty * w;
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const b = queue[head];
    const bx = b % w, by = (b - bx) / w;
    for (const [ox, oy] of DIRS8) {
      const ax = bx + ox, ay = by + oy;
      if (ax < 0 || ay < 0 || ax >= w || ay >= d) continue;
      const a = ax + ay * w;
      if (dist[a] !== UNREACHABLE || !canWalk(stand, w, ax, ay, bx, by, up, down)) continue;
      dist[a] = dist[b] + 1;
      queue.push(a);
    }
  }
  return dist;
}

// Walking distance (in steps, four directions) from (sx, sy) to every tile; -1 = unreachable.
// Used to validate levels and to put the stairs far from the start.
export function reachable(stand, w, d, sx, sy, up, down) {
  const dist = new Int16Array(w * d).fill(-1);
  if (stand[sx + sy * w] < 0) return dist;
  dist[sx + sy * w] = 0;
  const queue = [sx + sy * w];
  for (let head = 0; head < queue.length; head++) {
    const a = queue[head];
    const ax = a % w, ay = (a - ax) / w;
    for (const [ox, oy] of DIRS4) {
      const bx = ax + ox, by = ay + oy;
      if (bx < 0 || by < 0 || bx >= w || by >= d) continue;
      const b = bx + by * w;
      if (dist[b] >= 0 || !canWalk(stand, w, ax, ay, bx, by, up, down)) continue;
      dist[b] = dist[a] + 1;
      queue.push(b);
    }
  }
  return dist;
}
