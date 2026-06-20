/**
 * x402 Payment Middleware for Express
 *
 * Express middleware that enforces x402 payment for protected routes.
 * When a request comes in without a valid payment, it returns 402.
 * When payment is included, it verifies + settles + passes through.
 *
 * Usage:
 *   app.get('/api/analyze-rwa', x402Middleware({ amount: '1000000000', ... }), handler);
 */

import type { Request, Response, NextFunction } from 'express';
import {
  createPaymentHeader,
  verifyPaymentSignature,
  settlePayment,
  generatePaymentReference,
  type CasperPaymentRequirements,
  type CasperPaymentPayload,
} from './facilitator.js';

export interface X402MiddlewareOptions {
  /** Amount in motes (1 CSPR = 10^9 motes) */
  amount: string;
  /** Resource server wallet (Casper public key hex) */
  wallet: string;
  /** Description of the resource */
  description: string;
  /** MIME type */
  mimeType?: string;
  /** Network */
  chain?: 'casper-test' | 'casper';
  /** Casper RPC endpoint for settlement */
  rpcEndpoint?: string;
}

export function x402Middleware(options: X402MiddlewareOptions) {
  const requirements: Omit<CasperPaymentRequirements, 'paymentReference'> = {
    amount: options.amount,
    asset: 'CSPR',
    chain: options.chain || 'casper-test',
    wallet: options.wallet,
    description: options.description,
    mimeType: options.mimeType || 'application/json',
    maxTimeoutSeconds: 60,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if payment signature is included in headers
    const paymentHeader = req.headers['x-payment-signature'] as string | undefined;

    if (!paymentHeader) {
      // No payment — return 402
      const paymentReference = generatePaymentReference();
      const fullRequirements: CasperPaymentRequirements = {
        ...requirements,
        paymentReference,
      };

      // Store the payment reference for this request (for verification)
      (req as any).paymentReference = paymentReference;

      res.setHeader('WWW-Authenticate', 'x402');
      res.setHeader('X-PAYMENT', createPaymentHeader(fullRequirements));
      res.status(402).json({
        error: 'Payment Required',
        x402Version: 1,
        accepts: fullRequirements,
        instructions: {
          '1': 'Create a Casper transfer with the specified amount to the wallet address',
          '2': 'Sign the transfer with your Ed25519 private key',
          '3': 'Send the payment payload in the X-PAYMENT-SIGNATURE header',
          '4': 'Retry this request with the payment header',
        },
      });
      return;
    }

    // Payment included — verify and settle
    try {
      const payload: CasperPaymentPayload = JSON.parse(paymentHeader);

      // Verify against the expected requirements
      const expectedRequirements: CasperPaymentRequirements = {
        ...requirements,
        paymentReference: payload.paymentReference,
      };

      const isValid = await verifyPaymentSignature(payload, expectedRequirements);
      if (!isValid) {
        res.status(402).json({
          error: 'Payment verification failed',
          detail: 'Signature or payment details do not match requirements',
        });
        return;
      }

      // Settle the payment on-chain
      const settlement = await settlePayment(
        payload,
        options.rpcEndpoint || 'http://localhost:11101/rpc'
      );

      if (!settlement.success) {
        res.status(500).json({
          error: 'Payment settlement failed',
          detail: settlement.error,
        });
        return;
      }

      // Payment verified + settled — attach receipt and continue
      (req as any).paymentReceipt = {
        deployHash: settlement.deployHash,
        timestamp: settlement.timestamp,
        amount: payload.amount,
        from: payload.from,
        reference: payload.paymentReference,
      };

      next();
    } catch (error) {
      res.status(400).json({
        error: 'Invalid payment payload',
        detail: error instanceof Error ? error.message : 'Parse error',
      });
    }
  };
}
