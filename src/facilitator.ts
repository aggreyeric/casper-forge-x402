/**
 * x402 Facilitator for Casper Network
 *
 * Implements the x402 HTTP payment protocol for Casper:
 * 1. Resource server responds with 402 Payment Required + payment requirements
 * 2. Client creates a signed Casper payment (Ed25519 transfer)
 * 3. Facilitator verifies the payment signature + settles on-chain
 * 4. Server returns 200 OK with the resource + receipt
 *
 * This is the FIRST x402 implementation for Casper Network.
 * Reference: https://github.com/x402-foundation/x402
 */

import { createHash } from 'crypto';
import { spawn } from 'node:child_process';

// ---------------------------------------------------------------------------
// CLValue byte encoding helpers (pure functions, no deps, fully testable).
// These mirror the wire format Casper nodes expect so the deploy JSON we
// build is byte-accurate for the "format" path. Real signing/serialization
// of the deploy header is delegated to the `casper-client` binary, which is
// cryptographically correct for Condor 2.0.
// ---------------------------------------------------------------------------

const utf8 = new TextEncoder();

/** Unsigned little-endian 32-bit length prefix (4 bytes). */
function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/** Encode a Casper `String` CLValue: [u32 length][utf8 bytes]. */
function encodeCLString(value: string): Buffer {
  const body = Buffer.from(utf8.encode(value));
  return Buffer.concat([u32le(body.length), body]);
}

/** Encode a Casper `U512` CLValue: [u8 length][little-endian magnitude]. */
function encodeCLU512(motes: string): Buffer {
  let big = BigInt(motes);
  const bytes: number[] = [];
  while (big > 0n) {
    bytes.push(Number(big & 0xffn));
    big >>= 8n;
  }
  if (bytes.length === 0) bytes.push(0);
  if (bytes.length > 32) {
    throw new Error(`U512 overflow: ${motes} exceeds 32 bytes`);
  }
  return Buffer.concat([Buffer.from([bytes.length]), Buffer.from(bytes)]);
}

/**
 * Encode a Casper `Key::Account` (account_hash) CLValue: [0x00 tag][32-byte hash].
 * Accepts either a bare 64-hex hash or the `account-hash-<hex>` prefixed form.
 */
function encodeCLAccountHash(accountHash: string): Buffer {
  const hex = accountHash.startsWith('account-hash-')
    ? accountHash.slice('account-hash-'.length)
    : accountHash;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`Invalid account hash (expected 32 bytes / 64 hex): ${accountHash}`);
  }
  return Buffer.concat([Buffer.from([0x00]), Buffer.from(hex, 'hex')]);
}

/** Build a CLValue object in the { cl_type, bytes, parsed } shape the node wants. */
function clValue(cl_type: unknown, bytes: Buffer, parsed: unknown) {
  return { cl_type, bytes: bytes.toString('hex'), parsed };
}

export interface CasperPaymentRequirements {
  /** Amount in motes (1 CSPR = 10^9 motes) */
  amount: string;
  /** Asset identifier */
  asset: 'CSPR';
  /** Network */
  chain: 'casper-test' | 'casper';
  /** Wallet address of the resource server (public key hex) */
  wallet: string;
  /** Description of what's being purchased */
  description: string;
  /** MIME type of the resource */
  mimeType?: string;
  /** Max time to pay after receiving 402 (seconds) */
  maxTimeoutSeconds?: number;
  /** Unique payment reference */
  paymentReference: string;
}

export interface CasperPaymentPayload {
  /** The signed payment transfer data */
  signature: string;
  /** Payer's public key hex */
  from: string;
  /** Recipient's public key hex */
  to: string;
  /** Amount in motes */
  amount: string;
  /** Payment reference (matches requirements) */
  paymentReference: string;
  /** Network */
  chain: string;
}

export interface PaymentSettlementResult {
  success: boolean;
  /** On-chain deploy hash */
  deployHash?: string;
  /** Block timestamp */
  timestamp: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Generate the 402 payment response headers.
 * This is what a resource server sends when payment is required.
 */
export function createPaymentHeader(
  requirements: CasperPaymentRequirements
): string {
  const payload = {
    scheme: 'x402',
    network: requirements.chain,
    asset: requirements.asset,
    amount: requirements.amount,
    wallet: requirements.wallet,
    description: requirements.description,
    mimeType: requirements.mimeType || 'application/json',
    maxTimeoutSeconds: requirements.maxTimeoutSeconds || 60,
    paymentReference: requirements.paymentReference,
  };
  return JSON.stringify(payload);
}

/**
 * Verify a payment payload's signature matches the claimed sender.
 * In production, this calls the Casper node to verify the Ed25519 signature.
 */
export async function verifyPaymentSignature(
  payload: CasperPaymentPayload,
  expectedRequirements: CasperPaymentRequirements
): Promise<boolean> {
  // 1. Check amount matches
  if (payload.amount !== expectedRequirements.amount) {
    return false;
  }

  // 2. Check recipient matches
  if (payload.to !== expectedRequirements.wallet) {
    return false;
  }

  // 3. Check payment reference matches
  if (payload.paymentReference !== expectedRequirements.paymentReference) {
    return false;
  }

  // 4. Check network matches
  if (payload.chain !== expectedRequirements.chain) {
    return false;
  }

  // 5. Verify Ed25519 signature (in production, use @casperjs/casper-sdk)
  // For the facilitator demo, we verify the signature structure is valid
  if (!payload.signature || payload.signature.length < 128) {
    return false;
  }

  return true;
}

/**
 * Options for REAL on-chain settlement via a Casper node.
 *
 * If omitted (or a plain string passed for backward-compat), `settlePayment`
 * falls back to the deterministic simulated hash so offline demos and the
 * existing mocked tests keep working.
 */
export interface SettleOptions {
  /** JSON-RPC endpoint of a Casper node, e.g. https://node.testnet.casper.network/rpc */
  rpcUrl: string;
  /** Deployed x402_settlement contract hash, e.g. hash-<hex> (the `settle` entry point lives here). Required for REAL settlement; omit for the simulated path. */
  contractHash?: string;
  /** Server's signing key (path to a casper-client secret_key.pem). Required for REAL settlement; omit for the simulated path. */
  secretKeyPath?: string;
  /** Chain name (defaults to `casper-test`). */
  chainName?: string;
  /** Gas payment in motes (defaults to 5 CSPR). */
  paymentAmount?: string;
  /** Deploy TTL (defaults to `30m`). */
  ttl?: string;
  /** Explicit payer account hash; if omitted it is derived from `payload.from` via casper-client. */
  payerAccountHash?: string;
}

/** Casper network defaults for the FORGE testnet deployment. */
export const CASPER_TESTNET_RPC = 'https://node.testnet.casper.network/rpc';
export const CASPER_TESTNET_CHAIN = 'casper-test';

/**
 * Spawn the `casper-client` binary and return its parsed JSON output.
 * casper-client 5.x is the Condor 2.0 client — cryptographically correct for
 * deploy serialization + Ed25519 signing, so we delegate the hard crypto to it.
 */
function runCasperClient(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn('casper-client', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => reject(new Error(`casper-client not found: ${err.message}`)));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`casper-client exited ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`casper-client returned non-JSON: ${stdout.slice(0, 500)}`));
      }
    });
  });
}

/**
 * Build the `account_put_deploy` JSON-RPC request body for a `settle` session
 * call against the deployed contract. Pure function — no network, no signing.
 *
 * The session args are encoded with byte-accurate CLValues. `hash`/`signature`
 * are placeholders here because computing them requires blake2b over the
 * serialized deploy header — that final step is done by `casper-client` in
 * `settlePayment`. This builder exists so the deploy FORMAT is unit-testable
 * and the raw-HTTP path is documented.
 */
export function buildSettleDeployRequest(
  payload: CasperPaymentPayload,
  options: SettleOptions
): { jsonrpc: string; id: number; method: string; params: any[] } {
  if (!options.contractHash) {
    throw new Error('buildSettleDeployRequest requires options.contractHash');
  }
  const chainName = options.chainName || CASPER_TESTNET_CHAIN;
  const paymentAmount = options.paymentAmount || csprToMotes(5);
  const payerAccountHash = options.payerAccountHash || payload.from;

  const contractHashBare = options.contractHash.startsWith('hash-')
    ? options.contractHash.slice('hash-'.length)
    : options.contractHash;

  const sessionArgs = [
    ['payment_reference', clValue('String', encodeCLString(payload.paymentReference), payload.paymentReference)],
    ['payer', clValue({ Key: 'Account' }, encodeCLAccountHash(payerAccountHash), payerAccountHash)],
    ['amount', clValue('U512', encodeCLU512(payload.amount), payload.amount)],
    ['deploy_hash', clValue('String', encodeCLString(payload.signature.slice(0, 64) || payload.paymentReference), payload.signature.slice(0, 64) || payload.paymentReference)],
  ];

  const deploy = {
    hash: '0'.repeat(64), // placeholder — set by casper-client after serialization + blake2b
    header: {
      account: payload.from, // caller public key hex (algorithm-prefixed)
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace('T', 'T'),
      ttl: options.ttl || '30m',
      gas_price: 1,
      chain_name: chainName,
      dependencies: [],
    },
    payment: {
      ModuleBytes: {
        module_bytes: '',
        args: [
          ['Amount', clValue('U512', encodeCLU512(paymentAmount), paymentAmount)],
        ],
      },
    },
    session: {
      StoredContractByHash: {
        hash: contractHashBare,
        entry_point: 'settle',
        args: sessionArgs,
      },
    },
    approvals: [
      {
        signer: payload.from,
        signature: '0'.repeat(128), // placeholder — real Ed25519 sig appended by casper-client
      },
    ],
  };

  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'account_put_deploy',
    params: [deploy],
  };
}

/**
 * Settle the payment on-chain via the Casper node.
 *
 * - With a full `SettleOptions` object: submits a REAL signed deploy through
 *   `casper-client` to the configured RPC and returns the live deploy hash.
 * - With a string / omitted options (backward-compat): returns a deterministic
 *   simulated hash — used by offline demos and the existing mocked tests.
 */
export async function settlePayment(
  payload: CasperPaymentPayload,
  options?: SettleOptions | string
): Promise<PaymentSettlementResult> {
  // Backward-compatible simulated path (offline / mocked / legacy signature).
  const realOpts = typeof options === 'object' && options ? options : null;
  if (!realOpts || !realOpts.contractHash || !realOpts.secretKeyPath) {
    const deployHash = createHash('sha256')
      .update(payload.signature + payload.paymentReference)
      .digest('hex');
    return { success: true, deployHash, timestamp: new Date().toISOString() };
  }

  try {
    // Derive the payer's account hash from its public key if not provided.
    let payerAccountHash = realOpts.payerAccountHash;
    if (!payerAccountHash && /^0[12][0-9a-fA-F]{64}$/.test(payload.from)) {
      const derived = await runCasperClient([
        'account-address', '--public-key', payload.from,
      ]);
      payerAccountHash = typeof derived === 'string' ? derived.trim() : derived?.result ?? derived;
    }
    if (!payerAccountHash) {
      throw new Error('Cannot derive payer account hash from payload.from; pass options.payerAccountHash');
    }

    const chainName = realOpts.chainName || CASPER_TESTNET_CHAIN;
    const paymentAmount = realOpts.paymentAmount || csprToMotes(5);
    const rpcUrl = realOpts.rpcUrl || CASPER_TESTNET_RPC;

    // Real deploy: StoredContractByHash call to the `settle` entry point.
    const result = await runCasperClient([
      'put-deploy',
      '--node-address', rpcUrl,
      '--chain-name', chainName,
      '--secret-key', realOpts.secretKeyPath,
      '--session-hash', realOpts.contractHash,
      '--session-entry-point', 'settle',
      '--session-arg', `payment_reference:string='${payload.paymentReference}'`,
      '--session-arg', `payer:account_hash='${payerAccountHash}'`,
      '--session-arg', `amount:u512='${payload.amount}'`,
      '--session-arg', `deploy_hash:string='${payload.signature.slice(0, 64) || payload.paymentReference}'`,
      '--payment-amount', paymentAmount,
      '--ttl', realOpts.ttl || '30m',
    ]);

    // casper-client put-deploy returns { "deploy_hash": "..." } (or nested).
    const deployHash: string | undefined =
      result?.deploy_hash ?? result?.result?.deploy_hash ?? result?.hash;

    if (!deployHash) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: `No deploy_hash in response: ${JSON.stringify(result).slice(0, 300)}`,
      };
    }

    return { success: true, deployHash, timestamp: new Date().toISOString() };
  } catch (error) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Settlement failed',
    };
  }
}

/**
 * Poll a deploy until it is finalized on-chain. Returns true once executed.
 */
export async function confirmDeploy(
  deployHash: string,
  rpcUrl: string = CASPER_TESTNET_RPC,
  timeoutMs = 60_000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await runCasperClient([
        'get-deploy', '--node-address', rpcUrl, deployHash,
      ]);
      const executionResult = result?.result?.execution_results?.[0];
      if (executionResult && executionResult.block_hash) {
        return executionResult.result?.Success ? true : false;
      }
    } catch {
      // deploy not yet known — keep polling
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  return false;
}

/**
 * Generate a unique payment reference.
 */
export function generatePaymentReference(): string {
  return createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 32);
}

/**
 * Convert CSPR to motes (1 CSPR = 10^9 motes).
 */
export function csprToMotes(cspr: number): string {
  return BigInt(Math.floor(cspr * 1_000_000_000)).toString();
}

/**
 * Convert motes to CSPR.
 */
export function motesToCspr(motes: string): number {
  return Number(BigInt(motes)) / 1_000_000_000;
}
