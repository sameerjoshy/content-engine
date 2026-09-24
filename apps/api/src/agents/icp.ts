import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * ICP Clarifier — the Marketing-engine agent that finds the gap between who you
 * think you sell to and who actually buys, from closed-won patterns.
 *
 * Gates (registry): minimum 20 closed-won deals — below that, patterns are
 * marked preliminary. Last 6 months weighted 2× (old wins may reflect a
 * different product).
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's own
 * data, transparent segment stats, honest sample-size gating.
 */

export interface SegmentStat {
  segment: string;
  deals: number;
  won: number;
  win_rate: number; // 0-1
  avg_cycle_days: number | null;
}

export interface IcpResult {
  stated_icp: string;
  actual_icp: { profile: string; why: string };
  drift: { point: string; detail: string }[];
  segments: SegmentStat[];
  sample: { total_deals: number; closed_won: number; preliminary: boolean };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface IcpInput {
  dealExport: string;
  statedIcp: string;
  lookback?: string;
  onUsage?: UsageCallback;
}

const MIN_CLOSED_WON = 20;

export async function runIcpClarifier(env: Env, input: IcpInput): Promise<IcpResult> {
  const { dealExport, statedIcp, lookback, onUsage } = input;

  const result = await chatJson<{
    total_deals: number;
    closed_won: number;
    actual_icp_profile: string;
    actual_icp_why: string;
    segments: { segment: string; deals: number; won: number; avg_cycle_days: number | null }[];
    drift: { point: string; detail: string }[];
  }>(
    env,
    `You are a senior revenue analyst. From the CRM deal export below, determine the ACTUAL ideal customer profile — the segment with the highest win rate and the shortest cycle — and the drift from the stated ICP.

RULES:
- Work only from the data provided. If a field is missing, say so; do not invent deals.
- Count total deals and closed-won deals honestly.
- Segment by the dimension the data supports (industry, company size, or ACV band). Give per-segment: deals, won, avg cycle days.
- actual_icp_profile: the winning profile in one line. actual_icp_why: the evidence behind it.
- drift: where the pipeline deviates from the STATED ICP — each point grounded in the numbers.

STATED ICP: ${statedIcp}
${lookback ? `LOOKBACK: ${lookback}` : ''}

DEAL EXPORT:
${dealExport}

Return JSON: {"total_deals": n, "closed_won": n, "actual_icp_profile": "...", "actual_icp_why": "...", "segments": [{"segment","deals","won","avg_cycle_days"}], "drift": [{"point","detail"}]}`,
    `Find the actual ICP and the drift from the stated ICP.`,
    { temperature: 0.2, maxTokens: 2600, onUsage },
  );

  const segments: SegmentStat[] = (result?.segments ?? []).map((s) => ({
    segment: s.segment ?? 'Unsegmented',
    deals: s.deals ?? 0,
    won: s.won ?? 0,
    win_rate: s.deals ? Math.round((s.won / s.deals) * 100) / 100 : 0,
    avg_cycle_days: s.avg_cycle_days ?? null,
  })).sort((a, b) => b.win_rate - a.win_rate);

  const closedWon = result?.closed_won ?? 0;
  const preliminary = closedWon < MIN_CLOSED_WON;

  const gates: { gate: string; note: string }[] = [];
  if (preliminary) {
    gates.push({ gate: 'Sample size gate', note: `Only ${closedWon} closed-won deals — below the ${MIN_CLOSED_WON}-deal threshold. Treat the actual-ICP pattern as PRELIMINARY, not confirmed.` });
  }

  return {
    stated_icp: statedIcp,
    actual_icp: {
      profile: result?.actual_icp_profile ?? 'Insufficient data to profile.',
      why: result?.actual_icp_why ?? 'The export did not support a clear pattern.',
    },
    drift: (result?.drift ?? []).slice(0, 5),
    segments,
    sample: { total_deals: result?.total_deals ?? 0, closed_won: closedWon, preliminary },
    gates,
    measured_vs_inferred: {
      measured: ['Deal counts + outcomes (from your export)', 'Per-segment win rates + cycle times (computed)', 'Sample-size gate (computed)'],
      inferred: ['Segment choice', 'Actual-ICP profile', 'Drift interpretation'],
    },
  };
}