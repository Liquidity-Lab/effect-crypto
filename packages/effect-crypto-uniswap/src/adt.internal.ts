import { Arbitrary } from "fast-check";

import { fc } from "@fast-check/ava";

/**
 * Fee amount in percents
 *
 * @example
 *   import { FeeAmount } from "@liquidity_lab/";
 *
 *   FeeAmount.LOW; // 0.05%
 *   FeeAmount.MEDIUM; // 0.3%
 *   FeeAmount.HIGH; // 1%
 */
export enum FeeAmount {
  LOWEST = 100,
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const feeAmountGen: Arbitrary<FeeAmount> = fc.constantFrom(
  FeeAmount.LOWEST,
  FeeAmount.LOW,
  FeeAmount.MEDIUM,
  FeeAmount.HIGH,
);
