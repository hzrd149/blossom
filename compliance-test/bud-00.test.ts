import { apiRequest } from "./helpers/http.ts";
import { resetResults, getResults, assertLessThan, resDetail } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-00";
export const mandatory = true;

export async function run(): Promise<AssertResult[]> {
  resetResults();
  try {
    const res = await apiRequest("GET", "/");
    assertLessThan(res.status, 500, "server is reachable and responds to HTTP requests", { detail: resDetail(res) });
  } catch {}
  return getResults();
}
