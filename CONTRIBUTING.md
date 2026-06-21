# Contributing to FORGE x402

Thanks for your interest in FORGE — the first native x402 payment protocol implementation for the Casper Network. Contributions are welcome and appreciated: bug reports, fixes, new facilitator features, contract improvements, tests, and docs all help.

> **Read this file first, then the [README](./README.md) for the full architecture overview.** This guide assumes you've already gone through the README.

## Prerequisites

Before you start, **read the [README](./README.md)** — it explains the x402 flow, the RWA agent, and the on-chain settlement model that everything else builds on.

You'll need:

- **Node.js ≥ 18** and **npm** — for the off-chain TypeScript agent + facilitator
- **TypeScript 5.x** — pulled in via `npm install`
- **Rust (stable) + `wasm32-unknown-unknown` target** — only if you're touching the on-chain contract in `contract/`
- **[casper-client](https://github.com/casper-network/casper-client) 5.x** — only if you're working on testnet deployment / settlement
- **Docker + Docker Compose** (optional) — for the containerized setup
- For testnet deploys: a Casper Condor 2.0 testnet account funded via the faucet at https://testnet.cspr.live/ (requires a GitHub login — a human step)

## Setup

```bash
git clone <repo-url> casper-forge
cd casper-forge
npm install
npm run build
npm test        # 24 tests should pass
npm run demo    # demo server on :3000
```

For the on-chain contract (Rust → WASM):

```bash
cd contract
cargo build --release --target wasm32-unknown-unknown
# Produces: target/wasm32-unknown-unknown/release/x402_settlement.wasm
```

For the Dockerized full stack (app + casper-client sidecar):

```bash
docker compose up --build
```

For testnet contract deployment (needs a funded account + `.keys/`):

```bash
casper-client keygen .keys
./scripts/deploy-contract.sh
```

## Running Tests

Tests are built from TypeScript, so build first, then run:

```bash
npm run build
npm test
```

The test command is `node --test dist/test/*.test.js`, covering the facilitator, integration, and RWA agent. All 24 tests must pass before a PR is merged.

You can also run a subset:

```bash
npm run test:unit         # facilitator tests only
npm run test:integration  # integration tests only
```

## Code Style

- **TypeScript, ESM (`"type": "module"`)** for everything under `src/`. Keep types explicit on public APIs.
- **Tests live in `src/test/`** as `*.test.ts` and run via the built `dist/test/*.test.js`. Add a test for any new facilitator/agent behavior.
- **The on-chain contract** (`contract/`) is Rust; follow `casper-contract` 4.x conventions and keep entry points idempotent (settlement must be replay-safe).
- Keep the demo and the API surface stable — the endpoints in the README are part of the public contract.
- Prefer real on-chain settlement logic over mocks where practical; gate anything that needs a funded testnet account behind an explicit check.

## Pull Requests & Issues

1. **Open an issue first** for anything beyond a small fix — describe the problem and your proposed approach so we can align before you sink time into code.
2. **Fork and branch** off `main`. Use a descriptive branch name (e.g. `feat/receipt-endpoint`, `fix/clvalue-encoding`).
3. **Keep PRs focused** — one logical change per PR. Split unrelated changes into separate PRs.
4. **Build + test must be green:** `npm run build && npm test` with all 24 tests passing.
5. **Describe what changed and why** in the PR description, and link the related issue.
6. **Screenshots/logs** are appreciated for changes to the demo flow or API responses.
7. Be respectful and constructive in review — we're all here to ship good x402 on Casper.

## License

By contributing, you agree that your contributions will be licensed under the **MIT License** — see [LICENSE](./LICENSE) (the project README also declares MIT).
