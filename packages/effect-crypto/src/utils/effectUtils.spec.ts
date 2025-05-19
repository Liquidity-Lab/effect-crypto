/**
 * @file packages/effect-crypto/src/utils/effectUtils.spec.ts
 */
import test, { type ExecutionContext } from "ava";
import { Array, Either } from "effect";

import { fc, testProp } from "@fast-check/ava";

import * as Adt from "../adt.js";
import * as EffectUtils from "./effectUtils.js";

// Test suite for mapParN
test("mapParN - should return Right with mapped values when all inputs are Right", (t: ExecutionContext) => {
  const e1 = Either.right(1);
  const e2 = Either.right("hello");
  const e3 = Either.right(true);

  const result = EffectUtils.mapParN([e1, e2, e3], ([n, s, b]) => ({ n, s, b }));

  t.deepEqual(result, Either.right({ n: 1, s: "hello", b: true }));
});

test("mapParN - should return Left with collected errors when some inputs are Left", (t: ExecutionContext) => {
  const myErr = (info: string): Adt.FatalError => Adt.FatalErrorString(info);

  const e1 = Either.right(1);
  const e2 = Either.left(Array.make(myErr("error b")));
  const e3 = Either.right(true);
  const e4 = Either.left(Array.make(myErr("error d1"), myErr("error d2")));

  const result = EffectUtils.mapParN([e1, e2, e3, e4], ([n, , b]) => ({ n, b }));

  const expectedErrors = Array.make(myErr("error b"), myErr("error d1"), myErr("error d2"));
  t.deepEqual(result, Either.left(expectedErrors));
});

test("mapParN - should return Left with collected errors when all inputs are Left", (t: ExecutionContext) => {
  const myErr = (info: string): Adt.FatalError => Adt.FatalErrorString(info);

  const e1 = Either.left(Array.make(myErr("error a")));
  const e2 = Either.left(Array.make(myErr("error b1"), myErr("error b2")));

  const result = EffectUtils.mapParN([e1, e2], () => "should not reach here");

  const expectedErrors = Array.make(myErr("error a"), myErr("error b1"), myErr("error b2"));
  t.deepEqual(result, Either.left(expectedErrors));
});

test("mapParN - should work with a single Either (Right case)", (t: ExecutionContext) => {
  const e1 = Either.right(42);
  const result = EffectUtils.mapParN([e1], ([n]) => n * 2);
  t.deepEqual(result, Either.right(84));
});

test("mapParN - should work with a single Either (Left case)", (t: ExecutionContext) => {
  const myErr = (info: string): Adt.FatalError => Adt.FatalErrorString(info);
  const error = myErr("single error");
  const e1 = Either.left(Array.make(error));

  const result = EffectUtils.mapParN([e1], () => "should not reach here");
  t.deepEqual(result, Either.left(Array.make(error)));
});

// Property-based tests for mapParN using eitherGen

testProp(
  "mapParN (property) - tuple size 1: should return same Either as input",
  [
    EffectUtils.eitherGen(
      fc.tuple(fc.string()).map((arr) => arr as Array.NonEmptyArray<string>),
      fc.integer(),
    ),
  ],
  (t, input) => {
    const result = EffectUtils.mapParN([input], ([x]) => x);

    t.deepEqual(result, input);
  },
);

testProp(
  "mapParN (property) - tuple size 3: returns Right if all are Right, Left with all errors if any Left",
  [
    fc.tuple(
      EffectUtils.eitherGen(
        fc.tuple(fc.string()).map((arr) => arr as Array.NonEmptyArray<string>),
        fc.integer(),
      ),
      EffectUtils.eitherGen(
        fc.tuple(fc.string()).map((arr) => arr as Array.NonEmptyArray<string>),
        fc.integer(),
      ),
      EffectUtils.eitherGen(
        fc.tuple(fc.string()).map((arr) => arr as Array.NonEmptyArray<string>),
        fc.integer(),
      ),
    ),
  ],
  (t, [a, b, c]) => {
    const result = EffectUtils.mapParN([a, b, c], ([a, b, c]) => [a, b, c]);

    if (Either.isRight(a) && Either.isRight(b) && Either.isRight(c)) {
      t.deepEqual(result, Either.all([a, b, c]), "result should be Right if all inputs are Right");
    } else {
      t.true(Either.isLeft(result), "result should be Left if any input is Left");
    }
  },
);

// --- flatMapParN tests ---

test("flatMapParN - should return Right with mapped value when all inputs are Right and f returns Right", (t: ExecutionContext) => {
  const e1 = Either.right(1);
  const e2 = Either.right("hello");
  const f = (n: number, s: string) => Either.right({ n, s });
  const result = EffectUtils.flatMapParN([e1, e2], f);

  t.deepEqual(result, Either.right({ n: 1, s: "hello" }));
});

test("flatMapParN - should return Left with collected errors when some inputs are Left", (t: ExecutionContext) => {
  const myErr = (info: string): Adt.FatalError => Adt.FatalErrorString(info);
  const e1 = Either.right(1);
  const e2 = Either.left(Array.make(myErr("error b")));
  const e3 = Either.left(Array.make(myErr("error c")));
  const f = () => Either.right({});
  const result = EffectUtils.flatMapParN([e1, e2, e3], f);

  t.deepEqual(result, Either.left(Array.make(myErr("error b"), myErr("error c"))));
});

test("flatMapParN - should return Left with collected errors when all inputs are Left", (t: ExecutionContext) => {
  const myErr = (info: string): Adt.FatalError => Adt.FatalErrorString(info);
  const e1 = Either.left(Array.make(myErr("error a")));
  const e2 = Either.left(Array.make(myErr("error b")));
  const f = () => Either.right({});
  const result = EffectUtils.flatMapParN([e1, e2], f);

  t.deepEqual(result, Either.left(Array.make(myErr("error a"), myErr("error b"))));
});

test("flatMapParN - should return Left if f returns Left (all inputs Right)", (t: ExecutionContext) => {
  const e1 = Either.right(1);
  const e2 = Either.right("hello");
  const f = () => Either.left(Array.make("error_f"));
  const result = EffectUtils.flatMapParN([e1, e2], f);

  t.deepEqual(result, Either.left(Array.make("error_f")));
});

test("flatMapParN - should work with a single Either (Right case, f returns Right)", (t: ExecutionContext) => {
  const e1 = Either.right(42);
  const f = (n: number) => Either.right(n * 2);
  const result = EffectUtils.flatMapParN([e1], f);
  t.deepEqual(result, Either.right(84));
});

test("flatMapParN - should work with a single Either (Right case, f returns Left)", (t: ExecutionContext) => {
  const e1 = Either.right(42);
  const f = () => Either.left(Array.make("error_f"));
  const result = EffectUtils.flatMapParN([e1], f);

  t.deepEqual(result, Either.left(Array.make("error_f")));
});

test("flatMapParN - should work with a single Either (Left case)", (t: ExecutionContext) => {
  const e1 = Either.left(Array.make("error_e1"));
  const f = () => Either.right("should not reach here");
  const result = EffectUtils.flatMapParN([e1], f);

  t.deepEqual(result, Either.left(Array.make("error_e1")));
});

// Property-based test: if any input is Left, result is Left; if all Right, result is f(...values)
testProp(
  "flatMapParN (property) - tuple size 2: returns f result if all Right, else collects errors",
  [
    EffectUtils.eitherGen(
      fc.tuple(fc.string()).map((arr) => arr as Array.NonEmptyArray<string>),
      fc.integer(),
    ),
    EffectUtils.eitherGen(
      fc.tuple(fc.string()).map((arr) => arr as Array.NonEmptyArray<string>),
      fc.string(),
    ),
    fc.boolean(),
  ],
  (t, a, b, shouldFail) => {
    const f = (n: number, s: string) =>
      shouldFail ? Either.left(Array.make("error_f")) : Either.right([n, s]);
    const result = EffectUtils.flatMapParN([a, b], f);
    if (Either.isRight(a) && Either.isRight(b)) {
      if (shouldFail) {
        t.deepEqual(result, Either.left(Array.make("error_f")));
      } else {
        t.deepEqual(result, Either.right([a.right, b.right]));
      }
    } else {
      t.true(Either.isLeft(result));
    }
  },
);
