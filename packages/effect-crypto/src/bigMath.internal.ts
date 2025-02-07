import { ExecutionContext } from "ava";
import { Big, BigDecimal, MathContext, RoundingMode } from "bigdecimal.js";
import { Brand, Option } from "effect";
import { Arbitrary } from "fast-check";

import { fc } from "@fast-check/ava";

import * as T from "./bigMath.js";

// Constants
const ONE = Big(1);
const TWO = Big(2);
const LN2 = Big("0.69314718055994530941723212145817656807550013436025525412068000949");

const MATH_CONTEXT_HIGH_PRECISION = new MathContext(192, RoundingMode.HALF_UP);

export type RatioTypeId = "com/liquidity_lab/effect-crypto/bigMath#Ratio";

export const makeRatio = Brand.refined<T.Ratio>(
  (raw) => raw.greaterThan(0n),
  (raw) => Brand.error(`Ratio must be positive number, given [${raw}]`),
);

export function asNumeratorAndDenominatorImpl(ratio: BigDecimal): [bigint, bigint] {
  const denominator = 10n ** BigInt(ratio.scale());

  return [ratio.unscaledValue(), denominator];
}

export type NonNegativeDecimalTypeId = "com/liquidity_lab/effect-crypto/bigMath#NonNegativeDecimal";

export const makeNonNegativeDecimal = Brand.refined<T.NonNegativeDecimal>(
  (raw) => raw.greaterThanOrEquals(0),
  (raw) => Brand.error(`NonNegativeDecimal must be non negative number [0, +inf), given [${raw}]`),
);

export type Q64x96TypeId = "com/liquidity_lab/effect-crypto/bigMath#Q64x96";

const Q64x96_MAX_VALUE = 2n ** (64n + 96n);

export const makeQ64x96 = Brand.refined<T.Q64x96>(
  (raw) => raw <= Q64x96_MAX_VALUE && raw >= 0n,
  (raw) =>
    Brand.error(`Q64x96 must be non negative number [0, +${Q64x96_MAX_VALUE}], given [${raw}]`),
);

export function convertToQ64x96Impl(value: BigDecimal): Option.Option<T.Q64x96> {
  const scaledValue = value.multiply(2n ** 96n).toBigInt();

  return makeQ64x96.option(scaledValue);
}

export function q64x96ToBigDecimalImpl(q64x96: T.Q64x96): BigDecimal {
  return Big(q64x96).divideWithMathContext(2n ** 96n, MATH_CONTEXT_HIGH_PRECISION);
}

/**
 * Computes the natural logarithm of a BigDecimal number.
 * @param x - The input BigDecimal number.
 * @param precision - The desired decimal precision.
 * @returns The natural logarithm of x.
 */
export function lnImpl(x: BigDecimal, mc: MathContext): BigDecimal {
  const epsilon = Big("1e-" + mc.precision);

  let n = 0;

  // Normalize x to y in [1, 2)
  let y = x;
  while (y.compareTo(TWO) >= 0) {
    y = y.divideWithMathContext(TWO, mc);
    n++;
  }
  while (y.compareTo(ONE) < 0) {
    y = y.multiply(TWO);
    n--;
  }

  // Now y in [1, 2)
  // Use the series expansion for ln(y)
  const yPlusOne = y.add(ONE);
  const yMinusOne = y.subtract(ONE);
  const z = yMinusOne.divideWithMathContext(yPlusOne, mc);
  const zSquared = z.multiply(z);

  let term = z;
  let sum = term;
  let i = 1;

  while (term.abs().compareTo(epsilon) > 0) {
    term = term.multiply(zSquared);
    const divisor = Big(2 * i + 1);
    const nextTerm = term.divideWithMathContext(divisor, mc);
    sum = sum.add(nextTerm);
    i++;
  }

  const lnY = sum.multiply(TWO);
  const lnX = Big(n).multiply(LN2).add(lnY);

  return lnX;
}

/**
 * Computes the logarithm of x with any base.
 * @param base - The logarithm base as a BigDecimal.
 * @param x - The input BigDecimal number.
 * @param mc - MathContext used for the operation
 * @returns The logarithm of x to the given base.
 */
export function logImpl(base: BigDecimal, x: BigDecimal, mc: MathContext): BigDecimal {
  const lnX = lnImpl(x, mc);
  const lnBase = lnImpl(base, mc);

  return lnX.divideWithMathContext(lnBase, mc);
}

/**
 * Computes the logarithm of x with base of 2
 *
 * @param x
 * @param mc
 */
export function log2Impl(x: BigDecimal, mc: MathContext): BigDecimal {
  return logImpl(TWO, x, mc);
}

export function assertEqualWithPercentage(
  t: ExecutionContext<unknown>,
  percents: BigDecimal,
  mc: MathContext,
) {
  const go = (trimScale: boolean) => (actual: BigDecimal, expected: BigDecimal, msg?: string) => {
    const [min, max] = [
      expected.multiply(ONE.add(percents), mc),
      expected.multiply(ONE.subtract(percents), mc),
    ].sort((a, b) => a.compareTo(b));

    if (actual.greaterThanOrEquals(min) && actual.lowerThanOrEquals(max)) {
      return t.pass();
    }
    const scaledActual = trimScale ? actual.setScale(expected.scale(), RoundingMode.DOWN) : actual;

    return t.deepEqual(scaledActual.toPlainString(), expected.toPlainString(), msg);
  };

  return Object.assign(go(false), {
    trimToExpectedScale: go(true),
  });
}

export function bigDecimalGen(constraints?: {
  min?: BigDecimal;
  max?: BigDecimal;
  scale?: number;
}): Arbitrary<BigDecimal> {
  const scale = Math.max(0, Math.floor(constraints?.scale ?? 0));

  const min = constraints?.min ? constraints.min.setScale(scale, RoundingMode.FLOOR) : Big(0n);
  const max =
    constraints?.max ?
      constraints.max.setScale(scale, RoundingMode.FLOOR)
    : Big(BigInt(Number.MAX_SAFE_INTEGER) * 10n ** BigInt(scale));

  return fc
    .bigInt(min.unscaledValue(), max.unscaledValue())
    .chain((unscaled) =>
      fc
        .nat(scale)
        .map((scale) =>
          Big(unscaled).divideWithMathContext(10n ** BigInt(scale), MATH_CONTEXT_HIGH_PRECISION),
        ),
    )
    .map((value) => value.min(max).max(min));
}

export function ratioGen(constraints?: { min?: T.Ratio; max?: T.Ratio; maxScale?: number }) {
  const maxScale = Math.max(0, Math.floor(constraints?.maxScale ?? 0));
  const min =
    constraints?.min ||
    Big(1).divideWithMathContext(10n ^ BigInt(maxScale), MATH_CONTEXT_HIGH_PRECISION);

  return bigDecimalGen({ min, max: constraints?.max, scale: maxScale })
    .map((raw) => makeRatio.option(raw))
    .filter(Option.isSome)
    .map((ratioOpt) => ratioOpt.value);
}

export function nonNegativeDecimalGen(constraints?: {
  min?: T.NonNegativeDecimal;
  max?: T.NonNegativeDecimal;
  scale?: number;
}): Arbitrary<T.NonNegativeDecimal> {
  return bigDecimalGen(constraints).map(makeNonNegativeDecimal);
}
