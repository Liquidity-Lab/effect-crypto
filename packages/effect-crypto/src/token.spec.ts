import test from "ava";
import { Big, MathContext, RoundingMode } from "bigdecimal.js";
import { Option } from "effect";

import { testProp } from "@fast-check/ava";
import { CurrencyAmount, Price as SdkPrice, Token as SdkToken } from "@uniswap/sdk-core";

import * as Adt from "./adt.js";
import * as BigMath from "./bigMath.js";
import * as Token from "./token.js";
import * as TokenVolume from "./tokenVolume.js";
import * as AvaEffect from "./utils/avaEffect.js";
import { NonNegativeDecimal } from "./bigMath.js";

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

test("TokenPrice.project for quote currency", (t) => {
  const underlyingPrice = BigMath.NonNegativeDecimal(Big("70000.015"));

  const actual = Option.flatMap(
    Token.TokenPriceUnits(WETH, USDT, underlyingPrice.toString()),
    (price) => price.projectAmount(TokenVolume.TokenVolumeUnits(USDT, underlyingPrice)),
  );

  t.deepEqual(
    Option.map(actual, TokenVolume.asUnscaled),
    Option.some(
      TokenVolume.asUnscaled(TokenVolume.TokenVolumeUnits(WETH, NonNegativeDecimal(Big(1)))),
    ),
  );
});

test("TokenPrice.project for base currency", (t) => {
  const underlyingPrice = BigMath.NonNegativeDecimal(Big("70000.15"));

  const actual = Option.flatMap(
    Token.TokenPriceUnits(WETH, USDT, underlyingPrice.toString()),
    (price) => price.projectAmount(TokenVolume.TokenVolumeUnits(WETH, NonNegativeDecimal(Big(1)))),
  );

  t.deepEqual(
    Option.map(actual, TokenVolume.asUnscaled),
    Option.some(TokenVolume.asUnscaled(TokenVolume.TokenVolumeUnits(USDT, underlyingPrice))),
  );
});

test("Static test: TokenPrice.project should be the same with UniswapSdkPrice", (t) => {
  const priceStr = "70000";
  const price = Option.getOrThrowWith(
    Token.TokenPriceUnits(WETH, USDT, priceStr),
    () => new Error("Failed to create TokenPriceUnits"),
  );

  const sdkWETH = new SdkToken(1, WETH.address, WETH.decimals, WETH.symbol, WETH.name);
  const sdkUSDT = new SdkToken(1, USDT.address, USDT.decimals, USDT.symbol, USDT.name);
  const sdkPrice = new SdkPrice(sdkWETH, sdkUSDT, 1, 70000);

  const actual = price.projectAmount(
    TokenVolume.TokenVolumeUnits(WETH, NonNegativeDecimal(Big(0.855555))),
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
    const price = Token.TokenPriceRatio(WETH, USDT, priceRatio);

    const sdkWETH = new SdkToken(1, WETH.address, WETH.decimals, WETH.symbol, WETH.name);
    const sdkUSDT = new SdkToken(1, USDT.address, USDT.decimals, USDT.symbol, USDT.name);
    const [priceNominator, priceDenominator] = BigMath.asNumeratorAndDenominator(priceRatio);
    const sdkPrice = new SdkPrice(
      sdkWETH,
      sdkUSDT,
      priceDenominator.toString(),
      priceNominator.toString(),
    );

    const [volumeNominator, volumeDenominator] = BigMath.asNumeratorAndDenominator(volumeRatio);

    const tokenVolume = TokenVolume.TokenVolumeRatio(WETH, volumeRatio);
    const actual = price.projectAmount(tokenVolume);
    const expectedSdkValue = sdkPrice.quote(
      CurrencyAmount.fromFractionalAmount(
        sdkWETH,
        volumeNominator.toString(),
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
);
