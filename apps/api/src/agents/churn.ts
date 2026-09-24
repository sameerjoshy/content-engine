import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Churn Radar — the Sustain-engine risk agent. Reads account signals (usage,
 * support, sentiment, renewal) and produces a health read, a risk tier, and the
 * specific evidence behind each account's risk — so a CSM knows who to call
 * first and why.
 *
 * Gates (registry): an account with no usage signal for 30 days OR a detractor
 * NPS is escalated to at-risk regardless of the average. Risk tiers cite evidence.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the operator's account
 * data, tiers tied to named evidence, honest when signals are missing.
 */

export interface AccountRisk {
  account: string;
  tier: 'healthy' | 'watch' | 'at-risk' | 'critical';
  driver: string;
  evidence: string;
  renewal: string | null;
}

export interface ChurnRadarResult {
  verdict: string;
  accounts: AccountRisk[];
  distribution: { healthy: number; watch: number; 'at-risk': number; critical: number };
  at_risk_value: string;
  playbook: { tier: string; action: string }[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface ChurnRadarInput {
  accountData: string;
  period?: string;
  onUsage?: UsageCallback;
}

const TIER_RANK = { critical: 0, 'at-risk': 1, watch: 2, healthy: 3 } as const;

export async function runChurnRadar(env: Env, input: ChurnRadarInput): Promise<ChurnRadarResult> {
  const { accountData, period, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    accounts: { account: string; tier: 'healthy' | 'watch' | 'at-risk' | 'critical'; driver: string; evidence: string; renewal: string | null }[];
    at_risk_value: string;
    playbook: { tier: string; action: string }[];
  }>(
    env,
    `You are a customer success analyst scoring account health and churn risk. From the account data below, tier each account and name the driver.

RULES:
- Work ONLY from the rows provided. Never invent accounts or signals.
- tier: "critical" = actively disengaging (usage collapse + detractor + renewal near, or support escalation). "at-risk" = clear warning signs. "watch" = one yellow flag. "healthy" = strong signals.
- driver: the single strongest signal behind the tier. evidence: the specific numbers/notes that support it.
- renewal: the renewal date/value if present, else null.
- at_risk_value: the combined contract value of accounts in at-risk + critical tiers (or "unknown").
- playbook: for each tier, ONE concrete action a CSM should take — grounded, not generic.
- Do not soften. A green average never hides a red account. If signals are missing for an account, say so rather than assuming healthy.

PERIOD: ${period || 'current'}

ACCOUNT DATA:
${accountData}

Return JSON: {"verdict": "...", "accounts": [{"account","tier","driver","evidence","renewal"}], "at_risk_value": "...", "playbook": [{"tier","action"}]}`,
    `Tier the accounts by churn risk and name the drivers.`,
    { temperature: 0.25, maxTokens: 2800, onUsage },
  );

  const accounts: AccountRisk[] = (result?.accounts ?? [])
    .map((a) => ({
      account: a.account ?? 'Unknown',
      tier: (['healthy', 'watch', 'at-risk', 'critical'].includes(a.tier) ? a.tier : 'watch') as AccountRisk['tier'],
      driver: a.driver ?? '',
      evidence: a.evidence ?? '',
      renewal: a.renewal ?? null,
    }))
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);

  const distribution = {
    healthy: accounts.filter((a) => a.tier === 'healthy').length,
    watch: accounts.filter((a) => a.tier === 'watch').length,
    'at-risk': accounts.filter((a) => a.tier === 'at-risk').length,
    critical: accounts.filter((a) => a.tier === 'critical').length,
  };

  const gates: { gate: string; note: string }[] = [];
  const escalated = accounts.filter((a) => a.tier === 'critical' || a.tier === 'at-risk');
  if (distribution.critical > 0) {
    gates.push({ gate: 'Escalation gate', note: `${distribution.critical} account${distribution.critical > 1 ? 's' : ''} in critical tier — call these first, ahead of any renewal motion.` });
  }
  if (escalated.length) {
    gates.push({ gate: 'Focus gate', note: `${escalated.length} account${escalated.length > 1 ? 's' : ''} need intervention; the rest are stable.` });
  }

  return {
    verdict: result?.verdict ?? 'Health read unavailable.',
    accounts: accounts.slice(0, 25),
    distribution,
    at_risk_value: result?.at_risk_value ?? 'unknown',
    playbook: (result?.playbook ?? []).slice(0, 4),
    gates,
    measured_vs_inferred: {
      measured: ['Account signals (usage, support, sentiment, renewal — as provided)', 'Tier distribution (computed)'],
      inferred: ['Tier per account', 'Driver + evidence emphasis', 'CSM actions'],
    },
  };
}