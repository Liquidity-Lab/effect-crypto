import {
  Config,
  ConfigError,
  Context,
  Effect,
  Function as EffectFunction,
  Either,
  Layer,
  Option,
} from "effect";
import {
  AbstractSigner,
  type BlockTag,
  type Provider,
  Signer,
  type TransactionRequest,
  type TransactionResponse,
  type TypedDataDomain,
  type TypedDataField,
} from "ethers";

import WETH9 from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/libraries/aeWETH.sol/aeWETH.json";
// import ERC20 from "@liquidity_lab/sol-artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
// import ETHLabs from "@liquidity_lab/sol-artifacts/dist/contracts/ETHLabs.sol/ETHLabs.json";
import USDCLabs from "@liquidity_lab/sol-artifacts/contracts/USDCLabs.sol/USDCLabs.json";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import * as Deploy from "~/deploy.js";
import * as Error from "~/error.js";
import * as BError from "~/error.js";
import * as TestEnv from "~/testEnv.js";
import * as Token from "~/token.js";
import * as FunctionUtils from "~/utils/functionUtils.js";
import * as Wallet from "~/wallet.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/testEvn#privateApi");

interface TestEnvPrivateApi {
  readonly nonceState: NonceState;
  readonly underlying: Context.Context<Chain.Tag | TestEnvDeployTag>;
}

interface TestEnvShape {
  readonly [privateApiSymbol]: TestEnvPrivateApi;
}

export class TestEnvTag extends Context.Tag("TestEnvTag")<TestEnvTag, TestEnvShape>() {}

export class Weth9DeployTag extends Context.Tag("Weth9DeployTag")<
  Weth9DeployTag,
  Deploy.DeployedContract
>() {}

export class UsdcLabsDeployTag extends Context.Tag("UsdcLabsDeployTag")<
  UsdcLabsDeployTag,
  Deploy.DeployedContract
>() {}

export type TestEnvDeployLayout = Weth9DeployTag | UsdcLabsDeployTag;

export class TestEnvDeployTag extends Context.Tag("TestEnvDeployTxTag")<
  TestEnvDeployTag,
  Deploy.DeployLayout<TestEnvDeployLayout>
>() {}

const deployDescriptor = Deploy.DeployDescriptorEmpty().pipe(
  Deploy.addDeployable.dataFirst([])(Weth9DeployTag, () => {
    return Either.right([WETH9.abi, WETH9.bytecode, []]);
  }),
  Deploy.addDeployable.dataFirst([])(UsdcLabsDeployTag, () => {
    return Either.right([USDCLabs.abi, USDCLabs.bytecode, []]);
  }),
);

export const deployApi = Deploy.DeployModuleApi(deployDescriptor)(TestEnvDeployTag);

class NonceState {
  #noncePromise: null | Promise<number>;
  #delta: number;

  /**
   *  Creates a new **NonceState** to manage %%signer%%.
   */
  constructor() {
    this.#noncePromise = null;
    this.#delta = 0;
  }

  /**
   *  Manually increment the nonce. This may be useful when managing
   *  offline transactions.
   */
  increment(): void {
    this.#delta++;
  }

  async getNonce(signer: Signer, blockTag?: BlockTag): Promise<number> {
    if (blockTag === "pending") {
      if (this.#noncePromise == null) {
        this.#noncePromise = signer.getNonce("pending");
      }

      const delta = this.#delta;
      return (await this.#noncePromise) + delta;
    }

    return signer.getNonce(blockTag);
  }

  /**
   *  Resets the nonce, causing the **NonceManagerLive** to reload the current
   *  nonce from the blockchain on the next transaction.
   */
  reset(): void {
    this.#delta = 0;
    this.#noncePromise = null;
  }
}

/**
 *  A **NonceManagerLive** wraps another [[Signer]] and automatically manages
 *  the nonce, ensuring serialized and sequential nonces are used during
 *  transaction.
 */
class NonceManagerLive extends AbstractSigner implements Wallet.NonceManager {
  /**
   *  The Signer being managed.
   */
  readonly signer: Signer;

  private readonly nonceState: NonceState;

  /**
   *  Creates a new **NonceManagerLive** to manage %%signer%%.
   */
  constructor(signer: Signer, nonceState: NonceState) {
    super(signer.provider);

    this.signer = signer;
    this.nonceState = nonceState;
  }

  async getAddress(): Promise<string> {
    return this.signer.getAddress();
  }

  connect(provider: null | Provider): NonceManagerLive {
    return new NonceManagerLive(this.signer.connect(provider), this.nonceState);
  }

  async getNonce(blockTag?: BlockTag): Promise<number> {
    return this.nonceState.getNonce(this.signer, blockTag);
  }

  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    const noncePromise = this.getNonce("pending");
    this.nonceState.increment();

    tx = await this.signer.populateTransaction(tx);
    tx.nonce = await noncePromise;

    // @TODO: Maybe handle interesting/recoverable errors?
    // Like don't increment if the tx was certainly not sent
    return await this.signer.sendTransaction(tx);
  }

  signTransaction(tx: TransactionRequest): Promise<string> {
    return this.signer.signTransaction(tx);
  }

  signMessage(message: string | Uint8Array): Promise<string> {
    return this.signer.signMessage(message);
  }

  signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, unknown>,
  ): Promise<string> {
    return this.signer.signTypedData(domain, types, value);
  }
}

export const setBalanceFor = FunctionUtils.withOptionalServiceApi(
  TestEnvTag,
  setBalanceForImpl,
).value;

function setBalanceForImpl(
  { [privateApiSymbol]: api }: TestEnvShape,
  address: Adt.Address,
  balance: bigint,
): Effect.Effect<void, Error.BlockchainError> {
  return Effect.as(
    Chain.send(Context.get(api.underlying, Chain.Tag), "hardhat_setBalance", [
      address,
      `0x${balance.toString(16)}`,
    ]),
    void 0,
  );
}

export const setBalance = Object.assign(
  FunctionUtils.withOptionalServiceApi(TestEnvTag, setBalanceImpl).value,
  {
    tapOnLayer(
      balance: bigint,
    ): (
      ctx: Context.Context<TestEnvTag | Wallet.Tag | Chain.Tag>,
    ) => Effect.Effect<void, Adt.FatalError | BError.BlockchainError> {
      return (ctx: Context.Context<TestEnvTag | Wallet.Tag | Chain.Tag>) =>
        TestEnv.setBalance(balance).pipe(Effect.provide(ctx));
    },
  },
);

function setBalanceImpl(
  service: TestEnvShape,
  balance: bigint,
): Effect.Effect<void, Adt.FatalError | BError.BlockchainError, Chain.Tag | Wallet.Tag> {
  return Effect.gen(function* () {
    const wallet = yield* Wallet.Tag;

    yield* setBalanceForImpl(service, wallet.address, balance);
  });
}

export const withNonceManagement = FunctionUtils.withOptionalServiceApi(
  TestEnvTag,
  withNonceManagementImpl,
).value;

function withNonceManagementImpl(
  { [privateApiSymbol]: api }: TestEnvShape,
  signer: Signer,
): Signer {
  return new NonceManagerLive(signer, api.nonceState);
}

export function testEnvLayer(): Layer.Layer<
  TestEnvTag | Wallet.Tag,
  ConfigError.ConfigError | Adt.FatalError,
  Chain.Tag
> {
  return Layer.suspend(() => {
    const nonceState = new NonceState();

    return Layer.context<Chain.Tag>().pipe(
      Layer.provideMerge(deployApi.layer),
      Layer.provideMerge(predefinedHardhatWalletImpl(nonceState)),
      Layer.map((ctx) => {
        const nonceState = new NonceState();
        const instance = {
          [privateApiSymbol]: {
            nonceState,
            underlying: ctx,
          },
        };

        return ctx.pipe(Context.pick(Wallet.Tag), Context.add(TestEnvTag, instance));
      }),
    );
  });
}

export const predefinedHardhatWallet = () =>
  Layer.service(TestEnvTag).pipe(
    Layer.flatMap((ctx) => {
      const testEnv = Context.get(ctx, TestEnvTag);
      const { [privateApiSymbol]: api } = testEnv;

      return predefinedHardhatWalletImpl(api.nonceState).pipe(
        Layer.provide(Layer.succeedContext(api.underlying)),
      );
    }),
  );

function predefinedHardhatWalletImpl(
  nonceState: NonceState,
): Layer.Layer<Wallet.Tag, ConfigError.ConfigError | Adt.FatalError, Chain.Tag> {
  const config = Config.map(
    Config.all([Config.option(Config.string("APP_WALLET_HARDHAT_PRIVATE_KEY"))]),
    ([privateKeyOpt]) => {
      const DEFAULT_PRIVATE_KEY = EffectFunction.constant(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      );

      return Option.getOrElse(privateKeyOpt, DEFAULT_PRIVATE_KEY);
    },
  );
  const makeLayer = Effect.gen(function* () {
    const privateKey = yield* config;

    return Wallet.makeFromPrivateKeyWithNonceManagement(
      privateKey,
      (signer) => new NonceManagerLive(signer, nonceState),
    );
  });

  return Layer.unwrapEffect(makeLayer);
}

export const deploy = FunctionUtils.withOptionalServiceApi(TestEnvTag, deployImpl).value;

function deployImpl<Tag extends Context.Tag<any, Deploy.DeployedContract>>(
  { [privateApiSymbol]: api }: TestEnvShape,
  tag: Context.Tag.Identifier<Tag> extends TestEnvDeployLayout ? Tag : never,
) {
  return Effect.provide(deployApi.deploy(tag), api.underlying);
}

export const tokensDeploy = FunctionUtils.withOptionalServiceApi(
  TestEnvTag,
  tokensDeployImpl,
).value;

function tokensDeployImpl(
  service: TestEnvShape,
): Effect.Effect<Token.TokensDescriptor, Adt.FatalError | BError.BlockchainError> {
  const { [privateApiSymbol]: api } = service;

  function deployHelper<T extends Token.TokenType.Wrapped | Token.TokenType.ERC20>(
    meta: Token.TokenMetaShape<T>,
    deployedContract: Deploy.DeployedContract,
  ): Effect.Effect<Token.Token<T>, Adt.FatalError | BError.BlockchainError> {
    return Effect.gen(function* () {
      const erc20TokenOpt = yield* Token.fetchErc20Token(deployedContract.address).pipe(
        Effect.provide(api.underlying),
      );

      if (Option.isNone(erc20TokenOpt)) {
        return yield* Effect.fail(
          Adt.FatalErrorString(
            `Unable to fetch ERC20 token from the contract address [${deployedContract.address}]`,
          ),
        );
      }

      const erc20Token = erc20TokenOpt.value;

      yield* Effect.logDebug(`Deployed [${erc20Token.symbol}] at [${erc20Token.address}]`);

      return Token.Token(
        erc20Token.address,
        erc20Token.decimals,
        erc20Token.symbol,
        erc20Token.name,
        meta,
      );
    });
  }

  return Effect.gen(function* () {
    const eth = Token.nativeETHToken;

    const weth9 = yield* deployHelper<Token.TokenType.Wrapped>(
      Token.WrappedTokenMeta(eth),
      yield* deploy(service, Weth9DeployTag),
    );
    // const ethLabs = yield* deployHelper(deployETHLabs());
    const usdcLabs = yield* deployHelper<Token.TokenType.ERC20>(
      Token.Erc20TokenMeta(),
      yield* deploy(service, UsdcLabsDeployTag),
    );

    return {
      ETH: eth,
      WETH: weth9,
      USDC: usdcLabs,
    };
  });
}

export function tokensLayer(): Layer.Layer<
  Token.Tag,
  Adt.FatalError | Error.BlockchainError,
  TestEnvTag | Chain.Tag
> {
  const effect = Effect.gen(function* () {
    const service = yield* TestEnvTag;
    const descriptor = yield* tokensDeployImpl(service);

    return Token.makeTokensFromDescriptor(descriptor, descriptor.ETH);
  });

  return Layer.unwrapEffect(effect);
}
