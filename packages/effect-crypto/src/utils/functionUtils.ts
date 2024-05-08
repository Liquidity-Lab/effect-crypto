import { Context, Effect } from "effect";

/**
 * Helper function to modify a function that accepts a service as the first argument.
 * If the service is not provided, it will be fetched from the context.
 *
 * @example
 *   class SomeService extends Context.Tag("SomeService")<SomeService, {}> {}
 *
 *   const internalFoo: (service: Context.Tag.Service<SomeService>, otherArg: string) => Effect.Effect<number, Error>
 *
 *   const foo: {
 *     (service: Context.Tag.Service<SomeService>, otherArg: string) => Effect.Effect<number, Error>
 *      (otherArg: string) => Effect.Effect<number, Error, SomeService>
 *   } = withOptionalService(SomeService, internalFoo);
 *
 *
 * @param tag
 * @param fn
 */
export function withOptionalService<
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  Service extends Context.Tag<any, any>,
  Args extends unknown[],
  A,
  E,
  R,
>(
  tag: Service,
  fn: {
    (service: Context.Tag.Service<Service>, ...args: Args): Effect.Effect<A, E, R>;
    (service: Context.Tag.Service<Service>, ...args: Args): A;
  },
): {
  (...args: Args): Effect.Effect<A, E, Context.Tag.Identifier<Service> | R>;
  (service: Context.Tag.Service<Service>, ...args: Args): Effect.Effect<A, E, R>;
} {
  function overloaded(...args: Args | [Context.Tag.Service<Service>, ...Args]) {
    function isServiceNotProvided(args: unknown[]): args is Args {
      return args.length === fn.length - 1;
    }

    function wrapResult(
      service: Context.Tag.Service<Service>,
      ...args: Args
    ): Effect.Effect<A, E, R> {
      const res = fn(service, ...args);

      if (Effect.isEffect(res)) {
        return res;
      }
      return Effect.succeed(res);
    }

    if (isServiceNotProvided(args)) {
      // Service isn't provided, get it from context
      return Effect.gen(function* () {
        const service = yield* tag;

        return yield* wrapResult(service, ...args);
      });
    } else {
      // Service provided
      const [service, ...rest] = args;

      return wrapResult(service, ...rest);
    }
  }

  return overloaded;
}

type WithOptionalServiceOps<
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  Service extends Context.Tag<any, any>,
  Args extends unknown[],
  A,
  E,
  R,
> = {
  value: {
    (...args: Args): Effect.Effect<A, E, Context.Tag.Identifier<Service> | R>;
    (service: Context.Tag.Service<Service>, ...args: Args): Effect.Effect<A, E, R>;
  };
  contramapEvalService<NewService extends Context.Tag<any, any>, E1 = never, R1 = never>(
    cF: (
      newService: Context.Tag.Service<NewService>,
    ) => Effect.Effect<Context.Tag.Service<Service>, E1, R1>,
  ): WithOptionalServiceOps<NewService, Args, A, E | E1, R | R1>;
};

/**
 * Helper function to modify a function that accepts a service as the first argument.
 * If the service is not provided, it will be fetched from the context.
 * In addition, you can contramap service to either a different service or just any value
 *
 * @example
 *   class SomeService extends Context.Tag("SomeService")<SomeService, {}> {}
 *   class AnotherService extends Context.Tag("AnotherService")<AnotherService, {
 *    asSomeService: Context.Tag.Service<SomeService>
 *   }> {}
 *
 *   const internalFoo: (service: Context.Tag.Service<SomeService>, otherArg: string) => Effect.Effect<number, Error>
 *
 *   const foo: {
 *     (service: Context.Tag.Service<AnotherService>, otherArg: string) => Effect.Effect<number, Error>
 *     (otherArg: string) => Effect.Effect<number, Error, SomeService>
 *   } = Function.withOptionalServiceApi(SomeService, internalFoo)
 *      .contramapEvalService((anotherService) => Effect.succeed(anotherService.asSomeService))
 *      .value;
 *
 *
 * @param tag
 * @param fn
 */
export function withOptionalServiceApi<
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  Service extends Context.Tag<any, any>,
  Args extends unknown[],
  A,
  E = never,
  R = never,
>(
  tag: Service,
  fn: (service: Context.Tag.Service<Service>, ...args: Args) => Effect.Effect<A, E, R> | A,
): WithOptionalServiceOps<Service, Args, A, E, R> {
  function wrapResult(
    service: Context.Tag.Service<Service>,
    ...args: Args
  ): Effect.Effect<A, E, R> {
    const res = fn(service, ...args);

    if (Effect.isEffect(res)) {
      return res;
    }
    return Effect.succeed(res);
  }

  function overloaded(...args: Args | [Context.Tag.Service<Service>, ...Args]) {
    function isServiceNotProvided(args: unknown[]): args is Args {
      return args.length === fn.length - 1;
    }

    if (isServiceNotProvided(args)) {
      // Service isn't provided, get it from context
      return Effect.gen(function* () {
        const service = yield* tag;

        return yield* wrapResult(service, ...args);
      });
    } else {
      // Service provided
      const [service, ...rest] = args;

      return wrapResult(service, ...rest);
    }
  }

  function contramapEvalService<NewService extends Context.Tag<any, any>, E1, R1>(
    cF: (
      newService: Context.Tag.Service<NewService>,
    ) => Effect.Effect<Context.Tag.Service<Service>, E1, R1>,
  ): WithOptionalServiceOps<NewService, Args, A, E | E1, R | R1> {
    function overloaded(...args: Args | [Context.Tag.Service<NewService>, ...Args]) {
      function isServiceNotProvided(args: unknown[]): args is Args {
        return args.length === fn.length - 1;
      }

      if (isServiceNotProvided(args)) {
        // Service isn't provided, get it from context
        return Effect.gen(function* () {
          const service = yield* tag;

          return yield* wrapResult(service, ...args);
        });
      } else {
        // Service provided
        const [newService, ...rest] = args;

        return Effect.flatMap(cF(newService), (service) => wrapResult(service, ...rest));
      }
    }

    return {
      value: overloaded,
      contramapEvalService: (cF2) =>
        contramapEvalService((newService2) => Effect.flatMap(cF2(newService2), cF)),
    };
  }

  return {
    value: overloaded,
    contramapEvalService,
  };
}
