/**
 * RWA Agent — the autonomous AI agent for the FORGE demo.
 *
 * This is the "brain": it takes a natural-language query, decides which
 * analysis to run, and — for premium/deep-dive requests — pays for the
 * premium tier via x402 using the X402AgentClient. Basic queries are served
 * for free (mirroring a real metered AI service).
 *
 * It is intentionally model-agnostic: there is no external LLM call in the
 * default path (the "decide which analysis to run" step is a deterministic
 * rule-based router so the demo runs offline). An LLM can be plugged into
 * `AgentOptions.analyze` to upgrade the router; the x402 payment path is the
 * same either way.
 *
 * Lifecycle of a premium query:
 *   1. route() decides tier (basic | premium) + target asset(s)
 *   2. if premium → client.fetch(premiumEndpoint) — client auto-pays via x402
 *   3. the FORGE demo server (server.ts) serves the premium analysis once paid
 *   4. agent returns a unified AgentResult to the caller
 */

import {
  ALL_ASSETS, RWA_DATABASE, getAsset, listAssets,
  analyzeBasic, analyzePremium, riskBand, recommend,
  impliedValuation, lockupPenalty,
  type AssetClass, type RwaAsset, type BasicAnalysis, type PremiumAnalysis,
} from './analyzer.js';
import { X402AgentClient } from '../client.js';

export type Tier = 'basic' | 'premium' | 'portfolio';

export interface RouteDecision {
  tier: Tier;
  assetId: string | null;      // null for portfolio-wide queries
  reason: string;
}

export interface AgentResult {
  query: string;
  tier: Tier;
  decision: RouteDecision;
  /** Present for basic/premium single-asset queries. */
  analysis?: BasicAnalysis | PremiumAnalysis;
  /** Present for portfolio queries. */
  portfolio?: { count: number; items: BasicAnalysis[] };
  /** When premium required an x402 payment, the resulting settlement info. */
  payment?: { paid: boolean; deployHash?: string; error?: string; endpoint?: string };
  timestamp: string;
}

export interface AgentOptions {
  /** Base URL of the FORGE demo server that hosts paid endpoints. */
  serverUrl?: string;
  /** If provided, an x402-enabled client to pay for premium analyses. */
  client?: X402AgentClient;
}

const PREMIUM_KEYWORDS = ['deep', 'dive', 'premium', 'detailed', 'full', 'scenario', 'cross-check', 'liquidity', 'narrative'];
const PORTFOLIO_KEYWORDS = ['portfolio', 'all', 'compare', 'every', 'best', 'ranking', 'overview', 'list'];

/**
 * Deterministic router. Maps a free-text query to a (tier, assetId) decision.
 * Pure function — easy to unit test.
 */
export function route(query: string): RouteDecision {
  const q = query.toLowerCase();

  // Portfolio-wide query?
  if (PORTFOLIO_KEYWORDS.some((kw) => q.includes(kw)) && !specificAssetMatch(q)) {
    return { tier: 'portfolio', assetId: null, reason: 'portfolio-wide comparison requested' };
  }

  // Resolve a specific asset by id, name fragment, or asset class.
  const asset = resolveAsset(q);

  // Premium vs basic?
  const wantsPremium = PREMIUM_KEYWORDS.some((kw) => q.includes(kw));

  if (asset) {
    return {
      tier: wantsPremium ? 'premium' : 'basic',
      assetId: asset.assetId,
      reason: wantsPremium
        ? `premium analysis requested for ${asset.name}`
        : `basic snapshot requested for ${asset.name}`,
    };
  }

  // Fallback: portfolio basic overview.
  return { tier: 'portfolio', assetId: null, reason: 'no specific asset matched → portfolio overview' };
}

/** Try to resolve a query to a single asset by id, name, or asset class keyword. */
function resolveAsset(query: string): RwaAsset | null {
  // exact id
  for (const a of ALL_ASSETS) {
    if (query.includes(a.assetId)) return a;
  }
  // name fragment
  for (const a of ALL_ASSETS) {
    const name = a.name.toLowerCase();
    if (name.split(/[\s—-]+/).some((token) => token.length > 3 && query.includes(token))) return a;
  }
  // asset class
  const classMap: Record<string, AssetClass> = {
    'real estate': 'Real Estate', 'reit': 'Real Estate', 'property': 'Real Estate',
    'gold': 'Commodity', 'commodity': 'Commodity', 'bullion': 'Commodity',
    'invoice': 'Invoice Financing', 'factoring': 'Invoice Financing',
    'treasury': 'Treasury Bond', 't-bill': 'Treasury Bond', 'tbill': 'Treasury Bond', 'bond': 'Treasury Bond',
    'carbon': 'Carbon Credit', 'credit': 'Carbon Credit', 'redd': 'Carbon Credit',
  };
  for (const [kw, cls] of Object.entries(classMap)) {
    if (query.includes(kw)) {
      const hit = ALL_ASSETS.find((a) => a.type === cls);
      if (hit) return hit;
    }
  }
  return null;
}

/** A specific asset id/name matched → don't treat as portfolio. */
function specificAssetMatch(query: string): boolean {
  return resolveAsset(query) !== null;
}

/** The agent. Stateless — safe to reuse across queries. */
export class RwaAgent {
  private readonly options: AgentOptions;

  constructor(options: AgentOptions = {}) {
    this.options = { serverUrl: 'http://localhost:3000', ...options };
  }

  /** Run an end-to-end query: route → analyze (paying for premium if needed). */
  async ask(query: string): Promise<AgentResult> {
    const decision = route(query);
    const timestamp = new Date().toISOString();

    if (decision.tier === 'portfolio') {
      const items = ALL_ASSETS.map(analyzeBasic);
      return {
        query, tier: 'portfolio', decision, timestamp,
        portfolio: { count: items.length, items },
      };
    }

    const asset = decision.assetId ? getAsset(decision.assetId) : null;
    if (!asset) {
      return { query, tier: decision.tier, decision, timestamp };
    }

    if (decision.tier === 'basic') {
      return { query, tier: 'basic', decision, analysis: analyzeBasic(asset), timestamp };
    }

    // PREMIUM — pay via x402 if a client is configured, else compute locally
    // (so the agent is usable offline for testing while still demonstrating
    // the real x402 payment path when wired to a funded client).
    return this.runPremium(query, asset, decision, timestamp);
  }

  private async runPremium(
    query: string, asset: RwaAsset, decision: RouteDecision, timestamp: string,
  ): Promise<AgentResult> {
    const endpoint = `${this.options.serverUrl}/api/rwa-agent/premium?asset=${asset.assetId}`;

    // Path A: real x402 payment via the agent client.
    if (this.options.client) {
      try {
        const res = await this.options.client.fetch(endpoint);
        const body = await res.json().catch(() => null);
        if (res.ok && body?.result) {
          return {
            query, tier: 'premium', decision, timestamp,
            analysis: body.result as PremiumAnalysis,
            payment: { paid: true, deployHash: body.result.paymentReceipt?.deployHash, endpoint },
          };
        }
        // Payment may have failed — fall back to local computation with a note.
        return {
          query, tier: 'premium', decision, timestamp,
          analysis: analyzePremium(asset),
          payment: { paid: false, error: `x402 payment path returned status ${res.status}`, endpoint },
        };
      } catch (err: any) {
        return {
          query, tier: 'premium', decision, timestamp,
          analysis: analyzePremium(asset),
          payment: { paid: false, error: err?.message ?? String(err), endpoint },
        };
      }
    }

    // Path B: no client — compute locally (offline/demo mode).
    return {
      query, tier: 'premium', decision, timestamp,
      analysis: analyzePremium(asset),
      payment: { paid: false, error: 'no x402 client configured (offline mode)', endpoint },
    };
  }
}

// Convenience re-exports for tests / server wiring.
export {
  ALL_ASSETS, RWA_DATABASE, getAsset, listAssets,
  analyzeBasic, analyzePremium, riskBand, recommend,
  impliedValuation, lockupPenalty,
};
