import { BigDecimal } from "bigdecimal.js";
import { Brand } from "effect";
import { Arbitrary } from "fast-check";

import { Token } from "@liquidity_lab/effect-crypto";

import * as Adt from "./adt.js";
import * as Price from "./price.js";
import * as internal from "./tick.internal.js";

/**
 * The tick represents a specific price point in a Uniswap V3 pool.
 *
 * Ticks are used to define the price range in which liquidity is provided.
 * The price for a pool at a given tick is calculated using the formula:
 * price = 1.0001^tick
 *
 * Each tick represents a 0.01% (1 basis point) price difference.
 *
 * @see {@link https://docs.uniswap.org/concepts/protocol/concentrated-liquidity#ticks}
 * @see {@link https://docs.uniswap.org/protocol/concepts/v3-overview/tick-intervals}
 */
export type Tick = Brand.Branded<number, internal.TickTypeId>;

/**
 * Constructor and utility namespace for Tick values.
 *
 * Provides functionality to:
 * - Create new Tick values
 * - Access minimum/maximum tick boundaries
 * - Generate arbitrary ticks for testing
 *
 * @example
 *  ```typescript
 *  // Create a new tick
 *  const tick = Tick(10)
 *
 *  // Access boundaries
 *  const minTick = Tick.MIN // -887272
 *  const maxTick = Tick.MAX // 887272
 *
 *  // Generate random ticks for testing
 *  const arbitraryTick = Tick.gen.sample()
 *  ```
 *
 * The minimum and maximum tick values correspond to the price range that can be
 * represented in an Uniswap V3 pool, from 2^(-128) to 2^128.
 */
export const Tick: Brand.Brand.Constructor<Tick> & {
  MIN: Tick;
  MAX: Tick;
  gen: Arbitrary<Tick>;
} = Object.assign(internal.makeTick, {
  MAX: internal.MAX_TICK,
  MIN: internal.MIN_TICK,
  gen: internal.tickGen(),
});

/**
 * Represents the spacing between ticks in an Uniswap V3 pool.
 * Different fee tiers have different tick spacings to ensure a balance between capital efficiency and gas costs.
 *
 * @see {@link https://docs.uniswap.org/concepts/protocol/fees#tick-spacing}
 */
export type TickSpacing = Brand.Branded<number, "TickSpacing">;

/**
 * The square root of the ratio corresponding to the minimum tick (-887272).
 * This represents the minimum price ratio that can be used in any Uniswap V3 pool.
 *
 * @see {@link https://docs.uniswap.org/protocol/reference/core/libraries/TickMath}
 */
export const MIN_SQRT_RATIO: BigDecimal = internal.MIN_SQRT_RATIO;

/**
 * The square root of the ratio corresponding to the maximum tick (887272).
 * This represents the maximum price ratio that can be used in any Uniswap V3 pool.
 *
 * @see {@link https://docs.uniswap.org/protocol/reference/core/libraries/TickMath}
 */
export const MAX_SQRT_RATIO: BigDecimal = internal.MAX_SQRT_RATIO;

/**
 * Calculates the price ratio for a given tick using the formula: 1.0001^tick
 *
 * @example
 *   ```typescript
 *   const tick = Tick(100)
 *   const ratio = getRatio(tick) // Returns BigDecimal representing 1.0001^100
 *   ```
 *
 * @see {@link https://docs.uniswap.org/concepts/protocol/concentrated-liquidity#ticks}
 */
export const getRatio: {
  (tick: Tick): BigDecimal;
} = internal.getRatio;

/**
 * Calculates the square root of the price ratio for a given tick using the formula: sqrt(1.0001^tick)
 * This value is used in the core swap calculations.
 *
 * @example
 *   ```typescript
 *   const tick = Tick(100)
 *   const sqrtRatio = getSqrtRatio(tick) // Returns sqrt(1.0001^100)
 *   ```
 *
 * @see {@link https://docs.uniswap.org/protocol/reference/core/libraries/TickMath#getstar}
 */
export const getSqrtRatio: {
  (tick: Tick): BigDecimal;
} = internal.getSqrtRatioAtTickImpl;

/**
 * Calculates the tick index for a given square root price ratio.
 * This is the inverse operation of getSqrtRatio.
 *
 * @example
 *   ```typescript
 *   const ratio = new BigDecimal("1.0001")
 *   const tick = getTickAtRatio(ratio) // Returns closest tick for the given ratio
 *   ```
 *
 * @see {@link https://docs.uniswap.org/protocol/reference/core/libraries/TickMath#gettickatsqrtratio}
 */
export const getTickAtRatio: {
  (ratio: BigDecimal): Tick;
} = internal.getTickAtRatioImpl;

export const getTickAtPrice: {
  <T extends Token.TokenType>(price: Price.TokenPrice<T>): Tick;
} = internal.getTickAtPriceImpl;

/**
 * Returns the closest tick that is usable for the given tick spacing.
 * Used to ensure that ticks are properly spaced according to the pool's fee tier.
 *
 * @example
 *   ```typescript
 *   const tick = Tick(105)
 *   const spacing = toTickSpacing(FeeAmount.MEDIUM) // 60
 *   const nearest = nearestUsableTick(tick, spacing) // Returns 120
 *   ```
 *
 * @see {@link https://docs.uniswap.org/concepts/protocol/fees#tick-spacing}
 */
export const nearestUsableTick: {
  (tick: Tick, tickSpacing: TickSpacing): Tick;
} = internal.nearestUsableTick;

/**
 * Converts a fee amount to its corresponding tick spacing.
 * Each fee tier has a different tick spacing to optimize for gas costs vs price granularity.
 *
 * @example
 *   ```typescript
 *   const spacing = toTickSpacing(FeeAmount.LOW) // Returns 10
 *   // FeeAmount.LOWEST -> 1
 *   // FeeAmount.LOW -> 10
 *   // FeeAmount.MEDIUM -> 60
 *   // FeeAmount.HIGH -> 200
 *   ```
 *
 * @see {@link https://docs.uniswap.org/concepts/protocol/fees#tick-spacing}
 */
export const toTickSpacing: {
  (feeAmount: Adt.FeeAmount): TickSpacing;
} = internal.toTickSpacing;
