
import * as internal from "./bigMath.internal.js"
import { BigDecimal, MathContext } from "bigdecimal.js";

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
export const log: (x: BigDecimal, base: BigDecimal, mc: MathContext) => BigDecimal = internal.logImpl;
