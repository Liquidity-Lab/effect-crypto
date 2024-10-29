import { Context, Effect } from "effect";
import { Contract, ContractRunner, FunctionFragment, Signer } from "ethers";

import * as internal from "~/signature.internal.js";

export { SignatureTxTag as TxTag } from "~/signature.internal.js";

/**
 * A wrapper for contract factory.
 * It's mostly used to prevent exposing of signer or provider
 */
export interface ContractOps {
  encodeFunctionData(fragment: FunctionFragment | string, values?: ReadonlyArray<unknown>): string;

  /**
   * Returns contract connected with provided runner.
   * Useful when you'd like to perform operations using wallet
   */
  connect(runner: ContractRunner): Contract;

  /**
   * Returns contract with default (onChain) runner
   */
  readonly withOnChainRunner: Contract;
}

/**
 * Creates a new ContractOps instance
 *
 * @param defaultProvider
 * @param f
 * @constructor
 */
export const ContractOps: (
  defaultProvider: ContractRunner,
  f: (runner: ContractRunner | null) => Contract,
) => ContractOps = internal.makeContractOps;

/**
 * Connects a contract to a signer
 *
 * @param ops
 * @returns An effect that resolves with the connected contract
 */
export const signed: {
  (ops: ContractOps): Effect.Effect<Contract, never, internal.SignatureTxTag>;
  (
    service: Context.Tag.Service<internal.SignatureTxTag>,
    ops: ContractOps,
  ): Effect.Effect<Contract, never, never>; // TODO: maybe we can somehow fallback to pure type
} = internal.signedContract;

/**
 * Provides a Signature.TxTag instance based on a Signer.
 *
 * @example
 *   import { Context, Effect, Layer } from "effect";
 *   import { Signature } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   const signer: Signer = ???;
 *   const effect: Effect.Effect<any, never, Signature.TxTag> = ???;
 *
 *   effect.pipe(Signature.signVia(signer));
 *
 * @param signer
 */
export const signVia: {
  <A, E, R>(
    fa: Effect.Effect<A, E, R | internal.SignatureTxTag>,
    signer: Signer,
  ): Effect.Effect<A, E, Exclude<R, internal.SignatureTxTag>>;
  (
    signer: Signer,
  ): <A, E, R>(
    fa: Effect.Effect<A, E, R | internal.SignatureTxTag>,
  ) => Effect.Effect<A, E, Exclude<R, internal.SignatureTxTag>>;
} = internal.signVia;
