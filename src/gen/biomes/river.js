// River spans (bible §4.4): the Slake's grey-green water, the Inkrun's ink; reeds along the banks.
import { dress } from "./common.js";
import { reedsByWater } from "./flats.js";

export default function river(ctx) {
  dress(ctx);
  reedsByWater(ctx, ["reeds"], 0.12);
}
