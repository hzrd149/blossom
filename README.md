# 🌸 Blossom - Blobs stored simply on mediaservers

Blossom uses [nostr](https://github.com/nostr-protocol/nostr) public / private keys for identities. Users are expected to sign authorization events to prove their identity when interacting with servers

## What is it?

Blossom is a spec for a set of HTTP endpoints that allow users to store blobs of data on publicly accessible servers

## What are blobs

Blobs are packs of binary data addressed by their sha256 hash

## How does it work?

Blossom Servers expose four endpoints for managing blobs

- `GET /<sha256>` (optional file `.ext`) [BUD-01](./buds/01.md#get-sha256---get-blob)
- `HEAD /<sha256>` (optional file `.ext`) [BUD-01](./buds/01.md#head-sha256---has-blob)
- `PUT /upload` [BUD-2](./buds/02.md#put-upload---upload-blob)
  - `Authentication`: Signed [nostr event](./buds/01.md#upload-authorization-required)
  - Return a blob descriptor
- `GET /list/<pubkey>` [BUD-02](./buds/02.md#get-listpubkey---list-blobs)
  - Returns an array of blob descriptors
  - `Authentication` _(optional)_: Signed [nostr event](./buds/01.md#list-authorization-optional)
- `DELETE /<sha256>` [BUD-2](./buds/02.md#delete-sha256---delete-blob)
  - `Authentication`: Signed [nostr event](./buds/01.md#delete-authorization-required)
- `PUT /mirror` [BUD-04](./buds/04.md#put-mirror---mirror-blob)
  - `Authentication`: Signed [nostr event](./buds/01.md#upload-authorization-required)

## Protocol specification (BUDs)

BUDs stand for **Blossom Upgrade Documents**.

See the [BUDs](./buds) folder and specifically [BUD-01](./buds/01.md) and [BUD-02](./buds/02.md) for a detailed explanation of the endpoints

## License

Public domain.
