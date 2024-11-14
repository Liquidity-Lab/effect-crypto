import { Context, Effect, Either, Layer, Pipeable, Types } from "effect";
import { Interface, InterfaceAbi } from "ethers";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import * as internal from "~/deploy.internal.js";
import * as BError from "~/error.js";
import * as Wallet from "~/wallet.js";

export type DeployArgs = [
  abi: Interface | InterfaceAbi,
  bytecode: string,
  args: ReadonlyArray<unknown>,
];

// TODO: docs
export interface DeployedContract {
  readonly address: Adt.Address;
  readonly bytecode: string;
}

/**
 * It might return either an args of the contract that will be deployed later
 * or an address of the already deployed contract from context
 */
export type DeployFn<Rf> = (
  ctx: Context.Context<Rf>,
) => Either.Either<DeployArgs, DeployedContract>;

// TODO: rename to ContractDescriptor
export interface ModuleDescriptor {
  readonly f: DeployFn<any>;
  readonly deps: ReadonlyArray<Context.Tag<any, DeployedContract>>;
}

// TODO: docs
export interface DeployDescriptor<in R0> extends Pipeable.Pipeable {
  readonly [internal.MTypeId]: {
    readonly _Services: Types.Contravariant<R0>;
  };

  readonly unsafeMap: Map<string, ModuleDescriptor>;
}

export const DeployDescriptor: () => DeployDescriptor<never> = internal.emptyDeployDescriptor;

/**
 * Adds a deployable contract to the descriptor
 *
 * @example
 *   import { Deploy } from "@liquidity_lab/effect-crypto";
 *
 *   class MyContractLibraryTag extends Context.Tag("MyContract")<MyContractLibraryTag, {}>() {}
 *   class MyContractTag extends Context.Tag("MyContract")<MyContractTag, {}>() {}
 *
 *   const descriptor = Deploy.addDeployable.dataLast(
 *     Deploy.DeployDescriptor(), // Creates empty descriptor
 *     [], // <-- This is the list of dependencies
 *   )(MyContractLibraryTag, () => { // <-- The tag of the contract to deploy
 *     // This is the factory function that will be called when the descriptor is used
 *     // It should return the bytecode of the contract
 *   });
 */
export const addDeployable: {
  readonly dataLast: <R0, Deps extends readonly Context.Tag<any, DeployedContract>[]>(
    descriptor: DeployDescriptor<R0>,
    deps: Deps,
  ) => <
    Tag extends Context.Tag<any, DeployedContract>,
    Rf extends internal.DepsToContext<Deps> = internal.DepsToContext<Deps>,
  >(
    tag: [Rf] extends [never] ? Tag
    : internal.DepsToContext<Deps> extends R0 ? Tag
    : never,
    f: DeployFn<Rf>,
  ) => DeployDescriptor<R0 | Context.Tag.Identifier<Tag>>;

  readonly dataFirst: <Deps extends readonly Context.Tag<any, DeployedContract>[]>(
    deps: Deps,
  ) => <
    Tag extends Context.Tag<any, DeployedContract>,
    Rf extends internal.DepsToContext<Deps> = internal.DepsToContext<Deps>,
  >(
    tag: Tag,
    f: DeployFn<Rf>,
  ) => <R0>(
    descriptor: [Rf] extends [never] ? DeployDescriptor<R0>
    : internal.DepsToContext<Deps> extends R0 ? DeployDescriptor<R0>
    : never,
  ) => DeployDescriptor<R0 | Context.Tag.Identifier<Tag>>;
} = {
  dataLast: internal.addDeployableUnitDataLast,
  dataFirst: internal.addDeployableUnitDataFirst,
};

export type DeployShape<R0> = internal.DeployShape<R0>;

export interface DeployModuleApi<R0, Tag extends Context.Tag<any, internal.DeployShape<R0>>> {
  readonly descriptor: DeployDescriptor<R0>;

  readonly layer: Layer.Layer<Context.Tag.Identifier<Tag>, never, Wallet.Tag>;

  deploy<UnitTag extends Context.Tag<any, DeployedContract>>(
    tag: Context.Tag.Identifier<UnitTag> extends R0 ? UnitTag : never,
  ): Effect.Effect<
    DeployedContract,
    Adt.FatalError | BError.BlockchainError,
    Context.Tag.Identifier<Tag> | Chain.Tag
  >;
}

export const makeDeployApi: <R0>(descriptor: DeployDescriptor<R0>) => <
  Tag extends Context.Tag<any, internal.DeployShape<R0>>,
>(
  tag: Context.Tag.Service<Tag> extends internal.DeployShape<infer R1> ?
    [R1] extends [R0] ?
      Tag
    : never
  : never,
) => DeployModuleApi<R0, Tag> = internal.makeDeployModule;

/**
 * Links libraries deployed on the blockchain to the contract's bytecode
 *
 * @example
 *   const nftDescriptorLibraryAddress: string = "0x...";
 *   const linkedBytecode = linkLibrary(NonfungibleTokenPositionDescriptor.bytecode, {
 *     "contracts/libraries/NFTDescriptor.sol:NFTDescriptor": nftDescriptorLibraryAddress,
 *   });
 *
 * @param bytecode
 * @param libraries
 */
export const linkLibrary: (
  bytecode: string,
  libraries: {
    [name: string]: Adt.Address;
  },
) => string = internal.linkLibrary;
