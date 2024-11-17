import { Effect, Layer } from "effect";

import * as Adt from "../adt.js";
import * as Chain from "../chain.js";
import * as Token from "../token.js";
import * as EffectUtils from "../utils/effectUtils.js";

export default function arbitrumMainnetOps(): Layer.Layer<Token.Tag, Adt.FatalError, Chain.Tag> {
  // const blockchainConfig: BlockchainConfig = {
  //   // chainId: ChainId.ARBITRUM_ONE,
  //   maxFeePerGas: 100000000000n,
  //   maxPriorityFeePerGas: 100000000000n,
  //   gasLimit: 1000000n,
  // }

  const tokensLayerF = Effect.gen(function* () {
    const ETH = Token.nativeETHToken;

    const addressWETH = yield* EffectUtils.getOrDieEither(
      Adt.Address("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"),
    );
    const WETH = Token.WToken(
      addressWETH,
      18,
      "WETH",
      "Wrapped Ether",
      Token.WrappedTokenMeta(ETH),
    );

    const addressUSDC = yield* EffectUtils.getOrDieEither(
      Adt.Address("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
    );
    const USDC = Token.Erc20Token(addressUSDC, 6, "USDC", "USD Coin", Token.Erc20TokenMeta());

    const addressUSDT = yield* EffectUtils.getOrDieEither(
      Adt.Address("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"),
    );
    const USDT = Token.Erc20Token(addressUSDT, 6, "USDT", "Tether USD", Token.Erc20TokenMeta());

    const tokens: Token.TokensDescriptor = {
      WETH,
      USDC,
      USDT,
      ETH,
    };

    return Token.makeTokensFromDescriptor(tokens, tokens.ETH);
  });

  return Layer.unwrapEffect(tokensLayerF);
}
