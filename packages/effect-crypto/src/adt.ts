/**
 * This module MUST NOT depend on any other module from this package.
 */
import { Brand, Either } from "effect";
import { Arbitrary } from "fast-check";

import * as internal from "./adt.internal.js";

/**
 * FatalError is a tagged type that represents a fatal error.
 *
 * @property _tag - The unique identifier for the FatalError type.
 * @property underlying - The original Error object that caused the fatal error.
 *
 * @example
 * ```typescript
 * // Represents a fatal error wrapping a standard JavaScript Error
 * declare const myFatalError: FatalError;
 * console.log(myFatalError._tag); // "@liquidity_lab/effect-crypto/adt#FatalError"
 * console.log(myFatalError.underlying); // The original Error object
 * ```
 */
export interface FatalError {
  readonly _tag: "@liquidity_lab/effect-crypto/adt#FatalError";
  readonly underlying: Error;
}

/**
 * Creates a new FatalError instance
 *
 * @example
 *   import { FatalError } from "effect-crypto";
 *
 *   const error = FatalError(new Error("Something went wrong"));
 *
 * @constructor
 */
export const FatalError: (underlying: Error) => FatalError = internal.makeFatalError;

/**
 * Creates a new FatalError instance from a string
 *
 * @example
 *   import { FatalErrorString } from "effect-crypto";
 *
 *   const error = FatalErrorString("Something went wrong");
 *
 * @constructor
 */
export const FatalErrorString: (message: string) => FatalError = internal.makeFatalErrorFromString;

/**
 * Creates a new FatalError instance from an unknown
 *
 * @example
 *   import { FatalErrorUnknown } from "effect-crypto";
 *
 *   try {
 *     throw new Error("Something went wrong");
 *   } catch (e) {
 *     const error = FatalErrorUnknown(e);
 *   }
 *
 * @constructor
 */
export const FatalErrorUnknown: (cause: unknown) => FatalError = internal.makeFatalErrorFromUnknown;

/**
 * Type guard for FatalError
 *
 * @example
 *   import { FatalError, isFatalError } from "effect-crypto";
 *
 *   const error = FatalError(new Error("Something went wrong"));
 *   if (isFatalError(error)) {
 *     console.log(error.underlying);
 *   }
 */
export const isFatalError: (err: unknown) => err is FatalError = internal.isFatalError;

/**
 * Maps the error message of a FatalError using the provided function.
 *
 * @param a - The FatalError instance to modify.
 * @param f - A function that takes the current error message string and returns a new message string.
 * @returns A new FatalError instance with the updated error message.
 *
 * @example
 *   import { FatalErrorString, mapErrorMessage } from "effect-crypto";
 *
 *   const originalError = FatalErrorString("Initial failure");
 *   const updatedError = mapErrorMessage(originalError, msg => `FATAL: ${msg.toUpperCase()}`);
 *
 *   console.log(updatedError.underlying.message); // Output: "FATAL: INITIAL FAILURE"
 */
export const mapErrorMessage: {
  (a: FatalError, f: (msg: string) => string): FatalError;
} = internal.mapErrorMessageImpl;

/**
 * Address is a tagged type that represents a blockchain address.
 * It's a branded string, ensuring type safety for Ethereum addresses.
 *
 * @example
 * ```typescript
 * import { Address, FatalError } from "effect-crypto";
 * import { Either } from "effect";
 *
 * const validAddressString = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
 * const invalidAddressString = "0xInvalid";
 *
 * const maybeAddress1: Either.Either<Address, FatalError> = Address(validAddressString);
 * const maybeAddress2: Either.Either<Address, FatalError> = Address(invalidAddressString);
 * const unsafeAddress: Address = Address.unsafe(validAddressString); // Use with caution
 * const zeroAddr: Address = Address.zero;
 *
 * if (Either.isRight(maybeAddress1)) {
 *   const address: Address = maybeAddress1.right;
 *   console.log("Valid address:", address);
 * } else {
 *   console.error("Failed to create address:", maybeAddress1.left.underlying.message);
 * }
 *
 * console.log("Unsafe address:", unsafeAddress);
 * console.log("Zero address:", zeroAddr);
 * ```
 */
export type Address = Brand.Branded<string, internal.AddressTypeId>;

/**
 * Creates a new address instance
 *
 * @example
 *   import { Address } from "effect-crypto";
 *
 *   // Standard usage
 *   const address = Address("0x0000000000000000000000000000000000000001");
 *
 *   // With checksum bypass
 *   const unchecked = Address("0x0000000000000000000000000000000000000001", true);
 *
 *   // Using unsafe constructor
 *   const unsafe = Address.unsafe("0x0000000000000000000000000000000000000001");
 *
 *   // Zero address
 *   const zero = Address.zero;
 *
 * @param address
 * @param bypassChecksum
 * @constructor
 */
export const Address: {
  (address: string, bypassChecksum: boolean): Either.Either<Address, FatalError>;
  (address: string): Either.Either<Address, FatalError>;
  unsafe(address: string, bypassChecksum?: boolean): Address;
  zero: Address;
} = Object.assign(internal.makeAddress, {
  unsafe: internal.makeAddressUnsafe,
  zero: internal.zeroAddress,
});

/**
 * Checks if the given address is a zero address
 *
 * @example
 *   import { Address, isZeroAddress } from "effect-crypto";
 *
 *   const address = Address.unsafe("0x0000000000000000000000000000000000000000");
 *   const isZero = isZeroAddress(address); // true
 */
export const isZeroAddress: (address: Address) => boolean = internal.isZeroAddress;

/**
 * Converts a big int to a hex string
 *
 * @example
 *   import { toHex } from "effect-crypto";
 *
 *   const hex = toHex(123456789n); // "0x75bcd15"
 *
 * @param value
 * @returns The hex encoded calldata
 */
export const toHex: (value: bigint) => string = internal.toHex;

/**
 * Generates an arbitrary Ethereum address for property-based testing.
 *
 * This generator creates valid Ethereum addresses that:
 * - Start with "0x"
 * - Are 42 characters long (including "0x")
 * - Contain only valid hexadecimal characters
 *
 * @example
 * ```typescript
 * import { fc } from "fast-check";
 * import { addressGen } from "effect-crypto";
 *
 * // Generate a random address
 * fc.assert(
 *   fc.property(addressGen(), (address) => {
 *     // address is a valid Ethereum address
 *     return address.startsWith("0x");
 *   })
 * );
 *
 * // Use with other test properties
 * fc.assert(
 *   fc.property(addressGen(), addressGen(), (addr1, addr2) => {
 *     // Test interactions between two addresses
 *   })
 * );
 * ```
 *
 * @see {@link https://ethereum.org/en/developers/docs/accounts/#account-creation | Ethereum Accounts}
 * @returns An Arbitrary that generates valid Ethereum addresses
 */
export const addressGen: {
  (): Arbitrary<Address>;
} = internal.addressGenImpl;
