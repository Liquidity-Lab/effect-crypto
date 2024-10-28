import { Context, Effect, Layer } from "effect";
import {
  AbstractSigner,
  type BlockTag,
  type Provider,
  Signer,
  type TransactionRequest,
  type TransactionResponse,
  type TypedDataDomain,
  type TypedDataField,
} from "ethers";

import * as Adt from "~/adt.js";
import * as Chain from "~/chain.js";
import * as Error from "~/error.js";
import * as FunctionUtils from "~/utils/functionUtils.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/testEvn#privateApi");

interface TestEnvTxPrivateApi {
  readonly nonceState: NonceState;
  readonly underlyingChain: Context.Tag.Service<Chain.TxTag>;
}

interface TestEnvTxShape {
  [privateApiSymbol]: TestEnvTxPrivateApi;
}

export class TestEnvTxTag extends Context.Tag("TestEnvTxTag")<TestEnvTxTag, TestEnvTxShape>() {}

interface TestEnvShape {
  transact<A, E, R>(
    fa: Effect.Effect<A, E, R | TestEnvTxTag>,
  ): Effect.Effect<A, E, Exclude<R, TestEnvTxTag> | Chain.TxTag>;
}

export class TestEnvTag extends Context.Tag("TestEnvTag")<TestEnvTag, TestEnvShape>() {}

class NonceState {
  #noncePromise: null | Promise<number>;
  #delta: number;

  /**
   *  Creates a new **NonceState** to manage %%signer%%.
   */
  constructor() {
    this.#noncePromise = null;
    this.#delta = 0;
  }

  /**
   *  Manually increment the nonce. This may be useful when managing
   *  offline transactions.
   */
  increment(): void {
    this.#delta++;
  }

  async getNonce(signer: Signer, blockTag?: BlockTag): Promise<number> {
    if (blockTag === "pending") {
      if (this.#noncePromise == null) {
        this.#noncePromise = signer.getNonce("pending");
      }

      const delta = this.#delta;
      return (await this.#noncePromise) + delta;
    }

    return signer.getNonce(blockTag);
  }

  /**
   *  Resets the nonce, causing the **NonceManager** to reload the current
   *  nonce from the blockchain on the next transaction.
   */
  reset(): void {
    this.#delta = 0;
    this.#noncePromise = null;
  }
}

/**
 *  A **NonceManager** wraps another [[Signer]] and automatically manages
 *  the nonce, ensuring serialized and sequential nonces are used during
 *  transaction.
 */
class NonceManager extends AbstractSigner {
  /**
   *  The Signer being managed.
   */
  readonly signer: Signer;

  private readonly nonceState: NonceState;

  /**
   *  Creates a new **NonceManager** to manage %%signer%%.
   */
  constructor(signer: Signer, nonceState: NonceState) {
    super(signer.provider);

    this.signer = signer;
    this.nonceState = nonceState;
  }

  async getAddress(): Promise<string> {
    return this.signer.getAddress();
  }

  connect(provider: null | Provider): NonceManager {
    return new NonceManager(this.signer.connect(provider), this.nonceState);
  }

  async getNonce(blockTag?: BlockTag): Promise<number> {
    return this.nonceState.getNonce(this.signer, blockTag);
  }

  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    const noncePromise = this.getNonce("pending");
    this.nonceState.increment();

    tx = await this.signer.populateTransaction(tx);
    tx.nonce = await noncePromise;

    // @TODO: Maybe handle interesting/recoverable errors?
    // Like don't increment if the tx was certainly not sent
    return await this.signer.sendTransaction(tx);
  }

  signTransaction(tx: TransactionRequest): Promise<string> {
    return this.signer.signTransaction(tx);
  }

  signMessage(message: string | Uint8Array): Promise<string> {
    return this.signer.signMessage(message);
  }

  signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, unknown>,
  ): Promise<string> {
    return this.signer.signTypedData(domain, types, value);
  }
}

export const setBalance = FunctionUtils.withOptionalServiceApi(TestEnvTxTag, setBalanceImpl).value;

function setBalanceImpl(
  { [privateApiSymbol]: api }: TestEnvTxShape,
  address: Adt.Address,
  balance: bigint,
): Effect.Effect<void, Error.BlockchainError> {
  return Effect.as(
    Chain.send(api.underlyingChain, "hardhat_setBalance", [address, `0x${balance.toString(16)}`]),
    void 0,
  );
}

export const withNonceManagement = FunctionUtils.withOptionalServiceApi(
  TestEnvTxTag,
  withNonceManagementImpl,
).value;

function withNonceManagementImpl(
  { [privateApiSymbol]: api }: TestEnvTxShape,
  signer: Signer,
): Signer {
  return new NonceManager(signer, api.nonceState);
}

class TestEnvLive implements TestEnvShape {
  private readonly nonceState: NonceState;

  constructor(nonceState: NonceState) {
    this.nonceState = nonceState;
  }

  transact<A, E, R>(
    fa: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E, Exclude<R, TestEnvTxTag> | Chain.TxTag> {
    const { nonceState } = this;

    return Effect.gen(function* () {
      const underlyingChain = yield* Chain.TxTag;
      const tx = {
        [privateApiSymbol]: {
          nonceState,
          underlyingChain,
        },
      };

      return yield* Effect.provideService(fa, TestEnvTxTag, tx);
    });
  }
}

export function testEnvLayer(): Layer.Layer<TestEnvTag> {
  return Layer.succeed(TestEnvTag, new TestEnvLive(new NonceState()));
}
