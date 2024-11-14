import {
  Config,
  ConfigError,
  Context,
  Effect,
  Function as EffectFunction,
  Layer,
  Option,
} from "effect";
import {
  Addressable,
  BaseWallet,
  Contract,
  type ContractRunner,
  Interface,
  type InterfaceAbi,
  JsonRpcProvider,
  Network,
  Networkish,
} from "ethers";

import type * as T from "~/chain.js";
import * as Error from "~/error.js";
import * as Signature from "~/signature.js";
import * as FunctionUtils from "~/utils/functionUtils.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/chain#privateApi");

export function asChainId(id: bigint): T.ChainId {
  return id as T.ChainId;
}

export const knownChains = {
  MAINNET: asChainId(1n),
  GOERLI: asChainId(5n),
  SEPOLIA: asChainId(11155111n),
  OPTIMISM: asChainId(10n),
  OPTIMISM_GOERLI: asChainId(420n),
  OPTIMISM_SEPOLIA: asChainId(11155420n),
  ARBITRUM_ONE: asChainId(42161n),
  ARBITRUM_GOERLI: asChainId(421613n),
  ARBITRUM_SEPOLIA: asChainId(421614n),
  POLYGON: asChainId(137n),
  POLYGON_MUMBAI: asChainId(80001n),
  CELO: asChainId(42220n),
  CELO_ALFAJORES: asChainId(44787n),
  GNOSIS: asChainId(100n),
  MOONBEAM: asChainId(1284n),
  BNB: asChainId(56n),
  AVALANCHE: asChainId(43114n),
  BASE_GOERLI: asChainId(84531n),
  BASE: asChainId(8453n),
  ZORA: asChainId(7777777n),
  ZORA_SEPOLIA: asChainId(999999999n),
  ROOTSTOCK: asChainId(30n),
  BLAST: asChainId(81457n),
};

interface ChainPrivateApi {
  readonly provider: JsonRpcProvider;
}

interface ChainShape {
  readonly [privateApiSymbol]: ChainPrivateApi;
}

export class ChainTag extends Context.Tag("ChainTag")<ChainTag, ChainShape>() {}

interface ConfigShape {
  readonly rpcUrl: string;
  readonly chain: Networkish;
}

export class ConfigTag extends Context.Tag("ChainConfigTag")<ConfigTag, ConfigShape>() {}

export function makeChainFromConfig(): Layer.Layer<ChainTag, never, ConfigTag> {
  return Layer.context<ConfigTag>().pipe(
    Layer.project(ConfigTag, ChainTag, (config) => ({
      [privateApiSymbol]: {
        provider: new JsonRpcProvider(config.rpcUrl, config.chain),
      },
    })),
  );
}

class ConfigLive implements ConfigShape {
  readonly rpcUrl: string;
  readonly chain: Networkish;

  constructor(rpcUrl: string, chain: Networkish) {
    this.rpcUrl = rpcUrl;
    this.chain = chain;
  }
}

export function configFromEnv(): Layer.Layer<ConfigTag, ConfigError.ConfigError> {
  return Layer.effect(
    ConfigTag,
    Config.map(
      Config.all([
        Config.option(Config.string("APP_RPC_URL")),
        Config.option(Config.string("APP_CHAIN_NAME")),
      ]),
      ([rpcUrlOpt, chainName]) => {
        const DEFAULT_URL = EffectFunction.constant("localhost:8545");
        const DEFAULT_NETWORK = EffectFunction.constant(undefined);

        return new ConfigLive(
          Option.getOrElse(rpcUrlOpt, DEFAULT_URL),
          Option.getOrElse(chainName, DEFAULT_NETWORK) as Networkish,
        );
      },
    ),
  );
}

export const getChainId = FunctionUtils.withOptionalServiceApi(ChainTag, getChainIdImpl).value;

function getChainIdImpl({ [privateApiSymbol]: api }: ChainShape): Effect.Effect<T.ChainId> {
  return Effect.gen(function* () {
    const network: Network = yield* Effect.promise(() => api.provider.getNetwork());

    return asChainId(network.chainId);
  });
}

export const contractInstance = FunctionUtils.withOptionalServiceApi(
  ChainTag,
  contractInstanceImpl,
).value;

function contractInstanceImpl(
  { [privateApiSymbol]: api }: ChainShape,
  target: string | Addressable,
  abi: Interface | InterfaceAbi,
): Signature.ContractOps {
  return Signature.ContractOps(api.provider, (runner) => new Contract(target, abi, runner));
}

export const connectWallet = FunctionUtils.withOptionalServiceApi(
  ChainTag,
  connectWalletImpl,
).value;

function connectWalletImpl(
  { [privateApiSymbol]: api }: ChainShape,
  wallet: BaseWallet,
): BaseWallet {
  return wallet.connect(api.provider);
}

export const contractOps = FunctionUtils.withOptionalServiceApi(ChainTag, contractOpsImpl).value;

function contractOpsImpl(
  { [privateApiSymbol]: api }: ChainShape,
  f: (runner: ContractRunner | null) => Contract,
): Signature.ContractOps {
  return Signature.ContractOps(api.provider, f);
}

export const send = FunctionUtils.withOptionalServiceApi(ChainTag, sendImpl).value;

function sendImpl(
  { [privateApiSymbol]: api }: ChainShape,
  method: string,
  params: Array<unknown> | Record<string, unknown>,
): Effect.Effect<unknown, Error.BlockchainError> {
  return Error.catchBlockchainErrors(Effect.promise(() => api.provider.send(method, params)));
}
