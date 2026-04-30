import { apiRequest, apiRequestWithAuthRetry, UPLOAD_SUCCESS, isUploadSuccess } from "./helpers/http.ts";
import { generateKeyPair, buildAuthEvent, authHeader } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import { resetResults, getResults, assertEquals, assertOneOf, assertGreaterThan, resDetail, headerDetail } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-06";
export const mandatory = false;

export async function run(): Promise<AssertResult[]> {
  resetResults();
  const keyPair = generateKeyPair();

  try {
    // HEAD /upload
    {
      const hash = "a".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "upload", x: [hash] });
      const res = await apiRequest("HEAD", "/upload", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png", "X-Content-Length": "184292" },
      });
      assertEquals(res.status, 200, "HEAD /upload accepts headers and returns 200", { detail: resDetail(res) });
    }
    {
      const hash = "b".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "upload", x: [hash] });
      const res = await apiRequest("HEAD", "/upload", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png", "X-Content-Length": "100" },
      });
      assertEquals(res.body.length, 0, "HEAD /upload response has no body");
    }
    {
      const hash = "d".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "upload", x: [hash] });
      const res = await apiRequest("HEAD", "/upload", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png" },
      });
      assertEquals(res.status, 411, "HEAD /upload missing X-Content-Length returns 411", { detail: resDetail(res) });
    }
    {
      const auth = buildAuthEvent(keyPair, { t: "upload", x: ["e".repeat(64)] });
      const res = await apiRequest("HEAD", "/upload", {
        headers: { Authorization: authHeader(auth), "X-Content-Type": "image/png", "X-Content-Length": "100" },
      });
      assertEquals(res.status, 400, "HEAD /upload missing X-SHA-256 returns 400", { detail: resDetail(res) });
    }
    {
      const auth = buildAuthEvent(keyPair, { t: "upload", x: ["not-a-hash"] });
      const res = await apiRequest("HEAD", "/upload", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": "not-a-hash", "X-Content-Type": "image/png", "X-Content-Length": "100" },
      });
      assertEquals(res.status, 400, "HEAD /upload malformed X-SHA-256 returns 400", { detail: resDetail(res) });
    }
    {
      const hash = "f".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "upload", x: [hash] });
      const res = await apiRequest("HEAD", "/upload", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png", "X-Content-Length": "999999999999999" },
      });
      assertEquals(res.status, 413, "HEAD /upload too large X-Content-Length returns 413", { detail: resDetail(res) });
    }
    {
      const hash = "3".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "upload", x: [hash] });
      const res = await apiRequest("HEAD", "/upload", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png", "X-Content-Length": "999999999999" },
      });
      assertGreaterThan(res.status, 399, "HEAD /upload X-Reason on error — status is 4xx", { detail: resDetail(res) });
      const reason = res.headers.get("x-reason");
      if (reason !== null) assertGreaterThan(reason.length, 0, "X-Reason header on error is human-readable", { detail: headerDetail(res.headers, "x-reason") });
    }
    {
      const blob = await generateTestImage(getServerUrl());
      const auth = buildAuthEvent(keyPair, { t: "upload", x: [blob.sha256] });
      const headRes = await apiRequest("HEAD", "/upload", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": blob.sha256, "X-Content-Type": "image/png", "X-Content-Length": String(blob.size) },
      });
      assertEquals(headRes.status, 200, "preflight 200 allows subsequent PUT upload", { detail: resDetail(headRes) });
      const { res: putRes, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      assertOneOf(putRes.status, UPLOAD_SUCCESS, "preflight followed by PUT upload succeeds", { detail: resDetail(putRes) });
      if (isUploadSuccess(putRes.status)) trackUpload(blob.sha256, keyPair);
      if (authRequired) {
        const last = getResults();
        last[last.length - 1].authRequired = true;
      }
    }
  } finally {
    await cleanupAll();
  }

  return getResults();
}
