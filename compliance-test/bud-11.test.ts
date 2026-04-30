import { apiRequest, apiRequestWithAuthRetry, UPLOAD_SUCCESS, isUploadSuccess } from "./helpers/http.ts";
import { generateKeyPair, buildAuthEvent, authHeader, authHeaderStandardBase64 } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import { finalizeEvent, EventTemplate } from "nostr-tools";
import { resetResults, getResults, assertEquals, assertOneOf, resDetail } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-11";
export const mandatory = false;

export async function run(): Promise<AssertResult[]> {
  resetResults();
  const keyPair = generateKeyPair();

  try {
    // Validation: expired token rejected
    {
      const blob = await generateTestImage(getServerUrl());
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const now = Math.floor(Date.now() / 1000) - 7200;
      const template: EventTemplate = {
        kind: 24242,
        created_at: now,
        tags: [["t", "upload"], ["expiration", String(pastExp)], ["x", blob.sha256]],
        content: "Expired token",
      };
      const expiredAuth = finalizeEvent(template, keyPair.sk);
      const res = await apiRequest("PUT", "/upload", {
        body: blob.data, headers: { Authorization: authHeader(expiredAuth), "Content-Type": "image/png", "X-SHA-256": blob.sha256 },
      });
      const notAccepted = res.status !== 200 && res.status !== 201;
      assertEquals(notAccepted, true, "expired token is rejected by server", { detail: resDetail(res) });
    }

    // Validation: wrong t tag verb rejected
    {
      const blob = await generateTestImage(getServerUrl());
      const wrongAuth = buildAuthEvent(keyPair, { t: "delete", x: [blob.sha256] });
      const res = await apiRequest("PUT", "/upload", {
        body: blob.data, headers: { Authorization: authHeader(wrongAuth), "Content-Type": "image/png", "X-SHA-256": blob.sha256 },
      });
      const notAccepted = res.status !== 200 && res.status !== 201;
      assertEquals(notAccepted, true, "wrong t tag verb is rejected", { detail: resDetail(res) });
    }

    // Standard base64 (not base64url) should also be accepted
    {
      const blob = await generateTestImage(getServerUrl());
      const auth = buildAuthEvent(keyPair, { t: "upload", x: [blob.sha256] });
      const res = await apiRequest("PUT", "/upload", {
        body: blob.data, headers: { Authorization: authHeaderStandardBase64(auth), "Content-Type": "image/png", "X-SHA-256": blob.sha256 },
      });
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "server accepts standard base64 encoded auth token (not base64url)", { detail: resDetail(res) })) {
        trackUpload(blob.sha256, keyPair);
      }
    }

    // GET /<sha256> with t=get auth
    {
      const blob = await generateTestImage(getServerUrl());
      const { res: uploadRes, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (assertOneOf(uploadRes.status, UPLOAD_SUCCESS, "GET /<sha256> with t=get auth — upload setup succeeds", { detail: resDetail(uploadRes) })) {
        trackUpload(blob.sha256, keyPair);
        if (authRequired) {
          const last = getResults();
          last[last.length - 1].authRequired = true;
        }
        const getAuth = buildAuthEvent(keyPair, { t: "get", x: [blob.sha256] });
        const res = await apiRequest("GET", `/${blob.sha256}`, {
          headers: { Authorization: authHeader(getAuth) },
        });
        assertEquals(res.status, 200, "GET /<sha256> with t=get auth returns 200", { detail: resDetail(res) });
      }
    }

    // PUT /upload with t=upload auth
    {
      const blob = await generateTestImage(getServerUrl());
      const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "PUT /upload with t=upload auth succeeds", { detail: resDetail(res) })) {
        trackUpload(blob.sha256, keyPair);
        if (authRequired) {
          const last = getResults();
          last[last.length - 1].authRequired = true;
        }
      }
    }

    // DELETE /<sha256> with t=delete auth
    {
      const blob = await generateTestImage(getServerUrl());
      const { res: uploadRes } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (isUploadSuccess(uploadRes.status)) {
        trackUpload(blob.sha256, keyPair);
        const deleteAuth = buildAuthEvent(keyPair, { t: "delete", x: [blob.sha256] });
        const res = await apiRequest("DELETE", `/${blob.sha256}`, {
          headers: { Authorization: authHeader(deleteAuth) },
        });
        assertOneOf(res.status, [200, 204], "DELETE /<sha256> with t=delete auth succeeds", { detail: resDetail(res) });
      }
    }

    // GET /list/<pubkey> with t=list auth
    {
      const listAuth = buildAuthEvent(keyPair, { t: "list" });
      const res = await apiRequest("GET", `/list/${keyPair.pk}`, {
        headers: { Authorization: authHeader(listAuth) },
      });
      assertEquals(res.status, 200, "GET /list/<pubkey> with t=list auth returns 200", { detail: resDetail(res) });
    }

    // PUT /mirror with t=upload auth
    {
      const blob = await generateTestImage(getServerUrl());
      const { res: uploadRes } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (isUploadSuccess(uploadRes.status)) {
        trackUpload(blob.sha256, keyPair);
        const desc = uploadRes.json() as { url: string };
        if (desc.url) {
          const mirrorAuth = buildAuthEvent(keyPair, { t: "upload", x: [blob.sha256] });
          const res = await apiRequest("PUT", "/mirror", {
            body: JSON.stringify({ url: desc.url }),
            headers: { Authorization: authHeader(mirrorAuth), "Content-Type": "application/json" },
          });
          assertOneOf(res.status, UPLOAD_SUCCESS, "PUT /mirror with t=upload auth succeeds", { detail: resDetail(res) });
        }
      }
    }

    // PUT /media with t=media auth
    {
      const blob = await generateTestImage(getServerUrl());
      const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/media", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "media", x: [blob.sha256], sha256: blob.sha256,
      });
      assertOneOf(res.status, UPLOAD_SUCCESS, "PUT /media with t=media auth succeeds", { detail: resDetail(res) });
      if (isUploadSuccess(res.status)) trackUpload(blob.sha256, keyPair);
      if (authRequired) {
        const last = getResults();
        last[last.length - 1].authRequired = true;
      }
    }

    // DELETE without authorization returns 401
    {
      const blob = await generateTestImage(getServerUrl());
      const { res: uploadRes } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (isUploadSuccess(uploadRes.status)) {
        trackUpload(blob.sha256, keyPair);
        const res = await apiRequest("DELETE", `/${blob.sha256}`);
        assertEquals(res.status, 401, "DELETE without authorization returns 401", { detail: resDetail(res) });
      }
    }

    // DELETE with wrong x tag returns 401 or 403
    {
      const blob = await generateTestImage(getServerUrl());
      const { res: uploadRes } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (isUploadSuccess(uploadRes.status)) {
        trackUpload(blob.sha256, keyPair);
        const wrongHash = "e".repeat(64);
        const deleteAuth = buildAuthEvent(keyPair, { t: "delete", x: [wrongHash] });
        const res = await apiRequest("DELETE", `/${blob.sha256}`, {
          headers: { Authorization: authHeader(deleteAuth) },
        });
        assertOneOf(res.status, [401, 403], "DELETE with wrong x tag returns 401 or 403", { detail: resDetail(res) });
      }
    }
  } finally {
    await cleanupAll();
  }

  return getResults();
}
