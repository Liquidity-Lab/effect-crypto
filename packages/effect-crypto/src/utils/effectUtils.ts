import { Array, Effect, Either, Option } from "effect";
import { LazyArg } from "effect/Function";
/**
 * @file packages/effect-crypto/src/utils/effectUtils.ts
 */
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

type ExtractValues<T extends readonly Either.Either<any, any>[]> = {
  [K in keyof T]: T[K] extends Either.Either<infer V, any> ? V : never;
};

type ExtractError<T extends readonly Either.Either<any, any>[]> =
  T[number] extends Either.Either<any, Array.NonEmptyArray<infer E>> ? E : never;

/**
 * Maps a tuple of Eithers to a single Either, collecting all errors if any Either is a Left.
 * If all Eithers are Right, it applies the function `f` to the collected values.
 * The error type for each Either in the input tuple must be `Array.NonEmptyArray<E>` and must be the same for all elements.
 * All collected errors are concatenated into a single `Array.NonEmptyArray<E>`.
 *
 * @example
 * import { Array, Either } from "effect";
 * import { EffectUtils } from "effect-crypto/utils";
 *
 * type MyError = string;
 * type ErrorType = Array.NonEmptyArray<MyError>;
 *
 * const a: Either.Either<number, ErrorType> = Either.right(1);
 * const b: Either.Either<string, ErrorType> = Either.left(Array.make("Error B"));
 * const c: Either.Either<boolean, ErrorType> = Either.left(Array.make("Error C1", "Error C2"));
 *
 * const result = EffectUtils.mapParN(
 *   [a, b, c],
 *   ([num, str, bool]) => `Number: ${num}, String: ${str}, Boolean: ${bool}`
 * );
 * // result will be Either.left(Array.make("Error B", "Error C1", "Error C2"))
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
 */
export const mapParN: {
  <
    T extends readonly [
      Either.Either<any, Array.NonEmptyArray<any>>,
      ...Either.Either<any, Array.NonEmptyArray<any>>[],
    ],
    A,
  >(
    eithers: T,
    f: (values: ExtractValues<T>) => A,
  ): Either.Either<A, Array.NonEmptyArray<ExtractError<T>>>;
} = internal.mapParNImpl;

export const eitherGen: <L, R>(
  leftGen: Arbitrary<L>,
  rightGen: Arbitrary<R>,
) => Arbitrary<Either.Either<R, L>> = internal.eitherGenImpl;
