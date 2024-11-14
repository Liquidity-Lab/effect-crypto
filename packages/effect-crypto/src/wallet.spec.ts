import { Context, Effect, Layer, Option } from "effect";

import * as AvaCrypto from "~/avaCrypto.js";
import * as Chain from "~/chain.js";
import * as TestEnv from "~/testEnv.js";
import * as Token from "~/token.js";
import * as Wallet from "~/wallet.js";

type Services = Chain.Tag | Token.Tag | Wallet.Tag | TestEnv.Tag;

// Base services for blockchain
const services = Layer.empty.pipe(
  Layer.provideMerge(TestEnv.tokensLayer()),
  Layer.provideMerge(TestEnv.testEnvLayer()),
  Layer.provideMerge(Chain.defaultLayer()),
);

// This function is used to setup wallets with initial balances
function setupLayer(ctx: Context.Context<Services>) {
  const prog = Effect.gen(function* () {
    const WETH = yield* Token.get("WETH");

    yield* Wallet.wrap(Token.TokenVolumeUnits(WETH, "1000"));
  });

  return Effect.provide(prog, ctx);
}

const deps = services.pipe(
  Layer.tap(TestEnv.setBalance.tapOnLayer(1_000_000n * 10n ** 18n)),
  Layer.tap(setupLayer),
  Layer.orDie,
);

const testEffect = AvaCrypto.makeTestEffect(deps, () => ({}));

testEffect("Should transfer all tokens", (t) => {
  t.timeout(1000 * 60, "Hardhat tests are slow"); // 1 minute

  function testToken<T extends Token.TokenType.ERC20 | Token.TokenType.Wrapped>(
    token: Token.Token<T>,
    targetWallet: Wallet.Wallet,
    sourceWallet: Wallet.Wallet,
  ) {
    return Effect.gen(function* () {
      const volume = Token.TokenVolumeUnits(token, "1000");

      // TODO: Make transferToken work for all tokens including native
      yield* Wallet.transferToken(sourceWallet, volume, targetWallet.address);

      const targetBalance = yield* Wallet.getBalance(targetWallet, token);

      t.assertOptionalEqualVia(
        targetBalance,
        Option.some(volume),
        t.assertableEqual,
        `Target wallet should have received the volume of [${volume.prettyPrint}]`,
      );
    });
  }

  const prog = Effect.gen(function* () {
    const sourceWallet = yield* Wallet.Tag;
    const targetWallet = yield* Wallet.makeRandom();

    const availableTokens = yield* Token.getAvailableTokens();

    yield* Effect.all(
      availableTokens
        .filter(Token.isErc20LikeToken)
        .map((token) => testToken(token, targetWallet, sourceWallet)),
    );
  });

  return Effect.orDie(prog);
});

testEffect.skip("Should set balance of native ETH using the hardrhat runtime", (t) => {
  return Effect.sync(() => t.fail("Not implemented"));
});

testEffect.skip("Should throw InsufficientBalance error", (t) => {
  return Effect.sync(() => t.fail("Not implemented"));
});

testEffect.skip("Should wrap ERC20 token", (t) => {
  return Effect.sync(() => t.fail("Not implemented"));
});
