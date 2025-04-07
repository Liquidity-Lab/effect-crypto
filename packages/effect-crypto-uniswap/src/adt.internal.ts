import { Big, BigDecimal, MathContext } from "bigdecimal.js";
import { Brand } from "effect";
import { Arbitrary } from "fast-check";

import { fc } from "@fast-check/ava";

import type * as T from "./adt.js";

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

/**
 * Max uint256
 */
const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");


export type Amount0TypeId = "com/liquidity_lab/crypto/blockchain/uniswap#amount0";

export const makeAmount0 = Brand.refined<T.Amount0>(verifyAmount, (rawAmount) => {
  return Brand.error(
    `Amount unscaled value should be in range [0, ${MAX_UINT256}], but given[${rawAmount}]`,
  );
});

export const MAX_AMOUNT_0: T.Amount0 = makeAmount0(Big(MAX_UINT256));

export const amount0Gen = (constraints?: { min?: T.Amount0; max?: T.Amount0 }) =>
  amountGen({
    min: constraints?.min?.toBigInt(),
    max: constraints?.max?.toBigInt(),
  }).map(makeAmount0);


export type Amount1TypeId = "com/liquidity_lab/crypto/blockchain/uniswap#amount1";

export const makeAmount1 = Brand.refined<T.Amount1>(verifyAmount, (rawAmount) => {
  return Brand.error(
    `Amount should be in range [0, ${MAX_UINT256}], but given[${rawAmount.unscaledValue()}]`,
  );
});

export const MAX_AMOUNT_1: T.Amount1 = makeAmount1(Big(MAX_UINT256));

export const amount1Gen = (constraints?: { min?: T.Amount1; max?: T.Amount1 }) =>
  amountGen({
    min: constraints?.min?.toBigInt(),
    max: constraints?.max?.toBigInt(),
  }).map(makeAmount1);

function amountGen(constraints: { min?: bigint; max?: bigint }): Arbitrary<BigDecimal> {
  const min = constraints.min ?? 0n;
  const max = constraints.max && verifyAmount(Big(constraints.max)) ? constraints.max : MAX_UINT256;

  return fc
    .bigInt(min, max)
    .chain((unscaled) =>
      fc
        .nat(unscaled.toString().length - 1)
        .map((scale) =>
          Big(unscaled).divideWithMathContext(10n ** BigInt(scale), MathContext.DECIMAL128),
        ),
    )
    .map((value) => value.min(Big(max)));
}

function verifyAmount(rawAmount: BigDecimal): boolean {
  return rawAmount.greaterThanOrEquals(0) && rawAmount.toBigInt() <= MAX_UINT256;
}
