import { Big, BigDecimal, MC, MathContext, RoundingMode } from "bigdecimal.js";
import { Context, Effect, Equal, Hash, Layer, Option, Order } from "effect";
import { RuntimeException } from "effect/Cause";
import { BigNumberish, Contract, TransactionRequest, TransactionResponse } from "ethers";

import WETH9 from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/libraries/aeWETH.sol/aeWETH.json";
import ERC20 from "@liquidity_lab/sol-artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
// import ETHLabs from "@liquidity_lab/sol-artifacts/dist/contracts/ETHLabs.sol/ETHLabs.json";
import USDCLabs from "@liquidity_lab/sol-artifacts/contracts/USDCLabs.sol/USDCLabs.json";

import * as Adt from "~/adt.js";
import * as Assertable from "~/assertable.js";
import * as Chain from "~/chain.js";
import * as Error from "~/error.js";
import * as Signature from "~/signature.js";
import type * as T from "~/token.js";
import * as EffectUtils from "~/utils/effectUtils.js";
import * as FunctionUtils from "~/utils/functionUtils.js";

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
): Effect.Effect<Option.Option<T.Erc20Token>, Error.BlockchainError, Chain.TxTag> {
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

// Checks
/*
function fakeToken<T extends TokenType>(): Token<T> {
  return {} as Token<T>;
}

type MetaTest = TokenMetaShape<TokenType>;
// This can be resolved using different constructors
const tmp = Token.newWrapped(
  Address.makeUnsafe("0x"),
  123,
  "ETH",
  "Etttth",
  TokenMetaShape.wrapped(fakeToken<TokenType.Native>()),
);

function tokenInputTest(token: Token<TokenType.ERC20 | TokenType.Wrapped>) {
  if (!isErc20Token(token)) {
    return;
  }

  const meta: Erc20TokenMeta = token.meta;
}

tokenInputTest(fakeToken<TokenType.Native>());
tokenInputTest(fakeToken<TokenType.ERC20>());
tokenInputTest(fakeToken<TokenType.Wrapped>());
tokenInputTest(fakeToken<TokenType.Wrapped | TokenType.ERC20>());
tokenInputTest(fakeToken<TokenType.Native | TokenType.ERC20>());

function anyTokenInputTest(token: AnyToken) {
  if (!isErc20Token(token)) {
    return;
  }

  const meta: Erc20TokenMeta = token.meta;
}

anyTokenInputTest(fakeToken<TokenType.Native>());
anyTokenInputTest(fakeToken<TokenType.ERC20>());
*/

class TokenVolumeLive<T extends TokenType> implements T.TokenVolume<T> {
  readonly token: T.Token<T>;
  readonly value: BigDecimal;

  constructor(token: T.Token<T>, value: BigDecimal) {
    this.token = token;
    this.value = value;
  }

  get [Assertable.instanceSymbol](): Assertable.AssertableEntity<this> {
    return Assertable.AssertableEntity({
      token: Assertable.asAssertableEntity(this.token),
      value: this.asUnits,
    });
  }

  get asUnits(): string {
    return this.value.setScale(this.token.decimals, RoundingMode.FLOOR).toPlainString();
  }

  get asUnscaled(): bigint {
    return this.value.setScale(this.token.decimals, RoundingMode.FLOOR).unscaledValue();
  }

  get prettyPrint(): string {
    return `${this.asUnits} ${this.token.symbol || "token"}`;
  }
}

export function makeTokenVolumeFromUnits<T extends TokenType>(
  token: T.Token<T>,
  units: BigNumberish,
): T.TokenVolume<T> {
  return new TokenVolumeLive(token, Big(units)) as T.TokenVolume<T>;
}

export function makeTokenVolumeFromUnscaled<T extends TokenType>(
  token: T.Token<T>,
  unscaled: bigint,
): T.TokenVolume<T> {
  return new TokenVolumeLive(token, Big(unscaled, token.decimals)) as T.TokenVolume<T>;
}

export function makeTokenVolumeZero<T extends TokenType>(token: T.Token<T>): T.TokenVolume<T> {
  return makeTokenVolumeFromUnscaled(token, 0n);
}

class TokenPriceLive<T extends TokenType> implements T.TokenPrice<T> {
  readonly baseCurrency: T.Token<T>;
  readonly quoteCurrency: T.Token<T>;

  readonly value: BigDecimal;

  /**
   * price = baseCurrency / quoteCurrency,
   * meaning that 1 unit of baseCurrency is worth value units of quoteCurrency
   * @example
   *   "BTCUSD" -> 70000 USD
   */
  constructor(baseCurrency: T.Token<T>, quoteCurrency: T.Token<T>, value: BigDecimal) {
    // tokens must be sorted
    if (!Order.lessThanOrEqualTo(tokenOrder)(baseCurrency, quoteCurrency)) {
      throw new RuntimeException(
        "Cannot construct TokenPrice, baseCurrency must be sorted before quoteCurrency",
      );
    }

    this.baseCurrency = baseCurrency;
    this.quoteCurrency = quoteCurrency;
    this.value = value;

    // node_modules/@uniswap/sdk-core/dist/utils/sqrt.d.ts
    // const initialSqrtPrice = encodeSqrtRatioX96() parseUnits("4000", USDC.decimals) *; // TODO: convert to sqrt price
    // const dbg = new SdkPrice()
  }

  get token0(): T.Token<T> {
    return this.baseCurrency;
  }

  get token1(): T.Token<T> {
    return this.quoteCurrency;
  }

  get tokens(): [T.Token<T>, T.Token<T>] {
    return [this.token0, this.token1];
  }

  get asUnits(): string {
    return this.value.setScale(this.token1.decimals, RoundingMode.FLOOR).toPlainString();
  }

  get asFlippedUnits(): string {
    return Big(1)
      .divideWithMathContext(this.value, TokenPriceLive.mc)
      .setScale(this.token0.decimals, RoundingMode.FLOOR)
      .toPlainString();
  }

  get asSqrtX96(): Option.Option<bigint> {
    return TokenPriceLive.convertToQ64x96(this.value.sqrt(TokenPriceLive.mc));
  }

  get asFlippedSqrtX96(): Option.Option<bigint> {
    return TokenPriceLive.convertToQ64x96(
      Big(1).divideWithMathContext(this.value, TokenPriceLive.mc).sqrt(TokenPriceLive.mc),
    );
  }

  contains(token: T.Token<T.TokenType>): boolean {
    return token.address == this.token0.address || token.address == this.token1.address;
  }

  projectAmount(inputAmount: T.TokenVolume<T>): Option.Option<T.TokenVolume<T>> {
    switch (inputAmount.token.address) {
      case this.token0.address:
        return Option.some(
          makeTokenVolumeFromUnscaled(
            this.token1,
            this.value
              .multiply(Big(inputAmount.asUnscaled, inputAmount.token.decimals))
              .setScale(this.token1.decimals, RoundingMode.FLOOR)
              .unscaledValue(),
          ),
        );
      case this.token1.address:
        return Option.some(
          makeTokenVolumeFromUnscaled(
            this.token0,
            Big(inputAmount.asUnscaled, inputAmount.token.decimals)
              .divideWithMathContext(this.value, TokenPriceLive.mc)
              .setScale(this.token0.decimals, RoundingMode.FLOOR)
              .unscaledValue(),
          ),
        );
      default:
        return Option.none();
    }
  }

  get prettyPrint(): string {
    return `1 ${this.token0.symbol || "token0"} -> ${this.asUnits} ${this.token1.symbol || "token1"}`;
  }

  map(f: (a: BigDecimal) => BigDecimal): TokenPriceLive<T> {
    return new TokenPriceLive(this.baseCurrency, this.quoteCurrency, f(this.value));
  }

  static convertToQ64x96(underlying: BigDecimal): Option.Option<bigint> {
    const scaledValue = (underlying.unscaledValue() * 2n ** 96n) / BigInt(10 ** underlying.scale());
    const maxValue = 2n ** (64n + 96n);

    return scaledValue >= maxValue ? Option.none() : Option.some(scaledValue);
  }

  static mc: MathContext = MC((28 + 19) * 2, RoundingMode.FLOOR);
}

export function makeTokenPriceFromUnits<TBase extends T.TokenType, TQuote extends T.TokenType>(
  baseCurrency: T.Token<TBase>,
  quoteCurrency: T.Token<TQuote>,
  valueInQuoteCurrency: string,
): T.TokenPrice<TBase | TQuote> {
  const isInverted = !Order.lessThanOrEqualTo(tokenOrder)(baseCurrency, quoteCurrency);
  const [token0, token1] =
    isInverted ? [quoteCurrency, baseCurrency] : [baseCurrency, quoteCurrency];
  const providedValue: BigDecimal = Big(valueInQuoteCurrency, undefined, TokenPriceLive.mc);

  return new TokenPriceLive<TBase | TQuote>(
    token0,
    token1,
    isInverted ? Big(1).divideWithMathContext(providedValue, TokenPriceLive.mc) : providedValue,
  ) as T.TokenPrice<TBase | TQuote>;
}

export function makeTokenPriceFromSqrtX96<TBase extends TokenType, TQuote extends TokenType>(
  baseCurrency: T.Token<TBase>,
  quoteCurrency: T.Token<TQuote>,
  sqrtX96: BigNumberish,
): T.TokenPrice<TBase | TQuote> {
  const isInverted = !Order.lessThanOrEqualTo(tokenOrder)(baseCurrency, quoteCurrency);
  const [token0, token1] =
    isInverted ? [quoteCurrency, baseCurrency] : [baseCurrency, quoteCurrency];

  const providedValue = Big(
    (BigInt(sqrtX96) * 10n ** BigInt(quoteCurrency.decimals)) / 2n ** 96n,
    quoteCurrency.decimals,
    TokenPriceLive.mc,
  ).pow(2);

  return new TokenPriceLive<TBase | TQuote>(
    token0,
    token1,
    isInverted ? Big(1).divideWithMathContext(providedValue, TokenPriceLive.mc) : providedValue,
  ) as T.TokenPrice<TBase | TQuote>;
}

interface TokenTxPrivateApi {
  readonly config: T.TokensDescriptor;
  readonly nativeToken: T.NativeToken;
  readonly underlyingChain: Context.Tag.Service<Chain.TxTag>;
}

interface TokenTxShape {
  readonly [privateApiSymbol]: TokenTxPrivateApi;
}

/**
 * Any effect that interacts with token can be described with this tag
 *
 * @example
 *   import { Token } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   const effect: Effect.Effect<any, never, Token.TxTag> = Effect.gen(function* () {
 *     const USDC: Token.Erc20Token = yield* Token.get("USDC");
 *   });
 */
export class TokenTxTag extends Context.Tag("TokenTxTag")<TokenTxTag, TokenTxShape>() {}

interface TokensPrivateApi {
  readonly toTx: Effect.Effect<TokenTxShape, Adt.FatalError, Chain.TxTag>;
}

interface TokensShape {
  readonly [privateApiSymbol]: TokensPrivateApi;

  /**
   * Provides a TokenTxTag instance based on a TokensDescriptor
   *
   * @param fa
   */
  transact<A, E, R>(
    fa: Effect.Effect<A, E, R | TokenTxTag>,
  ): Effect.Effect<A, E | Adt.FatalError, Exclude<R, TokenTxTag> | Chain.TxTag>;
}

/**
 * Use this tag to layer Tokens module. It is used to provide a TokenTxTag instance:
 *
 * @example
 *   import { Context, Effect, Layer } from "effect";
 *   import { Token } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   const descriptor: Token.TokensDescriptor
 *   const tokensLayer: Layer.Layer<Token.Tag> = Token.makeTokensFromDescriptor(descriptor);
 *   const effect: Effect.Effect<any, never, Token.TxTag>
 *   const prog: Effect.Effect<any, never, Token.Tag> = Effect.gen(function* () {
 *     const tokens: Context.Tag = yield* Token.Tag;
 *
 *     return yield* tokens.transact(effect);
 *   });
 *
 *   prog.provideLayer(tokensLayer);
 */
export class TokensTag extends Context.Tag("TokensTag")<TokensTag, TokensShape>() {}

class TokensLive implements TokensShape {
  readonly config: T.TokensDescriptor;
  readonly nativeToken: T.NativeToken;

  constructor(config: T.TokensDescriptor, nativeToken: T.NativeToken) {
    this.config = config;
    this.nativeToken = nativeToken;
  }

  get [privateApiSymbol](): TokensPrivateApi {
    return {
      toTx: this.toTokenTx(),
    };
  }

  transact<A, E, R>(
    fa: Effect.Effect<A, E, R | TokenTxTag>,
  ): Effect.Effect<A, E | Adt.FatalError, Exclude<R, TokenTxTag> | Chain.TxTag> {
    const tokenTxF = this.toTokenTx();

    return Effect.gen(this, function* () {
      const tokenTx = yield* tokenTxF;

      return yield* Effect.provideService(fa, TokenTxTag, tokenTx);
    });
  }

  private toTokenTx(): Effect.Effect<TokenTxShape, never, Chain.TxTag> {
    const { config, nativeToken } = this;

    return Effect.gen(this, function* () {
      const underlyingChain = yield* Chain.TxTag;

      return {
        [privateApiSymbol]: {
          config,
          nativeToken: nativeToken,
          underlyingChain,
        },
      };
    });
  }
}

export function makeTokensFromDescriptor(
  config: T.TokensDescriptor,
  nativeToken: T.NativeToken,
): Layer.Layer<TokensTag, Adt.FatalError> {
  const maybeToken = Object.values(config).find((token) => token === nativeToken);

  if (maybeToken !== undefined) {
    return Layer.succeed(TokensTag, new TokensLive(config, nativeToken));
  }

  return Layer.fail(
    Adt.FatalErrorString(`Native token [${nativeToken.symbol}] is not in the descriptor`),
  );
}

export const getToken = FunctionUtils.withOptionalServiceApi(
  TokenTxTag,
  getTokenImpl,
).contramapEvalService(
  // TODO: support pure functions
  (tokens: Context.Tag.Service<TokensTag>) => tokens[privateApiSymbol].toTx,
).value;

function getTokenImpl<T extends keyof T.TokensDescriptor>(
  { [privateApiSymbol]: api }: TokenTxShape,
  symbol: T,
): T.TokensDescriptor[T] {
  return api.config[symbol];
}

export const getAvailableTokens = FunctionUtils.withOptionalServiceApi(
  TokenTxTag,
  getAvailableTokensImpl,
).contramapEvalService(
  (tokens: Context.Tag.Service<TokensTag>) => tokens[privateApiSymbol].toTx,
).value;

function getAvailableTokensImpl({
  [privateApiSymbol]: api,
}: TokenTxShape): ReadonlyArray<T.AnyToken> {
  return Object.values(api.config);
}

export const approveTransfer = FunctionUtils.withOptionalServiceApi(
  TokenTxTag,
  approveTransferImpl,
).contramapEvalService(
  (tokens: Context.Tag.Service<TokensTag>) => tokens[privateApiSymbol].toTx,
).value;

function approveTransferImpl(
  { [privateApiSymbol]: api }: TokenTxShape,
  volume: T.Erc20LikeTokenVolume,
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
      contract.approve(to, volume.asUnscaled),
    );

    return approvalTx;
  });
}

export const deposit = FunctionUtils.withOptionalServiceApi(
  TokenTxTag,
  depositImpl,
).contramapEvalService(
  (tokens: Context.Tag.Service<TokensTag>) => tokens[privateApiSymbol].toTx,
).value;

function depositImpl(
  { [privateApiSymbol]: api }: TokenTxShape,
  volume: T.WrappedTokenVolume,
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
      value: `0x${volume.asUnscaled.toString(16)}`,
    };

    return transactionRequest;
  });
}

export const transferNative = FunctionUtils.withOptionalServiceApi(
  TokenTxTag,
  transferNativeImpl,
).contramapEvalService(
  (tokens: Context.Tag.Service<TokensTag>) => tokens[privateApiSymbol].toTx,
).value;

function transferNativeImpl(
  { [privateApiSymbol]: api }: TokenTxShape,
  volume: T.NativeTokenVolume,
  to: Adt.Address,
): Effect.Effect<TransactionRequest, Adt.FatalError, Signature.TxTag> {
  return Effect.gen(function* () {
    yield* invariantNativeToken(api, volume.token);

    return {
      to,
      value: `0x${volume.asUnscaled.toString(16)}`,
    };
  });
}

export const balanceOfErc20Like = FunctionUtils.withOptionalServiceApi(
  TokenTxTag,
  balanceOfErc20LikeImpl,
).contramapEvalService(
  (tokens: Context.Tag.Service<TokensTag>) => tokens[privateApiSymbol].toTx,
).value;

function balanceOfErc20LikeImpl<T extends TokenType.ERC20 | TokenType.Wrapped>(
  { [privateApiSymbol]: api }: TokenTxShape,
  token: T.Token<T>,
  address: Adt.Address,
): Effect.Effect<
  Option.Option<T.TokenVolume<T>>,
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

    return Option.some(makeTokenVolumeFromUnscaled(token, BigInt(balance)));
  });
}

export const transferErc20Like = FunctionUtils.withOptionalServiceApi(
  TokenTxTag,
  transferErc20LikeImpl,
).contramapEvalService(
  (tokens: Context.Tag.Service<TokensTag>) => tokens[privateApiSymbol].toTx,
).value;

function transferErc20LikeImpl<T extends TokenType.ERC20 | TokenType.Wrapped>(
  { [privateApiSymbol]: api }: TokenTxShape,
  volume: T.TokenVolume<T>,
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
      volume.asUnscaled,
    ]);
    const transactionRequest: TransactionRequest = {
      data: transferCallData,
      to: volume.token.address,
      from: from,
    };

    return transactionRequest;
  });
}

type NativeTokenKeys<T> = {
  [K in keyof T]: T[K] extends T.Token<TokenType.Native> ? K : never;
}[keyof T];

type DeployableTokenKeys = Exclude<keyof T.TokensDescriptor, NativeTokenKeys<T.TokensDescriptor>>;

export const deployArgs: { [K in DeployableTokenKeys]-?: Adt.DeployArgs } = {
  WETH: [WETH9.abi, WETH9.bytecode, []],
  USDC: [USDCLabs.abi, USDCLabs.bytecode, []],
};

/**
 * Ensures the token is a native token on the current chain.
 *
 * @param api the token tx private api.
 * @param token The token to verify.
 * @returns An effect that verifies token compatibility.
 */
function invariantNativeToken(
  api: TokenTxPrivateApi,
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
