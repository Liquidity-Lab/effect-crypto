// @ts-check
import eslintPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

// import effectEslint from "@effect/eslint-plugin/configs/recommended.mjs";
import eslint from "@eslint/js";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.eslintRecommended,
  eslintPrettier,
  // effectEslint,
  {
    languageOptions: {
      // project: ["./packages/*/tsconfig.json"],
      sourceType: "module",
      ecmaVersion: 2020,
    },
    ignores: [
      "./packages/*/jest.config.js",
      "./packages/*/ava.config.mjs",
      "**/jest.config.js",
      "**/*.compileerror.spec.ts",
      "**/dist/",
    ],
    rules: {
      // The following rule is enabled only to supplement the inline suppression
      // examples, and because it is not a recommended rule, you should either
      // disable it, or understand what it enforces.
      // https://typescript-eslint.io/rules/explicit-function-return-type/
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": [
        "error",
        {
          variables: true,
          functions: false,
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["*.internal.ts", "*.internal.tsx", "*.spec.ts", "*.spec.tsx"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
);
