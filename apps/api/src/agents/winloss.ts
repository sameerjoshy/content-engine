import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Win/Loss — the Operations-engine learning agent. Reads closed-won and
 * closed-lost deals, extracts the patterns that actually separate them, and
 * turns them into what to do more of and what to stop.
 *
 * Gates (registry): separates measured patterns (from your data) from inference;
 * flags when a "reason" is sales-reported vs. evidence-based.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's closed
 * deals, patterns ranked by evidence, honest about thin samples.
 */

export interface WinLossPattern {
  pattern: string;
  direction: 'win' | 'loss';
  evidence: string;
  sample: string;
}

export interface WinLossResult {
  verdict: string;
  win_patterns: WinLossPattern[];
  loss_patterns: WinLossPattern[];
  reasons: { reason: string; reported_share: string; evidence_based: boolean }[];
  actions: { do_more: string[]; stop: string[] };
  sample: { total: number; won: number; lost: number; win_rate: number; thin: boolean };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface WinLossInput {
  dealExport: string;
  period?: string;
  onUsage?: UsageCallback;
}

const MIN_SAMPLE = 15;

export async function runWinLoss(env: Env, input: WinLossInput): Promise<WinLossResult> {
  const { dealExport, period, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    win_patterns: { pattern: string; evidence: string; sample: string }[];
    loss_patterns: { pattern: string; evidence: string; sample: string }[];
    reasons: { reason: string; reported_share: string; evidence_based: boolean }[];
    do_more: string[];
    stop: string[];
    total: number;
    won: number;
    lost: number;
  }>(
    env,
    `You are a revenue analyst running a win/loss review. From the closed deals below, extract the patterns that separate wins from losses.

RULES:
- Work ONLY from the rows provided. Never invent deals or reasons.
- win_patterns / loss_patterns: each pattern must cite supporting evidence (which deals, which field) and a sample size. Do not state a pattern a single deal can carry.
- reasons: the stated loss/win reasons in the data. reported_share = rough share of losses attributed to it. evidence_based = true only if the data (not just a rep's note) supports it.
- Report the honest sample: total closed, won, lost.
- do_more / stop: concrete, grounded in the patterns — no generic sales advice. Each must trace to a pattern above.
- If the sample is thin, say so rather than overfitting.

PERIOD: ${period || 'all closed deals in the export'}

DEAL EXPORT:
${dealExport}

Return JSON: {"verdict": "...", "win_patterns": [{"pattern","evidence","sample"}], "loss_patterns": [{"pattern","evidence","sample"}], "reasons": [{"reason","reported_share","evidence_based"}], "do_more": ["..."], "stop": ["..."], "total": n, "won": n, "lost": n}`,
    `Extract win/loss patterns and the actions that follow.`,
    { temperature: 0.25, maxTokens: 2800, onUsage },
  );

  const total = result?.total ?? 0;
  const won = result?.won ?? 0;
  const lost = result?.lost ?? 0;
  const thin = total < MIN_SAMPLE;

  const gates: { gate: string; note: string }[] = [];
  if (thin) {
    gates.push({ gate: 'Sample gate', note: `Only ${total} closed deals — below the ${MIN_SAMPLE} needed for a confident pattern. Treat these as hypotheses, not conclusions.` });
  }
  const reportedOnly = (result?.reasons ?? []).filter((r) => !r.evidence_based).length;
  if (reportedOnly > 0) {
    gates.push({ gate: 'Evidence gate', note: `${reportedOnly} stated reason${reportedOnly > 1 ? 's' : ''} rest on rep notes, not data — verify before acting.` });
  }

  const wp: WinLossPattern[] = (result?.win_patterns ?? []).map((p) => ({ pattern: p.pattern ?? '', direction: 'win' as const, evidence: p.evidence ?? '', sample: p.sample ?? '' }));
  const lp: WinLossPattern[] = (result?.loss_patterns ?? []).map((p) => ({ pattern: p.pattern ?? '', direction: 'loss' as const, evidence: p.evidence ?? '', sample: p.sample ?? '' }));

  return {
    verdict: result?.verdict ?? 'Review unavailable.',
    win_patterns: wp.slice(0, 6),
    loss_patterns: lp.slice(0, 6),
    reasons: (result?.reasons ?? []).slice(0, 6),
    actions: { do_more: (result?.do_more ?? []).slice(0, 5), stop: (result?.stop ?? []).slice(0, 5) },
    sample: { total, won, lost, win_rate: total ? Math.round((won / total) * 100) / 100 : 0, thin },
    gates,
    measured_vs_inferred: {
      measured: ['Closed-deal outcomes + fields (from your export)', 'Win rate + sample size (computed)', 'Reported reasons (as stated)'],
      inferred: ['Pattern extraction', 'Actions to take', 'Which reasons are evidence-based'],
    },
  };
}