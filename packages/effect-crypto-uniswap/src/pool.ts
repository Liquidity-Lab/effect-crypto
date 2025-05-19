import { BigDecimal } from "bigdecimal.js";
import { Brand, Context, Effect, Layer, Option } from "effect";
import { Contract } from "ethers";
import { Tagged } from "type-fest";

import { Address, Chain, Error, FatalError, Token, Wallet } from "@liquidity_lab/effect-crypto";
import { FunctionUtils } from "@liquidity_lab/effect-crypto/utils";

import * as Adt from "./adt.js";
import * as internal from "./pool.internal.js";
import * as Price from "./price.js";
import * as Tick from "./tick.js";

export { PoolsTag as Tag } from "./pool.internal.js";

/**
 * Represents the amount of liquidity in a Uniswap V3 position.
 * Used to track liquidity amounts across positions and pools.
 *
 * @example
 * ```typescript
 * import { Big } from "bigdecimal.js"
 * import { Liquidity } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const liquidity = Liquidity(Big("1000.50"))
 * ```
 * @see {@link https://docs.uniswap.org/protocol/concepts/v3-overview/liquidity}
 */
export type Liquidity = Brand.Branded<BigDecimal, "Liquidity">; // TODO: proper type id

/**
 * Constructor for creating Liquidity values.
 * Ensures type safety when working with liquidity amounts.
 *
 * @example
 * ```typescript
 * import { Big } from "bigdecimal.js"
 * import { Liquidity } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const liquidity = Liquidity(Big("1000.50"))
 * ```
 */
export const Liquidity: Brand.Brand.Constructor<Liquidity> = internal.liquidityConstructor;

/**
 * The current state of a pool's price and tick.
 * Used when price data is needed without the full slot0 data.
 *
 * @example
 * ```typescript
 * import { Token, TokenPrice } from "@liquidity_lab/effect-crypto"
 * import { Tick } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const slot0Price: Slot0Price = {
 *   price: TokenPrice(token0, token1, Big("1000.50")),
 *   tick: Tick(85176) // Corresponding tick for this price
 * }
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/core/interfaces/pool/IUniswapV3PoolState#slot0}
 */
export interface Slot0Price {
  readonly price: Price.AnyTokenPrice;
  readonly tick: Tick.Tick;
}

/**
 * The complete slot0 data structure from a Uniswap V3 pool.
 * Contains price, tick, and the observation array index for oracle data.
 *
 * @example
 * ```typescript
 * import { Token, TokenPrice } from "@liquidity_lab/effect-crypto"
 * import { Tick } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const slot0: Slot0 = {
 *   price: TokenPrice(token0, token1, Big("1000.50")),
 *   tick: Tick(85176),
 *   observationIndex: "12" // Index in the oracle array
 * }
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/core/interfaces/pool/IUniswapV3PoolState#slot0}
 */
export interface Slot0 extends Slot0Price {
  readonly observationIndex: string;
}

/**
 * Represents a Uniswap V3 pool's basic state.
 * Contains the token pair, fee tier, and pool's address.
 *
 * @example
 * ```typescript
 * import { Token } from "@liquidity_lab/effect-crypto"
 * import { FeeAmount } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const pool: PoolState = {
 *   token0: WETH,
 *   token1: USDC,
 *   fee: FeeAmount.MEDIUM, // 0.3%
 *   address: "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
 * }
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/core/interfaces/pool/IUniswapV3Pool}
 */
export interface PoolState {
  // TODO: it's not a state. It's lie PoolId or PoolDefinition
  readonly token0: Token.AnyToken;
  readonly token1: Token.AnyToken;
  readonly fee: Adt.FeeAmount;
  readonly address: Address;
}

/**
 * A branded type for pool addresses to ensure type safety when working with pool addresses.
 *
 * @example
 * ```typescript
 * import { PoolAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const poolAddress: PoolAddress = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8" as PoolAddress
 * ```
 */
export type PoolAddress = Tagged<string, "POOL_ADDRESS">;

/**
 * Configuration for connecting to Uniswap V3 protocol contracts.
 * Contains addresses for the core protocol contracts.
 *
 * @example
 * ```typescript
 * import {
 *   PoolInitializerAddress,
 *   PoolFactoryAddress,
 *   SwapRouterAddress
 * } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const descriptor: PoolsDescriptor = {
 *   poolInitializerAddress: PoolInitializerAddress("0x..."),
 *   poolFactoryAddress: PoolFactoryAddress("0x..."),
 *   swapRouterAddress: SwapRouterAddress("0x...")
 * }
 * ```
 */
export interface PoolsDescriptor {
  readonly poolInitializerAddress: PoolInitializerAddress;
  readonly poolFactoryAddress: PoolFactoryAddress;
  readonly swapRouterAddress: SwapRouterAddress; // TODO: seems like this one is not used
  readonly positionManagerAddress: PositionManagerAddress;
}

/**
 * Creates a Layer containing Uniswap V3 pool services configured with the given descriptor.
 * Used to provide pool-related services to the application.
 *
 * @example
 * ```typescript
 * import {
 *   poolsLayer,
 *   PoolInitializerAddress,
 *   PoolFactoryAddress,
 *   SwapRouterAddress
 * } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const layer = poolsLayer({
 *   poolInitializerAddress: PoolInitializerAddress("0x..."),
 *   poolFactoryAddress: PoolFactoryAddress("0x..."),
 *   swapRouterAddress: SwapRouterAddress("0x...")
 * })
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/core/interfaces/pool/IUniswapV3Pool}
 */
export const poolsLayer: (descriptor: PoolsDescriptor) => Layer.Layer<internal.PoolsTag> =
  internal.makePoolsFromDescriptor;

/**
 * Fetches the state of a Uniswap V3 pool for a given token pair and fee tier.
 * Returns None if the pool doesn't exist.
 *
 * @example
 * ```typescript
 * import { Option } from "effect"
 * import { Token } from "@liquidity_lab/effect-crypto"
 * import { fetchState, FeeAmount } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const poolState = yield* fetchState(WETH, USDC, FeeAmount.MEDIUM)
 * if (Option.isSome(poolState)) {
 *   console.log("Pool exists at:", poolState.value.address)
 * }
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/core/interfaces/pool/IUniswapV3Pool#getpool}
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
 * Creates and initializes a new Uniswap V3 pool if it doesn't exist.
 * The initial price must be within the correct range and tick spacing.
 *
 * @example
 * ```typescript
 * import { Option } from "effect"
 * import { Big } from "bigdecimal.js"
 * import { Token, TokenPrice } from "@liquidity_lab/effect-crypto"
 * import { createAndInitialize, FeeAmount } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const price = TokenPrice(WETH, USDC, Big("1800.00"))
 * const result = yield* createAndInitialize(price, FeeAmount.MEDIUM)
 * if (Option.isSome(result)) {
 *   console.log("Pool initialized at price:", result.value.price.toString())
 * }
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/periphery/interfaces/IPoolInitializer#createandInitializePoolIfNecessary}
 */
export const createAndInitialize: {
  (
    price: Price.AnyTokenPrice,
    fee: Adt.FeeAmount,
  ): Effect.Effect<
    Option.Option<Slot0Price>,
    Error.BlockchainError | Error.TransactionFailedError | FatalError,
    Wallet.Tag | internal.PoolsTag
  >;
  (
    pool: Context.Tag.Service<internal.PoolsTag>,
    price: Price.AnyTokenPrice,
    fee: Adt.FeeAmount,
  ): Effect.Effect<
    Option.Option<Slot0Price>,
    Error.BlockchainError | Error.TransactionFailedError | FatalError,
    Wallet.Tag
  >;
} = internal.createAndInitializePoolIfNecessary;

/**
 * Branded address type for the Uniswap V3 Pool Initializer contract.
 *
 * @example
 * ```typescript
 * import { PoolInitializerAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const address = PoolInitializerAddress("0x1234...")
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/periphery/interfaces/IPoolInitializer}
 */
export type PoolInitializerAddress = Brand.Branded<Address, internal.PoolInitializerAddressTypeId>;

/**
 * Constructor for creating PoolInitializerAddress values.
 *
 * @example
 * ```typescript
 * import { PoolInitializerAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const address = PoolInitializerAddress("0x1234...")
 * ```
 */
export const PoolInitializerAddress = internal.poolInitializerAddressConstructor;

/**
 * Branded contract type for the Uniswap V3 Pool Initializer.
 *
 * @example
 * ```typescript
 * import { Contract } from "ethers"
 * import { PoolInitializerContract } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const contract = PoolInitializerContract(new Contract(...))
 * ```
 */
export type PoolInitializerContract = Brand.Branded<
  Contract,
  internal.PoolInitializerContractTypeId
>;

/**
 * Constructor for creating PoolInitializerContract values.
 *
 * @example
 * ```typescript
 * import { Contract } from "ethers"
 * import { PoolInitializerContract } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const contract = PoolInitializerContract(new Contract(...))
 * ```
 */
export const PoolInitializerContract = internal.poolInitializerContractConstructor;

/**
 * Branded address type for the Uniswap V3 Position Manager contract.
 *
 * @example
 * ```typescript
 * import { PositionManagerAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const address = PositionManagerAddress("0x1234...")
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/periphery/interfaces/INonfungiblePositionManager}
 */
export type PositionManagerAddress = Brand.Branded<Address, internal.PositionManagerAddressTypeId>;

/**
 * Branded address type for the Uniswap V3 NonfungiblePositionManager contract.
 *
 * @example
 * ```typescript
 * import { NonfungiblePositionManagerAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const address = NonfungiblePositionManagerAddress("0x1234...")
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/periphery/interfaces/INonfungiblePositionManager}
 */
export const PositionManagerAddress = internal.positionManagerAddressConstructor;

/**
 * Branded address type for the Uniswap V3 Factory contract.
 *
 * @example
 * ```typescript
 * import { PoolFactoryAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const address = PoolFactoryAddress("0x1234...")
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/core/interfaces/IUniswapV3Factory}
 */
export type PoolFactoryAddress = Brand.Branded<Address, internal.PoolFactoryAddressTypeId>;

/**
 * Constructor for creating PoolFactoryAddress values.
 *
 * @example
 * ```typescript
 * import { PoolFactoryAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const address = PoolFactoryAddress("0x1234...")
 * ```
 */
export const PoolFactoryAddress = internal.poolFactoryAddressConstructor;

/**
 * Branded contract type for the Uniswap V3 Factory.
 *
 * @example
 * ```typescript
 * import { Contract } from "ethers"
 * import { PoolFactoryContract } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const contract = PoolFactoryContract(new Contract(...))
 * ```
 */
export type PoolFactoryContract = Brand.Branded<Contract, internal.PoolFactoryContractTypeId>;

/**
 * Constructor for creating PoolFactoryContract values.
 *
 * @example
 * ```typescript
 * import { Contract } from "ethers"
 * import { PoolFactoryContract } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const contract = PoolFactoryContract(new Contract(...))
 * ```
 */
export const PoolFactoryContract = internal.poolFactoryContractConstructor;

/**
 * Branded address type for the Uniswap V3 Router contract.
 *
 * @example
 * ```typescript
 * import { SwapRouterAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const address = SwapRouterAddress("0x1234...")
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/periphery/interfaces/ISwapRouter}
 */
export type SwapRouterAddress = Brand.Branded<Address, internal.SwapRouterAddressTypeId>;

/**
 * Constructor for creating SwapRouterAddress values.
 *
 * @example
 * ```typescript
 * import { SwapRouterAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const address = SwapRouterAddress("0x1234...")
 * ```
 */
export const SwapRouterAddress = internal.swapRouterAddressConstructor;

/**
 * Fetches the current slot0 data from a Uniswap V3 pool.
 *
 * @example
 * ```typescript
 * import { Option } from "effect"
 * import { fetchState, slot0, FeeAmount } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const poolState = yield* fetchState(WETH, USDC, FeeAmount.MEDIUM)
 * if (Option.isSome(poolState)) {
 *   const slot0Data = yield* slot0(poolState.value)
 *   console.log("Current tick:", slot0Data.tick)
 * }
 * ```
 * @see {@link https://docs.uniswap.org/protocol/reference/core/interfaces/pool/IUniswapV3PoolState#slot0}
 */
export const slot0: {
  (pool: PoolState): Effect.Effect<Slot0, Error.BlockchainError, internal.PoolsTag>;
} = null as any; // TODO: implement

export const liquidity: {
  (pool: PoolState): Effect.Effect<Liquidity, Error.BlockchainError, internal.PoolsTag>;
} = null as any; // TODO: implement

/**
 * Configuration for pool-related operations.
 * Used to configure the factory contract address.
 *
 * @example
 * ```typescript
 * import { PoolConfig, PoolFactoryAddress } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * const config: PoolConfig = {
 *   factoryAddress: PoolFactoryAddress("0x1234...")
 * }
 * ```
 */
export interface PoolConfig {
  readonly factoryAddress: PoolFactoryAddress;
} // TODO: remove?
