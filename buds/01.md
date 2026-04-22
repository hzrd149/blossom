# BUD-01

## Server requirements and blob retrieval

`draft` `mandatory`

_All pubkeys MUST be in hex format_

## Cross origin headers

Servers MUST set the `Access-Control-Allow-Origin: *` header on all responses to ensure compatibility with applications hosted on other domains.

For [preflight](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#preflighted_requests) (`OPTIONS`) requests,
servers MUST also set, at minimum, the `Access-Control-Allow-Headers: Authorization, *` and `Access-Control-Allow-Methods: GET, HEAD, PUT, DELETE` headers.

The header `Access-Control-Max-Age: 86400` MAY be set to cache the results of a preflight request for 24 hours.

## Error responses

Every time a server sends an error response (HTTP status codes >=400), it MAY include a human-readable header `X-Reason` that can be displayed to the user.

## Endpoints

All endpoints MUST be served from the root of the domain (eg. the `/upload` endpoint MUST be accessible from `https://cdn.example.com/upload`, etc). This allows clients to talk to servers interchangeably when uploading or retrieving blobs

## GET /sha256 - Get Blob

The `GET /<sha256>` endpoint MUST return the contents of the blob in the response body. the `Content-Type` header SHOULD beset to the appropriate MIME-type

The endpoint MUST accept an optional file extension in the URL. ie. `.pdf`, `.png`, etc

Regardless of the file extension, the server MUST return the MIME type of the blob in the `Content-Type` header. If the
server does not know the MIME type of the blob, it MUST default to `application/octet-stream`

### Proxying and Redirection (Optional)

If the endpoint returns a redirection 3xx status code such as 307 or 308 ([RFC 9110 section
15.4](https://datatracker.ietf.org/doc/html/rfc9110#name-redirection-3xx)), it MUST redirect to a URL containing the
same sha256 hash as the requested blob. This ensures that if a user copies or reuses the redirect URL, it will
contain the original sha256 hash.

While the final blob may not be served from a Blossom server (e.g. CDN, IPFS, object storage, etc.), the destination
server MUST set the `Access-Control-Allow-Origin: *` header on the response to allow cross-origin requests, as well as
the `Content-Type` and `Content-Length` headers to ensure the blob can be correctly displayed by clients. Two ways to
guarantee this are:

1. Proxying the blob through the Blossom server, allowing it to override headers such as `Content-Type`.
2. Manipulating the redirect URL to include a file extension that matches the blob type, such as `.pdf`, `.png`, etc. If
   the server is unable to determine the MIME type of the blob, it MUST default to `application/octet-stream` and MAY
   include a file extension in the URL that reflects the blob type (e.g. `.bin`, `.dat`, etc.).

### Status codes

Servers SHOULD use the following status codes for `GET /<sha256>` responses:

| Status Code                 | Meaning                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `200 OK`                    | The blob exists and is returned in the response body.                                                        |
| `206 Partial Content`       | The blob exists and the server is fulfilling a valid `Range` request.                                        |
| `307 Temporary Redirect`    | The blob is temporarily available from another URL containing the same sha256.                               |
| `308 Permanent Redirect`    | The blob is permanently available from another URL containing the same sha256.                               |
| `400 Bad Request`           | The sha256 path, optional file extension, or request headers are malformed.                                  |
| `401 Unauthorized`          | Authorization is required and missing or invalid. See [BUD-11](./11.md#endpoint-authorization-requirements). |
| `403 Forbidden`             | The request is understood but not allowed by server policy.                                                  |
| `404 Not Found`             | The blob does not exist.                                                                                     |
| `416 Range Not Satisfiable` | The blob exists but the requested byte range is invalid or outside the blob size.                            |
| `429 Too Many Requests`     | The client has exceeded a rate limit or quota.                                                               |
| `503 Service Unavailable`   | The retrieval service is temporarily unavailable.                                                            |

## HEAD /sha256 - Has Blob

The `HEAD /<sha256>` endpoint SHOULD be identical to the `GET /<sha256>` endpoint except that it MUST NOT return the
blob in the reponse body per [RFC 7231](https://www.rfc-editor.org/rfc/rfc7231#section-4.3.2)

The endpoint MUST respond with the same `Content-Type` and `Content-Length` headers as the `GET /<sha256>` endpoint.

The endpoint MUST accept an optional file extension in the URL similar to the `GET /<sha256>` endpoint. ie. `.pdf`, `.png`, etc

### Status codes

Servers SHOULD use the following status codes for `HEAD /<sha256>` responses:

| Status Code               | Meaning                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `200 OK`                  | The blob exists and the server returns the same metadata headers as `GET /<sha256>` without a response body. |
| `307 Temporary Redirect`  | The blob is temporarily available from another URL containing the same sha256.                               |
| `308 Permanent Redirect`  | The blob is permanently available from another URL containing the same sha256.                               |
| `400 Bad Request`         | The sha256 path, optional file extension, or request headers are malformed.                                  |
| `401 Unauthorized`        | Authorization is required and missing or invalid. See [BUD-11](./11.md#endpoint-authorization-requirements). |
| `403 Forbidden`           | The request is understood but not allowed by server policy.                                                  |
| `404 Not Found`           | The blob does not exist.                                                                                     |
| `429 Too Many Requests`   | The client has exceeded a rate limit or quota.                                                               |
| `503 Service Unavailable` | The retrieval service is temporarily unavailable.                                                            |

## Range requests

To better support mobile devices, video files, or low bandwidth connections. servers should support range requests ([RFC 7233 section 3](https://www.rfc-editor.org/rfc/rfc7233#section-3)) on the `GET /<sha256>` endpoint and signal support using the `accept-ranges: bytes` and `content-length` headers on the `HEAD /<sha256>` endpoint

See [MDN docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests) for more details

## Sunset Header (Optional)

Servers MAY include the [`Sunset`](https://www.rfc-editor.org/rfc/rfc8594.html) HTTP response header on `GET /<sha256>` and `HEAD /<sha256>` responses to indicate that a blob is expected to become unavailable at a specific time due to server retention, expiration, or automatic deletion policy.

Clients SHOULD treat the `Sunset` value as advisory only. It indicates expected future unavailability of the blob resource, but it does not guarantee that the blob will be deleted at that exact time or that it will remain unavailable forever.

Clients MUST NOT interpret `Sunset` as a permanent negative cache signal. After the advertised time, the definitive test of whether a blob is still available is to request `GET /<sha256>` or `HEAD /<sha256>` again.

Because Blossom blobs are addressed by sha256, the same blob MAY become available again at the same path if a server later re-imports, restores, or re-uploads it. Clients MUST NOT assume that a previously observed `Sunset` header means the blob can never reappear.

After the `Sunset` time, servers MAY respond according to their own policy, including `404 Not Found`, `410 Gone`, or a redirection response.

Example:

```http
HTTP/1.1 200 OK
Sunset: Wed, 11 Nov 2026 11:11:11 GMT
```
