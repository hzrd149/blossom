import { url as buildUrl } from "./config.ts";
import { buildAuthEvent, authHeader, type KeyPair } from "./nostr.ts";

export const UPLOAD_SUCCESS = [200, 201, 202] as const;
export function isUploadSuccess(status: number): boolean {
  return (UPLOAD_SUCCESS as readonly number[]).includes(status);
}

export interface ApiResponse {
  status: number;
  headers: Headers;
  body: string;
  bodyBytes: Uint8Array | null;
  json: () => unknown;
}

export async function apiRequest(
  method: string,
  path: string,
  opts?: {
    body?: Uint8Array | string | null;
    headers?: Record<string, string>;
    baseUrl?: string;
  },
): Promise<ApiResponse> {
  const headers: Record<string, string> = { ...opts?.headers };
  let body: BodyInit | null = null;

  if (opts?.body != null) {
    body = typeof opts.body === "string" ? opts.body : opts.body;
  }

  const res = await fetch(buildUrl(path, opts?.baseUrl), {
    method,
    headers,
    body,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isBinary = !contentType.includes("text/") && !contentType.includes("json") && !contentType.includes("html") && !contentType.includes("xml");

  let bodyText = "";
  let bodyBytes: Uint8Array | null = null;

  if (method === "HEAD") {
    bodyText = "";
  } else if (isBinary || contentType.includes("image/") || contentType.includes("octet-stream") || contentType.includes("application/pdf")) {
    const buf = await res.arrayBuffer();
    bodyBytes = new Uint8Array(buf);
    bodyText = "";
  } else {
    bodyText = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    body: bodyText,
    bodyBytes,
    json: () => {
      try {
        return JSON.parse(bodyText || (bodyBytes ? new TextDecoder().decode(bodyBytes) : ""));
      } catch {
        return null;
      }
    },
  };
}

export interface AuthRetryResult {
  res: ApiResponse;
  authRequired: boolean;
}

export async function apiRequestWithAuthRetry(
  method: string,
  path: string,
  opts: {
    body?: Uint8Array | string | null;
    headers?: Record<string, string>;
    baseUrl?: string;
    keyPair: KeyPair;
    t: "get" | "upload" | "list" | "delete" | "media" | "report";
    x?: string[];
    sha256?: string;
  },
): Promise<AuthRetryResult> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.sha256 && !headers["X-SHA-256"]) {
    headers["X-SHA-256"] = opts.sha256;
  }
  const res = await apiRequest(method, path, { ...opts, headers });
  if (res.status !== 401) {
    return { res, authRequired: false };
  }
  const auth = buildAuthEvent(opts.keyPair, { t: opts.t, x: opts.x });
  const retryHeaders: Record<string, string> = { ...headers, Authorization: authHeader(auth) };
  const retryRes = await apiRequest(method, path, { ...opts, headers: retryHeaders });
  return { res: retryRes, authRequired: true };
}
