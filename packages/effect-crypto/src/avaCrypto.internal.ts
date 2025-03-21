import type { ExecutionContext } from "ava";
import { Layer } from "effect";

import * as Assertable from "./assertable.js";
import type * as T from "./avaCrypto.js";
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
    const actualEntities = actual.map((a) => Assertable.asAssertableEntity(a));
    const expectedEntities = expected.map((e) => Assertable.asAssertableEntity(e));

    return t.deepEqual(actualEntities, expectedEntities, message);
  }

  return Object.assign(assertableEqual, {
    skip: t.deepEqual.skip,
    arrays: assertArrays,
  }) as T.AssertableEqualAssertion;
}

function makeAssertions<Services>(
  t: ExecutionContext<AvaEffect.TestEffectContext<Services>>,
): T.Assertions {
  return {
    assertableEqual: makeAssertableEqualAssertion(t),
  };
}

export function makeTestEffect<Services, Extensions extends Record<string, unknown>>(
  deps: Layer.Layer<Services>,
  makeExtensions: (t: ExecutionContext<AvaEffect.TestEffectContext<Services>>) => Extensions,
): AvaEffect.EffectTestFn<Services, AvaEffect.EffectAssertions & T.Assertions & Extensions> {
  return AvaEffect.makeTestEffect(deps, (t) => Object.assign(makeAssertions(t), makeExtensions(t)));
}
