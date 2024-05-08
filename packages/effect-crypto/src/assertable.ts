import type * as Types from "effect/Types";
import { ReadonlyRecord } from "effect/Record";

import * as internal from "~/assertable.internal.js";

/**
 * This is used as a key for Assertable instances within the entity
 */
export const instanceSymbol: typeof internal.assertableInstanceSymbol =
  internal.assertableInstanceSymbol;

/**
 * Extend this interface to allow the entity to be used with assert methods
 *
 * @example
 *   import { Assertable } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   class MyEntity implements Assertable {
 *     [Assertable.instanceSymbol]: AssertMe<MyEntity>;
 *   }
 */
export interface Assertable {
  readonly [internal.assertableInstanceSymbol]: AssertableEntity<this>;
}

/**
 * Converts an entity which implements Assertable interface to AssertableEntity
 */
export const asAssertableEntity: <A extends Assertable>(a: A) => AssertableEntity<A> =
  internal.asAssertableEntity;

export interface AssertableEntity<out A> {
  readonly _tag: "AssertableEntity";
  readonly [internal.typeHintSymbol]: {
    readonly _A: Types.Covariant<A>;
  };
}

/**
 * Creates new instance of AssertableEntity
 *
 * @example
 *   import Big from "bigdecimal.js";
 *   import { Assertable } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   class MyEntity implements Assertable {
 *     private readonly someValue: Big;
 *
 *     constructor(someValue: Big) {
 *       this.someValue = someValue;
 *     }
 *
 *     someMethod(): bigint {
 *       return this.someValue.asUnscaled;
 *     }
 *
 *     get [Assertable.instanceSymbol](): AssertableEntity<MyEntity> {
 *       // Only plain values are allowed in the entity
 *       return Assertable.AssertableEntity({
 *         someValue: this.someValue.asString
 *       });
 *     };
 *   }
 *
 *   const entity1: MyEntity = new MyEntity(Big(1));
 *   const entity2: MyEntity = new MyEntity(Big(2));
 *
 *   const boolean = deepEquals(
 *      Assertable.asAssertableEntity(entity1),
 *      Assertable.asAssertableEntity(entity2),
 *   );
 *
 * @constructor
 */
export const AssertableEntity: <A>(data: ReadonlyRecord<string, unknown>) => AssertableEntity<A> =
  internal.makeAssertableEntity;
