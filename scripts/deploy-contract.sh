#!/usr/bin/env bash
#
# Deploy the FORGE x402_settlement.wasm contract to Casper Testnet (Condor 2.0).
#
# Prereqs:
#   - casper-client 5.x installed (cargo install casper-client-rs --bin casper-client)
#   - keys generated:    casper-client keygen .keys
#   - account FUNDED via the testnet faucet: https://testnet.cspr.live/  (GitHub login)
#     (or cspr.live / cspr.cloud faucet)
#
# Usage:
#   ./scripts/deploy-contract.sh
#
# On success it writes the deploy hash + contract hash to .deploy.env so the
# facilitator / demo server can read them.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WASM="$ROOT/contract/target/wasm32-unknown-unknown/release/x402_settlement.wasm"
KEYS="$ROOT/.keys"
SECRET_KEY="$KEYS/secret_key.pem"
NODE="https://node.testnet.casper.network/rpc"
CHAIN="casper-test"
PAYMENT=${PAYMENT_AMOUNT:-5000000000}   # 5 CSPR for install
CONTRACT_NAME=${CONTRACT_NAME:-forge_x402}

echo "=== FORGE contract deployment ==="
echo "WASM:       $WASM"
echo "Node:       $NODE"
echo "Chain:      $CHAIN"
echo "Contract:   $CONTRACT_NAME"
echo

[ -f "$WASM" ] || { echo "ERROR: WASM not found. Run 'cargo build --release' in contract/ first."; exit 1; }
[ -f "$SECRET_KEY" ] || { echo "ERROR: secret_key.pem not found. Run 'casper-client keygen .keys' first."; exit 1; }

# --- Preflight: check the account exists + is funded ---
echo "--- preflight: checking account is funded ---"
PK_HEX="$(cat "$KEYS/public_key_hex")"
BAL=$(curl -s -X POST "$NODE" -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"state_get_account_info\",\"params\":{\"public_key\":\"$PK_HEX\"}}" || true)
if echo "$BAL" | grep -q '"No such account"'; then
  echo "ERROR: account $PK_HEX is not funded on testnet."
  echo "       Fund it via the faucet (GitHub login required): https://testnet.cspr.live/"
  exit 2
fi
echo "account OK."

# --- Submit the install deploy ---
echo "--- submitting put-deploy (install) ---"
DEPLOY_JSON=$(casper-client put-deploy \
  --node-address "$NODE" \
  --chain-name "$CHAIN" \
  --secret-key "$SECRET_KEY" \
  --session-path "$WASM" \
  --payment-amount "$PAYMENT" \
  --session-arg "name:string='$CONTRACT_NAME'" \
  --output-json)

DEPLOY_HASH=$(echo "$DEPLOY_JSON" | sed -n 's/.*"deploy_hash": *"\([0-9a-f]*\)".*/\1/p' | head -1)
echo "deploy_hash: $DEPLOY_HASH"

# --- Poll for finalization (up to ~5 min) ---
echo "--- waiting for finalization ---"
for i in $(seq 1 60); do
  sleep 5
  RES=$(casper-client get-deploy --node-address "$NODE" "$DEPLOY_HASH" 2>/dev/null || true)
  if echo "$RES" | grep -q '"execution_results"'; then
    echo "deploy executed!"
    break
  fi
  [ $((i % 6)) -eq 0 ] && echo "  ...still waiting (${i}x5s)"
done

# --- Record outputs ---
{
  echo "FORGE_DEPLOY_HASH=$DEPLOY_HASH"
  echo "FORGE_CONTRACT_NAME=$CONTRACT_NAME"
  echo "FORGE_NODE=$NODE"
  echo "FORGE_CHAIN=$CHAIN"
  echo "FORGE_PUBLIC_KEY=$PK_HEX"
} > "$ROOT/.deploy.env"

echo
echo "=== DONE ==="
echo "Saved deploy metadata to .deploy.env"
echo "Deploy hash:  $DEPLOY_HASH"
echo "View:         https://testnet.cspr.live/deploy/$DEPLOY_HASH"
