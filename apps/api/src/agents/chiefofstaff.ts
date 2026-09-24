import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Chief of Staff — the cross-engine orchestrator. Runs the weekly command
 * rhythm across all five engines: what changed, what needs a decision, and the
 * cross-engine risks and opportunities the individual agents cannot see from
 * inside their own lane.
 *
 * Gate (registry): Evidence gate — it orchestrates, it does not invent. Every
 * item traces to an engine output. A "needs a decision" item names the decision
 * and the owner, or it is not surfaced.
 *
 * Built against AGENT_QUALITY_STANDARD.md.
 */

export interface CommandResult {
  verdict: string;
  changed: { engine: string; what: string; source: string }[];
  decisions: { decision: string; owner: string; why: string; engine: string }[];
  risks: { risk: string; engine: string; severity: 'high' | 'medium' | 'low'; evidence: string }[];
  opportunities: { opportunity: string; engine: string; why: string }[];
  this_week: { action: string; owner: string; engine: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface CommandInput {
  engineOutputs: string;
  priorities?: string;
  context?: string;
  onUsage?: UsageCallback;
}

const ENGINES = ['Strategy', 'Marketing', 'Sales', 'Expansion', 'Operations'];
const SEV_RANK = { high: 0, medium: 1, low: 2 } as const;

export async function runChiefOfStaff(env: Env, input: CommandInput): Promise<CommandResult> {
  const { engineOutputs, priorities, context, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    changed: { engine: string; what: string; source: string }[];
    decisions: { decision: string; owner: string; why: string; engine: string }[];
    risks: { risk: string; engine: string; severity: 'high' | 'medium' | 'low'; evidence: string }[];
    opportunities: { opportunity: string; engine: string; why: string }[];
    this_week: { action: string; owner: string; engine: string }[];
  }>(
    env,
    `You are the Chief of Staff running the weekly command rhythm. You orchestrate across the five engines — Strategy, Marketing, Sales, Expansion, Operations — and you DO NOT INVENT. Every item you surface must trace to an engine output provided.

RULES:
- changed: what actually changed since last week, per engine, with the "source" = the engine output it came from. If nothing changed for an engine, omit it.
- decisions: what needs a human decision this week. Each names the specific decision, the OWNER, why it matters now, and which engine raised it. If you cannot name the decision and the owner, do not surface it.
- risks: cross-engine risks — the ones an individual engine would miss because it only sees its own lane (e.g. marketing generating demand sales cannot convert; sales closing deals expansion cannot retain). Each with the engine, severity, and the evidence from the outputs.
- opportunities: cross-engine openings — where one engine's output creates an opening for another.
- this_week: the 3-5 concrete actions for the week, each with an owner and engine. This is the operating list, not a summary.
- verdict: one honest operator line on the state of the business this week.
- Work ONLY from the engine outputs provided. Never fabricate a status, a number, or a risk.

PRIORITIES:
${priorities || 'not provided'}

CONTEXT (what happened this week):
${context || 'not provided'}

ENGINE OUTPUTS:
${engineOutputs}

Return JSON: {"verdict": "...", "changed": [{"engine","what","source"}], "decisions": [{"decision","owner","why","engine"}], "risks": [{"risk","engine","severity","evidence"}], "opportunities": [{"opportunity","engine","why"}], "this_week": [{"action","owner","engine"}]}`,
    `Run the weekly command brief across all engines.`,
    { temperature: 0.3, maxTokens: 3000, onUsage },
  );

  const risks = (result?.risks ?? [])
    .map((r) => ({
      risk: r.risk ?? '',
      engine: r.engine ?? '',
      severity: (['high', 'medium', 'low'].includes(r.severity) ? r.severity : 'medium') as 'high' | 'medium' | 'low',
      evidence: r.evidence ?? '',
    }))
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);

  const decisions = (result?.decisions ?? []).filter((d) => d.decision && d.owner);

  const gates: { gate: string; note: string }[] = [];
  const dropped = (result?.decisions?.length ?? 0) - decisions.length;
  if (dropped > 0) {
    gates.push({ gate: 'Decision gate', note: `${dropped} item${dropped > 1 ? 's' : ''} lacked a named owner and were dropped — an unowned decision is not a decision.` });
  }
  const high = risks.filter((r) => r.severity === 'high').length;
  if (high > 0) {
    gates.push({ gate: 'Risk gate', note: `${high} cross-engine risk${high > 1 ? 's' : ''} rated high — these span lanes, so no single engine owner will catch them.` });
  }
  if (!result?.changed?.length && !result?.this_week?.length) {
    gates.push({ gate: 'Evidence gate', note: 'No engine outputs were usable — the brief is empty rather than invented. Provide the engine results.' });
  }

  return {
    verdict: result?.verdict ?? 'Command brief unavailable.',
    changed: (result?.changed ?? []).slice(0, 8).map((c) => ({ engine: c.engine ?? '', what: c.what ?? '', source: c.source ?? '' })),
    decisions: decisions.slice(0, 6).map((d) => ({ decision: d.decision ?? '', owner: d.owner ?? '', why: d.why ?? '', engine: d.engine ?? '' })),
    risks: risks.slice(0, 6),
    opportunities: (result?.opportunities ?? []).slice(0, 5).map((o) => ({ opportunity: o.opportunity ?? '', engine: o.engine ?? '', why: o.why ?? '' })),
    this_week: (result?.this_week ?? []).slice(0, 6).map((a) => ({ action: a.action ?? '', owner: a.owner ?? '', engine: a.engine ?? '' })),
    gates,
    measured_vs_inferred: {
      measured: ['Engine outputs (as provided)', 'Decision-owner check + severity ordering (computed)'],
      inferred: ['What changed', 'Cross-engine risks + opportunities', 'The week\'s actions'],
    },
  };
}
