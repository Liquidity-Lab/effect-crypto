import { Big, MathContext, RoundingMode } from "bigdecimal.js";

import { fc, testProp } from "@fast-check/ava";
import { BigMath } from "@liquidity_lab/effect-crypto";
import { jsbi } from "@liquidity_lab/jsbi-reimported";
import {
  FeeAmount as SdkFeeAmount,
  TICK_SPACINGS,
  TickMath,
  nearestUsableTick,
} from "@uniswap/v3-sdk";

import * as Adt from "./adt.js";
import * as Tick from "./tick.js";

const JSBI = jsbi.default;

testProp(
  "getSqrtRatio should works the same as uniswap-sdk implementation",
  [Tick.Tick.gen],
  (t, tick) => {
    const expectedR = TickMath.getSqrtRatioAtTick(tick);
    const actual = Tick.getSqrtRatio(tick);

    const Q96 = Big(2n ** 96n);
    const expected = Big(expectedR.toString()).divide(Q96, 29, RoundingMode.HALF_UP);

    BigMath.assertEqualWithPercentage(
      t,
      Big("0.000000001"),
      new MathContext(28, RoundingMode.DOWN),
    )(actual, expected);
  },
  { numRuns: 2048 },
);

testProp(
  "Round trip [getTickAtRatio -> getSqrtRatio] should be correct",
  [doubleWithLimitedPrecisionGen()],
  (t, ratio) => {
    const tick = Tick.getTickAtRatio(ratio);

    const restoredRatioLower = Tick.getSqrtRatio(Tick.Tick(tick - 1)).pow(2);
    const restoredRatioUpper = Tick.getSqrtRatio(Tick.Tick(tick + 1)).pow(2);

    t.assert(
      ratio.greaterThanOrEquals(restoredRatioLower) && ratio.lowerThanOrEquals(restoredRatioUpper),
      `ratio should be in range ` +
        `${restoredRatioLower.toPlainString()} <= ${ratio.toPlainString()} <= ${restoredRatioUpper.toPlainString()}`,
    );
  },
  { numRuns: 256 },
);

testProp(
  "getTickAtRatio should works the same as uniswap-sdk implementation",
  [doubleWithLimitedPrecisionGen()],
  (t, ratio) => {
    const expected = TickMath.getTickAtSqrtRatio(
      JSBI.BigInt(
        ratio
          .sqrt(new MathContext(96, RoundingMode.HALF_UP))
          .multiply(2n ** 96n)
          .toBigInt()
          .toString(),
      ),
    );
    const actual = Tick.getTickAtRatio(ratio);

    t.deepEqual(actual, expected, "tick idx should be equal");
  },
);

testProp(
  "nearestUsableTick should works the same as uniswap-sdk implementation",
  [Tick.Tick.gen, Adt.feeAmountGen],
  (t, tick, feeAmount) => {
    const expected = nearestUsableTick(tick, TICK_SPACINGS[feeAmountToSdk(feeAmount)]);
    const actual = Tick.nearestUsableTick(tick, Tick.toTickSpacing(feeAmount));

    t.deepEqual(actual, expected, "tick idx should be equal");
  },
  { numRuns: 512 },
);

function doubleWithLimitedPrecisionGen() {
  const integerPartGen = fc.bigInt(
    Tick.MIN_SQRT_RATIO.pow(2).toBigInt() + 1n,
    Tick.MAX_SQRT_RATIO.pow(2).toBigInt() - 1n,
  );
  const fractionalPartGen = fc.bigInt(0n, 2n ** 96n - 1n);

  return fc.tuple(integerPartGen, fractionalPartGen).map(([integer, fractional]) => {
    return Big(`${integer}.${fractional}`);
  });
}

function feeAmountToSdk(feeAmount: Adt.FeeAmount): SdkFeeAmount {
  switch (feeAmount) {
    case Adt.FeeAmount.LOWEST:
      return SdkFeeAmount.LOWEST;
    case Adt.FeeAmount.LOW:
      return SdkFeeAmount.LOW;
    case Adt.FeeAmount.MEDIUM:
      return SdkFeeAmount.MEDIUM;
    case Adt.FeeAmount.HIGH:
      return SdkFeeAmount.HIGH;
  }
}
