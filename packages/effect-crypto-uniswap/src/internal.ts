import { MathContext, RoundingMode } from "bigdecimal.js";

/** @internal */
export const mathContext = new MathContext(192, RoundingMode.HALF_UP);
