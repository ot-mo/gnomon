// The Chandler Houses' banks and the money's words (bible §3.1; content/currency.js CURRENCY.banks, bankFee, lines;
// C2 #13; B3). The Houses bank at Molar, Halfnight and Benchmark (landmark letters F, H, D): a Chandler there, or a
// trader there, takes your glim (keeping CURRENCY.bankFee, 5 in every 100, for the writing) and pours it back when you
// ask, to the drop, as far as your flask holds. Anywhere else a Chandler says CURRENCY.lines.noBank. The account is
// one, at all three Houses: game.state.bank (whole glim, JSON).
//
//   bankHere(game) → landmark letter | null       one of CURRENCY.banks where you stand
//   deposit(game, n) → { ok, line }  withdraw(game, n) → { ok, line }
import { registerTalkOptions, node, bye } from "../talk.js";
import { FACTIONS, membershipsOf, attitude } from "../factions.js";
import { standingOf } from "./builders.js";
import { CURRENCY } from "../content/currency.js";
import { LANDMARK_INDEX } from "../content/world/worldmap.js";
import { pay, receive, funds, formatPrice } from "../currency.js";
import { landmarkHere } from "./places.js";
import { isMerchant } from "./merchants.js";

const LETTER = new Map(LANDMARK_INDEX.map((l) => [l.id, l.letter]));
export function bankHere(game) {
  const L = landmarkHere(game), letter = L && LETTER.get(L.id);
  return letter && CURRENCY.banks.includes(letter) ? letter : null;
}
export const balance = (game) => game.state?.bank || 0;

export function deposit(game, n) {
  const p = game.player, amt = Math.min(Math.floor(n), funds(p));
  if (!(amt > 0)) return { ok: false, line: "You have nothing to put in." };
  const fee = Math.ceil(amt * CURRENCY.bankFee);
  pay(game, p, amt);
  game.state.bank = balance(game) + amt - fee;
  return { ok: true, line: `${CURRENCY.lines.deposit} (${formatPrice(amt)} in, ${formatPrice(fee)} kept; the House holds ${formatPrice(game.state.bank)})` };
}
export function withdraw(game, n) {
  const p = game.player, amt = Math.min(Math.floor(n), balance(game));
  if (!(amt > 0)) return { ok: false, line: "The House holds nothing of yours." };
  const over = receive(game, p, amt), got = amt - over;
  if (!got) return { ok: false, line: CURRENCY.lines.overflow };
  game.state.bank = balance(game) - got;
  return { ok: true, line: `${CURRENCY.lines.withdraw} (+${formatPrice(got)}; the House holds ${formatPrice(game.state.bank)})` };
}

const chandler = (c) => membershipsOf(c).some(([f]) => f === "chandlers");
registerTalkOptions("bank", (game, c) => {
  if (!game.state || !FACTIONS.chandlers) return null;
  const here = bankHere(game);
  if (!chandler(c) && !(here && isMerchant(c))) return null;
  if (standingOf(game, c).band === "hated" || attitude(game, c, game.player) === "hostile") return null;   // (at Dark: one goodbye)
  if (!here) return [{ label: "Do the Houses bank here?", go: () => node(CURRENCY.lines.noBank, [bye()]) }];
  const step = (label, fn) => ({ label, go: () => { const out = fn(); game.log(out.line, out.ok ? [255, 220, 120] : [200, 190, 170]); return bankNode(); } });
  const bankNode = () => node(`The House holds ${formatPrice(balance(game))} of yours. Your flask holds ${formatPrice(funds(game.player))}.`, [
    step("Put in 50.", () => deposit(game, 50)), step("Put in everything.", () => deposit(game, funds(game.player))),
    step("Take out 50.", () => withdraw(game, 50)), step("Take out everything.", () => withdraw(game, balance(game))), bye()]);
  return [{ label: "I'd like to bank with the House.", go: bankNode }];
});
