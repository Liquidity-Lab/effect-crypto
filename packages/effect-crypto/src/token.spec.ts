import test from "ava";
import { Option } from "effect";

import { CurrencyAmount, Price as SdkPrice, Token as SdkToken } from "@uniswap/sdk-core";

import * as Adt from "~/adt.js";
import * as Token from "~/token.js";

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
  const priceStr = "70000.015";
  const price = Token.TokenPriceUnits(WETH, USDT, priceStr);

  const actual = price.projectAmount(Token.TokenVolumeUnits(USDT, priceStr));

  t.deepEqual(
    Option.map(actual, (a) => a.asUnscaled),
    Option.some(Token.TokenVolumeUnits(WETH, 1n).asUnscaled),
  );
});

test("TokenPrice.project for base currency", (t) => {
  const priceStr = "70000.15";
  const price = Token.TokenPriceUnits(WETH, USDT, priceStr);

  const actual = price.projectAmount(Token.TokenVolumeUnits(WETH, 1n));

  t.deepEqual(
    Option.map(actual, (a) => a.asUnscaled),
    Option.some(Token.TokenVolumeUnits(USDT, priceStr).asUnscaled),
  );
});

test("TokenPrice.project should be the same with UniswapSdkPrice", (t) => {
  const priceStr = "70000";
  const price = Token.TokenPriceUnits(WETH, USDT, priceStr);

  const sdkWETH = new SdkToken(1, WETH.address, WETH.decimals, WETH.symbol, WETH.name);
  const sdkUSDT = new SdkToken(1, USDT.address, USDT.decimals, USDT.symbol, USDT.name);
  const sdkPrice = new SdkPrice(sdkWETH, sdkUSDT, 1, 70000);

  const actual = price.projectAmount(Token.TokenVolumeUnits(WETH, 0.855555));
  const expected = sdkPrice.quote(CurrencyAmount.fromFractionalAmount(sdkWETH, 855555, 1000000));

  t.deepEqual(
    Option.map(actual, (a) => Number(a.asUnits)),
    Option.some(
      Number(expected.quotient.toString()) + Number(expected.remainder.toFixed(USDT.decimals)),
    ),
  );
});
