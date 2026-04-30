import { resetResults, getResults, skip } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-03";
export const mandatory = false;

export async function run(): Promise<AssertResult[]> {
  resetResults();
  skip("BUD-03 defines kind:10063 event format and client URL parsing — no server endpoints defined", "client-side only, no server endpoints");
  return getResults();
}
