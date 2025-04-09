import test from "ava";
import { Big, MathContext, RoundingMode } from "bigdecimal.js";
import { Option } from "effect";

import { fc, testProp } from "@fast-check/ava";

import * as BigMath from "./bigMath.js";

const errorTolerance = Big("0.00000000000001");
const mathContext = new MathContext(96, RoundingMode.HALF_UP);

test("It should correctly calculate Log[1.0001, 1.5102563224]", (t) => {
  const base = Big("1.0001");
  const x = Big("1.5102563224");
  const expectedRaw = "4122.9999998048678757250137702366718982376842353025497989951";

  const mc = new MathContext(expectedRaw.length, RoundingMode.HALF_EVEN);
  const result = BigMath.log(base, x, mc);

  // @see https://www.wolframalpha.com/input?i2d=true&i=Log%5B1.0001%0A%2C1.5102563224%5D
  const expected = Big(expectedRaw);

  BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext)(
    result,
    expected,
    "Should be equal",
  );
});

const doubleWithLimitedPrecision = (scale: number) =>
  fc
    .double({
      min: 0,
      minExcluded: true,
      max: Number.MAX_VALUE,
      maxExcluded: true,
      noNaN: true,
      noDefaultInfinity: true,
    })
    .map((value) => {
      return Number(Big(value).setScale(scale, RoundingMode.CEILING).toPlainString());
    });

testProp(
  "It should correctly split BigDecimal to [numerator, denominator]",
  [BigMath.ratioGen()],
  (t, expected) => {
    const [numerator, denominator] = BigMath.asNumeratorAndDenominator(expected);
    const actual = Big(numerator).divideWithMathContext(denominator, mathContext);

    BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext)(actual, expected);
  },
  { numRuns: 1024 },
);

test("asNumeratorAndDenominator should correctly handle BigDecimal(1) with scale 6", (t) => {
  const expected = Big("1").setScale(6);
  const [numerator, denominator] = BigMath.asNumeratorAndDenominator(expected);
  const actual = Big(numerator).divideWithMathContext(denominator, mathContext);

  BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext)(actual, expected);
});

testProp(
  "It should correctly calculate ln(x) for",
  [doubleWithLimitedPrecision(10)],
  (t, x) => {
    const mc = new MathContext(64, RoundingMode.HALF_EVEN);

    const expected = Big(Math.log(x));
    const actual = BigMath.ln(Big(x), mc);

    BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext)(actual, expected);
  },
  { numRuns: 1024 },
);

testProp(
  "It should correctly calculate log2(x) for",
  [doubleWithLimitedPrecision(10)],
  (t, x) => {
    const mc = new MathContext(64, RoundingMode.HALF_EVEN);

    const expected = Big(Math.log2(x));
    const actual = BigMath.log2(Big(x), mc);

    BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext)(actual, expected);
  },
  { numRuns: 1024 },
);

test("assertEqualWithPercentage should correctly compare two zeros", async (t) => {
  const percents = Big("0.01");

  const expected = Big("0");
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(expected, expected);
  });

  if (result.passed) {
    result.commit();
  }

  t.assert(result.passed, "Zero values should be equal");
});

test("assertEqualWithPercentage should correctly compare same values", async (t) => {
  const percents = Big("0.01");
  const value = Big("1");
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(value, value);
  });
  if (result.passed) {
    result.commit();
  }
  t.assert(result.passed, "Same values should be equal");
});

test("assertEqualWithPercentage should correctly compare values on upper boundary", async (t) => {
  const percents = Big("0.01");
  const expected = Big("1");
  const actual = expected.multiply(percents.add(1), mathContext);
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(actual, expected);
  });
  if (result.passed) {
    result.commit();
  }
  t.assert(result.passed, "Values on the upper boundary of the range should be considered equal");
});

test("assertEqualWithPercentage should correctly compare values on lower boundary", async (t) => {
  const percents = Big("0.01");
  const expected = Big("1");
  const actual = expected.multiply(Big(1).subtract(percents), mathContext);
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(actual, expected);
  });

  if (result.passed) {
    result.commit();
  }

  t.assert(result.passed, "Values on the lower boundary of the range should be considered equal");
});

test("assertEqualWithPercentage should reject values above upper boundary", async (t) => {
  const percents = Big("0.01");
  const expected = Big("1");
  const actual = expected.multiply(percents.add(1.1), mathContext);
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(actual, expected);
  });

  result.discard();

  t.assert(
    !result.passed,
    "Values above the upper boundary of the range should not be considered equal",
  );
});

test("assertEqualWithPercentage should reject values below lower boundary", async (t) => {
  const percents = Big("0.01");
  const expected = Big("1");
  const actual = expected.multiply(Big(1).subtract(percents.add(1.1)), mathContext);
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(actual, expected);
  });
  result.discard();
  t.assert(
    !result.passed,
    "Values below the lower boundary of the range should not be considered equal",
  );
});

test("assertEqualWithPercentage should trim scale when requested", async (t) => {
  const percents = Big("0.01");
  const actual = Big("1.1234567897");
  const expected = Big("1.123456789");
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext).trimToExpectedScale(
      actual,
      expected,
    );
  });

  if (result.passed) {
    result.commit();
  }

  t.assert(result.passed, ".trimToExpectedScale should trim the scale");
});

test("assertEqualWithPercentage should reject negative values", async (t) => {
  const percents = Big("0.01");
  const expected = Big("1");
  const actual = expected.multiply(-1, mathContext);
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(actual, expected);
  });

  result.discard();

  t.assert(!result.passed, "Negative values should not be considered equal");
});

testProp(
  "bigDecimalGen with min constraint should generate values >= min",
  [BigMath.bigDecimalGen({ min: Big(100) })],
  (t, generated) => {
    t.true(
      generated.greaterThanOrEquals(Big(100)),
      `Generated value ${generated} should be >= 100`,
    );
  },
  { numRuns: 1024 },
);

testProp(
  "bigDecimalGen with max constraint should generate values <= max",
  [BigMath.bigDecimalGen({ max: Big(100) })],
  (t, generated) => {
    t.true(generated.lowerThanOrEquals(Big(100)), `Generated value ${generated} should be <= 100`);
  },
  { numRuns: 1024 },
);

testProp(
  "bigDecimalGen with min and max constraints should generate values within range",
  [BigMath.bigDecimalGen({ min: Big(100), max: Big(200) })],
  (t, generated) => {
    t.true(
      generated.greaterThanOrEquals(Big(100)) && generated.lowerThanOrEquals(Big(200)),
      `Generated value ${generated} should be within [100, 200]`,
    );
  },
  { numRuns: 1024 },
);

testProp(
  "bigDecimalGen with scale constraint should generate values with correct scale",
  [BigMath.bigDecimalGen({ scale: 2 })],
  (t, generated) => {
    t.true(generated.scale() <= 2, `Generated value ${generated} should have scale <= 2`);
  },
  { numRuns: 64 },
);

test("Q64x96 conversion handles edge cases correctly", (t) => {
  // Zero
  t.deepEqual(
    Option.map(BigMath.convertToQ64x96(Big(0)), BigMath.q64x96ToBigDecimal),
    Option.some(Big(0)),
  );

  // Max value should result in None
  t.deepEqual(BigMath.convertToQ64x96(Big(2).pow(160)), Option.none());
});

testProp(
  "Q64x96 round-trip conversion should preserve the original value",
  [BigMath.q64x96Gen()],
  (t, originalQ64x96) => {
    // Convert Q64x96 to BigDecimal
    const originalBigDecimal = BigMath.q64x96ToBigDecimal(originalQ64x96);

    // Convert BigDecimal back to Q64x96
    const resultQ64x96Opt = BigMath.convertToQ64x96(originalBigDecimal);

    // Check if the resulting Q64x96 matches the original Q64x96
    // We use deepEqual here because Q64x96 is a branded bigint
    // and assertEqualWithPercentage is for BigDecimal comparisons.
    // Direct bigint comparison should be precise enough for this round trip.
    t.deepEqual(resultQ64x96Opt, Option.some(originalQ64x96));
  },
  { numRuns: 1024 },
);
