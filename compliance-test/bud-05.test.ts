import { apiRequest, apiRequestWithAuthRetry, UPLOAD_SUCCESS, isUploadSuccess } from "./helpers/http.ts";
import { generateKeyPair, buildAuthEvent, authHeader } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import { resetResults, getResults, assertEquals, assertOneOf, assertNotNull, assertGreaterThan, resDetail, headerDetail } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-05";
export const mandatory = false;

interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

export async function run(): Promise<AssertResult[]> {
  resetResults();
  const keyPair = generateKeyPair();

  try {
    // PUT /media
    {
      const blob = await generateTestImage(getServerUrl());
      const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/media", {
        body: blob.data, headers: { "Content-Type": "image/png", "Content-Length": String(blob.size) },
        keyPair, t: "media", x: [blob.sha256], sha256: blob.sha256,
      });
      assertOneOf(res.status, UPLOAD_SUCCESS, "PUT /media accepts binary data and returns 200 or 201", { detail: resDetail(res) });
      if (isUploadSuccess(res.status)) trackUpload(blob.sha256, keyPair);
      if (authRequired) {
        const last = getResults();
        last[last.length - 1].authRequired = true;
      }
    }
    {
      const blob = await generateTestImage(getServerUrl());
      const { res } = await apiRequestWithAuthRetry("PUT", "/media", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "media", x: [blob.sha256], sha256: blob.sha256,
      });
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "PUT /media returns blob descriptor on success", { detail: resDetail(res) })) {
        trackUpload(blob.sha256, keyPair);
        const desc = res.json() as BlobDescriptor;
        assertNotNull(desc.url, "media descriptor has url");
        assertNotNull(desc.sha256, "media descriptor has sha256");
        assertNotNull(desc.size, "media descriptor has size");
        assertNotNull(desc.type, "media descriptor has type");
        assertNotNull(desc.uploaded, "media descriptor has uploaded");
      }
    }
    {
      const blob = await generateTestImage(getServerUrl());
      const { res } = await apiRequestWithAuthRetry("PUT", "/media", {
        body: blob.data, headers: { "Content-Type": "image/png", "X-SHA-256": blob.sha256 },
        keyPair, t: "media", x: [blob.sha256], sha256: blob.sha256,
      });
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "PUT /media X-SHA-256 header is accepted", { detail: resDetail(res) })) {
        trackUpload(blob.sha256, keyPair);
      }
    }
    {
      const blob = await generateTestImage(getServerUrl());
      const wrongHash = "0".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "media", x: [wrongHash] });
      const res = await apiRequest("PUT", "/media", {
        body: blob.data, headers: { Authorization: authHeader(auth), "Content-Type": "image/png", "X-SHA-256": wrongHash },
      });
      assertEquals(res.status, 409, "PUT /media X-SHA-256 mismatch returns 409 Conflict", { detail: resDetail(res) });
    }

    // HEAD /media
    {
      const hash = "d".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "media", x: [hash] });
      const res = await apiRequest("HEAD", "/media", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png", "X-Content-Length": "1024" },
      });
      assertEquals(res.status, 200, "HEAD /media uses X-SHA-256, X-Content-Type, X-Content-Length headers", { detail: resDetail(res) });
    }
    {
      const hash = "e".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "media", x: [hash] });
      const res = await apiRequest("HEAD", "/media", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png", "X-Content-Length": "1024" },
      });
      assertEquals(res.body.length, 0, "HEAD /media returns status code without response body");
    }
    {
      const hash = "1".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "media", x: [hash] });
      const res = await apiRequest("HEAD", "/media", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png" },
      });
      assertEquals(res.status, 411, "HEAD /media missing X-Content-Length returns 411", { detail: resDetail(res) });
    }
    {
      const hash = "2".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "media", x: [hash] });
      const res = await apiRequest("HEAD", "/media", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png", "X-Content-Length": "999999999999" },
      });
      assertGreaterThan(res.status, 399, "HEAD /media X-Reason header on error — status is 4xx", { detail: resDetail(res) });
      const reason = res.headers.get("x-reason");
      if (reason !== null) assertGreaterThan(reason.length, 0, "X-Reason header on error is human-readable", { detail: headerDetail(res.headers, "x-reason") });
    }
  } finally {
    await cleanupAll();
  }

  return getResults();
}
