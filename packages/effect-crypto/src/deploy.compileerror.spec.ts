import { Context, Either } from "effect";

import WETH9 from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/libraries/aeWETH.sol/aeWETH.json";
import NonfungibleTokenPositionDescriptor from "@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json";
import NFTDescriptor from "@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json";

import * as deploy from "~/deploy.internal.js";
import * as Deploy from "~/deploy.js";

class WETH9ContractDeploy extends Context.Tag("WETH9ContractDeploy")<
  WETH9ContractDeploy,
  Deploy.DeployedContract
>() {}

class NftDescriptorLibraryContractDeploy extends Context.Tag("NftDescriptorLibraryContractDeploy")<
  NftDescriptorLibraryContractDeploy,
  Deploy.DeployedContract
>() {}

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

type TestDeployedModules =
  | WETH9ContractDeploy
  | NftDescriptorLibraryContractDeploy
  | NonfungibleTokenPositionDescriptorContractDeploy;

class TestDeploy extends Context.Tag("TestDeploy")<
  TestDeploy,
  deploy.DeployShape<TestDeployedModules>
>() {}

// NonfungibleTokenPositionDescriptorContractDeploy is missing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const moduleApi2 = Deploy.DeployModuleApi(
  deploy.emptyDeployDescriptor().pipe(weth9Descriptor, libraryDescriptor),
)(TestDeploy);
