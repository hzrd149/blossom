# Blossom nostr integration

Blossom uses nostr for public / private key identities. Users are expected to sign authentication events to prove their identity when uploading or deleting blobs

See [Authorization events](./Server.md#authorization-events)

## User Server Discovery

Users should publish a kind `10063` event with a list of ordered `r` tags indicating servers that others users should use when getting their blobs

### Example

```json
{
  "id": "90718dd2f481ad1d9dd72eab2b210d1b3d03231f114b0825bf967465748934f0",
  "pubkey": "7d917f22b84356a3c4e5ef7ec6d4464fb1dc3258cbf58c58d8bf079580c12c91",
  "content": "",
  "kind": 10063,
  "created_at": 1708774162,
  "tags": [
    ["r", "https://cdn.self.hosted"],
    ["r", "https://cdn.satellite.earth"]
  ],
  "sig": "805a0c00cdad7ae25de70740751b8e5985bec24bb6aead8c65e0cc33d6205dd5a06689b566e62589885ad86bfb55c5c7dfb5a9ce6ddb29cf04507fa76e485040"
}
```
