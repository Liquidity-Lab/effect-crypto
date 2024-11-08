import test from "ava";
import { Context, Effect, Either, Layer, Option } from "effect";

import * as Adt from "~/adt.js";
import * as AvaCrypto from "~/avaCrypto.js";
import * as Chain from "~/chain.js";
import * as Deploy from "~/deploy.js";
import * as Error from "~/error.js";
import * as TestEnv from "~/testEnv.js";
import * as Token from "~/token.js";
import * as Wallet from "~/wallet.js";

// type Services = Chain.Tag | Token.Tag | Wallet.Tag | TestEnv.Tag;

// const deps = null as any;

// const testEffect = AvaCrypto.makeTestEffect(deps, () => ({}));

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

  const descriptor = Deploy.DeployDescriptor().pipe(
    Deploy.addDeployable.dataFirst([])(ContractTag1, () =>
      Either.left({
        address: Adt.Address.unsafe("0x123"),
        bytecode: ContractTag1.ownBytecode,
      }),
    ),
    Deploy.addDeployable.dataFirst([])(ContractTag2, () =>
      Either.left({
        address: Adt.Address.unsafe("0x456"),
        bytecode: ContractTag2.ownBytecode,
      }),
    ),
    Deploy.addDeployable.dataFirst([ContractTag1, ContractTag2])(ContractTag3, (ctx) =>
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

// testEffect("Should transfer all tokens", (t) => {});
