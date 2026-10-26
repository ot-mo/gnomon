// Sound effects and voices, synthesized on the spot (no sound files).
//
//   sfx(name, { at, ... }): swing, hit, kill, hurt, block, throw, boom, pickup, gold, crystal,
//     key, drink, levelup, click. `at` ({ x, y }) places it in the world: in 3D a sound to your
//     right comes from the right, and far-off sounds are quieter.
//   speakLetter(ch, voice): one syllable of the made-up language people speak, like Animal
//     Crossing's: every letter of what they say becomes a tiny blip, shaped like a vowel, in
//     that person's own voice. dialogue.js calls it as the words type out.
//
// N switches sounds and voices on and off (remembered between visits).
import { onAudioReady, audioContext, savedSwitch, saveSwitch, impulse } from "./audio.js";

const VOLUME = 0.55;
let out = null;   // { master, voices, echo }
let on = savedSwitch("sounds");
const ear = { x: 0, y: 0, yaw: 0, flat: true };   // where you're listening from

export const soundsOn = () => on;
export function toggleSounds() {
  on = !on;
  saveSwitch("sounds", on);
  return on;
}

// Once a frame: where you are and which way you face.
export function setListener(x, y, yaw, flat) { ear.x = x; ear.y = y; ear.yaw = yaw; ear.flat = flat; }

onAudioReady((ac) => {
  const master = ac.createGain();
  master.gain.value = VOLUME;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(ac.destination);
  const voices = ac.createGain();
  voices.gain.value = 0.9;
  voices.connect(master);
  const echo = ac.createConvolver();   // for the ghost's voice
  echo.buffer = impulse(ac, 1.8, 2);
  const echoGain = ac.createGain();
  echoGain.gain.value = 1.2;
  echo.connect(echoGain).connect(master);
  out = { master, voices, echo, ac };
});

// --- Building blocks ---------------------------------------------------------------------------
function ready() {
  const ac = audioContext();
  return on && out && ac && ac.state === "running" ? ac : null;
}

// Pan and volume for a sound at `at` (no `at`: right in your head).
function place(at) {
  if (!at) return { pan: 0, vol: 1 };
  const dx = at.x - ear.x, dy = at.y - ear.y, dist = Math.hypot(dx, dy);
  if (dist < 0.01) return { pan: 0, vol: 1 };
  const side = (dx * -Math.sin(ear.yaw) + dy * Math.cos(ear.yaw)) / dist;   // +1 = to your right
  return { pan: side * (ear.flat ? 0.25 : 0.75), vol: 1 / (1 + dist * 0.12) };
}

// A gain envelope: up in `attack`, then down to silence by `dur`. Returns the node to connect into.
function env(ac, t, dur, peak, pan = 0, dest = out.master, attack = 0.004) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = ac.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(p).connect(dest);
  return g;
}

function tone(ac, t, { wave = "sine", f0, f1 = f0, dur, vol, pan = 0, attack, filter, dest }) {
  const osc = ac.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  let node = osc;
  if (filter) {
    const f = ac.createBiquadFilter();
    f.type = filter.type; f.frequency.value = filter.f; f.Q.value = filter.q || 0.8;
    node = node.connect(f);
  }
  node.connect(env(ac, t, dur, vol, pan, dest, attack));
  osc.start(t); osc.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(ac, t, { dur, vol, pan = 0, type = "bandpass", f0, f1 = f0, q = 1, dest, attack }) {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  src.connect(f).connect(env(ac, t, dur, vol, pan, dest, attack));
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}

const jitter = (amount) => 1 + (Math.random() * 2 - 1) * amount;

// --- The sounds ------------------------------------------------------------------------------------
export function sfx(name, opts = {}) {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  const { pan, vol } = place(opts.at);
  const v = vol * (opts.vol ?? 1);
  switch (name) {
    case "swing": {   // a whoosh: noise swept through a narrow filter (heavier weapons sound lower)
      const low = opts.heavy ? 0.6 : 1;
      noise(ac, t, { dur: 0.16, vol: 1.6 * v, type: "bandpass", f0: 500 * low, f1: 2600 * low * jitter(0.1), q: 1.2, attack: 0.04 });
      break;
    }
    case "throw":
      noise(ac, t, { dur: 0.1, vol: 1.2 * v, type: "bandpass", f0: 1200, f1: 4000, q: 1.5, attack: 0.02 });
      break;
    case "hit": {     // a thump with a crack on top; a critical rings out
      tone(ac, t, { f0: 170 * jitter(0.1), f1: 55, dur: 0.13, vol: 0.55 * v, pan });
      noise(ac, t, { dur: 0.06, vol: 0.4 * v, pan, type: "lowpass", f0: 2200, f1: 600 });
      if (opts.crit) tone(ac, t, { wave: "triangle", f0: 1320, dur: 0.3, vol: 0.2 * v, pan });
      break;
    }
    case "kill":      // a pop, falling away
      tone(ac, t, { wave: "square", f0: 420 * jitter(0.1), f1: 90, dur: 0.22, vol: 0.3 * v, pan, filter: { type: "lowpass", f: 1500 } });
      noise(ac, t + 0.02, { dur: 0.18, vol: 0.35 * v, pan, type: "lowpass", f0: 1500, f1: 200 });
      break;
    case "hurt":      // you get hit: a low, dull thud
      tone(ac, t, { wave: "sawtooth", f0: 120, f1: 60, dur: 0.22, vol: 0.4, filter: { type: "lowpass", f: 500 } });
      noise(ac, t, { dur: 0.1, vol: 0.3, type: "lowpass", f0: 900, f1: 200 });
      break;
    case "block":     // your armour turns the blow: a metallic clink
      tone(ac, t, { wave: "triangle", f0: 1760, dur: 0.18, vol: 0.25 * v, pan });
      tone(ac, t, { wave: "triangle", f0: 2630, dur: 0.12, vol: 0.18 * v, pan });
      break;
    case "boom":      // a bomb
      noise(ac, t, { dur: 0.9, vol: 0.9 * v, pan, type: "lowpass", f0: 1400, f1: 120, attack: 0.005 });
      tone(ac, t, { f0: 80, f1: 30, dur: 0.6, vol: 0.7 * v, pan });
      break;
    case "pickup":    // a little rising chime
      tone(ac, t, { wave: "triangle", f0: 660, dur: 0.09, vol: 0.3 });
      tone(ac, t + 0.07, { wave: "triangle", f0: 990, dur: 0.14, vol: 0.3 });
      break;
    case "gold":      // coins
      for (const [dt, f] of [[0, 1568], [0.06, 2093], [0.11, 2637]]) tone(ac, t + dt, { wave: "square", f0: f * jitter(0.01), dur: 0.12, vol: 0.14, filter: { type: "lowpass", f: 5000 } });
      break;
    case "crystal":   // a shimmering arpeggio
      [523, 659, 784, 1047, 1319].forEach((f, k) => tone(ac, t + k * 0.06, { f0: f, dur: 0.5, vol: 0.2 }));
      break;
    case "key":       // a jingle
      for (let k = 0; k < 4; k++) tone(ac, t + k * 0.035, { wave: "triangle", f0: 1900 + Math.random() * 900, dur: 0.08, vol: 0.2 });
      break;
    case "drink":     // two gulps
      for (const dt of [0, 0.16]) tone(ac, t + dt, { f0: 260, f1: 140, dur: 0.12, vol: 0.25, filter: { type: "lowpass", f: 700 } });
      break;
    case "levelup":   // a little fanfare
      [392, 523, 659, 784].forEach((f, k) => tone(ac, t + k * 0.09, { wave: "triangle", f0: f, dur: k === 3 ? 0.6 : 0.15, vol: 0.25 }));
      break;
    case "rotate": {   // Tab: the world turns. Rising into 3D, falling back to the flat map.
      const [a, b] = opts.up ? [300, 3600] : [3600, 300];
      noise(ac, t, { dur: 0.45, vol: 0.9, type: "bandpass", f0: a, f1: b, q: 1.4, attack: 0.08 });
      tone(ac, t, { wave: "triangle", f0: opts.up ? 330 : 990, f1: opts.up ? 990 : 330, dur: 0.4, vol: 0.12, attack: 0.05 });
      if (opts.up) [1319, 1760].forEach((f, k) => tone(ac, t + 0.3 + k * 0.05, { f0: f, dur: 0.6, vol: 0.08 }));
      break;
    }
    case "click":
      tone(ac, t, { f0: 1400, dur: 0.03, vol: 0.06 });
      break;
  }
}

// --- Voices: a made-up language -------------------------------------------------------------------
// (The raw sound needs overtones for the vowel filters to shape: a pure sine has none.)
// pitch: the voice's middle note (Hz) · wave: its raw sound · thin: a Flatlander's flat little
// voice · ghost: wavery and echoing · stone: very low and slow
const VOICES = {
  maren:  { pitch: 255, wave: "triangle" },
  pell:   { pitch: 165, wave: "sawtooth" },
  corwin: { pitch: 118, wave: "sawtooth" },
  brann:  { pitch: 205, wave: "triangle", ghost: true },
  mira:   { pitch: 300, wave: "triangle" },
  rook:   { pitch: 130, wave: "sawtooth" },
  lio:    { pitch: 225, wave: "triangle" },
  ess:    { pitch: 430, wave: "square", thin: true },
  tee:    { pitch: 560, wave: "square", thin: true },
  door:   { pitch: 82,  wave: "square", stone: true },
  shrine: { pitch: 140, wave: "triangle", ghost: true },
};
// Where a vowel's sound sits (its two loudest bands, in Hz). Consonants borrow a neutral shape
// and add a puff of noise; m and n hum.
const VOWELS = { a: [800, 1200], e: [500, 1800], i: [320, 2300], o: [500, 900], u: [340, 800], y: [320, 2300] };
const HUM = [260, 1100], NEUTRAL = [520, 1500];

export function speakLetter(ch, voiceId) {
  const ac = ready();
  if (!ac) return;
  const c = ch.toLowerCase();
  if (c < "a" || c > "z") return;
  const v = VOICES[voiceId] || VOICES.maren;
  const t = ac.currentTime + 0.003;
  const dur = v.stone ? 0.11 : 0.065;
  // Every letter has its own little pitch, so the same word always sounds the same.
  const semis = ((c.charCodeAt(0) * 7) % 9) - 4;
  const f0 = v.pitch * Math.pow(2, (semis * 0.6 + (Math.random() - 0.5) * 0.8) / 12);
  const shape = VOWELS[c] || (c === "m" || c === "n" ? HUM : NEUTRAL);

  const osc = ac.createOscillator();
  osc.type = v.wave;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.linearRampToValueAtTime(f0 * (v.stone ? 0.9 : 1.04), t + dur);
  if (v.ghost) {   // a slow quaver
    const lfo = ac.createOscillator(), depth = ac.createGain();
    lfo.frequency.value = 7; depth.gain.value = f0 * 0.05;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.02);
  }
  const g = env(ac, t, dur, v.stone ? 0.7 : v.thin ? 0.4 : 0.6, 0, out.voices, 0.006);
  if (v.ghost) g.connect(out.echo);   // and an echo trailing after it
  for (const [k, f] of shape.entries()) {
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f * (v.thin ? 1.3 : 1); bp.Q.value = 3;
    const lvl = ac.createGain();
    lvl.gain.value = k === 0 ? 1.6 : 1.1;
    osc.connect(bp).connect(lvl).connect(g);
  }
  if (v.thin) {   // flat folk: no body to their voices at all
    const hp = ac.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 700;
    g.disconnect(); g.connect(hp).connect(out.voices);
  }
  if (!VOWELS[c] && c !== "m" && c !== "n" && c !== "l" && c !== "r")   // a consonant's puff
    noise(ac, t, { dur: 0.02, vol: 0.06, type: "bandpass", f0: 2500 + (c.charCodeAt(0) % 5) * 600, q: 2, dest: out.voices });
  osc.start(t); osc.stop(t + dur + 0.02);
}
