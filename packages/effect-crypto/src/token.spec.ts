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


