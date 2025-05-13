# BUD-09

## Blob Report

`draft` `optional`

This bud defines a new endpoint for clients and users to report blobs to servers.

### PUT /report - reporting a blob

The request body MUST be a signed [NIP-56](https://github.com/nostr-protocol/nips/blob/master/56.md) report event with one or more `x` tags containing the hashes of the blobs being reported.

Example:

```jsonc
{
  "kind": 1984,
  "tags": [
    ["x", "<blob-sha256>", "<type-based-on-nip-56>"],
    ["x", "<another-blob-sha256>", "<type-based-on-nip-56>"]
  ],
  "content": "<human readable report details>",
  // other fields...
}
```

The clients can include `e` or `p` tags to point to the event or the profile that contains this media if they want to make this report event useful for relays as well.

Server MUST respond to a report request with a success code or a code in the 4xx/5xx range if there was any error.

### Client behavior

The clients can show a blob report button on posts or in blob details. Or its RECOMMENDED to merge this with normal nostr report and send it to both relays and blossom server. other clients can receive it from relays and hide or blur reported blob from trusted friends.

### Server behavior

The servers MAY keep the reports somewhere for operators to check and take action on them. they MAY use a list of trusted people or moderators to directly take action on blob without operator request.

Servers MAY consider removed blobs sha256 as blocked to prevent rewrite.
Servers SHOULD advertise a route or landing page to provide their rules and terms of service which affects the report process.
