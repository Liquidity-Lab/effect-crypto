import type { ExecutionContext } from "ava";
import { Big, BigDecimal } from "bigdecimal.js";
import { Layer } from "effect";

import { AvaCrypto, Token } from "@liquidity_lab/effect-crypto";
import { AvaEffect } from "@liquidity_lab/effect-crypto/utils";

import type * as T from "./avaUniswap.js";
import * as Price from "./price.js";

/** @internal */
export function makePriceEqualsWithPrecisionAssertion<T>(
  t: ExecutionContext<T>,
  precisionPercent?: BigDecimal,
): T.PriceEqualsWithPrecisionAssertion {
  function priceEqualsWithPrecision<
    Actual extends Price.TokenPrice<T>,
    Expected extends Actual,
    T extends Token.TokenType,
  >(actual: Actual, expected: Expected, message?: string): boolean {
    const maxDiff =
      precisionPercent ? precisionPercent : (
        Big(1).scaleByPowerOfTen(
          -1 * Math.min(...[...actual.tokens, ...expected.tokens].map((t) => t.decimals)),
        )
      );

    const actualValue = Price.asRatio(actual);
    const expectedValue = Price.asRatio(expected);

    if (actualValue.compareTo(expectedValue) === 0) {
      return t.assert(true, "Prices are exactly the same");
    }

    const diff = expectedValue
      .divide(actualValue, maxDiff.scale() * 2 /* Using original MathContext logic */)
      .abs()
      .subtract(1);

    if (diff.lte(maxDiff)) {
      return t.assert(true, "Price is within precision");
    }

    const assertableEqual = AvaCrypto.AssertableEqualAssertion(t);

    return assertableEqual(actual, expected, message);
  }

  return Object.assign(priceEqualsWithPrecision, {
    skip: t.deepEqual.skip,
  }) as T.PriceEqualsWithPrecisionAssertion;
}

/** @internal */
export function makeAssertions<Services>(
  t: ExecutionContext<AvaEffect.TestEffectContext<Services>>,
): T.Assertions {
  return {
    priceEqualsWithPrecision: (precisionPercent: BigDecimal) =>
      makePriceEqualsWithPrecisionAssertion(t, precisionPercent),
    priceEquals: makePriceEqualsWithPrecisionAssertion(t),
  };
}

/** @internal */
export function makeTestEffect<Services, Extensions extends Record<string, unknown>>(
  deps: Layer.Layer<Services>,
  makeExtensions: (t: ExecutionContext<AvaEffect.TestEffectContext<Services>>) => Extensions,
): AvaEffect.EffectTestFn<Services, AvaEffect.EffectAssertions & T.Assertions & Extensions> {
  return AvaEffect.makeTestEffect(deps, (t) => Object.assign(makeAssertions(t), makeExtensions(t)));
}
