// The money (TECH_DESIGN §2.10, with DECISIONS.md and bible §3.1, §15.6): glim, lamp oil, kept as a
// plain counter. It shows as "$" in the old gold colour. There is no liquid backing, no containers and
// no thirst. P0 fixture: 0B's currency.js (funds, pay, receive, formatPrice) reads it.
export const CURRENCY = {
  id: "glim", name: "glim", plural: "glim", unit: "glim", glyph: "$", color: [255, 210, 70],
  backing: { kind: "counter" },
  purses: [200, 500, 1000],   // the purse is the lamp-flask: 200 at the start, larger flasks hold 500 or 1,000
  startPurse: 200,
  bankFee: 0.05,              // the Chandler Houses take 5% of each deposit
};
