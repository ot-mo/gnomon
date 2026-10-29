// The money (TECH_DESIGN §2.10, with DECISIONS.md and bible §3.1, §15.6): glim, lamp oil, kept as a
// plain counter. It shows as "$" in the old gold colour. There is no liquid backing, no containers and
// no thirst. P0 fixture: 0B's currency.js (funds, pay, receive, formatPrice) reads it.
//
// C2 adds the money's words and the bible's reference numbers (none of them read by code yet: integration requests in
// docs/c2.md; the numbers the game runs on live in RULES and the item tables, and the balance phase holds them to these):
//   about     what glim is, in the plain register (§3.1)
//   flasks    the purse sizes as things you buy: the lamp-flask you start with, and the two larger ones (§3.1's anchors)
//   banks     the Chandler Houses' banks (§3.1: Molar, Halfnight and Benchmark, by landmark letter), and bankFee
//   lines     what is said when a payment would overflow the flask, when the purse is dry, and at a bank
//   anchors   §3.1's price anchors (base values, before the buy and sell factors), and its sources: a quest's
//             25 × tier, a floor's piles 10 + 4 × tier, drops, the commons lamp's 5 a day. Money is never plentiful.
export const CURRENCY = {
  id: "glim", name: "glim", plural: "glim", unit: "glim", glyph: "$", color: [255, 210, 70],
  backing: { kind: "counter" },
  purses: [200, 500, 1000],   // the purse is the lamp-flask: 200 at the start, larger flasks hold 500 or 1,000
  startPurse: 200,
  bankFee: 0.05,              // the Chandler Houses take 5% of each deposit
  about: "Glim is lamp oil, and the money of the Dial: one glim is a thimble of it. The best of everything lies underground, " +
    "in the dark, so everyone needs light, and the oil became money. It is pressed from glimseed, rendered from tallow, or " +
    "drained from Deepwright cells; the clear kind is pressed from something nobody asks about.",
  flasks: [
    { size: 200, name: "a lamp-flask", price: 0, text: "Your purse and your lamp's fuel, in one tin. It holds 200 glim and a smell that never washes out." },
    { size: 500, name: "a 500-glim flask", price: 150, text: "A deeper flask. Holds 500 glim, and slightly more opinions about it." },
    { size: 1000, name: "a 1,000-glim flask", price: 450, text: "A Chandler's flask, stamped by a House. Holds 1,000 glim. People notice it." },
  ],
  banks: ["F", "H", "D"],
  lines: {
    overflow: "Your flask won't hold that much. Take goods instead, or take less.",
    empty: "Your purse is dry. The torch gutters to a flicker. It won't go out; it just won't help much.",
    deposit: "The House takes your glim, writes it down twice, and keeps five in every hundred for the writing.",
    withdraw: "The clerk pours it back into your flask, to the drop. Houses don't spill.",
    noBank: "No House banks here. The Chandlers keep their ledgers at Molar, Halfnight and Benchmark.",
  },
  anchors: {
    prices: { throwingKnife: 8, bomb: 20, balmTonic: 25, copperShortSword: 40, ironLongsword: 120, flask500: 150, flask1000: 450,
      innNight: 10, homingPip: 300, implant: [400, 2000], cradleFitting: "25 × the implant's cost", clearGlim: 5 },
    sources: { questPerTier: 25, floorPiles: { base: 10, perTier: 4 }, drops: { chance: 0.2, min: 1, max: 3, elitePerTier: 3 },
      commonsLampPerDay: 5, cellCharge: 100 },
    torch: { glim: 1, hours: 4 },
  },
};
