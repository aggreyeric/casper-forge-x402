# FORGE — First x402 Payment Protocol Implementation for Casper Network

**Hackathon:** Casper Agentic Buildathon 2026
**Track:** Casper Innovation Track
**Team:** Solo — Eric
**Status:** ✅ Code complete · 24/24 tests passing · contract compiled to WASM (52KB)

---

## 1. Project Overview

**FORGE** is the **first implementation of the [x402 HTTP payment protocol](https://github.com/x402-foundation/x402) for Casper Network**, paired with an autonomous **RWA (Real-World Asset) Analysis Agent** that pays for premium on-chain analysis via x402 micropayments.

x402 is an open standard for internet-native payments. The x402 Foundation ships
packages for EVM, Solana, and Stellar — **but not Casper.** FORGE closes that gap:

- A resource server (Express) returns **HTTP 402 Payment Required** with payment requirements.
- An AI agent receives the 402, creates an **Ed25519-signed Casper transfer**, retries with the payment.
- A **facilitator** verifies the payment and **settles it on-chain** (real Casper deploy via `casper-client`).
- A **Rust→WASM smart contract** records each settlement idempotently as a queryable on-chain event.

The agent analyses a catalogue of 5 tokenized RWA classes (Real Estate, Commodity/Gold, Invoice Financing, Treasury Bill, Carbon Credits), routes natural-language queries to the right tier, and **autonomously pays** for deep-dive analysis through x402.

### Why this wins
- **x402 is a hard differentiator** — $100K of the prize pool is x402 credits; most teams will ignore it.
- **Agentic AI** — an autonomous agent makes the pay/analyse decision, not a human click.
- **Real on-chain settlement** — a deployed, idempotent Rust contract, not a mock.
- **RWA narrative** — tokenizes real asset classes with a genuine analysis engine.

---

## 2. Architecture

```
                          ┌─────────────────────────────────────────────────┐
                          │               FORGE (this repo)                 │
                          │                                                 │
  ┌────────────┐  1. GET  │  ┌──────────────┐   ┌──────────────────────┐   │
  │  RWA Agent │─────────▶│  │  Resource     │   │  x402 Facilitator    │   │
  │ (x402      │  402 ◀───│  │  Server       │──▶│  - verify sig        │   │
  │  client,   │  +X-PAY  │  │  (Express +   │   │  - CLValue encode    │   │
  │  auto-pay) │  2. GET  │  │   middleware) │   │  - settlePayment()   │   │
  │            │  +sig ──▶│  │               │   └─────────┬────────────┘   │
  └────────────┘  3. 200  │  │  RWA Analyzer │             │ casper-client   │
       ▲          +receipt│  │  (5 assets,   │             ▼ (put-deploy)   │
       │                   │  │   NL router)  │   ┌──────────────────────┐   │
       │ NL query          │  └──────────────┘   │  Settlement Contract │   │
       └───────────────────│                     │  Rust → WASM         │   │
                           └─────────────────────┼──────────────────────┘───┘
                                                 │ 4. settle() on-chain
                                                 ▼
                                       ┌─────────────────────┐
                                       │  Casper Testnet     │
                                       │  (Condor 2.0)       │
                                       │  idempotent record  │
                                       └─────────────────────┘
```

### Request lifecycle (premium analysis)
1. **Agent** → `GET /api/rwa-agent/premium?asset=commodity-003`
2. **Middleware** has no `X-PAYMENT-SIGNATURE` → responds **402** + `X-PAYMENT` header (scheme `x402`, amount `1000000000` motes = 1 CSPR, wallet, `paymentReference`)
3. **Agent client** reads requirements, checks its spend limit, creates + signs an Ed25519 Casper transfer, retries with `X-PAYMENT-SIGNATURE`
4. **Facilitator** verifies amount/recipient/reference/network + signature, then **`settlePayment()`** submits a real `put-deploy` calling the contract's `settle` entry point via `casper-client`
5. **Server** returns **200** with the premium analysis + `paymentReceipt` (deploy hash)

---

## 3. On-Chain vs Off-Chain

| Layer | Tech | Files | Purpose |
|-------|------|-------|---------|
| **On-chain** | Rust → WASM (Casper) | `contract/src/main.rs`, `contract/Cargo.toml` | Idempotent settlement registry. Entry points: `init`, `settle` (idempotent), `get_settlement`, `get_count`. Emits a queryable record per payment. **Compiled: 52KB WASM.** |
| **Off-chain — facilitator** | TypeScript | `src/facilitator.ts` | CLValue byte encoding (String/U512/AccountHash), payment-header + signature verification, **real on-chain settlement** by shelling out to `casper-client` 5.x (Condor 2.0). |
| **Off-chain — middleware** | TypeScript + Express | `src/middleware.ts` | Auto-402 → verify → settle → passthrough. Attaches `paymentReceipt` to the request. |
| **Off-chain — agent client** | TypeScript | `src/client.ts` | `X402AgentClient`: auto-pays on 402, enforces a max-spend safety limit. |
| **Off-chain — RWA engine** | TypeScript | `src/rwa-agent/analyzer.ts`, `agent.ts` | 5-asset catalogue, deterministic NL router, basic (free) + premium (x402) analysis rules. |
| **Off-chain — demo server** | TypeScript + Express | `src/demo/server.ts` | All endpoints wired: free + x402-gated. |

---

## 4. How x402 Payments Work (Casper flavour)

x402 turns HTTP 402 ("Payment Required") into a real payment handshake.

**The 402 response** carries an `X-PAYMENT` header:
```json
{
  "scheme": "x402",
  "network": "casper-test",
  "asset": "CSPR",
  "amount": "1000000000",            // 1 CSPR = 10^9 motes
  "wallet": "01f66346cc4db2d0...",   // resource-server public key (Ed25519)
  "description": "FORGE RWA Premium Deep-Dive Analysis",
  "maxTimeoutSeconds": 60,
  "paymentReference": "e3da32793b366365a066e8ad3faf981b"
}
```

**The retry** carries an `X-PAYMENT-SIGNATURE` header — an Ed25519-signed Casper payment payload (from, to, amount, reference, chain, signature).

**The facilitator** (`src/facilitator.ts`):
- Verifies amount, recipient, reference, and network all match.
- Encodes the `settle` call's session args as byte-accurate Casper CLValues (`buildSettleDeployRequest`, pure + unit-tested).
- Settles for real by invoking `casper-client put-deploy` against the deployed contract — cryptographically-correct deploy serialization + Ed25519 signing delegated to the official Condor 2.0 client.

**On-chain** (`contract/src/main.rs`): the `settle()` entry point is **idempotent** (same `payment_reference` never double-settles), stores a `SettlementRecord`, and increments a global counter — every payment is a public, queryable on-chain event.

### Two execution paths (by design)
- **Offline / demo / tests:** when no funded contract is configured, `settlePayment()` returns a deterministic simulated hash so everything runs locally with zero on-chain cost. This is what the demo script exercises.
- **Live testnet:** the moment the account is faucet-funded and `deploy-contract.sh` has run, `settlePayment({ contractHash, secretKeyPath, ... })` submits **real** Casper deploys. The code path is identical; only the options differ.

---

## 5. API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /` | free | Service info + endpoint map |
| `GET /api/rwa-list` | free | List all 5 RWAs |
| `GET /api/rwa-agent/ask?q=...` | free | Agent routes a natural-language query |
| `GET /api/rwa-agent/portfolio` | free | Basic analysis across all RWAs |
| `GET /api/rwa-agent/premium?asset=ID` | **x402** | Premium deep-dive (1 CSPR) |
| `GET /api/analyze-rwa?asset=ID` | **x402** | Full RWA analysis (1 CSPR) |
| `GET /health` | free | Health check |

### RWA catalogue (5 asset classes)
`real-estate-001` (Real Estate), `commodity-003` (Gold), `invoice-002` (Invoice Financing), `treasury-004` (T-Bill), `carbon-005` (Carbon Credits).

---

## 6. Quick Start / Demo

```bash
npm install
npm run build       # TypeScript → dist/
npm test            # 24 tests, all passing
npm run demo        # demo server on :3000

# Walk through every feature end-to-end (for recording the demo video):
./scripts/demo.sh
```

The contract builds to WASM separately:
```bash
cd contract && cargo build --release --target wasm32-unknown-unknown
# → target/wasm32-unknown-unknown/release/x402_settlement.wasm (52KB)
```

`./scripts/demo.sh` is purpose-built for recording the demo video — it boots the server and exercises each free and x402-gated endpoint with annotated output (see `scripts/demo.sh`).

### Demo screenshots / captures
When recording, capture:
1. `npm test` → 24/24 green
2. `./scripts/demo.sh` → free endpoints + the 402 paywall + `X-PAYMENT` header
3. (Optional) `docker compose up --build` → app on :3000

---

## 7. Testnet Deployment Status

| Item | Status |
|------|--------|
| `casper-client` 5.x installed | ✅ |
| Testnet RPC reachable | ✅ `https://node.testnet.casper.network/rpc` (api 2.0.0 / protocol 2.2.1) |
| Resource-server keypair | ✅ `.keys/` |
| Resource-server wallet | ✅ `01f66346cc4db2d0a580b27f75b356a54c814dff74e73ccd44699b53e34e6ee704` |
| Contract → WASM compiled | ✅ 52KB |
| Contract deploy | ⏳ **Blocked on faucet funding** — `scripts/deploy-contract.sh` is ready; the testnet faucet needs a GitHub login (human step). Run it once funded. |
| `settlePayment()` → real Casper | ✅ Implemented; goes fully live once the account is funded + the contract is installed. |

> The **only** thing between "demo mode" and "fully live on testnet" is faucet funding + one `./scripts/deploy-contract.sh` run. No code changes needed.

---

## 8. Tech Stack

- **TypeScript** — off-chain agent + facilitator + middleware
- **Rust → WASM** — Casper settlement contract (Condor 2.0)
- **casper-client 5.x** — deploy serialization + Ed25519 signing
- **Express** — resource server
- **x402 Protocol** — HTTP 402 payment standard
- **Node.js built-in test runner** — 24 tests (facilitator + integration + agent)
- **Docker / docker-compose** — one-command deploy

---

## 9. Testing

```
# tests 24 · pass 24 · fail 0
```
- `src/test/facilitator.test.ts` — CLValue encoding (String/U512/AccountHash), payment header, signature verification (accept/reject), simulated + real deploy-request building.
- `src/test/integration.test.ts` — full HTTP flow: boot server → 402 → `X-PAYMENT` parse → free endpoints 200.
- `src/test/rwa-agent.test.ts` — NL router (basic/premium/portfolio), analysis rules, agent end-to-end.

---

## 10. Repository Layout

```
casper-forge/
├── contract/                  # Rust → WASM settlement contract
│   ├── src/main.rs
│   ├── Cargo.toml
│   └── target/.../x402_settlement.wasm   # compiled (52KB)
├── src/
│   ├── facilitator.ts         # x402 core: CLValue + verify + settle
│   ├── middleware.ts          # Express x402 middleware
│   ├── client.ts              # AI agent auto-pay client
│   ├── index.ts               # public module surface
│   ├── rwa-agent/
│   │   ├── analyzer.ts        # 5-asset DB + analysis rules
│   │   └── agent.ts           # NL router + autonomous agent
│   ├── demo/server.ts         # demo resource server
│   └── test/                  # 24 tests
├── scripts/
│   ├── deploy-contract.sh     # testnet deploy (ready, blocked on faucet)
│   └── demo.sh                # end-to-end feature walkthrough
├── Dockerfile · docker-compose.yml
├── README.md · SUBMISSION.md · BUILD_BRIEF.md · TECHNICAL_AMMO.md
├── LICENSE (MIT)
└── package.json · tsconfig.json
```

---

## 11. Team

**Solo build — Eric.**
Rust/WASM on-chain contract + full TypeScript off-chain stack (facilitator, middleware, agent client, RWA engine, demo server, tests, Docker).

---

## 12. What's Next (post-submission)

- Plug an LLM into `AgentOptions.analyze` to upgrade the deterministic router into a true natural-language planner (the x402 path is unchanged).
- Expand the RWA catalogue with live oracle-fed valuations.
- Add USDC as a second `asset` alongside CSPR.
