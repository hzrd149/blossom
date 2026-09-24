# Hashtree Manifest Format

## Abstract

This document defines the deterministic MessagePack encoding shared by Hashtree file, directory, and directory-fanout manifests. Canonical encoding gives each manifest one plaintext representation. When a manifest is stored without encryption, the SHA-256 hash of that representation is its Blossom address.

## Status of This Document

This is an experimental Hashtree specification. It is not part of the official Blossom specification.

Normative key words are interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14).

## Encoding Choice

Hashtree uses MessagePack because it is compact, represents byte arrays directly, and has mature implementations in common Hashtree target languages. Local benchmarks found it to be a practical choice for this data shape. Exact performance depends on the implementation and is not a protocol requirement.

MessagePack does not define a single canonical encoding for every value. This document therefore defines the field order, collection order, scalar encoding, and validation rules required to produce reproducible manifest hashes.

## Data Model

A manifest is a MessagePack map with exactly two fields:

| Key | Type | Meaning |
| --- | --- | --- |
| `l` | array | Ordered array of links |
| `t` | unsigned integer | Node type |

The fields MUST be encoded in the order `l`, `t`.

### Node Types

| Value | Node type | Defined by |
| --- | --- | --- |
| `1` | File manifest | [Chunked File Manifests](./chunked-file-manifests.md) |
| `2` | Directory manifest | [Directory Manifests](./directory-manifests.md) |
| `3` | Directory fanout | [Directory Fanout](./directory-fanout.md) |

Node type `0` is not valid for a manifest. It identifies a raw Blossom blob only when used as a link type.

A reader MUST reject an unknown node type. It MUST NOT reinterpret an unknown type as a known manifest or raw blob.

## Link Encoding

Each member of `l` is a MessagePack map. The complete link field vocabulary is:

| Key | Type | Required | Meaning |
| --- | --- | --- | --- |
| `h` | binary | yes | 32-byte SHA-256 hash of the stored linked object |
| `k` | binary | no | 33-byte versioned decryption key |
| `m` | map | no | Canonically encoded metadata |
| `n` | string | context-dependent | User-visible directory entry name |
| `s` | unsigned integer | yes | Plaintext bytes represented by this link |
| `t` | unsigned integer | yes | Type of the linked object |

Link fields MUST be encoded in the order `h`, `k`, `m`, `n`, `s`, `t`, with absent optional fields omitted. A link MUST NOT contain any other top-level field.

The requirements for `n`, allowed link types, link order, and metadata content depend on the containing node type and are defined by that node's specification.

The link type MUST equal the node type of the manifest identified by `h`. Link type `0` is the exception: it identifies a raw Blossom blob with no node type.

The `s` value MUST be between `0` and `2^64 - 1`, inclusive. Specifications that require a positive value state that requirement separately. Implementations MUST detect overflow when adding descendant sizes.

When `k` is present, it is the 33-byte versioned key defined by [Hashtree Encryption](./hashtree-encryption.md). Its suite byte identifies how the linked bytes are encrypted. A versioned key is a bearer secret used only by the client, and a client MUST NOT send it to a Blossom server.

## Canonical MessagePack Profile

Writers MUST apply all of these rules:

1. Encode maps using the field and key orders required by this specification set.
2. Use the shortest MessagePack map, array, string, and binary header capable of representing the value's length.
3. Encode non-negative integers using the shortest unsigned representation, including positive fixint where applicable.
4. Encode negative integers using the shortest signed representation, including negative fixint where applicable.
5. Encode binary values with MessagePack binary types, never string types.
6. Encode strings as valid UTF-8 using MessagePack string types.
7. Encode metadata according to the recursive rules below.

Readers MUST reject malformed MessagePack, duplicate map keys, trailing bytes after the root object, fields of the wrong structural type or fixed byte length, and values outside the semantic ranges defined by the applicable specification.

### Canonical Metadata

Metadata is optional and does not alter the interpretation of fields outside `m`. Unknown metadata keys MUST be ignored after the metadata value has been validated.

Metadata values are limited to the JSON data model: null, boolean, number, string, array, and map. Binary values and MessagePack extension values MUST NOT appear in metadata.

Writers MUST encode metadata recursively as follows:

1. Every map key MUST be a valid UTF-8 string.
2. Map entries MUST be sorted by ascending bytewise order of each key's UTF-8 encoding.
3. Array order MUST be preserved.
4. Integral numbers MUST be in the MessagePack signed or unsigned 64-bit range and use the shortest integer representation.
5. Non-integral numbers MUST be finite IEEE 754 binary64 values and use MessagePack float64. NaN and infinities are invalid.
6. Negative zero MUST be encoded as integer zero.
7. Strings, arrays, and maps MUST use the shortest applicable length header.

A reader MUST recursively validate metadata and reject non-string map keys, invalid UTF-8, binary values, MessagePack extension values, non-finite numbers, and any other value outside the metadata data model. These requirements apply even when the reader does not recognize a metadata key.

A reader MUST accept otherwise valid metadata without requiring its wire encoding to be canonical. In particular, a reader MUST NOT reject metadata solely because map entries are unsorted, an integer uses a noncanonical signedness or width, a collection or string uses a wider length header than necessary, a finite number uses float32, an integral value is encoded as a float, or negative zero is encoded as a float. These representations are noncanonical and MUST NOT be emitted by a conforming writer.

Canonical and noncanonical encodings remain different content-addressed objects. A reader MUST verify the hash of the original stored bytes and MUST NOT decode and re-encode a manifest before hash verification. Re-encoding an accepted noncanonical manifest with a conforming writer can change that manifest's bytes, its hash, and every ancestor hash that refers to it.

For example, the following are valid encodings of equivalent metadata values. A conforming writer emits only the canonical form, while a reader accepts both:

```text
value:        {"a": 1, "b": 2}
canonical:    82a16101a16202
noncanonical: de0002a162cc02a161cc01
```

The noncanonical form uses a `map16` header instead of `fixmap`, reverses the key order, and encodes the values as `uint8` instead of positive fixint.

## Storage and Retrieval

The canonical MessagePack bytes are the manifest plaintext:

```text
manifest_plaintext = canonical_manifest_msgpack
```

For an unencrypted manifest, the stored bytes equal the manifest plaintext and its Blossom address is `SHA-256(manifest_plaintext)`. For an encrypted manifest, the stored bytes are produced by a [Hashtree Encryption](./hashtree-encryption.md) suite, and its Blossom address is `SHA-256(stored_bytes)`.

The `h` field always identifies the bytes stored by Blossom, whether those bytes are plaintext or ciphertext. A client fetching a manifest MUST verify the stored bytes against `h` before decrypting or decoding them.

## Extension Rules

Future specifications can assign additional node and link types. A new type MUST define:

- The semantic meaning of the node and its links.
- Which link fields are required or forbidden.
- Allowed child link types.
- Canonical link ordering.
- Validation and resource limits.
- At least one interoperable byte-level test vector.

Existing readers MUST fail with an unsupported-type error when they encounter an unimplemented type.

## Security Considerations

Clients SHOULD impose limits on encoded size, decoded collection sizes, metadata depth, metadata size, link count, recursion depth, and total fetched bytes before allocating or recursively resolving data.

Hashes authenticate stored bytes, not the trustworthiness of their contents. A valid manifest can still contain malicious names, excessive sizes, cyclic references, or links intended to exhaust resources. Each higher-level node specification adds structural validation requirements.

## References

### Normative References

- [MessagePack Specification](https://github.com/msgpack/msgpack/blob/master/spec.md)
- [FIPS 180-4: Secure Hash Standard](https://doi.org/10.6028/NIST.FIPS.180-4)
- [Hashtree Encryption](./hashtree-encryption.md)

### Informative References

- [Hashtree reference implementation](https://git.iris.to/#/npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/hashtree)
