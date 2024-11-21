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
export const log: (x: BigDecimal, base: BigDecimal, mc: MathContext) => BigDecimal =
  internal.logImpl;

export const assertEqualWithPrecision: (
  t: ExecutionContext<unknown>,
  precision?: number,
) => (actual: BigDecimal, expected: BigDecimal, msg?: string) => boolean =
  internal.assertEqualWithPrecisionImpl;

export const assertEqualWithPercentage: (
  t: ExecutionContext<unknown>,
  percents: BigDecimal,
  mc: MathContext,
) => (actual: BigDecimal, expected: BigDecimal, msg?: string) => boolean = internal.assertEqualWithPercentage;
