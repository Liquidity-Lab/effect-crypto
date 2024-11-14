import { ConfigError, Context, Effect, Layer } from "effect";
import { Signer } from "ethers";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import * as Deploy from "~/deploy.js";
import * as BError from "~/error.js";
import * as internal from "~/testEnv.internal.js";
import * as Token from "~/token.js";
import * as Wallet from "~/wallet.js";

export { TestEnvTag as Tag } from "~/testEnv.internal.js";
export { Weth9DeployTag as Weth9DeployTag } from "~/testEnv.internal.js";
export { UsdcLabsDeployTag as UsdcLabsDeployTag } from "~/testEnv.internal.js";
export { TestEnvDeployTag as DeployTxTag } from "~/testEnv.internal.js";

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
 *   import { TestEnv } from "~/com/liquidity_lab/crypto/blockchain";
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
    tag: Context.Tag.Identifier<Tag> extends internal.TestEnvDeployContracts ? Tag : never,
  ): Effect.Effect<
    Deploy.DeployedContract,
    Adt.FatalError | BError.BlockchainError,
    internal.TestEnvTag
  >;
  <Tag extends Context.Tag<any, Deploy.DeployedContract>>(
    service: Context.Tag.Service<internal.TestEnvTag>,
    tag: Context.Tag.Identifier<Tag> extends internal.TestEnvDeployContracts ? Tag : never,
  ): Effect.Effect<Deploy.DeployedContract, Adt.FatalError | BError.BlockchainError>;
} = internal.deploy;

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
