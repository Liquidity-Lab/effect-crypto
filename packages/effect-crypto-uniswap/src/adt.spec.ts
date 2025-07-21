import test from "ava";
import { Either, Option } from "effect";

import { testProp } from "@fast-check/ava";
import { Token } from "@liquidity_lab/effect-crypto";
import { MaxUint256 } from "@uniswap/sdk-core";

import * as Adt from "./adt.js";

const maxUnit256 = BigInt(MaxUint256.toString());

test("Amount0, Amount1 unscaled values should be in range according to the uniswap-sdk implementation", (t) => {
  const maxAmount0 = Adt.Amount0.max;
  const maxAmount1 = Adt.Amount1.max;

  t.assert(
    maxAmount0 === maxUnit256,
    `Amount0 unscaled value [$\{maxAmount0}] should be equal to MaxUint256[${maxUnit256}]`,
  );

  t.assert(
    maxAmount1 === maxUnit256,
    `Amount1 unscaled value [$\{maxAmount1}] should be equal to MaxUint256[${maxUnit256}]`,
  );
});

testProp(
  "Amount0, Amount1 unscaled values should be in range [0, MaxUint256]",
  [Adt.Amount0.gen(), Adt.Amount1.gen()],
  (t, amount0, amount1) => {
    const unscaledAmount0 = amount0;
    const unscaledAmount1 = amount1;

    t.assert(
      unscaledAmount0 >= 0n && unscaledAmount0 <= maxUnit256,
      `Amount0 unscaled value [${unscaledAmount0}] should be in range [0, ${maxUnit256}]`,
    );

    t.assert(
      unscaledAmount1 >= 0n && unscaledAmount1 <= maxUnit256,
      `Amount1 unscaled value [${unscaledAmount1}] should be in range [0, ${maxUnit256}]`,
    );
  },
  { numRuns: 2048 },
);

testProp(
  "Amount0 round trip: Amount0 -> TokenVolume -> Amount0 should preserve original value",
  [Adt.Amount0.gen({ min: Adt.Amount0(1n) }), Token.tokenGen(Token.TokenType.ERC20)],
  (t, expected, token) => {
    // Convert Amount0 to TokenVolume
    const tokenVolume = Option.getOrElse(Adt.amount0ToTokenVolume(expected, token), () =>
      t.fail(
        `Expected amount0ToTokenVolume to succeed, but got None. Original amount: ${expected}, Token decimals: ${token.decimals}`,
      ),
    );
    // Convert TokenVolume back to Amount0
    const actual = Either.getOrElse(Adt.Amount0.fromTokenVolume(tokenVolume), (error) =>
      t.fail(`Expected fromTokenVolume to succeed, but got Left: ${error}`),
    );

    // Verify the round trip preserves the original value
    t.is(
      actual,
      expected,
      `Round trip should preserve original Amount0 value. Original: ${expected}, Round trip: ${actual}`,
    );
  },
  { numRuns: 1024 },
);

testProp(
  "Amount1 round trip: Amount1 -> TokenVolume -> Amount1 should preserve original value",
  [Adt.Amount1.gen({ min: Adt.Amount1(1n) }), Token.tokenGen(Token.TokenType.ERC20)],
  (t, expected, token) => {
    // Convert Amount1 to TokenVolume
    const tokenVolume = Option.getOrElse(Adt.amount1ToTokenVolume(expected, token), () =>
      t.fail(
        `Expected amount1ToTokenVolume to succeed, but got None. Original amount: ${expected}, Token decimals: ${token.decimals}`,
      ),
    );

    // Convert TokenVolume back to Amount1
    const actual = Either.getOrElse(Adt.Amount1.fromTokenVolume(tokenVolume), (error) =>
      t.fail(`Expected fromTokenVolume to succeed, but got Left: ${error}`),
    );

    // Verify the round trip preserves the original value
    t.is(
      actual,
      expected,
      `Round trip should preserve original Amount1 value. Original: ${expected}, Round trip: ${actual}`,
    );
  },
  { numRuns: 1024 },
);
