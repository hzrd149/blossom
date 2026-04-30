import { apiRequest, apiRequestWithAuthRetry, UPLOAD_SUCCESS, isUploadSuccess } from "./helpers/http.ts";
import { generateKeyPair, buildAuthEvent, authHeader } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import { resetResults, getResults, assertEquals, assertOneOf, assertGreaterThan, assertMatches, resDetail, headerDetail } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-07";
export const mandatory = false;

export async function run(): Promise<AssertResult[]> {
  resetResults();
  const keyPair = generateKeyPair();

  try {
    // 402 Payment Required
    {
      const blob = await generateTestImage(getServerUrl());
      const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (res.status === 402) {
        const hasPaymentHeader = res.headers.get("x-cashu") !== null || res.headers.get("x-lightning") !== null;
        assertEquals(hasPaymentHeader, true, "402 response includes at least one X-{payment_method} header", { detail: headerDetail(res.headers, "x-cashu", "x-lightning") });
        const hasCashu = res.headers.get("x-cashu") !== null;
        const hasLightning = res.headers.get("x-lightning") !== null;
      } else {
        assertOneOf(res.status, UPLOAD_SUCCESS, "402 Payment Required — server does not require payment", { detail: resDetail(res) });
        if (isUploadSuccess(res.status)) trackUpload(blob.sha256, keyPair);
        if (authRequired) {
          const last = getResults();
          last[last.length - 1].authRequired = true;
        }
      }
    }

    // X-Cashu header
    {
      const blob = await generateTestImage(getServerUrl());
      const { res } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (res.status === 402) {
        const cashu = res.headers.get("x-cashu");
        if (cashu !== null) assertGreaterThan(cashu.length, 0, "X-Cashu header value is non-empty when present", { detail: headerDetail(res.headers, "x-cashu") });
      } else {
        assertOneOf(res.status, UPLOAD_SUCCESS, "X-Cashu — server does not require payment", { detail: resDetail(res) });
        if (isUploadSuccess(res.status)) trackUpload(blob.sha256, keyPair);
      }
    }

    // X-Lightning header
    {
      const blob = await generateTestImage(getServerUrl());
      const { res } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (res.status === 402) {
        const lightning = res.headers.get("x-lightning");
        if (lightning !== null) assertMatches(lightning, /^ln[a-z0-9]+/i, "X-Lightning header value starts with ln when present", { detail: headerDetail(res.headers, "x-lightning") });
      } else {
        assertOneOf(res.status, UPLOAD_SUCCESS, "X-Lightning — server does not require payment", { detail: resDetail(res) });
        if (isUploadSuccess(res.status)) trackUpload(blob.sha256, keyPair);
      }
    }

    // HEAD endpoints must not be retried with payment proof
    {
      const hash = "a".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "upload", x: [hash] });
      const res = await apiRequest("HEAD", "/upload", {
        headers: { Authorization: authHeader(auth), "X-SHA-256": hash, "X-Content-Type": "image/png", "X-Content-Length": "100" },
      });
      if (res.status === 402) {
        const hasPaymentHeader = res.headers.get("x-cashu") !== null || res.headers.get("x-lightning") !== null;
        assertEquals(hasPaymentHeader, true, "HEAD /upload returning 402 includes payment method header", { detail: headerDetail(res.headers, "x-cashu", "x-lightning") });
      }
    }

    // Error handling
    {
      const blob = await generateTestImage(getServerUrl());
      const { res } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png", "X-Cashu": "invalid-token" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (res.status === 400) {
        const reason = res.headers.get("x-reason");
        if (reason !== null) assertGreaterThan(reason.length, 0, "invalid payment proof X-Reason is human-readable", { detail: headerDetail(res.headers, "x-reason") });
      } else if (isUploadSuccess(res.status)) {
        trackUpload(blob.sha256, keyPair);
      }
    }
  } finally {
    await cleanupAll();
  }

  return getResults();
}
