# 🌸 Blossom

Blobs stored simply on mediaservers

## What is it?

Blossom is a spec of http endpoints for storing blobs on publicly accessible servers

## How dose it work?

Blobs are packs of binary data addressed by their sha256 hash

Blossom Servers expose four endpoints for managing blobs

- `GET /<sha256>` (optional file `.ext`)
- `PUT /upload`
- `GET /list`
- `DELETE /<sha256>`

## Blob Descriptor

A blob descriptor is a JSON object containing `url`, `sha256`, `size`, `type`, and `created` fields

- `url` A public facing url this blob can retrieved from
- `sha256` The sha256 hash of the blob
- `size` The size of the blob in bytes
- `type` (optional) The MIME type of the blob
- `created` The unix timestamp of when the blob was uploaded to the server

Servers may include additional fields in the descriptor like `magnet`, `infohash`, or `ipfs` depending on other protocols they support

## Nostr Identities

Blossom uses nostr public / private keys for identities. Users are expected to sign "Client Authentication" events to prove their identity when uploading or deleting blobs

## Server Implementation

See [Server](./Server.md)

## Client Implementation

Example Implementation: [blossom-client](https://github.com/hzrd149/blossom-client) (TypeScript)
