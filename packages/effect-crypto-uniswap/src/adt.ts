import { Brand } from "effect";
import { Branded } from "effect/Brand";
import { Arbitrary } from "fast-check";

import * as internal from "./adt.internal.js";
import {Big, BigDecimal} from "bigdecimal.js";

export { FeeAmount } from "./adt.internal.js";

/**
 * Amount0 is unscaled amount of token0
 */
export type Amount0 = Brand.Branded<BigDecimal, internal.Amount0TypeId>;
export const Amount0: Brand.Brand.Constructor<Amount0> & {
  gen(constraints?: { min?: Amount0; max?: Amount0 }): Arbitrary<Amount0>;
  zero: Amount0;
  max: Amount0;
} = Object.assign(internal.makeAmount0, {
  gen: internal.amount0Gen,
  zero: internal.makeAmount0(Big(0)),
  max: internal.MAX_AMOUNT_0,
});

export type Amount1 = Brand.Branded<BigDecimal, internal.Amount1TypeId>;
export const Amount1: Brand.Brand.Constructor<Amount1> & {
  gen(constraints?: { min?: Amount1; max?: Amount1 }): Arbitrary<Amount1>;
  zero: Amount1;
  max: Amount1;
} = Object.assign(internal.makeAmount1, {
  gen: internal.amount1Gen,
  zero: internal.makeAmount1(Big(0)),
  max: internal.MAX_AMOUNT_1,
});

function isTickValid(tickIdx: number, fee: number): boolean {
  let tickSpacing: number;

  switch (fee) {
    case 0.0005:
      tickSpacing = 1;
      break;
    case 0.003:
      tickSpacing = 60;
      break;
    case 0.01:
      tickSpacing = 200;
      break;
    default:
      throw new Error("Unsupported fee tier");
  }

  return tickIdx % tickSpacing === 0;
}

export const feeAmountGen: Arbitrary<internal.FeeAmount> = internal.feeAmountGen;
