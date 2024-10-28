import type { ExecutionContext } from "ava";
import { Layer } from "effect";

import * as internal from "~/avaCrypto.internal.js";
import * as AvaEffect from "~/utils/avaEffect.js";
import { Assertable } from "~/assertable.js";

export type AssertableEqualAssertion = {
  /**
   * Assert that `actual` is deeply equal to `expected` after they converted to AssertableEntity
   * using `Assertable.asAssertableEntity`, returning `true` if the assertion passed and throwing otherwise.
   */ <Actual extends Assertable, Expected extends Actual>(
    actual: Actual,
    expected: Expected,
    message?: string,
  ): actual is Expected;

  /**
   * Assert that `actual` is deeply equal to `expected` after they converted to AssertableEntity
   * using `Assertable.asAssertableEntity`, returning `true` if the assertion passed and throwing otherwise.
   */ <Actual extends Expected, Expected extends Assertable>(
    actual: Actual,
    expected: Expected,
    message?: string,
  ): expected is Actual;

  /**
   * Assert that `actual` is deeply equal to `expected` after they converted to AssertableEntity
   * using `Assertable.asAssertableEntity`, returning `true` if the assertion passed and throwing otherwise.
   */ <Actual extends Assertable, Expected extends Assertable>(
    actual: Actual,
    expected: Expected,
    message?: string,
  ): boolean;

  /** Skip this assertion. */
  skip(actual: any, expected: any, message?: string): void;
};

export type Assertions = {
  readonly assertableEqual: AssertableEqualAssertion;
};

/**
 * This is a wrapper for `effect-ava` adding support for assertable.
 */
export const makeTestEffect: <Services, Extensions extends Record<string, unknown>>(
  deps: Layer.Layer<Services>,
  makeExtensions: (t: ExecutionContext<AvaEffect.TestEffectContext<Services>>) => Extensions,
) => AvaEffect.EffectTestFn<Services, AvaEffect.EffectAssertions & Assertions & Extensions> =
  internal.makeTestEffect;
