import { BigDecimal } from "bigdecimal.js";
import { Either, Option } from "effect";
import { Arbitrary } from "fast-check";

import * as Assertable from "./assertable.js";
import * as BigMath from "./bigMath.js";
import * as internal from "./price.internal.js";
import * as Token from "./token.js";
import * as TokenVolume from "./tokenVolume.js";

/**
 * Represents a regular price value expressed as a ratio between two tokens.
 * This is the standard representation for price values, where the value directly
 * corresponds to the exchange rate between tokens.
 *
 * For example, if the value is 50000, it means 1 unit of the base token equals
 * 50000 units of the quote token.
 */
export interface PriceValueUnits {
  readonly _tag: "@liquidity_lab/effect-crypto/price#PriceValueUnits";
  readonly value: BigMath.Ratio;

  /**
   * Returns the inverted price value (1/price).
   * For a price expressed as quote/base, this returns base/quote.
   */
  get flip(): this;
}

/**
 * This special representation is used for sqrt price values, primarily in Uniswap V3 pools.
 * The value represents the square root of the price ratio between two tokens.
 *
 * In Uniswap V3, liquidity is concentrated around price ranges, and the sqrt price
 * representation enables more efficient calculations for liquidity values along
 * the price curve.
 *
 * The value here is the square root of the actual price. To obtain the real price,
 * you need to square this value.
 */
export interface PriceValueSqrtUnits {
  readonly _tag: "@liquidity_lab/effect-crypto/price#PriceValueSqrtUnits";
  readonly value: BigMath.Ratio;

  /**
   * Returns the inverted sqrt price value (1/sqrt(price)).
   * For a sqrt price expressed as √(quote/base), this returns √(base/quote).
   */
  get flip(): this;
}

/**
 * Represents the underlying price value for token pairs.
 *
 * This type is a union of two different price representations:
 *
 * 1. `PriceValueUnits` - The standard price representation, where the value
 *    directly represents the exchange rate between tokens.
 *
 * 2. `PriceValueSqrtUnits` - A specialized representation used primarily in
 *    Uniswap V3 pools, where the value is the square root of the actual price.
 *
 * The different representations serve different purposes and optimization needs
 * in DeFi protocols.
 * Functions in this module handle both representations appropriately
 * based on the context of use.
 */
export type PriceValue = PriceValueUnits | PriceValueSqrtUnits;

/**
 * Represents a price ratio between two tokens with type T.
 * The price is always expressed as a ratio of quoteCurrency/baseCurrency (token1/token0).
 *
 * For example, if:
 * - baseCurrency (token0) is BTC
 * - quoteCurrency (token1) is USDT
 * - price is 50_000
 *
 * This means 1 BTC = 50_000 USDT
 *
 * The tokens are always stored in a deterministic order where token0 < token1
 * based on their addresses to ensure consistent pool addressing. This means that
 * regardless of the order in which tokens are provided, they will be sorted
 * internally to maintain consistency.
 *
 * For example, given these tokens:
 * ```typescript
 * const USDT = Token.makeToken("USDT", "0x..a5", 6)
 * const WETH = Token.makeToken("WETH", "0x..b2", 18)
 * const DAI = Token.makeToken("DAI", "0x..c1", 18)
 * ```
 *
 * The following pairs will be ordered as:
 * - (USDT, WETH) -> token0: USDT, token1: WETH (0x..a5 < 0x..b2)
 * - (WETH, USDT) -> token0: USDT, token1: WETH (0x..a5 < 0x..b2)
 * - (DAI, WETH) -> token0: WETH, token1: DAI (0x..b2 < 0x..c1)
 *
 * This ordering is crucial for consistent pool addressing and price representation
 * across the DeFi ecosystem.
 *
 * @template T - The token type (ERC20, Wrapped, or Native)
 */
export interface TokenPrice<T extends Token.TokenType> extends Assertable.Assertable {
  /** Returns the first token based on address ordering */
  readonly token0: Token.Token<T>;

  /** Returns the second token based on address ordering */
  readonly token1: Token.Token<T>;

  /**
   * Underlying representation of the price
   *
   * This can be either:
   * - A standard price value (`PriceValueUnits`), representing a direct exchange rate
   * - A square root price value (`PriceValueSqrtUnits`), as used in Uniswap V3 pools
   *
   * The appropriate functions in this module will handle both representations correctly.
   */
  readonly underlying: PriceValue;

  /** The base currency of the price, alias for [[token0]] */
  get baseCurrency(): Token.Token<T>;

  /** The quote currency of the price, alias for [[token1]] */
  get quoteCurrency(): Token.Token<T>;

  /** Returns tokens ordered by address for consistent pool addressing */
  get tokens(): [Token.Token<T>, Token.Token<T>];
}

/**
 * Represents a price ratio between two ERC20-like tokens (either ERC20 or Wrapped tokens).
 * This type is commonly used for DEX operations and liquidity pools where native tokens
 * cannot be directly used without wrapping.
 */
export type Erc20LikeTokenPrice = TokenPrice<Token.TokenType.ERC20 | Token.TokenType.Wrapped>;

/**
 * Represents a price ratio between any two tokens, regardless of their type (ERC20, Wrapped, or Native).
 * This is the most general form of TokenPrice that can handle any combination of token types.
 */
export type AnyTokenPrice = TokenPrice<Token.TokenType>;

/**
 * Creates a new token price instance interpreting the provided value as ratio
 *
 * @example
 *   import { Option } from "effect";
 *   import { Token } from "./com/liquidity_lab/crypto/blockchain";
 *   import { BigMath } from "./com/liquidity_lab/crypto/blockchain";
 *
 *   const BTC: Token.AnyToken = ???;
 *   const USDT: Token.AnyToken = ???;
 *
 *   // "70000.00015 USDT" -> "1 BTC"
 *   Option.map(
 *     BigMath.ratio(70000n, 10000015n).option,
 *     ratio => TokenPriceRatio(BTC, USDT, ratio)
 *   )
 *
 * @constructor
 */
export const makeTokenPriceFromRatio: {
  <TBase extends Token.TokenType, TQuote extends Token.TokenType>(
    baseCurrency: Token.Token<TBase>,
    quoteCurrency: Token.Token<TQuote>,
    ratio: BigMath.Ratio,
  ): Either.Either<TokenPrice<TBase | TQuote>, string>;
} = internal.makeTokenPriceFromRatioImpl;

/**
 * Creates a new token price instance interpreting the provided value as sqrt of price,
 * encoded in Q96.64 number format. This format is primarily used by Uniswap V3 pools
 * and is obtained from pool.slot0() calls.
 *
 * @example
 * ```typescript
 * import { Token, TokenPriceSqrt } from "@effect/crypto"
 * import { Pool } from "@liquidity-lab/effect-crypto-uniswap"
 * import { Effect } from "effect"
 *
 * const fetchPoolPrice = Effect.gen(function* (_) {
 *   const USDT = Token.makeTestToken("USDT", 6)
 *   const BTC = Token.makeTestToken("BTC", 8)
 *
 *   const pool = yield* Pool.fetchState(BTC, USDT, Pool.FeeAmount.MEDIUM)
 *   const slot0 = yield* Pool.slot0(pool)
 *
 *   return slot0.sqrtPrice;
 * })
 * ```
 */
export const TokenPriceSqrt: {
  <TBase extends Token.TokenType, TQuote extends Token.TokenType>(
    baseCurrency: Token.Token<TBase>,
    quoteCurrency: Token.Token<TQuote>,
    sqrtValue: BigMath.Ratio,
  ): Either.Either<TokenPrice<TBase | TQuote>, string>;
} = internal.makeTokenPriceFromSqrt;

/**
 * Creates a new token price instance interpreting the provided value as units
 * @example
 * ```typescript
 * import { Token, makeFromUnits, BigMath } from "@effect/crypto"
 * import { Option } from "effect"
 *
 * const USDT = Token.makeTestToken("USDT", 6)
 * const BTC = Token.makeTestToken("BTC", 8)
 *
 * const price = makeFromUnits(
 *   BTC,
 *   USDT,
 *   Big("70000.00015")
 * )
 * ```
 */
export const makeFromUnits: {
  <TBase extends Token.TokenType, TQuote extends Token.TokenType>(
    baseCurrency: Token.Token<TBase>,
    quoteCurrency: Token.Token<TQuote>,
    valueInQuoteCurrency: BigDecimal,
  ): Option.Option<TokenPrice<TBase | TQuote>>;
} = internal.makeTokenPriceFromUnits;

/**
 * Gets the price as a decimal string in quote currency units per base currency unit.
 *
 * @example
 * ```typescript
 * import { Token, makeFromUnits, asUnits, BigMath } from "@effect/crypto"
 * import { Option } from "effect"
 *
 * const BTC = Token.makeTestToken("BTC", 8)
 * const USDT = Token.makeTestToken("USDT", 6)
 *
 * const btcPrice = Option.getOrThrow(makeFromUnits(
 *   BTC,
 *   USDT,
 *   BigMath.Ratio(Big("50000.00"))
 * ))
 * const priceStr = asUnits(btcPrice) // 50000.00
 * ```
 */
export const asUnits: {
  <T extends Token.TokenType>(price: TokenPrice<T>): BigDecimal;
} = internal.asUnitsImpl;

/**
 * Gets the inverse price as a decimal string in base currency units per quote currency unit.
 *
 * @example
 * ```typescript
 * import { Token, makeFromUnits, asFlippedUnits, BigMath } from "@effect/crypto"
 * import { Option } from "effect"
 *
 * const BTC = Token.makeTestToken("BTC", 8)
 * const USDT = Token.makeTestToken("USDT", 6)
 *
 * const btcPrice = Option.getOrThrow(makeFromUnits(
 *   BTC,
 *   USDT,
 *   BigMath.Ratio.fromString("50000.00")
 * ))
 * const flippedStr = asFlippedUnits(btcPrice) // "0.00002"
 * ```
 */
export const asFlippedUnits: {
  <T extends Token.TokenType>(price: TokenPrice<T>): BigDecimal;
} = internal.asFlippedUnitsImpl;

/**
 * Gets the price in Uniswap v3's sqrt(Q64.96) format.
 * This format is used by Uniswap V3 pools and represents the square root of the price ratio.
 *
 * @example
 * ```typescript
 * import { Token, Price, BigMath } from "@effect/crypto"
 * import { Option } from "effect"
 *
 * const BTC = Token.makeTestToken("BTC", 8)
 * const USDT = Token.makeTestToken("USDT", 6)
 *
 * const btcPrice = Option.getOrThrow(
 *   Price.makeFromUnits(
 *     BTC,
 *     USDT,
 *     BigMath.Ratio(Big("50000.00"))
 *   )
 * )
 * const sqrtPrice = Price.asSqrtX96(btcPrice)
 * ```
 */
export const asSqrt: {
  <T extends Token.TokenType>(price: TokenPrice<T>): BigMath.Ratio;
} = internal.asSqrtImpl;

/**
 * Projects an input amount of one token to the equivalent amount of the other token
 * based on the price ratio.
 *
 * @example
 * ```typescript
 * import { Token, makeFromUnits, TokenVolume, projectAmount, BigMath } from "@effect/crypto"
 * import { Option } from "effect"
 *
 * const BTC = Token.makeTestToken("BTC", 8)
 * const USDT = Token.makeTestToken("USDT", 6)
 *
 * const btcPrice = Option.getOrThrow(makeFromUnits(
 *   BTC,
 *   USDT,
 *   BigMath.Ratio.fromString("50000.00")
 * ))
 * const btcAmount = Option.getOrThrow(TokenVolume.fromUnits(BTC, "1.5"))
 * const usdtAmount = projectAmount(btcPrice, btcAmount)
 * if (Option.isSome(usdtAmount)) {
 *   // usdtAmount.value will be 75000.00 USDT
 * }
 * ```
 */
export const projectAmount: {
  <T extends Token.TokenType>(
    price: TokenPrice<T>,
    inputAmount: TokenVolume.TokenVolume<T>,
  ): Option.Option<TokenVolume.TokenVolume<T>>;
} = internal.projectAmountImpl;

/**
 * Returns true if the given token is either the base or quote currency.
 *
 * @example
 * ```typescript
 * import { Token, makeFromUnits, contains, BigMath } from "@effect/crypto"
 * import { Option } from "effect"
 *
 * const BTC = Token.makeTestToken("BTC", 8)
 * const USDT = Token.makeTestToken("USDT", 6)
 * const ETH = Token.makeTestToken("ETH", 18)
 *
 * const btcPrice = Option.getOrThrow(makeFromUnits(
 *   BTC,
 *   USDT,
 *   BigMath.Ratio.fromString("50000.00")
 * ))
 * const hasBTC = contains(btcPrice, BTC) // true
 * const hasETH = contains(btcPrice, ETH) // false
 * ```
 */
export const contains: {
  <T extends Token.TokenType>(price: TokenPrice<T>, token: Token.Token<Token.TokenType>): boolean;
} = internal.containsImpl;

/**
 * Gets a human-readable string representation of the price.
 *
 * @example
 * ```typescript
 * import { Token, makeFromUnits, prettyPrint, BigMath } from "@effect/crypto"
 * import { Option } from "effect"
 *
 * const BTC = Token.makeTestToken("BTC", 8)
 * const USDT = Token.makeTestToken("USDT", 6)
 *
 * const btcPrice = Option.getOrThrow(makeFromUnits(
 *   BTC,
 *   USDT,
 *   BigMath.Ratio.fromString("50000.00")
 * ))
 * const display = prettyPrint(btcPrice) // "1 BTC = 50000.00 USDT"
 * ```
 */
export const prettyPrint: {
  <T extends Token.TokenType>(price: TokenPrice<T>): string;
} = internal.prettyPrintImpl;

/**
 * Generates token price for the given pair of tokens
 */
export const tokenPriceGen: {
  <T0 extends Token.TokenType, T1 extends Token.TokenType>(
    token0: Token.Token<T0>,
    token1: Token.Token<T1>,
    constraints?: {
      min?: BigMath.Ratio;
      max?: BigMath.Ratio;
      maxScale?: number;
    },
  ): Arbitrary<TokenPrice<T0 | T1>>;
} = internal.tokenPriceGenImpl;

