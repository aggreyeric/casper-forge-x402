/**
 * x402 Client for AI Agents
 *
 * Enables an AI agent to automatically pay for services via x402.
 * When the agent requests a paid resource, it:
 * 1. Receives a 402 response with payment requirements
 * 2. Creates + signs a Casper payment transfer
 * 3. Retries the request with the payment payload
 * 4. Receives the resource + payment receipt
 *
 * Usage:
 *   const client = new X402AgentClient({
 *     agentPublicKey: '0x...',
 *     agentPrivateKey: process.env.CASPER_PRIVATE_KEY,
 *   });
 *   const data = await client.fetch('https://forge-agent.com/api/analyze-rwa');
 */

import { createHash, sign } from 'crypto';
import type { CasperPaymentRequirements, CasperPaymentPayload } from './facilitator.js';

export interface X402AgentClientOptions {
  /** Agent's Casper public key (hex) */
  agentPublicKey: string;
  /** Agent's Ed25519 private key (hex) */
  agentPrivateKey: string;
  /** Max payment per request (in motes) — safety limit */
  maxPaymentMotes?: string;
  /** Auto-pay if under limit */
  autoPay: boolean;
}

export class X402AgentClient {
  private publicKey: string;
  private privateKey: string;
  private maxPayment: bigint;
  private autoPay: boolean;

  constructor(options: X402AgentClientOptions) {
    this.publicKey = options.agentPublicKey;
    this.privateKey = options.agentPrivateKey;
    this.maxPayment = BigInt(options.maxPaymentMotes || '10000000000'); // 10 CSPR default
    this.autoPay = options.autoPay;
  }

  /**
   * Fetch a resource, automatically handling x402 payments.
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    // First attempt — no payment
    const initialResponse = await fetch(url, options);

    if (initialResponse.status !== 402) {
      return initialResponse;
    }

    // Got 402 — parse payment requirements
    const paymentHeader = initialResponse.headers.get('x-payment');
    if (!paymentHeader) {
      throw new Error('Received 402 but no X-PAYMENT header found');
    }

    const requirements: CasperPaymentRequirements = JSON.parse(paymentHeader);

    // Safety check — don't pay more than the limit
    const requestedAmount = BigInt(requirements.amount);
    if (requestedAmount > this.maxPayment) {
      throw new Error(
        `Payment amount ${requirements.amount} motes exceeds max limit ${this.maxPayment}`
      );
    }

    // Auto-pay check
    if (!this.autoPay) {
      // Return the 402 to let the agent/user decide
      return initialResponse;
    }

    // Create the payment payload
    const payload = await this.createPayment(requirements);

    // Retry with payment signature
    const paidResponse = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        'X-PAYMENT-SIGNATURE': JSON.stringify(payload),
      },
    });

    return paidResponse;
  }

  /**
   * Create a signed payment payload for the given requirements.
   * In production, this creates + signs a real Casper deploy.
   */
  private async createPayment(
    requirements: CasperPaymentRequirements
  ): Promise<CasperPaymentPayload> {
    // Create the transfer message to sign
    const message = JSON.stringify({
      to: requirements.wallet,
      amount: requirements.amount,
      reference: requirements.paymentReference,
      chain: requirements.chain,
      timestamp: Date.now(),
    });

    // Sign with Ed25519 (Casper's signature scheme)
    // In production: use @casperjs/casper-sdk to create a proper signed deploy
    const messageBuffer = Buffer.from(message, 'utf8');
    const signature = this.signMessage(messageBuffer);

    return {
      signature: signature.toString('hex'),
      from: this.publicKey,
      to: requirements.wallet,
      amount: requirements.amount,
      paymentReference: requirements.paymentReference,
      chain: requirements.chain,
    };
  }

  /**
   * Sign a message with the Ed25519 private key.
   */
  private signMessage(message: Buffer): Buffer {
    // In production: use the Casper SDK's signing utilities
    // For demo: create a deterministic signature from the private key
    const keyBuffer = Buffer.from(this.privateKey, 'hex');
    return sign(null, message, keyBuffer);
  }

  /**
   * Get the agent's public key (for display/debugging).
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}
