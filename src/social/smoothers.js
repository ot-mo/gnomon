// The Smoothers come (bible §10.3, §12.12, §15.6 "Cast"; C2 #11, WS4b #17; B3). progression/mutations.js counts your
// wakes and, 10 s of game time after the last, emits "smoothers" { zone, size, burnisher, great }; this listener
// sends the pack: `size` smoothers at your tier, a burnisher one tier above when the pack has one, and at Cast 45+ the
// Great Smoother at its head (a smoother made legendary: +3 levels, ×2 health, ×10 experience, the legends' magenta,
// content/creatures/wildlife.js SMOOTHERS.great). They come along the floor, flat (their types are flat: fought on
// the map), each on a tile you could walk to 6 to 10 tiles from you, and they belong to no faction, so the parent
// rule makes every one out for you and for nobody else.
import { on } from "../events.js";
import { spawnCreature, addCreature } from "../creatures.js";
import { arrivalPoint } from "../zones.js";
import { makeRng, seedFor } from "../rng.js";
import { tierOf } from "../leveling.js";
import { SMOOTHERS } from "../content/creatures/wildlife.js";
import { LEGENDS } from "../content/creatures/legends.js";
import { registerCreatureField } from "../save/codec.js";

export const PACK = { near: 6, far: 10 };
const levelOfTier = (t) => 3 * Math.min(8, t) - 1;

export function sendSmoothers(game, { zone = game.zone, size = 1, burnisher = false, great = false } = {}) {
  const p = game.player;
  if (!zone || !p || zone !== game.zone) return [];
  const st = (game.state.smoothers ||= { packs: 0 });
  const rng = makeRng(seedFor(game.seed ?? 0, "smoothers", st.packs++));
  const tier = tierOf(p.level || 1), out = [];
  const taken = new Set();
  const place = () => {
    for (let k = 0; k < 12; k++) {
      const a = rng() * Math.PI * 2, r = PACK.near + rng() * (PACK.far - PACK.near);
      const at = arrivalPoint(zone, "teleport", { fx: p.x + Math.cos(a) * r, fy: p.y + Math.sin(a) * r, yaw: a, anchor: { x: p.x, y: p.y }, strict: true,
        ok: (x, y) => !taken.has(`${x},${y}`) && !zone.creatures.some((c) => c.tx === x && c.ty === y) && Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) >= PACK.near - 1 });
      if (at) { taken.add(`${Math.floor(at.x)},${Math.floor(at.y)}`); return at; }
    }
    return null;
  };
  const spawn = (type, level, extra = {}) => {
    const at = place();
    if (!at) return null;
    const c = spawnCreature(type, Math.floor(at.x), Math.floor(at.y), at.z, { rng, level, state: "idle", ...extra });
    out.push(addCreature(zone, c));
    return c;
  };
  if (great) {
    const G = SMOOTHERS.great, c = spawn(G.species, levelOfTier(tier) + LEGENDS.base.levels, { name: `${G.name} ${G.epithet}` });
    if (c) { c.maxHp = c.hp = c.hp * LEGENDS.base.hpMul; c.xp *= LEGENDS.base.xpMul; c.named = true; c.color = LEGENDS.base.color; c.greatSmoother = true; }
  }
  for (let k = 0; k < size; k++) spawn(SMOOTHERS.pack, levelOfTier(tier));
  if (burnisher) spawn(SMOOTHERS.burnisher, levelOfTier(tier + 1));
  if (out.length) game.log(`${out.length === 1 ? "Something flat slides" : `${out.length} flat things slide`} out of the floor towards you.`, [235, 235, 245]);
  return out;
}

on("smoothers", (game, ev) => { sendSmoothers(game, ev); });
// The Great Smoother keeps the legends' magenta through a save (a creature's colour isn't saved: its mark is).
registerCreatureField("greatSmoother");
on("zone:enter", (game, { zone }) => { for (const c of zone?.creatures || []) if (c.greatSmoother) c.color = LEGENDS.base.color; });
