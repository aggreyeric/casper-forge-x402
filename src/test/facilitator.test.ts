/**
 * Tests for x402 Casper Facilitator
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  createPaymentHeader,
  verifyPaymentSignature,
  generatePaymentReference,
  csprToMotes,
  motesToCspr,
  settlePayment,
  buildSettleDeployRequest,
  type CasperPaymentRequirements,
  type CasperPaymentPayload,
  type SettleOptions,
} from '../facilitator.js';

test('csprToMotes converts correctly', () => {
  assert.equal(csprToMotes(1), '1000000000');
  assert.equal(csprToMotes(0.5), '500000000');
  assert.equal(csprToMotes(10), '10000000000');
});

test('motesToCspr converts correctly', () => {
  assert.equal(motesToCspr('1000000000'), 1);
  assert.equal(motesToCspr('500000000'), 0.5);
});

test('generatePaymentReference produces unique 32-char hex', () => {
  const ref1 = generatePaymentReference();
  const ref2 = generatePaymentReference();
  assert.equal(ref1.length, 32);
  assert.notEqual(ref1, ref2);
  assert.match(ref1, /^[0-9a-f]{32}$/);
});

test('createPaymentHeader produces valid JSON with x402 scheme', () => {
  const req: CasperPaymentRequirements = {
    amount: '1000000000',
    asset: 'CSPR',
    chain: 'casper-test',
    wallet: '02abc',
    description: 'RWA Analysis',
    paymentReference: 'abc123',
  };
  const header = createPaymentHeader(req);
  const parsed = JSON.parse(header);
  assert.equal(parsed.scheme, 'x402');
  assert.equal(parsed.network, 'casper-test');
  assert.equal(parsed.asset, 'CSPR');
  assert.equal(parsed.amount, '1000000000');
  assert.equal(parsed.wallet, '02abc');
});

test('verifyPaymentSignature rejects mismatched amount', async () => {
  const req: CasperPaymentRequirements = {
    amount: '1000000000',
    asset: 'CSPR',
    chain: 'casper-test',
    wallet: '02abc',
    description: 'Test',
    paymentReference: 'ref1',
  };
  const payload: CasperPaymentPayload = {
    signature: 'a'.repeat(128),
    from: '02def',
    to: '02abc',
    amount: '2000000000',
    paymentReference: 'ref1',
    chain: 'casper-test',
  };
  const valid = await verifyPaymentSignature(payload, req);
  assert.equal(valid, false);
});

test('verifyPaymentSignature rejects wrong recipient', async () => {
  const req: CasperPaymentRequirements = {
    amount: '1000000000',
    asset: 'CSPR',
    chain: 'casper-test',
    wallet: '02abc',
    description: 'Test',
    paymentReference: 'ref1',
  };
  const payload: CasperPaymentPayload = {
    signature: 'a'.repeat(128),
    from: '02def',
    to: '02WRONG',
    amount: '1000000000',
    paymentReference: 'ref1',
    chain: 'casper-test',
  };
  const valid = await verifyPaymentSignature(payload, req);
  assert.equal(valid, false);
});

test('verifyPaymentSignature accepts valid payment', async () => {
  const req: CasperPaymentRequirements = {
    amount: '1000000000',
    asset: 'CSPR',
    chain: 'casper-test',
    wallet: '02abc',
    description: 'Test',
    paymentReference: 'ref1',
  };
  const payload: CasperPaymentPayload = {
    signature: 'a'.repeat(128),
    from: '02def',
    to: '02abc',
    amount: '1000000000',
    paymentReference: 'ref1',
    chain: 'casper-test',
  };
  const valid = await verifyPaymentSignature(payload, req);
  assert.equal(valid, true);
});

test('settlePayment returns success with deploy hash', async () => {
  const payload: CasperPaymentPayload = {
    signature: 'a'.repeat(128),
    from: '02def',
    to: '02abc',
    amount: '1000000000',
    paymentReference: 'ref1',
    chain: 'casper-test',
  };
  const result = await settlePayment(payload, 'http://localhost:11101/rpc');
  assert.equal(result.success, true);
  assert.ok(result.deployHash);
  assert.ok(result.timestamp);
});

test('settlePayment with full options builds a REAL Casper settle deploy (JSON format)', () => {
  const payload: CasperPaymentPayload = {
    signature: 'deadbeef'.repeat(16), // 64 hex chars (deploy_hash arg is truncated to 64)
    from: '0202f7e5e8e1c8a9b5c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b',
    to: '02abc',
    amount: '1000000000', // 1 CSPR in motes
    paymentReference: 'abc123def456',
    chain: 'casper-test',
  };
  const options: SettleOptions = {
    rpcUrl: 'https://node.testnet.casper.network/rpc',
    contractHash: 'hash-09d8e0bf3c434f0a9b7e6f5d4c3b2a1908070605040302010001020304050607',
    secretKeyPath: '/tmp/secret_key.pem',
    payerAccountHash: 'account-hash-16a93b89009158149a06a007d5e616da93dffe2069406ed7f63c1a31c6b558be',
  };

  const req = buildSettleDeployRequest(payload, options);

  // JSON-RPC envelope
  assert.equal(req.jsonrpc, '2.0');
  assert.equal(req.method, 'account_put_deploy');
  assert.ok(Array.isArray(req.params));
  assert.equal(req.params.length, 1);

  const deploy = req.params[0];

  // Header
  assert.equal(deploy.header.chain_name, 'casper-test');
  assert.equal(deploy.header.account, payload.from);
  assert.equal(deploy.header.ttl, '30m');

  // Payment: ModuleBytes with an Amount U512 (default 5 CSPR = 5e9 motes)
  assert.ok(deploy.payment.ModuleBytes);
  const payArg = deploy.payment.ModuleBytes.args[0];
  assert.equal(payArg[0], 'Amount');
  assert.equal(payArg[1].cl_type, 'U512');
  assert.equal(payArg[1].parsed, '5000000000');
  // 5_000_000_000 = 0x12A05F200 -> 5 bytes LE: [0x00,0xF2,0x05,0x2A,0x01], prefixed by length byte 0x05
  assert.equal(payArg[1].bytes, '0500f2052a01');

  // Session: StoredContractByHash call to the `settle` entry point
  assert.ok(deploy.session.StoredContractByHash);
  const sess = deploy.session.StoredContractByHash;
  assert.equal(sess.entry_point, 'settle');
  assert.equal(sess.hash, '09d8e0bf3c434f0a9b7e6f5d4c3b2a1908070605040302010001020304050607');
  assert.equal(sess.args.length, 4);

  // Arg 0: payment_reference (String) — bytes = [u32 len][utf8]
  assert.equal(sess.args[0][0], 'payment_reference');
  assert.equal(sess.args[0][1].cl_type, 'String');
  assert.equal(sess.args[0][1].parsed, 'abc123def456');
  assert.equal(sess.args[0][1].bytes,
    Buffer.concat([Buffer.from([0x0c, 0x00, 0x00, 0x00]), Buffer.from('abc123def456')]).toString('hex'));

  // Arg 1: payer (Key::Account) — bytes = [0x00 tag][32-byte hash]
  assert.equal(sess.args[1][0], 'payer');
  assert.deepEqual(sess.args[1][1].cl_type, { Key: 'Account' });
  assert.equal(sess.args[1][1].bytes.slice(0, 2), '00'); // Account variant tag
  assert.equal(sess.args[1][1].bytes.length, 66); // 0x00 + 64 hex chars (32 bytes)

  // Arg 2: amount (U512) — 1_000_000_000 = 0x3B9ACA00 -> 4 bytes LE
  assert.equal(sess.args[2][0], 'amount');
  assert.equal(sess.args[2][1].cl_type, 'U512');
  assert.equal(sess.args[2][1].parsed, '1000000000');
  assert.equal(sess.args[2][1].bytes, Buffer.from([4, 0x00, 0xca, 0x9a, 0x3b]).toString('hex'));

  // Arg 3: deploy_hash (String) — truncated from signature to 64 chars
  assert.equal(sess.args[3][0], 'deploy_hash');
  assert.equal(sess.args[3][1].cl_type, 'String');
  assert.equal(sess.args[3][1].parsed.length, 64);

  // Approvals slot present (real sig filled by casper-client at submit time)
  assert.ok(Array.isArray(deploy.approvals));
  assert.equal(deploy.approvals.length, 1);
});

test('settlePayment falls back to simulated hash when options are incomplete', async () => {
  const payload: CasperPaymentPayload = {
    signature: 'f'.repeat(128),
    from: '02def',
    to: '02abc',
    amount: '1000000000',
    paymentReference: 'ref-sim',
    chain: 'casper-test',
  };
  // Missing contractHash/secretKeyPath -> simulated path (no network).
  const result = await settlePayment(payload, {
    rpcUrl: 'https://node.testnet.casper.network/rpc',
  });
  assert.equal(result.success, true);
  assert.match(result.deployHash!, /^[0-9a-f]{64}$/);
});
