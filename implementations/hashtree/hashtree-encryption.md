# Hashtree Encryption

## Abstract

This document defines the optional client-side encryption layer for Hashtree objects. A Hashtree is unencrypted by default. When privacy is required, any stored object can be encrypted with a registered suite, and a single versioned key format selects the suite and carries its key for every reader. Two initial suites are defined: `chk-v1`, which derives its key from the plaintext to preserve deduplication, and `rnd-v1`, which uses a random key and a random nonce for stronger privacy.

## Status of This Document

This is an experimental Hashtree specification. It is not part of the official Blossom specification.

Normative key words are interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14).

## Terminology

- **plaintext**: Bytes before encryption.
- **stored bytes**: The bytes stored as the Blossom blob.
- **blob hash**: `SHA-256(stored_bytes)`.
- **versioned key**: The 33-byte value `suite_byte || key` that identifies a suite and carries its key.
- **suite**: A named encryption profile with a registered suite byte.

All string constants in cryptographic operations are UTF-8 encoded without a terminating NUL byte. Concatenation is denoted by `||`.

## Layer Model

Encryption applies per stored object. Any blob, chunk, or manifest can be encrypted, and each encrypted object is encrypted independently. Encrypting an object changes its stored bytes and therefore its Blossom hash.

Keys are never stored as separate Blossom blobs. A versioned key travels inline in one of these places:

- The `k` field of the link that references the encrypted object, as defined by the [Hashtree Manifest Format](./hashtree-manifest-format.md).
- The root key mechanisms of [Hashtree References](./hashtree-references.md): an `htree` URI query parameter, an `nhash` record, or a Nostr root event tag.
- An application-defined channel.

A reader learns both the key and the suite from the same versioned key, so no separate algorithm negotiation exists or is needed.

This layer does not define parameters for `blossom:` URIs. How a versioned key accompanies a bare Blossom URI is an application concern. An application that pairs a versioned key with a Blossom URI SHOULD use a file extension that describes the plaintext.

## Versioned Keys

A versioned key is 33 bytes:

```text
suite_byte: 1 byte
key:        32 bytes
```

The registry of suite bytes is:

| Suite byte | Suite | Key source | Nonce |
| --- | --- | --- | --- |
| `01` | `chk-v1` | `SHA-256(plaintext)` | 12-byte zero nonce |
| `02` | `rnd-v1` | CSPRNG | 12-byte CSPRNG nonce per encryption |

When encoded as a string, a versioned key is 66 lowercase hexadecimal characters. The first two characters identify the suite.

A reader MUST reject a versioned key with an unknown suite byte or a wrong length. It MUST NOT attempt to decrypt with a guessed suite.

A new suite requires a specification defining the key source, nonce rules, stored-byte layout, decryption steps, security considerations, and at least one byte-level test vector, using a previously unassigned suite byte.

A versioned key is a bearer secret. A client MUST NOT send it to a Blossom server.

## Suite `chk-v1`

`chk-v1` is deterministic: equal plaintext produces equal stored bytes and the same blob hash. This preserves deduplication, caching, and quota accounting for encrypted objects.

### Encryption

To encrypt plaintext using `chk-v1`, a writer MUST:

1. Compute `chk_key = SHA-256(plaintext)`.
2. Compute `prk = HKDF-Extract-SHA-256(salt = UTF8("hashtree-chk"), ikm = chk_key)`.
3. Compute `aes_key = HKDF-Expand-SHA-256(prk, info = UTF8("encryption-key"), length = 32)`.
4. Encrypt the plaintext with AES-256-GCM using `aes_key`, a 12-byte all-zero nonce, and empty additional authenticated data.
5. Store `stored_bytes = encrypted_bytes || authentication_tag`, where the authentication tag is 16 bytes.
6. Compute `blob_hash = SHA-256(stored_bytes)` and store the object under that hash.

Writers MUST derive the CHK key from the complete plaintext being encrypted. They MUST NOT substitute an arbitrary key or reuse a key to encrypt different plaintext with the zero nonce.

AES-256-GCM is used because it is widely available in browser WebCrypto and native cryptographic libraries.

### Nonce Safety

AES-GCM requires every `(key, nonce)` pair to be unique across distinct messages. The nonce is fixed in this suite, so safety depends on the AES key being derived from the plaintext. Distinct plaintexts produce distinct CHK keys, except with negligible SHA-256 collision probability, and therefore produce distinct AES keys.

Reusing an AES key with the zero nonce for different plaintexts leaks the XOR of those plaintexts and the GHASH authentication subkey. This breaks confidentiality and permits forgery.

### Decryption and Validation

To decrypt a `chk-v1` object, a reader MUST:

1. Verify that `SHA-256(stored_bytes)` equals the expected blob hash.
2. Derive the AES key from the CHK key carried by the versioned key.
3. Decrypt and authenticate the stored bytes with AES-256-GCM using the zero nonce and empty additional authenticated data.
4. Verify that `SHA-256(plaintext)` equals the CHK key.

The reader MUST reject the object if any step fails. Both SHA-256 checks are security-critical and MUST NOT be omitted as an optimization.

### Chunked Content

Each independently stored chunk MUST be encrypted independently with its own CHK key, `SHA-256(chunk_plaintext)`. A writer MUST NOT reuse a file-level key for multiple chunks with the zero nonce. The [Chunked File Manifests](./chunked-file-manifests.md) format carries each chunk's blob hash and versioned key.

## Suite `rnd-v1`

`rnd-v1` uses a random key and a random nonce. The same plaintext encrypts to different stored bytes every time, so deduplication and equality leakage disappear.

### Encryption

To encrypt plaintext using `rnd-v1`, a writer MUST:

1. Generate `key` as 32 bytes from a CSPRNG.
2. Generate `nonce` as 12 bytes from a CSPRNG, freshly generated for every encryption.
3. Encrypt the plaintext with AES-256-GCM using `key`, `nonce`, and empty additional authenticated data.
4. Store `stored_bytes = nonce || encrypted_bytes || authentication_tag`, where the authentication tag is 16 bytes.
5. Compute `blob_hash = SHA-256(stored_bytes)` and store the object under that hash.

Writers MUST NOT use a fixed, deterministic, or reused nonce in `rnd-v1`. Random 96-bit nonces keep the collision probability negligible for at most `2^32` encryptions under one key; a writer that would exceed that bound MUST generate a new key.

The same key MAY encrypt multiple objects, such as every chunk of one file. Writers MAY also generate a new key per object.

### Decryption

To decrypt an `rnd-v1` object, a reader MUST:

1. Verify that `SHA-256(stored_bytes)` equals the expected blob hash.
2. Reject stored bytes shorter than 28 bytes, the minimum of a 12-byte nonce and a 16-byte tag.
3. Parse the nonce, ciphertext, and authentication tag from the stored bytes.
4. Decrypt and authenticate with AES-256-GCM using the key from the versioned key and the parsed nonce.

The reader MUST reject the object if any step fails. `rnd-v1` has no plaintext hash check because the key is not derived from the plaintext. The blob hash commits to the stored bytes, and the GCM tag authenticates them under the key.

## Choosing a Suite

| Property | Unencrypted | `chk-v1` | `rnd-v1` |
| --- | --- | --- | --- |
| Content readable by server | yes | no | no |
| Deduplication, caching, quota accounting | yes | yes | no |
| Equal plaintext, equal blob hash | yes | yes | no |
| Confirmation attacks on guessable content | trivial | possible | resistant |

The default is no encryption, which keeps construction, debugging, and interoperability simple. `chk-v1` suits content where deduplication matters and equality leakage is acceptable. `rnd-v1` suits content where privacy matters more than deduplication.

## Security Considerations

Versioned keys, `htree` URIs carrying `k`, and `nhash` values carrying a key are bearer secrets. Applications SHOULD prevent their disclosure through logs, browser history, analytics, referrer headers, clipboard monitoring, and shared screenshots.

`chk-v1` reveals plaintext equality to anyone who can observe blob hashes or stored bytes. It is vulnerable to confirmation attacks when plaintext can be guessed. It MUST NOT be used by itself for low-entropy secrets or when equality leakage is unacceptable.

`rnd-v1` removes equality leakage at the cost of deduplication. Its safety depends on CSPRNG quality and on respecting the per-key encryption bound.

AES-GCM is not key-committing: crafted ciphertext can decrypt cleanly under more than one key. In `chk-v1`, the plaintext hash check supplies the missing commitment. In `rnd-v1`, the enclosing reference, such as a parent manifest hash chain or a signed root event, determines which key applies, so an attacker cannot substitute an alternative key without breaking that chain.

All randomness MUST come from a CSPRNG.

## Test Vectors

All byte strings below are lowercase hexadecimal.

### Versioned Key Encodings

The `chk-v1` versioned key for plaintext `hello`, whose CHK key is `SHA-256("hello")`:

```text
versioned_key: 012cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

An example `rnd-v1` versioned key with the test key used below:

```text
versioned_key: 0202020202020202020202020202020202020202020202020202020202020202
```

### `chk-v1` Empty Plaintext

```text
plaintext:
chk_key: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
stored_bytes: 7cd161ae8406d82cdf553c1100d012db
blob_hash: 346c46e7cc6722c99efe7f7bc316d8f3ff5f025f1031bf94418ef4db891e04cd
```

### `chk-v1` `hello`

```text
plaintext: 68656c6c6f
chk_key: 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
stored_bytes: c65308d9c8649ff1c59820d0b3a030db34ad00f92d
blob_hash: 70b977414934faa6270f323f117d05dbcc412e9d7ba2354b4d0f88f60aad2461
```

### `rnd-v1` `hello`

This vector uses a fixed test key and nonce for reproducibility. Real writers MUST generate both from a CSPRNG.

```text
plaintext: 68656c6c6f
key: 0202020202020202020202020202020202020202020202020202020202020202
nonce: 000102030405060708090a0b
stored_bytes: 000102030405060708090a0b216d8e96be582844fc3a4e2a23eecfbe1a29cd5b6b
blob_hash: 819b3a52aa2550b762399299892a6b613b7071c57d95787a1915310afd50fc7b
```

## References

### Normative References

- [RFC 5869: HMAC-based Extract-and-Expand Key Derivation Function](https://www.rfc-editor.org/rfc/rfc5869)
- [NIST SP 800-38D: Galois/Counter Mode](https://doi.org/10.6028/NIST.SP.800-38D)
- [FIPS 180-4: Secure Hash Standard](https://doi.org/10.6028/NIST.FIPS.180-4)
- [Hashtree Manifest Format](./hashtree-manifest-format.md)

### Informative References

- [Chunked File Manifests](./chunked-file-manifests.md)
- [Hashtree References](./hashtree-references.md)
- [Hashtree reference implementation](https://git.iris.to/#/npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/hashtree)
