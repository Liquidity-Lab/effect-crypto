/**
 * This module MUST NOT depend on any other module from this package.
 */
import { Either } from "effect";
import { Interface, InterfaceAbi } from "ethers";
import { Tagged } from "type-fest";

import * as internal from "~/adt.internal.js";

export type DeployArgs = [
  abi: Interface | InterfaceAbi,
  bytecode: string,
  args: ReadonlyArray<unknown>,
];

/**
 * Address is a tagged type that represents a blockchain address.
 */
export type Address = Tagged<string, "Address">;

/**
 * Creates a new address instance
 *
 * @example
 *   import { Address } from "~/com/liquidity_lab/crypto/blockchain";
 *
 *   const address: Either.Right<Address, unknown> = Address("0x0000000000000000000000000000000000000001");
 *   const failedAddress: Either.Left<Address, unknown> = Address("0xzzz");
 *   const unsafeAddress: Address = Address.unsafe("0x0000000000000000000000000000000000000001");
 *
 * @param address
 * @param bypassChecksum
 * @constructor
 */
export const Address: {
  (address: string, bypassChecksum: boolean): Either.Either<Address, FatalError>;
  (address: string): Either.Either<Address, FatalError>;
  unsafe(address: string, bypassChecksum?: boolean): Address;
} = Object.assign(internal.makeAddress, {
  unsafe: internal.makeAddressUnsafe,
});

/**
 * FatalError is a tagged type that represents a fatal error.
 */
export interface FatalError {
  readonly _tag: "FatalError";
  readonly underlying: Error;
}

/**
 * Creates a new FatalError instance
 *
 * @constructor
 */
export const FatalError: (underlying: Error) => FatalError = internal.makeFatalError;

/**
 * Creates a new FatalError instance from a string
 *
 * @constructor
 */
export const FatalErrorString: (message: string) => FatalError = internal.makeFatalErrorFromString;

/**
 * Creates a new FatalError instance from an unknown
 *
 * @constructor
 */
export const FatalErrorUnknown: (cause: unknown) => FatalError = internal.makeFatalErrorFromUnknown;

/**
 * Type guard for FatalError
 */
export const isFatalError: (err: unknown) => err is FatalError = internal.isFatalError;
