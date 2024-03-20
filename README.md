# 🌸 Blossom WIP

Blobs stored simply on mediaservers

## What is it?

Blossom is a spec for a set of HTTP endpoints that allow users to store blobs of data on publicly accessible servers

## What are blobs

Blobs are packs of binary data addressed by their sha256 hash

## How does it work?

Blossom Servers expose four endpoints for managing blobs

- `GET /<sha256>` (optional file `.ext`)
- `HEAD /<sha256>` (optional file `.ext`)
- `PUT /upload`
  - `Authentication`: Signed [nostr event](./Server.md#upload-authorization-required)
  - Return a blob descriptor
- `GET /list/<pubkey>`
  - Returns an array of blob descriptors
  - `Authentication` _(optional)_: Signed [nostr event](./Server.md#list-authorization-optional)
- `DELETE /<sha256>`
  - `Authentication`: Signed [nostr event](./Server.md#delete-authorization-required)

## Blob Descriptor

A blob descriptor is a JSON object containing `url`, `sha256`, `size`, `type`, and `created` fields

- `url` A public facing url this blob can retrieved from
- `sha256` The sha256 hash of the blob
- `size` The size of the blob in bytes
- `type` (optional) The MIME type of the blob
- `created` The unix timestamp of when the blob was uploaded to the server

Servers may include additional fields in the descriptor like `magnet`, `infohash`, or `ipfs` depending on other protocols they support

## Nostr Identities

Blossom uses nostr public / private keys for identities. Users are expected to sign authorization events to prove their identity when interacting with servers

See [Nostr](./Nostr.md)

## Server Implementation

See [Server](./Server.md)

## Client Implementation

See [Client](./Client.md)
