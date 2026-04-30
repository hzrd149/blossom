import { apiRequest, apiRequestWithAuthRetry, isUploadSuccess } from "./helpers/http.ts";
import { generateKeyPair } from "./helpers/nostr.ts";
import { generateTestImage } from "./helpers/test-blob.ts";
import { getServerUrl } from "./helpers/config.ts";
import { trackUpload, cleanupAll } from "./helpers/cleanup.ts";
import { finalizeEvent, EventTemplate } from "nostr-tools";
import { resetResults, getResults, assertOneOf, assertGreaterThan, resDetail } from "./helpers/assert.ts";
import type { AssertResult } from "./helpers/assert.ts";

export const budId = "BUD-09";
export const mandatory = false;

export async function run(): Promise<AssertResult[]> {
  resetResults();
  const keyPair = generateKeyPair();

  function buildReportEvent(
    kp: ReturnType<typeof generateKeyPair>,
    blobHashes: string[],
    reportType = "other",
    content = "Compliance test report",
  ) {
    const now = Math.floor(Date.now() / 1000);
    const template: EventTemplate = {
      kind: 1984,
      created_at: now,
      tags: blobHashes.map((h) => ["x", h, reportType]),
      content,
    };
    return finalizeEvent(template, kp.sk);
  }

  async function uploadRealBlob() {
    const blob = await generateTestImage(getServerUrl());
    const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/upload", {
      body: blob.data,
      headers: { "Content-Type": "image/png", "Content-Length": String(blob.size) },
      keyPair, t: "upload", x: [blob.sha256], sha256: blob.sha256,
    });
    if (isUploadSuccess(res.status)) trackUpload(blob.sha256, keyPair);
    return { sha256: blob.sha256, uploadOk: isUploadSuccess(res.status), authRequired };
  }

  try {
    // PUT /report — single blob
    {
      const uploaded = await uploadRealBlob();
      if (uploaded.uploadOk) {
        const reportEvent = buildReportEvent(keyPair, [uploaded.sha256]);
        const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/report", {
          body: JSON.stringify(reportEvent),
          headers: { "Content-Type": "application/json" },
          keyPair, t: "report", x: [uploaded.sha256],
        });
        assertOneOf(res.status, [200, 201, 204], "PUT /report accepts signed kind:1984 report event", { detail: resDetail(res) });
        if (authRequired) {
          const last = getResults();
          last[last.length - 1].authRequired = true;
        }
      }
    }

    // PUT /report — multiple x tags
    {
      const a = await uploadRealBlob();
      const b = await uploadRealBlob();
      if (a.uploadOk && b.uploadOk) {
        const reportEvent = buildReportEvent(keyPair, [a.sha256, b.sha256]);
        const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/report", {
          body: JSON.stringify(reportEvent),
          headers: { "Content-Type": "application/json" },
          keyPair, t: "report", x: [a.sha256, b.sha256],
        });
        assertOneOf(res.status, [200, 201, 204], "PUT /report with multiple x tags is accepted", { detail: resDetail(res) });
        if (authRequired) {
          const last = getResults();
          last[last.length - 1].authRequired = true;
        }
      }
    }

    // PUT /report — with e and p tags
    {
      const uploaded = await uploadRealBlob();
      if (uploaded.uploadOk) {
        const now = Math.floor(Date.now() / 1000);
        const template: EventTemplate = {
          kind: 1984,
          created_at: now,
          tags: [
            ["x", uploaded.sha256, "other"],
            ["e", "6".repeat(64)],
            ["p", "7".repeat(64)],
          ],
          content: "Report with event and pubkey tags",
        };
        const reportEvent = finalizeEvent(template, keyPair.sk);
        const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/report", {
          body: JSON.stringify(reportEvent),
          headers: { "Content-Type": "application/json" },
          keyPair, t: "report", x: [uploaded.sha256],
        });
        assertOneOf(res.status, [200, 201, 204], "PUT /report with e/p tags is accepted", { detail: resDetail(res) });
        if (authRequired) {
          const last = getResults();
          last[last.length - 1].authRequired = true;
        }
      }
    }

    // PUT /report — invalid/nonexistent blob hash is rejected
    {
      const fakeHash = "b".repeat(64);
      const reportEvent = buildReportEvent(keyPair, [fakeHash]);
      const { res, authRequired } = await apiRequestWithAuthRetry("PUT", "/report", {
        body: JSON.stringify(reportEvent),
        headers: { "Content-Type": "application/json" },
        keyPair, t: "report", x: [fakeHash],
      });
      assertGreaterThan(res.status, 399, "PUT /report with invalid blob hash is rejected with 4xx/5xx", { detail: resDetail(res) });
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
