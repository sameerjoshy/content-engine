import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Goal Designer — the Strategy-engine OKR author. Takes focus areas and business
 * context and drafts an OKR set, then runs the ambition check: is each target a
 * real stretch, a sandbag, or a fantasy?
 *
 * Gate (registry): every objective gets at least one measurable KR, and the
 * ambition check flags sandbagged targets and unreachable ones.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the provided context,
 * ambition verdicts tied to baseline math, honest when a baseline is unknown.
 */

export interface DraftObjective {
  objective: string;
  key_results: { kr: string; baseline: string | null; target: string; measure: string }[];
  ambition: 'stretch' | 'realistic' | 'sandbag' | 'fantasy';
  ambition_why: string;
}

export interface GoalDesignerResult {
  verdict: string;
  objectives: DraftObjective[];
  health: { objectives: number; with_measurable_kr: number; stretch: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface GoalDesignerInput {
  focusAreas: string;
  context?: string;
  baseline?: string;
  horizon?: string;
  onUsage?: UsageCallback;
}

export async function runGoalDesigner(env: Env, input: GoalDesignerInput): Promise<GoalDesignerResult> {
  const { focusAreas, context, baseline, horizon, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    objectives: {
      objective: string;
      key_results: { kr: string; baseline: string | null; target: string; measure: string }[];
      ambition: 'stretch' | 'realistic' | 'sandbag' | 'fantasy';
      ambition_why: string;
    }[];
  }>(
    env,
    `You are a goal-design expert drafting an OKR set and pressure-testing the ambition. From the focus areas and context, write objectives with measurable key results — then judge whether each is a real stretch.

RULES:
- Each objective gets 2-4 key results. Every KR MUST have a number: baseline (where you are now), target (where you're going), and measure (how it's counted). If a baseline is unknown, put null and say so — do not invent one.
- ambition: "stretch" = meaningful but achievable if you do things differently (the bar). "realistic" = safe, probably hit with normal effort. "sandbag" = a target you'll beat without trying — too low. "fantasy" = no plausible path from the baseline.
- ambition_why: the math — how far the target is from the baseline and what it demands. Base it on the numbers, not vibes.
- Objectives lead with the outcome, not the activity. "Increase ARR to $1.8M" not "Do more outbound".
- verdict: one honest operator-voice line on whether this goal set is ambitious enough.
- Work ONLY from the provided focus areas and context.

FOCUS AREAS: ${focusAreas}
${context ? `CONTEXT: ${context}` : ''}
${baseline ? `BASELINE DATA: ${baseline}` : 'BASELINE DATA: not provided'}
HORIZON: ${horizon || 'one quarter'}

Return JSON: {"verdict": "...", "objectives": [{"objective","key_results":[{"kr","baseline","target","measure"}],"ambition","ambition_why"}]}`,
    `Draft the OKRs and run the ambition check.`,
    { temperature: 0.4, maxTokens: 3000, onUsage },
  );

  const objectives: DraftObjective[] = (result?.objectives ?? []).map((o) => ({
    objective: o.objective ?? '',
    key_results: (o.key_results ?? []).slice(0, 4).map((k) => ({
      kr: k.kr ?? '',
      baseline: k.baseline ?? null,
      target: k.target ?? '',
      measure: k.measure ?? '',
    })),
    ambition: (['stretch', 'realistic', 'sandbag', 'fantasy'].includes(o.ambition) ? o.ambition : 'realistic') as DraftObjective['ambition'],
    ambition_why: o.ambition_why ?? '',
  }));

  const health = {
    objectives: objectives.length,
    with_measurable_kr: objectives.filter((o) => o.key_results.length > 0 && o.key_results.every((k) => k.target)).length,
    stretch: objectives.filter((o) => o.ambition === 'stretch').length,
  };

  const gates: { gate: string; note: string }[] = [];
  const noKr = health.objectives - health.with_measurable_kr;
  if (noKr > 0) {
    gates.push({ gate: 'Measurability gate', note: `${noKr} objective${noKr > 1 ? 's' : ''} lack a number-and-threshold key result — that's a hope, not a goal.` });
  }
  const sandbags = objectives.filter((o) => o.ambition === 'sandbag').length;
  const fantasies = objectives.filter((o) => o.ambition === 'fantasy').length;
  if (sandbags) {
    gates.push({ gate: 'Ambition gate', note: `${sandbags} target${sandbags > 1 ? 's' : ''} read as sandbags — set at a level you'd beat without changing anything. Raise the bar or drop it.` });
  }
  if (fantasies) {
    gates.push({ gate: 'Feasibility gate', note: `${fantasies} target${fantasies > 1 ? 's' : ''} look unreachable from the baseline — a goal no one believes in is not a goal.` });
  }
  if (!result?.objectives?.length) {
    gates.push({ gate: 'Input gate', note: 'No focus areas produced objectives — give at least one direction to design against.' });
  }

  return {
    verdict: result?.verdict ?? 'Draft unavailable.',
    objectives: objectives.slice(0, 6),
    health,
    gates,
    measured_vs_inferred: {
      measured: ['Focus areas + context (as provided)', 'Measurability count + ambition flags (computed)'],
      inferred: ['Objective wording', 'KR design', 'Ambition verdicts'],
    },
  };
}