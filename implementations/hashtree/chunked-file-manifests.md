# Chunked File Manifests

## Abstract

This document defines deterministic manifests for files stored as ordered Blossom chunks. Recursive file nodes permit files of arbitrary size while bounding the number of links in each manifest.

## Status of This Document

This is an experimental Hashtree specification. It is not part of the official Blossom specification.

Normative key words are interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14).

## Terminology

- **leaf chunk**: A raw Blossom blob containing consecutive plaintext file bytes.
- **file node**: A manifest with node type `1`.
- **file root**: The top-level file node representing the complete file.
- **represented size**: The number of plaintext file bytes reachable through a link or node.

This document uses the encoding defined by the [Hashtree Manifest Format](./hashtree-manifest-format.md).

## Constants

Canonical file construction uses:

| Name | Value | Meaning |
| --- | --- | --- |
| `chunk_size` | `2097152` | Maximum plaintext bytes in one leaf chunk |
| `max_links` | `174` | Maximum links in one canonically constructed file node |

Changing either value changes the chunk boundaries, manifest bytes, and root hash.

## File Nodes

A file node MUST have `t = 1`. Every link MUST contain `h`, `s`, and `t`, MAY contain `k` and `m`, and MUST NOT contain `n`.

Only these link types are valid:

| Value | Target |
| --- | --- |
| `0` | Leaf chunk |
| `1` | Child file node |

Links are ordered by ascending plaintext byte offset. Their order is semantically significant and MUST NOT be sorted by hash or metadata.

The `s` value of a leaf link MUST equal the number of plaintext bytes in that chunk. The `s` value of a child-node link MUST equal the sum of all descendant leaf sizes. The represented size of a file node is the sum of its direct link sizes.

A reader MUST reject named links, unknown link types, integer overflow, or a child whose represented size does not equal its parent link's `s` value.

## Canonical File Construction

To construct a canonical file representation, a writer MUST:

1. Split the plaintext into consecutive `chunk_size` byte chunks. Every chunk except the final chunk MUST contain exactly `chunk_size` bytes. The final chunk MUST contain between `1` and `chunk_size` bytes. An empty file is represented by one empty chunk.
2. Store each chunk as a raw blob or encrypt it independently using [Content Hash Key Encryption](./content-hash-key-encryption.md).
3. If the file is no larger than `chunk_size` and the surrounding protocol permits a raw blob, the stored chunk is the canonical direct representation and a file node is not required.
4. When a file node is required, create one type `0` link per chunk in file order. Set `h` to the stored blob hash, `s` to the plaintext chunk length, and `k` to the chunk CHK key when encrypted. An `htree` file root always requires this wrapper, including for a small or empty file.
5. If there are no more than `max_links`, encode those links as the file root.
6. Otherwise, partition the links from left to right into the minimum number of consecutive groups, each containing exactly `max_links` links except the final group.
7. Encode each group as a child file node and replace it with a type `1` link whose `s` is the represented size of that child.
8. Repeat steps 5 through 7 until one file root contains no more than `max_links` links.

Metadata MAY be attached to links, but metadata changes manifest bytes and hashes. Applications requiring identical roots MUST use identical metadata.

## Reading a File

To read a file node, a client MUST traverse links in manifest order. It MUST recursively traverse type `1` links and concatenate the plaintext of type `0` links.

For every fetched object, the client MUST:

1. Verify the stored bytes against the link hash.
2. Decrypt locally when `k` is present.
3. Verify the plaintext size against `s`.
4. For a child node, decode and validate node type `1` before traversal.

The complete plaintext file size is the represented size of the root.

A client can serve a byte range without assembling the complete file by using `s` values to skip links outside the requested range. It MUST still verify every object it fetches.

## Encrypted Manifests

Leaf chunks and child file nodes can each be encrypted independently. A parent link carries the key for its encrypted child. If the file root is encrypted, its key is carried by the reference that identifies the root.

Encrypting only chunks does not hide file size, chunk boundaries, child hashes, or manifest structure. Applications that need to hide that information SHOULD encrypt every manifest layer up to and including the root.

## Blossom URI Example

A URI conforming to the [Blossom URI Scheme](../../buds/10.md) SHOULD use the `.bfile` extension for a file-manifest root:

```text
blossom:559b726c38295aa0ecbbaef43d438cc86dd63324a0c3e9426dc5f1d0285f483f.bfile?xs=cdn.example.com
```

## Security Considerations

Clients SHOULD bound recursion depth, manifest count, direct and total link counts, represented size, and fetched bytes. Size sums MUST use checked arithmetic.

Clients SHOULD detect a manifest hash repeated in its active traversal path and reject the cycle. A content hash does not prevent a malicious graph from referencing an ancestor.

Readers MUST reject empty chunks except the sole chunk of an empty file, non-final short chunks in a canonical representation, and link-size mismatches. A reader that accepts noncanonical but structurally valid file nodes MUST NOT describe their root as the canonical root of the file.

## Test Vector

### Two-Chunk File Manifest

This file node has two leaf links:

- Chunk 0 hash: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
- Chunk 0 size: `100`
- Chunk 1 hash: `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`
- Chunk 1 size: `50`

```text
manifest_msgpack: 82a16c9283a168c420aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa17364a1740083a168c420bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbba17332a17400a17401
manifest_hash: 559b726c38295aa0ecbbaef43d438cc86dd63324a0c3e9426dc5f1d0285f483f
```

Decoded form:

```json
{
  "l": [
    {
      "h": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "s": 100,
      "t": 0
    },
    {
      "h": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "s": 50,
      "t": 0
    }
  ],
  "t": 1
}
```

## References

### Normative References

- [Hashtree Manifest Format](./hashtree-manifest-format.md)
- [Content Hash Key Encryption](./content-hash-key-encryption.md)

### Informative References

- [Blossom URI Scheme](../../buds/10.md)
- [Hashtree reference implementation](https://git.iris.to/#/npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/hashtree)
