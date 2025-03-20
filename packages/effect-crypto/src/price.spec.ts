import test from "ava";
import { Big, MathContext, RoundingMode } from "bigdecimal.js";
import { Either, Option } from "effect";

import { testProp } from "@fast-check/ava";
import { CurrencyAmount, Price as SdkPrice, Token as SdkToken } from "@uniswap/sdk-core";

import * as Adt from "./adt.js";
import * as Assertable from "./assertable.js";
import * as BigMath from "./bigMath.js";
import * as Price from "./price.js";
import * as Token from "./token.js";
import * as TokenVolume from "./tokenVolume.js";
import * as AvaEffect from "./utils/avaEffect.js";

const errorTolerance = Big("0.00000000000001");
const mathContext = new MathContext(96, RoundingMode.HALF_UP);

const WETH = Token.Erc20Token(
  Adt.Address.unsafe("0x0000000000000000000000000000000000000001"),
  18,
  "WETH",
  "Wrapped Ether",
  Token.Erc20TokenMeta(),
);
const USDT = Token.Erc20Token(
  Adt.Address.unsafe("0x0000000000000000000000000000000000000002"),
  6,
  "USDT",
  "Tether USD",
  Token.Erc20TokenMeta(),
);

test("TokenPrice.project converts quote currency amounts correctly", (t) => {
  const price = BigMath.NonNegativeDecimal(Big("70000.015"));
  const quoteAmount = BigMath.NonNegativeDecimal(price.multiply("2.5"));

  const actual = Option.flatMap(Price.makeFromUnits(WETH, USDT, price), (price) =>
    Price.projectAmount(price, TokenVolume.TokenVolumeUnits(USDT, quoteAmount)),
  );
  const expected = BigMath.NonNegativeDecimal(Big("2.5"));

  AvaEffect.EffectAssertions(t).assertOptionalEqualVia(
    Option.map(actual, TokenVolume.asUnits),
    Option.some(expected),
    BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext),
  );
});

test("TokenPrice.project converts base currency amounts correctly", (t) => {
  const price = BigMath.NonNegativeDecimal(Big("70000.15"));
  const baseAmount = BigMath.NonNegativeDecimal(Big("2.5"));

  const actual = Option.flatMap(Price.makeFromUnits(WETH, USDT, price), (price) =>
    Price.projectAmount(price, TokenVolume.TokenVolumeUnits(WETH, baseAmount)),
  );
  const expected = BigMath.NonNegativeDecimal(price.multiply("2.5"));

  AvaEffect.EffectAssertions(t).assertOptionalEqualVia(
    Option.map(actual, TokenVolume.asUnits),
    Option.some(expected),
    BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext),
  );
});

test("Static test: TokenPrice.project should be the same with UniswapSdkPrice", (t) => {
  const priceStr = Big("70000");
  const price = Option.getOrThrowWith(
    Price.makeFromUnits(WETH, USDT, priceStr),
    () => new Error("Failed to create TokenPriceUnits"),
  );

  const sdkWETH = new SdkToken(1, WETH.address, WETH.decimals, WETH.symbol, WETH.name);
  const sdkUSDT = new SdkToken(1, USDT.address, USDT.decimals, USDT.symbol, USDT.name);
  const sdkPrice = new SdkPrice(sdkWETH, sdkUSDT, 1, 70000);

  const actual = Price.projectAmount(
    price,
    TokenVolume.TokenVolumeUnits(WETH, BigMath.NonNegativeDecimal(Big(0.855555))),
  );
  const expected = sdkPrice.quote(CurrencyAmount.fromFractionalAmount(sdkWETH, 855555, 1000000));

  t.deepEqual(
    Option.map(actual, (a) => Number(TokenVolume.asUnits(a))),
    Option.some(
      Number(expected.quotient.toString()) + Number(expected.remainder.toFixed(USDT.decimals)),
    ),
  );
});

testProp(
  "TokenPrice.project should be the same with UniswapSdkPrice",
  [BigMath.ratioGen(), BigMath.ratioGen()],
  (t, priceRatio, volumeRatio) => {
    const price = Either.getOrThrow(Price.makeTokenPriceFromRatio(WETH, USDT, priceRatio));

    const sdkWETH = new SdkToken(1, WETH.address, WETH.decimals, WETH.symbol, WETH.name);
    const sdkUSDT = new SdkToken(1, USDT.address, USDT.decimals, USDT.symbol, USDT.name);
    const [priceNominator, priceDenominator] = BigMath.asNumeratorAndDenominator(
      priceRatio.setScale(USDT.decimals),
    );
    const sdkPrice = new SdkPrice(
      sdkWETH,
      sdkUSDT,
      priceDenominator.toString(),
      priceNominator.toString(),
    );

    const [volumeNominator, volumeDenominator] = BigMath.asNumeratorAndDenominator(volumeRatio);

    const tokenVolume = TokenVolume.TokenVolumeRatio(WETH, volumeRatio);
    const actual = Price.projectAmount(price, tokenVolume);
    const expectedSdkValue = sdkPrice.quote(
      CurrencyAmount.fromFractionalAmount(
        sdkWETH,
        (volumeNominator * 10n ** BigInt(USDT.decimals)).toString(),
        volumeDenominator.toString(),
      ),
    );
    const expected = Option.some(BigMath.Ratio(Big(expectedSdkValue.toExact())));

    AvaEffect.EffectAssertions(t).assertOptionalEqualVia(
      Option.map(actual, (a) => a.underlyingValue),
      expected,
      BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext),
    );
  },
  { numRuns: 1024 },
);

testProp(
  "TokenPrice should normalize token order and preserve price value",
  [BigMath.ratioGen()],
  (t, ratio) => {
    const assertions = AvaEffect.EffectAssertions(t);
    const errorTolerance = Big("0.000001");

    // Create price with tokens in both orders
    const regularPrice = Either.getOrThrow(Price.makeTokenPriceFromRatio(WETH, USDT, ratio));

    // Create price with tokens in reverse order
    const WETH2 = Object.assign({}, WETH, {
      address: Adt.Address.unsafe("0x0000000000000000000000000000000000000002"),
    });
    const USDT2 = Object.assign({}, USDT, {
      address: Adt.Address.unsafe("0x0000000000000000000000000000000000000001"),
    });
    const invertedPrice = Either.getOrThrow(Price.makeTokenPriceFromRatio(WETH2, USDT2, ratio));

    const volumeRatio = BigMath.Ratio(Big(2.5));
    const expected = Price.projectAmount(
      regularPrice,
      TokenVolume.TokenVolumeRatio(WETH, volumeRatio),
    );
    const actual = Price.projectAmount(
      invertedPrice,
      TokenVolume.TokenVolumeRatio(WETH2, volumeRatio),
    );

    assertions.assertOptionalEqualVia(
      Option.map(actual, TokenVolume.asUnits),
      Option.map(expected, TokenVolume.asUnits),
      BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext),
      "Price projections should be equal",
    );
  },
  { numRuns: 1024 },
);

testProp(
  "TokenPrice should project the same amount for inverted and regular flows",
  [Token.tokenPairGen(Token.TokenType.ERC20), BigMath.ratioGen(), BigMath.ratioGen()],
  (t, [token0, token1], ratio, volumeRatio) => {
    const assertions = AvaEffect.EffectAssertions(t);
    // Because the minimal number of decimals for token is 6, we cannot test with much higher precision
    const errorTolerance = Big("0.0000001");

    // Create price with tokens in both orders
    const regularPrice = Either.getOrThrow(Price.makeTokenPriceFromRatio(token0, token1, ratio));
    const invertedPrice = Either.getOrThrow(
      Price.makeTokenPriceFromRatio(
        token1,
        token0,
        BigMath.Ratio(Big(1).divideWithMathContext(ratio, mathContext)),
      ),
    );

    const expected = Price.projectAmount(
      regularPrice,
      TokenVolume.TokenVolumeRatio(token0, volumeRatio),
    );
    const actual = Price.projectAmount(
      invertedPrice,
      TokenVolume.TokenVolumeRatio(token0, volumeRatio),
    );

    assertions.assertOptionalEqualVia(
      Option.map(actual, TokenVolume.asUnits),
      Option.map(expected, TokenVolume.asUnits),
      BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext),
      "Price projections should be equal",
    );
  },
  { numRuns: 2048 },
);

testProp(
  "TokenPrice with same value but different scale should be considered equal via Assertable",
  [Token.tokenPairGen(Token.TokenType.ERC20), BigMath.ratioGen()],
  (t, [token0, token1], ratio) => {
    // Create the first price instance
    const actualPrice = Either.getOrThrow(Price.makeTokenPriceFromRatio(token0, token1, ratio));

    // Create a second price with the same value but different scale
    // This adjusts the scale without changing the actual value
    const adjustedRatio = BigMath.Ratio(ratio.setScale(ratio.scale() + 3, RoundingMode.HALF_UP));
    const expectedPrice = Either.getOrThrow(
      Price.makeTokenPriceFromRatio(token0, token1, adjustedRatio),
    );

    // Get assertable entities
    const actual = Assertable.asAssertableEntity(actualPrice);
    const expected = Assertable.asAssertableEntity(expectedPrice);

    // Assert they are equal despite different string representations
    t.deepEqual(
      actual,
      expected,
      `Prices should be equal: ${actual.toString()} vs ${expected.toString()}`,
    );
  },
  { numRuns: 100 },
);
