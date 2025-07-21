import { Big, MathContext, RoundingMode } from "bigdecimal.js";
import { Effect, Either, Layer, Option } from "effect";

import { AvaCrypto, BigMath, Chain, TestEnv, Token, Wallet } from "@liquidity_lab/effect-crypto";

import * as Adt from "./adt.js";
import * as AvaUniswap from "./avaUniswap.js";
import * as Pool from "./pool.js";
import * as Price from "./price.js";
import * as UniswapTestEnv from "./uniswapTestEnv.js";

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

const testEffect = AvaCrypto.makeTestEffect(deps, (t) => AvaUniswap.Assertions(t));

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
  const errorTolerance = Big("0.00001");

  return Effect.gen(function* () {
    const WETH = yield* Token.get("WETH");
    const USDC = yield* Token.get("USDC");

    const feeAmount = Adt.FeeAmount.MEDIUM;
    const expectedPrice = Either.getOrElse(
      Price.makeTokenPriceFromRatio(WETH, USDC, BigMath.Ratio(Big("4000"))),
      (err) => t.fail(`Failed to create TokenPriceUnits: ${err}`),
    );

    const slot0PriceOpt = yield* Pool.createAndInitialize(expectedPrice, feeAmount);

    t.assertOptionalEqualVia(
      Option.map(slot0PriceOpt, (slot0Price) => slot0Price.price),
      Option.some(expectedPrice),
      t.priceEqualsWithPrecision(errorTolerance),
    );

    const existingPoolPriceOpt = yield* Pool.createAndInitialize(
      Either.getOrElse(
        Price.makeTokenPriceFromRatio(WETH, USDC, BigMath.Ratio(Big("5000"))),
        (err) => t.fail(`Failed to create TokenPriceUnits: ${err}`),
      ),
      feeAmount,
    );
    t.assert(
      Option.isNone(existingPoolPriceOpt),
      "Pool should not be created if it already exists",
    );
  });
});

testEffect("Should fetch slot0", (t) => {
  const errorTolerance = Big("0.00001", undefined, new MathContext(128, RoundingMode.FLOOR));

  return Effect.gen(function* () {
    // TODO: we should deploy random tokes to ensure we create new pool each time
    const WETH = yield* Token.get("WETH");
    const USDC = yield* Token.get("USDC");

    const feeAmount = Adt.FeeAmount.HIGH;
    const expectedPrice = Either.getOrElse(
      Price.makeTokenPriceFromRatio(WETH, USDC, BigMath.Ratio(Big("4000"))),
      (err) => t.fail(`Failed to create TokenPriceUnits: ${err}`),
    );

    yield* Pool.createAndInitialize(expectedPrice, feeAmount);

    const poolState = Option.getOrElse(yield* Pool.fetchState(WETH, USDC, feeAmount), () =>
      t.fail("PoolState should be Some for existing pool"),
    );

    const actual = yield* Pool.fetchSlot0(poolState);

    t.priceEqualsWithPrecision(errorTolerance)(
      actual.price,
      expectedPrice,
      "Price should be equal",
    );
  });
});
