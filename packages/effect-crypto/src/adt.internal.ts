import { Either } from "effect";
import { getAddress } from "ethers";

import type * as Adt from "~/adt.js";

export function makeAddress(
  address: string,
  bypassChecksum: boolean = false
): Either.Either<Adt.Address, unknown> {
  return Either.try(() =>
    bypassChecksum ? checkValidAddress(address) : validateAndParseAddress(address)
  ) as Either.Either<Adt.Address, unknown>;
}

export function makeAddressUnsafe(address: string, bypassChecksum: boolean = false): Adt.Address {
  return Either.getOrThrow(makeAddress(address, bypassChecksum));
}

// Checks a string starts with 0x, is 42 characters long and contains only hex characters after 0x
const startsWith0xLen42HexRegex = /^0x[0-9a-fA-F]{40}$/;

function validateAndParseAddress(address: string): string {
  try {
    return getAddress(address);
  } catch (error) {
    throw new Error(`${address} is not a valid address.`);
  }
}

/**
 * Checks if an address is valid by checking 0x prefix, length === 42 and hex encoding.
 * @param address the unchecksummed hex address
 * @see https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/utils/validateAndParseAddress.ts#L22
 */
function checkValidAddress(address: string): string {
  if (startsWith0xLen42HexRegex.test(address)) {
    return address;
  }
  throw new Error(address + " is not a valid address.");
}

class FatalErrorLive implements Adt.FatalError {
  readonly _tag = "FatalError";
  readonly underlying: Error;

  constructor(underlying: Error) {
    this.underlying = underlying;
  }
}

export function isFatalError(err: unknown): err is Adt.FatalError {
  return typeof err === "object" && err !== null && "_tag" in err && err["_tag"] === "FatalError";
}

export function makeFatalError(underlying: Error): Adt.FatalError {
  return new FatalErrorLive(underlying);
}

export function makeFatalErrorFromString(message: string): Adt.FatalError {
  return new FatalErrorLive(new Error(message));
}

export function makeFatalErrorFromUnknown(cause: unknown): Adt.FatalError {
  if (typeof cause === "string") {
    return makeFatalErrorFromString(cause);
  }

  if (typeof cause === "object" && cause instanceof Error) {
    return new FatalErrorLive(cause);
  }

  return makeFatalErrorFromString(`Unknown error happened: ${JSON.stringify(cause)}`);
}
