# Blossom nostr integration

Blossom uses nostr for public / private key identities. Users are expected to sign authentication events to prove their identity when uploading or deleting blobs

See [Authorization events](./Server.md#authorization-events)

## User Server Discovery

Users should publish a kind `10063` event with a list of ordered `server` tags indicating servers that others users should use when getting their blobs

### Example

```json
{
  "id": "e4bee088334cb5d38cff1616e964369c37b6081be997962ab289d6c671975d71",
  "pubkey": "781208004e09102d7da3b7345e64fd193cd1bc3fce8fdae6008d77f9cabcd036",
  "content": "",
  "kind": 10063,
  "created_at": 1708774162,
  "tags": [
    ["server", "https://cdn.self.hosted"],
    ["server", "https://cdn.satellite.earth"]
  ],
  "sig": "cc5efa74f59e80622c77cacf4dd62076bcb7581b45e9acff471e7963a1f4d8b3406adab5ee1ac9673487480e57d20e523428e60ffcc7e7a904ac882cfccfc653"
}
```
