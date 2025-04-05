import { Tagged } from "type-fest";

import * as internal from "./uniswap.internal.js";

export { UniswapTxTag as TxTag } from "./uniswap.internal.js";
export { UniswapTag as Tag } from "./uniswap.internal.js";

export type PoolFactoryContractAddress = Tagged<string, "POOL_FACTORY_CONTRACT_ADDRESS">;
export type QuoterContractAddress = Tagged<string, "QUOTER_CONTRACT_ADDRESS">;
export type SwapRouterContractAddress = Tagged<string, "SWAP_ROUTER_CONTRACT_ADDRESS">;
export type PositionManagerContractAddress = Tagged<string, "POSITION_MANAGER_CONTRACT_ADDRESS">;

/**
 * Uniswap V3 descriptor: contains addresses of contracts which are used to interact with Uniswap
 */
export interface UniswapV3Descriptor {
  readonly poolFactoryAddress: PoolFactoryContractAddress;
  readonly quoterAddress: QuoterContractAddress;
  readonly swapRouterAddress: SwapRouterContractAddress;
  readonly positionManagerAddress: PositionManagerContractAddress;
}
