import { Effect } from "effect";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import * as Error from "~/error.js";
import * as Token from "~/token.js";
import * as Wallet from "~/wallet.js";

export function tokensDeploy(): Effect.Effect<
  Token.TokensDescriptor,
  Adt.FatalError | Error.BlockchainError,
  Chain.TxTag | Wallet.TxTag
> {
  function deployHelper<T extends Token.TokenType.Wrapped | Token.TokenType.ERC20>(
    meta: Token.TokenMetaShape<T>,
    deployArgs: Adt.DeployArgs,
  ): Effect.Effect<
    Token.Token<T>,
    Adt.FatalError | Error.BlockchainError,
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
