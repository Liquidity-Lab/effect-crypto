import type { AfterFn, BeforeFn, ExecutionContext } from "ava";
import { Context, Effect, Layer, Option, Scope } from "effect";

import * as internal from "./avaEffect.internal.js";

/**
 * This type is used to provide `effect-ts`'s context to the test suites
 */
export type TestEffectContext<Services> = {
  [internal.contextKeySymbol]: Context.Context<Services>;
};

export type EffectfulExecutionContext<Services, Plugins> = Omit<
  ExecutionContext<TestEffectContext<Services>>,
  "try"
> &
  Plugins;

export type EffectImplementationFn<Services, Plugins> = (
  t: EffectfulExecutionContext<Services, Plugins>,
) => Effect.Effect<void, unknown, Scope.Scope | Services>;

export type EffectTest<Services, Plugins> = (
  label: string,
  implementation: EffectImplementationFn<Services, Plugins>,
) => void;

export type AvaModifierWhitelist = "only" | "failing" | "skip" | "serial";

/**
 * This is a wrapper for `ava` test suites.
 * It provides a context for `effect-ts` and allows to use `effect-ts` in the test suites.
 */
export type EffectTestFn<Services, Plugins> = EffectTest<Services, Plugins> & {
  [Modifier in AvaModifierWhitelist]: EffectTest<Services, Plugins>;
} & {
  before: BeforeFn<TestEffectContext<Services>>;
  after: AfterFn<TestEffectContext<Services>>;
};

export interface AssertOptionalEqualViaAssertion {
  /**
   * Assert that `actual` is equal to `expected` using `via` function
   *
   * @example
   *   import { Option } from "effect";
   *
   *   t.assertOptionalEqualVia(
   *     Option.some(1),
   *     Option.some(2),
   *     t.deepEqual,
   *     "Expected values to be equal",
   *   );
   *
   **/ <Actual, Expected extends Actual>(
    actual: Option.Option<Actual>,
    expected: Option.Option<Expected>,
    via: (actualValue: Actual, expectedValue: Expected) => actualValue is Expected,
    message?: string,
  ): actual is Option.Option<Expected>;

  /**
   * Assert that `actual` is equal to `expected` using `via` function
   *
   * @example
   *   import { Option } from "effect";
   *
   *   t.assertOptionalEqualVia(
   *     Option.some(1),
   *     Option.some(2),
   *     t.deepEqual,
   *     "Expected values to be equal",
   *   );
   *
   **/ <Actual extends Expected, Expected>(
    actual: Option.Option<Actual>,
    expected: Option.Option<Expected>,
    via: (actualValue: Actual, expectedValue: Expected) => expectedValue is Actual,
    message?: string,
  ): expected is Option.Option<Actual>;

  /**
   * Assert that `actual` is equal to `expected` using `via` function
   *
   * @example
   *   import { Option } from "effect";
   *
   *   t.assertOptionalEqualVia(
   *     Option.some(1),
   *     Option.some(2),
   *     t.deepEqual,
   *     "Expected values to be equal",
   *   );
   *
   **/ <Actual, Expected>(
    actual: Option.Option<Actual>,
    expected: Option.Option<Expected>,
    via: (actualValue: Actual, expectedValue: Expected) => boolean,
    message?: string,
  ): boolean;

  /** Skip this assertion. */
  skip(actual: unknown, expected: unknown, message?: string): void;
}

export type EffectAssertions = {
  readonly assertOptionalEqualVia: AssertOptionalEqualViaAssertion;
};

/**
 * Create an instance of `EffectAssertions` for the given `t` from ava
 *
 * @constructor
 */
export const EffectAssertions: <T>(t: ExecutionContext<T>) => EffectAssertions =
  internal.makeEffectAssertions;

/**
 * Basic test function for effects which doesn't rely on any context `R`
 */
export const testAnyEffect: EffectTestFn<never, EffectAssertions> = internal.makeTestEffect<
  never,
  Record<string, never>
>(Layer.empty, () => ({}));

/**
 * Use this function to specify the dependencies for your test suite.
 * Dependencies will be provided to the test suites using `ava#before` hook:
 * they will be provided once before all test suites.
 *
 * @example
 *   import { makeTestEffect } from "./ava.js";
 *   import { Context, Effect, Layer } from "effect";
 *
 *   class SomeService extends Context.Tag("SomeService")<SomeService, {}> {}
 *
 *   const testEffect = makeTestEffect<SomeService>(Layer.succeed(SomeService, {}));
 *
 *   testEffect("Should do something", (t) => {
 *     return Effect.gen(function* () {
 *       const someService = yield* SomeService;
 *
 *       // Do something with the service
 *     });
 *   });
 */
export const makeTestEffect: <Services, Plugins extends Record<string, unknown>>(
  deps: Layer.Layer<Services>,
  makePlugins: (t: ExecutionContext<TestEffectContext<Services>>) => Plugins,
) => EffectTestFn<Services, EffectAssertions & Plugins> = internal.makeTestEffect;
