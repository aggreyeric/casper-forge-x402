# 🚰 FORGE — Testnet Funding Checklist

**Goal:** faucet-fund the deployer wallet → run the deploy script → contract goes live on Casper Testnet.
This is the **only human step** between "demo mode" and "fully live." ~5 minutes.

---

## Account to fund

| Field | Value |
|-------|-------|
| Public key (Ed25519) | `01f66346cc4db2d0a580b27f75b356a54c814dff74e73ccd44699b53e34e6ee704` |
| Account hash | `account-hash-9dfca1946c215658c40e58f3d02146e92fd1b12bf2368a75cf7935a3582d7d08` |
| Network | Casper Testnet (Condor 2.0) — `casper-test` |
| Minimum needed | **≥ 5 CSPR** for the one-time contract install + a buffer of **~3–5 CSPR** for per-call settlement gas. The faucet grants more than this — keep the surplus. |

### 💰 Gas budget (from README)

| Operation | Cost | Source |
|-----------|------|--------|
| Contract install (one-time, `deploy-contract.sh`) | **5 CSPR** | `--payment-amount 5000000000` (5 CSPR in motes) |
| Each premium settlement (`settlePayment()`) | **1 CSPR** per `/api/rwa-agent/premium` or `/api/analyze-rwa` call | README "Quick Start" / x402 flow |
| Demo / settlement reserve | keep a **≥ 3 CSPR** balance at all times | README "Keep the wallet topped up" |

> 👉 Target **≥ 8 CSPR** after claiming so you can deploy + run a handful of demo settlements without re-funding mid-demo.

> This is a **public key** — safe to share (and required for the DoraHacks submission, see below). The matching secret key stays in `.keys/secret_key.pem` — **never paste it anywhere**, never commit it to git, never put it in the submission.

### 👛 Wallet to use

You do **not** need the private key to *fund* this account — the faucet only needs the public key. To reach the faucet and view balances/deploys on cspr.live, either works:

- **cspr.live built-in wallet** — sign in with GitHub on https://testnet.cspr.live/. **Recommended for this checklist** (lowest friction).
- **Casper Signer** (official browser extension) — alternative if you've already imported this keypair into it. Not required.

Both connect to the same testnet; pick whichever you already have set up.

---

## Step 1 — Open the faucet & sign in

1. Go to 👉 **https://testnet.cspr.live/faucet** (exact URL — drops you straight on the Faucet page).
2. Click **Sign In** (top right) → authenticate with **GitHub**.
   - This uses the **cspr.live wallet** (GitHub-backed). **Casper Signer** (browser extension) is an alternative, but **not required** — GitHub sign-in is the simplest path.
   - The faucet's GitHub login is the human step the deploy script cannot perform for you.
3. After signing in you should land back on the **Faucet** page. If you land on the dashboard instead, re-open **https://testnet.cspr.live/faucet**.

## Step 2 — Claim CSPR for the deployer account

1. On the Faucet page (**https://testnet.cspr.live/faucet**), paste the deployer public key:
   ```
   01f66346cc4db2d0a580b27f75b356a54c814dff74e73ccd44699b53e34e6ee704
   ```
2. Click **Claim** / **Request funds**.
3. Wait ~30s for the transfer to finalize, then confirm the balance:
   - Open **https://testnet.cspr.live/account/01f66346cc4db2d0a580b27f75b356a54c814dff74e73ccd44699b53e34e6ee704**
   - Balance should show **≥ 5 CSPR** (aim for **≥ 8 CSPR** so you can deploy + demo several premium calls).

> ⚠️ If the faucet is out of funds or rate-limited, try the alternate faucet at **https://testnet.cspr.cloud/** and retry — same public key, same network.

## Step 3 — Deploy the contract

From the repo root (`casper-forge/`):

```bash
./scripts/deploy-contract.sh
```

What it does, automatically:
- ✅ **Preflight:** verifies the account exists + is funded (exits early with a clear error if not).
- ✅ Submits `put-deploy` (install) of the compiled 52KB WASM — payment 5 CSPR.
- ✅ Polls for finalization (~up to 5 min).
- ✅ Writes deploy hash + contract name + node info to **`.deploy.env`**.

If it stops at the preflight error → go back to Step 2 (account isn't funded yet).

## Step 4 — Verify the deployment

```bash
# 1. Confirm the deploy hash was recorded
cat .deploy.env

# 2. Check the deploy landed on-chain (replace with the hash from .deploy.env)
casper-client get-deploy --node-address https://node.testnet.casper.network/rpc <FORGE_DEPLOY_HASH>

# 3. Browse the account / contract on the explorer
#    https://testnet.cspr.live/account/01f66346cc4db2d0a580b27f75b356a54c814dff74e73ccd44699b53e34e6ee704
```

You should see the deploy with `"execution_results"` populated and a success status.

---

## ✅ What to expect after funding

- **`.deploy.env`** is created — the demo server + facilitator auto-read it, so no code/config changes are needed.
- **`settlePayment()` goes fully live.** Every x402 premium analysis now settles as a *real* Casper deploy with a real deploy hash (instead of the deterministic simulated hash used in demo mode).
- The premium endpoints (`/api/rwa-agent/premium`, `/api/analyze-rwa`) return a genuine **`paymentReceipt`** = on-chain deploy hash.
- Each settlement is recorded idempotently on-chain by the `settle()` entry point and queryable via `get_settlement()`.
- The code path is identical to demo mode — **only the funding + one deploy run changed.** No rebuild needed.

### Re-run the demo to prove it's live

```bash
npm run build && ./scripts/demo.sh
# Look for: real deploy hashes in paymentReceipt (not the simulated "0xSIM..." placeholder)
```

### Keep the wallet topped up
The agent pays 1 CSPR per premium call from its own balance and the contract install burns 5 CSPR. If you demo heavily, re-claim from the faucet when the balance drops below ~3 CSPR.
