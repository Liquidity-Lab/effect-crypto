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
 * In Ethereum and other EVM-compatible blockchains:
 * - Each account balance is stored as a uint256 (2^256 - 1 maximum)
 * - The practical limit considers:
 *   - Block rewards
 *   - Network constraints
 *   - Economic factors
 * - Currently the total ETH supply is around 120 million, far below the uint256 limit
 *
 * Comparison with other systems:
 * - Uniswap V3, ERC20, and ETH balances: All use uint256 (2^256 - 1 maximum)
 * - Uniswap V3 prices: Use Q64.96 fixed-point (2^160 - 1 maximum)
 *
 * This implementation correctly handles these constraints using the BigMath.MAX_UINT256 constant.
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
 *   import { Token, TokenVolume } from "effect-crypto";
 *
 *   const BTC: Token.AnyToken = ???;
 *   const volume: TokenVolume.AnyTokenVolume = TokenVolume.tokenVolumeUnits(BTC, "70000.015");
 *
 * @param token - The token for which to create a volume
 * @param units - The amount in token units (e.g., 1.5 BTC)
 */
export const tokenVolumeUnits: <T extends Token.TokenType>(
  token: Token.Token<T>,
  units: BigMath.NonNegativeDecimal,
) => TokenVolume<T> = internal.makeTokenVolumeFromUnits;

/**
 * Creates a new token volume instance interpreting the provided value as ratio
 *
 * @example
 *   import { BigMath, Token, TokenVolume } from "effect-crypto";
 *
 *   const USDT: Token.AnyToken = ???;
 *   const volume: TokenVolume.AnyTokenVolume = TokenVolume.tokenVolumeRatio(USDT, BigMath.Ratio(70000n, 1n));
 *
 * @param token - The token for which to create a volume
 * @param ratio - The amount as a ratio
 */
export const tokenVolumeRatio: <T extends Token.TokenType>(
  token: Token.Token<T>,
  ratio: BigMath.Ratio,
) => TokenVolume<T> = internal.makeTokenVolumeFromRatio;

/**
 * Creates a new token volume instance interpreting the provided value as unscaled.
 * Please be aware that the value should be non-negative
 *
 * @example
 *   import { Token, TokenVolume } from "effect-crypto";
 *   import { Option } from "effect";
 *
 *   // Assume USDT has 6 decimals
 *   const USDT: Token.AnyToken = ???;
 *   const volumeOpt: Option.Option<TokenVolume.AnyTokenVolume> =
 *     TokenVolume.tokenVolumeFromUnscaled(USDT, 70000n * 10n ** 6n); // 70000 USDT
 *
 * @param token - The token for which to create a volume
 * @param unscaled - The amount in the smallest units of the token (e.g., wei for ETH)
 * @returns Option.Option<TokenVolume<T>> - Some(TokenVolume) if the value is valid, None otherwise
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
 *   import { Token, TokenVolume } from "effect-crypto";
 *
 *   const USDT: Token.AnyToken = ???;
 *   const volume: TokenVolume.AnyTokenVolume = TokenVolume.tokenVolumeZero(USDT); // 0 USDT
 *
 * @param token - The token for which to create a zero volume
 */
export const tokenVolumeZero: <T extends Token.TokenType>(token: Token.Token<T>) => TokenVolume<T> =
  internal.makeTokenVolumeZero;

/**
 * Formats token amount as units string keeping token.decimals precision.
 *
 * @example
 *   import { Big } from 'bigdecimal.js';
 *   import { Token, TokenVolume } from 'effect-crypto';
 *   import { BigMath } from 'effect-crypto';
 *
 *   const BTC: Token.AnyToken = ???;
 *
 *   // 70000.015
 *   TokenVolume.asUnits(TokenVolume.tokenVolumeUnits(BTC, BigMath.NonNegativeDecimal(Big("70000.015"))))
 *
 * @param volume - The token volume to format
 * @returns BigDecimal - The token amount in units
 */
export const asUnits: {
  <T extends Token.TokenType>(volume: TokenVolume<T>): BigDecimal;
} = internal.asUnitsImpl;

/**
 * Returns unscaled token amount keeping token.decimals precision.
 *
 * @example
 *   import { Big } from 'bigdecimal.js';
 *   import { Token, TokenVolume } from 'effect-crypto';
 *   import { BigMath } from 'effect-crypto';
 *
 *   const USDT: Token.AnyToken = ???; // 6 decimals
 *
 *   // 70000015000n
 *   TokenVolume.asUnscaled(TokenVolume.tokenVolumeUnits(USDT, BigMath.NonNegativeDecimal(Big("70000.015"))))
 *
 * @param volume - The token volume to convert to unscaled value
 * @returns bigint - The token amount in the smallest units (e.g., wei for ETH)
 */
export const asUnscaled: {
  <T extends Token.TokenType>(volume: TokenVolume<T>): bigint;
} = internal.asUnscaledImpl;

/**
 * Formats token amount as a human-readable string with token symbol.
 *
 * @example
 *   import { Big } from 'bigdecimal.js';
 *   import { Token, TokenVolume } from 'effect-crypto';
 *   import { BigMath } from 'effect-crypto';
 *
 *   const BTC: Token.AnyToken = ???;
 *
 *   // "23.015 BTC"
 *   TokenVolume.prettyPrint(
 *     TokenVolume.tokenVolumeUnits(BTC, BigMath.NonNegativeDecimal(Big("23.015")))
 *   )
 *
 * @param volume - The token volume to format
 * @returns string - A human-readable string representation of the token volume with symbol
 */
export const prettyPrint: {
  <T extends Token.TokenType>(volume: TokenVolume<T>): string;
} = internal.prettyPrintImpl;

/**
 * Generates an arbitrary token volume for property-based testing
 *
 * @example
 *   import { Token, TokenVolume } from 'effect-crypto';
 *   import { BigMath } from 'effect-crypto';
 *   import { testProp } from '@fast-check/ava';
 *
 *   const USDT: Token.AnyToken = ???;
 *
 *   testProp(
 *     "TokenVolume generator respects constraints",
 *     [TokenVolume.tokenVolumeGen(USDT, {
 *       min: BigMath.NonNegativeDecimal(Big(100)),
 *       max: BigMath.NonNegativeDecimal(Big(200)),
 *     })],
 *     (t, volume) => {
 *       // Test with generated volume
 *     }
 *   );
 *
 * @param token - The token for which to generate volumes
 * @param constraints - Optional constraints for the generated volumes
 * @param constraints.min - Minimum value for generated volumes
 * @param constraints.max - Maximum value for generated volumes
 * @returns Arbitrary<TokenVolume<T>> - A fast-check arbitrary that generates token volumes
 */
export const tokenVolumeGen: {
  <T extends Token.TokenType>(
    token: Token.Token<T>,
    constraints?: {
      min?: BigMath.NonNegativeDecimal;
      max?: BigMath.NonNegativeDecimal;
    },
  ): Arbitrary<TokenVolume<T>>;
} = internal.tokenVolumeGenImpl;

/**
 * Returns the minimum possible positive token volume for a given token.
 * This corresponds to the smallest representable unit (e.g., 1 wei for ETH).
 *
 * @example
 *   import { Token, TokenVolume } from "effect-crypto";
 *
 *   // Assume USDT has 6 decimals
 *   const USDT: Token.AnyToken = ???;
 *   const minVolume = TokenVolume.minVolumeForToken(USDT);
 *   // TokenVolume.asUnits(minVolume) will be 0.000001
 *   // TokenVolume.asUnscaled(minVolume) will be 1n
 *
 * @param token - The token for which to get the minimum volume.
 * @returns TokenVolume<T> - The minimum token volume.
 */
export const minVolumeForToken: {
  <T extends Token.TokenType>(token: Token.Token<T>): TokenVolume<T>;
} = internal.makeMinVolumeForTokenImpl;

/**
 * Returns the maximum possible token volume for a given token.
 * This corresponds to the maximum uint256 value scaled according to the token's decimals.
 *
 * @example
 *   import { Token, TokenVolume } from "effect-crypto";
 *
 *   // Assume USDT has 6 decimals
 *   const USDT: Token.AnyToken = ???;
 *   const maxVolume = TokenVolume.maxVolumeForToken(USDT);
 *   // TokenVolume.asUnscaled(maxVolume) will be 2n**256n - 1n
 *   // TokenVolume.asUnits(maxVolume) will be (2n**256n - 1n) / (10n**6n)
 *
 * @param token - The token for which to get the maximum volume.
 * @returns TokenVolume<T> - The maximum token volume.
 */
export const maxVolumeForToken: {
  <T extends Token.TokenType>(token: Token.Token<T>): TokenVolume<T>;
} = internal.makeMaxVolumeForTokenImpl;
