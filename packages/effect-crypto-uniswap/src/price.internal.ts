import { Big, BigDecimal, MathContext, RoundingMode } from "bigdecimal.js";
import { Either, Option, Order } from "effect";

import { Assertable, BigMath, Token, TokenVolume } from "@liquidity_lab/effect-crypto";
import { BrandUtils } from "@liquidity_lab/effect-crypto/utils";

import type * as T from "./price.js";

const mathContext = new MathContext(192, RoundingMode.HALF_UP);

class PriceValueUnitsLive implements T.PriceValueUnits {
  readonly _tag = "@liquidity_lab/effect-crypto/price#PriceValueUnits";

  constructor(readonly value: BigMath.Ratio) {}

  get flip(): this {
    return new PriceValueUnitsLive(
      BigMath.Ratio(Big(1).divideWithMathContext(this.value, mathContext)),
    ) as this;
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

  constructor(readonly value: BigMath.Ratio) {}

  get flip(): this {
    return new PriceValueSqrtUnitsLive(
      BigMath.Ratio(Big(1).divideWithMathContext(this.value, mathContext)),
    ) as this;
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
  return TokenPriceLive.make(baseCurrency, quoteCurrency, new PriceValueUnitsLive(ratio));
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
  return TokenPriceLive.make(baseCurrency, quoteCurrency, new PriceValueSqrtUnitsLive(sqrtValue));
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
    Either.flatMap((value) =>
      makeTokenPriceFromSqrt(baseCurrency, quoteCurrency, value),
    )
  );
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
        (output) => TokenVolume.TokenVolumeRatio(price.token1, output),
      );
    case price.token1.address:
      return Option.map(
        BigMath.Ratio.option(
          TokenVolume.asUnits(inputAmount).divideWithMathContext(ratio, mathContext),
        ),
        // BigMath.Ratio.option(ratio.divide(TokenVolume.asUnits(inputAmount))),
        (output) => TokenVolume.TokenVolumeRatio(price.token0, output),
      );
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
export function tokenPriceGenImpl<T0 extends Token.TokenType, T1 extends Token.TokenType>(
  token0: Token.Token<T0>,
  token1: Token.Token<T1>,
  constraints?: {
    min?: BigMath.Ratio;
    max?: BigMath.Ratio;
    maxScale?: number;
  },
) {
  return BigMath.ratioGen(constraints).map((ratio) => {
    return Either.getOrThrowWith(
      makeTokenPriceFromRatioImpl(token0, token1, ratio),
      (cause) => new Error(`Failed to create TokenPrice from ratio: ${cause}`),
    );
  });
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
