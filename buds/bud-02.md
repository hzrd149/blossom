# BUD-02

## Media processing endpoint

`draft` `optional`

### PUT /process

A server MAY expose a `/process` endpoint for the purpose of processing and/or optimizing any blob the user uploads

The endpoint MUST accept the `Content-Type` of `multipart/form-data` with the field `blob` containing the raw binary of the blob being upload

Similar to the `/upload` endpoint the server MUST respond with a [Blob Descriptor](./bud-01.md#blob-descriptor)

The server MUST also require authentication for the endpoint. in which case it MUST accept the same `upload` [authorization event](./bud-01#upload-authorization-required) as the `/upload` endpoint

### HEAD /process

If a server is exposing a `PUT /process` endpoint is MUST also expose a `HEAD /process` endpoint to allow clients to check if the `PUT /process` endpoint is available

The endpoint MUST respond with the `200` status code
