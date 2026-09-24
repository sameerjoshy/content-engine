import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Planning Cycle — the Strategy-engine quarterly operating loop. It runs the
 * retrospective on last quarter (target vs actual) and turns the lessons into
 * focus areas for the next one.
 *
 * Gate (registry): a focus area must trace to a missed or beaten target — no
 * focus without evidence. Priorities are capped so the quarter stays focused.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's numbers,
 * lessons tied to named targets, honest about what is unknown.
 */

export interface TargetLine {
  target: string;
  set: string | null;
  actual: string | null;
  result: 'beat' | 'met' | 'missed' | 'unknown';
  lesson: string | null;
}

export interface PlanningCycleResult {
  verdict: string;
  retrospective: TargetLine[];
  scorecard: { beat: number; met: number; missed: number; unknown: number };
  focus_areas: { area: string; why: string; traces_to: string }[];
  carryover: string[];
  drop: string[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface PlanningCycleInput {
  lastQuarterData: string;
  context?: string;
  quarter?: string;
  onUsage?: UsageCallback;
}

const RESULT_RANK = { missed: 0, unknown: 1, met: 2, beat: 3 } as const;

export async function runPlanningCycle(env: Env, input: PlanningCycleInput): Promise<PlanningCycleResult> {
  const { lastQuarterData, context, quarter, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    retrospective: { target: string; set: string | null; actual: string | null; result: 'beat' | 'met' | 'missed' | 'unknown'; lesson: string | null }[];
    focus_areas: { area: string; why: string; traces_to: string }[];
    carryover: string[];
    drop: string[];
  }>(
    env,
    `You are a revenue operator running the quarterly planning cycle. From last quarter's targets and actuals, run the retrospective and set the focus for next quarter.

RULES:
- Work ONLY from the data provided. Never invent targets or numbers.
- retrospective: each target with what was set, what actually happened, result (beat/met/missed/unknown), and the lesson — stated only if the data supports it.
- focus_areas: the 2-4 areas to focus NEXT quarter. EACH must trace_to a specific target above (missed or beaten). No focus area without a trace. Keep it tight — a quarter with eight priorities has none.
- carryover: targets that didn't finish and should continue. drop: things that should be killed.
- verdict: one honest operator-voice line on how the quarter actually went.
- Do not soften a miss; do not celebrate a beat that missed the real goal.

QUARTER: ${quarter || 'last quarter'}
${context ? `CONTEXT: ${context}` : ''}

LAST QUARTER — TARGETS + ACTUALS:
${lastQuarterData}

Return JSON: {"verdict": "...", "retrospective": [{"target","set","actual","result","lesson"}], "focus_areas": [{"area","why","traces_to"}], "carryover": ["..."], "drop": ["..."]}`,
    `Run the retrospective and set next quarter's focus.`,
    { temperature: 0.3, maxTokens: 2800, onUsage },
  );

  const retrospective: TargetLine[] = (result?.retrospective ?? []).map((t) => ({
    target: t.target ?? '',
    set: t.set ?? null,
    actual: t.actual ?? null,
    result: (['beat', 'met', 'missed', 'unknown'].includes(t.result) ? t.result : 'unknown') as TargetLine['result'],
    lesson: t.lesson ?? null,
  })).sort((a, b) => RESULT_RANK[a.result] - RESULT_RANK[b.result]);

  const scorecard = {
    beat: retrospective.filter((t) => t.result === 'beat').length,
    met: retrospective.filter((t) => t.result === 'met').length,
    missed: retrospective.filter((t) => t.result === 'missed').length,
    unknown: retrospective.filter((t) => t.result === 'unknown').length,
  };

  const focusRaw = (result?.focus_areas ?? []).slice(0, 4);
  const focus_areas = focusRaw.map((f) => ({ area: f.area ?? '', why: f.why ?? '', traces_to: f.traces_to ?? '' }));

  const gates: { gate: string; note: string }[] = [];
  if (scorecard.missed > 0) {
    gates.push({ gate: 'Miss gate', note: `${scorecard.missed} target${scorecard.missed > 1 ? 's' : ''} missed — the focus areas must answer for ${scorecard.missed > 1 ? 'them' : 'it'}, not bury it.` });
  }
  if ((result?.focus_areas?.length ?? 0) > 4) {
    gates.push({ gate: 'Focus gate', note: 'More than 4 focus areas were proposed — trimmed to the sharpest. A quarter with too many priorities has none.' });
  }
  const untraced = focus_areas.filter((f) => !f.traces_to).length;
  if (untraced > 0) {
    gates.push({ gate: 'Trace gate', note: `${untraced} focus area${untraced > 1 ? 's' : ''} don't trace to a target — a focus without evidence is a wish.` });
  }

  return {
    verdict: result?.verdict ?? 'Retrospective unavailable.',
    retrospective: retrospective.slice(0, 15),
    scorecard,
    focus_areas,
    carryover: (result?.carryover ?? []).slice(0, 5),
    drop: (result?.drop ?? []).slice(0, 5),
    gates,
    measured_vs_inferred: {
      measured: ['Targets + actuals (as provided)', 'Result classification + scorecard (computed)', 'Focus-area cap (computed)'],
      inferred: ['Lessons', 'Focus areas', 'Carryover / drop calls'],
    },
  };
}