import { Context, Effect } from "effect";
import { dual } from "effect/Function";
import { Contract, ContractRunner, FunctionFragment, Signer } from "ethers";

import type * as T from "./signature.js";
import * as FunctionUtils from "./utils/functionUtils.js";

const privateApiSymbol = Symbol("com/liquidity_lab/crypto/blockchain/signature#PrivateApi");

interface SignatureTxPrivateApi {
  readonly signer: Signer;
  // readonly toTx: Effect.Effect<SignatureTxShape, FatalError, Chain.Tag>;
}

interface SignatureTxShape {
  readonly [privateApiSymbol]: SignatureTxPrivateApi;
}

export class SignatureTxTag extends Context.Tag("SignatureTxTag")<
  SignatureTxTag,
  SignatureTxShape
>() {}

class ContractOpsLive implements T.ContractOps {
  private readonly defaultProvider: ContractRunner;
  private readonly makeContract: (runner: ContractRunner | null) => Contract;

  constructor(
    defaultProvider: ContractRunner,
    makeContract: (runner: ContractRunner | null) => Contract,
  ) {
    this.defaultProvider = defaultProvider;
    this.makeContract = makeContract;
  }

  connect(runner: ContractRunner): Contract {
    return this.makeContract(runner);
  }

  encodeFunctionData(fragment: string | FunctionFragment, values?: readonly unknown[]): string {
    return this.makeContract(null).interface.encodeFunctionData(fragment, values);
  }

  get withOnChainRunner(): Contract {
    return this.makeContract(this.defaultProvider);
  }
}

export function makeContractOps(
  defaultProvider: ContractRunner,
  f: (runner: ContractRunner | null) => Contract,
): T.ContractOps {
  return new ContractOpsLive(defaultProvider, f);
}

export const signedContract = FunctionUtils.withOptionalServiceApi(
  SignatureTxTag,
  signedContractImpl,
).value;

export function signedContractImpl(
  { [privateApiSymbol]: api }: SignatureTxShape,
  ops: T.ContractOps,
): Contract {
  return ops.connect(api.signer);
}

export const signVia = dual(2, signViaImpl);

function signViaImpl<A, E, R>(
  fa: Effect.Effect<A, E, R>,
  signer: Signer,
): Effect.Effect<A, E, Exclude<R, SignatureTxTag>> {
  const api: SignatureTxPrivateApi = {
    signer,
  };

  return Effect.provideService(fa, SignatureTxTag, { [privateApiSymbol]: api });
}
