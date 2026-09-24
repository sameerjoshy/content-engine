import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Qualifier — the Sales-engine agent that scores a deal against a framework,
 * surfaces exactly what is unknown, and flags stage-evidence mismatches.
 *
 * Rule (registry gate): it NEVER moves a deal. It tells you what you don't
 * know before it costs you the quarter. Every score cites the deal context the
 * operator provided — no invented facts; a gap is a gap.
 *
 * Built against AGENT_QUALITY_STANDARD.md: grounded (quote or "not stated"),
 * measured-vs-inferred explicit, honest absence, operator voice.
 */

export type QualifierFramework = 'MEDDIC' | 'SPICED' | 'BANT';
export type CriterionStatus = 'present' | 'partial' | 'missing';

export interface CriterionScore {
  criterion: string;
  status: CriterionStatus;
  /** The exact quote from the deal context that supports the status, or null if not stated. */
  evidence: string | null;
  /** What is missing / what to ask next (only when not present). */
  gap: string | null;
}

export interface RiskFlag {
  severity: 'hard' | 'warn';
  flag: string;
  why: string;
}

export interface QualifierResult {
  framework: QualifierFramework;
  stage: string;
  /** 0-100 readiness, computed from the criterion scores (deterministic). */
  readiness: number;
  verdict: string;
  scorecard: CriterionScore[];
  gap_questions: string[];
  risk_flags: RiskFlag[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface QualifierInput {
  dealContext: string;
  dealStage: string;
  framework: QualifierFramework;
  paperProcess?: string;
  onUsage?: UsageCallback;
}

/**
 * The criteria per framework. Deterministic list so the scorecard is complete
 * and comparable — the LLM fills status + evidence, never invents criteria.
 */
const FRAMEWORK_CRITERIA: Record<QualifierFramework, string[]> = {
  MEDDIC: [
    'Metrics (quantified business impact)',
    'Economic Buyer (can reallocate budget)',
    'Decision Criteria (how they will choose)',
    'Decision Process (steps to signature)',
    'Identify Pain (the compelling reason)',
    'Champion (power + access + motivation)',
  ],
  SPICED: [
    'Situation (current state)',
    'Pain (the problem)',
    'Impact (cost of the pain)',
    'Critical Event (why now)',
    'Decision (who decides, and how)',
  ],
  BANT: [
    'Budget (allocated and available)',
    'Authority (who signs)',
    'Need (the compelling need)',
    'Timeline (when they will act)',
  ],
};

// Stages where a missing economic buyer / unmapped paper process is fatal.
const LATE_STAGES = ['proposal', 'negotiation', 'contract', 'legal', 'procurement', 'closed won'];

export async function runQualifier(env: Env, input: QualifierInput): Promise<QualifierResult> {
  const { dealContext, dealStage, framework, paperProcess, onUsage } = input;
  const criteria = FRAMEWORK_CRITERIA[framework];

  const result = await chatJson<{
    verdict: string;
    scorecard: { criterion: string; status: CriterionStatus; evidence: string | null; gap: string | null }[];
    gap_questions: string[];
  }>(
    env,
    `You are a senior B2B deal strategist running a ${framework} qualification review. You are rigorous and skeptical: your job is to surface what is NOT known before it costs the deal — not to make the rep feel good.

RULES (non-negotiable):
- Score ONLY the criteria listed below, in order. Do not invent criteria.
- For each criterion: status = present | partial | missing.
  - present: the deal context explicitly supports it. Quote the exact supporting text in "evidence".
  - partial: hinted at but not confirmed. Quote the hint; name what's missing in "gap".
  - missing: the context does not address it. evidence = null; gap = what to find out.
- NEVER invent facts. If the context is silent, the criterion is "missing" — a gap is a gap.
- gap_questions: one sharp, exact question per criterion that is not "present" — the question the rep should ask next.
- verdict: one line, operator voice, no hedging — states readiness truthfully.

DEAL STAGE: ${dealStage}
FRAMEWORK: ${framework}
CRITERIA: ${criteria.join(' | ')}

DEAL CONTEXT:
${dealContext}

Return JSON: {"verdict": "one-line readiness", "scorecard": [{"criterion","status","evidence","gap"}], "gap_questions": ["..."]}`,
    `Run the ${framework} qualification review on the provided deal context.`,
    { temperature: 0.2, maxTokens: 2500, onUsage },
  );

  // Normalize the scorecard to the exact criteria list (never trust invented ones).
  const byCriterion = new Map((result?.scorecard ?? []).map((s) => [s.criterion?.toLowerCase?.() ?? '', s]));
  const scorecard: CriterionScore[] = criteria.map((c) => {
    const match = byCriterion.get(c.toLowerCase()) ?? (result?.scorecard ?? []).find((s) => s.criterion && c.toLowerCase().includes(s.criterion.toLowerCase()));
    return {
      criterion: c,
      status: match?.status ?? 'missing',
      evidence: match?.evidence ?? null,
      gap: match?.gap ?? (match?.status && match.status !== 'present' ? 'Not stated in the context.' : null),
    };
  });

  // Deterministic readiness: present=1, partial=0.5, missing=0.
  const points = scorecard.reduce((n, s) => n + (s.status === 'present' ? 1 : s.status === 'partial' ? 0.5 : 0), 0);
  const readiness = Math.round((points / scorecard.length) * 100);

  // Deterministic risk flags (the registry gates) — computed, not inferred.
  const risk_flags: RiskFlag[] = [];
  const stageLower = dealStage.toLowerCase();
  const isLate = LATE_STAGES.some((s) => stageLower.includes(s));
  const eb = scorecard.find((s) => /economic buyer|authority/i.test(s.criterion));
  if (isLate && eb && eb.status !== 'present') {
    risk_flags.push({ severity: 'hard', flag: 'Late stage without a confirmed economic buyer', why: 'At this stage the deal cannot close without the person who can reallocate budget. Confirm them before anything else.' });
  }
  const paper = (paperProcess ?? '').toLowerCase();
  // Flag when the paper process is absent OR explicitly not-yet-started / unmapped.
  const paperNegative = /not started|not yet|not mapped|pending|tbd|none|no legal|unmapped|hasn't|has not|awaiting|haven't started/.test(paper);
  if (isLate && (!paper || paperNegative)) {
    risk_flags.push({ severity: 'hard', flag: 'Paper process not mapped', why: 'Legal / procurement / security review unmapped is a hidden 4–8 week cycle. A six-week procurement found late kills the quarter.' });
  }
  // Single-threading: no stakeholder names beyond one implied contact.
  const stakeholderMentions = (dealContext.match(/\b(cto|ceo|cfo|vp|director|head of|manager|champion|economic buyer)\b/gi) ?? []).length;
  if (stakeholderMentions <= 1 && stageLower !== 'prospecting' && stageLower !== 'discovery') {
    risk_flags.push({ severity: 'warn', flag: 'Possible single-threading', why: 'Only one contact is evident. One engaged contact is a risk above Discovery — find a second path in.' });
  }

  const gap_questions = (result?.gap_questions ?? []).filter((q) => q && q.length > 5).slice(0, criteria.length);

  const present = scorecard.filter((s) => s.status === 'present').length;
  const missing = scorecard.filter((s) => s.status === 'missing').length;
  const verdict =
    result?.verdict ??
    `${present}/${scorecard.length} criteria confirmed, ${missing} unknown — ${readiness}% ready. ${risk_flags.some((r) => r.severity === 'hard') ? 'Hard risks present; resolve them before advancing.' : 'No hard blockers detected.'}`;

  return {
    framework,
    stage: dealStage,
    readiness,
    verdict,
    scorecard,
    gap_questions,
    risk_flags,
    measured_vs_inferred: {
      measured: ['Deal context quotes (evidence per criterion)', 'Stage / paper-process inputs', 'Readiness score (computed from criterion statuses)'],
      inferred: ['Criterion present/partial/missing classification', 'Risk-flag relevance'],
    },
  };
}