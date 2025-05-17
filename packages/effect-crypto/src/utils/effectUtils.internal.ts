/**
 * @file packages/effect-crypto/src/utils/effectUtils.internal.ts
 */
import * as fc from "fast-check";
import { Array, Either } from "effect";
import type { Arbitrary } from "fast-check";

export const mapParNImpl = <
  T extends readonly [
    Either.Either<any, Array.NonEmptyArray<any>>,
    ...Either.Either<any, Array.NonEmptyArray<any>>[],
  ],
  R,
>(
  eithers: T,
  f: (values: { [K in keyof T]: T[K] extends Either.Either<infer V, any> ? V : never }) => R,
): Either.Either<
  R,
  Array.NonEmptyArray<
    T[number] extends Either.Either<any, Array.NonEmptyArray<infer E>> ? E : never
  >
> => {
  let collectedErrors: Array<Array.NonEmptyArray<any>> | undefined = undefined;
  const collectedValues: Array<any> = [];
  let hasError = false;
  // TODO: rewrite using reduce
  for (const either of eithers) {
    if (Either.isLeft(either)) {
      hasError = true;
      if (!collectedErrors) {
        collectedErrors = Array.make(either.left);
      } else {
        collectedErrors = Array.append(collectedErrors, either.left);
      }
    } else if (!hasError) {
      collectedValues.push(either.right);
    }
  }

  if (hasError && collectedErrors) {
    const allErrors = Array.flatten(collectedErrors);
    return Either.left(allErrors as Array.NonEmptyArray<any>);
  }

  return Either.right(
    f(collectedValues as { [K in keyof T]: T[K] extends Either.Either<infer V, any> ? V : never }),
  );
};

/**
 * Generates an Either value using the provided generators for left and right values.
 *
 * @param leftGen - Arbitrary for left values
 * @param rightGen - Arbitrary for right values
 * @returns Arbitrary<Either.Right<R> | Either.Left<L>>
 */
export function eitherGenImpl<L, R>(
  leftGen: Arbitrary<L>,
  rightGen: Arbitrary<R>,
): Arbitrary<Either.Either<R, L>> {
  return fc.oneof(
    leftGen.map((l) => Either.left<L>(l)),
    rightGen.map((r) => Either.right<R>(r)),
  );
}
