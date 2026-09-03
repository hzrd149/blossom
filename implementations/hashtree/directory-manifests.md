# Directory Manifests

## Abstract

This document defines Hashtree directory manifests: canonical, content-addressed collections of user-visible named links to blobs, files, and child directories.

## Status of This Document

This is an experimental Hashtree specification. It is not part of the official Blossom specification.

Normative key words are interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14).

## Terminology

- **directory node**: A manifest with node type `2`.
- **entry**: A named link directly contained by a directory node.
- **path segment**: One decoded directory entry name in a path.
- **directory root**: A directory node or [directory fanout](./directory-fanout.md) node representing a directory.

This document uses the node and link encoding defined by the [Hashtree Manifest Format](./hashtree-manifest-format.md).

## Media Type and Extension

When a media type is available, a directory manifest SHOULD use:

```text
application/vnd.blossom.directory+msgpack
```

A URI conforming to the [Blossom URI Scheme](../../buds/10.md) SHOULD use the `.bdir` extension for a directory manifest or directory-fanout root.

## Directory Node

A directory node MUST have `t = 2`. Its `l` array contains its user-visible entries.

Every directory entry link MUST contain `h`, `n`, `s`, and `t`. It MAY contain `k` and `m`.

Allowed link types are:

| Value | Entry target |
| --- | --- |
| `0` | Raw Blossom blob |
| `1` | Chunked file manifest |
| `2` | Directory manifest |
| `3` | Directory-fanout root |

The `s` field is the plaintext file size for a file or blob. For a directory entry it is the total plaintext size of descendant files. If that total is unknown, `s` MUST be `0`.

A reader MUST reject a directory node containing a missing required field, an unknown link type, or a field with the wrong type or length.

## Entry Names

An entry name:

1. MUST be valid UTF-8.
2. MUST NOT be empty.
3. MUST NOT contain `/` or U+0000.
4. MUST NOT equal `.` or `..`.
5. MUST be unique within its directory node.

Names are compared as exact UTF-8 byte sequences. Implementations MUST NOT apply Unicode normalization or locale-sensitive comparison as part of manifest encoding or path lookup.

Entries MUST be sorted by ascending bytewise order of the UTF-8 encoding of `n`. A reader MUST reject an unsorted directory or duplicate names.

## Canonical Construction

A directory containing no more than `174` entries SHOULD be represented by one directory node. A larger directory MUST use the canonical [Directory Fanout](./directory-fanout.md) construction when a stable root hash across implementations is required.

The limit determines canonical construction, not basic decoding. A reader MAY accept a valid directory node with more than `174` entries, subject to its resource limits.

## Path Resolution

To resolve one path segment from a directory node, a client MUST:

1. Validate the directory node and its sorted, unique names.
2. Find the entry whose `n` exactly equals the decoded path segment.
3. Fetch the linked object using `h`.
4. Verify the fetched bytes against `h` before use.
5. Decrypt the object locally when `k` is present.
6. Verify a type `0` target's plaintext length or a type `1` target's represented size against `s`. For type `2` and `3` targets, verify the descendant total when `s` is nonzero; `s = 0` means that a directory total is unknown.
7. Interpret the object according to the link type.

Link types `2` and `3` can consume another path segment. Link types `0` and `1` identify files and MUST be the final resolved object unless another specification defines traversal within that file.

A missing name results in a not-found error. An unsupported link type results in an unsupported-type error. Clients MUST NOT guess another interpretation.

## Path Encoding

Higher-level URI and HTTP representations MUST split a path on literal `/` characters before percent-decoding individual segments. They MUST NOT percent-decode an entire path and then split it, because an encoded slash belongs to one logical segment and is invalid as a directory entry name after decoding.

Each decoded segment MUST satisfy the entry-name rules before lookup.

## Blossom URI Example

```text
blossom:16121fa792b3afc72ec8bfc1dc85060518b6adba1429973ecc12891165cbe67e.bdir?xs=cdn.example.com
```

## Security Considerations

An unencrypted directory reveals names, sizes, metadata, child hashes, and any embedded decryption keys. Clients that need to hide this information SHOULD encrypt the encoded directory manifest using [Content Hash Key Encryption](./content-hash-key-encryption.md).

Before displaying or materializing a directory, clients MUST validate every name and reject duplicates. Filesystem writers MUST additionally enforce platform-specific path and reserved-name rules and MUST ensure the destination remains beneath the intended output directory.

Visually confusable and differently normalized Unicode names can coexist because names are bytewise values. User interfaces SHOULD make ambiguous names visible when this could create a security risk.

Clients SHOULD limit manifest size, link count, metadata size, recursion depth, and total bytes fetched. They SHOULD detect repeated manifest hashes during one traversal to avoid cycles and redundant work.

## Test Vectors

### Empty Directory

```text
manifest_msgpack: 82a16c90a17402
manifest_hash: 0218ed9a4fbb0993757f17e5d08d089cb0c6ac851928ba1ba82d337d76c41c0c
```

Decoded form:

```json
{
  "l": [],
  "t": 2
}
```

### Single File Entry

```text
manifest_msgpack: 82a16c9184a168c420ababababababababababababababababababababababababababababababababa16ea8746573742e747874a17364a17400a17402
manifest_hash: 16121fa792b3afc72ec8bfc1dc85060518b6adba1429973ecc12891165cbe67e
```

Decoded form:

```json
{
  "l": [
    {
      "h": "abababababababababababababababababababababababababababababababab",
      "n": "test.txt",
      "s": 100,
      "t": 0
    }
  ],
  "t": 2
}
```

## References

### Normative References

- [Hashtree Manifest Format](./hashtree-manifest-format.md)
- [Chunked File Manifests](./chunked-file-manifests.md)
- [Directory Fanout](./directory-fanout.md)

### Informative References

- [Blossom URI Scheme](../../buds/10.md)
- [Hashtree reference implementation](https://git.iris.to/#/npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/hashtree)
