export interface ServerTarget {
  url: string;
  name: string;
  software: string;
}

export const DEFAULT_SERVERS: ServerTarget[] = [
  { url: "https://blossom.primal.net", name: "Primal", software: "primal-blossom" },
  { url: "https://24242.io", name: "24242.io", software: "24242" },
  { url: "https://blossom.band", name: "blossom.band", software: "nostr-build" },
  { url: "https://blossom.yakihonne.com", name: "YakiHonne", software: "yakihonne" },
  { url: "https://nostr.download", name: "nostr.download", software: "route96" },
  { url: "https://milo.nostria.app", name: "Nostria", software: "nostria" },
  { url: "https://nostrmedia.com", name: "NostrMedia", software: "nostrmedia" },
  { url: "https://nostrcheck.me", name: "nostrcheck.me", software: "nostrcheck" },
  { url: "https://blossom.data.haus", name: "data.haus", software: "blossom-server-rs" },
  { url: "https://cdn.sovbit.host", name: "Sovbit", software: "sovbit" },
  { url: "https://blossom.azzamo.media", name: "Azzamo", software: "azzamo" },
];

export function getServerUrl(): string {
  return (process.env.BLOSSOM_SERVER_URL ?? "").replace(/\/+$/, "");
}

export function getServerTargets(): ServerTarget[] {
  const envUrl = getServerUrl();
  if (envUrl) {
    return [{ url: envUrl, name: new URL(envUrl).hostname, software: "custom" }];
  }
  return DEFAULT_SERVERS;
}

export function url(path: string, baseUrl?: string): string {
  const base = (baseUrl ?? getServerUrl()).replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
