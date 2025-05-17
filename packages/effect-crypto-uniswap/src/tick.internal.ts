import { Big, BigDecimal, MathContext, RoundingMode } from "bigdecimal.js";
import { Brand, Option } from "effect";
import { Arbitrary } from "fast-check";

import { fc } from "@fast-check/ava";
import { BigMath, Token } from "@liquidity_lab/effect-crypto";

import * as Adt from "./adt.js";
import * as Price from "./price.js";
import * as T from "./tick.js";

export type TickTypeId = "@liquidity_lab/effect-crypto-uniswap/tick#Tick";

const unsafeMakeTick = Brand.nominal<T.Tick>();

export const MIN_TICK: T.Tick = unsafeMakeTick(-887272);

export const MAX_TICK: T.Tick = unsafeMakeTick(-1 * MIN_TICK);

export const makeTick = Brand.all(
  Brand.refined<T.Tick>(
    (raw) => Number.isInteger(raw),
    (raw) => Brand.error(`tick should be integer: given[${raw}]`),
  ),
  Brand.refined<T.Tick>(
    (raw) => raw >= MIN_TICK,
    (raw) => Brand.error(`tick should be greater or equal MIN_TICK: given[${raw}] >= ${MIN_TICK}`),
  ),
  Brand.refined<T.Tick>(
    (raw) => raw <= MAX_TICK,
    (raw) => Brand.error(`tick should be less or equal MAX_TICK: given[${raw}] <= ${MAX_TICK}`),
  ),
);

export function tickGen(): Arbitrary<T.Tick> {
  return fc.integer({ min: MIN_TICK + 1, max: MAX_TICK - 1 }).map((value) => makeTick(value));
}

/**
 * Generates arbitrary UsableTick values for property-based testing.
 * It first selects a FeeAmount (and thus TickSpacing), then generates a raw Tick,
 * and finally creates a UsableTick using nearestUsableTick.
 *
 * @param feeAmountGen Optional arbitrary for FeeAmount. Defaults to Adt.feeAmountGen.
 * @returns An Arbitrary that generates UsableTick instances.
 * @internal
 */
export function usableTickGen(
  feeAmountGen: Arbitrary<Adt.FeeAmount> = Adt.feeAmountGen,
): Arbitrary<T.UsableTick> {
  return feeAmountGen.chain((feeAmount) => {
    const spacing = toTickSpacing(feeAmount);
    // Generate a raw tick first
    return tickGen().map((rawTick) => {
      // Ensure the generated tick is usable for the selected spacing
      return nearestUsableTick(rawTick, spacing);
    });
  });
}

const unsafeMakeTickSpacing = Brand.nominal<T.TickSpacing>();

/**
 * The default factory tick spacings by fee amount.
 */
const TICK_SPACINGS: { [amount in Adt.FeeAmount]: T.TickSpacing } = {
  [Adt.FeeAmount.LOWEST]: unsafeMakeTickSpacing(1),
  [Adt.FeeAmount.LOW]: unsafeMakeTickSpacing(10),
  [Adt.FeeAmount.MEDIUM]: unsafeMakeTickSpacing(60),
  [Adt.FeeAmount.HIGH]: unsafeMakeTickSpacing(200),
};

export function toTickSpacing(feeAmount: Adt.FeeAmount): T.TickSpacing {
  return TICK_SPACINGS[feeAmount];
}

const MATH_CONTEXT_HIGH_PRECISION = new MathContext(128, RoundingMode.HALF_UP);

const TICK_BASE = Big("1.0001", undefined, MATH_CONTEXT_HIGH_PRECISION);

export const MIN_SQRT_RATIO: BigDecimal = getSqrtRatioAtTickImpl(MIN_TICK);
export const MAX_SQRT_RATIO: BigDecimal = getSqrtRatioAtTickImpl(MAX_TICK);

/**
 * Calculates the ratio of the tick:
 * 1.0001 ^ tick
 */
export function getRatio(tick: T.Tick): BigDecimal {
  return TICK_BASE.pow(tick, MATH_CONTEXT_HIGH_PRECISION);
}

export function isUsableTickImpl(tick: unknown): tick is T.UsableTick {
  return (
    typeof tick === "object" &&
    tick !== null &&
    "_tag" in tick &&
    tick._tag === "@liquidity_lab/effect-crypto-uniswap/tick#UsableTick"
  );
}

/** Calculates sqrt(1.0001 ^ tick)
 * @see https://github.com/Uniswap/v3-core/blob/8f3e4645a08850d2335ead3d1a8d0c64fa44f222/contracts/libraries/TickMath.sol#L23-L54
 */
export function getSqrtRatioAtTickImpl(tick: T.Tick | T.UsableTick): BigDecimal {
  if (isUsableTickImpl(tick)) {
    return getSqrtRatioAtTickImpl(tick.unwrap);
  }

  return getRatio(tick).sqrt(MATH_CONTEXT_HIGH_PRECISION);
}

// Calculates log[1.0001, ratio] and round down the result
export function getTickAtRatioImpl(ratio: BigDecimal): T.Tick {
  // TODO: seems like BigDecimal in not a good type
  const rawTickIdx = BigMath.log(TICK_BASE, ratio, MATH_CONTEXT_HIGH_PRECISION);

  return makeTick(rawTickIdx.setScale(0, RoundingMode.FLOOR).numberValue());
}

export function getTickAtPriceImpl<T extends Token.TokenType>(price: Price.TokenPrice<T>): T.Tick {
  return getTickAtRatioImpl(Price.asRatio(price));
}

// Implementation class for UsableTick
// Implements the interface defined in tick.ts
class UsableTickLive implements T.UsableTick {
  readonly _tag = "@liquidity_lab/effect-crypto-uniswap/tick#UsableTick";

  // Constructor made private
  private constructor(
    readonly unwrap: T.Tick,
    readonly spacing: T.TickSpacing,
  ) {}

  // Static factory method to handle creation and normalization
  static make(unwrap: T.Tick, spacing: T.TickSpacing): UsableTickLive {
    // Normalize potential -0 to 0 here by adding 0
    return new UsableTickLive(unsafeMakeTick(unwrap + 0), spacing);
  }
}

/**
 * Returns the closest tick that is nearest a given tick and usable for the given tick spacing
 * @param tick the target tick
 * @param tickSpacing the spacing of the pool
 * @internal
 */
export function nearestUsableTick(tick: T.Tick, tickSpacing: T.TickSpacing): T.UsableTick {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;

  // Use the static make method instead of the constructor
  if (rounded < MIN_TICK) return UsableTickLive.make(makeTick(rounded + tickSpacing), tickSpacing);
  else if (rounded > MAX_TICK)
    return UsableTickLive.make(makeTick(rounded - tickSpacing), tickSpacing);
  else return UsableTickLive.make(makeTick(rounded), tickSpacing);
}

// Implementation for adding N ticks
export function addNTicksImpl(usableTick: T.UsableTick, n: number): Option.Option<T.UsableTick> {
  // Removed '+ 0' normalization from here
  const newTickValue = usableTick.unwrap + n * usableTick.spacing;

  // Use makeTick.option to handle validation and creation
  return Option.map(
    makeTick.option(newTickValue),
    // Use the static make method here
    (newTick) => UsableTickLive.make(newTick, usableTick.spacing),
  );
}

// Implementation for subtracting N ticks
export function subtractNTicksImpl(
  usableTick: T.UsableTick,
  n: number,
): Option.Option<T.UsableTick> {
  // Removed '+ 0' normalization from here
  const newTickValue = usableTick.unwrap - n * usableTick.spacing;

  // Use makeTick.option to handle validation and creation
  return Option.map(
    makeTick.option(newTickValue),
    // Use the static make method here
    (newTick) => UsableTickLive.make(newTick, usableTick.spacing),
  );
}

/**
 * Calculates the distance between two ticks in terms of spacing units.
 * It finds the nearest usable ticks for both input ticks based on the spacing
 * and returns the difference divided by the spacing.
 */
export function subtractImpl(tick1: T.Tick, tick2: T.Tick, spacing: T.TickSpacing): number {
  const usableTick1 = nearestUsableTick(tick1, spacing);
  const usableTick2 = nearestUsableTick(tick2, spacing);

  const difference = usableTick1.unwrap - usableTick2.unwrap;

  // Since usableTick1 and usableTick2 are multiples of spacing, the difference is also a multiple.
  // The division should always result in an integer.
  return difference / spacing;
}
