# FORGE — DoraHacks Submission Form Fields

> Hackathon: Casper Forge (DoraHacks) · $150K · Deadline: Jun 30, 2026
> Project: x402 DeFi agent on Casper with 5 RWA tokenized assets
> Status: Draft — **DO NOT SUBMIT ANYWHERE** until Eric approves.

---

## 1. Project Name

```
FORGE
```

---

## 2. One-line Tagline (≤ 255 chars)

```
The first x402 HTTP payment protocol implementation on Casper — an autonomous RWA-analysis agent that pays for premium on-chain insights and settles on-chain, no human in the loop.
```

_(~190 chars — comfortably under the 255 limit.)_

---

## 3. Description (500–800 words, judge narrative)

Most AI agents can't pay for anything. They stall the moment they hit a paywall, fire off a message asking a human to grab a credit card, and the workflow dies. FORGE fixes that — and it does it on the one chain that the payment standard everyone's talking about has never landed on.

x402 is the open standard that turns HTTP 402 ("Payment Required") into a real, machine-readable payment handshake. The x402 Foundation ships official packages for EVM, Solana, and Stellar — but not Casper. We built the missing one. FORGE is the **first implementation of the x402 HTTP payment protocol on Casper Network**, paired with an autonomous agent that uses it to actually buy something useful.

Here's the loop, end to end. An RWA Analysis Agent wants a premium deep-dive on a tokenized asset — say, a gold-backed commodity token or a treasury bill. It fires a GET request. The resource server returns **HTTP 402** with an `X-PAYMENT` header describing exactly what it wants: 1 CSPR, to this wallet, with this payment reference, on `casper-test`. No human in the loop. The agent reads the header, checks its own spend limit, mints an **Ed25519-signed Casper transfer**, and retries the request with an `X-PAYMENT-SIGNATURE` attached. A facilitator verifies the amount, recipient, reference, network, and cryptographic signature — then settles the payment **for real on Casper Condor 2.0** via `casper-client`. The server returns 200 with the analysis and a payment receipt. On-chain, a **Rust→WASM smart contract** records the settlement idempotently: the same payment reference can never double-settle, and every payment is a public, queryable event.

That's the whole pitch in one breath: an AI agent that sees a paywall, pays it, and gets the goods — all on Casper, all autonomous, all cryptographically verifiable.

What makes this genuinely hard, and genuinely different from the other submissions:

**It's real on-chain settlement, not a mock.** The facilitator shells out to `casper-client` 5.x for byte-accurate deploy serialization and Ed25519 signing against Condor 2.0. The Rust contract compiles to a 52KB WASM blob with idempotent entry points (`init`, `settle`, `get_settlement`, `get_count`). The only thing standing between demo mode and fully-live testnet is a faucet drip and one deploy script — the code path is identical either way.

**The agent is autonomous, not a button.** There's no "click here to pay." The agent parses the 402, evaluates cost against a hard spend ceiling, signs, and retries on its own. That's the agentic primitive every judge is looking for this cycle.

**The RWA story is real, not decorative.** Five tokenized asset classes — Real Estate, Gold, Invoice Financing, Treasury Bills, Carbon Credits — each with a deterministic natural-language router and genuine premium analysis rules. The agent routes plain-English queries to the right asset and tier, then pays only when the answer is worth paying for.

**24/24 tests pass.** CLValue byte encoding (String / U512 / AccountHash), signature accept/reject, full HTTP integration from boot to 402 to 200, and the RWA agent end-to-end. Nothing in this submission is "works on my machine" theatre.

In a prize pool where a large chunk is earmarked for x402 credits, most teams will skim past the payment standard as "too much work." We didn't. FORGE is the **first x402 on Casper**, the agent that uses it, the contract that settles it, and the RWA engine that makes it worth using — built solo, tested green, and ready to go live the second the testnet account is funded.

_(≈ 660 words — within the 500–800 target.)_

---

## 4. Demo Video URL

```
https://youtu.be/REPLACE_ME
```

> **Placeholder.** Record after testnet funding — use `./scripts/demo.sh` as the walkthrough script (hits every free + x402-gated endpoint with annotated output). Replace `REPLACE_ME` once uploaded.

---

## 5. GitHub Repository

```
https://github.com/aggreyeric/casper-forge-x402
```

---

## 6. Track Suggestion

**Primary recommendation:**

```
AI Agents / Agentic (on-chain)
```

**Why:** The headline primitive is an **autonomous agent** — it parses an HTTP 402, evaluates a spend limit, signs a Casper transfer, and retries unattended. That's the agentic-UX story the judges are explicitly rewarding this cycle, and it's the angle no other team is likely to nail.

**Strong alternate tracks (pick one as secondary if the form allows / if the primary track is contested):**

| Track | Why it fits |
|-------|-------------|
| **Payments & Infrastructure (x402)** | This is the **first x402 implementation on Casper**. The x402-credits portion of the prize pool is the single biggest differentiator here — FORGE is built directly on the standard most teams will ignore. |
| **DeFi** | On-chain settlement registry, idempotent payment recording, RWA tokenization with 5 asset classes — clean DeFi primitives. |
| **Innovation / Open Track** | Cross-cutting (x402 + agents + RWA + Rust→WASM) with no single legacy home; a natural fit if the hackathon has a catch-all innovation track. |

> If only one track can be chosen: go **AI Agents / Agentic** (primary). If x402 has a dedicated bountied track on the DoraHacks listing, **prefer that** — the credit bounty is the strongest competitive moat. Confirm the exact track names against the live DoraHacks listing before pasting, since track labels vary year to year.

---

## Pre-Submit Checklist (for Eric)

- [ ] Replace demo video `REPLACE_ME` with the real upload URL
- [ ] Confirm exact track names against the live DoraHacks Casper Forge listing
- [ ] Verify GitHub repo is public and the README renders cleanly
- [ ] Fund testnet account + run `scripts/deploy-contract.sh` (so the demo video shows live settlement)
- [ ] Eric signs off before any form is actually submitted
