// The journal's data (TECH_DESIGN §2.14 game.state.journal = { secrets: { [id]: { learned, source, sold } },
// notes: [], order: { history: [ids by year] } }, §4.2 `journal`; owner WS7): what the journal screen's tabs
// (Quests · Locations · Histories, n of m known · Gossip · Notes) read. Plain JSON in game.state (R5), so a save
// carries it; the screen is screens/journal.js, the secrets themselves story/secrets.js.
//
//   journalOf(game) → state.journal     made on first use, with every field: { secrets, notes, order: { history },
//                                       triangulated: { [eventId]: time }, cultPass: { [rulerId]: time } }
//   knows(game, id) → bool              the secret is learned
//   addNote(game, text, ref = null)     a line in Notes: { at: game time, text, ref }
export function journalOf(game) {
  const st = game.state || (game.state = {});
  const J = (st.journal ||= {});
  J.secrets ||= {};
  J.notes ||= [];
  J.order ||= {};
  J.order.history ||= [];
  J.triangulated ||= {};
  J.cultPass ||= {};
  return J;
}

export const knows = (game, id) => !!game.state?.journal?.secrets?.[id];

export function addNote(game, text, ref = null) {
  journalOf(game).notes.push({ at: game.time || 0, text, ref });
}
