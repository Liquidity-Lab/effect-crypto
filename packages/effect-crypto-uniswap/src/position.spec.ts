import test, { ExecutionContext } from "ava";
import { Big, MathContext, RoundingMode } from "bigdecimal.js";
import { Either, Option } from "effect";

import * as uniswapSdkCore from "@uniswap/sdk-core";
import * as uniswapV3Sdk from "@uniswap/v3-sdk";
import { fc, testProp } from "@fast-check/ava";
import { Address, BigMath, Token } from "@liquidity_lab/effect-crypto";
import { jsbi } from "@liquidity_lab/jsbi-reimported";

import * as Adt from "./adt.js";
import * as Pool from "./pool.js";
import * as internal from "./position.internal.js";
import * as Tick from "./tick.js";

const JSBI = jsbi.default;
const MaxUint256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const mathContext = new MathContext(192, RoundingMode.HALF_UP);
const errorTolerance = Big("0.000003");

// type Services = Chain.Tag | Token.Tag | Wallet.Tag | Pool.Tag | TestEnv.Tag | UniswapTestEnv.Tag; // Removed unused type

// const services = Layer.empty.pipe( // Removed unused variable
//   Layer.provideMerge(UniswapTestEnv.uniswapTestEnvLayer()),
//   Layer.provideMerge(TestEnv.tokensLayer()),
//   Layer.provideMerge(TestEnv.testEnvLayer()),
//   Layer.provideMerge(Chain.defaultLayer()),
// );

// const deps: Layer.Layer<Services> = Layer.empty.pipe(
//   Layer.provideMerge(UniswapTestEnv.poolDeployLayer()),
//   Layer.provideMerge(services),
//   Layer.orDie,
// );
// Using precise calculations for maxLiquidityForAmounts

test(
  "maxLiquidity with price inside range: 100 token0, 200 token1",
  testMaxLiquidityForAmounts([1n, 1n], [100n, 110n], [110n, 100n], 100n, 200n, Option.some("2148")),
);

test(
  "maxLiquidity with price inside range: 100 token0, max token1",
  testMaxLiquidityForAmounts(
    [1n, 1n],
    [100n, 110n],
    [110n, 100n],
    100n,
    MaxUint256,
    Option.some("2148"),
  ),
);

test(
  "maxLiquidity with price inside range: max token0, 200 token1",
  testMaxLiquidityForAmounts(
    [1n, 1n],
    [100n, 110n],
    [110n, 100n],
    MaxUint256,
    200n,
    Option.some("4297"),
  ),
);

test(
  "maxLiquidity with price below range: 100 token0, 200 token1",
  testMaxLiquidityForAmounts(
    [99n, 110n],
    [100n, 110n],
    [110n, 100n],
    100n,
    200n,
    Option.some("1048"),
  ),
);

test(
  "maxLiquidity with price below range: 100 token0, max token1",
  testMaxLiquidityForAmounts(
    [99n, 110n],
    [100n, 110n],
    [110n, 100n],
    100n,
    MaxUint256,
    Option.some("1048"),
  ),
);

test(
  "maxLiquidity with price below range: max token0, 200 token1",
  testMaxLiquidityForAmounts(
    [99n, 110n],
    [100n, 110n],
    [110n, 100n],
    MaxUint256,
    200n,
    Option.some("1214437677402050006470401421082903520362793114274352355276488318240158678126184"),
  ),
);

test(
  "maxLiquidity with price above range: 100 token0, 200 token1",
  testMaxLiquidityForAmounts(
    [111n, 100n],
    [100n, 110n],
    [110n, 100n],
    100n,
    200n,
    Option.some("2097"),
  ),
);

test(
  "maxLiquidity with price above range: 100 token0, max token1",
  testMaxLiquidityForAmounts(
    [111n, 100n],
    [100n, 110n],
    [110n, 100n],
    100n,
    MaxUint256,
    Option.some("1214437677402050006470401421098959354205873606971497132040612572422243086574654"),
  ),
);

test(
  "maxLiquidity with price above range: max token0, 200 token1",
  testMaxLiquidityForAmounts(
    [111n, 100n],
    [100n, 110n],
    [110n, 100n],
    MaxUint256,
    200n,
    Option.some("2097"),
  ),
);

const ticksGen = fc
  .tuple(Tick.Tick.gen, Tick.Tick.gen)
  .map((ticks) => {
    return ticks.sort((a, b) => a - b);
  })
  .filter(([a, b]) => a != b);

testProp(
  "maxLiquidity should be equal with uniswap-sdk implementation",
  [
    Tick.Tick.gen,
    ticksGen,
    Adt.Amount0.gen({ min: Adt.Amount0(Big(1n)) }),
    Adt.Amount1.gen({ min: Adt.Amount1(Big(1n)) }),
  ],
  (t, tick, [tickA, tickB], amount0, amount1) => {
    const ratioCurrent = Tick.getRatio(tick);
    const ratioA = Tick.getRatio(tickA);
    const ratioB = Tick.getRatio(tickB);

    testMaxLiquidityForAmounts(
      BigMath.asNumeratorAndDenominator(ratioCurrent),
      BigMath.asNumeratorAndDenominator(ratioA),
      BigMath.asNumeratorAndDenominator(ratioB),
      amount0.unscaledValue(),
      amount1.unscaledValue(),
    )(t);
  },
  { numRuns: 2048 },
);

function testMaxLiquidityForAmounts(
  currentRatio: [bigint, bigint],
  aRatio: [bigint, bigint],
  bRatio: [bigint, bigint],
  amount0: bigint,
  amount1: bigint,
  expectedSdkValue: Option.Option<string> = Option.none(),
): (t: ExecutionContext<unknown>) => void {
  return (t) => {
    function uniswapImpl() {
      const sqrtRatioX96Current = uniswapV3Sdk.encodeSqrtRatioX96(
        currentRatio[0].toString(),
        currentRatio[1].toString(),
      );
      const sqrtRatioAX96 = uniswapV3Sdk.encodeSqrtRatioX96(
        aRatio[0].toString(),
        aRatio[1].toString(),
      );
      const sqrtRatioBX96 = uniswapV3Sdk.encodeSqrtRatioX96(
        bRatio[0].toString(),
        bRatio[1].toString(),
      );
      const amount0Big = JSBI.BigInt(amount0.toString());
      const amount1Big = JSBI.BigInt(amount1.toString());

      const expectedRaw = uniswapV3Sdk.maxLiquidityForAmounts(
        sqrtRatioX96Current,
        sqrtRatioAX96,
        sqrtRatioBX96,
        amount0Big,
        amount1Big,
        true,
      );

      if (Option.isSome(expectedSdkValue)) {
        t.deepEqual(
          expectedRaw,
          JSBI.BigInt(expectedSdkValue.value),
          "Intermediate value should be equal (uniswap-sdk vs uniswap-sdk)",
        );
      }

      return Big(expectedRaw.toString());
    }

    const expected = uniswapImpl();
    const sqrtRatioCurrent = Big(currentRatio[0])
      .divideWithMathContext(currentRatio[1], mathContext)
      .sqrt(mathContext);
    const sqrtRatioA = Big(aRatio[0])
      .divideWithMathContext(aRatio[1], mathContext)
      .sqrt(mathContext);
    const sqrtRatioB = Big(bRatio[0])
      .divideWithMathContext(bRatio[1], mathContext)
      .sqrt(mathContext);
    const amount0Big = Adt.Amount0(Big(amount0));
    const amount1Big = Adt.Amount1(Big(amount1));

    const actual = internal.maxLiquidityForAmountsImpl(
      sqrtRatioCurrent,
      sqrtRatioA.min(sqrtRatioB),
      sqrtRatioB.max(sqrtRatioA),
      amount0Big,
      amount1Big,
      mathContext,
    );

    BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext).trimToExpectedScale(
      actual,
      expected,
      `maxLiquidity should be equal with uniswap-sdk implementation`,
    );
  };
}

test(
  "mintAmounts is correct for price above",
  testPositionDraft(BigMath.Ratio(BigMath.NonNegativeDecimal(Big(1))), {
    liquidity: Pool.Liquidity(Big(100e18)),
    tickLower: (current, spacing) => Tick.Tick(current + spacing),
    tickUpper: (current, spacing) => Tick.Tick(current + spacing * 2),
    expectedAmount0: Adt.Amount0(Big("49949961958869841754182")),
    expectedAmount1: Adt.Amount1(Big("0")),
  }),
);

test(
  "mintAmounts is correct for price below",
  testPositionDraft(BigMath.Ratio(BigMath.NonNegativeDecimal(Big(1))), {
    liquidity: Pool.Liquidity(Big(100e18)),
    tickLower: (current, spacing) => Tick.Tick(current - spacing * 2),
    tickUpper: (current, spacing) => Tick.Tick(current - spacing),
    expectedAmount0: Adt.Amount0(Big("0")),
    expectedAmount1: Adt.Amount1(Big("49970077053")),
  }),
);

test(
  "mintAmounts is correct for in-range position",
  testPositionDraft(BigMath.Ratio(BigMath.NonNegativeDecimal(Big(1))), {
    liquidity: Pool.Liquidity(Big(100e18)),
    tickLower: (current, spacing) => Tick.Tick(current - spacing * 2),
    tickUpper: (current, spacing) => Tick.Tick(current + spacing * 2),
    expectedAmount0: Adt.Amount0(Big("120054069145287995769397")),
    expectedAmount1: Adt.Amount1(Big("79831926243")),
  }),
);

// TODO: +1. sqrtPrice is important
// TODO: +2. We should be able to obtain Tick from price (and sqrtPrice) and vice versa
// TODO: 3. Tick math is important. Implement DSL for it (nearest usable tick, etc)
// TODO: 4. Amount should be related to TokenVolume: we should be able to convert it to token volume
function testPositionDraft(
  currentSqrtRatioUnscaled: BigMath.Ratio,
  params: {
    liquidity: Pool.Liquidity;
    tickLower: (current: Tick.Tick, spacing: Tick.TickSpacing) => Tick.Tick;
    tickUpper: (current: Tick.Tick, spacing: Tick.TickSpacing) => Tick.Tick;
    expectedAmount0: Adt.Amount0;
    expectedAmount1: Adt.Amount1;
  },
) {
  return (t: ExecutionContext<unknown>) => {
    function sdkImplementation() {
      const USDC = new uniswapSdkCore.Token(
        1,
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        6,
        "USDC",
        "USD Coin",
      );
      const DAI = new uniswapSdkCore.Token(
        1,
        "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        18,
        "DAI",
        "DAI Stablecoin",
      );
      const POOL_SQRT_RATIO_START = uniswapV3Sdk.encodeSqrtRatioX96(100e6, 100e18);
      const POOL_TICK_CURRENT = uniswapV3Sdk.TickMath.getTickAtSqrtRatio(POOL_SQRT_RATIO_START);
      const TICK_SPACING = uniswapV3Sdk.TICK_SPACINGS[uniswapV3Sdk.FeeAmount.LOW];
      const DAI_USDC_POOL = new uniswapV3Sdk.Pool(
        DAI,
        USDC,
        uniswapV3Sdk.FeeAmount.LOW,
        POOL_SQRT_RATIO_START,
        0,
        POOL_TICK_CURRENT,
        [],
      );
      const position = new uniswapV3Sdk.Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e18,
        tickLower: uniswapV3Sdk.nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper:
          uniswapV3Sdk.nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      });

      const { amount0, amount1 } = position.mintAmounts;

      return {
        amount0: Adt.Amount0(Big(amount0.toString())),
        amount1: Adt.Amount1(Big(amount1.toString())),
      };
    }

    // Create USDC token (token0)
    const token0 = Token.Erc20Token(
      Address.unsafe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
      6, // USDC has 6 decimals
      "USDC",
      "USD Coin",
      Token.Erc20TokenMeta(),
    );

    // Create DAI token (token1)
    const token1 = Token.Erc20Token(
      Address.unsafe("0x6B175474E89094C44Da98b954EedeAC495271d0F"),
      18, // DAI has 18 decimals
      "DAI",
      "DAI Stablecoin",
      Token.Erc20TokenMeta(),
    );

    const sqrtRatioCurrent = BigMath.Ratio(
      currentSqrtRatioUnscaled.scaleByPowerOfTen(-token0.decimals),
    );

    // Create proper pool address - using USDC/DAI low fee pool on mainnet
    const poolAddress = Address.unsafe("0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168");

    const feeAmount = Adt.FeeAmount.LOW;

    // Create pool state using proper interface properties
    const poolState: Pool.PoolState = {
      token0,
      token1,
      fee: feeAmount,
      address: poolAddress,
    };
    const tickSpacing = Tick.toTickSpacing(feeAmount);
    const tickCurrent = Tick.getTickAtRatio(sqrtRatioCurrent.pow(2));
    const nearestUsableTick = Tick.nearestUsableTick(tickCurrent, tickSpacing);

    const dbg = sdkImplementation();
    console.log(dbg);

    const draft = Either.getOrThrowWith(
      internal.calculatePositionDraftFromLiquidity(
        poolState,
        sqrtRatioCurrent,
        params.liquidity,
        params.tickLower(nearestUsableTick, tickSpacing),
        params.tickUpper(nearestUsableTick, tickSpacing),
        tickCurrent,
      ),
      (err) => new Error(`Failed to calculate position draft: ${err}`),
    );

    // Assertions for amount0
    BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext).trimToExpectedScale(
      draft.desiredAmount0,
      Big(params.expectedAmount0),
      "amount0 should match expected value",
    );

    // Assertions for amount1
    BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext).trimToExpectedScale(
      draft.desiredAmount1,
      Big(params.expectedAmount1),
      "amount1 should match expected value",
    );
  };
}
