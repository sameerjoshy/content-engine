import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Goal Integrity — the Strategy-engine agent that checks an OKR tree for real.
 * It traces every objective down to measurable key results, flags objectives
 * that are aspiration not commitment, and detects the ways a metric gets gamed
 * while the number still looks green.
 *
 * Gates (registry): no objective without a measurable KR; every gaming flag
 * names the metric and the loophole.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's OKR tree,
 * alignment evidence from the tree itself, gaming flags stated as questions the
 * operator can verify.
 */

export interface AlignmentIssue {
  objective: string;
  issue: string;
  detail: string;
}

export interface GamingFlag {
  metric: string;
  loophole: string;
  question: string;
  severity: 'high' | 'medium';
}

export interface GoalIntegrityResult {
  verdict: string;
  coverage: { objectives: number; with_measurable_kr: number; aligned_to_company: number };
  alignment: AlignmentIssue[];
  gaming_flags: GamingFlag[];
  score: { value: number; label: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface GoalIntegrityInput {
  okrTree: string;
  companyPriorities?: string;
  onUsage?: UsageCallback;
}

export async function runGoalIntegrity(env: Env, input: GoalIntegrityInput): Promise<GoalIntegrityResult> {
  const { okrTree, companyPriorities, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    objectives: number;
    with_measurable_kr: number;
    aligned_to_company: number;
    alignment: { objective: string; issue: string; detail: string }[];
    gaming_flags: { metric: string; loophole: string; question: string; severity: 'high' | 'medium' }[];
  }>(
    env,
    `You are an OKR integrity auditor. From the OKR tree below, verify that every objective is real: measurable, aligned, and not gameable.

RULES:
- objectives: count the objectives. with_measurable_kr: objectives that have at least one key result with a number and a threshold. aligned_to_company: objectives that clearly ladder to the stated company priorities.
- alignment: list objectives that FAIL on measurability or alignment. Each states the specific issue (e.g. "aspiration with no number", "ladders to nothing above it").
- gaming_flags: the hard part — for each metric that can be hit without achieving the real goal, name the loophole and the ONE question a leader should ask to expose it. Think: revenue booked that churns tomorrow, "activities" that don't move outcomes, percentages of tiny bases, quality traded for speed. Only flag metrics that appear in the tree.
- verdict: one honest sentence on whether this OKR tree can be trusted to drive the business.
- Work ONLY from the tree provided. Never invent objectives or metrics.

${companyPriorities ? `COMPANY PRIORITIES:\n${companyPriorities}` : 'COMPANY PRIORITIES: not stated'}

OKR TREE:
${okrTree}

Return JSON: {"verdict": "...", "objectives": n, "with_measurable_kr": n, "aligned_to_company": n, "alignment": [{"objective","issue","detail"}], "gaming_flags": [{"metric","loophole","question","severity"}]}`,
    `Audit the OKR tree for alignment and gaming risk.`,
    { temperature: 0.3, maxTokens: 2800, onUsage },
  );

  const coverage = {
    objectives: result?.objectives ?? 0,
    with_measurable_kr: result?.with_measurable_kr ?? 0,
    aligned_to_company: result?.aligned_to_company ?? 0,
  };

  const gates: { gate: string; note: string }[] = [];
  const missing = coverage.objectives - coverage.with_measurable_kr;
  if (missing > 0) {
    gates.push({ gate: 'Measurability gate', note: `${missing} objective${missing > 1 ? 's' : ''} have no measurable key result — they can't be graded, only described.` });
  }
  const highGaming = (result?.gaming_flags ?? []).filter((f) => f.severity === 'high').length;
  if (highGaming > 0) {
    gates.push({ gate: 'Gaming gate', note: `${highGaming} metric${highGaming > 1 ? 's' : ''} can be hit without achieving the real goal — see the flags.` });
  }

  const measurablePct = coverage.objectives ? coverage.with_measurable_kr / coverage.objectives : 0;
  const alignedPct = coverage.objectives ? coverage.aligned_to_company / coverage.objectives : 0;
  const scoreValue = Math.max(5, Math.round(measurablePct * 55 + alignedPct * 45) - highGaming * 8);
  const label = scoreValue >= 85 ? 'Integrity holds' : scoreValue >= 60 ? 'Partial integrity' : scoreValue >= 35 ? 'Mostly theater' : 'Broken';

  return {
    verdict: result?.verdict ?? 'Audit unavailable.',
    coverage,
    alignment: (result?.alignment ?? []).slice(0, 8),
    gaming_flags: (result?.gaming_flags ?? []).slice(0, 6).map((f) => ({
      metric: f.metric ?? '',
      loophole: f.loophole ?? '',
      question: f.question ?? '',
      severity: (f.severity === 'high' ? 'high' : 'medium') as GamingFlag['severity'],
    })),
    score: { value: scoreValue, label },
    gates,
    measured_vs_inferred: {
      measured: ['Objectives + KR structure (from your tree)', 'Measurability + alignment counts (computed)', 'Score (computed)'],
      inferred: ['Which objectives fail', 'Gaming loopholes + the verifier question', 'Verdict'],
    },
  };
}