import { BigDecimal, MathContext } from "bigdecimal.js";
import { Either, Option } from "effect";

import { BigMath } from "@liquidity_lab/effect-crypto";

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

class PositionDraftLive implements T.PositionDraft {
  readonly _tag = "@liquidity_lab/effect-crypto-uniswap/position#MintablePosition";

  private constructor(
    readonly poolId: Pool.PoolState,
    readonly tickLower: Tick.Tick,
    readonly tickUpper: Tick.Tick,
    readonly tickCurrent: Tick.Tick,
    readonly desiredAmount0: Adt.Amount0,
    readonly desiredAmount1: Adt.Amount1,
    readonly liquidity: Pool.Liquidity,
    readonly sqrtRatio: BigMath.Ratio,
  ) {}

  static make(
    poolId: Pool.PoolState,
    tickLower: Tick.Tick,
    tickUpper: Tick.Tick,
    tickCurrent: Tick.Tick,
    desiredAmount0: Adt.Amount0,
    desiredAmount1: Adt.Amount1,
    liquidity: Pool.Liquidity,
    sqrtRatio: BigMath.Ratio,
  ): Either.Either<T.PositionDraft, string> {
    if (tickLower >= tickUpper) {
      return Either.left("TickLower must be less than TickUpper");
    }

    return Either.right(
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
  tickLower: Tick.Tick,
  tickUpper: Tick.Tick,
  tickCurrent: Tick.Tick,
) {
  const [amount0Desired, amount1Desired] = mintAmountsImpl(
    tickCurrent,
    tickLower,
    tickUpper,
    liquidity,
    sqrtPrice,
  );

  return makePositionDraft(
    poolId,
    tickLower,
    tickUpper,
    tickCurrent,
    amount0Desired,
    amount1Desired,
    liquidity,
    sqrtPrice,
  );
}

export function calculatePositionDraftFromAmounts(
  poolId: Pool.PoolState,
  slot0: Pool.Slot0,
  maxAmount0: Adt.Amount0,
  maxAmount1: Adt.Amount1,
  tickLower: Tick.Tick,
  tickUpper: Tick.Tick,
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
  tickLower: Tick.Tick,
  tickUpper: Tick.Tick,
  positionLiquidity: Pool.Liquidity,
  sqrtRatioCurrent: BigDecimal,
): [Adt.Amount0, Adt.Amount1] {
  if (tickCurrent < tickLower) {
    // the current price is lower than position's price, the amount0 will only be used
    return [
      getAmount0Delta(
        Tick.getSqrtRatio(tickLower),
        Tick.getSqrtRatio(tickUpper),
        positionLiquidity,
      ),
      Adt.Amount1.zero,
    ];
  } else if (tickCurrent < tickUpper) {
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

/**
 * @internal
 * Represents an error that occurs during the position draft builder process.
 * This class implements the `T.BuilderError` interface.
 */
class BuilderErrorLive<Field extends keyof T.PositionDraftBuilder | "calculation" | "validation">
  implements T.BuilderError<Field>
{
  readonly _tag = "BuilderError";

  /**
   * Private constructor to enforce the use of static factory methods.
   * @param field - The specific field in the builder where the error occurred, or 'calculation'/'validation'.
   * @param message - A descriptive error message.
   */
  private constructor(
    readonly field: Field,
    readonly message: string,
  ) {}

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

  // Add other specific static error constructors here as needed, e.g.:
  // static upperBoundTick(message: string): T.BuilderError<"upperBoundTick"> {
  //   return new BuilderErrorLive("upperBoundTick", message);
  // }
  // static calculation(message: string): T.BuilderError<"calculation"> {
  //   return new BuilderErrorLive("calculation", message);
  // }
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
    BuilderErrorLive.lowerBoundTick(
      "The provided tick function (tickFn) did not return a valid lower tick (returned None). " +
        "Ensure the function returns Some(UsableTick) for a valid lower bound.",
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
    BuilderErrorLive.upperBoundTick(
      // Use the new error type for upper bound
      "The provided tick function (tickFn) did not return a valid upper tick (returned None). " +
        "Ensure the function returns Some(UsableTick) for a valid upper bound.",
    ),
  );

  // Step 3: Return the new builder state.
  return {
    ...builder,
    upperBoundTick, // Set the upperBoundTick field
  };
};
