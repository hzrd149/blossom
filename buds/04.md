# BUD-04

## Mirroring blobs

`draft` `optional`

Defines the `/mirror` endpoint

## PUT /mirror - Mirror Blob

A server MAY expose a `PUT /mirror` endpoint to allow users to copy a blob from a URL instead of uploading it

Clients MUST pass the URL of the remote blob as a stringified JSON object in the request body

```jsonc
// request body...
{
  "url": "https://cdn.satellite.earth/b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553.pdf"
}
```

If the blob was newly mirrored and stored, the endpoint MUST respond with `201 Created` and a [Blob Descriptor](#blob-descriptor) in the response body.
If the blob already exists, the endpoint MUST respond with `200 OK` and a [Blob Descriptor](#blob-descriptor) in the response body.

The destination server SHOULD use the `Content-Type` header returned from the origin server to infer the mime type of
the blob. If the `Content-Type` header is not present the destination server SHOULD attempt to detect the `Content-Type`
from the blob contents and file extension, falling back to `application/octet-stream` if it cannot determine the type.

Servers MAY use the `Content-Length` header to determine the size of the blob.

Servers MAY reject a mirror request for any reason and MUST respond with the appropriate HTTP status code and an error message explaining the reason for the rejection.

### Status codes

Servers SHOULD use the following status codes for `PUT /mirror` responses:

| Status Code                  | Meaning                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `200 OK`                     | The blob already exists and the server is returning the existing [Blob Descriptor](./02.md#blob-descriptor). |
| `201 Created`                | The blob was mirrored and stored successfully and the server is returning its [Blob Descriptor](./02.md#blob-descriptor). |
| `400 Bad Request`            | The request body is malformed or the `url` is invalid.                                                       |
| `401 Unauthorized`           | Authorization is required and missing or invalid. See [BUD-11](./11.md#endpoint-authorization-requirements). |
| `402 Payment Required`       | Payment is required before mirroring can proceed. See [BUD-07](./07.md).                                    |
| `403 Forbidden`              | The request is understood but not allowed by server policy.                                                  |
| `409 Conflict`               | The mirrored blob hash does not match the authorized `x` tag.                                                |
| `413 Content Too Large`      | The mirrored blob exceeds server size limits.                                                                |
| `415 Unsupported Media Type` | The mirrored blob type is not supported.                                                                     |
| `429 Too Many Requests`      | The client has exceeded a rate limit or quota.                                                               |
| `502 Bad Gateway`            | The server could not fetch the blob from the origin URL or the origin response was unusable.                |

If included, `X-Reason` MUST be treated as a human readable diagnostic message only and clients MUST NOT parse it for control flow.

### Upload Authorization

Servers MAY require authorization when mirroring blobs as defined by [BUD-11](./11.md#endpoint-authorization-requirements).

## Example Flow

1. Client signs an `upload` authorization token and uploads blob to Server A
1. Server A returns a [Blob Descriptor](./02.md#blob-descriptor) with the `url`
1. Client sends the `url` to Server B `/mirror` using the original `upload` authorization token
1. Server B downloads the blob from Server A using the `url`
1. Server B verifies the downloaded blob hash matches the `x` tag in the authorization token
1. Server B returns a [Blob Descriptor](./02.md#blob-descriptor)
