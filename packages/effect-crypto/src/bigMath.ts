import { ExecutionContext } from "ava";
import { BigDecimal, MathContext } from "bigdecimal.js";
import { Brand, Option } from "effect";
import { Arbitrary } from "fast-check";

import * as internal from "./bigMath.internal.js";

/**
 * Branded type that represents ratio meaning:
 *  - It is a positive
 */
export type Ratio = Brand.Branded<BigDecimal, internal.RatioTypeId>;

/**
 * Creates a new ratio. Consider using type-safe versions
 *
 * @example
 *   import { Big } from "bigdecimal.js";
 *   import { BigMath } form "effect-crypto";
 *
 *   BigMath.Ratio(Big("1.1")).option; // Some(Ratio(1.1))
 *   BigMath.Ratio(Big("-1.1")).option; // None
 *
 * @constructor
 */
export const Ratio: Brand.Brand.Constructor<Ratio> = internal.makeRatio;

/**
 * Returns the numerator and denominator of a given ratio
 *
 * @example
 *   import { BigMath } from "effect-crypto";
 *
 *   const ratio = BigMath.Ratio(Big("1.5"));
 *   BigMath.asNumeratorAndDenominator(ratio); // [15n, 10n]
 */
export const asNumeratorAndDenominator: (ratio: BigDecimal) => [bigint, bigint] =
  internal.asNumeratorAndDenominatorImpl;

/**
 * A branded type for non-negative decimals: [0, +inf)
 */
export type NonNegativeDecimal = Brand.Branded<BigDecimal, internal.NonNegativeDecimalTypeId>;

/**
 * Creates an instance of NonNegativeDecimal.
 * Consider using type-safe versions
 *
 * @example
 *  import { Big } from "bigdecimal.js";
 *  import { BigMath } from "effect-crypto";
 *
 *  BigMath.NonNegativeDecimal(Big("1.1")).option; // Some(NonNegativeDecimal(1.1))
 *
 * @constructor
 */
export const NonNegativeDecimal: Brand.Brand.Constructor<NonNegativeDecimal> =
  internal.makeNonNegativeDecimal;

/**
 * A branded type for Q64.96 fixed-point numbers. The Q64.96 format:
 * - Uses 64 bits for the integer part
 * - Uses 96 bits for the fractional part
 * - Valid range: [0, 2^160)
 *
 * @see {@link https://en.wikipedia.org/wiki/Q_(number_format) Q number format}
 * @see {@link https://ethereum.org/en/developers/docs/smart-contracts/mathematics/#fixed-point-numbers Ethereum fixed-point numbers}
 */
export type Q64x96 = Brand.Branded<bigint, internal.Q64x96TypeId>;

/**
 * Creates an instance of Q64.96 fixed-point number.
 *
 * @example
 *  import { Big } from "bigdecimal.js";
 *  import { BigMath } from "effect-crypto";
 *
 *  BigMath.Q64x96(Big("1.5")).option; // Some(Q64x96(1.5))
 *  BigMath.Q64x96(Big("-1")).option; // None - negative values not allowed
 *
 * @see {@link https://docs.uniswap.org/contracts/v3/reference/core/libraries/FullMath Uniswap v3 implementation}
 * @constructor
 */
export const Q64x96: Brand.Brand.Constructor<Q64x96> & {
  MAX: Q64x96;
} = Object.assign(internal.makeQ64x96, { MAX: internal.Q64x96_MAX_VALUE });

/**
 * Maximum value for uint256 (2^256 - 1)
 * This is the maximum value that can be stored in a uint256 in Ethereum
 * Used for token balances, allowances, and other uint256 values in ERC20 contracts
 */
export const MAX_UINT256 = internal.MAX_UINT256_VALUE;

/**
 * Converts a BigDecimal to Q64.96 fixed-point number format.
 * Returns None if the value is outside the valid range [0, 2^160).
 *
 * @example
 *  import { Big } from "bigdecimal.js";
 *  import { BigMath } from "effect-crypto";
 *
 *  BigMath.convertToQ64x96(Big("1.5")); // Some(Q64x96(1.5))
 *  BigMath.convertToQ64x96(Big("-1")); // None
 *
 * @see {@link Q64x96} for more details about the Q64.96 format
 * @see {@link https://docs.uniswap.org/contracts/v3/reference/core/libraries/FixedPoint96 Uniswap v3 Q64.96}
 */
export const convertToQ64x96: (value: BigDecimal) => Option.Option<Q64x96> =
  internal.convertToQ64x96Impl;

/**
 * Converts a Q64.96 fixed-point number back to BigDecimal format.
 *
 * @example
 *  import { Big } from "bigdecimal.js";
 *  import { BigMath } from "effect-crypto";
 *
 *  const q64x96 = BigMath.Q64x96(Big("1.5"));
 *  BigMath.q64x96ToBigDecimal(q64x96); // BigDecimal("1.5")
 *
 * @see {@link Q64x96} for more details about the Q64.96 format
 * @see {@link https://docs.uniswap.org/contracts/v3/reference/core/libraries/FixedPoint96 Uniswap v3 Q64.96}
 * @see {@link convertToQ64x96} for the reverse operation
 */
export const q64x96ToBigDecimal: (q64x96: Q64x96) => BigDecimal = internal.q64x96ToBigDecimalImpl;

/**
 * Returns the natural logarithm (base e) of a given BigDecimal.
 *
 * @param x - The BigDecimal value for which to calculate the natural logarithm. Must be positive.
 * @param mc - The MathContext specifying the precision and rounding mode.
 * @returns The natural logarithm of x as a BigDecimal.
 *
 * @example
 *  import { Big, MathContext } from "bigdecimal.js";
 *  import { BigMath } from "effect-crypto";
 *
 *  const value = Big("10");
 *  const context = MathContext.DECIMAL128;
 *  const result = BigMath.ln(value, context);
 *  // result will be approximately 2.3025850929940456840179914546844
 */
export const ln: (x: BigDecimal, mc: MathContext) => BigDecimal = internal.lnImpl;

/**
 * Returns the logarithm of a given BigDecimal with a base of 2.
 *
 * @param x - The BigDecimal value for which to calculate the base-2 logarithm. Must be positive.
 * @param mc - The MathContext specifying the precision and rounding mode.
 * @returns The base-2 logarithm of x as a BigDecimal.
 *
 * @example
 *  import { Big, MathContext } from "bigdecimal.js";
 *  import { BigMath } from "effect-crypto";
 *
 *  const value = Big("8");
 *  const context = MathContext.DECIMAL64;
 *  const result = BigMath.log2(value, context);
 *  // result will be approximately 3
 */
export const log2: (x: BigDecimal, mc: MathContext) => BigDecimal = internal.log2Impl;

/**
 * Returns the logarithm of a given BigDecimal with a specified base.
 *
 * @param base - The base of the logarithm. Must be positive and not equal to 1.
 * @param x - The BigDecimal value for which to calculate the logarithm. Must be positive.
 * @param mc - The MathContext specifying the precision and rounding mode.
 * @returns The logarithm of x with the specified base as a BigDecimal.
 *
 * @example
 *  import { Big, MathContext } from "bigdecimal.js";
 *  import { BigMath } from "effect-crypto";
 *
 *  const base = Big("10");
 *  const value = Big("100");
 *  const context = MathContext.DECIMAL32;
 *  const result = BigMath.log(base, value, context);
 *  // result will be approximately 2
 */
export const log: (base: BigDecimal, x: BigDecimal, mc: MathContext) => BigDecimal =
  internal.logImpl;

/**
 * Asserts that two BigDecimals are equal with given precision
 *
 * @example
 *   import { BigDecimal, MathContext } from "bigdecimal.js";
 *   import { BigMath } from "@liquidity_lab/effect-crypto";
 *
 *   const actual = BigDecimal("1.11");
 *   const expected = BigDecimal("1.1");
 *   const errorTolerance = BigDecimal("0.01");
 *
 *   BigMath.assertEqualWithPrecision(t, errorTolerance, MathContext.DECIMAL128)(
 *     actual,
 *     expected,
 *     "Should be equal",
 *   );
 *
 * @param t ava test function
 * @param precision percents of precision (0.01 means 1%)
 * @param mc MathContext
 */
export const assertEqualWithPercentage: (
  t: ExecutionContext<unknown>,
  percents: BigDecimal,
  mc: MathContext,
) => {
  (actual: BigDecimal, expected: BigDecimal, msg?: string): boolean;
  trimToExpectedScale: (actual: BigDecimal, expected: BigDecimal, msg?: string) => boolean;
} = internal.assertEqualWithPercentage;

/**
 * Finds the minimum value among one or more BigInt numbers.
 *
 * @param a - The first BigInt number.
 * @param nums - Additional BigInt numbers to compare.
 * @returns The smallest BigInt value among the inputs.
 *
 * @example
 *  import { BigMath } from "effect-crypto";
 *
 *  const min1 = BigMath.minBigInt(10n, 5n, 20n); // 5n
 *  const min2 = BigMath.minBigInt(-3n, -1n, -5n); // -5n
 *  const min3 = BigMath.minBigInt(100n); // 100n
 */
export const minBigInt: {
  (a: bigint, ...nums: readonly bigint[]): bigint;
} = internal.minBigIntImpl;

/**
 * Finds the maximum value among one or more BigInt numbers.
 *
 * @param a - The first BigInt number.
 * @param nums - Additional BigInt numbers to compare.
 * @returns The largest BigInt value among the inputs.
 *
 * @example
 *  import { BigMath } from "effect-crypto";
 *
 *  const max1 = BigMath.maxBigInt(10n, 5n, 20n); // 20n
 *  const max2 = BigMath.maxBigInt(-3n, -1n, -5n); // -1n
 *  const max3 = BigMath.maxBigInt(100n); // 100n
 */
export const maxBigInt: {
  (a: bigint, ...nums: readonly bigint[]): bigint;
} = internal.maxBigIntImpl;

/**
 * Generates a BigDecimal value within the given constraints
 *
 * @example
 *   import { fc, testProp } from "@fast-check/ava";
 *   import { BigMath } from "effect-crypto"
 *   import { Big } from "bigdecimal.js"
 *
 *   testProp(
 *     "My Test Scenario",
 *     // It will generate BigDecimal within [Number.MIN_VALUE, Number.MAX_VALUE] range
 *     // with the scale within [0, 32] range
 *     [BigMath.bigDecimalGen({ min: Big(Number.MIN_VALUE), max: Big(Number.MAX_VALUE), scale: 32 }],
 *     (t, bigDecimal) => {
 *
 *     }
 *   );
 *
 */
export const bigDecimalGen: (constraints?: {
  min?: BigDecimal;
  max?: BigDecimal;
  scale?: number;
}) => Arbitrary<BigDecimal> = internal.bigDecimalGen;

/**
 * Generates an arbitrary Ratio (positive BigDecimal) value for property-based testing,
 * optionally within the given constraints.
 *
 * @param constraints - Optional constraints for the generated Ratio.
 * @param constraints.min - The minimum allowed Ratio value (inclusive).
 * @param constraints.max - The maximum allowed Ratio value (inclusive).
 * @param constraints.maxScale - The maximum number of digits allowed after the decimal point.
 * @returns An Arbitrary that generates valid Ratio values.
 *
 * @example
 * ```typescript
 * import { fc } from "fast-check";
 * import { BigMath } from "effect-crypto";
 * import { Big } from "bigdecimal.js";
 *
 * // Generate a ratio between 0.1 and 10 with up to 5 decimal places
 * const specificRatioGen = BigMath.ratioGen({
 *   min: BigMath.Ratio(Big("0.1")),
 *   max: BigMath.Ratio(Big("10")),
 *   maxScale: 5
 * });
 *
 * fc.assert(
 *   fc.property(specificRatioGen, (ratio) => {
 *     const num = Number(ratio.toString());
 *     return num >= 0.1 && num <= 10;
 *   })
 * );
 * ```
 */
export const ratioGen: (constraints?: {
  min?: Ratio;
  max?: Ratio;
  maxScale?: number;
}) => Arbitrary<Ratio> = internal.ratioGen;

/**
 * Generates an arbitrary NonNegativeDecimal (BigDecimal >= 0) value for property-based testing,
 * optionally within the given constraints.
 *
 * @param constraints - Optional constraints for the generated NonNegativeDecimal.
 * @param constraints.min - The minimum allowed NonNegativeDecimal value (inclusive, must be >= 0).
 * @param constraints.max - The maximum allowed NonNegativeDecimal value (inclusive).
 * @param constraints.scale - The exact number of digits allowed after the decimal point.
 * @returns An Arbitrary that generates valid NonNegativeDecimal values.
 *
 * @example
 * ```typescript
 * import { fc } from "fast-check";
 * import { BigMath } from "effect-crypto";
 * import { Big } from "bigdecimal.js";
 *
 * // Generate a non-negative decimal up to 1000 with exactly 2 decimal places
 * const specificNonNegativeGen = BigMath.nonNegativeDecimalGen({
 *   max: BigMath.NonNegativeDecimal(Big("1000")),
 *   scale: 2
 * });
 *
 * fc.assert(
 *   fc.property(specificNonNegativeGen, (dec) => {
 *     const num = Number(dec.toString());
 *     // Check non-negativity and scale
 *     return num >= 0 && dec.scale() === 2;
 *   })
 * );
 * ```
 */
export const nonNegativeDecimalGen: (constraints?: {
  min?: NonNegativeDecimal;
  max?: NonNegativeDecimal;
  scale?: number;
}) => Arbitrary<NonNegativeDecimal> = internal.nonNegativeDecimalGen;

/**
 * Generates an arbitrary Q64x96 (bigint) value for property-based testing.
 *
 * @returns An Arbitrary that generates valid Q64x96 values.
 *
 * @example
 * ```typescript
 * import { fc } from "fast-check";
 * import { BigMath } from "effect-crypto";
 *
 * const q64x96Arbitrary = BigMath.q64x96Gen();
 *
 * fc.assert(
 *   fc.property(q64x96Arbitrary, (qVal) => {
 *     // Test properties of the generated Q64x96 bigint
 *     return typeof qVal === 'bigint' && qVal >= 0n;
 *   })
 * );
 * ```
 */
export const q64x96Gen: () => Arbitrary<Q64x96> = internal.q64x96Gen;

/**
 * Converts a BigDecimal to a normalized string representation, removing trailing zeros
 * and ignoring the original scale. Ensures that numerically equal values with
 * different scales produce the same string output (e.g., "1.00" and "1" both become "1").
 *
 * @param value - The BigDecimal value to convert.
 * @returns A scale-independent string representation of the BigDecimal.
 *
 * @example
 *  import { Big } from "bigdecimal.js";
 *  import { BigMath } from "effect-crypto";
 *
 *  BigMath.asNormalisedString(Big("1.500")); // "1.5"
 *  BigMath.asNormalisedString(Big("1.0")); // "1"
 *  BigMath.asNormalisedString(Big("0.00")); // "0"
 */
export const asNormalisedString: {
  (value: BigDecimal): string
} = internal.asNormalisedStringImpl;
