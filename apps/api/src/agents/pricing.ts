import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Pricing Strategist — the Sales-engine deal pricing analyst. Advises deal-level
 * pricing and packaging: the anchor, the package, the concession floor, and the
 * walk-away number — grounded in deal context and prior price history.
 *
 * Gate (registry): Margin gate — recommendations must stay above the margin
 * floor. A recommendation below it is flagged.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the deal and history,
 * the guardrail enforced, honest when history is thin.
 */

export interface PricingResult {
  verdict: string;
  anchor: string;
  package: { tier: string; price: string; includes: string }[];
  concession_floor: string;
  margin_guardrail: string;
  reasoning: string;
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface PricingInput {
  dealContext: string;
  priceHistory?: string;
  marginFloor?: string;
  onUsage?: UsageCallback;
}

export async function runPricingStrategist(env: Env, input: PricingInput): Promise<PricingResult> {
  const { dealContext, priceHistory, marginFloor, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    anchor: string;
    package: { tier: string; price: string; includes: string }[];
    concession_floor: string;
    margin_guardrail: string;
    reasoning: string;
    breaches_floor: boolean;
  }>(
    env,
    `You are a deal pricing strategist. Advise pricing and packaging for ONE deal, grounded in the context and the price history.

RULES:
- anchor: the opening number and how to frame it. package: 2-4 options/tiers with price and what each includes — good/better/best, not one take-it-or-leave-it.
- concession_floor: the lowest price you should agree to, and what you get in exchange for going there.
- margin_guardrail: the walk-away number — the price below which the deal is not worth doing.
- ${marginFloor ? `The margin floor is ${marginFloor}. If ANY number you recommend falls below it, set breaches_floor to true.` : 'No margin floor was provided — set breaches_floor to false and note the guardrail is unverified.'}
- reasoning: why this anchor and these packages, tied to the deal and history.
- Work ONLY from the context and history provided. Never invent prior deals or prices.

DEAL CONTEXT:
${dealContext}
${priceHistory ? `\nPRICE HISTORY (recent wins/losses):\n${priceHistory}` : '\nPRICE HISTORY: none provided'}

Return JSON: {"verdict": "...", "anchor": "...", "package": [{"tier","price","includes"}], "concession_floor": "...", "margin_guardrail": "...", "reasoning": "...", "breaches_floor": bool}`,
    `Recommend the anchor, packages, floor, and guardrail for this deal.`,
    { temperature: 0.3, maxTokens: 2600, onUsage },
  );

  const gates: { gate: string; note: string }[] = [];
  if (result?.breaches_floor === true) {
    gates.push({ gate: 'Margin gate', note: 'The recommendation dips below the margin floor — do not present it as-is. Raise the anchor or cut scope to restore margin.' });
  }
  if (!marginFloor) {
    gates.push({ gate: 'Guardrail gate', note: 'No margin floor was provided — the walk-away number is a judgment, not a verified guardrail. Supply the floor before you negotiate.' });
  }
  if (!priceHistory) {
    gates.push({ gate: 'History gate', note: 'No price history provided — the anchor is not benchmarked against what actually closed. Add recent wins/losses by price point.' });
  }

  return {
    verdict: result?.verdict ?? 'Pricing guidance unavailable.',
    anchor: result?.anchor ?? '',
    package: (result?.package ?? []).slice(0, 5).map((p) => ({ tier: p.tier ?? '', price: p.price ?? '', includes: p.includes ?? '' })),
    concession_floor: result?.concession_floor ?? '',
    margin_guardrail: result?.margin_guardrail ?? '',
    reasoning: result?.reasoning ?? '',
    gates,
    measured_vs_inferred: {
      measured: ['Deal context + price history (as provided)', 'Margin-floor breach check (computed)'],
      inferred: ['Anchor', 'Packaging', 'Concession floor + guardrail'],
    },
  };
}