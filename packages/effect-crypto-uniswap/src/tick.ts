import { BigDecimal } from "bigdecimal.js";
import { Brand } from "effect";

import * as Adt from "./adt.js";
import * as internal from "./tick.internal.js";

export type Tick = Brand.Branded<number, "Tick">; // TODO: encapsulate via symbol

/**
 * @constructor
 */
export const Tick: Brand.Brand.Constructor<Tick> & {
  MIN: Tick;
  MAX: Tick;
} = Object.assign(internal.makeTick, {
  MAX: internal.MAX_TICK,
  MIN: internal.MIN_TICK,
});

export type TickSpacing = Brand.Branded<number, "TickSpacing">;

/**
 * The sqrt ratio corresponding to the minimum tick that could be used on any pool.
 */
export const MIN_SQRT_RATIO: BigDecimal = internal.MIN_SQRT_RATIO;

/**
 * The sqrt ratio corresponding to the maximum tick that could be used on any pool.
 */
export const MAX_SQRT_RATIO: BigDecimal = internal.MAX_SQRT_RATIO;

export const getSqrtRatio: {
  (tick: Tick): BigDecimal; // TODO: compose it (sqrt) to branded type
} = internal.getSqrtRatioAtTickImpl;

export const getTickAtRatio: {
  (ratio: BigDecimal): Tick;
} = internal.getTickAtRatioImpl;

export const nearestUsableTick: {
  (tick: Tick, tickSpacing: TickSpacing): Tick;
} = internal.nearestUsableTick;

export const toTickSpacing: {
  (feeAmount: Adt.FeeAmount): TickSpacing;
} = internal.toTickSpacing;
