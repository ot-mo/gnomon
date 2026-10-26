// The one Web Audio context that music.js and sfx.js share.
//
// Browsers only allow sound after the player has pressed a key or clicked, so the context is
// created by unlockAudio(), which the input handlers call. Modules that make sound register
// with onAudioReady() to build their part of the sound chain once it exists.
//
// Sound only plays while the game is actually on screen: audioFrame() is called every frame,
// and when frames stop coming (a hidden tab, a minimised window) everything falls silent until
// they return.
//
//   savedSwitch(name) · saveSwitch(name, on)   a remembered "on" / "off" under storageKey(name); the
//                                   parent game's key ("rotation-cube-<name>") is read when there is none
import { storageKey } from "./config.js";

let ctx = null, asleep = false, lastFrame = 0;
const ready = [];

export const audioContext = () => ctx;

export function onAudioReady(fn) {
  ready.push(fn);
  if (ctx) fn(ctx);
}

export function unlockAudio() {
  if (ctx) { if (ctx.state === "suspended" && !asleep) ctx.resume(); return; }
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return;
  ctx = new AC();
  lastFrame = performance.now();
  for (const fn of ready) fn(ctx);
  setInterval(() => {   // no frame for half a second: the game isn't on screen, go quiet
    if (ctx.state === "running" && performance.now() - lastFrame > 500) { asleep = true; ctx.suspend(); }
  }, 100);
}

export function audioFrame() {
  lastFrame = performance.now();
  if (ctx && asleep) { asleep = false; ctx.resume(); }
}

// A preference remembered between visits ("on" / "off"), if the browser lets us store it. Before 0D2 the
// keys were the parent game's ("rotation-cube-music"); a choice made then still counts.
export function savedSwitch(name) {
  try { return (localStorage.getItem(storageKey(name)) ?? localStorage.getItem(`rotation-cube-${name}`)) !== "off"; } catch (e) { return true; }
}
export function saveSwitch(name, on) {
  try { localStorage.setItem(storageKey(name), on ? "on" : "off"); } catch (e) { /* fine */ }
}

// A reverb's echo: noise dying away over `seconds`, a little different in each ear.
export function impulse(ac, seconds, decay = 2.8) {
  const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
