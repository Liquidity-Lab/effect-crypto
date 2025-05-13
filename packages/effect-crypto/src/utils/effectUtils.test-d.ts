import { expectTypeOf, assertType, test } from 'vitest';
import { Array, Either } from "effect";
import * as EffectUtils from "./effectUtils.js";

declare type ErrorType = Array.NonEmptyArray<string>;

type Entity = {
  a: number;
  b: string;
  c: boolean;
}

test("EffectUtils.mapParN should work ", () => {
  // This should typecheck: result is Either<Entity, ErrorType>
  const a = Either.right(1);
  const b = Either.right("2");
  const c = Either.right(true);

  assertType<Either.Either<Entity, ErrorType>>(
    EffectUtils.mapParN([a, b, c], ([a, b, c]) => ({ a, b, c } as Entity))
  );
});
