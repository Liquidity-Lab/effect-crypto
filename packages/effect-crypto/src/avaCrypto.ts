import type { ExecutionContext } from "ava";
import { Layer } from "effect";

import * as Assertable from "./assertable.js";
import * as internal from "./avaCrypto.internal.js";
import * as AvaEffect from "./utils/avaEffect.js";

export type AssertableEqualAssertion = {
  /**
   * Assert that `actual` is deeply equal to `expected` after they converted to AssertableEntity
   * using `Assertable.asAssertableEntity`, returning `true` if the assertion passed and throwing otherwise.
   */ <Actual extends Assertable.Assertable, Expected extends Actual>(
    actual: Actual,
    expected: Expected,
    message?: string,
  ): actual is Expected;

  /**
   * Assert that `actual` is deeply equal to `expected` after they converted to AssertableEntity
   * using `Assertable.asAssertableEntity`, returning `true` if the assertion passed and throwing otherwise.
   */ <Actual extends Expected, Expected extends Assertable.Assertable>(
    actual: Actual,
    expected: Expected,
    message?: string,
  ): expected is Actual;

  /**
   * Assert that `actual` is deeply equal to `expected` after they converted to AssertableEntity
   * using `Assertable.asAssertableEntity`, returning `true` if the assertion passed and throwing otherwise.
   */ <Actual extends Assertable.Assertable, Expected extends Assertable.Assertable>(
    actual: Actual,
    expected: Expected,
    message?: string,
  ): boolean;

  arrays: {
    /**
     * Assert that arrays of assertables are deeply equal after converting each element to AssertableEntity
     */ <Actual extends Assertable.Assertable, Expected extends Actual>(
      actual: readonly Actual[],
      expected: readonly Expected[],
      message?: string,
    ): actual is Expected[];

    /**
     * Assert that arrays of assertables are deeply equal after converting each element to AssertableEntity
     */ <Actual extends Expected, Expected extends Assertable.Assertable>(
      actual: readonly Actual[],
      expected: readonly Expected[],
      message?: string,
    ): expected is Actual[];

    /**
     * Assert that arrays of assertables are deeply equal after converting each element to AssertableEntity
     */ <Actual extends Assertable.Assertable, Expected extends Assertable.Assertable>(
      actual: readonly Actual[],
      expected: readonly Expected[],
      message?: string,
    ): boolean;
  };

  /** Skip this assertion. */
  skip(actual: unknown, expected: unknown, message?: string): void;
};

export const AssertableEqualAssertion: {
  <T>(t: ExecutionContext<T>): AssertableEqualAssertion;
} = internal.makeAssertableEqualAssertion;

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
