import test from "ava";
import { Effect, Layer } from "effect";
import { Chain, TestEnv, Token, Wallet } from "@liquidity_lab/effect-crypto";
//
// import * as UniswapTestEnv from "~/uniswapTestEnv.js";
//
type Services = Chain.Tag | Token.Tag | Wallet.Tag | TestEnv.Tag //| UniswapTestEnv.Tag;

// Base services for blockchain
const services = Layer.empty.pipe(
//   // Layer.provideMerge(UniswapTestEnv.uniswapTestEnvLayer()),
//   Layer.provideMerge(TestEnv.tokensLayer()),
//   Layer.provideMerge(TestEnv.testEnvLayer()),
  Layer.provideMerge(Chain.defaultLayer()),
);

// const deps: Layer.Layer<Services> = services.pipe(
//   Layer.orDie,
// );

// const testEffect = AvaCrypto.makeTestEffect(deps, () => ({}));
//
// testEffect("Should deploy Uniswap stack", (t) => {
//   const prog = Effect.gen(function* () {
//     const weth9 = yield* UniswapTestEnv.deploy(TestEnv.Weth9DeployTag);
//     const poolFactory = yield* UniswapTestEnv.deploy(UniswapTestEnv.PoolFactoryDeploy);
//
//     yield* Effect.log(`Deployed WETH9: ${weth9.address}`);
//     yield* Effect.log(`Deployed PoolFactory: ${poolFactory.address}`);
//
//     t.assert(false, "TODO: implement");
//   });
//
//   return prog.pipe(
//     Effect.orDie,
//   );
// });

test("asdasdsada", (t) => {
  t.assert(false, "TODO: implement");
});
