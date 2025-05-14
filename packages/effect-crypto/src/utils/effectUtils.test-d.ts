import { Array, Either } from "effect";
import { assertType, test } from "vitest";

import * as EffectUtils from "./effectUtils.js";

declare type ErrorType = Array.NonEmptyArray<string>;

type Entity = {
  a: number;
  b: string;
  c: boolean;
};

test("EffectUtils.mapParN should work ", () => {
  // This should typecheck: result is Either<Entity, ErrorType>
  const a = Either.right(1);
  const b = Either.right("2");
  const c = Either.right(true);

  assertType<Either.Either<Entity, ErrorType>>(
    EffectUtils.mapParN([a, b, c], ([a, b, c]) => ({ a, b, c }) as Entity),
  );
});

test("EffectUtils.mapParN should not compile if the input's error type is not a NonEmptyArray", () => {
  const a: Either.Either<number, string[]> = Either.right(1);
  const b: Either.Either<string, string[]> = Either.left(["2"]);
  const c: Either.Either<boolean, string[]> = Either.right(true);

  assertType<Either.Either<Entity, ErrorType>>(
    // @ts-expect-error string[] is not assignable NonEmptyArray<string>
    EffectUtils.mapParN([a, b, c], ([a, b, c]) => ({ a, b, c }) as Entity),
  );
});

test("EffectUtils.mapParN should compile if the input's error type is correct NonEmptyArray", () => {
  const a = Either.right(1);
  const b = Either.left(Array.make("2"));
  const c = Either.right(true);

  assertType<Either.Either<Entity, ErrorType>>(
    EffectUtils.mapParN([a, b, c], ([a, b, c]) => ({ a, b, c }) as Entity),
  );
});


test("EffectUtils.mapParN should not compile if the input's error types is not aligned", () => {
  const a = Either.left(Array.make(false));
  const b = Either.left(Array.make("2"));
  const c = Either.right(true);

  assertType<Either.Either<Entity, ErrorType>>(
    // @ts-expect-error error types should be aligned
    EffectUtils.mapParN([a, b, c], ([a, b, c]) => ({ a, b, c }) as Entity),
  );
});
