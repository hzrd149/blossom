# Hashtree Specifications

## Status of This Document

These documents define an experimental, client-side protocol for representing files and directories as content-addressed trees stored on Blossom servers. They are not Blossom Upgrade Documents (BUDs) and are not part of the official Blossom specification.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and **OPTIONAL** in these documents are to be interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14) when, and only when, they appear in all capitals.

## Specifications

The documents are ordered by dependency:

1. [Content Hash Key Encryption](./content-hash-key-encryption.md) defines deterministic encryption for content-addressed blobs.
2. [Hashtree Manifest Format](./hashtree-manifest-format.md) defines the canonical MessagePack node and link encoding shared by all manifests.
3. [Directory Manifests](./directory-manifests.md) defines named directory entries and path traversal.
4. [Chunked File Manifests](./chunked-file-manifests.md) defines fixed-size file chunking and recursive file nodes.
5. [Directory Fanout](./directory-fanout.md) defines scalable, typed index nodes for large directories.
6. [Hashtree References](./hashtree-references.md) defines mutable and immutable references to objects and paths in a Hashtree.

## Protocol Model

Blossom servers store every encrypted blob, chunk, and manifest as an ordinary blob addressed by the SHA-256 hash of its stored bytes. Hashtree clients construct, encrypt, fetch, validate, decode, and traverse the tree. No Hashtree-specific server behavior is required.

```text
htree reference
      |
      v
root manifest (file, directory, or directory fanout)
      |
      +-- manifest links
      |      +-- raw Blossom blobs
      |      +-- encrypted Blossom blobs
      |      +-- child manifests
      |
      +-- path traversal and file assembly
```

## Source Material

This specification set consolidates and revises the following reviewed proposals:

| Proposal | Imported revision | Content |
| --- | --- | --- |
| [PR #104](https://github.com/hzrd149/blossom/pull/104) | `ef6c7fb4435530556fb32345eec010505bda017a` | Content Hash Key encryption |
| [PR #105](https://github.com/hzrd149/blossom/pull/105) | `1b2f140b0d3fd06a907b159d7628e1d007588da3` | MessagePack directory manifests |
| [PR #106](https://github.com/hzrd149/blossom/pull/106) | `1848f77c4a25b70d10a3963d66ba1c8aba1e4f2c` | Chunked files and directory fanout |
| [PR #107](https://github.com/hzrd149/blossom/pull/107) | `018f3e32227cf8fd1fba8dff2d39d6e3370d2d52` | Hashtree references |

The old draft compatibility forms from those proposals are intentionally excluded. This specification set defines only typed directory fanout nodes, Nostr kind `30064` mutable roots, and TLV-encoded `nhash` identifiers.

## Identifier Status

The `htree` URI scheme, `nhash` human-readable prefix, media types, and Nostr kind `30064` are experimental assignments. Implementations MUST NOT assume that they are registered by IANA or the Nostr protocol registry.
