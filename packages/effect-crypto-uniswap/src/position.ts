import { BigDecimal } from "bigdecimal.js";
import { Brand, Context, Effect, Layer, Option } from "effect";
import { Contract } from "ethers";
import { Tagged } from "type-fest";

import {
  Address,
  BigMath,
  Chain,
  Error,
  FatalError,
  Token,
  TokenVolume,
  Wallet,
} from "@liquidity_lab/effect-crypto";
import { FunctionUtils } from "@liquidity_lab/effect-crypto/utils";

import * as Adt from "./adt.js";
import * as Pool from "./pool.js";
import * as internal from "./position.internal.js";
import * as Tick from "./tick.js";

/**
 * Represents a draft of an Uniswap V3 position before it is minted.
 * A position represents a liquidity provision within a specific price range in a pool.
 *
 * @see {@link https://docs.uniswap.org/concepts/protocol/concentrated-liquidity}
 */
export interface PositionDraft {
  readonly _tag: "@liquidity_lab/effect-crypto-uniswap/position#MintablePosition";

  /** The identifier for the pool containing token pair and fee information */
  readonly poolId: Pool.PoolState;

  /** The lower tick boundary of the position - defines the lower price limit */
  readonly tickLower: Tick.Tick;
  /** The upper tick boundary of the position - defines the upper price limit */
  readonly tickUpper: Tick.Tick;
  /** The current tick of the pool - represents the current price */
  readonly tickCurrent: Tick.Tick;

  /** The optimal amount of token0 calculated for the position */
  readonly desiredAmount0: Adt.Amount0;
  /** The optimal amount of token1 calculated for the position */
  readonly desiredAmount1: Adt.Amount1;

  /** The amount of liquidity to be provided to the position */
  readonly liquidity: Pool.Liquidity;
  /** The current price as a square root of token1/token0 ratio */
  readonly sqrtRatio: BigMath.Ratio;
}

/**
 * Represents an error that occurs when an Uniswap V3 pool cannot be found for the given token pair and fee tier.
 * This typically happens when attempting to interact with a pool that hasn't been initialized
 * or doesn't exist on the current network.
 */
export interface PoolIsNotFoundError {
  readonly _tag: "@liquidity_lab/effect-crypto-uniswap/position#PoolIsNotFoundError";
  readonly token0: Token.Erc20LikeToken;
  readonly token1: Token.Erc20LikeToken;
  readonly fee: Adt.FeeAmount;
}

/**
 * Adds liquidity to a Uniswap V3 pool by minting new positions.
 *
 * This function allows you to provide liquidity to a pool by specifying maximum amounts
 * of both tokens and the desired fee tier. Returns the transaction hash if successful.
 *
 * @see {@link https://docs.uniswap.org/contracts/v3/reference/periphery/interfaces/INonfungiblePositionManager#mint}
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { TokenVolume, FeeAmount } from "@liquidity_lab/effect-crypto"
 * import { Pool } from "@liquidity_lab/effect-crypto-uniswap"
 *
 * // Mint liquidity with 1 ETH and 1800 USDC at 0.3% fee tier
 * const program = Pool.mint(
 *   TokenVolume.fromDecimal("ETH", "1.0"),
 *   TokenVolume.fromDecimal("USDC", "1800.0"),
 *   FeeAmount.MEDIUM
 * )
 *
 * // Run the effect
 * const result = await Effect.runPromise(program)
 * // result: Option<string> containing transaction hash if successful
 * ```
 */
/*
export const mint: {
    (
        maxVolume0: TokenVolume.Erc20LikeTokenVolume,
        maxVolume1: TokenVolume.Erc20LikeTokenVolume,
        fee: Adt.FeeAmount,
    ): Effect.Effect<
        Option.Option<string>,
        Error.BlockchainError | Error.TransactionFailedError | FatalError,
        Wallet.Tag | Pool.Tag
    >;
    (
        descriptor: Context.Tag.Service<Pool.Tag>,
        maxVolume0: TokenVolume.Erc20LikeTokenVolume,
        maxVolume1: TokenVolume.Erc20LikeTokenVolume,
        fee: Adt.FeeAmount,
    ): Effect.Effect<
        Option.Option<string>,
        Error.BlockchainError | Error.TransactionFailedError | FatalError,
        Wallet.Tag
    >;
} = internal.mint;*/
