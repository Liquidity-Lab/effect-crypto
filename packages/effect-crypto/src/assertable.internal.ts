import type * as Types from "effect/Types";
import { ReadonlyRecord } from "effect/Record";

import { Assertable, AssertableEntity } from "~/assertable.js";

export const assertableInstanceSymbol = Symbol(
  "com/liquidity_lab/crypto/blockchain/assertable#instance",
);

export const typeHintSymbol = Symbol("com/liquidity_lab/crypto/blockchain/assertable#typeHint");

export function makeAssertableEntity<A>(
  data: ReadonlyRecord<string, unknown>, // TODO: refine unknown to some plain type or Assertable type
): AssertableEntity<A> {
  const res = {
    ...data,
    [typeHintSymbol]: {
      _A: {} as Types.Covariant<A>,
    },
  };

  Object.defineProperty(res, typeHintSymbol, {
    enumerable: false,
    writable: false,
    configurable: false,
  });

  return res as AssertableEntity<A>;
}

export function asAssertableEntity<A extends Assertable>(a: A): AssertableEntity<A> {
  return a[assertableInstanceSymbol];
}
