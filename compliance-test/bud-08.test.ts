import { apiRequest, apiRequestWithAuthRetry, UPLOAD_SUCCESS, isUploadSuccess } from "./helpers/http.ts";
import { generateKeyPair, buildAuthEvent, authHeader } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import { resetResults, getResults, assertEquals, assertOneOf, assertNotNull, assertGreaterThan, assertIsArray, resDetail } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-08";
export const mandatory = false;

interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
  nip94?: string[][];
}

export async function run(): Promise<AssertResult[]> {
  resetResults();
  const keyPair = generateKeyPair();
  let uploadedSha256 = "";
  let uploadDescriptor: BlobDescriptor | null = null;

  const blob = await generateTestImage(getServerUrl());
  uploadedSha256 = blob.sha256;
  const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
    body: blob.data, headers: { "Content-Type": "image/png" },
    keyPair, t: "upload", x: [uploadedSha256], sha256: uploadedSha256,
  });
  const hasBlob = assertOneOf(res.status, UPLOAD_SUCCESS, "upload blob for BUD-08 tests", { detail: resDetail(res) });
  if (hasBlob) {
    trackUpload(uploadedSha256, keyPair);
    uploadDescriptor = res.json() as BlobDescriptor;
    if (authRequired) {
      const last = getResults();
      last[last.length - 1].authRequired = true;
    }
  }

  try {
    if (hasBlob && uploadDescriptor) {
      if (!uploadDescriptor.nip94) {
        // nip94 is optional
      } else {
        assertIsArray(uploadDescriptor.nip94, "nip94 field is a JSON array when present");
        if (Array.isArray(uploadDescriptor.nip94)) {
          for (const tag of uploadDescriptor.nip94) {
            assertIsArray(tag, "nip94 entry is an array");
            if (Array.isArray(tag)) {
              assertGreaterThan(tag.length, 1, "nip94 entry has length >= 2");
              assertEquals(typeof tag[0], "string", "nip94 entry key is a string");
            }
          }
          const urlTag = uploadDescriptor.nip94.find((t) => t[0] === "url");
          assertNotNull(urlTag, "nip94 contains url tag");
          if (urlTag) assertEquals(urlTag[1], uploadDescriptor.url, "nip94 url tag matches descriptor url");

          const xTag = uploadDescriptor.nip94.find((t) => t[0] === "x");
          assertNotNull(xTag, "nip94 contains x tag matching sha256");
          if (xTag) assertEquals(xTag[1], uploadDescriptor.sha256, "nip94 x tag matches sha256");

          const mTag = uploadDescriptor.nip94.find((t) => t[0] === "m");
          assertNotNull(mTag, "nip94 contains m tag matching MIME type");
          if (mTag) assertEquals(mTag[1], uploadDescriptor.type, "nip94 m tag matches type");
        }
      }

      // nip94 in /mirror response
      {
        const serverUrl = getServerUrl();
        const mirrorUrl = `${serverUrl}/${uploadedSha256}.png`;
        const auth2 = buildAuthEvent(keyPair, { t: "upload", x: [uploadedSha256] });
        const res = await apiRequest("PUT", "/mirror", {
          body: JSON.stringify({ url: mirrorUrl }),
          headers: { Authorization: authHeader(auth2), "Content-Type": "application/json" },
        });
        if (assertOneOf(res.status, UPLOAD_SUCCESS, "mirror response nip94 test — mirror succeeds", { detail: resDetail(res) })) {
          const desc = res.json() as BlobDescriptor;
          if (desc.nip94) {
            assertIsArray(desc.nip94, "mirror response nip94 field is a JSON array when present");
          }
        }
      }
    }
  } finally {
    await cleanupAll();
  }

  return getResults();
}
