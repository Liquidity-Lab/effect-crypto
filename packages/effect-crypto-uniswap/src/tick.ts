import { BigDecimal } from "bigdecimal.js";
import { Brand, Option } from "effect";
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

/**
 * Represents a tick that is guaranteed to be usable within a Uniswap V3 pool.
 * A usable tick is one that:
 * 1. Is within the valid tick range (MIN_TICK to MAX_TICK)
 * 2. Is properly spaced according to the pool's fee tier (tick % spacing === 0)
 * 3. Contains the spacing information itself.
 */
export interface UsableTick {
  readonly _tag: "@liquidity_lab/effect-crypto-uniswap/tick#UsableTick";
  readonly unwrap: Tick; // The actual tick number (e.g., 120)
  readonly spacing: TickSpacing; // The tick spacing used (e.g., 60)
}

/**
 * Creates a new UsableTick from a tick and its spacing.
 * If the provided tick is not perfectly aligned with the spacing,
 * it will be adjusted to the nearest usable tick.
 *
 * @example
 * ```typescript
 * import { FeeAmount, Tick } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const tick = Tick.Tick(105);
 * const spacing = Tick.toTickSpacing(FeeAmount.MEDIUM); // 60
 * const usableTick = Tick.UsableTick(tick, spacing); // Creates UsableTick with unwrap: 120
 * console.log(usableTick.unwrap); // Output: 120
 *
 * const alreadyUsableTick = Tick.Tick(120);
 * const usableTick2 = Tick.UsableTick(alreadyUsableTick, spacing);
 * console.log(usableTick2.unwrap); // Output: 120
 * ```
 * @constructor
 */
export const UsableTick: {
  (tick: Tick, spacing: TickSpacing): UsableTick;
} = internal.makeUsableTick;

/**
 * Adds N steps (each step is `spacing` wide) to a UsableTick while maintaining proper spacing.
 * Returns None if the resulting tick would be outside the valid range [MIN_TICK, MAX_TICK].
 *
 * @example
 * ```typescript
 * import { FeeAmount, Tick } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const tick = Tick.Tick(120);
 * const spacing = Tick.toTickSpacing(Adt.FeeAmount.MEDIUM); // 60
 * const usableTick = Tick.makeUsableTick(tick, spacing);
 * const nextTick = Tick.addNTicks(usableTick, 1); // Some({ _tag: 'UsableTick', tick: 180, spacing: 60 })
 * const farTick = Tick.addNTicks(usableTick, 10000); // Some({...})
 * const tooFarTick = Tick.addNTicks(usableTick, 100000); // None (would exceed MAX_TICK)
 * ```
 */
export const addNTicks: {
  (usableTick: UsableTick, n: number): Option.Option<UsableTick>;
} = internal.addNTicksImpl;

/**
 * Subtracts N steps (each step is `spacing` wide) from a UsableTick while maintaining proper spacing.
 * Returns None if the resulting tick would be outside the valid range [MIN_TICK, MAX_TICK].
 *
 * @example
 * ```typescript
 * import { FeeAmount, Tick } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const tick = Tick.Tick(120);
 * const spacing = Tick.toTickSpacing(Adt.FeeAmount.MEDIUM); // 60
 * const usableTick = Tick.makeUsableTick(tick, spacing);
 * const prevTick = Tick.subtractNTicks(usableTick, 1); // Some({ _tag: 'UsableTick', tick: 60, spacing: 60 })
 * const farTick = Tick.subtractNTicks(usableTick, 10000); // Some({...})
 * const tooFarTick = Tick.subtractNTicks(usableTick, 100000); // None (would exceed MIN_TICK)
 * ```
 */
export const subtractNTicks: {
  (usableTick: UsableTick, n: number): Option.Option<UsableTick>;
} = internal.subtractNTicksImpl;

/**
 * Calculates the distance between two ticks in terms of the specified tick spacing units.
 *
 * This function first determines the nearest usable ticks for both input ticks based on the provided spacing.
 * It then computes the difference between these usable ticks and divides by the spacing to find the distance.
 * The result represents how many 'steps' of size `spacing` are between `tick1` and `tick2`.
 *
 * @param tick1 The first tick.
 * @param tick2 The second tick.
 * @param spacing The tick spacing to use for determining usable ticks and calculating the distance.
 * @returns The integer distance between the nearest usable ticks corresponding to tick1 and tick2, measured in units of spacing.
 *
 * @example
 * ```typescript
 * import { FeeAmount, Tick } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const tickA = Tick.Tick(105); // Nearest usable tick for MEDIUM spacing (60) is 120
 * const tickB = Tick.Tick(250); // Nearest usable tick for MEDIUM spacing (60) is 240
 * const spacing = Tick.toTickSpacing(FeeAmount.MEDIUM); // 60
 *
 * // Calculate distance from tickA to tickB
 * const distance = Tick.subtract(tickA, tickB, spacing);
 * console.log(distance); // Output: -2 (because 120 - 240 = -120, and -120 / 60 = -2)
 *
 * // Calculate distance from tickB to tickA
 * const distanceReverse = Tick.subtract(tickB, tickA, spacing);
 * console.log(distanceReverse); // Output: 2 (because 240 - 120 = 120, and 120 / 60 = 2)
 * ```
 */
export const subtract: {
  (tick1: Tick, tick2: Tick, spacing: TickSpacing): number;
} = internal.subtractImpl;
