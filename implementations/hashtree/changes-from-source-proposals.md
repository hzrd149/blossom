# Changes from the Source Proposals

How this specification set differs from the four proposals it consolidates ([#104](https://github.com/hzrd149/blossom/pull/104), [#105](https://github.com/hzrd149/blossom/pull/105), [#106](https://github.com/hzrd149/blossom/pull/106), [#107](https://github.com/hzrd149/blossom/pull/107)), at the revisions listed in the [README](./README.md). Those pull requests are still open, so this is written for their reviewers. Nothing here is normative.

## What Changed

**Encryption is now optional.** The proposals defined `chk-v1` as the encryption format. [Hashtree Encryption](./hashtree-encryption.md) makes encryption an optional layer with a suite registry: `01` `chk-v1` (algorithm unchanged) and `02` `rnd-v1` (random key and nonce, no equality leakage). A 33-byte versioned key, `suite_byte || key`, carries the suite with the key, so there is no negotiation.

**The MessagePack encoding got its own document.** [Hashtree Manifest Format](./hashtree-manifest-format.md) owns the node registry, the closed link vocabulary, and a canonical writer profile — including canonical construction rules for `m` metadata, which the proposals omitted. Without those rules, two writers can produce different hashes for the same logical manifest. Readers still accept semantically valid metadata encoded by older or noncanonical writers; its original stored bytes remain its content-addressed identity.

**Legacy read-paths removed.** `_chunk_<n>` name-based fanout, Nostr kind `30078` roots, and bare-32-byte `nhash` payloads. A name like `_chunk_0` now has no special meaning and is listed verbatim.

**Canonical construction is pinned.** "Group consecutive links" became an exact rule: minimum consecutive groups of exactly `max_links`, left to right. Edge cases are settled — an empty file is one empty chunk, an empty directory is an empty directory node (never a fanout node), and an `htree` file root always needs a file-node wrapper. `chunk_size` and `max_links` keep their values.

**Verification is uniform.** Verify stored bytes against `h` before decrypting or decoding, then verify plaintext size against `s`. Fanout also verifies a child's `count`, `first`, `last`, and `s` against the parent link; bounds are untrusted routing hints until then. Every document gained a reject-list and resource limits.

**References are stricter.** Exactly-one cardinality per required tag, signature checked before any tag is read, NIP-44 version 2 pinned, `keyId` verification raised to MUST, and the HTTP gateway mapping specified.

**Extension rules added** for new node types, link types, and suites — each must ship a byte-level test vector, and readers must fail unknown types rather than guess.

## Breaking Changes

| | Proposals | Current |
| --- | --- | --- |
| Link `k` width | 32 bytes | 33 bytes (`suite_byte \|\| key`) |
| `nhash` TLV type `5` length | 32 | 33 |
| `blossom:` URI `enc=` / `k=` | defined | removed |
| `_chunk_<n>` fanout | readable | not read |
| Nostr kind `30078` roots | readable | not read; `30064` only |
| Bare 32-byte `nhash` payload | decodable | payload is TLV |
| Tie-break on equal `created_at` | greatest event ID | lowest event ID |

**The manifest wire format did not change.** All four manifest test vectors carry over byte-identical (`0218ed9a…`, `16121fa7…`, `559b726c…`, `6626ab03…`), as do the `chk-v1` ciphertexts and blob hashes. Breakage is limited to key encoding, reference encoding, and the dropped legacy forms.

## Unchanged

The `chk-v1` key derivation (writing it as HKDF-Extract then HKDF-Expand is precision, not a new construction), `chunk_size` and `max_links` values, entry-name rules, node and link type numbers, and field ordering.
