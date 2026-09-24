import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Cross-Sell Scout — the Expansion-engine multi-product scout. Scans health and
 * usage for the signals an account is ready for an adjacent product, and frames
 * the cross-sell with a readiness score.
 *
 * Gate (registry): Health gate — only healthy accounts are eligible. A declining
 * account is held back.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in usage and support,
 * readiness scored with rationale, honest when the signal is not there.
 */

export interface CrossSellResult {
  verdict: string;
  readiness: { score: number; label: string; why: string };
  brief: { product: string; evidence: string; framing: string };
  signals: { signal: string; meaning: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface CrossSellInput {
  healthScore: string;
  usageSupport: string;
  products?: string;
  onUsage?: UsageCallback;
}

// Health strings that mean "not healthy" — the Health gate fires on these.
const UNHEALTHY = /(declin|at.risk|churn|detractor|red|poor|low|unhappy|escalat|collaps|shrink)/i;

export async function runCrossSellScout(env: Env, input: CrossSellInput): Promise<CrossSellResult> {
  const { healthScore, usageSupport, products, onUsage } = input;
  const unhealthy = UNHEALTHY.test(healthScore);

  const result = await chatJson<{
    verdict: string;
    readiness_score: number;
    readiness_label: string;
    readiness_why: string;
    product: string;
    evidence: string;
    framing: string;
    signals: { signal: string; meaning: string }[];
  }>(
    env,
    `You are a cross-sell scout. Scan the account's health, usage, and support for signals it is ready for an adjacent product — then frame the cross-sell.

RULES:
- Work ONLY from the data provided. Never invent usage or a product fit.
- signals: each a specific observation (usage pattern, support theme, team growth) and what it means for an adjacent product.
- product: the adjacent product to lead with (from the offerings if given). evidence: the specific proof this account needs it. framing: how to position it as a natural next step, not a pitch.
- readiness_score: 1-5, with the rationale. Only score high when the signals actually support it.
- If the account is showing decline, do not force a cross-sell — say the focus should be protecting the account first.

HEALTH SCORE: ${healthScore}

USAGE + SUPPORT:
${usageSupport}
${products ? `\nAVAILABLE PRODUCTS:\n${products}` : ''}

Return JSON: {"verdict": "...", "readiness_score": n, "readiness_label": "...", "readiness_why": "...", "product": "...", "evidence": "...", "framing": "...", "signals": [{"signal","meaning"}]}`,
    `Scan for cross-sell readiness and frame the adjacent product.`,
    { temperature: 0.35, maxTokens: 2400, onUsage },
  );

  let score = Math.max(1, Math.min(5, Math.round(result?.readiness_score ?? 1)));
  const gates: { gate: string; note: string }[] = [];
  if (unhealthy) {
    score = Math.min(score, 1);
    gates.push({ gate: 'Health gate', note: `This account reads as unhealthy ("${healthScore.trim()}") — it is not eligible for a cross-sell. Protect the account before you pitch anything adjacent.` });
  }
  if (score <= 2 && !unhealthy) {
    gates.push({ gate: 'Readiness gate', note: 'Readiness is low — the signal for an adjacent product is not here yet. Do not force it.' });
  }

  const label = score >= 4 ? 'Ready' : score === 3 ? 'Warming' : 'Not yet';

  return {
    verdict: result?.verdict ?? 'Cross-sell scan unavailable.',
    readiness: { score, label, why: result?.readiness_why ?? '' },
    brief: { product: result?.product ?? '', evidence: result?.evidence ?? '', framing: result?.framing ?? '' },
    signals: (result?.signals ?? []).slice(0, 6).map((s) => ({ signal: s.signal ?? '', meaning: s.meaning ?? '' })),
    gates,
    measured_vs_inferred: {
      measured: ['Health + usage + support (as provided)', 'Health gate + readiness clamp (computed)'],
      inferred: ['Signals', 'Product fit', 'Framing'],
    },
  };
}