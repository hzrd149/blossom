# HLS Video Formatting

This document explains how to format [HLS](https://datatracker.ietf.org/doc/html/rfc8216) (HTTP Live Streaming) videos to be compatible with [BUD-01](../buds/01.md) blob retrieval.

## Overview

HLS videos consist of multiple files:
- A master playlist (`.m3u8`) that references variant playlists
- Variant playlists (`.m3u8`) that reference media segments
- Media segment files (typically `.ts` files)

Each file MUST be uploaded as a separate blob and referenced by its SHA256 hash using the [BUD-01](../buds/01.md#get-sha256---get-blob) `GET /<sha256>` endpoint format.

## Relative Paths

To ensure compatibility across different Blossom servers and allow easy server switching, all URLs in HLS playlists MUST use relative paths containing the SHA256 hash of the referenced blob.

Clients MUST NOT include the full server domain in playlist URLs. This allows the same playlist to work with any Blossom server that hosts the referenced blobs.

## Master Playlist Format

The master playlist (`.m3u8`) MUST reference variant playlists using relative paths with SHA256 hashes.

The master playlist MUST have the MIME type `application/vnd.apple.mpegurl` or `application/x-mpegURL`.

Example master playlist:

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=854x480
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2560000,RESOLUTION=1280x720
f6e5d4c3b2a1098765432109876543210987654321fedcba0987654321fedcba.m3u8
```

## Variant Playlist Format

Variant playlists (`.m3u8`) MUST reference media segments using relative paths with SHA256 hashes.

Each segment URL MUST be a relative path containing the SHA256 hash of the segment file. The file extension (`.ts`, `.m4s`, etc.) MAY be included for compatibility with HLS clients.

Example variant playlist:

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.000,
b82fcf4dbcec2d8fab7d94bdd48b070aa6e74d7240b1965a0b28c128d6858477.ts
#EXTINF:10.000,
cd2a98d055eef5ec3aca73bd136a40340539138da73144d589d9de5a3a52149a.ts
#EXTINF:10.000,
128e690f89419ecbea473a490c42cac94a2293ecf1f57d60492ceafce3d5cfdb.ts
#EXT-X-ENDLIST
```

## Media Segments

Media segment files (typically `.ts` files) MUST be uploaded as separate blobs. Each segment MUST be retrievable via the [BUD-01](../buds/01.md#get-sha256---get-blob) `GET /<sha256>` endpoint.

The server SHOULD set the `Content-Type` header appropriately:
- `.ts` files: `video/mp2t` or `video/MP2T`
- `.m4s` files: `video/iso.segment` or `video/mp4`

## Client Implementation

When generating HLS playlists for Blossom:

1. Upload each media segment as a separate blob using [BUD-02](../buds/02.md#put-upload---upload-blob) `PUT /upload`
2. Upload each variant playlist as a separate blob
3. Upload the master playlist as a separate blob
4. In all playlists, use relative paths containing only the SHA256 hash (and optional file extension) of the referenced blob
5. When serving the master playlist, clients MAY prepend the current server's base URL to resolve relative paths

Example client flow:

1. Upload segment `segment001.ts` → get SHA256: `1a2b3c4d...`
2. Upload segment `segment002.ts` → get SHA256: `2b3c4d5e...`
3. Create variant playlist referencing `1a2b3c4d...ts` and `2b3c4d5e...ts`
4. Upload variant playlist → get SHA256: `a1b2c3d4...`
5. Create master playlist referencing `a1b2c3d4...m3u8`
6. Upload master playlist → get SHA256: `f9e8d7c6...`

## Server Implementation

When serving HLS playlists, servers MUST:

1. Return the playlist content with the appropriate `Content-Type` header (`application/vnd.apple.mpegurl` or `application/x-mpegURL`)
2. Serve playlists via the [BUD-01](../buds/01.md#get-sha256---get-blob) `GET /<sha256>` endpoint
3. Support optional file extensions (e.g., `/<sha256>.m3u8`) as specified in [BUD-01](../buds/01.md#get-sha256---get-blob)

When a client requests a playlist blob, the server MUST return the playlist content as-is, without modifying relative paths. The client is responsible for resolving relative paths to absolute URLs using the current server's base URL.

## URL Resolution

When a client retrieves a playlist from `https://cdn.example.com/<sha256>.m3u8`, relative paths in the playlist (e.g., `a1b2c3d4...m3u8`) MUST be resolved relative to the playlist's origin.

For example, if a playlist is served from `https://cdn.example.com/f9e8d7c6...m3u8` and contains a relative path `a1b2c3d4...m3u8`, the client SHOULD resolve it to `https://cdn.example.com/a1b2c3d4...m3u8`.

This allows the same playlist blob to work with any Blossom server, as long as all referenced blobs are available on that server.

## Example Complete Structure

```
Master Playlist (SHA256: f9e8d7c6...)
  └─> Variant Playlist 1 (SHA256: a1b2c3d4...)
        └─> Segment 1 (SHA256: 1a2b3c4d...)
        └─> Segment 2 (SHA256: 2b3c4d5e...)
        └─> Segment 3 (SHA256: 3c4d5e6f...)
  └─> Variant Playlist 2 (SHA256: b2c3d4e5...)
        └─> Segment 1 (SHA256: 4d5e6f78...)
        └─> Segment 2 (SHA256: 5e6f7890...)
        └─> Segment 3 (SHA256: 6f789012...)
```

All references between these files use relative paths containing only SHA256 hashes, making the entire HLS structure portable across different Blossom servers.
