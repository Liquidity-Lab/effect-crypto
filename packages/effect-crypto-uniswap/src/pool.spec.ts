import test, { ExecutionContext } from "ava";
import { Big, MathContext, RoundingMode } from "bigdecimal.js";
import { Effect, Layer, Option } from "effect";

import * as uniswapV3Sdk from "@uniswap/v3-sdk";
import { fc, testProp } from "@fast-check/ava";
import { AvaCrypto, BigMath, Chain, TestEnv, Token, Wallet } from "@liquidity_lab/effect-crypto";
import { jsbi } from "@liquidity_lab/jsbi-reimported";

import * as Adt from "./adt.js";
import * as internal from "./pool.internal.js";
import * as Pool from "./pool.js";
import * as Tick from "./tick.js";
import * as UniswapTestEnv from "./uniswapTestEnv.js";

const JSBI = jsbi.default;
const MaxUint256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const mathContext = new MathContext(192, RoundingMode.HALF_UP);
const errorTolerance = Big("0.000003");

type Services = Chain.Tag | Token.Tag | Wallet.Tag | Pool.Tag | TestEnv.Tag | UniswapTestEnv.Tag;

const services = Layer.empty.pipe(
  Layer.provideMerge(UniswapTestEnv.uniswapTestEnvLayer()),
  Layer.provideMerge(TestEnv.tokensLayer()),
  Layer.provideMerge(TestEnv.testEnvLayer()),
  Layer.provideMerge(Chain.defaultLayer()),
);

const deps: Layer.Layer<Services> = Layer.empty.pipe(
  Layer.provideMerge(UniswapTestEnv.poolDeployLayer()),
  Layer.provideMerge(services),
  Layer.orDie,
);

const testEffect = AvaCrypto.makeTestEffect(deps, () => ({}));

testEffect("Should return None state if pool does not exist", (t) => {
  return Effect.gen(function* () {
    const WETH = yield* Token.get("WETH");
    const USDT = yield* Token.get("USDT");
    const feeAmount = Adt.FeeAmount.MEDIUM;

    const poolState = yield* Pool.fetchState(WETH, USDT, feeAmount);

    t.assert(Option.isNone(poolState), "PoolState should be None for non-existing pool");
  });
});

testEffect("Should create and initialize pool", (t) => {
  return Effect.gen(function* () {
    const WETH = yield* Token.get("WETH");
    const USDC = yield* Token.get("USDC");

    const feeAmount = Adt.FeeAmount.MEDIUM;
    const expectedPrice = Option.getOrElse(Token.TokenPriceUnits(WETH, USDC, "4000"), () =>
      t.fail("Failed to create TokenPriceUnits"),
    );

    const slot0PriceOpt = yield* Pool.createAndInitialize(expectedPrice, feeAmount);

    t.assertOptionalEqualVia(
      Option.map(slot0PriceOpt, (slot0Price) => slot0Price.price),
      Option.some(expectedPrice),
      t.priceEqualsWithPrecision(0.00001),
    );

    const existingPoolPriceOpt = yield* Pool.createAndInitialize(
      Option.getOrElse(Token.TokenPriceUnits(WETH, USDC, "5000"), () =>
        t.fail("Failed to create TokenPriceUnits"),
      ),
      feeAmount,
    );
    t.assert(
      Option.isNone(existingPoolPriceOpt),
      "Pool should not be created if it already exists",
    );
  });
});
