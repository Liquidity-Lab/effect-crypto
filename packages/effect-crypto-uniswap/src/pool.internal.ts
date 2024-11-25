import { Brand, Effect, Either, Function, Layer, Option, Order } from "effect";
import { RuntimeException } from "effect/Cause";
import { fromNullable } from "effect/Option";
import { AbiCoder, Contract, Interface, LogDescription } from "ethers";

import {
  Address,
  Chain,
  Error,
  FatalError,
  Token,
  Wallet,
  toHex, isZeroAddress
} from "@liquidity_lab/effect-crypto";
import { EffectUtils, FunctionUtils } from "@liquidity_lab/effect-crypto/utils";
import IUniswapV3Factory from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json";
import IUniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import IPoolInitializer from "@uniswap/v3-periphery/artifacts/contracts/interfaces/IPoolInitializer.sol/IPoolInitializer.json";

import * as Adt from "./adt.js";
import type * as T from "./pool.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/uniswap#privateApi");

const poolInitializerAddressSymbol = Symbol(
  "com/liquidity_lab/crypto/blockchain/uniswap#poolInitializerAddress",
);
export type PoolInitializerAddressSymbol = typeof poolInitializerAddressSymbol;
export const makePoolInitializerAddress = Brand.nominal<T.PoolInitializerAddress>();

const poolInitializerContractSymbol = Symbol(
  "com/liquidity_lab/crypto/blockchain/uniswap#poolInitializerContract",
);
export type PoolInitializerContractSymbol = typeof poolInitializerContractSymbol;
export const makePoolInitializerContract = Brand.nominal<T.PoolInitializerContract>();

const poolFactoryAddressSymbol = Symbol(
  "com/liquidity_lab/crypto/blockchain/uniswap#poolFactoryAddress",
);
export type PoolFactoryAddressSymbol = typeof poolFactoryAddressSymbol;
export const makePoolFactoryAddress = Brand.nominal<T.PoolFactoryAddress>();

const poolFactoryContractSymbol = Symbol(
  "com/liquidity_lab/crypto/blockchain/uniswap#poolFactoryContract",
);
export type PoolFactoryContractSymbol = typeof poolFactoryContractSymbol;
export const makePoolFactoryContract = Brand.nominal<T.PoolFactoryContract>();

const swapRouterAddressSymbol = Symbol(
  "com/liquidity_lab/crypto/blockchain/uniswap#swapRouterAddress",
);
export type SwapRouterAddressSymbol = typeof swapRouterAddressSymbol;
export const makeSwapRouterAddress = Brand.nominal<T.SwapRouterAddress>();

interface PoolPrivateApi extends T.PoolsDescriptor {
  // readonly poolInitializerAddress: T.PoolInitializerAddress;
  // readonly poolFactoryAddress: T.PoolFactoryContractAddress;
  // readonly poolInitializerContract: T.PoolInitializerContract;
  // readonly poolFactoryContract: T.PoolFactoryContract;
}

interface PoolShape {
  [privateApiSymbol]: PoolPrivateApi;
}

export class PoolsTag extends Effect.Tag("com/liquidity_lab/crypto/blockchain/uniswap#PoolsTag")<
  PoolsTag,
  PoolShape
>() {}

export function makePoolsFromDescriptor(descriptor: T.PoolsDescriptor): Layer.Layer<PoolsTag> {
  return Layer.succeed(PoolsTag, {
    [privateApiSymbol]: {
      poolInitializerAddress: descriptor.poolInitializerAddress,
      poolFactoryAddress: descriptor.poolFactoryAddress,
      swapRouterAddress: descriptor.swapRouterAddress,
    },
  });
}

export const createAndInitializePoolIfNecessary = FunctionUtils.withOptionalServiceApi(
  PoolsTag,
  createAndInitializePoolIfNecessaryImpl,
).value;

function createAndInitializePoolIfNecessaryImpl(
  { [privateApiSymbol]: api }: PoolShape,
  price: Token.AnyTokenPrice,
  fee: Adt.FeeAmount,
): Effect.Effect<
  Option.Option<T.Slot0Price>,
  Error.BlockchainError | Error.TransactionFailedError | FatalError,
  Wallet.Tag
> {
  return Effect.gen(function* () {
    const wallet = yield* Wallet.Tag;
    const iPoolInitializer = new Interface(IPoolInitializer.abi);
    const iUniswapV3Pool = new Interface(IUniswapV3Pool.abi);

    const sqrtX96ratio = yield* Option.match(price.asSqrtX96, {
      onNone: Function.constant(
        Effect.fail(
          FatalError(
            new RuntimeException(`Unable to calculate sqrt of the price[${price.prettyPrint}]`),
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
      to: api.poolInitializerAddress,
      from: wallet.address,
    };

    const receipt = yield* Wallet.transact(wallet, transactionRequest);
    const parsedLogs = receipt.logs
      .map((log) => Either.try(() => iUniswapV3Pool.parseLog(log)))
      .filter(Either.isRight)
      .map((log) => log.right)
      .filter((log): log is LogDescription => !!log);

    const initializeEventLog = Option.fromNullable(
      parsedLogs.find((logEntry) => logEntry.name === "Initialize"),
    );

    return Option.map(initializeEventLog, (initializeEventLog) => {
      const [sqrtPriceX96, tick] = initializeEventLog.args;

      const actualPrice = Token.TokenPriceSqrtX96(price.token0, price.token1, sqrtPriceX96);
      const actualTick = Adt.Tick(tick);

      return {
        price: actualPrice,
        tick: actualTick,
      };
    });
  });
}

export function fetchPoolStateImpl(
  { [privateApiSymbol]: api }: PoolShape,
  tokenA: Token.AnyToken,
  tokenB: Token.AnyToken,
  fee: Adt.FeeAmount,
): Effect.Effect<Option.Option<T.PoolState>, FatalError | Error.BlockchainError, Chain.Tag> {
  return Effect.gen(function* () {
    const [token0, token1] = [tokenA, tokenB].sort(Token.order);
    const iUniswapV3Factory = new Interface(IUniswapV3Factory.abi);

    const poolFactoryContract = (yield* Chain.contractInstance(
      api.poolFactoryAddress,
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
