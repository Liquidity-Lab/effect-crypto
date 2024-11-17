import { Branded } from "effect/Brand";
import { Brand } from "effect";


export { FeeAmount } from "./adt.internal.js";

export type Tick = Brand.Branded<bigint, "Tick">; // TODO: encapsulate via symbol
export const Tick = Brand.nominal<Tick>();

function isTickValid(tickIdx: number, fee: number): boolean {
  let tickSpacing: number;

  switch (fee) {
    case 0.0005:
      tickSpacing = 1;
      break;
    case 0.003:
      tickSpacing = 60;
      break;
    case 0.01:
      tickSpacing = 200;
      break;
    default:
      throw new Error("Unsupported fee tier");
  }

  return tickIdx % tickSpacing === 0;
}

// Example usage
const tickIdx = 60;  // Example tick index
const fee = 0.003;   // Example fee tier (0.3%)
console.log(isTickValid(tickIdx, fee));  // Should print true if tickIdx is correct