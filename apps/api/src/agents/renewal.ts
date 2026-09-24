import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Renewal Analyst — the Expansion-engine renewal strategist. Builds the renewal
 * plan: the proof of value to present, the expansion option to offer, and the
 * risk to neutralise — starting well before the contract date.
 *
 * Gate (registry): Value gate — a renewal plan must open with evidence of value
 * delivered. A plan with no value proof is flagged.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the health data, value
 * proof required, honest when there is little to show.
 */

export interface RenewalResult {
  verdict: string;
  value_proof: { claim: string; evidence: string }[];
  offer: string;
  expansion_option: string;
  risk_plan: { risk: string; mitigation: string }[];
  timeline: { when: string; action: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface RenewalInput {
  healthData: string;
  renewalDate?: string;
  onUsage?: UsageCallback;
}

export async function runRenewalAnalyst(env: Env, input: RenewalInput): Promise<RenewalResult> {
  const { healthData, renewalDate, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    value_established: boolean;
    value_proof: { claim: string; evidence: string }[];
    offer: string;
    expansion_option: string;
    risk_plan: { risk: string; mitigation: string }[];
    timeline: { when: string; action: string }[];
  }>(
    env,
    `You are a renewal strategist. Build the renewal plan — starting from proof of value, not from the contract date.

RULES:
- value_established: true ONLY if the data contains concrete evidence that this customer actually got value (real usage, outcomes, saved time, testimonials). If the data is thin or only shows ABSENCE (no usage data, quiet account, nothing recorded), value_established MUST be false — an absence is not a proof.
- value_proof: the concrete evidence of value delivered to THIS customer. Each claim needs its evidence. If value_established is false, value_proof must be empty — do not manufacture wins.
- offer: how to frame the renewal (continuity, growth, or a re-shaped package).
- expansion_option: the natural next step to offer, framed as growth — only if the health supports it.
- risk_plan: the specific risks to this renewal and the mitigation for each.
- timeline: work backwards from the renewal date — what happens when, so the conversation starts early.
- Work ONLY from the health data provided. Never invent usage or outcomes.

HEALTH DATA:
${healthData}

RENEWAL DATE: ${renewalDate || 'not provided'}

Return JSON: {"verdict": "...", "value_established": bool, "value_proof": [{"claim","evidence"}], "offer": "...", "expansion_option": "...", "risk_plan": [{"risk","mitigation"}], "timeline": [{"when","action"}]}`,
    `Build the renewal plan: value proof, offer, risk, and timeline.`,
    { temperature: 0.3, maxTokens: 2800, onUsage },
  );

  const valueEstablished = result?.value_established === true;
  const valueProof = (valueEstablished ? (result?.value_proof ?? []) : []).slice(0, 6).map((v) => ({ claim: v.claim ?? '', evidence: v.evidence ?? '' }));

  const gates: { gate: string; note: string }[] = [];
  if (!valueEstablished) {
    gates.push({ gate: 'Value gate', note: 'No evidence of value delivered could be established — a renewal cannot open without proof. Find the wins before the conversation.' });
  }
  if (!renewalDate) {
    gates.push({ gate: 'Timing gate', note: 'No renewal date provided — the timeline is illustrative, not scheduled against the actual date.' });
  }

  return {
    verdict: result?.verdict ?? 'Renewal plan unavailable.',
    value_proof: valueProof,
    offer: result?.offer ?? '',
    expansion_option: result?.expansion_option ?? '',
    risk_plan: (result?.risk_plan ?? []).slice(0, 6).map((r) => ({ risk: r.risk ?? '', mitigation: r.mitigation ?? '' })),
    timeline: (result?.timeline ?? []).slice(0, 8).map((t) => ({ when: t.when ?? '', action: t.action ?? '' })),
    gates,
    measured_vs_inferred: {
      measured: ['Health data + renewal date (as provided)', 'Value-proof presence (computed)'],
      inferred: ['Value framing', 'Offer + expansion option', 'Risk plan + timeline'],
    },
  };
}