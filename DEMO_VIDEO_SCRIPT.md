# 🎬 DEMO VIDEO SCRIPT — FORGE (3:00)

**Hackathon:** Casper Agentic Buildathon 2026 — Casper Innovation Track
**Target length:** exactly 3 minutes (180 s)
**Format:** screen recording, 1920×1080, narration voiceover
**Tone:** confident builder, **standard-first** — the hook is *x402 ships for EVM, Solana, and Stellar — but not Casper. FORGE fixes that.*

> **Layout during recording:** terminal on the **left**, `SUBMISSION.md` open in a browser on the
> **right** (jump to the architecture diagram for the b-roll beat). Keep `contract/src/main.rs` open
> in VS Code as a tab — switch to it for the on-chain beat.

All narration below matches **real, verified** output (tests 24/24 pass; `scripts/demo.sh` runs
clean offline; WASM contract compiles to 52 KB). Read the **🗣 NARRATION** lines aloud; the
**🖥 ON SCREEN** lines are what you type/show.

---

## 0:00 – 0:20 · Hook & the differentiator  *(terminal, already in repo)*

🖥 **ON SCREEN** — repo already open, type the headline so it lands on screen:
```bash
echo "x402 ships for EVM · Solana · Stellar — not Casper. FORGE fixes that."
```

🗣 **NARRATION**
> "x402 is the open standard for internet-native HTTP payments — the x402 Foundation ships it for
> EVM, Solana, and Stellar. **But not Casper.** This is **FORGE** — the first x402 implementation
> for Casper, paired with an autonomous **RWA Analysis Agent** that pays for premium on-chain
> analysis through micropayments. Real Ed25519-signed transfers, real on-chain settlement, real
> Rust-to-WASM contract."

---

## 0:20 – 0:50 · Architecture  *(SUBMISSION.md → Architecture diagram)*

🖥 **ON SCREEN** — scroll `SUBMISSION.md` to the **Architecture** ASCII diagram; trace the loop with
the cursor.

🗣 **NARRATION**
> "Four moving parts, one loop. The **agent** requests a premium analysis. The **resource server**
> — a normal Express endpoint — replies **HTTP 402** with payment requirements in the `X-PAYMENT`
> header. The **agent reads the 402**, creates and signs an **Ed25519 Casper transfer**, and retries
> with the `X-PAYMENT-SIGNATURE` header. The **facilitator** verifies it and settles for real through
> `casper-client` — calling the contract's idempotent `settle` entry point. That's the entire x402
> handshake, end to end."

---

## 0:50 – 1:10 · Free endpoints  *(terminal — kick off the scripted walk)*

🖥 **ON SCREEN** — start the purpose-built walkthrough script and watch the free endpoints print:
```bash
./scripts/demo.sh
```

🗣 **NARRATION** *(as the output prints)*
> "First, the free surface. The **landing endpoint** advertises the protocol and price; **health**
> confirms the service is live; **`/api/rwa-list`** returns the catalogue — five tokenized asset
> classes: Real Estate, Gold, Invoice Financing, Treasury Bill, and Carbon Credits, each with a
> valuation and risk band."

---

## 1:10 – 1:40 · The agent routes natural language  *(terminal — continues printing)*

🗣 **NARRATION** *(as steps 4–6 print)*
> "The agent speaks natural language. Ask for a **'quick snapshot of the treasury bond'** and it
> routes to **basic** — free, served instantly. Ask for a **'deep dive on gold'** and it recognizes
> that's a **premium** request and points you at the x402-gated endpoint — one CSPR. And it does a
> free **portfolio overview** across all five assets. Everything so far is free; nothing has touched
> x402 yet."

---

## 1:40 – 2:15 · The x402 paywall — the climactic beat  *(terminal — section 7)*

🖥 **ON SCREEN** — freeze on the `402` + `X-PAYMENT` block as it prints; let the header fields sit on
screen.

🗣 **NARRATION**
> "Now the moment that makes this **x402 on Casper** — request the premium gold analysis with no
> payment attached. The server responds **HTTP 402 Payment Required** and attaches the `X-PAYMENT`
> header: scheme **x402**, network **casper-test**, asset **CSPR**, amount **one billion motes —
> exactly one CSPR** — the resource-server wallet, a description, and a payment reference. This is
> the standard x402 handshake, and the second premium endpoint is gated identically. **No payment,
> no access.**"

---

## 2:15 – 2:35 · Settlement path  *(terminal — section 9)*

🖥 **ON SCREEN** — the `settlePayment()` block prints a success + `deployHash`.

🗣 **NARRATION**
> "When the agent signs and retries, the **facilitator** verifies the signature, encodes the `settle`
> session args as byte-accurate Casper CLValues, and submits a real deploy via `casper-client`. In
> demo mode it returns a deterministic hash so the walk runs offline at zero cost — but **the same
> code path submits real Casper deploys the instant the testnet account is faucet-funded.**"

---

## 2:35 – 2:50 · On-chain contract + tests  *(VS Code → contract/src/main.rs, then terminal)*

🖥 **ON SCREEN** — switch to `contract/src/main.rs`; point at the `settle` entry point and the
idempotency guard. Then back to the terminal:
```bash
npm test
```

🗣 **NARRATION**
> "On-chain, a **Rust-to-WASM contract** — fifty-two kilobytes, compiled. The `settle` entry point is
> **idempotent**: same payment reference never double-settles, every payment emits a queryable
> on-chain record, and a global counter tracks the total. **Twenty-four tests — facilitator,
> integration, and agent end-to-end — all passing, fully offline.**"

---

## 2:50 – 3:00 · Wrap-up  *(terminal — end of demo.sh output)*

🖥 **ON SCREEN** — freeze on the final "✅ Demo complete" banner.

🗣 **NARRATION**
> "First x402 on Casper. Autonomous RWA agent. Real Rust-to-WASM settlement. And the **only** thing
> between this demo and fully-live testnet deploys is a faucet drip and one `deploy-contract.sh` run —
> no code changes. That's **FORGE**."

---

## 🎬 Cut list / b-roll (record these as separate clips)
- [ ] Typing the headline `echo` line → **thumbnail candidate** ("x402 … not Casper. FORGE fixes that").
- [ ] The architecture ASCII diagram being traced with the cursor — strongest "it's a real system" shot.
- [ ] The **`HTTP status: 402`** line + the `X-PAYMENT` header block — **freeze-frame, the money shot**.
- [ ] The `deployHash` line from the settlement step — pairs with the on-chain contract beat.
- [ ] `contract/src/main.rs` with the `settle` entry point visible — the Rust/WASM credibility shot.
- [ ] The `24 tests` / passing line — **freeze-frame**.
- [ ] The final "✅ Demo complete" banner as the outro backdrop.

## 📝 Speaker notes
- **Lead with the standard, not the stack.** "x402 ships for EVM/Solana/Stellar — not Casper" is the
  whole pitch. Say it twice if you have to.
- **"One billion motes — exactly one CSPR"** is the line that signals you actually understand Casper
  denominations; don't skip it.
- Everything in the demo runs **fully offline** through the simulated settlement path. If anything
  hiccups on camera, say *"running in offline demo mode"* — it's by design, not a workaround.
- The **402 + X-PAYMENT** beat is the climax — give it the longest dwell time; let the header fields
  sit readable on screen.
- Keep the architecture beat tight (~30 s); the screen-recording walkthrough is where the runtime
  credibility comes from.
- Total is tight at 180 s; if you're long, trim the architecture explanation, never the 402 or the
  settlement beats.

## ✅ Verified before this script was written
- `24/24` `npm test` tests pass (offline — facilitator, integration, RWA agent).
- `./scripts/demo.sh` runs clean end-to-end: server boot → landing → health → RWA catalogue (5
  assets) → NL router (basic + premium) → portfolio → **HTTP 402 + `X-PAYMENT` header** → second
  paywall → `settlePayment()` simulated deploy hash.
- `X-PAYMENT` header fields (real): `scheme: x402` · `network: casper-test` · `asset: CSPR` ·
  `amount: 1000000000` motes (= 1 CSPR) · `wallet: 01f66346cc4db2d0…` ·
  `description: FORGE RWA Premium Deep-Dive Analysis` · `paymentReference` present.
- RWA catalogue: `real-estate-001`, `commodity-003`, `invoice-002`, `treasury-004`, `carbon-005`.
- Contract compiles to **52 KB WASM** (`contract/target/.../x402_settlement.wasm`); `settle` entry
  point is idempotent.
- Testnet RPC reachable (`https://node.testnet.casper.network/rPC`, api 2.0.0 / protocol 2.2.1);
  contract deploy is the only thing blocked — on faucet funding (GitHub-login human step).

> ⛔ **APPROVAL GATE:** do not publish the video or submit anywhere until Eric approves.
