**1. Goal**

To implement a type-safe builder pattern for creating `Position.PositionDraft` objects within the `effect-crypto-uniswap` package. The builder will:

*   Use an internal state object (`PositionDraftBuilder`) to accumulate configuration.
*   Employ TypeScript's type refinement (intersection types, `Required<Pick<...>>`) to ensure all necessary parameters (bounds, size) are provided before finalization.
*   Store potentially calculated or validated fields (like bounds or desired amounts) as `Either.Either<Value, BuilderError>` to capture errors internally during the building process.
*   Offer finalization functions (`buildDraft`, `buildDraftOrThrow`) that only accept a fully configured state (`BuilderReady`) and handle accumulated errors.
*   Initially focus on the core logic and types, deferring pipeable API implementation.

**2. Desired Usage Example (Original)**

```typescript
import { TokenVolume } from 'effect-crypto`;
import { Price, Pool, Position, Tick } from 'effect-crypto-uniswap`;

declare const pool: Pool.State;
declare const slot0price: Pool.Slot0Price;

const draft: Position.PositionDraft = Position.draftBuilder(pool, slot0price).pipe( // Creates empty draft for pool
  // Add lower bound as Tick
  Position.addLowerTickBound((usableTick: Tick.UsableTick) => Tick.subtractNTicks(usableTick, 2)),
  // Add upper bound as Price, so both tick and price API's are here
  Position.addUpperPriceBound((price) => Price.addPercent(price, 10)),
  // Set amount of one token, while the other is calculated automatically
  Position.fromSingleAmount(TokenVolume.asUnits(pool.token0, "123")),
  // Get position draft, wich will be used to mint the position later
  Position.buildDraftOrThrowWith((error) => new Error(`Failed to create position draft: ${error}`)), 
  // At this point builder converted to Position.PositionDraft
);

// It should not be possible to call `getOrThrowWith` without specifying all neccessary fields, e.g.
Position.draftBuilder(pool, slot0price).pipe( // Creates empty draft for pool
  Position.addLowerTickBound((usableTick: Tick.UsableTick) => Tick.subtractNTicks(usableTick, 2)),
  Position.addUpperPriceBound((price) => Price.addPercent(price, 10)),
  // Amount is not set, compilation error
  Position.buildDraftOrThrow((error) => new Error(`Failed to create position draft: ${error}`)), 
);
```

**3. Core Types**

```typescript
// FILENAME: packages/effect-crypto-uniswap/src/position.ts

import { Either, Pipeable } from "effect";
import { BigDecimal } from "bigdecimal.js"; // Assuming BigDecimal is used internally
import { BigMath, Token, TokenVolume } from "@liquidity_lab/effect-crypto";
import * as Adt from "./adt";
import * as Pool from "./pool";
import * as Tick from "./tick";
import * as Price from "./price"; // Assuming Price module exists

/**
 * Represents errors that can occur during the builder process.
 */
export type BuilderError = {
  readonly _tag: "BuilderError"; // Refine proper tag here like @UsableTick#_tag
  readonly field: keyof PositionDraftBuilder | "calculation" | "validation";
  readonly message: string;
};


/**
 * Internal state for constructing a PositionDraft.
 * Fields that require calculation or validation store an Either<Value, BuilderError>.
 */
export interface PositionDraftBuilder extends Pipeable.Pipeable {
  // --- Core immutable context ---
  readonly pool: Pool.PoolState; // Pool details (tokens, fee, address)
  readonly slot0: Pool.Slot0; // Current pool state (sqrtPriceX96, tick, etc.)

  // --- Optional bounds ---
  readonly lowerBoundTick?: Either.Either<Tick.Tick, BuilderError>;
  readonly upperBoundTick?: Either.Either<Tick.Tick, BuilderError>;

  // --- Optional amount definition  ---
  readonly maxAmount0?: Either.Either<Adt.Amount0, BuilderError>;
  readonly maxAmount1?: Either.Either<Adt.Amount1, BuilderError>;
}

// --- Types representing the presence of specific configuration steps ---

/** Represents the state after initialization with pool and slot0 data. */
export type EmptyState = Required<Pick<PositionDraftBuilder, "pool" | "slot0">>;

/** Represents the state once the lower tick bound has been set (or failed). */
export type StateWithLowerBound = Required<Pick<PositionDraftBuilder, "lowerBoundTick">>;

/** Represents the state once the upper tick bound has been set (or failed). */
export type StateWithUpperBound = Required<Pick<PositionDraftBuilder, "upperBoundTick">>;

/** Represents the state once both bounds have been set (or failed). */
export type StateWithBounds = StateWithLowerBound & StateWithUpperBound;

/** Represents the state once a desired size (liquidity or one of the amounts) has been set (or failed). */
export type StateWithAmounts = Required<Pick<PositionDraftBuilder, "maxAmount0" | "maxAmount1">>;

/**
 * Represents a builder state that is ready for the final calculation.
 * It must have the context, both bounds, and one size definition.
 * It signifies *structural* readiness; the values within might still be Left<BuilderError>.
 */
export type BuilderReady = EmptyState & StateWithBounds & StateWithAmounts;

/**
 * Represents an aggregation of errors encountered during the build process.
 */
export type AggregateBuilderError = {
  readonly _tag: "AggregateBuilderError";
  readonly errors: ReadonlyArray<BuilderError>;
};
```

**4. Builder Function Signatures**

```typescript
// FILENAME: packages/effect-crypto-uniswap/src/position.ts

/**
 * Initializes the builder with the essential pool and current price/tick context.
 */
declare function draftBuilder(
  pool: Pool.PoolState,
  slot0: Pool.Slot0,
): EmptyState;

/**
 * Sets the lower tick boundary based on a function relative to the nearest usable tick.
 */
declare function setLowerTickBound<S extends EmptyState>(
  builder: S,
  tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.Tick>,
): S & StateWithLowerBound;

/**
 * Sets the upper tick boundary based on a function relative to the nearest usable tick.
 * Includes validation (upper > lower).
 */
declare function setUpperTickBound<S extends EmptyState>(
  builder: S,
  tickFn: (usableTick: Tick.UsableTick) => Option.Option<Tick.Tick>,
): S & StateWithUpperBound;

/**
 * Sets the upper tick boundary based on a target price relative to the current price.
 * Converts price to tick internally. Includes validation (upper > lower).
 */
declare function setUpperPriceBound<S extends EmptyState>(
  builder: S,
  priceFn: (currentPrice: Price.Price) => Option.Option<Price.Price>,
): S & StateWithUpperBound;


/**
 * Sets the upper tick boundary based on a target price relative to the current price.
 * Converts price to tick internally. Includes validation (upper > lower).
 */
declare function setLowerPriceBound<S extends EmptyState>(
  builder: S,
  priceFn: (currentPrice: Price.Price) => Option.Option<Price.Price>,
): S & StateWithLowerBound;

/**
 * Sets the desired position size using a specific amount of token0.
 * Clears other size definitions internally.
 */
declare function fromSingleAmount<S extends EmptyState, T extends Token.TokenType>(
  builder: S,
  volume: TokenVolume.TokenVolume<T>,
): S & Required<Pick<PositionDraftBuilder, "maxAmount0" | "maxAmount1">>;

```

**5. Finalization Function Signatures**

```typescript
/**
 * Finalizes the PositionDraft creation from the builder state. Collects internal errors.
 * Returns Either the draft or aggregated errors.
 */
declare function finalizeDraft(
  state: BuilderReady,
): Either.Either<PositionDraft, AggregateBuilderError>;

/**
 * Calls `finalizeDraft` and throws if it returns Left.
 */
declare function finalizeDraftOrThrow(
  state: BuilderReady,
  errorHandler: (aggError: AggregateBuilderError) => Error,
): PositionDraft;
```

**6. Implementation Mechanism**

*   **State Progression:** Each builder function (`setLowerTickBound`, etc.) takes the current state object (`S`) and returns a *new*, immutable state object (`S & StateWith...`). The intersection type `& StateWith...` signals to TypeScript that the returned object now definitely includes the properties defined in that state fragment (e.g., `lowerBoundTick`).
*   **Type Safety:** The `finalizeDraft` and `finalizeDraftOrThrow` functions explicitly require the `BuilderReady` type as input. TypeScript will generate a compile-time error if a state object that hasn't passed through all the necessary builder steps (setting context, lower bound, upper bound, and *one* size definition) is passed to them, because it won't structurally match `BuilderReady`.
*   **Error Handling:** Functions like `setUpperTickBound` or `setUpperPriceBound` perform internal validation (e.g., tickUpper > tickLower). If validation fails, they store `Either.Left(makeBuilderError(...))` in the corresponding state field (`upperBoundTick`). The `finalizeDraft` function checks all relevant `Either` fields in the input `BuilderReady` object. If any are `Left`, it aggregates these `BuilderError`s into an `AggregateBuilderError` and returns `Either.Left(aggregatedError)`. Only if all required fields contain `Either.Right(value)` does it proceed to call the internal calculation functions (like `calculatePositionDraftFromAmounts`), wrapping their potential errors as well.
*   **Immutability:** Builder functions must return new state objects (`{ ...state, newField: ... }`) instead of modifying the input state directly.

**7. Roadmap**

Implement the actual logic inside the declared functions, ensuring:
*   Correct calculations for tick/price conversions and bounds.
*   Proper validation logic (e.g., tick bounds).
*   Handling of `Either` types for storing results or errors.
*   Correct calls to underlying `position.internal.ts` functions (e.g., `calculatePositionDraftFromAmounts`, `calculatePositionDraftFromLiquidity`) within `finalizeDraft`.
*   Aggregation of errors in `finalizeDraft`.
