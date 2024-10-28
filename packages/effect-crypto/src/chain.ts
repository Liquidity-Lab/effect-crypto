import { ConfigError, Context, Effect, Layer } from "effect";
import { Addressable, BaseWallet, Contract, ContractRunner, Interface, InterfaceAbi } from "ethers";
import { Tagged } from "type-fest";

import * as internal from "~/chain.internal.js";
import * as Error from "~/error.js";
import * as Signature from "~/signature.js";
import * as Token from "~/token.js";

export { ConfigTag, ChainTag as Tag, ChainTxTag as TxTag } from "~/chain.internal.js";

/**
 * ChainId is a type representing a chain id
 */
export type ChainId = Tagged<bigint, "ChainId">;

/**
 * Constructs a new ChainId
 * It also provides a set of known chain ids
 *
 * @example
 *   import { ChainId } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   const mainnet: ChainId = ChainId.MAINNET;
 *   const optimism: ChainId = ChainId.OPTIMISM;
 *   const arbitrumOne: ChainId = ChainId.ARBITRUM_ONE
 *
 *   const myCustomChain: ChainId = ChainId(123456789n);
 *
 *
 * @param id
 * @constructor
 */
export const ChainId: typeof internal.asChainId & typeof internal.knownChains = Object.assign(
  internal.asChainId,
  internal.knownChains,
);

/**
 * Creates a new layer with config from environment variables
 *
 * @param nativeToken
 * @returns A layer with config
 */
export const configFromEnv: (
  nativeToken: Token.NativeToken,
) => Layer.Layer<internal.ConfigTag, ConfigError.ConfigError> = internal.configFromEnv;

/**
 * Creates a new layer with config from environment variables
 */
export const chainLayer: () => Layer.Layer<internal.ChainTag, never, internal.ConfigTag> =
  internal.makeChainFromConfig;

/**
 * Get current chain id
 */
export const getChainId: {
  (): Effect.Effect<ChainId, never, internal.ChainTxTag>;
  (service: Context.Tag.Service<internal.ChainTxTag>): Effect.Effect<ChainId>;
} = internal.getChainId;

/**
 * Creates a new contract instance
 */
export const contractInstance: {
  (
    target: string | Addressable,
    abi: Interface | InterfaceAbi,
  ): Effect.Effect<Signature.ContractOps, never, internal.ChainTxTag>;
  (
    service: Context.Tag.Service<internal.ChainTxTag>,
    target: string | Addressable,
    abi: Interface | InterfaceAbi,
  ): Effect.Effect<Signature.ContractOps>;
} = internal.contractInstance;

/**
 * Connects a wallet to the chain
 */
export const connectWallet: {
  (wallet: BaseWallet): Effect.Effect<BaseWallet, never, internal.ChainTxTag>;
  (
    service: Context.Tag.Service<internal.ChainTxTag>,
    wallet: BaseWallet,
  ): Effect.Effect<BaseWallet>;
} = internal.connectWallet;

/**
 * Creates new contract ops
 */
export const contractOps: {
  (
    f: (runner: ContractRunner | null) => Contract,
  ): Effect.Effect<Signature.ContractOps, never, internal.ChainTxTag>;
  (
    service: Context.Tag.Service<internal.ChainTxTag>,
    f: (runner: ContractRunner | null) => Contract,
  ): Effect.Effect<Signature.ContractOps>;
} = internal.contractOps;

/**
 * Sends a request to the chain
 */
export const send: {
  (
    method: string,
    params: Array<unknown> | Record<string, unknown>,
  ): Effect.Effect<unknown, Error.BlockchainError, internal.ChainTxTag>;
  (
    service: Context.Tag.Service<internal.ChainTxTag>,
    method: string,
    params: Array<unknown> | Record<string, unknown>,
  ): Effect.Effect<unknown, Error.BlockchainError>;
} = internal.send;
