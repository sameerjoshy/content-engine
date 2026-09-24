import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Pipeline Auditor — the Operations-engine integrity auditor. Where Hygiene
 * checks whether the FIELDS are complete, the Auditor checks whether the STAGE
 * is earned: deals sitting in late stages with no evidence of buyer engagement,
 * aged deals that never move, and coverage gaps.
 *
 * Gate (registry): Evidence gate — stage/evidence mismatches are flagged, never
 * assumed clean.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the deal rows, every
 * mismatch cited, honest about what the pipeline really supports.
 */

export interface IntegrityIssue {
  deal: string;
  stage: string;
  issue: string;
  evidence: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface PipelineAuditorResult {
  verdict: string;
  integrity: IntegrityIssue[];
  aged: { deal: string; stage: string; note: string }[];
  forecast_risk: string;
  counts: { mismatches: number; aged: number; audited: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface PipelineAuditorInput {
  pipelineData: string;
  auditDepth?: string;
  onUsage?: UsageCallback;
}

const SEV_RANK = { critical: 0, high: 1, medium: 2 } as const;

export async function runPipelineAuditor(env: Env, input: PipelineAuditorInput): Promise<PipelineAuditorResult> {
  const { pipelineData, auditDepth, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    integrity: { deal: string; stage: string; issue: string; evidence: string; severity: 'critical' | 'high' | 'medium' }[];
    aged: { deal: string; stage: string; note: string }[];
    forecast_risk: string;
    audited: number;
  }>(
    env,
    `You are a pipeline integrity auditor. This is NOT a field-completeness check (that is a different agent) — you check whether each deal's STAGE is EARNED by evidence of buyer engagement.

RULES:
- Work ONLY from the rows provided. Never invent a deal.
- integrity: deals whose stage does not match the evidence — e.g. "Negotiation" but no meeting/demo/proposal recorded; "Proposal" but no buyer response; a stage that jumped with no activity. Each states the deal, stage, the specific issue, the evidence (or its absence), and severity.
- aged: deals that have not moved in a long time for their stage. Note how long and why it matters.
- forecast_risk: one honest line on what this pipeline actually supports once the mismatches are removed.
- audited: how many deals you examined.
- Severity: critical = a late-stage deal with no engagement evidence (it inflates the forecast). high = stale in a mid stage. medium = minor mismatch.
- Do not flag a deal clean just because its fields are complete — the question is whether the stage is real.

AUDIT DEPTH: ${auditDepth || 'standard'}

PIPELINE DATA:
${pipelineData}

Return JSON: {"verdict": "...", "integrity": [{"deal","stage","issue","evidence","severity"}], "aged": [{"deal","stage","note"}], "forecast_risk": "...", "audited": n}`,
    `Audit whether each deal's stage is earned by evidence.`,
    { temperature: 0.25, maxTokens: 2800, onUsage },
  );

  const integrity: IntegrityIssue[] = (result?.integrity ?? [])
    .map((i) => ({
      deal: i.deal ?? '',
      stage: i.stage ?? '',
      issue: i.issue ?? '',
      evidence: i.evidence ?? '',
      severity: (['critical', 'high', 'medium'].includes(i.severity) ? i.severity : 'medium') as IntegrityIssue['severity'],
    }))
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);

  const aged = (result?.aged ?? []).slice(0, 10).map((a) => ({ deal: a.deal ?? '', stage: a.stage ?? '', note: a.note ?? '' }));

  const gates: { gate: string; note: string }[] = [];
  const critical = integrity.filter((i) => i.severity === 'critical').length;
  if (integrity.length > 0) {
    gates.push({ gate: 'Evidence gate', note: `${integrity.length} deal${integrity.length > 1 ? 's have' : ' has'} a stage that is not backed by evidence${critical ? ` (${critical} critical)` : ''} — the forecast is inflated until these are corrected or the deals are advanced honestly.` });
  }
  if (integrity.length === 0 && result?.audited) {
    gates.push({ gate: 'Evidence gate', note: 'No stage/evidence mismatches found — the pipeline is internally consistent.' });
  }

  return {
    verdict: result?.verdict ?? 'Audit unavailable.',
    integrity: integrity.slice(0, 15),
    aged,
    forecast_risk: result?.forecast_risk ?? '',
    counts: { mismatches: integrity.length, aged: aged.length, audited: result?.audited ?? 0 },
    gates,
    measured_vs_inferred: {
      measured: ['Deal rows + stages + activity (as provided)', 'Mismatch + age counts (computed)'],
      inferred: ['Stage/evidence judgment', 'Severity', 'Forecast risk'],
    },
  };
}