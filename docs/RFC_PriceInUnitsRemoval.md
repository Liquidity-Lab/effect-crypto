# Implementation Guide: Refactor `TokenPrice` for Ratio-Based Logic

**Based on:** `docs/RFC_PriceInUnitsRemoval.md`

## 1. Motivation & Goal

The primary goal is to refactor the `TokenPrice` module (`packages/effect-crypto-uniswap/src/price.*`) to exclusively use `BigMath.Ratio` for internal representation and calculations, removing all `BigDecimal` dependencies from its public API and implementation. This ensures consistency with Uniswap V3's Q64.96 format and its inherent price range limits (`MIN_SQRT_RATIO` to `MAX_SQRT_RATIO`). Validation against these limits will be centralized within internal factory methods.

## 2. Pre-computation (Constants)

Before starting the refactoring, ensure that `BigMath.Ratio` representations of the core Uniswap constants are available. These might already exist in `@liquidity_lab/effect-crypto/BigMath` or `packages/effect-crypto-uniswap/src/price.ts`.

These constants will be used for comparisons. **Do not introduce new price range constants like `MIN_PRICE_RATIO` or `MAX_PRICE_RATIO`.** All validation will be done against the square root price range.

## 3. Step-by-Step Implementation Plan

**Note:** Follow the project's standard development workflow after each step (compile package, run tests, fix errors, check style) as outlined in `effect-crypto.mdc`. Commands are run from the **monorepo root**.

---

**Step 1: Update Public API & Tests - Remove `BigDecimal`-based Functions and Tests (`price.ts`, `price.spec.ts`)**

*   **Goal:** Remove functions relying on `BigDecimal` from the public API and remove their corresponding tests.
*   **Files:**
    *   `packages/effect-crypto-uniswap/src/price.ts`
    *   `packages/effect-crypto-uniswap/src/price.spec.ts`
*   **Changes in `price.ts`:**
    *   Delete the export `makeFromUnits`.
    *   Delete the export `asUnits`.
    *   Delete the export `asFlippedUnits`.
    *   Consider adding a new export `asFlippedRatio: (price: TokenPrice<T>) => BigMath.Ratio;` if flipping the underlying ratio is a required feature. Add its type signature.
    *   Update JSDoc comments for remaining public functions (like `makeFromRatio`, `makeFromSqrt`, `makeFromSqrtQ64_96`, `prettyPrint`) to remove any mention of `BigDecimal` and clarify that the internal representation is `Ratio`-based and validated against Uniswap V3 limits.
*   **Changes in `price.spec.ts`:**
    *   Remove all test cases (`test(...)`) related to `makeFromUnits`, `asUnits`, and `asFlippedUnits`.
    *   If `asFlippedRatio` was added, add placeholder test cases for it (they will likely fail until the implementation is added later).
*   **Verification:**
    *   Run `npm run build -w @liquidity_lab/effect-crypto-uniswap`. The build should now proceed past the point of resolving exports in tests, but it is still expected to fail due to the removed function *implementations* in `price.internal.ts`. This confirms the public API and test alignment.

---

**Step 2: Internal Implementation - Remove `BigDecimal`-based Implementations (`price.internal.ts`)**

*   **Goal:** Remove the underlying implementations of the deprecated functions.
*   **File:** `packages/effect-crypto-uniswap/src/price.internal.ts`
*   **Changes:**
    *   Delete the internal implementation function `makeTokenPriceFromUnits`.
    *   Delete the internal implementation function `asUnitsImpl`.
    *   Delete the internal implementation function `asFlippedUnitsImpl`.
    *   **(Optional):** If `asFlippedRatio` was added, add a placeholder implementation `asFlippedRatioImpl` that likely throws an error or returns a default `Ratio`, just to satisfy the compiler for now.
        ```typescript
        // Example placeholder
        const asFlippedRatioImpl = <T extends T.TokenPair>(
          price: TokenPrice<T>,
        ): BigMath.Ratio => {
          // TODO: Implement actual logic
          throw new Error("asFlippedRatioImpl not implemented");
          // or return BigMath.one;
        };
        ```
*   **Verification:**
    *   Run `npm run build -w @liquidity_lab/effect-crypto-uniswap`. The build *might* still fail due to type mismatches in how the remaining factory functions (`makeTokenPriceFromRatioImpl`, etc.) construct `TokenPrice`, as the internal structure might still implicitly assume `BigDecimal`-related types. If it *does* compile, it's likely because the core `TokenPrice` type hasn't been fully updated yet, which will happen in subsequent steps.

---

**Step 3: Internal Implementation - Refactor `PriceValueUnits` to `PriceValueRatio` (`price.internal.ts`)**

*   **Goal:** Rename and adapt the internal class responsible for holding a standard price ratio, adding validation against Uniswap *sqrt* limits.
*   **File:** `packages/effect-crypto-uniswap/src/price.internal.ts`
*   **Changes:**
    *   Rename the class `PriceValueUnitsLive` to `PriceValueRatioLive`.
    *   Rename the associated interface `PriceValueUnits<T>` to `PriceValueRatio<T>`. Update all internal usages.
    *   Modify the `PriceValueRatioLive.make` static factory method:
        *   Change the input parameter from `units: BigDecimal` to `ratio: BigMath.Ratio`.
        *   **Add Validation:**
            1.  Calculate the square root of the input `ratio` using `BigMath.sqrt(ratio)`. Handle potential errors if `ratio` is negative (though prices should generally be positive). Let the result be `inputSqrtRatio: BigMath.Ratio`.
            2.  Compare `inputSqrtRatio` against the pre-computed `MIN_SQRT_RATIO_AS_RATIO` and `MAX_SQRT_RATIO_AS_RATIO` using `BigMath.isLessThan` and `BigMath.isGreaterThan`.
            3.  If `inputSqrtRatio < MIN_SQRT_RATIO_AS_RATIO` or `inputSqrtRatio > MAX_SQRT_RATIO_AS_RATIO`, return `Either.left(new E.PriceRangeError(...))` with a message like: `"Input price ratio ${ratio.toDecimal()} results in a sqrtRatio ${inputSqrtRatio.toDecimal()} which is outside the Uniswap V3 range [${MIN_SQRT_RATIO_AS_RATIO.toDecimal()}, ${MAX_SQRT_RATIO_AS_RATIO.toDecimal()}]"`. Use an appropriate error type (e.g., create or use `PriceRangeError`).
            4.  If validation passes, return `Either.right(new PriceValueRatioLive(ratio))`.
    *   Update the constructor `PriceValueRatioLive` to accept and store `ratio: BigMath.Ratio`.
    *   Update any methods within `PriceValueRatioLive` that previously used `BigDecimal` to use the stored `ratio`.
*   **Verification:**
    *   Run `npm run build -w @liquidity_lab/effect-crypto-uniswap`. Address any compilation errors arising from the renaming and type changes. The build may fail in factory functions that *use* this class, which will be fixed next.

---

**Step 4: Internal Implementation - Refactor `PriceValueSqrtUnits` to `PriceValueSqrtRatio` (`price.internal.ts`)**

*   **Goal:** Rename and adapt the internal class responsible for holding a sqrt price ratio, adding direct validation against Uniswap sqrt limits.
*   **File:** `packages/effect-crypto-uniswap/src/price.internal.ts`
*   **Changes:**
    *   Rename the class `PriceValueSqrtUnitsLive` to `PriceValueSqrtRatioLive`.
    *   Rename the associated interface `PriceValueSqrtUnits<T>` to `PriceValueSqrtRatio<T>`. Update all internal usages.
    *   Modify the `PriceValueSqrtRatioLive.make` static factory method:
        *   Ensure the input parameter is `sqrtRatio: BigMath.Ratio`.
        *   **Add Validation:**
            1.  Compare the input `sqrtRatio` directly against `MIN_SQRT_RATIO_AS_RATIO` and `MAX_SQRT_RATIO_AS_RATIO`.
            2.  If `sqrtRatio < MIN_SQRT_RATIO_AS_RATIO` or `sqrtRatio > MAX_SQRT_RATIO_AS_RATIO`, return `Either.left(new E.PriceRangeError(...))` with a message like: `"Input sqrt price ratio ${sqrtRatio.toDecimal()} is outside the Uniswap V3 sqrt price range [${MIN_SQRT_RATIO_AS_RATIO.toDecimal()}, ${MAX_SQRT_RATIO_AS_RATIO.toDecimal()}]"`.
            3.  If validation passes, return `Either.right(new PriceValueSqrtRatioLive(sqrtRatio))`.
    *   Update the constructor `PriceValueSqrtRatioLive` to accept and store `sqrtRatio: BigMath.Ratio`.
    *   Update any methods within `PriceValueSqrtRatioLive` that previously used `BigDecimal` to use the stored `sqrtRatio`.
*   **Verification:**
    *   Run `npm run build -w @liquidity_lab/effect-crypto-uniswap`. Fix compilation errors.

---

**Step 5: Internal Implementation - Update `TokenPriceLive` Core Structure (`price.internal.ts`)**

*   **Goal:** Modify the main `TokenPriceLive` class to hold either `PriceValueRatio` or `PriceValueSqrtRatio`.
*   **File:** `packages/effect-crypto-uniswap/src/price.internal.ts`
*   **Changes:**
    *   Review the internal structure of `TokenPriceLive`. It likely holds an instance of the underlying price value (previously `PriceValueUnits` or `PriceValueSqrtUnits`).
    *   Update the type signature for this internal storage to accept either `PriceValueRatio<T>` or `PriceValueSqrtRatio<T>`. This might involve using a union type or adjusting how the value is stored/accessed.
    *   Modify the `TokenPriceLive` constructor to accept the validated `PriceValueRatio` or `PriceValueSqrtRatio` instance.
    *   Update internal methods within `TokenPriceLive` (like those retrieving the underlying ratio or sqrt ratio) to correctly access the value from the potentially updated storage structure. Ensure methods that calculate one form from the other (e.g., getting `sqrtRatio` from `ratio` or vice-versa) use `BigMath` utilities (`sqrt`, `mul`).
*   **Verification:**
    *   Run `npm run build -w @liquidity_lab/effect-crypto-uniswap`. Fix compilation errors related to the internal structure changes.

---

**Step 6: Internal Implementation - Refactor Factory Function `makeTokenPriceFromRatioImpl` (`price.internal.ts`)**

*   **Goal:** Update the factory function for creating `TokenPrice` from a standard ratio to use the new `PriceValueRatioLive.make` for validation.
*   **File:** `packages/effect-crypto-uniswap/src/price.internal.ts`
*   **Changes:**
    *   Ensure the function signature accepts `ratio: BigMath.Ratio`.
    *   Call `PriceValueRatioLive.make(ratio)`.
    *   Use `Either.match` or similar Effect pattern:
        *   On `Left (error)`: Return the error directly (`return error`).
        *   On `Right (validatedPriceValueRatio)`: Construct a `TokenPriceLive` instance using `validatedPriceValueRatio` and return `Either.right(tokenPriceInstance)`.
*   **Verification:**
    *   Run `npm run build -w @liquidity_lab/effect-crypto-uniswap`. Fix any remaining compilation errors in this function.

---

**Step 7: Internal Implementation - Refactor Factory Function `makeTokenPriceFromSqrtImpl` (`price.internal.ts`)**

*   **Goal:** Update the factory function for creating `TokenPrice` from a sqrt ratio to use `PriceValueSqrtRatioLive.make` for validation.
*   **File:** `packages/effect-crypto-uniswap/src/price.internal.ts`
*   **Changes:**
    *   Ensure the function signature accepts `sqrtRatio: BigMath.Ratio`.
    *   Call `PriceValueSqrtRatioLive.make(sqrtRatio)`.
    *   Use `Either.match`:
        *   On `Left (error)`: Return the error.
        *   On `Right (validatedPriceValueSqrtRatio)`: Construct `TokenPriceLive` using `validatedPriceValueSqrtRatio` and return `Either.right(tokenPriceInstance)`.
*   **Verification:**
    *   Run `npm run build -w @liquidity_lab/effect-crypto-uniswap`.

---

**Step 8: Internal Implementation - Refactor Factory Function `makeTokenPriceFromSqrtQ64_96Impl` (`price.internal.ts`)**

*   **Goal:** Update the factory function for creating `TokenPrice` from a Q64.96 bigint to use `PriceValueSqrtRatioLive.make` after conversion.
*   **File:** `packages/effect-crypto-uniswap/src/price.internal.ts`
*   **Changes:**
    *   Ensure the function signature accepts `sqrtValue: bigint` (or `BigMath.Q64x96`).
    *   Convert the input `sqrtValue` bigint into a `BigMath.Ratio` using a utility like `BigMath.q64x96BnToRatio(sqrtValue)`. Handle potential errors from this conversion if the utility can fail (though it typically shouldn't for valid Q64.96 inputs). Let the result be `sqrtRatio`.
    *   Call `PriceValueSqrtRatioLive.make(sqrtRatio)`.
    *   Use `Either.match`:
        *   On `Left (error)`: Return the error.
        *   On `Right (validatedPriceValueSqrtRatio)`: Construct `TokenPriceLive` using `validatedPriceValueSqrtRatio` and return `Either.right(tokenPriceInstance)`.
*   **Verification:**
    *   Run `npm run build -w @liquidity_lab/effect-crypto-uniswap`.

---

**Step 9: Internal Implementation - Refactor `prettyPrintImpl` (`price.internal.ts`)**

*   **Goal:** Update `prettyPrintImpl` to calculate the display string using `BigMath.Ratio`.
*   **File:** `packages/effect-crypto-uniswap/src/price.internal.ts`
*   **Changes:**
    *   Retrieve `baseCurrency`, `quoteCurrency` from the `TokenPrice` instance.
    *   Get the underlying price ratio (e.g., `price.ratio()` or calculate from `sqrtRatio` if needed). Let this be `priceRatio: BigMath.Ratio`. This ratio represents `quote / base`.
    *   Define the amount of base currency to display (usually 1 unit): `baseAmountRaw = Token.makeAmountBn(baseCurrency, 1n)`.
    *   Calculate the equivalent amount of quote currency using ratio projection. Use a `BigMath` utility like `BigMath.projectBn(baseAmountRaw, priceRatio)` or equivalent integer math that performs `floor(baseAmountRaw * priceRatio.numerator / priceRatio.denominator)`. Let the result be `quoteAmountRaw: bigint`.
    *   Format `quoteAmountRaw` into a decimal string using `Token.formatAmount(quoteCurrency, quoteAmountRaw)`. Decide on a suitable display precision.
    *   Return the formatted string: `\`1 ${baseCurrency.symbol} = ${formattedQuoteAmount} ${quoteCurrency.symbol}\``.
*   **Verification:**
    *   Run `npm run build -w @liquidity_lab/effect-crypto-uniswap`.

---

**Step 10: Update Tests - Add Validation and `prettyPrint` Tests (`price.spec.ts`)**

*   **Goal:** Add specific tests for the new validation logic and the refactored `prettyPrint`.
*   **File:** `packages/effect-crypto-uniswap/src/price.spec.ts`
*   **Changes:**
    *   **Range Validation Tests:**
        *   For `makeTokenPriceFromRatio`:
            *   Test with ratios whose square roots are exactly `MIN_SQRT_RATIO_AS_RATIO` and `MAX_SQRT_RATIO_AS_RATIO`. Expect `Either.right`.
            *   Test with ratios whose square roots are slightly *outside* this range. Expect `Either.left(PriceRangeError)`. Verify the error message content.
        *   For `makeTokenPriceFromSqrt`:
            *   Test with `MIN_SQRT_RATIO_AS_RATIO` and `MAX_SQRT_RATIO_AS_RATIO`. Expect `Either.right`.
            *   Test with values slightly outside this range (e.g., `BigMath.sub(MIN_SQRT_RATIO_AS_RATIO, smallEpsilon)`, `BigMath.add(MAX_SQRT_RATIO_AS_RATIO, smallEpsilon)`). Expect `Either.left(PriceRangeError)`. Verify error messages.
        *   For `makeTokenPriceFromSqrtQ64_96`:
            *   Test with `MIN_SQRT_RATIO` (bigint) and `MAX_SQRT_RATIO` (bigint). Expect `Either.right`.
            *   Test with values slightly outside (e.g., `MIN_SQRT_RATIO - 1n`, `MAX_SQRT_RATIO + 1n`). Expect `Either.left(PriceRangeError)`. Verify error messages. Test edge cases like `0n`, `1n`.
    *   **`prettyPrint` Tests:**
        *   Add tests covering various scenarios:
            *   Different decimal places for base and quote tokens.
            *   Prices resulting in large and small quote amounts.
            *   Prices near the boundaries.
            *   Verify the output format and numerical correctness against manual calculations or expected values.
    *   **(Optional):** Implement tests for `asFlippedRatio` if added.
    *   Ensure all other existing relevant tests still pass.
*   **Verification:**
    *   Run `node --import tsx node_modules/ava/entrypoints/cli.mjs -v packages/effect-crypto-uniswap/src/price.spec.ts`. Fix any failing tests.

---

**Step 11: Final Checks and Monorepo Build**

*   **Goal:** Ensure the package is fully functional and integrates correctly within the monorepo.
*   **Changes:** None (Verification step).
*   **Verification:**
    *   Run `npm run lint` and `npm run codestyle:fix` from the root to ensure code style compliance. Address any reported issues.
    *   Run `npm run build` from the root to build the entire monorepo. Fix any cross-package compilation errors that might arise.
    *   Re-run tests if any code was changed during linting/fixing.

---

**Step 12: Address Breaking Changes**

*   **Goal:** Update any code elsewhere in the monorepo that consumed the removed public functions.
*   **Action:**
    *   Perform a codebase search (e.g., using `grep` or IDE search) for usages of `