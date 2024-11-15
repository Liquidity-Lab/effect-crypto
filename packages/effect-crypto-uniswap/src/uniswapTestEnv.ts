import { Context, Effect, Layer } from "effect";

import {
  Error as BError,
  Chain,
  Deploy,
  FatalError,
  TestEnv,
  Wallet,
} from "@liquidity_lab/effect-crypto";

import * as internal from "./uniswapTestEnv.internal.js";

export { UniswapTestEnvTag as Tag } from "./uniswapTestEnv.internal.js";
export { PoolFactoryDeploy } from "./uniswapTestEnv.internal.js";
export { RouterDeploy } from "./uniswapTestEnv.internal.js";
export { NftDescriptorLibraryDeploy } from "./uniswapTestEnv.internal.js";
export { NonfungibleTokenPositionDescriptorDeploy } from "./uniswapTestEnv.internal.js";
export { NonfungiblePositionManagerDeploy } from "./uniswapTestEnv.internal.js";
export { PoolInitializerDeploy } from "./uniswapTestEnv.internal.js";
export { UniswapQuoterV2Deploy } from "./uniswapTestEnv.internal.js";

export const deploy: {
  <Tag extends Context.Tag<any, Deploy.DeployedContract>>(
    tag: Context.Tag.Identifier<Tag> extends internal.DeployLayout ? Tag : never,
  ): Effect.Effect<
    Deploy.DeployedContract,
    FatalError | BError.BlockchainError,
    internal.UniswapTestEnvTag
  >;
  <Tag extends Context.Tag<any, Deploy.DeployedContract>>(
    service: Context.Tag.Service<internal.UniswapTestEnvTag>,
    tag: Context.Tag.Identifier<Tag> extends internal.DeployLayout ? Tag : never,
  ): Effect.Effect<Deploy.DeployedContract, FatalError | BError.BlockchainError>;
} = internal.deploy;

export const uniswapTestEnvLayer: () => Layer.Layer<
  internal.UniswapTestEnvTag,
  never,
  TestEnv.Tag | Chain.Tag | Wallet.Tag
> = internal.uniswapTestEnvLayer;
