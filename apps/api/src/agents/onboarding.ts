import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Onboarding Coach — the Expansion-engine time-to-value planner. Designs the
 * path from day one to the customer's first real win: milestones, owners, and
 * the metrics that prove value landed.
 *
 * Gate (registry): Time-to-value gate — first value must be reachable inside the
 * plan window. A path that pushes first value past the window is flagged.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the account context,
 * milestones concrete, honest when first value is too far out.
 */

export interface OnboardingResult {
  verdict: string;
  first_value: { milestone: string; when: string; evidence: string };
  milestones: { when: string; milestone: string; owner: string; proof: string }[];
  success_metrics: { metric: string; target: string; proves: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface OnboardingInput {
  accountContext: string;
  productSurface: string;
  window?: string;
  onUsage?: UsageCallback;
}

// Parse "30 days" / "6 weeks" / "90 days" into days for the gate comparison.
function parseDays(w?: string): number | null {
  if (!w) return null;
  const m = w.match(/(\d+)\s*(day|week|month)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  return unit.startsWith('day') ? n : unit.startsWith('week') ? n * 7 : n * 30;
}

export async function runOnboardingCoach(env: Env, input: OnboardingInput): Promise<OnboardingResult> {
  const { accountContext, productSurface, window: win, onUsage } = input;
  const windowDays = parseDays(win);

  const result = await chatJson<{
    verdict: string;
    first_value_milestone: string;
    first_value_when: string;
    first_value_evidence: string;
    first_value_days: number;
    milestones: { when: string; milestone: string; owner: string; proof: string }[];
    success_metrics: { metric: string; target: string; proves: string }[];
  }>(
    env,
    `You are an onboarding strategist. Design the path from day one to the customer's FIRST real win — the moment they'd be annoyed to lose the product.

RULES:
- first_value is the single earliest milestone where the customer gets real value (not "training complete" — actual value). Give its when, the evidence it landed, and first_value_days = how many days from kickoff.
- milestones: the ordered path Day-1 → first value → habit. Each with when, the milestone, the owner (customer or us), and the proof it happened.
- success_metrics: what proves value landed — metric, target, and what it proves.
- ${win ? `The plan window is ${win}. If first value lands beyond it, say so plainly.` : 'No window given — assume 30 days to first value.'}
- Ground it in the account context and the product surface. Do not invent a customer situation.

ACCOUNT CONTEXT:
${accountContext}

PRODUCT SURFACE (workflows to adopt):
${productSurface}

Return JSON: {"verdict": "...", "first_value_milestone": "...", "first_value_when": "...", "first_value_evidence": "...", "first_value_days": n, "milestones": [{"when","milestone","owner","proof"}], "success_metrics": [{"metric","target","proves"}]}`,
    `Design the onboarding path to first value.`,
    { temperature: 0.35, maxTokens: 2800, onUsage },
  );

  const firstValueDays = typeof result?.first_value_days === 'number' ? result.first_value_days : null;
  const gates: { gate: string; note: string }[] = [];
  if (windowDays != null && firstValueDays != null && firstValueDays > windowDays) {
    gates.push({ gate: 'Time-to-value gate', note: `First value lands at ~day ${firstValueDays}, past the ${win} window. Pull the first win earlier or the enthusiasm fades before value arrives.` });
  }
  if (!accountContext || accountContext.trim().length < 10) {
    gates.push({ gate: 'Context gate', note: 'No account context provided — the plan is generic. Add what this customer actually needs to adopt.' });
  }

  return {
    verdict: result?.verdict ?? 'Onboarding plan unavailable.',
    first_value: {
      milestone: result?.first_value_milestone ?? '',
      when: result?.first_value_when ?? '',
      evidence: result?.first_value_evidence ?? '',
    },
    milestones: (result?.milestones ?? []).slice(0, 10).map((m) => ({ when: m.when ?? '', milestone: m.milestone ?? '', owner: m.owner ?? '', proof: m.proof ?? '' })),
    success_metrics: (result?.success_metrics ?? []).slice(0, 6).map((m) => ({ metric: m.metric ?? '', target: m.target ?? '', proves: m.proves ?? '' })),
    gates,
    measured_vs_inferred: {
      measured: ['Account context + product surface (as provided)', 'Time-to-value check vs window (computed)'],
      inferred: ['Milestone path', 'Owners', 'Success metrics'],
    },
  };
}