import { Context, Effect, Exit, Layer, Option } from "effect";
import {
  BaseContract,
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

import * as Adt from "./adt.js";
import * as Chain from "./chain.js";
import * as Error from "./error.js";
import * as Signature from "./signature.js";
import * as Token from "./token.js";
import * as EffectUtils from "./utils/effectUtils.js";
import * as FunctionUtils from "./utils/functionUtils.js";
import type * as W from "./wallet.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/wallet#PrivateApi");

type RefinedSigner = Signer & {
  provider: UnderlyingProvider;
};

const RefinedSigner = {
  check(signer: Signer): signer is RefinedSigner {
    return signer.provider !== null;
  },
};

interface WalletPrivateApi {
  readonly signer: RefinedSigner;
  readonly underlyingChain: Context.Tag.Service<Chain.Tag>;
}

interface WalletShape {
  readonly [privateApiSymbol]: WalletPrivateApi;
  readonly address: Adt.Address;
}

/**
 * Wallet Tag to be used in the context:
 * @example
 *   import { Wallet } from "./com/liquidity_lab/crypto/blockchain";
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
export const getBalance = FunctionUtils.withOptionalServiceApi(WalletTag, getBalanceImpl).value;

function getBalanceImpl<T extends Token.TokenType.ERC20 | Token.TokenType.Wrapped>(
  { [privateApiSymbol]: api, address }: WalletShape,
  token: Token.Token<T>,
): Effect.Effect<
  Option.Option<Token.TokenVolume<T>>,
  Adt.FatalError | Error.BlockchainError,
  Token.TxTag
> {
  return Effect.gen(function* () {
    const balance: Option.Option<Token.TokenVolume<T>> = yield* Token.balanceOfErc20Like(
      token,
      address,
    ).pipe(Signature.signVia(api.signer));

    return balance;
  });
}

export const transact = FunctionUtils.withOptionalServiceApi(WalletTag, transactImpl).value;

function transactImpl(
  { [privateApiSymbol]: api }: WalletShape,
  transactionRequest: TransactionRequest,
): Effect.Effect<TransactionReceipt, Error.BlockchainError | Error.TransactionFailedError> {
  return Effect.gen(function* () {
    const transactionResponse: TransactionResponse = yield* Error.catchBlockchainErrors(
      Effect.promise(() => api.signer.sendTransaction(transactionRequest)),
    );

    return yield* awaitForTransaction(transactionResponse);
  });
}

/**
 * This is a wrapped version of transferTokenImpl it allows to use it with Wallet
 */
export const transferToken = FunctionUtils.withOptionalServiceApi(
  WalletTag,
  transferTokenImpl,
).value;

function transferTokenImpl<T extends Token.TokenType.ERC20 | Token.TokenType.Wrapped>(
  service: WalletShape,
  volume: Token.TokenVolume<T>,
  to: Adt.Address,
): Effect.Effect<
  TransactionReceipt,
  Adt.FatalError | Error.BlockchainError | W.Errors | Error.TransactionFailedError,
  Token.TxTag
> {
  const { [privateApiSymbol]: api } = service;
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
    const transferReceipt: TransactionReceipt = yield* withApproval(service, volume, to, transfer);

    return transferReceipt;
  });

  return Effect.scoped(prog);
}

/**
 * This is a wrapped version of transferNativeImpl it allows to use it with Wallet as one of overloaded functions
 */
export const transferNative = FunctionUtils.withOptionalServiceApi(
  WalletTag,
  transferNativeImpl,
).value;

function transferNativeImpl(
  { [privateApiSymbol]: api, address: fromAddress }: WalletShape,
  volume: Token.TokenVolume<Token.TokenType.Native>,
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
  WalletTag,
  deployContractImpl,
).value;

function deployContractImpl(
  { [privateApiSymbol]: api }: WalletShape,
  abi: Interface | InterfaceAbi,
  bytecode: string,
  args: ReadonlyArray<unknown>,
): Effect.Effect<W.DeployedContractOps, Adt.FatalError | Error.BlockchainError> {
  return Effect.gen(function* () {
    const factory = new ContractFactory(abi, bytecode, api.signer);

    const contractRaw = yield* Effect.promise(() => factory.deploy(...args));
    const contract: BaseContract = yield* Effect.promise(() => contractRaw.waitForDeployment());
    const contractOps = yield* Chain.contractOps(
      api.underlyingChain,
      (runner) => new Contract(contract, contract.interface, runner),
    );

    return Object.assign(contractOps, { withWalletRunner: contract });
  });
}

/**
 * This is a wrapped version of the [[transferToken]] function. It allows to use it with Wallet as one of overloaded functions
 */
export const wrap = FunctionUtils.withOptionalServiceApi(WalletTag, wrapImpl).value;

function wrapImpl(
  { [privateApiSymbol]: api }: WalletShape,
  volume: Token.TokenVolume<Token.TokenType.Wrapped>,
): Effect.Effect<
  TransactionReceipt,
  Adt.FatalError | Error.BlockchainError | Error.TransactionFailedError,
  Token.TxTag
> {
  return Effect.gen(function* () {
    const transactionRequest: TransactionRequest = yield* Token.deposit(volume).pipe(
      Effect.provideService(Chain.Tag, api.underlyingChain),
      Signature.signVia(api.signer),
    );
    const transactionResponse: TransactionResponse = yield* Error.catchBlockchainErrors(
      Effect.promise(() => api.signer.sendTransaction(transactionRequest)),
      // TODO: should we somehow pass the contract and catchRefinedBlockchainErrors?
    );

    return yield* awaitForTransaction(transactionResponse);
  });
}

export function makeFromPrivateKey(
  privateKey: string,
): Layer.Layer<WalletTag, Adt.FatalError, Chain.Tag> {
  return Layer.effect(
    WalletTag,
    Effect.gen(function* () {
      const underlyingChain = yield* Chain.Tag;
      const wallet = yield* Chain.connectWallet(
        underlyingChain,
        new UnderlyingWallet(privateKey, null),
      );
      const address = yield* EffectUtils.getOrFailEither(Adt.Address(wallet.address));
      const signer = yield* refinedSignerInvariant(wallet);

      return {
        [privateApiSymbol]: {
          signer,
          underlyingChain,
        },
        address,
      };
    }),
  );
}

export function makeRandom(): Effect.Effect<WalletShape, Adt.FatalError, Chain.Tag> {
  return Effect.gen(function* () {
    const wallet: HDNodeWallet = yield* Effect.sync(() => UnderlyingWallet.createRandom(null));
    const underlyingChain = yield* Chain.Tag;
    const signer = yield* Chain.connectWallet(underlyingChain, wallet);
    const address = yield* EffectUtils.getOrFailEither(Adt.Address(wallet.address));
    const refinedSigner = yield* refinedSignerInvariant(signer);

    return {
      [privateApiSymbol]: {
        signer: refinedSigner,
        underlyingChain,
      },
      address,
    };
  });
}

export function makeRandomWithNonceManagement(
  makeNonceManager: (signer: Signer) => W.NonceManager,
): Layer.Layer<WalletTag, Adt.FatalError, Chain.Tag> {
  return Layer.effect(
    WalletTag,
    Effect.gen(function* () {
      const wallet: HDNodeWallet = yield* Effect.sync(() => UnderlyingWallet.createRandom(null));
      const underlyingChain = yield* Chain.Tag;
      const signer = makeNonceManager(yield* Chain.connectWallet(underlyingChain, wallet));
      const address = yield* EffectUtils.getOrFailEither(Adt.Address(wallet.address));
      const refinedSigner = yield* refinedSignerInvariant(signer);

      return {
        [privateApiSymbol]: {
          signer: refinedSigner,
          underlyingChain,
        },
        address,
      };
    }),
  );
}

export function makeFromPrivateKeyWithNonceManagement(
  privateKey: string,
  makeNonceManager: (signer: Signer) => W.NonceManager,
): Layer.Layer<WalletTag, Adt.FatalError, Chain.Tag> {
  return Layer.effect(
    WalletTag,
    Effect.gen(function* () {
      const wallet = new UnderlyingWallet(privateKey, null);
      const underlyingChain = yield* Chain.Tag;
      const signer = makeNonceManager(yield* Chain.connectWallet(underlyingChain, wallet));
      const address = yield* EffectUtils.getOrFailEither(Adt.Address(wallet.address));
      const refinedSigner = yield* refinedSignerInvariant(signer);

      return {
        [privateApiSymbol]: {
          signer: refinedSigner,
          underlyingChain,
        },
        address,
      };
    }),
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
  service: WalletShape,
  volume: Token.TokenVolume<Token.TokenType.ERC20 | Token.TokenType.Wrapped>,
  to: Adt.Address,
  f: (address: Adt.Address) => Effect.Effect<TransactionRequest, E, R>,
): Effect.Effect<
  TransactionReceipt,
  E | Adt.FatalError | Error.BlockchainError | W.Errors | Error.TransactionFailedError,
  R | Token.TxTag
> {
  const { address, [privateApiSymbol]: api } = service;
  const prog = Effect.gen(function* () {
    const tokenOp = yield* Token.TxTag;

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
