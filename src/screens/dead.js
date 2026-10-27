// Death and victory (TECH_DESIGN §4.2 `dead`): the view as it was, the card over it. A beat later (RECAP_AFTER of
// real time) the death card gives way to the recap: the cause, the last 10 messages, the damage taken by source
// over this life, and what the run's mode does now. One Wick: the life's slot is deleted at death and a grave
// record written (save.js endRun); the Commons Lamp and Pilgrim: the slot goes back to its last checkpoint at
// death, and C wakes you there (wakeAtCheckpoint). R (or a click on "Press R…") starts a new run, in the same
// mode; T goes to the title.
//
//   recapOf(game) → { cause, messages, hurt: [[source, damage]], mode, ending: "gone" | "checkpoint" | "unsaved" }
//   RECAP_AFTER = 1 (real seconds)
// The damage is counted in game.state.recap.hurt (saved with the run) by a wrapper around game.hurtPlayer, put on
// at the first zone:enter: game.js's hurtPlayer has no event of its own yet (docs/ws9.md, integration requests).
import * as S from "../screen.js";
import { registerScreen, setMode } from "../screens.js";
import { at, hitLabel, modal, box, UI, wrap } from "../ui.js";
import { drawDead, drawWon } from "../hud.js";
import { drawPlay } from "./play.js";
import { on } from "../events.js";
import { endRun, wakeAtCheckpoint, modeOf, RUN_MODES } from "../save/index.js";

export const RECAP_AFTER = 1;
const recap = { since: 0, messages: [], ending: "unsaved", restored: false, waking: false, error: "", mode: "oneWick" };

function tally(game, source, dmg) {
  const st = game.state;
  if (!st || !(dmg > 0)) return;
  const hurt = ((st.recap ||= {}).hurt ||= {});
  const k = String(source || "something");
  hurt[k] = (hurt[k] || 0) + dmg;
}
on("zone:enter", (game) => {
  if (typeof game.hurtPlayer !== "function" || game.hurtPlayer.tallied) return;
  const base = game.hurtPlayer;
  const wrapped = function (dmg, source, quiet) {
    if (this.mode !== "dead") tally(this, source, Math.min(dmg, Math.max(0, this.player?.hp ?? dmg)));
    return base.call(this, dmg, source, quiet);
  };
  wrapped.tallied = true;
  game.hurtPlayer = wrapped;
}, { priority: 100 });

export function recapOf(game) {
  const hurt = Object.entries(game.state?.recap?.hurt || {}).sort((a, b) => b[1] - a[1]);
  return { cause: game.deathCause, messages: recap.messages, hurt, mode: recap.mode, ending: recap.ending };
}

function enter(game) {
  recap.since = game.uiTime || 0;
  recap.messages = (game.messages || []).slice(-10).map((m) => ({ text: m.text, color: m.color }));
  recap.mode = modeOf(game);
  recap.restored = false; recap.waking = false; recap.error = "";
  const sv = game.saving;
  recap.ending = !sv ? "unsaved" : RUN_MODES[recap.mode].death === "checkpoint" && sv.cpRecord ? "checkpoint" : "gone";
  endRun(game, { cause: game.deathCause }).then(() => { recap.restored = recap.ending === "checkpoint"; },
    (e) => { recap.error = `The save couldn't be settled: ${e.message}`; });
}

const timeLabel = (t) => { const m = Math.floor((t || 0) / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };

function drawRecap(game) {
  const r = recapOf(game), p = game.player, w = Math.min(S.cols - 2, 84);
  const lines = [];
  const where = game.zone ? (game.zone.type === "dungeon" ? `on depth ${game.zone.dungeonIndex}` : `in ${game.zone.name}`) : "";
  lines.push([`Killed by ${r.cause} ${where}.`, [220, 220, 220]]);
  lines.push([`Level ${p?.level ?? 1} · ${timeLabel(game.time)} of game time · seed ${game.seed} · ${RUN_MODES[r.mode].name}`, [160, 230, 255]]);
  lines.push(["", null]);
  const hurt = r.hurt.slice(0, 6).map(([s, n]) => `${s} ${n}`).join(" · ");
  for (const l of wrap(`Damage taken: ${hurt || "none counted"}`, w - 6)) lines.push([l, [255, 150, 120]]);
  lines.push(["", null]);
  lines.push(["The last messages:", [200, 200, 200]]);
  for (const m of r.messages) lines.push([`  ${m.text}`.slice(0, w - 6), m.color.map((c) => c * 0.8)]);
  lines.push(["", null]);
  const kept = r.mode === "pilgrim" ? "The road kept your place" : "The commons lamp kept your place";
  const end = r.ending === "checkpoint" ? (recap.restored ? `${kept}: C wakes you at the last settlement.` : "Finding the last settlement...")
    : r.ending === "gone" ? "One Wick: this life is over, and its save is gone." : "This run was never saved.";
  lines.push([end, [255, 230, 140]]);
  if (recap.error) lines.push([recap.error, UI.bad]);
  lines.push(["", null]);
  const keys = `Press R to start a new run${r.ending === "checkpoint" && recap.restored ? " · C to wake" : ""} · T for the title`;
  lines.push([keys, [255, 255, 255]]);
  const h = Math.min(S.rows, lines.length + 4);
  const m = modal(w, h);
  box(m.x0, m.y0, m.w, m.h, { rules: true, edge: [90, 90, 90] });
  S.text(m.x0 + ((m.w - 8) >> 1), m.y0 + 1, "YOU DIED", 255, 80, 80);
  lines.slice(0, h - 4).forEach(([t, c], k) => { if (t) S.text(m.x0 + 3, m.y0 + 3 + k, t.slice(0, m.w - 6), ...c); });
  const row = { x: m.x0 + 3, y: m.y0 + 3 + Math.min(lines.length, h - 4) - 1, text: keys };
  hitLabel(row, "Press R to start a new run", { key: "KeyR" });
  hitLabel(row, "C to wake", { key: "KeyC" });
  hitLabel(row, "T for the title", { key: "KeyT" });
}

const showing = (game) => (game.uiTime || 0) - recap.since >= RECAP_AFTER;
function act(game, code) {
  if (code === "KeyR") { const mode = recap.mode; game.newRun(); if (game.state) game.state.mode = mode; return true; }
  if (!showing(game)) return false;
  if (code === "KeyT") { import("./title.js").then((t) => t.openTitle(game)); return true; }
  if (code === "KeyC" && recap.ending === "checkpoint" && recap.restored && !recap.waking) {
    recap.waking = true;
    wakeAtCheckpoint(game).catch((e) => { recap.waking = false; recap.error = `Couldn't wake there: ${e.message}`; if (game.mode !== "dead") setMode(game, "dead", null, { pointer: false }); });
    return true;
  }
  return false;
}

registerScreen("dead", {
  over: "none",
  enter,
  draw(game) { drawPlay(game); if (showing(game) && game.player) drawRecap(game); else drawDead(game); },
  key(game, code, repeat) { if (repeat) return code === "KeyR" || code === "KeyC" || code === "KeyT"; return act(game, code); },
  mouse(game, button, cell) { const k = at(cell)?.key; if (button === 0 && k) act(game, k); },
});
registerScreen("won", {
  over: "none",
  draw(game) { drawPlay(game); drawWon(game); },
  key(game, code, repeat) {
    if (code !== "KeyR") return false;
    if (!repeat) game.newRun();
    return true;
  },
  mouse(game, button, cell) { if (button === 0 && at(cell)?.key === "KeyR") game.newRun(); },
});
