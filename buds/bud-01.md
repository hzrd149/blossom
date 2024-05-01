# BUD-01

## Core endpoint outline

`draft` `mandatory`

Blossom uses [nostr](https://github.com/nostr-protocol/nostr) public / private keys for identities. Users are expected to sign authorization events to prove their identity when interacting with servers

_All pubkeys MUST be in hex format_

## Cross origin headers

Servers MUST set the `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Authorization,*` and `Access-Control-Allow-Methods: GET, PUT, DELETE` headers on all endpoints to ensure compatibility with apps hosted on other domains

## Authorization events

Authorization events are used to identify the users to the server

Authorization events must be generic and must NOT be scoped to specific servers. This allows pubkeys to sign a single event and interact the same way with multiple servers.

Events MUST be kind `24242` and have a `t` tag with a verb of `get`, `upload`, `list`, or `delete`

Events MUST have the `content` set to a human readable string explaining to the user what the events inteded use is. For example `Upload Blob`, `Delete dog-picture.png`, `List Images`, etc

All events MUST have a [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md) `expiration` tag set to a unix timestamp at which the event should be considered expired.

Example event:

```json
{
  "id": "a2d97d0c8b19d6d91b8bd3c36feeb69f176861f9443ba575cbabf9941d4200bf",
  "pubkey": "2db760eae90b5764f3503e0c5660a1a74be9ded5eb8b493e81f65c28a088e9fe",
  "kind": 24242,
  "content": "Upload bitcoin.pdf",
  "created_at": 1708773959,
  "tags": [
    ["t", "upload"],
    ["size", "184292"],
    ["expiration", "1708858680"]
  ],
  "sig": "1442c68d5a661d821e9a4b91999b433a1d11557eeb6255496c6875c00d02497deb03dcb54597f210582cd62b621df21b080a0eadbd66ae703264b5929b160d05"
}
```

Servers must perform the following checks in order to validate the event

1. The `kind` must be `24242`
2. `created_at` must be in the past
3. The `expiration` tag must be set to a Unix timespamp in the future
4. The `t` tag must have a verb matching the intended action of the endpoint
5. Additional checks for specific endpoints. `/upload`, `/delete`, etc

Using the `Authorization` HTTP header, the kind `24242` event MUST be base64 encoded and use the Authorization scheme Nostr

Example HTTP Authorization header:

```
Authorization: Nostr eyJpZCI6IjhlY2JkY2RkNTMyOTIwMDEwNTUyNGExNDI4NzkxMzg4MWIzOWQxNDA5ZDhiOTBjY2RiNGI0M2Y4ZjBmYzlkMGMiLCJwdWJrZXkiOiI5ZjBjYzE3MDIzYjJjZjUwOWUwZjFkMzA1NzkzZDIwZTdjNzIyNzY5MjhmZDliZjg1NTM2ODg3YWM1NzBhMjgwIiwiY3JlYXRlZF9hdCI6MTcwODc3MTIyNywia2luZCI6MjQyNDIsInRhZ3MiOltbInQiLCJnZXQiXSxbImV4cGlyYXRpb24iLCIxNzA4ODU3NTQwIl1dLCJjb250ZW50IjoiR2V0IEJsb2JzIiwic2lnIjoiMDJmMGQyYWIyM2IwNDQ0NjI4NGIwNzFhOTVjOThjNjE2YjVlOGM3NWFmMDY2N2Y5NmNlMmIzMWM1M2UwN2I0MjFmOGVmYWRhYzZkOTBiYTc1NTFlMzA4NWJhN2M0ZjU2NzRmZWJkMTVlYjQ4NTFjZTM5MGI4MzI4MjJiNDcwZDIifQ==
```

## Blob Descriptor

A blob descriptor is a JSON object containing `url`, `sha256`, `size`, `type`, and `created` fields

- `url` A public facing url this blob can retrieved from
- `sha256` The sha256 hash of the blob
- `size` The size of the blob in bytes
- `type` (optional) The MIME type of the blob
- `created` The unix timestamp of when the blob was uploaded to the server

Servers may include additional fields in the descriptor like `magnet`, `infohash`, or `ipfs` depending on other protocols they support

## Endpoints

All endpoints MUST be served from the root path (eg. `https://cdn.example.com/upload`, etc). This allows clients to talk to servers interchangeably when uploading or fetching blobs

Servers MUST repond with `Content-Type: application/json` and a JSON object containing `message` for all error responses

The `message` field MUST be human readable and should explain the reason for the error. Optionally servers may include other fields for the client with more information about the error.

### Example Error response

```
HTTP/2 401
content-type: application/json; charset=utf-8
content-length: 32
access-control-allow-origin: *
access-control-expose-headers: *
access-control-allow-headers: authorization,*
access-control-allow-methods: get, put, delete

{"message":"Missing Auth event"}
```

### GET /sha256 - Get Blob

The `GET /<sha256>` endpoint MUST return the contents of the blob with the `Content-Type` header set to the appropriate MIME type

The endpoint MUST accept an optional file extension in the URL. ie. `.pdf`, `.png`, etc

#### Get Authorization (optional)

The server may optionally require authorization when fetching blobs from the `GET /<sha256>` endpoint

In this case the server MUST perform additional checks on the authorization event

1. The `t` tag must be set to `get`

If the client did not send an `Authorization` header the server must respond with the appropriate HTTP status code `401` (Unauthorized)

Example Authorization event:

```json
{
  "id": "3a2c0a58f88f86ab81ce7d111df57096e8cd9f41a75731a021e06e07c6df9d0e",
  "pubkey": "96ddb0e7c4a5786a842094fee014d4c6cbb1f1627a8d75ef6fb601baeb6c5054",
  "kind": 24242,
  "content": "Get Blobs",
  "created_at": 1708771927,
  "tags": [
    ["t", "get"],
    ["expiration", "1708857340"]
  ],
  "sig": "2f279b2ac0a5d5f7551f5612b69a111e038ab6b31233a78bfc98f63bd5e38ae8cb5929cf7427f0b7b2dd5eff29e769df23d93926326b0d059dc475701a41d6d3"
}
```

### HEAD /sha256 - Has Blob

The `HEAD /<sha256>` endpoint MUST respond with either a `200` or `404` status code

The endpoint MUST accept an optional file extension in the URL similar to the `GET /<sha256>` endpoint. ie. `.pdf`, `.png`, etc

### PUT /upload - Upload Blob

The `PUT /upload` endpoint MUST accept binary data in the body of the request and MAY use the `Content-Type` header to get the MIME type of the data

The endpoint MUST NOT modify the blob in any way and should return the exact same sha256 that was uploaded. This is critical to allow users to re-upload their blobs to new servers

The endpoint MUST return a [Blob Descriptor](./README.md#blob-descriptor) if the upload was successful or an error object if not

Servers MAY reject an upload for any reason and should respond with the appropriate HTTP `4xx` status code and an error message explaining the reason for the rejection

#### Upload Authorization (required)

Servers MUST accept an authorization event when uploading blobs and should perform additional checks

1. The `t` tag MUST be set to `upload`
2. A `size` tag MUST be present and set to the total size of the uploaded blob in bytes

Example Authorization event:

```json
{
  "id": "65c72db0c3b82ffcb395589d01f3e2849c28753e9e7156ceb88e5dd937ca845f",
  "pubkey": "6ea2ab6f206844b1fe48bd8a7eb22ed6e4114a5b2a5252700a729a88142b2bc3",
  "kind": 24242,
  "content": "Upload bitcoin.pdf",
  "created_at": 1708773959,
  "tags": [
    ["t", "upload"],
    ["size", "184292"],
    ["expiration", "1708858680"]
  ],
  "sig": "df099ecaeadb7ebcd7ec8247eb57eb6720d39f64a024be3ef1ed9b5d51087b0e866bd08fd317d5167f9bdb9cdae4e593539b86678c4d922db17d0463e0f9e0e3"
}
```

### GET /list/pubkey - List Blobs

The `/list/<pubkey>` endpoint MUST return a JSON array of [Blob Descriptor](#blob-descriptor) that where uploaded by the specified pubkey

The endpoint MUST support a `since` and `until` query parameter to limit the returned blob descriptors by the `created` field

Servers may reject a list for any reason and MUST respond with the appropriate HTTP `4xx` status code and an error message explaining the reason for the rejection

#### List Authorization (optional)

The server may optionally require Authorization when listing blobs uploaded by the pubkey

In this case the server must perform additional checks on the authorization event

1. The `t` tag must be set to `list`

Example Authorization event:

```json
{
  "id": "cbb1cab9566355bfdf04e1f1fc1e655fe903ecc193e8a750092ee53beec2a0e8",
  "pubkey": "a5fc3654296e6de3cda6ba3e8eba7224fac8b150fd035d66b4c3c1dc2888b8fc",
  "kind": 24242,
  "content": "List Blobs",
  "created_at": 1708772350,
  "tags": [
    ["t", "list"],
    ["expiration", "1708858680"]
  ],
  "sig": "ff9c716f8de0f633738036472be553ce4b58dc71d423a0ef403f95f64ef28582ef82129b41d4d0ef64d2338eb4aeeb66dbc03f8b3a3ed405054ea8ecb14fa36c"
}
```

### DELETE /sha256 - Delete Blob

Servers MUST accept `DELETE` requests to the `/<sha256>` endpoint

Servers may reject a delete request for any reason and should respond with the aproperate HTTP `4xx` status code and an error message explaining the reason for the rejection

#### Delete Authorization (required)

Servers MUST accept an authorization event when deleting blobs

Servers should perform additional checks on the authorization event

1. The `t` tag must be set to `delete`
2. A `x` tag must be present and set to the sha256 hash of the blob being deleted

Example Authorization event:

```json
{
  "id": "a92868bd8ea740706d931f5d205308eaa0e6698e5f8026a990e78ee34ce47fe8",
  "pubkey": "ae0063dd2c81ec469f2291ac029a19f39268bfc40aea7ab4136d7a858c3a06de",
  "kind": 24242,
  "content": "Delete bitcoin.pdf",
  "created_at": 1708774469,
  "tags": [
    ["t", "delete"],
    ["x", "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553 "],
    ["expiration", "1708858680"]
  ],
  "sig": "2ba9af680505583e3eb289a1624a08661a2f6fa2e5566a5ee0036333d517f965e0ffba7f5f7a57c2de37e00a2e85fd7999076468e52bdbcfad8abb76b37a94b0"
}
```
