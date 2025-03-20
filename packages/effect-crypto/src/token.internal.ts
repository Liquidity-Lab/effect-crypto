import { Context, Effect, Equal, Hash, Layer, Option, Order } from "effect";
import { BigNumberish, Contract, TransactionRequest, TransactionResponse } from "ethers";
import {
  Arbitrary,
  constant as constantGen,
  integer as integerGen,
  string as stringGen,
  tuple,
} from "fast-check";

import WETH9 from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/libraries/aeWETH.sol/aeWETH.json";
import ERC20 from "@liquidity_lab/sol-artifacts/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";

import * as Adt from "./adt.js";
import * as Assertable from "./assertable.js";
import * as BigMath from "./bigMath.js";
import * as Chain from "./chain.js";
import * as BError from "./error.js";
import * as Signature from "./signature.js";
import type * as T from "./token.js";
import * as TokenVolume from "./tokenVolume.js";
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
): Effect.Effect<Option.Option<T.Erc20Token>, BError.BlockchainError, Chain.Tag> {
  return Effect.gen(function* () {
    const contractOps = yield* Chain.contractInstance(address, ERC20.abi);
    const contract = contractOps.withOnChainRunner;
    const contractCode = yield* BError.catchRefinedBlockchainErrors(
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
): Effect.Effect<T.Erc20Token, BError.BlockchainError> {
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

  return BError.catchRefinedBlockchainErrors(prog, contract);
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

class TokenPriceLive<T extends TokenType> implements T.TokenPrice<T> {
  static mc: MathContext = MC((28 + 19) * 2, RoundingMode.FLOOR);
  readonly baseCurrency: T.Token<T>;
  readonly quoteCurrency: T.Token<T>;
  readonly ratio: BigMath.Ratio;

  /**
   * price = baseCurrency / quoteCurrency,
   * meaning that 1 unit of baseCurrency is worth value units of quoteCurrency
   * @example
   *   "BTCUSD" -> 70000 USD
   */
  constructor(baseCurrency: T.Token<T>, quoteCurrency: T.Token<T>, ratio: BigMath.Ratio) {
    // tokens must be sorted
    if (!Order.lessThanOrEqualTo(tokenOrder)(baseCurrency, quoteCurrency)) {
      throw new RuntimeException(
        "Cannot construct TokenPrice, baseCurrency must be sorted before quoteCurrency",
      );
    }

    this.baseCurrency = baseCurrency;
    this.quoteCurrency = quoteCurrency;
    this.ratio = ratio;

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
    return this.ratio.setScale(this.token1.decimals, RoundingMode.FLOOR).toPlainString();
  }

  get asFlippedUnits(): string {
    return Big(1)
      .divideWithMathContext(this.ratio, TokenPriceLive.mc)
      .setScale(this.token0.decimals, RoundingMode.FLOOR)
      .toPlainString();
  }

  get asSqrtX96(): Option.Option<bigint> {
    return TokenPriceLive.convertToQ64x96(this.ratio.sqrt(TokenPriceLive.mc));
  }

  get asFlippedSqrtX96(): Option.Option<bigint> {
    return TokenPriceLive.convertToQ64x96(
      Big(1).divideWithMathContext(this.ratio, TokenPriceLive.mc).sqrt(TokenPriceLive.mc),
    );
  }

  get asUnscaled(): bigint {
    return this.ratio.setScale(this.token1.decimals, RoundingMode.FLOOR).unscaledValue();
  }

  get prettyPrint(): string {
    return `1 ${this.token0.symbol || "token0"} -> ${this.asUnits} ${this.token1.symbol || "token1"}`;
  }

  get [Assertable.instanceSymbol](): Assertable.AssertableEntity<this> {
    return Assertable.AssertableEntity({
      baseCurrency: Assertable.asAssertableEntity(this.baseCurrency),
      quoteCurrency: Assertable.asAssertableEntity(this.quoteCurrency),
      units: this.asUnits,
    });
  }

  static convertToQ64x96(underlying: BigDecimal): Option.Option<bigint> {
    const scaledValue = (underlying.unscaledValue() * 2n ** 96n) / BigInt(10 ** underlying.scale());
    const maxValue = 2n ** (64n + 96n);

    return scaledValue >= maxValue ? Option.none() : Option.some(scaledValue);
  }

  contains(token: T.Token<T.TokenType>): boolean {
    return token.address == this.token0.address || token.address == this.token1.address;
  }

  projectAmount(
    inputAmount: TokenVolume.TokenVolume<T>,
  ): Option.Option<TokenVolume.TokenVolume<T>> {
    switch (inputAmount.token.address) {
      case this.token0.address:
        return TokenVolume.tokenVolumeFromUnscaled(
          this.token1,
          this.ratio
            .multiply(inputAmount.underlyingValue)
            .setScale(this.token1.decimals, RoundingMode.FLOOR)
            .unscaledValue(),
        );
      case this.token1.address:
        return TokenVolume.tokenVolumeFromUnscaled(
          this.token0,
          inputAmount.underlyingValue
            .divideWithMathContext(this.ratio, TokenPriceLive.mc)
            .setScale(this.token0.decimals, RoundingMode.FLOOR)
            .unscaledValue(),
        );
      default:
        return Option.none();
    }
  }

  map(f: (a: BigMath.Ratio) => BigMath.Ratio): TokenPriceLive<T> {
    return new TokenPriceLive(this.baseCurrency, this.quoteCurrency, f(this.ratio));
  }
}

export function makeTokenPriceFromUnits<TBase extends T.TokenType, TQuote extends T.TokenType>(
  baseCurrency: T.Token<TBase>,
  quoteCurrency: T.Token<TQuote>,
  valueInQuoteCurrency: string,
): Option.Option<T.TokenPrice<TBase | TQuote>> {
  return Option.map(
    BigMath.Ratio.option(Big(valueInQuoteCurrency, undefined, TokenPriceLive.mc)),
    (ratio) => makeTokenPriceFromRatio(baseCurrency, quoteCurrency, ratio),
  );
}

export function makeTokenPriceFromRatio<TBase extends T.TokenType, TQuote extends T.TokenType>(
  baseCurrency: T.Token<TBase>,
  quoteCurrency: T.Token<TQuote>,
  ratio: BigMath.Ratio,
): T.TokenPrice<TBase | TQuote> {
  const isInverted = !Order.lessThanOrEqualTo(tokenOrder)(baseCurrency, quoteCurrency);
  const [token0, token1] =
    isInverted ? [quoteCurrency, baseCurrency] : [baseCurrency, quoteCurrency];

  const finalRatio = BigMath.Ratio(
    isInverted ? Big(1).divideWithMathContext(ratio, TokenPriceLive.mc) : ratio,
  );

  return new TokenPriceLive<TBase | TQuote>(token0, token1, finalRatio) as T.TokenPrice<
    TBase | TQuote
  >;
}

// TODO: move it to SqrtPrice
export function makeTokenPriceFromSqrtX96<TBase extends TokenType, TQuote extends TokenType>(
  baseCurrency: T.Token<TBase>,
  quoteCurrency: T.Token<TQuote>,
  sqrtX96: BigNumberish, // TODO: get rid of BigNumberish and introduce q64x96 type
): T.TokenPrice<TBase | TQuote> {
  const isInverted = !Order.lessThanOrEqualTo(tokenOrder)(baseCurrency, quoteCurrency);
  const [token0, token1] =
    isInverted ? [quoteCurrency, baseCurrency] : [baseCurrency, quoteCurrency];

  const providedValue = Big(
    (BigInt(sqrtX96) * 10n ** BigInt(quoteCurrency.decimals)) / 2n ** 96n,
    quoteCurrency.decimals,
    TokenPriceLive.mc,
  ).pow(2);

  const ratio = BigMath.Ratio(
    isInverted ? Big(1).divideWithMathContext(providedValue, TokenPriceLive.mc) : providedValue,
  );

  return new TokenPriceLive<TBase | TQuote>(token0, token1, ratio) as T.TokenPrice<TBase | TQuote>;
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
): Effect.Effect<TransactionResponse, Adt.FatalError | BError.BlockchainError, Signature.TxTag> {
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
  Adt.FatalError | BError.BlockchainError,
  Signature.TxTag
> {
  return Effect.gen(function* () {
    const contractOps = yield* Chain.contractInstance(
      api.underlyingChain,
      token.address,
      ERC20.abi,
    );
    const tokenContract = yield* Signature.signed(contractOps);

    const balance: BigNumberish = yield* BError.catchRefinedBlockchainErrors(
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
): Effect.Effect<TransactionRequest, Adt.FatalError | BError.BlockchainError, Signature.TxTag> {
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

// Generator for token decimals with configurable max
const decimalsGen = (maxDecimals: number = 18): Arbitrary<number> =>
  integerGen({ min: 6, max: maxDecimals < 6 ? 6 : maxDecimals });

// Generator for token symbol
const symbolGen = (): Arbitrary<string> =>
  stringGen({ minLength: 3, maxLength: 8 }).map((s) => s.toUpperCase());

// Generator for ERC20 token metadata
const erc20MetaGen = (): Arbitrary<T.TokenMetaShape<TokenType.ERC20>> =>
  constantGen(makeErc20TokenMeta());

// Generator for Native token metadata
const nativeMetaGen = (): Arbitrary<T.TokenMetaShape<TokenType.Native>> =>
  constantGen(makeNativeTokenMeta());

// Generator for Wrapped token metadata, requires original token
const wrappedMetaGen = (
  originalToken: T.AnyToken,
): Arbitrary<T.TokenMetaShape<TokenType.Wrapped>> =>
  constantGen(makeWrappedTokenMeta(originalToken));

/** @internal */
export function tokenGenImpl<T extends TokenType>(
  tokenType: T,
  constraints?: {
    maxDecimals?: number;
  },
): Arbitrary<T.Token<T>> {
  // Generate metadata based on token type
  const metaGen = (): Arbitrary<T.TokenMetaShape<T>> => {
    switch (tokenType) {
      case TokenType.ERC20:
        return erc20MetaGen() as Arbitrary<T.TokenMetaShape<T>>;
      case TokenType.Native:
        return nativeMetaGen() as Arbitrary<T.TokenMetaShape<T>>;
      case TokenType.Wrapped:
        return tokenGenImpl(TokenType.Native).chain(
          (originalToken) => wrappedMetaGen(originalToken) as Arbitrary<T.TokenMetaShape<T>>,
        );
      default:
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
  };

  // Compose all generators to create a token
  return symbolGen().chain((symbol) => {
    return tuple(Adt.addressGen(), decimalsGen(constraints?.maxDecimals ?? 18), metaGen()).map(
      ([address, decimals, meta]) => makeToken(address, decimals, symbol, symbol, meta),
    );
  });
}

/** @internal */
export function tokenPairGenImpl<T extends TokenType>(
  tokenType: T,
  constraints?: {
    maxDecimals?: number;
  },
): Arbitrary<[T.Token<T>, T.Token<T>]> {
  return tuple(tokenGenImpl(tokenType, constraints), tokenGenImpl(tokenType, constraints)).filter(
    ([token0, token1]) => {
      return token0.address !== token1.address;
    },
  );
}
