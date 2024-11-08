import { Context, Effect, Either, Pipeable, Ref, Types } from "effect";
import { pipeArguments } from "effect/Pipeable";
import { Interface, InterfaceAbi } from "ethers";
import { Tagged } from "type-fest";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import type * as T from "~/deploy.js";
import * as BError from "~/error.js";
import * as EffectUtils from "~/utils/effectUtils.js";
import * as Wallet from "~/wallet.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/deploy#privateApi");

export type DeployArgs = [
  abi: Interface | InterfaceAbi,
  bytecode: string,
  args: ReadonlyArray<unknown>,
];

/**
 * It might return either an args of the contract that will be deployed later
 * or an address of the already deployed contract from context
 */
export type DeployFn<Rf> = (
  ctx: Context.Context<Rf>,
) => Either.Either<DeployArgs, T.DeployedContract>;

type DepsToContextV1<Deps extends readonly Context.Tag<any, any>[]> =
  Deps extends [] ? never
  : {
      [K in keyof Deps]: Deps[K] extends Context.Tag<infer Id, any> ? Id : never;
    }[number];

export type DepsToContext<Deps extends readonly Context.Tag<any, any>[]> =
  Deps extends [] ? never : Context.Tag.Identifier<Deps[number]>;

// type DeployDescriptor<R0> = [R0] extends [never] ? DeployDescriptorEmpty : DeployDescriptorForTag<R0>;

export const MTypeId = Symbol("com/liquidity_lab/crypto/blockchain/deploy#TypeId");

// Custom error type
interface TypeError<Message extends string> {
  __type_error__: Message;
}

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

type AddDeployableUnitArgs<R0, Deps> = [T.DeployDescriptor<R0>, Deps] | [Deps];

export const addDeployableUnit = <R0, Deps extends readonly Context.Tag<any, any>[]>(
  ...args: [T.DeployDescriptor<R0>, Deps] | [Deps]
) => {
  function isFullArgs(
    args: [T.DeployDescriptor<R0>, Deps] | [Deps],
  ): args is [T.DeployDescriptor<R0>, Deps] {
    return args.length === 2;
  }

  return isFullArgs(args) ?
      addDeployableUnitDataLast(args[0], args[1])
    : addDeployableUnitDataFirst(args[0]);
};

export function addDeployableUnitDataLast<R0, Deps extends readonly Context.Tag<any, any>[]>(
  descriptor: T.DeployDescriptor<R0>,
  deps: Deps,
) {
  type DepsIdentifiers = DepsToContext<Deps>;

  return function <Tag extends Context.Tag<any, any>, Rf extends DepsIdentifiers = DepsIdentifiers>(
    tag: [Rf] extends [never] ? Tag
    : DepsIdentifiers extends R0 ? Tag
    : never,
    f: DeployFn<Rf>,
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
      f: DeployFn<Rf>,
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
  f: DeployFn<Rf>,
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

function addDeployableUnitImpl<R0, Deps extends readonly Context.Tag<any, any>[]>(
  descriptor: T.DeployDescriptor<R0>,
  deps: Deps,
) {
  type DepsIdentifiers = DepsToContext<Deps>;

  return function <Tag extends Context.Tag<any, any>, Rf extends DepsIdentifiers = DepsIdentifiers>(
    tag: [Rf] extends [never] ? Tag
    : DepsIdentifiers extends R0 ? Tag
    : never,
    f: DeployFn<Rf>,
  ): T.DeployDescriptor<R0 | Context.Tag.Identifier<Tag>> {
    // Update unsafeMap
    const newMap = new Map("unsafeMap" in descriptor ? descriptor.unsafeMap : undefined);
    newMap.set(tag.key, {
      f,
      deps: deps,
    });

    return {
      [MTypeId]: {
        _Services: ((_: unknown) => _) as Types.Contravariant<R0 | Context.Tag.Identifier<Tag>>,
      },
      unsafeMap: newMap,
    } as T.DeployDescriptor<R0 | Context.Tag.Identifier<Tag>>;
  };
}

interface DeployState {
  readonly unsafeDeployedModules: Map<string, T.DeployedContract>;
}

interface DeployTxPrivateApi<R0> {
  deployModule<Tag extends Context.Tag<any, T.DeployedContract>>(
    tag: Tag extends R0 ? Tag : never,
  ): Effect.Effect<T.DeployedContract, Adt.FatalError | BError.BlockchainError, Chain.TxTag>;
}

export interface DeployTxShape<R0> {
  readonly [privateApiSymbol]: DeployTxPrivateApi<R0>;
}

export interface DeployShape<R0, Tag extends Context.Tag<any, DeployTxShape<R0>>> {
  transact<A, E, R>(
    fa: Effect.Effect<A, E, R | Context.Tag.Identifier<Tag>>,
  ): Effect.Effect<A, E | BError.BlockchainError, Exclude<R, Context.Tag.Identifier<Tag>> | Wallet.TxTag>;
}

function appendModuleToState(
  ref: Ref.Ref<DeployState>,
  unsafeTagValue: string,
  deployedModule: T.DeployedContract,
): Effect.Effect<T.DeployedContract> {
  return ref.modify((state) => {
    const unsafeDeployedModules = new Map(state.unsafeDeployedModules);

    unsafeDeployedModules.set(unsafeTagValue, deployedModule);

    return [deployedModule, { unsafeDeployedModules } as DeployState];
  });
}

function deployContact(
  walletTx: Context.Tag.Service<Wallet.TxTag>,
  deployArgs: DeployArgs,
): Effect.Effect<T.DeployedContract, Adt.FatalError | BError.BlockchainError, Chain.TxTag> {
  return Effect.gen(function* () {
    const contractOps = yield* Wallet.deployContract(...deployArgs).pipe(
      Effect.provideService(Wallet.TxTag, walletTx),
    );
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

class DeployLive<R0, Tag extends Context.Tag<any, DeployTxShape<R0>>>
  implements DeployShape<R0, Tag>
{
  private readonly txTag: Context.Tag<any, DeployTxShape<R0>>;
  private readonly descriptor: T.DeployDescriptor<R0>;

  constructor(txTag: Context.Tag<any, DeployTxShape<R0>>, descriptor: T.DeployDescriptor<R0>) {
    this.txTag = txTag;
    this.descriptor = descriptor;
  }

  transact<A, E, R>(
    fa: Effect.Effect<A, E, R | Context.Tag.Identifier<Tag>>,
  ): Effect.Effect<
    A,
    E | BError.BlockchainError,
    Exclude<R, Context.Tag.Identifier<Tag>> | Wallet.TxTag
  > {
    const { txTag } = this;
    const toTx = this.toTx.bind(this);

    return Effect.gen(function* () {
      const walletTx = yield* Wallet.TxTag;

      const stateRef = yield* Ref.make<DeployState>({
        unsafeDeployedModules: new Map(),
      });

      const tx = toTx(stateRef, walletTx);

      return yield* Effect.provideService(fa, txTag, tx);
    });
  }

  private toTx(
    ref: Ref.Ref<DeployState>,
    walletTx: Context.Tag.Service<Wallet.TxTag>,
  ): DeployTxShape<R0> {
    const unsafeDeployModule = this.unsafeDeployModule.bind(this);

    function deployModule<Tag extends Context.Tag<any, T.DeployedContract>>(
      tag: Tag extends R0 ? Tag : never,
    ): Effect.Effect<T.DeployedContract, Adt.FatalError | BError.BlockchainError, Chain.TxTag> {
      return unsafeDeployModule(ref, tag.key, walletTx);
    }

    return {
      [privateApiSymbol]: {
        deployModule,
      },
    };
  }

  private unsafeDeployModule(
    ref: Ref.Ref<DeployState>,
    unsafeTagValue: string,
    walletTx: Context.Tag.Service<Wallet.TxTag>,
  ): Effect.Effect<T.DeployedContract, Adt.FatalError | BError.BlockchainError, Chain.TxTag> {
    const { descriptor } = this;
    const thisFunction = this.unsafeDeployModule.bind(this);

    return Effect.gen(function* () {
      const state = yield* ref.get;
      const maybeModule = state.unsafeDeployedModules.get(unsafeTagValue);

      if (maybeModule) {
        return maybeModule;
      }

      const { f: deployFn, deps: requiredDeps } = yield* EffectUtils.getOrFailEither(
        getModuleDescriptor(descriptor, unsafeTagValue),
      );

      const context = yield* Effect.reduce(
        requiredDeps,
        Context.empty() as Context.Context<any>,
        (ctx, tag) =>
          Effect.gen(function* () {
            const deployedModule = yield* thisFunction(ref, tag.key, walletTx);

            return Context.add(ctx, tag, deployedModule);
          }),
      );

      const moduleOrDeployArgs = deployFn(context);

      return yield* Either.match(moduleOrDeployArgs, {
        onLeft: (deployedModule) => appendModuleToState(ref, unsafeTagValue, deployedModule),
        onRight: (args) =>
          deployContact(walletTx, args).pipe(
            Effect.flatMap((deployedContract) =>
              appendModuleToState(ref, unsafeTagValue, deployedContract),
            ),
          ),
      });
    });
  }
}

// TODO: this is just a PoC, rename
class DeployModuleApiLive<R0> implements T.DeployModuleApi<R0> {
  readonly txTag: Context.Tag<any, DeployTxShape<R0>>;
  readonly descriptor: T.DeployDescriptor<R0>;

  constructor(descriptor: T.DeployDescriptor<R0>) {
    class DeployTxTag extends Context.Tag("DeployTxTag")<DeployTxTag, DeployTxShape<R0>>() {}

    this.descriptor = descriptor;
    this.txTag = DeployTxTag;
  }

  deploy<Tag extends Context.Tag<any, T.DeployedContract>>(
    tag: Tag extends R0 ? Tag : never,
  ): Effect.Effect<void, Adt.FatalError | BError.BlockchainError, typeof this.txTag> {
    const { txTag } = this;

    return Effect.gen(function* () {
      const { [privateApiSymbol]: api } = yield* txTag;

      yield* api.deployModule(tag);
    });
  }
}

export function makeDeployModule<R0>(descriptor: T.DeployDescriptor<R0>) {
  // This is an module API
  return new DeployModuleApiLive(descriptor);
}

function getModuleDescriptor<R0>(
  descriptor: T.DeployDescriptor<R0>,
  unsafeTagValue: string,
): Either.Either<T.ModuleDescriptor, Adt.FatalError> {
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
