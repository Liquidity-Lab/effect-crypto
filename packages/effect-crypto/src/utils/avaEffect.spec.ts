import { Effect, Option } from "effect";

import * as AvaEffect from "~/utils/avaEffect.js";

const test = AvaEffect.testAnyEffect;

test("Should properly handle Option", (t) => {
  return Effect.sync(() => {
    const someValue = Option.some({ value: 1 });
    const sameValue = Option.some({ value: 1 });
    const noneValue = Option.none();

    t.assertOptionalEqualVia(someValue, sameValue, t.deepEqual, "Expected values to be equal");
    t.assertOptionalEqualVia(Option.none(), noneValue, t.deepEqual, "Expected None's to be equal");
  });
});

test.failing("Should fail Some vs None", (t) => {
  return Effect.sync(() => {
    const someValue = Option.some({ value: 1 });
    const noneValue = Option.none();

    t.assertOptionalEqualVia(someValue, noneValue, t.deepEqual, "Expected values to be equal");
  });
});

test.failing("Should fail since values are not equal", (t) => {
  return Effect.sync(() => {
    const someValue = Option.some({ value: 1 });
    const otherValue = Option.some({ value: 2 });

    t.assertOptionalEqualVia(someValue, otherValue, t.deepEqual, "Expected values to be equal");
  });
});
