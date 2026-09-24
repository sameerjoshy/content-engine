import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Account Planner — the Marketing-engine target selector. Scores the account
 * universe against ICP fit and intent, tiers it, and names the focus set worth a
 * play this quarter.
 *
 * Gate (registry): Fit gate — accounts below the fit threshold are not
 * auto-selected into the focus set.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the account rows,
 * tiers from computed scores, honest when fit cannot be assessed.
 */

export interface TieredAccount {
  account: string;
  fit: number;
  intent: number;
  tier: 1 | 2 | 3 | 0;
  why: string;
}

export interface AccountPlannerResult {
  verdict: string;
  accounts: TieredAccount[];
  focus_set: string[];
  tiers: { tier1: number; tier2: number; tier3: number; excluded: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface AccountPlannerInput {
  accountUniverse: string;
  icp: string;
  fitThreshold?: string;
  onUsage?: UsageCallback;
}

const DEFAULT_THRESHOLD = 0.5;

export async function runAccountPlanner(env: Env, input: AccountPlannerInput): Promise<AccountPlannerResult> {
  const { accountUniverse, icp, fitThreshold, onUsage } = input;
  const threshold = Math.max(0, Math.min(1, parseFloat(fitThreshold ?? '') || DEFAULT_THRESHOLD));

  const result = await chatJson<{
    verdict: string;
    accounts: { account: string; fit: number; intent: number; why: string }[];
  }>(
    env,
    `You are a target-account planner. Score each account on the universe against ICP fit and intent, then the code tiers them.

RULES:
- Work ONLY from the accounts provided. Never invent an account.
- fit: 0-1, how well the account matches the ICP. intent: 0-1, evidence of a live buying signal. If intent evidence is absent, set it low (≤0.3) — absent intent is not unknown intent.
- why: one line — the specific reason for the fit score.
- Do not inflate fit to please. A poor-fit account scores low even if it looks impressive.

ICP: ${icp}

ACCOUNT UNIVERSE:
${accountUniverse}

Return JSON: {"verdict": "...", "accounts": [{"account","fit","intent","why"}]}`,
    `Score and explain each account's fit and intent.`,
    { temperature: 0.2, maxTokens: 2800, onUsage },
  );

  const accounts: TieredAccount[] = (result?.accounts ?? []).map((a) => {
    const fit = Math.max(0, Math.min(1, a.fit ?? 0));
    const intent = Math.max(0, Math.min(1, a.intent ?? 0));
    // Deterministic tiering from the scores (fit gate enforced here).
    let tier: TieredAccount['tier'];
    if (fit < threshold) tier = 0; // excluded — below fit threshold
    else if (fit >= 0.75 && intent >= 0.6) tier = 1;
    else if (fit >= 0.6 || intent >= 0.5) tier = 2;
    else tier = 3;
    return { account: a.account ?? 'Unknown', fit, intent, tier, why: a.why ?? '' };
  }).sort((a, b) => (b.fit + b.intent) - (a.fit + a.intent));

  const tiers = {
    tier1: accounts.filter((a) => a.tier === 1).length,
    tier2: accounts.filter((a) => a.tier === 2).length,
    tier3: accounts.filter((a) => a.tier === 3).length,
    excluded: accounts.filter((a) => a.tier === 0).length,
  };

  const focus_set = accounts.filter((a) => a.tier === 1).map((a) => a.account);

  const gates: { gate: string; note: string }[] = [];
  if (tiers.excluded > 0) {
    gates.push({ gate: 'Fit gate', note: `${tiers.excluded} account${tiers.excluded > 1 ? 's' : ''} fell below the ${threshold} fit threshold and were not selected into the focus set.` });
  }
  if (focus_set.length === 0) {
    gates.push({ gate: 'Focus gate', note: 'No account cleared tier 1 — there is no focus set this quarter. Widen the universe or lower the bar deliberately, not by accident.' });
  }
  if (!result?.accounts?.length) {
    gates.push({ gate: 'Input gate', note: 'No accounts could be scored from the input provided.' });
  }

  return {
    verdict: result?.verdict ?? 'Tiering unavailable.',
    accounts: accounts.slice(0, 30),
    focus_set,
    tiers,
    gates,
    measured_vs_inferred: {
      measured: ['Account rows (as provided)', 'Fit + intent thresholding and tiering (computed)'],
      inferred: ['Fit score', 'Intent score', 'Reason'],
    },
  };
}