/**
 * Unit tests — RWA Agent router + analysis engine.
 * Run: node --test dist/test/rwa-agent.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  route, RwaAgent,
  analyzeBasic, analyzePremium, riskBand, recommend,
  impliedValuation, lockupPenalty, getAsset, ALL_ASSETS,
} from '../rwa-agent/agent.js';
import { analyzePremium as premiumDirect, analyzeBasic as basicDirect } from '../rwa-agent/analyzer.js';

test('riskBand maps 0..1 correctly', () => {
  assert.equal(riskBand(0.05), 'LOW RISK');
  assert.equal(riskBand(0.25), 'MEDIUM RISK');
  assert.equal(riskBand(0.6), 'HIGH RISK');
});

test('recommend returns a valid call', () => {
  for (const r of ['ACCUMULATE', 'HOLD', 'REDUCE', 'AVOID'] as const) {
    assert.ok(['ACCUMULATE', 'HOLD', 'REDUCE', 'AVOID'].includes(r));
  }
  // T-bill: low risk + decent yield + full liquidity → ACCUMULATE/HOLD
  assert.ok(['ACCUMULATE', 'HOLD'].includes(recommend(0.02, 0.053, 500000, 500000)));
});

test('lockupPenalty scales with lockup days', () => {
  assert.equal(lockupPenalty(0), 0);
  assert.equal(lockupPenalty(30), 15);
  assert.ok(lockupPenalty(365) > lockupPenalty(30));
});

test('impliedValuation is positive for every asset', () => {
  for (const a of ALL_ASSETS) assert.ok(impliedValuation(a) > 0);
});

test('catalogue has 5 distinct asset classes', () => {
  const classes = new Set(ALL_ASSETS.map((a) => a.type));
  assert.equal(ALL_ASSETS.length, 5);
  assert.equal(classes.size, 5);
});

test('route routes a premium deep-dive query to premium tier', () => {
  const d = route('give me a deep dive on the gold commodity');
  assert.equal(d.tier, 'premium');
  assert.ok(d.assetId);
});

test('route routes a portfolio query to portfolio tier', () => {
  const d = route('compare the whole portfolio');
  assert.equal(d.tier, 'portfolio');
  assert.equal(d.assetId, null);
});

test('route routes a basic query to basic tier', () => {
  const d = route('quick snapshot of the treasury bond');
  assert.equal(d.tier, 'basic');
  assert.ok(d.assetId);
});

test('RwaAgent.ask returns a portfolio for portfolio queries', async () => {
  const agent = new RwaAgent();
  const res = await agent.ask('overview of all assets');
  assert.equal(res.tier, 'portfolio');
  assert.ok(res.portfolio);
  assert.equal(res.portfolio!.count, 5);
});

test('RwaAgent.ask returns basic analysis without payment', async () => {
  const agent = new RwaAgent();
  const res = await agent.ask('snapshot of treasury-004');
  assert.equal(res.tier, 'basic');
  assert.ok(res.analysis);
});

test('RwaAgent.ask computes premium locally when no x402 client configured', async () => {
  const agent = new RwaAgent();
  const res = await agent.ask('premium deep dive on real-estate-001');
  assert.equal(res.tier, 'premium');
  assert.ok(res.analysis);
  assert.equal(res.payment?.paid, false);
  // premium analysis includes the deep-dive block
  assert.ok((res.analysis as any).deepDive?.narrative);
});

test('analyzeBasic and analyzePremium shapes are correct', () => {
  const asset = getAsset('commodity-003')!;
  const b = basicDirect(asset);
  const p = premiumDirect(asset);
  assert.equal(b.tier, 'basic');
  assert.equal(p.tier, 'premium');
  assert.ok(p.deepDive.yieldScenarios.length >= 1);
  assert.equal(p.assetId, asset.assetId);
});
