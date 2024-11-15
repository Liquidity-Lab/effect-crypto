import { Effect } from "effect";
import { Contract } from "ethers";
import { Tagged } from "type-fest";



import { Address } from "@liquidity_lab/effect-crypto";



import type * as T from "./pool.js";


const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/uniswap#privateApi");

type PoolInitializerContract = Tagged<Contract, "POOL_INITIALIZER_CONTRACT">;
type PoolFactoryContract = Tagged<Contract, "POOL_FACTORY_CONTRACT">;

interface PoolTxPrivateApi {
  // readonly poolInitializerAddress: T.PoolInitializerAddress;
  // readonly poolFactoryAddress: T.PoolFactoryContractAddress;
  readonly poolInitializerContract: PoolInitializerContract;
  readonly poolFactoryContract: PoolFactoryContract;
}

interface PoolTxShape {
  [privateApiSymbol]: PoolTxPrivateApi;
}

export class PoolTxTag extends Effect.Tag("PoolTxTag")<PoolTxTag, PoolTxShape>() {}
