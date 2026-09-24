import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Video Outreach — the Sales-engine video brief drafter. Turns a specific signal
 * and a persona into a recordable video script: hook → proof → ask, under 60s.
 *
 * Gate (registry): Signal requirement — no specific signal = no brief. A video
 * without a reason to send is spam.
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in the signal provided,
 * refuses without one, honest about what the persona will care about.
 */

export interface VideoBriefResult {
  has_signal: boolean;
  verdict: string;
  script: { hook: string; proof: string; ask: string };
  beats: { t: string; line: string; on_screen: string }[];
  delivery: { channel: string; timing: string; note: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface VideoBriefInput {
  signalBrief: string;
  persona: string;
  yourOffer?: string;
  onUsage?: UsageCallback;
}

const NO_SIGNAL = /^(none|no signal|n\/a|unknown|nothing|-|)$/i;

export async function runVideoOutreach(env: Env, input: VideoBriefInput): Promise<VideoBriefResult> {
  const { signalBrief, persona, yourOffer, onUsage } = input;
  const hasSignal = signalBrief.trim().length >= 12 && !NO_SIGNAL.test(signalBrief.trim());

  // Gate runs first — no signal, no brief. Do not spend an LLM call inventing one.
  if (!hasSignal) {
    return {
      has_signal: false,
      verdict: 'No specific signal — refusing to draft. A video without a real reason to send is spam.',
      script: { hook: '', proof: '', ask: '' },
      beats: [],
      delivery: { channel: '', timing: '', note: '' },
      gates: [{ gate: 'Signal requirement', note: 'No specific signal was provided. Find a real trigger for this account before recording — a personalised video with nothing personal in it converts worse than an email.' }],
      measured_vs_inferred: { measured: ['Signal brief (as provided)'], inferred: [] },
    };
  }

  const result = await chatJson<{
    verdict: string;
    hook: string;
    proof: string;
    ask: string;
    beats: { t: string; line: string; on_screen: string }[];
    channel: string;
    timing: string;
    note: string;
  }>(
    env,
    `You are a video outreach specialist. Write a recordable video script — hook, proof, ask — under 60 seconds, grounded in the signal.

RULES:
- The HOOK must reference the specific signal in the first 5 seconds. No "hope you're well". If it could be sent to anyone, rewrite it.
- PROOF: one concrete, relevant point — not a feature dump.
- ASK: one low-friction next step.
- beats: the script broken into time-stamped lines with a note on what to show on screen. Total must be under 60 seconds (aim 35-50s).
- Work ONLY from the signal and persona provided. Never invent a fact about the account.
- Write the way a person talks, not the way a brochure reads.

SIGNAL: ${signalBrief}
PERSONA: ${persona}
${yourOffer ? `OFFER: ${yourOffer}` : ''}

Return JSON: {"verdict": "...", "hook": "...", "proof": "...", "ask": "...", "beats": [{"t","line","on_screen"}], "channel": "...", "timing": "...", "note": "..."}`,
    `Write the video script and the delivery note.`,
    { temperature: 0.4, maxTokens: 2200, onUsage },
  );

  const beats = (result?.beats ?? []).slice(0, 10).map((b) => ({ t: b.t ?? '', line: b.line ?? '', on_screen: b.on_screen ?? '' }));

  return {
    has_signal: true,
    verdict: result?.verdict ?? 'Script drafted.',
    script: { hook: result?.hook ?? '', proof: result?.proof ?? '', ask: result?.ask ?? '' },
    beats,
    delivery: { channel: result?.channel ?? '', timing: result?.timing ?? '', note: result?.note ?? '' },
    gates: [],
    measured_vs_inferred: {
      measured: ['Signal + persona (as provided)'],
      inferred: ['Hook framing', 'Proof selection', 'Delivery timing'],
    },
  };
}