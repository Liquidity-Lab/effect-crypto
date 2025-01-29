import test from "ava";
import { Big, MathContext, RoundingMode } from "bigdecimal.js";

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
    const actual = Big(`${numerator}.${denominator}`);

    BigMath.assertEqualWithPercentage(t, errorTolerance, mathContext)(actual, expected);
  },
  { numRuns: 1024 },
);

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

  result.passed && result.commit();

  t.assert(result.passed, "Zero values should be equal");
});

test("assertEqualWithPercentage should correctly compare same values", async (t) => {
  const percents = Big("0.01");
  const value = Big("1");
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(value, value);
  });
  result.passed && result.commit();
  t.assert(result.passed, "Same values should be equal");
});

test("assertEqualWithPercentage should correctly compare values on upper boundary", async (t) => {
  const percents = Big("0.01");
  const expected = Big("1");
  const actual = expected.multiply(percents.add(1), mathContext);
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(actual, expected);
  });
  result.passed && result.commit();
  t.assert(result.passed, "Values on the upper boundary of the range should be considered equal");
});

test("assertEqualWithPercentage should correctly compare values on lower boundary", async (t) => {
  const percents = Big("0.01");
  const expected = Big("1");
  const actual = expected.multiply(Big(1).subtract(percents), mathContext);
  const result = await t.try((t) => {
    BigMath.assertEqualWithPercentage(t, percents, mathContext)(actual, expected);
  });
  result.passed && result.commit();
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
  result.passed && result.commit();
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
