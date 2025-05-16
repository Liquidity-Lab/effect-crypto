import testAny from "ava";
import { Big, MathContext, RoundingMode } from "bigdecimal.js";
import { Either, Option } from "effect";

import { fc, testProp } from "@fast-check/ava";

import * as Adt from "./adt.js";
import * as Assertable from "./assertable.js";
import * as BigMath from "./bigMath.js";
import * as Token from "./token.js";
import * as internal from "./tokenVolume.internal.js";
import * as TokenVolume from "./tokenVolume.js";

// Constants for precision comparison
const errorTolerance = Big("0.000000000000000001"); // Adjust tolerance as needed
const mathContext = new MathContext(128, RoundingMode.HALF_UP); // Use appropriate precision

const USDT = Token.Erc20Token(
  Adt.Address.unsafe("0x0000000000000000000000000000000000000001"),
  6,
  "USDT",
  "Tether USD",
  Token.Erc20TokenMeta(),
);

testAny("TokenVolumeUnits creates correct volume", (t) => {
  const volume = TokenVolume.tokenVolumeUnits(USDT, BigMath.NonNegativeDecimal(Big("1000.123456")));

  t.is(TokenVolume.asUnits(volume).toString(), "1000.123456");
  t.is(TokenVolume.asUnscaled(volume), 1000123456n);
});

testAny("TokenVolumeRatio creates correct volume", (t) => {
  const ratio = BigMath.Ratio(Big(1000123456n).divide(1000000n));
  const volume = TokenVolume.tokenVolumeRatio(USDT, ratio);

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
  const volume = TokenVolume.tokenVolumeZero(USDT);

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
    const actual = TokenVolume.tokenVolumeUnits(
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
};
testProp(
  "TokenVolume generator respects constraints",
  [TokenVolume.tokenVolumeGen(USDT, constraints)],
  (t, volume) => {
    const units = TokenVolume.asUnits(volume);

    t.true(units.compareTo(Big(100)) >= 0);
    t.true(units.compareTo(Big(200)) <= 0);
    t.assert(
      volume.underlyingValue.scale() <= USDT.decimals,
      `Expected scale to be less than or equal to ${USDT.decimals}`,
    );
  },
);

testProp(
  "TokenVolume generator produces values suitable for the token",
  [internal.tokenVolumeOrErrGen(USDT)],
  (t, volume) => {
    t.true(
      Either.isRight(volume),
      `Expected to get a valid token volume, but got an error: ${volume.toString()}`,
    );

    t.true(
      volume.pipe(
        Either.map((volume) => TokenVolume.asUnits(volume).gt(0)),
        Either.getOrElse(() => false),
      ),
      `Expected to get a positive token volume, but got: ${volume.toString()}`,
    );
  },
  { numRuns: 1024 },
);

testAny("minVolumeForToken returns the smallest possible positive volume", (t) => {
  const minVolume = TokenVolume.minVolumeForToken(USDT);
  const expectedUnscaled = 1n;
  const expectedUnits = Big(expectedUnscaled, USDT.decimals);

  // Verify unscaled value is exactly 1n
  t.is(TokenVolume.asUnscaled(minVolume), expectedUnscaled);

  // Verify the units representation (BigDecimal) matches using precision comparison
  BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext)(
    TokenVolume.asUnits(minVolume),
    expectedUnits,
    "Units representation should match the expected value within tolerance",
  );
});

testAny("maxVolumeForToken returns the largest possible volume (MAX_UINT256)", (t) => {
  const maxVolume = TokenVolume.maxVolumeForToken(USDT);
  const expectedUnscaled = BigMath.MAX_UINT256.unscaledValue() - 1n;
  const expectedUnits = Big(expectedUnscaled, USDT.decimals);

  // Verify unscaled value is exactly MAX_UINT256 - 1n
  t.is(TokenVolume.asUnscaled(maxVolume), expectedUnscaled);

  // Verify the units representation (BigDecimal) matches using precision comparison
  BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext)(
    TokenVolume.asUnits(maxVolume),
    expectedUnits,
    "Units representation should match the expected value within tolerance",
  );
});

testProp(
  "minVolumeForToken is less than or equal to any generated positive volume",
  [TokenVolume.tokenVolumeGen(USDT)], // Using the default generator which creates positive values
  (t, generatedVolume) => {
    const minVolume = TokenVolume.minVolumeForToken(USDT);

    // Compare using underlying NonNegativeDecimal values
    t.true(minVolume.underlyingValue.compareTo(generatedVolume.underlyingValue) <= 0);
    // Also compare unscaled values
    t.true(TokenVolume.asUnscaled(minVolume) <= TokenVolume.asUnscaled(generatedVolume));
  },
);

testProp(
  "maxVolumeForToken is greater than or equal to any generated volume",
  [TokenVolume.tokenVolumeGen(USDT)], // Generator respects MAX_UINT256 implicitly
  (t, generatedVolume) => {
    const maxVolume = TokenVolume.maxVolumeForToken(USDT);

    // Compare using underlying NonNegativeDecimal values
    t.true(maxVolume.underlyingValue.compareTo(generatedVolume.underlyingValue) >= 0);
    // Also compare unscaled values
    t.true(TokenVolume.asUnscaled(maxVolume) >= TokenVolume.asUnscaled(generatedVolume));
  },
);
