import * as fc from "fast-check";
import { Big, BigDecimal, MathContext, RoundingMode } from "bigdecimal.js";
import { Either, Option, Order } from "effect";
import { Arbitrary } from "fast-check";

import { Assertable, BigMath, Token, TokenVolume } from "@liquidity_lab/effect-crypto";
import { BrandUtils } from "@liquidity_lab/effect-crypto/utils";

import type * as T from "./price.js";

/**
 * The sqrt ratio corresponding to the minimum tick that could be used on any pool.
 */
const MIN_SQRT_RATIO: BigDecimal = BigMath.q64x96ToBigDecimal(BigMath.Q64x96(4295128739n));

/**
 * The sqrt ratio corresponding to the maximum tick that could be used on any pool.
 */
const MAX_SQRT_RATIO: BigDecimal = BigMath.q64x96ToBigDecimal(
  BigMath.Q64x96(1461446703485210103287273052203988822378723970342n),
);

const mathContext = new MathContext(192, RoundingMode.HALF_UP);

class PriceValueUnitsLive implements T.PriceValueUnits {
  readonly _tag = "@liquidity_lab/effect-crypto/price#PriceValueUnits";

  private constructor(readonly value: BigMath.Ratio) {}

  get flip(): this {
    return new PriceValueUnitsLive(
      BigMath.Ratio(Big(1).divideWithMathContext(this.value, mathContext)),
    ) as this;
  }

  static make(value: BigMath.Ratio, token1: Token.AnyToken) {
    if (value.setScale(token1.decimals, RoundingMode.FLOOR).compareTo(0) <= 0) {
      return Either.left(
        `Cannot create price from units, it's value is too small [${value.toPlainString()}] ` +
          `according to token1.decimals[${token1.decimals}]`,
      );
    }

    return Either.right(new PriceValueUnitsLive(value));
  }

  toString(): string {
    return this.value.toPlainString();
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `PriceValueUnits(${this.value.toPlainString()})`;
  }
}

class PriceValueSqrtUnitsLive implements T.PriceValueSqrtUnits {
  readonly _tag = "@liquidity_lab/effect-crypto/price#PriceValueSqrtUnits";

  private constructor(readonly value: BigMath.Ratio) {}

  get flip(): this {
    return new PriceValueSqrtUnitsLive(
      BigMath.Ratio(Big(1).divideWithMathContext(this.value, mathContext)),
    ) as this;
  }

  static make(sqrtValue: BigMath.Ratio): Either.Either<T.PriceValueSqrtUnits, string> {
    if (sqrtValue.greaterThanOrEquals(MIN_SQRT_RATIO) && sqrtValue.lowerThan(MAX_SQRT_RATIO)) {
      return Either.right(new PriceValueSqrtUnitsLive(sqrtValue));
    }

    return Either.left(
      `Cannot create price from sqrt value: the given value[${sqrtValue.toPlainString()}] should be in range ` +
        `[${MIN_SQRT_RATIO.toPlainString()}, ${MAX_SQRT_RATIO.toPlainString()}]`,
    );
  }

  toString(): string {
    return this.value.toPlainString();
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `PriceValueSqrtUnits(${this.value.toPlainString()})`;
  }
}

class TokenPriceLive<T extends Token.TokenType> implements T.TokenPrice<T> {
  private constructor(
    public readonly token0: Token.Token<T>,
    public readonly token1: Token.Token<T>,
    public readonly underlying: T.PriceValue,
  ) {}

  get baseCurrency(): Token.Token<T> {
    return this.token0;
  }

  get quoteCurrency(): Token.Token<T> {
    return this.token1;
  }

  get tokens(): [Token.Token<T>, Token.Token<T>] {
    return [this.token0, this.token1];
  }

  get [Assertable.instanceSymbol](): Assertable.AssertableEntity<this> {
    return Assertable.AssertableEntity({
      baseCurrency: Assertable.asAssertableEntity(this.baseCurrency),
      quoteCurrency: Assertable.asAssertableEntity(this.quoteCurrency),
      units: asUnitsImpl(this).toPlainString(),
    });
  }

  static make<TBase extends Token.TokenType, TQuote extends Token.TokenType>(
    token0: Token.Token<TBase>,
    token1: Token.Token<TQuote>,
    underlying: T.PriceValue,
  ): Either.Either<T.TokenPrice<TBase | TQuote>, string> {
    if (token0.address === token1.address) {
      return Either.left("Cannot create price: token0 and token1 address are the same");
    }

    const isInverted = !Order.lessThanOrEqualTo(Token.order)(token0, token1);

    switch (isInverted) {
      case true:
        return Either.right(
          new TokenPriceLive<TBase | TQuote>(token1, token0, underlying.flip) as T.TokenPrice<
            TBase | TQuote
          >,
        );
      case false:
        return Either.right(
          new TokenPriceLive<TBase | TQuote>(token0, token1, underlying) as T.TokenPrice<
            TBase | TQuote
          >,
        );
    }
  }

  // Custom JSON serialization
  toJSON() {
    return {
      token0: this.token0.address,
      token1: this.token1.address,
      value: asUnitsImpl(this).toPlainString(),
    };
  }

  toString(): string {
    return this.underlying.toString();
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return prettyPrintImpl<T>(this);
  }
}

/** @internal */
export function makeTokenPriceFromRatioImpl<
  TBase extends Token.TokenType,
  TQuote extends Token.TokenType,
>(
  baseCurrency: Token.Token<TBase>,
  quoteCurrency: Token.Token<TQuote>,
  ratio: BigMath.Ratio,
): Either.Either<T.TokenPrice<TBase | TQuote>, string> {
  return Either.flatMap(PriceValueUnitsLive.make(ratio, quoteCurrency), (ratio) =>
    TokenPriceLive.make(baseCurrency, quoteCurrency, ratio),
  );
}

/** @internal */
export function makeTokenPriceFromSqrt<
  TBase extends Token.TokenType,
  TQuote extends Token.TokenType,
>(
  baseCurrency: Token.Token<TBase>,
  quoteCurrency: Token.Token<TQuote>,
  sqrtValue: BigMath.Ratio,
): Either.Either<T.TokenPrice<TBase | TQuote>, string> {
  return Either.flatMap(PriceValueSqrtUnitsLive.make(sqrtValue), (sqrtValue) =>
    TokenPriceLive.make(baseCurrency, quoteCurrency, sqrtValue),
  );
}

/** @internal */
export function makeTokenPriceFromUnits<
  TBase extends Token.TokenType,
  TQuote extends Token.TokenType,
>(
  baseCurrency: Token.Token<TBase>,
  quoteCurrency: Token.Token<TQuote>,
  valueInQuoteCurrency: BigDecimal,
): Option.Option<T.TokenPrice<TBase | TQuote>> {
  return Option.flatMap(
    BigMath.Ratio.option(Big(valueInQuoteCurrency, undefined, mathContext)),
    (ratio) => Either.getRight(makeTokenPriceFromRatioImpl(baseCurrency, quoteCurrency, ratio)),
  );
}

/** @internal */
export function makeTokenPriceFromSqrtQ64_96Impl<
  TBase extends Token.TokenType,
  TQuote extends Token.TokenType,
>(
  baseCurrency: Token.Token<TBase>,
  quoteCurrency: Token.Token<TQuote>,
  value: BigMath.Q64x96,
): Either.Either<T.TokenPrice<TBase | TQuote>, string> {
  return BigMath.Ratio.either(BigMath.q64x96ToBigDecimal(value)).pipe(
    Either.mapLeft(BrandUtils.stringifyBrandErrors),
    Either.flatMap((value) => makeTokenPriceFromSqrt(baseCurrency, quoteCurrency, value)),
  );
}

/** @internal */
export function asRatioImpl<T extends Token.TokenType>(price: T.TokenPrice<T>): BigMath.Ratio {
  // Should be safe, as underlying is a ratio
  return BigMath.Ratio(toPriceRatio(price.underlying));
}

/** @internal */
export function asUnitsImpl<T extends Token.TokenType>(price: T.TokenPrice<T>): BigDecimal {
  return toPriceRatio(price.underlying).setScale(price.token1.decimals, RoundingMode.FLOOR);
}

/** @internal */
export function asFlippedUnitsImpl<T extends Token.TokenType>(price: T.TokenPrice<T>): BigDecimal {
  return toPriceRatio(price.underlying.flip).setScale(price.token0.decimals, RoundingMode.FLOOR);
}

/** @internal */
export function asSqrtImpl<T extends Token.TokenType>(price: T.TokenPrice<T>): BigMath.Ratio {
  switch (price.underlying._tag) {
    case "@liquidity_lab/effect-crypto/price#PriceValueUnits":
      return BigMath.Ratio(price.underlying.value.sqrt(mathContext));
    case "@liquidity_lab/effect-crypto/price#PriceValueSqrtUnits":
      return price.underlying.value;
  }
}

/** @internal */
export function asSqrtQ64_96Impl<T extends Token.TokenType>(
  price: T.TokenPrice<T>,
): Option.Option<BigMath.Q64x96> {
  return BigMath.convertToQ64x96(asSqrtImpl(price));
}

/** @internal */
export function projectAmountImpl<T extends Token.TokenType>(
  price: T.TokenPrice<T>,
  inputAmount: TokenVolume.TokenVolume<T>,
): Option.Option<TokenVolume.TokenVolume<T>> {
  const ratio = toPriceRatio(price.underlying);

  switch (inputAmount.token.address) {
    case price.token0.address:
      return Option.map(
        BigMath.Ratio.option(ratio.multiply(TokenVolume.asUnits(inputAmount))),
        (output) => TokenVolume.tokenVolumeRatio(price.token1, output),
      );
    case price.token1.address:
      return Option.map(
        BigMath.Ratio.option(
          TokenVolume.asUnits(inputAmount).divideWithMathContext(ratio, mathContext),
        ),
        // BigMath.Ratio.option(ratio.divide(TokenVolume.asUnits(inputAmount))),
        (output) => TokenVolume.tokenVolumeRatio(price.token0, output),
      );
    default:
      return Option.none();
  }
}

/** @internal */
export function projectedTokenImpl<T extends Token.TokenType>(
  price: T.TokenPrice<T>,
  inputToken: Token.Token<T>,
): Option.Option<Token.Token<T>> {
  switch (inputToken.address) {
    case price.token0.address:
      return Option.some(price.token1);
    case price.token1.address:
      return Option.some(price.token0);
    default:
      return Option.none();
  }
}

/** @internal */
export function containsImpl<T extends Token.TokenType>(
  price: T.TokenPrice<T>,
  token: Token.Token<Token.TokenType>,
): boolean {
  return token.address == price.token0.address || token.address == price.token1.address;
}

/** @internal */
export function prettyPrintImpl<T extends Token.TokenType>(price: T.TokenPrice<T>): string {
  return `1 ${price.token0.symbol || "token0"} -> ${asUnitsImpl(price).toPlainString()} ${price.token1.symbol || "token1"}`;
}

/** @internal */
export const tokenPriceGenImpl: {
  <T0 extends Token.TokenType, T1 extends Token.TokenType>(
    token0: Token.Token<T0>,
    token1: Token.Token<T1>,
    constraints?: {
      min?: BigMath.Ratio;
      max?: BigMath.Ratio;
      maxScale?: number;
    },
  ): Arbitrary<T.TokenPrice<T0 | T1>>;
  <T extends Token.TokenType>(
    tokenType: T,
    constraints?: {
      min?: BigMath.Ratio;
      max?: BigMath.Ratio;
      maxScale?: number;
    },
  ): Arbitrary<T.TokenPrice<T>>;
} = function (
  ...args:
    | Parameters<typeof tokenPriceGenImplWithTokens>
    | Parameters<typeof tokenPriceGenImplWithoutTokens>
) {
  function isArgs1(args: any[]): args is Parameters<typeof tokenPriceGenImplWithTokens> {
    return (
      (args.length === 2 || args.length === 3) &&
      Token.isAnyToken(args[0]) &&
      Token.isAnyToken(args[1])
    );
  }

  if (isArgs1(args)) {
    return tokenPriceGenImplWithTokens(...args);
  }
  return tokenPriceGenImplWithoutTokens(...args);
};

/** @internal */
export function tokenPriceSqrtQ64x96Gen<T0 extends Token.TokenType, T1 extends Token.TokenType>(
  token0: Token.Token<T0>,
  token1: Token.Token<T1>,
  constraints?: {
    min?: BigMath.Ratio;
    max?: BigMath.Ratio;
  },
) {
  if (Token.order(token0, token1) > 0) {
    return tokenPriceSqrtQ64x96Gen(token1, token0, constraints);
  }

  // tokens are in correct order
  const prog = Either.gen(function* () {
    const minPossibleSqrtQ64x96 = yield* Either.fromOption(
      BigMath.convertToQ64x96(getMinimalRatio(token1).sqrt(mathContext).add(1)),
      () => "Cannot create minSqrtQ64x96",
    );
    const maxPossibleSqrtQ64x96 = yield* Either.fromOption(
      BigMath.convertToQ64x96(
        Big(1)
          .divideWithMathContext(getMinimalRatio(token1), mathContext)
          .setScale(token0.decimals, RoundingMode.FLOOR)
          .sqrt(mathContext)
          .subtract(1n),
      ),
      () => "Cannot create maxSqrtQ64x96",
    );

    const minSqrtQ64x96Constraint = BigMath.minBigInt(
      BigMath.maxBigInt(
        minPossibleSqrtQ64x96,
        constraints?.min?.sqrt(mathContext).unscaledValue() || minPossibleSqrtQ64x96,
      ),
      maxPossibleSqrtQ64x96,
    );
    const maxSqrtQ64x96Constraint = BigMath.maxBigInt(
      BigMath.minBigInt(
        maxPossibleSqrtQ64x96,
        constraints?.max?.sqrt(mathContext).unscaledValue() || maxPossibleSqrtQ64x96,
      ),
      minPossibleSqrtQ64x96,
    );

    return fc
      .bigInt({ min: minSqrtQ64x96Constraint, max: maxSqrtQ64x96Constraint })
      .map((rawSqrt64x96Value) => {
        return makeTokenPriceFromSqrtQ64_96Impl(token0, token1, BigMath.Q64x96(rawSqrt64x96Value));
      });
  });

  return Either.getOrThrowWith(
    prog,
    (cause) =>
      new Error(
        `Failed to create token price generator for token0[${token0}] token1[${token1}]: ${cause}`,
      ),
  );
}

/** @internal */
export function tokenPriceGenImplWithTokens<T0 extends Token.TokenType, T1 extends Token.TokenType>(
  token0: Token.Token<T0>,
  token1: Token.Token<T1>,
  constraints?: {
    min?: BigMath.Ratio;
    max?: BigMath.Ratio;
  },
) {
  return tokenPriceSqrtQ64x96Gen(token0, token1, constraints).map((priceOrError) => {
    return Either.getOrThrowWith(
      priceOrError,
      (cause) => new Error(`Failed to create TokenPrice from sqrtQ64x96: ${cause}`),
    );
    // return BigMath.Ratio.either(Big(sqrtQ64x96).scaleByPowerOfTen(-1 * token1.decimals)).pipe(
    //   Either.mapLeft(BrandUtils.stringifyBrandErrors),
    //   Either.flatMap((ratio) => makeTokenPriceFromRatioImpl(token0, token1, ratio)),
    //   Either.getOrThrowWith(
    //     (cause) => new Error(`Failed to create TokenPrice from ratio: ${cause}`),
    //   ),
    // );
  });
}

/** @internal */
export function tokenPriceGenImplWithoutTokens<T extends Token.TokenType>(
  tokenType: T,
  constraints?: {
    min?: BigMath.Ratio;
    max?: BigMath.Ratio;
  },
) {
  return Token.tokenPairGen(tokenType).chain(([token0, token1]) => {
    return tokenPriceGenImplWithTokens(token0, token1, constraints);
  });
}

/*
I need to adjust `priceWithVolumeGen`.

I'd like to produce values in safe range, so we wont face percision-related issues when converting from\to units or SDK implementation.

For a given `price` I'd like to generate a volume which: 
* will be >= min possible volume for token * 2
* will be < max possible volume * 0.9
* will be projected into a volume >= min possible volume for projected token * 2
* will be projected into a volume < max possible projected volume * 0.9
* token should be picked randomly from `price.tokens`

Maybe you can propose other limitaions. Main goal is to create safe price with volume gen.

  eslint-disable-next-line @typescript-eslint/no-unused-vars
*/
export function safePriceAndVolumeGen<T extends Token.TokenType>(
  tokenType: T,
): Arbitrary<{
  price: T.TokenPrice<T>;
  tokenVolume: TokenVolume.TokenVolume<T>;
}> {
  return (
    tokenPriceGenImpl(tokenType)
      // .chain((price) => fc.constantFrom(...price.tokens).map((token) => [price, token] as const))
      .map((price) => [price, price.token0] as const)
      .chain(([price, inputToken]) => {
        const outputToken = Option.getOrThrowWith(
          projectedTokenImpl(price, inputToken),
          () => new Error(`Failed to project token for price ${price.toString()}`),
        );

        const minDirectVolume = TokenVolume.asUnits(
          TokenVolume.minVolumeForToken(inputToken),
        ).multiply(2);
        const maxDirectVolume = TokenVolume.asUnits(
          TokenVolume.maxVolumeForToken(inputToken),
        ).multiply(0.9);

        const minInverseVolume = Option.getOrThrowWith(
          projectAmountImpl(price, TokenVolume.maxVolumeForToken(outputToken)),
          () => new Error(`Failed to project token for price ${price.toString()}`),
        );
        const maxInverseVolume = Option.getOrThrowWith(
          projectAmountImpl(price, TokenVolume.minVolumeForToken(outputToken)),
          () => new Error(`Failed to project token for price ${price.toString()}`),
        );

        // const allVolumes = [
        //   TokenVolume.asUnits(minDirectVolume).multiply(2),
        //   TokenVolume.asUnits(maxDirectVolume).multiply(0.9),
        //   TokenVolume.asUnits(minInverseVolume),
        //   TokenVolume.asUnits(maxInverseVolume),
        // ];

        const constraints = {
          min: BigMath.NonNegativeDecimal(
            minDirectVolume.max(TokenVolume.asUnits(minInverseVolume)),
          ),
          max: BigMath.NonNegativeDecimal(
            maxDirectVolume.min(TokenVolume.asUnits(maxInverseVolume)),
          ),
        };

        return TokenVolume.tokenVolumeGen(price.token0, constraints).map((tokenVolume) => {
          return {
            price,
            tokenVolume,
          };
        });
      })
  );
}

/**
 * Converts a price value to its ratio representation.
 * For regular units, returns the value directly.
 * For sqrt units, squares the value to get the actual ratio.
 */
function toPriceRatio(value: T.PriceValue): BigDecimal {
  switch (value._tag) {
    case "@liquidity_lab/effect-crypto/price#PriceValueUnits":
      return value.value;
    case "@liquidity_lab/effect-crypto/price#PriceValueSqrtUnits":
      return value.value.pow(2);
  }
}

function getMinimalRatio<T extends Token.TokenType>(token: Token.Token<T>): BigMath.Ratio {
  return BigMath.Ratio(Big(1).scaleByPowerOfTen(-1 * token.decimals));
}
