# Content Hash Key Encryption

## Abstract

This document defines `chk-v1`, a deterministic client-side encryption format for content-addressed blobs. Equal plaintext produces equal ciphertext and therefore the same Blossom blob hash. This preserves content deduplication and caching while allowing storage providers to handle opaque ciphertext.

## Status of This Document

This is an experimental Hashtree specification. It is not part of the official Blossom specification.

Normative key words are interpreted as described in [BCP 14](https://www.rfc-editor.org/info/bcp14).

## Terminology

- **plaintext**: Bytes before encryption.
- **ciphertext**: Bytes stored as the Blossom blob, including the AES-GCM authentication tag.
- **blob hash**: `SHA-256(ciphertext)`.
- **CHK key**: `SHA-256(plaintext)`.
- **AES key**: The key derived from the CHK key for AES-256-GCM.

All string constants in cryptographic operations are UTF-8 encoded without a terminating NUL byte. Concatenation is denoted by `||`.

## Encryption Profile

To encrypt plaintext using `chk-v1`, a writer MUST:

1. Compute `chk_key = SHA-256(plaintext)`.
2. Compute `prk = HKDF-Extract-SHA-256(salt = UTF8("hashtree-chk"), ikm = chk_key)`.
3. Compute `aes_key = HKDF-Expand-SHA-256(prk, info = UTF8("encryption-key"), length = 32)`.
4. Encrypt the plaintext with AES-256-GCM using `aes_key`, a 12-byte all-zero nonce, and empty additional authenticated data.
5. Store `ciphertext = encrypted_bytes || authentication_tag`, where the authentication tag is 16 bytes.
6. Compute `blob_hash = SHA-256(ciphertext)` and store the ciphertext under that Blossom hash.

Writers MUST derive the CHK key from the complete plaintext being encrypted. They MUST NOT substitute an arbitrary key or reuse a key to encrypt different plaintext with the zero nonce.

AES-256-GCM is used because it is widely available in browser WebCrypto and native cryptographic libraries.

### Nonce Safety

AES-GCM requires every `(key, nonce)` pair to be unique across distinct messages. The nonce is fixed in this profile, so safety depends on the AES key being derived from the plaintext. Distinct plaintexts produce distinct CHK keys, except with negligible SHA-256 collision probability, and therefore produce distinct AES keys.

Reusing an AES key with the zero nonce for different plaintexts leaks the XOR of those plaintexts and the GHASH authentication subkey. This breaks confidentiality and permits forgery.

## Decryption and Validation

To decrypt a `chk-v1` blob, a reader MUST:

1. Verify that `SHA-256(ciphertext)` equals the expected blob hash.
2. Derive the AES key from the supplied CHK key using the encryption profile.
3. Decrypt and authenticate the ciphertext with AES-256-GCM using the zero nonce and empty additional authenticated data.
4. Verify that `SHA-256(plaintext)` equals the supplied CHK key.

The reader MUST reject the blob if any step fails. Both SHA-256 checks are security-critical and MUST NOT be omitted as an optimization.

## Chunked Content

Each independently stored chunk MUST be encrypted independently. Its CHK key MUST be `SHA-256(chunk_plaintext)`. A writer MUST NOT reuse a file-level key for multiple chunks.

The [Chunked File Manifest](./chunked-file-manifests.md) format carries each chunk's blob hash and optional CHK key.

## Blossom URI Parameters

A URI conforming to the [Blossom URI Scheme](../../buds/10.md) MAY identify a `chk-v1` blob with these query parameters:

| Parameter | Value |
| --- | --- |
| `enc` | The literal value `chk-v1` |
| `k` | The 32-byte CHK key encoded as 64 lowercase hexadecimal characters |

A URI MUST contain no more than one `enc` parameter and no more than one `k` parameter. A client MUST reject duplicate parameters. If `k` is present, `enc=chk-v1` MUST also be present. If `enc=chk-v1` is present, a client requires the CHK key from the URI or another trusted source before it can decrypt the blob.

Clients MUST NOT send `k` to a Blossom server as part of a blob retrieval or management request. An application that resolves a `blossom:` URI SHOULD remove secret parameters before constructing an HTTP request.

Example for plaintext `hello`:

```text
blossom:70b977414934faa6270f323f117d05dbcc412e9d7ba2354b4d0f88f60aad2461.txt?enc=chk-v1&k=2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

The extension SHOULD describe the plaintext rather than the ciphertext.

## Security Considerations

`chk-v1` reveals plaintext equality to an observer that can compare ciphertext or blob hashes. It is also vulnerable to confirmation attacks when plaintext can be guessed. It MUST NOT be used by itself for low-entropy secrets or when equality leakage is unacceptable.

The CHK key is a bearer secret. Applications SHOULD avoid placing secret-bearing URIs in logs, browser history, analytics, referrer headers, or other unintended disclosure channels.

The safety argument assumes the collision resistance of SHA-256, the security of HKDF-SHA-256, and correct AES-256-GCM implementations.

## Test Vectors

All byte strings below are lowercase hexadecimal. The `ciphertext` includes the 16-byte authentication tag.

### Empty Plaintext

```text
plaintext:
chk_key: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
ciphertext: 7cd161ae8406d82cdf553c1100d012db
blob_hash: 346c46e7cc6722c99efe7f7bc316d8f3ff5f025f1031bf94418ef4db891e04cd
```

### `hello`

```text
plaintext: 68656c6c6f
chk_key: 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
ciphertext: c65308d9c8649ff1c59820d0b3a030db34ad00f92d
blob_hash: 70b977414934faa6270f323f117d05dbcc412e9d7ba2354b4d0f88f60aad2461
```

## References

### Normative References

- [RFC 5869: HMAC-based Extract-and-Expand Key Derivation Function](https://www.rfc-editor.org/rfc/rfc5869)
- [NIST SP 800-38D: Galois/Counter Mode](https://doi.org/10.6028/NIST.SP.800-38D)
- [FIPS 180-4: Secure Hash Standard](https://doi.org/10.6028/NIST.FIPS.180-4)

### Informative References

- [Blossom URI Scheme](../../buds/10.md)
- [Hashtree reference implementation](https://git.iris.to/#/npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/hashtree)
