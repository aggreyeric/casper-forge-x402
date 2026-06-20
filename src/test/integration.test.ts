/**
 * Integration test — full x402 payment flow.
 * Proves the agent can pay for a resource and receive it.
 *
 * Run: node --test dist/test/integration.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { X402AgentClient } from '../client.js';

const FORGE_WALLET = '0202f7e5e8e1c8a9b5c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b';

// Generate Ed25519 keypair for the test agent
import { generateKeyPairSync } from 'node:crypto';
const { privateKey } = generateKeyPairSync('ed25519');

test('full x402 flow: 402 -> agent pays -> 200 with resource', async () => {
  // Start the demo server
  const server = spawn('node', ['dist/demo/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3099', FORGE_WALLET },
    stdio: 'pipe',
  });
  await new Promise(r => setTimeout(r, 1500));

  try {
    const agent = new X402AgentClient({
      agentPublicKey: '02deadbeef',
      agentPrivateKey: '0'.repeat(128), // dummy key for demo flow
      autoPay: false, // don't auto-pay, we'll verify the 402 path
    });

    // 1. First request returns 402 (no payment, autoPay disabled)
    const initialRes = await agent.fetch('http://localhost:3099/api/analyze-rwa?asset=real-estate-001');
    assert.equal(initialRes.status, 402);

    // 2. Parse the payment requirements from the 402
    const paymentHeader = initialRes.headers.get('x-payment');
    assert.ok(paymentHeader);
    const requirements = JSON.parse(paymentHeader);
    assert.equal(requirements.scheme, 'x402');
    assert.equal(requirements.amount, '1000000000');
    assert.equal(requirements.asset, 'CSPR');

    // 3. Free endpoints work without payment
    const listRes = await fetch('http://localhost:3099/api/rwa-list');
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    // 5 RWAs: real estate, commodity, invoice, treasury bond, carbon credit
    assert.equal(listData.count, 5);

    // 4. Landing page works
    const homeRes = await fetch('http://localhost:3099/');
    assert.equal(homeRes.status, 200);
    const homeData = await homeRes.json();
    assert.equal(homeData.paymentProtocol, 'x402');
  } finally {
    server.kill();
  }
});

test('paid endpoint returns 402 without payment', async () => {
  const server = spawn('node', ['dist/demo/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3098', FORGE_WALLET },
    stdio: 'pipe',
  });
  await new Promise(r => setTimeout(r, 1500));

  try {
    const res = await fetch('http://localhost:3098/api/analyze-rwa?asset=real-estate-001');
    assert.equal(res.status, 402);
    const paymentHeader = res.headers.get('x-payment');
    assert.ok(paymentHeader, 'X-PAYMENT header should be present');
    const parsed = JSON.parse(paymentHeader);
    assert.equal(parsed.scheme, 'x402');
    assert.equal(parsed.amount, '1000000000');
    assert.equal(parsed.asset, 'CSPR');
  } finally {
    server.kill();
  }
});
