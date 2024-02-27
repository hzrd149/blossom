# Blossom Client Implementation

## Upload Blob

Clients should perform the following steps when uploading blobs

1. Prompt the user to sign an [Authorization event](./Server.md#upload-authorization-required) for the blob
2. Get the users [Server Discovery](./Nostr.md#user-server-discovery)
3. Make a `PUT /upload` request with the authorization event to each server on the list

## Implementations

Example implementation (Typescript) [blossom-client](https://github.com/hzrd149/blossom-client)
