# Blossom Compliance Test Suite

Automated test suite for validating Blossom server implementations against the [BUD specifications](https://github.com/hzrd149/blossom).

## Quick Start

```bash
# Install bun if you don't have it
curl -fsSL https://bun.sh/install | bash

# Install dependencies
cd compliance-test
bun install

# Test a single server
BLOSSOM_SERVER_URL=https://your-server.com bun run report.ts
```

This runs all BUD test modules and writes an HTML report to `report/index.html` and raw JSON to `report/results.json`.

## Running Individual Tests

```bash
BLOSSOM_SERVER_URL=https://your-server.com bun test
```

## Using in GitHub CI

This test suite is designed to be run from a **server implementation's repo** — not from the blossom spec repo itself. You clone the spec repo, install deps, spin up your server, and run the tests against it.

### Basic Workflow

```yaml
name: Blossom Compliance

on: [push, pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Start your Blossom server (adjust to your setup)
      - run: |
          your-server-start-command &
          sleep 5  # wait for it to be ready

      # Clone the compliance test suite
      - uses: actions/checkout@v4
        with:
          repository: hzrd149/blossom
          path: compliance-test-repo
          sparse-checkout: compliance-test

      - uses: oven-sh/setup-bun@v2

      - run: bun install
        working-directory: compliance-test-repo/compliance-test

      - name: Run compliance tests
        working-directory: compliance-test-repo/compliance-test
        env:
          BLOSSOM_SERVER_URL: http://localhost:3000
        run: bun run report.ts

      - name: Upload compliance report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: compliance-report
          path: compliance-test-repo/compliance-test/report/
```

### With Service Container

If your server can run in Docker, you can use service containers for a cleaner setup:

```yaml
name: Blossom Compliance

on: [push, pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest

    services:
      blossom:
        image: your-blossom-server:latest
        ports:
          - 3000:3000

    steps:
      - uses: actions/checkout@v4
        with:
          repository: hzrd149/blossom
          path: compliance-test-repo
          sparse-checkout: compliance-test

      - uses: oven-sh/setup-bun@v2

      - run: bun install
        working-directory: compliance-test-repo/compliance-test

      - name: Run compliance tests
        working-directory: compliance-test-repo/compliance-test
        env:
          BLOSSOM_SERVER_URL: http://localhost:3000
        run: bun run report.ts

      - name: Upload compliance report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: compliance-report
          path: compliance-test-repo/compliance-test/report/
```

### Failing the Build on Test Failures

The report command always exits 0 and produces a report. If you want the CI job to fail when mandatory BUD tests fail, use `bun test` instead — it uses the standard test runner which exits non-zero on failures:

```yaml
      - name: Run compliance tests
        working-directory: compliance-test-repo/compliance-test
        env:
          BLOSSOM_SERVER_URL: http://localhost:3000
        run: bun test
```

Or parse the JSON report after the fact:

```yaml
      - name: Check for failures
        working-directory: compliance-test-repo/compliance-test
        run: |
          FAILS=$(jq '[.[].buds[].cases[] | select(.status == "fail")] | length' report/results.json)
          if [ "$FAILS" -gt 0 ]; then
            echo "::error::$FAILS mandatory compliance test(s) failed"
            exit 1
          fi
```

## Test Coverage

| Module | BUD | Mandatory | Description |
|--------|-----|-----------|-------------|
| `bud-00` | BUD-00 | Yes | Server reachability |
| `bud-01` | BUD-01 | Yes | Server requirements (CORS, error responses, blob retrieval, HEAD, range requests) |
| `bud-02` | BUD-02 | No | Blob upload (PUT /upload, descriptors, X-SHA-256, duplicate handling) |
| `bud-03` | BUD-03 | No | Client-side only (skipped) |
| `bud-04` | BUD-04 | No | Blob mirror (PUT /mirror) |
| `bud-05` | BUD-05 | No | Blob delete (DELETE /\<sha256\>) |
| `bud-06` | BUD-06 | No | Media upload (PUT /media) |
| `bud-07` | BUD-07 | No | Blob list (GET /list/\<pubkey\>) |
| `bud-08` | BUD-08 | No | Blob TTL (upload with expiry) |
| `bud-09` | BUD-09 | No | Blob report (PUT /report with kind:1984 events) |
| `bud-10` | BUD-10 | No | Client-side only (skipped) |
| `bud-11` | BUD-11 | No | Auth tokens (kind:24242, header validation) |
| `bud-12` | BUD-12 | No | Identical blob deduplication |

Optional BUD failures are reported as **warnings** rather than failures.
