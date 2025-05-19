import { Brand, Either, Function, Option } from "effect";

/*export function smartConstructor<A extends Brand.Brand<any>>(
  f: (
    unbranded: Brand.Brand.Unbranded<A>,
  ) => Either.Either<Brand.Brand.Unbranded<A>, Brand.Brand.BrandErrors>,
): Brand.Brand.Constructor<A>;*/

export function smartConstructor<A extends Brand.Brand<any>>(
  f: (
    unbranded: Brand.Brand.Unbranded<A>,
  ) => Either.Either<Brand.Brand.Unbranded<A>, Brand.Brand.BrandErrors>,
): Brand.Brand.Constructor<A> {
  const either: (
    unbranded: Brand.Brand.Unbranded<A>,
  ) => Either.Either<A, Brand.Brand.BrandErrors> = (unbranded) =>
    Either.map(f(unbranded), (unbranded: Brand.Brand.Unbranded<A>) => unbranded as A);

  return Object.assign(
    (unbranded: Brand.Brand.Unbranded<A>) =>
      Either.getOrThrowWith(either(unbranded), Function.identity),
    {
      [Brand.RefinedConstructorsTypeId]: Brand.RefinedConstructorsTypeId,
      option: (args: any) => Option.getRight(either(args)),
      either,
      is: (args: any): args is Brand.Brand.Unbranded<A> & A => Either.isRight(either(args)),
    },
  ) as any;
}

/**
 * Converts a collection of brand validation errors into a readable string format.
 * Each error is formatted to show its error message and associated metadata.
 *
 * @example
 * import { Brand } from "effect"
 * import { stringifyBrandErrors } from "./brandUtils"
 *
 * const errors = Brand.error("Invalid input", { value: 123 })
 * console.log(stringifyBrandErrors(errors))
 * // Output: "errorMessage[Invalid input] with meta[{"value":123}]"
 *
 * @since 0.1.0
 * @category errors
 * @param errors - The brand errors to stringify
 * @returns A string representation of the brand errors
 */
export function stringifyBrandErrors(errors: Brand.Brand.BrandErrors): string {
  return errors
    .map(({ meta, message }) => `errorMessage[${message}] with meta[${JSON.stringify(meta || "")}]`)
    .join(", ");
}
