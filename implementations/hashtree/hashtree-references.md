# Hashtree References

## Abstract

This document defines `htree` references to files, directories, and paths in Hashtree manifests stored as Blossom blobs. A reference can select a mutable root published by a Nostr identity or an immutable root encoded as an `nhash` identifier.

## Status of This Document

This is an experimental Hashtree specification. It is not part of the official Blossom or Nostr specifications. The `htree` URI scheme, `nhash` prefix, and Nostr kind `30064` are experimental and are not assumed to be registered.

Normative key words are interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14).

## Terminology

- **mutable reference**: A reference resolved through the latest valid Nostr root event for an author and tree name.
- **immutable reference**: A reference containing a specific root manifest hash.
- **root key**: The CHK key used to decrypt an encrypted root manifest.
- **link key**: A random key used to share access to a link-private mutable root.
- **tree path**: Zero or more directory entry names below the root.

## Reference Forms

The canonical forms are:

```text
htree://<npub>/<tree-name>[/<path>]
htree://<nhash>[/<path>]
```

The URI authority is either a NIP-19 `npub` or an `nhash`. In the `npub` form, the first path segment is the tree name and remaining segments are the tree path. In the `nhash` form, every path segment belongs to the tree path.

The `npub` form is mutable. The `nhash` form is immutable.

Examples using syntactically valid identifiers:

```text
htree://npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6/photos/2026/summer.jpg
htree://npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6/releases%2Fnostr-vpn/v0.3.0/app.zip
htree://nhash1qqs2h2at4w46h2at4w46h2at4w46h2at4w46h2at4w46h2at4w46h2cym3cqn/docs/index.html
```

## URI Processing

Clients MUST process an `htree` URI as follows:

1. Parse the URI without treating query strings or fragments as part of the tree path.
2. Validate and decode the authority as exactly one supported identifier.
3. Split the encoded path on literal `/` characters.
4. Percent-decode each segment independently as UTF-8.
5. Reject malformed percent encoding, invalid UTF-8, or an invalid decoded tree-path segment.

The mutable form MUST contain a non-empty tree-name segment. A tree name is an application-defined UTF-8 string and MUST NOT contain U+0000. A `/` within a tree name MUST be percent-encoded as `%2F`.

Every decoded tree-path segment MUST satisfy the entry-name rules in [Directory Manifests](./directory-manifests.md). An encoded slash in a tree-path segment therefore decodes successfully but is rejected as an invalid entry name.

URI fragments are application-local and MUST be ignored during Hashtree resolution.

## Mutable Root Events

A mutable reference resolves through a Nostr parameterized replaceable event with:

- Kind `30064`.
- Event author equal to the 32-byte public key decoded from the URI `npub`.
- Exactly one `d` tag whose value equals the decoded tree name.
- Exactly one `hash` tag whose value is the 32-byte root manifest hash encoded as 64 lowercase hexadecimal characters.
- An OPTIONAL `l` tag with value `hashtree` for discovery.

The event content SHOULD be an empty string. Unknown tags MUST be ignored unless they make a required tag ambiguous.

A client MUST validate the Nostr event ID and signature before using any tag. It MUST reject events with missing, duplicate, malformed, or conflicting required tags.

Clients select the latest valid event for `(kind, author, d)` according to the Nostr addressable-event rules in NIP-01. If valid events have equal `created_at` values, the event with the lexicographically lowest event ID wins.

### Root Visibility

A root event MUST conform to exactly one visibility mode.

#### Public Root

An unencrypted public root has no key-management tags. An encrypted public root has exactly one:

```text
["key", <root-key-hex>]
```

`root-key-hex` is the 32-byte root CHK key encoded as 64 lowercase hexadecimal characters. The key is public to everyone who can read the event.

#### Link-Private Root

A link-private root has exactly one of each:

```text
["encryptedKey", <wrapped-root-key-hex>]
["keyId", <key-id-hex>]
```

The writer generates a uniformly random 32-byte `link_key` and computes:

```text
wrapped_root_key = root_key XOR link_key
key_id = first_8_bytes(SHA-256(link_key))
```

Both values are lowercase hexadecimal. `wrapped-root-key-hex` is 64 characters and `key-id-hex` is 16 characters.

The mutable URI carries the link key as `k=<link-key-hex>`. A client MUST verify `keyId`, recover `root_key`, and then validate that key by decrypting the root according to [Content Hash Key Encryption](./content-hash-key-encryption.md).

A link-private event MAY include one `selfEncryptedKey` or one `selfEncryptedLinkKey` recovery tag as defined below. It MUST NOT include a public `key` tag.

#### Owner-Private Root

An owner-private root has exactly one `selfEncryptedKey` tag and no public or link-private key tags:

```text
["selfEncryptedKey", <nip44-payload>]
```

The payload is the lowercase hexadecimal root key encrypted as a NIP-44 version 2 string from the event author to the same event author.

For link-private recovery, `selfEncryptedKey` encrypts the root key and `selfEncryptedLinkKey` encrypts the link key using the same self-to-self NIP-44 procedure. An event MUST NOT contain both recovery tags.

Clients MUST verify the containing event before NIP-44 decryption.

### Mutable URI Secret

Only the `k` query parameter is defined by this document. A URI MUST contain no more than one `k` parameter. Its value MUST be 64 lowercase hexadecimal characters and is valid only for a link-private root. A client MUST reject duplicate `k` parameters. Unknown query parameters MAY be retained by applications but MUST NOT affect Hashtree root or path resolution.

The `k` parameter is a bearer secret. Clients MUST remove it before making Blossom HTTP requests.

## Immutable `nhash` Identifiers

`nhash` is a NIP-19-style bech32 identifier with human-readable part `nhash`. It uses bech32, not bech32m. Its data payload is a sequence of TLV records:

```text
type:   1 byte unsigned integer
length: 1 byte unsigned integer
value:  length bytes
```

Defined records are:

| Type | Length | Cardinality | Meaning |
| --- | --- | --- | --- |
| `0` | `32` | exactly one | Root manifest hash |
| `5` | `32` | zero or one | Root CHK key |

Type `0` follows the NIP-19 convention that type `0` contains the identifier's primary value. Type `5` is local to `nhash`; it does not assign a meaning to type `5` in other NIP-19 identifiers.

Canonical writers MUST encode type `0` first and type `5` second when present. They MUST NOT emit any other type. Readers MUST reject duplicate defined records or defined records with the wrong length. Readers SHOULD ignore unknown record types so future extensions remain parseable.

Types `1`, `2`, and `3` do not imply NIP-19 relay, author, or kind semantics for `nhash`.

An `nhash` containing type `5` is a bearer secret.

## Root and Path Resolution

To resolve an `htree` reference, a client MUST:

1. Resolve the root hash and optional root key from the mutable event or immutable identifier.
2. Fetch the root manifest as an ordinary Blossom blob.
3. Verify the fetched bytes against the root hash.
4. Decrypt the root locally when a root key is present.
5. Decode and validate the root as node type `1`, `2`, or `3`.
6. If the path is non-empty, require a directory root of type `2` or `3` and traverse each segment using the directory and fanout specifications.
7. Decrypt and validate linked objects as required by their links.
8. If the final object is a file node, assemble or stream it according to the chunked-file specification.

An empty path resolves to the root object. A non-empty path applied to a file root is invalid.

Clients MUST reject invalid identifiers, missing mutable roots, unsupported node or link types, invalid paths, hash mismatches, decryption failures, malformed manifests, and structural validation failures.

## HTTP Gateway Mapping

Gateways MAY expose equivalent HTTP paths:

```text
/htree/<npub>/<tree-name>[/<path>]
/htree/<nhash>[/<path>]
```

A gateway MUST apply the same segment-by-segment decoding, validation, root resolution, and path traversal rules as an `htree` client. This document does not define gateway discovery, response headers, caching policy, or authorization.

## Security Considerations

Mutable references can change whenever the author publishes a newer valid root event. Applications requiring a stable historical result SHOULD use an immutable `nhash`.

Root keys, link keys, `nhash` values containing keys, and mutable URIs containing `k` are bearer secrets. Applications SHOULD prevent their disclosure through logs, browser history, analytics, referrer headers, clipboard monitoring, and shared screenshots.

The 8-byte key ID permits false matches with probability approximately `2^-64`; it is only an early key check. Successful authenticated root decryption and CHK validation remain REQUIRED.

Nostr events reveal the author, tree name, update time, visibility mode, and root hash even when the root manifest is encrypted. Applications requiring metadata privacy need an additional publication mechanism outside this specification.

Clients SHOULD limit manifest size, recursion depth, relay responses, total events examined, total links, and total bytes fetched.

## Test Vector

### `nhash` Without Key

```text
root_hash: abababababababababababababababababababababababababababababababab
payload: 0020abababababababababababababababababababababababababababababababab
nhash: nhash1qqs2h2at4w46h2at4w46h2at4w46h2at4w46h2at4w46h2at4w46h2cym3cqn
```

## References

### Normative References

- [NIP-01: Basic Protocol Flow](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-19: bech32-Encoded Entities](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [NIP-44: Encrypted Payloads](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [RFC 3986: Uniform Resource Identifier](https://www.rfc-editor.org/rfc/rfc3986)
- [Hashtree Manifest Format](./hashtree-manifest-format.md)
- [Directory Manifests](./directory-manifests.md)
- [Chunked File Manifests](./chunked-file-manifests.md)
- [Directory Fanout](./directory-fanout.md)
- [Content Hash Key Encryption](./content-hash-key-encryption.md)

### Informative References

- [Hashtree reference implementation](https://git.iris.to/#/npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/hashtree)
