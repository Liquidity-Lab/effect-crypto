import { ExecutionContext } from "ava";
import { Big, BigDecimal, MathContext, RoundingMode } from "bigdecimal.js";

// Constants
const ONE = Big(1);
const TWO = Big(2);
const LN2 = Big("0.69314718055994530941723212145817656807550013436025525412068000949");

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

export function assertEqualWithPrecisionImpl(
  t: ExecutionContext<unknown>,
  precision?: number,
): (actual: BigDecimal, expected: BigDecimal, msg?: string) => boolean {
  return (actual, expected, msg) => {
    function isInteger(value: number | undefined): value is number {
      return Number.isInteger(value);
    }

    const targetScale = Math.min(
      actual.scale(),
      expected.scale(),
      isInteger(precision) && precision > 0 ? precision : Number.MAX_VALUE,
    );

    return t.deepEqual(
      actual.setScale(targetScale, RoundingMode.DOWN).toPlainString(),
      expected.setScale(targetScale, RoundingMode.DOWN).toPlainString(),
      msg,
    );
  };
}

export function assertEqualWithPercentage(
  t: ExecutionContext<unknown>,
  percents: BigDecimal,
  mc: MathContext,
): (actual: BigDecimal, expected: BigDecimal, msg?: string) =>boolean {
  return (actual, expected, msg) => {
    const diffPercent = ONE.subtract(
      actual.divideWithMathContext(expected, mc)
    ).abs();

    if (diffPercent.lowerThanOrEquals(percents)) {
      return t.pass();
    }

    const targetScale = Math.min(
      actual.scale(),
      expected.scale(),
    )

    return t.deepEqual(
      actual.setScale(targetScale, RoundingMode.DOWN).toPlainString(),
      expected.setScale(targetScale, RoundingMode.DOWN).toPlainString(),
      msg,
    );
  };
}

