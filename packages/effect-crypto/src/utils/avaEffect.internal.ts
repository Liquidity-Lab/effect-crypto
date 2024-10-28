import anyTest, { type ExecutionContext, type Implementation, type TestFn } from "ava";
import { Context, Effect, Layer, LogLevel, Logger, Option } from "effect";

import * as T from "~/utils/avaEffect.js";

export const contextKeySymbol = Symbol("com/liquidity_lab/crypto/utils/ava#context");

function makeAssertOptionalEqualViaAssertion(
  t: ExecutionContext<unknown>,
): T.AssertOptionalEqualViaAssertion {
  function assertOptionalEqualVia<Actual, Expected extends Actual>(
    actual: Option.Option<Actual>,
    expected: Option.Option<Expected>,
    via: (actualValue: Actual, expectedValue: Expected) => boolean,
    message?: string,
  ): boolean {
    return Option.match(Option.zipWith(actual, expected, via), {
      onNone: () => t.deepEqual(actual, expected, message),
      onSome: (result): boolean => t.assert(result, message),
    });
  }

  return assertOptionalEqualVia as T.AssertOptionalEqualViaAssertion;
}

export function makeEffectAssertions(t: ExecutionContext<unknown>): T.EffectAssertions {
  return {
    assertOptionalEqualVia: makeAssertOptionalEqualViaAssertion(t),
  };
}

export const makeTestEffect = <Services, Plugins>(
  deps: Layer.Layer<Services>,
  makePlugins: (t: ExecutionContext<T.TestEffectContext<Services>>) => Plugins,
) => makeTestEffectImpl(deps, (t) => Object.assign(makeEffectAssertions(t), makePlugins(t)));

function makeTestEffectImpl<Services, Plugins extends Record<string, unknown>>(
  deps: Layer.Layer<Services>,
  makePlugins: (t: ExecutionContext<T.TestEffectContext<Services>>) => Plugins,
) {
  const testFn = anyTest as TestFn<T.TestEffectContext<Services>>;

  testFn.before(async (t) => {
    const textContext: Context.Context<Services> = await Effect.runPromise(
      Layer.build(deps).pipe(Effect.orDie, Effect.scoped),
    );

    t.context[contextKeySymbol] = textContext;
  });

  return Object.assign(
    function testEffect(
      label: string,
      implementation: T.EffectImplementationFn<Services, Plugins>,
    ): void {
      return testEffectInternal(testFn, makePlugins, label, implementation);
    },
    {
      only: exposeModifier("only", makePlugins),
      failing: exposeModifier("failing", makePlugins),
      skip: exposeModifier("skip", makePlugins),
      serial: exposeModifier("serial", makePlugins),
      before: testFn.before,
      after: testFn.after,
    },
  );
}

function testEffectInternal<Services, Plugins, A>(
  testFn: (label: string, exec: Implementation<[], T.TestEffectContext<Services>>) => A,
  makePlugins: (t: ExecutionContext<T.TestEffectContext<Services>>) => Plugins,
  label: string,
  implementation: T.EffectImplementationFn<Services, Plugins>,
) {
  return testFn(label, (t) => {
    const plugins = makePlugins(t);

    const prog = implementation(Object.assign(t, plugins)).pipe(
      Effect.tapError((e) => {
        return Effect.sync(() => t.log(`Error happened during ${label} test execution`, e));
      }),
      Effect.provide(t.context[contextKeySymbol]),
      Logger.withMinimumLogLevel(LogLevel.Error),
      Effect.scoped,
      Effect.orDie,
    );

    return Effect.runPromise(prog);
  });
}

function exposeModifier<Services, Plugins, T extends Extract<keyof TestFn, T.AvaModifierWhitelist>>(
  modifier: T,
  makePlugins: (t: ExecutionContext<T.TestEffectContext<Services>>) => Plugins,
): T.EffectTest<Services, Plugins> {
  return (label: string, implementation: T.EffectImplementationFn<Services, Plugins>) =>
    testEffectInternal(
      (anyTest as TestFn<T.TestEffectContext<Services>>)[modifier],
      makePlugins,
      label,
      implementation,
    );
}
