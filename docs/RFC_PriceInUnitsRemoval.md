# RFC: Refactor `TokenPrice` for Ratio-Based Logic and Centralized Uniswap V3 Range Validation

## 1. Motivation

*   The current implementation uses `BigDecimal` for some operations, introducing range limitations inconsistent with `BigMath.Ratio` and Uniswap's Q64.96 format.
*   This leads to runtime errors and confusion about valid price ranges.
*   Relying exclusively on `BigMath.Ratio` and enforcing Uniswap V3 range constraints consistently provides greater precision, avoids artificial limits, and aligns the abstraction with its intended use case.
*   Centralizing validation within internal factory methods improves design clarity and maintainability.

## 2. Goals

*   Remove all dependencies on `BigDecimal` from the `TokenPrice` public API and internal implementation.
*   Base all internal price representations and calculations on `BigMath.Ratio`.
*   Consistently enforce Uniswap V3 range limitations (`MIN_SQRT_RATIO` to `MAX_SQRT_RATIO`) via internal factory methods for `PriceValueUnits` and `PriceValueSqrtUnits`.
*   Refactor `prettyPrint` to calculate the display value using `BigMath.Ratio`.
*   Maintain the distinction between `PriceValueUnits` and `PriceValueSqrtUnits` internally.

## 3. Proposed Changes

### 3.1. Public API Changes (`price.ts`)

*   **Remove:** `makeFromUnits` function export.
*   **Remove:** `asUnits` function export.
*   **Remove:** `asFlippedUnits` function export. (Consider adding `asFlippedRatio: (price: TokenPrice<T>) => BigMath.Ratio` as a replacement if needed).
*   Update JSDoc comments for affected or related functions to reflect the removal of `BigDecimal` usage and the reliance on `Ratio`.

### 3.2. Internal Implementation Changes (`price.internal.ts`)

*   **Remove Implementations:** Delete `makeTokenPriceFromUnits`, `asUnitsImpl`, `asFlippedUnitsImpl`.
*   **Implement `asFlippedRatioImpl`:** If `asFlippedRatio` is added, implement it to return the flipped `BigMath.Ratio` from the `price.underlying.value`.
*   **Refactor `PriceValueUnitsLive.make`:**
    *   Rename class to `PriceValueRatioLive` (and corresponding types)
    *   Accept `ratio: BigMath.Ratio` as input.
    *   **Add Validation:** Check if the input `ratio` is within the calculated `[MIN_PRICE_RATIO, MAX_PRICE_RATIO]` bounds using `BigDecimal` comparison methods.
    *   If out of bounds, return `Either.left` with a clear error referencing the *implied Uniswap price range* (e.g., `"Input price ratio ${ratio.toDecimal()} is outside the range implied by Uniswap V3 limits [${MIN_PRICE_RATIO.toDecimal()}, ${MAX_PRICE_RATIO.toDecimal()}]"`).
    *   If valid, construct and return `Either.right(new PriceValueUnitsLive(ratio))`.
*   **Refactor `PriceValueSqrtUnitsLive.make`:**
    *   Rename class to `PriceValueSqrtRatioLive` (and corresponding types)
    *   Accept `sqrtRatio: BigMath.Ratio` as input.
    *   **Add Validation:** Check if the input `sqrtRatio` is within the `[MIN_SQRT_RATIO_AS_RATIO, MAX_SQRT_RATIO_AS_RATIO]` bounds using `BigMath.Ratio` comparison methods.
    *   If out of bounds, return `Either.left` with a clear error referencing the *Uniswap sqrtPrice range* (e.g., `"Input sqrt price ratio ${sqrtRatio.toDecimal()} is outside the Uniswap V3 sqrt price range [${MIN_SQRT_RATIO_AS_RATIO.toDecimal()}, ${MAX_SQRT_RATIO_AS_RATIO.toDecimal()}]"`).
    *   If valid, construct and return `Either.right(new PriceValueSqrtUnitsLive(sqrtRatio))`.
*   **Refactor `makeTokenPriceFromRatioImpl`:**
    *   Call `PriceValueUnitsLive.make(ratio)` to perform validation and construction.
    *   If `Either.isRight`, construct `TokenPriceLive` using the validated `PriceValueUnitsLive` instance and return `Either.right`. Otherwise, return the `Either.left` from the `make` call.
*   **Refactor `makeTokenPriceFromSqrtImpl`:**
    *   Call `PriceValueSqrtUnitsLive.make(sqrtValue)` to perform validation and construction.
    *   If `Either.isRight`, construct `TokenPriceLive` using the validated `PriceValueSqrtUnitsLive` instance and return `Either.right`. Otherwise, return the `Either.left` from the `make` call.
*   **Refactor `makeTokenPriceFromSqrtQ64_96Impl`:**
    *   Convert the input `sqrtValue: BigMath.Q64x96` (bigint) into a `BigMath.Ratio` (let's call it `sqrtRatio`). Ensure `BigMath` utilities exist for this conversion (bigint / 2^96). Handle potential errors during conversion if necessary (though direct conversion should be safe).
    *   Call `PriceValueSqrtUnitsLive.make(sqrtRatio)` to perform validation and construction.
    *   If `Either.isRight`, construct `TokenPriceLive` using the validated `PriceValueSqrtUnitsLive` instance and return `Either.right`. Otherwise, return the `Either.left` from the `make` call.
*   **Refactor `prettyPrintImpl`:**
    *   Retrieve `baseCurrency`, `quoteCurrency`.
    *   Use methods for volume projection to get the amount of `quoteCurrency` equivalent to 1 unit of `baseCurrency`.
    *   Format `quoteRawAmount` into a decimal string using `Token.formatAmount` or similar utility, considering `quoteCurrency.decimals`. Decide on display precision.
    *   Return the formatted string: `1 ${baseCurrency.symbol} = ${formattedQuoteAmount} ${quoteCurrency.symbol}`.

### 3.3. Test Changes (`price.spec.ts`)

*   Remove tests for `makeFromUnits`, `asUnits`, `asFlippedUnits`.
*   Add tests for `asFlippedRatio` if implemented.
*   Focus tests for range validation on the specific factory functions (`makeTokenPriceFromRatio`, `makeTokenPriceFromSqrt`, `makeTokenPriceFromSqrtQ64_96`) ensuring they return the correct `Either.left` errors originating from the internal `.make` methods when boundaries are violated.
*   Test `makeTokenPriceFromRatio` with ratios corresponding to the boundaries derived from `MIN/MAX_SQRT_RATIO` (i.e., `MIN_PRICE_RATIO`, `MAX_PRICE_RATIO`) and ratios outside them.
*   Test `makeTokenPriceFromSqrt` with sqrt ratios matching `MIN/MAX_SQRT_RATIO_AS_RATIO` and values outside them.
*   Test `makeTokenPriceFromSqrtQ64_96` with bigints matching `MIN/MAX_SQRT_RATIO_AS_BIGINT` and values outside them (like `1n`). Verify the correct error messages are propagated.
*   Update or add tests for `prettyPrintImpl` to verify correct formatting with the new ratio-based calculation logic for various token decimal combinations and price points.
*   Ensure all existing relevant tests pass after the refactoring.

## 4. Testing and Verification

*   Follow the standard project workflow:
    1.  Implement changes in `price.internal.ts` and `price.ts`.
    2.  Compile package: `npm run build -w @liquidity_lab/effect-crypto-uniswap` (from root).
    3.  Fix compilation errors.
    4.  Run affected tests: `node --import tsx node_modules/ava/entrypoints/cli.mjs -v packages/effect-crypto-uniswap/src/price.spec.ts`.
    5.  Fix test errors. Repeat build/test cycle.
    6.  Check & fix code style: `npm run lint`, `npm run codestyle:fix` (from root).
    7.  Build entire monorepo: `npm run build` (from root).
*   Pay close attention to test failures in `price.spec.ts`.
*   Manually verify the output of `prettyPrint` for various price points and token decimal combinations.

## 5. Risks and Considerations

*   **Breaking Changes:** Removing public functions (`makeFromUnits`, `asUnits`, `asFlippedUnits`) requires identifying and updating any code (within this package or others in the monorepo) that uses them. A codebase search is recommended.
*   **`BigMath` Utilities:** Critical dependency on `@liquidity_lab/effect-crypto/BigMath` providing accurate utilities for:
    *   Q64.96 bigint <-> Ratio conversion (`q64x96BnToRatio`, `ratioToQ64x96Bn` - need verification/implementation).
    *   Ratio squaring (`mul`).
    *   Ratio comparison (`isLessThan`, `isGreaterThan`, `isEqualTo`, `isLessThanOrEqual`, `isGreaterThanOrEqual`).
    *   Ratio-based amount projection (`projectBn` or equivalent integer math).
*   **`prettyPrint` Calculation/Precision:** Ensure the amount projection logic is robust and decide on a reasonable display precision for the quote amount string. 