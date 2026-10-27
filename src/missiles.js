// Missile weapons (TECH_DESIGN §1.1 "fire, reload, ammo in both views", §3.3 "Fire a missile weapon", §4.3
// V; WS8): a sling or a bolt-bow from your pack (content/items/missiles.js holds the weapons and the ammo).
// Both views launch the same projectile (throwing.js), and its contact is one combat.js resolveAttack
// (aimed: it reached its target), told in one log line ("Your bolt hits the goblin for 5.").
//
//   readyLauncher(p) → the missile weapon V fires: the one you fired last (p.readyMissile, its id), else
//       the first in your pack; null if you carry none
//   ammoFor(p, launcher) → the ammo stack it shoots, null when you have none; a launcher with free shots
//       (the sling: stones lie everywhere) needs none and gets true
//   missileSpec(p, launcher) → { kind: "missile", dmg, acc, ench, material, noun, onHit }: a shot's spec;
//       d20 damage is the range + material + enchantment (no STR: the string throws it); acc is the weapon's
//       + bonus(p, "missileAcc") (stats.js; Steady hand, bible §10.8)
//   fire(game) → bool        V in 3D: a shot along your view (pitch included, a little lift for the drop),
//                            once the launcher has reloaded (cooldown "missile", in game seconds)
//   aimFire(game) → false    V on the map: the target screen at the launcher's range; its confirm fires
//                            (fireAt) and passes the reload's time, and then the flight's
//   fireAt(game, launcher, target) → projectile | null    a shot at a target (the map's, or a test's)
// A shot that hurt (and didn't kill) does its weapon's onHit: the sling's stone dazes now and then
// (stunned 1 s), the bolt-bow's bolt pins (the "pinned" status, registered here: it can't move for 2 s,
// but it can still strike and shoot). A bolt drops where it lands unless it breaks; a stone is gone.
import { MISSILES, AMMO } from "./content/items/missiles.js";
import { launch, ballisticFrom, aimPoint, finishFlight } from "./throwing.js";
import { openTarget } from "./screens/target.js";
import { takeOne } from "./items.js";
import { EYE } from "./player.js";
import { sfx } from "./sfx.js";
import { combatRng } from "./combat.js";
import { bonus } from "./stats.js";
import { addStatus, registerStatus, statusFlag, cooldownLeft, startCooldown } from "./status.js";
import { bind } from "./keys.js";
import { registerHudSegment } from "./hud.js";
import { theOf, TheOf } from "./creatures.js";

registerStatus("pinned", { name: "pinned", color: [215, 205, 160], t: 2, stack: "max", flags: { noMove: true },
  hud: (s) => `PINNED ${Math.ceil(s.t)}s`, ended: "You pull yourself free." });

export function readyLauncher(p) {
  const id = p.readyMissile;
  return (id && p.inv.find((s) => s.kind === "missile" && s.id === id)) || p.inv.find((s) => s.kind === "missile") || null;
}
export function ammoFor(p, launcher) {
  const want = MISSILES[launcher.id].ammo;
  if (!want) return true;
  return p.inv.find((s) => s.kind === "ammo" && s.effect === want && (s.count || 1) > 0) || null;
}

export function missileSpec(p, launcher) {
  const m = MISSILES[launcher.id], hit = m.onHit;
  return {
    kind: "missile", weapon: launcher, dmg: [...m.dmg], acc: m.acc + bonus(p, "missileAcc"), ench: launcher.ench || 0, material: launcher.material || 0,
    element: null, noun: m.noun,
    onHit: hit ? (game, tgt) => {
      if (combatRng(game)() >= hit.chance) return;
      addStatus(game, tgt, hit.status, { t: hit.t, stack: "max" });
      game.log(hit.status === "pinned" ? `The bolt pins ${theOf(tgt)} where it stands!` : `${TheOf(tgt)} reels, dazed.`, [215, 205, 160]);
    } : null,
  };
}

// What one shot needs: a launcher, its ammo, and the reload done. Says why not, and returns null.
function ready(game, launcher = readyLauncher(game.player)) {
  const p = game.player;
  if (statusFlag(p, "noAct")) { game.log("You can't move a muscle.", [170, 170, 170]); return null; }
  if (!launcher) { game.log("You have no missile weapon. (A sling or a bolt-bow, carried in your pack, fires with V.)", [170, 170, 170]); return null; }
  const m = MISSILES[launcher.id];
  const ammo = ammoFor(p, launcher);
  if (!ammo) { game.log(`You have no ${AMMO[m.ammo].plural} for your ${m.name}.`, [170, 170, 170]); return null; }
  const left = cooldownLeft(p, "missile");
  if (left > 0) { game.log(`Your ${m.name} isn't ready yet (${left.toFixed(1)} s).`, [170, 170, 170]); return null; }
  return { launcher, m, ammo };
}

// One shot leaves: the ammo spent, the reload started, the projectile on its way.
function loose(game, { launcher, m, ammo }, from, to, vz = null) {
  const p = game.player;
  p.readyMissile = launcher.id;
  if (ammo !== true) takeOne(p, ammo);
  startCooldown(p, "missile", m.reload);
  sfx("throw");
  const extra = { kind: "missile", shape: m.noun === "stone" ? "stone" : "bolt", spec: missileSpec(p, launcher), ammo: m.ammo,
                  breaks: m.ammo ? AMMO[m.ammo].breaks : 1 };
  const pr = launch(game, { kind: "missile" }, from, to, { speed: m.speed, gravity: m.gravity, extra });
  if (vz !== null) {   // 3D: along your view, not at a point
    const cp = Math.cos(p.pitch);
    pr.vx = cp * Math.cos(p.yaw) * m.speed; pr.vy = cp * Math.sin(p.yaw) * m.speed; pr.vz = vz;
    pr.life = 3;
  }
  return pr;
}

export function fire(game) {
  const r = ready(game);
  if (!r) return false;
  const p = game.player, m = r.m;
  const cp = Math.cos(p.pitch), fx = cp * Math.cos(p.yaw), fy = cp * Math.sin(p.yaw), fz = Math.sin(p.pitch);
  const from = { x: p.x + fx * 0.3, y: p.y + fy * 0.3, z: p.z + EYE - 0.2 + fz * 0.3 };
  // The shot leaves along your view, lifted so that it crosses the crosshair about 6 tiles out.
  loose(game, r, from, from, fz * m.speed + 0.5 * m.gravity * (6 / m.speed));
  return true;
}

export function fireAt(game, launcher, target) {
  const p = game.player;
  if (!launcher || !target || !p.inv.includes(launcher)) return null;
  const r = ready(game, launcher);
  if (!r) return null;
  const to = aimPoint(game, target);
  p.yaw = Math.atan2(to.y - p.y, to.x - p.x);
  return loose(game, r, { x: p.x, y: p.y, z: p.z + EYE - 0.2 }, to);
}

export function aimFire(game) {
  const r = ready(game);
  if (!r) return false;
  const { launcher, m } = r;
  openTarget(game, {
    purpose: "missile", item: launcher, range: m.range, verb: `fire the ${m.name}`,
    spec: missileSpec(game.player, launcher),
    flight: (g, to) => ballisticFrom(g, to, m.speed, m.gravity),
    done(g, target) {
      if (!target) return;
      const pr = fireAt(g, launcher, target);
      if (pr) finishFlight(g, pr, m.reload);
    },
  });
  return false;
}

const canAct = (game) => !game.paused && !statusFlag(game.player, "noAct");
bind("explore", "KeyV", (game) => { fire(game); }, { when: canAct, help: "fire missile weapon" });
bind("map", "KeyV", (game) => { aimFire(game); }, { help: "fire missile weapon" });

// The status line (hud.js, row 1 beside what T throws): what V fires, "V: bolt-bow x12" with its bolts, the
// seconds of its reload while it lasts. Nothing while you carry no missile weapon.
registerHudSegment("missile", { priority: 39, row: 1, parts(game, p) {
  const launcher = readyLauncher(p);
  if (!launcher) return null;
  const m = MISSILES[launcher.id], ammo = ammoFor(p, launcher), left = cooldownLeft(p, "missile");
  return { text: `V: ${m.name}${m.ammo ? ` x${ammo ? ammo.count : 0}` : ""}${left > 0 ? ` ${left.toFixed(1)}s` : ""}`,
           color: m.ammo && !ammo ? [150, 150, 150] : [200, 165, 110] };
} });
