# FORGE — TECHNICAL AMMO & COMPETITIVE INTELLIGENCE
## Casper Agentic Buildathon 2026 ($150K) — Deadline Jul 1
### Prepared Jun 19, 2026 by PayBridge for HICLAW Forge Worker

---

## 🎯 THE STRATEGIC INSIGHT

**There is NO x402 package for Casper in the official x402 SDK.**

The x402 standard (created by Coinbase, now x402-foundation/x402) has packages for:
- EVM (`@x402/evm`)
- SVM/Solana (`@x402/svm`)
- Stellar (`@x402/stellar`)
- Frameworks: Express, Fastify, Hono, Next, Fetch, Axios

**But NO Casper.** The first team to implement a proper x402 facilitator/scheme for Casper wins the $100K x402 credits portion of the prize. This is the winning move.

---

## 📊 COMPETITOR LANDSCAPE (11 BUIDLs verified Jun 19)

| Competitor | x402 Approach | Differentiation Gap |
|-----------|--------------|-------------------|
| **VeriFeed** (45472) | On-chain settlement receipts + reputation | Closest competitor — uses odra + Rust. But no AI agent. |
| **verity** | LLM oracle pays per signal over x402, weighted by reputation | Strong — AI + x402 + reputation. Our direct competitor. |
| **AgentPay-x402** | AI agents buy/sell via HTTP 402, Ed25519 signed | Real on-chain txs. Broad. No specific DeFi use case. |
| **sasha-x402-kit** | Every agent decision attested on Casper (PAY+ATTEST) | Audit/trust angle. Not DeFi-specific. |
| **CasperGuard** | AI risk scoring via x402 for RWA compliance | RWA compliance angle — similar to our RWA angle. |
| Others (6) | General DeFi/AI/RWA | Less focused on x402. |

**OUR EDGE**: Eric built x402 on **Hedera** already (Week 3 submission). He KNOWS this protocol cold. Combine that with Rust + AI agent + RWA → we're the only team with real x402 implementation experience.

---

## 🔧 HOW x402 WORKS (Protocol Flow)

```
1. AI Agent → GET /api/analyze-rwa  (HTTP request for a service)
2. Server → 402 Payment Required
   Headers:
     X-PAYMENT: amount=100, asset=CSPR, chain=casper-test, wallet=0x...
     WWW-Authenticate: x402
3. AI Agent → creates PaymentPayload (signed payment)
4. AI Agent → GET /api/analyze-rwa (retry with X-PAYMENT-SIGNATURE header)
5. Facilitator → verifies payment signature, settles on-chain
6. Server → 200 OK + resource + payment receipt
```

**Key components needed:**
1. **Facilitator**: verifies payment + settles on Casper (CSPR transfer)
2. **Scheme**: defines how money moves on Casper (Ed25519 signed native transfer)
3. **Resource Server**: the AI agent service that charges per analysis
4. **Client/Agent**: the AI agent that pays and consumes

---

## 🔨 CASPER TECHNICAL DETAILS

### Casper 2.0 (Condor) — Latest
- **Multi-VM Architecture**: Can run EVM + Wasm contracts
- **Native Events (CEP-88)**: Contract-level events — perfect for x402 settlement receipts
- **Factory Pattern (CEP-86)**: Deploy agent contracts programmatically
- **Zug Consensus**: Leaner, faster block times
- **CSPR Burning (CEP-92)**: Token burn function available

### Testnet Details
- **Explorer**: https://testnet.cspr.live/
- **RPC**: `http://65.21.235.219:7777` (example node — verify current)
- **Devnet Info**: https://docs.casper.network/condor/devnet-info
- **Faucet**: Available at testnet.cspr.live (get free CSPR)

### Smart Contract (Rust)
- **SDK**: `casper-ces-types` + `odra` framework (used by competitor VeriFeed)
- **Build**: Rust + cmake + cargo
- **Deploy**: `casper-client put-deploy` CLI
- **Example repo**: https://github.com/casper-ecosystem/counter

### Casper SDK Options
- **Rust SDK**: `casper-contract` crate for on-chain
- **TypeScript SDK v5**: `casper-js-sdk` for off-chain agent
- **CLI**: `casper-client` for deploys + queries

---

## 🏗️ RECOMMENDED FORGE ARCHITECTURE

```
┌─────────────────────────────────────────────────┐
│ FORGE — Autonomous RWA Agent on Casper          │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────┐    ┌──────────────────────┐    │
│  │  AI Agent   │───▶│  x402 Client         │    │
│  │  (TS/Python)│    │  (pays per analysis)  │    │
│  └──────┬──────┘    └──────────┬───────────┘    │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌─────────────┐    ┌──────────────────────┐    │
│  │  LLM Engine │    │  x402 Facilitator    │    │
│  │  (analysis) │    │  (Casper settlement)  │    │
│  └──────┬──────┘    └──────────┬───────────┘    │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌──────────────────────────────────────────┐   │
│  │  Casper Smart Contract (Rust/odra)       │   │
│  │  ┌─ Payment vault (holds CSPR)           │   │
│  │  ├─ RWA registry (tokenized positions)   │   │
│  │  ├─ Settlement events (CEP-88)           │   │
│  │  └─ Reputation ledger                    │   │
│  └──────────────────────────────────────────┘   │
│         │                                        │
│         ▼                                        │
│  Casper Testnet (real on-chain transactions)     │
└─────────────────────────────────────────────────┘
```

---

## ✅ SUBMISSION CHECKLIST

- [ ] Rust smart contract deployed on Casper Testnet (real deploy hash)
- [ ] x402 payment flow working (agent pays → service responds)
- [ ] AI agent makes autonomous decisions (analyze RWA → pay → trade)
- [ ] GitHub repo with README + architecture docs
- [ ] Demo video (3-5 min walkthrough)
- [ ] DoraHacks BUIDL submission (Eric approves before submit)
- [ ] Testnet faucet funded (free CSPR)

---

## 🚫 WHAT NOT TO DO

- Don't fake x402 — implement a real facilitator that actually settles CSPR
- Don't skip on-chain transactions — judges verify deploy hashes
- Don't ignore RWA — the DeFi+RWA angle differentiates from generic agents
- Don't submit without Eric's approval

---

## 📚 KEY REFERENCES

- x402 Protocol: https://github.com/x402-foundation/x402
- x402 Spec (EVM impl): https://github.com/x402-foundation/x402/tree/main/typescript/packages/evm
- Casper Docs: https://docs.casper.network
- Casper 2.0 Release Notes: https://docs.casper.network/condor/index
- Counter Example: https://github.com/casper-ecosystem/counter
- Testnet Explorer: https://testnet.cspr.live/
- Hackathon: https://dorahacks.io/hackathon/casper-agentic-buildathon
- 11 Competitor BUIDLs: see `active/Casper-Agentic-Buildathon-2026.md`
