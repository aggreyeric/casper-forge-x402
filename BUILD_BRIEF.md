# BUILD BRIEF — Project "Forge"
## Casper Agentic Buildathon 2026 — Qualification Round

**Hackathon:** https://dorahacks.io/hackathon/casper-agentic-buildathon
**Deadline:** 2026/06/30 (11 days)
**Prize:** $150,000 USD ($30k cash + $100k x402 credits + $20k in-kind)
**Competition:** 46 BUIDLs, 294 hackers
**Track:** Casper Innovation Track (single track)

### WHAT TO BUILD
**Forge** — an autonomous Agentic AI DeFi agent on Casper Network that:
1. Monitors RWA (Real-World Asset) token positions on Casper
2. Uses AI to analyze market conditions and execute DeFi strategies
3. Charges for services via the x402 payment protocol
4. Runs fully on-chain on Casper Testnet

### ARCHITECTURE
```
AI Agent (LLM-powered, Rust/TypeScript)
    ├── RWA Analysis Engine — reads on-chain token data, assesses value/risk
    ├── Strategy Executor — makes DeFi decisions (swap, stake, rebalance)
    ├── Risk Manager — position limits, stop-losses, circuit breakers
    ├── x402 Payment Layer — charges per analysis/action in CSPR or USDC
    └── Casper Smart Contract (Rust) — on-chain execution layer
```

### TECH STACK
- **Casper Network** — L1 blockchain, Rust smart contracts
- **Casper SDK** — for on-chain interactions (typescript-sdk or rust-sdk)
- **x402 Protocol** — AI agent payment standard (native to this hackathon)
- **Rust** — for smart contract (on-chain logic)
- **TypeScript** — for off-chain agent (AI orchestration, analysis)
- **Casper Testnet** — deploy target (REQUIRED: transaction-producing on-chain component)

### SUBMISSION REQUIREMENTS
1. Working prototype on Casper Testnet with **real on-chain transactions**
2. Open-source GitHub repo with README + documentation
3. Demo video (public, walkthrough of features)

### WINNING STRATEGY
- **Agentic AI emphasis is KEY** — Casper specifically wants AI agents making autonomous decisions
- **x402 integration is a differentiator** — most teams will ignore it; $100k of the prize is x402 credits
- **RWA angle** — tokenize something real (real estate, invoices, commodities) and have the agent manage it
- **Qualification = community votes OR technical merit** — Top 3 community-voted auto-advance

### CONSTRAINTS
- Testnet only (Casper Testnet — free CSPR from faucet)
- Open-source from day 1 (required by rules)
- Must produce real on-chain transactions (not just read-only)
- Don't fake x402 integration — implement it properly or pivot
- Use find-skills early to bootstrap

### DAY 1-2 SPIKE GATE
- **Day 1:** Casper Testnet connection working — deploy a simple contract, read/write state
- **Day 2:** x402 protocol study + integration plan — can an agent charge for a query?
- **Report spike results before full build**

### DELIVERABLES
- `forge-agent/` — full project (Rust contract + TS agent + tests)
- Deployed on Casper Testnet with live contract address
- Demo video script
- README + ARCHITECTURE docs
- DoraHacks BUIDL submission draft (Eric approves before submit)
