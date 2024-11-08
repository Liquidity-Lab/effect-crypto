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
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}