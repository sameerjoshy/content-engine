import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * ABM Playbook — the Marketing-engine account-based positioning builder. For
 * each named account it writes the story that account should hear and the
 * channel plan to deliver it — grounded in that account's real signals.
 *
 * Gate (registry): Signal gate — each account play grounds in real account
 * signals, not generic outreach. An account with no signal is flagged.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the provided account
 * context, signal-per-play enforced, honest when a signal is missing.
 */

export interface AccountPlay {
  account: string;
  story: string;
  positioning: string;
  channels: { channel: string; action: string; timing: string }[];
  signal: string | null;
  grounded: boolean;
}

export interface AbmPlaybookResult {
  verdict: string;
  plays: AccountPlay[];
  coverage: { grounded: number; ungrounded: number };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface AbmPlaybookInput {
  accounts: string;
  accountContext: string;
  yourPosition?: string;
  onUsage?: UsageCallback;
}

export async function runAbmPlaybook(env: Env, input: AbmPlaybookInput): Promise<AbmPlaybookResult> {
  const { accounts, accountContext, yourPosition, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    plays: { account: string; story: string; positioning: string; signal: string | null; channels: { channel: string; action: string; timing: string }[] }[];
  }>(
    env,
    `You are an account-based marketing strategist. For each named account, write the story it should hear and the channel plan to deliver it.

RULES:
- GROUND every play in the account's real signals from the context. If an account has no signal in the context, set signal to null and the play will be flagged — do not invent a reason to reach out.
- story: the message THIS account should hear — specific to what is true about them, not a generic value prop.
- positioning: how we position against what they likely run today.
- channels: for this account, the channels and actions in order, with timing. Not "post everywhere".
- Work ONLY from the accounts and context provided. Never invent an account or a signal.

${yourPosition ? `YOUR POSITION: ${yourPosition}` : ''}

NAMED ACCOUNTS:
${accounts}

ACCOUNT CONTEXT (signals):
${accountContext || 'No account context provided.'}

Return JSON: {"verdict": "...", "plays": [{"account","story","positioning","signal","channels":[{"channel","action","timing"}]}]}`,
    `Write the per-account play and story, grounded in each account's signals.`,
    { temperature: 0.35, maxTokens: 3000, onUsage },
  );

  const plays: AccountPlay[] = (result?.plays ?? []).map((p) => ({
    account: p.account ?? 'Unknown',
    story: p.story ?? '',
    positioning: p.positioning ?? '',
    channels: (p.channels ?? []).slice(0, 6).map((c) => ({ channel: c.channel ?? '', action: c.action ?? '', timing: c.timing ?? '' })),
    signal: p.signal ?? null,
    grounded: !!p.signal,
  }));

  const grounded = plays.filter((p) => p.grounded).length;
  const ungrounded = plays.length - grounded;

  const gates: { gate: string; note: string }[] = [];
  if (ungrounded > 0) {
    gates.push({ gate: 'Signal gate', note: `${ungrounded} account${ungrounded > 1 ? 's have' : ' has'} no grounding signal — the play for ${ungrounded > 1 ? 'them' : 'it'} is generic until you supply one. Find a real trigger first.` });
  }
  if (!accountContext) {
    gates.push({ gate: 'Context gate', note: 'No account context was provided — every play is generic. Add signals per account for a real ABM play.' });
  }

  return {
    verdict: result?.verdict ?? 'Playbook unavailable.',
    plays: plays.slice(0, 15),
    coverage: { grounded, ungrounded },
    gates,
    measured_vs_inferred: {
      measured: ['Accounts + context (as provided)', 'Grounded vs ungrounded plays (computed)'],
      inferred: ['The account story', 'Positioning', 'Channel timing'],
    },
  };
}