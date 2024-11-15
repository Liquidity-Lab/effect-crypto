import { Effect } from "effect";
import { Tagged } from "type-fest";

import { Address, Error, Token } from "@liquidity_lab/effect-crypto";

import * as Adt from "~/adt.js";
import * as internal from "~/pool.internal.js";

export { PoolTxTag as TxTag } from "~/pool.internal.js";

/**
 * Slot0 represents the first slot of the pool state.
 */
export interface Slot0 {
  readonly price: Token.AnyTokenPrice;
  readonly tick: Adt.Tick;
  readonly observationIndex: string;
}

/**
 * Pool represents an Uniswap V3 pool.
 */
export interface Pool {
  readonly token0: Token.AnyToken;
  readonly token1: Token.AnyToken;
  readonly fee: Adt.FeeAmount;

  readonly address: PoolAddress;
}

/**
 * PoolAddress is a tagged type that represents a pool address.
 */
export type PoolAddress = Tagged<string, "POOL_ADDRESS">;

/**
 * Gets a new pool instance for the given tokens and fee.
 *
 * @param tokenA The first token of the pool.
 * @param tokenB The second token of the pool.
 * @param fee The fee amount of the pool.
 * @returns An effect that resolves with the pool.
 */
export const fetch: {
  (
    tokenA: Token.AnyToken,
    tokenB: Token.AnyToken,
    fee: Adt.FeeAmount,
  ): Effect.Effect<Pool, Error.BlockchainError, internal.PoolTxTag>;
} = null as any;//internal.fetchPool;

/**
 * Creates and initializes a new pool if necessary.
 */
export const initialize: {
  (
    price: Token.AnyTokenPrice,
    fee: Adt.FeeAmount,
  ): Effect.Effect<Pool, Error.BlockchainError, internal.PoolTxTag>;
} = null as any;//internal.createAndInitializePoolIfNecessary;

/**
 * Fetches slot0 data from the given pool.
 */
export const slot0: {
  (pool: Pool): Effect.Effect<Slot0, Error.BlockchainError, internal.PoolTxTag>;
} = null as any;//internal.fetchSlot0;

export type PoolFactoryContractAddress = Tagged<string, "POOL_FACTORY_CONTRACT_ADDRESS">;
export type PoolInitializerAddress = Tagged<Address, "POOL_INITIALIZER_ADDRESS">;

export interface PoolConfig {
  readonly factoryAddress: PoolFactoryContractAddress;
}
