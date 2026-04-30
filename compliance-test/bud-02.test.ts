import { apiRequest, apiRequestWithAuthRetry, UPLOAD_SUCCESS, isUploadSuccess } from "./helpers/http.ts";
import { sha256Hex } from "./helpers/crypto.ts";
import { generateKeyPair, buildAuthEvent, authHeader } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import {
  resetResults, getResults, assertEquals, assertOneOf, assertNotNull,
  assertGreaterThan, assertContains, resDetail,
} from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-02";
export const mandatory = false;

interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

function parseDescriptor(json: unknown): BlobDescriptor | null {
  if (!json || typeof json !== "object") return null;
  const d = json as Record<string, unknown>;
  if (typeof d.url !== "string" || typeof d.sha256 !== "string" || typeof d.size !== "number" || typeof d.type !== "string" || typeof d.uploaded !== "number") return null;
  return d as unknown as BlobDescriptor;
}

export async function run(): Promise<AssertResult[]> {
  resetResults();
  const keyPair = generateKeyPair();
  let serverAuthRequired = false;

  async function uploadBlob(extraHeaders: Record<string, string> = {}): Promise<{ sha256: string; res: Awaited<ReturnType<typeof apiRequest>>; authRequired: boolean }> {
    const blob = await generateTestImage(getServerUrl());
    const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
      body: blob.data,
      headers: { "Content-Type": "image/png", "Content-Length": String(blob.size), ...extraHeaders },
      keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
    });
    if (isUploadSuccess(res.status)) trackUpload(blob.sha256, keyPair);
    if (authRequired) serverAuthRequired = true;
    return { sha256: blob.sha256, res, authRequired };
  }

  try {
    // Upload without X-SHA-256 — spec says MAY, some servers require it
    {
      const blob = await generateTestImage(getServerUrl());
      const { res } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data,
        headers: { "Content-Type": "image/png", "Content-Length": String(blob.size) },
        keyPair, t: "upload", x: [blob.sha256],
      });
      const accepts = isUploadSuccess(res.status);
      if (accepts) {
        trackUpload(blob.sha256, keyPair);
      } else {
        assertOneOf(res.status, [200, 201, 400], "upload without X-SHA-256 returns 200/201 or 400 if required", { detail: resDetail(res) });
      }
    }

    // If server requires X-SHA-256, verify it validates the hash correctly
    {
      const blob = await generateTestImage(getServerUrl());
      const wrongHash = "0".repeat(64);
      const auth = buildAuthEvent(keyPair, { t: "upload", x: [wrongHash] });
      const res = await apiRequest("PUT", "/upload", {
        body: blob.data, headers: { Authorization: authHeader(auth), "Content-Type": "image/png", "X-SHA-256": wrongHash },
      });
      assertEquals(res.status, 409, "X-SHA-256 mismatch returns 409 Conflict", { detail: resDetail(res) });
    }

    // Blob Descriptor
    {
      const { res, authRequired } = await uploadBlob();
      assertOneOf(res.status, UPLOAD_SUCCESS, "descriptor contains required fields — upload succeeds", { detail: resDetail(res) });
      if (isUploadSuccess(res.status)) {
        const desc = parseDescriptor(res.json());
        assertNotNull(desc, "descriptor is valid JSON with required fields");
        if (desc) {
          assertNotNull(desc.url, "descriptor has url field");
          assertNotNull(desc.sha256, "descriptor has sha256 field");
          assertNotNull(desc.size, "descriptor has size field");
          assertNotNull(desc.type, "descriptor has type field");
          assertNotNull(desc.uploaded, "descriptor has uploaded field");
        }
        if (authRequired) {
          const last = getResults();
          last[last.length - 1].authRequired = true;
        }
      }
    }
    {
      const { sha256, res } = await uploadBlob();
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "descriptor sha256 matches — upload succeeds", { detail: resDetail(res) })) {
        const desc = parseDescriptor(res.json());
        if (desc) assertEquals(desc.sha256, sha256, "descriptor sha256 matches uploaded blob hash");
      }
    }
    {
      const { res } = await uploadBlob();
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "descriptor size matches — upload succeeds", { detail: resDetail(res) })) {
        const desc = parseDescriptor(res.json());
        if (desc) assertGreaterThan(desc.size, 0, "descriptor size is greater than 0");
      }
    }
    {
      const { res } = await uploadBlob();
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "descriptor type reflects MIME — upload succeeds", { detail: resDetail(res) })) {
        const desc = parseDescriptor(res.json());
        if (desc) assertNotNull(desc.type, "descriptor has type field");
      }
    }
    {
      const { res } = await uploadBlob();
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "descriptor uploaded is timestamp — upload succeeds", { detail: resDetail(res) })) {
        const desc = parseDescriptor(res.json());
        if (desc) {
          assertEquals(Number.isInteger(desc.uploaded), true, "descriptor uploaded is an integer");
          assertGreaterThan(desc.uploaded, 0, "descriptor uploaded > 0");
        }
      }
    }
    {
      const { res } = await uploadBlob();
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "descriptor url includes extension — upload succeeds", { detail: resDetail(res) })) {
        const desc = parseDescriptor(res.json());
        if (desc) {
          const urlObj = new URL(desc.url);
          const pathParts = urlObj.pathname.split(".");
          assertGreaterThan(pathParts.length, 1, "descriptor URL includes file extension");
        }
      }
    }
    {
      const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe]);
      const hash = await sha256Hex(data);
      const { res } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: data, headers: { "Content-Type": "application/octet-stream" },
        keyPair, t: "upload", x: [hash], sha256: hash,
      });
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "descriptor type falls back for unknown — upload succeeds", { detail: resDetail(res) })) {
        trackUpload(hash, keyPair);
        const desc = parseDescriptor(res.json());
        if (desc) assertNotNull(desc.type, "descriptor has type field for unknown MIME");
      }
    }

    // PUT /upload
    {
      const { res, authRequired } = await uploadBlob();
      assertEquals(res.status, 201, "new blob returns 201 Created", { detail: resDetail(res) });
      if (authRequired) {
        const last = getResults();
        last[last.length - 1].authRequired = true;
      }
    }
    {
      const blob = await generateTestImage(getServerUrl());
      const { res: first } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      assertOneOf(first.status, UPLOAD_SUCCESS, "duplicate blob — first upload succeeds", { detail: resDetail(first) });
      if (isUploadSuccess(first.status)) trackUpload(blob.sha256, keyPair);
      const secondAuth = buildAuthEvent(keyPair, { t: "upload", x: [blob.sha256] });
      const second = await apiRequest("PUT", "/upload", {
        body: blob.data, headers: { Authorization: authHeader(secondAuth), "Content-Type": "image/png", "X-SHA-256": blob.sha256 },
      });
      assertEquals(second.status, 200, "duplicate blob returns 200 OK", { detail: resDetail(second) });
    }
    {
      const blob = await generateTestImage(getServerUrl());
      const { res } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png" },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "server does not modify blob — upload succeeds", { detail: resDetail(res) })) {
        trackUpload(blob.sha256, keyPair);
        const getOpts = serverAuthRequired
          ? { headers: { Authorization: authHeader(buildAuthEvent(keyPair, { t: "get", x: [blob.sha256] })) } }
          : undefined;
        const getRes = await apiRequest("GET", `/${blob.sha256}`, getOpts);
        if (assertEquals(getRes.status, 200, "server does not modify blob — GET succeeds", { detail: resDetail(getRes) })) {
          if (getRes.bodyBytes) {
            const bodyHash = await sha256Hex(getRes.bodyBytes);
            assertEquals(bodyHash, blob.sha256, "downloaded blob hash matches original");
          }
        }
      }
    }
    {
      const blob = await generateTestImage(getServerUrl());
      const { res } = await apiRequestWithAuthRetry("PUT", "/upload", {
        body: blob.data, headers: { "Content-Type": "image/png", "X-SHA-256": blob.sha256 },
        keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
      });
      if (assertOneOf(res.status, UPLOAD_SUCCESS, "X-SHA-256 header is accepted", { detail: resDetail(res) })) {
        trackUpload(blob.sha256, keyPair);
      }
    }
    {
      const { res, authRequired } = await uploadBlob();
      assertOneOf(res.status, UPLOAD_SUCCESS, "upload works without prior HEAD /upload request", { detail: resDetail(res) });
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
