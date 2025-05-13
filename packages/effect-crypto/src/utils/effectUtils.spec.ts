/**
 * @file packages/effect-crypto/src/utils/effectUtils.spec.ts
 */
import test, { type ExecutionContext } from "ava";
import { Array, Either } from "effect";

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

  const result = EffectUtils.mapParN([e1, e2, e3, e4], ([n, _s, b, _d]) => ({ n, b }));

  const expectedErrors = Array.make(myErr("error b"), myErr("error d1"), myErr("error d2"));
  t.deepEqual(result, Either.left(expectedErrors));
});

test("mapParN - should return Left with collected errors when all inputs are Left", (t: ExecutionContext) => {
  const myErr = (info: string): Adt.FatalError => Adt.FatalErrorString(info);

  const e1 = Either.left(Array.make(myErr("error a")));
  const e2 = Either.left(Array.make(myErr("error b1"), myErr("error b2")));

  const result = EffectUtils.mapParN([e1, e2], ([_a, _b]) => "should not reach here");

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

  const result = EffectUtils.mapParN([e1], ([_n]) => "should not reach here");
  t.deepEqual(result, Either.left(Array.make(error)));
});

test("mapParN - should return Right with mapped value for empty input tuple", (t: ExecutionContext) => {
  const result = EffectUtils.mapParN([], () => "empty result");
  t.deepEqual(result, Either.right("empty result"));
});

// Property-based tests removed
