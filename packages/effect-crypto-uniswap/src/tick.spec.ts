import { Big, MathContext, RoundingMode } from "bigdecimal.js";
import { Either, Option } from "effect";
import { Arbitrary } from "fast-check";

import { fc, testProp } from "@fast-check/ava";
import { BigMath, Token } from "@liquidity_lab/effect-crypto";
import { jsbi } from "@liquidity_lab/jsbi-reimported";
import {
  FeeAmount as SdkFeeAmount,
  TickMath as SdkTickMath,
  TICK_SPACINGS,
  nearestUsableTick as sdkNearestUsableTick,
} from "@uniswap/v3-sdk";

import * as Adt from "./adt.js";
import * as Price from "./price.js";
import * as Tick from "./tick.js";

const JSBI = jsbi.default;

testProp(
  "getSqrtRatio should works the same as uniswap-sdk implementation",
  [Tick.Tick.gen],
  (t, tick) => {
    const expectedR = SdkTickMath.getSqrtRatioAtTick(tick);
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
    const expected = SdkTickMath.getTickAtSqrtRatio(
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
  "getTickAtPrice should work correctly with sqrt-based price",
  [priceWithSqrtValueGen()],
  (t, sqrtPrice) => {
    // Get tick using our implementation
    const actualTick = Tick.getTickAtPrice(sqrtPrice);
    // Convert to Uniswap format (Q96.64)
    const sqrtPriceX96 = Price.asSqrtQ64_96(sqrtPrice).pipe(
      Option.map((sqrtPrice) => JSBI.BigInt(sqrtPrice.toString())),
      Option.getOrElse(() => t.fail("Cannot convert to sqrt(Q96.64) SDK price")),
      // Option.getOrThrowWith(() => new RuntimeException("Cannot convert to sqrt(Q96.64) SDK price")),
    );
    // Get tick using Uniswap's implementation
    const expectedTick = SdkTickMath.getTickAtSqrtRatio(sqrtPriceX96);

    t.deepEqual(actualTick, expectedTick, "tick index should be equal");
  },
  { numRuns: 512 },
);

testProp(
  "nearestUsableTick should works the same as uniswap-sdk implementation",
  [Tick.Tick.gen, Adt.feeAmountGen],
  (t, tick, feeAmount) => {
    const expected = sdkNearestUsableTick(tick, TICK_SPACINGS[feeAmountToSdk(feeAmount)]);
    const actual = Tick.nearestUsableTick(tick, Tick.toTickSpacing(feeAmount));

    t.deepEqual(actual, expected, "tick idx should be equal");
  },
  { numRuns: 512 },
);

testProp(
  "addNTicks and subtractNTicks should be inverses when within bounds",
  [fc.integer({ min: 1, max: 5 }), Adt.feeAmountGen],
  (t, n, feeAmount) => {
    const spacing = Tick.toTickSpacing(feeAmount);
    const startTickValue = 0;
    const usableTick = Tick.UsableTick(Tick.Tick(startTickValue), spacing);

    const added = Tick.addNTicks(usableTick, n);
    // Subtract only if adding succeeded
    const subtracted = Option.flatMap(added, (addedTick) => Tick.subtractNTicks(addedTick, n));

    // We expect to return to the *original* usableTick, which might have been adjusted if startTickValue wasn't aligned
    t.deepEqual(
      subtracted,
      Option.some(usableTick),
      "should return to original usable tick after add/subtract",
    );
  },
);

testProp(
  "subtract should calculate integer distance between nearest usable ticks",
  [Tick.Tick.gen, Tick.Tick.gen, Adt.feeAmountGen],
  (t, tick1, tick2, feeAmount) => {
    const spacing = Tick.toTickSpacing(feeAmount);
    const distance = Tick.subtract(tick1, tick2, spacing);
    const distanceReverse = Tick.subtract(tick2, tick1, spacing);

    // Check if the result is an integer
    t.true(Number.isInteger(distance), "Distance should be an integer");
    t.true(Number.isInteger(distanceReverse), "DistanceReverse should be an integer");
    // Check if the absolute values of the forward and reverse distances are equal
    t.deepEqual(
      Math.abs(distance),
      Math.abs(distanceReverse),
      "Absolute distance should be consistent regardless of order",
    );
  },
  { numRuns: 1024 },
);

testProp(
  "subtract should be consistent with addNTicks/subtractNTicks",
  [Tick.Tick.gen, Tick.Tick.gen, Adt.feeAmountGen],
  (t, tick1, tick2, feeAmount) => {
    const spacing = Tick.toTickSpacing(feeAmount);

    // Calculate the distance between the nearest usable ticks
    const distance = Tick.subtract(tick1, tick2, spacing);

    // Get the actual nearest usable ticks
    const usableTick1Nearest = Tick.nearestUsableTick(tick1, spacing);
    const usableTick2Nearest = Tick.nearestUsableTick(tick2, spacing);

    // Create UsableTick instances for operations
    const usableTick1 = Tick.UsableTick(usableTick1Nearest, spacing);
    const usableTick2 = Tick.UsableTick(usableTick2Nearest, spacing);

    // Test: Adding the calculated distance to tick1 should yield tick2
    // usableTick1 + distance = usableTick2
    const actualAddedResultOpt = Tick.addNTicks(usableTick1, distance);
    const expectedAddedResultOpt = Option.some(usableTick2);
    t.deepEqual(
      actualAddedResultOpt,
      expectedAddedResultOpt,
      `Adding distance (${distance}) to usableTick1 (${usableTick1.unwrap}) should result in Option.some(usableTick2: ${usableTick2.unwrap}))`,
    );

    // Test: Subtracting the calculated distance from tick2 should yield tick1
    // usableTick2 - distance = usableTick1
    const actualSubtractedResultOpt = Tick.subtractNTicks(usableTick2, distance);
    const expectedSubtractedResultOpt = Option.some(usableTick1);
    t.deepEqual(
      actualSubtractedResultOpt,
      expectedSubtractedResultOpt,
      `Subtracting distance (${distance}) from usableTick2 (${usableTick2.unwrap}) should result in Option.some(usableTick1: ${usableTick1.unwrap}))`,
    );
  },
  { numRuns: 1024 },
);

/**
 * Generates token prices with valid sqrt values for Uniswap V3 pools.
 * The sqrt price must be within the valid range defined by MIN_SQRT_RATIO and MAX_SQRT_RATIO.
 *
 * @returns An Arbitrary that generates TokenPrice instances with sqrt price values
 */
function priceWithSqrtValueGen(): Arbitrary<Price.Erc20LikeTokenPrice> {
  // Create test tokens for price generation
  return Token.tokenPairGen(Token.TokenType.ERC20).chain(([token0, token1]) => {
    return Price.tokenPriceGen(token0, token1).map((price) => {
      const sqrtPrice = Price.TokenPriceSqrt(token0, token1, BigMath.Ratio(Price.asSqrt(price)));

      return Either.getOrThrow(sqrtPrice);
    });
  });
}

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
