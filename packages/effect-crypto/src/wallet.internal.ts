import {
  Config,
  ConfigError,
  Context,
  Effect,
  Function as EffectFunction,
  Exit,
  Layer,
  Option,
} from "effect";
import {
  BaseContract,
  BaseWallet,
  Contract,
  ContractFactory,
  HDNodeWallet,
  Interface,
  type InterfaceAbi,
  Signer,
  TransactionReceipt,
  TransactionRequest,
  TransactionResponse,
  Provider as UnderlyingProvider,
  Wallet as UnderlyingWallet,
} from "ethers";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import * as Error from "~/error.js";
import * as Signature from "~/signature.js";
import * as TestEnv from "~/testEnv.js";
import * as Token from "~/token.js";
import * as EffectUtils from "~/utils/effectUtils.js";
import * as FunctionUtils from "~/utils/functionUtils.js";
import type * as W from "~/wallet.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/wallet#PrivateApi");

type RefinedSigner = Signer & {
  provider: UnderlyingProvider;
};

const RefinedSigner = {
  check(signer: Signer): signer is RefinedSigner {
    return signer.provider !== null;
  },
};

interface WalletTxPrivateApi {
  readonly signer: RefinedSigner;

  readonly address: Effect.Effect<Adt.Address, Adt.FatalError>;
}

interface WalletTxShape {
  readonly [privateApiSymbol]: WalletTxPrivateApi;
}

interface WalletPrivateApi {
  readonly toTx: Effect.Effect<WalletTxShape, Adt.FatalError, Chain.TxTag>;
}

/**
 * WalletTx Tag to be used in the context:
 * @example
 *   import { Wallet } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   const effect: Effect.Effect<any, never, Wallet.TxTag> = ...
 */
export class WalletTxTag extends Effect.Tag("WalletTx")<WalletTxTag, WalletTxShape>() {}

interface WalletShape {
  readonly address: Effect.Effect<Adt.Address, Adt.FatalError, Chain.TxTag>;

  transact<A, E, R>(
    fa: Effect.Effect<A, E, R | WalletTxTag>,
  ): Effect.Effect<A, E | Adt.FatalError, Exclude<R, WalletTxTag> | Chain.TxTag>;

  readonly [privateApiSymbol]: WalletPrivateApi;
}

/**
 * Wallet Tag to be used in the context:
 * @example
 *   import { Wallet } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   const effect: Effect.Effect<any, never, Wallet.Tag> = ...
 */
export class WalletTag extends Effect.Tag("Wallet")<WalletTag, WalletShape>() {}

export class InsufficientFundsErrorLive implements W.InsufficientFundsError {
  readonly _tag = "WalletError";
  readonly _kind = "InsufficientFundsError";

  readonly requiredVolume: Token.AnyTokenVolume;
  readonly walletAddress: Adt.Address;

  constructor(requiredVolume: Token.AnyTokenVolume, walletAddress: Adt.Address) {
    this.requiredVolume = requiredVolume;
    this.walletAddress = walletAddress;
  }

  get token(): Token.AnyToken {
    return this.requiredVolume.token;
  }

  prettyPrint(): string {
    return `Insufficient funds for required[${this.requiredVolume.prettyPrint}] wallet[${this.walletAddress}]`;
  }
}

export function isWalletError(err: unknown): err is W.Errors {
  return typeof err === "object" && err !== null && "_tag" in err && err["_tag"] === "WalletError";
}

export function isInsufficientFundsError(err: unknown): err is W.InsufficientFundsError {
  return (
    typeof err === "object" &&
    err !== null &&
    "_tag" in err &&
    err["_tag"] === "InsufficientFundsError"
  );
}

/**
 * This is a wrapped version of getBalanceImpl it allows to use it with Wallet as one of overloaded functions
 */
export const getBalance = FunctionUtils.withOptionalServiceApi(
  WalletTxTag,
  getBalanceImpl,
).contramapEvalService(
  (wallet: Context.Tag.Service<WalletTag>) => wallet[privateApiSymbol].toTx,
).value;

function getBalanceImpl<T extends Token.TokenType.ERC20 | Token.TokenType.Wrapped>(
  { [privateApiSymbol]: api }: WalletTxShape,
  token: Token.Token<T>,
): Effect.Effect<
  Option.Option<Token.TokenVolume<T>>,
  Adt.FatalError | Error.BlockchainError,
  Token.TxTag
> {
  return Effect.gen(function* () {
    const address = yield* api.address;
    const balance: Option.Option<Token.TokenVolume<T>> = yield* Token.balanceOfErc20Like(
      token,
      address,
    ).pipe(Signature.signVia(api.signer));

    return balance;
  });
}

/**
 * This is a wrapped version of transferTokenImpl it allows to use it with Wallet
 */
export const transferToken = FunctionUtils.withOptionalServiceApi(
  WalletTxTag,
  transferTokenImpl,
).contramapEvalService(
  (wallet: Context.Tag.Service<WalletTag>) => wallet[privateApiSymbol].toTx,
).value;

function transferTokenImpl<T extends Token.TokenType.ERC20 | Token.TokenType.Wrapped>(
  { [privateApiSymbol]: api }: WalletTxShape,
  volume: Token.TokenVolume<T>,
  to: Adt.Address,
): Effect.Effect<
  TransactionReceipt,
  Adt.FatalError | Error.BlockchainError | W.Errors | Error.TransactionFailedError,
  Token.TxTag
> {
  const prog = Effect.gen(function* () {
    yield* Effect.annotateLogsScoped({
      to,
      token: {
        address: volume.token.address,
        symbol: volume.token.symbol,
      },
    });

    const transfer = (fromAddress: Adt.Address) =>
      Effect.gen(function* () {
        const transferRequest: TransactionRequest = yield* Token.transferErc20Like(
          volume,
          to,
          fromAddress,
        ).pipe(Signature.signVia(api.signer));

        yield* Effect.log(
          `Transferring tokens from[${fromAddress}] to[${to}] volume[${volume.prettyPrint}]`,
          transferRequest,
        );

        return transferRequest;
      });
    // TODO: we're lacking of refinedBlockchainError here
    const transferReceipt: TransactionReceipt = yield* withApproval(api, volume, to, transfer);

    return transferReceipt;
  });

  return Effect.scoped(prog);
}

/**
 * This is a wrapped version of transferNativeImpl it allows to use it with Wallet as one of overloaded functions
 */
export const transferNative = FunctionUtils.withOptionalServiceApi(
  WalletTxTag,
  transferNativeImpl,
).contramapEvalService(
  (wallet: Context.Tag.Service<WalletTag>) => wallet[privateApiSymbol].toTx,
).value;

function transferNativeImpl(
  { [privateApiSymbol]: api }: WalletTxShape,
  volume: Token.TokenVolume<Token.TokenType.Native>,
  to: Adt.Address,
): Effect.Effect<
  TransactionReceipt,
  Adt.FatalError | Error.BlockchainError | W.Errors | Error.TransactionFailedError,
  Chain.TxTag | Token.TxTag
> {
  const prog = Effect.gen(function* () {
    const fromAddress = yield* api.address;

    yield* Effect.annotateLogsScoped({
      to,
      token: {
        address: volume.token.address,
        symbol: volume.token.symbol,
      },
    });

    const transactionRequest: TransactionRequest = yield* Token.transferNative(volume, to).pipe(
      Signature.signVia(api.signer),
    );

    yield* Effect.log(
      `Transferring native tokens from[${fromAddress}] to[${to}] volume[${volume.prettyPrint}]`,
      transactionRequest,
    );

    const transactionResponse = yield* Error.catchBlockchainErrors(
      Effect.promise(() => api.signer.sendTransaction(transactionRequest)),
    );

    return yield* awaitForTransaction(transactionResponse);
  });

  return Effect.scoped(prog);
}

/**
 * This is a wrapped version of the [[deployContract]] function.
 * It allows using it with Wallet as one of overloaded functions
 */
export const deployContract = FunctionUtils.withOptionalServiceApi(
  WalletTxTag,
  deployContractImpl,
).contramapEvalService(
  (wallet: Context.Tag.Service<WalletTag>) => wallet[privateApiSymbol].toTx,
).value;

function deployContractImpl(
  { [privateApiSymbol]: api }: WalletTxShape,
  abi: Interface | InterfaceAbi,
  bytecode: string,
  args: ReadonlyArray<unknown>,
): Effect.Effect<W.DeployedContractOps, Adt.FatalError | Error.BlockchainError, Chain.TxTag> {
  return Effect.gen(function* () {
    const factory = new ContractFactory(abi, bytecode, api.signer);

    const contractRaw = yield* Effect.promise(() => factory.deploy(...args));
    const contract: BaseContract = yield* Effect.promise(() => contractRaw.waitForDeployment());
    const contractOps = yield* Chain.contractOps(
      (runner) => new Contract(contract, contract.interface, runner),
    );

    return Object.assign(contractOps, { withWalletRunner: contract });
  });
}

/**
 * This is a wrapped version of the [[transferToken]] function. It allows to use it with Wallet as one of overloaded functions
 */
export const wrap = FunctionUtils.withOptionalServiceApi(
  WalletTxTag,
  wrapImpl,
).contramapEvalService(
  (wallet: Context.Tag.Service<WalletTag>) => wallet[privateApiSymbol].toTx,
).value;

function wrapImpl(
  { [privateApiSymbol]: api }: WalletTxShape,
  volume: Token.TokenVolume<Token.TokenType.Wrapped>,
): Effect.Effect<
  TransactionReceipt,
  Adt.FatalError | Error.BlockchainError | Error.TransactionFailedError,
  Token.TxTag | Chain.TxTag
> {
  return Effect.gen(function* () {
    const transactionRequest: TransactionRequest = yield* Token.deposit(volume).pipe(
      Signature.signVia(api.signer),
    );
    const transactionResponse: TransactionResponse = yield* Error.catchBlockchainErrors(
      Effect.promise(() => api.signer.sendTransaction(transactionRequest)),
      // TODO: should we somehow pass the contract and catchRefinedBlockchainErrors?
    );

    return yield* awaitForTransaction(transactionResponse);
  });
}

type MakeWallet = (
  connect: (w: BaseWallet) => Effect.Effect<BaseWallet, Adt.FatalError, Chain.TxTag>,
) => Effect.Effect<RefinedSigner, Adt.FatalError, Chain.TxTag>;

class WalletLive implements WalletShape {
  private readonly make: MakeWallet;

  constructor(make: MakeWallet) {
    this.make = make;
  }

  get address(): Effect.Effect<Adt.Address, Adt.FatalError, Chain.TxTag> {
    return Effect.flatMap(this.toWalletTx(), (tx) => tx[privateApiSymbol].address);
  }

  get [privateApiSymbol](): WalletPrivateApi {
    return {
      toTx: this.toWalletTx(),
    };
  }

  transact<A, E, R extends WalletTxTag>(
    fa: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | Adt.FatalError, Exclude<R, WalletTxTag> | Chain.TxTag> {
    return Effect.gen(this, function* () {
      const walletTx = yield* this.toWalletTx();

      return yield* Effect.provideService(fa, WalletTxTag, walletTx);
    });
  }

  private toWalletTx(): Effect.Effect<WalletTxShape, Adt.FatalError, Chain.TxTag> {
    const { make } = this;

    return Effect.gen(function* () {
      const chainTx = yield* Chain.TxTag;
      const signer: RefinedSigner = yield* make((w) => Chain.connectWallet(chainTx, w));
      const addressF = Effect.promise(() => signer.getAddress()).pipe(
        Effect.flatMap((rawAddress) => EffectUtils.getOrFailSimpleEither(Adt.Address(rawAddress))),
      );

      return {
        [privateApiSymbol]: {
          signer,
          address: addressF,
        },
      };
    });
  }
}

export function makeFromPrivateKey(privateKey: string): Layer.Layer<WalletTag> {
  const wallet = new UnderlyingWallet(privateKey, null);

  return Layer.succeed(
    WalletTag,
    new WalletLive((connect) =>
      Effect.gen(function* () {
        const signer = yield* connect(wallet);

        return yield* refinedSignerInvariant(signer);
      }),
    ),
  );
}

export function makeRandom(): Layer.Layer<WalletTag> {
  return Layer.effect(
    WalletTag,
    Effect.gen(function* () {
      const wallet: HDNodeWallet = yield* Effect.sync(() => UnderlyingWallet.createRandom(null));

      return new WalletLive((connect) =>
        Effect.gen(function* () {
          const signer = yield* connect(wallet);

          return yield* refinedSignerInvariant(signer);
        }),
      );
    }),
  );
}

export function makeRandomWithNonceManagement(): Layer.Layer<WalletTag, never, TestEnv.TxTag> {
  return Layer.effect(
    WalletTag,
    Effect.gen(function* () {
      const wallet: HDNodeWallet = yield* Effect.sync(() => UnderlyingWallet.createRandom(null));
      const testEnvTx = yield* TestEnv.TxTag;

      return new WalletLive((connect) =>
        Effect.gen(function* () {
          const signer = yield* TestEnv.withNonceManagement(testEnvTx, yield* connect(wallet));

          return yield* refinedSignerInvariant(signer);
        }),
      );
    }),
  );
}

export function makeFromPrivateKeyWithNonceManagement(
  privateKey: string,
): Layer.Layer<WalletTag, never, TestEnv.Tag> {
  return Layer.effect(
    WalletTag,
    Effect.gen(function* () {
      const testEnv = yield* TestEnv.Tag;
      const wallet = new UnderlyingWallet(privateKey, null);

      return new WalletLive((connect) =>
        Effect.gen(function* () {
          const signer = yield* testEnv.transact(
            TestEnv.withNonceManagement(yield* connect(wallet)),
          );

          return yield* refinedSignerInvariant(signer);
        }),
      );
    }),
  );
}

export function predefinedHardhatWallet(): Layer.Layer<
  WalletTag,
  ConfigError.ConfigError,
  TestEnv.Tag
> {
  return Layer.unwrapEffect(
    Config.map(
      Config.all([Config.option(Config.string("APP_WALLET_HARDHAT_PRIVATE_KEY"))]),
      ([privateKeyOpt]) => {
        const DEFAULT_PRIVATE_KEY = EffectFunction.constant(
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        );

        return makeFromPrivateKeyWithNonceManagement(
          Option.getOrElse(privateKeyOpt, DEFAULT_PRIVATE_KEY),
        );
      },
    ),
  );
}

/**
 * Refines a signer to a RefinedSigner if it has a provider.
 *
 * @param signer The signer to refine.
 * @returns An Either containing the refined signer or an error message.
 */
function refinedSignerInvariant(signer: Signer): Effect.Effect<RefinedSigner, Adt.FatalError> {
  if (RefinedSigner.check(signer)) {
    return Effect.succeed(signer);
  }

  return Effect.fail(
    Adt.FatalErrorString("Cannot create wallet connector: Signer#provider is not defined"),
  );
}

/**
 * Manages approval of token transfer and executes a provided function with the approval in context.
 * @param api the wallet private api.
 * @param volume The token volume to approve the transfer.
 * @param to The recipient address.
 * @param f A function representing the action to execute after approval.
 * @returns An effect that resolves with the transaction receipt.
 */
function withApproval<E, R>(
  api: WalletTxPrivateApi,
  volume: Token.TokenVolume<Token.TokenType.ERC20 | Token.TokenType.Wrapped>,
  to: Adt.Address,
  f: (address: Adt.Address) => Effect.Effect<TransactionRequest, E, R>,
): Effect.Effect<
  TransactionReceipt,
  E | Adt.FatalError | Error.BlockchainError | W.Errors | Error.TransactionFailedError,
  R | Token.TxTag
> {
  const prog = Effect.gen(function* () {
    const tokenOp = yield* Token.TxTag;

    const address = yield* api.address;

    yield* Effect.annotateLogsScoped({
      to,
      token: {
        address: volume.token.address,
        symbol: volume.token.symbol,
      },
    });

    const rollbackOnError = (_: unknown, e: Exit.Exit<unknown, unknown>) =>
      Exit.match(e, {
        onFailure: () =>
          transferApproval(Token.TokenVolumeZero(volume.token), to, api.signer).pipe(
            Effect.as(void 0),
            Effect.orElseSucceed(() => void 0),
            Effect.provideService(Token.TxTag, tokenOp),
          ),
        onSuccess: () => Effect.void,
      });
    const approval = Effect.acquireRelease(
      transferApproval(volume, to, api.signer),
      rollbackOnError,
    );

    return yield* Effect.using(approval, () =>
      Effect.gen(function* () {
        const transactionRequest = yield* f(address);
        const transactionResponse: TransactionResponse = yield* Error.catchBlockchainErrors(
          Effect.promise(() => api.signer.sendTransaction(transactionRequest)),
        );

        return yield* awaitForTransaction(transactionResponse);
      }),
    ).pipe(handleDomainErrors(volume, address));
  });

  return Effect.scoped(prog);
}

/**
 * Utility function to await a transaction response.
 * @param tx The transaction response to wait on.
 * @returns An effect that resolves with the transaction receipt.
 */
function awaitForTransaction(
  tx: TransactionResponse,
): Effect.Effect<TransactionReceipt, Error.TransactionFailedError> {
  return Effect.gen(function* () {
    const receipt: Option.Option<TransactionReceipt> = Option.fromNullable(
      yield* Effect.promise(() => tx.wait()),
    );

    return yield* Option.match(receipt, {
      // TODO: perhaps we going to need to check some fields in the receipt
      onSome: (receipt) => Effect.as(Effect.log("Transaction receipt:", receipt), receipt),
      onNone: () => Effect.fail(Error.TransactionFailedError("Transaction: got no receipt")),
    });
  });
}

/**
 * Handles domain-specific errors associated with wallet operations.
 * @param volume The token volume associated with the operations.
 * @param walletAddress The wallet address used in the operations.
 * @returns A function transforming the effect to handle errors.
 */
function handleDomainErrors<A, E, R>(
  volume: Token.AnyTokenVolume,
  walletAddress: Adt.Address,
): (fa: Effect.Effect<A, E, R>) => Effect.Effect<A, E | W.Errors, R> {
  return (fa) =>
    Effect.mapError(fa, (e) => {
      if (Error.isInsufficientFundsBlockchainError(e)) {
        return new InsufficientFundsErrorLive(volume, walletAddress);
      }

      return e;
    });
}

/**
 * Initiates and manages token approval transactions.
 * @param volume The volume of tokens to approve.
 * @param to The address to approve transactions for.
 * @param signer The signer to use for authorization.
 * @returns An effect that processes the approval.
 */
function transferApproval(
  volume: Token.TokenVolume<Token.TokenType.ERC20 | Token.TokenType.Wrapped>,
  to: Adt.Address,
  signer: RefinedSigner,
): Effect.Effect<
  TransactionReceipt,
  Adt.FatalError | Error.BlockchainError | Error.TransactionFailedError,
  Token.TxTag
> {
  return Effect.gen(function* () {
    const approvalTx: TransactionResponse = yield* Token.approveTransfer(volume, to).pipe(
      Signature.signVia(signer),
    );

    return yield* awaitForTransaction(approvalTx);
  });
}
