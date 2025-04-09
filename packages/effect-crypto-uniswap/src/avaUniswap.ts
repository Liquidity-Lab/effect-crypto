import type { ExecutionContext } from "ava";
import { BigDecimal } from "bigdecimal.js";
import { Layer } from "effect";

import { Token } from "@liquidity_lab/effect-crypto";
import { AvaEffect } from "@liquidity_lab/effect-crypto/utils";

import * as internal from "./avaUniswap.internal.js";
import * as Price from "./price.js";

export type PriceEqualsWithPrecisionAssertion = {
  <Actual extends Price.TokenPrice<T>, Expected extends Actual, T extends Token.TokenType>(
    actual: Actual,
    expected: Expected,
    message?: string,
  ): actual is Expected;

  <Actual extends Expected, Expected extends Price.TokenPrice<T>, T extends Token.TokenType>(
    actual: Actual,
    expected: Expected,
    message?: string,
  ): expected is Actual;

  <
    Actual extends Price.TokenPrice<T>,
    Expected extends Price.TokenPrice<T>,
    T extends Token.TokenType,
  >(
    actual: Actual,
    expected: Expected,
    message?: string,
  ): boolean;

  /** Skip this assertion. */
  skip(actual: unknown, expected: unknown, message?: string): void;
};

export const PriceEqualsWithPrecisionAssertion: {
  <T>(t: ExecutionContext<T>, precisionPercent: BigDecimal): PriceEqualsWithPrecisionAssertion;
  <T>(t: ExecutionContext<T>): PriceEqualsWithPrecisionAssertion;
} = internal.makePriceEqualsWithPrecisionAssertion;

export type Assertions = {
  priceEqualsWithPrecision(precisionPercent: BigDecimal): PriceEqualsWithPrecisionAssertion;
  priceEquals: PriceEqualsWithPrecisionAssertion;
};

export const Assertions: {
  <Services>(t: ExecutionContext<AvaEffect.TestEffectContext<Services>>): Assertions;
} = internal.makeAssertions;

export const makeTestEffect: {
  <Services, Extensions extends Record<string, unknown>>(
    deps: Layer.Layer<Services>,
    makeExtensions: (t: ExecutionContext<AvaEffect.TestEffectContext<Services>>) => Extensions,
  ): AvaEffect.EffectTestFn<Services, AvaEffect.EffectAssertions & Assertions & Extensions>;
} = internal.makeTestEffect;
