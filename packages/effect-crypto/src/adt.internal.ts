import * as fc from "fast-check";
import { Brand, Either } from "effect";
import { ZeroAddress, getAddress } from "ethers";

import type * as T from "./adt.js";

class FatalErrorLive implements T.FatalError {
  readonly _tag = "@liquidity_lab/effect-crypto/adt#FatalError";
  readonly underlying: Error;

  constructor(underlying: Error) {
    this.underlying = underlying;
  }
}

/** @internal */
export function isFatalError(err: unknown): err is T.FatalError {
  return typeof err === "object" && err !== null && "_tag" in err && err["_tag"] === "FatalError";
}

/** @internal */
export function makeFatalError(underlying: Error): T.FatalError {
  return new FatalErrorLive(underlying);
}

/** @internal */
export function makeFatalErrorFromString(message: string): T.FatalError {
  return new FatalErrorLive(new Error(message));
}

/** @internal */
export function makeFatalErrorFromUnknown(cause: unknown): T.FatalError {
  if (typeof cause === "string") {
    return makeFatalErrorFromString(cause);
  }

  if (typeof cause === "object" && cause instanceof Error) {
    return new FatalErrorLive(cause);
  }

  return makeFatalErrorFromString(`Unknown error happened: ${JSON.stringify(cause)}`);
}

export type AddressTypeId = "com/liquidity_lab/effect-crypto/adt#Address";

const addressConstructor = Brand.nominal<T.Address>();

/** @internal */
export function makeAddress(
  address: string,
  bypassChecksum: boolean = false,
): Either.Either<T.Address, T.FatalError> {
  return Either.mapLeft(
    Either.try(() =>
      addressConstructor(
        bypassChecksum ? checkValidAddress(address) : validateAndParseAddress(address),
      ),
    ) as Either.Either<T.Address, unknown>,
    (e) => makeFatalErrorFromUnknown(e),
  );
}

/** @internal */
export function makeAddressUnsafe(address: string, bypassChecksum: boolean = false): T.Address {
  return Either.getOrThrow(makeAddress(address, bypassChecksum));
}

/** @internal */
export const zeroAddress = makeAddressUnsafe(ZeroAddress);

/** @internal */
export function isZeroAddress(address: T.Address): boolean {
  return address === zeroAddress;
}

// Checks a string starts with 0x, is 42 characters long and contains only hex characters after 0x
const startsWith0xLen42HexRegex = /^0x[0-9a-fA-F]{40}$/;

function validateAndParseAddress(address: string): string {
  try {
    return getAddress(address);
  } catch (error) {
    throw new Error(`${address} is not a valid address.`, { cause: error });
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

/** @internal */
export function toHex(value: bigint): string {
  const hex = value.toString(16);

  return `0x${hex.length % 2 !== 0 ? "0" : ""}${hex}`;
}

export function addressGenImpl() {
  return fc.hexaString({ minLength: 40, maxLength: 40 }).map((hex) => {
    const address = `0x${hex}`;

    return makeAddressUnsafe(address, true);
  });
}
