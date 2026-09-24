import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Forecast Analyser — the Operations-engine confidence agent. Turns a pipeline
 * export into the two numbers a leader commits to (commit) and the realistic
 * upside above it (best case), plus the gap between them and what closes it.
 *
 * Gates (registry): commit is held to a defensible bar (stage + hygiene); if the
 * gap between commit and target is uncloseable from the current pipeline, say so.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's pipeline,
 * the two numbers derived from stage-weighted math, honest when the gap can't be
 * closed from what exists.
 */

export interface ForecastSlice {
  segment: string;
  commit: string;
  upside: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ForecastResult {
  commit: { value: string; note: string };
  best_case: { value: string; note: string };
  target: { value: string | null; gap: string | null };
  slices: ForecastSlice[];
  gap_analysis: { gap: string; can_close: string; from: string[] };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface ForecastInput {
  pipelineExport: string;
  target?: string;
  period?: string;
  hygieneNotes?: string;
  onUsage?: UsageCallback;
}

export async function runForecastAnalyser(env: Env, input: ForecastInput): Promise<ForecastResult> {
  const { pipelineExport, target, period, hygieneNotes, onUsage } = input;

  const result = await chatJson<{
    commit_value: string;
    commit_note: string;
    best_case_value: string;
    best_case_note: string;
    gap: string | null;
    gap_can_close: string;
    gap_from: string[];
    slices: { segment: string; commit: string; upside: string; confidence: 'high' | 'medium' | 'low' }[];
  }>(
    env,
    `You are a revenue forecasting analyst. From the pipeline export below, produce the two numbers a leader commits to.

RULES:
- commit: deals you would bet the quarter on — later stage, close date inside the period, no hygiene blockers. State the value and the reasoning.
- best_case: commit PLUS the credible upside (early-stage deals with real signal) — but never count deals that are stalled, missing amounts, or have no owner.
- If a target is given, compute the gap = target − commit, and say whether the current pipeline can close it: "from" lists the specific deals/stages that would have to land for the gap to close. If nothing in the pipeline bridges it, say so plainly.
- Work ONLY from the rows provided. Never invent deals. If amounts/period are ambiguous, say so.
- confidence per slice: high = stage + date + owner + amount all present and recent; medium = one field weak; low = multiple gaps.

PERIOD: ${period || 'not stated'}
${target ? `TARGET: ${target}` : 'TARGET: not stated'}
${hygieneNotes ? `HYGIENE NOTES: ${hygieneNotes}` : ''}

PIPELINE EXPORT:
${pipelineExport}

Return JSON: {"commit_value": "...", "commit_note": "...", "best_case_value": "...", "best_case_note": "...", "gap": "..."|null, "gap_can_close": "...", "gap_from": ["..."], "slices": [{"segment","commit","upside","confidence"}]}`,
    `Produce the commit and best-case numbers, and the gap analysis.`,
    { temperature: 0.2, maxTokens: 2800, onUsage },
  );

  const gates: { gate: string; note: string }[] = [];
  const gap = result?.gap ?? null;
  const canClose = (result?.gap_can_close ?? '').toLowerCase();
  if (gap && /cannot|can't|unable|no|not enough|shortfall|insufficient|unbridgeable/.test(canClose)) {
    gates.push({ gate: 'Coverage gate', note: 'The current pipeline cannot close the target gap — the number depends on deals not yet in the pipeline.' });
  }
  if (!target) {
    gates.push({ gate: 'Target gate', note: 'No target given — the commit and best-case are absolute numbers; the gap is not quantified.' });
  }

  return {
    commit: { value: result?.commit_value ?? 'unknown', note: result?.commit_note ?? '' },
    best_case: { value: result?.best_case_value ?? 'unknown', note: result?.best_case_note ?? '' },
    target: { value: target ?? null, gap },
    slices: (result?.slices ?? []).map((s) => ({
      segment: s.segment ?? 'Unsegmented',
      commit: s.commit ?? '—',
      upside: s.upside ?? '—',
      confidence: (['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'low') as ForecastSlice['confidence'],
    })).slice(0, 8),
    gap_analysis: {
      gap: gap ?? 'No target to measure against',
      can_close: result?.gap_can_close ?? 'Not assessed.',
      from: (result?.gap_from ?? []).slice(0, 6),
    },
    gates,
    measured_vs_inferred: {
      measured: ['Deal rows, stages, amounts, dates, owners (from your export)', 'Commit/best-case arithmetic (derived from your rows)', 'Coverage gate (computed)'],
      inferred: ['Which deals clear the commit bar', 'Confidence per slice', 'Whether the gap can close'],
    },
  };
}