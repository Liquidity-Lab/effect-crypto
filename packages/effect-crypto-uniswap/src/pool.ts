import { Brand, Context, Effect, Layer, Option } from "effect";
import { Contract } from "ethers";
import { Tagged } from "type-fest";

import { Address, Chain, Error, FatalError, Token, Wallet } from "@liquidity_lab/effect-crypto";
import { FunctionUtils } from "@liquidity_lab/effect-crypto/utils";

import * as Adt from "./adt.js";
import * as internal from "./pool.internal.js";

export { PoolsTag as Tag } from "./pool.internal.js";

export interface PoolsDescriptor {
  readonly poolInitializerAddress: PoolInitializerAddress;
  readonly poolFactoryAddress: PoolFactoryAddress;
  readonly swapRouterAddress: SwapRouterAddress;
}

export const poolsLayer: (descriptor: PoolsDescriptor) => Layer.Layer<internal.PoolsTag> =
  internal.makePoolsFromDescriptor;

/**
 * Slot0Price represents only the price and tick of the pool state
 */
export interface Slot0Price {
  readonly price: Token.AnyTokenPrice;
  readonly tick: Adt.Tick;
}

/**
 * Slot0 represents the first slot of the pool state.
 */
export interface Slot0 extends Slot0Price {
  readonly observationIndex: string;
}

/**
 * Pool represents an Uniswap V3 pool.
 */
export interface PoolState {
  readonly token0: Token.AnyToken;
  readonly token1: Token.AnyToken;
  readonly fee: Adt.FeeAmount;

  readonly address: Address;
}

/**
 * PoolAddress is a tagged type that represents a pool address.
 */
export type PoolAddress = Tagged<string, "POOL_ADDRESS">; // TODO: remove this?

/**
 * Gets a new pool instance for the given tokens and fee.
 *
 * @param tokenA The first token of the pool.
 * @param tokenB The second token of the pool.
 * @param fee The fee amount of the pool.
 * @returns An effect that resolves with the pool.
 */
export const fetchState: {
  (
    tokenA: Token.AnyToken,
    tokenB: Token.AnyToken,
    fee: Adt.FeeAmount,
  ): Effect.Effect<
    Option.Option<PoolState>,
    FatalError | Error.BlockchainError,
    internal.PoolsTag | Chain.Tag
  >;
  (
    pool: Context.Tag.Service<internal.PoolsTag>,
    tokenA: Token.AnyToken,
    tokenB: Token.AnyToken,
    fee: Adt.FeeAmount,
  ): Effect.Effect<Option.Option<PoolState>, FatalError | Error.BlockchainError, Chain.Tag>;
} = FunctionUtils.withOptionalServiceApi(internal.PoolsTag, internal.fetchPoolStateImpl).value;

/**
 * Creates and initializes a new pool if necessary.
 */
export const createAndInitialize: {
  (
    price: Token.AnyTokenPrice,
    fee: Adt.FeeAmount,
  ): Effect.Effect<
    Option.Option<Slot0Price>,
    Error.BlockchainError | Error.TransactionFailedError | FatalError,
    Wallet.Tag | internal.PoolsTag
  >;

  (
    pool: Context.Tag.Service<internal.PoolsTag>,
    price: Token.AnyTokenPrice,
    fee: Adt.FeeAmount,
  ): Effect.Effect<
    Option.Option<Slot0Price>,
    Error.BlockchainError | Error.TransactionFailedError | FatalError,
    Wallet.Tag
  >;
} = internal.createAndInitializePoolIfNecessary;

export type PoolInitializerAddress = Brand.Branded<Address, internal.PoolInitializerAddressSymbol>;
export const PoolInitializerAddress = internal.makePoolInitializerAddress;

export type PoolInitializerContract = Brand.Branded<
  Contract,
  internal.PoolInitializerContractSymbol
>;
export const PoolInitializerContract = internal.makePoolInitializerContract;

export type PoolFactoryAddress = Brand.Branded<Address, internal.PoolFactoryAddressSymbol>;
export const PoolFactoryAddress = internal.makePoolFactoryAddress;

export type PoolFactoryContract = Brand.Branded<Contract, internal.PoolFactoryContractSymbol>;
export const PoolFactoryContract = internal.makePoolFactoryContract;

export type SwapRouterAddress = Brand.Branded<Address, internal.SwapRouterAddressSymbol>;
export const SwapRouterAddress = internal.makeSwapRouterAddress;

/**
 * Fetches slot0 data from the given pool.
 */
export const slot0: {
  (pool: PoolState): Effect.Effect<Slot0, Error.BlockchainError, internal.PoolsTag>;
} = null as any; //internal.fetchSlot0;

export interface PoolConfig { // TODO: merge it PoolsDescriptor
  readonly factoryAddress: PoolFactoryAddress;
}
