import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Attribution — the Operations-engine revenue attribution analyst. Attributes
 * closed revenue back across the journey — which touch, channel, and engine
 * carried the deal — so spend follows what works.
 *
 * Gate (registry): Data gate — attribution requires touch data; absent data is
 * reported, not guessed.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the closed deals and
 * touch history, the model stated, honest when touch data is missing.
 */

export interface AttributionResult {
  verdict: string;
  model: string;
  by_engine: { engine: string; revenue: string; share: string }[];
  by_touch: { touch: string; revenue: string; share: string }[];
  spend_signal: { move: string; why: string; expected: string }[];
  data_quality: { has_touch_data: boolean; note: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface AttributionInput {
  closedDeals: string;
  model?: string;
  onUsage?: UsageCallback;
}

const HAS_TOUCH = /(touch|channel|source|campaign|email|linkedin|ad|referral|webinar|content|outbound|inbound|first|last)/i;

export async function runAttribution(env: Env, input: AttributionInput): Promise<AttributionResult> {
  const { closedDeals, model, onUsage } = input;
  const attributionModel = (model || 'linear').toLowerCase();
  const hasTouchData = HAS_TOUCH.test(closedDeals) && closedDeals.trim().length > 60;

  const result = await chatJson<{
    verdict: string;
    by_engine: { engine: string; revenue: string; share: string }[];
    by_touch: { touch: string; revenue: string; share: string }[];
    spend_signal: { move: string; why: string; expected: string }[];
  }>(
    env,
    `You are a revenue attribution analyst. Attribute closed revenue back across the journey, using the ${attributionModel} model.

RULES:
- Work ONLY from the closed deals and touch history provided. Never invent a touch or a channel.
- by_engine: revenue and share by engine (Strategy / Marketing / Sales / Expansion / Operations) — which part of the journey carried the deal.
- by_touch: revenue and share by individual touch/channel.
- spend_signal: where the next dollar earns most — each move grounded in the attribution, with why and the expected effect.
- If the data has NO touch history, say so plainly and attribute only what can be attributed. Do not invent a channel mix.
- State the model you used (${attributionModel}) — attribution is a lens, not a truth.

MODEL: ${attributionModel}

CLOSED DEALS + TOUCH HISTORY:
${closedDeals}

Return JSON: {"verdict": "...", "by_engine": [{"engine","revenue","share"}], "by_touch": [{"touch","revenue","share"}], "spend_signal": [{"move","why","expected"}]}`,
    `Attribute revenue by engine and touch under the ${attributionModel} model.`,
    { temperature: 0.25, maxTokens: 2800, onUsage },
  );

  const gates: { gate: string; note: string }[] = [];
  if (!hasTouchData) {
    gates.push({ gate: 'Data gate', note: 'No touch history found in the data — attribution cannot be computed, only reported as absent. Add the touch/channel per deal before trusting any revenue split.' });
  }

  return {
    verdict: result?.verdict ?? 'Attribution unavailable.',
    model: attributionModel,
    by_engine: (result?.by_engine ?? []).slice(0, 6).map((e) => ({ engine: e.engine ?? '', revenue: e.revenue ?? '', share: e.share ?? '' })),
    by_touch: (result?.by_touch ?? []).slice(0, 10).map((t) => ({ touch: t.touch ?? '', revenue: t.revenue ?? '', share: t.share ?? '' })),
    spend_signal: (result?.spend_signal ?? []).slice(0, 6).map((s) => ({ move: s.move ?? '', why: s.why ?? '', expected: s.expected ?? '' })),
    data_quality: {
      has_touch_data: hasTouchData,
      note: hasTouchData ? 'Touch data present — attribution is grounded in the provided history.' : 'No touch data — any split is a stated assumption, not a measurement.',
    },
    gates,
    measured_vs_inferred: {
      measured: ['Closed deals + touch history (as provided)', 'Touch-data presence (computed)'],
      inferred: ['Revenue split', 'Engine attribution', 'Spend signal'],
    },
  };
}