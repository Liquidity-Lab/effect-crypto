import { Big, BigDecimal, MathContext } from "bigdecimal.js";
import { Array, Data, Effect, Either, Option, Pipeable, identity } from "effect";

import {
  BigMath,
  Chain,
  Error,
  FatalError,
  FatalErrorString,
  Token,
  TokenVolume,
} from "@liquidity_lab/effect-crypto";
import { EffectUtils } from "@liquidity_lab/effect-crypto/utils";

import * as Adt from "./adt.js";
import * as Internal from "./internal.js";
import * as Pool from "./pool.js";
import type * as T from "./position.js";
import * as Price from "./price.js";
import * as Tick from "./tick.js";

/** @internal */
export const NAMESPACE = "@liquidity_lab/effect-crypto-uniswap/position" as const;

/** @internal */
export const InvalidTickBoundsErrorSymbol =
  `${NAMESPACE}#BuilderError/InvalidTickBoundsError` as const;

/** @internal */
export const InvalidUpperTickErrorSymbol =
  `${NAMESPACE}#BuilderError/InvalidUpperTickError` as const;

/** @internal */
export const InvalidLowerTickErrorSymbol =
  `${NAMESPACE}#BuilderError/InvalidLowerTickError` as const;

/** @internal */
export const InvalidPriceErrorSymbol = `${NAMESPACE}#BuilderError/InvalidPriceError` as const;

/** @internal */
export const InvalidSizeErrorSymbol = `${NAMESPACE}#BuilderError/InvalidSizeError` as const;

/** @internal */
export const InvalidAmountErrorSymbol = `${NAMESPACE}#BuilderError/InvalidAmountError` as const;

/** @internal */
export const BuilderErrorLive: Data.TaggedEnum.Constructor<T.BuilderError> =
  Data.taggedEnum<T.BuilderError>();

/** @internal */
export const InvalidTickBoundsErrorConstructor: T.CaseConstructorWithTag<
  typeof InvalidTickBoundsErrorSymbol
> = Object.assign(
  { tag: InvalidTickBoundsErrorSymbol },
  BuilderErrorLive[InvalidTickBoundsErrorSymbol],
);

/** @internal */
export const InvalidUpperTickErrorConstructor: T.CaseConstructorWithTag<
  typeof InvalidUpperTickErrorSymbol
> = Object.assign(
  { tag: InvalidUpperTickErrorSymbol },
  BuilderErrorLive[InvalidUpperTickErrorSymbol],
);

/** @internal */
export const InvalidLowerTickErrorConstructor: T.CaseConstructorWithTag<
  typeof InvalidLowerTickErrorSymbol
> = Object.assign(
  { tag: InvalidLowerTickErrorSymbol },
  BuilderErrorLive[InvalidLowerTickErrorSymbol],
);

/** @internal */
export const InvalidPriceErrorConstructor: T.CaseConstructorWithTag<
  typeof InvalidPriceErrorSymbol
> = Object.assign({ tag: InvalidPriceErrorSymbol }, BuilderErrorLive[InvalidPriceErrorSymbol]);

/** @internal */
export const InvalidSizeErrorConstructor: T.CaseConstructorWithTag<typeof InvalidSizeErrorSymbol> =
  Object.assign({ tag: InvalidSizeErrorSymbol }, BuilderErrorLive[InvalidSizeErrorSymbol]);

/** @internal */
export const InvalidAmountErrorConstructor: T.CaseConstructorWithTag<
  typeof InvalidAmountErrorSymbol
> = Object.assign({ tag: InvalidAmountErrorSymbol }, BuilderErrorLive[InvalidAmountErrorSymbol]);

class PositionDraftLive implements T.PositionDraft {
  readonly _tag = `${NAMESPACE}#MintablePosition` as const;

  constructor(
    readonly poolId: Pool.PoolState,
    readonly tickLower: Tick.UsableTick,
    readonly tickUpper: Tick.UsableTick,
    readonly tickCurrent: Tick.Tick,
    readonly desiredAmount0: Adt.Amount0,
    readonly desiredAmount1: Adt.Amount1,
    readonly liquidity: Pool.Liquidity,
    readonly sqrtRatio: BigMath.Ratio,
  ) {}
}

export function calculatePositionDraftFromLiquidity(
  poolId: Pool.PoolState,
  sqrtPrice: BigMath.Ratio,
  liquidity: Pool.Liquidity,
  tickLower: Tick.UsableTick,
  tickUpper: Tick.UsableTick,
  tickCurrent: Tick.Tick,
): T.PositionDraft {
  const [amount0Desired, amount1Desired] = mintAmountsImpl(
    tickCurrent,
    tickLower,
    tickUpper,
    liquidity,
    sqrtPrice,
  );

  const positionDraft = new PositionDraftLive(
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
  const numerator = Big(amount0).multiply(sqrtRatioA).multiply(sqrtRatioB);
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

  return Pool.Liquidity(Big(amount1).divideWithMathContext(denominator, mc));
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
      .divideWithMathContext(sqrtRatioA, Internal.mathContext)
      .toBigInt(),
  );
}

function getAmount1Delta(
  sqrtRatioA: BigDecimal,
  sqrtRatioB: BigDecimal,
  liquidity: Pool.Liquidity,
): Adt.Amount1 {
  const delta = sqrtRatioB.subtract(sqrtRatioA);

  return Adt.Amount1(liquidity.multiply(delta).toBigInt());
}

export const draftBuilder: {
  (pool: Pool.PoolState, slot0: Pool.Slot0): T.EmptyState;
} = (pool: Pool.PoolState, slot0: Pool.Slot0): T.EmptyState => {
  // Create a concrete implementation that includes the pipe method
  const instance: T.EmptyState = {
    pool: pool,
    slot0: slot0,

    pipe() {
      // eslint-disable-next-line prefer-rest-params
      return Pipeable.pipeArguments(instance, arguments);
    },
  } as T.EmptyState;

  return instance;
};

export function draftBuilderForTokens(
  token0: Token.AnyToken,
  token1: Token.AnyToken,
  fee: Adt.FeeAmount,
): Effect.Effect<T.EmptyState, FatalError | Error.BlockchainError, Pool.Tag | Chain.Tag> {
  const prog = Effect.gen(function* () {
    const poolState: Pool.PoolState = yield* yield* Pool.fetchState(token0, token1, fee);
    const slot0: Pool.Slot0 = yield* Pool.fetchSlot0(poolState);

    return draftBuilder(poolState, slot0);
  });

  return Effect.mapError(prog, (err) => {
    if (err._tag === "NoSuchElementException") {
      return FatalErrorString("Pool not found");
    }

    return err;
  });
}

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
      BuilderErrorLive[InvalidLowerTickErrorSymbol]({
        message:
          "The provided tick function (tickFn) did not return a valid lower tick (returned None). " +
          "Ensure the function returns Some(UsableTick) for a valid lower bound.",
      }),
    ),
  );

  // Step 3: Return the new builder state with pipe method.
  const instance = {
    ...builder,
    lowerBoundTick,

    pipe() {
      // eslint-disable-next-line prefer-rest-params
      return Pipeable.pipeArguments(instance, arguments);
    },
  } as S & T.StateWithLowerBound;

  return instance;
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
      BuilderErrorLive[InvalidUpperTickErrorSymbol]({
        message:
          "The provided tick function (tickFn) did not return a valid upper tick (returned None). " +
          "Ensure the function returns Some(UsableTick) for a valid upper bound.",
      }),
    ),
  );

  // Step 3: Return the new builder state with pipe method.
  const instance = {
    ...builder,
    upperBoundTick, // Set the upperBoundTick field

    pipe() {
      // eslint-disable-next-line prefer-rest-params
      return Pipeable.pipeArguments(instance, arguments);
    },
  } as S & T.StateWithUpperBound;

  return instance;
};

/**
 * @internal
 * Internal implementation for setting the position size using a specific liquidity amount.
 *
 * This function takes the current builder state and a pre-validated liquidity amount.
 * It stores the provided liquidity as `Either.Right` or `Either.Left<BuilderError>` if validation fails (e.g., non-positive liquidity).
 */
export const setSizeFromLiquidityImpl = <S extends T.EmptyState>(
  builder: S,
  liquidity: Pool.Liquidity, // Assumed pre-validated by its brand
): S & T.StateWithSize => {
  const instance = {
    ...builder,
    liquidity: Either.right(liquidity),
    maxAmount0: undefined,
    maxAmount1: undefined,
    _sizeDefinitionMethod: "liquidity" as const,

    pipe() {
      // eslint-disable-next-line prefer-rest-params
      return Pipeable.pipeArguments(instance, arguments);
    },
  } as S & T.StateWithSize;

  return instance;
};

/** @internal */
export function setSizeFromSingleAmountImpl<S extends T.EmptyState, T extends Token.TokenType>(
  builder: S,
  volume: TokenVolume.TokenVolume<T>,
): S & T.StateWithSize {
  const [maxAmount0, maxAmount1] = getAmounts();

  const instance = {
    ...builder,
    liquidity: undefined,
    maxAmount0,
    maxAmount1,

    pipe() {
      // eslint-disable-next-line prefer-rest-params
      return Pipeable.pipeArguments(instance, arguments);
    },
  } as S & T.StateWithSize;

  return instance;

  function getAmounts() {
    switch (volume.token.address) {
      case builder.pool.token0.address: {
        const maxAmount0 = Either.mapLeft(Adt.Amount0.fromTokenVolume(volume), (errors) => {
          return Array.make(
            BuilderErrorLive[InvalidAmountErrorSymbol]({
              token0: builder.pool.token0,
              token1: builder.pool.token1,
              given: volume.token,
              message: `Cannot convert TokenVolume to Amount0 due to errors: ${errors.join(", ")}`,
            }),
          );
        });

        return [maxAmount0, undefined] as const;
      }
      case builder.pool.token1.address: {
        const maxAmount1 = Either.mapLeft(Adt.Amount1.fromTokenVolume(volume), (errors) => {
          return Array.make(
            BuilderErrorLive[InvalidAmountErrorSymbol]({
              token0: builder.pool.token0,
              token1: builder.pool.token1,
              given: volume.token,
              message: `Cannot convert TokenVolume to Amount1 due to errors: ${errors.join(", ")}`,
            }),
          );
        });

        return [undefined, maxAmount1] as const;
      }
      default: {
        const error = BuilderErrorLive[InvalidAmountErrorSymbol]({
          token0: builder.pool.token0,
          token1: builder.pool.token1,
          given: volume.token,
          message: `The provided token ${volume.token.symbol} is not in the pool`,
        });

        return [error, error] as const;
      }
    }
  }
}

/**
 * @internal
 * Internal implementation for setting the lower tick boundary based on a target price.
 *
 * This function validates that the provided price contains the correct tokens (matching the pool's tokens),
 * converts the price to a tick, and then uses the existing setLowerTickBoundImpl logic.
 */
export const setLowerPriceBoundImpl = <S extends T.EmptyState>(
  builder: S,
  priceFn: (currentPrice: Price.AnyTokenPrice) => Option.Option<Price.AnyTokenPrice>,
): S & T.StateWithLowerBound => {
  const poolState = builder.pool;
  const currentPrice = builder.slot0.price;

  const poolToken0 = poolState.token0;
  const poolToken1 = poolState.token1;

  const lowerBoundTickOrError = Either.gen(function* () {
    // Step 1: Apply the user's priceFn to get the target price
    const targetPrice = yield* Either.fromOption(priceFn(currentPrice), () =>
      Array.make(
        BuilderErrorLive[InvalidPriceErrorSymbol]({
          message:
            "The provided price function (priceFn) did not return a valid price (returned None). " +
            "Ensure the function returns Some(Price) for a valid lower bound.",
          providedPrice: Option.none(),
          expectedToken0: poolToken0,
          expectedToken1: poolToken1,
        }),
      ),
    );

    // Step 2: Validate that the target price contains the correct tokens
    const priceContainsToken0 = Price.contains(targetPrice, poolToken0);
    const priceContainsToken1 = Price.contains(targetPrice, poolToken1);

    if (!priceContainsToken0 || !priceContainsToken1) {
      return yield* Either.left(
        Array.make(
          BuilderErrorLive[InvalidPriceErrorSymbol]({
            message:
              "The provided price does not contain the correct tokens for this pool. " +
              `Expected tokens: ${poolToken0.symbol}/${poolToken1.symbol}, ` +
              `but price contains: ${targetPrice.token0.symbol}/${targetPrice.token1.symbol}`,
            providedPrice: Option.some(targetPrice),
            expectedToken0: poolToken0,
            expectedToken1: poolToken1,
          }),
        ),
      );
    }

    // Step 3: Convert the target price to a tick
    const targetTick = Tick.getTickAtPrice(targetPrice);
    const tickSpacing = Tick.toTickSpacing(poolState.fee);

    return Tick.nearestUsableTick(targetTick, tickSpacing);
  });

  // Step 4: Use the existing setLowerTickBoundImpl logic with a function that returns the calculated tick
  return Either.match(lowerBoundTickOrError, {
    onLeft: (errors) => {
      const instance = {
        ...builder,
        lowerBoundTick: Either.left(errors),

        pipe() {
          // eslint-disable-next-line prefer-rest-params
          return Pipeable.pipeArguments(instance, arguments);
        },
      } as S & T.StateWithLowerBound;

      return instance;
    },
    onRight: (lowerBoundTick) => setLowerTickBoundImpl(builder, () => Option.some(lowerBoundTick)),
  });
};

/**
 * @internal
 * Internal implementation for setting the upper tick boundary based on a target price.
 *
 * This function validates that the provided price contains the correct tokens (matching the pool's tokens),
 * converts the price to a tick, and then uses the existing setUpperTickBoundImpl logic.
 */
export const setUpperPriceBoundImpl = <S extends T.EmptyState>(
  builder: S,
  priceFn: (currentPrice: Price.AnyTokenPrice) => Option.Option<Price.AnyTokenPrice>,
): S & T.StateWithUpperBound => {
  const poolState = builder.pool;
  const currentPrice = builder.slot0.price;
  const poolToken0 = poolState.token0;
  const poolToken1 = poolState.token1;

  const upperBoundTickOrError = Either.gen(function* () {
    // Step 1: Apply the user's priceFn to get the target price
    const targetPrice = yield* Either.fromOption(priceFn(currentPrice), () =>
      Array.make(
        BuilderErrorLive[InvalidPriceErrorSymbol]({
          message:
            "The provided price function (priceFn) did not return a valid price (returned None). " +
            "Ensure the function returns Some(Price) for a valid upper bound.",
          providedPrice: Option.none(),
          expectedToken0: poolToken0,
          expectedToken1: poolToken1,
        }),
      ),
    );

    // Step 2: Validate that the target price contains the correct tokens
    const priceContainsToken0 = Price.contains(targetPrice, poolToken0);
    const priceContainsToken1 = Price.contains(targetPrice, poolToken1);

    if (!priceContainsToken0 || !priceContainsToken1) {
      return yield* Either.left(
        Array.make(
          BuilderErrorLive[InvalidPriceErrorSymbol]({
            message:
              "The provided price does not contain the correct tokens for this pool. " +
              `Expected tokens: ${poolToken0.symbol}/${poolToken1.symbol}, ` +
              `but price contains: ${targetPrice.token0.symbol}/${targetPrice.token1.symbol}`,
            providedPrice: Option.some(targetPrice),
            expectedToken0: poolToken0,
            expectedToken1: poolToken1,
          }),
        ),
      );
    }

    // Step 3: Convert the target price to a tick
    const targetTick = Tick.getTickAtPrice(targetPrice);
    const tickSpacing = Tick.toTickSpacing(poolState.fee);

    return Tick.nearestUsableTick(targetTick, tickSpacing);
  });

  // Step 4: Use the existing setUpperTickBoundImpl logic with a function that returns the calculated tick
  return Either.match(upperBoundTickOrError, {
    onLeft: (errors) => {
      const instance = {
        ...builder,
        upperBoundTick: Either.left(errors),

        pipe() {
          // eslint-disable-next-line prefer-rest-params
          return Pipeable.pipeArguments(instance, arguments);
        },
      } as S & T.StateWithUpperBound;

      return instance;
    },
    onRight: (upperBoundTick) => setUpperTickBoundImpl(builder, () => Option.some(upperBoundTick)),
  });
};

class AggregateBuilderErrorLive implements T.AggregateBuilderError {
  readonly _tag = "AggregateBuilderError";

  constructor(readonly errors: Array.NonEmptyArray<T.BuilderError>) {}

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
    // TODO: it it possible to support any type of iterable?
    return EffectUtils.mapParN(
      [builder.liquidity, validateTickBounds(builder)],
      ([liquidity, bounds]) => fromLiquidity(liquidity, bounds),
    ).pipe(Either.mapLeft(AggregateBuilderErrorLive.fromBuilderError));
  } else if (Either.isEither(builder.maxAmount0) || Either.isEither(builder.maxAmount1)) {
    const maxAmount0 = builder.maxAmount0 || Either.right(Adt.Amount0.max);
    const maxAmount1 = builder.maxAmount1 || Either.right(Adt.Amount1.max);

    return EffectUtils.mapParN(
      [maxAmount0, maxAmount1, validateTickBounds(builder)],
      ([maxAmount0, maxAmount1, bounds]) => fromAmounts(maxAmount0, maxAmount1, bounds),
    ).pipe(Either.mapLeft(AggregateBuilderErrorLive.fromBuilderError));
  }

  return Either.left(
    new AggregateBuilderErrorLive([
      BuilderErrorLive[InvalidSizeErrorSymbol]({
        message:
          "Unknown combination of setting position size. Currently supported ways are: " +
          "1. setSizeFromLiquidity, 2. setSizeFromSingleAmount(amount0 | amount1)",
      }),
    ]),
  );

  function fromLiquidity(
    liquidity: Pool.Liquidity,
    [tickLower, tickUpper]: [Tick.UsableTick, Tick.UsableTick],
  ) {
    const draft = calculatePositionDraftFromLiquidity(
      builder.pool,
      Price.asSqrt(builder.slot0.price),
      liquidity,
      tickLower,
      tickUpper,
      builder.slot0.tick,
    );

    return draft;
  }

  function fromAmounts(
    maxAmount0: Adt.Amount0,
    maxAmount1: Adt.Amount1,
    [tickLower, tickUpper]: [Tick.UsableTick, Tick.UsableTick],
  ) {
    const draft = calculatePositionDraftFromAmounts(
      builder.pool,
      builder.slot0,
      maxAmount0,
      maxAmount1,
      tickLower,
      tickUpper,
    );

    return draft;
  }
}

function validateTickBounds<S extends T.BuilderReady>(
  builder: S,
): Either.Either<
  [Tick.UsableTick, Tick.UsableTick],
  Array.NonEmptyArray<
    | T.InvalidLowerTickError
    | T.InvalidUpperTickError
    | T.InvalidPriceError
    | T.InvalidTickBoundsError
  >
> {
  return EffectUtils.mapParN([builder.lowerBoundTick, builder.upperBoundTick], identity).pipe(
    Either.filterOrLeft(
      ([tickLower, tickUpper]) => tickLower.unwrap < tickUpper.unwrap,
      ([tickLower, tickUpper]) =>
        Array.make(
          BuilderErrorLive[InvalidTickBoundsErrorSymbol]({
            lowerTick: tickLower,
            upperTick: tickUpper,
            message: `tickLower[${tickLower.unwrap}] must be less than tickUpper[${tickUpper.unwrap}]`,
          }),
        ),
    ),
    Either.filterOrLeft(
      ([tickLower, tickUpper]) =>
        Tick.toTickSpacing(builder.pool.fee) === tickLower.spacing &&
        tickLower.spacing === tickUpper.spacing,
      ([tickLower, tickUpper]) =>
        Array.make(
          BuilderErrorLive[InvalidTickBoundsErrorSymbol]({
            lowerTick: tickLower,
            upperTick: tickUpper,
            message:
              `tickLower.spacing[${tickLower.spacing}] and ` +
              `tickUpper.spacing[${tickUpper.spacing}] must be the same as pool spacing[${Tick.toTickSpacing(builder.pool.fee)}]`,
          }),
        ),
    ),
  );
}

/**
 * @internal
 * Internal implementation for finalizeDraftOrThrow.
 *
 * This function calls finalizeDraft and throws a custom error if it returns Either.Left.
 * It provides a convenience function for cases where errors should immediately stop execution.
 *
 * @param state - A builder state that structurally matches BuilderReady.
 * @param errorHandler - A function that converts the AggregateBuilderError into a standard Error to be thrown.
 * @returns The successfully calculated PositionDraft if no errors occur.
 * @throws An Error generated by the errorHandler if finalizeDraft returns Either.Left.
 */
export function finalizeDraftOrThrowImpl<S extends T.BuilderReady>(
  state: S,
  errorHandler: (aggError: T.AggregateBuilderError) => Error,
): T.PositionDraft {
  const result = finalizeDraftImpl(state);

  return Either.getOrThrowWith(result, (aggError) => errorHandler(aggError));
}
