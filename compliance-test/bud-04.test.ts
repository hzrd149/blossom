import { apiRequest, apiRequestWithAuthRetry, UPLOAD_SUCCESS, isUploadSuccess } from "./helpers/http.ts";
import { generateKeyPair, buildAuthEvent, authHeader } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import { resetResults, getResults, assertEquals, assertOneOf, assertNotNull, resDetail } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-04";
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
  let uploadedUrl = "";
  let serverAuthRequired = false;

  const blob = await generateTestImage(getServerUrl());
  uploadedSha256 = blob.sha256;
  const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
    body: blob.data, headers: { "Content-Type": "image/png" },
    keyPair, t: "upload", x: [uploadedSha256], sha256: uploadedSha256,
  });
  serverAuthRequired = authRequired;
  const hasBlob = assertOneOf(res.status, UPLOAD_SUCCESS, "upload blob for BUD-04 tests", { detail: resDetail(res) });
  if (hasBlob) {
    trackUpload(uploadedSha256, keyPair);
    const desc = res.json() as BlobDescriptor;
    uploadedUrl = desc.url ?? "";
    if (authRequired) {
      const last = getResults();
      last[last.length - 1].authRequired = true;
    }
  }

  try {
    if (hasBlob && uploadedUrl) {
      {
        const auth2 = buildAuthEvent(keyPair, { t: "upload", x: [uploadedSha256] });
        const res = await apiRequest("PUT", "/mirror", {
          body: JSON.stringify({ url: uploadedUrl }),
          headers: { Authorization: authHeader(auth2), "Content-Type": "application/json" },
        });
        assertOneOf(res.status, UPLOAD_SUCCESS, "mirror endpoint accepts URL in request body", { detail: resDetail(res) });
      }
      {
        const auth2 = buildAuthEvent(keyPair, { t: "upload", x: [uploadedSha256] });
        const res = await apiRequest("PUT", "/mirror", {
          body: JSON.stringify({ url: uploadedUrl }),
          headers: { Authorization: authHeader(auth2), "Content-Type": "application/json" },
        });
        if (assertOneOf(res.status, UPLOAD_SUCCESS, "mirrored blob returns blob descriptor", { detail: resDetail(res) })) {
          const mdesc = res.json() as BlobDescriptor;
          assertEquals(mdesc.sha256, uploadedSha256, "mirror descriptor sha256 matches original");
          assertNotNull(mdesc.url, "mirror descriptor has url");
          assertNotNull(mdesc.size, "mirror descriptor has size");
          assertNotNull(mdesc.type, "mirror descriptor has type");
          assertNotNull(mdesc.uploaded, "mirror descriptor has uploaded");
        }
      }
      {
        const auth2 = buildAuthEvent(keyPair, { t: "upload", x: [uploadedSha256] });
        await apiRequest("PUT", "/mirror", {
          body: JSON.stringify({ url: uploadedUrl }),
          headers: { Authorization: authHeader(auth2), "Content-Type": "application/json" },
        });
        const res = await apiRequest("PUT", "/mirror", {
          body: JSON.stringify({ url: uploadedUrl }),
          headers: { Authorization: authHeader(auth2), "Content-Type": "application/json" },
        });
        assertEquals(res.status, 200, "existing mirror returns 200 OK", { detail: resDetail(res) });
      }
    }

    {
      const auth2 = buildAuthEvent(keyPair, { t: "upload", x: ["a".repeat(64)] });
      const res = await apiRequest("PUT", "/mirror", {
        body: "not json",
        headers: { Authorization: authHeader(auth2), "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400, "malformed request body returns 400", { detail: resDetail(res) });
    }
    {
      const auth2 = buildAuthEvent(keyPair, { t: "upload", x: ["a".repeat(64)] });
      const res = await apiRequest("PUT", "/mirror", {
        body: JSON.stringify({}),
        headers: { Authorization: authHeader(auth2), "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400, "missing url in body returns 400", { detail: resDetail(res) });
    }
    {
      const fakeHash = "c".repeat(64);
      const auth2 = buildAuthEvent(keyPair, { t: "upload", x: [fakeHash] });
      const res = await apiRequest("PUT", "/mirror", {
        body: JSON.stringify({ url: "https://nonexistent.invalid.domain.fake/" + fakeHash }),
        headers: { Authorization: authHeader(auth2), "Content-Type": "application/json" },
      });
      assertEquals(res.status, 502, "unreachable URL returns 502 Bad Gateway", { detail: resDetail(res) });
    }
  } finally {
    await cleanupAll();
  }

  return getResults();
}
