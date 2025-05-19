import { BigDecimal, MathContext } from "bigdecimal.js";
import { Array, Either, Option, identity } from "effect";

import { BigMath } from "@liquidity_lab/effect-crypto";
import { EffectUtils } from "@liquidity_lab/effect-crypto/utils";

import * as Adt from "./adt.js";
import * as Internal from "./internal.js";
import * as Pool from "./pool.js";
import type * as T from "./position.js";
import * as Price from "./price.js";
import * as Tick from "./tick.js";

// class PoolIsNotFoundErrorLive implements T.PoolIsNotFoundError {
//   readonly _tag = "@liquidity_lab/effect-crypto-uniswap/position#PoolIsNotFoundError";

//   constructor(
//     readonly token0: Token.Erc20LikeToken,
//     readonly token1: Token.Erc20LikeToken,
//     readonly fee: Adt.FeeAmount,
//   ) {}
// }

/**
 * @internal
 * Represents an error that occurs during the position draft builder process.
 * This class implements the `T.BuilderError` interface.
 */
class BuilderErrorLive<Field extends keyof T.PositionDraftBuilder | "calculation" | "validation">
  implements T.BuilderError<Field> {
  readonly _tag = "BuilderError";

  /**
   * Private constructor to enforce the use of static factory methods.
   * @param field - The specific field in the builder where the error occurred, or 'calculation'/'validation'.
   * @param message - A descriptive error message.
   */
  private constructor(
    readonly field: Field,
    readonly message: string,
  ) { }

  /**
   * Creates a `BuilderError` specifically for issues related to the `lowerBoundTick` field.
   *
   * @param message - The specific error message.
   * @returns A new `BuilderErrorLive<"lowerBoundTick">` instance, typed as `T.BuilderError<"lowerBoundTick">`.
   */
  static lowerBoundTick(message: string): T.BuilderError<"lowerBoundTick"> {
    return new BuilderErrorLive("lowerBoundTick", message);
  }

  /**
   * Creates a `BuilderError` specifically for issues related to the `upperBoundTick` field.
   *
   * @param message - The specific error message.
   * @returns A new `BuilderErrorLive<"upperBoundTick">` instance, typed as `T.BuilderError<"upperBoundTick">`.
   */
  static upperBoundTick(message: string): T.BuilderError<"upperBoundTick"> {
    return new BuilderErrorLive("upperBoundTick", message);
  }

  /**
   * Creates a `BuilderError` specifically for liquidity-related issues.
   *
   * @param message - The specific error message.
   * @returns A new `BuilderErrorLive<"liquidity">` instance, typed as `T.BuilderError<"liquidity">`.
   */
  static liquidity(message: string): T.BuilderError<"liquidity"> {
    return new BuilderErrorLive("liquidity", message);
  }

  /**
   * Creates a `BuilderError` specifically for validation-related issues.
   *
   * @param message - The specific error message.
   * @returns A new `BuilderErrorLive<"validation">` instance, typed as `T.BuilderError<"validation">`.
   */
  static validation(message: string): T.BuilderError<"validation"> {
    return new BuilderErrorLive("validation", message);
  }
}

class PositionDraftLive implements T.PositionDraft {
  readonly _tag = "@liquidity_lab/effect-crypto-uniswap/position#MintablePosition";

  private constructor(
    readonly poolId: Pool.PoolState,
    readonly tickLower: Tick.UsableTick,
    readonly tickUpper: Tick.UsableTick,
    readonly tickCurrent: Tick.Tick,
    readonly desiredAmount0: Adt.Amount0,
    readonly desiredAmount1: Adt.Amount1,
    readonly liquidity: Pool.Liquidity,
    readonly sqrtRatio: BigMath.Ratio,
  ) { }

  static make(
    poolId: Pool.PoolState,
    tickLower: Tick.UsableTick,
    tickUpper: Tick.UsableTick,
    tickCurrent: Tick.Tick,
    desiredAmount0: Adt.Amount0,
    desiredAmount1: Adt.Amount1,
    liquidity: Pool.Liquidity,
    sqrtRatio: BigMath.Ratio,
  ): Either.Either<T.PositionDraft, Array.NonEmptyArray<T.BuilderError<"validation">>> {
    return EffectUtils.mapParN(
      [
        Either.right([tickLower, tickUpper]).pipe(
          Either.filterOrLeft(
            ([tickLower, tickUpper]) => tickLower >= tickUpper,
            () =>
              Array.make(
                BuilderErrorLive.validation(
                  `TickLower[${tickLower.unwrap}] must be less than TickUpper[${tickUpper.unwrap}]`,
                ),
              ),
          ),
        ),
        Either.right(poolId).pipe(
          Either.filterOrLeft(
            (poolId) =>
              Tick.toTickSpacing(poolId.fee) === tickLower.spacing &&
              tickLower.spacing === tickUpper.spacing,
            () =>
              Array.make(
                BuilderErrorLive.validation(
                  `TickLower.spacing[${tickLower.spacing}] and ` +
                  `TickUpper.spacing[${tickUpper.spacing}] must be the same as pool spacing[${Tick.toTickSpacing(poolId.fee)}]`,
                ),
              ),
          ),
        ),
      ],
      ([[tickLower, tickUpper], poolId]) =>
        new PositionDraftLive(
          poolId,
          tickLower,
          tickUpper,
          tickCurrent,
          desiredAmount0,
          desiredAmount1,
          liquidity,
          sqrtRatio,
        ),
    );
  }
}

export const makePositionDraft = PositionDraftLive.make;

export function calculatePositionDraftFromLiquidity(
  poolId: Pool.PoolState,
  sqrtPrice: BigMath.Ratio,
  liquidity: Pool.Liquidity,
  tickLower: Tick.UsableTick,
  tickUpper: Tick.UsableTick,
  tickCurrent: Tick.Tick,
): Either.Either<
  T.PositionDraft,
  Array.NonEmptyArray<T.BuilderError<"calculation" | "validation">>
> {
  const [amount0Desired, amount1Desired] = mintAmountsImpl(
    tickCurrent,
    tickLower,
    tickUpper,
    liquidity,
    sqrtPrice,
  );

  const positionDraft = makePositionDraft(
    poolId,
    tickLower,
    tickUpper,
    tickCurrent,
    amount0Desired,
    amount1Desired,
    liquidity,
    sqrtPrice,
  );

  return positionDraft;
}

export function calculatePositionDraftFromAmounts(
  poolId: Pool.PoolState,
  slot0: Pool.Slot0,
  maxAmount0: Adt.Amount0,
  maxAmount1: Adt.Amount1,
  tickLower: Tick.UsableTick,
  tickUpper: Tick.UsableTick,
) {
  // It is safe to construct a ratio from the sqrt of the price since we know that the value is always positive
  const sqrtPrice = Price.asSqrt(slot0.price);
  const sqrtRatioA = Tick.getSqrtRatio(tickLower);
  const sqrtRatioB = Tick.getSqrtRatio(tickUpper);

  const liquidity = maxLiquidityForAmountsImpl(
    sqrtPrice,
    sqrtRatioA,
    sqrtRatioB,
    maxAmount0,
    maxAmount1,
    Internal.mathContext,
  );

  return calculatePositionDraftFromLiquidity(
    poolId,
    sqrtPrice,
    liquidity,
    tickLower,
    tickUpper,
    slot0.tick,
  );
}

/* 
// DO NOT REMOVE IT IS TEMPORARY COMMENTED CODE

export const mint = FunctionUtils.withOptionalServiceApi(Pool.Tag, mintImpl).value;

function mintImpl(descriptor: Pool.PoolsDescriptor, params: T.PositionDraft) /!*: Effect.Effect<
  Option.Option<string>,
  Error.BlockchainError | Error.TransactionFailedError | FatalError,
  Wallet.Tag
>*!/ {
  return Wallet.withApproval(
    [params.maxVolume0, params.maxVolume1],
    descriptor.positionManagerAddress,
  )((walletAddress) =>
    Effect.gen(function* () {
      const poolId = yield* getPoolId();
      const [slot0, liquidity] = yield* Effect.all([Pool.slot0(poolId), Pool.liquidity(poolId)], {
        concurrency: "unbounded",
      });

      const sqrtPrice = Big(slot0.price.asUnits).sqrt(Internal.mathContext);
      const sqrtRatioA = Tick.getSqrtRatio(params.tickLower);
      const sqrtRatioB = Tick.getSqrtRatio(params.tickUpper);
      const targetLiquidity = maxLiquidityForAmountsImpl(
        sqrtPrice,
        sqrtRatioA,
        sqrtRatioB,
        params.maxAmount0,
        params.maxAmount1,
        Internal.mathContext,
      );

      const [amount0Desired, amount1Desired] = mintAmountsImpl(
        slot0.tick,
        params.tickLower,
        params.tickUpper,
        targetLiquidity,
        sqrtPrice,
      );

      // TODO: add slippage support
    }),
  );

  function getPoolId() {
    return Effect.flatMap(
      Pool.fetchState(descriptor, params.token0, params.token1, params.fee),
      (poolIdOpt) =>
        Option.match(poolIdOpt, {
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail<T.PoolIsNotFoundError>(
              new PoolIsNotFoundErrorLive(params.token0, params.token1, params.fee),
            ),
        }),
    );
  }
}*/

export function maxLiquidityForAmountsImpl(
  sqrtRatioCurrent: BigDecimal,
  sqrtRatioA: BigDecimal,
  sqrtRatioB: BigDecimal,
  maxAmount0: Adt.Amount0,
  maxAmount1: Adt.Amount1,
  mc: MathContext,
): Pool.Liquidity {
  if (sqrtRatioCurrent.lowerThanOrEquals(sqrtRatioA)) {
    return maxLiquidityForAmount0Impl(sqrtRatioA, sqrtRatioB, maxAmount0, mc);
  } else if (sqrtRatioCurrent.lowerThan(sqrtRatioB)) {
    const liquidity0 = maxLiquidityForAmount0Impl(sqrtRatioCurrent, sqrtRatioB, maxAmount0, mc);
    const liquidity1 = maxLiquidityForAmount1Impl(sqrtRatioA, sqrtRatioCurrent, maxAmount1, mc);

    return Pool.Liquidity(liquidity0.min(liquidity1)); // TODO: add min method to Pool.Liquidity
  }

  return maxLiquidityForAmount1Impl(sqrtRatioA, sqrtRatioB, maxAmount1, mc);
}

function maxLiquidityForAmount0Impl(
  sqrtRatioA: BigDecimal,
  sqrtRatioB: BigDecimal,
  amount0: Adt.Amount0,
  mc: MathContext,
): Pool.Liquidity {
  const numerator = amount0.multiply(sqrtRatioA).multiply(sqrtRatioB);
  const denominator = sqrtRatioB.subtract(sqrtRatioA);

  return Pool.Liquidity(numerator.divideWithMathContext(denominator, mc));
}

function maxLiquidityForAmount1Impl(
  sqrtRatioA: BigDecimal,
  sqrtRatioB: BigDecimal,
  amount1: Adt.Amount1,
  mc: MathContext,
): Pool.Liquidity {
  const denominator = sqrtRatioB.subtract(sqrtRatioA);

  return Pool.Liquidity(amount1.divideWithMathContext(denominator, mc));
}

function mintAmountsImpl(
  tickCurrent: Tick.Tick,
  tickLower: Tick.UsableTick,
  tickUpper: Tick.UsableTick,
  positionLiquidity: Pool.Liquidity,
  sqrtRatioCurrent: BigDecimal,
): [Adt.Amount0, Adt.Amount1] {
  if (tickCurrent < tickLower.unwrap) {
    // the current price is lower than position's price, the amount0 will only be used
    return [
      getAmount0Delta(
        Tick.getSqrtRatio(tickLower),
        Tick.getSqrtRatio(tickUpper),
        positionLiquidity,
      ),
      Adt.Amount1.zero,
    ];
  } else if (tickCurrent < tickUpper.unwrap) {
    // the current price is in the range of position's price, both of the amount0 and amount1 will be used
    return [
      getAmount0Delta(sqrtRatioCurrent, Tick.getSqrtRatio(tickUpper), positionLiquidity),
      getAmount1Delta(Tick.getSqrtRatio(tickLower), sqrtRatioCurrent, positionLiquidity),
    ];
  } else {
    // the current price is higher than position's price, the amount1 will only be used
    return [
      Adt.Amount0.zero,
      getAmount1Delta(
        Tick.getSqrtRatio(tickLower),
        Tick.getSqrtRatio(tickUpper),
        positionLiquidity,
      ),
    ];
  }
}

function getAmount0Delta(
  sqrtRatioA: BigDecimal,
  sqrtRatioB: BigDecimal,
  liquidity: Pool.Liquidity,
): Adt.Amount0 {
  const delta = sqrtRatioB.subtract(sqrtRatioA);

  return Adt.Amount0(
    delta
      .multiply(liquidity)
      .divideWithMathContext(sqrtRatioB, Internal.mathContext)
      .divideWithMathContext(sqrtRatioA, Internal.mathContext),
  );
}

function getAmount1Delta(
  sqrtRatioA: BigDecimal,
  sqrtRatioB: BigDecimal,
  liquidity: Pool.Liquidity,
): Adt.Amount1 {
  const delta = sqrtRatioB.subtract(sqrtRatioA);

  return Adt.Amount1(liquidity.multiply(delta));
}

export const draftBuilder: {
  (pool: Pool.PoolState, slot0: Pool.Slot0): T.EmptyState;
} = (pool: Pool.PoolState, slot0: Pool.Slot0): T.EmptyState => {
  return {
    pool: pool,
    slot0: slot0,
  };
};

/**
 * @internal
 * Internal implementation for setting the lower tick boundary of a position draft.
 *
 * This function takes the current builder state and a user-provided function (`tickFn`)
 * to determine the lower tick boundary. It calculates the nearest usable tick based on
 * the pool's current tick and fee tier (tick spacing). The `tickFn` is then applied to
 * this nearest usable tick.
 *
 * The result, which is either the calculated lower tick or a `BuilderError` if any step fails
 * (e.g., nearest usable tick cannot be determined, or `tickFn` returns `None`),
 * is stored in the `lowerBoundTick` field of the new builder state.
 *
 * @template S - The type of the current builder state, which must at least be `T.EmptyState`.
 * @param builder - The current state of the position draft builder.
 * @param tickFn - A function that takes a `Tick.UsableTick` (the nearest usable tick to the current pool tick)
 *                 and returns an `Option.Option<Tick.UsableTick>` representing the desired lower tick.
 * @returns A new builder state (`S & T.StateWithLowerBound`) that includes the `lowerBoundTick` field.
 *          The `lowerBoundTick` field will contain an `Either.Either<Tick.Tick, T.BuilderError<"lowerBoundTick">>`.
 */
export const setLowerTickBoundImpl = <S extends T.EmptyState>(
  builder: S,
  tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.UsableTick>,
): S & T.StateWithLowerBound => {
  const poolState = builder.pool;
  const slot0 = builder.slot0;
  const currentTick = slot0.tick;
  const tickSpacing = Tick.toTickSpacing(poolState.fee);

  // Step 1: Calculate the nearest usable tick to the current pool tick.
  // Tick.nearestUsableTick directly returns UsableTick, not Option<UsableTick>.
  const nearestUsableTickForCurrent = Tick.nearestUsableTick(currentTick, tickSpacing);

  // Step 2: Apply the user's tickFn to the nearest usable tick.
  // The tickFn itself returns an Option, which we need to handle.
  const lowerBoundTick = Either.fromOption(tickFn(nearestUsableTickForCurrent), () =>
    Array.make(
      BuilderErrorLive.lowerBoundTick(
        "The provided tick function (tickFn) did not return a valid lower tick (returned None). " +
        "Ensure the function returns Some(UsableTick) for a valid lower bound.",
      ),
    ),
  );

  // Step 3: Return the new builder state.
  return {
    ...builder,
    lowerBoundTick,
  };
};

/**
 * @internal
 * Internal implementation for setting the upper tick boundary of a position draft.
 *
 * This function takes the current builder state and a user-provided function (`tickFn`)
 * to determine the upper tick boundary. It calculates the nearest usable tick based on
 * the pool's current tick and fee tier (tick spacing). The `tickFn` is then applied to
 * this nearest usable tick.
 *
 * The result, which is either the calculated upper tick or a `BuilderError` if any step fails
 * (e.g., nearest usable tick cannot be determined, or `tickFn` returns `None`),
 * is stored in the `upperBoundTick` field of the new builder state.
 * As per current requirements, this function does NOT validate if upperTick > lowerTick.
 *
 * @template S - The type of the current builder state, which must at least be `T.EmptyState`.
 * @param builder - The current state of the position draft builder.
 * @param tickFn - A function that takes a `Tick.UsableTick` (the nearest usable tick to the current pool tick)
 *                 and returns an `Option.Option<Tick.UsableTick>` representing the desired upper tick.
 * @returns A new builder state (`S & T.StateWithUpperBound`) that includes the `upperBoundTick` field.
 *          The `upperBoundTick` field will contain an `Either.Either<Tick.UsableTick, T.BuilderError<"upperBoundTick">>`.
 */
export const setUpperTickBoundImpl = <S extends T.EmptyState>(
  builder: S,
  tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.UsableTick>,
): S & T.StateWithUpperBound => {
  const poolState = builder.pool;
  const slot0 = builder.slot0;
  const currentTick = slot0.tick;
  const tickSpacing = Tick.toTickSpacing(poolState.fee);

  // Step 1: Calculate the nearest usable tick to the current pool tick.
  const nearestUsableTickForCurrent = Tick.nearestUsableTick(currentTick, tickSpacing);

  // Step 2: Apply the user's tickFn to the nearest usable tick.
  // The tickFn itself returns an Option, which we need to handle.
  const upperBoundTick = Either.fromOption(tickFn(nearestUsableTickForCurrent), () =>
    Array.make(
      BuilderErrorLive.upperBoundTick(
        // Use the new error type for upper bound
        "The provided tick function (tickFn) did not return a valid upper tick (returned None). " +
        "Ensure the function returns Some(UsableTick) for a valid upper bound.",
      ),
    ),
  );

  // Step 3: Return the new builder state.
  return {
    ...builder,
    upperBoundTick, // Set the upperBoundTick field
  };
};

/** @internal */
export const setSizeFromLiquidityImpl = <S extends T.EmptyState>(
  builder: S,
  liquidity: Pool.Liquidity, // Assumed pre-validated by its brand
): S & T.StateWithSize => {
  return {
    ...builder,
    liquidity: Either.right(liquidity),
    maxAmount0: undefined,
    maxAmount1: undefined,
    _sizeDefinitionMethod: "liquidity" as const,
  };
};

class AggregateBuilderErrorLive implements T.AggregateBuilderError {
  readonly _tag = "AggregateBuilderError";

  constructor(readonly errors: Array.NonEmptyArray<T.BuilderError>) { }

  static fromBuilderError(
    error: T.BuilderError | Array.NonEmptyArray<T.BuilderError>,
  ): T.AggregateBuilderError {
    return new AggregateBuilderErrorLive(Array.isArray(error) ? error : [error]);
  }
}

export function finalizeDraftImpl<S extends T.BuilderReady>(
  builder: S,
): Either.Either<T.PositionDraft, T.AggregateBuilderError> {
  if (Either.isEither(builder.liquidity)) {
    return EffectUtils.mapParN(
      [builder.liquidity, builder.lowerBoundTick, builder.upperBoundTick],
      ([liquidity, tickLower, tickUpper]) => calculatePositionDraftFromLiquidity(
        builder.pool,
        Price.asSqrt(builder.slot0.price),
        liquidity,
        tickLower,
        tickUpper,
        builder.slot0.tick,
      ),
    ).pipe(
      Either.flatMap(identity),
      Either.mapLeft(AggregateBuilderErrorLive.fromBuilderError),
    );
  }

  return Either.left(
    new AggregateBuilderErrorLive([
      BuilderErrorLive.validation(
        "Unknown combination of setting position size. Currently supported ways are: " +
        "1. setSizeFromLiquidity, 2. setSizeFromSingleAmount(amount0 | amount1)",
      ),
    ]),
  );
}
