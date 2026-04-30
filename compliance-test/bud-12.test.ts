import { apiRequest, apiRequestWithAuthRetry, UPLOAD_SUCCESS, isUploadSuccess } from "./helpers/http.ts";
import { sha256Hex } from "./helpers/crypto.ts";
import { generateKeyPair, buildAuthEvent, authHeader } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import { resetResults, getResults, assertEquals, assertOneOf, assertGreaterThan, assertLessThanOrEqual, assertNotNull, assertIsArray, resDetail } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-12";
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
  let uploadedSha256 = "";
  let serverAuthRequired = false;

  const blob = await generateTestImage(getServerUrl());
  uploadedSha256 = blob.sha256;
  const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
    body: blob.data, headers: { "Content-Type": "image/png" },
    keyPair, t: "upload", x: [uploadedSha256], sha256: uploadedSha256,
  });
  serverAuthRequired = authRequired;
  const hasBlob = assertOneOf(res.status, UPLOAD_SUCCESS, "upload blob for BUD-12 tests", { detail: resDetail(res) });
  if (hasBlob) {
    trackUpload(uploadedSha256, keyPair);
    if (authRequired) {
      const last = getResults();
      last[last.length - 1].authRequired = true;
    }
  }

  try {
    if (hasBlob) {
      // GET /list/<pubkey>
      {
        const listAuth = buildAuthEvent(keyPair, { t: "list" });
        const res = await apiRequest("GET", `/list/${keyPair.pk}`, {
          headers: { Authorization: authHeader(listAuth) },
        });
        if (assertEquals(res.status, 200, "GET /list/<pubkey> returns 200", { detail: resDetail(res) })) {
          const body = res.json();
          assertIsArray(body, "GET /list/<pubkey> returns JSON array");
        }
      }
      {
        const listAuth = buildAuthEvent(keyPair, { t: "list" });
        const res = await apiRequest("GET", `/list/${keyPair.pk}`, {
          headers: { Authorization: authHeader(listAuth) },
        });
        if (assertEquals(res.status, 200, "blob descriptors contain required fields — list succeeds", { detail: resDetail(res) })) {
          const list = res.json() as BlobDescriptor[];
          if (assertGreaterThan(list.length, 0, "list has at least one entry")) {
            const desc = list[0];
            assertNotNull(desc.url, "list descriptor has url");
            assertNotNull(desc.sha256, "list descriptor has sha256");
            assertNotNull(desc.size, "list descriptor has size");
            assertNotNull(desc.type, "list descriptor has type");
            assertNotNull(desc.uploaded, "list descriptor has uploaded");
          }
        }
      }
      {
        const listAuth = buildAuthEvent(keyPair, { t: "list" });
        const res = await apiRequest("GET", `/list/${keyPair.pk}?limit=1`, {
          headers: { Authorization: authHeader(listAuth) },
        });
        if (assertEquals(res.status, 200, "GET /list/<pubkey>?limit=1 returns 200", { detail: resDetail(res) })) {
          const list = res.json() as BlobDescriptor[];
          assertLessThanOrEqual(list.length, 1, "limit=1 returns at most 1 result");
        }
      }
      {
        const listAuth = buildAuthEvent(keyPair, { t: "list" });
        const res = await apiRequest("GET", `/list/${keyPair.pk}?limit=1`, {
          headers: { Authorization: authHeader(listAuth) },
        });
        if (assertEquals(res.status, 200, "cursor pagination — initial list succeeds", { detail: resDetail(res) })) {
          const list = res.json() as BlobDescriptor[];
          if (assertGreaterThan(list.length, 0, "initial list has entries")) {
            const cursor = list[0].sha256;
            const cursorAuth = buildAuthEvent(keyPair, { t: "list" });
            const cursorRes = await apiRequest("GET", `/list/${keyPair.pk}?cursor=${cursor}&limit=1`, {
              headers: { Authorization: authHeader(cursorAuth) },
            });
            if (assertEquals(cursorRes.status, 200, "cursor pagination — second page returns 200", { detail: resDetail(cursorRes) })) {
              const cursorList = cursorRes.json() as BlobDescriptor[];
              assertEquals(cursorList.some((d) => d.sha256 === cursor), false, "cursor excludes previous entry");
            }
          }
        }
      }
      {
        const listAuth = buildAuthEvent(keyPair, { t: "list" });
        const res = await apiRequest("GET", `/list/${keyPair.pk}`, {
          headers: { Authorization: authHeader(listAuth) },
        });
        if (assertEquals(res.status, 200, "results sorted by uploaded date descending — list succeeds", { detail: resDetail(res) })) {
          const list = res.json() as BlobDescriptor[];
          for (let i = 1; i < list.length; i++) {
            assertGreaterThan(list[i - 1].uploaded, list[i].uploaded - 1, `entry ${i - 1} uploaded >= entry ${i} uploaded`);
          }
        }
      }
      {
        const listAuth = buildAuthEvent(keyPair, { t: "list" });
        const res = await apiRequest("GET", `/list/${keyPair.pk}?limit=abc`, {
          headers: { Authorization: authHeader(listAuth) },
        });
        assertEquals(res.status, 400, "GET /list returns 400 for malformed query params", { detail: resDetail(res) });
      }

      // DELETE /<sha256>
      let deleteTestSha256 = "";
      {
        const delBlob = await generateTestImage(getServerUrl());
        deleteTestSha256 = delBlob.sha256;
        const { res: delRes, authRequired: delAr } = await apiRequestWithAuthRetry("PUT", "/upload", {
          body: delBlob.data, headers: { "Content-Type": "image/png" },
          keyPair, t: "upload", x: [deleteTestSha256], sha256: deleteTestSha256,
        });
        if (assertOneOf(delRes.status, UPLOAD_SUCCESS, "delete test — upload setup succeeds", { detail: resDetail(delRes) })) {
          trackUpload(deleteTestSha256, keyPair);
          if (delAr) {
            const last = getResults();
            last[last.length - 1].authRequired = true;
          }
        }
      }
      if (deleteTestSha256) {
        {
          const delAuth = buildAuthEvent(keyPair, { t: "delete", x: [deleteTestSha256] });
          const res = await apiRequest("DELETE", `/${deleteTestSha256}`, {
            headers: { Authorization: authHeader(delAuth) },
          });
          assertOneOf(res.status, [200, 204], "delete returns 200 or 204 on success", { detail: resDetail(res) });
        }
        {
          const delAuth = buildAuthEvent(keyPair, { t: "delete", x: [deleteTestSha256] });
          await apiRequest("DELETE", `/${deleteTestSha256}`, {
            headers: { Authorization: authHeader(delAuth) },
          });
          const getRes = await apiRequest("GET", `/${deleteTestSha256}`);
          assertEquals(getRes.status, 404, "deleted blob returns 404 on GET", { detail: resDetail(getRes) });
        }
      }
      {
        const fakeHash = "d".repeat(64);
        const delAuth = buildAuthEvent(keyPair, { t: "delete", x: [fakeHash] });
        const res = await apiRequest("DELETE", `/${fakeHash}`, {
          headers: { Authorization: authHeader(delAuth) },
        });
        assertEquals(res.status, 404, "delete non-existent blob returns 404", { detail: resDetail(res) });
      }
      {
        const delBlob = await generateTestImage(getServerUrl());
        const { res: uploadRes } = await apiRequestWithAuthRetry("PUT", "/upload", {
          body: delBlob.data, headers: { "Content-Type": "image/png" },
          keyPair, t: "upload", x: [delBlob.sha256], sha256: delBlob.sha256,
        });
        if (isUploadSuccess(uploadRes.status)) trackUpload(delBlob.sha256, keyPair);
        const res = await apiRequest("DELETE", `/${delBlob.sha256}`);
        assertEquals(res.status, 401, "delete without authorization returns 401", { detail: resDetail(res) });
      }
      {
        const delBlob = await generateTestImage(getServerUrl());
        const { res: uploadRes } = await apiRequestWithAuthRetry("PUT", "/upload", {
          body: delBlob.data, headers: { "Content-Type": "image/png" },
          keyPair, t: "upload", x: [delBlob.sha256], sha256: delBlob.sha256,
        });
        if (assertOneOf(uploadRes.status, UPLOAD_SUCCESS, "delete requires x tag — upload succeeds", { detail: resDetail(uploadRes) })) {
          trackUpload(delBlob.sha256, keyPair);
        }
        const wrongHash = "e".repeat(64);
        const deleteAuth = buildAuthEvent(keyPair, { t: "delete", x: [wrongHash] });
        const res = await apiRequest("DELETE", `/${delBlob.sha256}`, {
          headers: { Authorization: authHeader(deleteAuth) },
        });
        assertOneOf(res.status, [401, 403], "delete with wrong x tag returns 401 or 403", { detail: resDetail(res) });
      }
      {
        const blob1 = await generateTestImage(getServerUrl());
        const blob2 = await generateTestImage(getServerUrl());
        const { res: uploadRes1 } = await apiRequestWithAuthRetry("PUT", "/upload", {
          body: blob1.data, headers: { "Content-Type": "image/png" },
          keyPair, t: "upload", x: [blob1.sha256], sha256: blob1.sha256,
        });
        if (isUploadSuccess(uploadRes1.status)) trackUpload(blob1.sha256, keyPair);
        const { res: uploadRes2 } = await apiRequestWithAuthRetry("PUT", "/upload", {
          body: blob2.data, headers: { "Content-Type": "image/png" },
          keyPair, t: "upload", x: [blob2.sha256], sha256: blob2.sha256,
        });
        if (isUploadSuccess(uploadRes2.status)) trackUpload(blob2.sha256, keyPair);

        const deleteAuth = buildAuthEvent(keyPair, { t: "delete", x: [blob1.sha256, blob2.sha256] });
        const res = await apiRequest("DELETE", `/${blob1.sha256}`, {
          headers: { Authorization: authHeader(deleteAuth) },
        });
        assertOneOf(res.status, [200, 204], "multiple x tags — delete blob1 succeeds", { detail: resDetail(res) });
        const getRes2 = await apiRequest("GET", `/${blob2.sha256}`);
        assertEquals(getRes2.status, 200, "multiple x tags do not delete multiple blobs", { detail: resDetail(getRes2) });
      }
    }
  } finally {
    await cleanupAll();
  }

  return getResults();
}
