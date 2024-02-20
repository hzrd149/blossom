# Blossom nostr integration

Blossom uses nostr for public / private key identities. Users are expected to sign "Client Authentication" events to prove their identity when uploading or deleting blobs

## User Server Discovery

Users can publish a kind `10063` event with a list of `r` tags indicating where other users should look to find their published blobs

### Example

```json
{
  "kind": 10063,
  "content": "",
  "tags": [
    ["r", "https://cdn.self.hosted"],
    ["r", "https://cdn.satellite.earth"]
  ],
  "created_at": 1708454797,
  "id": "...",
  "sig": "..."
}
```
