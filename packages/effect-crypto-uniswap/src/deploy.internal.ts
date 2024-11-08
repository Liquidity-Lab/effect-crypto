import { Context, Either } from "effect";
import { encodeBytes32String } from "ethers";

import { Deploy } from "@liquidity_lab/effect-crypto";
import UniswapV3Factory from "@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json";
import NonfungiblePositionManager from "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json";
import NonfungibleTokenPositionDescriptor from "@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json";
import SwapRouter from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json";
import QuoterV2 from "@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json";
import NFTDescriptor from "@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json";

export class PoolFactoryDeploy extends Context.Tag("PoolFactoryDeploy")<
  PoolFactoryDeploy,
  Deploy.DeployedContract
>() {}

export class RouterDeploy extends Context.Tag("RouterDeploy")<
  RouterDeploy,
  Deploy.DeployedContract
>() {}

export class NonfungiblePositionManagerDeploy extends Context.Tag(
  "NonfungiblePositionManagerDeploy",
)<NonfungiblePositionManagerDeploy, Deploy.DeployedContract>() {}

// TODO: Move it the core package
export class WETH9Deploy extends Context.Tag("WETH9Deploy")<
  WETH9Deploy,
  Deploy.DeployedContract
>() {}

export class NftDescriptorLibraryDeploy extends Context.Tag("NftDescriptorLibraryDeploy")<
  NftDescriptorLibraryDeploy,
  Deploy.DeployedContract
>() {}

export class UniswapQuoterV2Deploy extends Context.Tag("UniswapQuoterV2Deploy")<
  UniswapQuoterV2Deploy,
  Deploy.DeployedContract
>() {}

export class NonfungibleTokenPositionDescriptorDeploy extends Context.Tag(
  "NonfungibleTokenPositionDescriptorDeploy",
)<NonfungibleTokenPositionDescriptorDeploy, Deploy.DeployedContract>() {}

const tmp = Deploy.addDeployable.dataFirst([])(WETH9Deploy, () => null as any);

const tmp0 = Deploy.addDeployable.dataFirst([])(PoolFactoryDeploy, () => {
  return Either.right([UniswapV3Factory.abi, UniswapV3Factory.bytecode, []]);
});

const tmp1 = Deploy.addDeployable.dataFirst([])(NftDescriptorLibraryDeploy, () => {
  return Either.right([NFTDescriptor.abi, NFTDescriptor.bytecode, []]);
});

const tmp2 = Deploy.addDeployable.dataFirst([WETH9Deploy, NftDescriptorLibraryDeploy])(
  NonfungibleTokenPositionDescriptorDeploy,
  (ctx) => {
    const linkedBytecode = Deploy.linkLibrary(NonfungibleTokenPositionDescriptor.bytecode, {
      "contracts/libraries/NFTDescriptor.sol:NFTDescriptor": Context.get(
        ctx,
        NftDescriptorLibraryDeploy,
      ).bytecode,
    });
    const nativeCurrencyLabelBytes = encodeBytes32String("WETH");

    return Either.right([
      NonfungibleTokenPositionDescriptor.abi,
      linkedBytecode,
      [Context.get(ctx, WETH9Deploy).address, nativeCurrencyLabelBytes],
    ]);
  },
);

// RouterDeploy
const tmp3 = Deploy.addDeployable.dataFirst([WETH9Deploy, PoolFactoryDeploy])(
  RouterDeploy,
  (ctx) => {
    const factoryAddress = Context.get(ctx, PoolFactoryDeploy).address;
    const weth9Address = Context.get(ctx, WETH9Deploy).address;

    return Either.right([SwapRouter.abi, SwapRouter.bytecode, [factoryAddress, weth9Address]]);
  },
);

// NonfungiblePositionManagerDeploy
const tmp4 = Deploy.addDeployable.dataFirst([
  WETH9Deploy,
  PoolFactoryDeploy,
  NonfungibleTokenPositionDescriptorDeploy,
])(NonfungiblePositionManagerDeploy, (ctx) => {
  const factoryAddress = Context.get(ctx, PoolFactoryDeploy).address;
  const weth9Address = Context.get(ctx, WETH9Deploy).address;
  const positionDescriptorAddress = Context.get(ctx, NonfungibleTokenPositionDescriptorDeploy);

  return Either.right([
    NonfungiblePositionManager.abi,
    NonfungiblePositionManager.bytecode,
    [factoryAddress, weth9Address, positionDescriptorAddress],
  ]);
});

// UniswapQuoterV2Deploy
const tmp5 = Deploy.addDeployable.dataFirst([WETH9Deploy, PoolFactoryDeploy])(
  UniswapQuoterV2Deploy,
  (ctx) => {
    const factoryAddress = Context.get(ctx, PoolFactoryDeploy).address;
    const weth9Address = Context.get(ctx, WETH9Deploy).address;

    return Either.right([QuoterV2.abi, QuoterV2.bytecode, [factoryAddress, weth9Address]]);
  },
);

const descriptor: Deploy.DeployDescriptor<
  | PoolFactoryDeploy
  | RouterDeploy
  | NonfungiblePositionManagerDeploy
  | WETH9Deploy
  | NftDescriptorLibraryDeploy
  | UniswapQuoterV2Deploy
  | NonfungibleTokenPositionDescriptorDeploy
> = Deploy.DeployDescriptor().pipe(tmp, tmp0, tmp1, tmp2, tmp3, tmp4, tmp5);

export const deployApi: Deploy.DeployModuleApi<
  | PoolFactoryDeploy
  | RouterDeploy
  | NonfungiblePositionManagerDeploy
  | WETH9Deploy
  | NftDescriptorLibraryDeploy
  | UniswapQuoterV2Deploy
  | NonfungibleTokenPositionDescriptorDeploy
> = Deploy.makeDeployApi(descriptor);
