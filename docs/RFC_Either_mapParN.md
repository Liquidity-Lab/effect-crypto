I'd like to introduce a new function `Either.mapParN`, allowing following pattern:

```typescript
import { Array, Either } from "effect";
import { EffectUtils } from "effect-crypto/utils";

// Error type is required to be non empty array
type ErrorType = Array.NonEmptyArray<string>;

// This is going to be first value
declare const a: Either.Either<number, ErrorType>;
// This is going to be second value
declare const b: Either.Either<string, ErrorType>;
// This is going to be third value
type Person = { name: string }
declare const c: Either.Either<Person, ErrorType>;

const result = EffectUtils.mapParN(
  // The first argument is a tuple of Eithers:
  // each of them should share the same error type and it is crusial
  // that this error type is non empty array of something (generic)
  [a, b, c],
  // The second argument is a function that takes a tuple of values and returns any other value.
  // Type of the value inside the tuple is defined by the type of the values inside the first argument
  ([a, b, c]: [number, string, Person]) => ({
    a,
    b,
    c,
  })
);

result
// ^? Either.Either<{ a: number; b: string; c: Person }, ErrorType>
```

## Motivation

Current implementation of `Either.all` implemented is terms of fail-fast, but I'd like to collect all errors instead. For example:

```typescript
import { Either, Array } from "effect";
import { EffectUtils } from "effect-crypto/utils";

const a: Either.Either<number, Array.NonEmptyArray<string>> = Either.left(Array.make("Some Error for A"));
//    ^? Either.Left<Array.NonEmptyArray<string>, never>
const b: Either.Either<number, Array.NonEmptyArray<string>> = Either.left(Array.make("Some Error for B"));
//    ^? Either.Left<Array.NonEmptyArray<string>, never>
const c: Either.Either<number, number> = Either.right(123);
//    ^? Either.Right<never, number>

const resultOfParMapN = EffectUtils.mapParN([a, b, c], ([a, b, c]) => a + b + c);
//     ^? Either.Left<Array.NonEmptyArray<string>, never>
// resultOfParMapN is equivalent to Either.left(Array.make("Some Error for A", "Some Error for B"))

const resultForAll = Either.all([a, b, c]).pipe(Either.map(([a, b, c]) => a + b + c));
//     ^? Either.Left<Array.NonEmptyArray<string>, number>
// resultForAll is equivalent to Either.left(Array.make("Some Error for A"))
```

It should be quite obvious at this point that sometimes it is preffered to collect all errors instead of failing fast.

## Implementation Plan

1. Add definitions of `mapParN` to `effect-crypto/utils/effectUtils.ts` module: it should be able to work with generic tuples (any size) and function that accepts such tuples and returns some other value. The error type should always be like `Array.NonEmptyArray<E>`, E -- can be same accross all tuple elements. Use `null as any` as a placeholder (we don't have exact implementation at this point ). PLEASE RESPECT CODE GUIDELINES @.cursor/rules/effect-crypto.mdc. Create placeholder like:
```typescript
const mapParN: {
  // Type definition
} = null as any;
```
2. Compile the project. It should successfully compile. Fix codestyle and lint issues.
3. Add tests for the `mapParN` function to `effect-crypto/test/effectUtils.spec.ts` file. Use @effect-crypto/utils/avaEffect.spec.ts and @effect-crypto/utils/bigMath.spec.ts as examples. Add static tests. Mark tests as expecting to fail (using `test.failing`)
4. Compile the project. It should successfully compile. Fix codestyle and lint issues. Run tests
5. Implement `mapParN` function within `effect-crypto/utils/effectUtils.internal.ts` file. Remove '.failing` mark from tests.
6. Compile the project. It should successfully compile. Fix codestyle and lint issues. Run tests, all test should be green
7. Add generator for either values as a parto of @effect-crypto/utils/effectUtils.ts module. It should accept generator for left and right values (respecting project styleguides)
8. Add property based tests for the `mapParN` function using generator from step 7: generate random tuples of either values and check if `mapParN` returns right if all values are right and returns left if at least one value is left.
9. Consider task completion criteria