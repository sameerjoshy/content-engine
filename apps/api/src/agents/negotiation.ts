import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Negotiation Coach — the Sales-engine live negotiation advisor. Builds the
 * concession map before the call: what they want, what you can give, where the
 * line is — and the order to give it in.
 *
 * Gate (registry): Guardrail gate — concessions never breach the margin floor.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the deal brief and known
 * pressures, concessions mapped to trades, the guardrail enforced.
 */

export interface ConcessionTrade {
  they_want: string;
  you_can_give: string;
  cost_to_you: string;
  in_exchange_for: string;
}

export interface NegotiationResult {
  verdict: string;
  map: ConcessionTrade[];
  concession_sequence: { order: number; concession: string; in_exchange_for: string; guardrail: string }[];
  call_prep: { hold: string[]; give: string[]; close_when: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface NegotiationInput {
  dealBrief: string;
  knownPressures?: string;
  marginFloor?: string;
  onUsage?: UsageCallback;
}

export async function runNegotiationCoach(env: Env, input: NegotiationInput): Promise<NegotiationResult> {
  const { dealBrief, knownPressures, marginFloor, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    map: { they_want: string; you_can_give: string; cost_to_you: string; in_exchange_for: string }[];
    concession_sequence: { concession: string; in_exchange_for: string; guardrail: string }[];
    hold: string[];
    give: string[];
    close_when: string;
    breaches_floor: boolean;
  }>(
    env,
    `You are a negotiation coach preparing a seller for a live call. Build the concession map BEFORE the call.

RULES:
- map: for each thing they want — what you can give, what it costs you, and what you must get in exchange. Never give anything for free; every concession is a trade.
- concession_sequence: the ORDER to give, cheapest-to-you first, each with the exchange and the guardrail (the point past which you do not go on this item).
- hold: what you never give up (value, terms, or price integrity). give: what you are willing to trade. close_when: the signal to stop and ask for the close.
- ${marginFloor ? `Margin floor: ${marginFloor}. If any concession would breach it, set breaches_floor to true.` : 'No margin floor provided — set breaches_floor to false and note the guardrail is unverified.'}
- Work ONLY from the brief and pressures provided. Never invent their position.

DEAL BRIEF:
${dealBrief}
${knownPressures ? `\nKNOWN PRESSURES:\n${knownPressures}` : '\nKNOWN PRESSURES: none provided'}

Return JSON: {"verdict": "...", "map": [{"they_want","you_can_give","cost_to_you","in_exchange_for"}], "concession_sequence": [{"concession","in_exchange_for","guardrail"}], "hold": ["..."], "give": ["..."], "close_when": "...", "breaches_floor": bool}`,
    `Build the concession map and call prep.`,
    { temperature: 0.35, maxTokens: 2600, onUsage },
  );

  const gates: { gate: string; note: string }[] = [];
  if (result?.breaches_floor === true) {
    gates.push({ gate: 'Guardrail gate', note: 'A planned concession breaches the margin floor — remove it from the sequence or find a cheaper trade.' });
  }
  if (!marginFloor) {
    gates.push({ gate: 'Guardrail gate', note: 'No margin floor provided — the guardrails are judgment, not verified limits. Set the floor before the call.' });
  }

  return {
    verdict: result?.verdict ?? 'Negotiation map unavailable.',
    map: (result?.map ?? []).slice(0, 8).map((m) => ({ they_want: m.they_want ?? '', you_can_give: m.you_can_give ?? '', cost_to_you: m.cost_to_you ?? '', in_exchange_for: m.in_exchange_for ?? '' })),
    concession_sequence: (result?.concession_sequence ?? []).slice(0, 8).map((c, i) => ({ order: i + 1, concession: c.concession ?? '', in_exchange_for: c.in_exchange_for ?? '', guardrail: c.guardrail ?? '' })),
    call_prep: { hold: (result?.hold ?? []).slice(0, 5), give: (result?.give ?? []).slice(0, 5), close_when: result?.close_when ?? '' },
    gates,
    measured_vs_inferred: {
      measured: ['Deal brief + pressures (as provided)', 'Margin-floor breach check (computed)'],
      inferred: ['Concession map', 'Sequence order', 'Call prep'],
    },
  };
}