import { Effect, Either, Option } from "effect";
import { constant } from "effect/Function";
import { isRecord } from "effect/Predicate";
import { Contract, ErrorDescription } from "ethers";

import * as Adt from "./adt.js";
import * as T from "./error.js";

/**
 * Error codes for blockchain errors
 */
export enum ErrorCode {
  CallException,
}

export function isBlockchainError(err: unknown): err is T.BlockchainError {
  return (
    typeof err === "object" && err !== null && "_tag" in err && err["_tag"] === "BlockchainError"
  );
}

class TransactionFailedErrorLive implements T.TransactionFailedError {
  readonly _tag = "TransactionFailedError";
  readonly message: string;

  constructor(message: string) {
    this.message = message;
  }
}

export function makeTransactionFailedError(message: string): T.TransactionFailedError {
  return new TransactionFailedErrorLive(message);
}

class RefinedBlockchainErrorLive implements T.RefinedBlockchainError {
  readonly _tag = "BlockchainError";
  readonly _kind = "RefinedBlockchainError";

  readonly description: Either.Either<T.TypedErrorDescription, ErrorDescription>;
  readonly code: ErrorCode;

  constructor(
    code: ErrorCode,
    description: Either.Either<T.TypedErrorDescription, ErrorDescription>,
  ) {
    this.code = code;
    this.description = description;
  }

  get toFatalError(): Adt.FatalError {
    const description = Either.match(this.description, {
      onLeft: (underlying) =>
        `Uncategorized error name[${underlying.name}], args[${underlying.args.join(", ")}]`,
      onRight: (description) => {
        switch (description._kind) {
          case "InsufficientFundsBlockchainError":
            return description.toFatalError;
          default:
            return `Unknown error name[${description._kind}]`;
        }
      },
    });

    return Adt.FatalErrorString(
      `Error happened during blockchain operation, code[${this.code}], description: ${description}`,
    );
  }
}

export function makeRefinedBlockchainErrorFromDesc(
  code: ErrorCode,
  description: ErrorDescription,
): T.RefinedBlockchainError {
  return new RefinedBlockchainErrorLive(code, parseDescription(description));
}

export function isRefinedBlockchainError(err: unknown): err is T.RefinedBlockchainError {
  return isBlockchainError(err) && "_kind" in err && err["_kind"] === "RefinedBlockchainError";
}

class InsufficientFundsBlockchainErrorLive implements T.InsufficientFundsBlockchainError {
  readonly _tag = "BlockchainError";
  readonly _kind = "InsufficientFundsBlockchainError";

  static reason: string = "ERC20: transfer amount exceeds balance";

  get toFatalError(): Adt.FatalError {
    return Adt.FatalErrorString(
      "Insufficient funds error happened during the token transfer" +
        InsufficientFundsBlockchainErrorLive.reason,
    );
  }
}

export function makeInsufficientFundsBlockchainError(): T.InsufficientFundsBlockchainError {
  return new InsufficientFundsBlockchainErrorLive();
}

export function isInsufficientFundsBlockchainError(
  err: unknown,
): err is T.InsufficientFundsBlockchainError {
  return (
    isRefinedBlockchainError(err) &&
    Either.match(err.description, {
      onLeft: () => false,
      onRight: (description) => description._kind === "InsufficientFundsBlockchainError",
    })
  );
}

class RawBlockchainErrorLive implements T.RawBlockchainError {
  readonly _tag = "BlockchainError";
  readonly _kind = "RawBlockchainError";

  readonly data?: string;
  readonly code: ErrorCode;

  constructor(code: ErrorCode, data?: string) {
    this.data = data;
    this.code = code;
  }

  refine(contract: Contract): T.BlockchainError {
    const { code, data } = this;

    if (typeof data !== "string") {
      return this;
    }

    const resOpt = Option.gen(function* () {
      const decoded = Either.try(() => contract.interface.parseError(data));
      const maybeDescription = yield* Either.getRight(decoded);
      const description = yield* Option.fromNullable(maybeDescription);

      return makeRefinedBlockchainErrorFromDesc(code, description);
    });

    return Option.getOrElse(resOpt, constant(this));
  }

  get toFatalError(): Adt.FatalError {
    return Adt.FatalErrorString(`Error happened during blockchain operation, code[${this.code}]`);
  }
}

export function isRawBlockchainError(err: unknown): err is T.RawBlockchainError {
  return isBlockchainError(err) && err._kind === "RawBlockchainError";
}

export function catchBlockchainErrorsImpl<A, E, R>(
  fa: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | T.BlockchainError, R> {
  return Effect.catchSomeDefect(fa, (e) => {
    if (!isRecord(e)) {
      return Option.none();
    }

    return Option.gen(function* () {
      const code = yield* parseCode(e);

      if (typeof e.data !== "string") {
        return yield* Option.none();
      }

      if (
        typeof e.reason === "string" &&
        e.reason === InsufficientFundsBlockchainErrorLive.reason
      ) {
        return Effect.fail(
          new RefinedBlockchainErrorLive(
            code,
            Either.right(new InsufficientFundsBlockchainErrorLive()),
          ),
        );
      }

      return Effect.fail(new RawBlockchainErrorLive(code, e.data));
    });
  });
}

export function refineBlockchainErrorImpl<A, E, R>(
  fa: Effect.Effect<A, E | T.RawBlockchainError, R>,
  contract: Contract,
): Effect.Effect<A, E | T.BlockchainError, R> {
  return Effect.mapError(fa, (e) => {
    if (isRawBlockchainError(e)) {
      return e.refine(contract);
    }

    return e;
  });
}

function parseDescription(
  description: ErrorDescription,
): Either.Either<T.TypedErrorDescription, ErrorDescription> {
  switch (description.signature) {
    case "Error(string)": {
      switch (description.args[0]) {
        case "ERC20: transfer amount exceeds balance":
          return Either.right(makeInsufficientFundsBlockchainError());
        default:
          return Either.left(description);
      }
    }
    default:
      return Either.left(description);
  }
}

function parseCode(e: Record<string, unknown>): Option.Option<ErrorCode> {
  switch (e["code"]) {
    case "CALL_EXCEPTION":
      return Option.some(ErrorCode.CallException);
    default:
      return Option.none();
  }
}
