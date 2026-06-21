# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Overview

**FORGE (forge-x402-casper)** is the first native implementation of the
[x402 HTTP payment protocol](https://github.com/x402-foundation/x402) for **Casper Network**. The
x402 Foundation ships packages for EVM, Solana, and Stellar — FORGE closes that gap for Casper,
pairing a native x402 client + facilitator with an autonomous **RWA (Real-World Asset) Analysis AI
Agent** that pays for premium on-chain analysis via x402 micropayments (1 CSPR per request), settled
on Casper Condor 2.0.

**This is a LIBRARY, not a web app.** `src/index.ts` exports the facilitator / middleware / client
primitives; the Express demo server in `src/demo/server.ts` is a usage example, not the deliverable.
Built for the **Casper Agentic Buildathon 2026**.

## Tech Stack

- **TypeScript** (`type: module`, `main: dist/index.js`) — off-chain agent + facilitator + middleware
- **Express 4** — resource-server middleware (demo only)
- **Rust → WASM** (`wasm32-unknown-unknown`, casper-contract/types 4.x) — Casper settlement contract
- **casper-client 5.x** — deploy serialization + Ed25519 signing (invoked as a **subprocess**)
- **x402 protocol** — HTTP 402 Payment Required payment standard
- **Docker / docker-compose** — app on :3000 with an optional `casper-client` sidecar

## Commands

```bash
# Off-chain (library + demo)
npm install
npm run build              # tsc → dist/
npm test                   # 24 tests (facilitator + integration + rwa-agent) — must pass
npm run test:unit          # facilitator tests only
npm run test:integration   # integration tests only
npm run demo               # boot demo server on :3000

# Full end-to-end feature walkthrough (annotated output, for demo video)
./scripts/demo.sh

# On-chain contract → WASM
cd contract
cargo build --release --target wasm32-unknown-unknown
# → target/wasm32-unknown-unknown/release/x402_settlement.wasm (~52 KB)

# Deploy to Casper Testnet (Condor 2.0)
casper-client keygen .keys
# fund the pubkey via the faucet (GitHub login): https://testnet.cspr.live/
./scripts/deploy-contract.sh   # writes .deploy.env with the contract hash

# Docker
docker compose up --build
```

## Architecture (key files)

```
src/
  index.ts                   LIBRARY ENTRYPOINT — exports facilitator / middleware / client
  facilitator.ts             Core x402 facilitator: CLValue encoding, payment verification,
                             REAL on-chain settlement via casper-client subprocess
  middleware.ts              Express x402 middleware: 402 → verify → settle → passthrough
  client.ts                  X402AgentClient — AI agent client that auto-pays for resources
  rwa-agent/
    analyzer.ts              RWA database (5 asset classes) + pure analysis rules (basic/premium)
    agent.ts                 autonomous RWA agent: routes queries, pays for premium via x402
  demo/
    server.ts                Express demo server (USAGE EXAMPLE, not the deliverable)
  test/
    facilitator.test.ts      unit tests
    integration.test.ts      end-to-end
    rwa-agent.test.ts        agent tests
contract/
  src/main.rs                Casper settlement contract: idempotent registry + events
  Cargo.toml                 casper-contract 4.0.0 + casper-types 4.0.2
scripts/
  demo.sh                    boots server + hits every endpoint with annotated output
  deploy-contract.sh         deploys contract, writes .deploy.env
docker-compose.yml           forge-app:3000 + optional casper-client sidecar
```

### Contract entry points (Rust/WASM)
`init()`, `settle(payment_reference, payer, amount, deploy_hash)` (**idempotent** — replays
rejected), `get_settlement(payment_reference)`, `get_count()`.

### API endpoints (demo server, :3000)
| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /` | free | service info |
| `GET /api/rwa-list` | free | list RWAs |
| `GET /api/rwa-agent/ask?q=...` | free | route a NL query |
| `GET /api/rwa-agent/portfolio` | free | basic analysis |
| `GET /api/rwa-agent/premium?asset=ID` | **x402** | premium deep-dive (1 CSPR) |
| `GET /api/analyze-rwa?asset=ID` | **x402** | full analysis (1 CSPR) |
| `GET /health` | free | health check |

RWA catalogue: `real-estate-001`, `commodity-003`, `invoice-002`, `treasury-004`, `carbon-005`.

## Important Notes

- **This is a LIBRARY, not a web app.** The public surface is the `src/index.ts` exports
  (`createPaymentHeader`, `verifyPaymentSignature`, `settlePayment`, `x402Middleware`,
  `X402AgentClient`, `csprToMotes`, …). `src/demo/server.ts` is a usage example. Keep the library
  pure and side-effect-free; do not bake app/demo concerns into the core modules.
- **Signing happens via a `casper-client` SUBPROCESS, not a JS crypto lib.** `settlePayment()` shells
  out to the official `casper-client` binary for cryptographically-correct deploy serialization +
  Ed25519 signing, then submits the deploy directly to Casper Condor 2.0 RPC. There is **no**
  external facilitator dependency (no `x402…network` endpoint). When editing the facilitator,
  preserve the subprocess contract: arg ordering, base64 encodings, and the deploy JSON shape must
  stay byte-compatible with `casper-client put-deploy`.
- **Settlement is idempotent.** The contract's `settle(payment_ref, …)` rejects any replayed or
  duplicated payment reference and emits an on-chain event. Keep `generatePaymentReference()` unique
  per logical payment; never reuse a reference.
- **Demo-mode vs. fully-live.** `settlePayment()` is production-ready but only goes fully live once
  the resource-server wallet is faucet-funded and the contract is deployed. Until then it falls back
  to the simulated path. The blocker is the human GitHub-login faucet step, not code.
- **`type: "module"` ESM.** Imports inside `src/` must use explicit `.js` extensions (e.g.
  `from './facilitator.js'`) because `tsc` emits ESM. Tests run from `dist/` — always `npm run build`
  before `npm test`.
- **Build first.** `npm test` runs `node --test dist/test/*.test.js`. If you edit `src/`, rebuild or
  tests run against stale `dist/`. Before reporting "done": `npm run build && npm test` — all 24
  tests must pass.
- **No secrets, no submission.** `.keys/` and `.deploy.env` are gitignored and must never be
  committed. The repo does **not** submit to any hackathon portal.
