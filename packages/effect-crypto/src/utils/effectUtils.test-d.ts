import { Array, Either, identity } from "effect";
import { assertType, expectTypeOf, test } from "vitest";

import * as EffectUtils from "./effectUtils.js";


type Entity = {
  a: number;
  b: string;
  c: boolean;
};

test("EffectUtils.mapParN should work ", () => {
  type ErrorType = Array.NonEmptyArray<string>;

  // This should typecheck: result is Either<Entity, ErrorType>
  const a: Either.Either<number, ErrorType> = Either.right(1);
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

  assertType<Either.Either<Entity, Array.NonEmptyArray<any>>>(
    // @ts-expect-error string[] is not assignable NonEmptyArray<string>
    EffectUtils.mapParN([a, b, c], ([a, b, c]) => ({ a, b, c }) as Entity),
  );
});

test("EffectUtils.mapParN should compile if the input's error type is correct NonEmptyArray", () => {
  const a = Either.right(1);
  const b = Either.left(Array.make("2"));
  const c = Either.right(true);

  assertType<Either.Either<Entity, Array.NonEmptyArray<string>>>(
    EffectUtils.mapParN([a, b, c], ([a, b, c]) => ({ a, b, c }) as Entity),
  );
});

test("EffectUtils.mapParN should not compile if the input's error types is not aligned", () => {
  const a = Either.left(Array.make(false));
  const b = Either.left(Array.make("2"));
  const c = Either.right(true);

  assertType<Either.Either<Entity, Array.NonEmptyArray<string | boolean>>>(
    EffectUtils.mapParN([a, b, c], ([a, b, c]) => ({ a, b, c }) as Entity),
  );
});

test("EffectUtils.mapParN should work for complex types", () => {
  interface Entity {
    readonly name: string;
    readonly age: number;
  }

  interface ComplexError<Field extends keyof Entity | "calculation" | "validation"> {
    readonly _tag: "ComplexError";

    readonly field: Field;
    readonly message: string;
  }

  function ComplexError<Field extends keyof Entity | "calculation" | "validation">(
    field: Field,
    message: string,
  ): ComplexError<Field> {
    return {
      _tag: "ComplexError",
      field,
      message,
    };
  }

  interface Builder {
    readonly name: Either.Either<string, Array.NonEmptyArray<ComplexError<"name">>>;
    readonly age: Either.Either<number, Array.NonEmptyArray<ComplexError<"age">>>;
  }

  function validate(
    name: string,
    age: number,
  ): Either.Either<Entity, Array.NonEmptyArray<ComplexError<any>>> {
    return Either.left(
      Array.make(
        ComplexError("name", `Name is required, provided: ${name}`),
        ComplexError("age", `Age is required, provided: ${age}`),
      ),
    );
  }

  const builder: Builder = null as any;

  assertType<Either.Either<Entity, Array.NonEmptyArray<ComplexError<any>>>>(
    EffectUtils.mapParN([builder.name, builder.age], ([name, age]) => ({ name, age }) as Entity),
  );

  assertType<Either.Either<Entity, Array.NonEmptyArray<ComplexError<any>>>>(
    EffectUtils.mapParN([builder.name, builder.age], ([name, age]) => validate(name, age)).pipe(
      Either.flatMap(identity),
    ),
  );
});

test("EffectUtils.mapParN should not compile for empty input tuple", () => {
  // @ts-expect-error mapParN requires at least one Either in the tuple
  expectTypeOf(EffectUtils.mapParN([], () => "empty result")).toBeAny();
});
