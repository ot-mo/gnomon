// Voices (TECH_DESIGN §1.2 sfx.js "speakLetter(ch, voice) takes a voice object", §4.2 `talk`; §1.4 "social
// (WS6a/6b)"; owner WS6b). A P0 stub with the frozen signature.
//
//   voiceFor(c) → voice      from the creature's species and faction; sfx.js speakLetter plays it
//
// The voice object's shape is left to WS6b (sfx.js still takes the parent's voice ids). Until WS6b builds it,
// voiceFor gives null: no voice of its own, so the talk screen keeps today's voices.
// Remove STUB when the file is built.
export const STUB = "WS6b";

export function voiceFor(c) { return null; }
