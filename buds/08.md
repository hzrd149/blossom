# BUD-08

## Nostr File Metadata Tags

`draft` `optional`

Describes how a server could return nostr [NIP-94 File Metadata](https://github.com/nostr-protocol/nips/blob/master/94.md) tags from the `/upload` and `/mirror` endpoints

### Returning tags

As described in [BUD-02](./02.md#blob-descriptor) servers MAY add any additional fields to a blob descriptor

Servers MAY return an additional `nip94` field in the [blob descriptor](./02.md#blob-descriptor) from the `/upload` or `/mirror` endpoints

The `nip94` field should contain a JSON array with KV pairs as defined in [NIP-94](https://github.com/nostr-protocol/nips/blob/master/94.md)

An example response would look like:

```json
{
	"url": "https://cdn.example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf",
	"sha256": "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553",
	"size": 184292,
	"type": "application/pdf",
	"uploaded": 1725909682,
	"nip94": [
		["url", "https://cdn.example.com/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf"],
		["m", "application/pdf"],
		["x", "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553"],
		["size", "184292"],
		["magnet", "magnet:?xt=urn:btih:9804c5286a3fb07b2244c968b39bc3cc814313bc&dn=bitcoin.pdf"],
		["i", "9804c5286a3fb07b2244c968b39bc3cc814313bc"]
	]
}
```
