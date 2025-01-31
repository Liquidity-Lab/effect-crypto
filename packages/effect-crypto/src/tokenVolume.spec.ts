import testAny from "ava";
import { Big } from "bigdecimal.js";
import { Option } from "effect";

import { fc, testProp } from "@fast-check/ava";

import * as Adt from "./adt.js";
import * as Assertable from "./assertable.js";
import * as BigMath from "./bigMath.js";
import * as Token from "./token.js";
import * as TokenVolume from "./tokenVolume.js";

const USDT = Token.Erc20Token(
  Adt.Address.unsafe("0x0000000000000000000000000000000000000001"),
  6,
  "USDT",
  "Tether USD",
  Token.Erc20TokenMeta(),
);

testAny("TokenVolumeUnits creates correct volume", (t) => {
  const volume = TokenVolume.TokenVolumeUnits(USDT, BigMath.NonNegativeDecimal(Big("1000.123456")));

  t.is(TokenVolume.asUnits(volume).toString(), "1000.123456");
  t.is(TokenVolume.asUnscaled(volume), 1000123456n);
});

testAny("TokenVolumeRatio creates correct volume", (t) => {
  const ratio = BigMath.Ratio(Big(1000123456n).divide(1000000n));
  const volume = TokenVolume.TokenVolumeRatio(USDT, ratio);

  t.is(TokenVolume.asUnits(volume).toString(), "1000.123456");
  t.is(TokenVolume.asUnscaled(volume), 1000123456n);
});

testAny("tokenVolumeFromUnscaled creates correct volume for valid input", (t) => {
  const result = TokenVolume.tokenVolumeFromUnscaled(USDT, 1000123456n);

  if (Option.isNone(result)) {
    t.fail("Expected to get some volume");
  } else {
    t.is(TokenVolume.asUnits(result.value).toString(), "1000.123456");
    t.is(TokenVolume.asUnscaled(result.value), 1000123456n);
  }
});

testAny("tokenVolumeFromUnscaled returns None for negative values", (t) => {
  const result = TokenVolume.tokenVolumeFromUnscaled(USDT, -1000123456n);

  t.true(Option.isNone(result));
});

testAny("TokenVolumeZero creates zero volume", (t) => {
  const volume = TokenVolume.TokenVolumeZero(USDT);

  t.is(TokenVolume.asUnits(volume).numberValue(), 0);
  t.is(TokenVolume.asUnscaled(volume), 0n);
});

testProp(
  "TokenVolume maintains consistency between units and unscaled representations",
  [
    fc.bigInt({
      min: 0n,
      max: 1000000000000000n,
    }),
  ],
  (t, value) => {
    const volume = TokenVolume.tokenVolumeFromUnscaled(USDT, value);

    if (Option.isNone(volume)) {
      t.fail("Expected to get some volume");
    } else {
      const unscaled = TokenVolume.asUnscaled(volume.value);
      const units = TokenVolume.asUnits(volume.value);

      const backToUnscaled = units.multiply(Big(10).pow(USDT.decimals)).toBigInt();

      t.is(unscaled, backToUnscaled);
    }
  },
);

testProp(
  "TokenVolume assertable comparison works correctly",
  [TokenVolume.tokenVolumeGen(USDT)],
  (t, expected) => {
    const actual = TokenVolume.TokenVolumeUnits(
      USDT,
      BigMath.NonNegativeDecimal(
        TokenVolume.asUnits(expected).setScale(expected.underlyingValue.scale() * 2),
      ),
    );

    t.deepEqual(Assertable.asAssertableEntity(actual), Assertable.asAssertableEntity(expected));
  },
  { numRuns: 1024 },
);

const constraints = {
  min: BigMath.NonNegativeDecimal(Big(100)),
  max: BigMath.NonNegativeDecimal(Big(200)),
  maxScale: 2,
};
testProp(
  "TokenVolume generator respects constraints",
  [TokenVolume.tokenVolumeGen(USDT, constraints)],
  (t, volume) => {
    const units = TokenVolume.asUnits(volume);

    t.true(units.compareTo(Big(100)) >= 0);
    t.true(units.compareTo(Big(200)) <= 0);
    t.true(volume.underlyingValue.scale() <= 2);
  },
);
