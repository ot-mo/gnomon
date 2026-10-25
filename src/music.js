// Background music, composed on the fly with the Web Audio API (no sound files).
//
// A little generative band: a soft pad holding the chord, a bass, plucked notes wandering
// over the scale, and (when things get serious) a kick and hi-hats. What it plays depends on
// where you are:
//   temple  – bright and calm (Lydian), no bass
//   dungeon – minor, sparse plucks over a drone
//   deep    – floors 12 and down: Phrygian, slower, darker
//   boss    – the Lich King is after you: faster, a bass ostinato, drums
// Monsters hunting you bring in a bass pulse and hi-hats.
//
// The view changes the music completely. On the map (and before you've found the cube) the
// band plays flat: no pad, square-wave chiptune notes, crushed to a gritty, mono, narrow-band
// sound. In 3D it plays deep: the pad swells in, the notes go soft and round, in full stereo
// with reverb. The two cross-fade when you rotate. And the first time the cube turns the
// world, a fanfare plays (playCubeTheme), opening from flat to deep with the camera.
//
// M toggles the music (remembered between visits). The audio context itself, and going quiet
// when the game isn't on screen, are in audio.js.
import { onAudioReady, savedSwitch, saveSwitch, impulse } from "./audio.js";

const MOODS = {
  temple:  { bpm: 66,  root: 62, scale: [0, 2, 4, 6, 7, 9, 11], chords: [0, 4, 5, 3], pad: "triangle", pluck: "sine",     notes: 0.45, bass: "none",     drums: 0, cutoff: 2600 },
  dungeon: { bpm: 72,  root: 57, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 4], pad: "sawtooth", pluck: "triangle", notes: 0.32, bass: "slow",     drums: 0, cutoff: 1500 },
  deep:    { bpm: 64,  root: 52, scale: [0, 1, 3, 5, 7, 8, 10], chords: [0, 1, 0, 6], pad: "sawtooth", pluck: "triangle", notes: 0.24, bass: "slow",     drums: 0, cutoff: 1000 },
  boss:    { bpm: 104, root: 50, scale: [0, 2, 3, 5, 7, 8, 11], chords: [0, 0, 5, 4], pad: "sawtooth", pluck: "square",   notes: 0.6,  bass: "ostinato", drums: 1, cutoff: 3200 },
};
const VOLUME = 0.6;
// The flat path pushes the band into the crusher hard (or the quiet notes would round down to
// nothing), then turns the result back down to sit about as loud as the deep sound.
const CRUSH_DRIVE = 3.5, FLAT_LEVEL = 0.9;

let ctx = null, out = null;   // see buildGraph
const st = {
  mood: "temple", want: "temple", intensity: 0, flat: 1, depth: 0, silent: false,
  muted: !savedSwitch("rotation-cube-music"), nextTime: 0, step: 0, last: 7,
};

export const musicMuted = () => st.muted;

// Once there's sound: build the band's sound chain and start the sequencer.
onAudioReady((ac) => {
  ctx = ac;
  out = buildGraph(ctx, ctx.destination);
  out.master.gain.value = st.muted ? 0 : VOLUME;
  setFlat(out, st.flat, 0.01);
  st.nextTime = ctx.currentTime + 0.1;
  setInterval(schedule, 25);
});

export function toggleMusic() {
  st.muted = !st.muted;
  saveSwitch("rotation-cube-music", !st.muted);
  if (out) out.master.gain.setTargetAtTime(st.muted || st.silent ? 0 : VOLUME, ctx.currentTime, 0.2);
  return !st.muted;
}

// Once a frame: what should be playing, how tense, how flat.
export function updateMusic(game) {
  const f = game.zone, p = game.player;
  let chasing = 0, bossAwake = false;
  for (const m of f?.monsters || []) {
    if (m.state !== "chase" || Math.hypot(m.x - p.x, m.y - p.y) > 14) continue;
    chasing++;
    if (m.type === "lich" || m.guardian) bossAwake = true;   // the Lich King, or a guardian
  }
  // The surface (the temple, for now) plays the temple mood; deep levels sound murkier. WS3: moods by region.
  const surface = !f || f.type === "surface", level = f ? f.level : 0;
  st.want = game.mode === "won" || surface ? "temple" : bossAwake ? "boss" : level >= 12 ? "deep" : "dungeon";
  st.intensity += ((Math.min(1, chasing / 3)) - st.intensity) * 0.02;
  st.depth = surface ? 0 : level;
  const flat = !game.story.cube || game.view === "map" ? 1 : 0;
  const silent = game.mode === "dead";
  if (!out) { st.flat = flat; st.silent = silent; return; }
  if (flat !== st.flat) { st.flat = flat; setFlat(out, flat, 0.25); }
  if (silent !== st.silent) {
    st.silent = silent;
    out.master.gain.setTargetAtTime(silent || st.muted ? 0 : VOLUME, ctx.currentTime, silent ? 1.2 : 0.5);
  }
}

// Cross-fade between the flat and the deep sound (time: how slowly, in seconds).
function setFlat(o, flat, time) {
  const t = o.ac.currentTime;
  o.flatGain.gain.setTargetAtTime(flat ? FLAT_LEVEL : 0.0001, t, time);
  o.deepGain.gain.setTargetAtTime(flat ? 0.0001 : 1, t, time);
  o.verbGain.gain.setTargetAtTime(flat ? 0.0001 : 0.45, t, time * 1.5);
}

// --- The sound chain ----------------------------------------------------------------------
//   band → bus ─┐                ┌→ mono → crush → high-pass → low-pass → flatGain ─┐
//               ├→ mix ─────────┼→ deepGain ────────────────────────────────────────┼→ master → compressor → speakers
//   (the flat path's "mono" also drives the signal into the crusher: CRUSH_DRIVE)
//   fanfare → theme ┘            └→ reverb → verbGain ──────────────────────────────┘
// The flat path is the "2D" sound: one channel, coarse steps, only a narrow band of pitches.
export function buildGraph(ac, destination) {
  const master = ac.createGain();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp).connect(destination);

  const mix = ac.createGain();
  const bus = ac.createGain(), theme = ac.createGain();
  theme.gain.value = 1.3;
  bus.connect(mix); theme.connect(mix);

  const mono = ac.createGain();
  mono.gain.value = CRUSH_DRIVE;
  mono.channelCount = 1; mono.channelCountMode = "explicit"; mono.channelInterpretation = "speakers";
  const crush = ac.createWaveShaper();
  crush.curve = steps(10);
  const thin = ac.createBiquadFilter();
  thin.type = "highpass"; thin.frequency.value = 380; thin.Q.value = 0.6;
  const flat = ac.createBiquadFilter();
  flat.type = "lowpass"; flat.frequency.value = 1700; flat.Q.value = 0.7;
  const flatGain = ac.createGain();
  mix.connect(mono).connect(crush).connect(thin).connect(flat).connect(flatGain).connect(master);

  const deepGain = ac.createGain();
  mix.connect(deepGain).connect(master);
  const reverb = ac.createConvolver();
  reverb.buffer = impulse(ac, 3.2);
  const verbGain = ac.createGain();
  mix.connect(reverb).connect(verbGain).connect(master);
  return { master, bus, theme, flatGain, deepGain, verbGain, ac };
}

// A staircase transfer curve: rounds every sample to one of a few levels (a "bit crusher").
function steps(levels) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.round(x * levels) / levels;
  }
  return curve;
}

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// --- The sequencer --------------------------------------------------------------------------
// Steps are sixteenth notes; a bar is 16 steps; the chord changes every two bars. Notes are
// scheduled a little ahead of time so they land exactly on the beat.
function schedule() {
  if (!ctx || ctx.state !== "running") return;
  while (st.nextTime < ctx.currentTime + 0.12) {
    playStep(out, st, st.nextTime);
    st.nextTime += 60 / MOODS[st.mood].bpm / 4;
  }
}

export function playStep(o, s, t) {
  if (s.step % 16 === 0 && s.want !== s.mood) { s.mood = s.want; s.step = 0; }   // change mood on a bar line
  const m = MOODS[s.mood];
  const step = s.step % 32, bar = Math.floor(s.step / 32) % m.chords.length;
  const degree = m.chords[bar];
  const darker = Math.max(0.45, 1 - s.depth / 40);   // deeper floors sound murkier
  const note = (deg, octave = 0) => m.root + 12 * (octave + Math.floor(deg / m.scale.length)) + m.scale[((deg % m.scale.length) + m.scale.length) % m.scale.length];
  const flat = s.flat >= 0.5;
  const width = flat ? 0 : 1;
  const beat = 60 / m.bpm;

  // The pad: the chord, held for two bars. (The flat band has no pad: just the notes.)
  if (step === 0 && !flat) pad(o, [note(degree, -1), note(degree + 2, -1), note(degree + 4, -1)], t, beat * 8, m.pad, m.cutoff * darker);

  // The bass (a plain square wave in the flat band).
  const bw = flat ? "square" : "sine";
  if (m.bass === "slow" && (step === 0 || (step === 16 && Math.random() < 0.6))) bass(o, hz(note(degree, -2)), t, beat * 3.5, 0.22, bw);
  if (m.bass === "ostinato" && step % 2 === 0) bass(o, hz(note(degree + (step % 8 === 6 ? 4 : 0), -2)), t, beat * 0.45, 0.2, bw);
  if (m.bass !== "ostinato" && s.intensity > 0.3 && step % 4 === 0) bass(o, hz(note(degree, -2)), t, beat * 0.4, 0.12 * s.intensity, bw);   // danger: a pulse

  // Plucks: a random walk over the scale, mostly on eighth notes. Flat: square-wave blips.
  if (step % 2 === 0 && Math.random() < m.notes * (0.7 + 0.6 * s.intensity)) {
    s.last = Math.max(4, Math.min(16, s.last + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
    const deg = Math.random() < 0.35 ? degree + [0, 2, 4][Math.floor(Math.random() * 3)] + 7 : s.last;
    const len = flat ? beat * 0.5 : beat * (Math.random() < 0.3 ? 2 : 1);
    pluck(o, hz(note(deg)), t, len, (Math.random() * 2 - 1) * 0.7 * width, flat ? "square" : m.pluck, flat ? 0.16 : 0.09);
  }

  // Drums: in the boss fight, or quietly when you're being hunted.
  const drums = Math.max(m.drums, s.intensity > 0.5 ? (s.intensity - 0.5) * 1.2 : 0);
  if (drums > 0.05) {
    if (step % 8 === 0) kick(o, t, 0.5 * drums);
    if (step % 4 === 2) hat(o, t, 0.06 * drums, 0.3 * width);
    if (m.drums && step % 16 === 12) hat(o, t, 0.12, -0.3 * width, 0.25);
  }
  s.step++;
}

// --- The cube's fanfare ----------------------------------------------------------------------------
// D major: I – vi – IV – V, a beat of timpani on each, arpeggios climbing over them, a cymbal
// swelling up into the last chord: a big, wide D major that rings on while the story goes on.
// It starts flat (the only way you've ever heard anything) and opens up into the deep sound
// as the camera swings down into the world.
export function playCubeTheme(o = out) {
  if (!o) return;
  const ac = o.ac, t0 = ac.currentTime + 0.05;
  o.bus.gain.setTargetAtTime(0.0001, t0, 0.2);   // the band steps aside...
  o.bus.gain.setTargetAtTime(1, t0 + 9, 1.5);    // ...and comes back in afterwards
  st.flat = 0;
  setFlat(o, 1, 0.01);
  o.flatGain.gain.setTargetAtTime(0.0001, t0 + 0.6, 0.9);
  o.deepGain.gain.setTargetAtTime(1, t0 + 0.6, 0.9);
  o.verbGain.gain.setTargetAtTime(0.5, t0 + 0.6, 1.4);

  const dest = o.theme, chordLen = 0.95;
  const progression = [[50, [0, 4, 7]], [47, [0, 3, 7]], [43, [0, 4, 7]], [45, [0, 4, 7, 10]]];
  progression.forEach(([root, tones], k) => {
    const t = t0 + k * chordLen;
    timpani(o, dest, root - 12, t, 0.55 + k * 0.08);
    swell(o, dest, [root, ...tones.map((s) => root + 12 + s), root + 24 + tones[1]], t, chordLen + 0.3, 400 + k * 900, 0.05 + k * 0.01);
    for (let i = 0; i < 8; i++) {   // the arpeggio climbs two octaves over each chord
      const n = root + 24 + tones[i % tones.length] + 12 * Math.floor(i / tones.length);
      pluck(o, hz(n), t + i * (chordLen / 8), 0.35, i % 2 ? 0.6 : -0.6, "triangle", 0.1 + k * 0.02, dest);
    }
  });
  // The cymbal swells up into the arrival.
  const arrive = t0 + progression.length * chordLen;
  noiseTo(o, dest, arrive - 1.6, 1.6, 0.0001, 0.12, 6000);
  noiseTo(o, dest, arrive, 3, 0.18, 0.0001, 5000);
  timpani(o, dest, 38, arrive, 0.9);
  swell(o, dest, [38, 50, 57, 62, 66, 69, 74, 76, 78], arrive, 5.5, 5000, 0.07, 0.25);
  for (const [k, n] of [86, 90, 93, 98].entries()) pluck(o, hz(n), arrive + 0.15 + k * 0.12, 3, (k - 1.5) * 0.4, "sine", 0.12, dest);
}

// --- Instruments --------------------------------------------------------------------------------
// One note's volume: swell up over `attack`, hold until `hold` (if given), then die away by `dur`.
function voice(o, t, dur, attack, peak, pan, hold = 0, dest = o.bus) {
  const ac = o.ac, g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  if (hold > attack) g.gain.setValueAtTime(peak, t + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = ac.createStereoPanner();
  p.pan.value = pan;
  g.connect(p).connect(dest);
  return g;
}

function pluck(o, freq, t, dur, pan, wave, vol, dest = o.bus) {
  const osc = o.ac.createOscillator();
  osc.type = wave; osc.frequency.value = freq;
  const lp = o.ac.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.setValueAtTime(freq * 6, t); lp.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
  osc.connect(lp).connect(voice(o, t, dur + 0.3, 0.008, wave === "square" ? vol * 0.5 : vol, pan, 0, dest));
  osc.start(t); osc.stop(t + dur + 0.35);
}

function pad(o, notes, t, dur, wave, cutoff) {
  const lp = o.ac.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = cutoff * 0.5; lp.Q.value = 0.7;
  lp.connect(voice(o, t, dur + 1.5, 1.6, 0.05, 0, dur));
  for (const n of notes)
    for (const detune of [-7, 7]) {
      const osc = o.ac.createOscillator();
      osc.type = wave; osc.frequency.value = hz(n); osc.detune.value = detune;
      osc.connect(lp);
      osc.start(t); osc.stop(t + dur + 1.6);
    }
}

// A big, bright chord for the fanfare: detuned saws across several octaves, its filter opening.
function swell(o, dest, notes, t, dur, cutoff, vol, attack = 0.15) {
  const ac = o.ac;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass"; lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(cutoff * 0.4, t);
  lp.frequency.exponentialRampToValueAtTime(cutoff, t + Math.min(dur, 1.2));
  lp.connect(voice(o, t, dur, attack, vol, 0, dur * 0.6, dest));
  for (const n of notes)
    for (const detune of [-9, 0, 9]) {
      const osc = ac.createOscillator();
      osc.type = "sawtooth"; osc.frequency.value = hz(n); osc.detune.value = detune;
      osc.connect(lp);
      osc.start(t); osc.stop(t + dur + 0.1);
    }
}

function timpani(o, dest, midi, t, vol) {
  const osc = o.ac.createOscillator();
  osc.frequency.setValueAtTime(hz(midi) * 1.6, t);
  osc.frequency.exponentialRampToValueAtTime(hz(midi), t + 0.12);
  osc.connect(voice(o, t, 1.2, 0.004, vol, 0, 0, dest));
  osc.start(t); osc.stop(t + 1.25);
}

// Filtered noise fading from one level to another: a cymbal swell, or a crash dying away.
function noiseTo(o, dest, t, dur, from, to, freq) {
  const src = o.ac.createBufferSource();
  src.buffer = noiseBuffer(o.ac);
  src.loop = true;
  const hp = o.ac.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = freq;
  const g = o.ac.createGain();
  g.gain.setValueAtTime(Math.max(from, 0.0001), t);
  g.gain.exponentialRampToValueAtTime(Math.max(to, 0.0001), t + dur);
  src.connect(hp).connect(g).connect(dest);
  src.start(t); src.stop(t + dur + 0.05);
}

function bass(o, freq, t, dur, vol, wave = "sine") {
  const osc = o.ac.createOscillator();
  osc.type = wave; osc.frequency.value = freq;
  const sub = o.ac.createOscillator();
  sub.type = "triangle"; sub.frequency.value = freq;
  const g = voice(o, t, dur, 0.02, wave === "square" ? vol * 0.45 : vol, 0);
  osc.connect(g); sub.connect(g);
  for (const x of [osc, sub]) { x.start(t); x.stop(t + dur + 0.05); }
}

function kick(o, t, vol) {
  const osc = o.ac.createOscillator();
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.16);
  osc.connect(voice(o, t, 0.3, 0.003, vol, 0));
  osc.start(t); osc.stop(t + 0.32);
}

let noise = null;
function noiseBuffer(ac) {
  if (!noise || noise.sampleRate !== ac.sampleRate) {
    noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function hat(o, t, vol, pan, dur = 0.06) {
  const src = o.ac.createBufferSource();
  src.buffer = noiseBuffer(o.ac);
  const hp = o.ac.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 7000;
  src.connect(hp).connect(voice(o, t, dur, 0.002, vol, pan));
  src.start(t); src.stop(t + dur + 0.02);
}
