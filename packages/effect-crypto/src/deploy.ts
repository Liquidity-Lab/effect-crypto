import { Context, Effect, Either, Layer, Pipeable, Types } from "effect";
import { Interface, InterfaceAbi } from "ethers";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import * as internal from "~/deploy.internal.js";
import * as BError from "~/error.js";
import * as Wallet from "~/wallet.js";

/** This type represents low level arguments that will be passed to the contract factory
 *  to deploy new contract instance to the blockchain
 */
export type DeployArgs = [
  abi: Interface | InterfaceAbi,
  bytecode: string,
  args: ReadonlyArray<unknown>,
];

/** This type represents a contract deployed to the blockchain, so
 * it contains an address and bytecode of the contract
 */
export interface DeployedContract {
  readonly address: Adt.Address;
  readonly bytecode: string; // TODO: separate type for bytecode
}

/**
 * It might return either an args of the contract that will be deployed later
 * or an address of the already deployed contract from context
 */
export type DeployFn<Rf> = (
  ctx: Context.Context<Rf>,
) => Either.Either<DeployArgs, DeployedContract>;

/**
 * ContractDescriptor is a type that describes a contract that will be deployed:
 *  - it has a function that will be used to deploy the contract, just a pure function
 *  - it may have some dependencies that should be deployed first
 */
export interface ContractDescriptor {
  readonly f: DeployFn<any>;
  readonly deps: ReadonlyArray<Context.Tag<any, DeployedContract>>;
}

/**
 * This is a type that describes an entire blockchain layout for deploying purposes.
 * It is very useful when you want to test your code against a local blockchain like hardhat
 *
 * @typeParam R0 - This is a type that describes the dependencies of the blockchain layout
 *                 e.g. DeployDescriptor<MyTokenA | MyTokenB>
 */
export interface DeployDescriptor<in R0> extends Pipeable.Pipeable {
  readonly [internal.MTypeId]: {
    readonly _Services: Types.Contravariant<R0>;
  };

  readonly unsafeMap: Map<string, ContractDescriptor>;
}

/**
 * Creates an empty DeployDescriptor
 *
 * @constructor
 */
export const DeployDescriptorEmpty: () => DeployDescriptor<never> = internal.emptyDeployDescriptor;

/**
 * Adds a deployable contract to the descriptorю
 * This API has two variants:
 *  - `dataLast` adds a contract to the end of the descriptor
 *  - `dataFirst` adds a contract to the beginning of the descriptor
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
  /**
   * @example
   *   import { Deploy } from "@liquidity_lab/effect-crypto";
   *
   *   class MyContractLibraryTag extends Context.Tag("MyContractLibraryTag")<MyContractLibraryTag, {}>() {}
   *   class MyContractTag extends Context.Tag("MyContract")<MyContractTag, {}>() {}
   *
   *   const libraryDescriptor = Deploy.addDeployable.dataLast(
   *     Deploy.DeployDescriptor(), // Creates empty descriptor
   *     [], // <-- This is the list of dependencies
   *   )(MyContractLibraryTag, () => { // <-- The tag of the contract to deploy
   *     // This is the factory function that will be called when the descriptor is used
   *     // It should return the bytecode of the contract
   *     return Either.right([MyContractLibrary.abi, MyContractLibrary.bytecode, []]);
   *   });
   *
   *   const descriptor = Deploy.addDeployable.dataLast(
   *     libraryDescriptor, // <-- The library descriptor
   *     [MyContractLibraryTag], // <-- The list of dependencies
   *   )(MyContractTag, () => { // <-- The tag of the contract to deploy
   *     // This is the factory function that will be called when the descriptor is used
   *     // It should return the bytecode of the contract
   *     return Either.right([MyContract.abi, MyContract.bytecode, []]);
   *   });
   */
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

  /**
   * It best to use this function together with `.pipe`
   *
   * @example
   *   import { Deploy } from "@liquidity_lab/effect-crypto";
   *
   *   class MyContractLibraryTag extends Context.Tag("MyContractLibraryTag")<MyContractLibraryTag, Deploy.DeployedContract>() {}
   *   class MyContractTag extends Context.Tag("MyContract")<MyContractTag, Deploy.DeployedContract>() {}
   *
   *   const descriptor = Deploy.DeployDescriptor().pipe(
   *     Deploy.addDeployable.dataFirst([])(MyContractLibraryTag, () => {
   *       return Either.right([MyContractLibrary.abi, MyContractLibrary.bytecode, []]);
   *     }),
   *     Deploy.addDeployable.dataFirst([MyContractLibraryTag])(MyContractTag, (ctx) => {
   *       const bytecode = linkLibrary(MyContractLibrary.bytecode, {
   *         "contracts/libraries/MyContractLibrary.sol": Context.get(ctx, MyContractLibraryTag).address,
   *       });
   *
   *       return Either.right([MyContract.abi, bytecode, []]);
   *     }),
   *   );
   */
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

/** This is a type that describes a DeployShape. Normally you should use it to create a tag for your deploy layout
 *
 * @example
 *   import { Deploy } from "@liquidity_lab/effect-crypto";
 *
 *   class MyContractLibraryTag extends Context.Tag("MyContractLibraryTag")<MyContractLibraryTag, Deploy.DeployShape>() {}
 *   class MyContractTag extends Context.Tag("MyContract")<MyContractTag, Deploy.DeployShape>() {}
 *
 *   type Layout = MyContractLibraryTag | MyContractTag;
 *
 *   class MyDeployTag extends Context.Tag("MyDeployTag")<MyDeployTag, Deploy.DeployLayout<Layout>>() {}
 */
export type DeployLayout<R0> = internal.DeployShape<R0>;

/**
 * This interface defines an API of parametrized Deploy Module.
 * You can create deploy module for your own blockchain layout
 */
export interface DeployModuleApi<R0, Tag extends Context.Tag<any, DeployLayout<R0>>> {
  /** This is a descriptor of the blockchain layout. Contains data about all available contracts,
   * how to deploy them and their dependencies
   */
  readonly descriptor: DeployDescriptor<R0>;

  /**
   * This is a layer that provides a DeployLayout tag instance based on a DeployDescriptor.
   * Use this to provide in a context:
   *
   * @example
   *   import { Context, Effect, Layer } from "effect";
   *   import { Deploy } from "@liquidity_lab/effect-crypto";
   *
   *   class MyContractLibraryTag extends Context.Tag("MyContractLibraryTag")<MyContractLibraryTag, Deploy.DeployedContract>() {}
   *   class MyContractTag extends Context.Tag("MyContract")<MyContractTag, Deploy.DeployedContract>() {}
   *
   *   type Layout = MyContractLibraryTag | MyContractTag;
   *
   *   const descriptor: Deploy.DeployDescriptor<Layout> = null as any;
   *
   *   class MyDeployTag extends Context.Tag("MyDeployTag")<MyDeployTag, Deploy.DeployLayout<Layout>>() {}
   *   const deployModule: Deploy.DeployModuleApi<Layout, MyDeployTag> = null as any
   *
   *   const prog: Effect.Effect<any, never, MyDeployTag> = null as any;
   *
   *
   *   // Here we provide an instance of deploy module
   *   Effect.provide(prog, deployModule.layer);
   *
   */
  readonly layer: Layer.Layer<Context.Tag.Identifier<Tag>, never, Wallet.Tag>;

  /**
   * Use this function to deploy any contract from your layout.
   * You don't need to care about dependencies, they will be resolved and deployed automatically
   *
   * @example
   *   import { Context, Effect } from "effect";
   *   import { Deploy } from "@liquidity_lab/effect-crypto";
   *
   *   class MyContractLibraryTag extends Context.Tag("MyContractLibraryTag")<MyContractLibraryTag, Deploy.DeployedContract>() {}
   *   class MyContractTag extends Context.Tag("MyContract")<MyContractTag, Deploy.DeployedContract>() {}
   *
   *   type Layout = MyContractLibraryTag | MyContractTag;
   *
   *   class MyDeployTag extends Context.Tag("MyDeployTag")<MyDeployTag, Deploy.DeployLayout<Layout>>() {}
   *   const deployModule: Deploy.DeployModuleApi<Layout, MyDeployTag> = null as any;
   *
   *   const prog = Effect.gen(function* () {
   *     // This will deploy MyContractLibrary, then MyContract and provide its data to `deployedContract`
   *     const deployedContract = yield* deployModule.deploy(MyContractTag);
   *   });
   *
   *   prog.pipe(
   *     Effect.provide(deployModule.layer),
   *   );
   */
  deploy<UnitTag extends Context.Tag<any, DeployedContract>>(
    tag: Context.Tag.Identifier<UnitTag> extends R0 ? UnitTag : never,
  ): Effect.Effect<
    DeployedContract,
    Adt.FatalError | BError.BlockchainError,
    Context.Tag.Identifier<Tag> | Chain.Tag
  >;
}

/**
 * This is the constructor for DeployModuleApi.
 *
 * In case you want to create a deployment module with incorrect tag (R0 are different),
 * it will infer type of the `tag` as `never` so your code will not compile
 *
 * @example
 *   import { Deploy } from "@liquidity_lab/effect-crypto";
 *
 *   class MyContractLibraryTag extends Context.Tag("MyContractLibraryTag")<MyContractLibraryTag, Deploy.DeployedContract>() {}
 *   class MyContractTag extends Context.Tag("MyContract")<MyContractTag, Deploy.DeployedContract>() {}
 *   class MyOtherContractTag extends Context.Tag("MyOtherContract")<MyOtherContractTag, Deploy.DeployedContract>() {}
 *
 *   type Layout = MyContractLibraryTag | MyContractTag;
 *
 *   const descriptor: Deploy.DeployDescriptor<Layout> = null as any;
 *
 *   class MyDeployTag extends Context.Tag("MyDeployTag")<MyDeployTag, Deploy.DeployLayout<Layout | MyOtherContractTag>>() {}
 *
 *   // ERROR: Type 'MyOtherContractTag' is missing in descriptor
 *   const deployModule: Deploy.DeployModuleApi<Layout, MyDeployTag> = Deploy.DeployModuleApi(descriptor);
 *
 * @constructor
 */
export const DeployModuleApi: <R0>(descriptor: DeployDescriptor<R0>) => <
  Tag extends Context.Tag<any, DeployLayout<R0>>,
>(
  tag: Context.Tag.Service<Tag> extends DeployLayout<infer R1> ?
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
