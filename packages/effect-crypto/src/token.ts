import { Context, Effect, Equal, Layer, Option, Order } from "effect";
import { Contract, TransactionRequest, TransactionResponse } from "ethers";
import { Arbitrary } from "fast-check";

import * as Adt from "./adt.js";
import * as Assertable from "./assertable.js";
import * as Chain from "./chain.js";
import * as Error from "./error.js";
import * as Signature from "./signature.js";
import * as internal from "./token.internal.js";
import * as TokenVolume from "./tokenVolume.js";

export { TokenType, TokensTag as TxTag, TokensTag as Tag } from "./token.internal.js";

/**
 * Represents a cryptocurrency token with its essential properties.
 * This is the base interface for different token types (Native, ERC20, Wrapped).
 *
 * @template T - The specific type of the token, extending `internal.TokenType`.
 * @property _tag - A unique identifier for the Token ADT.
 * @property meta - Metadata specific to the token type (e.g., ERC20, Wrapped, Native).
 * @property address - The blockchain address of the token contract (or a special address for native tokens).
 * @property decimals - The number of decimal places the token uses for its value representation.
 * @property symbol - The abbreviated ticker symbol of the token (e.g., "ETH", "USDC").
 * @property name - The full name of the token (e.g., "Ether", "USD Coin").
 *
 * @example
 * ```typescript
 * import { Token, Erc20TokenMeta, Address } from "effect-crypto";
 *
 * // Example structure of an ERC20 Token instance
 * declare const usdcToken: Token<"Erc20TokenMeta">; // Using string literal for TokenType for simplicity
 *
 * console.log(usdcToken._tag); // "@liquidity_lab/effect-crypto/token#Token"
 * console.log(usdcToken.address); // e.g., Address("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
 * console.log(usdcToken.decimals); // 6
 * console.log(usdcToken.symbol); // "USDC"
 * console.log(usdcToken.name); // "USD Coin"
 * console.log(usdcToken.meta.tokenType); // internal.TokenType.ERC20
 * ```
 */
export interface Token<out T extends internal.TokenType>
  extends Assertable.Assertable,
    Equal.Equal {
  readonly _tag: typeof internal.TokenTag;
  readonly meta: TokenMetaShape<T>;

  readonly address: Adt.Address;
  readonly decimals: number;
  readonly symbol: string;
  readonly name: string;
}

/**
 * Creates a new token instance generically. Prefer using specific constructors like `Erc20Token`, `WToken`, `NativeToken`.
 *
 * @template T - The specific token type.
 * @param address The contract address on the chain on which this token lives.
 * @param decimals Number of decimals.
 * @param symbol Symbol of the token.
 * @param name Name of the token.
 * @param meta Metadata specific to the token type (`Erc20TokenMeta`, `WrappedTokenMeta`, `NativeTokenMeta`).
 * @returns A new `Token` instance of the specified type.
 * @constructor
 *
 * @example
 * ```typescript
 * import { Token, Erc20TokenMeta, Address } from "effect-crypto";
 *
 * const usdcAddress = Address.unsafe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
 * const usdcMeta = Erc20TokenMeta();
 * const usdcToken = Token(usdcAddress, 6, "USDC", "USD Coin", usdcMeta);
 *
 * console.log(usdcToken.symbol); // "USDC"
 * console.log(usdcToken.meta.tokenType); // internal.TokenType.ERC20
 * ```
 */
export const Token: <T extends internal.TokenType>(
  address: Adt.Address,
  decimals: number,
  symbol: string,
  name: string,
  meta: TokenMetaShape<T>,
) => Token<T> = internal.makeToken;

/**
 * Gets a token by its symbol using the `TokensTag` service from the current Effect context.
 * The available tokens are defined by the `TokensDescriptor` provided to the `makeTokensFromDescriptor` layer.
 *
 * @template T - The key (symbol) of the token in the `TokensDescriptor`.
 * @param symbol - The symbol of the token to retrieve (e.g., "ETH", "USDC"). Must be a keyof `TokensDescriptor`.
 * @returns An `Effect` that resolves to the requested `Token` or fails with a `FatalError` if not found or if the `TokensTag` service is unavailable.
 * @param tokens - (Overload) Explicitly provide the `TokensTag` service instance.
 * @param symbol - (Overload) The symbol of the token to retrieve.
 * @returns (Overload) An `Effect` depending on `Chain.Tag` that resolves to the Token or fails.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { Token, Chain, TokensTag, makeTokensFromDescriptor, nativeETHToken } from "effect-crypto";
 *
 * // Assuming TokensDescriptor includes WETH and USDC
 * declare const myTokensDescriptor: TokensDescriptor;
 * const myLayer = makeTokensFromDescriptor(myTokensDescriptor, nativeETHToken);
 *
 * // Example 1: Using context
 * const getWeth = Token.get("WETH");
 * const program1 = Effect.provide(getWeth, myLayer);
 *
 * // Example 2: Passing service explicitly (less common)
 * const getUsdc = (tokensService: typeof TokensTag.Type) => Token.get(tokensService, "USDC");
 * const program2 = Effect.provide(
 *   Effect.flatMap(TokensTag, getUsdc),
 *   myLayer
 * );
 * ```
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
 * Type guard to check if an unknown value is any type of Token.
 *
 * @param a - The value to check.
 * @returns `true` if the value is a `Token`, `false` otherwise.
 *
 * @example
 * ```typescript
 * import { Token, isAnyToken, nativeETHToken } from "effect-crypto";
 *
 * const maybeToken: unknown = nativeETHToken;
 * if (isAnyToken(maybeToken)) {
 *   console.log(maybeToken.symbol); // Safe to access Token properties
 * }
 * ```
 */
export const isAnyToken: {
  (a: unknown): a is AnyToken;
} = internal.isAnyTokenImpl;

/**
 * Provides an `Order` instance for comparing `AnyToken` objects.
 * Comparison is typically based on the token's address.
 *
 * @example
 * ```typescript
 * import { Order } from "effect";
 * import { Token, nativeETHToken } from "effect-crypto";
 * // Assume wethToken is defined elsewhere
 * declare const wethToken: Token<"WrappedTokenMeta">;
 *
 * const comparison = Token.order(nativeETHToken, wethToken);
 *
 * if (comparison === 0) {
 *   console.log("Tokens are the same.");
 * } else if (comparison === -1) {
 *   console.log("nativeETHToken comes before wethToken.");
 * } else {
 *   console.log("nativeETHToken comes after wethToken.");
 * }
 * ```
 */
export const order: Order.Order<AnyToken> = internal.tokenOrder;

/**
 * Get all available tokens defined in the `TokensDescriptor` via the `TokensTag` service.
 *
 * @returns An `Effect` that resolves to a readonly array of all configured `AnyToken` instances,
 *          or fails with a `FatalError` if the `TokensTag` service is unavailable.
 * @param tokens - (Overload) Explicitly provide the `TokensTag` service instance.
 * @returns (Overload) An `Effect` depending on `Chain.Tag` that resolves to the readonly array of tokens or fails.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { Token, Chain, TokensTag, makeTokensFromDescriptor, nativeETHToken } from "effect-crypto";
 *
 * declare const myTokensDescriptor: TokensDescriptor;
 * const myLayer = makeTokensFromDescriptor(myTokensDescriptor, nativeETHToken);
 *
 * // Example 1: Using context
 * const getAllTokens = Token.getAvailableTokens();
 * const program1 = Effect.provide(getAllTokens, myLayer);
 *
 * // Example 2: Passing service explicitly
 * const getAllTokensExplicit = (tokensService: typeof TokensTag.Type) => Token.getAvailableTokens(tokensService);
 * const program2 = Effect.provide(
 *   Effect.flatMap(TokensTag, getAllTokensExplicit),
 *   myLayer
 * );
 *
 * // Usage
 * Effect.runPromise(program1).then(tokens => {
 *   tokens.forEach(token => console.log(token.symbol));
 * });
 * ```
 */
export const getAvailableTokens: {
  (): Effect.Effect<ReadonlyArray<AnyToken>, Adt.FatalError, internal.TokensTag>;
  (
    tokens: Context.Tag.Service<internal.TokensTag>,
  ): Effect.Effect<ReadonlyArray<AnyToken>, Adt.FatalError, Chain.Tag>;
} = internal.getAvailableTokens;

/**
 * Represents a standard ERC20 token.
 * This is a type alias for `Token<internal.TokenType.ERC20>`.
 *
 * @example
 * ```typescript
 * import { Erc20Token, Address } from "effect-crypto";
 *
 * declare const myErc20Token: Erc20Token;
 * console.log(myErc20Token.meta.tokenType); // internal.TokenType.ERC20
 * console.log(myErc20Token.symbol);
 * ```
 */
export type Erc20Token = Token<internal.TokenType.ERC20>;

/**
 * Creates a new ERC20 token instance.
 * This automatically sets the `meta` property with `Erc20TokenMeta`.
 *
 * @param address The contract address of the ERC20 token.
 * @param decimals Number of decimals.
 * @param symbol Symbol of the token (e.g., "USDC").
 * @param name Name of the token (e.g., "USD Coin").
 * @returns A new `Erc20Token` instance.
 * @constructor
 *
 * @example
 * ```typescript
 * import { Erc20Token, Address } from "effect-crypto";
 *
 * const usdcAddress = Address.unsafe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
 * const usdc = Erc20Token(usdcAddress, 6, "USDC", "USD Coin");
 *
 * console.log(usdc.name); // "USD Coin"
 * console.log(usdc.meta.tokenType); // internal.TokenType.ERC20
 * ```
 */
export const Erc20Token = internal.makeToken<internal.TokenType.ERC20>;

/**
 * Type guard to check if a `Token` is specifically an `Erc20Token`.
 *
 * @param a - The `Token` instance to check.
 * @returns `true` if the token's meta type is `ERC20`, `false` otherwise.
 *
 * @example
 * ```typescript
 * import { Token, isERC20Token, nativeETHToken } from "effect-crypto";
 * // Assume usdcToken is an Erc20Token
 * declare const usdcToken: Token<any>;
 *
 * if (isERC20Token(usdcToken)) {
 *   console.log("It's an ERC20 token:", usdcToken.symbol);
 * }
 *
 * if (!isERC20Token(nativeETHToken)) {
 *   console.log("Native ETH is not an ERC20 token.");
 * }
 * ```
 */
export const isERC20Token: (a: Token<internal.TokenType>) => a is Erc20Token =
  internal.isErc20Token;

/**
 * Fetches ERC20 Token data (name, symbol, decimals) from the blockchain
 * using the provided contract address.
 *
 * @param address - The `Address` of the ERC20 contract.
 * @returns An `Effect` that resolves to `Some<Erc20Token>` if the contract exists and adheres
 *          to the ERC20 standard, or `None` if the contract code is not deployed or doesn't
 *          implement the necessary ERC20 interface functions. Fails with `BlockchainError`
 *          for network or contract call issues.
 *
 * @example
 * ```typescript
 * // This example requires a running node connection provided via Chain.Tag
 * import { Effect, Option } from "effect";
 * import { Token, Address, Chain, Error } from "effect-crypto";
 *
 * const usdcAddress = Address.unsafe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"); // Example address
 *
 * const fetchEffect = Token.fetchErc20Token(usdcAddress);
 *
 * // Assuming a Chain service is provided in the context
 * const program = Effect.match(fetchEffect, {
 *   onFailure: (err: Error.BlockchainError) => console.error("Blockchain error:", err),
 *   onSuccess: (maybeToken: Option.Option<Token.Erc20Token>) => {
 *     if (Option.isSome(maybeToken)) {
 *       console.log("Fetched token:", maybeToken.value.symbol);
 *     } else {
 *       console.log("Token not found or not ERC20 at the address.");
 *     }
 *   }
 * });
 * ```
 */
export const fetchErc20Token: (
  address: Adt.Address,
) => Effect.Effect<Option.Option<Erc20Token>, Error.BlockchainError, Chain.Tag> =
  internal.fetchErc20Token;

/**
 * Fetches ERC20 Token data (name, symbol, decimals) using a pre-initialized Ethers `Contract` instance.
 * This is useful if you already have a contract object.
 *
 * @param contract - An Ethers `Contract` instance connected to the ERC20 token address.
 * @returns An `Effect` that resolves to the `Erc20Token` data. Fails with `BlockchainError`
 *          if the contract calls (name, symbol, decimals) fail.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { Contract, JsonRpcProvider } from "ethers";
 * import { Token, Address, Error } from "effect-crypto";
 *
 * // Setup: Provider and Contract instance
 * const provider = new JsonRpcProvider("http://localhost:8545"); // Example provider
 * const usdcAddress = Address.unsafe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
 * const erc20Abi = [ "function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)" ];
 * const usdcContract = new Contract(usdcAddress, erc20Abi, provider);
 *
 * // Fetch data using the contract instance
 * const fetchEffect = Token.fetchErc20TokenDataFromContract(usdcContract);
 *
 * const program = Effect.match(fetchEffect, {
 *   onFailure: (err: Error.BlockchainError) => console.error("Blockchain error:", err),
 *   onSuccess: (token: Token.Erc20Token) => {
 *     console.log(`Fetched: ${token.name} (${token.symbol}), Decimals: ${token.decimals}`);
 *   }
 * });
 * ```
 */
export const fetchErc20TokenDataFromContract: (
  contract: Contract,
) => Effect.Effect<Erc20Token, Error.BlockchainError> = internal.fetchErc20TokenDataFromContract;

/**
 * Represents a Wrapped token (e.g., WETH wrapping ETH).
 * This is a type alias for `Token<internal.TokenType.Wrapped>`.
 * Wrapped tokens typically conform to the ERC20 standard but represent an underlying asset.
 *
 * @example
 * ```typescript
 * import { WToken, Address, nativeETHToken } from "effect-crypto";
 *
 * declare const myWethToken: WToken;
 * console.log(myWethToken.meta.tokenType); // internal.TokenType.Wrapped
 * console.log(myWethToken.symbol); // e.g., "WETH"
 * // Access the original token it wraps
 * console.log(myWethToken.meta.originalToken.symbol); // e.g., "ETH"
 * ```
 */
export type WToken = Token<internal.TokenType.Wrapped>;

/**
 * Creates a new Wrapped token instance.
 * Requires specifying the original token being wrapped.
 *
 * @param address The contract address of the Wrapped token.
 * @param decimals Number of decimals (usually same as original token).
 * @param symbol Symbol of the token (e.g., "WETH").
 * @param name Name of the token (e.g., "Wrapped Ether").
 * @param originalToken The `Token` instance representing the asset being wrapped (e.g., `nativeETHToken`).
 * @returns A new `WToken` instance.
 * @constructor
 *
 * @example
 * ```typescript
 * import { WToken, Address, nativeETHToken } from "effect-crypto";
 *
 * const wethAddress = Address.unsafe("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"); // Example WETH address
 * const weth = WToken(wethAddress, 18, "WETH", "Wrapped Ether", nativeETHToken);
 *
 * console.log(weth.name); // "Wrapped Ether"
 * console.log(weth.meta.tokenType); // internal.TokenType.Wrapped
 * console.log(weth.meta.originalToken.symbol); // "ETH"
 * ```
 */
export const WToken = internal.makeToken<internal.TokenType.Wrapped>;

/**
 * Type guard to check if a `Token` is specifically a `WToken` (Wrapped Token).
 *
 * @param a - The `Token` instance to check.
 * @returns `true` if the token's meta type is `Wrapped`, `false` otherwise.
 *
 * @example
 * ```typescript
 * import { Token, isWToken, nativeETHToken } from "effect-crypto";
 * // Assume wethToken is a WToken
 * declare const wethToken: Token<any>;
 *
 * if (isWToken(wethToken)) {
 *   console.log(`It's a wrapped token: ${wethToken.symbol}, wraps: ${wethToken.meta.originalToken.symbol}`);
 * }
 *
 * if (!isWToken(nativeETHToken)) {
 *   console.log("Native ETH is not a wrapped token.");
 * }
 * ```
 */
export const isWToken: (a: Token<internal.TokenType>) => a is WToken = internal.isWrappedToken;

/**
 * Represents a token that behaves like an ERC20 token, including standard ERC20
 * and Wrapped tokens (which usually implement the ERC20 interface).
 * This is a type alias for `Token<internal.TokenType.ERC20 | internal.TokenType.Wrapped>`.
 *
 * @example
 * ```typescript
 * import { Erc20LikeToken, Erc20Token, WToken } from "effect-crypto";
 *
 * declare const someToken: Erc20LikeToken;
 *
 * function processErc20Like(token: Erc20LikeToken) {
 *   console.log("Processing ERC20-like token:", token.symbol);
 *   // Can safely access properties common to ERC20 and Wrapped tokens
 * }
 *
 * declare const usdc: Erc20Token;
 * declare const weth: WToken;
 *
 * processErc20Like(usdc);
 * processErc20Like(weth);
 * ```
 */
export type Erc20LikeToken = Token<internal.TokenType.ERC20 | internal.TokenType.Wrapped>;

/**
 * Type guard to check if a `Token` is either an `Erc20Token` or a `WToken`.
 *
 * @param a - The `Token` instance to check.
 * @returns `true` if the token's meta type is `ERC20` or `Wrapped`, `false` otherwise.
 *
 * @example
 * ```typescript
 * import { Token, isErc20LikeToken, nativeETHToken } from "effect-crypto";
 * // Assume usdcToken is Erc20, wethToken is WToken
 * declare const usdcToken: Token<any>;
 * declare const wethToken: Token<any>;
 *
 * if (isErc20LikeToken(usdcToken)) {
 *   console.log("USDC is ERC20-like.");
 * }
 * if (isErc20LikeToken(wethToken)) {
 *   console.log("WETH is ERC20-like.");
 * }
 * if (!isErc20LikeToken(nativeETHToken)) {
 *   console.log("Native ETH is not ERC20-like.");
 * }
 * ```
 */
export const isErc20LikeToken: (a: Token<internal.TokenType>) => a is Erc20LikeToken =
  internal.isErc20LikeToken;

/**
 * Represents the native currency of the blockchain (e.g., ETH on Ethereum).
 * This is a type alias for `Token<internal.TokenType.Native>`.
 */
export type NativeToken = Token<internal.TokenType.Native>;

/**
 * Creates a new Native token instance.
 * Native tokens represent the base currency of the blockchain (e.g., ETH).
 *
 * @param address A special address representing the native token (often a zero or sentinel address).
 * @param decimals Number of decimals (e.g., 18 for ETH).
 * @param symbol Symbol of the native currency (e.g., "ETH").
 * @param name Name of the native currency (e.g., "Ether").
 * @returns A new `NativeToken` instance.
 * @constructor
 */
export const NativeToken = internal.makeToken<internal.TokenType.Native>;

/**
 * Type guard to check if a `Token` is specifically a `NativeToken`.
 *
 * @param a - The `Token` instance to check.
 * @returns `true` if the token's meta type is `Native`, `false` otherwise.
 *
 * @example
 * ```typescript
 * import { Token, isNativeToken, nativeETHToken } from "effect-crypto";
 * // Assume usdcToken is an Erc20Token
 * declare const usdcToken: Token<any>;
 *
 * if (isNativeToken(nativeETHToken)) {
 *   console.log("It's the native token:", nativeETHToken.symbol);
 * }
 *
 * if (!isNativeToken(usdcToken)) {
 *   console.log("USDC is not the native token.");
 * }
 * ```
 */
export const isNativeToken: (a: Token<internal.TokenType>) => a is NativeToken =
  internal.isNativeToken;

/**
 * Represents the native Ether (ETH) token on Ethereum-compatible chains.
 *
 * Uses the conventional sentinel address `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`
 * to represent native ETH in contexts where a token address is expected (like some DEX routers).
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

/**
 * Metadata specific to standard ERC20 tokens.
 *
 * @property _tag - Unique identifier for the Erc20TokenMeta type.
 * @property tokenType - Discriminant property indicating the token type is ERC20.
 */
interface Erc20TokenMeta {
  readonly _tag: "Erc20TokenMeta";
  readonly tokenType: internal.TokenType.ERC20;
}

/**
 * Creates a new `Erc20TokenMeta` instance.
 * Used internally when creating an `Erc20Token`.
 *
 * @returns A new `Erc20TokenMeta` object.
 * @constructor
 */
export const Erc20TokenMeta: () => Erc20TokenMeta = internal.makeErc20TokenMeta;

/**
 * Metadata specific to Wrapped tokens (e.g., WETH).
 *
 * @property _tag - Unique identifier for the WrappedTokenMeta type.
 * @property tokenType - Discriminant property indicating the token type is Wrapped.
 * @property originalToken - The underlying `Token` that this token wraps (e.g., native ETH for WETH).
 */
interface WrappedTokenMeta {
  readonly _tag: "WrappedTokenMeta";
  readonly tokenType: internal.TokenType.Wrapped;
  readonly originalToken: AnyToken;
}

/**
 * Creates a new `WrappedTokenMeta` instance.
 * Used internally when creating a `WToken`.
 *
 * @param originalToken - The `Token` instance being wrapped.
 * @returns A new `WrappedTokenMeta` object.
 * @constructor
 *
 * @example
 * ```typescript
 * import { WrappedTokenMeta, nativeETHToken } from "effect-crypto";
 *
 * const meta = WrappedTokenMeta(nativeETHToken);
 * console.log(meta._tag); // "WrappedTokenMeta"
 * console.log(meta.tokenType); // internal.TokenType.Wrapped
 * console.log(meta.originalToken.symbol); // "ETH"
 * ```
 */
export const WrappedTokenMeta: (originalToken: AnyToken) => WrappedTokenMeta =
  internal.makeWrappedTokenMeta;

/**
 * Metadata specific to the native blockchain currency (e.g., ETH).
 *
 * @property _tag - Unique identifier for the NativeTokenMeta type.
 * @property tokenType - Discriminant property indicating the token type is Native.
 */
interface NativeTokenMeta {
  readonly _tag: "NativeTokenMeta";
  readonly tokenType: internal.TokenType.Native;
}

/**
 * Creates a new `NativeTokenMeta` instance.
 * Used internally when creating a `NativeToken`.
 *
 * @returns A new `NativeTokenMeta` object.
 * @constructor
 */
export const NativeTokenMeta = internal.makeNativeTokenMeta;

/**
 * Represents the possible shapes of the `meta` property within a `Token`,
 * depending on the token's type (`T`).
 *
 * This discriminated union allows accessing type-specific metadata safely.
 *
 * @template T - The specific `internal.TokenType`.
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
 * Describes the set of tokens available within a specific context or blockchain environment.
 * This type is used to configure the `TokensTag` service via `makeTokensFromDescriptor`.
 * Keys are typically the token symbols.
 *
 * @example
 * ```typescript
 * import { Token, TokensDescriptor, Erc20Token, WToken, NativeToken, Address, nativeETHToken } from "effect-crypto";
 *
 * // Define WETH and USDC tokens (assuming they exist)
 * const wethAddress = Address.unsafe("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
 * const usdcAddress = Address.unsafe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
 * const wethToken = Token.WToken(wethAddress, 18, "WETH", "Wrapped Ether", nativeETHToken);
 * const usdcToken = Token.Erc20Token(usdcAddress, 6, "USDC", "USD Coin");
 *
 * // Create a descriptor including the native ETH token
 * const myTokenConfig: TokensDescriptor = {
 *   ETH: nativeETHToken,
 *   WETH: wethToken,
 *   USDC: usdcToken,
 *   // Add other tokens as needed (e.g., USDT)
 *   USDT: Token.Erc20Token(Address.unsafe("0xdAC17F958D2ee523a2206206994597C13D831ec7"), 6, "USDT", "Tether USD")
 * };
 *
 * // This config can now be used with makeTokensFromDescriptor
 * ```
 */
export declare type TokensDescriptor = {
  readonly ETH: Token<internal.TokenType.Native>;
  readonly WETH: Token<internal.TokenType.Wrapped>;
  readonly USDC: Token<internal.TokenType.ERC20>;
  readonly USDT: Token<internal.TokenType.ERC20>;
};

/**
 * Creates an Effect `Layer` that provides the `TokensTag` service.
 * This service allows retrieving configured tokens by symbol using `Token.get`
 * and getting all configured tokens using `Token.getAvailableTokens`.
 *
 * @param config - A `TokensDescriptor` object mapping token symbols to their `Token` instances.
 * @param nativeToken - The specific `NativeToken` instance representing the blockchain's native currency within the `config`.
 * @returns An Effect `Layer` that provides the `TokensTag` service.
 *          The layer requires `Chain.Tag` context.
 *          It fails with an `Adt.FatalError` if the provided `nativeToken` is not found within the `config` object
 *          or if the native token from the `Chain.Tag` service doesn't match the provided `nativeToken`.
 *
 * @example
 * ```typescript
 * import { Effect, Layer } from "effect";
 * import { Token, TokensDescriptor, nativeETHToken, Chain } from "effect-crypto";
 *
 * // Assume myTokenConfig is a valid TokensDescriptor including nativeETHToken
 * declare const myTokenConfig: TokensDescriptor;
 * // Assume chainLayer provides the Chain.Tag service
 * declare const chainLayer: Layer.Layer<Chain.Tag, any, any>;
 *
 * const tokensLayer = Token.makeTokensFromDescriptor(myTokenConfig, nativeETHToken);
 *
 * // Combine layers
 * const appLayer = Layer.provide(tokensLayer, chainLayer);
 *
 * // Now effects requiring TokensTag can be run
 * const program = Effect.provide(
 *   Token.get("USDC"), // Requires TokensTag
 *   appLayer
 * );
 *
 * Effect.runPromise(program).then(usdcToken => {
 *   console.log("Got USDC token:", usdcToken.symbol);
 * });
 * ```
 */
export const makeTokensFromDescriptor: (
  config: TokensDescriptor,
  nativeToken: NativeToken,
) => Layer.Layer<internal.TokensTag, Adt.FatalError, Chain.Tag> = internal.makeTokensFromDescriptor;

/**
 * Approves a spender address to transfer a specific amount of an ERC20-like token
 * from the owner's account by sending a transaction.
 *
 * @param volume - The `TokenVolume` specifying the token and the amount to approve.
 *                 Must be an `Erc20LikeTokenVolume` (ERC20 or Wrapped).
 * @param to - The `Address` of the spender being granted the allowance.
 * @returns An `Effect` that resolves with the `TransactionResponse` upon successful submission.
 *          Fails with `BlockchainError` for network/contract issues or `FatalError` for configuration issues.
 *          Requires `Signature.TxTag` (for signing) and `internal.TokensTag` (or `Chain.Tag` in overload).
 * @param tokens - (Overload) Explicitly provide the `TokensTag` service.
 * @param volume - (Overload) The token volume to approve.
 * @param to - (Overload) The spender address.
 * @returns (Overload) An `Effect` depending on `Signature.TxTag` and `Chain.Tag`.
 *
 * @example
 * ```typescript
 * // This example assumes a configured environment with Signer, Provider, and TokensTag
 * import { Effect } from "effect";
 * import { Token, TokenVolume, Address, Error } from "effect-crypto";
 *
 * declare const usdcToken: Token.Erc20Token;
 * declare const spenderAddress: Address;
 *
 * const amountToApprove = TokenVolume.Erc20Like(usdcToken, 100_000000n); // Approve 100 USDC (6 decimals)
 *
 * const approveEffect = Token.approveTransfer(amountToApprove, spenderAddress);
 *
 * // Assuming necessary context (Signer, Chain, TokensTag) is provided
 * const program = Effect.match(approveEffect, {
 *   onFailure: (err: Adt.FatalError | Error.BlockchainError) => console.error("Approval failed:", err),
 *   onSuccess: (txResponse) => console.log("Approval transaction submitted:", txResponse.hash)
 * });
 * ```
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
 * Returns a transaction request for depositing the underlying native asset into a Wrapped token contract (e.g., depositing ETH to get WETH).
 *
 * @param volume - The `TokenVolume` specifying the Wrapped token and the amount of the *native* asset to deposit.
 *                 The amount corresponds to the native token (e.g., amount of ETH for WETH deposit).
 * @returns An `Effect` that resolves with the `TransactionRequest` object, which can then be signed and sent.
 *          The `value` field of the request will be set to the deposit amount.
 *          Fails with `FatalError` for configuration issues.
 *          Requires `Chain.Tag`, `Signature.TxTag`, and `internal.TokensTag` (or just `Chain.Tag`/`Signature.TxTag` in overload).
 * @param tokens - (Overload) Explicitly provide the `TokensTag` service.
 * @param volume - (Overload) The wrapped token volume indicating the amount of native token to deposit.
 * @returns (Overload) An `Effect` depending on `Signature.TxTag` and `Chain.Tag`.
 *
 * @example
 * ```typescript
 * // This example assumes a configured environment
 * import { Effect } from "effect";
 * import { Token, TokenVolume, Address, Error } from "effect-crypto";
 *
 * declare const wethToken: Token.WToken; // Assume WETH token is available
 * declare const userAddress: Address;
 *
 * // Specify the amount of ETH to deposit (volume uses WETH token for type safety)
 * const depositAmount = TokenVolume.Wrapped(wethToken, 1_000000000000000000n); // Deposit 1 ETH
 *
 * const depositTxRequestEffect = Token.deposit(depositAmount);
 *
 * // Assuming necessary context (Signer, Chain, TokensTag) is provided
 * const program = Effect.flatMap(depositTxRequestEffect, (txRequest) => {
 *   console.log("Deposit Transaction Request:", txRequest);
 *   console.log("Value (amount of ETH to send):", txRequest.value);
 *   // Next step: sign and send txRequest using Signature.sendTransaction
 *   return Effect.succeed(txRequest);
 * });
 * ```
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
 * Returns a transaction request for transferring the native blockchain currency (e.g., ETH).
 *
 * @param volume - The `TokenVolume` specifying the native token and the amount to transfer.
 * @param to - The recipient `Address`.
 * @returns An `Effect` that resolves with the `TransactionRequest` object.
 *          The `value` field of the request will be set to the transfer amount.
 *          Fails with `FatalError` for configuration issues.
 *          Requires `internal.TokensTag` and `Signature.TxTag` (or `Chain.Tag`/`Signature.TxTag` in overload).
 * @param tokens - (Overload) Explicitly provide the `TokensTag` service.
 * @param volume - (Overload) The native token volume to transfer.
 * @param to - (Overload) The recipient address.
 * @returns (Overload) An `Effect` depending on `Signature.TxTag` and `Chain.Tag`.
 *
 * @example
 * ```typescript
 * // This example assumes a configured environment
 * import { Effect } from "effect";
 * import { Token, TokenVolume, Address, Error, nativeETHToken } from "effect-crypto";
 *
 * declare const recipientAddress: Address;
 *
 * const amountToSend = TokenVolume.Native(nativeETHToken, 500000000000000000n); // Send 0.5 ETH
 *
 * const transferTxRequestEffect = Token.transferNative(amountToSend, recipientAddress);
 *
 * // Assuming necessary context (Signer, Chain, TokensTag) is provided
 * const program = Effect.flatMap(transferTxRequestEffect, (txRequest) => {
 *   console.log("Native Transfer Transaction Request:", txRequest);
 *   console.log("Value (amount of ETH to send):", txRequest.value);
 *   // Next step: sign and send txRequest using Signature.sendTransaction
 *   return Effect.succeed(txRequest);
 * });
 * ```
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
 * Gets the balance of a specified ERC20-like token (ERC20 or Wrapped) for a given wallet address.
 *
 * @template T - The specific token type (ERC20 or Wrapped).
 * @param token - The `Token` instance representing the token to check the balance of.
 * @param address - The `Address` of the wallet whose balance is being queried.
 * @returns An `Effect` that resolves to `Some<TokenVolume<T>>` containing the balance, or `None` if the token contract query fails (e.g., contract doesn't exist at address, but doesn't error).
 *          Fails with `BlockchainError` for network/contract call errors or `FatalError` for configuration issues.
 *          Requires `Signature.TxTag` and `internal.TokensTag` (or `Chain.Tag`/`Signature.TxTag` in overload).
 * @param wallet - (Overload, deprecated naming) Explicitly provide the `TokensTag` service.
 * @param token - (Overload) The token instance.
 * @param address - (Overload) The wallet address.
 * @returns (Overload) An `Effect` depending on `Signature.TxTag` and `Chain.Tag`.
 *
 * @example
 * ```typescript
 * // This example assumes a configured environment
 * import { Effect, Option } from "effect";
 * import { Token, TokenVolume, Address, Error } from "effect-crypto";
 *
 * declare const usdcToken: Token.Erc20Token;
 * declare const walletAddress: Address;
 *
 * const getBalanceEffect = Token.balanceOfErc20Like(usdcToken, walletAddress);
 *
 * // Assuming necessary context (Provider/Chain, TokensTag) is provided
 * const program = Effect.match(getBalanceEffect, {
 *   onFailure: (err: Adt.FatalError | Error.BlockchainError) => console.error("Failed to get balance:", err),
 *   onSuccess: (maybeBalance: Option.Option<TokenVolume.TokenVolume<Token.TokenType.ERC20>>) => {
 *     if (Option.isSome(maybeBalance)) {
 *       console.log(`USDC Balance: ${TokenVolume.format(maybeBalance.value)}`);
 *     } else {
 *       console.log("Could not retrieve balance (maybe token contract issue?)");
 *     }
 *   }
 * });
 * ```
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
 * Returns a transaction request for transferring an ERC20-like token (ERC20 or Wrapped).
 *
 * @template T - The specific token type (ERC20 or Wrapped).
 * @param volume - The `TokenVolume` specifying the token and amount to transfer.
 * @param to - The recipient `Address`.
 * @param from - The sender `Address` (needed for constructing the transaction, must match the signer).
 * @returns An `Effect` that resolves with the `TransactionRequest` object.
 *          Fails with `BlockchainError` for network/contract issues or `FatalError` for configuration issues.
 *          Requires `Signature.TxTag` and `internal.TokensTag` (or `Chain.Tag`/`Signature.TxTag` in overload).
 * @param wallet - (Overload, deprecated naming) Explicitly provide the `TokensTag` service.
 * @param volume - (Overload) The token volume to transfer.
 * @param to - (Overload) The recipient address.
 * @param from - (Overload) The sender address.
 * @returns (Overload) An `Effect` depending on `Signature.TxTag` and `Chain.Tag`.
 *
 * @example
 * ```typescript
 * // This example assumes a configured environment
 * import { Effect } from "effect";
 * import { Token, TokenVolume, Address, Error } from "effect-crypto";
 *
 * declare const usdcToken: Token.Erc20Token;
 * declare const recipientAddress: Address;
 * declare const senderAddress: Address; // Address of the signer
 *
 * const amountToSend = TokenVolume.Erc20Like(usdcToken, 50_000000n); // Send 50 USDC
 *
 * const transferTxRequestEffect = Token.transferErc20Like(amountToSend, recipientAddress, senderAddress);
 *
 * // Assuming necessary context (Signer, Chain, TokensTag) is provided
 * const program = Effect.flatMap(transferTxRequestEffect, (txRequest) => {
 *   console.log("ERC20 Transfer Transaction Request:", txRequest);
 *   // Next step: sign and send txRequest using Signature.sendTransaction
 *   return Effect.succeed(txRequest);
 * });
 * ```
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

/**
 * Generates an arbitrary `Token` of a specified type (`ERC20`, `Wrapped`, or `Native`)
 * for use in property-based testing with `fast-check`.
 *
 * @template T - The specific `internal.TokenType` to generate.
 * @param tokenType - The `internal.TokenType` enum value indicating the type of token required.
 * @param constraints - Optional constraints for token generation.
 * @param constraints.maxDecimals - The maximum number of decimal places for the generated token (default: 18). A random value between 6 and `maxDecimals` (inclusive) will be chosen.
 * @param constraints.originalToken - Required only when `tokenType` is `TokenType.Wrapped`. Specifies the `AnyToken` to be used as the `originalToken` in the `WrappedTokenMeta`.
 * @returns A `fast-check` `Arbitrary` that generates `Token<T>` instances.
 * @throws `FatalError` if `tokenType` is `TokenType.Wrapped` but `constraints.originalToken` is not provided.
 *
 * @example
 * ```typescript
 * import { fc } from "fast-check";
 * import { Token, TokenType, nativeETHToken } from "effect-crypto";
 *
 * // Generate an arbitrary ERC20 token (decimals between 6 and 18)
 * const arbErc20 = Token.tokenGen(TokenType.ERC20);
 *
 * // Generate an arbitrary Wrapped token (wrapping native ETH) with max 8 decimals
 * const arbWeth = Token.tokenGen(TokenType.Wrapped, {
 *   maxDecimals: 8,
 *   originalToken: nativeETHToken
 * });
 *
 * // Generate the native token (always returns nativeETHToken)
 * const arbNative = Token.tokenGen(TokenType.Native);
 *
 * fc.assert(
 *   fc.property(arbErc20, arbWeth, arbNative, (erc20, weth, native) => {
 *     console.log("Generated ERC20:", erc20.symbol, erc20.decimals);
 *     console.log("Generated WETH:", weth.symbol, weth.decimals, weth.meta.originalToken.symbol);
 *     console.log("Generated Native:", native.symbol);
 *     return true;
 *   })
 * );
 * ```
 */
export const tokenGen: {
  <T extends internal.TokenType>(
    tokenType: T,
    constraints?: {
      maxDecimals?: number;
    },
  ): Arbitrary<Token<T>>;
} = internal.tokenGenImpl;

/**
 * Generates an arbitrary pair of distinct `Token` instances of the same specified type
 * (`ERC20`, `Wrapped`, or `Native`) for use in property-based testing.
 * Useful for testing interactions between two different tokens (e.g., trading pairs).
 *
 * @template T - The specific `internal.TokenType` for both tokens in the pair.
 * @param tokenType - The `internal.TokenType` enum value indicating the type of tokens required.
 * @param constraints - Optional constraints for token generation (applied to both tokens).
 * @param constraints.maxDecimals - Maximum number of decimal places (default: 18). Random value between 6 and `maxDecimals` chosen for each token.
 * @param constraints.originalToken - Required only when `tokenType` is `TokenType.Wrapped`. Specifies the `AnyToken` used as the `originalToken` for both generated wrapped tokens.
 * @returns A `fast-check` `Arbitrary` that generates tuples `[Token<T>, Token<T>]` where the two tokens are guaranteed to be different (based on address).
 * @throws `FatalError` if `tokenType` is `TokenType.Wrapped` but `constraints.originalToken` is not provided.
 *
 * @example
 * ```typescript
 * import { fc } from "fast-check";
 * import { Token, TokenType, nativeETHToken } from "effect-crypto";
 *
 * // Generate a pair of distinct ERC20 tokens
 * const arbErc20Pair = Token.tokenPairGen(TokenType.ERC20);
 *
 * // Generate a pair of distinct Wrapped tokens (wrapping ETH)
 * const arbWethPair = Token.tokenPairGen(TokenType.Wrapped, { originalToken: nativeETHToken });
 *
 * // Generate a pair of Native tokens (will likely fail as native token is usually unique)
 * // const arbNativePair = Token.tokenPairGen(TokenType.Native); // Use with caution
 *
 * fc.assert(
 *   fc.property(arbErc20Pair, arbWethPair, (erc20Pair, wethPair) => {
 *     const [tokenA, tokenB] = erc20Pair;
 *     const [wethA, wethB] = wethPair;
 *
 *     console.log(`ERC20 Pair: ${tokenA.symbol}/${tokenB.symbol}`);
 *     console.log(`WETH Pair: ${wethA.symbol}/${wethB.symbol}`);
 *
 *     // Verify they are different tokens
 *     return !Token.order(tokenA, tokenB) && !Token.order(wethA, wethB);
 *   })
 * );
 * ```
 */
export const tokenPairGen: {
  <T extends internal.TokenType>(
    tokenType: T,
    constraints?: {
      maxDecimals?: number;
    },
  ): Arbitrary<[Token<T>, Token<T>]>;
} = internal.tokenPairGenImpl;
