import { apiRequest } from "./http.ts";
import { buildAuthEvent, authHeader, type KeyPair } from "./nostr.ts";
import { getServerUrl } from "./config.ts";

const tracked: { sha256: string; keyPair: KeyPair }[] = [];

export function trackUpload(sha256: string, keyPair: KeyPair) {
  tracked.push({ sha256, keyPair });
}

export async function cleanupAll() {
  const entries = [...tracked];
  tracked.length = 0;
  const results = await Promise.allSettled(
    entries.map(async ({ sha256, keyPair }) => {
      const auth = buildAuthEvent(keyPair, { t: "delete", x: [sha256] });
      const res = await apiRequest("DELETE", `/${sha256}`, {
        headers: { Authorization: authHeader(auth) },
      });
      if (res.status >= 400 && res.status !== 404) {
        console.warn(`  cleanup: DELETE /${sha256.slice(0, 12)}... → ${res.status} ${res.body.slice(0, 100)}`);
      }
    }),
  );
  return results;
}
