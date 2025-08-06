# BUD-03

## User Server List

`draft` `optional`

Defines a replaceable event using `kind:10063` to advertise the blossom servers a user uses to host their blobs.

The event MUST include at least one `server` tag containing the full server URL including the `http://` or `https://`.

The order of these tags is important and should be arranged with the users most "reliable" or "trusted" servers being first.

The `.content` field is not used.

```json
{
  "id": "e4bee088334cb5d38cff1616e964369c37b6081be997962ab289d6c671975d71",
  "pubkey": "781208004e09102d7da3b7345e64fd193cd1bc3fce8fdae6008d77f9cabcd036",
  "content": "",
  "kind": 10063,
  "created_at": 1708774162,
  "tags": [
    ["server", "https://cdn.self.hosted"],
    ["server", "https://cdn.satellite.earth"]
  ],
  "sig": "cc5efa74f59e80622c77cacf4dd62076bcb7581b45e9acff471e7963a1f4d8b3406adab5ee1ac9673487480e57d20e523428e60ffcc7e7a904ac882cfccfc653"
}
```

## Client Upload Implementation

When uploading blobs clients MUST attempt to upload the blob to at least the first `server` listed in the users server list.

Optionally clients MAY upload the blob to all the servers or mirror the blob to the other servers if they support [BUD-04](./04.md)

This ensures that the blob is available in multiple locations in the case one of the servers goes offline.

## Client Retrieval Implementation

When extracting the SHA256 hash from the URL clients MUST use the last occurrence of a 64 char hex string. This allows clients to extract hashes from blossom URLs and SOME non-blossom URLs.

In all the following examples, the hash `b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553` should be selected

- Blossom URLs
  - `https://blossom.example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf`
  - `https://cdn.example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553`
- Non Blossom URLs
  - `https://cdn.example.com/user/ec4425ff5e9446080d2f70440188e3ca5d6da8713db7bdeef73d0ed54d9093f0/media/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf`
  - `https://cdn.example.com/media/user-name/documents/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf`
  - `http://download.example.com/downloads/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553`
  - `http://media.example.com/documents/b1/67/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf`

In the context of nostr events, clients SHOULD use the author's server list when looking for blobs that are no longer available at the original URL.

Take the following event as an example

```json
{
  "id": "834185269f4ab72539193105060dbb1c8b2efd702d14481cea345c47beefe6eb",
  "pubkey": "ec4425ff5e9446080d2f70440188e3ca5d6da8713db7bdeef73d0ed54d9093f0",
  "content": "I've developed a new open source P2P e-cash system called Bitcoin. check it out\nhttps://cdn.broken-domain.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf",
  "kind": 1,
  "created_at": 1297484820,
  "tags": [],
  "sig": "bd4bb200bdd5f7ffe5dbc3e539052e27b05d6f9f528e255b1bc4261cc16b8f2ad85c89eef990c5f2eee756ef71b4c571ecf6a88ad12f7338e321dd60c6a903b5"
}
```

Once the client discovers that the URL `https://cdn.broken-domain.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf` is no longer available. It can perform the following steps to find the blob:

1. Get the SHA256 hash from the URL
2. Look for the authors server list `kind:10063`
3. If found, Attempt to retrieve the blob from each `server` listed started with the first
4. If not found, the client MAY fallback to using a well-known popular blossom server to retrieve the blob

This ensures clients can quickly find missing blobs using the users list of trusted servers.
