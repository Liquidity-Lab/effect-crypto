// packages/effect-crypto-uniswap/src/position.ts
import { Either, Option, Pipeable } from "effect";

import { BigMath, Token } from "@liquidity_lab/effect-crypto";
import { TokenVolume } from "@liquidity_lab/effect-crypto";

import * as Adt from "./adt.js";
import * as Pool from "./pool.js";
import * as internal from "./position.internal.js";
import * as Price from "./price.js";
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

/**
 * Represents errors that can occur during the builder process.
 * @template Field - The specific field in the builder where the error occurred, or 'calculation'/'validation' for broader issues.
 */
export interface BuilderError<
  Field extends keyof PositionDraftBuilder | "calculation" | "validation" =
    | keyof PositionDraftBuilder
    | "calculation"
    | "validation",
> {
  readonly _tag: "BuilderError";
  readonly field: Field;
  readonly message: string;
}

/**
 * Internal state for constructing a PositionDraft.
 * Fields that require calculation or validation store an Either<Value, BuilderError>.
 * This interface uses intersection types with state fragments (e.g., StateWithLowerBound)
 * to progressively refine the required fields as the builder methods are called.
 */
export interface PositionDraftBuilder extends Pipeable.Pipeable {
  // --- Core immutable context ---
  readonly pool: Pool.PoolState; // Pool details (tokens, fee, address)
  readonly slot0: Pool.Slot0; // Current pool state (sqrtPriceX96, tick, etc.)

  // --- Optional bounds (stored as Either to capture calculation/validation errors) ---
  readonly lowerBoundTick?: Either.Either<Tick.UsableTick, BuilderError<"lowerBoundTick">>;
  readonly upperBoundTick?: Either.Either<Tick.UsableTick, BuilderError<"upperBoundTick">>;

  // --- Optional amount/liquidity definition (stored as Either to capture calculation/validation errors) ---
  /**
   * Stores the liquidity if it's set directly or calculated from amounts.
   * This field acts as the primary driver for final calculations if present and valid.
   */
  readonly liquidity?: Either.Either<Pool.Liquidity, BuilderError<"calculation">>;
  /**
   * Stores the maximum desired amount of token0 if provided by the user.
   * Used to calculate liquidity if `liquidity` field is not set directly.
   */
  readonly maxAmount0?: Either.Either<Adt.Amount0, BuilderError<"maxAmount0">>;
  /**
   * Stores the maximum desired amount of token1 if provided by the user.
   * Used to calculate liquidity if `liquidity` field is not set directly.
   */
  readonly maxAmount1?: Either.Either<Adt.Amount1, BuilderError<"maxAmount1">>;

  /**
   * Helper flag to indicate which method was used to define the position size.
   * - 'liquidity': `fromLiquidity` was called.
   * - 'amount0': `fromSingleAmount` was called with token0.
   * - 'amount1': `fromSingleAmount` was called with token1.
   * - 'amounts': `fromAmounts` was called.
   * This helps `finalizeDraft` determine the correct calculation path and potential errors.
   */
  readonly _sizeDefinitionMethod?: "liquidity" | "amount0" | "amount1" | "amounts";
}

/**
 * Represents the initial state of the builder after initialization with pool and slot0 data.
 * This state only contains the essential context required to start defining bounds or size.
 */
export type EmptyState = Required<Pick<PositionDraftBuilder, "pool" | "slot0">>;

/**
 * Represents the builder state after the lower tick bound has been set (successfully or with an error).
 * This state includes the `lowerBoundTick` field, which holds an `Either` type indicating success or failure.
 */
export type StateWithLowerBound = Required<Pick<PositionDraftBuilder, "lowerBoundTick">>;

/**
 * Represents the builder state after the upper tick bound has been set (successfully or with an error).
 * This state includes the `upperBoundTick` field, which holds an `Either` type indicating success or failure.
 */
export type StateWithUpperBound = Required<Pick<PositionDraftBuilder, "upperBoundTick">>;

/**
 * Represents the builder state once both the lower and upper tick bounds have been set (successfully or with errors).
 * This state combines `StateWithLowerBound` and `StateWithUpperBound`.
 */
export type StateWithBounds = StateWithLowerBound & StateWithUpperBound;

/**
 * Represents the builder state once a desired position size (defined by liquidity, a single amount, or both amounts)
 * has been set (successfully or with an error).
 * The specific fields (`liquidity`, `maxAmount0`, `maxAmount1`) included depend on the method used (`fromLiquidity`, `fromSingleAmount`, `fromAmounts`).
 */
export type StateWithSize = Pick<PositionDraftBuilder, "liquidity" | "maxAmount0" | "maxAmount1">;

/**
 * Represents a builder state that is structurally ready for the final calculation into a `PositionDraft`.
 * It signifies that all necessary configuration steps (context, bounds, size) have been attempted.
 * The individual fields within this state might still hold `Either.Left<BuilderError>`, indicating configuration errors.
 * Final validation and calculation happen in the `finalizeDraft` step.
 */
export type BuilderReady = EmptyState & StateWithBounds & StateWithSize;

/**
 * Represents an aggregation of one or more `BuilderError`s encountered during the position draft construction process.
 * This is used by `finalizeDraft` to return all collected errors if the build process fails at any stage.
 */
export type AggregateBuilderError = {
  readonly _tag: "AggregateBuilderError"; // TODO: FIX TAGS
  readonly errors: ReadonlyArray<BuilderError>;
};

/**
 * Initializes the builder with the essential pool and current price/tick context.
 *
 * @param pool The state of the Uniswap pool (tokens, fee, etc.).
 * @param slot0 The current state of the pool's slot0 (sqrtPrice, tick).
 * @returns An initial builder state containing only the pool and slot0 context.
 *
 * @example
 * ```typescript
 * import { Token, Address } from "@liquidity_lab/effect-crypto";
 * import { Pool, Tick, Position, Price, FeeAmount } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const USDC: Token.Erc20Token;
 * declare const WETH: Token.Erc20Token;
 * declare const poolAddress: Address.Address;
 * declare const observationIndex: string;
 *
 * // Example construction for docs, actual values would come from context
 * const poolState: Pool.PoolState = {
 *   token0: USDC,
 *   token1: WETH,
 *   fee: FeeAmount.MEDIUM,
 *   address: poolAddress
 * };
 *
 * const currentTick = Tick.Tick(200000); // Example tick
 * const currentPrice = Price.makeFromTickUnsafe(USDC, WETH, currentTick); // Simplified for example
 *
 * const slot0: Pool.Slot0 = {
 *  price: currentPrice,
 *  tick: currentTick,
 *  observationIndex: observationIndex
 * };
 *
 * const builder = Position.draftBuilder(poolState, slot0);
 * // builder now contains { pool: poolState, slot0: slot0 } and is of type EmptyState
 * ```
 */
export const draftBuilder: {
  (pool: Pool.PoolState, slot0: Pool.Slot0): EmptyState;
} = internal.draftBuilder; // Point to the internal implementation

/**
 * Sets the lower tick boundary based on a function relative to the nearest usable tick.
 * Calculates the tick and stores it as `Either.Right` on success, or `Either.Left<BuilderError>` on failure.
 *
 * @template S - The current state of the builder (must include pool and slot0).
 * @param builder The current builder state.
 * @param tickFn A function that takes the nearest usable tick and returns the desired lower tick `Option<Tick.UsableTick>`.
 * @returns A new builder state including the lowerBoundTick field (as an Either).
 *
 * @example
 * ```typescript
 * import { Option } from "effect";
 * import { Position, Tick } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const initialState: Position.EmptyState;
 *
 * // Set lower bound 10 ticks below the current tick's nearest usable tick
 * const builderWithLowerTick = Position.setLowerTickBound(
 *   initialState,
 *   (currentUsableTick) => Tick.subtractNTicks(currentUsableTick, 10)
 * );
 * ```
 */
export const setLowerTickBound: {
  <S extends EmptyState>(
    builder: S,
    tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.UsableTick>,
  ): S & StateWithLowerBound;
} = internal.setLowerTickBoundImpl;

/**
 * Sets the upper tick boundary based on a function relative to the nearest usable tick.
 * Calculates the tick, validates it's above the lower bound (if set), and stores it as `Either.Right` on success,
 * or `Either.Left<BuilderError>` on failure or validation error.
 *
 * @template S - The current state of the builder (must include pool and slot0).
 * @param builder The current builder state.
 * @param tickFn A function that takes the nearest usable tick and returns the desired upper tick `Option<Tick.UsableTick>`.
 * @returns A new builder state including the upperBoundTick field (as an Either).
 *
 * @example
 * ```typescript
 * import { Option } from "effect";
 * import { Position, Tick } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const stateWithLowerBound: Position.EmptyState & Position.StateWithLowerBound;
 *
 * // Set upper bound 20 ticks above the current tick
 * const builderWithUpperTick = Position.setUpperTickBound(
 *   stateWithLowerBound,
 *   (currentUsableTick) => Tick.addNTicks(currentUsableTick, 20)
 * );
 *
 * ```
 */
export const setUpperTickBound: {
  <S extends EmptyState>(
    builder: S,
    tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.UsableTick>,
  ): S & StateWithUpperBound;
} = internal.setUpperTickBoundImpl;

/**
 * Sets the lower tick boundary based on a target price relative to the current price.
 * Converts the target price to a tick, validates it, and stores it as `Either.Right` on success,
 * or `Either.Left<BuilderError>` on failure or validation error.
 *
 * @template S - The current state of the builder (must include pool and slot0).
 * @param builder The current builder state.
 * @param priceFn A function that takes the current price and returns the desired lower bound price `Option<Price.AnyTokenPrice>`.
 * @returns A new builder state including the lowerBoundTick field (as an Either).
 *
 * @example
 * ```typescript
 * import { Option } from "effect";
 * import { Position, Price } from "@liquidity_lab/effect-crypto-uniswap";
 * import { BigMath } from "@liquidity_lab/effect-crypto";
 *
 * declare const initialState: Position.EmptyState;
 * declare const currentPrice: Price.AnyTokenPrice; // Mock current price
 *
 * // Set lower bound 5% below the current price
 * const builderWithLowerPrice = Position.setLowerPriceBound(initialState, (currentPrice) => {
 *   const currentRatio = Price.asRatio(currentPrice);
 *   const targetRatio = currentRatio.multiply(BigMath.Ratio.fromString("0.95"));
 *   const targetPriceEither = Price.makeTokenPriceFromRatio(
 *     currentPrice.baseCurrency,
 *     currentPrice.quoteCurrency,
 *     targetRatio
 *   );
 *   // Handle potential error from makeTokenPriceFromRatio if needed, returning Option
 *   return Either.getRight(targetPriceEither);
 * });
 *
 * ```
 */
export const setLowerPriceBound: {
  <S extends EmptyState>(
    builder: S,
    priceFn: (currentPrice: Price.AnyTokenPrice) => Option.Option<Price.AnyTokenPrice>,
  ): S & StateWithLowerBound;
} = null as any;

/**
 * Sets the upper tick boundary based on a target price relative to the current price.
 * Converts the target price to a tick, validates it's above the lower bound (if set),
 * and stores it as `Either.Right` on success, or `Either.Left<BuilderError>` on failure or validation error.
 *
 * @template S - The current state of the builder (must include pool and slot0).
 * @param builder The current builder state.
 * @param priceFn A function that takes the current price and returns the desired upper bound price `Option<Price.AnyTokenPrice>`.
 * @returns A new builder state including the upperBoundTick field (as an Either).
 *
 * @example
 * ```typescript
 * import { Option } from "effect";
 * import { Position, Price } from "@liquidity_lab/effect-crypto-uniswap";
 * import { BigMath } from "@liquidity_lab/effect-crypto";
 *
 * declare const stateWithLowerBound: Position.EmptyState & Position.StateWithLowerBound;
 * declare const currentPrice: Price.AnyTokenPrice; // Mock current price
 *
 * // Set upper bound 10% above the current price
 * const builderWithUpperPrice = Position.setUpperPriceBound(stateWithLowerBound, (currentPrice) => {
 *     const currentRatio = Price.asRatio(currentPrice);
 *     const targetRatio = currentRatio.multiply(BigMath.Ratio.fromString("1.10"));
 *     const targetPriceEither = Price.makeTokenPriceFromRatio(
 *         currentPrice.baseCurrency,
 *         currentPrice.quoteCurrency,
 *         targetRatio
 *     );
 *     // Handle potential error if needed, returning Option
 *     return Either.getRight(targetPriceEither);
 * });
 *
 * ```
 */
export const setUpperPriceBound: {
  <S extends EmptyState>(
    builder: S,
    priceFn: (currentPrice: Price.AnyTokenPrice) => Option.Option<Price.AnyTokenPrice>,
  ): S & StateWithUpperBound;
} = null as any;

/**
 * Sets the desired position size using a specific amount of a single token (token0 or token1).
 * The builder will later calculate the required amount of the *other* token and the resulting liquidity.
 * Clears any previously set size definitions (liquidity, maxAmount0/1).
 * Stores the provided amount as `Either.Right` or `Either.Left<BuilderError>` if validation fails (e.g., non-positive amount).
 * Sets the `_sizeDefinitionMethod` flag.
 *
 * @template S - The current state of the builder (must include pool and slot0).
 * @template T - The type of the token volume provided.
 * @param builder The current builder state.
 * @param volume The volume of the single token to base the position size on.
 * @returns A new builder state including either `maxAmount0` or `maxAmount1` (as an Either) and the `_sizeDefinitionMethod` flag.
 *
 * @example
 * ```typescript
 * import { Option } from "effect";
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 * import { Token, TokenVolume } from "@liquidity_lab/effect-crypto";
 *
 * declare const stateWithBounds: Position.EmptyState & Position.StateWithBounds;
 * declare const WETH: Token.Erc20LikeToken;
 *
 * // Define position size based on providing 1 WETH
 * declare const wethVolume; // "1.0 WETH"
 *
 * const builderWithSize = Position.setSizeFromSingleAmount(stateWithBounds, wethVolume.value);
 *
 * ```
 */
export const setSizeFromSingleAmount: {
  <S extends EmptyState, T extends Token.TokenType>(
    builder: S,
    volume: TokenVolume.TokenVolume<T>,
  ): S & StateWithSize;
} = null as any;

/**
 * Sets the desired position size using a specific liquidity amount.
 * The builder will later calculate the required amounts of token0 and token1 based on this liquidity.
 * Clears any previously set size definitions (liquidity, maxAmount0/1).
 * Stores the provided liquidity as `Either.Right` or `Either.Left<BuilderError>` if validation fails (e.g., non-positive liquidity).
 * Sets the `_sizeDefinitionMethod` flag to 'liquidity'.
 *
 * @template S - The current state of the builder (must include pool and slot0).
 * @param builder The current builder state.
 * @param liquidity The specific amount of liquidity for the position.
 * @returns A new builder state including the `liquidity` field (as an Either) and the `_sizeDefinitionMethod` flag.
 *
 * @example
 * ```typescript
 * import { Option } from "effect";
 * import { Position, Pool } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const stateWithBounds: Position.EmptyState & Position.StateWithBounds;
 *
 * // Define position size using a liquidity value (e.g., obtained from a previous position)
 * const liquidityValue = Pool.Liquidity(1234567890n);
 *
 * // Assume bounds are set in stateWithBounds
 * const builderWithSize = Position.setSizeFromLiquidity(stateWithBounds, liquidityValue);
 *
 * ```
 */
export const setSizeFromLiquidity: {
  <S extends EmptyState>(builder: S, liquidity: Pool.Liquidity): S & StateWithSize;
} = internal.setSizeFromLiquidityImpl;

/**
 * Attempts to finalize the PositionDraft creation from a builder state that is structurally complete.
 * 1. Collects all `BuilderError`s from the `Either` fields (bounds, amounts/liquidity).
 * 2. If any errors are found, returns `Either.Left<AggregateBuilderError>`.
 * 3. If all prerequisite fields are `Either.Right`, proceeds to call the internal calculation logic
 *    (e.g., `calculatePositionDraftFromAmounts` or `calculatePositionDraftFromLiquidity`) based on `_sizeDefinitionMethod`.
 * 4. Wraps potential calculation errors (e.g., division by zero, invalid range) into a `BuilderError`.
 * 5. Returns `Either.Right<PositionDraft>` on success, or `Either.Left<AggregateBuilderError>` if calculation fails.
 *
 * @param state A builder state that structurally matches `BuilderReady`.
 * @returns Either the successfully calculated `PositionDraft` or an `AggregateBuilderError` containing all encountered issues.
 *
 * @example
 * ```typescript
 * import { Either, Option } from "effect";
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const readyState: Position.BuilderReady;
 *
 * const result = Position.finalizeDraft(readyState);
 *
 * Either.match(result, {
 *   onRight: (positionDraft) => {
 *     console.log("Position Draft Created:", positionDraft);
 *   },
 *   onLeft: (errors) => {
 *     console.error("Failed to create Position Draft:", errors.errors);
 *   }
 * });
 * ```
 */
export const finalizeDraft: {
  (state: BuilderReady): Either.Either<PositionDraft, AggregateBuilderError>;
} = internal.finalizeDraftImpl;

/**
 * Calls `finalizeDraft` and throws a custom error if it returns `Either.Left`.
 * This is a convenience function for cases where errors should immediately stop execution.
 *
 * @param state A builder state that structurally matches `BuilderReady`.
 * @param errorHandler A function that converts the `AggregateBuilderError` into a standard `Error` to be thrown.
 * @returns The successfully calculated `PositionDraft` if no errors occur.
 * @throws An `Error` generated by the `errorHandler` if `finalizeDraft` returns `Either.Left`.
 *
 * @example
 * ```typescript
 * import { Option } from "effect";
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const readyState: Position.BuilderReady;
 *
 * const customErrorHandler = (aggError: Position.AggregateBuilderError): Error => {
 *   const messages = aggError.errors.map(e => `${e.field}: ${e.message}`).join("\n");
 *   return new Error(`Position Draft Error:\n${messages}`);
 * };
 *
 * try {
 *   const positionDraft = Position.finalizeDraftOrThrow(readyState, customErrorHandler);
 *   console.log("Position Draft Created:", positionDraft);
 *   // Use the positionDraft for minting...
 * } catch (error) {
 *   console.error(error); // Catches the error thrown by customErrorHandler
 *   // Handle the error appropriately
 * }
 * ```
 */
export const finalizeDraftOrThrow: {
  (state: BuilderReady, errorHandler: (aggError: AggregateBuilderError) => Error): PositionDraft;
} = null as any;
