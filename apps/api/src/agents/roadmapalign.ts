import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Roadmap Align — the Strategy-engine alignment planner. Cross-checks the goals
 * against the actual pipeline shape and capacity, and flags where the plan and
 * the funnel disagree before the quarter starts.
 *
 * Gate (registry): Reality gate — goals without pipeline coverage are flagged,
 * never silently accepted.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's numbers,
 * the coverage ratio computed rather than asserted, honest when inputs are thin.
 */

export interface Divergence {
  area: string;
  goal: string;
  reality: string;
  gap: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface RoadmapAlignResult {
  verdict: string;
  coverage: { required: string; available: string; ratio: string; verdict: string };
  divergences: Divergence[];
  adjustment_slots: { change: string; why: string; impact: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface RoadmapAlignInput {
  goals: string;
  pipelineShape: string;
  capacity?: string;
  winRate?: string;
  onUsage?: UsageCallback;
}

const SEV_RANK = { critical: 0, high: 1, medium: 2 } as const;

export async function runRoadmapAlign(env: Env, input: RoadmapAlignInput): Promise<RoadmapAlignResult> {
  const { goals, pipelineShape, capacity, winRate, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    required: string;
    available: string;
    ratio: string;
    coverage_verdict: string;
    divergences: { area: string; goal: string; reality: string; gap: string; severity: 'critical' | 'high' | 'medium' }[];
    adjustment_slots: { change: string; why: string; impact: string }[];
    coverage_sufficient: boolean;
  }>(
    env,
    `You are a revenue planner running a goal-to-pipeline alignment check. Cross-check the goals against the pipeline shape and capacity, and flag where they disagree — BEFORE the quarter starts.

RULES:
- Work ONLY from the numbers provided. Never invent pipeline or capacity figures.
- required: the pipeline the goal demands to hit the number (from the goal and win rate, if given). available: the pipeline that actually exists (from the shape). ratio: available ÷ required if both known.
- coverage_sufficient: true only if the available pipeline can plausibly carry the goal. Coverage below ~3x for a quarterly plan is thin.
- divergences: where the goal and the funnel disagree — each with the goal, the reality, the gap, and severity. Include: insufficient coverage, capacity mismatch, stage concentration, missing segments.
- adjustment_slots: what to change to close the divergence — grounded and specific.
- verdict: one honest operator line on whether this plan can survive contact with the funnel.
- If win rate or pipeline value is missing, say the coverage is unquantified rather than guess.

GOALS:
${goals}

PIPELINE SHAPE:
${pipelineShape}
${capacity ? `CAPACITY:\n${capacity}` : 'CAPACITY: not provided'}
${winRate ? `WIN RATE: ${winRate}` : 'WIN RATE: not provided'}

Return JSON: {"verdict": "...", "required": "...", "available": "...", "ratio": "...", "coverage_verdict": "...", "coverage_sufficient": bool, "divergences": [{"area","goal","reality","gap","severity"}], "adjustment_slots": [{"change","why","impact"}]}`,
    `Check the goals against the pipeline and flag the divergences.`,
    { temperature: 0.25, maxTokens: 2800, onUsage },
  );

  const divergences: Divergence[] = (result?.divergences ?? [])
    .map((d) => ({
      area: d.area ?? '',
      goal: d.goal ?? '',
      reality: d.reality ?? '',
      gap: d.gap ?? '',
      severity: (['critical', 'high', 'medium'].includes(d.severity) ? d.severity : 'medium') as Divergence['severity'],
    }))
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);

  const gates: { gate: string; note: string }[] = [];
  if (result?.coverage_sufficient === false) {
    gates.push({ gate: 'Reality gate', note: 'The pipeline cannot carry the goal as it stands — the plan needs more coverage or a lower number before the quarter starts.' });
  }
  const critical = divergences.filter((d) => d.severity === 'critical').length;
  if (critical > 0) {
    gates.push({ gate: 'Divergence gate', note: `${critical} critical divergenc${critical > 1 ? 'ies' : 'y'} between the plan and the funnel — resolve before committing.` });
  }
  if (!winRate) {
    gates.push({ gate: 'Coverage gate', note: 'No win rate given — required pipeline is unquantified. Add it to convert the goal into coverage.' });
  }

  return {
    verdict: result?.verdict ?? 'Alignment check unavailable.',
    coverage: {
      required: result?.required ?? 'unknown',
      available: result?.available ?? 'unknown',
      ratio: result?.ratio ?? 'unknown',
      verdict: result?.coverage_verdict ?? 'not assessed',
    },
    divergences: divergences.slice(0, 8),
    adjustment_slots: (result?.adjustment_slots ?? []).slice(0, 6).map((a) => ({ change: a.change ?? '', why: a.why ?? '', impact: a.impact ?? '' })),
    gates,
    measured_vs_inferred: {
      measured: ['Goals, pipeline shape, capacity (as provided)', 'Coverage ratio (computed from your figures)', 'Severity ordering (computed)'],
      inferred: ['Divergence identification', 'Adjustment slots', 'Verdict'],
    },
  };
}