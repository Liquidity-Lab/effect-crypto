/**
 * @file packages/effect-crypto-uniswap/src/position.test-d.ts
 */
import { Either, Option } from "effect";
import { assertType, expectTypeOf, test } from "vitest";

import * as Pool from "./pool.js";
import * as Position from "./position.js";

test("PositionDraftBuilder should be pipable", () => {
  const poolState: Pool.PoolState = null as any;
  const slot0: Pool.Slot0 = null as any;
  const liquidity: Pool.Liquidity = null as any;

  // Step 1: Create initial builder - should return EmptyState
  const initialBuilder = Position.draftBuilder(poolState, slot0);
  assertType<Position.EmptyState>(initialBuilder);

  // Step 2: Set lower tick bound - should return EmptyState & StateWithLowerBound
  const builderWithLowerTick = initialBuilder.pipe(
    // We don't really care about correctness of the data here
    Position.setLowerTickBound((current) => Option.some(current)),
  );
  assertType<Position.EmptyState & Position.StateWithLowerBound>(builderWithLowerTick);

  // Step 3: Set upper tick bound - should return EmptyState & StateWithLowerBound & StateWithUpperBound
  const builderWithBothTicks = builderWithLowerTick.pipe(
    // We don't really care about correctness of the data here
    Position.setUpperTickBound((current) => Option.some(current)),
  );
  assertType<Position.EmptyState & Position.StateWithLowerBound & Position.StateWithUpperBound>(
    builderWithBothTicks,
  );

  // Step 4: Set size from liquidity - should return EmptyState & StateWithLowerBound & StateWithUpperBound & StateWithSize
  const builderWithSize = builderWithBothTicks.pipe(Position.setSizeFromLiquidity(liquidity));
  assertType<Position.BuilderReady>(builderWithSize);

  // Step 5: Finalize draft - should return Either<PositionDraft, AggregateBuilderError>
  const finalResult = builderWithSize.pipe(Position.finalizeDraft);
  assertType<Either.Either<Position.PositionDraft, Position.AggregateBuilderError>>(finalResult);
});

test("PositionDraftBuilder should support price bounds", () => {
  const poolState: Pool.PoolState = null as any;
  const slot0: Pool.Slot0 = null as any;
  const liquidity: Pool.Liquidity = null as any;

  // Step 1: Create initial builder - should return EmptyState
  const initialBuilder = Position.draftBuilder(poolState, slot0);
  assertType<Position.EmptyState>(initialBuilder);

  // Step 2: Set lower price bound - should return EmptyState & StateWithLowerBound
  const builderWithLowerPrice = initialBuilder.pipe(
    Position.setLowerPriceBound((currentPrice) => Option.some(currentPrice)),
  );
  assertType<Position.EmptyState & Position.StateWithLowerBound>(builderWithLowerPrice);

  // Step 3: Set upper price bound - should return EmptyState & StateWithLowerBound & StateWithUpperBound
  const builderWithBothPrices = builderWithLowerPrice.pipe(
    Position.setUpperPriceBound((currentPrice) => Option.some(currentPrice)),
  );
  assertType<Position.EmptyState & Position.StateWithLowerBound & Position.StateWithUpperBound>(
    builderWithBothPrices,
  );

  // Step 4: Set size from liquidity - should return EmptyState & StateWithLowerBound & StateWithUpperBound & StateWithSize
  const builderWithSize = builderWithBothPrices.pipe(Position.setSizeFromLiquidity(liquidity));
  assertType<Position.BuilderReady>(builderWithSize);

  // Step 5: Finalize draft - should return Either<PositionDraft, AggregateBuilderError>
  const finalResult = builderWithSize.pipe(Position.finalizeDraft);
  assertType<Either.Either<Position.PositionDraft, Position.AggregateBuilderError>>(finalResult);
});

test("BuilderError should be matchable", () => {
  const handleError = Position.matchBuilderError({
    [Position.InvalidTickBoundsError.tag]: (error) => `Tick bounds error: ${error.message}`,
    [Position.InvalidUpperTickError.tag]: (error) => `Invalid upper tick: ${error.message}`,
    [Position.InvalidLowerTickError.tag]: (error) => `Invalid lower tick: ${error.message}`,
    [Position.InvalidSizeError.tag]: (error) => `Invalid size: ${error.message}`,
    [Position.InvalidPriceError.tag]: (error) => `Invalid price: ${error.message}`,
  });

  const someBuilderError: Position.BuilderError = null as any;

  expectTypeOf(handleError).returns.toEqualTypeOf<string>();
  expectTypeOf(handleError).toBeCallableWith(someBuilderError);
});
