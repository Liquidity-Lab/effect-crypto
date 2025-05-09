import { Brand, Effect, Either, Function, Layer, Option } from "effect";
import { RuntimeException } from "effect/Cause";
import { Interface, Log, LogDescription } from "ethers";
import { Arbitrary } from "fast-check";
import fc from "fast-check";

import {
  Address,
  BigMath,
  Chain,
  Error,
  FatalError,
  Token,
  Wallet,
  addressGen,
  isZeroAddress,
  toHex,
} from "@liquidity_lab/effect-crypto";
import { BrandUtils, EffectUtils, FunctionUtils } from "@liquidity_lab/effect-crypto/utils";
import IUniswapV3Factory from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json" with { type: "json" };
import IUniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json" with { type: "json" };
import IPoolInitializer from "@uniswap/v3-periphery/artifacts/contracts/interfaces/IPoolInitializer.sol/IPoolInitializer.json" with { type: "json" };

import * as Adt from "./adt.js";
import type * as T from "./pool.js";
import * as Price from "./price.js";
import * as Tick from "./tick.js";
import { feeAmountGen } from "./adt.internal.js";
import { Slot0Price } from "./pool.js";

/** @internal */
export const liquidityConstructor = Brand.nominal<T.Liquidity>();

/** @internal */
export type PoolInitializerAddressTypeId =
  "@liquidity_lab/effect-crypto-uniswap/pool#poolInitializerAddress";
/** @internal */
export const poolInitializerAddressConstructor = Brand.nominal<T.PoolInitializerAddress>();

/** @internal */
export type PoolInitializerContractTypeId =
  "@liquidity_lab/effect-crypto-uniswap/pool#poolInitializerContract";
/** @internal */
export const poolInitializerContractConstructor = Brand.nominal<T.PoolInitializerContract>();

/** @internal */
export type PositionManagerAddressTypeId =
  "@liquidity_lab/effect-crypto-uniswap/pool#positionManagerAddress";
/** @internal */
export const positionManagerAddressConstructor = Brand.nominal<T.PositionManagerAddress>();

/** @internal */
export type PoolFactoryAddressTypeId =
  "@liquidity_lab/effect-crypto-uniswap/pool#poolFactoryAddress";
/** @internal */
export const poolFactoryAddressConstructor = Brand.nominal<T.PoolFactoryAddress>();

/** @internal */
export type PoolFactoryContractTypeId =
  "@liquidity_lab/effect-crypto-uniswap/pool#poolFactoryContract";
/** @internal */
export const poolFactoryContractConstructor = Brand.nominal<T.PoolFactoryContract>();

/** @internal */
export type SwapRouterAddressTypeId = "@liquidity_lab/effect-crypto-uniswap/pool#swapRouterAddress";
/** @internal */
export const swapRouterAddressConstructor = Brand.nominal<T.SwapRouterAddress>();

/** @internal */
export class PoolsTag extends Effect.Tag("com/liquidity_lab/crypto/blockchain/uniswap#PoolsTag")<
  PoolsTag,
  T.PoolsDescriptor
>() {}

/** @internal */
export function makePoolsFromDescriptor(descriptor: T.PoolsDescriptor): Layer.Layer<PoolsTag> {
  return Layer.succeed(PoolsTag, descriptor);
}

/** @internal */
export const createAndInitializePoolIfNecessary = FunctionUtils.withOptionalServiceApi(
  // TODO: use FunctionUtils only in module
  PoolsTag,
  createAndInitializePoolIfNecessaryImpl,
).value;

function createAndInitializePoolIfNecessaryImpl(
  descriptor: T.PoolsDescriptor,
  price: Price.AnyTokenPrice,
  fee: Adt.FeeAmount,
): Effect.Effect<
  Option.Option<T.Slot0Price>,
  Error.BlockchainError | Error.TransactionFailedError | FatalError,
  Wallet.Tag
> {
  const iPoolInitializer = new Interface(IPoolInitializer.abi);
  const iUniswapV3Pool = new Interface(IUniswapV3Pool.abi);

  return Effect.gen(function* () {
    const wallet = yield* Wallet.Tag;

    const sqrtX96ratio = yield* Option.match(BigMath.convertToQ64x96(Price.asSqrt(price)), {
      onNone: Function.constant(
        Effect.fail(
          FatalError(
            new RuntimeException(
              `Unable to calculate sqrt of the price[${Price.prettyPrint(price)}]`,
            ),
          ),
        ),
      ),
      onSome: (price) => Effect.succeed(price),
    });

    yield* Effect.log(`Preferred pool sqrtRatioX96 ${sqrtX96ratio}`);

    const callData = iPoolInitializer.encodeFunctionData("createAndInitializePoolIfNecessary", [
      price.token0.address,
      price.token1.address,
      fee.valueOf(),
      toHex(sqrtX96ratio),
    ]);
    const transactionRequest = {
      data: callData,
      to: descriptor.poolInitializerAddress,
      from: wallet.address,
    };
    const receipt = yield* Wallet.transact(wallet, transactionRequest);
    const res = extractActualPrice(receipt.logs).pipe(
      Either.mapLeft(
        (errors) =>
          `Unable to extract actual price from receipt.logs, due to: ${BrandUtils.stringifyBrandErrors(errors)}`,
      ),
    );

    return yield* EffectUtils.getOrFailSimpleEither(res);
  });

  /**
   * Extracts the Slot0Price from transaction logs
   *
   * @param logs - Transaction logs to parse
   * @returns An Either containing:
   *   - Right(None): If no Initialize event was found in logs
   *   - Right(Some(Slot0Price)): If the Initialize event was found and parsed successfully
   *   - Left(BrandErrors): If parsing failed (e.g., invalid price or tick format)
   * @internal
   */
  function extractActualPrice(
    logs: ReadonlyArray<Log>,
  ): Either.Either<Option.Option<Slot0Price>, Brand.Brand.BrandErrors> {
    const parsedLogs = logs
      .map((log) => Either.try(() => iUniswapV3Pool.parseLog(log)))
      .filter(Either.isRight)
      .map((log) => log.right)
      .filter((log): log is LogDescription => !!log);

    const initializeEventLog = Option.fromNullable(
      parsedLogs.find((logEntry) => logEntry.name === "Initialize"),
    );

    return Option.match(initializeEventLog, {
      onNone: () => Either.right(Option.none()),
      onSome: (initializeEventLogEntry) =>
        Either.gen(function* () {
          const [sqrtPriceX96Str, tick] = initializeEventLogEntry.args;

          const sqrtPriceX96 = yield* BigMath.Q64x96.either(sqrtPriceX96Str);
          const actualPrice = yield* Price.makeFromSqrtQ64_96(
            price.baseCurrency,
            price.quoteCurrency,
            sqrtPriceX96,
          ).pipe(Either.mapLeft(Brand.error));

          const actualTick = yield* Tick.Tick.either(tick);

          return Option.some({
            price: actualPrice,
            tick: actualTick,
          });
        }),
    });
  }
}

/** @internal */
export function fetchPoolStateImpl(
  descriptor: T.PoolsDescriptor,
  tokenA: Token.AnyToken,
  tokenB: Token.AnyToken,
  fee: Adt.FeeAmount,
): Effect.Effect<Option.Option<T.PoolState>, FatalError | Error.BlockchainError, Chain.Tag> {
  return Effect.gen(function* () {
    const [token0, token1] = [tokenA, tokenB].sort(Token.order);
    const iUniswapV3Factory = new Interface(IUniswapV3Factory.abi);

    const poolFactoryContract = (yield* Chain.contractInstance(
      descriptor.poolFactoryAddress,
      iUniswapV3Factory,
    )).withOnChainRunner;
    const poolAddressRaw: string = yield* Effect.promise(() =>
      poolFactoryContract.getPool.staticCall(token0.address, token1.address, fee.valueOf()),
    );
    const poolAddress = yield* EffectUtils.getOrFailEither(Address(poolAddressRaw));

    if (isZeroAddress(poolAddress)) {
      return Option.none();
    }

    return Option.some({
      token0,
      token1,
      fee,
      address: poolAddress,
    } as T.PoolState);
  });
}

/** @internal */
export function poolStateGenImpl(): Arbitrary<T.PoolState> {
  // Token.tokenPairGen already returns tokens in Uniswap order (token0.address < token1.address)
  return Token.tokenPairGen(Token.TokenType.ERC20).chain(([token0, token1]) => {
    return fc.record({
      token0: fc.constant(token0),
      token1: fc.constant(token1),
      fee: feeAmountGen,
      address: addressGen(),
    });
  });
}
