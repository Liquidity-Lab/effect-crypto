import { Context, Effect, Layer, Option } from "effect";

import * as Adt from "~/adt.js";
import * as AvaCrypto from "~/avaCrypto.js";
import * as Chain from "~/chain.js";
import * as Deploy from "~/deploy.js";
import * as Error from "~/error.js";
import * as TestEnv from "~/testEnv.js";
import * as Token from "~/token.js";
import * as Wallet from "~/wallet.js";

type Services = Chain.Tag | Token.Tag | Wallet.Tag | TestEnv.Tag;

const baseDeps = Layer.mergeAll(
  Chain.chainLayer().pipe(
    Layer.provide(
      Layer.succeed(Chain.ConfigTag, {
        rpcUrl: "http://127.0.0.1:8545/",
        chain: "mainnet",
      }),
    ),
  ),
  TestEnv.testEnvLayer(),
);

function provideTx<A, E, R>(
  fa: Effect.Effect<A, E, R>,
): Effect.Effect<
  A,
  E | Adt.FatalError,
  | Chain.Tag
  | Wallet.Tag
  | TestEnv.Tag
  | Exclude<Exclude<Exclude<R, Wallet.TxTag>, TestEnv.TxTag>, Chain.TxTag>
> {
  return Effect.gen(function* () {
    const chain = yield* Chain.Tag;
    const testEnv = yield* TestEnv.Tag;
    const wallet = yield* Wallet.Tag;

    return yield* fa.pipe(
      wallet.transact.bind(wallet),
      testEnv.transact.bind(testEnv),
      chain.transact.bind(chain),
    );
  });
}

const tokensLayer: Layer.Layer<
  Token.Tag,
  Adt.FatalError | Error.BlockchainError,
  TestEnv.Tag | Wallet.Tag | Chain.Tag
> = Layer.unwrapEffect(
  Effect.context<Chain.Tag | Wallet.Tag>().pipe(
    Effect.flatMap((ctx) => {
      const chain = Context.get(ctx, Chain.Tag);
      const wallet = Context.get(ctx, Wallet.Tag);

      return Deploy.tokensDeploy().pipe(wallet.transact.bind(wallet), chain.transact.bind(chain));
    }),
    Effect.map((descriptor) => Token.makeTokensFromDescriptor(descriptor, descriptor.ETH)),
    provideTx,
  ),
);

function setupLayer(ctx: Context.Context<Services>) {
  const chain = Context.get(ctx, Chain.Tag);
  const tokens = Context.get(ctx, Token.Tag);
  const wallet = Context.get(ctx, Wallet.Tag);
  const testEnv = Context.get(ctx, TestEnv.Tag);

  const prog = Effect.gen(function* () {
    const WETH = yield* Token.get("WETH");

    yield* Wallet.wrap(Token.TokenVolumeUnits(WETH, "1000"));

    const address = yield* wallet.address; // TODO: add address to Wallet API

    yield* TestEnv.setBalance(address, 1_000_000n * 10n ** 18n);
  });

  return prog.pipe(
    wallet.transact.bind(wallet),
    tokens.transact.bind(tokens),
    testEnv.transact.bind(testEnv),
    chain.transact.bind(chain),
  );
}

const deps = tokensLayer.pipe(
  Layer.provideMerge(Wallet.predefinedHardhatWallet()),
  Layer.provideMerge(baseDeps),
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
      const targetAddress = yield* targetWallet.address;
      const volume = Token.TokenVolumeUnits(token, "1000");

      // TODO: Make transferToken work for all tokens including native
      yield* Wallet.transferToken(sourceWallet, volume, targetAddress);

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

    const targetWalletCtx = yield* Layer.build(Wallet.makeRandom());
    const targetWallet = Context.get(targetWalletCtx, Wallet.Tag);

    const availableTokens = yield* Token.getAvailableTokens();

    yield* Effect.all(
      availableTokens
        .filter(Token.isErc20LikeToken)
        .map((token) => testToken(token, targetWallet, sourceWallet)),
    );
  });

  const provideWalletTx = Effect.gen(function* () {
    const chain = yield* Chain.Tag;
    const testEnv = yield* TestEnv.Tag;
    const tokens = yield* Token.Tag;
    const wallet = yield* Wallet.Tag;

    return yield* prog.pipe(
      wallet.transact.bind(wallet),
      tokens.transact.bind(tokens),
      testEnv.transact.bind(testEnv),
      chain.transact.bind(chain),
    );
  });

  return provideWalletTx;
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
