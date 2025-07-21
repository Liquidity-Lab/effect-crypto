// packages/effect-crypto-uniswap/src/position.ts
import { Array, Data, Effect, Either, Function, Option, Pipeable } from "effect";

import { BigMath, Chain, Error, FatalError, Token } from "@liquidity_lab/effect-crypto";
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
  readonly tickLower: Tick.UsableTick;
  /** The upper tick boundary of the position - defines the upper price limit */
  readonly tickUpper: Tick.UsableTick;
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
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 * import { Token } from "@liquidity_lab/effect-crypto";
 *
 * // Example error when pool doesn't exist
 * const error: Position.PoolIsNotFoundError = {
 *   _tag: "@liquidity_lab/effect-crypto-uniswap/position#PoolIsNotFoundError",
 *   token0: usdcToken,
 *   token1: wethToken,
 *   fee: FeeAmount.MEDIUM
 * };
 * ```
 */
export interface PoolIsNotFoundError {
  readonly _tag: "@liquidity_lab/effect-crypto-uniswap/position#PoolIsNotFoundError";

  readonly token0: Token.Erc20LikeToken;
  readonly token1: Token.Erc20LikeToken;
  readonly fee: Adt.FeeAmount;
}

/**
 * Represents an error that occurs when the tick boundaries are invalid.
 * This happens when the lower tick is greater than or equal to the upper tick,
 * or when ticks don't conform to the pool's tick spacing requirements.
 *
 * @example
 * ```typescript
 * import { Either } from "effect";
 * import { Position, Tick } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * // Lower tick >= upper tick will result in InvalidTickBoundsError
 * const builder = Position.draftBuilder(poolState, slot0)
 *   .pipe(
 *     Position.setLowerTickBound((tick) => Tick.addNTicks(tick, 10)),
 *     Position.setUpperTickBound((tick) => Tick.subtractNTicks(tick, 10)),
 *     Position.setSizeFromLiquidity(liquidity)
 *   );
 *
 * const draft = Position.finalizeDraft(builder);
 * // draft will be Either.Left with errors containing InvalidTickBoundsError
 * ```
 */
export type BuilderError = Data.TaggedEnum<{
  [internal.InvalidTickBoundsErrorSymbol]: {
    readonly lowerTick: Tick.UsableTick;
    readonly upperTick: Tick.UsableTick;
    readonly message: string;
  };
  [internal.InvalidUpperTickErrorSymbol]: {
    readonly message: string;
  };
  [internal.InvalidLowerTickErrorSymbol]: {
    readonly message: string;
  };
  [internal.InvalidAmountErrorSymbol]: {
    readonly token0: Token.AnyToken;
    readonly token1: Token.AnyToken;
    readonly given: Token.AnyToken;
    readonly message: string;
  };
  [internal.InvalidSizeErrorSymbol]: {
    readonly message: string;
  };
  [internal.InvalidPriceErrorSymbol]: {
    readonly message: string;
    readonly providedPrice: Option.Option<Price.AnyTokenPrice>;
    readonly expectedToken0: Token.AnyToken;
    readonly expectedToken1: Token.AnyToken;
  };
}>;

export const BuilderError = internal.BuilderErrorLive;

export type CaseConstructorWithTag<Tag extends keyof typeof internal.BuilderErrorLive> = {
  tag: Tag;
} & (typeof internal.BuilderErrorLive)[Tag];

/**
 * Represents an error that occurs when the tick boundaries are invalid.
 * This happens when the lower tick is greater than or equal to the upper tick,
 * or when ticks don't conform to the pool's tick spacing requirements.
 *
 * @example
 * ```typescript
 * import { Either } from "effect";
 * import { Position, Tick } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * // Lower tick >= upper tick will result in InvalidTickBoundsError
 * const builder = Position.draftBuilder(poolState, slot0)
 *   .pipe(
 *     Position.setLowerTickBound((tick) => Tick.addNTicks(tick, 10)),
 *     Position.setUpperTickBound((tick) => Tick.subtractNTicks(tick, 10)),
 *     Position.setSizeFromLiquidity(liquidity)
 *   );
 *
 * const draft = Position.finalizeDraft(builder);
 * // draft will be Either.Left with errors containing InvalidTickBoundsError
 * ```
 */
export const InvalidTickBoundsError: CaseConstructorWithTag<
  typeof internal.InvalidTickBoundsErrorSymbol
> = internal.InvalidTickBoundsErrorConstructor;
export type InvalidTickBoundsError = Data.TaggedEnum.Value<
  BuilderError,
  typeof internal.InvalidTickBoundsErrorSymbol
>;

/**
 * Type guard function to check if an error is a TickBoundsError.
 *
 * @param error - The error to check
 * @returns True if the error is a TickBoundsError, false otherwise
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const handleError = (error: unknown) => {
 *   if (Position.isTickBoundsError(error)) {
 *     console.log(`Tick bounds error: ${error.message}`);
 *     console.log(`Lower: ${error.lowerTick.unwrap}, Upper: ${error.upperTick.unwrap}`);
 *   }
 * };
 * ```
 */
export const isTickBoundsError: {
  (error: unknown): error is InvalidTickBoundsError;
} = BuilderError.$is(internal.InvalidTickBoundsErrorSymbol);

/**
 * Represents an error that occurs when the upper tick boundary is invalid.
 * This can happen when the upper tick calculation fails or returns None.
 *
 * @example
 * ```typescript
 * import { Either, Option } from "effect";
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * // Upper tick function returns None
 * const builder = Position.draftBuilder(poolState, slot0)
 *   .pipe(
 *     Position.setLowerTickBound((current) => Option.some(current)),
 *     Position.setUpperTickBound(() => Option.none()),
 *     Position.setSizeFromLiquidity(liquidity)
 *   );
 *
 * const draft = Position.finalizeDraft(builder);
 * // draft will be Either.Left with errors containing InvalidUpperTickError
 * ```
 */
export const InvalidUpperTickError: CaseConstructorWithTag<
  typeof internal.InvalidUpperTickErrorSymbol
> = internal.InvalidUpperTickErrorConstructor;
export type InvalidUpperTickError = Data.TaggedEnum.Value<
  BuilderError,
  typeof internal.InvalidUpperTickErrorSymbol
>;

/**
 * Type guard function to check if an error is an InvalidUpperTickError.
 *
 * @param error - The error to check
 * @returns True if the error is an InvalidUpperTickError, false otherwise
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const handleError = (error: unknown) => {
 *   if (Position.isInvalidUpperTickError(error)) {
 *     console.log(`Invalid upper tick: ${error.message}`);
 *   }
 * };
 * ```
 */
export const isInvalidUpperTickError: {
  (error: unknown): error is InvalidUpperTickError;
} = BuilderError.$is(internal.InvalidUpperTickErrorSymbol);

/**
 * Represents an error that occurs when the lower tick boundary is invalid.
 * This can happen when the lower tick calculation fails or returns None.
 *
 * @example
 * ```typescript
 * import { Either, Option } from "effect";
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * // Lower tick function returns None
 * const builder = Position.draftBuilder(poolState, slot0)
 *   .pipe(
 *     Position.setLowerTickBound(() => Option.none()),
 *     Position.setUpperTickBound((current) => Option.some(current)),
 *     Position.setSizeFromLiquidity(liquidity)
 *   );
 *
 * const draft = Position.finalizeDraft(builder);
 * // draft will be Either.Left with errors containing InvalidLowerTickError
 * ```
 */
export const InvalidLowerTickError: CaseConstructorWithTag<
  typeof internal.InvalidLowerTickErrorSymbol
> = internal.InvalidLowerTickErrorConstructor;
export type InvalidLowerTickError = Data.TaggedEnum.Value<
  BuilderError,
  typeof internal.InvalidLowerTickErrorSymbol
>;

/**
 * Type guard function to check if an error is an InvalidLowerTickError.
 *
 * @param error - The error to check
 * @returns True if the error is an InvalidLowerTickError, false otherwise
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const handleError = (error: unknown) => {
 *   if (Position.isInvalidLowerTickError(error)) {
 *     console.log(`Invalid lower tick: ${error.message}`);
 *   }
 * };
 * ```
 */
export const isInvalidLowerTickError: {
  (error: unknown): error is InvalidLowerTickError;
} = BuilderError.$is(internal.InvalidLowerTickErrorSymbol);

/**
 * Represents an error that occurs when the position size is invalid.
 * This can happen when no size is set or when an invalid size combination is provided.
 *
 * @example
 * ```typescript
 * import { Either } from "effect";
 * import { Position, Tick } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * // No size set will result in InvalidSizeError
 * const builder = Position.draftBuilder(poolState, slot0)
 *   .pipe(
 *     Position.setLowerTickBound((tick) => Tick.subtractNTicks(tick, 10)),
 *     Position.setUpperTickBound((tick) => Tick.addNTicks(tick, 10))
 *     // Note: No size setting method called
 *   );
 *
 * const draft = Position.finalizeDraft(builder);
 * // draft will be Either.Left with errors containing InvalidSizeError
 * ```
 */
export const InvalidSizeError: CaseConstructorWithTag<typeof internal.InvalidSizeErrorSymbol> =
  internal.InvalidSizeErrorConstructor;
export type InvalidSizeError = Data.TaggedEnum.Value<
  BuilderError,
  typeof internal.InvalidSizeErrorSymbol
>;

/**
 * Type guard function to check if an error is an InvalidSizeError.
 *
 * @param error - The error to check
 * @returns True if the error is an InvalidSizeError, false otherwise
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const handleError = (error: unknown) => {
 *   if (Position.isInvalidSizeError(error)) {
 *     console.log(`Invalid size: ${error.message}`);
 *   }
 * };
 * ```
 */
export const isInvalidSizeError: {
  (error: unknown): error is InvalidSizeError;
} = BuilderError.$is(internal.InvalidSizeErrorSymbol);

/**
 * Represents an error that occurs when an invalid amount is provided for position sizing.
 * This can happen when the provided token doesn't match the pool's tokens,
 * or when the amount is invalid (e.g., negative or zero).
 *
 * @example
 * ```typescript
 * import { Either } from "effect";
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 * import { Token, TokenVolume } from "@liquidity_lab/effect-crypto";
 *
 * declare const stateWithBounds: Position.EmptyState & Position.StateWithBounds;
 * declare const btcToken: Token.Erc20Token; // Different token not in the pool
 *
 * // Using a token that's not in the pool will result in InvalidAmountError
 * const wrongTokenVolume = TokenVolume.fromDecimal(btcToken, "1.0");
 * const builder = Position.setSizeFromSingleAmount(stateWithBounds, wrongTokenVolume);
 *
 * const draft = Position.finalizeDraft(builder);
 * // draft will be Either.Left with errors containing InvalidAmountError
 * ```
 */
export const InvalidAmountError: CaseConstructorWithTag<typeof internal.InvalidAmountErrorSymbol> =
  internal.InvalidAmountErrorConstructor;
export type InvalidAmountError = Data.TaggedEnum.Value<
  BuilderError,
  typeof internal.InvalidAmountErrorSymbol
>;

/**
 * Type guard function to check if an error is an InvalidAmountError.
 *
 * @param error - The error to check
 * @returns True if the error is an InvalidAmountError, false otherwise
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const handleError = (error: unknown) => {
 *   if (Position.isInvalidAmountError(error)) {
 *     console.log(`Invalid amount: ${error.message}`);
 *     console.log(`Expected tokens: ${error.token0.symbol}/${error.token1.symbol}`);
 *     console.log(`Given token: ${error.given.symbol}`);
 *   }
 * };
 * ```
 */
export const isInvalidAmountError: {
  (error: unknown): error is InvalidAmountError;
} = BuilderError.$is(internal.InvalidAmountErrorSymbol);

/**
 * Represents an error that occurs when an invalid price is provided.
 * This can happen when the price contains tokens that don't match the pool's tokens,
 * or when the price cannot be converted to a valid tick.
 *
 * @example
 * ```typescript
 * import { Either, Option } from "effect";
 * import { Position, Price } from "@liquidity_lab/effect-crypto-uniswap";
 * import { Token } from "@liquidity_lab/effect-crypto";
 *
 * declare const poolState: Pool.PoolState; // USDC/WETH pool
 * declare const BTCToken: Token.Erc20Token;
 *
 * // Price with wrong tokens will result in InvalidPriceError
 * const wrongPrice = Price.makeFromUnits(BTCToken, poolState.token1, BigMath.Ratio.ONE);
 * const builder = Position.draftBuilder(poolState, slot0)
 *   .pipe(
 *     Position.setLowerPriceBound((current) => wrongPrice), // Wrong token in price
 *     Position.setUpperTickBound((tick) => Tick.addNTicks(tick, 10)),
 *     Position.setSizeFromLiquidity(liquidity)
 *   );
 *
 * const draft = Position.finalizeDraft(builder);
 * // draft will be Either.Left with errors containing InvalidPriceError
 * ```
 */
export const InvalidPriceError: CaseConstructorWithTag<typeof internal.InvalidPriceErrorSymbol> =
  internal.InvalidPriceErrorConstructor;
export type InvalidPriceError = Data.TaggedEnum.Value<
  BuilderError,
  typeof internal.InvalidPriceErrorSymbol
>;

/**
 * Type guard function to check if an error is an InvalidPriceError.
 *
 * @param error - The error to check
 * @returns True if the error is an InvalidPriceError, false otherwise
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const handleError = (error: unknown) => {
 *   if (Position.isInvalidPriceError(error)) {
 *     console.log(`Invalid price: ${error.message}`);
 *     console.log(`Expected tokens: ${error.expectedToken0.symbol}/${error.expectedToken1.symbol}`);
 *   }
 * };
 * ```
 */
export const isInvalidPriceError: {
  (error: unknown): error is InvalidPriceError;
} = BuilderError.$is(internal.InvalidPriceErrorSymbol);

/**
 * Helper function for pattern matching BuilderError.
 * Provides a clean API for handling all BuilderError variants exhaustively.
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * const handleError = Position.matchBuilderError({
 *   [Position.InvalidTickBoundsError]: (error) => `Tick bounds error: ${error.message}`,
 *   [Position.InvalidUpperTickError]: (error) => `Invalid upper tick: ${error.message}`,
 *   [Position.InvalidLowerTickError]: (error) => `Invalid lower tick: ${error.message}`,
 *   [Position.InvalidSizeError]: (error) => `Invalid size: ${error.message}`,
 *   [Position.InvalidPriceError]: (error) => `Invalid price: ${error.message}`
 * });
 *
 * declare const someBuilderError: Position.BuilderError;
 * const result = handleError(someBuilderError);
 * ```
 */
export const matchBuilderError = BuilderError.$match;

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
  readonly lowerBoundTick?: Either.Either<
    Tick.UsableTick,
    Array.NonEmptyArray<InvalidLowerTickError | InvalidPriceError>
  >;
  readonly upperBoundTick?: Either.Either<
    Tick.UsableTick,
    Array.NonEmptyArray<InvalidUpperTickError | InvalidPriceError>
  >;

  /**
   * Stores the liquidity if it's set directly or calculated from amounts.
   * This field acts as the primary driver for final calculations if present and valid.
   */
  readonly liquidity?: Either.Either<Pool.Liquidity, never>;

  /**
   * Stores the maximum desired amount of token0 if provided by the user.
   * Used to calculate liquidity if `liquidity` field is not set directly.
   */
  readonly maxAmount0?: Either.Either<Adt.Amount0, Array.NonEmptyArray<InvalidAmountError>>;
  /**
   * Stores the maximum desired amount of token1 if provided by the user.
   * Used to calculate liquidity if `liquidity` field is not set directly.
   */
  readonly maxAmount1?: Either.Either<Adt.Amount1, Array.NonEmptyArray<InvalidAmountError>>;

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
 *
 * @example
 * ```typescript
 * import { Position, Pool } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const poolState: Pool.PoolState;
 * declare const slot0: Pool.Slot0;
 *
 * const emptyState: Position.EmptyState = Position.draftBuilder(poolState, slot0);
 * // emptyState has only pool and slot0 properties
 * ```
 */
export type EmptyState = PositionDraftBuilder &
  Required<Pick<PositionDraftBuilder, "pool" | "slot0">>;

/**
 * Represents the builder state after the lower tick bound has been set (successfully or with an error).
 * This state includes the `lowerBoundTick` field, which holds an `Either` type indicating success or failure.
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const emptyState: Position.EmptyState;
 *
 * const stateWithLower: Position.EmptyState & Position.StateWithLowerBound =
 *   Position.setLowerTickBound(emptyState, (tick) => Tick.subtractNTicks(tick, 10));
 * ```
 */
export type StateWithLowerBound = PositionDraftBuilder &
  Required<Pick<PositionDraftBuilder, "lowerBoundTick">>;

/**
 * Represents the builder state after the upper tick bound has been set (successfully or with an error).
 * This state includes the `upperBoundTick` field, which holds an `Either` type indicating success or failure.
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const emptyState: Position.EmptyState;
 *
 * const stateWithUpper: Position.EmptyState & Position.StateWithUpperBound =
 *   Position.setUpperTickBound(emptyState, (tick) => Tick.addNTicks(tick, 10));
 * ```
 */
export type StateWithUpperBound = PositionDraftBuilder &
  Required<Pick<PositionDraftBuilder, "upperBoundTick">>;

/**
 * Represents the builder state once both the lower and upper tick bounds have been set (successfully or with errors).
 * This state combines `StateWithLowerBound` and `StateWithUpperBound`.
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const emptyState: Position.EmptyState;
 *
 * const stateWithBounds: Position.EmptyState & Position.StateWithBounds =
 *   Position.setUpperTickBound(
 *     Position.setLowerTickBound(emptyState, (tick) => Tick.subtractNTicks(tick, 10)),
 *     (tick) => Tick.addNTicks(tick, 10)
 *   );
 * ```
 */
export type StateWithBounds = StateWithLowerBound & StateWithUpperBound;

/**
 * Represents the builder state once a desired position size (defined by liquidity, a single amount, or both amounts)
 * has been set (successfully or with an error).
 * The specific fields (`liquidity`, `maxAmount0`, `maxAmount1`) included depend on the method used (`fromLiquidity`, `fromSingleAmount`, `fromAmounts`).
 *
 * @example
 * ```typescript
 * import { Position, Pool } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const stateWithBounds: Position.EmptyState & Position.StateWithBounds;
 *
 * const stateWithSize: Position.EmptyState & Position.StateWithBounds & Position.StateWithSize =
 *   Position.setSizeFromLiquidity(stateWithBounds, Pool.Liquidity(BigInt(1000000)));
 * ```
 */
export type StateWithSize = PositionDraftBuilder &
  (
    | Required<Pick<PositionDraftBuilder, "liquidity">>
    | Required<Pick<PositionDraftBuilder, "maxAmount0">>
    | Required<Pick<PositionDraftBuilder, "maxAmount1">>
  );

/**
 * Represents a builder state that is structurally ready for the final calculation into a `PositionDraft`.
 * It signifies that all necessary configuration steps (context, bounds, size) have been attempted.
 * The individual fields within this state might still hold `Either.Left<BuilderError>`, indicating configuration errors.
 * Final validation and calculation happen in the `finalizeDraft` step.
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const readyState: Position.BuilderReady;
 *
 * const result = Position.finalizeDraft(readyState);
 * // result is Either<PositionDraft, AggregateBuilderError>
 * ```
 */
export type BuilderReady = EmptyState & StateWithBounds & StateWithSize;

/**
 * Represents an aggregation of one or more `BuilderError`s encountered during the position draft construction process.
 * This is used by `finalizeDraft` to return all collected errors if the build process fails at any stage.
 *
 * @example
 * ```typescript
 * import { Either } from "effect";
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const readyState: Position.BuilderReady;
 *
 * const result = Position.finalizeDraft(readyState);
 *
 * Either.match(result, {
 *   onLeft: (aggError: Position.AggregateBuilderError) => {
 *     console.log("Errors encountered:");
 *     aggError.errors.forEach(error => {
 *       if (Position.isTickBoundsError(error)) {
 *         console.log("- Tick bounds error:", error.message);
 *       }
 *       // Handle other error types...
 *     });
 *   },
 *   onRight: (draft) => console.log("Position draft created successfully")
 * });
 * ```
 */
export type AggregateBuilderError = {
  readonly _tag: "AggregateBuilderError"; // TODO: FIX TAGS
  readonly errors: Array.NonEmptyArray<BuilderError>;
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

export const draftBuilderForTokens: {
  (
    token0: Token.AnyToken,
    token1: Token.AnyToken,
    fee: Adt.FeeAmount,
  ): Effect.Effect<EmptyState, FatalError | Error.BlockchainError, Pool.Tag | Chain.Tag>;
} = internal.draftBuilderForTokens;

/**
 * Sets the lower tick boundary based on a function relative to the nearest usable tick.
 * Calculates the tick and stores it as `Either.Right` on success, or `Either.Left<BuilderError>` on failure.
 *
 * This function supports both data-first and data-last variants:
 * - Data-first: `setLowerTickBound(builder, tickFn)`
 * - Data-last: `setLowerTickBound(tickFn)(builder)` (for use with pipe)
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
 * // Data-first usage
 * const builderWithLowerTick = Position.setLowerTickBound(
 *   initialState,
 *   (currentUsableTick) => Tick.subtractNTicks(currentUsableTick, 10)
 * );
 *
 * // Data-last usage with pipe
 * const builderWithLowerTickPiped = initialState.pipe(
 *   Position.setLowerTickBound((currentUsableTick) => Tick.subtractNTicks(currentUsableTick, 10))
 * );
 * ```
 */
export const setLowerTickBound: {
  <S extends EmptyState>(
    tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.UsableTick>,
  ): (builder: S) => S & StateWithLowerBound;
  <S extends EmptyState>(
    builder: S,
    tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.UsableTick>,
  ): S & StateWithLowerBound;
} = Function.dual(2, internal.setLowerTickBoundImpl);

/**
 * Sets the upper tick boundary based on a function relative to the nearest usable tick.
 * Calculates the tick, validates it's above the lower bound (if set), and stores it as `Either.Right` on success,
 * or `Either.Left<BuilderError>` on failure or validation error.
 *
 * This function supports both data-first and data-last variants:
 * - Data-first: `setUpperTickBound(builder, tickFn)`
 * - Data-last: `setUpperTickBound(tickFn)(builder)` (for use with pipe)
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
 * // Data-first usage
 * const builderWithUpperTick = Position.setUpperTickBound(
 *   stateWithLowerBound,
 *   (currentUsableTick) => Tick.addNTicks(currentUsableTick, 20)
 * );
 *
 * // Data-last usage with pipe
 * const builderWithUpperTickPiped = stateWithLowerBound.pipe(
 *   Position.setUpperTickBound((currentUsableTick) => Tick.addNTicks(currentUsableTick, 20))
 * );
 * ```
 */
export const setUpperTickBound: {
  <S extends EmptyState>(
    tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.UsableTick>,
  ): (builder: S) => S & StateWithUpperBound;
  <S extends EmptyState>(
    builder: S,
    tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.UsableTick>,
  ): S & StateWithUpperBound;
} = Function.dual(2, internal.setUpperTickBoundImpl);

/**
 * Sets the lower tick boundary based on a target price relative to the current price.
 * Converts the target price to a tick, validates it, and stores it as `Either.Right` on success,
 * or `Either.Left<BuilderError>` on failure or validation error.
 *
 * This function supports both data-first and data-last variants:
 * - Data-first: `setLowerPriceBound(builder, priceFn)`
 * - Data-last: `setLowerPriceBound(priceFn)(builder)` (for use with pipe)
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
 * ```
 */
export const setLowerPriceBound: {
  <S extends EmptyState>(
    priceFn: (currentPrice: Price.AnyTokenPrice) => Option.Option<Price.AnyTokenPrice>,
  ): (builder: S) => S & StateWithLowerBound;
  <S extends EmptyState>(
    builder: S,
    priceFn: (currentPrice: Price.AnyTokenPrice) => Option.Option<Price.AnyTokenPrice>,
  ): S & StateWithLowerBound;
} = Function.dual(2, internal.setLowerPriceBoundImpl);

/**
 * Sets the upper tick boundary based on a target price relative to the current price.
 * Converts the target price to a tick, validates it's above the lower bound (if set),
 * and stores it as `Either.Right` on success, or `Either.Left<BuilderError>` on failure or validation error.
 *
 * This function supports both data-first and data-last variants:
 * - Data-first: `setUpperPriceBound(builder, priceFn)`
 * - Data-last: `setUpperPriceBound(priceFn)(builder)` (for use with pipe)
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
 *
 * // Set upper bound 10% above the current price
 * const builderWithUpperPrice = Position.setUpperPriceBound(stateWithLowerBound, (currentPrice) => {
 *   const currentRatio = Price.asRatio(currentPrice);
 *   const targetRatio = currentRatio.multiply(BigMath.Ratio.fromString("1.10"));
 *   const targetPriceEither = Price.makeTokenPriceFromRatio(
 *     currentPrice.baseCurrency,
 *     currentPrice.quoteCurrency,
 *     targetRatio
 *   );
 *   // Handle potential error if needed, returning Option
 *   return Either.getRight(targetPriceEither);
 * });
 * ```
 */
export const setUpperPriceBound: {
  <S extends EmptyState>(
    priceFn: (currentPrice: Price.AnyTokenPrice) => Option.Option<Price.AnyTokenPrice>,
  ): (builder: S) => S & StateWithUpperBound;
  <S extends EmptyState>(
    builder: S,
    priceFn: (currentPrice: Price.AnyTokenPrice) => Option.Option<Price.AnyTokenPrice>,
  ): S & StateWithUpperBound;
} = Function.dual(2, internal.setUpperPriceBoundImpl);

/**
 * Sets the desired position size using a specific amount of a single token (token0 or token1).
 * The builder will later calculate the required amount of the *other* token and the resulting liquidity.
 * Clears any previously set size definitions (liquidity, maxAmount0/1).
 * Stores the provided amount as `Either.Right` or `Either.Left<BuilderError>` if validation fails (e.g., non-positive amount).
 * Sets the `_sizeDefinitionMethod` flag.
 *
 * This function supports both data-first and data-last variants:
 * - Data-first: `setSizeFromSingleAmount(builder, volume)`
 * - Data-last: `setSizeFromSingleAmount(volume)(builder)` (for use with pipe)
 *
 * @template S - The current state of the builder (must include pool and slot0).
 * @template T - The type of the token volume provided.
 * @param builder The current builder state.
 * @param volume The volume of the single token to base the position size on.
 * @returns A new builder state including either `maxAmount0` or `maxAmount1` (as an Either) and the `_sizeDefinitionMethod` flag.
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 * import { Token, TokenVolume } from "@liquidity_lab/effect-crypto";
 *
 * declare const stateWithBounds: Position.EmptyState & Position.StateWithBounds;
 * declare const wethToken: Token.Erc20LikeToken;
 *
 * // Create a token volume for 1 WETH
 * const wethVolume = TokenVolume.fromDecimal(wethToken, "1.0");
 *
 * // Data-first usage
 * const builderWithSize = Position.setSizeFromSingleAmount(stateWithBounds, wethVolume);
 *
 * // Data-last usage with pipe
 * const builderWithSizePiped = stateWithBounds.pipe(
 *   Position.setSizeFromSingleAmount(wethVolume)
 * );
 * ```
 */
export const setSizeFromSingleAmount: {
  <T extends Token.TokenType>(
    volume: TokenVolume.TokenVolume<T>,
  ): <S extends EmptyState>(builder: S) => S & StateWithSize;
  <S extends EmptyState, T extends Token.TokenType>(
    builder: S,
    volume: TokenVolume.TokenVolume<T>,
  ): S & StateWithSize;
} = Function.dual(2, internal.setSizeFromSingleAmountImpl);

/**
 * Sets the desired position size using a specific liquidity amount.
 * The builder will later calculate the required amounts of token0 and token1 based on this liquidity.
 * Clears any previously set size definitions (liquidity, maxAmount0/1).
 * Stores the provided liquidity as `Either.Right` or `Either.Left<BuilderError>` if validation fails (e.g., non-positive liquidity).
 * Sets the `_sizeDefinitionMethod` flag to 'liquidity'.
 *
 * This function supports both data-first and data-last variants:
 * - Data-first: `setSizeFromLiquidity(builder, liquidity)`
 * - Data-last: `setSizeFromLiquidity(liquidity)(builder)` (for use with pipe)
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
 * // Data-first usage
 * const builderWithSize = Position.setSizeFromLiquidity(stateWithBounds, liquidityValue);
 *
 * // Data-last usage with pipe
 * const builderWithSizePiped = stateWithBounds.pipe(
 *   Position.setSizeFromLiquidity(liquidityValue)
 * );
 * ```
 */
export const setSizeFromLiquidity: {
  <S extends EmptyState>(liquidity: Pool.Liquidity): (builder: S) => S & StateWithSize;
  <S extends EmptyState>(builder: S, liquidity: Pool.Liquidity): S & StateWithSize;
} = Function.dual(2, internal.setSizeFromLiquidityImpl);

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
 *   onLeft: (error) => {
 *     Position.matchBuilderError({
 *       [Position.InvalidTickBoundsError]: (error) => `Tick bounds: ${error.message}`,
 *       [Position.InvalidUpperTickError]: (error) => `Upper tick: ${error.message}`,
 *       [Position.InvalidLowerTickError]: (error) => `Lower tick: ${error.message}`,
 *       [Position.InvalidSizeError]: (error) => `Size: ${error.message}`,
 *       [Position.InvalidPriceError]: (error) => `Price: ${error.message}`
 *     })
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
 * This function supports both data-first and data-last variants:
 * - Data-first: `finalizeDraftOrThrow(state, errorHandler)`
 * - Data-last: `finalizeDraftOrThrow(errorHandler)(state)` (for use with pipe)
 *
 * @param state A builder state that structurally matches `BuilderReady`.
 * @param errorHandler A function that converts the `AggregateBuilderError` into a standard `Error` to be thrown.
 * @returns The successfully calculated `PositionDraft` if no errors occur.
 * @throws An `Error` generated by the `errorHandler` if `finalizeDraft` returns `Either.Left`.
 *
 * @example
 * ```typescript
 * import { Position } from "@liquidity_lab/effect-crypto-uniswap";
 *
 * declare const readyState: Position.BuilderReady;
 *
 * // Create error handler using pattern matching for clean, exhaustive error handling
 * const customErrorHandler = (aggError: Position.AggregateBuilderError): Error => {
 *   const handleError = Position.matchBuilderError({
 *     [Position.InvalidTickBoundsError]: (error) => `Tick bounds: ${error.message}`,
 *     [Position.InvalidUpperTickError]: (error) => `Upper tick: ${error.message}`,
 *     [Position.InvalidLowerTickError]: (error) => `Lower tick: ${error.message}`,
 *     [Position.InvalidSizeError]: (error) => `Size: ${error.message}`,
 *     [Position.InvalidPriceError]: (error) => `Price: ${error.message}`
 *   });
 *
 *   const messages = aggError.errors.map(handleError).join("\n");
 *   return new Error(`Position Draft Error:\n${messages}`);
 * };
 *
 * // Data-first usage
 * try {
 *   const positionDraft = Position.finalizeDraftOrThrow(readyState, customErrorHandler);
 *   console.log("Position Draft Created:", positionDraft);
 *   // Use the positionDraft for minting...
 * } catch (error) {
 *   console.error(error); // Catches the error thrown by customErrorHandler
 *   // Handle the error appropriately
 * }
 *
 * // Data-last usage with pipe
 * try {
 *   const positionDraft = readyState.pipe(
 *     Position.finalizeDraftOrThrow(customErrorHandler)
 *   );
 *   console.log("Position Draft Created:", positionDraft);
 * } catch (error) {
 *   console.error(error);
 * }
 * ```
 */
export const finalizeDraftOrThrow: {
  (
    errorHandler: (aggError: AggregateBuilderError) => Error,
  ): (state: BuilderReady) => PositionDraft;
  (state: BuilderReady, errorHandler: (aggError: AggregateBuilderError) => Error): PositionDraft;
} = Function.dual(2, internal.finalizeDraftOrThrowImpl);
