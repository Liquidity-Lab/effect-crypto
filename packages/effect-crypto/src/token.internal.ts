import { Big, BigDecimal, MC, MathContext, RoundingMode } from "bigdecimal.js";
import { Context, Effect, Equal, Hash, Layer, Option, Order } from "effect";
import { RuntimeException } from "effect/Cause";
import { BigNumberish, Contract, TransactionRequest, TransactionResponse } from "ethers";

import WETH9 from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/libraries/aeWETH.sol/aeWETH.json";
import ERC20 from "@liquidity_lab/sol-artifacts/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";

import * as Adt from "./adt.js";
import * as Assertable from "./assertable.js";
import * as BigMath from "./bigMath.js";
import * as Chain from "./chain.js";
import * as Error from "./error.js";
import * as Signature from "./signature.js";
import type * as T from "./token.js";
import * as TokenVolume from "./tokenVolume.js";
import * as Price from "./price.js";
import * as EffectUtils from "./utils/effectUtils.js";
import * as FunctionUtils from "./utils/functionUtils.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/token#privateApi");

export enum TokenType {
  ERC20 = "ERC20",
  Wrapped = "Wrapped",
  Native = "Native",
}

class TokenLive<T extends TokenType> implements T.Token<T> {
  readonly _tag: "Token" = "Token" as const;
  readonly meta: T.TokenMetaShape<T>;

  readonly address: Adt.Address;
  readonly decimals: number;
  readonly symbol: string;
  readonly name: string;

  /**
   *
   * @param address The contract address on the chain on which this token lives
   * @param decimals Number of decimals
   * @param symbol Symbol of the token
   * @param name Name of the token
   * @param meta If the token is ERC20
   */
  constructor(
    address: Adt.Address,
    decimals: number,
    symbol: string,
    name: string,
    meta: T.TokenMetaShape<T>,
  ) {
    this.address = address;
    this.decimals = decimals;
    this.symbol = symbol;
    this.name = name;
    this.meta = meta;
  }

  get [Assertable.instanceSymbol](): Assertable.AssertableEntity<this> {
    const base = {
      address: this.address,
      decimals: this.decimals,
      symbol: this.symbol,
      name: this.name,
    };

    switch (this.meta._tag) {
      case "Erc20TokenMeta":
        return Assertable.AssertableEntity({
          ...base,
          tokenType: this.meta.tokenType,
        });

      case "WrappedTokenMeta":
        return Assertable.AssertableEntity({
          ...base,
          tokenType: this.meta.tokenType,
          originalToken: Assertable.asAssertableEntity(this.meta.originalToken),
        });

      case "NativeTokenMeta":
        return Assertable.AssertableEntity({
          ...base,
          tokenType: this.meta.tokenType,
        });
    }
  }

  [Equal.symbol](that: Equal.Equal): boolean {
    if (!(that instanceof TokenLive)) {
      return false;
    }

    return (
      this.address === that.address &&
      this.decimals === that.decimals &&
      this.symbol === that.symbol &&
      this.name === that.name &&
      isMetaEquals(this.meta, that.meta)
    );
  }

  [Hash.symbol](): number {
    return Hash.hash(Assertable.asAssertableEntity(this));
  }
}

export const tokenOrder: Order.Order<T.AnyToken> = Order.mapInput(
  Order.string,
  (token) => token.address,
);

export function makeToken<T extends TokenType>(
  address: Adt.Address,
  decimals: number,
  symbol: string,
  name: string,
  meta: T.TokenMetaShape<T>,
): T.Token<T> {
  return new TokenLive(address, decimals, symbol, name, meta);
}

export function makeWrappedTokenMeta(
  originalToken: T.AnyToken,
): T.TokenMetaShape<TokenType.Wrapped> {
  return {
    _tag: "WrappedTokenMeta",
    tokenType: TokenType.Wrapped,
    originalToken,
  };
}

export function makeErc20TokenMeta(): T.TokenMetaShape<TokenType.ERC20> {
  return {
    _tag: "Erc20TokenMeta",
    tokenType: TokenType.ERC20,
  };
}

export function makeNativeTokenMeta(): T.TokenMetaShape<TokenType.Native> {
  return {
    _tag: "NativeTokenMeta",
    tokenType: TokenType.Native,
  };
}

export function isErc20Token(a: T.Token<TokenType>): a is T.Token<TokenType.ERC20> {
  return a.meta.tokenType === TokenType.ERC20;
}

export function isWrappedToken(a: T.Token<TokenType>): a is T.Token<TokenType.Wrapped> {
  return a.meta.tokenType === TokenType.Wrapped;
}

export function isNativeToken(a: T.Token<TokenType>): a is T.Token<TokenType.Native> {
  return a.meta.tokenType === TokenType.Native;
}

export function isErc20LikeToken(a: T.Token<TokenType>): a is T.Erc20LikeToken {
  return isErc20Token(a) || isWrappedToken(a);
}

export function fetchErc20Token(
  address: Adt.Address,
): Effect.Effect<Option.Option<T.Erc20Token>, Error.BlockchainError, Chain.Tag> {
  return Effect.gen(function* () {
    const contractOps = yield* Chain.contractInstance(address, ERC20.abi);
    const contract = contractOps.withOnChainRunner;
    const contractCode = yield* Error.catchRefinedBlockchainErrors(
      Effect.promise(() => contract.getDeployedCode()),
      contract,
    );

    if (contractCode === null) {
      return Option.none();
    }

    const token = yield* fetchErc20TokenDataFromContract(contract);

    return Option.some(token);
  });
}

export function fetchErc20TokenDataFromContract(
  contract: Contract,
): Effect.Effect<T.Erc20Token, Error.BlockchainError> {
  const prog = Effect.gen(function* () {
    const getName = contract.getFunction("name");
    const name: string = yield* Effect.promise(() => getName());

    const getSymbol = contract.getFunction("symbol");
    const symbol: string = yield* Effect.promise(() => getSymbol());

    const getDecimals = contract.getFunction("decimals");
    const decimals: number = yield* Effect.promise(() => getDecimals());

    const rawAddress: string = yield* Effect.promise(() => contract.getAddress());
    const address = yield* EffectUtils.getOrDieEither(Adt.Address(rawAddress));

    return makeToken<TokenType.ERC20>(
      address,
      Number(decimals),
      symbol,
      name,
      makeErc20TokenMeta(),
    );
  });

  return Error.catchRefinedBlockchainErrors(prog, contract);
}

function isMetaEquals<A extends T.TokenType, B extends T.TokenType>(
  a: T.TokenMetaShape<A>,
  b: T.TokenMetaShape<B>,
): boolean {
  switch (a._tag) {
    case "Erc20TokenMeta":
      return b._tag === "Erc20TokenMeta";

    case "WrappedTokenMeta":
      return b._tag === "WrappedTokenMeta" && Equal.equals(a.originalToken, b.originalToken);

    case "NativeTokenMeta":
      return b._tag === "NativeTokenMeta";
  }
}

interface TokensPrivateApi {
  readonly config: T.TokensDescriptor;
  readonly nativeToken: T.NativeToken;
  readonly underlyingChain: Context.Tag.Service<Chain.Tag>;
}

interface TokensShape {
  readonly [privateApiSymbol]: TokensPrivateApi;
}

/**
 * Use this tag to layer Tokens module. It is used to provide a TokensTag instance:
 *
 * @example
 *   import { Context, Effect, Layer } from "effect";
 *   import { Token } from "./com/liquidity_lab/crypto/blockchain";
 *
 *   const descriptor: Token.TokensDescriptor
 *   const tokensLayer: Layer.Layer<Token.Tag> = Token.makeTokensFromDescriptor(descriptor);
 *   const effect: Effect.Effect<any, never, Token.Tag> = Effect.gen(function* () {
 *     const tokens: readonly AnyToken[] = yield* Token.getAvailableTokens();
 *
 *   });
 *
 *   prog.provideLayer(tokensLayer);
 */
export class TokensTag extends Context.Tag("TokensTag")<TokensTag, TokensShape>() {}

export function makeTokensFromDescriptor(
  config: T.TokensDescriptor,
  nativeToken: T.NativeToken,
): Layer.Layer<TokensTag, Adt.FatalError, Chain.Tag> {
  const maybeToken = Object.values(config).find((token) => token === nativeToken);

  if (maybeToken !== undefined) {
    return Layer.service(Chain.Tag).pipe(
      Layer.map((ctx) => {
        const instance: TokensShape = {
          [privateApiSymbol]: {
            config,
            nativeToken,
            underlyingChain: Context.get(ctx, Chain.Tag),
          },
        };

        return Context.make(TokensTag, instance);
      }),
    );
  }

  return Layer.fail(
    Adt.FatalErrorString(`Native token [${nativeToken.symbol}] is not in the descriptor`),
  );
}

export const getToken = FunctionUtils.withOptionalServiceApi(TokensTag, getTokenImpl).value;

function getTokenImpl<T extends keyof T.TokensDescriptor>(
  { [privateApiSymbol]: api }: TokensShape,
  symbol: T,
): T.TokensDescriptor[T] {
  return api.config[symbol];
}

export const getAvailableTokens = FunctionUtils.withOptionalServiceApi(
  TokensTag,
  getAvailableTokensImpl,
).value;

function getAvailableTokensImpl({
  [privateApiSymbol]: api,
}: TokensShape): ReadonlyArray<T.AnyToken> {
  return Object.values(api.config);
}

export const approveTransfer = FunctionUtils.withOptionalServiceApi(
  TokensTag,
  approveTransferImpl,
).value;

function approveTransferImpl(
  { [privateApiSymbol]: api }: TokensShape,
  volume: TokenVolume.Erc20LikeTokenVolume,
  to: Adt.Address,
): Effect.Effect<TransactionResponse, Adt.FatalError | Error.BlockchainError, Signature.TxTag> {
  return Effect.gen(function* () {
    const contractOps = yield* Chain.contractInstance(
      api.underlyingChain,
      volume.token.address,
      ERC20.abi,
    );
    const contract = yield* Signature.signed(contractOps);
    const approvalTx: TransactionResponse = yield* Effect.promise(() =>
      contract.approve(to, TokenVolume.asUnscaled(volume)),
    );

    return approvalTx;
  });
}

export const deposit = FunctionUtils.withOptionalServiceApi(TokensTag, depositImpl).value;

function depositImpl(
  { [privateApiSymbol]: api }: TokensShape,
  volume: TokenVolume.WrappedTokenVolume,
): Effect.Effect<TransactionRequest, Adt.FatalError, Signature.TxTag> {
  const originalToken = volume.token.meta.originalToken;

  return Effect.gen(function* () {
    // TODO: probably I need to differentiate between WETH and other wrappers. Implement wrapping for ERC20 tokens
    if (!isNativeToken(originalToken)) {
      return yield* Effect.fail(
        Adt.FatalErrorString(
          `Cannot wrap token ${originalToken.symbol} because it is not supported yet (only native token can be wrapped)`,
        ),
      );
    }

    yield* invariantNativeToken(api, originalToken);

    const contractOps = yield* Chain.contractInstance(
      api.underlyingChain,
      volume.token.address,
      WETH9.abi,
    );
    const tokenContract = yield* Signature.signed(contractOps);
    const transactionRequest = {
      to: volume.token.address,
      data: tokenContract.interface.encodeFunctionData("deposit", []),
      value: `0x${TokenVolume.asUnscaled(volume).toString(16)}`,
    };

    return transactionRequest;
  });
}

export const transferNative = FunctionUtils.withOptionalServiceApi(
  TokensTag,
  transferNativeImpl,
).value;

function transferNativeImpl(
  { [privateApiSymbol]: api }: TokensShape,
  volume: TokenVolume.NativeTokenVolume,
  to: Adt.Address,
): Effect.Effect<TransactionRequest, Adt.FatalError, Signature.TxTag> {
  return Effect.gen(function* () {
    yield* invariantNativeToken(api, volume.token);

    return {
      to,
      value: `0x${TokenVolume.asUnscaled(volume).toString(16)}`,
    };
  });
}

export const balanceOfErc20Like = FunctionUtils.withOptionalServiceApi(
  TokensTag,
  balanceOfErc20LikeImpl,
).value;

function balanceOfErc20LikeImpl<T extends TokenType.ERC20 | TokenType.Wrapped>(
  { [privateApiSymbol]: api }: TokensShape,
  token: T.Token<T>,
  address: Adt.Address,
): Effect.Effect<
  Option.Option<TokenVolume.TokenVolume<T>>,
  Adt.FatalError | Error.BlockchainError,
  Signature.TxTag
> {
  return Effect.gen(function* () {
    const contractOps = yield* Chain.contractInstance(
      api.underlyingChain,
      token.address,
      ERC20.abi,
    );
    const tokenContract = yield* Signature.signed(contractOps);

    const balance: BigNumberish = yield* Error.catchRefinedBlockchainErrors(
      Effect.promise(() => tokenContract.balanceOf(address)),
      tokenContract,
    );

    return TokenVolume.tokenVolumeFromUnscaled(token, BigInt(balance));
  });
}

export const transferErc20Like = FunctionUtils.withOptionalServiceApi(
  TokensTag,
  transferErc20LikeImpl,
).value;

function transferErc20LikeImpl<T extends TokenType.ERC20 | TokenType.Wrapped>(
  { [privateApiSymbol]: api }: TokensShape,
  volume: TokenVolume.TokenVolume<T>,
  to: Adt.Address,
  from: Adt.Address,
): Effect.Effect<TransactionRequest, Adt.FatalError | Error.BlockchainError, Signature.TxTag> {
  return Effect.gen(function* () {
    const contractOps = yield* Chain.contractInstance(
      api.underlyingChain,
      volume.token.address,
      ERC20.abi,
    );
    const tokenContract = yield* Signature.signed(contractOps);
    const transferCallData = tokenContract.interface.encodeFunctionData("transfer", [
      to,
      TokenVolume.asUnscaled(volume),
    ]);
    const transactionRequest: TransactionRequest = {
      data: transferCallData,
      to: volume.token.address,
      from: from,
    };

    return transactionRequest;
  });
}

/**
 * Ensures the token is a native token on the current chain.
 *
 * @param api the token tx private api.
 * @param token The token to verify.
 * @returns An effect that verifies token compatibility.
 */
function invariantNativeToken(
  api: TokensPrivateApi,
  token: T.NativeToken,
): Effect.Effect<void, Adt.FatalError> {
  return Effect.gen(function* () {
    if (!Equal.equals(token, api.nativeToken)) {
      return yield* Effect.fail(
        Adt.FatalErrorString(
          `Cannot transfer native token ${token.symbol} because it is not native on ` +
            `this chain [${api.nativeToken.symbol}]`,
        ),
      );
    }
  });
}
