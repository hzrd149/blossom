const encoder = new TextEncoder();

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function randomBlob(minSize = 64, maxSize = 1024): { data: Uint8Array; sha256: Promise<string> } {
  const size = minSize + Math.floor(Math.random() * (maxSize - minSize));
  const data = randomBytes(size);
  return { data, sha256: sha256Hex(data) };
}
