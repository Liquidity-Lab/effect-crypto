import { BigDecimal, MathContext } from "bigdecimal.js";
import { Either } from "effect";

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

export const draftBuilder: {
  (pool: Pool.PoolState, slot0: Pool.Slot0): T.EmptyState;
} = (pool: Pool.PoolState, slot0: Pool.Slot0): T.EmptyState => {
  return {
    pool: pool,
    slot0: slot0,
  };
};
