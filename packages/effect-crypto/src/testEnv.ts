import { Context, Effect, Layer } from "effect";
import { Signer } from "ethers";

import * as Adt from "~/adt.js";
import * as Error from "~/error.js";
import * as internal from "~/testEnv.internal.js";

export { TestEnvTxTag as TxTag } from "~/testEnv.internal.js";
export { TestEnvTag as Tag } from "~/testEnv.internal.js";

export const setBalance: {
  (
    address: Adt.Address,
    balance: bigint,
  ): Effect.Effect<void, Error.BlockchainError, internal.TestEnvTxTag>;
  (
    service: Context.Tag.Service<internal.TestEnvTxTag>,
    address: Adt.Address,
    balance: bigint,
  ): Effect.Effect<void, Error.BlockchainError, internal.TestEnvTxTag>;
} = internal.setBalance;

/**
 * Adds nonce management to the signer
 */
export const withNonceManagement: {
  (signer: Signer): Effect.Effect<Signer, never, internal.TestEnvTxTag>;
  (service: Context.Tag.Service<internal.TestEnvTxTag>, signer: Signer): Effect.Effect<Signer>;
} = internal.withNonceManagement;

/**
 * Creates a new layer with TestEnv instance
 *
 * @example
 *   import { Context, Effect, Layer } from "effect";
 *   import { TestEnv } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   const testEnv: Context.Tag.Service<TestEnv.Tag> = ???;
 *   const effect: Effect.Effect<any, never, TestEnv.TxTag> = ???;
 *   const prog: Effect.Effect<any, never, Chain.TxTag> = TestEvn.transact(effect);
 */
export const testEnvLayer: () => Layer.Layer<internal.TestEnvTag> = internal.testEnvLayer;
