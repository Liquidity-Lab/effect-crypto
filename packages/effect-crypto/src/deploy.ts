import { Context, Effect, Pipeable, Types } from "effect";
import { getAddress, solidityPackedKeccak256 } from "ethers";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import * as internal from "~/deploy.internal.js";
import * as BError from "~/error.js";
import * as Token from "~/token.js";
import * as Wallet from "~/wallet.js";
import { DeployFn, MTypeId } from "~/deploy.internal.js";

export interface DeployedContract {
  readonly address: Adt.Address;
  readonly bytecode: string;
}

export interface ModuleDescriptor {
  readonly f: DeployFn<any>;
  readonly deps: ReadonlyArray<Context.Tag<any, DeployedContract>>;
}

export interface DeployDescriptor<in R0> extends Pipeable.Pipeable {
  readonly [MTypeId]: {
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
  readonly dataLast: <R0, Deps extends readonly Context.Tag<any, any>[]>(
    descriptor: DeployDescriptor<R0>,
    deps: Deps,
  ) => <
    Tag extends Context.Tag<any, any>,
    Rf extends internal.DepsToContext<Deps> = internal.DepsToContext<Deps>,
  >(
    tag: [Rf] extends [never] ? Tag
    : internal.DepsToContext<Deps> extends R0 ? Tag
    : never,
    f: internal.DeployFn<Rf>,
  ) => DeployDescriptor<R0 | Context.Tag.Identifier<Tag>>;

  readonly dataFirst: <Deps extends readonly Context.Tag<any, any>[]>(
    deps: Deps,
  ) => <
    Tag extends Context.Tag<any, any>,
    Rf extends internal.DepsToContext<Deps> = internal.DepsToContext<Deps>,
  >(
    tag: Tag,
    f: internal.DeployFn<Rf>,
  ) => <R0>(
    descriptor: [Rf] extends [never] ? DeployDescriptor<R0>
    : internal.DepsToContext<Deps> extends R0 ? DeployDescriptor<R0>
    : never,
  ) => DeployDescriptor<R0 | Context.Tag.Identifier<Tag>>;
} = {
  dataLast: internal.addDeployableUnitDataLast,
  dataFirst: internal.addDeployableUnitDataFirst,
};

export interface DeployModuleApi<R0> {
  readonly txTag: Context.Tag<any, internal.DeployTxShape<R0>>;
  readonly descriptor: DeployDescriptor<R0>;

  deploy<Tag extends Context.Tag<any, any>>(
    tag: Tag extends R0 ? Tag : never,
  ): Effect.Effect<
    void,
    Adt.FatalError | BError.BlockchainError,
    Context.Tag<any, internal.DeployTxShape<R0>>
  >;
}

export const makeDeployApi: <R0>(descriptor: DeployDescriptor<R0>) => DeployModuleApi<R0> =
  internal.makeDeployModule;

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
export function linkLibrary(
  bytecode: string,
  libraries: {
    [name: string]: string;
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

export function tokensDeploy(): Effect.Effect<
  Token.TokensDescriptor,
  Adt.FatalError | BError.BlockchainError,
  Chain.TxTag | Wallet.TxTag
> {
  function deployHelper<T extends Token.TokenType.Wrapped | Token.TokenType.ERC20>(
    meta: Token.TokenMetaShape<T>,
    deployArgs: Adt.DeployArgs,
  ): Effect.Effect<
    Token.Token<T>,
    Adt.FatalError | BError.BlockchainError,
    Chain.TxTag | Wallet.TxTag
  > {
    return Effect.gen(function* () {
      const contractOps = yield* Wallet.deployContract(...deployArgs);
      const erc20Token = yield* Token.fetchErc20TokenDataFromContract(
        contractOps.withOnChainRunner,
      );

      yield* Effect.logDebug(`Deployed [${erc20Token.symbol}] at [${erc20Token.address}]`);

      return Token.Token(
        erc20Token.address,
        erc20Token.decimals,
        erc20Token.symbol,
        erc20Token.name,
        meta,
      );
    });
  }

  return Effect.gen(function* () {
    const eth = Token.nativeETHToken;

    const weth9 = yield* deployHelper<Token.TokenType.Wrapped>(
      Token.WrappedTokenMeta(eth),
      Token.deployArgs.WETH,
    );
    // const ethLabs = yield* deployHelper(deployETHLabs());
    const usdcLabs = yield* deployHelper<Token.TokenType.ERC20>(
      Token.Erc20TokenMeta(),
      Token.deployArgs.USDC,
    );

    return {
      ETH: eth,
      WETH: weth9,
      USDC: usdcLabs,
    };
  });
}
