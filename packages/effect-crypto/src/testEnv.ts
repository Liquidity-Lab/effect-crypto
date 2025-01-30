import { ConfigError, Context, Effect, Layer } from "effect";
import { Signer } from "ethers";

import * as Adt from "./adt.js";
import * as Chain from "./chain.js";
import * as Deploy from "./deploy.js";
import * as BError from "./error.js";
import * as internal from "./testEnv.internal.js";
import * as Token from "./token.js";
import * as FunctionUtils from "./utils/functionUtils.js";
import * as Wallet from "./wallet.js";

export { TestEnvTag as Tag } from "./testEnv.internal.js";
export { Weth9DeployTag as Weth9DeployTag } from "./testEnv.internal.js";
export { UsdcLabsDeployTag as UsdcDeployTag } from "./testEnv.internal.js";
export { UsdtLabsDeployTag as UsdtDeployTag } from "./testEnv.internal.js";
export { TestEnvDeployTag as DeployTag } from "./testEnv.internal.js";

export const setBalanceFor: {
  (
    address: Adt.Address,
    balance: bigint,
  ): Effect.Effect<void, BError.BlockchainError, internal.TestEnvTag>;
  (
    service: Context.Tag.Service<internal.TestEnvTag>,
    address: Adt.Address,
    balance: bigint,
  ): Effect.Effect<void, BError.BlockchainError, internal.TestEnvTag>;
} = internal.setBalanceFor;

export const setBalance: {
  (
    balance: bigint,
  ): Effect.Effect<
    void,
    Adt.FatalError | BError.BlockchainError,
    internal.TestEnvTag | Wallet.Tag | Chain.Tag
  >;
  (
    service: Context.Tag.Service<internal.TestEnvTag>,
    balance: bigint,
  ): Effect.Effect<void, Adt.FatalError | BError.BlockchainError, Wallet.Tag | Chain.Tag>;
  tapOnLayer: (
    balance: bigint,
  ) => (
    ctx: Context.Context<internal.TestEnvTag | Wallet.Tag | Chain.Tag>,
  ) => Effect.Effect<void, Adt.FatalError | BError.BlockchainError>;
} = internal.setBalance;

/**
 * Adds nonce management to the signer
 */
export const withNonceManagement: {
  (signer: Signer): Effect.Effect<Signer, never, internal.TestEnvTag>;
  (service: Context.Tag.Service<internal.TestEnvTag>, signer: Signer): Effect.Effect<Signer>;
} = internal.withNonceManagement;

/**
 * Creates a new layer with TestEnv instance
 *
 * @example
 *   import { Context, Effect, Layer } from "effect";
 *   import { TestEnv } from "./com/liquidity_lab/crypto/blockchain";
 *
 *   const testEnv: Context.Tag.Service<TestEnv.Tag> = ???;
 *   const effect: Effect.Effect<any, never, TestEnv.TxTag> = ???;
 *   const prog: Effect.Effect<any, never, Chain.Tag> = TestEvn.transact(effect);
 */
export const testEnvLayer: () => Layer.Layer<
  internal.TestEnvTag | Wallet.Tag,
  ConfigError.ConfigError | Adt.FatalError,
  Chain.Tag
> = internal.testEnvLayer;

/** Use this function to get a wallet for on-hardhat testing purposes.
 * The resulting wallet will contain nonce management feature
 */
export const predefinedHardhatWallet: {
  (): Layer.Layer<Wallet.Tag, ConfigError.ConfigError | Adt.FatalError, internal.TestEnvTag>;
} = internal.predefinedHardhatWallet;

/**
 * Provides low-level access to the deployment API for test environments.
 * Use this to access deployment-related functionality directly or create custom deployment flows.
 *
 * @example
 *   import { TestEnv } from "@liquidity_lab/effect-crypto";
 *
 *   // Access deployment capabilities
 *   const program = Effect.gen(function*() {
 *     const api = TestEnv.deployApi;
 *
 *     // Deploy using the shared deployment state
 *     yield* api.deploy(TestEnv.Weth9DeployTag);
 *
 *     // Create a new deployment layer
 *     const layer = api.layer;
 *
 *     // Share deployment state with another module
 *     yield* api.shareDeployState(otherModule);
 *   });
 */
export const deployApi: Deploy.DeployModuleApi<
  internal.TestEnvDeployLayout,
  typeof internal.TestEnvDeployTag
> = internal.deployApi;

/**
 * Use this function to deploy contracts for testing purposes
 *
 * @example
 *   import { Context, Effect, Layer } from "effect";
 *   import { TestEnv } from "@liquidity_lab/effect-crypto";
 *
 *   const deploy = Effect.gen(function* () {
 *     const weth9 = yield* TestEnv.deploy(TestEnv.Weth9DeployTag);
 *     const usdcLabs = yield* TestEnv.deploy(TestEnv.UsdcLabsDeployTag);
 *
 *     yield* Effect.log(`Deployed WETH9: ${weth9.address}`);
 *     yield* Effect.log(`Deployed USDCLabs: ${usdcLabs.address}`);
 *   });
 */
export const deploy: {
  <Tag extends Context.Tag<any, Deploy.DeployedContract>>(
    tag: Context.Tag.Identifier<Tag> extends internal.TestEnvDeployLayout ? Tag : never,
  ): Effect.Effect<
    Deploy.DeployedContract,
    Adt.FatalError | BError.BlockchainError,
    internal.TestEnvTag
  >;
  <Tag extends Context.Tag<any, Deploy.DeployedContract>>(
    service: Context.Tag.Service<internal.TestEnvTag>,
    tag: Context.Tag.Identifier<Tag> extends internal.TestEnvDeployLayout ? Tag : never,
  ): Effect.Effect<Deploy.DeployedContract, Adt.FatalError | BError.BlockchainError>;
} = FunctionUtils.withOptionalServiceApi(internal.TestEnvTag, internal.deployImpl).value;

/**
 * Use this function to deploy tokens for testing purposes
 * It will deploy *Labs tokens
 */
export const tokensDeploy: {
  (): Effect.Effect<
    Token.TokensDescriptor,
    Adt.FatalError | BError.BlockchainError,
    internal.TestEnvTag
  >;
  (
    service: Context.Tag.Service<internal.TestEnvTag>,
  ): Effect.Effect<Token.TokensDescriptor, Adt.FatalError | BError.BlockchainError>;
} = internal.tokensDeploy;

/**
 * Use this layer to deploy tokens along with obtaining Tokens service
 */
export const tokensLayer: () => Layer.Layer<
  Token.Tag,
  Adt.FatalError | BError.BlockchainError,
  internal.TestEnvTag | Chain.Tag
> = internal.tokensLayer;

/**
 * Use this function to wire a state of your deploy module to the TestEnv's underlying deploy module
 */
export const sharedDeploy: {
  <R0, Tag extends Context.Tag<any, Deploy.DeployLayout<R0>>>(
    module: Deploy.DeployModuleApi<R0, Tag>,
  ): Layer.Layer<Context.Tag.Identifier<Tag>, never, Wallet.Tag | internal.TestEnvTag>;
} = internal.sharedDeploy;
