/**
 * @file packages/effect-crypto-uniswap/src/position.test-d.ts
 */
import { Either, Option } from "effect";
import { assertType, test } from "vitest";

import * as Pool from "./pool.js";
import * as Position from "./position.js";

test("PositionDraftBuilder should be pipable", () => {
  const poolState: Pool.PoolState = null as any;
  const slot0: Pool.Slot0 = null as any;
  const liquidity: Pool.Liquidity = null as any;

  const actual = Position.draftBuilder(poolState, slot0).pipe(
    Position.setLowerTickBound((current) => Option.some(current)),
    // We don't really care about correctness of the data here
    Position.setUpperTickBound((current) => Option.some(current)),
    Position.setSizeFromLiquidity(liquidity),
    Position.finalizeDraft,
  );

  assertType<Either.Either<Position.PositionDraft, Position.AggregateBuilderError>>(actual);
});
