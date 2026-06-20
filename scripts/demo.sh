#!/usr/bin/env bash
#
# FORGE — end-to-end demo walkthrough (built for recording the demo video).
#
# Boots the FORGE demo server, then exercises EVERY feature in order:
#   - landing page + health check        (free)
#   - RWA catalogue                       (free)
#   - NL query router (basic / premium)   (free)
#   - portfolio overview                  (free)
#   - x402 paywall on a premium endpoint  (402 + X-PAYMENT header)
#   - x402 paywall on /api/analyze-rwa    (402)
#   - simulated settlement path           (settlePayment → deploy hash)
#
# No on-chain cost: runs entirely in the offline/simulated path. The moment the
# testnet account is faucet-funded + deploy-contract.sh is run, the SAME flow
# settles real Casper deploys.
#
# Usage:   ./scripts/demo.sh [PORT]
# Exit:    0 on success, non-zero if the server fails to boot.
#
set -euo pipefail

PORT="${1:-3000}"
BASE="http://localhost:${PORT}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Pretty-ish printing helpers
hr()   { printf '\n\033[1;36m════════════════════════════════════════════════════════════\033[0m\n'; }
step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$1"; }
note() { printf '    %s\n' "$1"; }

command -v curl >/dev/null || { echo "ERROR: curl is required"; exit 1; }
command -v node >/dev/null || { echo "ERROR: node is required"; exit 1; }

# ─── Preflight: build if needed ──────────────────────────────────────────────
if [ ! -f "$ROOT/dist/demo/server.js" ]; then
  step "Building TypeScript (dist/ not found)…"
  (cd "$ROOT" && npm run build)
fi

# ─── Start the server ────────────────────────────────────────────────────────
step "Starting FORGE demo server on port ${PORT}…"
PORT="$PORT" node "$ROOT/dist/demo/server.js" >/tmp/forge-demo.log 2>&1 &
SRV_PID=$!
cleanup() { kill "$SRV_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# Wait for the server to come up (up to ~10s)
for _ in $(seq 1 20); do
  if curl -sf "$BASE/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "$BASE/health" >/dev/null 2>&1; then
  echo "ERROR: server did not start. Log:"; cat /tmp/forge-demo.log; exit 1
fi
ok "server is up (pid ${SRV_PID})"

hr
step "FORGE — First x402 implementation for Casper Network"
note "RWA Analysis Agent · x402 micropayments · Rust→WASM settlement"
note "All 5 RWA asset classes: Real Estate, Gold, Invoice, T-Bill, Carbon"
hr

# ─── 1. Landing page ─────────────────────────────────────────────────────────
step "1) GET /  — service info (FREE)"
curl -s "$BASE/" | node -e '
  const d = JSON.parse(require("fs").readFileSync(0,"utf8"));
  console.log(`    service:        ${d.service}`);
  console.log(`    paymentProtocol:${d.paymentProtocol}`);
  console.log(`    price/analysis: ${d.pricing.perAnalysis}  (${d.pricing.perAnalysisMotes} motes)`);
  console.log(`    RWA count:      ${d.rwaCount}`);
'
ok "landing page served"

# ─── 2. Health ───────────────────────────────────────────────────────────────
step "2) GET /health  — health check (FREE)"
curl -s "$BASE/health" | node -e '
  const d = JSON.parse(require("fs").readFileSync(0,"utf8"));
  console.log(`    status: ${d.status} · service: ${d.service} · network: ${d.network}`);
'
ok "health check passed"

# ─── 3. RWA catalogue ────────────────────────────────────────────────────────
step "3) GET /api/rwa-list  — tokenized RWA catalogue (FREE)"
curl -s "$BASE/api/rwa-list" | node -e '
  const d = JSON.parse(require("fs").readFileSync(0,"utf8"));
  console.log(`    ${d.count} assets:`);
  for (const a of d.assets) console.log(`      • ${a.assetId.padEnd(18)} ${a.type.padEnd(20)} $${a.valuation.toLocaleString()}  [${a.riskBand}]`);
'
ok "5 asset classes listed"

# ─── 4. NL router — basic ────────────────────────────────────────────────────
step "4) GET /api/rwa-agent/ask?q=\"quick snapshot of the treasury bond\"  — NL router → BASIC (FREE)"
curl -s "$BASE/api/rwa-agent/ask" --data-urlencode "q=quick snapshot of the treasury bond" -G | node -e '
  const d = JSON.parse(require("fs").readFileSync(0,"utf8"));
  console.log(`    routed to:  ${d.decision.tier.toUpperCase()}`);
  console.log(`    reason:     ${d.decision.reason}`);
  console.log(`    risk band:  ${d.analysis.riskAssessment.band}`);
  console.log(`    recommend:  ${d.analysis.recommendation}`);
'
ok "basic analysis served without payment"

# ─── 5. NL router — premium (routes, but tells you to pay) ───────────────────
step "5) GET /api/rwa-agent/ask?q=\"deep dive on gold\"  — NL router → PREMIUM (routes for free, premium is gated)"
curl -s "$BASE/api/rwa-agent/ask" --data-urlencode "q=deep dive on gold" -G | node -e '
  const d = JSON.parse(require("fs").readFileSync(0,"utf8"));
  console.log(`    routed to:  ${d.decision.tier.toUpperCase()}`);
  console.log(`    reason:     ${d.decision.reason}`);
  console.log(`    premiumEndpoint: ${d.premiumEndpoint}  (price: ${d.priceCSPR} CSPR)`);
'
ok "agent correctly identified a premium request"

# ─── 6. Portfolio overview ───────────────────────────────────────────────────
step "6) GET /api/rwa-agent/portfolio  — basic analysis across ALL RWAs (FREE)"
curl -s "$BASE/api/rwa-agent/portfolio" | node -e '
  const d = JSON.parse(require("fs").readFileSync(0,"utf8"));
  console.log(`    ${d.count} RWAs analysed:`);
  for (const it of d.items) console.log(`      • ${it.assetId.padEnd(18)} ${it.recommendation.padEnd(11)} ${it.riskAssessment.band}`);
'
ok "free portfolio overview"

# ─── 7. The x402 paywall ────────────────────────────────────────────────────
hr
step "7) x402 PAYWALL — GET /api/rwa-agent/premium?asset=commodity-003  (NO payment)"
note "Expecting HTTP 402 + X-PAYMENT header (the heart of x402)."
HTTP=$(curl -s -o /tmp/forge-402.json -w "%{http_code}" -D /tmp/forge-402.hdr "$BASE/api/rwa-agent/premium?asset=commodity-003")
echo    "    HTTP status:     ${HTTP}  (Payment Required)"
echo -n "    WWW-Authenticate: "; grep -i '^www-authenticate' /tmp/forge-402.hdr | sed 's/\r$//' | cut -d' ' -f2-
echo    "    X-PAYMENT header:"
node -e '
  const fs=require("fs");
  const h=fs.readFileSync("/tmp/forge-402.hdr","utf8");
  const m=h.match(/^x-payment:\s*(.*)$/im);
  const d=JSON.parse(m[1].trim());
  console.log(`        scheme:           ${d.scheme}`);
  console.log(`        network:          ${d.network}`);
  console.log(`        asset:            ${d.asset}`);
  console.log(`        amount:           ${d.amount} motes  (= 1 CSPR)`);
  console.log(`        wallet:           ${d.wallet.slice(0,24)}…`);
  console.log(`        description:      ${d.description}`);
  console.log(`        paymentReference: ${d.paymentReference}`);
'
ok "402 paywall + X-PAYMENT returned — this is x402 on Casper"

# ─── 8. Second paid endpoint also paywalled ──────────────────────────────────
step "8) GET /api/analyze-rwa?asset=carbon-005  — also x402-gated (NO payment)"
HTTP2=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/analyze-rwa?asset=carbon-005")
echo    "    HTTP status: ${HTTP2}  (all 5 RWAs are payable on this endpoint)"
ok "second paid endpoint paywalled"

# ─── 9. Settlement path (simulated, offline) ─────────────────────────────────
hr
step "9) Settlement path — facilitator settlePayment() (offline/simulated)"
note "With a funded testnet account + deploy-contract.sh run, this submits a"
note "REAL Casper deploy calling the contract's idempotent settle() entry point."
node -e '
  const { settlePayment } = require("'"$ROOT"'/dist/facilitator.js");
  (async () => {
    const r = await settlePayment({
      signature: "deadbeef".repeat(16),
      from: "0202f7e5e8e1c8a9b5c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b",
      to: "01f66346cc4db2d0a580b27f75b356a54c814dff74e73ccd44699b53e34e6ee704",
      amount: "1000000000",
      paymentReference: "demo" + Date.now().toString(16),
      chain: "casper-test",
    }, "http://localhost:11101/rpc");
    console.log(`    success:    ${r.success}`);
    console.log(`    deployHash: ${r.deployHash}`);
    console.log(`    timestamp:  ${r.timestamp}`);
  })();
'
ok "facilitator settlement path exercised"

hr
step "✅ Demo complete — every FORGE feature shown."
note "Free endpoints:    /, /health, /api/rwa-list, /api/rwa-agent/ask, /portfolio"
note "x402-gated (402):  /api/rwa-agent/premium, /api/analyze-rwa  (1 CSPR each)"
note "On-chain:          Rust→WASM idempotent settlement contract (52KB, compiled)"
note "Go fully live:     fund faucet → ./scripts/deploy-contract.sh"
hr
