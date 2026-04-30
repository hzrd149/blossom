import { generateSecretKey, getPublicKey, finalizeEvent, NostrEvent, EventTemplate } from "nostr-tools";
import { bytesToHex } from "nostr-tools/utils";
import { base64, base64url } from "@scure/base";
import { getServerUrl } from "./config.ts";

export interface KeyPair {
  sk: Uint8Array;
  skHex: string;
  pk: string;
}

export function generateKeyPair(): KeyPair {
  const sk = generateSecretKey();
  const skHex = bytesToHex(sk);
  const pk = getPublicKey(sk);
  return { sk, skHex, pk };
}

export function buildAuthEvent(
  keyPair: KeyPair,
  opts: {
    t: "get" | "upload" | "list" | "delete" | "media" | "report";
    x?: string[];
    server?: string;
    expiration?: number;
    content?: string;
  },
): NostrEvent {
  const now = Math.floor(Date.now() / 1000);
  const server = opts.server ?? getServerUrl().replace(/\/+$/, "");
  const template: EventTemplate = {
    kind: 24242,
    created_at: now,
    tags: [
      ["t", opts.t],
      ["expiration", String(opts.expiration ?? now + 300)],
    ],
    content: opts.content ?? `Blossom compliance test - ${opts.t}`,
  };

  if (opts.x) {
    for (const hash of opts.x) {
      template.tags.push(["x", hash]);
    }
  }

  template.tags.push(["server", server]);

  return finalizeEvent(template, keyPair.sk);
}

export function eventToBase64(event: NostrEvent): string {
  return base64url.encode(new TextEncoder().encode(JSON.stringify(event)));
}

export function eventToStandardBase64(event: NostrEvent): string {
  return base64.encode(new TextEncoder().encode(JSON.stringify(event)));
}

export function authHeader(event: NostrEvent): string {
  return `Nostr ${eventToBase64(event)}`;
}

export function authHeaderStandardBase64(event: NostrEvent): string {
  return `Nostr ${eventToStandardBase64(event)}`;
}
