import { Big, BigDecimal, RoundingMode } from "bigdecimal.js";
import { Option } from "effect";
import { Arbitrary } from "fast-check";

import * as Assertable from "./assertable.js";
import * as BigMath from "./bigMath.js";
import * as Token from "./token.js";
// it conflicts with the T as generic type parameter
// @see https://github.com/typescript-eslint/typescript-eslint/issues/10746
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as T from "./tokenVolume.js";

class TokenVolumeLive<T extends Token.TokenType> implements T.TokenVolume<T> {
  readonly token: Token.Token<T>;
  readonly underlyingValue: BigMath.NonNegativeDecimal;

  constructor(token: Token.Token<T>, value: BigMath.NonNegativeDecimal) {
    this.token = token;
    this.underlyingValue = value;
  }

  get [Assertable.instanceSymbol](): Assertable.AssertableEntity<this> {
    return Assertable.AssertableEntity({
      token: Assertable.asAssertableEntity(this.token),
      value: asUnitsImpl(this).unscaledValue(),
    });
  }

  toString(): string {
    return prettyPrintImpl(this);
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `TokenVolume(${prettyPrintImpl(this)})`;
  }
}

/** @internal */
export function makeTokenVolumeFromUnits<T extends Token.TokenType>(
  token: Token.Token<T>,
  units: BigMath.NonNegativeDecimal,
): T.TokenVolume<T> {
  return new TokenVolumeLive(token, units) as T.TokenVolume<T>;
}

/** @internal */
export function makeTokenVolumeFromRatio<T extends Token.TokenType>(
  token: Token.Token<T>,
  ratio: BigMath.Ratio,
): T.TokenVolume<T> {
  return new TokenVolumeLive(token, BigMath.NonNegativeDecimal(ratio));
}

/** @internal */
export function makeTokenVolumeFromUnscaled<T extends Token.TokenType>(
  token: Token.Token<T>,
  unscaled: bigint,
): Option.Option<T.TokenVolume<T>> {
  return Option.map(
    BigMath.NonNegativeDecimal.option(Big(unscaled, token.decimals)),
    (value) => new TokenVolumeLive(token, value),
  );
}

/** @internal */
export function makeTokenVolumeZero<T extends Token.TokenType>(
  token: Token.Token<T>,
): T.TokenVolume<T> {
  return new TokenVolumeLive(token, BigMath.NonNegativeDecimal(Big(0)));
}

/** @internal */
export function asUnitsImpl<T extends Token.TokenType>(volume: T.TokenVolume<T>): BigDecimal {
  return volume.underlyingValue.setScale(volume.token.decimals, RoundingMode.FLOOR);
}

/** @internal */
export function asUnscaledImpl<T extends Token.TokenType>(volume: T.TokenVolume<T>): bigint {
  return volume.underlyingValue.setScale(volume.token.decimals, RoundingMode.FLOOR).unscaledValue();
}

/** @internal */
export function prettyPrintImpl<T extends Token.TokenType>(volume: T.TokenVolume<T>): string {
  return `${asUnitsImpl(volume)} ${volume.token.symbol?.length > 0 ? volume.token.symbol : "UnknownToken"}`;
}

/** @internal */
export function tokenVolumeGenImpl<T extends Token.TokenType>(
  token: Token.Token<T>,
  constraints?: {
    min?: BigMath.NonNegativeDecimal;
    max?: BigMath.NonNegativeDecimal;
    maxScale?: number;
  },
): Arbitrary<T.TokenVolume<T>> {
  return BigMath.nonNegativeDecimalGen(constraints).map((value) =>
    makeTokenVolumeFromUnits(token, value),
  );
}
