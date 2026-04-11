# BUD-05

## Media optimization endpoints

`draft` `optional`

Defines the `PUT /media` endpoint for processing and optimizing media

## PUT /media

The `PUT /media` endpoint MUST accept binary data in the request body.  
The server SHOULD perform any optimizations or conversions it deems necessary in order to make the media more suitable for distribution.

Clients SHOULD include `Content-Type` and `Content-Length` headers specifying the MIME type and size of the data. Clients MAY provide an `X-SHA-256` header containing the lowercase hex-encoded sha256 of the request body. A server MAY use this value to enforce rejection policies or perform authorization checks prior to persisting the blob.

On success, the endpoint MUST respond with either `200 OK` or `201 Created` and a [Blob Descriptor](#blob-descriptor) in the response body. Clients MUST treat both status codes as successful media creation.  
On failure, the endpoint MUST return an appropriate `4xx` or `5xx` status code and an error message explaining the reason for the rejection.

### PUT /media status codes

Servers SHOULD use the following status codes for `PUT /media` responses:

| Status Code                  | Meaning                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `200 OK`                     | The media was accepted, processed, and stored successfully.    |
| `201 Created`                | The media was accepted, processed, and stored successfully.    |
| `400 Bad Request`            | The request headers or body are malformed.                     |
| `401 Unauthorized`           | Authorization is required and missing or invalid.              |
| `403 Forbidden`              | The request is understood but not allowed by server policy.    |
| `409 Conflict`               | The provided `X-SHA-256` does not match the request body.      |
| `411 Length Required`        | A required `Content-Length` header is missing.                 |
| `413 Content Too Large`      | The media exceeds server size limits.                          |
| `415 Unsupported Media Type` | The media type is not supported.                               |
| `422 Unprocessable Content`  | The media is well-formed but cannot be processed successfully. |
| `429 Too Many Requests`      | The client has exceeded a rate limit or quota.                 |
| `503 Service Unavailable`    | The media processing service is temporarily unavailable.       |

### Upload Authorization

Servers MAY require authorization when processing media as defined by [BUD-11](./11.md#endpoint-authorization-requirements).

## HEAD /media

Servers MAY implement `HEAD /media` as an optimization step before `PUT /media`.
Clients can use it to avoid uploading media that would be rejected, and servers can use it to evaluate whether a media-processing request would be accepted based on the supplied metadata and current server policy.

This pre-flight request is only an optimization. Clients MAY skip it entirely, and the result is not a guarantee of the eventual `PUT /media` outcome because server state may change between requests.

The `HEAD /media` endpoint MUST use the `X-SHA-256`, `X-Content-Type` and `X-Content-Length` headers sent by client to get the sha256 hash, MIME type and size of the media that will be uploaded, returning an HTTP status code and an optional custom header `X-Reason` to indicate a human readable message about the upload requirements. Because `HEAD` responses do not include a message body, clients MUST determine the result from the status code and response headers alone.

Servers SHOULD use the following status codes for `HEAD /media` responses:

| Status Code                  | Meaning                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `200 OK`                     | Based on the supplied headers and current server policy, the media-processing request would be accepted and the client MAY proceed with `PUT /media`. |
| `400 Bad Request`            | The request headers are malformed.                          |
| `401 Unauthorized`           | Authorization is required and missing or invalid.           |
| `402 Payment Required`       | Payment is required before the media-processing request can proceed. See [BUD-07](./07.md). |
| `403 Forbidden`              | The request is understood but not allowed by server policy. |
| `411 Length Required`        | A required `X-Content-Length` header is missing.            |
| `413 Content Too Large`      | The media would exceed server size limits.                  |
| `415 Unsupported Media Type` | The media type is not supported.                            |
| `429 Too Many Requests`      | The client has exceeded a rate limit or quota.              |
| `503 Service Unavailable`    | The media processing service is temporarily unavailable.    |

If included, `X-Reason` MUST be treated as a human readable diagnostic message only and clients MUST NOT parse it for control flow.

Clients that do not implement this optimization may still perform `PUT /media` directly, and servers MUST handle that correctly.

After receiving `200 OK` from `HEAD /media`, clients MUST still be prepared for `PUT /media` to return either `200 OK` or `201 Created`, depending on how the media-processing result is handled by the server.

## Limitations

The goal of this endpoint is to provide a simple "trusted" optimization endpoint clients can use to optimize media for distribution.
How the blob is optimized is the sole responsibility of the server and the client should have no say in what optimization process is used.

If a longer optimization or transformation process is needed, or if the client needs to specify how a blob should be transformed, other protocols should be used.

## Client Implementation

Clients MAY let a user selected a "trusted processing" server for uploading images or short videos.

Once a server has been selected, the client uploads the original media to the `/media` endpoint of the trusted server and get the optimized blob back.

Then the client can call the `/mirror` endpoint on other servers to distribute the blob.
