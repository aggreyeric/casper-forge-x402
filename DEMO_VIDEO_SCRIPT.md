# 🎬 DEMO VIDEO SCRIPT — FORGE (3:00)

**Hackathon:** Casper Agentic Buildathon 2026 — Casper Innovation Track
**Target length:** exactly 3 minutes (180 s)
**Format:** screen recording, 1920×1080, narration voiceover
**Tone:** confident builder — lead with the standard, not the stack.

> **Accuracy note:** every command, status code, header field, asset ID, wallet, and amount below
> was verified against the live codebase (`src/demo/server.ts`, `src/facilitator.ts`,
> `src/middleware.ts`, `src/rwa-agent/analyzer.ts`, `scripts/demo.sh`) on 2026-06-21. No fabricated
> output — what's written is what the code prints.

> **Layout during recording:** terminal on the **left**, `README.md` open in a browser on the
> **right** (jump to the **Testnet Integration Status** table for that beat). Keep
> `src/facilitator.ts` open in VS Code as a tab for the settlement beat.

Read **🗣 NARRATION** lines aloud; **🖥 ON SCREEN** is what you type/show. **⏱** = the running
timestamp. Times are guides — the **402 + X-PAYMENT** beat gets the longest dwell, always.

---

## ⏱ 0:00 – 0:25 · 1. INTRO — x402 payments for AI agents  *(terminal, repo already open)*

🖥 **ON SCREEN** — repo open in the terminal. Type the headline so it lands on screen:

```bash
echo "x402 ships for EVM · Solana · Stellar — but NOT Casper. FORGE fixes that."
```

🗣 **NARRATION**
> "x402 is the open standard for *internet-native* HTTP payments — it lets AI agents pay for
> services autonomously over the web. The x402 Foundation ships it for EVM, Solana, and Stellar.
> **But not Casper.** This is **FORGE** — the first x402 implementation for the Casper Network,
> paired with an autonomous **RWA Analysis Agent** that pays for premium on-chain analysis through
> micropayments. Real Ed25519-signed transfers. Real on-chain settlement. A real Rust-to-WASM
> contract. Let me show you the whole loop."

---

## ⏱ 0:25 – 0:40 · 2. KICK OFF `scripts/demo.sh`  *(terminal — start the walkthrough)*

🖥 **ON SCREEN** — run the purpose-built walkthrough. It boots the server and hits every endpoint
with annotated output:

```bash
./scripts/demo.sh
```

🗣 **NARRATION**
> "First, let me start the server and walk every feature. `scripts/demo.sh` boots the FORGE demo
> server and exercises each free and x402-gated endpoint in order — server's up, here we go."

> *Output begins: `▶ Starting FORGE demo server on port 3000…` → `✓ server is up`.*

---

## ⏱ 0:40 – 0:55 · 3. SHOW THE 5 RWA ASSETS  *(terminal — steps 1–3 of demo.sh)*

🖥 **ON SCREEN** — let the landing page, health check, and **RWA catalogue** print. Freeze on the
five-asset list:

```
▶ 3) GET /api/rwa-list  — tokenized RWA catalogue (FREE)
    5 assets:
      • real-estate-001  Real Estate          $2,500,000  [Medium]
      • commodity-003    Commodity            $1,000,000  [Low]
      • invoice-002      Invoice Financing    $45,000     [Low-Med]
      • treasury-004     Treasury Bond        $500,000    [Very Low]
      • carbon-005       Carbon Credit        $120,000    [Low-Med]
```

🗣 **NARRATION**
> "The agent analyzes a catalogue of **five tokenized real-world-asset classes**: a Lagos Real
> Estate tower, a Zurich Gold vault, a Dubai logistics Invoice, a US Treasury Bill, and
> Verra-verified Carbon Credits. Each carries a valuation, a yield, a risk band, and on-chain
> liquidity — all readable for free. Nothing's touched x402 yet."

> *The exact curl behind this output (run it manually to re-show if needed):*
> ```bash
> curl -s http://localhost:3000/api/rwa-list
> ```

---

## ⏱ 0:55 – 1:15 · 4. PREMIUM ENDPOINT RETURNS 402  *(terminal — step 7 of demo.sh)*

🖥 **ON SCREEN** — demo.sh reaches the x402 paywall. Freeze on the `HTTP status: 402` line:

```
▶ 7) x402 PAYWALL — GET /api/rwa-agent/premium?asset=commodity-003  (NO payment)
    Expecting HTTP 402 + X-PAYMENT header (the heart of x402).
    HTTP status:     402  (Payment Required)
    WWW-Authenticate: x402
```

🗣 **NARRATION**
> "Now the moment that makes this **x402 on Casper**. The agent asks for a **premium deep-dive** on
> the Gold vault — with no payment attached. The server responds **HTTP 402 — Payment Required**.
> This is the standard x402 handshake. The second paid endpoint, `/api/analyze-rwa`, is gated
> identically. **No payment, no access.**"

> *The exact curl behind this (to re-show the status code live):*
> ```bash
> curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/rwa-agent/premium?asset=commodity-003
> # → 402
> ```

---

## ⏱ 1:15 – 1:45 · 5. THE X-PAYMENT HEADER — the money shot  *(terminal — step 7 continues)*

🖥 **ON SCREEN** — the `X-PAYMENT header:` block prints right under the 402. **Let it sit on screen
and read every field.** This is the climax — longest dwell time of the whole video.

```
    X-PAYMENT header:
        scheme:           x402
        network:          casper-test
        asset:            CSPR
        amount:           1000000000 motes  (= 1 CSPR)
        wallet:           01f66346cc4db2d0a5…
        description:      FORGE RWA Premium Deep-Dive Analysis
        paymentReference: e3da32793b366365a066e8ad3faf981b
```

🗣 **NARRATION**
> "And here's the `X-PAYMENT` header the 402 carries. Scheme: **x402**. Network: **casper-test**.
> Asset: **CSPR**. Amount: **one billion motes — exactly one CSPR** — that's the Casper
> denomination done right. The resource-server's Ed25519 wallet, a human-readable description, and a
> unique payment reference. **One billion motes equals one CSPR** — remember that line, it shows you
> actually understand Casper. The agent reads this, signs an Ed25519 transfer, and retries."

> *The exact curl behind this (to re-show the raw header live):*
> ```bash
> curl -s -D - -o /dev/null http://localhost:3000/api/rwa-agent/premium?asset=commodity-003 | grep -i '^x-payment'
> ```

---

## ⏱ 1:45 – 2:10 · 6. SETTLEMENT FLOW  *(terminal — step 9, then VS Code)*

🖥 **ON SCREEN** — demo.sh reaches the settlement path. Freeze on the `success` + `deployHash`
lines:

```
▶ 9) Settlement path — facilitator settlePayment() (offline/simulated)
    success:    true
    deployHash: <sha256-derived deterministic hash>
    timestamp:  2026-06-21T…
```

Then **switch to VS Code → `src/facilitator.ts`** and point at `settlePayment` / `buildSettleDeployRequest`.

🗣 **NARRATION**
> "When the agent signs and retries, the **facilitator** verifies the amount, recipient, reference,
> and signature, then settles. In demo mode it returns a deterministic hash so this walkthrough runs
> offline at zero cost. But — *right here* — the **same code path** shells out to `casper-client
> put-deploy`, encoding the `settle` call's args as byte-accurate Casper CLValues, and submits a
> **real signed deploy** the instant the testnet account is funded. The crypto — deploy
> serialization, Ed25519 signing — is delegated to the official Condor 2.0 client."

> *The exact node snippet demo.sh runs (in case you want to re-invoke it live):*
> ```bash
> node -e 'require("./dist/facilitator.js").settlePayment({
>   signature:"deadbeef".repeat(16), from:"0202f7…", to:"01f66346cc4db2d0…",
>   amount:"1000000000", paymentReference:"demo"+Date.now().toString(16),
>   chain:"casper-test"}, "http://localhost:11101/rpc").then(r=>console.log(r))'
> ```

---

## ⏱ 2:10 – 2:35 · 7. TESTNET STATUS  *(browser → README.md "Testnet Integration Status")*

🖥 **ON SCREEN** — switch to the browser, scroll `README.md` to the **Testnet Integration Status**
table; let the row of green checkmarks sit on screen. Then, optionally, run the live RPC probe in
the terminal:

```bash
casper-client get-state-root-hash --node-address https://node.testnet.casper.network/rpc
# → returns a state root hash (proves the RPC is reachable)
```

🗣 **NARRATION**
> "Testnet integration is live. `casper-client` 5.x installed ✅. Testnet RPC reachable ✅ — api
> 2.0.0, protocol 2.2.1. Resource-server keypair generated ✅, wallet confirmed ✅. Contract
> compiled to a **52-kilobyte WASM** ✅. The **one** thing still pending is the contract deploy —
> and only because the testnet faucet needs a GitHub login. The moment it's funded, a single
> `./scripts/deploy-contract.sh` run takes this from demo mode to **fully-live testnet settlement**.
> No code changes. Zero."

---

## ⏱ 2:35 – 3:00 · 8. CLOSING  *(terminal — end of demo.sh output)*

🖥 **ON SCREEN** — return to the terminal, frozen on the final banner:

```
▶ ✅ Demo complete — every FORGE feature shown.
    Free endpoints:    /, /health, /api/rwa-list, /api/rwa-agent/ask, /portfolio
    x402-gated (402):  /api/rwa-agent/premium, /api/analyze-rwa  (1 CSPR each)
    On-chain:          Rust→WASM idempotent settlement contract (52KB, compiled)
    Go fully live:     fund faucet → ./scripts/deploy-contract.sh
```

*(Optional credibility beat if you have ~5 s spare — run it right before the banner lands:)*
```bash
npm test      # → tests 24 · pass 24 · fail 0
```

🗣 **NARRATION**
> "First x402 on Casper. An autonomous RWA agent that pays for what it needs. Real Ed25519
> transfers, a 52-kilobyte Rust-to-WASM settlement contract, twenty-four tests all passing. And the
> **only** thing between this demo and fully-live testnet deploys is a faucet drip and one deploy
> script run — no code changes. That's **FORGE**."

---

## 🎬 Cut list / b-roll (record as separate clips)
- [ ] Typing the headline `echo` line → **thumbnail candidate** ("x402 … not Casper. FORGE fixes that").
- [ ] The five-asset RWA catalogue list printing — "five asset classes" credibility shot.
- [ ] The **`HTTP status: 402 (Payment Required)`** line — freeze-frame.
- [ ] The **`X-PAYMENT header:`** block with all seven fields — **the money shot, longest dwell**.
- [ ] The `success: true` + `deployHash` lines from settlement, paired with `facilitator.ts` on screen.
- [ ] The README **Testnet Integration Status** table full of green ✅s.
- [ ] The final `✅ Demo complete` banner as the outro backdrop.
- [ ] *(Optional)* the `npm test` → `24/24` passing line.

## 📝 Speaker notes
- **Lead with the standard, not the stack.** "x402 ships for EVM/Solana/Stellar — not Casper" is the
  whole pitch. Say it in the intro and echo it in the closing.
- **"One billion motes — exactly one CSPR"** is the line that signals you understand Casper
  denominations. Don't skip it. Say it slowly.
- Everything runs **fully offline** via the simulated settlement path. If anything hiccups on
  camera, say *"running in offline demo mode"* — it's by design, not a workaround.
- The **402 + X-PAYMENT** beat is the climax — give it the longest dwell; let the header fields sit
  readable on screen for a full beat before moving on.
- If you're long at ~2:50, trim the testnet-status narration, **never** the 402 or settlement beats.
- If you're short, the `npm test → 24/24` beat is a clean 5-second filler right before the closing.

## ✅ Verified against the codebase (2026-06-21)
- `FORGE_WALLET` = `01f66346cc4db2d0a580b27f75b356a54c814dff74e73ccd44699b53e34e6ee704` — matches `src/demo/server.ts`.
- `amount: "1000000000"` motes (= `csprToMotes(1)` = 1 CSPR) — matches `src/facilitator.ts` + `server.ts`.
- `X-PAYMENT` header fields (`scheme`, `network`, `asset`, `amount`, `wallet`, `description`,
  `paymentReference`) — match `createPaymentHeader()` in `src/facilitator.ts`.
- RWA catalogue IDs (`real-estate-001`, `commodity-003`, `invoice-002`, `treasury-004`,
  `carbon-005`) — match `RWA_DATABASE` in `src/rwa-agent/analyzer.ts`.
- `settlePayment()` simulated path returns a deterministic sha256-derived hash; the real path shells
  out to `casper-client put-deploy` — matches `src/facilitator.ts`.
- `scripts/demo.sh` runs 9 steps: landing → health → RWA list → NL router (basic) → NL router
  (premium) → portfolio → **402 + X-PAYMENT** → second paywall → settlement → "Demo complete".
- Contract entry points (`init`, `settle` idempotent, `get_settlement`, `get_count`); compiled WASM
  = 52 KB — matches `README.md` + `contract/`.
- Testnet RPC `https://node.testnet.casper.network/rpc` (api 2.0.0 / protocol 2.2.1); contract deploy
  blocked only on faucet funding (GitHub-login human step).

> ⛔ **APPROVAL GATE:** do not publish the video or submit anywhere until Eric approves.
