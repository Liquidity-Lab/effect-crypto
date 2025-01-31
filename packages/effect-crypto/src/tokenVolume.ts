import { BigDecimal } from "bigdecimal.js";
import { Option } from "effect";
import { Arbitrary } from "fast-check";

import * as Assertable from "./assertable.js";
import * as BigMath from "./bigMath.js";
import * as Token from "./token.js";
import * as internal from "./tokenVolume.internal.js";

/**
 * Represents a volume of a specific token type.
 * Volume is a non-negative value: [0, +inf)
 *
 * @template T - The type of the token.
 */
export interface TokenVolume<T extends Token.TokenType> extends Assertable.Assertable {
  readonly token: Token.Token<T>;

  /**
   * The underlying value of the token volume. This value is not aligned with the token's decimals.
   */
  readonly underlyingValue: BigMath.NonNegativeDecimal;
}

export type AnyTokenVolume = TokenVolume<Token.TokenType>;
export type Erc20LikeTokenVolume = TokenVolume<Token.TokenType.ERC20 | Token.TokenType.Wrapped>;
export type WrappedTokenVolume = TokenVolume<Token.TokenType.Wrapped>;
export type NativeTokenVolume = TokenVolume<Token.TokenType.Native>;

/**
 * Creates a new token volume instance interpreting the provided value as units
 *
 * @example
 *   import { Token } from "./com/liquidity_lab/crypto/blockchain";
 *
 *   const BTC: Token.AnyToken = ???;
 *   const volume: AnyTokenVolume = TokenVolumeUnits(BTC, "70000.015");
 *
 * @param token
 * @param units
 * @constructor
 */
export const TokenVolumeUnits: <T extends Token.TokenType>(
  token: Token.Token<T>,
  units: BigMath.NonNegativeDecimal,
) => TokenVolume<T> = internal.makeTokenVolumeFromUnits;

/**
 * Creates a new token volume instance interpreting the provided value as ratio
 *
 * @example
 *   import { BigMath, Token } from "./com/liquidity_lab/crypto/blockchain";
 *
 *   const USDT: Token.AnyToken = ???;
 *   const volume: AnyTokenVolume = TokenVolumeRatio(USDT, BigMath.ratio(70000n, 1n));
 */
export const TokenVolumeRatio: <T extends Token.TokenType>(
  token: Token.Token<T>,
  ratio: BigMath.Ratio,
) => TokenVolume<T> = internal.makeTokenVolumeFromRatio;

/**
 * Creates a new token volume instance interpreting the provided value as unscaled.
 * Please be aware that the value should be non-negative
 *
 * @example
 *   import { Token } from "./com/liquidity_lab/crypto/blockchain";
 *
 *   // Assume USDT has 6 decimals
 *   const USDT: Token.AnyToken = ???;
 *   const volume: AnyTokenVolume = TokenVolumeUnscaled(USDT, 70000n * 10n ** 6n); // 70000 USDT
 */
export const tokenVolumeFromUnscaled: {
  <T extends Token.TokenType>(
    token: Token.Token<T>,
    unscaled: bigint,
  ): Option.Option<TokenVolume<T>>;
} = internal.makeTokenVolumeFromUnscaled;

/**
 * Creates a new token volume instance with zero value
 *
 * @example
 *   import { Token } from "./com/liquidity_lab/crypto/blockchain";
 *
 *   const USDT: Token.AnyToken = ???;
 *   const volume: AnyTokenVolume = TokenVolumeZero(USDT); // 0 USDT
 *
 * @param token
 * @constructor
 */
export const TokenVolumeZero: <T extends Token.TokenType>(token: Token.Token<T>) => TokenVolume<T> =
  internal.makeTokenVolumeZero;

/**
 * Formats token amount as units string keeping [[token.decimals]] precision.
 *
 * @example
 *   import { Big } from 'bigdecimal.js';
 *   import { TokenVolume } from 'effect-crypto';
 *
 *   val BTC: Token = ???;
 *
 *   // 70000.015
 *   TokenVolume.asUnits(TokenVolume.fromUnits(BTC, Big("70000.015")))
 *
 */
export const asUnits: {
  <T extends Token.TokenType>(volume: TokenVolume<T>): BigDecimal;
} = internal.asUnitsImpl;

/**
 * Returns unscaled token amount keeping [[token.decimals]] precision.
 *
 * @example
 *   import { Big } from 'bigdecimal.js';
 *   import { TokenVolume } from 'effect-crypto';
 *
 *   val USDT: Token = ???; // 5 decimals
 *
 *   // 7_000_001_500n
 *   TokenVolume.asUnscaled(TokenVolume.fromUnits(USDT, Big("70000.015"))
 */
export const asUnscaled: {
  <T extends Token.TokenType>(volume: TokenVolume<T>): bigint;
} = internal.asUnscaledImpl;

/**
 * Formats token amount as units string keeping [[token.decimals]] precision.
 *
 * @example
 *   import { Big } from 'bigdecimal.js';
 *   import { BigMath, TokenVolume } from 'effect-crypto';
 *
 *   val BTC: Token = ???;
 *
 *   // "23.015 BTC"
 *   TokenVolume.prettyPrint(
 *     TokenVolume.fromUnits(BTC, BigMath.NonNegativeDecimal(Big("23.015")))
 *   )
 *
 */
export const prettyPrint: {
  <T extends Token.TokenType>(volume: TokenVolume<T>): string;
} = internal.prettyPrintImpl;

/**
 * Generates an arbitrary token volume
 */
export const tokenVolumeGen: {
  <T extends Token.TokenType>(
    token: Token.Token<T>,
    constraints?: {
      min?: BigMath.NonNegativeDecimal;
      max?: BigMath.NonNegativeDecimal;
      maxScale?: number;
    },
  ): Arbitrary<TokenVolume<T>>;
} = internal.tokenVolumeGenImpl;
