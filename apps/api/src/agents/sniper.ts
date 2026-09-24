import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Sniper — the Sales-engine precision outreach drafter. It writes outreach
 * grounded in ONE specific real signal, self-critiques for relevance/tone, and
 * never sends without approval.
 *
 * Gates (registry): no specific signal = "insufficient context", never generic
 * copy. Every factual claim must trace to the signal brief (hallucination check).
 *
 * Built against AGENT_QUALITY_STANDARD.md — operator voice, grounded, honest.
 */

export interface DraftMessage {
  subject: string | null;
  body: string;
}

export interface SelfCritique {
  relevance: string;
  tone: string;
  signal_usage: string;
  length: string;
  /** true when the draft is ready for a human to review; false if it needs a real signal. */
  ready: boolean;
}

export interface SniperResult {
  channel: string;
  draft: DraftMessage;
  self_critique: SelfCritique;
  /** Claims that could not be traced to the signal brief (empty = clean). */
  untraceable_claims: string[];
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface SniperInput {
  signalBrief: string;
  persona: string;
  channel: 'email' | 'linkedin_dm' | 'call_script';
  onUsage?: UsageCallback;
}

export async function runSniper(env: Env, input: SniperInput): Promise<SniperResult> {
  const { signalBrief, persona, channel, onUsage } = input;

  const channelLabel = channel === 'linkedin_dm' ? 'LinkedIn DM' : channel === 'call_script' ? 'call script' : 'email';
  const hasSignal = signalBrief.trim().length >= 25;

  // Gate: no real signal → insufficient context, not generic copy.
  if (!hasSignal) {
    return {
      channel: channelLabel,
      draft: { subject: null, body: 'Insufficient context — there is no specific signal to ground this outreach. Paste the signal (a real event at the account) and I will write something worth sending.' },
      self_critique: { relevance: 'Cannot assess — no signal.', tone: 'n/a', signal_usage: 'None — refused to write generic copy.', length: 'n/a', ready: false },
      untraceable_claims: [],
      gates: [{ gate: 'Signal requirement', note: 'No specific signal was provided. Generic outreach is spam — this agent will not write it.' }],
      measured_vs_inferred: { measured: ['Signal brief (empty)'], inferred: [] },
    };
  }

  const result = await chatJson<{
    draft: { subject: string | null; body: string };
    self_critique: { relevance: string; tone: string; signal_usage: string; length: string };
    untraceable_claims: string[];
  }>(
    env,
    `You are a senior B2B seller writing ${channelLabel} outreach. You write like a person, not a template: short, specific, referencing ONE real event, and asking for something small.

RULES (non-negotiable):
- Ground EVERY factual claim in the signal brief. A "factual claim" is a statement asserted as true about the account or the world. Offers ("I can share…"), questions, and framing are NOT claims — do not list them.
- If the draft asserts a fact not in the brief, remove it and list it in untraceable_claims. Leave that array empty when every fact is sourced.
- One signal per message. Pick the SHARPEST signal as the hook; do not stack all of them. No feature dumps, no "I hope this finds you well", no fake familiarity.
- ${channel === 'email' ? 'Include a subject line.' : channel === 'linkedin_dm' ? 'No subject; conversational, under 90 words.' : 'A short call script with an opener, the signal, and one question.'}
- Self-critique honestly and constructively: relevance, tone, how the signal was used, length.

TARGET PERSONA: ${persona}

SIGNAL BRIEF (the only source of truth):
${signalBrief}

Return JSON: {"draft": {"subject": "..." or null, "body": "..."}, "self_critique": {"relevance","tone","signal_usage","length"}, "untraceable_claims": ["factual claims only, else empty array"]}`,
    `Write the ${channelLabel} grounded in the signal brief.`,
    { temperature: 0.5, maxTokens: 1800, onUsage },
  );

  const untraceable = (result?.untraceable_claims ?? []).filter((c) => c && c.length > 3);

  const gates: { gate: string; note: string }[] = [];
  if (untraceable.length) {
    gates.push({ gate: 'Hallucination check', note: `${untraceable.length} claim(s) could not be traced to the signal brief and must be removed or sourced before sending.` });
  }

  return {
    channel: channelLabel,
    draft: result?.draft ?? { subject: null, body: '' },
    self_critique: {
      relevance: result?.self_critique?.relevance ?? 'n/a',
      tone: result?.self_critique?.tone ?? 'n/a',
      signal_usage: result?.self_critique?.signal_usage ?? 'n/a',
      length: result?.self_critique?.length ?? 'n/a',
      ready: untraceable.length === 0,
    },
    untraceable_claims: untraceable,
    gates,
    measured_vs_inferred: {
      measured: ['Signal brief (source of truth)', 'Persona + channel inputs', 'Traceability check (computed)'],
      inferred: ['Draft relevance', 'Tone judgment', 'Self-critique scores'],
    },
  };
}