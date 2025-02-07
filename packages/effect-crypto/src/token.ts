import { Context, Effect, Equal, Layer, Option, Order } from "effect";
import { BigNumberish, Contract, TransactionRequest, TransactionResponse } from "ethers";
import { Arbitrary } from "fast-check";

import * as Adt from "./adt.js";
import * as Assertable from "./assertable.js";
import * as BigMath from "./bigMath.js";
import * as Chain from "./chain.js";
import * as Error from "./error.js";
import * as Signature from "./signature.js";
import * as internal from "./token.internal.js";
import * as TokenVolume from "./tokenVolume.js";

export { TokenType, TokensTag as TxTag, TokensTag as Tag } from "./token.internal.js";

/**
 * Token ADT
 *
 * @param T Token type
 */
export interface Token<out T extends internal.TokenType>
  extends Assertable.Assertable,
    Equal.Equal {
  readonly _tag: "Token";
  readonly meta: TokenMetaShape<T>;

  readonly address: Adt.Address;
  readonly decimals: number;
  readonly symbol: string;
  readonly name: string;
}

/**
 * Creates a new token instance
 *
 * @param address The contract address on the chain on which this token lives
 * @param decimals Number of decimals
 * @param symbol Symbol of the token
 * @param name Name of the token
 * @param meta If the token is ERC20
 * @constructor
 */
export const Token: <T extends internal.TokenType>(
  address: Adt.Address,
  decimals: number,
  symbol: string,
  name: string,
  meta: TokenMetaShape<T>,
) => Token<T> = internal.makeToken;

/**
 * Gets a token by its symbol for current blockchain
 *
 * @param symbol, should be the one from [[TokensDescriptor]]
 * @returns a token
 */
export const get: {
  // TODO: Perhaps we have to get rid of this and leave tokens module to be agnostic, so it doesn't really know what tokens are available
  <T extends keyof TokensDescriptor>(
    symbol: T,
  ): Effect.Effect<TokensDescriptor[T], Adt.FatalError, internal.TokensTag>;
  <T extends keyof TokensDescriptor>(
    tokens: Context.Tag.Service<internal.TokensTag>,
    symbol: T,
  ): Effect.Effect<TokensDescriptor[T], Adt.FatalError, Chain.Tag>;
} = internal.getToken;

export type AnyToken = Token<internal.TokenType>;

/**
 * The order for token
 */
export const order: Order.Order<AnyToken> = internal.tokenOrder;

/**
 * Get all available tokens on this chain
 */
export const getAvailableTokens: {
  (): Effect.Effect<ReadonlyArray<AnyToken>, Adt.FatalError, internal.TokensTag>;
  (
    tokens: Context.Tag.Service<internal.TokensTag>,
  ): Effect.Effect<ReadonlyArray<AnyToken>, Adt.FatalError, Chain.Tag>;
} = internal.getAvailableTokens;

export type Erc20Token = Token<internal.TokenType.ERC20>;

/**
 * Creates a new ERC20 token instance
 *
 * @constructor
 */
export const Erc20Token = internal.makeToken<internal.TokenType.ERC20>;

/**
 * Type guard for ERC20 Tokens
 */
export const isERC20Token: (a: Token<internal.TokenType>) => a is Erc20Token =
  internal.isErc20Token;

/**
 * Fetches ERC20 Token data from the blockchain
 * @returns None if token is not found (contract code is not deployed)
 */
export const fetchErc20Token: (
  address: Adt.Address,
) => Effect.Effect<Option.Option<Erc20Token>, Error.BlockchainError, Chain.Tag> =
  internal.fetchErc20Token;

/**
 * Fetches ERC20 Token data from the blockchain using provided contract
 */
export const fetchErc20TokenDataFromContract: (
  contract: Contract,
) => Effect.Effect<Erc20Token, Error.BlockchainError> = internal.fetchErc20TokenDataFromContract;

export type WToken = Token<internal.TokenType.Wrapped>;
/**
 * Creates a new Wrapped token instance
 *
 * @constructor
 */
export const WToken = internal.makeToken<internal.TokenType.Wrapped>;

/**
 * Type guard for Wrapped Tokens
 */
export const isWToken: (a: Token<internal.TokenType>) => a is WToken = internal.isWrappedToken;

export type Erc20LikeToken = Token<internal.TokenType.ERC20 | internal.TokenType.Wrapped>;
/**
 * Type guard for ERC20-like Tokens
 */
export const isErc20LikeToken: (a: Token<internal.TokenType>) => a is Erc20LikeToken =
  internal.isErc20LikeToken;

export type NativeToken = Token<internal.TokenType.Native>;

/**
 * Creates a new Native token instance
 *
 * @constructor
 */
export const NativeToken = internal.makeToken<internal.TokenType.Native>;

/**
 * Type guard for Native Tokens
 */
export const isNativeToken: (a: Token<internal.TokenType>) => a is NativeToken =
  internal.isNativeToken;

/** ETH as a native token
 */
export const nativeETHToken: Token<internal.TokenType.Native> = internal.makeToken(
  // TODO: Not sure if this is correct...
  Adt.Address.unsafe("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"),
  18,
  "ETH",
  "Ether",
  internal.makeNativeTokenMeta(),
);

type IsAnyTokenType<T> =
  [T] extends [internal.TokenType] ?
    [internal.TokenType] extends [T] ?
      true
    : false
  : false;

interface Erc20TokenMeta {
  readonly _tag: "Erc20TokenMeta";
  readonly tokenType: internal.TokenType.ERC20;
}

/**
 * Creates a new Erc20TokenMeta instance
 * @constructor
 */
export const Erc20TokenMeta: () => Erc20TokenMeta = internal.makeErc20TokenMeta;

interface WrappedTokenMeta {
  readonly _tag: "WrappedTokenMeta";
  readonly tokenType: internal.TokenType.Wrapped;
  readonly originalToken: AnyToken;
}

/**
 * Creates a new WrappedTokenMeta instance
 * @constructor
 */
export const WrappedTokenMeta: (originalToken: AnyToken) => WrappedTokenMeta =
  internal.makeWrappedTokenMeta;

interface NativeTokenMeta {
  readonly _tag: "NativeTokenMeta";
  readonly tokenType: internal.TokenType.Native;
}

/**
 * Creates a new NativeTokenMeta instance
 * @constructor
 */
export const NativeTokenMeta = internal.makeNativeTokenMeta;

/**
 * Token metadata shape
 */
export type TokenMetaShape<T extends internal.TokenType> =
  T extends internal.TokenType.ERC20 ? Erc20TokenMeta
  : T extends internal.TokenType.Wrapped ? WrappedTokenMeta
  : T extends internal.TokenType.Native ? NativeTokenMeta
  : Erc20TokenMeta | WrappedTokenMeta | NativeTokenMeta;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type TokenMetaShapeCheck<T extends internal.TokenType> =
  IsAnyTokenType<T> extends true ? never
  : T extends internal.TokenType.ERC20 ? Erc20TokenMeta
  : T extends internal.TokenType.Wrapped ? WrappedTokenMeta
  : T extends internal.TokenType.Native ? NativeTokenMeta
  : Erc20TokenMeta | WrappedTokenMeta | NativeTokenMeta;

/**
 * This type describes all available tokens
 */
export declare type TokensDescriptor = {
  readonly ETH: Token<internal.TokenType.Native>;
  readonly WETH: Token<internal.TokenType.Wrapped>;
  readonly USDC: Token<internal.TokenType.ERC20>;
  readonly USDT: Token<internal.TokenType.ERC20>;
};

/**
 * A layer that provides a TokensTag instance based on a TokensDescriptor
 *
 * @returns A layer that provides a TokensTag instance based on a TokensDescriptor.
 *          If the native token is not found in the descriptor, it will fail with a Adt.FatalError.
 */
export const makeTokensFromDescriptor: (
  config: TokensDescriptor,
  nativeToken: NativeToken,
) => Layer.Layer<internal.TokensTag, Adt.FatalError, Chain.Tag> = internal.makeTokensFromDescriptor;

/**
 * Approves token transfer via signature
 *
 * @param volume The token volume to approve the transfer.
 * @param to The recipient address.
 * @returns An effect that resolves with the transaction receipt.
 */
export const approveTransfer: {
  (
    volume: TokenVolume.Erc20LikeTokenVolume,
    to: Adt.Address,
  ): Effect.Effect<
    TransactionResponse,
    Adt.FatalError | Error.BlockchainError,
    Signature.TxTag | internal.TokensTag
  >;
  (
    tokens: Context.Tag.Service<internal.TokensTag>,
    volume: TokenVolume.Erc20LikeTokenVolume,
    to: Adt.Address,
  ): Effect.Effect<
    TransactionResponse,
    Adt.FatalError | Error.BlockchainError,
    Signature.TxTag | Chain.Tag
  >;
} = internal.approveTransfer;

/**
 * Returns a transaction request for depositing wrapped token
 * @param volume The token volume to deposit
 * @returns An effect that resolves with the transaction request
 */
export const deposit: {
  (
    volume: TokenVolume.WrappedTokenVolume,
  ): Effect.Effect<
    TransactionRequest,
    Adt.FatalError,
    Chain.Tag | Signature.TxTag | internal.TokensTag
  >;
  (
    tokens: Context.Tag.Service<internal.TokensTag>,
    volume: TokenVolume.WrappedTokenVolume,
  ): Effect.Effect<TransactionRequest, Adt.FatalError, Signature.TxTag | Chain.Tag>;
} = internal.deposit;

/**
 * Transfers native token volume to a target address.
 * @param volume The native token volume to transfer.
 * @param to The recipient address.
 * @returns An effect that resolves with the transaction receipt.
 */
export const transferNative: {
  (
    volume: TokenVolume.NativeTokenVolume,
    to: Adt.Address,
  ): Effect.Effect<TransactionRequest, Adt.FatalError, internal.TokensTag | Signature.TxTag>;
  (
    tokens: Context.Tag.Service<internal.TokensTag>,
    volume: TokenVolume.NativeTokenVolume,
    to: Adt.Address,
  ): Effect.Effect<TransactionRequest, Adt.FatalError, Signature.TxTag | Chain.Tag>;
} = internal.transferNative;

/**
 * Gets the balance of a specified  erc20-like token for the wallet.
 * @param token Token instance representing the token type.
 * @param address The address of the wallet.
 * @returns An effect that resolves with the token balance.
 */
export const balanceOfErc20Like: {
  <T extends internal.TokenType.ERC20 | internal.TokenType.Wrapped>(
    token: Token<T>,
    address: Adt.Address,
  ): Effect.Effect<
    Option.Option<TokenVolume.TokenVolume<T>>,
    Adt.FatalError | Error.BlockchainError,
    Signature.TxTag | internal.TokensTag
  >;
  <T extends internal.TokenType.ERC20 | internal.TokenType.Wrapped>(
    wallet: Context.Tag.Service<internal.TokensTag>,
    token: Token<T>,
    address: Adt.Address,
  ): Effect.Effect<
    Option.Option<TokenVolume.TokenVolume<T>>,
    Adt.FatalError | Error.BlockchainError,
    Signature.TxTag | Chain.Tag
  >;
} = internal.balanceOfErc20Like;

/**
 * Transfers ERC20 like token volume to a target address.
 * @param volume The token volume to transfer.
 * @param to The recipient address.
 * @returns An effect that resolves with the transaction request
 */
export const transferErc20Like: {
  <T extends internal.TokenType.ERC20 | internal.TokenType.Wrapped>(
    volume: TokenVolume.TokenVolume<T>,
    to: Adt.Address,
    from: Adt.Address,
  ): Effect.Effect<
    TransactionRequest,
    Adt.FatalError | Error.BlockchainError,
    Signature.TxTag | internal.TokensTag
  >;
  <T extends internal.TokenType.ERC20 | internal.TokenType.Wrapped>(
    wallet: Context.Tag.Service<internal.TokensTag>,
    volume: TokenVolume.TokenVolume<T>,
    to: Adt.Address,
    from: Adt.Address,
  ): Effect.Effect<
    TransactionRequest,
    Adt.FatalError | Error.BlockchainError,
    Signature.TxTag | Chain.Tag
  >;
} = internal.transferErc20Like;
