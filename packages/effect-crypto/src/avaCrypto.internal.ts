import type { ExecutionContext } from "ava";
import { Big, RoundingMode } from "bigdecimal.js";
import { Layer } from "effect";

import * as Assertable from "./assertable.js";
import type * as T from "./avaCrypto.js";
import * as Price from "./price.js";
import * as Token from "./token.js";
import * as AvaEffect from "./utils/avaEffect.js";

export function makeAssertableEqualAssertion(
  t: ExecutionContext<unknown>,
): T.AssertableEqualAssertion {
  function assertableEqual<
    Actual extends Assertable.Assertable,
    Expected extends Assertable.Assertable,
  >(actual: Actual, expected: Expected, message?: string): boolean {
    return t.deepEqual(
      Assertable.asAssertableEntity(actual),
      Assertable.asAssertableEntity(expected),
      message,
    );
  }

  function assertArrays<
    Actual extends Assertable.Assertable,
    Expected extends Assertable.Assertable,
  >(actual: readonly Actual[], expected: readonly Expected[], message?: string): boolean {
    if (actual.length !== expected.length) {
      return false;
    }

    const actualEntities = actual.map((a) => Assertable.asAssertableEntity(a));
    const expectedEntities = expected.map((e) => Assertable.asAssertableEntity(e));

    return t.deepEqual(actualEntities, expectedEntities, message);
  }

  return Object.assign(assertableEqual, {
    skip: t.deepEqual.skip,
    arrays: assertArrays,
  }) as T.AssertableEqualAssertion;
}

function makePriceEqualsWithPrecisionAssertion(
  t: ExecutionContext<unknown>,
): (precisionPercent: number) => T.PriceEqualsWithPrecisionAssertion {
  return (precisionPercent: number) => {
    function priceEqualsWithPrecision<
      Actual extends Price.TokenPrice<T>,
      Expected extends Actual,
      T extends Token.TokenType,
    >(actual: Actual, expected: Expected, message?: string): boolean {
      const actualValue = Price.asUnits(actual);
      const expectedValue = Price.asUnits(expected);

      if (actualValue.compareTo(expectedValue) === 0) {
        return true;
      }

      const maxDiff = Big(precisionPercent);
      const diff = expectedValue
        .divide(actualValue, maxDiff.scale() * 2, RoundingMode.HALF_UP)
        .abs()
        .subtract(1);

      if (diff.lte(maxDiff)) {
        return true;
      }

      const assertableEqual = makeAssertableEqualAssertion(t);

      return assertableEqual(actual, expected, message);
    }

    return Object.assign(priceEqualsWithPrecision, {
      skip: t.deepEqual.skip,
    }) as T.PriceEqualsWithPrecisionAssertion;
  };
}

function makeAssertions<Services>(
  t: ExecutionContext<AvaEffect.TestEffectContext<Services>>,
): T.Assertions {
  return {
    assertableEqual: makeAssertableEqualAssertion(t),
    priceEqualsWithPrecision: makePriceEqualsWithPrecisionAssertion(t),
  };
}

export function makeTestEffect<Services, Extensions extends Record<string, unknown>>(
  deps: Layer.Layer<Services>,
  makeExtensions: (t: ExecutionContext<AvaEffect.TestEffectContext<Services>>) => Extensions,
): AvaEffect.EffectTestFn<Services, AvaEffect.EffectAssertions & T.Assertions & Extensions> {
  return AvaEffect.makeTestEffect(deps, (t) => Object.assign(makeAssertions(t), makeExtensions(t)));
}
