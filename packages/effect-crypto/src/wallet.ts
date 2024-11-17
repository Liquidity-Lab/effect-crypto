import { Context, Effect, Layer, Option } from "effect";
import {
  AbstractSigner,
  BaseContract,
  type BlockTag,
  Interface,
  InterfaceAbi,
  Signer,
  TransactionReceipt,
  TransactionRequest,
} from "ethers";

import * as Adt from "./adt.js";
import * as Chain from "./chain.js";
import * as Error from "./error.js";
import * as Signature from "./signature.js";
import * as Token from "./token.js";
import * as internal from "./wallet.internal.js";

export { WalletTag as Tag } from "./wallet.internal.js";
export { WalletTag as TxTag } from "./wallet.internal.js";

export type DeployedContractOps = Signature.ContractOps & {
  readonly withWalletRunner: BaseContract;
};

/**
 * Wallet Service implementation.
 * You can create it or\and store in your program state.
 * @example
 *   import { Wallet } from "./com/liquidity_lab/crypto/blockchain";
 *
 *   const wallet: Wallet.Wallet = yield* Wallet.makeRandom();
 */
export type Wallet = Context.Tag.Service<internal.WalletTag>;

/**
 * Creates a wallet instance from a private key.
 *
 * @param privateKey The private key for the wallet.
 * @returns A layer containing the initialized wallet.
 */
export const makeFromPrivateKey: (
  privateKey: string,
) => Layer.Layer<internal.WalletTag, Adt.FatalError, Chain.Tag> = internal.makeFromPrivateKey;

/**
 * Creates a random wallet instance.
 *
 * @returns A layer for an initialized random wallet.
 */
export const makeRandom: () => Effect.Effect<Wallet, Adt.FatalError, Chain.Tag> =
  internal.makeRandom;

/**
 * Creates a random wallet with nonce management.
 * It uses Hardhat Runtime to manage nonce.
 *
 * @returns A layer for the initialized wallet with nonce management.
 */
export const makeRandomWithNonceManagement: (
  makeNonceManager: (signer: Signer) => NonceManager,
) => Layer.Layer<internal.WalletTag, Adt.FatalError, Chain.Tag> =
  internal.makeRandomWithNonceManagement;

/**
 * Creates a wallet from a private key with nonce management. It uses Hardhat Runtime to manage nonce.
 *
 * @param privateKey The private key for the wallet.
 * @returns A layer containing the initialized wallet with nonce management.
 */
export const makeFromPrivateKeyWithNonceManagement: (
  privateKey: string,
  makeNonceManager: (signer: Signer) => NonceManager,
) => Layer.Layer<internal.WalletTag, Adt.FatalError, Chain.Tag> =
  internal.makeFromPrivateKeyWithNonceManagement;

export const transact: {
  (
    transactionRequest: TransactionRequest,
  ): Effect.Effect<
    TransactionReceipt,
    Error.BlockchainError | Error.TransactionFailedError,
    internal.WalletTag
  >;
  (
    wallet: Wallet,
    transactionRequest: TransactionRequest,
  ): Effect.Effect<TransactionReceipt, Error.BlockchainError | Error.TransactionFailedError>;
} = internal.transact;

/**
 * Transfers specified token volume to a target address.
 *
 * @param volume The token volume to transfer.
 * @param to The recipient address.
 * @returns An effect that resolves with the transaction receipt.
 */
export const transferToken: {
  <T extends Token.TokenType.ERC20 | Token.TokenType.Wrapped>(
    volume: Token.TokenVolume<T>,
    to: Adt.Address,
  ): Effect.Effect<
    TransactionReceipt,
    Adt.FatalError | Error.BlockchainError | Errors | Error.TransactionFailedError,
    internal.WalletTag | Token.TxTag
  >;
  <T extends Token.TokenType.ERC20 | Token.TokenType.Wrapped>(
    wallet: Context.Tag.Service<internal.WalletTag>,
    volume: Token.TokenVolume<T>,
    to: Adt.Address,
  ): Effect.Effect<
    TransactionReceipt,
    Adt.FatalError | Error.BlockchainError | Errors | Error.TransactionFailedError,
    Token.TxTag | Chain.Tag
  >;
} = internal.transferToken;

/**
 * Wraps {{volume.token.meta.originalToken}} into a wrapped [[volume.token]].
 *
 * @example
 *   const ETH: Token<TokenType.Native> = {} as NativeToken
 *   const WETH: Token<TokenType.Wrapped> = Token.newWrapped(ETH)
 *
 *   Wallet.wrap(TokenVolume.fromUnits(WETH, "1000")) // Wraps 1000 ETH into WETH
 *
 * @param volume The token volume to wrap.
 * @returns An effect that resolves with the transaction receipt upon successful wrapping.
 */
export const wrap: {
  (
    volume: Token.TokenVolume<Token.TokenType.Wrapped>,
  ): Effect.Effect<
    TransactionReceipt,
    Adt.FatalError | Error.BlockchainError | Error.TransactionFailedError,
    Token.TxTag | internal.WalletTag
  >;
  (
    wallet: Context.Tag.Service<internal.WalletTag>,
    volume: Token.TokenVolume<Token.TokenType.Wrapped>,
  ): Effect.Effect<
    TransactionReceipt,
    Adt.FatalError | Error.BlockchainError | Error.TransactionFailedError,
    Token.TxTag
  >;
} = internal.wrap;

/**
 * Gets the balance of a specified token for the wallet.
 *
 * @param token Token instance representing the token type.
 * @returns An effect that resolves with the token balance.
 */
export const getBalance: {
  <T extends Token.TokenType.ERC20 | Token.TokenType.Wrapped>(
    token: Token.Token<T>,
  ): Effect.Effect<
    Option.Option<Token.TokenVolume<T>>,
    Adt.FatalError | Error.BlockchainError,
    Token.TxTag | internal.WalletTag
  >;
  <T extends Token.TokenType.ERC20 | Token.TokenType.Wrapped>(
    wallet: Context.Tag.Service<internal.WalletTag>,
    token: Token.Token<T>,
  ): Effect.Effect<
    Option.Option<Token.TokenVolume<T>>,
    Adt.FatalError | Error.BlockchainError,
    Token.TxTag | Chain.Tag
  >;
} = internal.getBalance;

/**
 * Transfers native token volume to a target address.
 *
 * @param api the wallet TX.
 * @param volume The native token volume to transfer.
 * @param to The recipient address.
 * @returns An effect that resolves with the transaction receipt.
 */
export const transferNative: {
  (
    volume: Token.TokenVolume<Token.TokenType.Native>,
    to: Adt.Address,
  ): Effect.Effect<
    TransactionReceipt,
    Adt.FatalError | Error.BlockchainError | Errors | Error.TransactionFailedError,
    internal.WalletTag | Chain.Tag | Token.TxTag
  >;
  (
    wallet: Context.Tag.Service<internal.WalletTag>,
    volume: Token.TokenVolume<Token.TokenType.Native>,
    to: Adt.Address,
  ): Effect.Effect<
    TransactionReceipt,
    Adt.FatalError | Error.BlockchainError | Errors | Error.TransactionFailedError,
    Chain.Tag | Token.TxTag
  >;
} = internal.transferNative;

/**
 * Deploys a new contract using the provided ABI, bytecode, and constructor arguments.
 * @param abi Contract ABI.
 * @param bytecode Contract bytecode.
 * @param args Arguments for the constructor.
 * @returns An effect that resolves with the deployed contract operations.
 */
export const deployContract: {
  (
    abi: Interface | InterfaceAbi,
    bytecode: string,
    args: ReadonlyArray<unknown>,
  ): Effect.Effect<
    DeployedContractOps,
    Adt.FatalError | Error.BlockchainError,
    internal.WalletTag | Chain.Tag
  >;
  (
    wallet: Context.Tag.Service<internal.WalletTag>,
    abi: Interface | InterfaceAbi,
    bytecode: string,
    args: ReadonlyArray<unknown>,
  ): Effect.Effect<DeployedContractOps, Adt.FatalError | Error.BlockchainError, Chain.Tag>;
} = internal.deployContract;

/**
 * Error is a sum type of all errors thrown by the Wallet module.
 * @example
 *   import { Wallet } from "./com/liquidity_lab/crypto/blockchain";
 *
 *   const effect: Effect.Effect<any, Wallet.Error, Wallet.TxTag> = ...
 */
export type Errors = InsufficientFundsError;

/**
 * Type guard for Wallet Errors
 */
export const isWalletError: (err: unknown) => err is Errors = internal.isWalletError;

/**
 * InsufficientFundsError is a special error thrown
 * when the wallet is unable to transfer the required amount of tokens.
 */
export interface InsufficientFundsError {
  readonly _tag: "WalletError";
  readonly _kind: "InsufficientFundsError";

  readonly requiredVolume: Token.AnyTokenVolume;
  readonly walletAddress: Adt.Address;

  prettyPrint(): string;
}

/**
 * Type Guard for InsufficientFundsError
 */
export const isInsufficientFundsError = (err: unknown): err is InsufficientFundsError =>
  internal.isInsufficientFundsError(err);

/**
 * Constructor for InsufficientFundsError
 *
 * @param requiredVolume
 * @param walletAddress
 * @constructor
 */
export const InsufficientFundsError = (
  requiredVolume: Token.AnyTokenVolume,
  walletAddress: Adt.Address,
): InsufficientFundsError => {
  return new internal.InsufficientFundsErrorLive(requiredVolume, walletAddress);
};

/**
 * This is a wrapper NonceManager from ethers
 */
export interface NonceManager extends AbstractSigner {
  /**
   *  The Signer being managed.
   */
  readonly signer: Signer;

  getNonce(blockTag?: BlockTag): Promise<number>;
}
