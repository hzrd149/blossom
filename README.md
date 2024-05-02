# 🌸 Blossom - Blobs stored simply on mediaservers

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

## Protocol specification (BUDs)

BUDs stand for **Blossom Upgrade Documents**.

See the [BUDs](./buds) folder and specifically [BUD-01](./buds/bud-01.md) for a detailed explanation of the endpoints

## License

Public domain.
