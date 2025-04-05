import { Brand, Effect, Either, Option } from "effect";
import { LazyArg } from "effect/Function";

// TODO: circular dependency utils on effect-crypto and forth
import * as Adt from "../adt.js";
import * as BrandUtils from "./brandUtils.js";

export function getOrFail<A, E>(fa: Option.Option<A>, onNone: LazyArg<E>): Effect.Effect<A, E> {
  return Option.match(fa, {
    onSome: (a) => Effect.succeed(a),
    onNone: () => Effect.fail(onNone()),
  });
}

export function getOrFailSimpleEither<A>(
  fa: Either.Either<A, unknown>,
): Effect.Effect<A, Adt.FatalError> {
  return Either.match(fa, {
    onLeft: (cause) => Effect.fail(Adt.FatalErrorUnknown(cause)),
    onRight: (a) => Effect.succeed(a),
  });
}

export function getOrFailEither<A, E>(fa: Either.Either<A, E>): Effect.Effect<A, E> {
  return Either.match(fa, {
    onLeft: (cause) => Effect.fail(cause),
    onRight: (a) => Effect.succeed(a),
  });
}

export function getOrFailBrandErrors<A>(
  fa: Either.Either<A, Brand.Brand.BrandErrors>,
): Effect.Effect<A, Adt.FatalError> {
  return Either.match(fa, {
    onLeft: (errors) => Effect.fail(Adt.FatalErrorString(BrandUtils.stringifyBrandErrors(errors))),
    onRight: (a) => Effect.succeed(a),
  });
}

export function getOrDieEither<A>(fa: Either.Either<A, unknown>): Effect.Effect<A> {
  return Either.match(fa, {
    onLeft: (cause) => Effect.die(cause),
    onRight: (a) => Effect.succeed(a),
  });
}
