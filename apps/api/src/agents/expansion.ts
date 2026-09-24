import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Expansion Radar — the Sustain-engine growth agent. Finds which healthy
 * accounts are ready to expand, what to sell them, and the trigger to move now.
 * The mirror of Churn Radar: it protects the book, this grows it.
 *
 * Gates (registry): never pitch expansion to an account showing churn signals —
 * the churn gate runs first and suppresses the expansion motion.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's account
 * data, readiness tied to named evidence, honest when the signal isn't there.
 */

export interface ExpansionAccount {
  account: string;
  readiness: 'ready' | 'warming' | 'not-yet';
  signal: string;
  offer: string;
  value: string | null;
}

export interface ExpansionRadarResult {
  verdict: string;
  accounts: ExpansionAccount[];
  summary: { ready: number; warming: number; not_yet: number; pipeline_value: string };
  playbook: { window: string; move: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface ExpansionRadarInput {
  accountData: string;
  offerings?: string;
  onUsage?: UsageCallback;
}

const RANK = { ready: 0, warming: 1, 'not-yet': 2 } as const;

export async function runExpansionRadar(env: Env, input: ExpansionRadarInput): Promise<ExpansionRadarResult> {
  const { accountData, offerings, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    accounts: { account: string; readiness: 'ready' | 'warming' | 'not-yet'; signal: string; offer: string; value: string | null }[];
    pipeline_value: string;
    playbook: { window: string; move: string }[];
  }>(
    env,
    `You are an expansion analyst. From the account data below, find which accounts are ready to expand, what to sell, and the trigger to move.

RULES:
- Work ONLY from the rows provided. Never invent accounts.
- readiness: "ready" = strong health + clear headroom (usage near a limit, multiple teams, new use case). "warming" = healthy but the trigger isn't clear yet. "not-yet" = churn signals, low usage, or no headroom.
- CRITICAL: if an account shows churn signals (usage decline, detractor NPS, escalations), it is "not-yet" for expansion — protect first, sell later. Never pitch a shrinking account.
- signal: the specific evidence of headroom. offer: what to sell (from the offerings if given). value: expected expansion value if derivable, else null.
- pipeline_value: combined expected value of "ready" accounts (or "unknown").
- playbook: 2-3 timing-based moves ("window" = when, "move" = what to do).
- Honest over eager: expansion to an unhealthy account is a churn accelerant, not growth.

${offerings ? `OFFERINGS:\n${offerings}` : 'OFFERINGS: not specified'}

ACCOUNT DATA:
${accountData}

Return JSON: {"verdict": "...", "accounts": [{"account","readiness","signal","offer","value"}], "pipeline_value": "...", "playbook": [{"window","move"}]}`,
    `Find expansion-ready accounts and the offers to lead with.`,
    { temperature: 0.3, maxTokens: 2800, onUsage },
  );

  const accounts: ExpansionAccount[] = (result?.accounts ?? [])
    .map((a) => ({
      account: a.account ?? 'Unknown',
      readiness: (['ready', 'warming', 'not-yet'].includes(a.readiness) ? a.readiness : 'warming') as ExpansionAccount['readiness'],
      signal: a.signal ?? '',
      offer: a.offer ?? '',
      value: a.value ?? null,
    }))
    .sort((a, b) => RANK[a.readiness] - RANK[b.readiness]);

  const summary = {
    ready: accounts.filter((a) => a.readiness === 'ready').length,
    warming: accounts.filter((a) => a.readiness === 'warming').length,
    not_yet: accounts.filter((a) => a.readiness === 'not-yet').length,
    pipeline_value: result?.pipeline_value ?? 'unknown',
  };

  const gates: { gate: string; note: string }[] = [];
  const suppressed = accounts.filter((a) => a.readiness === 'not-yet').length;
  if (suppressed > 0) {
    gates.push({ gate: 'Churn gate', note: `${suppressed} account${suppressed > 1 ? 's' : ''} suppressed from expansion — showing risk signals. Protect before you pitch.` });
  }
  if (summary.ready === 0) {
    gates.push({ gate: 'Readiness gate', note: 'No account is clearly expansion-ready — the signal is warming, not here. Do not force a motion.' });
  }

  return {
    verdict: result?.verdict ?? 'Expansion read unavailable.',
    accounts: accounts.slice(0, 25),
    summary,
    playbook: (result?.playbook ?? []).slice(0, 4),
    gates,
    measured_vs_inferred: {
      measured: ['Account signals + usage (as provided)', 'Readiness distribution (computed)'],
      inferred: ['Readiness per account', 'Offer fit', 'Timing windows'],
    },
  };
}