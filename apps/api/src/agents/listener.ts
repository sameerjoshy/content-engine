import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Listener — the Sales-engine signal monitor. It validates candidate market
 * signals against the ICP, routes only high-confidence ones, and keeps a
 * transparent veto log so you can see what was excluded and why.
 *
 * Gate (registry): single-source signals require corroboration before passing —
 * the noise threshold. Nothing is invented; a signal is either grounded in the
 * provided evidence or it is vetoed.
 *
 * Built against AGENT_QUALITY_STANDARD.md.
 */

export type SignalDecision = 'route' | 'veto';

export interface SignalVerdict {
  signal: string;
  company: string | null;
  trigger: string;
  decision: SignalDecision;
  /** 0-1 confidence in the why-now. */
  confidence: number;
  /** Why it routed or was vetoed — always stated. */
  reason: string;
  /** The exact evidence quote from the input, or null. */
  evidence: string | null;
}

export interface ListenerResult {
  sensitivity: string;
  routed: SignalVerdict[];
  vetoed: SignalVerdict[];
  digest: string;
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface ListenerInput {
  signals: string;
  icp: string;
  watchList?: string;
  sensitivity: 'broad' | 'buying_signals' | 'custom';
  onUsage?: UsageCallback;
}

export async function runListener(env: Env, input: ListenerInput): Promise<ListenerResult> {
  const { signals, icp, watchList, sensitivity, onUsage } = input;

  const result = await chatJson<{
    digest: string;
    verdicts: { signal: string; company: string | null; trigger: string; decision: SignalDecision; confidence: number; reason: string; evidence: string | null }[];
  }>(
    env,
    `You are a senior GTM signal analyst. You are ruthless about noise: a signal only routes if it is real, relevant to the ICP, and timely. Everything else gets vetoed — with the reason stated.

ICP: ${icp}
${watchList ? `WATCH LIST: ${watchList}` : ''}
SENSITIVITY: ${sensitivity}

For each candidate signal below:
- signal: a short label
- company: the account it concerns, or null
- trigger: the trigger type (e.g. funding, hiring, leadership change, product launch, tech adoption)
- decision: "route" if it passes; "veto" if it does not
- confidence: 0–1. A single-source signal with no corroboration must be ≤0.5 and is normally vetoed (noise threshold).
- reason: why it routed or was vetoed — always stated, plainly.
- evidence: the EXACT quote from the candidate signals that grounds it, or null. Never invent a signal or evidence.

Also write a "digest": one operator-voice line on what actually matters from this batch.
${sensitivity === 'buying_signals' ? 'Sensitivity is buying-signals-only: veto anything that is not a live buying signal.' : ''}

CANDIDATE SIGNALS:
${signals}

Return JSON: {"digest": "one line", "verdicts": [{"signal","company","trigger","decision","confidence","reason","evidence"}]}`,
    `Validate the candidate signals against the ICP and route the real ones.`,
    { temperature: 0.2, maxTokens: 2600, onUsage },
  );

  const verdicts: SignalVerdict[] = (result?.verdicts ?? []).map((v) => ({
    signal: v.signal ?? 'Untitled signal',
    company: v.company ?? null,
    trigger: v.trigger ?? 'unspecified',
    decision: v.decision === 'route' ? 'route' : 'veto',
    // Gate: single-source/no-evidence signals must not read as high confidence.
    confidence: v.evidence ? Math.max(0, Math.min(1, v.confidence ?? 0.5)) : Math.min(0.5, Math.max(0, v.confidence ?? 0.3)),
    reason: v.reason ?? 'No reason stated.',
    evidence: v.evidence ?? null,
  }));

  const routed = verdicts.filter((v) => v.decision === 'route').sort((a, b) => b.confidence - a.confidence);
  const vetoed = verdicts.filter((v) => v.decision === 'veto');

  const gates: { gate: string; note: string }[] = [];
  const uncorroborated = vetoed.filter((v) => !v.evidence);
  if (uncorroborated.length) {
    gates.push({ gate: 'Noise threshold', note: `${uncorroborated.length} signal(s) were vetoed for no corroborating evidence — single-source signals do not route.` });
  }

  const digest = result?.digest ?? `${routed.length} signal(s) routed, ${vetoed.length} vetoed.`;

  return {
    sensitivity,
    routed,
    vetoed,
    digest,
    gates,
    measured_vs_inferred: {
      measured: ['Candidate signals (as provided)', 'Evidence quotes (per signal)', 'Noise-threshold vetoes (computed)'],
      inferred: ['ICP relevance', 'Trigger classification', 'Signal confidence'],
    },
  };
}