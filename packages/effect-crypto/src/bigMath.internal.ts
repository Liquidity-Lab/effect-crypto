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
