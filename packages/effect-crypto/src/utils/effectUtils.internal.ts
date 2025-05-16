/**
 * @file packages/effect-crypto/src/utils/effectUtils.internal.ts
 */
import * as fc from "fast-check";
import { Array, Either } from "effect";
import type { Arbitrary } from "fast-check";

export const mapParNImpl = <Values extends ReadonlyArray<any>, E, R>(
  eithers: readonly [...{ [K in keyof Values]: Either.Either<Values[K], Array.NonEmptyArray<E>> }],
  f: (values: [...Values]) => R,
): Either.Either<R, Array.NonEmptyArray<E>> => {
  if (eithers.length === 0) {
    return Either.right(f([] as any)); // Call f with empty array for empty tuple input
  }

  let collectedErrors: Array<Array.NonEmptyArray<E>> | undefined = undefined;
  const collectedValues: Array<any> = []; // Will be cast to Values
  let hasError = false;

  for (const either of eithers) {
    if (Either.isLeft(either)) {
      hasError = true;
      if (!collectedErrors) {
        collectedErrors = Array.make(either.left);
      } else {
        collectedErrors = Array.append(collectedErrors, either.left);
      }
    } else if (!hasError) {
      // Only collect values if no error has been encountered yet,
      // as they won't be used if there's any error.
      collectedValues.push(either.right);
    }
  }

  if (hasError && collectedErrors) {
    // We have at least one NonEmptyArray of errors in collectedErrors
    const allErrors = Array.flatten(collectedErrors);
    // Since collectedErrors contains at least one NonEmptyArray, allErrors will also be non-empty.
    return Either.left(allErrors as Array.NonEmptyArray<E>);
  }

  // No errors, all were Right
  return Either.right(f(collectedValues as unknown as [...Values]));
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
