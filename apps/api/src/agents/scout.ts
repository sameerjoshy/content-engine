import type { Env } from '../env';
import { chatJson, type UsageCallback } from '../lib/llm';

/**
 * Signals Scout — the Sales-engine intent owner. Where the Listener curates a
 * batch of candidate signals, the Scout goes at ONE target account: it assembles
 * the intent picture from the signals provided and assigns a fit tier against
 * the ICP, so a rep knows whether to work the account now.
 *
 * Gate (registry): a fit tier requires (a) ICP fit AND (b) a live intent signal.
 * Fit without intent = "watch"; intent without fit = "not a fit" regardless of how
 * hot the signal looks. Only both together earn "hot".
 *
 * Built against AGENT_QUALITY_STANDARD.md — grounded in provided signals, tiers
 * tied to named evidence, honest when the signal is absent.
 */

export type IntentTier = 'hot' | 'warm' | 'watch' | 'not-a-fit';

export interface ScoutingSignal {
  signal: string;
  trigger: string;
  date: string | null;
  evidence: string | null;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface SignalsScoutResult {
  company: string;
  verdict: string;
  tier: IntentTier;
  icp_fit: { fits: boolean; score: number; why: string };
  intent: { present: boolean; score: number; why: string };
  signals: ScoutingSignal[];
  approach: { angle: string; opener: string; caution: string };
  gates: { gate: string; note: string }[];
  measured_vs_inferred: { measured: string[]; inferred: string[] };
}

interface SignalsScoutInput {
  company: string;
  domain?: string;
  icp: string;
  signals: string;
  lookback?: string;
  onUsage?: UsageCallback;
}

export async function runSignalsScout(env: Env, input: SignalsScoutInput): Promise<SignalsScoutResult> {
  const { company, domain, icp, signals, lookback, onUsage } = input;

  const result = await chatJson<{
    verdict: string;
    icp_fits: boolean;
    icp_score: number;
    icp_why: string;
    intent_present: boolean;
    intent_score: number;
    intent_why: string;
    signals: { signal: string; trigger: string; date: string | null; evidence: string | null; strength: 'strong' | 'moderate' | 'weak' }[];
    angle: string;
    opener: string;
    caution: string;
  }>(
    env,
    `You are a signal-to-intent analyst scouting ONE target account. From the signals provided, assess (a) how well the account fits the ICP and (b) whether there is live intent right now.

RULES:
- Work ONLY from the signals provided. Never invent signals, dates, or events. If a signal is absent, say it's absent.
- icp_fits / icp_score (0-1) / icp_why: does the account match the ICP definition, and why.
- intent_present / intent_score (0-1) / intent_why: is there a live buying signal (funding, hiring, leadership change, tech adoption, pain) right now.
- signals: each with trigger type, date if given, the EXACT evidence quote (or null), and strength (strong = explicit and recent, moderate, weak = ambiguous).
- angle: the specific hook to lead with. opener: a one-line opening that references the real signal (operator voice, no flattery). caution: what NOT to presume given the evidence.
- Be honest: a great-fit account with no live signal is NOT "hot". A hot signal at an account that doesn't fit the ICP is NOT a target.

TARGET: ${company}${domain ? ` (${domain})` : ''}
ICP: ${icp}
${lookback ? `LOOKBACK: ${lookback}` : ''}

SIGNALS:
${signals}

Return JSON: {"verdict": "...", "icp_fits": bool, "icp_score": 0-1, "icp_why": "...", "intent_present": bool, "intent_score": 0-1, "intent_why": "...", "signals": [{"signal","trigger","date","evidence","strength"}], "angle": "...", "opener": "...", "caution": "..."}`,
    `Assess ICP fit and live intent for ${company}, then set the tier.`,
    { temperature: 0.25, maxTokens: 2600, onUsage },
  );

  const icpFits = result?.icp_fits === true;
  const intentPresent = result?.intent_present === true;

  // Tier is determined by BOTH axes — fit alone or intent alone cannot be "hot".
  let tier: IntentTier;
  if (icpFits && intentPresent) tier = 'hot';
  else if (icpFits && !intentPresent) tier = 'watch';
  else if (!icpFits && intentPresent) tier = 'warm';
  else tier = 'not-a-fit';

  const signalsList: ScoutingSignal[] = (result?.signals ?? []).map((s) => ({
    signal: s.signal ?? '',
    trigger: s.trigger ?? 'unspecified',
    date: s.date ?? null,
    evidence: s.evidence ?? null,
    strength: (['strong', 'moderate', 'weak'].includes(s.strength) ? s.strength : 'weak') as ScoutingSignal['strength'],
  }));

  const gates: { gate: string; note: string }[] = [];
  if (icpFits && !intentPresent) {
    gates.push({ gate: 'Intent gate', note: 'The account fits the ICP but shows no live buying signal — work it as watch, not as a hot pursuit.' });
  }
  if (!icpFits && intentPresent) {
    gates.push({ gate: 'Fit gate', note: 'A live signal is present, but the account does not fit the ICP — a hot signal does not override poor fit.' });
  }
  if (!result?.signals?.length) {
    gates.push({ gate: 'Evidence gate', note: 'No signals were supplied — the tier is a fit read only, not an intent read.' });
  }

  return {
    company,
    verdict: result?.verdict ?? 'Scout read unavailable.',
    tier,
    icp_fit: { fits: icpFits, score: Math.max(0, Math.min(1, result?.icp_score ?? 0)), why: result?.icp_why ?? '' },
    intent: { present: intentPresent, score: Math.max(0, Math.min(1, result?.intent_score ?? 0)), why: result?.intent_why ?? '' },
    signals: signalsList.slice(0, 10),
    approach: {
      angle: result?.angle ?? '',
      opener: result?.opener ?? '',
      caution: result?.caution ?? '',
    },
    gates,
    measured_vs_inferred: {
      measured: ['Signals, dates, evidence quotes (as provided)', 'Tier rule: fit × intent (computed)', 'Signal strength (as assessed)'],
      inferred: ['ICP fit score', 'Intent score', 'Approach + caution'],
    },
  };
}