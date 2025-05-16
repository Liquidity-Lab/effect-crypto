import { Effect, Layer } from "effect";

import { AvaCrypto, Chain, TestEnv, Token, Wallet } from "@liquidity_lab/effect-crypto";

import * as UniswapTestEnv from "./uniswapTestEnv.js";

type Services = Chain.Tag | Token.Tag | Wallet.Tag | TestEnv.Tag | UniswapTestEnv.Tag;

// Base services for blockchain
const services = Layer.empty.pipe(
  Layer.provideMerge(UniswapTestEnv.uniswapTestEnvLayer()),
  Layer.provideMerge(TestEnv.tokensLayer()),
  Layer.provideMerge(TestEnv.testEnvLayer()),
  Layer.provideMerge(Chain.defaultLayer()),
);

const deps: Layer.Layer<Services> = services.pipe(Layer.orDie);

const testEffect = AvaCrypto.makeTestEffect(deps, () => ({}));

testEffect("Should deploy Uniswap stack", (t) => {
  const prog = Effect.gen(function* () {
    const weth9 = yield* UniswapTestEnv.deploy(TestEnv.Weth9DeployTag);
    t.assert(weth9.address.startsWith("0x"), "Address should start with 0x");

    const poolFactory = yield* UniswapTestEnv.deploy(UniswapTestEnv.PoolFactoryDeploy);
    t.assert(poolFactory.address.startsWith("0x"), "Address should start with 0x");

    const router = yield* UniswapTestEnv.deploy(UniswapTestEnv.SwapRouterDeploy);
    t.assert(router.address.startsWith("0x"), "Address should start with 0x");

    const quoter = yield* UniswapTestEnv.deploy(UniswapTestEnv.UniswapQuoterV2Deploy);
    t.assert(quoter.address.startsWith("0x"), "Address should start with 0x");

    const positionManager = yield* UniswapTestEnv.deploy(
      UniswapTestEnv.NonfungiblePositionManagerDeploy,
    );
    t.assert(positionManager.address.startsWith("0x"), "Address should start with 0x");

    const poolInitializer = yield* UniswapTestEnv.deploy(UniswapTestEnv.PoolInitializerDeploy);
    t.assert(poolInitializer.address.startsWith("0x"), "Address should start with 0x");
    t.deepEqual(
      poolInitializer.address,
      positionManager.address,
      "PoolInitializer should be the same with NonfungiblePositionManager",
    );
  });

  return prog.pipe(Effect.orDie);
});
