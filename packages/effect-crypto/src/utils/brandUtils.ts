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
