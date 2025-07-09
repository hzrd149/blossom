# 🌸 Blossom - Blobs stored simply on mediaservers

Blossom uses [nostr](https://github.com/nostr-protocol/nostr) public / private keys for identities. Users are expected to sign authorization events to prove their identity when interacting with servers

## What is it?

Blossom is a specification for a set of HTTP endpoints that allow users to store blobs of data on publicly accessible servers

## What are blobs

Blobs are packs of binary data addressed by their sha256 hash

## Protocol specification (BUDs)

BUDs or **Blossom Upgrade Documents** are short documents that outline an additional feature that a blossom server may implement.

## BUDs

- [BUD-00: Blossom Upgrade Documents](./buds/00.md)
- [BUD-01: Server requirements and blob retrieval](./buds/01.md)
- [BUD-02: Blob upload and management](./buds/02.md)
- [BUD-03: User Server List](./buds/03.md)
- [BUD-04: Mirroring blobs](./buds/04.md)
- [BUD-05: Media optimization](./buds/05.md)
- [BUD-06: Upload requirements](./buds/06.md)
- [BUD-08: Nostr File Metadata Tags](./buds/08.md)
- [BUD-09: Blob Report](./buds/09.md)

## Endpoints

Blossom Servers expose a few endpoints for managing blobs

- `GET /<sha256>` (optional file `.ext`) [BUD-01](./buds/01.md#get-sha256---get-blob)
- `HEAD /<sha256>` (optional file `.ext`) [BUD-01](./buds/01.md#head-sha256---has-blob)
- `PUT /upload` [BUD-02](./buds/02.md#put-upload---upload-blob)
  - `Authentication`: Signed [nostr event](./buds/02.md#upload-authorization-required)
  - Return a blob descriptor
- `HEAD /upload` [BUD-06](./buds/06.md#head-upload---upload-requirements)
- `GET /list/<pubkey>` [BUD-02](./buds/02.md#get-listpubkey---list-blobs)
  - Returns an array of blob descriptors
  - `Authentication` _(optional)_: Signed [nostr event](./buds/02.md#list-authorization-optional)
- `DELETE /<sha256>` [BUD-02](./buds/02.md#delete-sha256---delete-blob)
  - `Authentication`: Signed [nostr event](./buds/02.md#delete-authorization-required)
- `PUT /mirror` [BUD-04](./buds/04.md#put-mirror---mirror-blob)
  - `Authentication`: Signed [nostr event](./buds/02.md#upload-authorization-required)
- `HEAD /media` [BUD-05](./buds/05.md#head-media)
- `PUT /media` [BUD-05](./buds/05.md#put-media)
  - `Authentication`: Signed [nostr event](./buds/05.md#upload-authorization)
- `PUT /report` [BUD-09](./buds/09.md)
- `GET /info` [BUD-12](./buds/10.md)

## Protocol specification (BUDs)

BUDs stand for **Blossom Upgrade Documents**.

See the [BUDs](./buds) folder and specifically [BUD-01](./buds/01.md) and [BUD-02](./buds/02.md) for a detailed explanation of the endpoints

## BUDs

- [BUD-01: Server requirements and blob retrieval](./buds/01.md)
- [BUD-02: Blob upload and management](./buds/02.md)
- [BUD-03: User Server List](./buds/03.md)
- [BUD-04: Mirroring blobs](./buds/04.md)
- [BUD-05: Media optimization](./buds/05.md)
- [BUD-06: Upload requirements](./buds/06.md)
- [BUD-08: Nostr File Metadata Tags](./buds/08.md)
- [BUD-09: Blob Report](./buds/09.md)
- [BUD-12: Media servers information document](./buds/12.md)

## Event kinds

| kind    | description         | BUD                |
| ------- | ------------------- | ------------------ |
| `24242` | Authorization event | [01](./buds/01.md) |
| `10063` | User Server List    | [03](./buds/03.md) |

## License

Public domain.
