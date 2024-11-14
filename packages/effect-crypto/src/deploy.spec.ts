import test from "ava";
import { Context, Effect, Either, Layer } from "effect";
import { encodeBytes32String } from "ethers";

import WETH9 from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/libraries/aeWETH.sol/aeWETH.json";
import NonfungibleTokenPositionDescriptor from "@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json";
import NFTDescriptor from "@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json";

import * as Adt from "~/adt.js";
import * as AvaCrypto from "~/avaCrypto.js";
import * as Chain from "~/chain.js";
import * as deploy from "~/deploy.internal.js";
import type * as Deploy from "~/deploy.js";
import * as TestEnv from "~/testEnv.js";
import * as Wallet from "~/wallet.js";

type Services = Chain.Tag | Wallet.Tag | TestEnv.Tag;

const deps: Layer.Layer<Services> = Layer.empty.pipe(
  Layer.provideMerge(TestEnv.testEnvLayer()),
  Layer.provideMerge(Chain.defaultLayer()),
  Layer.orDie,
);

const testEffect = AvaCrypto.makeTestEffect(deps, () => ({}));

test("It should properly wire a descriptor", (t) => {
  class ContractTag1 extends Context.Tag("ContractTag1")<ContractTag1, Deploy.DeployedContract>() {
    static get ownBytecode(): string {
      return "ContractTag1:0x123";
    }
  }

  class ContractTag2 extends Context.Tag("ContractTag2")<ContractTag2, Deploy.DeployedContract>() {
    static get ownBytecode(): string {
      return `ContractTag2:0x456`;
    }
  }

  class ContractTag3 extends Context.Tag("ContractTag3")<ContractTag3, Deploy.DeployedContract>() {
    static get ownBytecode(): string {
      return `ContractTag3:0x789`;
    }
  }

  const descriptor = deploy.emptyDeployDescriptor().pipe(
    deploy.addDeployableUnitDataFirst([])(ContractTag1, () =>
      Either.left({
        address: Adt.Address.unsafe("0x123"),
        bytecode: ContractTag1.ownBytecode,
      }),
    ),
    deploy.addDeployableUnitDataFirst([])(ContractTag2, () =>
      Either.left({
        address: Adt.Address.unsafe("0x456"),
        bytecode: ContractTag2.ownBytecode,
      }),
    ),
    deploy.addDeployableUnitDataFirst([ContractTag1, ContractTag2])(ContractTag3, (ctx) =>
      Either.left({
        address: Adt.Address.unsafe("0x789"),
        bytecode: `${Context.get(ctx, ContractTag1).bytecode}${Context.get(ctx, ContractTag2).bytecode}${ContractTag3.ownBytecode}`,
      }),
    ),
  );

  t.deepEqual(
    [...descriptor.unsafeMap.keys()],
    [ContractTag1, ContractTag2, ContractTag3].map((tag) => tag.key),
  );

  t.deepEqual(descriptor.unsafeMap.get(ContractTag3.key)?.deps, [ContractTag1, ContractTag2]);
});

testEffect("It should correctly deploy complex contract with the library", (t) => {
  class WETH9ContractDeploy extends Context.Tag("WETH9ContractDeploy")<
    WETH9ContractDeploy,
    Deploy.DeployedContract
  >() {}

  class NftDescriptorLibraryContractDeploy extends Context.Tag(
    "NftDescriptorLibraryContractDeploy",
  )<NftDescriptorLibraryContractDeploy, Deploy.DeployedContract>() {}

  class NonfungibleTokenPositionDescriptorContractDeploy extends Context.Tag(
    "NonfungibleTokenPositionDescriptorContractDeploy",
  )<NonfungibleTokenPositionDescriptorContractDeploy, Deploy.DeployedContract>() {}

  const weth9Descriptor = deploy.addDeployableUnitDataFirst([])(WETH9ContractDeploy, () => {
    return Either.right([WETH9.abi, WETH9.bytecode, []]);
  });

  const libraryDescriptor = deploy.addDeployableUnitDataFirst([])(
    NftDescriptorLibraryContractDeploy,
    () => {
      return Either.right([NFTDescriptor.abi, NFTDescriptor.bytecode, []]);
    },
  );

  const tokenPositionDescriptor = deploy.addDeployableUnitDataFirst([
    WETH9ContractDeploy,
    NftDescriptorLibraryContractDeploy,
  ])(NonfungibleTokenPositionDescriptorContractDeploy, (ctx) => {
    const linkedBytecode = deploy.linkLibrary(NonfungibleTokenPositionDescriptor.bytecode, {
      "contracts/libraries/NFTDescriptor.sol:NFTDescriptor": Context.get(
        ctx,
        NftDescriptorLibraryContractDeploy,
      ).address,
    });
    const nativeCurrencyLabelBytes = encodeBytes32String("WETH");
    const weth9Address = Context.get(ctx, WETH9ContractDeploy).address;

    return Either.right([
      NonfungibleTokenPositionDescriptor.abi,
      linkedBytecode,
      [weth9Address, nativeCurrencyLabelBytes],
    ]);
  });

  const descriptor = deploy
    .emptyDeployDescriptor()
    .pipe(weth9Descriptor, libraryDescriptor, tokenPositionDescriptor);

  type DeployedModules =
    | WETH9ContractDeploy
    | NftDescriptorLibraryContractDeploy
    | NonfungibleTokenPositionDescriptorContractDeploy;

  class MainDeployTag extends Context.Tag("MainDeployTag")<
    MainDeployTag,
    deploy.DeployShape<DeployedModules>
  >() {}

  const moduleApi = deploy.makeDeployModule(descriptor)(MainDeployTag);

  const prog = Effect.gen(function* () {
    const deployedContract = yield* moduleApi.deploy(
      NonfungibleTokenPositionDescriptorContractDeploy,
    );

    yield* Effect.log(`Deployed contract address: ${deployedContract.address}`);

    t.assert(deployedContract.address.startsWith("0x"), "Address should start with 0x");
  });

  return prog.pipe(
    Effect.provide(moduleApi.layer),
    Effect.orDie
  );
});
