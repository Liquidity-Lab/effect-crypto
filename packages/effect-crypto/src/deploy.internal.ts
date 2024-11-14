import { Context, Effect, Either, Layer, Ref, Types } from "effect";
import { pipeArguments } from "effect/Pipeable";
import { getAddress, solidityPackedKeccak256 } from "ethers";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import type * as T from "~/deploy.js";
import * as BError from "~/error.js";
import * as EffectUtils from "~/utils/effectUtils.js";
import * as Wallet from "~/wallet.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/deploy#privateApi");

interface DeployPrivateApi<R0> {
  deployModule<Tag extends Context.Tag<any, T.DeployedContract>>(
    tag: Context.Tag.Identifier<Tag> extends R0 ? Tag : never,
  ): Effect.Effect<T.DeployedContract, Adt.FatalError | BError.BlockchainError, Chain.Tag>;
}

/** @internal */
export interface DeployShape<R0> {
  readonly [privateApiSymbol]: DeployPrivateApi<R0>;
}

/**
 * This is a type-helper that converts a list of tags to union
 *
 * @example
 *   class MyTag1 extends Context.Tag("MyTag1")<MyTag1, Deploy.DeployedContract>() {}
 *   class MyTag2 extends Context.Tag("MyTag2")<MyTag2, Deploy.DeployedContract>() {}
 *   class MyTag3 extends Context.Tag("MyTag3")<MyTag3, Deploy.DeployedContract>() {}
 *
 *   type TagList = [MyTag1, MyTag2, MyTag3];
 *   type MyDeps = DepsToContext<TagList>; // MyTag1 | MyTag2 | MyTag3
 *
 * @internal
 */
export type DepsToContext<Deps extends readonly Context.Tag<any, any>[]> =
  Deps extends [] ? never : Context.Tag.Identifier<Deps[number]>;

/** @internal */
export const MTypeId = Symbol("com/liquidity_lab/crypto/blockchain/deploy#TypeId");

export function emptyDeployDescriptor(): T.DeployDescriptor<never> {
  const instance: T.DeployDescriptor<never> = {
    [MTypeId]: {
      _Services: ((_: unknown) => _) as Types.Contravariant<never>,
    },
    unsafeMap: new Map(),

    pipe() {
      return pipeArguments(instance, arguments);
    },
  };

  return instance;
}

export function addDeployableUnitDataLast<R0, Deps extends readonly Context.Tag<any, any>[]>(
  descriptor: T.DeployDescriptor<R0>,
  deps: Deps,
) {
  type DepsIdentifiers = DepsToContext<Deps>;

  return function <Tag extends Context.Tag<any, any>, Rf extends DepsIdentifiers = DepsIdentifiers>(
    tag: [Rf] extends [never] ? Tag
    : DepsIdentifiers extends R0 ? Tag
    : never,
    f: T.DeployFn<Rf>,
  ): T.DeployDescriptor<R0 | Context.Tag.Identifier<Tag>> {
    // Update unsafeMap
    return addDeployableUnitImplV3(descriptor, deps, tag, f);
  };
}

export function addDeployableUnitDataFirst<Deps extends readonly Context.Tag<any, any>[]>(
  deps: Deps,
) {
  return <Tag extends Context.Tag<any, any>, Rf extends DepsToContext<Deps> = DepsToContext<Deps>>(
      tag: Tag,
      f: T.DeployFn<Rf>,
    ) =>
    <R0>(
      descriptor: [Rf] extends [never] ? T.DeployDescriptor<R0>
      : DepsToContext<Deps> extends R0 ? T.DeployDescriptor<R0>
      : never,
    ): T.DeployDescriptor<R0 | Context.Tag.Identifier<Tag>> => {
      return addDeployableUnitImplV3(descriptor, deps, tag, f);
    };
}

function addDeployableUnitImplV3<
  R0,
  Deps extends readonly Context.Tag<any, any>[],
  Tag extends Context.Tag<any, any>,
  Rf extends DepsToContext<Deps> = DepsToContext<Deps>,
>(
  descriptor: T.DeployDescriptor<R0>,
  deps: Deps,
  tag: Tag,
  f: T.DeployFn<Rf>,
): T.DeployDescriptor<R0 | Context.Tag.Identifier<Tag>> {
  const newMap = new Map("unsafeMap" in descriptor ? descriptor.unsafeMap : undefined);

  newMap.set(tag.key, {
    f,
    deps,
  });

  const instance: T.DeployDescriptor<R0 | Context.Tag.Identifier<Tag>> = {
    [MTypeId]: {
      _Services: ((_: unknown) => _) as Types.Contravariant<R0 | Context.Tag.Identifier<Tag>>,
    },
    unsafeMap: newMap,

    pipe() {
      return pipeArguments(instance, arguments);
    },
  } as T.DeployDescriptor<R0 | Context.Tag.Identifier<Tag>>;

  return instance;
}

interface DeployState {
  readonly unsafeDeployedModules: Map<string, T.DeployedContract>;
}

function deployContact(
  wallet: Context.Tag.Service<Wallet.Tag>,
  deployArgs: T.DeployArgs,
): Effect.Effect<T.DeployedContract, Adt.FatalError | BError.BlockchainError, Chain.Tag> {
  return Effect.gen(function* () {
    const contractOps = yield* Wallet.deployContract(wallet, ...deployArgs);
    const contract = contractOps.withOnChainRunner;

    const unsafeAddress = yield* Effect.promise(() => contract.getAddress());
    const address = yield* EffectUtils.getOrDieEither(Adt.Address(unsafeAddress));

    const bytecode = yield* Effect.promise(() => contract.getDeployedCode());

    if (bytecode === null) {
      return yield* Effect.fail(
        Adt.FatalErrorString("No bytecode was returned from the just deployed contract"),
      );
    }

    return {
      address,
      bytecode,
    } as T.DeployedContract;
  });
}

class DeployLive<R0> implements DeployShape<R0> {
  readonly [privateApiSymbol]: DeployPrivateApi<R0>;

  private readonly descriptor: T.DeployDescriptor<R0>;
  private readonly stateRef: Ref.Ref<DeployState>;
  private readonly wallet: Context.Tag.Service<Wallet.Tag>;

  constructor(
    descriptor: T.DeployDescriptor<R0>,
    stateRef: Ref.Ref<DeployState>,
    wallet: Context.Tag.Service<Wallet.Tag>,
  ) {
    this.descriptor = descriptor;
    this.stateRef = stateRef;
    this.wallet = wallet;

    const unsafeDeployModule = this.unsafeDeployModule.bind(this);

    function deployModule<Tag extends Context.Tag<any, T.DeployedContract>>(
      tag: Context.Tag.Identifier<Tag> extends R0 ? Tag : never,
    ): Effect.Effect<T.DeployedContract, Adt.FatalError | BError.BlockchainError, Chain.Tag> {
      return unsafeDeployModule(tag.key);
    }

    this[privateApiSymbol] = {
      deployModule,
    };
  }

  private unsafeDeployModule(
    unsafeTagValue: string,
  ): Effect.Effect<T.DeployedContract, Adt.FatalError | BError.BlockchainError, Chain.Tag> {
    const { descriptor, stateRef, wallet } = this;
    const thisFunction = this.unsafeDeployModule.bind(this);
    const appendModuleToState = this.appendModuleToState.bind(this);

    return Effect.gen(function* () {
      const state = yield* stateRef.get;
      const maybeModule = state.unsafeDeployedModules.get(unsafeTagValue);

      if (maybeModule) {
        return maybeModule;
      }

      // TODO: Add semaphore

      const { f: deployFn, deps: requiredDeps } = yield* EffectUtils.getOrFailEither(
        getModuleDescriptor(descriptor, unsafeTagValue),
      );

      const context = yield* Effect.reduce(
        requiredDeps,
        Context.empty() as Context.Context<any>,
        (ctx, tag) =>
          Effect.gen(function* () {
            const deployedModule = yield* thisFunction(tag.key);

            return Context.add(ctx, tag, deployedModule);
          }),
      );

      const moduleOrDeployArgs = deployFn(context);

      return yield* Either.match(moduleOrDeployArgs, {
        onLeft: (deployedModule) => appendModuleToState(unsafeTagValue, deployedModule),
        onRight: (args) =>
          deployContact(wallet, args).pipe(
            Effect.flatMap((deployedContract) =>
              appendModuleToState(unsafeTagValue, deployedContract),
            ),
          ),
      });
    });
  }

  private appendModuleToState(
    unsafeTagValue: string,
    deployedModule: T.DeployedContract,
  ): Effect.Effect<T.DeployedContract> {
    const { stateRef } = this;

    return stateRef.modify((state) => {
      const unsafeDeployedModules = new Map(state.unsafeDeployedModules);

      unsafeDeployedModules.set(unsafeTagValue, deployedModule);

      return [deployedModule, { unsafeDeployedModules } as DeployState];
    });
  }
}

class DeployModuleApiLive<R0, Tag extends Context.Tag<any, DeployShape<R0>>>
  implements T.DeployModuleApi<R0, Tag>
{
  readonly moduleTag: Tag;
  readonly descriptor: T.DeployDescriptor<R0>;

  constructor(descriptor: T.DeployDescriptor<R0>, moduleTag: Tag) {
    this.descriptor = descriptor;
    this.moduleTag = moduleTag;
  }

  deploy<Tag extends Context.Tag<any, T.DeployedContract>>(
    tag: Context.Tag.Identifier<Tag> extends R0 ? Tag : never,
  ): Effect.Effect<
    T.DeployedContract,
    Adt.FatalError | BError.BlockchainError,
    Context.Tag.Identifier<Tag> | Chain.Tag
  > {
    const { moduleTag } = this;

    return Effect.gen(function* () {
      const { [privateApiSymbol]: api } = yield* moduleTag;

      return yield* api.deployModule(tag);
    });
  }

  get layer(): Layer.Layer<Context.Tag.Identifier<Tag>, never, Wallet.Tag> {
    const { moduleTag, descriptor } = this;

    const makeLayer = Effect.gen(function* () {
      const wallet = yield* Wallet.Tag;
      const stateRef = yield* Ref.make<DeployState>({
        unsafeDeployedModules: new Map(),
      });

      return new DeployLive(descriptor, stateRef, wallet) as Context.Tag.Service<Tag>;
    });

    return Layer.effect(moduleTag, makeLayer);
  }
}

export function makeDeployModule<R0>(
  descriptor: T.DeployDescriptor<R0>,
): <Tag extends Context.Tag<any, DeployShape<R0>>>(tag: Tag) => T.DeployModuleApi<R0, Tag> {
  // This is an module API
  return (tag) => new DeployModuleApiLive(descriptor, tag);
}

export function linkLibrary(
  bytecode: string,
  libraries: {
    [name: string]: Adt.Address;
  } = {},
): string {
  let linkedBytecode = bytecode;

  for (const [name, address] of Object.entries(libraries)) {
    const placeholder = `__$${solidityPackedKeccak256(["string"], [name]).slice(2, 36)}$__`;
    const formattedAddress = getAddress(address).toLowerCase().replace("0x", "");
    if (linkedBytecode.indexOf(placeholder) === -1) {
      throw new Error(`Unable to find placeholder for library ${name}`);
    }
    while (linkedBytecode.indexOf(placeholder) !== -1) {
      linkedBytecode = linkedBytecode.replace(placeholder, formattedAddress);
    }
  }

  return linkedBytecode;
}

function getModuleDescriptor<R0>(
  descriptor: T.DeployDescriptor<R0>,
  unsafeTagValue: string,
): Either.Either<T.ContractDescriptor, Adt.FatalError> {
  const res = descriptor.unsafeMap.get(unsafeTagValue);

  return !res ?
      Either.left(
        Adt.FatalError(new Error(`Unable to find deployable module for tag[${unsafeTagValue}]`)),
      )
    : Either.right(res);
}

/*
function exampleIncorrectFlow() {
  class PoolFactory extends Context.Tag("PoolFactory")<PoolFactory, {}>() {}

  class PositionDescriptorLibrary extends Context.Tag("PositionDescriptorLibrary")<
    PositionDescriptorLibrary,
    {}
  >() {}

  class PositionDescriptor extends Context.Tag("PositionDescriptor")<PositionDescriptor, {}>() {}

  const d0: T.DeployDescriptor<never> = emptyDeployDescriptor();

  // R0 = never
  const d1 = addDeployableUnit<never>(d0)(
    PoolFactory,
    // @ts-expect-error unused
    (ctx: Context.Context<never>) => Either.left(Adt.Address.unsafe("0x123")),
  );

  // R0 = Context.Tag.Identifier<PoolFactory> | Context.Tag.Identifier<PositionDescriptorLibrary>
  const d2 = addDeployableUnit(d1)(
    PositionDescriptor,
    (ctx: Context.Context<PositionDescriptorLibrary>) => Either.left(Adt.Address.unsafe("0x789")),
  );

  // R0 = Context.Tag.Identifier<PoolFactory>
  const d3 = addDeployableUnit(d2)(
    PositionDescriptorLibrary,
    // @ts-expect-error unused
    (ctx: Context.Context<never>) => Either.left(Adt.Address.unsafe("0x456")),
  );

  return d3;
}
*/
