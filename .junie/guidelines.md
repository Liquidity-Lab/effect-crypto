# Effect Crypto Project Overview

## Project Description
Effect Crypto (liquid-terminator) is a cryptocurrency-focused project that leverages the Effect functional programming library to provide type-safe and functional interactions with blockchain technologies, particularly focusing on Uniswap integration. The project is currently a work in progress.

## Project Structure
This project is organized as a TypeScript monorepo using npm workspaces, with the following packages:

1. **effect-crypto**: Core cryptocurrency functionality using the Effect library
2. **effect-crypto-uniswap**: Integration with Uniswap protocols and services
3. **jsbi-reimported**: JavaScript BigInt implementation or wrapper
4. **sol-artifacts**: Solidity contract artifacts for Ethereum interaction

Each package is a standalone npm package. The package structure is as follows:
* `index.ts` contains all public exports for the package
* the package contains multiple modules. Each module has a name like `price.ts`, `order.ts`, etc.
  * each module file contains definitions for its functionality, so it is similar with `effect` library.
    * each exported member's type should be formatted in a same manner
      ```typescript
      /**
       * docs with examples
       */
      export const makePrice: {
        (raw: bigint): Price; // type signature
      } = internal.makePriceImpl;
      ```
  * each module also have `internal` file (like `price.internal.ts`) that contains implementation
    * each exported internal member should have `@internal` annotation
  * each module has a test file (like `price.spec.ts`) that contains tests for the module
    * for tests, we use `ava` and `fast-check` (property-based testing)
    * There are `.run` configuration files for `ava` in the `/.run` directory: you can use it to learn how to run tests
* for imports within the package, we use absolute imports with namespaces:
  ```typescript
  import * as Price from "./price.js";
  ```


## Technical Stack
- **Language**: TypeScript
- **Runtime**: Node.js (v22+)
  - before running the project, make sure to switch to Node.js v22+ using `nvm use` or `nvm use v22`
- **Core Libraries**:
  - Effect (functional programming)
  - bigdecimal.js (precise decimal arithmetic)
  - jsbi (JavaScript BigInt implementation)
  - kafkajs (Kafka messaging)
- **Blockchain Integration**:
  - Uniswap SDK and contracts (v3)
  - Hardhat for Ethereum development
  - Arbitrum network support
- **Testing**:
  - AVA
  - fast-check for property-based testing

## Development Environment
- The project uses ESLint and Prettier for code quality and formatting
- TypeScript is configured with strict type checking
- Hardhat is used for local blockchain development and testing
- The project can connect to Arbitrum mainnet via a forked node

## Tests

To run the project, you need to switch to Node.js v22+ by running
```bash
nvm use v22
```

Before running a tests you need to compile the project with[test - retention.csv](../../../../Downloads/Telegram%20Desktop/test%20-%20retention.csv)
```bash
npm run build
```
in the root directory

To run the tests, you can use the following command:
```bash
node --import tsx node_modules/ava/entrypoints/cli.mjs -v src/tokenVolume.spec.ts
```
Replace `effect-crypto` with proper project name. and `src/tokenVolume.spec.ts` with proper spec file name.

## Features
- Integration with Uniswap v3 for DeFi operations
- Support for range orders (limit orders) on Uniswap
- Price feed subscriptions
- Automated trading bot functionality

## Getting Started
1. Ensure you have Node.js v22 or higher installed
2. Clone the repository
3. Install dependencies with `npm install`
4. Build the project with `npm run build`
5. Run tests with `npm test`
6. Start a local Ethereum node with `npm run start-node`

## Additional Resources
- [Effect TS Documentation](https://effect.website/docs/)
- [Project Presentation](https://www.figma.com/deck/6xQZHNn2V53d9MZBSDeX8k/Effect-Crypto-Presentation?node-id=1-352&t=IHsccxSUSofM3dqm-1)