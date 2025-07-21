import { Brand, Either, Option } from "effect";
import { Arbitrary } from "fast-check";

import { Token, TokenVolume } from "@liquidity_lab/effect-crypto";

import * as internal from "./adt.internal.js";

export { FeeAmount } from "./adt.internal.js";

/**
 * Amount0 is unscaled amount of token0
 */
export type Amount0 = Brand.Branded<bigint, internal.Amount0TypeId>;
export const Amount0: Brand.Brand.Constructor<Amount0> & {
  gen(constraints?: { min?: Amount0; max?: Amount0 }): Arbitrary<Amount0>;
  zero: Amount0;
  max: Amount0;
  /**
   * Converts a TokenVolume to Amount0 by extracting its unscaled value.
   *
   * This function takes a TokenVolume (which represents a token amount with decimal precision)
   * and converts it to Amount0 (the unscaled amount used in Uniswap v3 for token0).
   * The conversion extracts the raw unscaled bigint value from the TokenVolume and validates
   * it falls within the valid range for Amount0.
   *
   * @example
   *   import { Token, TokenVolume, Adt, BigMath } from "@liquidity_lab/effect-crypto";
   *   import { Amount0 } from "@liquidity_lab/effect-crypto-uniswap";
   *   import { Big } from "bigdecimal.js";
   *   import { Either } from "effect";
   *
   *   // Create a USDT token with 6 decimals
   *   const USDT = Token.Erc20Token(
   *     Adt.Address.unsafe("0xa0b86a33e6441b9c30dd6c5c4b8c94e4b5c4b2b8"),
   *     6,
   *     "USDT",
   *     "Tether USD",
   *     Token.Erc20TokenMeta()
   *   );
   *
   *   // Create a token volume of 1000.123456 USDT
   *   const volume = TokenVolume.tokenVolumeUnits(
   *     USDT,
   *     BigMath.NonNegativeDecimal(Big("1000.123456"))
   *   );
   *
   *   // Convert to Amount0 - returns Either
   *   const amount0Result = Amount0.fromTokenVolume(volume);
   *
   *   if (Either.isRight(amount0Result)) {
   *     const amount0 = amount0Result.right;
   *     // amount0 represents 1000123456n (unscaled)
   *     console.log("Amount0 created successfully:", amount0);
   *   } else {
   *     console.error("Failed to create Amount0:", amount0Result.left);
   *   }
   *
   * @example
   *   // Working with minimal amounts
   *   import { TokenVolume } from "@liquidity_lab/effect-crypto";
   *   import { Either } from "effect";
   *
   *   // Get the minimum possible volume for a token (1 smallest unit)
   *   const minVolume = TokenVolume.minVolumeForToken(USDT);
   *   const minAmount0 = Either.getOrThrow(Amount0.fromTokenVolume(minVolume));
   *   // minAmount0 represents 1n (smallest unit)
   *
   * @param volume - The TokenVolume to convert
   * @returns Either.Either<Amount0, Brand.Brand.BrandErrors> - Right(Amount0) on success, Left(errors) on validation failure
   */
  fromTokenVolume: {
    (
      volume: TokenVolume.TokenVolume<Token.TokenType>,
    ): Either.Either<Amount0, Brand.Brand.BrandErrors>;
  };
} = Object.assign(internal.makeAmount0, {
  gen: internal.amount0Gen,
  zero: internal.makeAmount0(0n),
  max: internal.MAX_AMOUNT_0,
  fromTokenVolume: internal.amount0FromTokenVolumeImpl,
});

export const amount0ToTokenVolume: {
  <T extends Token.TokenType>(amount0: Amount0, token0: Token.Token<T>): Option.Option<TokenVolume.TokenVolume<T>>;
} = internal.amount0ToTokenVolumeImpl;

/**
 * Amount1 is unscaled amount of token1
 */
export type Amount1 = Brand.Branded<bigint, internal.Amount1TypeId>;
export const Amount1: Brand.Brand.Constructor<Amount1> & {
  gen(constraints?: { min?: Amount1; max?: Amount1 }): Arbitrary<Amount1>;
  zero: Amount1;
  max: Amount1;
  /**
   * Converts a TokenVolume to Amount1 by extracting its unscaled value.
   *
   * This function takes a TokenVolume (which represents a token amount with decimal precision)
   * and converts it to Amount1 (the unscaled amount used in Uniswap v3 for token1).
   * The conversion extracts the raw unscaled bigint value from the TokenVolume and validates
   * it falls within the valid range for Amount1.
   *
   * @example
   *   import { Token, TokenVolume, Adt, BigMath } from "@liquidity_lab/effect-crypto";
   *   import { Amount1 } from "@liquidity_lab/effect-crypto-uniswap";
   *   import { Big } from "bigdecimal.js";
   *   import { Either } from "effect";
   *
   *   // Create a WETH token with 18 decimals
   *   const WETH = Token.Erc20Token(
   *     Adt.Address.unsafe("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
   *     18,
   *     "WETH",
   *     "Wrapped Ether",
   *     Token.Erc20TokenMeta()
   *   );
   *
   *   // Create a token volume of 2.5 WETH
   *   const volume = TokenVolume.tokenVolumeUnits(
   *     WETH,
   *     BigMath.NonNegativeDecimal(Big("2.5"))
   *   );
   *
   *   // Convert to Amount1 - returns Either
   *   const amount1Result = Amount1.fromTokenVolume(volume);
   *
   *   if (Either.isRight(amount1Result)) {
   *     const amount1 = amount1Result.right;
   *     // amount1 represents 2500000000000000000n (2.5 * 10^18)
   *     console.log("Amount1 created successfully:", amount1);
   *   } else {
   *     console.error("Failed to create Amount1:", amount1Result.left);
   *   }
   *
   * @example
   *   // Using Either.getOrElse for error handling
   *   import { TokenVolume } from "@liquidity_lab/effect-crypto";
   *   import { Either } from "effect";
   *
   *   // Get the minimum possible volume for a token (1 smallest unit)
   *   const minVolume = TokenVolume.minVolumeForToken(WETH);
   *   const minAmount1 = Either.getOrElse(
   *     Amount1.fromTokenVolume(minVolume),
   *     (errors) => {
   *       throw new Error(`Failed to create Amount1: ${JSON.stringify(errors)}`);
   *     }
   *   );
   *   // minAmount1 represents 1n (smallest unit)
   *
   * @example
   *   // Chaining with Effect for functional error handling
   *   import { Effect, pipe } from "effect";
   *
   *   const program = pipe(
   *     Amount1.fromTokenVolume(volume),
   *     Either.mapLeft((errors) => new Error(`Invalid amount: ${JSON.stringify(errors)}`)),
   *     Effect.fromEither,
   *     Effect.map((amount1) => {
   *       // Use amount1 in your application logic
   *       return `Converted to Amount1: ${amount1}`;
   *     })
   *   );
   *
   * @param volume - The TokenVolume to convert
   * @returns Either.Either<Amount1, Brand.Brand.BrandErrors> - Right(Amount1) on success, Left(errors) on validation failure
   */
  fromTokenVolume: {
    (
      volume: TokenVolume.TokenVolume<Token.TokenType>,
    ): Either.Either<Amount1, Brand.Brand.BrandErrors>;
  };
} = Object.assign(internal.makeAmount1, {
  gen: internal.amount1Gen,
  zero: internal.makeAmount1(0n),
  max: internal.MAX_AMOUNT_1,
  fromTokenVolume: internal.amount1FromTokenVolumeImpl,
});

export const feeAmountGen: Arbitrary<internal.FeeAmount> = internal.feeAmountGen;
