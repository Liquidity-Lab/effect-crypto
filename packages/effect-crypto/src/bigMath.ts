import { ExecutionContext } from "ava";
import { BigDecimal, MathContext } from "bigdecimal.js";
import { Brand } from "effect";
import { Arbitrary } from "fast-check";

import * as Adt from "./adt.js";
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
export const asNumeratorAndDenominator: (ratio: BigDecimal) => [bigint, bigint] = internal.asNumeratorAndDenominatorImpl;

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
export const NonNegativeDecimal: Brand.Brand.Constructor<NonNegativeDecimal> = internal.makeNonNegativeDecimal;

/**
 * Returns the natural logarithm of a given x
 */
export const ln: (x: BigDecimal, mc: MathContext) => BigDecimal = internal.lnImpl;

/**
 * Returns the logarithm of a given x with a base of 2
 */
export const log2: (x: BigDecimal, mc: MathContext) => BigDecimal = internal.log2Impl;

/**
 * Returns the logarithm of a given x with a given base
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
 * Generates a Ratio value within given constraints
 */
export const ratioGen: (constraints?: {
  min?: Ratio,
  max?: Ratio,
  maxScale?: number,
}) => Arbitrary<Ratio> = internal.ratioGen;

/**
 * Generates a non-negative decimal value within given constraints
 */
export const nonNegativeDecimalGen: (constraints?: {
    min?: NonNegativeDecimal;
    max?: NonNegativeDecimal;
    scale?: number;
}) => Arbitrary<NonNegativeDecimal> = internal.nonNegativeDecimalGen;
