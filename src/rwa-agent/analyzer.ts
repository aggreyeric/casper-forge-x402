/**
 * RWA Analyzer — Real-World Asset analysis engine for the FORGE agent.
 *
 * Owns the mock RWA database (5 tokenized asset classes) and the pure
 * analysis rules the agent runs against them. Two tiers:
 *   - basic  (free / cheap):   snapshot + risk band + recommendation
 *   - premium (x402-gated):    deep dive — yield scenarios, liquidity, valuation cross-check
 *
 * Pure functions only → trivially unit-testable, no network.
 */

// ---------------------------------------------------------------------------
// Asset catalogue
// ---------------------------------------------------------------------------

export type AssetClass =
  | 'Real Estate'
  | 'Commodity'
  | 'Invoice Financing'
  | 'Treasury Bond'
  | 'Carbon Credit';

export interface RwaAsset {
  assetId: string;
  type: AssetClass;
  name: string;
  /** Underlying issuer / jurisdiction for narrative. */
  issuer: string;
  location: string;
  /** Tokenized valuation in USD. */
  valuation: number;
  currency: 'USDC' | 'USD';
  /** Annualized yield (0.10 = 10%). */
  yield: number;
  /** 0.0 (safest) .. 1.0 (riskiest). */
  riskScore: number;
  /** Days the underlying is locked. */
  lockupDays: number;
  /** On-chain liquidity in USD (tokenized + AMM depth). */
  liquidityUsd: number;
  /** Fraction of supply currently tokenized on-chain. */
  tokenizedFraction: number;
}

/**
 * Five hardcoded, internally-consistent RWAs spanning the asset classes the
 * brief asks for. Numbers are realistic but synthetic.
 */
export const RWA_DATABASE: Record<string, RwaAsset> = {
  'real-estate-001': {
    assetId: 'real-estate-001', type: 'Real Estate',
    name: 'Ikoyi Mixed-Use Tower', issuer: 'Lagos REIT Partners',
    location: 'Lagos, Nigeria', valuation: 2_500_000, currency: 'USDC',
    yield: 0.085, riskScore: 0.28, lockupDays: 365, liquidityUsd: 480_000,
    tokenizedFraction: 0.19,
  },
  'commodity-003': {
    assetId: 'commodity-003', type: 'Commodity',
    name: 'Tokenized Gold Vault — Zurich', issuer: 'Helvetia Bullion AG',
    location: 'Zurich, Switzerland', valuation: 1_000_000, currency: 'USDC',
    yield: 0.05, riskScore: 0.10, lockupDays: 30, liquidityUsd: 950_000,
    tokenizedFraction: 0.62,
  },
  'invoice-002': {
    assetId: 'invoice-002', type: 'Invoice Financing',
    name: 'DropPA Logistics Invoice #4821', issuer: 'DropPA Logistics',
    location: 'Dubai, UAE', valuation: 45_000, currency: 'USDC',
    yield: 0.12, riskScore: 0.15, lockupDays: 45, liquidityUsd: 38_000,
    tokenizedFraction: 0.84,
  },
  'treasury-004': {
    assetId: 'treasury-004', type: 'Treasury Bond',
    name: 'US T-Bill 26-Week', issuer: 'US Department of the Treasury',
    location: 'United States', valuation: 500_000, currency: 'USDC',
    yield: 0.053, riskScore: 0.02, lockupDays: 182, liquidityUsd: 500_000,
    tokenizedFraction: 0.41,
  },
  'carbon-005': {
    assetId: 'carbon-005', type: 'Carbon Credit',
    name: 'Verra-Verified REDD+ Credits', issuer: 'Kasigau Wildlife Corridor',
    location: 'Coastal Kenya', valuation: 120_000, currency: 'USDC',
    yield: 0.0, riskScore: 0.40, lockupDays: 0, liquidityUsd: 95_000,
    tokenizedFraction: 0.55,
  },
};

export const ALL_ASSETS = Object.values(RWA_DATABASE);

// ---------------------------------------------------------------------------
// Analysis rules
// ---------------------------------------------------------------------------

export type RiskBand = 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK';
export type Recommendation = 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'AVOID';

export type Tier = 'basic' | 'premium';

export interface BasicAnalysis {
  assetId: string;
  asset: RwaAsset;
  analysisDate: string;
  riskAssessment: { score: number; band: RiskBand };
  yieldProjection: { projectedAPY: number; confidence: number };
  recommendation: Recommendation;
  tier: Tier;
}export interface PremiumAnalysis extends BasicAnalysis {
  tier: 'premium';
  deepDive: {
    liquidityRatio: number;        // liquidityUsd / valuation
    lockupPenaltyDays: number;     // effective penalty for capital lockup (bps)
    valuationCrossCheck: { method: string; impliedValue: number; variancePct: number };
    yieldScenarios: { scenario: string; projectedAPY: number }[];
    tokenizationHealth: { fraction: number; rating: 'UNDER-TOKENIZED' | 'HEALTHY' | 'SATURATED' };
    narrative: string;
  };
  confidence: number;
}

/** Map a 0..1 risk score to a band. */
export function riskBand(score: number): RiskBand {
  if (score < 0.2) return 'LOW RISK';
  if (score < 0.4) return 'MEDIUM RISK';
  return 'HIGH RISK';
}

/** Convert a risk score + yield into a buy/hold/reduce call. */
export function recommend(
  riskScore: number, yieldPct: number, liquidityUsd: number, valuation: number,
): Recommendation {
  const liquidityRatio = valuation > 0 ? liquidityUsd / valuation : 0;
  const score = yieldPct - riskScore + liquidityRatio;
  if (score >= 0.7) return 'ACCUMULATE';
  if (score >= 0.3) return 'HOLD';
  if (score >= 0.05) return 'REDUCE';
  return 'AVOID';
}

/** Cross-check the on-chain valuation using a liquidity-weighted implied value. */
export function impliedValuation(asset: RwaAsset): number {
  // Implied value = what the market liquidity suggests, scaled by tokenization.
  const liquiditySignal = asset.liquidityUsd / Math.max(asset.tokenizedFraction, 0.05);
  return Math.round(liquiditySignal);
}

/** Penalty applied per 30 days of capital lockup (basis points of yield). */
export function lockupPenalty(lockupDays: number): number {
  return Math.round((lockupDays / 30) * 15); // 15bps per month locked
}

/** Run the free/cheap basic analysis on a single asset. Pure function. */
export function analyzeBasic(asset: RwaAsset): BasicAnalysis {
  return {
    assetId: asset.assetId,
    asset,
    analysisDate: new Date().toISOString(),
    riskAssessment: { score: asset.riskScore, band: riskBand(asset.riskScore) },
    yieldProjection: { projectedAPY: asset.yield, confidence: 0.8 },
    recommendation: recommend(asset.riskScore, asset.yield, asset.liquidityUsd, asset.valuation),
    tier: 'basic',
  };
}

/** Run the x402-gated premium deep dive. Pure function. */
export function analyzePremium(asset: RwaAsset): PremiumAnalysis {
  const basic = analyzeBasic(asset);
  const implied = impliedValuation(asset);
  const variancePct = asset.valuation > 0
    ? Math.round(((implied - asset.valuation) / asset.valuation) * 1000) / 10
    : 0;
  const penalty = lockupPenalty(asset.lockupDays);
  const penaltyFactor = penalty / 10000;

  const tokenizationHealth =
    asset.tokenizedFraction < 0.25 ? 'UNDER-TOKENIZED'
    : asset.tokenizedFraction <= 0.7 ? 'HEALTHY'
    : 'SATURATED';

  const yieldScenarios = [
    { scenario: 'Base case', projectedAPY: Math.round(asset.yield * 10000) / 10000 },
    { scenario: 'Risk-adjusted (lockup penalty applied)', projectedAPY: Math.max(0, Math.round((asset.yield - penaltyFactor) * 10000) / 10000) },
    { scenario: 'Optimistic (valuation re-rate +10%)', projectedAPY: Math.round(asset.yield * 1.1 * 10000) / 10000 },
  ];

  const narrative =
    `${asset.name} (${asset.type}, ${asset.location}) carries a ${riskBand(asset.riskScore).toLowerCase()} ` +
    `profile at ${(asset.riskScore * 100).toFixed(0)}% risk against a ${(asset.yield * 100).toFixed(1)}% yield. ` +
    `Liquidity covers ${(asset.liquidityUsd / asset.valuation * 100).toFixed(0)}% of the $${asset.valuation.toLocaleString()} valuation ` +
    `(${tokenizationHealth.toLowerCase()} at ${(asset.tokenizedFraction * 100).toFixed(0)}% tokenized). ` +
    `Liquidity-weighted implied value is ${variancePct >= 0 ? '+' : ''}${variancePct}% vs. stated valuation. ` +
    `${asset.lockupDays}-day lockup trims ${penalty}bps of effective yield. Recommendation: ${basic.recommendation}.`;

  return {
    ...basic,
    tier: 'premium',
    deepDive: {
      liquidityRatio: Math.round((asset.liquidityUsd / asset.valuation) * 100) / 100,
      lockupPenaltyDays: penalty,
      valuationCrossCheck: {
        method: 'liquidity-weighted implied value (liquidityUsd / tokenizedFraction)',
        impliedValue: implied,
        variancePct,
      },
      yieldScenarios,
      tokenizationHealth: { fraction: asset.tokenizedFraction, rating: tokenizationHealth },
      narrative,
    },
    confidence: 0.92,
  };
}

/** List every asset with a cheap header (no full analysis). */
export function listAssets() {
  return ALL_ASSETS.map((a) => ({
    assetId: a.assetId, type: a.type, name: a.name,
    valuation: a.valuation, currency: a.currency, riskBand: riskBand(a.riskScore),
  }));
}

/** Find an asset or return null. */
export function getAsset(assetId: string): RwaAsset | null {
  return RWA_DATABASE[assetId] ?? null;
}
