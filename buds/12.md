# BUD-12

## Blob management endpoints

`draft` `optional`

_All pubkeys MUST be in hex format_

Defines the `/list/<pubkey>` and `DELETE /<sha256>` endpoints.

The [Blob Descriptor](./02.md#blob-descriptor) type is defined in [BUD-02](./02.md).

## GET /list/pubkey - List Blobs (Unrecommended)

**Note:** The `/list` endpoint is optional and unrecommended. It is not necessary for all servers to implement the `/list` endpoint. Servers MAY implement this endpoint, but are not required to do so.

The `/list/<pubkey>` endpoint MUST return a JSON array of [Blob Descriptor](./02.md#blob-descriptor) objects that were uploaded by the specified pubkey.

The endpoint MUST support `cursor` and `limit` query parameters for cursor based pagination. The `cursor` parameter MUST be the `sha256` hash of the last blob in the previous page, or omitted to request the first page. The `limit` parameter specifies the maximum number of results to return. The returned array of blob descriptors MUST be sorted by the `uploaded` date in descending order and MUST NOT include the blob at the cursor.

The endpoint MAY support `since` and `until` query parameters to filter the list of blobs by their `uploaded` date. These parameters are deprecated for pagination purposes as they do not preserve server resources.

### Status codes

Servers SHOULD use the following status codes for `GET /list/<pubkey>` responses:

| Status Code               | Meaning                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `200 OK`                  | The list request succeeded and the response body contains an array of [Blob Descriptor](./02.md#blob-descriptor) objects. |
| `400 Bad Request`         | The query parameters are malformed.                                                                                       |
| `401 Unauthorized`        | Authorization is required and missing or invalid. See [BUD-11](./11.md#endpoint-authorization-requirements).              |
| `402 Payment Required`    | Payment is required before listing blobs. See [BUD-07](./07.md).                                                          |
| `403 Forbidden`           | The request is understood but not allowed by server policy.                                                               |
| `429 Too Many Requests`   | The client has exceeded a rate limit or quota.                                                                            |
| `503 Service Unavailable` | The listing service is temporarily unavailable.                                                                           |

If included, `X-Reason` MUST be treated as a human readable diagnostic message only and clients MUST NOT parse it for control flow.

## DELETE /sha256 - Delete Blob

Servers MUST accept `DELETE` requests to the `/<sha256>` endpoint.

### Status codes

Servers SHOULD use the following status codes for `DELETE /<sha256>` responses:

| Status Code               | Meaning                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `200 OK`                  | The blob was deleted successfully and the response may include a body.                                       |
| `204 No Content`          | The blob was deleted successfully and the response body is empty.                                            |
| `401 Unauthorized`        | Authorization is required and missing or invalid. See [BUD-11](./11.md#endpoint-authorization-requirements). |
| `402 Payment Required`    | Payment is required before deleting the blob. See [BUD-07](./07.md).                                         |
| `403 Forbidden`           | The request is understood but not allowed by server policy.                                                  |
| `404 Not Found`           | The blob does not exist or is not available for deletion.                                                    |
| `429 Too Many Requests`   | The client has exceeded a rate limit or quota.                                                               |
| `503 Service Unavailable` | The deletion service is temporarily unavailable.                                                             |

If included, `X-Reason` MUST be treated as a human readable diagnostic message only and clients MUST NOT parse it for control flow.

Multiple `x` tags in the authorization token MUST NOT be interpreted as the user requesting to delete multiple blobs.
