import test, { ExecutionContext } from "ava";
import { Big, BigDecimal, MathContext, RoundingMode } from "bigdecimal.js";

import { fc, testProp } from "@fast-check/ava";

import * as BigMath from "./bigMath.js";

test("It should correctly calculate Log[1.0001, 1.5102563224]", (t) => {
  const base = Big("1.0001");
  const x = Big("1.5102563224");
  const expectedRaw = "4122.9999998048678757250137702366718982376842353025497989951";

  const mc = new MathContext(expectedRaw.length, RoundingMode.HALF_EVEN);
  const result = BigMath.log(base, x, mc);

  // @see https://www.wolframalpha.com/input?i2d=true&i=Log%5B1.0001%0A%2C1.5102563224%5D
  const expected = Big(expectedRaw);

  compareWithPrecision(t, expected.scale() - 1)(result, expected, "Should be equal");
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

function compareWithPrecision(
  t: ExecutionContext<unknown>,
  precision?: number,
): (actual: BigDecimal, expected: BigDecimal, msg?: string) => boolean {
  return (actual, expected, msg) => {
    const targetScale = Math.min(actual.scale(), expected.scale(), precision ?? Number.MAX_VALUE);

    return t.deepEqual(
      actual.setScale(targetScale, RoundingMode.HALF_UP).toPlainString(),
      expected.setScale(targetScale, RoundingMode.HALF_UP).toPlainString(),
      msg,
    );
  };
}

testProp(
  "It should correctly calculate ln(x) for",
  [doubleWithLimitedPrecision(10)],
  (t, x) => {
    const mc = new MathContext(64, RoundingMode.HALF_EVEN);

    const expected = Big(Math.log(x));
    const actual = BigMath.ln(Big(x), mc);

    compareWithPrecision(t, 8)(actual, expected);
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

    compareWithPrecision(t, 8)(actual, expected);
  },
  { numRuns: 1024 },
);
