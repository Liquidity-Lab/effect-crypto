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

/**
 * Converts an Amount0 back to a TokenVolume for a specified token.
 *
 * This function takes an Amount0 (unscaled bigint amount used in Uniswap v3 for token0)
 * and converts it back to a TokenVolume with proper decimal precision for the given token.
 * This is the reverse operation of `Amount0.fromTokenVolume()`.
 *
 * @example
 *   import { Token, TokenVolume, Adt } from "@liquidity_lab/effect-crypto";
 *   import { Amount0, amount0ToTokenVolume } from "@liquidity_lab/effect-crypto-uniswap";
 *   import { Option } from "effect";
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
 *   // Create an Amount0 representing 1000.123456 USDT (1000123456n unscaled)
 *   const amount0 = Amount0(1000123456n);
 *
 *   // Convert Amount0 back to TokenVolume
 *   const tokenVolumeResult = amount0ToTokenVolume(amount0, USDT);
 *
 *   if (Option.isSome(tokenVolumeResult)) {
 *     const tokenVolume = tokenVolumeResult.value;
 *     // TokenVolume.asUnits(tokenVolume) will be "1000.123456"
 *     // TokenVolume.asUnscaled(tokenVolume) will be 1000123456n
 *     console.log("Token volume:", TokenVolume.asUnits(tokenVolume).toString()); // "1000.123456"
 *   } else {
 *     console.error("Failed to convert Amount0 to TokenVolume");
 *   }
 *
 * @example
 *   // Round trip conversion example
 *   import { Either, Option } from "effect";
 *   import { TokenVolume, BigMath } from "@liquidity_lab/effect-crypto";
 *   import { Big } from "bigdecimal.js";
 *
 *   // Start with a TokenVolume
 *   const originalVolume = TokenVolume.tokenVolumeUnits(
 *     USDT,
 *     BigMath.NonNegativeDecimal(Big("500.25"))
 *   );
 *
 *   // Convert to Amount0, then back to TokenVolume
 *   const roundTripResult = Either.flatMap(
 *     Amount0.fromTokenVolume(originalVolume),
 *     (amount0) => Either.fromOption(
 *       amount0ToTokenVolume(amount0, USDT),
 *       () => ["Failed to convert back to TokenVolume"]
 *     )
 *   );
 *
 *   if (Either.isRight(roundTripResult)) {
 *     const roundTripVolume = roundTripResult.right;
 *     // roundTripVolume should equal originalVolume
 *     console.log("Round trip successful!");
 *   }
 *
 * @example
 *   // Working with minimal amounts
 *   const minAmount0 = Amount0(1n); // Smallest possible amount
 *   const minVolumeResult = amount0ToTokenVolume(minAmount0, USDT);
 *
 *   if (Option.isSome(minVolumeResult)) {
 *     const minVolume = minVolumeResult.value;
 *     // For USDT (6 decimals), this represents 0.000001 USDT
 *     console.log("Min volume units:", TokenVolume.asUnits(minVolume).toString()); // "0.000001"
 *   }
 *
 * @param amount0 - The Amount0 to convert
 * @param token0 - The token to create the TokenVolume for (must match the token type that was originally used to create the Amount0)
 * @returns Option.Option<TokenVolume<T>> - Some(TokenVolume) on success, None if the amount is invalid for the token
 */
export const amount0ToTokenVolume: {
  <T extends Token.TokenType>(
    amount0: Amount0,
    token0: Token.Token<T>,
  ): Option.Option<TokenVolume.TokenVolume<T>>;
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

/**
 * Converts an Amount1 back to a TokenVolume for a specified token.
 *
 * This function takes an Amount1 (unscaled bigint amount used in Uniswap v3 for token1)
 * and converts it back to a TokenVolume with proper decimal precision for the given token.
 * This is the reverse operation of `Amount1.fromTokenVolume()`.
 *
 * @example
 *   import { Token, TokenVolume, Adt } from "@liquidity_lab/effect-crypto";
 *   import { Amount1, amount1ToTokenVolume } from "@liquidity_lab/effect-crypto-uniswap";
 *   import { Option } from "effect";
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
 *   // Create an Amount1 representing 2.5 WETH (2500000000000000000n unscaled)
 *   const amount1 = Amount1(2500000000000000000n);
 *
 *   // Convert Amount1 back to TokenVolume
 *   const tokenVolumeResult = amount1ToTokenVolume(amount1, WETH);
 *
 *   if (Option.isSome(tokenVolumeResult)) {
 *     const tokenVolume = tokenVolumeResult.value;
 *     // TokenVolume.asUnits(tokenVolume) will be "2.5"
 *     // TokenVolume.asUnscaled(tokenVolume) will be 2500000000000000000n
 *     console.log("Token volume:", TokenVolume.asUnits(tokenVolume).toString()); // "2.5"
 *   } else {
 *     console.error("Failed to convert Amount1 to TokenVolume");
 *   }
 *
 * @example
 *   // Round trip conversion example
 *   import { Either, Option } from "effect";
 *   import { TokenVolume, BigMath } from "@liquidity_lab/effect-crypto";
 *   import { Big } from "bigdecimal.js";
 *
 *   // Start with a TokenVolume
 *   const originalVolume = TokenVolume.tokenVolumeUnits(
 *     WETH,
 *     BigMath.NonNegativeDecimal(Big("1.25"))
 *   );
 *
 *   // Convert to Amount1, then back to TokenVolume
 *   const roundTripResult = Either.flatMap(
 *     Amount1.fromTokenVolume(originalVolume),
 *     (amount1) => Either.fromOption(
 *       amount1ToTokenVolume(amount1, WETH),
 *       () => ["Failed to convert back to TokenVolume"]
 *     )
 *   );
 *
 *   if (Either.isRight(roundTripResult)) {
 *     const roundTripVolume = roundTripResult.right;
 *     // roundTripVolume should equal originalVolume
 *     console.log("Round trip successful!");
 *   }
 *
 * @example
 *   // Working with different token decimals
 *   import { Token } from "@liquidity_lab/effect-crypto";
 *
 *   // Create a token with 8 decimals (like Bitcoin)
 *   const BTC = Token.Erc20Token(
 *     Adt.Address.unsafe("0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"),
 *     8,
 *     "WBTC",
 *     "Wrapped Bitcoin",
 *     Token.Erc20TokenMeta()
 *   );
 *
 *   const amount1 = Amount1(100000000n); // 1 BTC in smallest units
 *   const btcVolumeResult = amount1ToTokenVolume(amount1, BTC);
 *
 *   if (Option.isSome(btcVolumeResult)) {
 *     const btcVolume = btcVolumeResult.value;
 *     // TokenVolume.asUnits(btcVolume) will be "1.0" (1 BTC)
 *     console.log("BTC volume:", TokenVolume.asUnits(btcVolume).toString()); // "1.0"
 *   }
 *
 * @example
 *   // Error handling with Option.getOrElse
 *   const amount1 = Amount1(1000000000000000000n); // 1 token with 18 decimals
 *
 *   const tokenVolume = Option.getOrElse(
 *     amount1ToTokenVolume(amount1, WETH),
 *     () => {
 *       throw new Error("Failed to convert Amount1 to TokenVolume");
 *     }
 *   );
 *
 *   console.log("Successfully converted:", TokenVolume.prettyPrint(tokenVolume));
 *
 * @param amount1 - The Amount1 to convert
 * @param token1 - The token to create the TokenVolume for (must match the token type that was originally used to create the Amount1)
 * @returns Option.Option<TokenVolume<T>> - Some(TokenVolume) on success, None if the amount is invalid for the token
 */
export const amount1ToTokenVolume: {
  <T extends Token.TokenType>(
    amount1: Amount1,
    token1: Token.Token<T>,
  ): Option.Option<TokenVolume.TokenVolume<T>>;
} = internal.amount1ToTokenVolumeImpl;

export const feeAmountGen: Arbitrary<internal.FeeAmount> = internal.feeAmountGen;
