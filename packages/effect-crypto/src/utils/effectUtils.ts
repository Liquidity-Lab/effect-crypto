import { Array, Effect, Either, Option } from "effect";
import { LazyArg } from "effect/Function";

// TODO: circular dependency utils on effect-crypto and forth
import * as Adt from "../adt.js";
import * as internal from "./effectUtils.internal.js";

// Import internal

export function getOrFail<A, E>(fa: Option.Option<A>, onNone: LazyArg<E>): Effect.Effect<A, E> {
  return Option.match(fa, {
    onSome: (a) => Effect.succeed(a),
    onNone: () => Effect.fail(onNone()),
  });
}

export function getOrFailSimpleEither<A>(
  fa: Either.Either<A, unknown>,
): Effect.Effect<A, Adt.FatalError> {
  return Either.match(fa, {
    onLeft: (cause) => Effect.fail(Adt.FatalErrorUnknown(cause)),
    onRight: (a) => Effect.succeed(a),
  });
}

export function getOrFailEither<A, E>(fa: Either.Either<A, E>): Effect.Effect<A, E> {
  return Either.match(fa, {
    onLeft: (cause) => Effect.fail(cause),
    onRight: (a) => Effect.succeed(a),
  });
}

export function getOrDieEither<A>(fa: Either.Either<A, unknown>): Effect.Effect<A> {
  return Either.match(fa, {
    onLeft: (cause) => Effect.die(cause),
    onRight: (a) => Effect.succeed(a),
  });
}

/**
 * Maps a tuple of Eithers to a single Either, collecting all errors if any Either is a Left.
 * If all Eithers are Right, it applies the function `f` to the collected values.
 * The error type for each Either in the input tuple must be `Array.NonEmptyArray<E>`.
 * All collected errors are concatenated into a single `Array.NonEmptyArray<E>`.
 *
 * @example
 * ```typescript
 * import { Array, Either } from "effect";
 * import { EffectUtils } from "effect-crypto/utils"; // Assuming this path
 *
 * type MyError = string;
 * type ErrorType = Array.NonEmptyArray<MyError>;
 *
 * const a: Either.Either<number, ErrorType> = Either.right(1);
 * const b: Either.Either<string, ErrorType> = Either.left(Array.make("Error B") as ErrorType);
 * const c: Either.Either<boolean, ErrorType> = Either.left(Array.make("Error C1", "Error C2") as ErrorType);
 *
 * const result = EffectUtils.mapParN(
 *   [a, b, c] as const, // Use 'as const' for precise tuple typing if needed
 *   ([num, str, bool]) => `Number: ${num}, String: ${str}, Boolean: ${bool}`
 * );
 * // result will be Either.left(Array.make("Error B", "Error C1", "Error C2") as ErrorType)
 *
 * const allGoodInput: [Either.Either<number, ErrorType>, Either.Either<string, ErrorType>] = [
 *  Either.right(10),
 *  Either.right("hello")
 * ];
 * const allGood = EffectUtils.mapParN(
 *  allGoodInput,
 *  ([n, s]) => ({ n, s })
 * );
 * // allGood will be Either.right({ n: 10, s: "hello" })
 * ```
 * @template Values - A readonly array of types representing the success values of the input Eithers.
 * @template E - The type of the individual error elements.
 * @template R - The return type of the mapping function `f`.
 * @param eithers - A tuple of Eithers.
 * @param f - A function to apply to the collected success values if all Eithers are Right.
 * @returns An Either containing the result of `f` or a non-empty array of collected errors.
 */
export const mapParN: {
  <Values extends ReadonlyArray<any>, E, R>(
    eithers: readonly [
      ...{ [K in keyof Values]: Either.Either<Values[K], Array.NonEmptyArray<E>> },
    ],
    f: (values: [...Values]) => R,
  ): Either.Either<R, Array.NonEmptyArray<E>>;
} = internal.mapParNImpl;

/**
 * Generates an Either value using the provided generators for left and right values.
 *
 * @example
 *   import { fc } from "@fast-check/ava";
 *   import { EffectUtils } from "effect-crypto/utils";
 *   import { Either } from "effect";
 *
 *   const leftGen = fc.string();
 *   const rightGen = fc.integer();
 *   const eitherArb = EffectUtils.eitherGen(leftGen, rightGen);
 *
 *   fc.assert(
 *     eitherArb.map(e => Either.isLeft(e) || Either.isRight(e))
 *   );
 *
 * @param leftGen - Arbitrary for left values
 * @param rightGen - Arbitrary for right values
 * @returns Arbitrary<Either.Right<R> | Either.Left<L>>
 */
import type { Arbitrary } from "fast-check";
export const eitherGen: <L, R>(
  leftGen: Arbitrary<L>,
  rightGen: Arbitrary<R>
) => Arbitrary<Either.Either<R, L>> = internal.eitherGenImpl;
