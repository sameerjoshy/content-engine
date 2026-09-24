import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Hygiene — the Operations-engine agent for CRM data integrity. Reads a pipeline
 * export and reports what's breaking the forecast, ranked blocker → warning →
 * advisory, with the dollar impact of the dirty rows.
 *
 * Gates (registry): blockers affect the forecast and are separated from
 * advisory issues. Every finding cites the offending rows.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's export,
 * findings ordered by forecast impact, no invented rows.
 */

export interface HygieneFinding {
  severity: 'blocker' | 'warning' | 'advisory';
  issue: string;
  rows: string[];
  impact: string;
}

export interface HygieneResult {
  verdict: string;
  findings: HygieneFinding[];
  impact: { raw_pipeline: string; at_risk: string; note: string };
  score: { value: number; label: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface HygieneInput {
  pipelineExport: string;
  auditScope?: string;
  onUsage?: UsageCallback;
}

export async function runHygiene(env: Env, input: HygieneInput): Promise<HygieneResult> {
  const { pipelineExport, auditScope, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    findings: { severity: 'blocker' | 'warning' | 'advisory'; issue: string; rows: string[]; impact: string }[];
    raw_pipeline: string;
    at_risk: string;
    note: string;
  }>(
    env,
    `You are a revenue operations analyst auditing CRM pipeline data for integrity. Find what's breaking the forecast.

RULES:
- Work ONLY from the rows provided. Cite the offending rows by name/id in "rows". Never invent deals.
- severity: "blocker" = directly corrupts the forecast (missing close date, missing amount, impossible stage, negative/skewed values). "warning" = will cause problems (missing owner, stale activity, duplicate). "advisory" = cleanliness (naming, missing optional fields).
- Order findings: all blockers first, then warnings, then advisory.
- raw_pipeline: the total pipeline value in the export. at_risk: the value of the rows carrying blockers/warnings, as a dollar (or +/-) figure. If amounts are unknown, say "unknown".
- verdict: one honest sentence on whether this pipeline can be trusted for a forecast.

AUDIT SCOPE: ${auditScope || 'Full pipeline'}

PIPELINE EXPORT:
${pipelineExport}

Return JSON: {"verdict": "...", "findings": [{"severity","issue","rows":["..."],"impact":"..."}], "raw_pipeline": "...", "at_risk": "...", "note": "..."}`,
    `Audit the pipeline export for integrity and forecast impact.`,
    { temperature: 0.2, maxTokens: 2800, onUsage },
  );

  const rank = { blocker: 0, warning: 1, advisory: 2 } as const;
  const findings: HygieneFinding[] = (result?.findings ?? [])
    .map((f) => ({
      severity: (['blocker', 'warning', 'advisory'].includes(f.severity) ? f.severity : 'advisory') as HygieneFinding['severity'],
      issue: f.issue ?? '',
      rows: (f.rows ?? []).slice(0, 6),
      impact: f.impact ?? '',
    }))
    .sort((a, b) => rank[a.severity] - rank[b.severity]);

  const blockers = findings.filter((f) => f.severity === 'blocker');
  const warnings = findings.filter((f) => f.severity === 'warning');

  const gates: { gate: string; note: string }[] = [];
  if (blockers.length) {
    gates.push({ gate: 'Forecast gate', note: `${blockers.length} blocker${blockers.length > 1 ? 's' : ''} found — the forecast cannot be trusted until these rows are fixed.` });
  }
  if (!blockers.length && warnings.length) {
    gates.push({ gate: 'Forecast gate', note: `${warnings.length} warning${warnings.length > 1 ? 's' : ''} carry forecast risk; no hard blockers.` });
  }

  const scoreValue = Math.max(5, 100 - blockers.length * 18 - warnings.length * 7 - findings.filter((f) => f.severity === 'advisory').length * 2);
  const label = scoreValue >= 85 ? 'Clean' : scoreValue >= 65 ? 'Usable with fixes' : scoreValue >= 40 ? 'Unreliable' : 'Broken';

  return {
    verdict: result?.verdict ?? 'Audit unavailable.',
    findings: findings.slice(0, 10),
    impact: { raw_pipeline: result?.raw_pipeline ?? 'unknown', at_risk: result?.at_risk ?? 'unknown', note: result?.note ?? '' },
    score: { value: scoreValue, label },
    gates,
    measured_vs_inferred: {
      measured: ['Rows + field values (from your export)', 'Severity ordering + blocker count (computed)', 'Hygiene score (computed)'],
      inferred: ['Impact per finding', 'At-risk value', 'Verdict'],
    },
  };
}