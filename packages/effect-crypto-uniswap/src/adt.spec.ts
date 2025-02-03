import test from "ava";

import { MaxUint256 } from "@uniswap/sdk-core";

import * as Adt from "./adt.js";
import {testProp} from "@fast-check/ava";

const maxUnit256 = BigInt(MaxUint256.toString());

test("Amount0, Amount1 unscaled values should be in range according to the uniswap-sdk implementation", (t) => {
  const maxAmount0 = Adt.Amount0.max.unscaledValue();
  const maxAmount1 = Adt.Amount1.max.unscaledValue();

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
      const unscaledAmount0 = amount0.unscaledValue();
      const unscaledAmount1 = amount1.unscaledValue();

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

