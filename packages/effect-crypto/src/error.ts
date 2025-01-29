import { Effect, Either } from "effect";
import { Contract, ErrorDescription } from "ethers";

import * as Adt from "./adt.js";
import * as internal from "./error.internal.js";

export type { ErrorCode } from "./error.internal.js";

/**
 * A blockchain error that can be thrown by a contract call.
 */
export type BlockchainError = RefinedBlockchainError | RawBlockchainError;

/**
 * Type guard for BlockchainError
 */
export const isBlockchainError: (err: unknown) => err is BlockchainError =
  internal.isBlockchainError;

export interface TransactionFailedError {
  readonly _tag: "TransactionFailedError";
  readonly message: string;
}

/**
 * Creates a new TransactionFailedError instance
 *
 * @constructor
 */
export const TransactionFailedError: (message: string) => TransactionFailedError =
  internal.makeTransactionFailedError;

export interface InsufficientFundsBlockchainError {
  readonly _tag: "BlockchainError";
  readonly _kind: "InsufficientFundsBlockchainError";

  readonly toFatalError: Adt.FatalError;
}

/**
 * Creates a new InsufficientFundsBlockchainError.
 *
 * @constructor
 */
export const InsufficientFundsBlockchainError: () => InsufficientFundsBlockchainError =
  internal.makeInsufficientFundsBlockchainError;

/**
 * Type Guard for InsufficientFundsBlockchainError.
 */
export const isInsufficientFundsBlockchainError: (
  err: unknown,
) => err is InsufficientFundsBlockchainError = internal.isInsufficientFundsBlockchainError;

export type TypedErrorDescription = InsufficientFundsBlockchainError;

/**
 * RefinedBlockchainError is a type that represents a blockchain error with additional information.
 * Usually the additional information is parsed using contract ABI.
 */
export interface RefinedBlockchainError {
  readonly _tag: "BlockchainError";
  readonly _kind: "RefinedBlockchainError";

  /** Error code */
  readonly code: internal.ErrorCode;
  readonly description: Either.Either<TypedErrorDescription, ErrorDescription>;
}

/**
 * Create a refined blockchain error from error code and description
 * @constructor
 */
export const RefinedBlockchainError: (
  code: internal.ErrorCode,
  description: ErrorDescription,
) => RefinedBlockchainError = internal.makeRefinedBlockchainErrorFromDesc;

/**
 * A type guard for refined blockchain errors
 */
export const isRefinedBlockchainError: (error: unknown) => error is RefinedBlockchainError =
  internal.isRefinedBlockchainError;

/**
 * RawBlockchainError is a type representing a raw blockchain error.
 * All the data is unparsed and comes from the underlying blockchain provider.
 */
export interface RawBlockchainError {
  readonly _tag: "BlockchainError";
  readonly _kind: "RawBlockchainError";

  readonly data?: string;
  readonly code: internal.ErrorCode;

  /**
   * Try to refine the error by providing the contract instance.
   * If the error is not related to the contract, it will return the same error.
   */
  refine(contract: Contract): BlockchainError;

  readonly toFatalError: Adt.FatalError;
}

/** Type guard for RawBlockchainError */
export const isRawBlockchainError: (err: unknown) => err is RawBlockchainError =
  internal.isRawBlockchainError;

/**
 * Any interaction with contracts should be done through this function.
 */
export const catchBlockchainErrors: <A, E, R>(
  fa: Effect.Effect<A, E, R>, // TODO: design a better way to run all blockchain interactions via this function
) => Effect.Effect<A, E | BlockchainError, R> = internal.catchBlockchainErrorsImpl;

/**
 * Tries to refine the error by providing the contract instance.
 * If the error is not related to the contract, it will return the same error.
 */
export const refineBlockchainError: <A, E, R>(
  fa: Effect.Effect<A, E | RawBlockchainError, R>,
  contract: Contract,
) => Effect.Effect<A, E | BlockchainError, R> = internal.refineBlockchainErrorImpl;

/**
 * Use this function to combine [[catchBlockchainErrors]] and [[refineBlockchainError]]
 *
 * @param fa
 * @param contract
 */
export function catchRefinedBlockchainErrors<A, E, R>(
  fa: Effect.Effect<A, E, R>,
  contract: Contract,
): Effect.Effect<A, E | BlockchainError, R> {
  return refineBlockchainError(catchBlockchainErrors(fa), contract);
}
