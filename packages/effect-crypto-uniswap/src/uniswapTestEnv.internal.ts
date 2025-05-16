import { Context, Effect, Either, Layer } from "effect";
import { encodeBytes32String } from "ethers";

import { Chain, Deploy, Error, FatalError, TestEnv, Wallet } from "@liquidity_lab/effect-crypto";
import UniswapV3Factory from "@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json" with { type: "json" };
import NonfungiblePositionManager from "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json" with { type: "json" };
import NonfungibleTokenPositionDescriptor from "@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json" with { type: "json" };
import SwapRouter from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json" with { type: "json" };
import QuoterV2 from "@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json" with { type: "json" };
import NFTDescriptor from "@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json" with { type: "json" };

import * as Pool from "./pool.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/uniswap/testEnv#privateApi");

/**
 * @see @see https://github.com/Uniswap/v3-core/blob/main/contracts/UniswapV3Factory.sol
 */
export class PoolFactoryDeploy extends Context.Tag(
  "com/liquidity_lab/crypto/uniswap/testEnv#PoolFactoryDeploy",
)<PoolFactoryDeploy, Deploy.DeployedContract>() {
  static descriptor = Deploy.addDeployable.dataFirst([])(PoolFactoryDeploy, () => {
    return Either.right([UniswapV3Factory.abi, UniswapV3Factory.bytecode, []]);
  });
}

/**
 * @see @see https://github.com/Uniswap/v3-periphery/blob/main/contracts/SwapRouter.sol
 */
export class SwapRouterDeploy extends Context.Tag(
  "com/liquidity_lab/crypto/uniswap/testEnv#SwapRouterDeploy",
)<SwapRouterDeploy, Deploy.DeployedContract>() {
  static descriptor = Deploy.addDeployable.dataFirst([TestEnv.Weth9DeployTag, PoolFactoryDeploy])(
    SwapRouterDeploy,
    (ctx) => {
      const factoryAddress = Context.get(ctx, PoolFactoryDeploy).address;
      const weth9Address = Context.get(ctx, TestEnv.Weth9DeployTag).address;

      return Either.right([SwapRouter.abi, SwapRouter.bytecode, [factoryAddress, weth9Address]]);
    },
  );
}

/**
 * @see https://github.com/Uniswap/v3-periphery/blob/main/contracts/NonfungibleTokenPositionDescriptor.sol
 */
export class NftDescriptorLibraryDeploy extends Context.Tag(
  "com/liquidity_lab/crypto/uniswap/testEnv#NftDescriptorLibraryDeploy",
)<NftDescriptorLibraryDeploy, Deploy.DeployedContract>() {
  static descriptor = Deploy.addDeployable.dataFirst([])(NftDescriptorLibraryDeploy, () => {
    return Either.right([NFTDescriptor.abi, NFTDescriptor.bytecode, []]);
  });
}

/**
 * @see https://github.com/Uniswap/v3-periphery/blob/main/contracts/NonfungibleTokenPositionDescriptor.sol
 */
export class NonfungibleTokenPositionDescriptorDeploy extends Context.Tag(
  "NonfungibleTokenPositionDescriptorDeploy",
)<NonfungibleTokenPositionDescriptorDeploy, Deploy.DeployedContract>() {
  static descriptor = Deploy.addDeployable.dataFirst([
    TestEnv.Weth9DeployTag,
    NftDescriptorLibraryDeploy,
  ])(NonfungibleTokenPositionDescriptorDeploy, (ctx) => {
    const linkedBytecode = Deploy.linkLibrary(NonfungibleTokenPositionDescriptor.bytecode, {
      "contracts/libraries/NFTDescriptor.sol:NFTDescriptor": Context.get(
        ctx,
        NftDescriptorLibraryDeploy,
      ).address,
    });
    const nativeCurrencyLabelBytes = encodeBytes32String("WETH");

    return Either.right([
      NonfungibleTokenPositionDescriptor.abi,
      linkedBytecode,
      [Context.get(ctx, TestEnv.Weth9DeployTag).address, nativeCurrencyLabelBytes],
    ]);
  });
}

/**
 * @see https://github.com/Uniswap/v3-periphery/blob/main/contracts/NonfungiblePositionManager.sol
 */
export class NonfungiblePositionManagerDeploy extends Context.Tag(
  "NonfungiblePositionManagerDeploy",
)<NonfungiblePositionManagerDeploy, Deploy.DeployedContract>() {
  static descriptor = Deploy.addDeployable.dataFirst([
    TestEnv.Weth9DeployTag,
    PoolFactoryDeploy,
    NonfungibleTokenPositionDescriptorDeploy,
  ])(NonfungiblePositionManagerDeploy, (ctx) => {
    const factoryAddress = Context.get(ctx, PoolFactoryDeploy).address;
    const weth9Address = Context.get(ctx, TestEnv.Weth9DeployTag).address;
    const positionDescriptorAddress = Context.get(
      ctx,
      NonfungibleTokenPositionDescriptorDeploy,
    ).address;

    return Either.right([
      NonfungiblePositionManager.abi,
      NonfungiblePositionManager.bytecode,
      [factoryAddress, weth9Address, positionDescriptorAddress],
    ]);
  });
}

/**
 * @see https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/IPoolInitializer.sol
 */
export class PoolInitializerDeploy extends Context.Tag(
  "com/liquidity_lab/crypto/uniswap/testEnv#PoolInitializerDeploy",
)<PoolInitializerDeploy, Deploy.DeployedContract>() {
  static descriptor = Deploy.addDeployable.dataFirst([NonfungiblePositionManagerDeploy])(
    PoolInitializerDeploy,
    (ctx) => {
      // NonfungiblePositionManager implements IPoolInitializer contract
      // @see https://github.com/Uniswap/v3-periphery/blob/main/contracts/NonfungiblePositionManager.sol
      return Either.left(Context.get(ctx, NonfungiblePositionManagerDeploy));
    },
  );
}

/**
 * @see https://github.com/Uniswap/v3-periphery/blob/main/contracts/lens/QuoterV2.sol
 */
export class UniswapQuoterV2Deploy extends Context.Tag(
  "com/liquidity_lab/crypto/uniswap/testEnv#UniswapQuoterV2Deploy",
)<UniswapQuoterV2Deploy, Deploy.DeployedContract>() {
  static descriptor = Deploy.addDeployable.dataFirst([TestEnv.Weth9DeployTag, PoolFactoryDeploy])(
    UniswapQuoterV2Deploy,
    (ctx) => {
      const factoryAddress = Context.get(ctx, PoolFactoryDeploy).address;
      const weth9Address = Context.get(ctx, TestEnv.Weth9DeployTag).address;

      return Either.right([QuoterV2.abi, QuoterV2.bytecode, [factoryAddress, weth9Address]]);
    },
  );
}

/** @internal */
export type DeployLayout =
  | TestEnv.Weth9DeployTag
  | PoolFactoryDeploy
  | SwapRouterDeploy
  | NonfungiblePositionManagerDeploy
  | PoolInitializerDeploy
  | NftDescriptorLibraryDeploy
  | UniswapQuoterV2Deploy
  | NonfungibleTokenPositionDescriptorDeploy;

const descriptor: Deploy.DeployDescriptor<DeployLayout> = Deploy.DeployDescriptorEmpty().pipe(
  TestEnv.Weth9DeployTag.descriptor,
  PoolFactoryDeploy.descriptor,
  NftDescriptorLibraryDeploy.descriptor,
  NonfungibleTokenPositionDescriptorDeploy.descriptor,
  NonfungiblePositionManagerDeploy.descriptor,
  PoolInitializerDeploy.descriptor,
  UniswapQuoterV2Deploy.descriptor,
  SwapRouterDeploy.descriptor,
);

export class DeployTag extends Context.Tag("com/liquidity_lab/crypto/uniswap/testEnv#DeployTag")<
  DeployTag,
  Deploy.DeployLayout<DeployLayout>
>() {}

export const deployApi = Deploy.DeployModuleApi(descriptor)(DeployTag);

interface UniswapTestEnvPrivateApi {
  readonly underlying: Context.Context<Chain.Tag | DeployTag>;
}

interface UniswapTestEnvShape {
  readonly [privateApiSymbol]: UniswapTestEnvPrivateApi;
}

export class UniswapTestEnvTag extends Context.Tag(
  "com/liquidity_lab/crypto/uniswap/testEnv#UniswapTestEnv",
)<UniswapTestEnvTag, UniswapTestEnvShape>() {}

export function deployImpl<Tag extends Context.Tag<any, Deploy.DeployedContract>>(
  { [privateApiSymbol]: api }: UniswapTestEnvShape,
  tag: Context.Tag.Identifier<Tag> extends DeployLayout ? Tag : never,
) {
  return Effect.provide(deployApi.deploy(tag), api.underlying);
}

export function uniswapTestEnvLayer(): Layer.Layer<
  UniswapTestEnvTag,
  never,
  TestEnv.Tag | Chain.Tag | Wallet.Tag
> {
  return Layer.context<TestEnv.Tag | Chain.Tag | Wallet.Tag>().pipe(
    Layer.provideMerge(TestEnv.sharedDeploy(deployApi)),
    Layer.map((ctx) => {
      const instance: UniswapTestEnvShape = {
        [privateApiSymbol]: {
          underlying: ctx, // TODO: Context.pick(DeployTag, Chain.Tag)(ctx),
        },
      };

      return Context.make(UniswapTestEnvTag, instance);
    }),
  );
}

export function poolDeployLayer(): Layer.Layer<
  Pool.Tag,
  FatalError | Error.BlockchainError,
  UniswapTestEnvTag
> {
  return Layer.unwrapEffect(
    Effect.gen(function* () {
      const uniswapTestEnv = yield* UniswapTestEnvTag;

      const poolFactoryAddress = Pool.PoolFactoryAddress(
        (yield* deployImpl(uniswapTestEnv, PoolFactoryDeploy)).address,
      );

      const poolInitializerAddress = Pool.PoolInitializerAddress(
        (yield* deployImpl(uniswapTestEnv, PoolInitializerDeploy)).address,
      );

      const swapRouterAddress = Pool.SwapRouterAddress(
        (yield* deployImpl(uniswapTestEnv, SwapRouterDeploy)).address,
      );

      const positionManagerAddress = Pool.PositionManagerAddress(
        (yield* deployImpl(uniswapTestEnv, NonfungiblePositionManagerDeploy)).address,
      );

      return Pool.poolsLayer({
        poolFactoryAddress,
        poolInitializerAddress,
        swapRouterAddress,
        positionManagerAddress,
      });
    }),
  );
}
