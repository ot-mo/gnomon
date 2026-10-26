// Everything drawn on top of the view: status bar, messages, crosshair, sword, overlays.
import * as S from "./screen.js";
import { sampleLight } from "./light.js";
import { armourValue } from "./player.js";
import { WEAPONS, WEAPON_PALETTE, ELEMENTS, itemName, itemGlyph } from "./items.js";
import { readyStack } from "./throwing.js";
import { PERKS, xpToNext, perkLabel } from "./leveling.js";
import { attr, maxHp } from "./stats.js";
import { wielded } from "./body.js";
import { statusLine } from "./status.js";
import { CURRENCY, formatFunds } from "./currency.js";

export function drawHud(game) {
  const p = game.player;
  const inMap = game.view === "map";
  if (!inMap && (game.mode === "explore" || game.mode === "dead")) {
    drawSword(game);
    drawSpark(game);
    S.put(S.cols >> 1, S.rows >> 1, "+", 255, 255, 255);
    if (game.target && game.mode === "explore") {
      const label = `[E] ${game.target.label}`;
      S.text((S.cols - label.length) >> 1, (S.rows >> 1) + 2, label, 255, 230, 140);
    }
  }
  if (game.mode !== "descend") {
    drawStatus(game, p, inMap ? 1 : 0);
    drawMessages(game, inMap ? 1 : 0);
    drawBossBar(game, inMap ? 2 : 1);
  }

  if (game.mode === "explore" && game.paused) {
    overlay([
      ["THE ROTATION CUBE", [255, 230, 120]],
      ["", null],
      ["Click to play", [255, 255, 255]],
      ["", null],
      ["WASD move · Shift sprint · Space jump", [170, 170, 170]],
      ["Mouse look · Left click attack · Wheel zoom", [170, 170, 170]],
      ["E use / talk · I inventory · J journal · T / right-click throw · Q quick-heal · R swap weapons · F torch · M music · N sounds", [170, 170, 170]],
      ["Tab: rotate to the view from above (the map: turn-based)", [170, 170, 170]],
      ["", null],
      ["From inside you see height, depth, light and dark.", [130, 130, 130]],
      ["From above you see the whole floor, the floor's pictures, and the flat things.", [130, 130, 130]],
    ]);
  } else if (game.mode === "dead") {
    overlay([
      ["YOU DIED", [255, 80, 80]],
      ["", null],
      [`Killed by ${game.deathCause} ${game.zone.type === "dungeon" ? `on depth ${game.zone.dungeonIndex}` : `in ${game.zone.name}`}.`, [220, 220, 220]],
      [`Seed ${game.seed}`, [140, 140, 140]],
      ["", null],
      ["Press R to start a new run", [255, 255, 255]],
    ]);
  } else if (game.mode === "won") {
    const mins = Math.floor(game.time / 60), secs = String(Math.floor(game.time % 60)).padStart(2, "0");
    overlay([
      ["VICTORY", [255, 230, 120]],
      ["", null],
      ["Vorlath is dust, and Hollowmere is safe: flat, and happy about it.", [220, 220, 220]],
      [`Level ${p.level} · ${maxHp(p)} max HP · ${attr(p, "str")} STR · ${mins}:${secs} of game time`, [160, 230, 255]],
      [`Seed ${game.seed}`, [140, 140, 140]],
      ["", null],
      ["Press R to start a new run", [255, 255, 255]],
    ]);
  } else if (game.mode === "descend") {
    S.clear();
    const t = game.zone.type === "dungeon" ? `DEPTH ${game.zone.dungeonIndex}` : game.zone.name.toUpperCase();
    S.text((S.cols - t.length) >> 1, S.rows >> 1, t, 255, 230, 140);
    if (game.zone.final) {
      const sub = "The last floor. Something old waits here.";
      S.text((S.cols - sub.length) >> 1, (S.rows >> 1) + 2, sub, 140, 255, 170);
    }
  } else if (game.mode === "levelup") {
    drawLevelUp(game);
  }
}

// --- The level-up screen: pick one of three perks (four at a milestone) ---------------
const levelLayout = { y0: 0, x0: 0, w: 0 };

function drawLevelUp(game) {
  const choices = game.perkChoices;
  const w = Math.min(S.cols - 4, 76), h = choices.length * 4 + 7;
  const x0 = (S.cols - w) >> 1, y0 = Math.max(1, (S.rows - h) >> 1);
  Object.assign(levelLayout, { x0, y0, w });
  S.blank(x0, y0, w, h);
  for (let x = x0; x < x0 + w; x++) { S.put(x, y0, "-", 140, 115, 50); S.put(x, y0 + h - 1, "-", 140, 115, 50); }
  const p = game.player;
  const title = game.perkGift ? "A trick of the trade! Choose a gift:"
    : game.perkMilestone ? `LEVEL ${p.level}: A MILESTONE! Choose a gift:` : `LEVEL ${p.level}! Choose a gift:`;
  S.text(x0 + ((w - title.length) >> 1), y0 + 2, title, 255, 230, 120);
  choices.forEach((key, k) => {
    const y = y0 + 4 + k * 4, major = PERKS[key].major;
    S.text(x0 + 3, y, `${k + 1}`, 255, 230, 120);
    const name = perkLabel(p, key) + (major ? "  (major)" : "");
    S.text(x0 + 6, y, name, ...(major ? [255, 205, 90] : [255, 255, 255]));
    // The description, on up to two lines.
    const words = PERKS[key].info.split(" "), lines = [""];
    for (const word of words) {
      if ((lines[lines.length - 1] + " " + word).trim().length > w - 8) lines.push(word);
      else lines[lines.length - 1] = (lines[lines.length - 1] + " " + word).trim();
    }
    lines.slice(0, 2).forEach((line, j) => S.text(x0 + 6, y + 1 + j, line, 170, 170, 170));
  });
  const keys = choices.length > 3 ? "1, 2, 3 or 4" : choices.length === 3 ? "1, 2 or 3" : choices.map((_, k) => k + 1).join(" or ");
  S.text(x0 + 3, y0 + h - 2, `Press ${keys} (or click one). The game waits.`, 120, 120, 130);
}

// Which choice (0..2) a click on the level-up screen landed on, or -1.
export function levelUpClick(game, cell) {
  if (!cell || cell.x < levelLayout.x0 || cell.x >= levelLayout.x0 + levelLayout.w) return -1;
  const k = Math.floor((cell.y - levelLayout.y0 - 4) / 4);
  return k >= 0 && k < game.perkChoices.length ? k : -1;
}

// Where you are, for the status line: "DEPTH 3/20" in a dungeon, the zone's name on the surface.
const zoneLabel = (zone) => (zone.type === "dungeon" ? `DEPTH ${zone.dungeonIndex}${zone.dungeonLevels ? `/${zone.dungeonLevels}` : ""}`
  : zone.name.toUpperCase().replace(/^THE /, ""));

function drawStatus(game, p, y) {
  S.blank(0, y, S.cols, 1);
  let x = 1;
  const seg = (str, c) => { S.text(x, y, str, ...c); x += str.length + 2; };
  seg(zoneLabel(game.zone), [255, 230, 140]);
  const n = 16, filled = Math.max(0, Math.min(n, Math.round((p.hp / maxHp(p)) * n)));
  const hpFrac = p.hp / maxHp(p), hpColor = hpFrac > 0.5 ? [120, 230, 120] : hpFrac > 0.25 ? [240, 200, 80] : [255, 80, 80];
  seg(`HP [${"#".repeat(filled)}${".".repeat(n - filled)}] ${p.hp}/${maxHp(p)}`, hpColor);
  seg(`LV ${p.level} (${p.xp}/${xpToNext(p.level)} XP)`, [160, 230, 255]);
  seg(`STR ${attr(p, "str")}`, [255, 170, 80]);
  seg(`ARM ${armourValue(p)}`, [175, 180, 200]);
  seg(formatFunds(p), CURRENCY.color);
  seg(`k ${p.keys}`, [240, 200, 70]);
  seg(`torch ${p.torch ? "on" : "off"}`, p.torch ? [255, 200, 120] : [120, 120, 120]);
  const ready = readyStack(p);   // what T throws
  if (ready) seg(`T: ${itemName(game, ready)} x${ready.count}`, itemGlyph(game, ready)[1]);
  // Active statuses (status.js), each as its def draws it (flying blinks when about to run out).
  for (const { text, color } of statusLine(game, p)) seg(text, color);
  if (game.view === "3d") {
    const perf = `${game.fps.toFixed(0)} fps · ${game.frameMs.toFixed(1)} ms`;
    if (x + perf.length < S.cols) S.text(S.cols - perf.length - 1, y, perf, 90, 140, 90);   // only if there's room
  }
}

// Once the boss (or a guardian) has noticed you, its health runs across the top of the screen.
function drawBossBar(game, y) {
  const boss = game.zone.creatures.find((m) => (m.type === "lich" || m.guardian) && m.state === "chase");
  if (!boss) return;
  const n = Math.min(40, S.cols - 30), filled = Math.max(0, Math.round((boss.hp / boss.maxHp) * n));
  const label = `${boss.type === "lich" ? "THE LICH KING" : "THE " + boss.name.toUpperCase()}${boss.risen ? " (RISEN!)" : ""} [${"#".repeat(filled)}${".".repeat(n - filled)}]`;
  S.blank((S.cols - label.length) >> 1, y, label.length, 1);
  S.text((S.cols - label.length) >> 1, y, label, ...boss.color);
}

// The latest messages, bottom left. On the map they sit above the inspect line.
function drawMessages(game, raise) {
  const recent = game.messages.filter((m) => game.time - m.time < 10).slice(-5);
  recent.forEach((m, k) => {
    const fade = Math.max(0.35, 1 - (game.time - m.time) / 10);
    const y = S.rows - recent.length + k - 1 - raise;
    S.blank(1, y, m.text.length + 2, 1);
    S.text(2, y, m.text, m.color[0] * fade, m.color[1] * fade, m.color[2] * fade);
  });
}

// ---------------------------------------------------------------------------
// The weapon in your hand: its pixel art (items.js WEAPONS[…].held, pointing up, hand at
// `pivot`) drawn rotated in screen space. An attack blends poses over p.swingTime:
// slashing weapons wind up, cut diagonally across the view and recover; the spear thrusts.
// x, y: hand position as a fraction of the screen; a: angle from straight up (+ = clockwise)
const IDLE = { x: 0.8, y: 1.04, a: -0.5 };
const WINDUP = { x: 0.84, y: 0.8, a: 0.5 };     // raised over the right shoulder
const FOLLOW = { x: 0.3, y: 0.98, a: -2.25 };   // after cutting diagonally across the view
const SPEAR_IDLE = { x: 0.8, y: 1.02, a: -0.4 };
const SPEAR_BACK = { x: 0.86, y: 1.14, a: -0.4 };   // drawn back
const SPEAR_OUT = { x: 0.6, y: 0.8, a: -0.62 };     // driven forward at the crosshair

const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: a.a + (b.a - a.a) * t });
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

function swingPose(s) {   // s = 0..1 through the swing
  if (s < 0.2) return mix(IDLE, WINDUP, smooth(s / 0.2));
  if (s < 0.55) return mix(WINDUP, FOLLOW, easeOut((s - 0.2) / 0.35));
  return mix(FOLLOW, IDLE, smooth((s - 0.55) / 0.45));
}

function thrustPose(s) {
  if (s < 0.25) return mix(SPEAR_IDLE, SPEAR_BACK, smooth(s / 0.25));
  if (s < 0.5) return mix(SPEAR_BACK, SPEAR_OUT, easeOut((s - 0.25) / 0.25));
  return mix(SPEAR_OUT, SPEAR_IDLE, smooth((s - 0.5) / 0.5));
}

function drawSword(game) {
  const p = game.player, zone = game.zone, inHand = wielded(p);
  const weapon = WEAPONS[inHand.id];
  const held = weapon.held;
  // Lit like the world: your torch, or whatever light is around you.
  const lamp = sampleLight(zone, zone.lampLight, p.x, p.y, p.z + 1.2);
  const sky = sampleLight(zone, zone.skyLight, p.x, p.y, p.z + 1.2);
  const light = Math.min(1.25, 0.22 + sky * 0.6 + lamp * 1.1 + (p.torch ? 0.75 : 0));
  const pose = weapon.thrust ? thrustPose : swingPose;
  const [t0, t1] = weapon.thrust ? [0.25, 0.6] : [0.2, 0.75];   // when the motion trail shows
  // An element makes the metal glow its colour (flickering, for fire and storm) and colours the trail.
  const el = inHand.element && ELEMENTS[inHand.element];
  const glow = el && { color: el.color, flicker: inHand.element === "fire" || inHand.element === "shock" ? 0.75 + 0.25 * Math.sin(game.time * 23) : 1 };

  if (p.swing > 0) {
    const s = 1 - p.swing / p.swingTime;
    if (s > t0 && s < t1) {   // motion trail: fading ghosts of the head along its path
      const fade = s < t1 - 0.2 ? 1 : (t1 - s) / 0.2;
      for (let k = 14; k >= 1; k--) drawWeaponAt(held, pose(Math.max(t0, s - 0.014 * k)), fade * (1 - 0.065 * k), true, glow);
    }
    drawWeaponAt(held, pose(s), light, false, glow);
  } else {
    const bob = p.walkPhase || 0, rest = weapon.thrust ? SPEAR_IDLE : IDLE;
    drawWeaponAt(held, { x: rest.x + Math.cos(bob * 0.5) * 0.008, y: rest.y + Math.abs(Math.sin(bob * 0.5)) * 0.02, a: rest.a }, light, false, glow);
  }
}

const METAL = new Set(["w", "W", "s", "d", "D"]);   // the parts of a weapon an element lights up

function drawWeaponAt(held, pose, light, trail, glow = null) {
  const { art, pivot } = held;
  const Wp = S.cols * S.cellW, Hp = S.rows * S.cellH;   // screen size in pixels
  const artH = art.length, artW = art[0].length;
  const len = Hp * held.length, wid = (len * artW) / artH;
  const trailRows = Math.floor(pivot * artH * 0.8);       // only the business end leaves a trail
  const px = pose.x * Wp, py = pose.y * Hp;
  const ax = Math.sin(pose.a), ay = -Math.cos(pose.a);   // along the weapon, toward the tip
  const qx = Math.cos(pose.a), qy = Math.sin(pose.a);    // across it

  // Bounding box of the rotated weapon, in cells.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const along of [len * pivot, -len * (1 - pivot)]) for (const across of [-wid / 2, wid / 2]) {
    const cx = px + ax * along + qx * across, cy = py + ay * along + qy * across;
    x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
  }
  const c0 = Math.max(0, Math.floor(x0 / S.cellW)), c1 = Math.min(S.cols - 1, Math.ceil(x1 / S.cellW));
  const r0 = Math.max(1, Math.floor(y0 / S.cellH)), r1 = Math.min(S.rows - 1, Math.ceil(y1 / S.cellH));

  for (let y = r0; y <= r1; y++) {
    for (let x = c0; x <= c1; x++) {
      const dx = (x + 0.5) * S.cellW - px, dy = (y + 0.5) * S.cellH - py;
      const row = Math.floor((pivot - (dx * ax + dy * ay) / len) * artH);
      const col = Math.floor(((dx * qx + dy * qy) / wid + 0.5) * artW);
      if (row < 0 || row >= artH || col < 0 || col >= artW) continue;
      const ch = art[row][col];
      if (ch === " " || (trail && row >= trailRows)) continue;
      let [r, g, b] = trail ? (glow ? glow.color : [170, 200, 255]) : WEAPON_PALETTE[ch][0];
      r *= light; g *= light; b *= light;
      if (glow && !trail && METAL.has(ch)) {   // blend the metal toward the element's colour, glowing
        const k = 0.55 * glow.flicker;
        r = r * (1 - k) + glow.color[0] * k * 1.2; g = g * (1 - k) + glow.color[1] * k * 1.2; b = b * (1 - k) + glow.color[2] * k * 1.2;
      }
      const L = Math.min(1, (Math.max(r, g, b) / 255) * 1.15);
      S.put(x, y, S.rampChar(trail ? L * 0.75 : Math.max(0.35, L)), Math.min(255, r), Math.min(255, g), Math.min(255, b));
    }
  }
}

// A burst of sparks at the crosshair when a blow lands.
function drawSpark(game) {
  const spark = game.effects.find((e) => e.kind === "spark" && game.time - e.time < 0.15);
  if (!spark) return;
  const age = (game.time - spark.time) / 0.15;
  const cx = S.cols >> 1, cy = S.rows >> 1;
  const reach = (spark.crit ? 7 : 5) * (0.4 + age);
  const color = spark.color || (spark.crit ? [255, 220, 80] : [255, 250, 230]);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + spark.time * 7;
    const r = reach * (0.6 + 0.4 * ((k * 7) % 3) / 2);
    const x = Math.round(cx + Math.cos(a) * r * 2), y = Math.round(cy + Math.sin(a) * r);
    S.put(x, y, k % 2 ? "*" : "+", ...color.map((c) => c * (1 - age * 0.6)));
  }
  S.put(cx, cy, "X", ...color);
}

function overlay(lines) {
  const w = Math.min(S.cols - 2, Math.max(...lines.map(([t]) => t.length)) + 6);
  const h = lines.length + 4;
  const x0 = (S.cols - w) >> 1, y0 = (S.rows - h) >> 1;
  S.blank(x0, y0, w, h);
  for (let x = x0; x < x0 + w; x++) { S.put(x, y0, "-", 90, 90, 90); S.put(x, y0 + h - 1, "-", 90, 90, 90); }
  lines.forEach(([t, c], k) => {
    if (!t) return;
    S.text(x0 + ((w - t.length) >> 1), y0 + 2 + k, t, ...c);
  });
}
