// Voices (TECH_DESIGN §1.2 sfx.js "speakLetter(ch, voice) takes a voice object", §4.2 `talk`; bible §15.4's "Voice
// (Hz, wave, flags)"; owner WS6b).
//
//   voiceFor(c) → voice      what dialogue.js hands sfx.js speakLetter for each letter c says:
//                            1. c.voice, its own (content may give a named creature one);
//                            2. its main faction's (its heaviest membership's FACTIONS[id].voice: { hz, wave, flags }),
//                               as { pitch, wave, thin, ghost, stone, flags }; a range of pitches ("430-560 Hz",
//                               the Flatfolk's: hz [430, 560]) gives each speaker its own, picked by its id;
//                            3. else its species: the type's id when sfx.js has a voice by that name (the legacy
//                               people: "pell", "brann", …), so the old game's voices stay exactly as they were;
//                            4. else null (sfx.js speaks it in its neutral voice).
//                            A faction whose voice is null (the Saltbeasts growl, they don't speak) falls to 3.
//
// sfx.js reads pitch, wave and the flags thin, ghost and stone (WS3's voiceOf); the other flags of bible §15.4
// (beat, vibrato, grit, tremolo, glide, doubled) ride along in `flags` for whoever plays them later.
import { FACTIONS, membershipsOf } from "../factions.js";
import { typeOf } from "../creatures.js";

// The parent game's voice names (sfx.js VOICES): a creature of one of these types speaks with it.
const SPECIES = new Set(["maren", "pell", "corwin", "brann", "mira", "rook", "lio", "ess", "tee", "door", "shrine"]);
const SFX_FLAGS = ["thin", "ghost", "stone"];

function mainFaction(c) {
  let best = null;
  for (const [id, w] of membershipsOf(c)) if (!best || w > best[1]) best = [id, w];
  return best?.[0] ?? null;
}

function fromFaction(c, v) {
  const flags = v.flags || [];
  let pitch = v.hz;
  if (Array.isArray(pitch)) {
    const [lo, hi] = pitch, k = Math.abs((c.id | 0) * 2654435761) % 1000 / 999;
    pitch = Math.round(lo + (hi - lo) * k);
  }
  const out = { pitch, wave: v.wave, flags: flags.filter((f) => !SFX_FLAGS.includes(f)) };
  for (const f of SFX_FLAGS) if (flags.includes(f)) out[f] = true;
  return out;
}

export function voiceFor(c) {
  if (!c) return null;
  if (c.voice && typeof c.voice === "object") return c.voice;
  const f = mainFaction(c), v = f ? FACTIONS[f]?.voice : null;
  if (v && v.hz) return fromFaction(c, v);
  const type = c.type ?? null;
  if (type && SPECIES.has(type)) return type;
  return typeOf(c)?.voice ?? null;
}
