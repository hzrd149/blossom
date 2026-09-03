# Directory Fanout

## Abstract

This document defines typed fanout nodes for directories that exceed the canonical link count of a single directory manifest. Fanout nodes form an ordered index over user-visible directory entries without introducing synthetic entry names.

## Status of This Document

This is an experimental Hashtree specification. It is not part of the official Blossom specification.

Normative key words are interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14).

## Terminology

- **fanout node**: A manifest with node type `3`.
- **terminal directory**: A type `2` directory manifest containing user-visible entries.
- **flattened entries**: User-visible entries obtained by recursively traversing a fanout root.
- **bounds**: The first and last user-visible names represented by one fanout link.

This document uses the [Hashtree Manifest Format](./hashtree-manifest-format.md) and the name ordering from [Directory Manifests](./directory-manifests.md).

## Constants

Canonical directory construction uses `max_links = 174` for both directory and fanout nodes.

## Fanout Nodes

A fanout node MUST have `t = 3`. Its links are internal index links and MUST NOT be exposed as user-visible directory entries.

Every fanout link MUST contain `h`, `m`, `s`, and `t`, MAY contain `k`, and MUST NOT contain `n`.

Only these link types are valid:

| Value | Target |
| --- | --- |
| `2` | Terminal directory node |
| `3` | Child fanout node |

The metadata map of every fanout link MUST contain:

| Key | Type | Meaning |
| --- | --- | --- |
| `count` | positive unsigned integer | Number of flattened user-visible entries in the child subtree |
| `first` | string | First entry name in that subtree |
| `last` | string | Last entry name in that subtree |

`first` and `last` MUST satisfy the directory entry-name rules. They MUST equal the actual first and last names of the child subtree, and `first` MUST be less than or equal to `last` by UTF-8 bytewise order.

The `s` field is the sum of descendant file sizes. It MUST be `0` when that total is unknown. If any child total is unknown, an aggregate parent total MUST also be `0`.

## Ordering and Coverage

Fanout links MUST be ordered by ascending `first`. Their bounds MUST NOT overlap: each link's `first` MUST be greater than the preceding link's `last`.

The flattened entry sequence of each child MUST be internally sorted. Concatenating child sequences in link order MUST produce the same sequence as sorting all represented user-visible entries by name.

A reader that fetches a child MUST verify its hash, type, entry count, first name, last name, and represented size against the parent link. A mismatch invalidates the fanout tree.

## Canonical Construction

To construct a canonical directory representation, a writer MUST:

1. Sort all user-visible entries by ascending bytewise order of their UTF-8 names.
2. If there are no more than `max_links` entries, encode one terminal directory node and stop.
3. Otherwise, partition entries from left to right into the minimum number of consecutive groups, each containing exactly `max_links` entries except the final group.
4. Encode each group as a terminal directory node.
5. Create one type `2` fanout link per terminal node. Set `count`, `first`, `last`, and `s` from that child.
6. If there are no more than `max_links` fanout links, encode them as the fanout root and stop.
7. Otherwise, partition the fanout links using the same left-to-right grouping rule and encode each group as a child fanout node.
8. Replace each group with a type `3` fanout link whose `count`, bounds, and `s` summarize that child.
9. Repeat steps 6 through 8 until one fanout root contains no more than `max_links` links.

An empty directory MUST be represented as an empty terminal directory node, not an empty fanout node. Every fanout node and every fanout link MUST contain at least one descendant entry.

## Listing and Path Resolution

To list a fanout directory, a client MUST recursively flatten child links in manifest order and return only entries from terminal directory nodes.

To resolve a path segment, a client SHOULD select the one child whose inclusive `first` to `last` range can contain the requested name. If no range can contain the name, resolution returns not found. A client MAY scan children linearly, but it MUST perform all hash and subtree-summary validation for children it uses.

A type `2` directory node is always user-visible and MUST be listed verbatim. Names that resemble implementation internals, including `_chunk_0`, have no special meaning.

## Blossom URI Example

A fanout root represents a directory and SHOULD use the `.bdir` extension:

```text
blossom:<directory-fanout-root-hash>.bdir?xs=cdn.example.com
```

## Security Considerations

Clients SHOULD bound fanout depth, links per node, aggregate entry count, metadata size, and total fetched bytes. Counts and sizes MUST use checked arithmetic.

Bounds are untrusted routing hints until the child is fetched and validated. A client MUST NOT treat a successful range match as proof that the requested entry exists.

A reader MUST reject named fanout links, empty fanout nodes, invalid or overlapping bounds, zero counts, unsupported child types, summary mismatches, duplicate flattened names, and unsorted flattened output.

As with terminal directories, an unencrypted fanout reveals names, sizes, topology, hashes, metadata, and embedded child keys. Applications SHOULD encrypt manifest layers when this information is sensitive.

## Test Vector

### Two-Child Directory Fanout

This fanout node has two terminal directory links:

- Child 0 hash: `1111111111111111111111111111111111111111111111111111111111111111`
- Child 0 count: `2`
- Child 0 bounds: `a.txt` through `b.txt`
- Child 0 size: `30`
- Child 1 hash: `2222222222222222222222222222222222222222222222222222222222222222`
- Child 1 count: `1`
- Child 1 bounds: `c.txt` through `c.txt`
- Child 1 size: `40`

```text
manifest_msgpack: 82a16c9284a168c4201111111111111111111111111111111111111111111111111111111111111111a16d83a5636f756e7402a56669727374a5612e747874a46c617374a5622e747874a1731ea1740284a168c4202222222222222222222222222222222222222222222222222222222222222222a16d83a5636f756e7401a56669727374a5632e747874a46c617374a5632e747874a17328a17402a17403
manifest_hash: 6626ab03b5468f417d888fa25fa22b48f5bcb7dfafb88eef34c638d167afc0a3
```

Decoded form:

```json
{
  "l": [
    {
      "h": "1111111111111111111111111111111111111111111111111111111111111111",
      "m": {
        "count": 2,
        "first": "a.txt",
        "last": "b.txt"
      },
      "s": 30,
      "t": 2
    },
    {
      "h": "2222222222222222222222222222222222222222222222222222222222222222",
      "m": {
        "count": 1,
        "first": "c.txt",
        "last": "c.txt"
      },
      "s": 40,
      "t": 2
    }
  ],
  "t": 3
}
```

## References

### Normative References

- [Hashtree Manifest Format](./hashtree-manifest-format.md)
- [Directory Manifests](./directory-manifests.md)

### Informative References

- [Hashtree reference implementation](https://git.iris.to/#/npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/hashtree)
