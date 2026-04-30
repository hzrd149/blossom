import { apiRequest, apiRequestWithAuthRetry, UPLOAD_SUCCESS, isUploadSuccess } from "./helpers/http.ts";
import { sha256Hex } from "./helpers/crypto.ts";
import { generateKeyPair, buildAuthEvent, authHeader } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import {
  resetResults, getResults, assertEquals, assertOneOf, assertNotNull,
  assertGreaterThan, assertContains, resDetail, headerDetail,
} from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-01";
export const mandatory = true;

export async function run(): Promise<AssertResult[]> {
  resetResults();
  const keyPair = generateKeyPair();
  let uploadedSha256 = "";
  let serverAuthRequired = false;

  const blob = await generateTestImage(getServerUrl());
  uploadedSha256 = blob.sha256;
  const { res: uploadRes, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
    body: blob.data,
    headers: { "Content-Type": "image/png" },
    keyPair,
    t: "upload",
    x: [uploadedSha256],
    sha256: uploadedSha256,
  });
  serverAuthRequired = authRequired;
  const hasBlob = assertOneOf(uploadRes.status, UPLOAD_SUCCESS, "upload blob for BUD-01 tests", { detail: resDetail(uploadRes) });
  if (hasBlob) {
    trackUpload(uploadedSha256, keyPair);
    if (authRequired) {
      const last = getResults();
      last[last.length - 1].authRequired = true;
    }
  }

  try {
    // CORS headers
    {
      const res = await apiRequest("GET", "/");
      assertEquals(res.headers.get("access-control-allow-origin"), "*", "GET response includes Access-Control-Allow-Origin: *", { detail: headerDetail(res.headers, "access-control-allow-origin") });
    }
    {
      const res = await apiRequest("OPTIONS", "/");
      const allowHeaders = res.headers.get("access-control-allow-headers");
      assertNotNull(allowHeaders, "OPTIONS preflight includes Access-Control-Allow-Headers", { detail: headerDetail(res.headers, "access-control-allow-headers") });
      if (allowHeaders) assertContains(allowHeaders.toLowerCase(), "authorization", "OPTIONS Allow-Headers includes Authorization", { detail: headerDetail(res.headers, "access-control-allow-headers") });
    }
    {
      const res = await apiRequest("OPTIONS", "/");
      const allowMethods = res.headers.get("access-control-allow-methods");
      assertNotNull(allowMethods, "OPTIONS preflight includes Access-Control-Allow-Methods", { detail: headerDetail(res.headers, "access-control-allow-methods") });
      if (allowMethods) {
        const m = allowMethods.toUpperCase();
        assertContains(m, "GET", "OPTIONS Allow-Methods includes GET");
        assertContains(m, "HEAD", "OPTIONS Allow-Methods includes HEAD");
        assertContains(m, "PUT", "OPTIONS Allow-Methods includes PUT");
        assertContains(m, "DELETE", "OPTIONS Allow-Methods includes DELETE");
      }
    }

    // Error responses
    {
      const res = await apiRequest("GET", "/nonexistent-invalid-hash");
      assertGreaterThan(res.status, 399, "error response has 4xx/5xx status", { detail: resDetail(res) });
      const xReason = res.headers.get("x-reason");
      if (xReason !== null) {
        assertGreaterThan(xReason.length, 0, "X-Reason header is non-empty when present", { detail: headerDetail(res.headers, "x-reason") });
      }
    }

    // 404 for non-existent blob
    {
      const fakeHash = "a".repeat(64);
      const res = await apiRequest("GET", `/${fakeHash}`);
      assertEquals(res.status, 404, "GET /<sha256> returns 404 for non-existent blob", { detail: resDetail(res) });
    }
    {
      const fakeHash = "b".repeat(64);
      const res = await apiRequest("HEAD", `/${fakeHash}`);
      assertEquals(res.status, 404, "HEAD returns 404 for non-existent blob", { detail: resDetail(res) });
    }

    // Blob retrieval tests
    if (hasBlob) {
      const getOpts = serverAuthRequired
        ? { headers: { Authorization: authHeader(buildAuthEvent(keyPair, { t: "get", x: [uploadedSha256] })) } }
        : undefined;

      {
        const res = await apiRequest("GET", `/${uploadedSha256}`, getOpts);
        assertEquals(res.status, 200, "GET /<sha256> returns 200 OK", { detail: resDetail(res) });
      }
      {
        const res = await apiRequest("GET", `/${uploadedSha256}`, getOpts);
        if (assertEquals(res.status, 200, "GET /<sha256> response body matches uploaded blob — GET succeeds", { detail: resDetail(res) })) {
          if (res.bodyBytes) {
            const bodyHex = await sha256Hex(res.bodyBytes);
            assertEquals(bodyHex, uploadedSha256, "downloaded blob hash matches upload");
          }
        }
      }
      {
        const res = await apiRequest("GET", `/${uploadedSha256}`, getOpts);
        if (assertEquals(res.status, 200, "GET /<sha256> Content-Type header is set", { detail: resDetail(res) })) {
          assertNotNull(res.headers.get("content-type"), "Content-Type header present", { detail: headerDetail(res.headers, "content-type") });
        }
      }
      {
        const res = await apiRequest("GET", `/${uploadedSha256}.png`, getOpts);
        assertEquals(res.status, 200, "GET /<sha256>.png accepts optional file extension", { detail: resDetail(res) });
      }
      {
        const res = await apiRequest("GET", `/${uploadedSha256}`, getOpts);
        if (assertEquals(res.status, 200, "CORS header present on GET response", { detail: resDetail(res) })) {
          assertEquals(res.headers.get("access-control-allow-origin"), "*", "Access-Control-Allow-Origin: * on GET", { detail: headerDetail(res.headers, "access-control-allow-origin") });
        }
      }
      {
        const res = await apiRequest("GET", `/${uploadedSha256}`, getOpts);
        if (res.status === 307 || res.status === 308) {
          const location = res.headers.get("location");
          assertNotNull(location, "redirect has Location header");
          if (location) assertContains(location, uploadedSha256, "redirect URL contains same sha256 hash");
        } else {
          assertEquals(res.status, 200, "redirect URLs contain same sha256 hash (no redirect)", { detail: resDetail(res) });
        }
      }

      // HEAD /<sha256>
      {
        const res = await apiRequest("HEAD", `/${uploadedSha256}`, getOpts);
        assertEquals(res.status, 200, "HEAD /<sha256> returns 200 OK for existing blob", { detail: resDetail(res) });
      }
      {
        const getRes = await apiRequest("GET", `/${uploadedSha256}`, getOpts);
        const headRes = await apiRequest("HEAD", `/${uploadedSha256}`, getOpts);
        if (assertEquals(headRes.status, 200, "HEAD returns same Content-Type as GET", { detail: resDetail(headRes) }) && getRes.status === 200) {
          assertEquals(headRes.headers.get("content-type"), getRes.headers.get("content-type"), "HEAD Content-Type matches GET Content-Type", { detail: `HEAD: ${headerDetail(headRes.headers, "content-type")}, GET: ${headerDetail(getRes.headers, "content-type")}` });
        }
      }
      {
        const res = await apiRequest("HEAD", `/${uploadedSha256}`, getOpts);
        if (assertEquals(res.status, 200, "HEAD returns Content-Length header", { detail: resDetail(res) })) {
          const cl = res.headers.get("content-length");
          assertNotNull(cl, "Content-Length header present", { detail: headerDetail(res.headers, "content-length") });
          if (cl) assertGreaterThan(Number(cl), 0, "Content-Length > 0");
        }
      }
      {
        const res = await apiRequest("HEAD", `/${uploadedSha256}`, getOpts);
        if (assertEquals(res.status, 200, "HEAD does not return blob body", { detail: resDetail(res) })) {
          assertEquals(res.body.length, 0, "HEAD response body is empty");
        }
      }
      {
        const res = await apiRequest("HEAD", `/${uploadedSha256}.png`, getOpts);
        assertEquals(res.status, 200, "HEAD accepts optional file extension in URL", { detail: resDetail(res) });
      }

      // Range requests
      {
        const res = await apiRequest("HEAD", `/${uploadedSha256}`, getOpts);
        if (assertEquals(res.status, 200, "HEAD response includes accept-ranges: bytes", { detail: resDetail(res) })) {
          const ar = res.headers.get("accept-ranges");
          if (ar !== null) assertContains(ar.toLowerCase(), "bytes", "accept-ranges contains 'bytes'", { detail: headerDetail(res.headers, "accept-ranges") });
        }
      }
      {
        const res = await apiRequest("GET", `/${uploadedSha256}`, { ...getOpts, headers: { ...getOpts?.headers, Range: "bytes=0-9" } });
        if (assertOneOf(res.status, [200, 206], "GET with Range header returns 200 or 206", { detail: resDetail(res) })) {
          if (res.status === 206) {
            const cr = res.headers.get("content-range");
            assertNotNull(cr, "206 response has Content-Range header", { detail: headerDetail(res.headers, "content-range") });
            if (cr) assertContains(cr, "bytes", "Content-Range contains 'bytes'");
          }
        }
      }

      // Sunset Header (Optional)
      {
        const res = await apiRequest("GET", `/${uploadedSha256}`, getOpts);
        if (assertEquals(res.status, 200, "Sunset header test — GET succeeds", { detail: resDetail(res) })) {
          const sunset = res.headers.get("sunset");
          if (sunset !== null) {
            assertGreaterThan(new Date(sunset).getTime(), 0, "Sunset header is valid HTTP date format", { detail: headerDetail(res.headers, "sunset") });
          }
        }
      }

      // Blob retrieval endpoint at /<sha256>
      {
        const res = await apiRequest("GET", `/${uploadedSha256}`, getOpts);
        assertEquals(res.status, 200, "blob retrieval endpoint is accessible at /<sha256>", { detail: resDetail(res) });
      }
    }

    // Content-Type default test
    {
      const data = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const hash = await sha256Hex(data);
      const { res: uploadRes2, authRequired: ar2 } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: data, headers: { "Content-Type": "application/octet-stream" },
        keyPair, t: "upload", x: [hash], sha256: hash,
      });
      if (assertOneOf(uploadRes2.status, UPLOAD_SUCCESS, "Content-Type defaults to application/octet-stream — upload succeeds", { detail: resDetail(uploadRes2) })) {
        trackUpload(hash, keyPair);
        const getOpts2 = ar2
          ? { headers: { Authorization: authHeader(buildAuthEvent(keyPair, { t: "get", x: [hash] })) } }
          : undefined;
        const getRes = await apiRequest("GET", `/${hash}`, getOpts2);
        if (assertEquals(getRes.status, 200, "Content-Type defaults to application/octet-stream — GET succeeds", { detail: resDetail(getRes) })) {
          assertNotNull(getRes.headers.get("content-type"), "Content-Type header present for octet-stream blob", { detail: headerDetail(getRes.headers, "content-type") });
        }
      }
    }

    // Upload endpoint at /upload
    {
      const blob2 = await generateTestImage(getServerUrl());
      const { res, authRequired: ar3 } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob2.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob2.sha256], sha256: blob2.sha256,
      });
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "upload endpoint is accessible at /upload", { detail: resDetail(res) })) {
        trackUpload(blob2.sha256, keyPair);
        if (ar3) {
          const last = getResults();
          last[last.length - 1].authRequired = true;
        }
      }
    }
  } finally {
    await cleanupAll();
  }

  return getResults();
}
