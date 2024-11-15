import { Effect } from "effect";

import { Error } from "@liquidity_lab/effect-crypto";
import type * as T from "./uniswap.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/uniswap#privateApi");

interface UniswapTxPrivateApi {
  readonly config: T.UniswapV3Descriptor;
}

interface UniswapTxShape {
  readonly [privateApiSymbol]: UniswapTxPrivateApi;
}

/**
 * A tag for effects which interact with Uniswap.
 */
export class UniswapTxTag extends Effect.Tag("UniswapTxTag")<UniswapTxTag, UniswapTxShape>() {}

interface UniswapShape {
  readonly [privateApiSymbol]: {
    readonly toTx: Effect.Effect<UniswapTxShape>;
  }

  transact<A, E, R>(
    fa: Effect.Effect<A, E, R | UniswapTxTag>,
  ): Effect.Effect<A, E | Error.BlockchainError, R>;
}

/**
 * A tag for Uniswap service
 */
export class UniswapTag extends Effect.Tag("UniswapTag")<UniswapTag, UniswapShape>() {}
