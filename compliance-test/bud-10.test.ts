import { resetResults, getResults, skip } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-10";
export const mandatory = false;

export async function run(): Promise<AssertResult[]> {
  resetResults();
  skip("BUD-10 defines the blossom: URI scheme for client-side blob discovery — no server endpoints defined", "client-side only, no server endpoints");
  return getResults();
}
