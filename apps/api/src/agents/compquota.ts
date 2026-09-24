import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Comp & Quota — the Operations-engine quota designer. Builds quota and comp
 * plans grounded in capacity, coverage, and history, so targets are motivating
 * and the math holds.
 *
 * Gate (registry): Reality gate — quotas must reconcile with pipeline coverage,
 * not optimism.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the territory data, the
 * coverage reconciliation computed, honest when the numbers don't hold.
 */

export interface CompQuotaResult {
  verdict: string;
  quotas: { rep: string; quota: string; rationale: string }[];
  reconciliation: { required: string; covered: string; verdict: string; reconciles: boolean };
  comp_model: { levers: string[]; guardrails: string[] };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface CompQuotaInput {
  territoryData: string;
  compStructure?: string;
  coverage?: string;
  onUsage?: UsageCallback;
}

export async function runCompQuota(env: Env, input: CompQuotaInput): Promise<CompQuotaResult> {
  const { territoryData, compStructure, coverage, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    quotas: { rep: string; quota: string; rationale: string }[];
    required: string;
    covered: string;
    reconciliation_verdict: string;
    reconciles: boolean;
    levers: string[];
    guardrails: string[];
  }>(
    env,
    `You are a quota and compensation designer. Set quotas grounded in capacity, coverage, and history — and check whether they actually reconcile.

RULES:
- Work ONLY from the territory data and coverage provided. Never invent a rep or a number.
- quotas: per-rep targets with the rationale (capacity, history, territory). Ramp new reps; do not set a full quota on someone still ramping.
- required: the total quota the company target demands. covered: the pipeline coverage that actually exists. reconciles: true ONLY if the coverage can plausibly carry the quotas.
- reconciliation_verdict: one line on whether the plan holds.
- levers: the comp levers to pull (accelerators, spiffs, decelerators). guardrails: the limits (caps, clawbacks, floors).
- A quota that the coverage cannot support is a plan for failure, not a target. Say so.

TERRITORY DATA:
${territoryData}
${coverage ? `\nPIPELINE COVERAGE:\n${coverage}` : '\nPIPELINE COVERAGE: not provided'}
${compStructure ? `\nCURRENT / TARGET COMP:\n${compStructure}` : ''}

Return JSON: {"verdict": "...", "quotas": [{"rep","quota","rationale"}], "required": "...", "covered": "...", "reconciliation_verdict": "...", "reconciles": bool, "levers": ["..."], "guardrails": ["..."]}`,
    `Design the quota plan and reconcile it against coverage.`,
    { temperature: 0.3, maxTokens: 2800, onUsage },
  );

  const gates: { gate: string; note: string }[] = [];
  if (result?.reconciles === false) {
    gates.push({ gate: 'Reality gate', note: 'The quotas do not reconcile with the pipeline coverage — this plan assumes deals that do not exist. Lower the quota or raise coverage before you publish it.' });
  }
  if (!coverage) {
    gates.push({ gate: 'Coverage gate', note: 'No pipeline coverage was provided — the reconciliation is unverified. Add coverage to confirm the quotas are reachable.' });
  }

  return {
    verdict: result?.verdict ?? 'Quota plan unavailable.',
    quotas: (result?.quotas ?? []).slice(0, 20).map((q) => ({ rep: q.rep ?? '', quota: q.quota ?? '', rationale: q.rationale ?? '' })),
    reconciliation: {
      required: result?.required ?? 'unknown',
      covered: result?.covered ?? 'unknown',
      verdict: result?.reconciliation_verdict ?? 'not assessed',
      reconciles: result?.reconciles === true,
    },
    comp_model: { levers: (result?.levers ?? []).slice(0, 6), guardrails: (result?.guardrails ?? []).slice(0, 6) },
    gates,
    measured_vs_inferred: {
      measured: ['Territory data + coverage (as provided)', 'Coverage reconciliation (computed)'],
      inferred: ['Per-rep quotas', 'Comp levers + guardrails', 'Rationale'],
    },
  };
}