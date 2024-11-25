import { ExecutionContext } from "ava";
import { BigDecimal, MathContext } from "bigdecimal.js";

import * as internal from "./bigMath.internal.js";

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
